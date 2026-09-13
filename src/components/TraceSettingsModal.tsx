import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Layers,
  Image as ImageIcon,
  Type,
  Upload,
  Camera,
  RotateCw,
  Sliders,
  Maximize2,
  RefreshCw,
  Move,
  Eye,
  Sparkles,
  Info,
} from 'lucide-react';
import { TraceSettings } from '../types';
import { ThemeMode } from '../utils/theme';

interface TraceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  traceSettings: TraceSettings;
  setTraceSettings: React.Dispatch<React.SetStateAction<TraceSettings>>;
  activeChar: string;
  selectedUnicode: number;
  theme: ThemeMode;
  onShowToast?: (text: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const TraceSettingsModal: React.FC<TraceSettingsModalProps> = ({
  isOpen,
  onClose,
  traceSettings,
  setTraceSettings,
  activeChar,
  selectedUnicode,
  theme,
  onShowToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [applyMode, setApplyMode] = useState<'char' | 'global'>('global');

  const isLight = theme === 'light';

  // Current active image source (either per-char or global)
  const currentImageSrc =
    traceSettings.charImages?.[selectedUnicode] || traceSettings.imageSrc;

  if (!isOpen) return null;

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (applyMode === 'char') {
        setTraceSettings((prev) => ({
          ...prev,
          enabled: true,
          type: 'image',
          charImages: {
            ...(prev.charImages || {}),
            [selectedUnicode]: dataUrl,
          },
        }));
      } else {
        setTraceSettings((prev) => ({
          ...prev,
          enabled: true,
          type: 'image',
          imageSrc: dataUrl,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = '';
  };

  const handlePasteClipboardImage = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            handleImageUpload(blob as File);
            return;
          }
        }
      }
      if (onShowToast) {
        onShowToast('クリップボードに画像が見つかりませんでした。スクリーンショット等をコピーしてから再度お試しください。', 'warning');
      }
    } catch (err) {
      console.warn('Clipboard read failed:', err);
      if (onShowToast) {
        onShowToast('クリップボードの読み取り権限がないか、ブラウザでサポートされていません。「画像を読み込む」ボタンから画像ファイルを選択してください。', 'warning');
      }
    }
  };

  const handleResetPosition = () => {
    setTraceSettings((prev) => ({
      ...prev,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
      contrast: 1,
      brightness: 1,
      grayscale: false,
      invert: false,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-lg border rounded-md shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-colors ${
          isLight
            ? 'bg-[#f7faf8] border-[#c8ded3] text-stone-800'
            : 'bg-[#151e18] border-[#25362b] text-emerald-100'
        }`}
      >
        {/* Header */}
        <div
          className={`p-3 sm:p-3.5 border-b flex items-center justify-between ${
            isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Layers className={`w-4 h-4 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
            <h2
              className={`text-xs font-bold uppercase tracking-wider ${
                isLight ? 'text-emerald-950' : 'text-emerald-200'
              }`}
            >
              看板・レタリング写真＆下絵トレース設定
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 text-xs">
          {/* Toggle Enable */}
          <div
            className={`flex items-center justify-between p-2.5 rounded-md border ${
              isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#101813] border-[#25362b]'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Eye className={`w-4 h-4 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
              <span className={`font-semibold ${isLight ? 'text-emerald-950' : 'text-emerald-200'}`}>
                下絵ガイドを表示する
              </span>
            </div>
            <input
              type="checkbox"
              checked={traceSettings.enabled}
              onChange={(e) => setTraceSettings((s) => ({ ...s, enabled: e.target.checked }))}
              className="w-4 h-4 accent-emerald-700 rounded"
            />
          </div>

          {/* Source Type Selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTraceSettings((s) => ({ ...s, type: 'image' }))}
              className={`p-2.5 rounded-md border flex flex-col items-center space-y-1 transition-all ${
                traceSettings.type === 'image'
                  ? isLight
                    ? 'bg-emerald-100 border-emerald-700 text-emerald-950 font-bold shadow-xs'
                    : 'bg-emerald-950 border-emerald-500 text-emerald-200 font-bold shadow-xs'
                  : isLight
                  ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                  : 'bg-[#101813] border-[#25362b] text-emerald-400 hover:bg-[#18231c]'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <span>看板写真・画像・スケッチ</span>
            </button>

            <button
              onClick={() => setTraceSettings((s) => ({ ...s, type: 'char' }))}
              className={`p-2.5 rounded-md border flex flex-col items-center space-y-1 transition-all ${
                traceSettings.type === 'char'
                  ? isLight
                    ? 'bg-emerald-100 border-emerald-700 text-emerald-950 font-bold shadow-xs'
                    : 'bg-emerald-950 border-emerald-500 text-emerald-200 font-bold shadow-xs'
                  : isLight
                  ? 'bg-white border-[#d8e6df] text-stone-600 hover:bg-emerald-50'
                  : 'bg-[#101813] border-[#25362b] text-emerald-400 hover:bg-[#18231c]'
              }`}
            >
              <Type className="w-4 h-4 text-emerald-600" />
              <span>標準フォント下絵文字</span>
            </button>
          </div>

          {/* IMAGE TRACE CONFIGURATION */}
          {traceSettings.type === 'image' ? (
            <div className="space-y-3">
              {/* Photo Upload & Camera Buttons */}
              <div
                className={`p-3 rounded-md border space-y-2.5 ${
                  isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#101813] border-[#25362b]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileInputChange}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`py-2 px-2.5 rounded-md border flex items-center justify-center space-x-1.5 transition-colors ${
                      isLight
                        ? 'bg-[#edf5f0] border-emerald-600 text-emerald-950 hover:bg-[#e0eee6]'
                        : 'bg-[#16201a] border-emerald-700 text-emerald-200 hover:bg-[#1e2a22]'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-semibold text-[11px]">画像ファイル読込</span>
                  </button>

                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className={`py-2 px-2.5 rounded-md border flex items-center justify-center space-x-1.5 transition-colors ${
                      isLight
                        ? 'bg-[#edf5f0] border-emerald-600 text-emerald-950 hover:bg-[#e0eee6]'
                        : 'bg-[#16201a] border-emerald-700 text-emerald-200 hover:bg-[#1e2a22]'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-semibold text-[11px]">カメラで看板撮影</span>
                  </button>

                  <button
                    onClick={handlePasteClipboardImage}
                    className={`py-2 px-2.5 rounded-md border flex items-center justify-center space-x-1.5 transition-colors ${
                      isLight
                        ? 'bg-[#edf5f0] border-emerald-600 text-emerald-950 hover:bg-[#e0eee6]'
                        : 'bg-[#16201a] border-emerald-700 text-emerald-200 hover:bg-[#1e2a22]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-semibold text-[11px]">クリップボード貼付</span>
                  </button>
                </div>

                {currentImageSrc && (
                  <div className="flex items-center justify-between pt-1 border-t text-[11px] text-emerald-700 font-medium">
                    <span className="flex items-center space-x-1">
                      <span>✓ 画像を読み込みました</span>
                    </span>
                    <button
                      onClick={() => {
                        if (applyMode === 'char') {
                          setTraceSettings((s) => {
                            const copy = { ...(s.charImages || {}) };
                            delete copy[selectedUnicode];
                            return { ...s, charImages: copy };
                          });
                        } else {
                          setTraceSettings((s) => ({ ...s, imageSrc: undefined }));
                        }
                      }}
                      className="text-rose-600 hover:underline"
                    >
                      画像を削除
                    </button>
                  </div>
                )}

                {/* Recommended Image Specification Guide */}
                <div
                  className={`p-2.5 rounded border text-[10.5px] space-y-1 ${
                    isLight
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-[#121c15] border-emerald-800/50 text-emerald-200'
                  }`}
                >
                  <div className="flex items-center space-x-1 font-bold text-emerald-700 dark:text-emerald-400">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>おすすめの画像仕様（フォント下絵・トレース用）</span>
                  </div>
                  <ul className="space-y-0.5 text-stone-600 dark:text-stone-300 pl-0.5 leading-snug">
                    <li>・<strong>推奨サイズ:</strong> 1000 × 1000 px 〜 2048 × 2048 px （1:1 正方形 / FontForge規格適合）</li>
                    <li>・<strong>背景・輪郭:</strong> 白背景に濃い黒文字（高コントラストなモノクロ）</li>
                    <li>・<strong>余白:</strong> 周囲に10〜15%の適度な余白</li>
                  </ul>
                </div>
              </div>

              {/* Photo Positioning & Adjustments */}
              <div
                className={`p-3 rounded-md border space-y-3 ${
                  isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#101813] border-[#25362b]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-semibold">
                    <Sliders className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
                    <span className={isLight ? 'text-emerald-950' : 'text-emerald-200'}>
                      写真の位置・サイズ・補正調整
                    </span>
                  </div>
                  <button
                    onClick={handleResetPosition}
                    className={`text-[10px] px-2 py-0.5 rounded border flex items-center space-x-1 ${
                      isLight
                        ? 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                        : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
                    }`}
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>位置リセット</span>
                  </button>
                </div>

                {/* Sliders: Scale & Position */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className={isLight ? 'text-stone-600' : 'text-emerald-400'}>拡大・縮小倍率</span>
                      <span className="font-mono">{Math.round(traceSettings.scale * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={4.0}
                      step={0.05}
                      value={traceSettings.scale ?? 1}
                      onChange={(e) => setTraceSettings((s) => ({ ...s, scale: Number(e.target.value) }))}
                      className="w-full accent-emerald-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className={isLight ? 'text-stone-600' : 'text-emerald-400'}>回転角度</span>
                      <span className="font-mono">{traceSettings.rotation || 0}°</span>
                    </div>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={traceSettings.rotation ?? 0}
                      onChange={(e) => setTraceSettings((s) => ({ ...s, rotation: Number(e.target.value) }))}
                      className="w-full accent-emerald-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className={isLight ? 'text-stone-600' : 'text-emerald-400'}>X位置 (左右移動)</span>
                      <span className="font-mono">{Math.round(traceSettings.offsetX ?? 0)}px</span>
                    </div>
                    <input
                      type="range"
                      min={-800}
                      max={800}
                      step={5}
                      value={traceSettings.offsetX ?? 0}
                      onChange={(e) => setTraceSettings((s) => ({ ...s, offsetX: Number(e.target.value) }))}
                      className="w-full accent-emerald-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className={isLight ? 'text-stone-600' : 'text-emerald-400'}>Y位置 (上下移動)</span>
                      <span className="font-mono">{Math.round(traceSettings.offsetY ?? 0)}px</span>
                    </div>
                    <input
                      type="range"
                      min={-800}
                      max={800}
                      step={5}
                      value={traceSettings.offsetY ?? 0}
                      onChange={(e) => setTraceSettings((s) => ({ ...s, offsetY: Number(e.target.value) }))}
                      className="w-full accent-emerald-700"
                    />
                  </div>
                </div>

                {/* Photo Enhancements: Contrast, Grayscale, Invert */}
                <div className={`pt-2 border-t grid grid-cols-2 sm:grid-cols-4 gap-2 ${isLight ? 'border-[#e0eee6]' : 'border-[#25362b]'}`}>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(traceSettings.grayscale)}
                      onChange={(e) => setTraceSettings((s) => ({ ...s, grayscale: e.target.checked }))}
                      className="w-3.5 h-3.5 accent-emerald-700 rounded"
                    />
                    <span className="text-[11px]">白黒化 (Monochrome)</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(traceSettings.invert)}
                      onChange={(e) => setTraceSettings((s) => ({ ...s, invert: e.target.checked }))}
                      className="w-3.5 h-3.5 accent-emerald-700 rounded"
                    />
                    <span className="text-[11px]">ネガ反転 (白黒逆転)</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(traceSettings.flipH)}
                      onChange={(e) => setTraceSettings((s) => ({ ...s, flipH: e.target.checked }))}
                      className="w-3.5 h-3.5 accent-emerald-700 rounded"
                    />
                    <span className="text-[11px]">左右反転</span>
                  </label>

                  <button
                    onClick={() =>
                      setTraceSettings((s) => ({
                        ...s,
                        rotation: ((s.rotation || 0) + 90) % 360,
                      }))
                    }
                    className={`py-1 px-2 rounded border text-[10px] font-semibold flex items-center justify-center space-x-1 ${
                      isLight
                        ? 'bg-stone-50 border-[#c8ded3] text-stone-700 hover:bg-stone-100'
                        : 'bg-[#18231c] border-[#25362b] text-emerald-300 hover:bg-[#223127]'
                    }`}
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>90°回転</span>
                  </button>
                </div>

                {/* Contrast Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className={isLight ? 'text-stone-600' : 'text-emerald-400'}>
                      コントラスト強調 (看板の文字輪郭をくっきり化)
                    </span>
                    <span className="font-mono">{Math.round((traceSettings.contrast || 1) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    value={traceSettings.contrast || 1}
                    onChange={(e) => setTraceSettings((s) => ({ ...s, contrast: Number(e.target.value) }))}
                    className="w-full accent-emerald-700"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* SYSTEM FONT TRACE CONFIGURATION */
            <div
              className={`space-y-2.5 p-3 rounded-md border ${
                isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#101813] border-[#25362b]'
              }`}
            >
              <div className="flex flex-col space-y-1">
                <label className={isLight ? 'text-stone-600' : 'text-emerald-400'}>
                  表示文字 (初期値: 現在選択中の文字)
                </label>
                <input
                  type="text"
                  value={traceSettings.text ?? activeChar ?? ''}
                  onChange={(e) => setTraceSettings((s) => ({ ...s, text: e.target.value }))}
                  className={`border rounded p-2 focus:outline-none ${
                    isLight
                      ? 'bg-[#f7faf8] border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                      : 'bg-[#16201a] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                  }`}
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className={isLight ? 'text-stone-600' : 'text-emerald-400'}>
                  下絵フォント書体
                </label>
                <select
                  value={traceSettings.fontFamily ?? "'Noto Sans JP', sans-serif"}
                  onChange={(e) => setTraceSettings((s) => ({ ...s, fontFamily: e.target.value }))}
                  className={`border rounded p-2 focus:outline-none ${
                    isLight
                      ? 'bg-[#f7faf8] border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                      : 'bg-[#16201a] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                  }`}
                >
                  <option value="'Noto Sans JP', sans-serif">ゴシック体 (Gothic / Sans-serif)</option>
                  <option value="'Noto Serif JP', serif">明朝体 (Mincho / Serif)</option>
                  <option value="sans-serif">標準 Sans-Serif</option>
                  <option value="serif">標準 Serif</option>
                  <option value="monospace">等幅 (Monospace)</option>
                  <option value="cursive">手書き風 (Cursive)</option>
                </select>
              </div>

              {/* Position & Scale Controls for Font Trace */}
              <div className={`pt-2 border-t space-y-2.5 ${isLight ? 'border-[#e0eee6]' : 'border-[#25362b]'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs flex items-center space-x-1">
                    <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                    <span>お手本文字の位置・サイズ調整</span>
                  </span>
                  <button
                    onClick={handleResetPosition}
                    className={`text-[10px] px-2 py-0.5 rounded border flex items-center space-x-1 ${
                      isLight
                        ? 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                        : 'bg-[#18231c] border-[#25362b] text-emerald-400 hover:bg-[#202d24]'
                    }`}
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>位置リセット</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[10px]">
                      <span>倍率</span>
                      <span className="font-mono">{Math.round((traceSettings.scale ?? 1) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={2.0}
                      step={0.05}
                      value={traceSettings.scale ?? 1}
                      onChange={(e) => setTraceSettings((s) => ({ ...s, scale: Number(e.target.value) }))}
                      className="w-full accent-emerald-700"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[10px]">
                      <span>X移動</span>
                      <span className="font-mono">{Math.round(traceSettings.offsetX ?? 0)}</span>
                    </div>
                    <input
                      type="range"
                      min={-400}
                      max={400}
                      step={5}
                      value={traceSettings.offsetX ?? 0}
                      onChange={(e) => setTraceSettings((s) => ({ ...s, offsetX: Number(e.target.value) }))}
                      className="w-full accent-emerald-700"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[10px]">
                      <span>Y移動</span>
                      <span className="font-mono">{Math.round(traceSettings.offsetY ?? 0)}</span>
                    </div>
                    <input
                      type="range"
                      min={-400}
                      max={400}
                      step={5}
                      value={traceSettings.offsetY ?? 0}
                      onChange={(e) => setTraceSettings((s) => ({ ...s, offsetY: Number(e.target.value) }))}
                      className="w-full accent-emerald-700"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Opacity Slider */}
          <div
            className={`p-3 rounded-md border space-y-1 ${
              isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#101813] border-[#25362b]'
            }`}
          >
            <div className={`flex justify-between ${isLight ? 'text-stone-600' : 'text-emerald-400'}`}>
              <span className="font-semibold">下絵の透明度 (不透明度)</span>
              <span className="font-mono">{Math.round((traceSettings.opacity ?? 0.3) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={1.0}
              step={0.05}
              value={traceSettings.opacity ?? 0.3}
              onChange={(e) => setTraceSettings((s) => ({ ...s, opacity: Number(e.target.value) }))}
              className="w-full accent-emerald-700"
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className={`p-3 border-t flex items-center justify-between ${
            isLight ? 'bg-[#edf5f0] border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <span className={`text-[11px] ${isLight ? 'text-stone-500' : 'text-emerald-400'}`}>
            ※キャンバス上で「下絵移動」モードでも直接ドラッグ移動できます
          </span>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded text-xs font-semibold ${
              isLight
                ? 'bg-emerald-800 hover:bg-emerald-900 text-white'
                : 'bg-emerald-700 hover:bg-emerald-600 text-white'
            }`}
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};
