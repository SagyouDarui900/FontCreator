import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
 X,
 Grid,
 Pencil,
 Eraser,
 PaintBucket,
 Slash,
 Square,
 Circle,
 Move,
 RotateCw,
 FlipHorizontal,
 FlipVertical,
 Undo2,
 Redo2,
 Trash2,
 Download,
 Sparkles,
 Layers,
 Check,
 Plus,
 Minus,
 RotateCcw,
 ChevronLeft,
 ChevronRight,
 ZoomIn,
 ZoomOut,
 Maximize2,
 Minimize2,
 Wand2,
 RefreshCw,
 Copy,
 Eye,
 EyeOff,
 Sliders,
 Type,
 FileCode,
 ArrowUp,
 ArrowDown,
 ArrowLeft,
 ArrowRight,
 Sun,
 Moon,
 Shield,
 HelpCircle,
 Image as ImageIcon,
 Upload,
 Search,
 BookOpen,
 Filter,
 CheckCircle2,
 SlidersHorizontal,
 FolderPlus,
 Save,
 FileDown,
 Cpu,
 Gamepad2,
 LayoutGrid,
} from 'lucide-react';
import { FontProject, GlyphData, PathContour, BezierNode, Point, PixelGlyphData, PixelDotShape } from '../types';
import { UNICODE_CATEGORIES, getCategoryCharList } from '../data/unicodeTables';
import { shareOrDownloadFont } from '../utils/fontCompiler';

export type PixelGridPreset = '4x4' | '5x7' | '8x8' | '12x12' | '16x16' | '24x24' | '32x32' | '64x64' | '128x128' | 'custom';
export type PixelDrawTool = 'pencil' | 'eraser' | 'bucket' | 'line' | 'rect' | 'rect_filled' | 'circle' | 'circle_filled';
export type { PixelDotShape };
export type BrushStampShape = 'square' | 'round';

interface PixelFontStudioModalProps {
 project: FontProject;
 setProject: React.Dispatch<React.SetStateAction<FontProject>>;
 isOpen: boolean;
 onClose: () => void;
 isLight: boolean;
 selectedUnicode: number;
 onSelectGlyph?: (unicode: number) => void;
 onShowToast: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const PRESET_SIZES: { id: PixelGridPreset; label: string; w: number; h: number; desc: string }[] = [
 { id: '8x8', label: '8×8', w: 8, h: 8, desc: '8-bit クラシック / レトロゲーム規格' },
 { id: '16x16', label: '16×16', w: 16, h: 16, desc: '16-bit / JIS漢字標準解像度' },
 { id: '12x12', label: '12×12', w: 12, h: 12, desc: '携帯機器 / 小型JIS規格' },
 { id: '24x24', label: '24×24', w: 24, h: 24, desc: '中解像度ビットマップ / アーケード' },
 { id: '32x32', label: '32×32', w: 32, h: 32, desc: '高密度ドット / 精密ビットマップ' },
 { id: '5x7', label: '5×7', w: 5, h: 7, desc: '英数マトリクス / 計器・LCD表示' },
 { id: '64x64', label: '64×64', w: 64, h: 64, desc: '高精細ピクセルアート' },
 { id: '128x128', label: '128×128', w: 128, h: 128, desc: '128×128 高解像度ピクセル' },
 { id: 'custom', label: 'カスタム', w: 10, h: 10, desc: '任意のグリッド寸法 (幅×高さ)' },
];

const PIXEL_STUDIO_CATEGORIES = [
 { id: 'all', label: '登録済' },
 { id: 'drawn', label: '作成済' },
 { id: 'hiragana', label: 'ひらがな' },
 { id: 'katakana', label: 'カタカナ' },
 { id: 'basic_latin_alnum', label: '半角英数' },
 { id: 'ascii_symbols', label: '記号' },
 { id: 'fullwidth_alnum', label: '全角英数' },
 { id: 'symbols', label: '和文約物' },
 { id: 'grade1', label: '小1漢字' },
 { id: 'grade2', label: '小2漢字' },
 { id: 'grade3', label: '小3漢字' },
 { id: 'jis_1', label: 'JIS第1' },
];

import {
  resamplePixelGrid,
  getBresenhamLine,
  getMidpointCircle,
  floodFill,
  pixelGridToContours,
  rasterizeGlyphToPixelGrid,
} from '../utils/pixelFontUtils';

export { pixelGridToContours, rasterizeGlyphToPixelGrid };

export const PixelFontStudioModal: React.FC<PixelFontStudioModalProps> = ({
 project,
 setProject,
 isOpen,
 onClose,
 isLight,
 selectedUnicode,
 onSelectGlyph,
 onShowToast,
}) => {
 // Global Project Pixel Grid Configuration
 const defaultW = project.pixelFontSettings?.defaultWidth || 16;
 const defaultH = project.pixelFontSettings?.defaultHeight || 16;

 const [preset, setPreset] = useState<PixelGridPreset>(() => {
 const found = PRESET_SIZES.find((p) => p.w === defaultW && p.h === defaultH);
 return found ? found.id : 'custom';
 });
 const [gridWidth, setGridWidth] = useState<number>(defaultW);
 const [gridHeight, setGridHeight] = useState<number>(defaultH);

 // Active glyph navigation & search
 const [currentUnicode, setCurrentUnicode] = useState<number>(selectedUnicode);
 const [glyphSearchQuery, setGlyphSearchQuery] = useState<string>('');
 const [activeCategory, setActiveCategory] = useState<string>('all');
 const [showGlyphDrawer, setShowGlyphDrawer] = useState<boolean>(false);
 const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

 // Pixel data grid buffer
 const [grid, setGrid] = useState<Uint8Array>(() => new Uint8Array(defaultW * defaultH));
	const currentGridRef = useRef<Uint8Array>(grid);
	useEffect(() => {
		currentGridRef.current = grid;
	}, [grid]);

 // History stack for Undo/Redo
 const [history, setHistory] = useState<Uint8Array[]>([]);
 const [historyIdx, setHistoryIdx] = useState<number>(-1);

 // Tools & modes
 const [tool, setTool] = useState<PixelDrawTool>('pencil');
 const [brushSize, setBrushSize] = useState<number>(1);
 const [brushStamp, setBrushStamp] = useState<BrushStampShape>('square');
 const [dotShape, setDotShape] = useState<PixelDotShape>(project.pixelFontSettings?.dotShape || 'square');
 const [mergeContours, setMergeContours] = useState<boolean>(project.pixelFontSettings?.mergeContours ?? true);
 const [showGridLines, setShowGridLines] = useState<boolean>(true);
 const [showSubdivisions, setShowSubdivisions] = useState<boolean>(true);
  const [showMetricsGuides, setShowMetricsGuides] = useState<boolean>(true);
  const projectRef = useRef(project);
  projectRef.current = project;
  const isErasingStrokeRef = useRef<boolean>(false);
 const [symmetryH, setSymmetryH] = useState<boolean>(false);
 const [symmetryV, setSymmetryV] = useState<boolean>(false);
 const [showOnionSkin, setShowOnionSkin] = useState<boolean>(false);

 // Trace / Underlay Sub-system
 const [showTrace, setShowTrace] = useState<boolean>(false);
 const [showTracePanel, setShowTracePanel] = useState<boolean>(false);
 const [traceSource, setTraceSource] = useState<'font' | 'image'>('font');
 const [traceChar, setTraceChar] = useState<string>('');
 const [traceFontFamily, setTraceFontFamily] = useState<string>('sans-serif');
 const [traceOpacity, setTraceOpacity] = useState<number>(35);
 const [traceScale, setTraceScale] = useState<number>(100);
 const [traceOffsetX, setTraceOffsetX] = useState<number>(0);
 const [traceOffsetY, setTraceOffsetY] = useState<number>(0);
 const [traceThreshold, setTraceThreshold] = useState<number>(128);
 const [traceImageSrc, setTraceImageSrc] = useState<string | null>(null);
 const traceImageRef = useRef<HTMLImageElement | null>(null);
 const fileInputRef = useRef<HTMLInputElement | null>(null);

 // Interactive drawing states
 const [isDrawing, setIsDrawing] = useState<boolean>(false);
 const [drawStartPos, setDrawStartPos] = useState<Point | null>(null);
 const lastDrawPosRef = useRef<Point | null>(null);
 const drawingStartGridRef = useRef<Uint8Array | null>(null);
 const [previewGrid, setPreviewGrid] = useState<Uint8Array | null>(null);
 const [hoverPos, setHoverPos] = useState<Point | null>(null);

 // Export & Game Engine Spritesheet panel
 const [showExportModal, setShowExportModal] = useState<boolean>(false);

 // Mobile navigation tab ('canvas' | 'glyphs' | 'presets' | 'export')
 const [mobileTab, setMobileTab] = useState<'canvas' | 'glyphs' | 'presets' | 'export'>('canvas');

 // Live Sample Text Test Preview
 const [previewText, setPreviewText] = useState<string>('あいうえお ABC 123');

 const canvasRef = useRef<HTMLCanvasElement | null>(null);
 const containerRef = useRef<HTMLDivElement | null>(null);

 // Current active glyph object
 const currentGlyph = useMemo(() => {
 return (
 project.glyphs[currentUnicode] || {
 unicode: currentUnicode,
 char: String.fromCodePoint(currentUnicode || 65),
 name: `uni${(currentUnicode || 65).toString(16).toUpperCase().padStart(4, '0')}`,
 advanceWidth: project.metadata.unitsPerEm || 1000,
 lsb: 50,
 contours: [],
 }
 );
 }, [project.glyphs, currentUnicode, project.metadata.unitsPerEm]);

 // Sync trace character to current glyph by default
 useEffect(() => {
 if (currentGlyph.char) {
 setTraceChar(currentGlyph.char);
 }
 }, [currentGlyph.char]);

 // Sync selectedUnicode prop when modal opens or prop changes
 useEffect(() => {
 if (selectedUnicode) {
 setCurrentUnicode(selectedUnicode);
 }
 }, [selectedUnicode]);

  // Auto-save native pixel data & vector contours back to project
  const autoSaveGlyph = useCallback(
    (targetGrid: Uint8Array, uCode: number = currentUnicode, customW?: number, customH?: number) => {
      const proj = projectRef.current;
      const w = customW ?? gridWidth;
      const h = customH ?? gridHeight;
      const g = proj.glyphs[uCode] || currentGlyph;
      const contours = pixelGridToContours(
        targetGrid,
        w,
        h,
        proj.metadata.unitsPerEm || 1000,
        proj.metadata.ascender || 800,
        proj.metadata.descender || -200,
        g.advanceWidth || 1000,
        dotShape,
        mergeContours
      );

      const vectorContoursBackup =
        g.vectorContoursBackup || (g.pixelData ? undefined : (g.contours && g.contours.length > 0 ? g.contours : undefined));

      const pixelData: PixelGlyphData = {
        width: w,
        height: h,
        data: Array.from(targetGrid),
        shape: dotShape,
      };

      setProject((prev) => ({
        ...prev,
        pixelFontSettings: {
          isPixelFontProject: true,
          defaultWidth: w,
          defaultHeight: h,
          dotShape,
          mergeContours,
        },
        glyphs: {
          ...prev.glyphs,
          [uCode]: {
            ...g,
            unicode: uCode,
            char: g.char || String.fromCodePoint(uCode),
            contours,
            vectorContoursBackup,
            pixelData,
            modified: true,
          },
        },
        updatedAt: Date.now(),
      }));
    },
    [currentUnicode, currentGlyph, gridWidth, gridHeight, dotShape, mergeContours, setProject]
  );

  // Load native pixel grid from glyph, resample existing pixel data, or rasterize vector fallback
  // Stable callback avoids resetting history / breaking undo on every stroke
  const loadGlyphPixelGrid = useCallback(
    (uCode: number, w: number, h: number) => {
      const proj = projectRef.current;
      const g = proj.glyphs[uCode];
      let loadedGrid = new Uint8Array(w * h);

      if (g && g.pixelData && g.pixelData.data && g.pixelData.data.length > 0) {
        if (g.pixelData.data.length === w * h) {
          // 1. Native Pixel Data is directly available at exact resolution!
          loadedGrid = new Uint8Array(g.pixelData.data);
        } else if (g.pixelData.width && g.pixelData.height && g.pixelData.data.length === g.pixelData.width * g.pixelData.height) {
          // 2. Pixel data exists at different resolution -> resample smoothly!
          loadedGrid = new Uint8Array(resamplePixelGrid(g.pixelData.data, g.pixelData.width, g.pixelData.height, w, h));
          autoSaveGlyph(loadedGrid, uCode, w, h);
        }
      } else if (g && g.contours && g.contours.length > 0) {
        // 3. Existing vector contours available -> rasterize to this resolution
        loadedGrid = new Uint8Array(
          rasterizeGlyphToPixelGrid(
            g,
            w,
            h,
            proj.metadata.unitsPerEm || 1000,
            proj.metadata.ascender || 800,
            proj.metadata.descender || -200
          )
        );
      }

      currentGridRef.current = loadedGrid;
      setGrid(loadedGrid);
      setHistory([new Uint8Array(loadedGrid)]);
      setHistoryIdx(0);
    },
    [autoSaveGlyph]
  );

  // When current unicode changes or resolution changes
  useEffect(() => {
    if (isOpen) {
      loadGlyphPixelGrid(currentUnicode, gridWidth, gridHeight);
    }
  }, [isOpen, currentUnicode, gridWidth, gridHeight, loadGlyphPixelGrid]);

 // Push history snapshot and trigger auto-save
 const pushHistory = useCallback(
 (nextGrid: Uint8Array) => {
 const newHistory: Uint8Array[] = history.slice(0, historyIdx + 1).map((h) => new Uint8Array(h));
 newHistory.push(new Uint8Array(nextGrid));
 if (newHistory.length > 40) newHistory.shift();
 setHistory(newHistory);
 setHistoryIdx(newHistory.length - 1);
 setGrid(nextGrid);
 autoSaveGlyph(nextGrid, currentUnicode);
 },
 [history, historyIdx, autoSaveGlyph, currentUnicode]
 );

 // Undo / Redo
 const handleUndo = useCallback(() => {
 if (historyIdx > 0) {
 const targetIdx = historyIdx - 1;
 const targetGrid = new Uint8Array(history[targetIdx]);
 setHistoryIdx(targetIdx);
 setGrid(targetGrid);
 autoSaveGlyph(targetGrid, currentUnicode);
 }
 }, [history, historyIdx, autoSaveGlyph, currentUnicode]);

 const handleRedo = useCallback(() => {
 if (historyIdx < history.length - 1) {
 const targetIdx = historyIdx + 1;
 const targetGrid = new Uint8Array(history[targetIdx]);
 setHistoryIdx(targetIdx);
 setGrid(targetGrid);
 autoSaveGlyph(targetGrid, currentUnicode);
 }
 }, [history, historyIdx, autoSaveGlyph, currentUnicode]);

 const handleShift = useCallback(
 (dx: number, dy: number) => {
 const next = new Uint8Array(gridWidth * gridHeight);
 for (let y = 0; y < gridHeight; y++) {
 for (let x = 0; x < gridWidth; x++) {
 const nx = x + dx;
 const ny = y + dy;
 if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
 next[ny * gridWidth + nx] = grid[y * gridWidth + x];
 }
 }
 }
 pushHistory(next);
 },
 [gridWidth, gridHeight, grid, pushHistory]
 );

