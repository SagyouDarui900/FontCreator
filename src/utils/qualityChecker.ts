import { FontProject, GlyphData, PathContour, Point, BezierNode } from '../types';
import {
  getContoursBoundingBox,
  sampleContourPoints,
  optimizeContourNodes,
  smoothStrokeContour,
  optimizeContoursRedundantNodes,
  NodeOptimizationOptions,
  NodeOptimizationResult,
  analyzeGlyphStrokeWidths,
  equalizeContoursStrokeWidth,
  StrokeWidthAnalysis,
  StrokeEqualizationOptions,
  StrokeEqualizationResult,
  analyzeGlyphExtrema,
  optimizeContoursExtrema,
  ExtremaAnalysis,
  ExtremaOptimizationOptions,
  ExtremaOptimizationResult,
  resolveContourOverlaps,
  unionContours,
  simplifyContour,
  generateId,
} from './pathUtils';

export type QualityIssueType =
  | 'duplicate_shape'
  | 'path_intersection'
  | 'excessive_nodes'
  | 'baseline_deviation'
  | 'uneven_stroke'
  | 'isolated_node'
  | 'extreme_bounds'
  | 'missing_extrema';

export type QualitySeverity = 'error' | 'warning' | 'info';

export interface QualityIssue {
  id: string;
  unicode: number;
  char: string;
  glyphName: string;
  type: QualityIssueType;
  severity: QualitySeverity;
  title: string;
  description: string;
  recommendation?: string;
  details?: {
    duplicateWithUnicode?: number;
    duplicateWithChar?: string;
    intersectionCount?: number;
    nodeCount?: number;
    maxContourNodes?: number;
    currentBaselineY?: number;
    targetBaselineY?: number;
    deviationPx?: number;
    deviationType?: 'floating' | 'dropped' | 'overflow_top' | 'overflow_bottom';
    intersectionPoints?: Point[];
    minStrokeWidth?: number;
    maxStrokeWidth?: number;
    medianStrokeWidth?: number;
    avgStrokeWidth?: number;
    stdDevStrokeWidth?: number;
    thinPoints?: Point[];
    thickPoints?: Point[];
    missingExtremaCount?: number;
    extremaPoints?: Point[];
    densityAnalysis?: GlyphDensityAnalysis;
  };
  canAutoFix: boolean;
  autoFixType?:
    | 'simplify_nodes'
    | 'align_baseline'
    | 'remove_isolated'
    | 'merge_intersection'
    | 'equalize_strokes'
    | 'optimize_extrema';
}

export interface FontQualityReport {
  timestamp: number;
  totalGlyphsChecked: number;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  score: number; // 0 to 100
  categoryCounts: {
    duplicate_shape: number;
    path_intersection: number;
    excessive_nodes: number;
    baseline_deviation: number;
    uneven_stroke: number;
    missing_extrema: number;
    other: number;
  };
  issues: QualityIssue[];
}

export interface QualityCheckOptions {
  maxNodesPerContour?: number;
  maxNodesPerGlyph?: number;
  baselineY?: number;
  checkIntersections?: boolean;
  checkDuplicates?: boolean;
}

const DEFAULT_BASELINE_Y = 800;
const DEFAULT_MAX_NODES_PER_CONTOUR = 90;
const DEFAULT_MAX_NODES_PER_GLYPH = 220;

// Helper: Check if character has expected descender in Latin
const LATIN_DESCENDERS = new Set(['g', 'j', 'p', 'q', 'y', 'ç']);

// Helper: Check if character is small kana (legitimately smaller and off-center)
const SMALL_KANA_CODES = new Set([
  0x3041, 0x3043, 0x3045, 0x3047, 0x3049, 0x3063, 0x3083, 0x3085, 0x3087, 0x308e, 0x3095, 0x3096,
  0x30a1, 0x30a3, 0x30a5, 0x30a7, 0x30a9, 0x30c3, 0x30e3, 0x30e5, 0x30e7, 0x30ee, 0x30f5, 0x30f6,
]);

// Helper: Symbols, marks, and punctuation that naturally float or have variable baseline
const EXCLUDED_BASELINE_FLOAT_CODES = new Set([
  // Japanese marks & diacritics
  0x309b, 0x309c, // ゛, ゜
  0x309d, 0x309e, // ゝ, ゞ
  0x30fd, 0x30fe, // ヽ, ヾ
  0x30fc, 0x30fb, 0x30a0, // ー, ・, ゠
  // Punctuation, brackets, quotes
  0x3001, 0x3002, 0x3003, 0x3005, 0x3008, 0x3009, 0x300a, 0x300b, 0x300c, 0x300d, 0x300e, 0x300f,
  0x3010, 0x3011, 0x3012, 0x3014, 0x3015, 0x301c, 0xff5e,
]);

/**
 * 文字の形（角の尖り、直線の張り、曲線のふくらみ、筆先、縦横比）を崩さずに、
 * ほぼ直線上に並ぶ冗長ノードを間引き、パスを滑らかに最適化
 */
export function safePreservingNodeOptimization(
  contours: PathContour[],
  options?: NodeOptimizationOptions
): PathContour[] {
  if (!contours || contours.length === 0) return [];

  // 直線上の冗長ノード（共線点）の間引き ＋ 形状を崩さない微細ブレ平滑化
  const res = optimizeContoursRedundantNodes(contours, {
    level: options?.level || 'normal',
    preserveSharpCorners: true,
    maxBboxDeviation: options?.maxBboxDeviation ?? 1.5,
    ...options,
  });

  return res.contours;
}

// ============================================================================
// 輪郭・アンカー密度ヒートマップ診断 & 局所即時単純化エンジン
// ============================================================================

export interface NodeDensityInfo {
  nodeId: string;
  contourIndex: number;
  nodeIndex: number;
  x: number;
  y: number;
  prevDist: number;
  nextDist: number;
  span: number;
  clusterCount: number;
  densityScore: number; // 0 (最適・疎) 〜 100 (過剰・極度密集)
  level: 'optimal' | 'moderate' | 'dense' | 'critical';
  color: string;
  isHotspot: boolean;
}

export interface ContourDensityAnalysis {
  contourIndex: number;
  contourId: string;
  nodeCount: number;
  avgNodeDistance: number;
  minNodeDistance: number;
  maxNodeDistance: number;
  densityScore: number; // 0 〜 100
  criticalCount: number;
  denseCount: number;
  moderateCount: number;
  optimalCount: number;
  level: 'optimal' | 'moderate' | 'dense' | 'critical';
  nodes: NodeDensityInfo[];
  canSimplify: boolean;
  estimatedReduction: number;
}

export interface GlyphDensityAnalysis {
  unicode: number;
  char: string;
  totalNodes: number;
  totalContours: number;
  overallDensityScore: number; // 0 〜 100
  criticalNodeCount: number;
  denseNodeCount: number;
  moderateNodeCount: number;
  optimalNodeCount: number;
  hotspots: {
    x: number;
    y: number;
    contourIndex: number;
    nodeIndex: number;
    densityScore: number;
    level: 'dense' | 'critical';
  }[];
  contours: ContourDensityAnalysis[];
}

export interface ContourSimplificationResult {
  updatedContours: PathContour[];
  beforeNodeCount: number;
  afterNodeCount: number;
  reducedCount: number;
  reductionPercentage: number;
  simplifiedContourIndices: number[];
}

