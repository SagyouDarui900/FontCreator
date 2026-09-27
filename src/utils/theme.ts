export type ThemeMode = 'light' | 'dark' | 'sepia' | 'warm' | 'nord' | 'monochrome';

export interface ThemePreset {
  id: ThemeMode;
  name: string;
  badge: string;
  badgeClass: string;
  description: string;
  base: 'light' | 'dark';
  previewBg: string;
  previewBorder: string;
  previewCard: string;
  previewAccent: string;
}

export interface ThemeClasses {
  appBg: string;
  headerBg: string;
  sidebarBg: string;
  toolbarBg: string;
  cardBg: string;
  modalBg: string;
  subtoolbarBg: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  accentBtn: string;
  activeTool: string;
  activeToolHover: string;
  accentText: string;
  accentBorder: string;
  accentBadge: string;
  canvasOuterBg: string;
  canvasBgHex: string;
  accentHex: string;
  selectionStroke: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'light',
    name: '標準ライト (白・翡翠)',
    badge: '標準',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700',
    description: '明るく清潔な和紙・抹茶テイストの標準明色',
    base: 'light',
    previewBg: '#f7faf8',
    previewBorder: '#d1fae5',
    previewCard: '#ffffff',
    previewAccent: '#059669',
  },
  {
    id: 'dark',
    name: '夜間ダーク (深碧・墨黒)',
    badge: '夜間',
    badgeClass: 'bg-emerald-950 text-emerald-200 border-emerald-800',
    description: 'まぶしさを抑えた夜間向け暗色テーマ',
    base: 'dark',
    previewBg: '#0f1712',
    previewBorder: '#1f2d24',
    previewCard: '#16221a',
    previewAccent: '#10b981',
  },
  {
    id: 'sepia',
    name: 'セピア (和紙調)',
    badge: '長時間作業',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
    description: '和紙風の淡い茶褐色テーマ。コントラストを抑えた配色',
    base: 'light',
    previewBg: '#f4ede2',
    previewBorder: '#d9caaf',
    previewCard: '#faf5eb',
    previewAccent: '#a16207',
  },
  {
    id: 'warm',
    name: 'ブルーライト低減 (暖色)',
    badge: '画面保護',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800',
    description: '青色光を低減した暖色系テーマ',
    base: 'light',
    previewBg: '#fbf3e8',
    previewBorder: '#ebcfb2',
    previewCard: '#fffdf7',
    previewAccent: '#ea580c',
  },
  {
    id: 'nord',
    name: '北欧フロスト (クールグレイ・藍)',
    badge: '低彩度暗色',
    badgeClass: 'bg-slate-800 text-cyan-200 border-slate-600',
    description: '極北の雪夜をイメージした静寂な青緑系ダーク。低コントラストで刺激軽減',
    base: 'dark',
    previewBg: '#2e3440',
    previewBorder: '#434c5e',
    previewCard: '#3b4252',
    previewAccent: '#88c0d0',
  },
  {
    id: 'monochrome',
    name: '高コントラスト・白黒 (純白・漆黒)',
    badge: '精密チェック',
    badgeClass: 'bg-stone-200 text-stone-900 border-stone-400 dark:bg-stone-800 dark:text-stone-100 dark:border-stone-600',
    description: '一切の余計な色味を廃した高コントラストモノクロ。線幅やアンカーの点検に',
    base: 'light',
    previewBg: '#f4f4f5',
    previewBorder: '#a1a1aa',
    previewCard: '#ffffff',
    previewAccent: '#18181b',
  },
];

export function getThemePreset(mode: ThemeMode): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === mode) || THEME_PRESETS[0];
}

export function isLightTheme(mode: ThemeMode): boolean {
  const preset = getThemePreset(mode);
  return preset.base === 'light';
}

