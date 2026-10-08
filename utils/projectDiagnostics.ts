import { FontProject, GlyphData, PathContour, CharCategory } from '../types';
import { getContoursBoundingBox } from './pathUtils';
import { UNICODE_CATEGORIES, getCategoryCharList } from '../data/unicodeTables';

export type DiagnosticStatus =
  | 'empty'                     // 未作成（輪郭なし）
  | 'draft'                     // 作業中（未閉合・極少ノード・描きかけ）
  | 'critically_low_complexity' // 著しく低い字形複雑度（異常・ダミー・仮置きの疑い）
  | 'low_complexity'            // 低い字形複雑度（軽微・シンプルすぎる可能性）
  | 'complete';                 // 完成（適切な複雑度と閉じた輪郭を持つ）

export type CharacterCategoryType =
  | 'kanji'
  | 'hiragana'
  | 'katakana'
  | 'latin'
  | 'digits'
  | 'symbols'
  | 'other';

export interface GlyphComplexityMetrics {
  nodeCount: number;
  contourCount: number;
  isAllClosed: boolean;
  bboxWidth: number;
  bboxHeight: number;
  bboxArea: number;
  complexityScore: number; // 0 to 100
  expectedComplexity: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  isNaturallySimple: boolean;
}

export interface DiagnosticItem {
  unicode: number;
  char: string;
  glyphName: string;
  categoryType: CharacterCategoryType;
  categoryId: string;
  categoryName: string;
  status: DiagnosticStatus;
  statusLabel: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  metrics: GlyphComplexityMetrics;
  reason: string;
  recommendation: string;
  isRegisteredInProject: boolean;
  glyph?: GlyphData;
}

export interface CategoryDiagnosticStat {
  id: string;
  name: string;
  totalChars: number;
  completedChars: number;
  emptyChars: number;
  draftChars: number;
  lowComplexityChars: number;
  completionRate: number; // 0 to 100%
}

export interface ProjectDiagnosticsReport {
  timestamp: number;
  totalTargetChars: number;
  totalRegisteredGlyphs: number;
  completedCount: number;
  emptyCount: number;
  draftCount: number;
  criticallyLowComplexityCount: number;
  lowComplexityCount: number;
  totalAttentionCount: number; // empty + draft + critically_low
  overallCompletionRate: number; // 0 to 100%
  categoryStats: CategoryDiagnosticStat[];
  items: DiagnosticItem[];
}

export type DiagnosticScope =
  | 'registered_only'     // プロジェクトに現在登録済みのグリフのみ
  | 'standard_japanese'   // ひらがな・カタカナ・半角英数・記号 + 登録済み漢字
  | 'elementary_kanji'    // 基本文字 + 小学校学年別配当漢字 (1,026字)
  | 'jis_level_1';        // 基本文字 + JIS第1水準漢字 (2,965字)

export interface ProjectDiagnosticsOptions {
  scope?: DiagnosticScope;
  includeCompletedInItems?: boolean;
}

// 単画・ごく低画数の漢字（「一」「乙」「二」「十」「八」「九」「七」「人」「入」「丁」「刀」「力」「又」「了」「乃」「三」など）
const NATURALLY_SIMPLE_KANJI = new Set([
  '一', '乙', '二', '十', '八', '九', '七', '人', '入', '丁',
  '刀', '力', '又', '了', '乃', '三', '下', '上', '大', '小',
  '山', '川', '口', '日', '月', '木', '土', '千', '夕', '子'
]);

// 本来単純な記号・約物・英数字
const NATURALLY_SIMPLE_CHARS = new Set([
  ' ', '　', '.', ',', ':', ';', '!', '?', '\'', '"', '`', '^',
  '-', '_', '~', '|', '/', '\\', '(', ')', '[', ']', '{', '}',
  'I', 'l', '1', 'i', 'j', 'o', 'O', '0', 'v', 'V', 'c', 'C',
  '・', '、', '。', 'ー', '―', '–', '︱'
]);