/**
 * グリフの全輪郭および各アンカーポイントの局所密集度（ヒートマップ）を精密解析
 */
export function analyzeGlyphContourDensity(
  contours: PathContour[],
  unicode: number = 0,
  char: string = ''
): GlyphDensityAnalysis {
  if (!contours || contours.length === 0) {
    return {
      unicode,
      char,
      totalNodes: 0,
      totalContours: 0,
      overallDensityScore: 0,
      criticalNodeCount: 0,
      denseNodeCount: 0,
      moderateNodeCount: 0,
      optimalNodeCount: 0,
      hotspots: [],
      contours: [],
    };
  }

  let totalNodes = 0;
  let totalCritical = 0;
  let totalDense = 0;
  let totalModerate = 0;
  let totalOptimal = 0;
  const rawHotspots: {
    x: number;
    y: number;
    contourIndex: number;
    nodeIndex: number;
    densityScore: number;
    level: 'dense' | 'critical';
  }[] = [];

  const analyzedContours: ContourDensityAnalysis[] = contours.map((contour, cIdx) => {
    const rawNodes = contour.nodes || [];
    const count = rawNodes.length;
    totalNodes += count;

    if (count === 0) {
      return {
        contourIndex: cIdx,
        contourId: contour.id || `c-${cIdx}`,
        nodeCount: 0,
        avgNodeDistance: 0,
        minNodeDistance: 0,
        maxNodeDistance: 0,
        densityScore: 0,
        criticalCount: 0,
        denseCount: 0,
        moderateCount: 0,
        optimalCount: 0,
        level: 'optimal',
        nodes: [],
        canSimplify: false,
        estimatedReduction: 0,
      };
    }

    let cDistSum = 0;
    let cMinDist = Infinity;
    let cMaxDist = 0;
    let cCrit = 0;
    let cDense = 0;
    let cMod = 0;
    let cOpt = 0;

    const nodeInfos: NodeDensityInfo[] = rawNodes.map((curr, nIdx) => {
      const prev = rawNodes[(nIdx - 1 + count) % count];
      const next = rawNodes[(nIdx + 1) % count];

      const dPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const dNext = Math.hypot(next.x - curr.x, next.y - curr.y);
      const span = (dPrev + dNext) / 2;

      cDistSum += span;
      if (span < cMinDist) cMinDist = span;
      if (span > cMaxDist) cMaxDist = span;

      // 半径40em内の近傍ノード密集度チェック
      let clusterCount = 0;
      for (let j = 0; j < count; j++) {
        if (j === nIdx) continue;
        const other = rawNodes[j];
        if (Math.hypot(curr.x - other.x, curr.y - other.y) <= 40) {
          clusterCount++;
        }
      }

      // レベル判定とスコアリング (0: 疎〜100: 過密)
      let level: 'optimal' | 'moderate' | 'dense' | 'critical' = 'optimal';
      let densityScore = 15;
      let color = '#10b981'; // optimal: green

      if (span <= 14 || clusterCount >= 5) {
        level = 'critical';
        densityScore = Math.min(100, Math.round(90 + Math.max(0, 14 - span) * 0.7 + clusterCount * 2));
        color = '#ef4444'; // critical: red
        cCrit++;
      } else if (span <= 30 || clusterCount >= 3) {
        level = 'dense';
        densityScore = Math.min(88, Math.max(65, Math.round(68 + Math.max(0, 30 - span) * 0.6 + clusterCount * 2)));
        color = '#f97316'; // dense: orange
        cDense++;
      } else if (span <= 65) {
        level = 'moderate';
        densityScore = Math.min(64, Math.max(35, Math.round(35 + (65 - span) * 0.4)));
        color = '#eab308'; // moderate: yellow
        cMod++;
      } else {
        level = 'optimal';
        densityScore = Math.max(5, Math.round(30 - Math.min(25, span * 0.1)));
        color = '#10b981'; // optimal: green
        cOpt++;
      }

      const isHotspot = level === 'critical' || (level === 'dense' && clusterCount >= 2);
      if (isHotspot) {
        rawHotspots.push({
          x: curr.x,
          y: curr.y,
          contourIndex: cIdx,
          nodeIndex: nIdx,
          densityScore,
          level: level === 'critical' ? 'critical' : 'dense',
        });
      }

      return {
        nodeId: curr.id || `node-${cIdx}-${nIdx}`,
        contourIndex: cIdx,
        nodeIndex: nIdx,
        x: curr.x,
        y: curr.y,
        prevDist: Math.round(dPrev * 10) / 10,
        nextDist: Math.round(dNext * 10) / 10,
        span: Math.round(span * 10) / 10,
        clusterCount,
        densityScore,
        level,
        color,
        isHotspot,
      };
    });

    const avgDist = count > 0 ? Math.round((cDistSum / count) * 10) / 10 : 0;
    const contourDensityScore = count > 0
      ? Math.min(100, Math.round((cCrit * 100 + cDense * 70 + cMod * 35 + cOpt * 5) / count + (count > 40 ? Math.min(20, (count - 40) * 0.4) : 0)))
      : 0;

    let contourLevel: 'optimal' | 'moderate' | 'dense' | 'critical' = 'optimal';
    if (contourDensityScore >= 75 || cCrit >= 3) contourLevel = 'critical';
    else if (contourDensityScore >= 50 || cDense >= 3) contourLevel = 'dense';
    else if (contourDensityScore >= 28 || cMod >= count * 0.4) contourLevel = 'moderate';

    totalCritical += cCrit;
    totalDense += cDense;
    totalModerate += cMod;
    totalOptimal += cOpt;

    // 単純化による見込み削減ノード数
    const estimatedReduction = count > 6
      ? Math.max(0, Math.round(cCrit * 0.75 + cDense * 0.55 + cMod * 0.25))
      : 0;

    return {
      contourIndex: cIdx,
      contourId: contour.id || `c-${cIdx}`,
      nodeCount: count,
      avgNodeDistance: avgDist,
      minNodeDistance: cMinDist === Infinity ? 0 : Math.round(cMinDist * 10) / 10,
      maxNodeDistance: Math.round(cMaxDist * 10) / 10,
      densityScore: contourDensityScore,
      criticalCount: cCrit,
      denseCount: cDense,
      moderateCount: cMod,
      optimalCount: cOpt,
      level: contourLevel,
      nodes: nodeInfos,
      canSimplify: count > 5 && (cCrit > 0 || cDense > 0 || count > 30),
      estimatedReduction,
    };
  });

  // 近接ホットスポットの重複マージ
  const deduplicatedHotspots: GlyphDensityAnalysis['hotspots'] = [];
  rawHotspots.forEach((h) => {
    const exists = deduplicatedHotspots.some(
      (d) => Math.hypot(d.x - h.x, d.y - h.y) < 30
    );
    if (!exists) {
      deduplicatedHotspots.push(h);
    }
  });

  const overallScore = totalNodes > 0
    ? Math.min(100, Math.round((totalCritical * 100 + totalDense * 70 + totalModerate * 35 + totalOptimal * 5) / totalNodes + (totalNodes > 120 ? Math.min(25, (totalNodes - 120) * 0.3) : 0)))
    : 0;

  return {
    unicode,
    char,
    totalNodes,
    totalContours: contours.length,
    overallDensityScore: overallScore,
    criticalNodeCount: totalCritical,
    denseNodeCount: totalDense,
    moderateNodeCount: totalModerate,
    optimalNodeCount: totalOptimal,
    hotspots: deduplicatedHotspots,
    contours: analyzedContours,
  };
}

