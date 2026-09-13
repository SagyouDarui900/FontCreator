import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Sparkles,
  BookmarkPlus,
  Trash2,
  Combine,
  Layers,
  Shapes,
  Search,
  Type,
  Sliders,
  RefreshCw,
  BookOpen,
  Plus,
} from 'lucide-react';
import { KANJI_RADICALS } from '../data/kanjiRadicals';
import { PathContour, CustomPart, RadicalPlacement, GlyphData } from '../types';
import {
  contoursToSvgPath,
  generateId,
  transformContoursForPlacement,
  generateShapeByType,
  SHAPE_PRESETS,
} from '../utils/pathUtils';
import {
  extractRadicalFromFont,
  getOrExtractRadicalContours,
  DEFAULT_RADICAL_FONT_FAMILY,
  DEFAULT_RADICAL_FONT_WEIGHT,
  POPULAR_RADICALS_QUICK_PRESETS,
  KANGXI_RADICALS_CATALOG,
  KangxiRadicalItem,
} from '../utils/radicalExtractor';
import { ThemeMode } from '../utils/theme';

const CUSTOM_PARTS_STORAGE_KEY = 'font_editor_custom_parts_v1';

export type RadicalFontPreset = 'serif' | 'sans' | 'maru';

export interface FontStyleOption {
  id: RadicalFontPreset;
  label: string;
  subLabel: string;
  fontFamily: string;
  fontWeight: number;
}

export const RADICAL_FONT_OPTIONS: FontStyleOption[] = [
  {
    id: 'serif',
    label: '明朝体',
    subLabel: '明朝体 (Noto Serif JP)',
    fontFamily: "'Noto Serif JP', serif",
    fontWeight: 600,
  },
  {
    id: 'sans',
    label: 'ゴシック体',
    subLabel: 'ゴシック体 (Noto Sans JP)',
    fontFamily: "'Noto Sans JP', sans-serif",
    fontWeight: 600,
  },
  {
    id: 'maru',
    label: '丸ゴシック',
    subLabel: '丸ゴシック (Zen Maru)',
    fontFamily: "'Zen Maru Gothic', sans-serif",
    fontWeight: 700,
  },
];

interface RadicalsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertRadical: (contours: PathContour[]) => void;
  currentContours: PathContour[];
  selectedChar: string;
  allGlyphs: Record<number, GlyphData>;
  theme: ThemeMode;
  onOpenRadicalStudio?: () => void;
}

type DrawerTab = 'preset' | 'extract' | 'kangxi' | 'shapes' | 'from_glyph' | 'custom';

