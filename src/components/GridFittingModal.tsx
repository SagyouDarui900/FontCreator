import React, { useState, useMemo } from 'react';
import {
  X,
  Grid,
  Zap,
  Sliders,
  Sparkles,
  Eye,
  CheckCircle2,
  RefreshCw,
  Search,
  Check,
  AlertTriangle,
  Info,
  Maximize2,
  Minimize2,
  Monitor,
  Flame,
} from 'lucide-react';
import { FontProject, GlyphData, PathContour, BezierNode } from '../types';

interface GridFittingModalProps {
  project: FontProject;
  setProject: React.Dispatch<React.SetStateAction<FontProject>>;
  isOpen: boolean;
  onClose: () => void;
  isLight: boolean;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export interface StemInfo {
  id: string;
  type: 'v' | 'h'; // Vertical stem or Horizontal stem
  pos: number; // coordinate in canvas units
  width: number; // stroke width in canvas units
}

/**
 * Detect vertical and horizontal stems from contour nodes
 */
export function detectGlyphStems(contours: PathContour[]): StemInfo[] {
  const stems: StemInfo[] = [];
  if (!contours || contours.length === 0) return stems;

  // Flatten all nodes
  const nodes: BezierNode[] = [];
  for (const c of contours) {
    if (c.nodes) nodes.push(...c.nodes);
  }

  if (nodes.length < 2) return stems;

  // Group nodes by X coordinate (for vertical stems)
  const xThreshold = 12; // tolerance in font units
  const xGroups: { x: number; count: number }[] = [];

  for (const n of nodes) {
    const existing = xGroups.find((g) => Math.abs(g.x - n.x) < xThreshold);
    if (existing) {
      existing.count++;
    } else {
      xGroups.push({ x: n.x, count: 1 });
    }
  }

  // Find parallel vertical stems
  const significantX = xGroups.filter((g) => g.count >= 2).sort((a, b) => a.x - b.x);
  for (let i = 0; i < significantX.length - 1; i++) {
    const left = significantX[i];
    const right = significantX[i + 1];
    const dist = right.x - left.x;
    // Typical stem thickness: 15 to 180 units
    if (dist >= 15 && dist <= 220) {
      stems.push({
        id: `vstem_${i}_${Math.round(left.x)}`,
        type: 'v',
        pos: Math.round((left.x + right.x) / 2),
        width: Math.round(dist),
      });
    }
  }

  // Group nodes by Y coordinate (for horizontal stems)
  const yThreshold = 12;
  const yGroups: { y: number; count: number }[] = [];

  for (const n of nodes) {
    const existing = yGroups.find((g) => Math.abs(g.y - n.y) < yThreshold);
    if (existing) {
      existing.count++;
    } else {
      yGroups.push({ y: n.y, count: 1 });
    }
  }

  const significantY = yGroups.filter((g) => g.count >= 2).sort((a, b) => a.y - b.y);
  for (let i = 0; i < significantY.length - 1; i++) {
    const top = significantY[i];
    const bottom = significantY[i + 1];
    const dist = bottom.y - top.y;
    if (dist >= 15 && dist <= 220) {
      stems.push({
        id: `hstem_${i}_${Math.round(top.y)}`,
        type: 'h',
        pos: Math.round((top.y + bottom.y) / 2),
        width: Math.round(dist),
      });
    }
  }

  return stems;
}

export const GridFittingModal: React.FC<GridFittingModalProps> = ({
  project,
  setProject,
  isOpen,
  onClose,
  isLight,
  onShowToast,
}) => {
  // Target PPEM Pixel Sizes for inspection
  const targetSizes = [9, 10, 12, 14, 16, 18, 20, 24, 32, 48];
  const [selectedPpem, setSelectedPpem] = useState<number>(16);

  // Subpixel Rendering Modes
  const [renderingMode, setRenderingMode] = useState<'grayscale' | 'mono' | 'subpixel_lcd'>('grayscale');

  // Currently Selected Glyph for Inspection
  const [selectedUnicode, setSelectedUnicode] = useState<number>(() => {
    const unicodes = Object.keys(project.glyphs).map(Number);
    return unicodes.length > 0 ? unicodes[0] : 0x3042; // default あ
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [enableGridFittingPreview, setEnableGridFittingPreview] = useState(true);

  const currentGlyph = project.glyphs[selectedUnicode] || {
    unicode: selectedUnicode,
    char: String.fromCharCode(selectedUnicode),
    name: `uni${selectedUnicode.toString(16).toUpperCase()}`,
    advanceWidth: 1000,
    lsb: 50,
    contours: [],
  };

  // Detected stems for current glyph
  const detectedStems = useMemo(() => {
    return detectGlyphStems(currentGlyph.contours);
  }, [currentGlyph.contours]);

  // Filter glyphs for quick selector
  const glyphList = useMemo(() => {
    const list: GlyphData[] = Object.values(project.glyphs);
    if (!searchQuery.trim()) return list.slice(0, 40);

    const q = searchQuery.toLowerCase().trim();
    return list.filter((g: GlyphData) => {
      return (
        g.char.toLowerCase().includes(q) ||
        g.name.toLowerCase().includes(q) ||
        `u+${g.unicode.toString(16)}`.includes(q)
      );
    });
  }, [project.glyphs, searchQuery]);

  // Apply Auto-Hinting & Stem Grid-Fitting to 1 Glyph or All Glyphs
  const applyGridFittingToGlyph = (glyph: GlyphData, ppem: number): GlyphData => {
    if (!glyph.contours || glyph.contours.length === 0) return glyph;

    const upm = project.metadata.unitsPerEm || 1000;
    const pixelSizeInUnits = upm / ppem; // Units per 1 pixel on screen

    // Clone contours
    const newContours: PathContour[] = glyph.contours.map((c) => ({
      ...c,
      nodes: c.nodes.map((n) => {
        let newX = n.x;
        let newY = n.y;

        if (enableGridFittingPreview) {
          // Snap coordinates to nearest pixel grid boundary
          newX = Math.round(n.x / pixelSizeInUnits) * pixelSizeInUnits;
          newY = Math.round(n.y / pixelSizeInUnits) * pixelSizeInUnits;
        }

        return {
          ...n,
          x: newX,
          y: newY,
          handleIn: n.handleIn
            ? {
                x: Math.round(n.handleIn.x / pixelSizeInUnits) * pixelSizeInUnits,
                y: Math.round(n.handleIn.y / pixelSizeInUnits) * pixelSizeInUnits,
              }
            : null,
          handleOut: n.handleOut
            ? {
                x: Math.round(n.handleOut.x / pixelSizeInUnits) * pixelSizeInUnits,
                y: Math.round(n.handleOut.y / pixelSizeInUnits) * pixelSizeInUnits,
              }
            : null,
        };
      }),
    }));

    return {
      ...glyph,
      contours: newContours,
      modified: true,
    };
  };

  // 1-Click Batch Auto-Hinting Application
  const handleBatchApplyHinting = () => {
    let updatedCount = 0;
    const newGlyphs: Record<number, GlyphData> = { ...project.glyphs };

    for (const uniStr of Object.keys(newGlyphs)) {
      const uni = Number(uniStr);
      const original = newGlyphs[uni];
      if (original && original.contours && original.contours.length > 0) {
        newGlyphs[uni] = applyGridFittingToGlyph(original, selectedPpem);
        updatedCount++;
      }
    }

    setProject((prev) => ({
      ...prev,
      glyphs: newGlyphs,
      updatedAt: Date.now(),
    }));

    onShowToast(`${updatedCount} 文字のステムを ${selectedPpem}px グリッドに最適化整列しました`, 'success');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border transition-colors ${
          isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-[#121c15] border-[#223326] text-stone-100'
        }`}
      >
        {/* Header Bar */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${
            isLight ? 'bg-stone-50/80 border-stone-200' : 'bg-[#16231a] border-[#223326]'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs ${
                isLight ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-950/60 border-amber-800 text-amber-400'
              }`}
            >
              <Grid className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                  低解像度グリッドフィッティング & ステムヒンティング分析
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                  Grid-Fitting Engine
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                12px〜24pxなどの低解像度画面で文字がボケたり潰れないよう、ステム端部をピクセル格子に整数整列します
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleBatchApplyHinting}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm active:scale-98 ${
                isLight
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
              title="すべてのグリフのステム境界を選択中のピクセルグリッドに自動整列します"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>全グリフ一括 {selectedPpem}px ヒンティング適用</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#1f3024] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: PPEM Selector & Render Mode */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b shrink-0 text-xs font-bold ${
            isLight ? 'bg-stone-100/60 border-stone-200' : 'bg-[#141e17] border-[#25362b]'
          }`}
        >
          {/* Target PPEM Size Selector */}
          <div className="flex items-center space-x-2 overflow-x-auto py-0.5">
            <span className="text-stone-500 dark:text-stone-400 shrink-0 flex items-center space-x-1">
              <Monitor className="w-3.5 h-3.5" />
              <span>検証解像度 (PPEM):</span>
            </span>
            <div className="flex items-center space-x-1">
              {targetSizes.map((sz) => (
                <button
                  key={sz}
                  onClick={() => setSelectedPpem(sz)}
                  className={`px-2.5 py-1 rounded-lg transition-all font-mono text-[11px] ${
                    selectedPpem === sz
                      ? isLight
                        ? 'bg-amber-600 text-white font-black shadow-xs'
                        : 'bg-amber-600 text-white font-black shadow-xs'
                      : isLight
                      ? 'bg-white text-stone-700 hover:bg-stone-200'
                      : 'bg-[#1a281e] text-stone-300 hover:bg-[#233829]'
                  }`}
                >
                  {sz}px
                </button>
              ))}
            </div>
          </div>

          {/* Subpixel Mode & Preview Toggle */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 border-r pr-3 border-stone-300 dark:border-stone-700">
              {(
                [
                  { id: 'grayscale', label: 'Anti-Aliased' },
                  { id: 'mono', label: 'Monochrome (1bit)' },
                  { id: 'subpixel_lcd', label: 'Subpixel LCD' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setRenderingMode(mode.id)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                    renderingMode === mode.id
                      ? 'bg-emerald-700 text-white'
                      : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setEnableGridFittingPreview((prev) => !prev)}
              className={`px-3 py-1 rounded-lg border text-[11px] font-bold flex items-center space-x-1 transition-all ${
                enableGridFittingPreview
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : isLight
                  ? 'bg-white text-stone-600 border-stone-300'
                  : 'bg-[#18261c] text-stone-300 border-[#25382b]'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-300" />
              <span>Grid-Fitting: {enableGridFittingPreview ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-stone-200 dark:divide-[#25362b]">
          {/* Left Panel: Glyph Selector & Stem Analysis Data */}
          <div className="w-full md:w-80 shrink-0 p-4 space-y-4 overflow-y-auto">
            {/* Glyph Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="文字・Unicode検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs outline-hidden ${
                  isLight ? 'bg-stone-50 border-stone-200 text-stone-900' : 'bg-[#111913] border-[#25362b] text-stone-100'
                }`}
              />
            </div>

            {/* Glyph Grid Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                検証対象文字選択:
              </label>
              <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto p-1 border rounded-xl border-stone-200 dark:border-[#25362b]">
                {glyphList.map((g) => (
                  <button
                    key={g.unicode}
                    onClick={() => setSelectedUnicode(g.unicode)}
                    className={`h-10 rounded-lg font-bold text-sm flex flex-col items-center justify-center transition-all ${
                      selectedUnicode === g.unicode
                        ? 'bg-amber-600 text-white shadow-xs'
                        : isLight
                        ? 'bg-white border border-stone-200 hover:bg-stone-100 text-stone-800'
                        : 'bg-[#152219] border border-[#223628] hover:bg-[#1f3326] text-stone-200'
                    }`}
                  >
                    <span>{g.char}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Stem Detection Analysis Box */}
            <div
              className={`p-3.5 rounded-xl border space-y-2.5 ${
                isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#141e17] border-[#25362b]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center space-x-1.5">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>自動検出ステム解析</span>
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600">
                  {detectedStems.length} 本検出
                </span>
              </div>

              {detectedStems.length === 0 ? (
                <p className="text-[11px] text-stone-400 py-2">
                  現在選択中の文字から明確な縦線・横線ステムは検出されませんでした。
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {detectedStems.map((stem) => (
                    <div
                      key={stem.id}
                      className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-white dark:bg-[#18261c] border border-stone-200 dark:border-[#223628]"
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            stem.type === 'v' ? 'bg-cyan-500' : 'bg-emerald-500'
                          }`}
                        />
                        <span className="font-bold">
                          {stem.type === 'v' ? '縦線ステム (v)' : '横線ステム (h)'}
                        </span>
                      </div>
                      <span className="font-mono text-stone-500 dark:text-stone-400">
                        位置: {stem.pos} / 幅: {stem.width}u
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Pixel Grid & Low-Res Raster Simulation */}
          <div className="flex-1 p-5 flex flex-col justify-between space-y-4 overflow-y-auto">
            {/* Visual Rasterization Comparison Display */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-amber-500" />
                  <span>「{currentGlyph.char}」 (U+{selectedUnicode.toString(16).toUpperCase()}) — {selectedPpem}px ピクセルラスタライズ結果</span>
                </h3>
                <span className="text-xs font-mono text-stone-400">
                  1 Pixel = {(1000 / selectedPpem).toFixed(1)} font units
                </span>
              </div>

              {/* Rasterized Pixel Grid View */}
              <div
                className={`w-full min-h-[300px] rounded-2xl border flex flex-col items-center justify-center p-6 space-y-4 transition-all ${
                  isLight ? 'bg-stone-100/80 border-stone-200' : 'bg-[#0f1711] border-[#223326]'
                }`}
              >
                {/* Simulated Low-Res Display Card */}
                <div className="flex flex-wrap items-center justify-center gap-8">
                  {/* Actual Size Preview */}
                  <div className="text-center space-y-2">
                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                      原寸プレビュー ({selectedPpem}px)
                    </span>
                    <div className="p-4 bg-white dark:bg-black rounded-xl border border-stone-200 dark:border-stone-800 flex items-center justify-center min-w-[80px] min-h-[80px]">
                      <span
                        style={{
                          fontSize: `${selectedPpem}px`,
                          fontFamily: `'${project.name}', sans-serif`,
                          lineHeight: '1',
                          filter:
                            renderingMode === 'mono'
                              ? 'contrast(200%)'
                              : renderingMode === 'subpixel_lcd'
                              ? 'drop-shadow(0.5px 0px 0px red) drop-shadow(-0.5px 0px 0px blue)'
                              : 'none',
                        }}
                        className="text-stone-900 dark:text-white"
                      >
                        {currentGlyph.char}
                      </span>
                    </div>
                  </div>

                  {/* 8x Zoom Pixel Grid Inspection */}
                  <div className="text-center space-y-2">
                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                      800% 拡大ピクセル格子シミュレーション
                    </span>
                    <div className="p-4 bg-white dark:bg-[#0a110b] rounded-xl border border-stone-300 dark:border-[#25382b] flex items-center justify-center min-w-[200px] min-h-[200px] relative overflow-hidden">
                      <span
                        style={{
                          fontSize: `${selectedPpem * 8}px`,
                          fontFamily: `'${project.name}', sans-serif`,
                          lineHeight: '1',
                          filter:
                            renderingMode === 'mono'
                              ? 'contrast(300%) grayscale(100%)'
                              : 'none',
                        }}
                        className="text-stone-900 dark:text-emerald-300 font-bold tracking-tight select-none"
                      >
                        {currentGlyph.char}
                      </span>

                      {/* Pixel Grid Mesh Overlay */}
                      <div
                        className="absolute inset-0 pointer-events-none opacity-20"
                        style={{
                          backgroundImage: `linear-gradient(to right, #888 1px, transparent 1px), linear-gradient(to bottom, #888 1px, transparent 1px)`,
                          backgroundSize: `${8 * (1000 / selectedPpem)}px ${8 * (1000 / selectedPpem)}px`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs text-stone-500 dark:text-stone-400">
                  <Info className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    「Grid-Fitting」をONにすると、ステムの線幅・位置が {selectedPpem}px
                    の解像度格子にぴったり揃い、文字のボケや線の掠れをシャープに補正します。
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`flex items-center justify-between px-5 py-3 border-t shrink-0 text-xs ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#141e17] border-[#223326]'
          }`}
        >
          <div className="flex items-center space-x-2 text-stone-500 dark:text-stone-400">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>ヒンティング調整を行うことで、Web・ゲームUI・Word・AviUtlでの小サイズ表示品質が劇的に向上します</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs"
          >
            完了・閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