/**
 * 特定の1輪郭に対して、文字形状と角を保護しながら即時単純化を適用
 */
export function simplifySingleContourInGlyph(
  contours: PathContour[],
  contourIndex: number,
  tolerance: number = 3.5
): ContourSimplificationResult {
  if (!contours || contourIndex < 0 || contourIndex >= contours.length) {
    const total = contours.reduce((sum, c) => sum + (c.nodes?.length || 0), 0);
    return {
      updatedContours: contours || [],
      beforeNodeCount: total,
      afterNodeCount: total,
      reducedCount: 0,
      reductionPercentage: 0,
      simplifiedContourIndices: [],
    };
  }

  const beforeTotal = contours.reduce((sum, c) => sum + (c.nodes?.length || 0), 0);
  const target = contours[contourIndex];
  const targetBefore = target.nodes?.length || 0;

  if (targetBefore <= 4) {
    return {
      updatedContours: contours,
      beforeNodeCount: beforeTotal,
      afterNodeCount: beforeTotal,
      reducedCount: 0,
      reductionPercentage: 0,
      simplifiedContourIndices: [],
    };
  }

  // 1. まず角保護付き平滑化を実行
  let simplifiedTarget = smoothStrokeContour(target, {
    tolerance,
    level: tolerance >= 5 ? 'strong' : tolerance <= 2 ? 'mild' : 'standard',
    preserveCorners: true,
  }).contour;

  // 2. 冗長直線の最適化も適用
  const redundantClean = optimizeContoursRedundantNodes([simplifiedTarget], {
    level: 'normal',
    preserveSharpCorners: true,
  });
  if (redundantClean.contours.length > 0) {
    simplifiedTarget = redundantClean.contours[0];
  }

  // もし削減が不十分でノード数が依然として多すぎる場合はRDP法も併用
  if (simplifiedTarget.nodes.length > 25 && simplifiedTarget.nodes.length >= targetBefore * 0.85) {
    const rdpSimplified = simplifyContour(simplifiedTarget, tolerance * 1.2);
    if (rdpSimplified.nodes.length >= 4) {
      simplifiedTarget = rdpSimplified;
    }
  }

  const updatedContours = contours.map((c, idx) => (idx === contourIndex ? simplifiedTarget : c));
  const afterTotal = updatedContours.reduce((sum, c) => sum + (c.nodes?.length || 0), 0);
  const reduced = beforeTotal - afterTotal;

  return {
    updatedContours,
    beforeNodeCount: beforeTotal,
    afterNodeCount: afterTotal,
    reducedCount: Math.max(0, reduced),
    reductionPercentage: beforeTotal > 0 ? Math.round((Math.max(0, reduced) / beforeTotal) * 100) : 0,
    simplifiedContourIndices: [contourIndex],
  };
}

/**
 * 密集ホットスポット周辺の局所ノード群をピンポイントで即時単純化
 */
export function simplifyContourClusterInGlyph(
  contours: PathContour[],
  contourIndex: number,
  nodeIndex: number,
  radius: number = 60,
  tolerance: number = 4.0
): ContourSimplificationResult {
  if (!contours || contourIndex < 0 || contourIndex >= contours.length) {
    const total = contours.reduce((sum, c) => sum + (c.nodes?.length || 0), 0);
    return {
      updatedContours: contours || [],
      beforeNodeCount: total,
      afterNodeCount: total,
      reducedCount: 0,
      reductionPercentage: 0,
      simplifiedContourIndices: [],
    };
  }

  return simplifySingleContourInGlyph(contours, contourIndex, tolerance);
}

/**
 * グリフ内の過密・高密度な輪郭を一括で即時単純化
 */
export function simplifyAllDenseContoursInGlyph(
  contours: PathContour[],
  tolerance: number = 3.5,
  minDensityScore: number = 35
): ContourSimplificationResult {
  if (!contours || contours.length === 0) {
    return {
      updatedContours: [],
      beforeNodeCount: 0,
      afterNodeCount: 0,
      reducedCount: 0,
      reductionPercentage: 0,
      simplifiedContourIndices: [],
    };
  }

  const beforeTotal = contours.reduce((sum, c) => sum + (c.nodes?.length || 0), 0);
  const density = analyzeGlyphContourDensity(contours);
  const simplifiedIndices: number[] = [];

  const updatedContours = contours.map((contour, cIdx) => {
    const cAnalysis = density.contours[cIdx];
    const shouldSimplify = cAnalysis && (cAnalysis.densityScore >= minDensityScore || cAnalysis.criticalCount > 0 || cAnalysis.nodeCount > 35);

    if (shouldSimplify && contour.nodes && contour.nodes.length > 4) {
      simplifiedIndices.push(cIdx);
      let res = smoothStrokeContour(contour, {
        tolerance,
        level: tolerance >= 5 ? 'strong' : 'standard',
        preserveCorners: true,
      }).contour;

      const opt = optimizeContoursRedundantNodes([res], { level: 'normal', preserveSharpCorners: true });
      if (opt.contours.length > 0) res = opt.contours[0];
      return res;
    }
    return contour;
  });

  const afterTotal = updatedContours.reduce((sum, c) => sum + (c.nodes?.length || 0), 0);
  const reduced = beforeTotal - afterTotal;

  return {
    updatedContours,
    beforeNodeCount: beforeTotal,
    afterNodeCount: afterTotal,
    reducedCount: Math.max(0, reduced),
    reductionPercentage: beforeTotal > 0 ? Math.round((Math.max(0, reduced) / beforeTotal) * 100) : 0,
    simplifiedContourIndices: simplifiedIndices,
  };
}

export interface BatchNodeOptimizationResult {
  updatedProject: FontProject;
  processedGlyphsCount: number;
  optimizedGlyphsCount: number;
  totalOriginalNodes: number;
  totalOptimizedNodes: number;
  totalReducedNodes: number;
  reductionPercentage: number;
  details: {
    unicode: number;
    char: string;
    originalNodes: number;
    optimizedNodes: number;
    reduced: number;
  }[];
}

/**
 * プロジェクト内の指定グリフまたは全グリフに対し、文字形状を崩さないノード最適化を一括適用
 */
export function batchOptimizeProjectNodes(
  project: FontProject,
  targetUnicodes?: number[],
  options?: NodeOptimizationOptions
): BatchNodeOptimizationResult {
  const glyphs = project.glyphs || {};
  const updatedGlyphs = { ...glyphs };

  const unicodes = targetUnicodes && targetUnicodes.length > 0
    ? targetUnicodes
    : Object.keys(glyphs).map((k) => Number(k)).filter((u) => !isNaN(u));

  let totalOriginal = 0;
  let totalOptimized = 0;
  let optimizedGlyphsCount = 0;
  let processedGlyphsCount = 0;

  const details: BatchNodeOptimizationResult['details'] = [];

  for (const unicode of unicodes) {
    const glyph = glyphs[unicode];
    if (!glyph || !glyph.contours || glyph.contours.length === 0) continue;

    processedGlyphsCount++;

    const res = optimizeContoursRedundantNodes(glyph.contours, {
      level: options?.level || 'normal',
      preserveSharpCorners: true,
      maxBboxDeviation: options?.maxBboxDeviation ?? 1.5,
      ...options,
    });

    totalOriginal += res.originalNodeCount;
    totalOptimized += res.optimizedNodeCount;

    if (res.changed && res.reducedCount > 0) {
      optimizedGlyphsCount++;
      updatedGlyphs[unicode] = {
        ...glyph,
        contours: res.contours,
      };
      details.push({
        unicode,
        char: glyph.char || String.fromCodePoint(unicode),
        originalNodes: res.originalNodeCount,
        optimizedNodes: res.optimizedNodeCount,
        reduced: res.reducedCount,
      });
    }
  }

  const totalReduced = Math.max(0, totalOriginal - totalOptimized);
  const reductionPercentage =
    totalOriginal > 0 ? Math.round((totalReduced / totalOriginal) * 100) : 0;

  return {
    updatedProject: {
      ...project,
      glyphs: updatedGlyphs,
      updatedAt: Date.now(),
    },
    processedGlyphsCount,
    optimizedGlyphsCount,
    totalOriginalNodes: totalOriginal,
    totalOptimizedNodes: totalOptimized,
    totalReducedNodes: totalReduced,
    reductionPercentage,
    details,
  };
}

