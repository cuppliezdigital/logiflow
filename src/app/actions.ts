'use server';

// ============================================================================
// SERVER ACTIONS - LOGIFLOW MANPOWER CONTROL
// Berisi seluruh fungsi backend operasi database:
// 1. Kelola Vendor (CRUD Vendor Langsung dari UI)
// 2. Master Data (Vendor Aktif & Shift Pagi/Malam)
// 3. Plotingan Terpadu: 1 Vendor mencakup kuota REGULAR & ADDITIONAL sekaligus
// 4. Absen Masuk: Multi-Foto per Bagian (Bongkar, Muat, Sortir, Repack, FIFO) + Validasi Wajib
// 5. Absen Pulang: Multi-Foto Checkout per Bagian + Validasi Wajib + Bukti P3K
// 6. Rekapitulasi Laporan KPI & Integrasi Tagihan
// ============================================================================

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { uploadToSupabaseStorage, isSupabaseConfigured } from '@/lib/supabase';

// ----------------------------------------------------------------------------
// HELPER: Menyimpan File Gambar yang Diunggah (Supabase Storage / Lokal)
// ----------------------------------------------------------------------------
/**
 * Fungsi pembantu untuk memproses file upload (foto serah terima masuk, checkout pulang, klinik).
 * Di Vercel: otomatis diunggah ke Supabase Storage dan menghasilkan URL publik permanen.
 * Di Localhost: fallback otomatis disimpan di folder `public/uploads/`.
 */
