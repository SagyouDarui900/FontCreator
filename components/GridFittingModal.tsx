import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Grid,
  Zap,
  Sparkles,
  Eye,
  Search,
  Check,
  Info,
  Monitor,
  Flame,
  Layers,
  Settings2,
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
  pos: number; // coordinate in canvas units (0..1000)
  width: number; // stroke width in canvas units
  alignedPos?: number;
  shiftDelta?: number;
}

export interface GridFittingConfig {
  snapStrength: number; // 0.0 to 1.0
  minStemWidthPx: number; // 0 (off), 1.0 (1px), 1.5, 2.0
  snapVertical: boolean;
  snapHorizontal: boolean;
  snapMetrics: boolean; // Snap to baseline & cap height
  adjustHandles: boolean; // Move Bezier handles proportionally
}

/**
 * Convert contour set to SVG Path 'd' attribute string
 */
export function contourToSvgPath(contour: PathContour): string {
  if (!contour.nodes || contour.nodes.length === 0) return '';
  let d = '';
  const nodes = contour.nodes;
  const start = nodes[0];
  d += `M ${start.x} ${start.y} `;

  for (let i = 0; i < nodes.length; i++) {
    const curr = nodes[i];
    const nextIndex = (i + 1) % nodes.length;
    if (nextIndex === 0 && !contour.closed) break;
    const next = nodes[nextIndex];

    if (curr.handleOut || next.handleIn) {
      const h1 = curr.handleOut || curr;
      const h2 = next.handleIn || next;
      d += `C ${h1.x} ${h1.y}, ${h2.x} ${h2.y}, ${next.x} ${next.y} `;
    } else {
      d += `L ${next.x} ${next.y} `;
    }
  }

  if (contour.closed) {
    d += ' Z';
  }
  return d;
}

export function contoursToSvgPath(contours: PathContour[]): string {
  if (!contours || contours.length === 0) return '';
  return contours.map(contourToSvgPath).filter(Boolean).join(' ');
}

/**
 * Detect vertical and horizontal stems from contour nodes
 */
export function detectGlyphStems(contours: PathContour[], ppem: number, upm: number = 1000): StemInfo[] {
  const stems: StemInfo[] = [];
  if (!contours || contours.length === 0) return stems;

  const nodes: BezierNode[] = [];
  for (const c of contours) {
    if (c.nodes) nodes.push(...c.nodes);
  }

  if (nodes.length < 2) return stems;

  const pxUnit = upm / ppem;

  // Group nodes by X coordinate (for vertical stems)
  const xThreshold = Math.max(12, pxUnit * 0.25);
  const xGroups: { x: number; count: number }[] = [];

  for (const n of nodes) {
    const existing = xGroups.find((g) => Math.abs(g.x - n.x) < xThreshold);
    if (existing) {
      existing.count++;
    } else {
      xGroups.push({ x: n.x, count: 1 });
    }
  }

  const significantX = xGroups.filter((g) => g.count >= 2).sort((a, b) => a.x - b.x);
  for (let i = 0; i < significantX.length - 1; i++) {
    const left = significantX[i];
    const right = significantX[i + 1];
    const dist = right.x - left.x;
    if (dist >= 15 && dist <= 240) {
      const center = (left.x + right.x) / 2;
      const roundedGridCenter = Math.round(center / pxUnit) * pxUnit;
      stems.push({
        id: `vstem_${i}_${Math.round(left.x)}`,
        type: 'v',
        pos: Math.round(center),
        width: Math.round(dist),
        alignedPos: Math.round(roundedGridCenter),
        shiftDelta: Math.round(roundedGridCenter - center),
      });
    }
  }

  // Group nodes by Y coordinate (for horizontal stems)
  const yThreshold = Math.max(12, pxUnit * 0.25);
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
    if (dist >= 15 && dist <= 240) {
      const center = (top.y + bottom.y) / 2;
      const roundedGridCenter = Math.round(center / pxUnit) * pxUnit;
      stems.push({
        id: `hstem_${i}_${Math.round(top.y)}`,
        type: 'h',
        pos: Math.round(center),
        width: Math.round(dist),
        alignedPos: Math.round(roundedGridCenter),
        shiftDelta: Math.round(roundedGridCenter - center),
      });
    }
  }

  return stems;
}

/**
 * Apply stem grid-fitting and hinting transformation to a glyph contour set
 */
