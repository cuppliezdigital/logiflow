'use client';

// ============================================================================
// KOMPONEN TAB 4: LAPORAN REKAPITULASI KPI & EXPORT EXCEL VALIDASI INVOICE
// Fitur Baru:
// 1. 1 Baris per Vendor per Shift (menyatukan kuota Regular & Additional).
// 2. Dropdown Filter Vendor dengan warna teks kontras tinggi (jelas terbaca).
// 3. Kolom Tabel Terpadu: Rincian Target, Masuk, Pulang, Tumbang, & Selisih.
// 4. Download Spreadsheet Excel (.xlsx) dengan kolom Regular & Additional terpisah.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  Users, 
  TrendingUp, 
  HeartPulse, 
  AlertTriangle, 
  CheckCircle2, 
  Building2, 
  RefreshCw, 
  Sun, 
  Moon,
  X,
  Camera,
  ZoomIn,
  Eye,
  ArrowUpRight,
  Clock
} from 'lucide-react';
import { getReportStats } from '@/app/actions';

// Definisi props untuk komponen LaporanTab
interface LaporanTabProps {
  vendors: any[];         // Master data vendor untuk filter dropdown
  selectedDate: string;   // Tanggal aktif saat ini sebagai acuan default
}

export default function LaporanTab({
  vendors,
  selectedDate,
}: LaporanTabProps) {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  const defaultStart = selectedDate ? `${selectedDate.substring(0, 7)}-01` : new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(selectedDate || new Date().toISOString().split('T')[0]);
  
  const [selectedVendorId, setSelectedVendorId] = useState('ALL');
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // State untuk pop-up modal detail interaktif (ketika kotak Pulang Utuh / Total Tumbang diklik)
  const [detailModalType, setDetailModalType] = useState<'PULANG' | 'TUMBANG' | null>(null);

  // State lightbox modal pratinjau foto layar penuh
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // --------------------------------------------------------------------------
  // DATA FETCHING & FILTER HANDLERS
  // --------------------------------------------------------------------------
  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await getReportStats(startDate, endDate, selectedVendorId);
      setReportData(data);
    } catch (error: any) {
      alert('Gagal mengambil data laporan: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate, selectedVendorId]);

  // Handler download Excel
  const handleExportExcel = () => {
    setIsExporting(true);
    const params = new URLSearchParams({
      startDate,
      endDate,
      vendorId: selectedVendorId,
    });
    
    window.location.href = `/api/export-excel?${params.toString()}`;
    setTimeout(() => setIsExporting(false), 2000);
  };

  const totals = reportData?.totals || {
    totalTarget: 0,
    regTarget: 0,
    addTarget: 0,
    totalMasuk: 0,
    regMasuk: 0,
    addMasuk: 0,
    totalPulang: 0,
    regPulang: 0,
    addPulang: 0,
    totalTumbang: 0,
    regTumbang: 0,
    addTumbang: 0,
    totalSelisih: 0,
    regSelisih: 0,
    addSelisih: 0,
    overallFulfillment: 0,
    overallRetention: 0,
  };

  const records = reportData?.records || [];

  // Ekstrak seluruh data kejadian orang tumbang di rentang tanggal ini untuk modal drill-down
  const allTumbangIncidents: Array<{
    date: string;
    vendorName: string;
    shiftName: string;
    category: string;
    time: string;
    type: string;
    notes: string;
    url: string | null;
  }> = [];

  records.forEach((r: any) => {
    const out = r.attendanceIn?.attendanceOut;
    if (out && out.tumbangHeadcount > 0) {
      let incidents: any[] = [];
      if (out.tumbangNotes) {
        try {
          const parsed = JSON.parse(out.tumbangNotes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            incidents = parsed;
          }
        } catch (e) {}
      }

      if (incidents.length > 0) {
        incidents.forEach((inc: any) => {
          allTumbangIncidents.push({
            date: r.date,
            vendorName: r.vendor.name,
            shiftName: r.shift.name,
            category: inc.category || 'REGULAR',
            time: inc.time || '-',
            type: inc.type || 'Sakit',
            notes: inc.notes || '-',
            url: inc.url || null,
          });
        });
      } else {
        allTumbangIncidents.push({
          date: r.date,
          vendorName: r.vendor.name,
          shiftName: r.shift.name,
          category: (out.tumbangRegular ?? 0) > 0 ? 'REGULAR' : 'ADDITIONAL',
          time: '-',
          type: 'Sakit / Kendala',
          notes: out.tumbangNotes || 'Tidak ada catatan',
          url: out.photoTumbangUrl || null,
        });
      }
    }
  });

  // Ekstrak data kepulangan selesai shift per vendor untuk modal drill-down
  const allPulangRecords = records.filter((r: any) => !!r.attendanceIn?.attendanceOut);

  return (
    <div className="space-y-6">
      
      {/* 1. BANNER INFORMASI LAPORAN */}
      <div className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border-l-4 border-blue-600 p-4 rounded-r-xl">
        <h2 className="text-base font-bold text-slate-900">FASE 4: Laporan & Validasi Invoice Vendor</h2>
        <p className="text-xs text-slate-600 mt-0.5">
          Rekapitulasi terpadu per vendor dan shift. Validasi audit integritas kuota Regular & Additional sebelum penagihan invoice.
        </p>
      </div>

      {/* 2. BAR FILTER & TOMBOL EXPORT EXCEL */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Form Filter */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Tanggal Mulai */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-500">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Filter Tanggal Akhir */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-500">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Filter Vendor (DENGAN WARNA TEKS GELAP KONTRAS TINGGI) */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="bg-transparent font-extrabold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="text-slate-900 bg-white font-bold">Semua Vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id} className="text-slate-900 bg-white font-bold">{v.name}</option>
                ))}
              </select>
            </div>

            {/* Tombol Refresh */}
            <button
              onClick={fetchStats}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Tombol Export Excel */}
          <button
            onClick={handleExportExcel}
            disabled={isExporting || records.length === 0}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Menyiapkan Excel...' : 'Download Rekap Excel (.xlsx)'}
          </button>

        </div>
      </div>

      {/* 3. KARTU STATISTIK KPI UTAMA (4 Kartu Simetris & Interaktif) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Target Kebutuhan */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Target</span>
            <Users className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totals.totalTarget} <span className="text-xs font-normal text-slate-400">Org</span></p>
          <div className="mt-2 text-[10px] text-slate-500 flex justify-between border-t border-slate-100 pt-1.5 font-bold">
            <span>Reg: <strong className="text-blue-600">{totals.regTarget}</strong></span>
            <span>Add: <strong className="text-amber-600">{totals.addTarget}</strong></span>
          </div>
        </div>

        {/* KPI 2: Realisasi Masuk */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Aktual Masuk</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{totals.totalMasuk} <span className="text-xs font-normal text-slate-400">Org</span></p>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5 font-bold">
            <span>Fulfillment: <strong className="text-emerald-700">{totals.overallFulfillment}%</strong></span>
            <span>(R:{totals.regMasuk} | A:{totals.addMasuk})</span>
          </div>
        </div>

        {/* KPI 3: Pulang Utuh (Interaktif: Klik untuk buka modal pop-up rincian) */}
        <div 
          onClick={() => setDetailModalType('PULANG')}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs cursor-pointer hover:border-blue-400 hover:shadow-md transition-all active:scale-[0.99] group"
          title="Klik untuk melihat rincian detail kepulangan selesai shift"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-blue-600 transition-colors">Pulang Utuh</span>
            <div className="flex items-center gap-1 text-blue-600">
              <span className="text-[10px] font-bold hidden sm:inline">Rincian</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600">{totals.totalPulang} <span className="text-xs font-normal text-slate-400">Org</span></p>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5 font-bold">
            <span>Retensi: <strong className="text-blue-600">{totals.overallRetention}%</strong></span>
            <span className="text-blue-600 font-semibold group-hover:underline">Buka Data &rarr;</span>
          </div>
        </div>

        {/* KPI 4: Total Tumbang (Interaktif: Klik untuk buka modal pop-up rincian kendala & foto) */}
        <div 
          onClick={() => setDetailModalType('TUMBANG')}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs cursor-pointer hover:border-amber-400 hover:shadow-md transition-all active:scale-[0.99] group"
          title="Klik untuk melihat rincian pekerja tumbang/sakit/kendala dan foto surat bukti"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-amber-600 transition-colors">Total Tumbang</span>
            <div className="flex items-center gap-1 text-amber-600">
              <span className="text-[10px] font-bold hidden sm:inline">Rincian</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600">{totals.totalTumbang} <span className="text-xs font-normal text-slate-400">Org</span></p>
          <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-100 pt-1.5 flex justify-between font-bold">
            <span>Reg: {totals.regTumbang} &bull; Add: {totals.addTumbang}</span>
            <span className="text-amber-600 font-bold group-hover:underline">Buka Data &rarr;</span>
          </div>
        </div>
      </div>

      {/* 4. TABEL DETAIL DATA REKAP (1 BARIS PER VENDOR PER SHIFT) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">
            Daftar Detail Operasional ({records.length} Plotingan Vendor)
          </h3>
          <span className="text-xs text-slate-400">Periode: {startDate} s.d. {endDate}</span>
        </div>

        {records.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Tidak ada rekaman data plotingan pada rentang tanggal yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-700 border-b border-slate-200">
                {/* Header Tabel Laporan: Kolom Tumbang dipindah sebelum Total Pulang, dan Total Akhir dihapus */}
                <tr>
                  <th className="py-3 px-3">Tanggal</th>
                  <th className="py-3 px-3">Vendor</th>
                  <th className="py-3 px-3">Shift</th>
                  <th className="py-3 px-3 text-center">Target MP</th>
                  <th className="py-3 px-3 text-center">Masuk Reg</th>
                  <th className="py-3 px-3 text-center">Masuk Add</th>
                  <th className="py-3 px-3 text-center">Total Masuk</th>
                  <th className="py-3 px-3 text-center">Fulfill (%)</th>
                  <th className="py-3 px-3 text-center">Pulang Reg</th>
                  <th className="py-3 px-3 text-center">Pulang Add</th>
                  {/* Kolom Tumbang ditukar ke sini (sebelum Total Pulang) */}
                  <th className="py-3 px-3 text-center text-amber-700">Tumbang</th>
                  {/* Kolom Total Pulang setelah Tumbang */}
                  <th className="py-3 px-3 text-center text-blue-700">Total Pulang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r: any) => {
                  const targetTotal = r.targetHeadcount;

                  const masukTotal = r.attendanceIn?.actualHeadcount || 0;
                  const masukReg = r.attendanceIn?.actualRegular ?? r.attendanceIn?.actualHeadcount ?? 0;
                  const masukAdd = r.attendanceIn?.actualAdditional ?? 0;

                  const outRecord = r.attendanceIn?.attendanceOut;
                  const pulangTotal = outRecord?.pulangHeadcount || 0;
                  const pulangReg = outRecord?.pulangRegular ?? outRecord?.pulangHeadcount ?? 0;
                  const pulangAdd = outRecord?.pulangAdditional ?? 0;

                  const tumbangTotal = outRecord?.tumbangHeadcount || 0;
                  const fulfillRate = targetTotal > 0 ? Math.round((masukTotal / targetTotal) * 100) : 0;
                  const isClosed = !!outRecord;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Tanggal */}
                      <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">{r.date}</td>
                      
                      {/* Nama Vendor */}
                      <td className="py-3 px-3 font-extrabold text-slate-800 whitespace-nowrap">{r.vendor.name}</td>
                      
                      {/* Shift & Jam Kerja */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-semibold text-slate-700">
                          {r.shift.name.toLowerCase().includes('pagi') ? (
                            <Sun className="w-3 h-3 text-amber-500" />
                          ) : (
                            <Moon className="w-3 h-3 text-indigo-500" />
                          )}
                          <span>{r.shift.name}</span>
                        </div>
                        {r.workingHours && (
                          <span className="text-[10px] text-slate-400 block">{r.workingHours}</span>
                        )}
                      </td>

                      {/* Target MP */}
                      <td className="py-3 px-3 text-center font-extrabold text-slate-900">
                        {targetTotal}
                      </td>

                      {/* Masuk Regular */}
                      <td className="py-3 px-3 text-center font-bold text-blue-700">
                        {r.attendanceIn ? masukReg : '-'}
                      </td>

                      {/* Masuk Additional */}
                      <td className="py-3 px-3 text-center font-bold text-amber-700">
                        {r.attendanceIn ? masukAdd : '-'}
                      </td>

                      {/* Total Masuk */}
                      <td className="py-3 px-3 text-center font-black text-emerald-600">
                        {r.attendanceIn ? masukTotal : '-'}
                      </td>

                      {/* Fulfillment Rate */}
                      <td className="py-3 px-3 text-center font-bold">
                        {r.attendanceIn ? (
                          <span className={fulfillRate >= 100 ? 'text-emerald-700 font-extrabold' : 'text-slate-700'}>
                            {fulfillRate}%
                          </span>
                        ) : '-'}
                      </td>

                      {/* Pulang Regular */}
                      <td className="py-3 px-3 text-center font-bold text-blue-700">
                        {isClosed ? pulangReg : '-'}
                      </td>

                      {/* Pulang Additional */}
                      <td className="py-3 px-3 text-center font-bold text-amber-700">
                        {isClosed ? pulangAdd : '-'}
                      </td>

                      {/* Tumbang / Kendala (Posisinya ditukar sebelum Total Pulang) */}
                      <td className="py-3 px-3 text-center font-bold text-amber-600">
                        {isClosed ? (
                          <span className={tumbangTotal > 0 ? 'bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black' : 'text-slate-400'}>
                            {tumbangTotal}
                          </span>
                        ) : '-'}
                      </td>

                      {/* Total Pulang */}
                      <td className="py-3 px-3 text-center font-black text-blue-600">
                        {isClosed ? pulangTotal : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL POP-UP DETAIL DRILL-DOWN: PULANG UTUH (Saat Kotak Pulang Diklik)  */}
      {/* ========================================================================= */}
      {detailModalType === 'PULANG' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Modal Pulang */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Rincian Data Pulang Utuh</h3>
                  <p className="text-xs text-blue-100">
                    Daftar kepulangan pekerja yang menyelesaikan shift penuh ({allPulangRecords.length} vendor/shift)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalType(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ringkasan Cepat di Header Modal */}
            <div className="bg-blue-50/70 px-6 py-3 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <span className="text-slate-600">Total Pulang Utuh: <strong className="text-blue-700 text-sm">{totals.totalPulang} Org</strong></span>
                <span className="text-slate-600">Reguler: <strong className="text-blue-700">{totals.regPulang}</strong></span>
                <span className="text-slate-600">Additional: <strong className="text-amber-700">{totals.addPulang}</strong></span>
              </div>
              <span className="bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-full">
                Tingkat Retensi: {totals.overallRetention}%
              </span>
            </div>

            {/* Isi Tabel Modal Pulang */}
            <div className="p-6 overflow-y-auto flex-1">
              {allPulangRecords.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Belum ada catatan kepulangan shift pada periode yang dipilih.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">Vendor</th>
                        <th className="py-2.5 px-3">Shift</th>
                        <th className="py-2.5 px-3 text-center">Masuk Total</th>
                        <th className="py-2.5 px-3 text-center">Pulang Reg</th>
                        <th className="py-2.5 px-3 text-center">Pulang Add</th>
                        <th className="py-2.5 px-3 text-center">Total Pulang</th>
                        <th className="py-2.5 px-3 text-center">Retensi</th>
                        <th className="py-2.5 px-3 text-center">Foto Checkout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allPulangRecords.map((r: any) => {
                        const out = r.attendanceIn?.attendanceOut;
                        const masukTotal = r.attendanceIn?.actualHeadcount || 0;
                        const pTotal = out?.pulangHeadcount || 0;
                        const pReg = out?.pulangRegular ?? out?.pulangHeadcount ?? 0;
                        const pAdd = out?.pulangAdditional ?? 0;
                        const ret = masukTotal > 0 ? Math.round((pTotal / masukTotal) * 100) : 0;
                        const photoUrl = out?.photoCheckoutUrl;

                        return (
                          <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">{r.date}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">{r.vendor.name}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap">{r.shift.name}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700">{masukTotal}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-blue-700">{pReg}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-amber-700">{pAdd}</td>
                            <td className="py-2.5 px-3 text-center font-black text-blue-600">{pTotal}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${ret >= 95 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {ret}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {photoUrl ? (
                                <button
                                  onClick={() => setLightboxPhoto({ url: photoUrl, title: `Foto Checkout ${r.vendor.name} (${r.date} - ${r.shift.name})` })}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Lihat Foto</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400">Tidak ada</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer Modal Pulang */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setDetailModalType(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL POP-UP DETAIL DRILL-DOWN: TOTAL TUMBANG (Saat Kotak Tumbang Diklik)*/}
      {/* ========================================================================= */}
      {detailModalType === 'TUMBANG' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Modal Tumbang */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <HeartPulse className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Rincian Data Pekerja Tumbang / Izin Sakit</h3>
                  <p className="text-xs text-amber-100">
                    Log multi-kejadian pekerja sakit/cedera/izin di jam kerja beserta bukti foto faskes/surat dokter
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalType(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ringkasan Cepat di Header Modal */}
            <div className="bg-amber-50/70 px-6 py-3 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <span className="text-slate-600">Total Kejadian Tumbang: <strong className="text-amber-700 text-sm">{totals.totalTumbang} Orang</strong></span>
                <span className="text-slate-600">Reguler: <strong className="text-blue-700">{totals.regTumbang}</strong></span>
                <span className="text-slate-600">Additional: <strong className="text-amber-700">{totals.addTumbang}</strong></span>
              </div>
              <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full">
                {allTumbangIncidents.length} Catatan Insiden
              </span>
            </div>

            {/* Isi Tabel / Daftar Kejadian Tumbang */}
            <div className="p-6 overflow-y-auto flex-1">
              {allTumbangIncidents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Alhamdulillah, tidak ada catatan pekerja tumbang atau izin sakit pada periode ini.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">No</th>
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">Vendor</th>
                        <th className="py-2.5 px-3">Shift</th>
                        <th className="py-2.5 px-3 text-center">Kategori</th>
                        <th className="py-2.5 px-3 text-center">Jam Keluar</th>
                        <th className="py-2.5 px-3">Jenis & Keterangan</th>
                        <th className="py-2.5 px-3 text-center">Bukti Foto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allTumbangIncidents.map((inc, idx) => (
                        <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-400 text-center">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">{inc.date}</td>
                          <td className="py-2.5 px-3 font-extrabold text-slate-800 whitespace-nowrap">{inc.vendorName}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">{inc.shiftName}</td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${inc.category === 'ADDITIONAL' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                              {inc.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                              <Clock className="w-3 h-3 text-slate-500" />
                              {inc.time || '-'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800">{inc.type}</div>
                            <div className="text-[11px] text-slate-500 italic mt-0.5">{inc.notes}</div>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {inc.url ? (
                              <button
                                onClick={() => setLightboxPhoto({ url: inc.url!, title: `Bukti Sakit/Izin - ${inc.vendorName} (${inc.date} ${inc.time})` })}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Lihat Surat/Foto</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">Tanpa Foto</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer Modal Tumbang */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setDetailModalType(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL LIGHTBOX FOTO LAYAR PENUH (Untuk Zoom Foto Pulang / Tumbang)     */}
      {/* ========================================================================= */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          {/* Header Lightbox */}
          <div className="w-full max-w-3xl flex items-center justify-between text-white mb-3 px-2">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-sm truncate">{lightboxPhoto.title}</span>
            </div>
            <button
              onClick={() => setLightboxPhoto(null)}
              className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
              title="Tutup Foto"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Kontainer Foto Utama */}
          <div className="relative max-w-3xl max-h-[80vh] flex items-center justify-center bg-black/40 rounded-2xl overflow-hidden border border-white/10 shadow-2xl p-2">
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.title}
              className="max-h-[75vh] w-auto object-contain rounded-xl"
            />
          </div>

          {/* Tombol Aksi di Bawah Foto */}
          <div className="mt-4 flex items-center gap-3">
            <a
              href={lightboxPhoto.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>Buka Resolusi Penuh</span>
            </a>
            <button
              onClick={() => setLightboxPhoto(null)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Selesai Melihat
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
