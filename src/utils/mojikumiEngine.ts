import {
  MojikumiConfig,
  MojikumiPresetId,
  MojikumiTable,
  KinsokuSetId,
  BurasagariMode,
  KinsokuAdjustMode,
  ParagraphIndentPresetId,
  MojikumiRuleItem,
} from '../types';

// ============================================================================
// 1. JIS X 4051 & Illustrator 手引き準拠の 7大文字組みプリセット定義
// ============================================================================

const RULE = (min: number, optimal: number, max: number, priority: number): MojikumiRuleItem => ({
  min,
  optimal,
  max,
  priority,
});

/**
 * 1. 行末約物半角 (Illustratorデフォルト / 伝統的JIS組版)
 * 行末約物は半角(0%)固定。行中約物は半角アキ(50%)、欧文前後は四分(25%)アキ。
 */
export const PRESET_GYOMATSU_YAKUMONO_HANKAN: MojikumiTable = {
  endBracket_to_lineEnd: RULE(0, 0, 0, 0),
  touten_to_lineEnd: RULE(0, 0, 0, 0),
  kuten_to_lineEnd: RULE(0, 0, 0, 0),
  middleDot_to_lineEnd: RULE(0, 0, 0, 0),

  paraStart_to_startBracket: RULE(0, 0, 0, 0),
  paraStart_to_nonYakumono: RULE(0, 0, 0, 0),
  lineStart_to_startBracket: RULE(0, 0, 0, 0),

  nonYakumono_to_startBracket: RULE(0, 50, 50, 3),
  endBracket_to_nonYakumono: RULE(0, 50, 50, 3),
  endBracket_to_startBracket: RULE(0, 50, 50, 3),
  touten_to_startBracket: RULE(0, 50, 50, 2),
  touten_to_nonYakumono: RULE(0, 50, 50, 2),
  kuten_to_startBracket: RULE(0, 50, 50, 3),
  kuten_to_nonYakumono: RULE(0, 50, 50, 0), // 優先度0 (最後につめる)
  middleDot_around: RULE(0, 25, 25, 1),

  halfLatin_around_nonYakumono: RULE(12.5, 25, 50, 4),
  halfDigit_around_nonYakumono: RULE(12.5, 25, 50, 4),
};

/**
 * 2. ベタ組み (手引き第38〜39ページ)
 * 「行末約物全角／半角」を元にカスタマイズ。句点後の最小値を12.5%にして区切り感を保持、
 * 優先順位（中点＞括弧＞読点＞句点）を最適化。
 */
export const PRESET_BETA: MojikumiTable = {
  endBracket_to_lineEnd: RULE(0, 50, 50, 1),
  touten_to_lineEnd: RULE(0, 50, 50, 1),
  kuten_to_lineEnd: RULE(0, 50, 50, 1),
  middleDot_to_lineEnd: RULE(25, 25, 25, 1),

  paraStart_to_startBracket: RULE(0, 0, 0, 0),
  paraStart_to_nonYakumono: RULE(0, 0, 0, 0),
  lineStart_to_startBracket: RULE(0, 0, 0, 0),

  nonYakumono_to_startBracket: RULE(0, 50, 50, 2),
  endBracket_to_nonYakumono: RULE(0, 50, 50, 2),
  endBracket_to_startBracket: RULE(0, 50, 50, 2),
  touten_to_startBracket: RULE(0, 50, 50, 3),
  touten_to_nonYakumono: RULE(0, 50, 50, 3),
  kuten_to_startBracket: RULE(12.5, 50, 50, 4),
  kuten_to_nonYakumono: RULE(12.5, 50, 50, 4),
  middleDot_around: RULE(0, 25, 25, 1),

  halfLatin_around_nonYakumono: RULE(12.5, 12.5, 25, 4),
  halfDigit_around_nonYakumono: RULE(0, 0, 12.5, 4),
};

/**
 * 3. ツメ組み (手引き第40ページ)
 * 不必要なアキを排除（最小・最適値0%基本）。区切りとなる句点のみ最適値12.5%を確保。
 */
