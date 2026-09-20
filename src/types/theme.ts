// Definisi tipe tema tampilan di LogiFlow
export type AppTheme = 'original' | 'navy' | 'soft' | 'dark';

export interface ThemeOption {
  id: AppTheme;
  name: string;
  subtitle: string;
  badge?: string;
  colors: string[];
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'original',
    name: 'Motif Asli',
    subtitle: 'Clean White & Slate Navy',
    badge: 'Default',
    colors: ['bg-slate-900', 'bg-sky-500', 'bg-white'],
  },
  {
    id: 'navy',
    name: 'Royal Blue & White',
    subtitle: 'Corporate Logistik',
    colors: ['bg-blue-700', 'bg-indigo-900', 'bg-white'],
  },
  {
    id: 'soft',
    name: 'Soft Minimalist',
    subtitle: 'Serba Terang & Bersih',
    colors: ['bg-slate-100', 'bg-emerald-500', 'bg-white'],
  },
  {
    id: 'dark',
    name: 'Dark Obsidian',
    subtitle: 'Futuristik High-Tech',
    colors: ['bg-slate-950', 'bg-slate-900', 'bg-sky-400'],
  },
];

