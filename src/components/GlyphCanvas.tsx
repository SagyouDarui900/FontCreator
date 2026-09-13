import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  Eye,
  EyeOff,
  RotateCcw,
  Layers,
  Undo,
  Redo,
  Italic,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Copy,
  Trash2,
  Plus,
  Minus,
  Ruler,
  Compass,
  Sparkles,
  Info,
  X,
  Square,
  Circle,
  Triangle,
  Star,
  Heart,
  Diamond,
  Spline,
  Zap,
  Activity,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Wand2,
  Paintbrush,
  Check,
  Bookmark,
  Magnet,
  Crosshair,
  CornerDownLeft,
  MousePointer,
  PenTool,
  Maximize,
  Minimize,
  Grid,
  GripVertical,
  ChevronDown,
  Hexagon,
  Lock,
  Unlock,
  Shield,
  ShieldCheck,
  ChevronUp,
  PanelBottomClose,
  PanelBottomOpen,
} from 'lucide-react';
import {
  PathContour,
  BezierNode,
  Point,
  StrokePoint,
  BrushStyle,
  ToolMode,
  TraceSettings,
  GridSettings,
  SnapGuideLine,
  CustomGuideline,
} from '../types';
import {
  snapContourMovement,
  snapSinglePoint,
} from '../utils/snapUtils';
import {
  generateId,
  contoursToSvgPath,
  generateFastStrokeSvgPath,
  strokePointsToOutline,
  simplifyContour,
  smoothStrokeContour,
  smoothContoursPreservingShape,
  convertContourToCorners,
  convertContourToSmooth,
  createRectContour,
  createRoundedRectContour,
  createEllipseContour,
  createTriangleContour,
  createStarContour,
  createHeartContour,
  createSparkleContour,
  createStarburstContour,
  createDiamondContour,
  createHexagonContour,
  createLineContour,
  snapToStraightAngle,
  generateStraightStrokePoints,
  slantSingleContour,
  rotateSingleContour,
  scaleSingleContour,
  flipSingleContourH,
  flipSingleContourV,
  duplicateContour,
  rotateMultipleContours,
  scaleMultipleContours,
  flipMultipleContoursH,
  flipMultipleContoursV,
  duplicateMultipleContours,
  unionContours,
  normalizeGlyphContoursWinding,
  groupContoursWithHoles,
  resolveContourOverlaps,
  hasContourIntersections,
  reverseContour,
  getContoursBoundingBox,
  isPointNearContour,
  eraseContoursAtPoint,
  PEN_PRESETS,
  insertNodeOnContourAtPoint,
  toggleNodeType,
} from '../utils/pathUtils';
import {
  DAKUTEN_MAPPINGS,
  createDakutenContours,
  createHandakutenContours,
  cloneContours,
} from '../utils/dakutenHelper';
import { SCREEN_BASELINE_Y } from '../utils/fontCompiler';
import { ThemeMode } from '../utils/theme';
import { JapaneseGuidesLayer } from './canvas/JapaneseGuidesLayer';
import { CanvasBackgroundLayer } from './canvas/CanvasBackgroundLayer';
import { AdjacentGlyphsLayer } from './canvas/AdjacentGlyphsLayer';
import { MetricsGuidesLayer } from './canvas/MetricsGuidesLayer';
import { CanvasRulersLayer } from './canvas/CanvasRulersLayer';
import { TraceReferenceLayer } from './canvas/TraceReferenceLayer';
import { CustomGuidelinesLayer } from './canvas/CustomGuidelinesLayer';
import { RulerMeasurementLayer } from './canvas/RulerMeasurementLayer';
import { MainGlyphContoursLayer } from './canvas/MainGlyphContoursLayer';

const CANVAS_SHAPE_LIST: { id: ToolMode; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'rect', label: '長方形 (Rectangle)', icon: Square },
  { id: 'square', label: '正方形 (Square)', icon: Square },
  { id: 'ellipse', label: '楕円 (Ellipse)', icon: Circle },
  { id: 'circle', label: '正円 (Circle)', icon: Circle },
  { id: 'rounded_rect', label: '角丸四角 (Rounded)', icon: Square },
  { id: 'triangle', label: '正三角形 (Triangle)', icon: Triangle },
  { id: 'star', label: '星型 (Star)', icon: Star },
  { id: 'heart', label: 'ハート (Heart)', icon: Heart },
  { id: 'sparkle', label: '4芒星 (Sparkle)', icon: Sparkles },
  { id: 'starburst', label: '8芒星 (Starburst)', icon: Sparkles },
  { id: 'diamond', label: '菱形 (Diamond)', icon: Diamond },
  { id: 'polygon', label: '正六角形 (Hexagon)', icon: Hexagon },
  { id: 'line', label: '直線バー (Line)', icon: Minus },
];

// Cache individual contour SVG path strings by contour object identity for instant stroke commits
const contourPathStringCache = new WeakMap<PathContour, string>();

function getCachedContourSvgPath(c: PathContour): string {
  let d = contourPathStringCache.get(c);
  if (d === undefined) {
    d = contoursToSvgPath([c]);
    contourPathStringCache.set(c, d);
  }
  return d;
}

// Lightweight decimation for live preview to keep frame rate constant (60/120fps)
// even on long strokes towards the end of strokes.
function getDecimatedPointsForLivePreview(pts: StrokePoint[]): StrokePoint[] {
  const len = pts.length;
  if (len <= 70) return pts;
  const tailCount = 20;
  const headCount = len - tailCount;
  const step = Math.ceil(headCount / 35);
  const decimated: StrokePoint[] = [pts[0]];
  for (let i = step; i < headCount; i += step) {
    decimated.push(pts[i]);
  }
  for (let i = headCount; i < len; i++) {
    decimated.push(pts[i]);
  }
  return decimated;
}

interface GlyphCanvasProps {
  contours: PathContour[];
  onChangeContours: (contours: PathContour[]) => void;
  advanceWidth: number;
  lsb: number;
  onChangeAdvanceWidth: (width: number) => void;
  onChangeLsb: (lsb: number) => void;
  toolMode: ToolMode;
  onSetToolMode?: (mode: ToolMode) => void;
  brushWidth: number;
  brushStyle?: BrushStyle;
  onChangeBrushStyle?: (style: BrushStyle) => void;
  onChangeBrushWidth?: (width: number) => void;
  pressureSensitivity?: 'high' | 'normal' | 'low' | 'off';
  onChangePressureSensitivity?: (s: 'high' | 'normal' | 'low' | 'off') => void;
  traceSettings: TraceSettings;
  onChangeTraceSettings?: (fn: (prev: TraceSettings) => TraceSettings) => void;
  selectedUnicode?: number;
  gridSettings: GridSettings;
  onChangeGridSettings?: React.Dispatch<React.SetStateAction<GridSettings>>;
  activeChar: string;
  onCommitHistory: () => void;
  theme: ThemeMode;
  onSelectPrevGlyph?: () => void;
  onSelectNextGlyph?: () => void;
  onCopyFromChar?: (sourceChar: string) => void;
  onGenerateDakutenTarget?: (targetChar: string, isHandakuten: boolean) => void;
  onToggleGridDrawer?: () => void;
  showGridDrawer?: boolean;
  onToggleMetricsDrawer?: () => void;
  showMetricsDrawer?: boolean;
  onToggleRadicals?: () => void;
  showRadicals?: boolean;
  onToggleZenMode?: () => void;
  isZenMode?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onOpenPenPresetsModal?: () => void;
  isAnyModalOpen?: boolean;
}

// High-Contrast SVG Cursor Definitions (Dual-layer white-outer / black-inner for 100% visibility on any light/dark background or grid)
const HIGH_CONTRAST_CROSSHAIR_CURSOR = `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16 2V12M16 20V30M2 16H12M20 16H30' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3Cpath d='M16 2V12M16 20V30M2 16H12M20 16H30' stroke='%230f172a' stroke-width='2' stroke-linecap='round'/%3E%3Ccircle cx='16' cy='16' r='4' fill='%2310b981' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E") 16 16, crosshair`;

const HIGH_CONTRAST_PEN_CURSOR = `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4 28L7 20L22 5C23.5 3.5 26.5 3.5 28 5C29.5 6.5 29.5 9.5 28 11L13 26L5 28L4 28Z' fill='white' stroke='%230f172a' stroke-width='2'/%3E%3Cpath d='M4 28L7 20L22 5C23.5 3.5 26.5 3.5 28 5C29.5 6.5 29.5 9.5 28 11L13 26L5 28L4 28Z' fill='%2310b981' fill-opacity='0.25'/%3E%3Ccircle cx='4' cy='28' r='2' fill='%23ef4444' stroke='white' stroke-width='1'/%3E%3C/svg%3E") 4 28, crosshair`;

const HIGH_CONTRAST_NODE_CURSOR = `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 4L22 14L14 16L11 25L6 4Z' fill='white' stroke='%230f172a' stroke-width='2.5' stroke-linejoin='round'/%3E%3Cpath d='M6 4L22 14L14 16L11 25L6 4Z' fill='%230284c7'/%3E%3C/svg%3E") 6 4, default`;

const HIGH_CONTRAST_ERASER_CURSOR = `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 22L16 12L22 18L12 28L6 28Z' fill='white' stroke='%230f172a' stroke-width='3' stroke-linejoin='round'/%3E%3Cpath d='M6 22L16 12L22 18L12 28L6 28Z' fill='%23ef4444' stroke='%230f172a' stroke-width='1.5' stroke-linejoin='round'/%3E%3Cpath d='M11 17L17 23' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M12 28H26' stroke='%230f172a' stroke-width='2.5' stroke-linecap='round'/%3E%3Ccircle cx='6' cy='28' r='2' fill='%2310b981' stroke='white' stroke-width='1'/%3E%3C/svg%3E") 6 28, crosshair`;

