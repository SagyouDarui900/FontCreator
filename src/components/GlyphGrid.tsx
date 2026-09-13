import React, { useState, useMemo, useCallback, memo, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Copy,
  Clipboard,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  CheckCircle2,
  CircleDashed,
  Sliders,
  MoreHorizontal,
  Wand2,
  ArrowLeftRight,
  ShieldCheck,
} from 'lucide-react';
import { FontProject, GlyphData } from '../types';
import { UNICODE_CATEGORIES, getCategoryCharList, KANA_PAIRS } from '../data/unicodeTables';
import { DAKUTEN_MAPPINGS } from '../utils/dakutenHelper';
import { contoursToSvgPath, normalizeGlyphContoursWinding } from '../utils/pathUtils';
import { ThemeMode } from '../utils/theme';

interface GlyphGridProps {
  project: FontProject;
  selectedUnicode: number;
  onSelectGlyph: (unicode: number, char: string) => void;
  onClearGlyph: (unicode: number) => void;
  onCopyGlyph: (unicode: number) => void;
  onPasteGlyph: (unicode: number) => void;
  onDuplicateAsSmallKana?: (sourceUnicode: number) => void;
  onGenerateDakutenTarget?: (targetChar: string, isHandakuten: boolean) => void;
  onOpenGlyphSynthesisModal?: () => void;
  onOpenKerningModal?: () => void;
  onOpenQualityModal?: () => void;
  hasClipboard: boolean;
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
  isOverlay?: boolean;
}

type GridDensity = 'large' | 'medium' | 'compact';

interface ContextMenuState {
  x: number;
  y: number;
  item: { char: string; code: number; name?: string };
}

