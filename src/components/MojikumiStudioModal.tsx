import React, { useState, useMemo, useCallback } from 'react';
import {
  X,
  Type,
  Sliders,
  Eye,
  Columns,
  Grid,
  Sparkles,
  Check,
  RotateCcw,
  Download,
  Save,
  BookOpen,
  ArrowRight,
  Info,
  Layers,
  ArrowUpDown,
  AlignLeft,
  ChevronRight,
  Maximize2,
  Copy,
} from 'lucide-react';
import {
  FontProject,
  MojikumiConfig,
  MojikumiPresetId,
  MojikumiTable,
  KinsokuSetId,
  BurasagariMode,
  KinsokuAdjustMode,
  ParagraphIndentPresetId,
} from '../types';
import {
  MOJIKUMI_PRESETS,
  PRESET_BETA,
  PRESET_TSUME,
  PRESET_GYOMATSU_YAKUMONO_HANKAN,
  PRESET_GYOMATSU_ZEN_HAN,
  PRESET_YAKUMONO_HANKAN,
  PRESET_GYOMATSU_YAKUMONO_ZENKAKU,
  PRESET_YAKUMONO_ZENKAKU,
  applyParagraphIndentPreset,
  simulateTypesetting,
  calculateTypesettingDimensions,
  KINSOKU_CHARS,
  BURASAGARI_CHARS,
  FormattedLayoutResult,
} from '../utils/mojikumiEngine';
import { ThemeMode, isLightTheme } from '../utils/theme';

interface MojikumiStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: FontProject;
  setProject: React.Dispatch<React.SetStateAction<FontProject>>;
  theme: ThemeMode;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  onOpenOpenTypeModal?: () => void;
}

const SAMPLE_TEXTS = [
  {
    name: '銀河鉄道の夜（ジョバンニと活版処・手引き掲載文）',
    text:
      '　ジョバンニはすぐ入口から三番目の高い卓子に座った人の所へ行っておじぎをしました。その人はしばらく棚をさがしてから、「これだけ拾って行けるかね。」と云いながら、一枚の紙切れを渡しました。ジョバンニはその人の卓子の足もとから一つの小さな平たい函をとりだして向うの電燈のたくさんついた、たてかけてある壁の隅の所へしゃがみ込むと小さなピンセットでまるで粟粒ぐらいの活字を次から次と拾いはじめました。\n宮沢賢治『銀河鉄道の夜』より',
  },
  {
    name: 'Adobe Illustratorの歴史（和欧数字混植・手引き掲載文）',
    text:
      '「Adobe Illustrator」の最初のバージョンは、1987年にMacintosh向けに発売されました。1988年にリリースされたIllustrator 88（バージョン1.6）から日本語に対応し、1989年のバージョン2.0はWindows版として発売されました。以降、機能を強化しながらバージョンを重ねていき、なかでもバージョン5.5（1994年）とバージョン8.0（1998年）は、安定性の高さから多くのユーザーの支持を獲得。1990年代から2000年代にかけて、写植からパーソナルコンピュータによるデザイン・制作＝DTPへの移行を牽引する役割を果たしました。',
  },
  {
    name: 'チラシ・価格案内（約物・数字・英字アキ検証）',
    text:
      '6月30日10時〜\n本館2F 家電売場\n人気のAi 2026を\n特価7,980円にて\n「特別感謝セール！」期間：2026/07/01〜07/15 [全品20% OFF]',
  },
  {
    name: '会話文と括弧（段落行頭1字下げ検証）',
    text:
      'ジョバンニは帽子をぬいで\n「今晩は、」と云いましたら、\n家の中はしぃんとして誰も居たようではありませんでした。\n「今晩は、ごめんなさい。」\nジョバンニはまっすぐに立ってまた叫びました。\n『銀河鉄道の夜』宮沢賢治',
  },
  {
    name: 'いろは歌（4行・パングラム）',
    text:
      'いろはにほへと　ちりぬるを\nわかよたれそ　つねならむ\nうゐのおくやま　けふこえて\nあさきゆめみし　ゑひもせす',
  },
];