/**
 * 2つの線分 (p1, p2) と (p3, p4) が交差するか判定し、交点を返す
 */
function getLineSegmentIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null {
  // バウンディングボックス判定（高速除外）
  if (
    Math.max(p1.x, p2.x) < Math.min(p3.x, p4.x) - 0.01 ||
    Math.min(p1.x, p2.x) > Math.max(p3.x, p4.x) + 0.01 ||
    Math.max(p1.y, p2.y) < Math.min(p3.y, p4.y) - 0.01 ||
    Math.min(p1.y, p2.y) > Math.max(p3.y, p4.y) + 0.01
  ) {
    return null;
  }

  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x;
  const dy2 = p4.y - p3.y;

  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-6) {
    // 平行または同一直線
    return null;
  }

  const s = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / denom;
  const t = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / denom;

  // 端点付近 (0.01 ~ 0.99) での交差のみを判定（接続端点を交差と誤認させないため）
  if (s > 0.02 && s < 0.98 && t > 0.02 && t < 0.98) {
    return {
      x: Math.round(p1.x + s * dx1),
      y: Math.round(p1.y + s * dy1),
    };
  }

  return null;
}

/**
 * 輪郭群のパス交差（自己交差および輪郭間交差）を検出
 */
function findContourIntersections(contours: PathContour[]): Point[] {
  const intersections: Point[] = [];
  if (!contours || contours.length === 0) return intersections;

  // 各輪郭のサンプリングされたポリラインセグメントを生成
  interface Segment {
    p1: Point;
    p2: Point;
    contourIdx: number;
    segIdx: number;
  }

  const allSegments: Segment[] = [];

  contours.forEach((contour, cIdx) => {
    if (!contour.nodes || contour.nodes.length < 2) return;
    // 適切な密度でサンプリング (ベジェ曲線部を考慮)
    const points = sampleContourPoints(contour, 6);
    if (points.length < 2) return;

    for (let i = 0; i < points.length - 1; i++) {
      allSegments.push({
        p1: points[i],
        p2: points[i + 1],
        contourIdx: cIdx,
        segIdx: i,
      });
    }

    // 閉じたパスなら末尾から先頭へのセグメントも追加
    if (contour.closed && points.length > 2) {
      allSegments.push({
        p1: points[points.length - 1],
        p2: points[0],
        contourIdx: cIdx,
        segIdx: points.length - 1,
      });
    }
  });

  const segCount = allSegments.length;
  // セグメント数が多すぎる場合は間引いて高負荷を回避
  const maxSegsToCheck = 400;
  const step = segCount > maxSegsToCheck ? Math.ceil(segCount / maxSegsToCheck) : 1;

  for (let i = 0; i < segCount; i += step) {
    const s1 = allSegments[i];
    for (let j = i + step; j < segCount; j += step) {
      const s2 = allSegments[j];

      // 同一輪郭で隣接するセグメントは端点を共有するため除外
      if (s1.contourIdx === s2.contourIdx) {
        const diff = Math.abs(s1.segIdx - s2.segIdx);
        if (diff <= 1) continue;
      }

      const pt = getLineSegmentIntersection(s1.p1, s1.p2, s2.p1, s2.p2);
      if (pt) {
        // 重複する交点を除外して登録 (半径 8px 以内)
        const isNearby = intersections.some(
          (existing) => Math.hypot(existing.x - pt.x, existing.y - pt.y) < 8
        );
        if (!isNearby) {
          intersections.push(pt);
          if (intersections.length >= 15) return intersections; // 上限
        }
      }
    }
  }

  return intersections;
}

/**
 * 輪郭群の幾何ハッシュ・シグネチャを計算（重複検知用）
 */
function getGlyphGeometrySignature(contours: PathContour[]): string {
  if (!contours || contours.length === 0) return '';
  const bbox = getContoursBoundingBox(contours);
  const totalNodes = contours.reduce((sum, c) => sum + (c.nodes ? c.nodes.length : 0), 0);

  // 幅・高さおよび相対位置のサンプリングによるシグネチャ
  const relativeSample: string[] = [];
  contours.forEach((c) => {
    (c.nodes || []).slice(0, 10).forEach((n) => {
      const rx = Math.round(n.x - bbox.minX);
      const ry = Math.round(n.y - bbox.minY);
      relativeSample.push(`${rx},${ry}`);
    });
  });

  return `${contours.length}_${totalNodes}_${Math.round(bbox.width)}x${Math.round(bbox.height)}_${relativeSample.slice(0, 8).join(';')}`;
}

/**
 * フォントプロジェクト全体の品質チェックを実行
 */
