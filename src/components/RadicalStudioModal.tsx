import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  MousePointer,
  PenTool,
  Paintbrush,
  Eraser,
  Square,
  Circle,
  Triangle,
  Star,
  Heart,
  Diamond,
  Hand,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Italic,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Layers,
  Search,
  Check,
  ArrowRight,
  Move,
  FileCode,
  Shapes,
  Sliders,
  Undo2,
  Redo2,
  FolderOpen,
  BookmarkPlus,
  Scissors,
  GripVertical,
  CornerDownLeft,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  ShieldCheck,
  CircleDot,
  Disc,
  Moon,
  Slash,
  Hexagon,
  Wand2,
  BookOpen,
  Database,
} from 'lucide-react';
import { BundledFontsModal } from './BundledFontsModal';
import {
  RADICAL_KANJI_DATABASE,
  KANJI_RADICAL_CATEGORIES,
  searchRadicalDatabase,
  RadicalEntry,
  getRadicalEntry,
} from '../data/kanjiRadicalDatabase';
import {
  CustomPart,
  PartCategory,
  PathContour,
  BezierNode,
  Point,
  StrokePoint,
  ToolMode,
  BrushStyle,
  ShapeType,
  RadicalPlacement,
  GlyphData,
  FontProject,
} from '../types';
import {
  generateId,
  contoursToSvgPath,
  strokePointsToOutline,
  smoothStrokeContour,
  createRectContour,
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
  slantSingleContour,
  rotateSingleContour,
  scaleSingleContour,
  flipSingleContourH,
  flipSingleContourV,
  slantContours,
  scaleContours,
  flipContoursHorizontal,
  flipContoursVertical,
  transformContoursForPlacement,
  getContoursBoundingBox,
  unionContours,
  normalizeGlyphContoursWinding,
  simplifyGlyphContours,
  isPointNearContour,
  eraseContoursAtPoint,
  subtractEraserStrokeFromContours,
  flipMultipleContoursH,
  flipMultipleContoursV,
  expandStrokeContours,
} from '../utils/pathUtils';
import { parseSvgStringToContours } from '../utils/svgParser';
import { SCREEN_BASELINE_Y } from '../utils/fontCompiler';
import { ThemeMode, isLightTheme } from '../utils/theme';
import { loadCustomParts, saveCustomParts } from '../utils/customPartsStorage';
import { KANJI_RADICALS } from '../data/kanjiRadicals';
import { KANGXI_214_RADICALS } from '../data/kangxi214Radicals';
import {
  getOrExtractRadicalContours,
  RADICAL_FONT_OPTIONS,
  FontStyleOption,
  INITIAL_STUDIO_RADICAL_DEFS,
} from '../utils/radicalExtractor';

export const CUSTOM_PARTS_STORAGE_KEY = 'font_editor_custom_parts_v1';

export interface StudioRadicalPresetItem {
  id: string;
  name: string;
  char: string;
  category: PartCategory;
  description: string;
}

// Complete catalog of all 214 traditional Kangxi radicals (康熙字典 全214部首) + stroke & geometric parts
export const STUDIO_RADICAL_PRESETS: StudioRadicalPresetItem[] = [
  ...KANGXI_214_RADICALS.map((r) => {
    let cat: PartCategory = 'stroke';
    if (r.category === 'basic') {
      cat = 'stroke';
    } else if (r.category) {
      cat = r.category as PartCategory;
    }

    return {
      id: `rad_kangxi_${r.number}`,
      char: r.displayChar || r.char,
      name: `${r.name}`,
      category: cat,
      description: `康熙部首 ${r.number}番 (${r.strokes}画): ${r.description}`,
    };
  }),

  // 偏 (Hen additional aliases)
  { id: 'rad_ninben', char: '亻', name: 'にんべん', category: 'hen', description: '人・動作に関する偏 (休, 作, 体, 信, 健)' },
  { id: 'rad_sanzui', char: '氵', name: 'さんずい', category: 'hen', description: '水・液体に関する偏 (海, 湖, 清, 河, 汁)' },
  { id: 'rad_kihen', char: '木', name: 'きへん', category: 'hen', description: '樹木・木製品に関する偏 (林, 村, 校, 板, 柱)' },
  { id: 'rad_tehen', char: '扌', name: 'てへん', category: 'hen', description: '手・動作に関する偏 (持, 打, 投, 指, 技)' },
  { id: 'rad_gonben', char: '言', name: 'ごんべん', category: 'hen', description: '言葉・話すことに関する偏 (話, 語, 読, 記, 談)' },
  { id: 'rad_itohen', char: '糸', name: 'いとへん', category: 'hen', description: '織物・糸に関する偏 (線, 細, 組, 約, 結)' },

  // 基本筆画・ストローク (Stroke)
  { id: 'rad_stroke_h_line', char: '一', name: '横画 (水平)', category: 'stroke', description: '基本水平ストローク (一, 二, 三, 上, 下)' },
  { id: 'rad_stroke_v_line', char: '丨', name: '縦画 (垂直)', category: 'stroke', description: '基本垂直ストローク (中, 十, 千, 甲, 申)' },
  { id: 'rad_stroke_dot', char: '丶', name: '点 (打点)', category: 'stroke', description: '打点・水滴ストローク (丸, 主, 丹, 求)' },
  { id: 'rad_stroke_sweep_l', char: '丿', name: '左払い (左払)', category: 'stroke', description: '左下へ流れる払い (九, 及, 反, 文, 禾)' },
  { id: 'rad_stroke_sweep_r', char: '乀', name: '右払い (右払)', category: 'stroke', description: '右下へ力強く抜ける払い (大, 人, 木, 天)' },
  { id: 'rad_stroke_hook', char: '亅', name: 'はね・鉤', category: 'stroke', description: '垂直からの跳ね上げ (了, 予, 事, 于)' },
  { id: 'rad_stroke_bend', char: '乙', name: '曲がり・折れ', category: 'stroke', description: '折れ曲がりストローク (乙, 乞, 乾, 乱)' },

  // 幾何学パーツ (Geometric)
  { id: 'rad_geo_square', char: '■', name: '正方形 (ボックス)', category: 'geometric', description: '幾何学正方形ベース (口, 日, 目, 田, 国)' },
  { id: 'rad_geo_rect_v', char: '▮', name: '縦長方形 (柱)', category: 'geometric', description: '縦方向の幾何学長方形ストローク' },
  { id: 'rad_geo_rect_h', char: '▬', name: '横長方形 (梁)', category: 'geometric', description: '横方向の幾何学長方形ストローク' },
  { id: 'rad_geo_circle', char: '●', name: '正円 (ドット)', category: 'geometric', description: '幾何学正円・丸ポイント' },
  { id: 'rad_geo_ring', char: '○', name: '円環 (リング)', category: 'geometric', description: '幾何学円環・中空サークル' },
  { id: 'rad_geo_triangle', char: '▲', name: '正三角形', category: 'geometric', description: '幾何学三角形ストローク' },
  { id: 'rad_geo_diamond', char: '◆', name: 'ひし形 (菱形)', category: 'geometric', description: '幾何学ダイヤモンド・ひし形' },
  { id: 'rad_geo_cross', char: '✚', name: '十字 (クロス)', category: 'geometric', description: '幾何学十字交差 (十, 針, 計, 井)' },
  { id: 'rad_geo_hexagon', char: '⬢', name: '六角形 (ヘキサゴン)', category: 'geometric', description: '幾何学六角形ブロック' },

  // 仮名共通部 (Kana)
  { id: 'rad_kana_dakuten', char: '゛', name: '濁点 (濁音符)', category: 'kana', description: '仮名濁音符 (が, ざ, だ, ば, ヴ)' },
  { id: 'rad_kana_handakuten', char: '゜', name: '半濁点 (半濁音符)', category: 'kana', description: '仮名半濁音符 (ぱ, ぴ, ぷ, ぺ, ぽ)' },
  { id: 'rad_kana_chouon', char: 'ー', name: '長音符 (音引き)', category: 'kana', description: 'カタカナ長音記号' },
  { id: 'rad_kana_kurikaeshi', char: '々', name: '同の字点 (送り点)', category: 'kana', description: '漢字繰り返し記号 (佐々木, 時々, 日々)' },
];

interface RadicalStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: FontProject;
  selectedChar: string;
  selectedUnicode: number;
  onInsertToCurrentGlyph: (contours: PathContour[]) => void;
  onBatchInsertToGlyphs?: (contours: PathContour[], targetChars: string[]) => void;
  theme: ThemeMode;
  onShowToast?: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const CATEGORY_TABS: { id: PartCategory; label: string; icon?: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'hen', label: '偏 (へん)' },
  { id: 'tsukuri', label: '旁 (つくり)' },
  { id: 'kanmuri', label: '冠 (かんむり)' },
  { id: 'ashi', label: '脚 (あし)' },
  { id: 'tare', label: '垂 (たれ)' },
  { id: 'kamae', label: '構 (かまえ)' },
  { id: 'stroke', label: '筆画・点・払い' },
  { id: 'geometric', label: '幾何学パーツ' },
  { id: 'kana', label: '仮名共通部' },
  { id: 'other', label: 'その他' },
];

const KANJI_PRESETS_BY_CATEGORY: Record<string, string[]> = {
  hen: ['休', '体', '位', '作', '保', '信', '健', '倶', '汁', '汗', '池', '油', '海', '港', '満', '波', '木', '林', '校', '板', '枝', '柱', '語', '記', '訳', '話', '読', '誠'],
  tsukuri: ['都', '郡', '部', '郷', '刊', '到', '割', '創', '改', '攻', '救', '放', '叙', '助', '動', '勝'],
  kanmuri: ['苗', '花', '草', '茶', '華', '薬', '空', '穴', '究', '突', '窃', '窮', '家', '安', '守', '宅', '密', '富', '寛'],
  ashi: ['照', '魚', '黒', '点', '烈', '煮', '熊', '焦', '無', '燕', '兄', '先', '光', '充', '兆', '児', '見', '規'],
  tare: ['庁', '広', '庄', '府', '庫', '庭', '康', '摩', '病', '痛', '疲', '疾', '症', '療'],
  kamae: ['国', '園', '囲', '図', '固', '圏', '岡', '風', '鳳', '問', '間', '閣', '関', '門'],
  stroke: ['一', '二', '三', '十', '大', '小', '中', '人', '日', '月', '年', '本'],
  other: ['愛', '和', '光', '福', '幸', '夢', '心', '創', '美', '知', '新', '生'],
};

export function sanitizeCustomParts(rawParts: unknown): CustomPart[] {
  if (!Array.isArray(rawParts)) return [];
  return rawParts
    .filter((p) => p && typeof p === 'object')
    .map((p: any) => ({
      id: String(p.id || generateId()),
      name: String(p.name || 'パーツ'),
      category: (p.category || 'other') as PartCategory,
      description: typeof p.description === 'string' ? p.description : '',
      contours: Array.isArray(p.contours)
        ? p.contours
            .filter((c: any) => c && Array.isArray(c.nodes))
            .map((c: any) => ({
              id: String(c.id || generateId()),
              closed: Boolean(c.closed),
              nodes: Array.isArray(c.nodes)
                ? c.nodes
                    .filter((n: any) => n && typeof n.x === 'number' && typeof n.y === 'number')
                    .map((n: any) => ({
                      id: String(n.id || generateId()),
                      x: n.x,
                      y: n.y,
                      handleIn: n.handleIn ? { x: n.handleIn.x, y: n.handleIn.y } : null,
                      handleOut: n.handleOut ? { x: n.handleOut.x, y: n.handleOut.y } : null,
                      type: n.type || 'corner',
                    }))
                : [],
            }))
        : [],
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    }));
}

