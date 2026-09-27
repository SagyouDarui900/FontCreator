import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer,
  PenTool,
  Paintbrush,
  Eraser,
  Ruler,
  Square,
  Circle,
  Triangle,
  Star,
  Heart,
  Sparkles,
  Diamond,
  Hexagon,
  Hand,
  Grid,
  Magnet,
  Eye,
  Move,
  Layers,
  Feather,
  PenLine,
  Highlighter,
  Pencil,
  CircleDot,
  Spline,
  Crosshair,
  X,
  Minus,
  Disc,
  Moon,
  Slash,
  Pen,
  Droplet,
  Smile,
  Bookmark,
  SquareDot,
  Save,
  Plus,
} from 'lucide-react';
import { ToolMode, GridSettings, BrushStyle } from '../types';
import { ThemeMode, isLightTheme, getThemeClasses } from '../utils/theme';
import { PEN_PRESETS } from '../utils/pathUtils';

interface ToolBarProps {
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
  brushWidth: number;
  setBrushWidth: (width: number) => void;
  brushStyle?: BrushStyle;
  setBrushStyle?: (style: BrushStyle) => void;
  pressureSensitivity?: 'high' | 'normal' | 'low' | 'off';
  onChangePressureSensitivity?: (val: 'high' | 'normal' | 'low' | 'off') => void;
  smoothingIntensity?: number;
  onChangeSmoothingIntensity?: (val: number) => void;
  gridSettings: GridSettings;
  setGridSettings: React.Dispatch<React.SetStateAction<GridSettings>>;
  onOpenTraceModal?: () => void;
  onOpenPenPresetsModal?: () => void;
  onOpenPixelStudio?: () => void;
  onQuickSaveGlyph?: () => void;
  theme: ThemeMode;
}

const PEN_ICONS: Record<BrushStyle, React.FC<{ className?: string }>> = {
  signpen: Pen,
  sumi: Droplet,
  marumoji: Smile,
  brush: Paintbrush,
  fountain: Feather,
  mincho_nib: Feather,
  reisho_chisel: PenTool,
  g_pen: PenTool,
  pixel_dot: Square,
  marker: CircleDot,
  ballpoint: PenLine,
  chalk: Sparkles,
  calligraphy: PenTool,
  highlighter: Highlighter,
  pencil: Pencil,
  sharp: Square,
  sharp_round: SquareDot,
  wobbly: Spline,
  polygon: Hexagon,
};

const PillIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="7" width="18" height="10" rx="5" ry="5" />
  </svg>
);

const SHAPE_TOOLS: { id: ToolMode; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'rect', label: '長方形 (Rectangle)', icon: Square },
  { id: 'square', label: '正方形 (Square)', icon: Square },
  { id: 'ellipse', label: '楕円 (Ellipse)', icon: Circle },
  { id: 'circle', label: '正円 (Circle)', icon: Circle },
  { id: 'rounded_rect', label: '角丸四角形 (Rounded)', icon: Square },
  { id: 'pill', label: 'カプセル (Capsule/Pill)', icon: PillIcon },
  { id: 'triangle', label: '正三角形 (Triangle)', icon: Triangle },
  { id: 'triangle_down', label: '逆三角形 (Inverted)', icon: Triangle },
  { id: 'right_triangle', label: '直角三角形 (Right Triangle)', icon: Triangle },
  { id: 'semicircle', label: '半円 (Semicircle)', icon: Circle },
  { id: 'ring', label: 'ドーナツ・二重円 (Ring)', icon: Disc },
  { id: 'parallelogram', label: '平行四辺形 (Parallelogram)', icon: Slash },
  { id: 'diamond', label: '菱形 (Diamond)', icon: Diamond },
  { id: 'polygon', label: '正六角形 (Hexagon)', icon: Hexagon },
  { id: 'line', label: '直線バー (Line)', icon: Minus },
  { id: 'star', label: '星型 (5芒星)', icon: Star },
  { id: 'sparkle', label: '4芒星 (Sparkle)', icon: Sparkles },
  { id: 'starburst', label: '8芒星 (Starburst)', icon: Sparkles },
  { id: 'heart', label: 'ハート (Heart)', icon: Heart },
  { id: 'crescent', label: '三日月 (Crescent)', icon: Moon },
];