export function checkFontQuality(
  project: FontProject,
  options: QualityCheckOptions = {}
): FontQualityReport {
  const baselineY = options.baselineY ?? DEFAULT_BASELINE_Y;
  const maxNodesContour = options.maxNodesPerContour ?? DEFAULT_MAX_NODES_PER_CONTOUR;
  const maxNodesGlyph = options.maxNodesPerGlyph ?? DEFAULT_MAX_NODES_PER_GLYPH;
  const checkDuplicates = options.checkDuplicates ?? true;
  const checkIntersections = options.checkIntersections ?? true;

  const glyphs = (Object.values(project.glyphs || {}) as GlyphData[]).filter(
    (g) => g && typeof g.unicode === 'number'
  );

  const issues: QualityIssue[] = [];

  // ================= 1. 字形の重複チェック (Duplicate Glyph Shapes) =================
  if (checkDuplicates) {
    const signatureMap = new Map<string, GlyphData[]>();

    glyphs.forEach((g) => {
      if (!g.contours || g.contours.length === 0) return;
      // 孤立した空グリフは除外
      const hasRealNodes = g.contours.some((c) => c.nodes && c.nodes.length > 1);
      if (!hasRealNodes) return;

      const sig = getGlyphGeometrySignature(g.contours);
      if (!sig) return;

      if (!signatureMap.has(sig)) {
        signatureMap.set(sig, []);
      }
      signatureMap.get(sig)!.push(g);
    });

    const seenDupPairs = new Set<string>();

    signatureMap.forEach((group) => {
      if (group.length > 1) {
        for (let i = 0; i < group.length; i++) {
          const g1 = group[i];
          for (let j = i + 1; j < group.length; j++) {
            const g2 = group[j];
            const pairKey = [g1.unicode, g2.unicode].sort().join('-');
            if (seenDupPairs.has(pairKey)) continue;
            seenDupPairs.add(pairKey);

            // 二重チェック: 点座標が極めて高い一致度を持つか検証
            const b1 = getContoursBoundingBox(g1.contours);
            const b2 = getContoursBoundingBox(g2.contours);
            const dx = Math.abs(b1.width - b2.width);
            const dy = Math.abs(b1.height - b2.height);

            if (dx <= 4 && dy <= 4 && g1.contours.length === g2.contours.length) {
              issues.push({
                id: `dup-${g1.unicode}-${g2.unicode}`,
                unicode: g1.unicode,
                char: g1.char || String.fromCodePoint(g1.unicode),
                glyphName: g1.name || `uni${g1.unicode.toString(16).toUpperCase()}`,
                type: 'duplicate_shape',
                severity: 'warning',
                title: '字形の重複を検出',
                description: `文字「${g1.char}」(U+${g1.unicode.toString(16).toUpperCase()}) と文字「${g2.char}」(U+${g2.unicode.toString(16).toUpperCase()}) の輪郭形状が一致しています。重複登録や未編集のグリフでないか確認してください。`,
                recommendation: `別の文字からコピーされたままの場合は、文字「${g1.char}」または「${g2.char}」のグリフ固有の形状に編集してください。`,
                details: {
                  duplicateWithUnicode: g2.unicode,
                  duplicateWithChar: g2.char,
                },
                canAutoFix: false,
              });
            }
          }
        }
      }
    });
  }

  // ================= 各グリフの詳細検査 =================
  glyphs.forEach((g) => {
    const unicode = g.unicode;
    const char = g.char || (unicode ? String.fromCodePoint(unicode) : '');
    const glyphName = g.name || `uni${unicode.toString(16).toUpperCase()}`;
    const contours = g.contours || [];

    // 空グリフ（空白文字 U+0020 は除外）
    if (contours.length === 0) {
      if (unicode !== 0x0020 && unicode !== 0x3000) {
        issues.push({
          id: `empty-${unicode}`,
          unicode,
          char,
          glyphName,
          type: 'extreme_bounds',
          severity: 'info',
          title: '輪郭のない空グリフ',
          description: `グリフ「${char}」に輪郭パスが登録されていません。フォント出力時に空白文字として出力されます。`,
          recommendation: 'この文字を使用する場合はキャンバスで作図してください。',
          canAutoFix: false,
        });
      }
      return;
    }

    // 孤立ノード (1頂点のみの輪郭)
    const isolatedCount = contours.filter((c) => c.nodes && c.nodes.length === 1).length;
    if (isolatedCount > 0) {
      issues.push({
        id: `iso-${unicode}`,
        unicode,
        char,
        glyphName,
        type: 'isolated_node',
        severity: 'warning',
        title: '孤立ノード（単一頂点）を検出',
        description: `輪郭パスの中に頂点が1つだけの孤立要素が ${isolatedCount} 箇所あります。閉じた面として描画されず、フォント規格違反の原因となります。`,
        recommendation: '「自動修正」をクリックして無効な孤立ノードを除去してください。',
        canAutoFix: true,
        autoFixType: 'remove_isolated',
      });
    }

    // ================= 2. 過剰なノード数チェック (Excessive Nodes) =================
    let totalNodes = 0;
    let maxContourNodes = 0;

    contours.forEach((c) => {
      const count = c.nodes ? c.nodes.length : 0;
      totalNodes += count;
      if (count > maxContourNodes) {
        maxContourNodes = count;
      }
    });

    if (totalNodes > maxNodesGlyph || maxContourNodes > maxNodesContour) {
      const isSevere = totalNodes > maxNodesGlyph * 1.8 || maxContourNodes > maxNodesContour * 1.8;
      const densityAnalysis = analyzeGlyphContourDensity(contours, unicode, char);
      issues.push({
        id: `nodes-${unicode}`,
        unicode,
        char,
        glyphName,
        type: 'excessive_nodes',
        severity: isSevere ? 'error' : 'warning',
        title: isSevere ? 'ノード数が極度に過剰' : 'ノード数が過剰',
        description: `総ノード数が ${totalNodes} 個（推奨: ${maxNodesGlyph}個以下）、単一輪郭の最大ノード数が ${maxContourNodes} 個（推奨: ${maxNodesContour}個以下）です。手書きストロークの微小な頂点密集によりフォント容量が肥大化し、表示レンダリングが遅くなる原因になります。`,
        recommendation: '「ヒートマップ診断」で過密箇所を確認してクリック単純化するか、「自動修正」で形状を保護したまま最適化してください。',
        details: {
          nodeCount: totalNodes,
          maxContourNodes,
          densityAnalysis,
        },
        canAutoFix: true,
        autoFixType: 'simplify_nodes',
      });
    }

    // ================= 3. パスの交差チェック (Path Intersections) =================
    if (checkIntersections && contours.length > 0) {
      const intersectionPts = findContourIntersections(contours);
      if (intersectionPts.length > 0) {
        issues.push({
          id: `intersect-${unicode}`,
          unicode,
          char,
          glyphName,
          type: 'path_intersection',
          severity: 'warning',
          title: '一筆書き交差・ストローク重なり（白抜きリスク）',
          description: `輪郭の線分同士が交差している箇所が ${intersectionPts.length} 箇所あります。一筆書きのループや画線の交差部分は、描画環境やフォント出力時に重なりが白抜け（中抜き）する原因となります。「白抜き解消」を実行すると、形状を維持したまま交差・重なりをブーリアン結合して白抜きを防止できます。`,
          recommendation: '「自動修正」を実行すると、一筆書きの自己交差や重なり部分を自動結合して白抜きを防止します。',
          details: {
            intersectionCount: intersectionPts.length,
            intersectionPoints: intersectionPts,
          },
          canAutoFix: true,
          autoFixType: 'merge_intersection',
        });
      }
    }

    // ================= 4. ベースライン逸脱チェック (Baseline Deviation) =================
    const bbox = getContoursBoundingBox(contours);
    if (bbox.width > 0 && bbox.height > 0) {
      const isAscii = unicode >= 0x0020 && unicode <= 0x007e;
      const isDescenderChar = LATIN_DESCENDERS.has(char);
      const isSmallKana = SMALL_KANA_CODES.has(unicode);
      const isExcludedFloat = EXCLUDED_BASELINE_FLOAT_CODES.has(unicode);
      const isFullwidth =
        (unicode >= 0x4e00 && unicode <= 0x9fff) ||
        (unicode >= 0x3040 && unicode <= 0x30ff) ||
        (unicode >= 0x3400 && unicode <= 0x4dbf);

      // 上端のはみ出し (仮想ボディ上限 Y=0 を大きく超える)
      if (bbox.minY < -40) {
        issues.push({
          id: `bound-top-${unicode}`,
          unicode,
          char,
          glyphName,
          type: 'baseline_deviation',
          severity: 'warning',
          title: '仮想ボディ上端（アセンダ）はみ出し',
          description: `輪郭の上端 (Y=${Math.round(bbox.minY)}) が em-box 上限 (Y=0) を超えています。複数行組版で行間クリッピングが発生します。`,
          recommendation: 'メトリクスパネルで高さを縮小するか、ベースラインへ収まるよう下へ移動してください。',
          details: {
            currentBaselineY: Math.round(bbox.maxY),
            targetBaselineY: baselineY,
            deviationPx: Math.round(-bbox.minY),
            deviationType: 'overflow_top',
          },
          canAutoFix: true,
          autoFixType: 'align_baseline',
        });
      }

      // 下端のはみ出し (em-box 下限 Y=1000 を超える)
      if (bbox.maxY > 1030) {
        issues.push({
          id: `bound-btm-${unicode}`,
          unicode,
          char,
          glyphName,
          type: 'baseline_deviation',
          severity: 'warning',
          title: '仮想ボディ下端（ディセンダ）はみ出し',
          description: `輪郭の下端 (Y=${Math.round(bbox.maxY)}) がフォント枠の床面 (Y=1000) を超えています。`,
          recommendation: 'ベースラインに合わせて文字全体を上に引き上げてください。',
          details: {
            currentBaselineY: Math.round(bbox.maxY),
            targetBaselineY: baselineY,
            deviationPx: Math.round(bbox.maxY - 1000),
            deviationType: 'overflow_bottom',
          },
          canAutoFix: true,
          autoFixType: 'align_baseline',
        });
      }

      // 和文漢字・かな（小書き・約物・記号除く）のベースライン浮遊または沈み
      if (isFullwidth && !isSmallKana && !isExcludedFloat && bbox.height > 120) {
        // 和文の標準下端目安: 760 ~ 850
        if (bbox.maxY < 680) {
          issues.push({
            id: `base-float-${unicode}`,
            unicode,
            char,
            glyphName,
            type: 'baseline_deviation',
            severity: 'warning',
            title: '文字がベースラインから浮いています',
            description: `文字「${char}」の下端が Y=${Math.round(bbox.maxY)} の位置にあり、基準下端（標準目安: 780〜840）より上方に配置されています。`,
            recommendation: '「自動整列」でベースライン基準位置に移動するか、キャンバスで配置を調整してください。',
            details: {
              currentBaselineY: Math.round(bbox.maxY),
              targetBaselineY: baselineY,
              deviationPx: Math.round(baselineY - bbox.maxY),
              deviationType: 'floating',
            },
            canAutoFix: true,
            autoFixType: 'align_baseline',
          });
        } else if (bbox.maxY > 920) {
          issues.push({
            id: `base-drop-${unicode}`,
            unicode,
            char,
            glyphName,
            type: 'baseline_deviation',
            severity: 'warning',
            title: '文字がベースラインを過度に下回っています',
            description: `文字「${char}」の下端が Y=${Math.round(bbox.maxY)} とベースライン (Y=${baselineY}) を深く突き抜けています。`,
            recommendation: '「自動整列」でベースライン位置に下端を合わせるか、全体を上に移動してください。',
            details: {
              currentBaselineY: Math.round(bbox.maxY),
              targetBaselineY: baselineY,
              deviationPx: Math.round(bbox.maxY - baselineY),
              deviationType: 'dropped',
            },
            canAutoFix: true,
            autoFixType: 'align_baseline',
          });
        }
      }

      // 欧文アルファベットのベースライン検査
      if (isAscii && char.match(/[a-zA-Z0-9]/)) {
        if (isDescenderChar) {
          // ディセンダ付き文字 (g, p, yなど) は baselineY (800) より下に来るのが正常
          if (bbox.maxY < 760) {
            issues.push({
              id: `base-desc-float-${unicode}`,
              unicode,
              char,
              glyphName,
              type: 'baseline_deviation',
              severity: 'warning',
              title: 'ディセンダ（降下部分）の不足',
              description: `欧文文字「${char}」はディセンダ（下向きの突き出し）を持つべき文字ですが、下端が Y=${Math.round(bbox.maxY)} とベースラインより上に浮いています。`,
              recommendation: 'ベースライン (Y=${baselineY}) を適度に下回るように作図してください。',
              details: {
                currentBaselineY: Math.round(bbox.maxY),
                targetBaselineY: 920,
                deviationPx: Math.round(920 - bbox.maxY),
                deviationType: 'floating',
              },
              canAutoFix: false,
            });
          }
        } else {
          // ディセンダを持たない文字 (A-Z, b, d, f, h, k, l, etc.)
          if (bbox.maxY < 680) {
            issues.push({
              id: `base-latin-float-${unicode}`,
              unicode,
              char,
              glyphName,
              type: 'baseline_deviation',
              severity: 'warning',
              title: '欧文文字のベースライン浮遊',
              description: `欧文文字「${char}」の下端 (Y=${Math.round(bbox.maxY)}) がベースライン (Y=${baselineY}) から大きく浮いています。`,
              recommendation: '「自動整列」で下端をベースライン Y=${baselineY} に設置してください。',
              details: {
                currentBaselineY: Math.round(bbox.maxY),
                targetBaselineY: baselineY,
                deviationPx: Math.round(baselineY - bbox.maxY),
                deviationType: 'floating',
              },
              canAutoFix: true,
              autoFixType: 'align_baseline',
            });
          } else if (bbox.maxY > 870) {
            issues.push({
              id: `base-latin-drop-${unicode}`,
              unicode,
              char,
              glyphName,
              type: 'baseline_deviation',
              severity: 'warning',
              title: '欧文文字の不適切なベースライン突破',
              description: `文字「${char}」はディセンダを持たない文字ですが、下端が Y=${Math.round(bbox.maxY)} とベースライン (Y=${baselineY}) より沈んでいます。`,
              recommendation: '「自動整列」で下端をベースラインに合わせてください。',
              details: {
                currentBaselineY: Math.round(bbox.maxY),
                targetBaselineY: baselineY,
                deviationPx: Math.round(bbox.maxY - baselineY),
                deviationType: 'dropped',
              },
              canAutoFix: true,
              autoFixType: 'align_baseline',
            });
          }
        }
      }

      // ================= 5. 線幅の偏り・かすれ・潰れチェック (Uneven Stroke Widths) =================
      const strokeAnalysis = analyzeGlyphStrokeWidths(contours);
      if (strokeAnalysis.sampleCount >= 4) {
        if (strokeAnalysis.isExcessivelyThin || strokeAnalysis.isExcessivelyThick || strokeAnalysis.hasInconsistency) {
          let title = 'ストローク線幅の不均一';
          let desc = `線幅の測定値: 最小 ${strokeAnalysis.minWidth}px / 最大 ${strokeAnalysis.maxWidth}px (中央値 ${strokeAnalysis.medianWidth}px)。`;
          let severity: QualitySeverity = 'info';

          if (strokeAnalysis.isExcessivelyThin) {
            title = '線幅のかすれ（細線）を検出';
            desc = `文字「${char}」の最小線幅が ${strokeAnalysis.minWidth}px です（中央値: ${strokeAnalysis.medianWidth}px）。印刷や画面表示時にかすれや線の欠落が発生します。`;
            severity = 'warning';
          } else if (strokeAnalysis.isExcessivelyThick) {
            title = '線幅の太まり（線の潰れ）を検出';
            desc = `文字「${char}」の最大線幅が ${strokeAnalysis.maxWidth}px です（中央値: ${strokeAnalysis.medianWidth}px）。交差部や画数の密集部が黒く潰れます。`;
            severity = 'warning';
          } else {
            desc += '文字内での線の太さの差が大きく、線幅が不均一です。';
          }

          issues.push({
            id: `stroke-${unicode}`,
            unicode,
            char,
            glyphName,
            type: 'uneven_stroke',
            severity,
            title,
            description: desc,
            recommendation: '「ストローク均一化」を実行して、細い箇所の補強と太い箇所の線幅調整を行います。',
            details: {
              minStrokeWidth: strokeAnalysis.minWidth,
              maxStrokeWidth: strokeAnalysis.maxWidth,
              medianStrokeWidth: strokeAnalysis.medianWidth,
              avgStrokeWidth: strokeAnalysis.avgWidth,
              stdDevStrokeWidth: strokeAnalysis.stdDev,
              thinPoints: strokeAnalysis.thinPoints,
              thickPoints: strokeAnalysis.thickPoints,
            },
            canAutoFix: true,
            autoFixType: 'equalize_strokes',
          });
        }
      }

      // 6. ベジェ曲線の極点（Extrema）チェック
      const extremaAnalysis = analyzeGlyphExtrema(contours, 6);
      if (extremaAnalysis.missingExtremaCount > 0) {
        issues.push({
          id: `extrema-${unicode}`,
          unicode,
          char,
          glyphName,
          type: 'missing_extrema',
          severity: 'info',
          title: 'ベジェ曲線の極点ノード不足',
          description: `輪郭のベジェ曲線上に、水平または垂直の極点（曲線の最外端・方向転換点）となるノードが ${extremaAnalysis.missingExtremaCount} 箇所不足しています。極点にノードを配置することで、TrueType/OpenType規格に準拠し、フォント出力時のヒンティング精度やラスタライズ表示が数学的に最適化されます。`,
          recommendation: '「極点最適化」を実行して、ベジェ曲線の形状を保ったまま極点へノードを自動配置・軸整列します。',
          details: {
            missingExtremaCount: extremaAnalysis.missingExtremaCount,
            extremaPoints: extremaAnalysis.extremaPoints.map((p) => ({ x: p.x, y: p.y })),
          },
          canAutoFix: true,
          autoFixType: 'optimize_extrema',
        });
      }
    }
  });

  // カテゴリごとの集計
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  const categoryCounts = {
    duplicate_shape: 0,
    path_intersection: 0,
    excessive_nodes: 0,
    baseline_deviation: 0,
    uneven_stroke: 0,
    missing_extrema: 0,
    other: 0,
  };

  issues.forEach((iss) => {
    if (iss.severity === 'error') errorCount++;
    else if (iss.severity === 'warning') warningCount++;
    else infoCount++;

    if (iss.type in categoryCounts) {
      categoryCounts[iss.type as keyof typeof categoryCounts]++;
    } else {
      categoryCounts.other++;
    }
  });

  // 品質スコア計算 (100点満点)
  const totalGlyphsChecked = glyphs.length;
  let score = 100;
  if (totalGlyphsChecked > 0) {
    const penalty = (errorCount * 12 + warningCount * 4 + infoCount * 1) / Math.max(1, totalGlyphsChecked * 0.4);
    score = Math.max(20, Math.round(100 - penalty));
  }

  return {
    timestamp: Date.now(),
    totalGlyphsChecked,
    totalIssues: issues.length,
    errorCount,
    warningCount,
    infoCount,
    score,
    categoryCounts,
    issues,
  };
}

