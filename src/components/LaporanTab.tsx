'use client';

// ============================================================================
// KOMPONEN TAB 4: LAPORAN REKAPITULASI KPI & EXPORT EXCEL VALIDASI INVOICE
// Fitur:
// 1. Filter Rentang Tanggal (Start Date & End Date) serta Pilihan Vendor
// 2. Dashboard Kartu KPI Utama: Target, Fulfillment, Retensi, Tumbang, & Selisih
// 3. Tabel Detail Rekap Kehadiran dan Audit Integritas per Shift
// 4. Download Laporan Spreadsheet Excel (.xlsx) untuk Validasi Tagihan Vendor
// ============================================================================

import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  Filter, 
  Users, 
  TrendingUp, 
  HeartPulse, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Building2,
  RefreshCw
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
  // Rentang tanggal filter (default: awal bulan berjalan s.d. tanggal terpilih)
  const defaultStart = selectedDate ? `${selectedDate.substring(0, 7)}-01` : new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(selectedDate || new Date().toISOString().split('T')[0]);
  
  // Filter vendor (default: 'ALL' untuk semua vendor)
  const [selectedVendorId, setSelectedVendorId] = useState('ALL');

  // Menyimpan data statistik dan daftar record dari backend
  const [reportData, setReportData] = useState<any>(null);
  // Status loading saat mengambil data dari server
  const [isLoading, setIsLoading] = useState(false);
  // Status saat tombol download excel sedang diproses
  const [isExporting, setIsExporting] = useState(false);

  // --------------------------------------------------------------------------
  // DATA FETCHING & FILTER HANDLERS
  // --------------------------------------------------------------------------
  
  // Fungsi mengambil rekap statistik dari Server Action
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

  // Muat data otomatis pertama kali saat tab dibuka atau saat tanggal berubah
  useEffect(() => {
    fetchStats();
  }, [startDate, endDate, selectedVendorId]);

  // Handler untuk download file Excel dari API route Next.js
  const handleExportExcel = () => {
    setIsExporting(true);
    const params = new URLSearchParams({
      startDate,
      endDate,
      vendorId: selectedVendorId,
    });
    
    // Memicu pengunduhan file Excel via browser window location
    window.location.href = `/api/export-excel?${params.toString()}`;
    setTimeout(() => setIsExporting(false), 2000);
  };

  const totals = reportData?.totals || {
    totalTarget: 0,
    totalMasuk: 0,
    totalPulang: 0,
    totalTumbang: 0,
    totalSelisih: 0,
    regTarget: 0,
    addTarget: 0,
    overallFulfillment: 0,
    overallRetention: 0,
  };

  const records = reportData?.records || [];

  return (
    <div className="space-y-6">
      
      {/* 1. BANNER INFORMASI LAPORAN */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-l-4 border-emerald-500 p-4 rounded-r-xl">
        <h2 className="text-base font-bold text-slate-900">FASE 4: Laporan & Validasi Invoice Vendor</h2>
        <p className="text-xs text-slate-600 mt-0.5">
          Pantau performa pemenuhan target vendor (Fulfillment), tingkat retensi pekerja sampai selesai shift, serta validasi audit selisih sebelum menandatangani invoice penagihan.
        </p>
      </div>

      {/* 2. BAR FILTER & TOMBOL EXPORT EXCEL */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Form Filter (Tanggal Mulai, Tanggal Selesai, Vendor) */}
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

            {/* Filter Pilihan Vendor */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            {/* Tombol Refresh Manual */}
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

      {/* 3. KARTU STATISTIK KPI UTAMA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* KPI 1: Target Kebutuhan Manpower */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Target</span>
            <Users className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totals.totalTarget} <span className="text-xs font-normal text-slate-400">Org</span></p>
          <div className="mt-2 text-[10px] text-slate-500 flex justify-between border-t border-slate-100 pt-1.5">
            <span>Reg: <strong className="text-blue-600">{totals.regTarget}</strong></span>
            <span>Add: <strong className="text-amber-600">{totals.addTarget}</strong></span>
          </div>
        </div>

        {/* KPI 2: Realisasi Masuk & % Fulfillment */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Aktual Masuk</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{totals.totalMasuk} <span className="text-xs font-normal text-slate-400">Org</span></p>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5">
            <span>Fulfillment:</span>
            <strong className={`font-extrabold ${totals.overallFulfillment >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {totals.overallFulfillment}%
            </strong>
          </div>
        </div>

        {/* KPI 3: Pulang Utuh & Retention Rate */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pulang Utuh</span>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600">{totals.totalPulang} <span className="text-xs font-normal text-slate-400">Org</span></p>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5">
            <span>Ketahanan:</span>
            <strong className="text-blue-600 font-extrabold">{totals.overallRetention}%</strong>
          </div>
        </div>

        {/* KPI 4: Pekerja Tumbang (Sakit / Klinik) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Tumbang</span>
            <HeartPulse className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">{totals.totalTumbang} <span className="text-xs font-normal text-slate-400">Org</span></p>
          <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-100 pt-1.5">
            <span>Cedera & P3K Klinik</span>
          </div>
        </div>

        {/* KPI 5: Pekerja Kabur / Selisih Tanpa Izin */}
        <div className={`rounded-2xl p-4 border shadow-xs ${totals.totalSelisih > 0 ? 'bg-rose-50/70 border-rose-300' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Selisih / Kabur</span>
            <AlertTriangle className={`w-4 h-4 ${totals.totalSelisih > 0 ? 'text-rose-600 animate-bounce' : 'text-slate-400'}`} />
          </div>
          <p className={`text-2xl font-black ${totals.totalSelisih > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {totals.totalSelisih} <span className="text-xs font-normal text-slate-400">Org</span>
          </p>
          <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-100 pt-1.5">
            <span>{totals.totalSelisih > 0 ? '⚠️ Potensi Bocor Tagihan' : '✔ Integritas Bersih'}</span>
          </div>
        </div>
      </div>

      {/* 4. TABEL DETAIL DATA REKAP */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">
            Daftar Detail Operasional ({records.length} Plotingan Ditemukan)
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
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Target</th>
                  <th className="py-3 px-3 text-center">Masuk</th>
                  <th className="py-3 px-3 text-center">Fulfill (%)</th>
                  <th className="py-3 px-3 text-center">Pulang</th>
                  <th className="py-3 px-3 text-center">Tumbang</th>
                  <th className="py-3 px-3 text-center">Selisih</th>
                  <th className="py-3 px-3 text-center">Status Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r: any) => {
                  const masuk = r.attendanceIn?.actualHeadcount || 0;
                  const outRecord = r.attendanceIn?.attendanceOut;
                  const pulang = outRecord?.pulangHeadcount || 0;
                  const tumbang = outRecord?.tumbangHeadcount || 0;
                  const selisih = outRecord?.selisihCount || 0;
                  const fulfillRate = r.targetHeadcount > 0 ? Math.round((masuk / r.targetHeadcount) * 100) : 0;
                  const isClosed = !!outRecord;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900">{r.date}</td>
                      <td className="py-3 px-3 font-bold text-slate-800">{r.vendor.name}</td>
                      <td className="py-3 px-3 text-slate-600">{r.shift.name}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'REGULAR' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900">{r.targetHeadcount}</td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-600">
                        {r.attendanceIn ? masuk : '-'}
                      </td>
                      <td className="py-3 px-3 text-center font-bold">
                        {r.attendanceIn ? `${fulfillRate}%` : '-'}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-blue-600">
                        {isClosed ? pulang : '-'}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-amber-600">
                        {isClosed ? tumbang : '-'}
                      </td>
                      <td className="py-3 px-3 text-center font-bold">
                        {isClosed ? (
                          <span className={selisih > 0 ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded' : 'text-emerald-600'}>
                            {selisih}
                          </span>
                        ) : '-'}
                      </td>
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

