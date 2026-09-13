import React, { useState, useMemo } from 'react';
import {
  FlipHorizontal,
  FlipVertical,
  Italic,
  Maximize2,
  Minimize2,
  AlignCenter,
  Trash2,
  Wand2,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  Minimize,
  Sliders,
} from 'lucide-react';
import { PathContour } from '../types';
import {
  flipContoursHorizontal,
  flipContoursVertical,
  slantContours,
  scaleContours,
  centerContoursInBox,
  getContoursBoundingBox,
  outlineOpenContour,
  createSmallKanaContours,
  simplifyGlyphContours,
  SimplifyGlyphOptions,
} from '../utils/pathUtils';
import {
  calculateOptimalSpacing,
  AutoSpacingPreset,
  SidebearingBatchOptions,
} from '../utils/metricsHelper';
import { ThemeMode } from '../utils/theme';

interface MetricsPanelProps {
  advanceWidth: number;
  lsb: number;
  onChangeAdvanceWidth: (val: number) => void;
  onChangeLsb: (val: number) => void;
  contours: PathContour[];
  onChangeContours: (contours: PathContour[]) => void;
  onCommitHistory: () => void;
  selectedChar: string;
  selectedUnicode: number;
  isOpen?: boolean;
  onClose?: () => void;
  theme: ThemeMode;
  isOverlay?: boolean;
  // Navigation Callbacks
  onSelectPrevGlyph?: () => void;
  onSelectNextGlyph?: () => void;
  onSelectPrevUncompletedGlyph?: () => void;
  onSelectNextUncompletedGlyph?: () => void;
  // Feature Callbacks
  onAutoSpaceGlyph?: (preset: AutoSpacingPreset) => void;
  onSimplifyGlyph?: (level: 'mild' | 'normal' | 'strong') => void;
  onShowToast?: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = React.memo(({
  advanceWidth,
  lsb,
  onChangeAdvanceWidth,
  onChangeLsb,
  contours,
  onChangeContours,
  onCommitHistory,
  selectedChar,
  selectedUnicode,
  isOpen = true,
  onClose,
  theme,
  isOverlay,
  onSelectPrevGlyph,
  onSelectNextGlyph,
  onSelectPrevUncompletedGlyph,
  onSelectNextUncompletedGlyph,
  onAutoSpaceGlyph,
  onSimplifyGlyph,
  onShowToast,
}) => {
  const [strokeOutlineWidth, setStrokeOutlineWidth] = useState<number>(60);
  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);
  const [simplifyLevel, setSimplifyLevel] = useState<'mild' | 'normal' | 'strong'>('normal');
  const [spacingPreset, setSpacingPreset] = useState<AutoSpacingPreset>('smart');

  const bbox = useMemo(() => getContoursBoundingBox(contours), [contours]);
  const isLight = theme === 'light';
  const effectiveIsOverlay = isOverlay !== undefined ? isOverlay : false;

  // Node count summary
  const totalNodes = useMemo(() => {
    return contours.reduce((acc, c) => acc + (c.nodes ? c.nodes.length : 0), 0);
  }, [contours]);

  // Handle Simplify execution
  const handleExecuteSimplify = () => {
    if (contours.length === 0) {
      onShowToast?.('単純化する輪郭がありません', 'warning');
      return;
    }

    if (onSimplifyGlyph) {
      onSimplifyGlyph(simplifyLevel);
      return;
    }

    // Direct fallback
    onCommitHistory();
    const result = simplifyGlyphContours(contours, {
      level: simplifyLevel,
      preserveSharpCorners: true,
    });

    onChangeContours(result.contours);
    if (result.changed) {
      onShowToast?.(
        `輪郭を単純化しました: 頂点数 ${result.originalNodeCount}点 → ${result.optimizedNodeCount}点 (${result.reductionPercentage}% 削減)`,
        'success'
      );
    } else {
      onShowToast?.('既に最適な頂点配置です (削除対象の重複・余剰ノードなし)', 'info');
    }
  };

  // Handle Auto-Spacing execution
  const handleExecuteAutoSpacing = (preset: AutoSpacingPreset = spacingPreset) => {
    if (contours.length === 0) {
      onShowToast?.('字形が作図されていません', 'warning');
      return;
    }

    if (onAutoSpaceGlyph) {
      onAutoSpaceGlyph(preset);
      return;
    }

    // Direct fallback
    onCommitHistory();
    const result = calculateOptimalSpacing(selectedUnicode, contours, preset);
    onChangeContours(result.contours);
    onChangeAdvanceWidth(result.advanceWidth);
    onChangeLsb(result.lsb);

    const presetLabel =
      preset === 'smart'
        ? 'スマート自動'
        : preset === 'japanese-fullwidth'
        ? '和文全角センタリング (1000EM)'
        : preset === 'proportional-tight'
        ? '欧文タイト'
        : preset === 'proportional-loose'
        ? '欧文ルーズ'
        : '欧文プロポーショナル';

    onShowToast?.(
      `オートスペーシング適用 [${presetLabel}]: 送り幅 ${result.advanceWidth}px, 左余白 ${result.lsb}px`,
      'success'
    );
  };

  const handleFlipH = () => {
    if (contours.length === 0) return;
    onCommitHistory();
    onChangeContours(flipContoursHorizontal(contours));
  };

  const handleFlipV = () => {
    if (contours.length === 0) return;
    onCommitHistory();
    onChangeContours(flipContoursVertical(contours));
  };

  const handleSlant = (angle: number) => {
    if (contours.length === 0) return;
    onCommitHistory();
    onChangeContours(slantContours(contours, angle));
  };

  const handleScale = (factor: number) => {
    if (contours.length === 0) return;
    onCommitHistory();
    onChangeContours(scaleContours(contours, factor, factor));
  };

  const handleCenter = () => {
    if (contours.length === 0) return;
    onCommitHistory();
    const centered = centerContoursInBox(contours, advanceWidth, 800);
    onChangeContours(centered);
    const newBbox = getContoursBoundingBox(centered);
    onChangeLsb(Math.max(0, Math.round(newBbox.minX)));
  };

  const handleAutoFitAdvance = () => {
    if (contours.length === 0 || bbox.width <= 0) return;
    onCommitHistory();
    const sideMargin = selectedUnicode > 255 ? 100 : 50;
    const newAdv = Math.max(200, Math.round(bbox.width + sideMargin * 2));
    onChangeAdvanceWidth(newAdv);
    const centered = centerContoursInBox(contours, newAdv, 800);
    onChangeContours(centered);
    const newBbox = getContoursBoundingBox(centered);
    onChangeLsb(Math.max(0, Math.round(newBbox.minX)));
  };

  const handleExecuteClear = () => {
    if (contours.length === 0) return;
    onCommitHistory();
    onChangeContours([]);
    setIsConfirmingClear(false);
  };

  const handleOutlineStrokePaths = () => {
    if (contours.length === 0) return;
    onCommitHistory();
    const transformed = contours.map((c) => (c.closed ? c : outlineOpenContour(c, strokeOutlineWidth)));
    onChangeContours(transformed);
  };

  const handleConvertToSmallKana = () => {
    if (contours.length === 0) return;
    onCommitHistory();
    onChangeContours(createSmallKanaContours(contours));
  };

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

      <div
        className={`${
          effectiveIsOverlay
            ? 'fixed inset-y-0 right-0 z-40 w-full sm:w-80 sm:max-w-sm shadow-2xl animate-in slide-in-from-right duration-200'
            : 'relative z-10 w-72 lg:w-80 shadow-none shrink-0'
        } border-l flex flex-col h-full p-3 space-y-3.5 overflow-y-auto select-none transition-colors ${
          isLight
            ? 'bg-[#f7faf8] border-[#d8e6df] text-stone-800'
            : 'bg-[#151e18] border-[#25362b] text-emerald-100'
        }`}
      >
        {/* Header with Title and Close Button */}
        <div className="flex items-center justify-between pb-2 border-b border-[#d8e6df] dark:border-[#25362b]">
          <div className="flex items-center space-x-1.5">
            <Sliders className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span className={`text-xs font-bold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
              メトリクス・文字ツール
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-[#25362b] text-stone-500"
              title="パネルを閉じる (作図エリアを最大化)"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 1. Fast Glyph Navigation & Active Character Card */}
        <div
          className={`flex flex-col p-2.5 rounded-lg border space-y-2 ${
            isLight ? 'bg-white border-[#d8e6df] shadow-xs' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div
                className={`w-11 h-11 rounded-lg border flex items-center justify-center text-center font-bold shrink-0 ${
                  isLight
                    ? 'bg-[#f0f7f3] border-emerald-300 text-emerald-950 shadow-xs'
                    : 'bg-[#101813] border-emerald-700 text-emerald-300'
                }`}
              >
                {selectedUnicode === 0x3000 ? (
                  <span className="text-[10px] leading-tight">全角<br />空白</span>
                ) : selectedUnicode === 0x0020 ? (
                  <span className="text-[10px] leading-tight">半角<br />空白</span>
                ) : (
                  <span className="text-2xl">{selectedChar || '・'}</span>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className={`text-xs font-bold truncate ${isLight ? 'text-emerald-950' : 'text-emerald-200'}`}>
                  {selectedUnicode === 0x3000
                    ? '全角空白 (U+3000)'
                    : selectedUnicode === 0x0020
                    ? '半角空白 (U+0020)'
                    : selectedChar
                    ? `文字: 「${selectedChar}」`
                    : '未選択'}
                </span>
                <span className={`text-[10px] font-mono ${isLight ? 'text-stone-500' : 'text-emerald-400'}`}>
                  U+{selectedUnicode.toString(16).toUpperCase().padStart(4, '0')} • {contours.length}パス ({totalNodes}頂点)
                </span>
              </div>
            </div>
          </div>

          {/* Sequential & Skip Navigation Buttons */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-stone-100 dark:border-stone-800">
            {/* Sequential Step Prev / Next */}
            <div className="flex items-center space-x-1">
              <button
                onClick={onSelectPrevGlyph}
                disabled={!onSelectPrevGlyph}
                className={`flex-1 py-1 px-1.5 rounded border text-[10px] font-bold flex items-center justify-center space-x-0.5 transition-all active:scale-95 disabled:opacity-40 ${
                  isLight
                    ? 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
                    : 'bg-[#101813] hover:bg-[#1f2d24] border-[#25362b] text-emerald-200'
                }`}
                title="前の文字へ (ショートカット: Alt+← または PageUp)"
              >
                <ChevronLeft className="w-3 h-3 shrink-0" />
                <span>前文字</span>
              </button>
              <button
                onClick={onSelectNextGlyph}
                disabled={!onSelectNextGlyph}
                className={`flex-1 py-1 px-1.5 rounded border text-[10px] font-bold flex items-center justify-center space-x-0.5 transition-all active:scale-95 disabled:opacity-40 ${
                  isLight
                    ? 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
                    : 'bg-[#101813] hover:bg-[#1f2d24] border-[#25362b] text-emerald-200'
                }`}
                title="次の文字へ (ショートカット: Alt+→ または PageDown)"
              >
                <span>次文字</span>
                <ChevronRight className="w-3 h-3 shrink-0" />
              </button>
            </div>

            {/* Skip Uncompleted Next / Prev */}
            <div className="flex items-center space-x-1">
              <button
                onClick={onSelectPrevUncompletedGlyph}
                disabled={!onSelectPrevUncompletedGlyph}
                className={`flex-1 py-1 px-1 rounded border text-[9px] font-bold flex items-center justify-center space-x-0.5 transition-all active:scale-95 disabled:opacity-40 ${
                  isLight
                    ? 'bg-amber-50/70 hover:bg-amber-100 border-amber-300 text-amber-900'
                    : 'bg-amber-950/40 hover:bg-amber-900/60 border-amber-800 text-amber-200'
                }`}
                title="前の未作成グリフへスキップ (Alt+P または Cmd/Ctrl+Shift+←)"
              >
                <span>未作←</span>
              </button>
              <button
                onClick={onSelectNextUncompletedGlyph}
                disabled={!onSelectNextUncompletedGlyph}
                className={`flex-1 py-1 px-1 rounded border text-[9px] font-bold flex items-center justify-center space-x-0.5 transition-all active:scale-95 disabled:opacity-40 ${
                  isLight
                    ? 'bg-amber-50/70 hover:bg-amber-100 border-amber-300 text-amber-900'
                    : 'bg-amber-950/40 hover:bg-amber-900/60 border-amber-800 text-amber-200'
                }`}
                title="次の未作成グリフへジャンプ (Alt+N または Cmd/Ctrl+Shift+→)"
              >
                <span>→未作</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Simplify (輪郭の単純化・頂点数削減) Section */}
        <div
          className={`flex flex-col p-2.5 rounded-lg border space-y-2 ${
            isLight ? 'bg-white border-[#d8e6df] shadow-xs' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center space-x-1 text-emerald-800 dark:text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-current" />
              <span>輪郭の単純化 (Simplify)</span>
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-stone-100 dark:bg-[#101813] text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
              現在: {totalNodes} 頂点
            </span>
          </div>

          <p className="text-[10px] leading-tight text-stone-600 dark:text-emerald-300/80">
            不要なアンカーポイント（重複・共線点）を自動削除し、美しい字形を保ちながらファイル容量を削減します。
          </p>

          {/* Strength Selector */}
          <div className="grid grid-cols-3 gap-1 pt-0.5 text-[10px]">
            <button
              onClick={() => setSimplifyLevel('mild')}
              className={`py-1 rounded font-bold border transition-all ${
                simplifyLevel === 'mild'
                  ? isLight
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-950 shadow-xs'
                    : 'bg-emerald-950 border-emerald-600 text-emerald-200'
                  : isLight
                  ? 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                  : 'bg-[#101813] border-[#25362b] text-stone-400'
              }`}
              title="形状保持 100%: 直線上の不要ノードと重複ノードのみ除去"
            >
              軽め (Mild)
            </button>
            <button
              onClick={() => setSimplifyLevel('normal')}
              className={`py-1 rounded font-bold border transition-all ${
                simplifyLevel === 'normal'
                  ? isLight
                    ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                    : 'bg-emerald-600 text-stone-950 border-emerald-500 font-bold'
                  : isLight
                  ? 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                  : 'bg-[#101813] border-[#25362b] text-stone-400'
              }`}
              title="推奨: 形状保持 99.8%、手描き線の微細ブレを整流してスリム化"
            >
              標準 (Normal)
            </button>
            <button
              onClick={() => setSimplifyLevel('strong')}
              className={`py-1 rounded font-bold border transition-all ${
                simplifyLevel === 'strong'
                  ? isLight
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-amber-600 text-stone-950 border-amber-500 font-bold'
                  : isLight
                  ? 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                  : 'bg-[#101813] border-[#25362b] text-stone-400'
              }`}
              title="強力: 大幅な頂点削減。データ容量を最優先で削減"
            >
              強め (Strong)
            </button>
          </div>

          {/* Action Button */}
          <button
            onClick={handleExecuteSimplify}
            disabled={contours.length === 0 || totalNodes === 0}
            className={`w-full py-1.5 px-3 rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-xs active:scale-95 disabled:opacity-40 ${
              isLight
                ? 'bg-emerald-800 hover:bg-emerald-700 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold'
            }`}
            title="現在のグリフの全輪郭を単純化 (ショートカット: Alt+S)"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>輪郭を単純化 (Simplify)</span>
          </button>
        </div>

        {/* 3. Auto-Spacing (サイドベアリング自動設定) Section */}
        <div
          className={`flex flex-col p-2.5 rounded-lg border space-y-2 ${
            isLight ? 'bg-white border-[#d8e6df] shadow-xs' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center space-x-1 text-emerald-800 dark:text-emerald-300">
              <AlignCenter className="w-3.5 h-3.5" />
              <span>サイドベアリング自動設定 (Auto-Spacing)</span>
            </span>
          </div>

          <p className="text-[10px] leading-tight text-stone-600 dark:text-emerald-300/80">
            文字の実幅と形状の光学バランスに応じて、最適な送り幅(Advance)と左右余白(LSB/RSB)を自動計算します。
          </p>

          {/* Preset Buttons */}
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <button
              onClick={() => {
                setSpacingPreset('smart');
                handleExecuteAutoSpacing('smart');
              }}
              className={`p-1.5 rounded border text-left flex flex-col transition-all ${
                spacingPreset === 'smart'
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                    : 'bg-emerald-950/80 border-emerald-700 text-emerald-200 font-bold'
                  : isLight
                  ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                  : 'bg-[#101813] border-[#25362b] text-stone-300'
              }`}
            >
              <span>スマート自動</span>
              <span className="text-[9px] opacity-70 font-normal">和文=全角 / 欧文=光学</span>
            </button>

            <button
              onClick={() => {
                setSpacingPreset('japanese-fullwidth');
                handleExecuteAutoSpacing('japanese-fullwidth');
              }}
              className={`p-1.5 rounded border text-left flex flex-col transition-all ${
                spacingPreset === 'japanese-fullwidth'
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                    : 'bg-emerald-950/80 border-emerald-700 text-emerald-200 font-bold'
                  : isLight
                  ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                  : 'bg-[#101813] border-[#25362b] text-stone-300'
              }`}
            >
              <span>和文全角 (1000EM)</span>
              <span className="text-[9px] opacity-70 font-normal">左右均等センタリング</span>
            </button>

            <button
              onClick={() => {
                setSpacingPreset('proportional-balanced');
                handleExecuteAutoSpacing('proportional-balanced');
              }}
              className={`p-1.5 rounded border text-left flex flex-col transition-all ${
                spacingPreset === 'proportional-balanced'
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                    : 'bg-emerald-950/80 border-emerald-700 text-emerald-200 font-bold'
                  : isLight
                  ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                  : 'bg-[#101813] border-[#25362b] text-stone-300'
              }`}
            >
              <span>欧文標準プロポーショナル</span>
              <span className="text-[9px] opacity-70 font-normal">字形ごとの光学余白</span>
            </button>

            <button
              onClick={() => {
                setSpacingPreset('proportional-tight');
                handleExecuteAutoSpacing('proportional-tight');
              }}
              className={`p-1.5 rounded border text-left flex flex-col transition-all ${
                spacingPreset === 'proportional-tight'
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                    : 'bg-emerald-950/80 border-emerald-700 text-emerald-200 font-bold'
                  : isLight
                  ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                  : 'bg-[#101813] border-[#25362b] text-stone-300'
              }`}
            >
              <span>欧文タイト (詰まり)</span>
              <span className="text-[9px] opacity-70 font-normal">余白を狭めて配置</span>
            </button>
          </div>

          {/* Quick Trigger Button */}
          <button
            onClick={() => handleExecuteAutoSpacing(spacingPreset)}
            disabled={contours.length === 0}
            className={`w-full py-1.5 px-3 rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-xs active:scale-95 disabled:opacity-40 ${
              isLight
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold'
            }`}
            title="サイドベアリングを自動適用 (ショートカット: Shift+Alt+S)"
          >
            <AlignCenter className="w-3.5 h-3.5" />
            <span>オートスペーシング適用 (Shift+Alt+S)</span>
          </button>
        </div>

        {/* 4. Manual Metrics Adjustment (送り幅 & LSB) */}
        <div className="flex flex-col space-y-2">
          <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-emerald-900' : 'text-emerald-300'}`}>
            メトリクス数値指定
          </span>

          <div className="grid grid-cols-2 gap-2">
            <div
              className={`flex flex-col space-y-1 p-2 rounded-md border ${
                isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
              }`}
            >
              <label className={`text-[10px] font-medium ${isLight ? 'text-stone-600' : 'text-emerald-400'}`}>
                送り幅 (Advance)
              </label>
              <input
                type="number"
                value={advanceWidth}
                onChange={(e) => {
                  onChangeAdvanceWidth(Number(e.target.value) || 1000);
                  onCommitHistory();
                }}
                className={`border rounded px-2 py-1 text-xs font-mono focus:outline-none ${
                  isLight
                    ? 'bg-[#f7faf8] border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                    : 'bg-[#0f1712] border-[#2d4034] text-emerald-200 focus:border-emerald-500'
                }`}
                step={10}
              />
            </div>

            <div
              className={`flex flex-col space-y-1 p-2 rounded-md border ${
                isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
              }`}
            >
              <label className={`text-[10px] font-medium ${isLight ? 'text-stone-600' : 'text-emerald-400'}`}>
                左余白 (LSB)
              </label>
              <input
                type="number"
                value={lsb}
                onChange={(e) => {
                  onChangeLsb(Number(e.target.value) || 0);
                  onCommitHistory();
                }}
                className={`border rounded px-2 py-1 text-xs font-mono focus:outline-none ${
                  isLight
                    ? 'bg-[#f7faf8] border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                    : 'bg-[#0f1712] border-[#2d4034] text-emerald-200 focus:border-emerald-500'
                }`}
                step={5}
              />
            </div>
          </div>

          {/* Bounding Box & Margin Balance Readout */}
          {contours.length > 0 && bbox.width > 0 && (() => {
            const actualLsb = Math.round(bbox.minX);
            const actualRsb = Math.round(advanceWidth - bbox.maxX);
            const diff = actualLsb - actualRsb;
            const isLeftLeaning = diff < -15;
            const isRightLeaning = diff > 15;
            const isBalanced = !isLeftLeaning && !isRightLeaning;

            return (
              <div
                className={`p-2.5 rounded-md border space-y-1.5 ${
                  isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className={isLight ? 'text-stone-700' : 'text-emerald-300'}>左右余白バランス</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      isBalanced
                        ? isLight
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-emerald-950 text-emerald-300'
                        : isLeftLeaning
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                    }`}
                  >
                    {isBalanced ? '✓ 左右均等' : isLeftLeaning ? `左寄り (${Math.abs(Math.round(diff / 2))}px)` : `右寄り (${Math.round(diff / 2)}px)`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                  <div className={`p-1.5 rounded ${isLight ? 'bg-[#edf5f0]' : 'bg-[#121a14]'}`}>
                    <div className="text-stone-500">実LSB: {actualLsb} px</div>
                  </div>
                  <div className={`p-1.5 rounded ${isLight ? 'bg-[#edf5f0]' : 'bg-[#121a14]'}`}>
                    <div className="text-stone-500">実RSB: {actualRsb} px</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* 5. Transform Tools (Slant, Flip, Scale) */}
        <div className="flex flex-col space-y-2">
          <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-emerald-900' : 'text-emerald-300'}`}>
            傾斜・変形・配置
          </span>

          {/* Slant Quick Presets */}
          <div
            className={`p-2 rounded-md border space-y-1.5 ${
              isLight ? 'bg-[#edf5f0] border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
            }`}
          >
            <div className="flex items-center space-x-1 text-[11px] font-bold">
              <Italic className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>傾斜 (Slant)</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[-15, -10, -5, 5, 10, 12, 15, 20].map((deg) => (
                <button
                  key={deg}
                  onClick={() => handleSlant(deg)}
                  className={`py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                    isLight
                      ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-100'
                      : 'bg-[#121a14] border-[#25362b] text-emerald-200 hover:bg-[#1d2b20]'
                  }`}
                >
                  {deg > 0 ? `+${deg}°` : `${deg}°`}
                </button>
              ))}
            </div>
          </div>

          {/* Flip & Scale */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={handleFlipH}
              className={`px-2 py-1.5 rounded-md border text-xs font-medium flex items-center justify-center space-x-1 transition-colors ${
                isLight
                  ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-100'
                  : 'bg-[#18231c] border-[#25362b] text-emerald-200 hover:bg-[#202e25]'
              }`}
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
              <span>左右反転</span>
            </button>

            <button
              onClick={handleFlipV}
              className={`px-2 py-1.5 rounded-md border text-xs font-medium flex items-center justify-center space-x-1 transition-colors ${
                isLight
                  ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-100'
                  : 'bg-[#18231c] border-[#25362b] text-emerald-200 hover:bg-[#202e25]'
              }`}
            >
              <FlipVertical className="w-3.5 h-3.5" />
              <span>上下反転</span>
            </button>

            <button
              onClick={() => handleScale(1.1)}
              className={`px-2 py-1.5 rounded-md border text-xs font-medium flex items-center justify-center space-x-1 transition-colors ${
                isLight
                  ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-100'
                  : 'bg-[#18231c] border-[#25362b] text-emerald-200 hover:bg-[#202e25]'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>拡大 +10%</span>
            </button>

            <button
              onClick={() => handleScale(0.9)}
              className={`px-2 py-1.5 rounded-md border text-xs font-medium flex items-center justify-center space-x-1 transition-colors ${
                isLight
                  ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-100'
                  : 'bg-[#18231c] border-[#25362b] text-emerald-200 hover:bg-[#202e25]'
              }`}
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>縮小 -10%</span>
            </button>
          </div>

          <button
            onClick={handleCenter}
            className={`w-full py-1.5 rounded-md border text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors ${
              isLight
                ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-100'
                : 'bg-[#18231c] border-[#25362b] text-emerald-200 hover:bg-[#202e25]'
            }`}
          >
            <AlignCenter className="w-3.5 h-3.5" />
            <span>文字枠の中央に配置</span>
          </button>

          {/* Small Kana Helper */}
          <button
            onClick={handleConvertToSmallKana}
            className={`w-full py-1.5 rounded-md border text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors ${
              isLight
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                : 'bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60'
            }`}
            title="通常の文字を小文字用（ぁ, ッ等）の位置とサイズに自動縮小"
          >
            <Wand2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>小文字サイズ・位置に変換</span>
          </button>
        </div>

        {/* 6. Outline Stroke Paths */}
        <div
          className={`flex flex-col space-y-2 p-2.5 rounded-md border ${
            isLight ? 'bg-[#edf5f0] border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <span className={`text-[11px] font-bold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
            骨格線の肉付け（アウトライン化）
          </span>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min={20}
              max={140}
              step={5}
              value={strokeOutlineWidth}
              onChange={(e) => setStrokeOutlineWidth(Number(e.target.value))}
              className="flex-1 accent-emerald-700"
            />
            <span className={`text-[11px] font-mono w-10 text-right ${isLight ? 'text-stone-700' : 'text-emerald-300'}`}>
              {strokeOutlineWidth}px
            </span>
          </div>
          <button
            onClick={handleOutlineStrokePaths}
            className={`w-full py-1.5 rounded text-xs font-semibold flex items-center justify-center space-x-1 transition-colors ${
              isLight ? 'bg-emerald-800 text-white hover:bg-emerald-900' : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            <span>骨格線をアウトライン化</span>
          </button>
        </div>

        {/* 7. Clear Button */}
        <div className="pt-1">
          {isConfirmingClear ? (
            <div className="flex items-center space-x-1.5 animate-in fade-in duration-150">
              <button
                onClick={handleExecuteClear}
                className="flex-1 py-1.5 px-2 rounded-md border text-xs font-bold flex items-center justify-center space-x-1 transition-colors shadow-sm bg-rose-600 hover:bg-rose-700 text-white border-rose-700"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>本当に全消去する</span>
              </button>
              <button
                onClick={() => setIsConfirmingClear(false)}
                className={`py-1.5 px-2.5 rounded-md border text-xs font-medium transition-colors ${
                  isLight
                    ? 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300'
                    : 'bg-[#1a261f] hover:bg-[#25362b] text-stone-300 border-[#2d4034]'
                }`}
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (contours.length === 0) return;
                setIsConfirmingClear(true);
              }}
              disabled={contours.length === 0}
              className={`w-full py-1.5 rounded-md border text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-40 ${
                isLight
                  ? 'border-rose-300 text-rose-700 hover:bg-rose-50'
                  : 'border-rose-900/60 text-rose-400 hover:bg-rose-950/40'
              }`}
              title="現在のグリフのすべての輪郭を消去 (Ctrl+Zで元に戻せます)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>字形を全消去</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
});