export const MojikumiStudioModal: React.FC<MojikumiStudioModalProps> = ({
  isOpen,
  onClose,
  project,
  setProject,
  theme,
  onShowToast,
  onOpenOpenTypeModal,
}) => {
  const isLight = isLightTheme(theme);

  // Active View Mode: 'compare3' (3並列比較) | 'single' (単一詳細ビュー)
  const [viewMode, setViewMode] = useState<'compare3' | 'single'>('compare3');

  // Active Tab in Sidebar: 'mojikumi' | 'kinsoku' | 'qh_calc'
  const [activeTab, setActiveTab] = useState<'mojikumi' | 'kinsoku' | 'qh_calc'>('mojikumi');

  // Writing direction
  const [isVertical, setIsVertical] = useState<boolean>(false);

  // Selected sample or custom text
  const [selectedSampleIndex, setSelectedSampleIndex] = useState<number>(0);
  const [customText, setCustomText] = useState<string>(SAMPLE_TEXTS[0].text);

  // Typesetting parameters (Q・H単位系)
  const [fontSizeQ, setFontSizeQ] = useState<number>(13); // 13Q ≈ 9.2pt
  const [lineFeedH, setLineFeedH] = useState<number>(24); // 24H ≈ 175%
  const [charsPerLine, setCharsPerLine] = useState<number>(20); // 20字詰め
  const [lineCount, setLineCount] = useState<number>(8); // 8行

  // Show visual grids (仮想ボディマス目 & マージン)
  const [showBodyGrid, setShowBodyGrid] = useState<boolean>(true);
  const [showRuler, setShowRuler] = useState<boolean>(true);

  // Mojikumi configuration state
  const initialConfig: MojikumiConfig = useMemo(() => {
    return (
      project.mojikumiSettings || {
        preset: 'beta',
        table: PRESET_BETA,
        kinsoku: 'weak_v2',
        kinsokuAdjust: 'push_out',
        burasagari: 'standard',
        paragraphIndent: 'visual_half',
      }
    );
  }, [project.mojikumiSettings]);

  const [currentConfig, setCurrentConfig] = useState<MojikumiConfig>(initialConfig);

  // Update preset
  const handleSelectPreset = (presetId: MojikumiPresetId) => {
    const table = MOJIKUMI_PRESETS[presetId].table;
    setCurrentConfig((prev) => ({
      ...prev,
      preset: presetId,
      table: { ...table },
    }));
    onShowToast(`文字組みプリセット「${MOJIKUMI_PRESETS[presetId].name}」を適用しました`, 'info');
  };

  // Update indent preset
  const handleSelectIndentPreset = (indent: ParagraphIndentPresetId) => {
    setCurrentConfig((prev) => ({
      ...prev,
      paragraphIndent: indent,
    }));
    onShowToast(`段落行頭1字下げ「${indent}」を適用しました`, 'info');
  };

  // Q・H dimensions computation
  const dimensions = useMemo(() => {
    return calculateTypesettingDimensions(fontSizeQ, lineFeedH, charsPerLine, lineCount);
  }, [fontSizeQ, lineFeedH, charsPerLine, lineCount]);

  // Typesetting Simulation Results for 3 Modes:
  // 1. ベタ組み (Solid)
  const betaLayout = useMemo(() => {
    const betaConfig: MojikumiConfig = {
      ...currentConfig,
      preset: 'beta',
      table: PRESET_BETA,
      kinsoku: currentConfig.kinsoku,
      kinsokuAdjust: currentConfig.kinsokuAdjust,
      burasagari: currentConfig.burasagari,
    };
    return simulateTypesetting(customText, charsPerLine, betaConfig, {
      isVertical,
      usePalt: false,
      trackingEm: 0,
    });
  }, [customText, charsPerLine, currentConfig, isVertical]);

  // 2. ツメ組み (Proportional / Palt)
  const tsumeLayout = useMemo(() => {
    const tsumeConfig: MojikumiConfig = {
      ...currentConfig,
      preset: 'tsume',
      table: PRESET_TSUME,
      kinsoku: currentConfig.kinsoku,
      kinsokuAdjust: currentConfig.kinsokuAdjust,
      burasagari: currentConfig.burasagari,
    };
    return simulateTypesetting(customText, charsPerLine, tsumeConfig, {
      isVertical,
      usePalt: true,
      trackingEm: 0,
    });
  }, [customText, charsPerLine, currentConfig, isVertical]);

  // 3. アケ組み (Spaced / Tracking +0.15em)
  const akeLayout = useMemo(() => {
    const akeConfig: MojikumiConfig = {
      ...currentConfig,
      preset: 'beta',
      table: PRESET_BETA,
      kinsoku: currentConfig.kinsoku,
      kinsokuAdjust: currentConfig.kinsokuAdjust,
      burasagari: currentConfig.burasagari,
    };
    return simulateTypesetting(customText, charsPerLine, akeConfig, {
      isVertical,
      usePalt: false,
      trackingEm: 0.15, // +150 / 1000em
    });
  }, [customText, charsPerLine, currentConfig, isVertical]);

  // Save config to project
  const handleSaveToProject = () => {
    setProject((prev) => ({
      ...prev,
      mojikumiSettings: currentConfig,
      updatedAt: Date.now(),
    }));
    onShowToast('フォントプロジェクトに文字組みアキ量設定を保存しました', 'success');
  };

  // Export config as JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentConfig, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `${project.name || 'font'}_mojikumi_settings.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    onShowToast('文字組み設定JSONをエクスポートしました', 'success');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-[1400px] h-[94vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${
          isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-[#0f1712] border-[#25382b] text-stone-100'
        }`}
      >
        {/* Modal Top Bar */}
        <header
          className={`px-4 sm:px-6 py-3.5 border-b flex items-center justify-between gap-4 shrink-0 ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#152319] border-[#25382b]'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-950 text-emerald-400 border-emerald-800'
              }`}
            >
              <Type className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold tracking-tight">日本語組版・文字組みスタジオ</h2>
                <span className="text-[11px] font-mono text-stone-500">JIS X 4051 & Illustrator準拠</span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                ベタ組み・ツメ組み・アケ組み比較、アキ量設定、禁則・ぶら下がりシミュレーター
              </p>
            </div>
          </div>

          {/* Quick Actions & Close */}
          <div className="flex items-center space-x-2">
            {/* View Mode Toggle */}
            <div className={`flex items-center p-0.5 rounded-lg border text-xs font-medium ${isLight ? 'bg-stone-200/70 border-stone-300' : 'bg-[#1b2b20] border-[#2b4032]'}`}>
              <button
                onClick={() => setViewMode('compare3')}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
                  viewMode === 'compare3'
                    ? isLight
                      ? 'bg-white text-emerald-900 shadow-sm font-bold'
                      : 'bg-emerald-700 text-white font-bold'
                    : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>3様式並列比較</span>
              </button>
              <button
                onClick={() => setViewMode('single')}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
                  viewMode === 'single'
                    ? isLight
                      ? 'bg-white text-emerald-900 shadow-sm font-bold'
                      : 'bg-emerald-700 text-white font-bold'
                    : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>単一詳細ビュー</span>
              </button>
            </div>

            {/* Vertical / Horizontal toggle */}
            <button
              onClick={() => setIsVertical(!isVertical)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center space-x-1.5 ${
                isVertical
                  ? isLight
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-emerald-900/60 text-emerald-300 border-emerald-700'
                  : isLight
                  ? 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                  : 'bg-[#1b2b20] text-stone-300 border-[#2b4032] hover:bg-[#23382a]'
              }`}
            >
              <span>{isVertical ? '縦組み (Vertical)' : '横組み (Horizontal)'}</span>
            </button>

            <button
              onClick={handleSaveToProject}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>設定を保存</span>
            </button>

            <button
              onClick={handleExportJson}
              className={`p-1.5 rounded-lg border text-xs transition-all ${
                isLight ? 'bg-stone-100 border-stone-200 hover:bg-stone-200 text-stone-700' : 'bg-[#1b2b20] border-[#2b4032] hover:bg-[#23382a] text-stone-300'
              }`}
              title="文字組み設定JSONエクスポート"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-all ${
                isLight ? 'hover:bg-stone-200 text-stone-600' : 'hover:bg-[#25382b] text-stone-400'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Modal Main Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* LEFT: Controls & Rules Panel (Width 360px) */}
          <aside
            className={`w-full md:w-[360px] flex flex-col border-b md:border-b-0 md:border-r shrink-0 overflow-y-auto custom-scrollbar ${
              isLight ? 'bg-stone-50/70 border-stone-200' : 'bg-[#121c15] border-[#25382b]'
            }`}
          >
            {/* Sidebar Tabs */}
            <div
              className={`flex items-center px-4 py-2 border-b text-xs font-bold gap-1 shrink-0 ${
                isLight ? 'bg-stone-100/70 border-stone-200' : 'bg-[#152319] border-[#25382b]'
              }`}
            >
              {[
                { id: 'mojikumi', label: '文字組みアキ量', icon: Sliders },
                { id: 'kinsoku', label: '禁則・ぶら下がり', icon: Layers },
                { id: 'qh_calc', label: 'Q・H計算器', icon: Grid },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSel = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center space-x-1 transition-all ${
                      isSel
                        ? isLight
                          ? 'bg-white text-emerald-900 shadow-sm font-bold'
                          : 'bg-emerald-700 text-white font-bold'
                        : isLight
                        ? 'text-stone-600 hover:bg-stone-200/60'
                        : 'text-stone-400 hover:bg-[#1a281e]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-4 space-y-5 text-xs">
              {/* Sample Text Selector */}
              <div className="space-y-1.5">
                <label className="font-bold flex items-center justify-between text-stone-700 dark:text-stone-300">
                  <span>検証用サンプルテキスト</span>
                  <BookOpen className="w-3.5 h-3.5 text-stone-400" />
                </label>
                <select
                  value={selectedSampleIndex}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setSelectedSampleIndex(idx);
                    if (SAMPLE_TEXTS[idx]) {
                      setCustomText(SAMPLE_TEXTS[idx].text);
                    }
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${
                    isLight ? 'bg-white border-stone-300 text-stone-900' : 'bg-[#1a281e] border-[#2b4032] text-stone-100'
                  }`}
                >
                  {SAMPLE_TEXTS.map((s, idx) => (
                    <option key={idx} value={idx}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  rows={3}
                  className={`w-full p-2 rounded-lg border text-xs resize-none font-sans leading-relaxed ${
                    isLight ? 'bg-white border-stone-300 text-stone-900' : 'bg-[#1a281e] border-[#2b4032] text-stone-100'
                  }`}
                  placeholder="組版を検証するテキストを入力..."
                />
              </div>

              {/* TAB 1: 文字組みアキ量設定 */}
              {activeTab === 'mojikumi' && (
                <div className="space-y-4">
                  {/* Preset Buttons */}
                  <div className="space-y-2">
                    <label className="font-bold text-stone-700 dark:text-stone-300">
                      7大文字組みプリセット（JIS・手引き基準）
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.keys(MOJIKUMI_PRESETS) as MojikumiPresetId[]).map((pid) => {
                        const p = MOJIKUMI_PRESETS[pid];
                        const isSelected = currentConfig.preset === pid;
                        return (
                          <button
                            key={pid}
                            onClick={() => handleSelectPreset(pid)}
                            className={`p-2 rounded-lg border text-left transition-all ${
                              isSelected
                                ? isLight
                                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-500'
                                  : 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold ring-1 ring-emerald-500'
                                : isLight
                                ? 'bg-white border-stone-200 hover:bg-stone-100 text-stone-700'
                                : 'bg-[#17241b] border-[#25382b] hover:bg-[#1d2f23] text-stone-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] truncate">{p.name}</span>
                              {isSelected && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      {MOJIKUMI_PRESETS[currentConfig.preset]?.description}
                    </p>
                  </div>

                  {/* Paragraph Indent Presets (手引き第48-52ページ) */}
                  <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-[#25382b]">
                    <label className="font-bold text-stone-700 dark:text-stone-300">
                      段落行頭1字下げプリセット
                    </label>
                    <div className="space-y-1">
                      {[
                        { id: 'none', label: '天付き（字下げなし）' },
                        { id: 'visual_half', label: '見た目半角下がり（折り返し後天付き）' },
                        { id: 'visual_full', label: '見た目全角下がり（折り返し後天付き）' },
                        { id: 'visual_full_half', label: '見た目全角半下がり（折り返し後半角下がり）' },
                      ].map((ind) => (
                        <button
                          key={ind.id}
                          onClick={() => handleSelectIndentPreset(ind.id as any)}
                          className={`w-full p-1.5 px-2.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                            currentConfig.paragraphIndent === ind.id
                              ? isLight
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                                : 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold'
                              : isLight
                              ? 'bg-white border-stone-200 hover:bg-stone-100 text-stone-700'
                              : 'bg-[#17241b] border-[#25382b] hover:bg-[#1d2f23] text-stone-300'
                          }`}
                        >
                          <span>{ind.label}</span>
                          {currentConfig.paragraphIndent === ind.id && (
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Table summary of Akiryo */}
                  <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-[#25382b]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-700 dark:text-stone-300">
                        主要アキ量・優先順位テーブル
                      </span>
                      <span className="text-[10px] font-mono text-stone-400">最小-最適-最大 (優先度)</span>
                    </div>

                    <div className="space-y-1 font-mono text-[11px]">
                      <div className="flex justify-between py-1 px-2 rounded bg-stone-100 dark:bg-[#17241b]">
                        <span className="font-sans">句点後のアキ</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {currentConfig.table.kuten_to_nonYakumono.min}% - {currentConfig.table.kuten_to_nonYakumono.optimal}% - {currentConfig.table.kuten_to_nonYakumono.max}% (普{currentConfig.table.kuten_to_nonYakumono.priority})
                        </span>
                      </div>
                      <div className="flex justify-between py-1 px-2 rounded bg-stone-100 dark:bg-[#17241b]">
                        <span className="font-sans">読点後のアキ</span>
                        <span>
                          {currentConfig.table.touten_to_nonYakumono.min}% - {currentConfig.table.touten_to_nonYakumono.optimal}% - {currentConfig.table.touten_to_nonYakumono.max}% (普{currentConfig.table.touten_to_nonYakumono.priority})
                        </span>
                      </div>
                      <div className="flex justify-between py-1 px-2 rounded bg-stone-100 dark:bg-[#17241b]">
                        <span className="font-sans">中点類の前後のアキ</span>
                        <span>
                          {currentConfig.table.middleDot_around.min}% - {currentConfig.table.middleDot_around.optimal}% - {currentConfig.table.middleDot_around.max}% (普{currentConfig.table.middleDot_around.priority})
                        </span>
                      </div>
                      <div className="flex justify-between py-1 px-2 rounded bg-stone-100 dark:bg-[#17241b]">
                        <span className="font-sans">半角英字と和文間</span>
                        <span>
                          {currentConfig.table.halfLatin_around_nonYakumono.min}% - {currentConfig.table.halfLatin_around_nonYakumono.optimal}% - {currentConfig.table.halfLatin_around_nonYakumono.max}% (普{currentConfig.table.halfLatin_around_nonYakumono.priority})
                        </span>
                      </div>
                      <div className="flex justify-between py-1 px-2 rounded bg-stone-100 dark:bg-[#17241b]">
                        <span className="font-sans">半角数字と和文間</span>
                        <span>
                          {currentConfig.table.halfDigit_around_nonYakumono.min}% - {currentConfig.table.halfDigit_around_nonYakumono.optimal}% - {currentConfig.table.halfDigit_around_nonYakumono.max}% (普{currentConfig.table.halfDigit_around_nonYakumono.priority})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: 禁則処理 & ぶら下がり */}
              {activeTab === 'kinsoku' && (
                <div className="space-y-4">
                  {/* Kinsoku Set Selection */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-stone-700 dark:text-stone-300">
                      禁則処理セット（手引き第25ページ）
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'weak_v2', name: '弱い禁則 v2 (推奨)', desc: '現代書籍・ベタ組みの標準' },
                        { id: 'strong', name: '強い禁則', desc: 'Illustrator初期設定・小書き仮名含む' },
                        { id: 'weak', name: '弱い禁則', desc: '句読点・括弧類のみ' },
                        { id: 'none', name: '禁則なし', desc: '文字通り配置' },
                      ].map((ks) => (
                        <button
                          key={ks.id}
                          onClick={() => setCurrentConfig((prev) => ({ ...prev, kinsoku: ks.id as any }))}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            currentConfig.kinsoku === ks.id
                              ? isLight
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                                : 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold'
                              : isLight
                              ? 'bg-white border-stone-200 hover:bg-stone-100 text-stone-700'
                              : 'bg-[#17241b] border-[#25382b] hover:bg-[#1d2f23] text-stone-300'
                          }`}
                        >
                          <div className="text-[11px] font-bold">{ks.name}</div>
                          <div className="text-[10px] text-stone-500 truncate">{ks.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kinsoku Adjustment Mode */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-stone-700 dark:text-stone-300">
                      禁則調整方式
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => setCurrentConfig((prev) => ({ ...prev, kinsokuAdjust: 'push_out' }))}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          currentConfig.kinsokuAdjust === 'push_out'
                            ? isLight
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                              : 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold'
                            : isLight
                            ? 'bg-white border-stone-200 text-stone-700'
                            : 'bg-[#17241b] border-[#25382b] text-stone-300'
                        }`}
                      >
                        追い出し優先
                      </button>
                      <button
                        onClick={() => setCurrentConfig((prev) => ({ ...prev, kinsokuAdjust: 'push_in' }))}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          currentConfig.kinsokuAdjust === 'push_in'
                            ? isLight
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                              : 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold'
                            : isLight
                            ? 'bg-white border-stone-200 text-stone-700'
                            : 'bg-[#17241b] border-[#25382b] text-stone-300'
                        }`}
                      >
                        追い込み優先
                      </button>
                    </div>
                  </div>

                  {/* Burasagari Mode */}
                  <div className="space-y-1.5 pt-2 border-t border-stone-200 dark:border-[#25382b]">
                    <label className="font-bold text-stone-700 dark:text-stone-300">
                      ぶら下がり設定（手引き第27ページ）
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'none', name: 'なし' },
                        { id: 'standard', name: '標準' },
                        { id: 'forced', name: '強制' },
                      ].map((bm) => (
                        <button
                          key={bm.id}
                          onClick={() => setCurrentConfig((prev) => ({ ...prev, burasagari: bm.id as any }))}
                          className={`p-2 rounded-lg border text-center transition-all ${
                            currentConfig.burasagari === bm.id
                              ? isLight
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                                : 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold'
                              : isLight
                              ? 'bg-white border-stone-200 text-stone-700'
                              : 'bg-[#17241b] border-[#25382b] text-stone-300'
                          }`}
                        >
                          {bm.name}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      行末の句読点（、。）を版面（字詰め枠）の外に配置し、字送りのマス目リズムを維持します。
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: Q・H計算器 */}
              {activeTab === 'qh_calc' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="font-bold text-stone-700 dark:text-stone-300">
                      日本語組版の基本単位（1Q = 1H = 0.25mm）
                    </label>

                    {/* Font Size Q */}
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>文字サイズ: 級（Q）</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {fontSizeQ}Q ({dimensions.fontSizePt}pt / {(fontSizeQ * 0.25).toFixed(2)}mm)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="7"
                        max="60"
                        step="0.5"
                        value={fontSizeQ}
                        onChange={(e) => setFontSizeQ(Number(e.target.value))}
                        className="w-full accent-emerald-600"
                      />
                    </div>

                    {/* Line Feed H */}
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>行送り: 歯（H）</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {lineFeedH}H ({dimensions.lineFeedPt}pt / {(lineFeedH * 0.25).toFixed(2)}mm)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="0.5"
                        value={lineFeedH}
                        onChange={(e) => setLineFeedH(Number(e.target.value))}
                        className="w-full accent-emerald-600"
                      />
                      <div className="text-[10px] text-stone-400 flex justify-between">
                        <span>行間: {dimensions.lineGapH}H ({(dimensions.lineGapH * 0.25).toFixed(2)}mm)</span>
                        <span>比率: {Math.round((lineFeedH / fontSizeQ) * 100)}%</span>
                      </div>
                    </div>

                    {/* Chars per line */}
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>1行字詰め</span>
                        <span className="font-mono font-bold">{charsPerLine} 文字</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="40"
                        step="1"
                        value={charsPerLine}
                        onChange={(e) => setCharsPerLine(Number(e.target.value))}
                        className="w-full accent-emerald-600"
                      />
                    </div>

                    {/* Number of lines */}
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>行数</span>
                        <span className="font-mono font-bold">{lineCount} 行</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="20"
                        step="1"
                        value={lineCount}
                        onChange={(e) => setLineCount(Number(e.target.value))}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Calculated Box Dimensions Card (手引き第42ページ公式) */}
                  <div className={`p-3 rounded-xl border space-y-2 ${isLight ? 'bg-emerald-50/70 border-emerald-200' : 'bg-emerald-950/40 border-emerald-800'}`}>
                    <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>ベタ組みに最適なテキストエリア寸法</span>
                    </div>

                    <div className="space-y-1.5 font-mono text-xs">
                      <div>
                        <div className="text-[10px] text-stone-500 font-sans">幅（文字サイズ × 字数）:</div>
                        <div className="font-bold text-sm text-stone-900 dark:text-stone-100">{dimensions.widthMm} mm ({dimensions.formulaWidth})</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-stone-500 font-sans">高さ（行送り × (行数-1) + 文字サイズ）:</div>
                        <div className="font-bold text-sm text-stone-900 dark:text-stone-100">{dimensions.heightMm} mm ({dimensions.formulaHeight})</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Link to OpenType Features */}
              {onOpenOpenTypeModal && (
                <div className="pt-3 border-t border-stone-200 dark:border-[#25382b]">
                  <button
                    onClick={onOpenOpenTypeModal}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between ${
                      isLight ? 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-800' : 'bg-[#1b2b20] hover:bg-[#23382a] border-[#2b4032] text-stone-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>OpenType `palt`/`vpal` をフォントに埋め込む</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* RIGHT: Typography Preview Viewport */}
          <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Viewport Sub-header */}
            <div
              className={`px-4 py-2 border-b flex items-center justify-between text-xs shrink-0 ${
                isLight ? 'bg-stone-100/50 border-stone-200' : 'bg-[#141e17] border-[#25382b]'
              }`}
            >
              <div className="flex items-center space-x-3 text-stone-500 dark:text-stone-400">
                <span>
                  設定: <strong className="text-emerald-700 dark:text-emerald-300">{MOJIKUMI_PRESETS[currentConfig.preset]?.name}</strong>
                </span>
                <span>·</span>
                <span>
                  禁則: <strong>{currentConfig.kinsoku}</strong>
                </span>
                <span>·</span>
                <span>
                  ぶら下がり: <strong>{currentConfig.burasagari}</strong>
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowBodyGrid(!showBodyGrid)}
                  className={`px-2 py-1 rounded border text-[11px] font-medium transition-all ${
                    showBodyGrid
                      ? isLight
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                        : 'bg-emerald-900 border-emerald-700 text-emerald-200'
                      : isLight
                      ? 'bg-stone-200 border-stone-300 text-stone-600'
                      : 'bg-stone-800 border-stone-700 text-stone-400'
                  }`}
                >
                  仮想ボディ枠表示
                </button>
              </div>
            </div>

            {/* PREVIEW CONTAINER */}
            <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-auto custom-scrollbar">
              {viewMode === 'compare3' ? (
                /* 3-WAY SPLIT VIEW: ベタ組み vs ツメ組み vs アケ組み */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                  {/* COLUMN 1: ベタ組み */}
                  <TypesettingColumnCard
                    title="ベタ組み (Solid)"
                    tag="和文等幅 · 本文向け"
                    desc="全角仮想ボディ均等割り。句点の区切り感を保持し一定のリズムで読ませる。"
                    layout={betaLayout}
                    charsPerLine={charsPerLine}
                    fontSizeQ={fontSizeQ}
                    lineFeedH={lineFeedH}
                    showGrid={showBodyGrid}
                    isVertical={isVertical}
                    isLight={isLight}
                    accentColor="emerald"
                  />

                  {/* COLUMN 2: ツメ組み */}
                  <TypesettingColumnCard
                    title="ツメ組み (Tight / Palt)"
                    tag="プロポーショナル · 見出し向け"
                    desc="OpenType palt適用。字面余白を詰め、タイトな一体感と凝縮感を生む。"
                    layout={tsumeLayout}
                    charsPerLine={charsPerLine}
                    fontSizeQ={fontSizeQ}
                    lineFeedH={lineFeedH}
                    showGrid={showBodyGrid}
                    isVertical={isVertical}
                    isLight={isLight}
                    accentColor="blue"
                  />

                  {/* COLUMN 3: アケ組み */}
                  <TypesettingColumnCard
                    title="アケ組み (Spaced / Tracking)"
                    tag="トラッキング +150 · リード向け"
                    desc="全体の字間を均等にアケて組む。落ち着きと余韻のあるタイトル・キャッチ向け。"
                    layout={akeLayout}
                    charsPerLine={charsPerLine}
                    fontSizeQ={fontSizeQ}
                    lineFeedH={lineFeedH}
                    showGrid={showBodyGrid}
                    isVertical={isVertical}
                    isLight={isLight}
                    accentColor="purple"
                  />
                </div>
              ) : (
                /* SINGLE DETAILED VIEW */
                <div
                  className={`max-w-4xl mx-auto p-6 rounded-2xl border transition-colors shadow-sm space-y-6 ${
                    isLight ? 'bg-white border-stone-200' : 'bg-[#152319] border-[#25382b]'
                  }`}
                >
                  <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-[#25382b]">
                    <div>
                      <h3 className="font-bold text-base">単一詳細組版プレビュー</h3>
                      <p className="text-xs text-stone-500">
                        文字サイズ: {fontSizeQ}Q ({dimensions.fontSizePt}pt) · 行送り: {lineFeedH}H · {charsPerLine}字詰め
                      </p>
                    </div>
                    <div className="text-right text-xs font-mono text-stone-500">
                      <div>行数: {betaLayout.lineCount}行</div>
                      <div>ぶら下がり文字数: {betaLayout.burasagariCount}字</div>
                    </div>
                  </div>

                  {/* Rendered Text Box */}
                  <div
                    className={`p-6 rounded-xl border relative overflow-x-auto ${
                      isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#0f1712] border-[#25382b]'
                    }`}
                    style={{
                      writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
                    }}
                  >
                    {renderLayoutLines(betaLayout, charsPerLine, fontSizeQ, lineFeedH, showBodyGrid, isLight)}
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

interface TypesettingColumnCardProps {
  title: string;
  tag: string;
  desc: string;
  layout: FormattedLayoutResult;
  charsPerLine: number;
  fontSizeQ: number;
  lineFeedH: number;
  showGrid: boolean;
  isVertical: boolean;
  isLight: boolean;
  accentColor: 'emerald' | 'blue' | 'purple';
}

const TypesettingColumnCard: React.FC<TypesettingColumnCardProps> = ({
  title,
  tag,
  desc,
  layout,
  charsPerLine,
  fontSizeQ,
  lineFeedH,
  showGrid,
  isVertical,
  isLight,
  accentColor,
}) => {
  return (
    <div
      className={`flex flex-col rounded-2xl border overflow-hidden transition-all ${
        isLight ? 'bg-white border-stone-200 shadow-sm' : 'bg-[#152319] border-[#25382b]'
      }`}
    >
      {/* Card Header */}
      <div
        className={`px-4 py-3 border-b flex flex-col gap-1 shrink-0 ${
          isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18281d] border-[#25382b]'
        }`}
      >
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm tracking-tight text-stone-900 dark:text-stone-100">{title}</h4>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
            {tag}
          </span>
        </div>
        <p className="text-[11px] text-stone-500 leading-tight">{desc}</p>
        <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 pt-1">
          <span>行数: {layout.lineCount}行</span>
          <span>平均密度: {layout.averageDensityPercent}%</span>
          {layout.burasagariCount > 0 && (
            <span className="text-amber-500 font-bold">ぶら下がり: {layout.burasagariCount}字</span>
          )}
        </div>
      </div>

      {/* Render Box */}
      <div
        className={`flex-1 min-h-[300px] p-4 overflow-auto custom-scrollbar relative ${
          isLight ? 'bg-stone-50/50' : 'bg-[#0f1712]'
        }`}
        style={{
          writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
        }}
      >
        {renderLayoutLines(layout, charsPerLine, fontSizeQ, lineFeedH, showGrid, isLight)}
      </div>
    </div>
  );
};

function renderLayoutLines(
  layout: FormattedLayoutResult,
  charsPerLine: number,
  fontSizeQ: number,
  lineFeedH: number,
  showGrid: boolean,
  isLight: boolean
) {
  // Approximate scale for screen rendering
  const emPx = Math.max(14, Math.round(fontSizeQ * 1.4));
  const lineGapPx = Math.max(6, Math.round((lineFeedH - fontSizeQ) * 1.4));

  return (
    <div className="space-y-2 select-text" style={{ gap: `${lineGapPx}px` }}>
      {layout.lines.map((line, lIdx) => (
        <div
          key={lIdx}
          className={`flex items-baseline relative ${line.isOverflown ? 'bg-rose-500/10' : ''}`}
          style={{ minHeight: `${emPx}px` }}
        >
          {/* Visual Grid Baseline / Box Guides */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none border-b border-dashed border-stone-300 dark:border-stone-800"
              style={{ bottom: 0 }}
            />
          )}

          {line.glyphs.map((g, gIdx) => {
            const hasMarginBefore = g.spacingBeforeEm > 0;
            const hasMarginAfter = g.spacingAfterEm > 0;

            return (
              <span
                key={gIdx}
                className={`inline-block relative text-center transition-all ${
                  g.isHanging
                    ? 'text-amber-600 dark:text-amber-400 font-bold bg-amber-500/20 rounded'
                    : ''
                }`}
                style={{
                  fontSize: `${emPx}px`,
                  lineHeight: 1,
                  paddingLeft: `${g.spacingBeforeEm * emPx}px`,
                  paddingRight: `${g.spacingAfterEm * emPx}px`,
                }}
                title={`文字:「${g.char}」 前アキ:${Math.round(g.spacingBeforeEm * 100)}% 後アキ:${Math.round(g.spacingAfterEm * 100)}% ${
                  g.isHanging ? '(ぶら下がり)' : ''
                }`}
              >
                {/* Visual Square Body Indicator */}
                {showGrid && (
                  <span
                    className="absolute inset-0 pointer-events-none border border-stone-200/50 dark:border-stone-800/60"
                    style={{ width: `${emPx}px`, height: `${emPx}px` }}
                  />
                )}
                {g.char}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