export const ToolBar: React.FC<ToolBarProps> = React.memo(({
  toolMode,
  setToolMode,
  brushWidth,
  setBrushWidth,
  brushStyle = 'brush',
  setBrushStyle,
  pressureSensitivity = 'normal',
  onChangePressureSensitivity,
  smoothingIntensity = 50,
  onChangeSmoothingIntensity,
  gridSettings,
  setGridSettings,
  onOpenTraceModal,
  onOpenPenPresetsModal,
  onOpenPixelStudio,
  onQuickSaveGlyph,
  theme,
}) => {
  const isLight = isLightTheme(theme);
  const themeClasses = getThemeClasses(theme);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showBrushMenu, setShowBrushMenu] = useState(false);
  const [showGridMenu, setShowGridMenu] = useState(false);
  const [brushAnchorTop, setBrushAnchorTop] = useState(100);
  const [shapeAnchorTop, setShapeAnchorTop] = useState(140);
  const [gridAnchorTop, setGridAnchorTop] = useState(300);
  const [isSmScreen, setIsSmScreen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 640 : true
  );
  const shapeMenuRef = useRef<HTMLDivElement>(null);
  const brushMenuRef = useRef<HTMLDivElement>(null);
  const gridMenuRef = useRef<HTMLDivElement>(null);
  const mobileBrushSheetRef = useRef<HTMLDivElement>(null);
  const mobileShapeSheetRef = useRef<HTMLDivElement>(null);
  const mobileGridSheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsSmScreen(window.innerWidth >= 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        shapeMenuRef.current &&
        !shapeMenuRef.current.contains(target) &&
        (!mobileShapeSheetRef.current || !mobileShapeSheetRef.current.contains(target))
      ) {
        setShowShapeMenu(false);
      }
      if (
        brushMenuRef.current &&
        !brushMenuRef.current.contains(target) &&
        (!mobileBrushSheetRef.current || !mobileBrushSheetRef.current.contains(target))
      ) {
        setShowBrushMenu(false);
      }
      if (
        gridMenuRef.current &&
        !gridMenuRef.current.contains(target) &&
        (!mobileGridSheetRef.current || !mobileGridSheetRef.current.contains(target))
      ) {
        setShowGridMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const isCurrentToolShape = SHAPE_TOOLS.some((s) => s.id === toolMode);
  const [lastSelectedShape, setLastSelectedShape] = useState<ToolMode>(() => {
    if (SHAPE_TOOLS.some((s) => s.id === toolMode)) return toolMode;
    return 'circle';
  });

  useEffect(() => {
    if (SHAPE_TOOLS.some((s) => s.id === toolMode)) {
      setLastSelectedShape(toolMode);
    }
  }, [toolMode]);

  const activeShapeMode = isCurrentToolShape ? toolMode : lastSelectedShape;
  const currentShapeTool = SHAPE_TOOLS.find((s) => s.id === activeShapeMode) || SHAPE_TOOLS[0];
  const CurrentShapeIcon = currentShapeTool.icon;

  const currentPenPreset = PEN_PRESETS.find((p) => p.id === brushStyle) || PEN_PRESETS[0];
  const CurrentPenIcon = PEN_ICONS[brushStyle] || Paintbrush;

  return (
    <div
      className={`flex sm:flex-col items-center justify-around sm:justify-start gap-1 sm:gap-1.5 px-1.5 sm:px-1.5 py-1.5 sm:py-2 border-t sm:border-t-0 sm:border-r shrink-0 z-20 select-none transition-colors w-full sm:w-13 md:w-14 sm:max-h-full sm:h-full pb-[max(env(safe-area-inset-bottom,0px),8px)] sm:pb-2 ${themeClasses.toolbarBg}`}
    >
      {/* Mobile Backdrop for Popups */}
      {(showBrushMenu || showShapeMenu || showGridMenu) && !isSmScreen && (
        <div
          className="fixed inset-0 z-40 sm:hidden bg-black/40 backdrop-blur-2xs"
          onClick={() => {
            setShowBrushMenu(false);
            setShowShapeMenu(false);
            setShowGridMenu(false);
          }}
        />
      )}

      {/* Primary Tools */}
      <div className="flex sm:flex-col items-center justify-around sm:justify-start gap-1 sm:gap-1.5 shrink-0 w-full sm:w-auto">
        {/* Select Tool (Object & Contour Transform) */}
        <button
          onClick={() => setToolMode('select')}
          className={`group p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center relative ${
            toolMode === 'select'
              ? themeClasses.activeTool
              : themeClasses.activeToolHover
          }`}
          title="選択・全体移動・変形 (V)"
        >
          <MousePointer className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110" />
          <span className="hidden sm:block absolute bottom-0.5 right-1 text-[7.5px] font-mono font-bold opacity-60">V</span>
        </button>

        {/* Node / Direct Selection Tool (Path vertex & handle editor) */}
        <button
          onClick={() => setToolMode('node')}
          className={`group p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center relative ${
            toolMode === 'node'
              ? themeClasses.activeTool
              : themeClasses.activeToolHover
          }`}
          title="パス・頂点編集ツール (A) - アンカーポイントとベジェ曲線の直接編集"
        >
          <Crosshair className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110" />
          <span className="hidden sm:block absolute bottom-0.5 right-1 text-[7.5px] font-mono font-bold opacity-60">A</span>
        </button>

        {/* Pen Tool (Bezier) */}
        <button
          onClick={() => setToolMode('pen')}
          className={`group p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center relative ${
            toolMode === 'pen'
              ? themeClasses.activeTool
              : themeClasses.activeToolHover
          }`}
          title="ベジェ曲線ペン・パス作成 (P)"
        >
          <PenTool className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110" />
          <span className="hidden sm:block absolute bottom-0.5 right-1 text-[7.5px] font-mono font-bold opacity-60">P</span>
        </button>

        {/* Brush Multi-Tool with Full Pen Types Palette */}
        <div className="relative" ref={brushMenuRef}>
          <button
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setBrushAnchorTop(Math.max(50, Math.min(window.innerHeight - 560, rect.top)));
              setShowShapeMenu(false);
              setShowGridMenu(false);
              if (toolMode === 'brush') {
                setShowBrushMenu(!showBrushMenu);
              } else {
                setToolMode('brush');
                setShowBrushMenu(true);
              }
            }}
            className={`group p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center relative ${
              toolMode === 'brush' || showBrushMenu
                ? themeClasses.activeTool
                : themeClasses.activeToolHover
            }`}
            title={`手書きペン (${currentPenPreset.name}) (B) - クリックでペンの種類を変更`}
          >
            <CurrentPenIcon className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110" />
            <span className="absolute bottom-0.5 right-1 text-[7px] opacity-70">▾</span>
          </button>

          {/* Pen Style Selection Popout Menu (Desktop & Tablet) */}
          {showBrushMenu && isSmScreen && (
            <div
              style={
                isSmScreen
                  ? {
                      top: `${brushAnchorTop}px`,
                      maxHeight: `calc(100vh - ${brushAnchorTop}px - 24px)`,
                    }
                  : undefined
              }
              className={`fixed inset-x-3 max-w-sm mx-auto sm:inset-x-auto sm:bottom-auto sm:fixed sm:left-14 md:left-16 sm:w-80 z-50 p-2.5 pb-8 rounded-2xl border shadow-2xl backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto ${
                isLight
                  ? 'bg-white/98 border-stone-200 text-stone-800 shadow-emerald-950/10'
                  : 'bg-[#151f19]/98 border-[#25362b] text-emerald-100 shadow-black/60'
              }`}
            >
              <div className="px-2 py-1 text-[11px] font-bold border-b mb-1.5 flex items-center justify-between border-stone-200 dark:border-[#223025]">
                <span className={isLight ? 'text-emerald-800' : 'text-emerald-400'}>手書きペンの種類</span>
                <div className="flex items-center space-x-1.5">
                  {onOpenPenPresetsModal && (
                    <button
                      onClick={() => {
                        setShowBrushMenu(false);
                        onOpenPenPresetsModal();
                      }}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                      title="書き味プリセットの保存・適用"
                    >
                      <Bookmark className="w-3 h-3 fill-current opacity-80" />
                      <span>書き味プリセット</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowBrushMenu(false)}
                    className="p-1 rounded-md hover:bg-stone-200 dark:hover:bg-[#25362b] opacity-70 hover:opacity-100 transition-opacity"
                    title="閉じる"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
                {PEN_PRESETS.map((preset) => {
                  const PIcon = PEN_ICONS[preset.id] || Paintbrush;
                  const isSelected = brushStyle === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setBrushStyle?.(preset.id);
                        if (preset.defaultWidth) {
                          setBrushWidth(preset.defaultWidth);
                        }
                        setToolMode('brush');
                        setShowBrushMenu(false);
                      }}
                      className={`w-full text-left p-2 rounded-xl transition-all flex items-start space-x-2.5 ${
                        isSelected
                          ? isLight
                            ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-300'
                            : 'bg-emerald-950/80 text-emerald-200 font-bold border border-emerald-700'
                          : isLight
                          ? 'hover:bg-stone-100 text-stone-700'
                          : 'hover:bg-[#1d2921] text-emerald-300'
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-lg mt-0.5 ${
                          isSelected
                            ? isLight
                              ? 'bg-emerald-700 text-white'
                              : 'bg-emerald-500 text-stone-950'
                            : isLight
                            ? 'bg-stone-100 text-stone-600'
                            : 'bg-[#1a251e] text-emerald-400'
                        }`}
                      >
                        <PIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{preset.name}</span>
                          <span className="text-[10px] font-mono opacity-70">太さ {preset.defaultWidth}px</span>
                        </div>
                        <p className="text-[10.5px] leading-relaxed opacity-75 mt-0.5 font-normal">
                          {preset.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Dedicated Pixel Font Studio Launcher */}
              {onOpenPixelStudio && (
                <button
                  onClick={() => {
                    setShowBrushMenu(false);
                    onOpenPixelStudio();
                  }}
                  className="w-full mt-1.5 py-1.5 px-2.5 rounded-xl text-xs font-bold bg-stone-900 hover:bg-black text-emerald-300 dark:bg-[#1a2b20] dark:hover:bg-[#203628] dark:text-emerald-300 border border-emerald-500/30 flex items-center justify-center space-x-1.5 transition-all shadow-xs active:scale-95"
                  title="グリッド上でドットを配置し、ピクセルフォントを作字します"
                >
                  <Grid className="w-3.5 h-3.5 text-emerald-300" />
                  <span>ピクセルフォント工房 (専用キャンバス)</span>
                </button>
              )}

              {/* Add Custom Brush / Preset Trigger */}
              {onOpenPenPresetsModal && (
                <button
                  onClick={() => {
                    setShowBrushMenu(false);
                    onOpenPenPresetsModal();
                  }}
                  className="w-full mt-2 py-1.5 px-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center space-x-1.5 transition-all shadow-xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>＋ カスタムブラシを新規追加・編集</span>
                </button>
              )}

              {/* Apple Pencil & Stylus Pressure Sensitivity Settings */}
              <div className="mt-2 pt-2 border-t border-stone-200 dark:border-[#223025] px-1">
                <div className="flex items-center justify-between text-[11px] mb-1.5 font-bold">
                  <span className="flex items-center space-x-1">
                    <span>筆圧感度 (Apple Pencil / ペン)</span>
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    {pressureSensitivity === 'high'
                      ? '高感度 (推奨)'
                      : pressureSensitivity === 'normal'
                      ? '標準'
                      : pressureSensitivity === 'low'
                      ? '弱め'
                      : 'OFF (均一)'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: 'high', label: '高感度', desc: '軽快な強弱' },
                    { id: 'normal', label: '標準', desc: '自然な筆圧' },
                    { id: 'low', label: '弱め', desc: 'しっかりめ' },
                    { id: 'off', label: 'OFF', desc: '太さ均一' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => onChangePressureSensitivity?.(mode.id as any)}
                      className={`py-1 px-1 rounded-lg text-center transition-all ${
                        (pressureSensitivity || 'normal') === mode.id
                          ? isLight
                            ? 'bg-emerald-700 text-white font-bold shadow-xs'
                            : 'bg-emerald-500 text-stone-950 font-bold shadow-xs'
                          : isLight
                          ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                          : 'bg-[#18231c] hover:bg-[#1f2d24] text-emerald-200/80'
                      }`}
                    >
                      <div className="text-[10.5px] font-bold leading-none">{mode.label}</div>
                      <div className="text-[8px] opacity-70 leading-none mt-0.5">{mode.desc}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[9.5px] opacity-70 mt-1.5 leading-relaxed">
                  iPad + Apple Pencilの筆圧・速度・止め払いにリアルタイム連動します。
                </p>
              </div>

              {/* Real-time Hand-jitter & Stroke Smoothing Intensity */}
              <div className="mt-2 pt-2 border-t border-stone-200 dark:border-[#223025] px-1">
                <div className="flex items-center justify-between text-[11px] mb-1 font-bold">
                  <span className="flex items-center space-x-1">
                    <span>手ブレ補正強度 (Smoothing)</span>
                  </span>
                  <span className="text-[10.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {smoothingIntensity === 0
                      ? 'OFF (0%)'
                      : smoothingIntensity <= 25
                      ? `${smoothingIntensity}% (弱め)`
                      : smoothingIntensity <= 60
                      ? `${smoothingIntensity}% (標準)`
                      : smoothingIntensity <= 85
                      ? `${smoothingIntensity}% (強め)`
                      : `${smoothingIntensity}% (最大)`}
                  </span>
                </div>
                <div className="flex items-center space-x-2 my-1">
                  <span className="text-[9px] opacity-60">OFF</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={smoothingIntensity ?? 0}
                    onChange={(e) => onChangeSmoothingIntensity?.(Number(e.target.value))}
                    className="flex-1 accent-emerald-600 dark:accent-emerald-400 cursor-pointer h-1.5 bg-stone-200 dark:bg-[#202d24] rounded-lg"
                  />
                  <span className="text-[9px] opacity-60">100%</span>
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
                      className={`py-1 px-0.5 rounded text-[9.5px] font-bold text-center transition-all ${
                        smoothingIntensity === preset.val
                          ? isLight
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-emerald-500 text-stone-950 shadow-xs'
                          : isLight
                          ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                          : 'bg-[#18231c] hover:bg-[#1f2d24] text-emerald-200/80'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-[9.5px] opacity-70 mt-1.5 leading-relaxed">
                  文字を書く際の細かな手の震えやガタつきをリアルタイムに抑制し、滑らかな筆跡を形成します。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Geometric Shapes Multi-Tool */}
        <div className="relative" ref={shapeMenuRef}>
          <div className="relative flex items-center">
            <button
              id="shape-tool-main-button"
              type="button"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setShapeAnchorTop(Math.max(10, Math.min(window.innerHeight - 380, rect.top - 10)));
                setShowBrushMenu(false);
                setShowGridMenu(false);
                if (isCurrentToolShape) {
                  setShowShapeMenu((prev) => !prev);
                } else {
                  setToolMode(lastSelectedShape);
                  setShowShapeMenu(true);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                setShapeAnchorTop(Math.max(10, Math.min(window.innerHeight - 380, rect.top - 10)));
                setShowBrushMenu(false);
                setShowGridMenu(false);
                setShowShapeMenu(true);
              }}
              className={`p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center relative ${
                isCurrentToolShape || showShapeMenu
                  ? themeClasses.activeTool
                  : themeClasses.activeToolHover
              }`}
              title={`幾何学図形ツール (${currentShapeTool.label}) (U) - クリックまたは▼で全20種類の図形から選択 (右クリックでも開閉可能)`}
            >
              <CurrentShapeIcon className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110" />
            </button>
            {/* Small settings chevron trigger for direct shape picker open */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setShapeAnchorTop(Math.max(10, Math.min(window.innerHeight - 380, rect.top - 10)));
                setShowBrushMenu(false);
                setShowGridMenu(false);
                setShowShapeMenu((prev) => !prev);
              }}
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7.5px] font-bold border transition-colors ${
                showShapeMenu
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : isLight
                  ? 'bg-stone-100 hover:bg-emerald-100 border-stone-300 text-stone-700'
                  : 'bg-stone-800 hover:bg-emerald-900 border-stone-700 text-emerald-300'
              }`}
              title="図形一覧パレットを開く"
            >
              ▾
            </button>
          </div>

          {/* Shape Selection Popout Menu (Desktop & Tablet) */}
          {showShapeMenu && isSmScreen && (
            <div
              style={
                isSmScreen
                  ? {
                      top: `${shapeAnchorTop}px`,
                      maxHeight: `calc(100vh - ${shapeAnchorTop}px - 24px)`,
                    }
                  : undefined
              }
              className={`fixed inset-x-3 max-w-xs mx-auto sm:inset-x-auto sm:bottom-auto sm:fixed sm:left-14 md:left-16 sm:w-72 z-50 p-2.5 pb-8 rounded-2xl border shadow-2xl backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto ${
                isLight
                  ? 'bg-white/98 border-stone-200 text-stone-800 shadow-emerald-950/10'
                  : 'bg-[#151f19]/98 border-[#25362b] text-emerald-100 shadow-black/60'
              }`}
            >
              <div className="px-1 py-0.5 text-[11px] font-bold border-b mb-2 flex items-center justify-between border-stone-200 dark:border-[#223025]">
                <span className={isLight ? 'text-emerald-800' : 'text-emerald-400'}>図形を選択</span>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-normal opacity-60">全20種類</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowShapeMenu(false);
                    }}
                    className="p-1 rounded-md hover:bg-stone-200 dark:hover:bg-[#25362b] opacity-70 hover:opacity-100 transition-opacity"
                    title="閉じる"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Basic & Curved Geometrics */}
              <div className="text-[10px] font-bold text-stone-400 dark:text-emerald-500/80 px-1 mb-1">
                基本・角丸・カプセル (6種類)
              </div>
              <div className="grid grid-cols-2 gap-1 mb-2">
                {SHAPE_TOOLS.slice(0, 6).map((shape) => {
                  const SIcon = shape.icon;
                  const isSelected = toolMode === shape.id;
                  return (
                    <button
                      key={shape.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLastSelectedShape(shape.id);
                        setToolMode(shape.id);
                        setShowShapeMenu(false);
                      }}
                      className={`flex items-center space-x-1.5 p-1.5 rounded-lg text-xs font-medium transition-all ${
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

              {/* Polygons & Lines */}
              <div className="text-[10px] font-bold text-stone-400 dark:text-emerald-500/80 px-1 mb-1">
                多角形・直線・幾何学 (9種類)
              </div>
              <div className="grid grid-cols-2 gap-1 mb-2">
                {SHAPE_TOOLS.slice(6, 15).map((shape) => {
                  const SIcon = shape.icon;
                  const isSelected = toolMode === shape.id;
                  return (
                    <button
                      key={shape.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLastSelectedShape(shape.id);
                        setToolMode(shape.id);
                        setShowShapeMenu(false);
                      }}
                      className={`flex items-center space-x-1.5 p-1.5 rounded-lg text-xs font-medium transition-all ${
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

              {/* Ornaments & Stars */}
              <div className="text-[10px] font-bold text-stone-400 dark:text-emerald-500/80 px-1 mb-1">
                記号・星型・三日月 (5種類)
              </div>
              <div className="grid grid-cols-2 gap-1">
                {SHAPE_TOOLS.slice(15).map((shape) => {
                  const SIcon = shape.icon;
                  const isSelected = toolMode === shape.id;
                  return (
                    <button
                      key={shape.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLastSelectedShape(shape.id);
                        setToolMode(shape.id);
                        setShowShapeMenu(false);
                      }}
                      className={`flex items-center space-x-1.5 p-1.5 rounded-lg text-xs font-medium transition-all ${
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

        {/* Eraser Tool */}
        <button
          onClick={() => setToolMode('eraser')}
          className={`p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center ${
            toolMode === 'eraser'
              ? themeClasses.activeTool
              : themeClasses.activeToolHover
          }`}
          title="消しゴム (E)"
        >
          <Eraser className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Ruler / Straight Line & Measure Tool */}
        <button
          id="btn-toolbar-ruler"
          onClick={() => setToolMode('ruler')}
          className={`p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center relative ${
            toolMode === 'ruler'
              ? themeClasses.activeTool
              : themeClasses.activeToolHover
          }`}
          title="定規・直線作図ツール (R) - ドラッグして直線を引く・距離や角度を計測 (Shiftで水平/垂直固定)"
        >
          <Ruler className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Hand Tool (Desktop only in main toolbar) */}
        <button
          onClick={() => setToolMode('hand')}
          className={`hidden sm:flex p-2 sm:p-2.5 rounded-xl transition-all items-center justify-center relative ${
            toolMode === 'hand'
              ? themeClasses.activeTool
              : themeClasses.activeToolHover
          }`}
          title="手のひら・画面移動 (H) / Spaceドラッグでも移動可能"
        >
          <Hand className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Mobile Unified Grid & Guides Bottom Sheet Trigger */}
        <div className="sm:hidden relative flex items-center">
          <button
            onClick={() => {
              setShowBrushMenu(false);
              setShowShapeMenu(false);
              setShowGridMenu((prev) => !prev);
            }}
            className={`p-2 rounded-xl transition-all flex items-center justify-center relative ${
              gridSettings.showGrid || showGridMenu
                ? isLight
                  ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300'
                  : 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800'
                : themeClasses.activeToolHover
            }`}
            title="方眼・ガイド・下絵・保存メニュー"
          >
            <Grid className="w-4 h-4" />
            <span className="absolute bottom-0.5 right-0.5 text-[6.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {gridSettings.gridSize || 50}
            </span>
          </button>
        </div>
      </div>

      <div
        className={`hidden sm:block w-full h-[1px] my-2 ${
          isLight ? 'bg-stone-200' : 'bg-[#222e25]'
        }`}
      />

      {/* Desktop-only View / Guide Toggles */}
      <div className="hidden sm:flex sm:flex-col items-center gap-1.5 shrink-0">
        {/* Grid Toggle & Settings Menu */}
        <div className="relative flex flex-col items-center" ref={gridMenuRef}>
          <div className="relative flex items-center">
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setGridAnchorTop(Math.max(60, rect.top - 80));
                setGridSettings((s) => ({ ...s, showGrid: !s.showGrid }));
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                setGridAnchorTop(Math.max(60, rect.top - 80));
                setShowGridMenu((prev) => !prev);
              }}
              className={`p-2 rounded-xl transition-colors relative group ${
                gridSettings.showGrid
                  ? isLight
                    ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300 shadow-xs'
                    : 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800'
                  : isLight
                  ? 'text-stone-500 hover:bg-stone-200/80 hover:text-stone-800'
                  : 'text-stone-400 hover:bg-[#1d2720] hover:text-emerald-200'
              }`}
              title={`方眼グリッド表示 (クリックで切替 / 右クリックまたは▼でサイズ調整スライダー開閉: 現在${gridSettings.gridSize || 50}px)`}
            >
              <Grid className="w-4 h-4" />
            </button>
            {/* Small settings chevron trigger */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setGridAnchorTop(Math.max(50, Math.min(window.innerHeight - 380, rect.top - 80)));
                setShowBrushMenu(false);
                setShowShapeMenu(false);
                setShowGridMenu((prev) => !prev);
              }}
              className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold border transition-colors ${
                showGridMenu
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : isLight
                  ? 'bg-stone-100 hover:bg-emerald-100 border-stone-300 text-stone-600'
                  : 'bg-stone-800 hover:bg-emerald-900 border-stone-700 text-emerald-300'
              }`}
              title="グリッドサイズ・スライダー設定を開く"
            >
              ▾
            </button>
          </div>
          {gridSettings.showGrid && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setGridAnchorTop(Math.max(50, Math.min(window.innerHeight - 380, rect.top - 80)));
                setShowBrushMenu(false);
                setShowShapeMenu(false);
                setShowGridMenu((prev) => !prev);
              }}
              className={`cursor-pointer hidden sm:block text-[8px] font-mono font-bold leading-none mt-1 select-none hover:underline ${
                isLight ? 'text-emerald-800' : 'text-emerald-400'
              }`}
              title="クリックしてグリッドサイズを変更"
            >
              {gridSettings.gridSize || 50}px
            </span>
          )}

          {/* Grid Settings Popout Menu with Slider & Presets (Desktop) */}
          {showGridMenu && isSmScreen && (
            <div
              style={
                isSmScreen
                  ? {
                      top: `${gridAnchorTop}px`,
                      maxHeight: `calc(100vh - ${gridAnchorTop}px - 24px)`,
                    }
                  : undefined
              }
              className={`fixed inset-x-3 max-w-xs mx-auto sm:inset-x-auto sm:bottom-auto sm:fixed sm:left-14 md:left-16 sm:w-72 z-50 p-3 pb-6 rounded-2xl border shadow-2xl backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto ${
                isLight
                  ? 'bg-white/98 border-stone-200 text-stone-800 shadow-emerald-950/10'
                  : 'bg-[#151f19]/98 border-[#25362b] text-emerald-100 shadow-black/60'
              }`}
            >
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-stone-200 dark:border-[#223025]">
                <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-700 dark:text-emerald-400">
                  <Grid className="w-3.5 h-3.5" />
                  <span>方眼グリッド設定</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGridMenu(false)}
                  className="p-1 rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Grid ON/OFF and Snap Toggles */}
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                <button
                  type="button"
                  onClick={() => setGridSettings((s) => ({ ...s, showGrid: !s.showGrid }))}
                  className={`p-1.5 rounded-lg border text-xs font-bold flex items-center justify-between transition-colors ${
                    gridSettings.showGrid
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <span>方眼グリッド</span>
                  <span className="text-[10px] font-mono">{gridSettings.showGrid ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGridSettings((s) => ({ ...s, snapToGrid: !s.snapToGrid }))}
                  className={`p-1.5 rounded-lg border text-xs font-bold flex items-center justify-between transition-colors ${
                    gridSettings.snapToGrid
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <span>吸着 (Snap)</span>
                  <span className="text-[10px] font-mono">{gridSettings.snapToGrid ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              {/* Grid Size Adjustment Slider */}
              <div className="space-y-2 p-2 rounded-xl bg-stone-50/80 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 mb-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-stone-700 dark:text-stone-300">
                    グリッドサイズ
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setGridSettings((prev) => {
                          const current = prev.gridSize || 50;
                          const step = current > 100 ? 10 : current <= 20 ? 2 : 5;
                          return { ...prev, gridSize: Math.max(5, current - step) };
                        })
                      }
                      className="w-5 h-5 rounded flex items-center justify-center border border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-800 text-xs font-bold leading-none select-none"
                      title="縮小 (-)"
                    >
                      -
                    </button>
                    <div className="flex items-center bg-white dark:bg-stone-800 rounded px-1.5 py-0.5 border border-stone-300 dark:border-stone-700">
                      <input
                        type="number"
                        min="5"
                        max="250"
                        value={gridSettings.gridSize || 50}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            setGridSettings((prev) => ({
                              ...prev,
                              gridSize: Math.max(5, Math.min(250, val)),
                            }));
                          }
                        }}
                        className="w-8 text-center font-mono font-bold text-emerald-700 dark:text-emerald-300 text-xs bg-transparent focus:outline-hidden"
                      />
                      <span className="text-[9px] font-mono text-stone-500 font-bold">px</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setGridSettings((prev) => {
                          const current = prev.gridSize || 50;
                          const step = current >= 100 ? 10 : current < 20 ? 2 : 5;
                          return { ...prev, gridSize: Math.min(250, current + step) };
                        })
                      }
                      className="w-5 h-5 rounded flex items-center justify-center border border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-800 text-xs font-bold leading-none select-none"
                      title="拡大 (+)"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Range Slider */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[9px] font-mono text-stone-400 font-bold">5</span>
                  <input
                    type="range"
                    min="5"
                    max="200"
                    step="5"
                    value={gridSettings.gridSize || 50}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setGridSettings((prev) => ({
                        ...prev,
                        gridSize: val,
                      }));
                    }}
                    className="flex-1 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-hidden"
                  />
                  <span className="text-[9px] font-mono text-stone-400 font-bold">200</span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center justify-between gap-1 pt-1">
                  {[10, 25, 50, 100, 128].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() =>
                        setGridSettings((prev) => ({
                          ...prev,
                          gridSize: size,
                        }))
                      }
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                        (gridSettings.gridSize || 50) === size
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Keyboard Shortcut Footer */}
              <div className="text-[10px] text-stone-500 dark:text-stone-400 text-center flex items-center justify-center gap-1 pt-1">
                <span>ショートカット:</span>
                <kbd className="px-1 py-0.2 bg-stone-100 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 font-mono font-bold">Alt</kbd>
                <span>+</span>
                <kbd className="px-1 py-0.2 bg-stone-100 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 font-mono font-bold">+/-</kbd>
              </div>
            </div>
          )}
        </div>

        {/* Snap to Grid */}
        <button
          onClick={() => setGridSettings((s) => ({ ...s, snapToGrid: !s.snapToGrid }))}
          className={`p-2 rounded-xl transition-colors ${
            gridSettings.snapToGrid
              ? isLight
                ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300'
                : 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800'
              : isLight
              ? 'text-stone-500 hover:bg-stone-200/80 hover:text-stone-800'
              : 'text-stone-400 hover:bg-[#1d2720] hover:text-emerald-200'
          }`}
          title="グリッドにスナップ（幾何学・デザインフォント作図用）"
        >
          <Magnet className="w-4 h-4" />
        </button>

        {/* Metrics Lines Toggle */}
        <button
          onClick={() => setGridSettings((s) => ({ ...s, showMetrics: !s.showMetrics }))}
          className={`p-2 rounded-xl transition-colors ${
            gridSettings.showMetrics
              ? isLight
                ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300'
                : 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800'
              : isLight
              ? 'text-stone-500 hover:bg-stone-200/80 hover:text-stone-800'
              : 'text-stone-400 hover:bg-[#1d2720] hover:text-emerald-200'
          }`}
          title="メトリクスガイド線（ベースライン等）"
        >
          <Eye className="w-4 h-4" />
        </button>

        {/* Ruler Bars Toggle (Top/Left Rulers) */}
        <button
          onClick={() => setGridSettings((s) => ({ ...s, showRulers: !s.showRulers }))}
          className={`p-2 rounded-xl transition-colors ${
            gridSettings.showRulers !== false
              ? isLight
                ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300'
                : 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800'
              : isLight
              ? 'text-stone-500 hover:bg-stone-200/80 hover:text-stone-800'
              : 'text-stone-400 hover:bg-[#1d2720] hover:text-emerald-200'
          }`}
          title="外枠の目盛定規・ルーラー表示/非表示 (ルーラーからガイド線を引き出せます)"
        >
          <Ruler className="w-4 h-4" />
        </button>

        {/* Cursor Crosshair Reticle Toggle */}
        <button
          onClick={() => setGridSettings((s) => ({ ...s, showCursorCrosshair: !s.showCursorCrosshair }))}
          className={`p-2 rounded-xl transition-colors ${
            gridSettings.showCursorCrosshair
              ? isLight
                ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300'
                : 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800'
              : isLight
              ? 'text-stone-500 hover:bg-stone-200/80 hover:text-stone-800'
              : 'text-stone-400 hover:bg-[#1d2720] hover:text-emerald-200'
          }`}
          title="十字ポインターガイド線"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Actions (Desktop only) */}
      <div className="hidden sm:flex sm:flex-col items-center gap-1 mt-auto">
        {/* Quick Save Current Glyph */}
        {onQuickSaveGlyph && (
          <button
            onClick={onQuickSaveGlyph}
            className={`p-2 rounded-xl transition-all active:scale-90 ${
              isLight
                ? 'text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 border border-transparent hover:border-emerald-300'
                : 'text-emerald-300 hover:bg-[#1a251e] hover:text-emerald-100 border border-transparent hover:border-emerald-800'
            }`}
            title="現在の文字を保存 (即時永続化 & 単体JSONバックアップ書き出し)"
          >
            <Save className="w-4 h-4" />
          </button>
        )}

        {/* Trace Overlay Toggle & Modal Trigger */}
        {onOpenTraceModal && (
          <button
            onClick={onOpenTraceModal}
            className={`p-2 rounded-md transition-colors ${
              isLight
                ? 'text-stone-600 hover:bg-emerald-100'
                : 'text-emerald-300 hover:bg-[#1a251e]'
            }`}
            title="下絵・看板写真トレース設定"
          >
            <Layers className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Mobile Brush Presets Drawer (Bottom Sheet) */}
      {showBrushMenu && !isSmScreen && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end" ref={mobileBrushSheetRef}>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-fadeIn"
            onClick={() => setShowBrushMenu(false)}
          />
          <div
            className={`relative z-10 w-full rounded-t-2xl p-4 pb-[max(env(safe-area-inset-bottom),24px)] border-t shadow-2xl max-h-[75vh] flex flex-col animate-slideUp ${
              isLight
                ? 'bg-white border-[#c8ded3] text-stone-800'
                : 'bg-[#151f19] border-[#25362b] text-emerald-100'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800 mb-2 shrink-0">
              <span className="font-bold text-sm text-emerald-800 dark:text-emerald-300">手書きペンの種類を選択 (全{PEN_PRESETS.length}種類)</span>
              <button
                onClick={() => setShowBrushMenu(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 pb-20">
              {PEN_PRESETS.map((preset) => {
                const PIcon = PEN_ICONS[preset.id] || Paintbrush;
                const isSelected = brushStyle === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setBrushStyle?.(preset.id);
                      if (preset.defaultWidth) {
                        setBrushWidth(preset.defaultWidth);
                      }
                      setToolMode('brush');
                      setShowBrushMenu(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center space-x-3 ${
                      isSelected
                        ? isLight
                          ? 'bg-emerald-100/90 text-emerald-950 font-bold border border-emerald-300'
                          : 'bg-emerald-950/80 text-emerald-200 font-bold border border-emerald-700'
                        : isLight
                        ? 'hover:bg-emerald-50 text-stone-700'
                        : 'hover:bg-[#202d24] text-emerald-300'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected
                          ? isLight
                            ? 'bg-emerald-700 text-white'
                            : 'bg-emerald-500 text-stone-950'
                          : isLight
                          ? 'bg-stone-100 text-stone-600'
                          : 'bg-[#1a251e] text-emerald-400'
                      }`}
                    >
                      <PIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{preset.name}</span>
                        <span className="text-[10px] font-mono opacity-70">太さ {preset.defaultWidth}px</span>
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed line-clamp-2">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Mobile Smoothing Intensity Control */}
            <div className="pt-2.5 mt-2 border-t border-stone-200 dark:border-stone-800 shrink-0">
              <div className="flex items-center justify-between text-xs mb-1 font-bold">
                <span>手ブレ補正強度 (Smoothing)</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
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
                  className="flex-1 accent-emerald-600 dark:accent-emerald-400 cursor-pointer h-2 bg-stone-200 dark:bg-[#202d24] rounded-lg"
                />
                <span className="text-[10px] opacity-60">100%</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 mt-1.5">
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
                    className={`py-1.5 px-1 rounded-lg text-xs font-bold text-center transition-all ${
                      smoothingIntensity === preset.val
                        ? isLight
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-emerald-500 text-stone-950 shadow-xs'
                        : isLight
                        ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                        : 'bg-[#18231c] hover:bg-[#1f2d24] text-emerald-200/80'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Shapes Selection Drawer (Bottom Sheet) */}
      {showShapeMenu && !isSmScreen && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end" ref={mobileShapeSheetRef}>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-fadeIn"
            onClick={() => setShowShapeMenu(false)}
          />
          <div
            className={`relative z-10 w-full rounded-t-3xl p-4 border-t shadow-2xl max-h-[82vh] flex flex-col animate-slideUp pb-[max(env(safe-area-inset-bottom),20px)] ${
              isLight
                ? 'bg-white border-[#c8ded3] text-stone-800'
                : 'bg-[#151f19] border-[#25362b] text-emerald-100'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-stone-200 dark:border-stone-800 mb-2.5 shrink-0">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm text-emerald-800 dark:text-emerald-300">幾何学図形ツールを選択</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold">全20種類</span>
              </div>
              <button
                onClick={() => setShowShapeMenu(false)}
                className="p-1.5 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 bg-stone-100 dark:bg-[#202d24]"
                title="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Shape Grid with Categorized Headers and Bottom Padding (pb-24) */}
            <div className="overflow-y-auto pr-1 flex-1 min-h-0 space-y-4 pb-24">
              {/* Category 1 */}
              <div>
                <div className="text-[11px] font-bold text-stone-500 dark:text-emerald-400/90 mb-1.5 px-1">
                  基本・角丸・カプセル (6種類)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SHAPE_TOOLS.slice(0, 6).map((shape) => {
                    const SIcon = shape.icon;
                    const isSelected = toolMode === shape.id;
                    return (
                      <button
                        key={shape.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLastSelectedShape(shape.id);
                          setToolMode(shape.id);
                          setShowShapeMenu(false);
                        }}
                        className={`flex items-center space-x-2.5 p-3 rounded-xl text-xs font-medium transition-all ${
                          isSelected
                            ? isLight
                              ? 'bg-emerald-800 text-white font-bold shadow-md'
                              : 'bg-emerald-600 text-white font-bold shadow-md'
                            : isLight
                            ? 'bg-stone-50 hover:bg-emerald-100/80 text-stone-800 border border-stone-200/80'
                            : 'bg-[#1a261f] hover:bg-[#223328] text-emerald-100 border border-stone-800'
                        }`}
                      >
                        <SIcon className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate">{shape.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category 2 */}
              <div>
                <div className="text-[11px] font-bold text-stone-500 dark:text-emerald-400/90 mb-1.5 px-1">
                  多角形・直線・幾何学 (9種類)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SHAPE_TOOLS.slice(6, 15).map((shape) => {
                    const SIcon = shape.icon;
                    const isSelected = toolMode === shape.id;
                    return (
                      <button
                        key={shape.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLastSelectedShape(shape.id);
                          setToolMode(shape.id);
                          setShowShapeMenu(false);
                        }}
                        className={`flex items-center space-x-2.5 p-3 rounded-xl text-xs font-medium transition-all ${
                          isSelected
                            ? isLight
                              ? 'bg-emerald-800 text-white font-bold shadow-md'
                              : 'bg-emerald-600 text-white font-bold shadow-md'
                            : isLight
                            ? 'bg-stone-50 hover:bg-emerald-100/80 text-stone-800 border border-stone-200/80'
                            : 'bg-[#1a261f] hover:bg-[#223328] text-emerald-100 border border-stone-800'
                        }`}
                      >
                        <SIcon className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate">{shape.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category 3 */}
              <div>
                <div className="text-[11px] font-bold text-stone-500 dark:text-emerald-400/90 mb-1.5 px-1">
                  記号・星型・三日月 (5種類)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SHAPE_TOOLS.slice(15).map((shape) => {
                    const SIcon = shape.icon;
                    const isSelected = toolMode === shape.id;
                    return (
                      <button
                        key={shape.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLastSelectedShape(shape.id);
                          setToolMode(shape.id);
                          setShowShapeMenu(false);
                        }}
                        className={`flex items-center space-x-2.5 p-3 rounded-xl text-xs font-medium transition-all ${
                          isSelected
                            ? isLight
                              ? 'bg-emerald-800 text-white font-bold shadow-md'
                              : 'bg-emerald-600 text-white font-bold shadow-md'
                            : isLight
                            ? 'bg-stone-50 hover:bg-emerald-100/80 text-stone-800 border border-stone-200/80'
                            : 'bg-[#1a261f] hover:bg-[#223328] text-emerald-100 border border-stone-800'
                        }`}
                      >
                        <SIcon className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate">{shape.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Grid Settings Drawer (Bottom Sheet) */}
      {showGridMenu && !isSmScreen && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end" ref={mobileGridSheetRef}>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-fadeIn"
            onClick={() => setShowGridMenu(false)}
          />
          <div
            className={`relative z-10 w-full rounded-t-3xl p-4 border-t shadow-2xl max-h-[80vh] flex flex-col animate-slideUp pb-[max(env(safe-area-inset-bottom),24px)] ${
              isLight
                ? 'bg-white border-[#c8ded3] text-stone-800'
                : 'bg-[#151f19] border-[#25362b] text-emerald-100'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-stone-200 dark:border-stone-800 mb-3 shrink-0">
              <div className="flex items-center space-x-2">
                <Grid className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-extrabold text-sm text-emerald-800 dark:text-emerald-300">方眼グリッド・ガイド設定</span>
              </div>
              <button
                onClick={() => setShowGridMenu(false)}
                className="p-1.5 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 bg-stone-100 dark:bg-[#202d24]"
                title="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid ON/OFF and Snap Toggles */}
            <div className="grid grid-cols-2 gap-2 mb-3 shrink-0">
              <button
                type="button"
                onClick={() => setGridSettings((s) => ({ ...s, showGrid: !s.showGrid }))}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-colors ${
                  gridSettings.showGrid
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : isLight
                    ? 'bg-stone-50 border-stone-200 text-stone-600'
                    : 'bg-stone-900 border-stone-800 text-stone-400'
                }`}
              >
                <span>方眼グリッド</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/10 dark:bg-white/10">
                  {gridSettings.showGrid ? 'ON' : 'OFF'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setGridSettings((s) => ({ ...s, snapToGrid: !s.snapToGrid }))}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-colors ${
                  gridSettings.snapToGrid
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : isLight
                    ? 'bg-stone-50 border-stone-200 text-stone-600'
                    : 'bg-stone-900 border-stone-800 text-stone-400'
                }`}
              >
                <span>吸着 (Snap)</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/10 dark:bg-white/10">
                  {gridSettings.snapToGrid ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>

            {/* Grid Size Adjustment */}
            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-3 mb-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-stone-700 dark:text-stone-300">
                  グリッドサイズ
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setGridSettings((prev) => {
                        const current = prev.gridSize || 50;
                        const step = current > 100 ? 10 : current <= 20 ? 2 : 5;
                        return { ...prev, gridSize: Math.max(5, current - step) };
                      })
                    }
                    className="w-8 h-8 rounded-lg flex items-center justify-center border border-stone-300 dark:border-stone-700 active:bg-stone-200 dark:active:bg-stone-800 text-base font-bold select-none"
                  >
                    -
                  </button>
                  <div className="flex items-center bg-white dark:bg-stone-800 rounded-lg px-2.5 py-1 border border-stone-300 dark:border-stone-700">
                    <input
                      type="number"
                      min="5"
                      max="250"
                      value={gridSettings.gridSize || 50}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          setGridSettings((prev) => ({
                            ...prev,
                            gridSize: Math.max(5, Math.min(250, val)),
                          }));
                        }
                      }}
                      className="w-12 text-center font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm bg-transparent focus:outline-hidden"
                    />
                    <span className="text-xs font-mono text-stone-500 font-bold">px</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setGridSettings((prev) => {
                        const current = prev.gridSize || 50;
                        const step = current >= 100 ? 10 : current < 20 ? 2 : 5;
                        return { ...prev, gridSize: Math.min(250, current + step) };
                      })
                    }
                    className="w-8 h-8 rounded-lg flex items-center justify-center border border-stone-300 dark:border-stone-700 active:bg-stone-200 dark:active:bg-stone-800 text-base font-bold select-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Range Slider */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs font-mono text-stone-400 font-bold">5</span>
                <input
                  type="range"
                  min="5"
                  max="200"
                  step="5"
                  value={gridSettings.gridSize || 50}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setGridSettings((prev) => ({
                      ...prev,
                      gridSize: val,
                    }));
                  }}
                  className="flex-1 h-2 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-hidden"
                />
                <span className="text-xs font-mono text-stone-400 font-bold">200</span>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {[10, 25, 50, 100, 128].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() =>
                      setGridSettings((prev) => ({
                        ...prev,
                        gridSize: size,
                      }))
                    }
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                      (gridSettings.gridSize || 50) === size
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : isLight
                        ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                        : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>

            {/* Guidelines & Auxiliary Displays */}
            <div className="grid grid-cols-3 gap-1.5 mb-3 shrink-0">
              <button
                type="button"
                onClick={() => setGridSettings((s) => ({ ...s, showMetrics: !s.showMetrics }))}
                className={`p-2.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-colors ${
                  gridSettings.showMetrics
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : isLight
                    ? 'bg-stone-50 border-stone-200 text-stone-600'
                    : 'bg-stone-900 border-stone-800 text-stone-400'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>基準線・枠</span>
              </button>

              <button
                type="button"
                onClick={() => setGridSettings((s) => ({ ...s, showRulers: !s.showRulers }))}
                className={`p-2.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-colors ${
                  gridSettings.showRulers !== false
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : isLight
                    ? 'bg-stone-50 border-stone-200 text-stone-600'
                    : 'bg-stone-900 border-stone-800 text-stone-400'
                }`}
              >
                <Ruler className="w-4 h-4" />
                <span>目盛定規</span>
              </button>

              <button
                type="button"
                onClick={() => setGridSettings((s) => ({ ...s, showCursorCrosshair: !s.showCursorCrosshair }))}
                className={`p-2.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-colors ${
                  gridSettings.showCursorCrosshair
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : isLight
                    ? 'bg-stone-50 border-stone-200 text-stone-600'
                    : 'bg-stone-900 border-stone-800 text-stone-400'
                }`}
              >
                <Crosshair className="w-4 h-4" />
                <span>十字ガイド</span>
              </button>
            </div>

            {/* Quick Actions Footer (Trace & Save) */}
            <div className="grid grid-cols-2 gap-2 shrink-0">
              {onOpenTraceModal && (
                <button
                  type="button"
                  onClick={() => {
                    setShowGridMenu(false);
                    onOpenTraceModal();
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    isLight
                      ? 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300'
                      : 'bg-stone-850 hover:bg-stone-800 text-emerald-200 border-stone-700'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>下絵写真トレース</span>
                </button>
              )}

              {onQuickSaveGlyph && (
                <button
                  type="button"
                  onClick={() => {
                    setShowGridMenu(false);
                    onQuickSaveGlyph();
                  }}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>文字の即時保存</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
