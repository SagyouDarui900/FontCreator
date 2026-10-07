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
 HelpCircle,
 Type,
 ArrowRightLeft,
 Hand,
 CircleDot,
 Disc,
 Moon,
 Slash,
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
 GlyphOverlaySettings,
 FontProject,
 PressureCurveConfig,
 UserPenPreset,
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
 createRightTriangleContour,
 createSemicircleContour,
 createRingContours,
 createPillContour,
 createParallelogramContour,
 createCrescentContour,
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
 doContoursIntersectOrTouch,
 normalizeGlyphContoursWinding,
 groupContoursWithHoles,
 resolveContourOverlaps,
 hasContourIntersections,
 reverseContour,
 getContoursBoundingBox,
 isPointNearContour,
 eraseContoursAtPoint,
 subtractEraserStrokeFromContours,
 PEN_PRESETS,
 insertNodeOnContourAtPoint,
 toggleNodeType,
 straightenWobblyContour,
 booleanSubtractContours,
 booleanIntersectContours,
 expandStrokeContours,
} from '../utils/pathUtils';
import {
 DAKUTEN_MAPPINGS,
 createDakutenContours,
 createHandakutenContours,
 cloneContours,
} from '../utils/dakutenHelper';
import { SCREEN_BASELINE_Y } from '../utils/fontCompiler';
import { ThemeMode, isLightTheme, getThemeClasses } from '../utils/theme';
import { JapaneseGuidesLayer } from './canvas/JapaneseGuidesLayer';
import { CanvasBackgroundLayer } from './canvas/CanvasBackgroundLayer';
import { AdjacentGlyphsLayer } from './canvas/AdjacentGlyphsLayer';
import { GlyphComparisonLayer } from './canvas/GlyphComparisonLayer';
import { MetricsGuidesLayer } from './canvas/MetricsGuidesLayer';
import { CanvasRulersLayer } from './canvas/CanvasRulersLayer';
import { TraceReferenceLayer, TraceResizeHandle } from './canvas/TraceReferenceLayer';
import { CustomGuidelinesLayer } from './canvas/CustomGuidelinesLayer';
import { RulerMeasurementLayer } from './canvas/RulerMeasurementLayer';
import { MainGlyphContoursLayer } from './canvas/MainGlyphContoursLayer';

