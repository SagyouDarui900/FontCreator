import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Flame,
  Sparkles,
  RotateCcw,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Zap,
  Info,
} from 'lucide-react';
import { FontProject, GlyphData, PathContour, Point } from '../types';
import { ThemeMode, isLightTheme } from '../utils/theme';
import { contoursToSvgPath } from '../utils/pathUtils';
import {
  analyzeGlyphContourDensity,
  simplifySingleContourInGlyph,
  simplifyContourClusterInGlyph,
  simplifyAllDenseContoursInGlyph,
  safePreservingNodeOptimization,
  GlyphDensityAnalysis,
  ContourDensityAnalysis,
  NodeDensityInfo,
} from '../utils/qualityChecker';

interface GlyphDensityHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  unicode: number | null;
  onSelectUnicode?: (unicode: number) => void;
  allProblemUnicodes?: number[];
  project: FontProject;
  setProject: React.Dispatch<React.SetStateAction<FontProject>>;
  onSelectGlyph?: (unicode: number) => void;
  theme: ThemeMode;
  onShowToast?: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  commitHistory?: () => void;
  onRefreshQualityReport?: () => void;
}

export const GlyphDensityHeatmapModal: React.FC<GlyphDensityHeatmapModalProps> = ({
  isOpen,
  onClose,
  unicode,
  onSelectUnicode,
  allProblemUnicodes = [],
  project,
  setProject,
  onSelectGlyph,
  theme,
  onShowToast,
  commitHistory,
  onRefreshQualityReport,
}) => {
  const isLight = isLightTheme(theme);

  // Interaction State
  const [tolerance, setTolerance] = useState<number>(3.5);
  const [selectedContourIndex, setSelectedContourIndex] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeDensityInfo | null>(null);
  const [showHeatmapNodes, setShowHeatmapNodes] = useState<boolean>(true);
  const [showHotspots, setShowHotspots] = useState<boolean>(true);
  const [showMetricsGuides, setShowMetricsGuides] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [hoveredContourIndex, setHoveredContourIndex] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Undo history stack for the current glyph
  const [undoStack, setUndoStack] = useState<PathContour[][]>([]);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

  if (!isOpen || unicode === null) return null;

  const glyph = project.glyphs?.[unicode];
  const char = glyph?.char || String.fromCodePoint(unicode);
  const contours = glyph?.contours || [];

  // Compute live density analysis
  const densityAnalysis: GlyphDensityAnalysis = useMemo(() => {
    return analyzeGlyphContourDensity(contours, unicode, char);
  }, [contours, unicode, char]);

  const notify = (text: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    if (onShowToast) {
      onShowToast(text, type);
    }
  };

  const svgPath = useMemo(() => {
    return contoursToSvgPath(contours);
  }, [contours]);

  // Push previous contours to undo stack before mutation
  const pushUndo = (currentContours: PathContour[]) => {
    setUndoStack((prev) => [...prev.slice(-10), currentContours]);
  };

  // Handle single contour simplification
  const handleSimplifyContour = (contourIndex: number) => {
    if (!glyph || !glyph.contours || contourIndex < 0 || contourIndex >= glyph.contours.length) return;
    if (commitHistory) commitHistory();
    pushUndo(glyph.contours);

    const result = simplifySingleContourInGlyph(glyph.contours, contourIndex, tolerance);

    if (result.reducedCount > 0) {
      const updatedGlyph: GlyphData = {
        ...glyph,
        contours: result.updatedContours,
      };
      setProject((prev) => ({
        ...prev,
        glyphs: {
          ...prev.glyphs,
          [unicode]: updatedGlyph,
        },
      }));

      const msg = `輪郭 #${contourIndex + 1} を単純化: ${result.beforeNodeCount} → ${result.afterNodeCount} ノード (${result.reducedCount}個削減)`;
      setLastActionMessage(msg);
      notify(msg, 'success');
      if (onRefreshQualityReport) onRefreshQualityReport();
    } else {
      notify(`輪郭 #${contourIndex + 1} はすでに最適なアンカー数です`, 'info');
    }
  };

  // Handle cluster simplification around clicked node
  const handleSimplifyNodeCluster = (node: NodeDensityInfo) => {
    if (!glyph || !glyph.contours) return;
    if (commitHistory) commitHistory();
    pushUndo(glyph.contours);

    const result = simplifyContourClusterInGlyph(glyph.contours, node.contourIndex, node.nodeIndex, 60, tolerance);

    if (result.reducedCount > 0) {
      const updatedGlyph: GlyphData = {
        ...glyph,
        contours: result.updatedContours,
      };
      setProject((prev) => ({
        ...prev,
        glyphs: {
          ...prev.glyphs,
          [unicode]: updatedGlyph,
        },
      }));

      const msg = `ノード #${node.nodeIndex + 1} 周辺の密集クラスタを単純化: -${result.reducedCount} ノード削減`;
      setLastActionMessage(msg);
      notify(msg, 'success');
      setSelectedNode(null);
      if (onRefreshQualityReport) onRefreshQualityReport();
    } else {
      notify('指定ノード周辺はすでに最適化されています', 'info');
    }
  };

  // Handle simplify all dense contours in this glyph
  const handleSimplifyAllDense = () => {
    if (!glyph || !glyph.contours || glyph.contours.length === 0) return;
    if (commitHistory) commitHistory();
    pushUndo(glyph.contours);

    const result = simplifyAllDenseContoursInGlyph(glyph.contours, tolerance, 30);

    if (result.reducedCount > 0) {
      const updatedGlyph: GlyphData = {
        ...glyph,
        contours: result.updatedContours,
      };
      setProject((prev) => ({
        ...prev,
        glyphs: {
          ...prev.glyphs,
          [unicode]: updatedGlyph,
        },
      }));

      const msg = `文字「${char}」の過密輪郭を一括単純化: ${result.beforeNodeCount} → ${result.afterNodeCount} ノード (-${result.reducedCount}個 / -${result.reductionPercentage}%)`;
      setLastActionMessage(msg);
      notify(msg, 'success');
      if (onRefreshQualityReport) onRefreshQualityReport();
    } else {
      notify('過密な輪郭は見つかりませんでした（すでに最適化されています）', 'info');
    }
  };

  // Handle safe full glyph optimization
  const handleSafeOptimizeAll = () => {
    if (!glyph || !glyph.contours || glyph.contours.length === 0) return;
    if (commitHistory) commitHistory();
    pushUndo(glyph.contours);

    const beforeCount = glyph.contours.reduce((sum, c) => sum + (c.nodes?.length || 0), 0);
    const optimizedContours = safePreservingNodeOptimization(glyph.contours, {
      level: tolerance >= 5 ? 'strong' : tolerance <= 2 ? 'mild' : 'normal',
      preserveSharpCorners: true,
      maxBboxDeviation: 1.5,
    });
    const afterCount = optimizedContours.reduce((sum, c) => sum + (c.nodes?.length || 0), 0);
    const reduced = beforeCount - afterCount;

    if (reduced > 0) {
      const updatedGlyph: GlyphData = {
        ...glyph,
        contours: optimizedContours,
      };
      setProject((prev) => ({
        ...prev,
        glyphs: {
          ...prev.glyphs,
          [unicode]: updatedGlyph,
        },
      }));

      const msg = `文字「${char}」の形状を保護して最適化: ${beforeCount} → ${afterCount} ノード (-${reduced}個)`;
      setLastActionMessage(msg);
      notify(msg, 'success');
      if (onRefreshQualityReport) onRefreshQualityReport();
    } else {
      notify('文字「${char}」はすでに直線・角が最適化されています', 'info');
    }
  };

  // Undo last action
  const handleUndo = () => {
    if (undoStack.length === 0 || !glyph) return;
    const prevContours = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    const updatedGlyph: GlyphData = {
      ...glyph,
      contours: prevContours,
    };
    setProject((prev) => ({
      ...prev,
      glyphs: {
        ...prev.glyphs,
        [unicode]: updatedGlyph,
      },
    }));

    notify('直前の単純化を取り消しました', 'info');
    setLastActionMessage('元に戻しました');
    if (onRefreshQualityReport) onRefreshQualityReport();
  };

  // Previous & Next Problematic Glyph Navigation
  const currentIndexInProblems = allProblemUnicodes.indexOf(unicode);
  const hasPrev = currentIndexInProblems > 0;
  const hasNext = currentIndexInProblems !== -1 && currentIndexInProblems < allProblemUnicodes.length - 1;

  const handlePrevGlyph = () => {
    if (hasPrev && onSelectUnicode) {
      onSelectUnicode(allProblemUnicodes[currentIndexInProblems - 1]);
      setSelectedContourIndex(null);
      setSelectedNode(null);
      setUndoStack([]);
    }
  };

  const handleNextGlyph = () => {
    if (hasNext && onSelectUnicode) {
      onSelectUnicode(allProblemUnicodes[currentIndexInProblems + 1]);
      setSelectedContourIndex(null);
      setSelectedNode(null);
      setUndoStack([]);
    }
  };

  // Keyboard shortcut listener for Density Heatmap Modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if (e.key === 'Escape') {
        e.preventDefault();
        if (selectedNode) {
          setSelectedNode(null);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
        return;
      }

      if ((e.key === 'f' || e.key === 'F') && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleSimplifyAllDense();
        return;
      }

      if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          setTolerance(2.0);
          notify('単純化強度: 軽度 (2.0px) に設定しました', 'info');
        } else if (e.key === '2') {
          e.preventDefault();
          setTolerance(3.5);
          notify('単純化強度: 標準 (3.5px) に設定しました', 'info');
        } else if (e.key === '3') {
          e.preventDefault();
          setTolerance(5.0);
          notify('単純化強度: 強力 (5.0px) に設定しました', 'info');
        } else if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          setShowHeatmapNodes((prev) => !prev);
        } else if (e.key.toLowerCase() === 'h') {
          e.preventDefault();
          setShowHotspots((prev) => !prev);
        } else if (e.key.toLowerCase() === 'm') {
          e.preventDefault();
          setShowMetricsGuides((prev) => !prev);
        } else if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          setZoomLevel((z) => Math.min(3.0, Math.round(z * 1.25 * 10) / 10));
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          setZoomLevel((z) => Math.max(0.4, Math.round((z / 1.25) * 10) / 10));
        } else if (e.key === '0') {
          e.preventDefault();
          setZoomLevel(1.0);
        } else if (e.key === 'ArrowLeft') {
          if (hasPrev) {
            e.preventDefault();
            handlePrevGlyph();
          }
        } else if (e.key === 'ArrowRight') {
          if (hasNext) {
            e.preventDefault();
            handleNextGlyph();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    selectedNode,
    isFullscreen,
    onClose,
    handleUndo,
    handleSimplifyAllDense,
    hasPrev,
    hasNext,
    handlePrevGlyph,
    handleNextGlyph,
  ]);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in ${
      isFullscreen ? 'p-0' : 'p-3 sm:p-5'
    }`}>
      <div
        className={`w-full rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'h-full max-h-full rounded-none border-0' : 'max-w-6xl max-h-[94vh]'
        } ${
          isLight
            ? 'bg-stone-50 border-stone-300 text-stone-900 shadow-stone-900/20'
            : 'bg-[#101813] border-[#223528] text-emerald-50 shadow-black/80'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between gap-3 ${
            isLight ? 'bg-white border-stone-200' : 'bg-[#142018] border-[#243a2b]'
          }`}
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-md shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold truncate">輪郭密度ヒートマップ診断 & 単純化</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                    isLight ? 'bg-amber-100 text-amber-900' : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                  }`}
                >
                  {char} (U+{unicode.toString(16).toUpperCase()})
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                過剰なアンカー密度をヒートマップで視覚化し、クリックで局所または輪郭単位の単純化を即時適用できます
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Prev/Next Problem Glyphs Navigation */}
            {allProblemUnicodes.length > 1 && (
              <div className="flex items-center space-x-1 border rounded-lg p-0.5 border-stone-200 dark:border-[#2a4030]">
                <button
                  onClick={handlePrevGlyph}
                  disabled={!hasPrev}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    hasPrev
                      ? isLight
                        ? 'hover:bg-stone-100 text-stone-700'
                        : 'hover:bg-[#1e3023] text-emerald-200'
                      : 'opacity-30 cursor-not-allowed'
                  }`}
                  title="前の過密文字へ"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] px-1 font-mono text-stone-500 dark:text-stone-400">
                  {currentIndexInProblems + 1}/{allProblemUnicodes.length}
                </span>
                <button
                  onClick={handleNextGlyph}
                  disabled={!hasNext}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    hasNext
                      ? isLight
                        ? 'hover:bg-stone-100 text-stone-700'
                        : 'hover:bg-[#1e3023] text-emerald-200'
                      : 'opacity-30 cursor-not-allowed'
                  }`}
                  title="次の過密文字へ"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Jump to Canvas */}
            {onSelectGlyph && (
              <button
                onClick={() => {
                  onSelectGlyph(unicode);
                  onClose();
                }}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                  isLight
                    ? 'bg-stone-100 border-stone-300 hover:bg-stone-200 text-stone-800'
                    : 'bg-[#1b2a20] border-[#2c4433] hover:bg-[#24392b] text-emerald-200'
                }`}
                title="通常のエディタキャンバスでこの文字を開く"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">エディタで開く</span>
              </button>
            )}

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-2 rounded-xl transition-colors ${
                isLight ? 'hover:bg-stone-100 text-stone-600' : 'hover:bg-[#1b2b20] text-stone-400 hover:text-white'
              }`}
              title={isFullscreen ? '通常表示 (F)' : '全画面表示 (F)'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>

            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors ${
                isLight ? 'hover:bg-stone-100 text-stone-600' : 'hover:bg-[#1b2b20] text-stone-400 hover:text-white'
              }`}
              title="閉じる (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action & Tolerance Top Bar */}
        <div
          className={`px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${
            isLight ? 'bg-amber-50/50 border-stone-200' : 'bg-[#121c15] border-[#223528]'
          }`}
        >
          {/* Tolerance controls */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <Sliders className="w-3.5 h-3.5" />
              <span>単純化強度 (Tolerance):</span>
            </span>

            {/* Presets */}
            <div className="flex items-center space-x-1 bg-stone-200/60 dark:bg-[#18281d] p-0.5 rounded-lg">
              <button
                onClick={() => setTolerance(2.0)}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  tolerance === 2.0
                    ? isLight
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
                title="微細（2.0px）: 形状を100%保持し、手の震え・ゴミ頂点のみを間引きます"
              >
                微細 (2.0)
              </button>
              <button
                onClick={() => setTolerance(3.5)}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  tolerance === 3.5
                    ? isLight
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
                title="標準（3.5px）: バランス良くノードを半減させ、美しい曲線に整えます"
              >
                標準 (3.5)
              </button>
              <button
                onClick={() => setTolerance(6.0)}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  tolerance === 6.0
                    ? isLight
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
                title="強力（6.0px）: 大幅にノード数を削減し、軽量な幾何ベジェにします"
              >
                強力 (6.0)
              </button>
            </div>

            {/* Slider */}
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="1.0"
                max="8.0"
                step="0.5"
                value={tolerance}
                onChange={(e) => setTolerance(parseFloat(e.target.value))}
                className="w-24 sm:w-32 accent-amber-500 cursor-pointer h-1.5 rounded-lg bg-stone-300 dark:bg-stone-700"
              />
              <span className="font-mono font-bold text-amber-600 dark:text-amber-300 min-w-8">
                {tolerance.toFixed(1)}px
              </span>
            </div>
          </div>

          {/* Quick Execution & Undo Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {undoStack.length > 0 && (
              <button
                onClick={handleUndo}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 border transition-colors ${
                  isLight
                    ? 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'
                    : 'bg-[#1a271f] border-[#293d2e] text-stone-200 hover:bg-[#223528]'
                }`}
                title="直前の単純化を取り消す"
              >
                <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                <span>元に戻す ({undoStack.length})</span>
              </button>
            )}

            <button
              onClick={handleSimplifyAllDense}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 border shadow-xs transition-colors ${
                isLight
                  ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700'
                  : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500'
              }`}
              title="過密・密集と判定された全輪郭を一括で即時単純化します"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>過密輪郭を一括単純化</span>
            </button>

            <button
              onClick={handleSafeOptimizeAll}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 border shadow-xs transition-colors ${
                isLight
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-800'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
              }`}
              title="文字の形・角・筆先を保護しながら全体を安全に最適化します"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>文字全体を安全最適化</span>
            </button>
          </div>
        </div>

        {/* Modal Main Content: SVG Canvas + Sidebar */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Left Canvas Section */}
          <div className="flex-1 min-h-[380px] lg:min-h-0 relative flex flex-col p-4 bg-stone-900/5 dark:bg-black/30">
            {/* Floating Overlay Controls & Legend */}
            <div className="absolute top-6 left-6 z-10 flex flex-wrap items-center gap-2 pointer-events-auto">
              <div
                className={`px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-md text-[11px] font-semibold flex items-center gap-3 ${
                  isLight ? 'bg-white/90 border-stone-200 text-stone-800' : 'bg-[#101912]/90 border-[#223528] text-emerald-100'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-pulse"></span>
                  <span>過密 (&lt;14px)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]"></span>
                  <span>密集 (&lt;30px)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></span>
                  <span>中度 (&lt;65px)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span>
                  <span>最適</span>
                </div>
              </div>

              {/* View Toggles */}
              <div
                className={`p-1 rounded-xl border backdrop-blur-md shadow-md flex items-center gap-1 ${
                  isLight ? 'bg-white/90 border-stone-200' : 'bg-[#101912]/90 border-[#223528]'
                }`}
              >
                <button
                  onClick={() => setShowHeatmapNodes(!showHeatmapNodes)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                    showHeatmapNodes
                      ? isLight
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-amber-900/60 text-amber-200'
                      : 'text-stone-400'
                  }`}
                  title="アンカー点のヒートマップ色表示切替"
                >
                  アンカー表示
                </button>
                <button
                  onClick={() => setShowHotspots(!showHotspots)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                    showHotspots
                      ? isLight
                        ? 'bg-rose-100 text-rose-900'
                        : 'bg-rose-900/60 text-rose-200'
                      : 'text-stone-400'
                  }`}
                  title="密集ホットスポットのレーダー強調切替"
                >
                  ホットスポット
                </button>
                <button
                  onClick={() => setShowMetricsGuides(!showMetricsGuides)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                    showMetricsGuides
                      ? isLight
                        ? 'bg-stone-200 text-stone-900'
                        : 'bg-stone-800 text-stone-200'
                      : 'text-stone-400'
                  }`}
                  title="ベースライン・仮想ボディ等のガイド表示切替"
                >
                  ガイド線
                </button>
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="absolute bottom-6 left-6 z-10 flex items-center space-x-1 border rounded-xl p-1 backdrop-blur-md shadow-md bg-white/90 dark:bg-[#101912]/90 border-stone-200 dark:border-[#223528]">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.7, Math.round((z - 0.2) * 10) / 10))}
                className="p-1.5 rounded hover:bg-stone-200 dark:hover:bg-[#1e3023] text-stone-700 dark:text-emerald-200"
                title="縮小"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1 font-bold min-w-10 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.5, Math.round((z + 0.2) * 10) / 10))}
                className="p-1.5 rounded hover:bg-stone-200 dark:hover:bg-[#1e3023] text-stone-700 dark:text-emerald-200"
                title="拡大"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(1.0)}
                className="px-2 py-1 rounded text-[10px] font-semibold hover:bg-stone-200 dark:hover:bg-[#1e3023] text-stone-600 dark:text-emerald-300"
                title="100%リセット"
              >
                Reset
              </button>
            </div>

            {/* Selected Node / Contextual Inspector Popover */}
            {selectedNode && (
              <div
                className={`absolute bottom-6 right-6 z-20 p-3.5 rounded-2xl border shadow-xl backdrop-blur-md max-w-xs animate-slide-up ${
                  isLight ? 'bg-white/95 border-amber-300 text-stone-800' : 'bg-[#132017]/95 border-amber-600/80 text-emerald-100'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-[#243a2b] mb-2">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedNode.color }}
                    ></span>
                    <span className="font-bold text-xs">
                      輪郭 #{selectedNode.contourIndex + 1} • 点 #{selectedNode.nodeIndex + 1}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-1 rounded hover:bg-stone-200 dark:hover:bg-[#203425] text-stone-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 text-[11px] mb-3">
                  <div className="flex justify-between">
                    <span className="text-stone-500">座標:</span>
                    <span className="font-mono font-semibold">
                      X: {Math.round(selectedNode.x)}, Y: {Math.round(selectedNode.y)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">局所スパン (間隔):</span>
                    <span className="font-mono font-semibold">{selectedNode.span} px</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">近傍密集ノード数 (R=40):</span>
                    <span className="font-mono font-semibold">{selectedNode.clusterCount} 個</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">過密度スコア:</span>
                    <span className="font-mono font-bold" style={{ color: selectedNode.color }}>
                      {selectedNode.densityScore} / 100 ({selectedNode.level === 'critical' ? '極度過密' : selectedNode.level === 'dense' ? '密集' : selectedNode.level === 'moderate' ? '中度' : '適正'})
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => handleSimplifyContour(selectedNode.contourIndex)}
                    className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 border shadow-xs ${
                      isLight
                        ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700'
                        : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>この輪郭全体を単純化</span>
                  </button>
                  <button
                    onClick={() => handleSimplifyNodeCluster(selectedNode)}
                    className={`w-full py-1 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center space-x-1 border ${
                      isLight
                        ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                        : 'bg-[#1a281f] hover:bg-[#24382c] text-emerald-200 border-[#293e2f]'
                    }`}
                  >
                    <span>この密集クラスタのみ単純化</span>
                  </button>
                </div>
              </div>
            )}

            {/* Interactive SVG Stage */}
            <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
              <div
                className="relative rounded-2xl border shadow-inner flex items-center justify-center transition-transform"
                style={{
                  width: 'min(100%, 540px)',
                  aspectRatio: '1 / 1',
                  transform: `scale(${zoomLevel})`,
                  backgroundColor: isLight ? '#fcfbf9' : '#0a100c',
                  borderColor: isLight ? '#e7e5e4' : '#1e3024',
                }}
              >
                <svg
                  viewBox="0 0 1000 1000"
                  className="w-full h-full select-none"
                  style={{ touchAction: 'none' }}
                >
                  <defs>
                    {/* Radial heat glow filters */}
                    <radialGradient id="heatGlowRed" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                      <stop offset="60%" stopColor="#ef4444" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="heatGlowOrange" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#f97316" stopOpacity="0.7" />
                      <stop offset="60%" stopColor="#f97316" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Metrics and Guide Lines */}
                  {showMetricsGuides && (
                    <g className="opacity-60 pointer-events-none">
                      {/* Em-box boundary (0,0 to 1000,1000) */}
                      <rect
                        x="30"
                        y="30"
                        width="940"
                        height="940"
                        fill="none"
                        stroke={isLight ? '#d6d3d1' : '#1d3123'}
                        strokeWidth="2"
                        strokeDasharray="8 8"
                      />
                      {/* Baseline Y = 800 */}
                      <line
                        x1="0"
                        y1="800"
                        x2="1000"
                        y2="800"
                        stroke="#ef4444"
                        strokeWidth="3"
                        strokeDasharray="12 12"
                      />
                      <text
                        x="980"
                        y="792"
                        fill="#ef4444"
                        fontSize="22"
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        Baseline (800)
                      </text>

                      {/* Ascender Y = 200 */}
                      <line
                        x1="0"
                        y1="200"
                        x2="1000"
                        y2="200"
                        stroke="#0ea5e9"
                        strokeWidth="2"
                        strokeDasharray="8 8"
                      />
                      <text
                        x="980"
                        y="192"
                        fill="#0ea5e9"
                        fontSize="20"
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        Ascender (200)
                      </text>

                      {/* Center guidelines */}
                      <line
                        x1="500"
                        y1="0"
                        x2="500"
                        y2="1000"
                        stroke={isLight ? '#e7e5e4' : '#192b1f'}
                        strokeWidth="2"
                        strokeDasharray="6 6"
                      />
                      <line
                        x1="0"
                        y1="500"
                        x2="1000"
                        y2="500"
                        stroke={isLight ? '#e7e5e4' : '#192b1f'}
                        strokeWidth="2"
                        strokeDasharray="6 6"
                      />
                    </g>
                  )}

                  {/* Render Main Contours */}
                  {contours.map((c, cIdx) => {
                    const isSelected = selectedContourIndex === cIdx;
                    const isHovered = hoveredContourIndex === cIdx;
                    const cPath = contoursToSvgPath([c]);
                    const cAnalysis = densityAnalysis.contours[cIdx];
                    const isOverloaded = cAnalysis && (cAnalysis.densityScore >= 50 || cAnalysis.criticalCount > 0);

                    return (
                      <g
                        key={c.id || cIdx}
                        className="cursor-pointer transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContourIndex(cIdx);
                        }}
                        onMouseEnter={() => setHoveredContourIndex(cIdx)}
                        onMouseLeave={() => setHoveredContourIndex(null)}
                      >
                        {/* Contour Fill & Stroke */}
                        <path
                          d={cPath}
                          fill={
                            isSelected
                              ? isLight
                                ? '#292524'
                                : '#ecfdf5'
                              : isHovered
                              ? isLight
                                ? '#44403c'
                                : '#d1fae5'
                              : isLight
                              ? '#1c1917'
                              : '#a7f3d0'
                          }
                          fillRule="nonzero"
                          opacity={selectedContourIndex !== null && !isSelected ? 0.45 : 0.9}
                          stroke={
                            isSelected
                              ? '#3b82f6'
                              : isHovered
                              ? '#f59e0b'
                              : isOverloaded
                              ? '#f97316'
                              : 'transparent'
                          }
                          strokeWidth={isSelected ? 6 : isHovered ? 4 : isOverloaded ? 3 : 0}
                          className="transition-all"
                        />
                      </g>
                    );
                  })}

                  {/* Hotspots Radar Rings */}
                  {showHotspots &&
                    densityAnalysis.hotspots.map((h, hIdx) => (
                      <g key={`hotspot-${hIdx}`} className="pointer-events-none">
                        <circle
                          cx={h.x}
                          cy={h.y}
                          r={h.level === 'critical' ? 36 : 26}
                          fill={h.level === 'critical' ? 'url(#heatGlowRed)' : 'url(#heatGlowOrange)'}
                        />
                        {h.level === 'critical' && (
                          <circle
                            cx={h.x}
                            cy={h.y}
                            r="28"
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="3"
                            strokeDasharray="6 4"
                            className="animate-spin"
                            style={{ transformOrigin: `${h.x}px ${h.y}px` }}
                          />
                        )}
                      </g>
                    ))}

                  {/* Heatmap Nodes Overlay */}
                  {showHeatmapNodes &&
                    densityAnalysis.contours.map((cAnalysis, cIdx) => {
                      const isContourSelected = selectedContourIndex === cIdx;
                      const dimOther = selectedContourIndex !== null && !isContourSelected;

                      return (
                        <g key={`nodes-c-${cIdx}`} opacity={dimOther ? 0.35 : 1}>
                          {cAnalysis.nodes.map((nInfo, nIdx) => {
                            const isSelected = selectedNode?.nodeId === nInfo.nodeId;
                            const isCritical = nInfo.level === 'critical';
                            const isDense = nInfo.level === 'dense';

                            const radius = isSelected
                              ? 12
                              : isCritical
                              ? 9
                              : isDense
                              ? 7.5
                              : nInfo.level === 'moderate'
                              ? 6
                              : 4.5;

                            return (
                              <g
                                key={`n-${cIdx}-${nIdx}`}
                                className="cursor-pointer group"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedContourIndex(cIdx);
                                  setSelectedNode(nInfo);
                                }}
                              >
                                {/* Active Selection Halo */}
                                {isSelected && (
                                  <circle
                                    cx={nInfo.x}
                                    cy={nInfo.y}
                                    r={radius + 8}
                                    fill="none"
                                    stroke="#3b82f6"
                                    strokeWidth="4"
                                  />
                                )}

                                {/* Critical pulsing halo */}
                                {isCritical && !isSelected && (
                                  <circle
                                    cx={nInfo.x}
                                    cy={nInfo.y}
                                    r={radius + 5}
                                    fill="none"
                                    stroke="#ef4444"
                                    strokeWidth="2.5"
                                    opacity="0.75"
                                  />
                                )}

                                {/* Main Anchor Point Circle */}
                                <circle
                                  cx={nInfo.x}
                                  cy={nInfo.y}
                                  r={radius}
                                  fill={nInfo.color}
                                  stroke={isSelected ? '#ffffff' : '#1c1917'}
                                  strokeWidth={isSelected ? 3.5 : 2}
                                  className="transition-transform group-hover:scale-125"
                                />
                              </g>
                            );
                          })}
                        </g>
                      );
                    })}
                </svg>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Metrics, Contour Breakdown & Quick Actions */}
          <div
            className={`w-full lg:w-96 border-t lg:border-t-0 lg:border-l flex flex-col overflow-hidden text-xs ${
              isLight ? 'bg-white border-stone-200' : 'bg-[#121d15] border-[#223528]'
            }`}
          >
            {/* Density Overview Card */}
            <div className="p-4 border-b border-stone-200 dark:border-[#223528] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-700 dark:text-emerald-300">アンカー密度総合評価</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                    densityAnalysis.overallDensityScore >= 70
                      ? 'bg-rose-500 text-white'
                      : densityAnalysis.overallDensityScore >= 40
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {densityAnalysis.overallDensityScore >= 70
                    ? '極度過密'
                    : densityAnalysis.overallDensityScore >= 40
                    ? '密集・要整理'
                    : '適正・軽量'}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={`p-2.5 rounded-xl border ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18261c] border-[#253a2b]'
                  }`}
                >
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">総アンカー数</div>
                  <div className="text-lg font-bold font-mono text-stone-900 dark:text-white flex items-baseline gap-1">
                    <span>{densityAnalysis.totalNodes}</span>
                    <span className="text-xs font-normal text-stone-400">個</span>
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-xl border ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18261c] border-[#253a2b]'
                  }`}
                >
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">過密・密集ノード</div>
                  <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 flex items-baseline gap-1">
                    <span>{densityAnalysis.criticalNodeCount + densityAnalysis.denseNodeCount}</span>
                    <span className="text-xs font-normal text-stone-400">
                      / {densityAnalysis.totalNodes}
                    </span>
                  </div>
                </div>
              </div>

              {/* Density Bar Meter */}
              <div>
                <div className="flex justify-between text-[11px] mb-1 font-semibold">
                  <span className="text-stone-600 dark:text-stone-300">密度分布</span>
                  <span className="text-stone-400 font-mono">
                    {densityAnalysis.criticalNodeCount}過密 / {densityAnalysis.denseNodeCount}密集 /{' '}
                    {densityAnalysis.optimalNodeCount}適正
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden flex">
                  {densityAnalysis.totalNodes > 0 && (
                    <>
                      <div
                        style={{
                          width: `${(densityAnalysis.criticalNodeCount / densityAnalysis.totalNodes) * 100}%`,
                        }}
                        className="bg-rose-500 h-full"
                        title={`過密: ${densityAnalysis.criticalNodeCount}ノード`}
                      />
                      <div
                        style={{
                          width: `${(densityAnalysis.denseNodeCount / densityAnalysis.totalNodes) * 100}%`,
                        }}
                        className="bg-amber-500 h-full"
                        title={`密集: ${densityAnalysis.denseNodeCount}ノード`}
                      />
                      <div
                        style={{
                          width: `${(densityAnalysis.moderateNodeCount / densityAnalysis.totalNodes) * 100}%`,
                        }}
                        className="bg-yellow-400 h-full"
                        title={`中度: ${densityAnalysis.moderateNodeCount}ノード`}
                      />
                      <div
                        style={{
                          width: `${(densityAnalysis.optimalNodeCount / densityAnalysis.totalNodes) * 100}%`,
                        }}
                        className="bg-emerald-500 h-full"
                        title={`適正: ${densityAnalysis.optimalNodeCount}ノード`}
                      />
                    </>
                  )}
                </div>
              </div>

              {lastActionMessage && (
                <div
                  className={`p-2 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border animate-fade-in ${
                    isLight
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate">{lastActionMessage}</span>
                </div>
              )}
            </div>

            {/* Contours List Section */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5">
              <div className="flex items-center justify-between font-bold text-stone-700 dark:text-emerald-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>輪郭別ノード内訳 ({densityAnalysis.contours.length} 輪郭)</span>
                </span>
                <span className="text-[10px] text-stone-400 font-normal">
                  クリックで輪郭選択 / 単純化
                </span>
              </div>

              {densityAnalysis.contours.map((cAnalysis, cIdx) => {
                const isSelected = selectedContourIndex === cIdx;
                const isOverloaded = cAnalysis.densityScore >= 45 || cAnalysis.criticalCount > 0;

                return (
                  <div
                    key={`c-item-${cIdx}`}
                    onClick={() => setSelectedContourIndex(cIdx)}
                    onMouseEnter={() => setHoveredContourIndex(cIdx)}
                    onMouseLeave={() => setHoveredContourIndex(null)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? isLight
                          ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                          : 'bg-[#182c20] border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs'
                        : isLight
                        ? 'bg-stone-50 border-stone-200 hover:border-stone-300'
                        : 'bg-[#152219] border-[#223528] hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs">輪郭 #{cIdx + 1}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            cAnalysis.level === 'critical'
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                              : cAnalysis.level === 'dense'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              : cAnalysis.level === 'moderate'
                              ? 'bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          }`}
                        >
                          {cAnalysis.level === 'critical'
                            ? '極度過密'
                            : cAnalysis.level === 'dense'
                            ? '密集'
                            : cAnalysis.level === 'moderate'
                            ? '中度'
                            : '適正'}
                        </span>
                      </div>

                      <span className="font-mono font-bold text-xs text-stone-700 dark:text-stone-300">
                        {cAnalysis.nodeCount} <span className="font-normal text-[10px] text-stone-400">ノード</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 mb-2">
                      <span>平均間隔: {cAnalysis.avgNodeDistance}px</span>
                      {cAnalysis.estimatedReduction > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          約 -{cAnalysis.estimatedReduction} ノード削減見込み
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">最適状態</span>
                      )}
                    </div>

                    {/* Single Contour Simplify Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSimplifyContour(cIdx);
                      }}
                      className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors border shadow-xs ${
                        isOverloaded
                          ? isLight
                            ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700'
                            : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500'
                          : isLight
                          ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                          : 'bg-[#1b2b20] hover:bg-[#253b2d] text-emerald-200 border-[#294231]'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>この輪郭を即時単純化</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer / Tip */}
            <div
              className={`p-3 border-t text-[11px] flex flex-col gap-2 ${
                isLight ? 'bg-stone-50 border-stone-200 text-stone-500' : 'bg-[#0e1610] border-[#223528] text-stone-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>
                  SVGキャンバス上のアンカー頂点を直接クリックすると、その箇所のみをピンポイントで単純化できます。
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-stone-400 dark:text-stone-500">
                <span className="font-semibold text-stone-500 dark:text-stone-400">ショートカット:</span>
                <span className="px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-800 font-mono text-stone-700 dark:text-stone-300">Enter: 一括単純化</span>
                <span className="px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-800 font-mono text-stone-700 dark:text-stone-300">1~3: 強度切替</span>
                <span className="px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-800 font-mono text-stone-700 dark:text-stone-300">P: ノード点</span>
                <span className="px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-800 font-mono text-stone-700 dark:text-stone-300">Ctrl+Z: 元に戻す</span>
                <span className="px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-800 font-mono text-stone-700 dark:text-stone-300">+/-: ズーム</span>
                <span className="px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-800 font-mono text-stone-700 dark:text-stone-300">F: 全画面</span>
                <span className="px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-800 font-mono text-stone-700 dark:text-stone-300">Esc: 閉じる</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
