import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  SlidersHorizontal,
  PenTool,
  Bookmark,
  Paintbrush,
  Pencil,
  Feather,
  Wand2,
  Activity,
  Layers,
} from 'lucide-react';
import { BrushStyle, UserPenPreset } from '../types';
import { DEFAULT_PEN_PRESETS, saveUserPenPresets } from '../utils/presetData';

interface PenPresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Current Active Writing Parameters
  currentParams: {
    brushStyle: BrushStyle;
    brushWidth: number;
    pressureSensitivity: 'high' | 'normal' | 'low' | 'off';
    autoSmoothBrush: boolean;
    smoothStrength: 'mild' | 'standard' | 'strong';
    smoothPreserveCorners: boolean;
    autoUnionBrush: boolean;
  };
  // Callback when a preset is applied
  onApplyPreset: (preset: UserPenPreset) => void;
  // Presets State
  presets: UserPenPreset[];
  onUpdatePresets: (newPresets: UserPenPreset[]) => void;
  theme?: 'light' | 'dark';
}

const BRUSH_STYLE_NAMES: Record<BrushStyle, string> = {
  brush: '毛筆・書道筆',
  signpen: 'サインペン・太字',
  sumi: '墨だまり筆',
  marumoji: '丸文字・ポップ',
  fountain: '万年筆・Gペン',
  marker: '丸マーカー',
  ballpoint: 'ボールペン',
  calligraphy: '平筆カリグラフィー',
  highlighter: '平マーカー・リボン',
  pencil: '鉛筆・細字',
  chalk: 'チョーク',
  sharp: 'カクカク角筆',
  sharp_round: 'カクカク角丸筆',
  wobbly: 'ゆらぎ手書き線',
  polygon: '多角形ペン',
};

