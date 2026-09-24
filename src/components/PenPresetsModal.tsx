import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  SlidersHorizontal,
  PenTool,
  Bookmark,
  Paintbrush,
  Pencil,
  Feather,
  Wand2,
  Activity,
  Layers,
  Maximize2,
  Minimize2,
  Eraser,
  TrendingUp,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { BrushStyle, UserPenPreset, PressureCurveConfig, PressureCurvePoint, StrokePoint } from '../types';
import { DEFAULT_PEN_PRESETS, DEFAULT_PRESSURE_CURVES, saveUserPenPresets } from '../utils/presetData';
import { strokePointsToOutline, contoursToSvgPath, solveCubicBezierYForX, evaluatePressureCurve } from '../utils/pathUtils';
import { ThemeMode, isLightTheme } from '../utils/theme';

interface PenPresetsModalProps {
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

const BRUSH_STYLE_NAMES: Record<BrushStyle, string> = {
  brush: '毛筆・書道筆',
  signpen: 'サインペン・太字',
  sumi: '墨だまり筆',
  marumoji: '丸文字・ポップ',
  fountain: '万年筆・Gペン',
  mincho_nib: '明朝体風・縦太横細筆',
  reisho_chisel: '隷書風・扁平平筆',
  g_pen: '漫画・鋭利Gペン',
  pixel_dot: 'ファミコン・ピクセル筆',
  marker: '丸マーカー',
  ballpoint: 'ボールペン',
  calligraphy: '平筆カリグラフィー',
  highlighter: '平マーカー・リボン',
  pencil: '鉛筆・細字',
  chalk: 'チョーク',
  sharp: 'カクカク角筆',
  sharp_round: 'カクカク角丸筆',
  wobbly: 'ゆらぎ手書き線',
  polygon: '多角形ペン',
};

const CURVE_PRESET_LABELS: Record<string, { name: string; desc: string }> = {
  linear: { name: '標準 (リニア)', desc: '入力と太さが1:1の自然なレスポンス' },
  soft: { name: 'ソフト (弱筆圧・高感度)', desc: '軽いタッチでもしっかり太さが出る' },
  hard: { name: 'ハード (強筆圧・重め)', desc: '強く押し込んで太く、細線がブレにくい' },
  's-curve': { name: 'S字抑揚 (ダイナミック)', desc: 'トメ・ハライの抑揚とコントラストを強調' },
  delicate: { name: '繊細・細字 (デリケート)', desc: '抜き線や微細な筆圧変化を忠実に表現' },
};

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
  const [newPresetName, setNewPresetName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'curve' | 'presets'>('curve');

  // Pressure Curve state
  const [curveConfig, setCurveConfig] = useState<PressureCurveConfig>(() => {
    return (
      currentParams.pressureCurve ||
      DEFAULT_PRESSURE_CURVES.soft || {
        enabled: true,
        p1: { x: 0.15, y: 0.55 },
        p2: { x: 0.45, y: 0.9 },
        minThreshold: 0.0,
        maxThreshold: 1.0,
        presetId: 'soft',
      }
    );
  });

  // Sync if currentParams.pressureCurve changes from outside
  useEffect(() => {
    if (currentParams.pressureCurve) {
      setCurveConfig(currentParams.pressureCurve);
    }
  }, [currentParams.pressureCurve]);

  // Live pressure tracked from scratchpad or drag
  const [livePressure, setLivePressure] = useState<number>(0);
  const [isStylusInput, setIsStylusInput] = useState<boolean>(false);

  // Scratchpad Canvas Refs
  const scratchpadCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingScratchpadRef = useRef<boolean>(false);
  const scratchpadPointsRef = useRef<StrokePoint[]>([]);
  const scratchpadContoursRef = useRef<string[]>([]);

  // Dragging State for Graph Handles
  const graphSvgRef = useRef<SVGSVGElement | null>(null);
  const draggingHandleRef = useRef<'p1' | 'p2' | null>(null);

  // Keyboard shortcut listener: Escape and F
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if ((e.key === 'f' || e.key === 'F') && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, onClose]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Update curve and notify parent
  const updateCurve = useCallback(
    (newConfig: PressureCurveConfig) => {
      setCurveConfig(newConfig);
      if (onChangePressureCurve) {
        onChangePressureCurve(newConfig);
      }
    },
    [onChangePressureCurve]
  );

  const handleSelectCurvePreset = (presetKey: string) => {
    const base = DEFAULT_PRESSURE_CURVES[presetKey];
    if (!base) return;
    const updated: PressureCurveConfig = {
      ...base,
      enabled: true,
      presetId: presetKey as any,
    };
    updateCurve(updated);
    showToast(`筆圧カーブ「${CURVE_PRESET_LABELS[presetKey]?.name || presetKey}」を適用しました`);
  };

  const handleResetCurveToDefault = () => {
    const def = DEFAULT_PRESSURE_CURVES.linear;
    updateCurve({ ...def });
    showToast('筆圧カーブを初期リニア（標準）に戻しました');
  };

  // Graph drag handling
  const handleGraphPointerDown = (handle: 'p1' | 'p2', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingHandleRef.current = handle;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleGraphPointerMove = (e: React.PointerEvent) => {
    if (!draggingHandleRef.current || !graphSvgRef.current) return;
    e.preventDefault();
    const rect = graphSvgRef.current.getBoundingClientRect();
    const margin = 24;
    const graphWidth = rect.width - margin * 2;
    const graphHeight = rect.height - margin * 2;

    if (graphWidth <= 0 || graphHeight <= 0) return;

    const rawX = (e.clientX - rect.left - margin) / graphWidth;
    const rawY = 1.0 - (e.clientY - rect.top - margin) / graphHeight;

    const clampedX = Math.max(0.01, Math.min(0.99, Number(rawX.toFixed(3))));
    const clampedY = Math.max(0.0, Math.min(1.0, Number(rawY.toFixed(3))));

    const handle = draggingHandleRef.current;
    const nextConfig: PressureCurveConfig = {
      ...curveConfig,
      presetId: 'custom',
      [handle]: { x: clampedX, y: clampedY },
    };
    updateCurve(nextConfig);
  };

  const handleGraphPointerUp = (e: React.PointerEvent) => {
    if (draggingHandleRef.current) {
      draggingHandleRef.current = null;
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // Scratchpad Drawing
  const redrawScratchpad = useCallback(() => {
    const canvas = scratchpadCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw saved contours
    ctx.fillStyle = isLight ? '#0f172a' : '#34d399';
    for (const svgPathStr of scratchpadContoursRef.current) {
      const p = new Path2D(svgPathStr);
      ctx.fill(p);
    }

    // Draw active stroke preview if currently drawing
    if (isDrawingScratchpadRef.current && scratchpadPointsRef.current.length > 0) {
      const pts = scratchpadPointsRef.current;
      const contour = strokePointsToOutline(
        pts,
        currentParams.brushWidth,
        currentParams.brushStyle,
        true,
        currentParams.pressureSensitivity,
        curveConfig,
        currentParams.smoothingIntensity
      );
      const pathStr = contoursToSvgPath([contour]);
      ctx.fillStyle = isLight ? '#047857' : '#10b981';
      ctx.fill(new Path2D(pathStr));
    }
  }, [isLight, currentParams.brushWidth, currentParams.brushStyle, currentParams.pressureSensitivity, currentParams.smoothingIntensity, curveConfig]);

  // Handle Scratchpad Pointer Events
  const handleScratchpadPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = scratchpadCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const rawPressure = typeof e.pressure === 'number' && e.pressure > 0 ? e.pressure : 0.5;

    setIsStylusInput(e.pointerType === 'pen');
    setLivePressure(rawPressure);
    isDrawingScratchpadRef.current = true;
    scratchpadPointsRef.current = [{ x, y, pressure: rawPressure, time: Date.now() }];
    (e.target as Element).setPointerCapture(e.pointerId);
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

    setIsStylusInput(e.pointerType === 'pen');
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
        currentParams.brushWidth,
        currentParams.brushStyle,
        true,
        currentParams.pressureSensitivity,
        curveConfig,
        currentParams.smoothingIntensity
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

  // Re-draw scratchpad on theme/parameter change
  useEffect(() => {
    redrawScratchpad();
  }, [redrawScratchpad]);

  // Create new user pen preset with current curve
  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    const nameToSave = newPresetName.trim() || `カスタム書き味 ${presets.length + 1}`;
    const newPreset: UserPenPreset = {
      id: `custom-preset-${Date.now()}`,
      name: nameToSave,
      isCustom: true,
      brushStyle: currentParams.brushStyle,
      brushWidth: currentParams.brushWidth,
      pressureSensitivity: currentParams.pressureSensitivity,
      pressureCurve: curveConfig,
      smoothingIntensity: currentParams.smoothingIntensity ?? 50,
      autoSmoothBrush: currentParams.autoSmoothBrush,
      smoothStrength: currentParams.smoothStrength,
      smoothPreserveCorners: currentParams.smoothPreserveCorners,
      autoUnionBrush: currentParams.autoUnionBrush,
      createdAt: Date.now(),
    };

    const nextPresets = [newPreset, ...presets];
    onUpdatePresets(nextPresets);
    saveUserPenPresets(nextPresets);
    setNewPresetName('');
    setIsAdding(false);
    showToast(`「${nameToSave}」をプリセット保存しました`);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextPresets = presets.filter((p) => p.id !== id);
    onUpdatePresets(nextPresets);
    saveUserPenPresets(nextPresets);
    showToast('プリセットを削除しました');
  };

  const handleResetDefaults = () => {
    if (window.confirm('プリセット一覧を初期状態に戻しますか？')) {
      onUpdatePresets(DEFAULT_PEN_PRESETS);
      saveUserPenPresets(DEFAULT_PEN_PRESETS);
      showToast('プリセットを初期状態にリセットしました');
    }
  };

  // Check if current parameters match an existing preset
  const isCurrentActive = (p: UserPenPreset) => {
    return (
      p.brushStyle === currentParams.brushStyle &&
      p.brushWidth === currentParams.brushWidth &&
      p.pressureSensitivity === currentParams.pressureSensitivity &&
      (p.smoothingIntensity ?? 50) === (currentParams.smoothingIntensity ?? 50) &&
      p.autoSmoothBrush === currentParams.autoSmoothBrush &&
      p.smoothStrength === currentParams.smoothStrength &&
      p.smoothPreserveCorners === currentParams.smoothPreserveCorners &&
      p.autoUnionBrush === currentParams.autoUnionBrush
    );
  };

  // Generate SVG curve path points
  const graphMargin = 28;
  const graphW = 240;
  const graphH = 200;

  const p1 = curveConfig.p1 || { x: 0.33, y: 0.33 };
  const p2 = curveConfig.p2 || { x: 0.67, y: 0.67 };

  // Calculate curve points for SVG path
  const curvePoints: { x: number; y: number }[] = [];
  const numSamples = 40;
  for (let i = 0; i <= numSamples; i++) {
    const rawX = i / numSamples;
    const evaluatedY = evaluatePressureCurve(rawX, curveConfig, currentParams.pressureSensitivity);
    const svgX = graphMargin + rawX * graphW;
    const svgY = graphMargin + (1.0 - evaluatedY) * graphH;
    curvePoints.push({ x: svgX, y: svgY });
  }

  const curveSvgPathD = curvePoints.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  const areaSvgPathD = `${curveSvgPathD} L ${graphMargin + graphW} ${graphMargin + graphH} L ${graphMargin} ${
    graphMargin + graphH
  } Z`;

  // SVG Coordinates for Handles
  const p1SvgX = graphMargin + p1.x * graphW;
  const p1SvgY = graphMargin + (1.0 - p1.y) * graphH;
  const p2SvgX = graphMargin + p2.x * graphW;
  const p2SvgY = graphMargin + (1.0 - p2.y) * graphH;

  // Live indicator position on the curve
  const liveEvaluatedY = evaluatePressureCurve(livePressure, curveConfig, currentParams.pressureSensitivity);
  const liveSvgX = graphMargin + Math.max(0, Math.min(1, livePressure)) * graphW;
  const liveSvgY = graphMargin + (1.0 - Math.max(0, Math.min(1, liveEvaluatedY))) * graphH;

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className={`fixed inset-0 z-50 transition-all ${
        isFullscreen
          ? 'p-0 w-screen h-screen bg-black/85 flex flex-col'
          : 'flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn'
      }`}
    >
      <div
        className={`flex flex-col transition-all overflow-hidden ${
          isFullscreen
            ? isLight
              ? 'w-screen h-screen rounded-none border-none shadow-none bg-stone-50 text-stone-800'
              : 'w-screen h-screen rounded-none border-none shadow-none bg-[#121915] text-emerald-100'
            : isLight
            ? 'w-full max-w-3xl xl:max-w-4xl rounded-2xl shadow-2xl border max-h-[92vh] bg-white border-stone-200 text-stone-800'
            : 'w-full max-w-3xl xl:max-w-4xl rounded-2xl shadow-2xl border max-h-[92vh] bg-[#141d18] border-[#25362b] text-emerald-100'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between shrink-0 ${
            isLight ? 'border-stone-200 bg-stone-50' : 'border-[#223025] bg-[#111814]'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-xl ${
                isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-[#1e2d24] text-emerald-400'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-extrabold tracking-tight">筆圧カーブ & 描き味プリセット</h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  {curveConfig.presetId ? CURVE_PRESET_LABELS[curveConfig.presetId]?.name || 'カスタム' : 'カスタム'}
                </span>
                {isFullscreen && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-medium">
                    全画面
                  </span>
                )}
              </div>
              <p className="text-xs opacity-70">
                ペンの筆圧特性（ソフト〜ハード）をグラフ制御し、個人の手の癖に最適化
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-1.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                isFullscreen
                  ? isLight
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : isLight
                  ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                  : 'bg-[#101813] border-[#25362b] text-emerald-300 hover:bg-[#18231c]'
              }`}
              title={isFullscreen ? '通常表示に戻す (F または Esc)' : '全画面表示に拡大 (F)'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">通常</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">全画面</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors ${
                isLight ? 'hover:bg-stone-200 text-stone-600' : 'hover:bg-[#25362b] text-emerald-300'
              }`}
              title="閉じる (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div
          className={`flex items-center border-b px-5 py-2 gap-2 text-xs font-bold shrink-0 ${
            isLight ? 'bg-stone-100/70 border-stone-200' : 'bg-[#121a15] border-[#202e24]'
          }`}
        >
          <button
            onClick={() => setActiveTab('curve')}
            className={`px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 transition-all ${
              activeTab === 'curve'
                ? isLight
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-500 text-stone-950 shadow-xs'
                : isLight
                ? 'text-stone-600 hover:bg-stone-200'
                : 'text-emerald-300/70 hover:bg-[#1b261f] hover:text-emerald-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>筆圧グラフ微調整 & テスト</span>
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 transition-all ${
              activeTab === 'presets'
                ? isLight
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-500 text-stone-950 shadow-xs'
                : isLight
                ? 'text-stone-600 hover:bg-stone-200'
                : 'text-emerald-300/70 hover:bg-[#1b261f] hover:text-emerald-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>保存済みプリセット一覧 ({presets.length})</span>
          </button>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white text-xs font-bold py-1.5 px-4 text-center animate-fadeIn shrink-0 flex items-center justify-center space-x-1.5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4">
          {activeTab === 'curve' ? (
            <div className="space-y-4">
              {/* Curve Presets Quick Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center space-x-1.5 text-stone-700 dark:text-emerald-300">
                    <Zap className="w-3.5 h-3.5 text-emerald-500" />
                    <span>筆圧カーブ プリセット</span>
                  </span>
                  <button
                    onClick={handleResetCurveToDefault}
                    className="text-[11px] text-stone-500 dark:text-emerald-400/70 hover:underline flex items-center space-x-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>リニアに戻す</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {Object.entries(CURVE_PRESET_LABELS).map(([key, info]) => {
                    const isSelected = curveConfig.presetId === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSelectCurvePreset(key)}
                        className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                          isSelected
                            ? isLight
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/30 font-bold'
                              : 'bg-[#1b2b21] border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/30 font-bold'
                            : isLight
                            ? 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                            : 'bg-[#16201a] hover:bg-[#1b261f] border-[#25362b] text-emerald-300/80'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                        </div>
                        <div className="text-xs font-extrabold line-clamp-1">{info.name.split(' ')[0]}</div>
                        <div className="text-[10px] opacity-70 line-clamp-2 leading-tight mt-0.5">{info.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main Interactive Grid & Scratchpad Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Interactive Bezier Curve Graph */}
                <div
                  className={`p-4 rounded-2xl border flex flex-col justify-between ${
                    isLight ? 'bg-white border-stone-200 shadow-xs' : 'bg-[#16201a] border-[#25362b] shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-400">
                      <TrendingUp className="w-4 h-4" />
                      <span>筆圧応答カーブ グラフ</span>
                    </div>
                    <span className="text-[11px] opacity-60 font-mono">
                      P1:({Math.round(p1.x * 100)}%, {Math.round(p1.y * 100)}%) | P2:({Math.round(p2.x * 100)}%,{' '}
                      {Math.round(p2.y * 100)}%)
                    </span>
                  </div>

                  {/* SVG Graph Viewport */}
                  <div className="relative flex justify-center items-center select-none py-1">
                    <svg
                      ref={graphSvgRef}
                      width={graphW + graphMargin * 2}
                      height={graphH + graphMargin * 2}
                      viewBox={`0 0 ${graphW + graphMargin * 2} ${graphH + graphMargin * 2}`}
                      className="touch-none cursor-crosshair overflow-visible"
                      onPointerMove={handleGraphPointerMove}
                      onPointerUp={handleGraphPointerUp}
                    >
                      <defs>
                        {/* Gradient Fill under curve */}
                        <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                        </linearGradient>
                        <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#059669" />
                          <stop offset="100%" stopColor="#34d399" />
                        </linearGradient>
                      </defs>

                      {/* Graph Background Box */}
                      <rect
                        x={graphMargin}
                        y={graphMargin}
                        width={graphW}
                        height={graphH}
                        fill={isLight ? '#f8fafc' : '#0e1411'}
                        stroke={isLight ? '#e2e8f0' : '#1e2c22'}
                        strokeWidth="1.5"
                        rx="8"
                      />

                      {/* Grid Lines (25%, 50%, 75%) */}
                      {[0.25, 0.5, 0.75].map((pct) => (
                        <g key={pct}>
                          {/* Horizontal Grid */}
                          <line
                            x1={graphMargin}
                            y1={graphMargin + (1 - pct) * graphH}
                            x2={graphMargin + graphW}
                            y2={graphMargin + (1 - pct) * graphH}
                            stroke={isLight ? '#e2e8f0' : '#1e2d24'}
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                          {/* Vertical Grid */}
                          <line
                            x1={graphMargin + pct * graphW}
                            y1={graphMargin}
                            x2={graphMargin + pct * graphW}
                            y2={graphMargin + graphH}
                            stroke={isLight ? '#e2e8f0' : '#1e2d24'}
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                          {/* Labels */}
                          <text
                            x={graphMargin - 4}
                            y={graphMargin + (1 - pct) * graphH + 3}
                            textAnchor="end"
                            fontSize="8"
                            fill={isLight ? '#94a3b8' : '#4b6353'}
                            fontFamily="monospace"
                          >
                            {Math.round(pct * 100)}%
                          </text>
                          <text
                            x={graphMargin + pct * graphW}
                            y={graphMargin + graphH + 12}
                            textAnchor="middle"
                            fontSize="8"
                            fill={isLight ? '#94a3b8' : '#4b6353'}
                            fontFamily="monospace"
                          >
                            {Math.round(pct * 100)}%
                          </text>
                        </g>
                      ))}

                      {/* Reference Linear Diagonal (y = x) */}
                      <line
                        x1={graphMargin}
                        y1={graphMargin + graphH}
                        x2={graphMargin + graphW}
                        y2={graphMargin}
                        stroke={isLight ? '#cbd5e1' : '#273a2e'}
                        strokeDasharray="4 4"
                        strokeWidth="1.5"
                      />

                      {/* Area Under Curve */}
                      <path d={areaSvgPathD} fill="url(#curveGradient)" />

                      {/* Tangent line from start to P1 */}
                      <line
                        x1={graphMargin}
                        y1={graphMargin + graphH}
                        x2={p1SvgX}
                        y2={p1SvgY}
                        stroke="#10b981"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                        opacity="0.7"
                      />

                      {/* Tangent line from end to P2 */}
                      <line
                        x1={graphMargin + graphW}
                        y1={graphMargin}
                        x2={p2SvgX}
                        y2={p2SvgY}
                        stroke="#10b981"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                        opacity="0.7"
                      />

                      {/* Main Curve Path */}
                      <path
                        d={curveSvgPathD}
                        fill="none"
                        stroke="url(#strokeGradient)"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />

                      {/* Control Handle P1 */}
                      <g
                        className="cursor-grab active:cursor-grabbing transition-transform hover:scale-125"
                        onPointerDown={(e) => handleGraphPointerDown('p1', e)}
                      >
                        <circle cx={p1SvgX} cy={p1SvgY} r="12" fill="#10b981" fillOpacity="0.2" />
                        <circle
                          cx={p1SvgX}
                          cy={p1SvgY}
                          r="6"
                          fill={isLight ? '#059669' : '#34d399'}
                          stroke="white"
                          strokeWidth="2"
                        />
                        <text
                          x={p1SvgX}
                          y={p1SvgY - 10}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="bold"
                          fill={isLight ? '#0f172a' : '#a7f3d0'}
                        >
                          P1
                        </text>
                      </g>

                      {/* Control Handle P2 */}
                      <g
                        className="cursor-grab active:cursor-grabbing transition-transform hover:scale-125"
                        onPointerDown={(e) => handleGraphPointerDown('p2', e)}
                      >
                        <circle cx={p2SvgX} cy={p2SvgY} r="12" fill="#10b981" fillOpacity="0.2" />
                        <circle
                          cx={p2SvgX}
                          cy={p2SvgY}
                          r="6"
                          fill={isLight ? '#059669' : '#34d399'}
                          stroke="white"
                          strokeWidth="2"
                        />
                        <text
                          x={p2SvgX}
                          y={p2SvgY - 10}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="bold"
                          fill={isLight ? '#0f172a' : '#a7f3d0'}
                        >
                          P2
                        </text>
                      </g>

                      {/* Realtime Live Pressure Indicator (sliding bead on curve) */}
                      {livePressure > 0 && (
                        <g>
                          <circle cx={liveSvgX} cy={liveSvgY} r="8" fill="#f59e0b" fillOpacity="0.3">
                            <animate attributeName="r" values="6;11;6" dur="1s" repeatCount="indefinite" />
                          </circle>
                          <circle cx={liveSvgX} cy={liveSvgY} r="4" fill="#f59e0b" stroke="white" strokeWidth="1.5" />
                        </g>
                      )}

                      {/* Axis Labels */}
                      <text
                        x={graphMargin + graphW / 2}
                        y={graphMargin + graphH + 24}
                        textAnchor="middle"
                        fontSize="9.5"
                        fontWeight="bold"
                        fill={isLight ? '#64748b' : '#6ee7b7'}
                      >
                        ペンの入力筆圧 (0% → 100%)
                      </text>
                      <text
                        x={-graphMargin - graphH / 2}
                        y={10}
                        transform="rotate(-90)"
                        textAnchor="middle"
                        fontSize="9.5"
                        fontWeight="bold"
                        fill={isLight ? '#64748b' : '#6ee7b7'}
                      >
                        反映される太さ (0% → 100%)
                      </text>
                    </svg>
                  </div>

                  <p className="text-[11px] text-center opacity-70 mt-1">
                    丸いハンドル（P1 / P2）をドラッグして、筆圧カーブを微調整できます。
                  </p>
                </div>

                {/* Right: Live Test Scratchpad */}
                <div
                  className={`p-4 rounded-2xl border flex flex-col justify-between ${
                    isLight ? 'bg-white border-stone-200 shadow-xs' : 'bg-[#16201a] border-[#25362b] shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1.5">
                      <Paintbrush className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        リアルタイム試し書きパッド
                      </span>
                    </div>
                    <button
                      onClick={handleClearScratchpad}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold flex items-center space-x-1 transition-all active:scale-95 ${
                        isLight
                          ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                          : 'bg-[#202e24] hover:bg-[#283b2e] text-emerald-200 border-[#2f4535]'
                      }`}
                      title="試し書きを全消去"
                    >
                      <Eraser className="w-3 h-3" />
                      <span>クリア</span>
                    </button>
                  </div>

                  {/* Canvas Container */}
                  <div
                    className={`relative rounded-xl border overflow-hidden flex-1 min-h-[170px] ${
                      isLight ? 'bg-stone-50/80 border-stone-200' : 'bg-[#0f1612] border-[#223326]'
                    }`}
                  >
                    <canvas
                      ref={scratchpadCanvasRef}
                      width={480}
                      height={260}
                      className="w-full h-full cursor-crosshair touch-none"
                      onPointerDown={handleScratchpadPointerDown}
                      onPointerMove={handleScratchpadPointerMove}
                      onPointerUp={handleScratchpadPointerUp}
                    />

                    {/* HUD: Realtime Pressure Gauge */}
                    <div
                      className={`absolute bottom-2 left-2 right-2 p-2 rounded-lg border text-[10.5px] font-mono flex items-center justify-between gap-2 backdrop-blur-xs ${
                        isLight
                          ? 'bg-white/90 border-stone-200 text-stone-800'
                          : 'bg-[#141d17]/90 border-[#263a2c] text-emerald-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        <span className="shrink-0 font-bold">入力: {Math.round(livePressure * 100)}%</span>
                        <div className="flex-1 h-2 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                          <div
                            className="h-full bg-amber-500 transition-all duration-75"
                            style={{ width: `${Math.round(livePressure * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-1">
                        <span className="shrink-0 font-bold">反映: {Math.round(liveEvaluatedY * 100)}%</span>
                        <div className="flex-1 h-2 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-75"
                            style={{ width: `${Math.round(liveEvaluatedY * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Tool Parameters Info */}
                  <div className="mt-2.5 flex flex-wrap items-center justify-between text-[11px] opacity-75">
                    <span>
                      ペン種: <b>{BRUSH_STYLE_NAMES[currentParams.brushStyle]}</b> ({currentParams.brushWidth}px)
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className={`w-2 h-2 rounded-full ${isStylusInput ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} />
                      <span>{isStylusInput ? 'Apple Pencil / 筆圧感知' : 'タッチ / マウス'}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Threshold Adjustments (Deadzones & Saturation) */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                  isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18231c] border-[#25362b]'
                }`}
              >
                <div className="flex-1 w-full space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>始動筆圧デッドゾーン (弱タッチの遊び)</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {Math.round((curveConfig.minThreshold ?? 0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.25"
                    step="0.01"
                    value={curveConfig.minThreshold ?? 0}
                    onChange={(e) => {
                      updateCurve({
                        ...curveConfig,
                        minThreshold: parseFloat(e.target.value),
                        presetId: 'custom',
                      });
                    }}
                    className="w-full accent-emerald-500 h-1.5 cursor-pointer"
                  />
                  <span className="text-[10.5px] opacity-60">
                    画面にペン先が触れた瞬間の極小圧を無視し、意図したストロークのみ描画開始
                  </span>
                </div>

                <div className="flex-1 w-full space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>最大太さ到達ポイント (飽和筆圧)</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {Math.round((curveConfig.maxThreshold ?? 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.70"
                    max="1.0"
                    step="0.01"
                    value={curveConfig.maxThreshold ?? 1}
                    onChange={(e) => {
                      updateCurve({
                        ...curveConfig,
                        maxThreshold: parseFloat(e.target.value),
                        presetId: 'custom',
                      });
                    }}
                    className="w-full accent-emerald-500 h-1.5 cursor-pointer"
                  />
                  <span className="text-[10.5px] opacity-60">
                    力を込めすぎなくても最大太さ100%に到達（手首の疲労軽減）
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Presets Management Tab */
            <div className="space-y-4">
              {/* Active Settings Snapshot Bar */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isLight
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-[#18261e] border-[#23382c] text-emerald-100'
                }`}
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-400">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>現在のキャンバス描き味設定</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-bold">
                      {BRUSH_STYLE_NAMES[currentParams.brushStyle] || currentParams.brushStyle}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/20 dark:bg-emerald-500/20 border border-emerald-500/30">
                      太さ: {currentParams.brushWidth}px
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/20 dark:bg-emerald-500/20 border border-emerald-500/30">
                      筆圧: {currentParams.pressureSensitivity === 'off' ? 'OFF' : `感度:${currentParams.pressureSensitivity}`}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/20 dark:bg-emerald-500/20 border border-emerald-500/30">
                      カーブ: {curveConfig.presetId ? CURVE_PRESET_LABELS[curveConfig.presetId]?.name.split(' ')[0] || 'カスタム' : 'カスタム'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/20 dark:bg-emerald-500/20 border border-emerald-500/30">
                      補正: {currentParams.autoSmoothBrush ? `強さ:${currentParams.smoothStrength}` : 'OFF'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setIsAdding(!isAdding)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-xs active:scale-95 shrink-0 ${
                    isLight
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>この書き味を保存</span>
                </button>
              </div>

              {/* New Preset Creation Form */}
              {isAdding && (
                <form
                  onSubmit={handleCreatePreset}
                  className={`p-4 rounded-xl border space-y-3 animate-fadeIn ${
                    isLight ? 'bg-stone-50 border-stone-300' : 'bg-[#18231c] border-[#273d2f]'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <span>新プリセットの作成 (現在の筆圧カーブを含む)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      placeholder="プリセット名 (例: 和風習字ペン・ソフト筆圧)"
                      className={`flex-1 px-3 py-2 text-xs rounded-xl border outline-none font-bold ${
                        isLight
                          ? 'bg-white border-stone-300 text-stone-800 focus:border-emerald-600'
                          : 'bg-[#121a15] border-[#25362b] text-white focus:border-emerald-400'
                      }`}
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-xs active:scale-95 shrink-0"
                    >
                      保存する
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                        isLight ? 'bg-stone-200 text-stone-700' : 'bg-[#223025] text-stone-300'
                      }`}
                    >
                      キャンセル
                    </button>
                  </div>
                </form>
              )}

              {/* Presets Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-500 dark:text-emerald-400/80 px-1">
                  <span>保存済み書き味プリセット</span>
                  <button
                    onClick={handleResetDefaults}
                    className="hover:underline flex items-center space-x-1 text-[11px] opacity-70 hover:opacity-100"
                    title="プリセット一覧を初期に戻す"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>初期状態に戻す</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {presets.map((p) => {
                    const isActive = isCurrentActive(p);
                    const presetCurveId = p.pressureCurve?.presetId || 'soft';
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          onApplyPreset(p);
                          if (p.pressureCurve) {
                            setCurveConfig(p.pressureCurve);
                            if (onChangePressureCurve) {
                              onChangePressureCurve(p.pressureCurve);
                            }
                          }
                          showToast(`「${p.name}」を適用しました`);
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative group flex flex-col justify-between ${
                          isActive
                            ? isLight
                              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/30'
                              : 'bg-[#1c2e23] border-emerald-500 ring-2 ring-emerald-500/30'
                            : isLight
                            ? 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800 shadow-xs'
                            : 'bg-[#16201a] hover:bg-[#1b2820] border-[#24352a] text-emerald-100 shadow-xs'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-extrabold line-clamp-1">{p.name}</span>
                              {p.isCustom && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold shrink-0">
                                  ユーザー
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1 shrink-0">
                              {isActive && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white flex items-center space-x-1">
                                  <Check className="w-3 h-3" />
                                  <span>使用中</span>
                                </span>
                              )}
                              {p.isCustom && (
                                <button
                                  onClick={(e) => handleDeletePreset(p.id, e)}
                                  className="p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-red-500/20 hover:text-red-500 transition-all"
                                  title="削除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Attribute Pills */}
                          <div className="flex flex-wrap items-center gap-1 text-[10.5px]">
                            <span
                              className={`px-2 py-0.5 rounded font-bold ${
                                isLight ? 'bg-stone-100 text-stone-700' : 'bg-[#1f2d24] text-emerald-300'
                              }`}
                            >
                              ペン: {BRUSH_STYLE_NAMES[p.brushStyle] || p.brushStyle}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-mono ${
                                isLight ? 'bg-stone-100 text-stone-600' : 'bg-[#1b261f] text-emerald-400'
                              }`}
                            >
                              太さ: {p.brushWidth}px
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded ${
                                p.pressureSensitivity !== 'off'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
                                  : 'bg-stone-200/50 dark:bg-stone-800 text-stone-500'
                              }`}
                            >
                              筆圧: {p.pressureSensitivity === 'off' ? 'OFF' : p.pressureSensitivity}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded ${
                                p.pressureCurve
                                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold'
                                  : 'bg-stone-200/50 dark:bg-stone-800 text-stone-500'
                              }`}
                            >
                              カーブ: {CURVE_PRESET_LABELS[presetCurveId]?.name.split(' ')[0] || '標準'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded ${
                                p.autoSmoothBrush
                                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold'
                                  : 'bg-stone-200/50 dark:bg-stone-800 text-stone-500'
                              }`}
                            >
                              補正: {p.autoSmoothBrush ? p.smoothStrength : 'OFF'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-stone-200/60 dark:border-[#223025] flex items-center justify-between text-[11px] opacity-70">
                          <span>クリックでこの書き味を適用</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">
                            適用 →
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-between shrink-0 ${
            isLight ? 'border-stone-200 bg-stone-50' : 'border-[#223025] bg-[#111814]'
          }`}
        >
          <div className="flex items-center space-x-2 text-xs opacity-75">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>筆圧カーブとプリセットはブラウザ（localStorage）に自動保存されます</span>
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              isLight
                ? 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                : 'bg-[#223025] hover:bg-[#2b3d2f] text-emerald-200'
            }`}
          >
            完了して閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