export function applyGridFittingToGlyph(
  glyph: GlyphData,
  ppem: number,
  upm: number = 1000,
  config: GridFittingConfig
): GlyphData {
  if (!glyph.contours || glyph.contours.length === 0) return glyph;

  const pixelSizeInUnits = upm / ppem; // Units per 1 pixel on screen
  const minStrokeUnits = config.minStemWidthPx * pixelSizeInUnits;

  const newContours: PathContour[] = glyph.contours.map((c) => ({
    ...c,
    nodes: c.nodes.map((n) => {
      let targetX = n.x;
      let targetY = n.y;

      if (config.snapVertical) {
        const roundedX = Math.round(n.x / pixelSizeInUnits) * pixelSizeInUnits;
        targetX = n.x + (roundedX - n.x) * config.snapStrength;
      }

      if (config.snapHorizontal) {
        const roundedY = Math.round(n.y / pixelSizeInUnits) * pixelSizeInUnits;
        targetY = n.y + (roundedY - n.y) * config.snapStrength;
      }

      // Metrics Snapping (Baseline y=200/0, Cap Height y=700)
      if (config.snapMetrics) {
        if (Math.abs(n.y - 200) < pixelSizeInUnits * 0.5) {
          targetY = 200;
        } else if (Math.abs(n.y - 0) < pixelSizeInUnits * 0.5) {
          targetY = 0;
        } else if (Math.abs(n.y - 700) < pixelSizeInUnits * 0.5) {
          targetY = 700;
        }
      }

      const dx = targetX - n.x;
      const dy = targetY - n.y;

      let handleIn = n.handleIn ? { ...n.handleIn } : null;
      let handleOut = n.handleOut ? { ...n.handleOut } : null;

      if (config.adjustHandles) {
        if (handleIn) {
          handleIn.x += dx * config.snapStrength;
          handleIn.y += dy * config.snapStrength;
        }
        if (handleOut) {
          handleOut.x += dx * config.snapStrength;
          handleOut.y += dy * config.snapStrength;
        }
      }

      return {
        ...n,
        x: Math.round(targetX * 10) / 10,
        y: Math.round(targetY * 10) / 10,
        handleIn,
        handleOut,
      };
    }),
  }));

  // Ensure minimum stem width protection if requested
  if (minStrokeUnits > 0) {
    const stems = detectGlyphStems(newContours, ppem, upm);
    for (const s of stems) {
      if (s.width < minStrokeUnits) {
        const expand = (minStrokeUnits - s.width) / 2;
        for (const c of newContours) {
          for (const node of c.nodes) {
            if (s.type === 'v' && Math.abs(node.x - s.pos) < s.width + 10) {
              node.x += node.x >= s.pos ? expand : -expand;
            } else if (s.type === 'h' && Math.abs(node.y - s.pos) < s.width + 10) {
              node.y += node.y >= s.pos ? expand : -expand;
            }
          }
        }
      }
    }
  }

  return {
    ...glyph,
    contours: newContours,
    modified: true,
  };
}