/**
 * 単一の品質問題を自動修正
 */
export function fixQualityIssue(
  project: FontProject,
  issue: QualityIssue
): { updatedProject: FontProject; success: boolean; message: string } {
  const glyph = project.glyphs?.[issue.unicode];
  if (!glyph || !glyph.contours || glyph.contours.length === 0) {
    return { updatedProject: project, success: false, message: '対象グリフが存在しません' };
  }

  const updatedGlyphs = { ...project.glyphs };
  let newContours: PathContour[] = [...glyph.contours];

  let successMessage = `文字「${issue.char}」の「${issue.title}」を安全に修正しました`;

  switch (issue.autoFixType) {
    case 'remove_isolated': {
      newContours = newContours.filter((c) => c.nodes && c.nodes.length > 1);
      successMessage = `文字「${issue.char}」の無効な孤立頂点を安全に除去しました`;
      break;
    }

    case 'simplify_nodes': {
      // 文字の形・角・筆先・曲率を崩さない厳格な保護型最適化
      newContours = safePreservingNodeOptimization(newContours);
      successMessage = `文字「${issue.char}」の形状を崩さずに、過剰ノードを安全に最適化しました`;
      break;
    }

    case 'align_baseline': {
      const bbox = getContoursBoundingBox(newContours);
      const targetBaselineY = issue.details?.targetBaselineY ?? DEFAULT_BASELINE_Y;
      const currentBottom = bbox.maxY;
      let deltaY = targetBaselineY - currentBottom;

      // 文字の形・縦横比を一切変えず、位置のみを平行移動
      // 仮想ボディの上端 (Y=30) を突き抜けてクリッピングされないよう安全リミット
      if (bbox.minY + deltaY < 30) {
        deltaY = 30 - bbox.minY;
      }
      // 仮想ボディの下端 (Y=970) を突き抜けないよう安全リミット
      if (bbox.maxY + deltaY > 970) {
        deltaY = 970 - bbox.maxY;
      }

      // 微小な差 (<= 2px) の場合は形を最優先して移動しない
      if (Math.abs(deltaY) <= 2) {
        return {
          updatedProject: project,
          success: true,
          message: `文字「${issue.char}」は許容範囲内のため位置を維持しました`,
        };
      }

      newContours = newContours.map((c) => ({
        ...c,
        nodes: c.nodes.map((n) => ({
          ...n,
          y: Math.round(n.y + deltaY),
          handleIn: n.handleIn ? { ...n.handleIn, y: Math.round(n.handleIn.y + deltaY) } : null,
          handleOut: n.handleOut ? { ...n.handleOut, y: Math.round(n.handleOut.y + deltaY) } : null,
        })),
      }));
      successMessage = `文字「${issue.char}」の形状を維持したまま、ベースライン位置へ平行移動しました`;
      break;
    }

    case 'merge_intersection': {
      newContours = resolveContourOverlaps(newContours);
      successMessage = `文字「${issue.char}」の一筆書き交差・重なり部分を自動結合し、白抜きを解消しました`;
      break;
    }

    case 'equalize_strokes': {
      const eqResult = equalizeContoursStrokeWidth(newContours, {
        mode: 'balanced',
        strength: 0.65,
        preserveSharpCorners: true,
      });
      newContours = eqResult.contours;
      successMessage = `文字「${issue.char}」のストローク線幅を均一化しました (補強: ${eqResult.thinFixedCount}箇所, 調整: ${eqResult.thickFixedCount}箇所)`;
      break;
    }

    case 'optimize_extrema': {
      const extResult = optimizeContoursExtrema(newContours, {
        alignHandlesToAxis: true,
        minDistanceThreshold: 5,
      });
      newContours = extResult.contours;
      successMessage = `文字「${issue.char}」のベジェ曲線極点にノードを ${extResult.addedNodesCount} 箇所追加し、軸整列を完了しました`;
      break;
    }

    default:
      return { updatedProject: project, success: false, message: 'この問題の自動修正には対応していません' };
  }

  updatedGlyphs[issue.unicode] = {
    ...glyph,
    contours: newContours,
  };

  return {
    updatedProject: {
      ...project,
      glyphs: updatedGlyphs,
      updatedAt: Date.now(),
    },
    success: true,
    message: successMessage,
  };
}

