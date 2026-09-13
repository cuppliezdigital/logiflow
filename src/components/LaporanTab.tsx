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
  Moon
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

      {/* 3. KARTU STATISTIK KPI UTAMA (TERMASUK BREAKDOWN REG & ADD) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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

        {/* KPI 3: Pulang Utuh */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pulang Utuh</span>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600">{totals.totalPulang} <span className="text-xs font-normal text-slate-400">Org</span></p>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5 font-bold">
            <span>Retensi: <strong className="text-blue-600">{totals.overallRetention}%</strong></span>
            <span>(R:{totals.regPulang} | A:{totals.addPulang})</span>
          </div>
        </div>

        {/* KPI 4: Tumbang Sakit */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Tumbang</span>
            <HeartPulse className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">{totals.totalTumbang} <span className="text-xs font-normal text-slate-400">Org</span></p>
          <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-100 pt-1.5 flex justify-between font-bold">
            <span>Reg: {totals.regTumbang}</span>
            <span>Add: {totals.addTumbang}</span>
          </div>
        </div>

        {/* KPI 5: Total Akhir */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Total Akhir</span>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">
            {totals.totalPulang + totals.totalTumbang} <span className="text-xs font-normal text-slate-400">Org</span>
          </p>
          <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-100 pt-1.5 font-bold flex justify-between">
            <span>Pulang: {totals.totalPulang}</span>
            <span>Tumbang: {totals.totalTumbang}</span>
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
                  <th className="py-3 px-3 text-center">Total Pulang</th>
                  <th className="py-3 px-3 text-center">Tumbang</th>
                  <th className="py-3 px-3 text-center">Total Akhir</th>
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
                  const totalAkhir = pulangTotal + tumbangTotal;

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

                      {/* Total Pulang */}
                      <td className="py-3 px-3 text-center font-black text-blue-600">
                        {isClosed ? pulangTotal : '-'}
                      </td>

                      {/* Tumbang / Kendala */}
                      <td className="py-3 px-3 text-center font-bold text-amber-600">
                        {isClosed ? tumbangTotal : '-'}
                      </td>

                      {/* Total Akhir */}
                      <td className="py-3 px-3 text-center">
                        {isClosed ? (
                          <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                            {totalAkhir}
                          </span>
                        ) : r.attendanceIn ? (
                          <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                            Dalam Shift
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">
                            -
                          </span>
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

    </div>
  );
}
