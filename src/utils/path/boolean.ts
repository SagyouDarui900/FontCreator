import {
  BezierNode,
  PathContour,
  Point,
  StrokePoint,
} from "../../types";
import {
  subtractEraserStrokeVector,
  booleanUnionContours,
  booleanSubtractContours,
  booleanIntersectContours,
} from "../vectorBoolean";
import { generateId } from "./id";
import { contoursToSvgPath } from "./svg";
import {
  getContoursBoundingBox,
  isPointInPolygon,
  isPointNearContour,
  isPointInContour,
  isContourContained,
  normalizeGlyphContoursWinding,
  sampleContourPoints,
  distToSegment,
} from "./bounds";
import { rdpSimplify, pointsToBezierContourNodes } from "../imageVectorizer";

export function subtractEraserStrokeFromClosedContours(
  contours: PathContour[],
  strokePoints: Point[],
  radius: number
): PathContour[] {
  if (!contours || contours.length === 0 || !strokePoints || strokePoints.length === 0) {
    return contours || [];
  }
  const validContours = contours.filter((c) => c.nodes && c.nodes.length >= 3);
  if (validContours.length === 0) return [];

  const bbox = getContoursBoundingBox(validContours);
  if (bbox.width <= 0 || bbox.height <= 0) return [];

  let ptsMinX = Infinity;
  let ptsMaxX = -Infinity;
  let ptsMinY = Infinity;
  let ptsMaxY = -Infinity;

  for (const pt of strokePoints) {
    if (pt.x < ptsMinX) ptsMinX = pt.x;
    if (pt.x > ptsMaxX) ptsMaxX = pt.x;
    if (pt.y < ptsMinY) ptsMinY = pt.y;
    if (pt.y > ptsMaxY) ptsMaxY = pt.y;
  }

  const margin = Math.ceil(Math.max(radius * 2 + 16, 40));
  const minX = Math.floor(Math.min(bbox.minX, ptsMinX - radius) - margin);
  const minY = Math.floor(Math.min(bbox.minY, ptsMinY - radius) - margin);
  const maxX = Math.ceil(Math.max(bbox.maxX, ptsMaxX + radius) + margin);
  const maxY = Math.ceil(Math.max(bbox.maxY, ptsMaxY + radius) + margin);

  const w = Math.max(32, maxX - minX);
  const h = Math.max(32, maxY - minY);

  // High-resolution supersampling (up to 4x, max 1800px) for razor-sharp vector carve
  const scale = Math.min(4.0, Math.max(2.0, 1800 / Math.max(w, h)));
  const canvasW = Math.max(32, Math.round(w * scale));
  const canvasH = Math.max(32, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return contours;

  // Background white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.scale(scale, scale);
  ctx.translate(-minX, -minY);

  // Draw contours in solid black with evenodd fill rule
  ctx.fillStyle = '#000000';
  const contourSvg = contoursToSvgPath(normalizeGlyphContoursWinding(validContours));
  try {
    const p2d = new Path2D(contourSvg);
    ctx.fill(p2d, 'evenodd');
  } catch {
    return contours;
  }

  // Carve out eraser stroke in solid white
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = radius * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (strokePoints.length === 1) {
    const p = strokePoints[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(strokePoints[0].x, strokePoints[0].y);
    for (let i = 1; i < strokePoints.length; i++) {
      ctx.lineTo(strokePoints[i].x, strokePoints[i].y);
    }
    ctx.stroke();

    for (let i = 0; i < strokePoints.length; i++) {
      ctx.beginPath();
      ctx.arc(strokePoints[i].x, strokePoints[i].y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
  const data = imgData.data;
  const binary = new Uint8Array(canvasW * canvasH);
  let blackPixelCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (brightness < 128) {
      binary[i / 4] = 1;
      blackPixelCount++;
    } else {
      binary[i / 4] = 0;
    }
  }

  if (blackPixelCount < 16) {
    return [];
  }

  const edgeMap = new Map<string, Point[]>();
  const visitedEdges = new Set<string>();

  const addEdge = (pA: Point, pB: Point) => {
    const key = `${pA.x},${pA.y}`;
    if (!edgeMap.has(key)) edgeMap.set(key, []);
    edgeMap.get(key)!.push(pB);
  };

  const getPixel = (px: number, py: number): number => {
    if (px < 0 || px >= canvasW || py < 0 || py >= canvasH) return 0;
    return binary[py * canvasW + px];
  };

  for (let y = 0; y <= canvasH; y++) {
    for (let x = 0; x <= canvasW; x++) {
      const top = getPixel(x, y - 1);
      const bottom = getPixel(x, y);
      if (top !== bottom) {
        if (top === 0 && bottom === 1) addEdge({ x, y }, { x: x + 1, y });
        else addEdge({ x: x + 1, y }, { x, y });
      }
      const left = getPixel(x - 1, y);
      const right = getPixel(x, y);
      if (left !== right) {
        if (left === 1 && right === 0) addEdge({ x, y }, { x, y: y + 1 });
        else addEdge({ x: y + 1, y }, { x, y });
      }
    }
  }

  const loops: Point[][] = [];
  for (const [startKey, targets] of edgeMap.entries()) {
    while (targets.length > 0) {
      const nextP = targets.pop()!;
      const [sx, sy] = startKey.split(',').map(Number);
      const startPt: Point = { x: sx, y: sy };
      const edgeKey = `${startPt.x},${startPt.y}->${nextP.x},${nextP.y}`;
      if (visitedEdges.has(edgeKey)) continue;
      visitedEdges.add(edgeKey);

      const loop: Point[] = [startPt, nextP];
      let curr = nextP;
      let steps = 0;
      const maxSteps = canvasW * canvasH * 4;

      while (steps++ < maxSteps) {
        const currKey = `${curr.x},${curr.y}`;
        const outList = edgeMap.get(currKey);
        if (!outList || outList.length === 0) break;

        let nextIdx = 0;
        let chosen: Point | null = null;
        for (let i = 0; i < outList.length; i++) {
          const cand = outList[i];
          const k = `${curr.x},${curr.y}->${cand.x},${cand.y}`;
          if (!visitedEdges.has(k)) {
            chosen = cand;
            nextIdx = i;
            break;
          }
        }
        if (!chosen) break;
        outList.splice(nextIdx, 1);
        visitedEdges.add(`${curr.x},${curr.y}->${chosen.x},${chosen.y}`);
        loop.push(chosen);
        curr = chosen;
        if (curr.x === startPt.x && curr.y === startPt.y) break;
      }

      if (loop.length >= 6) {
        let cleanLoop = loop;
        if (cleanLoop.length >= 2) {
          const first = cleanLoop[0];
          const last = cleanLoop[cleanLoop.length - 1];
          if (first.x === last.x && first.y === last.y) {
            cleanLoop = cleanLoop.slice(0, -1);
          }
        }
        if (cleanLoop.length >= 3) {
          loops.push(cleanLoop);
        }
      }
    }
  }

  const transformedLoops = loops.map((loop) =>
    loop.map((p) => ({
      x: Math.round(minX + p.x / scale),
      y: Math.round(minY + p.y / scale),
    }))
  );

  // Filter out tiny micro-loops (< 20 font units area)
  const validLoops = transformedLoops.filter((loop) => {
    let a = 0;
    for (let i = 0; i < loop.length; i++) {
      const j = (i + 1) % loop.length;
      a += loop[i].x * loop[j].y - loop[j].x * loop[i].y;
    }
    return Math.abs(a / 2) >= 20;
  });

  if (validLoops.length === 0) {
    return [];
  }

  const simplified = validLoops
    .map((loop) => rdpSimplify(loop, 0.75))
    .filter((l) => l.length >= 3);

  if (simplified.length === 0) {
    return [];
  }

  // Convert simplified polygon loops to high-quality Bézier contours
  const resultingContours: PathContour[] = simplified.map((pts) => {
    const numPts = pts.length;
    const nodes: BezierNode[] = [];

    for (let i = 0; i < numPts; i++) {
      const curr = pts[i];
      const prev = pts[(i - 1 + numPts) % numPts];
      const next = pts[(i + 1) % numPts];

      const v1x = curr.x - prev.x;
      const v1y = curr.y - prev.y;
      const d1 = Math.hypot(v1x, v1y);

      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;
      const d2 = Math.hypot(v2x, v2y);

      if (d1 < 0.001 || d2 < 0.001) {
        nodes.push({ id: generateId(), x: curr.x, y: curr.y, type: 'corner' });
        continue;
      }

      const dot = (v1x * v2x + v1y * v2y) / (d1 * d2);
      // Sharp corners (> 45°) are kept as corner nodes
      if (dot < 0.70) {
        nodes.push({ id: generateId(), x: curr.x, y: curr.y, type: 'corner' });
      } else {
        const dx = (next.x - prev.x) * 0.28;
        const dy = (next.y - prev.y) * 0.28;
        const hLen = Math.hypot(dx, dy);
        const maxAllowed = Math.min(d1, d2) * 0.35;
        const s = hLen > maxAllowed && hLen > 0.001 ? maxAllowed / hLen : 1.0;
        const hx = dx * s;
        const hy = dy * s;

        nodes.push({
          id: generateId(),
          x: curr.x,
          y: curr.y,
          type: 'smooth',
          handleIn: { x: Math.round(curr.x - hx), y: Math.round(curr.y - hy) },
          handleOut: { x: Math.round(curr.x + hx), y: Math.round(curr.y + hy) },
        });
      }
    }

    return {
      id: generateId(),
      closed: true,
      nodes,
    };
  });

  return normalizeGlyphContoursWinding(resultingContours);
}

export function subtractEraserFromClosedContours(
  contours: PathContour[],
  point: Point,
  radius: number,
  prevPoint?: Point | null
): PathContour[] {
  const pts = prevPoint ? [prevPoint, point] : [point];
  return subtractEraserStrokeFromClosedContours(contours, pts, radius);
}

export function subtractEraserFromClosedContour(
  contour: PathContour,
  point: Point,
  radius: number,
  prevPoint?: Point | null
): PathContour[] {
  return subtractEraserFromClosedContours([contour], point, radius, prevPoint);
}

/**
 * Slices an open contour (contour.closed === false) by removing points within the eraser radius.
 */
export function sliceOpenContourWithEraser(
  contour: PathContour,
  point: Point,
  radius: number,
  prevPoint?: Point | null
): PathContour[] {
  if (!contour.nodes || contour.nodes.length < 2) return [];

  const p1 = prevPoint || point;
  const p2 = point;

  // Sample points along open path segments
  const sampledPoints: Point[] = [];
  for (let i = 0; i < contour.nodes.length - 1; i++) {
    const curr = contour.nodes[i];
    const next = contour.nodes[i + 1];

    if (curr.handleOut && next.handleIn) {
      // Cubic Bezier curve
      const steps = 18;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const mt = 1 - t;
        const x =
          mt * mt * mt * curr.x +
          3 * mt * mt * t * curr.handleOut.x +
          3 * mt * t * t * next.handleIn.x +
          t * t * t * next.x;
        const y =
          mt * mt * mt * curr.y +
          3 * mt * mt * t * curr.handleOut.y +
          3 * mt * t * t * next.handleIn.y +
          t * t * t * next.y;
        sampledPoints.push({ x, y });
      }
    } else {
      // Straight line
      const steps = 10;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        sampledPoints.push({
          x: curr.x + t * (next.x - curr.x),
          y: curr.y + t * (next.y - curr.y),
        });
      }
    }
  }
  sampledPoints.push({
    x: contour.nodes[contour.nodes.length - 1].x,
    y: contour.nodes[contour.nodes.length - 1].y,
  });

  // Group continuous runs of points outside eraser
  const runs: Point[][] = [];
  let currentRun: Point[] = [];

  for (const pt of sampledPoints) {
    if (distToSegment(pt, p1, p2) > radius) {
      currentRun.push(pt);
    } else {
      if (currentRun.length > 0) {
        runs.push(currentRun);
        currentRun = [];
      }
    }
  }
  if (currentRun.length > 0) {
    runs.push(currentRun);
  }

  const result: PathContour[] = [];
  for (const run of runs) {
    if (run.length < 2) continue;
    const simplified = rdpSimplify(run, 0.9);
    if (simplified.length < 2) continue;

    const nodes = pointsToBezierContourNodes(simplified);
    result.push({
      id: generateId(),
      closed: false,
      nodes,
    });
  }

  return result;
}

/**
 * Erase / carve a full stroke of points across contours (for 'cut' mode on mouse up or sweep)
 */
export function subtractEraserStrokeFromContours(
  contours: PathContour[],
  strokePoints: Point[],
  radius: number
): PathContour[] {
  if (!contours || contours.length === 0 || !strokePoints || strokePoints.length === 0) {
    return contours || [];
  }

  const hitClosedContours: PathContour[] = [];
  const nonHitContours: PathContour[] = [];
  const hitOpenContours: PathContour[] = [];

  for (const contour of contours) {
    let hit = false;
    for (let i = 0; i < strokePoints.length; i++) {
      const pt = strokePoints[i];
      const prev = i > 0 ? strokePoints[i - 1] : null;
      if (isPointNearContour(pt, contour, radius, prev)) {
        hit = true;
        break;
      }
    }

    if (!hit) {
      nonHitContours.push(contour);
      continue;
    }

    if (contour.closed) {
      hitClosedContours.push(contour);
    } else {
      hitOpenContours.push(contour);
    }
  }

  if (hitClosedContours.length === 0 && hitOpenContours.length === 0) {
    return contours;
  }

  let newClosed: PathContour[] = [];
  if (hitClosedContours.length > 0) {
    try {
      newClosed = subtractEraserStrokeVector(hitClosedContours, strokePoints, radius);
    } catch (err) {
      console.warn('Vector eraser subtraction encountered an error, falling back to bitmap carve:', err);
      newClosed = subtractEraserStrokeFromClosedContours(hitClosedContours, strokePoints, radius);
    }
  }

  let currentOpen = hitOpenContours;
  for (let i = 0; i < strokePoints.length; i++) {
    const pt = strokePoints[i];
    const prev = i > 0 ? strokePoints[i - 1] : null;
    const nextOpen: PathContour[] = [];
    for (const openC of currentOpen) {
      nextOpen.push(...sliceOpenContourWithEraser(openC, pt, radius, prev));
    }
    currentOpen = nextOpen;
  }

  return [...nonHitContours, ...newClosed, ...currentOpen];
}

/**
 * Erase contours at a given canvas point with specified radius and eraser mode.
 * - 'stroke': Deletes any contour that intersects with the eraser radius.
 *   Uses topological grouping so outer outlines and all counter-holes (e.g. O, A, 日, 国, あ)
 *   are erased together without leaving solid orphan hole artifacts!
 * - 'cut': Cuts/splits contours by carving out eraser areas from closed shapes (Boolean difference)
 *   or slicing open paths at eraser boundaries into separate segments.
 * - 'node': Removes individual anchor nodes falling within the eraser circle.
 */
export function eraseContoursAtPoint(
  contours: PathContour[],
  point: Point,
  radius: number,
  mode: 'all' | 'stroke' | 'cut' | 'node' = 'stroke',
  prevPoint?: Point | null
): PathContour[] {
  if (!contours || contours.length === 0) return [];

  if (mode === 'all') {
    return [];
  }

  if (mode === 'cut') {
    const strokePts = prevPoint ? [prevPoint, point] : [point];
    return subtractEraserStrokeFromContours(contours, strokePts, radius);
  }

  if (mode === 'stroke') {
    let hasChanged = false;
    const erasedIds = new Set<string>();

    // 1. Direct hit test on each individual contour
    for (const contour of contours) {
      if (isPointNearContour(point, contour, radius, prevPoint)) {
        erasedIds.add(contour.id);
        hasChanged = true;
      }
    }

    if (!hasChanged) {
      return contours;
    }

    // 2. If an outer contour is erased, also remove any dependent counter-holes
    // that were fully enclosed by that specific outer contour so orphan inner holes don't invert.
    for (const contour of contours) {
      if (erasedIds.has(contour.id) && contour.closed) {
        for (const other of contours) {
          if (!erasedIds.has(other.id) && other.closed && other.id !== contour.id) {
            // If other is fully inside contour, remove it with its deleted parent
            if (isContourContained(other, contour)) {
              erasedIds.add(other.id);
            }
          }
        }
      }
    }

    return contours.filter((c) => !erasedIds.has(c.id));
  }

  if (mode === 'node') {
    let hasChanged = false;
    const result: PathContour[] = [];

    for (const contour of contours) {
      const remainingNodes = contour.nodes.filter(
        (n) => distToSegment(n, prevPoint || point, point) > radius
      );
      if (remainingNodes.length !== contour.nodes.length) {
        hasChanged = true;
        const minNodes = contour.closed ? 3 : 2;
        if (remainingNodes.length >= minNodes) {
          result.push({
            ...contour,
            nodes: remainingNodes,
          });
        }
      } else {
        result.push(contour);
      }
    }

    if (!hasChanged) {
      return contours;
    }
    return result;
  }

  return contours;
}

/**
 * Advanced Shape-Preserving Stroke Smoothing & Anchor Point Reduction.
 * Reduces the number of anchor points in complex manual brush paths while preserving
 * the authentic silhouette, stroke width, and intentional sharp corners/stroke tips.
 */

export function getLineSegmentIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x;
  const dy2 = p4.y - p3.y;

  const det = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(det) < 1e-6) return null; // 平行または同一直線

  const s = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / det;
  const t = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / det;

  // 線分の内分点（端点のすぐ近傍 0.05〜0.95 での交差のみを判定し、接続ノードの誤検知を防ぐ）
  if (s > 0.05 && s < 0.95 && t > 0.05 && t < 0.95) {
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
export function findContourIntersections(contours: PathContour[]): Point[] {
  const intersections: Point[] = [];
  if (!contours || contours.length === 0) return intersections;

  interface Segment {
    p1: Point;
    p2: Point;
    contourIdx: number;
    segIdx: number;
  }

  interface FastSegment {
    p1: Point;
    p2: Point;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    contourIdx: number;
    segIdx: number;
  }

  const allSegments: FastSegment[] = [];

  contours.forEach((contour, cIdx) => {
    if (!contour.nodes || contour.nodes.length < 2) return;
    const points = sampleContourPoints(contour, 3);
    if (points.length < 2) return;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      allSegments.push({
        p1,
        p2,
        minX: p1.x < p2.x ? p1.x : p2.x,
        maxX: p1.x > p2.x ? p1.x : p2.x,
        minY: p1.y < p2.y ? p1.y : p2.y,
        maxY: p1.y > p2.y ? p1.y : p2.y,
        contourIdx: cIdx,
        segIdx: i,
      });
    }

    if (contour.closed && points.length > 2) {
      const p1 = points[points.length - 1];
      const p2 = points[0];
      allSegments.push({
        p1,
        p2,
        minX: p1.x < p2.x ? p1.x : p2.x,
        maxX: p1.x > p2.x ? p1.x : p2.x,
        minY: p1.y < p2.y ? p1.y : p2.y,
        maxY: p1.y > p2.y ? p1.y : p2.y,
        contourIdx: cIdx,
        segIdx: points.length - 1,
      });
    }
  });

  const segCount = allSegments.length;
  const maxSegsToCheck = 300;
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

      // Fast AABB bounding box overlap rejection
      if (
        s1.maxX < s2.minX ||
        s1.minX > s2.maxX ||
        s1.maxY < s2.minY ||
        s1.minY > s2.maxY
      ) {
        continue;
      }

      const pt = getLineSegmentIntersection(s1.p1, s1.p2, s2.p1, s2.p2);
      if (pt) {
        const isNearby = intersections.some(
          (existing) => Math.hypot(existing.x - pt.x, existing.y - pt.y) < 8
        );
        if (!isNearby) {
          intersections.push(pt);
          if (intersections.length >= 25) return intersections;
        }
      }
    }
  }

  return intersections;
}