export const PenPresetsModal: React.FC<PenPresetsModalProps> = ({
  isOpen,
  onClose,
  currentParams,
  onApplyPreset,
  presets,
  onUpdatePresets,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [newPresetName, setNewPresetName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Test stroke canvas ref inside modal
  const testCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  if (!isOpen) return null;

  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    const nameToSave = newPresetName.trim() || `カスタム書き味 ${presets.length + 1}`;
    const newPreset: UserPenPreset = {
      id: `custom-preset-${Date.now()}`,
      name: nameToSave,
      isCustom: true,
      brushStyle: currentParams.brushStyle,
      brushWidth: currentParams.brushWidth,
      pressureSensitivity: currentParams.pressureSensitivity,
      autoSmoothBrush: currentParams.autoSmoothBrush,
      smoothStrength: currentParams.smoothStrength,
      smoothPreserveCorners: currentParams.smoothPreserveCorners,
      autoUnionBrush: currentParams.autoUnionBrush,
      createdAt: Date.now(),
    };

    const nextPresets = [newPreset, ...presets];
    onUpdatePresets(nextPresets);
    saveUserPenPresets(nextPresets);
    setNewPresetName('');
    setIsAdding(false);
    showToast(`「${nameToSave}」をプリセット保存しました`);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextPresets = presets.filter((p) => p.id !== id);
    onUpdatePresets(nextPresets);
    saveUserPenPresets(nextPresets);
    showToast('プリセットを削除しました');
  };

  const handleResetDefaults = () => {
    if (window.confirm('プリセット一覧を初期状態に戻しますか？')) {
      onUpdatePresets(DEFAULT_PEN_PRESETS);
      saveUserPenPresets(DEFAULT_PEN_PRESETS);
      showToast('プリセットを初期状態にリセットしました');
    }
  };

  // Check if current parameters match an existing preset
  const isCurrentActive = (p: UserPenPreset) => {
    return (
      p.brushStyle === currentParams.brushStyle &&
      p.brushWidth === currentParams.brushWidth &&
      p.pressureSensitivity === currentParams.pressureSensitivity &&
      p.autoSmoothBrush === currentParams.autoSmoothBrush &&
      p.smoothStrength === currentParams.smoothStrength &&
      p.smoothPreserveCorners === currentParams.smoothPreserveCorners &&
      p.autoUnionBrush === currentParams.autoUnionBrush
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className={`w-full max-w-2xl rounded-2xl shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden ${
          isLight
            ? 'bg-white border-stone-200 text-stone-800'
            : 'bg-[#141d18] border-[#25362b] text-emerald-100'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between shrink-0 ${
            isLight ? 'border-stone-200 bg-stone-50' : 'border-[#223025] bg-[#111814]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-2 rounded-xl ${
                isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-[#1e2d24] text-emerald-400'
              }`}
            >
              <Bookmark className="w-5 h-5 fill-current opacity-80" />
            </div>
            <div>
              <h2 className="text-base font-extrabold flex items-center space-x-2">
                <span>書き味プリセット管理</span>
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  全{presets.length}件
                </span>
              </h2>
              <p className="text-xs opacity-70">筆圧感度・手ブレ補正・太さ・ペン種を一括保存＆ワンタップ適用</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isLight ? 'hover:bg-stone-200 text-stone-600' : 'hover:bg-[#25362b] text-emerald-300'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white text-xs font-bold py-2 px-4 text-center animate-fadeIn shrink-0 flex items-center justify-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Active Settings Snapshot Bar */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isLight
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : 'bg-[#18261e] border-[#23382c] text-emerald-100'
            }`}
          >
            <div className="space-y-1">
              <div className="text-xs font-bold flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-400">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>現在のキャンバス描き味設定</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-bold">
                  {BRUSH_STYLE_NAMES[currentParams.brushStyle] || currentParams.brushStyle}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/20 dark:bg-emerald-500/20 border border-emerald-500/30">
                  太さ: {currentParams.brushWidth}px
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/20 dark:bg-emerald-500/20 border border-emerald-500/30">
                  筆圧: {currentParams.pressureSensitivity === 'off' ? 'OFF' : `感度:${currentParams.pressureSensitivity}`}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/20 dark:bg-emerald-500/20 border border-emerald-500/30">
                  補正: {currentParams.autoSmoothBrush ? `補正強度:${currentParams.smoothStrength}` : 'OFF'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsAdding(!isAdding)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-xs active:scale-95 shrink-0 ${
                isLight
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>この書き味を保存</span>
            </button>
          </div>

          {/* New Preset Creation Form */}
          {isAdding && (
            <form
              onSubmit={handleCreatePreset}
              className={`p-4 rounded-xl border space-y-3 animate-fadeIn ${
                isLight ? 'bg-stone-50 border-stone-300' : 'bg-[#18231c] border-[#273d2f]'
              }`}
            >
              <div className="text-xs font-bold flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                <span>新プリセットの作成</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="プリセット名 (例: 和風習字ペン・強筆圧)"
                  className={`flex-1 px-3 py-2 text-xs rounded-xl border outline-none font-bold ${
                    isLight
                      ? 'bg-white border-stone-300 text-stone-800 focus:border-emerald-600'
                      : 'bg-[#121a15] border-[#25362b] text-white focus:border-emerald-400'
                  }`}
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-xs active:scale-95 shrink-0"
                >
                  保存する
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                    isLight ? 'bg-stone-200 text-stone-700' : 'bg-[#223025] text-stone-300'
                  }`}
                >
                  キャンセル
                </button>
              </div>
            </form>
          )}

          {/* Presets List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-500 dark:text-emerald-400/80 px-1">
              <span>保存済み書き味プリセット</span>
              <button
                onClick={handleResetDefaults}
                className="hover:underline flex items-center space-x-1 text-[11px] opacity-70 hover:opacity-100"
                title="プリセット一覧を初期に戻す"
              >
                <RotateCcw className="w-3 h-3" />
                <span>初期状態に戻す</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {presets.map((p) => {
                const isActive = isCurrentActive(p);
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      onApplyPreset(p);
                      showToast(`「${p.name}」を適用しました`);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative group flex flex-col justify-between ${
                      isActive
                        ? isLight
                          ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/30'
                          : 'bg-[#1c2e23] border-emerald-500 ring-2 ring-emerald-500/30'
                        : isLight
                        ? 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800 shadow-xs'
                        : 'bg-[#16201a] hover:bg-[#1b2820] border-[#24352a] text-emerald-100 shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-extrabold line-clamp-1">{p.name}</span>
                          {p.isCustom && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold shrink-0">
                              ユーザー
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 shrink-0">
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white flex items-center space-x-1">
                              <Check className="w-3 h-3" />
                              <span>使用中</span>
                            </span>
                          )}
                          {p.isCustom && (
                            <button
                              onClick={(e) => handleDeletePreset(p.id, e)}
                              className="p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-red-500/20 hover:text-red-500 transition-all"
                              title="削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Attribute Pills */}
                      <div className="flex flex-wrap items-center gap-1 text-[10.5px]">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            isLight
                              ? 'bg-stone-100 text-stone-700'
                              : 'bg-[#1f2d24] text-emerald-300'
                          }`}
                        >
                          ペン: {BRUSH_STYLE_NAMES[p.brushStyle] || p.brushStyle}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-mono ${
                            isLight
                              ? 'bg-stone-100 text-stone-600'
                              : 'bg-[#1b261f] text-emerald-400'
                          }`}
                        >
                          太さ: {p.brushWidth}px
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded ${
                            p.pressureSensitivity !== 'off'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
                              : 'bg-stone-200/50 dark:bg-stone-800 text-stone-500'
                          }`}
                        >
                          筆圧: {p.pressureSensitivity === 'off' ? 'OFF' : p.pressureSensitivity}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded ${
                            p.autoSmoothBrush
                              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold'
                              : 'bg-stone-200/50 dark:bg-stone-800 text-stone-500'
                          }`}
                        >
                          補正: {p.autoSmoothBrush ? p.smoothStrength : 'OFF'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-stone-200/60 dark:border-[#223025] flex items-center justify-between text-[11px] opacity-70">
                      <span>クリックでこの書き味を適用</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">
                        適用 →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-between shrink-0 ${
            isLight ? 'border-stone-200 bg-stone-50' : 'border-[#223025] bg-[#111814]'
          }`}
        >
          <span className="text-xs opacity-70">設定はブラウザ（localStorage）に自動保存されます</span>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              isLight
                ? 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                : 'bg-[#223025] hover:bg-[#2b3d2f] text-emerald-200'
            }`}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
