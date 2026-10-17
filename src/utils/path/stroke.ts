import {
  BezierNode,
  PathContour,
  Point,
  StrokePoint,
  BrushStyle,
  PressureCurveConfig,
  UserPenPreset,
} from "../../types";
import { rdpSimplify, pointsToBezierContourNodes } from "../imageVectorizer";
import { generateId } from "./id";
import { solveCubicBezierYForX, evaluatePressureCurve } from "./pressure";
import { contoursToSvgPath } from "./svg";
import {
  getContoursBoundingBox,
  getContourSignedArea,
  reverseContour,
  normalizeGlyphContoursWinding,
  sampleContourPoints,
} from "./bounds";
import { transformContours } from "./transform";

export function simplifyPointsRDP(points: Point[], epsilon: number = 4): Point[] {
  const n = points.length;
  if (n <= 2) return points;

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const stack: number[] = [0, n - 1];
  const epsilonSq = epsilon * epsilon;

  while (stack.length > 0) {
    const end = stack.pop()!;
    const start = stack.pop()!;

    let maxDistSq = 0;
    let maxIdx = start;

    const pStart = points[start];
    const pEnd = points[end];
    const dx = pEnd.x - pStart.x;
    const dy = pEnd.y - pStart.y;
    const lineLenSq = dx * dx + dy * dy;

    for (let i = start + 1; i < end; i++) {
      const pt = points[i];
      let distSq = 0;
      if (lineLenSq === 0) {
        const ddx = pt.x - pStart.x;
        const ddy = pt.y - pStart.y;
        distSq = ddx * ddx + ddy * ddy;
      } else {
        const t = Math.max(0, Math.min(1, ((pt.x - pStart.x) * dx + (pt.y - pStart.y) * dy) / lineLenSq));
        const projX = pStart.x + t * dx;
        const projY = pStart.y + t * dy;
        const ddx = pt.x - projX;
        const ddy = pt.y - projY;
        distSq = ddx * ddx + ddy * ddy;
      }

      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        maxIdx = i;
      }
    }

    if (maxDistSq > epsilonSq) {
      keep[maxIdx] = 1;
      if (maxIdx - start > 1) {
        stack.push(start, maxIdx);
      }
      if (end - maxIdx > 1) {
        stack.push(maxIdx, end);
      }
    }
  }

  const result: Point[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) result.push(points[i]);
  }
  return result;
}

/**
 * Simplify a PathContour's nodes using Ramer-Douglas-Peucker algorithm while preserving shape
 */
export function simplifyContour(contour: PathContour, tolerance: number = 6): PathContour {
  if (!contour.nodes || contour.nodes.length <= 4) return contour;

  const pts: Point[] = contour.nodes.map((n) => ({ x: n.x, y: n.y }));
  
  let simplifiedPts: Point[];
  if (contour.closed) {
    // For closed loops, split at midpoint and simplify both halves to prevent collapsing
    const mid = Math.floor(pts.length / 2);
    const half1 = simplifyPointsRDP(pts.slice(0, mid + 1), tolerance);
    const half2 = simplifyPointsRDP([...pts.slice(mid), pts[0]], tolerance);
    simplifiedPts = [...half1.slice(0, -1), ...half2.slice(0, -1)];
  } else {
    simplifiedPts = simplifyPointsRDP(pts, tolerance);
  }

  if (simplifiedPts.length < 3 && contour.closed) {
    return contour; // Keep original if oversimplified
  }

  // Re-generate smooth bezier handles
  const newNodes: BezierNode[] = simplifiedPts.map((p) => ({
    id: generateId(),
    x: Math.round(p.x),
    y: Math.round(p.y),
    type: 'smooth',
  }));

  const total = newNodes.length;
  for (let i = 0; i < total; i++) {
    const prev = newNodes[(i - 1 + total) % total];
    const curr = newNodes[i];
    const next = newNodes[(i + 1) % total];

    const dPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const dNext = Math.hypot(next.x - curr.x, next.y - curr.y);

    if (dPrev < 0.1 || dNext < 0.1) {
      curr.handleIn = { x: curr.x, y: curr.y };
      curr.handleOut = { x: curr.x, y: curr.y };
      continue;
    }

    const uPrevX = (curr.x - prev.x) / dPrev;
    const uPrevY = (curr.y - prev.y) / dPrev;
    const uNextX = (next.x - curr.x) / dNext;
    const uNextY = (next.y - curr.y) / dNext;

    const dot = uPrevX * uNextX + uPrevY * uNextY;
    const cosAngle = Math.max(-1, Math.min(1, dot));

    // Corner preservation (転折・角部分の自然な直線・角ノード処理)
    if (cosAngle < 0.76) {
      curr.type = 'corner';
      const inL = Math.min(dPrev * 0.25, 30);
      const outL = Math.min(dNext * 0.25, 30);
      curr.handleIn = {
        x: Math.round(curr.x - uPrevX * inL),
        y: Math.round(curr.y - uPrevY * inL),
      };
      curr.handleOut = {
        x: Math.round(curr.x + uNextX * outL),
        y: Math.round(curr.y + uNextY * outL),
      };
      continue;
    }

    let tanX = uPrevX + uNextX;
    let tanY = uPrevY + uNextY;
    let tanLen = Math.hypot(tanX, tanY) || 1;
    tanX /= tanLen;
    tanY /= tanLen;

    const cornerDamping = Math.max(0.04, Math.pow((1 + cosAngle) * 0.5, 0.65));
    const hInLen = Math.min(dPrev * 0.35 * cornerDamping, 80);
    const hOutLen = Math.min(dNext * 0.35 * cornerDamping, 80);

    curr.handleIn = { x: Math.round(curr.x - tanX * hInLen), y: Math.round(curr.y - tanY * hInLen) };
    curr.handleOut = { x: Math.round(curr.x + tanX * hOutLen), y: Math.round(curr.y + tanY * hOutLen) };
  }

  return {
    ...contour,
    nodes: newNodes,
  };
}

/**
 * Options for shape-preserving stroke smoothing and anchor point reduction
 */
export interface SmoothStrokeOptions {
  /** Maximum error tolerance in units (default: 5.5). Higher = fewer anchor points, smoother curve. */
  tolerance?: number;
  /** Angle threshold in degrees above which a corner is preserved as sharp (default: 52°). */
  cornerAngleDeg?: number;
  /** Smoothing preset level */
  level?: 'mild' | 'standard' | 'strong';
  /** Whether to detect and preserve intentional sharp corners and stroke tips */
  preserveCorners?: boolean;
}

export interface SmoothStrokeResult {
  contour: PathContour;
  originalPoints: number;
  reducedPoints: number;
  reductionPercent: number;
}

/**
 * Sample dense points along a cubic Bézier curve segment
 */

export function smoothStrokeContour(
  contour: PathContour,
  options: SmoothStrokeOptions = {}
): SmoothStrokeResult {
  const originalPoints = contour.nodes?.length || 0;
  if (!contour.nodes || originalPoints <= 3) {
    return {
      contour,
      originalPoints,
      reducedPoints: originalPoints,
      reductionPercent: 0,
    };
  }

  let tol = options.tolerance ?? 2.4;
  if (options.level === 'mild') tol = 1.2;
  else if (options.level === 'standard') tol = 2.4;
  else if (options.level === 'strong') tol = 4.8;

  const cornerAngleDeg = options.cornerAngleDeg ?? 52;
  const cornerRadThreshold = (cornerAngleDeg * Math.PI) / 180;
  const preserveCorners = options.preserveCorners ?? true;

  // 1. Sample dense polyline representation along the original contour
  const densePts = sampleContourPoints(contour, 10);
  if (densePts.length < 4) {
    return {
      contour,
      originalPoints,
      reducedPoints: originalPoints,
      reductionPercent: 0,
    };
  }

  // 2. Detect critical corner / inflection / cusp vertices that define the silhouette
  const numPts = densePts.length;
  const isCorner: boolean[] = new Array(numPts).fill(false);

  if (preserveCorners && numPts >= 8) {
    // Adaptive stride: ensure sampling arm length is at least ~6px in canvas space so micro-noise is not mistaken for a corner
    const stride = Math.max(3, Math.min(8, Math.floor(numPts / 20)));
    for (let i = 0; i < numPts; i++) {
      if (!contour.closed && (i < stride || i >= numPts - stride)) {
        if (i === 0 || i === numPts - 1) isCorner[i] = true;
        continue;
      }

      const prevIdx = (i - stride + numPts) % numPts;
      const nextIdx = (i + stride) % numPts;

      const pPrev = densePts[prevIdx];
      const pCurr = densePts[i];
      const pNext = densePts[nextIdx];

      const v1x = pCurr.x - pPrev.x;
      const v1y = pCurr.y - pPrev.y;
      const v2x = pNext.x - pCurr.x;
      const v2y = pNext.y - pCurr.y;

      const len1 = Math.hypot(v1x, v1y);
      const len2 = Math.hypot(v2x, v2y);

      // Require minimum physical arm length of 4px to avoid false corner triggers on sub-pixel noise
      if (len1 >= 4.0 && len2 >= 4.0) {
        const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
        const clampedDot = Math.max(-1, Math.min(1, dot));
        const angleTurn = Math.acos(clampedDot);

        if (angleTurn >= cornerRadThreshold) {
          isCorner[i] = true;
        }
      }
    }
  }

  // 3. Segment the path into smooth sections between identified corners
  const cornerIndices: number[] = [];
  for (let i = 0; i < numPts; i++) {
    if (isCorner[i]) {
      // Suppress nearby redundant corner detections within 4 points
      if (
        cornerIndices.length === 0 ||
        i - cornerIndices[cornerIndices.length - 1] > 3
      ) {
        cornerIndices.push(i);
      }
    }
  }

  let finalSimplifiedPoints: { point: Point; isCorner: boolean }[] = [];

  if (cornerIndices.length === 0) {
    // Single smooth closed loop or open path
    if (contour.closed) {
      const mid = Math.floor(densePts.length / 2);
      const part1 = simplifyPointsRDP(densePts.slice(0, mid + 1), tol);
      const part2 = simplifyPointsRDP([...densePts.slice(mid), densePts[0]], tol);
      const combined = [...part1.slice(0, -1), ...part2.slice(0, -1)];
      finalSimplifiedPoints = combined.map((p) => ({ point: p, isCorner: false }));
    } else {
      const simp = simplifyPointsRDP(densePts, tol);
      finalSimplifiedPoints = simp.map((p, idx) => ({
        point: p,
        isCorner: idx === 0 || idx === simp.length - 1,
      }));
    }
  } else {
    // Process section by section between corners to preserve sharp turns
    const sections: Point[][] = [];
    if (!contour.closed) {
      const allIdx = [0, ...cornerIndices.filter((idx) => idx !== 0 && idx !== numPts - 1), numPts - 1];
      for (let s = 0; s < allIdx.length - 1; s++) {
        const start = allIdx[s];
        const end = allIdx[s + 1];
        sections.push(densePts.slice(start, end + 1));
      }
    } else {
      for (let s = 0; s < cornerIndices.length; s++) {
        const start = cornerIndices[s];
        const end = cornerIndices[(s + 1) % cornerIndices.length];
        if (end > start) {
          sections.push(densePts.slice(start, end + 1));
        } else {
          sections.push([...densePts.slice(start), ...densePts.slice(0, end + 1)]);
        }
      }
    }

    const simplifiedChain: { point: Point; isCorner: boolean }[] = [];
    for (let s = 0; s < sections.length; s++) {
      const sec = sections[s];
      const simpSec = simplifyPointsRDP(sec, tol);
      for (let pIdx = 0; pIdx < simpSec.length; pIdx++) {
        const isLastOfSec = pIdx === simpSec.length - 1;
        const isFirstOfSec = pIdx === 0;
        if (isLastOfSec && s < sections.length - 1) {
          // Shared with next section start, skip duplicate
          continue;
        }
        if (isLastOfSec && s === sections.length - 1 && contour.closed) {
          // Closed loop wrap around, skip duplicate first point
          continue;
        }
        // Only mark as corner if it was genuinely identified as a sharp corner from angular detection
        const origCornerIdx = s < cornerIndices.length ? cornerIndices[s] : -1;
        const isActualCorner = (isFirstOfSec && origCornerIdx >= 0 && isCorner[origCornerIdx]);
        simplifiedChain.push({
          point: simpSec[pIdx],
          isCorner: isActualCorner,
        });
      }
    }
    finalSimplifiedPoints = simplifiedChain;
  }

  // Fallback if oversimplified
  if (finalSimplifiedPoints.length < 3 && contour.closed) {
    finalSimplifiedPoints = densePts
      .filter((_, idx) => idx % Math.max(1, Math.floor(densePts.length / 8)) === 0)
      .map((p) => ({ point: p, isCorner: false }));
  }

  // 4. Compute balanced, G1-continuous Bézier control tangents for smooth nodes
  const total = finalSimplifiedPoints.length;
  const newNodes: BezierNode[] = finalSimplifiedPoints.map(({ point, isCorner }) => ({
    id: generateId(),
    x: Math.round(point.x),
    y: Math.round(point.y),
    type: isCorner ? 'corner' : 'smooth',
  }));

  for (let i = 0; i < total; i++) {
    const curr = newNodes[i];
    if (curr.type === 'corner') {
      curr.handleIn = null;
      curr.handleOut = null;
      continue;
    }

    const prev = newNodes[(i - 1 + total) % total];
    const next = newNodes[(i + 1) % total];

    // Distances
    const dPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const dNext = Math.hypot(next.x - curr.x, next.y - curr.y);

    if (dPrev < 0.1 || dNext < 0.1) continue;

    // Chord-weighted unit tangent directions
    const vPrevX = (curr.x - prev.x) / dPrev;
    const vPrevY = (curr.y - prev.y) / dPrev;
    const vNextX = (next.x - curr.x) / dNext;
    const vNextY = (next.y - curr.y) / dNext;

    let tanX = vPrevX + vNextX;
    let tanY = vPrevY + vNextY;
    let tanLen = Math.hypot(tanX, tanY);

    if (tanLen < 0.001) {
      tanX = -vPrevY;
      tanY = vPrevX;
      tanLen = Math.hypot(tanX, tanY) || 1;
    }

    tanX /= tanLen;
    tanY /= tanLen;

    const dot = vPrevX * vNextX + vPrevY * vNextY;
    const cosAngle = Math.max(-1, Math.min(1, dot));
    const cornerDamping = Math.max(0.04, Math.pow((1 + cosAngle) * 0.5, 0.65));
    const handleRatio = 0.35 * cornerDamping;

    // Handle lengths scaled to segment length with curvature damping
    const hInLen = Math.min(dPrev * handleRatio, 110);
    const hOutLen = Math.min(dNext * handleRatio, 110);

    curr.handleIn = {
      x: Math.round(curr.x - tanX * hInLen),
      y: Math.round(curr.y - tanY * hInLen),
    };
    curr.handleOut = {
      x: Math.round(curr.x + tanX * hOutLen),
      y: Math.round(curr.y + tanY * hOutLen),
    };
  }

  const reducedPoints = newNodes.length;
  const reductionPercent = Math.max(
    0,
    Math.round(((originalPoints - reducedPoints) / originalPoints) * 100)
  );

  return {
    contour: {
      ...contour,
      nodes: newNodes,
    },
    originalPoints,
    reducedPoints,
    reductionPercent,
  };
}

/**
 * Smooth an array of PathContours while preserving shape and reducing anchor points
 */
export function smoothContoursPreservingShape(
  contours: PathContour[],
  options: SmoothStrokeOptions = {}
): {
  contours: PathContour[];
  totalOriginalPoints: number;
  totalReducedPoints: number;
  totalReductionPercent: number;
} {
  if (!contours || contours.length === 0) {
    return {
      contours: [],
      totalOriginalPoints: 0,
      totalReducedPoints: 0,
      totalReductionPercent: 0,
    };
  }

  let totalOrig = 0;
  let totalRed = 0;

  const smoothed = contours.map((c) => {
    const res = smoothStrokeContour(c, options);
    totalOrig += res.originalPoints;
    totalRed += res.reducedPoints;
    return res.contour;
  });

  const totalReductionPercent =
    totalOrig > 0 ? Math.max(0, Math.round(((totalOrig - totalRed) / totalOrig) * 100)) : 0;

  return {
    contours: smoothed,
    totalOriginalPoints: totalOrig,
    totalReducedPoints: totalRed,
    totalReductionPercent,
  };
}

/**
 * Convert all nodes of a contour into sharp corner vertices (removes bezier handles)
 */
export function convertContourToCorners(contour: PathContour): PathContour {
  return {
    ...contour,
    nodes: contour.nodes.map((node) => ({
      ...node,
      type: 'corner',
      handleIn: null,
      handleOut: null,
    })),
  };
}

/**
 * Convert all nodes of a contour into smooth bezier curves with computed tangent handles
 */
export function convertContourToSmooth(contour: PathContour): PathContour {
  const nodes = [...contour.nodes];
  const total = nodes.length;
  if (total < 2) return contour;

  const newNodes = nodes.map((n) => ({
    ...n,
    type: 'smooth' as const,
  }));

  for (let i = 0; i < total; i++) {
    const prev = newNodes[(i - 1 + total) % total];
    const curr = newNodes[i];
    const next = newNodes[(i + 1) % total];

    const vx = (next.x - prev.x) * 0.28;
    const vy = (next.y - prev.y) * 0.28;

    curr.handleIn = { x: Math.round(curr.x - vx), y: Math.round(curr.y - vy) };
    curr.handleOut = { x: Math.round(curr.x + vx), y: Math.round(curr.y + vy) };
  }

  return {
    ...contour,
    nodes: newNodes,
  };
}

/**
 * カクカク角筆（sharp / polygon）専用の幾何学的アウトライン生成
 * 手書きの微小なブレや不要な曲率を力強い直線セグメントに集約し、
 * マイター角（Miter Joint）とスクエアキャップで構成される鮮明な角ばり多角形輪郭を生成
 */