export const PRESET_TSUME: MojikumiTable = {
  endBracket_to_lineEnd: RULE(0, 0, 0, 1),
  touten_to_lineEnd: RULE(0, 0, 0, 1),
  kuten_to_lineEnd: RULE(0, 0, 0, 1),
  middleDot_to_lineEnd: RULE(0, 0, 0, 1),

  paraStart_to_startBracket: RULE(0, 0, 0, 0),
  paraStart_to_nonYakumono: RULE(0, 0, 0, 0),
  lineStart_to_startBracket: RULE(0, 0, 0, 0),

  nonYakumono_to_startBracket: RULE(0, 0, 50, 3),
  endBracket_to_nonYakumono: RULE(0, 0, 50, 3),
  endBracket_to_startBracket: RULE(0, 0, 50, 3),
  touten_to_startBracket: RULE(0, 0, 50, 2),
  touten_to_nonYakumono: RULE(0, 0, 50, 2),
  kuten_to_startBracket: RULE(0, 12.5, 50, 1),
  kuten_to_nonYakumono: RULE(0, 12.5, 50, 1),
  middleDot_around: RULE(0, 0, 25, 4),

  halfLatin_around_nonYakumono: RULE(0, 0, 12.5, 1),
  halfDigit_around_nonYakumono: RULE(0, 0, 12.5, 1),
};

/**
 * 4. 行末約物全角／半角
 */
export const PRESET_GYOMATSU_ZEN_HAN: MojikumiTable = {
  endBracket_to_lineEnd: RULE(0, 50, 50, 1),
  touten_to_lineEnd: RULE(0, 50, 50, 1),
  kuten_to_lineEnd: RULE(0, 50, 50, 1),
  middleDot_to_lineEnd: RULE(25, 25, 25, 1),

  paraStart_to_startBracket: RULE(0, 0, 0, 0),
  paraStart_to_nonYakumono: RULE(0, 0, 0, 0),
  lineStart_to_startBracket: RULE(0, 0, 0, 0),

  nonYakumono_to_startBracket: RULE(0, 50, 50, 3),
  endBracket_to_nonYakumono: RULE(0, 50, 50, 3),
  endBracket_to_startBracket: RULE(0, 50, 50, 3),
  touten_to_startBracket: RULE(0, 50, 50, 2),
  touten_to_nonYakumono: RULE(0, 50, 50, 2),
  kuten_to_startBracket: RULE(0, 50, 50, 3),
  kuten_to_nonYakumono: RULE(0, 50, 50, 0),
  middleDot_around: RULE(0, 25, 25, 1),

  halfLatin_around_nonYakumono: RULE(0, 0, 12.5, 4),
  halfDigit_around_nonYakumono: RULE(0, 0, 12.5, 4),
};

/**
 * 5. 約物半角
 */
export const PRESET_YAKUMONO_HANKAN: MojikumiTable = {
  ...PRESET_GYOMATSU_YAKUMONO_HANKAN,
  nonYakumono_to_startBracket: RULE(0, 0, 50, 3),
  endBracket_to_nonYakumono: RULE(0, 0, 50, 3),
};

/**
 * 6. 行末約物全角
 */
export const PRESET_GYOMATSU_YAKUMONO_ZENKAKU: MojikumiTable = {
  ...PRESET_GYOMATSU_YAKUMONO_HANKAN,
  endBracket_to_lineEnd: RULE(0, 50, 50, 1),
  touten_to_lineEnd: RULE(0, 50, 50, 1),
  kuten_to_lineEnd: RULE(0, 50, 50, 1),
};

/**
 * 7. 約物全角
 */
export const PRESET_YAKUMONO_ZENKAKU: MojikumiTable = {
  ...PRESET_GYOMATSU_YAKUMONO_ZENKAKU,
  endBracket_to_lineEnd: RULE(50, 50, 50, 0),
  touten_to_lineEnd: RULE(50, 50, 50, 0),
  kuten_to_lineEnd: RULE(50, 50, 50, 0),
};

