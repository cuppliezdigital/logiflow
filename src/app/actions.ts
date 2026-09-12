'use server';

// ============================================================================
// SERVER ACTIONS - LOGIFLOW MANPOWER CONTROL
// Berisi seluruh fungsi backend operasi database:
// 1. Kelola Vendor (CRUD Vendor Langsung dari UI)
// 2. Master Data (Vendor Aktif & Shift Pagi/Malam)
// 3. Plotingan Target H-1 (Termasuk Jam Kerja Fleksibel)
// 4. Absen Masuk & Serah Terima Pasukan (Upload Foto Apel)
// 5. Absen Pulang, Tumbang & Audit Integritas Otomatis
// 6. Rekapitulasi Laporan KPI Operasional
// ============================================================================

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';

// ----------------------------------------------------------------------------
// HELPER: Menyimpan File Gambar yang Diunggah ke Folder public/uploads
// ----------------------------------------------------------------------------
/**
 * Fungsi pembantu untuk memproses file upload (foto apel, foto bukti tumbang).
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
/**
 * Menambahkan Vendor Baru ke Database.
 * Diinput oleh supervisor/admin melalui modal "Kelola Vendor".
 */
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

/**
 * Memperbarui Data Vendor yang Sudah Ada.
 */
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

/**
 * Menghapus Vendor atau Menonaktifkannya jika sudah punya riwayat transaksi.
 */
export async function deleteVendor(id: string) {
  const plotinganCount = await prisma.plotingan.count({ where: { vendorId: id } });

  if (plotinganCount > 0) {
    // Jika vendor sudah pernah dipakai di plotingan, kita nonaktifkan agar laporan historis tidak rusak
    await prisma.vendor.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  } else {
    // Jika vendor belum pernah ada transaksi sama sekali, hapus permanen
    await prisma.vendor.delete({ where: { id } });
  }

  revalidatePath('/');
  return { success: true };
}

// ----------------------------------------------------------------------------
// 2. MASTER DATA: Mengambil Data Vendor Aktif dan Shift Kerja
// ----------------------------------------------------------------------------
/**
 * Mengambil daftar Vendor yang berstatus 'ACTIVE' dan seluruh Shift (Shift Pagi & Shift Malam).
 * Digunakan sebagai pilihan dropdown saat membuat / mengedit plotingan.
 */
export async function getMasterData() {
  const [vendors, shifts] = await Promise.all([
    prisma.vendor.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
    prisma.shift.findMany({ orderBy: { name: 'asc' } }),
  ]);
  return { vendors, shifts };
}

// ----------------------------------------------------------------------------
// 3. MODUL PLOTINGAN: Mengelola Target Manpower H-1 & Jam Kerja Fleksibel
// ----------------------------------------------------------------------------
/**
 * Mengambil daftar plotingan berdasarkan tanggal tertentu.
 * Sudah meng-include data relasi vendor, shift, attendanceIn, dan attendanceOut.
 */
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

/**
 * Menyimpan data plotingan baru (permintaan target headcount ke vendor).
 * Termasuk kolom workingHours (jam kerja bebas/opsional).
 */
export async function createPlotingan(formData: FormData) {
  const date = formData.get('date') as string;
  const vendorId = formData.get('vendorId') as string;
  const shiftId = formData.get('shiftId') as string;
  const status = (formData.get('status') as string) || 'REGULAR';
  const targetHeadcount = parseInt(formData.get('targetHeadcount') as string, 10) || 0;
  const workingHours = (formData.get('workingHours') as string)?.trim() || null;
  const notes = (formData.get('notes') as string) || null;

  // Validasi input wajib
  if (!date || !vendorId || !shiftId || targetHeadcount <= 0) {
    return { success: false, error: 'Data plotingan tidak lengkap atau target kurang dari 1.' };
  }

  await prisma.plotingan.create({
    data: {
      date,
      vendorId,
      shiftId,
      status,
      targetHeadcount,
      workingHours,
      notes,
    },
  });

  revalidatePath('/');
  return { success: true };
}

/**
 * Memperbarui target kuota, status, jam kerja, atau catatan plotingan yang sudah ada.
 */
export async function updatePlotingan(id: string, formData: FormData) {
  const targetHeadcount = parseInt(formData.get('targetHeadcount') as string, 10) || 0;
  const status = formData.get('status') as string;
  const workingHours = (formData.get('workingHours') as string)?.trim() || null;
  const notes = (formData.get('notes') as string) || null;

  if (targetHeadcount <= 0) {
    return { success: false, error: 'Target headcount harus lebih dari 0.' };
  }

  await prisma.plotingan.update({
    where: { id },
    data: {
      targetHeadcount,
      status,
      workingHours,
      notes,
    },
  });

  revalidatePath('/');
  return { success: true };
}

/**
 * Menghapus data plotingan berdasarkan ID.
 */
export async function deletePlotingan(id: string) {
  await prisma.plotingan.delete({ where: { id } });
  revalidatePath('/');
  return { success: true };
}

// ----------------------------------------------------------------------------
// 4. MODUL ABSEN MASUK: Pencatatan Kehadiran Fisik saat Apel Shift
// ----------------------------------------------------------------------------
/**
 * Menyimpan data serah terima kehadiran fisik di awal jam kerja (Apel).
 * Mendukung upload foto barisan apel sebagai bukti fisik keabsahan headcount.
 */
