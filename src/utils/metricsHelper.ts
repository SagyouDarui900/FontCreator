import { GlyphData, PathContour } from '../types';
import { getContoursBoundingBox, transformContours } from './pathUtils';

/**
 * よく使われるカーニングペアプリセット
 */
export interface KerningPresetGroup {
  id: string;
  name: string;
  description: string;
  pairs: { left: string; right: string; defaultVal: number }[];
}

export const KERNING_PRESET_GROUPS: KerningPresetGroup[] = [
  {
    id: 'japanese_punct',
    name: '和文約物（句読点・括弧・長音符）',
    description: 'カギ括弧や句読点、音引きなどの空きすぎを自然に詰めます',
    pairs: [
      { left: '「', right: '「', defaultVal: -180 },
      { left: '」', right: '」', defaultVal: -180 },
      { left: '」', right: '、', defaultVal: -200 },
      { left: '」', right: '。', defaultVal: -200 },
      { left: '、', right: '」', defaultVal: -200 },
      { left: '。', right: '」', defaultVal: -200 },
      { left: '（', right: '（', defaultVal: -160 },
      { left: '）', right: '）', defaultVal: -160 },
      { left: 'ー', right: 'ー', defaultVal: -60 },
      { left: '・', right: '・', defaultVal: -100 },
      { left: '「', right: 'あ', defaultVal: -120 },
      { left: '「', right: 'い', defaultVal: -120 },
      { left: 'あ', right: '」', defaultVal: -120 },
      { left: 'い', right: '」', defaultVal: -120 },
    ],
  },
  {
    id: 'latin_standard',
    name: '英数字定番ペア (AV, To, WA, etc.)',
    description: '斜め線やT字などの字間衝突・すきまを美しく最適化します',
    pairs: [
      { left: 'A', right: 'V', defaultVal: -110 },
      { left: 'V', right: 'A', defaultVal: -110 },
      { left: 'A', right: 'W', defaultVal: -90 },
      { left: 'W', right: 'A', defaultVal: -90 },
      { left: 'A', right: 'T', defaultVal: -90 },
      { left: 'T', right: 'A', defaultVal: -90 },
      { left: 'A', right: 'Y', defaultVal: -100 },
      { left: 'Y', right: 'A', defaultVal: -100 },
      { left: 'T', right: 'o', defaultVal: -90 },
      { left: 'T', right: 'a', defaultVal: -80 },
      { left: 'T', right: 'e', defaultVal: -80 },
      { left: 'P', right: 'A', defaultVal: -90 },
      { left: 'L', right: 'T', defaultVal: -90 },
      { left: 'W', right: 'a', defaultVal: -60 },
      { left: 'V', right: 'o', defaultVal: -70 },
      { left: '1', right: '1', defaultVal: -50 },
    ],
  },
  {
    id: 'kana_common',
    name: 'かな特選ペア',
    description: '字面の横幅が狭いかな同士の字間バランスを整えます',
    pairs: [
      { left: 'と', right: 'い', defaultVal: -70 },
      { left: 'て', right: 'い', defaultVal: -60 },
      { left: 'こ', right: 'こ', defaultVal: -50 },
      { left: 'く', right: 'る', defaultVal: -50 },
      { left: 'り', right: 'ん', defaultVal: -50 },
      { left: 'ト', right: 'イ', defaultVal: -70 },
      { left: 'テ', right: 'イ', defaultVal: -60 },
      { left: 'コ', right: 'コ', defaultVal: -50 },
      { left: 'ル', right: 'ー', defaultVal: -60 },
      { left: 'ー', right: 'ド', defaultVal: -50 },
    ],
  },
];

/**
 * オートスペーシング（サイドベアリング自動設定）のプリセット種別
 */
export type AutoSpacingPreset =
  | 'smart' // スマート自動（和文は全角中央揃え、欧文はプロポーショナル光学マージン）
  | 'japanese-fullwidth' // 和文全角 (送り幅1000EM, 左右余白均等センタリング)
  | 'proportional-balanced' // 欧文標準プロポーショナル (光学余白)
  | 'proportional-tight' // 欧文タイト (詰まり気味)
  | 'proportional-loose'; // 欧文ルーズ (ゆったり)

