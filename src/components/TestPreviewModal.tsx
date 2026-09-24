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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { FontProject } from '../types';
import { compileFont, balanceProjectGlyphMargins } from '../utils/fontCompiler';
import { getContoursBoundingBox } from '../utils/pathUtils';
import { ThemeMode, isLightTheme } from '../utils/theme';

interface TestPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: FontProject;
  setProject?: React.Dispatch<React.SetStateAction<FontProject>>;
  theme: ThemeMode;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const SAMPLE_PRESETS = [
  {
    name: '【横組】いろは歌 (ひらがな・パングラム)',
    mode: 'horizontal' as const,
    text: 'いろはにほへと ちりぬるを わかよたれそ つねならむ\nうゐのおくやま けふこえて あさきゆめみし ゑひもせす',
  },
  {
    name: '【縦組】いろは歌 (ひらがな・パングラム)',
    mode: 'vertical' as const,
    text: 'いろはにほへと\nちりぬるを\nわかよたれそ\nつねならむ\nうゐのおくやま\nけふこえて\nあさきゆめみし\nゑひもせす',
  },
  {
    name: '【横組】五十音・濁音・促音小文字',
    mode: 'horizontal' as const,
    text: 'あいうえお かきくけこ さしすせそ たちつてと なにぬねの\nはひふへほ まみむめも やゆよ らりるれろ わをん\nがぎぐげご ざじずぜぞ だぢづでど ばびぶべぼ ぱぴぷぺぽ\nぁぃぅぇぉ ゃゅょ ゎ っ ヵヶ ァィゥェォ ャュョ ッ',
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

export const TestPreviewModal: React.FC<TestPreviewModalProps> = ({
  isOpen,
  onClose,
  project,
  setProject,
  theme,
  onShowToast,
}) => {
  const [testText, setTestText] = useState<string>(
    'いろはにほへと ちりぬるを わかよたれそ つねならむ\nうゐのおくやま けふこえて あさきゆめみし ゑひもせす'
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
  const [autoBalanceMargins, setAutoBalanceMargins] = useState<boolean>(false); // デフォルト: ガイド枠の手書き位置優先 (1:1描画位置)
  const [fontScaleMultiplier, setFontScaleMultiplier] = useState<number>(1.35); // 1.35x (和文標準最適化) or 1.0x (原寸)
  const [isWaterfall, setIsWaterfall] = useState<boolean>(false);
  const [fontFamilyName, setFontFamilyName] = useState<string>('CustomTestFont');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Highlight space tokens or render character boxes
  const renderedText = useMemo(() => {
    const lines = testText.split('\n');

    return lines.map((line, lIdx) => {
      const parts = [];
      let currentStr = '';

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];

        if (ch === '　') {
          // 全角空白 U+3000
          if (currentStr) {
            parts.push(<span key={`${lIdx}-${i}-str`}>{currentStr}</span>);
            currentStr = '';
          }
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
          if (currentStr) {
            parts.push(<span key={`${lIdx}-${i}-str`}>{currentStr}</span>);
            currentStr = '';
          }
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
          // Character Box mode (仮想ボディ枠と中心線の表示)
          if (currentStr) {
            parts.push(<span key={`${lIdx}-${i}-str`}>{currentStr}</span>);
            currentStr = '';
          }
          const metric = getGlyphMetric(ch);
          parts.push(
            <span
              key={`${lIdx}-${i}-charbox`}
              onMouseEnter={() => metric && setHoveredGlyphInfo(metric)}
              className={`inline-flex items-center justify-center relative border border-dashed transition-all cursor-crosshair ${
                metric && Math.abs(metric.diff) > 25 && !autoBalanceMargins
                  ? 'border-amber-500 bg-amber-500/10'
                  : isLight
                  ? 'border-emerald-500/40 bg-emerald-50/25 hover:bg-emerald-100/40'
                  : 'border-emerald-400/40 bg-emerald-950/25 hover:bg-emerald-900/40'
              }`}
              style={{
                width: writingMode === 'vertical' ? undefined : '1em',
                height: '1em',
                lineHeight: '1em',
                textAlign: 'center',
                boxSizing: 'border-box',
              }}
              title={
                metric
                  ? `「${ch}」 送り幅:${metric.adv} 左余白:${metric.lsb} 右余白:${metric.rsb} (${
                      metric.diff === 0
                        ? '中央整列'
                        : metric.diff < 0
                        ? `左寄り ${Math.abs(Math.round(metric.diff / 2))}px`
                        : `右寄り ${Math.round(metric.diff / 2)}px`
                    })`
                  : `「${ch}」`
              }
            >
              {/* Center vertical crosshair */}
              <span className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-emerald-500/30 pointer-events-none" />
              {ch}
            </span>
          );
        } else {
          currentStr += ch;
        }
      }

      if (currentStr) {
        parts.push(<span key={`${lIdx}-end-str`}>{currentStr}</span>);
      }

      return (
        <React.Fragment key={lIdx}>
          {parts}
          {lIdx < lines.length - 1 ? '\n' : ''}
        </React.Fragment>
      );
    });
  }, [testText, showSpaceMarkers, showCharBoxes, autoBalanceMargins, isLight, writingMode, project]);

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
                      className={`whitespace-pre-wrap break-words min-h-[300px] ${
                        isLight ? 'text-stone-900' : 'text-emerald-50'
                      } ${writingMode === 'vertical' ? 'h-full' : 'w-full'}`}
                    >
                      {renderedText}
                    </div>
                  </div>
                </div>
              )}
            </div>
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

            {/* Main Proofing Stage */}
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
                      className={`whitespace-pre-wrap break-words min-h-[220px] ${
                        isLight ? 'text-stone-900' : 'text-emerald-50'
                      } ${writingMode === 'vertical' ? 'h-full' : 'w-full'}`}
                    >
                      {renderedText}
                    </div>
                  </div>
                </div>
              )}
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
