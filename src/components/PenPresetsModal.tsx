import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Sliders,
  PenTool,
  Paintbrush,
  Pencil,
  Feather,
  Maximize2,
  Minimize2,
  Eraser,
  Copy,
  Download,
  Upload,
  Edit2,
  Shuffle,
  Activity,
  Settings,
  Circle,
  Diamond,
  Flame,
  Layers,
  ChevronRight,
  ChevronLeft,
  Eye,
} from 'lucide-react';
import {
  BrushStyle,
  UserPenPreset,
  PressureCurveConfig,
  PressureCurvePoint,
  StrokePoint,
  BezierNode,
} from '../types';
import {
  DEFAULT_PEN_PRESETS,
  DEFAULT_PRESSURE_CURVES,
  saveUserPenPresets,
} from '../utils/presetData';
import {
  strokePointsToOutline,
  contoursToSvgPath,
  evaluatePressureCurve,
} from '../utils/pathUtils';
import { ThemeMode, isLightTheme } from '../utils/theme';

export interface PenPresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Current Active Writing Parameters
  currentParams: {
    brushStyle: BrushStyle;
    brushWidth: number;
    pressureSensitivity: 'high' | 'normal' | 'low' | 'off';
    pressureCurve?: PressureCurveConfig;
    smoothingIntensity?: number;
    autoSmoothBrush: boolean;
    smoothStrength: 'mild' | 'standard' | 'strong';
    smoothPreserveCorners: boolean;
    autoUnionBrush: boolean;
    // Extended brush parameters
    taperStartLength?: number;
    taperEndLength?: number;
    taperStartWidth?: number;
    taperEndWidth?: number;
    forceTaper?: boolean;
    forceTaperEnd?: boolean;
    taperTipShape?: 'round' | 'sharp';
    nibAngle?: number;
    nibAspectRatio?: number;
    nibFollowDirection?: boolean;
    speedWidthFactor?: number;
    jitterSize?: number;
    jitterPosition?: number;
    stabilizationMethod?: 'pre' | 'post';
    speedStabilization?: number;
  };
  // Callback when a preset is applied
  onApplyPreset: (preset: UserPenPreset) => void;
  // Callback when pressure curve is changed live
  onChangePressureCurve?: (curve: PressureCurveConfig) => void;
  // Presets State
  presets: UserPenPreset[];
  onUpdatePresets: (newPresets: UserPenPreset[]) => void;
  theme?: ThemeMode;
}

const BRUSH_STYLE_INFO: Record<BrushStyle, { name: string; desc: string; category: string }> = {
  brush: { name: '毛筆・書道筆', desc: '伝統書道の起筆・送筆・収筆の抑揚', category: '和風・筆' },
  sumi: { name: '墨だまり筆', desc: 'トメ・ハライでインクが滲む力強い毛筆', category: '和風・筆' },
  mincho_nib: { name: '明朝体Nib', desc: '縦太横細の美しい明朝体エレメント', category: '和風・筆' },
  reisho_chisel: { name: '隷書風平筆', desc: '波磔（はたく）と扁平な筆勢', category: '和風・筆' },
  fountain: { name: '高級万年筆', desc: '金属ペン先のしなりと鋭いハライ', category: 'ペン・インク' },
  g_pen: { name: '漫画Gペン', desc: 'ダイナミックな筆圧強弱とシャープな抜き', category: 'ペン・インク' },
  signpen: { name: 'サインペン', desc: '均一で引き締まった太字フェルトペン', category: 'ペン・インク' },
  ballpoint: { name: 'ボールペン', desc: '精密で繊細な日常手書き線', category: 'ペン・インク' },
  calligraphy: { name: 'カリグラフィー', desc: '角度固定の扁平チゼルペン先', category: 'デザイン' },
  highlighter: { name: '平マーカー', desc: '幅広リボン状のストローク', category: 'デザイン' },
  marumoji: { name: '丸文字ポップ', desc: '端点が丸くぷっくりしたPOP文字', category: 'デザイン' },
  pixel_dot: { name: 'ピクセル筆', desc: 'レトロゲーム風のビットマップ感', category: '幾何学' },
  sharp: { name: 'カクカク角筆', desc: '直線とマイター角の幾何学筆', category: '幾何学' },
  sharp_round: { name: '角丸幾何学筆', desc: '直線骨格に滑らかな角丸フィレット', category: '幾何学' },
  polygon: { name: '多角形ペン', desc: '多角形断面のソリッドストローク', category: '幾何学' },
  pencil: { name: 'スケッチ鉛筆', desc: '芯の擦れと自然な微細テクスチャ', category: 'ナチュラル' },
  chalk: { name: 'チョーク筆', desc: '黒板風のかすれと手書き質感', category: 'ナチュラル' },
  marker: { name: '丸マーカー', desc: '均質で滑らかなアートマーカー', category: 'ナチュラル' },
  wobbly: { name: 'ゆらぎ手書き', desc: '微細な揺らぎを持つ脱力系手書き線', category: 'ナチュラル' },
};

const CURVE_PRESET_LABELS: Record<string, { name: string; desc: string }> = {
  linear: { name: '標準 (リニア)', desc: '入力と太さが1:1の自然なレスポンス' },
  soft: { name: 'ソフト (高感度)', desc: '軽いタッチでもしっかり太さが出る' },
  hard: { name: 'ハード (重め)', desc: '強く押し込んで太く、細線がブレにくい' },
  's-curve': { name: 'S字抑揚', desc: 'トメ・ハライのメリハリを劇的強調' },
  delicate: { name: '繊細・細字', desc: '抜き線や微細な筆圧変化を忠実に表現' },
};

type StudioTab = 'basic' | 'taper' | 'shape' | 'random' | 'type' | 'dynamic' | 'texture' | 'settings';