 // Dedicated Keyboard Shortcuts for Pixel Font Studio (Isolated from main canvas)
 useEffect(() => {
 if (!isOpen) return;

 const handleStudioKeyDown = (e: KeyboardEvent) => {
 const activeEl = document.activeElement;
 const isInputActive =
 activeEl &&
 (activeEl.tagName === 'INPUT' ||
 activeEl.tagName === 'TEXTAREA' ||
 activeEl.tagName === 'SELECT' ||
 (activeEl as HTMLElement).isContentEditable);

 if (isInputActive) return;

 if (e.key === 'Escape') {
 e.preventDefault();
 e.stopPropagation();
 onClose();
 return;
 }

 // Undo / Redo
 if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
 e.preventDefault();
 e.stopPropagation();
 if (e.shiftKey) {
 handleRedo();
 } else {
 handleUndo();
 }
 return;
 }

 if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
 e.preventDefault();
 e.stopPropagation();
 handleRedo();
 return;
 }

 // Tool selection shortcuts
 if (!e.ctrlKey && !e.metaKey && !e.altKey) {
 const key = e.key.toLowerCase();
 if (key === 'b' || key === 'p') {
 e.preventDefault();
 e.stopPropagation();
 setTool('pencil');
 } else if (key === 'e') {
 e.preventDefault();
 e.stopPropagation();
 setTool('eraser');
 } else if (key === 'g' || key === 'f') {
 e.preventDefault();
 e.stopPropagation();
 setTool('bucket');
 } else if (key === 'l') {
 e.preventDefault();
 e.stopPropagation();
 setTool('line');
 } else if (key === 'r') {
 e.preventDefault();
 e.stopPropagation();
 setTool('rect');
 } else if (key === 'c') {
 e.preventDefault();
 e.stopPropagation();
 setTool('circle');
 }
 }

 // Arrow keys shift (1px move)
 if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
 e.preventDefault();
 e.stopPropagation();
 if (e.key === 'ArrowUp') handleShift(0, -1);
 else if (e.key === 'ArrowDown') handleShift(0, 1);
 else if (e.key === 'ArrowLeft') handleShift(-1, 0);
 else if (e.key === 'ArrowRight') handleShift(1, 0);
 return;
 }

