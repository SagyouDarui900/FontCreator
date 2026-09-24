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
  Sliders,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Check,
  MoveHorizontal,
  Layers,
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
} from '../utils/pathUtils';
import {
  calculateOptimalSpacing,
  AutoSpacingPreset,
} from '../utils/metricsHelper';
import { ThemeMode, isLightTheme, getThemeClasses } from '../utils/theme';

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
  const [expandedSections, setExpandedSections] = useState<{
    nav: boolean;
    simplify: boolean;
    autospace: boolean;
    metrics: boolean;
    transform: boolean;
    outline: boolean;
  }>({
    nav: true,
    simplify: false,
    autospace: false,
    metrics: true,
    transform: true,
    outline: false,
  });

  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isAllExpanded = Object.values(expandedSections).every(Boolean);
  const handleToggleAll = () => {
    const next = !isAllExpanded;
    setExpandedSections({
      nav: next,
      simplify: next,
      autospace: next,
      metrics: next,
      transform: next,
      outline: next,
    });
  };

  const bbox = useMemo(() => getContoursBoundingBox(contours), [contours]);
  const isLight = isLightTheme(theme);
  const themeClasses = getThemeClasses(theme);
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

  // Horizontal Centering within current Advance Width
  const handleCenterWithinAdvance = () => {
    if (contours.length === 0 || bbox.width <= 0) {
      onShowToast?.('センタリングする輪郭がありません', 'warning');
      return;
    }
    onCommitHistory();
    const currentAdv = advanceWidth || 1000;
    const targetLsb = Math.round((currentAdv - bbox.width) / 2);
    const deltaX = targetLsb - bbox.minX;

    const shifted = contours.map((c) => ({
      ...c,
      nodes: c.nodes.map((n) => ({
        ...n,
        x: Math.round(n.x + deltaX),
        inX: n.inX !== undefined ? Math.round(n.inX + deltaX) : undefined,
        outX: n.outX !== undefined ? Math.round(n.outX + deltaX) : undefined,
      })),
    }));

    onChangeContours(shifted);
    onChangeLsb(targetLsb);
    onShowToast?.(`文字を送り幅(${currentAdv}px)の中央に配置しました (LSB/RSB: ${targetLsb}px)`, 'success');
  };

  // Step adjustments for Advance & LSB
  const handleStepAdvance = (delta: number) => {
    const nextVal = Math.max(100, Math.round((advanceWidth || 1000) + delta));
    onChangeAdvanceWidth(nextVal);
    onCommitHistory();
  };

  const handleStepLsb = (delta: number) => {
    const nextVal = Math.round((lsb ?? 50) + delta);
    onChangeLsb(nextVal);
    onCommitHistory();
  };

  // Preset Advance width setters
  const handleSetAdvancePreset = (preset: number) => {
    onChangeAdvanceWidth(preset);
    onCommitHistory();
    onShowToast?.(`送り幅を ${preset}px に設定しました`, 'info');
  };

  const handleSetLsbPreset = (preset: number) => {
    onChangeLsb(preset);
    onCommitHistory();
    onShowToast?.(`左余白(LSB)を ${preset}px に設定しました`, 'info');
  };

  // Transformation actions
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

  const handleSlant = (degrees: number) => {
    if (contours.length === 0) return;
    onCommitHistory();
    onChangeContours(slantContours(contours, degrees));
  };

  const handleScale = (factor: number) => {
    if (contours.length === 0) return;
    onCommitHistory();
    onChangeContours(scaleContours(contours, factor, factor));
  };

  const handleCenter = () => {
    if (contours.length === 0) return;
    onCommitHistory();
    onChangeContours(centerContoursInBox(contours, 1000, 1000));
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
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 animate-in fade-in duration-150"
        />
      )}

      <div
        className={`${
          effectiveIsOverlay
            ? 'fixed inset-y-0 right-0 z-50 w-full sm:w-96 max-w-full shadow-2xl animate-in slide-in-from-right duration-200'
            : 'relative z-10 w-72 lg:w-80 shadow-none shrink-0'
        } border-l flex flex-col h-full overflow-hidden select-none transition-colors ${themeClasses.sidebarBg} ${
          isLight ? 'border-[#d8e6df]' : 'border-[#25362b]'
        }`}
      >
        {/* Sticky Mobile/Desktop Header */}
        <div
          className={`flex items-center justify-between p-3 border-b shrink-0 z-10 ${
            isLight ? 'bg-white/95 border-[#d8e6df]' : 'bg-[#141e17]/95 border-[#25362b]'
          } backdrop-blur-sm`}
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 8px, 12px)' }}
        >
          <div className="flex items-center space-x-2 min-w-0">
            <div className={`p-1.5 rounded-lg shrink-0 ${isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950 text-emerald-400'}`}>
              <Sliders className="w-4 h-4 shrink-0" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`text-xs font-extrabold truncate ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                メトリクス・文字ツール
              </span>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                送り幅・余白・変形・単純化
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={handleToggleAll}
              className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-stone-50 border-[#d8e6df] text-stone-700 hover:bg-emerald-50'
                  : 'bg-[#18231c] border-[#25362b] text-emerald-300 hover:bg-[#202d24]'
              }`}
              title={isAllExpanded ? 'すべての項目を折りたたむ' : 'すべての項目を展開'}
            >
              {isAllExpanded ? '全閉' : '全開'}
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 text-xs font-bold shadow-xs active:scale-95 cursor-pointer ${
                  isLight
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-stone-950'
                }`}
                title="パネルを閉じる (作図エリアへ戻る)"
              >
                <X className="w-4 h-4 shrink-0" />
                <span>閉じる</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Panel Content */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3"
          style={{
            paddingBottom: effectiveIsOverlay
              ? 'max(env(safe-area-inset-bottom, 0px) + 80px, 90px)'
              : 'max(env(safe-area-inset-bottom, 0px) + 20px, 24px)',
          }}
        >
          {/* 1. Fast Glyph Navigation & Active Character Card */}
          <div
            className={`flex flex-col rounded-xl border overflow-hidden shadow-xs transition-colors ${
              isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
            }`}
          >
            <div
              onClick={() => toggleSection('nav')}
              className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                isLight ? 'hover:bg-stone-50' : 'hover:bg-[#1f2d24]'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center text-center font-bold shrink-0 ${
                    isLight
                      ? 'bg-[#f0f7f3] border-emerald-300 text-emerald-950 shadow-xs'
                      : 'bg-[#101813] border-emerald-700 text-emerald-300'
                  }`}
                >
                  {selectedUnicode === 0x3000 ? (
                    <span className="text-[9px] leading-tight">全角<br />空白</span>
                  ) : selectedUnicode === 0x0020 ? (
                    <span className="text-[9px] leading-tight">半角<br />空白</span>
                  ) : (
                    <span className="text-xl font-bold">{selectedChar || '・'}</span>
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
                  <span className={`text-[10.5px] font-mono ${isLight ? 'text-stone-500' : 'text-emerald-400'}`}>
                    U+{selectedUnicode.toString(16).toUpperCase().padStart(4, '0')} • {contours.length}パス ({totalNodes}頂点)
                  </span>
                </div>
              </div>
              <div className="shrink-0 p-1 text-stone-400">
                {expandedSections.nav ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>

            {expandedSections.nav && (
              <div className="p-2.5 pt-0 space-y-2 border-t border-stone-100 dark:border-stone-800/60">
                {/* Navigation Button Grid */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {/* Prev / Next Character */}
                  <div className="flex space-x-1">
                    <button
                      onClick={onSelectPrevGlyph}
                      disabled={!onSelectPrevGlyph}
                      className={`flex-1 min-h-[38px] py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1 transition-all active:scale-95 disabled:opacity-40 cursor-pointer ${
                        isLight
                          ? 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-800'
                          : 'bg-[#101813] hover:bg-[#1f2d24] border-[#25362b] text-emerald-200'
                      }`}
                      title="前の文字へ (ショートカット: Alt+← または PageUp)"
                    >
                      <ChevronLeft className="w-4 h-4 shrink-0" />
                      <span>前文字</span>
                    </button>
                    <button
                      onClick={onSelectNextGlyph}
                      disabled={!onSelectNextGlyph}
                      className={`flex-1 min-h-[38px] py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1 transition-all active:scale-95 disabled:opacity-40 cursor-pointer ${
                        isLight
                          ? 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-800'
                          : 'bg-[#101813] hover:bg-[#1f2d24] border-[#25362b] text-emerald-200'
                      }`}
                      title="次の文字へ (ショートカット: Alt+→ または PageDown)"
                    >
                      <span>次文字</span>
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </button>
                  </div>

                  {/* Skip Uncompleted */}
                  <div className="flex space-x-1">
                    <button
                      onClick={onSelectPrevUncompletedGlyph}
                      disabled={!onSelectPrevUncompletedGlyph}
                      className={`flex-1 min-h-[38px] py-1.5 px-1.5 rounded-lg border text-xs font-bold flex items-center justify-center space-x-0.5 transition-all active:scale-95 disabled:opacity-40 cursor-pointer ${
                        isLight
                          ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-amber-950/50 hover:bg-amber-900/60 border-amber-800 text-amber-200'
                      }`}
                      title="前の未作成グリフへスキップ"
                    >
                      <span>←未作</span>
                    </button>
                    <button
                      onClick={onSelectNextUncompletedGlyph}
                      disabled={!onSelectNextUncompletedGlyph}
                      className={`flex-1 min-h-[38px] py-1.5 px-1.5 rounded-lg border text-xs font-bold flex items-center justify-center space-x-0.5 transition-all active:scale-95 disabled:opacity-40 cursor-pointer ${
                        isLight
                          ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-amber-950/50 hover:bg-amber-900/60 border-amber-800 text-amber-200'
                      }`}
                      title="次の未作成グリフへジャンプ"
                    >
                      <span>未作→</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Manual Metrics Adjustment (送り幅 & LSB) */}
          <div
            className={`flex flex-col rounded-xl border overflow-hidden shadow-xs transition-colors ${
              isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
            }`}
          >
            <div
              onClick={() => toggleSection('metrics')}
              className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                isLight ? 'hover:bg-stone-50' : 'hover:bg-[#1f2d24]'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                  メトリクス数値指定
                </span>
                <span className={`text-[10.5px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  isLight ? 'bg-emerald-100 text-emerald-900' : 'bg-emerald-950 text-emerald-300'
                }`}>
                  幅:{advanceWidth ?? 1000} / LSB:{lsb ?? 50}
                </span>
              </div>
              <div className="shrink-0 p-0.5 text-stone-400">
                {expandedSections.metrics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>

            {expandedSections.metrics && (
              <div className="p-3 pt-0 space-y-3 border-t border-stone-100 dark:border-stone-800/60">
                {/* Advance Width Section */}
                <div
                  className={`p-2.5 rounded-lg border space-y-2 mt-2 ${
                    isLight ? 'bg-[#f7faf8] border-[#d8e6df]' : 'bg-[#141d17] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className={`text-xs font-bold ${isLight ? 'text-stone-800' : 'text-emerald-300'}`}>
                      送り幅 (Advance Width)
                    </label>
                    <span className="text-[10px] font-mono text-stone-500">標準: 1000 (全角)</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <input
                      type="number"
                      value={advanceWidth ?? 1000}
                      onChange={(e) => {
                        onChangeAdvanceWidth(Number(e.target.value) || 1000);
                        onCommitHistory();
                      }}
                      className={`flex-1 border rounded-lg px-3 py-2 text-sm font-mono font-bold focus:outline-hidden ${
                        isLight
                          ? 'bg-white border-[#c8ded3] text-stone-900 focus:border-emerald-700'
                          : 'bg-[#0f1712] border-[#2d4034] text-emerald-200 focus:border-emerald-500'
                      }`}
                      step={10}
                    />

                    {/* Step Adjustment Buttons */}
                    <div className="flex space-x-1 shrink-0">
                      <button
                        onClick={() => handleStepAdvance(-50)}
                        className={`min-h-[36px] px-2 py-1 rounded-md border text-xs font-mono font-bold transition-all active:scale-95 ${
                          isLight ? 'bg-white border-stone-300 hover:bg-stone-100 text-stone-800' : 'bg-[#1d2b21] border-[#2d4034] text-emerald-200'
                        }`}
                        title="50px 減らす"
                      >
                        -50
                      </button>
                      <button
                        onClick={() => handleStepAdvance(-10)}
                        className={`min-h-[36px] px-2 py-1 rounded-md border text-xs font-mono font-bold transition-all active:scale-95 ${
                          isLight ? 'bg-white border-stone-300 hover:bg-stone-100 text-stone-800' : 'bg-[#1d2b21] border-[#2d4034] text-emerald-200'
                        }`}
                        title="10px 減らす"
                      >
                        -10
                      </button>
                      <button
                        onClick={() => handleStepAdvance(10)}
                        className={`min-h-[36px] px-2 py-1 rounded-md border text-xs font-mono font-bold transition-all active:scale-95 ${
                          isLight ? 'bg-white border-stone-300 hover:bg-stone-100 text-stone-800' : 'bg-[#1d2b21] border-[#2d4034] text-emerald-200'
                        }`}
                        title="10px 増やす"
                      >
                        +10
                      </button>
                      <button
                        onClick={() => handleStepAdvance(50)}
                        className={`min-h-[36px] px-2 py-1 rounded-md border text-xs font-mono font-bold transition-all active:scale-95 ${
                          isLight ? 'bg-white border-stone-300 hover:bg-stone-100 text-stone-800' : 'bg-[#1d2b21] border-[#2d4034] text-emerald-200'
                        }`}
                        title="50px 増やす"
                      >
                        +50
                      </button>
                    </div>
                  </div>

                  {/* Preset Width Chips */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {[
                      { label: '全角 1000', val: 1000 },
                      { label: '半角 500', val: 500 },
                      { label: '600', val: 600 },
                      { label: '750', val: 750 },
                      { label: '800', val: 800 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        onClick={() => handleSetAdvancePreset(p.val)}
                        className={`px-2 py-1 rounded-md border text-[10.5px] font-bold transition-all cursor-pointer ${
                          advanceWidth === p.val
                            ? isLight
                              ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                              : 'bg-emerald-500 text-stone-950 border-emerald-400 font-extrabold'
                            : isLight
                            ? 'bg-white border-stone-200 text-stone-700 hover:bg-emerald-50'
                            : 'bg-[#101813] border-[#25362b] text-stone-300 hover:bg-[#1a261f]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Left Sidebearing (LSB) Section */}
                <div
                  className={`p-2.5 rounded-lg border space-y-2 ${
                    isLight ? 'bg-[#f7faf8] border-[#d8e6df]' : 'bg-[#141d17] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className={`text-xs font-bold ${isLight ? 'text-stone-800' : 'text-emerald-300'}`}>
                      左余白 (Left Sidebearing / LSB)
                    </label>
                    <span className="text-[10px] font-mono text-stone-500">標準: 50px</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <input
                      type="number"
                      value={lsb ?? 50}
                      onChange={(e) => {
                        onChangeLsb(Number(e.target.value) || 0);
                        onCommitHistory();
                      }}
                      className={`flex-1 border rounded-lg px-3 py-2 text-sm font-mono font-bold focus:outline-hidden ${
                        isLight
                          ? 'bg-white border-[#c8ded3] text-stone-900 focus:border-emerald-700'
                          : 'bg-[#0f1712] border-[#2d4034] text-emerald-200 focus:border-emerald-500'
                      }`}
                      step={5}
                    />

                    {/* Step Adjustment Buttons */}
                    <div className="flex space-x-1 shrink-0">
                      <button
                        onClick={() => handleStepLsb(-20)}
                        className={`min-h-[36px] px-2 py-1 rounded-md border text-xs font-mono font-bold transition-all active:scale-95 ${
                          isLight ? 'bg-white border-stone-300 hover:bg-stone-100 text-stone-800' : 'bg-[#1d2b21] border-[#2d4034] text-emerald-200'
                        }`}
                        title="20px 減らす"
                      >
                        -20
                      </button>
                      <button
                        onClick={() => handleStepLsb(-5)}
                        className={`min-h-[36px] px-2 py-1 rounded-md border text-xs font-mono font-bold transition-all active:scale-95 ${
                          isLight ? 'bg-white border-stone-300 hover:bg-stone-100 text-stone-800' : 'bg-[#1d2b21] border-[#2d4034] text-emerald-200'
                        }`}
                        title="5px 減らす"
                      >
                        -5
                      </button>
                      <button
                        onClick={() => handleStepLsb(5)}
                        className={`min-h-[36px] px-2 py-1 rounded-md border text-xs font-mono font-bold transition-all active:scale-95 ${
                          isLight ? 'bg-white border-stone-300 hover:bg-stone-100 text-stone-800' : 'bg-[#1d2b21] border-[#2d4034] text-emerald-200'
                        }`}
                        title="5px 増やす"
                      >
                        +5
                      </button>
                      <button
                        onClick={() => handleStepLsb(20)}
                        className={`min-h-[36px] px-2 py-1 rounded-md border text-xs font-mono font-bold transition-all active:scale-95 ${
                          isLight ? 'bg-white border-stone-300 hover:bg-stone-100 text-stone-800' : 'bg-[#1d2b21] border-[#2d4034] text-emerald-200'
                        }`}
                        title="20px 増やす"
                      >
                        +20
                      </button>
                    </div>
                  </div>

                  {/* Preset LSB Chips */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {[
                      { label: '0px (密着)', val: 0 },
                      { label: '25px', val: 25 },
                      { label: '50px (標準)', val: 50 },
                      { label: '80px', val: 80 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        onClick={() => handleSetLsbPreset(p.val)}
                        className={`px-2 py-1 rounded-md border text-[10.5px] font-bold transition-all cursor-pointer ${
                          lsb === p.val
                            ? isLight
                              ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                              : 'bg-emerald-500 text-stone-950 border-emerald-400 font-extrabold'
                            : isLight
                            ? 'bg-white border-stone-200 text-stone-700 hover:bg-emerald-50'
                            : 'bg-[#101813] border-[#25362b] text-stone-300 hover:bg-[#1a261f]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
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
                      className={`p-2.5 rounded-lg border space-y-2 ${
                        isLight ? 'bg-[#edf5f0] border-[#d8e6df]' : 'bg-[#121a14] border-[#25362b]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className={isLight ? 'text-stone-700' : 'text-emerald-300'}>左右余白バランス</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            isBalanced
                              ? isLight
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                              : isLeftLeaning
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-indigo-100 text-indigo-900 border border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300'
                          }`}
                        >
                          {isBalanced ? '✓ 左右均等' : isLeftLeaning ? `左寄り (${Math.abs(Math.round(diff / 2))}px)` : `右寄り (${Math.round(diff / 2)}px)`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                        <div className={`p-2 rounded-md border ${isLight ? 'bg-white border-stone-200' : 'bg-[#0f1712] border-stone-800'}`}>
                          <div className="text-stone-500 text-[10px]">実測 LSB (左余白)</div>
                          <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{actualLsb} px</div>
                        </div>
                        <div className={`p-2 rounded-md border ${isLight ? 'bg-white border-stone-200' : 'bg-[#0f1712] border-stone-800'}`}>
                          <div className="text-stone-500 text-[10px]">実測 RSB (右余白)</div>
                          <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{actualRsb} px</div>
                        </div>
                      </div>

                      {/* 1-Tap Horizontal Center Button */}
                      <button
                        onClick={handleCenterWithinAdvance}
                        className={`w-full min-h-[38px] py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 border transition-all active:scale-95 cursor-pointer ${
                          isLight
                            ? 'bg-white hover:bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
                            : 'bg-[#18261e] hover:bg-[#22352a] border-emerald-700 text-emerald-200'
                        }`}
                        title="送り幅の中で文字を左右中央にセンタリングして余白を均等化"
                      >
                        <MoveHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                        <span>送り幅の中で左右中央にセンタリング</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* 3. Auto-Spacing (サイドベアリング自動設定) Section */}
          <div
            className={`flex flex-col rounded-xl border overflow-hidden shadow-xs transition-colors ${
              isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
            }`}
          >
            <div
              onClick={() => toggleSection('autospace')}
              className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                isLight ? 'hover:bg-stone-50' : 'hover:bg-[#1f2d24]'
              }`}
            >
              <span className="text-xs font-bold flex items-center space-x-1.5 text-emerald-800 dark:text-emerald-300">
                <AlignCenter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>オートスペーシング (自動余白)</span>
              </span>
              <div className="p-0.5 text-stone-400">
                {expandedSections.autospace ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>

            {expandedSections.autospace && (
              <div className="p-3 pt-0 space-y-2.5 border-t border-stone-100 dark:border-stone-800/60">
                <p className="text-[11px] leading-relaxed text-stone-600 dark:text-emerald-300/80 pt-1">
                  文字の実幅と形状の光学バランスに応じて、最適な送り幅(Advance)と左右余白(LSB/RSB)を一括計算します。
                </p>

                {/* Preset Selector Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  <button
                    onClick={() => {
                      setSpacingPreset('smart');
                      handleExecuteAutoSpacing('smart');
                    }}
                    className={`p-2.5 rounded-lg border text-left flex flex-col transition-all cursor-pointer active:scale-98 ${
                      spacingPreset === 'smart'
                        ? isLight
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs'
                          : 'bg-emerald-950/80 border-emerald-600 text-emerald-200 font-bold'
                        : isLight
                        ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                        : 'bg-[#101813] border-[#25362b] text-stone-300'
                    }`}
                  >
                    <span className="font-extrabold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>スマート自動</span>
                    </span>
                    <span className="text-[10px] opacity-75 mt-0.5 font-normal">和文:全角 / 欧文:光学</span>
                  </button>

                  <button
                    onClick={() => {
                      setSpacingPreset('japanese-fullwidth');
                      handleExecuteAutoSpacing('japanese-fullwidth');
                    }}
                    className={`p-2.5 rounded-lg border text-left flex flex-col transition-all cursor-pointer active:scale-98 ${
                      spacingPreset === 'japanese-fullwidth'
                        ? isLight
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs'
                          : 'bg-emerald-950/80 border-emerald-600 text-emerald-200 font-bold'
                        : isLight
                        ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                        : 'bg-[#101813] border-[#25362b] text-stone-300'
                    }`}
                  >
                    <span className="font-extrabold">和文全角 (1000EM)</span>
                    <span className="text-[10px] opacity-75 mt-0.5 font-normal">左右均等センタリング</span>
                  </button>

                  <button
                    onClick={() => {
                      setSpacingPreset('proportional-balanced');
                      handleExecuteAutoSpacing('proportional-balanced');
                    }}
                    className={`p-2.5 rounded-lg border text-left flex flex-col transition-all cursor-pointer active:scale-98 ${
                      spacingPreset === 'proportional-balanced'
                        ? isLight
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs'
                          : 'bg-emerald-950/80 border-emerald-600 text-emerald-200 font-bold'
                        : isLight
                        ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                        : 'bg-[#101813] border-[#25362b] text-stone-300'
                    }`}
                  >
                    <span className="font-extrabold">欧文標準プロポーショナル</span>
                    <span className="text-[10px] opacity-75 mt-0.5 font-normal">字形ごとの光学余白</span>
                  </button>

                  <button
                    onClick={() => {
                      setSpacingPreset('proportional-tight');
                      handleExecuteAutoSpacing('proportional-tight');
                    }}
                    className={`p-2.5 rounded-lg border text-left flex flex-col transition-all cursor-pointer active:scale-98 ${
                      spacingPreset === 'proportional-tight'
                        ? isLight
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs'
                          : 'bg-emerald-950/80 border-emerald-600 text-emerald-200 font-bold'
                        : isLight
                        ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                        : 'bg-[#101813] border-[#25362b] text-stone-300'
                    }`}
                  >
                    <span className="font-extrabold">欧文タイト (詰まり)</span>
                    <span className="text-[10px] opacity-75 mt-0.5 font-normal">余白を狭めて配置</span>
                  </button>
                </div>

                {/* Quick Trigger Button */}
                <button
                  onClick={() => handleExecuteAutoSpacing(spacingPreset)}
                  disabled={contours.length === 0}
                  className={`w-full min-h-[42px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-xs active:scale-95 disabled:opacity-40 cursor-pointer ${
                    isLight
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-extrabold'
                  }`}
                  title="サイドベアリングを自動適用 (ショートカット: Shift+Alt+S)"
                >
                  <AlignCenter className="w-4 h-4 shrink-0" />
                  <span>オートスペーシング適用 (Shift+Alt+S)</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. Simplify (輪郭の単純化・頂点数削減) Section */}
          <div
            className={`flex flex-col rounded-xl border overflow-hidden shadow-xs transition-colors ${
              isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
            }`}
          >
            <div
              onClick={() => toggleSection('simplify')}
              className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                isLight ? 'hover:bg-stone-50' : 'hover:bg-[#1f2d24]'
              }`}
            >
              <span className="text-xs font-bold flex items-center space-x-1.5 text-emerald-800 dark:text-emerald-300">
                <Sparkles className="w-4 h-4 text-amber-500 fill-current" />
                <span>輪郭の単純化 (Simplify)</span>
              </span>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-[#101813] text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                  {totalNodes} 頂点
                </span>
                <div className="p-0.5 text-stone-400">
                  {expandedSections.simplify ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </div>

            {expandedSections.simplify && (
              <div className="p-3 pt-0 space-y-2.5 border-t border-stone-100 dark:border-stone-800/60">
                <p className="text-[11px] leading-relaxed text-stone-600 dark:text-emerald-300/80 pt-1">
                  不要なアンカーポイント（重複・共線点）を自動削除し、美しい字形を保ちながらファイル容量を削減します。
                </p>

                {/* Strength Selector */}
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <button
                    onClick={() => setSimplifyLevel('mild')}
                    className={`min-h-[38px] py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${
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
                    className={`min-h-[38px] py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${
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
                    className={`min-h-[38px] py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${
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
                  className={`w-full min-h-[42px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-xs active:scale-95 disabled:opacity-40 cursor-pointer ${
                    isLight
                      ? 'bg-emerald-800 hover:bg-emerald-700 text-white'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold'
                  }`}
                  title="現在のグリフの全輪郭を単純化 (ショートカット: Alt+S)"
                >
                  <Zap className="w-4 h-4 fill-current shrink-0" />
                  <span>輪郭を単純化 (Simplify)</span>
                </button>
              </div>
            )}
          </div>

          {/* 5. Transform Tools (Slant, Flip, Scale, Center) */}
          <div
            className={`flex flex-col rounded-xl border overflow-hidden shadow-xs transition-colors ${
              isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
            }`}
          >
            <div
              onClick={() => toggleSection('transform')}
              className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                isLight ? 'hover:bg-stone-50' : 'hover:bg-[#1f2d24]'
              }`}
            >
              <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                傾斜・変形・配置
              </span>
              <div className="p-0.5 text-stone-400">
                {expandedSections.transform ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>

            {expandedSections.transform && (
              <div className="p-3 pt-0 space-y-2.5 border-t border-stone-100 dark:border-stone-800/60">
                {/* Slant Quick Presets */}
                <div
                  className={`p-2.5 rounded-lg border space-y-1.5 mt-2 ${
                    isLight ? 'bg-[#edf5f0] border-[#d8e6df]' : 'bg-[#141d17] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center space-x-1 text-xs font-bold">
                    <Italic className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>傾斜 (Slant / イタリック)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[-15, -10, -5, 5, 10, 12, 15, 20].map((deg) => (
                      <button
                        key={deg}
                        onClick={() => handleSlant(deg)}
                        className={`min-h-[34px] py-1 rounded-md text-xs font-mono font-bold border transition-colors cursor-pointer active:scale-95 ${
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

                {/* Flip & Scale Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleFlipH}
                    className={`min-h-[42px] px-3 py-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer active:scale-95 ${
                      isLight
                        ? 'bg-[#f7faf8] border-[#d8e6df] text-stone-800 hover:bg-emerald-100'
                        : 'bg-[#141d17] border-[#25362b] text-emerald-200 hover:bg-[#202e25]'
                    }`}
                  >
                    <FlipHorizontal className="w-4 h-4 shrink-0" />
                    <span>左右反転</span>
                  </button>

                  <button
                    onClick={handleFlipV}
                    className={`min-h-[42px] px-3 py-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer active:scale-95 ${
                      isLight
                        ? 'bg-[#f7faf8] border-[#d8e6df] text-stone-800 hover:bg-emerald-100'
                        : 'bg-[#141d17] border-[#25362b] text-emerald-200 hover:bg-[#202e25]'
                    }`}
                  >
                    <FlipVertical className="w-4 h-4 shrink-0" />
                    <span>上下反転</span>
                  </button>

                  <button
                    onClick={() => handleScale(1.1)}
                    className={`min-h-[42px] px-3 py-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer active:scale-95 ${
                      isLight
                        ? 'bg-[#f7faf8] border-[#d8e6df] text-stone-800 hover:bg-emerald-100'
                        : 'bg-[#141d17] border-[#25362b] text-emerald-200 hover:bg-[#202e25]'
                    }`}
                  >
                    <Maximize2 className="w-4 h-4 shrink-0" />
                    <span>拡大 +10%</span>
                  </button>

                  <button
                    onClick={() => handleScale(0.9)}
                    className={`min-h-[42px] px-3 py-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer active:scale-95 ${
                      isLight
                        ? 'bg-[#f7faf8] border-[#d8e6df] text-stone-800 hover:bg-emerald-100'
                        : 'bg-[#141d17] border-[#25362b] text-emerald-200 hover:bg-[#202e25]'
                    }`}
                  >
                    <Minimize2 className="w-4 h-4 shrink-0" />
                    <span>縮小 -10%</span>
                  </button>
                </div>

                <button
                  onClick={handleCenter}
                  className={`w-full min-h-[42px] py-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer active:scale-95 ${
                    isLight
                      ? 'bg-[#f7faf8] border-[#d8e6df] text-stone-800 hover:bg-emerald-100'
                      : 'bg-[#141d17] border-[#25362b] text-emerald-200 hover:bg-[#202e25]'
                  }`}
                >
                  <AlignCenter className="w-4 h-4 shrink-0" />
                  <span>EM枠の中央に配置 (1000×1000)</span>
                </button>

                {/* Small Kana Helper */}
                <button
                  onClick={handleConvertToSmallKana}
                  className={`w-full min-h-[42px] py-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer active:scale-95 ${
                    isLight
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                      : 'bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60'
                  }`}
                  title="通常の文字を小文字用（ぁ, ッ等）の位置とサイズに自動縮小"
                >
                  <Wand2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>小文字サイズ・位置に変換 (ぁ・ッ等)</span>
                </button>
              </div>
            )}
          </div>

          {/* 6. Outline Stroke Paths */}
          <div
            className={`flex flex-col rounded-xl border overflow-hidden shadow-xs transition-colors ${
              isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
            }`}
          >
            <div
              onClick={() => toggleSection('outline')}
              className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                isLight ? 'hover:bg-stone-50' : 'hover:bg-[#1f2d24]'
              }`}
            >
              <span className={`text-xs font-bold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                骨格線の肉付け（アウトライン化）
              </span>
              <div className="p-0.5 text-stone-400">
                {expandedSections.outline ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>

            {expandedSections.outline && (
              <div className="p-3 pt-0 space-y-2.5 border-t border-stone-100 dark:border-stone-800/60">
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="range"
                    min={20}
                    max={140}
                    step={5}
                    value={strokeOutlineWidth}
                    onChange={(e) => setStrokeOutlineWidth(Number(e.target.value))}
                    className="flex-1 accent-emerald-700 h-2"
                  />
                  <span className={`text-xs font-mono font-bold w-12 text-right ${isLight ? 'text-stone-700' : 'text-emerald-300'}`}>
                    {strokeOutlineWidth}px
                  </span>
                </div>
                <button
                  onClick={handleOutlineStrokePaths}
                  className={`w-full min-h-[40px] py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer active:scale-95 ${
                    isLight ? 'bg-emerald-800 text-white hover:bg-emerald-900' : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>骨格線をアウトライン化</span>
                </button>
              </div>
            )}
          </div>

          {/* 7. Clear Button */}
          <div className="pt-1">
            {isConfirmingClear ? (
              <div className="flex items-center space-x-2 animate-in fade-in duration-150">
                <button
                  onClick={handleExecuteClear}
                  className="flex-1 min-h-[44px] py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-sm bg-rose-600 hover:bg-rose-700 text-white border-rose-700 cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>本当に全消去する</span>
                </button>
                <button
                  onClick={() => setIsConfirmingClear(false)}
                  className={`min-h-[44px] py-2 px-4 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
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
                className={`w-full min-h-[42px] py-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-40 cursor-pointer ${
                  isLight
                    ? 'border-rose-300 text-rose-700 hover:bg-rose-50'
                    : 'border-rose-900/60 text-rose-400 hover:bg-rose-950/40'
                }`}
                title="現在のグリフのすべての輪郭を消去 (Ctrl+Zで元に戻せます)"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>字形を全消去</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
});

MetricsPanel.displayName = 'MetricsPanel';
export default MetricsPanel;