export function getThemeClasses(mode: ThemeMode = 'light'): ThemeClasses {
  switch (mode) {
    case 'sepia':
      return {
        appBg: 'bg-[#f4ede2] text-[#3d2b1f]',
        headerBg: 'bg-[#eae1d2] text-[#3d2b1f] border-[#d9caaf] shadow-xs',
        sidebarBg: 'bg-[#ede3d4] text-[#3d2b1f] border-[#d9caaf]',
        toolbarBg: 'bg-[#eae1d2] text-[#3d2b1f] border-[#d9caaf]',
        cardBg: 'bg-[#faf5eb] text-[#3d2b1f] border-[#d9caaf]',
        modalBg: 'bg-[#f7f0e4] text-[#3d2b1f] border-[#d9caaf]',
        subtoolbarBg: 'bg-[#eae1d2]/90 text-[#3d2b1f] border-[#d9caaf]',
        border: 'border-[#d9caaf]',
        textPrimary: 'text-[#3d2b1f]',
        textMuted: 'text-[#735641]',
        accentBtn: 'bg-[#854d0e] hover:bg-[#713f12] text-amber-50',
        activeTool: 'bg-[#854d0e] text-amber-50 shadow-sm font-bold ring-2 ring-[#854d0e]/40',
        activeToolHover: 'hover:bg-[#f3e7d3] text-[#3d2b1f]',
        accentText: 'text-[#854d0e]',
        accentBorder: 'border-[#854d0e]',
        accentBadge: 'bg-amber-100 text-amber-900 border-amber-300',
        canvasOuterBg: 'bg-[#e8ddcb]',
        canvasBgHex: '#e8ddcb',
        accentHex: '#854d0e',
        selectionStroke: '#b45309',
      };
    case 'warm':
      return {
        appBg: 'bg-[#fbf3e8] text-[#431407]',
        headerBg: 'bg-[#f5e7d5] text-[#431407] border-[#ebcfb2] shadow-xs',
        sidebarBg: 'bg-[#f7e8d6] text-[#431407] border-[#ebcfb2]',
        toolbarBg: 'bg-[#f5e7d5] text-[#431407] border-[#ebcfb2]',
        cardBg: 'bg-[#fffdf7] text-[#431407] border-[#ebcfb2]',
        modalBg: 'bg-[#faf0e1] text-[#431407] border-[#ebcfb2]',
        subtoolbarBg: 'bg-[#f5e7d5]/90 text-[#431407] border-[#ebcfb2]',
        border: 'border-[#ebcfb2]',
        textPrimary: 'text-[#431407]',
        textMuted: 'text-[#7c2d12]',
        accentBtn: 'bg-[#ea580c] hover:bg-[#c2410c] text-orange-50',
        activeTool: 'bg-[#ea580c] text-orange-50 shadow-sm font-bold ring-2 ring-[#ea580c]/40',
        activeToolHover: 'hover:bg-[#fce7d0] text-[#431407]',
        accentText: 'text-[#ea580c]',
        accentBorder: 'border-[#ea580c]',
        accentBadge: 'bg-orange-100 text-orange-900 border-orange-300',
        canvasOuterBg: 'bg-[#f3e3ce]',
        canvasBgHex: '#f3e3ce',
        accentHex: '#ea580c',
        selectionStroke: '#ea580c',
      };
    case 'nord':
      return {
        appBg: 'dark bg-[#2e3440] text-[#eceff4]',
        headerBg: 'bg-[#242933] text-[#eceff4] border-[#434c5e] shadow-xs',
        sidebarBg: 'bg-[#2e3440] text-[#eceff4] border-[#434c5e]',
        toolbarBg: 'bg-[#242933] text-[#eceff4] border-[#434c5e]',
        cardBg: 'bg-[#3b4252] text-[#eceff4] border-[#434c5e]',
        modalBg: 'bg-[#2e3440] text-[#eceff4] border-[#434c5e]',
        subtoolbarBg: 'bg-[#242933]/90 text-[#eceff4] border-[#434c5e]',
        border: 'border-[#434c5e]',
        textPrimary: 'text-[#eceff4]',
        textMuted: 'text-[#d8dee9]/80',
        accentBtn: 'bg-[#5e81ac] hover:bg-[#81a1c1] text-white',
        activeTool: 'bg-[#88c0d0] text-[#2e3440] shadow-sm font-bold ring-2 ring-[#88c0d0]/40',
        activeToolHover: 'hover:bg-[#3b4252] text-[#88c0d0]',
        accentText: 'text-[#88c0d0]',
        accentBorder: 'border-[#88c0d0]',
        accentBadge: 'bg-[#3b4252] text-[#88c0d0] border-[#5e81ac]',
        canvasOuterBg: 'bg-[#1d212a]',
        canvasBgHex: '#1d212a',
        accentHex: '#88c0d0',
        selectionStroke: '#88c0d0',
      };
    case 'monochrome':
      return {
        appBg: 'bg-[#f4f4f5] text-[#09090b]',
        headerBg: 'bg-white text-[#09090b] border-[#a1a1aa] shadow-xs',
        sidebarBg: 'bg-white text-[#09090b] border-[#a1a1aa]',
        toolbarBg: 'bg-white text-[#09090b] border-[#a1a1aa]',
        cardBg: 'bg-white text-[#09090b] border-[#a1a1aa]',
        modalBg: 'bg-white text-[#09090b] border-[#a1a1aa]',
        subtoolbarBg: 'bg-stone-100/90 text-[#09090b] border-[#a1a1aa]',
        border: 'border-[#a1a1aa]',
        textPrimary: 'text-[#09090b]',
        textMuted: 'text-[#3f3f46]',
        accentBtn: 'bg-[#18181b] hover:bg-black text-white dark:bg-white dark:hover:bg-stone-200 dark:text-black',
        activeTool: 'bg-stone-900 text-white shadow-sm font-bold ring-2 ring-stone-900/30 dark:bg-white dark:text-stone-950',
        activeToolHover: 'hover:bg-stone-200 text-stone-900',
        accentText: 'text-stone-900 dark:text-stone-100',
        accentBorder: 'border-stone-900 dark:border-stone-100',
        accentBadge: 'bg-stone-200 text-stone-900 border-stone-400',
        canvasOuterBg: 'bg-[#e4e4e7]',
        canvasBgHex: '#e4e4e7',
        accentHex: '#18181b',
        selectionStroke: '#18181b',
      };
    case 'dark':
      return {
        appBg: 'dark bg-[#0f1712] text-emerald-100',
        headerBg: 'bg-[#121914] text-emerald-100 border-[#222e25] shadow-xs',
        sidebarBg: 'bg-[#141d16] text-emerald-100 border-[#222e25]',
        toolbarBg: 'bg-[#121914] text-emerald-100 border-[#222e25]',
        cardBg: 'bg-[#16221a] text-emerald-100 border-[#222e25]',
        modalBg: 'bg-[#141d16] text-emerald-100 border-[#222e25]',
        subtoolbarBg: 'bg-[#121914]/90 text-emerald-100 border-[#222e25]',
        border: 'border-[#222e25]',
        textPrimary: 'text-emerald-100',
        textMuted: 'text-emerald-400/70',
        accentBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white',
        activeTool: 'bg-emerald-500 text-stone-950 shadow-sm font-bold ring-2 ring-emerald-400/30',
        activeToolHover: 'hover:bg-[#1d2720] text-emerald-200',
        accentText: 'text-emerald-400',
        accentBorder: 'border-emerald-500',
        accentBadge: 'bg-emerald-950 text-emerald-200 border-emerald-800',
        canvasOuterBg: 'bg-[#0a110d]',
        canvasBgHex: '#0a110d',
        accentHex: '#10b981',
        selectionStroke: '#10b981',
      };
    case 'light':
    default:
      return {
        appBg: 'bg-[#f7faf8] text-stone-900',
        headerBg: 'bg-white text-stone-800 border-stone-200 shadow-xs',
        sidebarBg: 'bg-white text-stone-800 border-stone-200',
        toolbarBg: 'bg-white text-stone-800 border-stone-200',
        cardBg: 'bg-white text-stone-800 border-stone-200',
        modalBg: 'bg-white text-stone-900 border-stone-200',
        subtoolbarBg: 'bg-white/90 text-stone-800 border-stone-200',
        border: 'border-stone-200',
        textPrimary: 'text-stone-900',
        textMuted: 'text-stone-500',
        accentBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        activeTool: 'bg-emerald-700 text-white shadow-sm font-bold ring-2 ring-emerald-600/30',
        activeToolHover: 'hover:bg-stone-200/80 text-stone-950',
        accentText: 'text-emerald-700 dark:text-emerald-400',
        accentBorder: 'border-emerald-500',
        accentBadge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        canvasOuterBg: 'bg-[#eef5f1]',
        canvasBgHex: '#eef5f1',
        accentHex: '#059669',
        selectionStroke: '#059669',
      };
  }
}
