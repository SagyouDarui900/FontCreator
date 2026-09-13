import React, { useState, useMemo } from 'react';
import { X, Sparkles, Sliders, CheckCircle2, ShieldCheck, Zap, Layers, RefreshCw, Cpu } from 'lucide-react';
import { FontProject, GlyphData, PathContour } from '../types';
import { ThemeMode } from '../utils/theme';
import { normalizeGlyph, getContoursBoundingBox, contoursToSvgPath, normalizeGlyphContoursWinding } from '../utils/pathUtils';
import { KANA_PAIRS } from '../data/unicodeTables';

interface BatchNormalizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: FontProject;
  setProject: React.Dispatch<React.SetStateAction<FontProject>>;
  selectedUnicode: number;
  theme: ThemeMode;
  onShowToast?: (text: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export type TargetScope = 'all' | 'hiragana' | 'katakana' | 'kanji' | 'latin' | 'current';

export const BatchNormalizeModal: React.FC<BatchNormalizeModalProps> = ({
  isOpen,
  onClose,
  project,
  setProject,
  selectedUnicode,
  theme,
  onShowToast,
}) => {
  const isLight = theme === 'light';

  const [scope, setScope] = useState<TargetScope>('all');
  const [sizePreset, setSizePreset] = useState<'standard' | 'large' | 'kana' | 'compact' | 'custom'>('standard');
  const [targetWidth, setTargetWidth] = useState<number>(820);
  const [targetHeight, setTargetHeight] = useState<number>(820);
  const [alignH, setAlignH] = useState<'center' | 'keep'>('center');
  const [alignV, setAlignV] = useState<'center' | 'baseline' | 'keep'>('center');
  const [unifyAdvance, setUnifyAdvance] = useState<boolean>(true);
  const [advanceWidth, setAdvanceWidth] = useState<number>(1000);
  const [optimizePoints, setOptimizePoints] = useState<boolean>(true);
  const [weightDelta, setWeightDelta] = useState<number>(0);
  const [normalizeWinding, setNormalizeWinding] = useState<boolean>(true);

  // Apply preset values
  const handlePresetChange = (preset: 'standard' | 'large' | 'kana' | 'compact' | 'custom') => {
    setSizePreset(preset);
    if (preset === 'standard') {
      setTargetWidth(820);
      setTargetHeight(820);
      setAlignH('center');
      setAlignV('center');
      setUnifyAdvance(true);
      setAdvanceWidth(1000);
    } else if (preset === 'large') {
      setTargetWidth(890);
      setTargetHeight(890);
      setAlignH('center');
      setAlignV('center');
      setUnifyAdvance(true);
      setAdvanceWidth(1000);
    } else if (preset === 'kana') {
      setTargetWidth(780);
      setTargetHeight(780);
      setAlignH('center');
      setAlignV('center');
      setUnifyAdvance(true);
      setAdvanceWidth(1000);
    } else if (preset === 'compact') {
      setTargetWidth(740);
      setTargetHeight(740);
      setAlignH('center');
      setAlignV('center');
      setUnifyAdvance(true);
      setAdvanceWidth(1000);
    }
  };

  // Filter glyphs matching scope
  const targetGlyphs = useMemo(() => {
    const list: GlyphData[] = [];
    const all = Object.values(project.glyphs) as GlyphData[];

    for (const g of all) {
      if (!g || !g.contours || g.contours.length === 0) continue;
      const u = g.unicode;

      if (scope === 'all') {
        list.push(g);
      } else if (scope === 'current') {
        if (u === selectedUnicode) list.push(g);
      } else if (scope === 'hiragana') {
        if (u >= 0x3041 && u <= 0x3096) list.push(g);
      } else if (scope === 'katakana') {
        if (u >= 0x30a1 && u <= 0x30fa) list.push(g);
      } else if (scope === 'kanji') {
        if ((u >= 0x4e00 && u <= 0x9fff) || (u >= 0x3400 && u <= 0x4dbf)) list.push(g);
      } else if (scope === 'latin') {
        if (u >= 0x0020 && u <= 0x007e) list.push(g);
      }
    }
    return list;
  }, [project.glyphs, scope, selectedUnicode]);

  // Preview sample glyph
  const previewGlyph = useMemo(() => {
    if (targetGlyphs.length === 0) {
      return project.glyphs[selectedUnicode] || (Object.values(project.glyphs) as GlyphData[])[0] || null;
    }
    const currentInTarget = targetGlyphs.find((g) => g.unicode === selectedUnicode);
    return currentInTarget || targetGlyphs[0];
  }, [targetGlyphs, project.glyphs, selectedUnicode]);

  // Normalized preview contours
  const normalizedPreviewContours = useMemo(() => {
    if (!previewGlyph || !previewGlyph.contours) return [];
    const res = normalizeGlyph(previewGlyph.contours, {
      mode: 'fitBox',
      targetWidth,
      targetHeight,
      alignHorizontal: alignH,
      alignVertical: alignV,
      targetCenterX: 500,
      targetCenterY: 500,
      targetBaselineY: 800,
      unifyAdvanceWidth: unifyAdvance,
      targetAdvanceWidth: advanceWidth,
      optimizePoints,
      weightDelta,
      normalizeWinding,
    });
    return res.contours;
  }, [
    previewGlyph,
    targetWidth,
    targetHeight,
    alignH,
    alignV,
    unifyAdvance,
    advanceWidth,
    optimizePoints,
    weightDelta,
    normalizeWinding,
  ]);

  if (!isOpen) return null;

  const handleApplyBatch = () => {
    if (targetGlyphs.length === 0) {
      if (onShowToast) {
        onShowToast('処理対象の文字がありません。先に文字を作成してください。', 'warning');
      }
      return;
    }

    const updatedGlyphs = { ...project.glyphs };
    let count = 0;

    for (const g of targetGlyphs) {
      if (!g.contours || g.contours.length === 0) continue;

      const normResult = normalizeGlyph(g.contours, {
        mode: 'fitBox',
        targetWidth,
        targetHeight,
        alignHorizontal: alignH,
        alignVertical: alignV,
        targetCenterX: 500,
        targetCenterY: 500,
        targetBaselineY: 800,
        unifyAdvanceWidth: unifyAdvance,
        targetAdvanceWidth: advanceWidth,
        optimizePoints,
        weightDelta,
        normalizeWinding,
      });

      updatedGlyphs[g.unicode] = {
        ...g,
        contours: normResult.contours,
        advanceWidth: normResult.advanceWidth ?? g.advanceWidth,
        lsb: normResult.lsb ?? g.lsb,
        modified: true,
      };
      count++;
    }

    setProject((prev) => ({
      ...prev,
      glyphs: updatedGlyphs,
      updatedAt: Date.now(),
    }));

    if (onShowToast) {
      onShowToast(`${count} 文字の字面枠・余白・線の太さ・ベジェ曲線を一括正規化＆最適化しました！`, 'success');
    }
    onClose();
  };

  const origSvg = previewGlyph ? contoursToSvgPath(normalizeGlyphContoursWinding(previewGlyph.contours || [])) : '';
  const normSvg = contoursToSvgPath(normalizeGlyphContoursWinding(normalizedPreviewContours));
  const origBbox = previewGlyph ? getContoursBoundingBox(previewGlyph.contours || []) : { width: 0, height: 0 };
  const normBbox = getContoursBoundingBox(normalizedPreviewContours);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-2xl border rounded-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-colors ${
          isLight ? 'bg-[#f7faf8] border-[#c8ded3] text-stone-800' : 'bg-[#151e18] border-[#25362b] text-emerald-100'
        }`}
      >
        {/* Header */}
        <div
          className={`p-3 sm:p-4 border-b flex items-center justify-between ${
            isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <div
              className={`p-1.5 rounded-md ${
                isLight ? 'bg-amber-100 text-amber-900' : 'bg-emerald-950 text-emerald-300'
              }`}
            >
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2
                className={`text-sm font-bold tracking-wide ${
                  isLight ? 'text-emerald-950' : 'text-emerald-200'
                }`}
              >
                最終調整・フォントサイズ＆品質一括統一スタジオ
              </h2>
              <p className={`text-[10px] ${isLight ? 'text-stone-500' : 'text-emerald-400/80'}`}>
                文字の大きさ、送り幅、余白バランス、ベジェ点数の軽量化を一括自動調整
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-md ${
              isLight ? 'text-stone-500 hover:bg-emerald-100' : 'text-emerald-400 hover:bg-[#202d24]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 text-xs">
          {/* Top Row: Preview & Scope */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-start">
            {/* Preview Box (5 cols) */}
            <div
              className={`sm:col-span-5 p-3 rounded-lg border flex flex-col items-center justify-center space-y-2 ${
                isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#101813] border-[#25362b]'
              }`}
            >
              <div className="w-full flex items-center justify-between text-[11px] font-semibold">
                <span>プレビュー確認</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  「{previewGlyph?.char || 'あ'}」
                </span>
              </div>

              {/* SVG Stage */}
              <div className="relative w-44 h-44 border rounded bg-white overflow-hidden shadow-inner flex items-center justify-center">
                {/* 1000x1000 EM Grid Lines */}
                <svg viewBox="0 0 1000 1000" className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* EM Box Boundary */}
                  <rect x="0" y="0" width="1000" height="1000" fill="#fafafa" stroke="#e0e0e0" strokeWidth="6" />
                  {/* Baseline Y: 800 */}
                  <line x1="0" y1="800" x2="1000" y2="800" stroke="#f87171" strokeWidth="4" strokeDasharray="10 10" />
                  {/* Center lines */}
                  <line x1="500" y1="0" x2="500" y2="1000" stroke="#93c5fd" strokeWidth="3" strokeDasharray="8 8" />
                  <line x1="0" y1="500" x2="1000" y2="500" stroke="#93c5fd" strokeWidth="3" strokeDasharray="8 8" />

                  {/* Target frame box */}
                  <rect
                    x={(1000 - targetWidth) / 2}
                    y={(1000 - targetHeight) / 2}
                    width={targetWidth}
                    height={targetHeight}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeDasharray="6 6"
                  />

                  {/* Original (Faint Red) */}
                  {origSvg && <path d={origSvg} fill="#fca5a5" opacity="0.45" fillRule="nonzero" />}

                  {/* Normalized (Crisp Emerald) */}
                  {normSvg && <path d={normSvg} fill="#047857" opacity="0.9" fillRule="nonzero" />}
                </svg>
              </div>

              <div className="w-full text-[10px] flex justify-between font-mono text-stone-500 dark:text-emerald-400/80">
                <span>元: {Math.round(origBbox.width)}×{Math.round(origBbox.height)}px</span>
                <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                  後: {Math.round(normBbox.width)}×{Math.round(normBbox.height)}px
                </span>
              </div>
            </div>

            {/* Scope Selection (7 cols) */}
            <div className="sm:col-span-7 space-y-2.5">
              <label className="font-semibold block text-xs">① 処理対象の文字グループ</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'all', label: '全文字一括', desc: '全体を均一に' },
                  { id: 'hiragana', label: 'ひらがな', desc: 'かな文字のみ' },
                  { id: 'katakana', label: 'カタカナ', desc: 'カナ文字のみ' },
                  { id: 'kanji', label: '漢字', desc: '漢字のみ' },
                  { id: 'latin', label: '英数字', desc: 'ASCII英数' },
                  { id: 'current', label: '現在の文字', desc: `「${previewGlyph?.char || ''}」のみ` },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setScope(s.id as TargetScope)}
                    className={`p-2 rounded border text-left flex flex-col transition-all ${
                      scope === s.id
                        ? isLight
                          ? 'bg-emerald-100/70 border-emerald-600 text-emerald-950 font-bold shadow-xs'
                          : 'bg-emerald-950 border-emerald-500 text-emerald-200 font-bold shadow-xs'
                        : isLight
                        ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-stone-50'
                        : 'bg-[#101813] border-[#25362b] text-emerald-300/80 hover:bg-[#18231c]'
                    }`}
                  >
                    <span className="text-xs">{s.label}</span>
                    <span className="text-[9px] opacity-70">{s.desc}</span>
                  </button>
                ))}
              </div>

              <div
                className={`p-2 rounded border flex items-center justify-between text-[11px] ${
                  isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                }`}
              >
                <span>選択中の対象文字数:</span>
                <span className="font-bold font-mono text-xs">{targetGlyphs.length} 文字</span>
              </div>
            </div>
          </div>

          {/* Section 2: Presets & Sizing */}
          <div
            className={`p-3 rounded-lg border space-y-3 ${
              isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#101813] border-[#25362b]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                <span>② 文字サイズ・枠プリセット</span>
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {[
                { id: 'standard', label: '標準和文 (820px)', sub: '推奨バランス' },
                { id: 'large', label: '大振り (890px)', sub: '見出し・漢字' },
                { id: 'kana', label: 'かな向け (780px)', sub: '適度な字間' },
                { id: 'compact', label: '小振り (740px)', sub: '長文・本文' },
                { id: 'custom', label: 'カスタム', sub: '自由指定' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetChange(p.id as any)}
                  className={`p-2 rounded border text-center transition-all ${
                    sizePreset === p.id
                      ? isLight
                        ? 'bg-emerald-800 text-white font-bold'
                        : 'bg-emerald-600 text-white font-bold'
                      : isLight
                      ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      : 'bg-[#18231c] border-[#25362b] text-emerald-300 hover:bg-[#202d24]'
                  }`}
                >
                  <div className="text-[11px]">{p.label}</div>
                  <div className="text-[9px] opacity-75">{p.sub}</div>
                </button>
              ))}
            </div>

            {/* Custom Sliders */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span>目標幅 (Width)</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{targetWidth} px</span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={960}
                  step={10}
                  value={targetWidth}
                  onChange={(e) => {
                    setTargetWidth(Number(e.target.value));
                    setSizePreset('custom');
                  }}
                  className="w-full accent-emerald-700"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span>目標高さ (Height)</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{targetHeight} px</span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={960}
                  step={10}
                  value={targetHeight}
                  onChange={(e) => {
                    setTargetHeight(Number(e.target.value));
                    setSizePreset('custom');
                  }}
                  className="w-full accent-emerald-700"
                />
              </div>
            </div>

            {/* Stroke Weight Normalization Slider */}
            <div className="pt-2 border-t space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-medium">線の太さ（ウェイト）一括調整:</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {weightDelta > 0 ? `+${weightDelta}px (太く)` : weightDelta < 0 ? `${weightDelta}px (細く)` : '0px (現状維持)'}
                </span>
              </div>
              <input
                type="range"
                min={-20}
                max={20}
                step={2}
                value={weightDelta}
                onChange={(e) => setWeightDelta(Number(e.target.value))}
                className="w-full accent-emerald-700"
              />
              <div className="flex justify-between text-[9px] text-stone-400">
                <span>-20px (スリム化)</span>
                <span>±0px (維持)</span>
                <span>+20px (ボールド化)</span>
              </div>
            </div>
          </div>

          {/* Section 3: Alignment, Advance Width, & Quality Optimization */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Position & Metric Controls */}
            <div
              className={`p-3 rounded-lg border space-y-2.5 ${
                isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#101813] border-[#25362b]'
              }`}
            >
              <span className="font-semibold block text-[11px]">③ 位置揃え・送り幅</span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-stone-500 dark:text-emerald-400 block mb-1">水平揃え</label>
                  <select
                    value={alignH}
                    onChange={(e) => setAlignH(e.target.value as any)}
                    className={`w-full border rounded p-1.5 text-xs ${
                      isLight ? 'bg-stone-50 border-[#c8ded3]' : 'bg-[#18231c] border-[#25362b]'
                    }`}
                  >
                    <option value="center">枠の中央揃え (推奨)</option>
                    <option value="keep">現在のX位置を維持</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-stone-500 dark:text-emerald-400 block mb-1">垂直揃え</label>
                  <select
                    value={alignV}
                    onChange={(e) => setAlignV(e.target.value as any)}
                    className={`w-full border rounded p-1.5 text-xs ${
                      isLight ? 'bg-stone-50 border-[#c8ded3]' : 'bg-[#18231c] border-[#25362b]'
                    }`}
                  >
                    <option value="center">枠の中央揃え (全角向け)</option>
                    <option value="baseline">ベースライン基準 (欧文向け)</option>
                    <option value="keep">現在のY位置を維持</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t flex items-center justify-between">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={unifyAdvance}
                    onChange={(e) => setUnifyAdvance(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] font-medium">送り幅(advanceWidth)を一括統一</span>
                </label>
                <input
                  type="number"
                  disabled={!unifyAdvance}
                  value={advanceWidth}
                  onChange={(e) => setAdvanceWidth(Number(e.target.value))}
                  className={`w-20 border rounded p-1 text-right font-mono text-xs ${
                    isLight ? 'bg-stone-50 border-[#c8ded3]' : 'bg-[#18231c] border-[#25362b]'
                  } ${!unifyAdvance && 'opacity-40'}`}
                />
              </div>
            </div>

            {/* Quality & Size Optimization (容量削減・バグ防止) */}
            <div
              className={`p-3 rounded-lg border space-y-2.5 ${
                isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#101813] border-[#25362b]'
              }`}
            >
              <span className="font-semibold flex items-center space-x-1 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>④ フォント容量肥大化防止＆バグ防止</span>
              </span>

              <div className="space-y-1.5 text-[10px] text-stone-600 dark:text-emerald-300/90">
                <label className="flex items-start space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={optimizePoints}
                    onChange={(e) => setOptimizePoints(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    <strong>ベジェ制御点の重複・ゴミ取り（容量削減）</strong>
                    <br />
                    微小な重複アンカーポイントの統合、不要なハンドル除去、整数座標クランプを行いファイルサイズを最小化します。
                  </span>
                </label>

                <label className="flex items-start space-x-1.5 cursor-pointer pt-1 border-t border-stone-100 dark:border-stone-800">
                  <input
                    type="checkbox"
                    checked={normalizeWinding}
                    onChange={(e) => setNormalizeWinding(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    <strong>TrueType標準ワインディング（輪郭方向）の統一</strong>
                    <br />
                    外輪郭を時計回り、中抜き穴を反時計回りに統一し、レンダラーでの黒塗りつぶれバグを防ぎます。
                  </span>
                </label>
              </div>

              <div
                className={`p-2 rounded text-[10px] space-y-0.5 border ${
                  isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                }`}
              >
                <div className="font-semibold flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Windows 11 日本語フォント規格適合</span>
                </div>
                <p className="text-[9px] opacity-80">
                  TTF出力時に自動でShift-JIS 932コードページフラグ、Windows行間メトリクス、縦書き代替グリフが設定されます。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`p-3 sm:p-4 border-t flex items-center justify-between ${
            isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <button
            onClick={onClose}
            className={`px-3 py-1.5 rounded-md border text-xs ${
              isLight
                ? 'bg-stone-50 border-stone-300 text-stone-700 hover:bg-stone-100'
                : 'bg-[#101813] border-[#25362b] text-emerald-300 hover:bg-[#18231c]'
            }`}
          >
            キャンセル
          </button>

          <button
            onClick={handleApplyBatch}
            className={`px-5 py-2 rounded-md font-bold text-xs flex items-center space-x-1.5 shadow-md active:scale-95 transition-all ${
              isLight
                ? 'bg-emerald-800 hover:bg-emerald-700 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold'
            }`}
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>対象 {targetGlyphs.length} 文字に一括適用する</span>
          </button>
        </div>
      </div>
    </div>
  );
};