/**
 * 単一文字に対する最適なサイドベアリングと送り幅の自動計算
 */
export function calculateOptimalSpacing(
  unicode: number,
  contours: PathContour[],
  preset: AutoSpacingPreset = 'smart'
): {
  advanceWidth: number;
  lsb: number;
  contours: PathContour[];
} {
  if (!contours || contours.length === 0) {
    return {
      advanceWidth: unicode >= 0x0020 && unicode <= 0x007f ? 500 : 1000,
      lsb: 50,
      contours: [],
    };
  }

  const bbox = getContoursBoundingBox(contours);
  const isCjk = (unicode >= 0x3000 && unicode <= 0x9fff) || (unicode >= 0xff00 && unicode <= 0xffef);
  const isAscii = unicode >= 0x0020 && unicode <= 0x007f;

  if (preset === 'japanese-fullwidth' || (preset === 'smart' && isCjk)) {
    // 和文全角 (1000EM 均等センタリング)
    const targetAdvance = 1000;
    const targetCenter = targetAdvance / 2;
    const dx = Math.round(targetCenter - bbox.centerX);
    const newContours = dx !== 0 ? transformContours(contours, (p) => ({ x: p.x + dx, y: p.y })) : contours;
    const newBbox = getContoursBoundingBox(newContours);
    return {
      advanceWidth: targetAdvance,
      lsb: Math.round(newBbox.minX),
      contours: newContours,
    };
  }

  // 欧文・プロポーショナル光学スペーシング
  let targetLsb = 60;
  let targetRsb = 60;

  const char = String.fromCodePoint(unicode);
  // 丸みのある文字や斜め線の文字に対して光学補正
  const isRoundLeft = /^[CcGgOoQq06889\(\{\[]/.test(char);
  const isRoundRight = /^[CcDGgOoQq03689\)\}\]]/.test(char);
  const isSlanted = /^[AvVwWxXyY\/\\]/.test(char);
  const isStraightLeft = /^[BDEFHIJKLMNPRTU1]/.test(char);
  const isStraightRight = /^[HIJMNU]/.test(char);

  if (preset === 'proportional-tight') {
    targetLsb = isRoundLeft ? 30 : isSlanted ? 20 : isStraightLeft ? 45 : 35;
    targetRsb = isRoundRight ? 30 : isSlanted ? 20 : isStraightRight ? 45 : 35;
  } else if (preset === 'proportional-loose') {
    targetLsb = isRoundLeft ? 85 : isSlanted ? 70 : isStraightLeft ? 110 : 90;
    targetRsb = isRoundRight ? 85 : isSlanted ? 70 : isStraightRight ? 110 : 90;
  } else {
    // Balanced (標準)
    targetLsb = isRoundLeft ? 50 : isSlanted ? 40 : isStraightLeft ? 75 : 60;
    targetRsb = isRoundRight ? 50 : isSlanted ? 40 : isStraightRight ? 75 : 60;
  }

  const dx = Math.round(targetLsb - bbox.minX);
  const newContours = dx !== 0 ? transformContours(contours, (p) => ({ x: p.x + dx, y: p.y })) : contours;
  const newAdvance = Math.max(150, Math.round(targetLsb + bbox.width + targetRsb));

  return {
    advanceWidth: newAdvance,
    lsb: targetLsb,
    contours: newContours,
  };
}

/**
 * サイドベアリング一括調整のオプション
 */
export interface SidebearingBatchOptions {
  scope: 'all' | 'hiragana' | 'katakana' | 'kanji' | 'latin' | 'symbols';
  mode: 'smart-auto' | 'center' | 'proportional' | 'offset-lsb' | 'offset-rsb' | 'uniform-advance';
  lsb?: number; // target LSB or offset
  rsb?: number; // target RSB or offset
  targetAdvance?: number; // uniform advance width (e.g. 1000 for fullwidth, 500 for halfwidth)
  offsetDelta?: number; // +/- delta for offsets
}

/**
 * 文字カテゴリの判定
 */