export const MOJIKUMI_PRESETS: Record<MojikumiPresetId, { name: string; description: string; table: MojikumiTable }> = {
  beta: {
    name: 'ベタ組み',
    description: '本文などの長文に最適。句点の区切り感を保ち、現代の和欧混植に適した最適値設計。',
    table: PRESET_BETA,
  },
  tsume: {
    name: 'ツメ組み',
    description: '見出しやリード文に最適。不要なアキを排除し、引き締まった一体感を生む現代的設定。',
    table: PRESET_TSUME,
  },
  gyomatsu_yakumono_hankan: {
    name: '行末約物半角',
    description: 'JIS X 4051準拠の標準設定。行末約物を半角で扱い、行中約物は半角アキを確保。',
    table: PRESET_GYOMATSU_YAKUMONO_HANKAN,
  },
  gyomatsu_zen_han: {
    name: '行末約物全角／半角',
    description: '英数字が多用される現代文書向け。和欧文間を0%〜12.5%に縮めた実用設定。',
    table: PRESET_GYOMATSU_ZEN_HAN,
  },
  yakumono_hankan: {
    name: '約物半角',
    description: 'すべての約物を半角基準で並べ、字間を詰めて組む伝統的アキ量設定。',
    table: PRESET_YAKUMONO_HANKAN,
  },
  gyomatsu_yakumono_zenkaku: {
    name: '行末約物全角',
    description: '行末の約物にも全角アキを許容するゆったりとした組版設計。',
    table: PRESET_GYOMATSU_YAKUMONO_ZENKAKU,
  },
  yakumono_zenkaku: {
    name: '約物全角',
    description: 'すべての約物を常に全角スペース扱いで並べる伝統的な組版設定。',
    table: PRESET_YAKUMONO_ZENKAKU,
  },
  custom: {
    name: 'カスタムアキ量',
    description: 'ユーザーが最小・最適・最大・優先順位を自由にカスタマイズした設定。',
    table: PRESET_BETA,
  },
};

// ============================================================================
// 2. 段落行頭1字下げプリセット（手引き第48〜52ページ準拠）
// ============================================================================

export function applyParagraphIndentPreset(
  baseTable: MojikumiTable,
  indentPreset: ParagraphIndentPresetId
): MojikumiTable {
  const table = { ...baseTable };

  switch (indentPreset) {
    case 'visual_half':
      // 見た目半角下がり（折り返し後アキなし）
      // 段落先頭の括弧類: 50%固定, 非約物: 100%固定, 折り返し後の始め括弧: 0% (天付き)
      table.paraStart_to_startBracket = RULE(50, 50, 50, 0);
      table.paraStart_to_nonYakumono = RULE(100, 100, 100, 0);
      table.lineStart_to_startBracket = RULE(0, 0, 0, 0);
      break;

    case 'visual_full':
      // 見た目全角下がり（折り返し後アキなし）
      // 段落先頭の括弧類: 100%固定, 非約物: 100%固定, 折り返し後の始め括弧: 0% (天付き)
      table.paraStart_to_startBracket = RULE(100, 100, 100, 0);
      table.paraStart_to_nonYakumono = RULE(100, 100, 100, 0);
      table.lineStart_to_startBracket = RULE(0, 0, 0, 0);
      break;

    case 'visual_full_half':
      // 見た目全角半下がり（折り返し後半角下がり）
      // 段落先頭の括弧類: 150%固定, 非約物: 100%固定, 折り返し後の始め括弧: 50% (半角下がり)
      table.paraStart_to_startBracket = RULE(150, 150, 150, 0);
      table.paraStart_to_nonYakumono = RULE(100, 100, 100, 0);
      table.lineStart_to_startBracket = RULE(50, 50, 50, 0);
      break;

    case 'none':
    default:
      // 通常の行頭（字下げなし）
      table.paraStart_to_startBracket = RULE(0, 0, 0, 0);
      table.paraStart_to_nonYakumono = RULE(0, 0, 0, 0);
      table.lineStart_to_startBracket = RULE(0, 0, 0, 0);
      break;
  }

  return table;
}

