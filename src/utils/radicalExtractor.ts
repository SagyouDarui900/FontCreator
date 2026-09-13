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

const radicalContoursCache = new Map<string, PathContour[]>();

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
    smoothing = 1.2,
    fitMargin = 70,
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
  const canvasSize = 700;
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

  // Render character
  ctx.fillStyle = '#000000';
  const fontSize = 520;
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
  const threshold = isMincho ? 155 : 140;

  // Vectorize using smoothed marching squares + cubic fitting
  const result = await vectorizeImage(canvas, {
    threshold,
    smoothing: isMincho ? 1.1 : smoothing,
    minArea: 8,
    fitMargin,
  });

  if (!result.contours || result.contours.length === 0) {
    return [];
  }

  // Normalize and center contours into the standard 1000x1000 EM box
  const bbox = getContoursBoundingBox(result.contours);
  if (bbox.width <= 0 || bbox.height <= 0) {
    return result.contours;
  }

  // Check target dimensions based on region
  let targetX = 80;
  let targetY = 160;
  let targetW = 840;
  let targetH = 680;

  if (region === 'hen') {
    targetX = 90;
    targetY = 150;
    targetW = 380;
    targetH = 680;
  } else if (region === 'tsukuri') {
    targetX = 480;
    targetY = 150;
    targetW = 440;
    targetH = 680;
  } else if (region === 'kanmuri') {
    targetX = 120;
    targetY = 140;
    targetW = 760;
    targetH = 300;
  } else if (region === 'ashi') {
    targetX = 120;
    targetY = 560;
    targetW = 760;
    targetH = 320;
  }

  // Scale to target box proportionally to prevent warping
  const scaleX = targetW / bbox.width;
  const scaleY = targetH / bbox.height;
  const scale = Math.min(scaleX, scaleY);

  const scaledW = bbox.width * scale;
  const scaledH = bbox.height * scale;
  const offsetX = targetX + (targetW - scaledW) / 2 - bbox.minX * scale;
  const offsetY = targetY + (targetH - scaledH) / 2 - bbox.minY * scale;

  return transformContours(result.contours, (p) => ({
    x: Math.round(p.x * scale + offsetX),
    y: Math.round(p.y * scale + offsetY),
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
    radicalContoursCache.set(cacheKey, contours);
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

/**
 * 214 Kangxi Traditional Radicals Catalog (康熙部首)
 */
export const KANGXI_RADICALS_CATALOG: KangxiRadicalItem[] = [
  { number: 1, char: '一', name: 'いち', reading: 'イチ', strokes: 1, category: 'basic', exampleChars: '三丈不' },
  { number: 2, char: '丨', name: 'ぼう', reading: 'ボウ', strokes: 1, category: 'basic', exampleChars: '中申' },
  { number: 3, char: '丶', name: 'てん', reading: 'テン', strokes: 1, category: 'basic', exampleChars: '丸主' },
  { number: 4, char: '丿', name: 'の', reading: 'ヘツ', strokes: 1, category: 'basic', exampleChars: '久乏乗' },
  { number: 5, char: '乙', name: 'おつ', reading: 'オツ', strokes: 1, category: 'basic', exampleChars: '九乞乱' },
  { number: 6, char: '亅', name: 'はねぼう', reading: 'ケツ', strokes: 1, category: 'basic', exampleChars: '了予事' },
  { number: 7, char: '二', name: 'に', reading: 'ニ', strokes: 2, category: 'basic', exampleChars: '互五井' },
  { number: 8, char: '亠', name: 'なべぶた', reading: 'トウ', strokes: 2, category: 'kanmuri', exampleChars: '亡交京' },
  { number: 9, char: '人', name: 'ひと・にんべん', reading: 'ジン', strokes: 2, category: 'hen', exampleChars: '休作仕' },
  { number: 10, char: '儿', name: 'ひとあし', reading: 'ジン', strokes: 2, category: 'ashi', exampleChars: '兄先免' },
  { number: 11, char: '入', name: 'いる', reading: 'ニュウ', strokes: 2, category: 'basic', exampleChars: '全内' },
  { number: 12, char: '八', name: 'はち', reading: 'ハチ', strokes: 2, category: 'basic', exampleChars: '公共兵' },
  { number: 13, char: '冂', name: 'けいがまえ', reading: 'ケイ', strokes: 2, category: 'kamae', exampleChars: '円冊再' },
  { number: 14, char: '冖', name: 'わかんむり', reading: 'ベキ', strokes: 2, category: 'kanmuri', exampleChars: '冠冗写' },
  { number: 15, char: '冫', name: 'にすい', reading: 'ヒョウ', strokes: 2, category: 'hen', exampleChars: '冷凍冬' },
  { number: 16, char: '几', name: 'きにょう', reading: 'キ', strokes: 2, category: 'nyo', exampleChars: '凡処凱' },
  { number: 17, char: '凵', name: 'かんにょう', reading: 'カン', strokes: 2, category: 'kamae', exampleChars: '凶凹凸' },
  { number: 18, char: '刀', name: 'かたな・りっとう', reading: 'トウ', strokes: 2, category: 'tsukuri', exampleChars: '切刻列' },
  { number: 19, char: '力', name: 'ちから', reading: 'リョク', strokes: 2, category: 'tsukuri', exampleChars: '加功動' },
  { number: 20, char: '勹', name: 'つつみがまえ', reading: 'ホウ', strokes: 2, category: 'kamae', exampleChars: '包匂句' },
  { number: 21, char: '匕', name: 'さじのひ', reading: 'ヒ', strokes: 2, category: 'basic', exampleChars: '化北匙' },
  { number: 22, char: '匚', name: 'はこがまえ', reading: 'ホウ', strokes: 2, category: 'kamae', exampleChars: '医匠匹' },
  { number: 24, char: '十', name: 'じゅう', reading: 'ジュウ', strokes: 2, category: 'basic', exampleChars: '半卒協' },
  { number: 25, char: '卜', name: 'ぼく', reading: 'ボク', strokes: 2, category: 'basic', exampleChars: '占卦' },
  { number: 26, char: '卩', name: 'ふしづくり', reading: 'セツ', strokes: 2, category: 'tsukuri', exampleChars: '印却卵' },
  { number: 27, char: '厂', name: 'がんだれ', reading: 'カン', strokes: 2, category: 'tare', exampleChars: '厄厚原' },
  { number: 28, char: '厶', name: 'む', reading: 'シ', strokes: 2, category: 'basic', exampleChars: '去参台' },
  { number: 29, char: '又', name: 'また', reading: 'ユウ', strokes: 2, category: 'tsukuri', exampleChars: '友反双' },
  { number: 30, char: '口', name: 'くち', reading: 'コウ', strokes: 3, category: 'hen', exampleChars: '古右品' },
  { number: 31, char: '囗', name: 'くにがまえ', reading: 'イ', strokes: 3, category: 'kamae', exampleChars: '四団国' },
  { number: 32, char: '土', name: 'つち', reading: 'ド', strokes: 3, category: 'hen', exampleChars: '地坂場' },
  { number: 33, char: '士', name: 'さむらい', reading: 'シ', strokes: 3, category: 'basic', exampleChars: '壮声売' },
  { number: 36, char: '夕', name: 'ゆうべ', reading: 'セキ', strokes: 3, category: 'hen', exampleChars: '外名夜' },
  { number: 37, char: '大', name: 'だい', reading: 'ダイ', strokes: 3, category: 'kanmuri', exampleChars: '天太央' },
  { number: 38, char: '女', name: 'おんな', reading: 'ジョ', strokes: 3, category: 'hen', exampleChars: '好如妙' },
  { number: 39, char: '子', name: 'こ', reading: 'シ', strokes: 3, category: 'hen', exampleChars: '孔学孝' },
  { number: 40, char: '宀', name: 'うかんむり', reading: 'ベン', strokes: 3, category: 'kanmuri', exampleChars: '安宇守' },
  { number: 41, char: '寸', name: 'すん', reading: 'スン', strokes: 3, category: 'tsukuri', exampleChars: '寺対寿' },
  { number: 42, char: '小', name: 'しょう', reading: 'ショウ', strokes: 3, category: 'kanmuri', exampleChars: '少尖尚' },
  { number: 44, char: '尸', name: 'しかばね', reading: 'シ', strokes: 3, category: 'tare', exampleChars: '尺尾居' },
  { number: 46, char: '山', name: 'やま', reading: 'サン', strokes: 3, category: 'hen', exampleChars: '岩岸島' },
  { number: 47, char: '川', name: 'かわ', reading: 'セン', strokes: 3, category: 'basic', exampleChars: '州巡順' },
  { number: 48, char: '工', name: 'こう', reading: 'コウ', strokes: 3, category: 'basic', exampleChars: '左巧巨' },
  { number: 49, char: '己', name: 'おのれ', reading: 'コ', strokes: 3, category: 'basic', exampleChars: '巻改忌' },
  { number: 50, char: '巾', name: 'はば', reading: 'キン', strokes: 3, category: 'hen', exampleChars: '市布帳' },
  { number: 51, char: '干', name: 'かん', reading: 'カン', strokes: 3, category: 'basic', exampleChars: '平年幸' },
  { number: 53, char: '广', name: 'まだれ', reading: 'ゲン', strokes: 3, category: 'tare', exampleChars: '庁席度' },
  { number: 54, char: '廴', name: 'えんにょう', reading: 'イン', strokes: 3, category: 'nyo', exampleChars: '延廷建' },
  { number: 57, char: '弓', name: 'ゆみ', reading: 'キュウ', strokes: 3, category: 'hen', exampleChars: '引弱張' },
  { number: 60, char: '彳', name: 'ぎょうにんべん', reading: 'テキ', strokes: 3, category: 'hen', exampleChars: '役彼待' },
  { number: 61, char: '心', name: 'こころ・りっしんべん', reading: 'シン', strokes: 4, category: 'ashi', exampleChars: '思快情' },
  { number: 62, char: '戈', name: 'ほこづくり', reading: 'カ', strokes: 4, category: 'tsukuri', exampleChars: '成戦我' },
  { number: 63, char: '戸', name: 'と', reading: 'コ', strokes: 4, category: 'tare', exampleChars: '房所扇' },
  { number: 64, char: '手', name: 'て・てへん', reading: 'シュ', strokes: 4, category: 'hen', exampleChars: '打指持' },
  { number: 65, char: '支', name: 'しにょう', reading: 'シ', strokes: 4, category: 'tsukuri', exampleChars: '枝鼓' },
  { number: 66, char: '攴', name: 'ぼく・のぶん', reading: 'ホク', strokes: 4, category: 'tsukuri', exampleChars: '改教敬' },
  { number: 67, char: '文', name: 'ぶん', reading: 'ブン', strokes: 4, category: 'basic', exampleChars: '斉斑' },
  { number: 69, char: '斤', name: 'おの', reading: 'キン', strokes: 4, category: 'tsukuri', exampleChars: '斬新断' },
  { number: 70, char: '方', name: 'ほう', reading: 'ホウ', strokes: 4, category: 'hen', exampleChars: '旅旋族' },
  { number: 72, char: '日', name: 'ひ・ひへん', reading: 'ニチ', strokes: 4, category: 'hen', exampleChars: '明時晴' },
  { number: 73, char: '曰', name: 'ひらび', reading: 'エツ', strokes: 4, category: 'basic', exampleChars: '書最替' },
  { number: 74, char: '月', name: 'つき・にくづき', reading: 'ゲツ', strokes: 4, category: 'hen', exampleChars: '有服望' },
  { number: 75, char: '木', name: 'き・きへん', reading: 'ボク', strokes: 4, category: 'hen', exampleChars: '林本校' },
  { number: 76, char: '欠', name: 'あくび', reading: 'ケツ', strokes: 4, category: 'tsukuri', exampleChars: '次欧歌' },
  { number: 77, char: '止', name: 'とめる', reading: 'シ', strokes: 4, category: 'hen', exampleChars: '正歩歴' },
  { number: 78, char: '歹', name: 'がつへん', reading: 'タイ', strokes: 4, category: 'hen', exampleChars: '死残列' },
  { number: 85, char: '水', name: 'みず・さんずい', reading: 'スイ', strokes: 4, category: 'hen', exampleChars: '江海河' },
  { number: 86, char: '火', name: 'ひ・れっか', reading: 'カ', strokes: 4, category: 'ashi', exampleChars: '灯焼熱' },
  { number: 93, char: '牛', name: 'うし', reading: 'ギュウ', strokes: 4, category: 'hen', exampleChars: '物特牧' },
  { number: 94, char: '犬', name: 'いぬ・けものへん', reading: 'ケン', strokes: 4, category: 'hen', exampleChars: '犯状猫' },
  { number: 96, char: '玉', name: 'たま・たまへん', reading: 'ギョク', strokes: 5, category: 'hen', exampleChars: '王理現' },
  { number: 102, char: '田', name: 'た', reading: 'デン', strokes: 5, category: 'hen', exampleChars: '町画界' },
  { number: 104, char: '疒', name: 'やまいだれ', reading: 'ダク', strokes: 5, category: 'tare', exampleChars: '病症療' },
  { number: 109, char: '目', name: 'め・めへん', reading: 'モク', strokes: 5, category: 'hen', exampleChars: '相見省' },
  { number: 111, char: '矢', name: 'や', reading: 'シ', strokes: 5, category: 'hen', exampleChars: '知短矯' },
  { number: 112, char: '石', name: 'いし', reading: 'セキ', strokes: 5, category: 'hen', exampleChars: '砂破研' },
  { number: 113, char: '示', name: 'しめす・しめすへん', reading: 'シ', strokes: 5, category: 'hen', exampleChars: '祝神票' },
  { number: 115, char: '禾', name: 'のぎへん', reading: 'カ', strokes: 5, category: 'hen', exampleChars: '私利科' },
  { number: 116, char: '穴', name: 'あなかんむり', reading: 'ケツ', strokes: 5, category: 'kanmuri', exampleChars: '空窓究' },
  { number: 118, char: '竹', name: 'たけ・たけかんむり', reading: 'チク', strokes: 6, category: 'kanmuri', exampleChars: '笑筆箱' },
  { number: 119, char: '米', name: 'こめ', reading: 'ベイ', strokes: 6, category: 'hen', exampleChars: '粉精糖' },
  { number: 120, char: '糸', name: 'いと・いとへん', reading: 'シ', strokes: 6, category: 'hen', exampleChars: '約級純' },
  { number: 128, char: '耳', name: 'みみ', reading: 'ジ', strokes: 6, category: 'hen', exampleChars: '聞職聖' },
  { number: 130, char: '肉', name: 'にく', reading: 'ニク', strokes: 6, category: 'hen', exampleChars: '肌肺脂' },
  { number: 140, char: '艸', name: 'くさかんむり', reading: 'ソウ', strokes: 6, category: 'kanmuri', exampleChars: '花茶薬' },
  { number: 142, char: '虫', name: 'むし', reading: 'チュウ', strokes: 6, category: 'hen', exampleChars: '蚊蛍蝉' },
  { number: 144, char: '行', name: 'ぎょう・ゆきがまえ', reading: 'コウ', strokes: 6, category: 'kamae', exampleChars: '街術衛' },
  { number: 145, char: '衣', name: 'ころも・ころもへん', reading: 'イ', strokes: 6, category: 'hen', exampleChars: '表被初' },
  { number: 147, char: '見', name: 'みる', reading: 'ケン', strokes: 7, category: 'tsukuri', exampleChars: '規視覚' },
  { number: 149, char: '言', name: 'ことば・ごんべん', reading: 'ゲン', strokes: 7, category: 'hen', exampleChars: '話語読' },
  { number: 154, char: '貝', name: 'かい・かいへん', reading: 'バイ', strokes: 7, category: 'hen', exampleChars: '財貯資' },
  { number: 157, char: '足', name: 'あし・あしへん', reading: 'ソク', strokes: 7, category: 'hen', exampleChars: '路跳躍' },
  { number: 159, char: '車', name: 'くるま', reading: 'シャ', strokes: 7, category: 'hen', exampleChars: '軍輪載' },
  { number: 162, char: '辵', name: 'しんにょう', reading: 'チャク', strokes: 7, category: 'nyo', exampleChars: '近通過' },
  { number: 163, char: '邑', name: 'おおざと', reading: 'ユウ', strokes: 7, category: 'tsukuri', exampleChars: '部都郭' },
  { number: 167, char: '金', name: 'かね・かねへん', reading: 'キン', strokes: 8, category: 'hen', exampleChars: '銀鋼鏡' },
  { number: 168, char: '長', name: 'ながい', reading: 'チョウ', strokes: 8, category: 'basic', exampleChars: '套肆' },
  { number: 169, char: '門', name: 'もん・もんがまえ', reading: 'モン', strokes: 8, category: 'kamae', exampleChars: '開間閣' },
  { number: 170, char: '阜', name: 'こざとへん', reading: 'フ', strokes: 8, category: 'hen', exampleChars: '防院陰' },
  { number: 172, char: '隹', name: 'ふるとり', reading: 'スイ', strokes: 8, category: 'tsukuri', exampleChars: '雄雅難' },
  { number: 173, char: '雨', name: 'あめ・あめかんむり', reading: 'ウ', strokes: 8, category: 'kanmuri', exampleChars: '電雪露' },
  { number: 181, char: '頁', name: 'おおがい', reading: 'ケツ', strokes: 9, category: 'tsukuri', exampleChars: '頂頭顧' },
  { number: 184, char: '食', name: 'しょく・しょくへん', reading: 'ショク', strokes: 9, category: 'hen', exampleChars: '飯館館' },
  { number: 187, char: '馬', name: 'うま', reading: 'バ', strokes: 10, category: 'hen', exampleChars: '駅駆騒' },
  { number: 195, char: '魚', name: 'うお・さかなへん', reading: 'ギョ', strokes: 11, category: 'hen', exampleChars: '鮮鯨鯛' },
  { number: 196, char: '鳥', name: 'とり', reading: 'チョウ', strokes: 11, category: 'tsukuri', exampleChars: '鳴鳩鴨' },
];
