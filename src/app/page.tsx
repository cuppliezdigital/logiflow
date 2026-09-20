'use client';

// ============================================================================
// HALAMAN UTAMA DASHBOARD LOGIFLOW (ORCHESTRATOR)
// Mengintegrasikan:
// 1. Header & Navigasi Tab (1. Plotingan, 2. Masuk, 3. Pulang, 4. Laporan)
// 2. State Global Tanggal Operasional (selectedDate) & Tab Aktif (activeTab)
// 3. Pengambilan Data Master (Vendor & Shift Pagi/Malam) dan Plotingan Harian
// 4. Mekanisme Refresh Data Otomatis Antar Tab & Kelola Vendor
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import MobileBottomNav from '@/components/MobileBottomNav';
import PlotinganTab from '@/components/PlotinganTab';
import AbsenMasukTab from '@/components/AbsenMasukTab';
import TumbangTab from '@/components/TumbangTab';
import AbsenPulangTab from '@/components/AbsenPulangTab';
import LaporanTab from '@/components/LaporanTab';
import { getMasterData, getPlotingans, getTumbangIncidents, getDatesWithData } from '@/app/actions';
import { Loader2 } from 'lucide-react';
import { AppTheme } from '@/types/theme';

export default function Home() {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT GLOBAL DASHBOARD
  // --------------------------------------------------------------------------
  
  // Tanggal operasional yang sedang dipilih (format YYYY-MM-DD, default hari ini)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Tab yang sedang aktif dibuka pengguna: 'plotingan' | 'masuk' | 'tumbang' | 'pulang' | 'laporan'
  const [activeTab, setActiveTab] = useState<'plotingan' | 'masuk' | 'tumbang' | 'pulang' | 'laporan'>('plotingan');

  // State menu drawer mobile (khusus layar HP)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // State tema tampilan aktif (default: 'original', tersimpan otomatis di localStorage)
  const [theme, setTheme] = useState<AppTheme>('original');

  // Muat tema yang tersimpan di browser saat awal buka aplikasi
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('logiflow_theme') as AppTheme;
      if (savedTheme && ['original', 'navy', 'soft', 'dark'].includes(savedTheme)) {
        setTheme(savedTheme);
      }
    } catch {}
  }, []);

  const handleSetTheme = (newTheme: AppTheme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem('logiflow_theme', newTheme);
    } catch {}
  };

  // Master data: daftar vendor aktif dan shift kerja (Shift Pagi & Shift Malam)
  const [vendors, setVendors] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);

  // Data transaksi plotingan pada tanggal yang dipilih
  const [plotingans, setPlotingans] = useState<any[]>([]);

  // Data insiden pekerja tumbang / sakit / izin hari ini
  const [tumbangIncidents, setTumbangIncidents] = useState<any[]>([]);

  // Tanggal-tanggal yang memiliki rekaman data plotingan
  const [datesWithData, setDatesWithData] = useState<string[]>([]);

  // Status loading indikator data
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // --------------------------------------------------------------------------
  // DATA FETCHING & SYNCHRONIZATION
  // --------------------------------------------------------------------------

  // Fungsi untuk mengambil data plotingan dan tumbang berdasarkan tanggal terpilih
  const loadPlotinganData = useCallback(async (date: string) => {
    try {
      const [plotData, incidentData, activeDates] = await Promise.all([
        getPlotingans(date),
        getTumbangIncidents(date),
        getDatesWithData()
      ]);
      setPlotingans(plotData);
      setTumbangIncidents(incidentData);
      setDatesWithData(activeDates);
    } catch (err) {
      console.error('Gagal mengambil data operasional:', err);
    }
  }, []);

  // Fungsi untuk memuat ulang daftar vendor dan shift kerja
  const loadMasterData = useCallback(async () => {
    try {
      const { vendors: v, shifts: s } = await getMasterData();
      // Deduplikasi ketat di level root agar semua tab pasti bersih tanpa ganda
      const cleanShifts = (s || []).filter(
        (item: any, idx: number, arr: any[]) =>
          idx === arr.findIndex((t: any) => t.name?.toLowerCase().trim() === item.name?.toLowerCase().trim())
      );
      const cleanVendors = (v || []).filter(
        (item: any, idx: number, arr: any[]) =>
          idx === arr.findIndex((t: any) => t.name?.toLowerCase().trim() === item.name?.toLowerCase().trim())
      );
      setVendors(cleanVendors);
      setShifts(cleanShifts);
    } catch (err) {
      console.error('Gagal memuat master data:', err);
    }
  }, []);

  // Inisialisasi awal: Muat master data vendor dan shift sekali saat aplikasi dimuat
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        await loadMasterData();
        await loadPlotinganData(selectedDate);
      } catch (err) {
        console.error('Gagal memuat data awal:', err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [loadMasterData, loadPlotinganData, selectedDate]);

  // Muat ulang data saat tanggal diubah oleh pengguna di Header
  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    setIsLoading(true);
    await loadPlotinganData(newDate);
    setIsLoading(false);
  };

  // Callback refresh data yang dipanggil oleh child tab setelah operasi create/update/delete
  const handleRefresh = async () => {
    await loadPlotinganData(selectedDate);
  };

  // Dynamic background styling per theme
  const themeBgClasses: Record<AppTheme, string> = {
    original: 'bg-slate-100/70 text-slate-800',
    navy: 'bg-blue-50/40 text-slate-800',
    soft: 'bg-slate-50 text-slate-800',
    dark: 'bg-slate-950 text-slate-200',
  };

  return (
    <div className={`min-h-screen flex flex-col md:flex-row font-sans transition-colors duration-200 ${themeBgClasses[theme]}`}>
      
      {/* 1. SIDEBAR KIRI (LAPTOP / PC) & MOBILE SLIDE-IN DRAWER (HP) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tumbangCount={tumbangIncidents.length}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        theme={theme}
        setTheme={handleSetTheme}
      />

      {/* 2. AREA KONTEN UTAMA */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* TOPBAR: Hamburger Menu di HP, Judul Modul di Laptop, & Kalender Popover */}
        <TopBar
          activeTab={activeTab}
          selectedDate={selectedDate}
          setSelectedDate={handleDateChange}
          datesWithData={datesWithData}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          theme={theme}
          setTheme={handleSetTheme}
        />

        {/* MAIN BODY PER MODUL OPERASIONAL */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8">
          {isLoading ? (
            // Loading spinner saat berpindah tanggal atau fetch awal
            <div className="flex flex-col items-center justify-center py-32 space-y-3">
              <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
              <p className="text-sm font-semibold text-slate-500">Memuat data operasional gudang...</p>
            </div>
          ) : (
            <div>
              {/* MODUL PLOTINGAN (TARGET HEADCOUNT H-1 & KELOLA VENDOR) */}
              {activeTab === 'plotingan' && (
                <PlotinganTab
                  plotingans={plotingans}
                  vendors={vendors}
                  shifts={shifts}
                  selectedDate={selectedDate}
                  onRefresh={handleRefresh}
                  onVendorsChanged={loadMasterData}
                />
              )}

              {/* MODUL ABSEN MASUK & DISTRIBUSI POS PIC LAPANGAN */}
              {activeTab === 'masuk' && (
                <AbsenMasukTab
                  plotingans={plotingans}
                  shifts={shifts}
                  selectedDate={selectedDate}
                  onRefresh={handleRefresh}
                />
              )}

              {/* MODUL LIVE TUMBANG & KENDALA (LAPORAN ATASAN REAL-TIME) */}
              {activeTab === 'tumbang' && (
                <TumbangTab
                  incidents={tumbangIncidents}
                  shifts={shifts}
                  vendors={vendors}
                  selectedDate={selectedDate}
                  onRefresh={handleRefresh}
                />
              )}

              {/* MODUL ABSEN PULANG & REKONSILIASI KEPULANGAN */}
              {activeTab === 'pulang' && (
                <AbsenPulangTab
                  plotingans={plotingans}
                  shifts={shifts}
                  tumbangIncidents={tumbangIncidents}
                  selectedDate={selectedDate}
                  onRefresh={handleRefresh}
                />
              )}

              {/* MODUL LAPORAN REKAPITULASI & INVOICE */}
              {activeTab === 'laporan' && (
                <LaporanTab
                  vendors={vendors}
                  selectedDate={selectedDate}
                />
              )}
            </div>
          )}
        </main>

        {/* 3. FOOTER APLIKASI (Desktop Only) */}
        <footer className={`hidden md:block border-t py-3.5 text-center text-xs mt-auto transition-colors ${
          theme === 'navy'
            ? 'bg-slate-950 border-blue-900/60 text-slate-400'
            : theme === 'dark'
            ? 'bg-slate-900 border-slate-800 text-slate-500'
            : 'bg-white border-slate-200 text-slate-400'
        }`}>
          <p>
            &copy; {new Date().getFullYear()} <strong className={theme === 'dark' ? 'text-slate-300 font-bold' : 'text-slate-700 font-bold'}>Absensi</strong> &bull; Sistem Monitoring & Integritas Manpower Logistik
          </p>
        </footer>

      </div>

      {/* 4. BOTTOM NAVIGATION BAR KHUSUS HP (Ramah Jempol) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tumbangCount={tumbangIncidents.length}
        theme={theme}
      />

    </div>
  );
}

