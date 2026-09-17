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
import Header from '@/components/Header';
import PlotinganTab from '@/components/PlotinganTab';
import AbsenMasukTab from '@/components/AbsenMasukTab';
import AbsenPulangTab from '@/components/AbsenPulangTab';
import LaporanTab from '@/components/LaporanTab';
import { getMasterData, getPlotingans } from '@/app/actions';
import { Loader2 } from 'lucide-react';

export default function Home() {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT GLOBAL DASHBOARD
  // --------------------------------------------------------------------------
  
  // Tanggal operasional yang sedang dipilih (format YYYY-MM-DD, default hari ini)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Tab yang sedang aktif dibuka pengguna: 'plotingan' | 'masuk' | 'pulang' | 'laporan'
  const [activeTab, setActiveTab] = useState<'plotingan' | 'masuk' | 'pulang' | 'laporan'>('plotingan');

  // Master data: daftar vendor aktif dan shift kerja (Shift Pagi & Shift Malam)
  const [vendors, setVendors] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);

  // Data transaksi plotingan pada tanggal yang dipilih
  const [plotingans, setPlotingans] = useState<any[]>([]);

  // Status loading indikator data
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // --------------------------------------------------------------------------
  // DATA FETCHING & SYNCHRONIZATION
  // --------------------------------------------------------------------------

  // Fungsi untuk mengambil data plotingan berdasarkan tanggal terpilih
  const loadPlotinganData = useCallback(async (date: string) => {
    try {
      const data = await getPlotingans(date);
      setPlotingans(data);
    } catch (err) {
      console.error('Gagal mengambil data plotingan:', err);
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* 1. HEADER & NAVIGASI TAB */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedDate={selectedDate}
        setSelectedDate={handleDateChange}
      />

      {/* 2. KONTEN UTAMA SESUAI TAB AKTIF */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          // Loading spinner saat berpindah tanggal atau fetch awal
          <div className="flex flex-col items-center justify-center py-32 space-y-3">
            <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Memuat data operasional gudang...</p>
          </div>
        ) : (
          <div>
            {/* TAB 1: MODUL PLOTINGAN (TARGET HEADCOUNT H-1 & KELOLA VENDOR) */}
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

            {/* TAB 2: MODUL ABSEN MASUK (SERAH TERIMA PASUKAN SHIFT) */}
            {activeTab === 'masuk' && (
              <AbsenMasukTab
                plotingans={plotingans}
                shifts={shifts}
                selectedDate={selectedDate}
                onRefresh={handleRefresh}
              />
            )}

            {/* TAB 3: MODUL ABSEN PULANG & AUDIT INTEGRITAS */}
            {activeTab === 'pulang' && (
              <AbsenPulangTab
                plotingans={plotingans}
                selectedDate={selectedDate}
                onRefresh={handleRefresh}
              />
            )}

            {/* TAB 4: MODUL LAPORAN KPI & EXCEL INVOICE */}
            {activeTab === 'laporan' && (
              <LaporanTab
                vendors={vendors}
                selectedDate={selectedDate}
              />
            )}
          </div>
        )}
      </main>

      {/* 3. FOOTER APLIKASI */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto text-center text-xs text-slate-400">
        <p>
          &copy; {new Date().getFullYear()} <strong className="text-slate-700 font-bold">Absensi</strong> &bull; Sistem Monitoring & Integritas Manpower Logistik
        </p>
      </footer>

    </div>
  );
}
