import { PathContour } from '../types';
import { vectorizeImage } from './imageVectorizer';
import { getContoursBoundingBox, transformContours } from './pathUtils';

export interface ExtractRadicalOptions {
  char: string;
  fontFamily?: string;
  fontWeight?: number | string;
  region?: 'full' | 'hen' | 'tsukuri' | 'kanmuri' | 'ashi';
  smoothing?: number;
  fitMargin?: number;
}

export interface KangxiRadicalItem {
  number: number;
  char: string;
  name: string;
  reading: string;
  strokes: number;
  category: 'hen' | 'tsukuri' | 'kanmuri' | 'ashi' | 'tare' | 'nyo' | 'kamae' | 'basic';
  exampleChars?: string;
}

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
    subLabel: '丸ゴシック (Zen Maru Gothic)',
    fontFamily: "'Zen Maru Gothic', sans-serif",
    fontWeight: 700,
  },
];

const MAX_RADICAL_CACHE_SIZE = 100;
const radicalContoursCache = new Map<string, PathContour[]>();

function cacheRadicalContours(key: string, contours: PathContour[]): void {
  if (radicalContoursCache.size >= MAX_RADICAL_CACHE_SIZE) {
    const firstKey = radicalContoursCache.keys().next().value;
    if (firstKey !== undefined) {
      radicalContoursCache.delete(firstKey);
    }
  }
  radicalContoursCache.set(key, contours);
}

export const DEFAULT_RADICAL_FONT_FAMILY = "'Noto Serif JP', serif";
export const DEFAULT_RADICAL_FONT_WEIGHT = 600;

/**
 * High-precision browser-side font radical vectorizer.
 * Renders any Japanese glyph or radical at high DPI and traces it into clean Cubic Bézier contours.
 */
export async function extractRadicalFromFont(
  options: ExtractRadicalOptions
): Promise<PathContour[]> {
  const {
    char,
    fontFamily = DEFAULT_RADICAL_FONT_FAMILY,
    fontWeight = DEFAULT_RADICAL_FONT_WEIGHT,
    region = 'full',
    smoothing = 0.8,
    fitMargin = 80,
  } = options;

  if (!char || char.trim().length === 0) {
    return [];
  }

  // Ensure target webfont is loaded into the browser before drawing
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.load(`${fontWeight} 200px ${fontFamily}`);
      await document.fonts.ready;
    } catch {
      // Continue even if fonts.load throws
    }
  }

  // High-resolution canvas for crisp typography capture
  const canvasSize = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // Clear to white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // Render character with antialiasing
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#000000';
  const fontSize = 780;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char.trim()[0], canvasSize / 2, canvasSize / 2 + 10);

  // Crop / isolate region if specified
  if (region === 'hen') {
    // Clear right side
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(canvasSize * 0.51, 0, canvasSize * 0.49, canvasSize);
  } else if (region === 'tsukuri') {
    // Clear left side
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize * 0.49, canvasSize);
  } else if (region === 'kanmuri') {
    // Clear bottom side
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, canvasSize * 0.51, canvasSize, canvasSize * 0.49);
  } else if (region === 'ashi') {
    // Clear top side
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize, canvasSize * 0.49);
  }

  // Detect if Mincho (serif) to preserve delicate horizontal strokes & serifs
  const isMincho = fontFamily.includes('Serif') || fontFamily.includes('serif');
  const threshold = isMincho ? 150 : 138;

  // Vectorize using smoothed marching squares + cubic fitting
  const result = await vectorizeImage(canvas, {
    threshold,
    smoothing: Math.min(smoothing, 0.85),
    minArea: 6,
    fitMargin,
  });

  if (!result.contours || result.contours.length === 0) {
    return [];
  }

  // Normalize and center contours into the standard 1000x1000 EM box with strict aspect ratio preservation
  const bbox = getContoursBoundingBox(result.contours);
  if (bbox.width <= 0 || bbox.height <= 0) {
    return result.contours;
  }

  // Target standard kanji glyph box (800x740 inside 1000x1000)
  const targetX = 100;
  const targetY = 130;
  const targetW = 800;
  const targetH = 740;

  // Scale to target box strictly proportionally to guarantee zero aspect ratio distortion
  const scale = Math.min(targetW / bbox.width, targetH / bbox.height);
  const scaledW = bbox.width * scale;
  const scaledH = bbox.height * scale;
  const offsetX = targetX + (targetW - scaledW) / 2 - bbox.minX * scale;
  const offsetY = targetY + (targetH - scaledH) / 2 - bbox.minY * scale;

  return transformContours(result.contours, (p) => ({
    x: Math.round((p.x * scale + offsetX) * 10) / 10,
    y: Math.round((p.y * scale + offsetY) * 10) / 10,
  }));
}