/**
 * 文字コードから文字分類を特定
 */
export function getCharacterCategoryType(code: number, char: string): CharacterCategoryType {
  // CJK Unified Ideographs & Extension A
  if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)) {
    return 'kanji';
  }
  // Hiragana
  if (code >= 0x3041 && code <= 0x3096) {
    return 'hiragana';
  }
  // Katakana (Fullwidth & Halfwidth)
  if ((code >= 0x30a1 && code <= 0x30fa) || (code >= 0xff61 && code <= 0xff9f)) {
    return 'katakana';
  }
  // Latin Letters
  if (
    (code >= 0x0041 && code <= 0x005a) ||
    (code >= 0x0061 && code <= 0x007a) ||
    (code >= 0xff21 && code <= 0xff3a) ||
    (code >= 0xff41 && code <= 0xff5a)
  ) {
    return 'latin';
  }
  // Digits
  if (
    (code >= 0x0030 && code <= 0x0039) ||
    (code >= 0xff10 && code <= 0xff19)
  ) {
    return 'digits';
  }
  // Symbols
  return 'symbols';
}

/**
 * カテゴリに応じた期待される複雑度水準を判定
 */
export function getExpectedComplexityLevel(
  code: number,
  char: string,
  categoryType: CharacterCategoryType
): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
  if (NATURALLY_SIMPLE_CHARS.has(char)) {
    return 'very_low';
  }
  if (categoryType === 'kanji') {
    if (NATURALLY_SIMPLE_KANJI.has(char)) {
      return 'low';
    }
    return 'high';
  }
  if (categoryType === 'hiragana' || categoryType === 'katakana') {
    return 'medium';
  }
  if (categoryType === 'latin' || categoryType === 'digits') {
    return 'low';
  }
  return 'low';
}

/**
 * グリフの字形複雑度（Complexity）メトリクスを多角的に解析
 */
export function analyzeGlyphComplexity(
  contours: PathContour[] | undefined,
  unicode: number,
  char: string
): GlyphComplexityMetrics {
  const categoryType = getCharacterCategoryType(unicode, char);
  const expectedComplexity = getExpectedComplexityLevel(unicode, char, categoryType);
  const isNaturallySimple = NATURALLY_SIMPLE_CHARS.has(char) || NATURALLY_SIMPLE_KANJI.has(char);

  if (!contours || contours.length === 0) {
    return {
      nodeCount: 0,
      contourCount: 0,
      isAllClosed: true,
      bboxWidth: 0,
      bboxHeight: 0,
      bboxArea: 0,
      complexityScore: 0,
      expectedComplexity,
      isNaturallySimple,
    };
  }

  let totalNodes = 0;
  let isAllClosed = true;

  contours.forEach((c) => {
    const n = c.nodes ? c.nodes.length : 0;
    totalNodes += n;
    if (c.closed === false) {
      isAllClosed = false;
    }
  });

  const bbox = getContoursBoundingBox(contours);
  const bboxWidth = Math.max(0, bbox.width);
  const bboxHeight = Math.max(0, bbox.height);
  const bboxArea = bboxWidth * bboxHeight;

  // 複雑度スコアの計算 (0 to 100)
  // 1. ノード数寄与 (最大 45点)
  const nodeScore = Math.min(45, totalNodes * 1.5);

  // 2. 輪郭（画数・ループ）寄与 (最大 35点)
  const contourScore = Math.min(35, contours.length * 6);

  // 3. 幾何占有率・サイズ寄与 (最大 20点: em-box 1000x1000 における標準字面)
  const sizeScore = Math.min(20, Math.round(((bboxWidth + bboxHeight) / 1600) * 20));

  let rawScore = Math.round(nodeScore + contourScore + sizeScore);
  const complexityScore = Math.max(0, Math.min(100, rawScore));

  return {
    nodeCount: totalNodes,
    contourCount: contours.length,
    isAllClosed,
    bboxWidth: Math.round(bboxWidth),
    bboxHeight: Math.round(bboxHeight),
    bboxArea: Math.round(bboxArea),
    complexityScore,
    expectedComplexity,
    isNaturallySimple,
  };
}