export async function submitAbsenMasuk(formData: FormData) {
  const plotinganId = formData.get('plotinganId') as string;
  const actualHeadcount = parseInt(formData.get('actualHeadcount') as string, 10) || 0;
  const notes = (formData.get('notes') as string) || null;
  const photoFile = formData.get('photoIn') as File | null;

  if (!plotinganId || actualHeadcount <= 0) {
    return { success: false, error: 'Pilih plotingan dan isi total orang masuk yang valid.' };
  }

  // Simpan foto bukti jika diunggah
  const photoInUrl = await saveUploadedFile(photoFile);

  await prisma.attendanceIn.upsert({
    where: { plotinganId },
    create: {
      plotinganId,
      actualHeadcount,
      photoInUrl,
      notes,
    },
    update: {
      actualHeadcount,
      ...(photoInUrl ? { photoInUrl } : {}),
      notes,
    },
  });

  revalidatePath('/');
  return { success: true };
}

// ----------------------------------------------------------------------------
// 5. MODUL ABSEN PULANG & AUDIT INTEGRITAS: Menghitung Pulang, Tumbang & Selisih
// ----------------------------------------------------------------------------
/**
 * Menyimpan data saat shift berakhir:
 * - Jumlah orang pulang utuh
 * - Jumlah orang tumbang (sakit/klinik P3K)
 * - Foto barisan checkout dan foto bukti surat sakit/penanganan
 * - Rumus Audit Integritas:
 *   Selisih = Actual Masuk - (Pulang Utuh + Tumbang)
 *   Jika Selisih > 0 => Ada indikasi pekerja kabur/hilang tanpa izin di jam kerja.
 */
export async function submitAbsenPulang(formData: FormData) {
  const attendanceInId = formData.get('attendanceInId') as string;
  const pulangHeadcount = parseInt(formData.get('pulangHeadcount') as string, 10) || 0;
  const tumbangHeadcount = parseInt(formData.get('tumbangHeadcount') as string, 10) || 0;
  const tumbangNotes = (formData.get('tumbangNotes') as string) || null;

  const photoPulangFile = formData.get('photoPulang') as File | null;
  const photoTumbangFile = formData.get('photoTumbang') as File | null;

  if (!attendanceInId) {
    return { success: false, error: 'Data absen masuk tidak ditemukan.' };
  }

  const attendanceIn = await prisma.attendanceIn.findUnique({
    where: { id: attendanceInId },
  });

  if (!attendanceIn) {
    return { success: false, error: 'Data absensi masuk tidak valid.' };
  }

  // LOGIKA AUDIT INTEGRITAS HEADCOUNT:
  const actualIn = attendanceIn.actualHeadcount;
  const isBalanced = actualIn === (pulangHeadcount + tumbangHeadcount);
  const selisihCount = actualIn - (pulangHeadcount + tumbangHeadcount);

  const [photoPulangUrl, photoTumbangUrl] = await Promise.all([
    saveUploadedFile(photoPulangFile),
    saveUploadedFile(photoTumbangFile),
  ]);

  await prisma.attendanceOut.upsert({
    where: { attendanceInId },
    create: {
      attendanceInId,
      pulangHeadcount,
      tumbangHeadcount,
      photoPulangUrl,
      photoTumbangUrl,
      tumbangNotes,
      isBalanced,
      selisihCount,
    },
    update: {
      pulangHeadcount,
      tumbangHeadcount,
      ...(photoPulangUrl ? { photoPulangUrl } : {}),
      ...(photoTumbangUrl ? { photoTumbangUrl } : {}),
      tumbangNotes,
      isBalanced,
      selisihCount,
    },
  });

  revalidatePath('/');
  return { success: true, isBalanced, selisihCount };
}

// ----------------------------------------------------------------------------
// 6. MODUL LAPORAN & REKAP KPI: Kalkulasi Statistik Kinerja & Billing Vendor
// ----------------------------------------------------------------------------
/**
 * Menghitung rekapitulasi data kehadiran berdasarkan rentang tanggal dan vendor:
 * - Total Target vs Total Masuk (% Fulfillment Target Vendor)
 * - Total Pulang vs Total Masuk (% Retention / Ketahanan Pekerja sampai Selesai)
 * - Total Pekerja Tumbang (Sakit)
 * - Total Pekerja Selisih (Kabur / Kebocoran Biaya)
 */
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
    orderBy: [{ date: 'desc' }, { shift: { name: 'asc' } }],
  });

  let totalTarget = 0;
  let totalMasuk = 0;
  let totalPulang = 0;
  let totalTumbang = 0;
  let totalSelisih = 0;
  let regTarget = 0;
  let addTarget = 0;

  records.forEach((r) => {
    totalTarget += r.targetHeadcount;
    if (r.status === 'REGULAR') regTarget += r.targetHeadcount;
    else addTarget += r.targetHeadcount;

    if (r.attendanceIn) {
      totalMasuk += r.attendanceIn.actualHeadcount;
      if (r.attendanceIn.attendanceOut) {
        totalPulang += r.attendanceIn.attendanceOut.pulangHeadcount;
        totalTumbang += r.attendanceIn.attendanceOut.tumbangHeadcount;
        totalSelisih += r.attendanceIn.attendanceOut.selisihCount;
      }
    }
  });

  const overallFulfillment = totalTarget > 0 ? Math.round((totalMasuk / totalTarget) * 100) : 0;
  const overallRetention = totalMasuk > 0 ? Math.round((totalPulang / totalMasuk) * 100) : 0;

  return {
    records,
    totals: {
      totalTarget,
      totalMasuk,
      totalPulang,
      totalTumbang,
      totalSelisih,
      regTarget,
      addTarget,
      overallFulfillment,
      overallRetention,
    },
  };
}