/**
 * Returns cached or freshly extracted authentic vector contours for a radical character
 */
export async function getOrExtractRadicalContours(
  char: string,
  region: 'full' | 'hen' | 'tsukuri' | 'kanmuri' | 'ashi' = 'full',
  fontFamily: string = DEFAULT_RADICAL_FONT_FAMILY,
  fontWeight: number | string = DEFAULT_RADICAL_FONT_WEIGHT
): Promise<PathContour[]> {
  if (!char || char.trim().length === 0) return [];
  const cleanChar = char.trim()[0];
  const cacheKey = `${cleanChar}_${region}_${fontFamily}_${fontWeight}`;
  if (radicalContoursCache.has(cacheKey)) {
    return JSON.parse(JSON.stringify(radicalContoursCache.get(cacheKey)!));
  }

  // When extracting a radical directly, always extract the full, intact character
  // Cropping is only for extracting a component out of a compound character
  const effectiveRegion = region === 'full' ? 'full' : region;

  const contours = await extractRadicalFromFont({
    char: cleanChar,
    fontFamily,
    fontWeight,
    region: effectiveRegion,
    smoothing: 1.3,
    fitMargin: 70,
  });

  if (contours && contours.length > 0) {
    cacheRadicalContours(cacheKey, contours);
    return JSON.parse(JSON.stringify(contours));
  }
  return [];
}

/**
 * 45 Most Widely Used Kanji Radicals (偏旁冠脚定番)
 */