export const GridFittingModal: React.FC<GridFittingModalProps> = ({
  project,
  setProject,
  isOpen,
  onClose,
  isLight,
  onShowToast,
}) => {
  // Target PPEM Sizes
  const targetSizes = [9, 10, 12, 14, 16, 18, 20, 24, 32, 48];
  const [selectedPpem, setSelectedPpem] = useState<number>(16);

  // Subpixel / Raster Modes
  const [renderingMode, setRenderingMode] = useState<'grayscale' | 'mono' | 'subpixel_lcd'>('grayscale');

  // Display View Option
  const [showStemOverlay, setShowStemOverlay] = useState(true);
  const [hoveredStemId, setHoveredStemId] = useState<string | null>(null);

  // Mobile Preview Mode Switch
  const [mobilePreviewDisplay, setMobilePreviewDisplay] = useState<'raster' | 'vector' | 'both'>('raster');

  // Grid Fitting Configuration
  const [config, setConfig] = useState<GridFittingConfig>({
    snapStrength: 1.0,
    minStemWidthPx: 1.0,
    snapVertical: true,
    snapHorizontal: true,
    snapMetrics: true,
    adjustHandles: true,
  });

  const [enablePreview, setEnablePreview] = useState(true);

  // Active Selected Glyph
  const [selectedUnicode, setSelectedUnicode] = useState<number>(() => {
    const unicodes = Object.keys(project.glyphs).map(Number);
    return unicodes.length > 0 ? unicodes[0] : 0x3042; // default あ
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'preview' | 'stems' | 'settings'>('preview');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const upm = project.metadata.unitsPerEm || 1000;

  const currentGlyph = project.glyphs[selectedUnicode] || {
    unicode: selectedUnicode,
    char: String.fromCharCode(selectedUnicode),
    name: `uni${selectedUnicode.toString(16).toUpperCase()}`,
    advanceWidth: 1000,
    lsb: 50,
    contours: [],
  };

  // Preview Fitted Glyph (Virtual calculation for inspection)
  const fittedGlyph = useMemo(() => {
    if (!enablePreview) return currentGlyph;
    return applyGridFittingToGlyph(currentGlyph, selectedPpem, upm, config);
  }, [currentGlyph, selectedPpem, upm, config, enablePreview]);

  // Detected Stems for current glyph
  const detectedStems = useMemo(() => {
    return detectGlyphStems(enablePreview ? fittedGlyph.contours : currentGlyph.contours, selectedPpem, upm);
  }, [currentGlyph.contours, fittedGlyph.contours, selectedPpem, upm, enablePreview]);

  // Filter Glyph List
  const glyphList = useMemo(() => {
    const list: GlyphData[] = Object.values(project.glyphs);
    if (!searchQuery.trim()) return list.slice(0, 50);

    const q = searchQuery.toLowerCase().trim();
    return list.filter((g: GlyphData) => {
      return (
        g.char.toLowerCase().includes(q) ||
        g.name.toLowerCase().includes(q) ||
        `u+${g.unicode.toString(16)}`.includes(q)
      );
    });
  }, [project.glyphs, searchQuery]);

  // Draw Pixel Grid Raster Simulation on HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const contoursToRender = enablePreview ? fittedGlyph.contours : currentGlyph.contours;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Background fill
    ctx.fillStyle = isLight ? '#f8faf9' : '#0a120c';
    ctx.fillRect(0, 0, width, height);

    if (!contoursToRender || contoursToRender.length === 0) {
      ctx.fillStyle = isLight ? '#a8a29e' : '#525252';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('輪郭パスが存在しません', width / 2, height / 2);
      return;
    }

    // Offscreen canvas at exact selectedPpem resolution
    const off = document.createElement('canvas');
    off.width = selectedPpem;
    off.height = selectedPpem;
    const offCtx = off.getContext('2d');

    if (!offCtx) return;

    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, selectedPpem, selectedPpem);

    offCtx.fillStyle = '#000000';
    offCtx.beginPath();

    const scale = selectedPpem / upm;

    for (const c of contoursToRender) {
      if (!c.nodes || c.nodes.length === 0) continue;
      const start = c.nodes[0];
      const sx = start.x * scale;
      const sy = (upm - start.y) * scale;
      offCtx.moveTo(sx, sy);

      for (let i = 0; i < c.nodes.length; i++) {
        const curr = c.nodes[i];
        const nextIndex = (i + 1) % c.nodes.length;
        if (nextIndex === 0 && !c.closed) break;
        const next = c.nodes[nextIndex];

        if (curr.handleOut || next.handleIn) {
          const h1 = curr.handleOut || curr;
          const h2 = next.handleIn || next;
          offCtx.bezierCurveTo(
            h1.x * scale,
            (upm - h1.y) * scale,
            h2.x * scale,
            (upm - h2.y) * scale,
            next.x * scale,
            (upm - next.y) * scale
          );
        } else {
          offCtx.lineTo(next.x * scale, (upm - next.y) * scale);
        }
      }
      if (c.closed) {
        offCtx.closePath();
      }
    }

    offCtx.fill('evenodd');

    const imgData = offCtx.getImageData(0, 0, selectedPpem, selectedPpem);
    const data = imgData.data;

    // Apply rendering mode processing
    if (renderingMode === 'mono') {
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const v = avg < 128 ? 0 : 255;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }
      offCtx.putImageData(imgData, 0, 0);
    }

    // Render scaled pixel grid onto main display canvas
    const cellSize = width / selectedPpem;
    ctx.imageSmoothingEnabled = false;

    // Draw pixel blocks
    for (let py = 0; py < selectedPpem; py++) {
      for (let px = 0; px < selectedPpem; px++) {
        const idx = (py * selectedPpem + px) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const alpha = (255 - (r + g + b) / 3) / 255;

        if (renderingMode === 'subpixel_lcd') {
          // LCD subpixel stripes (Red Green Blue)
          const subW = cellSize / 3;
          ctx.fillStyle = `rgb(${255 - r}, 0, 0)`;
          ctx.fillRect(px * cellSize, py * cellSize, subW, cellSize);
          ctx.fillStyle = `rgb(0, ${255 - g}, 0)`;
          ctx.fillRect(px * cellSize + subW, py * cellSize, subW, cellSize);
          ctx.fillStyle = `rgb(0, 0, ${255 - b})`;
          ctx.fillRect(px * cellSize + subW * 2, py * cellSize, subW, cellSize);
        } else {
          // Standard Grayscale / Mono pixel tile
          const fillColor = isLight
            ? `rgba(20, 30, 25, ${alpha})`
            : `rgba(52, 211, 153, ${alpha * 0.9})`;
          ctx.fillStyle = fillColor;
          ctx.fillRect(px * cellSize, py * cellSize, cellSize, cellSize);
        }
      }
    }

    // Draw crisp pixel grid mesh
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= selectedPpem; i++) {
      const p = Math.floor(i * cellSize) + 0.5;
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, height);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(width, p);
      ctx.stroke();
    }
  }, [
    fittedGlyph.contours,
    currentGlyph.contours,
    selectedPpem,
    upm,
    renderingMode,
    enablePreview,
    isLight,
  ]);

  // Apply to currently selected glyph
  const handleApplyToCurrentGlyph = () => {
    const updated = applyGridFittingToGlyph(currentGlyph, selectedPpem, upm, config);
    setProject((prev) => ({
      ...prev,
      glyphs: {
        ...prev.glyphs,
        [selectedUnicode]: updated,
      },
      updatedAt: Date.now(),
    }));
    onShowToast(`「${currentGlyph.char}」のステムを ${selectedPpem}px グリッドに最適化整列しました`, 'success');
  };

  // 1-Click Batch Auto-Hinting Application for all glyphs
  const handleBatchApplyHinting = () => {
    let updatedCount = 0;
    const newGlyphs: Record<number, GlyphData> = { ...project.glyphs };

    for (const uniStr of Object.keys(newGlyphs)) {
      const uni = Number(uniStr);
      const original = newGlyphs[uni];
      if (original && original.contours && original.contours.length > 0) {
        newGlyphs[uni] = applyGridFittingToGlyph(original, selectedPpem, upm, config);
        updatedCount++;
      }
    }

    setProject((prev) => ({
      ...prev,
      glyphs: newGlyphs,
      updatedAt: Date.now(),
    }));

    onShowToast(`全 ${updatedCount} 文字のステムを ${selectedPpem}px グリッドに最適化整列しました`, 'success');
  };

  // Apply Preset configurations
  const applyPreset = (presetType: 'retro' | 'web_ui' | 'soft') => {
    if (presetType === 'retro') {
      setConfig({
        snapStrength: 1.0,
        minStemWidthPx: 1.0,
        snapVertical: true,
        snapHorizontal: true,
        snapMetrics: true,
        adjustHandles: true,
      });
      setRenderingMode('mono');
      onShowToast('「レトロゲーム・ドット風」プリセットを適用しました', 'info');
    } else if (presetType === 'web_ui') {
      setConfig({
        snapStrength: 0.85,
        minStemWidthPx: 1.0,
        snapVertical: true,
        snapHorizontal: true,
        snapMetrics: true,
        adjustHandles: true,
      });
      setRenderingMode('grayscale');
      onShowToast('「Webフォント・小画面最適化」プリセットを適用しました', 'info');
    } else if (presetType === 'soft') {
      setConfig({
        snapStrength: 0.5,
        minStemWidthPx: 0,
        snapVertical: true,
        snapHorizontal: true,
        snapMetrics: false,
        adjustHandles: true,
      });
      setRenderingMode('grayscale');
      onShowToast('「高解像度・ソフト整列」プリセットを適用しました', 'info');
    }
  };

  if (!isOpen) return null;

  const currentSvgPath = contoursToSvgPath(enablePreview ? fittedGlyph.contours : currentGlyph.contours);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4 md:p-6 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-6xl h-[98vh] sm:h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border transition-colors ${
          isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-[#101812] border-[#223326] text-stone-100'
        }`}
      >
        {/* Header Bar - Ultra Compact on Mobile */}
        <div
          className={`flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3.5 border-b shrink-0 ${
            isLight ? 'bg-stone-50/90 border-stone-200' : 'bg-[#142018] border-[#223326]'
          }`}
        >
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div
              className={`hidden sm:flex w-9 h-9 sm:w-10 sm:h-10 rounded-xl items-center justify-center border  shrink-0 ${
                isLight ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-950/60 border-amber-800 text-amber-400'
              }`}
            >
              <Grid className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <h2 className="text-sm sm:text-lg font-extrabold tracking-tight truncate">
                  グリッド整列 & ヒンティング工房
                </h2>
                <span className="hidden md:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                  Grid-Fitting Engine v2.0
                </span>
              </div>
              <p className="hidden sm:block text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                9px〜24pxの小サイズ表示で文字線がボケたりかすれないよう、ステム・境界座標をピクセル格子に整数整列します
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <button
              onClick={handleApplyToCurrentGlyph}
 className={`hidden sm:flex px-3.5 py-2 rounded-xl text-xs font-bold items-center space-x-1.5 transition-all active:scale-98 ${
                isLight
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
              title="選択中の1文字のみにヒンティングを適用します"
            >
              <Check className="w-4 h-4" />
              <span>「{currentGlyph.char}」に適用</span>
            </button>

            <button
              onClick={handleBatchApplyHinting}
 className={`hidden sm:flex px-3.5 py-2 rounded-xl text-xs font-bold items-center space-x-1.5 transition-all active:scale-98 ${
                isLight
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title="すべての文字のステムを選択中のグリッド条件で一括整列します"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>全文字一括 {selectedPpem}px 適用</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#1a2e21] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: PPEM Selector & View Controls (Single horizontal scroll line on mobile) */}
        <div
          className={`flex items-center justify-between gap-2 px-3 sm:px-6 py-1.5 sm:py-2.5 border-b shrink-0 text-xs font-bold overflow-x-auto whitespace-nowrap scrollbar-none ${
            isLight ? 'bg-stone-100/70 border-stone-200' : 'bg-[#121d15] border-[#223326]'
          }`}
        >
          {/* Target PPEM Size Selector */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="text-stone-500 dark:text-stone-400 shrink-0 flex items-center space-x-1 text-[11px] sm:text-xs">
              <Monitor className="w-3.5 h-3.5 text-amber-500 hidden sm:inline-block" />
              <span className="hidden sm:inline">検証解像度 (PPEM):</span>
              <span className="sm:hidden text-amber-500 font-bold">PPEM:</span>
            </span>
            <div className="flex items-center space-x-1">
              {targetSizes.map((sz) => (
                <button
                  key={sz}
                  onClick={() => setSelectedPpem(sz)}
                  className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg transition-all font-mono text-[10px] sm:text-[11px] ${
                    selectedPpem === sz
                      ? 'bg-amber-600 text-white font-black '
                      : isLight
                      ? 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
                      : 'bg-[#1a291f] text-stone-300 hover:bg-[#24392b] border border-[#233829]'
                  }`}
                >
                  {sz}px
                </button>
              ))}
            </div>
          </div>

          {/* Subpixel Mode & Preview Toggles */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <div className="flex items-center space-x-0.5 bg-black/5 dark:bg-white/5 p-0.5 sm:p-1 rounded-xl">
              {(
                [
                  { id: 'grayscale', label: 'Anti-Alias' },
                  { id: 'mono', label: '1-Bit' },
                  { id: 'subpixel_lcd', label: 'LCD' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setRenderingMode(mode.id)}
                  className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all ${
                    renderingMode === mode.id
                      ? 'bg-emerald-600 text-white '
                      : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setEnablePreview((prev) => !prev)}
              className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-xl border text-[10px] sm:text-[11px] font-bold flex items-center space-x-1 transition-all shrink-0 ${
                enablePreview
                  ? 'bg-emerald-600 text-white border-emerald-600 '
                  : isLight
                  ? 'bg-white text-stone-600 border-stone-300'
                  : 'bg-[#18261c] text-stone-300 border-[#25382b]'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-300" />
              <span>{enablePreview ? 'ON (整列後)' : 'OFF (元パス)'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Navigation */}
        <div className="flex sm:hidden border-b border-stone-200 dark:border-[#223326] bg-stone-100 dark:bg-[#121c15] shrink-0">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 py-1.5 text-xs font-bold border-b-2 ${
              activeTab === 'preview'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-stone-500'
            }`}
          >
            プレビュー
          </button>
          <button
            onClick={() => setActiveTab('stems')}
            className={`flex-1 py-1.5 text-xs font-bold border-b-2 ${
              activeTab === 'stems'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-stone-500'
            }`}
          >
            ステム解析 ({detectedStems.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-1.5 text-xs font-bold border-b-2 ${
              activeTab === 'settings'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-stone-500'
            }`}
          >
            ヒンティング設定
          </button>
        </div>

        {/* Main Body Grid */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-stone-200 dark:divide-[#223326]">
          {/* Left Sidebar: Glyph List & Stem Inspector */}
          <div
            className={`w-full md:w-72 shrink-0 p-3 sm:p-4 pb-24 sm:pb-4 space-y-3 sm:space-y-4 overflow-y-auto ${
              activeTab !== 'stems' ? 'hidden sm:block' : ''
            }`}
          >
            {/* Glyph Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
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

            {/* Quick Presets Buttons */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                クイックヒンティングプリセット:
              </span>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => applyPreset('retro')}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-bold border bg-stone-100 dark:bg-[#18261c] border-stone-200 dark:border-[#223828] hover:border-amber-500 transition-colors"
                >
                  ドットゲーム
                </button>
                <button
                  onClick={() => applyPreset('web_ui')}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-bold border bg-stone-100 dark:bg-[#18261c] border-stone-200 dark:border-[#223828] hover:border-amber-500 transition-colors"
                >
                  Web・UI画面
                </button>
                <button
                  onClick={() => applyPreset('soft')}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-bold border bg-stone-100 dark:bg-[#18261c] border-stone-200 dark:border-[#223828] hover:border-amber-500 transition-colors"
                >
                  ソフト整列
                </button>
              </div>
            </div>

            {/* Glyph Grid Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center justify-between">
                <span>検証対象文字選択 ({glyphList.length}):</span>
              </label>
              <div className="grid grid-cols-5 gap-1.5 max-h-36 sm:max-h-40 overflow-y-auto p-1.5 border rounded-xl border-stone-200 dark:border-[#223326] bg-stone-50/50 dark:bg-[#0d150e]">
                {glyphList.map((g) => (
                  <button
                    key={g.unicode}
                    onClick={() => setSelectedUnicode(g.unicode)}
                    className={`h-9 rounded-lg font-bold text-sm flex items-center justify-center transition-all ${
                      selectedUnicode === g.unicode
                        ? 'bg-amber-600 text-white '
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

            {/* Stem Detection Box */}
            <div
              className={`p-3 sm:p-3.5 rounded-xl border space-y-2.5 ${
                isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#142018] border-[#223326]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center space-x-1.5">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>検出ステム解析</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600">
                  {detectedStems.length} 本
                </span>
              </div>

              {detectedStems.length === 0 ? (
                <p className="text-[11px] text-stone-400 py-2">
                  選択中の文字から垂直・水平の主要ステムが検出されませんでした。
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {detectedStems.map((stem) => (
                    <div
                      key={stem.id}
                      onMouseEnter={() => setHoveredStemId(stem.id)}
                      onMouseLeave={() => setHoveredStemId(null)}
                      className={`flex items-center justify-between text-[11px] p-2 rounded-lg border transition-all cursor-pointer ${
                        hoveredStemId === stem.id
                          ? 'border-amber-500 bg-amber-500/10'
                          : isLight
                          ? 'bg-white border-stone-200 hover:bg-stone-100'
                          : 'bg-[#18261c] border-[#223628] hover:bg-[#1f3326]'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            stem.type === 'v' ? 'bg-cyan-500' : 'bg-emerald-500'
                          }`}
                        />
                        <span className="font-bold">
                          {stem.type === 'v' ? '縦ステム (v)' : '横ステム (h)'}
                        </span>
                      </div>
                      <div className="text-right font-mono text-[10px] text-stone-500 dark:text-stone-400">
                        <div>位置: {stem.pos}u (幅 {stem.width}u)</div>
                        {stem.shiftDelta !== undefined && (
                          <div className={stem.shiftDelta !== 0 ? 'text-amber-500 font-bold' : ''}>
                            シフト: {stem.shiftDelta > 0 ? `+${stem.shiftDelta}` : stem.shiftDelta}u
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Center Canvas View: Vector Contour Overlay & Low-Res Raster Canvas */}
          <div
            className={`flex-1 p-3 sm:p-5 pb-24 sm:pb-5 flex flex-col space-y-3 sm:space-y-4 overflow-y-auto ${
              activeTab !== 'preview' ? 'hidden sm:flex' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs sm:text-sm flex items-center space-x-1.5 sm:space-x-2">
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                <span>
                  「{currentGlyph.char}」 (U+{selectedUnicode.toString(16).toUpperCase()}) — {selectedPpem}px
                </span>
              </h3>
              <span className="text-[10px] sm:text-xs font-mono text-stone-400">
                1px = {(upm / selectedPpem).toFixed(1)}u
              </span>
            </div>

            {/* Mobile Preview View Switcher */}
            <div className="flex sm:hidden items-center justify-center space-x-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
              <button
                onClick={() => setMobilePreviewDisplay('raster')}
                className={`flex-1 py-1 text-[10px] font-bold rounded-lg ${
                  mobilePreviewDisplay === 'raster'
                    ? 'bg-amber-600 text-white '
                    : 'text-stone-500'
                }`}
              >
                ピクセル格子
              </button>
              <button
                onClick={() => setMobilePreviewDisplay('vector')}
                className={`flex-1 py-1 text-[10px] font-bold rounded-lg ${
                  mobilePreviewDisplay === 'vector'
                    ? 'bg-amber-600 text-white '
                    : 'text-stone-500'
                }`}
              >
                ベクトル & ステム
              </button>
              <button
                onClick={() => setMobilePreviewDisplay('both')}
                className={`flex-1 py-1 text-[10px] font-bold rounded-lg ${
                  mobilePreviewDisplay === 'both'
                    ? 'bg-amber-600 text-white '
                    : 'text-stone-500'
                }`}
              >
                両方表示
              </button>
            </div>

            {/* Display Visual Container */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 flex-1">
              {/* 1. Vector Path & Stem Guide Overlay */}
              <div
                className={`p-3 sm:p-4 rounded-2xl border flex flex-col justify-between space-y-2 sm:space-y-3 relative overflow-hidden ${
                  mobilePreviewDisplay === 'raster' ? 'hidden sm:flex' : 'flex'
                } ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#0f1711] border-[#223326]'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-500 dark:text-stone-400 flex items-center space-x-1">
                    <Layers className="w-3.5 h-3.5 text-amber-500" />
                    <span>ベクトルパス & ステムガイド</span>
                  </span>
                  <button
                    onClick={() => setShowStemOverlay((prev) => !prev)}
                    className="text-[10px] px-2 py-0.5 rounded-md font-bold border border-stone-300 dark:border-stone-700 text-stone-500"
                  >
                    ステム: {showStemOverlay ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* SVG Vector Contour Display */}
                <div className="w-full h-48 sm:h-72 border rounded-xl relative flex items-center justify-center overflow-hidden bg-white dark:bg-[#070d08]">
                  <svg
                    viewBox={`0 0 ${upm} ${upm}`}
                    className="w-full h-full max-w-[220px] sm:max-w-[280px] max-h-[220px] sm:max-h-[280px]"
                    style={{ transform: 'scaleY(-1)' }}
                  >
                    {/* Background Grid Lines */}
                    <line x1="0" y1="200" x2={upm} y2="200" stroke="#f59e0b" strokeDasharray="4,4" strokeWidth="6" opacity="0.5" />
                    <line x1="0" y1="700" x2={upm} y2="700" stroke="#10b981" strokeDasharray="4,4" strokeWidth="6" opacity="0.5" />

                    {/* Stem Highlight Bands */}
                    {showStemOverlay &&
                      detectedStems.map((stem) => {
                        const isHovered = hoveredStemId === stem.id;
                        if (stem.type === 'v') {
                          return (
                            <rect
                              key={stem.id}
                              x={stem.pos - stem.width / 2}
                              y="0"
                              width={stem.width}
                              height={upm}
                              fill={isHovered ? '#06b6d4' : '#06b6d4'}
                              opacity={isHovered ? '0.45' : '0.2'}
                            />
                          );
                        } else {
                          return (
                            <rect
                              key={stem.id}
                              x="0"
                              y={stem.pos - stem.width / 2}
                              width={upm}
                              height={stem.width}
                              fill={isHovered ? '#10b981' : '#10b981'}
                              opacity={isHovered ? '0.45' : '0.2'}
                            />
                          );
                        }
                      })}

                    {/* Glyph Path Contour */}
                    <path
                      d={currentSvgPath}
                      fill={isLight ? '#1c1917' : '#34d399'}
                      fillRule="evenodd"
                      opacity={enablePreview ? '0.9' : '1.0'}
                    />
                  </svg>
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-500">
                  <span className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" />
                    <span>縦</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block ml-2" />
                    <span>横</span>
                  </span>
                  <span className="font-mono text-[10px]">UPM: {upm}</span>
                </div>
              </div>

              {/* 2. Low-Res Raster Simulation Canvas */}
              <div
                className={`p-3 sm:p-4 rounded-2xl border flex flex-col justify-between space-y-2 sm:space-y-3 relative overflow-hidden ${
                  mobilePreviewDisplay === 'vector' ? 'hidden sm:flex' : 'flex'
                } ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#0f1711] border-[#223326]'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-500 dark:text-stone-400 flex items-center space-x-1">
                    <Monitor className="w-3.5 h-3.5 text-amber-500" />
                    <span>{selectedPpem}px ラスタライズ結果</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600">
                    {renderingMode}
                  </span>
                </div>

                {/* Canvas Pixel Display */}
                <div className="w-full h-48 sm:h-72 border rounded-xl flex items-center justify-center p-2 sm:p-3 overflow-hidden bg-white dark:bg-[#070d08]">
                  <canvas
                    ref={canvasRef}
                    width={280}
                    height={280}
                    className="max-w-[200px] sm:max-w-[280px] max-h-[200px] sm:max-h-[280px] rounded-lg border border-stone-200 dark:border-stone-800 shadow-inner"
                  />
                </div>

                {/* Actual Size 1x Preview */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <span className="text-[10px] sm:text-[11px] font-bold text-stone-500">原寸 ({selectedPpem}px):</span>
                    <div className="p-1.5 sm:p-2 bg-white dark:bg-black rounded-lg border border-stone-200 dark:border-stone-800 inline-flex items-center justify-center min-w-[32px] min-h-[32px]">
                      <span
                        style={{
                          fontSize: `${selectedPpem}px`,
                          lineHeight: '1',
                          filter: renderingMode === 'mono' ? 'contrast(200%)' : 'none',
                        }}
                        className="text-stone-900 dark:text-white font-bold"
                      >
                        {currentGlyph.char}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-stone-400">
                    {selectedPpem}x{selectedPpem}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Controls Panel: Hinting Parameters & Configuration */}
          <div
            className={`w-full md:w-80 shrink-0 p-3 sm:p-4 pb-24 sm:pb-4 space-y-3 sm:space-y-4 overflow-y-auto ${
              activeTab !== 'settings' ? 'hidden sm:block' : ''
            }`}
          >
            <div className="flex items-center space-x-2 border-b pb-2 border-stone-200 dark:border-[#223326]">
              <Settings2 className="w-4 h-4 text-amber-500" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider">
                ヒンティング補正調整パラメータ
              </h3>
            </div>

            {/* Snap Strength Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>スナップ引き寄せ強度:</span>
                <span className="font-mono text-amber-600">
                  {Math.round(config.snapStrength * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.snapStrength}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, snapStrength: parseFloat(e.target.value) }))
                }
                className="w-full accent-amber-600 cursor-pointer"
              />
              <p className="text-[10px] text-stone-400">
                100%に近づくほど各ノードが格子境界へ吸着し、ボケを抑えます。
              </p>
            </div>

            {/* Minimum Stem Width Protection */}
            <div className="space-y-2">
              <label className="text-xs font-bold block">最小線幅（Stroke）の保護:</label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { value: 0, label: 'なし' },
                  { value: 1.0, label: '1px' },
                  { value: 1.5, label: '1.5px' },
                  { value: 2.0, label: '2px' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setConfig((prev) => ({ ...prev, minStemWidthPx: opt.value }))}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      config.minStemWidthPx === opt.value
                        ? 'bg-amber-600 text-white border-amber-600 '
                        : isLight
                        ? 'bg-white border-stone-200 hover:bg-stone-100 text-stone-800'
                        : 'bg-[#18261c] border-[#223628] hover:bg-[#1f3326] text-stone-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-400">
                漢字や複雑な文字で横線が消えないよう、最低線幅を補正保持します。
              </p>
            </div>

            {/* Toggles */}
            <div className="space-y-2.5 pt-2 border-t border-stone-200 dark:border-[#223326]">
              <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
                <span>垂直ステム (縦線) スナップ</span>
                <input
                  type="checkbox"
                  checked={config.snapVertical}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, snapVertical: e.target.checked }))
                  }
                  className="w-4 h-4 accent-amber-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
                <span>水平ステム (横線) スナップ</span>
                <input
                  type="checkbox"
                  checked={config.snapHorizontal}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, snapHorizontal: e.target.checked }))
                  }
                  className="w-4 h-4 accent-amber-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
                <span>ベースライン・CapHeight吸着</span>
                <input
                  type="checkbox"
                  checked={config.snapMetrics}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, snapMetrics: e.target.checked }))
                  }
                  className="w-4 h-4 accent-amber-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
                <span>ベジェハンドルの追従補正</span>
                <input
                  type="checkbox"
                  checked={config.adjustHandles}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, adjustHandles: e.target.checked }))
                  }
                  className="w-4 h-4 accent-amber-600 rounded"
                />
              </label>
            </div>

            {/* Revert / Apply Actions */}
            <div className="pt-4 space-y-2 border-t border-stone-200 dark:border-[#223326] hidden sm:block">
              <button
                onClick={handleApplyToCurrentGlyph}
 className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all flex items-center justify-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>「{currentGlyph.char}」に整列適用</span>
              </button>

              <button
                onClick={handleBatchApplyHinting}
 className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center justify-center space-x-2"
              >
                <Sparkles className="w-4 h-4 text-emerald-200" />
                <span>全文字一括ヒンティング適用</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Sticky Floating Action Bar */}
        <div className="flex sm:hidden items-center justify-between gap-2 px-3 py-2 border-t bg-stone-100/90 dark:bg-[#121c15] border-stone-200 dark:border-[#223326] shrink-0">
          <button
            onClick={handleApplyToCurrentGlyph}
 className="flex-1 py-2 rounded-xl bg-amber-600 active:bg-amber-700 text-white font-bold text-xs flex items-center justify-center space-x-1 "
          >
            <Check className="w-3.5 h-3.5" />
            <span>「{currentGlyph.char}」に適用</span>
          </button>
          <button
            onClick={handleBatchApplyHinting}
 className="flex-1 py-2 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-1 "
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
            <span>全文字一括適用</span>
          </button>
        </div>

        {/* Modal Footer (Desktop) */}
        <div
          className={`hidden sm:flex items-center justify-between px-4 sm:px-6 py-3 border-t shrink-0 text-xs ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#142018] border-[#223326]'
          }`}
        >
          <div className="flex items-center space-x-2 text-stone-500 dark:text-stone-400">
            <Info className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              ヒンティング処理を行うことで、Webブラウザ、ゲームUI、AviUtl、各種Wordで小サイズ表示時の文字掠れが劇的に改善します
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 font-bold text-xs transition-colors "
          >
            完了・閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