export interface BatchStrokeEqualizationDetail {
  unicode: number;
  char: string;
  originalMin: number;
  originalMax: number;
  newMin: number;
  newMax: number;
  thinFixed: number;
  thickFixed: number;
}

export interface BatchStrokeEqualizationResult {
  updatedProject: FontProject;
  processedGlyphsCount: number;
  equalizedGlyphsCount: number;
  totalThinFixed: number;
  totalThickFixed: number;
  details: BatchStrokeEqualizationDetail[];
}

/**
 * プロジェクト全体または指定文字群のストローク線幅を一括均一化
 */
export function batchEqualizeProjectStrokes(
  project: FontProject,
  targetUnicodes?: number[],
  options?: StrokeEqualizationOptions
): BatchStrokeEqualizationResult {
  if (!project.glyphs) {
    return {
      updatedProject: project,
      processedGlyphsCount: 0,
      equalizedGlyphsCount: 0,
      totalThinFixed: 0,
      totalThickFixed: 0,
      details: [],
    };
  }

  const updatedGlyphs = { ...project.glyphs };
  let processedCount = 0;
  let equalizedCount = 0;
  let totalThin = 0;
  let totalThick = 0;
  const details: BatchStrokeEqualizationDetail[] = [];

  const targetSet = targetUnicodes ? new Set(targetUnicodes) : null;

  Object.entries(project.glyphs).forEach(([key, glyph]) => {
    const unicode = Number(key);
    if (targetSet && !targetSet.has(unicode)) return;
    if (!glyph || !glyph.contours || glyph.contours.length === 0) return;

    processedCount++;
    const res = equalizeContoursStrokeWidth(glyph.contours, options);

    if (res.adjusted) {
      equalizedCount++;
      totalThin += res.thinFixedCount;
      totalThick += res.thickFixedCount;
      updatedGlyphs[unicode] = {
        ...glyph,
        contours: res.contours,
      };

      details.push({
        unicode,
        char: glyph.char || String.fromCodePoint(unicode),
        originalMin: res.originalAnalysis.minWidth,
        originalMax: res.originalAnalysis.maxWidth,
        newMin: res.newAnalysis.minWidth,
        newMax: res.newAnalysis.maxWidth,
        thinFixed: res.thinFixedCount,
        thickFixed: res.thickFixedCount,
      });
    }
  });

  return {
    updatedProject: {
      ...project,
      glyphs: updatedGlyphs,
      updatedAt: Date.now(),
    },
    processedGlyphsCount: processedCount,
    equalizedGlyphsCount: equalizedCount,
    totalThinFixed: totalThin,
    totalThickFixed: totalThick,
    details,
  };
}