export function createSharpAngularContour(
  rawPoints: (Point | StrokePoint)[],
  strokeWidth: number = 35,
  pressureSensitivity: 'high' | 'normal' | 'low' | 'off' = 'normal',
  pressureCurve?: PressureCurveConfig | null
): PathContour {
  if (!rawPoints || rawPoints.length === 0) {
    return { id: generateId(), closed: true, nodes: [] };
  }

  const halfWidth = Math.max(2, strokeWidth / 2);

  // 1点のみ（ドット打ち・タップ）の場合は完全な正方形
  if (rawPoints.length === 1) {
    const p = rawPoints[0];
    const r = Math.round(halfWidth);
    return {
      id: generateId(),
      closed: true,
      nodes: [
        { id: generateId(), x: p.x - r, y: p.y - r, type: 'corner' },
        { id: generateId(), x: p.x + r, y: p.y - r, type: 'corner' },
        { id: generateId(), x: p.x + r, y: p.y + r, type: 'corner' },
        { id: generateId(), x: p.x - r, y: p.y + r, type: 'corner' },
      ],
    };
  }

  // 1. 重複点（近接点）の除去
  const cleanPoints: Point[] = [rawPoints[0]];
  for (let i = 1; i < rawPoints.length; i++) {
    const prev = cleanPoints[cleanPoints.length - 1];
    const curr = rawPoints[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= 2.5) {
      cleanPoints.push({ x: curr.x, y: curr.y });
    }
  }

  if (cleanPoints.length < 2) {
    const p = cleanPoints[0] || rawPoints[0];
    const r = Math.round(halfWidth);
    return {
      id: generateId(),
      closed: true,
      nodes: [
        { id: generateId(), x: p.x - r, y: p.y - r, type: 'corner' },
        { id: generateId(), x: p.x + r, y: p.y - r, type: 'corner' },
        { id: generateId(), x: p.x + r, y: p.y + r, type: 'corner' },
        { id: generateId(), x: p.x - r, y: p.y + r, type: 'corner' },
      ],
    };
  }

  // 2. 直線セグメント骨格化（Ramer-Douglas-Peucker）
  // カクカク感を際立たせるため、手ブレの曲率を直線に整理
  const backboneEpsilon = Math.max(14, strokeWidth * 0.42);
  let backbone = simplifyPointsRDP(cleanPoints, backboneEpsilon);
  if (backbone.length < 2) {
    backbone = [cleanPoints[0], cleanPoints[cleanPoints.length - 1]];
  }

  // 3. 微小な屈曲のクレンジング & 幾何学角度（水平・垂直・45度）のスナップ整流
  const refinedBackbone: Point[] = [backbone[0]];
  for (let i = 1; i < backbone.length - 1; i++) {
    const pPrev = refinedBackbone[refinedBackbone.length - 1];
    const pCurr = backbone[i];
    const pNext = backbone[i + 1];

    const v1x = pCurr.x - pPrev.x;
    const v1y = pCurr.y - pPrev.y;
    const v2x = pNext.x - pCurr.x;
    const v2y = pNext.y - pCurr.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);

    if (len1 < 1 || len2 < 1) continue;

    // 2セグメント間の折れ曲がり角
    const cosAngle = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (len1 * len2)));
    const turnAngleDeg = (Math.acos(cosAngle) * 180) / Math.PI;

    // 屈曲が12度未満の極めて緩やかな角度は1本の直線として統合（角として残さない）
    if (turnAngleDeg < 12) {
      continue;
    }
    refinedBackbone.push(pCurr);
  }
  refinedBackbone.push(backbone[backbone.length - 1]);

  // 45度/水平/垂直へのマイルドなスナップ（セグメントがほぼ直線・直角・対角線のときに端正な角を強調）
  const snappedBackbone: Point[] = [{ ...refinedBackbone[0] }];
  for (let i = 1; i < refinedBackbone.length; i++) {
    const prev = snappedBackbone[i - 1];
    const curr = refinedBackbone[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 2) continue;

    const angleDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    // 0, 45, 90, 135, 180, 225, 270, 315 度に近いかチェック
    const nearestOct = Math.round(angleDeg / 45) * 45;
    const diff = Math.abs(angleDeg - nearestOct);

    if (diff <= 8 && i === refinedBackbone.length - 1) {
      // 最終点のスナップ
      const targetRad = (nearestOct * Math.PI) / 180;
      snappedBackbone.push({
        x: Math.round(prev.x + Math.cos(targetRad) * dist),
        y: Math.round(prev.y + Math.sin(targetRad) * dist),
      });
    } else {
      snappedBackbone.push({ x: Math.round(curr.x), y: Math.round(curr.y) });
    }
  }

  const finalBackbone = snappedBackbone.length >= 2 ? snappedBackbone : backbone;
  const m = finalBackbone.length;

  if (m === 2) {
    const p0 = finalBackbone[0];
    const p1 = finalBackbone[1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const contour: PathContour = {
      id: generateId(),
      closed: true,
      nodes: [
        { id: generateId(), x: Math.round(p0.x + nx * halfWidth), y: Math.round(p0.y + ny * halfWidth), type: 'corner' },
        { id: generateId(), x: Math.round(p1.x + nx * halfWidth), y: Math.round(p1.y + ny * halfWidth), type: 'corner' },
        { id: generateId(), x: Math.round(p1.x - nx * halfWidth), y: Math.round(p1.y - ny * halfWidth), type: 'corner' },
        { id: generateId(), x: Math.round(p0.x - nx * halfWidth), y: Math.round(p0.y - ny * halfWidth), type: 'corner' },
      ],
    };
    return getContourSignedArea(contour) < 0 ? reverseContour(contour) : contour;
  }

  // 4. セグメントの方向・法線ベクトル
  const segDirs: Point[] = [];
  const segNorms: Point[] = [];
  for (let i = 0; i < m - 1; i++) {
    const dx = finalBackbone[i + 1].x - finalBackbone[i].x;
    const dy = finalBackbone[i + 1].y - finalBackbone[i].y;
    const len = Math.hypot(dx, dy) || 1;
    const vx = dx / len;
    const vy = dy / len;
    segDirs.push({ x: vx, y: vy });
    segNorms.push({ x: -vy, y: vx });
  }

  // 5. マイター結合（Miter Joint）による左右の角ばり境界点列の生成
  const leftPoints: Point[] = [];
  const rightPoints: Point[] = [];

  // 始点（スクエアカット）
  leftPoints.push({
    x: Math.round(finalBackbone[0].x + segNorms[0].x * halfWidth),
    y: Math.round(finalBackbone[0].y + segNorms[0].y * halfWidth),
  });
  rightPoints.push({
    x: Math.round(finalBackbone[0].x - segNorms[0].x * halfWidth),
    y: Math.round(finalBackbone[0].y - segNorms[0].y * halfWidth),
  });

  // 中間頂点におけるマイター角の計算
  for (let i = 1; i < m - 1; i++) {
    const pt = finalBackbone[i];
    const nPrev = segNorms[i - 1];
    const nCurr = segNorms[i];
    const vPrev = segDirs[i - 1];
    const vCurr = segDirs[i];

    const cross = vPrev.x * vCurr.y - vPrev.y * vCurr.x;
    const sumNx = nPrev.x + nCurr.x;
    const sumNy = nPrev.y + nCurr.y;
    const sumLen = Math.hypot(sumNx, sumNy);

    if (sumLen < 0.05) {
      // 180°折り返し
      leftPoints.push(
        { x: Math.round(pt.x + nPrev.x * halfWidth), y: Math.round(pt.y + nPrev.y * halfWidth) },
        { x: Math.round(pt.x + nCurr.x * halfWidth), y: Math.round(pt.y + nCurr.y * halfWidth) }
      );
      rightPoints.push(
        { x: Math.round(pt.x - nPrev.x * halfWidth), y: Math.round(pt.y - nPrev.y * halfWidth) },
        { x: Math.round(pt.x - nCurr.x * halfWidth), y: Math.round(pt.y - nCurr.y * halfWidth) }
      );
      continue;
    }

    const uNx = sumNx / sumLen;
    const uNy = sumNy / sumLen;
    const miter = 2 / sumLen; // 1 / cos(theta/2)

    // 内角側はストローク突き抜けを防ぐ安全なクランプ（innerMiter <= 1.4）
    const innerMiter = Math.min(1.4, miter);

    if (cross > 0.05) {
      // 左に折れ曲がる（左側が内角、右側が外角）
      leftPoints.push({
        x: Math.round(pt.x + uNx * halfWidth * innerMiter),
        y: Math.round(pt.y + uNy * halfWidth * innerMiter),
      });

      // マイターリミット: 鋭すぎる外角（miter > 2.0）はベベル（斜めカット2点）
      if (miter > 2.0) {
        rightPoints.push(
          { x: Math.round(pt.x - nPrev.x * halfWidth), y: Math.round(pt.y - nPrev.y * halfWidth) },
          { x: Math.round(pt.x - nCurr.x * halfWidth), y: Math.round(pt.y - nCurr.y * halfWidth) }
        );
      } else {
        rightPoints.push({
          x: Math.round(pt.x - uNx * halfWidth * miter),
          y: Math.round(pt.y - uNy * halfWidth * miter),
        });
      }
    } else if (cross < -0.05) {
      // 右に折れ曲がる（右側が内角、左側が外角）
      rightPoints.push({
        x: Math.round(pt.x - uNx * halfWidth * innerMiter),
        y: Math.round(pt.y - uNy * halfWidth * innerMiter),
      });

      // マイターリミット: 鋭すぎる外角（miter > 2.0）はベベル（斜めカット2点）
      if (miter > 2.0) {
        leftPoints.push(
          { x: Math.round(pt.x + nPrev.x * halfWidth), y: Math.round(pt.y + nPrev.y * halfWidth) },
          { x: Math.round(pt.x + nCurr.x * halfWidth), y: Math.round(pt.y + nCurr.y * halfWidth) }
        );
      } else {
        leftPoints.push({
          x: Math.round(pt.x + uNx * halfWidth * miter),
          y: Math.round(pt.y + uNy * halfWidth * miter),
        });
      }
    } else {
      // ほぼ直線
      leftPoints.push({
        x: Math.round(pt.x + uNx * halfWidth),
        y: Math.round(pt.y + uNy * halfWidth),
      });
      rightPoints.push({
        x: Math.round(pt.x - uNx * halfWidth),
        y: Math.round(pt.y - uNy * halfWidth),
      });
    }
  }

  // 終点（スクエアカット）
  const lastNorm = segNorms[segNorms.length - 1];
  leftPoints.push({
    x: Math.round(finalBackbone[m - 1].x + lastNorm.x * halfWidth),
    y: Math.round(finalBackbone[m - 1].y + lastNorm.y * halfWidth),
  });
  rightPoints.push({
    x: Math.round(finalBackbone[m - 1].x - lastNorm.x * halfWidth),
    y: Math.round(finalBackbone[m - 1].y - lastNorm.y * halfWidth),
  });

  // 6. 時計回りの閉多角形ループを構築
  const allCorners: Point[] = [...rightPoints, ...leftPoints.reverse()];

  // 近すぎる連続重複点を除去
  const deduplicatedCorners: Point[] = [];
  for (let i = 0; i < allCorners.length; i++) {
    if (deduplicatedCorners.length === 0) {
      deduplicatedCorners.push(allCorners[i]);
      continue;
    }
    const prev = deduplicatedCorners[deduplicatedCorners.length - 1];
    const curr = allCorners[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) > 1.5) {
      deduplicatedCorners.push(curr);
    }
  }

  const contour: PathContour = {
    id: generateId(),
    closed: true,
    nodes: deduplicatedCorners.map((p) => ({
      id: generateId(),
      x: p.x,
      y: p.y,
      type: 'corner',
    })),
  };

  return getContourSignedArea(contour) < 0 ? reverseContour(contour) : contour;
}

/**
 * カクカク角丸筆（sharp_round）専用の幾何学的角丸アウトライン生成
 * 直線セグメントと45°/90°/水平垂直スナップの幾何学骨格をベースに、
 * 各コーナーのターンに滑らかな角丸フィレット（Round Join）および
 * ストローク両端に綺麗な半円ラウンドキャップ（Round Cap）を適用したモダン角丸文字用のアウトラインを生成
 */
export function createSharpRoundedContour(
  rawPoints: (Point | StrokePoint)[],
  strokeWidth: number = 35,
  pressureSensitivity: 'high' | 'normal' | 'low' | 'off' = 'normal',
  pressureCurve?: PressureCurveConfig | null
): PathContour {
  if (!rawPoints || rawPoints.length === 0) {
    return { id: generateId(), closed: true, nodes: [] };
  }

  const halfWidth = Math.max(3, strokeWidth / 2);
  const kappa = 0.5522847498;
  const ox = halfWidth * kappa;

  // 1点のみ（ドット打ち・タップ）の場合は完全な円（4つのsmoothノード）
  if (rawPoints.length === 1) {
    const p = rawPoints[0];
    return {
      id: generateId(),
      closed: true,
      nodes: [
        { id: generateId(), x: p.x, y: p.y - halfWidth, handleIn: { x: p.x - ox, y: p.y - halfWidth }, handleOut: { x: p.x + ox, y: p.y - halfWidth }, type: 'smooth' },
        { id: generateId(), x: p.x + halfWidth, y: p.y, handleIn: { x: p.x + halfWidth, y: p.y - ox }, handleOut: { x: p.x + halfWidth, y: p.y + ox }, type: 'smooth' },
        { id: generateId(), x: p.x, y: p.y + halfWidth, handleIn: { x: p.x + ox, y: p.y + halfWidth }, handleOut: { x: p.x - ox, y: p.y + halfWidth }, type: 'smooth' },
        { id: generateId(), x: p.x - halfWidth, y: p.y, handleIn: { x: p.x - halfWidth, y: p.y + ox }, handleOut: { x: p.x - halfWidth, y: p.y - ox }, type: 'smooth' },
      ],
    };
  }

  // 1. 重複点（近接点）の除去
  const cleanPoints: Point[] = [rawPoints[0]];
  for (let i = 1; i < rawPoints.length; i++) {
    const prev = cleanPoints[cleanPoints.length - 1];
    const curr = rawPoints[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= 2.5) {
      cleanPoints.push({ x: curr.x, y: curr.y });
    }
  }

  if (cleanPoints.length < 2) {
    const p = cleanPoints[0] || rawPoints[0];
    return {
      id: generateId(),
      closed: true,
      nodes: [
        { id: generateId(), x: p.x, y: p.y - halfWidth, handleIn: { x: p.x - ox, y: p.y - halfWidth }, handleOut: { x: p.x + ox, y: p.y - halfWidth }, type: 'smooth' },
        { id: generateId(), x: p.x + halfWidth, y: p.y, handleIn: { x: p.x + halfWidth, y: p.y - ox }, handleOut: { x: p.x + halfWidth, y: p.y + ox }, type: 'smooth' },
        { id: generateId(), x: p.x, y: p.y + halfWidth, handleIn: { x: p.x + ox, y: p.y + halfWidth }, handleOut: { x: p.x - ox, y: p.y + halfWidth }, type: 'smooth' },
        { id: generateId(), x: p.x - halfWidth, y: p.y, handleIn: { x: p.x - halfWidth, y: p.y + ox }, handleOut: { x: p.x - halfWidth, y: p.y - ox }, type: 'smooth' },
      ],
    };
  }

  // 2. 直線セグメント骨格化（Ramer-Douglas-Peucker）
  const backboneEpsilon = Math.max(14, strokeWidth * 0.42);
  let backbone = simplifyPointsRDP(cleanPoints, backboneEpsilon);
  if (backbone.length < 2) {
    backbone = [cleanPoints[0], cleanPoints[cleanPoints.length - 1]];
  }

  // 3. 微小な屈曲のクレンジング & 幾何学角度（水平・垂直・45度）のスナップ整流
  const refinedBackbone: Point[] = [backbone[0]];
  for (let i = 1; i < backbone.length - 1; i++) {
    const pPrev = refinedBackbone[refinedBackbone.length - 1];
    const pCurr = backbone[i];
    const pNext = backbone[i + 1];

    const v1x = pCurr.x - pPrev.x;
    const v1y = pCurr.y - pPrev.y;
    const v2x = pNext.x - pCurr.x;
    const v2y = pNext.y - pCurr.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);

    if (len1 < 1 || len2 < 1) continue;

    const cosAngle = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (len1 * len2)));
    const turnAngleDeg = (Math.acos(cosAngle) * 180) / Math.PI;

    if (turnAngleDeg < 12) {
      continue;
    }
    refinedBackbone.push(pCurr);
  }
  refinedBackbone.push(backbone[backbone.length - 1]);

  // 45度/水平/垂直へのマイルドなスナップ
  const snappedBackbone: Point[] = [{ ...refinedBackbone[0] }];
  for (let i = 1; i < refinedBackbone.length; i++) {
    const prev = snappedBackbone[i - 1];
    const curr = refinedBackbone[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 2) continue;

    const angleDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const nearestOct = Math.round(angleDeg / 45) * 45;
    const diff = Math.abs(angleDeg - nearestOct);

    if (diff <= 8 && i === refinedBackbone.length - 1) {
      const targetRad = (nearestOct * Math.PI) / 180;
      snappedBackbone.push({
        x: Math.round(prev.x + Math.cos(targetRad) * dist),
        y: Math.round(prev.y + Math.sin(targetRad) * dist),
      });
    } else {
      snappedBackbone.push({ x: Math.round(curr.x), y: Math.round(curr.y) });
    }
  }

  const finalBackbone = snappedBackbone.length >= 2 ? snappedBackbone : backbone;
  const m = finalBackbone.length;

  // 単一セグメント（2点間の直線）の場合: カプセル／ピル形状（丸端の長方形）
  if (m === 2) {
    const p0 = finalBackbone[0];
    const p1 = finalBackbone[1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const vx = dx / len;
    const vy = dy / len;
    const nx = -vy;
    const ny = vx;

    const capOffset = halfWidth * kappa;

    const nodes: BezierNode[] = [
      // 終端ラウンドキャップ (p1)
      {
        id: generateId(),
        x: Math.round(p1.x + nx * halfWidth),
        y: Math.round(p1.y + ny * halfWidth),
        handleOut: {
          x: Math.round(p1.x + nx * halfWidth + vx * capOffset),
          y: Math.round(p1.y + ny * halfWidth + vy * capOffset),
        },
        type: 'smooth',
      },
      {
        id: generateId(),
        x: Math.round(p1.x + vx * halfWidth),
        y: Math.round(p1.y + vy * halfWidth),
        handleIn: {
          x: Math.round(p1.x + vx * halfWidth + nx * capOffset),
          y: Math.round(p1.y + vy * halfWidth + ny * capOffset),
        },
        handleOut: {
          x: Math.round(p1.x + vx * halfWidth - nx * capOffset),
          y: Math.round(p1.y + vy * halfWidth - ny * capOffset),
        },
        type: 'smooth',
      },
      {
        id: generateId(),
        x: Math.round(p1.x - nx * halfWidth),
        y: Math.round(p1.y - ny * halfWidth),
        handleIn: {
          x: Math.round(p1.x - nx * halfWidth + vx * capOffset),
          y: Math.round(p1.y - ny * halfWidth + vy * capOffset),
        },
        type: 'smooth',
      },
      // 始端ラウンドキャップ (p0)
      {
        id: generateId(),
        x: Math.round(p0.x - nx * halfWidth),
        y: Math.round(p0.y - ny * halfWidth),
        handleOut: {
          x: Math.round(p0.x - nx * halfWidth - vx * capOffset),
          y: Math.round(p0.y - ny * halfWidth - vy * capOffset),
        },
        type: 'smooth',
      },
      {
        id: generateId(),
        x: Math.round(p0.x - vx * halfWidth),
        y: Math.round(p0.y - vy * halfWidth),
        handleIn: {
          x: Math.round(p0.x - vx * halfWidth - nx * capOffset),
          y: Math.round(p0.y - vy * halfWidth - ny * capOffset),
        },
        handleOut: {
          x: Math.round(p0.x - vx * halfWidth + nx * capOffset),
          y: Math.round(p0.y - vy * halfWidth + ny * capOffset),
        },
        type: 'smooth',
      },
      {
        id: generateId(),
        x: Math.round(p0.x + nx * halfWidth),
        y: Math.round(p0.y + ny * halfWidth),
        handleIn: {
          x: Math.round(p0.x + nx * halfWidth - vx * capOffset),
          y: Math.round(p0.y + ny * halfWidth - vy * capOffset),
        },
        type: 'smooth',
      },
    ];

    const contour: PathContour = {
      id: generateId(),
      closed: true,
      nodes,
    };
    return getContourSignedArea(contour) < 0 ? reverseContour(contour) : contour;
  }

  // 4. マルチセグメントの方向・法線ベクトル
  const segDirs: Point[] = [];
  const segNorms: Point[] = [];
  for (let i = 0; i < m - 1; i++) {
    const dx = finalBackbone[i + 1].x - finalBackbone[i].x;
    const dy = finalBackbone[i + 1].y - finalBackbone[i].y;
    const len = Math.hypot(dx, dy) || 1;
    const vx = dx / len;
    const vy = dy / len;
    segDirs.push({ x: vx, y: vy });
    segNorms.push({ x: -vy, y: vx });
  }

  const nodes: BezierNode[] = [];

  // 5. 始端（p0）の半円ラウンドキャップ
  const v0 = segDirs[0];
  const n0 = segNorms[0];
  const capOffset0 = halfWidth * kappa;
  const p0 = finalBackbone[0];

  // 始端キャップの頂点（-v0方向）
  nodes.push({
    id: generateId(),
    x: Math.round(p0.x - v0.x * halfWidth),
    y: Math.round(p0.y - v0.y * halfWidth),
    handleIn: {
      x: Math.round(p0.x - v0.x * halfWidth - n0.x * capOffset0),
      y: Math.round(p0.y - v0.y * halfWidth - n0.y * capOffset0),
    },
    handleOut: {
      x: Math.round(p0.x - v0.x * halfWidth + n0.x * capOffset0),
      y: Math.round(p0.y - v0.y * halfWidth + n0.y * capOffset0),
    },
    type: 'smooth',
  });

  // 始端の左側境界点
  nodes.push({
    id: generateId(),
    x: Math.round(p0.x + n0.x * halfWidth),
    y: Math.round(p0.y + n0.y * halfWidth),
    handleIn: {
      x: Math.round(p0.x + n0.x * halfWidth - v0.x * capOffset0),
      y: Math.round(p0.y + n0.y * halfWidth - v0.y * capOffset0),
    },
    type: 'smooth',
  });

  // 6. 左側サイドのセグメント & 角丸ターン処理
  for (let i = 1; i < m - 1; i++) {
    const pt = finalBackbone[i];
    const nPrev = segNorms[i - 1];
    const nCurr = segNorms[i];
    const vPrev = segDirs[i - 1];
    const vCurr = segDirs[i];

    const cross = vPrev.x * vCurr.y - vPrev.y * vCurr.x;
    const cosAngle = Math.max(-1, Math.min(1, vPrev.x * vCurr.x + vPrev.y * vCurr.y));
    const turnAngle = Math.acos(cosAngle);

    const sumNx = nPrev.x + nCurr.x;
    const sumNy = nPrev.y + nCurr.y;
    const sumLen = Math.hypot(sumNx, sumNy) || 1;
    const uNx = sumNx / sumLen;
    const uNy = sumNy / sumLen;

    if (cross < -0.05) {
      // 右に曲がる（左側は外角！円弧フィレットで丸める）
      const arcHandleLen = (4 / 3) * Math.tan(turnAngle / 4) * halfWidth;

      const qIn: Point = {
        x: Math.round(pt.x + nPrev.x * halfWidth),
        y: Math.round(pt.y + nPrev.y * halfWidth),
      };
      const qOut: Point = {
        x: Math.round(pt.x + nCurr.x * halfWidth),
        y: Math.round(pt.y + nCurr.y * halfWidth),
      };

      if (turnAngle > 1.4) {
        const apex: Point = {
          x: Math.round(pt.x + uNx * halfWidth),
          y: Math.round(pt.y + uNy * halfWidth),
        };
        const halfTan = (4 / 3) * Math.tan(turnAngle / 8) * halfWidth;
        const uVx = (vPrev.x + vCurr.x);
        const uVy = (vPrev.y + vCurr.y);
        const uVLen = Math.hypot(uVx, uVy) || 1;
        const tangX = uVx / uVLen;
        const tangY = uVy / uVLen;

        nodes.push({
          id: generateId(),
          x: qIn.x,
          y: qIn.y,
          handleOut: {
            x: Math.round(qIn.x + vPrev.x * halfTan),
            y: Math.round(qIn.y + vPrev.y * halfTan),
          },
          type: 'smooth',
        });
        nodes.push({
          id: generateId(),
          x: apex.x,
          y: apex.y,
          handleIn: {
            x: Math.round(apex.x - tangX * halfTan),
            y: Math.round(apex.y - tangY * halfTan),
          },
          handleOut: {
            x: Math.round(apex.x + tangX * halfTan),
            y: Math.round(apex.y + tangY * halfTan),
          },
          type: 'smooth',
        });
        nodes.push({
          id: generateId(),
          x: qOut.x,
          y: qOut.y,
          handleIn: {
            x: Math.round(qOut.x - vCurr.x * halfTan),
            y: Math.round(qOut.y - vCurr.y * halfTan),
          },
          type: 'smooth',
        });
      } else {
        nodes.push({
          id: generateId(),
          x: qIn.x,
          y: qIn.y,
          handleOut: {
            x: Math.round(qIn.x + vPrev.x * arcHandleLen),
            y: Math.round(qIn.y + vPrev.y * arcHandleLen),
          },
          type: 'smooth',
        });
        nodes.push({
          id: generateId(),
          x: qOut.x,
          y: qOut.y,
          handleIn: {
            x: Math.round(qOut.x - vCurr.x * arcHandleLen),
            y: Math.round(qOut.y - vCurr.y * arcHandleLen),
          },
          type: 'smooth',
        });
      }
    } else if (cross > 0.05) {
      // 左に曲がる（左側は内角！内角交点）
      const innerMiter = Math.min(1.4, 2 / sumLen);
      nodes.push({
        id: generateId(),
        x: Math.round(pt.x + uNx * halfWidth * innerMiter),
        y: Math.round(pt.y + uNy * halfWidth * innerMiter),
        type: 'corner',
      });
    } else {
      nodes.push({
        id: generateId(),
        x: Math.round(pt.x + nCurr.x * halfWidth),
        y: Math.round(pt.y + nCurr.y * halfWidth),
        type: 'smooth',
      });
    }
  }

  // 7. 終端（pLast）の半円ラウンドキャップ
  const pLast = finalBackbone[m - 1];
  const vLast = segDirs[segDirs.length - 1];
  const nLast = segNorms[segNorms.length - 1];
  const capOffsetLast = halfWidth * kappa;

  nodes.push({
    id: generateId(),
    x: Math.round(pLast.x + nLast.x * halfWidth),
    y: Math.round(pLast.y + nLast.y * halfWidth),
    handleOut: {
      x: Math.round(pLast.x + nLast.x * halfWidth + vLast.x * capOffsetLast),
      y: Math.round(pLast.y + nLast.y * halfWidth + vLast.y * capOffsetLast),
    },
    type: 'smooth',
  });

  nodes.push({
    id: generateId(),
    x: Math.round(pLast.x + vLast.x * halfWidth),
    y: Math.round(pLast.y + vLast.y * halfWidth),
    handleIn: {
      x: Math.round(pLast.x + vLast.x * halfWidth + nLast.x * capOffsetLast),
      y: Math.round(pLast.y + vLast.y * halfWidth + nLast.y * capOffsetLast),
    },
    handleOut: {
      x: Math.round(pLast.x + vLast.x * halfWidth - nLast.x * capOffsetLast),
      y: Math.round(pLast.y + vLast.y * halfWidth - nLast.y * capOffsetLast),
    },
    type: 'smooth',
  });

  nodes.push({
    id: generateId(),
    x: Math.round(pLast.x - nLast.x * halfWidth),
    y: Math.round(pLast.y - nLast.y * halfWidth),
    handleIn: {
      x: Math.round(pLast.x - nLast.x * halfWidth + vLast.x * capOffsetLast),
      y: Math.round(pLast.y - nLast.y * halfWidth + vLast.y * capOffsetLast),
    },
    type: 'smooth',
  });

  // 8. 右側サイドのセグメント & 角丸ターン処理（逆順に走査）
  for (let i = m - 2; i >= 1; i--) {
    const pt = finalBackbone[i];
    const nPrev = segNorms[i - 1];
    const nCurr = segNorms[i];
    const vPrev = segDirs[i - 1];
    const vCurr = segDirs[i];

    const cross = vPrev.x * vCurr.y - vPrev.y * vCurr.x;
    const cosAngle = Math.max(-1, Math.min(1, vPrev.x * vCurr.x + vPrev.y * vCurr.y));
    const turnAngle = Math.acos(cosAngle);

    const sumNx = nPrev.x + nCurr.x;
    const sumNy = nPrev.y + nCurr.y;
    const sumLen = Math.hypot(sumNx, sumNy) || 1;
    const uNx = sumNx / sumLen;
    const uNy = sumNy / sumLen;

    if (cross > 0.05) {
      // 左に曲がる（右側は外角！円弧フィレットで丸める。逆方向）
      const arcHandleLen = (4 / 3) * Math.tan(turnAngle / 4) * halfWidth;

      const qIn: Point = {
        x: Math.round(pt.x - nCurr.x * halfWidth),
        y: Math.round(pt.y - nCurr.y * halfWidth),
      };
      const qOut: Point = {
        x: Math.round(pt.x - nPrev.x * halfWidth),
        y: Math.round(pt.y - nPrev.y * halfWidth),
      };

      if (turnAngle > 1.4) {
        const apex: Point = {
          x: Math.round(pt.x - uNx * halfWidth),
          y: Math.round(pt.y - uNy * halfWidth),
        };
        const halfTan = (4 / 3) * Math.tan(turnAngle / 8) * halfWidth;
        const uVx = (vPrev.x + vCurr.x);
        const uVy = (vPrev.y + vCurr.y);
        const uVLen = Math.hypot(uVx, uVy) || 1;
        const tangX = -uVx / uVLen;
        const tangY = -uVy / uVLen;

        nodes.push({
          id: generateId(),
          x: qIn.x,
          y: qIn.y,
          handleOut: {
            x: Math.round(qIn.x - vCurr.x * halfTan),
            y: Math.round(qIn.y - vCurr.y * halfTan),
          },
          type: 'smooth',
        });
        nodes.push({
          id: generateId(),
          x: apex.x,
          y: apex.y,
          handleIn: {
            x: Math.round(apex.x - tangX * halfTan),
            y: Math.round(apex.y - tangY * halfTan),
          },
          handleOut: {
            x: Math.round(apex.x + tangX * halfTan),
            y: Math.round(apex.y + tangY * halfTan),
          },
          type: 'smooth',
        });
        nodes.push({
          id: generateId(),
          x: qOut.x,
          y: qOut.y,
          handleIn: {
            x: Math.round(qOut.x + vPrev.x * halfTan),
            y: Math.round(qOut.y + vPrev.y * halfTan),
          },
          type: 'smooth',
        });
      } else {
        nodes.push({
          id: generateId(),
          x: qIn.x,
          y: qIn.y,
          handleOut: {
            x: Math.round(qIn.x - vCurr.x * arcHandleLen),
            y: Math.round(qIn.y - vCurr.y * arcHandleLen),
          },
          type: 'smooth',
        });
        nodes.push({
          id: generateId(),
          x: qOut.x,
          y: qOut.y,
          handleIn: {
            x: Math.round(qOut.x + vPrev.x * arcHandleLen),
            y: Math.round(qOut.y + vPrev.y * arcHandleLen),
          },
          type: 'smooth',
        });
      }
    } else if (cross < -0.05) {
      // 右に曲がる（右側は内角！内角交点）
      const innerMiter = Math.min(1.4, 2 / sumLen);
      nodes.push({
        id: generateId(),
        x: Math.round(pt.x - uNx * halfWidth * innerMiter),
        y: Math.round(pt.y - uNy * halfWidth * innerMiter),
        type: 'corner',
      });
    } else {
      nodes.push({
        id: generateId(),
        x: Math.round(pt.x - nPrev.x * halfWidth),
        y: Math.round(pt.y - nPrev.y * halfWidth),
        type: 'smooth',
      });
    }
  }

  // 9. 始端の右側境界点と接続
  nodes.push({
    id: generateId(),
    x: Math.round(p0.x - n0.x * halfWidth),
    y: Math.round(p0.y - n0.y * halfWidth),
    handleOut: {
      x: Math.round(p0.x - n0.x * halfWidth - v0.x * capOffset0),
      y: Math.round(p0.y - n0.y * halfWidth - v0.y * capOffset0),
    },
    type: 'smooth',
  });

  // 近すぎる連続重複ノードを除去
  const deduplicatedNodes: BezierNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (deduplicatedNodes.length === 0) {
      deduplicatedNodes.push(nodes[i]);
      continue;
    }
    const prev = deduplicatedNodes[deduplicatedNodes.length - 1];
    const curr = nodes[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) > 2) {
      deduplicatedNodes.push(curr);
    }
  }

  const contour: PathContour = {
    id: generateId(),
    closed: true,
    nodes: deduplicatedNodes,
  };

  return getContourSignedArea(contour) < 0 ? reverseContour(contour) : contour;
}

