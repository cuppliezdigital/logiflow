// ============================================================================
// API ROUTE: EXPORT LAPORAN REKAP MANPOWER KE FILE EXCEL (.XLSX)
// Endpoint: GET /api/export-excel?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&vendorId=...
// Menghasilkan spreadsheet Excel dengan pemisahan kolom REGULAR & ADDITIONAL
// yang presisi untuk keperluan audit invoice vendor logistik.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || startDate;
    const vendorId = searchParams.get('vendorId');

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
      orderBy: [{ date: 'asc' }, { shift: { name: 'asc' } }, { vendor: { name: 'asc' } }],
    });

    const rows = records.map((r, index) => {
      const targetTotal = r.targetHeadcount;

      const masukTotal = r.attendanceIn ? r.attendanceIn.actualHeadcount : 0;
      const masukReg = r.attendanceIn ? (r.attendanceIn.actualRegular ?? r.attendanceIn.actualHeadcount) : 0;
      const masukAdd = r.attendanceIn ? (r.attendanceIn.actualAdditional ?? 0) : 0;

      const out = r.attendanceIn?.attendanceOut;
      const pulangTotal = out ? out.pulangHeadcount : 0;
      const pulangReg = out ? (out.pulangRegular ?? out.pulangHeadcount) : 0;
      const pulangAdd = out ? (out.pulangAdditional ?? 0) : 0;
      // Ambil total pekerja tumbang dari record attendanceOut
      const tumbangTotal = out ? out.tumbangHeadcount : 0;

      // Parsing catatan kendala tumbang (mendukung multi-kejadian JSON atau teks biasa)
      let keteranganKendala = '-';
      if (out?.tumbangNotes) {
        try {
          const parsed = JSON.parse(out.tumbangNotes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            keteranganKendala = parsed.map((p: any, i: number) => 
              `#${i + 1} [${p.category || 'REG'}] ${p.time || '-'} (${p.type || 'Kendala'}): ${p.notes || '-'}`
            ).join(' | ');
          } else {
            keteranganKendala = out.tumbangNotes;
          }
        } catch {
          keteranganKendala = out.tumbangNotes;
        }
      }

      const fulfillment = targetTotal > 0 ? Math.round((masukTotal / targetTotal) * 100) : 0;

      // Object data baris Excel: Total Pulang diletakkan setelah Tumbang, dan Total Akhir dihapus sesuai permintaan
      return {
        'No': index + 1,
        'Tanggal': r.date,
        'Vendor': r.vendor.name,
        'Shift': r.workingHours ? `${r.shift.name} (${r.workingHours})` : r.shift.name,
        
        // Target Kuota H-1
        'Target MP': targetTotal,
        
        // Realisasi Hadir Masuk
        'Masuk Regular': masukReg,
        'Masuk Additional': masukAdd,
        'Total Masuk': masukTotal,
        'Fulfillment (%)': `${fulfillment}%`,
        
        // Kepulangan & Kendala (Urutan: Pulang Reg, Pulang Add, Tumbang, Total Pulang)
        'Pulang Regular': pulangReg,
        'Pulang Additional': pulangAdd,
        'Tumbang / Kendala': tumbangTotal,
        'Total Pulang': pulangTotal,
        
        // Keterangan & Catatan
        'Keterangan Kendala': keteranganKendala,
        'Status Shift': out ? 'Selesai Shift' : (r.attendanceIn ? 'Dalam Shift' : 'Belum Mulai'),
        'Catatan': r.notes || '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Manpower Terpadu');

    // Atur lebar kolom Excel yang telah disesuaikan urutannya
    const colWidths = [
      { wch: 5 },  // No
      { wch: 12 }, // Tanggal
      { wch: 28 }, // Vendor
      { wch: 20 }, // Shift & Jam
      { wch: 12 }, // Target MP
      { wch: 15 }, // Masuk Regular
      { wch: 16 }, // Masuk Additional
      { wch: 14 }, // Total Masuk
      { wch: 15 }, // Fulfillment (%)
      { wch: 15 }, // Pulang Regular
      { wch: 16 }, // Pulang Additional
      { wch: 18 }, // Tumbang / Kendala (sebelum Total Pulang)
      { wch: 14 }, // Total Pulang
      { wch: 38 }, // Keterangan Kendala
      { wch: 16 }, // Status Shift
      { wch: 25 }, // Catatan
    ];
    worksheet['!cols'] = colWidths;

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Rekap_Manpower_Terpadu_${startDate}_sd_${endDate}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating Excel:', error);
    return NextResponse.json({ error: 'Gagal export Excel' }, { status: 500 });
  }
}