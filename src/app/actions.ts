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

// ----------------------------------------------------------------------------
// HELPER: Menyimpan File Gambar yang Diunggah ke Folder public/uploads
// ----------------------------------------------------------------------------
/**
 * Fungsi pembantu untuk memproses file upload (foto apel masuk reg/add, checkout, klinik).
 * File disimpan di folder `public/uploads/` dengan nama unik agar tidak bentrok.
 * Mengembalikan path URL lokal (misal: /uploads/1712345678-abc.jpg).
 */
async function saveUploadedFile(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Pastikan folder public/uploads sudah ada
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Generate nama file unik menggunakan timestamp dan random string
  const ext = path.extname(file.name) || '.jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
  const filePath = path.join(uploadDir, fileName);

  fs.writeFileSync(filePath, buffer);
  return `/uploads/${fileName}`;
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
  const [vendors, shifts] = await Promise.all([
    prisma.vendor.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
    prisma.shift.findMany({ orderBy: { name: 'asc' } }),
  ]);
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
  
  const targetRegular = parseInt(formData.get('targetRegular') as string, 10) || 0;
  const targetAdditional = parseInt(formData.get('targetAdditional') as string, 10) || 0;
  const targetHeadcount = targetRegular + targetAdditional;

  const workingHours = (formData.get('workingHours') as string)?.trim() || null;
  const notes = (formData.get('notes') as string) || null;

  if (!date || !vendorId || !shiftId || targetHeadcount <= 0) {
    return { success: false, error: 'Target kuota minimal 1 orang (baik Regular maupun Additional).' };
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
  const targetRegular = parseInt(formData.get('targetRegular') as string, 10) || 0;
  const targetAdditional = parseInt(formData.get('targetAdditional') as string, 10) || 0;
  const targetHeadcount = targetRegular + targetAdditional;
  const workingHours = (formData.get('workingHours') as string)?.trim() || null;
  const notes = (formData.get('notes') as string) || null;

  if (targetHeadcount <= 0) {
    return { success: false, error: 'Total target headcount harus lebih dari 0.' };
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

// ----------------------------------------------------------------------------
// 4. MODUL ABSEN MASUK: Multi-Foto per Bagian Gudang + Validasi Ketat Wajib Foto
// ----------------------------------------------------------------------------
/**
 * Menyimpan absensi serah terima apel masuk:
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

  // VALIDASI KETAT WAJIB FOTO (STRICT VALIDATION):
  if (actualRegular > 0 && regularPhotos.length === 0) {
    return { success: false, error: 'Wajib melampirkan minimal 1 foto barisan fisik untuk pasukan REGULAR!' };
  }

  if (actualAdditional > 0 && additionalPhotos.length === 0) {
    return { success: false, error: 'Wajib melampirkan minimal 1 foto barisan fisik untuk pasukan ADDITIONAL!' };
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

  // 3. Foto Bukti Tumbang / Surat Sakit
  const photoTumbangFile = formData.get('photoTumbang') as File | null;
  const photoTumbangExisting = formData.get('photoTumbang_existing') as string | null;
  let photoTumbangUrl = photoTumbangExisting;
  if (photoTumbangFile && photoTumbangFile.size > 0) {
    photoTumbangUrl = await saveUploadedFile(photoTumbangFile);
  }

  // VALIDASI KETAT WAJIB FOTO CHECKOUT:
  if (pulangRegular > 0 && pulangRegularPhotos.length === 0) {
    return { success: false, error: 'Wajib melampirkan minimal 1 foto barisan checkout kepulangan REGULAR!' };
  }

  if (pulangAdditional > 0 && pulangAdditionalPhotos.length === 0) {
    return { success: false, error: 'Wajib melampirkan minimal 1 foto barisan checkout kepulangan ADDITIONAL!' };
  }

  if (tumbangHeadcount > 0 && !photoTumbangUrl) {
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
      tumbangNotes,
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
      tumbangNotes,
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

  return {
    records,
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