/**
 * Options for Subdivided Fine-Segment Stroke generation
 */
export interface SubdividedStrokeOptions {
  /** Target distance between fine sub-segments in font units (default: 1.25) */
  subdivisionStep?: number;
  /** Density level for sub-segmentation: 'ultra' (0.8px), 'high' (1.25px), 'normal' (1.8px) */
  density?: 'ultra' | 'high' | 'normal';
  /** Whether to use adaptive sub-segmentation that increases density where pressure changes fast */
  adaptiveDensity?: boolean;
  /** Width smoothing passes for pressure transitions */
  widthSmoothingPasses?: number;
  /** Custom Pen / Brush preset parameters (ibisPaint brush parameters) */
  customPreset?: Partial<UserPenPreset>;
  /** Disable automatic straightening for curved preview or delicate calligraphic strokes */
  disableAutoStraight?: boolean;
}

/**
 * Fast SVG path generator for active freehand drawing preview
 */

export function generateFastStrokeSvgPath(
  points: (Point | StrokePoint)[],
  strokeWidth: number = 40,
  style: BrushStyle = 'brush',
  roundCap: boolean = true,
  pressureSensitivity: 'high' | 'normal' | 'low' | 'off' = 'normal',
  pressureCurve?: PressureCurveConfig | null,
  smoothingIntensity: number = 50,
  options?: SubdividedStrokeOptions
): string {
  if (points.length === 0) return '';
  const contour = strokePointsToOutline(points, strokeWidth, style, roundCap, pressureSensitivity, pressureCurve, smoothingIntensity, options);
  return contoursToSvgPath([contour]);
}

/**
 * Render stroke points into a finely subdivided SVG path string directly
 */
export function renderSubdividedStrokePath(
  points: (Point | StrokePoint)[],
  strokeWidth: number = 40,
  style: BrushStyle = 'brush',
  roundCap: boolean = true,
  pressureSensitivity: 'high' | 'normal' | 'low' | 'off' = 'normal',
  pressureCurve?: PressureCurveConfig | null,
  smoothingIntensity: number = 50,
  options?: SubdividedStrokeOptions
): string {
  return generateFastStrokeSvgPath(
    points,
    strokeWidth,
    style,
    roundCap,
    pressureSensitivity,
    pressureCurve,
    smoothingIntensity,
    options
  );
}

/**
 * Convert freehand stroke points into a closed smoothed vector outline using
 * fine-segment subdivision and monotone cubic Hermite pressure interpolation.
 */

export function strokePointsToSubdividedOutline(
  points: (Point | StrokePoint)[],
  strokeWidth: number = 40,
  style: BrushStyle = 'brush',
  roundCap: boolean = true,
  pressureSensitivity: 'high' | 'normal' | 'low' | 'off' = 'normal',
  pressureCurve?: PressureCurveConfig | null,
  smoothingIntensity: number = 50,
  options?: SubdividedStrokeOptions
): PathContour {
  return strokePointsToOutline(
    points,
    strokeWidth,
    style,
    roundCap,
    pressureSensitivity,
    pressureCurve,
    smoothingIntensity,
    options
  );
}

/**
 * Convert freehand stroke points (with optional stylus pressure & timing) into a closed smoothed or angular vector outline
 */