async function saveUploadedFile(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Generate nama file unik menggunakan timestamp dan random string
  const ext = path.extname(file.name) || '.jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;

  // 1. Jika Supabase Storage terkonfigurasi (di Vercel / Cloud)
  if (isSupabaseConfigured) {
    const cloudUrl = await uploadToSupabaseStorage(buffer, fileName, file.type || 'image/jpeg');
    if (cloudUrl) {
      return cloudUrl;
    }
    // Jika upload ke cloud gagal, coba fallback ke penyimpanan lokal
  }

  // 2. Fallback: Simpan ke folder lokal public/uploads (saat develop di localhost)
  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${fileName}`;
  } catch (localErr) {
    console.error('Peringatan: Gagal menyimpan file ke penyimpanan lokal:', localErr);
    return null;
  }
}

// ----------------------------------------------------------------------------
// 1. MANAJEMEN VENDOR (CRUD VENDOR LANGSUNG DARI WEB)
// ----------------------------------------------------------------------------
export async function createVendor(formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const picName = (formData.get('picName') as string)?.trim() || null;
  const phone = (formData.get('phone') as string)?.trim() || null;

  if (!name) {
    return { success: false, error: 'Nama perusahaan vendor wajib diisi.' };
  }

  await prisma.vendor.create({
    data: {
      name,
      picName,
      phone,
      status: 'ACTIVE',
    },
  });

  revalidatePath('/');
  return { success: true };
}

export async function updateVendor(id: string, formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const picName = (formData.get('picName') as string)?.trim() || null;
  const phone = (formData.get('phone') as string)?.trim() || null;

  if (!name) {
    return { success: false, error: 'Nama perusahaan vendor wajib diisi.' };
  }

  await prisma.vendor.update({
    where: { id },
    data: {
      name,
      picName,
      phone,
    },
  });

  revalidatePath('/');
  return { success: true };
}

export async function deleteVendor(id: string) {
  const plotinganCount = await prisma.plotingan.count({ where: { vendorId: id } });

  if (plotinganCount > 0) {
    await prisma.vendor.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  } else {
    await prisma.vendor.delete({ where: { id } });
  }

  revalidatePath('/');
  return { success: true };
}

// ----------------------------------------------------------------------------
// 2. MASTER DATA: Mengambil Data Vendor Aktif dan Shift Kerja
// ----------------------------------------------------------------------------
export async function getMasterData() {
  let [vendors, shifts] = await Promise.all([
    prisma.vendor.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
    prisma.shift.findMany({ orderBy: { name: 'asc' } }),
  ]);

  // 1. DEDUP & CLEANUP SHIFT (Mencegah tombol shift ganda/dobel)
  const uniqueShiftMap = new Map<string, typeof shifts[0]>();
  const duplicateShiftIds: { dupId: string; keeperId: string }[] = [];

  for (const s of shifts) {
    // Normalisasi nama shift (Shift Pagi & Shift Malam)
    const cleanName = s.name.toLowerCase().includes('pagi')
      ? 'Shift Pagi'
      : s.name.toLowerCase().includes('malam')
      ? 'Shift Malam'
      : s.name.trim();

    if (!uniqueShiftMap.has(cleanName)) {
      uniqueShiftMap.set(cleanName, s);
    } else {
      const keeper = uniqueShiftMap.get(cleanName)!;
      duplicateShiftIds.push({ dupId: s.id, keeperId: keeper.id });
    }
  }

  // Jika terdeteksi duplikasi shift di database, migrasi relasi data lalu hapus ID yang duplikat
  if (duplicateShiftIds.length > 0) {
    try {
      for (const item of duplicateShiftIds) {
        await prisma.plotingan.updateMany({
          where: { shiftId: item.dupId },
          data: { shiftId: item.keeperId },
        });
        await prisma.underAssignment.updateMany({
          where: { shiftId: item.dupId },
          data: { shiftId: item.keeperId },
        });
        await prisma.shift.delete({ where: { id: item.dupId } }).catch(() => {});
      }
    } catch (e) {
      console.error('Peringatan saat membersihkan duplikasi shift:', e);
    }
    // Muat ulang daftar shift yang sudah bersih
    shifts = Array.from(uniqueShiftMap.values());
  } else if (shifts.length === 0) {
    // Auto-seed: Buat Shift Pagi & Shift Malam jika database baru masih benar-benar kosong
    await prisma.shift.createMany({
      data: [
        { name: 'Shift Pagi', startTime: '07:00', endTime: '15:30' },
        { name: 'Shift Malam', startTime: '19:00', endTime: '03:30' },
      ],
    });
    shifts = await prisma.shift.findMany({ orderBy: { name: 'asc' } });
  } else {
    shifts = Array.from(uniqueShiftMap.values());
  }

  // 2. DEDUP & CLEANUP VENDOR (Mencegah nama vendor ganda)
  const uniqueVendorMap = new Map<string, typeof vendors[0]>();
  const duplicateVendorIds: { dupId: string; keeperId: string }[] = [];

  for (const v of vendors) {
    const cleanName = v.name.toLowerCase().trim();
    if (!uniqueVendorMap.has(cleanName)) {
      uniqueVendorMap.set(cleanName, v);
    } else {
      const keeper = uniqueVendorMap.get(cleanName)!;
      duplicateVendorIds.push({ dupId: v.id, keeperId: keeper.id });
    }
  }

  if (duplicateVendorIds.length > 0) {
    try {
      for (const item of duplicateVendorIds) {
        await prisma.plotingan.updateMany({
          where: { vendorId: item.dupId },
          data: { vendorId: item.keeperId },
        });
        await prisma.vendor.delete({ where: { id: item.dupId } }).catch(() => {});
      }
    } catch (e) {
      console.error('Peringatan saat membersihkan duplikasi vendor:', e);
    }
    vendors = Array.from(uniqueVendorMap.values());
  } else if (vendors.length === 0) {
    // Auto-seed: Inisialisasi daftar vendor awal jika belum ada
    await prisma.vendor.createMany({
      data: [
        { name: 'PT BAL Logistik' },
        { name: 'PT SDM Mitra Jaya' },
        { name: 'PT MAXIMUS Tenaga' },
        { name: 'PT ESA Mandiri' },
      ],
    });
    vendors = await prisma.vendor.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } });
  } else {
    vendors = Array.from(uniqueVendorMap.values());
  }

  return { vendors, shifts };
}

// ----------------------------------------------------------------------------
// 3. MODUL PLOTINGAN: 1 Entri per Vendor mencakup REGULAR & ADDITIONAL Sekaligus
// ----------------------------------------------------------------------------
export async function getPlotingans(date?: string) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const list = await prisma.plotingan.findMany({
    where: { date: targetDate },
    include: {
      vendor: true,
      shift: true,
      attendanceIn: {
        include: {
          attendanceOut: true,
        },
      },
    },
    orderBy: [{ shift: { name: 'asc' } }, { vendor: { name: 'asc' } }],
  });
  return list;
}

export async function createPlotingan(formData: FormData) {
  const date = formData.get('date') as string;
  const vendorId = formData.get('vendorId') as string;
  const shiftId = formData.get('shiftId') as string;
  
  const rawTargetHeadcount = parseInt(formData.get('targetHeadcount') as string, 10);
  const targetRegular = parseInt(formData.get('targetRegular') as string, 10) || 0;
  const targetAdditional = parseInt(formData.get('targetAdditional') as string, 10) || 0;
  const targetHeadcount = !isNaN(rawTargetHeadcount) && rawTargetHeadcount > 0 
    ? rawTargetHeadcount 
    : (targetRegular + targetAdditional);

  const workingHours = (formData.get('workingHours') as string)?.trim() || null;
  const notes = (formData.get('notes') as string) || null;

  if (!date || !vendorId || !shiftId || targetHeadcount <= 0) {
    return { success: false, error: 'Target kebutuhan manpower minimal 1 orang.' };
  }

  const existing = await prisma.plotingan.findFirst({
    where: {
      date,
      vendorId,
      shiftId,
    },
  });

  if (existing) {
    return { 
      success: false, 
      error: 'Vendor ini sudah memiliki plotingan pada shift ini. Silakan gunakan tombol Edit untuk mengubah kuota.' 
    };
  }

  await prisma.plotingan.create({
    data: {
      date,
      vendorId,
      shiftId,
      targetRegular,
      targetAdditional,
      targetHeadcount,
      status: 'MIXED',
      workingHours,
      notes,
    },
  });

  revalidatePath('/');
  return { success: true };
}

export async function updatePlotingan(id: string, formData: FormData) {
  const rawTargetHeadcount = parseInt(formData.get('targetHeadcount') as string, 10);
  const targetRegular = parseInt(formData.get('targetRegular') as string, 10) || 0;
  const targetAdditional = parseInt(formData.get('targetAdditional') as string, 10) || 0;
  const targetHeadcount = !isNaN(rawTargetHeadcount) && rawTargetHeadcount > 0 
    ? rawTargetHeadcount 
    : (targetRegular + targetAdditional);

  const workingHours = (formData.get('workingHours') as string)?.trim() || null;
  const notes = (formData.get('notes') as string) || null;

  if (targetHeadcount <= 0) {
    return { success: false, error: 'Total target kebutuhan manpower harus lebih dari 0.' };
  }

  await prisma.plotingan.update({
    where: { id },
    data: {
      targetRegular,
      targetAdditional,
      targetHeadcount,
      workingHours,
      notes,
    },
  });

  revalidatePath('/');
  return { success: true };
}

export async function deletePlotingan(id: string) {
  await prisma.plotingan.delete({ where: { id } });
  revalidatePath('/');
  return { success: true };
}

export async function deleteMultiplePlotingans(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true };
  await prisma.plotingan.deleteMany({
    where: {
      id: { in: ids },
    },
  });
  revalidatePath('/');
  return { success: true };
}

export async function getDatesWithData(): Promise<string[]> {
  const plots = await prisma.plotingan.findMany({
    select: { date: true },
    distinct: ['date'],
  });
  return plots.map((p) => p.date);
}

// ============================================================================
// FUNGSI BARU: SIMPAN PLOTINGAN SEKALIGUS (BATCH UPSERT MASSAL)
// Memungkinkan supervisor gudang menginput seluruh vendor dalam 1 kali simpan.
// Jika targetHeadcount > 0:
// - Jika belum ada plotingan di (date, vendorId, shiftId) -> Buat baru (Create)
// - Jika sudah ada plotingan -> Perbarui kuota targetHeadcount & jam/catatan (Update)
// Vendor yang targetHeadcount = 0 / kosong dilewati agar tidak menjadi data sampah.
// ============================================================================
export async function saveBatchPlotingan(payload: {
  date: string;
  shiftId: string;
  defaultWorkingHours?: string;
  items: Array<{
    vendorId: string;
    targetHeadcount: number;
    workingHours?: string;
    notes?: string;
  }>;
}) {
  const { date, shiftId, defaultWorkingHours, items } = payload;

  if (!date || !shiftId || !items || items.length === 0) {
    return { success: false, error: 'Data batch plotingan tidak lengkap.' };
  }

  // Filter hanya item yang target headcount-nya lebih dari 0
  const validItems = items.filter((item) => Number(item.targetHeadcount) > 0);

  if (validItems.length === 0) {
    return { success: false, error: 'Minimal harus ada 1 vendor dengan target kuota lebih dari 0.' };
  }

  try {
    let savedCount = 0;

    // Gunakan transaction untuk memastikan integritas data
    await prisma.$transaction(async (tx) => {
      for (const item of validItems) {
        const count = Math.max(0, parseInt(item.targetHeadcount as any, 10) || 0);
        if (count <= 0) continue;

        const effectiveHours = item.workingHours?.trim() || defaultWorkingHours?.trim() || null;
        const effectiveNotes = item.notes?.trim() || null;

        // Cek apakah sudah ada plotingan untuk vendor & shift ini pada tanggal yang sama
        const existing = await tx.plotingan.findFirst({
          where: {
            date,
            vendorId: item.vendorId,
            shiftId,
          },
        });

        if (existing) {
          // Update data kuota yang sudah ada
          await tx.plotingan.update({
            where: { id: existing.id },
            data: {
              targetHeadcount: count,
              workingHours: effectiveHours,
              notes: effectiveNotes,
            },
          });
        } else {
          // Buat entri plotingan baru
          await tx.plotingan.create({
            data: {
              date,
              vendorId: item.vendorId,
              shiftId,
              targetRegular: 0,
              targetAdditional: 0,
              targetHeadcount: count,
              status: 'MIXED',
              workingHours: effectiveHours,
              notes: effectiveNotes,
            },
          });
        }
        savedCount++;
      }
    });

    revalidatePath('/');
    return { success: true, savedCount };
  } catch (error: any) {
    console.error('Error saat simpan batch plotingan:', error);
    return { success: false, error: error.message || 'Gagal menyimpan data plotingan massal.' };
  }
}

// ============================================================================
// FUNGSI BARU: SALIN PLOTINGAN DARI H-1 (ATAU TANGGAL TERTENTU)
// Mengambil konfigurasi kuota vendor dari tanggal sebelumnya untuk shift terkait.
// Hasilnya dikembalikan ke frontend agar user bisa meninjau dan mengedit sebelum disimpan.
// ============================================================================
export async function getPlotinganForCopy(sourceDate: string, shiftId: string) {
  try {
    const list = await prisma.plotingan.findMany({
      where: {
        date: sourceDate,
        shiftId: shiftId,
      },
      select: {
        vendorId: true,
        targetHeadcount: true,
        workingHours: true,
        notes: true,
      },
    });
    return { success: true, data: list };
  } catch (error: any) {
    console.error('Error saat mengambil plotingan untuk disalin:', error);
    return { success: false, error: 'Gagal mengambil data dari tanggal kemarin.' };
  }
}

// ----------------------------------------------------------------------------
// 4. MODUL ABSEN MASUK: Multi-Foto per Bagian Gudang + Validasi Ketat Wajib Foto
// ----------------------------------------------------------------------------
/**
 * Menyimpan absensi serah terima masuk:
 * - Mendukung kumpulan foto per bagian: [{ section: 'Bongkar', url: '...' }]
 * - Validasi: WAJIB melampirkan minimal 1 foto untuk kuota yang ada orangnya.
 */
export async function submitAbsenMasuk(formData: FormData) {
  const plotinganId = formData.get('plotinganId') as string;
  const actualRegular = parseInt(formData.get('actualRegular') as string, 10) || 0;
  const actualAdditional = parseInt(formData.get('actualAdditional') as string, 10) || 0;
  const actualHeadcount = actualRegular + actualAdditional;
  const notes = (formData.get('notes') as string) || null;

  if (!plotinganId || actualHeadcount <= 0) {
    return { success: false, error: 'Total orang masuk harus minimal 1 orang.' };
  }

  // 1. Proses Multi-Foto Barisan REGULAR
  const regularCount = parseInt(formData.get('photoInRegular_count') as string, 10) || 0;
  const regularPhotos: Array<{ section: string; url: string }> = [];

  for (let i = 0; i < regularCount; i++) {
    const section = (formData.get(`photoInRegular_section_${i}`) as string)?.trim() || 'Umum';
    const file = formData.get(`photoInRegular_file_${i}`) as File | null;
    const existingUrl = formData.get(`photoInRegular_existing_${i}`) as string | null;

    let url = existingUrl;
    if (file && file.size > 0) {
      url = await saveUploadedFile(file);
    }

    if (url) {
      regularPhotos.push({ section, url });
    }
  }

  // 2. Proses Multi-Foto Barisan ADDITIONAL
  const additionalCount = parseInt(formData.get('photoInAdditional_count') as string, 10) || 0;
  const additionalPhotos: Array<{ section: string; url: string }> = [];

  for (let i = 0; i < additionalCount; i++) {
    const section = (formData.get(`photoInAdditional_section_${i}`) as string)?.trim() || 'Umum';
    const file = formData.get(`photoInAdditional_file_${i}`) as File | null;
    const existingUrl = formData.get(`photoInAdditional_existing_${i}`) as string | null;

    let url = existingUrl;
    if (file && file.size > 0) {
      url = await saveUploadedFile(file);
    }

    if (url) {
      additionalPhotos.push({ section, url });
    }
  }

  // VALIDASI FOTO ABSEN MASUK:
  // Mendukung foto full barisan sekaligus atau foto terpisah per kategori
  const hasAnyPhoto = regularPhotos.length > 0 || additionalPhotos.length > 0;
  if (actualHeadcount > 0 && !hasAnyPhoto) {
    return { success: false, error: 'Wajib melampirkan minimal 1 foto bukti fisik kehadiran pasukan vendor!' };
  }

  // Jika vendor membawa kedua kategori (Reg & Add) namun mengunggah foto full kontingen secara serentak,
  // salin referensi foto agar kedua kategori memiliki data dokumentasi yang lengkap
  if (actualRegular > 0 && regularPhotos.length === 0 && additionalPhotos.length > 0) {
    regularPhotos.push(...additionalPhotos);
  } else if (actualAdditional > 0 && additionalPhotos.length === 0 && regularPhotos.length > 0) {
    additionalPhotos.push(...regularPhotos);
  }

  const photosRegularJson = JSON.stringify(regularPhotos);
  const photosAdditionalJson = JSON.stringify(additionalPhotos);
  const photoInRegularUrl = regularPhotos[0]?.url || null;
  const photoInAdditionalUrl = additionalPhotos[0]?.url || null;

  await prisma.attendanceIn.upsert({
    where: { plotinganId },
    create: {
      plotinganId,
      actualRegular,
      actualAdditional,
      actualHeadcount,
      photosRegularJson,
      photosAdditionalJson,
      photoInRegularUrl,
      photoInAdditionalUrl,
      photoInUrl: photoInRegularUrl || photoInAdditionalUrl,
      notes,
    },
    update: {
      actualRegular,
      actualAdditional,
      actualHeadcount,
      photosRegularJson,
      photosAdditionalJson,
      photoInRegularUrl,
      photoInAdditionalUrl,
      photoInUrl: photoInRegularUrl || photoInAdditionalUrl || undefined,
      notes,
    },
  });

  revalidatePath('/');
  return { success: true };
}

// ----------------------------------------------------------------------------
// 5. MODUL ABSEN PULANG: Multi-Foto Checkout per Bagian + Validasi Ketat
// ----------------------------------------------------------------------------
export async function submitAbsenPulang(formData: FormData) {
  const attendanceInId = formData.get('attendanceInId') as string;
  
  const pulangRegular = parseInt(formData.get('pulangRegular') as string, 10) || 0;
  const pulangAdditional = parseInt(formData.get('pulangAdditional') as string, 10) || 0;
  const pulangHeadcount = pulangRegular + pulangAdditional;

  const tumbangRegular = parseInt(formData.get('tumbangRegular') as string, 10) || 0;
  const tumbangAdditional = parseInt(formData.get('tumbangAdditional') as string, 10) || 0;
  const tumbangHeadcount = tumbangRegular + tumbangAdditional;

  const tumbangNotes = (formData.get('tumbangNotes') as string) || null;

  if (!attendanceInId) {
    return { success: false, error: 'Data absen masuk tidak ditemukan.' };
  }

  const attendanceIn = await prisma.attendanceIn.findUnique({
    where: { id: attendanceInId },
  });

  if (!attendanceIn) {
    return { success: false, error: 'Data absensi masuk tidak valid.' };
  }

  // 1. Multi-Foto Checkout Pulang REGULAR
  const pulangRegCount = parseInt(formData.get('photoPulangRegular_count') as string, 10) || 0;
  const pulangRegularPhotos: Array<{ section: string; url: string }> = [];

  for (let i = 0; i < pulangRegCount; i++) {
    const section = (formData.get(`photoPulangRegular_section_${i}`) as string)?.trim() || 'Umum';
    const file = formData.get(`photoPulangRegular_file_${i}`) as File | null;
    const existingUrl = formData.get(`photoPulangRegular_existing_${i}`) as string | null;

    let url = existingUrl;
    if (file && file.size > 0) {
      url = await saveUploadedFile(file);
    }
    if (url) {
      pulangRegularPhotos.push({ section, url });
    }
  }

  // 2. Multi-Foto Checkout Pulang ADDITIONAL
  const pulangAddCount = parseInt(formData.get('photoPulangAdditional_count') as string, 10) || 0;
  const pulangAdditionalPhotos: Array<{ section: string; url: string }> = [];

  for (let i = 0; i < pulangAddCount; i++) {
    const section = (formData.get(`photoPulangAdditional_section_${i}`) as string)?.trim() || 'Umum';
    const file = formData.get(`photoPulangAdditional_file_${i}`) as File | null;
    const existingUrl = formData.get(`photoPulangAdditional_existing_${i}`) as string | null;

    let url = existingUrl;
    if (file && file.size > 0) {
      url = await saveUploadedFile(file);
    }
    if (url) {
      pulangAdditionalPhotos.push({ section, url });
    }
  }

  // 3. Multi-Foto Bukti Tumbang / Kejadian per Jam (Mendukung > 1 Orang di Jam Berbeda)
  // Setiap kejadian mencatat: Kategori (Reg/Add), Jam Keluar, Jenis Kendala, Catatan, & Foto Bukti Mandiri.
  const tumbangIncidentCount = parseInt(formData.get('photoTumbang_count') as string, 10) || 0;
  const tumbangIncidents: Array<{
    category: string;
    time: string;
    type: string;
    notes: string;
    url: string;
  }> = [];

  for (let i = 0; i < tumbangIncidentCount; i++) {
    const category = (formData.get(`photoTumbang_category_${i}`) as string) || 'REGULAR';
    const time = (formData.get(`photoTumbang_time_${i}`) as string) || '';
    const type = (formData.get(`photoTumbang_type_${i}`) as string) || 'Sakit';
    const notes = (formData.get(`photoTumbang_notes_${i}`) as string) || '';
    const file = formData.get(`photoTumbang_file_${i}`) as File | null;
    const existingUrl = formData.get(`photoTumbang_existing_${i}`) as string | null;

    let url = existingUrl || '';
    if (file && file.size > 0) {
      // Simpan file ke direktori uploads dan ambil path publiknya
      const uploadedUrl = await saveUploadedFile(file);
      if (uploadedUrl) {
        url = uploadedUrl;
      }
    }
    tumbangIncidents.push({ category, time, type, notes, url });
  }

  // Fallback foto utama (foto kejadian pertama atau single upload)
  let photoTumbangUrl = tumbangIncidents.find(inc => inc.url)?.url || (formData.get('photoTumbang_existing') as string | null);
  const singlePhotoTumbangFile = formData.get('photoTumbang') as File | null;
  if (singlePhotoTumbangFile && singlePhotoTumbangFile.size > 0) {
    photoTumbangUrl = await saveUploadedFile(singlePhotoTumbangFile);
  }

  // Jika ada multi-kejadian, simpan format JSON terstruktur ke tumbangNotes agar data jam & alasan tersimpan utuh
  let finalTumbangNotes = tumbangNotes;
  if (tumbangIncidents.length > 0) {
    finalTumbangNotes = JSON.stringify(tumbangIncidents);
  }

  // VALIDASI KETAT WAJIB FOTO CHECKOUT & BUKTI TUMBANG:
  if (pulangRegular > 0 && pulangRegularPhotos.length === 0) {
    return { success: false, error: 'Wajib melampirkan minimal 1 foto barisan checkout kepulangan REGULAR!' };
  }

  if (pulangAdditional > 0 && pulangAdditionalPhotos.length === 0) {
    return { success: false, error: 'Wajib melampirkan minimal 1 foto barisan checkout kepulangan ADDITIONAL!' };
  }

  if (tumbangHeadcount > 0 && !photoTumbangUrl && tumbangIncidents.every(i => !i.url)) {
    return { success: false, error: 'Wajib melampirkan foto bukti surat dokter / klinik P3K untuk pekerja yang tumbang!' };
  }

  // AUDIT INTEGRITAS MASING-MASING KATEGORI:
  const selisihRegular = attendanceIn.actualRegular - (pulangRegular + tumbangRegular);
  const selisihAdditional = attendanceIn.actualAdditional - (pulangAdditional + tumbangAdditional);
  const selisihCount = selisihRegular + selisihAdditional;
  const isBalanced = selisihCount === 0;

  const photosPulangRegularJson = JSON.stringify(pulangRegularPhotos);
  const photosPulangAdditionalJson = JSON.stringify(pulangAdditionalPhotos);
  const photoPulangRegularUrl = pulangRegularPhotos[0]?.url || null;
  const photoPulangAdditionalUrl = pulangAdditionalPhotos[0]?.url || null;

  await prisma.attendanceOut.upsert({
    where: { attendanceInId },
    create: {
      attendanceInId,
      pulangRegular,
      pulangAdditional,
      pulangHeadcount,
      tumbangRegular,
      tumbangAdditional,
      tumbangHeadcount,
      photosPulangRegularJson,
      photosPulangAdditionalJson,
      photoPulangRegularUrl,
      photoPulangAdditionalUrl,
      photoPulangUrl: photoPulangRegularUrl || photoPulangAdditionalUrl,
      photoTumbangUrl,
      tumbangNotes: finalTumbangNotes,
      selisihRegular,
      selisihAdditional,
      selisihCount,
      isBalanced,
    },
    update: {
      pulangRegular,
      pulangAdditional,
      pulangHeadcount,
      tumbangRegular,
      tumbangAdditional,
      tumbangHeadcount,
      photosPulangRegularJson,
      photosPulangAdditionalJson,
      photoPulangRegularUrl,
      photoPulangAdditionalUrl,
      photoPulangUrl: photoPulangRegularUrl || photoPulangAdditionalUrl || undefined,
      photoTumbangUrl,
      tumbangNotes: finalTumbangNotes,
      selisihRegular,
      selisihAdditional,
      selisihCount,
      isBalanced,
    },
  });

  revalidatePath('/');
  return { success: true, isBalanced, selisihCount, selisihRegular, selisihAdditional };
}

// ----------------------------------------------------------------------------
// 6. MODUL LAPORAN & REKAP KPI
// ----------------------------------------------------------------------------
export async function getReportStats(startDate: string, endDate: string, vendorId?: string) {
  const whereClause: any = {
    date: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (vendorId && vendorId !== 'ALL') {
    whereClause.vendorId = vendorId;
  }

  const records = await prisma.plotingan.findMany({
    where: whereClause,
    include: {
      vendor: true,
      shift: true,
      attendanceIn: {
        include: {
          attendanceOut: true,
        },
      },
    },
    orderBy: [{ date: 'desc' }, { shift: { name: 'asc' } }, { vendor: { name: 'asc' } }],
  });

  let totalTarget = 0;
  let regTarget = 0;
  let addTarget = 0;

  let totalMasuk = 0;
  let regMasuk = 0;
  let addMasuk = 0;

  let totalPulang = 0;
  let regPulang = 0;
  let addPulang = 0;

  let totalTumbang = 0;
  let regTumbang = 0;
  let addTumbang = 0;

  let totalSelisih = 0;
  let regSelisih = 0;
  let addSelisih = 0;

  records.forEach((r) => {
    totalTarget += r.targetHeadcount;
    regTarget += r.targetRegular;
    addTarget += r.targetAdditional;

    if (r.attendanceIn) {
      totalMasuk += r.attendanceIn.actualHeadcount;
      regMasuk += r.attendanceIn.actualRegular;
      addMasuk += r.attendanceIn.actualAdditional;

      if (r.attendanceIn.attendanceOut) {
        totalPulang += r.attendanceIn.attendanceOut.pulangHeadcount;
        regPulang += r.attendanceIn.attendanceOut.pulangRegular;
        addPulang += r.attendanceIn.attendanceOut.pulangAdditional;

        totalTumbang += r.attendanceIn.attendanceOut.tumbangHeadcount;
        regTumbang += r.attendanceIn.attendanceOut.tumbangRegular;
        addTumbang += r.attendanceIn.attendanceOut.tumbangAdditional;

        totalSelisih += r.attendanceIn.attendanceOut.selisihCount;
        regSelisih += r.attendanceIn.attendanceOut.selisihRegular;
        addSelisih += r.attendanceIn.attendanceOut.selisihAdditional;
      }
    }
  });

  const overallFulfillment = totalTarget > 0 ? Math.round((totalMasuk / totalTarget) * 100) : 0;
  const overallRetention = totalMasuk > 0 ? Math.round((totalPulang / totalMasuk) * 100) : 0;

  // Mengambil data penugasan Under Lapangan untuk periode laporan
  const underAssignments = await prisma.underAssignment.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      shift: true,
    },
    orderBy: [
      { date: 'desc' },
      { division: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  return {
    records,
    underAssignments,
    totals: {
      totalTarget,
      regTarget,
      addTarget,
      totalMasuk,
      regMasuk,
      addMasuk,
      totalPulang,
      regPulang,
      addPulang,
      totalTumbang,
      regTumbang,
      addTumbang,
      totalSelisih,
      regSelisih,
      addSelisih,
      overallFulfillment,
      overallRetention,
    },
  };
}

// ----------------------------------------------------------------------------
// 7. MODUL DISTRIBUSI POS & UNDER LAPANGAN J&T (DISTRIBUSI PER DIVISI)
// Karyawan / Leader Lapangan J&T ("Under") yang memegang anak-anak Reg & Add
// di masing-masing divisi (Bongkar, Muat, Sortir 3 Jalur, FIFO, Repack)
// tanpa memedulikan asal vendor.
// ----------------------------------------------------------------------------

/**
 * Menyimpan atau memperbarui data penugasan regu Under Lapangan.
 * Menerima file foto regu lapangan yang diunggah dan menyimpannya di folder uploads.
 */
export async function saveUnderAssignment(formData: FormData) {
  try {
    const id = formData.get('id') as string | null;
    const date = formData.get('date') as string;
    const shiftId = formData.get('shiftId') as string;
    const division = formData.get('division') as string;
    const underName = (formData.get('underName') as string)?.trim();
    const regularCount = parseInt(formData.get('regularCount') as string, 10) || 0;
    const additionalCount = parseInt(formData.get('additionalCount') as string, 10) || 0;
    const totalHeadcount = regularCount + additionalCount;
    const notes = (formData.get('notes') as string)?.trim() || null;
    const photoFile = formData.get('photo') as File | null;
    const existingPhotoUrl = formData.get('existingPhotoUrl') as string | null;

    const vendorBreakdownJson = (formData.get('vendorBreakdownJson') as string) || null;

    if (!date || !shiftId || !division || !underName) {
      return { success: false, error: 'Data belum lengkap. Harap isi tanggal, shift, divisi, dan nama Under.' };
    }

    if (totalHeadcount <= 0) {
      return { success: false, error: 'Jumlah anak yang dipegang Under minimal 1 orang (Regular atau Additional).' };
    }

    let photoUrl = existingPhotoUrl || null;
    if (photoFile && photoFile.size > 0) {
      const uploaded = await saveUploadedFile(photoFile);
      if (uploaded) {
        photoUrl = uploaded;
      }
    }

    if (!photoUrl) {
      return { success: false, error: 'Foto bukti apel regu bersama Under WAJIB dilampirkan dengan stempel jam.' };
    }

    if (id) {
      const updated = await prisma.underAssignment.update({
        where: { id },
        data: {
          shiftId,
          division,
          underName,
          regularCount,
          additionalCount,
          totalHeadcount,
          photoUrl,
          notes,
          vendorBreakdownJson,
        },
      });
      revalidatePath('/');
      return { success: true, data: updated };
    } else {
      const created = await prisma.underAssignment.create({
        data: {
          date,
          shiftId,
          division,
          underName,
          regularCount,
          additionalCount,
          totalHeadcount,
          photoUrl,
          notes,
          vendorBreakdownJson,
        },
      });
      revalidatePath('/');
      return { success: true, data: created };
    }
  } catch (error: any) {
    console.error('Gagal menyimpan penugasan Under:', error);
    return { success: false, error: error.message || 'Gagal menyimpan penugasan Under.' };
  }
}

/**
 * Menghapus penugasan regu Under Lapangan berdasarkan ID.
 */
export async function deleteUnderAssignment(id: string) {
  try {
    if (!id) return { success: false, error: 'ID penugasan Under tidak valid.' };
    await prisma.underAssignment.delete({ where: { id } });
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Gagal menghapus penugasan Under:', error);
    return { success: false, error: error.message || 'Gagal menghapus penugasan Under.' };
  }
}

/**
 * Mengambil daftar penugasan Under Lapangan berdasarkan tanggal dan filter shift opsional.
 */
export async function getUnderAssignments(date: string, shiftId?: string) {
  try {
    const list = await prisma.underAssignment.findMany({
      where: {
        date,
        ...(shiftId && shiftId !== 'ALL' ? { shiftId } : {}),
      },
      include: {
        shift: true,
      },
      orderBy: [
        { division: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    return list;
  } catch (error: any) {
    console.error('Gagal mengambil data penugasan Under:', error);
    return [];
  }
}

// ----------------------------------------------------------------------------
// 8. FITUR BARU: INPUT PEKERJA SUSULAN / TELAT (VENDOR LATE ARRIVAL)
// Memungkinkan vendor mencatat kedatangan pekerja yang telat (1-2 orang) di tengah shift
// lengkap dengan jam tiba, bukti foto di pos/gerbang, dan otomatis menambah total hadir.
// ----------------------------------------------------------------------------
export async function submitLateArrival(formData: FormData) {
  try {
    const plotinganId = formData.get('plotinganId') as string;
    const time = (formData.get('time') as string)?.trim() || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const regular = parseInt(formData.get('regular') as string, 10) || 0;
    const additional = parseInt(formData.get('additional') as string, 10) || 0;
    const totalLate = regular + additional;
    const notes = (formData.get('notes') as string)?.trim() || null;
    const photoFile = formData.get('photo') as File | null;

    if (!plotinganId || totalLate <= 0) {
      return { success: false, error: 'Jumlah pekerja susulan minimal 1 orang (Regular atau Additional).' };
    }

    let photoUrl: string | null = null;
    if (photoFile && photoFile.size > 0) {
      photoUrl = await saveUploadedFile(photoFile);
    }

    const attendance = await prisma.attendanceIn.findUnique({
      where: { plotinganId },
    });

    if (!attendance) {
      return { success: false, error: 'Belum ada absensi apel awal untuk vendor ini. Silakan input absen masuk terlebih dahulu.' };
    }

    let existingLate: any[] = [];
    if (attendance.lateArrivalsJson) {
      try {
        existingLate = JSON.parse(attendance.lateArrivalsJson);
      } catch (e) {}
    }

    const lateEntry = {
      id: `late-${Date.now()}`,
      time,
      regular,
      additional,
      total: totalLate,
      photoUrl,
      notes,
    };

    existingLate.push(lateEntry);

    const updated = await prisma.attendanceIn.update({
      where: { plotinganId },
      data: {
        actualRegular: attendance.actualRegular + regular,
        actualAdditional: attendance.actualAdditional + additional,
        actualHeadcount: attendance.actualHeadcount + totalLate,
        lateArrivalsJson: JSON.stringify(existingLate),
      },
    });

    revalidatePath('/');
    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Gagal mencatat pekerja susulan:', error);
    return { success: false, error: error.message || 'Gagal mencatat pekerja susulan.' };
  }
}

// ----------------------------------------------------------------------------
// 9. FASE 3: MODUL LIVE TUMBANG & KENDALA (REAL-TIME LAPORAN UNDER)
// Mencatat insiden pekerja sakit/tumbang/izin saat shift sedang berlangsung,
// lengkap dengan diagnosa, wajib foto surat klinik P3K, dan format share WhatsApp.
// ----------------------------------------------------------------------------
export async function getTumbangIncidents(date: string, shiftId?: string) {
  try {
    const list = await prisma.tumbangIncident.findMany({
      where: {
        date,
        ...(shiftId && shiftId !== 'ALL' ? { shiftId } : {}),
      },
      include: {
        shift: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return list;
  } catch (error: any) {
    console.error('Gagal mengambil data tumbang:', error);
    return [];
  }
}

export async function createTumbangIncident(formData: FormData) {
  try {
    const date = formData.get('date') as string;
    const shiftId = formData.get('shiftId') as string;
    const division = formData.get('division') as string;
    const underName = (formData.get('underName') as string)?.trim();
    const vendorId = (formData.get('vendorId') as string) || null;
    const vendorName = (formData.get('vendorName') as string)?.trim() || null;
    const category = (formData.get('category') as string) || 'REGULAR';
    const time = (formData.get('time') as string)?.trim() || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const type = (formData.get('type') as string) || 'Sakit / Klinik';
    const notes = (formData.get('notes') as string)?.trim() || null;
    const photoFile = formData.get('photo') as File | null;

    if (!date || !shiftId || !division || !underName) {
      return { success: false, error: 'Harap lengkapi tanggal, shift, divisi, dan nama Under pelapor.' };
    }

    let photoUrl: string | null = null;
    if (photoFile && photoFile.size > 0) {
      photoUrl = await saveUploadedFile(photoFile);
    }

    if (!photoUrl) {
      return { success: false, error: 'Foto bukti penanganan medis / surat klinik P3K WAJIB dilampirkan.' };
    }

    const created = await prisma.tumbangIncident.create({
      data: {
        date,
        shiftId,
        division,
        underName,
        vendorId,
        vendorName,
        category,
        time,
        type,
        notes,
        photoUrl,
      },
    });

    revalidatePath('/');
    return { success: true, data: created };
  } catch (error: any) {
    console.error('Gagal mencatat insiden tumbang:', error);
    return { success: false, error: error.message || 'Gagal mencatat insiden tumbang.' };
  }
}

export async function deleteTumbangIncident(id: string) {
  try {
    if (!id) return { success: false, error: 'ID insiden tidak valid.' };
    await prisma.tumbangIncident.delete({ where: { id } });
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Gagal menghapus insiden tumbang:', error);
    return { success: false, error: error.message || 'Gagal menghapus insiden tumbang.' };
  }
}

// ----------------------------------------------------------------------------
// 10. FASE 4 SUB-TAB 2: CHECKOUT KEPULANGAN UNDER LAPANGAN
// Under Lapangan mengonfirmasi pelepasan anak buah di posnya saat selesai shift,
// lengkap dengan rincian Reg & Add dan foto checkout barisan pos.
// ----------------------------------------------------------------------------
export async function submitUnderCheckout(formData: FormData) {
  try {
    const id = formData.get('id') as string;
    const checkoutRegular = parseInt(formData.get('checkoutRegular') as string, 10) || 0;
    const checkoutAdditional = parseInt(formData.get('checkoutAdditional') as string, 10) || 0;
    const checkoutTotal = checkoutRegular + checkoutAdditional;
    const checkoutNotes = (formData.get('notes') as string)?.trim() || null;
    const photoFile = formData.get('photo') as File | null;
    const existingPhotoUrl = formData.get('existingPhotoUrl') as string | null;

    if (!id) return { success: false, error: 'ID penugasan under tidak valid.' };

    let checkoutPhotoUrl = existingPhotoUrl || null;
    if (photoFile && photoFile.size > 0) {
      const uploaded = await saveUploadedFile(photoFile);
      if (uploaded) checkoutPhotoUrl = uploaded;
    }

    if (!checkoutPhotoUrl) {
      return { success: false, error: 'Foto bukti checkout barisan pos under WAJIB dilampirkan.' };
    }

    const updated = await prisma.underAssignment.update({
      where: { id },
      data: {
        checkoutRegular,
        checkoutAdditional,
        checkoutTotal,
        checkoutPhotoUrl,
        checkoutTime: new Date(),
        checkoutNotes,
      },
    });

    revalidatePath('/');
    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Gagal menyimpan checkout under:', error);
    return { success: false, error: error.message || 'Gagal menyimpan checkout under.' };
  }
}