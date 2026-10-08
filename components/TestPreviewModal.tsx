import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Check,
  Pencil,
  Settings,
  BookOpen,
} from 'lucide-react';
import { useRef } from 'react';
import { FontProject, PathContour, Point } from '../types';
import { compileFont, balanceProjectGlyphMargins } from '../utils/fontCompiler';
import { getContoursBoundingBox, smoothAndFixTransformedContours } from '../utils/pathUtils';
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
    name: '【横組】イーハトーヴォ (かな混じり・漢字少)',
    mode: 'horizontal' as const,
    text:
      'あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。\nまたそのなかでいっしょになったたくさんのひとたち、ファゼーロとロザーロ、羊飼のミーロや、顔の赤いこどもたち、地主のテーモ、山猫博士のボーガント・デストゥパーゴなど、いまこの暗い巨きな石の建物のなかで考えていると、みんなむかし風のなつかしい青い幻燈のように思われます。',
  },
  {
    name: '【縦組】イーハトーヴォ (かな混じり・漢字少)',
    mode: 'vertical' as const,
    text:
      'あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。\nまたそのなかでいっしょになったたくさんのひとたち、ファゼーロとロザーロ、羊飼のミーロや、顔の赤いこどもたち、地主のテーモ、山猫博士のボーガント・デストゥパーゴなど、いまこの暗い巨きな石の建物のなかで考えていると、みんなむかし風のなつかしい青い幻燈のように思われます。',
  },
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
 * Converts a PathContour into an SVG path data string ('M ... C ... Z')
 */
export function contourToSvgPathData(contour: PathContour): string {
  if (!contour || !contour.nodes || contour.nodes.length === 0) return '';
  let d = '';
  const first = contour.nodes[0];
  d += `M ${first.x} ${first.y}`;
  for (let i = 0; i < contour.nodes.length; i++) {
    const curr = contour.nodes[i];
    const nextIndex = (i + 1) % contour.nodes.length;
    if (nextIndex === 0 && !contour.closed) break;
    const next = contour.nodes[nextIndex];
    if (curr.handleOut || next.handleIn) {
      const h1x = curr.handleOut ? curr.handleOut.x : curr.x;
      const h1y = curr.handleOut ? curr.handleOut.y : curr.y;
      const h2x = next.handleIn ? next.handleIn.x : next.x;
      const h2y = next.handleIn ? next.handleIn.y : next.y;
      d += ` C ${h1x} ${h1y}, ${h2x} ${h2y}, ${next.x} ${next.y}`;
    } else {
      d += ` L ${next.x} ${next.y}`;
    }
  }
  if (contour.closed) d += ' Z';
  return d;
}