export function strokePointsToOutline(
  points: (Point | StrokePoint)[],
  strokeWidth: number = 40,
  style: BrushStyle = 'brush',
  roundCap: boolean = true,
  pressureSensitivity: 'high' | 'normal' | 'low' | 'off' = 'normal',
  pressureCurve?: PressureCurveConfig | null,
  smoothingIntensity: number = 50,
  options?: SubdividedStrokeOptions
): PathContour {
  // カクカク角筆・ポリゴン筆は専用の幾何学的マイター角・直線セグメント生成ルーチンを使用
  if (style === 'sharp' || style === 'polygon') {
    return createSharpAngularContour(points, strokeWidth, pressureSensitivity, pressureCurve);
  }

  // カクカク角丸筆は幾何学直線骨格＋角丸フィレット・ラウンドキャップルーチンを使用
  if (style === 'sharp_round') {
    return createSharpRoundedContour(points, strokeWidth, pressureSensitivity, pressureCurve);
  }

  if (points.length < 2) {
    const p = points[0] || { x: 500, y: 500 };
    const r = Math.max(6, strokeWidth / 2);
    // create a smooth circle with 4 bezier nodes
    const kappa = 0.5522847498;
    const ox = r * kappa;
    return {
      id: generateId(),
      closed: true,
      nodes: [
        { id: generateId(), x: p.x, y: p.y - r, handleIn: { x: p.x - ox, y: p.y - r }, handleOut: { x: p.x + ox, y: p.y - r }, type: 'smooth' },
        { id: generateId(), x: p.x + r, y: p.y, handleIn: { x: p.x + r, y: p.y - ox }, handleOut: { x: p.x + r, y: p.y + ox }, type: 'smooth' },
        { id: generateId(), x: p.x, y: p.y + r, handleIn: { x: p.x + ox, y: p.y + r }, handleOut: { x: p.x - ox, y: p.y + r }, type: 'smooth' },
        { id: generateId(), x: p.x - r, y: p.y, handleIn: { x: p.x - r, y: p.y + ox }, handleOut: { x: p.x - r, y: p.y - ox }, type: 'smooth' },
      ],
    };
  }

  // 1. Initial point extraction with jitter filtration
  const intensityNorm = Math.max(0, Math.min(100, smoothingIntensity)) / 100;
  const rawPts: { x: number; y: number; pressure: number; time?: number; pointerType?: string }[] = [];
  const minJitterDistSq = intensityNorm <= 0.05 ? 0.25 : 0.8;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    let pres = 0.5;
    if (pressureSensitivity !== 'off' && 'pressure' in pt && typeof pt.pressure === 'number' && pt.pressure > 0) {
      pres = pt.pressure;
    }
    const t = 'time' in pt && typeof pt.time === 'number' ? pt.time : undefined;
    const ptrType = 'pointerType' in pt && typeof pt.pointerType === 'string' ? pt.pointerType : undefined;
    if (rawPts.length === 0) {
      rawPts.push({ x: pt.x, y: pt.y, pressure: pres, time: t, pointerType: ptrType });
    } else {
      const prev = rawPts[rawPts.length - 1];
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      if (dx * dx + dy * dy >= minJitterDistSq) {
        rawPts.push({ x: pt.x, y: pt.y, pressure: pres, time: t, pointerType: ptrType });
      }
    }
  }

  if (rawPts.length < 2) {
    const p = rawPts[0] || { x: 500, y: 500, pressure: 0.5 };
    return strokePointsToOutline([p], strokeWidth, style, roundCap, pressureSensitivity, pressureCurve, smoothingIntensity);
  }

  const numRaw = rawPts.length;

  // Check if stroke was created using a mouse or touch
  const isMouseInput = rawPts.some((p) => p.pointerType === 'mouse');
  const isTouchInput = rawPts.some((p) => p.pointerType === 'touch');

  // For mouse inputs: gentle 1px sub-pixel noise filtering without cutting sharp corners
  if (isMouseInput && rawPts.length >= 4) {
    const origX = rawPts.map((p) => p.x);
    const origY = rawPts.map((p) => p.y);
    for (let i = 1; i < rawPts.length - 1; i++) {
      rawPts[i].x = origX[i - 1] * 0.10 + origX[i] * 0.80 + origX[i + 1] * 0.10;
      rawPts[i].y = origY[i - 1] * 0.10 + origY[i] * 0.80 + origY[i + 1] * 0.10;
    }
  }

  // Compute cumulative physical arc-length along raw points
  const rawArcLengths = new Float64Array(numRaw);
  for (let i = 1; i < numRaw; i++) {
    const dx = rawPts[i].x - rawPts[i - 1].x;
    const dy = rawPts[i].y - rawPts[i - 1].y;
    rawArcLengths[i] = rawArcLengths[i - 1] + Math.hypot(dx, dy);
  }
  const totalRawArcLen = rawArcLengths[numRaw - 1];

  // Auto-Straight Line Detection:
  // If the user intended to draw a straight line (low deviation from end-to-end chord line),
  // automatically flatten micro-wobbles so the stroke becomes a crisp straight line
  if (numRaw >= 4 && totalRawArcLen > 25) {
    const pStart = rawPts[0];
    const pEnd = rawPts[numRaw - 1];
    const chordDist = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
    const straightnessRatio = chordDist / totalRawArcLen;

    if (chordDist > 1) {
      const dx = pEnd.x - pStart.x;
      const dy = pEnd.y - pStart.y;
      let maxDev = 0;
      for (let i = 1; i < numRaw - 1; i++) {
        const dev = Math.abs(dy * rawPts[i].x - dx * rawPts[i].y + pEnd.x * pStart.y - pEnd.y * pStart.x) / chordDist;
        if (dev > maxDev) maxDev = dev;
      }

      // If stroke is genuinely intended as a straight line (high straightness ratio & tiny deviation), straighten raw points
      const isAutoStraight =
        !options?.disableAutoStraight &&
        straightnessRatio > 0.998 &&
        maxDev < Math.min(1.8, totalRawArcLen * 0.012);
      if (isAutoStraight) {
        for (let i = 1; i < numRaw - 1; i++) {
          const t = rawArcLengths[i] / totalRawArcLen;
          rawPts[i].x = pStart.x + dx * t;
          rawPts[i].y = pStart.y + dy * t;
        }
      }
    }
  }

  // Calculate instantaneous velocities (px/ms) along raw points to drive calligraphic ink dynamics
  const rawSpeeds = new Float64Array(numRaw);
  let validTimeCount = 0;
  for (let i = 1; i < numRaw; i++) {
    const t0 = rawPts[i - 1].time;
    const t1 = rawPts[i].time;
    if (typeof t0 === 'number' && typeof t1 === 'number' && t1 > t0) {
      const dt = Math.max(8, t1 - t0);
      const ds = rawArcLengths[i] - rawArcLengths[i - 1];
      rawSpeeds[i] = Math.max(0.08, Math.min(2.5, ds / dt));
      validTimeCount++;
    } else {
      rawSpeeds[i] = rawSpeeds[i - 1] || 0.5;
    }
  }
  if (validTimeCount > 0) {
    rawSpeeds[0] = rawSpeeds[1] || 0.5;
    const speedPasses = isMouseInput ? 4 : 2;
    for (let p = 0; p < speedPasses; p++) {
      for (let i = 1; i < numRaw - 1; i++) {
        rawSpeeds[i] = (rawSpeeds[i - 1] + rawSpeeds[i] * 2 + rawSpeeds[i + 1]) * 0.25;
      }
    }
  } else {
    rawSpeeds.fill(0.5);
  }

  // 2. Continuous Spatial Gaussian smoothing over physical arc-length
  // Eliminates low-speed wobble and sensor tremors uniformly regardless of drawing speed
  // For mouse input, provides an advanced stabilizer bonus to suppress hand tremors and pixel stepping
  const smoothX = new Float64Array(numRaw);
  const smoothY = new Float64Array(numRaw);
  const smoothP = new Float64Array(numRaw);
  const smoothV = new Float64Array(numRaw);

  if (numRaw >= 3 && intensityNorm > 0.05 && totalRawArcLen > 2) {
    // Physical filter radius in font coordinate units
    const baseSigma = isMouseInput ? 2.2 : 1.8;
    const maxSigmaBonus = isMouseInput ? 11.0 : 13.0;
    const sigma = baseSigma + maxSigmaBonus * intensityNorm;
    const filterRadius = sigma * 2.5;
    const twoSigmaSq = 2 * sigma * sigma;

    for (let i = 0; i < numRaw; i++) {
      // Keep exact start and end endpoints anchored
      if (i === 0 || i === numRaw - 1) {
        smoothX[i] = rawPts[i].x;
        smoothY[i] = rawPts[i].y;
        smoothP[i] = isMouseInput ? 0.5 : rawPts[i].pressure;
        smoothV[i] = rawSpeeds[i];
        continue;
      }

      const sCenter = rawArcLengths[i];
      let sumW = 0;
      let sumX = 0;
      let sumY = 0;
      let sumP = 0;
      let sumV = 0;

      // Scan backwards within filterRadius
      for (let j = i; j >= 0; j--) {
        const ds = sCenter - rawArcLengths[j];
        if (ds > filterRadius) break;
        const w = Math.exp(-(ds * ds) / twoSigmaSq);
        sumW += w;
        sumX += rawPts[j].x * w;
        sumY += rawPts[j].y * w;
        sumP += rawPts[j].pressure * w;
        sumV += rawSpeeds[j] * w;
      }
      // Scan forwards within filterRadius
      for (let j = i + 1; j < numRaw; j++) {
        const ds = rawArcLengths[j] - sCenter;
        if (ds > filterRadius) break;
        const w = Math.exp(-(ds * ds) / twoSigmaSq);
        sumW += w;
        sumX += rawPts[j].x * w;
        sumY += rawPts[j].y * w;
        sumP += rawPts[j].pressure * w;
        sumV += rawSpeeds[j] * w;
      }

      if (sumW > 0.0001) {
        // Taper smoothing near stroke endpoints so entry/exit tips remain sharp and responsive
        const distFromEnd = Math.min(sCenter, totalRawArcLen - sCenter);
        const endBlend = Math.min(1.0, distFromEnd / Math.max(3.0, sigma * 0.75));
        smoothX[i] = rawPts[i].x * (1 - endBlend) + (sumX / sumW) * endBlend;
        smoothY[i] = rawPts[i].y * (1 - endBlend) + (sumY / sumW) * endBlend;
        smoothP[i] = rawPts[i].pressure * (1 - endBlend) + (sumP / sumW) * endBlend;
        smoothV[i] = rawSpeeds[i] * (1 - endBlend) + (sumV / sumW) * endBlend;
      } else {
        smoothX[i] = rawPts[i].x;
        smoothY[i] = rawPts[i].y;
        smoothP[i] = rawPts[i].pressure;
        smoothV[i] = rawSpeeds[i];
      }
    }
  } else {
    for (let i = 0; i < numRaw; i++) {
      smoothX[i] = rawPts[i].x;
      smoothY[i] = rawPts[i].y;
      smoothP[i] = rawPts[i].pressure;
      smoothV[i] = rawSpeeds[i];
    }
  }

  // Monotone Cubic Hermite Tangents for continuous C1 pressure interpolation without step artifacts
  const pTangents = new Float64Array(numRaw);
  if (numRaw >= 2) {
    const secants = new Float64Array(numRaw - 1);
    for (let k = 0; k < numRaw - 1; k++) {
      const ds = Math.max(0.001, rawArcLengths[k + 1] - rawArcLengths[k]);
      secants[k] = (smoothP[k + 1] - smoothP[k]) / ds;
    }
    pTangents[0] = secants[0];
    pTangents[numRaw - 1] = secants[numRaw - 2];
    for (let k = 1; k < numRaw - 1; k++) {
      if (secants[k - 1] * secants[k] <= 0) {
        pTangents[k] = 0;
      } else {
        pTangents[k] = (secants[k - 1] + secants[k]) * 0.5;
      }
    }
  }

  const evalHermitePressure = (k: number, u: number, h: number): number => {
    const p0 = smoothP[k];
    const p1 = smoothP[k + 1];
    const m0 = pTangents[k] * h;
    const m1 = pTangents[k + 1] * h;
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    const val = h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
    return Math.max(0.0, Math.min(1.0, val));
  };

  // Centripetal Catmull-Rom spline evaluator: alpha = 0.5 mathematically prevents self-intersections and cusps
  const evalCentripetalCatmullRom = (
    p0x: number, p0y: number,
    p1x: number, p1y: number,
    p2x: number, p2y: number,
    p3x: number, p3y: number,
    u: number
  ): { x: number; y: number } => {
    const d01 = Math.pow(Math.hypot(p1x - p0x, p1y - p0y), 0.5) || 0.0001;
    const d12 = Math.pow(Math.hypot(p2x - p1x, p2y - p1y), 0.5) || 0.0001;
    const d23 = Math.pow(Math.hypot(p3x - p2x, p3y - p2y), 0.5) || 0.0001;

    const t0 = 0;
    const t1 = t0 + d01;
    const t2 = t1 + d12;
    const t3 = t2 + d23;

    const t = t1 + u * (t2 - t1);

    const a1x = ((t1 - t) * p0x + (t - t0) * p1x) / (t1 - t0);
    const a1y = ((t1 - t) * p0y + (t - t0) * p1y) / (t1 - t0);
    const a2x = ((t2 - t) * p1x + (t - t1) * p2x) / (t2 - t1);
    const a2y = ((t2 - t) * p1y + (t - t1) * p2y) / (t2 - t1);
    const a3x = ((t3 - t) * p2x + (t - t2) * p3x) / (t3 - t2);
    const a3y = ((t3 - t) * p2y + (t - t2) * p3y) / (t3 - t2);

    const b1x = ((t2 - t) * a1x + (t - t0) * a2x) / (t2 - t0);
    const b1y = ((t2 - t) * a1y + (t - t0) * a2y) / (t2 - t0);
    const b2x = ((t3 - t) * a2x + (t - t1) * a3x) / (t3 - t1);
    const b2y = ((t3 - t) * a2y + (t - t1) * a3y) / (t3 - t1);

    const cx = ((t2 - t) * b1x + (t - t1) * b2x) / (t2 - t1);
    const cy = ((t2 - t) * b1y + (t - t1) * b2y) / (t2 - t1);

    return { x: cx, y: cy };
  };

  // 3. Resample & Spline-Interpolate centerline at fine sub-segment physical intervals
  // Guarantees silky smooth curves without polygonal chords or pressure discretization jitter
  const densityMultiplier = options?.density === 'ultra' ? 0.75 : options?.density === 'normal' ? 1.4 : 1.0;
  const customStep = options?.subdivisionStep;
  const stepTarget = (customStep || (intensityNorm <= 0.05 ? 1.25 : 1.25 + 0.75 * intensityNorm)) * densityMultiplier;

  const resampled: { x: number; y: number; pressure: number; speed?: number; time?: number }[] = [];
  resampled.push({ x: smoothX[0], y: smoothY[0], pressure: smoothP[0], speed: smoothV[0], time: rawPts[0].time });

  for (let i = 0; i < numRaw - 1; i++) {
    const p0x = i > 0 ? smoothX[i - 1] : smoothX[i];
    const p0y = i > 0 ? smoothY[i - 1] : smoothY[i];
    const p1x = smoothX[i];
    const p1y = smoothY[i];
    const p1v = smoothV[i];
    const p2x = smoothX[i + 1];
    const p2y = smoothY[i + 1];
    const p2v = smoothV[i + 1];
    const p3x = i + 2 < numRaw ? smoothX[i + 2] : p2x;
    const p3y = i + 2 < numRaw ? smoothY[i + 2] : p2y;

    const segDist = Math.hypot(p2x - p1x, p2y - p1y);
    const subSteps = Math.max(1, Math.ceil(segDist / stepTarget));

    for (let s = 1; s <= subSteps; s++) {
      const u = s / subSteps;
      const pt = evalCentripetalCatmullRom(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, u);
      const pres = evalHermitePressure(i, u, segDist);
      const vel = p1v + (p2v - p1v) * u;
      resampled.push({ x: pt.x, y: pt.y, pressure: pres, speed: vel });
    }
  }

  const n = resampled.length;
  if (n < 2) {
    return strokePointsToOutline([resampled[0]], strokeWidth, style, roundCap, pressureSensitivity, pressureCurve);
  }

  // 4. Cumulative distance
  const dists = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const dx = resampled[i].x - resampled[i - 1].x;
    const dy = resampled[i].y - resampled[i - 1].y;
    dists[i] = dists[i - 1] + Math.hypot(dx, dy);
  }
  const totalLength = dists[n - 1] || 1;

  // 5. Continuous Tangents and Normals (with smooth moving window to prevent curve jitter)
  const txArr = new Float64Array(n);
  const tyArr = new Float64Array(n);
  const nxArr = new Float64Array(n);
  const nyArr = new Float64Array(n);
  const turnArr = new Float64Array(n);

  const windowRadius = Math.max(2, Math.min(6, Math.round(16 / stepTarget)));
  for (let i = 0; i < n; i++) {
    const prevIdx = Math.max(0, i - windowRadius);
    const nextIdx = Math.min(n - 1, i + windowRadius);
    let dx = resampled[nextIdx].x - resampled[prevIdx].x;
    let dy = resampled[nextIdx].y - resampled[prevIdx].y;
    if (dx * dx + dy * dy < 0.000001) {
      dx = resampled[Math.min(n - 1, i + 1)].x - resampled[Math.max(0, i - 1)].x;
      dy = resampled[Math.min(n - 1, i + 1)].y - resampled[Math.max(0, i - 1)].y;
    }
    const len = Math.hypot(dx, dy) || 1;
    txArr[i] = dx / len;
    tyArr[i] = dy / len;
  }

  // Smooth tangent vectors along curves to eliminate microscopic direction jitter
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < n - 1; i++) {
      const avgTx = txArr[i - 1] * 0.25 + txArr[i] * 0.5 + txArr[i + 1] * 0.25;
      const avgTy = tyArr[i - 1] * 0.25 + tyArr[i] * 0.5 + tyArr[i + 1] * 0.25;
      const len = Math.hypot(avgTx, avgTy) || 1;
      txArr[i] = avgTx / len;
      tyArr[i] = avgTy / len;
    }
  }

  for (let i = 0; i < n; i++) {
    nxArr[i] = -tyArr[i];
    nyArr[i] = txArr[i];

    if (i > 0 && i < n - 1) {
      // Signed turn angle (cross product of previous and next tangents)
      const cross = txArr[i - 1] * tyArr[i + 1] - tyArr[i - 1] * txArr[i + 1];
      const dot = txArr[i - 1] * txArr[i + 1] + tyArr[i - 1] * tyArr[i + 1];
      turnArr[i] = Math.atan2(cross, Math.max(-1, Math.min(1, dot)));
    }
  }

  // Detect if the stroke finishes with a dynamic calligraphic flick (払い・跳ね)
  // Evaluates terminal pressure, terminal velocity, and curvature snap
  let isTailFlick = false;
  if (n >= 4 && totalLength > 15) {
    const pEnd = resampled[n - 1].pressure ?? 0.5;
    const pBefore = resampled[Math.max(0, Math.floor(n * 0.7))].pressure ?? 0.5;
    const vEnd = resampled[n - 1].speed ?? 0.5;
    const vBefore = resampled[Math.max(0, Math.floor(n * 0.7))].speed ?? 0.5;

    // A: Pressure dropped significantly towards the end (pen lift on stylus)
    const isStylusStroke = rawPts.some((p) => p.pointerType === 'pen');
    const isPressureDropping = isStylusStroke && pressureSensitivity !== 'off' && (pEnd < 0.38 || (pEnd - pBefore) < -0.12);
    // B: High velocity flick or acceleration towards end (fast deliberate swipe)
    const isSpeedFlick = isStylusStroke ? (vEnd > 1.05 || (vEnd > 0.72 && vEnd > vBefore * 1.25)) : (vEnd > 1.8 && vEnd > vBefore * 1.5);
    // C: Terminal hook / jump (跳ね) with quick release
    const endTurnAngle = Math.abs(turnArr[Math.max(0, n - 2)] || 0);
    const isHookFlick = isStylusStroke && endTurnAngle > 0.32 && (vEnd > 0.60 || pEnd < 0.45);

    isTailFlick = isPressureDropping || isSpeedFlick || isHookFlick;
  }

  // 6. Width Modulation calculation
  const rawLeftWidths = new Float64Array(n);
  const rawRightWidths = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const normDist = dists[i] / totalLength;

    let pointPressure = 0.5;
    if (pressureSensitivity === 'off') {
      pointPressure = 0.5;
    } else {
      const rawP = resampled[i].pressure ?? 0.5;
      pointPressure = evaluatePressureCurve(rawP, pressureCurve, pressureSensitivity);
    }

    let leftHalfWidth = strokeWidth / 2;
    let rightHalfWidth = strokeWidth / 2;

    if (style === 'signpen') {
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.35 + 1.15 * Math.pow(pointPressure, 1.0));
      leftHalfWidth = rightHalfWidth = Math.max(3, (strokeWidth / 2) * presFactor);
    } else if (style === 'sumi') {
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.22 + 1.40 * Math.pow(pointPressure, 1.05));
      let sumiPool = 1.0;
      if (normDist < 0.12) {
        const t = (0.12 - normDist) / 0.12;
        sumiPool += 0.35 * Math.sin(t * Math.PI * 0.5);
      } else if (normDist > 0.82) {
        const t = (normDist - 0.82) / 0.18;
        if (isTailFlick) {
          sumiPool = Math.max(0.08, Math.pow(1.0 - t, 1.35));
        } else {
          sumiPool += 0.25 * Math.sin(t * Math.PI);
        }
      }
      const absTurn = Math.abs(turnArr[i]);
      if (absTurn > 0.40) {
        sumiPool += Math.min(0.25, (absTurn / Math.PI) * 0.25);
      }
      leftHalfWidth = rightHalfWidth = Math.max(3, (strokeWidth / 2) * presFactor * sumiPool);
    } else if (style === 'marumoji') {
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.45 + 0.95 * pointPressure);
      let bubbleEnd = 1.0;
      if (normDist < 0.12) {
        const t = Math.sin((normDist / 0.12) * Math.PI * 0.5);
        bubbleEnd = 1.25 - 0.25 * t;
      } else if (normDist > 0.88) {
        const t = Math.sin(((normDist - 0.88) / 0.12) * Math.PI * 0.5);
        bubbleEnd = 1.0 + 0.25 * t;
      }
      leftHalfWidth = rightHalfWidth = Math.max(4, (strokeWidth / 2) * presFactor * bubbleEnd);
    } else if (style === 'brush') {
      const ux = txArr[i];
      const uy = tyArr[i];
      const nx = nxArr[i];
      const ny = nyArr[i];

      // 1. 書道の筆運び角と方向性モジュレーション（優雅で滑らかな筆勢）
      const diagRightDown = (ux + uy) * 0.7071;
      let dirWeight = 1.0;
      if (uy > 0.15) {
        if (diagRightDown > 0.35) {
          dirWeight = 1.0 + 0.18 * diagRightDown;
        } else {
          dirWeight = 1.0 + 0.10 * uy;
        }
      } else if (uy < -0.15) {
        dirWeight = Math.max(0.70, 1.0 + 0.20 * uy);
      } else {
        dirWeight = 0.88 + 0.12 * Math.abs(uy);
      }

      // 2. 速度（Velocity）および筆圧による動的インク量
      const localSpeed = resampled[i].speed ?? 0.5;
      const speedMul = Math.max(0.80, Math.min(1.20, 1.08 - localSpeed * 0.16));

      let presFactor = 1.0;
      if (pressureSensitivity === 'off') {
        presFactor = speedMul;
      } else {
        const p = pointPressure;
        const pSens = Math.pow(p, 1.0);
        presFactor = (0.35 + 1.15 * pSens) * (0.90 + 0.15 * speedMul);
      }

      const baseWidth = (strokeWidth / 2) * dirWeight * presFactor;

      // 3. 毛筆の左右非対称性（抑えめにして自然な筆脈を確保）
      const bellyX = 0.7071;
      const bellyY = 0.7071;
      const leftBellyProj = nx * bellyX + ny * bellyY;
      const asymBias = 0.06 * leftBellyProj;
      let leftMul = 1.0 + asymBias;
      let rightMul = 1.0 - asymBias;

      // 4. 転折（Tensetsu - 漢字の折れでのなめらかな張り）
      const localTurn = turnArr[i];
      if (Math.abs(localTurn) > 0.20) {
        const shoulder = Math.min(0.18, Math.abs(localTurn) * 0.15);
        if (localTurn > 0) rightMul += shoulder;
        else leftMul += shoulder;
      }

      // 5. 自然でなめらかな起筆・終筆（急激な太さ段差を排除）
      if (normDist < 0.15) {
        const t = normDist / 0.15;
        const smoothEntry = 0.65 + 0.35 * (0.5 - 0.5 * Math.cos(t * Math.PI));
        leftMul *= smoothEntry;
        rightMul *= smoothEntry;
      } else if (normDist > 0.82) {
        const t = (normDist - 0.82) / 0.18;
        if (isTailFlick) {
          const taper = Math.max(0.12, 1.0 - 0.88 * Math.sin(t * Math.PI * 0.5));
          leftMul *= taper;
          rightMul *= taper;
        } else {
          const smoothExit = 1.0 - 0.28 * (0.5 - 0.5 * Math.cos(t * Math.PI));
          leftMul *= smoothExit;
          rightMul *= smoothExit;
        }
      }

      leftHalfWidth = Math.max(2.0, baseWidth * leftMul);
      rightHalfWidth = Math.max(2.0, baseWidth * rightMul);
    } else if (style === 'fountain') {
      const ux = txArr[i];
      const uy = tyArr[i];
      const angle = Math.atan2(Math.abs(uy), Math.abs(ux) + 0.001);
      const isDownward = uy > 0 ? 0.40 * uy : 0;
      const angleContrast = 0.25 + 0.85 * Math.sin(angle) + isDownward;
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.20 + 1.40 * Math.pow(pointPressure, 1.15));
      leftHalfWidth = rightHalfWidth = Math.max(2.0, (strokeWidth / 2) * angleContrast * presFactor);
    } else if (style === 'mincho_nib') {
      const ux = txArr[i];
      const uy = tyArr[i];
      const vertContrast = 0.38 + 1.12 * Math.pow(Math.abs(uy), 0.85);
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.35 + 1.15 * Math.pow(pointPressure, 1.1));
      leftHalfWidth = rightHalfWidth = Math.max(2.0, (strokeWidth / 2) * vertContrast * presFactor);
    } else if (style === 'reisho_chisel') {
      const ux = txArr[i];
      const uy = tyArr[i];
      const flatAngle = Math.atan2(Math.abs(uy * 0.9 + ux * 0.25), Math.abs(ux) + 0.001);
      const reishoContrast = 0.32 + 1.05 * Math.sin(flatAngle);
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.50 + 0.90 * pointPressure);
      leftHalfWidth = rightHalfWidth = Math.max(3.0, (strokeWidth / 2) * reishoContrast * presFactor);
    } else if (style === 'g_pen') {
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.12 + 1.65 * Math.pow(pointPressure, 1.30));
      leftHalfWidth = rightHalfWidth = Math.max(1.5, (strokeWidth / 2) * presFactor);
    } else if (style === 'pixel_dot') {
      leftHalfWidth = rightHalfWidth = Math.max(3.0, strokeWidth / 2);
    } else if (style === 'marker') {
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.55 + 0.70 * pointPressure);
      leftHalfWidth = rightHalfWidth = Math.max(3, (strokeWidth / 2) * presFactor);
    } else if (style === 'ballpoint') {
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.40 + 1.00 * pointPressure);
      leftHalfWidth = rightHalfWidth = Math.max(2, (strokeWidth / 3.0) * presFactor);
    } else if (style === 'chalk') {
      let bubble = 1.0;
      if (normDist < 0.10 || normDist > 0.90) bubble = 1.12;
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.50 + 0.85 * pointPressure);
      leftHalfWidth = rightHalfWidth = Math.max(4, (strokeWidth * 0.54) * presFactor * bubble);
    } else if (style === 'calligraphy') {
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.25 + 1.35 * Math.pow(pointPressure, 1.05));
      leftHalfWidth = rightHalfWidth = Math.max(2.5, (strokeWidth / 2) * presFactor);
    } else if (style === 'highlighter') {
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.70 + 0.50 * pointPressure);
      leftHalfWidth = rightHalfWidth = Math.max(3.0, (strokeWidth / 2) * presFactor);
    } else if (style === 'pencil') {
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.25 + 1.25 * Math.pow(pointPressure, 1.10));
      leftHalfWidth = rightHalfWidth = Math.max(1.8, (strokeWidth / 3.6) * presFactor);
    } else if (style === 'wobbly') {
      const wobbleLeft = Math.sin(normDist * 28 + i * 0.75) * 0.12;
      const wobbleRight = Math.cos(normDist * 32 - i * 0.65) * 0.11;
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.50 + 0.80 * pointPressure);
      leftHalfWidth = Math.max(3, (strokeWidth / 2) * (presFactor + wobbleLeft));
      rightHalfWidth = Math.max(3, (strokeWidth / 2) * (presFactor + wobbleRight));
    }

    // Apply custom preset parameters if provided (ibisPaint brush customization)
    const cp = options?.customPreset;
    if (cp) {
      // 1. Tapering (入り抜き) - Continuous S-curve transition to eliminate abrupt width jumps
      const startLen = Math.min(0.40, (cp.taperStartLength ?? 0) / 100);
      const endLen = Math.min(0.40, (cp.taperEndLength ?? 0) / 100);
      const startW = Math.max(0.12, (cp.taperStartWidth ?? 100) / 100);
      const endW = Math.max(0.12, (cp.taperEndWidth ?? 100) / 100);

      let taperMultiplier = 1.0;
      if (startLen > 0.001 && normDist < startLen) {
        const t = Math.max(0, Math.min(1.0, normDist / startLen));
        const smoothT = cp.taperTipShape === 'sharp' ? Math.pow(t, 1.5) : 0.5 - 0.5 * Math.cos(t * Math.PI);
        taperMultiplier *= startW + (1.0 - startW) * smoothT;
      }
      if (endLen > 0.001 && normDist > 1.0 - endLen) {
        const t = Math.max(0, Math.min(1.0, (1.0 - normDist) / endLen));
        const smoothT = cp.taperTipShape === 'sharp' ? Math.pow(t, 1.5) : 0.5 - 0.5 * Math.cos(t * Math.PI);
        taperMultiplier *= endW + (1.0 - endW) * smoothT;
      }

      // 2. Nib Shape (扁平率・角度・回転追従)
      let shapeMultiplier = 1.0;
      const aspect = Math.min(0.85, (cp.nibAspectRatio ?? 0) / 100);
      if (aspect > 0.01) {
        const angleDeg = cp.nibAngle ?? 0;
        const angleRad = (angleDeg * Math.PI) / 180;
        let deltaTheta = 0;
        if (cp.nibFollowDirection) {
          const tanTheta = Math.atan2(tyArr[i], txArr[i]);
          deltaTheta = tanTheta - angleRad;
        } else {
          const normTheta = Math.atan2(nyArr[i], nxArr[i]);
          deltaTheta = normTheta - angleRad;
        }
        const flatRatio = Math.max(0.35, 1.0 - 0.65 * aspect);
        shapeMultiplier = Math.max(0.35, Math.sqrt(Math.pow(Math.cos(deltaTheta), 2) + Math.pow(flatRatio * Math.sin(deltaTheta), 2)));
      }

      // 3. Dynamic Speed Modulation (滑らかな速度変化)
      let speedMultiplier = 1.0;
      if (cp.speedWidthFactor && cp.speedWidthFactor !== 0) {
        const speedVal = resampled[i].speed ?? 0.5;
        const factor = (cp.speedWidthFactor / 100) * 0.35;
        speedMultiplier = Math.max(0.70, Math.min(1.30, 1.0 + factor * (speedVal - 0.5)));
      }

      // 4. Organic Natural Jitter (和紙・自然なかすれテイスト)
      let jitterMultiplier = 1.0;
      if (cp.jitterSize && cp.jitterSize > 0) {
        const organicNoise = Math.sin(i * 0.18) * 0.5 + Math.sin(i * 0.45) * 0.3 + Math.cos(i * 0.85) * 0.2;
        jitterMultiplier = 1.0 + organicNoise * (cp.jitterSize / 100) * 0.15;
      }

      leftHalfWidth *= taperMultiplier * shapeMultiplier * speedMultiplier * jitterMultiplier;
      rightHalfWidth *= taperMultiplier * shapeMultiplier * speedMultiplier * jitterMultiplier;
    }

    // Safety checks for custom brush parameters: prevent NaN, Infinity, or negative width collapse
    if (isNaN(leftHalfWidth) || !isFinite(leftHalfWidth) || leftHalfWidth < 0.5) {
      leftHalfWidth = 1.0;
    }
    if (isNaN(rightHalfWidth) || !isFinite(rightHalfWidth) || rightHalfWidth < 0.5) {
      rightHalfWidth = 1.0;
    }

    rawLeftWidths[i] = leftHalfWidth;
    rawRightWidths[i] = rightHalfWidth;
  }

  // Curvature-based inner edge safety check (applied BEFORE width smoothing)
  // Only activates when the turn radius is genuinely tighter than the stroke half-width,
  // preventing loop knots while width smoothing smoothly diffuses the transition without creating notches or gouges.
  for (let i = 2; i < n - 2; i++) {
    const turn = turnArr[i];
    const absTurn = Math.abs(turn);
    if (absTurn > 0.08) {
      const stepDist = dists[Math.min(n - 1, i + 2)] - dists[Math.max(0, i - 2)];
      const radiusOfCurvature = stepDist / (absTurn * 2);
      if (radiusOfCurvature < strokeWidth * 0.75) {
        const safeInnerW = Math.max(2.5, radiusOfCurvature * 0.95);
        if (turn > 0 && rawLeftWidths[i] > safeInnerW) {
          rawLeftWidths[i] = safeInnerW;
        } else if (turn < 0 && rawRightWidths[i] > safeInnerW) {
          rawRightWidths[i] = safeInnerW;
        }
      }
    }
  }

  // 7. Width Smoothing Pass (Adaptive pass count for silky smooth transitions)
  const smoothedLeftWidths = new Float64Array(n);
  const smoothedRightWidths = new Float64Array(n);
  smoothedLeftWidths.set(rawLeftWidths);
  smoothedRightWidths.set(rawRightWidths);

  const defaultPasses = intensityNorm > 0.05 ? Math.max(2, Math.round(2 + 4 * intensityNorm)) : 2;
  const customPasses = options?.customPreset ? 16 : 0;
  const widthPasses = Math.max(options?.widthSmoothingPasses ?? defaultPasses, customPasses);
  for (let pass = 0; pass < widthPasses; pass++) {
    for (let i = 1; i < n - 1; i++) {
      smoothedLeftWidths[i] = (smoothedLeftWidths[i - 1] + smoothedLeftWidths[i] * 2 + smoothedLeftWidths[i + 1]) * 0.25;
      smoothedRightWidths[i] = (smoothedRightWidths[i - 1] + smoothedRightWidths[i] * 2 + smoothedRightWidths[i + 1]) * 0.25;
    }
    if (n >= 2) {
      smoothedLeftWidths[0] = smoothedLeftWidths[0] * 0.70 + smoothedLeftWidths[1] * 0.30;
      smoothedRightWidths[0] = smoothedRightWidths[0] * 0.70 + smoothedRightWidths[1] * 0.30;
      smoothedLeftWidths[n - 1] = smoothedLeftWidths[n - 1] * 0.70 + smoothedLeftWidths[n - 2] * 0.30;
      smoothedRightWidths[n - 1] = smoothedRightWidths[n - 1] * 0.70 + smoothedRightWidths[n - 2] * 0.30;
    }
  }

  // Width rate of change with respect to arc length for boundary curvature calculations
  const dwL_ds = new Float64Array(n);
  const dwR_ds = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const prevIdx = Math.max(0, i - 1);
    const nextIdx = Math.min(n - 1, i + 1);
    const ds = Math.max(0.001, dists[nextIdx] - dists[prevIdx]);
    dwL_ds[i] = (smoothedLeftWidths[nextIdx] - smoothedLeftWidths[prevIdx]) / ds;
    dwR_ds[i] = (smoothedRightWidths[nextIdx] - smoothedRightWidths[prevIdx]) / ds;
  }

  // 8. Chisel Ribbon vs Normal Offset Coordinates
  const isChiselStyle = style === 'calligraphy' || style === 'highlighter';
  const chiselAngleRad = style === 'highlighter' ? (90 * Math.PI) / 180 : (45 * Math.PI) / 180;
  const chiselDx = Math.cos(chiselAngleRad);
  const chiselDy = Math.sin(chiselAngleRad);

  const rightOffsets: Point[] = new Array(n);
  const leftOffsets: Point[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const nx = nxArr[i];
    const ny = nyArr[i];
    const lw = smoothedLeftWidths[i];
    const rw = smoothedRightWidths[i];

    if (isChiselStyle) {
      // 法線ベクトルとチゼルベクトルの内積により、進行方向に対する「左側」を常に正しく判定
      const dotN = chiselDx * nx + chiselDy * ny;
      const sign = dotN >= 0 ? 1 : -1;
      const cLeftX = chiselDx * sign;
      const cLeftY = chiselDy * sign;

      // チゼル角度とストロークが平行に動いた際のリボンの潰れ・裏返りを防ぐ最小厚み
      const minEdgeThickness = Math.max(2.0, (strokeWidth / 2) * 0.09);

      leftOffsets[i] = {
        x: Number((resampled[i].x + cLeftX * lw + nx * minEdgeThickness).toFixed(2)),
        y: Number((resampled[i].y + cLeftY * lw + ny * minEdgeThickness).toFixed(2)),
      };
      rightOffsets[i] = {
        x: Number((resampled[i].x - cLeftX * rw - nx * minEdgeThickness).toFixed(2)),
        y: Number((resampled[i].y - cLeftY * rw - ny * minEdgeThickness).toFixed(2)),
      };
    } else {
      rightOffsets[i] = {
        x: Number((resampled[i].x - nx * rw).toFixed(2)),
        y: Number((resampled[i].y - ny * rw).toFixed(2)),
      };
      leftOffsets[i] = {
        x: Number((resampled[i].x + nx * lw).toFixed(2)),
        y: Number((resampled[i].y + ny * lw).toFixed(2)),
      };
    }
  }

  // 9. Adaptive Boundary Sampling
  // Subdivides into adaptive segments where thickness or curvature changes dynamically.
  // When smoothing is turned off or lowered, preserves full fidelity with appropriate minimum step
  // to avoid creating redundant microscopic nodes (e.g. 500+ nodes on a single straight line).
  const baseSampleDist = intensityNorm <= 0.05 ? 6.0 : 6.0 + 4.0 * intensityNorm;
  const sampleTurnThreshold = intensityNorm <= 0.05 ? 0.16 : 0.16 + 0.12 * intensityNorm;

  const sampleRight: { pt: Point; idx: number }[] = [{ pt: rightOffsets[0], idx: 0 }];
  let accumDistRight = 0;
  let accumTurnRight = 0;

  for (let i = 1; i < n; i++) {
    const d = Math.hypot(rightOffsets[i].x - rightOffsets[i - 1].x, rightOffsets[i].y - rightOffsets[i - 1].y);
    accumDistRight += d;
    accumTurnRight += Math.abs(turnArr[i]);
    const isEnd = i === n - 1;
    const localGrad = Math.abs(dwR_ds[i]);
    const localTurn = Math.abs(turnArr[i]);
    const dynamicThresh = Math.max(3.0, baseSampleDist / (1.0 + 5.0 * localGrad + 2.5 * localTurn));

    if (accumDistRight >= dynamicThresh || accumTurnRight >= sampleTurnThreshold || isEnd) {
      sampleRight.push({ pt: rightOffsets[i], idx: i });
      accumDistRight = 0;
      accumTurnRight = 0;
    }
  }

  const sampleLeft: { pt: Point; idx: number }[] = [{ pt: leftOffsets[n - 1], idx: n - 1 }];
  let accumDistLeft = 0;
  let accumTurnLeft = 0;

  for (let i = n - 2; i >= 0; i--) {
    const d = Math.hypot(leftOffsets[i].x - leftOffsets[i + 1].x, leftOffsets[i].y - leftOffsets[i + 1].y);
    accumDistLeft += d;
    accumTurnLeft += Math.abs(turnArr[i]);
    const isStart = i === 0;
    const localGrad = Math.abs(dwL_ds[i]);
    const localTurn = Math.abs(turnArr[i]);
    const dynamicThresh = Math.max(3.0, baseSampleDist / (1.0 + 5.0 * localGrad + 2.5 * localTurn));

    if (accumDistLeft >= dynamicThresh || accumTurnLeft >= sampleTurnThreshold || isStart) {
      sampleLeft.push({ pt: leftOffsets[i], idx: i });
      accumDistLeft = 0;
      accumTurnLeft = 0;
    }
  }

  // 10. Assemble Closed Loop with Semicircular / Tapered Caps
  // Simplify open right and left trajectories individually before capping to preserve 100% of both edges
  const cleanRight = sampleRight.length > 4
    ? simplifyPointsRDP(sampleRight.map((s) => s.pt), 0.45)
    : sampleRight.map((s) => s.pt);
  const cleanLeft = sampleLeft.length > 4
    ? simplifyPointsRDP(sampleLeft.map((s) => s.pt), 0.45)
    : sampleLeft.map((s) => s.pt);

  const loopPoints: Point[] = [];

  // Add Right Side Points
  for (let i = 0; i < cleanRight.length; i++) {
    loopPoints.push(cleanRight[i]);
  }

  // End Cap
  const endP = resampled[n - 1];
  const endTx = txArr[n - 1];
  const endTy = tyArr[n - 1];
  const endNx = nxArr[n - 1];
  const endNy = nyArr[n - 1];
  const endLeftW = smoothedLeftWidths[n - 1];
  const endRightW = smoothedRightWidths[n - 1];
  const endHalfW = (endLeftW + endRightW) / 2;

  const cp = options?.customPreset;
  const isCustomPreset = Boolean(cp);
  const tipShape = cp?.taperTipShape || 'round';
  const isSharpEnd = isCustomPreset
    ? tipShape === 'sharp' || Boolean(cp?.forceTaperEnd) || isTailFlick || endHalfW <= 2.5
    : isTailFlick || endHalfW <= 2.5;

  if (isSharpEnd && !isChiselStyle) {
    // 払い・抜き・鋭利先端：先端を進行方向 tangent に向けて端正に抜く
    const tipExt = Math.max(2.0, Math.min(10.0, endHalfW * 1.15));
    loopPoints.push({
      x: Number((endP.x + endTx * tipExt * 0.45 - endNx * endRightW * 0.45).toFixed(2)),
      y: Number((endP.y + endTy * tipExt * 0.45 - endNy * endRightW * 0.45).toFixed(2)),
    });
    loopPoints.push({
      x: Number((endP.x + endTx * tipExt).toFixed(2)),
      y: Number((endP.y + endTy * tipExt).toFixed(2)),
    });
    loopPoints.push({
      x: Number((endP.x + endTx * tipExt * 0.45 + endNx * endLeftW * 0.45).toFixed(2)),
      y: Number((endP.y + endTy * tipExt * 0.45 + endNy * endLeftW * 0.45).toFixed(2)),
    });
  } else if (roundCap && !isChiselStyle) {
    if (endHalfW > 2.0) {
      // 均等角ステップ（-3pi/8から+3pi/8まで22.5度刻み）による真円接続キャップ
      const capAngles = [-1.178, -0.785, -0.393, 0, 0.393, 0.785, 1.178];
      for (const phi of capAngles) {
        const c = Math.cos(phi);
        const s = Math.sin(phi);
        const normalW = phi < 0 ? endRightW : endLeftW;
        loopPoints.push({
          x: Number((endP.x + endTx * c * endHalfW + endNx * s * normalW).toFixed(2)),
          y: Number((endP.y + endTy * c * endHalfW + endNy * s * normalW).toFixed(2)),
        });
      }
    } else {
      loopPoints.push({
        x: Number((endP.x + endTx * Math.max(1.8, endHalfW * 0.9)).toFixed(2)),
        y: Number((endP.y + endTy * Math.max(1.8, endHalfW * 0.9)).toFixed(2)),
      });
    }
  }

  // Add Left Side Points (traversing backwards)
  for (let i = 0; i < cleanLeft.length; i++) {
    loopPoints.push(cleanLeft[i]);
  }

  // Start Cap (筆の入り・起筆)
  const startP = resampled[0];
  const startTx = txArr[0];
  const startTy = tyArr[0];
  const startNx = nxArr[0];
  const startNy = nyArr[0];
  const startLeftW = smoothedLeftWidths[0];
  const startRightW = smoothedRightWidths[0];
  const startHalfW = (startLeftW + startRightW) / 2;

  const isSharpStart = isCustomPreset
    ? tipShape === 'sharp' || Boolean(cp?.forceTaper) || startHalfW <= 2.5
    : startHalfW <= 2.0;

  if (isSharpStart && !isChiselStyle) {
    // 鋭利な入り・細先（先端に向けて自然なカーブで収束）
    const tipExt = Math.max(2.0, Math.min(10.0, startHalfW * 1.15));
    loopPoints.push({
      x: Number((startP.x - startTx * tipExt * 0.45 + startNx * startLeftW * 0.45).toFixed(2)),
      y: Number((startP.y - startTy * tipExt * 0.45 + startNy * startLeftW * 0.45).toFixed(2)),
    });
    loopPoints.push({
      x: Number((startP.x - startTx * tipExt).toFixed(2)),
      y: Number((startP.y - startTy * tipExt).toFixed(2)),
    });
    loopPoints.push({
      x: Number((startP.x - startTx * tipExt * 0.45 - startNx * startRightW * 0.45).toFixed(2)),
      y: Number((startP.y - startTy * tipExt * 0.45 - startNy * startRightW * 0.45).toFixed(2)),
    });
  } else if (roundCap && !isChiselStyle) {
    if (startHalfW > 2.0) {
      // 均等角ステップ（+3pi/8から-3pi/8まで22.5度刻み）による滑らかな起筆キャップ
      // cleanLeftの終端(+Nx * lw)から-Tx頂点を経てcleanRightの始端(-Nx * rw)へ完全に連続接続
      const capAngles = [1.178, 0.785, 0.393, 0, -0.393, -0.785, -1.178];
      for (const phi of capAngles) {
        const c = Math.cos(phi);
        const s = Math.sin(phi);
        const normalW = phi > 0 ? startLeftW : startRightW;
        loopPoints.push({
          x: Number((startP.x - startTx * c * startHalfW + startNx * s * normalW).toFixed(2)),
          y: Number((startP.y - startTy * c * startHalfW + startNy * s * normalW).toFixed(2)),
        });
      }
    } else {
      loopPoints.push({
        x: Number((startP.x - startTx * Math.max(1.8, startHalfW * 0.9)).toFixed(2)),
        y: Number((startP.y - startTy * Math.max(1.8, startHalfW * 0.9)).toFixed(2)),
      });
    }
  }

  // Remove consecutive duplicates and microscopic jitter (minimum 1.2px distance)
  const cleanLoop: Point[] = [];
  for (let i = 0; i < loopPoints.length; i++) {
    if (cleanLoop.length === 0) {
      cleanLoop.push(loopPoints[i]);
      continue;
    }
    const prev = cleanLoop[cleanLoop.length - 1];
    const curr = loopPoints[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= 1.2) {
      cleanLoop.push(curr);
    }
  }

  const simplifiedLoop: Point[] = cleanLoop;

  // 11. Convert to smooth G1-continuous Bézier nodes
  const total = simplifiedLoop.length;
  const nodes: BezierNode[] = simplifiedLoop.map((p) => ({
    id: generateId(),
    x: p.x,
    y: p.y,
    type: 'smooth',
  }));

  for (let i = 0; i < total; i++) {
    const prev = nodes[(i - 1 + total) % total];
    const curr = nodes[i];
    const next = nodes[(i + 1) % total];

    const vPrevX = curr.x - prev.x;
    const vPrevY = curr.y - prev.y;
    const dPrev = Math.hypot(vPrevX, vPrevY);

    const vNextX = next.x - curr.x;
    const vNextY = next.y - curr.y;
    const dNext = Math.hypot(vNextX, vNextY);

    if (dPrev < 0.1 || dNext < 0.1) {
      curr.handleIn = { x: curr.x, y: curr.y };
      curr.handleOut = { x: curr.x, y: curr.y };
      continue;
    }

    // Chord direction vectors
    const uPrevX = vPrevX / dPrev;
    const uPrevY = vPrevY / dPrev;
    const uNextX = vNextX / dNext;
    const uNextY = vNextY / dNext;

    // Harmonic bisector tangent: unbiased by asymmetric segment distances
    let tanX = uPrevX + uNextX;
    let tanY = uPrevY + uNextY;
    let tanLen = Math.hypot(tanX, tanY);

    if (tanLen < 0.001) {
      // Near 180-degree turnaround: fallback to perpendicular chord
      tanX = -uPrevY;
      tanY = uPrevX;
      tanLen = Math.hypot(tanX, tanY) || 1;
    }

    tanX /= tanLen;
    tanY /= tanLen;

    // Cosine of turning angle between the two incoming/outgoing segment chords
    const dot = uPrevX * uNextX + uPrevY * uNextY;
    const cosAngle = Math.max(-1, Math.min(1, dot));

    // Corner / Tensetsu / Sharp turn detection (永の二画目などの折れ・転折部分の自然な角ノード処理)
    if (cosAngle < 0.76) {
      // Turn angle > ~40 degrees: Mark as corner node to eliminate unnatural bulging / wavy loop artifacts
      curr.type = 'corner';
      if (cosAngle < 0.35) {
        // Sharp ~90-degree corner: align handles strictly along incoming/outgoing edges or retract
        const inL = Math.min(dPrev * 0.22, 22);
        const outL = Math.min(dNext * 0.22, 22);
        curr.handleIn = inL > 0.5 ? {
          x: Number((curr.x - uPrevX * inL).toFixed(2)),
          y: Number((curr.y - uPrevY * inL).toFixed(2)),
        } : null;
        curr.handleOut = outL > 0.5 ? {
          x: Number((curr.x + uNextX * outL).toFixed(2)),
          y: Number((curr.y + uNextY * outL).toFixed(2)),
        } : null;
      } else {
        // Moderate turn (40° to 70°): decoupled handles along respective edge chords
        const inL = Math.min(dPrev * 0.25, 35);
        const outL = Math.min(dNext * 0.25, 35);
        curr.handleIn = {
          x: Number((curr.x - uPrevX * inL).toFixed(2)),
          y: Number((curr.y - uPrevY * inL).toFixed(2)),
        };
        curr.handleOut = {
          x: Number((curr.x + uNextX * outL).toFixed(2)),
          y: Number((curr.y + uNextY * outL).toFixed(2)),
        };
      }
      continue;
    }

    // Curvature damping factor: gentle curves maintain full natural 0.35 bezier ratio,
    // while sharp turns smoothly taper handles to prevent loop knots and kinks
    const cornerDamping = Math.max(0.04, Math.pow((1 + cosAngle) * 0.5, 0.65));
    const handleRatio = 0.35 * cornerDamping;

    const hInLen = Math.min(dPrev * handleRatio, 110);
    const hOutLen = Math.min(dNext * handleRatio, 110);

    curr.handleIn = {
      x: Number((curr.x - tanX * hInLen).toFixed(2)),
      y: Number((curr.y - tanY * hInLen).toFixed(2)),
    };
    curr.handleOut = {
      x: Number((curr.x + tanX * hOutLen).toFixed(2)),
      y: Number((curr.y + tanY * hOutLen).toFixed(2)),
    };
  }

  const resultContour: PathContour = {
    id: generateId(),
    closed: true,
    nodes,
  };

  // Guarantee consistent screen Clockwise winding (TrueType standard)
  if (getContourSignedArea(resultContour) < 0) {
    return reverseContour(resultContour);
  }
  return resultContour;
}