export const GlyphCanvas: React.FC<GlyphCanvasProps> = ({
  contours,
  onChangeContours,
  advanceWidth,
  lsb,
  onChangeAdvanceWidth,
  onChangeLsb,
  toolMode,
  onSetToolMode,
  brushWidth,
  brushStyle = 'brush' as BrushStyle,
  onChangeBrushStyle,
  onChangeBrushWidth,
  pressureSensitivity = 'high' as 'high' | 'normal' | 'low' | 'off',
  onChangePressureSensitivity,
  traceSettings,
  onChangeTraceSettings,
  selectedUnicode,
  gridSettings,
  onChangeGridSettings,
  activeChar,
  onCommitHistory,
  theme,
  onSelectPrevGlyph,
  onSelectNextGlyph,
  onCopyFromChar,
  onGenerateDakutenTarget,
  onToggleGridDrawer,
  showGridDrawer,
  onToggleMetricsDrawer,
  showMetricsDrawer,
  onToggleRadicals,
  showRadicals,
  onToggleZenMode,
  isZenMode = false,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onOpenPenPresetsModal,
  isAnyModalOpen = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isLight = theme === 'light';

  // Pen Mode: 'bezier' (smooth bezier curves) or 'corner' (sharp angular polyline)
  const [penMode, setPenMode] = useState<'bezier' | 'corner'>('bezier');

  // Node Points Visibility Toggle (hides clutter when writing/viewing)
  const [showNodes, setShowNodes] = useState<boolean>(true);
  // Node appearance style: 'clean' (subtle elegant dots that keep glyph shape 100% visible), 'minimal' (active only), 'full' (standard boxes & handles)
  const [nodeStyle, setNodeStyle] = useState<'clean' | 'full' | 'selected_only'>('clean');

  // Zoom & Pan Viewport State
  const [zoom, setZoom] = useState<number>(0.55);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });

  // Trace adjust dragging state
  const [isDraggingTrace, setIsDraggingTrace] = useState<boolean>(false);
  const traceDragStartRef = useRef<{ clientX: number; clientY: number; initOffsetX: number; initOffsetY: number }>({
    clientX: 0,
    clientY: 0,
    initOffsetX: 0,
    initOffsetY: 0,
  });

  // Touch gesture state for pinch-to-zoom & two-finger pan
  const touchPointersRef = useRef<Map<number, Point>>(new Map());
  const pointerTypesRef = useRef<Map<number, string>>(new Map());
  const isPenDrawingRef = useRef<boolean>(false);
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1);
  const initialPinchCenterRef = useRef<Point | null>(null);
  const initialPinchPanRef = useRef<Point>({ x: 0, y: 0 });
  const isTwoFingerGestureRef = useRef<boolean>(false);
  const lastTapTimeRef = useRef<number>(0);
  const [isStylusActive, setIsStylusActive] = useState<boolean>(false);
  const [liveStylusPressure, setLiveStylusPressure] = useState<number | null>(null);

  // Selection & Node Editing State
  const [selectedContourIds, setSelectedContourIds] = useState<string[]>([]);
  const selectedContourId = selectedContourIds.length > 0 ? selectedContourIds[0] : null;
  const setSelectedContourId = useCallback((id: string | null) => {
    setSelectedContourIds(id ? [id] : []);
  }, []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedHandleType, setSelectedHandleType] = useState<'node' | 'handleIn' | 'handleOut' | null>(null);

  // External contour selection listener (e.g. from radical insertion)
  useEffect(() => {
    const handleExternalSelect = (e: Event) => {
      const customEvent = e as CustomEvent<{ ids?: string[] }>;
      if (customEvent.detail && Array.isArray(customEvent.detail.ids) && customEvent.detail.ids.length > 0) {
        setSelectedContourIds(customEvent.detail.ids);
        setSelectedNodeId(null);
        setSelectedHandleType(null);
      }
    };
    window.addEventListener('font_editor_select_contours', handleExternalSelect);
    return () => {
      window.removeEventListener('font_editor_select_contours', handleExternalSelect);
    };
  }, []);
  const [marqueeSelection, setMarqueeSelection] = useState<{ start: Point; current: Point } | null>(null);
  const [showShapePickerDropdown, setShowShapePickerDropdown] = useState<boolean>(false);
  const shapePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shapePickerRef.current && !shapePickerRef.current.contains(e.target as Node)) {
        setShowShapePickerDropdown(false);
      }
    };
    if (showShapePickerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showShapePickerDropdown]);

  const isShapeTool = [
    'rect',
    'square',
    'ellipse',
    'circle',
    'rounded_rect',
    'triangle',
    'star',
    'heart',
    'sparkle',
    'starburst',
    'diamond',
    'polygon',
    'line',
  ].includes(toolMode);

  // Pen Tool creation in-progress
  const [activePenContour, setActivePenContour] = useState<PathContour | null>(null);
  const [penMousePos, setPenMousePos] = useState<Point | null>(null);
  const [penHudPos, setPenHudPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingPenHudRef = useRef(false);
  const penHudDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Floating Brush HUD states (Position, minimize/collapse, visibility, dragging)
  const [showBrushHud, setShowBrushHud] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('fontforge_show_brush_hud');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [isBrushHudCollapsed, setIsBrushHudCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fontforge_brush_hud_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [brushHudPos, setBrushHudPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('fontforge_brush_hud_pos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [isDrawingStroke, setIsDrawingStroke] = useState<boolean>(false);
  const isDraggingBrushHudRef = useRef(false);
  const brushHudDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Brush Tool stroke in-progress (Hardware-accelerated direct SVG path refs for 120Hz smooth iPad drawing)
  const brushStrokePointsRef = useRef<StrokePoint[]>([]);
  const pendingBrushEventsRef = useRef<{ clientX: number; clientY: number; pressure: number; timeStamp: number; pointerType: string }[]>([]);
  const activeBrushPathRef = useRef<SVGPathElement | null>(null);
  const brushRafIdRef = useRef<number | null>(null);

  // Shape creation in-progress
  const [shapeStartPoint, setShapeStartPoint] = useState<Point | null>(null);
  const [shapeCurrentPoint, setShapeCurrentPoint] = useState<Point | null>(null);
  const shapeRafRef = useRef<number | null>(null);
  const [isShiftLockRatio, setIsShiftLockRatio] = useState<boolean>(false);
  const [isAltFromCenter, setIsAltFromCenter] = useState<boolean>(false);

  // Dragging metrics guide lines
  const [draggingMetric, setDraggingMetric] = useState<'lsb' | 'rsb' | null>(null);

  // Spacebar Hand/Pan navigation state
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);

  // Continuous sweep eraser tracking
  const isErasingRef = useRef<boolean>(false);
  const erasedAnyInSessionRef = useRef<boolean>(false);

  // Bounding Box Transformation Session (Move, Free Rotate, 8-directional Resizing for single or multiple contours)
  const [transformSession, setTransformSession] = useState<{
    handle: 'move' | 'rotate' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
    startPoint: Point;
    initialBBox: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
      width: number;
      height: number;
      centerX: number;
      centerY: number;
    };
    initialContours: PathContour[];
  } | null>(null);
  const [rotateDisplayAngle, setRotateDisplayAngle] = useState<number | null>(null);

  // Ruler Measurement & Straight Line Draw Tool State
  const [rulerMeasurement, setRulerMeasurement] = useState<{
    start: Point;
    end: Point;
    active: boolean;
  } | null>(null);
  const [rulerMode, setRulerMode] = useState<'draw' | 'measure'>('draw');

  // Ruler Straight Line Assist (Hold Shift or toggle straight mode for precise horizontal/vertical/45deg lines)
  const [brushStraightMode, setBrushStraightMode] = useState<boolean>(false);
  const lastBrushPointRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Stroke Smoothing Options & Real-time Auto-Smooth
  const [autoSmoothBrush, setAutoSmoothBrush] = useState<boolean>(true);
  const [autoUnionBrush, setAutoUnionBrush] = useState<boolean>(false);
  // 一筆書きの線が交差・重なった部分の白抜き防止（デフォルトOFF: 必要時のみONでストロークラグをゼロ化）
  const [autoResolveBrushOverlap, setAutoResolveBrushOverlap] = useState<boolean>(false);
  const [smoothStrength, setSmoothStrength] = useState<'mild' | 'standard' | 'strong'>('standard');
  const [smoothPreserveCorners, setSmoothPreserveCorners] = useState<boolean>(true);
  const [showSmoothMenu, setShowSmoothMenu] = useState<boolean>(false);
  const [canvasToast, setCanvasToast] = useState<{ message: string; subText?: string; id: number } | null>(null);

  // Bottom Floating Bar Compact/Expand State
  const [isBottomBarCollapsed, setIsBottomBarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mojisaku_bottom_bar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleBottomBarCollapse = useCallback(() => {
    setIsBottomBarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('mojisaku_bottom_bar_collapsed', String(next));
      } catch {
        // Ignored
      }
      return next;
    });
  }, []);

  // Palm Rejection Mode ('auto': ignore single touch when stylus detected, 'strict_pen_only': only stylus draws, 'off': allow finger drawing)
  const [palmRejectionMode, setPalmRejectionMode] = useState<'auto' | 'strict_pen_only' | 'off'>(() => {
    try {
      const saved = localStorage.getItem('mojisaku_palm_rejection_mode');
      if (saved === 'auto' || saved === 'strict_pen_only' || saved === 'off') return saved;
    } catch {
      // fallback
    }
    return 'auto';
  });

  const handleSetPalmRejectionMode = useCallback((mode: 'auto' | 'strict_pen_only' | 'off') => {
    setPalmRejectionMode(mode);
    try {
      localStorage.setItem('mojisaku_palm_rejection_mode', mode);
    } catch {
      // Ignored
    }
  }, []);

  // Eraser Tool Config (Size & Eraser Mode: 'stroke' = 全体一括消し, 'cut' = なぞった部分のパス分割消し)
  const [eraserSize, setEraserSize] = useState<number>(36);
  const [eraserMode, setEraserMode] = useState<'stroke' | 'cut'>('stroke');

  // Multi-touch Gesture tracking for 2-finger tap (Undo) and 3-finger tap (Redo)
  const touchStartTimeRef = useRef<number>(0);
  const maxTouchCountRef = useRef<number>(0);
  const hasMovedSignificantRef = useRef<boolean>(false);

  const showCanvasToast = useCallback((message: string, subText?: string) => {
    const id = Date.now();
    setCanvasToast({ message, subText, id });
    setTimeout(() => {
      setCanvasToast((curr) => (curr?.id === id ? null : curr));
    }, 3200);
  }, []);

  // Helper to generate exact brush contour for both live preview and finalization
  const getProcessedBrushContour = useCallback(
    (pts: StrokePoint[], isFinalize: boolean = false) => {
      let strokePts = pts;
      // 描画中のプレビュー時は間引きを行い、長大なストローク終端でもフレームレート（60/120fps）を一定に保つ
      if (!isFinalize && pts.length > 70) {
        strokePts = getDecimatedPointsForLivePreview(pts);
      }

      const rawContour = strokePointsToOutline(strokePts, brushWidth, brushStyle, true, pressureSensitivity);
      // カクカク角筆・角丸筆（sharp / sharp_round / polygon）は専用ジオメトリ生成のため自動平滑化をバイパスし、直線と角丸を100%保持
      const isSharp = brushStyle === 'sharp' || brushStyle === 'sharp_round' || brushStyle === 'polygon';
      // 重いカーブフィッティング平滑化は確定時（isFinalize = true）のみ実行し、描画中RAFでの処理落ちを完全に防ぐ
      return isFinalize && autoSmoothBrush && !isSharp
        ? smoothStrokeContour(rawContour, {
            level: smoothStrength,
            preserveCorners: smoothPreserveCorners,
          }).contour
        : rawContour;
    },
    [brushWidth, brushStyle, pressureSensitivity, autoSmoothBrush, smoothStrength, smoothPreserveCorners]
  );

  // Real-time Hover Position in Font Canvas Coordinates (0 - 1000)
  const [hoverCanvasPos, setHoverCanvasPos] = useState<Point | null>(null);
  const hoverRafRef = useRef<number | null>(null);

  // Throttled RAF references for ultra-smooth 60fps node and handle dragging
  const nodeDragRafRef = useRef<number | null>(null);
  const pendingContoursRef = useRef<PathContour[] | null>(null);

  // Clean up RAF & timers on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (hoverRafRef.current != null) {
        cancelAnimationFrame(hoverRafRef.current);
      }
      if (nodeDragRafRef.current != null) {
        cancelAnimationFrame(nodeDragRafRef.current);
      }
      if (brushRafIdRef.current != null) {
        cancelAnimationFrame(brushRafIdRef.current);
      }
      if (shapeRafRef.current != null) {
        cancelAnimationFrame(shapeRafRef.current);
      }
    };
  }, []);

  // Active Smart Snap Guidelines (Baseline, LSB, Metrics, Other Contours, Grid)
  const [activeSnapGuides, setActiveSnapGuides] = useState<SnapGuideLine[]>([]);

  // User Custom Guidelines (Created by dragging from Top or Left Rulers)
  const [customGuidelines, setCustomGuidelines] = useState<{
    id: string;
    type: 'h' | 'v';
    position: number;
  }[]>([]);
  const [lockGuidelines, setLockGuidelines] = useState<boolean>(true);
  const [draggingGuidelineId, setDraggingGuidelineId] = useState<string | null>(null);
  const [newGuidelineType, setNewGuidelineType] = useState<'h' | 'v' | null>(null);

  // Draw straight stroke directly from ruler measurement line
  const handleDrawRulerAsStroke = useCallback(() => {
    if (!rulerMeasurement) return;
    const { start, end } = rulerMeasurement;
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    if (dist < 4) return;

    const strokeContour = createLineContour(
      start.x,
      start.y,
      end.x,
      end.y,
      brushWidth || 32
    );
    onChangeContours([...contours, strokeContour]);
    onCommitHistory();
    setRulerMeasurement(null);
    showCanvasToast('定規のラインから直線ストロークを作成しました', `長さ: ${Math.round(dist)}px / 太さ: ${brushWidth}px`);
  }, [rulerMeasurement, brushWidth, contours, onChangeContours, onCommitHistory, showCanvasToast]);

  // Convert ruler line to horizontal or vertical canvas guideline
  const handleConvertRulerToGuideline = useCallback(() => {
    if (!rulerMeasurement) return;
    const { start, end } = rulerMeasurement;
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const isHorizontal = dx >= dy;
    const newGuide = {
      id: generateId(),
      type: (isHorizontal ? 'h' : 'v') as 'h' | 'v',
      position: isHorizontal ? Math.round((start.y + end.y) / 2) : Math.round((start.x + end.x) / 2),
    };
    setCustomGuidelines((prev) => [...prev, newGuide]);
    setRulerMeasurement(null);
    showCanvasToast(
      isHorizontal ? '水平ガイド線を作成しました' : '垂直ガイド線を作成しました',
      `位置: ${newGuide.position}px`
    );
  }, [rulerMeasurement, setCustomGuidelines, showCanvasToast]);

  // Mobile UI View Modes & Bottom Action Sheets
  const [isMobileFocusMode, setIsMobileFocusMode] = useState<boolean>(false);
  const [showMobilePartSheet, setShowMobilePartSheet] = useState<boolean>(false);
  const [showMobileBrushSheet, setShowMobileBrushSheet] = useState<boolean>(false);
  const [showMobileGuidesSheet, setShowMobileGuidesSheet] = useState<boolean>(false);

  // Boundary Clamping for Viewport Panning (prevents canvas from drifting into infinite empty space)
  const clampPan = useCallback((p: Point, currentZoom: number): Point => {
    if (!containerRef.current) return p;
    const rect = containerRef.current.getBoundingClientRect();
    const cWidth = rect.width;
    const cHeight = rect.height;
    if (cWidth <= 0 || cHeight <= 0) return p;

    const canvasWidth = 1000 * currentZoom;
    const canvasHeight = 1000 * currentZoom;

    // Minimum visible overlap: keep at least 30% or 180px in view
    const minVisibleX = Math.min(canvasWidth * 0.35, 180);
    const minVisibleY = Math.min(canvasHeight * 0.35, 180);

    const minX = -canvasWidth + minVisibleX;
    const maxX = cWidth - minVisibleX;
    const minY = -canvasHeight + minVisibleY;
    const maxY = cHeight - minVisibleY;

    return {
      x: Math.min(maxX, Math.max(minX, p.x)),
      y: Math.min(maxY, Math.max(minY, p.y)),
    };
  }, []);

  // Auto-center canvas on initial mount, resize, or drawer toggle with optimal zoom
  const resetView = useCallback((mode: 'fit' | 'width' | '100%' = 'fit') => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      if (mode === '100%') {
        setZoom(1.0);
        setPan({
          x: (rect.width - 1000) / 2,
          y: (rect.height - 1000) / 2,
        });
        return;
      }

      if (mode === 'width') {
        const margin = rect.width < 640 ? 12 : 24;
        const widthZoom = Math.max(0.35, Math.min(3.5, (rect.width - margin) / 1000));
        setZoom(widthZoom);
        setPan({
          x: (rect.width - 1000 * widthZoom) / 2,
          y: Math.max(16, (rect.height - 1000 * widthZoom) / 2),
        });
        return;
      }

      // Default 'fit': comfortable, optimal margin (12px on mobile, 24px on desktop/iPad)
      const margin = rect.width < 640 ? 12 : 28;
      const idealZoom = Math.min((rect.width - margin) / 1000, (rect.height - margin) / 1000);
      const clampedZoom = Math.max(0.35, Math.min(3.5, idealZoom));
      setZoom(clampedZoom);
      setPan({
        x: (rect.width - 1000 * clampedZoom) / 2,
        y: (rect.height - 1000 * clampedZoom) / 2,
      });
    }
  }, []);

  // Smooth centered zoom step helper
  const handleZoomStep = useCallback((factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setZoom((prevZoom) => {
      const nextZoom = Math.max(0.35, Math.min(5.0, prevZoom * factor));
      const scale = nextZoom / prevZoom;
      setPan((prevPan) => {
        const newPan = {
          x: centerX - (centerX - prevPan.x) * scale,
          y: centerY - (centerY - prevPan.y) * scale,
        };
        return clampPan(newPan, nextZoom);
      });
      return nextZoom;
    });
  }, [clampPan]);

  const zoomRef = useRef<number>(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const containerDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // Auto-fit on initial mount
  useEffect(() => {
    resetView('fit');
  }, [resetView]);

  // ResizeObserver to adapt cleanly when sidebar drawers slide open or close, or orientation changes
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const prev = containerDimensionsRef.current;
          if (prev.width === 0) {
            resetView('fit');
          } else {
            // Keep user's zoom level intact, smoothly re-clamp pan to ensure canvas stays safely visible
            setPan((prevPan) => clampPan(prevPan, zoomRef.current));
          }
          containerDimensionsRef.current = { width, height };
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [resetView, clampPan]);

  // Global canvas shortcuts: '0' for Fit to Screen, '1' for 100%, 'W' for Fit Width, 'F'/'Shift+Z' for Zen Mode
  useEffect(() => {
    const handleCanvasShortcut = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);
      if (isInputActive || isAnyModalOpen) return;

      if (e.key === '0' || (e.shiftKey && e.key === '!')) {
        e.preventDefault();
        resetView('fit');
        showCanvasToast('画面にフィット (Fit to Screen)');
      } else if (e.key === '1') {
        e.preventDefault();
        resetView('100%');
        showCanvasToast('等倍表示 (100%)');
      } else if ((e.key === 'w' || e.key === 'W') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        resetView('width');
        showCanvasToast('幅いっぱいに拡大 (Fit Width)');
      } else if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleZoomStep(1.25);
      } else if ((e.key === '-' || e.key === '_') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleZoomStep(1 / 1.25);
      } else if (
        ((e.key === 'f' || e.key === 'F') || (e.shiftKey && (e.key === 'z' || e.key === 'Z'))) &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        if (onToggleZenMode) {
          e.preventDefault();
          onToggleZenMode();
        }
      }
    };
    window.addEventListener('keydown', handleCanvasShortcut);
    return () => window.removeEventListener('keydown', handleCanvasShortcut);
  }, [resetView, onToggleZenMode, showCanvasToast, handleZoomStep, isAnyModalOpen]);

  // Screen to Canvas Coordinates Converter (Pure geometric mapping)
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left - pan.x) / zoom;
      const y = (clientY - rect.top - pan.y) / zoom;
      return { x: Math.round(x), y: Math.round(y) };
    },
    [pan.x, pan.y, zoom]
  );

  // ---------------- PATH & BEZIER UNDO / RESET / FINISH ACTIONS ----------------

  // Undo the last placed node in the active pen path (やり直し)
  const handleUndoPenNode = useCallback(() => {
    if (!activePenContour) return;
    if (activePenContour.nodes.length <= 1) {
      // If only 1 node was placed, cancel/reset the path
      setActivePenContour(null);
      setSelectedNodeId(null);
      showCanvasToast('パスの作図をキャンセルしました');
    } else {
      const remainingNodes = activePenContour.nodes.slice(0, -1);
      setActivePenContour({
        ...activePenContour,
        nodes: remainingNodes,
      });
      setSelectedNodeId(remainingNodes[remainingNodes.length - 1].id);
      showCanvasToast('直前の頂点を取り消しました', `残り ${remainingNodes.length} 点`);
    }
  }, [activePenContour, showCanvasToast]);

  // Reset/Discard the entire in-progress pen path (リセット)
  const handleResetPenContour = useCallback(() => {
    if (activePenContour) {
      const count = activePenContour.nodes.length;
      setActivePenContour(null);
      setSelectedNodeId(null);
      setSelectedHandleType(null);
      showCanvasToast('作図中のパスをリセット・破棄しました', `${count} 点を消去`);
    }
  }, [activePenContour, showCanvasToast]);

  // Finish and commit the in-progress pen path (確定)
  const handleFinishPenContour = useCallback(
    (closed: boolean = false) => {
      if (!activePenContour || activePenContour.nodes.length === 0) return;
      if (activePenContour.nodes.length === 1) {
        showCanvasToast('パスには2点以上の頂点が必要です', '作図を継続またはEscでキャンセル');
        return;
      }
      const finalized: PathContour = {
        ...activePenContour,
        closed,
      };
      onChangeContours([...contours, finalized]);
      setSelectedContourId(finalized.id);
      setActivePenContour(null);
      setSelectedNodeId(null);
      onCommitHistory();
      showCanvasToast(
        closed ? '閉じた輪郭として確定しました' : '開いた線として確定しました',
        `${finalized.nodes.length} 頂点`
      );
    },
    [activePenContour, contours, onChangeContours, onCommitHistory, showCanvasToast]
  );

  // ---------------- DRAGGABLE PEN HUD ACTIONS ----------------
  const handlePenHudPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingPenHudRef.current = true;
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }

    const containerRect = containerRef.current?.getBoundingClientRect();
    const currentLeft =
      penHudPos?.x ??
      (containerRect ? Math.max(16, (containerRect.width - 340) / 2) : 60);
    const currentTop = penHudPos?.y ?? 56;

    penHudDragOffsetRef.current = {
      x: e.clientX - currentLeft,
      y: e.clientY - currentTop,
    };
  }, [penHudPos]);

  const handlePenHudPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingPenHudRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    let newX = e.clientX - penHudDragOffsetRef.current.x;
    let newY = e.clientY - penHudDragOffsetRef.current.y;

    // Clamp within container boundaries
    newX = Math.max(8, Math.min(containerRect.width - 260, newX));
    newY = Math.max(8, Math.min(containerRect.height - 44, newY));

    setPenHudPos({ x: newX, y: newY });
  }, []);

  const handlePenHudPointerUp = useCallback((e: React.PointerEvent) => {
    if (isDraggingPenHudRef.current) {
      isDraggingPenHudRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleBrushHudPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingBrushHudRef.current = true;
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }

    const containerRect = containerRef.current?.getBoundingClientRect();
    const currentLeft =
      brushHudPos?.x ??
      (containerRect ? Math.max(16, (containerRect.width - 340) / 2) : 60);
    const currentTop = brushHudPos?.y ?? 10;

    brushHudDragOffsetRef.current = {
      x: e.clientX - currentLeft,
      y: e.clientY - currentTop,
    };
  }, [brushHudPos]);

  const handleBrushHudPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingBrushHudRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    let newX = e.clientX - brushHudDragOffsetRef.current.x;
    let newY = e.clientY - brushHudDragOffsetRef.current.y;

    newX = Math.max(8, Math.min(containerRect.width - 160, newX));
    newY = Math.max(8, Math.min(containerRect.height - 44, newY));

    setBrushHudPos({ x: newX, y: newY });
    try {
      localStorage.setItem('fontforge_brush_hud_pos', JSON.stringify({ x: newX, y: newY }));
    } catch {}
  }, []);

  const handleBrushHudPointerUp = useCallback((e: React.PointerEvent) => {
    if (isDraggingBrushHudRef.current) {
      isDraggingBrushHudRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    }
  }, []);

  // Clear / Reset all contours of current character
  const handleClearAllContours = useCallback(() => {
    if (contours.length === 0) return;
    onChangeContours([]);
    setSelectedContourId(null);
    setSelectedNodeId(null);
    setActivePenContour(null);
    onCommitHistory();
    showCanvasToast('文字の全輪郭をリセットしました', 'Ctrl+Z でいつでも復元可能');
  }, [contours.length, onChangeContours, onCommitHistory, showCanvasToast]);

  // ---------------- TRANSFORMATION SESSION HELPER ----------------
  const handleTransformPointerDown = useCallback(
    (
      e: React.PointerEvent,
      handle: 'move' | 'rotate' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w',
      overrideTargetIds?: string[]
    ) => {
      e.stopPropagation();
      const targetIds = overrideTargetIds || selectedContourIds;
      if (targetIds.length === 0) return;
      const targetContours = contours.filter((c) => targetIds.includes(c.id));
      if (targetContours.length === 0) return;

      const bbox = getContoursBoundingBox(targetContours);
      const pos = screenToCanvas(e.clientX, e.clientY);
      setTransformSession({
        handle,
        startPoint: pos,
        initialBBox: bbox,
        initialContours: targetContours,
      });
    },
    [selectedContourIds, contours, screenToCanvas]
  );

  // Resolve dynamic high-contrast cursor
  const getCanvasCursor = useCallback(() => {
    if (isSpacePressed || toolMode === 'hand' || isPanning) return isPanning ? 'grabbing' : 'grab';
    const isHighContrast = gridSettings.highContrastCursor !== false;
    if (toolMode === 'pen') return isHighContrast ? HIGH_CONTRAST_PEN_CURSOR : 'crosshair';
    if (toolMode === 'node' || toolMode === 'select') return isHighContrast ? HIGH_CONTRAST_NODE_CURSOR : 'default';
    if (toolMode === 'eraser') return isHighContrast ? HIGH_CONTRAST_ERASER_CURSOR : 'crosshair';
    if (toolMode === 'brush' || isShapeTool || toolMode === 'ruler') {
      return isHighContrast ? HIGH_CONTRAST_CROSSHAIR_CURSOR : 'crosshair';
    }
    return 'default';
  }, [gridSettings.highContrastCursor, toolMode, isPanning, isSpacePressed, isShapeTool]);

  // ---------------- POINTER EVENT HANDLERS ----------------

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Ignored for non-capturable pointers in certain mobile browsers
    }
    pointerTypesRef.current.set(e.pointerId, e.pointerType);
    touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Spacebar or Middle Mouse or Hand tool = Pan canvas (HIGHEST PRIORITY)
    if (toolMode === 'hand' || e.button === 1 || isSpacePressed) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    // Stylus / Apple Pencil detection
    const isPen = e.pointerType === 'pen';
    if (isPen) {
      isPenDrawingRef.current = true;
      setIsStylusActive(true);
      if (e.pressure && e.pressure > 0) {
        setLiveStylusPressure(Math.round(e.pressure * 100));
      }
    }

    // Track multi-touch tap gestures
    if (e.pointerType === 'touch') {
      const currentTouchCount = touchPointersRef.current.size;
      if (currentTouchCount === 1) {
        touchStartTimeRef.current = Date.now();
        maxTouchCountRef.current = 1;
        hasMovedSignificantRef.current = false;
      } else {
        maxTouchCountRef.current = Math.max(maxTouchCountRef.current, currentTouchCount);
      }
    }

    // PALM REJECTION for iPad & Stylus:
    // If palm rejection is active (auto when stylus is active or strict_pen_only), ignore accidental palm/finger drawing!
    const isPalmRejectionActive =
      palmRejectionMode === 'strict_pen_only' ||
      (palmRejectionMode === 'auto' && isStylusActive);

    if (e.pointerType === 'touch' && isPalmRejectionActive && !isPenDrawingRef.current) {
      // If 1 finger touch during active palm rejection, ignore canvas stroke to prevent stray marks
      if (touchPointersRef.current.size === 1) {
        // Allow metric dragging if right on guide
        const posCheck = screenToCanvas(e.clientX, e.clientY);
        const hitThreshold = 30 / zoom;
        if (Math.abs(posCheck.x - lsb) <= hitThreshold || Math.abs(posCheck.x - advanceWidth) <= hitThreshold) {
          // Allow guideline adjustment
        } else {
          showCanvasToast('パームリジェクション', 'ペン先以外の接触を自動ブロック中');
          return;
        }
      }
    }

    if (isPenDrawingRef.current && e.pointerType === 'touch') {
      return;
    }

    // Multi-touch gesture (Pinch-to-zoom & 2-Finger Pan)
    // Only pure finger touches trigger pinch zoom / 2-finger pan
    const fingerTouches = Array.from(touchPointersRef.current.entries())
      .filter(([id]) => pointerTypesRef.current.get(id) === 'touch');

    if (fingerTouches.length >= 2 && !isPenDrawingRef.current) {
      isTwoFingerGestureRef.current = true;
      // Immediately cancel any single-touch drawings in progress to prevent accidental blobs or stray strokes
      brushStrokePointsRef.current = [];
      if (activeBrushPathRef.current) {
        activeBrushPathRef.current.setAttribute('d', '');
      }
      setShapeStartPoint(null);
      setShapeCurrentPoint(null);
      setDraggingMetric(null);
      setDraggingGuidelineId(null);
      setIsDraggingTrace(false);
      setTransformSession(null);
      isErasingRef.current = false;

      // If pen contour was just started by finger 1 (single node), discard it so pinch doesn't leave stray node
      if (activePenContour && activePenContour.nodes.length <= 1) {
        setActivePenContour(null);
        setSelectedNodeId(null);
      }

      const pts = fingerTouches.map(([, pt]) => pt);
      const p1 = pts[0];
      const p2 = pts[1];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      initialPinchDistRef.current = Math.max(10, dist);
      initialPinchZoomRef.current = zoom;
      initialPinchCenterRef.current = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      initialPinchPanRef.current = { ...pan };
      return;
    }

    // Double tap on mobile screen -> quick toggle Fit / 100% (only in select or hand tool to avoid interrupting drawing)
    if (e.pointerType === 'touch' && (toolMode === 'select' || toolMode === 'hand')) {
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300 && touchPointersRef.current.size === 1) {
        if (Math.abs(zoom - 1.0) < 0.08) {
          resetView('fit');
          showCanvasToast('画面にフィット');
        } else {
          resetView('100%');
          showCanvasToast('100% 等倍表示');
        }
        lastTapTimeRef.current = 0;
        return;
      }
      lastTapTimeRef.current = now;
    }

    const pos = screenToCanvas(e.clientX, e.clientY);
    const isTouch = e.pointerType === 'touch';
    const metricHitDist = isTouch ? Math.max(30 / zoom, 26) : 18 / zoom;

    // Metrics drag detection (LSB or RSB)
    // 🛡️ Guard against accidental vertical line dragging during drawing tools or when guidelines are locked
    const isDrawingTool = toolMode === 'brush' || toolMode === 'pen' || toolMode === 'eraser' || isShapeTool;
    const isMetricDragAllowed = !lockGuidelines && !isDrawingTool && (toolMode === 'select' || toolMode === 'ruler' || toolMode === 'hand');

    if (isMetricDragAllowed) {
      if (Math.abs(pos.x - lsb) <= metricHitDist) {
        setDraggingMetric('lsb');
        return;
      }
      if (Math.abs(pos.x - advanceWidth) <= metricHitDist) {
        setDraggingMetric('rsb');
        return;
      }
    } else if (lockGuidelines && toolMode === 'select' && (Math.abs(pos.x - lsb) <= metricHitDist || Math.abs(pos.x - advanceWidth) <= metricHitDist)) {
      showCanvasToast('ガイド・文字幅線はロックされています', 'ヘッダーの鍵アイコンでロック解除できます');
    }

    // TRACE ADJUST DRAG
    if (toolMode === 'trace_adjust') {
      setIsDraggingTrace(true);
      traceDragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        initOffsetX: traceSettings.offsetX || 0,
        initOffsetY: traceSettings.offsetY || 0,
      };
      return;
    }

    // RULER / MEASUREMENT TOOL
    if (toolMode === 'ruler') {
      setRulerMeasurement({
        start: pos,
        end: pos,
        active: true,
      });
      return;
    }

    // 選択中は誤描画を防止：輪郭やノードを選択している間はキャンバスへの新規書き込みをロック
    // タップ/クリックで選択を解除し、再度描画できるようにする
    const hasActiveSelection =
      selectedContourIds.length > 0 ||
      (selectedNodeId !== null && !activePenContour);

    // Auto-clear active selection on start drawing so user can directly create paths immediately
    if (
      hasActiveSelection &&
      (toolMode === 'brush' || toolMode === 'pen' || isShapeTool)
    ) {
      setSelectedContourIds([]);
      setSelectedContourId(null);
      setSelectedNodeId(null);
      setSelectedHandleType(null);
    }

    // PEN TOOL
    if (toolMode === 'pen') {
      let penPos = pos;
      if (!e.altKey && (gridSettings.snapToGuides !== false || gridSettings.snapToGrid)) {
        const snapRes = snapSinglePoint(
          pos,
          contours,
          { lsb, advanceWidth, baseline: 800, ascender: 200, capHeight: 300, xHeight: 500, descender: 1000 },
          customGuidelines,
          Math.max(7, Math.round(12 / zoom)),
          gridSettings
        );
        penPos = snapRes.point;
        setActiveSnapGuides(snapRes.activeGuides);
      }

      if (!activePenContour) {
        // Start new path
        const firstNode: BezierNode = {
          id: generateId(),
          x: penPos.x,
          y: penPos.y,
          type: penMode === 'corner' ? 'corner' : 'smooth',
        };
        const newContour: PathContour = {
          id: generateId(),
          closed: false,
          nodes: [firstNode],
        };
        setActivePenContour(newContour);
        setSelectedContourId(newContour.id);
        setSelectedNodeId(firstNode.id);
        if (penMode === 'bezier') {
          setSelectedHandleType('handleOut');
        } else {
          setSelectedHandleType(null);
        }
      } else {
        const firstNode = activePenContour.nodes[0];
        const distToStart = Math.hypot(penPos.x - firstNode.x, penPos.y - firstNode.y);

        // Closing path if clicked near start node
        if (activePenContour.nodes.length >= 2 && distToStart <= 24 / zoom) {
          const closed = { ...activePenContour, closed: true };
          onChangeContours([...contours, closed]);
          setActivePenContour(null);
          setSelectedNodeId(null);
          onCommitHistory();
          return;
        }

        // Add new node
        const newNode: BezierNode = {
          id: generateId(),
          x: penPos.x,
          y: penPos.y,
          type: penMode === 'corner' ? 'corner' : 'smooth',
        };
        const updated = {
          ...activePenContour,
          nodes: [...activePenContour.nodes, newNode],
        };
        setActivePenContour(updated);
        setSelectedNodeId(newNode.id);
        if (penMode === 'bezier') {
          setSelectedHandleType('handleOut');
        } else {
          setSelectedHandleType(null);
        }
      }
      return;
    }

    // BRUSH TOOL (With Stylus / Apple Pencil pressure tracking & Straight Line Assist)
    if (toolMode === 'brush') {
      setIsDrawingStroke(true);
      pendingBrushEventsRef.current = [];
      const isPen = e.pointerType === 'pen';
      let pres = 0.5;
      if (pressureSensitivity === 'off') {
        pres = 0.5;
      } else if (isPen) {
        setIsStylusActive(true);
        pres = e.pressure && e.pressure > 0 ? e.pressure : 0.18;
      } else if (e.pressure && e.pressure > 0 && e.pressure !== 0.5) {
        pres = e.pressure;
      }

      // Shift-Click straight line connection from previous stroke endpoint (like Photoshop / Paint Tool SAI)
      if (e.shiftKey && lastBrushPointRef.current && (Date.now() - lastBrushPointRef.current.time) < 120000) {
        const pPrev: StrokePoint = {
          x: lastBrushPointRef.current.x,
          y: lastBrushPointRef.current.y,
          pressure: pres,
          time: Date.now() - 50,
        };
        const pCurr: StrokePoint = { x: pos.x, y: pos.y, pressure: pres, time: Date.now() };
        const straightPts = generateStraightStrokePoints(pPrev, pCurr);
        brushStrokePointsRef.current = straightPts;
      } else {
        brushStrokePointsRef.current = [{ x: pos.x, y: pos.y, pressure: pres, time: Date.now() }];
      }

      if (activeBrushPathRef.current) {
        const contour = getProcessedBrushContour(brushStrokePointsRef.current, false);
        const d = contoursToSvgPath([contour]);
        activeBrushPathRef.current.setAttribute('d', d);
      }
      return;
    }

    // SHAPES (RECT, SQUARE, ELLIPSE, CIRCLE, ROUNDED_RECT, TRIANGLE, STAR, HEART, SPARKLE, STARBURST, DIAMOND, POLYGON)
    if (isShapeTool) {
      let startPos = pos;
      if (!e.altKey && (gridSettings.snapToGuides !== false || gridSettings.snapToGrid)) {
        const snapRes = snapSinglePoint(
          pos,
          contours,
          { lsb, advanceWidth, baseline: 800, ascender: 200, capHeight: 300, xHeight: 500, descender: 1000 },
          customGuidelines,
          Math.max(7, Math.round(12 / zoom)),
          gridSettings
        );
        startPos = snapRes.point;
        setActiveSnapGuides(snapRes.activeGuides);
      }
      setShapeStartPoint(startPos);
      setShapeCurrentPoint(startPos);
      setIsShiftLockRatio(e.shiftKey);
      setIsAltFromCenter(e.altKey);
      return;
    }

    // ERASER TOOL
    if (toolMode === 'eraser') {
      isErasingRef.current = true;
      erasedAnyInSessionRef.current = false;
      const eraseRadius = Math.max(8, (eraserSize / 2) / zoom);
      const updatedContours = eraseContoursAtPoint(contours, pos, eraseRadius, eraserMode);
      if (updatedContours.length !== contours.length || JSON.stringify(updatedContours) !== JSON.stringify(contours)) {
        erasedAnyInSessionRef.current = true;
        onChangeContours(updatedContours);
      }
      return;
    }

    // SELECT / NODE TOOL
    if (toolMode === 'select' || toolMode === 'node') {
      // Check if clicking existing handle or node
      let foundNode = false;
      const isTouchMode = e.pointerType === 'touch';
      const handleHitDist = isTouchMode ? Math.max(30 / zoom, 24) : 16 / zoom;
      const nodeHitDist = isTouchMode ? Math.max(32 / zoom, 26) : 18 / zoom;

      for (const contour of contours) {
        for (const node of contour.nodes) {
          // Check handleOut
          if (node.handleOut && Math.hypot(node.handleOut.x - pos.x, node.handleOut.y - pos.y) <= handleHitDist) {
            setSelectedContourId(contour.id);
            setSelectedNodeId(node.id);
            setSelectedHandleType('handleOut');
            foundNode = true;
            break;
          }
          // Check handleIn
          if (node.handleIn && Math.hypot(node.handleIn.x - pos.x, node.handleIn.y - pos.y) <= handleHitDist) {
            setSelectedContourId(contour.id);
            setSelectedNodeId(node.id);
            setSelectedHandleType('handleIn');
            foundNode = true;
            break;
          }
          // Check node anchor
          if (Math.hypot(node.x - pos.x, node.y - pos.y) <= nodeHitDist) {
            setSelectedContourId(contour.id);
            setSelectedNodeId(node.id);
            setSelectedHandleType('node');
            foundNode = true;
            break;
          }
        }
        if (foundNode) break;
      }

      if (!foundNode) {
        // Check if click was on a contour bounding box
        const clickedContour = contours.find((contour) => {
          const bbox = getContoursBoundingBox([contour]);
          return (
            pos.x >= bbox.minX - 15 &&
            pos.x <= bbox.maxX + 15 &&
            pos.y >= bbox.minY - 15 &&
            pos.y <= bbox.maxY + 15
          );
        });

        if (clickedContour) {
          if (e.shiftKey) {
            setSelectedContourIds((prev) =>
              prev.includes(clickedContour.id)
                ? prev.filter((id) => id !== clickedContour.id)
                : [...prev, clickedContour.id]
            );
            setSelectedNodeId(null);
          } else {
            let nextSelectedIds = [clickedContour.id];
            if (selectedContourIds.includes(clickedContour.id) && selectedContourIds.length > 1) {
              nextSelectedIds = selectedContourIds;
            } else {
              setSelectedContourIds(nextSelectedIds);
            }
            setSelectedNodeId(null);

            // Instant Direct Drag Movement when clicking any contour in select mode
            if (toolMode === 'select') {
              handleTransformPointerDown(e, 'move', nextSelectedIds);
            }
          }
        } else {
          if (!e.shiftKey) {
            setSelectedContourIds([]);
          }
          setSelectedNodeId(null);
          if (toolMode === 'select') {
            setMarqueeSelection({ start: pos, current: pos });
          }
        }
        setSelectedHandleType(null);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    // Palm rejection: ignore accidental resting palm movement while stylus is active
    if (isPenDrawingRef.current && e.pointerType === 'touch') {
      return;
    }
    touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Track movement for multi-touch tap gestures
    if (e.pointerType === 'touch' && !hasMovedSignificantRef.current) {
      hasMovedSignificantRef.current = true;
    }

    // Handle 2-finger pinch zoom and fluid two-finger pan (pure finger touches only)
    const fingerTouches = Array.from(touchPointersRef.current.entries())
      .filter(([id]) => pointerTypesRef.current.get(id) === 'touch');

    if (fingerTouches.length >= 2 && initialPinchDistRef.current && initialPinchCenterRef.current && !isPenDrawingRef.current) {
      const pts = fingerTouches.map(([, pt]) => pt);
      const p1 = pts[0];
      const p2 = pts[1];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const newZoom = Math.max(0.35, Math.min(5.0, initialPinchZoomRef.current * (dist / initialPinchDistRef.current)));

      const currentCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const centerDx = currentCenter.x - initialPinchCenterRef.current.x;
      const centerDy = currentCenter.y - initialPinchCenterRef.current.y;

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const initCenterScreenX = initialPinchCenterRef.current.x - rect.left;
        const initCenterScreenY = initialPinchCenterRef.current.y - rect.top;

        const canvasX = (initCenterScreenX - initialPinchPanRef.current.x) / initialPinchZoomRef.current;
        const canvasY = (initCenterScreenY - initialPinchPanRef.current.y) / initialPinchZoomRef.current;

        setZoom(newZoom);
        setPan(clampPan({
          x: initCenterScreenX - canvasX * newZoom + centerDx,
          y: initCenterScreenY - canvasY * newZoom + centerDy,
        }, newZoom));
      } else {
        setZoom(newZoom);
        setPan(clampPan({
          x: initialPinchPanRef.current.x + centerDx,
          y: initialPinchPanRef.current.y + centerDy,
        }, newZoom));
      }
      return;
    }

    if (isTwoFingerGestureRef.current) {
      return;
    }

    if (isPanning) {
      setPan(clampPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      }, zoom));
      return;
    }

    // Dragging trace image position
    if (isDraggingTrace && onChangeTraceSettings) {
      const deltaX = (e.clientX - traceDragStartRef.current.clientX) / zoom;
      const deltaY = (e.clientY - traceDragStartRef.current.clientY) / zoom;
      onChangeTraceSettings((prev) => ({
        ...prev,
        offsetX: Math.round(traceDragStartRef.current.initOffsetX + deltaX),
        offsetY: Math.round(traceDragStartRef.current.initOffsetY + deltaY),
      }));
      return;
    }

    const pos = screenToCanvas(e.clientX, e.clientY);
    
    // Only update hover cursor coordinates when not actively drawing/panning
    const isDrawingOrPanning =
      toolMode === 'brush' ||
      isShapeTool ||
      isErasingRef.current ||
      isSpacePressed ||
      isPanning;

    if (!isDrawingOrPanning) {
      if (hoverRafRef.current == null) {
        hoverRafRef.current = requestAnimationFrame(() => {
          hoverRafRef.current = null;
          setHoverCanvasPos(pos);
        });
      }
    }

    // Active Custom Guideline Drag
    if (draggingGuidelineId) {
      setCustomGuidelines((prev) =>
        prev.map((g) => {
          if (g.id !== draggingGuidelineId) return g;
          return {
            ...g,
            position: g.type === 'v' ? Math.max(0, Math.min(1000, pos.x)) : Math.max(0, Math.min(1000, pos.y)),
          };
        })
      );
      return;
    }

    // New Guideline Dragging from Rulers
    if (newGuidelineType) {
      // Keep tracking
      return;
    }

    // Active Ruler Measurement Drag
    if (toolMode === 'ruler' && rulerMeasurement && rulerMeasurement.active) {
      let endX = pos.x;
      let endY = pos.y;

      if (e.shiftKey) {
        // Snap to orthogonal (horizontal / vertical) or 45 degrees
        const dx = pos.x - rulerMeasurement.start.x;
        const dy = pos.y - rulerMeasurement.start.y;
        const angle = Math.atan2(dy, dx);
        const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const dist = Math.hypot(dx, dy);
        endX = Math.round(rulerMeasurement.start.x + Math.cos(snapAngle) * dist);
        endY = Math.round(rulerMeasurement.start.y + Math.sin(snapAngle) * dist);
      }

      setRulerMeasurement({
        ...rulerMeasurement,
        end: { x: endX, y: endY },
      });
      return;
    }

    // Metric lines drag
    if (draggingMetric === 'lsb') {
      onChangeLsb(Math.max(0, Math.min(pos.x, advanceWidth - 50)));
      return;
    }
    if (draggingMetric === 'rsb') {
      onChangeAdvanceWidth(Math.max(lsb + 50, Math.min(2000, pos.x)));
      return;
    }

    // Marquee rectangular drag selection
    if (marqueeSelection) {
      setMarqueeSelection((prev) => (prev ? { ...prev, current: pos } : null));
      return;
    }

    // ---------------- ACTIVE BOUNDING BOX TRANSFORMATION DRAG ----------------
    if (transformSession && selectedContourIds.length > 0) {
      const { handle, startPoint, initialBBox, initialContours } = transformSession;
      const rawDx = pos.x - startPoint.x;
      const rawDy = pos.y - startPoint.y;

      if (handle === 'move') {
        let finalDx = rawDx;
        let finalDy = rawDy;

        // Smart snap to Baseline, LSB, Metrics, Grid, and other contours (hold Alt/Option to bypass)
        if (!e.altKey && (gridSettings.snapToGuides !== false || gridSettings.snapToGrid)) {
          const otherContours = contours.filter((c) => !selectedContourIds.includes(c.id));
          const snapThreshold = Math.max(7, Math.round(12 / zoom));
          const allInitialNodes = initialContours.flatMap((c) => c.nodes);
          const snapResult = snapContourMovement(
            initialBBox,
            rawDx,
            rawDy,
            otherContours,
            { lsb, advanceWidth, baseline: 800, ascender: 200, capHeight: 300, xHeight: 500, descender: 1000 },
            customGuidelines,
            snapThreshold,
            allInitialNodes,
            gridSettings
          );
          finalDx = snapResult.dx;
          finalDy = snapResult.dy;
          setActiveSnapGuides(snapResult.activeGuides);
        } else {
          setActiveSnapGuides([]);
        }

        const updatedMap = new Map<string, PathContour>();
        for (const ic of initialContours) {
          updatedMap.set(ic.id, {
            ...ic,
            nodes: ic.nodes.map((n) => ({
              ...n,
              x: Math.round(n.x + finalDx),
              y: Math.round(n.y + finalDy),
              handleIn: n.handleIn ? { x: Math.round(n.handleIn.x + finalDx), y: Math.round(n.handleIn.y + finalDy) } : null,
              handleOut: n.handleOut ? { x: Math.round(n.handleOut.x + finalDx), y: Math.round(n.handleOut.y + finalDy) } : null,
            })),
          });
        }
        onChangeContours(contours.map((c) => updatedMap.get(c.id) || c));
        return;
      }

      if (handle === 'rotate') {
        setActiveSnapGuides([]);
        const { centerX, centerY } = initialBBox;
        const startAngle = Math.atan2(startPoint.y - centerY, startPoint.x - centerX);
        const currAngle = Math.atan2(pos.y - centerY, pos.x - centerX);
        let delta = currAngle - startAngle;

        if (e.shiftKey) {
          // Snap to 15-degree increments when Shift is held
          const step = (15 * Math.PI) / 180;
          delta = Math.round(delta / step) * step;
        }

        const deg = Math.round((delta * 180) / Math.PI);
        setRotateDisplayAngle(deg);

        const cos = Math.cos(delta);
        const sin = Math.sin(delta);

        const rotPoint = (p: Point) => {
          const rx = p.x - centerX;
          const ry = p.y - centerY;
          return {
            x: Math.round(centerX + rx * cos - ry * sin),
            y: Math.round(centerY + rx * sin + ry * cos),
          };
        };

        const updatedMap = new Map<string, PathContour>();
        for (const ic of initialContours) {
          updatedMap.set(ic.id, {
            ...ic,
            nodes: ic.nodes.map((n) => ({
              ...n,
              ...rotPoint({ x: n.x, y: n.y }),
              handleIn: n.handleIn ? rotPoint(n.handleIn) : null,
              handleOut: n.handleOut ? rotPoint(n.handleOut) : null,
            })),
          });
        }
        onChangeContours(contours.map((c) => updatedMap.get(c.id) || c));
        return;
      }

      // Handle Resizing (8 Handles: nw, n, ne, e, se, s, sw, w)
      const { minX, minY, maxX, maxY, width, height } = initialBBox;
      const safeW = Math.max(1, width);
      const safeH = Math.max(1, height);

      let snapX = pos.x;
      let snapY = pos.y;

      if (!e.altKey && (gridSettings.snapToGuides !== false || gridSettings.snapToGrid)) {
        const otherContours = contours.filter((c) => !selectedContourIds.includes(c.id));
        const snapThreshold = Math.max(7, Math.round(12 / zoom));
        const snapResult = snapSinglePoint(
          pos,
          otherContours,
          { lsb, advanceWidth, baseline: 800, ascender: 200, capHeight: 300, xHeight: 500, descender: 1000 },
          customGuidelines,
          snapThreshold,
          gridSettings
        );
        snapX = snapResult.point.x;
        snapY = snapResult.point.y;
        setActiveSnapGuides(snapResult.activeGuides);
      } else {
        setActiveSnapGuides([]);
      }

      let scaleX = 1;
      let scaleY = 1;
      let anchorX = minX;
      let anchorY = minY;

      const isPreserveAspect = e.shiftKey;

      switch (handle) {
        case 'se': {
          anchorX = minX;
          anchorY = minY;
          const newW = Math.max(8, snapX - minX);
          const newH = Math.max(8, snapY - minY);
          if (isPreserveAspect) {
            const s = Math.max(newW / safeW, newH / safeH);
            scaleX = s;
            scaleY = s;
          } else {
            scaleX = newW / safeW;
            scaleY = newH / safeH;
          }
          break;
        }
        case 'nw': {
          anchorX = maxX;
          anchorY = maxY;
          const newW = Math.max(8, maxX - snapX);
          const newH = Math.max(8, maxY - snapY);
          if (isPreserveAspect) {
            const s = Math.max(newW / safeW, newH / safeH);
            scaleX = s;
            scaleY = s;
          } else {
            scaleX = newW / safeW;
            scaleY = newH / safeH;
          }
          break;
        }
        case 'ne': {
          anchorX = minX;
          anchorY = maxY;
          const newW = Math.max(8, snapX - minX);
          const newH = Math.max(8, maxY - snapY);
          if (isPreserveAspect) {
            const s = Math.max(newW / safeW, newH / safeH);
            scaleX = s;
            scaleY = s;
          } else {
            scaleX = newW / safeW;
            scaleY = newH / safeH;
          }
          break;
        }
        case 'sw': {
          anchorX = maxX;
          anchorY = minY;
          const newW = Math.max(8, maxX - snapX);
          const newH = Math.max(8, snapY - minY);
          if (isPreserveAspect) {
            const s = Math.max(newW / safeW, newH / safeH);
            scaleX = s;
            scaleY = s;
          } else {
            scaleX = newW / safeW;
            scaleY = newH / safeH;
          }
          break;
        }
        case 'e': {
          anchorX = minX;
          anchorY = minY;
          const newW = Math.max(8, snapX - minX);
          scaleX = newW / safeW;
          scaleY = 1;
          break;
        }
        case 'w': {
          anchorX = maxX;
          anchorY = minY;
          const newW = Math.max(8, maxX - snapX);
          scaleX = newW / safeW;
          scaleY = 1;
          break;
        }
        case 's': {
          anchorX = minX;
          anchorY = minY;
          const newH = Math.max(8, snapY - minY);
          scaleX = 1;
          scaleY = newH / safeH;
          break;
        }
        case 'n': {
          anchorX = minX;
          anchorY = maxY;
          const newH = Math.max(8, maxY - snapY);
          scaleX = 1;
          scaleY = newH / safeH;
          break;
        }
      }

      const transformPoint = (p: Point): Point => {
        let nx = p.x;
        let ny = p.y;
        if (handle === 'nw' || handle === 'w' || handle === 'sw') {
          nx = anchorX - (anchorX - p.x) * scaleX;
        } else {
          nx = anchorX + (p.x - anchorX) * scaleX;
        }

        if (handle === 'nw' || handle === 'n' || handle === 'ne') {
          ny = anchorY - (anchorY - p.y) * scaleY;
        } else {
          ny = anchorY + (p.y - anchorY) * scaleY;
        }

        return { x: Math.round(nx), y: Math.round(ny) };
      };

      const updatedMap = new Map<string, PathContour>();
      for (const ic of initialContours) {
        updatedMap.set(ic.id, {
          ...ic,
          nodes: ic.nodes.map((n) => ({
            ...n,
            ...transformPoint({ x: n.x, y: n.y }),
            handleIn: n.handleIn ? transformPoint(n.handleIn) : null,
            handleOut: n.handleOut ? transformPoint(n.handleOut) : null,
          })),
        });
      }

      onChangeContours(contours.map((c) => updatedMap.get(c.id) || c));
      return;
    }

    // Eraser Tool continuous sweep-erase while dragging
    if (toolMode === 'eraser' && isErasingRef.current) {
      const eraseRadius = Math.max(8, (eraserSize / 2) / zoom);
      const updatedContours = eraseContoursAtPoint(contours, pos, eraseRadius, eraserMode);
      if (updatedContours.length !== contours.length || JSON.stringify(updatedContours) !== JSON.stringify(contours)) {
        erasedAnyInSessionRef.current = true;
        onChangeContours(updatedContours);
      }
      return;
    }

    // Brush drawing in-progress with smooth pressure tracking
    if (toolMode === 'brush' && brushStrokePointsRef.current.length > 0) {
      const isPen = e.pointerType === 'pen';
      if (isPen && !isStylusActive) {
        setIsStylusActive(true);
      }

      // Straight Ruler Assist: When Shift is held or straight mode is ON, lock stroke to perfect 0°/45°/90° straight line
      if (e.shiftKey || brushStraightMode) {
        const p0 = brushStrokePointsRef.current[0];
        const subPos = screenToCanvas(e.clientX, e.clientY);
        const snapped = snapToStraightAngle(p0.x, p0.y, subPos.x, subPos.y);
        let endX = snapped.x;
        let endY = snapped.y;

        // Snap to custom guidelines if within 12px
        if (customGuidelines && customGuidelines.length > 0) {
          for (const guide of customGuidelines) {
            if (guide.type === 'h' && Math.abs(endY - guide.position) < 12) {
              endY = guide.position;
            } else if (guide.type === 'v' && Math.abs(endX - guide.position) < 12) {
              endX = guide.position;
            }
          }
        }

        let pres = 0.5;
        if (pressureSensitivity === 'off') {
          pres = 0.5;
        } else if (isPen) {
          pres = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
        }

        const pEnd: StrokePoint = {
          x: endX,
          y: endY,
          pressure: pres,
          time: e.timeStamp || Date.now(),
        };

        brushStrokePointsRef.current = generateStraightStrokePoints(p0, pEnd);

        if (brushRafIdRef.current == null) {
          brushRafIdRef.current = requestAnimationFrame(() => {
            brushRafIdRef.current = null;
            if (activeBrushPathRef.current && brushStrokePointsRef.current.length > 0) {
              const contour = getProcessedBrushContour(brushStrokePointsRef.current, false);
              const d = contoursToSvgPath([contour]);
              activeBrushPathRef.current.setAttribute('d', d);
            }
          });
        }
        return;
      }

      // Defer all non-straight brush drawing events to requestAnimationFrame!
      const rawEvents = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
      const eventsToProcess = rawEvents && rawEvents.length > 0 ? rawEvents : [e];

      for (let k = 0; k < eventsToProcess.length; k++) {
        const ev = eventsToProcess[k];
        pendingBrushEventsRef.current.push({
          clientX: ev.clientX,
          clientY: ev.clientY,
          pressure: ev.pressure,
          timeStamp: ev.timeStamp || Date.now(),
          pointerType: ev.pointerType,
        });
      }

      if (brushRafIdRef.current == null) {
        brushRafIdRef.current = requestAnimationFrame(() => {
          brushRafIdRef.current = null;
          if (pendingBrushEventsRef.current.length === 0) return;

          const events = pendingBrushEventsRef.current;
          pendingBrushEventsRef.current = [];

          let lastP = brushStrokePointsRef.current[brushStrokePointsRef.current.length - 1];
          let hasNewPoints = false;

          for (let k = 0; k < events.length; k++) {
            const ev = events[k];
            const subPos = screenToCanvas(ev.clientX, ev.clientY);

            // 距離が極小（2.0px未満）の重複サンプリングは補間に寄与せず計算爆発を招くため除外
            if (lastP) {
              const dx = subPos.x - lastP.x;
              const dy = subPos.y - lastP.y;
              if (dx * dx + dy * dy < 4.0) {
                continue;
              }
            }

            let rawPres = 0.5;
            if (pressureSensitivity === 'off') {
              rawPres = 0.5;
            } else if (ev.pointerType === 'pen') {
              rawPres = ev.pressure && ev.pressure > 0 ? ev.pressure : 0.2;
            } else if (ev.pressure && ev.pressure > 0 && ev.pressure !== 0.5) {
              rawPres = ev.pressure;
            } else {
              // Dynamic velocity estimation for mouse / touch finger drawing
              if (lastP && lastP.time) {
                const dt = Math.max(1, ev.timeStamp - lastP.time);
                const ds = Math.hypot(subPos.x - lastP.x, subPos.y - lastP.y);
                const speed = ds / dt;
                rawPres = Math.max(0.25, Math.min(0.9, 0.65 - speed * 0.12));
              }
            }

            // Responsive smoothing (80% new pressure, 20% previous to preserve dynamic flicks)
            const pres = pressureSensitivity === 'off' ? 0.5 : (lastP && typeof lastP.pressure === 'number' ? lastP.pressure * 0.2 + rawPres * 0.8 : rawPres);
            const ptItem: StrokePoint = { x: subPos.x, y: subPos.y, pressure: pres, time: ev.timeStamp };
            brushStrokePointsRef.current.push(ptItem);
            lastP = ptItem;
            hasNewPoints = true;
          }

          // 新規点が追加された場合のみパス再計算とDOM更新を行い、減速・停止時の無駄な再描画を回避
          if (hasNewPoints && activeBrushPathRef.current && brushStrokePointsRef.current.length > 0) {
            const contour = getProcessedBrushContour(brushStrokePointsRef.current, false);
            const d = contoursToSvgPath([contour]);
            activeBrushPathRef.current.setAttribute('d', d);
          }
        });
      }
      return;
    }

    // Shapes in-progress (RAF throttled for maximum smoothness)
    if (isShapeTool && shapeStartPoint) {
      setIsShiftLockRatio(e.shiftKey);
      setIsAltFromCenter(e.altKey);
      let snapPos = pos;
      if (!e.altKey && (gridSettings.snapToGuides !== false || gridSettings.snapToGrid)) {
        const snapResult = snapSinglePoint(
          pos,
          contours,
          { lsb, advanceWidth, baseline: 800, ascender: 200, capHeight: 300, xHeight: 500, descender: 1000 },
          customGuidelines,
          Math.max(7, Math.round(12 / zoom)),
          gridSettings
        );
        snapPos = snapResult.point;
        setActiveSnapGuides(snapResult.activeGuides);
      } else {
        setActiveSnapGuides([]);
      }
      if (shapeRafRef.current == null) {
        shapeRafRef.current = requestAnimationFrame(() => {
          shapeRafRef.current = null;
          setShapeCurrentPoint(snapPos);
        });
      }
      return;
    }

    // Pen tool hover rubber-band
    if (toolMode === 'pen' && activePenContour) {
      setPenMousePos(pos);
      // If dragging while creating node -> adjust handleOut
      if (selectedNodeId && selectedHandleType === 'handleOut') {
        const updatedNodes = activePenContour.nodes.map((node) => {
          if (node.id === selectedNodeId) {
            const dx = pos.x - node.x;
            const dy = pos.y - node.y;
            return {
              ...node,
              handleOut: { x: pos.x, y: pos.y },
              handleIn: { x: node.x - dx, y: node.y - dy },
              type: 'smooth' as const,
            };
          }
          return node;
        });
        setActivePenContour({ ...activePenContour, nodes: updatedNodes });
      }
      return;
    }

    // Select/Node Dragging
    if ((toolMode === 'select' || toolMode === 'node') && selectedContourId && selectedNodeId && selectedHandleType) {
      let snapPos = pos;

      if (selectedHandleType === 'node' && !e.altKey && (gridSettings.snapToGuides !== false || gridSettings.snapToGrid)) {
        const otherContours = contours.filter((c) => c.id !== selectedContourId);
        const snapThreshold = Math.max(7, Math.round(12 / zoom));
        const snapResult = snapSinglePoint(
          pos,
          otherContours,
          { lsb, advanceWidth, baseline: 800, ascender: 200, capHeight: 300, xHeight: 500, descender: 1000 },
          customGuidelines,
          snapThreshold,
          gridSettings
        );
        snapPos = snapResult.point;
        setActiveSnapGuides(snapResult.activeGuides);
      } else if (selectedHandleType === 'node') {
        setActiveSnapGuides([]);
      }

      const updatedContours = contours.map((contour) => {
        if (contour.id !== selectedContourId) return contour;

        return {
          ...contour,
          nodes: contour.nodes.map((node) => {
            if (node.id !== selectedNodeId) return node;

            if (selectedHandleType === 'node') {
              const dx = snapPos.x - node.x;
              const dy = snapPos.y - node.y;
              return {
                ...node,
                x: snapPos.x,
                y: snapPos.y,
                handleIn: node.handleIn ? { x: node.handleIn.x + dx, y: node.handleIn.y + dy } : null,
                handleOut: node.handleOut ? { x: node.handleOut.x + dx, y: node.handleOut.y + dy } : null,
              };
            } else if (selectedHandleType === 'handleOut') {
              return {
                ...node,
                handleOut: { x: pos.x, y: pos.y },
              };
            } else if (selectedHandleType === 'handleIn') {
              return {
                ...node,
                handleIn: { x: pos.x, y: pos.y },
              };
            }
            return node;
          }),
        };
      });

      pendingContoursRef.current = updatedContours;
      if (nodeDragRafRef.current == null) {
        nodeDragRafRef.current = requestAnimationFrame(() => {
          nodeDragRafRef.current = null;
          if (pendingContoursRef.current) {
            onChangeContours(pendingContoursRef.current);
          }
        });
      }
    }
  };

  // Helper to construct shape from 2 bounding drag points
  const getShapeContourFromPoints = (
    mode: ToolMode,
    p1: Point,
    p2: Point,
    options?: { shiftKey?: boolean; altKey?: boolean }
  ): PathContour => {
    let startX = p1.x;
    let startY = p1.y;
    let endX = p2.x;
    let endY = p2.y;

    const forceSquare =
      options?.shiftKey ||
      mode === 'square' ||
      mode === 'circle' ||
      isShiftLockRatio;

    // Alt: draw from center
    if (options?.altKey || isAltFromCenter) {
      const dx = Math.abs(endX - startX);
      const dy = Math.abs(endY - startY);
      const maxD = forceSquare ? Math.max(dx, dy) : 0;
      const rx = forceSquare ? maxD : dx;
      const ry = forceSquare ? maxD : dy;
      startX = p1.x - rx;
      startY = p1.y - ry;
      endX = p1.x + rx;
      endY = p1.y + ry;
    } else if (forceSquare) {
      // 1:1 Aspect Ratio Lock
      const dx = endX - startX;
      const dy = endY - startY;
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      endX = startX + (dx >= 0 ? side : -side);
      endY = startY + (dy >= 0 ? side : -side);
    }

    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);
    const width = Math.max(16, maxX - minX);
    const height = Math.max(16, maxY - minY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rx = width / 2;
    const ry = height / 2;

    switch (mode) {
      case 'rect':
      case 'square':
        return createRectContour(minX, minY, maxX, maxY);
      case 'rounded_rect':
        return createRoundedRectContour(cx, cy, width, height, Math.min(width, height) * 0.2);
      case 'ellipse':
      case 'circle':
        return createEllipseContour(cx, cy, rx, ry);
      case 'triangle':
        return createTriangleContour(cx, cy, width, height, 'up');
      case 'star':
        return createStarContour(cx, cy, Math.max(rx, ry), Math.max(rx, ry) * 0.42, 5);
      case 'heart':
        return createHeartContour(cx, cy, width, height);
      case 'sparkle':
        return createSparkleContour(cx, cy, Math.max(rx, ry), 0.22);
      case 'starburst':
        return createStarburstContour(cx, cy, Math.max(rx, ry), 0.45, 8);
      case 'diamond':
        return createDiamondContour(cx, cy, width, height);
      case 'polygon':
        return createHexagonContour(cx, cy, Math.max(rx, ry));
      case 'line': {
        let lEndX = p2.x;
        let lEndY = p2.y;
        if (options?.shiftKey || isShiftLockRatio) {
          const snapped = snapToStraightAngle(p1.x, p1.y, p2.x, p2.y);
          lEndX = snapped.x;
          lEndY = snapped.y;
        }
        return createLineContour(p1.x, p1.y, lEndX, lEndY, brushWidth || 32);
      }
      default:
        return createRectContour(minX, minY, maxX, maxY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    try {
      if (e.currentTarget?.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignored
    }
    const wasTouch = e.pointerType === 'touch';
    touchPointersRef.current.delete(e.pointerId);
    pointerTypesRef.current.delete(e.pointerId);
    setIsDrawingStroke(false);
    if (e.pointerType === 'pen') {
      isPenDrawingRef.current = false;
    }

    // Check for 2-finger tap (Undo) or 3-finger tap (Redo) when all fingers leave screen
    if (wasTouch && touchPointersRef.current.size === 0) {
      const duration = Date.now() - touchStartTimeRef.current;
      const touchCount = maxTouchCountRef.current;
      const didNotMove = !hasMovedSignificantRef.current;

      // Reset gesture tracking
      maxTouchCountRef.current = 0;
      hasMovedSignificantRef.current = false;

      if (duration < 380 && didNotMove) {
        if (touchCount === 2) {
          if (onUndo) {
            onUndo();
            showCanvasToast('↺ 2本指タップ: 元に戻す');
            return;
          }
        } else if (touchCount === 3) {
          if (onRedo) {
            onRedo();
            showCanvasToast('↻ 3本指タップ: やり直し');
            return;
          }
        }
      }
    }

    // If we were in a two-finger gesture, do not commit any drawing or shape actions
    if (isTwoFingerGestureRef.current) {
      if (touchPointersRef.current.size === 0) {
        isTwoFingerGestureRef.current = false;
        initialPinchDistRef.current = null;
        initialPinchCenterRef.current = null;
      }
      return;
    }

    if (touchPointersRef.current.size < 2) {
      initialPinchDistRef.current = null;
      initialPinchCenterRef.current = null;
    }

    // Always clear active snap guidelines when releasing pointer
    setActiveSnapGuides([]);

    // Finalize Marquee Selection Box
    if (marqueeSelection) {
      const minX = Math.min(marqueeSelection.start.x, marqueeSelection.current.x);
      const maxX = Math.max(marqueeSelection.start.x, marqueeSelection.current.x);
      const minY = Math.min(marqueeSelection.start.y, marqueeSelection.current.y);
      const maxY = Math.max(marqueeSelection.start.y, marqueeSelection.current.y);
      if (Math.hypot(maxX - minX, maxY - minY) > 10) {
        const intersecting = contours.filter((c) => {
          const b = getContoursBoundingBox([c]);
          return !(b.maxX < minX || b.minX > maxX || b.maxY < minY || b.minY > maxY);
        });
        if (intersecting.length > 0) {
          const newIds = intersecting.map((c) => c.id);
          setSelectedContourIds((prev) =>
            e.shiftKey ? [...new Set([...prev, ...newIds])] : newIds
          );
          showCanvasToast(`${intersecting.length}個のパスを選択しました`);
        }
      }
      setMarqueeSelection(null);
    }

    if (isDraggingTrace) {
      setIsDraggingTrace(false);
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (draggingMetric) {
      setDraggingMetric(null);
      onCommitHistory();
      return;
    }

    if (draggingGuidelineId) {
      setDraggingGuidelineId(null);
      return;
    }

    // Finalize Ruler Measurement Drag
    if (toolMode === 'ruler' && rulerMeasurement && rulerMeasurement.active) {
      if (rulerMode === 'draw') {
        const dist = Math.hypot(rulerMeasurement.end.x - rulerMeasurement.start.x, rulerMeasurement.end.y - rulerMeasurement.start.y);
        if (dist >= 6) {
          const { start, end } = rulerMeasurement;
          const strokeContour = createLineContour(
            start.x,
            start.y,
            end.x,
            end.y,
            brushWidth || 32
          );
          onChangeContours([...contours, strokeContour]);
          onCommitHistory();
          setRulerMeasurement(null);
          showCanvasToast('定規で直線を引きました', `長さ: ${Math.round(dist)}px / 太さ: ${brushWidth || 32}px`);
          return;
        }
      }
      setRulerMeasurement({
        ...rulerMeasurement,
        active: false,
      });
      return;
    }

    // Finalize Eraser Tool sweep session
    if (toolMode === 'eraser' && isErasingRef.current) {
      isErasingRef.current = false;
      if (erasedAnyInSessionRef.current) {
        erasedAnyInSessionRef.current = false;
        onCommitHistory();
      }
      return;
    }

    // Finalize Brush Stroke into Smooth Vector Contour
    if (toolMode === 'brush' && (brushStrokePointsRef.current.length > 0 || pendingBrushEventsRef.current.length > 0)) {
      if (pendingBrushEventsRef.current.length > 0) {
        const events = pendingBrushEventsRef.current;
        pendingBrushEventsRef.current = [];

        let lastP = brushStrokePointsRef.current[brushStrokePointsRef.current.length - 1];

        for (let k = 0; k < events.length; k++) {
          const ev = events[k];
          const subPos = screenToCanvas(ev.clientX, ev.clientY);

          // 距離が極小（2.0px未満）の重複サンプリングは除外
          if (lastP) {
            const dx = subPos.x - lastP.x;
            const dy = subPos.y - lastP.y;
            if (dx * dx + dy * dy < 4.0) {
              continue;
            }
          }

          let rawPres = 0.5;
          if (pressureSensitivity === 'off') {
            rawPres = 0.5;
          } else if (ev.pointerType === 'pen') {
            rawPres = ev.pressure && ev.pressure > 0 ? ev.pressure : 0.2;
          } else if (ev.pressure && ev.pressure > 0 && ev.pressure !== 0.5) {
            rawPres = ev.pressure;
          } else {
            if (lastP && lastP.time) {
              const dt = Math.max(1, ev.timeStamp - lastP.time);
              const ds = Math.hypot(subPos.x - lastP.x, subPos.y - lastP.y);
              const speed = ds / dt;
              rawPres = Math.max(0.25, Math.min(0.9, 0.65 - speed * 0.12));
            }
          }

          // Responsive smoothing (80% new pressure, 20% previous to preserve dynamic flicks)
          const pres = pressureSensitivity === 'off' ? 0.5 : (lastP && typeof lastP.pressure === 'number' ? lastP.pressure * 0.2 + rawPres * 0.8 : rawPres);
          const ptItem: StrokePoint = { x: subPos.x, y: subPos.y, pressure: pres, time: ev.timeStamp };
          brushStrokePointsRef.current.push(ptItem);
          lastP = ptItem;
        }
      }

      if (brushRafIdRef.current != null) {
        cancelAnimationFrame(brushRafIdRef.current);
        brushRafIdRef.current = null;
      }
      if (activeBrushPathRef.current) {
        activeBrushPathRef.current.setAttribute('d', '');
      }
      const pts = brushStrokePointsRef.current;
      brushStrokePointsRef.current = [];

      // 終端付近の微細ブレ（スタイラス離脱時の微小変位）をトリミングし、滑らかな終端形状を確保
      while (pts.length > 2) {
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const dx = last.x - prev.x;
        const dy = last.y - prev.y;
        if (dx * dx + dy * dy < 2.25) { // < 1.5px
          pts.pop();
        } else {
          break;
        }
      }

      if (pts.length > 0) {
        let finalizedContour = getProcessedBrushContour(pts, true);

        // 一筆書きの自己交差・ループ重なりによる白抜きを自動解消（ブーリアン融解）
        if (autoResolveBrushOverlap) {
          try {
            if (hasContourIntersections([finalizedContour])) {
              const selfMerged = unionContours([finalizedContour], 1.2, true);
              if (selfMerged && selfMerged.length > 0) {
                if (selfMerged.length === 1) {
                  finalizedContour = selfMerged[0];
                } else {
                  // ループにより複数の外輪郭/内輪郭に分割された場合
                  if (autoUnionBrush && contours.length > 0) {
                    const merged = unionContours([...contours, ...selfMerged], 1.2, true);
                    if (merged && merged.length > 0) {
                      onChangeContours(merged);
                      onCommitHistory();
                      return;
                    }
                  }
                  onChangeContours([...contours, ...selfMerged]);
                  onCommitHistory();
                  return;
                }
              }
            }
          } catch (err) {
            console.warn('Auto resolve brush overlap fallback:', err);
          }
        }

        if (autoUnionBrush && contours.length > 0) {
          const merged = unionContours([...contours, finalizedContour], 1.2, true);
          if (merged && merged.length > 0) {
            onChangeContours(merged);
          } else {
            onChangeContours([...contours, finalizedContour]);
          }
        } else {
          onChangeContours([...contours, finalizedContour]);
        }
        lastBrushPointRef.current = {
          x: pts[pts.length - 1].x,
          y: pts[pts.length - 1].y,
          time: Date.now(),
        };
        onCommitHistory();
      }
      return;
    }

    // Finalize Geometric Shape
    if (isShapeTool && shapeStartPoint && shapeCurrentPoint) {
      if (shapeRafRef.current != null) {
        cancelAnimationFrame(shapeRafRef.current);
        shapeRafRef.current = null;
      }
      const dist = Math.hypot(
        shapeCurrentPoint.x - shapeStartPoint.x,
        shapeCurrentPoint.y - shapeStartPoint.y
      );
      // If clicked without dragging, stamp a balanced 180x180 shape centered at click position!
      const p1 =
        dist < 10
          ? { x: shapeStartPoint.x - 90, y: shapeStartPoint.y - 90 }
          : shapeStartPoint;
      const p2 =
        dist < 10
          ? { x: shapeStartPoint.x + 90, y: shapeStartPoint.y + 90 }
          : shapeCurrentPoint;

      const newContour = getShapeContourFromPoints(toolMode, p1, p2, {
        shiftKey: e.shiftKey,
        altKey: e.altKey,
      });
      onChangeContours([...contours, newContour]);
      setSelectedContourId(newContour.id);
      setShapeStartPoint(null);
      setShapeCurrentPoint(null);
      setIsShiftLockRatio(false);
      setIsAltFromCenter(false);
      onCommitHistory();
      return;
    }

    // Finalize Node Drag
    if ((toolMode === 'select' || toolMode === 'node') && selectedHandleType) {
      if (nodeDragRafRef.current != null) {
        cancelAnimationFrame(nodeDragRafRef.current);
        nodeDragRafRef.current = null;
      }
      if (pendingContoursRef.current) {
        onChangeContours(pendingContoursRef.current);
        pendingContoursRef.current = null;
      }
      setSelectedHandleType(null);
      onCommitHistory();
    }

    // Finalize Bounding Box Transform Drag
    if (transformSession) {
      setTransformSession(null);
      setRotateDisplayAngle(null);
      onCommitHistory();
    }
  };

  const handlePointerLeave = () => {
    setIsDrawingStroke(false);
    if (hoverRafRef.current != null) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    setHoverCanvasPos(null);
  };

  // Keyboard Shortcuts: Delete node/contour, Undo path point, Reset path, Enter to finalize, Toggle nodes, Space to pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetEl = e.target as HTMLElement;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetEl?.tagName) ||
        targetEl?.isContentEditable ||
        isAnyModalOpen
      ) {
        return;
      }

      // Spacebar temporary Pan/Hand activation
      if (e.code === 'Space' || e.key === ' ') {
        if (!e.repeat) {
          setIsSpacePressed(true);
        }
        e.preventDefault();
        return;
      }

      // Ctrl+A / Cmd+A: Select all contours in select or node mode
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (toolMode === 'select' || toolMode === 'node') {
          e.preventDefault();
          setSelectedContourIds(contours.map((c) => c.id));
          showCanvasToast(`すべてのパス (${contours.length}個) を選択しました`);
          return;
        }
      }

      // Ctrl+Z / Cmd+Z while actively drawing path -> Undo last node
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (activePenContour && activePenContour.nodes.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          handleUndoPenNode();
          return;
        }
      }

      // ESC: Reset/Discard in-progress path, or deselect
      if (e.key === 'Escape') {
        if (activePenContour) {
          e.preventDefault();
          handleResetPenContour();
        } else if (selectedContourIds.length > 0) {
          setSelectedContourIds([]);
          setSelectedNodeId(null);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // While drawing pen path -> Backspace/Delete undos the last placed node!
        if (activePenContour) {
          e.preventDefault();
          handleUndoPenNode();
        } else if (selectedContourIds.length === 1 && selectedNodeId) {
          e.preventDefault();
          const targetId = selectedContourIds[0];
          const updated = contours
            .map((contour) => {
              if (contour.id !== targetId) return contour;
              const filteredNodes = contour.nodes.filter((n) => n.id !== selectedNodeId);
              return { ...contour, nodes: filteredNodes };
            })
            .filter((c) => c.nodes.length > 0);
          onChangeContours(updated);
          setSelectedNodeId(null);
          onCommitHistory();
        } else if (selectedContourIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (e.key === '[' || e.key === ']') {
        if (toolMode === 'eraser') {
          e.preventDefault();
          setEraserSize((prev) => {
            const delta = e.key === ']' ? (prev >= 60 ? 10 : 4) : (prev > 60 ? -10 : -4);
            const next = Math.max(8, Math.min(160, prev + delta));
            return next;
          });
        }
      } else if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setShowNodes((prev) => !prev);
      } else if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey && activePenContour) {
        // Pressing 'c' while drawing pen path closes and commits the contour
        e.preventDefault();
        handleFinishPenContour(true);
      } else if (e.shiftKey && e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleSmoothStrokeSelected();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        // If ruler measurement is present, Enter draws a straight line contour along the ruler
        if (toolMode === 'ruler' && rulerMeasurement) {
          handleDrawRulerAsStroke();
          return;
        }
        // If actively drawing a path, Enter finalizes the line
        if (activePenContour) {
          handleFinishPenContour(false);
        } else if (e.shiftKey) {
          onSelectPrevGlyph?.();
        } else {
          onSelectNextGlyph?.();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        setIsSpacePressed(false);
      }
    };

    const handleWindowBlur = () => {
      setIsSpacePressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [
    activePenContour,
    contours,
    onChangeContours,
    selectedContourIds,
    selectedNodeId,
    toolMode,
    rulerMeasurement,
    handleDrawRulerAsStroke,
    onCommitHistory,
    onSelectPrevGlyph,
    onSelectNextGlyph,
    smoothStrength,
    smoothPreserveCorners,
    handleUndoPenNode,
    handleResetPenContour,
    handleFinishPenContour,
    isAnyModalOpen,
  ]);

  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(3.0, z * 1.25));
  const handleZoomOut = () => setZoom((z) => Math.max(0.2, z * 0.8));
  const handleResetZoom = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const idealZoom = Math.min((rect.width - 60) / 1000, (rect.height - 60) / 1000, 0.7);
      setZoom(idealZoom);
      setPan({
        x: (rect.width - 1000 * idealZoom) / 2,
        y: (rect.height - 1000 * idealZoom) / 2,
      });
    }
  };

  // Transform operations for active selection (single or batch)
  const handleSlantSelected = (angleDeg: number) => {
    if (selectedContourIds.length === 0) return;
    const updated = contours.map((c) =>
      selectedContourIds.includes(c.id) ? slantSingleContour(c, angleDeg) : c
    );
    onChangeContours(updated);
    onCommitHistory();
  };

  const handleRotateSelected = (angleDeg: number) => {
    if (selectedContourIds.length === 0) return;
    if (selectedContourIds.length === 1) {
      const updated = contours.map((c) =>
        selectedContourIds.includes(c.id) ? rotateSingleContour(c, angleDeg) : c
      );
      onChangeContours(updated);
    } else {
      const selected = contours.filter((c) => selectedContourIds.includes(c.id));
      const rotated = rotateMultipleContours(selected, angleDeg);
      const rotatedMap = new Map(rotated.map((c) => [c.id, c]));
      onChangeContours(contours.map((c) => rotatedMap.get(c.id) || c));
    }
    onCommitHistory();
  };

  const handleScaleSelected = (factor: number) => {
    if (selectedContourIds.length === 0) return;
    if (selectedContourIds.length === 1) {
      const updated = contours.map((c) =>
        selectedContourIds.includes(c.id) ? scaleSingleContour(c, factor, factor) : c
      );
      onChangeContours(updated);
    } else {
      const selected = contours.filter((c) => selectedContourIds.includes(c.id));
      const scaled = scaleMultipleContours(selected, factor, factor);
      const scaledMap = new Map(scaled.map((c) => [c.id, c]));
      onChangeContours(contours.map((c) => scaledMap.get(c.id) || c));
    }
    onCommitHistory();
  };

  const handleFlipHSelected = () => {
    if (selectedContourIds.length === 0) return;
    if (selectedContourIds.length === 1) {
      const updated = contours.map((c) =>
        selectedContourIds.includes(c.id) ? flipSingleContourH(c) : c
      );
      onChangeContours(updated);
    } else {
      const selected = contours.filter((c) => selectedContourIds.includes(c.id));
      const flipped = flipMultipleContoursH(selected);
      const flippedMap = new Map(flipped.map((c) => [c.id, c]));
      onChangeContours(contours.map((c) => flippedMap.get(c.id) || c));
    }
    onCommitHistory();
  };

  const handleFlipVSelected = () => {
    if (selectedContourIds.length === 0) return;
    if (selectedContourIds.length === 1) {
      const updated = contours.map((c) =>
        selectedContourIds.includes(c.id) ? flipSingleContourV(c) : c
      );
      onChangeContours(updated);
    } else {
      const selected = contours.filter((c) => selectedContourIds.includes(c.id));
      const flipped = flipMultipleContoursV(selected);
      const flippedMap = new Map(flipped.map((c) => [c.id, c]));
      onChangeContours(contours.map((c) => flippedMap.get(c.id) || c));
    }
    onCommitHistory();
  };

  const handleDuplicateSelected = () => {
    if (selectedContourIds.length === 0) return;
    if (selectedContourIds.length === 1) {
      const target = contours.find((c) => c.id === selectedContourIds[0]);
      if (!target) return;
      const dup = duplicateContour(target, 40, 40);
      onChangeContours([...contours, dup]);
      setSelectedContourIds([dup.id]);
    } else {
      const selected = contours.filter((c) => selectedContourIds.includes(c.id));
      const dups = duplicateMultipleContours(selected, 40, 40);
      onChangeContours([...contours, ...dups]);
      setSelectedContourIds(dups.map((d) => d.id));
    }
    onCommitHistory();
  };

  const handleDeleteSelected = () => {
    if (selectedContourIds.length === 0) return;
    onChangeContours(contours.filter((c) => !selectedContourIds.includes(c.id)));
    setSelectedContourIds([]);
    setSelectedNodeId(null);
    onCommitHistory();
  };

  // Merge / Union selected contours into a single path or resolve single-stroke cursive overlaps
  const handleMergeSelectedContours = () => {
    const isExplicit = selectedContourIds.length > 0;
    const targets = isExplicit
      ? contours.filter((c) => selectedContourIds.includes(c.id))
      : contours;

    if (targets.length === 0) {
      showCanvasToast('対象となる輪郭がありません');
      return;
    }

    const merged = unionContours(targets, 1.2, true);
    if (merged.length === 0) {
      showCanvasToast('重なり白抜き解消に失敗しました');
      return;
    }

    const otherContours = isExplicit
      ? contours.filter((c) => !selectedContourIds.includes(c.id))
      : [];
    const newContours = [...otherContours, ...merged];
    onChangeContours(newContours);
    setSelectedContourIds(merged.map((m) => m.id));
    onCommitHistory();

    if (targets.length === 1) {
      showCanvasToast(
        '一筆書きの交差・重なり白抜きを解消しました',
        '交差ループが融解され、滑らかな単一輪郭になりました'
      );
    } else {
      showCanvasToast(
        `${targets.length}個のパスを結合し、白抜きを解消しました`,
        `重なりが結合され、${merged.length}個の輪郭になりました`
      );
    }
  };

  // Reverse / Flip Winding Order (時計回り ⇄ 反時計回り) to fix transparent overlaps or create holes
  const handleReverseWindingSelected = () => {
    if (selectedContourIds.length === 0) return;
    const updated = contours.map((c) => {
      if (!selectedContourIds.includes(c.id)) return c;
      return reverseContour(c);
    });
    onChangeContours(updated);
    onCommitHistory();
    showCanvasToast(
      '輪郭の向き（回転方向）を反転しました',
      '重なりが白抜き/黒塗りに反転します'
    );
  };

  const handleClearAll = () => {
    if (contours.length === 0) return;
    onChangeContours([]);
    setSelectedContourIds([]);
    setSelectedNodeId(null);
    onCommitHistory();
  };

  // Shape-Preserving Stroke Smoothing & Anchor Point Reduction
  const handleSmoothStrokeSelected = (
    level: 'mild' | 'standard' | 'strong' = smoothStrength,
    preserveCorners: boolean = smoothPreserveCorners
  ) => {
    if (selectedContourIds.length === 0) {
      handleSmoothStrokeAll(level, preserveCorners);
      return;
    }
    const updated = contours.map((c) => {
      if (!selectedContourIds.includes(c.id)) return c;
      return smoothStrokeContour(c, { level, preserveCorners }).contour;
    });
    onChangeContours(updated);
    onCommitHistory();

    const levelName = level === 'mild' ? 'マイルド' : level === 'strong' ? '強力' : '標準';
    showCanvasToast(
      `選択パスを平滑化 (${levelName})`,
      `${selectedContourIds.length}個のパスを美化・アンカーポイント最適化完了`
    );
  };

  const handleSmoothStrokeAll = (
    level: 'mild' | 'standard' | 'strong' = smoothStrength,
    preserveCorners: boolean = smoothPreserveCorners
  ) => {
    if (contours.length === 0) return;
    const result = smoothContoursPreservingShape(contours, { level, preserveCorners });
    onChangeContours(result.contours);
    onCommitHistory();

    const levelName = level === 'mild' ? 'マイルド' : level === 'strong' ? '強力' : '標準';
    showCanvasToast(
      `全ストロークを一括平滑化 (${levelName})`,
      `全パーツ合計: ${result.totalOriginalPoints}点 → ${result.totalReducedPoints}点 (-${result.totalReductionPercent}% 削減)`
    );
  };

  // Path Simplification & Curvature Conversions
  const handleSimplifyAll = (tolerance: number = 6) => {
    if (contours.length === 0) return;
    const simplified = contours.map((c) => simplifyContour(c, tolerance));
    onChangeContours(simplified);
    onCommitHistory();
  };

  const handleSimplifySelected = (tolerance: number = 6) => {
    if (selectedContourIds.length === 0) return;
    const updated = contours.map((c) =>
      selectedContourIds.includes(c.id) ? simplifyContour(c, tolerance) : c
    );
    onChangeContours(updated);
    onCommitHistory();
  };

  const handleConvertToCornersSelected = () => {
    if (selectedContourIds.length === 0) return;
    const updated = contours.map((c) =>
      selectedContourIds.includes(c.id) ? convertContourToCorners(c) : c
    );
    onChangeContours(updated);
    onCommitHistory();
  };

  const handleConvertToSmoothSelected = () => {
    if (selectedContourIds.length === 0) return;
    const updated = contours.map((c) =>
      selectedContourIds.includes(c.id) ? convertContourToSmooth(c) : c
    );
    onChangeContours(updated);
    onCommitHistory();
  };

  const handleToggleClosedSelected = () => {
    if (selectedContourIds.length === 0) return;
    const updated = contours.map((c) =>
      selectedContourIds.includes(c.id) ? { ...c, closed: !c.closed } : c
    );
    onChangeContours(updated);
    onCommitHistory();
  };

  const handleAddNodeToSelected = () => {
    if (!selectedContourId) return;
    const target = contours.find((c) => c.id === selectedContourId);
    if (!target || target.nodes.length < 2) return;
    let idx = target.nodes.findIndex((n) => n.id === selectedNodeId);
    if (idx === -1) idx = 0;
    const nextIdx = (idx + 1) % target.nodes.length;
    const n1 = target.nodes[idx];
    const n2 = target.nodes[nextIdx];

    const newNode: BezierNode = {
      id: generateId(),
      x: Math.round((n1.x + n2.x) / 2),
      y: Math.round((n1.y + n2.y) / 2),
      type: n1.type || 'smooth',
    };

    const newNodes = [...target.nodes];
    newNodes.splice(idx + 1, 0, newNode);
    const updated = { ...target, nodes: newNodes };
    onChangeContours(contours.map((c) => (c.id === selectedContourId ? updated : c)));
    setSelectedNodeId(newNode.id);
    onCommitHistory();
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedContourId || !selectedNodeId) return;
    const target = contours.find((c) => c.id === selectedContourId);
    if (!target) return;
    if (target.nodes.length <= 2) {
      handleDeleteSelected();
      return;
    }
    const newNodes = target.nodes.filter((n) => n.id !== selectedNodeId);
    const updated = { ...target, nodes: newNodes };
    onChangeContours(contours.map((c) => (c.id === selectedContourId ? updated : c)));
    setSelectedNodeId(null);
    onCommitHistory();
  };

  const handleToggleNodeType = (contourId: string, nodeId: string) => {
    const target = contours.find((c) => c.id === contourId);
    if (!target) return;
    const newNodes = target.nodes.map((n) => {
      if (n.id === nodeId) {
        return toggleNodeType(n);
      }
      return n;
    });
    const updated = { ...target, nodes: newNodes };
    onChangeContours(contours.map((c) => (c.id === contourId ? updated : c)));
    onCommitHistory();
    showCanvasToast('ノード種別を切り替えました');
  };

  // Memoized SVG Paths so panning, zooming, and tool switching do not recalculate complex curves
  const mainSvgPath = useMemo(() => {
    if (!contours || contours.length === 0) return '';
    return contoursToSvgPath(normalizeGlyphContoursWinding(contours));
  }, [contours]);
  const penSvgPath = useMemo(
    () => (activePenContour ? contoursToSvgPath([activePenContour]) : ''),
    [activePenContour]
  );
  const contourSvgMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contours) {
      map.set(c.id, getCachedContourSvgPath(c));
    }
    return map;
  }, [contours]);

  const selContours = useMemo(
    () => contours.filter((c) => selectedContourIds.includes(c.id) && c.nodes.length > 0),
    [contours, selectedContourIds]
  );
  const selectedContoursSvgPath = useMemo(
    () => (selContours.length > 0 ? contoursToSvgPath(selContours) : ''),
    [selContours]
  );
  const selContoursBBox = useMemo(
    () => (selContours.length > 0 ? getContoursBoundingBox(selContours) : null),
    [selContours]
  );

  // Callbacks for memoized layer interactions
  const handlePointerDownTraceImage = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      setIsDraggingTrace(true);
      traceDragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        initOffsetX: traceSettings.offsetX,
        initOffsetY: traceSettings.offsetY,
      };
    },
    [traceSettings.offsetX, traceSettings.offsetY]
  );

  const handlePointerDownGuide = useCallback(
    (e: React.PointerEvent, guideId: string) => {
      if (
        lockGuidelines ||
        toolMode === 'brush' ||
        toolMode === 'pen' ||
        toolMode === 'eraser' ||
        isShapeTool
      ) {
        return;
      }
      e.stopPropagation();
      setDraggingGuidelineId(guideId);
    },
    [lockGuidelines, toolMode, isShapeTool]
  );

  const handleDoubleClickGuide = useCallback(
    (e: React.MouseEvent, guideId: string) => {
      if (
        lockGuidelines ||
        toolMode === 'brush' ||
        toolMode === 'pen' ||
        toolMode === 'eraser' ||
        isShapeTool
      ) {
        return;
      }
      e.stopPropagation();
      setCustomGuidelines((prev) => prev.filter((g) => g.id !== guideId));
    },
    [lockGuidelines, toolMode, isShapeTool]
  );

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden select-none bg-stone-100 dark:bg-[#0c120e]">
      {/* Universal Docked Sub-Toolbar (Outside SVG viewport, clean & non-overlapping) */}
      {!isMobileFocusMode && (
        <div
          className={`h-11 border-b flex items-center justify-between px-2.5 sm:px-3 shrink-0 z-20 select-none overflow-x-auto no-scrollbar gap-2 transition-colors ${
            isLight
              ? 'bg-white border-[#d8e6df] text-stone-800'
              : 'bg-[#121c15] border-[#25362b] text-emerald-100'
          }`}
        >
          {/* Left: Quick Character Switcher & Context Tool Settings */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {onSelectPrevGlyph && (
              <button
                onClick={onSelectPrevGlyph}
                className="p-1.5 rounded hover:bg-emerald-100/70 dark:hover:bg-[#1e2d23] text-stone-600 dark:text-emerald-300 transition-colors"
                title="前の文字 (Shift+Enter)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300/80 dark:border-emerald-700 font-bold text-xs">
              <span className="text-emerald-950 dark:text-emerald-200 font-sans mr-1.5 text-sm">{activeChar}</span>
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                U+{selectedUnicode?.toString(16).toUpperCase().padStart(4, '0')}
              </span>
            </div>
            {onSelectNextGlyph && (
              <button
                onClick={onSelectNextGlyph}
                className="p-1.5 rounded hover:bg-emerald-100/70 dark:hover:bg-[#1e2d23] text-stone-600 dark:text-emerald-300 transition-colors"
                title="次の文字 (Enter)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {/* Quick Dakuten / Handakuten button if Kana */}
            {(() => {
              const dInfo = DAKUTEN_MAPPINGS[activeChar];
              if (!dInfo) return null;
              return (
                <div className="flex items-center space-x-1 ml-1">
                  {dInfo.type === 'seion' && dInfo.daku && onGenerateDakutenTarget && (
                    <button
                      onClick={() => {
                        onGenerateDakutenTarget(dInfo.daku!, false);
                        showCanvasToast(`濁音「${dInfo.daku}」を自動生成しました！`);
                      }}
                      className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[10.5px] font-bold whitespace-nowrap hover:bg-amber-200 transition-colors"
                      title={`濁音「${dInfo.daku}」を自動合成`}
                    >
                      ＋濁点「{dInfo.daku}」
                    </button>
                  )}
                  {dInfo.type === 'seion' && dInfo.handaku && onGenerateDakutenTarget && (
                    <button
                      onClick={() => {
                        onGenerateDakutenTarget(dInfo.handaku!, true);
                        showCanvasToast(`半濁音「${dInfo.handaku}」を自動生成しました！`);
                      }}
                      className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200 text-[10.5px] font-bold whitespace-nowrap hover:bg-rose-200 transition-colors"
                      title={`半濁音「${dInfo.handaku}」を自動合成`}
                    >
                      ＋半濁点「{dInfo.handaku}」
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Brush Tool Options in Header */}
            {toolMode === 'brush' && (
              <>
                {/* Mobile Brush Presets Sheet Trigger */}
                <button
                  onClick={() => setShowMobileBrushSheet(true)}
                  className="sm:hidden px-2 py-1 rounded text-xs font-bold border transition-colors flex items-center space-x-1 bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 shadow-xs shrink-0"
                  title="ペンの種類と太さを設定"
                >
                  <Paintbrush className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                  <span>{PEN_PRESETS.find((p) => p.id === brushStyle)?.name || 'ペン'}</span>
                  <span className="font-mono text-[10px]">({brushWidth}px)</span>
                </button>

                {/* Desktop Rich Brush Studio Controls */}
                <div className="hidden sm:flex items-center space-x-1.5 ml-1 pl-1.5 border-l border-stone-200 dark:border-stone-700 overflow-x-auto no-scrollbar">
                  {/* Quick Pen Preset Chips */}
                  <div className="flex items-center space-x-0.5 bg-stone-100 dark:bg-[#18231c] p-0.5 rounded-lg border border-stone-200 dark:border-stone-700">
                    {[
                      { id: 'brush', name: '毛筆', icon: '🖌️' },
                      { id: 'felt_tip', name: 'サインペン', icon: '🖊️' },
                      { id: 'fountain', name: '万年筆', icon: '✒️' },
                      { id: 'marker_round', name: 'マーカー', icon: '🖍️' },
                      { id: 'ballpoint', name: 'ボールペン', icon: '🖋️' },
                      { id: 'pencil', name: '鉛筆', icon: '✏️' },
                      { id: 'sharp', name: '角筆', icon: '⬛' },
                    ].map((pen) => {
                      const isActive = brushStyle === pen.id;
                      return (
                        <button
                          key={pen.id}
                          onClick={() => {
                            if (onChangeBrushStyle) onChangeBrushStyle(pen.id as BrushStyle);
                            const preset = PEN_PRESETS.find((p) => p.id === pen.id);
                            if (preset && preset.defaultWidth && onChangeBrushWidth) {
                              onChangeBrushWidth(preset.defaultWidth);
                            }
                            showCanvasToast(`ペンを「${pen.name}」に変更しました`);
                          }}
                          className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center space-x-1 transition-all ${
                            isActive
                              ? isLight
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'bg-emerald-600 text-white shadow-xs'
                              : isLight
                              ? 'text-stone-700 hover:bg-stone-200/80 hover:text-stone-900'
                              : 'text-stone-300 hover:bg-[#202e24] hover:text-emerald-200'
                          }`}
                          title={`${pen.name}に切り替え`}
                        >
                          <span className="text-[10px]">{pen.icon}</span>
                          <span>{pen.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* All Pens Dropdown */}
                  {onChangeBrushStyle && (
                    <select
                      value={brushStyle}
                      onChange={(e) => {
                        const newStyle = e.target.value as BrushStyle;
                        onChangeBrushStyle(newStyle);
                        const preset = PEN_PRESETS.find((p) => p.id === newStyle);
                        if (preset && preset.defaultWidth && onChangeBrushWidth) {
                          onChangeBrushWidth(preset.defaultWidth);
                        }
                      }}
                      className={`text-xs font-bold px-1.5 py-1 rounded border transition-colors cursor-pointer outline-none ${
                        isLight
                          ? 'bg-stone-50 border-stone-300 text-stone-800 focus:border-emerald-600'
                          : 'bg-[#18231c] border-[#25382c] text-emerald-200 focus:border-emerald-500'
                      }`}
                      title="その他全ペンスタイル一覧"
                    >
                      {PEN_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Quick Width Presets */}
                  {onChangeBrushWidth && (
                    <div className="flex items-center gap-1">
                      <div className="flex items-center space-x-0.5 bg-stone-100 dark:bg-[#18231c] p-0.5 rounded-lg border border-stone-200 dark:border-stone-700">
                        {[15, 30, 50, 80].map((w) => (
                          <button
                            key={w}
                            onClick={() => {
                              onChangeBrushWidth(w);
                              showCanvasToast(`太さを ${w}px に設定しました`);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold transition-all ${
                              brushWidth === w
                                ? isLight
                                  ? 'bg-emerald-700 text-white shadow-xs'
                                  : 'bg-emerald-600 text-white shadow-xs'
                                : isLight
                                ? 'text-stone-600 hover:bg-stone-200'
                                : 'text-stone-400 hover:bg-[#202e24] text-emerald-300'
                            }`}
                            title={`太さ ${w}px`}
                          >
                            {w}px
                          </button>
                        ))}
                      </div>

                      {/* Width Stepper */}
                      <div className="flex items-center gap-0.5 bg-stone-100 dark:bg-[#18231c] px-1.5 py-0.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs">
                        <button
                          onClick={() => onChangeBrushWidth(Math.max(4, brushWidth - 4))}
                          className="px-1 py-0.5 font-bold hover:bg-stone-200 dark:hover:bg-stone-700 rounded text-stone-600 dark:text-stone-300"
                          title="線を細く"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold px-1 min-w-[32px] text-center">{brushWidth}px</span>
                        <button
                          onClick={() => onChangeBrushWidth(Math.min(150, brushWidth + 4))}
                          className="px-1 py-0.5 font-bold hover:bg-stone-200 dark:hover:bg-stone-700 rounded text-stone-600 dark:text-stone-300"
                          title="線を太く"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Pressure Sensitivity */}
                  {onChangePressureSensitivity && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (pressureSensitivity === 'off') {
                            onChangePressureSensitivity('high');
                          } else {
                            onChangePressureSensitivity('off');
                          }
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1 ${
                          pressureSensitivity !== 'off'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-300 dark:border-stone-700'
                        }`}
                        title={pressureSensitivity !== 'off' ? '筆圧感知有効 (クリックでOFF)' : '筆圧感知無効 (クリックでON)'}
                      >
                        <Activity className="w-3 h-3" />
                        <span className="hidden sm:inline">筆圧:</span>
                        <span>{pressureSensitivity !== 'off' ? 'ON' : 'OFF'}</span>
                      </button>

                      {pressureSensitivity !== 'off' && (
                        <select
                          value={pressureSensitivity}
                          onChange={(e) =>
                            onChangePressureSensitivity(e.target.value as 'high' | 'normal' | 'low' | 'off')
                          }
                          className={`text-[11px] font-bold px-1.5 py-1 rounded border transition-colors cursor-pointer outline-none ${
                            isLight
                              ? 'bg-stone-50 border-stone-300 text-stone-800 focus:border-emerald-600'
                              : 'bg-[#18231c] border-[#25382c] text-emerald-200 focus:border-emerald-500'
                          }`}
                          title="筆圧感度の調整"
                        >
                          <option value="high">感度: 高</option>
                          <option value="normal">感度: 標準</option>
                          <option value="low">感度: 低</option>
                        </select>
                      )}
                    </div>
                  )}

                  {/* Anti-Cutout */}
                  <button
                    onClick={() => {
                      const next = !autoResolveBrushOverlap;
                      setAutoResolveBrushOverlap(next);
                      showCanvasToast(
                        next
                          ? '一筆書きの重なり白抜き防止をONにしました'
                          : '白抜き防止をOFFにしました'
                      );
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1 ${
                      autoResolveBrushOverlap
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-300 dark:border-stone-700'
                    }`}
                    title="一筆書きの線が交差・重なった部分が白く抜けるのを自動で防止・融解します"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span className="hidden sm:inline">白抜き防止:</span>
                    <span>{autoResolveBrushOverlap ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Auto Union */}
                  <button
                    onClick={() => {
                      const next = !autoUnionBrush;
                      setAutoUnionBrush(next);
                      showCanvasToast(
                        next
                          ? 'ストローク描画ごとの自動合体をONにしました'
                          : '自動合体をOFFにしました（パスを個別に維持）'
                      );
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1 ${
                      autoUnionBrush
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-300 dark:border-stone-700'
                    }`}
                    title="描画完了時に重なる線を自動で合体するかどうかを切り替え"
                  >
                    <Layers className="w-3 h-3" />
                    <span className="hidden sm:inline">自動合体:</span>
                    <span>{autoUnionBrush ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Straight Mode */}
                  <button
                    onClick={() => {
                      const next = !brushStraightMode;
                      setBrushStraightMode(next);
                      showCanvasToast(
                        next
                          ? '定規直線モードをONにしました (ドラッグで水平・垂直・45度の直線を引けます)'
                          : '定規直線モードをOFFにしました (通常の手書き描画)'
                      );
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1 ${
                      brushStraightMode
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-300 dark:border-stone-700'
                    }`}
                    title="定規のように真っ直ぐな線を描画 (Shiftキーを押しながらドラッグでも直線にロック可能)"
                  >
                    <Ruler className="w-3 h-3" />
                    <span className="hidden sm:inline">定規直線:</span>
                    <span>{brushStraightMode ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Auto Smooth */}
                  <button
                    onClick={() => {
                      const next = !autoSmoothBrush;
                      setAutoSmoothBrush(next);
                      showCanvasToast(next ? '手ブレ補正・自動平滑化をONにしました' : '自動平滑化をOFFにしました');
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1 ${
                      autoSmoothBrush
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-300 dark:border-stone-700'
                    }`}
                    title="手書きストローク自動平滑化・手ブレ補正"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span className="hidden sm:inline">手ブレ補正:</span>
                    <span>{autoSmoothBrush ? 'ON' : 'OFF'}</span>
                  </button>

                  {onOpenPenPresetsModal && (
                    <button
                      onClick={onOpenPenPresetsModal}
                      className="px-2 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1 bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700 shadow-xs shrink-0"
                      title="書き味プリセット管理（筆圧・補正・ペン設定の一括保存・切替）"
                    >
                      <Bookmark className="w-3 h-3 fill-current opacity-80" />
                      <span className="hidden md:inline">プリセット</span>
                    </button>
                  )}

                  {/* Floating Quick Bar HUD Toggle */}
                  <button
                    onClick={() => {
                      const next = !showBrushHud;
                      setShowBrushHud(next);
                      try { localStorage.setItem('fontforge_show_brush_hud', String(next)); } catch {}
                      showCanvasToast(next ? '筆クイックバーを表示しました' : '筆クイックバーを非表示にしました');
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1 shrink-0 ${
                      showBrushHud
                        ? isLight
                          ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                          : 'bg-emerald-950 text-emerald-200 border-emerald-700'
                        : isLight
                        ? 'bg-stone-100 hover:bg-stone-200 text-stone-500 border-stone-300'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-400 border-stone-700'
                    }`}
                    title={showBrushHud ? 'キャンバス上の筆クイックバーを非表示（邪魔な場合にOFF）' : 'キャンバス上の筆クイックバーを再表示'}
                  >
                    <Sliders className="w-3 h-3" />
                    <span className="hidden lg:inline">浮動バー:</span>
                    <span>{showBrushHud ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </>
            )}

            {/* Pen Tool options in Header */}
            {toolMode === 'pen' && (
              <div className="flex items-center space-x-1 ml-1 pl-1.5 border-l border-stone-200 dark:border-stone-700">
                <button
                  onClick={() => setPenMode('bezier')}
                  className={`px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-colors ${
                    penMode === 'bezier'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                  }`}
                  title="ベジェ曲線"
                >
                  <Spline className="w-3 h-3" />
                  <span>曲線</span>
                </button>
                <button
                  onClick={() => setPenMode('corner')}
                  className={`px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-colors ${
                    penMode === 'corner'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                  }`}
                  title="折れ線"
                >
                  <Square className="w-3 h-3" />
                  <span>折れ線</span>
                </button>
              </div>
            )}

            {/* Eraser Tool Options in Header */}
            {toolMode === 'eraser' && (
              <div className="flex items-center space-x-2 ml-1 pl-1.5 border-l border-stone-200 dark:border-stone-700">
                {/* Eraser Mode Buttons */}
                <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg border border-stone-300/80 dark:border-stone-700">
                  <button
                    onClick={() => setEraserMode('stroke')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      eraserMode === 'stroke'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                    }`}
                    title="消しゴムに触れたパーツ全体を一発削除"
                  >
                    パーツ全消去
                  </button>
                  <button
                    onClick={() => setEraserMode('cut')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      eraserMode === 'cut'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                    }`}
                    title="消しゴムが通った位置のノード・パスを部分削り取り・分割"
                  >
                    部分削り消しゴム
                  </button>
                  <button
                    onClick={() => setEraserMode('node')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      eraserMode === 'node'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                    }`}
                    title="消しゴム円内の頂点（アンカーポイント）のみ消去"
                  >
                    アンカー点消去
                  </button>
                </div>

                {/* Size Controls */}
                <div className="flex items-center space-x-0.5 bg-stone-100 dark:bg-stone-800 p-0.5 rounded border border-stone-300 dark:border-stone-700">
                  <button
                    onClick={() => {
                      setEraserSize((prev) => Math.max(8, prev - 6));
                    }}
                    className="w-5 h-5 flex items-center justify-center font-bold text-xs rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200"
                    title="消しゴムを小さく ([ キー)"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-xs px-1 text-rose-700 dark:text-rose-300 w-10 text-center shrink-0">
                    {eraserSize}px
                  </span>
                  <button
                    onClick={() => {
                      setEraserSize((prev) => Math.min(160, prev + 6));
                    }}
                    className="w-5 h-5 flex items-center justify-center font-bold text-xs rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200"
                    title="消しゴムを大きく (] キー)"
                  >
                    +
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="hidden lg:flex items-center space-x-1">
                  {[16, 32, 60, 96, 140].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setEraserSize(s);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors ${
                        eraserSize === s
                          ? 'bg-rose-600 text-white'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-rose-100 dark:hover:bg-rose-950'
                      }`}
                    >
                      {s}px
                    </button>
                  ))}
                </div>

                {/* Clear All Contours button */}
                <button
                  onClick={() => {
                    if (contours.length === 0) return;
                    if (window.confirm('このグリフの全パーツを消去しますか？')) {
                      onChangeContours([]);
                      onCommitHistory();
                      showCanvasToast('全パーツを消去しました');
                    }
                  }}
                  className="px-2 py-0.5 rounded text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 hover:bg-rose-600 hover:text-white transition-colors ml-1"
                  title="この文字のすべての輪郭を一発消去"
                >
                  文字を全クリア
                </button>
              </div>
            )}

            {/* Node Tool options in Header */}
            {toolMode === 'node' && (
              <div className="flex items-center space-x-1.5 ml-1 pl-1.5 border-l border-stone-200 dark:border-stone-700">
                {/* Node Appearance Style Selector */}
                <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded border border-stone-200 dark:border-stone-700 text-[10px]">
                  <button
                    onClick={() => {
                      setNodeStyle('clean');
                    }}
                    className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                      nodeStyle === 'clean'
                        ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-bold'
                        : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                    }`}
                    title="すっきり小ドット表示（文字の形がはっきり見えます）"
                  >
                    形状優先
                  </button>
                  <button
                    onClick={() => {
                      setNodeStyle('selected_only');
                    }}
                    className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                      nodeStyle === 'selected_only'
                        ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-bold'
                        : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                    }`}
                    title="選択中のパーツのみ頂点を表示"
                  >
                    選択のみ
                  </button>
                  <button
                    onClick={() => {
                      setNodeStyle('full');
                    }}
                    className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                      nodeStyle === 'full'
                        ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-bold'
                        : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                    }`}
                    title="詳細ボックスとハンドルを常時表示"
                  >
                    詳細
                  </button>
                </div>

                {selectedNodeId && selectedContourId && (
                  <>
                    <button
                      onClick={() => handleToggleNodeType(selectedContourId, selectedNodeId)}
                      className={`px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-colors ${
                        isLight
                          ? 'bg-sky-100 text-sky-900 hover:bg-sky-200 border border-sky-300'
                          : 'bg-sky-950 text-sky-200 hover:bg-sky-900 border border-sky-700'
                      }`}
                      title="角ノードと曲線ノードを切り替え (ノードをダブルクリックでも可能)"
                    >
                      <Activity className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                      <span>角 ⇄ 曲線</span>
                    </button>
                    <button
                      onClick={handleDeleteSelectedNode}
                      className="px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-colors bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 hover:bg-rose-200 border border-rose-300 dark:border-rose-800"
                      title="選択したノードを削除 (Deleteキー)"
                    >
                      <Trash2 className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                      <span>削除</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Shape Tool options in Header */}
            {isShapeTool && (
              <div className="flex items-center space-x-1.5 ml-1 pl-1.5 border-l border-stone-200 dark:border-stone-700 relative" ref={shapePickerRef}>
                <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400 hidden sm:inline">
                  図形:
                </div>
                {/* Shape Selector Button & Dropdown */}
                {(() => {
                  const currentShapeObj = CANVAS_SHAPE_LIST.find((s) => s.id === toolMode) || CANVAS_SHAPE_LIST[0];
                  const SIcon = currentShapeObj.icon;
                  return (
                    <button
                      onClick={() => setShowShapePickerDropdown((prev) => !prev)}
                      className={`px-2 py-1 rounded text-xs font-bold border transition-colors flex items-center space-x-1.5 shadow-xs ${
                        isLight
                          ? 'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200'
                          : 'bg-emerald-950 text-emerald-200 border-emerald-700 hover:bg-emerald-900'
                      }`}
                      title="図形の種類を切り替え"
                    >
                      <SIcon className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                      <span>{currentShapeObj.label.split(' ')[0]}</span>
                      <span className="text-[9px] opacity-70">▾</span>
                    </button>
                  );
                })()}

                {/* Shape aspect ratio lock toggle */}
                <button
                  onClick={() => {
                    setIsShiftLockRatio((prev) => !prev);
                    showCanvasToast(!isShiftLockRatio ? '正方形・正円比率に固定しました' : '自由比率に切り替えました');
                  }}
                  className={`px-2 py-1 rounded text-xs font-bold border transition-colors flex items-center space-x-1 ${
                    isShiftLockRatio
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                  }`}
                  title="1:1 正方形・正円比率固定 (ドラッグ中Shiftキーでも可能)"
                >
                  <span className="hidden sm:inline">比率:</span>
                  <span>{isShiftLockRatio ? '正方形/正円固定' : '自由変形'}</span>
                </button>

                {/* Shape center draw toggle */}
                <button
                  onClick={() => {
                    setIsAltFromCenter((prev) => !prev);
                    showCanvasToast(!isAltFromCenter ? '中心基準作図をONにしました' : '中心基準作図をOFFにしました');
                  }}
                  className={`hidden sm:flex px-2 py-1 rounded text-xs font-bold border transition-colors items-center space-x-1 ${
                    isAltFromCenter
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                  }`}
                  title="中心から作図 (ドラッグ中Altキーでも可能)"
                >
                  <span>中心基準:</span>
                  <span>{isAltFromCenter ? 'ON' : 'OFF'}</span>
                </button>

                {/* Shape Picker Dropdown */}
                {showShapePickerDropdown && (
                  <div
                    className={`absolute top-full left-0 mt-1 z-50 w-64 p-2 rounded-xl border shadow-2xl backdrop-blur-md animate-in fade-in duration-100 ${
                      isLight
                        ? 'bg-white/98 border-stone-200 text-stone-800 shadow-emerald-950/15'
                        : 'bg-[#151f19]/98 border-[#25362b] text-emerald-100 shadow-black/60'
                    }`}
                  >
                    <div className="text-[10px] font-bold text-stone-400 dark:text-emerald-500/80 px-1 mb-1.5 flex items-center justify-between">
                      <span>図形を選択 (全13種類)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 max-h-60 overflow-y-auto">
                      {CANVAS_SHAPE_LIST.map((shape) => {
                        const SIcon = shape.icon;
                        const isSelected = toolMode === shape.id;
                        return (
                          <button
                            key={shape.id}
                            onClick={() => {
                              if (onSetToolMode) {
                                onSetToolMode(shape.id);
                              }
                              setShowShapePickerDropdown(false);
                              showCanvasToast(`図形を「${shape.label.split(' ')[0]}」に切り替えました`);
                            }}
                            className={`flex items-center space-x-1.5 p-1.5 rounded-lg text-xs font-medium text-left transition-all ${
                              isSelected
                                ? isLight
                                  ? 'bg-emerald-700 text-white font-bold shadow-xs'
                                  : 'bg-emerald-600 text-white font-bold shadow-xs'
                                : isLight
                                ? 'hover:bg-stone-100 text-stone-700'
                                : 'hover:bg-[#1f2b23] text-emerald-200'
                            }`}
                          >
                            <SIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{shape.label.split(' ')[0]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center: Selected Part Actions / Quick Transform Strip */}
          <div className="flex items-center space-x-1 shrink-0 overflow-x-auto no-scrollbar">
            {selectedContourIds.length > 0 && (
              <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-stone-100 dark:bg-[#18231c] border border-stone-200 dark:border-stone-700">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 pr-0.5">
                  選択中{selectedContourIds.length > 1 ? ` (${selectedContourIds.length}個)` : ''}:
                </span>
                <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 px-1 py-0.5 rounded border border-amber-300 dark:border-amber-700 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" />
                  <span>描画ロック中</span>
                </span>
                <button
                  onClick={() => {
                    setSelectedContourIds([]);
                    setSelectedContourId(null);
                    setSelectedNodeId(null);
                    setSelectedHandleType(null);
                    showCanvasToast('選択を解除しました（描画可能）');
                  }}
                  className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 text-[10px] font-bold hover:bg-stone-300 dark:hover:bg-stone-600 flex items-center gap-0.5 mr-0.5"
                  title="選択を解除してキャンバス描画を再開 (Esc)"
                >
                  <X className="w-2.5 h-2.5" />
                  <span>解除(Esc)</span>
                </button>
                {selectedContourIds.length >= 1 && (
                  <button
                    onClick={handleMergeSelectedContours}
                    className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center space-x-1 shadow-xs transition-all active:scale-95 mr-1"
                    title={
                      selectedContourIds.length === 1
                        ? '一筆書きの自己交差・ループによる重なり白抜きを自動解消'
                        : '選択した複数のパスを合体し、重なり白抜きを解消'
                    }
                  >
                    {selectedContourIds.length === 1 ? (
                      <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                    ) : (
                      <Layers className="w-2.5 h-2.5" />
                    )}
                    <span>{selectedContourIds.length === 1 ? '重なり白抜き解消' : '合体・白抜き解消'}</span>
                  </button>
                )}
                <button
                  onClick={() => handleSmoothStrokeSelected(smoothStrength, smoothPreserveCorners)}
                  className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold flex items-center space-x-0.5 hover:bg-emerald-500"
                  title="スムーズ化"
                >
                  <Wand2 className="w-2.5 h-2.5" />
                  <span>スムーズ</span>
                </button>
                <button
                  onClick={handleConvertToCornersSelected}
                  className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 text-[10px] font-bold hover:bg-blue-100"
                  title="角・直線に変換"
                >
                  角化
                </button>
                <button
                  onClick={handleConvertToSmoothSelected}
                  className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold hover:bg-emerald-100"
                  title="曲線に変換"
                >
                  曲線化
                </button>
                <button
                  onClick={handleReverseWindingSelected}
                  className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-[10px] font-bold hover:bg-amber-100 flex items-center space-x-0.5"
                  title="向き反転（時計回り/反時計回り）：重なりの白抜きと黒塗りを切り替え"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>向き反転</span>
                </button>
                <button
                  onClick={handleFlipHSelected}
                  className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200"
                  title="左右反転"
                >
                  <FlipHorizontal className="w-3 h-3" />
                </button>
                <button
                  onClick={handleFlipVSelected}
                  className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200"
                  title="上下反転"
                >
                  <FlipVertical className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleRotateSelected(90)}
                  className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200"
                  title="90度回転"
                >
                  <RotateCw className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleSlantSelected(10)}
                  className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200"
                  title="斜体 (+10°)"
                >
                  <Italic className="w-3 h-3" />
                </button>
                <button
                  onClick={handleDuplicateSelected}
                  className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200"
                  title="複製"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400"
                  title="削除 (Delete)"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => {
                    setSelectedContourIds([]);
                    setSelectedNodeId(null);
                  }}
                  className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                  title="選択解除 (Esc)"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {selectedContourIds.length === 0 && contours.length > 0 && (
              <button
                onClick={handleMergeSelectedContours}
                className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 dark:bg-[#18231c] dark:hover:bg-[#203026] text-stone-700 dark:text-stone-300 text-[10px] font-bold flex items-center space-x-1 border border-stone-200 dark:border-stone-700 transition-all active:scale-95"
                title="一筆書きの線が交差・重なった部分の白抜きを自動で解消（グリフ全体）"
              >
                <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                <span>重なり白抜き解消</span>
              </button>
            )}
          </div>

          {/* Right: Japanese Guides & Nodes & Global Actions */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Mobile Guides Sheet Trigger */}
            <button
              onClick={() => setShowMobileGuidesSheet(true)}
              className="sm:hidden px-2 py-1 rounded text-xs font-bold border transition-colors flex items-center space-x-1 bg-stone-100 dark:bg-[#19261e] border-stone-300 dark:border-[#25382c] text-stone-700 dark:text-emerald-200 shadow-xs"
              title="補助線・グリッド設定を開く"
            >
              <Grid className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>ガイド</span>
            </button>

            {/* Desktop Guide frame toggle */}
            <button
              onClick={() =>
                onChangeGridSettings?.((prev) => {
                  const modes: Array<'none' | 'cross' | 'tian' | 'jiugong' | 'mi'> = ['cross', 'tian', 'jiugong', 'mi', 'none'];
                  const curIdx = modes.indexOf(prev.japaneseGuide || 'cross');
                  const nextMode = modes[(curIdx + 1) % modes.length];
                  return { ...prev, japaneseGuide: nextMode };
                })
              }
              className={`hidden sm:inline-flex px-2 py-1 rounded text-xs font-bold border transition-all ${
                gridSettings.japaneseGuide && gridSettings.japaneseGuide !== 'none'
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-emerald-950 border-emerald-700 text-emerald-200'
                  : 'border-stone-200 dark:border-stone-700 text-stone-400'
              }`}
              title="ガイド枠切替 (十字 / 田字格 / 九宮格 / 米字格 / なし)"
            >
              {gridSettings.japaneseGuide === 'jiugong' && '九宮格'}
              {gridSettings.japaneseGuide === 'mi' && '米字格'}
              {gridSettings.japaneseGuide === 'tian' && '田 田字格'}
              {gridSettings.japaneseGuide === 'cross' && '十字線'}
              {(!gridSettings.japaneseGuide || gridSettings.japaneseGuide === 'none') && 'ガイドなし'}
            </button>

            {/* 85% Frame (Desktop) */}
            <button
              onClick={() =>
                onChangeGridSettings?.((prev) => ({ ...prev, showBodyFrame: !prev.showBodyFrame }))
              }
              className={`hidden sm:inline-flex px-1.5 py-1 rounded text-[11px] font-bold border transition-all ${
                gridSettings.showBodyFrame
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                  : 'border-stone-200 dark:border-stone-700 text-stone-400'
              }`}
              title="漢字字面枠 85%"
            >
              85%
            </button>

            {/* 78% Frame (Desktop) */}
            <button
              onClick={() =>
                onChangeGridSettings?.((prev) => ({ ...prev, showKanaFrame: !prev.showKanaFrame }))
              }
              className={`hidden sm:inline-flex px-1.5 py-1 rounded text-[11px] font-bold border transition-all ${
                gridSettings.showKanaFrame
                  ? isLight
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-amber-950/80 border-amber-700 text-amber-300'
                  : 'border-stone-200 dark:border-stone-700 text-stone-400'
              }`}
              title="仮名字面枠 78%"
            >
              78%
            </button>

            {/* Custom Guidelines Lock & Clear if any exist */}
            {customGuidelines.length > 0 && (
              <div className="hidden sm:flex items-center space-x-1 pl-1 border-l border-stone-200 dark:border-stone-700">
                <button
                  onClick={() => {
                    const nextLocked = !lockGuidelines;
                    setLockGuidelines(nextLocked);
                    showCanvasToast(
                      nextLocked ? 'ガイド線をロックしました' : 'ガイド線のロックを解除しました (移動可能)'
                    );
                  }}
                  className={`p-1.5 rounded border transition-colors flex items-center space-x-1 text-xs font-bold ${
                    lockGuidelines
                      ? isLight
                        ? 'bg-stone-100 border-stone-300 text-stone-600'
                        : 'bg-stone-800 border-stone-700 text-stone-300'
                      : 'bg-amber-100 dark:bg-amber-950 border-amber-400 text-amber-900 dark:text-amber-200'
                  }`}
                  title={
                    lockGuidelines
                      ? 'ガイド線ロック中 (クリックで移動可能に解除)'
                      : 'ガイド線移動可能 (クリックでロック)'
                  }
                >
                  {lockGuidelines ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  <span className="text-[10px]">{lockGuidelines ? 'ガイド固定' : '移動可能'}</span>
                </button>
                <button
                  onClick={() => {
                    setCustomGuidelines([]);
                    showCanvasToast('カスタムガイド線を消去しました');
                  }}
                  className="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-stone-400 hover:text-rose-600 transition-colors"
                  title="カスタムガイド線を全消去"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Node Points Visibility Toggle */}
            <button
              onClick={() => {
                const next = !showNodes;
                setShowNodes(next);
                showCanvasToast(next ? '頂点・ハンドルを表示しました' : '頂点・ハンドルを非表示にしました（文字形状プレビュー）');
              }}
              className={`p-1.5 rounded border transition-colors flex items-center space-x-1 ${
                showNodes
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-emerald-950 border-emerald-700 text-emerald-200'
                  : 'border-stone-200 dark:border-stone-700 text-stone-400 bg-stone-100 dark:bg-stone-800'
              }`}
              title={showNodes ? '頂点とハンドルを隠して文字の形を確認 (クリックで非表示)' : '頂点とハンドルを表示 (クリックで表示)'}
            >
              {showNodes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="text-[10px] hidden md:inline font-bold">
                {showNodes ? '頂点表示' : '頂点隠す'}
              </span>
            </button>

            {/* Sidebars quick toggles if collapsed */}
            {showGridDrawer === false && onToggleGridDrawer && (
              <button
                onClick={onToggleGridDrawer}
                className="hidden sm:flex items-center space-x-1 px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-xs font-bold text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700"
                title="文字一覧を開く"
              >
                <Grid className="w-3 h-3 text-emerald-600" />
                <span>文字一覧</span>
              </button>
            )}

            {showMetricsDrawer === false && onToggleMetricsDrawer && (
              <button
                onClick={onToggleMetricsDrawer}
                className="hidden sm:flex items-center space-x-1 px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-xs font-bold text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700"
                title="メトリクスを開く"
              >
                <Sliders className="w-3 h-3 text-emerald-600" />
                <span>メトリクス</span>
              </button>
            )}

            {/* Clear All button if has contours */}
            {contours.length > 0 && (
              <button
                onClick={handleClearAll}
                className="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 transition-colors"
                title="全パスを消去"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Focus Mode Top Exit Bar */}
      {isMobileFocusMode && (
        <div className="sm:hidden absolute top-2 right-2 z-30 flex items-center space-x-1 bg-black/70 backdrop-blur-md px-2 py-1 rounded-full border border-white/20 shadow-lg text-white">
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30"
              title="1つ戻す"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
          )}
          {onRedo && (
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30"
              title="やり直す"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="w-[1px] h-3 bg-white/30 mx-0.5" />
          <button
            onClick={() => setIsMobileFocusMode(false)}
            className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-[10px] font-bold text-white shadow-xs"
          >
            <Minimize className="w-3 h-3" />
            <span>完了</span>
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className={`relative flex-1 h-full w-full overflow-hidden select-none touch-none transition-colors ${
          isLight ? 'bg-[#f0f4f1]' : 'bg-[#0c120e]'
        }`}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const cursorX = e.clientX - rect.left;
            const cursorY = e.clientY - rect.top;
            const zoomFactor = Math.exp(-e.deltaY * 0.005);
            setZoom((prevZoom) => {
              const nextZoom = Math.max(0.35, Math.min(5.0, prevZoom * zoomFactor));
              const scaleChange = nextZoom / prevZoom;
              setPan((prevPan) => {
                const newPan = {
                  x: cursorX - (cursorX - prevPan.x) * scaleChange,
                  y: cursorY - (cursorY - prevPan.y) * scaleChange,
                };
                return clampPan(newPan, nextZoom);
              });
              return nextZoom;
            });
          } else {
            setPan((p) => clampPan({ x: p.x - e.deltaX, y: p.y - e.deltaY }, zoom));
          }
        }}
      >
        {/* Trace Adjust Mode Active Banner */}
      {toolMode === 'trace_adjust' && (
        <div
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full border shadow-lg flex items-center space-x-2 text-xs font-bold ${
            isLight
              ? 'bg-emerald-900 border-emerald-950 text-white'
              : 'bg-emerald-800 border-emerald-700 text-white'
          }`}
        >
          <Move className="w-3.5 h-3.5" />
          <span>下絵調整モード: キャンバス上をドラッグして下絵を移動</span>
          <button
            onClick={() => {
              onChangeTraceSettings({
                ...traceSettings,
                offsetX: 0,
                offsetY: 0,
                scale: 1,
                rotation: 0,
              });
            }}
            className="ml-2 px-2 py-0.5 rounded bg-emerald-950 hover:bg-black text-[10px] text-emerald-200 flex items-center space-x-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>位置リセット</span>
          </button>
        </div>
      )}

      {/* Active Pen Tool Drawing In-Progress Draggable Floating HUD Bar */}
      {activePenContour && (
        <div
          style={
            penHudPos
              ? { left: `${penHudPos.x}px`, top: `${penHudPos.y}px` }
              : { left: '50%', transform: 'translateX(-50%)', top: '12px' }
          }
          className="absolute z-30 pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-100"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className={`px-2 py-1 rounded-full border shadow-xl backdrop-blur-md flex items-center space-x-1.5 text-xs ${
              isLight
                ? 'bg-white/95 border-emerald-300/80 text-stone-800 shadow-emerald-950/10'
                : 'bg-[#121c15]/95 border-emerald-700/60 text-emerald-100 shadow-black/50'
            }`}
          >
            {/* Drag Handle */}
            <div
              onPointerDown={handlePenHudPointerDown}
              onPointerMove={handlePenHudPointerMove}
              onPointerUp={handlePenHudPointerUp}
              onPointerCancel={handlePenHudPointerUp}
              className="flex items-center px-1 py-1 -ml-0.5 cursor-grab active:cursor-grabbing text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              title="ドラッグして好きな場所に移動"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>

            {/* Active Points Count */}
            <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 font-bold font-mono text-[11px] shrink-0">
              <PenTool className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
              <span>{activePenContour.nodes.length}点</span>
            </div>

            <div className="h-3.5 w-[1px] bg-stone-200 dark:bg-emerald-800/80" />

            {/* Undo Last Point */}
            <button
              onClick={handleUndoPenNode}
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center space-x-1 transition-all active:scale-95 ${
                isLight
                  ? 'bg-stone-100 hover:bg-emerald-100 text-stone-700 hover:text-emerald-900'
                  : 'bg-[#1e2d23] hover:bg-[#283d30] text-emerald-200'
              }`}
              title="直前の頂点を取り消す (Backspace / ⌫ または Ctrl+Z)"
            >
              <RotateCcw className="w-3 h-3 text-stone-500 dark:text-stone-300" />
              <span>1点戻す</span>
              <span className="text-[9px] opacity-60 font-mono hidden sm:inline">⌫</span>
            </button>

            {/* Finalize as open path */}
            <button
              onClick={() => handleFinishPenContour(false)}
              disabled={activePenContour.nodes.length < 2}
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center space-x-1 transition-all disabled:opacity-30 active:scale-95 ${
                isLight
                  ? 'bg-sky-50 hover:bg-sky-100 text-sky-800'
                  : 'bg-sky-950/70 hover:bg-sky-900/80 text-sky-200'
              }`}
              title="開いた線として確定する (Enter / ↵)"
            >
              <CornerDownLeft className="w-3 h-3 text-sky-600 dark:text-sky-400" />
              <span>線で確定</span>
              <span className="text-[9px] opacity-60 font-mono hidden sm:inline">↵</span>
            </button>

            {/* Finalize as closed path */}
            <button
              onClick={() => handleFinishPenContour(true)}
              disabled={activePenContour.nodes.length < 3}
              className="px-2.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center space-x-1 shadow-sm transition-all disabled:opacity-30 active:scale-95"
              title="パスを閉じて輪郭として確定する (C または 始点をクリック)"
            >
              <Check className="w-3 h-3" />
              <span>閉じて確定</span>
              <span className="text-[9px] opacity-75 font-mono hidden sm:inline">C</span>
            </button>

            {/* Discard / Reset Path */}
            <button
              onClick={handleResetPenContour}
              className="p-1 rounded-full hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 transition-colors"
              title="作図中のパスを破棄・リセットする (Esc)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Reset Position (only if moved) */}
            {penHudPos && (
              <button
                onClick={() => setPenHudPos(null)}
                className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                title="位置を上部中央にリセット"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Brush / Handwriting Studio Quick Bar (When in Brush mode) */}
      {toolMode === 'brush' && !activePenContour && showBrushHud && (
        <div
          style={
            brushHudPos
              ? { left: `${brushHudPos.x}px`, top: `${brushHudPos.y}px` }
              : { left: '50%', transform: 'translateX(-50%)', top: '8px' }
          }
          className={`absolute z-20 pointer-events-auto select-none transition-all duration-150 ${
            isDrawingStroke
              ? 'opacity-0 pointer-events-none scale-95'
              : 'opacity-85 hover:opacity-100'
          }`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {isBrushHudCollapsed ? (
            /* Collapsed mode: ultra-compact, non-obtrusive mini pill */
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border shadow-sm backdrop-blur-md transition-all cursor-pointer ${
                isLight
                  ? 'bg-white/90 hover:bg-white border-stone-300/80 text-stone-700 shadow-stone-900/5'
                  : 'bg-[#121c15]/90 hover:bg-[#121c15] border-[#25382c] text-emerald-200 shadow-black/40'
              }`}
              onClick={() => {
                setIsBrushHudCollapsed(false);
                try { localStorage.setItem('fontforge_brush_hud_collapsed', 'false'); } catch {}
              }}
              title="クリックして筆クイックバーを展開"
            >
              {/* Drag Handle */}
              <div
                onPointerDown={handleBrushHudPointerDown}
                onPointerMove={handleBrushHudPointerMove}
                onPointerUp={handleBrushHudPointerUp}
                onPointerCancel={handleBrushHudPointerUp}
                className="cursor-grab active:cursor-grabbing text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 p-0.5"
                title="ドラッグして移動"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-3 h-3" />
              </div>
              <Paintbrush className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] font-bold">
                {PEN_PRESETS.find((p) => p.id === brushStyle)?.name || 'ペン'}
              </span>
              <span className="font-mono text-[10px] opacity-70">
                {brushWidth}px
              </span>
              <ChevronDown className="w-3 h-3 text-stone-400 ml-0.5" />
            </div>
          ) : (
            /* Expanded mode: sleek, translucent, compact bar */
            <div
              className={`px-2.5 py-1 rounded-xl border shadow-sm backdrop-blur-md flex items-center space-x-1.5 text-xs overflow-x-auto no-scrollbar transition-all ${
                isLight
                  ? 'bg-white/85 hover:bg-white/95 border-stone-200/90 text-stone-800 shadow-emerald-950/5'
                  : 'bg-[#121c15]/85 hover:bg-[#121c15]/95 border-[#25362b] text-emerald-100 shadow-black/40'
              }`}
            >
              {/* Drag Handle */}
              <div
                onPointerDown={handleBrushHudPointerDown}
                onPointerMove={handleBrushHudPointerMove}
                onPointerUp={handleBrushHudPointerUp}
                onPointerCancel={handleBrushHudPointerUp}
                className="flex items-center px-0.5 py-0.5 cursor-grab active:cursor-grabbing text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shrink-0"
                title="ドラッグして好きな場所に移動"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>

              {/* Active Pen Type Badge */}
              <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-emerald-100/80 dark:bg-emerald-950/90 text-emerald-950 dark:text-emerald-200 font-bold text-[11px] shrink-0">
                <Paintbrush className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                <span>{PEN_PRESETS.find((p) => p.id === brushStyle)?.name || '毛筆'}</span>
                <span className="font-mono text-[10px] opacity-70">({brushWidth}px)</span>
              </div>

              <div className="h-3 w-[1px] bg-stone-200 dark:bg-[#25382c] shrink-0" />

              {/* Quick Size Select */}
              {onChangeBrushWidth && (
                <div className="flex items-center space-x-0.5 shrink-0">
                  {[15, 30, 50, 80].map((w) => (
                    <button
                      key={w}
                      onClick={() => {
                        onChangeBrushWidth(w);
                        showCanvasToast(`太さ: ${w}px`);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                        brushWidth === w
                          ? isLight
                            ? 'bg-emerald-700 text-white shadow-2xs'
                            : 'bg-emerald-600 text-white shadow-2xs'
                          : isLight
                          ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                          : 'bg-[#1b2820] hover:bg-[#25382c] text-emerald-300'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              )}

              <div className="h-3 w-[1px] bg-stone-200 dark:bg-[#25382c] shrink-0" />

              {/* Guide Grid Quick Cycle */}
              <button
                onClick={() => {
                  const guideCycle: ('cross' | 'tian' | 'jiugong' | 'mi' | 'none')[] = ['cross', 'tian', 'jiugong', 'mi', 'none'];
                  const currentIdx = guideCycle.indexOf(gridSettings.japaneseGuide || 'cross');
                  const nextGuide = guideCycle[(currentIdx + 1) % guideCycle.length];
                  if (onChangeGridSettings) {
                    onChangeGridSettings((s) => ({ ...s, japaneseGuide: nextGuide }));
                  }
                  const guideNames: Record<string, string> = {
                    cross: '十字リーダー',
                    tian: '田字格',
                    jiugong: '九宮格',
                    mi: '米字格',
                    none: 'ガイドOFF',
                  };
                  showCanvasToast(`作字ガイド: ${guideNames[nextGuide]}`);
                }}
                className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold flex items-center space-x-1 transition-all shrink-0 ${
                  gridSettings.japaneseGuide && gridSettings.japaneseGuide !== 'none'
                    ? isLight
                      ? 'bg-emerald-100/90 text-emerald-900 border border-emerald-300'
                      : 'bg-emerald-950 text-emerald-200 border border-emerald-700'
                    : isLight
                    ? 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                    : 'bg-[#1b2820] hover:bg-[#25382c] text-stone-400'
                }`}
                title="作字ガイド切替"
              >
                <Grid className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {gridSettings.japaneseGuide === 'cross'
                    ? '十字'
                    : gridSettings.japaneseGuide === 'tian'
                    ? '田字'
                    : gridSettings.japaneseGuide === 'jiugong'
                    ? '九宮'
                    : gridSettings.japaneseGuide === 'mi'
                    ? '米字'
                    : '枠のみ'}
                </span>
              </button>

              {/* Undo last stroke */}
              <button
                onClick={() => {
                  if (contours.length > 0) {
                    const updated = contours.slice(0, -1);
                    onChangeContours(updated);
                    onCommitHistory();
                    showCanvasToast('直前のストロークを取り消しました (1画戻す)');
                  }
                }}
                disabled={contours.length === 0}
                className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold flex items-center space-x-0.5 transition-all disabled:opacity-30 shrink-0 active:scale-95 ${
                  isLight
                    ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    : 'bg-[#1b2820] hover:bg-[#25382c] text-emerald-200'
                }`}
                title="1画戻す (Ctrl+Z)"
              >
                <RotateCcw className="w-2.5 h-2.5 text-stone-500 dark:text-stone-300" />
                <span>1画戻す</span>
              </button>

              <div className="h-3 w-[1px] bg-stone-200 dark:bg-[#25382c] shrink-0" />

              {/* Reset position (if moved) */}
              {brushHudPos && (
                <button
                  onClick={() => {
                    setBrushHudPos(null);
                    try { localStorage.removeItem('fontforge_brush_hud_pos'); } catch {}
                    showCanvasToast('バーの位置をリセットしました');
                  }}
                  className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors shrink-0"
                  title="位置を上部中央にリセット"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              )}

              {/* Collapse/Fold button */}
              <button
                onClick={() => {
                  setIsBrushHudCollapsed(true);
                  try { localStorage.setItem('fontforge_brush_hud_collapsed', 'true'); } catch {}
                  showCanvasToast('筆クイックバーを折りたたみ最小化しました');
                }}
                className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors shrink-0"
                title="バーを最小化 (邪魔な時に折りたたむ)"
              >
                <ChevronUp className="w-3 h-3" />
              </button>

              {/* Close/Dismiss button */}
              <button
                onClick={() => {
                  setShowBrushHud(false);
                  try { localStorage.setItem('fontforge_show_brush_hud', 'false'); } catch {}
                  showCanvasToast('筆クイックバーを閉じました（サブツールバーから再表示可能）');
                }}
                className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors shrink-0"
                title="バーを閉じる (非表示)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* SVG Canvas Stage */}
      <svg
        className="w-full h-full touch-none select-none"
        style={{ touchAction: 'none', cursor: getCanvasCursor() }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* 1. Base Canvas Background & Grid */}
          <CanvasBackgroundLayer
            isLight={isLight}
            showGrid={!!gridSettings.showGrid}
            gridSize={gridSettings.gridSize || 50}
          />

          {/* 2. Japanese Calligraphy / Layout Guides (Cross, Tian, Jiugong, Mi, BodyFrame, KanaFrame) */}
          <JapaneseGuidesLayer
            guideType={gridSettings.japaneseGuide}
            showBodyFrame={gridSettings.showBodyFrame}
            showKanaFrame={gridSettings.showKanaFrame}
            isLight={isLight}
          />

          {/* 3. Adjacent Character Context Boxes */}
          <AdjacentGlyphsLayer
            isLight={isLight}
            advanceWidth={advanceWidth}
          />

          {/* 4. Trace Reference Image / Char Template Layer */}
          <TraceReferenceLayer
            traceSettings={traceSettings}
            isLight={isLight}
            activeChar={activeChar}
            selectedUnicode={selectedUnicode != null ? String(selectedUnicode) : undefined}
            toolMode={toolMode}
            onPointerDownImage={handlePointerDownTraceImage}
          />

          {/* 5. Top & Left Ruler Scales */}
          <CanvasRulersLayer
            showRulers={gridSettings.showRulers !== false}
            isLight={isLight}
            hoverPos={hoverCanvasPos}
          />

          {/* 6. Typography Metrics Guidelines (LSB, RSB, Baseline, Ascender, etc.) */}
          <MetricsGuidesLayer
            showMetrics={!!gridSettings.showMetrics}
            lsb={lsb}
            advanceWidth={advanceWidth}
          />

          {/* 7. User Custom Guidelines */}
          <CustomGuidelinesLayer
            customGuidelines={customGuidelines}
            zoom={zoom}
            locked={
              lockGuidelines ||
              toolMode === 'brush' ||
              toolMode === 'pen' ||
              toolMode === 'eraser' ||
              isShapeTool
            }
            interactive={!lockGuidelines && (toolMode === 'select' || toolMode === 'ruler')}
            onPointerDownGuide={handlePointerDownGuide}
            onDoubleClickGuide={handleDoubleClickGuide}
          />

          {/* 8. Interactive Measurement Tool Overlay */}
          <RulerMeasurementLayer
            rulerMeasurement={rulerMeasurement}
            zoom={zoom}
            onDrawLine={handleDrawRulerAsStroke}
            onConvertToGuide={handleConvertRulerToGuideline}
          />

          {/* 9. Main Glyph Vector Contours */}
          <MainGlyphContoursLayer
            mainSvgPath={mainSvgPath}
            isLight={isLight}
          />

          {/* ---------------- INTERACTIVE CONTOUR HIT & SELECTION STROKES ---------------- */}
          {contours.map((contour) => {
            const isSelected = selectedContourIds.includes(contour.id);
            const pathD = contourSvgMap.get(contour.id) || contoursToSvgPath([contour]);
            return (
              <path
                key={`contour-hit-${contour.id}`}
                d={pathD}
                fill="transparent"
                stroke={isSelected ? '#10b981' : 'transparent'}
                strokeWidth={isSelected ? Math.max(2, 2.5 / zoom) : Math.max(14, 18 / zoom)}
                strokeDasharray={isSelected ? '6 4' : undefined}
                className={toolMode === 'select' || toolMode === 'node' || toolMode === 'eraser' ? 'cursor-pointer' : 'pointer-events-none'}
                pointerEvents={toolMode === 'select' || toolMode === 'node' || toolMode === 'eraser' ? 'stroke fill' : 'none'}
                onPointerDown={(e) => {
                  if (toolMode === 'eraser') {
                    e.stopPropagation();
                    const clickPos = screenToCanvas(e.clientX, e.clientY);
                    const eraseRadius = Math.max(8, (eraserSize / 2) / zoom);
                    const updated = eraseContoursAtPoint(contours, clickPos, eraseRadius, eraserMode);
                    if (updated.length !== contours.length || JSON.stringify(updated) !== JSON.stringify(contours)) {
                      onChangeContours(updated);
                      onCommitHistory();
                    }
                    return;
                  }
                  if (toolMode === 'node') {
                    e.stopPropagation();
                    const clickPos = screenToCanvas(e.clientX, e.clientY);
                    const insertResult = insertNodeOnContourAtPoint(contour, clickPos, 22 / zoom);
                    if (insertResult) {
                      const newContours = contours.map((c) => (c.id === contour.id ? insertResult.updatedContour : c));
                      onChangeContours(newContours);
                      setSelectedContourId(contour.id);
                      setSelectedContourIds([contour.id]);
                      setSelectedNodeId(insertResult.newNodeId);
                      setSelectedHandleType('node');
                      onCommitHistory();
                      showCanvasToast('頂点を追加しました');
                      return;
                    }
                    setSelectedContourId(contour.id);
                    setSelectedContourIds([contour.id]);
                    setSelectedNodeId(null);
                    setSelectedHandleType(null);
                    return;
                  }
                  if (toolMode === 'select') {
                    e.stopPropagation();
                    if (e.shiftKey) {
                      setSelectedContourIds((prev) =>
                        prev.includes(contour.id)
                          ? prev.filter((id) => id !== contour.id)
                          : [...prev, contour.id]
                      );
                    } else {
                      setSelectedContourIds((prev) =>
                        prev.includes(contour.id) && prev.length > 1 ? prev : [contour.id]
                      );
                    }
                    setSelectedNodeId(null);
                    setSelectedHandleType(null);
                  }
                }}
              />
            );
          })}

          {/* Marquee Selection Box */}
          {marqueeSelection && (
            <rect
              x={Math.min(marqueeSelection.start.x, marqueeSelection.current.x)}
              y={Math.min(marqueeSelection.start.y, marqueeSelection.current.y)}
              width={Math.abs(marqueeSelection.current.x - marqueeSelection.start.x)}
              height={Math.abs(marqueeSelection.current.y - marqueeSelection.start.y)}
              fill="rgba(16, 185, 129, 0.14)"
              stroke="#10b981"
              strokeWidth={1.5 / zoom}
              strokeDasharray="4 2"
              pointerEvents="none"
            />
          )}

          {/* Active Pen Path in-progress */}
          {penSvgPath && (
            <path
              d={penSvgPath}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={2}
              strokeDasharray="4 2"
            />
          )}

          {/* Rubber band line to mouse for Pen */}
          {toolMode === 'pen' && activePenContour && penMousePos && activePenContour.nodes.length > 0 && (
            <line
              x1={activePenContour.nodes[activePenContour.nodes.length - 1].x}
              y1={activePenContour.nodes[activePenContour.nodes.length - 1].y}
              x2={penMousePos.x}
              y2={penMousePos.y}
              stroke="#0284c7"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          )}

          {/* Active Brush Stroke in-progress (Hardware-accelerated live path) */}
          <path
            ref={activeBrushPathRef}
            d=""
            fill="#f59e0b"
            fillOpacity={0.85}
            stroke="#d97706"
            strokeWidth={1}
            fillRule="nonzero"
            pointerEvents="none"
          />

          {/* Active Shape in-progress */}
          {isShapeTool && shapeStartPoint && shapeCurrentPoint && (
            <path
              d={contoursToSvgPath([
                getShapeContourFromPoints(toolMode, shapeStartPoint, shapeCurrentPoint),
              ])}
              fill="#f59e0b"
              fillOpacity={0.35}
              stroke="#f59e0b"
              strokeWidth={2}
            />
          )}

          {/* Selected Contour Highlight & Interactive Bounding Box Transform UI */}
          {selectedContourIds.length > 0 && selContoursBBox && (
            (() => {
              const bbox = selContoursBBox;
              const pad = 4;
              const bx = bbox.minX - pad;
              const by = bbox.minY - pad;
              const bw = Math.max(12, bbox.width + pad * 2);
              const bh = Math.max(12, bbox.height + pad * 2);
              const cx = bbox.centerX;
              const cy = bbox.centerY;

              const hs = Math.max(8, 10 / zoom); // handle size in canvas coordinates
              const rotStemDist = 32 / zoom;

              return (
                <g className="transform-bounding-box select-none">
                  {/* Selected Path Outline Highlight */}
                  {selectedContoursSvgPath && (
                    <path
                      d={selectedContoursSvgPath}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth={2.5 / zoom}
                      strokeDasharray="6 4"
                      pointerEvents="none"
                    />
                  )}

                  {/* Bounding Box Border & Full Area Drag-to-Move Plane */}
                  <rect
                    x={bx}
                    y={by}
                    width={bw}
                    height={bh}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={1 / zoom}
                    strokeDasharray="4 2"
                    className="cursor-move"
                    pointerEvents="all"
                    onPointerDown={(e) => handleTransformPointerDown(e, 'move')}
                  />

                  {/* Floating Selection Quick Actions Toolbar */}
                  <foreignObject
                    x={cx - 110 / zoom}
                    y={by - rotStemDist - 38 / zoom < 10 ? by + bh + 12 / zoom : by - rotStemDist - 38 / zoom}
                    width={220 / zoom}
                    height={38 / zoom}
                    className="overflow-visible pointer-events-auto select-none z-50 opacity-90 hover:opacity-100 transition-opacity"
                  >
                    <div
                      style={{ transform: `scale(${Math.max(0.6, Math.min(1.0, 1 / zoom))})`, transformOrigin: 'top center' }}
                      className="flex items-center justify-center space-x-1 px-2 py-1 bg-stone-900/90 dark:bg-[#101b13]/90 text-white backdrop-blur-md rounded-full shadow-lg border border-emerald-500/40 text-xs font-sans pointer-events-auto"
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRotateSelected(45); }}
                        className="p-1.5 rounded-full hover:bg-emerald-800/80 text-emerald-300 transition-colors"
                        title="45°回転 (Rotate 45°)"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFlipHSelected(); }}
                        className="p-1.5 rounded-full hover:bg-emerald-800/80 text-emerald-300 transition-colors"
                        title="左右反転 (Flip Horizontal)"
                      >
                        <FlipHorizontal className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFlipVSelected(); }}
                        className="p-1.5 rounded-full hover:bg-emerald-800/80 text-emerald-300 transition-colors"
                        title="上下反転 (Flip Vertical)"
                      >
                        <FlipVertical className="w-3.5 h-3.5" />
                      </button>
                      <div className="w-px h-3.5 bg-emerald-500/30 my-auto" />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDuplicateSelected(); }}
                        className="p-1.5 rounded-full hover:bg-emerald-800/80 text-emerald-300 transition-colors"
                        title="複製 (Duplicate)"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {selectedContourIds.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMergeSelectedContours(); }}
                          className="p-1.5 rounded-full hover:bg-emerald-600/90 text-white transition-colors"
                          title="選択パーツを結合・融解 (Union)"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSelected(); }}
                        className="p-1.5 rounded-full hover:bg-rose-800/90 text-rose-300 transition-colors ml-0.5"
                        title="削除 (Delete)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </foreignObject>

                  {/* Center Anchor Crosshair */}
                  <g
                    className="cursor-move group"
                    onPointerDown={(e) => handleTransformPointerDown(e, 'move')}
                  >
                    <circle cx={cx} cy={cy} r={4 / zoom} fill="#10b981" stroke="#ffffff" strokeWidth={1 / zoom} />
                    <line x1={cx - 5 / zoom} y1={cy} x2={cx + 5 / zoom} y2={cy} stroke="#10b981" strokeWidth={1 / zoom} />
                    <line x1={cx} y1={cy - 5 / zoom} x2={cx} y2={cy + 5 / zoom} stroke="#10b981" strokeWidth={1 / zoom} />
                  </g>

                  {/* Rotation Connector Stem Line */}
                  <line
                    x1={cx}
                    y1={by}
                    x2={cx}
                    y2={by - rotStemDist}
                    stroke="#10b981"
                    strokeWidth={1.5 / zoom}
                    strokeDasharray="3 2"
                    pointerEvents="none"
                  />

                  {/* Rotation Grip Handle (Top-Center) */}
                  <g
                    className="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                    onPointerDown={(e) => handleTransformPointerDown(e, 'rotate')}
                  >
                    {/* Larger invisible hit area for touch/mouse */}
                    <circle
                      cx={cx}
                      cy={by - rotStemDist}
                      r={14 / zoom}
                      fill="transparent"
                    />
                    <circle
                      cx={cx}
                      cy={by - rotStemDist}
                      r={7 / zoom}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth={1.8 / zoom}
                    />
                    {/* Inner rotation ring indicator */}
                    <circle
                      cx={cx}
                      cy={by - rotStemDist}
                      r={3.5 / zoom}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={1.2 / zoom}
                      strokeDasharray="4 2"
                    />
                  </g>

                  {/* 8 Resize Handles (Corner & Edge) */}
                  {/* NW (Top-Left) */}
                  <g onPointerDown={(e) => handleTransformPointerDown(e, 'nw')} className="cursor-nwse-resize">
                    <rect x={bx - hs} y={by - hs} width={hs * 2} height={hs * 2} fill="transparent" />
                    <rect
                      x={bx - hs / 2}
                      y={by - hs / 2}
                      width={hs}
                      height={hs}
                      fill="#ffffff"
                      stroke="#10b981"
                      strokeWidth={1.8 / zoom}
                      rx={1.5 / zoom}
                    />
                  </g>

                  {/* N (Top-Center) */}
                  <g onPointerDown={(e) => handleTransformPointerDown(e, 'n')} className="cursor-ns-resize">
                    <rect x={bx + bw / 2 - hs} y={by - hs} width={hs * 2} height={hs * 2} fill="transparent" />
                    <rect
                      x={bx + bw / 2 - hs / 2}
                      y={by - hs / 2}
                      width={hs}
                      height={hs}
                      fill="#ffffff"
                      stroke="#10b981"
                      strokeWidth={1.8 / zoom}
                      rx={1.5 / zoom}
                    />
                  </g>

                  {/* NE (Top-Right) */}
                  <g onPointerDown={(e) => handleTransformPointerDown(e, 'ne')} className="cursor-nesw-resize">
                    <rect x={bx + bw - hs} y={by - hs} width={hs * 2} height={hs * 2} fill="transparent" />
                    <rect
                      x={bx + bw - hs / 2}
                      y={by - hs / 2}
                      width={hs}
                      height={hs}
                      fill="#ffffff"
                      stroke="#10b981"
                      strokeWidth={1.8 / zoom}
                      rx={1.5 / zoom}
                    />
                  </g>

                  {/* E (Middle-Right) */}
                  <g onPointerDown={(e) => handleTransformPointerDown(e, 'e')} className="cursor-ew-resize">
                    <rect x={bx + bw - hs} y={by + bh / 2 - hs} width={hs * 2} height={hs * 2} fill="transparent" />
                    <rect
                      x={bx + bw - hs / 2}
                      y={by + bh / 2 - hs / 2}
                      width={hs}
                      height={hs}
                      fill="#ffffff"
                      stroke="#10b981"
                      strokeWidth={1.8 / zoom}
                      rx={1.5 / zoom}
                    />
                  </g>

                  {/* SE (Bottom-Right) */}
                  <g onPointerDown={(e) => handleTransformPointerDown(e, 'se')} className="cursor-nwse-resize">
                    <rect x={bx + bw - hs} y={by + bh - hs} width={hs * 2} height={hs * 2} fill="transparent" />
                    <rect
                      x={bx + bw - hs / 2}
                      y={by + bh - hs / 2}
                      width={hs}
                      height={hs}
                      fill="#ffffff"
                      stroke="#10b981"
                      strokeWidth={1.8 / zoom}
                      rx={1.5 / zoom}
                    />
                  </g>

                  {/* S (Bottom-Center) */}
                  <g onPointerDown={(e) => handleTransformPointerDown(e, 's')} className="cursor-ns-resize">
                    <rect x={bx + bw / 2 - hs} y={by + bh - hs} width={hs * 2} height={hs * 2} fill="transparent" />
                    <rect
                      x={bx + bw / 2 - hs / 2}
                      y={by + bh - hs / 2}
                      width={hs}
                      height={hs}
                      fill="#ffffff"
                      stroke="#10b981"
                      strokeWidth={1.8 / zoom}
                      rx={1.5 / zoom}
                    />
                  </g>

                  {/* SW (Bottom-Left) */}
                  <g onPointerDown={(e) => handleTransformPointerDown(e, 'sw')} className="cursor-nesw-resize">
                    <rect x={bx - hs} y={by + bh - hs} width={hs * 2} height={hs * 2} fill="transparent" />
                    <rect
                      x={bx - hs / 2}
                      y={by + bh - hs / 2}
                      width={hs}
                      height={hs}
                      fill="#ffffff"
                      stroke="#10b981"
                      strokeWidth={1.8 / zoom}
                      rx={1.5 / zoom}
                    />
                  </g>

                  {/* W (Middle-Left) */}
                  <g onPointerDown={(e) => handleTransformPointerDown(e, 'w')} className="cursor-ew-resize">
                    <rect x={bx - hs} y={by + bh / 2 - hs} width={hs * 2} height={hs * 2} fill="transparent" />
                    <rect
                      x={bx - hs / 2}
                      y={by + bh / 2 - hs / 2}
                      width={hs}
                      height={hs}
                      fill="#ffffff"
                      stroke="#10b981"
                      strokeWidth={1.8 / zoom}
                      rx={1.5 / zoom}
                    />
                  </g>

                  {/* HUD Dimension Tooltip (Width x Height, Rotation Angle, Shift hint) */}
                  <g transform={`translate(${bx}, ${by + bh + 12 / zoom})`} className="pointer-events-none">
                    <rect
                      x={0}
                      y={0}
                      width={Math.max(130 / zoom, (rotateDisplayAngle !== null ? 170 : 120) / zoom)}
                      height={20 / zoom}
                      rx={4 / zoom}
                      fill="#0f172a"
                      fillOpacity={0.9}
                    />
                    <text
                      x={6 / zoom}
                      y={14 / zoom}
                      fill="#34d399"
                      fontSize={10.5 / zoom}
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {Math.round(bbox.width)}×{Math.round(bbox.height)}px
                      {rotateDisplayAngle !== null ? `  ∡${rotateDisplayAngle}°` : ''}
                    </text>
                  </g>
                </g>
              );
            })()
          )}

          {/* ---------------- BEZIER NODES & CONTROL HANDLES ---------------- */}
          {showNodes && (gridSettings.showPoints || toolMode === 'select' || toolMode === 'node' || toolMode === 'pen') && (
            <g className="bezier-controls select-none">
              {contours.map((contour) => {
                const isContourActive = contour.id === selectedContourId;

                // When in selected_only style, skip unselected contours entirely
                if (nodeStyle === 'selected_only' && !isContourActive) {
                  return null;
                }

                // For inactive contours, if not in node mode and showPoints is false, don't overwhelm screen
                if (!isContourActive && toolMode !== 'node' && !gridSettings.showPoints) {
                  return null;
                }

                return (
                  <g key={contour.id}>
                    {contour.nodes.map((node) => {
                      const isSelected = selectedNodeId === node.id;

                      if (!isContourActive) {
                        // Unselected contour: render crisp, tiny unobtrusive dot with generous invisible hit area
                        const dotRadius = nodeStyle === 'full' ? 3.5 / zoom : 2.5 / zoom;
                        return (
                          <g key={node.id}>
                            {/* Invisible expanded hit area for touch/mouse ease */}
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={10 / zoom}
                              fill="transparent"
                              className="cursor-pointer"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                setSelectedContourId(contour.id);
                                setSelectedNodeId(node.id);
                                setSelectedHandleType('node');
                              }}
                            />
                            {/* Visual small anchor dot with subtle white border */}
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={dotRadius}
                              fill="#0ea5e9"
                              stroke="#ffffff"
                              strokeWidth={1 / zoom}
                              className="pointer-events-none opacity-60"
                            />
                          </g>
                        );
                      }

                      // Active / Selected contour nodes
                      const isClean = nodeStyle === 'clean';
                      const isSmooth = node.type === 'smooth';

                      // Node point visual dimensions (Clean vs Full)
                      const anchorRadius = isSelected
                        ? (isClean ? 4.5 / zoom : 5.5 / zoom)
                        : (isClean ? 3.5 / zoom : 4.5 / zoom);
                      
                      const handleDotRadius = isClean ? 3.2 / zoom : 4.5 / zoom;

                      return (
                        <g key={node.id}>
                          {/* Control Handle Lines (handles shown if showHandles, or in node tool, or node is selected) */}
                          {(gridSettings.showHandles || isSelected || (toolMode === 'node' && !isClean)) && (
                            <>
                              {node.handleIn && (
                                <g>
                                  <line
                                    x1={node.x}
                                    y1={node.y}
                                    x2={node.handleIn.x}
                                    y2={node.handleIn.y}
                                    stroke={isSelected ? '#0284c7' : '#38bdf8'}
                                    strokeWidth={1.2 / zoom}
                                    strokeOpacity={isSelected ? 0.9 : 0.6}
                                    strokeDasharray={isClean ? '3 2' : undefined}
                                  />
                                  {/* HandleIn Touch target */}
                                  <circle
                                    cx={node.handleIn.x}
                                    cy={node.handleIn.y}
                                    r={12 / zoom}
                                    fill="transparent"
                                    className="cursor-move"
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                      setSelectedContourId(contour.id);
                                      setSelectedNodeId(node.id);
                                      setSelectedHandleType('handleIn');
                                    }}
                                  />
                                  {/* HandleIn Circle dot */}
                                  <circle
                                    cx={node.handleIn.x}
                                    cy={node.handleIn.y}
                                    r={handleDotRadius}
                                    fill="#38bdf8"
                                    stroke="#ffffff"
                                    strokeWidth={1.2 / zoom}
                                    className="pointer-events-none"
                                  />
                                </g>
                              )}
                              {node.handleOut && (
                                <g>
                                  <line
                                    x1={node.x}
                                    y1={node.y}
                                    x2={node.handleOut.x}
                                    y2={node.handleOut.y}
                                    stroke={isSelected ? '#0284c7' : '#38bdf8'}
                                    strokeWidth={1.2 / zoom}
                                    strokeOpacity={isSelected ? 0.9 : 0.6}
                                    strokeDasharray={isClean ? '3 2' : undefined}
                                  />
                                  {/* HandleOut Touch target */}
                                  <circle
                                    cx={node.handleOut.x}
                                    cy={node.handleOut.y}
                                    r={12 / zoom}
                                    fill="transparent"
                                    className="cursor-move"
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                      setSelectedContourId(contour.id);
                                      setSelectedNodeId(node.id);
                                      setSelectedHandleType('handleOut');
                                    }}
                                  />
                                  {/* HandleOut Circle dot */}
                                  <circle
                                    cx={node.handleOut.x}
                                    cy={node.handleOut.y}
                                    r={handleDotRadius}
                                    fill="#38bdf8"
                                    stroke="#ffffff"
                                    strokeWidth={1.2 / zoom}
                                    className="pointer-events-none"
                                  />
                                </g>
                              )}
                            </>
                          )}

                          {/* Anchor Node: Invisible generous hit box for effortless clicking */}
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={14 / zoom}
                            fill="transparent"
                            className="cursor-pointer"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setSelectedContourId(contour.id);
                              setSelectedNodeId(node.id);
                              setSelectedHandleType('node');
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              handleToggleNodeType(contour.id, node.id);
                            }}
                          />

                          {/* Anchor Node Point Visual: Sleek rounded dot with clear selection ring */}
                          {isClean ? (
                            <g className="pointer-events-none">
                              {/* Outer highlight ring for selected node */}
                              {isSelected && (
                                <circle
                                  cx={node.x}
                                  cy={node.y}
                                  r={anchorRadius + 2.5 / zoom}
                                  fill="none"
                                  stroke="#ef4444"
                                  strokeWidth={1.5 / zoom}
                                  strokeOpacity={0.8}
                                />
                              )}
                              {/* Clean Anchor Dot (Smooth = Circle, Corner = Diamond/Square) */}
                              {isSmooth ? (
                                <circle
                                  cx={node.x}
                                  cy={node.y}
                                  r={anchorRadius}
                                  fill={isSelected ? '#ef4444' : '#0284c7'}
                                  stroke="#ffffff"
                                  strokeWidth={1.2 / zoom}
                                />
                              ) : (
                                <rect
                                  x={node.x - anchorRadius}
                                  y={node.y - anchorRadius}
                                  width={anchorRadius * 2}
                                  height={anchorRadius * 2}
                                  rx={0.8 / zoom}
                                  fill={isSelected ? '#ef4444' : '#f59e0b'}
                                  stroke="#ffffff"
                                  strokeWidth={1.2 / zoom}
                                />
                              )}
                            </g>
                          ) : (
                            <g className="pointer-events-none">
                              {/* Classic/Full Box representation */}
                              <rect
                                x={node.x - 5 / zoom}
                                y={node.y - 5 / zoom}
                                width={10 / zoom}
                                height={10 / zoom}
                                rx={1 / zoom}
                                fill={isSelected ? '#ef4444' : isSmooth ? '#38bdf8' : '#f59e0b'}
                                stroke="#0f172a"
                                strokeWidth={1.5 / zoom}
                              />
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* ---------------- ACTIVE PEN CONTOUR PATH & RUBBER-BAND ---------------- */}
              {activePenContour && (
                <g className="active-pen-in-progress pointer-events-none select-none">
                  {/* Committed segments path */}
                  {activePenContour.nodes.length > 1 && (
                    <>
                      {/* Outer high-contrast white stroke */}
                      <path
                        d={penSvgPath}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={4 / zoom}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Inner vibrant cyan path stroke */}
                      <path
                        d={penSvgPath}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth={2.2 / zoom}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  )}

                  {/* Rubber-band dynamic guide line from last node to current mouse/hover pos */}
                  {(() => {
                    const lastNode = activePenContour.nodes[activePenContour.nodes.length - 1];
                    const mouseTarget = penMousePos || hoverCanvasPos;
                    if (!lastNode || !mouseTarget) return null;

                    const firstNode = activePenContour.nodes[0];
                    const distToStart = Math.hypot(mouseTarget.x - firstNode.x, mouseTarget.y - firstNode.y);
                    const isNearStart = activePenContour.nodes.length >= 2 && distToStart <= 24 / zoom;

                    return (
                      <g>
                        {/* Rubberband line */}
                        <line
                          x1={lastNode.x}
                          y1={lastNode.y}
                          x2={isNearStart ? firstNode.x : mouseTarget.x}
                          y2={isNearStart ? firstNode.y : mouseTarget.y}
                          stroke="#ffffff"
                          strokeWidth={3.5 / zoom}
                          strokeDasharray="5 3"
                        />
                        <line
                          x1={lastNode.x}
                          y1={lastNode.y}
                          x2={isNearStart ? firstNode.x : mouseTarget.x}
                          y2={isNearStart ? firstNode.y : mouseTarget.y}
                          stroke={isNearStart ? '#10b981' : '#0ea5e9'}
                          strokeWidth={2 / zoom}
                          strokeDasharray="5 3"
                        />

                        {/* Ghost node preview at cursor location */}
                        {!isNearStart && (
                          <g transform={`translate(${mouseTarget.x}, ${mouseTarget.y})`}>
                            <circle r={8 / zoom} fill="#0ea5e9" fillOpacity={0.2} stroke="#ffffff" strokeWidth={1.5 / zoom} strokeDasharray="3 2" />
                            <circle r={3.5 / zoom} fill="#0284c7" stroke="#ffffff" strokeWidth={1.2 / zoom} />
                          </g>
                        )}

                        {/* Near start / Close path indicator badge */}
                        {isNearStart && (
                          <g transform={`translate(${firstNode.x}, ${firstNode.y})`}>
                            <circle r={14 / zoom} fill="#10b981" fillOpacity={0.25} className="animate-ping" />
                            <circle r={10 / zoom} fill="#059669" stroke="#ffffff" strokeWidth={2.5 / zoom} />
                            <g transform={`translate(0, ${-22 / zoom})`}>
                              <rect
                                x={-45 / zoom}
                                y={-10 / zoom}
                                width={90 / zoom}
                                height={18 / zoom}
                                rx={4 / zoom}
                                fill="#022c22"
                                stroke="#34d399"
                                strokeWidth={1 / zoom}
                              />
                              <text
                                x={0}
                                y={3 / zoom}
                                fill="#6ee7b7"
                                fontSize={9.5 / zoom}
                                fontWeight="bold"
                                textAnchor="middle"
                                fontFamily="sans-serif"
                              >
                                クリックで閉じる
                              </text>
                            </g>
                          </g>
                        )}
                      </g>
                    );
                  })()}

                  {/* Nodes on active pen contour */}
                  {activePenContour.nodes.map((node, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === activePenContour.nodes.length - 1;
                    return (
                      <g key={node.id}>
                        {/* Outer white ring */}
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={isFirst ? 8.5 / zoom : 7 / zoom}
                          fill="#ffffff"
                        />
                        {/* Inner colored node */}
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={isFirst ? 6.5 / zoom : 5 / zoom}
                          fill={isFirst ? '#10b981' : isLast ? '#f59e0b' : '#0284c7'}
                        />
                        {/* First node indicator letter */}
                        {isFirst && (
                          <text
                            x={node.x}
                            y={node.y - 10 / zoom}
                            fill="#10b981"
                            fontSize={9.5 / zoom}
                            fontWeight="bold"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            始点
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          )}

          {/* ---------------- HIGH-CONTRAST CURSOR CROSSHAIR OVERLAY ---------------- */}
          {gridSettings.showCursorCrosshair && hoverCanvasPos && toolMode !== 'brush' && (
            <g className="canvas-cursor-crosshair pointer-events-none select-none">
              {/* Horizontal full line with dual-tone white/dark contrast */}
              <line
                x1={-300}
                y1={hoverCanvasPos.y}
                x2={1300}
                y2={hoverCanvasPos.y}
                stroke="#ffffff"
                strokeWidth={2.5 / zoom}
                strokeOpacity={0.6}
              />
              <line
                x1={-300}
                y1={hoverCanvasPos.y}
                x2={1300}
                y2={hoverCanvasPos.y}
                stroke="#059669"
                strokeWidth={1.2 / zoom}
                strokeDasharray="4 3"
              />

              {/* Vertical full line with dual-tone white/dark contrast */}
              <line
                x1={hoverCanvasPos.x}
                y1={-300}
                x2={hoverCanvasPos.x}
                y2={1300}
                stroke="#ffffff"
                strokeWidth={2.5 / zoom}
                strokeOpacity={0.6}
              />
              <line
                x1={hoverCanvasPos.x}
                y1={-300}
                x2={hoverCanvasPos.x}
                y2={1300}
                stroke="#059669"
                strokeWidth={1.2 / zoom}
                strokeDasharray="4 3"
              />

              {/* Central Target Reticle Ring */}
              <circle
                cx={hoverCanvasPos.x}
                cy={hoverCanvasPos.y}
                r={12 / zoom}
                fill="none"
                stroke="#ffffff"
                strokeWidth={2.5 / zoom}
              />
              <circle
                cx={hoverCanvasPos.x}
                cy={hoverCanvasPos.y}
                r={12 / zoom}
                fill="rgba(16, 185, 129, 0.1)"
                stroke="#10b981"
                strokeWidth={1.5 / zoom}
              />
              <circle
                cx={hoverCanvasPos.x}
                cy={hoverCanvasPos.y}
                r={2.5 / zoom}
                fill="#ffffff"
              />
              <circle
                cx={hoverCanvasPos.x}
                cy={hoverCanvasPos.y}
                r={1.5 / zoom}
                fill="#059669"
              />
            </g>
          )}

          {/* ---------------- ERASER TOOL SWEEP CIRCLE INDICATOR ---------------- */}
          {toolMode === 'eraser' && hoverCanvasPos && (
            <g className="eraser-sweep-reticle pointer-events-none select-none">
              {/* Outer high-contrast ring */}
              <circle
                cx={hoverCanvasPos.x}
                cy={hoverCanvasPos.y}
                r={(eraserSize / 2) / zoom}
                fill="rgba(239, 68, 68, 0.16)"
                stroke="#ffffff"
                strokeWidth={2.5 / zoom}
              />
              {/* Inner dashed red circle */}
              <circle
                cx={hoverCanvasPos.x}
                cy={hoverCanvasPos.y}
                r={(eraserSize / 2) / zoom}
                fill="none"
                stroke="#ef4444"
                strokeWidth={1.8 / zoom}
                strokeDasharray="4 3"
              />
              {/* Center point */}
              <circle
                cx={hoverCanvasPos.x}
                cy={hoverCanvasPos.y}
                r={2.5 / zoom}
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth={1 / zoom}
              />
            </g>
          )}

          {/* ---------------- ACTIVE SMART SNAP GUIDELINES (BASELINE, LSB, METRICS, OTHER CONTOURS) ---------------- */}
          {activeSnapGuides.length > 0 && (
            <g className="smart-snap-guidelines select-none pointer-events-none">
              {activeSnapGuides.map((guide) => {
                const isBaseline = guide.targetType === 'baseline';
                const isLsb = guide.targetType === 'lsb';
                const lineColor = guide.color || (isBaseline ? '#ef4444' : isLsb ? '#10b981' : '#06b6d4');
                const strokeW = (isBaseline || isLsb ? 2.5 : 2) / zoom;

                return (
                  <g key={guide.id}>
                    {guide.type === 'h' ? (
                      <>
                        {/* Outer Glow line */}
                        <line
                          x1={-300}
                          y1={guide.position}
                          x2={1300}
                          y2={guide.position}
                          stroke={lineColor}
                          strokeWidth={strokeW * 3}
                          strokeOpacity={0.35}
                        />
                        {/* Main Crisp Snap Line */}
                        <line
                          x1={-300}
                          y1={guide.position}
                          x2={1300}
                          y2={guide.position}
                          stroke={lineColor}
                          strokeWidth={strokeW}
                          strokeDasharray={isBaseline ? undefined : '6 4'}
                        />
                        {/* Snap Target Contact Marker */}
                        {guide.snapPoint && (
                          <g transform={`translate(${guide.snapPoint.x}, ${guide.position})`}>
                            <circle r={8 / zoom} fill={lineColor} fillOpacity={0.35} />
                            <circle r={4.5 / zoom} fill="#ffffff" stroke={lineColor} strokeWidth={2 / zoom} />
                            <line x1={-12 / zoom} y1={0} x2={12 / zoom} y2={0} stroke={lineColor} strokeWidth={1.8 / zoom} />
                            <line x1={0} y1={-12 / zoom} x2={0} y2={12 / zoom} stroke={lineColor} strokeWidth={1.8 / zoom} />
                          </g>
                        )}
                        {/* HUD Label Badge */}
                        <g
                          transform={`translate(${
                            guide.snapPoint
                              ? Math.max(30, Math.min(850, guide.snapPoint.x - (guide.targetName.length * 5) / zoom))
                              : 40
                          }, ${guide.position - 16 / zoom})`}
                        >
                          <rect
                            x={-6 / zoom}
                            y={-12 / zoom}
                            width={(guide.targetName.length * 11 + 28) / zoom}
                            height={18 / zoom}
                            rx={4 / zoom}
                            fill={isBaseline ? '#450a0a' : isLsb ? '#022c22' : '#082f49'}
                            fillOpacity={0.94}
                            stroke={lineColor}
                            strokeWidth={1.2 / zoom}
                          />
                          <text
                            x={3 / zoom}
                            y={1 / zoom}
                            fill={isBaseline ? '#fca5a5' : isLsb ? '#6ee7b7' : '#7dd3fc'}
                            fontSize={10.5 / zoom}
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {guide.targetName}
                          </text>
                        </g>
                      </>
                    ) : (
                      <>
                        {/* Outer Glow line */}
                        <line
                          x1={guide.position}
                          y1={-300}
                          x2={guide.position}
                          y2={1300}
                          stroke={lineColor}
                          strokeWidth={strokeW * 3}
                          strokeOpacity={0.35}
                        />
                        {/* Main Crisp Snap Line */}
                        <line
                          x1={guide.position}
                          y1={-300}
                          x2={guide.position}
                          y2={1300}
                          stroke={lineColor}
                          strokeWidth={strokeW}
                          strokeDasharray={isLsb ? undefined : '6 4'}
                        />
                        {/* Snap Target Contact Marker */}
                        {guide.snapPoint && (
                          <g transform={`translate(${guide.position}, ${guide.snapPoint.y})`}>
                            <circle r={8 / zoom} fill={lineColor} fillOpacity={0.35} />
                            <circle r={4.5 / zoom} fill="#ffffff" stroke={lineColor} strokeWidth={2 / zoom} />
                            <line x1={-12 / zoom} y1={0} x2={12 / zoom} y2={0} stroke={lineColor} strokeWidth={1.8 / zoom} />
                            <line x1={0} y1={-12 / zoom} x2={0} y2={12 / zoom} stroke={lineColor} strokeWidth={1.8 / zoom} />
                          </g>
                        )}
                        {/* HUD Label Badge */}
                        <g
                          transform={`translate(${guide.position + 10 / zoom}, ${
                            guide.snapPoint
                              ? Math.max(30, Math.min(940, guide.snapPoint.y - 10 / zoom))
                              : 60
                          })`}
                        >
                          <rect
                            x={-4 / zoom}
                            y={-12 / zoom}
                            width={(guide.targetName.length * 11 + 28) / zoom}
                            height={18 / zoom}
                            rx={4 / zoom}
                            fill={isLsb ? '#022c22' : '#082f49'}
                            fillOpacity={0.94}
                            stroke={lineColor}
                            strokeWidth={1.2 / zoom}
                          />
                          <text
                            x={5 / zoom}
                            y={1 / zoom}
                            fill={isLsb ? '#6ee7b7' : '#7dd3fc'}
                            fontSize={10.5 / zoom}
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {guide.targetName}
                          </text>
                        </g>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          )}
        </g>
      </svg>



      {/* Dynamic Smooth Stroke & Operation Feedback Toast Notification (Bottom-Right Non-Intrusive) */}
      {canvasToast && (
        <div className="absolute bottom-12 right-3 z-30 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            className={`px-3 py-1.5 rounded-lg border shadow-lg backdrop-blur-md flex items-center gap-2 transition-all ${
              isLight
                ? 'bg-stone-900/90 border-stone-700 text-stone-100 shadow-stone-900/20'
                : 'bg-[#15241b]/95 border-emerald-600/60 text-emerald-100 shadow-black/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold leading-tight">{canvasToast.message}</div>
              {canvasToast.subText && (
                <div className="text-[10px] text-stone-300 dark:text-emerald-300 font-normal leading-tight mt-0.5">
                  {canvasToast.subText}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Intelligent Bottom Status & Controls Bar */}
      <div className="absolute bottom-2 left-2 right-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 z-20 select-none pointer-events-none">
        {/* Left: Real-time Coordinates & Active Tool Tips (Desktop only) */}
        {!isBottomBarCollapsed && (
          <div
            className={`hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg border shadow-md backdrop-blur-md text-xs pointer-events-auto transition-colors ${
              isLight
                ? 'bg-white/95 border-[#c8ded3] text-stone-800'
                : 'bg-[#142018]/95 border-[#25382c] text-emerald-100'
            }`}
          >
            {/* Tool Icon & Name */}
            <div className="flex items-center space-x-1.5 font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
              {toolMode === 'select' && <span>選択モード</span>}
              {toolMode === 'node' && <span>ノード編集</span>}
              {toolMode === 'pen' && <span>ペンツール</span>}
              {toolMode === 'brush' && <span>筆ストローク</span>}
              {toolMode === 'eraser' && <span>消しゴム</span>}
              {toolMode === 'ruler' && <span>定規計測</span>}
              {toolMode === 'hand' && <span>画面移動</span>}
              {toolMode === 'rect' && <span>四角形</span>}
              {toolMode === 'square' && <span>正方形</span>}
              {toolMode === 'ellipse' && <span>楕円</span>}
              {toolMode === 'circle' && <span>正円</span>}
              {toolMode === 'rounded_rect' && <span>角丸四角形</span>}
              {toolMode === 'triangle' && <span>三角形</span>}
              {toolMode === 'star' && <span>星型</span>}
              {toolMode === 'heart' && <span>ハート</span>}
              {toolMode === 'sparkle' && <span>4芒星</span>}
              {toolMode === 'starburst' && <span>8芒星</span>}
              {toolMode === 'diamond' && <span>菱形</span>}
              {toolMode === 'polygon' && <span>正六角形</span>}
              {toolMode === 'trace_adjust' && <span>下絵位置調整</span>}
              {isSpacePressed && <span className="text-emerald-500 font-normal ml-1">(Spaceドラッグ移動)</span>}
            </div>

            <div className="h-3.5 w-[1px] bg-stone-300 dark:bg-emerald-800 shrink-0" />

            {/* Real-time Cursor Coordinates */}
            <div className="font-mono text-[11px] text-stone-600 dark:text-emerald-300 shrink-0">
              {hoverCanvasPos ? (
                <span>
                  X: <strong className="text-emerald-700 dark:text-emerald-300">{hoverCanvasPos.x}</strong> Y:{' '}
                  <strong className="text-emerald-700 dark:text-emerald-300">{hoverCanvasPos.y}</strong>
                </span>
              ) : (
                <span className="text-stone-400">キャンバス内</span>
              )}
            </div>

            <div className="h-3.5 w-[1px] bg-stone-300 dark:bg-emerald-800 hidden md:block shrink-0" />

            {/* Ruler Mode Toggle (Draw Straight Line vs Measure) */}
            {toolMode === 'ruler' && (
              <div className="flex items-center space-x-0.5 bg-stone-200/80 dark:bg-[#18261e] p-0.5 rounded-lg border border-stone-300 dark:border-[#25362b] shrink-0">
                <button
                  onClick={() => setRulerMode('draw')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                    rulerMode === 'draw'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:text-emerald-800'
                  }`}
                  title="ドラッグ＆ドロップで直接綺麗な直線ストロークを作図します"
                >
                  直線を作図
                </button>
                <button
                  onClick={() => setRulerMode('measure')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                    rulerMode === 'measure'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:text-emerald-800'
                  }`}
                  title="ドラッグして距離・角度を計測します"
                >
                  寸法計測
                </button>
              </div>
            )}

            {/* Contextual Operation Hints */}
            <div className="text-[11px] text-stone-500 dark:text-emerald-400/80 hidden md:block truncate max-w-[280px]">
              {toolMode === 'ruler' &&
                (rulerMode === 'draw'
                  ? 'ドラッグして直線を引く (Shiftで水平/垂直/45°固定、ブラシ太さと連動)'
                  : 'ドラッグして計測 (Shiftで水平/垂直固定、Enterで直線を作図)')}
              {toolMode === 'select' && '輪郭をクリックして移動・8方向変形・回転'}
              {toolMode === 'node' && 'ノードやハンドルをクリック・ドラッグして編集'}
              {toolMode === 'pen' && 'クリックで頂点追加 / 始点クリックでパスを閉じる'}
              {toolMode === 'brush' && 'ドラッグでストローク (Shiftで定規のように水平/垂直/45度の直線を引く)'}
              {toolMode === 'eraser' && 'ドラッグまたはクリックで不要な輪郭を消去'}
              {toolMode === 'trace_adjust' && 'ドラッグして下絵の位置を移動'}
              {toolMode === 'hand' && 'ドラッグしてキャンバスを自由に移動'}
              {isShapeTool && 'ドラッグして図形を描画 (Shiftで1:1、Altで中心基準)'}
            </div>

            {/* Ruler Actions if measured */}
            {rulerMeasurement && (
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDrawRulerAsStroke();
                  }}
                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 transition-colors shadow-xs"
                  title="定規で測ったラインを直線ストロークとしてキャンバスに作成 (Enterキーでも作図可能)"
                >
                  <PenTool className="w-3 h-3" />
                  <span>直線を作図 (Enter)</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConvertRulerToGuideline();
                  }}
                  className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold flex items-center gap-1 transition-colors shadow-xs"
                  title="定規の位置にガイド線（水平または垂直）を作成"
                >
                  <Ruler className="w-3 h-3" />
                  <span>ガイド線</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRulerMeasurement(null);
                  }}
                  className="px-1.5 py-0.5 rounded bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-[10px] font-bold flex items-center gap-1 transition-colors"
                  title="定規の計測表示を消去"
                >
                  <X className="w-3 h-3" />
                  <span>クリア</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Right: Floating Canvas Controls (Compactable) */}
        <div className="flex items-center space-x-1.5 pointer-events-auto self-end sm:self-auto flex-wrap gap-y-1 ml-auto">
          {/* Collapsed Compact Mini Bar */}
          {isBottomBarCollapsed ? (
            <div
              className={`flex items-center p-1 rounded-xl border shadow-md backdrop-blur-md space-x-1 transition-all ${
                isLight
                  ? 'bg-white/95 border-[#c8ded3] text-stone-700'
                  : 'bg-[#142018]/95 border-[#25382c] text-emerald-200'
              }`}
            >
              <button
                onClick={toggleBottomBarCollapse}
                title="ミニバーを展開"
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  isLight
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                    : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300'
                }`}
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span className="text-[11px]">操作バー展開</span>
              </button>
              <div className="h-3 w-[1px] bg-stone-300 dark:bg-emerald-800" />
              <button
                onClick={() => resetView('100%')}
                title="等倍 100% 表示"
                className="text-[10px] font-mono px-1.5 py-0.5 rounded hover:bg-emerald-100/60 dark:hover:bg-emerald-900/60 font-bold"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => resetView('fit')}
                title="画面全体に最適フィット"
                className="p-1 rounded hover:bg-emerald-100/50"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => resetView('width')}
                title="幅基準で拡大"
                className="text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-emerald-100/60 dark:hover:bg-emerald-900/60"
              >
                幅
              </button>
            </div>
          ) : (
            <>
              {/* Palm Rejection Mode Quick Indicator & Toggle */}
              <button
                onClick={() => {
                  const nextMode =
                    palmRejectionMode === 'auto'
                      ? 'strict_pen_only'
                      : palmRejectionMode === 'strict_pen_only'
                      ? 'off'
                      : 'auto';
                  handleSetPalmRejectionMode(nextMode);
                  showCanvasToast(
                    `パームリジェクション: ${
                      nextMode === 'auto'
                        ? '自動検知（ペン使用時に手のひら無効化）'
                        : nextMode === 'strict_pen_only'
                        ? 'ペン専用（指作図を完全遮断）'
                        : 'OFF（指でも作図可能）'
                    }`
                  );
                }}
                className={`hidden md:flex px-2 py-1 rounded-lg text-[10px] font-bold items-center space-x-1 border shadow-xs transition-all ${
                  palmRejectionMode === 'strict_pen_only'
                    ? isLight
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-amber-950/80 text-amber-300 border-amber-700'
                    : palmRejectionMode === 'auto'
                    ? isLight
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : 'bg-[#16251b] text-emerald-300 border-emerald-700'
                    : isLight
                    ? 'bg-stone-100 text-stone-500 border-stone-300'
                    : 'bg-stone-900 text-stone-500 border-stone-800'
                }`}
                title="パームリジェクション設定（クリックで切替: 自動検知 / ペン専用 / OFF）"
              >
                {palmRejectionMode === 'strict_pen_only' ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                <span>
                  {palmRejectionMode === 'strict_pen_only'
                    ? 'ペン専用'
                    : palmRejectionMode === 'auto'
                    ? 'パーム検知'
                    : 'タッチ有効'}
                </span>
              </button>

              {isStylusActive && (
                <div
                  className={`flex px-2 py-1 rounded-lg text-[10px] font-bold items-center space-x-1.5 border shadow-xs transition-all ${
                    isLight
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : 'bg-[#16251b] text-emerald-300 border-emerald-700'
                  }`}
                  title="Apple Pencil / スタイラスペン入力検知中（筆圧・筆致自動反映）"
                >
                  <span className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    <span>Apple Pencil</span>
                  </span>
                  {liveStylusPressure !== null && (
                    <span className="font-mono text-[9px] bg-emerald-200/50 dark:bg-emerald-900/50 px-1 py-0.2 rounded">
                      {liveStylusPressure}%
                    </span>
                  )}
                  {onChangePressureSensitivity && (
                    <div className="flex items-center space-x-0.5 border-l border-emerald-300/60 dark:border-emerald-700/60 pl-1">
                      {(['high', 'normal', 'low', 'off'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => onChangePressureSensitivity(s)}
                          className={`px-1 py-0.2 text-[8.5px] rounded font-medium transition-colors ${
                            pressureSensitivity === s
                              ? isLight
                                ? 'bg-emerald-700 text-white font-bold'
                                : 'bg-emerald-400 text-stone-950 font-bold'
                              : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          {s === 'high' ? '高' : s === 'normal' ? '標' : s === 'low' ? '弱' : '切'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {toolMode === 'trace_adjust' && (
                <div
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center space-x-1.5 shadow-md animate-pulse ${
                    isLight ? 'bg-blue-600 text-white' : 'bg-blue-500 text-stone-950'
                  }`}
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>ドラッグして下絵写真を移動中</span>
                </div>
              )}

              <div
                className={`flex items-center p-1 rounded-lg border shadow-md backdrop-blur-md space-x-1 ${
                  isLight
                    ? 'bg-white/95 border-[#c8ded3] text-stone-700'
                    : 'bg-[#142018]/95 border-[#25382c] text-emerald-200'
                }`}
              >
                {/* Grid Size Quick Indicator & Adjustment */}
                {gridSettings.showGrid && onChangeGridSettings && (
                  <div
                    className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border text-[11px] font-mono font-medium mr-1 ${
                      isLight
                        ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                        : 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
                    }`}
                    title="方眼グリッドサイズ (ショートカット: GキーでON/OFF, + / - キーで微調整)"
                  >
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-sans font-bold">方眼</span>
                    <span className="font-bold">{gridSettings.gridSize || 50}px</span>
                    <div className="flex items-center ml-0.5 space-x-0.5">
                      <button
                        onClick={() =>
                          onChangeGridSettings((prev) => {
                            const current = prev.gridSize || 50;
                            const step = current > 100 ? 10 : current <= 20 ? 2 : 5;
                            return { ...prev, gridSize: Math.max(5, current - step) };
                          })
                        }
                        title="グリッドサイズ縮小 (- キー)"
                        className="px-1 py-0.5 rounded hover:bg-emerald-200/70 dark:hover:bg-emerald-800 text-xs font-bold leading-none"
                      >
                        -
                      </button>
                      <button
                        onClick={() =>
                          onChangeGridSettings((prev) => {
                            const current = prev.gridSize || 50;
                            const step = current >= 100 ? 10 : current < 20 ? 2 : 5;
                            return { ...prev, gridSize: Math.min(250, current + step) };
                          })
                        }
                        title="グリッドサイズ拡大 (+ キー)"
                        className="px-1 py-0.5 rounded hover:bg-emerald-200/70 dark:hover:bg-emerald-800 text-xs font-bold leading-none"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {traceSettings.enabled && onChangeTraceSettings && (
                  <button
                    onClick={() =>
                      onChangeTraceSettings((s) => ({
                        ...s,
                        opacity: s.opacity > 0.1 ? 0.05 : 0.4,
                      }))
                    }
                    title="下絵の濃淡を素早く切り替え"
                    className={`p-1.5 rounded hover:bg-emerald-100/50 ${
                      isLight ? 'text-stone-600' : 'text-emerald-300'
                    }`}
                  >
                    {traceSettings.opacity > 0.1 ? (
                      <Eye className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-stone-400" />
                    )}
                  </button>
                )}

                {/* High Contrast Cursor Quick Toggle */}
                {onChangeGridSettings && (
                  <button
                    onClick={() =>
                      onChangeGridSettings((prev) => ({
                        ...prev,
                        highContrastCursor: prev.highContrastCursor === false ? true : false,
                      }))
                    }
                    title={`高視認性カーソル: ${gridSettings.highContrastCursor !== false ? 'ON (背景と同化しない二重輪郭)' : 'OFF'}`}
                    className={`p-1.5 rounded transition-colors ${
                      gridSettings.highContrastCursor !== false
                        ? isLight
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                          : 'bg-emerald-800 text-amber-300 font-bold'
                        : isLight
                        ? 'text-stone-600 hover:bg-emerald-100/50'
                        : 'text-emerald-400 hover:bg-emerald-900/40'
                    }`}
                  >
                    <MousePointer className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Cursor Crosshair Reticle Quick Toggle */}
                {onChangeGridSettings && (
                  <button
                    onClick={() =>
                      onChangeGridSettings((prev) => ({
                        ...prev,
                        showCursorCrosshair: !prev.showCursorCrosshair,
                      }))
                    }
                    title={`カーソル照準十字線: ${gridSettings.showCursorCrosshair ? '表示中' : '非表示 (クリックでON)'}`}
                    className={`p-1.5 rounded transition-colors ${
                      gridSettings.showCursorCrosshair
                        ? isLight
                          ? 'bg-emerald-600 text-white font-bold shadow-xs'
                          : 'bg-emerald-600 text-white font-bold'
                        : isLight
                        ? 'text-stone-600 hover:bg-emerald-100/50'
                        : 'text-emerald-400 hover:bg-emerald-900/40'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Clear all contours of current character */}
                {contours.length > 0 && (
                  <button
                    onClick={handleClearAllContours}
                    title="この文字の全パスをリセット・クリア (Ctrl+Zで復元可能)"
                    className={`p-1.5 rounded transition-colors text-rose-600 hover:bg-rose-100/60 dark:text-rose-400 dark:hover:bg-rose-950/40`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => handleZoomStep(1.25)}
                  title="拡大 (Zoom In) [+]"
                  className={`p-1.5 rounded hover:bg-emerald-100/50 ${
                    isLight ? 'text-stone-700' : 'text-emerald-200'
                  }`}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <button
                  onClick={() => resetView('100%')}
                  title="等倍 100% 表示 (1キー)"
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded hover:bg-emerald-100/60 dark:hover:bg-emerald-900/60 font-bold transition-colors cursor-pointer"
                >
                  {Math.round(zoom * 100)}%
                </button>

                <button
                  onClick={() => handleZoomStep(1 / 1.25)}
                  title="縮小 (Zoom Out) [-]"
                  className={`p-1.5 rounded hover:bg-emerald-100/50 ${
                    isLight ? 'text-stone-700' : 'text-emerald-200'
                  }`}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <button
                  onClick={() => resetView('fit')}
                  title="画面全体に最適フィット (0キー)"
                  className={`p-1.5 rounded hover:bg-emerald-100/50 ${
                    isLight ? 'text-stone-700' : 'text-emerald-200'
                  }`}
                >
                  <Maximize2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => resetView('width')}
                  title="余白なし・幅いっぱいに拡大 (Wキー)"
                  className={`hidden md:inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-emerald-100/60 dark:hover:bg-emerald-900/60 transition-colors ${
                    isLight ? 'text-emerald-800' : 'text-emerald-300'
                  }`}
                >
                  幅基準
                </button>

                {/* Zen / Wide Canvas Mode Toggle */}
                {onToggleZenMode && (
                  <button
                    onClick={onToggleZenMode}
                    title={`全面作図・集中モード (サイドバー収納): ${isZenMode ? 'ON' : 'OFF'} (Zキー)`}
                    className={`p-1.5 rounded transition-all ${
                      isZenMode
                        ? isLight
                          ? 'bg-amber-400 text-emerald-950 font-bold shadow-xs'
                          : 'bg-emerald-500 text-stone-950 font-bold shadow-xs'
                        : isLight
                        ? 'text-stone-700 hover:bg-emerald-100/50'
                        : 'text-emerald-300 hover:bg-emerald-900/40'
                    }`}
                  >
                    {isZenMode ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                )}

                {/* Compact Bar Toggle Button */}
                <div className="h-4 w-[1px] bg-stone-300 dark:bg-emerald-800 mx-0.5" />
                <button
                  onClick={toggleBottomBarCollapse}
                  title="フローティングバーをコンパクト化（画面を広く使う）"
                  className={`p-1.5 rounded transition-colors ${
                    isLight ? 'text-stone-500 hover:bg-stone-100' : 'text-emerald-400 hover:bg-emerald-900/40'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Mobile Minimal Floating Zoom & Fit Pill */}
        <div
          className={`sm:hidden ml-auto flex items-center p-0.5 rounded-full border shadow-md backdrop-blur-md pointer-events-auto text-xs ${
            isLight
              ? 'bg-white/95 border-[#c8ded3] text-stone-700'
              : 'bg-[#142018]/95 border-[#25382c] text-emerald-200'
          }`}
        >
          <button
            onClick={() => handleZoomStep(1 / 1.25)}
            className="p-1 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800"
            title="縮小"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => resetView('fit')}
            className="text-[10px] font-mono px-1.5 font-bold"
            title="フィット"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => handleZoomStep(1.25)}
            className="p-1 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800"
            title="拡大"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-3 bg-stone-300 dark:bg-stone-700 mx-0.5" />
          <button
            onClick={() => resetView('width')}
            className="p-1 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 text-[10px] font-bold"
            title="幅いっぱいに拡大"
          >
            幅
          </button>
          <button
            onClick={() => resetView('fit')}
            className="p-1 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800"
            title="全体表示"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile Selected Contour Quick Action Bar */}
      {selectedContourIds.length > 0 && (
        <div
          className={`sm:hidden absolute bottom-12 left-3 right-3 z-30 flex items-center justify-between px-3 py-1.5 rounded-full border shadow-xl backdrop-blur-md animate-fadeIn ${
            isLight
              ? 'bg-white/95 border-emerald-300/80 text-stone-800 shadow-emerald-950/10'
              : 'bg-[#121c15]/95 border-emerald-700/60 text-emerald-100 shadow-black/50'
          }`}
        >
          <div className="flex items-center space-x-1">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              選択中{selectedContourIds.length > 1 ? ` (${selectedContourIds.length}個)` : ''}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            {selectedContourIds.length >= 1 && (
              <button
                onClick={handleMergeSelectedContours}
                className="px-2.5 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold shadow-xs active:scale-95 transition-transform flex items-center gap-1"
                title={selectedContourIds.length === 1 ? '一筆書きの重なり白抜きを解消' : '選択したパスを合体・白抜き解消'}
              >
                {selectedContourIds.length === 1 ? (
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                ) : (
                  <Layers className="w-3.5 h-3.5" />
                )}
                <span>{selectedContourIds.length === 1 ? '白抜き解消' : '合体'}</span>
              </button>
            )}
            <button
              onClick={() => setShowMobilePartSheet(true)}
              className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-xs active:scale-95 transition-transform"
            >
              パーツ変形
            </button>
            <button
              onClick={handleDuplicateSelected}
              className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-emerald-300"
              title="複製"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={handleDeleteSelected}
              className="p-1.5 rounded-full hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400"
              title="削除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setSelectedContourIds([]);
                setSelectedNodeId(null);
              }}
              className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
              title="選択解除"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>

    {/* Mobile Bottom Drawers / Action Sheets */}
    {/* 1. Part Transform Bottom Sheet */}
    {showMobilePartSheet && (
      <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-fadeIn">
        <div
          className="fixed inset-0"
          onClick={() => setShowMobilePartSheet(false)}
        />
        <div
          className={`relative z-10 w-full rounded-t-2xl p-4 border-t shadow-2xl max-h-[75vh] overflow-y-auto ${
            isLight
              ? 'bg-white border-[#c8ded3] text-stone-800'
              : 'bg-[#151f19] border-[#25362b] text-emerald-100'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-3">
            <div className="font-bold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <span>選択輪郭パーツの変形・調整</span>
            </div>
            <button
              onClick={() => setShowMobilePartSheet(false)}
              className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {/* Merge paths or resolve cursive loops */}
            {selectedContourIds.length >= 1 && (
              <div>
                <div className="font-bold text-stone-500 dark:text-stone-400 mb-1.5">
                  {selectedContourIds.length === 1 ? '一筆書き重なり白抜きの解消' : 'パスの合体・白抜き解消'}
                </div>
                <button
                  onClick={() => {
                    handleMergeSelectedContours();
                    setShowMobilePartSheet(false);
                  }}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all text-xs"
                >
                  {selectedContourIds.length === 1 ? (
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  ) : (
                    <Layers className="w-4 h-4" />
                  )}
                  <span>
                    {selectedContourIds.length === 1
                      ? '一筆書きの交差ループを結合し白抜きを解消'
                      : `選択した${selectedContourIds.length}個のパスを合体して白抜きを解消`}
                  </span>
                </button>
              </div>
            )}

            {/* Flip and Rotate */}
            <div>
              <div className="font-bold text-stone-500 dark:text-stone-400 mb-1.5">反転・回転</div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={handleFlipHSelected}
                  className="p-2 rounded-lg border flex flex-col items-center gap-1 bg-stone-50 dark:bg-stone-900/60 hover:bg-emerald-50 dark:hover:bg-[#1f2f24] font-medium"
                >
                  <FlipHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>左右反転</span>
                </button>
                <button
                  onClick={handleFlipVSelected}
                  className="p-2 rounded-lg border flex flex-col items-center gap-1 bg-stone-50 dark:bg-stone-900/60 hover:bg-emerald-50 dark:hover:bg-[#1f2f24] font-medium"
                >
                  <FlipVertical className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>上下反転</span>
                </button>
                <button
                  onClick={() => handleRotateSelected(90)}
                  className="p-2 rounded-lg border flex flex-col items-center gap-1 bg-stone-50 dark:bg-stone-900/60 hover:bg-emerald-50 dark:hover:bg-[#1f2f24] font-medium"
                >
                  <RotateCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>+90°回転</span>
                </button>
                <button
                  onClick={() => handleSlantSelected(0.2)}
                  className="p-2 rounded-lg border flex flex-col items-center gap-1 bg-stone-50 dark:bg-stone-900/60 hover:bg-emerald-50 dark:hover:bg-[#1f2f24] font-medium"
                >
                  <Italic className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>斜体</span>
                </button>
              </div>
            </div>

            {/* Scale and Duplicate */}
            <div>
              <div className="font-bold text-stone-500 dark:text-stone-400 mb-1.5">サイズ伸縮・複製</div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => handleScaleSelected(1.1)}
                  className="p-2 rounded-lg border flex items-center justify-center gap-1 bg-stone-50 dark:bg-stone-900/60 hover:bg-emerald-50 dark:hover:bg-[#1f2f24] font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>拡大 +10%</span>
                </button>
                <button
                  onClick={() => handleScaleSelected(0.9)}
                  className="p-2 rounded-lg border flex items-center justify-center gap-1 bg-stone-50 dark:bg-stone-900/60 hover:bg-emerald-50 dark:hover:bg-[#1f2f24] font-medium"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>縮小 -10%</span>
                </button>
                <button
                  onClick={handleDuplicateSelected}
                  className="p-2 rounded-lg border flex items-center justify-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 font-bold"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>パーツ複製</span>
                </button>
              </div>
            </div>

            {/* Smoothing and Optimization */}
            <div>
              <div className="font-bold text-stone-500 dark:text-stone-400 mb-1.5">ストローク最適化・美化</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleSmoothStrokeSelected('standard', true)}
                  className="p-2 rounded-lg border flex items-center justify-center gap-1.5 bg-stone-50 dark:bg-stone-900/60 hover:bg-emerald-50 dark:hover:bg-[#1f2f24] font-medium"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>筆跡スムーズ化</span>
                </button>
                <button
                  onClick={() => handleSimplifySelected(6)}
                  className="p-2 rounded-lg border flex items-center justify-center gap-1.5 bg-stone-50 dark:bg-stone-900/60 hover:bg-emerald-50 dark:hover:bg-[#1f2f24] font-medium"
                >
                  <Wand2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>アンカー点削減</span>
                </button>
              </div>
            </div>

            {/* Delete button */}
            <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
              <button
                onClick={() => {
                  handleDeleteSelected();
                  setShowMobilePartSheet(false);
                }}
                className="w-full py-2 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/80 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>選択した輪郭パーツを削除</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* 2. Mobile Brush Presets & Width Bottom Sheet */}
    {showMobileBrushSheet && (
      <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-fadeIn">
        <div
          className="fixed inset-0"
          onClick={() => setShowMobileBrushSheet(false)}
        />
        <div
          className={`relative z-10 w-full rounded-t-2xl p-4 border-t shadow-2xl max-h-[75vh] overflow-y-auto ${
            isLight
              ? 'bg-white border-[#c8ded3] text-stone-800'
              : 'bg-[#151f19] border-[#25362b] text-emerald-100'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-3">
            <div className="font-bold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <span>手書きペンの種類と太さ</span>
            </div>
            <button
              onClick={() => setShowMobileBrushSheet(false)}
              className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stroke Width Slider */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-stone-500 dark:text-stone-400">線の太さ (Stroke Width)</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">{brushWidth} px</span>
            </div>
            <input
              type="range"
              min={2}
              max={160}
              value={brushWidth}
              onChange={(e) => onChangeBrushWidth?.(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-600 h-2 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex items-center justify-between mt-1.5">
              {[8, 16, 28, 48, 80, 120].map((w) => (
                <button
                  key={w}
                  onClick={() => onChangeBrushWidth?.(w)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                    brushWidth === w
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-stone-100 dark:bg-stone-900 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {w}px
                </button>
              ))}
            </div>
          </div>

          {/* Pressure Sensitivity Control */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-stone-500 dark:text-stone-400">筆圧感知 (Pressure Sensitivity)</span>
              <span className={`font-mono text-xs px-1.5 py-0.5 rounded font-bold ${
                pressureSensitivity !== 'off'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                  : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
              }`}>
                {pressureSensitivity !== 'off' ? '有効 (ON)' : '無効 (OFF)'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: 'off', label: 'OFF (一定)' },
                { id: 'low', label: '低感度' },
                { id: 'normal', label: '標準' },
                { id: 'high', label: '高感度' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => onChangePressureSensitivity?.(item.id as 'high' | 'normal' | 'low' | 'off')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold border transition-colors text-center ${
                    pressureSensitivity === item.id
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-stone-100 dark:bg-stone-900 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Straight Ruler Line Assist Toggle for Mobile */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-stone-500 dark:text-stone-400">定規直線モード (Straight Line)</span>
              <span className={`font-mono text-xs px-1.5 py-0.5 rounded font-bold ${
                brushStraightMode
                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200'
                  : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
              }`}>
                {brushStraightMode ? '有効 (ON)' : '無効 (OFF)'}
              </span>
            </div>
            <button
              onClick={() => {
                const next = !brushStraightMode;
                setBrushStraightMode(next);
                showCanvasToast(
                  next
                    ? '定規直線モードをONにしました (ドラッグで水平・垂直・45度の直線を引けます)'
                    : '定規直線モードをOFFにしました'
                );
              }}
              className={`w-full py-2 px-3 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${
                brushStraightMode
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                  : 'bg-stone-100 dark:bg-stone-900 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
              }`}
            >
              <Ruler className="w-4 h-4" />
              <span>{brushStraightMode ? '定規直線モード: ON (手ブレなし直線)' : '定規直線モード: OFF (通常手書き)'}</span>
            </button>
          </div>

          {/* Pen Presets Grid */}
          <div>
            <div className="font-bold text-xs text-stone-500 dark:text-stone-400 mb-2">ペンの種類</div>
            <div className="grid grid-cols-2 gap-2">
              {PEN_PRESETS.map((preset) => {
                const isSelected = brushStyle === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      onChangeBrushStyle?.(preset.id);
                      if (preset.defaultWidth && onChangeBrushWidth) {
                        onChangeBrushWidth(preset.defaultWidth);
                      }
                      setShowMobileBrushSheet(false);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? isLight
                          ? 'bg-emerald-100/90 text-emerald-950 font-bold border-emerald-400 ring-1 ring-emerald-400'
                          : 'bg-emerald-950/80 text-emerald-200 font-bold border-emerald-600 ring-1 ring-emerald-600'
                        : isLight
                        ? 'bg-stone-50 hover:bg-emerald-50/50 border-stone-200 text-stone-700'
                        : 'bg-stone-900/60 hover:bg-[#1f2f24] border-stone-800 text-emerald-300'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>{preset.name}</span>
                      {isSelected && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">✓ 選択中</span>}
                    </div>
                    <div className="text-[10px] opacity-75 mt-0.5 truncate">{preset.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* 3. Mobile Guides & Grid Bottom Sheet */}
    {showMobileGuidesSheet && (
      <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-fadeIn">
        <div
          className="fixed inset-0"
          onClick={() => setShowMobileGuidesSheet(false)}
        />
        <div
          className={`relative z-10 w-full rounded-t-2xl p-4 border-t shadow-2xl max-h-[75vh] overflow-y-auto ${
            isLight
              ? 'bg-white border-[#c8ded3] text-stone-800'
              : 'bg-[#151f19] border-[#25362b] text-emerald-100'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-3">
            <div className="font-bold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <span>田 和文・方眼ガイド枠の設定</span>
            </div>
            <button
              onClick={() => setShowMobileGuidesSheet(false)}
              className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {/* Japanese Guide Pattern */}
            <div>
              <div className="font-bold text-stone-500 dark:text-stone-400 mb-1.5">和文目安ガイド</div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'none', label: 'なし' },
                  { id: 'cross', label: '十字格' },
                  { id: 'tian', label: '田字格' },
                  { id: 'mi', label: '米字格' },
                ].map((g) => (
                  <button
                    key={g.id}
                    onClick={() =>
                      onChangeGridSettings?.((prev) => ({
                        ...prev,
                        japaneseGuide: g.id as any,
                      }))
                    }
                    className={`py-2 px-1 rounded-lg border text-center font-bold transition-all ${
                      (gridSettings.japaneseGuide || 'tian') === g.id
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Kanji / Kana Frames */}
            <div>
              <div className="font-bold text-stone-500 dark:text-stone-400 mb-1.5">字面枠表示</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    onChangeGridSettings?.((prev) => ({
                      ...prev,
                      showBodyFrame: !prev.showBodyFrame,
                    }))
                  }
                  className={`p-2 rounded-lg border font-bold flex items-center justify-between ${
                    gridSettings.showBodyFrame !== false
                      ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                      : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500'
                  }`}
                >
                  <span>漢字字面枠 (85%)</span>
                  <span>{gridSettings.showBodyFrame !== false ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  onClick={() =>
                    onChangeGridSettings?.((prev) => ({
                      ...prev,
                      showKanaFrame: !prev.showKanaFrame,
                    }))
                  }
                  className={`p-2 rounded-lg border font-bold flex items-center justify-between ${
                    gridSettings.showKanaFrame
                      ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                      : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500'
                  }`}
                >
                  <span>仮名字面枠 (78%)</span>
                  <span>{gridSettings.showKanaFrame ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>

            {/* Node Points Appearance */}
            <div>
              <div className="font-bold text-stone-500 dark:text-stone-400 mb-1.5">パス頂点（ノード）表示</div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => {
                    setNodeStyle('clean');
                    setShowNodes(true);
                  }}
                  className={`p-2 rounded-lg border text-center font-bold transition-all ${
                    showNodes && nodeStyle === 'clean'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  形状優先
                </button>
                <button
                  onClick={() => {
                    setNodeStyle('selected_only');
                    setShowNodes(true);
                  }}
                  className={`p-2 rounded-lg border text-center font-bold transition-all ${
                    showNodes && nodeStyle === 'selected_only'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  選択のみ
                </button>
                <button
                  onClick={() => setShowNodes((prev) => !prev)}
                  className={`p-2 rounded-lg border text-center font-bold transition-all ${
                    !showNodes
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {showNodes ? '全隠す' : '非表示中'}
                </button>
              </div>
            </div>

            {/* Square Grid & Snapping */}
            <div>
              <div className="font-bold text-stone-500 dark:text-stone-400 mb-1.5">方眼グリッド & スナップ</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    onChangeGridSettings?.((prev) => ({
                      ...prev,
                      showGrid: !prev.showGrid,
                    }))
                  }
                  className={`p-2 rounded-lg border font-bold flex items-center justify-between ${
                    gridSettings.showGrid
                      ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                      : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500'
                  }`}
                >
                  <span>方眼グリッド線</span>
                  <span>{gridSettings.showGrid ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  onClick={() =>
                    onChangeGridSettings?.((prev) => ({
                      ...prev,
                      snapToGrid: !prev.snapToGrid,
                    }))
                  }
                  className={`p-2 rounded-lg border font-bold flex items-center justify-between ${
                    gridSettings.snapToGrid
                      ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                      : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500'
                  }`}
                >
                  <span>グリッド吸着</span>
                  <span>{gridSettings.snapToGrid ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>

            {/* Custom Guidelines Lock & Clear if any exist */}
            {customGuidelines.length > 0 && (
              <div>
                <div className="font-bold text-stone-500 dark:text-stone-400 mb-1.5">カスタムガイド線 ({customGuidelines.length}本)</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const next = !lockGuidelines;
                      setLockGuidelines(next);
                      showCanvasToast(next ? 'ガイド線を固定しました' : 'ガイド線ロック解除');
                    }}
                    className={`p-2 rounded-lg border font-bold flex items-center justify-between ${
                      lockGuidelines
                        ? 'bg-stone-100 dark:bg-stone-900 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                        : 'bg-amber-100 dark:bg-amber-950 border-amber-400 text-amber-900 dark:text-amber-200'
                    }`}
                  >
                    <span>{lockGuidelines ? 'ガイド固定中' : '移動可能'}</span>
                    <span className="text-[10px]">{lockGuidelines ? '固定' : '解除'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setCustomGuidelines([]);
                      showCanvasToast('カスタムガイド線を消去しました');
                      setShowMobileGuidesSheet(false);
                    }}
                    className="p-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ガイド全消去</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
);
};