 // Stop Space, Delete, Backspace, Ctrl+A/C/V from reaching background canvas
 if (
 e.code === 'Space' ||
 e.key === ' ' ||
 e.key === 'Delete' ||
 e.key === 'Backspace' ||
 ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'd'].includes(e.key.toLowerCase())) ||
 (!e.ctrlKey && !e.metaKey && !e.altKey && ['g', 's', 'f', 'z', 't', 'q'].includes(e.key.toLowerCase()))
 ) {
 e.stopPropagation();
 }
 };

 window.addEventListener('keydown', handleStudioKeyDown, true);
 return () => {
 window.removeEventListener('keydown', handleStudioKeyDown, true);
 };
 }, [isOpen, handleUndo, handleRedo, onClose, handleShift]);

 // Handle Preset Resolution Changes
 const handlePresetSelect = (p: PixelGridPreset) => {
 setPreset(p);
 const found = PRESET_SIZES.find((item) => item.id === p);
 if (found && p !== 'custom') {
 setGridWidth(found.w);
 setGridHeight(found.h);
 loadGlyphPixelGrid(currentUnicode, found.w, found.h);
 }
 };

 // Active Pixel Count
 const activePixelCount = useMemo(() => {
 let count = 0;
 for (let i = 0; i < grid.length; i++) {
 if (grid[i] === 1) count++;
 }
 return count;
 }, [grid]);

 // Count drawn pixel glyphs in project
 const totalDrawnPixelGlyphs = useMemo(() => {
 return (Object.values(project.glyphs) as GlyphData[]).filter(
 (g) => (g.pixelData && g.pixelData.data.some((d) => d === 1)) || (g.contours && g.contours.length > 0)
 ).length;
 }, [project.glyphs]);

 // Pixel Grid Operations (Transform, Invert, Shift, Outline, Shadow, Clear)
 const handleClear = () => {
 const empty = new Uint8Array(gridWidth * gridHeight);
 pushHistory(empty);
 };

 const handleInvert = () => {
 const next = new Uint8Array(gridWidth * gridHeight);
 for (let i = 0; i < grid.length; i++) {
 next[i] = grid[i] === 1 ? 0 : 1;
 }
 pushHistory(next);
 };

 const handleFlipH = () => {
 const next = new Uint8Array(gridWidth * gridHeight);
 for (let y = 0; y < gridHeight; y++) {
 for (let x = 0; x < gridWidth; x++) {
 next[y * gridWidth + (gridWidth - 1 - x)] = grid[y * gridWidth + x];
 }
 }
 pushHistory(next);
 };

 const handleFlipV = () => {
 const next = new Uint8Array(gridWidth * gridHeight);
 for (let y = 0; y < gridHeight; y++) {
 for (let x = 0; x < gridWidth; x++) {
 next[(gridHeight - 1 - y) * gridWidth + x] = grid[y * gridWidth + x];
 }
 }
 pushHistory(next);
 };

 const handleRotate90 = () => {
 if (gridWidth !== gridHeight) {
 onShowToast('回転は正方形グリッドのみ対応しています', 'info');
 return;
 }
 const next = new Uint8Array(gridWidth * gridHeight);
 for (let y = 0; y < gridHeight; y++) {
 for (let x = 0; x < gridWidth; x++) {
 next[x * gridWidth + (gridHeight - 1 - y)] = grid[y * gridWidth + x];
 }
 }
 pushHistory(next);
 };

 const handleAddOutline = () => {
 const next = new Uint8Array(grid);
 for (let y = 0; y < gridHeight; y++) {
 for (let x = 0; x < gridWidth; x++) {
 if (grid[y * gridWidth + x] === 1) {
 const neighbors = [
 [x + 1, y],
 [x - 1, y],
 [x, y + 1],
 [x, y - 1],
 [x + 1, y + 1],
 [x - 1, y + 1],
 [x + 1, y - 1],
 [x - 1, y - 1],
 ];
 for (const [nx, ny] of neighbors) {
 if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
 next[ny * gridWidth + nx] = 1;
 }
 }
 }
 }
 }
 pushHistory(next);
 };

 const handleAddShadow = () => {
 const next = new Uint8Array(grid);
 for (let y = 0; y < gridHeight; y++) {
 for (let x = 0; x < gridWidth; x++) {
 if (grid[y * gridWidth + x] === 1) {
 const nx = x + 1;
 const ny = y + 1;
 if (nx < gridWidth && ny < gridHeight) {
 next[ny * gridWidth + nx] = 1;
 }
 }
 }
 }
 pushHistory(next);
 };

 // Image Upload handler for Trace
 const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 const reader = new FileReader();
 reader.onload = (event) => {
 const src = event.target?.result as string;
 setTraceImageSrc(src);
 setTraceSource('image');
 setShowTrace(true);

 const img = new Image();
 img.onload = () => {
 traceImageRef.current = img;
 };
 img.src = src;

 onShowToast('下絵画像を読み込みました', 'success');
 };
 reader.readAsDataURL(file);
 };

 // Auto-Binarize / Convert Trace to Pixel Grid
 const handleAutoBinarizeTrace = useCallback(() => {
 const offCanvas = document.createElement('canvas');
 offCanvas.width = gridWidth;
 offCanvas.height = gridHeight;
 const offCtx = offCanvas.getContext('2d');
 if (!offCtx) return;

 offCtx.clearRect(0, 0, gridWidth, gridHeight);
 offCtx.fillStyle = '#ffffff';
 offCtx.fillRect(0, 0, gridWidth, gridHeight);

 if (traceSource === 'image' && traceImageRef.current) {
 const img = traceImageRef.current;
 const scale = traceScale / 100;
 const drawW = gridWidth * scale;
 const drawH = gridHeight * scale;
 const dx = (gridWidth - drawW) / 2 + traceOffsetX;
 const dy = (gridHeight - drawH) / 2 + traceOffsetY;
 offCtx.drawImage(img, dx, dy, drawW, drawH);
 } else {
 const charToDraw = traceChar || currentGlyph.char || 'A';
 const scale = traceScale / 100;
 const fontSize = Math.round(gridHeight * 0.85 * scale);
 offCtx.font = `bold ${fontSize}px ${traceFontFamily}`;
 offCtx.textAlign = 'center';
 offCtx.textBaseline = 'middle';
 offCtx.fillStyle = '#000000';
 offCtx.fillText(charToDraw, gridWidth / 2 + traceOffsetX, gridHeight / 2 + traceOffsetY);
 }

 const imgData = offCtx.getImageData(0, 0, gridWidth, gridHeight);
 const next = new Uint8Array(gridWidth * gridHeight);

 for (let i = 0; i < gridWidth * gridHeight; i++) {
 const r = imgData.data[i * 4];
 const g = imgData.data[i * 4 + 1];
 const b = imgData.data[i * 4 + 2];
 const a = imgData.data[i * 4 + 3];

 const luminance = (0.299 * r + 0.587 * g + 0.114 * b) * (a / 255);
 next[i] = luminance <= traceThreshold ? 1 : 0;
 }

 pushHistory(next);
 onShowToast('下絵からドット絵を自動抽出しました', 'success');
 }, [
 gridWidth,
 gridHeight,
 traceSource,
 traceScale,
 traceOffsetX,
 traceOffsetY,
 traceChar,
 currentGlyph.char,
 traceFontFamily,
 traceThreshold,
 pushHistory,
 onShowToast,
 ]);

 // Pointer & Touch drawing on Canvas
 const getGridCoordFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): Point | null => {
 const canvas = canvasRef.current;
 if (!canvas) return null;
 const rect = canvas.getBoundingClientRect();
 const scaleX = canvas.width / rect.width;
 const scaleY = canvas.height / rect.height;

 const rawX = (e.clientX - rect.left) * scaleX;
 const rawY = (e.clientY - rect.top) * scaleY;

 const cellW = canvas.width / gridWidth;
 const cellH = canvas.height / gridHeight;

 const gx = Math.floor(rawX / cellW);
 const gy = Math.floor(rawY / cellH);

 if (gx < 0 || gx >= gridWidth || gy < 0 || gy >= gridHeight) return null;
 return { x: gx, y: gy };
 };

 const applyBrushAt = (targetGrid: Uint8Array, gx: number, gy: number, val: number) => {
 const radius = Math.floor(brushSize / 2);
 const applySingle = (x: number, y: number) => {
 if (brushSize === 1) {
 if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
 targetGrid[y * gridWidth + x] = val;
 }
 } else {
 for (let dy = -radius; dy <= (brushSize % 2 === 0 ? radius - 1 : radius); dy++) {
 for (let dx = -radius; dx <= (brushSize % 2 === 0 ? radius - 1 : radius); dx++) {
 if (brushStamp === 'round' && brushSize > 2) {
 if (dx * dx + dy * dy > (radius + 0.2) * (radius + 0.2)) continue;
 }
 const nx = x + dx;
 const ny = y + dy;
 if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
 targetGrid[ny * gridWidth + nx] = val;
 }
 }
 }
 }
 };

 applySingle(gx, gy);

 // Apply Symmetry
 if (symmetryH) {
 applySingle(gridWidth - 1 - gx, gy);
 }
 if (symmetryV) {
 applySingle(gx, gridHeight - 1 - gy);
 }
 if (symmetryH && symmetryV) {
 applySingle(gridWidth - 1 - gx, gridHeight - 1 - gy);
 }
 };

 const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
 e.preventDefault();
 e.stopPropagation();
 (e.target as HTMLElement).setPointerCapture(e.pointerId);

 const pt = getGridCoordFromEvent(e);
 if (!pt) return;

 // Drawing stroke started

 setIsDrawing(true);
 setDrawStartPos(pt);
 lastDrawPosRef.current = pt;
 drawingStartGridRef.current = new Uint8Array(currentGridRef.current);

    const isRightClick = e.button === 2;
    const currentVal = (tool === 'eraser' || isRightClick) ? 0 : 1;
    isErasingStrokeRef.current = (tool === 'eraser' || isRightClick);

 if (tool === 'pencil' || tool === 'eraser') {
			const next = new Uint8Array(currentGridRef.current);
			applyBrushAt(next, pt.x, pt.y, currentVal);
			currentGridRef.current = next;
			setGrid(next);
 } else if (tool === 'bucket') {
			const next = new Uint8Array(currentGridRef.current);
			const targetVal = next[pt.y * gridWidth + pt.x];
			floodFill(next, gridWidth, gridHeight, pt.x, pt.y, targetVal, currentVal);
			currentGridRef.current = next;
			pushHistory(next);
			setIsDrawing(false);
		} else if (tool === 'line' || tool === 'rect' || tool === 'rect_filled' || tool === 'circle' || tool === 'circle_filled') {
      const pGrid = new Uint8Array(currentGridRef.current);
      applyBrushAt(pGrid, pt.x, pt.y, currentVal);
      setPreviewGrid(pGrid);
    }
	};

 const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
 e.stopPropagation();
 const pt = getGridCoordFromEvent(e);
 setHoverPos(pt);

 if (!isDrawing || !pt) return;

    const currentVal = isErasingStrokeRef.current ? 0 : 1;

 if (tool === 'pencil' || tool === 'eraser') {
 const lastPt = lastDrawPosRef.current || pt;
 lastDrawPosRef.current = pt;
 const linePts = getBresenhamLine(lastPt.x, lastPt.y, pt.x, pt.y);
			const next = new Uint8Array(currentGridRef.current);
			for (const p of linePts) {
				applyBrushAt(next, p.x, p.y, currentVal);
			}
			currentGridRef.current = next;
			setGrid(next);
 } else if (drawStartPos && (tool === 'line' || tool === 'rect' || tool === 'rect_filled' || tool === 'circle' || tool === 'circle_filled')) {
 const baseGrid = drawingStartGridRef.current || currentGridRef.current;
      const pGrid = new Uint8Array(baseGrid);

 if (tool === 'line') {
 const linePts = getBresenhamLine(drawStartPos.x, drawStartPos.y, pt.x, pt.y);
 for (const p of linePts) {
 applyBrushAt(pGrid, p.x, p.y, currentVal);
 }
 } else if (tool === 'rect' || tool === 'rect_filled') {
 const minX = Math.min(drawStartPos.x, pt.x);
 const maxX = Math.max(drawStartPos.x, pt.x);
 const minY = Math.min(drawStartPos.y, pt.y);
 const maxY = Math.max(drawStartPos.y, pt.y);

 for (let y = minY; y <= maxY; y++) {
 for (let x = minX; x <= maxX; x++) {
 if (tool === 'rect_filled' || x === minX || x === maxX || y === minY || y === maxY) {
 applyBrushAt(pGrid, x, y, currentVal);
 }
 }
 }
 } else if (tool === 'circle' || tool === 'circle_filled') {
 const dx = pt.x - drawStartPos.x;
 const dy = pt.y - drawStartPos.y;
 const radius = Math.round(Math.hypot(dx, dy));
 const circlePts = getMidpointCircle(drawStartPos.x, drawStartPos.y, radius, tool === 'circle_filled');
 for (const p of circlePts) {
 applyBrushAt(pGrid, p.x, p.y, currentVal);
 }
 }

 setPreviewGrid(pGrid);
 }
 };

 const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
 e.stopPropagation();
 try {
 if ((e.target as HTMLElement)?.hasPointerCapture?.(e.pointerId)) {
 (e.target as HTMLElement).releasePointerCapture(e.pointerId);
 }
 } catch {
 // safe fallback
 }
 if (!isDrawing) return;
 setIsDrawing(false);
    isErasingStrokeRef.current = false;
 lastDrawPosRef.current = null;

 if (previewGrid) {
			currentGridRef.current = previewGrid;
			setGrid(previewGrid);
			pushHistory(previewGrid);
			setPreviewGrid(null);
		} else {
			pushHistory(currentGridRef.current);
		}
 setDrawStartPos(null);
 drawingStartGridRef.current = null;
 };

 const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
   e.stopPropagation();
   try {
     if ((e.currentTarget as HTMLCanvasElement).hasPointerCapture(e.pointerId)) {
       (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
     }
   } catch {
     // The pointer may already have been released by the browser.
   }
   if (!isDrawing) return;

   const initialGrid = drawingStartGridRef.current;
   if (initialGrid) {
     const restored = new Uint8Array(initialGrid);
     currentGridRef.current = restored;
     setGrid(restored);
   }
   setIsDrawing(false);
   setDrawStartPos(null);
   setPreviewGrid(null);
   lastDrawPosRef.current = null;
   drawingStartGridRef.current = null;
 };

 // Render Pixel Canvas to HTML5 2D Context
 useEffect(() => {
 const canvas = canvasRef.current;
 if (!canvas) return;
 const ctx = canvas.getContext('2d');
 if (!ctx) return;

 const renderGrid = previewGrid || grid;
 const width = canvas.width;
 const height = canvas.height;

 const cellW = width / gridWidth;
 const cellH = height / gridHeight;

 ctx.clearRect(0, 0, width, height);

 // 1. Background Fill (Crisp solid color)
 ctx.fillStyle = isLight ? '#f9f9f8' : '#080d0a';
 ctx.fillRect(0, 0, width, height);

 // 2. Trace / Underlay Layer
 if (showTrace) {
 ctx.save();
 ctx.globalAlpha = traceOpacity / 100;

 if (traceSource === 'image' && traceImageRef.current) {
 const img = traceImageRef.current;
 const scale = traceScale / 100;
 const drawW = width * scale;
 const drawH = height * scale;
 const dx = (width - drawW) / 2 + traceOffsetX * cellW;
 const dy = (height - drawH) / 2 + traceOffsetY * cellH;
 ctx.drawImage(img, dx, dy, drawW, drawH);
 } else {
 const charToDraw = traceChar || currentGlyph.char || 'A';
 const scale = traceScale / 100;
 const fontSize = Math.round(height * 0.82 * scale);
 ctx.font = `bold ${fontSize}px ${traceFontFamily}`;
 ctx.textAlign = 'center';
 ctx.textBaseline = 'middle';
 ctx.fillStyle = isLight ? '#065f46' : '#6ee7b7';
 ctx.fillText(charToDraw, width / 2 + traceOffsetX * cellW, height / 2 + traceOffsetY * cellH);
 }
 ctx.restore();
 }

 // 3. Active Pixels
 for (let gy = 0; gy < gridHeight; gy++) {
 for (let gx = 0; gx < gridWidth; gx++) {
 const isFilled = renderGrid[gy * gridWidth + gx] === 1;

 if (isFilled) {
 const px = gx * cellW;
 const py = gy * cellH;

 ctx.fillStyle = isLight ? '#064e3b' : '#34d399'; // Emerald 900 / 400

 if (dotShape === 'square') {
 ctx.fillRect(px, py, cellW, cellH);
 } else if (dotShape === 'round') {
 ctx.beginPath();
 ctx.arc(px + cellW / 2, py + cellH / 2, Math.min(cellW, cellH) * 0.46, 0, Math.PI * 2);
 ctx.fill();
 } else if (dotShape === 'squircle') {
 const cr = Math.min(cellW, cellH) * 0.25;
 ctx.beginPath();
 ctx.roundRect(px + 1, py + 1, cellW - 2, cellH - 2, cr);
 ctx.fill();
 } else if (dotShape === 'diamond') {
 ctx.beginPath();
 ctx.moveTo(px + cellW / 2, py);
 ctx.lineTo(px + cellW, py + cellH / 2);
 ctx.lineTo(px + cellW / 2, py + cellH);
 ctx.lineTo(px, py + cellH / 2);
 ctx.closePath();
 ctx.fill();
 }
 }
 }
 }

 // 4. Grid Lines (Sharp 1px grid without fuzziness)
 if (showGridLines) {
 ctx.lineWidth = 1;
 ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)';
 ctx.beginPath();

 for (let x = 0; x <= gridWidth; x++) {
 const gx = Math.round(x * cellW);
 ctx.moveTo(gx + 0.5, 0);
 ctx.lineTo(gx + 0.5, height);
 }
 for (let y = 0; y <= gridHeight; y++) {
 const gy = Math.round(y * cellH);
 ctx.moveTo(0, gy + 0.5);
 ctx.lineTo(width, gy + 0.5);
 }
 ctx.stroke();
 }

 // 5. Subdivisions & Center Axis Lines
 if (showSubdivisions) {
 ctx.lineWidth = 1.5;
 ctx.strokeStyle = isLight ? 'rgba(5, 150, 105, 0.35)' : 'rgba(52, 211, 153, 0.35)';
 ctx.beginPath();

 if (gridWidth % 2 === 0) {
 const midX = Math.round((gridWidth / 2) * cellW);
 ctx.moveTo(midX + 0.5, 0);
 ctx.lineTo(midX + 0.5, height);
 }
 if (gridHeight % 2 === 0) {
 const midY = Math.round((gridHeight / 2) * cellH);
 ctx.moveTo(0, midY + 0.5);
 ctx.lineTo(width, midY + 0.5);
 }

 if (gridWidth >= 16) {
 const step = gridWidth >= 64 ? 16 : 8;
 for (let x = step; x < gridWidth; x += step) {
 const gx = Math.round(x * cellW);
 ctx.moveTo(gx + 0.5, 0);
 ctx.lineTo(gx + 0.5, height);
 }
 for (let y = step; y < gridHeight; y += step) {
 const gy = Math.round(y * cellH);
 ctx.moveTo(0, gy + 0.5);
 ctx.lineTo(width, gy + 0.5);
 }
 }

 ctx.stroke();
 }

    // 5.1 Baseline & Typography Metrics Guidelines
    if (showMetricsGuides) {
      const asc = project.metadata.ascender || 800;
      const desc = project.metadata.descender || -200;
      const totalH = asc - desc;
      const marginY = totalH * 0.08;
      const usableHeight = totalH - 2 * marginY;
      const cellHMath = usableHeight / gridHeight;
      const topY = asc - marginY;
      const baselineGy = Math.round(topY / cellHMath);
      const baselineY = Math.min(height - 1, Math.max(0, baselineGy * cellH));

      // Draw Baseline
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isLight ? 'rgba(37, 99, 235, 0.75)' : 'rgba(96, 165, 250, 0.75)';
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(0, baselineY + 0.5);
      ctx.lineTo(width, baselineY + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Baseline Label Badge
      ctx.fillStyle = isLight ? 'rgba(37, 99, 235, 0.85)' : 'rgba(96, 165, 250, 0.85)';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('Baseline (基準線)', 4, Math.max(10, baselineY - 3));
    }

 // 6. Hover Brush Cursor Footprint
 if (hoverPos && !isDrawing) {
 ctx.strokeStyle = isLight ? '#059669' : '#10b981';
 ctx.lineWidth = 2;
 const radius = Math.floor(brushSize / 2);

 for (let dy = -radius; dy <= (brushSize % 2 === 0 ? radius - 1 : radius); dy++) {
 for (let dx = -radius; dx <= (brushSize % 2 === 0 ? radius - 1 : radius); dx++) {
 if (brushStamp === 'round' && brushSize > 2) {
 if (dx * dx + dy * dy > (radius + 0.2) * (radius + 0.2)) continue;
 }
 const cx = hoverPos.x + dx;
 const cy = hoverPos.y + dy;
 if (cx >= 0 && cx < gridWidth && cy >= 0 && cy < gridHeight) {
 ctx.strokeRect(cx * cellW + 0.5, cy * cellH + 0.5, cellW - 1, cellH - 1);
 }
 }
 }
 }
 }, [
 grid,
 previewGrid,
 gridWidth,
 gridHeight,
 isLight,
 dotShape,
 showGridLines,
 showSubdivisions,
 showTrace,
 traceSource,
 traceChar,
 traceFontFamily,
 traceOpacity,
 traceScale,
 traceOffsetX,
 traceOffsetY,
 hoverPos,
 isDrawing,
 brushSize,
 brushStamp,
 mobileTab,
 ]);

 // Export directly as OpenType Font (.otf) or TrueType Font (.ttf)
 const handleExportFontFile = async (format: 'otf' | 'ttf' = 'otf') => {
 // 1. Ensure current glyph is flushed into project state
 autoSaveGlyph(grid, currentUnicode);

 // 2. Build complete project glyph map ensuring valid contours for all pixel glyphs
 const updatedGlyphs: Record<number, GlyphData> = { ...project.glyphs };

 const isCurrentActive = grid.some((p) => p === 1);
 if (isCurrentActive) {
 const currentContours = pixelGridToContours(
 grid,
 gridWidth,
 gridHeight,
 project.metadata.unitsPerEm || 1000,
 project.metadata.ascender || 800,
 project.metadata.descender || -200,
 currentGlyph.advanceWidth || 1000,
 dotShape,
 mergeContours
 );
 updatedGlyphs[currentUnicode] = {
 ...currentGlyph,
 unicode: currentUnicode,
 char: currentGlyph.char || (currentUnicode ? String.fromCodePoint(currentUnicode) : ''),
 contours: currentContours,
 pixelData: {
 width: gridWidth,
 height: gridHeight,
 data: Array.from(grid),
 shape: dotShape,
 },
 modified: true,
 };
 }

 const hasAnyGlyphs = Object.values(updatedGlyphs).some(
 (g) => (g.pixelData && g.pixelData.data && g.pixelData.data.some((d) => d === 1)) || (g.contours && g.contours.length > 0)
 );

 if (!hasAnyGlyphs) {
 onShowToast('作成済みのドット文字がありません。先に文字を描画してください。', 'warning');
 return;
 }

 // Ensure all glyphs with pixelData have vector contours for compilation
 for (const [uStr, g] of Object.entries(updatedGlyphs)) {
 const u = parseInt(uStr, 10);
 if (g.pixelData && g.pixelData.data && (!g.contours || g.contours.length === 0)) {
 const gGrid = new Uint8Array(g.pixelData.data);
 if (gGrid.some((d) => d === 1)) {
 const c = pixelGridToContours(
 gGrid,
 g.pixelData.width || gridWidth,
 g.pixelData.height || gridHeight,
 project.metadata.unitsPerEm || 1000,
 project.metadata.ascender || 800,
 project.metadata.descender || -200,
 g.advanceWidth || 1000,
 g.pixelData.shape || dotShape,
 mergeContours
 );
 updatedGlyphs[u] = { ...g, contours: c };
 }
 }
 }

 const projectToExport: FontProject = {
 ...project,
 glyphs: updatedGlyphs,
 pixelFontSettings: {
 isPixelFontProject: true,
 defaultWidth: gridWidth,
 defaultHeight: gridHeight,
 dotShape,
 mergeContours,
 },
 updatedAt: Date.now(),
 };

 try {
 const result = await shareOrDownloadFont(projectToExport, format, {
 scaleFactor: 1.0,
 balanceSideBearings: false,
 mergeOverlaps: false,
 normalizeWinding: true,
 });

 const formatUpper = format.toUpperCase();
 const msg =
 result.method === 'share'
 ? `「${project.metadata.familyName || 'PixelFont'}」の ${formatUpper} 共有シートを開きました`
 : `「${project.metadata.familyName || 'PixelFont'}」を ${formatUpper} 形式 (.${format}) で出力しました`;
 onShowToast(msg, 'success');
 } catch (err: any) {
 console.error('Failed to export OTF/TTF font:', err);
 onShowToast(`フォントの書き出しに失敗しました: ${err?.message || '不明なエラー'}`, 'error');
 }
 };

 // Export Single PNG
 const handleExportSinglePng = () => {
 const canvas = canvasRef.current;
 if (!canvas) return;
 const url = canvas.toDataURL('image/png');
 const a = document.createElement('a');
 a.href = url;
 a.download = `pixel_${currentGlyph.char}_${gridWidth}x${gridHeight}.png`;
 a.click();
 onShowToast(`「${currentGlyph.char}」のPNG画像をダウンロードしました`, 'success');
 };

 // Export Game Spritesheet (Atlas PNG + JSON Metadata)
	const handleExportSpritesheet = () => {
		autoSaveGlyph(grid, currentUnicode);
 const entries = (Object.entries(project.glyphs) as [string, GlyphData][]).filter(
 ([_, g]) => (g.pixelData && g.pixelData.data.some((d) => d === 1)) || (g.contours && g.contours.length > 0)
 );

 if (entries.length === 0) {
 onShowToast('作成済みのドット文字がありません', 'warning');
 return;
 }

 const cols = Math.ceil(Math.sqrt(entries.length));
 const rows = Math.ceil(entries.length / cols);
 const sheetCanvas = document.createElement('canvas');
 sheetCanvas.width = cols * gridWidth;
 sheetCanvas.height = rows * gridHeight;
 const sCtx = sheetCanvas.getContext('2d');
 if (!sCtx) return;

 sCtx.clearRect(0, 0, sheetCanvas.width, sheetCanvas.height);

 const atlasJson: Record<string, { char: string; unicode: number; x: number; y: number; w: number; h: number }> = {};

 entries.forEach(([uStr, g], idx) => {
 const u = parseInt(uStr, 10);
 const col = idx % cols;
 const row = Math.floor(idx / cols);
 const startX = col * gridWidth;
 const startY = row * gridHeight;

 const gGrid =
 g.pixelData && g.pixelData.data
 ? new Uint8Array(g.pixelData.data)
 : rasterizeGlyphToPixelGrid(g, gridWidth, gridHeight);

 sCtx.fillStyle = '#ffffff';
 for (let gy = 0; gy < gridHeight; gy++) {
 for (let gx = 0; gx < gridWidth; gx++) {
 if (gGrid[gy * gridWidth + gx] === 1) {
 sCtx.fillRect(startX + gx, startY + gy, 1, 1);
 }
 }
 }

 atlasJson[g.char || String.fromCodePoint(u)] = {
 char: g.char || String.fromCodePoint(u),
 unicode: u,
 x: startX,
 y: startY,
 w: gridWidth,
 h: gridHeight,
 };
 });

 // Download PNG
 const pngUrl = sheetCanvas.toDataURL('image/png');
 const aPng = document.createElement('a');
 aPng.href = pngUrl;
 aPng.download = `${project.name || 'pixel_font'}_spritesheet_${gridWidth}x${gridHeight}.png`;
 aPng.click();

 // Download JSON
 const jsonBlob = new Blob([JSON.stringify({ fontName: project.name, gridWidth, gridHeight, glyphs: atlasJson }, null, 2)], {
 type: 'application/json',
 });
 const aJson = document.createElement('a');
 aJson.href = URL.createObjectURL(jsonBlob);
 aJson.download = `${project.name || 'pixel_font'}_atlas.json`;
 aJson.click();

 onShowToast(`全 ${entries.length} 文字のスプライトシート (PNG + JSON) を出力しました`, 'success');
 };

 // Export C / C++ Bitmap Header (for Arduino / Microcontrollers / Game Boy)
	const handleExportCHeader = () => {
		autoSaveGlyph(grid, currentUnicode);
 const entries = (Object.entries(project.glyphs) as [string, GlyphData][]).filter(
 ([_, g]) => (g.pixelData && g.pixelData.data.some((d) => d === 1)) || (g.contours && g.contours.length > 0)
 );

 if (entries.length === 0) {
 onShowToast('作成済みのドット文字がありません', 'warning');
 return;
 }

 let code = `// Pixel Font: ${project.name || 'PixelFont'}\n`;
 code += `// Resolution: ${gridWidth}x${gridHeight}\n`;
 code += `// Total Glyphs: ${entries.length}\n\n`;
 code += `#ifndef PIXEL_FONT_${(project.name || 'FONT').toUpperCase()}_H\n`;
 code += `#define PIXEL_FONT_${(project.name || 'FONT').toUpperCase()}_H\n\n`;
 code += `#include <stdint.h>\n\n`;
 code += `const uint8_t FONT_WIDTH = ${gridWidth};\n`;
 code += `const uint8_t FONT_HEIGHT = ${gridHeight};\n\n`;

 entries.forEach(([uStr, g]) => {
 const u = parseInt(uStr, 10);
 const gGrid =
 g.pixelData && g.pixelData.data
 ? new Uint8Array(g.pixelData.data)
 : rasterizeGlyphToPixelGrid(g, gridWidth, gridHeight);

 code += `// Character: '${g.char}' (U+${u.toString(16).toUpperCase()})\n`;
 code += `const uint8_t glyph_0x${u.toString(16).toUpperCase()}[] = {\n`;

 const bytesPerRow = Math.ceil(gridWidth / 8);
 for (let y = 0; y < gridHeight; y++) {
 code += ' ';
 for (let b = 0; b < bytesPerRow; b++) {
 let byteVal = 0;
 for (let bit = 0; bit < 8; bit++) {
 const gx = b * 8 + bit;
 if (gx < gridWidth && gGrid[y * gridWidth + gx] === 1) {
 byteVal |= 1 << (7 - bit);
 }
 }
 code += `0x${byteVal.toString(16).padStart(2, '0')}, `;
 }
 code += `// Row ${y}\n`;
 }
 code += `};\n\n`;
 });

 code += `#endif // PIXEL_FONT_${(project.name || 'FONT').toUpperCase()}_H\n`;

 const blob = new Blob([code], { type: 'text/x-c' });
 const a = document.createElement('a');
 a.href = URL.createObjectURL(blob);
 a.download = `${project.name || 'pixel_font'}_${gridWidth}x${gridHeight}.h`;
 a.click();
 onShowToast('C言語ヘッダー形式ビットマップ配列を出力しました', 'success');
 };

 // Glyph List & Categories Filtering
 const projectGlyphUnicodes = useMemo(() => {
 return Object.keys(project.glyphs)
 .map((k) => parseInt(k, 10))
 .sort((a, b) => a - b);
 }, [project.glyphs]);

 // Glyph items for the sidebar drawer and mobile full-screen list
 const displayedGlyphList = useMemo(() => {
 let pool: { unicode: number; char: string; hasData: boolean }[] = [];

 if (activeCategory === 'all') {
 pool = projectGlyphUnicodes.map((u) => {
 const g = project.glyphs[u];
 const hasData = Boolean(
 (g?.pixelData && g.pixelData.data.some((d) => d === 1)) || (g?.contours && g.contours.length > 0)
 );
 return {
 unicode: u,
 char: g?.char || (u ? String.fromCodePoint(u) : ''),
 hasData,
 };
 });

 // If project has no registered glyphs yet, fallback to Hiragana list so the user has immediate characters to choose
 if (pool.length === 0) {
 const defaultCat = UNICODE_CATEGORIES.find((c) => c.id === 'hiragana');
 if (defaultCat) {
 pool = getCategoryCharList(defaultCat).map((item) => {
 const g = project.glyphs[item.code];
 const hasData = Boolean(
 (g?.pixelData && g.pixelData.data.some((d) => d === 1)) || (g?.contours && g.contours.length > 0)
 );
 return {
 unicode: item.code,
 char: item.char,
 hasData,
 };
 });
 }
 }
 } else if (activeCategory === 'drawn') {
 pool = projectGlyphUnicodes
 .filter((u) => {
 const g = project.glyphs[u];
 return Boolean(
 (g?.pixelData && g.pixelData.data.some((d) => d === 1)) || (g?.contours && g.contours.length > 0)
 );
 })
 .map((u) => ({
 unicode: u,
 char: project.glyphs[u]?.char || String.fromCodePoint(u),
 hasData: true,
 }));
 } else {
 const targetCatId = activeCategory === 'basic_latin' ? 'basic_latin_alnum' : activeCategory;
 const cat = UNICODE_CATEGORIES.find((c) => c.id === targetCatId || c.id === activeCategory);
 if (cat) {
 const charItems = getCategoryCharList(cat);
 pool = charItems.map((item) => {
 const u = item.code;
 const g = project.glyphs[u];
 const hasData = Boolean(
 (g?.pixelData && g.pixelData.data.some((d) => d === 1)) || (g?.contours && g.contours.length > 0)
 );
 return {
 unicode: u,
 char: item.char,
 hasData,
 };
 });
 }
 }

 if (glyphSearchQuery.trim()) {
 const query = glyphSearchQuery.trim().toLowerCase();
 pool = pool.filter((item) => {
 const hex = item.unicode.toString(16).toLowerCase();
 return item.char.toLowerCase().includes(query) || hex.includes(query);
 });
 }

 return pool;
 }, [projectGlyphUnicodes, project.glyphs, activeCategory, glyphSearchQuery]);

 const handleSelectGlyphItem = (unicode: number) => {
    autoSaveGlyph(currentGridRef.current, currentUnicode, gridWidth, gridHeight);
 setCurrentUnicode(unicode);
 onSelectGlyph?.(unicode);
 loadGlyphPixelGrid(unicode, gridWidth, gridHeight);
 const g = project.glyphs[unicode];
 const ch = g?.char || (unicode ? String.fromCodePoint(unicode) : '');
 if (ch) {
 setTraceChar(ch);
 }
 };

 const handlePrevGlyph = () => {
 const list = displayedGlyphList.length > 0 ? displayedGlyphList.map((i) => i.unicode) : projectGlyphUnicodes;
 const idx = list.indexOf(currentUnicode);
 if (idx > 0) {
 const nextU = list[idx - 1];
 handleSelectGlyphItem(nextU);
 } else if (idx === -1 && list.length > 0) {
 handleSelectGlyphItem(list[0]);
 }
 };

 const handleNextGlyph = () => {
 const list = displayedGlyphList.length > 0 ? displayedGlyphList.map((i) => i.unicode) : projectGlyphUnicodes;
 const idx = list.indexOf(currentUnicode);
 if (idx >= 0 && idx < list.length - 1) {
 const nextU = list[idx + 1];
 handleSelectGlyphItem(nextU);
 } else if (idx === -1 && list.length > 0) {
 handleSelectGlyphItem(list[0]);
 }
 };

 if (!isOpen) return null;

 return (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-2 bg-black/85 animate-in fade-in duration-150 pointer-events-auto"
 onPointerDown={(e) => e.stopPropagation()}
 onPointerMove={(e) => e.stopPropagation()}
 onPointerUp={(e) => e.stopPropagation()}
 onMouseDown={(e) => e.stopPropagation()}
 onMouseMove={(e) => e.stopPropagation()}
 onMouseUp={(e) => e.stopPropagation()}
 onTouchStart={(e) => e.stopPropagation()}
 onTouchMove={(e) => e.stopPropagation()}
 onTouchEnd={(e) => e.stopPropagation()}
 onWheel={(e) => e.stopPropagation()}
 >
 {/* Studio Workstation Container */}
 <div
 className={`w-full ${
 isFullscreen ? 'h-full max-h-none' : 'max-w-7xl h-full sm:h-[95vh] sm:max-h-[920px]'
 } rounded-none border-0 sm:border-2 shadow-2xl flex flex-col overflow-hidden select-none transition-colors ${
 isLight
 ? 'bg-white border-stone-400 text-stone-900 '
 : 'bg-[#0c130f] border-[#294232] text-emerald-100 '
 }`}
 >
 {/* Persistent Hidden File Input for Image Underlay / Trace (Shared across Mobile & Desktop) */}
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 onChange={handleImageUpload}
 className="hidden"
 />

 {/* ========================================================================= */}
 {/* 1. DESKTOP TOP HEADER (hidden on mobile, visible on md+) */}
 {/* ========================================================================= */}
 <div
 className={`hidden md:flex items-center justify-between px-3 sm:px-4 py-2 border-b-2 shrink-0 ${
 isLight ? 'bg-stone-100 border-stone-300' : 'bg-[#121c16] border-[#294232]'
 }`}
 >
 {/* Studio Brand & Current Project Status */}
 <div className="flex items-center space-x-3">
 <div className="w-8 h-8 rounded-none bg-emerald-600 text-white flex items-center justify-center font-mono font-bold text-sm border border-emerald-400">
 <Grid className="w-4 h-4 text-white" />
 </div>
 <div>
 <div className="flex items-center space-x-2">
 <h2 className="font-extrabold text-sm sm:text-base leading-none tracking-tight">
 ピクセルフォント・クリエイター
 </h2>
 <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-700/20 text-emerald-600 dark:text-emerald-400 font-extrabold border border-emerald-500/30">
 PIXEL FONT WORKSHOP
 </span>
 </div>
 <div className="flex items-center space-x-2 mt-0.5 text-xs">
 <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
 「{currentGlyph.char}」
 </span>
 <span className="font-mono text-[11px] opacity-70">
 U+{(currentUnicode || 0).toString(16).toUpperCase().padStart(4, '0')}
 </span>
 <span className="text-stone-300 dark:text-stone-700">|</span>
 <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
 {gridWidth}×{gridHeight}
 </span>
 <span className="font-mono text-[10.5px] opacity-75">
 ({activePixelCount} 点灯)
 </span>
 <span className="text-stone-300 dark:text-stone-700">|</span>
 <span className="text-[10.5px] font-bold text-stone-500 dark:text-stone-400">
 総作図: {totalDrawnPixelGlyphs} 文字
 </span>
 </div>
 </div>
 </div>

 {/* Quick Actions, View Toggles & Window Controls */}
 <div className="flex items-center space-x-1.5 sm:space-x-2">
 {/* Direct OTF Font Export Button */}
 <button
 onClick={() => handleExportFontFile('otf')}
 className="px-2.5 py-1 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 border border-emerald-400 active:scale-95 transition-all"
 title="作成したピクセルフォントを直接OTF形式でダウンロード (.otf)"
 >
 <Download className="w-3.5 h-3.5" />
 <span>OTF出力</span>
 </button>

 {/* Toggle Glyph List Sidebar */}
 <button
 onClick={() => setShowGlyphDrawer(!showGlyphDrawer)}
 className={`px-2.5 py-1 text-xs font-bold border flex items-center space-x-1 transition-all ${
 showGlyphDrawer
 ? 'bg-emerald-600 text-white border-emerald-600 '
 : isLight
 ? 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
 : 'bg-[#18261f] border-stone-700 text-stone-300 hover:bg-[#203429]'
 }`}
 title="文字一覧サイドバーの開閉"
 >
 <BookOpen className="w-3.5 h-3.5" />
 <span>文字一覧</span>
 </button>

 {/* Toggle Trace Panel */}
 <button
 onClick={() => {
 setShowTracePanel(!showTracePanel);
 if (!showTrace) setShowTrace(true);
 }}
 className={`px-2.5 py-1 text-xs font-bold border flex items-center space-x-1 transition-all ${
 showTrace
 ? 'bg-emerald-600 text-white border-emerald-600 '
 : isLight
 ? 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
 : 'bg-[#18261f] border-stone-700 text-stone-300 hover:bg-[#203429]'
 }`}
 title="下絵・参照文字の表示設定"
 >
 <ImageIcon className="w-3.5 h-3.5" />
 <span>下絵</span>
 </button>

 {/* Glyph Quick Prev/Next */}
 <div className="flex items-center border border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-[#18261f]">
 <button
 onClick={handlePrevGlyph}
 className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors"
 title="前の文字"
 >
 <ChevronLeft className="w-4 h-4" />
 </button>
 <span className="px-2 font-mono font-bold text-xs">{currentGlyph.char}</span>
 <button
 onClick={handleNextGlyph}
 className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors"
 title="次の文字"
 >
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>

 {/* Fullscreen Toggle */}
 <button
 onClick={() => setIsFullscreen(!isFullscreen)}
 className="p-1.5 border border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
 title={isFullscreen ? 'ウィンドウサイズに戻す' : 'フルスクリーン表示'}
 >
 {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
 </button>

 {/* Close Studio */}
 <button
 onClick={onClose}
 className="p-1.5 text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
 title="スタジオを閉じる (Esc)"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 </div>

 {/* ========================================================================= */}
 {/* 2. MOBILE TOP HEADER (visible on mobile, hidden on md+) */}
 {/* ========================================================================= */}
 <div
 className={`flex md:hidden items-center justify-between px-2.5 py-1.5 border-b shrink-0 ${
 isLight ? 'bg-stone-100 border-stone-300' : 'bg-[#121c16] border-[#294232]'
 }`}
 >
 {/* Left: Brand Icon + Quick Prev/Next Glyph Picker */}
 <div className="flex items-center space-x-2 min-w-0">
 <div className="w-7 h-7 bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-400">
 <Grid className="w-3.5 h-3.5 text-white" />
 </div>
 <div className="flex items-center border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#18261f]">
 <button
 onClick={handlePrevGlyph}
 className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors"
 title="前の文字"
 >
 <ChevronLeft className="w-4 h-4" />
 </button>
 <button
 onClick={() => setMobileTab('glyphs')}
 className="px-2 min-h-[32px] flex items-center gap-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/60"
 title="文字一覧を開く"
 >
 <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
 {currentGlyph.char}
 </span>
 <span className="text-[9px] font-mono opacity-60">
 U+{(currentUnicode || 0).toString(16).toUpperCase()}
 </span>
 </button>
 <button
 onClick={handleNextGlyph}
 className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors"
 title="次の文字"
 >
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Right: Quick Undo, Redo, and Close */}
 <div className="flex items-center space-x-1 shrink-0">
 <button
 onClick={handleUndo}
 disabled={historyIdx <= 0}
 className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 disabled:opacity-30 active:scale-95 transition-all"
 title="元に戻す"
 >
 <Undo2 className="w-4 h-4" />
 </button>
 <button
 onClick={handleRedo}
 disabled={historyIdx >= history.length - 1}
 className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 disabled:opacity-30 active:scale-95 transition-all"
 title="やり直し"
 >
 <Redo2 className="w-4 h-4" />
 </button>
 <button
 onClick={onClose}
 className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 active:scale-95 transition-all"
 title="閉じる"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 </div>

 {/* ========================================================================= */}
 {/* 3. DESKTOP RESOLUTION PRESET BAR (hidden on mobile, visible on md+) */}
 {/* ========================================================================= */}
 <div
 className={`hidden md:flex items-center justify-between px-3 sm:px-4 py-1.5 border-b text-xs overflow-x-auto no-scrollbar gap-2 shrink-0 ${
 isLight ? 'bg-stone-50 border-stone-300' : 'bg-[#101913] border-[#294232]'
 }`}
 >
 {/* Preset Buttons */}
 <div className="flex items-center gap-1 shrink-0">
 <span className="font-bold text-[11px] opacity-70 mr-1 flex items-center gap-1">
 <Grid className="w-3.5 h-3.5 text-emerald-600" />
 <span>制作グリッド規格:</span>
 </span>
 {PRESET_SIZES.map((p) => {
 const isSelected = preset === p.id;
 return (
 <button
 key={p.id}
 onClick={() => handlePresetSelect(p.id)}
 className={`px-2 py-0.5 font-mono font-bold text-xs border transition-all flex items-center space-x-1 ${
 isSelected
 ? 'bg-emerald-600 text-white border-emerald-600 '
 : isLight
 ? 'bg-white text-stone-700 hover:bg-stone-100 border-stone-300'
 : 'bg-[#142018] text-emerald-200 hover:bg-[#1c2c22] border-stone-800'
 }`}
 title={`${p.label} - ${p.desc}`}
 >
 <span>{p.label}</span>
 </button>
 );
 })}
 </div>

 {/* Custom Size Form */}
 {preset === 'custom' && (
 <div className="flex items-center gap-1.5 bg-white dark:bg-[#142018] px-2 py-0.5 border border-stone-300 dark:border-stone-800 shrink-0">
 <span className="font-bold text-[10px] opacity-70">W:</span>
 <input
 type="number"
 min="3"
 max="128"
 value={gridWidth}
 onChange={(e) => {
 const val = Math.max(3, Math.min(128, parseInt(e.target.value, 10) || 12));
 setGridWidth(val);
 loadGlyphPixelGrid(currentUnicode, val, gridHeight);
 }}
 className="w-10 text-center font-mono font-bold text-xs bg-transparent border-b border-emerald-500 focus:outline-hidden"
 />
 <span className="font-bold text-[10px] opacity-70">× H:</span>
 <input
 type="number"
 min="3"
 max="128"
 value={gridHeight}
 onChange={(e) => {
 const val = Math.max(3, Math.min(128, parseInt(e.target.value, 10) || 12));
 setGridHeight(val);
 loadGlyphPixelGrid(currentUnicode, gridWidth, val);
 }}
 className="w-10 text-center font-mono font-bold text-xs bg-transparent border-b border-emerald-500 focus:outline-hidden"
 />
 </div>
 )}

 {/* Dot Shape Selector */}
 <div className="flex items-center gap-1 shrink-0 ml-auto">
 <span className="font-bold text-[11px] opacity-70 mr-1">ドット形状:</span>
 {[
 { id: 'square', label: '正方形', icon: '■' },
 { id: 'round', label: '円形(LED)', icon: '●' },
 { id: 'squircle', label: '角丸', icon: '▢' },
 { id: 'diamond', label: '菱形', icon: '◆' },
 ].map((shape) => (
 <button
 key={shape.id}
 onClick={() => {
 setDotShape(shape.id as PixelDotShape);
 autoSaveGlyph(grid, currentUnicode);
 }}
 className={`px-1.5 py-0.5 text-[11px] font-bold border transition-colors ${
 dotShape === shape.id
 ? 'bg-emerald-600 text-white border-emerald-600'
 : isLight
 ? 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'
 : 'bg-[#142018] border-stone-800 text-emerald-200 hover:bg-[#1a2920]'
 }`}
 >
 <span>{shape.icon}</span>
 <span className="ml-1 hidden md:inline">{shape.label}</span>
 </button>
 ))}
 </div>
 </div>

 {/* ========================================================================= */}
 {/* 4. MAIN WORKSPACE AREA */}
 {/* ========================================================================= */}
 <div className="flex-1 flex overflow-hidden min-h-0 relative">
 {/* ----------------------------------------------------------------------- */}
 {/* A. DESKTOP LEFT DRAWER: Fast Glyph List Sidebar (hidden on mobile) */}
 {/* ----------------------------------------------------------------------- */}
 {showGlyphDrawer && (
 <div
 className={`hidden md:flex w-60 sm:w-64 border-r-2 flex-col shrink-0 z-20 overflow-hidden ${
 isLight ? 'bg-stone-50 border-stone-300' : 'bg-[#101812] border-[#294232]'
 }`}
 >
 {/* Glyph Search Bar */}
 <div className="p-2 border-b border-stone-300 dark:border-stone-800">
 <div className="relative">
 <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
 <input
 type="text"
 value={glyphSearchQuery}
 onChange={(e) => setGlyphSearchQuery(e.target.value)}
 placeholder="文字またはUnicode検索 (例: あ, A, 3042)"
 className="w-full pl-8 pr-2 py-1 text-xs border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0a0f0c] focus:outline-hidden focus:border-emerald-500 rounded-none"
 />
 {glyphSearchQuery && (
 <button
 onClick={() => setGlyphSearchQuery('')}
 className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
 >
 <X className="w-3 h-3" />
 </button>
 )}
 </div>
 </div>

 {/* Category Filter Tabs */}
 <div className="px-2 py-1.5 border-b border-stone-300 dark:border-stone-800 flex flex-wrap gap-1 text-[10.5px]">
 {PIXEL_STUDIO_CATEGORIES.map((c) => (
 <button
 key={c.id}
 onClick={() => setActiveCategory(c.id)}
 className={`px-1.5 py-0.5 border text-[10.5px] font-bold transition-colors cursor-pointer ${
 activeCategory === c.id
 ? 'bg-emerald-600 text-white border-emerald-600'
 : isLight
 ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
 : 'bg-[#142018] border-stone-800 text-stone-300 hover:bg-[#1a2820]'
 }`}
 >
 {c.label}
 </button>
 ))}
 </div>

 {/* Glyph Cards Grid */}
 <div className="flex-1 overflow-y-auto p-2">
 <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
 {displayedGlyphList.map((item) => {
 const isSelected = item.unicode === currentUnicode;
 return (
 <button
 key={item.unicode}
 onClick={() => handleSelectGlyphItem(item.unicode)}
 className={`aspect-square flex flex-col items-center justify-center border relative transition-all ${
 isSelected
 ? 'bg-emerald-600 text-white border-emerald-400 font-extrabold '
 : isLight
 ? 'bg-white border-stone-300 text-stone-800 hover:bg-stone-100 hover:border-emerald-500'
 : 'bg-[#0a0f0c] border-stone-800 text-emerald-100 hover:bg-[#16251b] hover:border-emerald-600'
 }`}
 title={`U+${item.unicode.toString(16).toUpperCase().padStart(4, '0')} (${item.char})`}
 >
 <span className="text-base sm:text-lg leading-none font-bold select-none">
 {item.char}
 </span>
 {item.hasData && (
 <div
 className={`w-1.5 h-1.5 rounded-full absolute bottom-0.5 right-0.5 ${
 isSelected ? 'bg-white' : 'bg-emerald-500'
 }`}
 />
 )}
 </button>
 );
 })}
 </div>

 {displayedGlyphList.length === 0 && (
 <div className="text-center py-8 text-stone-400 text-xs">
 一致する文字がありません
 </div>
 )}
 </div>

 {/* Bottom Summary */}
 <div className="p-2 border-t border-stone-300 dark:border-stone-800 text-[10.5px] flex items-center justify-between opacity-70">
 <span>{displayedGlyphList.length} 文字表示</span>
 <span className="font-mono">U+{currentUnicode.toString(16).toUpperCase()}</span>
 </div>
 </div>
 )}

 {/* ----------------------------------------------------------------------- */}
 {/* B. DESKTOP DRAWING TOOLS SIDEBAR (hidden on mobile) */}
 {/* ----------------------------------------------------------------------- */}
 <div
 className={`hidden md:flex w-14 sm:w-16 border-r flex-col items-center py-2.5 gap-1.5 shrink-0 overflow-y-auto ${
 isLight ? 'bg-stone-100 border-stone-300' : 'bg-[#101812] border-[#294232]'
 }`}
 >
 {/* Draw Tools */}
 {[
 { id: 'pencil', label: '鉛筆 (Pencil)', icon: Pencil },
 { id: 'eraser', label: '消しゴム (Eraser)', icon: Eraser },
 { id: 'bucket', label: '塗りつぶし (Bucket)', icon: PaintBucket },
 { id: 'line', label: '直線作図 (Line)', icon: Slash },
 { id: 'rect', label: '矩形枠 (Rect)', icon: Square },
 { id: 'rect_filled', label: '塗り矩形 (Filled Rect)', icon: Square, fill: true },
 { id: 'circle', label: '円・楕円 (Circle)', icon: Circle },
 ].map((t) => {
 const Icon = t.icon;
 const isSelected = tool === t.id;
 return (
 <button
 key={t.id}
 onClick={() => setTool(t.id as PixelDrawTool)}
 className={`p-2 border transition-all relative ${
 isSelected
 ? 'bg-emerald-600 text-white border-emerald-500 '
 : isLight
 ? 'bg-white text-stone-700 hover:bg-stone-200 border-stone-300'
 : 'bg-[#142018] text-stone-300 hover:bg-[#1f3126] border-stone-800'
 }`}
 title={t.label}
 >
 <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${t.fill ? 'fill-current' : ''}`} />
 </button>
 );
 })}

 <div className="w-8 h-[1px] bg-stone-300 dark:bg-stone-700 my-0.5" />

 {/* Brush Stamp Shape */}
 <div className="flex items-center gap-0.5 border border-stone-300 dark:border-stone-800 bg-white dark:bg-[#142018] p-0.5">
 <button
 onClick={() => setBrushStamp('square')}
 className={`p-1 text-xs font-bold ${
 brushStamp === 'square'
 ? 'bg-emerald-600 text-white'
 : 'text-stone-500 hover:text-stone-900'
 }`}
 title="四角スタンプ"
 >
 ■
 </button>
 <button
 onClick={() => setBrushStamp('round')}
 className={`p-1 text-xs font-bold ${
 brushStamp === 'round'
 ? 'bg-emerald-600 text-white'
 : 'text-stone-500 hover:text-stone-900'
 }`}
 title="丸スタンプ"
 >
 ●
 </button>
 </div>

 {/* Brush Sizes */}
 <div className="flex flex-col items-center gap-1 w-full px-1">
 {[1, 2, 3, 4, 6, 8].map((sz) => (
 <button
 key={sz}
 onClick={() => setBrushSize(sz)}
 className={`w-full py-0.5 text-[10px] font-mono font-bold border transition-colors ${
 brushSize === sz
 ? 'bg-emerald-600 text-white border-emerald-600'
 : isLight
 ? 'bg-white border-stone-300 text-stone-700'
 : 'bg-[#142018] border-stone-800 text-stone-300'
 }`}
 title={`ブラシサイズ ${sz}px`}
 >
 {sz}px
 </button>
 ))}
 </div>

 <div className="w-8 h-[1px] bg-stone-300 dark:bg-stone-700 my-0.5" />

 {/* Symmetry Toggles */}
 <button
 onClick={() => setSymmetryH(!symmetryH)}
 className={`p-2 border text-xs font-bold transition-all ${
 symmetryH
 ? 'bg-emerald-600 text-white border-emerald-500'
 : isLight
 ? 'bg-white text-stone-500 hover:bg-stone-200 border-stone-300'
 : 'bg-[#142018] text-stone-400 hover:bg-[#1f3126] border-stone-800'
 }`}
 title="左右対称描画"
 >
 <FlipHorizontal className="w-4 h-4" />
 </button>

 <button
 onClick={() => setSymmetryV(!symmetryV)}
 className={`p-2 border text-xs font-bold transition-all ${
 symmetryV
 ? 'bg-emerald-600 text-white border-emerald-500'
 : isLight
 ? 'bg-white text-stone-500 hover:bg-stone-200 border-stone-300'
 : 'bg-[#142018] text-stone-400 hover:bg-[#1f3126] border-stone-800'
 }`}
 title="上下対称描画"
 >
 <FlipVertical className="w-4 h-4" />
 </button>
 </div>

 {/* ----------------------------------------------------------------------- */}
 {/* C. SHARED INTERACTIVE PIXEL CANVAS WORKSPACE */}
 {/* (Shown on desktop always; on mobile only when mobileTab === 'canvas') */}
 {/* ----------------------------------------------------------------------- */}
 <div
 ref={containerRef}
 className={`${
 mobileTab === 'canvas' ? 'flex' : 'hidden md:flex'
 } flex-1 flex-col items-center justify-between p-1.5 sm:p-3 relative overflow-hidden bg-stone-200/70 dark:bg-[#060a08]`}
 >
 {/* Top Transform & Quick FX Toolbar (Desktop & Mobile) */}
 <div
 className={`w-full z-10 flex items-center justify-between p-1 sm:p-1.5 border overflow-x-auto no-scrollbar gap-1 ${
 isLight
 ? 'bg-white/95 border-stone-300 text-stone-800'
 : 'bg-[#101812]/95 border-[#294232] text-emerald-200'
 }`}
 >
 {/* History & Shift Controls */}
 <div className="flex items-center space-x-1 shrink-0">
 <button
 onClick={handleUndo}
 disabled={historyIdx <= 0}
 className="p-1.5 border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-stone-200 disabled:opacity-30 transition-opacity"
 title="元に戻す (Undo)"
 >
 <Undo2 className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={handleRedo}
 disabled={historyIdx >= history.length - 1}
 className="p-1.5 border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-stone-200 disabled:opacity-30 transition-opacity"
 title="やり直し (Redo)"
 >
 <Redo2 className="w-3.5 h-3.5" />
 </button>

 <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-0.5 sm:mx-1" />

 {/* 1px Shifts */}
 <button
 onClick={() => handleShift(-1, 0)}
 className="p-1.5 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
 title="左に1px移動"
 >
 <ArrowLeft className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={() => handleShift(0, -1)}
 className="p-1.5 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
 title="上に1px移動"
 >
 <ArrowUp className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={() => handleShift(0, 1)}
 className="p-1.5 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
 title="下に1px移動"
 >
 <ArrowDown className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={() => handleShift(1, 0)}
 className="p-1.5 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
 title="右に1px移動"
 >
 <ArrowRight className="w-3.5 h-3.5" />
 </button>
 </div>

 {/* Pixel FX & Transformations */}
 <div className="flex items-center space-x-1 shrink-0">
 <button
 onClick={handleFlipH}
 className="p-1.5 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
 title="左右反転"
 >
 <FlipHorizontal className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={handleFlipV}
 className="p-1.5 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
 title="上下反転"
 >
 <FlipVertical className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={handleRotate90}
 className="p-1.5 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
 title="90度回転"
 >
 <RotateCw className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={handleInvert}
 className="px-2 py-1 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-[11px] font-bold"
 title="階調反転"
 >
 反転
 </button>
 <button
 onClick={handleAddOutline}
 className="px-2 py-1 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-[11px] font-bold"
 title="1px 輪郭を太らせる"
 >
 輪郭+
 </button>
 <button
 onClick={handleAddShadow}
 className="px-2 py-1 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-[11px] font-bold"
 title="右下に1px シャドウ"
 >
 影+
 </button>

 <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-0.5 sm:mx-1" />

 <button
 onClick={handleClear}
 className="p-1.5 border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-600 hover:bg-red-100 transition-colors"
 title="全消去"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>

 {/* Trace / Underlay Reference Settings Panel (Collapsible Overlay) */}
 {showTracePanel && (
 <div
 className={`absolute top-12 left-2 right-2 z-20 p-3 border-2 shadow-xl transition-all overflow-x-auto max-h-[85vh] overflow-y-auto ${
 isLight
 ? 'bg-white/98 border-stone-400 text-stone-900'
 : 'bg-[#101812]/98 border-[#294232] text-emerald-100'
 }`}
 >
 <div className="min-w-[520px] md:min-w-0">
 <div className="flex items-center justify-between border-b pb-2 mb-2 border-stone-200 dark:border-stone-800">
 <div className="flex items-center space-x-2 font-bold text-xs">
 <ImageIcon className="w-4 h-4 text-emerald-600" />
 <span>下絵・トレース参照レイヤー設定</span>
 </div>
 <button
 onClick={() => setShowTracePanel(false)}
 className="p-1 text-stone-400 hover:text-stone-700"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
 {/* Trace Source Mode */}
 <div className="space-y-1">
 <span className="font-bold text-[11px] opacity-70">下絵ソース:</span>
 <div className="flex gap-1">
 <button
 onClick={() => setTraceSource('font')}
 className={`flex-1 py-1 text-xs font-bold border ${
 traceSource === 'font'
 ? 'bg-emerald-600 text-white border-emerald-600'
 : 'border-stone-300 dark:border-stone-700'
 }`}
 >
 システム文字
 </button>
 <button
 onClick={() => {
 setTraceSource('image');
 fileInputRef.current?.click();
 }}
 className={`flex-1 py-1 text-xs font-bold border ${
 traceSource === 'image'
 ? 'bg-emerald-600 text-white border-emerald-600'
 : 'border-stone-300 dark:border-stone-700'
 }`}
 >
 画像読込
 </button>
 </div>
 </div>

 {/* Character / Image input */}
 {traceSource === 'font' ? (
 <div className="space-y-1">
 <span className="font-bold text-[11px] opacity-70">参照文字 & フォント:</span>
 <div className="flex gap-1">
 <input
 type="text"
 value={traceChar}
 onChange={(e) => setTraceChar(e.target.value)}
 placeholder="文字"
 className="w-12 text-center font-bold text-xs border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
 />
 <select
 value={traceFontFamily}
 onChange={(e) => setTraceFontFamily(e.target.value)}
 className="flex-1 text-xs border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-1"
 >
 <option value="sans-serif">ゴシック体 (Sans-serif)</option>
 <option value="serif">明朝体 (Serif)</option>
 <option value="monospace">等幅 (Monospace)</option>
 <option value="cursive">筆記・手書き風 (Cursive)</option>
 </select>
 </div>
 </div>
 ) : (
 <div className="space-y-1">
 <span className="font-bold text-[11px] opacity-70">読込中画像:</span>
 <div className="text-xs truncate font-mono bg-stone-100 dark:bg-stone-900 p-1 border">
 {traceImageSrc ? '画像セット済み' : '未読み込み'}
 </div>
 </div>
 )}

 {/* Opacity & Scale Sliders */}
 <div className="space-y-1">
 <div className="flex justify-between text-[11px]">
 <span className="font-bold opacity-70">不透明度:</span>
 <span className="font-mono">{traceOpacity}%</span>
 </div>
 <input
 type="range"
 min="10"
 max="100"
 value={traceOpacity}
 onChange={(e) => setTraceOpacity(parseInt(e.target.value, 10))}
 className="w-full accent-emerald-600"
 />
 </div>

 {/* Auto-Binarize / Trace to Pixel Grid */}
 <div className="space-y-1">
 <div className="flex justify-between text-[11px]">
 <span className="font-bold opacity-70">抽出閾値:</span>
 <span className="font-mono">{traceThreshold}</span>
 </div>
 <button
 onClick={handleAutoBinarizeTrace}
 className="w-full py-1.5 px-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs flex items-center justify-center space-x-1 active:scale-95"
 >
 <Sparkles className="w-3.5 h-3.5" />
 <span>下絵から自動ドット化</span>
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* The Pixel Canvas: Strict CRISP Sharp Square Box */}
 <div className="flex-1 flex items-center justify-center w-full h-full min-h-0 p-2 sm:p-4">
 <div
 className="relative rounded-none overflow-hidden border-2 shadow-2xl touch-none flex items-center justify-center"
 style={{
 borderColor: isLight ? '#047857' : '#34d399',
 maxHeight: 'calc(100vh - 180px)',
 maxWidth: 'calc(100vw - 200px)',
 aspectRatio: `${gridWidth} / ${gridHeight}`,
 }}
 >
            <canvas
              onContextMenu={(e) => e.preventDefault()}
 ref={canvasRef}
 width={gridWidth * (gridWidth <= 16 ? 32 : gridWidth <= 32 ? 16 : 8)}
 height={gridHeight * (gridHeight <= 16 ? 32 : gridHeight <= 32 ? 16 : 8)}
 onPointerDown={handlePointerDown}
 onPointerMove={handlePointerMove}
 onPointerUp={handlePointerUp}
 onPointerCancel={handlePointerCancel}
 onPointerLeave={() => {
 setHoverPos(null);
 }}
 className="w-full h-full block cursor-crosshair touch-none"
 style={{ imageRendering: 'pixelated' }}
 />
 </div>
 </div>

 {/* Mobile Bottom Floating Tool Dock (Visible only on mobile canvas tab) */}
 <div className="flex md:hidden flex-col w-full gap-1 pt-1 z-10">
 {/* Row 1: Primary Drawing Tools Strip */}
 <div
 className={`flex items-center justify-between px-1 py-1 border overflow-x-auto no-scrollbar gap-1 ${
 isLight ? 'bg-white/98 border-stone-300' : 'bg-[#101812]/98 border-[#294232]'
 }`}
 >
 {[
 { id: 'pencil', label: '鉛筆', icon: Pencil },
 { id: 'eraser', label: '消ゴム', icon: Eraser },
 { id: 'bucket', label: 'バケツ', icon: PaintBucket },
 { id: 'line', label: '直線', icon: Slash },
 { id: 'rect', label: '矩形', icon: Square },
 { id: 'rect_filled', label: '塗矩形', icon: Square, fill: true },
 { id: 'circle', label: '円', icon: Circle },
 ].map((t) => {
 const Icon = t.icon;
 const isSelected = tool === t.id;
 return (
 <button
 key={t.id}
 onClick={() => setTool(t.id as PixelDrawTool)}
 className={`flex-1 min-w-[42px] min-h-[40px] flex flex-col items-center justify-center p-1 border transition-all ${
 isSelected
 ? 'bg-emerald-600 text-white border-emerald-500 scale-105'
 : isLight
 ? 'bg-stone-50 text-stone-700 border-stone-300'
 : 'bg-[#142018] text-stone-300 border-stone-800'
 }`}
 >
 <Icon className={`w-4 h-4 ${t.fill ? 'fill-current' : ''}`} />
 <span className="text-[9px] mt-0.5 font-bold leading-none">{t.label}</span>
 </button>
 );
 })}
 </div>

 {/* Row 2: Brush Settings (Stamp shape, Size, Symmetry, Trace) */}
 <div
 className={`flex items-center justify-between px-2 py-1 border text-xs overflow-x-auto no-scrollbar gap-1.5 ${
 isLight ? 'bg-stone-50 border-stone-300' : 'bg-[#101812] border-[#294232]'
 }`}
 >
 {/* Stamp Shape */}
 <div className="flex items-center border border-stone-300 dark:border-stone-800 bg-white dark:bg-[#142018]">
 <button
 onClick={() => setBrushStamp('square')}
 className={`px-2 py-1 text-xs font-bold ${
 brushStamp === 'square'
 ? 'bg-emerald-600 text-white'
 : 'text-stone-600 dark:text-stone-300'
 }`}
 >
 ■
 </button>
 <button
 onClick={() => setBrushStamp('round')}
 className={`px-2 py-1 text-xs font-bold ${
 brushStamp === 'round'
 ? 'bg-emerald-600 text-white'
 : 'text-stone-600 dark:text-stone-300'
 }`}
 >
 ●
 </button>
 </div>

 {/* Brush Sizes */}
 <div className="flex items-center gap-1">
 {[1, 2, 3, 4].map((sz) => (
 <button
 key={sz}
 onClick={() => setBrushSize(sz)}
 className={`w-7 h-7 flex items-center justify-center font-mono font-bold text-xs border ${
 brushSize === sz
 ? 'bg-emerald-600 text-white border-emerald-600'
 : 'bg-white dark:bg-[#142018] border-stone-300 dark:border-stone-800 text-stone-700 dark:text-stone-300'
 }`}
 >
 {sz}
 </button>
 ))}
 </div>

 {/* Symmetry & Trace toggles */}
 <div className="flex items-center gap-1 ml-auto">
 <button
 onClick={() => setSymmetryH(!symmetryH)}
 className={`px-2 py-1 text-[11px] font-bold border flex items-center gap-0.5 ${
 symmetryH
 ? 'bg-emerald-600 text-white border-emerald-500'
 : 'bg-white dark:bg-[#142018] border-stone-300 dark:border-stone-800 text-stone-600 dark:text-stone-300'
 }`}
 title="左右対称"
 >
 <FlipHorizontal className="w-3.5 h-3.5" />
 <span>左右</span>
 </button>
 <button
 onClick={() => setShowTrace(!showTrace)}
 className={`px-2 py-1 text-[11px] font-bold border flex items-center gap-0.5 ${
 showTrace
 ? 'bg-emerald-600 text-white border-emerald-500'
 : 'bg-white dark:bg-[#142018] border-stone-300 dark:border-stone-800 text-stone-600 dark:text-stone-300'
 }`}
 >
 <ImageIcon className="w-3.5 h-3.5" />
 <span>下絵</span>
 </button>
 </div>
 </div>
 </div>

 {/* Desktop Bottom Controls Bar: Grid Guides, Trace Toggle & PNG Export */}
 <div className="hidden md:flex w-full items-center justify-between pt-1">
 <div className="flex items-center space-x-2 bg-white/95 dark:bg-[#101812]/95 px-3 py-1 border border-stone-300 dark:border-stone-800 text-[11px] font-bold">
 <label className="flex items-center space-x-1 cursor-pointer">
 <input
 type="checkbox"
 checked={showGridLines}
 onChange={(e) => setShowGridLines(e.target.checked)}
 className="accent-emerald-600"
 />
 <span>方眼線</span>
 </label>
 <span className="opacity-40">|</span>
 <label className="flex items-center space-x-1 cursor-pointer">
 <input
 type="checkbox"
 checked={showSubdivisions}
 onChange={(e) => setShowSubdivisions(e.target.checked)}
 className="accent-emerald-600"
 />
 <span>中心線</span>
 </label>
                <span className="opacity-40">|</span>
                <label className="flex items-center space-x-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMetricsGuides}
                    onChange={(e) => setShowMetricsGuides(e.target.checked)}
                    className="accent-emerald-600"
                  />
                  <span>基準線 (Baseline)</span>
                </label>
 <span className="opacity-40">|</span>
 <label className="flex items-center space-x-1 cursor-pointer">
 <input
 type="checkbox"
 checked={showTrace}
 onChange={(e) => setShowTrace(e.target.checked)}
 className="accent-emerald-600"
 />
 <span className="text-emerald-600 dark:text-emerald-400">下絵表示</span>
 </label>
 </div>

 <div className="flex items-center space-x-1.5">
 <button
 onClick={handleExportSinglePng}
 className="px-2.5 py-1 bg-stone-100 dark:bg-[#142018] hover:bg-stone-200 dark:hover:bg-[#1c2e22] text-xs font-bold flex items-center space-x-1 transition-colors border border-stone-300 dark:border-stone-700"
 title="ドット絵を単体PNGとして保存"
 >
 <Download className="w-3.5 h-3.5" />
 <span>単体PNG</span>
 </button>
 </div>
 </div>
 </div>

 {/* ----------------------------------------------------------------------- */}
 {/* D. MOBILE FULL-SCREEN GLYPHS TAB (visible only when mobileTab === 'glyphs') */}
 {/* ----------------------------------------------------------------------- */}
 {mobileTab === 'glyphs' && (
 <div
 className={`flex md:hidden flex-1 overflow-hidden flex-col ${
 isLight ? 'bg-stone-50 text-stone-900' : 'bg-[#0c130f] text-emerald-100'
 }`}
 >
 {/* Glyph Search Bar */}
 <div className="p-2 border-b border-stone-300 dark:border-stone-800">
 <div className="relative">
 <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
 <input
 type="text"
 value={glyphSearchQuery}
 onChange={(e) => setGlyphSearchQuery(e.target.value)}
 placeholder="文字またはUnicode検索 (例: あ, A, 3042)"
 className="w-full pl-9 pr-8 py-2 text-sm border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#0a0f0c] focus:outline-hidden focus:border-emerald-500 rounded-none"
 />
 {glyphSearchQuery && (
 <button
 onClick={() => setGlyphSearchQuery('')}
 className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
 >
 <X className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>

 {/* Category Filter Horizontal Scroll */}
 <div className="px-2 py-1.5 border-b border-stone-300 dark:border-stone-800 flex overflow-x-auto no-scrollbar gap-1.5 text-xs shrink-0">
 {PIXEL_STUDIO_CATEGORIES.map((c) => (
 <button
 key={c.id}
 onClick={() => setActiveCategory(c.id)}
 className={`px-2.5 py-1 min-h-[32px] border text-xs font-bold shrink-0 transition-colors cursor-pointer ${
 activeCategory === c.id
 ? 'bg-emerald-600 text-white border-emerald-600'
 : isLight
 ? 'bg-white border-stone-300 text-stone-700'
 : 'bg-[#142018] border-stone-800 text-stone-300'
 }`}
 >
 {c.label}
 </button>
 ))}
 </div>

 {/* Glyph Cards Grid with Generous Touch Targets */}
 <div className="flex-1 overflow-y-auto p-2">
 <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
 {displayedGlyphList.map((item) => {
 const isSelected = item.unicode === currentUnicode;
 return (
 <button
 key={item.unicode}
 onClick={() => {
 handleSelectGlyphItem(item.unicode);
 setMobileTab('canvas');
 onShowToast(`「${item.char}」を作図キャンバスに設定しました`, 'info');
 }}
 className={`aspect-square min-h-[52px] flex flex-col items-center justify-center border relative transition-all active:scale-95 ${
 isSelected
 ? 'bg-emerald-600 text-white border-emerald-400 font-extrabold shadow-md'
 : isLight
 ? 'bg-white border-stone-300 text-stone-800 hover:bg-stone-100'
 : 'bg-[#101812] border-stone-800 text-emerald-100 hover:bg-[#16251b]'
 }`}
 >
 <span className="text-xl font-bold leading-none select-none">
 {item.char}
 </span>
 <span className="text-[9px] font-mono opacity-60 mt-0.5">
 {item.unicode.toString(16).toUpperCase()}
 </span>
 {item.hasData && (
 <div
 className={`w-2 h-2 rounded-full absolute top-1 right-1 ${
 isSelected ? 'bg-white' : 'bg-emerald-500'
 }`}
 />
 )}
 </button>
 );
 })}
 </div>

 {displayedGlyphList.length === 0 && (
 <div className="text-center py-12 text-stone-400 text-sm">
 一致する文字がありません
 </div>
 )}
 </div>
 </div>
 )}

 {/* ----------------------------------------------------------------------- */}
 {/* E. MOBILE PRESETS & TRACE TAB (visible only when mobileTab === 'presets')*/}
 {/* ----------------------------------------------------------------------- */}
 {mobileTab === 'presets' && (
 <div
 className={`flex md:hidden flex-1 flex-col overflow-y-auto overflow-x-auto p-3 sm:p-4 pb-24 touch-pan-x touch-pan-y ${
 isLight ? 'bg-stone-50 text-stone-900' : 'bg-[#0c130f] text-emerald-100'
 }`}
 >
 <div className="w-full min-w-[320px] sm:min-w-[360px] max-w-2xl mx-auto space-y-3.5">
 {/* Top Quick Status & Return to Canvas Bar */}
 <div
 className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 shrink-0 ${
 isLight ? 'bg-white border-stone-200' : 'bg-[#142018] border-[#25382b]'
 }`}
 >
 <div className="flex items-center gap-2 min-w-0">
 <span className="font-mono font-extrabold text-xs text-emerald-700 dark:text-emerald-400 shrink-0">
 {gridWidth}×{gridHeight}
 </span>
 <span className="text-[11px] opacity-60 shrink-0">|</span>
 <span className="text-[11px] font-bold truncate">
 {dotShape === 'square'
 ? '■ 正方形'
 : dotShape === 'round'
 ? '● 円形'
 : dotShape === 'squircle'
 ? '▢ 角丸'
 : '◆ 菱形'}
 </span>
 <span className="text-[11px] opacity-60 shrink-0">|</span>
 <span
 className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
 showTrace
 ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
 : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
 }`}
 >
 {showTrace ? '下絵ON' : '下絵OFF'}
 </span>
 </div>

 <button
 onClick={() => setMobileTab('canvas')}
 className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1 shrink-0 active:scale-95 transition-all"
 >
 <Pencil className="w-3.5 h-3.5" />
 <span>作図へ</span>
 </button>
 </div>

 {/* 1. Resolution Presets */}
 <div
 className={`p-3 rounded-xl border space-y-2.5 ${
 isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-[#142018] border-[#25382b] text-emerald-100'
 }`}
 >
 <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
 <span className="flex items-center gap-1.5">
 <Grid className="w-4 h-4 shrink-0" />
 <span>制作グリッド規格プリセット</span>
 </span>
 <span className="font-mono text-[11px] shrink-0 font-bold">
 現在: {gridWidth}×{gridHeight} ({gridWidth * gridHeight}px)
 </span>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
 {PRESET_SIZES.map((p) => {
 const isSelected = preset === p.id;
 return (
 <button
 key={p.id}
 onClick={() => {
 handlePresetSelect(p.id);
 onShowToast(`解像度を ${p.label} に変更しました`, 'info');
 }}
 className={`p-2.5 border text-left flex flex-col justify-between min-h-[58px] rounded-xl transition-all active:scale-95 cursor-pointer ${
 isSelected
 ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
 : isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
 : 'bg-[#18271e] hover:bg-[#203427] border-stone-800 text-emerald-200'
 }`}
 >
 <div className="flex items-center justify-between">
 <span className="font-mono font-black text-xs sm:text-sm">{p.label}</span>
 {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
 </div>
 <span className="text-[10px] opacity-75 truncate mt-1">{p.desc}</span>
 </button>
 );
 })}
 </div>

 {/* Custom Resolution Controls */}
 {preset === 'custom' && (
 <div className="pt-2.5 border-t border-stone-200 dark:border-stone-800 space-y-2.5">
 <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
 カスタム寸法指定 (幅 × 高さ)
 </div>

 <div className="grid grid-cols-2 gap-2">
 {/* Width Stepper */}
 <div className="p-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#101812] space-y-1">
 <span className="text-[10.5px] font-bold opacity-70">幅 (Width):</span>
 <div className="flex items-center gap-1">
 <button
 onClick={() => {
 const val = Math.max(3, gridWidth - 1);
 setGridWidth(val);
 loadGlyphPixelGrid(currentUnicode, val, gridHeight);
 }}
 className="w-7 h-7 flex items-center justify-center rounded bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-xs font-bold active:scale-95"
 >
 <Minus className="w-3 h-3" />
 </button>
 <input
 type="number"
 min="3"
 max="128"
 value={gridWidth}
 onChange={(e) => {
 const val = Math.max(3, Math.min(128, parseInt(e.target.value, 10) || 12));
 setGridWidth(val);
 loadGlyphPixelGrid(currentUnicode, val, gridHeight);
 }}
 className="flex-1 text-center font-mono font-bold text-xs py-1 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#18261f]"
 />
 <button
 onClick={() => {
 const val = Math.min(128, gridWidth + 1);
 setGridWidth(val);
 loadGlyphPixelGrid(currentUnicode, val, gridHeight);
 }}
 className="w-7 h-7 flex items-center justify-center rounded bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-xs font-bold active:scale-95"
 >
 <Plus className="w-3 h-3" />
 </button>
 </div>
 </div>

 {/* Height Stepper */}
 <div className="p-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#101812] space-y-1">
 <span className="text-[10.5px] font-bold opacity-70">高さ (Height):</span>
 <div className="flex items-center gap-1">
 <button
 onClick={() => {
 const val = Math.max(3, gridHeight - 1);
 setGridHeight(val);
 loadGlyphPixelGrid(currentUnicode, gridWidth, val);
 }}
 className="w-7 h-7 flex items-center justify-center rounded bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-xs font-bold active:scale-95"
 >
 <Minus className="w-3 h-3" />
 </button>
 <input
 type="number"
 min="3"
 max="128"
 value={gridHeight}
 onChange={(e) => {
 const val = Math.max(3, Math.min(128, parseInt(e.target.value, 10) || 12));
 setGridHeight(val);
 loadGlyphPixelGrid(currentUnicode, gridWidth, val);
 }}
 className="flex-1 text-center font-mono font-bold text-xs py-1 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#18261f]"
 />
 <button
 onClick={() => {
 const val = Math.min(128, gridHeight + 1);
 setGridHeight(val);
 loadGlyphPixelGrid(currentUnicode, gridWidth, val);
 }}
 className="w-7 h-7 flex items-center justify-center rounded bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-xs font-bold active:scale-95"
 >
 <Plus className="w-3 h-3" />
 </button>
 </div>
 </div>
 </div>

 {/* Fast Custom Size Presets */}
 <div className="flex flex-wrap items-center gap-1.5 pt-1">
 <span className="text-[10.5px] opacity-70 font-bold mr-1">クイック正方形:</span>
 {[8, 12, 16, 20, 24, 32, 48, 64].map((sz) => (
 <button
 key={sz}
 onClick={() => {
 setGridWidth(sz);
 setGridHeight(sz);
 loadGlyphPixelGrid(currentUnicode, sz, sz);
 }}
 className={`px-2 py-0.5 rounded text-[10.5px] font-mono font-bold border transition-colors ${
 gridWidth === sz && gridHeight === sz
 ? 'bg-emerald-600 text-white border-emerald-500'
 : 'bg-white dark:bg-[#18261f] border-stone-300 dark:border-stone-700 hover:bg-emerald-50 dark:hover:bg-emerald-950'
 }`}
 >
 {sz}×{sz}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* 2. Dot Shape */}
 <div
 className={`p-3 rounded-xl border space-y-2.5 ${
 isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-[#142018] border-[#25382b] text-emerald-100'
 }`}
 >
 <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
 ドット形状 (Pixel Dot Shape)
 </div>
 <div className="grid grid-cols-2 gap-2">
 {[
 { id: 'square', label: '正方形 (Classic)', icon: '■', desc: '標準的な矩形ドット' },
 { id: 'round', label: '円形 (LED Matrix)', icon: '●', desc: 'LED掲示板・丸ドット' },
 { id: 'squircle', label: '角丸 (Squircle)', icon: '▢', desc: '柔らかな角丸ドット' },
 { id: 'diamond', label: '菱形 (Diamond)', icon: '◆', desc: '幾何学・アーケード調' },
 ].map((shape) => (
 <button
 key={shape.id}
 onClick={() => {
 setDotShape(shape.id as PixelDotShape);
 autoSaveGlyph(grid, currentUnicode);
 onShowToast(`ドット形状を「${shape.label}」に設定しました`, 'info');
 }}
 className={`p-2.5 border text-left rounded-xl transition-all active:scale-95 cursor-pointer ${
 dotShape === shape.id
 ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
 : isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
 : 'bg-[#18271e] hover:bg-[#203427] border-stone-800 text-emerald-200'
 }`}
 >
 <div className="flex items-center space-x-2">
 <span className="text-base font-bold shrink-0">{shape.icon}</span>
 <span className="font-bold text-xs truncate">{shape.label}</span>
 </div>
 <div className="text-[10px] opacity-75 mt-1 truncate">{shape.desc}</div>
 </button>
 ))}
 </div>
 </div>

 {/* 3. Trace & Underlay Reference */}
 <div
 className={`p-3 rounded-xl border space-y-3 ${
 isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-[#142018] border-[#25382b] text-emerald-100'
 }`}
 >
 {/* Header with Master Toggle */}
 <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
 <span className="flex items-center gap-1.5 min-w-0">
 <ImageIcon className="w-4 h-4 shrink-0" />
 <span className="truncate">下絵・トレース参照レイヤー</span>
 </span>
 <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs shrink-0 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
 <input
 type="checkbox"
 checked={showTrace}
 onChange={(e) => setShowTrace(e.target.checked)}
 className="accent-emerald-600 cursor-pointer w-4 h-4"
 />
 <span>下絵を表示</span>
 </label>
 </div>

 {/* Source Mode Selector */}
 <div className="flex gap-2">
 <button
 onClick={() => setTraceSource('font')}
 className={`flex-1 py-2 px-2 text-xs font-bold border rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
 traceSource === 'font'
 ? 'bg-emerald-600 text-white border-emerald-600'
 : isLight
 ? 'bg-stone-50 border-stone-300 hover:bg-stone-100 text-stone-700'
 : 'bg-[#18261f] border-stone-700 hover:bg-[#203429] text-stone-300'
 }`}
 >
 <Type className="w-3.5 h-3.5" />
 <span>システム文字</span>
 </button>
 <button
 onClick={() => {
 setTraceSource('image');
 fileInputRef.current?.click();
 }}
 className={`flex-1 py-2 px-2 text-xs font-bold border rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
 traceSource === 'image'
 ? 'bg-emerald-600 text-white border-emerald-600'
 : isLight
 ? 'bg-stone-50 border-stone-300 hover:bg-stone-100 text-stone-700'
 : 'bg-[#18261f] border-stone-700 hover:bg-[#203429] text-stone-300'
 }`}
 >
 <Upload className="w-3.5 h-3.5" />
 <span>画像ファイル読込</span>
 </button>
 </div>

 {/* Source-specific controls */}
 {traceSource === 'font' ? (
 <div className="space-y-2 p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#101812]">
 <span className="text-[11px] font-bold opacity-75">参照文字 & フォント書体:</span>
 <div className="flex gap-2">
 <div className="relative">
 <input
 type="text"
 value={traceChar}
 onChange={(e) => setTraceChar(e.target.value)}
 placeholder={currentGlyph.char || 'A'}
 className="w-14 text-center font-bold text-sm py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
 />
 </div>
 <select
 value={traceFontFamily}
 onChange={(e) => setTraceFontFamily(e.target.value)}
 className="flex-1 text-xs py-1.5 px-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-medium"
 >
 <option value="sans-serif">ゴシック体 (Sans-serif)</option>
 <option value="serif">明朝体 (Serif)</option>
 <option value="monospace">等幅フォント (Monospace)</option>
 <option value="cursive">筆記・手書き風 (Cursive)</option>
 </select>
 {traceChar && (
 <button
 onClick={() => setTraceChar('')}
 className="px-2 py-1 text-[11px] font-bold border border-stone-300 dark:border-stone-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
 title="現在の作図文字に戻す"
 >
 リセット
 </button>
 )}
 </div>
 </div>
 ) : (
 <div className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#101812] space-y-2">
 <div className="flex items-center justify-between text-xs">
 <span className="font-bold opacity-75">読み込み中の画像:</span>
 <span
 className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${
 traceImageSrc
 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
 : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
 }`}
 >
 {traceImageSrc ? '画像セット済み' : '未選択'}
 </span>
 </div>

 <div className="flex items-center gap-2">
 <button
 onClick={() => fileInputRef.current?.click()}
 className="flex-1 py-1.5 px-2.5 text-xs font-bold border border-emerald-600 bg-emerald-600 text-white rounded-lg flex items-center justify-center gap-1 active:scale-95"
 >
 <Upload className="w-3.5 h-3.5" />
 <span>画像を変更・再選択</span>
 </button>
 {traceImageSrc && (
 <button
 onClick={() => {
 setTraceImageSrc(null);
 traceImageRef.current = null;
 onShowToast('下絵画像をクリアしました', 'info');
 }}
 className="px-2.5 py-1.5 text-xs font-bold border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg active:scale-95"
 >
 クリア
 </button>
 )}
 </div>
 </div>
 )}

 {/* Sliders Grid: Opacity & Scale */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
 {/* Opacity Slider */}
 <div className="space-y-1 text-xs">
 <div className="flex justify-between items-center">
 <span className="font-bold opacity-75">下絵の透明度:</span>
 <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
 {traceOpacity}%
 </span>
 </div>
 <input
 type="range"
 min="10"
 max="100"
 value={traceOpacity}
 onChange={(e) => setTraceOpacity(parseInt(e.target.value, 10))}
 className="w-full accent-emerald-600 cursor-pointer h-2"
 />
 </div>

 {/* Scale Slider */}
 <div className="space-y-1 text-xs">
 <div className="flex justify-between items-center">
 <span className="font-bold opacity-75">下絵の拡大率:</span>
 <div className="flex items-center gap-1.5">
 <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
 {traceScale}%
 </span>
 {traceScale !== 100 && (
 <button
 onClick={() => setTraceScale(100)}
 className="text-[10px] text-stone-500 hover:text-stone-800 underline"
 >
 100%
 </button>
 )}
 </div>
 </div>
 <input
 type="range"
 min="50"
 max="150"
 value={traceScale}
 onChange={(e) => setTraceScale(parseInt(e.target.value, 10))}
 className="w-full accent-emerald-600 cursor-pointer h-2"
 />
 </div>
 </div>

 {/* Position Offset Controls */}
 <div className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#101812] space-y-1.5">
 <div className="flex items-center justify-between text-xs">
 <span className="font-bold opacity-75">下絵位置の微調整 (X/Y):</span>
 <span className="font-mono text-[11px]">
 X: {traceOffsetX > 0 ? `+${traceOffsetX}` : traceOffsetX}, Y:{' '}
 {traceOffsetY > 0 ? `+${traceOffsetY}` : traceOffsetY}
 </span>
 </div>

 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-1">
 <button
 onClick={() => setTraceOffsetX((prev) => prev - 1)}
 className="w-8 h-8 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 flex items-center justify-center font-bold text-xs active:scale-95"
 title="左へ移動"
 >
 <ArrowLeft className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={() => setTraceOffsetX((prev) => prev + 1)}
 className="w-8 h-8 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 flex items-center justify-center font-bold text-xs active:scale-95"
 title="右へ移動"
 >
 <ArrowRight className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={() => setTraceOffsetY((prev) => prev - 1)}
 className="w-8 h-8 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 flex items-center justify-center font-bold text-xs active:scale-95"
 title="上へ移動"
 >
 <ArrowUp className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={() => setTraceOffsetY((prev) => prev + 1)}
 className="w-8 h-8 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 flex items-center justify-center font-bold text-xs active:scale-95"
 title="下へ移動"
 >
 <ArrowDown className="w-3.5 h-3.5" />
 </button>
 </div>

 {(traceOffsetX !== 0 || traceOffsetY !== 0) && (
 <button
 onClick={() => {
 setTraceOffsetX(0);
 setTraceOffsetY(0);
 }}
 className="px-2 py-1 text-xs font-bold border border-stone-300 dark:border-stone-700 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-800 flex items-center gap-1 active:scale-95"
 >
 <RotateCcw className="w-3 h-3" />
 <span>中央揃え</span>
 </button>
 )}
 </div>
 </div>

 {/* Binarization Threshold & Auto Convert Action */}
 <div className="space-y-2 pt-1">
 <div className="space-y-1 text-xs">
 <div className="flex justify-between items-center">
 <span className="font-bold opacity-75">自動ドット化の抽出感度 (閾値):</span>
 <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
 {traceThreshold} / 255
 </span>
 </div>
 <input
 type="range"
 min="10"
 max="245"
 value={traceThreshold}
 onChange={(e) => setTraceThreshold(parseInt(e.target.value, 10))}
 className="w-full accent-emerald-600 cursor-pointer h-2"
 />
 </div>

 <button
 onClick={() => {
 handleAutoBinarizeTrace();
 setMobileTab('canvas');
 onShowToast('下絵から自動ドット化して作図キャンバスに配置しました', 'success');
 }}
 className="w-full py-3 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center justify-center space-x-2 active:scale-95 cursor-pointer border border-emerald-500 transition-all"
 >
 <Sparkles className="w-4 h-4 shrink-0" />
 <span>下絵から自動ドット化してキャンバスへ</span>
 </button>
 </div>
 </div>

 {/* 4. Canvas Visual Guides & Symmetry */}
 <div
 className={`p-3 rounded-xl border space-y-2.5 text-xs ${
 isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-[#142018] border-[#25382b] text-emerald-100'
 }`}
 >
 <div className="font-bold text-emerald-700 dark:text-emerald-400">
 ガイド線 & 対称描画設定
 </div>
 <div className="grid grid-cols-2 gap-2">
 <label className="flex items-center space-x-2 p-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#101812] cursor-pointer">
 <input
 type="checkbox"
 checked={showGridLines}
 onChange={(e) => setShowGridLines(e.target.checked)}
 className="accent-emerald-600 cursor-pointer w-4 h-4"
 />
 <span className="font-bold text-xs">方眼グリッド線</span>
 </label>

 <label className="flex items-center space-x-2 p-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#101812] cursor-pointer">
 <input
 type="checkbox"
 checked={showSubdivisions}
 onChange={(e) => setShowSubdivisions(e.target.checked)}
 className="accent-emerald-600 cursor-pointer w-4 h-4"
 />
 <span className="font-bold text-xs">中心分割線</span>
 </label>

 <label className="flex items-center space-x-2 p-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#101812] cursor-pointer">
 <input
 type="checkbox"
 checked={symmetryH}
 onChange={(e) => setSymmetryH(e.target.checked)}
 className="accent-emerald-600 cursor-pointer w-4 h-4"
 />
 <span className="font-bold text-xs">左右対称描画</span>
 </label>

 <label className="flex items-center space-x-2 p-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#101812] cursor-pointer">
 <input
 type="checkbox"
 checked={symmetryV}
 onChange={(e) => setSymmetryV(e.target.checked)}
 className="accent-emerald-600 cursor-pointer w-4 h-4"
 />
 <span className="font-bold text-xs">上下対称描画</span>
 </label>
 </div>
 </div>

 {/* 5. Bottom Return to Canvas Action */}
 <button
 onClick={() => setMobileTab('canvas')}
 className="w-full py-3 bg-stone-800 hover:bg-stone-900 text-white dark:bg-stone-700 dark:hover:bg-stone-600 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 active:scale-95 transition-all"
 >
 <Pencil className="w-4 h-4" />
 <span>作図キャンバスに戻る</span>
 </button>
 </div>
 </div>
 )}

 {/* ----------------------------------------------------------------------- */}
 {/* F. MOBILE EXPORT & TEST TAB (visible only when mobileTab === 'export') */}
 {/* ----------------------------------------------------------------------- */}
 {mobileTab === 'export' && (
 <div
 className={`flex md:hidden flex-1 flex-col overflow-y-auto overflow-x-auto p-3 pb-24 touch-pan-x touch-pan-y ${
 isLight ? 'bg-stone-50 text-stone-900' : 'bg-[#0c130f] text-emerald-100'
 }`}
 >
 <div className="w-full min-w-[320px] sm:min-w-[360px] max-w-2xl mx-auto space-y-4">
 {/* Real-time Typing Sandbox */}
 <div
 className={`p-3 border space-y-2.5 ${
 isLight ? 'bg-white border-stone-300' : 'bg-[#101812] border-[#294232]'
 }`}
 >
 <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
 <span className="flex items-center gap-1.5">
 <Type className="w-4 h-4" />
 <span>リアルタイム文字列テスト</span>
 </span>
 </div>

 <input
 type="text"
 value={previewText}
 onChange={(e) => setPreviewText(e.target.value)}
 placeholder="テスト文字列を入力"
 className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 focus:outline-hidden"
 />

 <div className="p-3 bg-stone-950 text-emerald-400 font-mono text-center tracking-widest min-h-[60px] flex items-center justify-center overflow-x-auto border border-stone-800">
 <div className="text-lg font-bold select-none">{previewText || 'ABC 123'}</div>
 </div>
 </div>

 {/* Game Engine & Embed Export Hub */}
 <div
 className={`p-3 border space-y-3 ${
 isLight ? 'bg-white border-stone-300' : 'bg-[#101812] border-[#294232]'
 }`}
 >
 <div className="flex items-center space-x-1.5 text-xs font-extrabold text-emerald-900 dark:text-emerald-300">
 <Gamepad2 className="w-4 h-4 text-emerald-600" />
 <span>ゲーム & 開発向け一括出力 Hub</span>
 </div>
 <p className="text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
 Unity, Godot, Unreal, Phaser や Arduino/ESP32 マイコン用の各種形式で出力します。
 </p>

 {/* 1. Direct OTF Font Export */}
 <button
 onClick={() => handleExportFontFile('otf')}
 className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-between active:scale-95 border border-emerald-400 min-h-[44px]"
 title="作成したピクセルフォントを直接OTF形式でダウンロード (.otf)"
 >
 <span className="flex items-center space-x-2">
 <Download className="w-4 h-4" />
 <span>OTFフォント書き出し (.otf)</span>
 </span>
 <span className="text-[10px] font-mono uppercase bg-emerald-700/80 px-1.5 py-0.5 rounded-xs">OTF</span>
 </button>

 {/* 2. Direct TTF Font Export */}
 <button
 onClick={() => handleExportFontFile('ttf')}
 className={`w-full py-2.5 px-3 border text-xs font-bold flex items-center justify-between active:scale-95 min-h-[44px] ${
 isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-800'
 : 'bg-[#142018] hover:bg-[#1c2e22] border-stone-700 text-emerald-300'
 }`}
 title="作成したピクセルフォントをTTF形式でダウンロード (.ttf)"
 >
 <span className="flex items-center space-x-2">
 <Download className="w-4 h-4" />
 <span>TTFフォント書き出し (.ttf)</span>
 </span>
 <span className="text-[10px] font-mono uppercase opacity-75">TTF</span>
 </button>

 {/* 3. Spritesheet */}
 <button
 onClick={handleExportSpritesheet}
 className={`w-full py-2.5 px-3 border text-xs font-bold flex items-center justify-between active:scale-95 min-h-[44px] ${
 isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-800'
 : 'bg-[#142018] hover:bg-[#1c2e22] border-stone-700 text-emerald-300'
 }`}
 >
 <span className="flex items-center space-x-2">
 <LayoutGrid className="w-4 h-4" />
 <span>スプライトシート (PNG + JSON)</span>
 </span>
 <Download className="w-4 h-4" />
 </button>

 {/* 4. C/C++ Header */}
 <button
 onClick={handleExportCHeader}
 className={`w-full py-2.5 px-3 border text-xs font-bold flex items-center justify-between active:scale-95 min-h-[44px] ${
 isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-800'
 : 'bg-[#142018] hover:bg-[#1c2e22] border-stone-700 text-emerald-300'
 }`}
 >
 <span className="flex items-center space-x-2">
 <Cpu className="w-4 h-4" />
 <span>組込み用 Cヘッダー (.h)</span>
 </span>
 <FileCode className="w-4 h-4" />
 </button>

 {/* 5. Single PNG */}
 <button
 onClick={handleExportSinglePng}
 className={`w-full py-2.5 px-3 border text-xs font-bold flex items-center justify-between active:scale-95 min-h-[44px] ${
 isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-800'
 : 'bg-[#142018] hover:bg-[#1c2e22] border-stone-700 text-emerald-300'
 }`}
 >
 <span className="flex items-center space-x-2">
 <Download className="w-4 h-4" />
 <span>現在の文字「{currentGlyph.char}」をPNG出力</span>
 </span>
 <span className="text-[10px] opacity-75 font-mono">{gridWidth}×{gridHeight}</span>
 </button>
 </div>

 {/* Real-time Project Stats */}
 <div className="p-3 border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-700 dark:text-emerald-400 space-y-1.5">
 <div className="flex items-center space-x-1 font-bold">
 <CheckCircle2 className="w-4 h-4 text-emerald-600" />
 <span>リアルタイム自動同期中</span>
 </div>
 <div className="text-[11px] leading-snug opacity-85">
 全作図文字数: <strong className="font-bold">{totalDrawnPixelGlyphs} 文字</strong> / 現在の点灯ピクセル: <strong className="font-bold">{activePixelCount} px</strong>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* ----------------------------------------------------------------------- */}
 {/* G. DESKTOP RIGHT PANEL: Pixel Font Exporter & Real-Time Typing Sandbox */}
 {/* (hidden on mobile, visible on md+) */}
 {/* ----------------------------------------------------------------------- */}
 <div
 className={`hidden md:flex w-64 sm:w-72 border-l-2 p-3 flex-col justify-between shrink-0 overflow-y-auto ${
 isLight ? 'bg-stone-100 border-stone-300' : 'bg-[#101812] border-[#294232]'
 }`}
 >
 <div className="space-y-3">
 {/* Real-Time Typing Sandbox */}
 <div
 className={`p-2.5 border space-y-2 ${
 isLight ? 'bg-white border-stone-300' : 'bg-[#0a0f0c] border-stone-800'
 }`}
 >
 <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 dark:text-emerald-400">
 <span className="flex items-center space-x-1">
 <Type className="w-3.5 h-3.5" />
 <span>リアルタイム文字列テスト</span>
 </span>
 </div>

 <input
 type="text"
 value={previewText}
 onChange={(e) => setPreviewText(e.target.value)}
 placeholder="テスト文字列を入力"
 className="w-full px-2 py-1 text-xs border border-stone-300 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 focus:outline-hidden"
 />

 <div className="p-2.5 bg-stone-950 text-emerald-400 font-mono text-center tracking-widest min-h-[50px] flex items-center justify-center overflow-x-auto border border-stone-800">
 <div className="text-base font-bold select-none">{previewText || 'ABC 123'}</div>
 </div>
 </div>

 {/* Game Engine & Font Export Hub */}
 <div
 className={`p-2.5 border space-y-2.5 ${
 isLight ? 'bg-white border-stone-300' : 'bg-[#0a0f0c] border-stone-800'
 }`}
 >
 <div className="flex items-center space-x-1.5 text-xs font-extrabold text-emerald-900 dark:text-emerald-300">
 <Gamepad2 className="w-4 h-4 text-emerald-600" />
 <span>ゲーム & フォント書き出し</span>
 </div>
 <p className="text-[10px] leading-relaxed text-stone-500 dark:text-stone-400">
 Unity, Godot, Unreal, Phaser, Pygame やマイコン(Arduino/ESP32)用の各種フォーマットへ一括出力します。
 </p>

 {/* 1. Direct OTF Font Export */}
 <button
 onClick={() => handleExportFontFile('otf')}
 className="w-full py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-between transition-all active:scale-95 border border-emerald-400"
 title="作成したピクセルフォントを直接OTF形式でダウンロード (.otf)"
 >
 <span className="flex items-center space-x-1.5">
 <Download className="w-3.5 h-3.5" />
 <span>OTFフォント書き出し</span>
 </span>
 <span className="text-[10px] font-mono uppercase bg-emerald-700/80 px-1 py-0.2 rounded-xs">.otf</span>
 </button>

 {/* 2. Direct TTF Font Export */}
 <button
 onClick={() => handleExportFontFile('ttf')}
 className={`w-full py-1.5 px-2.5 border text-xs font-bold flex items-center justify-between transition-colors ${
 isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
 : 'bg-[#142018] hover:bg-[#1c2e22] border-stone-700 text-emerald-300'
 }`}
 title="作成したピクセルフォントをTTF形式でダウンロード (.ttf)"
 >
 <span className="flex items-center space-x-1.5">
 <Download className="w-3.5 h-3.5" />
 <span>TTFフォント書き出し</span>
 </span>
 <span className="text-[10px] font-mono uppercase opacity-75">.ttf</span>
 </button>

 {/* 3. Spritesheet */}
 <button
 onClick={handleExportSpritesheet}
 className={`w-full py-1.5 px-2.5 border text-xs font-bold flex items-center justify-between transition-colors ${
 isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
 : 'bg-[#142018] hover:bg-[#1c2e22] border-stone-700 text-emerald-300'
 }`}
 title="全文字のスプライトシート(PNG)と座標定義(JSON)を出力"
 >
 <span className="flex items-center space-x-1.5">
 <LayoutGrid className="w-3.5 h-3.5" />
 <span>スプライトシート (PNG+JSON)</span>
 </span>
 <Download className="w-3.5 h-3.5" />
 </button>

 {/* 4. C / C++ Array Header */}
 <button
 onClick={handleExportCHeader}
 className={`w-full py-1.5 px-2.5 border text-xs font-bold flex items-center justify-between transition-colors ${
 isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
 : 'bg-[#142018] hover:bg-[#1c2e22] border-stone-700 text-emerald-300'
 }`}
 title="Arduino / Raspberry Pi / 組込み用 C言語ヘッダーファイル (.h) を出力"
 >
 <span className="flex items-center space-x-1.5">
 <Cpu className="w-3.5 h-3.5" />
 <span>組込み用 Cヘッダー (.h)</span>
 </span>
 <FileCode className="w-3.5 h-3.5" />
 </button>
 </div>

 {/* Status Note */}
 <div className="p-2 border border-emerald-500/20 bg-emerald-500/5 text-[10.5px] text-emerald-700 dark:text-emerald-400 space-y-1">
 <div className="flex items-center space-x-1 font-bold">
 <CheckCircle2 className="w-3.5 h-3.5" />
 <span>リアルタイム自動保存中</span>
 </div>
 <div className="text-[10px] leading-tight opacity-80">
 ドットを打つたびにプロジェクトへ即座に記録されます。文字を切り替えても作業内容は保持されます。
 </div>
 </div>
 </div>

 {/* Footer Notice */}
 <div className="text-[10px] text-stone-400 dark:text-stone-500 text-center pt-2 font-mono">
 Bresenham・FloodFill・Spritesheet・C-Header出力対応
 </div>
 </div>
 </div>

 {/* ========================================================================= */}
 {/* 5. MOBILE BOTTOM THUMB NAVIGATION BAR (visible only on mobile, md:hidden) */}
 {/* ========================================================================= */}
 <div
 className={`flex md:hidden items-center justify-around h-14 shrink-0 border-t z-30 ${
 isLight
 ? 'bg-white/98 border-stone-300 shadow-lg'
 : 'bg-[#0a0f0c]/98 border-[#294232] '
 }`}
 style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 2px)' }}
 >
 {[
 { id: 'canvas', label: '描画', icon: Pencil },
 { id: 'glyphs', label: '文字一覧', icon: BookOpen, badge: `${totalDrawnPixelGlyphs}` },
 { id: 'presets', label: '規格・下絵', icon: Grid },
 { id: 'export', label: '出力・テスト', icon: Gamepad2 },
 ].map((tab) => {
 const Icon = tab.icon;
 const isActive = mobileTab === tab.id;
 return (
 <button
 key={tab.id}
 onClick={() => setMobileTab(tab.id as typeof mobileTab)}
 className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 transition-all relative ${
 isActive
 ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
 : isLight
 ? 'text-stone-500 hover:text-stone-900'
 : 'text-stone-400 hover:text-stone-100'
 }`}
 >
 <div className="relative">
 <Icon className={`w-4 h-4 ${isActive ? 'scale-110' : ''}`} />
 {tab.badge && parseInt(tab.badge, 10) > 0 && (
 <span className="absolute -top-1.5 -right-3 text-[8.5px] font-mono px-1 rounded-full bg-emerald-600 text-white font-bold leading-tight">
 {tab.badge}
 </span>
 )}
 </div>
 <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
 {isActive && (
 <div className="w-6 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full mt-0.5" />
 )}
 </button>
 );
 })}
 </div>
 </div>
 </div>
 );
};
export default PixelFontStudioModal;