export const RadicalsDrawer: React.FC<RadicalsDrawerProps> = ({
  isOpen,
  onClose,
  onInsertRadical,
  currentContours,
  selectedChar,
  allGlyphs,
  theme,
  onOpenRadicalStudio,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>('preset');
  const [placement, setPlacement] = useState<RadicalPlacement>('auto');
  const [selectedFontStyle, setSelectedFontStyle] = useState<FontStyleOption>(RADICAL_FONT_OPTIONS[0]);
  const [presetSearch, setPresetSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [shapeCategoryFilter, setShapeCategoryFilter] = useState<string>('all');
  const [extractingKangxiNum, setExtractingKangxiNum] = useState<number | null>(null);

  // Font Extraction Tool State
  const [extractChar, setExtractChar] = useState<string>('氵');
  const [extractFontFamily, setExtractFontFamily] = useState<string>(RADICAL_FONT_OPTIONS[0].fontFamily);
  const [extractWeight, setExtractWeight] = useState<number>(RADICAL_FONT_OPTIONS[0].fontWeight);
  const [extractRegion, setExtractRegion] = useState<'full' | 'hen' | 'tsukuri' | 'kanmuri' | 'ashi'>('full');
  const [extractSmoothing, setExtractSmoothing] = useState<number>(2.0);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractedContours, setExtractedContours] = useState<PathContour[]>([]);

  const handleSelectFontStyle = (opt: FontStyleOption) => {
    setSelectedFontStyle(opt);
    setExtractFontFamily(opt.fontFamily);
    setExtractWeight(opt.fontWeight);
  };

  // Kangxi Radicals Catalog State
  const [kangxiSearch, setKangxiSearch] = useState<string>('');
  const [kangxiStrokeFilter, setKangxiStrokeFilter] = useState<number | 'all'>('all');

  // Custom Parts (initialized with authentic standard radicals for immediate usability)
  const [customParts, setCustomParts] = useState<CustomPart[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_PARTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    // High quality initial custom parts with ready-to-use vector contours
    return [
      {
        id: generateId(),
        name: 'さんずい (氵)',
        category: 'hen',
        description: '三水・水に関する偏',
        contours: KANJI_RADICALS.find((r) => r.id === 'rad_sanzui')?.contours || [],
        createdAt: Date.now() - 5000,
      },
      {
        id: generateId(),
        name: 'きへん (木)',
        category: 'hen',
        description: '木偏・樹木に関する偏',
        contours: KANJI_RADICALS.find((r) => r.id === 'rad_kihen')?.contours || [],
        createdAt: Date.now() - 4000,
      },
      {
        id: generateId(),
        name: 'にんべん (亻)',
        category: 'hen',
        description: '人偏・人間に関する偏',
        contours: KANJI_RADICALS.find((r) => r.id === 'rad_ninben')?.contours || [],
        createdAt: Date.now() - 3000,
      },
      {
        id: generateId(),
        name: 'ごんべん (言)',
        category: 'hen',
        description: '言偏・言葉に関する偏',
        contours: KANJI_RADICALS.find((r) => r.id === 'rad_gonben')?.contours || [],
        createdAt: Date.now() - 2000,
      },
      {
        id: generateId(),
        name: 'くさかんむり (艹)',
        category: 'kanmuri',
        description: '草冠・植物に関する冠',
        contours: KANJI_RADICALS.find((r) => r.id === 'rad_kusakanmuri')?.contours || [],
        createdAt: Date.now() - 1000,
      },
    ];
  });
  const [newPartName, setNewPartName] = useState<string>('');
  const [createOnlyFrame, setCreateOnlyFrame] = useState<boolean>(false);
  const [showSaveInput, setShowSaveInput] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const isLight = theme === 'light';

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 2500);
  };

  // Reload custom parts
  const reloadCustomParts = useCallback(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_PARTS_STORAGE_KEY);
      if (saved) {
        setCustomParts(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      reloadCustomParts();
    }
  }, [isOpen, reloadCustomParts]);

  useEffect(() => {
    const handleSync = () => reloadCustomParts();
    window.addEventListener('font_custom_parts_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('font_custom_parts_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [reloadCustomParts]);

  // Sync custom parts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_PARTS_STORAGE_KEY, JSON.stringify(customParts));
    } catch {
      // ignore
    }
  }, [customParts]);

  // Perform font extraction
  const performExtraction = useCallback(
    async (charToExtract: string, regionToExtract: 'full' | 'hen' | 'tsukuri' | 'kanmuri' | 'ashi') => {
      if (!charToExtract || charToExtract.trim().length === 0) return;
      setIsExtracting(true);
      try {
        const contours = await extractRadicalFromFont({
          char: charToExtract.trim()[0],
          fontFamily: extractFontFamily,
          fontWeight: extractWeight,
          region: regionToExtract,
          smoothing: extractSmoothing,
          fitMargin: 70,
        });
        setExtractedContours(contours);
      } catch (err) {
        console.error('Extraction failed:', err);
      } finally {
        setIsExtracting(false);
      }
    },
    [extractFontFamily, extractWeight, extractSmoothing]
  );

  // Trigger extraction when options change in extract tab
  useEffect(() => {
    if (activeTab === 'extract') {
      performExtraction(extractChar, extractRegion);
    }
  }, [activeTab, extractChar, extractFontFamily, extractWeight, extractRegion, extractSmoothing, performExtraction]);

  if (!isOpen) return null;

  // Insert helper with placement
  const handleInsertWithPlacement = (
    rawContours: PathContour[],
    partName?: string,
    defaultCategory?: string
  ) => {
    if (!rawContours || rawContours.length === 0) {
      showNotice('挿入する輪郭データがありません');
      return;
    }
    const clonedContours: PathContour[] = rawContours.map((c) => ({
      ...c,
      id: generateId(),
      nodes: c.nodes.map((n) => ({
        ...n,
        id: generateId(),
        handleIn: n.handleIn ? { ...n.handleIn } : null,
        handleOut: n.handleOut ? { ...n.handleOut } : null,
      })),
    }));

    const positioned = transformContoursForPlacement(clonedContours, placement, defaultCategory);
    onInsertRadical(positioned);
    showNotice(partName ? `「${partName}」をキャンバスに挿入しました` : '部首をキャンバスに挿入しました');
  };

  // High-fidelity insertion for preset radicals using vector cache
  const handleInsertPresetRadical = async (radical: (typeof KANJI_RADICALS)[0]) => {
    try {
      const contours = await getOrExtractRadicalContours(
        radical.char || radical.name,
        'full',
        selectedFontStyle.fontFamily,
        selectedFontStyle.fontWeight
      );
      if (contours && contours.length > 0) {
        handleInsertWithPlacement(contours, `${radical.name} (${selectedFontStyle.label})`, radical.category);
        return;
      }
    } catch (e) {
      console.error('Preset extraction error:', e);
    }
    handleInsertWithPlacement(radical.contours, radical.name, radical.category);
  };

  // Save contours as custom part
  const handleSaveContoursAsPart = (contoursToSave: PathContour[], defaultName: string) => {
    const name = newPartName.trim() || defaultName;
    if (!name) return;

    const existingIndex = customParts.findIndex((p) => p.name === name);
    let updated: CustomPart[];
    if (existingIndex >= 0) {
      updated = customParts.map((p, idx) =>
        idx === existingIndex
          ? { ...p, contours: JSON.parse(JSON.stringify(contoursToSave || [])) }
          : p
      );
    } else {
      const newPart: CustomPart = {
        id: generateId(),
        name,
        contours: JSON.parse(JSON.stringify(contoursToSave || [])),
        createdAt: Date.now(),
      };
      updated = [newPart, ...customParts];
    }

    setCustomParts(updated);
    try {
      localStorage.setItem(CUSTOM_PARTS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    setNewPartName('');
    setShowSaveInput(false);
    showNotice(`「${name}」を保存しました`);
  };

  // Create clean name-only frame without contours
  const handleCreateNameFrame = (frameName?: string) => {
    const name = (frameName || newPartName).trim() || '新規パーツ枠';
    const newPart: CustomPart = {
      id: generateId(),
      name,
      contours: [],
      createdAt: Date.now(),
    };
    const updated = [newPart, ...customParts];
    setCustomParts(updated);
    try {
      localStorage.setItem(CUSTOM_PARTS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    setNewPartName('');
    setShowSaveInput(false);
    showNotice(`名前枠「${name}」を作成しました`);
  };

  // Import all high-quality standard radicals into custom parts
  const handleImportAllPresetRadicals = async () => {
    const existingNames = new Set(customParts.map((p) => p.name));
    const toAdd: CustomPart[] = [];

    showNotice('定番部首の高品質ベクターを取り込み中...');
    for (const rad of KANJI_RADICALS) {
      if (!existingNames.has(rad.name)) {
        let contours: PathContour[] = rad.contours;
        try {
          const extracted = await getOrExtractRadicalContours(
            rad.char || rad.name,
            'full',
            selectedFontStyle.fontFamily,
            selectedFontStyle.fontWeight
          );
          if (extracted && extracted.length > 0) {
            contours = extracted;
          }
        } catch {
          // fallback to rad.contours
        }

        toAdd.push({
          id: generateId(),
          name: rad.name,
          category: rad.category as CustomPart['category'],
          description: `高品質定番部首: ${rad.name} (${rad.char})`,
          contours: JSON.parse(JSON.stringify(contours)),
          createdAt: Date.now(),
        });
      }
    }

    if (toAdd.length === 0) {
      showNotice('すべての定番部首は既に登録されています');
      return;
    }

    setCustomParts((prev) => [...toAdd, ...prev]);
    showNotice(`${toAdd.length} 件の定番部首を高精度ベクターでマイパーツに取り込みました`);
  };

  // Filter preset radicals
  const filteredRadicals = KANJI_RADICALS.filter((r) => {
    const matchCategory = categoryFilter === 'all' || r.category === categoryFilter;
    const matchSearch =
      !presetSearch.trim() ||
      r.name.toLowerCase().includes(presetSearch.toLowerCase()) ||
      r.char.includes(presetSearch.trim());
    return matchCategory && matchSearch;
  });

  // Filter Kangxi catalog
  const filteredKangxi = KANGXI_RADICALS_CATALOG.filter((item) => {
    const matchStroke = kangxiStrokeFilter === 'all' || item.strokes === kangxiStrokeFilter;
    const matchSearch =
      !kangxiSearch.trim() ||
      item.char.includes(kangxiSearch.trim()) ||
      item.name.includes(kangxiSearch.trim()) ||
      item.reading.toLowerCase().includes(kangxiSearch.toLowerCase()) ||
      (item.exampleChars && item.exampleChars.includes(kangxiSearch.trim()));
    return matchStroke && matchSearch;
  });

  // Filter modified glyphs for synthesis
  const availableGlyphs: GlyphData[] = (Object.values(allGlyphs) as GlyphData[]).filter(
    (g) => g && g.contours && g.contours.length > 0
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-45 animate-in fade-in duration-150"
      />

      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-[430px] sm:max-w-md border-l shadow-2xl z-50 flex flex-col select-none transition-colors animate-in slide-in-from-right duration-200 ${
          isLight ? 'bg-[#f7faf8] border-[#c8ded3] text-stone-800' : 'bg-[#151e18] border-[#25362b] text-emerald-100'
        }`}
      >
        {/* Header */}
        <div
          className={`p-3 border-b flex items-center justify-between shrink-0 ${
            isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Sparkles className={`w-4 h-4 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
            <div className="flex flex-col">
              <span className={`text-xs font-bold tracking-wide ${isLight ? 'text-emerald-950' : 'text-emerald-200'}`}>
                部首・偏旁＆フォントパーツスタジオ
              </span>
              <span className="text-[10px] text-stone-500 dark:text-stone-400">
                実用高精度ベクター・フォント自動抽出
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'text-stone-500 hover:bg-stone-100' : 'text-stone-400 hover:bg-[#202d24]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Toast */}
        {statusNotice && (
          <div className="bg-emerald-800 text-white text-[11px] font-bold py-1.5 px-3 text-center shadow-md animate-in fade-in">
            {statusNotice}
          </div>
        )}

        {/* Tab Navigation */}
        <div
          className={`flex overflow-x-auto no-scrollbar sm:grid sm:grid-cols-6 p-1 gap-1 border-b text-[10px] font-semibold shrink-0 ${
            isLight ? 'bg-[#edf5f0] border-[#d8e6df]' : 'bg-[#101813] border-[#25362b]'
          }`}
        >
          {[
            { id: 'preset', label: '定番部首' },
            { id: 'extract', label: 'フォント抽出' },
            { id: 'kangxi', label: '康熙214' },
            { id: 'shapes', label: '幾何図形' },
            { id: 'from_glyph', label: '文字合成' },
            { id: 'custom', label: 'マイパーツ' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DrawerTab)}
              className={`py-1.5 px-2 sm:px-1 rounded text-center whitespace-nowrap transition-all shrink-0 sm:shrink ${
                activeTab === tab.id
                  ? isLight
                    ? 'bg-white text-emerald-950 shadow-xs font-bold border border-emerald-200'
                    : 'bg-[#1c2920] text-emerald-300 shadow-xs font-bold border border-[#2d4032]'
                  : 'text-stone-600 dark:text-stone-400 hover:text-emerald-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Font Style Selector for Radicals */}
        <div
          className={`px-2.5 py-2 border-b space-y-1 shrink-0 ${
            isLight ? 'bg-[#f4f8f5] border-[#d8e6df]' : 'bg-[#141e17] border-[#25362b]'
          }`}
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold flex items-center space-x-1">
              <Type className="w-3.5 h-3.5 text-emerald-600" />
              <span>部首書体スタイル (プレビュー＆抽出):</span>
            </span>
            <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-medium">
              {selectedFontStyle.subLabel}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            {RADICAL_FONT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectFontStyle(opt)}
                className={`py-1.5 px-2 rounded border text-center transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                  selectedFontStyle.id === opt.id
                    ? isLight
                      ? 'bg-emerald-800 border-emerald-900 text-white font-bold shadow-xs'
                      : 'bg-emerald-600 border-emerald-500 text-white font-bold shadow-xs'
                    : isLight
                    ? 'bg-white border-stone-300 text-stone-700 hover:bg-emerald-50'
                    : 'bg-[#1c2920] border-[#2d4032] text-stone-300 hover:bg-[#25362b]'
                }`}
                title={`${opt.label} (${opt.subLabel})`}
              >
                <span style={{ fontFamily: opt.fontFamily, fontWeight: opt.fontWeight }}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Placement Selector */}
        <div
          className={`p-2.5 border-b space-y-1 shrink-0 ${
            isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#121c15] border-[#25362b]'
          }`}
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold flex items-center space-x-1">
              <Combine className="w-3.5 h-3.5 text-emerald-600" />
              <span>挿入配置 &amp; スケーリング:</span>
            </span>
            <span className="text-[10px] text-stone-500">標準EM枠へ自動調整</span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 text-[10px]">
            {[
              { id: 'auto', label: '自動位置' },
              { id: 'hen', label: '偏 (左)' },
              { id: 'tsukuri', label: '旁 (右)' },
              { id: 'kanmuri', label: '冠 (上)' },
              { id: 'ashi', label: '脚 (下)' },
              { id: 'center_small', label: '縮小中央' },
              { id: 'original', label: '原寸' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setPlacement(item.id as RadicalPlacement)}
                className={`py-1.5 px-1 rounded border text-center whitespace-nowrap transition-colors ${
                  placement === item.id
                    ? isLight
                      ? 'bg-emerald-800 border-emerald-900 text-white font-bold'
                      : 'bg-emerald-600 border-emerald-500 text-white font-bold'
                    : isLight
                    ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-emerald-50'
                    : 'bg-[#18231c] border-[#25362b] text-stone-300 hover:bg-[#202d24]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* ========================================================
            TAB 1: PRESET RADICALS (高品質ベクター定番部首)
           ======================================================== */}
        {activeTab === 'preset' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search & Action Bar */}
            <div className={`p-2 border-b space-y-1.5 shrink-0 ${isLight ? 'bg-[#f4f8f5]' : 'bg-[#141d17]'}`}>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
                <input
                  type="text"
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="部首名・漢字で検索 (例: さんずい, 木, 氵, 門)..."
                  className={`w-full pl-8 pr-3 py-1.5 rounded-md border text-xs ${
                    isLight
                      ? 'bg-white border-stone-300 text-stone-800 focus:border-emerald-600'
                      : 'bg-[#1a261f] border-[#25362b] text-emerald-100 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Category Filter Chips */}
              <div className="flex space-x-1 overflow-x-auto text-[10px] pb-0.5">
                {[
                  { id: 'all', label: 'すべて' },
                  { id: 'hen', label: '偏 (へん)' },
                  { id: 'tsukuri', label: '旁 (つくり)' },
                  { id: 'kanmuri', label: '冠 (かんむり)' },
                  { id: 'ashi', label: '脚 (あし)' },
                  { id: 'kamae', label: '構え' },
                  { id: 'nyo', label: '繞 (にょう)' },
                  { id: 'tare', label: '垂れ' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-2 py-0.5 rounded-full whitespace-nowrap text-[10px] transition-colors ${
                      categoryFilter === cat.id
                        ? isLight
                          ? 'bg-emerald-800 text-white font-bold'
                          : 'bg-emerald-600 text-white font-bold'
                        : isLight
                        ? 'bg-white text-stone-700 hover:bg-emerald-100 border border-stone-200'
                        : 'bg-[#1a261f] text-stone-300 hover:bg-[#25362b] border border-[#25362b]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid of Typographic Radicals */}
            <div className="flex-1 overflow-y-auto p-2.5 grid grid-cols-3 gap-2 content-start">
              {filteredRadicals.map((radical) => {
                return (
                  <button
                    key={radical.id}
                    onClick={() => handleInsertPresetRadical(radical)}
                    className={`flex flex-col items-center justify-between p-2 rounded-lg border group transition-all cursor-pointer ${
                      isLight
                        ? 'bg-white border-[#c8ded3] hover:border-emerald-700 hover:bg-emerald-50 shadow-xs'
                        : 'bg-[#1a261f] border-[#25362b] hover:border-emerald-500 hover:bg-[#223127]'
                    }`}
                    title={`${radical.name} (${radical.char}) をキャンバスに挿入`}
                  >
                    <div className="w-14 h-14 flex items-center justify-center p-0.5">
                      <span
                        style={{
                          fontFamily: selectedFontStyle.fontFamily,
                          fontWeight: selectedFontStyle.fontWeight,
                        }}
                        className={`text-2xl transition-transform group-hover:scale-110 ${
                          isLight ? 'text-stone-800 group-hover:text-emerald-900' : 'text-emerald-100 group-hover:text-white'
                        }`}
                      >
                        {radical.char || radical.name}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold mt-1 truncate w-full text-center ${
                        isLight ? 'text-stone-800 group-hover:text-emerald-950' : 'text-emerald-200 group-hover:text-white'
                      }`}
                    >
                      {radical.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Footer action to import to My Parts */}
            <div className={`p-2 border-t shrink-0 flex items-center justify-between text-xs ${isLight ? 'bg-white' : 'bg-[#18231c]'}`}>
              <span className="text-[10px] text-stone-500">{filteredRadicals.length} 件の定番部首</span>
              <button
                onClick={handleImportAllPresetRadicals}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all ${
                  isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                    : 'bg-[#1c2920] border-emerald-600 text-emerald-200 hover:bg-[#233529]'
                }`}
                title="すべての定番部首をマイパーツへ登録して自由に編集できるようにします"
              >
                マイパーツへ一括登録
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: FONT EXTRACTOR (実用フォントからの高精度抽出)
           ======================================================== */}
        {activeTab === 'extract' && (
          <div className="flex-1 flex flex-col min-h-0 p-3 space-y-3 overflow-y-auto">
            <div
              className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${
                isLight ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' : 'bg-[#142218] border-[#223627] text-emerald-200'
              }`}
            >
              <div className="flex items-center space-x-1.5 font-bold">
                <Type className="w-4 h-4 text-emerald-600" />
                <span>フォントから実用ベクター部首を自動抽出</span>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed">
                任意の漢字や部首を入力し、Noto Sans JP や Noto Serif JP 等の書体・太さ・偏旁部位を選択して高品質ベクター輪郭として抽出できます。
              </p>
            </div>

            {/* Target Character Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold block">抽出する部首または漢字:</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={extractChar}
                  onChange={(e) => setExtractChar(e.target.value)}
                  placeholder="氵, 亻, 木, 語, 海..."
                  maxLength={10}
                  className={`flex-1 px-3 py-1.5 rounded-md border text-sm font-bold text-center ${
                    isLight ? 'bg-white border-stone-300 text-stone-900' : 'bg-[#19241e] border-[#25362b] text-emerald-100'
                  }`}
                />
                <button
                  onClick={() => performExtraction(extractChar, extractRegion)}
                  disabled={isExtracting}
                  className={`px-3 py-1.5 rounded-md font-bold text-xs flex items-center space-x-1 shadow-xs transition-all ${
                    isLight
                      ? 'bg-emerald-800 text-white hover:bg-emerald-900'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin' : ''}`} />
                  <span>抽出実行</span>
                </button>
              </div>
            </div>

            {/* Quick Radical Chips */}
            <div className="space-y-1">
              <span className="text-[10px] text-stone-500 font-bold block">よく使う部首クイック選択:</span>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                {POPULAR_RADICALS_QUICK_PRESETS.map((p) => (
                  <button
                    key={p.char}
                    onClick={() => {
                      setExtractChar(p.char);
                      performExtraction(p.char, extractRegion);
                    }}
                    className={`px-2 py-0.5 rounded border text-xs font-semibold transition-all ${
                      extractChar === p.char
                        ? isLight
                          ? 'bg-emerald-800 text-white border-emerald-900 font-bold'
                          : 'bg-emerald-600 text-white border-emerald-500 font-bold'
                        : isLight
                        ? 'bg-white text-stone-700 hover:bg-emerald-100 border-stone-200'
                        : 'bg-[#1a261f] text-stone-300 hover:bg-[#25362b] border-[#25362b]'
                    }`}
                    title={`${p.name} (${p.description})`}
                  >
                    {p.char}
                  </button>
                ))}
              </div>
            </div>

            {/* Font & Weight Controls */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-500 block">ベース書体:</label>
                <select
                  value={extractFontFamily}
                  onChange={(e) => {
                    const val = e.target.value;
                    setExtractFontFamily(val);
                    const matched = RADICAL_FONT_OPTIONS.find((o) => o.fontFamily === val);
                    if (matched) setSelectedFontStyle(matched);
                  }}
                  className={`w-full px-2 py-1.5 rounded border text-xs ${
                    isLight ? 'bg-white border-stone-300' : 'bg-[#19241e] border-[#25362b]'
                  }`}
                >
                  <option value="'Noto Serif JP', serif">Noto Serif JP (明朝体)</option>
                  <option value="'Noto Sans JP', sans-serif">Noto Sans JP (ゴシック)</option>
                  <option value="'Zen Maru Gothic', sans-serif">Zen Maru (丸ゴシック)</option>
                  <option value="serif">システム・明朝</option>
                  <option value="sans-serif">システム・ゴシック</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-500 block">太さ (Weight):</label>
                <select
                  value={extractWeight}
                  onChange={(e) => setExtractWeight(Number(e.target.value))}
                  className={`w-full px-2 py-1.5 rounded border text-xs ${
                    isLight ? 'bg-white border-stone-300' : 'bg-[#19241e] border-[#25362b]'
                  }`}
                >
                  <option value={300}>細め (Light / 300)</option>
                  <option value={500}>標準 (Medium / 500)</option>
                  <option value={700}>太め (Bold / 700)</option>
                  <option value={900}>極太 (Heavy / 900)</option>
                </select>
              </div>
            </div>

            {/* Region Crop */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-500 block">抽出部位 (複合漢字から切り出し):</label>
              <div className="grid grid-cols-5 gap-1 text-[10px]">
                {[
                  { id: 'full', label: '全体' },
                  { id: 'hen', label: '偏 (左側)' },
                  { id: 'tsukuri', label: '旁 (右側)' },
                  { id: 'kanmuri', label: '冠 (上側)' },
                  { id: 'ashi', label: '脚 (下側)' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      const reg = item.id as 'full' | 'hen' | 'tsukuri' | 'kanmuri' | 'ashi';
                      setExtractRegion(reg);
                      performExtraction(extractChar, reg);
                    }}
                    className={`py-1 rounded border text-center transition-colors ${
                      extractRegion === item.id
                        ? isLight
                          ? 'bg-emerald-800 text-white font-bold border-emerald-900'
                          : 'bg-emerald-600 text-white font-bold border-emerald-500'
                        : isLight
                        ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-emerald-50'
                        : 'bg-[#18231c] border-[#25362b] text-stone-300 hover:bg-[#202d24]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Extracted Vector Preview */}
            <div
              className={`p-3 rounded-lg border flex flex-col items-center justify-center space-y-2 ${
                isLight ? 'bg-white border-stone-300' : 'bg-[#18231c] border-[#25362b]'
              }`}
            >
              <span className="text-[10px] text-stone-400 font-bold self-start">抽出ベクタープレビュー:</span>
              <div className="w-28 h-28 border border-dashed rounded flex items-center justify-center p-1 bg-[#f9fbf9] dark:bg-[#121a14]">
                {isExtracting ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                ) : extractedContours.length > 0 ? (
                  <svg viewBox="0 0 1000 1000" className="w-full h-full">
                    <path
                      d={contoursToSvgPath(extractedContours)}
                      fill={isLight ? '#111827' : '#ecfdf5'}
                      fillRule="evenodd"
                    />
                  </svg>
                ) : (
                  <span className="text-xs text-stone-400">輪郭なし</span>
                )}
              </div>
              <span className="text-[10px] text-stone-500">輪郭数: {extractedContours.length} 本</span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handleInsertWithPlacement(extractedContours)}
                disabled={extractedContours.length === 0}
                className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center space-x-1 shadow-sm transition-all ${
                  extractedContours.length > 0
                    ? isLight
                      ? 'bg-emerald-800 text-white hover:bg-emerald-900'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-stone-300 text-stone-500 cursor-not-allowed'
                }`}
              >
                <span>キャンバスに挿入</span>
              </button>

              <button
                onClick={() =>
                  handleSaveContoursAsPart(
                    extractedContours,
                    `抽出_${extractChar}_${extractRegion !== 'full' ? extractRegion : '全体'}`
                  )
                }
                disabled={extractedContours.length === 0}
                className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center space-x-1 border transition-all ${
                  extractedContours.length > 0
                    ? isLight
                      ? 'bg-white border-emerald-700 text-emerald-900 hover:bg-emerald-50'
                      : 'bg-[#1a261f] border-emerald-500 text-emerald-200 hover:bg-[#223127]'
                    : 'border-stone-300 text-stone-400 cursor-not-allowed'
                }`}
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>マイパーツに保存</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: KANGXI 214 RADICALS CATALOG (康熙部首214一覧)
           ======================================================== */}
        {activeTab === 'kangxi' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search & Stroke Filter */}
            <div className={`p-2 border-b space-y-1.5 shrink-0 ${isLight ? 'bg-[#f4f8f5]' : 'bg-[#141d17]'}`}>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
                <input
                  type="text"
                  value={kangxiSearch}
                  onChange={(e) => setKangxiSearch(e.target.value)}
                  placeholder="部首名・読み・漢字で検索 (例: にんべん, ジン, 水)..."
                  className={`w-full pl-8 pr-3 py-1.5 rounded-md border text-xs ${
                    isLight
                      ? 'bg-white border-stone-300 text-stone-800 focus:border-emerald-600'
                      : 'bg-[#1a261f] border-[#25362b] text-emerald-100 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Stroke Count filter */}
              <div className="flex space-x-1 overflow-x-auto text-[10px] pb-0.5">
                <button
                  onClick={() => setKangxiStrokeFilter('all')}
                  className={`px-2 py-0.5 rounded-full whitespace-nowrap ${
                    kangxiStrokeFilter === 'all'
                      ? 'bg-emerald-800 text-white font-bold'
                      : isLight
                      ? 'bg-white text-stone-700 border border-stone-200'
                      : 'bg-[#1a261f] text-stone-300 border border-[#25362b]'
                  }`}
                >
                  全画数
                </button>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((s) => (
                  <button
                    key={s}
                    onClick={() => setKangxiStrokeFilter(s)}
                    className={`px-2 py-0.5 rounded-full whitespace-nowrap ${
                      kangxiStrokeFilter === s
                        ? 'bg-emerald-800 text-white font-bold'
                        : isLight
                        ? 'bg-white text-stone-700 border border-stone-200'
                        : 'bg-[#1a261f] text-stone-300 border border-[#25362b]'
                    }`}
                  >
                    {s}画
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredKangxi.map((item) => (
                <div
                  key={item.number}
                  className={`p-2 rounded-lg border flex items-center justify-between transition-all ${
                    isLight ? 'bg-white border-stone-200 hover:border-emerald-600' : 'bg-[#1a261f] border-[#25362b] hover:border-emerald-500'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span
                      style={{
                        fontFamily: selectedFontStyle.fontFamily,
                        fontWeight: selectedFontStyle.fontWeight,
                      }}
                      className="text-xl font-bold w-8 text-center shrink-0 text-emerald-950 dark:text-emerald-200"
                    >
                      {item.char}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold truncate">{item.name}</span>
                        <span className="text-[10px] text-stone-400">({item.strokes}画)</span>
                      </div>
                      <div className="text-[10px] text-stone-500 truncate">
                        音: {item.reading} {item.exampleChars && `| 例: ${item.exampleChars}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      disabled={extractingKangxiNum === item.number}
                      onClick={async () => {
                        const matchedPreset = KANJI_RADICALS.find(
                          (r) => r.char === item.char || r.name.startsWith(item.name)
                        );

                        try {
                          setExtractingKangxiNum(item.number);
                          const contours = await getOrExtractRadicalContours(
                            item.char,
                            'full',
                            selectedFontStyle.fontFamily,
                            selectedFontStyle.fontWeight
                          );
                          if (contours && contours.length > 0) {
                            handleInsertWithPlacement(contours, `${item.name} (${selectedFontStyle.label})`, matchedPreset?.category);
                            return;
                          }
                        } catch {
                          // fallback
                        } finally {
                          setExtractingKangxiNum(null);
                        }

                        if (matchedPreset && matchedPreset.contours.length > 0) {
                          handleInsertWithPlacement(matchedPreset.contours, item.name, matchedPreset.category);
                          return;
                        }
                        showNotice(`「${item.char}」の輪郭抽出に失敗しました`);
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition-colors flex items-center justify-center min-w-[42px] ${
                        extractingKangxiNum === item.number
                          ? 'opacity-60 cursor-wait bg-stone-500 text-white'
                          : isLight
                          ? 'bg-emerald-800 text-white hover:bg-emerald-900'
                          : 'bg-emerald-600 text-white hover:bg-emerald-500'
                      }`}
                    >
                      {extractingKangxiNum === item.number ? '抽出中…' : '挿入'}
                    </button>
                    <button
                      onClick={() => {
                        setExtractChar(item.char);
                        setActiveTab('extract');
                      }}
                      className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                        isLight ? 'border-stone-300 hover:bg-stone-100' : 'border-[#25362b] hover:bg-[#202d24]'
                      }`}
                      title="この部首の詳細抽出画面へ切り替える"
                    >
                      詳細
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: GEOMETRIC SHAPES (幾何学図形)
           ======================================================== */}
        {activeTab === 'shapes' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Category Filter */}
            <div
              className={`p-2 border-b flex space-x-1 overflow-x-auto text-[11px] shrink-0 ${
                isLight ? 'bg-[#edf5f0] border-[#d8e6df]' : 'bg-[#101813] border-[#25362b]'
              }`}
            >
              {[
                { id: 'all', label: 'すべて' },
                { id: 'basic', label: '基本' },
                { id: 'polygon', label: '多角形' },
                { id: 'symbol', label: '星・ハート' },
                { id: 'decorative', label: '装飾・複合' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setShapeCategoryFilter(cat.id)}
                  className={`px-2 py-0.5 rounded-full whitespace-nowrap text-[10px] ${
                    shapeCategoryFilter === cat.id
                      ? isLight
                        ? 'bg-emerald-800 text-white font-bold'
                        : 'bg-emerald-600 text-white font-bold'
                      : isLight
                      ? 'bg-white text-stone-700 hover:bg-emerald-100 border border-stone-200'
                      : 'bg-[#1a261f] text-stone-300 hover:bg-[#25362b] border border-[#25362b]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-2.5 grid grid-cols-3 gap-2 content-start">
              {SHAPE_PRESETS.filter(
                (p) => shapeCategoryFilter === 'all' || p.category === shapeCategoryFilter
              ).map((preset) => {
                const shapeContours = generateShapeByType(preset.id, 500, 500, 750);
                const svgPath = contoursToSvgPath(shapeContours);
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleInsertWithPlacement(shapeContours)}
                    className={`flex flex-col items-center justify-between p-2 rounded-lg border group transition-all cursor-pointer ${
                      isLight
                        ? 'bg-white border-[#c8ded3] hover:border-emerald-700 hover:bg-emerald-50 shadow-xs'
                        : 'bg-[#1a261f] border-[#25362b] hover:border-emerald-500 hover:bg-[#223127]'
                    }`}
                    title={`${preset.name} (${preset.description}) をキャンバスに挿入`}
                  >
                    <div className="w-12 h-12 flex items-center justify-center p-1">
                      <svg viewBox="0 0 1000 1000" className="w-full h-full">
                        <path
                          d={svgPath}
                          fill={isLight ? '#1f2937' : '#ecfdf5'}
                          className={isLight ? 'group-hover:fill-emerald-800' : 'group-hover:fill-emerald-300'}
                        />
                      </svg>
                    </div>
                    <span
                      className={`text-[10px] font-bold mt-1 truncate w-full text-center ${
                        isLight ? 'text-stone-800 group-hover:text-emerald-950' : 'text-emerald-200 group-hover:text-white'
                      }`}
                    >
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: SYNTHESIZE FROM EXISTING GLYPHS (文字合成)
           ======================================================== */}
        {activeTab === 'from_glyph' && (
          <div className="flex-1 flex flex-col min-h-0 p-3 space-y-2">
            <div className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-300">
              プロジェクト内で作成済みの別の文字を選択し、現在のグリフに偏や旁として合体できます。
            </div>

            {availableGlyphs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-stone-500 space-y-2">
                <Layers className="w-8 h-8 opacity-40 text-emerald-600" />
                <p className="text-xs">まだ作成済みの文字がありません。</p>
                <p className="text-[10px]">文字を作図するとここに合成候補として現れます。</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-2 content-start pr-1">
                {availableGlyphs.map((glyph) => {
                  const svgPath = contoursToSvgPath(glyph.contours);
                  return (
                    <button
                      key={glyph.unicode}
                      onClick={() => handleInsertWithPlacement(glyph.contours)}
                      className={`flex flex-col items-center p-2 rounded-md border group transition-all ${
                        isLight
                          ? 'bg-white border-[#c8ded3] hover:border-emerald-700 hover:bg-emerald-50 shadow-xs'
                          : 'bg-[#1a261f] border-[#25362b] hover:border-emerald-500 hover:bg-[#223127]'
                      }`}
                      title={`文字「${glyph.char}」の輪郭を取り込む`}
                    >
                      <div className="w-10 h-10 flex items-center justify-center">
                        <svg viewBox="0 0 1000 1000" className="w-full h-full">
                          <path
                            d={svgPath}
                            fill={isLight ? '#1f2937' : '#ecfdf5'}
                            className={isLight ? 'group-hover:fill-emerald-800' : 'group-hover:fill-emerald-300'}
                          />
                        </svg>
                      </div>
                      <span className="text-xs font-bold mt-1 text-emerald-950 dark:text-emerald-200">
                        {glyph.char}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 6: CUSTOM PARTS (マイパーツ)
           ======================================================== */}
        {activeTab === 'custom' && (
          <div className="flex-1 flex flex-col min-h-0 p-3 space-y-2.5">
            {/* Direct link to dedicated Radical Parts Studio */}
            {onOpenRadicalStudio && (
              <button
                onClick={onOpenRadicalStudio}
                className={`w-full py-2 px-3 rounded-lg border font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all ${
                  isLight
                    ? 'bg-amber-400 border-amber-500 text-emerald-950 hover:bg-amber-300'
                    : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500'
                }`}
              >
                <Shapes className="w-4 h-4" />
                <span>部首パーツ工房で本格設計 &gt;</span>
              </button>
            )}

            {/* Custom Part / Name Frame Creation Actions */}
            {!showSaveInput ? (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => {
                    setCreateOnlyFrame(true);
                    setShowSaveInput(true);
                  }}
                  className={`py-2 px-2 rounded-md border flex items-center justify-center space-x-1 transition-all font-bold text-xs ${
                    isLight
                      ? 'bg-emerald-800 border-emerald-900 text-white hover:bg-emerald-900 shadow-xs'
                      : 'bg-emerald-700 border-emerald-600 text-white hover:bg-emerald-600 shadow-xs'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>名前枠を作成</span>
                </button>

                <button
                  onClick={() => {
                    setCreateOnlyFrame(false);
                    setShowSaveInput(true);
                  }}
                  className={`py-2 px-2 rounded-md border flex items-center justify-center space-x-1 transition-all font-bold text-xs ${
                    isLight
                      ? 'bg-white border-emerald-700 text-emerald-950 hover:bg-emerald-50 shadow-xs'
                      : 'bg-[#1a261f] border-emerald-500 text-emerald-200 hover:bg-[#223127] shadow-xs'
                  }`}
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>現在の文字を保存</span>
                </button>
              </div>
            ) : (
              <div
                className={`p-2.5 rounded-lg border space-y-2 ${
                  isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#1a261f] border-[#25362b]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold">
                    {createOnlyFrame ? 'パーツ枠の名前を入力:' : '保存するパーツ名を入力:'}
                  </span>
                  <button
                    onClick={() => setCreateOnlyFrame(!createOnlyFrame)}
                    className="text-[10px] text-emerald-700 dark:text-emerald-400 underline"
                  >
                    {createOnlyFrame ? '→ 形状も保存する' : '→ 名前枠だけ作成する'}
                  </button>
                </div>
                <input
                  type="text"
                  value={newPartName}
                  onChange={(e) => setNewPartName(e.target.value)}
                  placeholder={createOnlyFrame ? '例: さんずい, きへん, 自作枠1' : `例: ${selectedChar || '無題'}のへん`}
                  className={`w-full px-2.5 py-1.5 rounded border text-xs font-bold ${
                    isLight ? 'bg-[#f7faf8] border-stone-300 text-stone-800' : 'bg-[#101813] border-[#25362b] text-emerald-100'
                  }`}
                  autoFocus
                />
                <div className="flex justify-end space-x-1.5 pt-1">
                  <button
                    onClick={() => setShowSaveInput(false)}
                    className="px-2.5 py-1 rounded text-[11px] border border-stone-300 dark:border-stone-700"
                  >
                    キャンセル
                  </button>
                  {createOnlyFrame ? (
                    <button
                      onClick={() => handleCreateNameFrame()}
                      className="px-3 py-1 rounded text-[11px] bg-emerald-800 text-white font-bold hover:bg-emerald-900"
                    >
                      名前枠を作成
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSaveContoursAsPart(currentContours, `パーツ_${selectedChar || '無題'}`)}
                      className="px-3 py-1 rounded text-[11px] bg-emerald-800 text-white font-bold hover:bg-emerald-900"
                    >
                      保存
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Saved Parts Grid / Name Frame Cards */}
            {customParts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-stone-500 space-y-2">
                <BookmarkPlus className="w-8 h-8 opacity-40 text-emerald-600" />
                <p className="text-xs">パーツ枠がありません。</p>
                <p className="text-[10px]">
                  「名前枠を作成」を押して、好きな名前のパーツ枠を作成・管理できます。
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 content-start pr-1">
                {customParts.map((part) => {
                  const hasContours = part.contours && part.contours.length > 0;
                  const svgPath = hasContours ? contoursToSvgPath(part.contours) : '';

                  return (
                    <div
                      key={part.id}
                      onClick={() => {
                        if (hasContours) {
                          handleInsertWithPlacement(part.contours, part.name);
                        } else {
                          showNotice(`「${part.name}」には輪郭が未登録です。「工房」で作成するか「現在の文字を割当」を押してください`);
                        }
                      }}
                      className={`relative flex flex-col justify-between p-2.5 rounded-lg border group transition-all cursor-pointer ${
                        isLight
                          ? 'bg-white border-[#c8ded3] hover:border-emerald-700 hover:bg-[#fbfdfc] shadow-xs'
                          : 'bg-[#1a261f] border-[#25362b] hover:border-emerald-500 hover:bg-[#223127]'
                      }`}
                    >
                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomParts((prev) => prev.filter((p) => p.id !== part.id));
                        }}
                        className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/50 text-stone-400 hover:text-red-600 transition-colors z-10"
                        title="パーツ枠を削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {hasContours ? (
                        /* Vector Contour Preview */
                        <div className="flex flex-col items-center">
                          <div className="w-14 h-14 flex items-center justify-center p-1">
                            <svg viewBox="0 0 1000 1000" className="w-full h-full">
                              <path
                                d={svgPath}
                                fill={isLight ? '#1f2937' : '#ecfdf5'}
                                className={isLight ? 'group-hover:fill-emerald-800' : 'group-hover:fill-emerald-300'}
                              />
                            </svg>
                          </div>
                          <span className="text-[11px] font-bold mt-1 text-center truncate w-full">
                            {part.name}
                          </span>
                        </div>
                      ) : (
                        /* Minimal Name Frame Badge & Actions */
                        <div className="flex flex-col justify-between min-h-[72px]">
                          <div>
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-200 inline-block mb-1">
                              名前枠
                            </span>
                            <span className="text-xs font-bold text-stone-800 dark:text-emerald-100 block truncate">
                              {part.name}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center space-x-1">
                            {currentContours.length > 0 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveContoursAsPart(currentContours, part.name);
                                }}
                                className="w-full text-[10px] font-bold py-1 px-1.5 rounded bg-emerald-800 text-white hover:bg-emerald-900 transition-colors text-center shadow-xs"
                                title="現在のキャンバスの文字をこの名前枠に保存"
                              >
                                現在の文字を割当
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onOpenRadicalStudio) onOpenRadicalStudio();
                                }}
                                className="w-full text-[10px] font-bold py-1 px-1.5 rounded bg-stone-100 dark:bg-[#25362b] text-stone-700 dark:text-emerald-200 hover:bg-emerald-700 hover:text-white transition-colors text-center"
                              >
                                工房で作成
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