export const POPULAR_RADICALS_QUICK_PRESETS: {
  char: string;
  name: string;
  category: 'hen' | 'tsukuri' | 'kanmuri' | 'ashi' | 'tare' | 'nyo' | 'kamae';
  description: string;
}[] = [
  // 偏 (Hen)
  { char: '亻', name: 'にんべん', category: 'hen', description: '人に関係する漢字 (休, 作, 体, 信)' },
  { char: '氵', name: 'さんずい', category: 'hen', description: '水・液体に関係する漢字 (海, 湖, 清, 河)' },
  { char: '木', name: 'きへん', category: 'hen', description: '樹木・木製品に関係する漢字 (林, 村, 校, 板)' },
  { char: '扌', name: 'てへん', category: 'hen', description: '手・手の動作に関係する漢字 (持, 打, 投, 指)' },
  { char: '言', name: 'ごんべん', category: 'hen', description: '言葉・話すことに関係する漢字 (話, 語, 読, 談)' },
  { char: '糸', name: 'いとへん', category: 'hen', description: '織物・糸に関係する漢字 (線, 細, 組, 約)' },
  { char: '禾', name: 'のぎへん', category: 'hen', description: '穀物・稲に関係する漢字 (秋, 科, 秒, 和)' },
  { char: '金', name: 'かねへん', category: 'hen', description: '金属・鉱物に関係する漢字 (鉄, 銀, 銅, 針)' },
  { char: '日', name: 'ひへん', category: 'hen', description: '太陽・時間・暦に関係する漢字 (晴, 明, 時, 暗)' },
  { char: '月', name: 'つきへん・肉月', category: 'hen', description: '人体・肉に関係する漢字 (服, 胴, 腕, 脚)' },
  { char: '口', name: 'くちへん', category: 'hen', description: '口・発声・味に関係する漢字 (味, 叫, 吸, 呼)' },
  { char: '土', name: 'つちへん', category: 'hen', description: '土地・土壌に関係する漢字 (地, 坂, 場, 城)' },
  { char: '女', name: 'おんなへん', category: 'hen', description: '女性・親族に関係する漢字 (妹, 姉, 好, 姓)' },
  { char: '忄', name: 'りっしんべん', category: 'hen', description: '心・感情に関係する漢字 (情, 快, 忙, 性)' },
  { char: '火', name: 'ひへん', category: 'hen', description: '火・熱に関係する漢字 (灯, 炊, 焼, 煙)' },
  { char: '車', name: 'くるまへん', category: 'hen', description: '乗り物・輸送に関係する漢字 (転, 輪, 軽, 輸)' },
  { char: '貝', name: 'かいへん', category: 'hen', description: '財貨・金銭に関係する漢字 (買, 販, 財, 貯)' },
  { char: '目', name: 'めへん', category: 'hen', description: '目・視覚に関係する漢字 (眼, 眠, 眺, 睡)' },
  { char: '足', name: 'あしへん', category: 'hen', description: '足・歩行に関係する漢字 (路, 踏, 跳, 跡)' },
  { char: '食', name: 'しょくへん', category: 'hen', description: '食事・食物に関係する漢字 (飲, 館, 飯, 飼)' },
  { char: '虫', name: 'むしへん', category: 'hen', description: '小動物・昆虫に関係する漢字 (蝶, 蚊, 蛇, 蜂)' },
  { char: '魚', name: 'さかなへん', category: 'hen', description: '魚類・海産物に関係する漢字 (鮮, 鯨, 鮭, 鮎)' },
  { char: '阝', name: 'こざとへん', category: 'hen', description: '丘陵・地形に関係する漢字 (防, 階, 限, 陸)' },
  { char: '弓', name: 'ゆみへん', category: 'hen', description: '弓・弾力に関係する漢字 (引, 張, 強, 弦)' },

  // 旁 (Tsukuri)
  { char: '刂', name: 'りっとう', category: 'tsukuri', description: '刃物・切ることに関係する漢字 (列, 刻, 創, 割)' },
  { char: '力', name: 'ちから', category: 'tsukuri', description: '力・労働に関係する漢字 (助, 動, 効, 勇)' },
  { char: '攵', name: 'のぶん', category: 'tsukuri', description: '動作・叩くことに関係する漢字 (改, 教, 敬, 数)' },
  { char: '隹', name: 'ふるとり', category: 'tsukuri', description: '小鳥に関係する漢字 (集, 難, 雀, 雅)' },
  { char: '頁', name: 'おおがい', category: 'tsukuri', description: '頭部・顔に関係する漢字 (頭, 額, 願, 順)' },
  { char: '阝', name: 'おおざと', category: 'tsukuri', description: '村落・都市に関係する漢字 (都, 部, 郷, 郵)' },
  { char: '見', name: 'みる', category: 'tsukuri', description: '見ることに関係する漢字 (視, 親, 観, 覚)' },
  { char: '鳥', name: 'とり', category: 'tsukuri', description: '鳥類に関係する漢字 (鳴, 鴎, 鶏, 鴨)' },

  // 冠 (Kanmuri)
  { char: '艹', name: 'くさかんむり', category: 'kanmuri', description: '草・植物に関係する漢字 (花, 草, 茶, 苗)' },
  { char: '宀', name: 'うかんむり', category: 'kanmuri', description: '屋根・家屋に関係する漢字 (家, 安, 室, 宿)' },
  { char: '⺮', name: 'たけかんむり', category: 'kanmuri', description: '竹・竹製品に関係する漢字 (竹, 笑, 等, 筆)' },
  { char: '⻗', name: 'あめかんむり', category: 'kanmuri', description: '気象・雨に関係する漢字 (雪, 雲, 電, 震)' },
  { char: '𠆢', name: 'ひとやね', category: 'kanmuri', description: '人・覆いに関係する漢字 (今, 会, 合, 全)' },
  { char: '冖', name: 'わかんむり', category: 'kanmuri', description: '覆い布に関係する漢字 (冠, 冥, 冨)' },
  { char: '亠', name: 'なべぶた', category: 'kanmuri', description: '頭部・被せ物に関係する漢字 (交, 京, 亭, 亡)' },
  { char: '穴', name: 'あなかんむり', category: 'kanmuri', description: '洞穴・空間に関係する漢字 (空, 究, 突, 窒)' },

  // 脚 (Ashi)
  { char: '心', name: 'こころ', category: 'ashi', description: '心・思考に関係する漢字 (思, 息, 忍, 忠)' },
  { char: '灬', name: 'れっか・れんが', category: 'ashi', description: '火・熱に関係する漢字 (熱, 点, 然, 照)' },
  { char: '儿', name: 'ひとあし', category: 'ashi', description: '人の足・歩行に関係する漢字 (兄, 先, 光, 免)' },
  { char: '皿', name: 'さら', category: 'ashi', description: '器・食器に関係する漢字 (盆, 盛, 益, 盟)' },

  // 構え・繞・垂れ (Kamae, Nyo, Tare)
  { char: '門', name: 'もんがまえ', category: 'kamae', description: '出入口・門に関係する漢字 (開, 閉, 問, 関)' },
  { char: '囗', name: 'くにがまえ', category: 'kamae', description: '囲い・領域に関係する漢字 (国, 園, 回, 囲)' },
  { char: '⻌', name: 'しんにょう', category: 'nyo', description: '道・移動・進むことに関係する漢字 (道, 通, 進, 近)' },
  { char: '广', name: 'まだれ', category: 'tare', description: '建物・屋敷に関係する漢字 (広, 店, 座, 庫)' },
  { char: '疒', name: 'やまいだれ', category: 'tare', description: '病気・症状に関係する漢字 (病, 痛, 療, 痕)' },
  { char: '尸', name: 'しかばね', category: 'tare', description: '身体・住まいに関係する漢字 (屋, 展, 屈, 局)' },
];

