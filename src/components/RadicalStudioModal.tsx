import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Grid,
  FileCode,
  Tag,
  Eye,
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
  LayoutGrid,
} from 'lucide-react';
import {
  CustomPart,
  PartCategory,
  PathContour,
  BezierNode,
  Point,
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
  createRectContour,
  createEllipseContour,
  createTriangleContour,
  createStarContour,
  createHeartContour,
  createSparkleContour,
  createStarburstContour,
  createDiamondContour,
  generateShapeByType,
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
  SHAPE_PRESETS,
} from '../utils/pathUtils';
import { parseSvgStringToContours } from '../utils/svgParser';
import { SCREEN_BASELINE_Y } from '../utils/fontCompiler';
import { ThemeMode } from '../utils/theme';
import { KANJI_RADICALS } from '../data/kanjiRadicals';
import { getOrExtractRadicalContours } from '../utils/radicalExtractor';

export const CUSTOM_PARTS_STORAGE_KEY = 'font_editor_custom_parts_v1';

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
  const isLight = theme === 'light';

  // Custom parts library loaded from storage
  const [parts, setParts] = useState<CustomPart[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_PARTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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

  // Current editing part state
  const activePart = parts.find((p) => p.id === selectedPartId) || parts[0] || null;

  // Sidebar Tab & Filter & Search state
  const [leftSidebarTab, setLeftSidebarTab] = useState<'presets' | 'custom'>('presets');
  const [activeCategory, setActiveCategory] = useState<PartCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editor Tools & Viewport
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [brushWidth, setBrushWidth] = useState<number>(36);
  const [brushStyle, setBrushStyle] = useState<BrushStyle>('brush');
  const [zoom, setZoom] = useState<number>(0.55);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 200, y: 140 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });

  // Guide Overlays
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showKanjiGuides, setShowKanjiGuides] = useState<boolean>(true);
  const [showNineBoxes, setShowNineBoxes] = useState<boolean>(false);
  const [showMetrics, setShowMetrics] = useState<boolean>(true);
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [watermarkChar, setWatermarkChar] = useState<string>(selectedChar || '休');

  // Batch insertion states
  const [insertMode, setInsertMode] = useState<'single' | 'batch'>('single');
  const [batchCharsInput, setBatchCharsInput] = useState<string>('');
  const [selectedBatchChars, setSelectedBatchChars] = useState<string[]>([]);

  // Active Drawing / Selection
  const [selectedContourId, setSelectedContourId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedHandleType, setSelectedHandleType] = useState<'node' | 'handleIn' | 'handleOut' | null>(null);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [isDraggingContour, setIsDraggingContour] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState<Point>({ x: 0, y: 0 });

  // Brush / Shape / Pen tool in-progress state
  const [isDrawingStroke, setIsDrawingStroke] = useState(false);
  const [currentStrokePoints, setCurrentStrokePoints] = useState<Point[]>([]);
  const [shapeStartPoint, setShapeStartPoint] = useState<Point | null>(null);
  const [shapeCurrentPoint, setShapeCurrentPoint] = useState<Point | null>(null);
  const [activeShapeType, setActiveShapeType] = useState<ShapeType>('rect');
  const [showShapeMenu, setShowShapeMenu] = useState<boolean>(false);
  const [activePenContour, setActivePenContour] = useState<PathContour | null>(null);
  const [penMousePos, setPenMousePos] = useState<Point | null>(null);
  const [penHudPos, setPenHudPos] = useState<{ x: number; y: number } | null>(null);
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
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);
  const [rightTab, setRightTab] = useState<'transform' | 'compose'>('transform');
  const [targetChar, setTargetChar] = useState<string>(selectedChar || '休');

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

  // Save parts to localStorage whenever they change, and notify listeners
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_PARTS_STORAGE_KEY, JSON.stringify(parts));
      window.dispatchEvent(new Event('font_custom_parts_updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.warn('Failed to save custom parts:', e);
    }
  }, [parts]);

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
    setUndoStack([]);
    setRedoStack([]);
    setSelectedContourId(null);
    setSelectedNodeId(null);
    setActivePenContour(null);
  }, [selectedPartId]);

  if (!isOpen) return null;

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

    const positioned = transformContoursForPlacement(cloned, insertPlacement);
    onInsertToCurrentGlyph(positioned);
    notify(`「${activePart.name}」を「${selectedChar}」に挿入しました`, 'success');
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

    const positioned = transformContoursForPlacement(cloned, insertPlacement);

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

  // Load a preset radical into canvas for editing / fine-tuning
  const handleLoadPreset = async (radical: (typeof KANJI_RADICALS)[0]) => {
    let targetPart = parts.find((p) => p.name === radical.name);
    if (!targetPart) {
      const newId = generateId();
      let clonedContours: PathContour[] = JSON.parse(JSON.stringify(radical.contours));
      try {
        const extracted = await getOrExtractRadicalContours(radical.char || radical.name, 'full');
        if (extracted && extracted.length > 0) {
          clonedContours = extracted;
        }
      } catch {
        // fallback
      }

      const newPart: CustomPart = {
        id: newId,
        name: radical.name,
        category: (radical.category as PartCategory) || 'hen',
        description: `${radical.name}の標準部首パーツ`,
        contours: clonedContours,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setParts((prev) => [newPart, ...prev]);
      targetPart = newPart;
    }
    setSelectedPartId(targetPart.id);
    notify(`部首「${radical.name}」を編集キャンバスに読み込みました`, 'info');
  };

  // Direct 1-click insertion from Preset into current editing character
  const handleInsertPresetDirectly = async (
    radical: (typeof KANJI_RADICALS)[0],
    placement: RadicalPlacement = 'original',
    closeAfter: boolean = false
  ) => {
    let cloned: PathContour[] = JSON.parse(JSON.stringify(radical.contours));
    try {
      const extracted = await getOrExtractRadicalContours(radical.char || radical.name, 'full');
      if (extracted && extracted.length > 0) {
        cloned = extracted;
      }
    } catch {
      // fallback
    }

    const positioned = transformContoursForPlacement(cloned, placement, radical.category);
    onInsertToCurrentGlyph(positioned);
    notify(`部首「${radical.name}」を文字「${selectedChar}」に挿入しました`, 'success');
    if (closeAfter) {
      onClose();
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
    onInsertToCurrentGlyph(positioned);
    const placementNames: Record<RadicalPlacement, string> = {
      auto: '自動判別',
      original: '原寸のまま',
      hen: '偏 (左46%)',
      tsukuri: '旁 (右46%)',
      kanmuri: '冠 (上36%)',
      ashi: '脚 (下36%)',
      center_small: '中央縮小 (60%)',
    };
    notify(`「${activePart.name}」を【${placementNames[placement] || placement}】として「${selectedChar}」に挿入しました`, 'success');
    if (closeAfter) {
      onClose();
    }
  };

  // Import all standard kanji radicals into parts library
  const handleImportDefaultRadicals = () => {
    const existingNames = new Set(parts.map((p) => p.name));
    const newRadicals: CustomPart[] = KANJI_RADICALS.filter(
      (r) => !existingNames.has(r.name)
    ).map((r) => ({
      id: generateId(),
      name: r.name,
      category: (r.category as PartCategory) || 'hen',
      description: `${r.name}の実用部首パーツ`,
      contours: JSON.parse(JSON.stringify(r.contours)),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    if (newRadicals.length === 0) {
      notify('すべての定番部首はすでにライブラリに登録されています', 'info');
      return;
    }

    setParts((prev) => [...prev, ...newRadicals]);
    notify(`${newRadicals.length}件の高品質定番部首パーツを一括登録しました`, 'success');
  };

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

  // Screen to Canvas coordinate conversion
  const getCanvasCoords = (e: React.PointerEvent<SVGSVGElement>): Point => {
    if (!svgCanvasRef.current) return { x: 0, y: 0 };
    const rect = svgCanvasRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    return {
      x: Math.round((clientX - pan.x) / zoom),
      y: Math.round((clientY - pan.y) / zoom),
    };
  };

  // Shape helper
  const getShapeContour = (mode: ToolMode, p1: Point, p2: Point): PathContour => {
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
        return createRectContour(minX, minY, maxX, maxY);
      case 'ellipse':
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
      default:
        return createRectContour(minX, minY, maxX, maxY);
    }
  };

  // Wheel zoom & pan on canvas
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
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
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Pointer event handlers on Part Canvas
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!activePart) return;
    const pos = getCanvasCoords(e);

    // Hand tool / Middle click pan
    if (toolMode === 'hand' || e.button === 1 || e.spaceKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    // Brush Tool
    if (toolMode === 'brush') {
      setIsDrawingStroke(true);
      setCurrentStrokePoints([pos]);
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

    // Eraser Tool
    if (toolMode === 'eraser') {
      const remaining = activePart.contours.filter((contour) => {
        const bbox = getContoursBoundingBox([contour]);
        return !(
          pos.x >= bbox.minX - 25 &&
          pos.x <= bbox.maxX + 25 &&
          pos.y >= bbox.minY - 25 &&
          pos.y <= bbox.maxY + 25
        );
      });
      if (remaining.length !== activePart.contours.length) {
        commitPartChange(remaining);
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
          type: 'corner',
        };
        setActivePenContour({
          id: generateId(),
          closed: false,
          nodes: [newNode],
        });
        setSelectedNodeId(newNode.id);
      } else {
        // Check if clicking start node to close contour
        const firstNode = activePenContour.nodes[0];
        const distToFirst = Math.hypot(pos.x - firstNode.x, pos.y - firstNode.y);

        if (distToFirst < 18 / zoom && activePenContour.nodes.length >= 2) {
          const finishedContour: PathContour = {
            ...activePenContour,
            closed: true,
          };
          commitPartChange([...activePart.contours, finishedContour]);
          setActivePenContour(null);
          setSelectedContourId(finishedContour.id);
          setToolMode('select');
        } else {
          const newNode: BezierNode = {
            id: generateId(),
            x: pos.x,
            y: pos.y,
            type: 'corner',
          };
          setActivePenContour({
            ...activePenContour,
            nodes: [...activePenContour.nodes, newNode],
          });
          setSelectedNodeId(newNode.id);
        }
      }
      return;
    }

    // Select Tool
    if (toolMode === 'select') {
      let foundNode = false;

      // Check node hits
      for (const contour of activePart.contours) {
        for (const node of contour.nodes) {
          const distNode = Math.hypot(pos.x - node.x, pos.y - node.y);
          if (distNode < 14 / zoom) {
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

      if (!foundNode) {
        const clickedContour = activePart.contours.find((contour) => {
          const bbox = getContoursBoundingBox([contour]);
          return (
            pos.x >= bbox.minX - 15 &&
            pos.x <= bbox.maxX + 15 &&
            pos.y >= bbox.minY - 15 &&
            pos.y <= bbox.maxY + 15
          );
        });

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
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    const pos = getCanvasCoords(e);
    setPenMousePos(pos);

    if (isDrawingStroke && toolMode === 'brush') {
      setCurrentStrokePoints((prev) => [...prev, pos]);
      return;
    }

    if (shapeStartPoint) {
      setShapeCurrentPoint(pos);
      return;
    }

    // Dragging single node
    if (isDraggingNode && selectedNodeId && selectedContourId && activePart) {
      const dx = pos.x - dragStartPoint.x;
      const dy = pos.y - dragStartPoint.y;

      const updated = activePart.contours.map((contour) => {
        if (contour.id !== selectedContourId) return contour;
        return {
          ...contour,
          nodes: contour.nodes.map((node) => {
            if (node.id !== selectedNodeId) return node;
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

  const handlePointerUp = () => {
    setIsPanning(false);
    setIsDraggingNode(false);
    setIsDraggingContour(false);

    if (!activePart) return;

    // Finalize Brush
    if (isDrawingStroke && currentStrokePoints.length > 2) {
      const strokeContour = strokePointsToOutline(
        currentStrokePoints,
        brushWidth,
        brushStyle
      );
      if (strokeContour && strokeContour.nodes.length >= 3) {
        commitPartChange([...activePart.contours, strokeContour]);
      }
      setIsDrawingStroke(false);
      setCurrentStrokePoints([]);
      return;
    }

    // Finalize Shape
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

      const newShapeContour = getShapeContour(toolMode, p1, p2);
      commitPartChange([...activePart.contours, newShapeContour]);
      setSelectedContourId(newShapeContour.id);
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

  const handleFinishPartPenContour = (closed: boolean = false) => {
    if (!activePenContour || activePenContour.nodes.length < 2 || !activePart) return;
    const finished: PathContour = {
      ...activePenContour,
      closed,
    };
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
    const positioned = transformContoursForPlacement(activePart.contours, place);
    commitPartChange(positioned);
    notify(`配置を「${place}」基準に自動フィットしました`, 'info');
  };

  const handleUnionPart = () => {
    if (!activePart || activePart.contours.length <= 0) {
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
    if (!activePart || activePart.contours.length === 0) return;
    try {
      const normalized = normalizeGlyphContoursWinding(activePart.contours);
      commitPartChange(normalized);
      notify('輪郭の向き（Winding）をTrueType規格に統一しました', 'success');
    } catch (e) {
      notify('輪郭処理に失敗しました', 'error');
    }
  };

  const handleCenterPartInCanvas = () => {
    if (!activePart || activePart.contours.length === 0) return;
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
    if (!activePart || activePart.contours.length === 0) return;
    commitPartChange([]);
    notify('輪郭を全消去しました', 'info');
  };

  const handleNudgePart = (dx: number, dy: number) => {
    if (!activePart || activePart.contours.length === 0) return;
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

  // Filter presets list
  const filteredPresets = KANJI_RADICALS.filter((radical) => {
    const matchesCat = activeCategory === 'all' || radical.category === activeCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      radical.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (radical.char && radical.char.includes(searchQuery.trim()));
    return matchesCat && matchesSearch;
  });

  // Available glyphs from project for extraction
  const modifiedGlyphs = (Object.values(project.glyphs || {}) as GlyphData[]).filter(
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
  const mainSvgPath = activePart ? contoursToSvgPath(normalizeGlyphContoursWinding(activePart.contours)) : '';
  const penSvgPath = activePenContour ? contoursToSvgPath([activePenContour]) : '';
  const brushSvgPath =
    isDrawingStroke && currentStrokePoints.length > 2
      ? contoursToSvgPath([strokePointsToOutline(currentStrokePoints, brushWidth, brushStyle)])
      : '';

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
            ? 'w-[98vw] h-[96vh] max-w-[1720px] rounded-2xl border border-[#c8ded3] shadow-2xl bg-[#f4f8f5] text-stone-800'
            : 'w-[98vw] h-[96vh] max-w-[1720px] rounded-2xl border border-[#25362b] shadow-2xl bg-[#121b15] text-emerald-100'
        }`}
      >
        {/* ================= MODAL TOP HEADER ================= */}
        <div
          className={`px-3 sm:px-4 py-2 border-b flex items-center justify-between shrink-0 gap-2 ${
            isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18241c] border-[#25362b]'
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
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    isLight ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {parts.length}パーツ
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate hidden md:block">
                偏旁・冠脚・筆画を設計し、漢字や文字へワンクリック合成
              </p>
            </div>
          </div>

          {/* Quick Workspace Switchers */}
          <div className="flex items-center space-x-1.5 shrink-0">
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
              className={`w-10 border-r flex flex-col items-center py-3 shrink-0 cursor-pointer select-none transition-colors ${
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
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[10.5px] font-bold [writing-mode:vertical-rl] tracking-wider opacity-80">
                  {leftSidebarTab === 'presets' ? `標準部首 (${filteredPresets.length})` : `マイパーツ (${parts.length})`}
                </span>
              </div>
            </div>
          ) : (
            <div
              className={`w-72 sm:w-80 xl:w-88 border-r flex flex-col shrink-0 min-h-0 relative z-10 overflow-hidden ${
                isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#162119] border-[#25362b]'
              }`}
            >
              {/* Left Column Header with collapse button */}
              <div
                className={`p-2 px-3 border-b flex items-center justify-between shrink-0 ${
                  isLight ? 'bg-stone-50/80 border-[#d8e6df]' : 'bg-[#131d16] border-[#25362b]'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span className="text-xs font-bold">部首・パーツ工房</span>
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

              {/* Main Dual-Tab Switcher: Presets vs My Custom Parts */}
              <div className="p-1.5 border-b bg-stone-100/60 dark:bg-[#111913] shrink-0 border-inherit">
                <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-stone-200/70 dark:bg-[#1b261f]">
                  <button
                    type="button"
                    onClick={() => setLeftSidebarTab('presets')}
                    className={`py-1.5 px-2 rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                      leftSidebarTab === 'presets'
                        ? isLight
                          ? 'bg-white text-emerald-950 shadow-xs ring-1 ring-emerald-700/20'
                          : 'bg-[#25362b] text-emerald-200 shadow-xs ring-1 ring-emerald-400/20'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>標準部首 ({filteredPresets.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftSidebarTab('custom')}
                    className={`py-1.5 px-2 rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                      leftSidebarTab === 'custom'
                        ? isLight
                          ? 'bg-white text-emerald-950 shadow-xs ring-1 ring-emerald-700/20'
                          : 'bg-[#25362b] text-emerald-200 shadow-xs ring-1 ring-emerald-400/20'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    <Shapes className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>マイパーツ ({parts.length})</span>
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
                        className={`py-1.5 px-2 rounded-md font-bold text-xs flex items-center justify-center space-x-1 shadow-xs transition-all ${
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
                        onClick={handleImportDefaultRadicals}
                        className={`py-1 px-2 rounded-md text-[11px] font-semibold flex items-center justify-center space-x-1 border transition-all ${
                          isLight
                            ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-50'
                            : 'bg-[#18261e] border-[#25362b] text-stone-300 hover:bg-[#203227]'
                        }`}
                        title="標準部首をすべてマイパーツに一括登録"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>標準部首一括読込</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-between">
                    <span>高品質な偏・旁・冠・脚の標準部首</span>
                    <button
                      onClick={handleImportDefaultRadicals}
                      className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
                    >
                      全部首を一括保存
                    </button>
                  </div>
                )}

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder={leftSidebarTab === 'presets' ? '部首名・漢字で検索（例: さんずい, 木, 艹）...' : 'パーツ名で検索...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-8 pr-3 py-1.5 rounded-md text-xs border outline-hidden transition-colors ${
                      isLight
                        ? 'bg-[#f7faf8] border-[#c8ded3] focus:border-emerald-700'
                        : 'bg-[#101712] border-[#25362b] focus:border-emerald-500 text-emerald-100'
                    }`}
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div
                className={`p-2 border-b flex space-x-1 overflow-x-auto text-[11px] shrink-0 ${
                  isLight ? 'bg-[#f4f8f5] border-[#d8e6df]' : 'bg-[#131d16] border-[#25362b]'
                }`}
              >
                {CATEGORY_TABS.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-2 py-0.5 rounded-full whitespace-nowrap text-[10px] transition-colors ${
                      activeCategory === cat.id
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
                ))}
              </div>

              {/* Main List Area */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
                {leftSidebarTab === 'presets' ? (
                  /* ================= RADICAL PRESETS VIEW ================= */
                  filteredPresets.length === 0 ? (
                    <div className="py-12 text-center text-xs text-stone-400 space-y-2">
                      <Sparkles className="w-8 h-8 mx-auto opacity-40" />
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
                      const svgPath = contoursToSvgPath(radical.contours);
                      const isLoadedInCanvas = activePart?.name === radical.name;

                      return (
                        <div
                          key={radical.name}
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
                          {/* SVG Thumbnail Preview */}
                          <div
                            onClick={() => handleLoadPreset(radical)}
                            className={`w-12 h-12 rounded-md border shrink-0 flex items-center justify-center p-0.5 cursor-pointer transition-transform hover:scale-105 ${
                              isLight ? 'bg-white border-stone-200' : 'bg-[#0f1711] border-[#2a3c30]'
                            }`}
                            title="クリックして編集キャンバスに読み込む"
                          >
                            <svg viewBox="0 0 1000 1000" className="w-full h-full">
                              <path
                                d={svgPath}
                                fill={isLoadedInCanvas ? (isLight ? '#064e3b' : '#34d399') : isLight ? '#1f2937' : '#ecfdf5'}
                              />
                            </svg>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold truncate">{radical.name}</span>
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
                            <div className="text-[10px] text-stone-400 mt-0.5 flex items-center justify-between">
                              <span>輪郭: {radical.contours?.length || 0}本</span>
                              <span className="font-bold text-stone-600 dark:text-stone-300 text-xs">
                                {radical.char || ''}
                              </span>
                            </div>

                            {/* Action Buttons: Edit / Insert Directly */}
                            <div className="mt-1.5 flex items-center space-x-1.5">
                              <button
                                onClick={() => handleLoadPreset(radical)}
                                className={`flex-1 py-1 px-1.5 rounded text-[10.5px] font-bold flex items-center justify-center space-x-1 transition-all ${
                                  isLoadedInCanvas
                                    ? isLight
                                      ? 'bg-emerald-700 text-white'
                                      : 'bg-emerald-600 text-white'
                                    : isLight
                                    ? 'bg-emerald-100/70 text-emerald-950 hover:bg-emerald-200'
                                    : 'bg-[#203427] text-emerald-200 hover:bg-[#2a4533]'
                                }`}
                              >
                                <PenTool className="w-3 h-3" />
                                <span>{isLoadedInCanvas ? '編集中' : '編集'}</span>
                              </button>
                              <button
                                onClick={() => handleInsertPresetDirectly(radical, insertPlacement, false)}
                                className={`py-1 px-2 rounded text-[10.5px] font-bold flex items-center justify-center space-x-1 transition-all ${
                                  isLight
                                    ? 'bg-stone-100 hover:bg-emerald-600 hover:text-white text-stone-800 border border-stone-200'
                                    : 'bg-[#18261e] hover:bg-emerald-500 hover:text-stone-950 text-emerald-200 border border-[#25362b]'
                                }`}
                                title={`文字「${selectedChar}」に直接挿入`}
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
                                ? 'bg-emerald-50 border-emerald-700 shadow-xs ring-1 ring-emerald-700/30'
                                : 'bg-[#1e2d22] border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
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
          <div className="flex-1 flex flex-col min-w-0 min-h-0 relative overflow-hidden">
            {/* Top Quick Action / Insertion Ribbon (作字・即時配置バー) */}
            <div
              className={`px-3 py-1.5 border-b flex items-center justify-between gap-2 shrink-0 overflow-x-auto scrollbar-none z-20 ${
                isLight
                  ? 'bg-emerald-50/80 border-emerald-200/90 text-emerald-950'
                  : 'bg-[#152319] border-[#223627] text-emerald-100'
              }`}
            >
              {/* Placement Insertion Buttons */}
              <div className="flex items-center space-x-1 shrink-0">
                <span className="text-[11px] font-bold shrink-0 mr-1 text-emerald-800 dark:text-emerald-300 hidden sm:inline">
                  文字「{selectedChar}」へ即時挿入:
                </span>
                <button
                  onClick={() => handleQuickInsertPlacement('hen')}
                  disabled={!activePart || activePart.contours.length === 0}
                  className={`px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 disabled:opacity-40 ${
                    isLight
                      ? 'bg-white border border-emerald-300 hover:bg-emerald-600 hover:text-white text-emerald-950 shadow-xs'
                      : 'bg-[#1c2e22] border border-emerald-700/80 hover:bg-emerald-500 hover:text-stone-950 text-emerald-200 shadow-xs'
                  }`}
                  title="偏（左側・幅46%）の枠に合わせて文字に挿入"
                >
                  <span>偏 (左)</span>
                </button>
                <button
                  onClick={() => handleQuickInsertPlacement('tsukuri')}
                  disabled={!activePart || activePart.contours.length === 0}
                  className={`px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 disabled:opacity-40 ${
                    isLight
                      ? 'bg-white border border-emerald-300 hover:bg-emerald-600 hover:text-white text-emerald-950 shadow-xs'
                      : 'bg-[#1c2e22] border border-emerald-700/80 hover:bg-emerald-500 hover:text-stone-950 text-emerald-200 shadow-xs'
                  }`}
                  title="旁（右側・幅46%）の枠に合わせて文字に挿入"
                >
                  <span>旁 (右)</span>
                </button>
                <button
                  onClick={() => handleQuickInsertPlacement('kanmuri')}
                  disabled={!activePart || activePart.contours.length === 0}
                  className={`px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 disabled:opacity-40 ${
                    isLight
                      ? 'bg-white border border-emerald-300 hover:bg-emerald-600 hover:text-white text-emerald-950 shadow-xs'
                      : 'bg-[#1c2e22] border border-emerald-700/80 hover:bg-emerald-500 hover:text-stone-950 text-emerald-200 shadow-xs'
                  }`}
                  title="冠（上側・高さ36%）の枠に合わせて文字に挿入"
                >
                  <span>冠 (上)</span>
                </button>
                <button
                  onClick={() => handleQuickInsertPlacement('ashi')}
                  disabled={!activePart || activePart.contours.length === 0}
                  className={`px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 disabled:opacity-40 ${
                    isLight
                      ? 'bg-white border border-emerald-300 hover:bg-emerald-600 hover:text-white text-emerald-950 shadow-xs'
                      : 'bg-[#1c2e22] border border-emerald-700/80 hover:bg-emerald-500 hover:text-stone-950 text-emerald-200 shadow-xs'
                  }`}
                  title="脚（下側・高さ36%）の枠に合わせて文字に挿入"
                >
                  <span>脚 (下)</span>
                </button>
                <button
                  onClick={() => handleQuickInsertPlacement('original')}
                  disabled={!activePart || activePart.contours.length === 0}
                  className={`px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 disabled:opacity-40 ${
                    isLight
                      ? 'bg-emerald-800 text-white hover:bg-emerald-900 shadow-xs'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs'
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
                  disabled={!activePart || activePart.contours.length === 0}
                  className={`p-1 rounded text-xs transition-colors disabled:opacity-30 ${
                    isLight ? 'hover:bg-emerald-200 text-emerald-900' : 'hover:bg-[#203427] text-emerald-200'
                  }`}
                  title="キャンバス中央揃え"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleFlipHPart}
                  disabled={!activePart || activePart.contours.length === 0}
                  className={`p-1 rounded text-xs transition-colors disabled:opacity-30 ${
                    isLight ? 'hover:bg-emerald-200 text-emerald-900' : 'hover:bg-[#203427] text-emerald-200'
                  }`}
                  title="水平反転 (左右)"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleFlipVPart}
                  disabled={!activePart || activePart.contours.length === 0}
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
              className={`px-2 py-1.5 border-b flex items-center justify-between gap-1.5 sm:gap-2 shrink-0 overflow-x-auto scrollbar-none min-w-0 relative z-10 ${
                isLight ? 'bg-[#f4f8f5] border-[#d8e6df]' : 'bg-[#162119] border-[#25362b]'
              }`}
            >
              {/* Primary Tool Buttons */}
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => setToolMode('select')}
                  className={`p-1.5 px-2 rounded text-xs font-semibold flex items-center space-x-1 transition-all shrink-0 ${
                    toolMode === 'select'
                      ? isLight
                        ? 'bg-emerald-800 text-white font-bold shadow-xs'
                        : 'bg-emerald-600 text-white font-bold shadow-xs'
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
                        ? 'bg-emerald-800 text-white font-bold shadow-xs'
                        : 'bg-emerald-600 text-white font-bold shadow-xs'
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
                        ? 'bg-emerald-800 text-white font-bold shadow-xs'
                        : 'bg-emerald-600 text-white font-bold shadow-xs'
                      : isLight
                      ? 'hover:bg-emerald-100 text-stone-700'
                      : 'hover:bg-[#202d24] text-emerald-200'
                  }`}
                  title="手書き筆・ストローク (B)"
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">ブラシ</span>
                </button>

                {/* Compact Shape Tool with Dropdown */}
                <div className="relative shrink-0">
                  <div
                    className={`flex items-center rounded text-xs font-semibold border transition-all ${
                      ['rect', 'ellipse', 'triangle', 'star', 'heart', 'diamond'].includes(toolMode)
                        ? isLight
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                          : 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
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
                      {activeShapeType === 'ellipse' && <Circle className="w-3.5 h-3.5" />}
                      {activeShapeType === 'triangle' && <Triangle className="w-3.5 h-3.5" />}
                      {activeShapeType === 'star' && <Star className="w-3.5 h-3.5" />}
                      {activeShapeType === 'heart' && <Heart className="w-3.5 h-3.5" />}
                      {activeShapeType === 'diamond' && <Diamond className="w-3.5 h-3.5" />}
                      <span className="hidden xl:inline text-[11px]">
                        {activeShapeType === 'rect' ? '四角' : activeShapeType === 'ellipse' ? '円' : activeShapeType === 'triangle' ? '三角' : activeShapeType === 'star' ? '星' : activeShapeType === 'heart' ? 'ハート' : 'ダイヤ'}
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
                      className={`absolute top-full left-0 mt-1.5 p-1 rounded-lg border shadow-xl z-50 flex items-center space-x-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${
                        isLight
                          ? 'bg-white/95 border-stone-200 shadow-stone-900/10'
                          : 'bg-[#152219]/95 border-[#283e2f] shadow-black/40'
                      }`}
                    >
                      {(
                        [
                          { id: 'rect' as ShapeType, label: '四角形 (Rect)', icon: <Square className="w-3.5 h-3.5" /> },
                          { id: 'ellipse' as ShapeType, label: '円・楕円 (Ellipse)', icon: <Circle className="w-3.5 h-3.5" /> },
                          { id: 'triangle' as ShapeType, label: '三角形', icon: <Triangle className="w-3.5 h-3.5" /> },
                          { id: 'star' as ShapeType, label: '星型', icon: <Star className="w-3.5 h-3.5" /> },
                          { id: 'heart' as ShapeType, label: 'ハート', icon: <Heart className="w-3.5 h-3.5" /> },
                          { id: 'diamond' as ShapeType, label: 'ダイヤ・菱形', icon: <Diamond className="w-3.5 h-3.5" /> },
                        ] as const
                      ).map((s) => (
                        <button
                          key={s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveShapeType(s.id);
                            setToolMode(s.id);
                            setShowShapeMenu(false);
                          }}
                          className={`p-1.5 rounded transition-all ${
                            toolMode === s.id
                              ? 'bg-emerald-800 text-white shadow-xs'
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
                        ? 'bg-emerald-800 text-white font-bold shadow-xs'
                        : 'bg-emerald-600 text-white font-bold shadow-xs'
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
                        ? 'bg-emerald-800 text-white font-bold shadow-xs'
                        : 'bg-emerald-600 text-white font-bold shadow-xs'
                      : isLight
                      ? 'hover:bg-emerald-100 text-stone-700'
                      : 'hover:bg-[#202d24] text-emerald-200'
                  }`}
                  title="手のひら・画面移動 (H)"
                >
                  <Hand className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Pathfinder, Quality & Quick Transformations */}
              <div className="flex items-center space-x-0.5 sm:space-x-1 border-l pl-1 sm:pl-2 ml-0.5 sm:ml-1 border-stone-300 dark:border-stone-700 shrink-0">
                <button
                  onClick={handleUnionPart}
                  disabled={!activePart || activePart.contours.length === 0}
                  className={`p-1.5 px-2 rounded text-xs font-semibold flex items-center space-x-1 transition-all shrink-0 ${
                    isLight
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100 disabled:opacity-30'
                      : 'bg-[#18261e] text-emerald-300 border border-emerald-800 hover:bg-[#203429] disabled:opacity-30'
                  }`}
                  title="【重なり合体】交差・重なり合うストロークを1つの輪郭に合体し、白抜けを解消します"
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden 2xl:inline">重なり合体</span>
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
                  <span className="hidden 2xl:inline">向き統一</span>
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
                  disabled={!activePart || activePart.contours.length === 0}
                  className={`p-1.5 rounded text-xs transition-colors shrink-0 ${
                    isLight ? 'hover:bg-emerald-100 text-stone-700' : 'hover:bg-[#202d24] text-emerald-200'
                  }`}
                  title="左右反転"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleFlipVPart}
                  disabled={!activePart || activePart.contours.length === 0}
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

                {/* Target Character Watermark Guide */}
                <div className="flex items-center space-x-1 shrink-0">
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
                    <input
                      type="text"
                      maxLength={1}
                      value={watermarkChar}
                      onChange={(e) => setWatermarkChar(e.target.value.slice(-1) || selectedChar)}
                      className={`w-6 h-6 text-center text-xs font-bold rounded border outline-hidden transition-colors ${
                        isLight
                          ? 'bg-white border-emerald-300 text-emerald-950 focus:border-emerald-600'
                          : 'bg-[#121c15] border-emerald-700 text-emerald-100 focus:border-emerald-500'
                      }`}
                      title="透かし表示する参照文字（例: 休）"
                    />
                  )}
                </div>

                {/* Clear All */}
                <button
                  onClick={handleClearCanvas}
                  disabled={!activePart || activePart.contours.length === 0}
                  className={`p-1.5 rounded text-xs transition-colors shrink-0 ${
                    activePart && activePart.contours.length > 0
                      ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                      : 'opacity-30 cursor-not-allowed text-stone-400'
                  }`}
                  title="輪郭を全消去"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
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
                    className={`px-2 py-1 rounded-full border shadow-xl backdrop-blur-md flex items-center space-x-1.5 text-xs ${
                      isLight
                        ? 'bg-white/95 border-emerald-300/80 text-stone-800 shadow-emerald-950/10'
                        : 'bg-[#121c15]/95 border-emerald-700/60 text-emerald-100 shadow-black/50'
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
                    <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 font-bold font-mono text-[11px] shrink-0">
                      <PenTool className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                      <span>{activePenContour.nodes.length}点</span>
                    </div>

                    <div className="h-3.5 w-[1px] bg-stone-200 dark:bg-emerald-800/80" />

                    {/* Undo Last Point */}
                    <button
                      onClick={handleUndoPartPenNode}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center space-x-1 transition-all active:scale-95 ${
                        isLight
                          ? 'bg-stone-100 hover:bg-emerald-100 text-stone-700 hover:text-emerald-900'
                          : 'bg-[#1e2d23] hover:bg-[#283d30] text-emerald-200'
                      }`}
                      title="直前の頂点を取り消す (Backspace)"
                    >
                      <RotateCcw className="w-3 h-3 text-stone-500 dark:text-stone-300" />
                      <span>1点戻す</span>
                    </button>

                    {/* Finalize as open path */}
                    <button
                      onClick={() => handleFinishPartPenContour(false)}
                      disabled={activePenContour.nodes.length < 2}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center space-x-1 transition-all disabled:opacity-30 active:scale-95 ${
                        isLight
                          ? 'bg-sky-50 hover:bg-sky-100 text-sky-800'
                          : 'bg-sky-950/70 hover:bg-sky-900/80 text-sky-200'
                      }`}
                      title="開いた線として確定する"
                    >
                      <CornerDownLeft className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                      <span>線で確定</span>
                    </button>

                    {/* Finalize as closed path */}
                    <button
                      onClick={() => handleFinishPartPenContour(true)}
                      disabled={activePenContour.nodes.length < 3}
                      className="px-2.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center space-x-1 shadow-sm transition-all disabled:opacity-30 active:scale-95"
                      title="パスを閉じて輪郭として確定する"
                    >
                      <Check className="w-3 h-3" />
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
              <svg
                ref={svgCanvasRef}
                className="w-full h-full cursor-crosshair select-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
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
                    (() => {
                      const allGlyphs = Object.values(project.glyphs || {}) as GlyphData[];
                      const bgGlyph = allGlyphs.find((g) => g.char === watermarkChar || (watermarkChar && g.unicode === watermarkChar.codePointAt(0)));
                      if (bgGlyph && bgGlyph.contours && bgGlyph.contours.length > 0) {
                        return (
                          <path
                            d={contoursToSvgPath(bgGlyph.contours)}
                            fill={isLight ? '#047857' : '#34d399'}
                            fillOpacity={0.12}
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
                          fillOpacity={0.08}
                          fontSize={680}
                          fontWeight="bold"
                          pointerEvents="none"
                          style={{ fontFamily: 'sans-serif' }}
                        >
                          {watermarkChar}
                        </text>
                      );
                    })()
                  )}

                  {/* ================= DRAWN GLYPH PATHS ================= */}
                  {/* Main Part Contours */}
                  {mainSvgPath && (
                    <path
                      d={mainSvgPath}
                      fill={isLight ? '#1c2920' : '#ecfdf5'}
                      fillRule="nonzero"
                      stroke={isLight ? '#1c2920' : '#ecfdf5'}
                      strokeWidth={1}
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

                  {/* Active Brush Stroke in-progress */}
                  {brushSvgPath && (
                    <path
                      d={brushSvgPath}
                      fill="#10b981"
                      fillOpacity={0.8}
                    />
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

                  {/* Active Shape in-progress */}
                  {shapeStartPoint && shapeCurrentPoint && (
                    <path
                      d={contoursToSvgPath([
                        getShapeContour(toolMode, shapeStartPoint, shapeCurrentPoint),
                      ])}
                      fill="#f59e0b"
                      fillOpacity={0.35}
                      stroke="#f59e0b"
                      strokeWidth={2}
                    />
                  )}

                  {/* Bezier Nodes & Handles */}
                  {activePart &&
                    activePart.contours.map((contour) => (
                      <g key={contour.id}>
                        {contour.nodes.map((node) => {
                          const isNodeSelected = selectedNodeId === node.id;
                          return (
                            <g key={node.id}>
                              <circle
                                cx={node.x}
                                cy={node.y}
                                r={isNodeSelected ? 6 : 4.5}
                                fill={isNodeSelected ? '#ef4444' : '#10b981'}
                                stroke="#ffffff"
                                strokeWidth={2}
                              />
                            </g>
                          );
                        })}
                      </g>
                    ))}
                </g>
              </svg>
            </div>
          </div>

          {/* ================= RIGHT COLUMN: PART INSPECTOR & COMPOSITION ================= */}
          {!isRightSidebarOpen ? (
            <div
              className={`w-10 border-l flex flex-col items-center py-3 shrink-0 cursor-pointer select-none transition-colors ${
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
              className={`w-72 sm:w-80 lg:w-88 xl:w-96 border-l flex flex-col shrink-0 min-h-0 relative z-10 overflow-hidden ${
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
                          ? 'bg-white text-emerald-950 font-bold shadow-xs'
                          : 'bg-[#25362b] text-emerald-200 font-bold shadow-xs'
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
                          ? 'bg-white text-emerald-950 font-bold shadow-xs'
                          : 'bg-[#25362b] text-emerald-200 font-bold shadow-xs'
                        : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
                    }`}
                  >
                    🈴 漢字合成・挿入
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
                <div className="flex-1 overflow-y-auto p-3.5 space-y-4 min-h-0">
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

                      {/* Overlap & White Gap Resolver Card */}
                      <div
                        className={`p-3 rounded-xl border space-y-2 ${
                          isLight
                            ? 'bg-emerald-50/80 border-emerald-300 shadow-xs'
                            : 'bg-[#15231a] border-emerald-800'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5">
                          <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                            重なり・白抜け防止ツール
                          </span>
                        </div>
                        <p className="text-[10.5px] text-stone-600 dark:text-stone-300 leading-relaxed">
                          手書き筆ストロークやパーツ同士が交差した際にフォントで発生する「白抜け」を、ブール演算合体で防止します。
                        </p>
                        <div className="space-y-1.5 pt-1">
                          <button
                            onClick={handleUnionPart}
                            className={`w-full py-2 px-2.5 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-all ${
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
                                ? 'bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                                : 'bg-[#1b2b20] border-emerald-700 text-emerald-300 hover:bg-[#23382a]'
                            }`}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>輪郭の向き（Winding）をTrueType規格に統一</span>
                          </button>
                        </div>
                      </div>

                      {/* Transform & Geometry Manipulation */}
                      <div
                        className={`p-3 rounded-xl border space-y-3 ${
                          isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#152018] border-[#25362b]'
                        }`}
                      >
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
                          isLight ? 'bg-white border-[#d8e6df] shadow-xs' : 'bg-[#131d16] border-[#25362b]'
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
                                  transformContoursForPlacement(activePart.contours, insertPlacement)
                                )
                              )}
                              fill={isLight ? '#064e3b' : '#34d399'}
                              fillRule="nonzero"
                            />
                          </svg>
                        </div>
                        <p className="text-[10px] text-stone-500 leading-tight text-center">
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
                                ? 'bg-white text-emerald-950 shadow-xs'
                                : 'bg-emerald-700 text-white shadow-xs'
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
                                ? 'bg-white text-emerald-950 shadow-xs'
                                : 'bg-emerald-700 text-white shadow-xs'
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
                                    ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                                    : 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
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
                                ? 'bg-emerald-800 text-white hover:bg-emerald-900 shadow-emerald-950/20 active:scale-[0.99]'
                                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-black/40 active:scale-[0.99]'
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
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-stone-800 dark:text-stone-200">
                              一括挿入の対象漢字を選択
                            </label>
                            <div className="flex space-x-2 text-[10.5px]">
                              <button
                                onClick={() => {
                                  const presets = KANJI_PRESETS_BY_CATEGORY[activePart.category] || KANJI_PRESETS_BY_CATEGORY.other;
                                  setSelectedBatchChars(presets);
                                }}
                                className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
                              >
                                推奨すべて選択
                              </button>
                              <button
                                onClick={() => setSelectedBatchChars([])}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                              >
                                解除
                              </button>
                            </div>
                          </div>

                          {/* Preset Kanji Chips */}
                          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1.5 rounded-lg border bg-stone-50 dark:bg-[#0f1711] border-stone-200 dark:border-stone-800">
                            {(KANJI_PRESETS_BY_CATEGORY[activePart.category] || KANJI_PRESETS_BY_CATEGORY.other).map((kanji) => {
                              const isSelected = selectedBatchChars.includes(kanji);
                              return (
                                <button
                                  key={kanji}
                                  onClick={() => {
                                    setSelectedBatchChars((prev) =>
                                      prev.includes(kanji) ? prev.filter((k) => k !== kanji) : [...prev, kanji]
                                    );
                                  }}
                                  className={`w-7 h-7 rounded-md font-bold text-xs flex items-center justify-center transition-all ${
                                    isSelected
                                      ? 'bg-emerald-700 text-white shadow-xs scale-105'
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
                                  ? 'bg-emerald-800 text-white hover:bg-emerald-900 shadow-emerald-950/20 active:scale-[0.99]'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-black/40 active:scale-[0.99]'
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
      </div>

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
    </div>
  );
};