/**
 * プロジェクト診断（未完成文字・低複雑度字形の抽出）を実行
 */
export function runProjectDiagnostics(
  project: FontProject,
  options: ProjectDiagnosticsOptions = {}
): ProjectDiagnosticsReport {
  const scope = options.scope || 'standard_japanese';
  const includeCompletedInItems = options.includeCompletedInItems ?? true;

  // 対象文字リストの収集
  const targetCharsMap = new Map<number, { char: string; code: number; name?: string; categoryId: string; categoryName: string }>();

  // 1. プロジェクト登録済みの全グリフをまず追加
  Object.values(project.glyphs || {}).forEach((g) => {
    if (!g || typeof g.unicode !== 'number') return;
    const char = g.char || (g.unicode ? String.fromCodePoint(g.unicode) : '');
    targetCharsMap.set(g.unicode, {
      char,
      code: g.unicode,
      name: g.name,
      categoryId: 'project_registered',
      categoryName: '登録グリフ',
    });
  });

  // 2. スコープに応じたカテゴリ文字の追加
  const targetCategoryIds: string[] = [];
  if (scope === 'standard_japanese') {
    targetCategoryIds.push('hiragana', 'katakana', 'basic_latin_alnum', 'ascii_symbols', 'symbols');
  } else if (scope === 'elementary_kanji') {
    targetCategoryIds.push(
      'hiragana', 'katakana', 'basic_latin_alnum', 'ascii_symbols', 'symbols',
      'grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6'
    );
  } else if (scope === 'jis_level_1') {
    targetCategoryIds.push(
      'hiragana', 'katakana', 'basic_latin_alnum', 'ascii_symbols', 'symbols',
      'jis_1'
    );
  }

  UNICODE_CATEGORIES.forEach((cat) => {
    if (targetCategoryIds.includes(cat.id)) {
      const list = getCategoryCharList(cat);
      list.forEach((item) => {
        if (!targetCharsMap.has(item.code)) {
          targetCharsMap.set(item.code, {
            char: item.char,
            code: item.code,
            name: item.name,
            categoryId: cat.id,
            categoryName: cat.name,
          });
        }
      });
    }
  });

  const diagnosticItems: DiagnosticItem[] = [];
  let completedCount = 0;
  let emptyCount = 0;
  let draftCount = 0;
  let criticallyLowComplexityCount = 0;
  let lowComplexityCount = 0;

  // 各文字の診断判定
  targetCharsMap.forEach((charInfo, unicode) => {
    const glyphData = project.glyphs?.[unicode];
    const isRegistered = !!glyphData;
    const contours = glyphData?.contours || [];
    const char = charInfo.char || (unicode ? String.fromCodePoint(unicode) : '');
    const glyphName = glyphData?.name || charInfo.name || `uni${unicode.toString(16).toUpperCase()}`;
    const categoryType = getCharacterCategoryType(unicode, char);
    const metrics = analyzeGlyphComplexity(contours, unicode, char);

    let status: DiagnosticStatus = 'complete';
    let statusLabel = '完成';
    let severity: 'error' | 'warning' | 'info' | 'success' = 'success';
    let reason = '';
    let recommendation = '';

    // 空白文字（U+0020, U+3000）は空でも正常
    const isSpaceChar = unicode === 0x0020 || unicode === 0x3000;

    if (isSpaceChar) {
      status = 'complete';
      statusLabel = '正常（空白約物）';
      severity = 'success';
      reason = 'スペース記号のため輪郭なしで正常です。';
      recommendation = '送り幅（advanceWidth）の確認のみ推奨します。';
    } else if (contours.length === 0 || metrics.nodeCount === 0) {
      // 1. 未完成（輪郭なし・空グリフ）
      status = 'empty';
      statusLabel = isRegistered ? '未作成（空グリフ）' : '未着手（未登録）';
      severity = 'error';
      reason = isRegistered
        ? `文字「${char}」はプロジェクトに枠のみ登録されていますが、輪郭パスが 0 件です。`
        : `文字「${char}」はまだプロジェクトに登録・作図されていません。`;
      recommendation = 'キャンバスを開いて作図するか、下絵・下書き・パーツを配置して文字を制作してください。';
      emptyCount++;
    } else if (!metrics.isAllClosed || metrics.nodeCount <= 2 || metrics.bboxArea <= 100) {
      // 2. 作業中・描きかけ（パスが開いたまま、極少ノード、面積ほぼ0）
      status = 'draft';
      statusLabel = '作業中（描きかけ）';
      severity = 'warning';
      if (!metrics.isAllClosed) {
        reason = `輪郭パスが閉じられていません（開いたパスが残っています）。`;
        recommendation = '始点と終点を連結して輪郭を閉じるか、ペンツールで面として完結させてください。';
      } else if (metrics.nodeCount <= 2) {
        reason = `ノード数が ${metrics.nodeCount} 点のみで、独立した面やストロークが形成されていません。`;
        recommendation = 'ノードを追加して文字の形状を形成するか、テスト用の点を削除してください。';
      } else {
        reason = `字形の面積が極小 (${metrics.bboxWidth}x${metrics.bboxHeight}px) です。微小な点や不要なパスが含まれていないか確認してください。`;
        recommendation = '微小な残骸ノードを削除するか、正しい文字サイズで作図してください。';
      }
      draftCount++;
    } else {
      // 3. 著しく低い字形複雑度（Critically Low Complexity）の判定
      let isCriticallyLow = false;
      let isLow = false;

      if (categoryType === 'kanji') {
        if (!metrics.isNaturallySimple) {
          // 一般的な漢字なのに輪郭1個かつノード10個未満、またはスコア15未満
          if (metrics.nodeCount < 10 || (metrics.contourCount === 1 && metrics.nodeCount <= 8) || metrics.complexityScore < 16) {
            isCriticallyLow = true;
          } else if (metrics.nodeCount < 16 || metrics.complexityScore < 24) {
            isLow = true;
          }
        }
      } else if (categoryType === 'hiragana' || categoryType === 'katakana') {
        if (!metrics.isNaturallySimple) {
          if (metrics.nodeCount < 6 || metrics.complexityScore < 14) {
            isCriticallyLow = true;
          } else if (metrics.nodeCount < 10 || metrics.complexityScore < 22) {
            isLow = true;
          }
        }
      } else if (categoryType === 'latin' || categoryType === 'digits') {
        if (!metrics.isNaturallySimple) {
          if (metrics.nodeCount < 4 || metrics.complexityScore < 12) {
            isCriticallyLow = true;
          } else if (metrics.nodeCount < 6 || metrics.complexityScore < 18) {
            isLow = true;
          }
        }
      } else if (categoryType === 'symbols') {
        if (!metrics.isNaturallySimple) {
          if (metrics.nodeCount < 5 || metrics.complexityScore < 12) {
            isCriticallyLow = true;
          }
        }
      }

      if (isCriticallyLow) {
        status = 'critically_low_complexity';
        statusLabel = '著しく低い字形複雑度';
        severity = 'error';
        reason = categoryType === 'kanji'
          ? `漢字「${char}」の輪郭数が ${metrics.contourCount} 個・総ノード数が ${metrics.nodeCount} 個（スコア: ${metrics.complexityScore}）です。仮置きの図形または制作途中ではないか確認してください。`
          : `文字「${char}」の字形複雑度が低く、総ノード数 ${metrics.nodeCount} 個（スコア: ${metrics.complexityScore}）です。`;
        recommendation = '必要な画線やパーツが欠落していないか確認し、文字形状を完成させてください。';
        criticallyLowComplexityCount++;
      } else if (isLow) {
        status = 'low_complexity';
        statusLabel = 'やや低い字形複雑度';
        severity = 'warning';
        reason = `文字「${char}」の複雑度（スコア: ${metrics.complexityScore}、ノード数: ${metrics.nodeCount}個）が標準水準よりやや低めです。`;
        recommendation = '意図したシンプルなデザインであれば問題ありませんが、画線の省略がないか確認を推奨します。';
        lowComplexityCount++;
      } else {
        status = 'complete';
        statusLabel = '制作完了';
        severity = 'success';
        reason = `輪郭数: ${metrics.contourCount}個、ノード数: ${metrics.nodeCount}個、複雑度スコア: ${metrics.complexityScore}。良好な文字形状です。`;
        recommendation = '品質検査（重なり白抜き・極点ノード・ベースライン）の確認に進めます。';
        completedCount++;
      }
    }

    // アイテムとして記録（非完成品、または全表示設定時）
    if (status !== 'complete' || includeCompletedInItems) {
      diagnosticItems.push({
        unicode,
        char,
        glyphName,
        categoryType,
        categoryId: charInfo.categoryId,
        categoryName: charInfo.categoryName,
        status,
        statusLabel,
        severity,
        metrics,
        reason,
        recommendation,
        isRegisteredInProject: isRegistered,
        glyph: glyphData,
      });
    }
  });

  // カテゴリ別集計の計算
  const categoryStats: CategoryDiagnosticStat[] = [];
  const activeCategories = UNICODE_CATEGORIES.filter((c) => targetCategoryIds.includes(c.id));

  activeCategories.forEach((cat) => {
    const list = getCategoryCharList(cat);
    let catCompleted = 0;
    let catEmpty = 0;
    let catDraft = 0;
    let catLow = 0;

    list.forEach((item) => {
      const g = project.glyphs?.[item.code];
      const contours = g?.contours || [];
      const m = analyzeGlyphComplexity(contours, item.code, item.char);

      if (item.code === 0x0020 || item.code === 0x3000) {
        catCompleted++;
      } else if (!g || contours.length === 0 || m.nodeCount === 0) {
        catEmpty++;
      } else if (!m.isAllClosed || m.nodeCount <= 2 || m.bboxArea <= 100) {
        catDraft++;
      } else {
        const catType = getCharacterCategoryType(item.code, item.char);
        if (catType === 'kanji' && !m.isNaturallySimple && m.nodeCount < 10) {
          catLow++;
        } else if ((catType === 'hiragana' || catType === 'katakana') && !m.isNaturallySimple && m.nodeCount < 6) {
          catLow++;
        } else {
          catCompleted++;
        }
      }
    });

    const total = list.length;
    const rate = total > 0 ? Math.round((catCompleted / total) * 100) : 0;

    categoryStats.push({
      id: cat.id,
      name: cat.name,
      totalChars: total,
      completedChars: catCompleted,
      emptyChars: catEmpty,
      draftChars: catDraft,
      lowComplexityChars: catLow,
      completionRate: rate,
    });
  });

  const totalTargetChars = targetCharsMap.size;
  const overallCompletionRate = totalTargetChars > 0
    ? Math.round((completedCount / totalTargetChars) * 100)
    : 0;

  const totalAttentionCount = emptyCount + draftCount + criticallyLowComplexityCount;

  return {
    timestamp: Date.now(),
    totalTargetChars,
    totalRegisteredGlyphs: Object.keys(project.glyphs || {}).length,
    completedCount,
    emptyCount,
    draftCount,
    criticallyLowComplexityCount,
    lowComplexityCount,
    totalAttentionCount,
    overallCompletionRate,
    categoryStats,
    items: diagnosticItems,
  };
}
