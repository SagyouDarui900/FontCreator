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
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { FontProject } from '../types';
import { compileFont, balanceProjectGlyphMargins } from '../utils/fontCompiler';
import { getContoursBoundingBox } from '../utils/pathUtils';
import { ThemeMode } from '../utils/theme';

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
    name: '【横組】いろは歌 (漢字・仮名交じり)',
    mode: 'horizontal' as const,
    text: '色は匂へど 散りぬるを 我が世誰ぞ 常ならむ\n有為の奥山 今日越えて 浅き夢見じ 酔ひもせず',
  },
  {
    name: '【横組】五十音・濁音・促音小文字',
    mode: 'horizontal' as const,
    text: 'あいうえお かきくけこ さしすせそ たちつてと なにぬねの\nはひふへほ まみむめも やゆよ らりるれろ わをん\nがぎぐげご ざじずぜぞ だぢづでど ばびぶべぼ ぱぴぷぺぽ\nぁぃぅぇぉ ゃゅょ ゎ っ ヵヶ ァィゥェォ ャュョ ッ',
  },
  {
    name: '【横組】見出しと本文 (全角空白字下げ)',
    mode: 'horizontal' as const,
    text: '【最新技術】手書き看板から自分だけの日本語フォントを作るWebアプリ\n　デジタル時代のタイポグラフィ制作において、文字の美しさと視認性の両立は欠かせません。\n　漢字・ひらがな・カタカナ・英数字に加え、全角空白（U+3000）の送り幅や、左右の余白（LSB/RSB）を厳密にシミュレーションできます。',
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
    '色は匂へど 散りぬるを 我が世誰ぞ 常ならむ\n有為の奥山 今日越えて 浅き夢見じ 酔ひもせず'
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

  const isLight = theme === 'light';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-5xl border rounded-lg shadow-2xl flex flex-col h-[94vh] max-h-[920px] overflow-hidden transition-colors ${
          isLight
            ? 'bg-[#f7faf8] border-[#c8ded3] text-stone-800'
            : 'bg-[#141c16] border-[#25362b] text-emerald-100'
        }`}
      >
        {/* Header Bar */}
        <div
          className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${
            isLight ? 'bg-[#edf5f0] border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Type className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            <h2 className={`font-bold text-sm sm:text-base ${isLight ? 'text-emerald-950' : 'text-emerald-200'}`}>
              組版テスト・試し打ちシミュレーター
            </h2>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-mono ${
                isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950 text-emerald-300'
              }`}
            >
              {Object.keys(project.glyphs || {}).length} グリフ登録済
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {setProject && (
              <button
                onClick={handleBatchCenterAll}
                className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors flex items-center space-x-1.5 ${
                  isLight
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                    : 'bg-amber-950/70 hover:bg-amber-900/70 text-amber-200 border-amber-800 shadow-xs'
                }`}
                title="フォント内の全文字の左右余白を中央に整列してプロジェクトに反映します (※小文字・記号は自動保護)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>全文字を中央整列して保存</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-emerald-100 dark:hover:bg-[#25362b] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
              title="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Informational Guidance Banner for Center Alignment & Guide Precision */}
        <div
          className={`px-3.5 py-1.5 text-[11px] border-b flex items-center justify-between shrink-0 ${
            isLight
              ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-900'
              : 'bg-emerald-950/50 border-emerald-900/60 text-emerald-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong>【中央揃え・手書きガイド位置のヒント】</strong> ガイド枠に合わせて丁寧に書いた文字は、<strong>『配置: ガイド描画位置優先』</strong>で描いたままの完璧な軸・字間になります。寄り癖がある場合のみ<strong>『左右強制センタリング (ON)』</strong>をご利用ください。（※小文字・句読点・括弧はレイアウト崩れを防ぐため強制センタリングから自動除外されます）
            </span>
          </div>
        </div>

        {/* Toolbar Row 1: Presets selection */}
        <div
          className={`px-3 py-2 border-b flex items-center space-x-2 overflow-x-auto text-xs shrink-0 ${
            isLight ? 'bg-[#f4f9f6] border-[#d8e6df]' : 'bg-[#121a14] border-[#25362b]'
          }`}
        >
          <span className={`text-[11px] font-semibold shrink-0 ${isLight ? 'text-stone-500' : 'text-emerald-400'}`}>
            例文プリセット:
          </span>
          {SAMPLE_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTestText(preset.text);
                setWritingMode(preset.mode);
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors border ${
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

        {/* Toolbar Row 2: Typesetting Parameters & Controls */}
        <div
          className={`p-2.5 border-b flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 ${
            isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#16201a] border-[#25362b]'
          }`}
        >
          {/* Writing Mode Selector (横書き ⇔ 縦書き) */}
          <div className="flex items-center space-x-1.5">
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
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
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
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
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

          {/* Size, Line-height, Letter-spacing sliders */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Font Size */}
            <div className="flex items-center space-x-1.5">
              <span className={`text-[11px] ${isLight ? 'text-stone-600' : 'text-emerald-400'}`}>サイズ:</span>
              <input
                type="range"
                min={14}
                max={96}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-16 sm:w-20 accent-emerald-700"
              />
              <span className={`font-mono w-7 text-[11px] ${isLight ? 'text-stone-700' : 'text-emerald-300'}`}>
                {fontSize}
              </span>
            </div>

            {/* Line Height (行送り) */}
            <div className="flex items-center space-x-1.5">
              <span className={`text-[11px] ${isLight ? 'text-stone-600' : 'text-emerald-400'}`}>行送り:</span>
              <input
                type="range"
                min={1.2}
                max={3.0}
                step={0.1}
                value={lineHeight}
                onChange={(e) => setLineHeight(Number(e.target.value))}
                className="w-14 sm:w-16 accent-emerald-700"
              />
              <span className={`font-mono w-7 text-[11px] ${isLight ? 'text-stone-700' : 'text-emerald-300'}`}>
                {lineHeight.toFixed(1)}
              </span>
            </div>

            {/* Letter Spacing (字送り) */}
            <div className="flex items-center space-x-1.5">
              <span className={`text-[11px] ${isLight ? 'text-stone-600' : 'text-emerald-400'}`}>字間:</span>
              <input
                type="range"
                min={-0.05}
                max={0.5}
                step={0.02}
                value={letterSpacing}
                onChange={(e) => setLetterSpacing(Number(e.target.value))}
                className="w-14 sm:w-16 accent-emerald-700"
              />
              <span className={`font-mono w-9 text-[11px] ${isLight ? 'text-stone-700' : 'text-emerald-300'}`}>
                {letterSpacing >= 0 ? `+${letterSpacing.toFixed(2)}` : letterSpacing.toFixed(2)}em
              </span>
            </div>
          </div>

          {/* Alignment & Toggle Options */}
          <div className="flex items-center space-x-2">
            {/* Text Align */}
            <div
              className={`flex items-center p-0.5 rounded border ${
                isLight ? 'bg-[#edf5f0] border-[#c8ded3]' : 'bg-[#101712] border-[#25362b]'
              }`}
            >
              <button
                onClick={() => setTextAlign('left')}
                title="左揃え / 天揃え"
                className={`p-1 rounded ${
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
                className={`p-1 rounded ${
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
                className={`p-1 rounded ${
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
                className={`p-1 rounded ${
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

            {/* Font Scale Optimization Toggle (和文標準 135% ⇔ 原寸 100%) */}
            <button
              onClick={() => setFontScaleMultiplier(fontScaleMultiplier === 1.35 ? 1.0 : 1.35)}
              className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors flex items-center space-x-1 ${
                fontScaleMultiplier === 1.35
                  ? isLight
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                    : 'bg-emerald-500 text-stone-950 font-bold border-emerald-400 shadow-xs'
                  : isLight
                  ? 'bg-white border-[#c8ded3] text-stone-600 hover:bg-emerald-50'
                  : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
              }`}
              title="和文標準サイズ最適化 (135%拡大: AviUtl2やWordで他フォントと同等サイズで表示) ⇔ 原寸 (100%)"
            >
              <Maximize2 className="w-3 h-3" />
              <span>和文サイズ最適化: {fontScaleMultiplier === 1.35 ? '135%' : '100%'}</span>
            </button>

            {/* Auto Balance Margins Toggle (左右余白均等化) */}
            <button
              onClick={() => setAutoBalanceMargins(!autoBalanceMargins)}
              className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors flex items-center space-x-1 ${
                autoBalanceMargins
                  ? isLight
                    ? 'bg-amber-700 text-white border-amber-800 shadow-xs'
                    : 'bg-amber-500 text-stone-950 font-bold border-amber-400 shadow-xs'
                  : isLight
                  ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                  : 'bg-emerald-500 text-stone-950 font-bold border-emerald-400 shadow-xs'
              }`}
              title={
                autoBalanceMargins
                  ? '現在「左右強制センタリング」中: 各文字のバウンディングボックスを中央に整列しています。'
                  : '現在「ガイド描画位置優先 (推奨)」: キャンバスガイド枠の手書き位置を100%忠実に反映しています。'
              }
            >
              <Scale className="w-3 h-3" />
              <span>配置: {autoBalanceMargins ? '左右強制センタリング (ON)' : 'ガイド描画位置優先 (推奨)'}</span>
            </button>

            {/* Toggle Char Boxes (仮想ボディ枠表示) */}
            <button
              onClick={() => setShowCharBoxes(!showCharBoxes)}
              className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center space-x-1 ${
                showCharBoxes
                  ? isLight
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                    : 'bg-emerald-500 text-stone-950 font-bold border-emerald-400 shadow-xs'
                  : isLight
                  ? 'bg-white border-[#c8ded3] text-stone-600 hover:bg-emerald-50'
                  : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
              }`}
              title="各文字の仮想ボディ枠(1em)と中心軸を表示して文字の偏り・配置を確認"
            >
              <BoxSelect className="w-3 h-3" />
              <span>仮想ボディ枠</span>
            </button>

            {/* Toggle Space Markers (全角空白表示) */}
            <button
              onClick={() => setShowSpaceMarkers(!showSpaceMarkers)}
              className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center space-x-1 ${
                showSpaceMarkers
                  ? isLight
                    ? 'bg-amber-100 border-amber-300 text-amber-900'
                    : 'bg-amber-950 border-amber-700 text-amber-300'
                  : isLight
                  ? 'bg-white border-[#c8ded3] text-stone-600 hover:bg-emerald-50'
                  : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
              }`}
              title="全角空白(U+3000)や半角空白の位置を枠で可視化"
            >
              <span>空白可視化</span>
            </button>

            {/* Toggle Genko/Grid Overlay */}
            <button
              onClick={() => setShowGenkoGrid(!showGenkoGrid)}
              className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors flex items-center space-x-1 ${
                showGenkoGrid
                  ? isLight
                    ? 'bg-emerald-800 text-white border-emerald-900'
                    : 'bg-emerald-500 text-stone-950 font-bold border-emerald-400'
                  : isLight
                  ? 'bg-white border-[#c8ded3] text-stone-600 hover:bg-emerald-50'
                  : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
              }`}
              title="原稿用紙・方眼グリッドの重ね合わせ表示"
            >
              <Grid className="w-3 h-3" />
              <span>原稿用紙</span>
            </button>

            {/* Toggle Waterfall */}
            <button
              onClick={() => setIsWaterfall(!isWaterfall)}
              className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
                isWaterfall
                  ? isLight
                    ? 'bg-emerald-800 text-white border-emerald-900'
                    : 'bg-emerald-500 text-stone-950 font-bold border-emerald-400'
                  : isLight
                  ? 'bg-white border-[#c8ded3] text-stone-600 hover:bg-emerald-50'
                  : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
              }`}
            >
              段階サイズ
            </button>
          </div>
        </div>

        {/* Text Input Area */}
        <div
          className={`p-3 border-b shrink-0 ${
            isLight ? 'bg-[#f4f9f6] border-[#d8e6df]' : 'bg-[#101712] border-[#25362b]'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <label className={`text-[11px] font-semibold flex items-center space-x-1.5 ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
              <span>テスト文章 (直接編集可能):</span>
              {autoBalanceMargins && (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-normal">
                  (左右余白を均等に整列中)
                </span>
              )}
            </label>
            <span className={`text-[10px] ${isLight ? 'text-stone-500' : 'text-emerald-500'}`}>
              {testText.length} 文字
            </span>
          </div>
          <textarea
            rows={2}
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="ここにテストしたい文章を入力..."
            className={`w-full border rounded-md p-2 text-xs focus:outline-none select-text transition-colors ${
              isLight
                ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                : 'bg-[#16201a] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
            }`}
          />
        </div>

        {/* Main Proofing Stage */}
        <div
          className={`flex-1 overflow-auto p-4 sm:p-8 select-text relative min-h-[300px] ${
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
            <div className="max-w-4xl mx-auto flex flex-col space-y-6">
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
            /* Centered Paper Layout for Proofing */
            <div className="w-full flex justify-center items-start min-h-full py-2">
              <div
                className={`transition-all rounded-lg shadow-sm border p-6 sm:p-10 ${
                  writingMode === 'vertical'
                    ? 'min-w-[320px] max-w-full overflow-x-auto h-full max-h-[720px]'
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
                  フォント名: <strong className={isLight ? 'text-emerald-950' : 'text-emerald-200'}>{project.metadata.familyName || 'MyFont'}</strong>
                </span>
                <span className={`font-mono ${isLight ? 'text-stone-500' : 'text-emerald-500'}`}>
                  {writingMode === 'vertical' ? '縦組み (vertical-rl)' : '横組み (horizontal-tb)'} | {textAlign === 'left' ? '左揃え' : textAlign === 'center' ? '中央揃え' : textAlign === 'right' ? '右揃え' : '均等揃え'}
                </span>
                <span className={`text-[10px] ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  {autoBalanceMargins ? '✓ 左右余白均等化: 有効' : '⚠ 左右余白均等化: 無効 (生データ表示)'}
                </span>
              </>
            )}
          </div>

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
  );
};