/**
 * Transforms glyph contours by shifting center dx, dy and scaling around center by scaleX, scaleY ratios.
 * High subpixel precision and handle-protection to prevent Bezier curve collapsing or path distortion.
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
      x: Math.round((cx + dx + relX * scaleXRatio) * 100) / 100,
      y: Math.round((cy - dy + relY * scaleYRatio) * 100) / 100,
    };
  };

  const transformed = contours.map((c) => ({
    ...c,
    nodes: c.nodes.map((n) => {
      const newPt = transformPt({ x: n.x, y: n.y });
      let handleIn: Point | null = null;
      if (n.handleIn) {
        if (Math.abs(n.handleIn.x - n.x) < 0.01 && Math.abs(n.handleIn.y - n.y) < 0.01) {
          handleIn = { x: newPt.x, y: newPt.y };
        } else {
          handleIn = transformPt(n.handleIn);
        }
      }
      let handleOut: Point | null = null;
      if (n.handleOut) {
        if (Math.abs(n.handleOut.x - n.x) < 0.01 && Math.abs(n.handleOut.y - n.y) < 0.01) {
          handleOut = { x: newPt.x, y: newPt.y };
        } else {
          handleOut = transformPt(n.handleOut);
        }
      }
      return {
        ...n,
        x: newPt.x,
        y: newPt.y,
        handleIn,
        handleOut,
      };
    }),
  }));

  return smoothAndFixTransformedContours(transformed);
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

  // Handle mouse wheel scrolling horizontally in vertical writing mode
  const handleVerticalWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (writingMode === 'vertical' && !isWaterfall) {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.1) {
          const target = e.currentTarget;
          const prevLeft = target.scrollLeft;
          // In RTL / vertical-rl columns advance to the left
          target.scrollLeft -= e.deltaY;
          if (target.scrollLeft === prevLeft) {
            target.scrollLeft += e.deltaY;
          }
        }
      }
    },
    [writingMode, isWaterfall]
  );

  // Variable Width & Collapsible Panel States (可変式UI)
  const [isSideAdjusterOpen, setIsSideAdjusterOpen] = useState<boolean>(true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(280);
  const [rightAdjusterWidth, setRightAdjusterWidth] = useState<number>(300);

  const mainContainerRef = useRef<HTMLDivElement>(null);
  const [isResizingLeft, setIsResizingLeft] = useState<boolean>(false);
  const [isResizingRight, setIsResizingRight] = useState<boolean>(false);

  const handleLeftResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleLeftResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizingLeft || !mainContainerRef.current) return;
    const rect = mainContainerRef.current.getBoundingClientRect();
    const newWidth = Math.max(180, Math.min(480, e.clientX - rect.left));
    setLeftSidebarWidth(newWidth);
  };

  const handleLeftResizePointerUp = (e: React.PointerEvent) => {
    if (isResizingLeft) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setIsResizingLeft(false);
    }
  };

  const handleRightResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleRightResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizingRight || !mainContainerRef.current) return;
    const rect = mainContainerRef.current.getBoundingClientRect();
    const newWidth = Math.max(200, Math.min(520, rect.right - e.clientX));
    setRightAdjusterWidth(newWidth);
  };

  const handleRightResizePointerUp = (e: React.PointerEvent) => {
    if (isResizingRight) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setIsResizingRight(false);
    }
  };

  // Floating / Docked adjustment panel state (default: docked as right sidebar)
  const [isDocked, setIsDocked] = useState<boolean>(true);
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number }>({ x: 720, y: 60 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialPosX: number; initialPosY: number } | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const fontVersionRef = useRef<number>(0);
  const compileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [mobileTab, setMobileTab] = useState<'preview' | 'settings' | 'adjust'>('preview');
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Compile font dynamically and create @font-face style rule with FontFace API
  useEffect(() => {
    if (!isOpen) {
      if (compileTimerRef.current) {
        clearTimeout(compileTimerRef.current);
        compileTimerRef.current = null;
      }
      return;
    }

    if (compileTimerRef.current) {
      clearTimeout(compileTimerRef.current);
    }

    const compileVersion = ++fontVersionRef.current;
    compileTimerRef.current = setTimeout(() => {
      compileTimerRef.current = null;
      try {
        const { blobUrl } = compileFont(project, {
          scaleFactor: fontScaleMultiplier,
          balanceSideBearings: autoBalanceMargins,
          mergeOverlaps: true,
          normalizeWinding: true,
        });
        const newFontName = `CustomTestFont_v${compileVersion}_${Date.now()}`;

        if (typeof FontFace !== 'undefined') {
          const ff = new FontFace(newFontName, `url('${blobUrl}')`);
          ff.load()
            .then((loadedFace) => {
              if (compileVersion !== fontVersionRef.current) {
                URL.revokeObjectURL(blobUrl);
                return;
              }
              document.fonts.add(loadedFace);
              setFontFamilyName(newFontName);
              if (activeBlobUrlRef.current && activeBlobUrlRef.current !== blobUrl) {
                URL.revokeObjectURL(activeBlobUrlRef.current);
              }
              activeBlobUrlRef.current = blobUrl;
            })
            .catch(() => {
              if (compileVersion === fontVersionRef.current) {
                URL.revokeObjectURL(blobUrl);
                setErrorMsg('プレビュー用フォントの読み込みに失敗しました。');
              } else {
                URL.revokeObjectURL(blobUrl);
              }
            });
        } else {
          setFontFamilyName(newFontName);
        }

        const styleId = 'dynamic-preview-font-face';
        let styleTag = document.getElementById(styleId) as HTMLStyleElement;
        if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = styleId;
          document.head.appendChild(styleTag);
        }
        styleTag.textContent = `
          @font-face {
            font-family: '${newFontName}';
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
    }, 250);

    return () => {
      if (compileTimerRef.current) {
        clearTimeout(compileTimerRef.current);
        compileTimerRef.current = null;
      }
    };
  }, [isOpen, project.updatedAt, autoBalanceMargins, fontScaleMultiplier]);

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
    const code = char.codePointAt(0) ?? 0;
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

    const newBbox = getContoursBoundingBox(transformedContours);
    const newLsb = Math.max(0, Math.round(newBbox.minX));

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
            lsb: newLsb,
            updatedAt: Date.now(),
          },
        },
      };
    });

    if (onShowToast) {
      onShowToast(
        `「${selectedCharInfo.char}」のグリフ輪郭（位置 X:${adjustDx}, Y:${adjustDy}, 拡縮 ${adjustScaleX}%×${adjustScaleY}%）を永続保存しました`,
        'success'
      );
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

  // Center selected character in EM Box
  const handleAutoCenterGlyph = () => {
    if (!selectedCharInfo || !setProject) return;
    const unicode = selectedCharInfo.unicode;
    const g = project.glyphs[unicode];
    if (!g || !g.contours || g.contours.length === 0) return;
    const bbox = getContoursBoundingBox(g.contours);
    if (bbox.width <= 0) return;

    const adv = g.advanceWidth || (unicode > 255 ? (project.metadata.unitsPerEm || 1000) : 500);
    const targetLsb = Math.round((adv - bbox.width) / 2);
    const deltaX = targetLsb - bbox.minX;

    setAdjustDx(deltaX);
    if (onShowToast) {
      onShowToast(`「${selectedCharInfo.char}」をEM枠中央に自動配置しました (X:${deltaX}px)`, 'info');
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
        const isSelected = selectedCharInfo && selectedCharInfo.unicode === code;

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
                setMobileTab('adjust');
                setAdjustDx(0);
                setAdjustDy(0);
                setAdjustScaleX(100);
                setAdjustScaleY(100);
              }}
              onMouseEnter={() => metric && setHoveredGlyphInfo(metric)}
              className={`inline-flex items-center justify-center relative border border-dashed transition-all cursor-pointer select-none ${
                isSelected
                  ? 'ring-2 ring-emerald-500 bg-emerald-500/25 border-emerald-500 text-emerald-950 dark:text-emerald-100 z-10'
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
                  ? `translate(${adjustDx * (fontSize / (project.metadata.unitsPerEm || 1000))}px, ${-adjustDy * (fontSize / (project.metadata.unitsPerEm || 1000))}px) scale(${adjustScaleX / 100}, ${adjustScaleY / 100})`
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
                setIsSideAdjusterOpen(true);
                setMobileTab('adjust');
                setAdjustDx(0);
                setAdjustDy(0);
                setAdjustScaleX(100);
                setAdjustScaleY(100);
              }}
              onMouseEnter={() => metric && setHoveredGlyphInfo(metric)}
              className={`inline-block relative transition-all cursor-pointer select-none rounded px-0.5 ${
                isSelected
                  ? 'ring-2 ring-emerald-500 bg-emerald-500/20 text-emerald-950 dark:text-emerald-100 z-10'
                  : 'hover:bg-emerald-500/15 hover:ring-1 hover:ring-emerald-400/80'
              }`}
              style={{
                transform: hasCustomTransform
                  ? `translate(${adjustDx * (fontSize / (project.metadata.unitsPerEm || 1000))}px, ${-adjustDy * (fontSize / (project.metadata.unitsPerEm || 1000))}px) scale(${adjustScaleX / 100}, ${adjustScaleY / 100})`
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

  // Live SVG Preview calculation for active selected character
  const activeGlyph = selectedCharInfo ? project.glyphs[selectedCharInfo.unicode] : null;
  const livePreviewContours = useMemo(() => {
    if (!activeGlyph || !activeGlyph.contours) return [];
    if (adjustDx === 0 && adjustDy === 0 && adjustScaleX === 100 && adjustScaleY === 100) {
      return activeGlyph.contours;
    }
    return transformGlyphContours(
      activeGlyph.contours,
      adjustDx,
      adjustDy,
      adjustScaleX / 100,
      adjustScaleY / 100
    );
  }, [activeGlyph, adjustDx, adjustDy, adjustScaleX, adjustScaleY]);

  // All available glyph entries in project for dropdown selection
  const glyphEntries = useMemo(() => {
    return Object.keys(project.glyphs)
      .map((codeStr) => {
        const u = Number(codeStr);
        const g = project.glyphs[u];
        const ch = g?.char || String.fromCodePoint(u);
        return { unicode: u, char: ch, name: g?.name || ch };
      })
      .filter((item) => item.char && item.char.trim().length > 0);
  }, [project.glyphs]);

  const [showLivePreviewBox, setShowLivePreviewBox] = useState<boolean>(false);

  const renderSideAdjustPanel = () => {
    const panelContent = (
      <>
        {/* Header with Glyph Selector Dropdown, Title & Dock Toggle */}
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
          <div className="flex items-center space-x-2 min-w-0 flex-1 pr-1">
            {!isDocked && (
              <div
                className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 shrink-0"
                title="ドラッグして小窓を移動"
              >
                <GripVertical className="w-4 h-4" />
              </div>
            )}

            <div className="flex items-center space-x-2 flex-1 min-w-0">
              {selectedCharInfo ? (
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold text-base shrink-0">
                  {selectedCharInfo.char}
                </span>
              ) : (
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-stone-300 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold text-xs shrink-0">
                  ?
                </span>
              )}

              {/* Character Quick Selector Dropdown */}
              <select
                value={selectedCharInfo ? selectedCharInfo.unicode : ''}
                onChange={(e) => {
                  const u = Number(e.target.value);
                  if (u && project.glyphs[u]) {
                    const ch = project.glyphs[u].char || String.fromCodePoint(u);
                    setSelectedCharInfo({ char: ch, unicode: u, lineIndex: -1, charIndex: -1 });
                    setAdjustDx(0);
                    setAdjustDy(0);
                    setAdjustScaleX(100);
                    setAdjustScaleY(100);
                  }
                }}
                className={`flex-1 text-xs py-1.5 px-2 rounded-lg border font-bold truncate ${
                  isLight
                    ? 'bg-white border-[#c8ded3] text-stone-800'
                    : 'bg-[#18231c] border-[#2d4034] text-emerald-200'
                }`}
              >
                <option value="">-- 調整する文字を選択 --</option>
                {glyphEntries.map((item) => (
                  <option key={item.unicode} value={item.unicode}>
                    「{item.char}」 (U+{item.unicode.toString(16).toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={() => setIsDocked((prev) => !prev)}
              className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
              title={isDocked ? 'フローティング小窓にする (ドラッグ移動可能)' : '右サイドバーに固定ドックする'}
            >
              {isDocked ? <Maximize2 className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
            </button>
            {selectedCharInfo && (
              <button
                onClick={() => setSelectedCharInfo(null)}
                className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 transition-colors"
                title="調整パネルを閉じる (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {!selectedCharInfo ? (
          <div className="p-5 text-center space-y-3 text-stone-500 dark:text-stone-400 my-auto">
            <MousePointerClick className="w-10 h-10 mx-auto text-emerald-600" />
            <p className="text-xs font-bold leading-relaxed">
              文章内の文字をクリック、または上のドロップダウンから調整したい文字を選択してください
            </p>
            <p className="text-[11px] opacity-80 leading-relaxed">
              位置（X/Y）や拡大縮小・縦横比をリアルタイムに微調整し、グリフデータへ永続保存できます
            </p>
          </div>
        ) : (
          <>
            {/* Adjuster Controls Container (Unified Scrollable) */}
            <div className="space-y-3 text-xs flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 custom-scrollbar my-1">
              {/* Live Vector SVG Preview Canvas Box (Toggleable & Compact) */}
              <div className={`p-2 rounded-xl border flex flex-col items-center justify-center shrink-0 relative overflow-hidden transition-all ${
                isLight ? 'bg-white border-emerald-200 ' : 'bg-[#101812] border-emerald-900/60 '
              }`}>
                {(() => {
                  const upm = project.metadata.unitsPerEm || 1000;
                  const baselineY = project.metadata.ascender || Math.round(upm * 0.8);
                  const half = upm / 2;
                  const pad = Math.round(upm * 0.1);
                  const total = upm + pad * 2;
                  return (
                    <>
                      <div className="w-full flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 px-0.5">
                        <button
                          type="button"
                          onClick={() => setShowLivePreviewBox((prev) => !prev)}
                          className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 hover:underline cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>ベクター輪郭プレビュー</span>
                          <span className="text-[10px] font-normal opacity-75">({showLivePreviewBox ? 'たたむ' : '展開'})</span>
                        </button>
                        <span className="font-mono text-[10px]">{upm} EM</span>
                      </div>

                      {showLivePreviewBox && (
                        <div className="mt-2 w-28 h-28 border border-dashed border-emerald-500/40 relative bg-emerald-50/20 dark:bg-emerald-950/20 rounded-lg flex items-center justify-center">
                          <svg
                            viewBox={`-${pad} -${pad} ${total} ${total}`}
                            className="w-full h-full overflow-visible text-emerald-900 dark:text-emerald-300"
                          >
                            {/* EM Box Frame */}
                            <rect
                              x="0"
                              y="0"
                              width={upm}
                              height={upm}
                              fill="none"
                              stroke="rgba(16,185,129,0.25)"
                              strokeWidth={Math.max(2, Math.round(upm * 0.01))}
                              strokeDasharray={`${Math.round(upm * 0.02)} ${Math.round(upm * 0.02)}`}
                            />
                            {/* Baseline in canvas/SVG space */}
                            <line
                              x1={-pad}
                              y1={baselineY}
                              x2={upm + pad}
                              y2={baselineY}
                              stroke="rgba(99,102,241,0.5)"
                              strokeWidth={Math.max(2, Math.round(upm * 0.012))}
                            />
                            {/* Center Cross */}
                            <line
                              x1={half}
                              y1={-pad}
                              x2={half}
                              y2={upm + pad}
                              stroke="rgba(16,185,129,0.3)"
                              strokeWidth={Math.max(1.5, Math.round(upm * 0.008))}
                              strokeDasharray={`${Math.round(upm * 0.015)} ${Math.round(upm * 0.015)}`}
                            />
                            <line
                              x1={-pad}
                              y1={half}
                              x2={upm + pad}
                              y2={half}
                              stroke="rgba(16,185,129,0.3)"
                              strokeWidth={Math.max(1.5, Math.round(upm * 0.008))}
                              strokeDasharray={`${Math.round(upm * 0.015)} ${Math.round(upm * 0.015)}`}
                            />

                            {/* Rendered Contours */}
                            <g>
                              {livePreviewContours.map((c, idx) => (
                                <path
                                  key={idx}
                                  d={contourToSvgPathData(c)}
                                  fill="currentColor"
                                  fillRule="nonzero"
                                  opacity="0.88"
                                />
                              ))}
                            </g>
                          </svg>
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="mt-1 flex items-center justify-center gap-2 text-[10.5px] font-mono text-stone-600 dark:text-stone-300">
                  <span>オフセット: ({adjustDx}, {adjustDy})</span>
                  <span>・</span>
                  <span>倍率: {adjustScaleX}%×{adjustScaleY}%</span>
                </div>
              </div>

              {/* 1. Coordinate Position Offset (座標位置 X / Y) */}
              <div className={`p-3 rounded-xl border ${isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/30 border-emerald-900/60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs flex items-center space-x-1 text-emerald-900 dark:text-emerald-200">
                    <Move className="w-3.5 h-3.5 text-emerald-600" />
                    <span>位置オフセット (X/Y)</span>
                  </span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={handleAutoCenterGlyph}
                      className="h-6 px-2 inline-flex items-center justify-center rounded border border-emerald-400 bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 text-xs font-bold hover:bg-emerald-200 transition-colors"
                      title="文字をEM枠中央に自動整列"
                    >
                      中央整列
                    </button>
                    <button
                      onClick={() => { setAdjustDx(0); setAdjustDy(0); }}
                      className="h-6 px-2 inline-flex items-center justify-center rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-mono transition-colors"
                      title="位置を0リセット"
                    >
                      0
                    </button>
                  </div>
                </div>

                {/* Direct Number Input Fields & Sliders */}
                <div className="flex flex-col space-y-2.5">
                  <div className="space-y-2.5 text-xs">
                    {/* Direct Input & Slider X */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 font-mono font-bold text-xs shrink-0">X:</span>
                      <button
                        type="button"
                        onClick={() => setAdjustDx((prev) => Math.max(-200, prev - 5))}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="h-6 w-6 inline-flex items-center justify-center rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors shrink-0 select-none cursor-pointer"
                        title="-5px"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={-200}
                        max={200}
                        value={adjustDx}
                        onChange={(e) => setAdjustDx(Number(e.target.value))}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="flex-1 accent-emerald-600 cursor-pointer h-3 touch-action-none relative z-10"
                      />
                      <button
                        type="button"
                        onClick={() => setAdjustDx((prev) => Math.min(200, prev + 5))}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="h-6 w-6 inline-flex items-center justify-center rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors shrink-0 select-none cursor-pointer"
                        title="+5px"
                      >
                        +
                      </button>
                      <input
                        type="number"
                        value={adjustDx}
                        onChange={(e) => setAdjustDx(Number(e.target.value) || 0)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className={`w-14 px-1 py-0.5 rounded border text-right font-mono font-bold text-xs shrink-0 ${
                          isLight ? 'bg-white border-stone-300 text-stone-900' : 'bg-[#18231c] border-stone-700 text-emerald-100'
                        }`}
                      />
                      <span className="text-[10px] text-stone-500 font-mono shrink-0">px</span>
                    </div>

                    {/* Direct Input & Slider Y */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 font-mono font-bold text-xs shrink-0">Y:</span>
                      <button
                        type="button"
                        onClick={() => setAdjustDy((prev) => Math.max(-200, prev - 5))}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="h-6 w-6 inline-flex items-center justify-center rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors shrink-0 select-none cursor-pointer"
                        title="-5px"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={-200}
                        max={200}
                        value={adjustDy}
                        onChange={(e) => setAdjustDy(Number(e.target.value))}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="flex-1 accent-emerald-600 cursor-pointer h-3 touch-action-none relative z-10"
                      />
                      <button
                        type="button"
                        onClick={() => setAdjustDy((prev) => Math.min(200, prev + 5))}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="h-6 w-6 inline-flex items-center justify-center rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors shrink-0 select-none cursor-pointer"
                        title="+5px"
                      >
                        +
                      </button>
                      <input
                        type="number"
                        value={adjustDy}
                        onChange={(e) => setAdjustDy(Number(e.target.value) || 0)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className={`w-14 px-1 py-0.5 rounded border text-right font-mono font-bold text-xs shrink-0 ${
                          isLight ? 'bg-white border-stone-300 text-stone-900' : 'bg-[#18231c] border-stone-700 text-emerald-100'
                        }`}
                      />
                      <span className="text-[10px] text-stone-500 font-mono shrink-0">px</span>
                    </div>

                    {/* Micro adjustment button rows for X and Y */}
                    <div className="space-y-1.5 pt-1.5 border-t border-emerald-200/50 dark:border-emerald-900/40 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 font-semibold shrink-0 text-[11px]">X微調整:</span>
                        <div className="flex items-center space-x-1 font-mono overflow-x-auto no-scrollbar py-0.5">
                          {[-20, -10, -1, 1, 10, 20].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setAdjustDx((prev) => prev + val)}
                              onPointerDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              className="h-6 px-2 inline-flex items-center justify-center rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer text-[10.5px] whitespace-nowrap font-mono"
                              title={`X座標 ${val > 0 ? '+' : ''}${val}`}
                            >
                              {val > 0 ? `+${val}` : val}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 font-semibold shrink-0 text-[11px]">Y微調整:</span>
                        <div className="flex items-center space-x-1 font-mono overflow-x-auto no-scrollbar py-0.5">
                          {[-20, -10, -1, 1, 10, 20].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setAdjustDy((prev) => prev + val)}
                              onPointerDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              className="h-6 px-2 inline-flex items-center justify-center rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer text-[10.5px] whitespace-nowrap font-mono"
                              title={`Y座標 ${val > 0 ? '+' : ''}${val}`}
                            >
                              {val > 0 ? `+${val}` : val}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Scale & Aspect Ratio (拡縮・縦横比) */}
              <div className={`p-3 rounded-xl border ${isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/30 border-emerald-900/60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs flex items-center space-x-1 text-emerald-900 dark:text-emerald-200">
                    <Scaling className="w-3.5 h-3.5 text-emerald-600" />
                    <span>拡大縮小 & 縦横比</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAspectLocked(!isAspectLocked)}
                    className={`h-6 px-2 rounded border inline-flex items-center space-x-1 text-[10.5px] transition-colors cursor-pointer ${
                      isAspectLocked
                        ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                        : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                    title="縦横比固定切替"
                  >
                    {isAspectLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    <span>{isAspectLocked ? '縦横固定' : '自由変形'}</span>
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  {/* Width % Slider + Number Input + Stepper */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 font-mono font-bold text-xs shrink-0">幅:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(40, adjustScaleX - 5);
                        setAdjustScaleX(val);
                        if (isAspectLocked) setAdjustScaleY(val);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="h-6 w-6 inline-flex items-center justify-center rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors shrink-0 select-none cursor-pointer"
                      title="-5%"
                    >
                      -
                    </button>
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
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="flex-1 accent-emerald-600 cursor-pointer h-3 touch-action-none relative z-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.min(200, adjustScaleX + 5);
                        setAdjustScaleX(val);
                        if (isAspectLocked) setAdjustScaleY(val);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="h-6 w-6 inline-flex items-center justify-center rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors shrink-0 select-none cursor-pointer"
                      title="+5%"
                    >
                      +
                    </button>
                    <input
                      type="number"
                      value={adjustScaleX}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 100;
                        setAdjustScaleX(val);
                        if (isAspectLocked) setAdjustScaleY(val);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className={`w-14 px-1 py-0.5 rounded border text-right font-mono font-bold text-xs shrink-0 ${
                        isLight ? 'bg-white border-stone-300 text-stone-900' : 'bg-[#18231c] border-stone-700 text-emerald-100'
                      }`}
                    />
                    <span className="text-[10px] text-stone-500 font-mono shrink-0">%</span>
                  </div>

                  {/* Height % Slider + Number Input + Stepper */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 font-mono font-bold text-xs shrink-0">高:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(40, adjustScaleY - 5);
                        setAdjustScaleY(val);
                        if (isAspectLocked) setAdjustScaleX(val);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="h-6 w-6 inline-flex items-center justify-center rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors shrink-0 select-none cursor-pointer"
                      title="-5%"
                    >
                      -
                    </button>
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
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="flex-1 accent-emerald-600 cursor-pointer h-3 touch-action-none relative z-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.min(200, adjustScaleY + 5);
                        setAdjustScaleY(val);
                        if (isAspectLocked) setAdjustScaleX(val);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="h-6 w-6 inline-flex items-center justify-center rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors shrink-0 select-none cursor-pointer"
                      title="+5%"
                    >
                      +
                    </button>
                    <input
                      type="number"
                      value={adjustScaleY}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 100;
                        setAdjustScaleY(val);
                        if (isAspectLocked) setAdjustScaleX(val);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className={`w-14 px-1 py-0.5 rounded border text-right font-mono font-bold text-xs shrink-0 ${
                        isLight ? 'bg-white border-stone-300 text-stone-900' : 'bg-[#18231c] border-stone-700 text-emerald-100'
                      }`}
                    />
                    <span className="text-[10px] text-stone-500 font-mono shrink-0">%</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-emerald-200/50 dark:border-emerald-900/40">
                    <div className="flex items-center space-x-1 font-mono overflow-x-auto no-scrollbar py-0.5">
                      {[85, 90, 95, 100, 105, 110, 115].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { setAdjustScaleX(s); setAdjustScaleY(s); }}
                          className={`h-6 px-2 inline-flex items-center justify-center rounded text-[10.5px] font-mono border whitespace-nowrap ${
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
                      type="button"
                      onClick={() => { setAdjustScaleX(100); setAdjustScaleY(100); }}
                      className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline shrink-0 ml-2 font-semibold"
                    >
                      等倍
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Canvas Jump Button */}
              {onSelectGlyphForEdit && (
                <button
                  type="button"
                  onClick={handleJumpToMainEditor}
                  className="w-full py-2 px-2.5 rounded-lg text-xs font-bold border flex items-center justify-center space-x-1.5 transition-colors border-emerald-600 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                  title="この文字をメインキャンバスで開いて本格パス編集を行います"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>メイン編集でパス直接調整</span>
                </button>
              )}
            </div>

            {/* Bottom Actions: Save & Reset */}
            <div className="pt-2.5 mt-2 border-t border-inherit space-y-2 shrink-0">
              <button
                type="button"
                onClick={handleApplyTransformToGlyph}
                disabled={adjustDx === 0 && adjustDy === 0 && adjustScaleX === 100 && adjustScaleY === 100}
                className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                  adjustDx === 0 && adjustDy === 0 && adjustScaleX === 100 && adjustScaleY === 100
                    ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-98 shadow-sm'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>「{selectedCharInfo.char}」の輪郭に永続保存</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustDx(0);
                    setAdjustDy(0);
                    setAdjustScaleX(100);
                    setAdjustScaleY(100);
                  }}
                  className="flex-1 py-2 px-2 rounded-lg text-xs font-medium border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors text-center"
                >
                  微調整をリセット
                </button>

                <button
                  type="button"
                  onClick={() => setMobileTab('preview')}
                  className="md:hidden flex-1 py-2 px-2 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-200 transition-colors text-center"
                >
                  プレビュー確認
                </button>
              </div>
            </div>
          </>
        )}
      </>
    );

    if (isMobileScreen) {
      return (
        <div
          className={`w-full h-full flex flex-col overflow-y-auto p-3.5 pb-20 transition-colors custom-scrollbar ${
            isLight
              ? 'bg-[#f7faf8] text-stone-800'
              : 'bg-[#121c15] text-emerald-100'
          } ${mobileTab !== 'adjust' ? 'hidden md:flex' : 'flex'}`}
        >
          {panelContent}
        </div>
      );
    }

    if (isDocked) {
      return (
        <aside
          style={{ width: `${rightAdjusterWidth}px` }}
          className={`border-l shrink-0 flex flex-col h-full overflow-y-auto p-3 sm:p-3.5 transition-colors z-20 shadow-xl custom-scrollbar max-w-full ${
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
        style={{ left: `${floatingPos.x}px`, top: `${floatingPos.y}px`, width: `${rightAdjusterWidth}px` }}
        className={`absolute z-40 max-h-[calc(100%-2rem)] rounded-2xl border shadow-2xl backdrop-blur-md flex flex-col p-3 sm:p-3.5 transition-shadow ${
          isDragging ? ' ring-2 ring-emerald-500 cursor-grabbing' : ''
        } ${
          isLight
            ? 'bg-white/95 border-stone-200 text-stone-800 '
            : 'bg-[#121c15]/95 border-[#233527] text-emerald-100 '
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
            ? 'w-full sm:max-w-7xl border border-[#c8ded3] rounded-none sm:rounded-xl shadow-2xl h-[100vh] sm:h-[95vh] max-h-none sm:max-h-[960px] bg-[#f7faf8] text-stone-800'
            : 'w-full sm:max-w-7xl border border-[#25362b] rounded-none sm:rounded-xl shadow-2xl h-[100vh] sm:h-[95vh] max-h-none sm:max-h-[960px] bg-[#141c16] text-emerald-100'
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
              <span className="sm:hidden">組版テスト</span>
              <span className="hidden sm:inline">組版テスト・試し打ちシミュレーター</span>
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
                type="button"
                onClick={handleBatchCenterAll}
                className={`h-7 px-2.5 rounded-md text-xs font-semibold border transition-colors hidden lg:flex items-center space-x-1 ${
                  isLight
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 '
                    : 'bg-amber-950/70 hover:bg-amber-900/70 text-amber-200 border-amber-800 '
                }`}
                title="フォント内の全文字の左右余白を中央に整列してプロジェクトに反映します (※小文字・記号は自動保護)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>全文字中央整列</span>
              </button>
            )}

            {/* Hint toggle */}
            <button
              type="button"
              onClick={() => setShowHintBanner(!showHintBanner)}
              className={`h-7 px-2 sm:px-2.5 rounded-md text-xs font-medium border transition-colors flex items-center space-x-1 ${
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

            {/* Desktop Layout switch: Split vs Top */}
            <div
              className={`hidden md:flex items-center h-7 p-0.5 rounded-md border ${
                isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#101712] border-[#25362b]'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setLayoutMode('split');
                  setIsSidebarOpen(true);
                }}
                className={`h-6 px-2 rounded text-xs font-semibold flex items-center space-x-1 transition-all ${
                  layoutMode === 'split'
                    ? isLight
                      ? 'bg-emerald-800 text-white '
                      : 'bg-emerald-500 text-stone-950 '
                    : isLight
                    ? 'text-stone-600 hover:text-stone-900'
                    : 'text-emerald-400 hover:text-emerald-200'
                }`}
                title="左右分割モード: 左に設定、右に縦フルハイトの広大な文字プレビュー用紙を表示"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>左右分割</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('top')}
                className={`h-6 px-2 rounded text-xs font-semibold flex items-center space-x-1 transition-all ${
                  layoutMode === 'top'
                    ? isLight
                      ? 'bg-emerald-800 text-white '
                      : 'bg-emerald-500 text-stone-950 '
                    : isLight
                    ? 'text-stone-600 hover:text-stone-900'
                    : 'text-emerald-400 hover:text-emerald-200'
                }`}
                title="上下配置モード: 上にツールバー、下にプレビュー用紙を表示"
              >
                <Rows className="w-3.5 h-3.5" />
                <span>上下配置</span>
              </button>
            </div>

            {/* Desktop Sidebar toggle or Top Collapse toggle */}
            {layoutMode === 'split' ? (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`hidden md:flex h-7 px-2.5 rounded-md border text-xs font-semibold items-center space-x-1 transition-all ${
                  !isSidebarOpen
                    ? 'bg-emerald-600 text-white border-emerald-600 '
                    : isLight
                    ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-50'
                    : 'bg-[#1c2920] border-[#25362b] text-emerald-200 hover:bg-[#25362b]'
                }`}
                title={isSidebarOpen ? '設定パネルを隠して文字プレビューを全幅表示' : '設定パネルを表示'}
              >
                {isSidebarOpen ? (
                  <>
                    <PanelLeftClose className="w-3.5 h-3.5" />
                    <span>パネル収納</span>
                  </>
                ) : (
                  <>
                    <PanelLeftOpen className="w-3.5 h-3.5" />
                    <span>設定パネル</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsTopControlsCollapsed(!isTopControlsCollapsed)}
                className={`hidden md:flex h-7 px-2.5 rounded-md border text-xs font-semibold items-center space-x-1 transition-all ${
                  isTopControlsCollapsed
                    ? 'bg-emerald-600 text-white border-emerald-600 '
                    : isLight
                    ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-50'
                    : 'bg-[#1c2920] border-[#25362b] text-emerald-200 hover:bg-[#25362b]'
                }`}
                title={isTopControlsCollapsed ? '上部設定バーを展開' : '上部バーを最小化'}
              >
                {isTopControlsCollapsed ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>設定展開</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>文字集中表示</span>
                  </>
                )}
              </button>
            )}

            {/* Desktop Fine-Tuning Side Adjuster Toggle */}
            <button
              type="button"
              onClick={() => setIsSideAdjusterOpen(!isSideAdjusterOpen)}
              className={`hidden md:flex h-7 px-2.5 rounded-md border text-xs font-semibold items-center space-x-1 transition-all ${
                isSideAdjusterOpen
                  ? 'bg-emerald-600 text-white border-emerald-600 '
                  : isLight
                  ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-50'
                  : 'bg-[#1c2920] border-[#25362b] text-emerald-200 hover:bg-[#25362b]'
              }`}
              title={isSideAdjusterOpen ? '文字微調整パネルを閉じる' : '文字微調整パネルを表示'}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>微調整パネル</span>
            </button>

            {/* Fullscreen Toggle Button */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`h-7 px-2 sm:px-2.5 rounded-md border text-xs font-semibold flex items-center space-x-1 transition-all ${
                isFullscreen
                  ? 'bg-emerald-600 text-white border-emerald-600 '
                  : isLight
                  ? 'bg-white border-[#d8e6df] text-stone-700 hover:bg-emerald-50 hover:text-emerald-900 '
                  : 'bg-[#1c2920] border-[#25362b] text-emerald-200 hover:bg-[#25362b] '
              }`}
              title={isFullscreen ? '通常表示に戻す (F / Esc)' : '全画面表示モードに切り替え (F)'}
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
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-md hover:bg-emerald-100 dark:hover:bg-[#25362b] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors inline-flex items-center justify-center"
              title="閉じる (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Tab Navigation Bar (Visible only on mobile md:hidden) */}
        <div className="flex md:hidden border-b border-emerald-200/60 dark:border-[#223326] bg-[#edf5f0] dark:bg-[#121c15] shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center space-x-1.5 border-b-2 transition-all ${
              mobileTab === 'preview'
                ? isLight
                  ? 'border-emerald-700 text-emerald-950 bg-white/70 shadow-xs'
                  : 'border-emerald-400 text-emerald-100 bg-emerald-950/60 shadow-xs'
                : isLight
                ? 'border-transparent text-stone-600 hover:text-stone-900'
                : 'border-transparent text-emerald-400/80 hover:text-emerald-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>用紙プレビュー</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('settings')}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center space-x-1.5 border-b-2 transition-all ${
              mobileTab === 'settings'
                ? isLight
                  ? 'border-emerald-700 text-emerald-950 bg-white/70 shadow-xs'
                  : 'border-emerald-400 text-emerald-100 bg-emerald-950/60 shadow-xs'
                : isLight
                ? 'border-transparent text-stone-600 hover:text-stone-900'
                : 'border-transparent text-emerald-400/80 hover:text-emerald-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>文章・組版設定</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSideAdjusterOpen(true);
              setMobileTab('adjust');
            }}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center space-x-1.5 border-b-2 transition-all ${
              mobileTab === 'adjust'
                ? isLight
                  ? 'border-emerald-700 text-emerald-950 bg-white/70 shadow-xs'
                  : 'border-emerald-400 text-emerald-100 bg-emerald-950/60 shadow-xs'
                : isLight
                ? 'border-transparent text-stone-600 hover:text-stone-900'
                : 'border-transparent text-emerald-400/80 hover:text-emerald-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="truncate max-w-[90px]">
              {selectedCharInfo ? `「${selectedCharInfo.char}」微調整` : '文字微調整'}
            </span>
            {selectedCharInfo && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
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
              type="button"
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
          <div ref={mainContainerRef} className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
            {/* Left Control Sidebar */}
            {(isSidebarOpen || isMobileScreen) && (
              <div
                style={{ width: isMobileScreen ? '100%' : `${leftSidebarWidth}px` }}
                className={`w-full md:w-auto h-full border-b md:border-b-0 md:border-r flex flex-col shrink-0 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar max-w-full pb-16 md:pb-0 ${
                  isLight ? 'bg-[#f7faf8] border-[#d8e6df]' : 'bg-[#131b15] border-[#25362b]'
                } ${mobileTab !== 'settings' ? 'hidden md:flex' : 'flex'}`}
              >
                {/* 1. Text Input & Presets */}
                <div className="p-3 sm:p-3.5 border-b border-inherit">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`text-xs font-bold flex items-center space-x-1 ${isLight ? 'text-emerald-950' : 'text-emerald-200'}`}>
                      <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>テスト文章</span>
                    </label>
                    <span className={`text-[10px] font-mono ${isLight ? 'text-stone-500' : 'text-emerald-500'}`}>
                      {testText.length} 文字
                    </span>
                  </div>

                  {/* Preset Quick Horizontal Chips */}
                  <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar pb-1 mb-2">
                    {SAMPLE_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTestText(preset.text);
                          setWritingMode(preset.mode);
                        }}
                        className={`px-2 py-1 rounded text-[10.5px] font-medium shrink-0 border transition-all whitespace-nowrap ${
                          testText === preset.text
                            ? isLight
                              ? 'bg-emerald-700 text-white border-emerald-800 font-bold'
                              : 'bg-emerald-500 text-stone-950 border-emerald-400 font-bold'
                            : isLight
                            ? 'bg-white border-stone-200 text-stone-600 hover:bg-emerald-50'
                            : 'bg-[#18231c] border-[#2b3d30] text-emerald-300 hover:bg-[#202d24]'
                        }`}
                      >
                        {preset.name.replace(/【.*?】/, '').split(' ')[0] || preset.name}
                      </button>
                    ))}
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
                      className={`w-full text-xs p-2 rounded-lg border ${
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
                    rows={3}
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="ここにテストしたい文章を入力..."
                    className={`w-full border rounded-lg p-2.5 text-xs focus:outline-none select-text transition-colors leading-relaxed ${
                      isLight
                        ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                        : 'bg-[#18231c] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                    }`}
                  />
                </div>

                {/* 2. Typesetting Parameters */}
                <div className="p-3 sm:p-3.5 border-b border-inherit flex flex-col space-y-3">
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
                      className={`grid grid-cols-2 p-0.5 rounded-lg border ${
                        isLight ? 'bg-[#edf5f0] border-[#c8ded3]' : 'bg-[#101712] border-[#25362b]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setWritingMode('horizontal')}
                        className={`py-1.5 rounded-md text-xs font-bold transition-all text-center ${
                          writingMode === 'horizontal'
                            ? isLight
                              ? 'bg-emerald-800 text-white '
                              : 'bg-emerald-500 text-stone-950 '
                            : isLight
                            ? 'text-stone-600 hover:text-stone-900'
                            : 'text-emerald-400 hover:text-emerald-200'
                        }`}
                      >
                        横組み (横書き)
                      </button>
                      <button
                        type="button"
                        onClick={() => setWritingMode('vertical')}
                        className={`py-1.5 rounded-md text-xs font-bold transition-all text-center ${
                          writingMode === 'vertical'
                            ? isLight
                              ? 'bg-emerald-800 text-white '
                              : 'bg-emerald-500 text-stone-950 '
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
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setFontSize((prev) => Math.max(12, prev - 2))}
                        className="h-7 w-7 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950 shrink-0 inline-flex items-center justify-center"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={14}
                        max={96}
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="flex-1 accent-emerald-700 h-3"
                      />
                      <button
                        type="button"
                        onClick={() => setFontSize((prev) => Math.min(96, prev + 2))}
                        className="h-7 w-7 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950 shrink-0 inline-flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Line Height */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className={isLight ? 'text-stone-600' : 'text-emerald-400'}>行送り:</span>
                      <span className={`font-mono font-bold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                        {lineHeight.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setLineHeight((prev) => Math.max(1.0, Math.round((prev - 0.1) * 10) / 10))}
                        className="h-7 w-7 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950 shrink-0 inline-flex items-center justify-center"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={1.2}
                        max={3.0}
                        step={0.1}
                        value={lineHeight}
                        onChange={(e) => setLineHeight(Number(e.target.value))}
                        className="flex-1 accent-emerald-700 h-3"
                      />
                      <button
                        type="button"
                        onClick={() => setLineHeight((prev) => Math.min(3.5, Math.round((prev + 0.1) * 10) / 10))}
                        className="h-7 w-7 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950 shrink-0 inline-flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Letter Spacing */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className={isLight ? 'text-stone-600' : 'text-emerald-400'}>字間:</span>
                      <span className={`font-mono font-bold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                        {letterSpacing >= 0 ? `+${letterSpacing.toFixed(2)}` : letterSpacing.toFixed(2)} em
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setLetterSpacing((prev) => Math.max(-0.1, Math.round((prev - 0.02) * 100) / 100))}
                        className="h-7 w-7 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950 shrink-0 inline-flex items-center justify-center"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={-0.05}
                        max={0.5}
                        step={0.02}
                        value={letterSpacing}
                        onChange={(e) => setLetterSpacing(Number(e.target.value))}
                        className="flex-1 accent-emerald-700 h-3"
                      />
                      <button
                        type="button"
                        onClick={() => setLetterSpacing((prev) => Math.min(0.8, Math.round((prev + 0.02) * 100) / 100))}
                        className="h-7 w-7 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950 shrink-0 inline-flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Text Align */}
                  <div>
                    <span className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-stone-600' : 'text-emerald-300'}`}>
                      配置・揃え:
                    </span>
                    <div
                      className={`grid grid-cols-4 p-0.5 rounded-lg border ${
                        isLight ? 'bg-[#edf5f0] border-[#c8ded3]' : 'bg-[#101712] border-[#25362b]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setTextAlign('left')}
                        title="左揃え / 天揃え"
                        className={`p-1.5 rounded-md flex justify-center transition-colors ${
                          textAlign === 'left'
                            ? isLight
                              ? 'bg-emerald-800 text-white'
                              : 'bg-emerald-500 text-stone-950 font-bold'
                            : isLight
                            ? 'text-stone-600 hover:text-stone-900'
                            : 'text-emerald-400 hover:text-emerald-200'
                        }`}
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTextAlign('center')}
                        title="中央揃え"
                        className={`p-1.5 rounded-md flex justify-center transition-colors ${
                          textAlign === 'center'
                            ? isLight
                              ? 'bg-emerald-800 text-white'
                              : 'bg-emerald-500 text-stone-950 font-bold'
                            : isLight
                            ? 'text-stone-600 hover:text-stone-900'
                            : 'text-emerald-400 hover:text-emerald-200'
                        }`}
                      >
                        <AlignCenter className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTextAlign('right')}
                        title="右揃え / 地揃え"
                        className={`p-1.5 rounded-md flex justify-center transition-colors ${
                          textAlign === 'right'
                            ? isLight
                              ? 'bg-emerald-800 text-white'
                              : 'bg-emerald-500 text-stone-950 font-bold'
                            : isLight
                            ? 'text-stone-600 hover:text-stone-900'
                            : 'text-emerald-400 hover:text-emerald-200'
                        }`}
                      >
                        <AlignRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTextAlign('justify')}
                        title="均等割り付け"
                        className={`p-1.5 rounded-md flex justify-center transition-colors ${
                          textAlign === 'justify'
                            ? isLight
                              ? 'bg-emerald-800 text-white'
                              : 'bg-emerald-500 text-stone-950 font-bold'
                            : isLight
                            ? 'text-stone-600 hover:text-stone-900'
                            : 'text-emerald-400 hover:text-emerald-200'
                        }`}
                      >
                        <AlignJustify className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Display & Optimization Toggles (Compact 2-col Grid, no multiline blowout) */}
                <div className="p-3 sm:p-3.5 flex flex-col space-y-2.5">
                  <div className={`text-xs font-bold flex items-center justify-between ${isLight ? 'text-emerald-950' : 'text-emerald-200'}`}>
                    <div className="flex items-center space-x-1">
                      <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>表示・補正オプション</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {/* 和文拡大 135% */}
                    <button
                      type="button"
                      onClick={() => setFontScaleMultiplier(fontScaleMultiplier === 1.35 ? 1.0 : 1.35)}
                      className={`p-2 h-14 rounded-lg border text-left transition-all flex flex-col justify-between ${
                        fontScaleMultiplier === 1.35
                          ? isLight
                            ? 'bg-emerald-100/90 text-emerald-950 border-emerald-400 font-bold'
                            : 'bg-emerald-950 text-emerald-200 border-emerald-600 font-bold'
                          : isLight
                          ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                          : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
                      }`}
                    >
                      <span className="text-[11px] truncate">和文サイズ最適化</span>
                      <span className="text-[10px] font-mono mt-0.5 opacity-80">
                        {fontScaleMultiplier === 1.35 ? '135% 拡大中' : '100% 原寸'}
                      </span>
                    </button>

                    {/* 配置モード (センタリング / ガイド優先) */}
                    <button
                      type="button"
                      onClick={() => setAutoBalanceMargins(!autoBalanceMargins)}
                      className={`p-2 h-14 rounded-lg border text-left transition-all flex flex-col justify-between ${
                        autoBalanceMargins
                          ? isLight
                            ? 'bg-amber-100 text-amber-950 border-amber-400 font-bold'
                            : 'bg-amber-950 text-amber-200 border-amber-600 font-bold'
                          : isLight
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-medium'
                          : 'bg-emerald-950/70 text-emerald-300 border-emerald-800 font-medium'
                      }`}
                    >
                      <span className="text-[11px] truncate">配置補正</span>
                      <span className="text-[10px] truncate mt-0.5 opacity-80">
                        {autoBalanceMargins ? '左右センタリング' : 'ガイド位置優先'}
                      </span>
                    </button>

                    {/* 仮想ボディ枠 */}
                    <button
                      type="button"
                      onClick={() => setShowCharBoxes(!showCharBoxes)}
                      className={`p-2 h-14 rounded-lg border text-left transition-all flex flex-col justify-between ${
                        showCharBoxes
                          ? isLight
                            ? 'bg-emerald-800 text-white border-emerald-900 font-bold'
                            : 'bg-emerald-500 text-stone-950 font-bold border-emerald-400'
                          : isLight
                          ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                          : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
                      }`}
                    >
                      <span className="text-[11px] truncate">仮想ボディ枠</span>
                      <span className="text-[10px] font-mono mt-0.5 opacity-80">{showCharBoxes ? 'ON (1em枠)' : 'OFF'}</span>
                    </button>

                    {/* ノートガイド */}
                    <button
                      type="button"
                      onClick={() => setShowNotebookGuides(!showNotebookGuides)}
                      className={`p-2 h-14 rounded-lg border text-left transition-all flex flex-col justify-between ${
                        showNotebookGuides
                          ? isLight
                            ? 'bg-emerald-800 text-white border-emerald-900 font-bold'
                            : 'bg-emerald-500 text-stone-950 font-bold border-emerald-400'
                          : isLight
                          ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                          : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
                      }`}
                    >
                      <span className="text-[11px] truncate">ノートガイド線</span>
                      <span className="text-[10px] font-mono mt-0.5 opacity-80">{showNotebookGuides ? 'ON (ベース線)' : 'OFF'}</span>
                    </button>

                    {/* 原稿用紙 */}
                    <button
                      type="button"
                      onClick={() => setShowGenkoGrid(!showGenkoGrid)}
                      className={`p-2 h-14 rounded-lg border text-left transition-all flex flex-col justify-between ${
                        showGenkoGrid
                          ? isLight
                            ? 'bg-emerald-800 text-white border-emerald-900 font-bold'
                            : 'bg-emerald-500 text-stone-950 font-bold border-emerald-400'
                          : isLight
                          ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                          : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
                      }`}
                    >
                      <span className="text-[11px] truncate">原稿用紙・方眼</span>
                      <span className="text-[10px] font-mono mt-0.5 opacity-80">{showGenkoGrid ? 'ON' : 'OFF'}</span>
                    </button>

                    {/* 空白マーク */}
                    <button
                      type="button"
                      onClick={() => setShowSpaceMarkers(!showSpaceMarkers)}
                      className={`p-2 h-14 rounded-lg border text-left transition-all flex flex-col justify-between ${
                        showSpaceMarkers
                          ? isLight
                            ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                            : 'bg-amber-950 border-amber-700 text-amber-300 font-bold'
                          : isLight
                          ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                          : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
                      }`}
                    >
                      <span className="text-[11px] truncate">空白マーク</span>
                      <span className="text-[10px] font-mono mt-0.5 opacity-80">{showSpaceMarkers ? 'ON (全角/半角)' : 'OFF'}</span>
                    </button>

                    {/* 段階サイズ (ウォーターフォール) */}
                    <button
                      type="button"
                      onClick={() => setIsWaterfall(!isWaterfall)}
                      className={`col-span-2 p-2 h-12 rounded-lg border text-left transition-all flex items-center justify-between ${
                        isWaterfall
                          ? isLight
                            ? 'bg-emerald-800 text-white border-emerald-900 font-bold'
                            : 'bg-emerald-500 text-stone-950 font-bold border-emerald-400'
                          : isLight
                          ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                          : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
                      }`}
                    >
                      <span className="text-[11px] truncate">段階サイズ (ウォーターフォール表示)</span>
                      <span className="text-[10px] font-mono opacity-80">{isWaterfall ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>

                  {/* Mobile Return to Preview Button */}
                  <div className="pt-2 md:hidden">
                    <button
                      type="button"
                      onClick={() => setMobileTab('preview')}
                      className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>プレビュー結果を見る</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Drag Resizer Left */}
            {isSidebarOpen && !isMobileScreen && (
              <div
                onPointerDown={handleLeftResizePointerDown}
                onPointerMove={handleLeftResizePointerMove}
                onPointerUp={handleLeftResizePointerUp}
                onDoubleClick={() => setLeftSidebarWidth(280)}
                className="hidden md:flex w-1.5 hover:w-2 bg-transparent hover:bg-emerald-500/40 active:bg-emerald-500 cursor-col-resize shrink-0 transition-all z-30 group items-center justify-center select-none"
                title="ドラッグで左設定パネルの幅を調整 (ダブルクリックで初期幅280pxにリセット)"
              >
                <div className="w-0.5 h-8 bg-stone-300 dark:bg-stone-700 group-hover:bg-emerald-400 rounded-full" />
              </div>
            )}

            {/* Right: Full-Height Proofing Canvas Area */}
            <div
              className={`flex-1 min-h-0 h-full overflow-auto overscroll-contain p-2.5 sm:p-8 select-text relative ${
                isLight ? 'bg-[#eef4f0]' : 'bg-[#0b100d]'
              } ${
                showGenkoGrid
                  ? isLight
                    ? 'bg-[radial-gradient(#c8ded3_1px,transparent_1px)] [background-size:24px_24px]'
                    : 'bg-[radial-gradient(#25362b_1px,transparent_1px)] [background-size:24px_24px]'
                  : ''
              } ${mobileTab !== 'preview' ? 'hidden md:flex flex-col' : 'flex flex-col'}`}
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
                <div className="w-full flex items-start min-h-full py-1 sm:py-2">
                  <div
                    onWheel={handleVerticalWheel}
                    className={`transition-all rounded-lg shadow-sm border p-4 sm:p-12 mx-auto ${
                      writingMode === 'vertical'
                        ? 'min-w-[280px] sm:min-w-[360px] max-w-full overflow-x-auto overscroll-contain min-h-[calc(100dvh-260px)] md:min-h-[calc(100vh-220px)]'
                        : 'w-full max-w-3xl lg:max-w-4xl min-h-[calc(100dvh-260px)] md:min-h-[calc(100vh-220px)]'
                    } ${
                      isLight
                        ? 'bg-white border-[#d8e6df] '
                        : 'bg-[#151e18] border-[#25362b] '
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

                    <div className={`relative ${writingMode === 'vertical' ? 'w-max min-w-full' : 'w-full overflow-hidden'}`}>
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
                        className={`relative z-10 whitespace-pre-wrap select-text min-h-[300px] ${
                          isLight ? 'text-stone-900' : 'text-emerald-50'
                        } ${writingMode === 'vertical' ? 'h-full w-max break-normal' : 'w-full break-words'}`}
                      >
                        {renderedText}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Drag Resizer Right */}
            {isSideAdjusterOpen && isDocked && (
              <div
                onPointerDown={handleRightResizePointerDown}
                onPointerMove={handleRightResizePointerMove}
                onPointerUp={handleRightResizePointerUp}
                onDoubleClick={() => setRightAdjusterWidth(300)}
                className="hidden md:flex w-1.5 hover:w-2 bg-transparent hover:bg-emerald-500/40 active:bg-emerald-500 cursor-col-resize shrink-0 transition-all z-30 group items-center justify-center select-none"
                title="ドラッグで右微調整パネルの幅を調整 (ダブルクリックで初期幅300pxにリセット)"
              >
                <div className="w-0.5 h-8 bg-stone-300 dark:bg-stone-700 group-hover:bg-emerald-400 rounded-full" />
              </div>
            )}

            {/* Right Side Docked Glyph Adjuster Panel */}
            {isSideAdjusterOpen && renderSideAdjustPanel()}
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
                            ? 'bg-emerald-800 text-white border-emerald-900 font-bold '
                            : 'bg-emerald-500 text-stone-950 border-emerald-400 font-bold '
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
                              ? 'bg-emerald-800 text-white '
                              : 'bg-emerald-500 text-stone-950 '
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
                              ? 'bg-emerald-800 text-white '
                              : 'bg-emerald-500 text-stone-950 '
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
                <div className={`w-full flex items-start min-h-full ${isFullscreen ? 'py-4 sm:py-8' : 'py-2'}`}>
                  <div
                    onWheel={handleVerticalWheel}
                    className={`transition-all rounded-lg shadow-sm border mx-auto ${
                      isFullscreen ? 'p-6 sm:p-14' : 'p-4 sm:p-10'
                    } ${
                      writingMode === 'vertical'
                        ? isFullscreen
                          ? 'min-w-[280px] sm:min-w-[380px] max-w-full overflow-x-auto overscroll-contain h-full max-h-[calc(100vh-270px)]'
                          : 'min-w-[260px] sm:min-w-[320px] max-w-full overflow-x-auto overscroll-contain h-full max-h-[720px]'
                        : isFullscreen
                        ? 'w-full max-w-5xl xl:max-w-6xl min-h-[calc(100vh-320px)]'
                        : 'w-full max-w-3xl'
                    } ${
                      isLight
                        ? 'bg-white border-[#d8e6df] '
                        : 'bg-[#151e18] border-[#25362b] '
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

                    <div className={`relative ${writingMode === 'vertical' ? 'w-max min-w-full' : 'w-full overflow-hidden'}`}>
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
                        className={`relative z-10 whitespace-pre-wrap select-text min-h-[220px] ${
                          isLight ? 'text-stone-900' : 'text-emerald-50'
                        } ${writingMode === 'vertical' ? 'h-full w-max break-normal' : 'w-full break-words'}`}
                      >
                        {renderedText}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Drag Resizer Right */}
            {isSideAdjusterOpen && isDocked && (
              <div
                onPointerDown={handleRightResizePointerDown}
                onPointerMove={handleRightResizePointerMove}
                onPointerUp={handleRightResizePointerUp}
                onDoubleClick={() => setRightAdjusterWidth(300)}
                className="hidden md:flex w-1.5 hover:w-2 bg-transparent hover:bg-emerald-500/40 active:bg-emerald-500 cursor-col-resize shrink-0 transition-all z-30 group items-center justify-center select-none"
                title="ドラッグで右微調整パネルの幅を調整 (ダブルクリックで初期幅300pxにリセット)"
              >
                <div className="w-0.5 h-8 bg-stone-300 dark:bg-stone-700 group-hover:bg-emerald-400 rounded-full" />
              </div>
            )}

            {/* Right Side Docked Glyph Adjuster Panel */}
            {isSideAdjusterOpen && renderSideAdjustPanel()}
          </div>
        </>
      )}

        {/* Footer info bar & Hover Glyph Inspector */}
        <div
          className={`px-3 sm:px-4 py-1.5 sm:py-2 border-t flex items-center justify-between text-xs shrink-0 gap-2 ${
            isLight ? 'bg-[#edf5f0] border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <div className="flex items-center space-x-2 sm:space-x-3 text-[11px] overflow-x-auto min-w-0">
            {hoveredGlyphInfo ? (
              <div className="flex items-center space-x-1.5 font-mono whitespace-nowrap">
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  「{hoveredGlyphInfo.char}」
                </span>
                <span className="hidden sm:inline">(U+{hoveredGlyphInfo.unicode.toString(16).toUpperCase()})</span>
                <span>送り: {hoveredGlyphInfo.adv}</span>
                <span className="hidden sm:inline">左: {hoveredGlyphInfo.lsb}px</span>
                <span className="hidden sm:inline">右: {hoveredGlyphInfo.rsb}px</span>
                <span
                  className={`px-1 py-0.2 rounded text-[10px] font-bold ${
                    Math.abs(hoveredGlyphInfo.diff) <= 20
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {Math.abs(hoveredGlyphInfo.diff) <= 20
                    ? '均等'
                    : hoveredGlyphInfo.diff < 0
                    ? `左寄 (${Math.abs(Math.round(hoveredGlyphInfo.diff / 2))})`
                    : `右寄 (${Math.round(hoveredGlyphInfo.diff / 2)})`}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 whitespace-nowrap text-stone-600 dark:text-emerald-400">
                <span className="font-medium truncate max-w-[120px] sm:max-w-none">
                  {project.metadata.familyName || 'MyFont'}
                </span>
                <span className="font-mono text-stone-400">|</span>
                <span className="font-mono">
                  {writingMode === 'vertical' ? '縦組' : '横組'} ({fontSize}px)
                </span>
                <span className={`hidden sm:inline text-[10px] ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  {autoBalanceMargins ? '左右センタリング' : '位置優先'}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`h-7 px-2 sm:px-2.5 rounded-md text-xs font-semibold border transition-colors flex items-center space-x-1 ${
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
                  <span className="hidden sm:inline">通常表示</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">全画面</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`h-7 px-3 rounded-md text-xs font-semibold transition-colors ${
                isLight
                  ? 'bg-emerald-800 hover:bg-emerald-900 text-white '
                  : 'bg-emerald-700 hover:bg-emerald-600 text-white '
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
