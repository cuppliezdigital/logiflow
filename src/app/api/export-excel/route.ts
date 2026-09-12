// ============================================================================
// API ROUTE: EXPORT LAPORAN REKAP MANPOWER KE FILE EXCEL (.XLSX)
// Endpoint: GET /api/export-excel?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&vendorId=...
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    // 1. Ambil parameter filter dari URL query string
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || startDate;
    const vendorId = searchParams.get('vendorId');

    // 2. Susun kriteria pencarian Prisma (Filter Tanggal & Vendor)
    const whereClause: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Jika filter vendor bukan 'ALL' dan memiliki ID tertentu
    if (vendorId && vendorId !== 'ALL') {
      whereClause.vendorId = vendorId;
    }

    // 3. Ambil data plotingan dan relasi absensi dari database
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
      orderBy: [{ date: 'asc' }, { shift: { startTime: 'asc' } }, { vendor: { name: 'asc' } }],
    });

    // 4. Transformasi data database menjadi baris tabel Excel yang rapi
    const rows = records.map((r, index) => {
      const masuk = r.attendanceIn ? r.attendanceIn.actualHeadcount : 0;
      const pulang = r.attendanceIn?.attendanceOut ? r.attendanceIn.attendanceOut.pulangHeadcount : 0;
      const tumbang = r.attendanceIn?.attendanceOut ? r.attendanceIn.attendanceOut.tumbangHeadcount : 0;
      const selisih = r.attendanceIn?.attendanceOut ? r.attendanceIn.attendanceOut.selisihCount : 0;
      const fulfillment = r.targetHeadcount > 0 ? Math.round((masuk / r.targetHeadcount) * 100) : 0;

      return {
        'No': index + 1,
        'Tanggal': r.date,
        'Vendor': r.vendor.name,
        'Shift': r.workingHours ? `${r.shift.name} (${r.workingHours})` : r.shift.name,
        'Status': r.status, // REGULAR vs ADDITIONAL
        'Target Plotingan': r.targetHeadcount,
        'Aktual Masuk': masuk,
        'Fulfillment (%)': `${fulfillment}%`,
        'Aktual Pulang': pulang,
        'Jumlah Tumbang': tumbang,
        'Keterangan Tumbang': r.attendanceIn?.attendanceOut?.tumbangNotes || '-',
        'Selisih / Kabur': selisih,
        'Status Selesai': r.attendanceIn?.attendanceOut ? 'CLOSED' : (r.attendanceIn ? 'IN PROGRESS' : 'WAITING'),
        'Catatan': r.notes || '-',
      };
    });

    // 5. Generate Worksheet dan Workbook menggunakan library XLSX
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Manpower');

    // 6. Atur lebar masing-masing kolom agar rapi saat dibuka di Microsoft Excel
    const colWidths = [
      { wch: 5 },  // No
      { wch: 12 }, // Tanggal
      { wch: 28 }, // Vendor
      { wch: 16 }, // Shift
      { wch: 12 }, // Status
      { wch: 16 }, // Target Plotingan
      { wch: 14 }, // Aktual Masuk
      { wch: 15 }, // Fulfillment (%)
      { wch: 14 }, // Aktual Pulang
      { wch: 15 }, // Jumlah Tumbang
      { wch: 30 }, // Keterangan Tumbang
      { wch: 15 }, // Selisih / Kabur
      { wch: 15 }, // Status Selesai
      { wch: 25 }, // Catatan
    ];
    worksheet['!cols'] = colWidths;

    // 7. Konversi workbook menjadi buffer binary
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 8. Kembalikan file Excel sebagai response download browser
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Rekap_Manpower_${startDate}_sd_${endDate}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating Excel:', error);
    return NextResponse.json({ error: 'Gagal export Excel' }, { status: 500 });
  }
}