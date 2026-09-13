'use client';

// ============================================================================
// KOMPONEN HEADER & NAVIGASI UTAMA LOGIFLOW
// Berisi:
// 1. Branding Logo & Status Operasional Gudang
// 2. Pemilih Tanggal Kerja (Date Picker)
// 3. Tab Navigasi Alur 4 Tahap (Plotingan -> Masuk -> Pulang -> Laporan)
// ============================================================================

import React from 'react';
import { 
  ClipboardList, 
  LogIn, 
  LogOut, 
  FileSpreadsheet, 
  Warehouse, 
  Calendar 
} from 'lucide-react';

// Definisi tipe props yang diterima oleh Header
interface HeaderProps {
  // Tab yang sedang aktif dipilih oleh pengguna
  activeTab: 'plotingan' | 'masuk' | 'pulang' | 'laporan';
  // Fungsi untuk mengganti tab aktif
  setActiveTab: (tab: 'plotingan' | 'masuk' | 'pulang' | 'laporan') => void;
  // Tanggal yang sedang dimonitor (format YYYY-MM-DD)
  selectedDate: string;
  // Fungsi untuk mengubah tanggal monitoring
  setSelectedDate: (date: string) => void;
}

export default function Header({
  activeTab,
  setActiveTab,
  selectedDate,
  setSelectedDate,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-lg border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* BAGIAN ATAS: Branding Logo, Nama Aplikasi, & Pemilih Tanggal */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 gap-4">
          
          {/* Brand & Lokasi Gudang */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-md">
              <Warehouse className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-sky-300 bg-clip-text text-transparent">
                  Absensi
                </h1>
                <span className="text-xs bg-sky-500/20 text-sky-300 font-semibold px-2 py-0.5 rounded-full border border-sky-500/30">
                  Manpower Control
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                {/* Indikator Titik Hijau Berkedip (Sistem Aktif) */}
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Central Gateway Logistik &middot; Monitoring Vendor & Fulfillment
              </p>
            </div>
          </div>

          {/* Date Selector (Pemilih Tanggal Operasional Kerja) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-1.5 shadow-inner">
              <Calendar className="w-4 h-4 text-sky-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer"
                title="Pilih tanggal kerja untuk melihat atau mencatat data"
              />
            </div>
          </div>

        </div>

        {/* BAGIAN BAWAH: 4 Tab Navigasi Sesuai Siklus Kerja Gudang */}
        <div className="flex space-x-1 sm:space-x-2 border-t border-slate-800 pt-1 overflow-x-auto no-scrollbar">
          
          {/* TAB 1: Plotingan (Target Permintaan H-1) */}
          <button
            onClick={() => setActiveTab('plotingan')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'plotingan'
                ? 'border-sky-400 text-sky-400 bg-sky-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-t-lg'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            1. Plotingan
          </button>

          {/* TAB 2: Absen Masuk (Serah Terima Pasukan saat Apel Pagi) */}
          <button
            onClick={() => setActiveTab('masuk')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'masuk'
                ? 'border-sky-400 text-sky-400 bg-sky-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-t-lg'
            }`}
          >
            <LogIn className="w-4 h-4" />
            2. Absen Masuk
          </button>

          {/* TAB 3: Absen Pulang & Tumbang (Checkout & Audit Selisih/Kabur) */}
          <button
            onClick={() => setActiveTab('pulang')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'pulang'
                ? 'border-sky-400 text-sky-400 bg-sky-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-t-lg'
            }`}
          >
            <LogOut className="w-4 h-4" />
            3. Absen Pulang & Tumbang
          </button>

          {/* TAB 4: Laporan & Rekap Validasi Invoice Excel */}
          <button
            onClick={() => setActiveTab('laporan')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'laporan'
                ? 'border-sky-400 text-sky-400 bg-sky-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-t-lg'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            4. Laporan & Invoice Excel
          </button>

        </div>

      </div>
    </header>
  );
}