/**
 * Create a rectangle contour
 */

export function outlineOpenContour(contour: PathContour, strokeWidth: number = 60): PathContour {
  if (!contour.nodes || contour.nodes.length === 0) return contour;
  if (contour.closed) return contour;

  const pts: Point[] = [];
  // Sample points along contour
  for (let i = 0; i < contour.nodes.length; i++) {
    const node = contour.nodes[i];
    pts.push({ x: node.x, y: node.y });
  }

  return strokePointsToOutline(pts, strokeWidth, 'brush', true);
}


export function optimizeContourNodes(contours: PathContour[]): PathContour[] {
  if (!contours || contours.length === 0) return [];

  const cleanContours: PathContour[] = [];

  for (const contour of contours) {
    if (!contour.nodes || contour.nodes.length < 2) continue;

    // 1. Integer rounding & handle cleanup
    const rawNodes = contour.nodes.map((node) => {
      const x = Math.round(node.x);
      const y = Math.round(node.y);

      let handleIn: Point | null = null;
      if (node.handleIn) {
        const hx = Math.round(node.handleIn.x);
        const hy = Math.round(node.handleIn.y);
        if (hx !== x || hy !== y) {
          handleIn = { x: hx, y: hy };
        }
      }

      let handleOut: Point | null = null;
      if (node.handleOut) {
        const hx = Math.round(node.handleOut.x);
        const hy = Math.round(node.handleOut.y);
        if (hx !== x || hy !== y) {
          handleOut = { x: hx, y: hy };
        }
      }

      return {
        ...node,
        x,
        y,
        handleIn,
        handleOut,
      };
    });

    // 2. Merge consecutive collocated nodes
    const mergedNodes: BezierNode[] = [];
    for (let i = 0; i < rawNodes.length; i++) {
      const curr = rawNodes[i];
      if (mergedNodes.length === 0) {
        mergedNodes.push(curr);
        continue;
      }

      const prev = mergedNodes[mergedNodes.length - 1];
      const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);

      if (dist < 1.0) {
        // Merge: keep incoming handle from prev and outgoing handle from curr if present
        if (!prev.handleOut && curr.handleOut) {
          prev.handleOut = curr.handleOut;
        }
      } else {
        mergedNodes.push(curr);
      }
    }

    // Check last vs first if closed
    if (contour.closed && mergedNodes.length > 1) {
      const first = mergedNodes[0];
      const last = mergedNodes[mergedNodes.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) < 1.0) {
        if (!first.handleIn && last.handleIn) {
          first.handleIn = last.handleIn;
        }
        mergedNodes.pop();
      }
    }

    if (mergedNodes.length >= 2) {
      cleanContours.push({
        ...contour,
        id: contour.id || generateId(),
        nodes: mergedNodes,
      });
    }
  }

  return cleanContours;
}


