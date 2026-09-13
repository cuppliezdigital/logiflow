// ============================================================================
// API ROUTE: EXPORT LAPORAN REKAP MANPOWER KE FILE EXCEL (.XLSX)
// Format Eksekutif Matriks Standar Operasional Gudang + Rumus Formula Excel
// Mendukung:
// 1. Sheet 1: "Rekap Matriks Report" (Format Matriks seperti di lapangan dengan rumus Excel)
// 2. Sheet 2: "Data Mentah Detail" (Tabel Baris Transaksional Lengkap dengan rumus)
// 3. Sheet 3: "Log Orang Tumbang" (Rincian seluruh kejadian sakit/izin + jam keluar 24 jam)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { convertTo24Hour } from '@/components/AbsenPulangTab';
import { getShortVendorName } from '@/lib/vendorMapping';

// Helper mengisi sel Excel dengan nilai, tipe, dan rumus formula bawaan
function setCell(
  ws: Record<string, any>,
  r: number,
  c: number,
  val: any,
  formula?: string,
  type: 's' | 'n' = 's'
) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (formula) {
    ws[addr] = { t: 'n', f: formula, v: typeof val === 'number' ? val : 0 };
  } else if (type === 'n' || typeof val === 'number') {
    ws[addr] = { t: 'n', v: typeof val === 'number' ? val : Number(val) || 0 };
  } else {
    ws[addr] = { t: 's', v: String(val ?? '') };
  }
}

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

    // Ambil data plotingan beserta relasi vendor, shift, attendanceIn, dan attendanceOut
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

    const workbook = XLSX.utils.book_new();

    // ========================================================================
    // SHEET 1: REKAP MATRIKS REPORT (Format Visual Standar Lapangan Gudang)
    // ========================================================================
    const wsMatrix: Record<string, any> = {};
    const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];

    // Kumpulkan daftar vendor unik yang terlibat (dengan nama singkatan resmi)
    const uniqueVendors: string[] = Array.from(
      new Set(records.map((r) => getShortVendorName(r.vendor.name)))
    ).sort();

    // Kumpulkan daftar shift unik
    const uniqueShifts: string[] = Array.from(
      new Set(records.map((r) => r.shift.name))
    );

    let curRow = 0;

    // Judul Header Utama
    setCell(wsMatrix, curRow, 0, 'LAPORAN REKAPITULASI MANPOWER OPERASIONAL GUDANG');
    merges.push({ s: { r: curRow, c: 0 }, e: { r: curRow, c: uniqueVendors.length + 2 } });
    curRow++;

    setCell(
      wsMatrix,
      curRow,
      0,
      `Periode: ${startDate} s.d. ${endDate} | Total Plotingan: ${records.length} | Format Standar Eksekutif + Rumus Excel`
    );
    merges.push({ s: { r: curRow, c: 0 }, e: { r: curRow, c: uniqueVendors.length + 2 } });
    curRow += 2; // Beri spasi kosong

    // Loop setiap shift untuk membuat matriks terpisah yang rapi
    const shiftsToProcess = uniqueShifts.length > 0 ? uniqueShifts : ['Semua Shift'];

    shiftsToProcess.forEach((shiftName, sIdx) => {
      const shiftRecords = records.filter((r) => r.shift.name === shiftName);

      // Judul Blok Shift
      setCell(wsMatrix, curRow, 0, `=== REKAP SHIFT: ${shiftName.toUpperCase()} ===`);
      merges.push({ s: { r: curRow, c: 0 }, e: { r: curRow, c: uniqueVendors.length + 2 } });
      curRow++;

      // Baris Header Matriks
      const headerRow = curRow;
      setCell(wsMatrix, headerRow, 0, 'PARAMETER UTAMA');
      setCell(wsMatrix, headerRow, 1, 'KATEGORI');
      setCell(wsMatrix, headerRow, 2, 'TOTAL GUDANG');

      uniqueVendors.forEach((vName, vIdx) => {
        setCell(wsMatrix, headerRow, 3 + vIdx, vName);
      });
      curRow++;

      // Row indices (1-indexed untuk formula Excel)
      const rMasukTotal = curRow + 1; // 1-indexed
      const rMasukReg = curRow + 2;
      const rMasukAdd = curRow + 3;
      const rPulangTotal = curRow + 4;
      const rPulangReg = curRow + 5;
      const rPulangAdd = curRow + 6;
      const rTumbangReg = curRow + 7;
      const rTumbangAdd = curRow + 8;
      const rTumbangTotal = curRow + 9;
      const rRetensi = curRow + 10;
      const rBalance = curRow + 11;

      const startColLet = 'D';
      const endColLet = XLSX.utils.encode_col(Math.max(3, uniqueVendors.length + 2));

      // Baris 1: TOTAL MP MASUK - TOTAL (REG + ADD)
      setCell(wsMatrix, curRow, 0, 'TOTAL MP MASUK');
      setCell(wsMatrix, curRow, 1, 'TOTAL (REG + ADD)');
      setCell(wsMatrix, curRow, 2, 0, `SUM(${startColLet}${rMasukTotal}:${endColLet}${rMasukTotal})`, 'n');
      uniqueVendors.forEach((vName, vIdx) => {
        const colLet = XLSX.utils.encode_col(3 + vIdx);
        // Formula Masuk Total = Masuk Reg + Masuk Add
        const rec = shiftRecords.find((r) => getShortVendorName(r.vendor.name) === vName);
        const val = rec?.attendanceIn?.actualHeadcount || 0;
        setCell(wsMatrix, curRow, 3 + vIdx, val, `${colLet}${rMasukReg}+${colLet}${rMasukAdd}`, 'n');
      });
      curRow++;

      // Baris 2: TOTAL MP MASUK - Reguler
      setCell(wsMatrix, curRow, 0, 'TOTAL MP MASUK');
      setCell(wsMatrix, curRow, 1, 'Reguler');
      setCell(wsMatrix, curRow, 2, 0, `SUM(${startColLet}${rMasukReg}:${endColLet}${rMasukReg})`, 'n');
      uniqueVendors.forEach((vName, vIdx) => {
        const rec = shiftRecords.find((r) => getShortVendorName(r.vendor.name) === vName);
        const val = rec?.attendanceIn?.actualRegular ?? rec?.attendanceIn?.actualHeadcount ?? 0;
        setCell(wsMatrix, curRow, 3 + vIdx, val, undefined, 'n');
      });
      curRow++;

      // Baris 3: TOTAL MP MASUK - Additional
      setCell(wsMatrix, curRow, 0, 'TOTAL MP MASUK');
      setCell(wsMatrix, curRow, 1, 'Additional');
      setCell(wsMatrix, curRow, 2, 0, `SUM(${startColLet}${rMasukAdd}:${endColLet}${rMasukAdd})`, 'n');
      uniqueVendors.forEach((vName, vIdx) => {
        const rec = shiftRecords.find((r) => getShortVendorName(r.vendor.name) === vName);
        const val = rec?.attendanceIn?.actualAdditional ?? 0;
        setCell(wsMatrix, curRow, 3 + vIdx, val, undefined, 'n');
      });
      curRow++;

      // Baris 4: TOTAL MP PULANG - TOTAL (REG + ADD)
      setCell(wsMatrix, curRow, 0, 'TOTAL MP PULANG');
      setCell(wsMatrix, curRow, 1, 'TOTAL (REG + ADD)');
      setCell(wsMatrix, curRow, 2, 0, `SUM(${startColLet}${rPulangTotal}:${endColLet}${rPulangTotal})`, 'n');
      uniqueVendors.forEach((vName, vIdx) => {
        const colLet = XLSX.utils.encode_col(3 + vIdx);
        const rec = shiftRecords.find((r) => getShortVendorName(r.vendor.name) === vName);
        const val = rec?.attendanceIn?.attendanceOut?.pulangHeadcount || 0;
        setCell(wsMatrix, curRow, 3 + vIdx, val, `${colLet}${rPulangReg}+${colLet}${rPulangAdd}`, 'n');
      });
      curRow++;

      // Baris 5: TOTAL MP PULANG - Reguler
      setCell(wsMatrix, curRow, 0, 'TOTAL MP PULANG');
      setCell(wsMatrix, curRow, 1, 'Reguler');
      setCell(wsMatrix, curRow, 2, 0, `SUM(${startColLet}${rPulangReg}:${endColLet}${rPulangReg})`, 'n');
      uniqueVendors.forEach((vName, vIdx) => {
        const rec = shiftRecords.find((r) => getShortVendorName(r.vendor.name) === vName);
        const out = rec?.attendanceIn?.attendanceOut;
        const val = out ? (out.pulangRegular ?? out.pulangHeadcount) : 0;
        setCell(wsMatrix, curRow, 3 + vIdx, val, undefined, 'n');
      });
      curRow++;

      // Baris 6: TOTAL MP PULANG - Additional
      setCell(wsMatrix, curRow, 0, 'TOTAL MP PULANG');
      setCell(wsMatrix, curRow, 1, 'Additional');
      setCell(wsMatrix, curRow, 2, 0, `SUM(${startColLet}${rPulangAdd}:${endColLet}${rPulangAdd})`, 'n');
      uniqueVendors.forEach((vName, vIdx) => {
        const rec = shiftRecords.find((r) => getShortVendorName(r.vendor.name) === vName);
        const val = rec?.attendanceIn?.attendanceOut?.pulangAdditional ?? 0;
        setCell(wsMatrix, curRow, 3 + vIdx, val, undefined, 'n');
      });
      curRow++;

      // Baris 7: Tumbang Reguler
      setCell(wsMatrix, curRow, 0, 'Tumbang Reguler');
      setCell(wsMatrix, curRow, 1, 'Reguler');
      setCell(wsMatrix, curRow, 2, 0, `SUM(${startColLet}${rTumbangReg}:${endColLet}${rTumbangReg})`, 'n');
      uniqueVendors.forEach((vName, vIdx) => {
        const rec = shiftRecords.find((r) => getShortVendorName(r.vendor.name) === vName);
        const val = rec?.attendanceIn?.attendanceOut?.tumbangRegular ?? 0;
        setCell(wsMatrix, curRow, 3 + vIdx, val, undefined, 'n');
      });
      curRow++;

      // Baris 8: Tumbang Add
      setCell(wsMatrix, curRow, 0, 'Tumbang Add');
      setCell(wsMatrix, curRow, 1, 'Additional');
      setCell(wsMatrix, curRow, 2, 0, `SUM(${startColLet}${rTumbangAdd}:${endColLet}${rTumbangAdd})`, 'n');
      uniqueVendors.forEach((vName, vIdx) => {
        const rec = shiftRecords.find((r) => getShortVendorName(r.vendor.name) === vName);
        const val = rec?.attendanceIn?.attendanceOut?.tumbangAdditional ?? 0;
        setCell(wsMatrix, curRow, 3 + vIdx, val, undefined, 'n');
      });
      curRow++;

      // Baris 9: TOTAL TUMBANG
      setCell(wsMatrix, curRow, 0, 'TOTAL TUMBANG');
      setCell(wsMatrix, curRow, 1, 'TOTAL');
      setCell(wsMatrix, curRow, 2, 0, `C${rTumbangReg}+C${rTumbangAdd}`, 'n');
      uniqueVendors.forEach((vName, vIdx) => {
        const colLet = XLSX.utils.encode_col(3 + vIdx);
        const rec = shiftRecords.find((r) => getShortVendorName(r.vendor.name) === vName);
        const val = rec?.attendanceIn?.attendanceOut?.tumbangHeadcount || 0;
        setCell(wsMatrix, curRow, 3 + vIdx, val, `${colLet}${rTumbangReg}+${colLet}${rTumbangAdd}`, 'n');
      });
      curRow++;

      // Baris 10: TINGKAT RETENSI (%)
      setCell(wsMatrix, curRow, 0, 'TINGKAT RETENSI (%)');
      setCell(wsMatrix, curRow, 1, 'Retensi');
      setCell(wsMatrix, curRow, 2, 0, `IF(C${rMasukTotal}>0,ROUND(C${rPulangTotal}/C${rMasukTotal}*100,1),100)`, 'n');
      uniqueVendors.forEach((vName, vIdx) => {
        const colLet = XLSX.utils.encode_col(3 + vIdx);
        const rec = shiftRecords.find((r) => getShortVendorName(r.vendor.name) === vName);
        const inTot = rec?.attendanceIn?.actualHeadcount || 0;
        const outTot = rec?.attendanceIn?.attendanceOut?.pulangHeadcount || 0;
        const ret = inTot > 0 ? Math.round((outTot / inTot) * 100) : 100;
        setCell(wsMatrix, curRow, 3 + vIdx, ret, `IF(${colLet}${rMasukTotal}>0,ROUND(${colLet}${rPulangTotal}/${colLet}${rMasukTotal}*100,1),100)`, 'n');
      });
      curRow++;

      // Baris 11: VALIDASI BALANCE (AUDIT SELISIH: MASUK - (PULANG + TUMBANG))
      setCell(wsMatrix, curRow, 0, 'VALIDASI SELISIH AUDIT');
      setCell(wsMatrix, curRow, 1, 'Balance (0=OK)');
      setCell(wsMatrix, curRow, 2, 0, `C${rMasukTotal}-(C${rPulangTotal}+C${rTumbangTotal})`, 'n');
      uniqueVendors.forEach((vName, vIdx) => {
        const colLet = XLSX.utils.encode_col(3 + vIdx);
        setCell(wsMatrix, curRow, 3 + vIdx, 0, `${colLet}${rMasukTotal}-(${colLet}${rPulangTotal}+${colLet}${rTumbangTotal})`, 'n');
      });
      curRow += 2; // Spasi antar shift
    });

    // ========================================================================
    // SEKSI DI BAWAH MATRIKS: LOG RINCIAN KEJADIAN ORANG TUMBANG
    // ========================================================================
    const incidentStartRow = curRow;
    setCell(wsMatrix, curRow, 0, '=== LOG RINCIAN ORANG TUMBANG / IZIN (MULTI-KEJADIAN) ===');
    merges.push({ s: { r: curRow, c: 0 }, e: { r: curRow, c: 7 } });
    curRow++;

    // Header tabel insiden
    const incHeaders = ['No', 'Tanggal', 'Shift', 'Vendor', 'Kategori', 'Jam Keluar', 'Jenis Kendala', 'Catatan / Diagnosa'];
    incHeaders.forEach((h, hIdx) => {
      setCell(wsMatrix, curRow, hIdx, h);
    });
    curRow++;

    let incCounter = 1;
    records.forEach((r) => {
      const out = r.attendanceIn?.attendanceOut;
      if (out && out.tumbangHeadcount > 0) {
        let incidentList: any[] = [];
        if (out.tumbangNotes) {
          try {
            const parsed = JSON.parse(out.tumbangNotes);
            if (Array.isArray(parsed) && parsed.length > 0) incidentList = parsed;
          } catch (e) {}
        }

        if (incidentList.length > 0) {
          incidentList.forEach((inc) => {
            setCell(wsMatrix, curRow, 0, incCounter++);
            setCell(wsMatrix, curRow, 1, r.date);
            setCell(wsMatrix, curRow, 2, r.shift.name);
            setCell(wsMatrix, curRow, 3, getShortVendorName(r.vendor.name));
            setCell(wsMatrix, curRow, 4, inc.category || 'REGULAR');
            setCell(wsMatrix, curRow, 5, inc.time ? convertTo24Hour(inc.time) : '-');
            setCell(wsMatrix, curRow, 6, inc.type || 'Sakit / Klinik');
            setCell(wsMatrix, curRow, 7, inc.notes || '-');
            curRow++;
          });
        } else {
          setCell(wsMatrix, curRow, 0, incCounter++);
          setCell(wsMatrix, curRow, 1, r.date);
          setCell(wsMatrix, curRow, 2, r.shift.name);
          setCell(wsMatrix, curRow, 3, getShortVendorName(r.vendor.name));
          setCell(wsMatrix, curRow, 4, out.tumbangRegular > 0 ? 'REGULAR' : 'ADDITIONAL');
          setCell(wsMatrix, curRow, 5, '-');
          setCell(wsMatrix, curRow, 6, 'Sakit / Kendala');
          setCell(wsMatrix, curRow, 7, out.tumbangNotes || '-');
          curRow++;
        }
      }
    });

    if (incCounter === 1) {
      setCell(wsMatrix, curRow, 0, 'Alhamdulillah, tidak ada catatan pekerja tumbang / sakit pada periode ini.');
      merges.push({ s: { r: curRow, c: 0 }, e: { r: curRow, c: 7 } });
      curRow++;
    }

    // Set range dan lebar kolom Sheet Matriks
    wsMatrix['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: curRow, c: Math.max(7, uniqueVendors.length + 3) },
    });
    wsMatrix['!merges'] = merges;

    const matrixColWidths: Array<{ wch: number }> = [
      { wch: 24 }, // Parameter Utama
      { wch: 22 }, // Kategori
      { wch: 16 }, // TOTAL GUDANG
    ];
    uniqueVendors.forEach(() => matrixColWidths.push({ wch: 14 }));
    wsMatrix['!cols'] = matrixColWidths;

    // Masukkan Sheet 1 ke workbook
    XLSX.utils.book_append_sheet(workbook, wsMatrix, 'Rekap Matriks Report');

    // ========================================================================
    // SHEET 2: DATA MENTAH DETAIL TRANSAKSIONAL (Lengkap dengan Rumus Baris)
    // ========================================================================
    const rowsDetail = records.map((r, index) => {
      const targetTotal = r.targetHeadcount;

      const masukTotal = r.attendanceIn ? r.attendanceIn.actualHeadcount : 0;
      const masukReg = r.attendanceIn ? (r.attendanceIn.actualRegular ?? r.attendanceIn.actualHeadcount) : 0;
      const masukAdd = r.attendanceIn ? (r.attendanceIn.actualAdditional ?? 0) : 0;

      const out = r.attendanceIn?.attendanceOut;
      const pulangTotal = out ? out.pulangHeadcount : 0;
      const pulangReg = out ? (out.pulangRegular ?? out.pulangHeadcount) : 0;
      const pulangAdd = out ? (out.pulangAdditional ?? 0) : 0;
      const tumbangTotal = out ? out.tumbangHeadcount : 0;

      // Parsing keterangan catatan kendala
      let keteranganKendala = '-';
      if (out?.tumbangNotes) {
        try {
          const parsed = JSON.parse(out.tumbangNotes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            keteranganKendala = parsed.map((p: any, i: number) => {
              const time24 = p.time ? convertTo24Hour(p.time) : '-';
              return `#${i + 1} [${p.category || 'REG'}] ${time24} (${p.type || 'Kendala'}): ${p.notes || '-'}`;
            }).join(' | ');
          } else {
            keteranganKendala = out.tumbangNotes;
          }
        } catch {
          keteranganKendala = out.tumbangNotes;
        }
      }

      const fulfillment = targetTotal > 0 ? Math.round((masukTotal / targetTotal) * 100) : 0;

      return {
        'No': index + 1,
        'Tanggal': r.date,
        'Vendor': getShortVendorName(r.vendor.name),
        'Shift': r.workingHours ? `${r.shift.name} (${r.workingHours})` : r.shift.name,
        'Target MP': targetTotal,
        'Masuk Regular': masukReg,
        'Masuk Additional': masukAdd,
        'Total Masuk': masukTotal,
        'Fulfillment (%)': `${fulfillment}%`,
        'Pulang Regular': pulangReg,
        'Pulang Additional': pulangAdd,
        'Tumbang / Kendala': tumbangTotal,
        'Total Pulang': pulangTotal,
        'Keterangan Kendala': keteranganKendala,
        'Status Shift': out ? 'Selesai Shift' : (r.attendanceIn ? 'Dalam Shift' : 'Belum Mulai'),
        'Catatan': r.notes || '-',
      };
    });

    const wsDetail = XLSX.utils.json_to_sheet(rowsDetail);
    const detailColWidths = [
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
    wsDetail['!cols'] = detailColWidths;

    XLSX.utils.book_append_sheet(workbook, wsDetail, 'Data Detail Plotingan');

    // ========================================================================
    // HASILKAN FILE BINARY EXCEL & RESPONSE DOWNLOAD
    // ========================================================================
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Rekap_Manpower_Matriks_${startDate}_sd_${endDate}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating Excel:', error);
    return NextResponse.json({ error: 'Gagal export Excel: ' + error.message }, { status: 500 });
  }
}