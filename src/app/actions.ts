'use server';

// ============================================================================
// SERVER ACTIONS - LOGIFLOW MANPOWER CONTROL
// Berisi seluruh fungsi backend operasi database:
// 1. Kelola Vendor (CRUD Vendor Langsung dari UI)
// 2. Master Data (Vendor Aktif & Shift Pagi/Malam)
// 3. Plotingan Terpadu: 1 Vendor mencakup kuota REGULAR & ADDITIONAL sekaligus
// 4. Absen Masuk: Input kehadiran & 2 slot foto (Reguler & Additional)
// 5. Absen Pulang: Input kepulangan & audit integritas terpisah per kategori
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
/**
 * Menambahkan Vendor Baru ke Database.
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
/**
 * Mengambil daftar plotingan berdasarkan tanggal tertentu.
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
 * Menyimpan data plotingan baru.
 * 1 Vendor pada 1 Shift langsung menginput target kuota REGULAR dan ADDITIONAL.
 */
export async function createPlotingan(formData: FormData) {
  const date = formData.get('date') as string;
  const vendorId = formData.get('vendorId') as string;
  const shiftId = formData.get('shiftId') as string;
  
  // Ambil kuota regular & additional
  const targetRegular = parseInt(formData.get('targetRegular') as string, 10) || 0;
  const targetAdditional = parseInt(formData.get('targetAdditional') as string, 10) || 0;
  // Total target otomatis dijumlahkan
  const targetHeadcount = targetRegular + targetAdditional;

  const workingHours = (formData.get('workingHours') as string)?.trim() || null;
  const notes = (formData.get('notes') as string) || null;

  // Validasi: Harus pilih vendor, shift, dan total kuota minimal 1 orang
  if (!date || !vendorId || !shiftId || targetHeadcount <= 0) {
    return { success: false, error: 'Target kuota minimal 1 orang (baik Regular maupun Additional).' };
  }

  // Cek apakah vendor ini sudah diplot pada shift dan tanggal yang sama
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

/**
 * Memperbarui data target regular & additional pada plotingan yang sudah ada.
 */
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

/**
 * Menghapus data plotingan.
 */
export async function deletePlotingan(id: string) {
  await prisma.plotingan.delete({ where: { id } });
  revalidatePath('/');
  return { success: true };
}

// ----------------------------------------------------------------------------
// 4. MODUL ABSEN MASUK: Pencatatan Kehadiran & Foto Terpisah (Reg & Add)
// ----------------------------------------------------------------------------
/**
 * Menyimpan data serah terima kehadiran fisik saat apel pagi shift:
 * - Hadir Regular vs Hadir Additional
 * - Slot Upload Foto Barisan Apel REGULAR
 * - Slot Upload Foto Barisan Apel ADDITIONAL
 */
export async function submitAbsenMasuk(formData: FormData) {
  const plotinganId = formData.get('plotinganId') as string;
  const actualRegular = parseInt(formData.get('actualRegular') as string, 10) || 0;
  const actualAdditional = parseInt(formData.get('actualAdditional') as string, 10) || 0;
  const actualHeadcount = actualRegular + actualAdditional;
  const notes = (formData.get('notes') as string) || null;

  const photoInRegularFile = formData.get('photoInRegular') as File | null;
  const photoInAdditionalFile = formData.get('photoInAdditional') as File | null;

  if (!plotinganId || actualHeadcount <= 0) {
    return { success: false, error: 'Total orang masuk harus minimal 1 orang.' };
  }

  // Simpan foto bukti masing-masing barisan apel
  const [photoInRegularUrl, photoInAdditionalUrl] = await Promise.all([
    saveUploadedFile(photoInRegularFile),
    saveUploadedFile(photoInAdditionalFile),
  ]);

  await prisma.attendanceIn.upsert({
    where: { plotinganId },
    create: {
      plotinganId,
      actualRegular,
      actualAdditional,
      actualHeadcount,
      photoInRegularUrl,
      photoInAdditionalUrl,
      photoInUrl: photoInRegularUrl || photoInAdditionalUrl, // fallback
      notes,
    },
    update: {
      actualRegular,
      actualAdditional,
      actualHeadcount,
      ...(photoInRegularUrl ? { photoInRegularUrl } : {}),
      ...(photoInAdditionalUrl ? { photoInAdditionalUrl } : {}),
      photoInUrl: photoInRegularUrl || photoInAdditionalUrl || undefined,
      notes,
    },
  });

  revalidatePath('/');
  return { success: true };
}

// ----------------------------------------------------------------------------
// 5. MODUL ABSEN PULANG & AUDIT INTEGRITAS (REGULAR VS ADDITIONAL)
// ----------------------------------------------------------------------------
/**
 * Menyimpan data kepulangan & audit integritas di akhir shift:
 * - Pulang Regular & Pulang Additional
 * - Tumbang Regular & Tumbang Additional
 * - Slot Foto Barisan Pulang REGULAR & Slot Foto Checkout ADDITIONAL
 * - Slot Foto Bukti Surat Sakit / Klinik P3K
 * - Audit Integritas Otomatis:
 *   Selisih Regular = Hadir Reg - (Pulang Reg + Tumbang Reg)
 *   Selisih Additional = Hadir Add - (Pulang Add + Tumbang Add)
 */
export async function submitAbsenPulang(formData: FormData) {
  const attendanceInId = formData.get('attendanceInId') as string;
  
  const pulangRegular = parseInt(formData.get('pulangRegular') as string, 10) || 0;
  const pulangAdditional = parseInt(formData.get('pulangAdditional') as string, 10) || 0;
  const pulangHeadcount = pulangRegular + pulangAdditional;

  const tumbangRegular = parseInt(formData.get('tumbangRegular') as string, 10) || 0;
  const tumbangAdditional = parseInt(formData.get('tumbangAdditional') as string, 10) || 0;
  const tumbangHeadcount = tumbangRegular + tumbangAdditional;

  const tumbangNotes = (formData.get('tumbangNotes') as string) || null;

  const photoPulangRegularFile = formData.get('photoPulangRegular') as File | null;
  const photoPulangAdditionalFile = formData.get('photoPulangAdditional') as File | null;
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

  // AUDIT INTEGRITAS MASING-MASING KATEGORI:
  const selisihRegular = attendanceIn.actualRegular - (pulangRegular + tumbangRegular);
  const selisihAdditional = attendanceIn.actualAdditional - (pulangAdditional + tumbangAdditional);
  const selisihCount = selisihRegular + selisihAdditional;
  const isBalanced = selisihCount === 0;

  // Proses upload foto-foto kepulangan
  const [photoPulangRegularUrl, photoPulangAdditionalUrl, photoTumbangUrl] = await Promise.all([
    saveUploadedFile(photoPulangRegularFile),
    saveUploadedFile(photoPulangAdditionalFile),
    saveUploadedFile(photoTumbangFile),
  ]);

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
      ...(photoPulangRegularUrl ? { photoPulangRegularUrl } : {}),
      ...(photoPulangAdditionalUrl ? { photoPulangAdditionalUrl } : {}),
      photoPulangUrl: photoPulangRegularUrl || photoPulangAdditionalUrl || undefined,
      ...(photoTumbangUrl ? { photoTumbangUrl } : {}),
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
// 6. MODUL LAPORAN & REKAP KPI: Akumulasi Terpadu Regular & Additional
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