// ============================================================================
// 3. 禁則文字クラス & ぶら下がり文字定義（手引き第25・27ページ）
// ============================================================================

export const KINSOKU_CHARS = {
  // 句読点
  kuten: '。．.',
  touten: '、，,',
  // 括弧類
  startBrackets: '「『（(〔［{【〈《«‹“‘',
  endBrackets: '」』）)〕］}】〉》»›”’',
  // 中点類
  middleDots: '・:;：；',
  // 分離禁止文字
  inseparable: '―…‥',
  // 促音・小書き仮名
  smallKana: 'ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ',
  // 音引き・長音符
  choon: 'ー~〜',
  // 単位・記号
  units: '％%℃°¢$￥¥€#№',
};

/**
 * 行頭禁則文字リスト
 */
export function getLineStartProhibitedChars(setId: KinsokuSetId): Set<string> {
  const set = new Set<string>();
  if (setId === 'none') return set;

  // 句読点・終わり括弧は全セットで共通
  for (const c of KINSOKU_CHARS.kuten + KINSOKU_CHARS.touten + KINSOKU_CHARS.endBrackets) {
    set.add(c);
  }

  // 中点類・分離禁止記号
  for (const c of KINSOKU_CHARS.middleDots + KINSOKU_CHARS.inseparable) {
    set.add(c);
  }

  if (setId === 'weak_v2') {
    // 弱い禁則 v2: 促音（っッ）も行頭禁則に追加
    set.add('っ');
    set.add('ッ');
  }

  if (setId === 'strong') {
    // 強い禁則: 小書き仮名全体、音引き、単位記号も追加
    for (const c of KINSOKU_CHARS.smallKana + KINSOKU_CHARS.choon + KINSOKU_CHARS.units) {
      set.add(c);
    }
  }

  return set;
}

/**
 * 行末禁則文字リスト
 */
export function getLineEndProhibitedChars(setId: KinsokuSetId): Set<string> {
  const set = new Set<string>();
  if (setId === 'none') return set;

  for (const c of KINSOKU_CHARS.startBrackets) {
    set.add(c);
  }

  if (setId === 'strong') {
    set.add('￥');
    set.add('¥');
    set.add('$');
    set.add('€');
    set.add('#');
  }

  return set;
}

/**
 * ぶら下がり文字（手引き第27ページ）: 句点「。」読点「、」カンマ「，」ピリオド「．」
 */
export const BURASAGARI_CHARS = new Set(['。', '、', '，', '．', '.', ',']);

// ============================================================================
// 4. 文字種の判定ヘルパー
// ============================================================================

export type CharKind =
  | 'start_bracket'
  | 'end_bracket'
  | 'touten'
  | 'kuten'
  | 'middle_dot'
  | 'half_latin'
  | 'half_digit'
  | 'full_space'
  | 'non_yakumono';

export function getCharKind(ch: string): CharKind {
  if (KINSOKU_CHARS.startBrackets.includes(ch)) return 'start_bracket';
  if (KINSOKU_CHARS.endBrackets.includes(ch)) return 'end_bracket';
  if (KINSOKU_CHARS.touten.includes(ch)) return 'touten';
  if (KINSOKU_CHARS.kuten.includes(ch)) return 'kuten';
  if (KINSOKU_CHARS.middleDots.includes(ch)) return 'middle_dot';
  if (ch === '　') return 'full_space';
  if (/^[a-zA-Z]$/.test(ch)) return 'half_latin';
  if (/^[0-9]$/.test(ch)) return 'half_digit';
  return 'non_yakumono';
}

// ============================================================================
// 5. Q・H単位系とテキストエリアの計算器（手引き第04・42ページ）
// ============================================================================

