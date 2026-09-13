import { PathContour, GlyphData } from '../types';

/**
 * 日本語の清音・濁音・半濁音の対応マップ
 */
export interface DakutenPairInfo {
  seionChar: string;
  seionCode: number;
  dakuChar?: string;
  dakuCode?: number;
  handakuChar?: string;
  handakuCode?: number;
}

export const DAKUTEN_MAPPINGS: Record<string, { daku?: string; handaku?: string; seion?: string; type: 'seion' | 'daku' | 'handaku' }> = {
  // ひらがな
  'か': { daku: 'が', type: 'seion' },
  'き': { daku: 'ぎ', type: 'seion' },
  'く': { daku: 'ぐ', type: 'seion' },
  'け': { daku: 'げ', type: 'seion' },
  'こ': { daku: 'ご', type: 'seion' },
  'さ': { daku: 'ざ', type: 'seion' },
  'し': { daku: 'じ', type: 'seion' },
  'す': { daku: 'ず', type: 'seion' },
  'せ': { daku: 'ぜ', type: 'seion' },
  'そ': { daku: 'ぞ', type: 'seion' },
  'た': { daku: 'だ', type: 'seion' },
  'ち': { daku: 'ぢ', type: 'seion' },
  'つ': { daku: 'づ', type: 'seion' },
  'て': { daku: 'で', type: 'seion' },
  'と': { daku: 'ど', type: 'seion' },
  'は': { daku: 'ば', handaku: 'ぱ', type: 'seion' },
  'ひ': { daku: 'び', handaku: 'ぴ', type: 'seion' },
  'ふ': { daku: 'ぶ', handaku: 'ぷ', type: 'seion' },
  'へ': { daku: 'べ', handaku: 'ぺ', type: 'seion' },
  'ほ': { daku: 'ぼ', handaku: 'ぽ', type: 'seion' },
  'う': { daku: 'ゔ', type: 'seion' },

  // ひらがな濁音
  'が': { seion: 'か', type: 'daku' },
  'ぎ': { seion: 'き', type: 'daku' },
  'ぐ': { seion: 'く', type: 'daku' },
  'げ': { seion: 'け', type: 'daku' },
  'ご': { seion: 'こ', type: 'daku' },
  'ざ': { seion: 'さ', type: 'daku' },
  'じ': { seion: 'し', type: 'daku' },
  'ず': { seion: 'す', type: 'daku' },
  'ぜ': { seion: 'せ', type: 'daku' },
  'ぞ': { seion: 'そ', type: 'daku' },
  'だ': { seion: 'た', type: 'daku' },
  'ぢ': { seion: 'ち', type: 'daku' },
  'づ': { seion: 'つ', type: 'daku' },
  'で': { seion: 'て', type: 'daku' },
  'ど': { seion: 'と', type: 'daku' },
  'ば': { seion: 'は', type: 'daku' },
  'び': { seion: 'ひ', type: 'daku' },
  'ぶ': { seion: 'ふ', type: 'daku' },
  'べ': { seion: 'へ', type: 'daku' },
  'ぼ': { seion: 'ほ', type: 'daku' },
  'ゔ': { seion: 'う', type: 'daku' },

  // ひらがな半濁音
  'ぱ': { seion: 'は', type: 'handaku' },
  'ぴ': { seion: 'ひ', type: 'handaku' },
  'ぷ': { seion: 'ふ', type: 'handaku' },
  'ぺ': { seion: 'へ', type: 'handaku' },
  'ぽ': { seion: 'ほ', type: 'handaku' },

  // カタカナ
  'カ': { daku: 'ガ', type: 'seion' },
  'キ': { daku: 'ギ', type: 'seion' },
  'ク': { daku: 'グ', type: 'seion' },
  'ケ': { daku: 'ゲ', type: 'seion' },
  'コ': { daku: 'ゴ', type: 'seion' },
  'サ': { daku: 'ザ', type: 'seion' },
  'シ': { daku: 'ジ', type: 'seion' },
  'ス': { daku: 'ズ', type: 'seion' },
  'セ': { daku: 'ゼ', type: 'seion' },
  'ソ': { daku: 'ゾ', type: 'seion' },
  'タ': { daku: 'ダ', type: 'seion' },
  'チ': { daku: 'ヂ', type: 'seion' },
  'ツ': { daku: 'ヅ', type: 'seion' },
  'テ': { daku: 'デ', type: 'seion' },
  'ト': { daku: 'ド', type: 'seion' },
  'ハ': { daku: 'バ', handaku: 'パ', type: 'seion' },
  'ヒ': { daku: 'ビ', handaku: 'ピ', type: 'seion' },
  'フ': { daku: 'ブ', handaku: 'プ', type: 'seion' },
  'ヘ': { daku: 'ベ', handaku: 'ペ', type: 'seion' },
  'ホ': { daku: 'ボ', handaku: 'ポ', type: 'seion' },
  'ウ': { daku: 'ヴ', type: 'seion' },
  'ワ': { daku: 'ヷ', type: 'seion' },
  'ヰ': { daku: 'ヸ', type: 'seion' },
  'ヱ': { daku: 'ヹ', type: 'seion' },
  'ヲ': { daku: 'ヺ', type: 'seion' },

  // カタカナ濁音
  'ガ': { seion: 'カ', type: 'daku' },
  'ギ': { seion: 'キ', type: 'daku' },
  'グ': { seion: 'ク', type: 'daku' },
  'ゲ': { seion: 'ケ', type: 'daku' },
  'ゴ': { seion: 'コ', type: 'daku' },
  'ザ': { seion: 'サ', type: 'daku' },
  'ジ': { seion: 'シ', type: 'daku' },
  'ズ': { seion: 'ス', type: 'daku' },
  'ゼ': { seion: 'セ', type: 'daku' },
  'ゾ': { seion: 'ソ', type: 'daku' },
  'ダ': { seion: 'タ', type: 'daku' },
  'ヂ': { seion: 'チ', type: 'daku' },
  'ヅ': { seion: 'ツ', type: 'daku' },
  'デ': { seion: 'テ', type: 'daku' },
  'ド': { seion: 'ト', type: 'daku' },
  'バ': { seion: 'ハ', type: 'daku' },
  'ビ': { seion: 'ヒ', type: 'daku' },
  'ブ': { seion: 'フ', type: 'daku' },
  'ベ': { seion: 'ヘ', type: 'daku' },
  'ボ': { seion: 'ホ', type: 'daku' },
  'ヴ': { seion: 'ウ', type: 'daku' },
  'ヷ': { seion: 'ワ', type: 'daku' },
  'ヸ': { seion: 'ヰ', type: 'daku' },
  'ヹ': { seion: 'ヱ', type: 'daku' },
  'ヺ': { seion: 'ヲ', type: 'daku' },

  // カタカナ半濁音
  'パ': { seion: 'ハ', type: 'handaku' },
  'ピ': { seion: 'ヒ', type: 'handaku' },
  'プ': { seion: 'フ', type: 'handaku' },
  'ペ': { seion: 'ヘ', type: 'handaku' },
  'ポ': { seion: 'ホ', type: 'handaku' },
};

