import React, { useState, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Search,
  ExternalLink,
  Plus,
  Copy,
  RefreshCw,
  Layers,
  BarChart3,
  ListFilter,
  Check,
  ChevronDown,
  ChevronUp,
  Activity,
  Sparkles,
  Zap,
  Sliders,
  HelpCircle,
} from 'lucide-react';
import { FontProject, GlyphData } from '../types';
import { contoursToSvgPath } from '../utils/pathUtils';
import {
  ProjectDiagnosticsReport,
  DiagnosticItem,
  DiagnosticScope,
  DiagnosticStatus,
  CategoryDiagnosticStat,
} from '../utils/projectDiagnostics';

type DiagnosticFilter = 'all_attention' | 'all' | 'empty' | 'critically_low' | 'draft' | 'complete';
type DiagnosticSort = 'complexity_asc' | 'complexity_desc' | 'nodes_asc' | 'unicode' | 'severity';

const isDiagnosticFilter = (value: string): value is DiagnosticFilter =>
  value === 'all_attention' ||
  value === 'all' ||
  value === 'empty' ||
  value === 'critically_low' ||
  value === 'draft' ||
  value === 'complete';

const isDiagnosticSort = (value: string): value is DiagnosticSort =>
  value === 'complexity_asc' ||
  value === 'complexity_desc' ||
  value === 'nodes_asc' ||
  value === 'unicode' ||
  value === 'severity';

export interface ProjectDiagnosticsPanelProps {
  project: FontProject;
  setProject: React.Dispatch<React.SetStateAction<FontProject>>;
  isLight: boolean;
  diagReport: ProjectDiagnosticsReport | null;
  diagScope: DiagnosticScope;
  setDiagScope: (scope: DiagnosticScope) => void;
  diagFilter: DiagnosticFilter;
  setDiagFilter: (filter: DiagnosticFilter) => void;
  diagCategoryFilter: string;
  setDiagCategoryFilter: (cat: string) => void;
  diagSortBy: DiagnosticSort;
  setDiagSortBy: (sort: DiagnosticSort) => void;
  diagSearchQuery: string;
  setDiagSearchQuery: (query: string) => void;
  isDiagScanning: boolean;
  onRescan: (scope?: DiagnosticScope) => void;
  onSelectGlyph?: (unicode: number) => void;
  onCloseModal: () => void;
  onShowToast?: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  commitHistory?: () => void;
}