/**
 * 輪郭群に自己交差または輪郭間の交差が存在するか高速判定（最初の交点が見つかった瞬間に早期脱出）
 */
export function hasContourIntersections(contours: PathContour[]): boolean {
  if (!contours || contours.length === 0) return false;

  interface FastSegment {
    p1: Point;
    p2: Point;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    contourIdx: number;
    segIdx: number;
  }

  const allSegments: FastSegment[] = [];

  const segCountByContour: number[] = [];

  for (let cIdx = 0; cIdx < contours.length; cIdx++) {
    const contour = contours[cIdx];
    if (!contour.nodes || contour.nodes.length < 2) {
      segCountByContour.push(0);
      continue;
    }
    const points = sampleContourPoints(contour, 3);
    if (points.length < 2) {
      segCountByContour.push(0);
      continue;
    }

    let segCount = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      allSegments.push({
        p1,
        p2,
        minX: p1.x < p2.x ? p1.x : p2.x,
        maxX: p1.x > p2.x ? p1.x : p2.x,
        minY: p1.y < p2.y ? p1.y : p2.y,
        maxY: p1.y > p2.y ? p1.y : p2.y,
        contourIdx: cIdx,
        segIdx: segCount++,
      });
    }

    if (contour.closed && points.length > 2) {
      const p1 = points[points.length - 1];
      const p2 = points[0];
      allSegments.push({
        p1,
        p2,
        minX: p1.x < p2.x ? p1.x : p2.x,
        maxX: p1.x > p2.x ? p1.x : p2.x,
        minY: p1.y < p2.y ? p1.y : p2.y,
        maxY: p1.y > p2.y ? p1.y : p2.y,
        contourIdx: cIdx,
        segIdx: segCount++,
      });
    }
    segCountByContour.push(segCount);
  }

  // 1D Sweep-line sorted by minX for 100% complete intersection check with zero segment skipping
  allSegments.sort((a, b) => a.minX - b.minX);
  const totalSegs = allSegments.length;

  for (let i = 0; i < totalSegs; i++) {
    const s1 = allSegments[i];
    for (let j = i + 1; j < totalSegs; j++) {
      const s2 = allSegments[j];

      // Prune by X: No subsequent segment can overlap in X
      if (s2.minX > s1.maxX) break;

      // Prune by Y: Fast AABB rejection
      if (s1.maxY < s2.minY || s1.minY > s2.maxY) continue;

      // Adjacent segments on the same contour share an endpoint; exclude
      if (s1.contourIdx === s2.contourIdx) {
        const diff = Math.abs(s1.segIdx - s2.segIdx);
        const count = segCountByContour[s1.contourIdx] || 0;
        if (diff <= 1 || (count > 2 && diff >= count - 1)) continue;
      }

      if (getLineSegmentIntersection(s1.p1, s1.p2, s2.p1, s2.p2)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 2つの輪郭が実際に幾何学的に交差しているか、または接触・重なり合っているかを精密判定
 * （単なる外接矩形AABBの近接判定ではなく、実際の線分交差・内部包含・真の接触を検証）
 */
export function doContoursIntersectOrTouch(c1: PathContour, c2: PathContour): boolean {
  if (!c1?.nodes || c1.nodes.length < 2 || !c2?.nodes || c2.nodes.length < 2) return false;

  // 1. 高速 AABB バウンディングボックス判定（完全に離れている場合は即座に false）
  const b1 = getContoursBoundingBox([c1]);
  const b2 = getContoursBoundingBox([c2]);

  if (
    b1.minX > b2.maxX + 0.5 ||
    b1.maxX < b2.minX - 0.5 ||
    b1.minY > b2.maxY + 0.5 ||
    b1.maxY < b2.minY - 0.5
  ) {
    return false;
  }

  // 2. パス線分サンプリングによる線分交差チェック
  const pts1 = sampleContourPoints(c1, 5);
  const pts2 = sampleContourPoints(c2, 5);
  if (pts1.length < 2 || pts2.length < 2) return false;

  const segs1: { p1: Point; p2: Point; minX: number; maxX: number; minY: number; maxY: number }[] = [];
  for (let i = 0; i < pts1.length - 1; i++) {
    const p1 = pts1[i];
    const p2 = pts1[i + 1];
    segs1.push({
      p1, p2,
      minX: Math.min(p1.x, p2.x), maxX: Math.max(p1.x, p2.x),
      minY: Math.min(p1.y, p2.y), maxY: Math.max(p1.y, p2.y),
    });
  }
  if (c1.closed && pts1.length > 2) {
    const p1 = pts1[pts1.length - 1];
    const p2 = pts1[0];
    segs1.push({
      p1, p2,
      minX: Math.min(p1.x, p2.x), maxX: Math.max(p1.x, p2.x),
      minY: Math.min(p1.y, p2.y), maxY: Math.max(p1.y, p2.y),
    });
  }

  const segs2: { p1: Point; p2: Point; minX: number; maxX: number; minY: number; maxY: number }[] = [];
  for (let i = 0; i < pts2.length - 1; i++) {
    const p1 = pts2[i];
    const p2 = pts2[i + 1];
    segs2.push({
      p1, p2,
      minX: Math.min(p1.x, p2.x), maxX: Math.max(p1.x, p2.x),
      minY: Math.min(p1.y, p2.y), maxY: Math.max(p1.y, p2.y),
    });
  }
  if (c2.closed && pts2.length > 2) {
    const p1 = pts2[pts2.length - 1];
    const p2 = pts2[0];
    segs2.push({
      p1, p2,
      minX: Math.min(p1.x, p2.x), maxX: Math.max(p1.x, p2.x),
      minY: Math.min(p1.y, p2.y), maxY: Math.max(p1.y, p2.y),
    });
  }

  // 線分交差の探索
  for (let i = 0; i < segs1.length; i++) {
    const s1 = segs1[i];
    for (let j = 0; j < segs2.length; j++) {
      const s2 = segs2[j];
      if (
        s1.maxX < s2.minX ||
        s1.minX > s2.maxX ||
        s1.maxY < s2.minY ||
        s1.minY > s2.maxY
      ) {
        continue;
      }
      if (getLineSegmentIntersection(s1.p1, s1.p2, s2.p1, s2.p2)) {
        return true;
      }
    }
  }

  // 3. 内部包含チェック（一方が他方の内部に完全または部分的に食い込んでいる場合）
  if (c1.closed) {
    const testCount = Math.min(10, pts2.length);
    const step = Math.max(1, Math.floor(pts2.length / testCount));
    for (let i = 0; i < pts2.length; i += step) {
      if (isPointInContour(pts2[i], c1)) {
        return true;
      }
    }
  }

  if (c2.closed) {
    const testCount = Math.min(10, pts1.length);
    const step = Math.max(1, Math.floor(pts1.length / testCount));
    for (let i = 0; i < pts1.length; i += step) {
      if (isPointInContour(pts1[i], c2)) {
        return true;
      }
    }
  }

  // 4. 輪郭同士の極小接触チェック（物理的に接触している場合: 距離 <= 0.6px）
  for (let i = 0; i < pts1.length; i += 2) {
    const p = pts1[i];
    if (
      p.x < b2.minX - 1 ||
      p.x > b2.maxX + 1 ||
      p.y < b2.minY - 1 ||
      p.y > b2.maxY + 1
    ) {
      continue;
    }
    for (let j = 0; j < segs2.length; j++) {
      const s = segs2[j];
      const dx = s.p2.x - s.p1.x;
      const dy = s.p2.y - s.p1.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-4) continue;
      const t = Math.max(0, Math.min(1, ((p.x - s.p1.x) * dx + (p.y - s.p1.y) * dy) / lenSq));
      const projX = s.p1.x + t * dx;
      const projY = s.p1.y + t * dy;
      const distSq = (p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY);
      if (distSq <= 0.36) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Boolean Union / Pathfinder Merge (合体・一筆書き白抜き解消):
 * Combines multiple overlapping or intersecting contours into unified outer contour(s),
 * eliminating internal overlapping boundaries and resolving self-intersections with high resolution.
 * Non-intersecting contours are guaranteed to remain 100% untouched with 0% distortion.
 */
export function unionContours(
  contoursToUnion: PathContour[],
  smoothing: number = 1.2,
  forceProcessSingle: boolean = false
): PathContour[] {
  if (!contoursToUnion || contoursToUnion.length === 0) return [];

  // 単独輪郭の場合: 自己交差がなければ絶対に何も変形させずに元輪郭を100%完全返却
  if (contoursToUnion.length === 1) {
    const hasSelf = hasContourIntersections(contoursToUnion);
    if (!hasSelf && !forceProcessSingle) {
      return contoursToUnion;
    }
  }

  // 1. 実際に幾何学的に交差・接触している輪郭のみを連結グラフでクラスタリング
  // 非交差・独立ストロークは絶対にクラスタを分離し、元のベジェ曲線を100%完全保持する
  const n = contoursToUnion.length;
  const adj: number[][] = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (doContoursIntersectOrTouch(contoursToUnion[i], contoursToUnion[j])) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  const visited = new Set<number>();
  const clusters: PathContour[][] = [];

  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue;
    const clusterIndices: number[] = [];
    const queue = [i];
    visited.add(i);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      clusterIndices.push(curr);
      for (const neighbor of adj[curr]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    clusters.push(clusterIndices.map((idx) => contoursToUnion[idx]));
  }

  const resultContours: PathContour[] = [];

  for (const cluster of clusters) {
    // 独立した単独輪郭の場合: 自己交差がない限り、元のパスを1点たりとも変形させずにそのまま保持
    if (cluster.length === 1) {
      const single = cluster[0];
      const hasSelf = hasContourIntersections(cluster);
      if (!hasSelf && !forceProcessSingle) {
        resultContours.push(single);
        continue;
      }
    }

    const bbox = getContoursBoundingBox(cluster);
    if (bbox.width <= 0 || bbox.height <= 0) {
      resultContours.push(...cluster);
      continue;
    }

    try {
      const united = booleanUnionContours(cluster);
      if (united && united.length > 0) {
        resultContours.push(...united);
        continue;
      }
    } catch {
      // Fallback to raster algorithm below
    }

    const margin = 24;
    const minX = Math.floor(bbox.minX - margin);
    const minY = Math.floor(bbox.minY - margin);
    const maxX = Math.ceil(bbox.maxX + margin);
    const maxY = Math.ceil(bbox.maxY + margin);
    const w = Math.max(32, maxX - minX);
    const h = Math.max(32, maxY - minY);

    // 超高解像度スーパーサンプリング（最大4.0倍、1600px基準）で局所合体時のエッジ精度を保持
    const maxDim = Math.max(w, h);
    const scale = Math.min(4.0, Math.max(2.0, 1600 / maxDim));
    const canvasW = Math.max(32, Math.round(w * scale));
    const canvasH = Math.max(32, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      resultContours.push(...cluster);
      continue;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.scale(scale, scale);
    ctx.translate(-minX, -minY);

    // 輪郭群の包含関係（内外階層）に基づきワインディングを正規化:
    // 外輪郭群は正の向き（Clockwise / +1）、内包される穴（「あ」「日」「口」など）は負の向き（Counter-Clockwise / -1）
    // これによりNon-Zero塗りつぶし時、重なり合う外側ストロークは加算融合（+1 + 1 = 2）され、
    // 内側の穴は(+1 + -1 = 0)として完全に白抜き保持される
    const alignedCluster = normalizeGlyphContoursWinding(cluster);

    ctx.fillStyle = '#000000';
    const clusterSvg = contoursToSvgPath(alignedCluster);
    try {
      const p2d = new Path2D(clusterSvg);
      ctx.fill(p2d, 'nonzero');
    } catch {
      // ignore parse failure
    }

    const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
    const data = imgData.data;
    const binary = new Uint8Array(canvasW * canvasH);

    for (let i = 0; i < data.length; i += 4) {
      const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      binary[i / 4] = brightness < 128 ? 1 : 0;
    }

    const edgeMap = new Map<string, Point[]>();
    const visitedEdges = new Set<string>();

    const addEdge = (p1: Point, p2: Point) => {
      const key = `${p1.x},${p1.y}`;
      let list = edgeMap.get(key);
      if (!list) {
        list = [];
        edgeMap.set(key, list);
      }
      list.push(p2);
    };

    const getPixel = (px: number, py: number): number => {
      if (px < 0 || px >= canvasW || py < 0 || py >= canvasH) return 0;
      return binary[py * canvasW + px];
    };

    for (let y = 0; y <= canvasH; y++) {
      for (let x = 0; x <= canvasW; x++) {
        const top = getPixel(x, y - 1);
        const bottom = getPixel(x, y);
        if (top !== bottom) {
          if (top === 0 && bottom === 1) addEdge({ x, y }, { x: x + 1, y });
          else addEdge({ x: x + 1, y }, { x, y });
        }
        const left = getPixel(x - 1, y);
        const right = getPixel(x, y);
        if (left !== right) {
          if (left === 1 && right === 0) addEdge({ x, y }, { x, y: y + 1 });
          else addEdge({ x, y: y + 1 }, { x, y });
        }
      }
    }

    const loops: Point[][] = [];
    for (const [startKey, targets] of edgeMap.entries()) {
      while (targets.length > 0) {
        const nextP = targets.pop()!;
        const [sx, sy] = startKey.split(',').map(Number);
        const startPt: Point = { x: sx, y: sy };
        const initialEdgeKey = `${startPt.x},${startPt.y}->${nextP.x},${nextP.y}`;
        if (visitedEdges.has(initialEdgeKey)) continue;
        visitedEdges.add(initialEdgeKey);

        const loop: Point[] = [startPt, nextP];
        let curr = nextP;
        let steps = 0;
        const maxSteps = canvasW * canvasH * 2;
        let closed = false;

        while (steps++ < maxSteps) {
          if (curr.x === startPt.x && curr.y === startPt.y) {
            closed = true;
            break;
          }
          const currKey = `${curr.x},${curr.y}`;
          const outList = edgeMap.get(currKey);
          if (!outList || outList.length === 0) break;

          let chosen: Point | null = null;
          let chosenIdx = -1;
          for (let i = 0; i < outList.length; i++) {
            const cand = outList[i];
            const k = `${curr.x},${curr.y}->${cand.x},${cand.y}`;
            if (!visitedEdges.has(k)) {
              chosen = cand;
              chosenIdx = i;
              break;
            }
          }
          if (!chosen) break;
          outList.splice(chosenIdx, 1);
          visitedEdges.add(`${curr.x},${curr.y}->${chosen.x},${chosen.y}`);
          loop.push(chosen);
          curr = chosen;
        }

        // 正常に始点に循環到達したループのみを採用し、末尾の重複始点を削除
        if (closed && loop.length >= 4) {
          loop.pop();
          loops.push(loop);
        }
      }
    }

    const transformedLoops = loops.map((loop) =>
      loop.map((p) => ({
        x: Math.round(minX + p.x / scale),
        y: Math.round(minY + p.y / scale),
      }))
    );

    // 微小ゴミノイズ（面積 < 25 font units）を除去
    const validLoops = transformedLoops.filter((loop) => {
      if (loop.length < 3) return false;
      let a = 0;
      for (let i = 0; i < loop.length; i++) {
        const j = (i + 1) % loop.length;
        a += loop[i].x * loop[j].y - loop[j].x * loop[i].y;
      }
      return Math.abs(a / 2) >= 25;
    });

    const simplified = validLoops
      .map((loop) => {
        if (loop.length <= 4) return loop;
        const half = Math.floor(loop.length / 2);
        const h1 = rdpSimplify(loop.slice(0, half + 1), smoothing);
        const h2 = rdpSimplify([...loop.slice(half), loop[0]], smoothing);
        const merged = [...h1.slice(0, -1), ...h2.slice(0, -1)];
        return merged.length >= 3 ? merged : loop;
      })
      .filter((l) => l.length >= 3);

    if (simplified.length === 0) {
      resultContours.push(...cluster);
      continue;
    }

    // 多角形頂点列を高品位なベジェ曲線ノード列に復元
    const mergedClusterContours = simplified.map((pts) => {
      const numPts = pts.length;
      const nodes: BezierNode[] = [];

      for (let i = 0; i < numPts; i++) {
        const curr = pts[i];
        const prev = pts[(i - 1 + numPts) % numPts];
        const next = pts[(i + 1) % numPts];

        const v1x = curr.x - prev.x;
        const v1y = curr.y - prev.y;
        const d1 = Math.hypot(v1x, v1y);

        const v2x = next.x - curr.x;
        const v2y = next.y - curr.y;
        const d2 = Math.hypot(v2x, v2y);

        if (d1 < 0.001 || d2 < 0.001) {
          nodes.push({ id: generateId(), x: curr.x, y: curr.y, type: 'corner' });
          continue;
        }

        const dot = (v1x * v2x + v1y * v2y) / (d1 * d2);
        // 急峻な折れ角（> 42°）はシャープな角ノードとして保持
        if (dot < 0.74) {
          nodes.push({ id: generateId(), x: curr.x, y: curr.y, type: 'corner' });
        } else {
          // 滑らかな曲線部：オーバーシュート抑制付きCatmull-Rom接線ハンドル
          const dx = (next.x - prev.x) * 0.25;
          const dy = (next.y - prev.y) * 0.25;
          const hLen = Math.hypot(dx, dy);
          const maxAllowed = Math.min(d1, d2) * 0.32;
          const s = hLen > maxAllowed && hLen > 0.001 ? maxAllowed / hLen : 1.0;
          const hx = dx * s;
          const hy = dy * s;

          nodes.push({
            id: generateId(),
            x: curr.x,
            y: curr.y,
            type: 'smooth',
            handleIn: { x: Math.round(curr.x - hx), y: Math.round(curr.y - hy) },
            handleOut: { x: Math.round(curr.x + hx), y: Math.round(curr.y + hy) },
          });
        }
      }

      return {
        id: generateId(),
        closed: true,
        nodes,
      };
    });

    resultContours.push(...normalizeGlyphContoursWinding(mergedClusterContours));
  }

  return resultContours;
}

/**
 * 一筆書きや手書き文字の自己交差・重なりによる白抜きを自動解消（ブーリアン融解）
 */
export function resolveContourOverlaps(
  contours: PathContour[],
  options?: { smoothing?: number; forceProcessSingle?: boolean }
): PathContour[] {
  return unionContours(contours, options?.smoothing ?? 1.2, options?.forceProcessSingle ?? true);
}


export { booleanSubtractContours, booleanIntersectContours } from "../vectorBoolean";
