import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  ArrowRightLeft,
  CheckCircle2,
  RotateCcw,
  Eye,
  Info,
  Maximize2,
  AlignHorizontalDistributeCenter,
  MoveHorizontal,
} from 'lucide-react';
import { FontProject, GlyphData } from '../types';
import {
  KERNING_PRESET_GROUPS,
  batchAdjustSidebearings,
  SidebearingBatchOptions,
} from '../utils/metricsHelper';
import { contoursToSvgPath, normalizeGlyphContoursWinding, getContoursBoundingBox } from '../utils/pathUtils';

interface KerningModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: FontProject;
  setProject?: React.Dispatch<React.SetStateAction<FontProject>>;
  onUpdateProject?: (updater: (prev: FontProject) => FontProject) => void;
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onShowToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  theme: 'light' | 'dark';
}

export const KerningModal: React.FC<KerningModalProps> = ({
  isOpen,
  onClose,
  project,
  setProject,
  onUpdateProject,
  showToast,
  onShowToast,
  theme,
}) => {
  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState<'kerning' | 'sidebearing'>('kerning');

  // Unified updater function supporting both prop styles
  const updateProject = useMemo(() => {
    if (onUpdateProject) return onUpdateProject;
    if (setProject) return setProject;
    return (_updater: any) => {};
  }, [onUpdateProject, setProject]);

  const notify = (msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    if (showToast) {
      showToast(msg, type);
    } else if (onShowToast) {
      onShowToast(msg, type);
    }
  };

  // -------------------------------------------------------------
  // Kerning Pairs State
  // -------------------------------------------------------------
  const [selectedPairKey, setSelectedPairKey] = useState<string>('「,「');
  const [customLeft, setCustomLeft] = useState<string>('');
  const [customRight, setCustomRight] = useState<string>('');
  const [customValue, setCustomValue] = useState<number>(-100);
  const [sampleText, setSampleText] = useState<string>('「こんにちは」AVANT-GARDE 110番');

  const kerningPairs = project.kerning || {};

  // Find or calculate current pair kerning value
  const currentPairValue = useMemo(() => {
    if (selectedPairKey in kerningPairs) {
      return kerningPairs[selectedPairKey];
    }
    // Check if preset default exists
    for (const group of KERNING_PRESET_GROUPS) {
      const match = group.pairs.find(
        (p) => `${p.left},${p.right}` === selectedPairKey
      );
      if (match) return match.defaultVal;
    }
    return 0;
  }, [selectedPairKey, kerningPairs]);

  // Selected pair character glyphs
  const pairGlyphs = useMemo(() => {
    const parts = selectedPairKey.split(',');
    const leftChar = parts[0] || '';
    const rightChar = parts[1] || '';

    const leftCode = leftChar.codePointAt(0);
    const rightCode = rightChar.codePointAt(0);

    const leftGlyph = leftCode ? project.glyphs[leftCode] : null;
    const rightGlyph = rightCode ? project.glyphs[rightCode] : null;

    return { leftChar, rightChar, leftGlyph, rightGlyph };
  }, [selectedPairKey, project.glyphs]);

  // -------------------------------------------------------------
  // Sidebearing State
  // -------------------------------------------------------------
  const [sbScope, setSbScope] = useState<SidebearingBatchOptions['scope']>('all');
  const [sbMode, setSbMode] = useState<SidebearingBatchOptions['mode']>('center');
  const [sbLsb, setSbLsb] = useState<number>(60);
  const [sbRsb, setSbRsb] = useState<number>(60);
  const [sbTargetAdvance, setSbTargetAdvance] = useState<number>(1000);
  const [sbOffsetDelta, setSbOffsetDelta] = useState<number>(0);
  const [sbPreviewChar, setSbPreviewChar] = useState<string>('あ');

  // Preview Glyph for Sidebearings
  const sbPreviewGlyph = useMemo(() => {
    const code = sbPreviewChar.codePointAt(0);
    if (!code) return null;
    return project.glyphs[code] || null;
  }, [sbPreviewChar, project.glyphs]);

  if (!isOpen) return null;

  // Add or update kerning pair
  const handleUpdateKerningValue = (val: number) => {
    updateProject((prev) => ({
      ...prev,
      kerning: {
        ...(prev.kerning || {}),
        [selectedPairKey]: val,
      },
      updatedAt: Date.now(),
    }));
  };

  // Add custom kerning pair
  const handleAddCustomPair = () => {
    if (!customLeft || !customRight) {
      notify('左文字と右文字の両方を入力してください', 'warning');
      return;
    }
    const pairKey = `${customLeft},${customRight}`;
    updateProject((prev) => ({
      ...prev,
      kerning: {
        ...(prev.kerning || {}),
        [pairKey]: customValue,
      },
      updatedAt: Date.now(),
    }));
    setSelectedPairKey(pairKey);
    setCustomLeft('');
    setCustomRight('');
    notify(`ペア「${pairKey}」(${customValue}) を追加しました`, 'success');
  };

  // Remove kerning pair
  const handleRemovePair = (key: string) => {
    updateProject((prev) => {
      const next = { ...(prev.kerning || {}) };
      delete next[key];
      return {
        ...prev,
        kerning: next,
        updatedAt: Date.now(),
      };
    });
    notify(`ペア「${key}」のカーニング設定を解除しました`, 'info');
  };

  // Apply preset group
  const handleApplyPresetGroup = (group: (typeof KERNING_PRESET_GROUPS)[0]) => {
    updateProject((prev) => {
      const next = { ...(prev.kerning || {}) };
      for (const p of group.pairs) {
        next[`${p.left},${p.right}`] = p.defaultVal;
      }
      return {
        ...prev,
        kerning: next,
        updatedAt: Date.now(),
      };
    });
    notify(`プリセット「${group.name}」(${group.pairs.length}ペア) を一括登録しました`, 'success');
  };

  // Execute Batch Sidebearings
  const handleExecuteSidebearingBatch = () => {
    const { updatedGlyphs, modifiedCount } = batchAdjustSidebearings(project.glyphs, {
      scope: sbScope,
      mode: sbMode,
      lsb: sbLsb,
      rsb: sbRsb,
      targetAdvance: sbTargetAdvance,
      offsetDelta: sbOffsetDelta,
    });

    if (modifiedCount === 0) {
      notify('対象となる文字がまだ作図されていません', 'warning');
      return;
    }

    updateProject((prev) => ({
      ...prev,
      glyphs: updatedGlyphs,
      updatedAt: Date.now(),
    }));

    notify(`${modifiedCount} 文字の余白・送り幅を一括調整しました！`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border shadow-2xl overflow-hidden ${
          isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-[#151e18] border-[#293d30] text-emerald-100'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
            isLight ? 'bg-emerald-50/70 border-emerald-200/80' : 'bg-[#1b261f] border-[#2b3e32]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs">
              <MoveHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>カーニング & サイドベアリング調整スタジオ</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-medium">
                  組版最適化
                </span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-emerald-400/80">
                文字間のすきま（ペアカーニング）と左右余白（サイドベアリング）を一括調整します
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div
          className={`flex border-b px-5 pt-2 gap-2 text-xs font-bold shrink-0 ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#131b15] border-[#223126]'
          }`}
        >
          <button
            onClick={() => setActiveTab('kerning')}
            className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors ${
              activeTab === 'kerning'
                ? isLight
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-emerald-300'
            }`}
          >
            <MoveHorizontal className="w-3.5 h-3.5" />
            <span>ペアカーニング調整（約物・欧文・かな）</span>
          </button>

          <button
            onClick={() => setActiveTab('sidebearing')}
            className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors ${
              activeTab === 'sidebearing'
                ? isLight
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-emerald-300'
            }`}
          >
            <AlignHorizontalDistributeCenter className="w-3.5 h-3.5" />
            <span>サイドベアリング（左右余白・送り幅）一括調整</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'kerning' ? (
            /* ========================================================= */
            /* TAB 1: PAIR KERNING                                       */
            /* ========================================================= */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Preset Groups & Pair List */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                {/* Preset Fast Loader */}
                <div
                  className={`p-3.5 rounded-lg border flex flex-col gap-2 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#19231c] border-[#2b3e32]'
                  }`}
                >
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>おすすめカーニング一括プリセット</span>
                  </span>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {KERNING_PRESET_GROUPS.map((group) => (
                      <div
                        key={group.id}
                        className={`p-2 rounded border flex items-center justify-between text-xs transition-colors ${
                          isLight ? 'bg-white border-stone-200' : 'bg-[#141c16] border-[#243428]'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-[11px]">{group.name}</span>
                          <span className="text-[10px] text-stone-500">{group.description}</span>
                        </div>
                        <button
                          onClick={() => handleApplyPresetGroup(group)}
                          className="px-2.5 py-1 text-[10px] font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-xs"
                        >
                          一括登録
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Pair Input */}
                <div
                  className={`p-3.5 rounded-lg border flex flex-col gap-2 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#19231c] border-[#2b3e32]'
                  }`}
                >
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>自由なペアを追加</span>
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="text"
                      maxLength={1}
                      placeholder="左 (A)"
                      value={customLeft}
                      onChange={(e) => setCustomLeft(e.target.value)}
                      className="w-14 p-1.5 rounded border text-center font-bold bg-white dark:bg-[#121a14] border-stone-300 dark:border-stone-700"
                    />
                    <span className="text-stone-400 font-bold">+</span>
                    <input
                      type="text"
                      maxLength={1}
                      placeholder="右 (V)"
                      value={customRight}
                      onChange={(e) => setCustomRight(e.target.value)}
                      className="w-14 p-1.5 rounded border text-center font-bold bg-white dark:bg-[#121a14] border-stone-300 dark:border-stone-700"
                    />
                    <input
                      type="number"
                      step={10}
                      placeholder="-100"
                      value={customValue}
                      onChange={(e) => setCustomValue(Number(e.target.value))}
                      className="w-20 p-1.5 rounded border text-center font-mono font-bold bg-white dark:bg-[#121a14] border-stone-300 dark:border-stone-700"
                    />
                    <button
                      onClick={handleAddCustomPair}
                      className="flex-1 py-1.5 px-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    >
                      追加
                    </button>
                  </div>
                </div>

                {/* Registered Pairs List */}
                <div
                  className={`p-3 rounded-lg border flex-1 flex flex-col min-h-48 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#19231c] border-[#2b3e32]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 dark:text-emerald-300 mb-2">
                    <span>登録済みペア一覧 ({Object.keys(kerningPairs).length} 件):</span>
                    {Object.keys(kerningPairs).length > 0 && (
                      <button
                        onClick={() => {
                          if (confirm('登録されているすべてのカーニングをクリアしますか？')) {
                            updateProject((prev) => ({ ...prev, kerning: {}, updatedAt: Date.now() }));
                          }
                        }}
                        className="text-[10px] text-red-500 hover:text-red-700"
                      >
                        全削除
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-56 flex flex-col gap-1 pr-1">
                    {Object.entries(kerningPairs).length === 0 ? (
                      <div className="text-center p-6 text-xs text-stone-400 dark:text-emerald-700">
                        上のプリセットから一括登録するか、自由な文字ペアを追加してください
                      </div>
                    ) : (
                      Object.entries(kerningPairs).map(([pairKey, val]) => (
                        <div
                          key={pairKey}
                          onClick={() => setSelectedPairKey(pairKey)}
                          className={`p-2 rounded border flex items-center justify-between text-xs cursor-pointer transition-all ${
                            selectedPairKey === pairKey
                              ? isLight
                                ? 'bg-emerald-100 border-emerald-500 text-emerald-950 font-bold'
                                : 'bg-emerald-950 border-emerald-400 text-emerald-100 font-bold'
                              : isLight
                              ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                              : 'bg-[#141c16] border-[#243428] text-stone-300 hover:bg-[#1a251e]'
                          }`}
                        >
                          <span className="font-mono text-sm tracking-widest">{pairKey.replace(',', ' ')}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs">
                              {Number(val) > 0 ? `+${val}` : `${val}`}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemovePair(pairKey);
                              }}
                              className="p-1 rounded text-stone-400 hover:text-red-600 transition-colors"
                              title="ペアを削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Live Pair Preview & Slider Controls */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                {/* Active Pair Control Box */}
                <div
                  className={`p-4 rounded-lg border flex flex-col gap-4 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#19231c] border-[#2b3e32]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                      <span>選択ペアの字間微調整</span>
                    </span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 text-sm">
                      「{pairGlyphs.leftChar}」と「{pairGlyphs.rightChar}」
                    </span>
                  </div>

                  {/* Value Slider */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500">カーニング変位値 (フォント単位):</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step={5}
                          value={currentPairValue}
                          onChange={(e) => handleUpdateKerningValue(Number(e.target.value))}
                          className="w-20 p-1 text-center font-mono font-bold rounded border bg-white dark:bg-[#121a14] border-stone-300 dark:border-stone-700"
                        />
                        <span className="text-xs text-stone-400">units</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-300"
                      max="150"
                      step="5"
                      value={currentPairValue}
                      onChange={(e) => handleUpdateKerningValue(Number(e.target.value))}
                      className="w-full h-2 accent-emerald-600 bg-stone-200 dark:bg-stone-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-stone-400">
                      <span>-300 (大幅に詰める)</span>
                      <span>0 (標準)</span>
                      <span>+150 (空ける)</span>
                    </div>
                  </div>

                  {/* Visual Pair Comparison */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-stone-500">
                      字間比較プレビュー（上: カーニングなし / 下: カーニング適用後）:
                    </span>

                    {/* Compare Container */}
                    <div className="grid grid-rows-2 gap-2 p-3 rounded-lg border bg-white dark:bg-[#101712] border-stone-200 dark:border-stone-800">
                      {/* Row 1: Without Kerning */}
                      <div className="flex items-center gap-3 border-b pb-2 border-stone-100 dark:border-stone-800/80">
                        <span className="text-[10px] text-stone-400 w-16 shrink-0">通常(±0)</span>
                        <div className="h-16 flex items-center relative overflow-visible">
                          <svg viewBox="0 0 2000 1000" className="h-16 overflow-visible">
                            {/* Left Glyph */}
                            {pairGlyphs.leftGlyph && (
                              <path
                                d={contoursToSvgPath(pairGlyphs.leftGlyph.contours || [])}
                                fill={isLight ? '#57534e' : '#6ee7b7'}
                                opacity={0.7}
                              />
                            )}
                            {/* Right Glyph shifted by regular advance */}
                            {pairGlyphs.rightGlyph && (
                              <g transform={`translate(${pairGlyphs.leftGlyph?.advanceWidth || 1000}, 0)`}>
                                <path
                                  d={contoursToSvgPath(pairGlyphs.rightGlyph.contours || [])}
                                  fill={isLight ? '#57534e' : '#6ee7b7'}
                                  opacity={0.7}
                                />
                              </g>
                            )}
                          </svg>
                        </div>
                      </div>

                      {/* Row 2: With Kerning */}
                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 w-16 shrink-0">
                          {currentPairValue > 0 ? `+${currentPairValue}` : currentPairValue} 適用
                        </span>
                        <div className="h-16 flex items-center relative overflow-visible">
                          <svg viewBox="0 0 2000 1000" className="h-16 overflow-visible">
                            {/* Left Glyph */}
                            {pairGlyphs.leftGlyph && (
                              <path
                                d={contoursToSvgPath(pairGlyphs.leftGlyph.contours || [])}
                                fill={isLight ? '#1c1917' : '#34d399'}
                              />
                            )}
                            {/* Right Glyph shifted by regular advance + kerning offset */}
                            {pairGlyphs.rightGlyph && (
                              <g
                                transform={`translate(${
                                  (pairGlyphs.leftGlyph?.advanceWidth || 1000) + currentPairValue
                                }, 0)`}
                              >
                                <path
                                  d={contoursToSvgPath(pairGlyphs.rightGlyph.contours || [])}
                                  fill={isLight ? '#1c1917' : '#34d399'}
                                />
                              </g>
                            )}
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Sample Sentence Testing */}
                <div
                  className={`p-3.5 rounded-lg border flex flex-col gap-2 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#19231c] border-[#2b3e32]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>リアルタイム組版テスト</span>
                    </span>
                    <span className="text-[10px] text-stone-400">文字を入力してテストできます</span>
                  </div>
                  <input
                    type="text"
                    value={sampleText}
                    onChange={(e) => setSampleText(e.target.value)}
                    className="w-full p-2 text-xs rounded border bg-white dark:bg-[#121a14] border-stone-300 dark:border-stone-700"
                    placeholder="テスト組版テキスト"
                  />

                  {/* Render Sample Canvas */}
                  <div className="p-4 rounded border bg-white dark:bg-[#101712] border-stone-200 dark:border-stone-800 min-h-20 flex items-center justify-center overflow-x-auto shadow-inner">
                    <div className="flex items-center h-20">
                      <svg viewBox="0 0 5000 1000" className="h-20 overflow-visible">
                        {(() => {
                          const chars = [...sampleText];
                          let cursorX = 50;
                          return chars.map((ch, idx) => {
                            const code = ch.codePointAt(0);
                            const glyph = code ? project.glyphs[code] : null;
                            const currentAdvance = glyph?.advanceWidth || 1000;

                            // Calculate kerning with next char
                            let kernOffset = 0;
                            if (idx < chars.length - 1) {
                              const nextChar = chars[idx + 1];
                              const pairKey = `${ch},${nextChar}`;
                              kernOffset = kerningPairs[pairKey] || 0;
                            }

                            const x = cursorX;
                            cursorX += currentAdvance + kernOffset;

                            if (!glyph || !glyph.contours || glyph.contours.length === 0) {
                              // Missing fallback box
                              return (
                                <g key={idx} transform={`translate(${x}, 0)`}>
                                  <rect
                                    x={50}
                                    y={100}
                                    width={currentAdvance - 100}
                                    height={800}
                                    fill="none"
                                    stroke={isLight ? '#e5e7eb' : '#223126'}
                                    strokeDasharray="20 20"
                                  />
                                </g>
                              );
                            }

                            return (
                              <g key={idx} transform={`translate(${x}, 0)`}>
                                <path
                                  d={contoursToSvgPath(normalizeGlyphContoursWinding(glyph.contours))}
                                  fill={isLight ? '#1c1917' : '#34d399'}
                                  fillRule="nonzero"
                                />
                              </g>
                            );
                          });
                        })()}
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* TAB 2: SIDEBEARINGS BATCH ADJUSTMENT                      */
            /* ========================================================= */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Controls */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                {/* Scope Selection */}
                <div
                  className={`p-3.5 rounded-lg border flex flex-col gap-3 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#19231c] border-[#2b3e32]'
                  }`}
                >
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <AlignHorizontalDistributeCenter className="w-3.5 h-3.5 text-emerald-600" />
                    <span>調整対象の文字カテゴリ</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'all', name: '全グリフ一括' },
                        { id: 'hiragana', name: 'ひらがな' },
                        { id: 'katakana', name: 'カタカナ' },
                        { id: 'kanji', name: '漢字' },
                        { id: 'latin', name: '英数字' },
                        { id: 'symbols', name: '記号・約物' },
                      ] as const
                    ).map((sc) => (
                      <button
                        key={sc.id}
                        onClick={() => setSbScope(sc.id)}
                        className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${
                          sbScope === sc.id
                            ? isLight
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-emerald-400 text-stone-950 font-black'
                            : isLight
                            ? 'bg-white border text-stone-600 hover:bg-stone-100'
                            : 'bg-[#223126] text-emerald-300 hover:bg-[#2c3f31]'
                        }`}
                      >
                        {sc.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Adjustment Mode Card */}
                <div
                  className={`p-3.5 rounded-lg border flex flex-col gap-3.5 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#19231c] border-[#2b3e32]'
                  }`}
                >
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                    <span>サイドベアリング調整モード</span>
                  </span>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(
                      [
                        {
                          id: 'center',
                          title: '① 左右余白均等センタリング',
                          desc: '字面枠の中央に文字を配置（LSB = RSB）',
                        },
                        {
                          id: 'proportional',
                          title: '② プロポーショナル化',
                          desc: '指定の左右余白で文字幅に合わせて送り幅を再計算',
                        },
                        {
                          id: 'uniform-advance',
                          title: '③ 送り幅統一（全角/半角）',
                          desc: '全角1000pxや半角500px等に送り幅を固定',
                        },
                        {
                          id: 'offset-lsb',
                          title: '④ 左余白(LSB)の加減算',
                          desc: '文字の左余白を一律に左右へシフト',
                        },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSbMode(m.id)}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          sbMode === m.id
                            ? isLight
                              ? 'bg-emerald-100 border-emerald-500 text-emerald-950 font-bold'
                              : 'bg-emerald-950 border-emerald-400 text-emerald-100 font-bold'
                            : isLight
                            ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                            : 'bg-[#16211a] border-[#26372c] text-stone-300 hover:bg-[#203024]'
                        }`}
                      >
                        <div className="text-xs font-bold">{m.title}</div>
                        <div className="text-[10px] text-stone-500 dark:text-emerald-400/80 mt-0.5">
                          {m.desc}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Mode Specific Inputs */}
                  {sbMode === 'proportional' && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-200 dark:border-stone-800 text-xs">
                      <div>
                        <span className="text-stone-500 block mb-1">目標 左余白 (LSB):</span>
                        <input
                          type="number"
                          value={sbLsb}
                          onChange={(e) => setSbLsb(Number(e.target.value))}
                          className="w-full p-1.5 font-mono font-bold rounded border bg-white dark:bg-[#121a14] border-stone-300 dark:border-stone-700"
                        />
                      </div>
                      <div>
                        <span className="text-stone-500 block mb-1">目標 右余白 (RSB):</span>
                        <input
                          type="number"
                          value={sbRsb}
                          onChange={(e) => setSbRsb(Number(e.target.value))}
                          className="w-full p-1.5 font-mono font-bold rounded border bg-white dark:bg-[#121a14] border-stone-300 dark:border-stone-700"
                        />
                      </div>
                    </div>
                  )}

                  {sbMode === 'uniform-advance' && (
                    <div className="pt-2 border-t border-stone-200 dark:border-stone-800 text-xs">
                      <span className="text-stone-500 block mb-1">送り幅 (Advance Width):</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step={50}
                          value={sbTargetAdvance}
                          onChange={(e) => setSbTargetAdvance(Number(e.target.value))}
                          className="w-32 p-1.5 font-mono font-bold rounded border bg-white dark:bg-[#121a14] border-stone-300 dark:border-stone-700"
                        />
                        <button
                          onClick={() => setSbTargetAdvance(1000)}
                          className="px-2 py-1 text-[11px] rounded border hover:bg-stone-100 dark:hover:bg-stone-800"
                        >
                          全角 (1000)
                        </button>
                        <button
                          onClick={() => setSbTargetAdvance(500)}
                          className="px-2 py-1 text-[11px] rounded border hover:bg-stone-100 dark:hover:bg-stone-800"
                        >
                          半角 (500)
                        </button>
                      </div>
                    </div>
                  )}

                  {(sbMode === 'offset-lsb' || sbMode === 'offset-rsb') && (
                    <div className="pt-2 border-t border-stone-200 dark:border-stone-800 text-xs">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-stone-500">オフセットシフト値:</span>
                        <span className="font-mono font-bold">{sbOffsetDelta > 0 ? `+${sbOffsetDelta}` : sbOffsetDelta}px</span>
                      </div>
                      <input
                        type="range"
                        min="-150"
                        max="150"
                        step="5"
                        value={sbOffsetDelta}
                        onChange={(e) => setSbOffsetDelta(Number(e.target.value))}
                        className="w-full h-2 accent-emerald-600 bg-stone-200 dark:bg-stone-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* Preview Char Selector */}
                <div
                  className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#19231c] border-[#2b3e32]'
                  }`}
                >
                  <span className="font-bold text-stone-600 dark:text-emerald-300">
                    プレビューする文字:
                  </span>
                  <div className="flex items-center gap-1">
                    {['あ', 'い', 'か', '漢', '字', 'A', '1'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setSbPreviewChar(c)}
                        className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                          sbPreviewChar === c
                            ? 'bg-emerald-600 text-white'
                            : isLight
                            ? 'bg-white border border-stone-200 text-stone-700'
                            : 'bg-[#141c16] border border-[#26372c] text-stone-300'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Sidebearing Preview */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <div
                  className={`p-4 rounded-lg border flex flex-col items-center justify-center ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#19231c] border-[#2b3e32]'
                  }`}
                >
                  <div className="w-full flex items-center justify-between text-xs font-bold mb-2">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>余白・送り幅プレビュー</span>
                    </span>
                    <span className="font-mono text-stone-500">「{sbPreviewChar}」</span>
                  </div>

                  <div className="w-64 h-64 relative rounded-lg border bg-white dark:bg-[#101712] border-stone-200 dark:border-stone-800 flex items-center justify-center overflow-hidden shadow-inner">
                    {/* Visual Sidebearing Margins */}
                    <div className="absolute inset-0 pointer-events-none opacity-20">
                      <div className="absolute left-1/2 top-0 bottom-0 w-px border-r border-dashed border-current" />
                      <div className="absolute top-1/2 left-0 right-0 h-px border-b border-dashed border-current" />
                    </div>

                    {sbPreviewGlyph && sbPreviewGlyph.contours && sbPreviewGlyph.contours.length > 0 ? (
                      <svg viewBox="0 0 1000 1000" className="w-full h-full">
                        {/* LSB guideline */}
                        <line
                          x1={sbPreviewGlyph.lsb || 50}
                          y1={0}
                          x2={sbPreviewGlyph.lsb || 50}
                          y2={1000}
                          stroke="#10b981"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                        />
                        {/* Advance width guideline */}
                        <line
                          x1={sbPreviewGlyph.advanceWidth || 1000}
                          y1={0}
                          x2={sbPreviewGlyph.advanceWidth || 1000}
                          y2={1000}
                          stroke="#ef4444"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                        />
                        {/* Glyph Contours */}
                        <path
                          d={contoursToSvgPath(normalizeGlyphContoursWinding(sbPreviewGlyph.contours))}
                          fill={isLight ? '#1c1917' : '#34d399'}
                          fillRule="nonzero"
                        />
                      </svg>
                    ) : (
                      <div className="text-center p-4 text-xs text-stone-400 dark:text-emerald-700">
                        文字「{sbPreviewChar}」がまだ作図されていません
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-[10px] text-stone-500 text-center flex items-center gap-1">
                    <Info className="w-3 h-3 shrink-0 text-emerald-600" />
                    <span>緑破線: 左余白(LSB) / 赤破線: 送り幅境界</span>
                  </div>
                </div>

                {/* Batch Execute Button */}
                <button
                  onClick={handleExecuteSidebearingBatch}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>選択カテゴリのサイドベアリングを一括調整</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
