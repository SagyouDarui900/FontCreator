import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Sliders,
  Grid,
  Eye,
  FileText,
  RotateCw,
  Sparkles,
  Scale,
  BoxSelect,
  Maximize2,
  Minimize2,
  Info,
  CheckCircle2,
  AlertTriangle,
  Columns,
  Rows,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Move,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Edit3,
  Save,
  Lock,
  Unlock,
  ExternalLink,
  Scaling,
  MousePointerClick,
} from 'lucide-react';
import { useRef } from 'react';
import { FontProject, PathContour, Point } from '../types';
import { compileFont, balanceProjectGlyphMargins } from '../utils/fontCompiler';
import { getContoursBoundingBox } from '../utils/pathUtils';
import { ThemeMode, isLightTheme } from '../utils/theme';

interface TestPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: FontProject;
  setProject?: React.Dispatch<React.SetStateAction<FontProject>>;
  onSelectGlyphForEdit?: (unicode: number) => void;
  theme: ThemeMode;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const SAMPLE_PRESETS = [
  {
    name: '【横組】いろは歌 (4行・パングラム)',
    mode: 'horizontal' as const,
    text: 'いろはにほへと　ちりぬるを\nわかよたれそ　つねならむ\nうゐのおくやま　けふこえて\nあさきゆめみし　ゑひもせす',
  },
  {
    name: '【縦組】いろは歌 (ひらがな・パングラム)',
    mode: 'vertical' as const,
    text: 'いろはにほへと\nちりぬるを\nわかよたれそ\nつねならむ\nうゐのおくやま\nけふこえて\nあさきゆめみし\nゑひもせす',
  },
  {
    name: '【横組】五十音・濁音 (4行)',
    mode: 'horizontal' as const,
    text:
      'あいうえお　かきくけこ　さしすせそ\nたちつてと　なにぬねの　はひふへほ\nまみむめも　やゆよ　らりるれろ　わをん\nがぎぐげご　ざじずぜぞ　だぢづでど　ばびぶべぼ',
  },
  {
    name: '【横組】見出しと本文 (全角空白字下げ)',
    mode: 'horizontal' as const,
    text: '草枕（夏目漱石）\n　山路を登りながら、こう考えた。\n　智に働けば角が立つ。情に棹させば流される。意地を通せば窮屈だ。とかくに人の世は住みにくい。\n　住みにくさが高じると、安い所へ引き越したくなる。どこへ越しても住みにくいと悟った時、詩が生れて、画が出来る。',
  },
  {
    name: '【縦組】吾輩は猫である (字下げ・約物)',
    mode: 'vertical' as const,
    text: '　吾輩は猫である。名前はまだ無い。\n　どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。\n　吾輩はここで始めて人間というものを見た。しかもあとで聞くと、それは書生という人間中で一番獰悪な種族であったそうだ。',
  },
  {
    name: '【縦組】銀河鉄道の夜 (会話文・三点リーダー・ダッシュ)',
    mode: 'vertical' as const,
    text: '「カンパネルラ、僕たち一緒にどこまでも行こうねえ。」\n「ああ、どこまでも行こう。――あ、あすこに見えるのが、あの天の川の白鳥の停車場だ。」\n　ジョバンニは、胸がいっぱいになって、窓から顔を出して夜風を吸いました……。',
  },
  {
    name: '【英数】Pan-gram & 記号・計算式',
    mode: 'horizontal' as const,
    text: 'The quick brown fox jumps over the lazy dog. 0123456789\nPACK MY BOX WITH FIVE DOZEN LIQUOR JUGS.\n「こんにちは！」『ありがとう！』（C）2026 ￥1,980 [50% OFF] 100km/h 3.14159±0.05',
  },
];

/**
 * Transforms glyph contours by shifting center dx, dy and scaling around center by scaleX, scaleY ratios.
 */
export function transformGlyphContours(
  contours: PathContour[],
  dx: number,
  dy: number,
  scaleXRatio: number,
  scaleYRatio: number
): PathContour[] {
  if (!contours || contours.length === 0) return contours;
  const bbox = getContoursBoundingBox(contours);
  const cx = bbox.centerX;
  const cy = bbox.centerY;

  const transformPt = (p: Point): Point => {
    const relX = p.x - cx;
    const relY = p.y - cy;
    return {
      x: Math.round(cx + dx + relX * scaleXRatio),
      y: Math.round(cy + dy + relY * scaleYRatio),
    };
  };

  return contours.map((c) => ({
    ...c,
    nodes: c.nodes.map((n) => ({
      ...n,
      ...transformPt({ x: n.x, y: n.y }),
      handleIn: n.handleIn ? transformPt(n.handleIn) : null,
      handleOut: n.handleOut ? transformPt(n.handleOut) : null,
    })),
  }));
}