export type CubicBezierSegment = [Point, Point, Point, Point] & {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
};

/**
 * Split a cubic bezier curve at parameter t in [0, 1] using de Casteljau's algorithm
 */
export function splitCubicBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): {
  left: CubicBezierSegment;
  right: CubicBezierSegment;
} {
  const p01 = { x: (1 - t) * p0.x + t * p1.x, y: (1 - t) * p0.y + t * p1.y };
  const p12 = { x: (1 - t) * p1.x + t * p2.x, y: (1 - t) * p1.y + t * p2.y };
  const p23 = { x: (1 - t) * p2.x + t * p3.x, y: (1 - t) * p2.y + t * p3.y };

  const p012 = { x: (1 - t) * p01.x + t * p12.x, y: (1 - t) * p01.y + t * p12.y };
  const p123 = { x: (1 - t) * p12.x + t * p23.x, y: (1 - t) * p12.y + t * p23.y };

  const p0123 = { x: (1 - t) * p012.x + t * p123.x, y: (1 - t) * p012.y + t * p123.y };

  const left: CubicBezierSegment = Object.assign([p0, p01, p012, p0123] as [Point, Point, Point, Point], {
    p0,
    p1: p01,
    p2: p012,
    p3: p0123,
  });

  const right: CubicBezierSegment = Object.assign([p0123, p123, p23, p3] as [Point, Point, Point, Point], {
    p0: p0123,
    p1: p123,
    p2: p23,
    p3,
  });

  return {
    left,
    right,
  };
}

/**
 * Insert a new bezier anchor node at a click position pos on a contour
 */
export function insertNodeOnContourAtPoint(
  contour: PathContour,
  pos: Point,
  threshold: number = 18
): { updatedContour: PathContour; newNodeId: string } | null {
  if (!contour || !contour.nodes || contour.nodes.length < 2) return null;

  const numSegments = contour.closed ? contour.nodes.length : contour.nodes.length - 1;
  let bestDist = threshold;
  let bestSegIndex = -1;
  let bestT = 0.5;
  let isCurve = false;

  for (let i = 0; i < numSegments; i++) {
    const nextIdx = (i + 1) % contour.nodes.length;
    const n0 = contour.nodes[i];
    const n1 = contour.nodes[nextIdx];

    const p0 = { x: n0.x, y: n0.y };
    const p1 = n0.handleOut ? { x: n0.handleOut.x, y: n0.handleOut.y } : p0;
    const p3 = { x: n1.x, y: n1.y };
    const p2 = n1.handleIn ? { x: n1.handleIn.x, y: n1.handleIn.y } : p3;

    const hasHandles = !!(n0.handleOut || n1.handleIn);

    if (hasHandles) {
      // Sample 20 points along curve
      const samples = 20;
      for (let s = 1; s < samples; s++) {
        const t = s / samples;
        const omt = 1 - t;
        const cx = omt * omt * omt * p0.x + 3 * omt * omt * t * p1.x + 3 * omt * t * t * p2.x + t * t * t * p3.x;
        const cy = omt * omt * omt * p0.y + 3 * omt * omt * t * p1.y + 3 * omt * t * t * p2.y + t * t * t * p3.y;
        const d = Math.hypot(cx - pos.x, cy - pos.y);
        if (d < bestDist) {
          bestDist = d;
          bestSegIndex = i;
          bestT = t;
          isCurve = true;
        }
      }
    } else {
      // Straight line projection
      const dx = p3.x - p0.x;
      const dy = p3.y - p0.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq > 0) {
        const t = Math.max(0.05, Math.min(0.95, ((pos.x - p0.x) * dx + (pos.y - p0.y) * dy) / lenSq));
        const projX = p0.x + t * dx;
        const projY = p0.y + t * dy;
        const d = Math.hypot(projX - pos.x, projY - pos.y);
        if (d < bestDist) {
          bestDist = d;
          bestSegIndex = i;
          bestT = t;
          isCurve = false;
        }
      }
    }
  }

  if (bestSegIndex === -1) return null;

  const i = bestSegIndex;
  const nextIdx = (i + 1) % contour.nodes.length;
  const n0 = contour.nodes[i];
  const n1 = contour.nodes[nextIdx];
  const newNodeId = generateId();

  let newNode: BezierNode;
  const newNodes = [...contour.nodes];

  if (isCurve) {
    const p0 = { x: n0.x, y: n0.y };
    const p1 = n0.handleOut ? { x: n0.handleOut.x, y: n0.handleOut.y } : p0;
    const p3 = { x: n1.x, y: n1.y };
    const p2 = n1.handleIn ? { x: n1.handleIn.x, y: n1.handleIn.y } : p3;

    const split = splitCubicBezier(p0, p1, p2, p3, bestT);

    // Update n0 handleOut
    newNodes[i] = {
      ...n0,
      handleOut: { x: Math.round(split.left.p1.x), y: Math.round(split.left.p1.y) },
    };

    // Update n1 handleIn
    newNodes[nextIdx] = {
      ...n1,
      handleIn: { x: Math.round(split.right.p2.x), y: Math.round(split.right.p2.y) },
    };

    newNode = {
      id: newNodeId,
      x: Math.round(split.left.p3.x),
      y: Math.round(split.left.p3.y),
      handleIn: { x: Math.round(split.left.p2.x), y: Math.round(split.left.p2.y) },
      handleOut: { x: Math.round(split.right.p1.x), y: Math.round(split.right.p1.y) },
      type: 'smooth',
    };
  } else {
    const p0 = { x: n0.x, y: n0.y };
    const p3 = { x: n1.x, y: n1.y };
    newNode = {
      id: newNodeId,
      x: Math.round(p0.x + bestT * (p3.x - p0.x)),
      y: Math.round(p0.y + bestT * (p3.y - p0.y)),
      type: 'corner',
    };
  }

  // Insert newNode after i
  newNodes.splice(i + 1, 0, newNode);

  return {
    updatedContour: {
      ...contour,
      nodes: newNodes,
    },
    newNodeId,
  };
}

/**
 * Toggle node between smooth (symmetric handles) and corner (sharp)
 */
export function toggleNodeType(node: BezierNode): BezierNode {
  if (node.type === 'smooth' || node.type === 'symmetric') {
    return {
      ...node,
      type: 'corner',
    };
  } else {
    // Convert to smooth: if it has handles, align them; if not, generate smooth handles
    let handleIn = node.handleIn;
    let handleOut = node.handleOut;

    if (handleOut && !handleIn) {
      handleIn = {
        x: Math.round(node.x - (handleOut.x - node.x)),
        y: Math.round(node.y - (handleOut.y - node.y)),
      };
    } else if (handleIn && !handleOut) {
      handleOut = {
        x: Math.round(node.x - (handleIn.x - node.x)),
        y: Math.round(node.y - (handleIn.y - node.y)),
      };
    } else if (handleIn && handleOut) {
      // Average direction and collinearize
      const dxOut = handleOut.x - node.x;
      const dyOut = handleOut.y - node.y;
      const lenOut = Math.hypot(dxOut, dyOut) || 40;
      const dxIn = node.x - handleIn.x;
      const dyIn = node.y - handleIn.y;
      const lenIn = Math.hypot(dxIn, dyIn) || 40;

      const avgDx = (dxOut / lenOut + dxIn / lenIn) / 2;
      const avgDy = (dyOut / lenOut + dyIn / lenIn) / 2;
      const norm = Math.hypot(avgDx, avgDy) || 1;
      const dirX = avgDx / norm;
      const dirY = avgDy / norm;

      handleOut = {
        x: Math.round(node.x + dirX * lenOut),
        y: Math.round(node.y + dirY * lenOut),
      };
      handleIn = {
        x: Math.round(node.x - dirX * lenIn),
        y: Math.round(node.y - dirY * lenIn),
      };
    } else {
      // Generate default horizontal smooth handles
      const hLen = 35;
      handleIn = { x: Math.round(node.x - hLen), y: Math.round(node.y) };
      handleOut = { x: Math.round(node.x + hLen), y: Math.round(node.y) };
    }

    return {
      ...node,
      type: 'smooth',
      handleIn,
      handleOut,
    };
  }
}

export interface NodeOptimizationOptions {
  /**
   * 最適化強度:
   * - 'mild': 直線上の冗長ノード（共線点）と重複点のみを精密に除去。文字形状の変化率 0%
   * - 'normal': 直線上の冗長ノード除去に加え、曲線の微細なブレを滑らかに整流。形状保持 99.8%
   * - 'strong': 過剰ノードをしっかり間引いてスリム化。形状保持 99.0%
   */
  level?: 'mild' | 'normal' | 'strong';
  /** 直線共線性判定の許容公差（px）。デフォルト: normalで1.3px */
  tolerance?: number;
  /** 直線共線性判定の最大角度ズレ（度）。デフォルト: normalで3.5度 */
  angleToleranceDeg?: number;
  /** トメ・ハネ・角を厳格に保持するかどうか（デフォルト: true） */
  preserveSharpCorners?: boolean;
  /** バウンディングボックスの最大許容変位（px、デフォルト: 1.5px） */
  maxBboxDeviation?: number;
}

export interface NodeOptimizationResult {
  contours: PathContour[];
  originalNodeCount: number;
  optimizedNodeCount: number;
  reducedCount: number;
  reductionPercentage: number;
  changed: boolean;
}

/**
 * 点Pから線分ABへの垂直距離と投影比率tを計算
 */
function getPointToSegmentDistanceAndT(
  p: Point,
  a: Point,
  b: Point
): { dist: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) {
    return { dist: Math.hypot(p.x - a.x, p.y - a.y), t: 0 };
  }

  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  const clampedT = Math.max(0, Math.min(1, t));
  const projX = a.x + clampedT * dx;
  const projY = a.y + clampedT * dy;

  return {
    dist: Math.hypot(p.x - projX, p.y - projY),
    t,
  };
}

/**
 * 2つのベクトルのなす角度（度、0〜180）
 */
function getAngleBetweenVectorsDeg(v1: Point, v2: Point): number {
  const len1 = Math.hypot(v1.x, v1.y);
  const len2 = Math.hypot(v2.x, v2.y);
  if (len1 < 1e-4 || len2 < 1e-4) return 0;
  const dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
  const clamped = Math.max(-1, Math.min(1, dot));
  return (Math.acos(clamped) * 180) / Math.PI;
}

/**
 * 直線上に並ぶ冗長ノード（Collinear Nodes）を間引き、パスを滑らかにするコア関数
 * 文字の角（トメ・ハネ・鋭角）や縦横比、線の太さ・曲率などの形状を厳格に保持
 */
export function optimizeContourCollinearAndSmooth(
  contour: PathContour,
  options: NodeOptimizationOptions = {}
): PathContour {
  if (!contour || !contour.nodes || contour.nodes.length < 3) {
    return contour;
  }

  const level = options.level || 'normal';
  const tolerance =
    options.tolerance ?? (level === 'mild' ? 0.8 : level === 'strong' ? 2.0 : 1.3);
  const angleTolerance =
    options.angleToleranceDeg ?? (level === 'mild' ? 2.5 : level === 'strong' ? 5.0 : 3.5);
  const preserveCorners = options.preserveSharpCorners !== false;
  const maxBboxDev = options.maxBboxDeviation ?? 1.5;

  const origBbox = getContoursBoundingBox([contour]);
  const origArea = Math.abs(getContourSignedArea(contour));

  // --- ステップ1: 座標の整数化とゼロ長ハンドルの整理 ---
  let workingNodes: BezierNode[] = contour.nodes.map((node) => {
    const x = Math.round(node.x);
    const y = Math.round(node.y);
    let handleIn: Point | null = null;
    let handleOut: Point | null = null;

    if (node.handleIn) {
      const hx = Math.round(node.handleIn.x);
      const hy = Math.round(node.handleIn.y);
      if (Math.hypot(hx - x, hy - y) >= 1.0) {
        handleIn = { x: hx, y: hy };
      }
    }
    if (node.handleOut) {
      const hx = Math.round(node.handleOut.x);
      const hy = Math.round(node.handleOut.y);
      if (Math.hypot(hx - x, hy - y) >= 1.0) {
        handleOut = { x: hx, y: hy };
      }
    }

    return {
      ...node,
      x,
      y,
      handleIn,
      handleOut,
    };
  });

  // --- ステップ2: 同位置または極めて近接した連続ノードの安全結合 ---
  const deduplicated: BezierNode[] = [];
  const minPtDist = level === 'strong' ? 2.0 : 1.0;
  for (let i = 0; i < workingNodes.length; i++) {
    const curr = workingNodes[i];
    if (deduplicated.length === 0) {
      deduplicated.push(curr);
      continue;
    }
    const prev = deduplicated[deduplicated.length - 1];
    const d = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (d < minPtDist) {
      // 結合: 前のノードのhandleInと現在のhandleOutを継承
      if (!prev.handleOut && curr.handleOut) {
        prev.handleOut = curr.handleOut;
      }
      if (curr.type === 'corner') {
        prev.type = 'corner';
      }
    } else {
      deduplicated.push(curr);
    }
  }

  // 閉じた輪郭の末尾と先頭の重なり解消
  if (contour.closed && deduplicated.length > 2) {
    const first = deduplicated[0];
    const last = deduplicated[deduplicated.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < minPtDist) {
      if (!first.handleIn && last.handleIn) {
        first.handleIn = last.handleIn;
      }
      if (last.type === 'corner') {
        first.type = 'corner';
      }
      deduplicated.pop();
    }
  }

  if (deduplicated.length < 3) {
    return contour;
  }

  workingNodes = deduplicated;

  // --- ステップ3: 直線上の冗長ノード（ほぼ直線上に並ぶ点）の反復間引き ---
  // 直線上に3〜10個などの不要なノードが並んでいる場合、反復することで全て綺麗に整理される
  let hasReduced = true;
  let passCount = 0;
  const maxPasses = 8;

  while (hasReduced && passCount < maxPasses && workingNodes.length >= 3) {
    hasReduced = false;
    passCount++;
    const nextList: BezierNode[] = [];
    const n = workingNodes.length;

    for (let i = 0; i < n; i++) {
      // 閉じた輪郭の場合はラップアラウンド、開いた輪郭の始点・終点は保護
      if (!contour.closed && (i === 0 || i === n - 1)) {
        nextList.push(workingNodes[i]);
        continue;
      }

      const prev = workingNodes[(i - 1 + n) % n];
      const curr = workingNodes[i];
      const next = workingNodes[(i + 1) % n];

      // 1. 角（トメ・ハネ・コーナー）保護チェック
      // 外角・屈曲角が明確（>= 18度以上）な場合は角として保護し削除しない
      const vPrev = { x: curr.x - prev.x, y: curr.y - prev.y };
      const vNext = { x: next.x - curr.x, y: next.y - curr.y };
      const turnAngle = getAngleBetweenVectorsDeg(vPrev, vNext);

      if (preserveCorners && curr.type === 'corner' && turnAngle > 18) {
        nextList.push(curr);
        continue;
      }

      // 屈曲角が著しく大きい（>= 25度）場合、ノードタイプに関わらず形状保護のため削除しない
      if (turnAngle > 25) {
        nextList.push(curr);
        continue;
      }

      // 2. ベジェハンドルの突出チェック
      // currがハンドルを持ち、それが線分prev-nextから大きく横に張り出している場合はカーブの頂点なので保護
      const { dist, t } = getPointToSegmentDistanceAndT(
        { x: curr.x, y: curr.y },
        { x: prev.x, y: prev.y },
        { x: next.x, y: next.y }
      );

      // 射影tが線分の外側にある場合（折り返しなど）は削除しない
      if (t < 0.02 || t > 0.98) {
        nextList.push(curr);
        continue;
      }

      // 垂直距離判定
      if (dist > tolerance) {
        nextList.push(curr);
        continue;
      }

      // 角度振れ判定
      if (turnAngle > angleTolerance) {
        nextList.push(curr);
        continue;
      }

      // ハンドルが線分から外側に突出しているかチェック
      let handleDeviates = false;
      if (curr.handleIn) {
        const hDist = getPointToSegmentDistanceAndT(
          curr.handleIn,
          { x: prev.x, y: prev.y },
          { x: next.x, y: next.y }
        ).dist;
        if (hDist > tolerance * 1.5) handleDeviates = true;
      }
      if (curr.handleOut) {
        const hDist = getPointToSegmentDistanceAndT(
          curr.handleOut,
          { x: prev.x, y: prev.y },
          { x: next.x, y: next.y }
        ).dist;
        if (hDist > tolerance * 1.5) handleDeviates = true;
      }

      if (handleDeviates) {
        nextList.push(curr);
        continue;
      }

      // ここまで到達した点は「ほぼ直線上に並ぶ冗長ノード」と判定
      // このノードを安全に間引く（nextListに追加しない）
      hasReduced = true;

      // 結合時のハンドル整合:
      // prevからnextへの直線的セグメントになるようハンドルの突起を解消
      if (prev.handleOut && !curr.handleIn) {
        // prevのhandleOutが直線方向であれば微調整
      }
    }

    if (nextList.length >= 3) {
      workingNodes = nextList;
    } else {
      break;
    }
  }

  // --- ステップ4: 曲線の微細ブレ整流（normalまたはstrong時） ---
  // カクカク角筆（全てのノードがcorner型で直線のみ）の場合はこのステップをスキップ
  const isAllCorners = workingNodes.every(
    (nd) => !nd.handleIn && !nd.handleOut && nd.type === 'corner'
  );

  if (!isAllCorners && level !== 'mild' && workingNodes.length > 20) {
    // 密集した手描き曲線の微小ノードを、文字形状を崩さない公差で平滑化
    const smoothRes = smoothStrokeContour(
      {
        ...contour,
        nodes: workingNodes,
      },
      {
        tolerance: level === 'strong' ? 1.5 : 0.85,
        cornerAngleDeg: 30,
        preserveCorners: true,
      }
    );

    if (smoothRes.contour.nodes && smoothRes.contour.nodes.length >= 3) {
      // 形状検証
      const candidateBbox = getContoursBoundingBox([smoothRes.contour]);
      const dx1 = Math.abs(candidateBbox.minX - origBbox.minX);
      const dx2 = Math.abs(candidateBbox.maxX - origBbox.maxX);
      const dy1 = Math.abs(candidateBbox.minY - origBbox.minY);
      const dy2 = Math.abs(candidateBbox.maxY - origBbox.maxY);

      if (dx1 <= maxBboxDev && dx2 <= maxBboxDev && dy1 <= maxBboxDev && dy2 <= maxBboxDev) {
        const candidateArea = Math.abs(getContourSignedArea(smoothRes.contour));
        const areaRatio = origArea > 0 ? Math.abs(candidateArea - origArea) / origArea : 0;
        if (areaRatio < 0.02) {
          workingNodes = smoothRes.contour.nodes;
        }
      }
    }
  }

  // --- ステップ5: 最終形状厳格検証ガード ---
  const resultContour: PathContour = {
    ...contour,
    id: contour.id || generateId(),
    nodes: workingNodes,
  };

  const finalBbox = getContoursBoundingBox([resultContour]);
  const dx1 = Math.abs(finalBbox.minX - origBbox.minX);
  const dx2 = Math.abs(finalBbox.maxX - origBbox.maxX);
  const dy1 = Math.abs(finalBbox.minY - origBbox.minY);
  const dy2 = Math.abs(finalBbox.maxY - origBbox.maxY);

  if (dx1 > maxBboxDev || dx2 > maxBboxDev || dy1 > maxBboxDev || dy2 > maxBboxDev) {
    // 形状変異が閾値を超えた場合は元の輪郭を採用（形状保護優先）
    return contour;
  }

  const finalArea = Math.abs(getContourSignedArea(resultContour));
  if (origArea > 0) {
    const areaDiffRatio = Math.abs(finalArea - origArea) / origArea;
    if (areaDiffRatio > 0.035) {
      // 面積変化が3.5%を超える場合も却下
      return contour;
    }
  }

  return resultContour;
}