export type DakutenStyle = 'standard' | 'brush' | 'round' | 'square';
export type HandakutenStyle = 'standard' | 'brush' | 'solid';

/**
 * 美しい標準濁点「゛」の2本ストローク輪郭を生成 (スタイル対応)
 */
export function createDakutenContours(
  customOffsetX = 0,
  customOffsetY = 0,
  style: DakutenStyle = 'standard',
  scale = 1
): PathContour[] {
  const time = Date.now();
  const baseScale = scale;

  if (style === 'round') {
    // 丸みのある小丸（丸文字・ポップ手書き向け）
    const makeCircle = (cx: number, cy: number, r: number, id: string): PathContour => ({
      id: `${id}-${time}`,
      closed: true,
      nodes: [
        { id: `${id}-0-${time}`, x: cx, y: cy - r, handleIn: { x: cx - r * 0.552, y: cy - r }, handleOut: { x: cx + r * 0.552, y: cy - r }, type: 'smooth' },
        { id: `${id}-1-${time}`, x: cx + r, y: cy, handleIn: { x: cx + r, y: cy - r * 0.552 }, handleOut: { x: cx + r, y: cy + r * 0.552 }, type: 'smooth' },
        { id: `${id}-2-${time}`, x: cx, y: cy + r, handleIn: { x: cx + r * 0.552, y: cy + r }, handleOut: { x: cx - r * 0.552, y: cy + r }, type: 'smooth' },
        { id: `${id}-3-${time}`, x: cx - r, y: cy, handleIn: { x: cx - r, y: cy + r * 0.552 }, handleOut: { x: cx - r, y: cy - r * 0.552 }, type: 'smooth' },
      ],
    });
    return [
      makeCircle(780 + customOffsetX, 195 + customOffsetY, 35 * baseScale, 'daku-c1'),
      makeCircle(855 + customOffsetX, 235 + customOffsetY, 35 * baseScale, 'daku-c2'),
    ];
  }

  if (style === 'brush') {
    // 書道・筆風（入りが細く、腹が出て、鋭く払う形状）
    const stroke1: PathContour = {
      id: `daku-brush-1-${time}`,
      closed: true,
      nodes: [
        { id: `db1-0-${time}`, x: 755 + customOffsetX, y: 155 + customOffsetY, type: 'corner' },
        { id: `db1-1-${time}`, x: 825 + customOffsetX, y: 180 + customOffsetY, handleIn: { x: 810 + customOffsetX, y: 165 + customOffsetY }, handleOut: { x: 835 + customOffsetX, y: 195 + customOffsetY }, type: 'smooth' },
        { id: `db1-2-${time}`, x: 800 + customOffsetX, y: 255 + customOffsetY, type: 'corner' },
        { id: `db1-3-${time}`, x: 735 + customOffsetX, y: 215 + customOffsetY, handleIn: { x: 760 + customOffsetX, y: 245 + customOffsetY }, handleOut: { x: 730 + customOffsetX, y: 180 + customOffsetY }, type: 'smooth' },
      ],
    };
    const stroke2: PathContour = {
      id: `daku-brush-2-${time}`,
      closed: true,
      nodes: [
        { id: `db2-0-${time}`, x: 830 + customOffsetX, y: 190 + customOffsetY, type: 'corner' },
        { id: `db2-1-${time}`, x: 900 + customOffsetX, y: 220 + customOffsetY, handleIn: { x: 885 + customOffsetX, y: 205 + customOffsetY }, handleOut: { x: 910 + customOffsetX, y: 235 + customOffsetY }, type: 'smooth' },
        { id: `db2-2-${time}`, x: 875 + customOffsetX, y: 295 + customOffsetY, type: 'corner' },
        { id: `db2-3-${time}`, x: 810 + customOffsetX, y: 255 + customOffsetY, handleIn: { x: 835 + customOffsetX, y: 285 + customOffsetY }, handleOut: { x: 805 + customOffsetX, y: 220 + customOffsetY }, type: 'smooth' },
      ],
    };
    return [stroke1, stroke2];
  }

  // standard or square
  const isSquare = style === 'square';
  const slant = isSquare ? 15 : 25;
  const stroke1: PathContour = {
    id: `daku-1-${time}`,
    closed: true,
    nodes: [
      { id: `d1-0-${time}`, x: 770 + customOffsetX, y: 155 + customOffsetY, type: 'corner' },
      { id: `d1-1-${time}`, x: 825 + customOffsetX, y: 180 + customOffsetY, type: 'corner' },
      { id: `d1-2-${time}`, x: (825 - slant) + customOffsetX, y: 245 + customOffsetY, type: 'corner' },
      { id: `d1-3-${time}`, x: (770 - slant) + customOffsetX, y: 220 + customOffsetY, type: 'corner' },
    ],
  };

  const stroke2: PathContour = {
    id: `daku-2-${time}`,
    closed: true,
    nodes: [
      { id: `d2-0-${time}`, x: 845 + customOffsetX, y: 195 + customOffsetY, type: 'corner' },
      { id: `d2-1-${time}`, x: 900 + customOffsetX, y: 220 + customOffsetY, type: 'corner' },
      { id: `d2-2-${time}`, x: (900 - slant) + customOffsetX, y: 285 + customOffsetY, type: 'corner' },
      { id: `d2-3-${time}`, x: (845 - slant) + customOffsetX, y: 260 + customOffsetY, type: 'corner' },
    ],
  };

  return [stroke1, stroke2];
}