export const TestPreviewModal: React.FC<TestPreviewModalProps> = ({
  isOpen,
  onClose,
  project,
  setProject,
  onSelectGlyphForEdit,
  theme,
  onShowToast,
}) => {
  const [testText, setTestText] = useState<string>(
    'いろはにほへと　ちりぬるを\nわかよたれそ　つねならむ\nうゐのおくやま　けふこえて\nあさきゆめみし　ゑひもせす'
  );
  const [writingMode, setWritingMode] = useState<'horizontal' | 'vertical'>('horizontal');
  const [fontSize, setFontSize] = useState<number>(36);
  const [lineHeight, setLineHeight] = useState<number>(2.0);
  const [letterSpacing, setLetterSpacing] = useState<number>(0.05); // in em
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const [useTsume, setUseTsume] = useState<boolean>(false); // OpenType palt / proportional
  const [showSpaceMarkers, setShowSpaceMarkers] = useState<boolean>(false); // Highlight 全角/半角空白
  const [showGenkoGrid, setShowGenkoGrid] = useState<boolean>(false); // 原稿用紙マス目
  const [showCharBoxes, setShowCharBoxes] = useState<boolean>(false); // 仮想ボディ枠 (1em)
  const [showNotebookGuides, setShowNotebookGuides] = useState<boolean>(true); // ノート風ガイド罫線 (ベースライン・中心軸・高さ上限下限)
  const [autoBalanceMargins, setAutoBalanceMargins] = useState<boolean>(false); // デフォルト: ガイド枠の手書き位置優先 (1:1描画位置)
  const [fontScaleMultiplier, setFontScaleMultiplier] = useState<number>(1.0); // 1.0x (原寸キャンバス通り) or 1.35x (拡大)
  const [isWaterfall, setIsWaterfall] = useState<boolean>(false);
  const [fontFamilyName, setFontFamilyName] = useState<string>('CustomTestFont');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected character for quick coordinate/scale/aspect adjustment and main editor jump
  const [selectedCharInfo, setSelectedCharInfo] = useState<{
    char: string;
    unicode: number;
    lineIndex: number;
    charIndex: number;
  } | null>(null);
  const [adjustDx, setAdjustDx] = useState<number>(0);
  const [adjustDy, setAdjustDy] = useState<number>(0);
  const [adjustScaleX, setAdjustScaleX] = useState<number>(100);
  const [adjustScaleY, setAdjustScaleY] = useState<number>(100);
  const [isAspectLocked, setIsAspectLocked] = useState<boolean>(true);

  // Floating draggable adjustment panel state
  const [isDocked, setIsDocked] = useState<boolean>(false);
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number }>({ x: 20, y: 24 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialPosX: number; initialPosY: number } | null>(null);

  const handleDragStart = (e: React.PointerEvent) => {
    if (isDocked) return;
    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: floatingPos.x,
      initialPosY: floatingPos.y,
    };
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current || isDocked) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    const nextX = Math.max(8, Math.min(window.innerWidth - 330, dragStartRef.current.initialPosX + dx));
    const nextY = Math.max(8, Math.min(window.innerHeight - 200, dragStartRef.current.initialPosY + dy));

    setFloatingPos({ x: nextX, y: nextY });
  };

  const handleDragEnd = (e: React.PointerEvent) => {
    if (isDragging) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setIsDragging(false);
      dragStartRef.current = null;
    }
  };

  // Hovered glyph info for inspection
  const [hoveredGlyphInfo, setHoveredGlyphInfo] = useState<{
    char: string;
    unicode: number;
    adv: number;
    lsb: number;
    rsb: number;
    diff: number;
  } | null>(null);
  // Layout mode: 'split' (side-by-side with full-height paper, recommended) or 'top' (classic stacked)
  const [layoutMode, setLayoutMode] = useState<'split' | 'top'>('split');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isTopControlsCollapsed, setIsTopControlsCollapsed] = useState<boolean>(false);
  const [showHintBanner, setShowHintBanner] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const isLight = isLightTheme(theme);

  // Handle keyboard shortcuts (Escape to exit fullscreen / close, F for fullscreen, Z for Zen/collapse)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing in input or textarea, don't trigger shortcut
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      if (e.key === 'Escape') {
        if (isFullscreen) {
          e.preventDefault();
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if ((e.key === 'f' || e.key === 'F') && !isInputFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      } else if ((e.key === 'z' || e.key === 'Z') && !isInputFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (layoutMode === 'split') {
          setIsSidebarOpen((prev) => !prev);
        } else {
          setIsTopControlsCollapsed((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, layoutMode, onClose]);

  // Compile font dynamically and create @font-face style rule
  useEffect(() => {
    if (!isOpen) return;

    let activeBlobUrl: string | null = null;
    try {
      const { blobUrl } = compileFont(project, {
        scaleFactor: fontScaleMultiplier,
        balanceSideBearings: autoBalanceMargins,
        mergeOverlaps: true,
        normalizeWinding: true,
      });
      activeBlobUrl = blobUrl;
      const fontName = `CustomTestFont_${Date.now()}`;
      setFontFamilyName(fontName);

      const styleId = 'dynamic-preview-font-face';
      let styleTag = document.getElementById(styleId) as HTMLStyleElement;
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }

      styleTag.textContent = `
        @font-face {
          font-family: '${fontName}';
          src: url('${blobUrl}') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
      `;
      setErrorMsg(null);
    } catch (err) {
      console.error('Error compiling test font:', err);
      setErrorMsg('フォントの生成中にエラーが発生しました。パスの構造を確認してください。');
    }

    return () => {
      if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
      }
    };
  }, [isOpen, project, autoBalanceMargins, fontScaleMultiplier]);

  // Handle batch centering all glyphs in project
  const handleBatchCenterAll = () => {
    if (!setProject) return;
    const { project: updatedProj, modifiedCount } = balanceProjectGlyphMargins(project);
    setProject(updatedProj);
    if (onShowToast) {
      onShowToast(`${modifiedCount} 文字の左右余白を中央に整列しました`, 'success');
    }
  };

  // Helper to get glyph metric info
  const getGlyphMetric = (char: string) => {
    const code = char.charCodeAt(0);
    const g = project.glyphs[code];
    if (!g || !g.contours || g.contours.length === 0) return null;
    const bbox = getContoursBoundingBox(g.contours);
    if (bbox.width <= 0) return null;
    const adv = g.advanceWidth || (code > 255 ? (project.metadata.unitsPerEm || 1000) : 500);
    const lsb = Math.round(bbox.minX);
    const rsb = Math.round(adv - bbox.maxX);
    const diff = lsb - rsb;
    return { char, unicode: code, adv, lsb, rsb, diff };
  };

  // Apply vector transform directly to glyph contour in project
  const handleApplyTransformToGlyph = () => {
    if (!selectedCharInfo || !setProject) return;
    const unicode = selectedCharInfo.unicode;
    const g = project.glyphs[unicode];
    if (!g || !g.contours || g.contours.length === 0) {
      if (onShowToast) onShowToast(`「${selectedCharInfo.char}」の輪郭データが見つかりません`, 'warning');
      return;
    }

    const scaleXMult = adjustScaleX / 100;
    const scaleYMult = adjustScaleY / 100;

    const transformedContours = transformGlyphContours(
      g.contours,
      adjustDx,
      adjustDy,
      scaleXMult,
      scaleYMult
    );

    setProject((prev) => {
      const prevG = prev.glyphs[unicode];
      if (!prevG) return prev;
      return {
        ...prev,
        glyphs: {
          ...prev.glyphs,
          [unicode]: {
            ...prevG,
            contours: transformedContours,
            updatedAt: Date.now(),
          },
        },
      };
    });

    if (onShowToast) {
      onShowToast(`「${selectedCharInfo.char}」のグリフ輪郭（座標・拡大縮小・縦横比）を永続保存しました`, 'success');
    }

    setAdjustDx(0);
    setAdjustDy(0);
    setAdjustScaleX(100);
    setAdjustScaleY(100);
  };

  const handleJumpToMainEditor = () => {
    if (!selectedCharInfo) return;
    if (onSelectGlyphForEdit) {
      onSelectGlyphForEdit(selectedCharInfo.unicode);
    } else if (onClose) {
      onClose();
    }
  };

  // Highlight space tokens, character boxes, and interactive character tokens
  const renderedText = useMemo(() => {
    const lines = testText.split('\n');

    return lines.map((line, lIdx) => {
      const parts = [];

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const code = ch.codePointAt(0) || ch.charCodeAt(0);
        const isSelected =
          selectedCharInfo?.lineIndex === lIdx && selectedCharInfo?.charIndex === i;

        if (ch === '　') {
          // 全角空白 U+3000
          if (showSpaceMarkers || showCharBoxes) {
            parts.push(
              <span
                key={`${lIdx}-${i}-fullspace`}
                className={`inline-block relative ${
                  isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-950 text-amber-300'
                } border border-dashed ${isLight ? 'border-amber-400' : 'border-amber-600'}`}
                style={{ width: '1em', height: '1em', lineHeight: '1em', textAlign: 'center' }}
                title="全角空白 (U+3000)"
              >
                <span className="opacity-40 text-[0.6em] select-none">□</span>
              </span>
            );
          } else {
            parts.push(<span key={`${lIdx}-${i}-fullspace`}>　</span>);
          }
        } else if (ch === ' ') {
          // 半角空白 U+0020
          if (showSpaceMarkers || showCharBoxes) {
            parts.push(
              <span
                key={`${lIdx}-${i}-halfspace`}
                className={`inline-block relative ${
                  isLight ? 'bg-sky-100 text-sky-800' : 'bg-sky-950 text-sky-300'
                } border border-dashed ${isLight ? 'border-sky-400' : 'border-sky-600'}`}
                style={{ width: '0.5em', height: '1em', lineHeight: '1em', textAlign: 'center' }}
                title="半角空白 (U+0020)"
              >
                <span className="opacity-40 text-[0.5em] select-none">␣</span>
              </span>
            );
          } else {
            parts.push(<span key={`${lIdx}-${i}-halfspace`}> </span>);
          }
        } else if (showCharBoxes) {
          // Character Box mode (仮想ボディ枠と中心線の表示 + インタラクティブ選択)
          const metric = getGlyphMetric(ch);
          const hasCustomTransform =
            isSelected &&
            (adjustDx !== 0 || adjustDy !== 0 || adjustScaleX !== 100 || adjustScaleY !== 100);

          parts.push(
            <span
              key={`${lIdx}-${i}-charbox`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCharInfo({
                  char: ch,
                  unicode: code,
                  lineIndex: lIdx,
                  charIndex: i,
                });
                setAdjustDx(0);
                setAdjustDy(0);
                setAdjustScaleX(100);
                setAdjustScaleY(100);
              }}
              onMouseEnter={() => metric && setHoveredGlyphInfo(metric)}
              className={`inline-flex items-center justify-center relative border border-dashed transition-all cursor-pointer select-none ${
                isSelected
                  ? 'ring-2 ring-emerald-500 bg-emerald-500/25 border-emerald-500 font-bold z-10 shadow-md scale-105'
                  : metric && Math.abs(metric.diff) > 25 && !autoBalanceMargins
                  ? 'border-amber-500 bg-amber-500/10 hover:bg-amber-500/25'
                  : isLight
                  ? 'border-emerald-500/40 bg-emerald-50/25 hover:bg-emerald-100/60 hover:border-emerald-500'
                  : 'border-emerald-400/40 bg-emerald-950/25 hover:bg-emerald-900/60 hover:border-emerald-400'
              }`}
              style={{
                width: writingMode === 'vertical' ? undefined : '1em',
                height: '1em',
                lineHeight: '1em',
                textAlign: 'center',
                boxSizing: 'border-box',
                transform: hasCustomTransform
                  ? `translate(${adjustDx * (fontSize / 1000)}px, ${-adjustDy * (fontSize / 1000)}px) scale(${adjustScaleX / 100}, ${adjustScaleY / 100})`
                  : undefined,
                transformOrigin: 'center center',
              }}
              title={
                metric
                  ? `「${ch}」 クリックで簡易変形・メイン編集へジャンプ / 送り幅:${metric.adv} 左余白:${metric.lsb} 右余白:${metric.rsb}`
                  : `「${ch}」 (クリックで簡易移動・変形 / メイン編集へジャンプ)`
              }
            >
              {/* Center vertical crosshair */}
              <span className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-emerald-500/30 pointer-events-none" />
              {ch}
            </span>
          );
        } else {
          // Interactive Character Token mode
          const metric = getGlyphMetric(ch);
          const hasCustomTransform =
            isSelected &&
            (adjustDx !== 0 || adjustDy !== 0 || adjustScaleX !== 100 || adjustScaleY !== 100);

          parts.push(
            <span
              key={`${lIdx}-${i}-${ch}`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCharInfo({
                  char: ch,
                  unicode: code,
                  lineIndex: lIdx,
                  charIndex: i,
                });
                setAdjustDx(0);
                setAdjustDy(0);
                setAdjustScaleX(100);
                setAdjustScaleY(100);
              }}
              onMouseEnter={() => metric && setHoveredGlyphInfo(metric)}
              className={`inline-block relative transition-all cursor-pointer select-none rounded px-0.5 ${
                isSelected
                  ? 'ring-2 ring-emerald-500 bg-emerald-500/25 text-emerald-950 dark:text-emerald-100 font-bold z-10 shadow-md'
                  : 'hover:bg-emerald-500/15 hover:ring-1 hover:ring-emerald-400/80'
              }`}
              style={{
                transform: hasCustomTransform
                  ? `translate(${adjustDx * (fontSize / 1000)}px, ${-adjustDy * (fontSize / 1000)}px) scale(${adjustScaleX / 100}, ${adjustScaleY / 100})`
                  : undefined,
                transformOrigin: 'center center',
              }}
              title={`「${ch}」 (クリックで位置・縦横比変形ツールバー表示 / メイン編集へジャンプ)`}
            >
              {ch}
            </span>
          );
        }
      }

      return (
        <div key={lIdx} className="relative group/line">
          <div className="relative z-10">
            {parts}
            {lIdx < lines.length - 1 ? '\n' : ''}
          </div>
        </div>
      );
    });
  }, [
    testText,
    showSpaceMarkers,
    showCharBoxes,
    showNotebookGuides,
    autoBalanceMargins,
    isLight,
    writingMode,
    project,
    selectedCharInfo,
    adjustDx,
    adjustDy,
    adjustScaleX,
    adjustScaleY,
    fontSize,
  ]);

  const renderSideAdjustPanel = () => {
    if (!selectedCharInfo) return null;

    const panelContent = (
      <>
        {/* Header with Glyph Badge, Title, Grip Handle & Dock/Undock toggle */}
        <div
          onPointerDown={!isDocked ? handleDragStart : undefined}
          onPointerMove={!isDocked ? handleDragMove : undefined}
          onPointerUp={!isDocked ? handleDragEnd : undefined}
          className={`flex items-center justify-between pb-2 mb-2 border-b border-inherit select-none ${
            !isDocked
              ? 'cursor-grab active:cursor-grabbing p-1 -mx-1 rounded-t-xl bg-emerald-500/5 dark:bg-emerald-500/10'
              : ''
          }`}
        >
          <div className="flex items-center space-x-2 min-w-0">
            {!isDocked && (
              <div
                className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 shrink-0"
                title="ドラッグして小窓を移動"
              >
                <GripVertical className="w-4 h-4" />
              </div>
            )}
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold text-base shadow-xs shrink-0">
              {selectedCharInfo.char}
            </span>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center space-x-1.5 truncate">
                <span className="font-bold text-xs sm:text-sm truncate">
                  「{selectedCharInfo.char}」簡易調整
                </span>
              </div>
              <span className="text-[10px] font-mono opacity-70">
                U+{selectedCharInfo.unicode.toString(16).toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={() => setIsDocked((prev) => !prev)}
              className="p-1 rounded-md hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
              title={isDocked ? 'フローティング小窓にする (ドラッグ移動可能)' : '右サイドバーに固定ドックする'}
            >
              {isDocked ? <Maximize2 className="w-3.5 h-3.5" /> : <PanelRightClose className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setSelectedCharInfo(null)}
              className="p-1 rounded-md hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 transition-colors"
              title="調整パネルを閉じる (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Realtime Feedback Notice */}
        <div className="mb-2.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10.5px] text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5 shrink-0">
          <Eye className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>文字を見ながらリアルタイムに調整できます</span>
        </div>

        {/* Adjuster Controls */}
        <div className="space-y-3 text-xs flex-1 overflow-y-auto pr-0.5">
          {/* 1. Coordinate Position Offset (座標位置 X / Y) */}
          <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/30 border-emerald-900/60'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-xs flex items-center space-x-1 text-emerald-900 dark:text-emerald-200">
                <Move className="w-3.5 h-3.5 text-emerald-600" />
                <span>位置 (X:{adjustDx}px, Y:{adjustDy}px)</span>
              </span>
              <button
                onClick={() => { setAdjustDx(0); setAdjustDy(0); }}
                className="text-[10px] px-1.5 py-0.5 rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 font-mono"
                title="位置を0リセット"
              >
                0
              </button>
            </div>

            {/* D-Pad Buttons + Sliders */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-center py-0.5">
                <div className="grid grid-cols-3 gap-1 w-24">
                  <div></div>
                  <button
                    onClick={() => setAdjustDy((prev) => prev + 10)}
                    className="p-1 rounded bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-center font-bold"
                    title="上へ移動 (+10)"
                  >
                    <ArrowUp className="w-3 h-3 mx-auto" />
                  </button>
                  <div></div>
                  <button
                    onClick={() => setAdjustDx((prev) => prev - 10)}
                    className="p-1 rounded bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-center font-bold"
                    title="左へ移動 (-10)"
                  >
                    <ArrowLeft className="w-3 h-3 mx-auto" />
                  </button>
                  <button
                    onClick={() => { setAdjustDx(0); setAdjustDy(0); }}
                    className="p-1 rounded bg-stone-200 dark:bg-stone-700 font-bold text-[10px] text-center"
                    title="原点"
                  >
                    0
                  </button>
                  <button
                    onClick={() => setAdjustDx((prev) => prev + 10)}
                    className="p-1 rounded bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-center font-bold"
                    title="右へ移動 (+10)"
                  >
                    <ArrowRight className="w-3 h-3 mx-auto" />
                  </button>
                  <div></div>
                  <button
                    onClick={() => setAdjustDy((prev) => prev - 10)}
                    className="p-1 rounded bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-center font-bold"
                    title="下へ移動 (-10)"
                  >
                    <ArrowDown className="w-3 h-3 mx-auto" />
                  </button>
                  <div></div>
                </div>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex items-center space-x-2">
                  <span className="w-4 font-mono font-bold">X:</span>
                  <input
                    type="range"
                    min={-150}
                    max={150}
                    value={adjustDx}
                    onChange={(e) => setAdjustDx(Number(e.target.value))}
                    className="flex-1 accent-emerald-600 h-1.5"
                  />
                  <span className="w-8 font-mono text-right">{adjustDx}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-4 font-mono font-bold">Y:</span>
                  <input
                    type="range"
                    min={-150}
                    max={150}
                    value={adjustDy}
                    onChange={(e) => setAdjustDy(Number(e.target.value))}
                    className="flex-1 accent-emerald-600 h-1.5"
                  />
                  <span className="w-8 font-mono text-right">{adjustDy}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Scale & Aspect Ratio (拡縮・縦横比) */}
          <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/30 border-emerald-900/60'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-xs flex items-center space-x-1 text-emerald-900 dark:text-emerald-200">
                <Scaling className="w-3.5 h-3.5 text-emerald-600" />
                <span>拡大縮小 (W:{adjustScaleX}% H:{adjustScaleY}%)</span>
              </span>
              <button
                onClick={() => setIsAspectLocked(!isAspectLocked)}
                className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center space-x-1 transition-colors ${
                  isAspectLocked
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                }`}
                title="縦横比固定切替"
              >
                {isAspectLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                <span>{isAspectLocked ? '固定' : '自由'}</span>
              </button>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center space-x-2">
                <span className="w-4 font-mono font-bold">幅:</span>
                <input
                  type="range"
                  min={40}
                  max={200}
                  value={adjustScaleX}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setAdjustScaleX(val);
                    if (isAspectLocked) setAdjustScaleY(val);
                  }}
                  className="flex-1 accent-emerald-600 h-1.5"
                />
                <span className="w-9 font-mono text-right">{adjustScaleX}%</span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="w-4 font-mono font-bold">高:</span>
                <input
                  type="range"
                  min={40}
                  max={200}
                  value={adjustScaleY}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setAdjustScaleY(val);
                    if (isAspectLocked) setAdjustScaleX(val);
                  }}
                  className="flex-1 accent-emerald-600 h-1.5"
                />
                <span className="w-9 font-mono text-right">{adjustScaleY}%</span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-1">
                  {[90, 95, 100, 105, 110].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setAdjustScaleX(s); setAdjustScaleY(s); }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                        adjustScaleX === s && adjustScaleY === s
                          ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                          : 'border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      {s}%
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setAdjustScaleX(100); setAdjustScaleY(100); }}
                  className="text-[10px] text-stone-500 hover:underline"
                >
                  等倍
                </button>
              </div>
            </div>
          </div>

          {/* Main Canvas Jump Button */}
          {onSelectGlyphForEdit && (
            <button
              onClick={handleJumpToMainEditor}
              className="w-full py-1.5 px-2.5 rounded-lg text-xs font-bold border flex items-center justify-center space-x-1.5 transition-colors border-emerald-600 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
              title="この文字をメインキャンバスで開いて本格パス編集を行います"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>メイン編集でパス直接調整</span>
            </button>
          )}
        </div>

        {/* Bottom Actions: Save & Reset */}
        <div className="pt-2.5 mt-2.5 border-t border-inherit space-y-1.5 shrink-0">
          <button
            onClick={handleApplyTransformToGlyph}
            disabled={adjustDx === 0 && adjustDy === 0 && adjustScaleX === 100 && adjustScaleY === 100}
            className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition-all ${
              adjustDx === 0 && adjustDy === 0 && adjustScaleX === 100 && adjustScaleY === 100
                ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-98'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>グリフ輪郭に永続保存</span>
          </button>

          <button
            onClick={() => {
              setAdjustDx(0);
              setAdjustDy(0);
              setAdjustScaleX(100);
              setAdjustScaleY(100);
            }}
            className="w-full py-1 px-2 rounded-lg text-xs font-medium border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors text-center"
          >
            変更をリセット
          </button>
        </div>
      </>
    );

    if (isDocked) {
      return (
        <aside
          className={`w-72 sm:w-80 border-l shrink-0 flex flex-col h-full overflow-y-auto p-3.5 sm:p-4 transition-all z-20 shadow-xl ${
            isLight
              ? 'bg-white/95 border-stone-200 text-stone-800'
              : 'bg-[#121c15]/95 border-[#233527] text-emerald-100'
          }`}
        >
          {panelContent}
        </aside>
      );
    }

    return (
      <div
        style={{ left: `${floatingPos.x}px`, top: `${floatingPos.y}px` }}
        className={`absolute z-40 w-72 sm:w-80 max-h-[calc(100%-2rem)] rounded-2xl border shadow-2xl backdrop-blur-md flex flex-col p-3.5 sm:p-4 transition-shadow ${
          isDragging ? 'shadow-emerald-950/40 ring-2 ring-emerald-500 cursor-grabbing' : ''
        } ${
          isLight
            ? 'bg-white/95 border-stone-200 text-stone-800 shadow-stone-400/30'
            : 'bg-[#121c15]/95 border-[#233527] text-emerald-100 shadow-black/60'
        }`}
      >
        {panelContent}
      </div>
    );
  };

  if (!isOpen) return null;

  const waterfallSizes = [16, 20, 24, 32, 44, 60, 80];

  return (
    <div
      className={`fixed inset-0 z-50 select-none transition-all ${
        isFullscreen
          ? 'flex flex-col w-screen h-screen p-0 bg-black/90 overflow-hidden'
          : 'flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs'
      }`}
    >
      <div
        className={`w-full flex flex-col transition-all overflow-hidden ${
          isFullscreen
            ? isLight
              ? 'w-screen h-screen rounded-none border-none bg-[#f7faf8] text-stone-800'
              : 'w-screen h-screen rounded-none border-none bg-[#141c16] text-emerald-100'
            : isLight
            ? 'max-w-7xl border border-[#c8ded3] rounded-xl shadow-2xl h-[95vh] max-h-[960px] bg-[#f7faf8] text-stone-800'
            : 'max-w-7xl border border-[#25362b] rounded-xl shadow-2xl h-[95vh] max-h-[960px] bg-[#141c16] text-emerald-100'
        }`}
      >
        {/* Header Bar */}
        <div
          className={`px-3 sm:px-4 py-2 sm:py-2.5 border-b flex items-center justify-between shrink-0 gap-2 ${
            isLight ? 'bg-[#edf5f0] border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <div className="flex items-center space-x-2 min-w-0">
            <Type className="w-5 h-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <h2 className={`font-bold text-sm sm:text-base truncate ${isLight ? 'text-emerald-950' : 'text-emerald-200'}`}>
              組版テスト・試し打ちシミュレーター
            </h2>
            <span
              className={`hidden md:inline-flex text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 ${
                isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950 text-emerald-300'
              }`}
            >
              {Object.keys(project.glyphs || {}).length} グリフ
            </span>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
            {setProject && (
              <button
                onClick={handleBatchCenterAll}
                className={`px-2 py-1 rounded text-xs font-semibold border transition-colors hidden lg:flex items-center space-x-1 ${
                  isLight
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                    : 'bg-amber-950/70 hover:bg-amber-900/70 text-amber-200 border-amber-800 shadow-xs'
                }`}
                title="フォント内の全文字の左右余白を中央に整列してプロジェクトに反映します (※小文字・記号は自動保護)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>全文字中央整列</span>
              </button>
            )}

            {/* Hint toggle */}
            <button
              onClick={() => setShowHintBanner(!showHintBanner)}
              className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors flex items-center space-x-1 ${
                showHintBanner
                  ? isLight
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                    : 'bg-emerald-950 border-emerald-700 text-emerald-300'
                  : isLight
                  ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                  : 'bg-[#1a251e] border-[#25362b] text-stone-300 hover:bg-[#223027]'
              }`}
              title="配置・余白設定のヒントを表示/非表示"
            >
              <Info className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">ヒント</span>
            </button>

            {/* Layout switch: Split (Side-by-Side) vs Top (Stacked) */}
            <div
              className={`flex items-center p-0.5 rounded-md border ${
                isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#101712] border-[#25362b]'
              }`}
            >
              <button
                onClick={() => {
                  setLayoutMode('split');
                  setIsSidebarOpen(true);
                }}
                className={`px-2 py-1 rounded text-xs font-semibold flex items-center space-x-1 transition-all ${
                  layoutMode === 'split'
                    ? isLight
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-emerald-500 text-stone-950 shadow-xs'
                    : isLight
                    ? 'text-stone-600 hover:text-stone-900'
                    : 'text-emerald-400 hover:text-emerald-200'
                }`}
                title="左右分割モード: 左に設定、右に縦フルハイトの広大な文字プレビュー用紙を表示"
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden md:inline">左右分割 (広大)</span>
              </button>
              <button
                onClick={() => setLayoutMode('top')}
                className={`px-2 py-1 rounded text-xs font-semibold flex items-center space-x-1 transition-all ${
                  layoutMode === 'top'
                    ? isLight
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-emerald-500 text-stone-950 shadow-xs'
                    : isLight
                    ? 'text-stone-600 hover:text-stone-900'
                    : 'text-emerald-400 hover:text-emerald-200'
                }`}
                title="上下配置モード: 上にツールバー、下にプレビュー用紙を表示"
              >
                <Rows className="w-3.5 h-3.5" />
                <span className="hidden md:inline">上下配置</span>
              </button>
            </div>

            {/* Sidebar toggle or Top Collapse toggle */}
            {layoutMode === 'split' ? (
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`px-2 py-1 rounded-md border text-xs font-semibold flex items-center space-x-1 transition-all ${
                  !isSidebarOpen
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : isLight
                    ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-50'
                    : 'bg-[#1c2920] border-[#25362b] text-emerald-200 hover:bg-[#25362b]'
                }`}
                title={isSidebarOpen ? '設定パネルを隠して文字プレビューを全幅表示 (ショートカット: Z)' : '設定パネルを表示 (ショートカット: Z)'}
              >
                {isSidebarOpen ? (
                  <>
                    <PanelLeftClose className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">パネル収納</span>
                  </>
                ) : (
                  <>
                    <PanelLeftOpen className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">設定パネル</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => setIsTopControlsCollapsed(!isTopControlsCollapsed)}
                className={`px-2 py-1 rounded-md border text-xs font-semibold flex items-center space-x-1 transition-all ${
                  isTopControlsCollapsed
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : isLight
                    ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-50'
                    : 'bg-[#1c2920] border-[#25362b] text-emerald-200 hover:bg-[#25362b]'
                }`}
                title={isTopControlsCollapsed ? '上部設定バーを展開 (ショートカット: Z)' : '上部バーを最小化してプレビュー領域を縦いっぱいに拡大 (ショートカット: Z)'}
              >
                {isTopControlsCollapsed ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">設定展開</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">文字集中表示</span>
                  </>
                )}
              </button>
            )}

            {/* Fullscreen Toggle Button */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`px-2.5 py-1 rounded-md border text-xs font-semibold flex items-center space-x-1 transition-all ${
                isFullscreen
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : isLight
                  ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-50 hover:text-emerald-900 shadow-2xs'
                  : 'bg-[#1c2920] border-[#25362b] text-emerald-200 hover:bg-[#25362b] shadow-2xs'
              }`}
              title={isFullscreen ? '通常表示に戻す (F / Esc)' : '全画面表示モードに切り替え (ショートカット: F)'}
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
              className="p-1 rounded-md hover:bg-emerald-100 dark:hover:bg-[#25362b] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
              title="閉じる (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Informational Guidance Banner (Optional toggle) */}
        {showHintBanner && (
          <div
            className={`px-3.5 py-2 text-[11px] border-b flex items-center justify-between shrink-0 ${
              isLight
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-emerald-950/60 border-emerald-900 text-emerald-200'
            }`}
          >
            <div className="flex items-start space-x-2 min-w-0 pr-2">
              <Info className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <span className="leading-relaxed break-words">
                <strong>【配置・余白設定のヒント】</strong> ガイド枠に合わせて書いた文字は、<strong>『配置: ガイド描画位置優先』</strong>で手書きした通りの自然な軸・字間になります。文字の偏りを整えたい場合のみ<strong>『左右センタリング補正』</strong>をご利用ください。（※小文字・句読点・括弧はレイアウト崩れを防ぐためセンタリング補正から自動除外されます）
              </span>
            </div>
            <button
              onClick={() => setShowHintBanner(false)}
              className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              title="バナーを閉じる"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* MAIN BODY AREA: Switch between Split (Side-by-Side) and Top (Stacked) */}
        {layoutMode === 'split' ? (
          /* ==================== SPLIT MODE (SIDEBAR + FULL-HEIGHT PREVIEW) ==================== */
          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
            {/* Left Control Sidebar */}
            {isSidebarOpen && (
              <div
                className={`w-full md:w-80 max-h-[38vh] md:max-h-full border-b md:border-b-0 md:border-r flex flex-col shrink-0 min-h-0 overflow-y-auto overscroll-contain ${
                  isLight ? 'bg-[#f7faf8] border-[#d8e6df]' : 'bg-[#131b15] border-[#25362b]'
                }`}
              >
                {/* 1. Text Input & Presets */}
                <div className="p-3 border-b border-inherit">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`text-xs font-bold flex items-center space-x-1 ${isLight ? 'text-emerald-950' : 'text-emerald-200'}`}>
                      <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>テスト文章</span>
                    </label>
                    <span className={`text-[10px] font-mono ${isLight ? 'text-stone-500' : 'text-emerald-500'}`}>
                      {testText.length} 文字
                    </span>
                  </div>

                  {/* Preset Quick Select Dropdown */}
                  <div className="mb-2">
                    <select
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        if (!isNaN(idx) && SAMPLE_PRESETS[idx]) {
                          setTestText(SAMPLE_PRESETS[idx].text);
                          setWritingMode(SAMPLE_PRESETS[idx].mode);
                        }
                      }}
                      value={SAMPLE_PRESETS.findIndex((p) => p.text === testText)}
                      className={`w-full text-[11px] p-1.5 rounded border ${
                        isLight
                          ? 'bg-white border-[#c8ded3] text-stone-700'
                          : 'bg-[#18231c] border-[#2b3d30] text-emerald-200'
                      }`}
                    >
                      <option value={-1}>-- 例文プリセットを選択 --</option>
                      {SAMPLE_PRESETS.map((preset, idx) => (
                        <option key={idx} value={idx}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    rows={4}
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="ここにテストしたい文章を入力..."
                    className={`w-full border rounded-md p-2 text-xs focus:outline-none select-text transition-colors leading-relaxed ${
                      isLight
                        ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                        : 'bg-[#18231c] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                    }`}
                  />
                </div>

                {/* 2. Typesetting Parameters */}
                <div className="p-3 border-b border-inherit flex flex-col space-y-3">
                  <div className={`text-xs font-bold flex items-center space-x-1 ${isLight ? 'text-emerald-950' : 'text-emerald-200'}`}>
                    <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>組版パラメータ</span>
                  </div>

                  {/* Writing Mode (横組み / 縦組み) */}
                  <div>
                    <span className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-stone-600' : 'text-emerald-300'}`}>
                      組方向:
                    </span>
                    <div
                      className={`grid grid-cols-2 p-0.5 rounded-md border ${
                        isLight ? 'bg-[#edf5f0] border-[#c8ded3]' : 'bg-[#101712] border-[#25362b]'
                      }`}
                    >
                      <button
                        onClick={() => setWritingMode('horizontal')}
                        className={`py-1 rounded text-xs font-bold transition-all text-center ${
                          writingMode === 'horizontal'
                            ? isLight
                              ? 'bg-emerald-800 text-white shadow-xs'
                              : 'bg-emerald-500 text-stone-950 shadow-xs'
                            : isLight
                            ? 'text-stone-600 hover:text-stone-900'
                            : 'text-emerald-400 hover:text-emerald-200'
                        }`}
                      >
                        横組み (横書き)
                      </button>
                      <button
                        onClick={() => setWritingMode('vertical')}
                        className={`py-1 rounded text-xs font-bold transition-all text-center ${
                          writingMode === 'vertical'
                            ? isLight
                              ? 'bg-emerald-800 text-white shadow-xs'
                              : 'bg-emerald-500 text-stone-950 shadow-xs'
                            : isLight
                            ? 'text-stone-600 hover:text-stone-900'
                            : 'text-emerald-400 hover:text-emerald-200'
                        }`}
                      >
                        縦組み (縦書き)
                      </button>
                    </div>
                  </div>

                  {/* Font Size */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className={isLight ? 'text-stone-600' : 'text-emerald-400'}>サイズ:</span>
                      <span className={`font-mono font-bold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                        {fontSize} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={14}
                      max={96}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full accent-emerald-700"
                    />
                  </div>

                  {/* Line Height */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className={isLight ? 'text-stone-600' : 'text-emerald-400'}>行送り:</span>
                      <span className={`font-mono font-bold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                        {lineHeight.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1.2}
                      max={3.0}
                      step={0.1}
                      value={lineHeight}
                      onChange={(e) => setLineHeight(Number(e.target.value))}
                      className="w-full accent-emerald-700"
                    />
                  </div>

                  {/* Letter Spacing */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className={isLight ? 'text-stone-600' : 'text-emerald-400'}>字間:</span>
                      <span className={`font-mono font-bold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                        {letterSpacing >= 0 ? `+${letterSpacing.toFixed(2)}` : letterSpacing.toFixed(2)} em
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-0.05}
                      max={0.5}
                      step={0.02}
                      value={letterSpacing}
                      onChange={(e) => setLetterSpacing(Number(e.target.value))}
                      className="w-full accent-emerald-700"
                    />
                  </div>

                  {/* Text Align */}
                  <div>
                    <span className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-stone-600' : 'text-emerald-300'}`}>
                      配置・揃え:
                    </span>
                    <div
                      className={`grid grid-cols-4 p-0.5 rounded border ${
                        isLight ? 'bg-[#edf5f0] border-[#c8ded3]' : 'bg-[#101712] border-[#25362b]'
                      }`}
                    >
                      <button
                        onClick={() => setTextAlign('left')}
                        title="左揃え / 天揃え"
                        className={`p-1.5 rounded flex justify-center ${
                          textAlign === 'left'
                            ? isLight
                              ? 'bg-emerald-800 text-white'
                              : 'bg-emerald-500 text-stone-950 font-bold'
                            : isLight
                            ? 'text-stone-600'
                            : 'text-emerald-400'
                        }`}
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setTextAlign('center')}
                        title="中央揃え"
                        className={`p-1.5 rounded flex justify-center ${
                          textAlign === 'center'
                            ? isLight
                              ? 'bg-emerald-800 text-white'
                              : 'bg-emerald-500 text-stone-950 font-bold'
                            : isLight
                            ? 'text-stone-600'
                            : 'text-emerald-400'
                        }`}
                      >
                        <AlignCenter className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setTextAlign('right')}
                        title="右揃え / 地揃え"
                        className={`p-1.5 rounded flex justify-center ${
                          textAlign === 'right'
                            ? isLight
                              ? 'bg-emerald-800 text-white'
                              : 'bg-emerald-500 text-stone-950 font-bold'
                            : isLight
                            ? 'text-stone-600'
                            : 'text-emerald-400'
                        }`}
                      >
                        <AlignRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setTextAlign('justify')}
                        title="均等割り付け"
                        className={`p-1.5 rounded flex justify-center ${
                          textAlign === 'justify'
                            ? isLight
                              ? 'bg-emerald-800 text-white'
                              : 'bg-emerald-500 text-stone-950 font-bold'
                            : isLight
                            ? 'text-stone-600'
                            : 'text-emerald-400'
                        }`}
                      >
                        <AlignJustify className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Display & Optimization Toggles */}
                <div className="p-3 flex flex-col space-y-2">
                  <div className={`text-xs font-bold flex items-center space-x-1 ${isLight ? 'text-emerald-950' : 'text-emerald-200'}`}>
                    <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>表示・補正オプション</span>
                  </div>

                  {/* Font Scale Optimization */}
                  <button
                    onClick={() => setFontScaleMultiplier(fontScaleMultiplier === 1.35 ? 1.0 : 1.35)}
                    className={`w-full p-1.5 rounded text-[11px] font-semibold border text-left transition-colors flex items-center justify-between ${
                      fontScaleMultiplier === 1.35
                        ? isLight
                          ? 'bg-emerald-100/90 text-emerald-950 border-emerald-300 shadow-2xs'
                          : 'bg-emerald-950 text-emerald-200 border-emerald-700 shadow-2xs'
                        : isLight
                        ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                        : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
                    }`}
                  >
                    <span>和文標準サイズ最適化</span>
                    <span className="font-bold">{fontScaleMultiplier === 1.35 ? '135%' : '100%'}</span>
                  </button>

                  {/* Auto Balance Margins Toggle */}
                  <button
                    onClick={() => setAutoBalanceMargins(!autoBalanceMargins)}
                    className={`w-full p-1.5 rounded text-[11px] font-semibold border text-left transition-colors flex items-center justify-between ${
                      autoBalanceMargins
                        ? isLight
                          ? 'bg-amber-100 text-amber-950 border-amber-300'
                          : 'bg-amber-950 text-amber-200 border-amber-800'
                        : isLight
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                    }`}
                  >
                    <span>配置モード:</span>
                    <span className="font-bold">
                      {autoBalanceMargins ? '左右センタリング' : 'ガイド位置優先 (推奨)'}
                    </span>
                  </button>

                  {/* Char Boxes Toggle */}
                  <button
                    onClick={() => setShowCharBoxes(!showCharBoxes)}
                    className={`w-full p-1.5 rounded text-[11px] font-semibold border text-left transition-colors flex items-center justify-between ${
                      showCharBoxes
                        ? isLight
                          ? 'bg-emerald-800 text-white border-emerald-900'
                          : 'bg-emerald-500 text-stone-950 font-bold border-emerald-400'
                        : isLight
                        ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                        : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
                    }`}
                  >
                    <span>仮想ボディ枠 (1em・中心軸)</span>
                    <span>{showCharBoxes ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Notebook Guide Lines Toggle */}
                  <button
                    onClick={() => setShowNotebookGuides(!showNotebookGuides)}
                    className={`w-full p-1.5 rounded text-[11px] font-semibold border text-left transition-colors flex items-center justify-between ${
                      showNotebookGuides
                        ? isLight
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                          : 'bg-emerald-500 text-stone-950 font-bold border-emerald-400 shadow-2xs'
                        : isLight
                        ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                        : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
                    }`}
                  >
                    <span>ノートガイド (ベースライン・中心軸)</span>
                    <span>{showNotebookGuides ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Space Markers Toggle */}
                  <button
                    onClick={() => setShowSpaceMarkers(!showSpaceMarkers)}
                    className={`w-full p-1.5 rounded text-[11px] font-semibold border text-left transition-colors flex items-center justify-between ${
                      showSpaceMarkers
                        ? isLight
                          ? 'bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-amber-950 border-amber-700 text-amber-300'
                        : isLight
                        ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                        : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
                    }`}
                  >
                    <span>全角/半角空白マーク</span>
                    <span>{showSpaceMarkers ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Genko Grid Toggle */}
                  <button
                    onClick={() => setShowGenkoGrid(!showGenkoGrid)}
                    className={`w-full p-1.5 rounded text-[11px] font-semibold border text-left transition-colors flex items-center justify-between ${
                      showGenkoGrid
                        ? isLight
                          ? 'bg-emerald-800 text-white border-emerald-900'
                          : 'bg-emerald-500 text-stone-950 font-bold border-emerald-400'
                        : isLight
                        ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                        : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
                    }`}
                  >
                    <span>原稿用紙・方眼背景</span>
                    <span>{showGenkoGrid ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Waterfall Toggle */}
                  <button
                    onClick={() => setIsWaterfall(!isWaterfall)}
                    className={`w-full p-1.5 rounded text-[11px] font-semibold border text-left transition-colors flex items-center justify-between ${
                      isWaterfall
                        ? isLight
                          ? 'bg-emerald-800 text-white border-emerald-900'
                          : 'bg-emerald-500 text-stone-950 font-bold border-emerald-400'
                        : isLight
                        ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                        : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
                    }`}
                  >
                    <span>段階サイズ (ウォーターフォール)</span>
                    <span>{isWaterfall ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Right: Full-Height Proofing Canvas Area */}
            <div
              className={`flex-1 min-h-0 h-full overflow-auto overscroll-contain p-3 sm:p-8 select-text relative ${
                isLight ? 'bg-[#eef4f0]' : 'bg-[#0b100d]'
              } ${
                showGenkoGrid
                  ? isLight
                    ? 'bg-[radial-gradient(#c8ded3_1px,transparent_1px)] [background-size:24px_24px]'
                    : 'bg-[radial-gradient(#25362b_1px,transparent_1px)] [background-size:24px_24px]'
                  : ''
              }`}
            >
              {errorMsg ? (
                <div className="p-4 bg-rose-50 border border-rose-300 rounded text-rose-700 text-xs">
                  {errorMsg}
                </div>
              ) : isWaterfall ? (
                <div className="max-w-5xl mx-auto flex flex-col space-y-8 py-4">
                  {waterfallSizes.map((size) => (
                    <div
                      key={size}
                      className={`flex flex-col space-y-1.5 border-b pb-4 ${
                        isLight ? 'border-emerald-200' : 'border-[#1f2d24]'
                      }`}
                    >
                      <span className={`text-[10px] font-mono ${isLight ? 'text-stone-500' : 'text-emerald-500'}`}>
                        {size}px
                      </span>
                      <div
                        style={{
                          fontFamily: `'${fontFamilyName}', sans-serif`,
                          fontSize: `${size}px`,
                          lineHeight: lineHeight,
                          letterSpacing: `${letterSpacing}em`,
                          textAlign: textAlign,
                          writingMode: writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                        }}
                        className={`whitespace-pre-wrap break-words ${isLight ? 'text-stone-900' : 'text-emerald-100'}`}
                      >
                        {renderedText}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Full-Height Paper Layout for Proofing */
                <div className="w-full flex justify-center items-start min-h-full py-1 sm:py-2">
                  <div
                    className={`transition-all rounded-lg shadow-sm border p-4 sm:p-12 ${
                      writingMode === 'vertical'
                        ? 'min-w-[260px] sm:min-w-[340px] max-w-full overflow-x-auto min-h-[calc(100dvh-260px)] md:min-h-[calc(100vh-220px)]'
                        : 'w-full max-w-5xl min-h-[calc(100dvh-260px)] md:min-h-[calc(100vh-220px)]'
                    } ${
                      isLight
                        ? 'bg-white border-[#d8e6df] shadow-stone-200/50'
                        : 'bg-[#151e18] border-[#25362b] shadow-black/40'
                    }`}
                  >
                    {/* Notebook Guide Legend Badge */}
                    {showNotebookGuides && (
                      <div className="mb-3 px-2 py-1 rounded bg-stone-100/90 dark:bg-stone-900/90 border border-stone-200/80 dark:border-stone-800 text-[10px] flex flex-wrap items-center gap-3 shrink-0 select-none pointer-events-none opacity-80">
                        <span className="font-bold text-stone-600 dark:text-stone-300">ノートガイド凡例:</span>
                        {writingMode === 'horizontal' ? (
                          <>
                            <span className="flex items-center space-x-1">
                              <span className="w-3 h-0.5 bg-indigo-500 rounded-full"></span>
                              <span>ベースライン (主罫線)</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <span className="w-3 h-0.5 bg-emerald-500 border-b border-dashed border-emerald-500"></span>
                              <span>中心軸線</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <span className="w-3 h-0.5 bg-sky-400 border-b border-dotted border-sky-400"></span>
                              <span>上限線 (Cap)</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <span className="w-3 h-0.5 bg-rose-400 border-b border-dotted border-rose-400"></span>
                              <span>下限線 (Base)</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="flex items-center space-x-1">
                              <span className="w-3 h-0.5 bg-emerald-500 border-b border-dashed border-emerald-500"></span>
                              <span>縦中心軸線</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <span className="w-3 h-0.5 bg-sky-400 border-b border-dotted border-sky-400"></span>
                              <span>右境界線</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <span className="w-3 h-0.5 bg-rose-400 border-b border-dotted border-rose-400"></span>
                              <span>左境界線</span>
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    <div className="relative w-full overflow-hidden">
                      {/* Multi-line Notebook Ruling Layer */}
                      {showNotebookGuides && (
                        writingMode === 'horizontal' ? (
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none select-none"
                            style={{ minHeight: '100%' }}
                          >
                            <defs>
                              <pattern
                                id="notebook-ruling-h-split"
                                width="100%"
                                height={fontSize * lineHeight}
                                patternUnits="userSpaceOnUse"
                              >
                                {/* Top Cap Line */}
                                <line
                                  x1="0"
                                  y1={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.1}
                                  x2="100%"
                                  y2={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.1}
                                  stroke={isLight ? '#38bdf8' : '#0284c7'}
                                  strokeDasharray="3 3"
                                  strokeWidth="1"
                                  strokeOpacity="0.8"
                                />
                                {/* Center Axis Line */}
                                <line
                                  x1="0"
                                  y1={(fontSize * lineHeight) / 2}
                                  x2="100%"
                                  y2={(fontSize * lineHeight) / 2}
                                  stroke={isLight ? '#10b981' : '#059669'}
                                  strokeDasharray="5 4"
                                  strokeWidth="1"
                                  strokeOpacity="0.8"
                                />
                                {/* Baseline (Main Ruled Line) */}
                                <line
                                  x1="0"
                                  y1={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.8}
                                  x2="100%"
                                  y2={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.8}
                                  stroke={isLight ? '#6366f1' : '#818cf8'}
                                  strokeWidth="1.5"
                                  strokeOpacity="0.85"
                                />
                                {/* Bottom Descender Line */}
                                <line
                                  x1="0"
                                  y1={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.95}
                                  x2="100%"
                                  y2={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.95}
                                  stroke={isLight ? '#f43f5e' : '#e11d48'}
                                  strokeDasharray="3 3"
                                  strokeWidth="1"
                                  strokeOpacity="0.8"
                                />
                              </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#notebook-ruling-h-split)" />
                          </svg>
                        ) : (
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none select-none"
                            style={{ minHeight: '100%' }}
                          >
                            <defs>
                              <pattern
                                id="notebook-ruling-v-split"
                                width={fontSize * lineHeight}
                                height="100%"
                                patternUnits="userSpaceOnUse"
                              >
                                {/* Left Boundary */}
                                <line
                                  x1={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.05}
                                  y1="0"
                                  x2={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.05}
                                  y2="100%"
                                  stroke={isLight ? '#f43f5e' : '#e11d48'}
                                  strokeDasharray="3 3"
                                  strokeWidth="1"
                                  strokeOpacity="0.8"
                                />
                                {/* Vertical Center Axis */}
                                <line
                                  x1={(fontSize * lineHeight) / 2}
                                  y1="0"
                                  x2={(fontSize * lineHeight) / 2}
                                  y2="100%"
                                  stroke={isLight ? '#10b981' : '#059669'}
                                  strokeDasharray="5 4"
                                  strokeWidth="1"
                                  strokeOpacity="0.8"
                                />
                                {/* Right Boundary */}
                                <line
                                  x1={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.95}
                                  y1="0"
                                  x2={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.95}
                                  y2="100%"
                                  stroke={isLight ? '#38bdf8' : '#0284c7'}
                                  strokeDasharray="3 3"
                                  strokeWidth="1"
                                  strokeOpacity="0.8"
                                />
                              </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#notebook-ruling-v-split)" />
                          </svg>
                        )
                      )}

                      <div
                        style={{
                          fontFamily: `'${fontFamilyName}', sans-serif`,
                          fontSize: `${fontSize}px`,
                          lineHeight: lineHeight,
                          letterSpacing: `${letterSpacing}em`,
                          textAlign: textAlign,
                          writingMode: writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                          fontFeatureSettings: useTsume ? '"palt" 1, "pkna" 1' : 'normal',
                        }}
                        className={`relative z-10 whitespace-pre-wrap break-words min-h-[300px] ${
                          isLight ? 'text-stone-900' : 'text-emerald-50'
                        } ${writingMode === 'vertical' ? 'h-full' : 'w-full'}`}
                      >
                        {renderedText}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side Docked Glyph Adjuster Panel */}
            {renderSideAdjustPanel()}
          </div>
        ) : (
          /* ==================== TOP STACKED MODE (WITH COLLAPSIBLE CONTROLS) ==================== */
          <>
            {/* If Collapsed, show minimal slim 1-line bar */}
            {isTopControlsCollapsed ? (
              <div
                className={`px-4 py-2 border-b flex items-center justify-between shrink-0 text-xs ${
                  isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#16201a] border-[#25362b]'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <span className={`text-[11px] font-bold ${isLight ? 'text-emerald-950' : 'text-emerald-200'}`}>
                    {writingMode === 'vertical' ? '縦組み' : '横組み'} ({fontSize}px)
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] text-stone-500">サイズ:</span>
                    <input
                      type="range"
                      min={14}
                      max={96}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-20 accent-emerald-700"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`text-[11px] ${isLight ? 'text-stone-500' : 'text-emerald-400'}`}>
                    （文字プレビュー集中モード中）
                  </span>
                  <button
                    onClick={() => setIsTopControlsCollapsed(false)}
                    className="px-2 py-1 rounded border text-xs font-semibold bg-emerald-700 text-white"
                  >
                    設定を展開
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Presets selection */}
                <div
                  className={`px-3 py-1.5 border-b flex items-center space-x-1.5 overflow-x-auto text-xs shrink-0 ${
                    isLight ? 'bg-[#f4f9f6] border-[#d8e6df]' : 'bg-[#121a14] border-[#25362b]'
                  }`}
                >
                  <span className={`text-[11px] font-semibold shrink-0 ${isLight ? 'text-stone-500' : 'text-emerald-400'}`}>
                    例文:
                  </span>
                  {SAMPLE_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setTestText(preset.text);
                        setWritingMode(preset.mode);
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] whitespace-nowrap transition-colors border ${
                        testText === preset.text
                          ? isLight
                            ? 'bg-emerald-800 text-white border-emerald-900 font-bold shadow-xs'
                            : 'bg-emerald-500 text-stone-950 border-emerald-400 font-bold shadow-xs'
                          : isLight
                          ? 'bg-white border-[#c8ded3] text-stone-700 hover:bg-emerald-50'
                          : 'bg-[#18231c] border-[#25362b] text-emerald-300 hover:bg-[#202d24]'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>

                {/* Toolbar Parameters */}
                <div
                  className={`p-2 border-b flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0 ${
                    isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#16201a] border-[#25362b]'
                  }`}
                >
                  {/* Writing Mode Selector */}
                  <div className="flex items-center space-x-1">
                    <span className={`text-[11px] font-semibold ${isLight ? 'text-stone-600' : 'text-emerald-300'}`}>
                      組方向:
                    </span>
                    <div
                      className={`flex items-center p-0.5 rounded-md border ${
                        isLight ? 'bg-[#edf5f0] border-[#c8ded3]' : 'bg-[#101712] border-[#25362b]'
                      }`}
                    >
                      <button
                        onClick={() => setWritingMode('horizontal')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          writingMode === 'horizontal'
                            ? isLight
                              ? 'bg-emerald-800 text-white shadow-xs'
                              : 'bg-emerald-500 text-stone-950 shadow-xs'
                            : isLight
                            ? 'text-stone-600'
                            : 'text-emerald-400'
                        }`}
                      >
                        横組み
                      </button>
                      <button
                        onClick={() => setWritingMode('vertical')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          writingMode === 'vertical'
                            ? isLight
                              ? 'bg-emerald-800 text-white shadow-xs'
                              : 'bg-emerald-500 text-stone-950 shadow-xs'
                            : isLight
                            ? 'text-stone-600'
                            : 'text-emerald-400'
                        }`}
                      >
                        縦組み
                      </button>
                    </div>
                  </div>

                  {/* Size, Line-height, Letter-spacing */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center space-x-1">
                      <span className={`text-[11px] ${isLight ? 'text-stone-600' : 'text-emerald-400'}`}>サイズ:</span>
                      <input
                        type="range"
                        min={14}
                        max={96}
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="w-16 accent-emerald-700"
                      />
                      <span className="font-mono w-6 text-[11px]">{fontSize}</span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <span className={`text-[11px] ${isLight ? 'text-stone-600' : 'text-emerald-400'}`}>行送り:</span>
                      <input
                        type="range"
                        min={1.2}
                        max={3.0}
                        step={0.1}
                        value={lineHeight}
                        onChange={(e) => setLineHeight(Number(e.target.value))}
                        className="w-14 accent-emerald-700"
                      />
                      <span className="font-mono w-6 text-[11px]">{lineHeight.toFixed(1)}</span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <span className={`text-[11px] ${isLight ? 'text-stone-600' : 'text-emerald-400'}`}>字間:</span>
                      <input
                        type="range"
                        min={-0.05}
                        max={0.5}
                        step={0.02}
                        value={letterSpacing}
                        onChange={(e) => setLetterSpacing(Number(e.target.value))}
                        className="w-14 accent-emerald-700"
                      />
                      <span className="font-mono w-8 text-[11px]">
                        {letterSpacing >= 0 ? `+${letterSpacing.toFixed(2)}` : letterSpacing.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Text Align */}
                  <div
                    className={`flex items-center p-0.5 rounded border ${
                      isLight ? 'bg-[#edf5f0] border-[#c8ded3]' : 'bg-[#101712] border-[#25362b]'
                    }`}
                  >
                    <button
                      onClick={() => setTextAlign('left')}
                      className={`p-1 rounded ${textAlign === 'left' ? (isLight ? 'bg-emerald-800 text-white' : 'bg-emerald-500 text-stone-950 font-bold') : ''}`}
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTextAlign('center')}
                      className={`p-1 rounded ${textAlign === 'center' ? (isLight ? 'bg-emerald-800 text-white' : 'bg-emerald-500 text-stone-950 font-bold') : ''}`}
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTextAlign('right')}
                      className={`p-1 rounded ${textAlign === 'right' ? (isLight ? 'bg-emerald-800 text-white' : 'bg-emerald-500 text-stone-950 font-bold') : ''}`}
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTextAlign('justify')}
                      className={`p-1 rounded ${textAlign === 'justify' ? (isLight ? 'bg-emerald-800 text-white' : 'bg-emerald-500 text-stone-950 font-bold') : ''}`}
                    >
                      <AlignJustify className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Toggles */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setFontScaleMultiplier(fontScaleMultiplier === 1.35 ? 1.0 : 1.35)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${fontScaleMultiplier === 1.35 ? (isLight ? 'bg-emerald-800 text-white' : 'bg-emerald-500 text-stone-950') : 'bg-white text-stone-600'}`}
                    >
                      最適化 {fontScaleMultiplier === 1.35 ? '135%' : '100%'}
                    </button>
                    <button
                      onClick={() => setAutoBalanceMargins(!autoBalanceMargins)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${autoBalanceMargins ? 'bg-amber-600 text-white' : (isLight ? 'bg-emerald-800 text-white' : 'bg-emerald-500 text-stone-950')}`}
                    >
                      {autoBalanceMargins ? 'センタリング' : '位置優先'}
                    </button>
                    <button
                      onClick={() => setShowCharBoxes(!showCharBoxes)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${showCharBoxes ? (isLight ? 'bg-emerald-800 text-white' : 'bg-emerald-500 text-stone-950') : 'bg-white text-stone-600'}`}
                    >
                      仮想枠
                    </button>
                    <button
                      onClick={() => setShowNotebookGuides(!showNotebookGuides)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${showNotebookGuides ? (isLight ? 'bg-emerald-800 text-white' : 'bg-emerald-500 text-stone-950') : 'bg-white text-stone-600'}`}
                    >
                      ノートガイド
                    </button>
                    <button
                      onClick={() => setShowGenkoGrid(!showGenkoGrid)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${showGenkoGrid ? (isLight ? 'bg-emerald-800 text-white' : 'bg-emerald-500 text-stone-950') : 'bg-white text-stone-600'}`}
                    >
                      原稿用紙
                    </button>
                    <button
                      onClick={() => setIsWaterfall(!isWaterfall)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${isWaterfall ? (isLight ? 'bg-emerald-800 text-white' : 'bg-emerald-500 text-stone-950') : 'bg-white text-stone-600'}`}
                    >
                      段階
                    </button>
                  </div>
                </div>

                {/* Text Input Area */}
                <div
                  className={`p-2 border-b shrink-0 ${
                    isLight ? 'bg-[#f4f9f6] border-[#d8e6df]' : 'bg-[#101712] border-[#25362b]'
                  }`}
                >
                  <textarea
                    rows={2}
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="ここにテストしたい文章を入力..."
                    className={`w-full border rounded-md p-1.5 text-xs focus:outline-none select-text transition-colors ${
                      isLight
                        ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                        : 'bg-[#16201a] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                    }`}
                  />
                </div>
              </>
            )}

            {/* Main Proofing Stage and Docked Side Panel Container */}
            <div className="flex-1 min-h-0 flex flex-row overflow-hidden relative">
              <div
                className={`flex-1 min-h-0 overflow-auto overscroll-contain p-3 sm:p-8 select-text relative min-h-[250px] ${
                isLight ? 'bg-[#eef4f0]' : 'bg-[#0b100d]'
              } ${
                showGenkoGrid
                  ? isLight
                    ? 'bg-[radial-gradient(#c8ded3_1px,transparent_1px)] [background-size:24px_24px]'
                    : 'bg-[radial-gradient(#25362b_1px,transparent_1px)] [background-size:24px_24px]'
                  : ''
              }`}
            >
              {errorMsg ? (
                <div className="p-4 bg-rose-50 border border-rose-300 rounded text-rose-700 text-xs">
                  {errorMsg}
                </div>
              ) : isWaterfall ? (
                <div
                  className={`mx-auto flex flex-col ${
                    isFullscreen ? 'max-w-6xl space-y-8 py-4' : 'max-w-4xl space-y-6'
                  }`}
                >
                  {waterfallSizes.map((size) => (
                    <div
                      key={size}
                      className={`flex flex-col space-y-1.5 border-b pb-4 ${
                        isLight ? 'border-emerald-200' : 'border-[#1f2d24]'
                      }`}
                    >
                      <span className={`text-[10px] font-mono ${isLight ? 'text-stone-500' : 'text-emerald-500'}`}>
                        {size}px
                      </span>
                      <div
                        style={{
                          fontFamily: `'${fontFamilyName}', sans-serif`,
                          fontSize: `${size}px`,
                          lineHeight: lineHeight,
                          letterSpacing: `${letterSpacing}em`,
                          textAlign: textAlign,
                          writingMode: writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                        }}
                        className={`whitespace-pre-wrap break-words ${isLight ? 'text-stone-900' : 'text-emerald-100'}`}
                      >
                        {renderedText}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Paper Layout */
                <div className={`w-full flex justify-center items-start min-h-full ${isFullscreen ? 'py-4 sm:py-8' : 'py-2'}`}>
                  <div
                    className={`transition-all rounded-lg shadow-sm border ${
                      isFullscreen ? 'p-6 sm:p-14' : 'p-4 sm:p-10'
                    } ${
                      writingMode === 'vertical'
                        ? isFullscreen
                          ? 'min-w-[280px] sm:min-w-[380px] max-w-full overflow-x-auto h-full max-h-[calc(100vh-270px)]'
                          : 'min-w-[260px] sm:min-w-[320px] max-w-full overflow-x-auto h-full max-h-[720px]'
                        : isFullscreen
                        ? 'w-full max-w-5xl xl:max-w-6xl min-h-[calc(100vh-320px)]'
                        : 'w-full max-w-3xl'
                    } ${
                      isLight
                        ? 'bg-white border-[#d8e6df] shadow-stone-200/50'
                        : 'bg-[#151e18] border-[#25362b] shadow-black/40'
                    }`}
                  >
                    {/* Notebook Guide Legend Badge */}
                    {showNotebookGuides && (
                      <div className="mb-3 px-2 py-1 rounded bg-stone-100/90 dark:bg-stone-900/90 border border-stone-200/80 dark:border-stone-800 text-[10px] flex flex-wrap items-center gap-3 shrink-0 select-none pointer-events-none opacity-80">
                        <span className="font-bold text-stone-600 dark:text-stone-300">ノートガイド凡例:</span>
                        {writingMode === 'horizontal' ? (
                          <>
                            <span className="flex items-center space-x-1">
                              <span className="w-3 h-0.5 bg-indigo-500 rounded-full"></span>
                              <span>ベースライン (主罫線)</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <span className="w-3 h-0.5 bg-emerald-500 border-b border-dashed border-emerald-500"></span>
                              <span>中心軸線</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <span className="w-3 h-0.5 bg-sky-400 border-b border-dotted border-sky-400"></span>
                              <span>上限線 (Cap)</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <span className="w-3 h-0.5 bg-rose-400 border-b border-dotted border-rose-400"></span>
                              <span>下限線 (Base)</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="flex items-center space-x-1">
                              <span className="w-3 h-0.5 bg-emerald-500 border-b border-dashed border-emerald-500"></span>
                              <span>縦中心軸線</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <span className="w-3 h-0.5 bg-sky-400 border-b border-dotted border-sky-400"></span>
                              <span>右境界線</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <span className="w-3 h-0.5 bg-rose-400 border-b border-dotted border-rose-400"></span>
                              <span>左境界線</span>
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    <div className="relative w-full overflow-hidden">
                      {/* Multi-line Notebook Ruling Layer */}
                      {showNotebookGuides && (
                        writingMode === 'horizontal' ? (
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none select-none"
                            style={{ minHeight: '100%' }}
                          >
                            <defs>
                              <pattern
                                id="notebook-ruling-h-top"
                                width="100%"
                                height={fontSize * lineHeight}
                                patternUnits="userSpaceOnUse"
                              >
                                {/* Top Cap Line */}
                                <line
                                  x1="0"
                                  y1={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.1}
                                  x2="100%"
                                  y2={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.1}
                                  stroke={isLight ? '#38bdf8' : '#0284c7'}
                                  strokeDasharray="3 3"
                                  strokeWidth="1"
                                  strokeOpacity="0.8"
                                />
                                {/* Center Axis Line */}
                                <line
                                  x1="0"
                                  y1={(fontSize * lineHeight) / 2}
                                  x2="100%"
                                  y2={(fontSize * lineHeight) / 2}
                                  stroke={isLight ? '#10b981' : '#059669'}
                                  strokeDasharray="5 4"
                                  strokeWidth="1"
                                  strokeOpacity="0.8"
                                />
                                {/* Baseline (Main Ruled Line) */}
                                <line
                                  x1="0"
                                  y1={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.8}
                                  x2="100%"
                                  y2={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.8}
                                  stroke={isLight ? '#6366f1' : '#818cf8'}
                                  strokeWidth="1.5"
                                  strokeOpacity="0.85"
                                />
                                {/* Bottom Descender Line */}
                                <line
                                  x1="0"
                                  y1={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.95}
                                  x2="100%"
                                  y2={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.95}
                                  stroke={isLight ? '#f43f5e' : '#e11d48'}
                                  strokeDasharray="3 3"
                                  strokeWidth="1"
                                  strokeOpacity="0.8"
                                />
                              </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#notebook-ruling-h-top)" />
                          </svg>
                        ) : (
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none select-none"
                            style={{ minHeight: '100%' }}
                          >
                            <defs>
                              <pattern
                                id="notebook-ruling-v-top"
                                width={fontSize * lineHeight}
                                height="100%"
                                patternUnits="userSpaceOnUse"
                              >
                                {/* Left Boundary */}
                                <line
                                  x1={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.05}
                                  y1="0"
                                  x2={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.05}
                                  y2="100%"
                                  stroke={isLight ? '#f43f5e' : '#e11d48'}
                                  strokeDasharray="3 3"
                                  strokeWidth="1"
                                  strokeOpacity="0.8"
                                />
                                {/* Vertical Center Axis */}
                                <line
                                  x1={(fontSize * lineHeight) / 2}
                                  y1="0"
                                  x2={(fontSize * lineHeight) / 2}
                                  y2="100%"
                                  stroke={isLight ? '#10b981' : '#059669'}
                                  strokeDasharray="5 4"
                                  strokeWidth="1"
                                  strokeOpacity="0.8"
                                />
                                {/* Right Boundary */}
                                <line
                                  x1={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.95}
                                  y1="0"
                                  x2={((lineHeight - 1) * fontSize) / 2 + fontSize * 0.95}
                                  y2="100%"
                                  stroke={isLight ? '#38bdf8' : '#0284c7'}
                                  strokeDasharray="3 3"
                                  strokeWidth="1"
                                  strokeOpacity="0.8"
                                />
                              </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#notebook-ruling-v-top)" />
                          </svg>
                        )
                      )}

                      <div
                        style={{
                          fontFamily: `'${fontFamilyName}', sans-serif`,
                          fontSize: `${fontSize}px`,
                          lineHeight: lineHeight,
                          letterSpacing: `${letterSpacing}em`,
                          textAlign: textAlign,
                          writingMode: writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                          fontFeatureSettings: useTsume ? '"palt" 1, "pkna" 1' : 'normal',
                        }}
                        className={`relative z-10 whitespace-pre-wrap break-words min-h-[220px] ${
                          isLight ? 'text-stone-900' : 'text-emerald-50'
                        } ${writingMode === 'vertical' ? 'h-full' : 'w-full'}`}
                      >
                        {renderedText}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side Docked Glyph Adjuster Panel */}
            {renderSideAdjustPanel()}
          </div>
        </>
      )}

        {/* Footer info bar & Hover Glyph Inspector */}
        <div
          className={`px-4 py-2 border-t flex flex-wrap items-center justify-between text-xs shrink-0 ${
            isLight ? 'bg-[#edf5f0] border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <div className="flex items-center space-x-3 text-[11px] overflow-x-auto">
            {hoveredGlyphInfo ? (
              <div className="flex items-center space-x-2 font-mono">
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  「{hoveredGlyphInfo.char}」
                </span>
                <span>(U+{hoveredGlyphInfo.unicode.toString(16).toUpperCase()})</span>
                <span>送り幅: {hoveredGlyphInfo.adv}</span>
                <span>左余白: {hoveredGlyphInfo.lsb}px</span>
                <span>右余白: {hoveredGlyphInfo.rsb}px</span>
                <span
                  className={`px-1 rounded text-[10px] font-bold ${
                    Math.abs(hoveredGlyphInfo.diff) <= 20
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {Math.abs(hoveredGlyphInfo.diff) <= 20
                    ? '左右均等'
                    : hoveredGlyphInfo.diff < 0
                    ? `左寄り (${Math.abs(Math.round(hoveredGlyphInfo.diff / 2))}px)`
                    : `右寄り (${Math.round(hoveredGlyphInfo.diff / 2)}px)`}
                </span>
              </div>
            ) : (
              <>
                <span className={`font-medium ${isLight ? 'text-stone-600' : 'text-emerald-400'}`}>
                  フォント: <strong className={isLight ? 'text-emerald-950' : 'text-emerald-200'}>{project.metadata.familyName || 'MyFont'}</strong>
                </span>
                <span className={`font-mono ${isLight ? 'text-stone-500' : 'text-emerald-500'}`}>
                  {writingMode === 'vertical' ? '縦組み' : '横組み'} | {textAlign === 'left' ? '左揃え' : textAlign === 'center' ? '中央揃え' : textAlign === 'right' ? '右揃え' : '均等揃え'}
                </span>
                <span className={`text-[10px] ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  {autoBalanceMargins ? '左右センタリング補正中' : 'ガイド描画位置優先'}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors flex items-center space-x-1 ${
                isFullscreen
                  ? isLight
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200'
                    : 'bg-emerald-950 border-emerald-700 text-emerald-200 hover:bg-emerald-900'
                  : isLight
                  ? 'bg-white border-stone-300 text-stone-700 hover:bg-emerald-50 hover:text-emerald-900'
                  : 'bg-[#1e2a22] border-[#2b3d30] text-emerald-200 hover:bg-[#25362b]'
              }`}
              title={isFullscreen ? '通常表示に戻す (F / Esc)' : '全画面表示モード (ショートカット: F)'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>通常表示</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>全画面</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className={`px-4 py-1 rounded-md text-xs font-semibold transition-colors ${
                isLight
                  ? 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs'
                  : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-xs'
              }`}
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