/**
 * 複数輪郭（グリフ全体）に対して直線冗長ノード間引き＆パス平滑化を一括適用
 */
export function optimizeContoursRedundantNodes(
  contours: PathContour[],
  options: NodeOptimizationOptions = {}
): NodeOptimizationResult {
  if (!contours || contours.length === 0) {
    return {
      contours: [],
      originalNodeCount: 0,
      optimizedNodeCount: 0,
      reducedCount: 0,
      reductionPercentage: 0,
      changed: false,
    };
  }

  let originalCount = 0;
  contours.forEach((c) => {
    originalCount += c.nodes ? c.nodes.length : 0;
  });

  const optimizedContours = contours.map((c) =>
    optimizeContourCollinearAndSmooth(c, options)
  );

  let optimizedCount = 0;
  optimizedContours.forEach((c) => {
    optimizedCount += c.nodes ? c.nodes.length : 0;
  });

  const reducedCount = Math.max(0, originalCount - optimizedCount);
  const reductionPercentage =
    originalCount > 0 ? Math.round((reducedCount / originalCount) * 100) : 0;

  return {
    contours: optimizedContours,
    originalNodeCount: originalCount,
    optimizedNodeCount: optimizedCount,
    reducedCount,
    reductionPercentage,
    changed: reducedCount > 0,
  };
}

export type SimplifyGlyphOptions = NodeOptimizationOptions;
export type SimplifyGlyphResult = NodeOptimizationResult;

/**
 * 輪郭の単純化（Simplify）
 * 不要なアンカーポイントを自動削除し、字形の美しさを保ちつつデータ容量を削減
 */
export function simplifyGlyphContours(
  contours: PathContour[],
  options: SimplifyGlyphOptions = {}
): SimplifyGlyphResult {
  return optimizeContoursRedundantNodes(contours, options);
}

export interface StrokeWidthAnalysis {
  minWidth: number;
  maxWidth: number;
  avgWidth: number;
  medianWidth: number;
  stdDev: number;
  isExcessivelyThin: boolean;
  isExcessivelyThick: boolean;
  hasInconsistency: boolean;
  sampleCount: number;
  thinPoints: Point[];
  thickPoints: Point[];
}

export interface StrokeEqualizationOptions {
  targetWidth?: number;
  mode?: 'balanced' | 'boost_thin' | 'shrink_thick';
  strength?: number; // 0.1 ~ 1.0 (default: 0.65)
  minThreshold?: number; // default: 22px
  maxThreshold?: number; // default: 110px
  preserveSharpCorners?: boolean; // default: true
  maxDeviation?: number; // default: 16px
}

export interface StrokeEqualizationResult {
  contours: PathContour[];
  adjusted: boolean;
  originalAnalysis: StrokeWidthAnalysis;
  newAnalysis: StrokeWidthAnalysis;
  thinFixedCount: number;
  thickFixedCount: number;
  message: string;
}

/**
 * 輪郭群（グリフ全体）の線幅（ストローク太さ）を幾何学的にサンプリング・詳細分析
 */
export function analyzeGlyphStrokeWidths(contours: PathContour[]): StrokeWidthAnalysis {
  const emptyResult: StrokeWidthAnalysis = {
    minWidth: 0,
    maxWidth: 0,
    avgWidth: 0,
    medianWidth: 0,
    stdDev: 0,
    isExcessivelyThin: false,
    isExcessivelyThick: false,
    hasInconsistency: false,
    sampleCount: 0,
    thinPoints: [],
    thickPoints: [],
  };

  if (!contours || contours.length === 0) return emptyResult;

  // 全輪郭のサンプリング点とセグメントを抽出
  interface SampleWithNormal {
    pt: Point;
    normal: Point; // 輪郭の外側・内側直交ベクトル
    contourIdx: number;
    nodeIdx: number;
    isCorner: boolean;
  }

  const allSamples: SampleWithNormal[] = [];
  const allSegments: { p1: Point; p2: Point; contourIdx: number }[] = [];

  contours.forEach((contour, cIdx) => {
    if (!contour.nodes || contour.nodes.length < 2) return;
    const n = contour.nodes.length;

    // 輪郭のサンプリング点列（ベジェ曲線を含む）
    const sampledPoints = sampleContourPoints(contour, 6);
    if (sampledPoints.length < 2) return;

    for (let i = 0; i < sampledPoints.length - 1; i++) {
      allSegments.push({
        p1: sampledPoints[i],
        p2: sampledPoints[i + 1],
        contourIdx: cIdx,
      });
    }
    if (contour.closed && sampledPoints.length > 2) {
      allSegments.push({
        p1: sampledPoints[sampledPoints.length - 1],
        p2: sampledPoints[0],
        contourIdx: cIdx,
      });
    }

    // 各ノードでの法線と位置を抽出
    for (let i = 0; i < n; i++) {
      const curr = contour.nodes[i];
      const prev = contour.nodes[(i - 1 + n) % n];
      const next = contour.nodes[(i + 1) % n];

      const v1x = curr.x - prev.x;
      const v1y = curr.y - prev.y;
      const len1 = Math.hypot(v1x, v1y) || 1;

      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;
      const len2 = Math.hypot(v2x, v2y) || 1;

      // 角度変化チェック（鋭角コーナーか否か）
      const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
      const angleDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
      const isCorner = angleDeg > 35;

      // 法線（右回転: (vy, -vx)）
      const n1x = v1y / len1;
      const n1y = -v1x / len1;
      const n2x = v2y / len2;
      const n2y = -v2x / len2;

      let nx = (n1x + n2x) / 2;
      let ny = (n1y + n2y) / 2;
      const nLen = Math.hypot(nx, ny) || 1;
      nx /= nLen;
      ny /= nLen;

      allSamples.push({
        pt: { x: curr.x, y: curr.y },
        normal: { x: nx, y: ny },
        contourIdx: cIdx,
        nodeIdx: i,
        isCorner,
      });
    }
  });

  if (allSamples.length === 0 || allSegments.length === 0) return emptyResult;

  // 各サンプル点から反対側の輪郭までの距離（局所線幅）を測定
  const widths: number[] = [];
  const thinPoints: Point[] = [];
  const thickPoints: Point[] = [];

  for (const sample of allSamples) {
    let minOppositeDist = Infinity;
    const px = sample.pt.x;
    const py = sample.pt.y;
    const nx = sample.normal.x;
    const ny = sample.normal.y;

    // 前後直交方向（法線に沿ったレイと各セグメントの交差）
    for (const seg of allSegments) {
      // 同じ輪郭の隣接ノード同士の距離測定は除外
      const segDx = seg.p2.x - seg.p1.x;
      const segDy = seg.p2.y - seg.p1.y;
      const segLenSq = segDx * segDx + segDy * segDy;
      if (segLenSq < 1) continue;

      // 点と線分の最短距離
      const t = Math.max(0, Math.min(1, ((px - seg.p1.x) * segDx + (py - seg.p1.y) * segDy) / segLenSq));
      const projX = seg.p1.x + t * segDx;
      const projY = seg.p1.y + t * segDy;
      const dist = Math.hypot(px - projX, py - projY);

      if (dist < 4) continue; // 同一点付近はスキップ

      // 法線方向との整合性チェック（法線ベクトルと投影ベクトルの内積）
      const dirX = (projX - px) / dist;
      const dirY = (projY - py) / dist;
      const align = Math.abs(dirX * nx + dirY * ny);

      // 法線と大まかに揃っている（対向面である）場合
      if (align > 0.45) {
        if (dist < minOppositeDist) {
          minOppositeDist = dist;
        }
      }
    }

    if (minOppositeDist > 3 && minOppositeDist < 350) {
      widths.push(minOppositeDist);
      if (minOppositeDist < 18) {
        thinPoints.push(sample.pt);
      } else if (minOppositeDist > 140) {
        thickPoints.push(sample.pt);
      }
    }
  }

  if (widths.length === 0) return emptyResult;

  widths.sort((a, b) => a - b);
  const minWidth = Math.round(widths[0]);
  const maxWidth = Math.round(widths[widths.length - 1]);
  const medianWidth = Math.round(widths[Math.floor(widths.length / 2)]);
  const sum = widths.reduce((acc, v) => acc + v, 0);
  const avgWidth = Math.round(sum / widths.length);

  // 標準偏差
  const variance = widths.reduce((acc, v) => acc + Math.pow(v - avgWidth, 2), 0) / widths.length;
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

  // かすれ判定: 極端に細い（< 15px または 中央値の40%未満）
  const isExcessivelyThin = minWidth < 15 || (medianWidth >= 28 && minWidth < medianWidth * 0.42);
  // 潰れ判定: 極端に太い（> 170px または 中央値の2.6倍以上）
  const isExcessivelyThick = maxWidth > 175 || (medianWidth <= 70 && maxWidth > medianWidth * 2.6);
  // 線幅のばらつき判定: max/min比率 > 4.2 または 標準偏差 > 22px
  const hasInconsistency =
    (maxWidth / Math.max(1, minWidth) > 3.8 && (minWidth < 20 || maxWidth > 120)) ||
    stdDev > 24;

  return {
    minWidth,
    maxWidth,
    avgWidth,
    medianWidth,
    stdDev,
    isExcessivelyThin,
    isExcessivelyThick,
    hasInconsistency,
    sampleCount: widths.length,
    thinPoints: thinPoints.slice(0, 8),
    thickPoints: thickPoints.slice(0, 8),
  };
}

/**
 * 文字のストローク線幅を均一化（かすれ・細線の補強および過度な太線のスリム化）
 */
export function equalizeContoursStrokeWidth(
  contours: PathContour[],
  options: StrokeEqualizationOptions = {}
): StrokeEqualizationResult {
  const originalAnalysis = analyzeGlyphStrokeWidths(contours);

  if (!contours || contours.length === 0) {
    return {
      contours: [],
      adjusted: false,
      originalAnalysis,
      newAnalysis: originalAnalysis,
      thinFixedCount: 0,
      thickFixedCount: 0,
      message: '輪郭が存在しません',
    };
  }

  const mode = options.mode || 'balanced';
  const strength = Math.max(0.1, Math.min(1.0, options.strength ?? 0.65));
  const preserveSharpCorners = options.preserveSharpCorners ?? true;
  const maxDeviation = options.maxDeviation ?? 16;

  // 目標線幅の自動算出（中央値が妥当なら中央値を基準、極端なら標準的な45~65pxにクランプ）
  const autoTarget =
    originalAnalysis.medianWidth > 0
      ? Math.max(32, Math.min(75, originalAnalysis.medianWidth))
      : 48;
  const targetWidth = options.targetWidth ?? autoTarget;

  const minThreshold = options.minThreshold ?? Math.max(18, Math.round(targetWidth * 0.65));
  const maxThreshold = options.maxThreshold ?? Math.min(130, Math.round(targetWidth * 1.55));

  let thinFixedCount = 0;
  let thickFixedCount = 0;

  // 輪郭ごとのセグメント情報を収集
  const allSegments: { p1: Point; p2: Point; contourIdx: number }[] = [];
  contours.forEach((contour, cIdx) => {
    if (!contour.nodes || contour.nodes.length < 2) return;
    const sampled = sampleContourPoints(contour, 5);
    for (let i = 0; i < sampled.length - 1; i++) {
      allSegments.push({ p1: sampled[i], p2: sampled[i + 1], contourIdx: cIdx });
    }
    if (contour.closed && sampled.length > 2) {
      allSegments.push({ p1: sampled[sampled.length - 1], p2: sampled[0], contourIdx: cIdx });
    }
  });

  const adjustedContours = contours.map((contour, cIdx) => {
    if (!contour.nodes || contour.nodes.length < 3) return contour;
    const n = contour.nodes.length;

    const origArea = getContourSignedArea(contour);
    const isOuter = origArea > 0;
    // 外輪郭は外側(+)が太くなる向き、穴輪郭は内側(-)が太くなる向き
    const outwardSign = isOuter ? 1 : -1;

    const newNodes = contour.nodes.map((node, i) => {
      const prev = contour.nodes[(i - 1 + n) % n];
      const next = contour.nodes[(i + 1) % n];

      // ベクトルと法線
      const v1x = node.x - prev.x;
      const v1y = node.y - prev.y;
      const len1 = Math.hypot(v1x, v1y) || 1;

      const v2x = next.x - node.x;
      const v2y = next.y - node.y;
      const len2 = Math.hypot(v2x, v2y) || 1;

      // コーナー角度判定
      const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
      const angleDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
      const isSharpCorner = angleDeg > 35;

      // 法線
      const n1x = v1y / len1;
      const n1y = -v1x / len1;
      const n2x = v2y / len2;
      const n2y = -v2x / len2;

      let nx = (n1x + n2x) / 2;
      let ny = (n1y + n2y) / 2;
      const nLen = Math.hypot(nx, ny) || 1;
      nx /= nLen;
      ny /= nLen;

      // 局所線幅測定
      let localDist = Infinity;
      for (const seg of allSegments) {
        const segDx = seg.p2.x - seg.p1.x;
        const segDy = seg.p2.y - seg.p1.y;
        const segLenSq = segDx * segDx + segDy * segDy;
        if (segLenSq < 1) continue;

        const t = Math.max(0, Math.min(1, ((node.x - seg.p1.x) * segDx + (node.y - seg.p1.y) * segDy) / segLenSq));
        const projX = seg.p1.x + t * segDx;
        const projY = seg.p1.y + t * segDy;
        const dist = Math.hypot(node.x - projX, node.y - projY);

        if (dist < 4) continue;
        const dirX = (projX - node.x) / dist;
        const dirY = (projY - node.y) / dist;
        const align = Math.abs(dirX * nx + dirY * ny);

        if (align > 0.45 && dist < localDist) {
          localDist = dist;
        }
      }

      let deltaOffset = 0;

      if (localDist < Infinity && localDist > 2) {
        if (localDist < minThreshold && (mode === 'balanced' || mode === 'boost_thin')) {
          // 細すぎる箇所を太く補強
          const diff = minThreshold - localDist;
          deltaOffset = diff * strength * 0.55;
          thinFixedCount++;
        } else if (localDist > maxThreshold && (mode === 'balanced' || mode === 'shrink_thick')) {
          // 太すぎる箇所をスリム化
          const diff = localDist - maxThreshold;
          deltaOffset = -diff * strength * 0.45;
          thickFixedCount++;
        }
      }

      // 鋭角コーナーや先端の保護（角を潰さないよう移動量を大きく減衰）
      if (preserveSharpCorners && isSharpCorner) {
        deltaOffset *= 0.15;
      }

      // 許容最大移動量にクランプ
      deltaOffset = Math.max(-maxDeviation, Math.min(maxDeviation, deltaOffset));

      const shiftX = Math.round(nx * outwardSign * deltaOffset);
      const shiftY = Math.round(ny * outwardSign * deltaOffset);

      if (shiftX === 0 && shiftY === 0) {
        return node;
      }

      return {
        ...node,
        x: node.x + shiftX,
        y: node.y + shiftY,
        handleIn: node.handleIn
          ? { x: node.handleIn.x + shiftX, y: node.handleIn.y + shiftY }
          : null,
        handleOut: node.handleOut
          ? { x: node.handleOut.x + shiftX, y: node.handleOut.y + shiftY }
          : null,
      };
    });

    // 形状妥当性チェック（符号付き面積が反転していないか）
    const candidateContour: PathContour = { ...contour, nodes: newNodes };
    const newArea = getContourSignedArea(candidateContour);
    if ((origArea > 0 && newArea <= 0) || (origArea < 0 && newArea >= 0)) {
      return contour; // 反転した場合は元を維持
    }

    return candidateContour;
  });

  const newAnalysis = analyzeGlyphStrokeWidths(adjustedContours);
  const adjusted = thinFixedCount > 0 || thickFixedCount > 0;

  return {
    contours: adjustedContours,
    adjusted,
    originalAnalysis,
    newAnalysis,
    thinFixedCount,
    thickFixedCount,
    message: adjusted
      ? `線幅を均一化しました (補強箇所: ${thinFixedCount}, 調整箇所: ${thickFixedCount})`
      : '目立った線幅の偏りは検出されませんでした',
  };
}

// =========================================================================
// ベジェ曲線 極点最適化（Extrema Optimization）
// =========================================================================


export interface ExtremumPoint {
  x: number;
  y: number;
  axis: 'x' | 'y';
  t: number;
  contourIndex: number;
  nodeIndex: number;
}

export interface ExtremaAnalysis {
  missingExtremaCount: number;
  extremaPoints: ExtremumPoint[];
  contoursAffected: number;
  hasMissingExtrema: boolean;
}

export interface ExtremaOptimizationOptions {
  /** 新規追加された極点ノードのハンドルを水平・垂直軸に完全スナップ（デフォルト: true） */
  alignHandlesToAxis?: boolean;
  /** 既存ノードとの最小距離閾値（px）。これより近い場合は既存ノードが極点とみなす（デフォルト: 5） */
  minDistanceThreshold?: number;
  /** 曲線の端点パラメータ t からの最小離れ（デフォルト: 0.03） */
  minParameterThreshold?: number;
}

export interface ExtremaOptimizationResult {
  contours: PathContour[];
  addedNodesCount: number;
  adjusted: boolean;
  originalAnalysis: ExtremaAnalysis;
  newAnalysis: ExtremaAnalysis;
  message: string;
}

/**
 * 3次ベジェ曲線上の特定パラメータ t (0 <= t <= 1) における座標を計算
 */
export function evaluateCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * 3次ベジェ曲線区間の 1階導関数 B'(t) = 0 となる極点パラメータ t を探索
 * dx/dt = 0 (垂直極点) および dy/dt = 0 (水平極点)
 */