export const RadicalStudioModal: React.FC<RadicalStudioModalProps> = ({
  isOpen,
  onClose,
  project,
  selectedChar,
  selectedUnicode,
  onInsertToCurrentGlyph,
  onBatchInsertToGlyphs,
  theme,
  onShowToast,
}) => {
  const isLight = isLightTheme(theme);

  // Custom parts library loaded from storage
  const [parts, setParts] = useState<CustomPart[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_PARTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const sanitized = sanitizeCustomParts(parsed);
        if (sanitized.length > 0) return sanitized;
      }
    } catch {
      // ignore
    }
    // Initial custom parts with ready-to-use vector contours
    return [
      {
        id: generateId(),
        name: 'さんずい (氵)',
        category: 'hen',
        description: '三水・水に関する偏',
        contours: KANJI_RADICALS.find((r) => r.id === 'rad_sanzui')?.contours || [],
        createdAt: Date.now() - 5000,
      },
      {
        id: generateId(),
        name: 'きへん (木)',
        category: 'hen',
        description: '木偏・樹木に関する偏',
        contours: KANJI_RADICALS.find((r) => r.id === 'rad_kihen')?.contours || [],
        createdAt: Date.now() - 4000,
      },
      {
        id: generateId(),
        name: 'にんべん (亻)',
        category: 'hen',
        description: '人偏・人間に関する偏',
        contours: KANJI_RADICALS.find((r) => r.id === 'rad_ninben')?.contours || [],
        createdAt: Date.now() - 3000,
      },
      {
        id: generateId(),
        name: 'ごんべん (言)',
        category: 'hen',
        description: '言偏・言葉に関する偏',
        contours: KANJI_RADICALS.find((r) => r.id === 'rad_gonben')?.contours || [],
        createdAt: Date.now() - 2000,
      },
      {
        id: generateId(),
        name: 'くさかんむり (艹)',
        category: 'kanmuri',
        description: '草冠・植物に関する冠',
        contours: KANJI_RADICALS.find((r) => r.id === 'rad_kusakanmuri')?.contours || [],
        createdAt: Date.now() - 1000,
      },
    ];
  });

  const [selectedPartId, setSelectedPartId] = useState<string>(() => {
    return parts[0]?.id || '';
  });

  // Current editing part state with guaranteed non-null contours array
  const activePart = useMemo(() => {
    const found = parts.find((p) => p && p.id === selectedPartId) || parts[0] || null;
    if (!found) return null;
    return {
      ...found,
      contours: Array.isArray(found.contours) ? found.contours : [],
    };
  }, [parts, selectedPartId]);

  const hasActiveContours = Boolean(activePart && activePart.contours && activePart.contours.length > 0);

  // Sidebar Tab & Filter & Search state
  const [leftSidebarTab, setLeftSidebarTab] = useState<'presets' | 'kanji_db' | 'custom'>('presets');
  const [activeCategory, setActiveCategory] = useState<PartCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [kanjiDbCategory, setKanjiDbCategory] = useState<string>('all');
  const [kanjiDbSearch, setKanjiDbSearch] = useState<string>('');
  const [selectedRadicalDbId, setSelectedRadicalDbId] = useState<string>('rad_ninben');
  const [selectedFontStyle, setSelectedFontStyle] = useState<FontStyleOption>(RADICAL_FONT_OPTIONS[0]);
  const [isLoadingPreset, setIsLoadingPreset] = useState<boolean>(false);
  const [isImportingAll, setIsImportingAll] = useState<boolean>(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState<boolean>(false);

  // Editor Tools & Viewport
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [brushWidth, setBrushWidth] = useState<number>(36);
  const [brushStyle, setBrushStyle] = useState<BrushStyle>('brush');
  const [pressureSensitivity, setPressureSensitivity] = useState<'high' | 'normal' | 'low' | 'off'>('normal');
  const [isStraightMode, setIsStraightMode] = useState<boolean>(false);
  const [isAutoUnionMode, setIsAutoUnionMode] = useState<boolean>(true);
  const [showPenShortcutsHelp, setShowPenShortcutsHelp] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(0.55);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 200, y: 140 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });

  // Guide Overlays
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showKanjiGuides, setShowKanjiGuides] = useState<boolean>(true);
  const [isWireframeMode, setIsWireframeMode] = useState<boolean>(false);
  const [showNineBoxes, setShowNineBoxes] = useState<boolean>(false);
  const [showMetrics, setShowMetrics] = useState<boolean>(true);
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [watermarkChar, setWatermarkChar] = useState<string>(selectedChar || '休');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.18);
  const [watermarkScale, setWatermarkScale] = useState<number>(1.0);
  const [showWatermarkPicker, setShowWatermarkPicker] = useState<boolean>(false);

  // Magnetic Snapping States
  const [isSnapEnabled, setIsSnapEnabled] = useState<boolean>(true);
  const [activeSnapLines, setActiveSnapLines] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  // Batch insertion states
  const [insertMode, setInsertMode] = useState<'single' | 'batch'>('single');
  const [batchCharsInput, setBatchCharsInput] = useState<string>('');
  const [selectedBatchChars, setSelectedBatchChars] = useState<string[]>([]);
  const [insertingPresetId, setInsertingPresetId] = useState<string | null>(null);

  // Active Drawing / Selection
  const [selectedContourId, setSelectedContourId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedHandleType, setSelectedHandleType] = useState<'node' | 'handleIn' | 'handleOut' | null>(null);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [isDraggingContour, setIsDraggingContour] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState<Point>({ x: 0, y: 0 });
  const dragStartContoursRef = useRef<PathContour[] | null>(null);

  // Brush / Shape / Pen tool in-progress state & high-performance drawing refs
  const [isDrawingStroke, setIsDrawingStroke] = useState(false);
  const brushStrokePointsRef = useRef<StrokePoint[]>([]);
  const activeBrushPathRef = useRef<SVGPathElement>(null);
  const brushRafIdRef = useRef<number | null>(null);
  const mouseSmoothSpeedRef = useRef<number>(0.5);
  const isPenDraggingHandleRef = useRef<boolean>(false);
  const [isPenNearFirstNode, setIsPenNearFirstNode] = useState<boolean>(false);

  const [shapeStartPoint, setShapeStartPoint] = useState<Point | null>(null);
  const [shapeCurrentPoint, setShapeCurrentPoint] = useState<Point | null>(null);
  const [activeShapeType, setActiveShapeType] = useState<ShapeType>('rect');
  const [showShapeMenu, setShowShapeMenu] = useState<boolean>(false);
  const [activePenContour, setActivePenContour] = useState<PathContour | null>(null);
  const [penMousePos, setPenMousePos] = useState<Point | null>(null);
  const [penHudPos, setPenHudPos] = useState<{ x: number; y: number } | null>(null);
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
  const isDraggingPenHudRef = useRef(false);
  const penHudDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Undo / Redo for Part Studio
  const [undoStack, setUndoStack] = useState<PathContour[][]>([]);
  const [redoStack, setRedoStack] = useState<PathContour[][]>([]);

  // Extraction Modal from Character
  const [showExtractModal, setShowExtractModal] = useState<boolean>(false);
  const [extractSearch, setExtractSearch] = useState<string>('');

  // Placement setting for insertion
  const [insertPlacement, setInsertPlacement] = useState<RadicalPlacement>('original');

  // Layout & Expand states for comfortable workspace
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [rightTab, setRightTab] = useState<'transform' | 'compose'>('transform');
  const [targetChar, setTargetChar] = useState<string>(selectedChar || '休');

  // Eraser modes & settings
  const [eraserMode, setEraserMode] = useState<'stroke' | 'cut' | 'node'>('stroke');
  const [eraserRadius, setEraserRadius] = useState<number>(24);
  const isErasingRef = useRef<boolean>(false);
  const eraserStrokePointsRef = useRef<Point[]>([]);
  const [eraserHoverPos, setEraserHoverPos] = useState<Point | null>(null);
  const activeEraserSvgDRef = useRef<string>('');
  const activeEraserPathRef = useRef<SVGPathElement | null>(null);

  // Mobile Bottom Sheet states
  const [mobileSheetSnap, setMobileSheetSnap] = useState<'peek' | 'half' | 'full'>('peek');
  const [mobileSheetTab, setMobileSheetTab] = useState<'radicals' | 'parts' | 'transform' | 'compose'>('radicals');

  // Multi-touch gestures (pinch-zoom and pan on mobile/tablet touch screens)
  const activeTouchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const touchPinchInitialDistRef = useRef<number | null>(null);
  const touchPinchInitialZoomRef = useRef<number>(1);
  const touchPinchInitialPanRef = useRef<Point>({ x: 0, y: 0 });
  const touchPinchInitialMidpointRef = useRef<Point>({ x: 0, y: 0 });

  // SVG file input ref
  const svgFileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const svgCanvasRef = useRef<SVGSVGElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const notify = useCallback(
    (text: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
      if (onShowToast) {
        onShowToast(text, type);
      }
    },
    [onShowToast]
  );

  const lastSavedPartsJsonRef = useRef<string>('');

  // Reload custom parts from IndexedDB
  const reloadPartsFromStorage = useCallback(async () => {
    try {
      const loaded = await loadCustomParts();
      const sanitized = sanitizeCustomParts(loaded);
      if (sanitized.length > 0) {
        setParts(sanitized);
        setSelectedPartId((prevId) => {
          if (sanitized.some((p) => p.id === prevId)) return prevId;
          return sanitized[0]?.id || '';
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const prevIsOpenRef = useRef(false);

  // Sync parts and target char whenever modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      reloadPartsFromStorage();
      if (selectedChar) {
        setWatermarkChar(selectedChar);
        setTargetChar(selectedChar);
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, selectedChar, reloadPartsFromStorage]);

  // Save parts to IndexedDB whenever they change while modal is open, and notify external listeners
  useEffect(() => {
    if (!isOpen || !parts || parts.length === 0) return;
    const jsonKey = JSON.stringify(parts.map((p) => p.id));
    if (jsonKey === lastSavedPartsJsonRef.current) return;
    lastSavedPartsJsonRef.current = jsonKey;

    saveCustomParts(parts).then(() => {
      window.dispatchEvent(new Event('font_custom_parts_updated'));
    });
  }, [parts, isOpen]);

  // Center editor view whenever selected part changes or on initial open
  const resetView = useCallback(() => {
    if (canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const margin = 48;
      const idealZoom = Math.min((rect.width - margin) / 1000, (rect.height - margin) / 1000);
      const clampedZoom = Math.max(0.2, Math.min(2.0, idealZoom));
      setZoom(clampedZoom);
      setPan({
        x: (rect.width - 1000 * clampedZoom) / 2,
        y: (rect.height - 1000 * clampedZoom) / 2,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        resetView();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, resetView]);

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el || !isOpen) return;

    const handleWheelNative = (e: WheelEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      else if (e.deltaMode === 2) delta *= 800;

      const zoomFactor = Math.pow(1.12, -delta / 120);

      setZoom((prevZoom) => {
        const nextZoom = Math.max(0.15, Math.min(6.0, prevZoom * zoomFactor));
        const scale = nextZoom / prevZoom;

        setPan((prevPan) => ({
          x: mouseX - (mouseX - prevPan.x) * scale,
          y: mouseY - (mouseY - prevPan.y) * scale,
        }));

        return nextZoom;
      });
    };

    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', handleWheelNative);
  }, [isOpen]);

  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
    setSelectedContourId(null);
    setSelectedNodeId(null);
    setActivePenContour(null);
  }, [selectedPartId]);

  // Related Kanji list containing current radical for watermark tracing guide picker
  const relatedKanjiList = useMemo(() => {
    if (!activePart) return ['休', '体', '保', '信', '作', '使', '個', '倍', '値', '倶'];

    const partName = activePart.name || '';
    const matchEntry = RADICAL_KANJI_DATABASE.find(
      (r) =>
        (partName && (partName.includes(r.name) || r.name.includes(partName))) ||
        (activePart.char && r.char === activePart.char) ||
        r.id === activePart.id
    );

    if (matchEntry && matchEntry.kanjiList.length > 0) {
      return matchEntry.kanjiList;
    }

    const categoryPresets = KANJI_PRESETS_BY_CATEGORY[activePart.category] || KANJI_PRESETS_BY_CATEGORY.other;
    const projectChars = (Object.values(project.glyphs || {}) as GlyphData[]).map((g) => g.char);
    const combined = Array.from(new Set([...categoryPresets, ...projectChars])).filter(Boolean);
    return combined.length > 0 ? combined.slice(0, 20) : ['休', '体', '保', '信', '作', '使', '個', '倍'];
  }, [activePart, project.glyphs]);

  // Magnetic guide & grid snapping helper
  const snapToGuides = useCallback(
    (pos: Point, snapDist = 12): { point: Point; snapX: number | null; snapY: number | null } => {
      if (!isSnapEnabled) {
        return { point: pos, snapX: null, snapY: null };
      }

      const keyXLines = [500, 460, 540, 333, 667];
      const keyYLines = [500, 380, 620, 333, 667];

      let snappedX = pos.x;
      let activeSnapX: number | null = null;
      let minDistX = snapDist;

      for (const lx of keyXLines) {
        const d = Math.abs(pos.x - lx);
        if (d < minDistX) {
          minDistX = d;
          snappedX = lx;
          activeSnapX = lx;
        }
      }

      if (activeSnapX === null && showGrid) {
        const gridX = Math.round(pos.x / 25) * 25;
        if (Math.abs(pos.x - gridX) < snapDist) {
          snappedX = gridX;
          activeSnapX = gridX;
        }
      }

      let snappedY = pos.y;
      let activeSnapY: number | null = null;
      let minDistY = snapDist;

      for (const ly of keyYLines) {
        const d = Math.abs(pos.y - ly);
        if (d < minDistY) {
          minDistY = d;
          snappedY = ly;
          activeSnapY = ly;
        }
      }

      if (activeSnapY === null && showGrid) {
        const gridY = Math.round(pos.y / 25) * 25;
        if (Math.abs(pos.y - gridY) < snapDist) {
          snappedY = gridY;
          activeSnapY = gridY;
        }
      }

      return {
        point: { x: snappedX, y: snappedY },
        snapX: activeSnapX,
        snapY: activeSnapY,
      };
    },
    [isSnapEnabled, showGrid]
  );

  // Global Keyboard Shortcuts within Studio Modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Undo / Redo
      const isZ = e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z';
      const isY = e.code === 'KeyY' || e.key === 'y' || e.key === 'Y';
      if ((e.ctrlKey || e.metaKey) && isZ) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else if (activePenContour && activePenContour.nodes.length > 0) {
          handleUndoPartPenNode();
        } else {
          handleUndo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && isY) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Save shortcut
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyS' || e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleExportLibraryJson();
        return;
      }

      // Tool Switching Shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.code === 'KeyV' || e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          setToolMode('select');
        } else if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          setToolMode('pen');
        } else if (e.code === 'KeyB' || e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          setToolMode('brush');
        } else if (e.code === 'KeyE' || e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          setToolMode('eraser');
        } else if (e.code === 'KeyH' || e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          setToolMode('hand');
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          if (activePenContour) {
            handleUndoPartPenNode();
          } else if (selectedNodeId) {
            handleDeleteSelectedNode();
          } else if (selectedContourId) {
            handleDeleteSelectedContour();
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (activePenContour && activePenContour.nodes.length >= 2) {
            handleFinishPartPenContour(true);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (activePenContour) {
            handleResetPartPenContour();
          } else {
            setSelectedNodeId(null);
            setSelectedContourId(null);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    activePenContour,
    selectedNodeId,
    selectedContourId,
    undoStack,
    redoStack,
    activePart,
  ]);

  // History management
  const commitPartChange = (newContours: PathContour[]) => {
    if (!activePart) return;
    setUndoStack((prev) => [...prev.slice(-25), activePart.contours]);
    setRedoStack([]);
    setParts((prev) =>
      prev.map((p) =>
        p.id === activePart.id
          ? { ...p, contours: newContours, updatedAt: Date.now() }
          : p
      )
    );
  };

  const handleUndo = () => {
    if (!activePart || undoStack.length === 0) return;
    const prevContours = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, activePart.contours]);
    setParts((prev) =>
      prev.map((p) =>
        p.id === activePart.id
          ? { ...p, contours: prevContours, updatedAt: Date.now() }
          : p
      )
    );
  };

  const handleRedo = () => {
    if (!activePart || redoStack.length === 0) return;
    const nextContours = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, activePart.contours]);
    setParts((prev) =>
      prev.map((p) =>
        p.id === activePart.id
          ? { ...p, contours: nextContours, updatedAt: Date.now() }
          : p
      )
    );
  };

  // Create New Part
  const handleCreateNewPart = (category: PartCategory = 'hen') => {
    const newId = generateId();
    const newPart: CustomPart = {
      id: newId,
      name: `新規パーツ_${parts.length + 1}`,
      category: category === 'all' ? 'hen' : category,
      description: '',
      contours: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setParts((prev) => [newPart, ...prev]);
    setSelectedPartId(newId);
    notify('新しいパーツを作成しました', 'success');
  };

  // Duplicate Part
  const handleDuplicatePart = (part: CustomPart, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newId = generateId();
    const clonedContours: PathContour[] = part.contours.map((c) => ({
      ...c,
      id: generateId(),
      nodes: c.nodes.map((n) => ({
        ...n,
        id: generateId(),
        handleIn: n.handleIn ? { ...n.handleIn } : null,
        handleOut: n.handleOut ? { ...n.handleOut } : null,
      })),
    }));

    const cloned: CustomPart = {
      ...part,
      id: newId,
      name: `${part.name} (コピー)`,
      contours: clonedContours,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setParts((prev) => [cloned, ...prev]);
    setSelectedPartId(newId);
    notify(`「${part.name}」を複製しました`, 'success');
  };

  // Delete Part
  const handleDeletePart = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = parts.find((p) => p.id === id);
    if (!target) return;
    if (parts.length <= 1) {
      notify('最後のパーツは削除できません', 'warning');
      return;
    }
    setParts((prev) => prev.filter((p) => p.id !== id));
    if (selectedPartId === id) {
      const remaining = parts.filter((p) => p.id !== id);
      setSelectedPartId(remaining[0]?.id || '');
    }
    notify(`「${target.name}」を削除しました`, 'info');
  };

  // Node & Path Direct Editing Helpers
  const getSelectedNodeType = (): 'smooth' | 'corner' | null => {
    if (!activePart || !selectedContourId || !selectedNodeId) return null;
    const c = activePart.contours.find((item) => item.id === selectedContourId);
    const n = c?.nodes.find((item) => item.id === selectedNodeId);
    return n?.type || 'corner';
  };

  const getContourNodeCount = (): number => {
    if (!activePart || !selectedContourId) return 0;
    const c = activePart.contours.find((item) => item.id === selectedContourId);
    return c?.nodes.length || 0;
  };

  const handleDeleteSelectedNode = () => {
    if (!activePart || !selectedNodeId || !selectedContourId) return;
    const updatedContours: PathContour[] = [];
    for (const contour of activePart.contours) {
      if (contour.id !== selectedContourId) {
        updatedContours.push(contour);
        continue;
      }
      const remainingNodes = contour.nodes.filter((n) => n.id !== selectedNodeId);
      const minNodes = contour.closed ? 3 : 2;
      if (remainingNodes.length >= minNodes) {
        updatedContours.push({
          ...contour,
          nodes: remainingNodes,
        });
      }
    }
    commitPartChange(updatedContours);
    setSelectedNodeId(null);
    notify('ノードを削除しました', 'info');
  };

  const handleToggleSelectedNodeType = () => {
    if (!activePart || !selectedNodeId || !selectedContourId) return;
    const updatedContours = activePart.contours.map((contour) => {
      if (contour.id !== selectedContourId) return contour;
      return {
        ...contour,
        nodes: contour.nodes.map((node) => {
          if (node.id !== selectedNodeId) return node;
          if (node.type === 'smooth') {
            return {
              ...node,
              type: 'corner' as const,
              handleIn: null,
              handleOut: null,
            };
          } else {
            const handleLength = 40;
            return {
              ...node,
              type: 'smooth' as const,
              handleIn: { x: node.x - handleLength, y: node.y },
              handleOut: { x: node.x + handleLength, y: node.y },
            };
          }
        }),
      };
    });
    commitPartChange(updatedContours);
    notify('ノードの種類を切り替えました', 'info');
  };

  const handleDeleteSelectedContour = () => {
    if (!activePart || !selectedContourId) return;
    const updated = activePart.contours.filter((c) => c.id !== selectedContourId);
    if (updated.length === 0 && activeBrushPathRef.current) {
      activeBrushPathRef.current.setAttribute('d', '');
    }
    commitPartChange(updated);
    setSelectedContourId(null);
    setSelectedNodeId(null);
    notify('輪郭パスを削除しました', 'info');
  };

  const handleDuplicateSelectedContour = () => {
    if (!activePart || !selectedContourId) return;
    const target = activePart.contours.find((c) => c.id === selectedContourId);
    if (!target) return;
    const offset = 24;
    const newId = generateId();
    const cloned: PathContour = {
      id: newId,
      closed: target.closed,
      nodes: target.nodes.map((n) => ({
        id: generateId(),
        x: n.x + offset,
        y: n.y + offset,
        type: n.type,
        handleIn: n.handleIn ? { x: n.handleIn.x + offset, y: n.handleIn.y + offset } : null,
        handleOut: n.handleOut ? { x: n.handleOut.x + offset, y: n.handleOut.y + offset } : null,
      })),
    };
    commitPartChange([...activePart.contours, cloned]);
    setSelectedContourId(newId);
    setSelectedNodeId(null);
    notify('輪郭パスを複製しました', 'success');
  };

  const handleFlipSelectedContour = (dir: 'h' | 'v') => {
    if (!activePart || !selectedContourId) return;
    const target = activePart.contours.find((c) => c.id === selectedContourId);
    if (!target) return;
    const flipped = dir === 'h' ? flipMultipleContoursH([target]) : flipMultipleContoursV([target]);
    const updated = activePart.contours.map((c) => (c.id === selectedContourId ? { ...flipped[0], id: c.id } : c));
    commitPartChange(updated);
    notify(`輪郭パスを${dir === 'h' ? '左右' : '上下'}反転しました`, 'info');
  };

  const handleSmoothSelectedContour = () => {
    if (!activePart || !selectedContourId) return;
    const target = activePart.contours.find((c) => c.id === selectedContourId);
    if (!target) return;
    const smoothedResult = smoothStrokeContour(target, { level: 'standard', preserveCorners: true });
    const updated = activePart.contours.map((c) => (c.id === selectedContourId ? smoothedResult.contour : c));
    commitPartChange(updated);
    notify('パスを平滑化（滑らか化）しました', 'success');
  };

  // Extract from Project Glyph
  const handleExtractFromGlyph = (glyph: GlyphData) => {
    if (!glyph.contours || glyph.contours.length === 0) {
      notify(`「${glyph.char}」には描画データがありません`, 'warning');
      return;
    }
    const newId = generateId();
    const clonedContours: PathContour[] = glyph.contours.map((c) => ({
      ...c,
      id: generateId(),
      nodes: c.nodes.map((n) => ({
        ...n,
        id: generateId(),
        handleIn: n.handleIn ? { ...n.handleIn } : null,
        handleOut: n.handleOut ? { ...n.handleOut } : null,
      })),
    }));

    const newPart: CustomPart = {
      id: newId,
      name: `パーツ_${glyph.char || glyph.name}`,
      category: 'other',
      description: `文字「${glyph.char}」から取り込んだ作字パーツ`,
      contours: clonedContours,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setParts((prev) => [newPart, ...prev]);
    setSelectedPartId(newId);
    setShowExtractModal(false);
    notify(`文字「${glyph.char}」からパーツを作成しました`, 'success');
  };

  // Insert to current editing glyph
  const handleInsertToGlyph = (closeAfter: boolean = false) => {
    if (!activePart || !activePart.contours || activePart.contours.length === 0) {
      notify('パーツに輪郭データがありません', 'warning');
      return;
    }
    const cloned: PathContour[] = activePart.contours.map((c) => ({
      ...c,
      id: generateId(),
      nodes: c.nodes.map((n) => ({
        ...n,
        id: generateId(),
        handleIn: n.handleIn ? { ...n.handleIn } : null,
        handleOut: n.handleOut ? { ...n.handleOut } : null,
      })),
    }));

    const positioned = transformContoursForPlacement(cloned, insertPlacement, activePart.category);
    if (targetChar && targetChar !== selectedChar && onBatchInsertToGlyphs) {
      onBatchInsertToGlyphs(positioned, [targetChar]);
    } else {
      onInsertToCurrentGlyph(positioned);
    }
    notify(`「${activePart.name}」を「${targetChar || selectedChar}」に挿入しました`, 'success');
    if (closeAfter) {
      onClose();
    }
  };

  // Batch insert active part to multiple glyphs at once
  const handleBatchInsertToGlyphs = (closeAfter: boolean = false) => {
    if (!activePart || !activePart.contours || activePart.contours.length === 0) {
      notify('パーツに輪郭データがありません', 'warning');
      return;
    }

    const typedChars = Array.from(new Set(batchCharsInput.split('').filter((c) => c.trim())));
    const allTargetChars = Array.from(new Set([...selectedBatchChars, ...typedChars]));

    if (allTargetChars.length === 0) {
      notify('一括挿入の対象となる漢字を候補から選択するか、入力してください', 'warning');
      return;
    }

    const cloned: PathContour[] = activePart.contours.map((c) => ({
      ...c,
      id: generateId(),
      nodes: c.nodes.map((n) => ({
        ...n,
        id: generateId(),
        handleIn: n.handleIn ? { ...n.handleIn } : null,
        handleOut: n.handleOut ? { ...n.handleOut } : null,
      })),
    }));

    const positioned = transformContoursForPlacement(cloned, insertPlacement, activePart.category);

    if (onBatchInsertToGlyphs) {
      onBatchInsertToGlyphs(positioned, allTargetChars);
    } else {
      allTargetChars.forEach(() => {
        onInsertToCurrentGlyph(positioned);
      });
    }

    notify(`「${activePart.name}」を ${allTargetChars.length} 文字 (${allTargetChars.slice(0, 6).join('')}${allTargetChars.length > 6 ? '…' : ''}) に一括挿入しました`, 'success');
    if (closeAfter) {
      onClose();
    }
  };

  // Batch insert a radical directly from database to all kanji in its list
  const handleBatchInsertRadicalEntry = async (radical: RadicalEntry) => {
    if (!radical.kanjiList || radical.kanjiList.length === 0) {
      notify('対象の漢字リストがありません', 'warning');
      return;
    }

    let contoursToUse: PathContour[] = [];
    const placement = (radical.category === 'basic' ? 'auto' : radical.category) as RadicalPlacement;

    // 1. If currently active part in studio matches or is loaded with contours
    if (activePart && activePart.contours && activePart.contours.length > 0) {
      contoursToUse = JSON.parse(JSON.stringify(activePart.contours));
    } else {
      // 2. Otherwise load extracted or fallback contours for this radical
      try {
        const extracted = await getOrExtractRadicalContours(
          radical.char,
          'full',
          selectedFontStyle.fontFamily,
          selectedFontStyle.fontWeight
        );
        if (extracted && extracted.length > 0) {
          contoursToUse = JSON.parse(JSON.stringify(extracted));
        }
      } catch {
        // Fallback below
      }

      if (contoursToUse.length === 0) {
        const fallbackRad = KANJI_RADICALS.find((r) => r.name === radical.name || r.char === radical.char);
        if (fallbackRad && fallbackRad.contours && fallbackRad.contours.length > 0) {
          contoursToUse = JSON.parse(JSON.stringify(fallbackRad.contours));
        }
      }
    }

    if (contoursToUse.length === 0) {
      notify(`部首「${radical.name}」の輪郭データが見つかりません。まずキャンバスで作字するか部首を読み込んでください`, 'warning');
      return;
    }

    const cloned: PathContour[] = contoursToUse.map((c) => ({
      ...c,
      id: generateId(),
      nodes: c.nodes.map((n) => ({
        ...n,
        id: generateId(),
        handleIn: n.handleIn ? { ...n.handleIn } : null,
        handleOut: n.handleOut ? { ...n.handleOut } : null,
      })),
    }));

    const positioned = transformContoursForPlacement(
      cloned,
      placement,
      radical.category === 'basic' ? 'other' : (radical.category as PartCategory)
    );

    if (onBatchInsertToGlyphs) {
      onBatchInsertToGlyphs(positioned, radical.kanjiList);
    } else {
      radical.kanjiList.forEach(() => {
        onInsertToCurrentGlyph(positioned);
      });
    }

    notify(
      `部首「${radical.name}」を収録漢字 ${radical.kanjiList.length} 文字（${radical.kanjiList.slice(0, 6).join('')}${
        radical.kanjiList.length > 6 ? '…' : ''
      }）に一括配置しました（既存文字は輪郭を追加合成）`,
      'success'
    );
  };

  // Extract directly from currently edited character in canvas
  const handleExtractFromCurrentGlyph = () => {
    const currentGlyph = project.glyphs?.[selectedUnicode];
    if (!currentGlyph || !currentGlyph.contours || currentGlyph.contours.length === 0) {
      notify(`編集中文字「${selectedChar}」には描画された輪郭がありません`, 'warning');
      return;
    }
    const newId = generateId();
    const clonedContours: PathContour[] = currentGlyph.contours.map((c) => ({
      ...c,
      id: generateId(),
      nodes: c.nodes.map((n) => ({
        ...n,
        id: generateId(),
        handleIn: n.handleIn ? { ...n.handleIn } : null,
        handleOut: n.handleOut ? { ...n.handleOut } : null,
      })),
    }));

    const newPart: CustomPart = {
      id: newId,
      name: `パーツ_${selectedChar || currentGlyph.name || '文字'}`,
      category: 'other',
      description: `文字「${selectedChar}」から取り込んだ作字パーツ`,
      contours: clonedContours,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setParts((prev) => [newPart, ...prev]);
    setSelectedPartId(newId);
    setLeftSidebarTab('custom');
    notify(`編集中文字「${selectedChar}」の輪郭（${clonedContours.length}本）をパーツとして取り込みました`, 'success');
  };

  // Load a preset radical into canvas for editing / fine-tuning with high-fidelity font vector extraction
  const handleLoadPreset = async (preset: StudioRadicalPresetItem) => {
    setIsLoadingPreset(true);
    try {
      // Extract pristine high-resolution vector contours from the selected font style
      let contours = await getOrExtractRadicalContours(
        preset.char,
        'full',
        selectedFontStyle.fontFamily,
        selectedFontStyle.fontWeight
      );
      if (!contours || contours.length === 0) {
        const fallbackRad = KANJI_RADICALS.find((r) => r.name === preset.name || r.char === preset.char);
        contours = fallbackRad?.contours || [];
      }

      const styleLabel = selectedFontStyle.label;
      const partName = `${preset.name} (${styleLabel})`;

      // Check if this part already exists with this exact name or base name
      let targetPart = parts.find((p) => p.name === partName || p.name === preset.name);
      if (targetPart) {
        // Update its contours with the newly extracted high-quality contours
        const updatedParts = parts.map((p) =>
          p.id === targetPart!.id
            ? { ...p, contours: JSON.parse(JSON.stringify(contours)), description: `${preset.name}・${selectedFontStyle.subLabel}の高品質ベクター部首`, updatedAt: Date.now() }
            : p
        );
        setParts(updatedParts);
      } else {
        const newPart: CustomPart = {
          id: generateId(),
          name: partName,
          category: preset.category,
          description: `${preset.name}・${selectedFontStyle.subLabel}の高品質ベクター部首`,
          contours: JSON.parse(JSON.stringify(contours)),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setParts((prev) => [newPart, ...prev]);
        targetPart = newPart;
      }
      setSelectedPartId(targetPart.id);
      notify(`部首「${preset.name}」を${selectedFontStyle.label}の高精度ベクターとしてキャンバスに読み込みました`, 'success');
    } catch (err) {
      console.error('Failed to extract preset contours:', err);
      notify('部首ベクターの抽出に失敗しました', 'error');
    } finally {
      setIsLoadingPreset(false);
    }
  };

  // Direct 1-click insertion from Preset into current editing character
  const handleInsertPresetDirectly = async (
    preset: StudioRadicalPresetItem,
    placement: RadicalPlacement = 'original',
    closeAfter: boolean = false
  ) => {
    if (insertingPresetId) return;
    setInsertingPresetId(preset.id);
    try {
      let contours = await getOrExtractRadicalContours(
        preset.char,
        'full',
        selectedFontStyle.fontFamily,
        selectedFontStyle.fontWeight
      );
      if (!contours || contours.length === 0) {
        const fallbackRad = KANJI_RADICALS.find((r) => r.name === preset.name || r.char === preset.char);
        contours = fallbackRad?.contours || [];
      }

      const positioned = transformContoursForPlacement(contours, placement, preset.category);
      if (targetChar && targetChar !== selectedChar && onBatchInsertToGlyphs) {
        onBatchInsertToGlyphs(positioned, [targetChar]);
      } else {
        onInsertToCurrentGlyph(positioned);
      }
      notify(`部首「${preset.name} (${selectedFontStyle.label})」を文字「${targetChar || selectedChar}」に挿入しました`, 'success');
      if (closeAfter) {
        onClose();
      }
    } catch {
      notify('部首の挿入に失敗しました', 'error');
    } finally {
      setInsertingPresetId(null);
    }
  };

  // Quick insertion with specified placement from current active part
  const handleQuickInsertPlacement = (placement: RadicalPlacement, closeAfter: boolean = false) => {
    if (!activePart || !activePart.contours || activePart.contours.length === 0) {
      notify('挿入する輪郭データがありません', 'warning');
      return;
    }
    const cloned: PathContour[] = JSON.parse(JSON.stringify(activePart.contours));
    const positioned = transformContoursForPlacement(cloned, placement, activePart.category);
    if (targetChar && targetChar !== selectedChar && onBatchInsertToGlyphs) {
      onBatchInsertToGlyphs(positioned, [targetChar]);
    } else {
      onInsertToCurrentGlyph(positioned);
    }
    const placementNames: Record<RadicalPlacement, string> = {
      auto: '自動判別',
      original: '原寸のまま',
      hen: '偏 (左46%)',
      tsukuri: '旁 (右46%)',
      kanmuri: '冠 (上36%)',
      ashi: '脚 (下36%)',
      center_small: '中央縮小 (60%)',
    };
    notify(`「${activePart.name}」を【${placementNames[placement] || placement}】として「${targetChar || selectedChar}」に挿入しました`, 'success');
    if (closeAfter) {
      onClose();
    }
  };

  // Upgrade / refresh default initial parts with authentic typography contours
  const handleUpgradeDefaultParts = async (
    fontStyle: FontStyleOption = selectedFontStyle,
    silent: boolean = false
  ) => {
    if (!silent) {
      notify(`初期部首パーツを「${fontStyle.label}」の高精度ベクターに更新しています...`, 'info');
    }
    try {
      const updatedParts = [...parts];
      let updatedCount = 0;

      for (const def of INITIAL_STUDIO_RADICAL_DEFS) {
        const contours = await getOrExtractRadicalContours(
          def.char,
          'full',
          fontStyle.fontFamily,
          fontStyle.fontWeight
        );
        if (contours && contours.length > 0) {
          const idx = updatedParts.findIndex(
            (p) => p.name === def.name || p.name.startsWith(def.name.split(' ')[0])
          );
          if (idx >= 0) {
            updatedParts[idx] = {
              ...updatedParts[idx],
              contours: JSON.parse(JSON.stringify(contours)),
              description: `${def.description} (${fontStyle.label}・高精度ベクター)`,
              updatedAt: Date.now(),
            };
            updatedCount++;
          } else {
            updatedParts.push({
              id: generateId(),
              name: def.name,
              category: def.category as PartCategory,
              description: `${def.description} (${fontStyle.label}・高精度ベクター)`,
              contours: JSON.parse(JSON.stringify(contours)),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            updatedCount++;
          }
        }
      }

      setParts(updatedParts);
      if (!silent) {
        notify(`${updatedCount}件の部首パーツを高精度フォント（${fontStyle.label}）ベクターに刷新しました！`, 'success');
      }
    } catch (err) {
      console.error(err);
      if (!silent) {
        notify('部首パーツの更新に失敗しました', 'error');
      }
    }
  };

  // Import all standard kanji radicals into parts library with pristine font vectors
  const handleImportDefaultRadicals = async () => {
    setIsImportingAll(true);
    notify(`高品質な定番部首（${selectedFontStyle.label}）を順次取り込んでいます...`, 'info');
    try {
      const existingNames = new Set(parts.map((p) => p.name));
      const toAdd: CustomPart[] = [];

      for (const item of STUDIO_RADICAL_PRESETS) {
        const partName = `${item.name} (${selectedFontStyle.label})`;
        if (!existingNames.has(item.name) && !existingNames.has(partName)) {
          let contours: PathContour[] = [];
          try {
            contours = await getOrExtractRadicalContours(
              item.char,
              'full',
              selectedFontStyle.fontFamily,
              selectedFontStyle.fontWeight
            );
          } catch {
            // fallback
          }
          if (contours && contours.length > 0) {
            toAdd.push({
              id: generateId(),
              name: partName,
              category: item.category,
              description: `${item.name} (${item.char}) - ${selectedFontStyle.subLabel}`,
              contours,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
        }
      }

      if (toAdd.length === 0) {
        notify('すべての定番部首はすでにマイパーツに登録されています', 'info');
        return;
      }

      setParts((prev) => [...toAdd, ...prev]);
      notify(`${toAdd.length}件の高品質定番部首（${selectedFontStyle.label}）をマイパーツに取り込みました！`, 'success');
    } catch (e) {
      notify('部首の一括取り込み中にエラーが発生しました', 'error');
    } finally {
      setIsImportingAll(false);
    }
  };

  const hasUpgradedDefaultsRef = useRef(false);

  // Auto-upgrade legacy low-quality default parts on open (at most once per session)
  useEffect(() => {
    if (!isOpen || hasUpgradedDefaultsRef.current) return;
    hasUpgradedDefaultsRef.current = true;

    const hasLowQualityDefaults = parts.some((p) => {
      const isInitialPart = INITIAL_STUDIO_RADICAL_DEFS.some(
        (d) => p.name === d.name || p.name.startsWith(d.name.split(' ')[0])
      );
      if (!isInitialPart || !p.contours || p.contours.length === 0) return false;
      const totalNodes = p.contours.reduce((acc, c) => acc + (c.nodes?.length || 0), 0);
      const hasSmooth = p.contours.some((c) =>
        c.nodes?.some((n) => n.type === 'smooth' && (n.handleIn || n.handleOut))
      );
      // Legacy hand-coded contours had very few nodes and no smooth bezier handles
      return totalNodes < 30 || !hasSmooth;
    });

    if (hasLowQualityDefaults) {
      handleUpgradeDefaultParts(selectedFontStyle, true);
    }
  }, [isOpen]);

  // Export parts library as JSON
  const handleExportLibraryJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(parts, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `font_radical_parts_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    notify('部首パーツライブラリをJSON形式で保存しました', 'success');
  };

  // Import parts library from JSON
  const handleImportLibraryJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          setParts((prev) => [...json, ...prev]);
          notify(`${json.length}件のパーツをライブラリに読み込みました`, 'success');
        } else {
          notify('無効なパーツJSONファイルです', 'error');
        }
      } catch {
        notify('JSONファイルの解析に失敗しました', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Export current part as SVG
  const handleExportPartSvg = () => {
    if (!activePart) return;
    const svgPath = contoursToSvgPath(activePart.contours);
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">\n  <path d="${svgPath}" fill="#000000" fill-rule="evenodd" />\n</svg>`;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePart.name.replace(/[^a-zA-Z0-9_\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff-]/g, '_')}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify(`「${activePart.name}」をSVG出力しました`, 'success');
  };

  // Import SVG into current part
  const handleImportSvgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePart) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const res = parseSvgStringToContours(text, true);
        if (res.contours.length === 0) {
          notify('SVGファイル内に有効なベクターパスが見つかりませんでした', 'warning');
          return;
        }
        commitPartChange(res.contours);
        notify(`SVGから ${res.contours.length} 本の輪郭を読み込みました`, 'success');
      } catch {
        notify('SVGファイルの読み込みに失敗しました', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Screen to Canvas coordinate conversion helper
  const getCanvasCoordsFromClient = (clientX: number, clientY: number): Point => {
    if (!svgCanvasRef.current) return { x: 0, y: 0 };
    const rect = svgCanvasRef.current.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    return {
      x: Math.round((cx - pan.x) / zoom),
      y: Math.round((cy - pan.y) / zoom),
    };
  };

  // Screen to Canvas coordinate conversion
  const getCanvasCoords = (e: React.PointerEvent<SVGSVGElement>): Point => {
    return getCanvasCoordsFromClient(e.clientX, e.clientY);
  };

  // Shape helper
  const getShapeContours = (mode: ToolMode, p1: Point, p2: Point): PathContour[] => {
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    const width = Math.max(16, maxX - minX);
    const height = Math.max(16, maxY - minY);
    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;
    const rx = width / 2;
    const ry = height / 2;

    switch (mode) {
      case 'rect':
      case 'square':
        return [createRectContour(minX, minY, maxX, maxY)];
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
      default:
        return [createRectContour(minX, minY, maxX, maxY)];
    }
  };

  // Wheel zoom & pan on canvas
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    let dx = e.deltaX;
    let dy = e.deltaY;
    if (e.deltaMode === 1) {
      dx *= 20;
      dy *= 20;
    } else if (e.deltaMode === 2) {
      dx *= 400;
      dy *= 400;
    }

    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = dy < 0 ? 1.12 : 0.88;
      const newZoom = Math.max(0.15, Math.min(3.0, zoom * zoomFactor));
      if (!svgCanvasRef.current) return;
      const rect = svgCanvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setPan({
        x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
        y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
      });
      setZoom(newZoom);
    } else {
      setPan((prev) => ({
        x: prev.x - dx,
        y: prev.y - dy,
      }));
    }
  };

  // Pointer event handlers on Part Canvas
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!activePart) return;

    // Multi-touch tracking for pinch-to-zoom and two-finger pan
    if (e.pointerType === 'touch') {
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activeTouchesRef.current.size >= 2) {
        const pts = Array.from(activeTouchesRef.current.values()) as { x: number; y: number }[];
        touchPinchInitialDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        touchPinchInitialZoomRef.current = zoom;
        touchPinchInitialPanRef.current = { ...pan };
        touchPinchInitialMidpointRef.current = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
        };
        setIsPanning(false);
        return;
      }
    }

    const pos = getCanvasCoords(e);

    // Hand tool / Middle click pan / Space key pan
    if (toolMode === 'hand' || e.button === 1 || e.spaceKey) {
      try {
        (e.target as Element).setPointerCapture?.(e.pointerId);
      } catch {}
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    // Brush Tool
    if (toolMode === 'brush') {
      try {
        (e.target as Element).setPointerCapture?.(e.pointerId);
      } catch {}
      let initialPressure = 0.5;
      if (e.pressure && e.pressure > 0) {
        initialPressure = e.pressure;
      } else if (pressureSensitivity === 'off') {
        initialPressure = 1.0;
      }
      mouseSmoothSpeedRef.current = 0.5;
      const firstPt: StrokePoint = {
        x: pos.x,
        y: pos.y,
        pressure: initialPressure,
        time: e.timeStamp || Date.now(),
        pointerType: e.pointerType,
      };
      brushStrokePointsRef.current = [firstPt];
      setIsDrawingStroke(true);
      if (activeBrushPathRef.current) {
        activeBrushPathRef.current.setAttribute('d', '');
      }
      return;
    }

    // Shape Tools
    const isShape = [
      'rect',
      'ellipse',
      'triangle',
      'star',
      'heart',
      'sparkle',
      'starburst',
      'diamond',
    ].includes(toolMode);

    if (isShape) {
      setShapeStartPoint(pos);
      setShapeCurrentPoint(pos);
      return;
    }

    // Eraser Tool with pointer capture & live modes
    if (toolMode === 'eraser') {
      try {
        (e.target as Element).setPointerCapture?.(e.pointerId);
      } catch {}
      isErasingRef.current = true;
      eraserStrokePointsRef.current = [pos];
      setEraserHoverPos(pos);

      if (eraserMode === 'cut') {
        const d = `M ${pos.x} ${pos.y} L ${pos.x + 0.1} ${pos.y}`;
        activeEraserSvgDRef.current = d;
        if (activeEraserPathRef.current) {
          activeEraserPathRef.current.setAttribute('d', d);
        }
      } else {
        const remaining = eraseContoursAtPoint(activePart.contours, pos, eraserRadius, eraserMode);
        if (remaining.length !== activePart.contours.length) {
          commitPartChange(remaining);
        }
      }
      return;
    }

    // Pen Tool
    if (toolMode === 'pen') {
      if (!activePenContour) {
        const newNode: BezierNode = {
          id: generateId(),
          x: pos.x,
          y: pos.y,
          handleIn: null,
          handleOut: null,
          type: 'corner',
        };
        setActivePenContour({
          id: generateId(),
          closed: false,
          nodes: [newNode],
        });
        setSelectedNodeId(newNode.id);
        isPenDraggingHandleRef.current = true;
        setDragStartPoint(pos);
      } else {
        // Check if clicking near first node to close contour
        const firstNode = activePenContour.nodes[0];
        const distToFirst = Math.hypot(pos.x - firstNode.x, pos.y - firstNode.y);

        if (distToFirst < 22 / zoom && activePenContour.nodes.length >= 2) {
          const finishedContour: PathContour = {
            ...activePenContour,
            closed: true,
          };
          commitPartChange([...activePart.contours, finishedContour]);
          setActivePenContour(null);
          setSelectedContourId(finishedContour.id);
          setSelectedNodeId(null);
          setToolMode('select');
        } else {
          const newNode: BezierNode = {
            id: generateId(),
            x: pos.x,
            y: pos.y,
            handleIn: null,
            handleOut: null,
            type: 'corner',
          };
          setActivePenContour({
            ...activePenContour,
            nodes: [...activePenContour.nodes, newNode],
          });
          setSelectedNodeId(newNode.id);
          isPenDraggingHandleRef.current = true;
          setDragStartPoint(pos);
        }
      }
      return;
    }

    // Select Tool
    if (toolMode === 'select') {
      dragStartContoursRef.current = JSON.parse(JSON.stringify(activePart.contours));
      const hitRadius = Math.max(12, 16 / zoom);

      // 1. Check Handle Hits on currently selected node first
      if (selectedNodeId && selectedContourId) {
        const targetContour = activePart.contours.find((c) => c.id === selectedContourId);
        const targetNode = targetContour?.nodes.find((n) => n.id === selectedNodeId);
        if (targetNode) {
          if (targetNode.handleIn) {
            const dIn = Math.hypot(pos.x - targetNode.handleIn.x, pos.y - targetNode.handleIn.y);
            if (dIn < hitRadius) {
              setSelectedHandleType('handleIn');
              setIsDraggingNode(true);
              setDragStartPoint(pos);
              return;
            }
          }
          if (targetNode.handleOut) {
            const dOut = Math.hypot(pos.x - targetNode.handleOut.x, pos.y - targetNode.handleOut.y);
            if (dOut < hitRadius) {
              setSelectedHandleType('handleOut');
              setIsDraggingNode(true);
              setDragStartPoint(pos);
              return;
            }
          }
        }
      }

      // 2. Check node hits
      let foundNode = false;
      for (const contour of activePart.contours) {
        for (const node of contour.nodes) {
          const distNode = Math.hypot(pos.x - node.x, pos.y - node.y);
          if (distNode < hitRadius) {
            setSelectedContourId(contour.id);
            setSelectedNodeId(node.id);
            setSelectedHandleType('node');
            setIsDraggingNode(true);
            setDragStartPoint(pos);
            foundNode = true;
            break;
          }
        }
        if (foundNode) break;
      }

      // 3. Check contour hits (Proximity to stroke segments for accurate selection)
      if (!foundNode) {
        const contourHitThreshold = Math.max(16, 24 / zoom);
        let clickedContour = activePart.contours.find((contour) =>
          isPointNearContour(pos, contour, contourHitThreshold)
        );

        // Fallback: AABB check for filled interior of closed shapes
        if (!clickedContour) {
          clickedContour = activePart.contours.find((contour) => {
            const bbox = getContoursBoundingBox([contour]);
            return (
              pos.x >= bbox.minX &&
              pos.x <= bbox.maxX &&
              pos.y >= bbox.minY &&
              pos.y <= bbox.maxY
            );
          });
        }

        if (clickedContour) {
          setSelectedContourId(clickedContour.id);
          setSelectedNodeId(null);
          setIsDraggingContour(true);
          setDragStartPoint(pos);
        } else {
          setSelectedContourId(null);
          setSelectedNodeId(null);
        }
        setSelectedHandleType(null);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    // Multi-touch gestures (pinch-zoom and pan)
    if (e.pointerType === 'touch') {
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activeTouchesRef.current.size >= 2 && touchPinchInitialDistRef.current) {
        const pts = Array.from(activeTouchesRef.current.values()) as { x: number; y: number }[];
        const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const scale = newDist / touchPinchInitialDistRef.current;
        const newZoom = Math.max(0.15, Math.min(3.5, touchPinchInitialZoomRef.current * scale));

        const currMid = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
        };
        const dMidX = currMid.x - touchPinchInitialMidpointRef.current.x;
        const dMidY = currMid.y - touchPinchInitialMidpointRef.current.y;

        if (svgCanvasRef.current) {
          const rect = svgCanvasRef.current.getBoundingClientRect();
          const midX = touchPinchInitialMidpointRef.current.x - rect.left;
          const midY = touchPinchInitialMidpointRef.current.y - rect.top;
          setPan({
            x: midX - (midX - touchPinchInitialPanRef.current.x) * (newZoom / touchPinchInitialZoomRef.current) + dMidX,
            y: midY - (midY - touchPinchInitialPanRef.current.y) * (newZoom / touchPinchInitialZoomRef.current) + dMidY,
          });
        }
        setZoom(newZoom);
        return;
      }
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    const rawPos = getCanvasCoords(e);
    const snapped = snapToGuides(rawPos);

    if (isDraggingNode || isDraggingContour || toolMode === 'pen' || shapeStartPoint) {
      if (activeSnapLines.x !== snapped.snapX || activeSnapLines.y !== snapped.snapY) {
        setActiveSnapLines({ x: snapped.snapX, y: snapped.snapY });
      }
    } else if (activeSnapLines.x !== null || activeSnapLines.y !== null) {
      setActiveSnapLines({ x: null, y: null });
    }

    const pos = snapped.point;

    // Track eraser hover position for the high-visibility circular reticle
    if (toolMode === 'eraser') {
      setEraserHoverPos(pos);
    }

    if (toolMode === 'pen') {
      if (!penMousePos || Math.hypot(penMousePos.x - pos.x, penMousePos.y - pos.y) > 0.5) {
        setPenMousePos(pos);
      }
    }

    // Eraser continuous sweep while dragging
    if (isErasingRef.current && toolMode === 'eraser' && activePart) {
      const prev = eraserStrokePointsRef.current[eraserStrokePointsRef.current.length - 1] || pos;
      eraserStrokePointsRef.current.push(pos);

      if (eraserMode === 'cut') {
        const pts = eraserStrokePointsRef.current;
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) {
          d += ` L ${pts[i].x} ${pts[i].y}`;
        }
        activeEraserSvgDRef.current = d;
        if (activeEraserPathRef.current) {
          activeEraserPathRef.current.setAttribute('d', d);
        }
      } else {
        const remaining = eraseContoursAtPoint(activePart.contours, pos, eraserRadius, eraserMode, prev);
        if (remaining.length !== activePart.contours.length) {
          setParts((prevParts) =>
            prevParts.map((p) => (p.id === activePart.id ? { ...p, contours: remaining } : p))
          );
        }
      }
      return;
    }

    // Live Brush Stroke Engine
    if (isDrawingStroke && toolMode === 'brush') {
      const native = e.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
      const events = native.getCoalescedEvents ? native.getCoalescedEvents() : [native];
      
      const lastPt = brushStrokePointsRef.current[brushStrokePointsRef.current.length - 1];
      for (const evt of events) {
        const rawPos = getCanvasCoordsFromClient(evt.clientX, evt.clientY);
        let p = evt.pressure;
        const isMouse = (evt.pointerType || e.pointerType) === 'mouse';
        if (!p || p === 0 || isMouse) {
          if (pressureSensitivity === 'off') {
            p = 1.0;
          } else if (lastPt) {
            const dt = Math.max(1, (evt.timeStamp || Date.now()) - (lastPt.time || 0));
            const dist = Math.hypot(rawPos.x - lastPt.x, rawPos.y - lastPt.y);
            const instantSpeed = dist / dt;
            const emaAlpha = 0.25;
            mouseSmoothSpeedRef.current = emaAlpha * instantSpeed + (1 - emaAlpha) * mouseSmoothSpeedRef.current;
            const factor = pressureSensitivity === 'high' ? 0.7 : pressureSensitivity === 'low' ? 0.25 : 0.45;
            p = Math.max(0.2, Math.min(1.0, 1.0 - mouseSmoothSpeedRef.current * factor));
          } else {
            p = 0.5;
          }
        }
        brushStrokePointsRef.current.push({
          x: rawPos.x,
          y: rawPos.y,
          pressure: p,
          time: evt.timeStamp || Date.now(),
          pointerType: evt.pointerType || e.pointerType,
        });
      }

      // RAF Throttled DOM path update for maximum frame rate
      if (!brushRafIdRef.current) {
        brushRafIdRef.current = requestAnimationFrame(() => {
          brushRafIdRef.current = null;
          if (brushStrokePointsRef.current.length >= 2 && activeBrushPathRef.current) {
            const pts = isStraightMode || e.shiftKey
              ? [
                  brushStrokePointsRef.current[0],
                  brushStrokePointsRef.current[brushStrokePointsRef.current.length - 1],
                ]
              : brushStrokePointsRef.current;
            const contour = strokePointsToOutline(pts, brushWidth, brushStyle);
            if (contour && contour.nodes.length >= 3) {
              activeBrushPathRef.current.setAttribute('d', contoursToSvgPath([contour]));
            }
          }
        });
      }
      return;
    }

    // Pen Tool Hover and Dragging Handle
    if (toolMode === 'pen') {
      if (activePenContour && activePenContour.nodes.length >= 2) {
        const firstNode = activePenContour.nodes[0];
        const dist = Math.hypot(pos.x - firstNode.x, pos.y - firstNode.y);
        setIsPenNearFirstNode(dist < 22 / zoom);
      } else {
        setIsPenNearFirstNode(false);
      }

      if (isPenDraggingHandleRef.current && activePenContour && selectedNodeId) {
        const dx = pos.x - dragStartPoint.x;
        const dy = pos.y - dragStartPoint.y;
        if (Math.hypot(dx, dy) > 3) {
          const updatedNodes = activePenContour.nodes.map((node) => {
            if (node.id !== selectedNodeId) return node;
            return {
              ...node,
              type: 'smooth' as const,
              handleOut: { x: pos.x, y: pos.y },
              handleIn: { x: 2 * node.x - pos.x, y: 2 * node.y - pos.y },
            };
          });
          setActivePenContour({
            ...activePenContour,
            nodes: updatedNodes,
          });
        }
      }
      return;
    }

    if (shapeStartPoint) {
      setShapeCurrentPoint(pos);
      return;
    }

    // Dragging handle or node in Select mode
    if (isDraggingNode && selectedNodeId && selectedContourId && activePart) {
      const dx = pos.x - dragStartPoint.x;
      const dy = pos.y - dragStartPoint.y;

      const updated = activePart.contours.map((contour) => {
        if (contour.id !== selectedContourId) return contour;
        return {
          ...contour,
          nodes: contour.nodes.map((node) => {
            if (node.id !== selectedNodeId) return node;

            if (selectedHandleType === 'handleIn') {
              const newHandleIn = { x: pos.x, y: pos.y };
              let newHandleOut = node.handleOut;
              if (node.type === 'smooth' && node.handleOut) {
                const lenOut = Math.hypot(node.handleOut.x - node.x, node.handleOut.y - node.y);
                const angleIn = Math.atan2(newHandleIn.y - node.y, newHandleIn.x - node.x);
                const angleOut = angleIn + Math.PI;
                newHandleOut = {
                  x: Math.round(node.x + Math.cos(angleOut) * lenOut),
                  y: Math.round(node.y + Math.sin(angleOut) * lenOut),
                };
              }
              return { ...node, handleIn: newHandleIn, handleOut: newHandleOut };
            }

            if (selectedHandleType === 'handleOut') {
              const newHandleOut = { x: pos.x, y: pos.y };
              let newHandleIn = node.handleIn;
              if (node.type === 'smooth' && node.handleIn) {
                const lenIn = Math.hypot(node.handleIn.x - node.x, node.handleIn.y - node.y);
                const angleOut = Math.atan2(newHandleOut.y - node.y, newHandleOut.x - node.x);
                const angleIn = angleOut + Math.PI;
                newHandleIn = {
                  x: Math.round(node.x + Math.cos(angleIn) * lenIn),
                  y: Math.round(node.y + Math.sin(angleIn) * lenIn),
                };
              }
              return { ...node, handleIn: newHandleIn, handleOut: newHandleOut };
            }

            // Dragging node anchor point itself
            return {
              ...node,
              x: node.x + dx,
              y: node.y + dy,
              handleIn: node.handleIn
                ? { x: node.handleIn.x + dx, y: node.handleIn.y + dy }
                : null,
              handleOut: node.handleOut
                ? { x: node.handleOut.x + dx, y: node.handleOut.y + dy }
                : null,
            };
          }),
        };
      });

      setParts((prev) =>
        prev.map((p) => (p.id === activePart.id ? { ...p, contours: updated } : p))
      );
      setDragStartPoint(pos);
      return;
    }

    // Dragging whole selected contour
    if (isDraggingContour && selectedContourId && activePart) {
      const dx = pos.x - dragStartPoint.x;
      const dy = pos.y - dragStartPoint.y;

      const updated = activePart.contours.map((contour) => {
        if (contour.id !== selectedContourId) return contour;
        return {
          ...contour,
          nodes: contour.nodes.map((node) => ({
            ...node,
            x: node.x + dx,
            y: node.y + dy,
            handleIn: node.handleIn
              ? { x: node.handleIn.x + dx, y: node.handleIn.y + dy }
              : null,
            handleOut: node.handleOut
              ? { x: node.handleOut.x + dx, y: node.handleOut.y + dy }
              : null,
          })),
        };
      });

      setParts((prev) =>
        prev.map((p) => (p.id === activePart.id ? { ...p, contours: updated } : p))
      );
      setDragStartPoint(pos);
      return;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      activeTouchesRef.current.delete(e.pointerId);
      if (activeTouchesRef.current.size < 2) {
        touchPinchInitialDistRef.current = null;
      }
    }

    setIsPanning(false);
    setIsDraggingNode(false);
    setIsDraggingContour(false);
    setSelectedHandleType(null);
    setActiveSnapLines({ x: null, y: null });

    // Finalize Eraser Tool
    if (isErasingRef.current && toolMode === 'eraser') {
      try {
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      } catch {}
      isErasingRef.current = false;
      activeEraserSvgDRef.current = '';
      if (activeEraserPathRef.current) {
        activeEraserPathRef.current.setAttribute('d', '');
      }

      if (eraserMode === 'cut' && eraserStrokePointsRef.current.length > 0 && activePart) {
        const rawPts = eraserStrokePointsRef.current;
        eraserStrokePointsRef.current = [];
        const pts = rawPts.length === 1
          ? [rawPts[0], { x: rawPts[0].x + 0.1, y: rawPts[0].y + 0.1 }]
          : rawPts;
        const updated = subtractEraserStrokeFromContours(activePart.contours, pts, eraserRadius);
        if (updated !== activePart.contours) {
          commitPartChange(updated);
          notify('パスを削り・分割しました', 'info');
        }
      } else {
        eraserStrokePointsRef.current = [];
        if (activePart) {
          commitPartChange(activePart.contours);
        }
      }
      return;
    }

    // Record undo state if a node or contour drag occurred in select mode
    if (dragStartContoursRef.current && activePart) {
      const startJson = JSON.stringify(dragStartContoursRef.current);
      const currentJson = JSON.stringify(activePart.contours);
      if (startJson !== currentJson) {
        setUndoStack((prev) => [...prev.slice(-25), dragStartContoursRef.current!]);
        setRedoStack([]);
      }
      dragStartContoursRef.current = null;
    }

    // Finalize Pen dragging
    if (toolMode === 'pen') {
      isPenDraggingHandleRef.current = false;
      return;
    }

    if (!activePart) return;

    // Finalize Brush
    if (isDrawingStroke && toolMode === 'brush') {
      if (brushRafIdRef.current) {
        cancelAnimationFrame(brushRafIdRef.current);
        brushRafIdRef.current = null;
      }
      if (brushStrokePointsRef.current.length >= 2) {
        const pts = isStraightMode || e.shiftKey
          ? [
              brushStrokePointsRef.current[0],
              brushStrokePointsRef.current[brushStrokePointsRef.current.length - 1],
            ]
          : brushStrokePointsRef.current;
        const rawContour = strokePointsToOutline(
          pts,
          brushWidth,
          brushStyle
        );
        if (rawContour && rawContour.nodes.length >= 3) {
          let strokeContour = rawContour;
          try {
            const selfMerged = unionContours([strokeContour], 1.2, true);
            if (selfMerged && selfMerged.length === 1) {
              strokeContour = selfMerged[0];
            } else if (selfMerged && selfMerged.length > 1) {
              commitPartChange(normalizeGlyphContoursWinding([...activePart.contours, ...selfMerged]));
              setIsDrawingStroke(false);
              brushStrokePointsRef.current = [];
              if (activeBrushPathRef.current) {
                activeBrushPathRef.current.setAttribute('d', '');
              }
              return;
            }
          } catch {
            // ignore
          }

          if (isAutoUnionMode && activePart.contours.length > 0) {
            try {
              const unioned = unionContours([...activePart.contours, strokeContour]);
              if (unioned && unioned.length > 0) {
                commitPartChange(normalizeGlyphContoursWinding(unioned));
              } else {
                commitPartChange([...activePart.contours, strokeContour]);
              }
            } catch {
              commitPartChange([...activePart.contours, strokeContour]);
            }
          } else {
            commitPartChange([...activePart.contours, strokeContour]);
          }
        }
      }
      setIsDrawingStroke(false);
      brushStrokePointsRef.current = [];
      if (activeBrushPathRef.current) {
        activeBrushPathRef.current.setAttribute('d', '');
      }
      return;
    }

    // Finalize Shape
    const isShape = [
      'rect',
      'square',
      'ellipse',
      'circle',
      'rounded_rect',
      'pill',
      'triangle',
      'triangle_down',
      'right_triangle',
      'semicircle',
      'ring',
      'parallelogram',
      'star',
      'sparkle',
      'starburst',
      'heart',
      'diamond',
      'polygon',
      'crescent',
    ].includes(toolMode);

    if (isShape && shapeStartPoint && shapeCurrentPoint) {
      const dist = Math.hypot(
        shapeCurrentPoint.x - shapeStartPoint.x,
        shapeCurrentPoint.y - shapeStartPoint.y
      );
      const p1 =
        dist < 10
          ? { x: shapeStartPoint.x - 120, y: shapeStartPoint.y - 120 }
          : shapeStartPoint;
      const p2 =
        dist < 10
          ? { x: shapeStartPoint.x + 120, y: shapeStartPoint.y + 120 }
          : shapeCurrentPoint;

      const newShapeContours = getShapeContours(toolMode, p1, p2);
      if (isAutoUnionMode && activePart.contours.length > 0) {
        try {
          const unioned = unionContours([...activePart.contours, ...newShapeContours]);
          if (unioned && unioned.length > 0) {
            commitPartChange(normalizeGlyphContoursWinding(unioned));
          } else {
            commitPartChange([...activePart.contours, ...newShapeContours]);
          }
        } catch {
          commitPartChange([...activePart.contours, ...newShapeContours]);
        }
      } else {
        commitPartChange([...activePart.contours, ...newShapeContours]);
      }
      setSelectedContourId(newShapeContours[0]?.id || null);
      setShapeStartPoint(null);
      setShapeCurrentPoint(null);
    }
  };



  // Pen Tool actions in Radical Studio
  const handleUndoPartPenNode = () => {
    if (!activePenContour) return;
    if (activePenContour.nodes.length <= 1) {
      setActivePenContour(null);
      setSelectedNodeId(null);
    } else {
      const remaining = activePenContour.nodes.slice(0, -1);
      setActivePenContour({
        ...activePenContour,
        nodes: remaining,
      });
      setSelectedNodeId(remaining[remaining.length - 1].id);
    }
  };

  const handleResetPartPenContour = () => {
    setActivePenContour(null);
    setSelectedNodeId(null);
  };

  const handleFinishPartPenContour = (closed: boolean = false, customWidth?: number) => {
    if (!activePenContour || activePenContour.nodes.length < 2 || !activePart) return;
    setShowPenStrokeMenu(false);
    const targetWidth = customWidth ?? penStrokeWidth;

    if (!closed) {
      try {
        const rawContour: PathContour = {
          ...activePenContour,
          closed: false,
        };
        const expanded = expandStrokeContours([rawContour], targetWidth, penCapStyle);
        if (expanded && expanded.length > 0) {
          let resultContours = expanded;
          if (isAutoUnionMode && activePart.contours.length > 0) {
            try {
              const unioned = unionContours([...activePart.contours, ...expanded]);
              if (unioned && unioned.length > 0) {
                commitPartChange(normalizeGlyphContoursWinding(unioned));
                setActivePenContour(null);
                setSelectedContourId(null);
                return;
              }
            } catch {}
          }
          commitPartChange([...activePart.contours, ...resultContours]);
          setActivePenContour(null);
          setSelectedContourId(resultContours[0].id);
          return;
        }
      } catch (err) {
        console.warn('Part stroke expansion fallback:', err);
      }
    }

    const finished: PathContour = {
      ...activePenContour,
      closed,
    };
    if (isAutoUnionMode && activePart.contours.length > 0 && closed) {
      try {
        const unioned = unionContours([...activePart.contours, finished]);
        if (unioned && unioned.length > 0) {
          commitPartChange(normalizeGlyphContoursWinding(unioned));
          setActivePenContour(null);
          setSelectedContourId(null);
          return;
        }
      } catch {
        // fallback
      }
    }
    commitPartChange([...activePart.contours, finished]);
    setActivePenContour(null);
    setSelectedContourId(finished.id);
  };

  const handlePartPenHudPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingPenHudRef.current = true;
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }

    const containerRect = canvasContainerRef.current?.getBoundingClientRect();
    const currentLeft =
      penHudPos?.x ??
      (containerRect ? Math.max(16, (containerRect.width - 340) / 2) : 40);
    const currentTop = penHudPos?.y ?? 20;

    penHudDragOffsetRef.current = {
      x: e.clientX - currentLeft,
      y: e.clientY - currentTop,
    };
  };

  const handlePartPenHudPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingPenHudRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    if (!canvasContainerRef.current) return;

    const containerRect = canvasContainerRef.current.getBoundingClientRect();
    let newX = e.clientX - penHudDragOffsetRef.current.x;
    let newY = e.clientY - penHudDragOffsetRef.current.y;

    newX = Math.max(8, Math.min(containerRect.width - 260, newX));
    newY = Math.max(8, Math.min(containerRect.height - 44, newY));

    setPenHudPos({ x: newX, y: newY });
  };

  const handlePartPenHudPointerUp = (e: React.PointerEvent) => {
    if (isDraggingPenHudRef.current) {
      isDraggingPenHudRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Transform helpers on Active Part
  const handleSlantPart = (angleDeg: number) => {
    if (!activePart) return;
    if (selectedContourId) {
      const updated = activePart.contours.map((c) =>
        c.id === selectedContourId ? slantSingleContour(c, angleDeg) : c
      );
      commitPartChange(updated);
    } else {
      const updated = slantContours(activePart.contours, angleDeg);
      commitPartChange(updated);
    }
  };

  const handleRotatePart = (angleDeg: number) => {
    if (!activePart) return;
    if (selectedContourId) {
      const updated = activePart.contours.map((c) =>
        c.id === selectedContourId ? rotateSingleContour(c, angleDeg) : c
      );
      commitPartChange(updated);
    } else {
      const updated = activePart.contours.map((c) => rotateSingleContour(c, angleDeg, 500, 500));
      commitPartChange(updated);
    }
  };

  const handleFlipHPart = () => {
    if (!activePart) return;
    if (selectedContourId) {
      const updated = activePart.contours.map((c) =>
        c.id === selectedContourId ? flipSingleContourH(c) : c
      );
      commitPartChange(updated);
    } else {
      const updated = flipContoursHorizontal(activePart.contours);
      commitPartChange(updated);
    }
  };

  const handleFlipVPart = () => {
    if (!activePart) return;
    if (selectedContourId) {
      const updated = activePart.contours.map((c) =>
        c.id === selectedContourId ? flipSingleContourV(c) : c
      );
      commitPartChange(updated);
    } else {
      const updated = flipContoursVertical(activePart.contours);
      commitPartChange(updated);
    }
  };

  const handleScalePart = (factor: number) => {
    if (!activePart) return;
    if (selectedContourId) {
      const updated = activePart.contours.map((c) =>
        c.id === selectedContourId ? scaleSingleContour(c, factor, factor) : c
      );
      commitPartChange(updated);
    } else {
      const updated = scaleContours(activePart.contours, factor, factor);
      commitPartChange(updated);
    }
  };

  const handleFitToPlacement = (place: RadicalPlacement) => {
    if (!activePart) return;
    const positioned = transformContoursForPlacement(activePart.contours, place, activePart.category);
    commitPartChange(positioned);
    notify(`配置を「${place}」基準に自動フィットしました`, 'info');
  };

  const handleUnionPart = () => {
    if (!activePart || !activePart.contours || activePart.contours.length <= 0) {
      notify('合体する輪郭がありません', 'warning');
      return;
    }
    try {
      const merged = unionContours(activePart.contours);
      commitPartChange(merged);
      notify('重なり合うストロークを合体し、交差の白抜けを防止しました', 'success');
    } catch (e) {
      notify('合体処理に失敗しました', 'error');
    }
  };

  const handleNormalizeWinding = () => {
    if (!activePart || !activePart.contours || activePart.contours.length === 0) return;
    try {
      const normalized = normalizeGlyphContoursWinding(activePart.contours);
      commitPartChange(normalized);
      notify('輪郭の向き（Winding）をTrueType規格に統一しました', 'success');
    } catch (e) {
      notify('輪郭処理に失敗しました', 'error');
    }
  };

  const handleSimplifyPart = () => {
    if (!activePart || !activePart.contours || activePart.contours.length === 0) return;
    try {
      const result = simplifyGlyphContours(activePart.contours, { tolerance: 2.0 });
      commitPartChange(result.contours);
      notify(`パスの単純化を実行しました（${result.reducedCount}頂点削減）`, 'success');
    } catch (e) {
      notify('パスの単純化に失敗しました', 'error');
    }
  };

  const handleCenterPartInCanvas = () => {
    if (!activePart || !activePart.contours || activePart.contours.length === 0) return;
    const bbox = getContoursBoundingBox(activePart.contours);
    if (bbox.width <= 0 || bbox.height <= 0) return;
    const currentCenterX = bbox.centerX;
    const currentCenterY = bbox.centerY;
    const dx = 500 - currentCenterX;
    const dy = 500 - currentCenterY;
    const centered = activePart.contours.map((c) => ({
      ...c,
      nodes: c.nodes.map((n) => ({
        ...n,
        x: n.x + dx,
        y: n.y + dy,
        handleIn: n.handleIn ? { x: n.handleIn.x + dx, y: n.handleIn.y + dy } : null,
        handleOut: n.handleOut ? { x: n.handleOut.x + dx, y: n.handleOut.y + dy } : null,
      })),
    }));
    commitPartChange(centered);
    notify('パーツをキャンバス中央に配置しました', 'info');
  };

  const handleClearCanvas = () => {
    if (!activePart) return;
    if (activeBrushPathRef.current) {
      activeBrushPathRef.current.setAttribute('d', '');
    }
    brushStrokePointsRef.current = [];
    setActivePenContour(null);
    setSelectedContourId(null);
    setSelectedNodeId(null);
    setShapeStartPoint(null);
    setShapeCurrentPoint(null);
    commitPartChange([]);
    notify('輪郭を全消去しました', 'info');
  };

  const handleNudgePart = (dx: number, dy: number) => {
    if (!activePart || !activePart.contours || activePart.contours.length === 0) return;
    const nudged = activePart.contours.map((c) => ({
      ...c,
      nodes: c.nodes.map((n) => ({
        ...n,
        x: n.x + dx,
        y: n.y + dy,
        handleIn: n.handleIn ? { x: n.handleIn.x + dx, y: n.handleIn.y + dy } : null,
        handleOut: n.handleOut ? { x: n.handleOut.x + dx, y: n.handleOut.y + dy } : null,
      })),
    }));
    commitPartChange(nudged);
  };

  // Filter parts list
  const filteredParts = parts.filter((part) => {
    const matchesCat = activeCategory === 'all' || part.category === activeCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (part.description && part.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // Filter presets list using high-fidelity STUDIO_RADICAL_PRESETS
  const filteredPresets = STUDIO_RADICAL_PRESETS.filter((radical) => {
    const matchesCat = activeCategory === 'all' || radical.category === activeCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      radical.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (radical.char && radical.char.includes(searchQuery.trim())) ||
      (radical.description && radical.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // Available glyphs from project for extraction
  const modifiedGlyphs = (Object.values(project?.glyphs || {}) as GlyphData[]).filter(
    (g) => g && g.contours && g.contours.length > 0
  );

  const filteredGlyphsForExtract = modifiedGlyphs.filter((g) => {
    if (!extractSearch) return true;
    return (
      (g.char && g.char.includes(extractSearch)) ||
      (g.name && g.name.toLowerCase().includes(extractSearch.toLowerCase()))
    );
  });

  // SVG Paths for render
  const mainSvgPath = activePart && activePart.contours && activePart.contours.length > 0
    ? contoursToSvgPath(normalizeGlyphContoursWinding(activePart.contours))
    : '';
  const penSvgPath = activePenContour ? contoursToSvgPath([activePenContour]) : '';
  const brushSvgPath = '';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs select-none animate-fadeIn">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={svgFileInputRef}
        onChange={handleImportSvgFile}
        accept=".svg"
        className="hidden"
      />
      <input
        type="file"
        ref={jsonFileInputRef}
        onChange={handleImportLibraryJson}
        accept=".json"
        className="hidden"
      />

      <div
        className={`w-full h-full flex flex-col overflow-hidden transition-all ${
          isFullscreen
            ? isLight
              ? 'fixed inset-0 z-50 w-screen h-screen bg-[#f4f8f5] text-stone-800'
              : 'fixed inset-0 z-50 w-screen h-screen bg-[#121b15] text-emerald-100'
            : isLight
            ? 'w-full sm:w-[98vw] h-[100vh] sm:h-[96vh] max-w-[1720px] rounded-none sm:rounded-2xl border border-stone-200/60 shadow-2xl bg-[#f4f8f5] text-stone-800'
            : 'w-full sm:w-[98vw] h-[100vh] sm:h-[96vh] max-w-[1720px] rounded-none sm:rounded-2xl border border-stone-800/60 shadow-2xl bg-[#121b15] text-emerald-100'
        }`}
      >
        {/* ================= MODAL TOP HEADER ================= */}
        <div
          className={`px-3 sm:px-4 py-2 border-b flex items-center justify-between shrink-0 gap-2 ${
            isLight ? 'bg-white border-stone-200/60' : 'bg-[#18241c] border-stone-800/60'
          }`}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div
              className={`p-1.5 rounded-lg shrink-0 ${
                isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950/80 text-emerald-300'
              }`}
            >
              <Shapes className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold tracking-wide truncate">
                  部首・作字パーツ工房
                </h2>
                <span className="text-xs text-stone-500 font-mono font-medium truncate shrink-0">
                  パーツ数 {parts.length}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate hidden md:block">
                偏旁・冠脚・筆画を設計し、漢字や文字へワンクリック合成
              </p>
            </div>
          </div>

          {/* Quick Workspace Switchers (Desktop/Tablet only) */}
          <div className="hidden md:flex items-center space-x-1.5 shrink-0">
            {/* Toggle Left Sidebar */}
            <button
              onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                isLeftSidebarOpen
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-[#1e2d22] border-emerald-700 text-emerald-200'
                  : isLight
                  ? 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  : 'bg-[#18231c] border-[#25362b] text-stone-400 hover:bg-[#202e25]'
              }`}
              title="パーツ一覧の表示/非表示（非表示にするとキャンバスが広大になります）"
            >
              <Shapes className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">ライブラリ</span>
            </button>

            {/* Toggle Right Sidebar */}
            <button
              onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                isRightSidebarOpen
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-[#1e2d22] border-emerald-700 text-emerald-200'
                  : isLight
                  ? 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  : 'bg-[#18231c] border-[#25362b] text-stone-400 hover:bg-[#202e25]'
              }`}
              title="変形・合成サイドバーの表示/非表示（非表示にするとキャンバスがさらに広大になります）"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">詳細・変形</span>
            </button>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {/* JSON Export/Import */}
            <button
              onClick={handleExportLibraryJson}
              className={`p-1.5 px-2 rounded-md border text-xs font-semibold hidden sm:flex items-center space-x-1 transition-all ${
                isLight
                  ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-50 hover:text-emerald-900'
                  : 'bg-[#1c2920] border-[#25362b] text-emerald-200 hover:bg-[#25362b]'
              }`}
              title="全パーツライブラリをJSONセーブデータとして書き出し"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">保存</span>
            </button>
            <button
              onClick={() => jsonFileInputRef.current?.click()}
              className={`p-1.5 px-2 rounded-md border text-xs font-semibold hidden sm:flex items-center space-x-1 transition-all ${
                isLight
                  ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-50 hover:text-emerald-900'
                  : 'bg-[#1c2920] border-[#25362b] text-emerald-200 hover:bg-[#25362b]'
              }`}
              title="JSONセーブデータからパーツライブラリを読み込み"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">読込</span>
            </button>

            {/* Fullscreen Toggle Button */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-1.5 px-2 rounded-md border text-xs font-semibold flex items-center space-x-1 transition-all ${
                isFullscreen
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : isLight
                  ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-50 hover:text-emerald-900'
                  : 'bg-[#1c2920] border-[#25362b] text-emerald-200 hover:bg-[#25362b]'
              }`}
              title={isFullscreen ? '通常表示に戻す' : '工房を全画面で広々と使う'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">縮小</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">全画面</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className={`p-1.5 rounded-md transition-colors ${
                isLight ? 'text-stone-600 hover:bg-emerald-100' : 'text-stone-400 hover:bg-[#223126]'
              }`}
              title="工房を閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= 3-COLUMN WORKSPACE ================= */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* ================= LEFT COLUMN: PARTS LIBRARY & PRESETS ================= */}
          {!isLeftSidebarOpen ? (
            <div
              className={`hidden md:flex w-10 border-r flex-col items-center py-3 shrink-0 cursor-pointer select-none transition-colors ${
                isLight
                  ? 'bg-white border-[#d8e6df] hover:bg-emerald-50/70 text-stone-600'
                  : 'bg-[#162119] border-[#25362b] hover:bg-[#1f2e23] text-emerald-300'
              }`}
              onClick={() => setIsLeftSidebarOpen(true)}
              title="部首・パーツライブラリを展開"
            >
              <button
                type="button"
                className="p-1 rounded text-emerald-700 dark:text-emerald-400"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="mt-6 flex flex-col items-center space-y-2">
                <Shapes className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[10.5px] font-bold [writing-mode:vertical-rl] tracking-wider opacity-80">
                  {leftSidebarTab === 'presets' ? `標準部首 (${filteredPresets.length})` : `マイパーツ (${parts.length})`}
                </span>
              </div>
            </div>
          ) : (
            <div
              className={`hidden md:flex static inset-y-0 left-0 w-72 xl:w-88 border-r flex-col shrink-0 min-h-0 relative overflow-hidden transition-all ${
                isLight ? 'bg-white border-stone-200/60' : 'bg-[#162119] border-stone-800/60'
              }`}
            >
              {/* Left Column Header with collapse button */}
              <div
                className={`p-2 px-3 border-b flex items-center justify-between shrink-0 ${
                  isLight ? 'bg-stone-50/80 border-stone-200/60' : 'bg-[#131d16] border-stone-800/60'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Shapes className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span className="text-xs font-bold">部首・パーツライブラリ</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLeftSidebarOpen(false)}
                  className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-emerald-200"
                  title="サイドバーを畳んでキャンバスを最大化"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Main Triple-Tab Switcher: Presets vs Kanji Database vs My Custom Parts */}
              <div className="p-1.5 border-b bg-stone-50/50 dark:bg-[#111913] shrink-0 border-stone-200/60 dark:border-stone-800/60">
                <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-stone-200/70 dark:bg-[#1b261f]">
                  <button
                    type="button"
                    onClick={() => setLeftSidebarTab('presets')}
                    className={`py-1.5 px-1 rounded-md text-[11px] font-bold flex items-center justify-center space-x-1 transition-all ${
                      leftSidebarTab === 'presets'
                        ? isLight
                          ? 'bg-white text-emerald-950  ring-1 ring-emerald-700/20'
                          : 'bg-[#25362b] text-emerald-200  ring-1 ring-emerald-400/20'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    <Shapes className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">標準部首</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeftSidebarTab('kanji_db')}
                    className={`py-1.5 px-1 rounded-md text-[11px] font-bold flex items-center justify-center space-x-1 transition-all ${
                      leftSidebarTab === 'kanji_db'
                        ? isLight
                          ? 'bg-white text-emerald-950  ring-1 ring-emerald-700/20'
                          : 'bg-[#25362b] text-emerald-200  ring-1 ring-emerald-400/20'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                    title="部首に紐づく常用・JIS漢字一覧データベース"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">部首別漢字</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeftSidebarTab('custom')}
                    className={`py-1.5 px-1 rounded-md text-[11px] font-bold flex items-center justify-center space-x-1 transition-all ${
                      leftSidebarTab === 'custom'
                        ? isLight
                          ? 'bg-white text-emerald-950  ring-1 ring-emerald-700/20'
                          : 'bg-[#25362b] text-emerald-200  ring-1 ring-emerald-400/20'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    <Shapes className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">マイパーツ</span>
                  </button>
                </div>
              </div>

              {/* Top Action Controls for current tab */}
              <div className="p-2.5 border-b space-y-2 shrink-0 border-inherit">
                {leftSidebarTab === 'custom' ? (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => handleCreateNewPart(activeCategory)}
                        className={`py-1.5 px-2 rounded-md font-bold text-xs flex items-center justify-center space-x-1  transition-all ${
                          isLight
                            ? 'bg-emerald-800 text-white hover:bg-emerald-900'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>新規パーツ</span>
                      </button>
                      <button
                        onClick={handleExtractFromCurrentGlyph}
                        className={`py-1.5 px-2 rounded-md font-bold text-[11px] flex items-center justify-center space-x-1 border transition-all ${
                          isLight
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                            : 'bg-[#1e2d23] border-emerald-800 text-emerald-300 hover:bg-[#273a2e]'
                        }`}
                        title={`現在編集中文字「${selectedChar}」の輪郭をパーツとして取り込みます`}
                      >
                        <Scissors className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>「{selectedChar}」取込</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => setShowExtractModal(true)}
                        className={`py-1 px-2 rounded-md text-[11px] font-semibold flex items-center justify-center space-x-1 border transition-all ${
                          isLight
                            ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-50'
                            : 'bg-[#18261e] border-[#25362b] text-stone-300 hover:bg-[#203227]'
                        }`}
                      >
                        <FolderOpen className="w-3 h-3 text-stone-500" />
                        <span>全文字から抽出</span>
                      </button>
                      <button
                        onClick={() => handleUpgradeDefaultParts(selectedFontStyle)}
                        className={`py-1 px-2 rounded-md text-[11px] font-semibold flex items-center justify-center space-x-1 border transition-all ${
                          isLight
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                            : 'bg-[#1b2f21] border-emerald-700 text-emerald-300 hover:bg-[#233f2c]'
                        }`}
                        title="初期部首パーツを高精度ベクターに刷新・更新します"
                      >
                        <RefreshCw className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>初期部首を高品質化</span>
                      </button>
                    </div>
                  </div>
                ) : leftSidebarTab === 'kanji_db' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center space-x-1">
                        <Database className="w-3.5 h-3.5 text-emerald-600" />
                        <span>部首別 漢字データベース</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setWatermarkChar(selectedChar);
                          setShowWatermark(true);
                          notify(`下絵ガイドを「${selectedChar}」にリセットしました`, 'info');
                        }}
                        className="text-[10.5px] text-emerald-700 dark:text-emerald-400 hover:underline"
                        title="下絵を現在編集中文字に戻す"
                      >
                        下絵「{selectedChar}」に戻す
                      </button>
                    </div>

                    {/* Search Bar for Kanji DB */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
                      <input
                        type="text"
                        placeholder="部首名・読み・漢字で検索 (例: さんずい, 海, 艹)..."
                        value={kanjiDbSearch}
                        onChange={(e) => setKanjiDbSearch(e.target.value)}
                        className={`w-full pl-8 pr-3 py-1.5 rounded-md text-xs border outline-hidden transition-colors ${
                          isLight
                            ? 'bg-[#f7faf8] border-[#c8ded3] focus:border-emerald-700'
                            : 'bg-[#101712] border-[#25362b] focus:border-emerald-500 text-emerald-100'
                        }`}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold">フォントスタイル選択</span>
                        <button
                          type="button"
                          onClick={() => setIsLicenseModalOpen(true)}
                          className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>OFL</span>
                        </button>
                      </div>
                      <button
                        onClick={handleImportDefaultRadicals}
                        disabled={isImportingAll}
                        className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline text-[11px] disabled:opacity-50 flex items-center space-x-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>{isImportingAll ? '取込中…' : '全部首を一括取込'}</span>
                      </button>
                    </div>

                    {/* Font Style Selector Pills */}
                    <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg border text-center text-xs font-semibold bg-stone-100/70 dark:bg-[#101712] border-stone-200 dark:border-[#25362b]">
                      {RADICAL_FONT_OPTIONS.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setSelectedFontStyle(style)}
                          className={`py-1 px-1.5 rounded-md transition-all text-[11px] flex items-center justify-center space-x-1 ${
                            selectedFontStyle.id === style.id
                              ? isLight
                                ? 'bg-white  text-emerald-900 font-bold'
                                : 'bg-[#1e2d22] text-emerald-300  font-bold'
                              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                          }`}
                        >
                          <span style={{ fontFamily: style.fontFamily }}>{style.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search Bar for presets or custom parts */}
                {leftSidebarTab !== 'kanji_db' && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
                    <input
                      type="text"
                      placeholder={leftSidebarTab === 'presets' ? '部首名・文字で検索（例: さんずい, 木, 艹）...' : 'パーツ名で検索...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-8 pr-3 py-1.5 rounded-md text-xs border outline-hidden transition-colors ${
                        isLight
                          ? 'bg-[#f7faf8] border-[#c8ded3] focus:border-emerald-700'
                          : 'bg-[#101712] border-[#25362b] focus:border-emerald-500 text-emerald-100'
                      }`}
                    />
                  </div>
                )}
              </div>

              {/* Category Filter Pills */}
              <div
                className={`p-2 border-b flex space-x-1 overflow-x-auto custom-scrollbar touch-scroll-x min-w-0 text-[11px] shrink-0 ${
                  isLight ? 'bg-[#f4f8f5] border-[#d8e6df]' : 'bg-[#131d16] border-[#25362b]'
                }`}
              >
                {leftSidebarTab === 'kanji_db'
                  ? KANJI_RADICAL_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setKanjiDbCategory(cat.id)}
                        className={`px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 text-[10px] transition-colors ${
                          kanjiDbCategory === cat.id
                            ? isLight
                              ? 'bg-emerald-800 text-white font-bold'
                              : 'bg-emerald-600 text-white font-bold'
                            : isLight
                            ? 'bg-white text-stone-700 hover:bg-emerald-100'
                            : 'bg-[#1b261f] text-stone-300 hover:bg-[#25362b]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))
                  : CATEGORY_TABS.map((cat) => {
                      const count = leftSidebarTab === 'presets'
                        ? cat.id === 'all'
                          ? STUDIO_RADICAL_PRESETS.length
                          : STUDIO_RADICAL_PRESETS.filter((p) => p.category === cat.id).length
                        : cat.id === 'all'
                          ? parts.length
                          : parts.filter((p) => p.category === cat.id).length;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setActiveCategory(cat.id)}
                          className={`px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 text-[10px] transition-colors flex items-center space-x-1 ${
                            activeCategory === cat.id
                              ? isLight
                                ? 'bg-emerald-800 text-white font-bold'
                                : 'bg-emerald-600 text-white font-bold'
                              : isLight
                              ? 'bg-white text-stone-700 hover:bg-emerald-100'
                              : 'bg-[#1b261f] text-stone-300 hover:bg-[#25362b]'
                          }`}
                        >
                          <span>{cat.label}</span>
                          <span
                            className={`px-1 rounded-full text-[9px] font-mono ${
                              activeCategory === cat.id
                                ? 'bg-white/20 text-white'
                                : isLight
                                ? 'bg-stone-100 text-stone-600'
                                : 'bg-[#25362b] text-emerald-300'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
              </div>

              {/* Main List Area */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-1.5">
                {leftSidebarTab === 'kanji_db' ? (
                  /* ================= KANJI RADICAL DATABASE VIEW ================= */
                  (() => {
                    const dbResults = searchRadicalDatabase(kanjiDbSearch, kanjiDbCategory);
                    if (dbResults.length === 0) {
                      return (
                        <div className="py-12 text-center text-xs text-stone-400 space-y-2">
                          <BookOpen className="w-8 h-8 mx-auto opacity-40" />
                          <p>該当する部首または漢字が見つかりません</p>
                          <button
                            onClick={() => {
                              setKanjiDbCategory('all');
                              setKanjiDbSearch('');
                            }}
                            className="text-emerald-700 dark:text-emerald-400 underline font-semibold text-[11px]"
                          >
                            検索条件をリセット
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        <div className="text-[10.5px] text-stone-500 dark:text-stone-400 px-1">
                          部首をクリックで展開し、漢字をクリックでキャンバスの下絵ガイドに設定できます
                        </div>

                        {dbResults.map((radical) => {
                          const isExpanded = selectedRadicalDbId === radical.id;
                          return (
                            <div
                              key={radical.id}
                              className={`rounded-xl border transition-all overflow-hidden ${
                                isExpanded
                                  ? isLight
 ? 'bg-white border-emerald-600 ring-1 ring-emerald-600/30'
 : 'bg-[#16241b] border-emerald-500 ring-1 ring-emerald-500/30'
                                  : isLight
                                  ? 'bg-stone-50/60 border-stone-200 hover:border-emerald-300'
                                  : 'bg-[#121c15] border-[#223326] hover:border-emerald-700'
                              }`}
                            >
                              {/* Radical Header Item */}
                              <div
                                onClick={() => setSelectedRadicalDbId(isExpanded ? '' : radical.id)}
                                className="p-2.5 flex items-center justify-between cursor-pointer select-none"
                              >
                                <div className="flex items-center space-x-2.5 min-w-0">
                                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-700 text-white font-bold text-base shrink-0 font-serif">
                                    {radical.char}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="text-xs font-bold truncate text-stone-900 dark:text-emerald-100">
                                        {radical.name}
                                      </span>
                                      <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 shrink-0">
                                        {radical.strokes}画
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                                      {radical.description}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-1 shrink-0 ml-2">
                                  <span className="text-[10px] font-bold font-mono text-stone-500 dark:text-stone-400">
                                    {radical.kanjiList.length}字
                                  </span>
                                  <ChevronDown
                                    className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
                                      isExpanded ? 'rotate-180 text-emerald-600' : ''
                                    }`}
                                  />
                                </div>
                              </div>

                              {/* Expanded Kanji Grid & Action Controls */}
                              {isExpanded && (
                                <div className={`p-2.5 pt-0 border-t space-y-2 ${isLight ? 'border-stone-100' : 'border-[#223326]'}`}>
                                  <div className="pt-2 flex items-center justify-between text-[10.5px]">
                                    <span className="font-semibold text-stone-600 dark:text-stone-300">
                                      収録漢字 ({radical.kanjiList.length}字):
                                    </span>
                                    {/* Load this radical into studio canvas for editing */}
                                    <button
                                      onClick={() => {
                                        const preset = STUDIO_RADICAL_PRESETS.find(
                                          (p) => p.char === radical.char || p.id === radical.id
                                        );
                                        if (preset) {
                                          handleLoadPreset(preset);
                                        } else {
                                          handleCreateNewPart(
                                            radical.category === 'basic' ? 'other' : (radical.category as PartCategory)
                                          );
                                        }
                                      }}
                                      className="text-stone-600 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 font-bold hover:underline flex items-center space-x-1"
                                      title="この部首をキャンバスに読み込んで作図編集"
                                    >
                                      <PenTool className="w-3 h-3" />
                                      <span>部首作字編集</span>
                                    </button>
                                  </div>

                                  {/* Primary 1-Click Batch Insert Action Button */}
                                  <button
                                    onClick={() => handleBatchInsertRadicalEntry(radical)}
                                    className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5  transition-all ${
                                      isLight
                                        ? 'bg-emerald-800 hover:bg-emerald-900 text-white  active:scale-[0.99]'
                                        : 'bg-emerald-700 hover:bg-emerald-600 text-white  active:scale-[0.99]'
                                    }`}
                                    title={`部首「${radical.name}」をこの部首の漢字 ${radical.kanjiList.length} 文字すべてに一括配置（既存文字は輪郭を追加合成）`}
                                  >
                                    <BookmarkPlus className="w-3.5 h-3.5" />
                                    <span>全 {radical.kanjiList.length} 文字に部首を一括配置</span>
                                  </button>

                                  {/* Kanji Character Buttons Grid */}
                                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-48 overflow-y-auto p-1 rounded-lg border bg-white dark:bg-[#0c140f] border-stone-200 dark:border-stone-800">
                                    {radical.kanjiList.map((kanji, kIdx) => {
                                      const isWatermark = watermarkChar === kanji;
                                      const hasProjectGlyph =
                                        project.glyphs && project.glyphs[kanji.codePointAt(0) || 0] !== undefined;

                                      return (
                                        <button
                                          key={`${radical.id}_${kanji}_${kIdx}`}
                                          onClick={() => {
                                            setWatermarkChar(kanji);
                                            setShowWatermark(true);
                                            notify(`漢字「${kanji}」を下絵ガイドに設定しました`, 'info');
                                          }}
                                          className={`relative p-1.5 rounded-md text-base font-serif font-bold transition-all flex flex-col items-center justify-center group/k ${
                                            isWatermark
                                              ? 'bg-emerald-700 text-white  scale-105 ring-2 ring-emerald-500'
                                              : isLight
                                              ? 'bg-stone-50 hover:bg-emerald-100 text-stone-800 border border-stone-200 hover:border-emerald-400'
                                              : 'bg-[#152018] hover:bg-[#203628] text-emerald-100 border border-[#25382b] hover:border-emerald-500'
                                          }`}
                                          title={`「${kanji}」を下絵ガイドに設定 (U+${(kanji.codePointAt(0) || 0).toString(16).toUpperCase()})`}
                                        >
                                          <span>{kanji}</span>
                                          {hasProjectGlyph && (
                                            <span
                                              className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-0.5 right-0.5"
                                              title="作成済みグリフ"
                                            />
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                ) : leftSidebarTab === 'presets' ? (
                  /* ================= RADICAL PRESETS VIEW ================= */
                  filteredPresets.length === 0 ? (
                    <div className="py-12 text-center text-xs text-stone-400 space-y-2">
                      <Search className="w-8 h-8 mx-auto opacity-40" />
                      <p>該当する部首プリセットがありません</p>
                      <button
                        onClick={() => {
                          setActiveCategory('all');
                          setSearchQuery('');
                        }}
                        className="text-emerald-700 dark:text-emerald-400 underline font-semibold text-[11px]"
                      >
                        フィルターをリセット
                      </button>
                    </div>
                  ) : (
                    filteredPresets.map((radical) => {
                      const isLoadedInCanvas =
                        activePart?.name === radical.name ||
                        activePart?.name === `${radical.name} (${selectedFontStyle.label})`;

                      return (
                        <div
                          key={radical.id || radical.name}
                          className={`p-2 rounded-lg border flex items-center space-x-2.5 transition-all ${
                            isLoadedInCanvas
                              ? isLight
                                ? 'bg-emerald-50/90 border-emerald-600 ring-1 ring-emerald-600/30'
                                : 'bg-[#1e2d22] border-emerald-500 ring-1 ring-emerald-500/30'
                              : isLight
                              ? 'bg-white border-[#d8e6df] hover:border-emerald-600 hover:bg-[#fbfdfc]'
                              : 'bg-[#18231c] border-[#25362b] hover:border-emerald-600 hover:bg-[#202e25]'
                          }`}
                        >
                          {/* High-fidelity Typographic Thumbnail Preview */}
                          <div
                            onClick={() => handleLoadPreset(radical)}
                            className={`w-12 h-12 rounded-md border shrink-0 flex items-center justify-center cursor-pointer transition-transform hover:scale-105  ${
                              isLoadedInCanvas
                                ? isLight
                                  ? 'bg-emerald-100 border-emerald-500'
                                  : 'bg-[#1a3324] border-emerald-600'
                                : isLight
                                ? 'bg-white border-stone-200 hover:border-emerald-400'
                                : 'bg-[#111c14] border-[#2a3c30] hover:border-emerald-600'
                            }`}
                            title={`クリックして「${radical.name}」を高精度ベクターとして読み込む`}
                          >
                            <span
                              className="text-2xl leading-none select-none flex items-center justify-center font-normal"
                              style={{
                                fontFamily: selectedFontStyle.fontFamily,
                                fontWeight: selectedFontStyle.fontWeight,
                                color: isLoadedInCanvas
                                  ? (isLight ? '#064e3b' : '#34d399')
                                  : (isLight ? '#1f2937' : '#f0fdf4'),
                              }}
                            >
                              {radical.char}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold truncate">
                                {radical.name}
                                <span className="font-normal text-[10px] text-stone-400 ml-1">({radical.char})</span>
                              </span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-medium shrink-0 ml-1 ${
                                  isLight
                                    ? 'bg-stone-100 text-stone-600'
                                    : 'bg-[#25362b] text-emerald-300'
                                }`}
                              >
                                {CATEGORY_TABS.find((c) => c.id === radical.category)?.label.split(' ')[0] || radical.category}
                              </span>
                            </div>
                            <div className="text-[10px] text-stone-400 mt-0.5 truncate" title={radical.description}>
                              {radical.description}
                            </div>

                            {/* Action Buttons: Edit / Insert Directly */}
                            <div className="mt-1.5 flex items-center space-x-1.5">
                              <button
                                onClick={() => handleLoadPreset(radical)}
                                disabled={isLoadingPreset}
                                className={`flex-1 py-1 px-1.5 rounded text-[10.5px] font-bold flex items-center justify-center space-x-1 transition-all ${
                                  isLoadedInCanvas
                                    ? isLight
                                      ? 'bg-emerald-700 text-white'
                                      : 'bg-emerald-600 text-white'
                                    : isLight
                                    ? 'bg-emerald-100/80 text-emerald-950 hover:bg-emerald-200'
                                    : 'bg-[#203427] text-emerald-200 hover:bg-[#2a4533]'
                                }`}
                              >
                                <PenTool className="w-3 h-3" />
                                <span>{isLoadedInCanvas ? '編集中' : '工房で編集'}</span>
                              </button>
                              <button
                                onClick={() => handleInsertPresetDirectly(radical, insertPlacement, false)}
                                className={`py-1 px-2 rounded text-[10.5px] font-bold flex items-center justify-center space-x-1 transition-all ${
                                  isLight
                                    ? 'bg-stone-100 hover:bg-emerald-600 hover:text-white text-stone-800 border border-stone-200'
                                    : 'bg-[#18261e] hover:bg-emerald-500 hover:text-stone-950 text-emerald-200 border border-[#25362b]'
                                }`}
                                title={`現在の文字「${selectedChar}」に高精度ベクターを挿入`}
                              >
                                <ArrowRight className="w-3 h-3" />
                                <span>「{selectedChar}」へ挿入</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  /* ================= MY CUSTOM PARTS VIEW ================= */
                  filteredParts.length === 0 ? (
                    <div className="py-12 text-center text-xs text-stone-400 space-y-2">
                      <Shapes className="w-8 h-8 mx-auto opacity-40" />
                      <p>該当するパーツがありません</p>
                      <button
                        onClick={() => handleCreateNewPart(activeCategory)}
                        className="text-emerald-700 dark:text-emerald-400 underline font-semibold text-[11px]"
                      >
                        このカテゴリで新規作成
                      </button>
                    </div>
                  ) : (
                    filteredParts.map((part) => {
                      const isSelected = activePart?.id === part.id;
                      const svgPath = contoursToSvgPath(part.contours);

                      return (
                        <div
                          key={part.id}
                          onClick={() => setSelectedPartId(part.id)}
                          className={`group p-2 rounded-lg border flex items-center space-x-2.5 cursor-pointer transition-all ${
                            isSelected
                              ? isLight
                                ? 'bg-emerald-50 border-emerald-700  ring-1 ring-emerald-700/30'
                                : 'bg-[#1e2d22] border-emerald-500  ring-1 ring-emerald-500/30'
                              : isLight
                              ? 'bg-white border-[#d8e6df] hover:border-emerald-600 hover:bg-[#fbfdfc]'
                              : 'bg-[#18231c] border-[#25362b] hover:border-emerald-600 hover:bg-[#202e25]'
                          }`}
                        >
                          {/* SVG Thumbnail Preview */}
                          <div
                            className={`w-12 h-12 rounded-md border shrink-0 flex items-center justify-center p-0.5 ${
                              isLight ? 'bg-white border-stone-200' : 'bg-[#0f1711] border-[#2a3c30]'
                            }`}
                          >
                            {part.contours && part.contours.length > 0 ? (
                              <svg viewBox="0 0 1000 1000" className="w-full h-full">
                                <path
                                  d={svgPath}
                                  fill={isSelected ? (isLight ? '#064e3b' : '#34d399') : isLight ? '#1f2937' : '#ecfdf5'}
                                />
                              </svg>
                            ) : (
                              <span className="text-[9px] text-stone-400 italic">空白</span>
                            )}
                          </div>

                          {/* Part Name & Meta */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold truncate">{part.name}</span>
                              {part.category && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                                    isLight
                                      ? 'bg-stone-100 text-stone-600'
                                      : 'bg-[#25362b] text-emerald-300'
                                  }`}
                                >
                                  {CATEGORY_TABS.find((c) => c.id === part.category)?.label.split(' ')[0] ||
                                    part.category}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-stone-400 mt-0.5 flex items-center justify-between">
                              <span>輪郭: {part.contours?.length || 0}本</span>
                              <span>
                                {new Date(part.updatedAt || part.createdAt).toLocaleDateString('ja-JP', {
                                  month: 'numeric',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                          </div>

                          {/* Quick Actions (Duplicate / Delete) on hover */}
                          <div className="flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleDuplicatePart(part, e)}
                              className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-[#2d4032] text-stone-500 dark:text-stone-300"
                              title="パーツを複製"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleDeletePart(part.id, e)}
                              className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/70 text-rose-500"
                              title="パーツを削除"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          )}

          {/* ================= CENTER COLUMN: DEDICATED PART CANVAS ================= */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 relative overflow-hidden flex pb-14 md:pb-0">
            {/* Top Quick Action / Insertion Ribbon (作字・即時配置バー) */}
            <div
              className={`px-3 py-1.5 border-b flex items-center justify-between gap-2 shrink-0 overflow-x-auto scrollbar-none z-20 ${
                isLight
                  ? 'bg-white border-stone-200/60 text-stone-800'
                  : 'bg-[#141d16] border-stone-800/60 text-emerald-100'
              }`}
            >
              {/* Placement Insertion Buttons */}
              <div className="flex items-center space-x-1 shrink-0">
                <span className="text-[11px] font-bold shrink-0 mr-1 text-stone-600 dark:text-stone-300 hidden sm:inline">
                  文字「{selectedChar}」へ即時挿入:
                </span>
                <button
                  onClick={() => handleQuickInsertPlacement('hen')}
                  disabled={!activePart || (activePart.contours?.length ?? 0) === 0}
                  className={`px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 disabled:opacity-40 ${
                    isLight
                      ? 'bg-white border border-stone-200 hover:bg-emerald-600 hover:text-white text-stone-800 '
                      : 'bg-[#1c2e22] border border-stone-700 hover:bg-emerald-500 hover:text-stone-950 text-emerald-200 '
                  }`}
                  title="偏（左側・幅46%）の枠に合わせて文字に挿入"
                >
                  <span>偏 (左)</span>
                </button>
                <button
                  onClick={() => handleQuickInsertPlacement('tsukuri')}
                  disabled={!activePart || (activePart.contours?.length ?? 0) === 0}
                  className={`px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 disabled:opacity-40 ${
                    isLight
                      ? 'bg-white border border-emerald-300 hover:bg-emerald-600 hover:text-white text-emerald-950 '
                      : 'bg-[#1c2e22] border border-emerald-700/80 hover:bg-emerald-500 hover:text-stone-950 text-emerald-200 '
                  }`}
                  title="旁（右側・幅46%）の枠に合わせて文字に挿入"
                >
                  <span>旁 (右)</span>
                </button>
                <button
                  onClick={() => handleQuickInsertPlacement('kanmuri')}
                  disabled={!activePart || (activePart.contours?.length ?? 0) === 0}
                  className={`px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 disabled:opacity-40 ${
                    isLight
                      ? 'bg-white border border-emerald-300 hover:bg-emerald-600 hover:text-white text-emerald-950 '
                      : 'bg-[#1c2e22] border border-emerald-700/80 hover:bg-emerald-500 hover:text-stone-950 text-emerald-200 '
                  }`}
                  title="冠（上側・高さ36%）の枠に合わせて文字に挿入"
                >
                  <span>冠 (上)</span>
                </button>
                <button
                  onClick={() => handleQuickInsertPlacement('ashi')}
                  disabled={!activePart || (activePart.contours?.length ?? 0) === 0}
                  className={`px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 disabled:opacity-40 ${
                    isLight
                      ? 'bg-white border border-emerald-300 hover:bg-emerald-600 hover:text-white text-emerald-950 '
                      : 'bg-[#1c2e22] border border-emerald-700/80 hover:bg-emerald-500 hover:text-stone-950 text-emerald-200 '
                  }`}
                  title="脚（下側・高さ36%）の枠に合わせて文字に挿入"
                >
                  <span>脚 (下)</span>
                </button>
                <button
                  onClick={() => handleQuickInsertPlacement('original')}
                  disabled={!activePart || (activePart.contours?.length ?? 0) === 0}
                  className={`px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 disabled:opacity-40 ${
                    isLight
                      ? 'bg-emerald-800 text-white hover:bg-emerald-900 '
                      : 'bg-emerald-600 text-white hover:bg-emerald-500 '
                  }`}
                  title="原寸位置のまま現在の文字に挿入"
                >
                  <ArrowRight className="w-3 h-3" />
                  <span>そのまま挿入</span>
                </button>
              </div>

              {/* Fast Extract & Quick Transform Group */}
              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  onClick={handleExtractFromCurrentGlyph}
                  className={`px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 border transition-all active:scale-95 ${
                    isLight
                      ? 'bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                      : 'bg-[#1a2b20] border-emerald-700 text-emerald-200 hover:bg-[#22382a]'
                  }`}
                  title={`文字「${selectedChar}」の描画輪郭をパーツとして取り込みます`}
                >
                  <Scissors className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden md:inline">「{selectedChar}」輪郭を取込</span>
                </button>

                <div className="h-4 w-[1px] bg-emerald-300 dark:bg-emerald-800 mx-0.5" />

                <button
                  onClick={handleCenterPartInCanvas}
                  disabled={!activePart || (activePart.contours?.length ?? 0) === 0}
                  className={`p-1 rounded text-xs transition-colors disabled:opacity-30 ${
                    isLight ? 'hover:bg-emerald-200 text-emerald-900' : 'hover:bg-[#203427] text-emerald-200'
                  }`}
                  title="キャンバス中央揃え"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleFlipHPart}
                  disabled={!activePart || (activePart.contours?.length ?? 0) === 0}
                  className={`p-1 rounded text-xs transition-colors disabled:opacity-30 ${
                    isLight ? 'hover:bg-emerald-200 text-emerald-900' : 'hover:bg-[#203427] text-emerald-200'
                  }`}
                  title="水平反転 (左右)"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleFlipVPart}
                  disabled={!activePart || (activePart.contours?.length ?? 0) === 0}
                  className={`p-1 rounded text-xs transition-colors disabled:opacity-30 ${
                    isLight ? 'hover:bg-emerald-200 text-emerald-900' : 'hover:bg-[#203427] text-emerald-200'
                  }`}
                  title="垂直反転 (上下)"
                >
                  <FlipVertical className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {/* Canvas Toolbar */}
            <div
              className={`px-2 sm:px-3 py-1.5 border-b flex items-center justify-between gap-1.5 sm:gap-2 shrink-0 overflow-x-auto scrollbar-thin scrollbar-thumb-stone-300 dark:scrollbar-thumb-stone-700 min-w-0 relative z-10 ${
                isLight ? 'bg-white border-stone-200/60' : 'bg-[#141d16] border-stone-800/60'
              }`}
            >
              {/* Primary Tool Buttons */}
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => setToolMode('select')}
                  className={`p-1.5 px-2 rounded text-xs font-semibold flex items-center space-x-1 transition-all shrink-0 ${
                    toolMode === 'select'
                      ? isLight
                        ? 'bg-emerald-800 text-white font-bold '
                        : 'bg-emerald-600 text-white font-bold '
                      : isLight
                      ? 'hover:bg-emerald-100 text-stone-700'
                      : 'hover:bg-[#202d24] text-emerald-200'
                  }`}
                  title="選択・ノード編集 (V)"
                >
                  <MousePointer className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">選択</span>
                </button>

                <button
                  onClick={() => setToolMode('pen')}
                  className={`p-1.5 px-2 rounded text-xs font-semibold flex items-center space-x-1 transition-all shrink-0 ${
                    toolMode === 'pen'
                      ? isLight
                        ? 'bg-emerald-800 text-white font-bold '
                        : 'bg-emerald-600 text-white font-bold '
                      : isLight
                      ? 'hover:bg-emerald-100 text-stone-700'
                      : 'hover:bg-[#202d24] text-emerald-200'
                  }`}
                  title="ベジェペンツール (P)"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">ペン</span>
                </button>

                <button
                  onClick={() => setToolMode('brush')}
                  className={`p-1.5 px-2 rounded text-xs font-semibold flex items-center space-x-1 transition-all shrink-0 ${
                    toolMode === 'brush'
                      ? isLight
                        ? 'bg-emerald-800 text-white font-bold '
                        : 'bg-emerald-600 text-white font-bold '
                      : isLight
                      ? 'hover:bg-emerald-100 text-stone-700'
                      : 'hover:bg-[#202d24] text-emerald-200'
                  }`}
                  title="手書き筆・ストローク加筆 (B)"
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">ブラシ</span>
                </button>

                {/* Compact Shape Tool with Dropdown */}
                <div className="relative shrink-0">
                  <div
                    className={`flex items-center rounded text-xs font-semibold border transition-all ${
                      [
                        'rect',
                        'square',
                        'ellipse',
                        'circle',
                        'rounded_rect',
                        'pill',
                        'triangle',
                        'triangle_down',
                        'right_triangle',
                        'semicircle',
                        'ring',
                        'parallelogram',
                        'star',
                        'sparkle',
                        'starburst',
                        'heart',
                        'diamond',
                        'polygon',
                        'crescent',
                      ].includes(toolMode)
                        ? isLight
                          ? 'bg-emerald-800 text-white border-emerald-900 '
                          : 'bg-emerald-600 text-white border-emerald-700 '
                        : isLight
                        ? 'bg-white border-stone-200 hover:bg-emerald-50 text-stone-700'
                        : 'bg-[#18261e] border-[#283e2f] hover:bg-[#203428] text-emerald-200'
                    }`}
                  >
                    <button
                      onClick={() => setToolMode(activeShapeType)}
                      className="p-1.5 pl-2 pr-1 flex items-center space-x-1"
                      title="図形描画ツール"
                    >
                      {activeShapeType === 'rect' && <Square className="w-3.5 h-3.5" />}
                      {activeShapeType === 'square' && <Square className="w-3.5 h-3.5" />}
                      {activeShapeType === 'ellipse' && <Circle className="w-3.5 h-3.5" />}
                      {activeShapeType === 'circle' && <Circle className="w-3.5 h-3.5" />}
                      {activeShapeType === 'triangle' && <Triangle className="w-3.5 h-3.5" />}
                      {activeShapeType === 'right_triangle' && <Triangle className="w-3.5 h-3.5" />}
                      {activeShapeType === 'pill' && <CircleDot className="w-3.5 h-3.5" />}
                      {activeShapeType === 'semicircle' && <Circle className="w-3.5 h-3.5" />}
                      {activeShapeType === 'ring' && <Disc className="w-3.5 h-3.5" />}
                      {activeShapeType === 'parallelogram' && <Slash className="w-3.5 h-3.5" />}
                      {activeShapeType === 'diamond' && <Diamond className="w-3.5 h-3.5" />}
                      {activeShapeType === 'polygon' && <Hexagon className="w-3.5 h-3.5" />}
                      {activeShapeType === 'star' && <Star className="w-3.5 h-3.5" />}
                      {activeShapeType === 'sparkle' && <Sparkles className="w-3.5 h-3.5" />}
                      {activeShapeType === 'starburst' && <Sparkles className="w-3.5 h-3.5" />}
                      {activeShapeType === 'heart' && <Heart className="w-3.5 h-3.5" />}
                      {activeShapeType === 'crescent' && <Moon className="w-3.5 h-3.5" />}
                      <span className="hidden xl:inline text-[11px]">
                        {activeShapeType === 'rect' ? '四角' : activeShapeType === 'ellipse' ? '円' : activeShapeType === 'triangle' ? '三角' : activeShapeType === 'pill' ? 'カプセル' : activeShapeType === 'star' ? '星' : activeShapeType === 'heart' ? 'ハート' : activeShapeType === 'diamond' ? 'ダイヤ' : '図形'}
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowShapeMenu((prev) => !prev);
                      }}
                      className="p-1.5 pr-1.5 pl-0.5 opacity-70 hover:opacity-100 transition-opacity"
                      title="図形の種類を選択"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Dropdown Menu for Shapes */}
                  {showShapeMenu && (
                    <div
                      className={`absolute top-full left-0 mt-1.5 p-1 rounded-lg border shadow-xl z-50 grid grid-cols-4 sm:grid-cols-6 gap-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${
                        isLight
                          ? 'bg-white/95 border-stone-200 '
                          : 'bg-[#152219]/95 border-[#283e2f] '
                      }`}
                    >
                      {[
                        { id: 'rect' as ShapeType, label: '四角形 (Rect)', icon: <Square className="w-3.5 h-3.5" /> },
                        { id: 'square' as ShapeType, label: '正方形 (Square)', icon: <Square className="w-3.5 h-3.5" /> },
                        { id: 'ellipse' as ShapeType, label: '楕円 (Ellipse)', icon: <Circle className="w-3.5 h-3.5" /> },
                        { id: 'circle' as ShapeType, label: '正円 (Circle)', icon: <Circle className="w-3.5 h-3.5" /> },
                        { id: 'pill' as ShapeType, label: 'カプセル (Pill)', icon: <CircleDot className="w-3.5 h-3.5" /> },
                        { id: 'triangle' as ShapeType, label: '三角形 (Triangle)', icon: <Triangle className="w-3.5 h-3.5" /> },
                        { id: 'right_triangle' as ShapeType, label: '直角三角形', icon: <Triangle className="w-3.5 h-3.5" /> },
                        { id: 'semicircle' as ShapeType, label: '半円 (Semicircle)', icon: <Circle className="w-3.5 h-3.5" /> },
                        { id: 'ring' as ShapeType, label: 'ドーナツ (Ring)', icon: <Disc className="w-3.5 h-3.5" /> },
                        { id: 'parallelogram' as ShapeType, label: '平行四辺形', icon: <Slash className="w-3.5 h-3.5" /> },
                        { id: 'diamond' as ShapeType, label: '菱形 (Diamond)', icon: <Diamond className="w-3.5 h-3.5" /> },
                        { id: 'polygon' as ShapeType, label: '六角形 (Hexagon)', icon: <Hexagon className="w-3.5 h-3.5" /> },
                        { id: 'star' as ShapeType, label: '星型 (Star)', icon: <Star className="w-3.5 h-3.5" /> },
                        { id: 'sparkle' as ShapeType, label: '4芒星 (Sparkle)', icon: <Sparkles className="w-3.5 h-3.5" /> },
                        { id: 'starburst' as ShapeType, label: '8芒星 (Starburst)', icon: <Sparkles className="w-3.5 h-3.5" /> },
                        { id: 'heart' as ShapeType, label: 'ハート (Heart)', icon: <Heart className="w-3.5 h-3.5" /> },
                        { id: 'crescent' as ShapeType, label: '三日月 (Crescent)', icon: <Moon className="w-3.5 h-3.5" /> },
                      ].map((s) => (
                        <button
                          key={s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveShapeType(s.id);
                            setToolMode(s.id);
                            setShowShapeMenu(false);
                          }}
                          className={`p-1.5 rounded flex items-center justify-center transition-all ${
                            toolMode === s.id
                              ? 'bg-emerald-800 text-white '
                              : isLight
                              ? 'hover:bg-emerald-100 text-stone-700'
                              : 'hover:bg-[#203225] text-emerald-200'
                          }`}
                          title={s.label}
                        >
                          {s.icon}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setToolMode('eraser')}
                  className={`p-1.5 px-2 rounded text-xs font-semibold flex items-center space-x-1 transition-all shrink-0 ${
                    toolMode === 'eraser'
                      ? isLight
                        ? 'bg-emerald-800 text-white font-bold '
                        : 'bg-emerald-600 text-white font-bold '
                      : isLight
                      ? 'hover:bg-emerald-100 text-stone-700'
                      : 'hover:bg-[#202d24] text-emerald-200'
                  }`}
                  title="消しゴム (E)"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">消去</span>
                </button>

                <button
                  onClick={() => setToolMode('hand')}
                  className={`p-1.5 px-2 rounded text-xs font-semibold flex items-center space-x-1 transition-all shrink-0 ${
                    toolMode === 'hand'
                      ? isLight
                        ? 'bg-emerald-800 text-white font-bold '
                        : 'bg-emerald-600 text-white font-bold '
                      : isLight
                      ? 'hover:bg-emerald-100 text-stone-700'
                      : 'hover:bg-[#202d24] text-emerald-200'
                  }`}
                  title="手のひら・画面移動 (H)"
                >
                  <Hand className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">移動</span>
                </button>
              </div>

              {/* Auto-Union Toggle & Pathfinder Section */}
              <div className="flex items-center space-x-1 border-l pl-1.5 sm:pl-2 ml-0.5 sm:ml-1 border-stone-300 dark:border-stone-700 shrink-0">
                {/* Auto-Union Mode Toggle Switch */}
                <button
                  onClick={() => {
                    const next = !isAutoUnionMode;
                    setIsAutoUnionMode(next);
                    notify(
                      next
                        ? '合体モード ON: ブラシ描画・図形・パスが既存の部首パーツに自動合成されます'
                        : '合体モード OFF: 各ストローク・図形が独立した輪郭として追加されます',
                      'info'
                    );
                  }}
                  className={`p-1.5 px-2 rounded text-xs font-semibold flex items-center space-x-1.5 transition-all shrink-0 border ${
                    isAutoUnionMode
                      ? isLight
                        ? 'bg-emerald-700 text-white border-emerald-800  ring-1 ring-emerald-500/40 font-bold'
                        : 'bg-emerald-600 text-white border-emerald-500  ring-1 ring-emerald-400/40 font-bold'
                      : isLight
                      ? 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                      : 'bg-[#18261e] border-[#283e2f] text-emerald-300 hover:bg-[#203428]'
                  }`}
                  title="【合体モード】ONのとき、手書きブラシや図形追加時に既存の部首パーツと自動的にブーリアン結合（合体）して一体化します"
                >
                  <Layers className={`w-3.5 h-3.5 ${isAutoUnionMode ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
                  <span className="text-[11px] font-bold">合体: {isAutoUnionMode ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  onClick={handleUnionPart}
                  disabled={!activePart || activePart.contours.length === 0}
                  className={`p-1.5 px-2 rounded text-xs font-semibold flex items-center space-x-1 transition-all shrink-0 ${
                    isLight
                      ? 'bg-emerald-50 text-emerald-950 border border-emerald-300 hover:bg-emerald-100 disabled:opacity-30'
                      : 'bg-[#18261e] text-emerald-300 border border-emerald-800 hover:bg-[#203429] disabled:opacity-30'
                  }`}
                  title="【重なり合体】交差・重なり合うストロークを1つの輪郭に合体し、白抜けを解消します"
                >
                  <Wand2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden xl:inline">手動合体</span>
                </button>

                <button
                  onClick={handleNormalizeWinding}
                  disabled={!activePart || activePart.contours.length === 0}
                  className={`p-1.5 px-2 rounded text-xs font-semibold flex items-center space-x-1 transition-all shrink-0 ${
                    isLight
                      ? 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-30'
                      : 'bg-[#18241c] border border-[#25362b] text-emerald-200 hover:bg-[#202e24] disabled:opacity-30'
                  }`}
                  title="【向き統一】フォント規格に準拠して外側輪郭と穴あき輪郭のWinding方向を自動修正"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">向き統一</span>
                </button>

                <button
                  onClick={handleSimplifyPart}
                  disabled={!activePart || activePart.contours.length === 0}
                  className={`p-1.5 px-2 rounded text-xs font-semibold flex items-center space-x-1 transition-all shrink-0 ${
                    isLight
                      ? 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-30'
                      : 'bg-[#18241c] border border-[#25362b] text-emerald-200 hover:bg-[#202e24] disabled:opacity-30'
                  }`}
                  title="【パス単純化】余分なアンカーポイントを削減して滑らかな曲線に最適化"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden xl:inline">単純化</span>
                </button>

                <button
                  onClick={handleCenterPartInCanvas}
                  disabled={!activePart || activePart.contours.length === 0}
                  className={`p-1.5 rounded text-xs transition-colors shrink-0 ${
                    isLight ? 'hover:bg-emerald-100 text-stone-700' : 'hover:bg-[#202d24] text-emerald-200'
                  }`}
                  title="パーツをキャンバス中央(500,500)に配置"
                >
                  <Move className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleFlipHPart}
                  disabled={!activePart || (activePart.contours?.length ?? 0) === 0}
                  className={`p-1.5 rounded text-xs transition-colors shrink-0 ${
                    isLight ? 'hover:bg-emerald-100 text-stone-700' : 'hover:bg-[#202d24] text-emerald-200'
                  }`}
                  title="左右反転"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleFlipVPart}
                  disabled={!activePart || (activePart.contours?.length ?? 0) === 0}
                  className={`p-1.5 rounded text-xs transition-colors shrink-0 ${
                    isLight ? 'hover:bg-emerald-100 text-stone-700' : 'hover:bg-[#202d24] text-emerald-200'
                  }`}
                  title="上下反転"
                >
                  <FlipVertical className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Undo / Redo, Zoom & Guide Toggles */}
              <div className="flex items-center space-x-0.5 sm:space-x-1 shrink-0 ml-auto">
                {/* Zoom Controls */}
                <div className="flex items-center space-x-0.5 border-r pr-1 mr-0.5 border-stone-300 dark:border-stone-700 shrink-0">
                  <button
                    onClick={() => setZoom((z) => Math.max(0.2, Number((z * 0.8).toFixed(2))))}
                    className={`p-1.5 rounded text-xs transition-colors ${
                      isLight ? 'hover:bg-emerald-100 text-stone-700' : 'hover:bg-[#202d24] text-emerald-200'
                    }`}
                    title="縮小"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10.5px] font-mono font-bold px-1 min-w-[36px] text-center text-stone-600 dark:text-stone-300">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom((z) => Math.min(5, Number((z * 1.25).toFixed(2))))}
                    className={`p-1.5 rounded text-xs transition-colors ${
                      isLight ? 'hover:bg-emerald-100 text-stone-700' : 'hover:bg-[#202d24] text-emerald-200'
                    }`}
                    title="拡大"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={resetView}
                    className={`p-1.5 rounded text-xs transition-colors ${
                      isLight ? 'hover:bg-emerald-100 text-stone-600' : 'hover:bg-[#202d24] text-stone-300'
                    }`}
                    title="全体表示 (フィット)"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Undo / Redo */}
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className={`p-1.5 rounded text-xs transition-colors shrink-0 ${
                    undoStack.length > 0
                      ? isLight
                        ? 'hover:bg-emerald-100 text-stone-700'
                        : 'hover:bg-[#202d24] text-emerald-200'
                      : 'opacity-30 cursor-not-allowed'
                  }`}
                  title="元に戻す (Undo)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className={`p-1.5 rounded text-xs transition-colors shrink-0 ${
                    redoStack.length > 0
                      ? isLight
                        ? 'hover:bg-emerald-100 text-stone-700'
                        : 'hover:bg-[#202d24] text-emerald-200'
                      : 'opacity-30 cursor-not-allowed'
                  }`}
                  title="やり直し (Redo)"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>

                <div className="w-[1px] h-4 bg-stone-300 dark:bg-stone-700 mx-0.5 shrink-0" />

                {/* Guides Toggles */}
                <button
                  onClick={() => setShowKanjiGuides(!showKanjiGuides)}
                  className={`p-1 px-1.5 sm:px-2 rounded text-[11px] font-bold border transition-colors shrink-0 ${
                    showKanjiGuides
                      ? isLight
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                        : 'bg-emerald-950 border-emerald-600 text-emerald-300'
                      : isLight
                      ? 'bg-white border-[#d8e6df] text-stone-500 hover:bg-stone-50'
                      : 'bg-[#1a261f] border-[#25362b] text-stone-400 hover:bg-[#223328]'
                  }`}
                  title="偏旁分割・配置ガイド線の表示切替"
                >
                  偏旁
                </button>

                <button
                  onClick={() => setIsWireframeMode(!isWireframeMode)}
                  className={`p-1 px-1.5 sm:px-2 rounded text-[11px] font-bold border transition-colors shrink-0 ${
                    isWireframeMode
                      ? isLight
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                        : 'bg-emerald-950 border-emerald-600 text-emerald-300'
                      : isLight
                      ? 'bg-white border-[#d8e6df] text-stone-500 hover:bg-stone-50'
                      : 'bg-[#1a261f] border-[#25362b] text-stone-400 hover:bg-[#223328]'
                  }`}
                  title="パス輪郭のみ表示（ワイヤーフレーム表示 / 塗りつぶし切替）"
                >
                  輪郭のみ
                </button>

                <button
                  onClick={() => setShowNineBoxes(!showNineBoxes)}
                  className={`p-1 px-1.5 sm:px-2 rounded text-[11px] font-bold border transition-colors shrink-0 ${
                    showNineBoxes
                      ? isLight
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                        : 'bg-emerald-950 border-emerald-600 text-emerald-300'
                      : isLight
                      ? 'bg-white border-[#d8e6df] text-stone-500 hover:bg-stone-50'
                      : 'bg-[#1a261f] border-[#25362b] text-stone-400 hover:bg-[#223328]'
                  }`}
                  title="九宮格（3x3グリッド）ガイドの表示切替"
                >
                  九宮
                </button>

                {/* Magnetic Snapping Toggle */}
                <button
                  onClick={() => setIsSnapEnabled(!isSnapEnabled)}
                  className={`p-1 px-1.5 sm:px-2 rounded text-[11px] font-bold border transition-colors shrink-0 flex items-center space-x-1 ${
                    isSnapEnabled
                      ? isLight
                        ? 'bg-cyan-100 border-cyan-400 text-cyan-950'
                        : 'bg-cyan-950 border-cyan-600 text-cyan-200'
                      : isLight
                      ? 'bg-white border-[#d8e6df] text-stone-500 hover:bg-stone-50'
                      : 'bg-[#1a261f] border-[#25362b] text-stone-400 hover:bg-[#223328]'
                  }`}
                  title="ガイド線・グリッド交点への磁気自動スナップ吸着 (ON/OFF)"
                >
                  <CircleDot className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                  <span>吸着</span>
                </button>

                {/* Target Character Watermark Guide & Related Kanji Picker */}
                <div className="relative flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => setShowWatermark(!showWatermark)}
                    className={`p-1 px-1.5 sm:px-2 rounded text-[11px] font-bold border transition-colors shrink-0 ${
                      showWatermark
                        ? isLight
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                          : 'bg-emerald-950 border-emerald-600 text-emerald-300'
                        : isLight
                        ? 'bg-white border-[#d8e6df] text-stone-500 hover:bg-stone-50'
                        : 'bg-[#1a261f] border-[#25362b] text-stone-400 hover:bg-[#223328]'
                    }`}
                    title="背景透かし文字ガイドの表示切替"
                  >
                    透かし
                  </button>
                  {showWatermark && (
                    <>
                      <input
                        type="text"
                        maxLength={1}
                        value={watermarkChar || ''}
                        onChange={(e) => setWatermarkChar(e.target.value.slice(-1) || selectedChar)}
                        className={`w-6 h-6 text-center text-xs font-bold rounded border outline-hidden transition-colors ${
                          isLight
                            ? 'bg-white border-emerald-300 text-emerald-950 focus:border-emerald-600'
                            : 'bg-[#121c15] border-emerald-700 text-emerald-100 focus:border-emerald-500'
                        }`}
                        title="透かし表示する参照文字（例: 休）"
                      />
                      <button
                        onClick={() => setShowWatermarkPicker(!showWatermarkPicker)}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border transition-colors flex items-center space-x-1 ${
                          showWatermarkPicker
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : isLight
                            ? 'bg-white border-stone-300 text-stone-700 hover:bg-emerald-50'
                            : 'bg-[#18261e] border-emerald-800 text-emerald-200 hover:bg-[#22382b]'
                        }`}
                        title="この部首が含まれる漢字を選んで下絵に設定・濃さスケール調整"
                      >
                        <span>下絵設定</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {/* Floating Watermark Related Kanji Picker Panel */}
                      {showWatermarkPicker && (
                        <div
                          className={`absolute top-full right-0 mt-1.5 z-40 p-3 rounded-xl border shadow-2xl w-72 sm:w-80 space-y-2.5 backdrop-blur-md animate-in fade-in zoom-in-95 ${
                            isLight
                              ? 'bg-white/95 border-emerald-300 text-stone-800 '
                              : 'bg-[#121d15]/95 border-emerald-700 text-emerald-100 '
                          }`}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between border-b pb-1.5 border-stone-200 dark:border-stone-800">
                            <span className="text-xs font-bold flex items-center space-x-1 text-emerald-800 dark:text-emerald-300">
                              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                              <span>参照下絵（透かし漢字）の選択</span>
                            </span>
                            <button
                              onClick={() => setShowWatermarkPicker(false)}
                              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-0.5 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div>
                            <label className="text-[10.5px] font-bold block mb-1 text-stone-600 dark:text-stone-300">
                              「{activePart?.name || '部首'}」を含む漢字から下絵を選択:
                            </label>
                            <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1.5 rounded-lg border bg-stone-50 dark:bg-[#0c140e] border-stone-200 dark:border-stone-800">
                              {relatedKanjiList.map((kanji, idx) => (
                                <button
                                  key={`wm_kanji_${kanji}_${idx}`}
                                  onClick={() => {
                                    setWatermarkChar(kanji);
                                    setShowWatermark(true);
                                  }}
                                  className={`w-7 h-7 rounded-md font-bold text-xs flex items-center justify-center transition-all ${
                                    watermarkChar === kanji
                                      ? 'bg-emerald-700 text-white  scale-105 ring-2 ring-emerald-400'
                                      : isLight
                                      ? 'bg-white border border-stone-200 text-stone-800 hover:border-emerald-400'
                                      : 'bg-[#1a2820] border border-stone-800 text-stone-200 hover:border-emerald-600'
                                  }`}
                                  title={`「${kanji}」を下絵文字に設定`}
                                >
                                  {kanji}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-200 dark:border-stone-800 text-[11px]">
                            <div>
                              <label className="block text-[10px] font-bold text-stone-500 dark:text-stone-400 mb-0.5">
                                下絵不透明度: {Math.round(watermarkOpacity * 100)}%
                              </label>
                              <input
                                type="range"
                                min={0.05}
                                max={0.6}
                                step={0.05}
                                value={watermarkOpacity}
                                onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                                className="w-full accent-emerald-600"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-stone-500 dark:text-stone-400 mb-0.5">
                                倍率: {Math.round(watermarkScale * 100)}%
                              </label>
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => setWatermarkScale((s) => Math.max(0.5, Number((s - 0.1).toFixed(1))))}
                                  className="px-1.5 py-0.5 rounded border text-[10px] font-bold bg-stone-100 dark:bg-[#1a2820] hover:bg-emerald-100"
                                >
                                  -
                                </button>
                                <span className="font-mono text-[11px] px-1 text-center font-bold">
                                  {Math.round(watermarkScale * 100)}%
                                </span>
                                <button
                                  onClick={() => setWatermarkScale((s) => Math.min(1.8, Number((s + 0.1).toFixed(1))))}
                                  className="px-1.5 py-0.5 rounded border text-[10px] font-bold bg-stone-100 dark:bg-[#1a2820] hover:bg-emerald-100"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Clear All */}
                <button
                  onClick={handleClearCanvas}
                  disabled={!activePart || (activePart.contours?.length ?? 0) === 0}
                  className={`p-1.5 rounded text-xs transition-colors shrink-0 ${
                    activePart && (activePart.contours?.length ?? 0) > 0
                      ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                      : 'opacity-30 cursor-not-allowed text-stone-400'
                  }`}
                  title="輪郭を全消去"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Contextual Tool Settings Bar (Brush / Shape / Pen / Node Options) */}
            <div
              className={`px-3 py-1.5 border-b flex items-center justify-between gap-2 shrink-0 overflow-x-auto scrollbar-thin scrollbar-thumb-stone-300 dark:scrollbar-thumb-stone-700 min-w-0 text-xs ${
                isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#121c15] border-[#223627]'
              }`}
            >
              {toolMode === 'brush' ? (
                /* ================= BRUSH TOOL OPTIONS ================= */
                <div className="flex items-center space-x-2.5 sm:space-x-4 shrink-0 w-full justify-between">
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 shrink-0 flex items-center space-x-1">
                      <Paintbrush className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>筆スタイル:</span>
                    </span>

                    {/* Brush Style Selector Pills */}
                    <div className="flex items-center space-x-1 bg-stone-100 dark:bg-[#1a281f] p-0.5 rounded-lg border border-stone-200 dark:border-[#25382b] overflow-x-auto">
                      {(
                        [
                          { id: 'brush' as BrushStyle, label: '毛筆 (Calligraphy)' },
                          { id: 'mincho' as BrushStyle, label: '明朝体 (Mincho)' },
                          { id: 'gothic' as BrushStyle, label: 'ゴシック (Gothic)' },
                          { id: 'marker' as BrushStyle, label: 'マーカー (Chisel)' },
                          { id: 'sumi' as BrushStyle, label: '墨筆 (Sumi)' },
                          { id: 'signpen' as BrushStyle, label: 'サインペン (Signpen)' },
                          { id: 'marumoji' as BrushStyle, label: '丸文字 (Marumoji)' },
                          { id: 'fountain' as BrushStyle, label: '万年筆 (Fountain)' },
                          { id: 'plain' as BrushStyle, label: '標準 (Round)' },
                        ] as const
                      ).map((b) => (
                        <button
                          key={b.id}
                          onClick={() => setBrushStyle(b.id)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition-all ${
                            brushStyle === b.id
                              ? 'bg-emerald-800 text-white font-bold '
                              : 'text-stone-600 dark:text-stone-300 hover:text-emerald-800 dark:hover:text-white'
                          }`}
                        >
                          {b.label.split(' ')[0]}
                        </button>
                      ))}
                    </div>

                    {/* Quick Auto-Union Switch for Brush */}
                    <button
                      onClick={() => setIsAutoUnionMode(!isAutoUnionMode)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all flex items-center space-x-1 shrink-0 ${
                        isAutoUnionMode
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-600'
                          : 'bg-stone-100 text-stone-500 border-stone-200 dark:bg-[#1a261e] dark:text-stone-400 dark:border-[#25382b]'
                      }`}
                      title="描画したストロークを既存の部首パーツに自動合成・合体します"
                    >
                      <Layers className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>合体加筆: {isAutoUnionMode ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>

                  {/* Brush Width Slider & Presets */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 shrink-0">
                      太さ:
                    </span>
                    <input
                      type="range"
                      min={6}
                      max={120}
                      step={2}
                      value={brushWidth}
                      onChange={(e) => setBrushWidth(Number(e.target.value))}
                      className="w-16 sm:w-24 accent-emerald-600 h-1.5 cursor-pointer"
                    />
                    <span className="font-mono font-bold text-[11px] text-emerald-700 dark:text-emerald-300 w-8">
                      {brushWidth}px
                    </span>

                    {/* Quick Width Buttons */}
                    <div className="hidden lg:flex items-center space-x-1 border-l pl-2 border-stone-200 dark:border-[#25382b]">
                      {[12, 24, 36, 48, 72].map((w) => (
                        <button
                          key={w}
                          onClick={() => setBrushWidth(w)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                            brushWidth === w
                              ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-200 font-bold'
                              : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-[#1e2e23]'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pressure Sensitivity & Straight Mode */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 shrink-0 hidden xl:inline">
                      筆圧:
                    </span>
                    <select
                      value={pressureSensitivity}
                      onChange={(e) => setPressureSensitivity(e.target.value as any)}
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded border outline-hidden ${
                        isLight
                          ? 'bg-white border-stone-300 text-stone-700'
                          : 'bg-[#18261e] border-[#2a3e30] text-emerald-200'
                      }`}
                      title="ペンタブレットの筆圧または描画速度に応じた線の強弱シミュレーション"
                    >
                      <option value="high">感度: 高 (強弱強)</option>
                      <option value="normal">感度: 標準 (自然)</option>
                      <option value="low">感度: 低 (穏やか)</option>
                      <option value="off">固定幅 (均一)</option>
                    </select>

                    {/* Straight Mode Toggle */}
                    <button
                      onClick={() => setIsStraightMode(!isStraightMode)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                        isStraightMode
                          ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-400 text-emerald-900 dark:text-emerald-200'
                          : 'bg-white dark:bg-[#18261e] border-stone-200 dark:border-[#25382b] text-stone-500 dark:text-stone-400'
                      }`}
                      title="直線ストロークモード (Shiftキー併用可能)"
                    >
                      直線: {isStraightMode ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              ) : [
                  'rect',
                  'square',
                  'ellipse',
                  'circle',
                  'rounded_rect',
                  'pill',
                  'triangle',
                  'triangle_down',
                  'right_triangle',
                  'semicircle',
                  'ring',
                  'parallelogram',
                  'star',
                  'sparkle',
                  'starburst',
                  'heart',
                  'diamond',
                  'polygon',
                  'crescent',
                ].includes(toolMode) ? (
                /* ================= SHAPE TOOL OPTIONS ================= */
                <div className="flex items-center space-x-2.5 sm:space-x-4 shrink-0 w-full justify-between">
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 shrink-0 flex items-center space-x-1">
                      <Shapes className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>図形描画:</span>
                    </span>

                    {/* Auto-Union Switch for Shape */}
                    <button
                      onClick={() => setIsAutoUnionMode(!isAutoUnionMode)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all flex items-center space-x-1 shrink-0 ${
                        isAutoUnionMode
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-600'
                          : 'bg-stone-100 text-stone-500 border-stone-200 dark:bg-[#1a261e] dark:text-stone-400 dark:border-[#25382b]'
                      }`}
                      title="描画した図形を既存の部首パーツに自動合成・合体します"
                    >
                      <Layers className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>合体加筆: {isAutoUnionMode ? 'ON' : 'OFF'}</span>
                    </button>

                    <button
                      onClick={handleUnionPart}
                      disabled={!activePart || (activePart.contours?.length ?? 0) === 0}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-100 hover:bg-emerald-100 dark:bg-[#18261e] dark:hover:bg-[#203428] text-stone-700 dark:text-emerald-200 border border-stone-200 dark:border-[#25382b] transition-all"
                      title="現在の部首パーツと合体する"
                    >
                      既存パーツと合体
                    </button>
                  </div>

                  <div className="flex items-center space-x-2 text-[11px] text-stone-500 dark:text-stone-400">
                    <span>ドラッグして図形を配置 (Shiftキーで正形)</span>
                  </div>
                </div>
              ) : toolMode === 'pen' ? (
                /* ================= PEN TOOL OPTIONS & TIPS ================= */
                <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 w-full justify-between">
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1">
                      <PenTool className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>ベジェペン操作:</span>
                    </span>
                    <span className="text-[11px] text-stone-600 dark:text-stone-300">
                      クリックで角頂点、ドラッグで滑らかな曲率ハンドル
                    </span>
                    {/* Auto-Union Switch for Pen */}
                    <button
                      onClick={() => setIsAutoUnionMode(!isAutoUnionMode)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all flex items-center space-x-1 shrink-0 ml-2 ${
                        isAutoUnionMode
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-600'
                          : 'bg-stone-100 text-stone-500 border-stone-200 dark:bg-[#1a261e] dark:text-stone-400 dark:border-[#25382b]'
                      }`}
                      title="パス確定時に既存の部首パーツに自動合成・合体します"
                    >
                      <Layers className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>合体: {isAutoUnionMode ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {activePenContour ? (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        {isPenNearFirstNode ? '◎ 始点クリックでパスを閉じます' : `作図中 (${activePenContour.nodes.length}点)`}
                      </span>
                    ) : (
                      <span className="text-[11px] text-stone-400">
                        キャンバスをクリックしてパスを開始
                      </span>
                    )}
                    <button
                      onClick={() => setShowPenShortcutsHelp(!showPenShortcutsHelp)}
                      className="text-[11px] text-emerald-700 dark:text-emerald-400 underline font-medium"
                    >
                      ショートカット一覧
                    </button>
                  </div>
                </div>
              ) : toolMode === 'eraser' ? (
                /* ================= ERASER TOOL OPTIONS ================= */
                <div className="flex items-center space-x-2.5 sm:space-x-4 shrink-0 w-full justify-between">
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 shrink-0 flex items-center space-x-1">
                      <Eraser className="w-3.5 h-3.5 text-rose-500" />
                      <span>消しゴム:</span>
                    </span>

                    <div className="flex items-center space-x-1 bg-stone-100 dark:bg-[#1a281f] p-0.5 rounded-lg border border-stone-200 dark:border-[#25382b]">
                      <button
                        onClick={() => setEraserMode('stroke')}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                          eraserMode === 'stroke'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
                        }`}
                        title="交差した輪郭を一括削除"
                      >
                        輪郭一括
                      </button>
                      <button
                        onClick={() => setEraserMode('cut')}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                          eraserMode === 'cut'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
                        }`}
                        title="ドラッグした軌跡でベジェ曲線を切断・削り取り"
                      >
                        部分割 (Cut)
                      </button>
                      <button
                        onClick={() => setEraserMode('node')}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                          eraserMode === 'node'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
                        }`}
                        title="範囲内のアンカーノードのみ削除"
                      >
                        ノード消去
                      </button>
                    </div>

                    {/* Size Selector */}
                    <div className="flex items-center space-x-1.5 ml-2">
                      <span className="text-[10px] text-stone-400">半径:</span>
                      {[12, 24, 36, 50].map((sz) => (
                        <button
                          key={sz}
                          onClick={() => setEraserRadius(sz)}
                          className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                            eraserRadius === sz
                              ? 'bg-rose-500 text-white scale-110 shadow-xs'
                              : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-300'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-[11px] text-stone-400 hidden sm:block">
                    {eraserMode === 'cut'
                      ? 'なぞった軌跡で輪郭を削り取ります（円形プレビュー表示）'
                      : 'ドラッグまたはタップで消去します'}
                  </div>
                </div>
              ) : (
                /* ================= SELECT / NODE TOOL OPTIONS ================= */
                <div className="flex items-center space-x-2 sm:space-x-4 shrink-0 w-full justify-between">
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-[11px] font-bold text-stone-600 dark:text-stone-400 flex items-center space-x-1">
                      <MousePointer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>選択中:</span>
                    </span>

                    {selectedNodeId ? (
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950 px-2 py-0.5 rounded">
                          ノード選択中
                        </span>
                        <button
                          onClick={handleToggleSelectedNodeType}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-100 hover:bg-emerald-100 dark:bg-[#18261e] dark:hover:bg-[#203428] text-stone-700 dark:text-emerald-200 border border-stone-200 dark:border-[#25382b] transition-all"
                          title="角頂点(Corner)と滑らかな曲線頂点(Smooth)を切り替え"
                        >
                          曲率切替 (Smooth/Corner)
                        </button>
                        <button
                          onClick={handleDeleteSelectedNode}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/70 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 transition-all"
                          title="選択中のノードを削除 (Delete)"
                        >
                          ノード削除
                        </button>
                      </div>
                    ) : selectedContourId ? (
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950 px-2 py-0.5 rounded">
                          輪郭全体を選択中
                        </span>
                        <button
                          onClick={handleDuplicateSelectedContour}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-100 hover:bg-emerald-100 dark:bg-[#18261e] dark:hover:bg-[#203428] text-stone-700 dark:text-emerald-200 border border-stone-200 dark:border-[#25382b] transition-all"
                          title="選択した輪郭を複製"
                        >
                          輪郭を複製
                        </button>
                        <button
                          onClick={handleUnionPart}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 transition-all"
                          title="全輪郭と結合して1つの輪郭に合体"
                        >
                          部首と合体
                        </button>
                        <button
                          onClick={handleDeleteSelectedContour}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/70 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 transition-all"
                          title="選択した輪郭を削除 (Delete)"
                        >
                          輪郭を削除
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-stone-400">
                        頂点や輪郭をクリックして選択・ドラッグ移動
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-[11px] text-stone-400">
                    <span>キー: [V]選択 [P]ペン [B]ブラシ [E]消しゴム [Space]移動 [Ctrl+Z]元に戻す</span>
                  </div>
                </div>
              )}
            </div>

            {/* Main Interactive SVG Canvas */}
            <div ref={canvasContainerRef} className="flex-1 min-h-0 relative overflow-hidden bg-[#eaf2ec] dark:bg-[#0c130e]">
              {/* Active Pen Tool Drawing In-Progress Draggable Floating HUD Bar */}
              {activePenContour && (
                <div
                  style={
                    penHudPos
                      ? { left: `${penHudPos.x}px`, top: `${penHudPos.y}px` }
                      : { left: '50%', transform: 'translateX(-50%)', top: '20px' }
                  }
                  className="absolute z-30 pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-100"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div
                    className={`px-2 py-1 rounded-full border shadow-xl backdrop-blur-md flex items-center space-x-1.5 text-xs whitespace-nowrap ${
                      isLight
                        ? 'bg-white/95 border-emerald-300/80 text-stone-800 '
                        : 'bg-[#121c15]/95 border-emerald-700/60 text-emerald-100 '
                    }`}
                  >
                    {/* Drag Handle */}
                    <div
                      onPointerDown={handlePartPenHudPointerDown}
                      onPointerMove={handlePartPenHudPointerMove}
                      onPointerUp={handlePartPenHudPointerUp}
                      onPointerCancel={handlePartPenHudPointerUp}
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
                      type="button"
                      onClick={handleUndoPartPenNode}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center space-x-1 transition-all active:scale-95 whitespace-nowrap ${
                        isLight
                          ? 'bg-stone-100 hover:bg-emerald-100 text-stone-700 hover:text-emerald-900'
                          : 'bg-[#1e2d23] hover:bg-[#283d30] text-emerald-200'
                      }`}
                      title="直前の頂点を取り消す (Backspace)"
                    >
                      <RotateCcw className="w-3 h-3 text-stone-500 dark:text-stone-300 shrink-0" />
                      <span>1点戻す</span>
                    </button>

                    {/* Finalize as open path / stroke with configurable line thickness */}
                    <div className="relative flex items-center">
                      <button
                        type="button"
                        onClick={() => handleFinishPartPenContour(false)}
                        disabled={activePenContour.nodes.length < 2}
                        className={`px-2 py-0.5 rounded-l-full text-[11px] font-semibold flex items-center space-x-1 transition-all disabled:opacity-30 active:scale-95 whitespace-nowrap ${
                          isLight
                            ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-r border-sky-200'
                            : 'bg-sky-950/70 hover:bg-sky-900/80 text-sky-200 border-r border-sky-800'
                        }`}
                        title={`開いた線を太さ ${penStrokeWidth}px で確定する`}
                      >
                        <CornerDownLeft className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>線で確定</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowPenStrokeMenu((prev) => !prev)}
                        className={`px-1.5 py-0.5 rounded-r-full text-[10px] font-mono font-bold flex items-center space-x-0.5 transition-all active:scale-95 ${
                          isLight
                            ? 'bg-sky-100 hover:bg-sky-200 text-sky-900'
                            : 'bg-sky-900/90 hover:bg-sky-800 text-sky-100'
                        }`}
                        title="線の太さを変更"
                      >
                        <span>{penStrokeWidth}px</span>
                        <ChevronDown className="w-2.5 h-2.5 opacity-70" />
                      </button>

                      {showPenStrokeMenu && (
                        <div
                          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent pointer-events-auto"
                          onClick={() => setShowPenStrokeMenu(false)}
                        >
                          <div
                            className={`p-3 rounded-2xl shadow-2xl border flex flex-col space-y-2.5 min-w-[240px] text-xs pointer-events-auto animate-in fade-in zoom-in-95 duration-100 ${
                              isLight
                                ? 'bg-white/95 border-sky-200 text-stone-800 backdrop-blur-md'
                                : 'bg-[#0f1b14]/95 border-sky-800/80 text-sky-100 backdrop-blur-md'
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

                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => setPenStrokeWidth((prev) => Math.max(2, prev - 5))}
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
                                onChange={(e) => setPenStrokeWidth(parseInt(e.target.value, 10))}
                                className="flex-1 h-2 accent-sky-600 dark:accent-sky-500 cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => setPenStrokeWidth((prev) => Math.min(300, prev + 5))}
                                disabled={penStrokeWidth >= 300}
                                className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 font-bold text-sm flex items-center justify-center disabled:opacity-30 cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <div>
                              <span className="text-[10px] text-stone-500 dark:text-stone-400 mb-1 block">クイック太さ:</span>
                              <div className="grid grid-cols-5 gap-1 font-mono text-[11px]">
                                {[15, 25, 40, 60, 80].map((w) => (
                                  <button
                                    key={w}
                                    type="button"
                                    onClick={() => setPenStrokeWidth(w)}
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

                            <button
                              type="button"
                              onClick={() => {
                                setShowPenStrokeMenu(false);
                                handleFinishPartPenContour(false);
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
                      type="button"
                      onClick={() => handleFinishPartPenContour(true)}
                      disabled={activePenContour.nodes.length < 3}
                      className="px-2.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center space-x-1 transition-all disabled:opacity-30 active:scale-95 whitespace-nowrap"
                      title="パスを閉じて輪郭として確定する (Enter)"
                    >
                      <Check className="w-3 h-3 shrink-0" />
                      <span>閉じて確定</span>
                    </button>

                    {/* Discard / Reset Path */}
                    <button
                      onClick={handleResetPartPenContour}
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

              {/* Floating Path / Node Direct Editing Mini Toolbar Overlay */}
              {toolMode === 'select' && (selectedContourId || selectedNodeId) && activePart && (
                <div
                  className="absolute z-20 top-4 left-1/2 -translate-x-1/2 pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-100"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div
                    className={`px-2.5 py-1.5 rounded-full border shadow-xl backdrop-blur-md flex items-center space-x-1.5 text-xs ${
                      isLight
                        ? 'bg-white/95 border-emerald-300 text-stone-800 '
                        : 'bg-[#121c15]/95 border-emerald-700 text-emerald-100 '
                    }`}
                  >
                    {selectedNodeId && (
                      <>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold px-1.5 border-r border-stone-200 dark:border-stone-700">
                          選択頂点
                        </span>
                        <button
                          onClick={handleToggleSelectedNodeType}
                          className="px-2 py-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-semibold flex items-center space-x-1 transition-all"
                          title="直線角 ↔ Smooth曲線を切り替え"
                        >
                          <CircleDot className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>{getSelectedNodeType() === 'smooth' ? '角に変更' : '曲線に変更'}</span>
                        </button>
                        <button
                          onClick={handleDeleteSelectedNode}
                          className="px-2 py-0.5 rounded-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 font-semibold flex items-center space-x-1 transition-all"
                          title="選択した頂点を削除 (Delete)"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                          <span>頂点削除</span>
                        </button>
                        <div className="w-px h-3.5 bg-stone-300 dark:bg-stone-700 mx-0.5" />
                      </>
                    )}

                    {selectedContourId && (
                      <>
                        <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold px-1.5 border-r border-stone-200 dark:border-stone-700">
                          輪郭 ({getContourNodeCount()}点)
                        </span>
                        <button
                          onClick={handleDuplicateSelectedContour}
                          className="px-2 py-0.5 rounded-full bg-stone-100 hover:bg-emerald-100 dark:bg-[#1e2d22] dark:hover:bg-[#283e2e] text-stone-800 dark:text-emerald-200 font-semibold flex items-center space-x-1 transition-all"
                          title="選択した輪郭を複製"
                        >
                          <Copy className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>複製</span>
                        </button>
                        <button
                          onClick={() => handleFlipSelectedContour('h')}
                          className="px-2 py-0.5 rounded-full bg-stone-100 hover:bg-emerald-100 dark:bg-[#1e2d22] dark:hover:bg-[#283e2e] text-stone-800 dark:text-emerald-200 font-semibold flex items-center space-x-1 transition-all"
                          title="左右反転"
                        >
                          <FlipHorizontal className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>左右反転</span>
                        </button>
                        <button
                          onClick={() => handleFlipSelectedContour('v')}
                          className="px-2 py-0.5 rounded-full bg-stone-100 hover:bg-emerald-100 dark:bg-[#1e2d22] dark:hover:bg-[#283e2e] text-stone-800 dark:text-emerald-200 font-semibold flex items-center space-x-1 transition-all"
                          title="上下反転"
                        >
                          <FlipVertical className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>上下反転</span>
                        </button>
                        <button
                          onClick={handleSmoothSelectedContour}
                          className="px-2 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/70 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 font-semibold flex items-center space-x-1 transition-all"
                          title="パスの頂点数を減らしてなめらかにする"
                        >
                          <Wand2 className="w-3 h-3 text-stone-600 dark:text-stone-300" />
                          <span>滑らか化</span>
                        </button>
                        <button
                          onClick={handleDeleteSelectedContour}
                          className="px-2 py-0.5 rounded-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 font-semibold flex items-center space-x-1 transition-all"
                          title="選択した輪郭を削除 (Delete)"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                          <span>削除</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
              <svg
                ref={svgCanvasRef}
                style={{ touchAction: 'none' }}
                className={`w-full h-full select-none ${
                  toolMode === 'hand' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'
                }`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={() => {
                  setEraserHoverPos(null);
                }}
                onWheel={handleWheel}
              >
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {/* EM Square Background / Body (1000x1000) */}
                  <rect
                    x={0}
                    y={0}
                    width={1000}
                    height={1000}
                    fill={isLight ? '#ffffff' : '#141d17'}
                    stroke={isLight ? '#99b8a8' : '#2d4334'}
                    strokeWidth={2}
                  />

                  {/* Grid Lines */}
                  {showGrid && (
                    <g opacity={isLight ? 0.35 : 0.25}>
                      {Array.from({ length: 19 }).map((_, i) => {
                        const pos = (i + 1) * 50;
                        return (
                          <React.Fragment key={pos}>
                            <line
                              x1={pos}
                              y1={0}
                              x2={pos}
                              y2={1000}
                              stroke={isLight ? '#c0d6cb' : '#223629'}
                              strokeWidth={1}
                            />
                            <line
                              x1={0}
                              y1={pos}
                              x2={1000}
                              y2={pos}
                              stroke={isLight ? '#c0d6cb' : '#223629'}
                              strokeWidth={1}
                            />
                          </React.Fragment>
                        );
                      })}
                    </g>
                  )}

                  {/* Nine Boxes (九宮格) */}
                  {showNineBoxes && (
                    <g opacity={0.65} strokeDasharray="6 4">
                      <line x1={333} y1={0} x2={333} y2={1000} stroke="#3b82f6" strokeWidth={1.5} />
                      <line x1={666} y1={0} x2={666} y2={1000} stroke="#3b82f6" strokeWidth={1.5} />
                      <line x1={0} y1={333} x2={1000} y2={333} stroke="#3b82f6" strokeWidth={1.5} />
                      <line x1={0} y1={666} x2={1000} y2={666} stroke="#3b82f6" strokeWidth={1.5} />
                    </g>
                  )}

                  {/* Kanji Hen / Tsukuri & Kanmuri / Ashi Split Guide Boxes */}
                  {showKanjiGuides && (
                    <g opacity={0.7}>
                      {/* Hen Guide Box (Left 46%) */}
                      <rect
                        x={40}
                        y={40}
                        width={420}
                        height={920}
                        fill="#10b981"
                        fillOpacity={0.03}
                        stroke="#10b981"
                        strokeWidth={1.5}
                        strokeDasharray="5 5"
                      />
                      <text x={50} y={80} fill="#10b981" fontSize={26} fontWeight="bold" opacity={0.6}>
                        偏 (HEN)
                      </text>

                      {/* Tsukuri Guide Box (Right 46%) */}
                      <rect
                        x={540}
                        y={40}
                        width={420}
                        height={920}
                        fill="#3b82f6"
                        fillOpacity={0.03}
                        stroke="#3b82f6"
                        strokeWidth={1.5}
                        strokeDasharray="5 5"
                      />
                      <text x={550} y={80} fill="#3b82f6" fontSize={26} fontWeight="bold" opacity={0.6}>
                        旁 (TSUKURI)
                      </text>

                      {/* Kanmuri Guide Box (Top 36%) */}
                      <rect
                        x={40}
                        y={40}
                        width={920}
                        height={340}
                        fill="#f59e0b"
                        fillOpacity={0.02}
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeDasharray="4 6"
                      />
                      <text x={840} y={80} fill="#f59e0b" fontSize={26} fontWeight="bold" opacity={0.6}>
                        冠
                      </text>

                      {/* Ashi Guide Box (Bottom 36%) */}
                      <rect
                        x={40}
                        y={620}
                        width={920}
                        height={340}
                        fill="#ec4899"
                        fillOpacity={0.02}
                        stroke="#ec4899"
                        strokeWidth={1.5}
                        strokeDasharray="4 6"
                      />
                      <text x={840} y={660} fill="#ec4899" fontSize={26} fontWeight="bold" opacity={0.6}>
                        脚
                      </text>

                      {/* Center Crosshairs */}
                      <line
                        x1={500}
                        y1={0}
                        x2={500}
                        y2={1000}
                        stroke="#10b981"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                      />
                      <line
                        x1={0}
                        y1={500}
                        x2={1000}
                        y2={500}
                        stroke="#10b981"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                      />
                    </g>
                  )}

                  {/* Standard Metrics Line */}
                  {showMetrics && (
                    <g opacity={0.7}>
                      <line
                        x1={0}
                        y1={SCREEN_BASELINE_Y}
                        x2={1000}
                        y2={SCREEN_BASELINE_Y}
                        stroke="#ef4444"
                        strokeWidth={1.5}
                      />
                      <text
                        x={10}
                        y={SCREEN_BASELINE_Y - 8}
                        fill="#ef4444"
                        fontSize={22}
                        fontWeight="bold"
                      >
                        Baseline (y=800)
                      </text>
                    </g>
                  )}

                  {/* Target Character Watermark Background */}
                  {showWatermark && (
                    <g
                      transform={
                        watermarkScale !== 1.0
                          ? `translate(${500 * (1 - watermarkScale)}, ${500 * (1 - watermarkScale)}) scale(${watermarkScale})`
                          : undefined
                      }
                    >
                      {(() => {
                        const allGlyphs = Object.values(project.glyphs || {}) as GlyphData[];
                        const bgGlyph = allGlyphs.find((g) => g.char === watermarkChar || (watermarkChar && g.unicode === watermarkChar.codePointAt(0)));
                        if (bgGlyph && bgGlyph.contours && bgGlyph.contours.length > 0) {
                          return (
                            <path
                              d={contoursToSvgPath(bgGlyph.contours)}
                              fill={isLight ? '#047857' : '#34d399'}
                              fillOpacity={watermarkOpacity}
                              fillRule="evenodd"
                              stroke={isLight ? '#059669' : '#10b981'}
                              strokeWidth={1.5}
                              strokeDasharray="4 4"
                              pointerEvents="none"
                            />
                          );
                        }
                        return (
                          <text
                            x={500}
                            y={720}
                            textAnchor="middle"
                            fill={isLight ? '#10b981' : '#34d399'}
                            fillOpacity={watermarkOpacity}
                            fontSize={680}
                            fontWeight="bold"
                            pointerEvents="none"
                            style={{ fontFamily: 'sans-serif' }}
                          >
                            {watermarkChar}
                          </text>
                        );
                      })()}
                    </g>
                  )}

                  {/* Active Magnetic Snap Lines Overlay */}
                  {isSnapEnabled && activeSnapLines.x !== null && (
                    <g pointerEvents="none">
                      <line
                        x1={activeSnapLines.x}
                        y1={0}
                        x2={activeSnapLines.x}
                        y2={1000}
                        stroke="#06b6d4"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                      />
                      <circle cx={activeSnapLines.x} cy={500} r={5} fill="#06b6d4" />
                    </g>
                  )}
                  {isSnapEnabled && activeSnapLines.y !== null && (
                    <g pointerEvents="none">
                      <line
                        x1={0}
                        y1={activeSnapLines.y}
                        x2={1000}
                        y2={activeSnapLines.y}
                        stroke="#06b6d4"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                      />
                      <circle cx={500} cy={activeSnapLines.y} r={5} fill="#06b6d4" />
                    </g>
                  )}

                  {/* ================= DRAWN GLYPH PATHS ================= */}
                  {/* Main Part Contours */}
                  {mainSvgPath && (
                    <path
                      d={mainSvgPath}
                      fill={isWireframeMode ? 'none' : (isLight ? '#1c2920' : '#ecfdf5')}
                      fillRule="evenodd"
                      stroke={isLight ? '#047857' : '#34d399'}
                      strokeWidth={isWireframeMode ? 2.5 : 1}
                    />
                  )}

                  {/* Selected Contour Highlight */}
                  {selectedContourId && activePart && (
                    (() => {
                      const sel = activePart.contours.find((c) => c.id === selectedContourId);
                      if (!sel) return null;
                      return (
                        <path
                          d={contoursToSvgPath([sel])}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth={3}
                          strokeDasharray="6 4"
                        />
                      );
                    })()
                  )}

                  {/* Real-time High-Performance Live Brush Path */}
                  <path
                    ref={activeBrushPathRef}
                    d={brushSvgPath || ''}
                    fill={isLight ? '#047857' : '#34d399'}
                    fillOpacity={0.88}
                  />

                  {/* Real-time Cut Eraser Ribbon Preview Path */}
                  <path
                    ref={activeEraserPathRef}
                    d=""
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth={eraserRadius * 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.45}
                    pointerEvents="none"
                  />

                  {/* Real-time Circular Touch & Mouse Reticle */}
                  {toolMode === 'eraser' && eraserHoverPos && (
                    <g pointerEvents="none">
                      <circle
                        cx={eraserHoverPos.x}
                        cy={eraserHoverPos.y}
                        r={eraserRadius}
                        fill="#f43f5e"
                        fillOpacity={0.16}
                        stroke="#f43f5e"
                        strokeWidth={2 / zoom}
                        strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                      />
                      <circle
                        cx={eraserHoverPos.x}
                        cy={eraserHoverPos.y}
                        r={Math.max(2, 3 / zoom)}
                        fill="#f43f5e"
                      />
                    </g>
                  )}

                  {/* Active Pen Path in-progress */}
                  {penSvgPath && (
                    <path
                      d={penSvgPath}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth={3}
                    />
                  )}

                  {/* In-progress Pen Ghost Segment to current cursor */}
                  {toolMode === 'pen' && activePenContour && penMousePos && activePenContour.nodes.length > 0 && (
                    (() => {
                      const lastNode = activePenContour.nodes[activePenContour.nodes.length - 1];
                      return (
                        <g pointerEvents="none" opacity={0.65}>
                          <line
                            x1={lastNode.x}
                            y1={lastNode.y}
                            x2={penMousePos.x}
                            y2={penMousePos.y}
                            stroke="#10b981"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                          />
                          {isPenNearFirstNode && activePenContour.nodes.length >= 2 && (
                            <circle
                              cx={activePenContour.nodes[0].x}
                              cy={activePenContour.nodes[0].y}
                              r={10}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth={2.5}
                            />
                          )}
                        </g>
                      );
                    })()
                  )}

                  {/* Active Shape in-progress */}
                  {shapeStartPoint && shapeCurrentPoint && (
                    <path
                      d={contoursToSvgPath(
                        getShapeContours(toolMode, shapeStartPoint, shapeCurrentPoint)
                      )}
                      fill="#f59e0b"
                      fillOpacity={0.35}
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fillRule="evenodd"
                      pointerEvents="none"
                    />
                  )}

                  {/* Bezier Nodes, Bounding Box & Interactive Tangent Handles */}
                  {activePart &&
                    activePart.contours.map((contour) => {
                      const isContourSelected = selectedContourId === contour.id;
                      return (
                        <g key={contour.id}>
                          {/* Selected Contour Bounding Box Overlay */}
                          {isContourSelected && (
                            (() => {
                              const bbox = getContoursBoundingBox([contour]);
                              return (
                                <g pointerEvents="none">
                                  <rect
                                    x={bbox.minX - 6}
                                    y={bbox.minY - 6}
                                    width={bbox.width + 12}
                                    height={bbox.height + 12}
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth={Math.max(1, 1.5 / zoom)}
                                    strokeDasharray="4 4"
                                  />
                                </g>
                              );
                            })()
                          )}

                          {contour.nodes.map((node) => {
                            const isNodeSelected = selectedNodeId === node.id;
                            const showHandles = isNodeSelected || isContourSelected;
                            const isContourActive = isContourSelected || (activePart && activePart.contours.length === 1);
                            
                            // Clean, subtle, high-precision node sizing
                            const nodeRadius = isNodeSelected
                              ? Math.max(2.8, Math.min(4.8, 3.8 / Math.sqrt(Math.max(0.3, zoom))))
                              : isContourActive
                              ? Math.max(1.8, Math.min(3.2, 2.4 / Math.sqrt(Math.max(0.3, zoom))))
                              : Math.max(1.2, Math.min(2.0, 1.6 / Math.sqrt(Math.max(0.3, zoom))));
                            const handleRadius = Math.max(1.5, Math.min(2.8, 2.0 / Math.sqrt(Math.max(0.3, zoom))));
                            const strokeW = Math.max(0.6, Math.min(1.2, 0.9 / Math.sqrt(Math.max(0.3, zoom))));
                            const nodeOpacity = isNodeSelected ? 1.0 : isContourActive ? 0.9 : 0.45;

                            return (
                              <g key={node.id} opacity={nodeOpacity}>
                                {/* Tangent Handles for selected node / contour */}
                                {showHandles && (
                                  <g pointerEvents="none">
                                    {node.handleIn && (
                                      <g>
                                        <line
                                          x1={node.x}
                                          y1={node.y}
                                          x2={node.handleIn.x}
                                          y2={node.handleIn.y}
                                          stroke="#3b82f6"
                                          strokeWidth={strokeW}
                                          strokeDasharray={isNodeSelected ? undefined : '2 2'}
                                          opacity={isNodeSelected ? 0.9 : 0.5}
                                        />
                                        <circle
                                          cx={node.handleIn.x}
                                          cy={node.handleIn.y}
                                          r={handleRadius}
                                          fill="#3b82f6"
                                          stroke="#ffffff"
                                          strokeWidth={strokeW}
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
                                          stroke="#f59e0b"
                                          strokeWidth={strokeW}
                                          strokeDasharray={isNodeSelected ? undefined : '2 2'}
                                          opacity={isNodeSelected ? 0.9 : 0.5}
                                        />
                                        <circle
                                          cx={node.handleOut.x}
                                          cy={node.handleOut.y}
                                          r={handleRadius}
                                          fill="#f59e0b"
                                          stroke="#ffffff"
                                          strokeWidth={strokeW}
                                        />
                                      </g>
                                    )}
                                  </g>
                                )}

                                {/* Anchor Point Node */}
                                {node.type === 'smooth' ? (
                                  <circle
                                    cx={node.x}
                                    cy={node.y}
                                    r={nodeRadius}
                                    fill={isNodeSelected ? '#ef4444' : isContourSelected ? '#10b981' : '#059669'}
                                    stroke="#ffffff"
                                    strokeWidth={strokeW}
                                  />
                                ) : (
                                  <rect
                                    x={node.x - nodeRadius}
                                    y={node.y - nodeRadius}
                                    width={nodeRadius * 2}
                                    height={nodeRadius * 2}
                                    rx={1}
                                    fill={isNodeSelected ? '#ef4444' : isContourSelected ? '#10b981' : '#059669'}
                                    stroke="#ffffff"
                                    strokeWidth={strokeW}
                                  />
                                )}
                              </g>
                            );
                          })}
                        </g>
                      );
                    })}

                  {/* Active Pen Contour Nodes */}
                  {activePenContour &&
                    activePenContour.nodes.map((node, idx) => (
                      <g key={node.id}>
                        {idx === 0 && (
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={7}
                            fill="#f59e0b"
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                        )}
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={idx === 0 ? 5 : 4.5}
                          fill={idx === 0 ? '#ef4444' : '#10b981'}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                        />
                        {node.handleOut && (
                          <g>
                            <line
                              x1={node.x}
                              y1={node.y}
                              x2={node.handleOut.x}
                              y2={node.handleOut.y}
                              stroke="#3b82f6"
                              strokeWidth={1.5}
                            />
                            <circle
                              cx={node.handleOut.x}
                              cy={node.handleOut.y}
                              r={4}
                              fill="#3b82f6"
                              stroke="#ffffff"
                              strokeWidth={1.5}
                            />
                          </g>
                        )}
                      </g>
                    ))}
                </g>
              </svg>

              {/* Mobile Floating Canvas Quick Controls (Zoom, Fit, Undo, Redo) */}
              <div className="md:hidden absolute top-3 right-3 z-30 flex items-center space-x-1 bg-white/95 dark:bg-[#152019]/95 backdrop-blur-md px-2 py-1 rounded-full border border-stone-200 dark:border-stone-700 shadow-lg text-xs">
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length <= 1}
                  className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 text-stone-700 dark:text-stone-300"
                  title="元に戻す"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 text-stone-700 dark:text-stone-300"
                  title="やり直す"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-3 bg-stone-300 dark:bg-stone-700 mx-0.5" />
                <button
                  onClick={() => setZoom((z) => Math.max(0.2, Number((z * 0.8).toFixed(2))))}
                  className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300"
                  title="縮小"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={resetView}
                  className="px-1 text-[10px] font-mono font-bold text-stone-700 dark:text-emerald-300"
                  title="全体表示 (フィット)"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={() => setZoom((z) => Math.min(5, Number((z * 1.25).toFixed(2))))}
                  className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300"
                  title="拡大"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* ================= RIGHT COLUMN: PART INSPECTOR & COMPOSITION ================= */}
          {!isRightSidebarOpen ? (
            <div
              className={`hidden md:flex w-10 border-l flex-col items-center py-3 shrink-0 cursor-pointer select-none transition-colors ${
                isLight
                  ? 'bg-white border-[#d8e6df] hover:bg-emerald-50/70 text-stone-600'
                  : 'bg-[#162119] border-[#25362b] hover:bg-[#1f2e23] text-emerald-300'
              }`}
              onClick={() => setIsRightSidebarOpen(true)}
              title="詳細・合成パネルを展開"
            >
              <button
                type="button"
                className="p-1 rounded text-emerald-700 dark:text-emerald-400"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="mt-6 flex flex-col items-center space-y-2">
                <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[10.5px] font-bold [writing-mode:vertical-rl] tracking-wider opacity-80">
                  {rightTab === 'compose' ? '漢字合成・挿入' : '変形・詳細設定'}
                </span>
              </div>
            </div>
          ) : (
            <div
              className={`hidden md:flex static inset-y-0 right-0 w-80 lg:w-88 xl:w-96 border-l flex-col shrink-0 min-h-0 relative overflow-hidden transition-all ${
                isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#162119] border-[#25362b]'
              }`}
            >
              {/* Right Column Header with Tab Switcher & Collapse */}
              <div
                className={`p-2 px-3 border-b flex items-center justify-between gap-2 shrink-0 ${
                  isLight ? 'bg-stone-50/80 border-[#d8e6df]' : 'bg-[#131d16] border-[#25362b]'
                }`}
              >
                <div
                  className={`flex items-center p-0.5 rounded-lg border text-xs font-semibold shrink-0 ${
                    isLight ? 'bg-stone-200/70 border-stone-200' : 'bg-[#18231c] border-[#25362b]'
                  }`}
                >
                  <button
                    onClick={() => setRightTab('transform')}
                    className={`px-2.5 sm:px-3 py-1 rounded-md transition-all whitespace-nowrap ${
                      rightTab === 'transform'
                        ? isLight
                          ? 'bg-white text-emerald-950 font-bold '
                          : 'bg-[#25362b] text-emerald-200 font-bold '
                        : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
                    }`}
                  >
                    変形・設定
                  </button>
                  <button
                    onClick={() => setRightTab('compose')}
                    className={`px-2.5 sm:px-3 py-1 rounded-md transition-all whitespace-nowrap ${
                      rightTab === 'compose'
                        ? isLight
                          ? 'bg-white text-emerald-950 font-bold '
                          : 'bg-[#25362b] text-emerald-200 font-bold '
                        : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
                    }`}
                  >
                    漢字合成・挿入
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsRightSidebarOpen(false)}
                  className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-emerald-200 shrink-0"
                  title="サイドバーを畳んでキャンバスを最大化"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {activePart ? (
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 space-y-4">
                  {/* TAB 1: TRANSFORM & SETTINGS */}
                  {rightTab === 'transform' && (
                    <>
                      {/* Part Info Form */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-950 dark:text-emerald-300">
                            パーツ基本情報
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            ID: {activePart.id.slice(0, 8)}
                          </span>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold block text-stone-500 mb-1">
                            パーツ名
                          </label>
                          <input
                            type="text"
                            value={activePart.name || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setParts((prev) =>
                                prev.map((p) => (p.id === activePart.id ? { ...p, name: val } : p))
                              );
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-md text-xs font-bold border outline-hidden ${
                              isLight
                                ? 'bg-[#f7faf8] border-[#c8ded3] focus:border-emerald-700'
                                : 'bg-[#101712] border-[#25362b] focus:border-emerald-500 text-emerald-100'
                            }`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold block text-stone-500 mb-1">
                            部位・カテゴリ分類
                          </label>
                          <select
                            value={activePart.category || 'other'}
                            onChange={(e) => {
                              const cat = e.target.value as PartCategory;
                              setParts((prev) =>
                                prev.map((p) => (p.id === activePart.id ? { ...p, category: cat } : p))
                              );
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-md text-xs font-medium border outline-hidden ${
                              isLight
                                ? 'bg-[#f7faf8] border-[#c8ded3]'
                                : 'bg-[#101712] border-[#25362b] text-emerald-100'
                            }`}
                          >
                            {CATEGORY_TABS.filter((c) => c.id !== 'all').map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold block text-stone-500 mb-1">
                            説明・メモ
                          </label>
                          <textarea
                            value={activePart.description || ''}
                            placeholder="使い回し用のメモや構成要素..."
                            rows={2}
                            onChange={(e) => {
                              const val = e.target.value;
                              setParts((prev) =>
                                prev.map((p) => (p.id === activePart.id ? { ...p, description: val } : p))
                              );
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-md text-xs border outline-hidden resize-none ${
                              isLight
                                ? 'bg-[#f7faf8] border-[#c8ded3]'
                                : 'bg-[#101712] border-[#25362b] text-emerald-100'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Overlap & White Gap Resolver Section */}
                      <div className="border-t border-stone-200/60 dark:border-stone-800/60 pt-3 space-y-2">
                        <div className="flex items-center space-x-1.5">
                          <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                            重なり・白抜け防止ツール
                          </span>
                        </div>
                        <p className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-relaxed">
                          手書き筆ストロークやパーツ交差時の白抜けを、ブール演算合体で防止します。
                        </p>
                        <div className="space-y-1.5 pt-1">
                          <button
                            onClick={handleUnionPart}
                            className={`w-full py-2 px-2.5 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5  transition-all ${
                              isLight
                                ? 'bg-emerald-800 text-white hover:bg-emerald-900'
                                : 'bg-emerald-600 text-white hover:bg-emerald-500'
                            }`}
                          >
                            <Layers className="w-4 h-4" />
                            <span>重なり合う線を合体 (白抜け解消)</span>
                          </button>
                          <button
                            onClick={handleNormalizeWinding}
                            className={`w-full py-1.5 px-2.5 rounded-lg font-semibold text-xs flex items-center justify-center space-x-1.5 border transition-all ${
                              isLight
                                ? 'bg-white border-stone-300 text-stone-800 hover:bg-stone-50'
                                : 'bg-[#1b2b20] border-stone-700 text-stone-200 hover:bg-[#23382a]'
                            }`}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>輪郭の向き（Winding）をTrueType規格に統一</span>
                          </button>
                        </div>
                      </div>

                      {/* Transform & Geometry Manipulation Section */}
                      <div className="border-t border-stone-200/60 dark:border-stone-800/60 pt-3 space-y-3">
                        <span className="text-xs font-bold block text-stone-800 dark:text-stone-200">
                          形状・位置の精密変形
                        </span>

                        {/* Scaling Controls */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 mb-1">
                            <span>拡大 / 縮小</span>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleScalePart(0.9)}
                                className="px-2 py-0.5 rounded border text-[10px] hover:bg-emerald-100 dark:hover:bg-[#23382a]"
                              >
                                -10%
                              </button>
                              <button
                                onClick={() => handleScalePart(1.1)}
                                className="px-2 py-0.5 rounded border text-[10px] hover:bg-emerald-100 dark:hover:bg-[#23382a]"
                              >
                                +10%
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {[0.5, 0.75, 1.25, 1.5].map((fac) => (
                              <button
                                key={fac}
                                onClick={() => handleScalePart(fac)}
                                className={`py-1 rounded text-center text-[10px] font-semibold border transition-all ${
                                  isLight ? 'bg-stone-50 border-stone-200 hover:bg-emerald-50' : 'bg-[#1a261e] border-[#2a3c2f] hover:bg-[#203025]'
                                }`}
                              >
                                {fac * 100}%
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Nudge & Position Arrow Pad */}
                        <div>
                          <label className="text-[11px] font-semibold block text-stone-500 mb-1.5">
                            位置微調整 (矢印で移動)
                          </label>
                          <div className="flex flex-col items-center space-y-1">
                            <button
                              onClick={() => handleNudgePart(0, -25)}
                              className="w-16 py-1 rounded border text-xs flex justify-center hover:bg-emerald-50 dark:hover:bg-[#203025]"
                              title="上に移動"
                            >
                              ▲
                            </button>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleNudgePart(-25, 0)}
                                className="w-14 py-1 rounded border text-xs flex justify-center hover:bg-emerald-50 dark:hover:bg-[#203025]"
                                title="左に移動"
                              >
                                ◀
                              </button>
                              <button
                                onClick={handleCenterPartInCanvas}
                                className="px-3 py-1 rounded font-bold text-[10.5px] bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                                title="キャンバス中央に揃える"
                              >
                                中央揃え
                              </button>
                              <button
                                onClick={() => handleNudgePart(25, 0)}
                                className="w-14 py-1 rounded border text-xs flex justify-center hover:bg-emerald-50 dark:hover:bg-[#203025]"
                                title="右に移動"
                              >
                                ▶
                              </button>
                            </div>
                            <button
                              onClick={() => handleNudgePart(0, 25)}
                              className="w-16 py-1 rounded border text-xs flex justify-center hover:bg-emerald-50 dark:hover:bg-[#203025]"
                              title="下に移動"
                            >
                              ▼
                            </button>
                          </div>
                        </div>

                        {/* Rotation & Flip */}
                        <div>
                          <label className="text-[11px] font-semibold block text-stone-500 mb-1.5">
                            反転・回転・傾斜
                          </label>
                          <div className="grid grid-cols-4 gap-1.5">
                            <button
                              onClick={handleFlipHPart}
                              className={`py-1.5 rounded text-[10.5px] font-semibold border flex flex-col items-center justify-center ${
                                isLight ? 'bg-stone-50 hover:bg-emerald-50' : 'bg-[#1a261e] hover:bg-[#223328]'
                              }`}
                              title="左右反転"
                            >
                              <FlipHorizontal className="w-3.5 h-3.5 mb-0.5" />
                              <span>左右反転</span>
                            </button>
                            <button
                              onClick={handleFlipVPart}
                              className={`py-1.5 rounded text-[10.5px] font-semibold border flex flex-col items-center justify-center ${
                                isLight ? 'bg-stone-50 hover:bg-emerald-50' : 'bg-[#1a261e] hover:bg-[#223328]'
                              }`}
                              title="上下反転"
                            >
                              <FlipVertical className="w-3.5 h-3.5 mb-0.5" />
                              <span>上下反転</span>
                            </button>
                            <button
                              onClick={() => handleRotatePart(90)}
                              className={`py-1.5 rounded text-[10.5px] font-semibold border flex flex-col items-center justify-center ${
                                isLight ? 'bg-stone-50 hover:bg-emerald-50' : 'bg-[#1a261e] hover:bg-[#223328]'
                              }`}
                              title="90度時計回りに回転"
                            >
                              <RotateCw className="w-3.5 h-3.5 mb-0.5" />
                              <span>90°回転</span>
                            </button>
                            <button
                              onClick={() => handleSlantPart(10)}
                              className={`py-1.5 rounded text-[10.5px] font-semibold border flex flex-col items-center justify-center ${
                                isLight ? 'bg-stone-50 hover:bg-emerald-50' : 'bg-[#1a261e] hover:bg-[#223328]'
                              }`}
                              title="右に10度傾斜（イタリック）"
                            >
                              <Italic className="w-3.5 h-3.5 mb-0.5" />
                              <span>傾斜 10°</span>
                            </button>
                          </div>
                        </div>

                        {/* Fit to Slot Presets */}
                        <div>
                          <label className="text-[11px] font-semibold block text-stone-500 mb-1.5">
                            偏旁枠への自動変形フィット
                          </label>
                          <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                            <button
                              onClick={() => handleFitToPlacement('hen')}
                              className="py-1.5 rounded font-bold border bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                            >
                              偏枠へ
                            </button>
                            <button
                              onClick={() => handleFitToPlacement('tsukuri')}
                              className="py-1.5 rounded font-bold border bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                            >
                              旁枠へ
                            </button>
                            <button
                              onClick={() => handleFitToPlacement('kanmuri')}
                              className="py-1.5 rounded font-bold border bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                            >
                              冠枠へ
                            </button>
                            <button
                              onClick={() => handleFitToPlacement('ashi')}
                              className="py-1.5 rounded font-bold border bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                            >
                              脚枠へ
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* SVG Single Export / Import for this part */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={handleExportPartSvg}
                          className={`py-2 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                            isLight
                              ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-50 hover:text-emerald-900'
                              : 'bg-[#18231c] border-[#25362b] text-emerald-200 hover:bg-[#202e24]'
                          }`}
                          title="このパーツを単体SVGファイルとして書き出し"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          <span>単体SVG出力</span>
                        </button>
                        <button
                          onClick={() => svgFileInputRef.current?.click()}
                          className={`py-2 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                            isLight
                              ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-50 hover:text-emerald-900'
                              : 'bg-[#18231c] border-[#25362b] text-emerald-200 hover:bg-[#202e24]'
                          }`}
                          title="外部SVGファイルをこのパーツにインポート"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>単体SVG読込</span>
                        </button>
                      </div>

                      {/* Duplicate & Delete Part */}
                      <div className="flex items-center space-x-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                        <button
                          onClick={(e) => handleDuplicatePart(activePart, e)}
                          className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center space-x-1 ${
                            isLight ? 'bg-stone-50 hover:bg-emerald-50' : 'bg-[#1a261e] hover:bg-[#203025]'
                          }`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>パーツを複製</span>
                        </button>
                        <button
                          onClick={(e) => handleDeletePart(activePart.id, e)}
                          className="py-1.5 px-3 rounded-lg border text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 border-rose-200 dark:border-rose-900"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}

                  {/* TAB 2: KANJI COMPOSITION & INSERTION */}
                  {rightTab === 'compose' && (
                    <>
                      {/* Target Glyph Info */}
                      <div
                        className={`p-3 rounded-xl border flex items-center justify-between ${
                          isLight ? 'bg-emerald-50/90 border-emerald-300' : 'bg-[#142319] border-emerald-800'
                        }`}
                      >
                        <div>
                          <span className="text-[11px] font-semibold text-stone-500 block">合成対象の文字</span>
                          <span className="text-xl font-bold font-serif text-emerald-950 dark:text-emerald-200">
                            「{selectedChar}」
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-stone-400 block">パーツ名</span>
                          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400">
                            {activePart.name}
                          </span>
                        </div>
                      </div>

                      {/* Spacious Live Kanji Composition Simulator */}
                      <div
                        className={`p-3.5 rounded-xl border space-y-2.5 ${
                          isLight ? 'bg-white border-[#d8e6df] ' : 'bg-[#131d16] border-[#25362b]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-950 dark:text-emerald-300">
                            漢字合成シミュレータ
                          </span>
                          <span className="text-[10.5px] text-stone-400 font-medium">1000×1000 仮想漢字枠</span>
                        </div>

                        {/* Large Composite Preview Frame */}
                        <div
                          className={`w-full aspect-square max-w-[280px] mx-auto rounded-xl border-2 flex items-center justify-center relative p-3 transition-all ${
                            isLight
                              ? 'bg-[#fafcfb] border-emerald-200 shadow-inner'
                              : 'bg-[#0b120d] border-emerald-900/60 shadow-inner'
                          }`}
                        >
                          <svg viewBox="0 0 1000 1000" className="w-full h-full">
                            {/* Nine-box grid guide in preview */}
                            <line x1={333} y1={0} x2={333} y2={1000} stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 4" opacity={0.3} />
                            <line x1={666} y1={0} x2={666} y2={1000} stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 4" opacity={0.3} />
                            <line x1={0} y1={333} x2={1000} y2={333} stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 4" opacity={0.3} />
                            <line x1={0} y1={666} x2={1000} y2={666} stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 4" opacity={0.3} />

                            {/* Center Crosshair */}
                            <line x1={500} y1={0} x2={500} y2={1000} stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.4} />
                            <line x1={0} y1={500} x2={1000} y2={500} stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.4} />

                            {/* Companion ghost radical to simulate actual character balance */}
                            {activePart.category === 'hen' && (
                              <g opacity={0.3}>
                                <path
                                  d={contoursToSvgPath(
                                    transformContoursForPlacement(
                                      KANJI_RADICALS.find((r) => r.id === 'rad_kihen')?.contours || [],
                                      'tsukuri'
                                    )
                                  )}
                                  fill={isLight ? '#475569' : '#94a3b8'}
                                />
                              </g>
                            )}
                            {activePart.category === 'tsukuri' && (
                              <g opacity={0.3}>
                                <path
                                  d={contoursToSvgPath(
                                    transformContoursForPlacement(
                                      KANJI_RADICALS.find((r) => r.id === 'rad_ninben')?.contours || [],
                                      'hen'
                                    )
                                  )}
                                  fill={isLight ? '#475569' : '#94a3b8'}
                                />
                              </g>
                            )}

                            {/* Render Current Part positioned per insertPlacement */}
                            <path
                              d={contoursToSvgPath(
                                normalizeGlyphContoursWinding(
                                  transformContoursForPlacement(activePart.contours, insertPlacement, activePart.category)
                                )
                              )}
                              fill={isLight ? '#064e3b' : '#34d399'}
                              fillRule="evenodd"
                            />
                          </svg>
                        </div>
                        <p className="text-[10.5px] text-stone-500 leading-relaxed text-center break-words">
                          選択中の配置設定（{insertPlacement}）に従って自動変形・配置された姿をプレビューしています
                        </p>
                      </div>

                      {/* Insertion Mode Switcher: Single vs Batch */}
                      <div className="flex rounded-xl p-1 border border-emerald-300 dark:border-emerald-800 bg-stone-100 dark:bg-[#121c15]">
                        <button
                          onClick={() => setInsertMode('single')}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            insertMode === 'single'
                              ? isLight
                                ? 'bg-white text-emerald-950 '
                                : 'bg-emerald-700 text-white '
                              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                          }`}
                        >
                          単一文字へ挿入
                        </button>
                        <button
                          onClick={() => setInsertMode('batch')}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            insertMode === 'batch'
                              ? isLight
                                ? 'bg-white text-emerald-950 '
                                : 'bg-emerald-700 text-white '
                              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                          }`}
                        >
                          複数文字へ一括挿入
                        </button>
                      </div>

                      {/* Placement Preset Selector */}
                      <div
                        className={`p-3 rounded-xl border space-y-2 ${
                          isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#152018] border-[#25362b]'
                        }`}
                      >
                        <label className="text-xs font-bold block text-stone-800 dark:text-stone-200">
                          文字への自動配置位置を選択
                        </label>
                        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                          {[
                            { id: 'original', label: 'そのまま (原寸)' },
                            { id: 'hen', label: '偏 (左46%)' },
                            { id: 'tsukuri', label: '旁 (右46%)' },
                            { id: 'kanmuri', label: '冠 (上36%)' },
                            { id: 'ashi', label: '脚 (下36%)' },
                            { id: 'center_small', label: '中央縮小 (60%)' },
                          ].map((p) => (
                            <button
                              key={p.id}
                              onClick={() => setInsertPlacement(p.id as RadicalPlacement)}
                              className={`py-2 rounded-lg text-center font-bold border transition-all ${
                                insertPlacement === p.id
                                  ? isLight
                                    ? 'bg-emerald-800 text-white border-emerald-800 '
                                    : 'bg-emerald-600 text-white border-emerald-600 '
                                  : isLight
                                  ? 'bg-stone-50 border-[#c8ded3] text-stone-700 hover:bg-emerald-50'
                                  : 'bg-[#1a2820] border-[#25362b] text-stone-300 hover:bg-[#223328]'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Single Insert Mode Controls */}
                      {insertMode === 'single' ? (
                        <div className="space-y-2 pt-2">
                          <button
                            onClick={() => handleInsertToGlyph(true)}
                            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 shadow-lg transition-all ${
                              isLight
                                ? 'bg-emerald-800 text-white hover:bg-emerald-900  active:scale-[0.99]'
                                : 'bg-emerald-600 text-white hover:bg-emerald-500  active:scale-[0.99]'
                            }`}
                          >
                            <BookmarkPlus className="w-4 h-4" />
                            <span>文字「{selectedChar}」に挿入して閉じる</span>
                          </button>
                          <button
                            onClick={() => handleInsertToGlyph(false)}
                            className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center space-x-1.5 border transition-all ${
                              isLight
                                ? 'bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50'
                                : 'bg-[#1a2920] border-emerald-800 text-emerald-300 hover:bg-[#22352a]'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>工房を開いたまま文字に挿入</span>
                          </button>
                        </div>
                      ) : (
                        /* Batch Insert Mode Controls */
                        <div className={`p-3 rounded-xl border space-y-3 ${
                          isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#152018] border-[#25362b]'
                        }`}>
                          {(() => {
                            if (!activePart) {
                              return (
                                <div className="text-xs text-stone-500 py-1">
                                  パーツが選択されていません
                                </div>
                              );
                            }
                            const partName = activePart.name || '';
                            const partCategory = activePart.category || 'other';
                            const matchingDbEntry = RADICAL_KANJI_DATABASE.find(
                              (r) =>
                                (partName && (partName.includes(r.name) || r.name.includes(partName))) ||
                                (activePart.char && r.char === activePart.char) ||
                                r.id === activePart.id
                            );

                            const categoryPresets = KANJI_PRESETS_BY_CATEGORY[partCategory] || KANJI_PRESETS_BY_CATEGORY.other;

                            return (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-stone-800 dark:text-stone-200">
                                    一括挿入の対象漢字を選択
                                  </label>
                                  <button
                                    onClick={() => setSelectedBatchChars([])}
                                    className="text-[10.5px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 font-semibold"
                                  >
                                    選択解除
                                  </button>
                                </div>

                                {/* Quick selection action buttons */}
                                <div className="flex flex-wrap gap-1.5 text-[11px]">
                                  {matchingDbEntry && matchingDbEntry.kanjiList.length > 0 && (
                                    <button
                                      onClick={() => {
                                        setSelectedBatchChars(matchingDbEntry.kanjiList);
                                        notify(`「${matchingDbEntry.name}」の部首DB全${matchingDbEntry.kanjiList.length}字を選択しました`, 'info');
                                      }}
                                      className={`px-2.5 py-1 rounded-lg font-bold flex items-center space-x-1 border transition-all ${
                                        isLight
                                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                                          : 'bg-[#18291e] border-emerald-700 text-emerald-200 hover:bg-[#203628]'
                                      }`}
                                      title={`部首DB「${matchingDbEntry.name}」に属する${matchingDbEntry.kanjiList.length}文字すべてを選択`}
                                    >
                                      <BookmarkPlus className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                      <span>部首DB全{matchingDbEntry.kanjiList.length}字を選択</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setSelectedBatchChars(categoryPresets);
                                    }}
                                    className={`px-2 py-1 rounded-lg font-semibold border transition-all ${
                                      isLight
                                        ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                                        : 'bg-[#152018] border-stone-800 text-stone-300 hover:bg-[#1a291f]'
                                    }`}
                                  >
                                    カテゴリー推奨({categoryPresets.length}字)
                                  </button>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Preset Kanji Chips */}
                          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1.5 rounded-lg border bg-stone-50 dark:bg-[#0f1711] border-stone-200 dark:border-stone-800">
                            {((activePart ? KANJI_PRESETS_BY_CATEGORY[activePart.category] : null) || KANJI_PRESETS_BY_CATEGORY.other).map((kanji, kIdx) => {
                              const isSelected = selectedBatchChars.includes(kanji);
                              return (
                                <button
                                  key={`batch_preset_${activePart?.category || 'other'}_${kanji}_${kIdx}`}
                                  onClick={() => {
                                    setSelectedBatchChars((prev) =>
                                      prev.includes(kanji) ? prev.filter((k) => k !== kanji) : [...prev, kanji]
                                    );
                                  }}
                                  className={`w-7 h-7 rounded-md font-bold text-xs flex items-center justify-center transition-all ${
                                    isSelected
                                      ? 'bg-emerald-700 text-white  scale-105'
                                      : isLight
                                      ? 'bg-white border border-stone-200 text-stone-700 hover:border-emerald-400'
                                      : 'bg-[#18261e] border border-stone-800 text-stone-300 hover:border-emerald-600'
                                  }`}
                                >
                                  {kanji}
                                </button>
                              );
                            })}
                          </div>

                          {/* Custom Kanji Input */}
                          <div>
                            <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 block mb-1">
                              追加の対象漢字を直接入力（連続入力OK）:
                            </span>
                            <input
                              type="text"
                              value={batchCharsInput}
                              onChange={(e) => setBatchCharsInput(e.target.value)}
                              placeholder="例: 休体位作保信"
                              className={`w-full px-3 py-1.5 rounded-lg text-xs font-bold border outline-hidden transition-colors ${
                                isLight
                                  ? 'bg-[#f7faf8] border-[#c8ded3] focus:border-emerald-700'
                                  : 'bg-[#101712] border-[#25362b] focus:border-emerald-500 text-emerald-100'
                              }`}
                            />
                          </div>

                          {/* Primary Batch Action Button */}
                          <div className="space-y-1.5 pt-1">
                            <button
                              onClick={() => handleBatchInsertToGlyphs(true)}
                              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 shadow-lg transition-all ${
                                isLight
                                  ? 'bg-emerald-800 text-white hover:bg-emerald-900  active:scale-[0.99]'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-500  active:scale-[0.99]'
                              }`}
                            >
                              <BookmarkPlus className="w-4 h-4" />
                              <span>
                                選択された {Array.from(new Set([...selectedBatchChars, ...batchCharsInput.split('').filter((c) => c.trim())])).length} 文字に一括挿入して閉じる
                              </span>
                            </button>
                            <button
                              onClick={() => handleBatchInsertToGlyphs(false)}
                              className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center space-x-1.5 border transition-all ${
                                isLight
                                  ? 'bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50'
                                  : 'bg-[#1a2920] border-emerald-800 text-emerald-300 hover:bg-[#22352a]'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>工房を開いたまま一括挿入</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-stone-400 space-y-2">
                  <Shapes className="w-8 h-8 text-stone-300 dark:text-stone-700" />
                  <p>左側のライブラリからパーツを選択するか、新規パーツを作成してください</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= MOBILE RESPONSIVE BOTTOM SHEET ================= */}
        <div
          className={`flex md:hidden fixed bottom-0 inset-x-0 z-40 flex-col transition-all duration-300 ease-out shadow-2xl border-t select-none ${
            isLight
              ? 'bg-white/98 border-stone-300 text-stone-800'
              : 'bg-[#121c15]/98 border-[#25362b] text-emerald-100'
          }`}
          style={{
            height:
              mobileSheetSnap === 'peek'
                ? 'calc(54px + env(safe-area-inset-bottom, 0px))'
                : mobileSheetSnap === 'half'
                ? '48vh'
                : '85vh',
            paddingBottom: mobileSheetSnap === 'peek' ? 'max(env(safe-area-inset-bottom, 0px), 2px)' : '0px',
          }}
        >
          {/* Bottom Sheet Grab Handle & Mode Toggle */}
          <div
            className="w-full flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing select-none"
            onClick={() => {
              if (mobileSheetSnap === 'peek') setMobileSheetSnap('half');
              else if (mobileSheetSnap === 'half') setMobileSheetSnap('full');
              else setMobileSheetSnap('peek');
            }}
          >
            <div className="w-10 h-1.5 bg-stone-300 dark:bg-stone-600 rounded-full" />
          </div>

          {/* Bottom Sheet 4-Tab Navigation Strip */}
          <div className="flex items-center justify-around px-1 pb-1 border-b border-inherit shrink-0">
            <button
              onClick={() => {
                setMobileSheetTab('radicals');
                if (mobileSheetSnap === 'peek') setMobileSheetSnap('half');
              }}
              className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 rounded-lg transition-all ${
                mobileSheetTab === 'radicals' && mobileSheetSnap !== 'peek'
                  ? 'text-emerald-700 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/40'
                  : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
              }`}
            >
              <Shapes className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">部首</span>
            </button>

            <button
              onClick={() => {
                setMobileSheetTab('parts');
                if (mobileSheetSnap === 'peek') setMobileSheetSnap('half');
              }}
              className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 rounded-lg transition-all ${
                mobileSheetTab === 'parts' && mobileSheetSnap !== 'peek'
                  ? 'text-emerald-700 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/40'
                  : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">パーツ ({parts.length})</span>
            </button>

            <button
              onClick={() => {
                setMobileSheetTab('transform');
                if (mobileSheetSnap === 'peek') setMobileSheetSnap('half');
              }}
              className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 rounded-lg transition-all ${
                mobileSheetTab === 'transform' && mobileSheetSnap !== 'peek'
                  ? 'text-emerald-700 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/40'
                  : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">変形</span>
            </button>

            <button
              onClick={() => {
                setMobileSheetTab('compose');
                if (mobileSheetSnap === 'peek') setMobileSheetSnap('half');
              }}
              className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 rounded-lg transition-all ${
                mobileSheetTab === 'compose' && mobileSheetSnap !== 'peek'
                  ? 'text-emerald-700 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/40'
                  : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
              }`}
            >
              <BookmarkPlus className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">合成</span>
            </button>

            {/* Snap expand/collapse toggle button */}
            <button
              onClick={() => {
                if (mobileSheetSnap === 'peek') setMobileSheetSnap('half');
                else if (mobileSheetSnap === 'half') setMobileSheetSnap('peek');
                else setMobileSheetSnap('half');
              }}
              className="px-2 min-h-[44px] flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-emerald-300"
              title="シートの展開/縮小"
            >
              {mobileSheetSnap === 'peek' ? (
                <ChevronLeft className="w-4 h-4 -rotate-90" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Bottom Sheet Expandable Content */}
          {mobileSheetSnap !== 'peek' && (
            <div className="flex-1 min-h-0 overflow-y-auto p-3 overscroll-contain">
              {mobileSheetTab === 'radicals' && (
                <div className="space-y-3 pb-8">
                  {/* Category switcher */}
                  <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-stone-200/70 dark:bg-[#1b261f]">
                    <button
                      onClick={() => setLeftSidebarTab('presets')}
                      className={`py-1.5 text-xs font-bold rounded-md ${
                        leftSidebarTab === 'presets'
                          ? 'bg-white dark:bg-[#25362b] text-emerald-900 dark:text-emerald-200 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      標準部首 214
                    </button>
                    <button
                      onClick={() => setLeftSidebarTab('kanji_db')}
                      className={`py-1.5 text-xs font-bold rounded-md ${
                        leftSidebarTab === 'kanji_db'
                          ? 'bg-white dark:bg-[#25362b] text-emerald-900 dark:text-emerald-200 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      部首別漢字
                    </button>
                    <button
                      onClick={() => setLeftSidebarTab('custom')}
                      className={`py-1.5 text-xs font-bold rounded-md ${
                        leftSidebarTab === 'custom'
                          ? 'bg-white dark:bg-[#25362b] text-emerald-900 dark:text-emerald-200 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      マイパーツ ({parts.length})
                    </button>
                  </div>

                  {/* Search box */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="部首名・読み・漢字で検索..."
                      className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs font-bold border outline-hidden ${
                        isLight
                          ? 'bg-stone-50 border-stone-300 text-stone-800'
                          : 'bg-[#18241c] border-stone-700 text-emerald-100'
                      }`}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Dynamic Radical Content based on category sub-tab */}
                  {leftSidebarTab === 'presets' && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {filteredPresets.map((item) => (
                        <button
                          key={`m_preset_${item.id}`}
                          onClick={() => handleLoadPreset(item)}
                          className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 active:scale-95 transition-all min-h-[58px] ${
                            isLight
                              ? 'bg-stone-50/80 border-stone-200 hover:border-emerald-500 hover:bg-white text-stone-800'
                              : 'bg-[#18261e] border-stone-800 hover:border-emerald-500 hover:bg-[#203328] text-emerald-100'
                          }`}
                        >
                          <span className="text-xl font-bold leading-none">{item.char}</span>
                          <span className="text-[10px] text-stone-500 dark:text-stone-400 truncate max-w-full">
                            {item.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {leftSidebarTab === 'kanji_db' && (
                    <div className="space-y-2">
                      {searchRadicalDatabase(searchQuery, 'all').slice(0, 40).map((radical) => {
                        const isExpanded = selectedRadicalDbId === radical.id;
                        return (
                          <div
                            key={`m_db_${radical.id}`}
                            className={`rounded-xl border overflow-hidden ${
                              isExpanded
                                ? isLight ? 'bg-white border-emerald-600' : 'bg-[#16241b] border-emerald-500'
                                : isLight ? 'bg-stone-50/80 border-stone-200' : 'bg-[#18261e] border-stone-800'
                            }`}
                          >
                            <div
                              onClick={() => setSelectedRadicalDbId(isExpanded ? '' : radical.id)}
                              className="p-2.5 flex items-center justify-between cursor-pointer"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-700 text-white font-bold text-sm shrink-0 font-serif">
                                  {radical.char}
                                </span>
                                <div>
                                  <div className="text-xs font-bold text-stone-800 dark:text-emerald-100">
                                    {radical.name} ({radical.strokes}画)
                                  </div>
                                  <div className="text-[10px] text-stone-400">
                                    {radical.kanjiList.length}字収録
                                  </div>
                                </div>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${isExpanded ? 'rotate-180 text-emerald-600' : ''}`} />
                            </div>

                            {isExpanded && (
                              <div className="p-2.5 pt-0 border-t border-inherit space-y-2">
                                <div className="grid grid-cols-5 gap-1.5 pt-2 max-h-36 overflow-y-auto">
                                  {radical.kanjiList.map((kanji, kIdx) => (
                                    <button
                                      key={`m_k_${radical.id}_${kanji}_${kIdx}`}
                                      onClick={() => {
                                        setWatermarkChar(kanji);
                                        setShowWatermark(true);
                                        notify(`「${kanji}」を下絵ガイドに設定しました`, 'info');
                                      }}
                                      className="p-2 rounded-lg text-sm font-serif font-bold bg-white dark:bg-[#121b14] border border-stone-200 dark:border-stone-700 text-center"
                                    >
                                      {kanji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {leftSidebarTab === 'custom' && (
                    <div className="space-y-2">
                      <button
                        onClick={() => handleCreateNewPart(activeCategory)}
                        className="w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center space-x-1.5 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>新規マイパーツを作成</span>
                      </button>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {parts.map((p) => (
                          <button
                            key={`m_custom_p_${p.id}`}
                            onClick={() => setSelectedPartId(p.id)}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 ${
                              p.id === selectedPartId
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                                : isLight ? 'bg-white border-stone-200 text-stone-800' : 'bg-[#18261e] border-stone-800 text-emerald-100'
                            }`}
                          >
                            <svg viewBox="0 0 1000 1000" className="w-6 h-6">
                              <path d={contoursToSvgPath(p.contours || [])} fill="currentColor" />
                            </svg>
                            <span className="text-[10px] font-bold truncate max-w-full">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {mobileSheetTab === 'parts' && (
                <div className="space-y-3 pb-8">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-600 dark:text-stone-400">
                      パーツ構成 ({parts.length}個)
                    </span>
                    <button
                      onClick={() => handleCreateNewPart(activeCategory)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>パーツ追加</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {parts.map((part) => {
                      const isSelected = part.id === selectedPartId;
                      return (
                        <div
                          key={`m_part_${part.id}`}
                          onClick={() => setSelectedPartId(part.id)}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500'
                              : isLight
                              ? 'bg-stone-50 border-stone-200 hover:bg-white'
                              : 'bg-[#18261e] border-stone-800 hover:bg-[#203429]'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-black/30 border border-stone-200 dark:border-stone-700 flex items-center justify-center shrink-0">
                              <svg viewBox="0 0 1000 1000" className="w-6 h-6">
                                <path
                                  d={contoursToSvgPath(part.contours || [])}
                                  fill={isLight ? '#047857' : '#34d399'}
                                />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate">{part.name}</div>
                              <div className="text-[10px] text-stone-400">
                                輪郭 {part.contours?.length ?? 0}個
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicatePart(part.id);
                              }}
                              className="p-2 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title="複製"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePart(part.id);
                              }}
                              className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {mobileSheetTab === 'transform' && (
                <div className="space-y-4 pb-8">
                  <div className="text-xs font-bold text-stone-600 dark:text-stone-400">
                    選択パーツの変形・配置調整
                  </div>

                  {activePart ? (
                    <div className="space-y-3">
                      {/* Scale */}
                      <div className="p-3 rounded-xl border bg-stone-50 dark:bg-[#16221a] border-stone-200 dark:border-stone-800 space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span>拡大縮小 (Scale)</span>
                          <span className="font-mono text-emerald-600">100%</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {[0.7, 0.85, 1.15, 1.3].map((sc) => (
                            <button
                              key={`scale_btn_${sc}`}
                              onClick={() => {
                                const scaled = scaleContours(activePart.contours, sc, sc);
                                commitPartChange(scaled);
                              }}
                              className="py-2 rounded-lg text-xs font-bold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 active:scale-95 transition-all min-h-[44px]"
                            >
                              {sc > 1 ? `+${Math.round((sc - 1) * 100)}%` : `-${Math.round((1 - sc) * 100)}%`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Rotate & Slant */}
                      <div className="p-3 rounded-xl border bg-stone-50 dark:bg-[#16221a] border-stone-200 dark:border-stone-800 space-y-1.5">
                        <div className="text-xs font-bold">回転・傾斜 (Rotate / Slant)</div>
                        <div className="grid grid-cols-4 gap-2">
                          <button
                            onClick={() => {
                              const rotated = rotateSingleContour(activePart.contours[0] || ({} as any), -15);
                              commitPartChange(activePart.contours.map((c, i) => i === 0 ? rotated : c));
                            }}
                            className="py-2 rounded-lg text-xs font-bold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center space-x-1 active:scale-95 min-h-[44px]"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>-15°</span>
                          </button>
                          <button
                            onClick={() => {
                              const rotated = rotateSingleContour(activePart.contours[0] || ({} as any), 15);
                              commitPartChange(activePart.contours.map((c, i) => i === 0 ? rotated : c));
                            }}
                            className="py-2 rounded-lg text-xs font-bold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center space-x-1 active:scale-95 min-h-[44px]"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>+15°</span>
                          </button>
                          <button
                            onClick={() => {
                              const slanted = slantContours(activePart.contours, -0.2);
                              commitPartChange(slanted);
                            }}
                            className="py-2 rounded-lg text-xs font-bold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center space-x-1 active:scale-95 min-h-[44px]"
                          >
                            <Italic className="w-3.5 h-3.5" />
                            <span>左斜</span>
                          </button>
                          <button
                            onClick={() => {
                              const slanted = slantContours(activePart.contours, 0.2);
                              commitPartChange(slanted);
                            }}
                            className="py-2 rounded-lg text-xs font-bold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center space-x-1 active:scale-95 min-h-[44px]"
                          >
                            <Italic className="w-3.5 h-3.5" />
                            <span>右斜</span>
                          </button>
                        </div>
                      </div>

                      {/* Mirror / Flip */}
                      <div className="p-3 rounded-xl border bg-stone-50 dark:bg-[#16221a] border-stone-200 dark:border-stone-800 space-y-1.5">
                        <div className="text-xs font-bold">反転・配置 (Flip / Center)</div>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => {
                              const flipped = flipContoursHorizontal(activePart.contours);
                              commitPartChange(flipped);
                            }}
                            className="py-2 rounded-lg text-xs font-bold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center space-x-1 active:scale-95 min-h-[44px]"
                          >
                            <FlipHorizontal className="w-3.5 h-3.5" />
                            <span>左右反転</span>
                          </button>
                          <button
                            onClick={() => {
                              const flipped = flipContoursVertical(activePart.contours);
                              commitPartChange(flipped);
                            }}
                            className="py-2 rounded-lg text-xs font-bold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center space-x-1 active:scale-95 min-h-[44px]"
                          >
                            <FlipVertical className="w-3.5 h-3.5" />
                            <span>上下反転</span>
                          </button>
                          <button
                            onClick={handleCenterPartInCanvas}
                            className="py-2 rounded-lg text-xs font-bold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center space-x-1 active:scale-95 min-h-[44px]"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>中央揃え</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-stone-400 text-xs text-center py-6">
                      パーツを選択してください
                    </div>
                  )}
                </div>
              )}

              {mobileSheetTab === 'compose' && (
                <div className="space-y-3 pb-8">
                  <div className="text-xs font-bold text-stone-600 dark:text-stone-400">
                    現在の文字「{selectedChar}」へ部首を適用
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'hen' as RadicalPlacement, label: '偏 (へん / 左側)' },
                        { id: 'tsukuri' as RadicalPlacement, label: '旁 (つくり / 右側)' },
                        { id: 'kanmuri' as RadicalPlacement, label: '冠 (かんむり / 上部)' },
                        { id: 'ashi' as RadicalPlacement, label: '脚 (あし / 下部)' },
                        { id: 'kamae' as RadicalPlacement, label: '構 (かまえ / 外枠)' },
                        { id: 'original' as RadicalPlacement, label: '全体 (等倍配置)' },
                      ] as const
                    ).map((plc) => (
                      <button
                        key={`m_plc_${plc.id}`}
                        onClick={() => handleQuickInsertPlacement(plc.id)}
                        disabled={!activePart || (activePart.contours?.length ?? 0) === 0}
                        className="p-2.5 rounded-xl border bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-40 min-h-[54px]"
                      >
                        <span className="text-sm font-bold">{plc.label.split(' ')[0]}</span>
                        <span className="text-[10px] text-stone-400">{plc.label.split(' ')[1]}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleQuickInsertPlacement('original', true)}
                    disabled={!activePart || (activePart.contours?.length ?? 0) === 0}
                    className="w-full py-3 rounded-xl font-bold text-sm bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/20 active:scale-98 min-h-[48px]"
                  >
                    <Check className="w-4 h-4" />
                    <span>「{selectedChar}」にパーツを保存・反映</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ================= KEYBOARD SHORTCUTS & PEN HELP MODAL ================= */}
      {showPenShortcutsHelp && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div
            className={`w-full max-w-md rounded-xl border shadow-2xl flex flex-col overflow-hidden ${
              isLight ? 'bg-white border-[#c8ded3]' : 'bg-[#16221a] border-[#25362b]'
            }`}
          >
            <div className="p-3.5 border-b flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <h3 className="text-sm font-bold">部首工房 ショートカット・操作ガイド</h3>
              </div>
              <button
                onClick={() => setShowPenShortcutsHelp(false)}
                className="p-1 rounded text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs text-stone-700 dark:text-stone-300">
              <div>
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300 mb-1.5 flex items-center space-x-1">
                  <PenTool className="w-3.5 h-3.5" />
                  <span>ベジェペンツール (P)</span>
                </h4>
                <ul className="space-y-1 list-disc list-inside text-[11.5px] text-stone-600 dark:text-stone-300">
                  <li><strong>クリック</strong>: 直線の角頂点（Corner Node）を追加</li>
                  <li><strong>クリック＆ドラッグ</strong>: 滑らかな曲率ハンドル（Smooth Node）を伸ばす</li>
                  <li><strong>始点クリック / Enter</strong>: パスを閉じて輪郭として確定</li>
                  <li><strong>Backspace / 1点戻す</strong>: 直前に打った頂点を取り消す</li>
                  <li><strong>Esc</strong>: 作図中のパスをリセット</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300 mb-1.5 flex items-center space-x-1">
                  <Paintbrush className="w-3.5 h-3.5" />
                  <span>手書き筆・ブラシツール (B)</span>
                </h4>
                <ul className="space-y-1 list-disc list-inside text-[11.5px] text-stone-600 dark:text-stone-300">
                  <li><strong>低遅延RAF描画</strong>: 筆先ストロークが遅れずリアルタイムに追従</li>
                  <li><strong>筆圧・描画速度連動</strong>: 毛筆・明朝・ゴシック・マーカー等で自然な止め・払い・抑揚を再現</li>
                  <li><strong>Shiftキー / 直線モード</strong>: 押下しながら描くことで直線ストロークを作成</li>
                  <li><strong>自動重なり結合</strong>: 描いたストロークが自動で既存輪郭と結合し、白抜けを防止</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300 mb-1.5 flex items-center space-x-1">
                  <MousePointer className="w-3.5 h-3.5" />
                  <span>ツール切替 & 共通キー</span>
                </h4>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                  <div className="p-1.5 rounded bg-stone-100 dark:bg-[#1a281f]"><strong className="text-emerald-700 dark:text-emerald-300">V</strong>: 選択 / 頂点編集</div>
                  <div className="p-1.5 rounded bg-stone-100 dark:bg-[#1a281f]"><strong className="text-emerald-700 dark:text-emerald-300">P</strong>: ベジェペン</div>
                  <div className="p-1.5 rounded bg-stone-100 dark:bg-[#1a281f]"><strong className="text-emerald-700 dark:text-emerald-300">B</strong>: 手書きブラシ</div>
                  <div className="p-1.5 rounded bg-stone-100 dark:bg-[#1a281f]"><strong className="text-emerald-700 dark:text-emerald-300">E</strong>: 消しゴム</div>
                  <div className="p-1.5 rounded bg-stone-100 dark:bg-[#1a281f]"><strong className="text-emerald-700 dark:text-emerald-300">Space / H</strong>: 画面スクロール</div>
                  <div className="p-1.5 rounded bg-stone-100 dark:bg-[#1a281f]"><strong className="text-emerald-700 dark:text-emerald-300">Ctrl+Z / Y</strong>: 取消 / やり直し</div>
                </div>
              </div>
            </div>

            <div className="p-3 border-t bg-stone-50 dark:bg-[#131d16] flex justify-end">
              <button
                onClick={() => setShowPenShortcutsHelp(false)}
                className="px-4 py-1.5 rounded-lg bg-emerald-800 text-white font-bold text-xs hover:bg-emerald-900"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= EXTRACT CONTOURS MODAL ================= */}
      {showExtractModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div
            className={`w-full max-w-lg rounded-xl border shadow-2xl flex flex-col max-h-[85vh] overflow-hidden ${
              isLight ? 'bg-white border-[#c8ded3]' : 'bg-[#16221a] border-[#25362b]'
            }`}
          >
            <div className="p-3.5 border-b flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Scissors className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <h3 className="text-sm font-bold">文字データからパーツを抽出</h3>
              </div>
              <button
                onClick={() => setShowExtractModal(false)}
                className="p-1 rounded text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b">
              <input
                type="text"
                placeholder="抽出したい文字を検索..."
                value={extractSearch}
                onChange={(e) => setExtractSearch(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-md text-xs border outline-hidden ${
                  isLight ? 'bg-[#f7faf8] border-[#c8ded3]' : 'bg-[#101712] border-[#25362b]'
                }`}
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
              {filteredGlyphsForExtract.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-stone-400">
                  作成済みの字形がありません。まず文字エディタで作字してください。
                </div>
              ) : (
                filteredGlyphsForExtract.map((glyph) => (
                  <button
                    key={glyph.unicode}
                    onClick={() => handleExtractFromGlyph(glyph)}
                    className={`p-2 rounded-lg border flex flex-col items-center justify-center space-y-1 transition-all ${
                      isLight
                        ? 'bg-[#f7faf8] border-[#d8e6df] hover:border-emerald-700 hover:bg-emerald-50'
                        : 'bg-[#121a14] border-[#25362b] hover:border-emerald-500 hover:bg-[#1a2820]'
                    }`}
                  >
                    <div className="w-10 h-10 flex items-center justify-center">
                      <svg viewBox="0 0 1000 1000" className="w-full h-full">
                        <path
                          d={contoursToSvgPath(glyph.contours)}
                          fill={isLight ? '#1f2937' : '#ecfdf5'}
                        />
                      </svg>
                    </div>
                    <span className="text-xs font-bold">{glyph.char}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <BundledFontsModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
        theme={theme}
      />
    </div>
  );
};