export interface TypesettingDimensions {
  fontSizeQ: number;       // 文字サイズ (Q: 1Q = 0.25mm)
  fontSizePt: number;      // pt換算
  lineFeedH: number;       // 行送り (H: 1H = 0.25mm)
  lineFeedPt: number;      // pt換算
  lineGapH: number;        // 行間 (H = 行送り - 文字サイズ)
  charsPerLine: number;    // 1行字詰め
  lineCount: number;       // 行数
  widthMm: number;         // テキストエリア幅 (mm)
  heightMm: number;        // テキストエリア高さ (mm)
  formulaWidth: string;    // 計算式
  formulaHeight: string;   // 計算式
}

export function calculateTypesettingDimensions(
  fontSizeQ: number,
  lineFeedH: number,
  charsPerLine: number,
  lineCount: number
): TypesettingDimensions {
  const mmPerUnit = 0.25;
  const ptPerUnit = 0.25 / 0.352778; // 1pt ≈ 0.3528mm -> 1Q ≈ 0.7087pt

  const widthMm = fontSizeQ * charsPerLine * mmPerUnit;
  const heightMm = (lineFeedH * Math.max(1, lineCount - 1) + fontSizeQ) * mmPerUnit;
  const lineGapH = lineFeedH - fontSizeQ;

  return {
    fontSizeQ,
    fontSizePt: Math.round(fontSizeQ * ptPerUnit * 10) / 10,
    lineFeedH,
    lineFeedPt: Math.round(lineFeedH * ptPerUnit * 10) / 10,
    lineGapH,
    charsPerLine,
    lineCount,
    widthMm: Math.round(widthMm * 10) / 10,
    heightMm: Math.round(heightMm * 10) / 10,
    formulaWidth: `${fontSizeQ}Q × ${charsPerLine}字 = ${fontSizeQ * charsPerLine}Q (${(fontSizeQ * charsPerLine * mmPerUnit).toFixed(1)}mm)`,
    formulaHeight: `${lineFeedH}H × (${lineCount} - 1) + ${fontSizeQ}Q = ${lineFeedH * (lineCount - 1) + fontSizeQ}H (${heightMm.toFixed(1)}mm)`,
  };
}

// ============================================================================
// 6. レイアウトシミュレーター (Adobe 日本語単数行コンポーザー準拠)
// ============================================================================

export interface FormattedGlyph {
  char: string;
  charIndex: number;
  kind: CharKind;
  spacingBeforeEm: number; // 前のアキ (1.0 = 1em)
  spacingAfterEm: number;  // 後のアキ
  isHanging: boolean;      // ぶら下がり
  tateChuYoko?: boolean;   // 縦中横
}

export interface FormattedLine {
  lineIndex: number;
  glyphs: FormattedGlyph[];
  text: string;
  isParagraphStart: boolean;
  isParagraphEnd: boolean;
  totalAdvanceEm: number;
  isOverflown: boolean;
  burasagariCount: number;
}

export interface FormattedLayoutResult {
  lines: FormattedLine[];
  totalChars: number;
  lineCount: number;
  burasagariCount: number;
  averageDensityPercent: number;
}

/**
 * 2文字間の最適アキ量（em単位）を取得
 */