// Memoized individual glyph card for clean display, zero overflow, and instant selection
const GlyphGridCard = memo(
  ({
    item,
    isSelected,
    glyphData,
    isLight,
    density,
    onSelectGlyph,
    onContextMenu,
  }: {
    item: { char: string; code: number; name?: string };
    isSelected: boolean;
    glyphData?: GlyphData;
    isLight: boolean;
    density: GridDensity;
    onSelectGlyph: (code: number, char: string) => void;
    onContextMenu: (e: React.MouseEvent, item: { char: string; code: number; name?: string }) => void;
  }) => {
    const hasContours = Boolean(glyphData && glyphData.contours && glyphData.contours.length > 0);
    const strokeCount = glyphData?.contours?.length || 0;
    const svgPath = useMemo(() => {
      if (!hasContours || !glyphData?.contours) return null;
      return contoursToSvgPath(normalizeGlyphContoursWinding(glyphData.contours));
    }, [hasContours, glyphData?.contours]);

    const pair = KANA_PAIRS[item.char];
    const dakutenInfo = DAKUTEN_MAPPINGS[item.char];

    // Explicit card height and font sizing to prevent CSS Grid row track collapse and overlapping
    const cardDimensionClass =
      density === 'large'
        ? 'h-[92px] min-h-[92px]'
        : density === 'medium'
        ? 'h-[76px] min-h-[76px]'
        : 'h-[62px] min-h-[62px]';

    const fallbackFontSize =
      density === 'large'
        ? 'text-3xl'
        : density === 'medium'
        ? 'text-2xl'
        : 'text-lg';

    return (
      <div
        onClick={() => onSelectGlyph(item.code, item.char)}
        onContextMenu={(e) => onContextMenu(e, item)}
        title={`「${item.char}」 U+${item.code.toString(16).toUpperCase().padStart(4, '0')} (${item.code})${
          hasContours ? ` · 作成済 (${strokeCount}画)` : ' · 未作成'
        } - 右クリックでメニュー`}
        className={`group relative flex flex-col items-center justify-between p-1 rounded-lg border w-full ${cardDimensionClass} cursor-pointer transition-all duration-150 select-none overflow-hidden ${
          isSelected
            ? isLight
              ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-600/40 shadow-xs z-10'
              : 'bg-emerald-950/80 border-emerald-400 ring-2 ring-emerald-500/40 shadow-xs z-10'
            : hasContours
            ? isLight
              ? 'bg-white border-emerald-300/80 text-stone-900 hover:border-emerald-500 hover:shadow-xs'
              : 'bg-[#18231c] border-emerald-700/70 text-emerald-100 hover:border-emerald-400'
            : isLight
            ? 'bg-stone-50/90 border-stone-200/90 text-stone-400 hover:border-emerald-300 hover:bg-white hover:text-stone-700'
            : 'bg-[#131b16] border-[#223126] text-emerald-600/60 hover:border-emerald-700 hover:text-emerald-300'
        }`}
      >
        {/* Subtle Manuscript Guide Crosshairs (升目十字ガイド) */}
        <div className="absolute inset-0 pointer-events-none opacity-10">
          <div className="absolute left-1/2 top-0 bottom-0 w-px border-r border-dashed border-current" />
          <div className="absolute top-1/2 left-0 right-0 h-px border-b border-dashed border-current" />
        </div>

        {/* Top Header: Unicode Hex code + Status indicator */}
        <div className="w-full flex items-center justify-between px-1 pt-0.5 z-10 leading-none shrink-0 gap-0.5">
          <span
            className={`font-mono text-[9px] tracking-tight truncate max-w-[80%] ${
              isSelected
                ? isLight
                  ? 'text-emerald-900 font-bold'
                  : 'text-emerald-300 font-bold'
                : hasContours
                ? isLight
                  ? 'text-emerald-800 font-semibold'
                  : 'text-emerald-400 font-semibold'
                : isLight
                ? 'text-stone-400'
                : 'text-emerald-800'
            }`}
          >
            {item.code.toString(16).toUpperCase().padStart(4, '0')}
          </span>

          {/* Status Indicator: Green dot if created, or subtle dash */}
          {hasContours ? (
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                isLight ? 'bg-emerald-600' : 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]'
              }`}
              title={`作成済 (${strokeCount}画)`}
            />
          ) : (
            <span className="inline-block w-1 h-1 rounded-full bg-stone-300 dark:bg-stone-700 opacity-30 shrink-0" />
          )}
        </div>

        {/* Single Center Character Display (Vector SVG if drawn, or Reference Glyph if undrawn) */}
        <div className="flex-1 flex items-center justify-center w-full min-h-0 min-w-0 overflow-hidden relative z-10 p-0.5 pointer-events-none">
          {hasContours && svgPath ? (
            <svg
              viewBox="0 0 1000 1000"
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full max-w-[88%] max-h-[88%] object-contain"
            >
              <path
                d={svgPath}
                fill={
                  isSelected
                    ? isLight
                      ? '#065f46'
                      : '#34d399'
                    : isLight
                    ? '#1f2937'
                    : '#ecfdf5'
                }
                stroke={
                  isSelected
                    ? isLight
                      ? '#047857'
                      : '#6ee7b7'
                    : isLight
                    ? '#374151'
                    : '#a7f3d0'
                }
                strokeWidth={1}
                fillRule="evenodd"
              />
            </svg>
          ) : item.code === 0x3000 ? (
            <div
              className={`text-[8px] sm:text-[9px] font-bold px-1 py-0.5 rounded border border-dashed text-center leading-tight whitespace-nowrap ${
                isSelected
                  ? isLight
                    ? 'bg-amber-200 border-amber-500 text-amber-950'
                    : 'bg-amber-900 border-amber-400 text-amber-100'
                  : isLight
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-amber-950/60 border-amber-700 text-amber-300'
              }`}
            >
              全角空白
            </div>
          ) : item.code === 0x0020 ? (
            <div
              className={`text-[8px] sm:text-[9px] font-bold px-1 py-0.5 rounded border border-dashed text-center leading-tight whitespace-nowrap ${
                isSelected
                  ? isLight
                    ? 'bg-sky-200 border-sky-500 text-sky-950'
                    : 'bg-sky-900 border-sky-400 text-sky-100'
                  : isLight
                  ? 'bg-sky-50 border-sky-300 text-sky-800'
                  : 'bg-sky-950/60 border-sky-700 text-sky-300'
              }`}
            >
              半角空白
            </div>
          ) : (
            <span
              className={`${fallbackFontSize} font-normal leading-none select-none transition-colors truncate ${
                isSelected
                  ? isLight
                    ? 'text-emerald-900 font-medium'
                    : 'text-emerald-200 font-medium'
                  : ''
              }`}
            >
              {item.char}
            </span>
          )}
        </div>

        {/* Bottom Bar: Mini badge if applicable */}
        <div className="w-full flex items-center justify-between px-1 pb-0.5 z-10 leading-none shrink-0 h-2.5">
          {hasContours ? (
            <span className="text-[8px] font-mono text-emerald-700 dark:text-emerald-400 font-bold opacity-80">
              {strokeCount}画
            </span>
          ) : dakutenInfo && dakutenInfo.type === 'seion' && dakutenInfo.daku ? (
            <span className="text-[7px] text-amber-600 dark:text-amber-400 font-semibold opacity-60">
              濁
            </span>
          ) : pair ? (
            <span className="text-[7px] text-indigo-500 dark:text-indigo-400 font-semibold opacity-60">
              小
            </span>
          ) : (
            <span />
          )}

          {/* Context menu hint on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu(e, item);
            }}
            title="メニューを開く"
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-stone-300/40 dark:hover:bg-stone-700/40 text-stone-500 dark:text-stone-400 transition-opacity"
          >
            <MoreHorizontal className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    );
  }
);

export const GlyphGrid: React.FC<GlyphGridProps> = memo(({
  project,
  selectedUnicode,
  onSelectGlyph,
  onClearGlyph,
  onCopyGlyph,
  onPasteGlyph,
  onDuplicateAsSmallKana,
  onGenerateDakutenTarget,
  onOpenGlyphSynthesisModal,
  onOpenKerningModal,
  onOpenQualityModal,
  hasClipboard,
  isOpen,
  onClose,
  theme,
  isOverlay,
}) => {
  const effectiveIsOverlay = isOverlay !== undefined ? isOverlay : false;
  const [activeCategoryId, setActiveCategoryId] = useState<string>('hiragana');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [customCharInput, setCustomCharInput] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [gridDensity, setGridDensity] = useState<GridDensity>('medium');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Resizable sidebar width with LocalStorage persistence
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('fontforge_sidebar_width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 200 && val <= 800) {
          return val;
        }
      }
    } catch (_) {}
    return 330;
  });
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);

  // Drag resizer handler for left sidebar
  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const minW = 220;
      const maxW = Math.min(window.innerWidth * 0.65, 750);
      const newWidth = Math.max(minW, Math.min(maxW, Math.round(startWidth + delta)));
      setSidebarWidth(newWidth);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      setIsResizing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      const delta = upEvent.clientX - startX;
      const minW = 220;
      const maxW = Math.min(window.innerWidth * 0.65, 750);
      const finalWidth = Math.max(minW, Math.min(maxW, Math.round(startWidth + delta)));
      try {
        localStorage.setItem('fontforge_sidebar_width', String(finalWidth));
      } catch (_) {}
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const isLight = theme === 'light';
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  const activeCategory = useMemo(() => {
    return UNICODE_CATEGORIES.find((c) => c.id === activeCategoryId) || UNICODE_CATEGORIES[0];
  }, [activeCategoryId]);

  // Compute character list for current category
  const rawCategoryList = useMemo(() => {
    if (activeCategoryId === 'modified') {
      const glyphs = Object.values(project.glyphs) as GlyphData[];
      return glyphs.map((g) => ({
        char: g.char || String.fromCodePoint(g.unicode),
        code: g.unicode,
        name: `U+${g.unicode.toString(16).toUpperCase().padStart(4, '0')}`,
      }));
    }
    return getCategoryCharList(activeCategory);
  }, [activeCategory, activeCategoryId, project.glyphs]);

  // Category completion statistics
  const categoryStats = useMemo(() => {
    const total = rawCategoryList.length;
    let completed = 0;
    for (const item of rawCategoryList) {
      const g = project.glyphs[item.code];
      if (g && g.contours && g.contours.length > 0) {
        completed++;
      }
    }
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  }, [rawCategoryList, project.glyphs]);

  // Filtered by search & status
  const charList = useMemo(() => {
    let list = rawCategoryList;

    // Apply status filter
    if (statusFilter === 'completed') {
      list = list.filter((item) => {
        const g = project.glyphs[item.code];
        return g && g.contours && g.contours.length > 0;
      });
    } else if (statusFilter === 'pending') {
      list = list.filter((item) => {
        const g = project.glyphs[item.code];
        return !g || !g.contours || g.contours.length === 0;
      });
    }

    if (!searchQuery.trim()) {
      return list;
    }

    const query = searchQuery.trim().toLowerCase();
    return list.filter((item) => {
      const hex = item.code.toString(16).toLowerCase();
      const uHex = `u+${hex}`;
      const char = item.char.toLowerCase();
      const name = (item.name || '').toLowerCase();
      return (
        char.includes(query) ||
        hex.includes(query) ||
        uHex.includes(query) ||
        name.includes(query) ||
        (query === '全角' && (item.code === 0x3000 || (item.code >= 0xff01 && item.code <= 0xff5e))) ||
        (query === '空白' && (item.code === 0x3000 || item.code === 0x0020)) ||
        (query === 'スペース' && (item.code === 0x3000 || item.code === 0x0020))
      );
    });
  }, [rawCategoryList, statusFilter, searchQuery, project.glyphs]);

  // Dynamic page size: Keep single-page view for Hiragana, Katakana, Latin, Grade 1 Kanji
  const pageSize = useMemo(() => {
    if (charList.length <= 120) {
      return 150; // Show all on one page for complete overview
    }
    return gridDensity === 'large' ? 90 : gridDensity === 'medium' ? 120 : 150;
  }, [charList.length, gridDensity]);

  const totalPages = Math.max(1, Math.ceil(charList.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);

  const paginatedList = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return charList.slice(start, start + pageSize);
  }, [charList, validPage, pageSize]);

  const handleAddCustomChar = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customCharInput.trim();
    if (!trimmed) return;
    const char = [...trimmed][0];
    const code = char ? (char.codePointAt(0) ?? 0) : 0;
    if (code > 0) {
      onSelectGlyph(code, char);
    }
    setCustomCharInput('');
    if (window.innerWidth < 640) {
      onClose();
    }
  };

  const handleOpenContextMenu = useCallback(
    (
      e: React.MouseEvent,
      item: { char: string; code: number; name?: string }
    ) => {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setContextMenu({
        x: Math.min(window.innerWidth - 220, Math.max(10, rect.left)),
        y: Math.min(window.innerHeight - 240, Math.max(10, rect.bottom + 4)),
        item,
      });
    },
    []
  );

  const handleCardSelect = useCallback(
    (c: number, ch: string) => {
      onSelectGlyph(c, ch);
      if (window.innerWidth < 640) {
        onClose();
      }
    },
    [onSelectGlyph, onClose]
  );

  const modifiedCount = Object.keys(project.glyphs).length;
  const currentSelectedGlyph = project.glyphs[selectedUnicode];
  const currentSelectedHasContours = Boolean(
    currentSelectedGlyph && currentSelectedGlyph.contours && currentSelectedGlyph.contours.length > 0
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile/Overlay Backdrop */}
      {effectiveIsOverlay && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-35 animate-in fade-in duration-150"
        />
      )}

      <aside
        style={{
          width: effectiveIsOverlay ? undefined : `${sidebarWidth}px`,
        }}
        className={`${
          effectiveIsOverlay
            ? 'fixed inset-y-0 left-0 z-40 w-full sm:w-80 md:w-[340px] shadow-2xl animate-in slide-in-from-left duration-200'
            : 'relative z-10 shadow-none shrink-0'
        } border-r flex flex-col h-full select-none ${isResizing ? '' : 'transition-[width] duration-150'} ${
          isLight
            ? 'bg-[#f8faf9] border-[#d4e5dc] text-stone-800'
            : 'bg-[#141d17] border-[#25362b] text-emerald-100'
        }`}
      >
        {/* Left Sidebar Drag Resizer Handle */}
        {!effectiveIsOverlay && (
          <div
            onPointerDown={handleResizeStart}
            className={`absolute top-0 right-0 w-2.5 h-full cursor-col-resize z-30 transition-colors flex items-center justify-center group ${
              isResizing ? 'bg-emerald-500/40 select-none' : 'hover:bg-emerald-500/25'
            }`}
            title="左右にドラッグしてサイドバー幅を調整（ダブルクリックで330pxにリセット）"
            onDoubleClick={() => {
              setSidebarWidth(330);
              try {
                localStorage.setItem('fontforge_sidebar_width', '330');
              } catch (_) {}
            }}
          >
            <div
              className={`w-[3px] h-12 rounded-full transition-colors ${
                isResizing
                  ? 'bg-emerald-600 shadow-sm'
                  : 'bg-stone-300/80 dark:bg-stone-600/80 group-hover:bg-emerald-500'
              }`}
            />
          </div>
        )}

        {/* Header with Title, Count, Density Toggles and Close */}
        <div
          className={`p-2.5 sm:p-3 border-b flex flex-col space-y-2 shrink-0 ${
            isLight ? 'bg-[#edf5f1] border-[#d4e5dc]' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          {/* Row 1: Title, Count, Density control, and Collapse button */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center space-x-1.5 min-w-0">
              <span
                className={`text-xs font-bold uppercase tracking-wider truncate ${
                  isLight ? 'text-emerald-950' : 'text-emerald-300'
                }`}
              >
                文字一覧
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                  isLight
                    ? 'bg-emerald-200 text-emerald-950'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                {charList.length}字
              </span>
            </div>

            {/* Density switch and close button */}
            <div className="flex items-center space-x-1 shrink-0">
              {/* Width Presets (狭: 250px, 標: 330px, 広: 440px) */}
              {!effectiveIsOverlay && (
                <div
                  className={`hidden sm:flex items-center p-0.5 rounded border ${
                    isLight ? 'bg-white border-[#c8ded3]' : 'bg-[#101813] border-[#2d4034]'
                  }`}
                  title="サイドバーの幅プリセット（右端を直接ドラッグして任意幅に微調整も可能）"
                >
                  <button
                    onClick={() => {
                      setSidebarWidth(250);
                      try { localStorage.setItem('fontforge_sidebar_width', '250'); } catch (_) {}
                    }}
                    title="幅: 狭め (250px) - キャンバス重視"
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      sidebarWidth <= 270
                        ? isLight
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-emerald-500 text-stone-950 font-bold'
                        : isLight
                        ? 'text-stone-600 hover:text-emerald-800'
                        : 'text-emerald-400 hover:text-emerald-200'
                    }`}
                  >
                    狭
                  </button>
                  <button
                    onClick={() => {
                      setSidebarWidth(330);
                      try { localStorage.setItem('fontforge_sidebar_width', '330'); } catch (_) {}
                    }}
                    title="幅: 標準 (330px)"
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      sidebarWidth > 270 && sidebarWidth < 390
                        ? isLight
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-emerald-500 text-stone-950 font-bold'
                        : isLight
                        ? 'text-stone-600 hover:text-emerald-800'
                        : 'text-emerald-400 hover:text-emerald-200'
                    }`}
                  >
                    標
                  </button>
                  <button
                    onClick={() => {
                      setSidebarWidth(440);
                      try { localStorage.setItem('fontforge_sidebar_width', '440'); } catch (_) {}
                    }}
                    title="幅: 広め (440px) - 一覧性重視"
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      sidebarWidth >= 390
                        ? isLight
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-emerald-500 text-stone-950 font-bold'
                        : isLight
                        ? 'text-stone-600 hover:text-emerald-800'
                        : 'text-emerald-400 hover:text-emerald-200'
                    }`}
                  >
                    広
                  </button>
                </div>
              )}

              {/* Density Segmented Control */}
              <div
                className={`flex items-center p-0.5 rounded border ${
                  isLight ? 'bg-white border-[#c8ded3]' : 'bg-[#101813] border-[#2d4034]'
                }`}
              >
                <button
                  onClick={() => setGridDensity('large')}
                  title="大 (3列・見やすい)"
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    gridDensity === 'large'
                      ? isLight
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-emerald-500 text-stone-950 font-bold'
                      : isLight
                      ? 'text-stone-600 hover:text-emerald-800'
                      : 'text-emerald-400 hover:text-emerald-200'
                  }`}
                >
                  大
                </button>
                <button
                  onClick={() => setGridDensity('medium')}
                  title="中 (4列・標準)"
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    gridDensity === 'medium'
                      ? isLight
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-emerald-500 text-stone-950 font-bold'
                      : isLight
                      ? 'text-stone-600 hover:text-emerald-800'
                      : 'text-emerald-400 hover:text-emerald-200'
                  }`}
                >
                  中
                </button>
                <button
                  onClick={() => setGridDensity('compact')}
                  title="小 (5列・一覧性重視)"
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    gridDensity === 'compact'
                      ? isLight
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-emerald-500 text-stone-950 font-bold'
                      : isLight
                      ? 'text-stone-600 hover:text-emerald-800'
                      : 'text-emerald-400 hover:text-emerald-200'
                  }`}
                >
                  小
                </button>
              </div>

              <button
                onClick={onClose}
                className={`p-1.5 sm:px-2 sm:py-1 rounded text-xs font-semibold flex items-center gap-0.5 transition-all ${
                  isLight
                    ? 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                }`}
                title="文字一覧を収納して作図キャンバスを広げる"
              >
                <span className="hidden sm:inline">収納</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClose}
                className={`p-1 rounded sm:hidden ${
                  isLight ? 'text-stone-500 hover:bg-emerald-100' : 'text-emerald-400 hover:bg-[#202d24]'
                }`}
                title="閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Row 2: Category Dropdown & Quick jumping pills */}
          <div className="space-y-1.5">
            <select
              value={activeCategoryId}
              onChange={(e) => {
                setActiveCategoryId(e.target.value);
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className={`w-full border rounded-md px-2.5 py-1 text-xs font-bold focus:outline-none transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700 shadow-xs'
                  : 'bg-[#0f1712] border-[#2d4034] text-emerald-200 focus:border-emerald-500 shadow-xs'
              }`}
            >
              <option value="modified">作成済み ({modifiedCount}字)</option>
              <optgroup label="── かな ──">
                <option value="hiragana">ひらがな (86字)</option>
                <option value="katakana">カタカナ (90字)</option>
              </optgroup>
              <optgroup label="── 英数・記号 ──">
                <option value="basic_latin_alnum">半角英数 (62字)</option>
                <option value="ascii_symbols">半角記号 (33字)</option>
                <option value="fullwidth_alnum">全角英数 (62字)</option>
                <option value="symbols">和文約物・全角記号 (65字)</option>
                <option value="vertical_forms">縦書き約物・記号 (22字)</option>
              </optgroup>
              <optgroup label="── 小学校配当漢字 ──">
                <option value="grade1">小学1年漢字 (80字)</option>
                <option value="grade2">小学2年漢字 (160字)</option>
                <option value="grade3">小学3年漢字 (200字)</option>
                <option value="grade4">小学4年漢字 (202字)</option>
                <option value="grade5">小学5年漢字 (193字)</option>
                <option value="grade6">小学6年漢字 (191字)</option>
              </optgroup>
              <optgroup label="── JIS水準漢字 ──">
                <option value="jis_1">JIS第1水準漢字 (2,965字)</option>
                <option value="jis_2">JIS第2水準漢字 (3,390字)</option>
              </optgroup>
              <optgroup label="── その他 ──">
                <option value="halfwidth">半角カタカナ (63字)</option>
                <option value="gaiji">外字・私用領域 (64字)</option>
              </optgroup>
            </select>

            {/* Quick Category Jump Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-[10px]">
              {[
                { id: 'hiragana', label: 'ひらがな' },
                { id: 'katakana', label: 'カタカナ' },
                { id: 'grade1', label: '小1漢字' },
                { id: 'jis_1', label: 'JIS第1' },
                { id: 'basic_latin_alnum', label: '半角英数' },
                { id: 'symbols', label: '記号' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => {
                    setActiveCategoryId(pill.id);
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className={`px-2 py-0.5 rounded-full font-medium shrink-0 transition-colors ${
                    activeCategoryId === pill.id
                      ? isLight
                        ? 'bg-emerald-700 text-white font-bold shadow-xs'
                        : 'bg-emerald-500 text-stone-950 font-bold shadow-xs'
                      : isLight
                      ? 'bg-emerald-100/70 text-emerald-900 hover:bg-emerald-200/80'
                      : 'bg-[#18261e] text-emerald-300 hover:bg-[#22352a]'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Search input & Direct character input */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0">
              <Search
                className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${
                  isLight ? 'text-emerald-700' : 'text-emerald-400'
                }`}
              />
              <input
                type="text"
                placeholder="文字・Unicode (あ, 3042, 学)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className={`w-full border rounded-md pl-8 pr-7 py-1 text-xs placeholder-emerald-700/40 focus:outline-none transition-colors ${
                  isLight
                    ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700 shadow-xs'
                    : 'bg-[#0f1712] border-[#2d4034] text-emerald-100 placeholder-emerald-600 focus:border-emerald-500'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs p-0.5"
                >
                  ×
                </button>
              )}
            </div>

            {/* Quick Custom Character Jumper */}
            <form onSubmit={handleAddCustomChar} className="flex items-center gap-1 shrink-0">
              <input
                type="text"
                maxLength={1}
                placeholder="文字直接"
                value={customCharInput}
                onChange={(e) => setCustomCharInput(e.target.value)}
                className={`w-16 border rounded-md px-1.5 py-1 text-xs text-center focus:outline-none ${
                  isLight
                    ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700 shadow-xs'
                    : 'bg-[#0f1712] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                }`}
                title="任意の文字を直接入力して即座に開く (例: 龍)"
              />
              <button
                type="submit"
                disabled={!customCharInput.trim()}
                className={`px-2 py-1 rounded-md disabled:opacity-40 text-xs font-bold flex items-center transition-colors shrink-0 ${
                  isLight
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    : 'bg-emerald-800 hover:bg-emerald-700 text-emerald-100'
                }`}
                title="入力文字を開く"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Category Progress & Status Filter Bar */}
        <div
          className={`px-3 py-2 border-b flex flex-col gap-1.5 shrink-0 ${
            isLight ? 'bg-white border-[#d4e5dc]' : 'bg-[#16201a] border-[#25362b]'
          }`}
        >
          {/* Progress header */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold flex items-center gap-1.5 truncate">
              <span className={isLight ? 'text-stone-700' : 'text-emerald-300'}>
                {activeCategory?.name || '現在の分類'}:
              </span>
              <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold shrink-0">
                {categoryStats.completed} / {categoryStats.total} 字
              </span>
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300">
                {categoryStats.percent}%
              </span>
              <button
                type="button"
                onClick={() => setIsFilterExpanded((prev) => !prev)}
                className={`p-0.5 rounded transition-colors ${
                  isLight ? 'hover:bg-emerald-100 text-stone-600' : 'hover:bg-[#223328] text-emerald-300'
                }`}
                title={isFilterExpanded ? '詳細フィルターを折りたたんで一覧領域を拡大' : '詳細フィルターを展開'}
              >
                {isFilterExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {isFilterExpanded && (
            <>
              {/* Progress track */}
              <div className="w-full h-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full transition-all duration-300"
                  style={{ width: `${categoryStats.percent}%` }}
                />
              </div>

              {/* Status Filter Chips (すべて / 作成済み / 未作成) */}
              <div className="grid grid-cols-3 gap-1 pt-0.5">
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setCurrentPage(1);
                  }}
                  className={`py-1 px-1 text-[10px] font-bold rounded text-center truncate whitespace-nowrap transition-all ${
                    statusFilter === 'all'
                      ? isLight
                        ? 'bg-stone-800 text-white shadow-xs'
                        : 'bg-emerald-400 text-stone-950 shadow-xs'
                      : isLight
                      ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      : 'bg-[#1c2921] text-emerald-400 hover:bg-[#25372c]'
                  }`}
                  title="すべて表示"
                >
                  すべて ({rawCategoryList.length})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('completed');
                    setCurrentPage(1);
                  }}
                  className={`py-1 px-1 text-[10px] font-bold rounded text-center flex items-center justify-center gap-0.5 truncate whitespace-nowrap transition-all ${
                    statusFilter === 'completed'
                      ? isLight
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-emerald-400 text-stone-950 shadow-xs'
                      : isLight
                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900'
                  }`}
                  title="作成済みのみ表示"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">済 ({categoryStats.completed})</span>
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('pending');
                    setCurrentPage(1);
                  }}
                  className={`py-1 px-1 text-[10px] font-bold rounded text-center flex items-center justify-center gap-0.5 truncate whitespace-nowrap transition-all ${
                    statusFilter === 'pending'
                      ? isLight
                        ? 'bg-amber-700 text-white shadow-xs'
                        : 'bg-amber-400 text-stone-950 shadow-xs'
                      : isLight
                      ? 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                      : 'bg-amber-950/70 text-amber-300 hover:bg-amber-900'
                  }`}
                  title="未作成のみ表示"
                >
                  <CircleDashed className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">未 ({categoryStats.total - categoryStats.completed})</span>
                </button>
              </div>

              {/* Quick Batch Studios Action Buttons */}
              {(onOpenGlyphSynthesisModal || onOpenKerningModal || onOpenQualityModal) && (
                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-stone-100 dark:border-[#223328]">
                  {onOpenGlyphSynthesisModal && (
                    <button
                      type="button"
                      onClick={onOpenGlyphSynthesisModal}
                      className={`py-1 px-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-all truncate border ${
                        isLight
                          ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                          : 'bg-amber-950/40 border-amber-800/80 text-amber-200 hover:bg-amber-900/60'
                      }`}
                      title="濁点・半濁点・小書き文字を一括自動生成"
                    >
                      <Wand2 className="w-3 h-3 text-amber-600 shrink-0" />
                      <span className="truncate">濁点・小文字生成</span>
                    </button>
                  )}
                  {onOpenKerningModal && (
                    <button
                      type="button"
                      onClick={onOpenKerningModal}
                      className={`py-1 px-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-all truncate border ${
                        isLight
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                          : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200 hover:bg-emerald-900/60'
                      }`}
                      title="ペアごとの字間・サイドベアリング一括設定"
                    >
                      <ArrowLeftRight className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span className="truncate">カーニング調整</span>
                    </button>
                  )}
                  {onOpenQualityModal && (
                    <button
                      type="button"
                      onClick={onOpenQualityModal}
                      className={`col-span-2 py-1 px-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-all truncate border ${
                        isLight
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                          : 'bg-emerald-950/30 border-emerald-800/70 text-emerald-200 hover:bg-emerald-900/50'
                      }`}
                      title="字形重複・パス交差・過剰ノード・ベースライン逸脱の品質検査"
                    >
                      <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">フォント品質チェック</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Glyphs Grid Matrix (Explicit row heights to guarantee zero vertical track collapse or overlap) */}
        <div
          className={`flex-1 overflow-y-auto p-2 sm:p-2.5 grid gap-2 content-start ${
            gridDensity === 'large'
              ? 'grid-cols-3'
              : gridDensity === 'medium'
              ? 'grid-cols-4'
              : 'grid-cols-5'
          } ${isLight ? 'bg-[#f7faf8]' : 'bg-[#121914]'}`}
          style={{
            gridAutoRows: gridDensity === 'large' ? '92px' : gridDensity === 'medium' ? '76px' : '62px',
          }}
        >
          {charList.length === 0 ? (
            <div
              className={`col-span-full py-12 text-center text-xs ${
                isLight ? 'text-stone-400' : 'text-emerald-600'
              }`}
            >
              該当する文字が見つかりません
            </div>
          ) : (
            paginatedList.map((item) => (
              <GlyphGridCard
                key={item.code}
                item={item}
                isSelected={selectedUnicode === item.code}
                glyphData={project.glyphs[item.code]}
                isLight={isLight}
                density={gridDensity}
                onSelectGlyph={handleCardSelect}
                onContextMenu={handleOpenContextMenu}
              />
            ))
          )}
        </div>

        {/* Selected Glyph Quick Action Dock (Clear, non-overlapping 1-click tools for the currently active glyph) */}
        {currentSelectedGlyph && (
          <div
            className={`px-3 py-1.5 border-t flex items-center justify-between text-xs shrink-0 ${
              isLight ? 'bg-[#edf5f1] border-[#d4e5dc]' : 'bg-[#16211a] border-[#25362b]'
            }`}
          >
            <div className="flex items-center space-x-1.5 min-w-0">
              <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400">
                {currentSelectedGlyph.char || String.fromCodePoint(currentSelectedGlyph.unicode)}
              </span>
              <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
                U+{currentSelectedGlyph.unicode.toString(16).toUpperCase().padStart(4, '0')}
              </span>
              {currentSelectedHasContours && (
                <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                  {currentSelectedGlyph.contours.length}画
                </span>
              )}
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              {currentSelectedHasContours && (
                <button
                  onClick={() => onCopyGlyph(currentSelectedGlyph.unicode)}
                  className={`p-1 rounded text-[10px] font-bold flex items-center gap-0.5 border ${
                    isLight
                      ? 'bg-white border-[#c8ded3] text-stone-700 hover:bg-emerald-50'
                      : 'bg-[#1e2d24] border-[#2d4034] text-emerald-200 hover:bg-[#283b2f]'
                  }`}
                  title="選択中の字形をコピー"
                >
                  <Copy className="w-3 h-3" />
                  <span className="hidden sm:inline">コピー</span>
                </button>
              )}

              {hasClipboard && (
                <button
                  onClick={() => onPasteGlyph(currentSelectedGlyph.unicode)}
                  className="px-1.5 py-1 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-0.5 shadow-xs"
                  title="コピーした形をこの文字に貼り付け"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>貼付</span>
                </button>
              )}

              {currentSelectedHasContours && (
                <button
                  onClick={() => onClearGlyph(currentSelectedGlyph.unicode)}
                  className="p-1 rounded text-[10px] font-bold hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-transparent hover:border-rose-300 transition-colors"
                  title="この文字のパスを消去"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div
            className={`p-2 border-t flex items-center justify-between text-xs gap-1 shrink-0 ${
              isLight ? 'bg-[#edf5f1] border-[#d4e5dc]' : 'bg-[#18231c] border-[#25362b]'
            }`}
          >
            <div className="flex items-center space-x-1">
              <button
                disabled={validPage <= 1}
                onClick={() => setCurrentPage(1)}
                title="最初のページへ"
                className={`px-1.5 py-1 rounded disabled:opacity-30 border text-[10px] font-bold ${
                  isLight
                    ? 'bg-white border-[#c8ded3] text-stone-700 hover:bg-emerald-50'
                    : 'bg-[#1f2d24] border-[#2d4034] text-emerald-200 hover:bg-[#283b2f]'
                }`}
              >
                « 1
              </button>
              <button
                disabled={validPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={`px-2 py-1 rounded flex items-center space-x-1 disabled:opacity-30 border transition-colors ${
                  isLight
                    ? 'bg-white border-[#c8ded3] text-stone-700 hover:bg-emerald-50'
                    : 'bg-[#1f2d24] border-[#2d4034] text-emerald-200 hover:bg-[#283b2f]'
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="text-[11px]">前</span>
              </button>
            </div>

            <span
              className={`font-mono text-[11px] font-semibold text-center truncate ${
                isLight ? 'text-emerald-950' : 'text-emerald-300'
              }`}
            >
              {validPage} / {totalPages}
            </span>

            <div className="flex items-center space-x-1">
              <button
                disabled={validPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={`px-2 py-1 rounded flex items-center space-x-1 disabled:opacity-30 border transition-colors ${
                  isLight
                    ? 'bg-white border-[#c8ded3] text-stone-700 hover:bg-emerald-50'
                    : 'bg-[#1f2d24] border-[#2d4034] text-emerald-200 hover:bg-[#283b2f]'
                }`}
              >
                <span className="text-[11px]">次</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={validPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                title="最後のページへ"
                className={`px-1.5 py-1 rounded disabled:opacity-30 border text-[10px] font-bold ${
                  isLight
                    ? 'bg-white border-[#c8ded3] text-stone-700 hover:bg-emerald-50'
                    : 'bg-[#1f2d24] border-[#2d4034] text-emerald-200 hover:bg-[#283b2f]'
                }`}
              >
                {totalPages} »
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className={`fixed z-60 w-52 p-1.5 rounded-lg border shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${
            isLight
              ? 'bg-white/98 border-[#c8ded3] text-stone-800'
              : 'bg-[#16211a]/98 border-[#2e4235] text-emerald-100'
          }`}
        >
          <div className="px-2 py-1 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold flex items-center justify-between text-emerald-800 dark:text-emerald-300 mb-1">
            <span>
              「{contextMenu.item.char}」 U+{contextMenu.item.code.toString(16).toUpperCase().padStart(4, '0')}
            </span>
            <button
              onClick={() => setContextMenu(null)}
              className="text-stone-400 hover:text-stone-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="flex flex-col space-y-0.5 text-xs">
            <button
              onClick={() => {
                onSelectGlyph(contextMenu.item.code, contextMenu.item.char);
                setContextMenu(null);
              }}
              className="w-full text-left px-2 py-1 rounded hover:bg-emerald-100 dark:hover:bg-[#203024] font-medium transition-colors"
            >
              この文字を編集
            </button>

            {/* Copy */}
            {project.glyphs[contextMenu.item.code]?.contours?.length ? (
              <button
                onClick={() => {
                  onCopyGlyph(contextMenu.item.code);
                  setContextMenu(null);
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-emerald-100 dark:hover:bg-[#203024] flex items-center gap-1.5 font-medium transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-600" />
                <span>形をコピー</span>
              </button>
            ) : null}

            {/* Paste */}
            {hasClipboard && (
              <button
                onClick={() => {
                  onSelectGlyph(contextMenu.item.code, contextMenu.item.char);
                  onPasteGlyph(contextMenu.item.code);
                  setContextMenu(null);
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-emerald-100 dark:hover:bg-[#203024] flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400 transition-colors"
              >
                <Clipboard className="w-3.5 h-3.5 text-emerald-600" />
                <span>コピーした形を貼り付け</span>
              </button>
            )}

            {/* Dakuten generator */}
            {(() => {
              const dakuInfo = DAKUTEN_MAPPINGS[contextMenu.item.char];
              const gData = project.glyphs[contextMenu.item.code];
              if (gData?.contours?.length && dakuInfo?.type === 'seion' && onGenerateDakutenTarget) {
                return (
                  <>
                    {dakuInfo.daku && (
                      <button
                        onClick={() => {
                          onSelectGlyph(contextMenu.item.code, contextMenu.item.char);
                          onGenerateDakutenTarget(dakuInfo.daku!, false);
                          setContextMenu(null);
                        }}
                        className="w-full text-left px-2 py-1 rounded hover:bg-amber-100 dark:hover:bg-amber-950/60 flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>濁音「{dakuInfo.daku}」を自動生成</span>
                      </button>
                    )}
                    {dakuInfo.handaku && (
                      <button
                        onClick={() => {
                          onSelectGlyph(contextMenu.item.code, contextMenu.item.char);
                          onGenerateDakutenTarget(dakuInfo.handaku!, true);
                          setContextMenu(null);
                        }}
                        className="w-full text-left px-2 py-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 flex items-center gap-1.5 font-medium text-rose-900 dark:text-rose-200 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                        <span>半濁音「{dakuInfo.handaku}」を自動生成</span>
                      </button>
                    )}
                  </>
                );
              }
              return null;
            })()}

            {/* Kana pair small duplicate */}
            {(() => {
              const pair = KANA_PAIRS[contextMenu.item.char];
              const gData = project.glyphs[contextMenu.item.code];
              if (gData?.contours?.length && pair && onDuplicateAsSmallKana) {
                return (
                  <button
                    onClick={() => {
                      onDuplicateAsSmallKana(contextMenu.item.code);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2 py-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-950/60 flex items-center gap-1.5 font-medium text-indigo-900 dark:text-indigo-200 transition-colors"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                    <span>小文字「{pair.smallChar}」へ縮小複製</span>
                  </button>
                );
              }
              return null;
            })()}

            {/* Clear */}
            {project.glyphs[contextMenu.item.code]?.contours?.length ? (
              <button
                onClick={() => {
                  onClearGlyph(contextMenu.item.code);
                  setContextMenu(null);
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>パスを消去</span>
              </button>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
});
