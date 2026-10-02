import React, { useMemo, useState, useEffect } from 'react';
import {
  X,
  Eye,
  Sliders,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRightLeft,
  Check,
  Palette,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { FontProject, GlyphData, GlyphOverlaySettings } from '../types';
import { ThemeMode, isLightTheme } from '../utils/theme';

interface GlyphCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: FontProject;
  activeChar: string;
  activeUnicode?: number;
  overlaySettings: GlyphOverlaySettings;
  onChangeOverlaySettings: React.Dispatch<React.SetStateAction<GlyphOverlaySettings>>;
  theme: ThemeMode;
  onShowToast?: (text: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

// Recommended paired characters for visual harmony & stroke balance check
const COMMON_COMPARE_PAIRS: Record<string, string[]> = {
  '日': ['目', '白', '田', '由', '申', '百', '旧'],
  '目': ['日', '自', '見', '耳', '月'],
  '木': ['本', '林', '森', '札', '休', '末', '未'],
  '本': ['木', '体', '札', '末'],
  '口': ['品', '呂', '員', '団', '回', '日'],
  '大': ['太', '犬', '天', '夫', '矢'],
  '人': ['入', '八', '个', '大'],
  '土': ['士', '干', '工', '王', '生'],
  '山': ['出', '川', '岩', '岸'],
  '糸': ['紙', '結', '給', '納', '終'],
  '言': ['語', '話', '記', '詰', '計'],
  '手': ['打', '押', '持', '指', '毛'],
  'あ': ['お', 'め', 'ぬ', 'ぁ', 'む'],
  'い': ['り', 'こ', 'ぃ', '八'],
  'う': ['え', 'ら', 'ぅ', 'ラ'],
  'え': ['う', 'え', 'ぇ', '元'],
  'お': ['あ', 'む', 'ぉ'],
  'か': ['が', 'わ', 'れ', '力'],
  'さ': ['き', 'ち', 'ざ'],
  'た': ['な', 'に', 'だ'],
  'は': ['ほ', 'ま', 'な', 'ば', 'ぱ'],
  'O': ['Q', 'C', 'G', 'D', '0'],
  'Q': ['O', 'C', 'G', '0'],
  'B': ['P', 'R', 'D', '8'],
  'P': ['B', 'R', 'F', 'D'],
  'R': ['B', 'P', 'K'],
  'E': ['F', 'L', 'T', 'H'],
  'F': ['E', 'P', 'T'],
  'n': ['m', 'h', 'u', 'r'],
  'm': ['n', 'w', 'u'],
  'p': ['q', 'b', 'd'],
  'b': ['d', 'p', 'q', 'h'],
  'd': ['b', 'p', 'q', 'cl'],
};

const COLOR_OPTIONS = [
  { name: 'Sky Blue', hex: '#0284c7' },
  { name: 'Coral Pink', hex: '#f43f5e' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Amber Gold', hex: '#f59e0b' },
  { name: 'Cyan', hex: '#06b6d4' },
];

export const GlyphCompareModal: React.FC<GlyphCompareModalProps> = ({
  isOpen,
  onClose,
  project,
  activeChar,
  activeUnicode,
  overlaySettings,
  onChangeOverlaySettings,
  theme,
  onShowToast,
}) => {
  const isLight = isLightTheme(theme);

  // Fullscreen mode state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

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

  // Get recommendations for activeChar
  const recommendedChars = useMemo(() => {
    if (!activeChar) return ['日', '木', '口', 'あ', 'O'];
    return COMMON_COMPARE_PAIRS[activeChar] || ['日', '木', '口', 'あ', 'O'];
  }, [activeChar]);

  // List of all drawn characters in project
  const projectDrawnChars = useMemo(() => {
    const glyphList = Object.values(project.glyphs || {}) as GlyphData[];
    return glyphList
      .filter((g) => g && g.contours && g.contours.length > 0)
      .map((g) => ({
        char: g.char || String.fromCharCode(g.unicode),
        unicode: g.unicode,
      }));
  }, [project.glyphs]);

  const handleSelectRefChar = (char: string, unicode?: number) => {
    onChangeOverlaySettings((prev) => ({
      ...prev,
      enabled: true,
      referenceChar: char,
      referenceUnicode: unicode ?? char.charCodeAt(0),
    }));
    onShowToast?.(`「${char}」を比較参照文字に設定しました`, 'info');
  };

  const handleResetTransform = () => {
    onChangeOverlaySettings((prev) => ({
      ...prev,
      offsetX: 0,
      offsetY: 0,
      scale: 1.0,
      opacity: 0.45,
    }));
    onShowToast?.('比較レイヤーの位置とスケールをリセットしました', 'info');
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 transition-all ${
        isFullscreen
          ? 'p-0 w-screen h-screen bg-black/85 flex flex-col'
          : 'flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200'
      }`}
      onClick={onClose}
    >
      <div
        className={`flex flex-col transition-all overflow-hidden ${
          isFullscreen
            ? isLight
              ? 'w-screen h-screen rounded-none border-none shadow-none bg-white text-stone-800'
              : 'w-screen h-screen rounded-none border-none shadow-none bg-[#141c16] text-emerald-100'
            : isLight
            ? 'w-full max-w-2xl xl:max-w-3xl rounded-2xl shadow-2xl max-h-[92vh] border border-stone-200 bg-white text-stone-800'
            : 'w-full max-w-2xl xl:max-w-3xl rounded-2xl shadow-2xl max-h-[92vh] border border-[#25362b] bg-[#141c16] text-emerald-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between border-b shrink-0 ${
            isLight ? 'bg-stone-50/80 border-stone-200' : 'bg-[#101712] border-[#25362b]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center ">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>グリフ重ね合わせ比較 (Overlay Compare)</span>
                {isFullscreen && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-600 text-white font-medium">
                    全画面モード
                  </span>
                )}
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    overlaySettings.enabled
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-stone-500/10 text-stone-500 border-stone-500/30'
                  }`}
                >
                  {overlaySettings.enabled ? 'ON' : 'OFF'}
                </span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-emerald-400/80">
                作成中の文字に他文字を半透明・輪郭で重ね、骨格や太さのバランスを検査
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-1.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                isFullscreen
                  ? isLight
                    ? 'bg-sky-100 text-sky-900 border-sky-300'
                    : 'bg-sky-950 text-sky-300 border-sky-700'
                  : isLight
                  ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
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
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#1a251e] transition-colors"
              title="閉じる (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-4 sm:space-y-5">
          {/* Master Enable Switch */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
              overlaySettings.enabled
                ? 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/60'
                : isLight
                ? 'bg-stone-50 border-stone-200'
                : 'bg-[#101712] border-[#25362b]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Eye className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <div>
                <div className="text-xs font-bold">重ね合わせ比較レイヤーを表示</div>
                <div className="text-[10px] text-stone-500 dark:text-stone-400">
                  現在編集中の文字「{activeChar || '未選択'}」の上に半透明で重ねて表示
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(overlaySettings?.enabled)}
                onChange={(e) =>
                  onChangeOverlaySettings((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-300 peer-focus:outline-hidden rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>

          {/* Quick Recommend Pairs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>「{activeChar || ''}」の比較対象文字</span>
              </label>
              <span className="text-[10px] text-stone-400">ワンクリックで切替</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {recommendedChars.map((ch) => {
                const isSelected = overlaySettings.referenceChar === ch;
                const isDrawn = project.glyphs[ch.charCodeAt(0)]?.contours?.length > 0;
                return (
                  <button
                    key={ch}
                    onClick={() => handleSelectRefChar(ch)}
                    className={`w-10 h-10 rounded-xl border text-base font-bold flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-sky-600 text-white border-sky-600  ring-2 ring-sky-400/40'
                        : isDrawn
                        ? isLight
                          ? 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-900'
                          : 'bg-sky-950/40 hover:bg-sky-900/60 border-sky-800 text-sky-200'
                        : isLight
                        ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                        : 'bg-[#18231c] hover:bg-[#202f26] border-[#25362b] text-stone-300'
                    }`}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Project Drawn Glyphs Selector */}
          <div>
            <label className="text-xs font-bold block mb-2 opacity-90">
              プロジェクト内の作成済み文字から選択 ({projectDrawnChars.length}文字)
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-xl border border-stone-200 dark:border-[#25362b] bg-stone-50/50 dark:bg-[#101712]/50">
              {projectDrawnChars.length === 0 ? (
                <div className="text-xs text-stone-400 p-2">まだ作成済みの文字がありません</div>
              ) : (
                projectDrawnChars.map((g) => {
                  const isSelected =
                    overlaySettings.referenceChar === g.char ||
                    overlaySettings.referenceUnicode === g.unicode;
                  return (
                    <button
                      key={g.unicode}
                      onClick={() => handleSelectRefChar(g.char, g.unicode)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-sky-600 text-white border-sky-600 '
                          : isLight
                          ? 'bg-white hover:bg-stone-100 border-stone-200 text-stone-800'
                          : 'bg-[#18231c] hover:bg-[#202f26] border-[#25362b] text-stone-200'
                      }`}
                    >
                      {g.char}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Render Mode & Color Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Render Mode */}
            <div
              className={`p-4 rounded-xl border ${
                isLight ? 'bg-stone-50/60 border-stone-200' : 'bg-[#162018] border-[#25362b]'
              }`}
            >
              <label className="text-xs font-bold block mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-600" />
                <span>表示モード</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'outline', label: '輪郭線 (破線)' },
                  { id: 'fill', label: '半透明塗り' },
                  { id: 'difference', label: '差分強調' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() =>
                      onChangeOverlaySettings((prev) => ({ ...prev, renderMode: m.id as any }))
                    }
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition-all ${
                      overlaySettings.renderMode === m.id
                        ? 'bg-sky-600 text-white border-sky-600 '
                        : isLight
                        ? 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
                        : 'bg-[#101712] hover:bg-[#1a251e] border-[#25362b] text-stone-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Palette */}
            <div
              className={`p-4 rounded-xl border ${
                isLight ? 'bg-stone-50/60 border-stone-200' : 'bg-[#162018] border-[#25362b]'
              }`}
            >
              <label className="text-xs font-bold block mb-2 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-sky-600" />
                <span>比較色</span>
              </label>
              <div className="flex items-center gap-2">
                {COLOR_OPTIONS.map((c) => {
                  const isSelected = overlaySettings.color === c.hex;
                  return (
                    <button
                      key={c.hex}
                      onClick={() =>
                        onChangeOverlaySettings((prev) => ({ ...prev, color: c.hex }))
                      }
                      title={c.name}
                      style={{ backgroundColor: c.hex }}
                      className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                        isSelected ? 'ring-2 ring-offset-2 ring-sky-500 scale-110 ' : 'hover:scale-105'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Opacity & Fine Offset Sliders */}
          <div
            className={`p-4 rounded-xl border space-y-3 ${
              isLight ? 'bg-stone-50/60 border-stone-200' : 'bg-[#162018] border-[#25362b]'
            }`}
          >
            {/* Opacity */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold">不透明度 (Opacity)</label>
                <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                  {Math.round((overlaySettings.opacity ?? 0.45) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={overlaySettings.opacity ?? 0.45}
                onChange={(e) =>
                  onChangeOverlaySettings((prev) => ({
                    ...prev,
                    opacity: Number(e.target.value),
                  }))
                }
                className="w-full accent-sky-600 h-2 bg-stone-200 dark:bg-stone-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Position Offset X & Y */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between text-[11px] font-bold mb-1">
                  <span>横位置オフセット (X)</span>
                  <span className="font-mono">{overlaySettings.offsetX ?? 0}px</span>
                </div>
                <input
                  type="range"
                  min={-250}
                  max={250}
                  step={5}
                  value={overlaySettings.offsetX ?? 0}
                  onChange={(e) =>
                    onChangeOverlaySettings((prev) => ({
                      ...prev,
                      offsetX: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-sky-600 h-1.5 bg-stone-200 dark:bg-stone-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-bold mb-1">
                  <span>縦位置オフセット (Y)</span>
                  <span className="font-mono">{overlaySettings.offsetY ?? 0}px</span>
                </div>
                <input
                  type="range"
                  min={-250}
                  max={250}
                  step={5}
                  value={overlaySettings.offsetY ?? 0}
                  onChange={(e) =>
                    onChangeOverlaySettings((prev) => ({
                      ...prev,
                      offsetY: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-sky-600 h-1.5 bg-stone-200 dark:bg-stone-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Show Metrics toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-[#25362b]">
              <label className="text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(overlaySettings?.showMetrics)}
                  onChange={(e) =>
                    onChangeOverlaySettings((prev) => ({
                      ...prev,
                      showMetrics: e.target.checked,
                    }))
                  }
                  className="rounded accent-sky-600"
                />
                <span>比較文字の送り幅・LSBガイド線も表示</span>
              </label>

              <button
                onClick={handleResetTransform}
                className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>位置リセット</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`p-4 border-t flex items-center justify-between shrink-0 ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#101712] border-[#25362b]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="text-xs text-stone-500">
              選択中: 「<strong className="text-sky-600 dark:text-sky-400">{overlaySettings.referenceChar || '未設定'}</strong>」
            </div>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-1.5 px-2.5 rounded-lg border text-xs font-medium flex items-center space-x-1.5 transition-colors hidden sm:flex ${
                isLight
                  ? 'border-stone-300 text-stone-600 hover:bg-stone-100'
                  : 'border-[#25362b] text-stone-300 hover:bg-[#202f26]'
              }`}
              title={isFullscreen ? '通常表示に戻す (F / Esc)' : '全画面表示モード (F)'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>通常サイズに戻す</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>全画面表示</span>
                </>
              )}
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white active:scale-95 transition-all"
          >
            完了 (キャンバスに反映)
          </button>
        </div>
      </div>
    </div>
  );
};