/**
 * 美しい標準半濁点「゜」の輪郭を生成 (スタイル対応)
 */
export function createHandakutenContours(
  customOffsetX = 0,
  customOffsetY = 0,
  style: HandakutenStyle = 'standard',
  scale = 1
): PathContour[] {
  const time = Date.now();
  const cx = 835 + customOffsetX;
  const cy = 215 + customOffsetY;
  const outerR = Math.round(60 * scale);
  const innerR = style === 'solid' ? 0 : Math.round(30 * scale);

  // 外側円 (時計回り)
  const outerCircle: PathContour = {
    id: `handaku-outer-${time}`,
    closed: true,
    nodes: [
      {
        id: `ho-0-${time}`,
        x: cx,
        y: cy - outerR,
        handleIn: { x: cx - outerR * 0.552, y: cy - outerR },
        handleOut: { x: cx + outerR * 0.552, y: cy - outerR },
        type: 'smooth',
      },
      {
        id: `ho-1-${time}`,
        x: cx + outerR,
        y: cy,
        handleIn: { x: cx + outerR, y: cy - outerR * 0.552 },
        handleOut: { x: cx + outerR, y: cy + outerR * 0.552 },
        type: 'smooth',
      },
      {
        id: `ho-2-${time}`,
        x: cx,
        y: cy + outerR,
        handleIn: { x: cx + outerR * 0.552, y: cy + outerR },
        handleOut: { x: cx - outerR * 0.552, y: cy + outerR },
        type: 'smooth',
      },
      {
        id: `ho-3-${time}`,
        x: cx - outerR,
        y: cy,
        handleIn: { x: cx - outerR, y: cy + outerR * 0.552 },
        handleOut: { x: cx - outerR, y: cy - outerR * 0.552 },
        type: 'smooth',
      },
    ],
  };

  if (style === 'solid') {
    return [outerCircle];
  }

  // 内側円 (中抜き用・反時計回り)
  const innerCircle: PathContour = {
    id: `handaku-inner-${time}`,
    closed: true,
    nodes: [
      {
        id: `hi-0-${time}`,
        x: cx,
        y: cy - innerR,
        handleIn: { x: cx + innerR * 0.552, y: cy - innerR },
        handleOut: { x: cx - innerR * 0.552, y: cy - innerR },
        type: 'smooth',
      },
      {
        id: `hi-1-${time}`,
        x: cx - innerR,
        y: cy,
        handleIn: { x: cx - innerR, y: cy - innerR * 0.552 },
        handleOut: { x: cx + innerR, y: cy + innerR * 0.552 },
        type: 'smooth',
      },
      {
        id: `hi-2-${time}`,
        x: cx,
        y: cy + innerR,
        handleIn: { x: cx - innerR * 0.552, y: cy + innerR },
        handleOut: { x: cx + innerR, y: cy + innerR * 0.552 },
        type: 'smooth',
      },
      {
        id: `hi-3-${time}`,
        x: cx + innerR,
        y: cy,
        handleIn: { x: cx + innerR, y: cy + innerR * 0.552 },
        handleOut: { x: cx - innerR, y: cy - innerR * 0.552 },
        type: 'smooth',
      },
    ],
  };

  return [outerCircle, innerCircle];
}