const CANVAS_SHAPE_LIST: { id: ToolMode; label: string; icon: React.FC<{ className?: string }> }[] = [
 { id: 'rect', label: '長方形 (Rectangle)', icon: Square },
 { id: 'square', label: '正方形 (Square)', icon: Square },
 { id: 'ellipse', label: '楕円 (Ellipse)', icon: Circle },
 { id: 'circle', label: '正円 (Circle)', icon: Circle },
 { id: 'rounded_rect', label: '角丸四角 (Rounded)', icon: Square },
 { id: 'pill', label: 'カプセル (Pill)', icon: CircleDot },
 { id: 'triangle', label: '正三角形 (Triangle)', icon: Triangle },
 { id: 'triangle_down', label: '逆三角形 (Inverted)', icon: Triangle },
 { id: 'right_triangle', label: '直角三角形 (Right Triangle)', icon: Triangle },
 { id: 'semicircle', label: '半円 (Semicircle)', icon: Circle },
 { id: 'ring', label: 'ドーナツ・二重円 (Ring)', icon: Disc },
 { id: 'parallelogram', label: '平行四辺形 (Parallelogram)', icon: Slash },
 { id: 'diamond', label: '菱形 (Diamond)', icon: Diamond },
 { id: 'polygon', label: '正六角形 (Hexagon)', icon: Hexagon },
 { id: 'line', label: '直線バー (Line)', icon: Minus },
 { id: 'star', label: '星型 (Star)', icon: Star },
 { id: 'sparkle', label: '4芒星 (Sparkle)', icon: Sparkles },
 { id: 'starburst', label: '8芒星 (Starburst)', icon: Sparkles },
 { id: 'heart', label: 'ハート (Heart)', icon: Heart },
 { id: 'crescent', label: '三日月 (Crescent)', icon: Moon },
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
// while fully preserving continuous fine-segmented pressure dynamics and fidelity
function getDecimatedPointsForLivePreview(pts: StrokePoint[]): StrokePoint[] {
 const len = pts.length;
 if (len <= 80) return pts;
 // Keep the most recent 50 points at 100% full fidelity for ultra-smooth dynamic response
 const tailCount = 50;
 const headCount = len - tailCount;
 const decimated: StrokePoint[] = [pts[0]];
 let lastX = pts[0].x;
 let lastY = pts[0].y;
 let lastP = pts[0].pressure ?? 0.5;
 for (let i = 1; i < headCount; i++) {
 const p = pts[i];
 const dx = p.x - lastX;
 const dy = p.y - lastY;
 const dp = Math.abs((p.pressure ?? 0.5) - lastP);
 // Dynamic distance threshold: preserve fine sampling for smooth curve rendering
 const distSq = dx * dx + dy * dy;
 if (distSq >= 2.25 || dp >= 0.015) {
 decimated.push(p);
 lastX = p.x;
 lastY = p.y;
 lastP = p.pressure ?? 0.5;
 }
 }
 for (let i = headCount; i < len; i++) {
 decimated.push(pts[i]);
 }
 return decimated;
}

interface GlyphCanvasProps {
 contours: PathContour[];
 onChangeContours: (contours: PathContour[], options?: { skipHistory?: boolean }) => void;
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
 pressureCurve?: PressureCurveConfig;
 smoothingIntensity?: number;
 onChangeSmoothingIntensity?: (val: number) => void;
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
 activePenPreset?: UserPenPreset;
 isAnyModalOpen?: boolean;
 overlaySettings?: GlyphOverlaySettings;
 project?: FontProject;
 onOpenGlyphCompareModal?: () => void;
 outlineOnly?: boolean;
 onChangeOutlineOnly?: (val: boolean) => void;
}

// High-Contrast SVG Cursor Definitions (Dual-layer white-outer / black-inner for 100% visibility on any light/dark background or grid)
const HIGH_CONTRAST_CROSSHAIR_CURSOR = `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16 2V12M16 20V30M2 16H12M20 16H30' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3Cpath d='M16 2V12M16 20V30M2 16H12M20 16H30' stroke='%230f172a' stroke-width='2' stroke-linecap='round'/%3E%3Ccircle cx='16' cy='16' r='4' fill='%2310b981' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E") 16 16, crosshair`;

const HIGH_CONTRAST_GRAB_CURSOR = `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 13V8C10 6.9 10.9 6 12 6C13.1 6 14 6.9 14 8V12M14 8C14 6.9 14.9 6 16 6C17.1 6 18 6.9 18 8V12M18 9C18 7.9 18.9 7 20 7C21.1 7 22 7.9 22 9V14M10 13C10 11.9 9.1 11 8 11C6.9 11 6 11.9 6 13V18C6 22.4 9.6 26 14 26H17C21.4 26 25 22.4 25 18V13C25 11.9 24.1 11 23 11C22.6 11 22.3 11.1 22 11.3V9' stroke='white' stroke-width='4.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M10 13V8C10 6.9 10.9 6 12 6C13.1 6 14 6.9 14 8V12M14 8C14 6.9 14.9 6 16 6C17.1 6 18 6.9 18 8V12M18 9C18 7.9 18.9 7 20 7C21.1 7 22 7.9 22 9V14M10 13C10 11.9 9.1 11 8 11C6.9 11 6 11.9 6 13V18C6 22.4 9.6 26 14 26H17C21.4 26 25 22.4 25 18V13C25 11.9 24.1 11 23 11C22.6 11 22.3 11.1 22 11.3V9' stroke='%230f172a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' fill='white'/%3E%3Ccircle cx='15.5' cy='18' r='2.5' fill='%2310b981' stroke='white' stroke-width='1'/%3E%3C/svg%3E") 15 15, grab`;

const HIGH_CONTRAST_GRABBING_CURSOR = `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M8 14C8 12.9 8.9 12 10 12H21C22.1 12 23 12.9 23 14V17C23 21.4 19.4 25 15 25H14C9.6 25 6 21.4 6 17V15C6 13.9 6.9 13 8 13V14Z' stroke='white' stroke-width='4.5' stroke-linejoin='round'/%3E%3Cpath d='M8 14C8 12.9 8.9 12 10 12H21C22.1 12 23 12.9 23 14V17C23 21.4 19.4 25 15 25H14C9.6 25 6 21.4 6 17V15C6 13.9 6.9 13 8 13V14Z' stroke='%230f172a' stroke-width='2' stroke-linejoin='round' fill='white'/%3E%3Cpath d='M10 12V16M14 12V16M18 12V16' stroke='%230f172a' stroke-width='1.5' stroke-linecap='round'/%3E%3Ccircle cx='14.5' cy='20' r='2.5' fill='%2310b981' stroke='white' stroke-width='1'/%3E%3C/svg%3E") 15 15, grabbing`;

const HIGH_CONTRAST_PEN_CURSOR = `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4 28L7 20L22 5C23.5 3.5 26.5 3.5 28 5C29.5 6.5 29.5 9.5 28 11L13 26L5 28L4 28Z' fill='white' stroke='%230f172a' stroke-width='2'/%3E%3Cpath d='M4 28L7 20L22 5C23.5 3.5 26.5 3.5 28 5C29.5 6.5 29.5 9.5 28 11L13 26L5 28L4 28Z' fill='%2310b981' fill-opacity='0.25'/%3E%3Ccircle cx='4' cy='28' r='2' fill='%23ef4444' stroke='white' stroke-width='1'/%3E%3C/svg%3E") 4 28, crosshair`;

const HIGH_CONTRAST_NODE_CURSOR = `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 4L22 14L14 16L11 25L6 4Z' fill='white' stroke='%230f172a' stroke-width='2.5' stroke-linejoin='round'/%3E%3Cpath d='M6 4L22 14L14 16L11 25L6 4Z' fill='%230284c7'/%3E%3C/svg%3E") 6 4, default`;

const HIGH_CONTRAST_ERASER_CURSOR = `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 22L16 12L22 18L12 28L6 28Z' fill='white' stroke='%230f172a' stroke-width='3' stroke-linejoin='round'/%3E%3Cpath d='M6 22L16 12L22 18L12 28L6 28Z' fill='%23ef4444' stroke='%230f172a' stroke-width='1.5' stroke-linejoin='round'/%3E%3Cpath d='M11 17L17 23' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M12 28H26' stroke='%230f172a' stroke-width='2.5' stroke-linecap='round'/%3E%3Ccircle cx='6' cy='28' r='2' fill='%2310b981' stroke='white' stroke-width='1'/%3E%3C/svg%3E") 6 28, crosshair`;

const HIGH_CONTRAST_ANCHOR_ERASER_CURSOR = `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='16' cy='16' r='13' stroke='white' stroke-width='3.5' stroke-dasharray='4 3'/%3E%3Ccircle cx='16' cy='16' r='13' stroke='%23f43f5e' stroke-width='2' stroke-dasharray='4 3'/%3E%3Cline x1='16' y1='3' x2='16' y2='29' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3Cline x1='16' y1='3' x2='16' y2='29' stroke='%23f43f5e' stroke-width='1.5' stroke-linecap='round'/%3E%3Cline x1='3' y1='16' x2='29' y2='16' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3Cline x1='3' y1='16' x2='29' y2='16' stroke='%23f43f5e' stroke-width='1.5' stroke-linecap='round'/%3E%3Crect x='11' y='11' width='10' height='10' rx='2' fill='white' stroke='%230f172a' stroke-width='2'/%3E%3Cline x1='13' y1='16' x2='19' y2='16' stroke='%23f43f5e' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") 16 16, crosshair`;

export const GlyphCanvas: React.FC<GlyphCanvasProps> = React.memo(({
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
 pressureCurve,
 smoothingIntensity = 50,
 onChangeSmoothingIntensity,
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
 activePenPreset,
 isAnyModalOpen = false,
 overlaySettings,
 project,
 onOpenGlyphCompareModal,
 outlineOnly: propOutlineOnly,
 onChangeOutlineOnly,
}) => {
 const onUndoRef = useRef(onUndo);
 onUndoRef.current = onUndo;
 const onRedoRef = useRef(onRedo);
 onRedoRef.current = onRedo;

 const containerRef = useRef<HTMLDivElement>(null);
 const contoursRef = useRef<PathContour[]>(contours);
 useEffect(() => {
 contoursRef.current = contours;
 // Keep selection state strictly in-sync with current contours
 const validContourIds = new Set(contours.map((c) => c.id));
 setSelectedContourIds((prev) => prev.filter((id) => validContourIds.has(id)));
 setSelectedContourId((prev) => (prev && validContourIds.has(prev) ? prev : null));
 setSelectedNodeId((prev) => {
 if (!prev) return null;
 return contours.some((c) => c.nodes.some((n) => n.id === prev)) ? prev : null;
 });

 if (!contours || contours.length === 0) {
 if (activeBrushPathRef.current) {
 activeBrushPathRef.current.setAttribute('d', '');
 }
 activeBrushSvgDRef.current = '';
 if (activeEraserPathRef.current) {
 activeEraserPathRef.current.setAttribute('d', '');
 }
 activeEraserSvgDRef.current = '';
 brushStrokePointsRef.current = [];
 setSelectedContourIds([]);
 setSelectedContourId(null);
 setSelectedNodeId(null);
 setSelectedHandleType(null);
 isErasingRef.current = false;
 lastErasePosRef.current = null;
 eraserStrokePointsRef.current = [];
 erasedAnyInSessionRef.current = false;
 }
 }, [contours]);

 const isLight = isLightTheme(theme);
 const themeClasses = getThemeClasses(theme);
 const selectionColor = themeClasses.selectionStroke || '#10b981';

 const inkFillColor = useMemo(() => {
 if (theme === 'sepia') return '#2d2217';
 if (theme === 'warm') return '#292019';
 if (theme === 'nord') return '#eceff4';
 if (theme === 'monochrome') return '#000000';
 return isLight ? '#1f2937' : '#ecfdf5';
 }, [theme, isLight]);

 const inkStrokeColor = useMemo(() => {
 if (theme === 'sepia') return '#8c673b';
 if (theme === 'warm') return '#ea580c';
 if (theme === 'nord') return '#88c0d0';
 if (theme === 'monochrome') return '#000000';
 return isLight ? '#065f46' : '#34d399';
 }, [theme, isLight]);

 // Pen Mode: 'bezier' (smooth bezier curves) or 'corner' (sharp angular polyline)
 const [penMode, setPenMode] = useState<'bezier' | 'corner'>('bezier');

 // Pen Tool Stroke Width & Cap Style for "線で確定" (Stroke outline expansion)
 const [penStrokeWidth, setPenStrokeWidth] = useState<number>(() => {
 try {
 const saved = localStorage.getItem('glyph_pen_stroke_width');
 if (saved) {
 const val = parseInt(saved, 10);
 if (val >= 2 && val <= 300) return val;
 }
 } catch {}
 return 40;
 });

 const [penCapStyle, setPenCapStyle] = useState<'round' | 'butt' | 'square'>(() => {
 try {
 const saved = localStorage.getItem('glyph_pen_cap_style');
 if (saved === 'round' || saved === 'butt' || saved === 'square') return saved;
 } catch {}
 return 'round';
 });

 const [showPenStrokeMenu, setShowPenStrokeMenu] = useState<boolean>(false);

 const handleSetPenStrokeWidth = useCallback((width: number) => {
 const clamped = Math.max(2, Math.min(300, Math.round(width)));
 setPenStrokeWidth(clamped);
 try {
 localStorage.setItem('glyph_pen_stroke_width', String(clamped));
 } catch {}
 }, []);

 const handleSetPenCapStyle = useCallback((style: 'round' | 'butt' | 'square') => {
 setPenCapStyle(style);
 try {
 localStorage.setItem('glyph_pen_cap_style', style);
 } catch {}
 }, []);

 // Node Points Visibility Toggle (hides clutter when writing/viewing)
 const [showNodes, setShowNodes] = useState<boolean>(true);
 // Node appearance style: 'clean' (subtle elegant dots that keep glyph shape 100% visible), 'minimal' (active only), 'full' (standard boxes & handles)
 const [nodeStyle, setNodeStyle] = useState<'clean' | 'full' | 'selected_only'>('clean');

 // Outline-Only (Wireframe) Mode (輪郭表示): Turns glyph paths into outlines only so overlapping shapes, curves, and underlying guides are easily seen during editing
 const [internalOutlineOnly, setInternalOutlineOnly] = useState<boolean>(() => {
 try {
 return localStorage.getItem('glyph_canvas_outline_mode') === 'true';
 } catch {
 return false;
 }
 });

 const isOutlineMode = propOutlineOnly !== undefined ? propOutlineOnly : internalOutlineOnly;

 const setOutlineOnly = useCallback(
 (value: boolean | ((prev: boolean) => boolean)) => {
 const nextVal = typeof value === 'function' ? value(isOutlineMode) : value;
 if (onChangeOutlineOnly) {
 onChangeOutlineOnly(nextVal);
 }
 setInternalOutlineOnly(nextVal);
 try {
 localStorage.setItem('glyph_canvas_outline_mode', String(nextVal));
 } catch {}
 },
 [isOutlineMode, onChangeOutlineOnly]
 );

 // Zoom & Pan Viewport State
 const [zoom, setZoom] = useState<number>(0.55);
 const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
 const [isPanning, setIsPanning] = useState<boolean>(false);
 const panStartRef = useRef<Point>({ x: 0, y: 0 });
 const canvasGroupRef = useRef<SVGGElement | null>(null);

 // Trace adjust dragging & resizing state
 const [isDraggingTrace, setIsDraggingTrace] = useState<boolean>(false);
 const [isResizingTrace, setIsResizingTrace] = useState<boolean>(false);
 const traceDragStartRef = useRef<{ clientX: number; clientY: number; initOffsetX: number; initOffsetY: number }>({
 clientX: 0,
 clientY: 0,
 initOffsetX: 0,
 initOffsetY: 0,
 });
 const traceResizeStartRef = useRef<{
 clientX: number;
 clientY: number;
 initScale: number;
 initDist: number;
 centerScreenX: number;
 centerScreenY: number;
 }>({
 clientX: 0,
 clientY: 0,
 initScale: 1,
 initDist: 1,
 centerScreenX: 0,
 centerScreenY: 0,
 });

 // Typography Writing Guide Assist Card state (Default to false so it doesn't obstruct the canvas)
 const [showGuideAssist, setShowGuideAssist] = useState<boolean>(() => {
 try {
 return localStorage.getItem('mojisaku_guide_assist_open') === 'true';
 } catch {
 return false;
 }
 });

 // Sub-toolbar visibility (collapsible to maximize canvas height)
 const [showSubToolbar, setShowSubToolbar] = useState<boolean>(() => {
 try {
 const val = localStorage.getItem('mojisaku_show_subtoolbar');
 return val !== null ? val === 'true' : true;
 } catch {
 return true;
 }
 });

 const handleToggleSubToolbar = useCallback(() => {
 setShowSubToolbar((prev) => {
 const next = !prev;
 try {
 localStorage.setItem('mojisaku_show_subtoolbar', String(next));
 } catch {}
 return next;
 });
 }, []);

 const handleToggleGuideAssist = useCallback((open?: boolean) => {
 setShowGuideAssist((prev) => {
 const next = typeof open === 'boolean' ? open : !prev;
 try {
 localStorage.setItem('mojisaku_guide_assist_open', String(next));
 } catch {}
 return next;
 });
 }, []);

 // Touch gesture state for pinch-to-zoom & two-finger pan
 const touchPointersRef = useRef<Map<number, Point>>(new Map());
 const pointerTypesRef = useRef<Map<number, string>>(new Map());
 const isPenDrawingRef = useRef<boolean>(false);
 const lastPenActiveTimeRef = useRef<number>(0);
 const isTwoFingerGestureRef = useRef<boolean>(false);
 const activeTwoFingerIdsRef = useRef<[number, number] | null>(null);
 const twoFingerCooldownUntilRef = useRef<number>(0);
 const twoFingerLastCenterRef = useRef<Point | null>(null);
 const twoFingerLastDistRef = useRef<number | null>(null);
 const twoFingerStartDistRef = useRef<number | null>(null);
 const twoFingerStartCenterRef = useRef<Point | null>(null);
 const pinchRafRef = useRef<number | null>(null);
 const pendingPinchStateRef = useRef<{ zoom: number; pan: Point } | null>(null);
 const panRafRef = useRef<number | null>(null);
 const pendingPanRef = useRef<Point | null>(null);
 const containerRectRef = useRef<DOMRect | null>(null);
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

 // Mobile / Tablet Touch Precision Magnifier Loupe state
 const [touchLoupeState, setTouchLoupeState] = useState<{
 visible: boolean;
 screenX: number;
 screenY: number;
 canvasPos: Point | null;
 }>({
 visible: false,
 screenX: 0,
 screenY: 0,
 canvasPos: null,
 });

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
 const handleDeselectAll = () => {
 setSelectedContourIds([]);
 setSelectedNodeId(null);
 setSelectedHandleType(null);
 };
 window.addEventListener('font_editor_select_contours', handleExternalSelect);
 window.addEventListener('font_editor_deselect_all', handleDeselectAll);
 return () => {
 window.removeEventListener('font_editor_select_contours', handleExternalSelect);
 window.removeEventListener('font_editor_deselect_all', handleDeselectAll);
 };
 }, []);

 // When switching tool modes away from selection / node editing, automatically clear contour selections and transient tool states
 useEffect(() => {
 if (toolMode !== 'select' && toolMode !== 'node') {
 setSelectedContourIds([]);
 setSelectedNodeId(null);
 setSelectedHandleType(null);
 setShowMobilePartSheet(false);
 }
 if (toolMode !== 'eraser') {
 isErasingRef.current = false;
 eraserStrokePointsRef.current = [];
 activeEraserSvgDRef.current = '';
 if (activeEraserPathRef.current) {
 activeEraserPathRef.current.setAttribute('d', '');
 }
 }
 if (toolMode !== 'ruler' || gridSettings.showRulers === false) {
 setRulerMeasurement(null);
 }
 }, [toolMode, gridSettings.showRulers]);
 const [marqueeSelection, setMarqueeSelection] = useState<{ start: Point; current: Point } | null>(null);
 const [showShapePickerDropdown, setShowShapePickerDropdown] = useState<boolean>(false);
 const shapePickerRef = useRef<HTMLDivElement>(null);
 const [showQuickGridSlider, setShowQuickGridSlider] = useState<boolean>(false);
 const quickGridSliderRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 const handleClickOutside = (e: MouseEvent) => {
 if (shapePickerRef.current && !shapePickerRef.current.contains(e.target as Node)) {
 setShowShapePickerDropdown(false);
 }
 if (quickGridSliderRef.current && !quickGridSliderRef.current.contains(e.target as Node)) {
 setShowQuickGridSlider(false);
 }
 };
 if (showShapePickerDropdown || showQuickGridSlider) {
 document.addEventListener('mousedown', handleClickOutside);
 }
 return () => {
 document.removeEventListener('mousedown', handleClickOutside);
 };
 }, [showShapePickerDropdown, showQuickGridSlider]);

 const isShapeTool = [
 'rect',
 'square',
 'ellipse',
 'circle',
 'rounded_rect',
 'triangle',
 'triangle_down',
 'right_triangle',
 'semicircle',
 'ring',
 'pill',
 'parallelogram',
 'crescent',
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

 // Brush Tool stroke in-progress (Hardware-accelerated direct SVG path refs for 120Hz smooth iPad drawing)
 const brushStrokePointsRef = useRef<StrokePoint[]>([]);
 const brushStrokeStartTimeRef = useRef<number>(0);
 const brushStrokeStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
 const pendingBrushEventsRef = useRef<{ clientX: number; clientY: number; pressure: number; timeStamp: number; pointerType: string }[]>([]);
 const activeBrushPathRef = useRef<SVGPathElement | null>(null);
 const activeBrushSvgDRef = useRef<string>('');
 const activeEraserSvgDRef = useRef<string>('');
 const lastPressureUpdateRef = useRef<number>(0);
 const brushRafIdRef = useRef<number | null>(null);
 const mouseSmoothSpeedRef = useRef<number>(0.5);

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
 const lastErasePosRef = useRef<Point | null>(null);
 const eraserStrokePointsRef = useRef<Point[]>([]);
 const activeEraserPathRef = useRef<SVGPathElement | null>(null);

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
 allInitialNodes?: Point[];
 } | null>(null);
 const transformRafRef = useRef<number | null>(null);
 const pendingTransformContoursRef = useRef<PathContour[] | null>(null);
 const [rotateDisplayAngle, setRotateDisplayAngle] = useState<number | null>(null);

 // Ruler Measurement & Straight Line Draw Tool State
 const [rulerMeasurement, setRulerMeasurement] = useState<{
 start: Point;
 end: Point;
 active: boolean;
 } | null>(null);

 // Ruler Straight Line Assist (Hold Shift or toggle straight mode for precise horizontal/vertical/45deg lines)
 const [brushStraightMode, setBrushStraightMode] = useState<boolean>(false);
 const lastBrushPointRef = useRef<{ x: number; y: number; time: number } | null>(null);

 // Stroke Smoothing Options & Real-time Auto-Smooth
 const [autoSmoothBrush, setAutoSmoothBrush] = useState<boolean>(true);
 // 合体（デフォルトON: 初心者でも交差した線が自然に結合され、穴あきや重なりバグ感を防止）
 const [autoUnionBrush, setAutoUnionBrush] = useState<boolean>(() => {
 try {
 const saved = localStorage.getItem('fontforge_auto_union_brush');
 return saved !== null ? saved === 'true' : true;
 } catch {
 return true;
 }
 });
 // 一筆書きの線が交差・重なった部分の白抜き防止（デフォルトON: ループ線を描いた時の中抜け・白抜きバグ感を防止）
 const [autoResolveBrushOverlap, setAutoResolveBrushOverlap] = useState<boolean>(() => {
 try {
 const saved = localStorage.getItem('fontforge_auto_resolve_brush_overlap');
 return saved !== null ? saved === 'true' : true;
 } catch {
 return true;
 }
 });
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

 // Eraser Tool Config (Size & Mode: 'stroke' = 消しゴム, 'cut' = 部分削り・分割, 'node' = アンカー点消去)
 const [eraserSize, setEraserSize] = useState<number>(36);
 const [eraserMode, setEraserMode] = useState<'stroke' | 'cut' | 'node'>('stroke');

 // Multi-touch Gesture tracking for 2-finger tap (Undo) and 3-finger tap (Redo)
 const touchStartTimeRef = useRef<number>(0);
 const maxTouchCountRef = useRef<number>(0);
 const hasMovedSignificantRef = useRef<boolean>(false);

 const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 const showCanvasToast = useCallback((message: string, subText?: string) => {
 const id = Date.now();
 setCanvasToast({ message, subText, id });
 if (toastTimerRef.current) {
 clearTimeout(toastTimerRef.current);
 }
 toastTimerRef.current = setTimeout(() => {
 setCanvasToast((curr) => (curr?.id === id ? null : curr));
 toastTimerRef.current = null;
 }, 3200);
 }, []);

 // Helper to generate exact brush contour for both live preview and finalization
 const getProcessedBrushContour = useCallback(
 (pts: StrokePoint[], isFinalize: boolean = false) => {
 let strokePts = pts;
 // 描画中のプレビュー時は軽量化してフレームレート（60/120fps）を最大化
 if (!isFinalize && pts.length > 80) {
 strokePts = getDecimatedPointsForLivePreview(pts);
 }

 // 手ブレ補正設定に応じた平滑化強度を適用
 const effectiveSmoothing = autoSmoothBrush
 ? smoothStrength === 'strong'
 ? Math.max(82, smoothingIntensity)
 : smoothStrength === 'standard'
 ? Math.max(62, smoothingIntensity)
 : Math.max(40, smoothingIntensity)
 : smoothingIntensity;

 const rawContour = strokePointsToOutline(
 strokePts,
 brushWidth,
 brushStyle,
 true,
 pressureSensitivity,
 pressureCurve,
 effectiveSmoothing,
 isFinalize
 ? { customPreset: activePenPreset }
 : { subdivisionStep: 1.5, density: 'high', widthSmoothingPasses: 1, customPreset: activePenPreset }
 );

 // strokePointsToOutline は物理弧長ガウス平滑化・Catmull-Rom連続スプラインにより
 // 完全に滑らかで美しいG1連続ベジェ曲線を生成します。
 return rawContour;
 },
 [brushWidth, brushStyle, pressureSensitivity, pressureCurve, smoothingIntensity, autoSmoothBrush, smoothStrength, activePenPreset]
 );

 // Real-time Hover Position in Font Canvas Coordinates (0 - 1000)
 const [hoverCanvasPos, setHoverCanvasPos] = useState<Point | null>(null);
 const hoverRafRef = useRef<number | null>(null);

 // Count targeted nodes inside anchor point eraser sweep area for real-time pointer feedback
 const targetedEraserNodeCount = useMemo(() => {
 if (toolMode !== 'eraser' || eraserMode !== 'node' || !hoverCanvasPos) return 0;
 const radius = Math.max(2, eraserSize / 2);
 let count = 0;
 for (const c of contours) {
 for (const n of c.nodes) {
 if (Math.hypot(n.x - hoverCanvasPos.x, n.y - hoverCanvasPos.y) <= radius) {
 count++;
 }
 }
 }
 return count;
 }, [toolMode, eraserMode, hoverCanvasPos, eraserSize, contours]);

 // Throttled RAF references for ultra-smooth 60fps node and handle dragging
 const eraserReticleRef = useRef<SVGGElement | null>(null);
 const nodeDragRafRef = useRef<number | null>(null);
 const eraseRafRef = useRef<number | null>(null);
 const pendingContoursRef = useRef<PathContour[] | null>(null);

 // Clean up RAF & timers on unmount to prevent memory leaks
 useEffect(() => {
 return () => {
 if (toastTimerRef.current) {
 clearTimeout(toastTimerRef.current);
 }
 if (hoverRafRef.current != null) {
 cancelAnimationFrame(hoverRafRef.current);
 }
 if (nodeDragRafRef.current != null) {
 cancelAnimationFrame(nodeDragRafRef.current);
 }
 if (eraseRafRef.current != null) {
 cancelAnimationFrame(eraseRafRef.current);
 }
 if (brushRafIdRef.current != null) {
 cancelAnimationFrame(brushRafIdRef.current);
 }
 if (shapeRafRef.current != null) {
 cancelAnimationFrame(shapeRafRef.current);
 }
 if (pinchRafRef.current != null) {
 cancelAnimationFrame(pinchRafRef.current);
 }
 if (panRafRef.current != null) {
 cancelAnimationFrame(panRafRef.current);
 }
 if (transformRafRef.current != null) {
 cancelAnimationFrame(transformRafRef.current);
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

 const upm = project?.metadata?.unitsPerEm || 1000;

 // Dynamic snap metrics calculated from font canvas UPM
 const snapMetrics = useMemo(() => ({
 lsb,
 advanceWidth,
 baseline: Math.round(upm * 0.8),
 ascender: Math.round(upm * 0.2),
 capHeight: Math.round(upm * 0.3),
 xHeight: Math.round(upm * 0.5),
 descender: upm,
 }), [lsb, advanceWidth, upm]);

 // Boundary Clamping for Viewport Panning (prevents canvas from drifting into infinite empty space)
 const clampPan = useCallback((p: Point, currentZoom: number): Point => {
 if (!containerRef.current) return p;
 const rect = containerRef.current.getBoundingClientRect();
 const cWidth = rect.width;
 const cHeight = rect.height;
 if (cWidth <= 0 || cHeight <= 0) return p;

 const canvasWidth = upm * currentZoom;
 const canvasHeight = upm * currentZoom;

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
 }, [upm]);

 // Auto-center canvas on initial mount, resize, or drawer toggle with optimal zoom
 const resetView = useCallback((mode: 'fit' | 'width' | '100%' = 'fit') => {
 if (containerRef.current) {
 const rect = containerRef.current.getBoundingClientRect();
 if (rect.width <= 0 || rect.height <= 0) return;

 if (mode === '100%') {
 setZoom(1.0);
 setPan({
 x: (rect.width - upm) / 2,
 y: (rect.height - upm) / 2,
 });
 return;
 }

 if (mode === 'width') {
 const margin = rect.width < 640 ? 12 : 24;
 const widthZoom = Math.max(0.35, Math.min(3.5, (rect.width - margin) / upm));
 setZoom(widthZoom);
 setPan({
 x: (rect.width - upm * widthZoom) / 2,
 y: Math.max(16, (rect.height - upm * widthZoom) / 2),
 });
 return;
 }

 // Default 'fit': comfortable, optimal margin (12px on mobile, 24px on desktop/iPad)
 const margin = rect.width < 640 ? 12 : 28;
 const idealZoom = Math.min((rect.width - margin) / upm, (rect.height - margin) / upm);
 const clampedZoom = Math.max(0.35, Math.min(3.5, idealZoom));
 setZoom(clampedZoom);
 setPan({
 x: (rect.width - upm * clampedZoom) / 2,
 y: (rect.height - upm * clampedZoom) / 2,
 });
 }
 }, [upm]);

 // Auto-recenter and fit canvas whenever project UPM (canvas size) changes
 const prevUpmRef = useRef<number>(upm);
 useEffect(() => {
 if (prevUpmRef.current !== upm) {
 prevUpmRef.current = upm;
 resetView('fit');
 }
 }, [upm, resetView]);

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
 const panRef = useRef<Point>(pan);
 useEffect(() => {
 panRef.current = pan;
 }, [pan]);
 const containerDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
 const isAnyModalOpenRef = useRef(isAnyModalOpen);
 useEffect(() => { isAnyModalOpenRef.current = isAnyModalOpen; }, [isAnyModalOpen]);
 const toolModeRef = useRef(toolMode);
 useEffect(() => { toolModeRef.current = toolMode; }, [toolMode]);
 const brushWidthRef = useRef(brushWidth);
 useEffect(() => { brushWidthRef.current = brushWidth; }, [brushWidth]);
 const eraserSizeRef = useRef(eraserSize);
 useEffect(() => { eraserSizeRef.current = eraserSize; }, [eraserSize]);
 const onChangeBrushWidthRef = useRef(onChangeBrushWidth);
 useEffect(() => { onChangeBrushWidthRef.current = onChangeBrushWidth; }, [onChangeBrushWidth]);
 const onChangeTraceSettingsRef = useRef(onChangeTraceSettings);
 useEffect(() => { onChangeTraceSettingsRef.current = onChangeTraceSettings; }, [onChangeTraceSettings]);

 // Unified native wheel & gesture handling (Passive: false for seamless zoom, pan, and brush sizing)
 useEffect(() => {
 const el = containerRef.current;
 if (!el) return;
 const preventAll = (e: Event) => {
 if (e.cancelable) {
 e.preventDefault();
 }
 };
 const handleTouchStart = (e: TouchEvent) => {
 // Prevent browser native zoom & multi-touch gestures when touching canvas
 if (e.touches.length >= 2 && e.cancelable) {
 e.preventDefault();
 }
 };
 const handleTouchMove = (e: TouchEvent) => {
 // Inside canvas area, touches are strictly for drawing or 2-finger panning. Always prevent page scrolling/bouncing.
 if (e.cancelable) {
 e.preventDefault();
 }
 };

 const handleWheelNative = (e: WheelEvent) => {
 if (e.cancelable) {
 e.preventDefault();
 }

 if (isAnyModalOpenRef.current) return;
 if (!containerRef.current) return;
 const rect = containerRef.current.getBoundingClientRect();
 const mouseX = e.clientX - rect.left;
 const mouseY = e.clientY - rect.top;

 let deltaX = e.deltaX;
 let deltaY = e.deltaY;
 if (e.deltaMode === 1) {
 deltaX *= 20;
 deltaY *= 20;
 } else if (e.deltaMode === 2) {
 deltaX *= 400;
 deltaY *= 400;
 }

 // 1. Trace Adjust Mode (when not holding Ctrl / Cmd)
 if (toolModeRef.current === 'trace_adjust' && onChangeTraceSettingsRef.current && !e.ctrlKey && !e.metaKey) {
 const delta = -Math.sign(deltaY) * 0.05;
 onChangeTraceSettingsRef.current((prev) => {
 const currentScale = prev.scale ?? 1;
 const nextScale = Math.round(Math.max(0.2, Math.min(3.0, currentScale + delta)) * 100) / 100;
 return { ...prev, scale: nextScale };
 });
 return;
 }

 // 2. Alt + Wheel: Quick Brush / Eraser Size adjustment
 if (e.altKey && !e.ctrlKey && !e.metaKey) {
 const sizeDelta = -Math.sign(deltaY) * (e.shiftKey ? 10 : 2);
 if (toolModeRef.current === 'eraser') {
 setEraserSize((prev) => {
 const next = Math.max(2, Math.min(160, prev + sizeDelta));
 showCanvasToast(`消しゴムサイズ: ${next}px`);
 return next;
 });
 } else {
 if (onChangeBrushWidthRef.current) {
 const currentW = brushWidthRef.current || 28;
 const nextW = Math.max(1, Math.min(200, currentW + sizeDelta));
 onChangeBrushWidthRef.current(nextW);
 showCanvasToast(`筆太さ: ${nextW}px`);
 }
 }
 return;
 }

 // 3. Ctrl / Cmd + Wheel: Smooth Zoom centered at mouse pointer (10% to 3200%)
 if (e.ctrlKey || e.metaKey) {
 const zoomFactor = Math.pow(1.12, -deltaY / 100);
 setZoom((prevZoom) => {
 const nextZoom = Math.max(0.1, Math.min(32.0, prevZoom * zoomFactor));
 const scale = nextZoom / prevZoom;

 setPan((prevPan) => {
 const newPan = {
 x: mouseX - (mouseX - prevPan.x) * scale,
 y: mouseY - (mouseY - prevPan.y) * scale,
 };
 return clampPan(newPan, nextZoom);
 });

 return nextZoom;
 });
 return;
 }

 // 4. Shift + Wheel: Horizontal Scroll (Pan X)
 if (e.shiftKey) {
 const scrollAmount = Math.abs(deltaY) > Math.abs(deltaX) ? deltaY : deltaX;
 setPan((prevPan) => {
 const newPan = {
 x: prevPan.x - scrollAmount,
 y: prevPan.y,
 };
 return clampPan(newPan, zoomRef.current);
 });
 return;
 }

 // 5. Default Wheel (No modifier): Vertical Scroll (Pan Y) + Horizontal Scroll (deltaX)
 setPan((prevPan) => {
 const newPan = {
 x: prevPan.x - deltaX,
 y: prevPan.y - deltaY,
 };
 return clampPan(newPan, zoomRef.current);
 });
 };

 el.addEventListener('gesturestart', preventAll, { passive: false });
 el.addEventListener('gesturechange', preventAll, { passive: false });
 el.addEventListener('gestureend', preventAll, { passive: false });
 el.addEventListener('touchstart', handleTouchStart, { passive: false });
 el.addEventListener('touchmove', handleTouchMove, { passive: false });
 el.addEventListener('wheel', handleWheelNative, { passive: false });

 // Window level safety release: if finger, mouse, or pen is lifted outside canvas window or interrupted
 const handleWindowPointerUpOrCancel = (e: PointerEvent) => {
 setTouchLoupeState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
 if (isErasingRef.current) {
 isErasingRef.current = false;
 lastErasePosRef.current = null;
 activeEraserSvgDRef.current = '';
 if (activeEraserPathRef.current) {
 activeEraserPathRef.current.setAttribute('d', '');
 }
 eraserStrokePointsRef.current = [];
 erasedAnyInSessionRef.current = false;
 }
 if (e.pointerType === 'touch') {
 touchPointersRef.current.delete(e.pointerId);
 pointerTypesRef.current.delete(e.pointerId);
 if (touchPointersRef.current.size === 0) {
 if (isTwoFingerGestureRef.current) {
 twoFingerCooldownUntilRef.current = Date.now() + 150;
 if (Math.abs(zoomRef.current - zoom) > 0.001 || Math.abs(panRef.current.x - pan.x) > 0.5 || Math.abs(panRef.current.y - pan.y) > 0.5) {
 setZoom(zoomRef.current);
 setPan(panRef.current);
 }
 }
 isTwoFingerGestureRef.current = false;
 activeTwoFingerIdsRef.current = null;
 twoFingerLastCenterRef.current = null;
 twoFingerLastDistRef.current = null;
 twoFingerStartDistRef.current = null;
 twoFingerStartCenterRef.current = null;
 }
 } else if (e.pointerType === 'pen') {
 isPenDrawingRef.current = false;
 lastPenActiveTimeRef.current = Date.now();
 }
 };

 window.addEventListener('pointerup', handleWindowPointerUpOrCancel);
 window.addEventListener('pointercancel', handleWindowPointerUpOrCancel);

 return () => {
 el.removeEventListener('gesturestart', preventAll);
 el.removeEventListener('gesturechange', preventAll);
 el.removeEventListener('gestureend', preventAll);
 el.removeEventListener('touchstart', handleTouchStart);
 el.removeEventListener('touchmove', handleTouchMove);
 el.removeEventListener('wheel', handleWheelNative);
 window.removeEventListener('pointerup', handleWindowPointerUpOrCancel);
 window.removeEventListener('pointercancel', handleWindowPointerUpOrCancel);
 };
 }, [clampPan, showCanvasToast, zoom, pan]);

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

 // Reset trace position offset back to (0, 0) (Center)
 const handleResetTracePosition = useCallback(() => {
 if (!onChangeTraceSettings) return;
 onChangeTraceSettings((prev) => ({
 ...prev,
 offsetX: 0,
 offsetY: 0,
 rotation: 0,
 }));
 showCanvasToast('下絵の位置を中央(X:0, Y:0)にリセットしました');
 }, [onChangeTraceSettings, showCanvasToast]);

 // Reset trace position AND scale back to standard
 const handleResetTraceAll = useCallback(() => {
 if (!onChangeTraceSettings) return;
 const isKana = /[ぁ-んァ-ヶー]/.test(traceSettings.text || activeChar || '');
 const isKanji = /[\u4e00-\u9faf\u3400-\u4dbf]/.test(traceSettings.text || activeChar || '');
 const defaultScale = isKana ? 0.78 : isKanji ? 0.85 : 1.0;
 onChangeTraceSettings((prev) => ({
 ...prev,
 offsetX: 0,
 offsetY: 0,
 scale: defaultScale,
 rotation: 0,
 }));
 showCanvasToast(`下絵の位置とサイズ(${Math.round(defaultScale * 100)}%)をリセットしました`);
 }, [onChangeTraceSettings, showCanvasToast, traceSettings.text, activeChar]);

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
 ((e.key === 'f' || e.key === 'F') || (e.key === 'z' || e.key === 'Z')) &&
 !e.ctrlKey &&
 !e.metaKey &&
 !e.altKey
 ) {
 if (onToggleZenMode) {
 e.preventDefault();
 onToggleZenMode();
 }
 } else if (toolMode === 'trace_adjust' && (e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
 e.preventDefault();
 handleResetTracePosition();
 }
 };
 window.addEventListener('keydown', handleCanvasShortcut);
 return () => window.removeEventListener('keydown', handleCanvasShortcut);
 }, [resetView, onToggleZenMode, showCanvasToast, handleZoomStep, isAnyModalOpen, toolMode, handleResetTracePosition]);

 // Screen to Canvas Coordinates Converter (Pure geometric mapping with zero drift)
 const screenToCanvas = useCallback(
 (clientX: number, clientY: number): Point => {
 const rect = containerRef.current?.getBoundingClientRect();
 if (!rect) return { x: 0, y: 0 };
 containerRectRef.current = rect;
 const currentZoom = zoomRef.current || 1;
 const currentPan = panRef.current || { x: 0, y: 0 };
 const x = (clientX - rect.left - currentPan.x) / currentZoom;
 const y = (clientY - rect.top - currentPan.y) / currentZoom;
 return { x: Math.round(x), y: Math.round(y) };
 },
 []
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
 (closed: boolean = false, customStrokeWidth?: number) => {
 if (!activePenContour || activePenContour.nodes.length === 0) return;
 if (activePenContour.nodes.length === 1) {
 showCanvasToast('パスには2点以上の頂点が必要です', '作図を継続またはEscでキャンセル');
 return;
 }
 setShowPenStrokeMenu(false);

 const targetWidth = customStrokeWidth ?? penStrokeWidth;

 if (!closed) {
 // "線で確定": Expand the open path into a smooth, solid vector outline with the chosen line thickness
 try {
 const rawContour: PathContour = {
 ...activePenContour,
 closed: false,
 };
 const expanded = expandStrokeContours([rawContour], targetWidth, penCapStyle);
 if (expanded && expanded.length > 0) {
 let resultContours = expanded;
 if (autoResolveBrushOverlap && hasContourIntersections(expanded)) {
 try {
 const selfMerged = unionContours(expanded, 1.2, false);
 if (selfMerged && selfMerged.length > 0) {
 resultContours = selfMerged;
 }
 } catch (e) {
 console.warn('Stroke self-merge fallback:', e);
 }
 }

 onChangeContours([...contours, ...resultContours]);
 setSelectedContourId(null);
 setSelectedContourIds([]);
 setActivePenContour(null);
 setSelectedNodeId(null);
 onCommitHistory();
 showCanvasToast(
 `太さ ${targetWidth}px の線として確定しました`,
 `${resultContours.length} 個の輪郭 (端点: ${penCapStyle === 'round' ? '丸' : penCapStyle === 'butt' ? '平' : '角'})`
 );
 return;
 }
 } catch (err) {
 console.warn('Pen stroke expansion fallback:', err);
 }
 }

 const finalized: PathContour = {
 ...activePenContour,
 closed,
 };

 if (closed && autoResolveBrushOverlap) {
 try {
 const selfMerged = unionContours([finalized], 1.2, true);
 if (selfMerged && selfMerged.length > 0) {
 onChangeContours([...contours, ...selfMerged]);
 setSelectedContourId(null);
 setSelectedContourIds([]);
 setActivePenContour(null);
 setSelectedNodeId(null);
 onCommitHistory();
 showCanvasToast(
 selfMerged.length > 1
 ? '交差を自動結合し、輪郭を確定しました'
 : '閉じた輪郭として確定しました',
 `${selfMerged.length} 個の輪郭`
 );
 return;
 }
 } catch (err) {
 console.warn('Pen self-merge fallback:', err);
 }
 }

 onChangeContours([...contours, finalized]);
 setSelectedContourId(null);
 setSelectedContourIds([]);
 setActivePenContour(null);
 setSelectedNodeId(null);
 onCommitHistory();
 showCanvasToast(
 closed ? '閉じた輪郭として確定しました' : `開いた線 (太さ: ${targetWidth}px) として確定しました`,
 `${finalized.nodes.length} 頂点`
 );
 },
 [activePenContour, contours, autoResolveBrushOverlap, penStrokeWidth, penCapStyle, onChangeContours, onCommitHistory, showCanvasToast]
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

 // Clear / Reset all contours of current character (文字を全クリア)
 const handleClearAll = useCallback(() => {
 if (activeBrushPathRef.current) {
 activeBrushPathRef.current.setAttribute('d', '');
 }
 activeBrushSvgDRef.current = '';
 if (activeEraserPathRef.current) {
 activeEraserPathRef.current.setAttribute('d', '');
 }
 activeEraserSvgDRef.current = '';
 brushStrokePointsRef.current = [];
 eraserStrokePointsRef.current = [];
 isErasingRef.current = false;
 lastErasePosRef.current = null;
 erasedAnyInSessionRef.current = false;
 setActivePenContour(null);
 setShapeStartPoint(null);
 setShapeCurrentPoint(null);
 setRulerMeasurement(null);
 setTransformSession(null);
 setMarqueeSelection(null);
 setSelectedContourIds([]);
 setSelectedContourId(null);
 setSelectedNodeId(null);
 setSelectedHandleType(null);
 setTouchLoupeState({ visible: false, screenX: 0, screenY: 0, canvasPos: null });
 setEraserMode('stroke');

 if (!contours || contours.length === 0) {
 showCanvasToast('キャンバスは既に空です');
 return;
 }
 onCommitHistory();
 contoursRef.current = [];
 onChangeContours([]);
 showCanvasToast('文字の全パーツ（輪郭）を消去しました', 'Ctrl+Z で取り消し可能');
 }, [contours, onChangeContours, onCommitHistory, showCanvasToast]);

 const handleClearAllContours = handleClearAll;

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
 const allInitialNodes = targetContours.flatMap((c) => c.nodes.map((n) => ({ x: n.x, y: n.y })));
 setTransformSession({
 handle,
 startPoint: pos,
 initialBBox: bbox,
 initialContours: targetContours,
 allInitialNodes,
 });
 },
 [selectedContourIds, contours, screenToCanvas]
 );

 // Resolve dynamic high-contrast cursor
 const getCanvasCursor = useCallback(() => {
 const isHighContrast = gridSettings.highContrastCursor !== false;
 if (isSpacePressed || toolMode === 'hand' || isPanning) {
 if (isHighContrast) {
 return isPanning ? HIGH_CONTRAST_GRABBING_CURSOR : HIGH_CONTRAST_GRAB_CURSOR;
 }
 return isPanning ? 'grabbing' : 'grab';
 }
 if (toolMode === 'pen') return isHighContrast ? HIGH_CONTRAST_PEN_CURSOR : 'crosshair';
 if (toolMode === 'node' || toolMode === 'select') return isHighContrast ? HIGH_CONTRAST_NODE_CURSOR : 'default';
 if (toolMode === 'eraser') {
 if (eraserMode === 'node') {
 return isHighContrast ? HIGH_CONTRAST_ANCHOR_ERASER_CURSOR : 'crosshair';
 }
 return isHighContrast ? HIGH_CONTRAST_ERASER_CURSOR : 'crosshair';
 }
 if (toolMode === 'brush' || isShapeTool || toolMode === 'ruler') {
 return isHighContrast ? HIGH_CONTRAST_CROSSHAIR_CURSOR : 'crosshair';
 }
 return 'default';
 }, [gridSettings.highContrastCursor, toolMode, eraserMode, isPanning, isSpacePressed, isShapeTool]);

 // ---------------- POINTER EVENT HANDLERS ----------------

 const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
 // Only capture pointer for non-touch (mouse/pen) to prevent WebKit / iOS multi-touch cancellation glitches
 if (e.pointerType !== 'touch') {
 try {
 (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
 } catch {
 // Ignored for non-capturable pointers in certain mobile browsers
 }
 }
 pointerTypesRef.current.set(e.pointerId, e.pointerType);
 touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

 if (containerRef.current) {
 containerRectRef.current = containerRef.current.getBoundingClientRect();
 }

 // Spacebar or Middle Mouse or Hand tool = Pan canvas (HIGHEST PRIORITY)
 if (toolMode === 'hand' || e.button === 1 || isSpacePressed) {
 if (e.button === 1 && e.cancelable) {
 e.preventDefault();
 }
 setIsPanning(true);
 panStartRef.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
 return;
 }

 // Block non-left clicks (e.g. right click, back/forward buttons) from starting strokes
 if (e.pointerType === 'mouse' && e.button !== 0) {
 return;
 }

 // Stylus / Apple Pencil detection (Pen takes absolute priority)
 const isPen = e.pointerType === 'pen';
 if (isPen) {
 isPenDrawingRef.current = true;
 lastPenActiveTimeRef.current = Date.now();
 // Immediately cancel any conflicting touch gesture if Apple Pencil touches the screen
 isTwoFingerGestureRef.current = false;
 activeTwoFingerIdsRef.current = null;
 setIsStylusActive(true);
 if (e.pressure && e.pressure > 0) {
 setLiveStylusPressure(Math.round(e.pressure * 100));
 }
 }

 // Cooldown check for touch: do not start single-finger drawing immediately after a 2-finger gesture ends
 if (e.pointerType === 'touch' && twoFingerCooldownUntilRef.current > Date.now()) {
 return;
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
 // If palm rejection is active (auto when stylus was recently active or strict_pen_only), ignore accidental palm/finger drawing!
 const isPenRecentlyActive = Date.now() - lastPenActiveTimeRef.current < 1500;
 const isPalmRejectionActive =
 palmRejectionMode === 'strict_pen_only' ||
 (palmRejectionMode === 'auto' && (isPenDrawingRef.current || isPenRecentlyActive));

 if (e.pointerType === 'touch' && isPalmRejectionActive && !isPenDrawingRef.current) {
 // If 1 finger touch during active palm rejection, ignore canvas stroke to prevent stray marks
 if (touchPointersRef.current.size === 1) {
 // Allow metric dragging if right on guide
 const posCheck = screenToCanvas(e.clientX, e.clientY);
 const hitThreshold = 30 / zoomRef.current;
 if (Math.abs(posCheck.x - lsb) <= hitThreshold || Math.abs(posCheck.x - advanceWidth) <= hitThreshold) {
 // Allow guideline adjustment
 } else {
 showCanvasToast('パームリジェクション', 'ペン先以外の接触を自動ブロック中');
 return;
 }
 }
 }

 // If stylus is currently drawing or was active within 200ms, ignore touch input completely
 if (e.pointerType === 'touch' && (isPenDrawingRef.current || (Date.now() - lastPenActiveTimeRef.current < 200))) {
 return;
 }

 // Multi-touch gesture (Pinch-to-zoom & 2-Finger Pan)
 // Only pure finger touches trigger pinch zoom / 2-finger pan
 const fingerTouches = Array.from(touchPointersRef.current.entries())
 .filter(([id]) => pointerTypesRef.current.get(id) === 'touch');

 if (fingerTouches.length >= 2 && !isPenDrawingRef.current) {
 isTwoFingerGestureRef.current = true;
 activeTwoFingerIdsRef.current = [fingerTouches[0][0], fingerTouches[1][0]];

 // Immediately cancel any single-touch drawings in progress to prevent accidental blobs or stray strokes
 brushStrokePointsRef.current = [];
 if (activeBrushPathRef.current) {
 activeBrushPathRef.current.setAttribute('d', '');
 }
 setShapeStartPoint(null);
 setShapeCurrentPoint(null);
 setMarqueeSelection(null);
 setDraggingMetric(null);
 setDraggingGuidelineId(null);
 setIsDraggingTrace(false);
 setIsResizingTrace(false);
 setTransformSession(null);
 isErasingRef.current = false;
 lastErasePosRef.current = null;

 // If pen contour was just started by finger 1 (single node), discard it so pinch doesn't leave stray node
 if (activePenContour && activePenContour.nodes.length <= 1) {
 setActivePenContour(null);
 setSelectedNodeId(null);
 }

 const p1 = fingerTouches[0][1];
 const p2 = fingerTouches[1][1];
 const dist = Math.max(10, Math.hypot(p1.x - p2.x, p1.y - p2.y));
 const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

 twoFingerLastCenterRef.current = center;
 twoFingerLastDistRef.current = dist;
 twoFingerStartDistRef.current = dist;
 twoFingerStartCenterRef.current = center;
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
 // Guard against accidental vertical line dragging during drawing tools or when guidelines are locked
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
 let startPos = pos;
 if (!e.altKey && (gridSettings.snapToGuides !== false || gridSettings.snapToGrid)) {
 const snapRes = snapSinglePoint(
 pos,
 contours,
 snapMetrics,
 customGuidelines,
 Math.max(7, Math.round(12 / zoom)),
 gridSettings
 );
 startPos = snapRes.point;
 setActiveSnapGuides(snapRes.activeGuides);
 }
 setRulerMeasurement({
 start: startPos,
 end: startPos,
 active: true,
 });
 return;
 }

 // 選択中は誤描画を防止：輪郭やノードを選択している間はキャンバスへの新規書き込みをロック
 // タップ/クリックで選択を解除し、再度描画できるようにする
 const hasActiveSelection =
 selectedContourIds.length > 0 ||
 (selectedNodeId !== null && !activePenContour);

 // Auto-clear active selection on start drawing or erasing so user can directly interact immediately
 if (
 hasActiveSelection &&
 (toolMode === 'brush' || toolMode === 'pen' || toolMode === 'eraser' || isShapeTool)
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
 snapMetrics,
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
 handleFinishPenContour(true);
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
 pendingBrushEventsRef.current = [];
 mouseSmoothSpeedRef.current = 0.5;
 brushStrokeStartTimeRef.current = Date.now();
 brushStrokeStartPosRef.current = { x: pos.x, y: pos.y };
 const isPen = e.pointerType === 'pen';
 let pres = 0.5;
 if (pressureSensitivity === 'off') {
 pres = 0.5;
 } else if (isPen) {
 setIsStylusActive(true);
 const rawP = e.pressure && e.pressure > 0 ? e.pressure : 0.15;
 pres = Math.max(0.04, Math.min(1.0, (rawP - 0.03) / 0.65));
 setLiveStylusPressure(Math.round(pres * 100));
 } else if (e.pressure && e.pressure > 0 && e.pressure !== 0.5) {
 pres = e.pressure;
 } else {
 pres = 0.55;
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
 if (activeBrushPathRef.current) {
 const contour = getProcessedBrushContour(brushStrokePointsRef.current, false);
 const d = contoursToSvgPath([contour]);
 activeBrushPathRef.current.setAttribute('d', d);
 }
 } else {
 brushStrokePointsRef.current = [{ x: pos.x, y: pos.y, pressure: pres, time: Date.now(), pointerType: e.pointerType }];
 // 初期タップ瞬間には画面に巨大な丸をプレビュー表示せず、動いた時または描画確定時に表示
 if (activeBrushPathRef.current) {
 activeBrushPathRef.current.setAttribute('d', '');
 }
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
 snapMetrics,
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
 if (eraserMode === 'all') {
 handleClearAll();
 setEraserMode('stroke');
 return;
 }
 try {
 (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
 } catch {
 // Ignored
 }
 isErasingRef.current = true;
 erasedAnyInSessionRef.current = false;
 lastErasePosRef.current = pos;
 eraserStrokePointsRef.current = [pos];
 const eraseRadius = Math.max(2, eraserSize / 2);

 if (eraserMode === 'cut') {
 const d = `M ${pos.x} ${pos.y} L ${pos.x + 0.1} ${pos.y}`;
 activeEraserSvgDRef.current = d;
 if (activeEraserPathRef.current) {
 activeEraserPathRef.current.setAttribute('d', d);
 }
 } else {
 const currentContours = contoursRef.current || [];
 const updatedContours = eraseContoursAtPoint(currentContours, pos, eraseRadius, eraserMode);
 if (updatedContours !== currentContours) {
 onCommitHistory();
 erasedAnyInSessionRef.current = true;
 contoursRef.current = updatedContours;
 onChangeContours(updatedContours, { skipHistory: true });
 setSelectedContourIds((prev) => prev.filter((id) => updatedContours.some((c) => c.id === id)));
 setSelectedContourId((prev) => (prev && updatedContours.some((c) => c.id === prev) ? prev : null));
 setSelectedNodeId((prev) => {
 if (!prev) return null;
 return updatedContours.some((c) => c.nodes.some((n) => n.id === prev)) ? prev : null;
 });
 }
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
 // Clicking on empty canvas area:
 // Clear selection unless Shift is held, and start marquee rectangle selection
 if (!e.shiftKey) {
 setSelectedContourIds([]);
 setSelectedContourId(null);
 }
 setSelectedNodeId(null);
 setSelectedHandleType(null);
 if (toolMode === 'select') {
 setMarqueeSelection({ start: pos, current: pos });
 }
 }
 }
 };

 const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
 // Pen takes absolute priority
 if (e.pointerType === 'pen') {
 isPenDrawingRef.current = true;
 lastPenActiveTimeRef.current = Date.now();
 isTwoFingerGestureRef.current = false;
 activeTwoFingerIdsRef.current = null;
 }

 // Palm rejection: ignore accidental resting palm movement while stylus is active or recently active
 if (e.pointerType === 'touch' && (isPenDrawingRef.current || (Date.now() - lastPenActiveTimeRef.current < 250))) {
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

 if (fingerTouches.length >= 2 && !isPenDrawingRef.current) {
 isTwoFingerGestureRef.current = true;

 // Select stable pair of touch points to prevent jumpiness if 3+ touches occur
 let p1: Point;
 let p2: Point;
 const trackedIds = activeTwoFingerIdsRef.current;
 if (trackedIds && touchPointersRef.current.has(trackedIds[0]) && touchPointersRef.current.has(trackedIds[1])) {
 p1 = touchPointersRef.current.get(trackedIds[0])!;
 p2 = touchPointersRef.current.get(trackedIds[1])!;
 } else {
 activeTwoFingerIdsRef.current = [fingerTouches[0][0], fingerTouches[1][0]];
 p1 = fingerTouches[0][1];
 p2 = fingerTouches[1][1];
 }

 const currDist = Math.max(10, Math.hypot(p1.x - p2.x, p1.y - p2.y));
 const currCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

 if (!twoFingerLastCenterRef.current || !twoFingerLastDistRef.current) {
 twoFingerLastCenterRef.current = currCenter;
 twoFingerLastDistRef.current = currDist;
 twoFingerStartDistRef.current = currDist;
 twoFingerStartCenterRef.current = currCenter;
 return;
 }

 const dx = currCenter.x - twoFingerLastCenterRef.current.x;
 const dy = currCenter.y - twoFingerLastCenterRef.current.y;
 const lastDist = twoFingerLastDistRef.current;

 // Calculate scale step with smooth deadzone for pure pan
 let scaleStep = currDist / lastDist;
 const startDist = twoFingerStartDistRef.current || currDist;
 const totalRatioFromStart = currDist / startDist;

 // If finger distance stayed within ±6% of start, prioritize pure butter-smooth pan with no zoom jitter
 if (Math.abs(totalRatioFromStart - 1.0) < 0.06) {
 scaleStep = 1.0;
 } else {
 // Softly clamp per-frame step to prevent erratic jumps
 scaleStep = Math.max(0.86, Math.min(1.16, scaleStep));
 }

 const rect = containerRectRef.current || (containerRef.current ? containerRef.current.getBoundingClientRect() : null);
 const centerScreenX = rect ? (currCenter.x - rect.left) : currCenter.x;
 const centerScreenY = rect ? (currCenter.y - rect.top) : currCenter.y;

 const currentZoom = zoomRef.current;
 const currentPan = panRef.current;

 const nextZoom = Math.max(0.35, Math.min(5.0, currentZoom * scaleStep));
 const actualScaleChange = nextZoom / currentZoom;

 const nextPanX = centerScreenX - (centerScreenX - currentPan.x) * actualScaleChange + dx;
 const nextPanY = centerScreenY - (centerScreenY - currentPan.y) * actualScaleChange + dy;
 const nextPan = clampPan({ x: nextPanX, y: nextPanY }, nextZoom);

 twoFingerLastCenterRef.current = currCenter;
 twoFingerLastDistRef.current = currDist;
 zoomRef.current = nextZoom;
 panRef.current = nextPan;

 // Direct hardware-accelerated DOM transform during live pinch zoom
 if (canvasGroupRef.current) {
 canvasGroupRef.current.setAttribute(
 'transform',
 `translate(${nextPan.x}, ${nextPan.y}) scale(${nextZoom})`
 );
 }
 return;
 }

 // If currently in a two-finger gesture or within exit cooldown, strictly block single-finger canvas drawings
 if (isTwoFingerGestureRef.current || (e.pointerType === 'touch' && twoFingerCooldownUntilRef.current > Date.now())) {
 return;
 }

 if (isPanning) {
 const nextPan = clampPan({
 x: e.clientX - panStartRef.current.x,
 y: e.clientY - panStartRef.current.y,
 }, zoomRef.current);
 panRef.current = nextPan;

 if (canvasGroupRef.current) {
 canvasGroupRef.current.setAttribute(
 'transform',
 `translate(${nextPan.x}, ${nextPan.y}) scale(${zoomRef.current})`
 );
 }
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

 // Resizing trace image / char scale from corner handle
 if (isResizingTrace && onChangeTraceSettings) {
 const { centerScreenX, centerScreenY, initDist, initScale } = traceResizeStartRef.current;
 const currentDist = Math.hypot(e.clientX - centerScreenX, e.clientY - centerScreenY);
 const ratio = currentDist / initDist;
 const rawScale = initScale * ratio;
 const nextScale = Math.round(Math.max(0.2, Math.min(3.0, rawScale)) * 100) / 100;
 onChangeTraceSettings((prev) => ({
 ...prev,
 scale: nextScale,
 }));
 return;
 }

 const pos = screenToCanvas(e.clientX, e.clientY);
 
 // Instantaneous direct hardware DOM update for eraser reticle (0ms latency, bypasses React render tree)
 if (toolMode === 'eraser' && eraserReticleRef.current) {
 eraserReticleRef.current.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
 if (eraserReticleRef.current.style.display === 'none') {
 eraserReticleRef.current.style.display = '';
 }
 }

 // Only update hover cursor coordinates when crosshair, ruler, or pen tool is active, and NOT during panning or brush drawing
 const isDrawingOrPanning =
 toolMode === 'brush' ||
 isShapeTool ||
 isSpacePressed ||
 isPanning;

 const needsHoverPos =
 Boolean(gridSettings.showCursorCrosshair) ||
 (toolMode === 'pen' && Boolean(activePenContour));

 if (needsHoverPos && !isDrawingOrPanning) {
 if (hoverRafRef.current == null) {
 hoverRafRef.current = requestAnimationFrame(() => {
 hoverRafRef.current = null;
 setHoverCanvasPos(pos);
 });
 }
 } else if (!needsHoverPos && hoverCanvasPos !== null) {
 setHoverCanvasPos(null);
 }

 // Active Custom Guideline Drag
 if (draggingGuidelineId) {
 setCustomGuidelines((prev) =>
 prev.map((g) => {
 if (g.id !== draggingGuidelineId) return g;
 return {
 ...g,
 position: g.type === 'v' ? Math.max(0, Math.min(upm, pos.x)) : Math.max(0, Math.min(upm, pos.y)),
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

 if (!e.altKey && (gridSettings.snapToGuides !== false || gridSettings.snapToGrid)) {
 const snapRes = snapSinglePoint(
 pos,
 contours,
 snapMetrics,
 customGuidelines,
 Math.max(7, Math.round(12 / zoom)),
 gridSettings
 );
 endX = snapRes.point.x;
 endY = snapRes.point.y;
 setActiveSnapGuides(snapRes.activeGuides);
 }

 if (e.shiftKey) {
 // Snap to orthogonal (horizontal / vertical) or 45 degrees
 const dx = endX - rulerMeasurement.start.x;
 const dy = endY - rulerMeasurement.start.y;
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
 const { handle, startPoint, initialBBox, initialContours, allInitialNodes: precomputedNodes } = transformSession;
 const rawDx = pos.x - startPoint.x;
 const rawDy = pos.y - startPoint.y;

 if (handle === 'move') {
 let finalDx = rawDx;
 let finalDy = rawDy;

 // Smart snap to Baseline, LSB, Metrics, Grid, and other contours (hold Alt/Option to bypass)
 if (!e.altKey && (Boolean(gridSettings.snapToGuides) || Boolean(gridSettings.snapToGrid))) {
 const otherContours = contours.filter((c) => !selectedContourIds.includes(c.id));
 const snapThreshold = Math.max(7, Math.round(12 / zoom));
 const allInitialNodes = precomputedNodes || initialContours.flatMap((c) => c.nodes);
 const snapResult = snapContourMovement(
 initialBBox,
 rawDx,
 rawDy,
 otherContours,
 snapMetrics,
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

 const nextContours = contours.map((c) => updatedMap.get(c.id) || c);
 pendingTransformContoursRef.current = nextContours;
 if (transformRafRef.current == null) {
 transformRafRef.current = requestAnimationFrame(() => {
 transformRafRef.current = null;
 if (pendingTransformContoursRef.current) {
 onChangeContours(pendingTransformContoursRef.current);
 }
 });
 }
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

 const nextContours = contours.map((c) => updatedMap.get(c.id) || c);
 pendingTransformContoursRef.current = nextContours;
 if (transformRafRef.current == null) {
 transformRafRef.current = requestAnimationFrame(() => {
 transformRafRef.current = null;
 if (pendingTransformContoursRef.current) {
 onChangeContours(pendingTransformContoursRef.current);
 }
 });
 }
 return;
 }

 // Handle Resizing (8 Handles: nw, n, ne, e, se, s, sw, w)
 const { minX, minY, maxX, maxY, width, height } = initialBBox;
 const safeW = Math.max(1, width);
 const safeH = Math.max(1, height);

 let snapX = pos.x;
 let snapY = pos.y;

 if (!e.altKey && (Boolean(gridSettings.snapToGuides) || Boolean(gridSettings.snapToGrid))) {
 const otherContours = contours.filter((c) => !selectedContourIds.includes(c.id));
 const snapThreshold = Math.max(7, Math.round(12 / zoom));
 const snapResult = snapSinglePoint(
 pos,
 otherContours,
 snapMetrics,
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

 const nextContours = contours.map((c) => updatedMap.get(c.id) || c);
 pendingTransformContoursRef.current = nextContours;
 if (transformRafRef.current == null) {
 transformRafRef.current = requestAnimationFrame(() => {
 transformRafRef.current = null;
 if (pendingTransformContoursRef.current) {
 onChangeContours(pendingTransformContoursRef.current);
 }
 });
 }
 return;
 }

 // Eraser Tool continuous sweep-erase while dragging
 if (toolMode === 'eraser' && isErasingRef.current) {
 if (eraserMode === 'all') {
 return;
 }
 const eraseRadius = Math.max(2, eraserSize / 2);
 const prevPos = lastErasePosRef.current || pos;
 lastErasePosRef.current = pos;
 eraserStrokePointsRef.current.push(pos);

 if (eraserMode === 'cut') {
 // Fast SVG preview overlay without mutating/degrading vector contours every frame
 if (activeEraserPathRef.current && eraserStrokePointsRef.current.length > 0) {
 const pts = eraserStrokePointsRef.current;
 let d = `M ${pts[0].x} ${pts[0].y}`;
 for (let i = 1; i < pts.length; i++) {
 d += ` L ${pts[i].x} ${pts[i].y}`;
 }
 activeEraserSvgDRef.current = d;
 activeEraserPathRef.current.setAttribute('d', d);
 }
 } else {
 const currentContours = contoursRef.current || [];
 const updatedContours = eraseContoursAtPoint(currentContours, pos, eraseRadius, eraserMode, prevPos);
 if (updatedContours !== currentContours) {
 if (!erasedAnyInSessionRef.current) {
 onCommitHistory();
 erasedAnyInSessionRef.current = true;
 }
 contoursRef.current = updatedContours;
 onChangeContours(updatedContours, { skipHistory: true });
 setSelectedContourIds((prev) => prev.filter((id) => updatedContours.some((c) => c.id === id)));
 setSelectedContourId((prev) => (prev && updatedContours.some((c) => c.id === prev) ? prev : null));
 setSelectedNodeId((prev) => {
 if (!prev) return null;
 return updatedContours.some((c) => c.nodes.some((n) => n.id === prev)) ? prev : null;
 });
 }
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
 activeBrushSvgDRef.current = d;
 activeBrushPathRef.current.setAttribute('d', d);
 }
 });
 }
 return;
 }

 // Defer all non-straight brush drawing events to requestAnimationFrame!
 const nativeEv = (e.nativeEvent || e) as PointerEvent;
 const rawEvents = typeof nativeEv?.getCoalescedEvents === 'function' ? nativeEv.getCoalescedEvents() : null;
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
 let subPos = screenToCanvas(ev.clientX, ev.clientY);

 // マウス特有の離散化ジッター（1pxの階段状ノイズ）を直前座標と適応的に融合して除去
 if (ev.pointerType === 'mouse' && lastP) {
 subPos = {
 x: subPos.x * 0.75 + lastP.x * 0.25,
 y: subPos.y * 0.75 + lastP.y * 0.25,
 };
 }

 // 距離が極小（1.5px未満）の重複サンプリングは補間に寄与せず計算爆発を招くため除外
 if (lastP) {
 const dx = subPos.x - lastP.x;
 const dy = subPos.y - lastP.y;
 if (dx * dx + dy * dy < 2.25) {
 continue;
 }
 }

 let rawPres = 0.5;
 if (pressureSensitivity === 'off') {
 rawPres = 0.5;
 } else if (ev.pointerType === 'pen') {
 // Apple Pencil / スタイラス：ハードウェアの筆圧センサー値を全域フルレンジで校正
 const p = typeof ev.pressure === 'number' ? ev.pressure : 0;
 if (p > 0) {
 rawPres = Math.max(0.04, Math.min(1.0, (p - 0.03) / 0.65));
 } else {
 rawPres = 0.15;
 }
 if (Date.now() - lastPressureUpdateRef.current > 150) {
 lastPressureUpdateRef.current = Date.now();
 setLiveStylusPressure(Math.round(rawPres * 100));
 }
 } else if (typeof ev.pressure === 'number' && ev.pressure > 0 && ev.pressure !== 0.5) {
 rawPres = ev.pressure;
 } else {
 // マウス・タッチ：安定した速度推定EMAで太さの脈動・ガタつきを抑止
 if (lastP && lastP.time) {
 const dt = Math.max(8, ev.timeStamp - lastP.time);
 const ds = Math.hypot(subPos.x - lastP.x, subPos.y - lastP.y);
 const instantSpeed = Math.min(3.0, ds / dt);
 mouseSmoothSpeedRef.current = mouseSmoothSpeedRef.current * 0.85 + instantSpeed * 0.15;
 const smoothSpeed = mouseSmoothSpeedRef.current;
 rawPres = Math.max(0.35, Math.min(0.80, 0.65 - (smoothSpeed - 0.5) * 0.18));
 }
 }

 // ペンタブレットは即応（88%新筆圧）、マウス時は高平滑（75%直前筆圧）で線の波打ちを徹底防止
 const pres = pressureSensitivity === 'off'
 ? 0.5
 : (ev.pointerType === 'pen'
 ? (lastP && typeof lastP.pressure === 'number' ? lastP.pressure * 0.12 + rawPres * 0.88 : rawPres)
 : (lastP && typeof lastP.pressure === 'number' ? lastP.pressure * 0.75 + rawPres * 0.25 : rawPres));
 const ptItem: StrokePoint = { x: subPos.x, y: subPos.y, pressure: pres, time: ev.timeStamp, pointerType: ev.pointerType };
 brushStrokePointsRef.current.push(ptItem);
 lastP = ptItem;
 hasNewPoints = true;
 }

 // 新規点が追加された場合のみパス再計算とDOM更新を行い、減速・停止時の無駄な再描画を回避
 if (hasNewPoints && activeBrushPathRef.current && brushStrokePointsRef.current.length > 0) {
 const contour = getProcessedBrushContour(brushStrokePointsRef.current, false);
 const d = contoursToSvgPath([contour]);
 activeBrushSvgDRef.current = d;
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
 if (!e.altKey && (Boolean(gridSettings.snapToGuides) || Boolean(gridSettings.snapToGrid))) {
 const snapResult = snapSinglePoint(
 pos,
 contours,
 snapMetrics,
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

 if (e.pointerType === 'touch') {
 setTouchLoupeState({
 visible: true,
 screenX: e.clientX,
 screenY: e.clientY,
 canvasPos: snapPos,
 });
 }

 if (selectedHandleType === 'node' && !e.altKey && (Boolean(gridSettings.snapToGuides) || Boolean(gridSettings.snapToGrid))) {
 const otherContours = contours.filter((c) => c.id !== selectedContourId);
 const snapThreshold = Math.min(5, Math.max(2, Math.round(4 / zoom)));
 const snapResult = snapSinglePoint(
 pos,
 otherContours,
 snapMetrics,
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
 if (e.altKey) {
 return {
 ...node,
 handleOut: { x: pos.x, y: pos.y },
 type: 'corner' as const,
 };
 }
 if (node.type === 'smooth' || node.type === 'symmetric') {
 const dx = pos.x - node.x;
 const dy = pos.y - node.y;
 const lenOut = Math.hypot(dx, dy);
 let handleIn = node.handleIn;
 if (lenOut > 0.01 && handleIn) {
 const lenIn =
 node.type === 'symmetric'
 ? lenOut
 : Math.hypot(handleIn.x - node.x, handleIn.y - node.y);
 const angle = Math.atan2(dy, dx);
 handleIn = {
 x: Math.round(node.x - Math.cos(angle) * lenIn),
 y: Math.round(node.y - Math.sin(angle) * lenIn),
 };
 }
 return {
 ...node,
 handleOut: { x: pos.x, y: pos.y },
 handleIn,
 };
 }
 return {
 ...node,
 handleOut: { x: pos.x, y: pos.y },
 };
 } else if (selectedHandleType === 'handleIn') {
 if (e.altKey) {
 return {
 ...node,
 handleIn: { x: pos.x, y: pos.y },
 type: 'corner' as const,
 };
 }
 if (node.type === 'smooth' || node.type === 'symmetric') {
 const dx = pos.x - node.x;
 const dy = pos.y - node.y;
 const lenIn = Math.hypot(dx, dy);
 let handleOut = node.handleOut;
 if (lenIn > 0.01 && handleOut) {
 const lenOut =
 node.type === 'symmetric'
 ? lenIn
 : Math.hypot(handleOut.x - node.x, handleOut.y - node.y);
 const angle = Math.atan2(dy, dx);
 handleOut = {
 x: Math.round(node.x - Math.cos(angle) * lenOut),
 y: Math.round(node.y - Math.sin(angle) * lenOut),
 };
 }
 return {
 ...node,
 handleIn: { x: pos.x, y: pos.y },
 handleOut,
 };
 }
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

 // Helper to construct shape contours from 2 bounding drag points
 const getShapeContoursFromPoints = (
 mode: ToolMode,
 p1: Point,
 p2: Point,
 options?: { shiftKey?: boolean; altKey?: boolean }
 ): PathContour[] => {
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
 return [createRectContour(minX, minY, maxX, maxY)];
 case 'rounded_rect':
 return [createRoundedRectContour(cx, cy, width, height, Math.min(width, height) * 0.2)];
 case 'pill':
 return [createPillContour(cx, cy, width, height)];
 case 'ellipse':
 case 'circle':
 return [createEllipseContour(cx, cy, rx, ry)];
 case 'triangle':
 return [createTriangleContour(cx, cy, width, height, 'up')];
 case 'triangle_down':
 return [createTriangleContour(cx, cy, width, height, 'down')];
 case 'right_triangle':
 return [createRightTriangleContour(cx, cy, width, height)];
 case 'semicircle':
 return [createSemicircleContour(cx, cy, rx, ry, 'top')];
 case 'ring':
 return createRingContours(cx, cy, rx, ry * 0.55);
 case 'parallelogram':
 return [createParallelogramContour(cx, cy, width, height, 18)];
 case 'star':
 return [createStarContour(cx, cy, Math.max(rx, ry), Math.max(rx, ry) * 0.42, 5)];
 case 'heart':
 return [createHeartContour(cx, cy, width, height)];
 case 'sparkle':
 return [createSparkleContour(cx, cy, Math.max(rx, ry), 0.22)];
 case 'starburst':
 return [createStarburstContour(cx, cy, Math.max(rx, ry), 0.45, 8)];
 case 'diamond':
 return [createDiamondContour(cx, cy, width, height)];
 case 'polygon':
 return [createHexagonContour(cx, cy, Math.max(rx, ry))];
 case 'crescent':
 return [createCrescentContour(cx, cy, Math.max(rx, ry))];
 case 'line': {
 let lEndX = p2.x;
 let lEndY = p2.y;
 if (options?.shiftKey || isShiftLockRatio) {
 const snapped = snapToStraightAngle(p1.x, p1.y, p2.x, p2.y);
 lEndX = snapped.x;
 lEndY = snapped.y;
 }
 return [createLineContour(p1.x, p1.y, lEndX, lEndY, brushWidth || 32)];
 }
 default:
 return [createRectContour(minX, minY, maxX, maxY)];
 }
 };

 const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
 setTouchLoupeState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
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
 if (e.pointerType === 'pen') {
 isPenDrawingRef.current = false;
 lastPenActiveTimeRef.current = Date.now();
 }

 const remainingTouches = Array.from(touchPointersRef.current.entries())
 .filter(([id]) => pointerTypesRef.current.get(id) === 'touch');

 // If down to 1 or 0 fingers from a two-finger gesture:
 if (remainingTouches.length >= 2) {
 // Still 2 or more fingers (e.g. 3 fingers touched, 1 lifted): re-anchor seamlessly
 activeTwoFingerIdsRef.current = [remainingTouches[0][0], remainingTouches[1][0]];
 const p1 = remainingTouches[0][1];
 const p2 = remainingTouches[1][1];
 const dist = Math.max(10, Math.hypot(p1.x - p2.x, p1.y - p2.y));
 const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
 twoFingerLastCenterRef.current = center;
 twoFingerLastDistRef.current = dist;
 twoFingerStartDistRef.current = dist;
 twoFingerStartCenterRef.current = center;
 } else {
 twoFingerLastCenterRef.current = null;
 twoFingerLastDistRef.current = null;
 twoFingerStartDistRef.current = null;
 twoFingerStartCenterRef.current = null;
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
 isTwoFingerGestureRef.current = false;
 twoFingerCooldownUntilRef.current = Date.now() + 150;
 activeTwoFingerIdsRef.current = null;
 return;
 }
 } else if (touchCount === 3) {
 if (onRedo) {
 onRedo();
 showCanvasToast('↻ 3本指タップ: やり直し');
 isTwoFingerGestureRef.current = false;
 twoFingerCooldownUntilRef.current = Date.now() + 150;
 activeTwoFingerIdsRef.current = null;
 return;
 }
 }
 }
 }

 // If we were in a two-finger gesture, do not commit any drawing or shape actions
 if (isTwoFingerGestureRef.current) {
 if (touchPointersRef.current.size === 0) {
 isTwoFingerGestureRef.current = false;
 twoFingerCooldownUntilRef.current = Date.now() + 150;
 activeTwoFingerIdsRef.current = null;
 }
 if (Math.abs(zoomRef.current - zoom) > 0.001 || Math.abs(panRef.current.x - pan.x) > 0.5 || Math.abs(panRef.current.y - pan.y) > 0.5) {
 setZoom(zoomRef.current);
 setPan(panRef.current);
 }
 return;
 }

 if (touchPointersRef.current.size < 2) {
 twoFingerLastCenterRef.current = null;
 twoFingerLastDistRef.current = null;
 twoFingerStartDistRef.current = null;
 twoFingerStartCenterRef.current = null;
 }

 if (pinchRafRef.current != null) {
 cancelAnimationFrame(pinchRafRef.current);
 pinchRafRef.current = null;
 }
 if (pendingPinchStateRef.current) {
 setZoom(pendingPinchStateRef.current.zoom);
 setPan(pendingPinchStateRef.current.pan);
 zoomRef.current = pendingPinchStateRef.current.zoom;
 panRef.current = pendingPinchStateRef.current.pan;
 pendingPinchStateRef.current = null;
 }
 if (panRafRef.current != null) {
 cancelAnimationFrame(panRafRef.current);
 panRafRef.current = null;
 }
 if (pendingPanRef.current) {
 setPan(pendingPanRef.current);
 panRef.current = pendingPanRef.current;
 pendingPanRef.current = null;
 }
 containerRectRef.current = null;

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

 if (isResizingTrace) {
 setIsResizingTrace(false);
 return;
 }

 if (isPanning) {
 setIsPanning(false);
 setPan(panRef.current);
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
 const dist = Math.hypot(rulerMeasurement.end.x - rulerMeasurement.start.x, rulerMeasurement.end.y - rulerMeasurement.start.y);
 // If distance is negligible (user tapped/clicked to dismiss or reset), clear measurement
 if (dist < 4) {
 setRulerMeasurement(null);
 return;
 }

 setRulerMeasurement({
 ...rulerMeasurement,
 active: false,
 });
 return;
 }

 // Finalize Eraser Tool sweep session
 if (toolMode === 'eraser' && isErasingRef.current) {
 try {
 (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
 } catch {
 // Ignored
 }
 isErasingRef.current = false;
 lastErasePosRef.current = null;
 activeEraserSvgDRef.current = '';
 if (activeEraserPathRef.current) {
 activeEraserPathRef.current.setAttribute('d', '');
 }

 if (eraserMode === 'cut' && eraserStrokePointsRef.current.length > 0) {
 const eraseRadius = Math.max(2, eraserSize / 2);
 const rawPts = eraserStrokePointsRef.current;
 eraserStrokePointsRef.current = [];
 const pts = rawPts.length === 1
 ? [rawPts[0], { x: rawPts[0].x + 0.1, y: rawPts[0].y + 0.1 }]
 : rawPts;
 const currentContours = contoursRef.current || [];
 const updated = subtractEraserStrokeFromContours(currentContours, pts, eraseRadius);
 if (updated !== currentContours) {
 onCommitHistory();
 contoursRef.current = updated;
 onChangeContours(updated);
 showCanvasToast('パスを削り・分割しました');
 }
 } else if (erasedAnyInSessionRef.current) {
 erasedAnyInSessionRef.current = false;
 setSelectedContourIds((prev) => prev.filter((id) => (contoursRef.current || []).some((c) => c.id === id)));
 setSelectedContourId((prev) => (prev && (contoursRef.current || []).some((c) => c.id === prev) ? prev : null));
 setSelectedNodeId((prev) => {
 if (!prev) return null;
 return (contoursRef.current || []).some((c) => c.nodes.some((n) => n.id === prev)) ? prev : null;
 });
 }
 eraserStrokePointsRef.current = [];
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
 let subPos = screenToCanvas(ev.clientX, ev.clientY);

 // マウス特有の離散化ジッター（1pxの階段状ノイズ）を直前座標と適応的に融合して除去
 if (ev.pointerType === 'mouse' && lastP) {
 subPos = {
 x: subPos.x * 0.75 + lastP.x * 0.25,
 y: subPos.y * 0.75 + lastP.y * 0.25,
 };
 }

 // 距離が極小（1.5px未満）の重複サンプリングは除外
 if (lastP) {
 const dx = subPos.x - lastP.x;
 const dy = subPos.y - lastP.y;
 if (dx * dx + dy * dy < 2.25) {
 continue;
 }
 }

 let rawPres = 0.5;
 if (pressureSensitivity === 'off') {
 rawPres = 0.5;
 } else if (ev.pointerType === 'pen') {
 const p = typeof ev.pressure === 'number' ? ev.pressure : 0;
 rawPres = p > 0 ? Math.max(0.04, Math.min(1.0, (p - 0.03) / 0.65)) : 0.15;
 } else if (typeof ev.pressure === 'number' && ev.pressure > 0 && ev.pressure !== 0.5) {
 rawPres = ev.pressure;
 } else {
 if (lastP && lastP.time) {
 const dt = Math.max(8, ev.timeStamp - lastP.time);
 const ds = Math.hypot(subPos.x - lastP.x, subPos.y - lastP.y);
 const instantSpeed = Math.min(3.0, ds / dt);
 mouseSmoothSpeedRef.current = mouseSmoothSpeedRef.current * 0.85 + instantSpeed * 0.15;
 const smoothSpeed = mouseSmoothSpeedRef.current;
 rawPres = Math.max(0.35, Math.min(0.80, 0.65 - (smoothSpeed - 0.5) * 0.18));
 }
 }

 const pres = pressureSensitivity === 'off'
 ? 0.5
 : (ev.pointerType === 'pen'
 ? (lastP && typeof lastP.pressure === 'number' ? lastP.pressure * 0.12 + rawPres * 0.88 : rawPres)
 : (lastP && typeof lastP.pressure === 'number' ? lastP.pressure * 0.75 + rawPres * 0.25 : rawPres));
 const ptItem: StrokePoint = { x: subPos.x, y: subPos.y, pressure: pres, time: ev.timeStamp, pointerType: ev.pointerType };
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

 // 軽くタップしただけの偶発接触（stray touch / accidental tap）を判別
 const duration = Date.now() - brushStrokeStartTimeRef.current;
 const startPos = brushStrokeStartPosRef.current;
 let maxDistFromStart = 0;
 let totalStrokeLength = 0;
 for (let i = 0; i < pts.length; i++) {
 const dStart = Math.hypot(pts[i].x - startPos.x, pts[i].y - startPos.y);
 if (dStart > maxDistFromStart) maxDistFromStart = dStart;
 if (i > 0) {
 totalStrokeLength += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
 }
 }

 // スタイラス（ペン）で意図してしっかり押し当てた点打ち（筆圧 > 0.38）は許可
 const isDeliberatePenTap = e.pointerType === 'pen' && pts.some((p) => (p.pressure || 0) > 0.38);

 // スマホ・タブレット等の微小タップや誤接触（画面に軽く触れてすぐ離しただけ）を破棄:
 // ・点数が1個以下、または移動量が極小（maxDistFromStart < 5px かつ totalStrokeLength < 8px）
 // ・かつ接触時間が短い（duration < 280ms）
 // ・かつ意図的な筆圧ペンタップ（isDeliberatePenTap）ではない
 // ※ 意図して点を打つ場合は長押し（280ms以上）するか、軽く払うように点を打つ（5px以上動く）ことで自然に描画可能
 const isAccidentalTap = !isDeliberatePenTap && (pts.length <= 1 || (maxDistFromStart < 5.0 && totalStrokeLength < 8.0)) && duration < 280;
 if (isAccidentalTap) {
 return;
 }

 if (pts.length > 0) {
 const finalizedContour = getProcessedBrushContour(pts, true);
 // 全画（ストローク）を破壊せず安全に配列へ保持追加（前画の消滅を100%防ぐ）
 const currentContours = contoursRef.current || [];
 const nextContours = [...currentContours, finalizedContour];
 contoursRef.current = nextContours;
 onChangeContours(nextContours);
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

 const newContours = getShapeContoursFromPoints(toolMode, p1, p2, {
 shiftKey: e.shiftKey,
 altKey: e.altKey,
 });
 const currentContours = contoursRef.current || [];
 const nextContours = [...currentContours, ...newContours];
 contoursRef.current = nextContours;
 onChangeContours(nextContours);
 setSelectedContourIds([]);
 setSelectedContourId(null);
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
 if (transformRafRef.current != null) {
 cancelAnimationFrame(transformRafRef.current);
 transformRafRef.current = null;
 }
 if (pendingTransformContoursRef.current) {
 onChangeContours(pendingTransformContoursRef.current);
 pendingTransformContoursRef.current = null;
 }
 setTransformSession(null);
 setRotateDisplayAngle(null);
 onCommitHistory();
 }
 };

 const handlePointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
 if (e.pointerType !== 'touch') {
 try {
 if (e.currentTarget?.hasPointerCapture?.(e.pointerId)) {
 e.currentTarget.releasePointerCapture(e.pointerId);
 }
 } catch {
 // Ignored
 }
 }
 touchPointersRef.current.delete(e.pointerId);
 pointerTypesRef.current.delete(e.pointerId);

 if (e.pointerType === 'pen') {
 isPenDrawingRef.current = false;
 lastPenActiveTimeRef.current = Date.now();
 }

 const remainingTouches = Array.from(touchPointersRef.current.entries())
 .filter(([id]) => pointerTypesRef.current.get(id) === 'touch');

 if (remainingTouches.length >= 2) {
 activeTwoFingerIdsRef.current = [remainingTouches[0][0], remainingTouches[1][0]];
 const p1 = remainingTouches[0][1];
 const p2 = remainingTouches[1][1];
 const dist = Math.max(10, Math.hypot(p1.x - p2.x, p1.y - p2.y));
 const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
 twoFingerLastCenterRef.current = center;
 twoFingerLastDistRef.current = dist;
 twoFingerStartDistRef.current = dist;
 twoFingerStartCenterRef.current = center;
 } else {
 twoFingerLastCenterRef.current = null;
 twoFingerLastDistRef.current = null;
 twoFingerStartDistRef.current = null;
 twoFingerStartCenterRef.current = null;
 if (touchPointersRef.current.size === 0) {
 if (isTwoFingerGestureRef.current) {
 twoFingerCooldownUntilRef.current = Date.now() + 150;
 }
 isTwoFingerGestureRef.current = false;
 activeTwoFingerIdsRef.current = null;
 }
 }

 if (Math.abs(zoomRef.current - zoom) > 0.001 || Math.abs(panRef.current.x - pan.x) > 0.5 || Math.abs(panRef.current.y - pan.y) > 0.5) {
 setZoom(zoomRef.current);
 setPan(panRef.current);
 }

 // If drawing brush stroke and pointer was cancelled by iPad bezel touch (not a two-finger pinch gesture),
 // salvage and finalize the stroke instead of throwing it away!
 if (toolMode === 'brush' && brushStrokePointsRef.current.length >= 3 && !isTwoFingerGestureRef.current) {
 handlePointerUp(e);
 return;
 }

 // Cancel any in-progress stroke or drag cleanly
 brushStrokePointsRef.current = [];
 if (activeBrushPathRef.current) {
 activeBrushPathRef.current.setAttribute('d', '');
 }
 if (isErasingRef.current) {
 isErasingRef.current = false;
 lastErasePosRef.current = null;
 activeEraserSvgDRef.current = '';
 if (activeEraserPathRef.current) {
 activeEraserPathRef.current.setAttribute('d', '');
 }
 if (eraserMode === 'cut' && eraserStrokePointsRef.current.length > 0) {
 const eraseRadius = Math.max(2, eraserSize / 2);
 const rawPts = eraserStrokePointsRef.current;
 eraserStrokePointsRef.current = [];
 const pts = rawPts.length === 1
 ? [rawPts[0], { x: rawPts[0].x + 0.1, y: rawPts[0].y + 0.1 }]
 : rawPts;
 const currentContours = contoursRef.current || [];
 const updated = subtractEraserStrokeFromContours(currentContours, pts, eraseRadius);
 if (updated !== currentContours) {
 onCommitHistory();
 contoursRef.current = updated;
 onChangeContours(updated);
 }
 } else if (erasedAnyInSessionRef.current) {
 erasedAnyInSessionRef.current = false;
 }
 eraserStrokePointsRef.current = [];
 }
 setShapeStartPoint(null);
 setShapeCurrentPoint(null);
 setMarqueeSelection(null);
 setDraggingMetric(null);
 setDraggingGuidelineId(null);
 setIsDraggingTrace(false);
 setIsResizingTrace(false);
 setIsPanning(false);
 setActiveSnapGuides([]);
 containerRectRef.current = null;
 };

 const handlePointerLeave = () => {
 if (hoverRafRef.current != null) {
 cancelAnimationFrame(hoverRafRef.current);
 hoverRafRef.current = null;
 }
 if (pinchRafRef.current != null) {
 cancelAnimationFrame(pinchRafRef.current);
 pinchRafRef.current = null;
 }
 if (panRafRef.current != null) {
 cancelAnimationFrame(panRafRef.current);
 panRafRef.current = null;
 }
 if (isErasingRef.current) {
 isErasingRef.current = false;
 lastErasePosRef.current = null;
 activeEraserSvgDRef.current = '';
 if (activeEraserPathRef.current) {
 activeEraserPathRef.current.setAttribute('d', '');
 }
 if (eraserMode === 'cut' && eraserStrokePointsRef.current.length > 0) {
 const eraseRadius = Math.max(2, eraserSize / 2);
 const rawPts = eraserStrokePointsRef.current;
 eraserStrokePointsRef.current = [];
 const pts = rawPts.length === 1
 ? [rawPts[0], { x: rawPts[0].x + 0.1, y: rawPts[0].y + 0.1 }]
 : rawPts;
 const currentContours = contoursRef.current || [];
 const updated = subtractEraserStrokeFromContours(currentContours, pts, eraseRadius);
 if (updated !== currentContours) {
 onCommitHistory();
 contoursRef.current = updated;
 onChangeContours(updated);
 }
 } else if (erasedAnyInSessionRef.current) {
 erasedAnyInSessionRef.current = false;
 }
 eraserStrokePointsRef.current = [];
 }
 containerRectRef.current = null;
 twoFingerLastCenterRef.current = null;
 twoFingerLastDistRef.current = null;
 twoFingerStartDistRef.current = null;
 if (eraserReticleRef.current) {
 eraserReticleRef.current.style.display = 'none';
 }
 setHoverCanvasPos(null);
 };

 const handleLostPointerCapture = useCallback(() => {
 if (isErasingRef.current) {
 isErasingRef.current = false;
 lastErasePosRef.current = null;
 activeEraserSvgDRef.current = '';
 if (activeEraserPathRef.current) {
 activeEraserPathRef.current.setAttribute('d', '');
 }
 eraserStrokePointsRef.current = [];
 erasedAnyInSessionRef.current = false;
 }
 isPenDrawingRef.current = false;
 isTwoFingerGestureRef.current = false;
 activeTwoFingerIdsRef.current = null;
 setIsPanning(false);
 setIsDraggingTrace(false);
 setIsResizingTrace(false);
 setDraggingMetric(null);
 setDraggingGuidelineId(null);
 setMarqueeSelection(null);
 }, []);

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

 // Ctrl+C / Cmd+C: Copy selected contours
 if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !activePenContour) {
 if ((toolMode === 'select' || toolMode === 'node') && selectedContourIds.length > 0) {
 e.preventDefault();
 const selected = contours.filter((c) => selectedContourIds.includes(c.id));
 try {
 sessionStorage.setItem('font_editor_clipboard_contours', JSON.stringify(selected));
 showCanvasToast(`パス (${selected.length}個) をコピーしました`, 'Ctrl+V で貼り付け');
 } catch (err) {
 console.warn('Failed to copy to clipboard:', err);
 }
 return;
 }
 }

 // Ctrl+X / Cmd+X: Cut selected contours
 if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
 if ((toolMode === 'select' || toolMode === 'node') && selectedContourIds.length > 0) {
 e.preventDefault();
 const selected = contours.filter((c) => selectedContourIds.includes(c.id));
 try {
 sessionStorage.setItem('font_editor_clipboard_contours', JSON.stringify(selected));
 } catch (err) {
 console.warn('Failed to copy to clipboard:', err);
 }
 handleDeleteSelected();
 showCanvasToast(`パス (${selected.length}個) を切り取りました`);
 return;
 }
 }

 // Ctrl+V / Cmd+V: Paste contours from clipboard
 if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
 if (toolMode === 'select' || toolMode === 'node' || toolMode === 'pen' || toolMode === 'brush') {
 e.preventDefault();
 try {
 const raw = sessionStorage.getItem('font_editor_clipboard_contours');
 if (raw) {
 const parsed = JSON.parse(raw) as PathContour[];
 if (Array.isArray(parsed) && parsed.length > 0) {
 const dups = duplicateMultipleContours(parsed, 30, 30);
 onChangeContours([...contours, ...dups]);
 setSelectedContourIds(dups.map((d) => d.id));
 onCommitHistory();
 showCanvasToast(`クリップボードからパス (${dups.length}個) を貼り付けました`);
 return;
 }
 }
 } catch (err) {
 console.warn('Failed to paste from clipboard:', err);
 }
 }
 }

 // Ctrl+D / Cmd+D: Duplicate selected contours
 if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
 if ((toolMode === 'select' || toolMode === 'node') && selectedContourIds.length > 0) {
 e.preventDefault();
 if (selectedContourIds.length === 1) {
 const target = contours.find((c) => c.id === selectedContourIds[0]);
 if (target) {
 const dup = duplicateContour(target, 40, 40);
 onChangeContours([...contours, dup]);
 setSelectedContourIds([dup.id]);
 }
 } else {
 const selected = contours.filter((c) => selectedContourIds.includes(c.id));
 const dups = duplicateMultipleContours(selected, 40, 40);
 onChangeContours([...contours, ...dups]);
 setSelectedContourIds(dups.map((d) => d.id));
 }
 onCommitHistory();
 showCanvasToast('選択パーツを複製しました');
 return;
 }
 }

 // Arrow keys nudge (1px, or 10px with Shift)
 if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
 if ((toolMode === 'select' || toolMode === 'node') && selectedContourIds.length > 0) {
 e.preventDefault();
 const step = e.shiftKey ? 10 : 1;
 const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
 const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;

 if (selectedContourIds.length === 1 && selectedNodeId) {
 const targetId = selectedContourIds[0];
 const updated = contours.map((c) => {
 if (c.id !== targetId) return c;
 return {
 ...c,
 nodes: c.nodes.map((n) => {
 if (n.id !== selectedNodeId) return n;
 return {
 ...n,
 x: Math.round(n.x + dx),
 y: Math.round(n.y + dy),
 handleIn: n.handleIn ? { x: Math.round(n.handleIn.x + dx), y: Math.round(n.handleIn.y + dy) } : null,
 handleOut: n.handleOut ? { x: Math.round(n.handleOut.x + dx), y: Math.round(n.handleOut.y + dy) } : null,
 };
 }),
 };
 });
 onChangeContours(updated);
 onCommitHistory();
 } else {
 const updatedMap = new Map<string, PathContour>();
 for (const c of contours) {
 if (selectedContourIds.includes(c.id)) {
 updatedMap.set(c.id, {
 ...c,
 nodes: c.nodes.map((n) => ({
 ...n,
 x: Math.round(n.x + dx),
 y: Math.round(n.y + dy),
 handleIn: n.handleIn ? { x: Math.round(n.handleIn.x + dx), y: Math.round(n.handleIn.y + dy) } : null,
 handleOut: n.handleOut ? { x: Math.round(n.handleOut.x + dx), y: Math.round(n.handleOut.y + dy) } : null,
 })),
 });
 }
 }
 onChangeContours(contours.map((c) => updatedMap.get(c.id) || c));
 onCommitHistory();
 }
 return;
 }
 }

 // Ctrl+Z / Cmd+Z: Global Undo (or undo last node if actively drawing pen path)
 if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.key.toLowerCase() === 'z')) {
 if (activePenContour && activePenContour.nodes.length > 0 && !e.shiftKey) {
 e.preventDefault();
 e.stopImmediatePropagation();
 handleUndoPenNode();
 return;
 }
 e.preventDefault();
 e.stopImmediatePropagation();
 if (e.shiftKey) {
 onRedoRef.current?.();
 } else {
 onUndoRef.current?.();
 }
 return;
 }

 // Ctrl+Y / Cmd+Y: Global Redo
 if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyY' || e.key.toLowerCase() === 'y')) {
 e.preventDefault();
 e.stopImmediatePropagation();
 onRedoRef.current?.();
 return;
 }

 // ESC: Reset/Discard in-progress path, clear ruler measurement, or deselect
 if (e.key === 'Escape') {
 if (rulerMeasurement) {
 e.preventDefault();
 setRulerMeasurement(null);
 } else if (activePenContour) {
 e.preventDefault();
 handleResetPenContour();
 } else if (selectedContourIds.length > 0) {
 setSelectedContourIds([]);
 setSelectedNodeId(null);
 }
 } else if (e.key === 'Delete' || e.key === 'Backspace') {
 // While in ruler measurement -> Backspace/Delete clears the measured line!
 if (toolMode === 'ruler' && rulerMeasurement) {
 e.preventDefault();
 setRulerMeasurement(null);
 } else if (activePenContour) {
 // While drawing pen path -> Backspace/Delete undos the last placed node!
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
 } else if (
 ((e.key === 'o' || e.key === 'O') && (e.shiftKey || e.altKey)) ||
 ((e.key === 'w' || e.key === 'W') && e.altKey)
 ) {
 e.preventDefault();
 setOutlineOnly((prev) => {
 const next = !prev;
 showCanvasToast(
 next
 ? '輪郭表示モードを有効にしました（パスの重なりや形状を透過確認）'
 : '塗りつぶし表示モードに戻しました'
 );
 return next;
 });
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
 setOutlineOnly,
 showCanvasToast,
 ]);

 // Zoom handlers
 const handleZoomIn = () => setZoom((z) => Math.min(3.0, z * 1.25));
 const handleZoomOut = () => setZoom((z) => Math.max(0.2, z * 0.8));
 const handleResetZoom = () => {
 if (containerRef.current) {
 const rect = containerRef.current.getBoundingClientRect();
 const idealZoom = Math.min((rect.width - 60) / upm, (rect.height - 60) / upm, 0.7);
 setZoom(idealZoom);
 setPan({
 x: (rect.width - upm * idealZoom) / 2,
 y: (rect.height - upm * idealZoom) / 2,
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
 const remaining = contours.filter((c) => !selectedContourIds.includes(c.id));
 if (remaining.length === 0) {
 if (activeBrushPathRef.current) {
 activeBrushPathRef.current.setAttribute('d', '');
 }
 activeBrushSvgDRef.current = '';
 if (activeEraserPathRef.current) {
 activeEraserPathRef.current.setAttribute('d', '');
 }
 activeEraserSvgDRef.current = '';
 brushStrokePointsRef.current = [];
 }
 onChangeContours(remaining);
 setSelectedContourIds([]);
 setSelectedNodeId(null);
 setSelectedHandleType(null);
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

 // Boolean Difference (型抜き): Subtract cutter paths from base path
 const handleSubtractSelectedContours = () => {
 if (selectedContourIds.length < 2) {
 showCanvasToast('型抜きには2つ以上のパスを選択してください');
 return;
 }
 const selected = contours.filter((c) => selectedContourIds.includes(c.id));
 const base = [selected[0]];
 const cutters = selected.slice(1);
 const result = booleanSubtractContours(base, cutters);
 if (result.length === 0) {
 showCanvasToast('型抜き結果が空になりました');
 return;
 }
 const other = contours.filter((c) => !selectedContourIds.includes(c.id));
 const updated = [...other, ...result];
 onChangeContours(updated);
 setSelectedContourIds(result.map((r) => r.id));
 onCommitHistory();
 showCanvasToast('パスを型抜き（前面で背面を切り抜き）しました');
 };

 // Boolean Intersection (交差): Keep only overlapping region
 const handleIntersectSelectedContours = () => {
 if (selectedContourIds.length < 2) {
 showCanvasToast('交差には2つ以上のパスを選択してください');
 return;
 }
 const selected = contours.filter((c) => selectedContourIds.includes(c.id));
 const base = [selected[0]];
 const cutters = selected.slice(1);
 const result = booleanIntersectContours(base, cutters);
 if (result.length === 0) {
 showCanvasToast('交差部分がありませんでした');
 return;
 }
 const other = contours.filter((c) => !selectedContourIds.includes(c.id));
 const updated = [...other, ...result];
 onChangeContours(updated);
 setSelectedContourIds(result.map((r) => r.id));
 onCommitHistory();
 showCanvasToast('パスの交差重なり部分を抽出しました');
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
 `${selectedContourIds.length}個のパスのアンカーポイント最適化完了`
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

 // 1-Click Straighten & De-wobble wobbly strokes
 const handleStraightenWobblySelected = () => {
 if (selectedContourIds.length === 0) {
 handleStraightenWobblyAll();
 return;
 }
 const updated = contours.map((c) => {
 if (!selectedContourIds.includes(c.id)) return c;
 return straightenWobblyContour(c);
 });
 onChangeContours(updated);
 onCommitHistory();
 showCanvasToast('選択パスの歪み・うねりを直線化補正しました', `${selectedContourIds.length}個のパーツ`);
 };

 const handleStraightenWobblyAll = () => {
 if (contours.length === 0) return;
 const updated = contours.map((c) => straightenWobblyContour(c));
 onChangeContours(updated);
 onCommitHistory();
 showCanvasToast('全ストロークの歪み・うねりを直線化補正しました', `${contours.length}個のパーツ`);
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

 const handleExpandStrokeSelected = () => {
 if (selectedContourIds.length === 0) return;
 const targetContours = contours.filter((c) => selectedContourIds.includes(c.id));
 const nonTargetContours = contours.filter((c) => !selectedContourIds.includes(c.id));
 const expanded = expandStrokeContours(targetContours, penStrokeWidth, penCapStyle);
 if (expanded && expanded.length > 0) {
 onChangeContours([...nonTargetContours, ...expanded]);
 setSelectedContourIds(expanded.map((e) => e.id));
 setSelectedContourId(expanded[0].id);
 onCommitHistory();
 showCanvasToast(
 `選択パスを太さ ${penStrokeWidth}px の線輪郭に変換しました`,
 `${expanded.length} 個の輪郭 (端点: ${penCapStyle === 'round' ? '丸' : penCapStyle === 'butt' ? '平' : '角'})`
 );
 }
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

 // Memoized SVG Paths using WeakMap cache so panning, zooming, and adding new strokes do not recalculate existing complex curves
 const mainSvgPath = useMemo(() => {
 if (!contours || contours.length === 0) return '';
 return contours.map(getCachedContourSvgPath).join(' ');
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
 initOffsetX: traceSettings.offsetX || 0,
 initOffsetY: traceSettings.offsetY || 0,
 };
 },
 [traceSettings.offsetX, traceSettings.offsetY]
 );

 const handlePointerDownTraceResize = useCallback(
 (e: React.PointerEvent, _handle: TraceResizeHandle) => {
 e.stopPropagation();
 setIsResizingTrace(true);
 const rect = containerRef.current?.getBoundingClientRect();
 const currentZoom = zoom;
 const currentPan = pan;
 const centerCanvasX = (upm / 2) + (traceSettings.offsetX || 0);
 const centerCanvasY = (upm / 2) + (traceSettings.offsetY || 0);
 const centerScreenX = (rect ? rect.left : 0) + currentPan.x + centerCanvasX * currentZoom;
 const centerScreenY = (rect ? rect.top : 0) + currentPan.y + centerCanvasY * currentZoom;
 const initDist = Math.hypot(e.clientX - centerScreenX, e.clientY - centerScreenY);

 traceResizeStartRef.current = {
 clientX: e.clientX,
 clientY: e.clientY,
 initScale: traceSettings.scale ?? 1,
 initDist: Math.max(10, initDist),
 centerScreenX,
 centerScreenY,
 };
 },
 [zoom, pan, traceSettings.offsetX, traceSettings.offsetY, traceSettings.scale, upm]
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
 <div className={`w-full h-full flex flex-col relative overflow-hidden select-none transition-colors ${themeClasses.canvasOuterBg} ${isAnyModalOpen ? 'pointer-events-none' : ''}`}>
 {/* Universal Docked Sub-Toolbar (Outside SVG viewport, clean & non-overlapping, collapsible) */}
 {!isMobileFocusMode && showSubToolbar ? (
 <div
 className={`h-11 border-b flex items-center justify-between px-2.5 sm:px-3 shrink-0 z-20 select-none overflow-x-auto no-scrollbar gap-2 transition-colors ${themeClasses.subtoolbarBg}`}
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
 className="sm:hidden px-2 py-1 rounded text-xs font-bold border transition-colors flex items-center space-x-1 bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 shrink-0"
 title="ペンの種類と太さを設定"
 >
 <Paintbrush className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
 <span>{PEN_PRESETS.find((p) => p.id === brushStyle)?.name || 'ペン'}</span>
 <span className="font-mono text-[10px]">({brushWidth}px)</span>
 </button>

 {/* Desktop Rich Brush Studio Controls */}
 <div className="hidden sm:flex items-center space-x-1.5 ml-1 pl-1.5 border-l border-stone-200 dark:border-stone-700 overflow-x-auto no-scrollbar">
 {/* All Pens Dropdown */}
 {onChangeBrushStyle && (
 <select
 value={brushStyle || 'signpen'}
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

 {/* Studio Launch Button */}
 {onOpenPenPresetsModal && (
 <button
 onClick={onOpenPenPresetsModal}
 className="px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center space-x-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border-stone-300 dark:border-stone-700 shrink-0 active:scale-95 cursor-pointer"
 title="ペン作成・ブラシカスタマイズスタジオを開く"
 >
 <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
 <span>ペン作成・編集</span>
 </button>
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
 ? 'bg-emerald-700 text-white '
 : 'bg-emerald-600 text-white '
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
 ? 'bg-emerald-600 text-white border-emerald-600 '
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
 value={pressureSensitivity || 'normal'}
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

 {pressureSensitivity !== 'off' && isStylusActive && (
 <div
 className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-[10.5px] font-bold"
 title="Apple Pencil / スタイラスペン筆圧感知中"
 >
 <Activity className="w-2.5 h-2.5 text-emerald-600" />
 <span>筆圧: {liveStylusPressure != null ? `${liveStylusPressure}%` : '待機中'}</span>
 </div>
 )}
 </div>
 )}

 {/* Anti-Cutout */}
 <button
 onClick={() => {
 const next = !autoResolveBrushOverlap;
 setAutoResolveBrushOverlap(next);
 try { localStorage.setItem('fontforge_auto_resolve_brush_overlap', String(next)); } catch {}
 showCanvasToast(
 next
 ? '一筆書きの重なり白抜き防止をONにしました'
 : '白抜き防止をOFFにしました'
 );
 }}
 className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1 ${
 autoResolveBrushOverlap
 ? 'bg-amber-600 text-white border-amber-600 '
 : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-300 dark:border-stone-700'
 }`}
 title="一筆書きの線が交差・重なった部分が白く抜けるのを自動で防止・融解します"
 >
 <ShieldCheck className="w-3 h-3" />
 <span className="hidden sm:inline">白抜き防止:</span>
 <span>{autoResolveBrushOverlap ? 'ON' : 'OFF'}</span>
 </button>

 {/* Auto Union */}
 <button
 onClick={() => {
 const next = !autoUnionBrush;
 setAutoUnionBrush(next);
 try { localStorage.setItem('fontforge_auto_union_brush', String(next)); } catch {}
 showCanvasToast(
 next
 ? 'ストローク描画ごとの自動合体をONにしました'
 : '自動合体をOFFにしました（パスを個別に維持）'
 );
 }}
 className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1 ${
 autoUnionBrush
 ? 'bg-emerald-600 text-white border-emerald-600 '
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
 ? 'bg-sky-600 text-white border-sky-600 '
 : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-300 dark:border-stone-700'
 }`}
 title="定規のように真っ直ぐな線を描画 (Shiftキーを押しながらドラッグでも直線にロック可能)"
 >
 <Ruler className="w-3 h-3" />
 <span className="hidden sm:inline">定規直線:</span>
 <span>{brushStraightMode ? 'ON' : 'OFF'}</span>
 </button>

 {/* Auto Smooth */}
 <div className="flex items-center gap-1">
 <button
 onClick={() => {
 const next = !autoSmoothBrush;
 setAutoSmoothBrush(next);
 showCanvasToast(next ? '手ブレ補正・自動平滑化をONにしました' : '自動平滑化をOFFにしました');
 }}
 className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1 ${
 autoSmoothBrush
 ? 'bg-emerald-600 text-white border-emerald-600 '
 : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-300 dark:border-stone-700'
 }`}
 title="手書きストローク自動平滑化・手ブレ補正"
 >
 <Wand2 className="w-3 h-3" />
 <span className="hidden sm:inline">手ブレ補正:</span>
 <span>{autoSmoothBrush ? 'ON' : 'OFF'}</span>
 </button>

 {autoSmoothBrush && (
 <select
 value={smoothStrength}
 onChange={(e) => {
 const val = e.target.value as 'mild' | 'standard' | 'strong';
 setSmoothStrength(val);
 showCanvasToast(`手ブレ補正レベル: ${val === 'strong' ? '強 (なめらか)' : val === 'standard' ? '標準' : '弱 (そのまま)'}`);
 }}
 className={`text-[11px] font-bold px-1.5 py-1 rounded border transition-colors cursor-pointer outline-none ${
 isLight
 ? 'bg-stone-50 border-stone-300 text-stone-800 focus:border-emerald-600'
 : 'bg-[#18231c] border-[#25382c] text-emerald-200 focus:border-emerald-500'
 }`}
 title="手ブレ補正の強さを変更 (強にするとブレや手の揺れをしっかり平滑化して滑らかな曲線になります)"
 >
 <option value="strong">補正: 強 (なめらか)</option>
 <option value="standard">補正: 標準</option>
 <option value="mild">補正: 弱</option>
 </select>
 )}
 </div>

 {/* Straighten Wobbly Contour Action */}
 <button
 onClick={handleStraightenWobblySelected}
 className="px-2 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1 bg-amber-600 hover:bg-amber-700 text-white border-amber-600 "
 title="描いた線のうねり・ガタガタ歪みを自動でまっすぐ直線化補正します"
 >
 <Compass className="w-3 h-3" />
 <span className="hidden sm:inline">うねり直線補正</span>
 <span className="sm:hidden">直線補正</span>
 </button>
 </div>
 </>
 )}

 {/* Pen Tool options in Header */}
 {toolMode === 'pen' && (
 <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-stone-200 dark:border-stone-700 shrink-0">
 {/* Curve / Corner Toggle */}
 <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg border border-stone-200 dark:border-stone-700">
 <button
 onClick={() => setPenMode('bezier')}
 className={`px-1.5 py-0.5 rounded text-xs font-bold flex items-center space-x-1 transition-colors ${
 penMode === 'bezier'
 ? 'bg-emerald-700 text-white'
 : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
 }`}
 title="ベジェ曲線モード (滑らかな曲線を描画)"
 >
 <Spline className="w-3 h-3" />
 <span className="hidden xs:inline">曲線</span>
 </button>
 <button
 onClick={() => setPenMode('corner')}
 className={`px-1.5 py-0.5 rounded text-xs font-bold flex items-center space-x-1 transition-colors ${
 penMode === 'corner'
 ? 'bg-emerald-700 text-white'
 : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
 }`}
 title="折れ線モード (直線的な角を描画)"
 >
 <Square className="w-3 h-3" />
 <span className="hidden xs:inline">折線</span>
 </button>
 </div>

 {/* Pen Stroke Width Controls */}
 <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded-lg bg-stone-100/90 dark:bg-stone-800/90 border border-stone-200 dark:border-stone-700">
 <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 whitespace-nowrap hidden sm:inline">
 太さ:
 </span>

 {/* Stepper Down */}
 <button
 onClick={() => handleSetPenStrokeWidth(penStrokeWidth - (penStrokeWidth > 20 ? 5 : 2))}
 disabled={penStrokeWidth <= 2}
 className="w-5 h-5 rounded bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 font-bold text-xs flex items-center justify-center hover:bg-stone-200 dark:hover:bg-stone-600 disabled:opacity-30 transition-colors cursor-pointer"
 title="線の太さを減らす (-5px)"
 >
 -
 </button>

 {/* Input / display */}
 <div className="flex items-center">
 <input
 type="number"
 min={2}
 max={300}
 value={penStrokeWidth}
 onChange={(e) => {
 const val = parseInt(e.target.value, 10);
 if (!isNaN(val)) handleSetPenStrokeWidth(val);
 }}
 className="w-10 h-5 text-center text-xs font-mono font-bold bg-white dark:bg-stone-700 rounded border border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 focus:outline-emerald-500"
 />
 <span className="text-[9px] text-stone-400 font-mono ml-0.5">px</span>
 </div>

 {/* Stepper Up */}
 <button
 onClick={() => handleSetPenStrokeWidth(penStrokeWidth + (penStrokeWidth >= 20 ? 5 : 2))}
 disabled={penStrokeWidth >= 300}
 className="w-5 h-5 rounded bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 font-bold text-xs flex items-center justify-center hover:bg-stone-200 dark:hover:bg-stone-600 disabled:opacity-30 transition-colors cursor-pointer"
 title="線の太さを増やす (+5px)"
 >
 +
 </button>

 {/* Quick Preset Dropdown (replaces 5 wide buttons) */}
 <select
 value={[15, 30, 45, 60, 80].includes(penStrokeWidth) ? penStrokeWidth : ''}
 onChange={(e) => {
 const w = parseInt(e.target.value, 10);
 if (!isNaN(w)) handleSetPenStrokeWidth(w);
 }}
 className="text-[10px] font-mono font-bold px-1 py-0.5 bg-white dark:bg-stone-700 rounded border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 cursor-pointer outline-none ml-0.5"
 title="太さプリセット選択"
 >
 <option value="" disabled hidden>プリセット</option>
 {[15, 30, 45, 60, 80].map((w) => (
 <option key={w} value={w}>{w}px</option>
 ))}
 </select>

 {/* Single Cyclic Cap Style Toggle Button (Round -> Butt -> Square) */}
 <button
 onClick={() => {
 const next = penCapStyle === 'round' ? 'butt' : penCapStyle === 'butt' ? 'square' : 'round';
 handleSetPenCapStyle(next);
 }}
 className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800 hover:bg-sky-200 transition-colors cursor-pointer flex items-center gap-0.5"
 title={`端点の形状: 現在「${penCapStyle === 'round' ? '丸 (Round)' : penCapStyle === 'butt' ? '平 (Butt)' : '角 (Square)'}」（クリックで切替）`}
 >
 <span>端:</span>
 <span>{penCapStyle === 'round' ? '丸' : penCapStyle === 'butt' ? '平' : '角'}</span>
 </button>
 </div>

 {/* Studio Launch Icon Button */}
 {onOpenPenPresetsModal && (
 <button
 onClick={onOpenPenPresetsModal}
 className="p-1.5 rounded-lg text-xs font-bold flex items-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700 transition-colors cursor-pointer"
 title="ペン作成・ブラシカスタマイズスタジオを開く"
 >
 <Sliders className="w-3.5 h-3.5" />
 </button>
 )}
 </div>
 )}

 {/* Eraser Tool Options in Header */}
 {toolMode === 'eraser' && (
 <div className="flex items-center space-x-2 ml-1 pl-1.5 border-l border-stone-200 dark:border-stone-700">
 {/* Eraser Mode Buttons */}
 <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg border border-stone-300/80 dark:border-stone-700">
 <button
 onClick={() => setEraserMode('stroke')}
 className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
 eraserMode === 'stroke'
 ? 'bg-rose-600 text-white shadow-xs'
 : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
 }`}
 title="触れた線・パーツを消去 (標準消しゴム)"
 >
 消しゴム
 </button>
 <button
 onClick={() => setEraserMode('cut')}
 className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
 eraserMode === 'cut'
 ? 'bg-rose-600 text-white shadow-xs'
 : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
 }`}
 title="なぞった位置のパスを削り取り・分割"
 >
 部分削り
 </button>
 <button
 onClick={() => setEraserMode('node')}
 className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
 eraserMode === 'node'
 ? 'bg-rose-600 text-white shadow-xs'
 : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
 }`}
 title="消しゴム円内の頂点（アンカーポイント）のみ消去"
 >
 アンカー消去
 </button>
 </div>

 {/* Size Controls */}
 <div className="flex items-center space-x-0.5 bg-stone-100 dark:bg-stone-800 p-0.5 rounded border border-stone-300 dark:border-stone-700">
 <button
 onClick={() => {
 setEraserSize((prev) => Math.max(8, prev - 6));
 }}
 className="w-5 h-5 flex items-center justify-center font-bold text-xs rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 cursor-pointer"
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
 className="w-5 h-5 flex items-center justify-center font-bold text-xs rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 cursor-pointer"
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
 className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
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
 onClick={handleClearAll}
 className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white transition-colors flex items-center space-x-1 ml-1 cursor-pointer"
 title="この文字のすべての輪郭を一括消去 (Ctrl+Zで取り消し可能)"
 >
 <Trash2 className="w-3.5 h-3.5" />
 <span>文字を全クリア</span>
 </button>
 </div>
 )}

 {/* Ruler / Dimension Measurement Options in Header */}
 {toolMode === 'ruler' && (
 <div className="flex items-center space-x-2 ml-1 pl-1.5 border-l border-stone-200 dark:border-stone-700">
 <div className="flex items-center space-x-1.5 text-xs">
 <div className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-200 font-medium text-[11px]">
 <Ruler className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
 <span>定規・寸法計測</span>
 </div>

 {rulerMeasurement && !rulerMeasurement.active ? (
 <div className="flex items-center space-x-1.5">
 <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/60 text-sky-900 dark:text-sky-100 border border-sky-300 dark:border-sky-700">
 {Math.round(Math.hypot(rulerMeasurement.end.x - rulerMeasurement.start.x, rulerMeasurement.end.y - rulerMeasurement.start.y))}px
 </span>
 <span className="font-mono text-[10px] text-stone-500 dark:text-stone-400 hidden sm:inline">
 (ΔX: {Math.round(Math.abs(rulerMeasurement.end.x - rulerMeasurement.start.x))} / ΔY: {Math.round(Math.abs(rulerMeasurement.end.y - rulerMeasurement.start.y))})
 </span>

 <button
 onClick={handleConvertRulerToGuideline}
 className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-600 hover:bg-sky-700 text-white transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
 title="計測位置にガイド線を作成"
 >
 <span>ガイド線化</span>
 </button>

 <button
 onClick={handleDrawRulerAsStroke}
 className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
 title="計測ラインを直線ストロークとして作図 (Enter)"
 >
 <PenTool className="w-3 h-3" />
 <span>直線化 (Enter)</span>
 </button>

 <button
 onClick={() => setRulerMeasurement(null)}
 className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700 transition-colors cursor-pointer"
 title="計測表示を消去 (Esc)"
 >
 <X className="w-3 h-3" />
 </button>
 </div>
 ) : (
 <span className="text-[11px] text-stone-500 dark:text-stone-400 hidden sm:inline">
 キャンバス上の任意の2点をドラッグして距離・字幅を計測 (Shiftで水平/垂直固定)
 </span>
 )}
 </div>
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
 ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-300 font-bold'
 : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
 }`}
 title="小ドット表示"
 >
 形状優先
 </button>
 <button
 onClick={() => {
 setNodeStyle('selected_only');
 }}
 className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
 nodeStyle === 'selected_only'
 ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-300 font-bold'
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
 ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-300 font-bold'
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

 {/* Shape Tool modifier options in Header */}
 {isShapeTool && (
 <div className="flex items-center space-x-1.5 ml-1 pl-1.5 border-l border-stone-200 dark:border-stone-700">
 {/* Shape aspect ratio lock toggle */}
 <button
 type="button"
 onClick={() => {
 setIsShiftLockRatio((prev) => !prev);
 showCanvasToast(!isShiftLockRatio ? '正方形・正円比率に固定しました' : '自由比率に切り替えました');
 }}
 className={`px-2 py-1 rounded text-xs font-bold border transition-colors flex items-center space-x-1 cursor-pointer ${
 isShiftLockRatio
 ? 'bg-emerald-600 text-white border-emerald-600'
 : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700'
 }`}
 title="1:1 正方形・正円比率固定 (ドラッグ中Shiftキーでも可能)"
 >
 <span className="hidden sm:inline">比率:</span>
 <span>{isShiftLockRatio ? '正方形/正円固定' : '自由変形'}</span>
 </button>

 {/* Shape center draw toggle */}
 <button
 type="button"
 onClick={() => {
 setIsAltFromCenter((prev) => !prev);
 showCanvasToast(!isAltFromCenter ? '中心基準作図をONにしました' : '中心基準作図をOFFにしました');
 }}
 className={`hidden sm:flex px-2 py-1 rounded text-xs font-bold border transition-colors items-center space-x-1 cursor-pointer ${
 isAltFromCenter
 ? 'bg-emerald-600 text-white border-emerald-600'
 : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700'
 }`}
 title="中心から作図 (ドラッグ中Altキーでも可能)"
 >
 <span>中心基準:</span>
 <span>{isAltFromCenter ? 'ON' : 'OFF'}</span>
 </button>
 </div>
 )}
 </div>

 {/* Center: Selected Part Actions / Quick Transform Strip (Only in Select or Node tool modes) */}
 <div className="flex items-center space-x-1 shrink-0 overflow-x-auto no-scrollbar">
 {(toolMode === 'select' || toolMode === 'node') && selectedContourIds.length > 0 && (
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
 className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center space-x-1 transition-all active:scale-95 mr-1"
 title={
 selectedContourIds.length === 1
 ? '一筆書きの自己交差・ループによる重なり白抜きを自動解消'
 : '選択した複数のパスを合体し、重なり白抜きを解消'
 }
 >
 <Layers className="w-2.5 h-2.5" />
 <span>{selectedContourIds.length === 1 ? '重なり白抜き解消' : '合体・白抜き解消'}</span>
 </button>
 )}
 {selectedContourIds.length >= 2 && (
 <>
 <button
 onClick={handleSubtractSelectedContours}
 className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold flex items-center space-x-1 transition-all active:scale-95 mr-1"
 title="前面のパスで背面のパスを型抜き（差分）"
 >
 <span>型抜き</span>
 </button>
 <button
 onClick={handleIntersectSelectedContours}
 className="px-2 py-0.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold flex items-center space-x-1 transition-all active:scale-95 mr-1"
 title="重なった部分のみを抽出（交差）"
 >
 <span>交差</span>
 </button>
 </>
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
 onClick={handleExpandStrokeSelected}
 className="px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 text-[10px] font-bold hover:bg-sky-100 flex items-center space-x-0.5"
 title={`選択した線を太さ ${penStrokeWidth}px の輪郭に変換`}
 >
 <PenTool className="w-2.5 h-2.5" />
 <span>線輪郭化({penStrokeWidth}px)</span>
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
 </div>

 {/* Right: Japanese Guides & Nodes & Global Actions */}
 <div className="flex items-center space-x-1.5 shrink-0">
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
 className={`hidden lg:inline-flex px-1.5 py-1 rounded text-[11px] font-bold border transition-all ${
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
 className={`hidden lg:inline-flex px-1.5 py-1 rounded text-[11px] font-bold border transition-all ${
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

 {/* Outline-Only (Wireframe) Mode Toggle */}
 <button
 onClick={() => {
 const next = !isOutlineMode;
 setOutlineOnly(next);
 showCanvasToast(
 next
 ? '輪郭表示モードを有効にしました（パスの重なりや形状を透過確認）'
 : '塗りつぶし表示モードに戻しました'
 );
 }}
 className={`p-1.5 rounded border transition-colors flex items-center space-x-1 ${
 isOutlineMode
 ? isLight
 ? 'bg-sky-50 border-sky-400 text-sky-800 '
 : 'bg-sky-950 border-sky-600 text-sky-200 '
 : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
 }`}
 title={
 isOutlineMode
 ? '輪郭モードON（クリックで塗りつぶし表示に戻す）[Shift+O / Alt+O]'
 : '輪郭のみ表示（ワイヤーフレーム：パスの重なりや曲線の形を確認）[Shift+O / Alt+O]'
 }
 >
 {isOutlineMode ? (
 <Square className="w-3.5 h-3.5 stroke-[2.5] text-sky-500 fill-none" />
 ) : (
 <div className="w-3.5 h-3.5 rounded-xs border border-stone-500 bg-stone-700 dark:border-stone-400 dark:bg-stone-300" />
 )}
 <span className="text-[10px] hidden md:inline font-bold">
 {isOutlineMode ? '輪郭のみ' : '塗り表示'}
 </span>
 </button>

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

 {/* Collapse Subtoolbar button */}
 <button
 onClick={handleToggleSubToolbar}
 className="p-1.5 rounded hover:bg-stone-200 dark:hover:bg-[#202e24] text-stone-400 hover:text-stone-700 dark:hover:text-emerald-300 transition-colors ml-0.5"
 title="サブツールバーを折りたたむ (作図キャンバスを広く使う)"
 >
 <ChevronUp className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 ) : (
 /* Collapsed Floating Minimal Trigger (Zero layout height consumed) */
 !isMobileFocusMode && (
 <div
 className="absolute top-2 left-2 z-20 pointer-events-auto flex items-center space-x-1 bg-white/95 dark:bg-[#121c15]/95 px-2 py-1 rounded-full border border-stone-200/80 dark:border-emerald-800/60 text-xs select-none shadow-sm"
 onPointerDown={(e) => e.stopPropagation()}
 >
 {onSelectPrevGlyph && (
 <button
 onClick={onSelectPrevGlyph}
 className="p-0.5 rounded-full hover:bg-stone-200 dark:hover:bg-emerald-950 text-stone-600 dark:text-emerald-300"
 title="前の文字"
 >
 <ChevronLeft className="w-3.5 h-3.5" />
 </button>
 )}
 <span className="font-bold text-emerald-900 dark:text-emerald-200 px-1 font-sans">{activeChar}</span>
 {onSelectNextGlyph && (
 <button
 onClick={onSelectNextGlyph}
 className="p-0.5 rounded-full hover:bg-stone-200 dark:hover:bg-emerald-950 text-stone-600 dark:text-emerald-300"
 title="次の文字"
 >
 <ChevronRight className="w-3.5 h-3.5" />
 </button>
 )}
 <div className="w-[1px] h-3 bg-stone-300 dark:bg-emerald-800 mx-0.5" />
 <button
 onClick={handleToggleSubToolbar}
 className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-950 text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300 transition-colors"
 title="サブツールバーを展開"
 >
 <Sliders className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
 <span className="hidden xs:inline">詳細バー</span>
 <ChevronDown className="w-3 h-3" />
 </button>
 </div>
 )
 )}

 {/* Mobile Focus Mode Top Exit Bar */}
 {isMobileFocusMode && (
 <div className="sm:hidden absolute top-2 right-2 z-30 flex items-center space-x-1 bg-stone-900/90 px-2 py-1 rounded-full border border-white/20 shadow-lg text-white">
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
 className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-[10px] font-bold text-white "
 >
 <Minimize className="w-3.5 h-3.5" />
 <span>完了</span>
 </button>
 </div>
 )}

 <div
 ref={containerRef}
 className={`relative flex-1 h-full w-full overflow-hidden select-none touch-none transition-colors ${
 isLight ? 'bg-[#f0f4f1]' : 'bg-[#0c120e]'
 } ${isAnyModalOpen ? 'pointer-events-none' : ''}`}
 style={{
 touchAction: 'none',
 WebkitTouchCallout: 'none',
 WebkitUserSelect: 'none',
 userSelect: 'none',
 }}
 onAuxClick={(e) => {
 if (e.button === 1) {
 e.preventDefault();
 }
 }}
 >
 {/* Hand Tool Active Floating HUD Indicator (Compact & Unobtrusive) */}
 {(toolMode === 'hand' || isSpacePressed) && (
 <div
 className={`absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-30 px-2 py-0.5 rounded-md border flex items-center gap-1.5 text-[10.5px] font-semibold transition-all duration-150 pointer-events-none select-none max-w-fit ${
 isLight
 ? 'bg-white/95 border-emerald-300 text-emerald-900 shadow-sm'
 : 'bg-[#121c15]/95 border-emerald-700/60 text-emerald-200 shadow-sm'
 }`}
 >
 <div className="flex items-center gap-1 shrink-0 font-bold text-emerald-700 dark:text-emerald-300">
 <Hand className="w-3 h-3" />
 <span>手のひら</span>
 </div>
 <span className={`text-[9.5px] font-normal opacity-75 ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
 {isSpacePressed ? 'Space移動' : 'ドラッグ移動'}
 </span>
 </div>
 )}

 {/* Enhanced Trace Adjust Mode Active Floating HUD Bar */}
 {toolMode === 'trace_adjust' && (
 <div
 className={`absolute top-2 sm:top-2.5 left-1/2 -translate-x-1/2 z-30 px-2.5 sm:px-3.5 py-1.5 rounded-xl border shadow-lg flex items-center gap-2 text-xs font-medium transition-all duration-150 pointer-events-auto max-w-[96vw] overflow-x-auto no-scrollbar ${
 isLight
 ? 'bg-white/95 border-stone-200/90 text-stone-800 '
 : 'bg-[#141e17]/95 border-emerald-800/60 text-emerald-100 '
 }`}
 onPointerDown={(e) => e.stopPropagation()}
 >
 {/* Status & Icon */}
 <div className={`flex items-center space-x-1.5 font-bold shrink-0 ${isLight ? 'text-emerald-800' : 'text-emerald-400'}`}>
 <Move className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
 <span className="text-xs">下絵位置・サイズ調整</span>
 </div>

 <div className={`h-3.5 w-[1px] shrink-0 ${isLight ? 'bg-stone-200' : 'bg-[#25362b]'}`} />

 {/* Scale Step Buttons & Slider */}
 <div className="flex items-center space-x-1 shrink-0">
 <span className={`text-[10.5px] ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>サイズ:</span>
 <button
 onClick={() => {
 const cur = traceSettings.scale ?? 1;
 const next = Math.round(Math.max(0.2, cur - 0.05) * 100) / 100;
 onChangeTraceSettings({ ...traceSettings, scale: next });
 }}
 className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
 isLight ? 'bg-stone-100 hover:bg-stone-200 text-stone-700' : 'bg-[#1c2a20] hover:bg-[#25382b] text-emerald-200'
 }`}
 title="縮小 (-5%)"
 >
 <Minus className="w-2.5 h-2.5" />
 </button>
 <input
 type="range"
 min="0.3"
 max="2.0"
 step="0.01"
 value={traceSettings.scale ?? 1}
 onChange={(e) => {
 onChangeTraceSettings({
 ...traceSettings,
 scale: parseFloat(e.target.value),
 });
 }}
 className={`w-16 sm:w-20 cursor-pointer h-1 rounded-lg ${
 isLight ? 'bg-stone-200 accent-emerald-600' : 'bg-[#25362b] accent-emerald-500'
 }`}
 title="下絵サイズ（青枠ハンドルやホイールでも調整可能）"
 />
 <button
 onClick={() => {
 const cur = traceSettings.scale ?? 1;
 const next = Math.round(Math.min(3.0, cur + 0.05) * 100) / 100;
 onChangeTraceSettings({ ...traceSettings, scale: next });
 }}
 className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
 isLight ? 'bg-stone-100 hover:bg-stone-200 text-stone-700' : 'bg-[#1c2a20] hover:bg-[#25382b] text-emerald-200'
 }`}
 title="拡大 (+5%)"
 >
 <Plus className="w-2.5 h-2.5" />
 </button>
 <span className={`font-mono text-[11px] w-9 text-right font-bold ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>
 {Math.round((traceSettings.scale ?? 1) * 100)}%
 </span>
 </div>

 <div className={`h-3.5 w-[1px] shrink-0 ${isLight ? 'bg-stone-200' : 'bg-[#25362b]'}`} />

 {/* Quick Fit Size Presets */}
 <div className="flex items-center space-x-1 shrink-0">
 <button
 onClick={() => onChangeTraceSettings?.((prev) => ({ ...prev, scale: 0.78 }))}
 className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
 Math.abs((traceSettings.scale ?? 1) - 0.78) < 0.02
 ? 'bg-amber-600 text-white '
 : isLight
 ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
 : 'bg-[#1c2a20] hover:bg-[#25382b] text-amber-300'
 }`}
 title="仮名字面枠 (78%) にフィット"
 >
 仮名 78%
 </button>
 <button
 onClick={() => onChangeTraceSettings?.((prev) => ({ ...prev, scale: 0.85 }))}
 className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
 Math.abs((traceSettings.scale ?? 1) - 0.85) < 0.02
 ? 'bg-emerald-600 text-white '
 : isLight
 ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
 : 'bg-[#1c2a20] hover:bg-[#25382b] text-emerald-300'
 }`}
 title="漢字字面枠 (85%) にフィット"
 >
 漢字 85%
 </button>
 <button
 onClick={() => onChangeTraceSettings?.((prev) => ({ ...prev, scale: 1.0 }))}
 className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
 Math.abs((traceSettings.scale ?? 1) - 1.0) < 0.02
 ? 'bg-sky-600 text-white '
 : isLight
 ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
 : 'bg-[#1c2a20] hover:bg-[#25382b] text-sky-300'
 }`}
 title="標準 100% (仮想ボディ枠基準)"
 >
 100%
 </button>
 </div>

 {/* Font choice if text trace */}
 {traceSettings.type === 'char' && (
 <>
 <div className={`h-3.5 w-[1px] shrink-0 ${isLight ? 'bg-stone-200' : 'bg-[#25362b]'}`} />
 <div className="flex items-center space-x-1 shrink-0">
 <Type className="w-3 h-3 text-stone-400" />
 <select
 value={traceSettings.fontFamily || "'Noto Sans JP', sans-serif"}
 onChange={(e) =>
 onChangeTraceSettings?.((prev) => ({
 ...prev,
 fontFamily: e.target.value,
 }))
 }
 className={`text-[10px] rounded px-1.5 py-0.5 border focus:outline-none ${
 isLight
 ? 'bg-stone-100 text-stone-800 border-stone-300 focus:border-emerald-600'
 : 'bg-[#1c2a20] text-emerald-200 border-[#2b3e30] focus:border-emerald-500'
 }`}
 >
 <option value="'Noto Sans JP', sans-serif">ゴシック体</option>
 <option value="'Noto Serif JP', serif">明朝体</option>
 <option value="'Zen Maru Gothic', sans-serif">丸ゴシック</option>
 <option value="'Kaisei Tokumin', serif">特民明朝</option>
 </select>
 </div>
 </>
 )}

 <div className={`h-3.5 w-[1px] shrink-0 ${isLight ? 'bg-stone-200' : 'bg-[#25362b]'}`} />

 {/* Position Offset Status & Reset position & Exit Done Button */}
 <div className="flex items-center space-x-1.5 shrink-0">
 {/* Position Reset Button */}
 <button
 onClick={handleResetTracePosition}
 className={`px-2 py-1 rounded text-[10.5px] font-bold flex items-center space-x-1 transition-all border ${
 (traceSettings.offsetX !== 0 || traceSettings.offsetY !== 0)
 ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-600'
 : isLight
 ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
 : 'bg-[#1c2a20] hover:bg-[#25382b] text-emerald-200 border-[#2b3e30]'
 }`}
 title="下絵の位置を中央 (X:0, Y:0) にリセット (Rキーまたは下絵ダブルクリックでも可)"
 >
 <RotateCcw className="w-2.5 h-2.5" />
 <span>位置リセット</span>
 </button>

 {/* Reset All */}
 <button
 onClick={handleResetTraceAll}
 className={`px-1.5 py-1 rounded text-[10px] flex items-center space-x-0.5 transition-colors ${
 isLight ? 'text-stone-500 hover:bg-stone-200' : 'text-stone-400 hover:bg-[#25382b]'
 }`}
 title="位置とサイズを推奨初期値にリセット"
 >
 <span>全リセット</span>
 </button>

 <button
 onClick={() => {
 onSetToolMode?.('brush');
 showCanvasToast('下絵調整を完了しました');
 }}
 className={`px-2.5 py-1 rounded font-bold text-[10.5px] flex items-center space-x-1 transition-colors ${
 isLight
 ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
 : 'bg-emerald-600 hover:bg-emerald-500 text-white'
 }`}
 title="調整を完了して描画ツールに戻る"
 >
 <Check className="w-3 h-3" />
 <span>完了</span>
 </button>
 </div>
 </div>
 )}

 {/* Typography Guide Assist Card (Helps user understand which grid lines to follow, unobtrusive & collapsible) */}
 <div
 className="absolute top-12 sm:top-14 right-2 sm:right-4 z-20 pointer-events-auto select-none transition-all duration-200"
 onPointerDown={(e) => e.stopPropagation()}
 >
 {!showGuideAssist ? (
 <button
 onClick={() => handleToggleGuideAssist(true)}
 className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-[11px] sm:text-xs font-semibold transition-all hover:scale-105 active:scale-95 ${
 isLight
 ? 'bg-white/85 hover:bg-white border-emerald-200/90 text-emerald-800 '
 : 'bg-[#121c15]/85 hover:bg-[#121c15] border-emerald-800/60 text-emerald-300 '
 }`}
 title="フォント作図の基準線ガイド（凡例）を表示"
 >
 <HelpCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
 <span className="hidden xs:inline">ガイド凡例</span>
 </button>
 ) : (
 <div
 className={`w-[calc(100vw-24px)] sm:w-[380px] md:w-[400px] max-h-[calc(100vh-120px)] overflow-y-auto rounded-xl border p-3.5 sm:p-4 shadow-xl transition-all text-left ${
 isLight
 ? 'bg-white/95 border-emerald-200/90 text-stone-800 '
 : 'bg-[#101712]/95 border-emerald-800/70 text-emerald-100 '
 }`}
 >
 {/* Header */}
 <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-emerald-900/60 mb-2.5">
 <div className="flex items-center space-x-2 font-bold text-sm sm:text-base text-emerald-700 dark:text-emerald-300">
 <HelpCircle className="w-4 h-4 shrink-0" />
 <span>作図基準ガイド</span>
 <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
 {/[ぁ-んァ-ヶー]/.test(activeChar)
 ? '仮名'
 : /[\u4e00-\u9faf\u3400-\u4dbf]/.test(activeChar)
 ? '漢字'
 : '欧文'}
 </span>
 </div>
 <button
 onClick={() => handleToggleGuideAssist(false)}
 className="p-1 rounded-md hover:bg-stone-100 dark:hover:bg-emerald-950 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
 title="ガイドカードを閉じる"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 {/* Contextual Recommendation based on active character */}
 <div
 className={`p-2.5 sm:p-3 rounded-lg mb-3 text-xs sm:text-[13px] leading-relaxed text-left ${
 /[ぁ-んァ-ヶー]/.test(activeChar)
 ? isLight
 ? 'bg-amber-50 text-amber-900 border border-amber-200'
 : 'bg-amber-950/40 text-amber-200 border border-amber-800/60'
 : /[\u4e00-\u9faf\u3400-\u4dbf]/.test(activeChar)
 ? isLight
 ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
 : 'bg-emerald-950/40 text-emerald-200 border border-emerald-800/60'
 : isLight
 ? 'bg-sky-50 text-sky-900 border border-sky-200'
 : 'bg-sky-950/40 text-sky-200 border border-sky-800/60'
 }`}
 >
 {/[ぁ-んァ-ヶー]/.test(activeChar) ? (
 <>
 <div className="font-bold text-xs sm:text-sm text-amber-800 dark:text-amber-300 mb-1">
 現在の文字: 「{activeChar}」（和文仮名）
 </div>
 <div>
 オレンジ色の<strong>仮名字面枠 (78%)</strong>の内側に収まるよう作図します。欧文底線（赤線）ではなく、<strong>マスの中央</strong>を基準として配置してください。
 </div>
 </>
 ) : /[\u4e00-\u9faf\u3400-\u4dbf]/.test(activeChar) ? (
 <>
 <div className="font-bold text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 mb-1">
 現在の文字: 「{activeChar}」（漢字）
 </div>
 <div>
 緑色の<strong>漢字字面枠 (85%)</strong>の内側に収まるよう作図します。外枠（1000UPM）いっぱいまで描かず周囲に余白を残すことで、組版時の字間バランスが保たれます。
 </div>
 </>
 ) : (
 <>
 <div className="font-bold text-xs sm:text-sm text-sky-800 dark:text-sky-300 mb-1">
 現在の文字: 「{activeChar}」（欧文 / 記号）
 </div>
 <div>
 赤色の<strong>Baseline (底線)</strong>の上に文字の底部を揃えて作図します。大文字はCap Height、小文字はx-Heightを目安にしてください。
 </div>
 </>
 )}
 </div>

 {/* Line Legend */}
 <div className="space-y-2 text-xs sm:text-[13px] text-left">
 <div className="flex items-center justify-between">
 <span className="flex items-center space-x-2">
 <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
 <span className="font-medium">仮名字面枠 (78%)</span>
 </span>
 <span className="text-stone-500 dark:text-stone-400 text-xs">かな用</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="flex items-center space-x-2">
 <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
 <span className="font-medium">漢字字面枠 (85%)</span>
 </span>
 <span className="text-stone-500 dark:text-stone-400 text-xs">漢字推奨</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="flex items-center space-x-2">
 <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
 <span className="font-medium">Baseline (赤底線)</span>
 </span>
 <span className="text-stone-500 dark:text-stone-400 text-xs">欧文(A-Z)整列</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="flex items-center space-x-2">
 <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0" />
 <span className="font-medium">中心十字格 (田字格)</span>
 </span>
 <span className="text-stone-500 dark:text-stone-400 text-xs">重心バランス</span>
 </div>
 </div>

 {/* Direct Tool Switch Button */}
 <div className="mt-3 pt-2.5 border-t border-stone-200 dark:border-emerald-900/60 flex items-center justify-between text-xs">
 <span className="text-xs text-stone-500 dark:text-stone-400">下絵位置:</span>
 <div className="flex items-center gap-1.5">
 {(traceSettings.offsetX !== 0 || traceSettings.offsetY !== 0) && (
 <button
 onClick={handleResetTracePosition}
 className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center space-x-1 transition-colors "
 title="下絵の位置を中央(0, 0)にリセット"
 >
 <RotateCcw className="w-3 h-3" />
 <span>位置リセット</span>
 </button>
 )}
 <button
 onClick={() => {
 onSetToolMode?.('trace_adjust');
 onChangeTraceSettings?.((prev) => ({ ...prev, enabled: true }));
 showCanvasToast('下絵調整モードに切り替えました');
 }}
 className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1 transition-colors "
 >
 <Move className="w-3.5 h-3.5" />
 <span>下絵の位置調整</span>
 </button>
 </div>
 </div>
 </div>
 )}
 </div>

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
 className={`px-2 py-1 rounded-full border shadow-xl flex items-center space-x-1.5 text-xs whitespace-nowrap ${
 isLight
 ? 'bg-white/98 border-emerald-300/80 text-stone-800'
 : 'bg-[#121c15]/98 border-emerald-700/60 text-emerald-100'
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
 <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 font-bold font-mono text-[11px] shrink-0 whitespace-nowrap">
 <PenTool className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
 <span>{activePenContour.nodes.length}点</span>
 </div>

 <div className="h-3.5 w-[1px] bg-stone-200 dark:bg-emerald-800/80 shrink-0" />

 {/* Undo Last Point */}
 <button
 onClick={handleUndoPenNode}
 className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center space-x-1 transition-all active:scale-95 whitespace-nowrap ${
 isLight
 ? 'bg-stone-100 hover:bg-emerald-100 text-stone-700 hover:text-emerald-900'
 : 'bg-[#1e2d23] hover:bg-[#283d30] text-emerald-200'
 }`}
 title="直前の頂点を取り消す (Backspace / ⌫ または Ctrl+Z)"
 >
 <RotateCcw className="w-3 h-3 text-stone-500 dark:text-stone-300 shrink-0" />
 <span>1点戻す</span>
 <span className="text-[9px] opacity-60 font-mono hidden sm:inline">⌫</span>
 </button>

 {/* Finalize as open path / stroke with configurable line thickness */}
 <div className="relative flex items-center">
 <button
 onClick={() => handleFinishPenContour(false)}
 disabled={activePenContour.nodes.length < 2}
 className={`px-2 py-0.5 rounded-l-full text-[11px] font-semibold flex items-center space-x-1 transition-all disabled:opacity-30 active:scale-95 whitespace-nowrap ${
 isLight
 ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-r border-sky-200'
 : 'bg-sky-950/70 hover:bg-sky-900/80 text-sky-200 border-r border-sky-800'
 }`}
 title={`開いた線を太さ ${penStrokeWidth}px (${penCapStyle === 'round' ? '丸端' : penCapStyle === 'butt' ? '平端' : '角端'}) で確定する (Enter / ↵)`}
 >
 <CornerDownLeft className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
 <span>線で確定</span>
 <span className="text-[9px] opacity-60 font-mono hidden sm:inline">↵</span>
 </button>

 {/* Stroke width quick trigger / badge button */}
 <button
 type="button"
 onClick={() => setShowPenStrokeMenu((prev) => !prev)}
 className={`px-1.5 py-0.5 rounded-r-full text-[10px] font-mono font-bold flex items-center space-x-0.5 transition-all active:scale-95 ${
 isLight
 ? 'bg-sky-100 hover:bg-sky-200 text-sky-900'
 : 'bg-sky-900/90 hover:bg-sky-800 text-sky-100'
 }`}
 title="線の太さ・端点形状を変更"
 >
 <span>{penStrokeWidth}px</span>
 <ChevronDown className="w-2.5 h-2.5 opacity-70" />
 </button>

 {/* Pen Stroke Quick Settings Floating Popover Menu */}
 {showPenStrokeMenu && (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent pointer-events-auto"
 onClick={() => setShowPenStrokeMenu(false)}
 >
 <div
 className={`p-3 rounded-2xl shadow-2xl border flex flex-col space-y-2.5 min-w-[240px] text-xs pointer-events-auto animate-in fade-in zoom-in-95 duration-100 ${
 isLight
 ? 'bg-white border-sky-200 text-stone-800'
 : 'bg-[#0f1b14] border-sky-800/80 text-sky-100'
 }`}
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center justify-between pb-1.5 border-b border-stone-200 dark:border-stone-800">
 <span className="font-bold flex items-center space-x-1.5 text-sky-700 dark:text-sky-300">
 <PenTool className="w-3.5 h-3.5" />
 <span>線の太さ設定</span>
 </span>
 <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 text-xs">
 {penStrokeWidth} px
 </span>
 </div>

 {/* Stepper + Slider */}
 <div className="flex items-center space-x-2">
 <button
 onClick={() => handleSetPenStrokeWidth(penStrokeWidth - (penStrokeWidth > 20 ? 5 : 2))}
 disabled={penStrokeWidth <= 2}
 className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 font-bold text-sm flex items-center justify-center disabled:opacity-30 cursor-pointer"
 >
 -
 </button>
 <input
 type="range"
 min={4}
 max={160}
 step={2}
 value={penStrokeWidth}
 onChange={(e) => handleSetPenStrokeWidth(parseInt(e.target.value, 10))}
 className="flex-1 h-2 accent-sky-600 dark:accent-sky-500 cursor-pointer"
 />
 <button
 onClick={() => handleSetPenStrokeWidth(penStrokeWidth + (penStrokeWidth >= 20 ? 5 : 2))}
 disabled={penStrokeWidth >= 300}
 className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 font-bold text-sm flex items-center justify-center disabled:opacity-30 cursor-pointer"
 >
 +
 </button>
 </div>

 {/* Presets Grid */}
 <div>
 <span className="text-[10px] text-stone-500 dark:text-stone-400 mb-1 block">クイック太さ:</span>
 <div className="grid grid-cols-5 gap-1 font-mono text-[11px]">
 {[15, 25, 40, 60, 80].map((w) => (
 <button
 key={w}
 onClick={() => {
 handleSetPenStrokeWidth(w);
 }}
 className={`py-1 rounded text-center transition-all cursor-pointer ${
 penStrokeWidth === w
 ? 'bg-sky-600 text-white font-bold ring-1 ring-sky-400'
 : 'bg-stone-100 dark:bg-stone-800/80 hover:bg-sky-100 dark:hover:bg-sky-950 text-stone-700 dark:text-stone-300'
 }`}
 >
 {w}
 </button>
 ))}
 </div>
 </div>

 {/* Cap Style */}
 <div>
 <span className="text-[10px] text-stone-500 dark:text-stone-400 mb-1 block">端点の形状:</span>
 <div className="grid grid-cols-3 gap-1 text-[11px]">
 {[
 { id: 'round', label: '丸 (Round)' },
 { id: 'butt', label: '平 (Butt)' },
 { id: 'square', label: '角 (Square)' },
 ].map((cap) => (
 <button
 key={cap.id}
 onClick={() => handleSetPenCapStyle(cap.id as 'round' | 'butt' | 'square')}
 className={`py-1 rounded text-center transition-all cursor-pointer ${
 penCapStyle === cap.id
 ? 'bg-sky-600 text-white font-bold'
 : 'bg-stone-100 dark:bg-stone-800/80 hover:bg-sky-100 dark:hover:bg-sky-950 text-stone-700 dark:text-stone-300'
 }`}
 >
 {cap.label}
 </button>
 ))}
 </div>
 </div>

 {/* Action button inside popover */}
 <button
 onClick={() => {
 setShowPenStrokeMenu(false);
 handleFinishPenContour(false);
 }}
 disabled={activePenContour.nodes.length < 2}
 className="mt-1 w-full py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-30 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md active:scale-98 transition-all cursor-pointer"
 >
 <CornerDownLeft className="w-3.5 h-3.5" />
 <span>この太さ ({penStrokeWidth}px) で線確定</span>
 </button>
 </div>
 </div>
 )}
 </div>

 {/* Finalize as closed path */}
 <button
 onClick={() => handleFinishPenContour(true)}
 disabled={activePenContour.nodes.length < 3}
 className="px-2.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center space-x-1 transition-all disabled:opacity-30 active:scale-95 whitespace-nowrap"
 title="パスを閉じて輪郭として確定する (C または 始点をクリック)"
 >
 <Check className="w-3 h-3 shrink-0" />
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

 {/* SVG Canvas Stage */}
 <svg
 className="w-full h-full touch-none select-none"
 style={{
 touchAction: 'none',
 WebkitTouchCallout: 'none',
 WebkitUserSelect: 'none',
 userSelect: 'none',
 cursor: getCanvasCursor(),
 }}
 onPointerDown={handlePointerDown}
 onPointerMove={handlePointerMove}
 onPointerUp={handlePointerUp}
 onPointerCancel={handlePointerCancel}
 onPointerLeave={handlePointerLeave}
 onLostPointerCapture={handleLostPointerCapture}
 onDoubleClick={(e) => {
 if (isAnyModalOpen) return;
 const clickPos = screenToCanvas(e.clientX, e.clientY);
 const hitContour = contours.find((c) => isPointNearContour(clickPos, c, 24 / zoom));
 if (hitContour) {
 if (onSetToolMode) {
 onSetToolMode('node');
 }
 setSelectedContourId(hitContour.id);
 setSelectedContourIds([hitContour.id]);
 setSelectedNodeId(null);
 setSelectedHandleType(null);
 showCanvasToast('ノード編集モードに切り替えました', 'アンカーポイントとハンドルを直接編集できます');
 }
 }}
 >
 <g
 ref={canvasGroupRef}
 transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
 >
 {/* 1. Base Canvas Background & Grid */}
 <CanvasBackgroundLayer
 isLight={isLight}
 theme={theme}
 showGrid={!!gridSettings.showGrid}
 gridSize={gridSettings.gridSize || 50}
 gridOpacity={gridSettings.gridOpacity ?? 30}
 unitsPerEm={upm}
 />

 {/* 2. Japanese Calligraphy / Layout Guides (Cross, Tian, Jiugong, Sixteen, Mi, Vertical Guides, BodyFrame, KanaFrame) */}
 <JapaneseGuidesLayer
 guideType={gridSettings.japaneseGuide}
 verticalGuide={gridSettings.verticalGuide}
 showBodyFrame={gridSettings.showBodyFrame}
 showKanaFrame={gridSettings.showKanaFrame}
 isLight={isLight}
 theme={theme}
 activeChar={activeChar}
 gridOpacity={gridSettings.gridOpacity ?? 30}
 unitsPerEm={upm}
 />

 {/* 3. Adjacent Character Context Boxes */}
 <AdjacentGlyphsLayer
 isLight={isLight}
 advanceWidth={advanceWidth}
 unitsPerEm={upm}
 />

 {/* 3.5 Glyph Overlay Comparison Layer */}
 <GlyphComparisonLayer
 overlaySettings={overlaySettings}
 project={project}
 isLight={isLight}
 activeChar={activeChar}
 activeUnicode={selectedUnicode}
 unitsPerEm={upm}
 />

 {/* 4. Trace Reference Image / Char Template Layer */}
 <TraceReferenceLayer
 traceSettings={traceSettings}
 isLight={isLight}
 activeChar={activeChar}
 selectedUnicode={selectedUnicode != null ? String(selectedUnicode) : undefined}
 toolMode={toolMode}
 unitsPerEm={upm}
 onPointerDownImage={handlePointerDownTraceImage}
 onPointerDownResize={handlePointerDownTraceResize}
 onDoubleClickReset={handleResetTracePosition}
 isResizing={isResizingTrace}
 />

 {/* 5. Top & Left Ruler Scales */}
 <CanvasRulersLayer
 showRulers={gridSettings.showRulers !== false}
 isLight={isLight}
 hoverPos={hoverCanvasPos}
 unitsPerEm={upm}
 />

 {/* 6. Typography Metrics Guidelines (LSB, RSB, Center X=500, Baseline, Ascender, etc.) */}
 <MetricsGuidesLayer
 showMetrics={!!gridSettings.showMetrics}
 lsb={lsb}
 advanceWidth={advanceWidth}
 activeChar={activeChar}
 isLight={isLight}
 showVerticalCenter={gridSettings.showVerticalCenter !== false}
 gridOpacity={gridSettings.gridOpacity ?? 30}
 unitsPerEm={upm}
 />

 {/* 7. User Custom Guidelines */}
 <CustomGuidelinesLayer
 customGuidelines={customGuidelines}
 zoom={zoom}
 unitsPerEm={upm}
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
 {toolMode === 'ruler' && gridSettings.showRulers !== false && Boolean(rulerMeasurement) && (
 <RulerMeasurementLayer
 rulerMeasurement={rulerMeasurement}
 zoom={zoom}
 onDrawLine={handleDrawRulerAsStroke}
 onConvertToGuide={handleConvertRulerToGuideline}
 onClear={() => setRulerMeasurement(null)}
 />
 )}

 {/* 9. Main Glyph Vector Contours */}
 <MainGlyphContoursLayer
 contours={contours}
 mainSvgPath={mainSvgPath}
 isLight={isLight}
 theme={theme}
 outlineOnly={isOutlineMode}
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
 stroke={isSelected ? selectionColor : 'transparent'}
 strokeWidth={isSelected ? Math.max(2, 2.5 / zoom) : Math.max(14, 18 / zoom)}
 strokeDasharray={isSelected ? '6 4' : undefined}
 className={toolMode === 'select' || toolMode === 'node' ? 'cursor-pointer' : 'pointer-events-none'}
 pointerEvents={toolMode === 'select' || toolMode === 'node' ? 'stroke fill' : 'none'}
 onPointerDown={(e) => {
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
 const nextIds =
 selectedContourIds.includes(contour.id) && selectedContourIds.length > 1
 ? selectedContourIds
 : [contour.id];
 setSelectedContourIds(nextIds);
 setSelectedContourId(contour.id);
 handleTransformPointerDown(e, 'move', nextIds);
 }
 setSelectedNodeId(null);
 setSelectedHandleType(null);
 }
 }}
 onDoubleClick={(e) => {
 e.stopPropagation();
 if (onSetToolMode) {
 onSetToolMode('node');
 }
 setSelectedContourId(contour.id);
 setSelectedContourIds([contour.id]);
 setSelectedNodeId(null);
 setSelectedHandleType(null);
 showCanvasToast('ノード編集モードに切り替えました', 'アンカーポイントとハンドルを直接編集できます');
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
 stroke={selectionColor}
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
 d={activeBrushSvgDRef.current || ''}
 fill={isOutlineMode ? 'none' : inkFillColor}
 stroke={isOutlineMode ? (isLight ? '#0284c7' : '#38bdf8') : inkStrokeColor}
 strokeWidth={1.5}
 vectorEffect={isOutlineMode ? 'non-scaling-stroke' : undefined}
 fillRule="nonzero"
 pointerEvents="none"
 />

 {/* Active Cut Eraser Stroke in-progress */}
 <path
 ref={activeEraserPathRef}
 d=""
 fill="none"
 stroke="#f43f5e"
 strokeWidth={Math.max(8, eraserSize)}
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeOpacity={0.65}
 pointerEvents="none"
 />

 {/* Active Shape in-progress */}
 {isShapeTool && shapeStartPoint && shapeCurrentPoint && (
 <path
 d={contoursToSvgPath(
 getShapeContoursFromPoints(toolMode, shapeStartPoint, shapeCurrentPoint)
 )}
 fill={isOutlineMode ? 'none' : '#f59e0b'}
 fillOpacity={isOutlineMode ? 0 : 0.35}
 stroke="#f59e0b"
 strokeWidth={2}
 vectorEffect={isOutlineMode ? 'non-scaling-stroke' : undefined}
 fillRule="nonzero"
 pointerEvents="none"
 />
 )}

 {/* Selected Contour Highlight & Interactive Bounding Box Transform UI (Only in Select or Node tool modes) */}
 {(toolMode === 'select' || toolMode === 'node') && selectedContourIds.length > 0 && selContoursBBox && (
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
 stroke={selectionColor}
 strokeWidth={2.5 / zoom}
 strokeDasharray="6 4"
 pointerEvents="none"
 />
 )}

 {/* Bounding Box Border & Drag-to-Move Stroke */}
 <rect
 x={bx}
 y={by}
 width={bw}
 height={bh}
 fill="none"
 stroke={selectionColor}
 strokeWidth={1 / zoom}
 strokeDasharray="4 2"
 className="cursor-move"
 pointerEvents="stroke"
 onPointerDown={(e) => handleTransformPointerDown(e, 'move')}
 />

 {/* Floating Selection Quick Actions Toolbar */}
 <foreignObject
 x={cx - 125 / zoom}
 y={by - rotStemDist - 38 / zoom < 10 ? by + bh + 12 / zoom : by - rotStemDist - 38 / zoom}
 width={250 / zoom}
 height={38 / zoom}
 className="overflow-visible pointer-events-auto select-none z-50"
 >
 <div
 style={{ transform: `scale(${Math.max(0.6, Math.min(1.0, 1 / zoom))})`, transformOrigin: 'top center' }}
 className="flex items-center justify-center space-x-1 px-2.5 py-1 bg-stone-900/95 dark:bg-[#101b13]/95 text-white rounded-full shadow-lg border border-emerald-500/40 text-xs font-sans pointer-events-auto"
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
 <Layers className="w-3.5 h-3.5 text-white" />
 </button>
 )}
 <button
 onClick={(e) => { e.stopPropagation(); handleDeleteSelected(); }}
 className="p-1.5 rounded-full hover:bg-rose-800/90 text-rose-300 transition-colors ml-0.5"
 title="削除 (Delete)"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 <div className="w-px h-3.5 bg-emerald-500/30 my-auto" />
 <button
 onClick={(e) => {
 e.stopPropagation();
 setSelectedContourIds([]);
 setSelectedNodeId(null);
 setSelectedHandleType(null);
 }}
 className="p-1.5 rounded-full hover:bg-stone-700/90 text-stone-300 hover:text-white transition-colors"
 title="選択解除 (Deselect / Esc)"
 >
 <X className="w-3.5 h-3.5" />
 </button>
 </div>
 </foreignObject>

 {/* Center Anchor Crosshair */}
 <g
 className="cursor-move group"
 onPointerDown={(e) => handleTransformPointerDown(e, 'move')}
 >
 <circle cx={cx} cy={cy} r={4 / zoom} fill={selectionColor} stroke="#ffffff" strokeWidth={1 / zoom} />
 <line x1={cx - 5 / zoom} y1={cy} x2={cx + 5 / zoom} y2={cy} stroke={selectionColor} strokeWidth={1 / zoom} />
 <line x1={cx} y1={cy - 5 / zoom} x2={cx} y2={cy + 5 / zoom} stroke={selectionColor} strokeWidth={1 / zoom} />
 </g>

 {/* Rotation Connector Stem Line */}
 <line
 x1={cx}
 y1={by}
 x2={cx}
 y2={by - rotStemDist}
 stroke={selectionColor}
 strokeWidth={1.5 / zoom}
 strokeDasharray="3 2"
 pointerEvents="none"
 />

 {/* Rotation Grip Handle (Top-Center) */}
 <g
 className="cursor-grab active:cursor-grabbing"
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
 fill={selectionColor}
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
 stroke={selectionColor}
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
 stroke={selectionColor}
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
 stroke={selectionColor}
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
 stroke={selectionColor}
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
 stroke={selectionColor}
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
 stroke={selectionColor}
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
 stroke={selectionColor}
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
 stroke={selectionColor}
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
 {rotateDisplayAngle !== null ? ` ∡${rotateDisplayAngle}°` : ''}
 </text>
 </g>
 </g>
 );
 })()
 )}

 {/* ---------------- BEZIER NODES & CONTROL HANDLES ---------------- */}
 {showNodes && (
 toolMode === 'select' ||
 toolMode === 'node' ||
 toolMode === 'pen' ||
 (toolMode === 'eraser' && eraserMode === 'node') ||
 gridSettings.showPoints
 ) && (
 <g className="bezier-controls select-none">
 {/* When in Anchor Point Eraser Mode, render high-contrast path trajectory guide lines connecting all nodes */}
 {toolMode === 'eraser' && eraserMode === 'node' && (
 <g className="eraser-path-trajectory-guides pointer-events-none">
 {contours.map((contour) => {
 const pathD = contourSvgMap.get(contour.id) || contoursToSvgPath([contour]);
 return (
 <path
 key={`eraser-guide-contour-${contour.id}`}
 d={pathD}
 fill="none"
 stroke="#0ea5e9"
 strokeWidth={1.5}
 strokeDasharray="4 2"
 vectorEffect="non-scaling-stroke"
 className="opacity-80"
 />
 );
 })}
 </g>
 )}

 {contours.map((contour) => {
 const isContourActive = contour.id === selectedContourId;
 const isEraserNodeMode = toolMode === 'eraser' && eraserMode === 'node';

 // When in selected_only style, skip unselected contours entirely (unless in eraser node mode where all nodes must be visible for deletion)
 if (nodeStyle === 'selected_only' && !isContourActive && !isEraserNodeMode) {
 return null;
 }

 // For inactive contours, if not in node mode or eraser node mode and showPoints is false, don't overwhelm screen
 if (!isContourActive && toolMode !== 'node' && !isEraserNodeMode && !gridSettings.showPoints) {
 return null;
 }

 const isNodeInteractive = toolMode === 'select' || toolMode === 'node';
 const isHandleInteractive = toolMode === 'select' || toolMode === 'node' || toolMode === 'pen';

 return (
 <g key={contour.id}>
 {contour.nodes.map((node) => {
 const isSelected = selectedNodeId === node.id;

 // In Anchor Eraser Mode: Check if node falls inside the eraser sweep circle
 const isInsideEraser =
 isEraserNodeMode &&
 hoverCanvasPos &&
 Math.hypot(node.x - hoverCanvasPos.x, node.y - hoverCanvasPos.y) <= Math.max(2, eraserSize / 2);

 if (isEraserNodeMode) {
 const eraseDotRadius = isInsideEraser ? 6.5 / zoom : 3.8 / zoom;
 return (
 <g key={`eraser-node-${node.id}`}>
 {/* Targeted deletion ring when inside eraser sweep area */}
 {isInsideEraser && (
 <>
 <circle
 cx={node.x}
 cy={node.y}
 r={11 / zoom}
 fill="rgba(244, 63, 94, 0.25)"
 stroke="#f43f5e"
 strokeWidth={2 / zoom}
 strokeDasharray={`${4 / zoom} ${2 / zoom}`}
 />
 {/* High-contrast deletion indicator */}
 <line
 x1={node.x - 4 / zoom}
 y1={node.y - 4 / zoom}
 x2={node.x + 4 / zoom}
 y2={node.y + 4 / zoom}
 stroke="#ffffff"
 strokeWidth={2 / zoom}
 strokeLinecap="round"
 />
 <line
 x1={node.x + 4 / zoom}
 y1={node.y - 4 / zoom}
 x2={node.x - 4 / zoom}
 y2={node.y + 4 / zoom}
 stroke="#ffffff"
 strokeWidth={2 / zoom}
 strokeLinecap="round"
 />
 <line
 x1={node.x - 4 / zoom}
 y1={node.y - 4 / zoom}
 x2={node.x + 4 / zoom}
 y2={node.y + 4 / zoom}
 stroke="#e11d48"
 strokeWidth={1.2 / zoom}
 strokeLinecap="round"
 />
 <line
 x1={node.x + 4 / zoom}
 y1={node.y - 4 / zoom}
 x2={node.x - 4 / zoom}
 y2={node.y + 4 / zoom}
 stroke="#e11d48"
 strokeWidth={1.2 / zoom}
 strokeLinecap="round"
 />
 </>
 )}
 {/* Anchor point dot */}
 <circle
 cx={node.x}
 cy={node.y}
 r={eraseDotRadius}
 fill={isInsideEraser ? '#e11d48' : '#0284c7'}
 stroke="#ffffff"
 strokeWidth={1.5 / zoom}
 className="pointer-events-none"
 />
 </g>
 );
 }

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
 className={isNodeInteractive ? 'cursor-pointer' : 'pointer-events-none'}
 pointerEvents={isNodeInteractive ? 'all' : 'none'}
 onPointerDown={(e) => {
 if (!isNodeInteractive) return;
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
 className={isHandleInteractive ? 'cursor-move' : 'pointer-events-none'}
 pointerEvents={isHandleInteractive ? 'all' : 'none'}
 onPointerDown={(e) => {
 if (!isHandleInteractive) return;
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
 className={isHandleInteractive ? 'cursor-move' : 'pointer-events-none'}
 pointerEvents={isHandleInteractive ? 'all' : 'none'}
 onPointerDown={(e) => {
 if (!isHandleInteractive) return;
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
 className={isNodeInteractive ? 'cursor-pointer' : 'pointer-events-none'}
 pointerEvents={isNodeInteractive ? 'all' : 'none'}
 onPointerDown={(e) => {
 if (!isNodeInteractive) return;
 e.stopPropagation();
 setSelectedContourId(contour.id);
 setSelectedNodeId(node.id);
 setSelectedHandleType('node');
 }}
 onDoubleClick={(e) => {
 if (!isNodeInteractive) return;
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
 {/* Translucent stroke width preview envelope */}
 <path
 d={penSvgPath}
 fill="none"
 stroke="#0284c7"
 strokeOpacity={0.25}
 strokeWidth={penStrokeWidth}
 strokeLinecap={penCapStyle}
 strokeLinejoin={penCapStyle === 'round' ? 'round' : 'miter'}
 />
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
 stroke={isNearStart ? selectionColor : '#0ea5e9'}
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
 <circle r={14 / zoom} fill={selectionColor} fillOpacity={0.2} />
 <circle r={10 / zoom} fill={selectionColor} stroke="#ffffff" strokeWidth={2.5 / zoom} />
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
 fill={isFirst ? selectionColor : isLast ? '#f59e0b' : '#0284c7'}
 />
 {/* First node indicator letter */}
 {isFirst && (
 <text
 x={node.x}
 y={node.y - 10 / zoom}
 fill={selectionColor}
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
 stroke={selectionColor}
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
 fill={selectionColor}
 />
 </g>
 )}

 {/* ---------------- HARDWARE-ACCELERATED ERASER RETICLE (0ms DIRECT GPU DOM TRACKING) ---------------- */}
 {toolMode === 'eraser' && (
 <g
 ref={eraserReticleRef}
 id="live-eraser-reticle"
 className="eraser-sweep-reticle pointer-events-none select-none"
 style={{ display: 'none' }}
 >
 {eraserMode === 'node' ? (
 /* Specialized Anchor Point Eraser (アンカー点消去) Pointer */
 <g className="anchor-eraser-pointer">
 {/* Outer glow & deletion boundary circle */}
 <circle
 cx={0}
 cy={0}
 r={eraserSize / 2}
 fill="rgba(244, 63, 94, 0.12)"
 stroke="#ffffff"
 strokeWidth={3 / zoom}
 />
 {/* Inner high-contrast dashed ring */}
 <circle
 cx={0}
 cy={0}
 r={eraserSize / 2}
 fill="none"
 stroke="#e11d48"
 strokeWidth={1.8 / zoom}
 strokeDasharray={`${5 / zoom} ${3 / zoom}`}
 />

 {/* High-contrast precision crosshair lines */}
 {/* Horizontal white backing */}
 <line
 x1={-eraserSize / 2 - 6 / zoom}
 y1={0}
 x2={eraserSize / 2 + 6 / zoom}
 y2={0}
 stroke="#ffffff"
 strokeWidth={2.8 / zoom}
 strokeLinecap="round"
 />
 {/* Horizontal rose crosshair */}
 <line
 x1={-eraserSize / 2 - 6 / zoom}
 y1={0}
 x2={eraserSize / 2 + 6 / zoom}
 y2={0}
 stroke="#e11d48"
 strokeWidth={1.4 / zoom}
 strokeLinecap="round"
 />
 {/* Vertical white backing */}
 <line
 x1={0}
 y1={-eraserSize / 2 - 6 / zoom}
 x2={0}
 y2={eraserSize / 2 + 6 / zoom}
 stroke="#ffffff"
 strokeWidth={2.8 / zoom}
 strokeLinecap="round"
 />
 {/* Vertical rose crosshair */}
 <line
 x1={0}
 y1={-eraserSize / 2 - 6 / zoom}
 x2={0}
 y2={eraserSize / 2 + 6 / zoom}
 stroke="#e11d48"
 strokeWidth={1.4 / zoom}
 strokeLinecap="round"
 />

 {/* Center Node Target Diamond/Box */}
 <rect
 x={-4 / zoom}
 y={-4 / zoom}
 width={8 / zoom}
 height={8 / zoom}
 fill="#ffffff"
 stroke="#0f172a"
 strokeWidth={1.5 / zoom}
 rx={1 / zoom}
 />
 {/* Minus / Delete symbol inside center diamond */}
 <line
 x1={-2 / zoom}
 y1={0}
 x2={2 / zoom}
 y2={0}
 stroke="#e11d48"
 strokeWidth={1.5 / zoom}
 strokeLinecap="round"
 />

 {/* Floating Tag Badge Above Cursor */}
 <g transform={`translate(0, ${-eraserSize / 2 - 14 / zoom})`}>
 <rect
 x={-58 / zoom}
 y={-10 / zoom}
 width={116 / zoom}
 height={18 / zoom}
 rx={9 / zoom}
 fill="#0f172a"
 stroke="#ffffff"
 strokeWidth={1.5 / zoom}
 opacity={0.95}
 />
 <text
 x={0}
 y={0}
 textAnchor="middle"
 dominantBaseline="central"
 fill="#ffffff"
 fontSize={10 / zoom}
 fontWeight="bold"
 fontFamily="system-ui, -apple-system, sans-serif"
 >
 ⌖ アンカー消去 ({eraserSize}px)
 </text>
 </g>
 </g>
 ) : (
 /* Stroke / Cut Standard Eraser Pointer */
 <g className="standard-eraser-pointer">
 {/* Outer high-contrast ring */}
 <circle
 cx={0}
 cy={0}
 r={eraserSize / 2}
 fill="rgba(239, 68, 68, 0.16)"
 stroke="#ffffff"
 strokeWidth={2.5 / zoom}
 />
 {/* Inner dashed red circle */}
 <circle
 cx={0}
 cy={0}
 r={eraserSize / 2}
 fill="none"
 stroke="#ef4444"
 strokeWidth={1.8 / zoom}
 strokeDasharray={`${4 / zoom} ${3 / zoom}`}
 />
 {/* Center point */}
 <circle
 cx={0}
 cy={0}
 r={2.5 / zoom}
 fill="#ef4444"
 stroke="#ffffff"
 strokeWidth={1 / zoom}
 />
 </g>
 )}
 </g>
 )}

 {/* ---------------- ACTIVE SMART SNAP GUIDELINES (BASELINE, LSB, METRICS, OTHER CONTOURS) ---------------- */}
 {activeSnapGuides.length > 0 && (
 <g className="smart-snap-guidelines select-none pointer-events-none">
 {activeSnapGuides.map((guide) => {
 const isBaseline = guide.targetType === 'baseline';
 const isLsb = guide.targetType === 'lsb';
 const lineColor = guide.color || (isBaseline ? '#ef4444' : isLsb ? selectionColor : '#06b6d4');
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

 {/* Mobile & Tablet Precision Touch Loupe (Zoom Magnifier Lens) */}
 {touchLoupeState.visible && touchLoupeState.canvasPos && (
 <div
 style={{
 position: 'fixed',
 left: Math.max(12, Math.min(window.innerWidth - 132, touchLoupeState.screenX - 60)),
 top: Math.max(12, touchLoupeState.screenY - 145),
 width: 120,
 height: 120,
 pointerEvents: 'none',
 }}
 className="z-50 rounded-full border-2 border-emerald-500 shadow-2xl bg-stone-900/95 overflow-hidden flex flex-col items-center justify-center select-none ring-4 ring-emerald-500/20"
 >
 <svg
 width="120"
 height="120"
 viewBox={`${touchLoupeState.canvasPos.x - 30} ${touchLoupeState.canvasPos.y - 30} 60 60`}
 className="w-full h-full bg-stone-950"
 >
 <MainGlyphContoursLayer
 contours={contours}
 isLight={false}
 theme={theme}
 outlineOnly={isOutlineMode}
 />
 {/* Precision Crosshairs */}
 <line
 x1={touchLoupeState.canvasPos.x - 25}
 y1={touchLoupeState.canvasPos.y}
 x2={touchLoupeState.canvasPos.x + 25}
 y2={touchLoupeState.canvasPos.y}
 stroke="#10b981"
 strokeWidth="0.75"
 strokeDasharray="2 1"
 />
 <line
 x1={touchLoupeState.canvasPos.x}
 y1={touchLoupeState.canvasPos.y - 25}
 x2={touchLoupeState.canvasPos.x}
 y2={touchLoupeState.canvasPos.y + 25}
 stroke="#10b981"
 strokeWidth="0.75"
 strokeDasharray="2 1"
 />
 {/* Target Reticle */}
 <circle
 cx={touchLoupeState.canvasPos.x}
 cy={touchLoupeState.canvasPos.y}
 r="2.5"
 fill="#10b981"
 stroke="#ffffff"
 strokeWidth="0.6"
 />
 </svg>
 <div className="absolute bottom-1 bg-black/85 text-[9.5px] font-mono font-bold text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 shadow-xs tabular-nums">
 X:{Math.round(touchLoupeState.canvasPos.x)} Y:{Math.round(touchLoupeState.canvasPos.y)}
 </div>
 </div>
 )}



 {/* Dynamic Smooth Stroke & Operation Feedback Toast Notification (Bottom-Right Non-Intrusive) */}
 {canvasToast && (
 <div className="absolute bottom-14 sm:bottom-12 right-2 sm:right-3 z-30 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150 max-w-[calc(100vw-32px)] sm:max-w-sm">
 <div
 className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full sm:rounded-lg border shadow-md sm:shadow-lg flex items-center gap-1.5 sm:gap-2 transition-all ${
 isLight
 ? 'bg-stone-900/90 border-stone-700 text-stone-100 '
 : 'bg-[#15241b]/95 border-emerald-600/60 text-emerald-100 '
 }`}
 >
 <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
 <div className="min-w-0">
 <div className="text-[11px] sm:text-xs font-semibold leading-tight truncate">{canvasToast.message}</div>
 {canvasToast.subText && (
 <div className="text-[9.5px] sm:text-[10px] text-stone-300 dark:text-emerald-300 font-normal leading-tight mt-0.5 truncate">
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
 className={`hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs pointer-events-auto transition-colors ${
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

 {/* Contextual Operation Hints */}
 <div className="text-[11px] text-stone-500 dark:text-emerald-400/80 hidden md:block truncate max-w-[280px]">
 {toolMode === 'ruler' &&
 'ドラッグして寸法・距離・角度を計測 (Shiftで水平/垂直固定、Enterで直線化)'}
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
 className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 transition-colors "
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
 className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold flex items-center gap-1 transition-colors "
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
 className={`flex items-center p-1 rounded-xl border shadow-md space-x-1 transition-all ${
 isLight
 ? 'bg-white/98 border-[#c8ded3] text-stone-700'
 : 'bg-[#142018]/98 border-[#25382c] text-emerald-200'
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
 ? 'ペン専用（指作図を無効化）'
 : 'OFF（指でも作図可能）'
 }`
 );
 }}
 className={`hidden md:flex px-2 py-1 rounded-lg text-[10px] font-bold items-center space-x-1 border transition-all ${
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
 className={`flex px-2 py-1 rounded-lg text-[10px] font-bold items-center space-x-1.5 border transition-all ${
 isLight
 ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
 : 'bg-[#16251b] text-emerald-300 border-emerald-700'
 }`}
 title="Apple Pencil / スタイラスペン入力検知中（筆圧・筆致自動反映）"
 >
 <span className="flex items-center space-x-1">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
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

 {toolMode === 'node' && (
 <div
 className={`px-2 py-1 rounded-lg text-[10.5px] font-bold flex items-center space-x-1 border ${
 isLight
 ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
 : 'bg-[#15231a] text-emerald-300 border-emerald-800'
 }`}
 >
 <Crosshair className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
 <span>パス頂点編集モード</span>
 <span className="text-[9.5px] opacity-75 font-normal ml-1">
 (Alt: スナップ一時解除 / S: スナップON/OFF)
 </span>
 </div>
 )}

 {toolMode === 'trace_adjust' && (
 <div
 className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center space-x-1.5 ${
 isLight ? 'bg-blue-600 text-white' : 'bg-blue-500 text-stone-950'
 }`}
 >
 <Move className="w-3.5 h-3.5" />
 <span>ドラッグして下絵写真を移動中</span>
 </div>
 )}

 <div
 className={`flex items-center p-1 rounded-lg border shadow-md space-x-1 ${
 isLight
 ? 'bg-white/98 border-[#c8ded3] text-stone-700'
 : 'bg-[#142018]/98 border-[#25382c] text-emerald-200'
 }`}
 >
 {/* Grid Size Quick Indicator & Slider Popover */}
 {gridSettings.showGrid && onChangeGridSettings && (
 <div className="relative" ref={quickGridSliderRef}>
 <div
 onClick={() => setShowQuickGridSlider((prev) => !prev)}
 className={`cursor-pointer flex items-center space-x-1 px-2 py-0.5 rounded border text-[11px] font-mono font-medium mr-1 select-none transition-colors ${
 showQuickGridSlider
 ? 'bg-emerald-600 text-white border-emerald-600 '
 : isLight
 ? 'bg-emerald-50/90 hover:bg-emerald-100 border-emerald-300 text-emerald-900'
 : 'bg-emerald-950/90 hover:bg-emerald-900 border-emerald-700 text-emerald-200'
 }`}
 title="クリックでグリッドサイズ調整スライダーを開く (Alt +/- でも微調整可能)"
 >
 <Grid className="w-3 h-3" />
 <span className="font-sans font-bold text-[10.5px]">方眼</span>
 <span className="font-bold">{gridSettings.gridSize || 50}px</span>
 <ChevronDown className={`w-3 h-3 transition-transform ${showQuickGridSlider ? 'rotate-180' : ''}`} />
 </div>

 {/* Quick Grid Slider Popover */}
 {showQuickGridSlider && (
 <div
 className={`absolute bottom-full mb-2 right-0 sm:left-0 sm:right-auto w-64 p-3 rounded-xl border shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 ${
 isLight
 ? 'bg-white border-[#c8ded3] text-stone-800'
 : 'bg-[#152119] border-[#25382c] text-emerald-100'
 }`}
 >
 <div className="flex items-center justify-between mb-2">
 <span className="font-bold text-xs flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
 <Grid className="w-3.5 h-3.5" />
 <span>グリッドサイズ変更</span>
 </span>
 <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
 {gridSettings.gridSize || 50}px
 </span>
 </div>

 {/* Slider Control */}
 <div className="space-y-2">
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() =>
 onChangeGridSettings((prev) => {
 const current = prev.gridSize || 50;
 const step = current > 100 ? 10 : current <= 20 ? 2 : 5;
 return { ...prev, gridSize: Math.max(5, current - step) };
 })
 }
 className="w-6 h-6 rounded flex items-center justify-center border border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-800 text-xs font-bold transition-colors shrink-0"
 title="サイズ縮小 (-)"
 >
 -
 </button>
 <input
 type="range"
 min="5"
 max="200"
 step="5"
 value={gridSettings.gridSize || 50}
 onChange={(e) => {
 const val = parseInt(e.target.value, 10);
 onChangeGridSettings((prev) => ({
 ...prev,
 gridSize: val,
 }));
 }}
 className="flex-1 h-2 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
 />
 <button
 type="button"
 onClick={() =>
 onChangeGridSettings((prev) => {
 const current = prev.gridSize || 50;
 const step = current >= 100 ? 10 : current < 20 ? 2 : 5;
 return { ...prev, gridSize: Math.min(250, current + step) };
 })
 }
 className="w-6 h-6 rounded flex items-center justify-center border border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-800 text-xs font-bold transition-colors shrink-0"
 title="サイズ拡大 (+)"
 >
 +
 </button>
 </div>

 {/* Quick Presets */}
 <div className="flex items-center gap-1 justify-between pt-1">
 {[10, 25, 50, 100, 128].map((size) => (
 <button
 key={size}
 type="button"
 onClick={() =>
 onChangeGridSettings((prev) => ({
 ...prev,
 gridSize: size,
 }))
 }
 className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
 (gridSettings.gridSize || 50) === size
 ? 'bg-emerald-600 text-white border-emerald-600'
 : 'bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
 }`}
 >
 {size}px
 </button>
 ))}
 </div>

 {/* Shortcut hint */}
 <div className="text-[10px] text-stone-500 dark:text-stone-400 text-center pt-1 border-t border-stone-200 dark:border-stone-800 flex items-center justify-center gap-1">
 <span>ショートカット:</span>
 <kbd className="px-1 py-0.2 bg-stone-100 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 font-mono font-bold">Alt</kbd>
 <span>+</span>
 <kbd className="px-1 py-0.2 bg-stone-100 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 font-mono font-bold">+/-</kbd>
 </div>
 </div>
 </div>
 )}
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

 {/* Quick Trace Position Reset in Canvas Footer when offset is nonzero */}
 {traceSettings.enabled && (traceSettings.offsetX !== 0 || traceSettings.offsetY !== 0) && onChangeTraceSettings && (
 <button
 onClick={handleResetTracePosition}
 title={`下絵位置がずれています (X:${traceSettings.offsetX || 0}, Y:${traceSettings.offsetY || 0})。クリックで中央(0, 0)にリセット`}
 className="px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center space-x-1 bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors "
 >
 <RotateCcw className="w-3 h-3" />
 <span>下絵位置リセット</span>
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
 ? 'bg-emerald-600 text-white font-bold '
 : 'bg-emerald-600 text-white font-bold'
 : isLight
 ? 'text-stone-600 hover:bg-emerald-100/50'
 : 'text-emerald-400 hover:bg-emerald-900/40'
 }`}
 >
 <Crosshair className="w-3.5 h-3.5" />
 </button>
 )}

 {/* Snap To Grid & Guides Quick Toggle */}
 {onChangeGridSettings && (
 <button
 onClick={() => {
 const next = !(gridSettings.snapToGrid || gridSettings.snapToGuides);
 onChangeGridSettings((prev) => ({
 ...prev,
 snapToGrid: next,
 snapToGuides: next,
 }));
 showCanvasToast(
 next
 ? 'スナップ (マグネット): ON (吸着有効)'
 : 'スナップ (マグネット): OFF (自由配置)'
 );
 }}
 title={`スマートスナップ: ${gridSettings.snapToGrid || gridSettings.snapToGuides ? 'ON (クリックでOFF)' : 'OFF (クリックでON)'} [Sキーで切替 / Alt長押しで一時解除]`}
 className={`p-1.5 rounded transition-colors flex items-center space-x-1 font-bold text-[11px] ${
 gridSettings.snapToGrid || gridSettings.snapToGuides
 ? isLight
 ? 'bg-emerald-600 text-white '
 : 'bg-emerald-600 text-white '
 : isLight
 ? 'text-stone-500 hover:bg-emerald-100/50'
 : 'text-emerald-400 hover:bg-emerald-900/40'
 }`}
 >
 <Magnet className="w-3.5 h-3.5" />
 <span className="text-[10px] hidden sm:inline">
 {gridSettings.snapToGrid || gridSettings.snapToGuides ? 'スナップON' : 'スナップOFF'}
 </span>
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

 {/* Outline Mode (Wireframe) Toggle in Floating Bar */}
 <button
 onClick={() => {
 const next = !isOutlineMode;
 setOutlineOnly(next);
 showCanvasToast(
 next
 ? '輪郭表示モードを有効にしました（パスの重なりや形状を透過確認）'
 : '塗りつぶし表示モードに戻しました'
 );
 }}
 title={`輪郭のみ表示（ワイヤーフレーム）: ${isOutlineMode ? 'ON' : 'OFF'} [Shift+O / Alt+O]`}
 className={`p-1.5 rounded transition-all flex items-center gap-1 text-xs ${
 isOutlineMode
 ? isLight
 ? 'bg-sky-500 text-white font-bold'
 : 'bg-sky-600 text-white font-bold'
 : isLight
 ? 'text-stone-700 hover:bg-emerald-100/50'
 : 'text-emerald-300 hover:bg-emerald-900/40'
 }`}
 >
 <Square className={`w-3.5 h-3.5 ${isOutlineMode ? 'stroke-[2.5] fill-none' : 'stroke-1.5'}`} />
 <span className="text-[10px] hidden lg:inline font-bold">
 {isOutlineMode ? '輪郭中' : '輪郭'}
 </span>
 </button>

 {/* Glyph Overlay Comparison Button */}
 {onOpenGlyphCompareModal && (
 <button
 onClick={onOpenGlyphCompareModal}
 title={`グリフ重ね合わせ比較: ${overlaySettings?.enabled ? `ON (「${overlaySettings?.referenceChar || ''}」)` : 'OFF'}`}
 className={`p-1.5 rounded transition-all flex items-center gap-1 text-xs ${
 overlaySettings?.enabled
 ? isLight
 ? 'bg-sky-500 text-white font-bold'
 : 'bg-sky-600 text-white font-bold'
 : isLight
 ? 'text-stone-700 hover:bg-emerald-100/50'
 : 'text-emerald-300 hover:bg-emerald-900/40'
 }`}
 >
 <ArrowRightLeft className="w-4 h-4" />
 {overlaySettings?.enabled && (
 <span className="text-[10px] hidden lg:inline max-w-[32px] truncate">
 {overlaySettings?.referenceChar || '比較'}
 </span>
 )}
 </button>
 )}

 {/* Zen / Wide Canvas Mode Toggle */}
 {onToggleZenMode && (
 <button
 onClick={onToggleZenMode}
 title={`全面作図・集中モード (サイドバー収納): ${isZenMode ? 'ON' : 'OFF'} (Zキー)`}
 className={`p-1.5 rounded transition-all ${
 isZenMode
 ? isLight
 ? 'bg-amber-400 text-emerald-950 font-bold '
 : 'bg-emerald-500 text-stone-950 font-bold '
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
 className={`sm:hidden ml-auto flex items-center p-0.5 rounded-full border shadow-md pointer-events-auto text-xs ${
 isLight
 ? 'bg-white border-[#c8ded3] text-stone-700'
 : 'bg-[#142018] border-[#25382c] text-emerald-200'
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

 {/* Mobile Selected Contour Quick Action Bar (Only in Select or Node tool modes) */}
 {(toolMode === 'select' || toolMode === 'node') && selectedContourIds.length > 0 && (
 <div
 className={`sm:hidden absolute bottom-12 left-3 right-3 z-30 flex items-center justify-between px-3 py-1.5 rounded-full border shadow-xl ${
 isLight
 ? 'bg-white border-emerald-300/80 text-stone-800'
 : 'bg-[#121c15] border-emerald-700/60 text-emerald-100'
 }`}
 >
 <div className="flex items-center space-x-1">
 <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
 選択中{selectedContourIds.length > 1 ? ` (${selectedContourIds.length}個)` : ''}
 </span>
 </div>
 <div className="flex items-center space-x-1.5">
 {selectedContourIds.length >= 2 && (
 <button
 onClick={handleMergeSelectedContours}
 className="px-2.5 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold active:scale-95 transition-transform flex items-center gap-1"
 title="選択したパスを合体"
 >
 <Layers className="w-3.5 h-3.5" />
 <span>合体</span>
 </button>
 )}
 <button
 onClick={() => setShowMobilePartSheet(true)}
 className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold active:scale-95 transition-transform"
 >
 変形
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
 <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 animate-fadeIn">
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
 className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all text-xs"
 >
 <Layers className="w-4 h-4" />
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
 <div className="font-bold text-stone-500 dark:text-stone-400 mb-1.5">ストローク最適化</div>
 <div className="grid grid-cols-2 gap-1.5">
 <button
 onClick={() => handleSmoothStrokeSelected('standard', true)}
 className="p-2 rounded-lg border flex items-center justify-center gap-1.5 bg-stone-50 dark:bg-stone-900/60 hover:bg-emerald-50 dark:hover:bg-[#1f2f24] font-medium"
 >
 <Wand2 className="w-3.5 h-3.5 text-stone-600 dark:text-stone-300" />
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
 <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 animate-fadeIn">
 <div
 className="fixed inset-0"
 onClick={() => setShowMobileBrushSheet(false)}
 />
 <div
 className={`relative z-10 w-full rounded-t-2xl p-4 border-t shadow-2xl max-h-[82vh] overflow-y-auto ${
 isLight
 ? 'bg-white border-[#c8ded3] text-stone-800'
 : 'bg-[#151f19] border-[#25362b] text-emerald-100'
 }`}
 style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 80px, 80px)' }}
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

 {/* Smoothing Intensity Control */}
 <div className="mb-4">
 <div className="flex items-center justify-between text-xs font-bold mb-1.5">
 <span className="text-stone-500 dark:text-stone-400">手ブレ補正強度 (Smoothing)</span>
 <span className="font-mono text-xs px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
 {smoothingIntensity === 0
 ? 'OFF (0%)'
 : `${smoothingIntensity}%`}
 </span>
 </div>
 <div className="flex items-center space-x-2 my-1">
 <span className="text-[10px] opacity-60">OFF</span>
 <input
 type="range"
 min="0"
 max="100"
 step="5"
 value={smoothingIntensity ?? 0}
 onChange={(e) => onChangeSmoothingIntensity?.(Number(e.target.value))}
 className="flex-1 h-2 bg-stone-200 dark:bg-stone-700 rounded-lg cursor-pointer accent-emerald-600"
 />
 <span className="text-[10px] opacity-60">100%</span>
 </div>
 <div className="grid grid-cols-5 gap-1 mt-1.5">
 {[
 { val: 0, label: 'OFF' },
 { val: 25, label: '弱め' },
 { val: 50, label: '標準' },
 { val: 75, label: '強め' },
 { val: 100, label: '最大' },
 ].map((preset) => (
 <button
 key={preset.val}
 onClick={() => onChangeSmoothingIntensity?.(preset.val)}
 className={`py-1 rounded text-[10px] font-bold border transition-colors text-center ${
 smoothingIntensity === preset.val
 ? 'bg-emerald-600 text-white border-emerald-600'
 : 'bg-stone-100 dark:bg-stone-900 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
 }`}
 >
 {preset.label}
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

 {/* 3. Guides & Grid Settings Modal / Sheet (Responsive: Bottom Sheet on Mobile, Centered Modal on Desktop) */}
 {showMobileGuidesSheet && (
 <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-black/60 animate-fadeIn">
 <div
 className="fixed inset-0"
 onClick={() => setShowMobileGuidesSheet(false)}
 />
 <div
 className={`relative z-10 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 pb-28 sm:pb-5 border-t sm:border shadow-2xl max-h-[85vh] overflow-y-auto ${
 isLight
 ? 'bg-white border-[#c8ded3] text-stone-800'
 : 'bg-[#151f19] border-[#25362b] text-emerald-100'
 }`}
 style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 80px, 20px)' }}
 >
 <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-3">
 <div className="font-bold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
 <Grid className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
 <span>ガイド枠・方眼グリッド設定</span>
 </div>
 <button
 onClick={() => setShowMobileGuidesSheet(false)}
 className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 <div className="space-y-3.5 text-xs">
 {/* Square Grid & Snapping with Intuitive Slider */}
 <div
 className={`p-3 rounded-xl border transition-all ${
 gridSettings.showGrid
 ? isLight
 ? 'bg-emerald-50/70 border-emerald-300 '
 : 'bg-emerald-950/30 border-emerald-800/80'
 : isLight
 ? 'bg-stone-50/80 border-stone-200'
 : 'bg-stone-900/40 border-stone-800'
 }`}
 >
 <div className="flex items-center justify-between mb-2">
 <div className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5 text-[12.5px]">
 <Grid className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
 <span>方眼グリッド & 吸着</span>
 </div>
 {/* Alt Shortcut Info Badge */}
 <div
 className="flex items-center gap-1 text-[10px] text-stone-600 dark:text-stone-300 bg-white/80 dark:bg-stone-800/80 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 "
 title="キーボードショートカット: Gキーで表示切替、Altキーを押しながら +/- でサイズ微調整"
 >
 <span className="opacity-75">短縮:</span>
 <kbd className="px-1 py-0.2 bg-stone-100 dark:bg-stone-700 rounded border border-stone-300 dark:border-stone-600 font-mono font-bold">G</kbd>
 <span className="opacity-50">/</span>
 <kbd className="px-1 py-0.2 bg-stone-100 dark:bg-stone-700 rounded border border-stone-300 dark:border-stone-600 font-mono font-bold">Alt</kbd>
 <span className="opacity-50">+</span>
 <kbd className="px-1 py-0.2 bg-stone-100 dark:bg-stone-700 rounded border border-stone-300 dark:border-stone-600 font-mono font-bold">+/-</kbd>
 </div>
 </div>

 {/* Toggles: Grid Line & Snap */}
 <div className="grid grid-cols-2 gap-2 mb-2.5">
 <button
 type="button"
 onClick={() =>
 onChangeGridSettings?.((prev) => ({
 ...prev,
 showGrid: !prev.showGrid,
 }))
 }
 className={`p-2 rounded-lg border font-bold flex items-center justify-between transition-all ${
 gridSettings.showGrid
 ? 'bg-emerald-600 text-white border-emerald-600 '
 : 'bg-stone-100 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
 }`}
 >
 <span className="flex items-center gap-1.5">
 <Grid className="w-3.5 h-3.5" />
 <span>方眼グリッド表示</span>
 </span>
 <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 font-mono font-bold">
 {gridSettings.showGrid ? 'ON' : 'OFF'}
 </span>
 </button>
 <button
 type="button"
 onClick={() =>
 onChangeGridSettings?.((prev) => ({
 ...prev,
 snapToGrid: !prev.snapToGrid,
 }))
 }
 className={`p-2 rounded-lg border font-bold flex items-center justify-between transition-all ${
 gridSettings.snapToGrid
 ? 'bg-emerald-600 text-white border-emerald-600 '
 : 'bg-stone-100 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
 }`}
 >
 <span className="flex items-center gap-1.5">
 <Magnet className="w-3.5 h-3.5" />
 <span>グリッド吸着</span>
 </span>
 <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 font-mono font-bold">
 {gridSettings.snapToGrid ? 'ON' : 'OFF'}
 </span>
 </button>
 </div>

 {/* Intuitive Grid Size Slider & Direct Input Controls */}
 <div className="space-y-2 p-2.5 rounded-lg bg-white/90 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800">
 <div className="flex items-center justify-between">
 <span className="font-bold text-[11px] text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
 <span>グリッドサイズ (間隔)</span>
 {!gridSettings.showGrid && (
 <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
 (グリッドONで反映)
 </span>
 )}
 </span>
 <div className="flex items-center gap-1.5">
 <button
 type="button"
 onClick={() =>
 onChangeGridSettings?.((prev) => {
 const current = prev.gridSize || 50;
 const step = current > 100 ? 10 : current <= 20 ? 2 : 5;
 return { ...prev, gridSize: Math.max(5, current - step) };
 })
 }
 className="w-6 h-6 rounded flex items-center justify-center border border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-800 text-xs font-bold transition-colors select-none"
 title="サイズ縮小 (-)"
 >
 -
 </button>
 <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded px-1.5 py-0.5 border border-stone-300 dark:border-stone-700">
 <input
 type="number"
 min="5"
 max="250"
 value={gridSettings.gridSize || 50}
 onChange={(e) => {
 const val = parseInt(e.target.value, 10);
 if (!isNaN(val)) {
 onChangeGridSettings?.((prev) => ({
 ...prev,
 gridSize: Math.max(5, Math.min(250, val)),
 }));
 }
 }}
 className="w-10 bg-transparent text-center font-mono font-bold text-emerald-700 dark:text-emerald-300 text-xs focus:outline-hidden"
 />
 <span className="text-[10px] font-mono text-stone-500 font-bold">px</span>
 </div>
 <button
 type="button"
 onClick={() =>
 onChangeGridSettings?.((prev) => {
 const current = prev.gridSize || 50;
 const step = current >= 100 ? 10 : current < 20 ? 2 : 5;
 return { ...prev, gridSize: Math.min(250, current + step) };
 })
 }
 className="w-6 h-6 rounded flex items-center justify-center border border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-800 text-xs font-bold transition-colors select-none"
 title="サイズ拡大 (+)"
 >
 +
 </button>
 </div>
 </div>

 {/* Range Slider */}
 <div className="flex items-center gap-2 pt-0.5">
 <span className="text-[10px] font-mono text-stone-400 font-bold">5px</span>
 <input
 type="range"
 min="5"
 max="200"
 step="5"
 value={gridSettings.gridSize || 50}
 onChange={(e) => {
 const val = parseInt(e.target.value, 10);
 onChangeGridSettings?.((prev) => ({
 ...prev,
 gridSize: val,
 }));
 }}
 className="flex-1 h-2 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-hidden"
 title={`グリッドサイズ: ${gridSettings.gridSize || 50}px`}
 />
 <span className="text-[10px] font-mono text-stone-400 font-bold">200px</span>
 </div>

 {/* Quick Presets */}
 <div className="flex items-center gap-1 pt-1 overflow-x-auto no-scrollbar">
 <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold shrink-0 mr-0.5">プリセット:</span>
 {[
 { label: '10px (極小)', size: 10 },
 { label: '25px (細)', size: 25 },
 { label: '50px (標準)', size: 50 },
 { label: '100px (中)', size: 100 },
 { label: '128px (2進)', size: 128 },
 ].map((preset) => (
 <button
 key={preset.size}
 type="button"
 onClick={() =>
 onChangeGridSettings?.((prev) => ({
 ...prev,
 gridSize: preset.size,
 }))
 }
 className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors shrink-0 ${
 (gridSettings.gridSize || 50) === preset.size
 ? 'bg-emerald-600 text-white border-emerald-600 '
 : 'bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
 }`}
 >
 {preset.label}
 </button>
 ))}
 </div>
 </div>

 {/* Grid & Guide Lines Opacity / Darkness Slider */}
 <div className="pt-2 border-t border-stone-200/80 dark:border-stone-800/80">
 <div className="flex items-center justify-between mb-1">
 <span className="text-xs font-bold text-stone-600 dark:text-stone-300">
 グリッド・ガイド線の濃さ (透明度)
 </span>
 <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
 {gridSettings.gridOpacity ?? 30}%
 </span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-[10px] text-stone-400 font-bold">10%</span>
 <input
 type="range"
 min="10"
 max="100"
 step="5"
 value={gridSettings.gridOpacity ?? 30}
 onChange={(e) => {
 const val = parseInt(e.target.value, 10);
 onChangeGridSettings?.((prev) => ({
 ...prev,
 gridOpacity: val,
 }));
 }}
 className="flex-1 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-hidden"
 />
 <span className="text-[10px] text-stone-400 font-bold">100%</span>
 </div>
 {/* Opacity Presets */}
 <div className="flex items-center gap-1.5 mt-1.5">
 {[
 { label: '極薄 (15%)', val: 15 },
 { label: '淡め (25%)', val: 25 },
 { label: '標準 (35%)', val: 35 },
 { label: 'くっきり (60%)', val: 60 },
 { label: '濃いめ (85%)', val: 85 },
 ].map((p) => (
 <button
 key={p.val}
 type="button"
 onClick={() =>
 onChangeGridSettings?.((prev) => ({
 ...prev,
 gridOpacity: p.val,
 }))
 }
 className={`flex-1 py-1 rounded text-[10px] font-bold border transition-colors ${
 (gridSettings.gridOpacity ?? 30) === p.val
 ? 'bg-emerald-600 text-white border-emerald-600 '
 : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
 }`}
 >
 {p.label}
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* Japanese Guide Pattern */}
 <div>
 <div className="font-bold text-stone-500 dark:text-stone-400 mb-1.5 flex items-center justify-between">
 <span>和文目安ガイド (書道・作字格)</span>
 <span className="text-[10px] text-stone-400 font-normal">正方形フレーム内</span>
 </div>
 <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
 {[
 { id: 'none', label: 'なし', sub: '非表示' },
 { id: 'cross', label: '十字格', sub: '中心' },
 { id: 'tian', label: '田字格', sub: '4象限' },
 { id: 'jiugong', label: '九宮格', sub: '3×3分割' },
 { id: 'sixteen', label: '十六宮格', sub: '4×4分割' },
 { id: 'mi', label: '米字格', sub: '対角線' },
 ].map((g) => (
 <button
 key={g.id}
 onClick={() =>
 onChangeGridSettings?.((prev) => ({
 ...prev,
 japaneseGuide: g.id as any,
 }))
 }
 className={`py-1.5 px-1 rounded-lg border text-center font-bold transition-all ${
 (gridSettings.japaneseGuide || 'tian') === g.id
 ? 'bg-emerald-600 text-white border-emerald-600 '
 : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
 }`}
 title={`${g.label} (${g.sub})`}
 >
 <div className="text-xs">{g.label}</div>
 <div className="text-[9px] opacity-75 font-normal">{g.sub}</div>
 </button>
 ))}
 </div>
 </div>

 {/* Dedicated Vertical Guideline System (縦グリッド・縦分割線) */}
 <div>
 <div className="font-bold text-stone-500 dark:text-stone-400 mb-1.5 flex items-center justify-between">
 <span className="text-purple-700 dark:text-purple-400">縦グリッド・縦分割ガイド</span>
 <span className="text-[10px] text-stone-400 font-normal">偏・旁・ステム配置</span>
 </div>
 <div className="grid grid-cols-5 gap-1.5">
 {[
 { id: 'none', label: 'なし', sub: 'OFF' },
 { id: 'center', label: '左右中心', sub: `X=${upm / 2}` },
 { id: 'thirds', label: '3分割', sub: '偏・中・旁' },
 { id: 'quarters', label: '4分割', sub: '1/4, 1/2, 3/4' },
 { id: 'eighths', label: '8分割', sub: '精密配置' },
 ].map((vg) => (
 <button
 key={vg.id}
 onClick={() =>
 onChangeGridSettings?.((prev) => ({
 ...prev,
 verticalGuide: vg.id as any,
 }))
 }
 className={`py-1.5 px-1 rounded-lg border text-center font-bold transition-all ${
 (gridSettings.verticalGuide || 'none') === vg.id
 ? 'bg-purple-600 text-white border-purple-600 '
 : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
 }`}
 title={`縦ガイド: ${vg.label} (${vg.sub})`}
 >
 <div className="text-xs">{vg.label}</div>
 <div className="text-[9px] opacity-75 font-normal">{vg.sub}</div>
 </button>
 ))}
 </div>
 </div>

 {/* Kanji / Kana Frames & Center Axis */}
 <div>
 <div className="font-bold text-stone-500 dark:text-stone-400 mb-1.5">字面枠・中心軸表示</div>
 <div className="grid grid-cols-3 gap-1.5">
 <button
 onClick={() =>
 onChangeGridSettings?.((prev) => ({
 ...prev,
 showBodyFrame: !prev.showBodyFrame,
 }))
 }
 className={`p-1.5 rounded-lg border font-bold flex flex-col items-center justify-center text-center transition-colors ${
 gridSettings.showBodyFrame !== false
 ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
 : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500'
 }`}
 >
 <span className="text-xs">漢字枠 (85%)</span>
 <span className="font-mono text-[9px] mt-0.5 px-1 rounded bg-black/10 dark:bg-white/10">
 {gridSettings.showBodyFrame !== false ? 'ON' : 'OFF'}
 </span>
 </button>
 <button
 onClick={() =>
 onChangeGridSettings?.((prev) => ({
 ...prev,
 showKanaFrame: !prev.showKanaFrame,
 }))
 }
 className={`p-1.5 rounded-lg border font-bold flex flex-col items-center justify-center text-center transition-colors ${
 gridSettings.showKanaFrame
 ? 'bg-amber-100 dark:bg-amber-950 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
 : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500'
 }`}
 >
 <span className="text-xs">仮名枠 (78%)</span>
 <span className="font-mono text-[9px] mt-0.5 px-1 rounded bg-black/10 dark:bg-white/10">
 {gridSettings.showKanaFrame ? 'ON' : 'OFF'}
 </span>
 </button>
 <button
 onClick={() =>
 onChangeGridSettings?.((prev) => ({
 ...prev,
 showVerticalCenter: prev.showVerticalCenter === false ? true : false,
 }))
 }
 className={`p-1.5 rounded-lg border font-bold flex flex-col items-center justify-center text-center transition-colors ${
 gridSettings.showVerticalCenter !== false
 ? 'bg-purple-100 dark:bg-purple-950 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-200'
 : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500'
 }`}
 title={`メトリクス左右中心線 (X=${upm / 2})`}
 >
 <span className="text-xs">左右中心線</span>
 <span className="font-mono text-[9px] mt-0.5 px-1 rounded bg-black/10 dark:bg-white/10">
 {gridSettings.showVerticalCenter !== false ? 'ON' : 'OFF'}
 </span>
 </button>
 </div>
 </div>

 {/* Outline Mode vs Filled Mode Appearance */}
 <div>
 <div className="font-bold text-stone-500 dark:text-stone-400 mb-1.5 flex items-center justify-between">
 <span>文字の描画表示モード</span>
 <span className="text-[10px] font-mono text-stone-400">Shift+O / Alt+O</span>
 </div>
 <div className="grid grid-cols-2 gap-1.5">
 <button
 type="button"
 onClick={() => {
 setOutlineOnly(false);
 showCanvasToast('塗りつぶし表示モードに切り替えました');
 }}
 className={`p-2 rounded-lg border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
 !isOutlineMode
 ? 'bg-emerald-600 text-white border-emerald-600 '
 : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
 }`}
 >
 <div className="w-3 h-3 rounded-xs bg-current border border-current" />
 <span>塗りつぶし</span>
 </button>
 <button
 type="button"
 onClick={() => {
 setOutlineOnly(true);
 showCanvasToast('輪郭表示モード（ワイヤーフレーム）を有効にしました');
 }}
 className={`p-2 rounded-lg border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
 isOutlineMode
 ? 'bg-sky-600 text-white border-sky-600 '
 : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
 }`}
 >
 <Square className="w-3.5 h-3.5 stroke-2 fill-none" />
 <span>輪郭のみ</span>
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
 ? 'bg-emerald-600 text-white border-emerald-600 '
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
 ? 'bg-emerald-600 text-white border-emerald-600 '
 : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
 }`}
 >
 選択のみ
 </button>
 <button
 onClick={() => setShowNodes((prev) => !prev)}
 className={`p-2 rounded-lg border text-center font-bold transition-all ${
 !showNodes
 ? 'bg-amber-600 text-white border-amber-600 '
 : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
 }`}
 >
 {showNodes ? '全隠す' : '非表示中'}
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
}, (prev, next) => {
 if (prev.selectedUnicode !== next.selectedUnicode) return false;
 if (prev.contours !== next.contours) return false;
 if (prev.toolMode !== next.toolMode) return false;
 if (prev.advanceWidth !== next.advanceWidth) return false;
 if (prev.lsb !== next.lsb) return false;
 if (prev.brushWidth !== next.brushWidth) return false;
 if (prev.brushStyle !== next.brushStyle) return false;
 if (prev.pressureSensitivity !== next.pressureSensitivity) return false;
 if (prev.smoothingIntensity !== next.smoothingIntensity) return false;
 if (prev.theme !== next.theme) return false;
 if (prev.activeChar !== next.activeChar) return false;
 if (prev.showGridDrawer !== next.showGridDrawer) return false;
 if (prev.showMetricsDrawer !== next.showMetricsDrawer) return false;
 if (prev.showRadicals !== next.showRadicals) return false;
 if (prev.isZenMode !== next.isZenMode) return false;
 if (prev.canUndo !== next.canUndo) return false;
 if (prev.canRedo !== next.canRedo) return false;
 if (prev.isAnyModalOpen !== next.isAnyModalOpen) return false;
 if (prev.gridSettings !== next.gridSettings) return false;
 if (prev.traceSettings !== next.traceSettings) return false;
 if (prev.overlaySettings !== next.overlaySettings) return false;
 return true;
});
