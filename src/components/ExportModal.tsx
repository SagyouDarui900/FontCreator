import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Share2,
  CheckCircle2,
  AlertCircle,
  FileCode,
  FileText,
  Copy,
  Check,
  Sparkles,
  Layers,
  Smartphone,
  Maximize2,
  Sliders,
  Eye,
  ShieldCheck,
  Type,
  Video,
  RotateCcw,
} from 'lucide-react';
import { FontProject } from '../types';
import { ThemeMode } from '../utils/theme';
import {
  compileFont,
  downloadFont,
  shareOrDownloadFont,
  validateFontProject,
  FontValidationResult,
  CompileFontOptions,
} from '../utils/fontCompiler';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: FontProject;
  theme: ThemeMode;
  onShowToast?: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  onRequestNewProject?: () => void;
  onOpenQualityModal?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
  theme,
  onShowToast,
  onRequestNewProject,
  onOpenQualityModal,
}) => {
  const [format, setFormat] = useState<'ttf' | 'otf'>('ttf');
  // Size Optimization: 'standard_jp' (1.35x), 'custom', 'raw' (1.0x)
  const [sizePreset, setSizePreset] = useState<'standard_jp' | 'custom' | 'raw'>('standard_jp');
  const [customScale, setCustomScale] = useState<number>(1.35);
  // Overlap removal & self-intersection prevention for single-stroke loops
  const [mergeOverlaps, setMergeOverlaps] = useState<boolean>(true);
  const [balanceSideBearings, setBalanceSideBearings] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedCss, setCopiedCss] = useState(false);

  // Dynamic preview font URL for live preview
  const [previewFontUrl, setPreviewFontUrl] = useState<string | null>(null);
  const [previewFontFamily, setPreviewFontFamily] = useState<string>('ExportPreviewFont');

  const isLight = theme === 'light';

  // Effective scale factor
  const effectiveScale =
    sizePreset === 'standard_jp' ? 1.35 : sizePreset === 'raw' ? 1.0 : customScale;

  const compileOptions: CompileFontOptions = {
    scaleFactor: effectiveScale,
    mergeOverlaps,
    normalizeWinding: true,
    balanceSideBearings,
  };

  // Compile font for live preview in modal
  useEffect(() => {
    if (!isOpen) return;
    let activeUrl: string | null = null;
    try {
      const { blobUrl } = compileFont(project, compileOptions);
      activeUrl = blobUrl;
      const fontName = `ExportPreviewFont_${Date.now()}`;
      setPreviewFontFamily(fontName);
      setPreviewFontUrl(blobUrl);

      const styleId = 'export-modal-preview-font-face';
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
    } catch (err) {
      console.warn('Live preview font compilation failed:', err);
    }

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [isOpen, project, effectiveScale, mergeOverlaps, balanceSideBearings]);

  if (!isOpen) return null;

  const validation: FontValidationResult = validateFontProject(project);
  const glyphCount = Object.keys(project.glyphs || {}).length;
  const safeFamilyName = project.metadata.familyName || 'CustomFont';
  const styleName = project.metadata.styleName || 'Regular';
  const postscriptName = `${safeFamilyName.replace(/[^a-zA-Z0-9]/g, '') || 'CustomFont'}-${styleName.replace(/[^a-zA-Z0-9]/g, '') || 'Regular'}`;

  const cssSnippet = `@font-face {
  font-family: '${safeFamilyName}';
  src: url('${postscriptName}.${format}') format('${format === 'otf' ? 'opentype' : 'truetype'}');
  font-weight: ${styleName.toLowerCase().includes('bold') ? '700' : '400'};
  font-style: ${styleName.toLowerCase().includes('italic') ? 'italic' : 'normal'};
  font-display: swap;
}`;

  const handleExport = async (preferredMethod?: 'share' | 'download') => {
    setIsExporting(true);
    try {
      if (preferredMethod === 'share' || preferredMethod === undefined) {
        const res = await shareOrDownloadFont(project, format, compileOptions);
        if (res.method === 'share') {
          onShowToast?.(`フォント「${res.filename}」の共有・保存シートを開きました`, 'success');
        } else {
          onShowToast?.(`フォント「${res.filename}」をダウンロードしました`, 'success');
        }
      } else {
        downloadFont(project, format, compileOptions);
        onShowToast?.(`フォント (.${format}) をダウンロードしました`, 'success');
      }
    } catch (err: any) {
      console.error('Export failed:', err);
      onShowToast?.(
        `フォント出力に失敗しました: ${err?.message || 'グリフデータを確認してください'}`,
        'error'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyCss = () => {
    navigator.clipboard.writeText(cssSnippet);
    setCopiedCss(true);
    onShowToast?.('CSS @font-face 設定をコピーしました', 'success');
    setTimeout(() => setCopiedCss(false), 2000);
  };

  // Check if touch device (e.g. iPad / iPhone)
  const isAppleTouch =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors ${
          isLight
            ? 'bg-white border-stone-200 text-stone-900 shadow-emerald-950/10'
            : 'bg-[#151f18] border-[#25362b] text-emerald-100 shadow-black/50'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18231c] border-[#233327]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-2 rounded-xl ${
                isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-900/60 text-emerald-300'
              }`}
            >
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">フォントファイルを出力 (TTF / OTF)</h2>
              <p className="text-xs opacity-70">
                {safeFamilyName} {styleName} ({glyphCount}文字 収録)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'text-stone-400 hover:bg-stone-200 hover:text-stone-700' : 'text-stone-400 hover:bg-[#202d24] hover:text-emerald-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Format Selection */}
          <div className="space-y-1.5">
            <label className="font-bold opacity-80 flex items-center justify-between">
              <span>ファイル形式を選択</span>
              <span className="font-normal opacity-70">AviUtl・動画編集・一般利用: TTF推奨</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFormat('ttf')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  format === 'ttf'
                    ? isLight
                      ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-500/20'
                      : 'border-emerald-500 bg-emerald-950/60 text-emerald-100 ring-2 ring-emerald-500/30'
                    : isLight
                    ? 'border-stone-200 hover:bg-stone-50 text-stone-700'
                    : 'border-[#25362b] hover:bg-[#1c2920] text-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">.TTF (TrueType)</span>
                  {format === 'ttf' && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                </div>
                <p className="mt-0.5 text-[11px] opacity-75 leading-tight">
                  AviUtl2、Premiere、Windows、Mac、iPad、Android全対応（最も確実）
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormat('otf')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  format === 'otf'
                    ? isLight
                      ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-500/20'
                      : 'border-emerald-500 bg-emerald-950/60 text-emerald-100 ring-2 ring-emerald-500/30'
                    : isLight
                    ? 'border-stone-200 hover:bg-stone-50 text-stone-700'
                    : 'border-[#25362b] hover:bg-[#1c2920] text-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">.OTF (OpenType)</span>
                  {format === 'otf' && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                </div>
                <p className="mt-0.5 text-[11px] opacity-75 leading-tight">
                  InDesign、Illustrator等のDTP・グラフィックデザインソフト向け
                </p>
              </button>
            </div>
          </div>

          {/* Size & Em-box Optimization */}
          <div
            className={`p-3.5 rounded-xl border space-y-3 ${
              isLight ? 'bg-stone-50/90 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Maximize2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-bold text-xs text-stone-900 dark:text-emerald-200">
                  文字サイズ・仮想ボディ比率の最適化
                </span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                倍率: {Math.round(effectiveScale * 100)}%
              </span>
            </div>

            <p className="text-[11px] opacity-80 leading-relaxed">
              手書き文字はキャンバスに対して小さめに描かれる傾向があります。標準設定ではAviUtl2やWord等の一般的な日本語フォント（MSゴシックや游ゴシック等）と同等のサイズ感になるよう自動で拡大スケーリングします。
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSizePreset('standard_jp')}
                className={`p-2 rounded-lg border text-center transition-all ${
                  sizePreset === 'standard_jp'
                    ? isLight
                      ? 'border-emerald-600 bg-emerald-100/70 text-emerald-950 font-bold ring-1 ring-emerald-500'
                      : 'border-emerald-500 bg-emerald-900/60 text-emerald-100 font-bold ring-1 ring-emerald-500'
                    : isLight
                    ? 'border-stone-200 hover:bg-white text-stone-700'
                    : 'border-[#283b2e] hover:bg-[#202d24] text-emerald-300'
                }`}
              >
                <div className="text-xs">和文標準 (135%)</div>
                <div className="text-[10px] opacity-75 font-normal mt-0.5">AviUtl2・動画推奨</div>
              </button>

              <button
                type="button"
                onClick={() => setSizePreset('custom')}
                className={`p-2 rounded-lg border text-center transition-all ${
                  sizePreset === 'custom'
                    ? isLight
                      ? 'border-emerald-600 bg-emerald-100/70 text-emerald-950 font-bold ring-1 ring-emerald-500'
                      : 'border-emerald-500 bg-emerald-900/60 text-emerald-100 font-bold ring-1 ring-emerald-500'
                    : isLight
                    ? 'border-stone-200 hover:bg-white text-stone-700'
                    : 'border-[#283b2e] hover:bg-[#202d24] text-emerald-300'
                }`}
              >
                <div className="text-xs">カスタム倍率</div>
                <div className="text-[10px] opacity-75 font-normal mt-0.5">{Math.round(customScale * 100)}%</div>
              </button>

              <button
                type="button"
                onClick={() => setSizePreset('raw')}
                className={`p-2 rounded-lg border text-center transition-all ${
                  sizePreset === 'raw'
                    ? isLight
                      ? 'border-emerald-600 bg-emerald-100/70 text-emerald-950 font-bold ring-1 ring-emerald-500'
                      : 'border-emerald-500 bg-emerald-900/60 text-emerald-100 font-bold ring-1 ring-emerald-500'
                    : isLight
                    ? 'border-stone-200 hover:bg-white text-stone-700'
                    : 'border-[#283b2e] hover:bg-[#202d24] text-emerald-300'
                }`}
              >
                <div className="text-xs">原寸のまま (100%)</div>
                <div className="text-[10px] opacity-75 font-normal mt-0.5">キャンバス通り</div>
              </button>
            </div>

            {sizePreset === 'custom' && (
              <div className="pt-2 flex items-center space-x-3">
                <span className="text-[11px] opacity-70 shrink-0">縮小 (80%)</span>
                <input
                  type="range"
                  min="0.8"
                  max="1.8"
                  step="0.05"
                  value={customScale}
                  onChange={(e) => setCustomScale(parseFloat(e.target.value))}
                  className="flex-1 accent-emerald-600 cursor-pointer"
                />
                <span className="text-[11px] opacity-70 shrink-0">拡大 (180%)</span>
              </div>
            )}
          </div>

          {/* Visual Fidelity & Vector Purity */}
          <div
            className={`p-3.5 rounded-xl border space-y-2.5 ${
              isLight ? 'bg-stone-50/90 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-bold text-xs text-stone-900 dark:text-emerald-200">
                  ベクター原画の忠実再現（筆跡・カーブ保持）
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                100% ベクター完全保持
              </span>
            </div>
            <p className="text-[11px] opacity-80 leading-relaxed">
              TrueType標準のNon-Zero Winding規則に準拠し、描いた時の筆圧、止め・はね・はらい、滑らかな曲線をラスター劣化させずにそのままフォントファイルへ直接コンパイルします。
            </p>

            <div className="pt-1 flex flex-col space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={balanceSideBearings}
                  onChange={(e) => setBalanceSideBearings(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                />
                <span className="text-[11px] text-stone-800 dark:text-emerald-200">
                  文字の左右余白（LSB/RSB）を均等にセンタリング補正（左寄りを解消）
                </span>
              </label>

              <label className="flex items-start space-x-2 cursor-pointer p-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors">
                <input
                  type="checkbox"
                  checked={mergeOverlaps}
                  onChange={(e) => setMergeOverlaps(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded accent-emerald-600 cursor-pointer shrink-0"
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-stone-800 dark:text-emerald-200">
                    一筆書き・重なり白抜き防止（交差輪郭を自動結合して中抜けを解消）
                  </span>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400">
                    手書き文字や一筆書きでループが重なった部分が白く抜けるのを防ぎ、TrueType標準の外輪郭に一体化します
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Live Render & Size Preview in Modal */}
          <div
            className={`p-3 rounded-xl border space-y-2 ${
              isLight ? 'bg-stone-100/80 border-stone-200' : 'bg-[#121b15] border-[#223025]'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold opacity-80">
              <div className="flex items-center space-x-1.5">
                <Video className="w-3.5 h-3.5 text-emerald-600" />
                <span>AviUtl2 / 動画テロップ・実機見え方シミュレーター</span>
              </div>
              <span className="text-[10px] font-normal opacity-70">
                フォントサイズ: 40px相当
              </span>
            </div>

            <div
              className={`p-3 rounded-lg border flex items-center justify-center min-h-[64px] overflow-hidden ${
                isLight ? 'bg-white border-stone-200' : 'bg-black/40 border-[#25362b]'
              }`}
            >
              <div
                style={{
                  fontFamily: `'${previewFontFamily}', sans-serif`,
                  fontSize: '40px',
                  lineHeight: '1.2',
                }}
                className="tracking-normal select-none text-stone-900 dark:text-emerald-100 transition-all text-center"
              >
                あいう 色は匂へど 漢字 123
              </div>
            </div>
          </div>

          {/* Quality Check Recommendation Banner */}
          {onOpenQualityModal && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                isLight
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-100'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">フォント品質チェック</div>
                  <div className="text-[11px] text-stone-600 dark:text-emerald-300/80 leading-tight">
                    出力前に字形の重複、パスの交差、過剰なノード数、ベースライン逸脱を自動検査・一括修正できます
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQualityModal();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border shrink-0 transition-colors ${
                  isLight
                    ? 'bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-50 shadow-xs'
                    : 'bg-[#1a271f] border-emerald-700 text-emerald-200 hover:bg-[#23342a]'
                }`}
              >
                品質を検査
              </button>
            </div>
          )}

          {/* iPad Specific Advice */}
          {isAppleTouch && (
            <div
              className={`p-3 rounded-xl border flex items-center space-x-2.5 ${
                isLight ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-amber-950/30 border-amber-800 text-amber-200'
              }`}
            >
              <Smartphone className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-[11px] leading-relaxed">
                <strong>iPad / iPhoneをご利用中:</strong> 下の「iPadの「ファイル」に保存・共有」を押すと、標準の共有メニューが開き、iCloud Driveや本体の「ファイル」アプリに直接保存できます。
              </div>
            </div>
          )}

          {/* CSS @font-face Snippet */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold opacity-80 flex items-center space-x-1.5">
                <FileCode className="w-3.5 h-3.5" />
                <span>Webサイト用 CSS (@font-face)</span>
              </label>
              <button
                type="button"
                onClick={handleCopyCss}
                className={`px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center space-x-1 transition-colors ${
                  isLight
                    ? 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                    : 'bg-[#202d24] hover:bg-[#283b2e] text-emerald-200'
                }`}
              >
                {copiedCss ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCss ? 'コピー完了' : 'CSSをコピー'}</span>
              </button>
            </div>
            <pre
              className={`p-2.5 rounded-xl border font-mono text-[10.5px] overflow-x-auto select-all ${
                isLight ? 'bg-stone-50 border-stone-200 text-stone-800' : 'bg-[#101712] border-[#223025] text-emerald-200'
              }`}
            >
              {cssSnippet}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className={`px-5 py-3.5 border-t flex flex-col sm:flex-row items-center justify-between gap-2.5 ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18231c] border-[#233327]'
          }`}
        >
          <div className="text-[11px] opacity-70 w-full sm:w-auto text-center sm:text-left">
            収録文字: <strong className="font-sans text-emerald-700 dark:text-emerald-400">{glyphCount}</strong> 文字 / 倍率:{' '}
            <strong className="font-sans text-emerald-700 dark:text-emerald-400">
              {Math.round(effectiveScale * 100)}%
            </strong>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            {onRequestNewProject && (
              <button
                type="button"
                onClick={onRequestNewProject}
                className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center space-x-1.5 transition-colors ${
                  isLight
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-amber-950/60 hover:bg-amber-900/60 text-amber-200 border-amber-800'
                }`}
                title="現在のフォント作成を終了し、リセットして新プロジェクトを開きます"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>完成！新規作成</span>
              </button>
            )}

            <button
              onClick={onClose}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                isLight
                  ? 'border-stone-300 hover:bg-stone-200 text-stone-700'
                  : 'border-[#2d4034] hover:bg-[#202d24] text-emerald-200'
              }`}
            >
              閉じる
            </button>

            {/* iPad / iOS Native Share Button */}
            {isAppleTouch ? (
              <button
                onClick={() => handleExport('share')}
                disabled={isExporting}
                className="px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all shadow-md active:scale-95 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                <span>iPadの「ファイル」に保存・共有</span>
              </button>
            ) : (
              <button
                onClick={() => handleExport('download')}
                disabled={isExporting}
                className="px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all shadow-md active:scale-95 bg-amber-400 hover:bg-amber-300 text-emerald-950 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>.{format.toUpperCase()} をダウンロード</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