/**
 * 輪郭ディープコピー（新しいユニークIDを採番）
 */
export function cloneContours(contours: PathContour[]): PathContour[] {
  const time = Date.now();
  return contours.map((c, cIdx) => ({
    id: `cloned-${time}-${cIdx}`,
    closed: c.closed,
    nodes: c.nodes.map((n, nIdx) => ({
      id: `n-${time}-${cIdx}-${nIdx}`,
      x: n.x,
      y: n.y,
      type: n.type,
      handleIn: n.handleIn ? { ...n.handleIn } : null,
      handleOut: n.handleOut ? { ...n.handleOut } : null,
    })),
  }));
}

/**
 * 親文字の輪郭と濁点・半濁点を合成
 */
export function synthesizeDakutenContours(
  baseContours: PathContour[],
  isHandakuten: boolean,
  options?: {
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    dakuStyle?: DakutenStyle;
    handakuStyle?: HandakutenStyle;
  }
): PathContour[] {
  const cloned = cloneContours(baseContours);
  const ox = options?.offsetX ?? 0;
  const oy = options?.offsetY ?? 0;
  const scale = options?.scale ?? 1;

  const accent = isHandakuten
    ? createHandakutenContours(ox, oy, options?.handakuStyle ?? 'standard', scale)
    : createDakutenContours(ox, oy, options?.dakuStyle ?? 'standard', scale);

  return [...cloned, ...accent];
}

