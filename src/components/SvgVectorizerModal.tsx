import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Upload,
  FileCode,
  Sparkles,
  Sliders,
  Eye,
  Download,
  Check,
  RefreshCw,
  Image as ImageIcon,
  RotateCw,
  Plus,
  Info,
} from 'lucide-react';
import { PathContour } from '../types';
import { parseSvgStringToContours } from '../utils/svgParser';
import { vectorizeImage, VectorizeOptions } from '../utils/imageVectorizer';
import { contoursToSvgPath } from '../utils/pathUtils';
import { ThemeMode } from '../utils/theme';

interface SvgVectorizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyContours: (contours: PathContour[], append: boolean) => void;
  selectedChar: string;
  theme: ThemeMode;
  onShowToast?: (text: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SvgVectorizerModal: React.FC<SvgVectorizerModalProps> = ({
  isOpen,
  onClose,
  onApplyContours,
  selectedChar,
  theme,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'vectorizer' | 'svg_import'>('vectorizer');
  const isLight = theme === 'light';

  // SVG Direct Import states
  const svgFileInputRef = useRef<HTMLInputElement>(null);
  const [svgText, setSvgText] = useState<string>('');
  const [svgParsedContours, setSvgParsedContours] = useState<PathContour[]>([]);
  const [svgParseError, setSvgParseError] = useState<string | null>(null);
  const [fitToEm, setFitToEm] = useState<boolean>(true);

  // Image Vectorizer states
  const imgFileInputRef = useRef<HTMLInputElement>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [vectorContours, setVectorContours] = useState<PathContour[]>([]);
  const [generatedSvgString, setGeneratedSvgString] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showOriginalOverlay, setShowOriginalOverlay] = useState<boolean>(true);

  // Vectorizer parameters
  const [threshold, setThreshold] = useState<number>(128);
  const [smoothing, setSmoothing] = useState<number>(2.5);
  const [contrast, setContrast] = useState<number>(1.1);
  const [brightness, setBrightness] = useState<number>(0);
  const [invert, setInvert] = useState<boolean>(false);
  const [minArea, setMinArea] = useState<number>(8);

  // Debounced auto-vectorization
  const runVectorize = useCallback(async () => {
    if (!rawImageSrc) return;
    setIsProcessing(true);
    try {
      const result = await vectorizeImage(rawImageSrc, {
        threshold,
        smoothing,
        contrast,
        brightness,
        invert,
        minArea,
        fitMargin: 80,
      });
      setVectorContours(result.contours);
      setGeneratedSvgString(result.svgString);
    } catch (err: any) {
      console.error('Vectorization error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [rawImageSrc, threshold, smoothing, contrast, brightness, invert, minArea]);

  useEffect(() => {
    if (rawImageSrc) {
      const timer = setTimeout(runVectorize, 100);
      return () => clearTimeout(timer);
    }
  }, [rawImageSrc, runVectorize]);

  if (!isOpen) return null;

  // Handle SVG text parsing
  const handleSvgTextChange = (text: string) => {
    setSvgText(text);
    if (!text.trim()) {
      setSvgParsedContours([]);
      setSvgParseError(null);
      return;
    }
    try {
      const res = parseSvgStringToContours(text, fitToEm);
      if (res.contours.length === 0) {
        setSvgParseError('ベクターパス（path / rect / polygon等）が見つかりませんでした。');
        setSvgParsedContours([]);
      } else {
        setSvgParsedContours(res.contours);
        setSvgParseError(null);
      }
    } catch (e: any) {
      setSvgParseError(e.message || 'SVGの解析に失敗しました。');
      setSvgParsedContours([]);
    }
  };

  const handleSvgFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      handleSvgTextChange(content);
    };
    reader.readAsText(file);
  };

  const handleImageFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setRawImageSrc(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Paste image from clipboard
  const handlePasteClipboard = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            handleImageFileUpload(blob as File);
            return;
          }
          if (type === 'text/plain') {
            const blob = await item.getType(type);
            const text = await blob.text();
            if (text.includes('<svg') || text.includes('d="M')) {
              setActiveTab('svg_import');
              handleSvgTextChange(text);
              return;
            }
          }
        }
      }
      if (onShowToast) {
        onShowToast('クリップボードに画像またはSVGデータが見つかりませんでした。', 'warning');
      }
    } catch (err) {
      if (onShowToast) {
        onShowToast('クリップボードの読み取りが拒否されたか、非対応です。ファイル選択から読み込んでください。', 'warning');
      }
    }
  };

  // Download generated SVG
  const handleDownloadSvg = () => {
    if (!generatedSvgString) return;
    const blob = new Blob([generatedSvgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `glyph_${selectedChar || 'vector'}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-2xl border rounded-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-colors ${
          isLight
            ? 'bg-[#f7faf8] border-[#c8ded3] text-stone-800'
            : 'bg-[#151e18] border-[#25362b] text-emerald-100'
        }`}
      >
        {/* Header */}
        <div
          className={`p-3 sm:p-3.5 border-b flex items-center justify-between shrink-0 ${
            isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Sparkles className={`w-4 h-4 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
            <h2
              className={`text-xs font-bold uppercase tracking-wider ${
                isLight ? 'text-emerald-950' : 'text-emerald-200'
              }`}
            >
              SVGインポート & 画像ベクター化スタジオ
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded ${
              isLight ? 'text-stone-500 hover:bg-emerald-100' : 'text-emerald-400 hover:bg-[#202d24]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div
          className={`grid grid-cols-2 p-1.5 gap-1.5 border-b text-xs font-semibold shrink-0 ${
            isLight ? 'bg-[#edf5f0] border-[#d8e6df]' : 'bg-[#101813] border-[#25362b]'
          }`}
        >
          <button
            onClick={() => setActiveTab('vectorizer')}
            className={`py-2 px-3 rounded flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'vectorizer'
                ? isLight
                  ? 'bg-white text-emerald-950 shadow-xs font-bold'
                  : 'bg-[#1c2920] text-emerald-300 shadow-xs font-bold'
                : 'text-stone-600 dark:text-stone-400 hover:text-emerald-800'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            <span>【オマケ】手書き画像・写真 → SVGベクター変換</span>
          </button>

          <button
            onClick={() => setActiveTab('svg_import')}
            className={`py-2 px-3 rounded flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'svg_import'
                ? isLight
                  ? 'bg-white text-emerald-950 shadow-xs font-bold'
                  : 'bg-[#1c2920] text-emerald-300 shadow-xs font-bold'
                : 'text-stone-600 dark:text-stone-400 hover:text-emerald-800'
            }`}
          >
            <FileCode className="w-4 h-4 text-emerald-600" />
            <span>既存SVGファイル / コード読込</span>
          </button>
        </div>

        {/* CONTENT 1: IMAGE VECTORIZER */}
        {activeTab === 'vectorizer' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Upload Toolbar */}
            <div className="flex flex-wrap gap-2 items-center">
              <input
                ref={imgFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageFileUpload(f);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => imgFileInputRef.current?.click()}
                className={`py-2 px-3 rounded-md border flex items-center space-x-1.5 font-bold ${
                  isLight
                    ? 'bg-emerald-800 border-emerald-900 text-white hover:bg-emerald-900 shadow-xs'
                    : 'bg-emerald-700 border-emerald-600 text-white hover:bg-emerald-600 shadow-xs'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>画像ファイルを選択</span>
              </button>

              <button
                onClick={handlePasteClipboard}
                className={`py-2 px-3 rounded-md border flex items-center space-x-1.5 ${
                  isLight
                    ? 'bg-white border-stone-300 hover:bg-emerald-50'
                    : 'bg-[#1a261f] border-[#25362b] hover:bg-[#223127]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>クリップボード貼り付け</span>
              </button>

              {rawImageSrc && (
                <button
                  onClick={() => setShowOriginalOverlay(!showOriginalOverlay)}
                  className={`py-2 px-2.5 rounded-md border flex items-center space-x-1 ${
                    showOriginalOverlay
                      ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-600 font-bold'
                      : 'border-stone-300 dark:border-stone-700'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>元画像と重ねる</span>
                </button>
              )}
            </div>

            {!rawImageSrc ? (
              <div className="space-y-3">
                <div
                  onClick={() => imgFileInputRef.current?.click()}
                  className={`p-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center space-y-3 cursor-pointer text-center transition-all ${
                    isLight
                      ? 'border-emerald-300 bg-white/70 hover:bg-emerald-50/50'
                      : 'border-emerald-800/60 bg-[#101813] hover:bg-[#141f18]'
                  }`}
                >
                  <ImageIcon className="w-12 h-12 text-emerald-600 opacity-60" />
                  <div>
                    <p className="font-bold text-sm">手書き文字の写真やスケッチ画像をアップロード</p>
                    <p className="text-[11px] text-stone-500 mt-1">
                      AI/アルゴリズムが高精度なベクター輪郭（SVGベジェ曲線）へ自動変換します
                    </p>
                  </div>
                </div>

                {/* Recommended Image Specification Guide */}
                <div
                  className={`p-3.5 rounded-lg border text-[11px] space-y-2 ${
                    isLight
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : 'bg-[#101b14] border-emerald-800/60 text-emerald-200'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>フォント作成・ベクター変換におすすめの画像規格（推奨サイズ）</span>
                  </div>
                  <ul className="space-y-1.5 text-stone-600 dark:text-stone-300 pl-0.5 leading-relaxed">
                    <li className="flex items-start space-x-1.5">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">・推奨解像度:</span>
                      <span>
                        <strong className="text-stone-800 dark:text-emerald-300">1000 × 1000 px</strong> 〜 <strong className="text-stone-800 dark:text-emerald-300">2048 × 2048 px</strong> （正方形 1:1 比率）
                        <span className="block text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                          ※FontForge等の標準EM正方形枠（UnitsPerEm 1000/1024）と1:1で対応し、最も綺麗なベジェ曲線にトレースされます（最低512px角以上）。
                        </span>
                      </span>
                    </li>
                    <li className="flex items-start space-x-1.5">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">・コントラスト:</span>
                      <span>
                        <strong className="text-stone-800 dark:text-emerald-300">白背景に濃い黒文字</strong>（はっきりしたモノクロ・高コントラスト）
                      </span>
                    </li>
                    <li className="flex items-start space-x-1.5">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">・余白と配置:</span>
                      <span>文字の上下左右に <strong>10%〜15% 程度の適度な余白</strong> を確保してください。</span>
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* Vectorizer Preview */}
                <div
                  className={`relative aspect-square border rounded-md overflow-hidden flex items-center justify-center ${
                    isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#0f1611] border-[#25362b]'
                  }`}
                >
                  {/* Grid background */}
                  <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle, #10b981 1px, transparent 1px)',
                      backgroundSize: '16px 16px',
                    }}
                  />

                  {/* Original Image Overlay */}
                  {showOriginalOverlay && rawImageSrc && (
                    <img
                      src={rawImageSrc}
                      alt="Source"
                      className="absolute inset-0 w-full h-full object-contain opacity-35 filter grayscale pointer-events-none"
                    />
                  )}

                  {/* Generated Vector Contours */}
                  <svg viewBox="0 0 1000 1000" className="w-full h-full z-10">
                    <path
                      d={contoursToSvgPath(vectorContours)}
                      fill={isLight ? '#064e3b' : '#34d399'}
                      fillOpacity={0.85}
                      stroke={isLight ? '#047857' : '#6ee7b7'}
                      strokeWidth={3}
                    />
                  </svg>

                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white space-x-2 z-20">
                      <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                      <span className="text-xs font-bold">ベクター解析中...</span>
                    </div>
                  )}
                </div>

                {/* Parameters Controls */}
                <div className="space-y-3.5">
                  <div
                    className={`p-3 rounded-md border space-y-3 ${
                      isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#121c15] border-[#25362b]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs pb-1 border-b border-stone-200 dark:border-stone-800">
                      <span className="flex items-center space-x-1">
                        <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                        <span>ベクター化パラメーター調整</span>
                      </span>
                      <span className="text-[10px] text-stone-500 font-normal">
                        輪郭数: {vectorContours.length}
                      </span>
                    </div>

                    {/* Threshold */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>二値化の閾値 (しきい値):</span>
                        <span className="font-mono font-bold text-emerald-600">{threshold}</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="240"
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        className="w-full accent-emerald-700"
                      />
                    </div>

                    {/* Smoothing */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>スムージング (滑らかさ / ノイズ除去):</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {smoothing.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="8.0"
                        step="0.5"
                        value={smoothing}
                        onChange={(e) => setSmoothing(Number(e.target.value))}
                        className="w-full accent-emerald-700"
                      />
                    </div>

                    {/* Contrast */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>コントラスト強調:</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {contrast.toFixed(1)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.1"
                        value={contrast}
                        onChange={(e) => setContrast(Number(e.target.value))}
                        className="w-full accent-emerald-700"
                      />
                    </div>

                    {/* Invert */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px]">白黒を反転する（黒背景に白文字の場合）:</span>
                      <input
                        type="checkbox"
                        checked={invert}
                        onChange={(e) => setInvert(e.target.checked)}
                        className="w-4 h-4 accent-emerald-700"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        onApplyContours(vectorContours, false);
                        onClose();
                      }}
                      disabled={vectorContours.length === 0}
                      className={`w-full py-2.5 px-3 rounded-md font-bold flex items-center justify-center space-x-1.5 transition-colors ${
                        vectorContours.length === 0
                          ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                          : isLight
                          ? 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs'
                          : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-xs'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>文字「{selectedChar}」に置き換え適用</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          onApplyContours(vectorContours, true);
                          onClose();
                        }}
                        disabled={vectorContours.length === 0}
                        className={`py-2 px-2.5 rounded-md border flex items-center justify-center space-x-1 text-[11px] font-semibold ${
                          isLight
                            ? 'bg-white border-emerald-700 text-emerald-950 hover:bg-emerald-50'
                            : 'bg-[#18231c] border-emerald-600 text-emerald-200 hover:bg-[#202d24]'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-600" />
                        <span>既存輪郭に追加</span>
                      </button>

                      <button
                        onClick={handleDownloadSvg}
                        disabled={!generatedSvgString}
                        className={`py-2 px-2.5 rounded-md border flex items-center justify-center space-x-1 text-[11px] font-semibold ${
                          isLight
                            ? 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'
                            : 'bg-[#18231c] border-[#25362b] text-stone-300 hover:bg-[#202d24]'
                        }`}
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>SVGファイル保存</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CONTENT 2: DIRECT SVG IMPORT */}
        {activeTab === 'svg_import' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* SVG file upload */}
            <div className="flex items-center space-x-2">
              <input
                ref={svgFileInputRef}
                type="file"
                accept=".svg,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSvgFileUpload(f);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => svgFileInputRef.current?.click()}
                className={`py-2 px-3 rounded-md border flex items-center space-x-1.5 font-bold ${
                  isLight
                    ? 'bg-emerald-800 border-emerald-900 text-white hover:bg-emerald-900 shadow-xs'
                    : 'bg-emerald-700 border-emerald-600 text-white hover:bg-emerald-600 shadow-xs'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>SVGファイルを選択</span>
              </button>

              <button
                onClick={handlePasteClipboard}
                className={`py-2 px-3 rounded-md border flex items-center space-x-1.5 ${
                  isLight
                    ? 'bg-white border-stone-300 hover:bg-emerald-50'
                    : 'bg-[#1a261f] border-[#25362b] hover:bg-[#223127]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>クリップボード貼り付け</span>
              </button>

              <label className="flex items-center space-x-1.5 ml-auto text-[11px]">
                <input
                  type="checkbox"
                  checked={fitToEm}
                  onChange={(e) => {
                    setFitToEm(e.target.checked);
                    if (svgText) handleSvgTextChange(svgText);
                  }}
                  className="w-4 h-4 accent-emerald-700"
                />
                <span>1000×1000 EM枠に自動フィット</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Textarea for SVG code */}
              <div className="space-y-1.5 flex flex-col">
                <span className="text-[11px] font-bold">SVG XMLコード貼り付け:</span>
                <textarea
                  value={svgText}
                  onChange={(e) => handleSvgTextChange(e.target.value)}
                  placeholder={`<svg viewBox="0 0 1000 1000">\n  <path d="M 100 100 L 900 100 ..." />\n</svg>`}
                  className={`flex-1 min-h-[220px] p-2.5 rounded-md border font-mono text-[11px] leading-relaxed resize-none ${
                    isLight
                      ? 'bg-white border-stone-300 text-stone-800'
                      : 'bg-[#101813] border-[#25362b] text-emerald-100'
                  }`}
                />
                {svgParseError && (
                  <p className="text-[11px] text-red-600 font-semibold">{svgParseError}</p>
                )}
              </div>

              {/* Preview */}
              <div className="space-y-3 flex flex-col">
                <span className="text-[11px] font-bold">抽出プレビュー:</span>
                <div
                  className={`flex-1 min-h-[220px] border rounded-md flex items-center justify-center p-2 relative ${
                    isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#0f1611] border-[#25362b]'
                  }`}
                >
                  {svgParsedContours.length > 0 ? (
                    <svg viewBox="0 0 1000 1000" className="w-full h-full">
                      <path
                        d={contoursToSvgPath(svgParsedContours)}
                        fill={isLight ? '#064e3b' : '#34d399'}
                        fillOpacity={0.9}
                      />
                    </svg>
                  ) : (
                    <div className="text-center text-stone-400 text-xs">
                      SVGデータが入力されるとここにプレビューが表示されます
                    </div>
                  )}
                </div>

                {/* Apply Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onApplyContours(svgParsedContours, false);
                      onClose();
                    }}
                    disabled={svgParsedContours.length === 0}
                    className={`py-2 px-3 rounded-md font-bold flex items-center justify-center space-x-1.5 transition-colors ${
                      svgParsedContours.length === 0
                        ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                        : isLight
                        ? 'bg-emerald-800 hover:bg-emerald-900 text-white'
                        : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>文字に置き換え適用</span>
                  </button>

                  <button
                    onClick={() => {
                      onApplyContours(svgParsedContours, true);
                      onClose();
                    }}
                    disabled={svgParsedContours.length === 0}
                    className={`py-2 px-2.5 rounded-md border flex items-center justify-center space-x-1 font-semibold ${
                      svgParsedContours.length === 0
                        ? 'border-stone-300 text-stone-400 cursor-not-allowed'
                        : isLight
                        ? 'bg-white border-emerald-700 text-emerald-950 hover:bg-emerald-50'
                        : 'bg-[#18231c] border-emerald-600 text-emerald-200 hover:bg-[#202d24]'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>既存輪郭に追加</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