export function findCubicExtremaParameters(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  minParam: number = 0.03,
  minDist: number = 5
): { t: number; axis: 'x' | 'y'; pt: Point }[] {
  // 直線または微小セグメントは除外
  const isStraight =
    Math.hypot(p1.x - p0.x, p1.y - p0.y) < 0.8 &&
    Math.hypot(p2.x - p3.x, p2.y - p3.y) < 0.8;
  if (isStraight) return [];

  const solveAxisRoots = (c0: number, c1: number, c2: number, c3: number): number[] => {
    // B'(t)/3 = a*t^2 + b*t + c
    const a = c3 - 3 * c2 + 3 * c1 - c0;
    const b = 2 * (c2 - 2 * c1 + c0);
    const c = c1 - c0;
    const EPS = 1e-7;
    const roots: number[] = [];

    if (Math.abs(a) < EPS) {
      if (Math.abs(b) > EPS) {
        const t = -c / b;
        if (t > minParam && t < 1 - minParam) {
          roots.push(t);
        }
      }
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sqrtDisc = Math.sqrt(disc);
        const t1 = (-b + sqrtDisc) / (2 * a);
        const t2 = (-b - sqrtDisc) / (2 * a);
        if (t1 > minParam && t1 < 1 - minParam) roots.push(t1);
        if (t2 > minParam && t2 < 1 - minParam && Math.abs(t2 - t1) > 0.02) roots.push(t2);
      }
    }
    return roots;
  };

  const xRoots = solveAxisRoots(p0.x, p1.x, p2.x, p3.x);
  const yRoots = solveAxisRoots(p0.y, p1.y, p2.y, p3.y);

  const results: { t: number; axis: 'x' | 'y'; pt: Point }[] = [];

  for (const t of xRoots) {
    const pt = evaluateCubicBezier(p0, p1, p2, p3, t);
    const distStart = Math.hypot(pt.x - p0.x, pt.y - p0.y);
    const distEnd = Math.hypot(pt.x - p3.x, pt.y - p3.y);
    if (distStart >= minDist && distEnd >= minDist) {
      results.push({ t, axis: 'x', pt });
    }
  }

  for (const t of yRoots) {
    const pt = evaluateCubicBezier(p0, p1, p2, p3, t);
    const distStart = Math.hypot(pt.x - p0.x, pt.y - p0.y);
    const distEnd = Math.hypot(pt.x - p3.x, pt.y - p3.y);
    if (distStart >= minDist && distEnd >= minDist) {
      const existsNear = results.some(
        (r) => Math.abs(r.t - t) < 0.02 || Math.hypot(r.pt.x - pt.x, r.pt.y - pt.y) < minDist
      );
      if (!existsNear) {
        results.push({ t, axis: 'y', pt });
      }
    }
  }

  return results.sort((a, b) => a.t - b.t);
}

/**
 * グリフ全体の輪郭について、ノードが欠落しているベジェ曲線の極点を幾何学的に分析
 */
export function analyzeGlyphExtrema(
  contours: PathContour[],
  minDist: number = 5
): ExtremaAnalysis {
  if (!contours || contours.length === 0) {
    return {
      missingExtremaCount: 0,
      extremaPoints: [],
      contoursAffected: 0,
      hasMissingExtrema: false,
    };
  }

  const extremaPoints: ExtremumPoint[] = [];
  const affectedContourIndices = new Set<number>();

  contours.forEach((contour, cIdx) => {
    const nodes = contour.nodes;
    if (!nodes || nodes.length < 2) return;

    for (let i = 0; i < nodes.length; i++) {
      const curr = nodes[i];
      const isLast = i === nodes.length - 1;
      const next = isLast ? (contour.closed ? nodes[0] : null) : nodes[i + 1];
      if (!next) break;

      const p0 = { x: curr.x, y: curr.y };
      const p1 = curr.handleOut || { x: curr.x, y: curr.y };
      const p2 = next.handleIn || { x: next.x, y: next.y };
      const p3 = { x: next.x, y: next.y };

      const roots = findCubicExtremaParameters(p0, p1, p2, p3, 0.03, minDist);
      for (const r of roots) {
        extremaPoints.push({
          x: Math.round(r.pt.x),
          y: Math.round(r.pt.y),
          axis: r.axis,
          t: r.t,
          contourIndex: cIdx,
          nodeIndex: i,
        });
        affectedContourIndices.add(cIdx);
      }
    }
  });

  return {
    missingExtremaCount: extremaPoints.length,
    extremaPoints,
    contoursAffected: affectedContourIndices.size,
    hasMissingExtrema: extremaPoints.length > 0,
  };
}

/**
 * 輪郭のベジェ曲線極点（水平・垂直の最外端）にノードを自動追加し、
 * ハンドルを軸方向に数学的に正しく最適化（TrueType / OpenType 規格準拠）
 */
export function optimizeContoursExtrema(
  contours: PathContour[],
  options: ExtremaOptimizationOptions = {}
): ExtremaOptimizationResult {
  const originalAnalysis = analyzeGlyphExtrema(contours, options.minDistanceThreshold ?? 5);

  if (!contours || contours.length === 0 || !originalAnalysis.hasMissingExtrema) {
    return {
      contours,
      addedNodesCount: 0,
      adjusted: false,
      originalAnalysis,
      newAnalysis: originalAnalysis,
      message: '極点ノードの不足は検出されませんでした（すでに最適化されています）',
    };
  }

  const alignHandlesToAxis = options.alignHandlesToAxis ?? true;
  const minDist = options.minDistanceThreshold ?? 5;
  const minParam = options.minParameterThreshold ?? 0.03;

  let totalAddedCount = 0;

  const newContours = contours.map((contour) => {
    const nodes = contour.nodes;
    if (!nodes || nodes.length < 2) return contour;

    const origArea = getContourSignedArea(contour);

    // 作業用コピー
    const workingNodes: BezierNode[] = nodes.map((n) => ({
      ...n,
      handleIn: n.handleIn ? { ...n.handleIn } : null,
      handleOut: n.handleOut ? { ...n.handleOut } : null,
    }));

    const insertionsAfter = new Map<number, BezierNode[]>();

    for (let i = 0; i < workingNodes.length; i++) {
      const curr = workingNodes[i];
      const isLast = i === workingNodes.length - 1;
      const nextIdx = isLast ? 0 : i + 1;
      const next = workingNodes[nextIdx];

      if (isLast && !contour.closed) break;

      const p0 = { x: curr.x, y: curr.y };
      const p1 = curr.handleOut || { x: curr.x, y: curr.y };
      const p2 = next.handleIn || { x: next.x, y: next.y };
      const p3 = { x: next.x, y: next.y };

      const extrema = findCubicExtremaParameters(p0, p1, p2, p3, minParam, minDist);
      if (extrema.length === 0) continue;

      let remaining: [Point, Point, Point, Point] = [p0, p1, p2, p3];
      let u0 = 0;
      const inserted: BezierNode[] = [];

      for (const ext of extrema) {
        const tRel = (ext.t - u0) / (1 - u0);
        if (tRel <= 0.005 || tRel >= 0.995) continue;

        const { left, right } = splitCubicBezier(
          remaining[0],
          remaining[1],
          remaining[2],
          remaining[3],
          tRel
        );

        if (inserted.length === 0) {
          curr.handleOut = { x: Math.round(left[1].x), y: Math.round(left[1].y) };
        } else {
          inserted[inserted.length - 1].handleOut = {
            x: Math.round(left[1].x),
            y: Math.round(left[1].y),
          };
        }

        const nodeX = Math.round(left[3].x);
        const nodeY = Math.round(left[3].y);
        const handleIn: Point = { x: Math.round(left[2].x), y: Math.round(left[2].y) };
        const handleOut: Point = { x: Math.round(right[1].x), y: Math.round(right[1].y) };

        if (alignHandlesToAxis) {
          if (ext.axis === 'x') {
            handleIn.x = nodeX;
            handleOut.x = nodeX;
          } else if (ext.axis === 'y') {
            handleIn.y = nodeY;
            handleOut.y = nodeY;
          }
        }

        inserted.push({
          id: generateId(),
          x: nodeX,
          y: nodeY,
          handleIn,
          handleOut,
          type: 'smooth',
        });

        remaining = right;
        u0 = ext.t;
      }

      if (inserted.length > 0) {
        next.handleIn = { x: Math.round(remaining[2].x), y: Math.round(remaining[2].y) };
        inserted[inserted.length - 1].handleOut = {
          x: Math.round(remaining[1].x),
          y: Math.round(remaining[1].y),
        };

        if (alignHandlesToAxis) {
          const lastExt = extrema[extrema.length - 1];
          if (lastExt.axis === 'x') {
            inserted[inserted.length - 1].handleOut!.x = inserted[inserted.length - 1].x;
          } else if (lastExt.axis === 'y') {
            inserted[inserted.length - 1].handleOut!.y = inserted[inserted.length - 1].y;
          }
        }

        insertionsAfter.set(i, inserted);
        totalAddedCount += inserted.length;
      }
    }

    const finalNodes: BezierNode[] = [];
    for (let i = 0; i < workingNodes.length; i++) {
      finalNodes.push(workingNodes[i]);
      const ins = insertionsAfter.get(i);
      if (ins && ins.length > 0) {
        finalNodes.push(...ins);
      }
    }

    const candidateContour: PathContour = {
      ...contour,
      nodes: finalNodes,
    };

    // 面積反転の検証
    const newArea = getContourSignedArea(candidateContour);
    if ((origArea > 0 && newArea <= 0) || (origArea < 0 && newArea >= 0)) {
      return contour; // 反転した場合は元に戻す
    }

    return candidateContour;
  });

  const newAnalysis = analyzeGlyphExtrema(newContours, minDist);
  const adjusted = totalAddedCount > 0;

  return {
    contours: newContours,
    addedNodesCount: totalAddedCount,
    adjusted,
    originalAnalysis,
    newAnalysis,
    message: adjusted
      ? `ベジェ曲線の極点にノードを ${totalAddedCount} 箇所追加し、軸整列を完了しました`
      : '極点ノードの追加対象はありませんでした',
  };
}

/**
 * Snap a 2D vector (startX, startY) -> (currentX, currentY) to nearest straight angles:
 * 0° (horizontal right), 45°, 90° (vertical down), 135°, 180° (horizontal left), -135°, -90° (vertical up), -45°
 */
export function snapToStraightAngle(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number
): { x: number; y: number; angleDeg: number } {
  const dx = currentX - startX;
  const dy = currentY - startY;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) {
    return { x: currentX, y: currentY, angleDeg: 0 };
  }

  const angle = Math.atan2(dy, dx);
  const snapStep = Math.PI / 4; // 45 degrees
  const snappedAngle = Math.round(angle / snapStep) * snapStep;
  const angleDeg = Math.round((snappedAngle * 180) / Math.PI);

  return {
    x: Math.round(startX + Math.cos(snappedAngle) * dist),
    y: Math.round(startY + Math.sin(snappedAngle) * dist),
    angleDeg,
  };
}

/**
 * Generate an interpolated sequence of StrokePoints along a straight line between p1 and p2.
 * Preserves pressure and timestamp gradient so brush styles (calligraphy, mincho, etc.) render properly.
 */
export function generateStraightStrokePoints(
  p1: StrokePoint,
  p2: StrokePoint,
  stepSize: number = 8
): StrokePoint[] {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(2, Math.ceil(dist / stepSize));
  const pts: StrokePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p1Pres = p1.pressure ?? 0.5;
    const p2Pres = p2.pressure ?? 0.5;
    const p1Time = p1.time ?? 0;
    const p2Time = p2.time ?? 0;
    pts.push({
      x: Math.round(p1.x + dx * t),
      y: Math.round(p1.y + dy * t),
      pressure: p1Pres + (p2Pres - p1Pres) * t,
      time: Math.round(p1Time + (p2Time - p1Time) * t),
    });
  }
  return pts;
}

/**
 * Perform vector point-by-point geometric interpolation between Master Contours A and B.
 * @param masterA Starting master contours (t = 0)
 * @param masterB Target master contours (t = 1)
 * @param t Interpolation factor (0.0 to 1.0)
 */
export function interpolateContours(
  masterA: PathContour[],
  masterB: PathContour[],
  t: number
): PathContour[] {
  const clampedT = Math.max(0, Math.min(1, t));
  if (clampedT === 0 || !masterB || masterB.length === 0) return masterA;
  if (clampedT === 1 || !masterA || masterA.length === 0) return masterB;

  // Contour order cannot safely be inferred when the masters have different
  // contour counts (for example, a counter exists in only one master).
  // Returning the nearer master avoids creating a hybrid with dropped contours.
  if (masterA.length !== masterB.length) {
    return clampedT < 0.5 ? masterA : masterB;
  }

  const count = Math.min(masterA.length, masterB.length);
  const result: PathContour[] = [];

  for (let cIdx = 0; cIdx < count; cIdx++) {
    const cA = masterA[cIdx];
    const cB = masterB[cIdx];

    if (!cA || !cB) continue;

    const nodesA = cA.nodes;
    const nodesB = cB.nodes;

    // Direct 1:1 node matching if topology aligns
    if (nodesA.length === nodesB.length) {
      const interpolatedNodes: BezierNode[] = nodesA.map((nA, i) => {
        const nB = nodesB[i];
        const x = Math.round(nA.x * (1 - clampedT) + nB.x * clampedT);
        const y = Math.round(nA.y * (1 - clampedT) + nB.y * clampedT);

        let handleIn: Point | null = null;
        if (nA.handleIn || nB.handleIn) {
          const hInAx = nA.handleIn ? nA.handleIn.x : nA.x;
          const hInAy = nA.handleIn ? nA.handleIn.y : nA.y;
          const hInBx = nB.handleIn ? nB.handleIn.x : nB.x;
          const hInBy = nB.handleIn ? nB.handleIn.y : nB.y;
          handleIn = {
            x: Math.round(hInAx * (1 - clampedT) + hInBx * clampedT),
            y: Math.round(hInAy * (1 - clampedT) + hInBy * clampedT),
          };
        }

        let handleOut: Point | null = null;
        if (nA.handleOut || nB.handleOut) {
          const hOutAx = nA.handleOut ? nA.handleOut.x : nA.x;
          const hOutAy = nA.handleOut ? nA.handleOut.y : nA.y;
          const hOutBx = nB.handleOut ? nB.handleOut.x : nB.x;
          const hOutBy = nB.handleOut ? nB.handleOut.y : nB.y;
          handleOut = {
            x: Math.round(hOutAx * (1 - clampedT) + hOutBx * clampedT),
            y: Math.round(hOutAy * (1 - clampedT) + hOutBy * clampedT),
          };
        }

        return {
          id: `interp-${cIdx}-${i}`,
          x,
          y,
          handleIn,
          handleOut,
          type: nA.type || nB.type,
        };
      });

      result.push({
        id: `interp-contour-${cIdx}`,
        nodes: interpolatedNodes,
        closed: cA.closed && cB.closed,
      });
    } else {
      // Fallback for unequal node count: blend via bounding boxes & weight offsets
      const bboxA = getContoursBoundingBox([cA]);
      const bboxB = getContoursBoundingBox([cB]);
      const scaleX = (bboxB.width || 1) / (bboxA.width || 1);
      const scaleY = (bboxB.height || 1) / (bboxA.height || 1);
      const currentScaleX = 1 + (scaleX - 1) * clampedT;
      const currentScaleY = 1 + (scaleY - 1) * clampedT;
      const dx = (bboxB.centerX - bboxA.centerX) * clampedT;
      const dy = (bboxB.centerY - bboxA.centerY) * clampedT;

      const morphed = transformContours([cA], (p) => ({
        x: Math.round(bboxA.centerX + (p.x - bboxA.centerX) * currentScaleX + dx),
        y: Math.round(bboxA.centerY + (p.y - bboxA.centerY) * currentScaleY + dy),
      }));

      result.push(...morphed);
    }
  }

  return result;
}

/**
 * Detect near-straight or wobbly segments in a PathContour and straighten/snap them to clean vectors
 */
export function straightenWobblyContour(contour: PathContour, devThreshold: number = 24): PathContour {
  if (!contour.nodes || contour.nodes.length < 3) return contour;

  const nodes = [...contour.nodes];
  const n = nodes.length;
  const newNodes: BezierNode[] = [];

  for (let i = 0; i < n; i++) {
    const prev = nodes[(i - 1 + n) % n];
    const curr = nodes[i];
    const next = nodes[(i + 1) % n];

    // Check distance of curr from chord line (prev -> next)
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const segLen = Math.hypot(dx, dy);

    if (segLen > 5) {
      const dev = Math.abs(dy * curr.x - dx * curr.y + next.x * prev.y - next.y * prev.x) / segLen;
      // If node is nearly collinear with its neighbors, straighten it along chord line
      if (dev < devThreshold) {
        const t = ((curr.x - prev.x) * dx + (curr.y - prev.y) * dy) / (segLen * segLen);
        const projX = prev.x + dx * t;
        const projY = prev.y + dy * t;

        newNodes.push({
          ...curr,
          x: Math.round(projX),
          y: Math.round(projY),
          handleIn: null,
          handleOut: null,
          type: 'corner',
        });
        continue;
      }
    }
    newNodes.push(curr);
  }

  return {
    ...contour,
    nodes: newNodes,
  };
}

/**
 * Expand stroke of contours into closed filled outlines (FontForge "Expand Stroke" command)
 */
export function expandStrokeContours(
  contours: PathContour[],
  strokeWidth: number = 20,
  capStyle: 'round' | 'butt' | 'square' = 'round'
): PathContour[] {
  if (!contours || contours.length === 0) return [];
  const expandedList: PathContour[] = [];

  for (const c of contours) {
    if (!c.nodes || c.nodes.length < 2) {
      expandedList.push(c);
      continue;
    }
    const sampled = sampleContourPoints(c, 8);
    if (sampled.length < 2) {
      expandedList.push(c);
      continue;
    }

    const halfW = Math.max(1, strokeWidth / 2);
    const leftPoints: Point[] = [];
    const rightPoints: Point[] = [];
    const tangents: Point[] = [];

    for (let i = 0; i < sampled.length; i++) {
      const curr = sampled[i];
      let dx = 0;
      let dy = 0;

      if (i === 0) {
        if (c.closed) {
          const prev = sampled[sampled.length - 1];
          dx = curr.x - prev.x;
          dy = curr.y - prev.y;
        } else {
          const next = sampled[1];
          dx = next.x - curr.x;
          dy = next.y - curr.y;
        }
      } else if (i === sampled.length - 1) {
        if (c.closed) {
          const next = sampled[0];
          dx = next.x - curr.x;
          dy = next.y - curr.y;
        } else {
          const prev = sampled[i - 1];
          dx = curr.x - prev.x;
          dy = curr.y - prev.y;
        }
      } else {
        const prev = sampled[i - 1];
        const next = sampled[i + 1];
        dx = next.x - prev.x;
        dy = next.y - prev.y;
      }

      const len = Math.hypot(dx, dy);
      if (len < 0.0001) continue;
      const tx = dx / len;
      const ty = dy / len;
      const nx = -ty;
      const ny = tx;

      tangents.push({ x: tx, y: ty });
      leftPoints.push({ x: curr.x + nx * halfW, y: curr.y + ny * halfW });
      rightPoints.push({ x: curr.x - nx * halfW, y: curr.y - ny * halfW });
    }

    if (leftPoints.length < 2) {
      expandedList.push(c);
      continue;
    }

    if (c.closed) {
      const outerNodes = pointsToBezierContourNodes(leftPoints);
      const innerNodes = pointsToBezierContourNodes(rightPoints.slice().reverse());
      expandedList.push({ id: generateId(), nodes: outerNodes, closed: true });
      expandedList.push({ id: generateId(), nodes: innerNodes, closed: true });
    } else {
      const endPt = sampled[sampled.length - 1];
      const startPt = sampled[0];
      const endTangent = tangents[tangents.length - 1] || { x: 1, y: 0 };
      const startTangent = tangents[0] || { x: 1, y: 0 };

      const endNormal = { x: -endTangent.y, y: endTangent.x };
      const startNormal = { x: -startTangent.y, y: startTangent.x };

      const endL = leftPoints[leftPoints.length - 1];
      const endR = rightPoints[rightPoints.length - 1];
      const startL = leftPoints[0];
      const startR = rightPoints[0];

      let endCap: Point[] = [];
      let startCap: Point[] = [];

      if (capStyle === 'round') {
        // End cap: sweep smoothly from endL to endR in forward semicircle
        const endCapSteps = 12;
        const endAngleStart = Math.atan2(endNormal.y, endNormal.x);
        for (let s = 1; s < endCapSteps; s++) {
          const a = endAngleStart - (Math.PI * s) / endCapSteps;
          endCap.push({
            x: endPt.x + Math.cos(a) * halfW,
            y: endPt.y + Math.sin(a) * halfW,
          });
        }

        // Start cap: sweep smoothly from startR to startL in backward semicircle
        const startCapSteps = 12;
        const startAngleStart = Math.atan2(-startNormal.y, -startNormal.x);
        for (let s = 1; s < startCapSteps; s++) {
          const a = startAngleStart - (Math.PI * s) / startCapSteps;
          startCap.push({
            x: startPt.x + Math.cos(a) * halfW,
            y: startPt.y + Math.sin(a) * halfW,
          });
        }
      } else if (capStyle === 'square') {
        endCap = [
          { x: endL.x + endTangent.x * halfW, y: endL.y + endTangent.y * halfW },
          { x: endR.x + endTangent.x * halfW, y: endR.y + endTangent.y * halfW },
        ];

        startCap = [
          { x: startR.x - startTangent.x * halfW, y: startR.y - startTangent.y * halfW },
          { x: startL.x - startTangent.x * halfW, y: startL.y - startTangent.y * halfW },
        ];
      }

      const combinedPoints = [
        ...leftPoints,
        ...endCap,
        ...rightPoints.slice().reverse(),
        ...startCap,
      ];
      const outlineNodes = pointsToBezierContourNodes(combinedPoints);
      const strokeContour: PathContour = { id: generateId(), nodes: outlineNodes, closed: true };
      expandedList.push(strokeContour);
    }
  }

  return normalizeGlyphContoursWinding(expandedList);
}