export const PenPresetsModal: React.FC<PenPresetsModalProps> = ({
  isOpen,
  onClose,
  currentParams,
  onApplyPreset,
  onChangePressureCurve,
  presets,
  onUpdatePresets,
  theme = 'dark' as ThemeMode,
}) => {
  const isLight = isLightTheme(theme);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<StudioTab>('basic');
  const [mobileView, setMobileView] = useState<'params' | 'scratchpad'>('params');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Working Preset State (Live editable brush)
  const [workingPreset, setWorkingPreset] = useState<UserPenPreset>(() => {
    return {
      id: `custom-pen-${Date.now()}`,
      name: 'デジタルペン',
      isCustom: true,
      brushStyle: currentParams.brushStyle || 'brush',
      brushWidth: currentParams.brushWidth || 36,
      pressureSensitivity: currentParams.pressureSensitivity || 'high',
      pressureCurve: currentParams.pressureCurve || DEFAULT_PRESSURE_CURVES.soft,
      autoSmoothBrush: currentParams.autoSmoothBrush ?? true,
      smoothStrength: currentParams.smoothStrength || 'standard',
      smoothPreserveCorners: currentParams.smoothPreserveCorners ?? true,
      autoUnionBrush: currentParams.autoUnionBrush ?? true,
      smoothingIntensity: currentParams.smoothingIntensity ?? 55,
      // 入り抜き
      taperStartLength: currentParams.taperStartLength ?? 0,
      taperEndLength: currentParams.taperEndLength ?? 0,
      taperStartWidth: currentParams.taperStartWidth ?? 100,
      taperEndWidth: currentParams.taperEndWidth ?? 100,
      taperStartOpacity: currentParams.taperStartOpacity ?? 100,
      taperEndOpacity: currentParams.taperEndOpacity ?? 100,
      taperStartTime: currentParams.taperStartTime ?? 100,
      taperEndTime: currentParams.taperEndTime ?? 100,
      forceTaper: currentParams.forceTaper ?? false,
      forceTaperEnd: currentParams.forceTaperEnd ?? false,
      taperTipShape: currentParams.taperTipShape || 'round',
      // 形状
      nibAngle: currentParams.nibAngle ?? 0,
      nibAspectRatio: currentParams.nibAspectRatio ?? 0,
      nibFollowDirection: currentParams.nibFollowDirection ?? false,
      nibSpacing: currentParams.nibSpacing ?? 1,
      constantWidth: currentParams.constantWidth ?? false,
      antiAlias: currentParams.antiAlias ?? true,
      // ランダム
      jitterPosition: currentParams.jitterPosition ?? 0,
      jitterConstrainPerp: currentParams.jitterConstrainPerp ?? true,
      jitterSize: currentParams.jitterSize ?? 0,
      jitterOpacity: currentParams.jitterOpacity ?? 0,
      jitterAngle: currentParams.jitterAngle ?? 0,
      jitterSpacing: currentParams.jitterSpacing ?? 0,
      // 動的
      speedWidthFactor: currentParams.speedWidthFactor ?? 0,
      speedOpacityFactor: currentParams.speedOpacityFactor ?? 0,
      speedFeatherFactor: currentParams.speedFeatherFactor ?? 0,
      pressureWidthFactor: currentParams.pressureWidthFactor ?? 0,
      pressureOpacityFactor: currentParams.pressureOpacityFactor ?? 0,
      pressureFeatherFactor: currentParams.pressureFeatherFactor ?? 0,
      // 設定
      stabilizationMethod: currentParams.stabilizationMethod || 'pre',
      speedStabilization: currentParams.speedStabilization ?? 0,
      legacyStabilization: currentParams.legacyStabilization ?? false,
      // 質感・インク効果
      inkBleed: currentParams.inkBleed ?? 0,
      axisSlant: currentParams.axisSlant ?? 0,
      edgeRoughness: currentParams.edgeRoughness ?? 0,
      tipSharpness: currentParams.tipSharpness ?? 0,
      pressureGamma: currentParams.pressureGamma ?? 1.0,
    };
  });

  // Sync working preset when modal opens
  useEffect(() => {
    if (isOpen) {
      setWorkingPreset((prev) => ({
        ...prev,
        brushStyle: currentParams.brushStyle,
        brushWidth: currentParams.brushWidth,
        pressureSensitivity: currentParams.pressureSensitivity,
        pressureCurve: currentParams.pressureCurve || prev.pressureCurve,
        autoSmoothBrush: currentParams.autoSmoothBrush,
        smoothStrength: currentParams.smoothStrength,
        smoothPreserveCorners: currentParams.smoothPreserveCorners,
        autoUnionBrush: currentParams.autoUnionBrush,
        smoothingIntensity: currentParams.smoothingIntensity ?? prev.smoothingIntensity,
        taperStartLength: currentParams.taperStartLength ?? prev.taperStartLength,
        taperEndLength: currentParams.taperEndLength ?? prev.taperEndLength,
        taperStartWidth: currentParams.taperStartWidth ?? prev.taperStartWidth,
        taperEndWidth: currentParams.taperEndWidth ?? prev.taperEndWidth,
        forceTaper: currentParams.forceTaper ?? prev.forceTaper,
        forceTaperEnd: currentParams.forceTaperEnd ?? prev.forceTaperEnd,
        taperTipShape: currentParams.taperTipShape ?? prev.taperTipShape,
        nibAngle: currentParams.nibAngle ?? prev.nibAngle,
        nibAspectRatio: currentParams.nibAspectRatio ?? prev.nibAspectRatio,
        nibFollowDirection: currentParams.nibFollowDirection ?? prev.nibFollowDirection,
        speedWidthFactor: currentParams.speedWidthFactor ?? prev.speedWidthFactor,
        jitterSize: currentParams.jitterSize ?? prev.jitterSize,
      }));
    }
  }, [isOpen, currentParams]);

  // Toast feedback helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // Preset Selector / Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState(workingPreset.name);
  const [showPresetDrawer, setShowPresetDrawer] = useState(false);

  // Preview Mode: S-Curve, Straight, or Loop
  const [previewPattern, setPreviewPattern] = useState<'scurve' | 'straight' | 'loop'>('scurve');
  const [showWireframe, setShowWireframe] = useState<boolean>(false);

  // Scratchpad Canvas Refs
  const scratchpadCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingScratchpadRef = useRef<boolean>(false);
  const scratchpadPointsRef = useRef<StrokePoint[]>([]);
  const scratchpadContoursRef = useRef<string[]>([]);
  const [livePressure, setLivePressure] = useState<number>(0);

  // High-Fidelity Multi-Pattern Live Brush Preview Generator
  const previewData = useMemo<{ svgPath: string; nodes: BezierNode[] }>(() => {
    const pts: StrokePoint[] = [];
    const w = 600;
    const h = 130;
    const centerY = h / 2;
    const maxHalfW = Math.min(32, workingPreset.brushWidth * 0.45);

    if (previewPattern === 'straight') {
      // 直線・抜きパターン (入り・芯・抜きの長さとプロポーションを直感的に確認)
      const startX = 45;
      const endX = w - 45;
      const spanX = endX - startX;
      const numPoints = 90;

      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const x = startX + t * spanX;
        const y = centerY;
        const basePres = Math.sin(t * Math.PI);
        const pres = workingPreset.pressureSensitivity === 'off'
          ? 0.5
          : Math.max(0.06, Math.min(1.0, Math.pow(basePres, 0.82) * 0.95 + 0.05));
        pts.push({ x, y, pressure: pres, time: t * 1000 });
      }
    } else if (previewPattern === 'loop') {
      // ループパターン (360度全方向の角度・扁平率・回転追従を俯瞰)
      const cx = w / 2;
      const cy = centerY;
      const rx = 180;
      const ry = Math.max(16, Math.min(34, cy - maxHalfW - 10));
      const numPoints = 120;

      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const theta = t * Math.PI * 2;
        const denom = 1 + Math.sin(theta) * Math.sin(theta);
        const x = cx + (rx * Math.cos(theta)) / denom;
        const y = cy + (ry * Math.sin(theta) * Math.cos(theta) * 1.5) / denom;
        const pres = workingPreset.pressureSensitivity === 'off'
          ? 0.5
          : 0.35 + 0.55 * Math.sin(t * Math.PI);
        pts.push({ x, y, pressure: pres, time: t * 1500 });
      }
    } else {
      // S字カーブ (ibisPaint標準：入出端の傾きゼロ・自然なうねりと抑揚)
      const startX = 40;
      const endX = w - 40;
      const spanX = endX - startX;
      const numPoints = 120;
      const amp = Math.max(10, Math.min(24, (centerY - maxHalfW - 12) * 0.72));

      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const x = startX + t * spanX;
        // Cosine-eased wave: dy/dt at t=0 and t=1 is precisely 0 (horizontal entrance & exit)
        const y = centerY - Math.sin(t * Math.PI) * Math.sin(t * Math.PI * 2) * amp;

        // Writing pressure envelope with soft touchdown and graceful lift
        const basePres = Math.sin(t * Math.PI);
        const pres = workingPreset.pressureSensitivity === 'off'
          ? 0.5
          : Math.max(0.06, Math.min(1.0, Math.pow(basePres, 0.85) * 0.95 + 0.05));

        pts.push({ x, y, pressure: pres, time: t * 1200 });
      }
    }

    const contour = strokePointsToOutline(
      pts,
      workingPreset.brushWidth,
      workingPreset.brushStyle,
      true,
      workingPreset.pressureSensitivity,
      workingPreset.pressureCurve,
      workingPreset.smoothingIntensity ?? 50,
      { customPreset: workingPreset, disableAutoStraight: true }
    );

    return {
      svgPath: contoursToSvgPath([contour]),
      nodes: contour.nodes || [],
    };
  }, [workingPreset, previewPattern]);

  // Scratchpad Redrawer
  const redrawScratchpad = useCallback(() => {
    const canvas = scratchpadCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw committed stroke paths
    ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
    for (const pathStr of scratchpadContoursRef.current) {
      try {
        const p2d = new Path2D(pathStr);
        ctx.fill(p2d, 'nonzero');
      } catch (_) {}
    }

    // Draw current in-progress stroke
    if (scratchpadPointsRef.current.length >= 2) {
      const liveContour = strokePointsToOutline(
        scratchpadPointsRef.current,
        workingPreset.brushWidth,
        workingPreset.brushStyle,
        true,
        workingPreset.pressureSensitivity,
        workingPreset.pressureCurve,
        workingPreset.smoothingIntensity ?? 50,
        { customPreset: workingPreset }
      );
      const livePath = contoursToSvgPath([liveContour]);
      if (livePath) {
        ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
        try {
          const p2d = new Path2D(livePath);
          ctx.fill(p2d, 'nonzero');
        } catch (_) {}
      }
    }
  }, [isLight, workingPreset]);

  // Scratchpad Pointer Handlers
  const handleScratchpadPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = scratchpadCanvasRef.current;
    if (!canvas) return;
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch (_) {}

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const rawPressure = typeof e.pressure === 'number' && e.pressure > 0 ? e.pressure : 0.5;

    isDrawingScratchpadRef.current = true;
    setLivePressure(rawPressure);
    scratchpadPointsRef.current = [{ x, y, pressure: rawPressure, time: Date.now() }];
    redrawScratchpad();
  };

  const handleScratchpadPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingScratchpadRef.current) return;
    e.preventDefault();
    const canvas = scratchpadCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const rawPressure = typeof e.pressure === 'number' && e.pressure > 0 ? e.pressure : 0.5;

    setLivePressure(rawPressure);
    scratchpadPointsRef.current.push({ x, y, pressure: rawPressure, time: Date.now() });
    redrawScratchpad();
  };

  const handleScratchpadPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingScratchpadRef.current) return;
    e.preventDefault();
    isDrawingScratchpadRef.current = false;

    if (scratchpadPointsRef.current.length > 0) {
      const contour = strokePointsToOutline(
        scratchpadPointsRef.current,
        workingPreset.brushWidth,
        workingPreset.brushStyle,
        true,
        workingPreset.pressureSensitivity,
        workingPreset.pressureCurve,
        workingPreset.smoothingIntensity ?? 50,
        { customPreset: workingPreset }
      );
      const pathStr = contoursToSvgPath([contour]);
      if (pathStr) {
        scratchpadContoursRef.current.push(pathStr);
      }
    }
    scratchpadPointsRef.current = [];
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch (_) {}
    redrawScratchpad();
  };

  const handleClearScratchpad = () => {
    scratchpadContoursRef.current = [];
    scratchpadPointsRef.current = [];
    redrawScratchpad();
    showToast('試し書きキャンバスを消去しました');
  };

  useEffect(() => {
    redrawScratchpad();
  }, [redrawScratchpad]);

  // Graph drag handler for Pressure Curve in Basic Tab
  const graphSvgRef = useRef<SVGSVGElement | null>(null);
  const draggingHandleRef = useRef<'p1' | 'p2' | null>(null);

  const curveConfig = workingPreset.pressureCurve || DEFAULT_PRESSURE_CURVES.soft;
  const p1 = curveConfig.p1 || { x: 0.33, y: 0.33 };
  const p2 = curveConfig.p2 || { x: 0.67, y: 0.67 };

  const graphMargin = 24;
  const graphW = 220;
  const graphH = 160;

  const curvePoints: { x: number; y: number }[] = [];
  const numSamples = 40;
  for (let i = 0; i <= numSamples; i++) {
    const rawX = i / numSamples;
    const evaluatedY = evaluatePressureCurve(rawX, curveConfig, workingPreset.pressureSensitivity);
    const svgX = graphMargin + rawX * graphW;
    const svgY = graphMargin + (1.0 - evaluatedY) * graphH;
    curvePoints.push({ x: svgX, y: svgY });
  }

  const curveSvgPathD = curvePoints.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  const p1SvgX = graphMargin + p1.x * graphW;
  const p1SvgY = graphMargin + (1.0 - p1.y) * graphH;
  const p2SvgX = graphMargin + p2.x * graphW;
  const p2SvgY = graphMargin + (1.0 - p2.y) * graphH;

  const handleGraphPointerDown = (handle: 'p1' | 'p2') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    draggingHandleRef.current = handle;
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handleGraphPointerMove = (e: React.PointerEvent) => {
    if (!draggingHandleRef.current || !graphSvgRef.current) return;
    const rect = graphSvgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const normX = Math.max(0.01, Math.min(0.99, (mouseX - graphMargin) / graphW));
    const normY = Math.max(0.0, Math.min(1.0, 1.0 - (mouseY - graphMargin) / graphH));

    const handle = draggingHandleRef.current;
    const newConfig: PressureCurveConfig = {
      ...curveConfig,
      enabled: true,
      presetId: 'custom',
      [handle]: { x: Math.round(normX * 100) / 100, y: Math.round(normY * 100) / 100 },
    };

    setWorkingPreset((prev) => ({ ...prev, pressureCurve: newConfig }));
    onChangePressureCurve?.(newConfig);
  };

  const handleGraphPointerUp = (e: React.PointerEvent) => {
    if (!draggingHandleRef.current) return;
    draggingHandleRef.current = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Preset operations
  const handleSaveAsNewPreset = () => {
    const name = workingPreset.name.trim() || `カスタムペン ${presets.length + 1}`;
    const newP: UserPenPreset = {
      ...workingPreset,
      id: `preset-custom-${Date.now()}`,
      name,
      isCustom: true,
      createdAt: Date.now(),
    };
    const next = [newP, ...presets];
    onUpdatePresets(next);
    saveUserPenPresets(next);
    onApplyPreset(newP);
    setWorkingPreset(newP);
    setRenameInput(name);
    showToast(`「${name}」を新規プリセットとして保存し、作図ペンとして適用しました`);
  };

  const handleApplyCurrentAndClose = () => {
    onApplyPreset(workingPreset);
    showToast(`「${workingPreset.name}」を作字ペンとして適用しました`);
    onClose();
  };

  const handleSelectPreset = (p: UserPenPreset) => {
    setWorkingPreset({
      ...p,
      name: p.name,
    });
    setRenameInput(p.name);
    showToast(`「${p.name}」をロードしました`);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = presets.filter((p) => p.id !== id);
    onUpdatePresets(next);
    saveUserPenPresets(next);
    showToast('プリセットを削除しました');
  };

  const handleDuplicatePreset = (p: UserPenPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    const dup: UserPenPreset = {
      ...p,
      id: `preset-copy-${Date.now()}`,
      name: `${p.name} (コピー)`,
      isCustom: true,
      createdAt: Date.now(),
    };
    const next = [dup, ...presets];
    onUpdatePresets(next);
    saveUserPenPresets(next);
    showToast(`「${dup.name}」を複製しました`);
  };

  const handleExportPresets = () => {
    const jsonStr = JSON.stringify(presets, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `font_pen_presets_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('プリセットをJSONファイルとして保存しました');
  };

  const handleImportPresets = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          const next = [...parsed, ...presets];
          onUpdatePresets(next);
          saveUserPenPresets(next);
          showToast(`${parsed.length} 個のプリセットを読み込みました`);
        }
      } catch (err) {
        showToast('JSONファイルの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Helper slider with - / + buttons
  const renderSlider = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    unit: string,
    onChange: (val: number) => void,
    desc?: string
  ) => {
    const handleDec = () => onChange(Math.max(min, Math.round((value - step) * 100) / 100));
    const handleInc = () => onChange(Math.min(max, Math.round((value + step) * 100) / 100));

    return (
      <div className="flex flex-col space-y-1.5 py-1.5 border-b border-stone-200/60 dark:border-stone-800/60 last:border-0">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-stone-700 dark:text-stone-300">{label}</span>
          <span className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {value}
            {unit}
          </span>
        </div>
        {desc && <span className="text-[10px] text-stone-500 dark:text-stone-400">{desc}</span>}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleDec}
            className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors font-bold text-sm"
          >
            -
          </button>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="flex-1 accent-emerald-600 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg cursor-pointer"
          />
          <button
            onClick={handleInc}
            className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors font-bold text-sm"
          >
            +
          </button>
        </div>
      </div>
    );
  };

  // Helper toggle switch
  const renderToggle = (
    label: string,
    checked: boolean,
    onChange: (val: boolean) => void,
    desc?: string
  ) => {
    return (
      <div className="flex items-center justify-between py-2 border-b border-stone-200/60 dark:border-stone-800/60 last:border-0">
        <div className="flex flex-col pr-3">
          <span className="text-xs font-medium text-stone-700 dark:text-stone-300">{label}</span>
          {desc && <span className="text-[10px] text-stone-500 dark:text-stone-400">{desc}</span>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            checked ? 'bg-emerald-600' : 'bg-stone-300 dark:bg-stone-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              checked ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-150">
      <div
        className={`flex flex-col min-h-0 bg-white dark:bg-[#18231c] text-stone-900 dark:text-stone-100 rounded-xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl h-[92vh] max-h-[900px]'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-[#121c16] shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowPresetDrawer((prev) => !prev)}
              className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors flex items-center space-x-1"
              title="プリセット一覧を開く"
            >
              <span className="text-xs font-bold">ブラシ ({presets.length})</span>
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showPresetDrawer ? 'rotate-90' : ''}`} />
            </button>

            <div className="h-4 w-px bg-stone-300 dark:bg-stone-700" />

            {/* Editable Brush Name */}
            {isRenaming ? (
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  className="px-2 py-0.5 text-xs bg-white dark:bg-stone-900 border border-emerald-500 rounded text-stone-900 dark:text-stone-100 font-bold focus:outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setWorkingPreset((prev) => ({ ...prev, name: renameInput.trim() || prev.name }));
                      setIsRenaming(false);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    setWorkingPreset((prev) => ({ ...prev, name: renameInput.trim() || prev.name }));
                    setIsRenaming(false);
                  }}
                  className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 rounded"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100">{workingPreset.name}</span>
                <button
                  onClick={() => {
                    setRenameInput(workingPreset.name);
                    setIsRenaming(true);
                  }}
                  className="p-1 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded transition-colors"
                  title="ブラシ名を変更"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Mobile View Switcher (Params vs Scratchpad) */}
            <div className="flex md:hidden items-center bg-stone-200/80 dark:bg-stone-800 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setMobileView('params')}
                className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                  mobileView === 'params'
                    ? 'bg-white dark:bg-stone-900 text-emerald-600 dark:text-emerald-400 '
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                パラメータ
              </button>
              <button
                onClick={() => setMobileView('scratchpad')}
                className={`px-2 py-0.5 rounded-md font-bold transition-all flex items-center space-x-1 ${
                  mobileView === 'scratchpad'
                    ? 'bg-white dark:bg-stone-900 text-emerald-600 dark:text-emerald-400 '
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                <PenTool className="w-3 h-3" />
                <span>試し書き</span>
              </button>
            </div>

            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 transition-colors"
              title={isFullscreen ? '元に戻す' : '最大化'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/60 text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              title="閉じる"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top: Multi-Pattern Live Brush Preview Banner (ibisPaint Style) */}
        <div className="p-2 sm:p-3 bg-stone-100/70 dark:bg-[#121c16]/90 border-b border-stone-200 dark:border-stone-800 shrink-0">
          <div className="relative w-full h-24 sm:h-28 md:h-32 rounded-lg overflow-hidden border border-stone-200/80 dark:border-stone-800 shadow-inner bg-stone-200/30 dark:bg-stone-900/40">
            {/* Checkerboard Pattern for Transparency Visibility */}
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="preview-checker" width="16" height="16" patternUnits="userSpaceOnUse">
                  <rect width="8" height="8" fill="#888888" />
                  <rect x="8" y="8" width="8" height="8" fill="#888888" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#preview-checker)" />
            </svg>

            {/* Rendered Live Brush Path */}
            <svg
              viewBox="0 0 600 130"
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 w-full h-full"
            >
              {previewData.svgPath && (
                <path
                  d={previewData.svgPath}
                  fill={isLight ? '#18181b' : '#f8fafc'}
                />
              )}
              {showWireframe && previewData.nodes.length > 0 && (
                <g className="pointer-events-none">
                  <path
                    d={previewData.svgPath}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.8}
                  />
                  {previewData.nodes.map((node) => (
                    <circle
                      key={node.id}
                      cx={node.x}
                      cy={node.y}
                      r={2}
                      fill="#38bdf8"
                    />
                  ))}
                </g>
              )}
            </svg>

            {/* Bottom-left preview metadata tag */}
            <div className="absolute bottom-2 left-3 flex items-center space-x-2 pointer-events-none">
              <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 bg-white/80 dark:bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                {workingPreset.name} · {workingPreset.brushWidth}px
              </span>
            </div>

            {/* Top-right pattern & wireframe controls (ibisPaint Style) */}
            <div className="absolute top-2 right-2 flex items-center space-x-1 bg-white/85 dark:bg-stone-900/85 backdrop-blur-xs p-1 rounded-lg border border-stone-200/80 dark:border-stone-800 text-[11px] ">
              <button
                onClick={() => setPreviewPattern('scurve')}
                className={`px-2 py-0.5 rounded font-bold transition-all ${
                  previewPattern === 'scurve'
                    ? 'bg-emerald-500 text-white '
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
                title="S字カーブ（入り抜き・うねり・抑揚）"
              >
                S字
              </button>
              <button
                onClick={() => setPreviewPattern('straight')}
                className={`px-2 py-0.5 rounded font-bold transition-all ${
                  previewPattern === 'straight'
                    ? 'bg-emerald-500 text-white '
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
                title="直線（純粋な入り抜き長さ・芯の太さ）"
              >
                直線
              </button>
              <button
                onClick={() => setPreviewPattern('loop')}
                className={`px-2 py-0.5 rounded font-bold transition-all ${
                  previewPattern === 'loop'
                    ? 'bg-emerald-500 text-white '
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
                title="ループ（全方向の角度・扁平率・回転追従）"
              >
                ループ
              </button>
              <div className="w-[1px] h-3.5 bg-stone-300 dark:bg-stone-700 mx-0.5" />
              <button
                onClick={() => setShowWireframe((v) => !v)}
                className={`px-1.5 py-0.5 rounded font-bold transition-all flex items-center space-x-1 ${
                  showWireframe
                    ? 'bg-sky-500 text-white '
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
                title="輪郭・ベジェノードの表示切替"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[10px]">ノード</span>
              </button>
            </div>
          </div>
        </div>

        {/* 8-Tab Navigation Bar (ibisPaint Style) */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#152019] overflow-x-auto shrink-0 scrollbar-thin touch-scroll-x">
          {[
            { id: 'basic' as StudioTab, label: '基本', icon: Paintbrush },
            { id: 'taper' as StudioTab, label: '入り抜き', icon: Diamond },
            { id: 'shape' as StudioTab, label: '形状', icon: Circle },
            { id: 'random' as StudioTab, label: 'ランダム', icon: Shuffle },
            { id: 'type' as StudioTab, label: 'タイプ', icon: Layers },
            { id: 'dynamic' as StudioTab, label: '動的', icon: Activity },
            { id: 'texture' as StudioTab, label: '質感', icon: Flame },
            { id: 'settings' as StudioTab, label: '設定', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 shrink-0 min-w-[68px] sm:min-w-[78px] py-2 px-2 flex flex-col items-center justify-center space-y-1 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-[#18231c]'
                    : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100/50 dark:hover:bg-stone-800/40'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'opacity-70'}`} />
                <span className="text-[11px] whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content Area: Parameter Controls (Left) + Live Scratchpad & Preset List (Right) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 min-w-0">
          {/* Preset Drawer Overlay / Sidebar */}
          {showPresetDrawer && (
            <div className="w-72 border-r border-stone-200 dark:border-stone-800 bg-stone-50/90 dark:bg-[#141e17] flex flex-col shrink-0 animate-in slide-in-from-left duration-150 overflow-hidden">
              <div className="p-2.5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300">マイプリセット</span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={handleExportPresets}
                    className="p-1 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 rounded"
                    title="JSONエクスポート"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <label className="p-1 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 rounded cursor-pointer" title="JSONインポート">
                    <Upload className="w-3.5 h-3.5" />
                    <input type="file" accept=".json" onChange={handleImportPresets} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {presets.map((p) => {
                  const isSelected = p.id === workingPreset.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPreset(p)}
                      className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                          : 'border-stone-200/80 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-white dark:bg-stone-900'
                      }`}
                    >
                      <div className="flex flex-col truncate pr-2">
                        <span className="font-bold truncate">{p.name}</span>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400">
                          {BRUSH_STYLE_INFO[p.brushStyle]?.name || p.brushStyle} · {p.brushWidth}px
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={(e) => handleDuplicatePreset(p, e)}
                          className="p-1 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded"
                          title="複製"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {p.isCustom && (
                          <button
                            onClick={(e) => handleDeletePreset(p.id, e)}
                            className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-stone-400 hover:text-rose-600 rounded"
                            title="削除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Left: Tab Control Panels */}
          <div className={`flex-1 overflow-y-auto min-h-0 min-w-0 p-3 sm:p-4 space-y-4 overscroll-contain ${mobileView === 'scratchpad' ? 'hidden md:block' : 'block'}`}>
            {/* 1. 基本 (Basic) */}
            {activeTab === 'basic' && (
              <div className="space-y-4 max-w-xl">
                <div className="bg-stone-50 dark:bg-stone-900/40 p-3 rounded-lg border border-stone-200/80 dark:border-stone-800/80 space-y-3">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
                    <Paintbrush className="w-3.5 h-3.5 text-emerald-500" />
                    <span>太さと筆圧感度</span>
                  </span>

                  {renderSlider('ブラシ太さ', workingPreset.brushWidth, 1, 150, 1, 'px', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, brushWidth: v }))
                  )}

                  {/* Pressure Sensitivity Selector */}
                  <div className="flex flex-col space-y-1.5 pt-1">
                    <span className="text-xs font-medium text-stone-700 dark:text-stone-300">筆圧感度モード</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['high', 'normal', 'low', 'off'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setWorkingPreset((prev) => ({ ...prev, pressureSensitivity: mode }))}
                          className={`py-1.5 px-2 rounded-md text-xs font-semibold border transition-all ${
                            workingPreset.pressureSensitivity === mode
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 shadow-sm'
                              : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100'
                          }`}
                        >
                          {mode === 'high' ? '高感度' : mode === 'normal' ? '標準' : mode === 'low' ? '弱め' : 'OFF (均一)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pressure Curve Graph Editor */}
                {workingPreset.pressureSensitivity !== 'off' && (
                  <div className="bg-stone-50 dark:bg-stone-900/40 p-3 rounded-lg border border-stone-200/80 dark:border-stone-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-500" />
                        <span>筆圧レスポンスカーブ</span>
                      </span>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400">ハンドルをドラッグして曲線を調整</span>
                    </div>

                    {/* Curve Presets Bar */}
                    <div className="grid grid-cols-5 gap-1">
                      {Object.entries(CURVE_PRESET_LABELS).map(([k, meta]) => (
                        <button
                          key={k}
                          onClick={() => {
                            const presetCfg = DEFAULT_PRESSURE_CURVES[k];
                            if (presetCfg) {
                              setWorkingPreset((prev) => ({ ...prev, pressureCurve: presetCfg }));
                              onChangePressureCurve?.(presetCfg);
                            }
                          }}
                          className={`py-1 px-1.5 rounded text-[10px] font-semibold border truncate transition-all ${
                            workingPreset.pressureCurve?.presetId === k
                              ? 'border-emerald-500 bg-emerald-100/70 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200'
                              : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                          }`}
                        >
                          {meta.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>

                    {/* SVG Cubic Bezier Curve Graph */}
                    <div className="flex justify-center pt-1">
                      <svg
                        ref={graphSvgRef}
                        width={graphW + graphMargin * 2}
                        height={graphH + graphMargin * 2}
                        onPointerMove={handleGraphPointerMove}
                        onPointerUp={handleGraphPointerUp}
                        className="bg-white dark:bg-stone-950 rounded border border-stone-200 dark:border-stone-800 shadow-inner select-none touch-none"
                      >
                        {/* Grid lines */}
                        <line x1={graphMargin} y1={graphMargin + graphH / 2} x2={graphMargin + graphW} y2={graphMargin + graphH / 2} stroke={isLight ? '#e2e8f0' : '#1e293b'} strokeDasharray="2 2" />
                        <line x1={graphMargin + graphW / 2} y1={graphMargin} x2={graphMargin + graphW / 2} y2={graphMargin + graphH} stroke={isLight ? '#e2e8f0' : '#1e293b'} strokeDasharray="2 2" />
                        <line x1={graphMargin} y1={graphMargin + graphH} x2={graphMargin + graphW} y2={graphMargin} stroke={isLight ? '#e2e8f0' : '#1e293b'} strokeDasharray="3 3" />

                        {/* Tangent control arms */}
                        <line x1={graphMargin} y1={graphMargin + graphH} x2={p1SvgX} y2={p1SvgY} stroke="#10b981" strokeWidth={1.5} opacity={0.6} />
                        <line x1={graphMargin + graphW} y1={graphMargin} x2={p2SvgX} y2={p2SvgY} stroke="#10b981" strokeWidth={1.5} opacity={0.6} />

                        {/* Bezier curve path */}
                        <path d={curveSvgPathD} fill="none" stroke="#10b981" strokeWidth={2.5} />

                        {/* Drag Handles */}
                        <circle cx={p1SvgX} cy={p1SvgY} r={6} fill="#10b981" stroke="#ffffff" strokeWidth={2} className="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform" onPointerDown={handleGraphPointerDown('p1')} />
                        <circle cx={p2SvgX} cy={p2SvgY} r={6} fill="#10b981" stroke="#ffffff" strokeWidth={2} className="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform" onPointerDown={handleGraphPointerDown('p2')} />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. 入り抜き (Tapering) */}
            {activeTab === 'taper' && (
              <div className="space-y-4 max-w-xl">
                <div className="bg-stone-50 dark:bg-stone-900/40 p-3 rounded-lg border border-stone-200/80 dark:border-stone-800/80 space-y-3">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
                    <Diamond className="w-3.5 h-3.5 text-emerald-500" />
                    <span>入り抜きの長さ・太さ設定</span>
                  </span>

                  {renderSlider('入りの太さ', workingPreset.taperStartWidth ?? 20, 0, 100, 5, '%', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, taperStartWidth: v }))
                  )}
                  {renderSlider('抜きの太さ', workingPreset.taperEndWidth ?? 10, 0, 100, 5, '%', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, taperEndWidth: v }))
                  )}
                  {renderSlider('入りの長さ', workingPreset.taperStartLength ?? 30, 0, 100, 5, '%', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, taperStartLength: v }))
                  )}
                  {renderSlider('抜きの長さ', workingPreset.taperEndLength ?? 40, 0, 100, 5, '%', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, taperEndLength: v }))
                  )}

                  {/* Taper Tip Shape Selector */}
                  <div className="flex flex-col space-y-1.5 pt-2 border-t border-stone-200/60 dark:border-stone-800/60">
                    <span className="text-xs font-medium text-stone-700 dark:text-stone-300">入り抜きの先端形状</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setWorkingPreset((prev) => ({ ...prev, taperTipShape: 'round' }))}
                        className={`py-2 px-3 rounded-md text-xs font-semibold border flex items-center justify-center space-x-1.5 ${
                          (workingPreset.taperTipShape || 'round') === 'round'
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                        }`}
                      >
                        <Circle className="w-3.5 h-3.5" />
                        <span>丸まり (ラウンド)</span>
                      </button>
                      <button
                        onClick={() => setWorkingPreset((prev) => ({ ...prev, taperTipShape: 'sharp' }))}
                        className={`py-2 px-3 rounded-md text-xs font-semibold border flex items-center justify-center space-x-1.5 ${
                          workingPreset.taperTipShape === 'sharp'
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                        }`}
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>尖り (シャープ)</span>
                      </button>
                    </div>
                  </div>

                  {renderToggle('強制入り抜き (マウス/タッチでもハライ適用)', workingPreset.forceTaper ?? true, (v) =>
                    setWorkingPreset((prev) => ({ ...prev, forceTaper: v }))
                  )}
                  {renderToggle('強制抜き (末端の払い自動先細り)', workingPreset.forceTaperEnd ?? false, (v) =>
                    setWorkingPreset((prev) => ({ ...prev, forceTaperEnd: v }))
                  )}
                </div>
              </div>
            )}

            {/* 3. 形状 (Shape & Nib) */}
            {activeTab === 'shape' && (
              <div className="space-y-4 max-w-xl">
                <div className="bg-stone-50 dark:bg-stone-900/40 p-3 rounded-lg border border-stone-200/80 dark:border-stone-800/80 space-y-3">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
                    <Circle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>筆先形状・角度・扁平率</span>
                  </span>

                  {renderSlider('筆先扁平率 (縦横比)', workingPreset.nibAspectRatio ?? 0, 0, 100, 5, '%', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, nibAspectRatio: v })),
                    '0% = 円形断面, 100% = 極平チゼル・カリグラフィーペン'
                  )}
                  {renderSlider('初期角度', workingPreset.nibAngle ?? 25, 0, 180, 5, '°', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, nibAngle: v })),
                    '明朝体(25°〜45°)やカリグラフィーの傾斜角'
                  )}

                  {renderToggle('回転の追従 (進行方向に筆先を合わせる)', workingPreset.nibFollowDirection ?? false, (v) =>
                    setWorkingPreset((prev) => ({ ...prev, nibFollowDirection: v })),
                    'ON: 進行方向に追従 / OFF: 固定角度（カリグラフィー・隷書調）'
                  )}
                  {renderToggle('太さを固定 (均一ストローク)', workingPreset.constantWidth ?? false, (v) =>
                    setWorkingPreset((prev) => ({ ...prev, constantWidth: v }))
                  )}
                  {renderToggle('アンチエイリアス / 滑らかなエッジ', workingPreset.antiAlias ?? true, (v) =>
                    setWorkingPreset((prev) => ({ ...prev, antiAlias: v }))
                  )}
                </div>
              </div>
            )}

            {/* 4. ランダム (Random & Jitter) */}
            {activeTab === 'random' && (
              <div className="space-y-4 max-w-xl">
                <div className="bg-stone-50 dark:bg-stone-900/40 p-3 rounded-lg border border-stone-200/80 dark:border-stone-800/80 space-y-3">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
                    <Shuffle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>ランダムゆらぎ・散布ジッター</span>
                  </span>

                  {renderSlider('太さランダム (サイズジッター)', workingPreset.jitterSize ?? 0, 0, 100, 5, '%', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, jitterSize: v })),
                    '線の太さにランダムな手書きのムラ・ゆらぎを付与'
                  )}
                  {renderSlider('位置ランダム (散布)', workingPreset.jitterPosition ?? 0, 0, 100, 5, '%', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, jitterPosition: v }))
                  )}
                  {renderToggle('位置ランダムは上下(法線)に拘束', workingPreset.jitterConstrainPerp ?? true, (v) =>
                    setWorkingPreset((prev) => ({ ...prev, jitterConstrainPerp: v }))
                  )}
                  {renderSlider('回転ランダム', workingPreset.jitterAngle ?? 0, 0, 100, 5, '%', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, jitterAngle: v }))
                  )}
                </div>
              </div>
            )}

            {/* 5. タイプ (Type / Nib Gallery) */}
            {activeTab === 'type' && (
              <div className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(BRUSH_STYLE_INFO) as BrushStyle[]).map((st) => {
                    const info = BRUSH_STYLE_INFO[st];
                    const isSelected = workingPreset.brushStyle === st;
                    return (
                      <button
                        key={st}
                        onClick={() => setWorkingPreset((prev) => ({ ...prev, brushStyle: st }))}
                        className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between space-y-1.5 ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm'
                            : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">{info.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500">
                            {info.category}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 line-clamp-2">{info.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. 動的 (Dynamic Dynamics) */}
            {activeTab === 'dynamic' && (
              <div className="space-y-4 max-w-xl">
                <div className="bg-stone-50 dark:bg-stone-900/40 p-3 rounded-lg border border-stone-200/80 dark:border-stone-800/80 space-y-3">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-500" />
                    <span>速度による動的変化</span>
                  </span>

                  {renderSlider('速度:太さ', workingPreset.speedWidthFactor ?? 0, -100, 100, 5, '%', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, speedWidthFactor: v })),
                    '正: 速く引くと太い / 負: 速く払うとシャープに細くなる'
                  )}
                  {renderSlider('速度:かすれ', workingPreset.speedFeatherFactor ?? 0, 0, 100, 5, '%', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, speedFeatherFactor: v }))
                  )}
                </div>

                <div className="bg-stone-50 dark:bg-stone-900/40 p-3 rounded-lg border border-stone-200/80 dark:border-stone-800/80 space-y-3">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
                    <Flame className="w-3.5 h-3.5 text-emerald-500" />
                    <span>筆圧による抑揚</span>
                  </span>

                  {renderSlider('筆圧:太さ抑揚', workingPreset.pressureWidthFactor ?? 0, 0, 100, 5, '%', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, pressureWidthFactor: v }))
                  )}
                </div>
              </div>
            )}

            {/* 8. 質感・インク (Texture & Ink Effects) */}
            {activeTab === 'texture' && (
              <div className="space-y-4 max-w-xl">
                <div className="bg-stone-50 dark:bg-stone-900/40 p-3 rounded-lg border border-stone-200/80 dark:border-stone-800/80 space-y-3">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span>質感・インク・傾斜パラメータ</span>
                  </span>

                  {renderSlider('墨にじみ・インク滲み', workingPreset.inkBleed ?? 0, 0, 100, 5, '%', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, inkBleed: v }))
                  )}

                  {renderSlider('軸の傾斜角 (イタリック)', workingPreset.axisSlant ?? 0, -45, 45, 1, '°', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, axisSlant: v }))
                  )}

                  {renderSlider('輪郭の微細な荒れ (質感)', workingPreset.edgeRoughness ?? 0, 0, 100, 5, '%', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, edgeRoughness: v }))
                  )}

                  {renderSlider('尖端の鋭利さ (抜き強調)', workingPreset.tipSharpness ?? 0, 0, 100, 5, '%', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, tipSharpness: v }))
                  )}

                  {renderSlider('筆圧レスポンスガンマ', workingPreset.pressureGamma ?? 1.0, 0.5, 2.5, 0.1, '', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, pressureGamma: v }))
                  )}
                </div>
              </div>
            )}

            {/* 7. 設定 (Settings & Stabilization) */}
            {activeTab === 'settings' && (
              <div className="space-y-4 max-w-xl">
                <div className="bg-stone-50 dark:bg-stone-900/40 p-3 rounded-lg border border-stone-200/80 dark:border-stone-800/80 space-y-3">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
                    <Settings className="w-3.5 h-3.5 text-emerald-500" />
                    <span>手ぶれ補正 (Stabilizer) 設定</span>
                  </span>

                  {renderToggle('手ぶれ補正を有効化', workingPreset.autoSmoothBrush ?? true, (v) =>
                    setWorkingPreset((prev) => ({ ...prev, autoSmoothBrush: v }))
                  )}

                  {/* Stabilization Method: Pre / Post */}
                  <div className="flex flex-col space-y-1.5 pt-1">
                    <span className="text-xs font-medium text-stone-700 dark:text-stone-300">補正方法</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setWorkingPreset((prev) => ({ ...prev, stabilizationMethod: 'pre' }))}
                        className={`py-1.5 px-3 rounded-md text-xs font-semibold border ${
                          (workingPreset.stabilizationMethod || 'pre') === 'pre'
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                        }`}
                      >
                        事前補正 (リアルタイム追従)
                      </button>
                      <button
                        onClick={() => setWorkingPreset((prev) => ({ ...prev, stabilizationMethod: 'post' }))}
                        className={`py-1.5 px-3 rounded-md text-xs font-semibold border ${
                          workingPreset.stabilizationMethod === 'post'
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                        }`}
                      >
                        事後補正 (書き終わり時に最適化)
                      </button>
                    </div>
                  </div>

                  {renderSlider('常時補正強度', workingPreset.smoothingIntensity ?? 55, 0, 100, 5, '', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, smoothingIntensity: v }))
                  )}
                  {renderSlider('高速時補正強度', workingPreset.speedStabilization ?? 0, 0, 100, 5, '', (v) =>
                    setWorkingPreset((prev) => ({ ...prev, speedStabilization: v }))
                  )}

                  {renderToggle('折れ・角の張り出しを保持 (転折保護)', workingPreset.smoothPreserveCorners ?? true, (v) =>
                    setWorkingPreset((prev) => ({ ...prev, smoothPreserveCorners: v }))
                  )}
                  {renderToggle('自動合体 (交差した線の白抜き解消・自動融合)', workingPreset.autoUnionBrush ?? true, (v) =>
                    setWorkingPreset((prev) => ({ ...prev, autoUnionBrush: v }))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Live Interactive Scratchpad (試し書きエリア) */}
          <div className={`w-full md:w-80 border-t md:border-t-0 md:border-l border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-[#121c16]/60 p-3 flex flex-col shrink-0 ${mobileView === 'params' ? 'hidden md:flex' : 'flex'}`}>
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center space-x-1">
                <PenTool className="w-3.5 h-3.5 text-emerald-500" />
                <span>試し書きキャンバス</span>
              </span>
              <button
                onClick={handleClearScratchpad}
                className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                title="試し書きを消去"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Canvas Scratchpad Container */}
            <div className="relative flex-1 rounded-lg border border-stone-200 dark:border-stone-800 overflow-hidden bg-white dark:bg-stone-950 shadow-inner">
              <canvas
                ref={scratchpadCanvasRef}
                width={320}
                height={400}
                onPointerDown={handleScratchpadPointerDown}
                onPointerMove={handleScratchpadPointerMove}
                onPointerUp={handleScratchpadPointerUp}
                onPointerCancel={handleScratchpadPointerUp}
                className="w-full h-full cursor-crosshair touch-none"
              />
              <div className="absolute bottom-2 right-2 text-[10px] text-stone-400 dark:text-stone-600 pointer-events-none">
                マウス・ペンタブ対応
              </div>
            </div>

            {/* Live Pressure Meter */}
            <div className="pt-2 flex items-center space-x-2 text-[10px] text-stone-500">
              <span>リアルタイム筆圧:</span>
              <div className="flex-1 h-1.5 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-75"
                  style={{ width: `${Math.round(livePressure * 100)}%` }}
                />
              </div>
              <span className="font-mono w-8 text-right font-bold text-emerald-600 dark:text-emerald-400">
                {Math.round(livePressure * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#121c16] flex items-center justify-between shrink-0">
          <button
            onClick={() => {
              try {
                localStorage.removeItem('mojisaku_sticky_brush_configs');
              } catch (_) {}
              const cleanDefault: UserPenPreset = {
                id: 'default-brush',
                name: '標準毛筆ペン',
                isCustom: false,
                brushStyle: 'brush',
                brushWidth: 38,
                pressureSensitivity: 'high',
                pressureCurve: DEFAULT_PRESSURE_CURVES.soft,
                autoSmoothBrush: true,
                smoothStrength: 'standard',
                smoothPreserveCorners: true,
                autoUnionBrush: true,
                smoothingIntensity: 55,
                taperStartLength: 0,
                taperEndLength: 0,
                taperStartWidth: 100,
                taperEndWidth: 100,
                taperStartOpacity: 100,
                taperEndOpacity: 100,
                taperStartTime: 100,
                taperEndTime: 100,
                forceTaper: false,
                forceTaperEnd: false,
                taperTipShape: 'round',
                nibAngle: 0,
                nibAspectRatio: 0,
                nibFollowDirection: false,
                nibSpacing: 1,
                constantWidth: false,
                antiAlias: true,
                jitterPosition: 0,
                jitterConstrainPerp: true,
                jitterSize: 0,
                jitterOpacity: 0,
                jitterAngle: 0,
                jitterSpacing: 0,
                speedWidthFactor: 0,
                speedOpacityFactor: 0,
                speedFeatherFactor: 0,
                pressureWidthFactor: 0,
                pressureOpacityFactor: 0,
                pressureFeatherFactor: 0,
                stabilizationMethod: 'pre',
                speedStabilization: 0,
                legacyStabilization: false,
              };
              setWorkingPreset(cleanDefault);
              setRenameInput(cleanDefault.name);
              onApplyPreset(cleanDefault);
              showToast('ペン設定を完全な初期状態（標準筆）にリセットしました');
            }}
            className="px-3 py-1.5 rounded-md text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            初期値に戻す
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSaveAsNewPreset}
              className="px-3 py-1.5 rounded-md text-xs font-semibold border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 transition-colors"
            >
              新規保存
            </button>
            <button
              onClick={handleApplyCurrentAndClose}
 className="px-4 py-1.5 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-95 flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>このペンを適用して閉じる</span>
            </button>
          </div>
        </div>

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-stone-900/90 text-white text-xs font-medium rounded-full shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none z-50">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
};
