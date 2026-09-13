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
  Pen,
  Droplet,
  Smile,
  Bookmark,
  SquareDot,
} from 'lucide-react';
import { ToolMode, GridSettings, BrushStyle } from '../types';
import { ThemeMode } from '../utils/theme';
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
  gridSettings: GridSettings;
  setGridSettings: React.Dispatch<React.SetStateAction<GridSettings>>;
  onOpenTraceModal?: () => void;
  onOpenPenPresetsModal?: () => void;
  theme: ThemeMode;
}

const PEN_ICONS: Record<BrushStyle, React.FC<{ className?: string }>> = {
  signpen: Pen,
  sumi: Droplet,
  marumoji: Smile,
  brush: Paintbrush,
  fountain: Feather,
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

const SHAPE_TOOLS: { id: ToolMode; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'rect', label: '長方形 (Rectangle)', icon: Square },
  { id: 'square', label: '正方形 (Square)', icon: Square },
  { id: 'ellipse', label: '楕円 (Ellipse)', icon: Circle },
  { id: 'circle', label: '正円 (Circle)', icon: Circle },
  { id: 'rounded_rect', label: '角丸四角形 (Rounded)', icon: Square },
  { id: 'triangle', label: '三角形 (Triangle)', icon: Triangle },
  { id: 'star', label: '星型 (5芒星)', icon: Star },
  { id: 'heart', label: 'ハート (Heart)', icon: Heart },
  { id: 'sparkle', label: '4芒星 (Sparkle)', icon: Sparkles },
  { id: 'starburst', label: '8芒星 (Starburst)', icon: Sparkles },
  { id: 'diamond', label: '菱形 (Diamond)', icon: Diamond },
  { id: 'polygon', label: '正六角形 (Hexagon)', icon: Hexagon },
  { id: 'line', label: '直線バー (Line)', icon: Minus },
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
  gridSettings,
  setGridSettings,
  onOpenTraceModal,
  onOpenPenPresetsModal,
  theme,
}) => {
  const isLight = theme === 'light';
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showBrushMenu, setShowBrushMenu] = useState(false);
  const [brushAnchorTop, setBrushAnchorTop] = useState(100);
  const [shapeAnchorTop, setShapeAnchorTop] = useState(140);
  const [isSmScreen, setIsSmScreen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 640 : true
  );
  const shapeMenuRef = useRef<HTMLDivElement>(null);
  const brushMenuRef = useRef<HTMLDivElement>(null);
  const mobileBrushSheetRef = useRef<HTMLDivElement>(null);
  const mobileShapeSheetRef = useRef<HTMLDivElement>(null);

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      className={`flex sm:flex-col items-center justify-between sm:justify-start gap-1 p-1 sm:p-1.5 border-t sm:border-t-0 sm:border-r shrink-0 z-20 select-none overflow-x-auto sm:overflow-y-auto sm:overflow-x-hidden no-scrollbar transition-colors w-full sm:w-13 md:w-14 sm:max-h-full sm:h-full ${
        isLight
          ? 'bg-stone-50 border-stone-200 text-stone-800 shadow-xs'
          : 'bg-[#121914] border-[#222e25] text-emerald-100 shadow-xs'
      }`}
    >
      {/* Mobile Backdrop for Popups */}
      {(showBrushMenu || showShapeMenu) && (
        <div
          className="fixed inset-0 z-40 sm:hidden bg-black/30 backdrop-blur-2xs"
          onClick={() => {
            setShowBrushMenu(false);
            setShowShapeMenu(false);
          }}
        />
      )}

      {/* Primary Tools */}
      <div className="flex sm:flex-col items-center gap-1.5">
        {/* Select Tool (Object & Contour Transform) */}
        <button
          onClick={() => setToolMode('select')}
          className={`group p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center relative ${
            toolMode === 'select'
              ? isLight
                ? 'bg-emerald-700 text-white shadow-sm font-bold ring-2 ring-emerald-600/30'
                : 'bg-emerald-500 text-stone-950 shadow-sm font-bold ring-2 ring-emerald-400/30'
              : isLight
              ? 'text-stone-700 hover:bg-stone-200/80 hover:text-stone-950'
              : 'text-stone-300 hover:bg-[#1d2720] hover:text-emerald-200'
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
              ? isLight
                ? 'bg-emerald-700 text-white shadow-sm font-bold ring-2 ring-emerald-600/30'
                : 'bg-emerald-500 text-stone-950 shadow-sm font-bold ring-2 ring-emerald-400/30'
              : isLight
              ? 'text-stone-700 hover:bg-stone-200/80 hover:text-stone-950'
              : 'text-stone-300 hover:bg-[#1d2720] hover:text-emerald-200'
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
              ? isLight
                ? 'bg-emerald-700 text-white shadow-sm font-bold ring-2 ring-emerald-600/30'
                : 'bg-emerald-500 text-stone-950 shadow-sm font-bold ring-2 ring-emerald-400/30'
              : isLight
              ? 'text-stone-700 hover:bg-stone-200/80 hover:text-stone-950'
              : 'text-stone-300 hover:bg-[#1d2720] hover:text-emerald-200'
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
              setBrushAnchorTop(Math.max(50, Math.min(window.innerHeight - 440, rect.top)));
              setShowShapeMenu(false);
              if (toolMode === 'brush') {
                setShowBrushMenu(!showBrushMenu);
              } else {
                setToolMode('brush');
                setShowBrushMenu(true);
              }
            }}
            className={`group p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center relative ${
              toolMode === 'brush' || showBrushMenu
                ? isLight
                  ? 'bg-emerald-700 text-white shadow-sm font-bold ring-2 ring-emerald-600/30'
                  : 'bg-emerald-500 text-stone-950 shadow-sm font-bold ring-2 ring-emerald-400/30'
                : isLight
                ? 'text-stone-700 hover:bg-stone-200/80 hover:text-stone-950'
                : 'text-stone-300 hover:bg-[#1d2720] hover:text-emerald-200'
            }`}
            title={`手書きペン (${currentPenPreset.name}) (B) - クリックでペンの種類を変更`}
          >
            <CurrentPenIcon className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110" />
            <span className="absolute bottom-0.5 right-1 text-[7px] opacity-70">▾</span>
          </button>

          {/* Pen Style Selection Popout Menu (Mobile & Desktop) */}
          {showBrushMenu && (
            <div
              style={isSmScreen ? { top: `${brushAnchorTop}px` } : undefined}
              className={`fixed bottom-14 inset-x-3 max-w-sm mx-auto sm:inset-x-auto sm:bottom-auto sm:fixed sm:left-14 md:left-16 sm:w-80 z-50 p-2.5 rounded-2xl border shadow-2xl backdrop-blur-md animate-in fade-in duration-150 max-h-[calc(100vh-120px)] overflow-y-auto ${
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
                        <p className="text-[10.5px] leading-tight opacity-70 mt-0.5 font-normal">
                          {preset.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

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
                <p className="text-[9.5px] opacity-60 mt-1.5 leading-tight">
                  iPad + Apple Pencilの筆圧・速度・止め払いにリアルタイム連動します。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Geometric Shapes Multi-Tool */}
        <div className="relative" ref={shapeMenuRef}>
          <button
            id="shape-tool-main-button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setShapeAnchorTop(Math.max(50, Math.min(window.innerHeight - 440, rect.top)));
              setShowBrushMenu(false);
              if (isCurrentToolShape) {
                setShowShapeMenu((prev) => !prev);
              } else {
                setToolMode(lastSelectedShape);
                setShowShapeMenu(true);
              }
            }}
            className={`p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center relative ${
              isCurrentToolShape || showShapeMenu
                ? isLight
                  ? 'bg-emerald-700 text-white shadow-xs font-bold ring-2 ring-emerald-500/30'
                  : 'bg-emerald-500 text-stone-950 shadow-xs font-bold ring-2 ring-emerald-400/30'
                : isLight
                ? 'text-stone-600 hover:bg-stone-200/80 hover:text-stone-900'
                : 'text-stone-400 hover:bg-[#1d2720] hover:text-emerald-200'
            }`}
            title={`幾何学図形ツール (${currentShapeTool.label}) (U) - クリックで全13種類の図形から選択`}
          >
            <CurrentShapeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="absolute bottom-0.5 right-1 text-[7px] opacity-70">▾</span>
          </button>

          {/* Shape Selection Popout Menu (Mobile & Desktop) */}
          {showShapeMenu && (
            <div
              style={isSmScreen ? { top: `${shapeAnchorTop}px` } : undefined}
              className={`fixed bottom-14 inset-x-3 max-w-xs mx-auto sm:inset-x-auto sm:bottom-auto sm:fixed sm:left-14 md:left-16 sm:w-68 z-50 p-2.5 rounded-2xl border shadow-2xl backdrop-blur-md animate-in fade-in duration-150 max-h-[calc(100vh-120px)] overflow-y-auto ${
                isLight
                  ? 'bg-white/98 border-stone-200 text-stone-800 shadow-emerald-950/10'
                  : 'bg-[#151f19]/98 border-[#25362b] text-emerald-100 shadow-black/60'
              }`}
            >
              <div className="px-1 py-0.5 text-[11px] font-bold border-b mb-2 flex items-center justify-between border-stone-200 dark:border-[#223025]">
                <span className={isLight ? 'text-emerald-800' : 'text-emerald-400'}>図形を選択</span>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-normal opacity-60">全13種類</span>
                  <button
                    onClick={() => setShowShapeMenu(false)}
                    className="p-1 rounded-md hover:bg-stone-200 dark:hover:bg-[#25362b] opacity-70 hover:opacity-100 transition-opacity"
                    title="閉じる"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Basic Geometrics */}
              <div className="text-[10px] font-bold text-stone-400 dark:text-emerald-500/80 px-1 mb-1">
                基本図形
              </div>
              <div className="grid grid-cols-2 gap-1 mb-2">
                {SHAPE_TOOLS.slice(0, 5).map((shape) => {
                  const SIcon = shape.icon;
                  const isSelected = toolMode === shape.id;
                  return (
                    <button
                      key={shape.id}
                      onClick={() => {
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
                直線・多角形
              </div>
              <div className="grid grid-cols-2 gap-1 mb-2">
                {SHAPE_TOOLS.slice(5, 9).map((shape) => {
                  const SIcon = shape.icon;
                  const isSelected = toolMode === shape.id;
                  return (
                    <button
                      key={shape.id}
                      onClick={() => {
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
                記号・装飾
              </div>
              <div className="grid grid-cols-2 gap-1">
                {SHAPE_TOOLS.slice(9).map((shape) => {
                  const SIcon = shape.icon;
                  const isSelected = toolMode === shape.id;
                  return (
                    <button
                      key={shape.id}
                      onClick={() => {
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
              ? isLight
                ? 'bg-emerald-700 text-white shadow-xs font-bold'
                : 'bg-emerald-500 text-stone-950 shadow-xs font-bold'
              : isLight
              ? 'text-stone-600 hover:bg-stone-200/80 hover:text-stone-900'
              : 'text-stone-400 hover:bg-[#1d2720] hover:text-emerald-200'
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
              ? isLight
                ? 'bg-emerald-700 text-white shadow-xs font-bold'
                : 'bg-emerald-500 text-stone-950 shadow-xs font-bold'
              : isLight
              ? 'text-stone-600 hover:bg-stone-200/80 hover:text-stone-900'
              : 'text-stone-400 hover:bg-[#1d2720] hover:text-emerald-200'
          }`}
          title="定規・直線作図ツール (R) - ドラッグして直線を引く・距離や角度を計測 (Shiftで水平/垂直固定)"
        >
          <Ruler className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Trace Adjust Tool */}
        <button
          onClick={() => setToolMode('trace_adjust')}
          className={`p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center ${
            toolMode === 'trace_adjust'
              ? isLight
                ? 'bg-emerald-700 text-white shadow-xs font-bold'
                : 'bg-emerald-500 text-stone-950 shadow-xs font-bold'
              : isLight
              ? 'text-stone-600 hover:bg-stone-200/80 hover:text-stone-900'
              : 'text-stone-400 hover:bg-[#1d2720] hover:text-emerald-200'
          }`}
          title="下絵写真の位置ドラッグ移動"
        >
          <Move className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Hand Tool */}
        <button
          onClick={() => setToolMode('hand')}
          className={`p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center ${
            toolMode === 'hand'
              ? isLight
                ? 'bg-emerald-700 text-white shadow-xs font-bold'
                : 'bg-emerald-500 text-stone-950 shadow-xs font-bold'
              : isLight
              ? 'text-stone-600 hover:bg-stone-200/80 hover:text-stone-900'
              : 'text-stone-400 hover:bg-[#1d2720] hover:text-emerald-200'
          }`}
          title="手のひら・画面移動 (H)"
        >
          <Hand className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      <div
        className={`hidden sm:block w-full h-[1px] my-2 ${
          isLight ? 'bg-stone-200' : 'bg-[#222e25]'
        }`}
      />
      <div
        className={`sm:hidden h-6 w-[1px] mx-1 ${
          isLight ? 'bg-stone-200' : 'bg-[#222e25]'
        }`}
      />

      {/* View / Guide Toggles */}
      <div className="flex sm:flex-col items-center gap-1">
        {/* Grid Toggle */}
        <div className="relative flex flex-col items-center">
          <button
            onClick={() => setGridSettings((s) => ({ ...s, showGrid: !s.showGrid }))}
            className={`p-2 rounded-xl transition-colors ${
              gridSettings.showGrid
                ? isLight
                  ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300 shadow-xs'
                  : 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800'
                : isLight
                ? 'text-stone-500 hover:bg-stone-200/80 hover:text-stone-800'
                : 'text-stone-400 hover:bg-[#1d2720] hover:text-emerald-200'
            }`}
            title={`方眼グリッド表示 (GキーでON/OFF, + / - でサイズ微調整: 現在${gridSettings.gridSize || 50}px)`}
          >
            <Grid className="w-4 h-4" />
          </button>
          {gridSettings.showGrid && (
            <span
              className={`hidden sm:block text-[8px] font-mono font-bold leading-none mt-0.5 select-none ${
                isLight ? 'text-emerald-800' : 'text-emerald-400'
              }`}
              title="現在のグリッドサイズ (+/- で微調整)"
            >
              {gridSettings.gridSize || 50}
            </span>
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

      {/* History Undo / Redo & Trace Quick Triggers */}
      <div className="flex sm:flex-col items-center gap-1 mt-auto">

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
      {showBrushMenu && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end" ref={mobileBrushSheetRef}>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-fadeIn"
            onClick={() => setShowBrushMenu(false)}
          />
          <div
            className={`relative z-10 w-full rounded-t-2xl p-4 border-t shadow-2xl max-h-[75vh] flex flex-col animate-slideUp ${
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
            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
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
                      <p className="text-[10.5px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Shapes Selection Drawer (Bottom Sheet) */}
      {showShapeMenu && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end" ref={mobileShapeSheetRef}>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-fadeIn"
            onClick={() => setShowShapeMenu(false)}
          />
          <div
            className={`relative z-10 w-full rounded-t-2xl p-4 border-t shadow-2xl max-h-[75vh] flex flex-col animate-slideUp ${
              isLight
                ? 'bg-white border-[#c8ded3] text-stone-800'
                : 'bg-[#151f19] border-[#25362b] text-emerald-100'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800 mb-2 shrink-0">
              <span className="font-bold text-sm text-emerald-800 dark:text-emerald-300">幾何学図形ツールを選択 (全13種類)</span>
              <button
                onClick={() => setShowShapeMenu(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 flex-1">
              {SHAPE_TOOLS.map((shape) => {
                const SIcon = shape.icon;
                const isSelected = toolMode === shape.id;
                return (
                  <button
                    key={shape.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setToolMode(shape.id);
                      setShowShapeMenu(false);
                    }}
                    className={`flex items-center space-x-2 p-2.5 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? isLight
                          ? 'bg-emerald-800 text-white font-bold shadow-xs'
                          : 'bg-emerald-600 text-white font-bold shadow-xs'
                        : isLight
                        ? 'bg-stone-50 hover:bg-emerald-100/80 text-stone-700 border border-stone-200'
                        : 'bg-stone-900/60 hover:bg-[#202d24] text-emerald-200 border border-stone-800'
                    }`}
                  >
                    <SIcon className="w-5 h-5 shrink-0" />
                    <span className="truncate">{shape.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