export function getPairOptimalSpacing(
  leftKind: CharKind,
  rightKind: CharKind,
  table: MojikumiTable,
  isLineStart: boolean,
  isParagraphStart: boolean
): { beforeEm: number; afterEm: number } {
  let beforeEm = 0;
  let afterEm = 0;

  // 行頭処理
  if (isLineStart) {
    if (rightKind === 'start_bracket') {
      const rule = isParagraphStart ? table.paraStart_to_startBracket : table.lineStart_to_startBracket;
      beforeEm += rule.optimal / 100;
    } else if (rightKind === 'non_yakumono' && isParagraphStart) {
      beforeEm += table.paraStart_to_nonYakumono.optimal / 100;
    }
    return { beforeEm, afterEm };
  }

  // 行中処理
  if (leftKind === 'non_yakumono' && rightKind === 'start_bracket') {
    beforeEm += table.nonYakumono_to_startBracket.optimal / 100;
  } else if (leftKind === 'end_bracket' && rightKind === 'non_yakumono') {
    afterEm += table.endBracket_to_nonYakumono.optimal / 100;
  } else if (leftKind === 'end_bracket' && rightKind === 'start_bracket') {
    // 終わり括弧と始め括弧の連続
    afterEm += table.endBracket_to_startBracket.optimal / 100;
  } else if (leftKind === 'touten' && rightKind === 'start_bracket') {
    afterEm += table.touten_to_startBracket.optimal / 100;
  } else if (leftKind === 'touten' && rightKind === 'non_yakumono') {
    afterEm += table.touten_to_nonYakumono.optimal / 100;
  } else if (leftKind === 'kuten' && rightKind === 'start_bracket') {
    afterEm += table.kuten_to_startBracket.optimal / 100;
  } else if (leftKind === 'kuten' && rightKind === 'non_yakumono') {
    afterEm += table.kuten_to_nonYakumono.optimal / 100;
  } else if (leftKind === 'middle_dot' || rightKind === 'middle_dot') {
    if (leftKind === 'middle_dot') afterEm += table.middleDot_around.optimal / 100;
    if (rightKind === 'middle_dot') beforeEm += table.middleDot_around.optimal / 100;
  } else if (
    (leftKind === 'half_latin' && rightKind === 'non_yakumono') ||
    (leftKind === 'non_yakumono' && rightKind === 'half_latin')
  ) {
    afterEm += table.halfLatin_around_nonYakumono.optimal / 100;
  } else if (
    (leftKind === 'half_digit' && rightKind === 'non_yakumono') ||
    (leftKind === 'non_yakumono' && rightKind === 'half_digit')
  ) {
    afterEm += table.halfDigit_around_nonYakumono.optimal / 100;
  }

  return { beforeEm, afterEm };
}

/**
 * テキストを指定の文字組み設定と禁則・ぶら下がりで組版整形シミュレート
 */
