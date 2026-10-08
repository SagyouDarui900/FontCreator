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
 fitContoursToEmBox,
 getContoursBoundingBox,
 outlineOpenContour,
 createSmallKanaContours,
 simplifyGlyphContours,
 smoothAndFixTransformedContours,
 transformContours,
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
 unitsPerEm?: number;
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
 unitsPerEm = 1000,
 onSelectPrevGlyph,
 onSelectNextGlyph,
 onSelectPrevUncompletedGlyph,
 onSelectNextUncompletedGlyph,
 onAutoSpaceGlyph,
 onSimplifyGlyph,
 onShowToast,
}) => {
 const upm = unitsPerEm || 1000;
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
 const result = calculateOptimalSpacing(selectedUnicode, contours, preset, upm);
 onChangeContours(result.contours);
 onChangeAdvanceWidth(result.advanceWidth);
 onChangeLsb(result.lsb);

 const presetLabel =
 preset === 'smart'
 ? 'スマート自動'
 : preset === 'japanese-fullwidth'
 ? `和文全角センタリング (${upm}EM)`
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
 const currentAdv = advanceWidth || upm;
 const targetLsb = Math.round((currentAdv - bbox.width) / 2);
 const deltaX = targetLsb - bbox.minX;

 const shifted = deltaX !== 0 ? transformContours(contours, (p) => ({ x: Math.round(p.x + deltaX), y: p.y })) : contours;

 onChangeContours(shifted);
 onChangeLsb(targetLsb);
 onShowToast?.(`文字を送り幅(${currentAdv}px)の中央に配置しました (LSB/RSB: ${targetLsb}px)`, 'success');
 };

 // Step adjustments for Advance & LSB
 const handleStepAdvance = (delta: number) => {
 const nextVal = Math.max(100, Math.round((advanceWidth || upm) + delta));
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

 const handleAspectScale = (scaleX: number, scaleY: number) => {
 if (contours.length === 0) return;
 onCommitHistory();
 onChangeContours(scaleContours(contours, scaleX, scaleY));
 };

 const handleSmoothAndFix = () => {
 if (contours.length === 0) return;
 onCommitHistory();
 const cleaned = smoothAndFixTransformedContours(contours);
 onChangeContours(cleaned);
 onShowToast?.('輪郭のガタツキと変形歪みを滑らかに補正しました', 'success');
 };

 const handleCenter = () => {
 if (contours.length === 0) return;
 onCommitHistory();
 onChangeContours(centerContoursInBox(contours, upm, Math.round(upm * 0.8)));
 };

 const handleFitToEmBox = () => {
 if (contours.length === 0) return;
 onCommitHistory();
 const isKana = /[ぁ-んァ-ヶー]/.test(selectedChar);
 const targetRatio = isKana ? 0.78 : 0.85;
 const fitted = fitContoursToEmBox(contours, upm, upm, targetRatio);
 onChangeContours(fitted);
 onShowToast?.(`文字の輪郭をキャンバス枠内（字面枠 ${Math.round(targetRatio * 100)}%基準）に最適化しました`, 'success');
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
 {/* Mobile/Overlay Click-Outside Dismiss (Transparent, non-darkening) */}
 {effectiveIsOverlay && (
 <div
 onClick={onClose}
 className="fixed inset-0 bg-transparent sm:hidden z-40 pointer-events-auto"
 />
 )}

 <div
 className={`${
 effectiveIsOverlay
 ? 'fixed inset-y-0 right-0 z-50 w-full sm:w-96 max-w-full shadow-2xl animate-in slide-in-from-right duration-200'
 : 'relative z-10 w-72 lg:w-80 shadow-none shrink-0'
 } border-l flex flex-col h-full overflow-hidden select-none transition-colors ${themeClasses.sidebarBg} border-stone-200 dark:border-stone-800`}
 >
 {/* Sticky Mobile/Desktop Header */}
 <div
 className={`flex items-center justify-between p-3 border-b shrink-0 z-10 ${
 isLight ? 'bg-white/95 border-stone-200' : 'bg-[#141e17]/95 border-stone-800'
 } `}
 style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 8px, 12px)' }}
 >
 <div className="flex items-center space-x-2 min-w-0">
 <div className={`p-1.5 rounded-lg shrink-0 ${isLight ? 'bg-stone-100 text-stone-800' : 'bg-stone-800 text-emerald-300'}`}>
 <Sliders className="w-4 h-4 shrink-0" />
 </div>
 <div className="flex flex-col min-w-0">
 <span className={`text-xs font-bold truncate ${isLight ? 'text-stone-900' : 'text-emerald-300'}`}>
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
 ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
 : 'bg-[#18231c] border-stone-800 text-emerald-300 hover:bg-[#202d24]'
 }`}
 title={isAllExpanded ? 'すべての項目を折りたたむ' : 'すべての項目を展開'}
 >
 {isAllExpanded ? '全閉' : '全開'}
 </button>

 {onClose && (
 <button
 onClick={onClose}
 className={`min-h-[32px] px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 text-xs font-bold active:scale-95 cursor-pointer ${
 isLight
 ? 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200'
 : 'bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-700'
 }`}
 title="パネルを閉じる (作図エリアへ戻る)"
 >
 <X className="w-3.5 h-3.5 shrink-0" />
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
 className={`flex flex-col rounded-xl border overflow-hidden transition-colors ${
 isLight ? 'bg-white border-stone-200 shadow-xs' : 'bg-[#16211a] border-[#25362b]'
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
 ? 'bg-[#f0f7f3] border-emerald-300 text-emerald-950 '
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
 <span className={`text-[10px] font-mono truncate ${isLight ? 'text-stone-500' : 'text-emerald-400'}`}>
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
 <div className="grid grid-cols-2 gap-1.5 pt-2">
 <button
 type="button"
 onClick={onSelectPrevGlyph}
 disabled={!onSelectPrevGlyph}
 className={`min-h-[38px] py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1 transition-all active:scale-95 disabled:opacity-40 cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-800'
 : 'bg-[#101813] hover:bg-[#1f2d24] border-[#25362b] text-emerald-200'
 }`}
 title="前の文字へ (ショートカット: Alt+← または PageUp)"
 >
 <ChevronLeft className="w-4 h-4 shrink-0" />
 <span>前グリフ</span>
 </button>
 <button
 type="button"
 onClick={onSelectNextGlyph}
 disabled={!onSelectNextGlyph}
 className={`min-h-[38px] py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1 transition-all active:scale-95 disabled:opacity-40 cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-800'
 : 'bg-[#101813] hover:bg-[#1f2d24] border-[#25362b] text-emerald-200'
 }`}
 title="次の文字へ (ショートカット: Alt+→ または PageDown)"
 >
 <span>次グリフ</span>
 <ChevronRight className="w-4 h-4 shrink-0" />
 </button>

 <button
 type="button"
 onClick={onSelectPrevUncompletedGlyph}
 disabled={!onSelectPrevUncompletedGlyph}
 className={`min-h-[36px] py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1 transition-all active:scale-95 disabled:opacity-40 cursor-pointer ${
 isLight
 ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
 : 'bg-amber-950/50 hover:bg-amber-900/60 border-amber-800 text-amber-200'
 }`}
 title="前の未作成グリフへスキップ"
 >
 <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
 <span>未作成文字</span>
 </button>
 <button
 type="button"
 onClick={onSelectNextUncompletedGlyph}
 disabled={!onSelectNextUncompletedGlyph}
 className={`min-h-[36px] py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1 transition-all active:scale-95 disabled:opacity-40 cursor-pointer ${
 isLight
 ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
 : 'bg-amber-950/50 hover:bg-amber-900/60 border-amber-800 text-amber-200'
 }`}
 title="次の未作成グリフへジャンプ"
 >
 <span>未作成文字</span>
 <ChevronRight className="w-3.5 h-3.5 shrink-0" />
 </button>
 </div>
 </div>
 )}
 </div>

 {/* 2. Manual Metrics Adjustment (送り幅 & LSB) */}
 <div
 className={`flex flex-col rounded-xl border overflow-hidden transition-colors ${
 isLight ? 'bg-white border-stone-200 shadow-xs' : 'bg-[#16211a] border-[#25362b]'
 }`}
 >
 <div
 onClick={() => toggleSection('metrics')}
 className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
 isLight ? 'hover:bg-stone-50' : 'hover:bg-[#1f2d24]'
 }`}
 >
 <div className="flex flex-wrap items-center gap-1.5 min-w-0 pr-1">
 <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
 メトリクス数値指定
 </span>
 <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
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
 isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#121a14] border-[#223026]'
 }`}
 >
 <div className="flex items-center justify-between">
 <label className={`text-xs font-bold ${isLight ? 'text-stone-800' : 'text-emerald-300'}`}>
 送り幅 (Advance Width)
 </label>
 <span className="text-[10px] font-mono text-stone-500">標準: {upm} (全角)</span>
 </div>

 {/* Input Row with Large +/- buttons */}
 <div className="flex items-center gap-1.5">
 <button
 type="button"
 onClick={() => handleStepAdvance(-10)}
 className={`w-9 h-9 rounded-lg border text-sm font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 ${
 isLight ? 'bg-white border-stone-300 hover:bg-stone-100 text-stone-800' : 'bg-[#1d2b21] border-[#2d4034] text-emerald-200'
 }`}
 title="10px 減らす"
 >
 -
 </button>
 <div className="relative flex-1 min-w-0 flex items-center">
 <input
 type="number"
 value={advanceWidth ?? upm}
 onChange={(e) => {
 const value = Number(e.target.value);
 onChangeAdvanceWidth(Number.isFinite(value) ? Math.max(0, Math.round(value)) : upm);
 }}
 onBlur={onCommitHistory}
 className={`w-full border rounded-lg px-2.5 py-1.5 pr-7 text-sm font-mono font-bold text-center focus:outline-hidden ${
 isLight
 ? 'bg-white border-stone-300 text-stone-900 focus:border-emerald-700'
 : 'bg-[#0f1712] border-[#2d4034] text-emerald-200 focus:border-emerald-500'
 }`}
 step={10}
 />
 <span className="absolute right-2 text-[10px] font-mono text-stone-400 pointer-events-none font-bold">
 px
 </span>
 </div>
 <button
 type="button"
 onClick={() => handleStepAdvance(10)}
 className={`w-9 h-9 rounded-lg border text-sm font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 ${
 isLight ? 'bg-white border-stone-300 hover:bg-stone-100 text-stone-800' : 'bg-[#1d2b21] border-[#2d4034] text-emerald-200'
 }`}
 title="10px 増やす"
 >
 +
 </button>
 </div>

 {/* Step Increment Row (Clean 4-column distribution) */}
 <div className="grid grid-cols-4 gap-1">
 {[-50, -10, 10, 50].map((step) => (
 <button
 key={step}
 type="button"
 onClick={() => handleStepAdvance(step)}
 className={`py-1 rounded-md border text-[11px] font-mono font-bold text-center transition-all active:scale-95 cursor-pointer ${
 isLight
 ? 'bg-white border-stone-200 text-stone-700 hover:bg-emerald-50 hover:border-emerald-300'
 : 'bg-[#101813] border-[#25362b] text-emerald-300 hover:bg-[#1a261f]'
 }`}
 >
 {step > 0 ? `+${step}` : `${step}`}
 </button>
 ))}
 </div>

 {/* Preset Width Chips */}
 <div className="flex flex-wrap gap-1 pt-0.5">
 {[
 { label: `全角 ${upm}`, val: upm },
 { label: `半角 ${Math.round(upm / 2)}`, val: Math.round(upm / 2) },
 { label: `${Math.round(upm * 0.6)}`, val: Math.round(upm * 0.6) },
 { label: `${Math.round(upm * 0.75)}`, val: Math.round(upm * 0.75) },
 { label: `${Math.round(upm * 0.8)}`, val: Math.round(upm * 0.8) },
 ].map((p) => (
 <button
 key={p.val}
 type="button"
 onClick={() => handleSetAdvancePreset(p.val)}
 className={`px-2 py-1 rounded-md border text-[10.5px] font-bold transition-all cursor-pointer ${
 advanceWidth === p.val
 ? isLight
 ? 'bg-emerald-700 text-white border-emerald-800 '
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
 isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#121a14] border-[#223026]'
 }`}
 >
 <div className="flex items-center justify-between">
 <label className={`text-xs font-bold ${isLight ? 'text-stone-800' : 'text-emerald-300'}`}>
 左余白 (Left Sidebearing / LSB)
 </label>
 <span className="text-[10px] font-mono text-stone-500">標準: 50px</span>
 </div>

 {/* Input Row with Large +/- buttons */}
 <div className="flex items-center gap-1.5">
 <button
 type="button"
 onClick={() => handleStepLsb(-5)}
 className={`w-9 h-9 rounded-lg border text-sm font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 ${
 isLight ? 'bg-white border-stone-300 hover:bg-stone-100 text-stone-800' : 'bg-[#1d2b21] border-[#2d4034] text-emerald-200'
 }`}
 title="5px 減らす"
 >
 -
 </button>
 <div className="relative flex-1 min-w-0 flex items-center">
 <input
 type="number"
 value={lsb ?? 50}
 onChange={(e) => {
 onChangeLsb(Number(e.target.value) || 0);
 }}
 onBlur={onCommitHistory}
 className={`w-full border rounded-lg px-2.5 py-1.5 pr-7 text-sm font-mono font-bold text-center focus:outline-hidden ${
 isLight
 ? 'bg-white border-stone-300 text-stone-900 focus:border-emerald-700'
 : 'bg-[#0f1712] border-[#2d4034] text-emerald-200 focus:border-emerald-500'
 }`}
 step={5}
 />
 <span className="absolute right-2 text-[10px] font-mono text-stone-400 pointer-events-none font-bold">
 px
 </span>
 </div>
 <button
 type="button"
 onClick={() => handleStepLsb(5)}
 className={`w-9 h-9 rounded-lg border text-sm font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 ${
 isLight ? 'bg-white border-stone-300 hover:bg-stone-100 text-stone-800' : 'bg-[#1d2b21] border-[#2d4034] text-emerald-200'
 }`}
 title="5px 増やす"
 >
 +
 </button>
 </div>

 {/* Step Increment Row (Clean 4-column distribution) */}
 <div className="grid grid-cols-4 gap-1">
 {[-20, -5, 5, 20].map((step) => (
 <button
 key={step}
 type="button"
 onClick={() => handleStepLsb(step)}
 className={`py-1 rounded-md border text-[11px] font-mono font-bold text-center transition-all active:scale-95 cursor-pointer ${
 isLight
 ? 'bg-white border-stone-200 text-stone-700 hover:bg-emerald-50 hover:border-emerald-300'
 : 'bg-[#101813] border-[#25362b] text-emerald-300 hover:bg-[#1a261f]'
 }`}
 >
 {step > 0 ? `+${step}` : `${step}`}
 </button>
 ))}
 </div>

 {/* Preset LSB Chips */}
 <div className="flex flex-wrap gap-1 pt-0.5">
 {[
 { label: '0px (密着)', val: 0 },
 { label: '25px', val: 25 },
 { label: '50px (標準)', val: 50 },
 { label: '80px', val: 80 },
 ].map((p) => (
 <button
 key={p.val}
 type="button"
 onClick={() => handleSetLsbPreset(p.val)}
 className={`px-2 py-1 rounded-md border text-[10.5px] font-bold transition-all cursor-pointer ${
 lsb === p.val
 ? isLight
 ? 'bg-emerald-700 text-white border-emerald-800 '
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
 isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#121a14] border-[#223026]'
 }`}
 >
 <div className="flex items-center justify-between text-xs font-bold">
 <span className={isLight ? 'text-stone-700' : 'text-emerald-300'}>余白バランス</span>
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
 type="button"
 onClick={handleCenterWithinAdvance}
 className={`w-full min-h-[38px] py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 border transition-all active:scale-95 cursor-pointer ${
 isLight
 ? 'bg-white hover:bg-emerald-50 border-emerald-300 text-emerald-900 '
 : 'bg-[#18261e] hover:bg-[#22352a] border-emerald-700 text-emerald-200'
 }`}
 title="送り幅の中で文字を左右中央にセンタリングして余白を均等化"
 >
 <MoveHorizontal className="w-3.5 h-3.5 text-emerald-600" />
 <span>左右中央に自動センタリング</span>
 </button>
 </div>
 );
 })()}
 </div>
 )}
 </div>

 {/* 3. Auto-Spacing (サイドベアリング自動設定) Section */}
 <div
 className={`flex flex-col rounded-xl border overflow-hidden transition-colors ${
 isLight ? 'bg-white border-stone-200 shadow-xs' : 'bg-[#16211a] border-[#25362b]'
 }`}
 >
 <div
 onClick={() => toggleSection('autospace')}
 className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
 isLight ? 'hover:bg-stone-50' : 'hover:bg-[#1f2d24]'
 }`}
 >
 <span className="text-xs font-bold flex items-center space-x-1.5 text-emerald-800 dark:text-emerald-300">
 <AlignCenter className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
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

 {/* Preset Selector Grid - 1 column to avoid overflow on narrow sidebars */}
 <div className="grid grid-cols-1 gap-1.5 text-xs">
 {[
 { id: 'smart' as AutoSpacingPreset, label: '自動計算 (和欧最適化)', desc: `和文:全角${upm}EM / 欧文:光学余白`, icon: Sliders },
 { id: 'japanese-fullwidth' as AutoSpacingPreset, label: `和文全角センタリング (${upm}EM)`, desc: '枠の中心に正確に配置' },
 { id: 'proportional-balanced' as AutoSpacingPreset, label: '欧文プロポーショナル', desc: '字形ごとの光学余白' },
 { id: 'proportional-tight' as AutoSpacingPreset, label: '欧文タイト (詰まり気味)', desc: '余白を狭めて配置' },
 ].map((preset) => {
 const PIcon = preset.icon;
 const isSelected = spacingPreset === preset.id;
 return (
 <button
 key={preset.id}
 type="button"
 onClick={() => {
 setSpacingPreset(preset.id);
 handleExecuteAutoSpacing(preset.id);
 }}
 className={`p-2 rounded-lg border text-left flex items-start justify-between transition-all cursor-pointer active:scale-98 ${
 isSelected
 ? isLight
 ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold '
 : 'bg-emerald-950/80 border-emerald-600 text-emerald-200 font-bold'
 : isLight
 ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
 : 'bg-[#101813] border-[#25362b] text-stone-300 hover:bg-[#18231c]'
 }`}
 >
 <div className="min-w-0 pr-1">
 <div className="font-extrabold flex items-center gap-1">
 {PIcon && <PIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
 <span>{preset.label}</span>
 </div>
 <div className="text-[10px] opacity-75 font-normal mt-0.5">
 {preset.desc}
 </div>
 </div>
 {isSelected && (
 <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
 ✓ 適用中
 </span>
 )}
 </button>
 );
 })}
 </div>

 {/* Quick Trigger Button */}
 <button
 type="button"
 onClick={() => handleExecuteAutoSpacing(spacingPreset)}
 disabled={contours.length === 0}
 className={`w-full min-h-[42px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-40 cursor-pointer ${
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
 className={`flex flex-col rounded-xl border overflow-hidden transition-colors ${
 isLight ? 'bg-white border-stone-200 shadow-xs' : 'bg-[#16211a] border-[#25362b]'
 }`}
 >
 <div
 onClick={() => toggleSection('simplify')}
 className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
 isLight ? 'hover:bg-stone-50' : 'hover:bg-[#1f2d24]'
 }`}
 >
 <span className="text-xs font-bold flex items-center space-x-1.5 text-emerald-800 dark:text-emerald-300">
 <Wand2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
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
 不要なアンカーポイント（重複・共線点）を自動削除し、字形を保ちながらファイル容量を削減します。
 </p>

 {/* Strength Selector */}
 <div className="grid grid-cols-3 gap-1.5 text-xs">
 <button
 onClick={() => setSimplifyLevel('mild')}
 className={`min-h-[38px] py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${
 simplifyLevel === 'mild'
 ? isLight
 ? 'bg-emerald-100 border-emerald-400 text-emerald-950 '
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
 ? 'bg-emerald-700 text-white border-emerald-800 '
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
 ? 'bg-amber-600 text-white border-amber-700 '
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
 className={`w-full min-h-[42px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all active:scale-95 disabled:opacity-40 cursor-pointer ${
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
 className={`flex flex-col rounded-xl border overflow-hidden transition-colors ${
 isLight ? 'bg-white border-stone-200 shadow-xs' : 'bg-[#16211a] border-[#25362b]'
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
 isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#121a14] border-[#223026]'
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

 <button
 onClick={() => handleAspectScale(0.85, 1.0)}
 className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1 transition-colors cursor-pointer active:scale-95 ${
 isLight
 ? 'bg-white border-[#d8e6df] text-stone-800 hover:bg-emerald-50'
 : 'bg-[#121a14] border-[#25362b] text-emerald-200 hover:bg-[#1d2b20]'
 }`}
 title="横幅をスリム化して縦長の長体に変換 (X:85%)"
 >
 <span>長体 (横縮小)</span>
 </button>

 <button
 onClick={() => handleAspectScale(1.15, 0.85)}
 className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1 transition-colors cursor-pointer active:scale-95 ${
 isLight
 ? 'bg-white border-[#d8e6df] text-stone-800 hover:bg-emerald-50'
 : 'bg-[#121a14] border-[#25362b] text-emerald-200 hover:bg-[#1d2b20]'
 }`}
 title="縦幅を抑えて横広の扁平に変換 (X:115%, Y:85%)"
 >
 <span>扁平 (横広化)</span>
 </button>
 </div>

 {/* Smooth & Fix Jaggedness Button */}
 <button
 onClick={handleSmoothAndFix}
 disabled={contours.length === 0}
 className={`w-full min-h-[42px] py-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-40 ${
 isLight
 ? 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-800'
 : 'bg-[#1b261f] hover:bg-[#23332a] border-[#2c3d31] text-emerald-200'
 }`}
 title="変形・拡大縮小時に生じたガタツキやベジェ曲線の折れ曲がり歪みを自動補正"
 >
 <Wand2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
 <span>変形後のガタツキ・歪みを滑らかに補正</span>
 </button>

 <button
 onClick={handleFitToEmBox}
 className={`w-full min-h-[42px] py-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer active:scale-95 ${
 isLight
 ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
 : 'bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60'
 }`}
 title="はみ出た文字や大きすぎる文字を、キャンバスの字面枠（漢字85%/仮名78%）にぴったり収まるよう自動縮小・中央配置します"
 >
 <Maximize2 className="w-4 h-4 text-emerald-600 shrink-0" />
 <span>キャンバス枠内に自動収める (字面85%最適化)</span>
 </button>

 <button
 onClick={handleCenter}
 className={`w-full min-h-[42px] py-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer active:scale-95 ${
 isLight
 ? 'bg-[#f7faf8] border-[#d8e6df] text-stone-800 hover:bg-emerald-100'
 : 'bg-[#141d17] border-[#25362b] text-emerald-200 hover:bg-[#202e25]'
 }`}
 >
 <AlignCenter className="w-4 h-4 shrink-0" />
 <span>EM枠の中央に配置 ({upm}×{upm})</span>
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
 className={`flex flex-col rounded-xl border overflow-hidden transition-colors ${
 isLight ? 'bg-white border-stone-200 shadow-xs' : 'bg-[#16211a] border-[#25362b]'
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
 className="flex-1 min-h-[44px] py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors bg-rose-600 hover:bg-rose-700 text-white border-rose-700 cursor-pointer active:scale-95"
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