export const ProjectDiagnosticsPanel: React.FC<ProjectDiagnosticsPanelProps> = ({
  project,
  setProject,
  isLight,
  diagReport,
  diagScope,
  setDiagScope,
  diagFilter,
  setDiagFilter,
  diagCategoryFilter,
  setDiagCategoryFilter,
  diagSortBy,
  setDiagSortBy,
  diagSearchQuery,
  setDiagSearchQuery,
  isDiagScanning,
  onRescan,
  onSelectGlyph,
  onCloseModal,
  onShowToast,
  commitHistory,
}) => {
  const [showCategoryProgress, setShowCategoryProgress] = useState<boolean>(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const notify = (text: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    if (onShowToast) {
      onShowToast(text, type);
    }
  };

  // Filter and sort items
  const filteredItems = useMemo(() => {
    if (!diagReport) return [];

    return diagReport.items
      .filter((item) => {
        // Status filter
        if (diagFilter === 'all_attention') {
          if (item.status === 'complete') return false;
        } else if (diagFilter === 'empty') {
          if (item.status !== 'empty') return false;
        } else if (diagFilter === 'critically_low') {
          if (item.status !== 'critically_low_complexity') return false;
        } else if (diagFilter === 'draft') {
          if (item.status !== 'draft') return false;
        } else if (diagFilter === 'complete') {
          if (item.status !== 'complete') return false;
        }

        // Category filter
        if (diagCategoryFilter !== 'all') {
          if (item.categoryType !== diagCategoryFilter && item.categoryId !== diagCategoryFilter) {
            return false;
          }
        }

        // Search query
        if (diagSearchQuery.trim()) {
          const q = diagSearchQuery.trim().toLowerCase();
          const charMatch = item.char.toLowerCase().includes(q);
          const nameMatch = item.glyphName.toLowerCase().includes(q);
          const hexMatch = item.unicode.toString(16).toLowerCase().includes(q);
          const reasonMatch = item.reason.toLowerCase().includes(q);
          const catMatch = item.categoryName.toLowerCase().includes(q);
          if (!charMatch && !nameMatch && !hexMatch && !reasonMatch && !catMatch) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (diagSortBy === 'complexity_asc') {
          return (
            a.metrics.complexityScore - b.metrics.complexityScore ||
            a.metrics.nodeCount - b.metrics.nodeCount ||
            a.unicode - b.unicode
          );
        }
        if (diagSortBy === 'complexity_desc') {
          return b.metrics.complexityScore - a.metrics.complexityScore || b.unicode - a.unicode;
        }
        if (diagSortBy === 'nodes_asc') {
          return a.metrics.nodeCount - b.metrics.nodeCount || a.unicode - b.unicode;
        }
        if (diagSortBy === 'unicode') {
          return a.unicode - b.unicode;
        }
        if (diagSortBy === 'severity') {
          const rank = { error: 0, warning: 1, info: 2, success: 3 };
          return rank[a.severity] - rank[b.severity] || a.unicode - b.unicode;
        }
        return 0;
      });
  }, [diagReport, diagFilter, diagCategoryFilter, diagSearchQuery, diagSortBy]);

  // Jump to glyph editor
  const handleOpenGlyph = (unicode: number) => {
    if (onSelectGlyph) {
      onSelectGlyph(unicode);
      onCloseModal();
    }
  };

  // Add empty glyph to project
  const handleAddGlyph = (item: DiagnosticItem) => {
    if (commitHistory) commitHistory();

    const newGlyph: GlyphData = {
      unicode: item.unicode,
      char: item.char,
      name: item.glyphName,
      advanceWidth: project.metadata.unitsPerEm || 1000,
      lsb: 50,
      contours: [],
      modified: true,
    };

    setProject((prev) => ({
      ...prev,
      glyphs: {
        ...prev.glyphs,
        [item.unicode]: newGlyph,
      },
      updatedAt: Date.now(),
    }));

    notify(`文字「${item.char}」(U+${item.unicode.toString(16).toUpperCase()}) を空グリフとして登録しました`, 'success');
    onRescan();
  };

  // Copy unfinished characters to clipboard
  const handleCopyUnfinished = () => {
    if (!diagReport) return;
    const attentionItems = diagReport.items.filter((it) => it.status !== 'complete');
    if (attentionItems.length === 0) {
      notify('未完成または要確認の文字はありません', 'info');
      return;
    }

    const charsText = attentionItems.map((it) => it.char).join('');
    const detailText = attentionItems
      .map(
        (it) =>
          `[${it.statusLabel}] ${it.char} (U+${it.unicode.toString(16).toUpperCase()}): ${it.reason}`
      )
      .join('\n');

    const fullExport = `【フォント制作診断 未完了・要確認文字リスト (${attentionItems.length}字)】\n対象スコープ: ${diagReport.scope}\n要確認文字一覧:\n${charsText}\n\n詳細リスト:\n${detailText}`;

    navigator.clipboard
      .writeText(fullExport)
      .then(() => {
        notify(`要確認文字 ${attentionItems.length} 字のリストをクリップボードにコピーしました`, 'success');
      })
      .catch(() => {
        notify('クリップボードへのコピーに失敗しました', 'error');
      });
  };

  // Batch register all filtered empty glyphs
  const handleBatchAddFilteredEmpty = () => {
    const unregEmptyItems = filteredItems.filter((it) => it.status === 'empty' && !it.isRegisteredInProject);
    if (unregEmptyItems.length === 0) {
      notify('追加可能な未登録文字はありません', 'info');
      return;
    }

    if (commitHistory) commitHistory();

    setProject((prev) => {
      const nextGlyphs = { ...prev.glyphs };
      unregEmptyItems.forEach((it) => {
        nextGlyphs[it.unicode] = {
          unicode: it.unicode,
          char: it.char,
          name: it.glyphName,
          advanceWidth: prev.metadata.unitsPerEm || 1000,
          lsb: 50,
          contours: [],
          modified: true,
        };
      });
      return {
        ...prev,
        glyphs: nextGlyphs,
        updatedAt: Date.now(),
      };
    });

    notify(`未登録文字 ${unregEmptyItems.length} 字をプロジェクトに一括登録しました`, 'success');
    onRescan();
  };

  // SVG Render Helper
  const renderGlyphThumbnail = (item: DiagnosticItem) => {
    const glyph = project.glyphs[item.unicode];
    const hasContours = glyph && glyph.contours && glyph.contours.length > 0;

    if (hasContours) {
      const pathData = contoursToSvgPath(glyph.contours);
      const unitsPerEm = project.metadata.unitsPerEm || 1000;
      const ascender = project.metadata.ascender || 800;
      const descender = project.metadata.descender || -200;
      const totalHeight = ascender - descender;

      return (
        <svg
          viewBox={`0 ${-ascender} ${unitsPerEm} ${totalHeight}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <path
            d={pathData}
            fill={isLight ? '#1c1917' : '#e2e8f0'}
            transform="scale(1, -1)"
            style={{ transformOrigin: '0 0' }}
          />
        </svg>
      );
    }

    // Empty or Draft representation
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 dark:text-stone-600 font-sans select-none">
        <span className="text-xl font-bold opacity-30">{item.char}</span>
        <span className="text-[9px] font-mono tracking-tighter opacity-50 mt-0.5">
          {item.status === 'empty' ? '未作成' : '下書き'}
        </span>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Top Scope & Global Actions Bar */}
      <div
        className={`px-3 sm:px-5 py-2.5 sm:py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
          isLight ? 'bg-amber-50/50 border-stone-200' : 'bg-[#1a2016]/60 border-[#25362b]'
        }`}
      >
        {/* Scope Selector */}
        <div className="flex items-center space-x-2 min-w-0">
          <div className="text-xs font-bold text-stone-600 dark:text-stone-300 flex items-center space-x-1.5 shrink-0">
            <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>スコープ:</span>
          </div>
          <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none py-0.5 max-w-full">
            {[
              { id: 'standard_japanese', label: '基本和文 (かな・英数)' },
              { id: 'registered_only', label: '登録済みのみ' },
              { id: 'elementary_kanji', label: '小学校配当 (1,026字)' },
              { id: 'jis_level_1', label: 'JIS第1水準 (2,965字)' },
            ].map((sc) => (
              <button
                key={sc.id}
                onClick={() => {
                  setDiagScope(sc.id as DiagnosticScope);
                  onRescan(sc.id as DiagnosticScope);
                }}
                className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border shrink-0 ${
                  diagScope === sc.id
                    ? isLight
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-amber-500 text-stone-950 border-amber-400 font-bold shadow-xs'
                    : isLight
                    ? 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                    : 'bg-[#152018] text-stone-300 border-[#25362b] hover:bg-[#202e23]'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:space-x-2">
          <button
            onClick={handleCopyUnfinished}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition-colors ${
              isLight
                ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                : 'bg-[#1a261f] border-[#25362b] text-emerald-200 hover:bg-[#223328]'
            }`}
            title="未完成および著しく低い複雑度の文字リストをクリップボードにコピー"
          >
            <Copy className="w-3.5 h-3.5 text-stone-500" />
            <span>リストコピー</span>
          </button>

          {/* Batch Add Empty Glyphs if there are unregistered characters in scope */}
          {filteredItems.some((it) => it.status === 'empty' && !it.isRegisteredInProject) && (
            <button
              onClick={handleBatchAddFilteredEmpty}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs font-bold flex items-center space-x-1 transition-colors shadow-xs ${
                isLight
                  ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                  : 'bg-emerald-500 text-stone-950 border-emerald-400 hover:bg-emerald-400'
              }`}
              title="現在リストに表示されている未登録文字を一括でプロジェクトに空グリフとして追加"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>未登録一括追加</span>
            </button>
          )}

          <button
            onClick={() => onRescan()}
            disabled={isDiagScanning}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition-colors ${
              isLight
                ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                : 'bg-[#1a261f] border-[#25362b] text-emerald-200 hover:bg-[#223328]'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDiagScanning ? 'animate-spin' : ''}`} />
            <span>再診断</span>
          </button>
        </div>
      </div>

      {/* 4 Overview Statistics Cards */}
      {diagReport && (
        <div
          className={`grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b ${
            isLight ? 'bg-stone-50/70 border-stone-200' : 'bg-[#111913] border-[#25362b]'
          }`}
        >
          {/* Card 1: Overall Completion Rate */}
          <button
            onClick={() => setDiagFilter('all')}
            className={`p-3 rounded-xl border text-left transition-all ${
              diagFilter === 'all'
                ? isLight
                  ? 'bg-white border-emerald-500 shadow-xs ring-1 ring-emerald-500/20'
                  : 'bg-[#1a261f] border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                : isLight
                ? 'bg-white/80 border-stone-200 hover:border-stone-300'
                : 'bg-[#152018] border-[#25362b] hover:border-stone-700'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 font-medium">
              <span>総合完成度</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {diagReport.overallCompletionRate}%
              </span>
            </div>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-stone-900 dark:text-white">
                {diagReport.completedCount}
              </span>
              <span className="text-xs text-stone-400 font-mono">/ {diagReport.totalTargetChars} 字完成</span>
            </div>
            <div className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${diagReport.overallCompletionRate}%` }}
              />
            </div>
          </button>

          {/* Card 2: Empty Glyphs */}
          <button
            onClick={() => setDiagFilter('empty')}
            className={`p-3 rounded-xl border text-left transition-all ${
              diagFilter === 'empty'
                ? isLight
                  ? 'bg-white border-rose-500 shadow-xs ring-1 ring-rose-500/20'
                  : 'bg-[#1a261f] border-rose-500 shadow-xs ring-1 ring-rose-500/30'
                : isLight
                ? 'bg-white/80 border-stone-200 hover:border-stone-300'
                : 'bg-[#152018] border-[#25362b] hover:border-stone-700'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
              <span className="flex items-center space-x-1">
                <AlertCircle className="w-3 h-3" />
                <span>未作成・空グリフ</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold font-mono">
                未着手
              </span>
            </div>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                {diagReport.emptyCount}
              </span>
              <span className="text-xs text-stone-400 font-mono">文字</span>
            </div>
            <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 truncate">
              輪郭パスが 0 件の未着手文字
            </p>
          </button>

          {/* Card 3: Critically Low Complexity */}
          <button
            onClick={() => setDiagFilter('critically_low')}
            className={`p-3 rounded-xl border text-left transition-all ${
              diagFilter === 'critically_low'
                ? isLight
                  ? 'bg-white border-amber-500 shadow-xs ring-1 ring-amber-500/20'
                  : 'bg-[#1a261f] border-amber-500 shadow-xs ring-1 ring-amber-500/30'
                : isLight
                ? 'bg-white/80 border-stone-200 hover:border-stone-300'
                : 'bg-[#152018] border-[#25362b] hover:border-stone-700'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
              <span className="flex items-center space-x-1">
                <AlertTriangle className="w-3 h-3" />
                <span>著しく低い字形複雑度</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-bold font-mono">
                仮置き疑い
              </span>
            </div>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                {diagReport.criticallyLowComplexityCount}
              </span>
              <span className="text-xs text-stone-400 font-mono">文字</span>
            </div>
            <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 truncate">
              画数に対してノード数や輪郭が極少
            </p>
          </button>

          {/* Card 4: Draft / In-Progress */}
          <button
            onClick={() => setDiagFilter('draft')}
            className={`p-3 rounded-xl border text-left transition-all ${
              diagFilter === 'draft'
                ? isLight
                  ? 'bg-white border-orange-500 shadow-xs ring-1 ring-orange-500/20'
                  : 'bg-[#1a261f] border-orange-500 shadow-xs ring-1 ring-orange-500/30'
                : isLight
                ? 'bg-white/80 border-stone-200 hover:border-stone-300'
                : 'bg-[#152018] border-[#25362b] hover:border-stone-700'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] text-orange-600 dark:text-orange-400 font-semibold">
              <span className="flex items-center space-x-1">
                <Activity className="w-3 h-3" />
                <span>作業中・描きかけ</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 font-bold font-mono">
                未閉合など
              </span>
            </div>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-orange-600 dark:text-orange-400">
                {diagReport.draftCount}
              </span>
              <span className="text-xs text-stone-400 font-mono">文字</span>
            </div>
            <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 truncate">
              パス未閉合や極少ノードの作業中文字
            </p>
          </button>
        </div>
      )}

      {/* Category Progress Bars (Expandable) */}
      {diagReport && diagReport.categoryStats.length > 0 && (
        <div
          className={`border-b px-5 py-2.5 transition-all ${
            isLight ? 'bg-stone-100/50 border-stone-200' : 'bg-[#141d16] border-[#25362b]'
          }`}
        >
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowCategoryProgress((prev) => !prev)}
              className="flex items-center space-x-1.5 text-xs font-bold text-stone-600 dark:text-stone-300 hover:text-stone-900"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>文字種別・進捗状況 ({diagReport.categoryStats.length} カテゴリ)</span>
              {showCategoryProgress ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {diagCategoryFilter !== 'all' && (
              <button
                onClick={() => setDiagCategoryFilter('all')}
                className="text-[11px] font-semibold text-emerald-600 hover:underline"
              >
                すべてのカテゴリを表示
              </button>
            )}
          </div>

          {showCategoryProgress && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mt-2.5">
              {diagReport.categoryStats.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() =>
                    setDiagCategoryFilter(
                      diagCategoryFilter === cat.id ? 'all' : cat.id
                    )
                  }
                  className={`p-2 rounded-lg border text-left transition-all text-xs ${
                    diagCategoryFilter === cat.id
                      ? isLight
                        ? 'bg-white border-amber-500 ring-1 ring-amber-500/30'
                        : 'bg-[#1a281e] border-amber-400 ring-1 ring-amber-400/30'
                      : isLight
                      ? 'bg-white border-stone-200 hover:bg-stone-50'
                      : 'bg-[#18231b] border-[#25362b] hover:bg-[#202e23]'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[11px] truncate">
                    <span className="truncate">{cat.name}</span>
                    <span
                      className={`font-mono text-[10px] ${
                        cat.completionRate === 100
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : cat.completionRate >= 70
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {cat.completionRate}%
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 font-mono">
                    {cat.completedChars} / {cat.totalChars} 字
                  </div>
                  <div className="w-full h-1 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full ${
                        cat.completionRate === 100
                          ? 'bg-emerald-500'
                          : cat.completionRate >= 70
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${cat.completionRate}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter, Search & Sort Toolbar */}
      <div
        className={`px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-2.5 text-xs ${
          isLight ? 'bg-white border-stone-200' : 'bg-[#131b15] border-[#25362b]'
        }`}
      >
        {/* Left: Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative min-w-[160px] max-w-xs flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={diagSearchQuery}
              onChange={(e) => setDiagSearchQuery(e.target.value)}
              placeholder="文字、Unicode、理由で検索..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs outline-hidden transition-colors ${
                isLight
                  ? 'bg-stone-50 border-stone-200 focus:border-amber-600 focus:bg-white text-stone-900'
                  : 'bg-[#111913] border-[#25362b] focus:border-amber-500 text-emerald-100'
              }`}
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center space-x-1 overflow-x-auto py-0.5">
            {[
              { id: 'all_attention', label: '要対応すべて', count: diagReport?.totalAttentionCount },
              { id: 'empty', label: '未作成のみ', count: diagReport?.emptyCount },
              { id: 'critically_low', label: '著しく低い複雑度', count: diagReport?.criticallyLowComplexityCount },
              { id: 'draft', label: '作業中のみ', count: diagReport?.draftCount },
              { id: 'all', label: '全文字 (完成含む)', count: diagReport?.totalTargetChars },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  if (isDiagnosticFilter(f.id)) {
                    setDiagFilter(f.id);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center space-x-1 border ${
                  diagFilter === f.id
                    ? isLight
                      ? 'bg-amber-100 text-amber-950 border-amber-300 shadow-2xs font-bold'
                      : 'bg-amber-950/80 text-amber-200 border-amber-700 shadow-2xs font-bold'
                    : isLight
                    ? 'border-transparent text-stone-600 hover:bg-stone-100'
                    : 'border-transparent text-stone-400 hover:bg-[#1b261e]'
                }`}
              >
                <span>{f.label}</span>
                {f.count !== undefined && (
                  <span className="font-mono text-[10px] opacity-75">({f.count})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Sort By Dropdown */}
        <div className="flex items-center space-x-2">
          <div className="text-stone-500 dark:text-stone-400 text-[11px] font-medium flex items-center space-x-1">
            <ListFilter className="w-3.5 h-3.5" />
            <span>並び替え:</span>
          </div>
          <select
            value={diagSortBy}
            onChange={(e) => {
              if (isDiagnosticSort(e.target.value)) {
                setDiagSortBy(e.target.value);
              }
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium outline-hidden transition-colors ${
              isLight
                ? 'bg-white border-stone-200 text-stone-800'
                : 'bg-[#152018] border-[#25362b] text-emerald-100'
            }`}
          >
            <option value="complexity_asc">字形複雑度が低い順（昇順）</option>
            <option value="complexity_desc">字形複雑度が高い順（降順）</option>
            <option value="nodes_asc">ノード数が少ない順</option>
            <option value="unicode">Unicode順（U+XXXX）</option>
            <option value="severity">深刻度順（未作成・警告優先）</option>
          </select>
        </div>
      </div>

      {/* Main Items List Container */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <div
              className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3 border ${
                isLight
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : 'bg-emerald-950/50 border-emerald-800 text-emerald-400'
              }`}
            >
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-stone-800 dark:text-stone-100">
              該当する文字はありません
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-md mx-auto">
              {diagFilter === 'all_attention'
                ? 'このスコープ内の文字はすべて十分な字形複雑度を持って制作されています。'
                : '現在のフィルター条件または検索クエリに一致する文字は見つかりませんでした。'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 px-1 font-medium">
              <span>
                抽出文字: <strong className="text-stone-900 dark:text-white font-mono">{filteredItems.length}</strong> 件
              </span>
              <span className="text-[11px]">
                各行の「エディタで開く」または「空グリフ追加」をクリックして制作を続行できます
              </span>
            </div>

            {filteredItems.map((item) => {
              const hex = item.unicode.toString(16).toUpperCase();
              const isAttention = item.status !== 'complete';

              return (
                <div
                  key={item.unicode}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    item.status === 'empty'
                      ? isLight
                        ? 'bg-rose-50/40 border-rose-200/80 hover:border-rose-300'
                        : 'bg-rose-950/20 border-rose-900/60 hover:border-rose-800'
                      : item.status === 'critically_low_complexity'
                      ? isLight
                        ? 'bg-amber-50/40 border-amber-200/80 hover:border-amber-300'
                        : 'bg-amber-950/20 border-amber-900/60 hover:border-amber-800'
                      : item.status === 'draft'
                      ? isLight
                        ? 'bg-orange-50/40 border-orange-200/80 hover:border-orange-300'
                        : 'bg-orange-950/20 border-orange-900/60 hover:border-orange-800'
                      : isLight
                      ? 'bg-white border-stone-200 hover:border-stone-300'
                      : 'bg-[#152018] border-[#25362b] hover:border-stone-700'
                  }`}
                >
                  {/* Left: Thumbnail & Glyph Meta */}
                  <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                    {/* Visual Glyph Box */}
                    <div
                      className={`w-14 h-14 rounded-xl border shrink-0 flex items-center justify-center p-1 relative overflow-hidden ${
                        isLight
                          ? 'bg-white border-stone-200 shadow-2xs'
                          : 'bg-[#111913] border-[#25362b]'
                      }`}
                    >
                      {renderGlyphThumbnail(item)}
                    </div>

                    {/* Meta Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xl font-bold font-serif text-stone-900 dark:text-stone-100 leading-none">
                          {item.char}
                        </span>
                        <span className="text-xs font-mono font-bold text-stone-500 dark:text-stone-400">
                          U+{hex}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                            item.status === 'empty'
                              ? isLight
                                ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold'
                                : 'bg-rose-950 text-rose-300 border-rose-800 font-bold'
                              : item.status === 'critically_low_complexity'
                              ? isLight
                                ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                                : 'bg-amber-950 text-amber-300 border-amber-800 font-bold'
                              : item.status === 'draft'
                              ? isLight
                                ? 'bg-orange-100 text-orange-900 border-orange-300 font-bold'
                                : 'bg-orange-950 text-orange-300 border-orange-800 font-bold'
                              : isLight
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          }`}
                        >
                          {item.statusLabel}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            isLight
                              ? 'bg-stone-100 text-stone-600 border-stone-200'
                              : 'bg-[#1a261f] text-stone-300 border-[#25362b]'
                          }`}
                        >
                          {item.categoryName}
                        </span>
                        {item.glyphName && item.glyphName !== item.char && (
                          <span className="text-[10px] text-stone-400 font-mono">
                            {item.glyphName}
                          </span>
                        )}
                      </div>

                      {/* Diagnostic Reason */}
                      <p className="text-xs text-stone-700 dark:text-stone-300 mt-1 leading-relaxed">
                        {item.reason}
                      </p>

                      {/* Recommendation */}
                      {item.recommendation && (
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 flex items-center space-x-1">
                          <span className="font-semibold text-amber-600 dark:text-amber-400">推奨:</span>
                          <span>{item.recommendation}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Middle: Metrics Chips */}
                  <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto border-stone-200 dark:border-stone-800">
                    <div className="flex items-center space-x-2 text-[11px] font-mono">
                      <span className="text-stone-400">ノード数:</span>
                      <strong className="text-stone-800 dark:text-stone-200">{item.metrics.nodeCount}</strong>
                      <span className="text-stone-300 dark:text-stone-700">|</span>
                      <span className="text-stone-400">輪郭数:</span>
                      <strong className="text-stone-800 dark:text-stone-200">{item.metrics.contourCount}</strong>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-stone-400">複雑度スコア:</span>
                      <div className="w-16 h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            item.metrics.complexityScore === 0
                              ? 'bg-stone-300'
                              : item.metrics.complexityScore < 20
                              ? 'bg-rose-500'
                              : item.metrics.complexityScore < 45
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(item.metrics.complexityScore, 2)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-stone-600 dark:text-stone-400">
                        {item.metrics.complexityScore}
                      </span>
                    </div>

                    {/* Action Button */}
                    <div className="flex items-center space-x-2 mt-1">
                      {item.isRegisteredInProject ? (
                        <button
                          onClick={() => handleOpenGlyph(item.unicode)}
                          className={`px-3 py-1 rounded-lg border text-xs font-bold flex items-center space-x-1 transition-all ${
                            isLight
                              ? 'bg-white border-stone-300 text-stone-800 hover:bg-stone-50 shadow-2xs'
                              : 'bg-[#1c2920] border-[#25362b] text-emerald-200 hover:bg-[#25382b]'
                          }`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>エディタで開く</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddGlyph(item)}
                          className={`px-3 py-1 rounded-lg border text-xs font-bold flex items-center space-x-1 transition-all ${
                            isLight
                              ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-2xs'
                              : 'bg-emerald-500 text-stone-950 border-emerald-400 hover:bg-emerald-400'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>空グリフ追加</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