import { KANGXI_214_RADICALS, KangxiRadicalFullEntry } from '../data/kangxi214Radicals';

/**
 * Complete 214 Kangxi Traditional Radicals Catalog (康熙字典部首 全214部首)
 */
export const KANGXI_RADICALS_CATALOG: KangxiRadicalItem[] = KANGXI_214_RADICALS.map((k) => ({
  number: k.number,
  char: k.displayChar || k.char,
  name: k.name,
  reading: k.reading,
  strokes: k.strokes,
  category: k.category,
  exampleChars: k.kanjiList.slice(0, 4).join(''),
}));

/**
 * Standard default radical definitions for Radical Studio
 */
export const INITIAL_STUDIO_RADICAL_DEFS: {
  id: string;
  name: string;
  char: string;
  category: 'hen' | 'tsukuri' | 'kanmuri' | 'ashi' | 'tare' | 'nyo' | 'kamae';
  description: string;
}[] = [
  { id: 'init_sanzui', name: 'さんずい (氵)', char: '氵', category: 'hen', description: '水・液体に関する偏' },
  { id: 'init_kihen', name: 'きへん (木)', char: '木', category: 'hen', description: '樹木・木材に関する偏' },
  { id: 'init_ninben', name: 'にんべん (亻)', char: '亻', category: 'hen', description: '人間・動作に関する偏' },
  { id: 'init_gonben', name: 'ごんべん (言)', char: '言', category: 'hen', description: '言葉・伝達に関する偏' },
  { id: 'init_kusakanmuri', name: 'くさかんむり (艹)', char: '艹', category: 'kanmuri', description: '草木・植物に関する冠' },
  { id: 'init_tehen', name: 'てへん (扌)', char: '扌', category: 'hen', description: '手・動作に関する偏' },
  { id: 'init_ukanmuri', name: 'うかんむり (宀)', char: '宀', category: 'kanmuri', description: '屋根・家屋に関する冠' },
  { id: 'init_shinnyo', name: 'しんにょう (⻌)', char: '⻌', category: 'nyo', description: '道・移動・進行に関する繞' },
];

