import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X,
  Sliders,
  Sparkles,
  Layers,
  Download,
  Copy,
  CheckCircle2,
  ArrowRight,
  Eye,
  RefreshCw,
  FolderArchive,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import JSZip from 'jszip';
import { FontProject, GlyphData, PathContour } from '../types';
import { ThemeMode, isLightTheme } from '../utils/theme';
import {
  adjustContoursWeight,
  contoursToSvgPath,
  getContoursBoundingBox,
  interpolateContours,
} from '../utils/pathUtils';
import { compileFont } from '../utils/fontCompiler';

interface WeightInterpolationModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: FontProject;
  setProject: React.Dispatch<React.SetStateAction<FontProject>>;
  selectedUnicode: number;
  theme: ThemeMode;
  onShowToast?: (text: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export type WeightPresetKey = 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'heavy' | 'custom';
type WeightScope = 'all' | 'kanji' | 'kana' | 'latin' | 'current';

const isWeightScope = (value: string): value is WeightScope =>
  value === 'all' || value === 'kanji' || value === 'kana' || value === 'latin' || value === 'current';

interface WeightPreset {
  key: WeightPresetKey;
  label: string;
  sub: string;
  delta: number;
  styleName: string;
}

const WEIGHT_PRESETS: WeightPreset[] = [
  { key: 'thin', label: 'Thin (極細)', sub: '-40px', delta: -40, styleName: 'Thin' },
  { key: 'light', label: 'Light (細字)', sub: '-22px', delta: -22, styleName: 'Light' },
  { key: 'regular', label: 'Regular (標準)', sub: '±0px', delta: 0, styleName: 'Regular' },
  { key: 'medium', label: 'Medium (中字)', sub: '+22px', delta: 22, styleName: 'Medium' },
  { key: 'semibold', label: 'SemiBold (中太)', sub: '+45px', delta: 45, styleName: 'SemiBold' },
  { key: 'bold', label: 'Bold (太字)', sub: '+70px', delta: 70, styleName: 'Bold' },
  { key: 'extrabold', label: 'ExtraBold (極太)', sub: '+100px', delta: 100, styleName: 'ExtraBold' },
  { key: 'heavy', label: 'Heavy (超極太)', sub: '+135px', delta: 135, styleName: 'Heavy' },
];

export const WeightInterpolationModal: React.FC<WeightInterpolationModalProps> = ({
  isOpen,
  onClose,
  project,
  setProject,
  selectedUnicode,
  theme,
  onShowToast,
}) => {
  const isLight = isLightTheme(theme);

  // Mode: 'family' (Weight expansion / variation) or 'master' (Master-to-master morphing)
  const [activeTab, setActiveTab] = useState<'family' | 'master'>('family');

  // Family settings
  const [selectedPreset, setSelectedPreset] = useState<WeightPresetKey>('bold');
  const [weightDelta, setWeightDelta] = useState<number>(70);
  const [scope, setScope] = useState<WeightScope>('all');
  const [showOriginalOverlay, setShowOriginalOverlay] = useState<boolean>(true);
  const [previewSampleText, setPreviewSampleText] = useState<string>('永青木あいうABC123');
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);

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

  // Master interpolation settings
  const [masterAUnicode, setMasterAUnicode] = useState<number>(selectedUnicode);
  const [masterBUnicode, setMasterBUnicode] = useState<number>(
    selectedUnicode === 0x6c38 ? 0x6728 : 0x6c38 // Default to '永' or '木'
  );
  const [interpFactor, setInterpFactor] = useState<number>(0.5); // 0.0 to 1.0

  // Current active glyph
  const currentGlyph = useMemo(() => {
    return project.glyphs[selectedUnicode] || Object.values(project.glyphs)[0] || null;
  }, [project.glyphs, selectedUnicode]);

  // Target glyphs for batch application
  const targetGlyphs = useMemo(() => {
    const list: GlyphData[] = [];
    const all = Object.values(project.glyphs || {}) as GlyphData[];

    for (const g of all) {
      if (!g || !g.contours || g.contours.length === 0) continue;
      const u = g.unicode;

      if (scope === 'all') {
        list.push(g);
      } else if (scope === 'current') {
        if (u === selectedUnicode) list.push(g);
      } else if (scope === 'kana') {
        if ((u >= 0x3041 && u <= 0x3096) || (u >= 0x30a1 && u <= 0x30fa)) list.push(g);
      } else if (scope === 'kanji') {
        if ((u >= 0x4e00 && u <= 0x9fff) || (u >= 0x3400 && u <= 0x4dbf)) list.push(g);
      } else if (scope === 'latin') {
        if (u >= 0x0020 && u <= 0x007e) list.push(g);
      }
    }
    return list;
  }, [project.glyphs, scope, selectedUnicode]);

  // Handle Preset Change
  const handlePresetSelect = (preset: WeightPreset) => {
    setSelectedPreset(preset.key);
    setWeightDelta(preset.delta);
  };

  // Preview Contours for Single Glyph
  const previewOriginalContours = useMemo(() => {
    return currentGlyph?.contours || [];
  }, [currentGlyph]);

  const previewModifiedContours = useMemo(() => {
    if (!previewOriginalContours || previewOriginalContours.length === 0) return [];
    if (weightDelta === 0) return previewOriginalContours;
    return adjustContoursWeight(previewOriginalContours, weightDelta);
  }, [previewOriginalContours, weightDelta]);

  // Master interpolation contours
  const glyphA = project.glyphs[masterAUnicode];
  const glyphB = project.glyphs[masterBUnicode];

  const masterInterpContours = useMemo(() => {
    if (!glyphA?.contours || !glyphB?.contours) return [];
    return interpolateContours(glyphA.contours, glyphB.contours, interpFactor);
  }, [glyphA, glyphB, interpFactor]);

  // Apply Weight Delta to Current Project
  const handleApplyToProject = () => {
    if (targetGlyphs.length === 0) {
      onShowToast?.('対象となる文字がありません', 'warning');
      return;
    }

    const updatedGlyphs = { ...project.glyphs };
    let count = 0;

    for (const g of targetGlyphs) {
      if (!g.contours || g.contours.length === 0) continue;
      const modified = adjustContoursWeight(g.contours, weightDelta);
      updatedGlyphs[g.unicode] = {
        ...g,
        contours: modified,
        modified: true,
      };
      count++;
    }

    setProject({
      ...project,
      glyphs: updatedGlyphs,
      updatedAt: Date.now(),
    });

    const sign = weightDelta > 0 ? `+${weightDelta}px` : `${weightDelta}px`;
    onShowToast?.(
      `${count}文字のウェイトを補正しました (${sign})`,
      'success'
    );
    onClose();
  };

  // Duplicate as New Weight Project
  const handleCreateNewWeightProject = () => {
    const presetObj = WEIGHT_PRESETS.find((p) => p.delta === weightDelta) || {
      styleName: weightDelta > 0 ? `Bold+${weightDelta}` : `Light${weightDelta}`,
    };
    const newStyleName = presetObj.styleName;
    const newProjectName = `${project.metadata.familyName || 'Font'} ${newStyleName}`;

    const updatedGlyphs: Record<number, GlyphData> = {};
    for (const [key, rawG] of Object.entries(project.glyphs || {})) {
      const g = rawG as GlyphData;
      if (!g || !g.contours || g.contours.length === 0) {
        if (g) updatedGlyphs[Number(key)] = g;
        continue;
      }
      updatedGlyphs[Number(key)] = {
        ...g,
        contours: adjustContoursWeight(g.contours, weightDelta),
        modified: true,
      };
    }

    const newProj: FontProject = {
      ...project,
      id: `proj-${Date.now()}`,
      name: newProjectName,
      metadata: {
        ...project.metadata,
        styleName: newStyleName,
      },
      glyphs: updatedGlyphs,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setProject(newProj);
    onShowToast?.(
      `新しいウェイトプロジェクト「${newProjectName}」を作成しました！`,
      'success'
    );
    onClose();
  };

  // Batch Export Entire Weight Family as ZIP
  const handleBatchExportWeightFamilyZip = async () => {
    setIsExportingZip(true);
    onShowToast?.('全ウェイトファミリーをコンパイル中...', 'info');

    try {
      const zip = new JSZip();
      const familyName = project.metadata.familyName || 'MyCustomFont';

      const exportPresets = [
        { name: 'Light', delta: -25 },
        { name: 'Regular', delta: 0 },
        { name: 'Medium', delta: 25 },
        { name: 'Bold', delta: 65 },
        { name: 'ExtraBold', delta: 105 },
      ];

      for (const p of exportPresets) {
        // Clone project for this weight
        const weightGlyphs: Record<number, GlyphData> = {};
        for (const [key, rawG] of Object.entries(project.glyphs || {})) {
          const g = rawG as GlyphData;
          if (!g || !g.contours || g.contours.length === 0) {
            if (g) weightGlyphs[Number(key)] = g;
            continue;
          }
          weightGlyphs[Number(key)] = {
            ...g,
            contours: p.delta === 0 ? g.contours : adjustContoursWeight(g.contours, p.delta),
          };
        }

        const weightProj: FontProject = {
          ...project,
          metadata: {
            ...project.metadata,
            styleName: p.name,
          },
          glyphs: weightGlyphs,
        };

        const result = compileFont(weightProj, {
          mergeOverlaps: true,
          normalizeWinding: true,
          skipBlobUrl: true,
        });

        if (result?.buffer) {
          zip.file(`${familyName}-${p.name}.ttf`, result.buffer);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${familyName}-FontFamily-Weights.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onShowToast?.(
        `全5ウェイトのフォントファミリー（ZIP）を出力しました！`,
        'success'
      );
    } catch (e: any) {
      console.error('Batch export error:', e);
      onShowToast?.(`ウェイト出力中にエラーが発生しました: ${e.message}`, 'error');
    } finally {
      setIsExportingZip(false);
    }
  };

  // Apply Master Interpolation Result to Active Glyph
  const handleApplyMasterInterp = () => {
    if (masterInterpContours.length === 0) return;

    setProject((prev) => ({
      ...prev,
      glyphs: {
        ...prev.glyphs,
        [selectedUnicode]: {
          ...(prev.glyphs[selectedUnicode] || {
            unicode: selectedUnicode,
            char: String.fromCharCode(selectedUnicode),
            name: `uni${selectedUnicode.toString(16).toUpperCase()}`,
            advanceWidth: 1000,
            lsb: 50,
          }),
          contours: masterInterpContours,
          modified: true,
        },
      },
      updatedAt: Date.now(),
    }));

    onShowToast?.(
      `補間結果（${Math.round(interpFactor * 100)}%）を現在の文字に適用しました`,
      'success'
    );
    onClose();
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
            ? 'w-full max-w-4xl xl:max-w-5xl rounded-2xl shadow-2xl max-h-[92vh] border border-stone-200 bg-white text-stone-800'
            : 'w-full max-w-4xl xl:max-w-5xl rounded-2xl shadow-2xl max-h-[92vh] border border-[#25362b] bg-[#141c16] text-emerald-100'
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
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>複数ウェイト自動補間 & ファミリー生成</span>
                {isFullscreen ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-medium">
                    全画面モード
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-normal">
                    Vector Interpolation
                  </span>
                )}
              </h2>
              <p className="text-xs text-stone-500 dark:text-emerald-400/80">
                線の太さ（ウェイト）の一括増減・ファミリー展開・2マスター間幾何補間
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
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-700'
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

        {/* Tab Navigation */}
        <div
          className={`flex border-b px-3 sm:px-5 pt-2 shrink-0 gap-4 overflow-x-auto custom-scrollbar touch-scroll-x min-w-0 whitespace-nowrap ${
            isLight ? 'border-stone-200 bg-stone-50/40' : 'border-[#25362b] bg-[#101712]/50'
          }`}
        >
          <button
            onClick={() => setActiveTab('family')}
            className={`pb-2.5 text-xs font-bold border-b-2 shrink-0 flex items-center gap-1.5 transition-all ${
              activeTab === 'family'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-extrabold'
                : 'border-transparent text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>ウェイトファミリー展開 (自動太さ補正)</span>
          </button>
          <button
            onClick={() => setActiveTab('master')}
            className={`pb-2.5 text-xs font-bold border-b-2 shrink-0 flex items-center gap-1.5 transition-all ${
              activeTab === 'master'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-extrabold'
                : 'border-transparent text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>2マスター間 線形補間 (Morphing)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-6">
          {activeTab === 'family' ? (
            <>
              {/* Top: Presets Bar */}
              <div>
                <label className="text-xs font-bold block mb-2 opacity-90">
                  ウェイトプリセットを選択
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {WEIGHT_PRESETS.map((p) => {
                    const isSelected = weightDelta === p.delta;
                    return (
                      <button
                        key={p.key}
                        onClick={() => handlePresetSelect(p)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-600 text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500/30'
                            : isLight
                            ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
                            : 'bg-[#18231c] hover:bg-[#1f2d24] border-[#25362b] text-stone-300'
                        }`}
                      >
                        <div className="text-xs font-bold">{p.label}</div>
                        <div className="text-[10px] opacity-70 font-mono mt-0.5">{p.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slider & Scope Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Weight Delta Slider */}
                <div
                  className={`p-4 rounded-xl border ${
                    isLight ? 'bg-stone-50/60 border-stone-200' : 'bg-[#162018] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold">太さオフセット（微調整）</label>
                    <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {weightDelta > 0 ? `+${weightDelta}` : weightDelta} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-60}
                    max={150}
                    step={2}
                    value={weightDelta}
                    onChange={(e) => {
                      setSelectedPreset('custom');
                      setWeightDelta(Number(e.target.value));
                    }}
                    className="w-full accent-emerald-600 h-2 bg-stone-200 dark:bg-stone-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 font-mono mt-1">
                    <span>細字化 (-60px)</span>
                    <span>標準 (0px)</span>
                    <span>極太化 (+150px)</span>
                  </div>
                </div>

                {/* Scope Selection */}
                <div
                  className={`p-4 rounded-xl border ${
                    isLight ? 'bg-stone-50/60 border-stone-200' : 'bg-[#162018] border-[#25362b]'
                  }`}
                >
                  <label className="text-xs font-bold block mb-2">適用対象（スコープ）</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'all', label: `全文字 (${targetGlyphs.length})` },
                      { id: 'kanji', label: '漢字のみ' },
                      { id: 'kana', label: 'かなのみ' },
                      { id: 'latin', label: '英数のみ' },
                      { id: 'current', label: `現在文字 (${currentGlyph?.char || ''})` },
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          if (isWeightScope(s.id)) {
                            setScope(s.id);
                          }
                        }}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          scope === s.id
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : isLight
                            ? 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
                            : 'bg-[#101712] hover:bg-[#1a251e] border-[#25362b] text-stone-300'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Vector Preview Section */}
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#101712] border-[#25362b]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    <span>単文字ベクタープレビュー（{currentGlyph?.char || ''}）</span>
                  </span>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showOriginalOverlay}
                      onChange={(e) => setShowOriginalOverlay(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    <span className="opacity-80">元形状（グレー線）を重ねて比較</span>
                  </label>
                </div>

                {/* SVG Canvas Preview */}
                <div
                  className={`w-full h-48 rounded-xl border flex items-center justify-center relative overflow-hidden ${
                    isLight ? 'bg-white border-stone-200' : 'bg-[#162018] border-[#25362b]'
                  }`}
                >
                  <svg viewBox="0 0 1000 1000" className="w-44 h-44">
                    {/* Baseline & Center Guides */}
                    <line x1={0} y1={500} x2={1000} y2={500} stroke="#10b981" strokeDasharray="4 4" opacity={0.25} />
                    <line x1={500} y1={0} x2={500} y2={1000} stroke="#10b981" strokeDasharray="4 4" opacity={0.25} />
                    <line x1={0} y1={800} x2={1000} y2={800} stroke="#dc2626" strokeDasharray="4 4" opacity={0.25} />

                    {/* Original Shape (Ghost) */}
                    {showOriginalOverlay && previewOriginalContours.length > 0 && (
                      <path
                        d={contoursToSvgPath(previewOriginalContours)}
                        fill="none"
                        stroke={isLight ? '#94a3b8' : '#475569'}
                        strokeWidth={2}
                        strokeDasharray="4 3"
                      />
                    )}

                    {/* New Weight Result */}
                    {previewModifiedContours.length > 0 && (
                      <path
                        d={contoursToSvgPath(previewModifiedContours)}
                        fill={isLight ? '#1e293b' : '#ecfdf5'}
                        fillRule="evenodd"
                        stroke={isLight ? '#065f46' : '#34d399'}
                        strokeWidth={1}
                      />
                    )}
                  </svg>

                  <div className="absolute bottom-2 left-3 text-[11px] font-mono opacity-70">
                    頂点数: {previewModifiedContours.reduce((acc, c) => acc + (c.nodes?.length || 0), 0)}点
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Master Interpolation Tab */
            <div className="space-y-5">
              <div
                className={`p-4 rounded-xl border ${
                  isLight ? 'bg-stone-50/60 border-stone-200' : 'bg-[#162018] border-[#25362b]'
                }`}
              >
                <div className="text-xs font-bold mb-3">補間マスターグリフの選択</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Master A */}
                  <div>
                    <label className="text-[11px] font-semibold block mb-1 opacity-80">
                      マスター A (始点 0%)
                    </label>
                    <select
                      value={masterAUnicode}
                      onChange={(e) => setMasterAUnicode(Number(e.target.value))}
                      className={`w-full p-2 rounded-lg border text-xs ${
                        isLight
                          ? 'bg-white border-stone-200 text-stone-800'
                          : 'bg-[#101712] border-[#25362b] text-stone-200'
                      }`}
                    >
                      {(Object.values(project.glyphs || {}) as GlyphData[]).map((g) => (
                        <option key={g.unicode} value={g.unicode}>
                          {g.char || `U+${g.unicode.toString(16).toUpperCase()}`} (Unicode: {g.unicode})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Master B */}
                  <div>
                    <label className="text-[11px] font-semibold block mb-1 opacity-80">
                      マスター B (終点 100%)
                    </label>
                    <select
                      value={masterBUnicode}
                      onChange={(e) => setMasterBUnicode(Number(e.target.value))}
                      className={`w-full p-2 rounded-lg border text-xs ${
                        isLight
                          ? 'bg-white border-stone-200 text-stone-800'
                          : 'bg-[#101712] border-[#25362b] text-stone-200'
                      }`}
                    >
                      {(Object.values(project.glyphs || {}) as GlyphData[]).map((g) => (
                        <option key={g.unicode} value={g.unicode}>
                          {g.char || `U+${g.unicode.toString(16).toUpperCase()}`} (Unicode: {g.unicode})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Interpolation Factor Slider */}
              <div
                className={`p-4 rounded-xl border ${
                  isLight ? 'bg-stone-50/60 border-stone-200' : 'bg-[#162018] border-[#25362b]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold">補間ブレンド比率 (t)</label>
                  <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {Math.round(interpFactor * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={interpFactor}
                  onChange={(e) => setInterpFactor(Number(e.target.value))}
                  className="w-full accent-emerald-600 h-2 bg-stone-200 dark:bg-stone-800 rounded-lg cursor-pointer"
                />

                {/* Quick Step Buttons */}
                <div className="flex justify-between gap-1.5 mt-2">
                  {[0, 0.25, 0.5, 0.75, 1.0].map((step) => (
                    <button
                      key={step}
                      onClick={() => setInterpFactor(step)}
                      className={`flex-1 py-1 text-[11px] rounded border font-mono transition-all ${
                        Math.abs(interpFactor - step) < 0.02
                          ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                          : isLight
                          ? 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
                          : 'bg-[#101712] hover:bg-[#1f2d24] border-[#25362b] text-stone-300'
                      }`}
                    >
                      {Math.round(step * 100)}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Master Morphing Preview */}
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#101712] border-[#25362b]'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>モーフィング補間プレビュー</span>
                </div>

                <div
                  className={`w-full h-52 rounded-xl border flex items-center justify-center relative overflow-hidden ${
                    isLight ? 'bg-white border-stone-200' : 'bg-[#162018] border-[#25362b]'
                  }`}
                >
                  <svg viewBox="0 0 1000 1000" className="w-48 h-48">
                    {/* Master A Ghost */}
                    {glyphA?.contours && (
                      <path
                        d={contoursToSvgPath(glyphA.contours)}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        opacity={0.4}
                      />
                    )}
                    {/* Master B Ghost */}
                    {glyphB?.contours && (
                      <path
                        d={contoursToSvgPath(glyphB.contours)}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        opacity={0.4}
                      />
                    )}
                    {/* Interpolated Result */}
                    {masterInterpContours.length > 0 && (
                      <path
                        d={contoursToSvgPath(masterInterpContours)}
                        fill={isLight ? '#1e293b' : '#ecfdf5'}
                        fillRule="evenodd"
                        stroke={isLight ? '#065f46' : '#34d399'}
                        strokeWidth={1}
                      />
                    )}
                  </svg>

                  <div className="absolute top-2 left-3 flex gap-2 text-[10px] font-mono">
                    <span className="text-sky-600">■ Master A ({glyphA?.char || 'A'})</span>
                    <span className="text-rose-600">■ Master B ({glyphB?.char || 'B'})</span>
                    <span className="text-emerald-600 font-bold">■ 補間結果</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className={`p-4 border-t flex flex-wrap items-center justify-between gap-2.5 shrink-0 ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#101712] border-[#25362b]'
          }`}
        >
          {activeTab === 'family' ? (
            <>
              <button
                onClick={handleBatchExportWeightFamilyZip}
                disabled={isExportingZip}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                  isLight
                    ? 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200 text-emerald-800'
                    : 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-800 text-emerald-300'
                } disabled:opacity-50`}
              >
                <FolderArchive className="w-4 h-4" />
                <span>全5ウェイト一括ZIP出力</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateNewWeightProject}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                    isLight
                      ? 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
                      : 'bg-[#1a251e] hover:bg-[#25362b] border-[#25362b] text-stone-200'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>新規ウェイトプロジェクト作成</span>
                </button>
                <button
                  onClick={handleApplyToProject}
                  className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>現在のプロジェクトに適用</span>
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end gap-2">
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-xl text-xs font-medium border ${
                  isLight
                    ? 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
                    : 'bg-[#1a251e] hover:bg-[#25362b] border-[#25362b] text-stone-200'
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={handleApplyMasterInterp}
                className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>補間結果を「{currentGlyph?.char || ''}」に適用</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