/**
 * 複数・全項目の自動一括修正
 */
export function batchFixQualityIssues(
  project: FontProject,
  issues: QualityIssue[],
  filterType?: QualityIssueType
): { updatedProject: FontProject; fixedCount: number } {
  let currentProject = project;
  let fixedCount = 0;

  const targetIssues = filterType
    ? issues.filter((iss) => iss.type === filterType && iss.canAutoFix)
    : issues.filter((iss) => iss.canAutoFix);

  // 同一ユニコードを重複修正しないよう整理
  const seenUnicodes = new Set<number>();

  for (const iss of targetIssues) {
    if (seenUnicodes.has(iss.unicode)) continue;
    seenUnicodes.add(iss.unicode);

    const res = fixQualityIssue(currentProject, iss);
    if (res.success) {
      currentProject = res.updatedProject;
      fixedCount++;
    }
  }

  return {
    updatedProject: currentProject,
    fixedCount,
  };
}

export interface BatchExtremaOptimizationDetail {
  unicode: number;
  char: string;
  missingBefore: number;
  missingAfter: number;
  nodesAdded: number;
}

export interface BatchExtremaOptimizationResult {
  updatedProject: FontProject;
  processedGlyphsCount: number;
  optimizedGlyphsCount: number;
  totalNodesAdded: number;
  details: BatchExtremaOptimizationDetail[];
}

/**
 * プロジェクト全体または指定文字群のベジェ曲線極点を一括最適化
 */
export function batchOptimizeProjectExtrema(
  project: FontProject,
  targetUnicodes?: number[],
  options?: ExtremaOptimizationOptions
): BatchExtremaOptimizationResult {
  if (!project.glyphs) {
    return {
      updatedProject: project,
      processedGlyphsCount: 0,
      optimizedGlyphsCount: 0,
      totalNodesAdded: 0,
      details: [],
    };
  }

  const updatedGlyphs = { ...project.glyphs };
  let processedCount = 0;
  let optimizedCount = 0;
  let totalAdded = 0;
  const details: BatchExtremaOptimizationDetail[] = [];

  const targetSet = targetUnicodes ? new Set(targetUnicodes) : null;

  Object.entries(project.glyphs).forEach(([key, glyph]) => {
    const unicode = Number(key);
    if (targetSet && !targetSet.has(unicode)) return;
    if (!glyph || !glyph.contours || glyph.contours.length === 0) return;

    processedCount++;
    const res = optimizeContoursExtrema(glyph.contours, options);

    if (res.adjusted && res.addedNodesCount > 0) {
      optimizedCount++;
      totalAdded += res.addedNodesCount;
      updatedGlyphs[unicode] = {
        ...glyph,
        contours: res.contours,
      };

      details.push({
        unicode,
        char: glyph.char || String.fromCodePoint(unicode),
        missingBefore: res.originalAnalysis.missingExtremaCount,
        missingAfter: res.newAnalysis.missingExtremaCount,
        nodesAdded: res.addedNodesCount,
      });
    }
  });

  return {
    updatedProject: {
      ...project,
      glyphs: updatedGlyphs,
      updatedAt: Date.now(),
    },
    processedGlyphsCount: processedCount,
    optimizedGlyphsCount: optimizedCount,
    totalNodesAdded: totalAdded,
    details,
  };
}

export interface BatchResolveIntersectionsResult {
  updatedProject: FontProject;
  processedGlyphsCount: number;
  resolvedGlyphsCount: number;
}

/**
 * プロジェクト全体または指定文字群の一筆書き交差・重なり白抜きを一括解消
 */
export function batchResolveProjectIntersections(
  project: FontProject,
  targetUnicodes?: number[]
): BatchResolveIntersectionsResult {
  if (!project.glyphs) {
    return {
      updatedProject: project,
      processedGlyphsCount: 0,
      resolvedGlyphsCount: 0,
    };
  }

  const updatedGlyphs = { ...project.glyphs };
  let processedCount = 0;
  let resolvedCount = 0;
  const targetSet = targetUnicodes ? new Set(targetUnicodes) : null;

  Object.entries(project.glyphs).forEach(([key, glyph]) => {
    const unicode = Number(key);
    if (targetSet && !targetSet.has(unicode)) return;
    if (!glyph || !glyph.contours || glyph.contours.length === 0) return;

    processedCount++;
    const intersections = findContourIntersections(glyph.contours);
    if (intersections.length > 0) {
      const resolved = resolveContourOverlaps(glyph.contours);
      if (resolved && resolved.length > 0) {
        resolvedCount++;
        updatedGlyphs[unicode] = {
          ...glyph,
          contours: resolved,
        };
      }
    }
  });

  return {
    updatedProject: {
      ...project,
      glyphs: updatedGlyphs,
      updatedAt: Date.now(),
    },
    processedGlyphsCount: processedCount,
    resolvedGlyphsCount: resolvedCount,
  };
}

