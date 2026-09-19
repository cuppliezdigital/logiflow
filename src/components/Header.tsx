'use client';

// ============================================================================
// KOMPONEN HEADER & NAVIGASI UTAMA LOGIFLOW
// Berisi:
// 1. Branding Logo & Status Operasional Gudang
// 2. Pemilih Tanggal Kerja (Date Picker)
// 3. Tab Navigasi Alur 4 Tahap (Plotingan -> Masuk -> Pulang -> Laporan)
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { 
  ClipboardList, 
  LogIn, 
  LogOut, 
  FileSpreadsheet, 
  Warehouse, 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Definisi tipe props yang diterima oleh Header
interface HeaderProps {
  // Tab yang sedang aktif dipilih oleh pengguna (5 Alur Kerja)
  activeTab: 'plotingan' | 'masuk' | 'tumbang' | 'pulang' | 'laporan';
  // Fungsi untuk mengganti tab aktif
  setActiveTab: (tab: 'plotingan' | 'masuk' | 'tumbang' | 'pulang' | 'laporan') => void;
  // Tanggal yang sedang dimonitor (format YYYY-MM-DD)
  selectedDate: string;
  // Fungsi untuk mengubah tanggal monitoring
  setSelectedDate: (date: string) => void;
  // Jumlah insiden tumbang hari ini untuk badge peringatan
  tumbangCount?: number;
  // Tanggal-tanggal yang memiliki rekaman data plotingan/absensi
  datesWithData?: string[];
}

export default function Header({
  activeTab,
  setActiveTab,
  selectedDate,
  setSelectedDate,
  tumbangCount = 0,
  datesWithData = [],
}: HeaderProps) {
  // State untuk custom calendar popover
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Parse current selected date
  const [viewYear, setViewYear] = useState(() => {
    const d = new Date(selectedDate || Date.now());
    return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(selectedDate || Date.now());
    return isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
  });

  useEffect(() => {
    const d = new Date(selectedDate);
    if (!isNaN(d.getTime())) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [selectedDate]);

  // Click outside to close calendar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    }
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen]);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Generate calendar days
  const firstDayIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Monday = 0
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const calendarDays = [];
  // Prev month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarDays.push({
      day: daysInPrevMonth - i,
      month: viewMonth - 1,
      year: viewMonth === 0 ? viewYear - 1 : viewYear,
      isCurrentMonth: false,
    });
  }
  // Current month days
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    calendarDays.push({
      day: i,
      month: viewMonth,
      year: viewYear,
      isCurrentMonth: true,
    });
  }
  // Next month padding to fill 35 or 42 grid
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({
      day: i,
      month: viewMonth + 1,
      year: viewMonth === 11 ? viewYear + 1 : viewYear,
      isCurrentMonth: false,
    });
  }

  const formatLocalDateString = (dStr: string) => {
    try {
      const [y, m, d] = dStr.split('-');
      if (!y || !m || !d) return dStr;
      const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${parseInt(d, 10)} ${monthShort[parseInt(m, 10) - 1]} ${y}`;
    } catch {
      return dStr;
    }
  };

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

          {/* Date Selector (Pemilih Tanggal Operasional dengan Custom Popover & Dot Data) */}
          <div className="flex items-center gap-3 relative" ref={calendarRef}>
            <button
              type="button"
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              className="flex items-center gap-2.5 bg-slate-800/95 hover:bg-slate-750 border border-slate-700/90 hover:border-slate-600 rounded-xl px-3.5 py-2 shadow-inner transition-all cursor-pointer group"
              title="Pilih tanggal kerja (Tanggal yang bertitik hijau memiliki data)"
            >
              <CalendarIcon className="w-4 h-4 text-sky-400 group-hover:scale-105 transition-transform" />
              <span className="text-sm font-bold text-white tracking-wide">
                {formatLocalDateString(selectedDate)}
              </span>
              {datesWithData.includes(selectedDate) && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm animate-pulse" title="Hari ini memiliki data operasional" />
              )}
            </button>

            {/* Custom Interactive Calendar Popover */}
            {isCalendarOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 text-xs text-slate-200">
                {/* Header Kalender: Bulan, Tahun, Tombol Prev/Next */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="font-extrabold text-sm text-white">
                    {monthNames[viewMonth]} {viewYear}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Bulan sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Bulan berikutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Indikator Legend */}
                <div className="flex items-center justify-between px-1 py-1 mb-2 bg-slate-800/60 rounded-lg border border-slate-750 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Ada Data Rekaman</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                    <span>Aktif Dipilih</span>
                  </span>
                </div>

                {/* Hari dalam seminggu */}
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-400 text-[11px] mb-1.5">
                  <span>Sn</span><span>Sl</span><span>Rb</span><span>Km</span><span>Jm</span><span>Sb</span><span>Mg</span>
                </div>

                {/* Grid Tanggal */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {calendarDays.map((item, idx) => {
                    const monthStr = String(item.month + 1).padStart(2, '0');
                    const dayStr = String(item.day).padStart(2, '0');
                    const dateVal = `${item.year}-${monthStr}-${dayStr}`;
                    const isSelected = dateVal === selectedDate;
                    const hasData = datesWithData.includes(dateVal);

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedDate(dateVal);
                          setIsCalendarOpen(false);
                        }}
                        disabled={!item.isCurrentMonth}
                        className={`py-1.5 rounded-lg flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                          !item.isCurrentMonth
                            ? 'text-slate-600 opacity-40 cursor-not-allowed'
                            : isSelected
                            ? 'bg-sky-500 text-white font-black shadow-md'
                            : 'hover:bg-slate-800 text-slate-200 font-semibold'
                        }`}
                      >
                        <span className="text-xs leading-none">{item.day}</span>
                        {/* Titik Hijau Penanda Data Ada */}
                        {hasData && (
                          <span
                            className={`w-1 h-1 rounded-full mt-1 ${
                              isSelected ? 'bg-white' : 'bg-emerald-400'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tombol Cepat Hari Ini */}
                <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setSelectedDate(today);
                      setIsCalendarOpen(false);
                    }}
                    className="text-[11px] font-bold text-sky-400 hover:text-sky-300 py-1 px-2 hover:bg-sky-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    Hari Ini ({formatLocalDateString(new Date().toISOString().split('T')[0])})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(false)}
                    className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 py-1 px-2 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* BAGIAN BAWAH: 5 Tab Navigasi Sesuai Siklus Kerja Gudang */}
        <div className="flex space-x-1 sm:space-x-2 border-t border-slate-800 pt-1 overflow-x-auto no-scrollbar">
          
          {/* TAB 1: Plotingan (Target Permintaan H-1) */}
          <button
            onClick={() => setActiveTab('plotingan')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'plotingan'
                ? 'border-sky-400 text-sky-400 bg-sky-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-t-lg'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            1. Plotingan
          </button>

          {/* TAB 2: Absen Masuk (Serah Terima Pasukan Awal Shift) */}
          <button
            onClick={() => setActiveTab('masuk')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'masuk'
                ? 'border-sky-400 text-sky-400 bg-sky-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-t-lg'
            }`}
          >
            <LogIn className="w-4 h-4" />
            2. Absen Masuk
          </button>

          {/* TAB 3: Live Tumbang & Kendala (Flat Clean, Tanpa Icon Hati) */}
          <button
            onClick={() => setActiveTab('tumbang')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'tumbang'
                ? 'border-amber-400 text-amber-300 bg-amber-500/15 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-amber-200 hover:bg-slate-800/50 rounded-t-lg'
            }`}
          >
            <span>3. Live Tumbang</span>
            {tumbangCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full animate-pulse">
                {tumbangCount}
              </span>
            )}
          </button>

          {/* TAB 4: Absen Pulang (Checkout Vendor & Under Lapangan) */}
          <button
            onClick={() => setActiveTab('pulang')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'pulang'
                ? 'border-sky-400 text-sky-400 bg-sky-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-t-lg'
            }`}
          >
            <LogOut className="w-4 h-4" />
            4. Absen Pulang
          </button>

          {/* TAB 5: Laporan & Rekap Validasi Invoice Excel */}
          <button
            onClick={() => setActiveTab('laporan')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'laporan'
                ? 'border-sky-400 text-sky-400 bg-sky-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-t-lg'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            5. Laporan
          </button>

        </div>

      </div>
    </header>
  );
}