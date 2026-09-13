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

        {/* KPI 5: Selisih Kabur */}
        <div className={`rounded-2xl p-4 border shadow-xs ${totals.totalSelisih > 0 ? 'bg-rose-50/70 border-rose-300' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Selisih / Kabur</span>
            <AlertTriangle className={`w-4 h-4 ${totals.totalSelisih > 0 ? 'text-rose-600 animate-bounce' : 'text-slate-400'}`} />
          </div>
          <p className={`text-2xl font-black ${totals.totalSelisih > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {totals.totalSelisih} <span className="text-xs font-normal text-slate-400">Org</span>
          </p>
          <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-100 pt-1.5 font-bold">
            <span>{totals.totalSelisih > 0 ? `⚠️ R:${totals.regSelisih} | A:${totals.addSelisih}` : '✔ Integritas Bersih'}</span>
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
                  <th className="py-3 px-3 text-center">Target (Reg / Add)</th>
                  <th className="py-3 px-3 text-center">Masuk (Reg / Add)</th>
                  <th className="py-3 px-3 text-center">Fulfill (%)</th>
                  <th className="py-3 px-3 text-center">Pulang (Reg / Add)</th>
                  <th className="py-3 px-3 text-center">Tumbang</th>
                  <th className="py-3 px-3 text-center">Selisih</th>
                  <th className="py-3 px-3 text-center">Status Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r: any) => {
                  const targetReg = r.targetRegular ?? (r.status === 'REGULAR' ? r.targetHeadcount : 0);
                  const targetAdd = r.targetAdditional ?? (r.status === 'ADDITIONAL' ? r.targetHeadcount : 0);
                  const targetTotal = r.targetHeadcount;

                  const masukTotal = r.attendanceIn?.actualHeadcount || 0;
                  const masukReg = r.attendanceIn?.actualRegular ?? r.attendanceIn?.actualHeadcount ?? 0;
                  const masukAdd = r.attendanceIn?.actualAdditional ?? 0;

                  const outRecord = r.attendanceIn?.attendanceOut;
                  const pulangTotal = outRecord?.pulangHeadcount || 0;
                  const pulangReg = outRecord?.pulangRegular ?? outRecord?.pulangHeadcount ?? 0;
                  const pulangAdd = outRecord?.pulangAdditional ?? 0;

                  const tumbangTotal = outRecord?.tumbangHeadcount || 0;
                  const selisih = outRecord?.selisihCount || 0;
                  const fulfillRate = targetTotal > 0 ? Math.round((masukTotal / targetTotal) * 100) : 0;
                  const isClosed = !!outRecord;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Tanggal */}
                      <td className="py-3 px-3 font-semibold text-slate-900">{r.date}</td>
                      
                      {/* Nama Vendor */}
                      <td className="py-3 px-3 font-extrabold text-slate-800">{r.vendor.name}</td>
                      
                      {/* Shift & Jam Kerja */}
                      <td className="py-3 px-3">
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

                      {/* Target (Reg / Add / Total) */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-extrabold text-slate-900 block">{targetTotal} Org</span>
                        <span className="text-[10px] text-slate-400">R:{targetReg} &bull; A:{targetAdd}</span>
                      </td>

                      {/* Masuk (Reg / Add / Total) */}
                      <td className="py-3 px-3 text-center font-bold text-emerald-600">
                        {r.attendanceIn ? (
                          <>
                            <span className="block">{masukTotal} Org</span>
                            <span className="text-[10px] text-slate-500 font-normal">R:{masukReg} &bull; A:{masukAdd}</span>
                          </>
                        ) : '-'}
                      </td>

                      {/* Fulfillment Rate */}
                      <td className="py-3 px-3 text-center font-bold">
                        {r.attendanceIn ? `${fulfillRate}%` : '-'}
                      </td>

                      {/* Pulang (Reg / Add / Total) */}
                      <td className="py-3 px-3 text-center font-bold text-blue-600">
                        {isClosed ? (
                          <>
                            <span className="block">{pulangTotal} Org</span>
                            <span className="text-[10px] text-slate-500 font-normal">R:{pulangReg} &bull; A:{pulangAdd}</span>
                          </>
                        ) : '-'}
                      </td>

                      {/* Tumbang */}
                      <td className="py-3 px-3 text-center font-bold text-amber-600">
                        {isClosed ? `${tumbangTotal} Org` : '-'}
                      </td>

                      {/* Selisih */}
                      <td className="py-3 px-3 text-center font-bold">
                        {isClosed ? (
                          <span className={selisih > 0 ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-black' : 'text-emerald-600'}>
                            {selisih}
                          </span>
                        ) : '-'}
                      </td>

                      {/* Status Audit */}
                      <td className="py-3 px-3 text-center">
                        {isClosed ? (
                          outRecord.isBalanced ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" />
                              CLOSED (OK)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                              <AlertTriangle className="w-3 h-3" />
                              SELISIH
                            </span>
                          )
                        ) : r.attendanceIn ? (
                          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            IN PROGRESS
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                            WAITING
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
