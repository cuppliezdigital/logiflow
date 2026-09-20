'use client';

// ============================================================================
// KOMPONEN TOPBAR: HEADER ATAS RESPONSIP (LAPTOP & HP)
// Berisi:
// 1. Tombol Hamburger (Khusus HP) untuk memicu Sidebar Drawer dari samping kiri
// 2. Judul Modul Aktif & Deskripsi Singkat (Tanpa embel-embel "Fase")
// 3. Pemilih Tanggal Interaktif (Custom Popover Calendar dengan Titik Hijau Rekaman Data)
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Warehouse,
  Palette,
  Check
} from 'lucide-react';
import { AppTheme, THEME_OPTIONS } from '@/types/theme';

interface TopBarProps {
  activeTab: 'plotingan' | 'masuk' | 'tumbang' | 'pulang' | 'laporan';
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  datesWithData?: string[];
  onOpenMobileMenu: () => void;
  theme?: AppTheme;
  setTheme?: (theme: AppTheme) => void;
}

export default function TopBar({
  activeTab,
  selectedDate,
  setSelectedDate,
  datesWithData = [],
  onOpenMobileMenu,
  theme = 'original',
  setTheme,
}: TopBarProps) {
  // State untuk custom calendar popover
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // State untuk popover pemilih tema
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);

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
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setIsThemeOpen(false);
      }
    }
    if (isCalendarOpen || isThemeOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen, isThemeOpen]);

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

  // Info header per tab aktif
  const tabTitles: Record<string, { title: string; subtitle: string }> = {
    plotingan: {
      title: 'Plotingan Manpower',
      subtitle: 'Target Kebutuhan & Permintaan H-1',
    },
    masuk: {
      title: 'Absen Masuk',
      subtitle: 'Serah Terima Fisik & Distribusi PIC',
    },
    tumbang: {
      title: 'Live Tumbang',
      subtitle: 'Monitoring Realtime & Laporan Cepat WhatsApp',
    },
    pulang: {
      title: 'Absen Pulang',
      subtitle: 'Checkout Lapangan & Rekonsiliasi Terpadu',
    },
    laporan: {
      title: 'Laporan & Rekapitulasi',
      subtitle: 'Validasi Invoice & Matriks Operasional',
    },
  };

  const currentInfo = tabTitles[activeTab] || tabTitles.plotingan;

  return (
    <header className={`sticky top-0 z-20 border-b px-4 sm:px-6 py-3 shadow-sm transition-colors ${
      theme === 'navy'
        ? 'bg-slate-950 md:bg-gradient-to-r md:from-blue-900 md:to-indigo-950 text-white border-slate-800 md:border-blue-800'
        : theme === 'soft'
        ? 'bg-white text-slate-900 border-slate-200'
        : theme === 'dark'
        ? 'bg-slate-900 text-white border-slate-800'
        : 'bg-slate-900 md:bg-white text-white md:text-slate-900 border-slate-800 md:border-slate-200'
    }`}>
      <div className="flex items-center justify-between gap-3">
        
        {/* SISI KIRI: HAMBURGER DI HP & JUDUL DI LAPTOP */}
        <div className="flex items-center gap-3">
          
          {/* Tombol Hamburger Khusus HP */}
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            title="Buka Menu Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo Brand di Mobile Header */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-xs">
              <Warehouse className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-white">Absensi</span>
              <p className="text-[10px] text-slate-400 font-medium">Control</p>
            </div>
          </div>

          {/* Judul Tab Aktif di Laptop / PC */}
          <div className="hidden md:block">
            <div className="flex items-center gap-2.5">
              <h1 className={`text-lg font-black tracking-tight ${
                theme === 'navy' || theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                {currentInfo.title}
              </h1>
              <span className={`text-[11px] font-bold border px-2 py-0.5 rounded-full ${
                theme === 'navy'
                  ? 'bg-blue-800 text-blue-200 border-blue-700'
                  : theme === 'dark'
                  ? 'bg-slate-800 text-sky-400 border-slate-700'
                  : 'bg-sky-50 text-sky-700 border border-sky-200'
              }`}>
                Operasional
              </span>
            </div>
            <p className={`text-xs font-medium mt-0.5 ${
              theme === 'navy' ? 'text-blue-200' : theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {currentInfo.subtitle}
            </p>
          </div>
        </div>

        {/* SISI KANAN: THEME SWITCHER & PEMILIH TANGGAL */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Tombol Pemilih Tema */}
          {setTheme && (
            <div className="relative" ref={themeRef}>
              <button
                type="button"
                onClick={() => setIsThemeOpen(!isThemeOpen)}
                className="flex items-center gap-1.5 bg-slate-800 md:bg-slate-50 hover:bg-slate-750 md:hover:bg-slate-100 border border-slate-700 md:border-slate-300 rounded-xl px-2.5 py-1.5 shadow-xs transition-all cursor-pointer"
                title="Pilih Tema Warna"
              >
                <Palette className="w-4 h-4 text-sky-400 md:text-sky-600" />
                <span className="hidden sm:inline text-xs font-bold text-white md:text-slate-800">
                  {theme === 'original' ? 'Asli' : theme === 'navy' ? 'Navy' : theme === 'soft' ? 'Soft' : 'Dark'}
                </span>
              </button>

              {/* Popover Menu 4 Pilihan Tema */}
              {isThemeOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 text-xs text-white">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                    <span className="font-extrabold text-xs text-slate-300">Pilih Tema Tampilan</span>
                    <span className="text-[10px] text-sky-400 font-mono">4 Tema</span>
                  </div>

                  <div className="space-y-1.5">
                    {THEME_OPTIONS.map((item) => {
                      const isSelected = theme === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setTheme(item.id);
                            setIsThemeOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl transition-all text-left cursor-pointer ${
                            isSelected
                              ? 'bg-slate-800 text-white border border-sky-500/50 shadow-xs'
                              : 'hover:bg-slate-800/60 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex -space-x-1">
                              {item.colors.map((c, i) => (
                                <span key={i} className={`w-3.5 h-3.5 rounded-full border border-slate-900 ${c}`} />
                              ))}
                            </div>
                            <div>
                              <strong className="block text-xs font-bold leading-tight">{item.name}</strong>
                              <span className="text-[10px] text-slate-400">{item.subtitle}</span>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PEMILIH TANGGAL (CUSTOM POPOVER DENGAN DOT PENANDA DATA) */}
          <div className="relative" ref={calendarRef}>
            <button
              type="button"
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              className="flex items-center gap-2 bg-slate-800 md:bg-slate-50 hover:bg-slate-750 md:hover:bg-slate-100 border border-slate-700 md:border-slate-300 rounded-xl px-3 py-1.5 shadow-xs transition-all cursor-pointer group"
              title="Pilih tanggal kerja (Titik hijau menandakan ada rekaman data)"
            >
              <CalendarIcon className="w-4 h-4 text-sky-400 md:text-sky-600 group-hover:scale-105 transition-transform" />
              <span className="text-xs sm:text-sm font-bold text-white md:text-slate-800 tracking-wide">
                {formatLocalDateString(selectedDate)}
              </span>
              {datesWithData.includes(selectedDate) && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 md:bg-emerald-500 shadow-sm animate-pulse" title="Hari ini memiliki data operasional" />
              )}
            </button>

          {/* Custom Interactive Calendar Popover */}
          {isCalendarOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 text-xs text-slate-200">
              {/* Header Kalender */}
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

      </div>
    </header>
  );
}

