'use client';

// ============================================================================
// KOMPONEN SIDEBAR KIRI (DESKTOP) & MOBILE DRAWER (HP)
// Menyediakan navigasi vertikal bersih, profesional (gaya B2B), tanpa kata "Fase"
// dan tanpa penomoran kaku, tetap mempertahankan motif asli aplikasi.
// ============================================================================

import React from 'react';
import { 
  ClipboardList, 
  LogIn, 
  LogOut, 
  FileSpreadsheet, 
  Warehouse, 
  AlertCircle,
  X
} from 'lucide-react';

interface SidebarProps {
  activeTab: 'plotingan' | 'masuk' | 'tumbang' | 'pulang' | 'laporan';
  setActiveTab: (tab: 'plotingan' | 'masuk' | 'tumbang' | 'pulang' | 'laporan') => void;
  tumbangCount?: number;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  tumbangCount = 0,
  isMobileOpen,
  setIsMobileOpen,
}: SidebarProps) {
  
  const navItems = [
    {
      id: 'plotingan' as const,
      label: 'Plotingan',
      sublabel: 'Target Manpower H-1',
      icon: ClipboardList,
    },
    {
      id: 'masuk' as const,
      label: 'Absen Masuk',
      sublabel: 'Serah Terima & Distribusi',
      icon: LogIn,
    },
    {
      id: 'tumbang' as const,
      label: 'Live Tumbang',
      sublabel: 'Insiden & Drop Fisik',
      icon: AlertCircle,
      badge: tumbangCount > 0 ? tumbangCount : undefined,
    },
    {
      id: 'pulang' as const,
      label: 'Absen Pulang',
      sublabel: 'Checkout & Rekonsiliasi',
      icon: LogOut,
    },
    {
      id: 'laporan' as const,
      label: 'Laporan',
      sublabel: 'Rekapitulasi & Tagihan',
      icon: FileSpreadsheet,
    },
  ];

  const handleSelectTab = (tab: 'plotingan' | 'masuk' | 'tumbang' | 'pulang' | 'laporan') => {
    setActiveTab(tab);
    setIsMobileOpen(false);
  };

  const SidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      {/* 1. BRANDING & LOGO (Motif Asli Dijaga) */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-md shrink-0">
            <Warehouse className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-sky-300 bg-clip-text text-transparent">
                Absensi
              </span>
              <span className="text-[10px] bg-sky-500/20 text-sky-300 font-bold px-2 py-0.5 rounded-full border border-sky-500/30">
                Control
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Central Gateway Logistik
            </p>
          </div>
        </div>

        {/* Tombol Tutup di Mobile Drawer */}
        <button
          type="button"
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Tutup Menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. MENU NAVIGASI VERTIKAL BERSIH (Tanpa Kata 'Fase' & Bebas Norak) */}
      <nav className="flex-1 p-3.5 space-y-1.5 overflow-y-auto">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1">
          Menu Operasional
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer group ${
                isActive
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 font-extrabold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent font-semibold'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-5 h-5 shrink-0 transition-colors ${
                  isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-white'
                }`} />
                <div className="truncate">
                  <div className="text-sm tracking-tight leading-tight">{item.label}</div>
                  <div className="text-[10px] text-slate-500 group-hover:text-slate-400 font-normal leading-tight mt-0.5 truncate">
                    {item.sublabel}
                  </div>
                </div>
              </div>

              {/* Badge Jumlah Insiden untuk Live Tumbang */}
              {item.badge !== undefined && (
                <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-sm shrink-0">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 3. STATUS SISTEM BAWAH */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold text-slate-300">Sistem Online</span>
        </div>
        <span className="text-[10px] text-slate-500">v2.5 Pro</span>
      </div>
    </div>
  );

  return (
    <>
      {/* A. DESKTOP PERMANENT SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white min-h-screen border-r border-slate-800 sticky top-0 h-screen shrink-0 z-30">
        {SidebarContent}
      </aside>

      {/* B. MOBILE SLIDE-OVER DRAWER (MELUNCUR DARI KIRI SAAT HAMBURGER DITEKAN) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop gelap */}
          <div 
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in"
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-250">
            {SidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