export function isCharInScope(
  code: number,
  scope: SidebearingBatchOptions['scope']
): boolean {
  if (scope === 'all') return true;

  const isHiragana = code >= 0x3040 && code <= 0x309f;
  const isKatakana = code >= 0x30a0 && code <= 0x30ff;
  const isKanji = (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
  const isLatin = (code >= 0x0020 && code <= 0x007f) || (code >= 0x00a0 && code <= 0x024f);
  const isSymbols =
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0xff00 && code <= 0xffef) ||
    (code >= 0x2000 && code <= 0x206f);

  switch (scope) {
    case 'hiragana':
      return isHiragana;
    case 'katakana':
      return isKatakana;
    case 'kanji':
      return isKanji;
    case 'latin':
      return isLatin;
    case 'symbols':
      return isSymbols;
    default:
      return true;
  }
}

/**
 * サイドベアリング（左右余白・送り幅）の一括調整
 */
export function batchAdjustSidebearings(
  glyphs: Record<number, GlyphData>,
  options: SidebearingBatchOptions
): {
  updatedGlyphs: Record<number, GlyphData>;
  modifiedCount: number;
} {
  const updatedGlyphs: Record<number, GlyphData> = { ...glyphs };
  let modifiedCount = 0;

  for (const [codeStr, glyph] of Object.entries(glyphs)) {
    const code = Number(codeStr);
    if (!isCharInScope(code, options.scope)) continue;

    const contours = glyph.contours || [];
    if (contours.length === 0) continue;

    const bbox = getContoursBoundingBox(contours);
    if (bbox.width <= 0) continue;

    let newAdvance = glyph.advanceWidth || 1000;
    let newLsb = glyph.lsb ?? 50;
    let newContours = contours;

    if (options.mode === 'smart-auto') {
      // スマート自動計算 (和文は全角中央揃え、欧文はプロポーショナル光学マージン)
      const res = calculateOptimalSpacing(code, contours, 'smart');
      newAdvance = res.advanceWidth;
      newLsb = res.lsb;
      newContours = res.contours;
    } else if (options.mode === 'center') {
      // 左右余白均等センタリング（文字実幅を advanceWidth の中心に配置）
      const targetCenter = newAdvance / 2;
      const currentCenter = bbox.centerX;
      const dx = Math.round(targetCenter - currentCenter);
      if (dx !== 0) {
        newContours = transformContours(contours, (p) => ({ x: p.x + dx, y: p.y }));
        const newBbox = getContoursBoundingBox(newContours);
        newLsb = Math.round(newBbox.minX);
      }
    } else if (options.mode === 'proportional') {
      // プロポーショナル化：指定された左右余白（例: LSB=60, RSB=60）に合わせて文字を配置し、送り幅を再計算
      const targetLsb = options.lsb ?? 60;
      const targetRsb = options.rsb ?? 60;
      const dx = Math.round(targetLsb - bbox.minX);
      if (dx !== 0) {
        newContours = transformContours(contours, (p) => ({ x: p.x + dx, y: p.y }));
      }
      newLsb = targetLsb;
      newAdvance = Math.round(targetLsb + bbox.width + targetRsb);
    } else if (options.mode === 'uniform-advance') {
      // 送り幅の統一（全角1000、半角500など）
      newAdvance = options.targetAdvance ?? 1000;
      // 左右余白を均等に再配分
      const targetCenter = newAdvance / 2;
      const dx = Math.round(targetCenter - bbox.centerX);
      newContours = transformContours(contours, (p) => ({ x: p.x + dx, y: p.y }));
      const newBbox = getContoursBoundingBox(newContours);
      newLsb = Math.round(newBbox.minX);
    } else if (options.mode === 'offset-lsb') {
      // 左余白オフセット加減算
      const delta = options.offsetDelta ?? 0;
      if (delta !== 0) {
        newContours = transformContours(contours, (p) => ({ x: p.x + delta, y: p.y }));
        newLsb = (glyph.lsb ?? 50) + delta;
      }
    } else if (options.mode === 'offset-rsb') {
      // 右余白オフセット加減算（送り幅を広げる/狭める）
      const delta = options.offsetDelta ?? 0;
      newAdvance = Math.max(100, newAdvance + delta);
    }

    updatedGlyphs[code] = {
      ...glyph,
      advanceWidth: newAdvance,
      lsb: newLsb,
      contours: newContours,
      modified: true,
    };
    modifiedCount++;
  }

  return { updatedGlyphs, modifiedCount };
}