/**
 * 作成済みのすべての清音から濁音・半濁音を一括自動合成
 */
export function batchSynthesizeDakuten(
  glyphs: Record<number, GlyphData>,
  options?: {
    overwriteExisting?: boolean;
    scope?: 'all' | 'hiragana' | 'katakana';
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    dakuStyle?: DakutenStyle;
    handakuStyle?: HandakutenStyle;
  }
): {
  updatedGlyphs: Record<number, GlyphData>;
  generatedCount: number;
  details: { sourceChar: string; targetChar: string; isHandakuten: boolean }[];
} {
  const updatedGlyphs = { ...glyphs };
  let generatedCount = 0;
  const details: { sourceChar: string; targetChar: string; isHandakuten: boolean }[] = [];

  const overwrite = options?.overwriteExisting ?? false;
  const scope = options?.scope ?? 'all';

  for (const [char, mapping] of Object.entries(DAKUTEN_MAPPINGS)) {
    if (mapping.type !== 'seion') continue;

    const sourceCode = char.codePointAt(0);
    if (!sourceCode) continue;

    const isHiragana = sourceCode >= 0x3041 && sourceCode <= 0x3096;
    const isKatakana = sourceCode >= 0x30a1 && sourceCode <= 0x30fa;

    if (scope === 'hiragana' && !isHiragana) continue;
    if (scope === 'katakana' && !isKatakana) continue;

    const sourceGlyph = glyphs[sourceCode];
    if (!sourceGlyph || !sourceGlyph.contours || sourceGlyph.contours.length === 0) {
      // 親文字が未作成ならスキップ
      continue;
    }

    // 濁音
    if (mapping.daku) {
      const targetChar = mapping.daku;
      const targetCode = targetChar.codePointAt(0);
      if (targetCode) {
        const existing = glyphs[targetCode];
        const hasExistingContours = existing && existing.contours && existing.contours.length > 0;
        if (!hasExistingContours || overwrite) {
          const combined = synthesizeDakutenContours(sourceGlyph.contours, false, options);
          updatedGlyphs[targetCode] = {
            unicode: targetCode,
            char: targetChar,
            name: `uni${targetCode.toString(16).toUpperCase().padStart(4, '0')}`,
            advanceWidth: sourceGlyph.advanceWidth || 1000,
            lsb: sourceGlyph.lsb ?? 50,
            contours: combined,
            modified: true,
          };
          generatedCount++;
          details.push({ sourceChar: char, targetChar, isHandakuten: false });
        }
      }
    }

    // 半濁音
    if (mapping.handaku) {
      const targetChar = mapping.handaku;
      const targetCode = targetChar.codePointAt(0);
      if (targetCode) {
        const existing = glyphs[targetCode];
        const hasExistingContours = existing && existing.contours && existing.contours.length > 0;
        if (!hasExistingContours || overwrite) {
          const combined = synthesizeDakutenContours(sourceGlyph.contours, true, options);
          updatedGlyphs[targetCode] = {
            unicode: targetCode,
            char: targetChar,
            name: `uni${targetCode.toString(16).toUpperCase().padStart(4, '0')}`,
            advanceWidth: sourceGlyph.advanceWidth || 1000,
            lsb: sourceGlyph.lsb ?? 50,
            contours: combined,
            modified: true,
          };
          generatedCount++;
          details.push({ sourceChar: char, targetChar, isHandakuten: true });
        }
      }
    }
  }

  return { updatedGlyphs, generatedCount, details };
}