export function simulateTypesetting(
  text: string,
  charsPerLine: number,
  config: MojikumiConfig,
  options?: {
    isVertical?: boolean;
    trackingEm?: number; // トラッキング (アケ組み用: +0.1em 〜 +0.25em)
    usePalt?: boolean;   // プロポーショナルメトリクス (ツメ組み用)
  }
): FormattedLayoutResult {
  const table = applyParagraphIndentPreset(config.table, config.paragraphIndent);
  const startProhibited = getLineStartProhibitedChars(config.kinsoku);
  const endProhibited = getLineEndProhibitedChars(config.kinsoku);
  const burasagariMode = config.burasagari;
  const trackingEm = options?.trackingEm ?? 0;
  const usePalt = options?.usePalt ?? false;

  const paragraphs = text.split('\n');
  const lines: FormattedLine[] = [];
  let totalBurasagari = 0;
  let totalCharCount = 0;

  for (const para of paragraphs) {
    const chars = Array.from(para);
    if (chars.length === 0) {
      lines.push({
        lineIndex: lines.length,
        glyphs: [],
        text: '',
        isParagraphStart: true,
        isParagraphEnd: true,
        totalAdvanceEm: 0,
        isOverflown: false,
        burasagariCount: 0,
      });
      continue;
    }

    let charCursor = 0;
    let isParaStart = true;

    while (charCursor < chars.length) {
      const currentLineGlyphs: FormattedGlyph[] = [];
      let currentAdvanceEm = 0;
      let lineBurasagari = 0;

      while (charCursor < chars.length) {
        const ch = chars[charCursor];
        const kind = getCharKind(ch);
        const isFirstInLine = currentLineGlyphs.length === 0;

        // 幅（ベタ組みは1.0em、ツメ組み/palt時は約物やカナを適度に圧縮）
        let baseAdvance = 1.0;
        if (usePalt) {
          if (kind === 'touten' || kind === 'kuten' || kind === 'start_bracket' || kind === 'end_bracket') {
            baseAdvance = 0.5; // 約物は半角
          } else if (kind === 'middle_dot') {
            baseAdvance = 0.5;
          } else if (kind === 'half_latin' || kind === 'half_digit') {
            baseAdvance = 0.55;
          } else if (KINSOKU_CHARS.smallKana.includes(ch)) {
            baseAdvance = 0.8;
          } else {
            baseAdvance = 0.95; // 和文もわずかにツメ
          }
        } else if (kind === 'half_latin' || kind === 'half_digit') {
          baseAdvance = 0.5;
        }

        // アキ量
        const prevGlyph = currentLineGlyphs[currentLineGlyphs.length - 1];
        const { beforeEm, afterEm } = prevGlyph
          ? getPairOptimalSpacing(prevGlyph.kind, kind, table, false, false)
          : getPairOptimalSpacing('non_yakumono', kind, table, true, isParaStart);

        const glyphTotalAdvance = baseAdvance + beforeEm + afterEm + trackingEm;

        // 行長判定
        const wouldExceed = currentAdvanceEm + glyphTotalAdvance > charsPerLine + 0.05;

        if (wouldExceed) {
          // ぶら下がり判定
          if (
            burasagariMode !== 'none' &&
            BURASAGARI_CHARS.has(ch) &&
            lineBurasagari === 0 &&
            currentLineGlyphs.length >= charsPerLine - 1
          ) {
            // ぶら下がり適用！版面外（マージン）に1字追加
            currentLineGlyphs.push({
              char: ch,
              charIndex: totalCharCount + charCursor,
              kind,
              spacingBeforeEm: beforeEm,
              spacingAfterEm: 0,
              isHanging: true,
            });
            charCursor++;
            lineBurasagari++;
            totalBurasagari++;
            break;
          }

          // 禁則処理: 行頭禁則文字が次行の頭に来ないか、または現行の末尾が行末禁則でないか
          if (config.kinsoku !== 'none') {
            // もしchが行頭禁則文字なら、直前の文字を巻き込んで次行へ（追い出し）
            if (startProhibited.has(ch) && currentLineGlyphs.length > 1) {
              const last = currentLineGlyphs.pop()!;
              charCursor--;
              currentAdvanceEm -= 1.0;
            }
          }

          break; // 次の行へ
        }

        // 行末禁則チェック (現文字が行末禁則で、かつ行末に位置する場合)
        if (
          config.kinsoku !== 'none' &&
          endProhibited.has(ch) &&
          currentAdvanceEm + glyphTotalAdvance * 2 > charsPerLine
        ) {
          if (config.kinsokuAdjust === 'push_out') {
            // 追い出し優先: 行末禁則文字を丸ごと次行へ回す
            break;
          }
        }

        currentLineGlyphs.push({
          char: ch,
          charIndex: totalCharCount + charCursor,
          kind,
          spacingBeforeEm: beforeEm,
          spacingAfterEm: afterEm,
          isHanging: false,
        });

        currentAdvanceEm += glyphTotalAdvance;
        charCursor++;
      }

      const isParaEnd = charCursor >= chars.length;
      lines.push({
        lineIndex: lines.length,
        glyphs: currentLineGlyphs,
        text: currentLineGlyphs.map((g) => g.char).join(''),
        isParagraphStart: isParaStart,
        isParagraphEnd: isParaEnd,
        totalAdvanceEm: currentAdvanceEm,
        isOverflown: currentAdvanceEm > charsPerLine && lineBurasagari === 0,
        burasagariCount: lineBurasagari,
      });

      isParaStart = false;
    }

    totalCharCount += chars.length;
  }

  const averageDensity =
    lines.length > 0
      ? (lines.reduce((acc, l) => acc + l.glyphs.length, 0) / (lines.length * charsPerLine)) * 100
      : 0;

  return {
    lines,
    totalChars: totalCharCount,
    lineCount: lines.length,
    burasagariCount: totalBurasagari,
    averageDensityPercent: Math.round(averageDensity * 10) / 10,
  };
}
