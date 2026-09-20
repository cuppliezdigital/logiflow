'use client';

// ============================================================================
// KOMPONEN BOTTOM NAVIGATION BAR KHUSUS HP (MOBILE-FIRST)
// Memungkinkan kru lapangan / PIC berganti tab operasional hanya dengan satu
// sentuhan jempol tanpa perlu repot membuka menu samping.
// ============================================================================

import React from 'react';
import { 
  ClipboardList, 
  LogIn, 
  LogOut, 
  FileSpreadsheet, 
  AlertCircle 
} from 'lucide-react';
import { AppTheme } from '@/types/theme';

interface MobileBottomNavProps {
  activeTab: 'plotingan' | 'masuk' | 'tumbang' | 'pulang' | 'laporan';
  setActiveTab: (tab: 'plotingan' | 'masuk' | 'tumbang' | 'pulang' | 'laporan') => void;
  tumbangCount?: number;
  theme?: AppTheme;
}

export default function MobileBottomNav({
  activeTab,
  setActiveTab,
  tumbangCount = 0,
  theme = 'original',
}: MobileBottomNavProps) {
  
  const navItems = [
    { id: 'plotingan' as const, label: 'Plotingan', icon: ClipboardList },
    { id: 'masuk' as const, label: 'Masuk', icon: LogIn },
    { id: 'tumbang' as const, label: 'Tumbang', icon: AlertCircle, badge: tumbangCount > 0 ? tumbangCount : undefined },
    { id: 'pulang' as const, label: 'Pulang', icon: LogOut },
    { id: 'laporan' as const, label: 'Laporan', icon: FileSpreadsheet },
  ];

  const navBg = 
    theme === 'navy'
      ? 'bg-slate-950/95 border-blue-900/70 text-slate-300'
      : theme === 'soft'
      ? 'bg-white/95 border-slate-200 text-slate-600 shadow-xl'
      : theme === 'dark'
      ? 'bg-slate-950/95 border-slate-800 text-slate-400'
      : 'bg-slate-900/95 border-slate-800 text-slate-400';

  const activeColor =
    theme === 'navy'
      ? 'text-blue-400'
      : theme === 'soft'
      ? 'text-emerald-600'
      : 'text-sky-400';

  return (
    <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-30 backdrop-blur-md border-t px-2 py-1.5 shadow-2xl flex items-center justify-around safe-bottom ${navBg}`}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer relative ${
              isActive
                ? `${activeColor} font-extrabold`
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 transition-transform ${isActive ? `scale-110 ${activeColor}` : 'text-slate-400'}`} />
              {item.badge !== undefined && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-xs">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight leading-none">
              {item.label}
            </span>
            {isActive && (
              <span className={`w-1 h-1 rounded-full mt-0.5 ${
                theme === 'navy' ? 'bg-blue-400' : theme === 'soft' ? 'bg-emerald-600' : 'bg-sky-400'
              }`}></span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

