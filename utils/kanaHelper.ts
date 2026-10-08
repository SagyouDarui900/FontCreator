import { GlyphData, PathContour } from '../types';
import { KANA_PAIRS } from '../data/unicodeTables';
import { createSmallKanaContours, SmallKanaOptions } from './pathUtils';

export interface BatchSmallKanaOptions extends SmallKanaOptions {
  overwriteExisting?: boolean;
  scope?: 'all' | 'hiragana' | 'katakana';
}

/**
 * プロジェクト内のすべての親文字から対応する小書き文字を一括自動生成
 */
export function batchGenerateSmallKana(
  glyphs: Record<number, GlyphData>,
  options?: BatchSmallKanaOptions
): {
  updatedGlyphs: Record<number, GlyphData>;
  generatedCount: number;
  details: { sourceChar: string; targetChar: string; targetUnicode: number }[];
} {
  const updatedGlyphs = { ...glyphs };
  let generatedCount = 0;
  const details: { sourceChar: string; targetChar: string; targetUnicode: number }[] = [];

  const overwrite = options?.overwriteExisting ?? false;
  const scope = options?.scope ?? 'all';

  for (const [sourceChar, pair] of Object.entries(KANA_PAIRS)) {
    const sourceUnicode = sourceChar.codePointAt(0);
    if (!sourceUnicode) continue;

    const isHiragana = sourceUnicode >= 0x3041 && sourceUnicode <= 0x3096;
    const isKatakana = sourceUnicode >= 0x30a1 && sourceUnicode <= 0x30fa;

    if (scope === 'hiragana' && !isHiragana) continue;
    if (scope === 'katakana' && !isKatakana) continue;

    const sourceGlyph = glyphs[sourceUnicode];
    if (!sourceGlyph || !sourceGlyph.contours || sourceGlyph.contours.length === 0) {
      // 親文字が未作図ならスキップ
      continue;
    }

    const targetUnicode = pair.smallUnicode;
    const existing = glyphs[targetUnicode];
    const hasExistingContours = existing && existing.contours && existing.contours.length > 0;

    if (!hasExistingContours || overwrite) {
      const smallContours = createSmallKanaContours(sourceGlyph.contours, options);

      updatedGlyphs[targetUnicode] = {
        unicode: targetUnicode,
        char: pair.smallChar,
        name: `uni${targetUnicode.toString(16).toUpperCase().padStart(4, '0')}`,
        advanceWidth: sourceGlyph.advanceWidth || 1000,
        lsb: 80,
        contours: smallContours,
        modified: true,
      };

      generatedCount++;
      details.push({
        sourceChar,
        targetChar: pair.smallChar,
        targetUnicode,
      });
    }
  }

  return { updatedGlyphs, generatedCount, details };
}
