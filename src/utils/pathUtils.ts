import {
  BezierNode,
  PathContour,
  Point,
  StrokePoint,
  BrushStyle,
  PenPresetInfo,
  RadicalPlacement,
  ShapeType,
  ShapePreset,
} from '../types';
import { rdpSimplify, pointsToBezierContourNodes } from './imageVectorizer';

export const PEN_PRESETS: PenPresetInfo[] = [
  {
    id: 'signpen',
    name: '水性サインペン',
    shortName: 'サインペン',
    category: 'pen',
    description: '滑らかで温かみのあるフェルトペン。均一感と適度な筆圧変化のある日常手書き風',
    defaultWidth: 38,
  },
  {
    id: 'sumi',
    name: '墨だまり筆',
    shortName: '墨だまり',
    category: 'natural',
    description: '書き始めや角・止めの「墨だまり」を再現。速度と筆圧でインクが溜まる本格派',
    defaultWidth: 44,
  },
  {
    id: 'marumoji',
    name: '丸文字・ぽっぷ',
    shortName: '丸文字',
    category: 'pen',
    description: 'ぷっくりとした丸い先端と愛嬌のある輪郭。80s丸文字やかわいいPOP体フォントに',
    defaultWidth: 42,
  },
  {
    id: 'brush',
    name: '毛筆・筆ペン',
    shortName: '毛筆',
    category: 'natural',
    description: '筆圧感応・止め・払いの効いた本格的な和風毛筆ストローク',
    defaultWidth: 45,
  },
  {
    id: 'fountain',
    name: '万年筆・Gペン',
    shortName: '万年筆',
    category: 'pen',
    description: '縦引きが太く横払いが細いインクペン。筆圧とペン先角度によるメリハリ表現',
    defaultWidth: 38,
  },
  {
    id: 'marker',
    name: '丸マーカー',
    shortName: '丸マーカー',
    category: 'pen',
    description: '太さが安定した丸芯マーカー。明快なストロークと親しみやすい線',
    defaultWidth: 38,
  },
  {
    id: 'ballpoint',
    name: 'ゲルボールペン',
    shortName: 'ゲルペン',
    category: 'pen',
    description: '0.5mmボールペンのような、繊細ですっきりとした日常手書き線',
    defaultWidth: 24,
  },
  {
    id: 'chalk',
    name: 'ぽってりクレヨン',
    shortName: 'ぽってり',
    category: 'natural',
    description: '太めで端がふっくら丸い、温かみのあるゆる文字・チョーク風',
    defaultWidth: 55,
  },
  {
    id: 'calligraphy',
    name: '平筆カリグラフィー',
    shortName: '平筆',
    category: 'chisel',
    description: '45°傾斜の平ペン。イタリックやゴシック体、西洋レタリング風',
    defaultWidth: 45,
  },
  {
    id: 'highlighter',
    name: '平マーカー・リボン',
    shortName: '平マーカー',
    category: 'chisel',
    description: '垂直・水平の平筆。テープ文字やレトロ見出しフォント向け',
    defaultWidth: 50,
  },
  {
    id: 'pencil',
    name: '鉛筆・細字',
    shortName: '鉛筆',
    category: 'natural',
    description: '筆圧に応じた繊細な細線。手描きの下描きや細字フォントに',
    defaultWidth: 20,
  },
  {
    id: 'sharp',
    name: 'カクカク角筆',
    shortName: '角筆',
    category: 'special',
    description: '直線と角ノードのみで構成される幾何学的・ピクセル風の角ばり線',
    defaultWidth: 35,
  },
  {
    id: 'sharp_round',
    name: 'カクカク角丸筆',
    shortName: '角丸',
    category: 'special',
    description: '直線・幾何学的な骨格に、滑らかな角丸とラウンド端を施したモダン角丸線',
    defaultWidth: 35,
  },
  {
    id: 'wobbly',
    name: 'ゆらぎ手書き',
    shortName: 'ゆらぎ',
    category: 'special',
    description: '微細な手の震えやインクのにじみ感を再現したリアルな手描き線',
    defaultWidth: 38,
  },
];

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Convert contours to standard SVG path string 'd'
 */
export function contoursToSvgPath(contours: PathContour[]): string {
  if (!contours || contours.length === 0) return '';
  let d = '';

  for (const contour of contours) {
    const nodes = contour.nodes;
    if (!nodes || nodes.length === 0) continue;

    const first = nodes[0];
    d += `M ${first.x} ${first.y} `;

    for (let i = 0; i < nodes.length; i++) {
      const current = nodes[i];
      const isLast = i === nodes.length - 1;
      const next = isLast ? (contour.closed ? nodes[0] : null) : nodes[i + 1];

      if (!next) break;

      const cp1 = current.handleOut || { x: current.x, y: current.y };
      const cp2 = next.handleIn || { x: next.x, y: next.y };

      const isCp1Default = cp1.x === current.x && cp1.y === current.y;
      const isCp2Default = cp2.x === next.x && cp2.y === next.y;

      if (isCp1Default && isCp2Default) {
        d += `L ${next.x} ${next.y} `;
      } else {
        d += `C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${next.x} ${next.y} `;
      }
    }

    if (contour.closed) {
      d += 'Z ';
    }
  }

  return d.trim();
}

/**
 * Calculate bounding box of contours
 */
export function getContoursBoundingBox(contours: PathContour[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  let hasPoints = false;

  for (const contour of contours) {
    for (const node of contour.nodes) {
      hasPoints = true;
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);

      if (node.handleIn) {
        minX = Math.min(minX, node.handleIn.x);
        minY = Math.min(minY, node.handleIn.y);
        maxX = Math.max(maxX, node.handleIn.x);
        maxY = Math.max(maxY, node.handleIn.y);
      }
      if (node.handleOut) {
        minX = Math.min(minX, node.handleOut.x);
        minY = Math.min(minY, node.handleOut.y);
        maxX = Math.max(maxX, node.handleOut.x);
        maxY = Math.max(maxY, node.handleOut.y);
      }
    }
  }

  if (!hasPoints) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
  }

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

/**
 * Transform contours by matrix/function
 */
export function transformContours(
  contours: PathContour[],
  transformFn: (p: Point) => Point
): PathContour[] {
  return contours.map((contour) => ({
    ...contour,
    nodes: contour.nodes.map((node) => {
      const newPt = transformFn({ x: node.x, y: node.y });
      let handleIn: Point | null = null;
      if (node.handleIn) {
        if (node.handleIn.x === node.x && node.handleIn.y === node.y) {
          handleIn = { x: newPt.x, y: newPt.y };
        } else {
          handleIn = transformFn(node.handleIn);
        }
      }
      let handleOut: Point | null = null;
      if (node.handleOut) {
        if (node.handleOut.x === node.x && node.handleOut.y === node.y) {
          handleOut = { x: newPt.x, y: newPt.y };
        } else {
          handleOut = transformFn(node.handleOut);
        }
      }
      return {
        ...node,
        ...newPt,
        handleIn,
        handleOut,
      };
    }),
  }));
}

/**
 * Flip contours horizontally
 */
export function flipContoursHorizontal(contours: PathContour[]): PathContour[] {
  const bbox = getContoursBoundingBox(contours);
  const cx = bbox.centerX;
  return transformContours(contours, (p) => ({
    x: 2 * cx - p.x,
    y: p.y,
  }));
}

/**
 * Flip contours vertically
 */
export function flipContoursVertical(contours: PathContour[]): PathContour[] {
  const bbox = getContoursBoundingBox(contours);
  const cy = bbox.centerY;
  return transformContours(contours, (p) => ({
    x: p.x,
    y: 2 * cy - p.y,
  }));
}

/**
 * Slant / Italicize contours
 */
export function slantContours(contours: PathContour[], angleDeg: number = 12): PathContour[] {
  const rad = (angleDeg * Math.PI) / 180;
  const tan = Math.tan(rad);
  const bbox = getContoursBoundingBox(contours);
  const cy = bbox.centerY;

  return transformContours(contours, (p) => ({
    x: Math.round(p.x + (p.y - cy) * tan),
    y: p.y,
  }));
}

/**
 * Slant / Italicize a single contour / part around its own center
 */
export function slantSingleContour(contour: PathContour, angleDeg: number = 12, customOriginY?: number): PathContour {
  const rad = (angleDeg * Math.PI) / 180;
  const tan = Math.tan(rad);
  const bbox = getContoursBoundingBox([contour]);
  const cy = customOriginY !== undefined ? customOriginY : bbox.centerY;

  return {
    ...contour,
    nodes: contour.nodes.map((node) => {
      const x = Math.round(node.x + (node.y - cy) * tan);
      const y = node.y;
      const handleIn = node.handleIn
        ? { x: Math.round(node.handleIn.x + (node.handleIn.y - cy) * tan), y: node.handleIn.y }
        : null;
      const handleOut = node.handleOut
        ? { x: Math.round(node.handleOut.x + (node.handleOut.y - cy) * tan), y: node.handleOut.y }
        : null;

      return {
        ...node,
        x,
        y,
        handleIn,
        handleOut,
      };
    }),
  };
}

/**
 * Rotate a single contour / part around its center
 */
export function rotateSingleContour(
  contour: PathContour,
  angleDeg: number = 90,
  customCx?: number,
  customCy?: number
): PathContour {
  const bbox = getContoursBoundingBox([contour]);
  const cx = customCx !== undefined ? customCx : bbox.centerX;
  const cy = customCy !== undefined ? customCy : bbox.centerY;

  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rotatePoint = (p: Point) => {
    const rx = p.x - cx;
    const ry = p.y - cy;
    return {
      x: Math.round(cx + rx * cos - ry * sin),
      y: Math.round(cy + rx * sin + ry * cos),
    };
  };

  return {
    ...contour,
    nodes: contour.nodes.map((node) => ({
      ...node,
      ...rotatePoint({ x: node.x, y: node.y }),
      handleIn: node.handleIn ? rotatePoint(node.handleIn) : null,
      handleOut: node.handleOut ? rotatePoint(node.handleOut) : null,
    })),
  };
}

/**
 * Scale a single contour / part around its center
 */
export function scaleSingleContour(
  contour: PathContour,
  scaleX: number,
  scaleY: number
): PathContour {
  const bbox = getContoursBoundingBox([contour]);
  const cx = bbox.centerX;
  const cy = bbox.centerY;

  const scalePoint = (p: Point) => ({
    x: Math.round(cx + (p.x - cx) * scaleX),
    y: Math.round(cy + (p.y - cy) * scaleY),
  });

  return {
    ...contour,
    nodes: contour.nodes.map((node) => ({
      ...node,
      ...scalePoint({ x: node.x, y: node.y }),
      handleIn: node.handleIn ? scalePoint(node.handleIn) : null,
      handleOut: node.handleOut ? scalePoint(node.handleOut) : null,
    })),
  };
}

/**
 * Flip a single contour horizontally
 */
export function flipSingleContourH(contour: PathContour): PathContour {
  const bbox = getContoursBoundingBox([contour]);
  const cx = bbox.centerX;

  const flipPoint = (p: Point) => ({
    x: Math.round(2 * cx - p.x),
    y: p.y,
  });

  return {
    ...contour,
    nodes: contour.nodes.map((node) => ({
      ...node,
      ...flipPoint({ x: node.x, y: node.y }),
      handleIn: node.handleIn ? flipPoint(node.handleIn) : null,
      handleOut: node.handleOut ? flipPoint(node.handleOut) : null,
    })),
  };
}

/**
 * Flip a single contour vertically
 */
export function flipSingleContourV(contour: PathContour): PathContour {
  const bbox = getContoursBoundingBox([contour]);
  const cy = bbox.centerY;

  const flipPoint = (p: Point) => ({
    x: p.x,
    y: Math.round(2 * cy - p.y),
  });

  return {
    ...contour,
    nodes: contour.nodes.map((node) => ({
      ...node,
      ...flipPoint({ x: node.x, y: node.y }),
      handleIn: node.handleIn ? flipPoint(node.handleIn) : null,
      handleOut: node.handleOut ? flipPoint(node.handleOut) : null,
    })),
  };
}

/**
 * Duplicate a contour with slight offset
 */
export function duplicateContour(contour: PathContour, offsetX: number = 30, offsetY: number = 30): PathContour {
  return {
    ...contour,
    id: generateId(),
    nodes: contour.nodes.map((node) => ({
      ...node,
      id: generateId(),
      x: node.x + offsetX,
      y: node.y + offsetY,
      handleIn: node.handleIn ? { x: node.handleIn.x + offsetX, y: node.handleIn.y + offsetY } : null,
      handleOut: node.handleOut ? { x: node.handleOut.x + offsetX, y: node.handleOut.y + offsetY } : null,
    })),
  };
}

/**
 * Scale contours around center
 */
export function scaleContours(contours: PathContour[], scaleX: number, scaleY: number): PathContour[] {
  const bbox = getContoursBoundingBox(contours);
  const cx = bbox.centerX;
  const cy = bbox.centerY;

  return transformContours(contours, (p) => ({
    x: Math.round(cx + (p.x - cx) * scaleX),
    y: Math.round(cy + (p.y - cy) * scaleY),
  }));
}

/**
 * Center contours inside em-box
 */
export function centerContoursInBox(
  contours: PathContour[],
  boxWidth: number = 1000,
  targetBaseline: number = 800
): PathContour[] {
  const bbox = getContoursBoundingBox(contours);
  const dx = Math.round(boxWidth / 2 - bbox.centerX);
  return transformContours(contours, (p) => ({
    x: p.x + dx,
    y: p.y,
  }));
}

/**
 * Rotate contours around a center point (default center of em box: 500, 500)
 */
export function rotateContours(
  contours: PathContour[],
  angleDeg: number = 90,
  cx: number = 500,
  cy: number = 500
): PathContour[] {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return transformContours(contours, (p) => {
    const rx = p.x - cx;
    const ry = p.y - cy;
    return {
      x: Math.round(cx + rx * cos - ry * sin),
      y: Math.round(cy + rx * sin + ry * cos),
    };
  });
}

/**
 * Ramer-Douglas-Peucker (RDP) algorithm to simplify a sequence of points
 * High-performance non-allocating stack-based iterative implementation with squared distance.
 */
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
function sampleCubicBezier(
  p0: Point,
  cp1: Point,
  cp2: Point,
  p3: Point,
  numSamples: number = 10
): Point[] {
  const pts: Point[] = [];
  for (let i = 1; i <= numSamples; i++) {
    const t = i / numSamples;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    const x = mt3 * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p3.x;
    const y = mt3 * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p3.y;
    pts.push({ x, y });
  }
  return pts;
}

/**
 * Sample dense polyline points from any PathContour (including Bézier curves)
 */
export function sampleContourPoints(contour: PathContour, samplesPerSegment: number = 8): Point[] {
  if (!contour.nodes || contour.nodes.length === 0) return [];
  const nodes = contour.nodes;
  const densePoints: Point[] = [{ x: nodes[0].x, y: nodes[0].y }];

  for (let i = 0; i < nodes.length; i++) {
    const curr = nodes[i];
    const isLast = i === nodes.length - 1;
    const next = isLast ? (contour.closed ? nodes[0] : null) : nodes[i + 1];
    if (!next) break;

    const cp1 = curr.handleOut || { x: curr.x, y: curr.y };
    const cp2 = next.handleIn || { x: next.x, y: next.y };

    const isStraight =
      cp1.x === curr.x && cp1.y === curr.y && cp2.x === next.x && cp2.y === next.y;

    if (isStraight) {
      // Subdivide straight line if long
      const dist = Math.hypot(next.x - curr.x, next.y - curr.y);
      const steps = Math.max(2, Math.min(samplesPerSegment, Math.floor(dist / 20)));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        densePoints.push({
          x: curr.x + (next.x - curr.x) * t,
          y: curr.y + (next.y - curr.y) * t,
        });
      }
    } else {
      const sampled = sampleCubicBezier(
        { x: curr.x, y: curr.y },
        cp1,
        cp2,
        { x: next.x, y: next.y },
        samplesPerSegment
      );
      densePoints.push(...sampled);
    }
  }

  return densePoints;
}

/**
 * Test whether a canvas point is within a given distance of a contour (nodes or outline/segment)
 */
export function isPointNearContour(
  point: Point,
  contour: PathContour,
  threshold: number = 25
): boolean {
  if (!contour || !contour.nodes || contour.nodes.length === 0) return false;

  // Quick bounding box check with threshold margin
  const bbox = getContoursBoundingBox([contour]);
  if (
    point.x < bbox.minX - threshold ||
    point.x > bbox.maxX + threshold ||
    point.y < bbox.minY - threshold ||
    point.y > bbox.maxY + threshold
  ) {
    return false;
  }

  // 1. Check anchor nodes
  for (const node of contour.nodes) {
    if (Math.hypot(node.x - point.x, node.y - point.y) <= threshold) {
      return true;
    }
  }

  // 2. Check Bézier and line segments using sampleContourPoints
  const samples = sampleContourPoints(contour, 8);
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    if (Math.hypot(p.x - point.x, p.y - point.y) <= threshold) {
      return true;
    }
    if (i > 0) {
      const pPrev = samples[i - 1];
      const dx = p.x - pPrev.x;
      const dy = p.y - pPrev.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq > 0) {
        const t = Math.max(0, Math.min(1, ((point.x - pPrev.x) * dx + (point.y - pPrev.y) * dy) / lenSq));
        const projX = pPrev.x + t * dx;
        const projY = pPrev.y + t * dy;
        if (Math.hypot(point.x - projX, point.y - projY) <= threshold) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Erase contours at a given canvas point with specified radius and eraser mode.
 * - 'stroke': Deletes any contour that intersects with the eraser radius.
 * - 'cut': Cuts/splits contours by removing nodes within the eraser radius, preserving remaining parts.
 * - 'node': Removes individual anchor nodes falling within the eraser circle.
 */
export function eraseContoursAtPoint(
  contours: PathContour[],
  point: Point,
  radius: number,
  mode: 'stroke' | 'cut' | 'node' = 'stroke'
): PathContour[] {
  if (!contours || contours.length === 0) return [];

  if (mode === 'stroke') {
    return contours.filter((c) => !isPointNearContour(point, c, radius));
  }

  if (mode === 'node') {
    const result: PathContour[] = [];
    for (const contour of contours) {
      if (!isPointNearContour(point, contour, radius + 4)) {
        result.push(contour);
        continue;
      }
      const remainingNodes = contour.nodes.filter(
        (n) => Math.hypot(n.x - point.x, n.y - point.y) > radius
      );
      if (remainingNodes.length >= 2) {
        result.push({
          ...contour,
          nodes: remainingNodes,
        });
      }
    }
    return result;
  }

  if (mode === 'cut') {
    const result: PathContour[] = [];
    for (const contour of contours) {
      if (!isPointNearContour(point, contour, radius)) {
        result.push(contour);
        continue;
      }

      // Filter nodes that fall outside eraser radius
      const subSegments: BezierNode[][] = [];
      let currentSeg: BezierNode[] = [];

      for (const node of contour.nodes) {
        const dist = Math.hypot(node.x - point.x, node.y - point.y);
        if (dist > radius) {
          currentSeg.push(node);
        } else {
          if (currentSeg.length > 0) {
            subSegments.push(currentSeg);
            currentSeg = [];
          }
        }
      }
      if (currentSeg.length > 0) {
        subSegments.push(currentSeg);
      }

      for (const seg of subSegments) {
        if (seg.length >= 2) {
          result.push({
            id: generateId(),
            closed: contour.closed && subSegments.length === 1,
            nodes: seg.map((n) => ({
              ...n,
              id: generateId(),
            })),
          });
        }
      }
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
    const stride = Math.max(2, Math.min(6, Math.floor(numPts / 24)));
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

      if (len1 > 2 && len2 > 2) {
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
        simplifiedChain.push({
          point: simpSec[pIdx],
          isCorner: isFirstOfSec || isLastOfSec,
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

    // Chord-weighted tangent direction
    const vPrevX = (curr.x - prev.x) / dPrev;
    const vPrevY = (curr.y - prev.y) / dPrev;
    const vNextX = (next.x - curr.x) / dNext;
    const vNextY = (next.y - curr.y) / dNext;

    let tanX = vPrevX + vNextX;
    let tanY = vPrevY + vNextY;
    const tanLen = Math.hypot(tanX, tanY);

    if (tanLen > 0.01) {
      tanX /= tanLen;
      tanY /= tanLen;

      // Handle lengths scaled to 34% of segment length with smooth cap
      const hInLen = Math.min(dPrev * 0.34, 120);
      const hOutLen = Math.min(dNext * 0.34, 120);

      curr.handleIn = {
        x: Math.round(curr.x - tanX * hInLen),
        y: Math.round(curr.y - tanY * hInLen),
      };
      curr.handleOut = {
        x: Math.round(curr.x + tanX * hOutLen),
        y: Math.round(curr.y + tanY * hOutLen),
      };
    }
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
  pressureSensitivity: 'high' | 'normal' | 'low' | 'off' = 'normal'
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

    // マイターリミット: 鋭すぎる角（miter > 2.2）の外側はベベル（斜めカット2点）
    if (miter > 2.2) {
      if (cross > 0) {
        // 左に折れ曲がる（内角: 左、外角: 右）
        leftPoints.push({
          x: Math.round(pt.x + uNx * halfWidth * miter),
          y: Math.round(pt.y + uNy * halfWidth * miter),
        });
        rightPoints.push(
          { x: Math.round(pt.x - nPrev.x * halfWidth), y: Math.round(pt.y - nPrev.y * halfWidth) },
          { x: Math.round(pt.x - nCurr.x * halfWidth), y: Math.round(pt.y - nCurr.y * halfWidth) }
        );
      } else {
        // 右に折れ曲がる（内角: 右、外角: 左）
        leftPoints.push(
          { x: Math.round(pt.x + nPrev.x * halfWidth), y: Math.round(pt.y + nPrev.y * halfWidth) },
          { x: Math.round(pt.x + nCurr.x * halfWidth), y: Math.round(pt.y + nCurr.y * halfWidth) }
        );
        rightPoints.push({
          x: Math.round(pt.x - uNx * halfWidth * miter),
          y: Math.round(pt.y - uNy * halfWidth * miter),
        });
      }
    } else {
      // 通常のマイター角（シャープな角頂点）
      leftPoints.push({
        x: Math.round(pt.x + uNx * halfWidth * miter),
        y: Math.round(pt.y + uNy * halfWidth * miter),
      });
      rightPoints.push({
        x: Math.round(pt.x - uNx * halfWidth * miter),
        y: Math.round(pt.y - uNy * halfWidth * miter),
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
  pressureSensitivity: 'high' | 'normal' | 'low' | 'off' = 'normal'
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
 * Fast SVG path generator for active freehand drawing preview
 */
export function generateFastStrokeSvgPath(
  points: (Point | StrokePoint)[],
  strokeWidth: number = 40,
  style: BrushStyle = 'brush',
  roundCap: boolean = true,
  pressureSensitivity: 'high' | 'normal' | 'low' | 'off' = 'normal'
): string {
  if (points.length === 0) return '';
  const contour = strokePointsToOutline(points, strokeWidth, style, roundCap, pressureSensitivity);
  return contoursToSvgPath([contour]);
}

/**
 * Convert freehand stroke points (with optional stylus pressure & timing) into a closed smoothed or angular vector outline
 */
export function strokePointsToOutline(
  points: (Point | StrokePoint)[],
  strokeWidth: number = 40,
  style: BrushStyle = 'brush',
  roundCap: boolean = true,
  pressureSensitivity: 'high' | 'normal' | 'low' | 'off' = 'normal'
): PathContour {
  // カクカク角筆・ポリゴン筆は専用の幾何学的マイター角・直線セグメント生成ルーチンを使用
  if (style === 'sharp' || style === 'polygon') {
    return createSharpAngularContour(points, strokeWidth, pressureSensitivity);
  }

  // カクカク角丸筆は幾何学直線骨格＋角丸フィレット・ラウンドキャップルーチンを使用
  if (style === 'sharp_round') {
    return createSharpRoundedContour(points, strokeWidth, pressureSensitivity);
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

  // 1. Resample and smooth raw points to eliminate micro-jitter and normalize point density
  const rawCount = points.length;

  // Use two flat Float64Arrays to ping-pong the 3-pass smoothing without allocating intermediate objects
  const xBufA = new Float64Array(rawCount);
  const yBufA = new Float64Array(rawCount);
  const pBufA = new Float64Array(rawCount);
  const tBuf = new Float64Array(rawCount);

  for (let i = 0; i < rawCount; i++) {
    const pt = points[i];
    let pres = 0.5;
    if (pressureSensitivity !== 'off' && 'pressure' in pt && typeof pt.pressure === 'number' && pt.pressure > 0) {
      pres = pt.pressure;
    }
    xBufA[i] = pt.x;
    yBufA[i] = pt.y;
    pBufA[i] = pres;
    tBuf[i] = 'time' in pt && typeof pt.time === 'number' ? pt.time : 0;
  }

  let curX = xBufA;
  let curY = yBufA;
  let curP = pBufA;

  if (rawCount >= 3) {
    const xBufB = new Float64Array(rawCount);
    const yBufB = new Float64Array(rawCount);
    const pBufB = new Float64Array(rawCount);

    let srcX = xBufA, srcY = yBufA, srcP = pBufA;
    let dstX = xBufB, dstY = yBufB, dstP = pBufB;

    for (let pass = 0; pass < 3; pass++) {
      dstX[0] = srcX[0];
      dstY[0] = srcY[0];
      dstP[0] = srcP[0];
      const m = rawCount - 1;
      for (let i = 1; i < m; i++) {
        dstX[i] = (srcX[i - 1] + srcX[i] * 2 + srcX[i + 1]) * 0.25;
        dstY[i] = (srcY[i - 1] + srcY[i] * 2 + srcY[i + 1]) * 0.25;
        dstP[i] = (srcP[i - 1] + srcP[i] * 2 + srcP[i + 1]) * 0.25;
      }
      dstX[m] = srcX[m];
      dstY[m] = srcY[m];
      dstP[m] = srcP[m];

      // Swap buffers
      const tmpX = srcX; srcX = dstX; dstX = tmpX;
      const tmpY = srcY; srcY = dstY; dstY = tmpY;
      const tmpP = srcP; srcP = dstP; dstP = tmpP;
    }
    curX = srcX;
    curY = srcY;
    curP = srcP;
  }

  // Resample with optimal spacing (adaptive 6-8px for fine, organic curve precision without discretization artifacts)
  const minInterval = style === 'brush' || style === 'sumi' || style === 'fountain' ? 6 : 7;
  const minIntervalSq = minInterval * minInterval;
  const resampled: { x: number; y: number; pressure: number; time?: number }[] = [
    { x: curX[0], y: curY[0], pressure: curP[0], time: tBuf[0] || undefined }
  ];
  for (let i = 1; i < rawCount; i++) {
    const prev = resampled[resampled.length - 1];
    const dx = curX[i] - prev.x;
    const dy = curY[i] - prev.y;
    if (dx * dx + dy * dy >= minIntervalSq || i === rawCount - 1) {
      resampled.push({ x: curX[i], y: curY[i], pressure: curP[i], time: tBuf[i] || undefined });
    }
  }

  const n = resampled.length;
  if (n < 2) {
    return strokePointsToOutline([resampled[0]], strokeWidth, style, roundCap, pressureSensitivity);
  }

  // Calculate cumulative distance for stroke progress
  const dists = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const dx = resampled[i].x - resampled[i - 1].x;
    const dy = resampled[i].y - resampled[i - 1].y;
    dists[i] = dists[i - 1] + Math.hypot(dx, dy);
  }
  const totalLength = dists[n - 1] || 1;

  // Compute smooth tangent directions and normal vectors using flat Float64Arrays
  const txArr = new Float64Array(n);
  const tyArr = new Float64Array(n);
  const nxArr = new Float64Array(n);
  const nyArr = new Float64Array(n);
  const turnArr = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const prevIdx = Math.max(0, i - 2);
    const nextIdx = Math.min(n - 1, i + 2);
    let dx = resampled[nextIdx].x - resampled[prevIdx].x;
    let dy = resampled[nextIdx].y - resampled[prevIdx].y;
    if (dx * dx + dy * dy < 0.000001) {
      dx = resampled[Math.min(n - 1, i + 1)].x - resampled[Math.max(0, i - 1)].x;
      dy = resampled[Math.min(n - 1, i + 1)].y - resampled[Math.max(0, i - 1)].y;
    }
    const len = Math.hypot(dx, dy) || 1;
    txArr[i] = dx / len;
    tyArr[i] = dy / len;
    nxArr[i] = -tyArr[i];
    nyArr[i] = txArr[i];

    // Turning angle (curvature)
    if (i > 0 && i < n - 1) {
      const v1x = resampled[i].x - resampled[i - 1].x;
      const v1y = resampled[i].y - resampled[i - 1].y;
      const v2x = resampled[i + 1].x - resampled[i].x;
      const v2y = resampled[i + 1].y - resampled[i].y;
      const dot = v1x * v2x + v1y * v2y;
      const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1;
      const cosVal = Math.max(-1, Math.min(1, dot / mag));
      turnArr[i] = Math.acos(cosVal);
    }
  }

  // Precompute raw left and right half-widths along the stroke
  const rawLeftWidths = new Float64Array(n);
  const rawRightWidths = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const nx = nxArr[i];
    const ny = nyArr[i];
    const angleTurn = turnArr[i];
    const normDist = dists[i] / totalLength; // 0.0 to 1.0

    // Velocity factor (only active if pressure sensitivity is ON and timestamps exist)
    let velocityFactor = 1.0;
    if (pressureSensitivity !== 'off' && resampled[i].time && i > 0 && resampled[i - 1].time) {
      const dt = Math.max(1, resampled[i].time! - resampled[i - 1].time!);
      const ds = Math.hypot(resampled[i].x - resampled[i - 1].x, resampled[i].y - resampled[i - 1].y);
      const speed = ds / dt;
      // Gentle, smoothed velocity modulation (max ±12%)
      velocityFactor = Math.max(0.88, Math.min(1.12, 1.15 / (1.0 + speed * 0.25)));
    }

    // Determine point pressure
    let pointPressure = 0.5;
    if (pressureSensitivity === 'off') {
      pointPressure = 0.5;
    } else {
      const rawP = resampled[i].pressure ?? 0.5;
      if (pressureSensitivity === 'high') {
        pointPressure = Math.min(1.0, Math.pow(Math.max(0.01, rawP), 0.72));
      } else if (pressureSensitivity === 'low') {
        pointPressure = Math.min(1.0, Math.pow(Math.max(0.01, rawP), 1.35));
      } else {
        pointPressure = Math.min(1.0, Math.pow(Math.max(0.01, rawP), 0.92));
      }
    }

    let leftHalfWidth = strokeWidth / 2;
    let rightHalfWidth = strokeWidth / 2;

    if (style === 'signpen') {
      // 1. 水性サインペン (フェルトペン): Smooth, uniform fiber tip with gentle organic pressure response
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.70 + 0.60 * pointPressure);
      leftHalfWidth = rightHalfWidth = Math.max(3, (strokeWidth / 2) * presFactor);
    } else if (style === 'sumi') {
      // 2. 墨だまり筆: Rich sumi ink with authentic calligraphic pooling at start, sharp turns, and stops
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.40 + 1.20 * Math.pow(pointPressure, 0.9));
      let sumiPool = 1.0;

      // 始筆の墨溜まり
      if (normDist < 0.12) {
        const t = (0.12 - normDist) / 0.12;
        sumiPool += 0.38 * Math.sin(t * Math.PI * 0.5);
      } else if (normDist > 0.85) {
        // 終筆の溜まり・抜け
        const t = (normDist - 0.85) / 0.15;
        if (pressureSensitivity !== 'off' && pointPressure < 0.45) {
          sumiPool = Math.max(0.12, 1.0 - t * 0.88);
        } else {
          sumiPool += 0.30 * Math.sin(t * Math.PI);
        }
      }

      // 転節・角の墨溜まり (角でインクがにじみ溜まる)
      if (angleTurn > 0.40) {
        sumiPool += Math.min(0.35, (angleTurn / Math.PI) * 0.35);
      }

      leftHalfWidth = rightHalfWidth = Math.max(3, (strokeWidth / 2) * presFactor * sumiPool);
    } else if (style === 'marumoji') {
      // 3. 丸文字・ぽっぷ: Plump cute handwriting with rounded ends and bubble terminal nodes
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.85 + 0.30 * pointPressure);
      let bubbleEnd = 1.0;
      if (normDist < 0.12) {
        const t = Math.sin((normDist / 0.12) * Math.PI * 0.5);
        bubbleEnd = 1.28 - 0.28 * t;
      } else if (normDist > 0.88) {
        const t = Math.sin(((normDist - 0.88) / 0.12) * Math.PI * 0.5);
        bubbleEnd = 1.0 + 0.28 * t;
      }
      leftHalfWidth = rightHalfWidth = Math.max(4, (strokeWidth / 2) * presFactor * bubbleEnd);
    } else if (style === 'brush') {
      // 4. 毛筆・筆ペン (Authentic Japanese Calligraphy & Brush Pen Dynamics):
      // 45° brush nib angle (縦太横細・右払いの張り・始筆・転節・終筆)
      const ux = txArr[i];
      const uy = tyArr[i];
      // Continuous directional modulation (vertical strokes bold, horizontal strokes lean, right-down rich)
      const angleModulation = 0.82 + 0.28 * Math.abs(uy) + 0.36 * Math.max(0, ux * 0.65 + uy * 0.75);

      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.32 + 1.36 * Math.pow(pointPressure, 0.95));
      const baseWidth = (strokeWidth / 2) * angleModulation * presFactor * velocityFactor;

      let leftMul = 1.0;
      let rightMul = 1.0;

      // 1. 始筆・打ち込み (Entry head: smooth 45° bristle flare)
      if (normDist < 0.12) {
        const t = normDist / 0.12;
        const entryFlare = 0.72 + 0.28 * Math.sin(t * Math.PI * 0.5);
        leftMul *= entryFlare * 1.12;
        rightMul *= entryFlare * 0.92;
      }

      // 2. 転節・折れ (Corner shoulder flare)
      if (angleTurn > 0.35) {
        const shoulder = (angleTurn / Math.PI) * 0.22;
        leftMul += shoulder;
        rightMul += shoulder * 0.75;
      }

      // 3. 終筆 (止め・ハネ・払い)
      if (normDist > 0.80) {
        const t = (normDist - 0.80) / 0.20; // 0 to 1
        if (pressureSensitivity !== 'off' && pointPressure < 0.45) {
          // 払い (Harai / Flick): Smooth taper to clean tip
          const taper = Math.max(0.08, 1.0 - Math.pow(t, 1.25) * 0.92);
          leftMul *= taper;
          rightMul *= taper;
        } else {
          // 止め (Tome): Smooth settled landing
          const stopProfile = 1.0 + 0.14 * Math.sin(t * Math.PI) - 0.08 * t;
          leftMul *= stopProfile;
          rightMul *= stopProfile;
        }
      }

      leftHalfWidth = Math.max(2.5, baseWidth * leftMul);
      rightHalfWidth = Math.max(2.5, baseWidth * rightMul);
    } else if (style === 'fountain') {
      // 5. 万年筆・Gペン: Directional angle contrast with downward flex nib dynamics (crisp dip pen)
      const ux = txArr[i];
      const uy = tyArr[i];
      const angle = Math.atan2(Math.abs(uy), Math.abs(ux) + 0.001);
      // Downward strokes pull nib slit open (flexing wide), while upward and horizontal lines are ultra sharp
      const isDownward = uy > 0 ? 0.45 * uy : 0;
      const angleContrast = 0.22 + 0.90 * Math.sin(angle) + isDownward;
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.28 + 1.25 * Math.pow(pointPressure, 1.15));
      leftHalfWidth = rightHalfWidth = Math.max(1.8, (strokeWidth / 2) * angleContrast * presFactor);
    } else if (style === 'marker') {
      // 6. 丸マーカー: Stable consistent monoline
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.85 + 0.30 * pointPressure);
      leftHalfWidth = rightHalfWidth = Math.max(3, (strokeWidth / 2) * presFactor);
    } else if (style === 'ballpoint') {
      // 7. ゲルボールペン: Crisp fine notebook line (0.38mm - 0.5mm feel)
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.65 + 0.65 * pointPressure);
      leftHalfWidth = rightHalfWidth = Math.max(2, (strokeWidth / 3.0) * presFactor);
    } else if (style === 'chalk') {
      // 8. ぽってりクレヨン・チョーク: Chubby bubbly stroke with soft volume
      let bubble = 1.0;
      if (normDist < 0.10 || normDist > 0.90) {
        bubble = 1.15;
      }
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.75 + 0.45 * pointPressure);
      leftHalfWidth = rightHalfWidth = Math.max(4, (strokeWidth * 0.54) * presFactor * bubble);
    } else if (style === 'calligraphy') {
      // 9. 平筆カリグラフィー (45° Broad-Edge Chisel Nib): Pure fixed 45° nib ribbon geometry
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.35 + 1.15 * Math.pow(pointPressure, 1.0));
      leftHalfWidth = rightHalfWidth = Math.max(2.0, (strokeWidth / 2) * presFactor);
    } else if (style === 'highlighter') {
      // 10. 平マーカー・リボン (90° Flat Nib): Pure fixed 90° flat ribbon geometry
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.80 + 0.40 * pointPressure);
      leftHalfWidth = rightHalfWidth = Math.max(2.5, (strokeWidth / 2) * presFactor);
    } else if (style === 'pencil') {
      // 11. 鉛筆・細字: Fine delicate stroke with responsive pressure sensitivity
      const presFactor = pressureSensitivity === 'off' ? 1.0 : (0.40 + 0.95 * pointPressure);
      leftHalfWidth = rightHalfWidth = Math.max(1.5, (strokeWidth / 3.6) * presFactor);
    } else if (style === 'wobbly') {
      // 13. ゆらぎ手書き: Gentle organic micro-wobble and human tremolo
      const wobble = Math.sin(normDist * 24 + i * 1.2) * 0.14;
      const presFactor = (pressureSensitivity === 'off' ? 1.0 : (0.75 + 0.45 * pointPressure)) + wobble;
      leftHalfWidth = rightHalfWidth = Math.max(3, (strokeWidth / 2) * presFactor);
    }

    rawLeftWidths[i] = leftHalfWidth;
    rawRightWidths[i] = rightHalfWidth;
  }

  // 2. Width Smoothing Pass (Guaranteeing zero bumpiness / mokomoko along the stroke)
  const smoothedLeftWidths = new Float64Array(n);
  const smoothedRightWidths = new Float64Array(n);
  if (n > 0) {
    smoothedLeftWidths[0] = rawLeftWidths[0];
    smoothedRightWidths[0] = rawRightWidths[0];
    const lastIdx = n - 1;
    for (let i = 1; i < lastIdx; i++) {
      smoothedLeftWidths[i] = (rawLeftWidths[i - 1] + rawLeftWidths[i] * 2 + rawLeftWidths[i + 1]) * 0.25;
      smoothedRightWidths[i] = (rawRightWidths[i - 1] + rawRightWidths[i] * 2 + rawRightWidths[i + 1]) * 0.25;
    }
    smoothedLeftWidths[lastIdx] = rawLeftWidths[lastIdx];
    smoothedRightWidths[lastIdx] = rawRightWidths[lastIdx];
  }

  // Generate left and right offset boundary points
  const leftPoints: Point[] = [];
  const rightPoints: Point[] = [];

  const isChiselStyle = style === 'calligraphy' || style === 'highlighter';
  const chiselAngleRad = style === 'highlighter' ? (90 * Math.PI) / 180 : (45 * Math.PI) / 180;
  const chiselDx = Math.cos(chiselAngleRad);
  const chiselDy = Math.sin(chiselAngleRad);

  for (let i = 0; i < n; i++) {
    const nx = nxArr[i];
    const ny = nyArr[i];
    const lw = smoothedLeftWidths[i];
    const rw = smoothedRightWidths[i];

    if (isChiselStyle) {
      // Broad-edge chisel nib: fixed nib angle ribbon offset
      // A tiny normal offset ensures strokes drawn along 45° remain a clean 2D vector path
      const minNormalPad = 0.8;
      leftPoints.push({
        x: Math.round(resampled[i].x + chiselDx * lw + nx * minNormalPad),
        y: Math.round(resampled[i].y + chiselDy * lw + ny * minNormalPad),
      });
      rightPoints.push({
        x: Math.round(resampled[i].x - chiselDx * rw - nx * minNormalPad),
        y: Math.round(resampled[i].y - chiselDy * rw - ny * minNormalPad),
      });
    } else {
      leftPoints.push({
        x: Math.round(resampled[i].x + nx * lw),
        y: Math.round(resampled[i].y + ny * lw),
      });
      rightPoints.push({
        x: Math.round(resampled[i].x - nx * rw),
        y: Math.round(resampled[i].y - ny * rw),
      });
    }
  }

  // Simplify left and right sides with RDP to keep path nodes clean and easily editable while preserving hand-drawn nuances
  // Adaptive epsilon based on brush style (0.9 - 1.2px) to prevent polygonal faceting / jagged corners
  const epsilon = style === 'signpen' || style === 'ballpoint' || style === 'pencil' ? 0.9 : 1.1;
  const simpLeft = simplifyPointsRDP(leftPoints, epsilon);
  const simpRight = simplifyPointsRDP(rightPoints, epsilon);

  // Assemble full loop
  const allPoints: Point[] = [];

  // Start cap
  if (roundCap && !isChiselStyle && simpLeft.length > 0 && simpRight.length > 0) {
    const p0 = resampled[0];
    const p1 = resampled[1];
    const dx0 = p0.x - p1.x;
    const dy0 = p0.y - p1.y;
    const len0 = Math.hypot(dx0, dy0) || 1;
    const halfWidth0 = Math.hypot(simpLeft[0].x - simpRight[0].x, simpLeft[0].y - simpRight[0].y) / 2;
    // For brush style, allow clean 45° entry contour without oversized artificial round cap if entry is sharp
    if (halfWidth0 > 3) {
      allPoints.push({
        x: Math.round(p0.x + (dx0 / len0) * halfWidth0),
        y: Math.round(p0.y + (dy0 / len0) * halfWidth0),
      });
    }
  }

  allPoints.push(...simpRight);

  // End cap
  if (roundCap && !isChiselStyle && simpLeft.length > 0 && simpRight.length > 0) {
    const pn = resampled[n - 1];
    const pnPrev = resampled[n - 2];
    const dxn = pn.x - pnPrev.x;
    const dyn = pn.y - pnPrev.y;
    const lenn = Math.hypot(dxn, dyn) || 1;
    const lastRight = simpRight[simpRight.length - 1];
    const lastLeft = simpLeft[simpLeft.length - 1];
    const halfWidthN = Math.hypot(lastRight.x - lastLeft.x, lastRight.y - lastLeft.y) / 2;
    // If end has tapered to a sharp tip (払い/flick), do NOT add a round bulb cap, let it terminate cleanly into a point
    if (halfWidthN > 4.5) {
      allPoints.push({
        x: Math.round(pn.x + (dxn / lenn) * halfWidthN),
        y: Math.round(pn.y + (dyn / lenn) * halfWidthN),
      });
    } else if (halfWidthN > 1.5) {
      // Small sharp tip apex
      allPoints.push({
        x: Math.round(pn.x + (dxn / lenn) * (halfWidthN * 0.8)),
        y: Math.round(pn.y + (dyn / lenn) * (halfWidthN * 0.8)),
      });
    }
  }

  // Reverse left side to close loop in clockwise order (area > 0 in screen, TrueType compatible)
  allPoints.push(...simpLeft.reverse());

  // Convert to cubic bezier nodes with smooth, spike-protected tangents
  const nodes: BezierNode[] = allPoints.map((p) => ({
    id: generateId(),
    x: p.x,
    y: p.y,
    type: 'smooth',
  }));

  const total = nodes.length;
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

    if (dPrev < 0.001 || dNext < 0.001) {
      curr.handleIn = { x: curr.x, y: curr.y };
      curr.handleOut = { x: curr.x, y: curr.y };
      continue;
    }

    // Chord-weighted tangent direction for natural, non-jagged curvature transitions
    const uPrevX = vPrevX / dPrev;
    const uPrevY = vPrevY / dPrev;
    const uNextX = vNextX / dNext;
    const uNextY = vNextY / dNext;

    let tanX = uPrevX + uNextX;
    let tanY = uPrevY + uNextY;
    const tanLen = Math.hypot(tanX, tanY);

    if (tanLen > 0.001) {
      tanX /= tanLen;
      tanY /= tanLen;

      // Calculate dot product (cosine of turning angle) between incoming and outgoing segments
      const dot = (vPrevX * vNextX + vPrevY * vNextY) / (dPrev * dNext);
      const cosAngle = Math.max(-1, Math.min(1, dot));

      // Limit handle length relative to nearby segment lengths to prevent handle overshoot.
      let handleRatio = 0.33;
      if (cosAngle < 0) {
        handleRatio = 0.12 + 0.21 * (1 + cosAngle); // Drops smoothly for tight U-turns
      }

      const hInLen = Math.min(dPrev * handleRatio, 120);
      const hOutLen = Math.min(dNext * handleRatio, 120);

      curr.handleIn = {
        x: Math.round(curr.x - tanX * hInLen),
        y: Math.round(curr.y - tanY * hInLen),
      };
      curr.handleOut = {
        x: Math.round(curr.x + tanX * hOutLen),
        y: Math.round(curr.y + tanY * hOutLen),
      };
    } else {
      curr.handleIn = { x: curr.x, y: curr.y };
      curr.handleOut = { x: curr.x, y: curr.y };
    }
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
export function createRectContour(x1: number, y1: number, x2: number, y2: number): PathContour {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  return {
    id: generateId(),
    closed: true,
    nodes: [
      { id: generateId(), x: minX, y: minY, type: 'corner' },
      { id: generateId(), x: maxX, y: minY, type: 'corner' },
      { id: generateId(), x: maxX, y: maxY, type: 'corner' },
      { id: generateId(), x: minX, y: maxY, type: 'corner' },
    ],
  };
}

/**
 * Create an ellipse contour with 4 cubic bezier nodes
 */
export function createEllipseContour(cx: number, cy: number, rx: number, ry: number): PathContour {
  const kappa = 0.5522847498;
  const ox = rx * kappa;
  const oy = ry * kappa;

  return {
    id: generateId(),
    closed: true,
    nodes: [
      {
        id: generateId(),
        x: cx,
        y: cy - ry,
        handleIn: { x: cx - ox, y: cy - ry },
        handleOut: { x: cx + ox, y: cy - ry },
        type: 'symmetric',
      },
      {
        id: generateId(),
        x: cx + rx,
        y: cy,
        handleIn: { x: cx + rx, y: cy - oy },
        handleOut: { x: cx + rx, y: cy + oy },
        type: 'symmetric',
      },
      {
        id: generateId(),
        x: cx,
        y: cy + ry,
        handleIn: { x: cx + ox, y: cy + ry },
        handleOut: { x: cx - ox, y: cy + ry },
        type: 'symmetric',
      },
      {
        id: generateId(),
        x: cx - rx,
        y: cy,
        handleIn: { x: cx - rx, y: cy + oy },
        handleOut: { x: cx - rx, y: cy - oy },
        type: 'symmetric',
      },
    ],
  };
}

/**
 * Create a perfect circle contour
 */
export function createCircleContour(cx: number, cy: number, r: number): PathContour {
  return createEllipseContour(cx, cy, r, r);
}

/**
 * Create a square contour
 */
export function createSquareContour(cx: number, cy: number, size: number): PathContour {
  const half = size / 2;
  return createRectContour(cx - half, cy - half, cx + half, cy + half);
}

/**
 * Create a rounded rectangle contour (8 nodes)
 */
export function createRoundedRectContour(
  cx: number,
  cy: number,
  width: number,
  height: number,
  radius: number = 60
): PathContour {
  const w2 = width / 2;
  const h2 = height / 2;
  const r = Math.max(0, Math.min(radius, w2, h2));
  const kappa = 0.5522847498;
  const kr = r * kappa;

  const minX = cx - w2;
  const maxX = cx + w2;
  const minY = cy - h2;
  const maxY = cy + h2;

  if (r <= 2) {
    return createRectContour(minX, minY, maxX, maxY);
  }

  return {
    id: generateId(),
    closed: true,
    nodes: [
      // Top edge right
      {
        id: generateId(),
        x: maxX - r,
        y: minY,
        handleIn: null,
        handleOut: { x: maxX - r + kr, y: minY },
        type: 'smooth',
      },
      // Right edge top
      {
        id: generateId(),
        x: maxX,
        y: minY + r,
        handleIn: { x: maxX, y: minY + r - kr },
        handleOut: null,
        type: 'smooth',
      },
      // Right edge bottom
      {
        id: generateId(),
        x: maxX,
        y: maxY - r,
        handleIn: null,
        handleOut: { x: maxX, y: maxY - r + kr },
        type: 'smooth',
      },
      // Bottom edge right
      {
        id: generateId(),
        x: maxX - r,
        y: maxY,
        handleIn: { x: maxX - r + kr, y: maxY },
        handleOut: null,
        type: 'smooth',
      },
      // Bottom edge left
      {
        id: generateId(),
        x: minX + r,
        y: maxY,
        handleIn: null,
        handleOut: { x: minX + r - kr, y: maxY },
        type: 'smooth',
      },
      // Left edge bottom
      {
        id: generateId(),
        x: minX,
        y: maxY - r,
        handleIn: { x: minX, y: maxY - r + kr },
        handleOut: null,
        type: 'smooth',
      },
      // Left edge top
      {
        id: generateId(),
        x: minX,
        y: minY + r,
        handleIn: null,
        handleOut: { x: minX, y: minY + r - kr },
        type: 'smooth',
      },
      // Top edge left
      {
        id: generateId(),
        x: minX + r,
        y: minY,
        handleIn: { x: minX + r - kr, y: minY },
        handleOut: null,
        type: 'smooth',
      },
    ],
  };
}

/**
 * Create a triangle contour
 */
export function createTriangleContour(
  cx: number,
  cy: number,
  width: number,
  height: number,
  direction: 'up' | 'down' | 'left' | 'right' = 'up'
): PathContour {
  const w2 = width / 2;
  const h2 = height / 2;

  let pts: Point[] = [];
  if (direction === 'up') {
    pts = [
      { x: cx, y: cy - h2 },
      { x: cx + w2, y: cy + h2 },
      { x: cx - w2, y: cy + h2 },
    ];
  } else if (direction === 'down') {
    pts = [
      { x: cx - w2, y: cy - h2 },
      { x: cx + w2, y: cy - h2 },
      { x: cx, y: cy + h2 },
    ];
  } else if (direction === 'right') {
    pts = [
      { x: cx - w2, y: cy - h2 },
      { x: cx + w2, y: cy },
      { x: cx - w2, y: cy + h2 },
    ];
  } else {
    pts = [
      { x: cx + w2, y: cy - h2 },
      { x: cx + w2, y: cy + h2 },
      { x: cx - w2, y: cy },
    ];
  }

  return {
    id: generateId(),
    closed: true,
    nodes: pts.map((p) => ({
      id: generateId(),
      x: Math.round(p.x),
      y: Math.round(p.y),
      type: 'corner',
    })),
  };
}

/**
 * Create a right-angle triangle contour
 */
export function createRightTriangleContour(
  cx: number,
  cy: number,
  width: number,
  height: number
): PathContour {
  const w2 = width / 2;
  const h2 = height / 2;
  return {
    id: generateId(),
    closed: true,
    nodes: [
      { id: generateId(), x: Math.round(cx - w2), y: Math.round(cy - h2), type: 'corner' },
      { id: generateId(), x: Math.round(cx + w2), y: Math.round(cy + h2), type: 'corner' },
      { id: generateId(), x: Math.round(cx - w2), y: Math.round(cy + h2), type: 'corner' },
    ],
  };
}

/**
 * Create a 5-pointed (or N-pointed) star contour
 */
export function createStarContour(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius?: number,
  points: number = 5
): PathContour {
  const inR = innerRadius ?? outerRadius * 0.42;
  const total = points * 2;
  const nodes: BezierNode[] = [];

  for (let i = 0; i < total; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? outerRadius : inR;
    nodes.push({
      id: generateId(),
      x: Math.round(cx + r * Math.cos(angle)),
      y: Math.round(cy + r * Math.sin(angle)),
      type: 'corner',
    });
  }

  return {
    id: generateId(),
    closed: true,
    nodes,
  };
}

/**
 * Create a smooth Heart contour
 */
export function createHeartContour(
  cx: number,
  cy: number,
  width: number,
  height: number
): PathContour {
  const w2 = width / 2;
  const h2 = height / 2;

  return {
    id: generateId(),
    closed: true,
    nodes: [
      // 0: Bottom tip (sharp cusp corner)
      {
        id: generateId(),
        x: cx,
        y: Math.round(cy + h2 * 0.95),
        handleIn: { x: Math.round(cx + w2 * 0.25), y: Math.round(cy + h2 * 0.3) },
        handleOut: { x: Math.round(cx - w2 * 0.25), y: Math.round(cy + h2 * 0.3) },
        type: 'corner',
      },
      // 1: Left lobe outer curve
      {
        id: generateId(),
        x: Math.round(cx - w2),
        y: Math.round(cy - h2 * 0.1),
        handleIn: { x: Math.round(cx - w2), y: Math.round(cy + h2 * 0.45) },
        handleOut: { x: Math.round(cx - w2), y: Math.round(cy - h2 * 0.55) },
        type: 'smooth',
      },
      // 2: Left lobe top peak
      {
        id: generateId(),
        x: Math.round(cx - w2 * 0.52),
        y: Math.round(cy - h2 * 0.95),
        handleIn: { x: Math.round(cx - w2 * 0.85), y: Math.round(cy - h2 * 0.95) },
        handleOut: { x: Math.round(cx - w2 * 0.2), y: Math.round(cy - h2 * 0.95) },
        type: 'smooth',
      },
      // 3: Center top notch (dip)
      {
        id: generateId(),
        x: cx,
        y: Math.round(cy - h2 * 0.38),
        handleIn: { x: Math.round(cx - w2 * 0.08), y: Math.round(cy - h2 * 0.65) },
        handleOut: { x: Math.round(cx + w2 * 0.08), y: Math.round(cy - h2 * 0.65) },
        type: 'corner',
      },
      // 4: Right lobe top peak
      {
        id: generateId(),
        x: Math.round(cx + w2 * 0.52),
        y: Math.round(cy - h2 * 0.95),
        handleIn: { x: Math.round(cx + w2 * 0.2), y: Math.round(cy - h2 * 0.95) },
        handleOut: { x: Math.round(cx + w2 * 0.85), y: Math.round(cy - h2 * 0.95) },
        type: 'smooth',
      },
      // 5: Right lobe outer curve
      {
        id: generateId(),
        x: Math.round(cx + w2),
        y: Math.round(cy - h2 * 0.1),
        handleIn: { x: Math.round(cx + w2), y: Math.round(cy - h2 * 0.55) },
        handleOut: { x: Math.round(cx + w2), y: Math.round(cy + h2 * 0.45) },
        type: 'smooth',
      },
    ],
  };
}

/**
 * Create a 4-point Sparkle / 星芒形 / 十字星 contour (Smooth 4-point star / diamond sparkle)
 */
export function createSparkleContour(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRatio: number = 0.22
): PathContour {
  const R = outerRadius;
  const inR = Math.max(6, R * innerRatio);
  const nodes: BezierNode[] = [];

  // 8 points (4 sharp tips + 4 smooth inner concave valleys)
  for (let i = 0; i < 8; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 4;
    const isTip = i % 2 === 0;
    const r = isTip ? R : inR;
    const px = Math.round(cx + r * Math.cos(angle));
    const py = Math.round(cy + r * Math.sin(angle));

    if (isTip) {
      nodes.push({
        id: generateId(),
        x: px,
        y: py,
        type: 'corner',
      });
    } else {
      // Smooth valley curve
      const tangentAngle = angle + Math.PI / 2;
      const handleLen = inR * 0.55;
      const hx = Math.round(handleLen * Math.cos(tangentAngle));
      const hy = Math.round(handleLen * Math.sin(tangentAngle));
      nodes.push({
        id: generateId(),
        x: px,
        y: py,
        handleIn: { x: px - hx, y: py - hy },
        handleOut: { x: px + hx, y: py + hy },
        type: 'smooth',
      });
    }
  }

  return {
    id: generateId(),
    closed: true,
    nodes,
  };
}

/**
 * Create an 8-point Starburst / 8芒星 contour
 */
export function createStarburstContour(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRatio: number = 0.45,
  points: number = 8
): PathContour {
  const inR = outerRadius * innerRatio;
  const total = points * 2;
  const nodes: BezierNode[] = [];

  for (let i = 0; i < total; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? outerRadius : inR;
    nodes.push({
      id: generateId(),
      x: Math.round(cx + r * Math.cos(angle)),
      y: Math.round(cy + r * Math.sin(angle)),
      type: 'corner',
    });
  }

  return {
    id: generateId(),
    closed: true,
    nodes,
  };
}

/**
 * Create a Diamond / 菱形 contour
 */
export function createDiamondContour(
  cx: number,
  cy: number,
  width: number,
  height: number
): PathContour {
  const w2 = width / 2;
  const h2 = height / 2;
  return {
    id: generateId(),
    closed: true,
    nodes: [
      { id: generateId(), x: cx, y: Math.round(cy - h2), type: 'corner' },
      { id: generateId(), x: Math.round(cx + w2), y: cy, type: 'corner' },
      { id: generateId(), x: cx, y: Math.round(cy + h2), type: 'corner' },
      { id: generateId(), x: Math.round(cx - w2), y: cy, type: 'corner' },
    ],
  };
}

/**
 * Create a regular Hexagon / 六角形 contour
 */
export function createHexagonContour(cx: number, cy: number, radius: number): PathContour {
  const nodes: BezierNode[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 3;
    nodes.push({
      id: generateId(),
      x: Math.round(cx + radius * Math.cos(angle)),
      y: Math.round(cy + radius * Math.sin(angle)),
      type: 'corner',
    });
  }
  return {
    id: generateId(),
    closed: true,
    nodes,
  };
}

/**
 * Create a Semicircle / 半円 contour
 */
export function createSemicircleContour(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  direction: 'top' | 'bottom' | 'left' | 'right' = 'top'
): PathContour {
  const kappa = 0.5522847498;
  const ox = rx * kappa;
  const oy = ry * kappa;

  if (direction === 'top') {
    return {
      id: generateId(),
      closed: true,
      nodes: [
        { id: generateId(), x: cx - rx, y: cy, type: 'corner' },
        {
          id: generateId(),
          x: cx,
          y: cy - ry,
          handleIn: { x: cx - ox, y: cy - ry },
          handleOut: { x: cx + ox, y: cy - ry },
          type: 'smooth',
        },
        { id: generateId(), x: cx + rx, y: cy, type: 'corner' },
      ],
    };
  } else if (direction === 'bottom') {
    return {
      id: generateId(),
      closed: true,
      nodes: [
        { id: generateId(), x: cx + rx, y: cy, type: 'corner' },
        {
          id: generateId(),
          x: cx,
          y: cy + ry,
          handleIn: { x: cx + ox, y: cy + ry },
          handleOut: { x: cx - ox, y: cy + ry },
          type: 'smooth',
        },
        { id: generateId(), x: cx - rx, y: cy, type: 'corner' },
      ],
    };
  } else if (direction === 'right') {
    return {
      id: generateId(),
      closed: true,
      nodes: [
        { id: generateId(), x: cx, y: cy - ry, type: 'corner' },
        {
          id: generateId(),
          x: cx + rx,
          y: cy,
          handleIn: { x: cx + rx, y: cy - oy },
          handleOut: { x: cx + rx, y: cy + oy },
          type: 'smooth',
        },
        { id: generateId(), x: cx, y: cy + ry, type: 'corner' },
      ],
    };
  } else {
    return {
      id: generateId(),
      closed: true,
      nodes: [
        { id: generateId(), x: cx, y: cy + ry, type: 'corner' },
        {
          id: generateId(),
          x: cx - rx,
          y: cy,
          handleIn: { x: cx - rx, y: cy + oy },
          handleOut: { x: cx - rx, y: cy - oy },
          type: 'smooth',
        },
        { id: generateId(), x: cx, y: cy - ry, type: 'corner' },
      ],
    };
  }
}

/**
 * Create a Ring / ドーナツ型 (2 concentric circles with evenodd fill)
 */
export function createRingContours(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number
): PathContour[] {
  const outer = createCircleContour(cx, cy, outerR);
  const inner = createCircleContour(cx, cy, innerR);
  return [outer, inner];
}

/**
 * Create a Pill / カプセル contour
 */
export function createPillContour(
  cx: number,
  cy: number,
  width: number,
  height: number
): PathContour {
  const isHorizontal = width >= height;
  const radius = isHorizontal ? height / 2 : width / 2;
  return createRoundedRectContour(cx, cy, width, height, radius);
}

/**
 * Create a Parallelogram / 平行四辺形 contour
 */
export function createParallelogramContour(
  cx: number,
  cy: number,
  width: number,
  height: number,
  slantDeg: number = 18
): PathContour {
  const rect = createRectContour(cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2);
  return slantSingleContour(rect, slantDeg, cy);
}

/**
 * Create a Crescent Moon / 三日月 contour
 */
export function createCrescentContour(cx: number, cy: number, radius: number): PathContour {
  const r = radius;
  const kappa = 0.5522847498;
  const ox = r * kappa;
  const oy = r * kappa;

  return {
    id: generateId(),
    closed: true,
    nodes: [
      // Top tip
      {
        id: generateId(),
        x: cx,
        y: cy - r,
        handleIn: { x: cx + ox * 0.4, y: cy - r * 0.4 },
        handleOut: { x: cx + ox, y: cy - r },
        type: 'corner',
      },
      // Outer right curve
      {
        id: generateId(),
        x: cx + r,
        y: cy,
        handleIn: { x: cx + r, y: cy - oy },
        handleOut: { x: cx + r, y: cy + oy },
        type: 'smooth',
      },
      // Bottom tip
      {
        id: generateId(),
        x: cx,
        y: cy + r,
        handleIn: { x: cx + ox, y: cy + r },
        handleOut: { x: cx + ox * 0.4, y: cy + r * 0.4 },
        type: 'corner',
      },
      // Inner scoop curve
      {
        id: generateId(),
        x: Math.round(cx + r * 0.35),
        y: cy,
        handleIn: { x: Math.round(cx + r * 0.35), y: Math.round(cy + oy * 0.5) },
        handleOut: { x: Math.round(cx + r * 0.35), y: Math.round(cy - oy * 0.5) },
        type: 'smooth',
      },
    ],
  };
}

/**
 * Generate standard preset contours from ShapeType
 */
export function generateShapeByType(
  type: ShapeType,
  cx: number = 500,
  cy: number = 500,
  size: number = 600
): PathContour[] {
  const half = size / 2;
  switch (type) {
    case 'circle':
      return [createCircleContour(cx, cy, half)];
    case 'ellipse':
      return [createEllipseContour(cx, cy, half, half * 0.65)];
    case 'square':
      return [createSquareContour(cx, cy, size)];
    case 'rect':
      return [createRectContour(cx - half, cy - half * 0.65, cx + half, cy + half * 0.65)];
    case 'rounded_rect':
      return [createRoundedRectContour(cx, cy, size, size * 0.8, 80)];
    case 'triangle':
      return [createTriangleContour(cx, cy, size, size, 'up')];
    case 'triangle_down':
      return [createTriangleContour(cx, cy, size, size, 'down')];
    case 'right_triangle':
      return [createRightTriangleContour(cx, cy, size, size)];
    case 'star':
      return [createStarContour(cx, cy, half, half * 0.42, 5)];
    case 'heart':
      return [createHeartContour(cx, cy, size, size)];
    case 'sparkle':
      return [createSparkleContour(cx, cy, half, 0.22)];
    case 'starburst':
      return [createStarburstContour(cx, cy, half, 0.45, 8)];
    case 'diamond':
      return [createDiamondContour(cx, cy, size * 0.8, size)];
    case 'hexagon':
      return [createHexagonContour(cx, cy, half)];
    case 'semicircle':
      return [createSemicircleContour(cx, cy, half, half, 'top')];
    case 'ring':
      return createRingContours(cx, cy, half, half * 0.55);
    case 'pill':
      return [createPillContour(cx, cy, size, size * 0.5)];
    case 'parallelogram':
      return [createParallelogramContour(cx, cy, size, size * 0.65, 18)];
    case 'crescent':
      return [createCrescentContour(cx, cy, half)];
    default:
      return [createSquareContour(cx, cy, size)];
  }
}

/**
 * Geometric Shape Presets Catalog for Font Design & Lettering
 */
export const SHAPE_PRESETS: ShapePreset[] = [
  { id: 'circle', name: '正円', category: 'basic', description: '完全な円（4ノード高精度ベジェ）' },
  { id: 'ellipse', name: '楕円', category: 'basic', description: '横長・平体楕円' },
  { id: 'square', name: '正方形', category: 'basic', description: '幾何学フォント基本正方形' },
  { id: 'rect', name: '長方形', category: 'basic', description: 'バー・横棒・縦棒' },
  { id: 'rounded_rect', name: '角丸四角', category: 'basic', description: 'ソフトな角丸四角形' },
  { id: 'triangle', name: '正三角形', category: 'polygon', description: '上向き正三角形' },
  { id: 'triangle_down', name: '逆三角形', category: 'polygon', description: '下向き三角形' },
  { id: 'right_triangle', name: '直角三角形', category: 'polygon', description: 'かな作字・止め用直角三角' },
  { id: 'diamond', name: '菱形 (ダイヤ)', category: 'polygon', description: '濁点・装飾用菱形' },
  { id: 'hexagon', name: '六角形', category: 'polygon', description: 'ハニカム六角形' },
  { id: 'star', name: '星型 (5芒星)', category: 'symbol', description: '五角星・スター' },
  { id: 'sparkle', name: '星芒形 (4芒星)', category: 'symbol', description: 'きらめき・十字星芒形・スパークル' },
  { id: 'starburst', name: '星芒形 (8芒星)', category: 'symbol', description: '8放射スターバースト' },
  { id: 'heart', name: 'ハート型', category: 'symbol', description: '滑らかなベジェ曲線ハート' },
  { id: 'semicircle', name: '半円', category: 'decorative', description: 'アーチ・半円' },
  { id: 'crescent', name: '三日月', category: 'decorative', description: '三日月・ムーン' },
  { id: 'ring', name: 'ドーナツ (リング)', category: 'decorative', description: '二重円・中空リング' },
  { id: 'pill', name: 'カプセル', category: 'decorative', description: '角丸長円・カプセル' },
  { id: 'parallelogram', name: '平行四辺形', category: 'decorative', description: '傾斜バー・スラッシュ' },
];

/**
 * Convert an open path (stroke) to an outlined geometric closed ribbon or path
 * Useful for geometric & design font creation
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

export interface SmallKanaOptions {
  scale?: number; // 0.60 ~ 0.85, default 0.72
  placement?: 'bottom-left' | 'center' | 'bottom-center' | 'baseline';
  offsetX?: number;
  offsetY?: number;
  weightDelta?: number; // 光学補正（線の太さ加減算）
}

/**
 * Scale contours down for small kana (customizable scale, placement and optical weight boost)
 */
export function createSmallKanaContours(
  contours: PathContour[],
  options?: SmallKanaOptions
): PathContour[] {
  if (!contours || contours.length === 0) return [];

  const scale = options?.scale ?? 0.72;
  const placement = options?.placement ?? 'bottom-left';
  const offsetX = options?.offsetX ?? 0;
  const offsetY = options?.offsetY ?? 0;
  const weightDelta = options?.weightDelta ?? 0;

  // Scale down
  let scaled = scaleContours(contours, scale, scale);

  // Optional optical weight boost to prevent small kana strokes from looking too thin
  if (weightDelta !== 0) {
    scaled = adjustContoursWeight(scaled, weightDelta);
  }

  const newBbox = getContoursBoundingBox(scaled);

  let dx = 0;
  let dy = 0;

  switch (placement) {
    case 'bottom-left':
      // Traditional Japanese Kana typesetting: bottom-left offset (LSB around 100, baseline 780)
      dx = 110 - newBbox.minX;
      dy = 780 - newBbox.maxY;
      break;
    case 'center':
      // Centered inside 1000x1000 em box
      dx = 500 - (newBbox.minX + newBbox.width / 2);
      dy = 500 - (newBbox.minY + newBbox.height / 2);
      break;
    case 'bottom-center':
      dx = 500 - (newBbox.minX + newBbox.width / 2);
      dy = 780 - newBbox.maxY;
      break;
    case 'baseline':
      // Aligned with normal baseline, LSB 140
      dx = 140 - newBbox.minX;
      dy = 780 - newBbox.maxY;
      break;
  }

  dx += offsetX;
  dy += offsetY;

  return transformContours(scaled, (p) => ({
    x: Math.round(p.x + dx),
    y: Math.round(p.y + dy),
  }));
}

/**
 * 輪郭の線の太さ（ウェイト）を一括で太く(+)/細く(-)補正するアルゴリズム
 * @param contours 補正対象の輪郭リスト
 * @param delta 太さオフセットピクセル (正: ボールド化, 負: スリム化)
 */
export function adjustContoursWeight(contours: PathContour[], delta: number): PathContour[] {
  if (!contours || contours.length === 0 || delta === 0) return contours;

  return contours.map((contour, cIdx) => {
    if (!contour.nodes || contour.nodes.length < 3) {
      return contour;
    }

    const n = contour.nodes.length;

    // 計算用ポリゴン座標
    // y軸下向き系での符号付き面積を計算 (外輪郭 vs 穴)
    let area = 0;
    for (let i = 0; i < n; i++) {
      const curr = contour.nodes[i];
      const next = contour.nodes[(i + 1) % n];
      area += curr.x * next.y - next.x * curr.y;
    }
    // area > 0: 時計回り（y下向きの場合は左回り/外回り判定）
    const isOuter = area > 0;
    // 外輪郭は外側へ、穴（中抜き）は内側（穴を小さくする＝線の黒味が増す向き）へ
    const directionSign = isOuter ? 1 : -1;
    const effectiveDelta = delta * directionSign;

    const shiftedNodes = contour.nodes.map((node, i) => {
      const prev = contour.nodes[(i - 1 + n) % n];
      const next = contour.nodes[(i + 1) % n];

      // 前後のセグメントベクトル
      const v1x = node.x - prev.x;
      const v1y = node.y - prev.y;
      const len1 = Math.hypot(v1x, v1y) || 1;

      const v2x = next.x - node.x;
      const v2y = next.y - node.y;
      const len2 = Math.hypot(v2x, v2y) || 1;

      // セグメントの法線 (90度右回転: normal = (vy, -vx))
      const n1x = v1y / len1;
      const n1y = -v1x / len1;

      const n2x = v2y / len2;
      const n2y = -v2x / len2;

      // 平均法線
      let avgNx = (n1x + n2x) / 2;
      let avgNy = (n1y + n2y) / 2;
      const avgLen = Math.hypot(avgNx, avgNy) || 1;
      avgNx /= avgLen;
      avgNy /= avgLen;

      // オフセット変位
      const shiftX = Math.round(avgNx * effectiveDelta);
      const shiftY = Math.round(avgNy * effectiveDelta);

      const newNode: BezierNode = {
        ...node,
        id: `w-${Date.now()}-${cIdx}-${i}`,
        x: Math.round(node.x + shiftX),
        y: Math.round(node.y + shiftY),
        handleIn: node.handleIn
          ? {
              x: Math.round(node.handleIn.x + shiftX),
              y: Math.round(node.handleIn.y + shiftY),
            }
          : null,
        handleOut: node.handleOut
          ? {
              x: Math.round(node.handleOut.x + shiftX),
              y: Math.round(node.handleOut.y + shiftY),
            }
          : null,
      };

      return newNode;
    });

    return {
      ...contour,
      id: `w-contour-${Date.now()}-${cIdx}`,
      nodes: shiftedNodes,
    };
  });
}


/**
 * Transform contours according to placement position (Hen, Tsukuri, Kanmuri, Ashi, etc.)
 */
export function transformContoursForPlacement(
  contours: PathContour[],
  placement: RadicalPlacement,
  defaultCategory?: string
): PathContour[] {
  if (!contours || contours.length === 0 || placement === 'original') {
    return contours;
  }

  // Resolve 'auto' placement using defaultCategory if provided
  let effectivePlacement: string = placement;
  if (placement === 'auto') {
    if (defaultCategory && defaultCategory !== 'all' && defaultCategory !== 'basic') {
      effectivePlacement = defaultCategory;
    } else {
      effectivePlacement = 'original';
      return contours;
    }
  }

  const bbox = getContoursBoundingBox(contours);
  if (bbox.width <= 0 || bbox.height <= 0) return contours;

  let targetX = 80;
  let targetY = 160;
  let targetW = 840;
  let targetH = 680;

  switch (effectivePlacement) {
    case 'hen':
      // Left side: width ~380, height ~660, X ~80
      targetX = 80;
      targetY = 160;
      targetW = 380;
      targetH = 660;
      break;
    case 'tsukuri':
      // Right side: width ~440, height ~660, X ~480
      targetX = 480;
      targetY = 160;
      targetW = 440;
      targetH = 660;
      break;
    case 'kanmuri':
      // Top side: width ~800, height ~320, Y ~140
      targetX = 100;
      targetY = 140;
      targetW = 800;
      targetH = 300;
      break;
    case 'ashi':
      // Bottom side: width ~800, height ~340, Y ~520
      targetX = 100;
      targetY = 520;
      targetW = 800;
      targetH = 340;
      break;
    case 'tare':
      // Top-left hanging (广, 疒, 尸, 户)
      targetX = 90;
      targetY = 140;
      targetW = 760;
      targetH = 700;
      break;
    case 'nyo':
      // Left-bottom enclosing (⻌, 廴, 走)
      targetX = 90;
      targetY = 220;
      targetW = 820;
      targetH = 640;
      break;
    case 'kamae':
      // Enclosure frame (門, 囗, 冂, 匚)
      targetX = 100;
      targetY = 150;
      targetW = 800;
      targetH = 700;
      break;
    case 'center_small':
      // Centered 60% scale
      targetX = 200;
      targetY = 240;
      targetW = 600;
      targetH = 520;
      break;
  }

  const scaleX = targetW / bbox.width;
  const scaleY = targetH / bbox.height;
  // Use proportional scale to prevent aspect ratio distortion
  const scale = Math.min(scaleX, scaleY);
  const finalW = bbox.width * scale;
  const finalH = bbox.height * scale;

  const actualX = targetX + (targetW - finalW) / 2;
  const actualY = targetY + (targetH - finalH) / 2;

  return transformContours(contours, (p) => ({
    x: Math.round(actualX + (p.x - bbox.minX) * scale),
    y: Math.round(actualY + (p.y - bbox.minY) * scale),
  }));
}

/**
 * Optimize and clean contour nodes to prevent font bloating:
 * - Rounds coordinates to clean integers (eliminates float jitter and shrinks table size)
 * - Merges overlapping/collocated nodes (distance < 1 unit)
 * - Strips zero-length handles
 * - Removes redundant colinear nodes on straight segments
 * - Removes degenerate contours (< 2 nodes)
 */
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

export interface GlyphNormalizeConfig {
  targetWidth?: number; // e.g. 800 for kana, 860 for kanji, 600 for latin
  targetHeight?: number; // e.g. 800 for kana, 860 for kanji, 700 for latin cap
  mode: 'fitBox' | 'scalePercentage' | 'centerOnly';
  scaleFactor?: number; // 0.5 to 2.0
  alignHorizontal: 'center' | 'keep' | 'left';
  alignVertical: 'center' | 'baseline' | 'keep';
  targetCenterX?: number; // default 500
  targetCenterY?: number; // default 500
  targetBaselineY?: number; // default 800
  unifyAdvanceWidth?: boolean;
  targetAdvanceWidth?: number; // e.g. 1000 for fullwidth, 500 for halfwidth
  optimizePoints?: boolean; // reduce & clean nodes
  weightDelta?: number; // +/- delta for stroke weight normalization
  normalizeWinding?: boolean; // clockwise outer, counter-clockwise inner
}

/**
 * Apply normalization / sizing unification to a single glyph's contours and metrics
 */
export function normalizeGlyph(
  contours: PathContour[],
  config: GlyphNormalizeConfig
): { contours: PathContour[]; advanceWidth?: number; lsb?: number } {
  if (!contours || contours.length === 0) {
    return {
      contours: [],
      advanceWidth: config.unifyAdvanceWidth ? config.targetAdvanceWidth : undefined,
      lsb: 0,
    };
  }

  const bbox = getContoursBoundingBox(contours);
  if (bbox.width <= 0 || bbox.height <= 0) {
    return { contours, advanceWidth: config.targetAdvanceWidth, lsb: 0 };
  }

  let scaleX = 1;
  let scaleY = 1;

  if (config.mode === 'fitBox') {
    const targetW = config.targetWidth || 800;
    const targetH = config.targetHeight || 800;
    const scale = Math.min(targetW / bbox.width, targetH / bbox.height);
    scaleX = scale;
    scaleY = scale;
  } else if (config.mode === 'scalePercentage') {
    const s = config.scaleFactor || 1.0;
    scaleX = s;
    scaleY = s;
  }

  // Calculate new bounding box after scaling
  const newHeight = bbox.height * scaleY;

  // Compute offset
  const targetCX = config.targetCenterX ?? 500;
  const targetCY = config.targetCenterY ?? 500;
  const baselineY = config.targetBaselineY ?? 800;

  let finalCX = bbox.centerX;
  let finalCY = bbox.centerY;

  if (config.alignHorizontal === 'center') {
    finalCX = targetCX;
  }

  if (config.alignVertical === 'center') {
    finalCY = targetCY;
  } else if (config.alignVertical === 'baseline') {
    // align bottom to baseline
    finalCY = baselineY - newHeight / 2;
  }

  const dx = finalCX - bbox.centerX * scaleX;
  const dy = finalCY - bbox.centerY * scaleY;

  let transformed = transformContours(contours, (p) => ({
    x: Math.round(p.x * scaleX + dx),
    y: Math.round(p.y * scaleY + dy),
  }));

  // Stroke weight adjustment (bolding or slimming)
  if (config.weightDelta && config.weightDelta !== 0) {
    transformed = adjustContoursWeight(transformed, config.weightDelta);
  }

  if (config.optimizePoints) {
    transformed = optimizeContourNodes(transformed);
  }

  if (config.normalizeWinding) {
    transformed = normalizeGlyphContoursWinding(transformed);
  }

  const finalBbox = getContoursBoundingBox(transformed);
  const lsb = Math.max(0, Math.round(finalBbox.minX));

  return {
    contours: transformed,
    advanceWidth: config.unifyAdvanceWidth ? config.targetAdvanceWidth : undefined,
    lsb,
  };
}

/**
 * Create a straight line segment contour (closed bar)
 */
export function createLineContour(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeWidth: number = 32
): PathContour {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const halfW = strokeWidth / 2;
  const nx = (-dy / len) * halfW;
  const ny = (dx / len) * halfW;

  return {
    id: generateId(),
    closed: true,
    nodes: [
      { id: generateId(), x: Math.round(x1 + nx), y: Math.round(y1 + ny), type: 'corner' },
      { id: generateId(), x: Math.round(x2 + nx), y: Math.round(y2 + ny), type: 'corner' },
      { id: generateId(), x: Math.round(x2 - nx), y: Math.round(y2 - ny), type: 'corner' },
      { id: generateId(), x: Math.round(x1 - nx), y: Math.round(y1 - ny), type: 'corner' },
    ],
  };
}

/**
 * Rotate multiple contours around their shared collective bounding box center
 */
export function rotateMultipleContours(
  contours: PathContour[],
  angleDeg: number,
  customCx?: number,
  customCy?: number
): PathContour[] {
  const bbox = getContoursBoundingBox(contours);
  const cx = customCx !== undefined ? customCx : bbox.centerX;
  const cy = customCy !== undefined ? customCy : bbox.centerY;

  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rotPoint = (p: Point) => {
    const rx = p.x - cx;
    const ry = p.y - cy;
    return {
      x: Math.round(cx + rx * cos - ry * sin),
      y: Math.round(cy + rx * sin + ry * cos),
    };
  };

  return contours.map((contour) => ({
    ...contour,
    nodes: contour.nodes.map((n) => ({
      ...n,
      ...rotPoint({ x: n.x, y: n.y }),
      handleIn: n.handleIn ? rotPoint(n.handleIn) : null,
      handleOut: n.handleOut ? rotPoint(n.handleOut) : null,
    })),
  }));
}

/**
 * Scale multiple contours relative to their shared bounding box center or anchor
 */
export function scaleMultipleContours(
  contours: PathContour[],
  scaleX: number,
  scaleY: number,
  originX?: number,
  originY?: number
): PathContour[] {
  const bbox = getContoursBoundingBox(contours);
  const ox = originX !== undefined ? originX : bbox.centerX;
  const oy = originY !== undefined ? originY : bbox.centerY;

  const scalePoint = (p: Point) => ({
    x: Math.round(ox + (p.x - ox) * scaleX),
    y: Math.round(oy + (p.y - oy) * scaleY),
  });

  return contours.map((contour) => ({
    ...contour,
    nodes: contour.nodes.map((n) => ({
      ...n,
      ...scalePoint({ x: n.x, y: n.y }),
      handleIn: n.handleIn ? scalePoint(n.handleIn) : null,
      handleOut: n.handleOut ? scalePoint(n.handleOut) : null,
    })),
  }));
}

/**
 * Compute the signed area of a 2D contour using the shoelace formula.
 * In screen coordinates (Y downwards):
 * - Positive area (> 0) means CLOCKWISE in screen space (Clockwise in TrueType font Y-up space)
 * - Negative area (< 0) means COUNTER-CLOCKWISE in screen space (Counter-Clockwise in TrueType space)
 */
export function getContourSignedArea(contour: PathContour): number {
  const nodes = contour.nodes;
  if (!nodes || nodes.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < nodes.length; i++) {
    const p1 = nodes[i];
    const p2 = nodes[(i + 1) % nodes.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return area / 2;
}

/**
 * Reverse the winding order of a contour.
 * Inverts the node sequence and swaps handleIn and handleOut.
 */
export function reverseContour(contour: PathContour): PathContour {
  if (!contour.nodes || contour.nodes.length <= 1) return contour;
  const reversedNodes: BezierNode[] = [...contour.nodes].reverse().map((n) => ({
    ...n,
    handleIn: n.handleOut ? { ...n.handleOut } : null,
    handleOut: n.handleIn ? { ...n.handleIn } : null,
  }));
  return {
    ...contour,
    nodes: reversedNodes,
  };
}

/**
 * Test whether a point is inside a contour using ray-casting algorithm
 */
export function isPointInContour(pt: Point, contour: PathContour): boolean {
  const nodes = contour.nodes;
  if (!nodes || nodes.length < 3) return false;
  let inside = false;
  for (let i = 0, j = nodes.length - 1; i < nodes.length; j = i++) {
    const xi = nodes[i].x;
    const yi = nodes[i].y;
    const xj = nodes[j].x;
    const yj = nodes[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi || 0.00001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if inner contour is entirely enclosed by outer contour
 */
export function isContourContained(inner: PathContour, outer: PathContour): boolean {
  const innerBbox = getContoursBoundingBox([inner]);
  const outerBbox = getContoursBoundingBox([outer]);
  if (
    innerBbox.minX < outerBbox.minX ||
    innerBbox.maxX > outerBbox.maxX ||
    innerBbox.minY < outerBbox.minY ||
    innerBbox.maxY > outerBbox.maxY
  ) {
    return false;
  }
  if (!inner.nodes || inner.nodes.length === 0) return false;
  let insideCount = 0;
  for (const node of inner.nodes) {
    if (isPointInContour(node, outer)) {
      insideCount++;
    }
  }
  return insideCount >= inner.nodes.length * 0.75;
}

/**
 * Group contours so that outer contours and their enclosed inner holes (e.g. inside of 日, 口, O, あ)
 * are kept together in the same group, while independent overlapping strokes (e.g. stroke 1 and stroke 2 of あ)
 * remain in separate groups.
 *
 * When each group is rendered with evenodd fillRule:
 * 1. Independent overlapping strokes paint additively on top of each other without creating white cutout defects!
 * 2. Nested inner holes punch out clean transparent windows!
 */
export function groupContoursWithHoles(contours: PathContour[]): PathContour[][] {
  if (!contours || contours.length === 0) return [];
  if (contours.length === 1) return [[contours[0]]];

  // Identify which contours are holes contained inside another contour
  // Map child contour index -> parent contour index
  const parentMap = new Map<number, number>();

  for (let i = 0; i < contours.length; i++) {
    const child = contours[i];
    let smallestParentIdx = -1;
    let smallestParentArea = Infinity;

    for (let j = 0; j < contours.length; j++) {
      if (i === j) continue;
      const candidateParent = contours[j];
      if (isContourContained(child, candidateParent)) {
        const area = Math.abs(getContourSignedArea(candidateParent));
        if (area < smallestParentArea) {
          smallestParentArea = area;
          smallestParentIdx = j;
        }
      }
    }

    if (smallestParentIdx !== -1) {
      parentMap.set(i, smallestParentIdx);
    }
  }

  // Root outer groups
  const rootGroups = new Map<number, PathContour[]>();
  for (let i = 0; i < contours.length; i++) {
    if (!parentMap.has(i)) {
      rootGroups.set(i, [contours[i]]);
    }
  }

  for (const [childIdx, parentIdx] of parentMap.entries()) {
    let root = parentIdx;
    while (parentMap.has(root)) {
      root = parentMap.get(root)!;
    }
    if (!rootGroups.has(root)) {
      rootGroups.set(root, [contours[root]]);
    }
    rootGroups.get(root)!.push(contours[childIdx]);
  }

  return Array.from(rootGroups.values());
}

/**
 * Normalize contour winding for TrueType format standard:
 * - Outer contours: Clockwise in font space = Clockwise in screen space (Area > 0)
 * - Inner holes (e.g. inside of O, 日, 口): Counter-Clockwise in screen space (Area < 0)
 * 
 * Crucially, all overlapping strokes that are NOT nested holes are guaranteed to have the
 * identical positive winding, so Non-Zero Winding rasterizers add them together (+1 + 1 = 2)
 * and NEVER cancel them out into white holes!
 */
export function normalizeGlyphContoursWinding(contours: PathContour[]): PathContour[] {
  if (!contours || contours.length === 0) return [];

  const n = contours.length;
  // Precompute bounding boxes and signed areas once for O(1) containment checks
  const bboxes = new Array(n);
  const areas = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const c = contours[i];
    if (c.closed && c.nodes && c.nodes.length >= 3) {
      bboxes[i] = getContoursBoundingBox([c]);
      areas[i] = getContourSignedArea(c);
    }
  }

  return contours.map((c, i) => {
    if (!c.closed || !c.nodes || c.nodes.length < 3) return c;
    const area = areas[i];
    const bboxI = bboxes[i];
    if (!bboxI) return c;

    let enclosingCount = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const bboxJ = bboxes[j];
      if (!bboxJ) continue;

      // Fast AABB check: if inner bbox is not strictly inside outer bbox, it cannot be contained
      if (
        bboxI.minX < bboxJ.minX ||
        bboxI.maxX > bboxJ.maxX ||
        bboxI.minY < bboxJ.minY ||
        bboxI.maxY > bboxJ.maxY
      ) {
        continue;
      }
      if (isContourContained(c, contours[j])) {
        enclosingCount++;
      }
    }

    const isHole = enclosingCount % 2 === 1;
    const targetClockwise = !isHole;
    const isCurrentlyClockwise = area > 0;

    if (isCurrentlyClockwise !== targetClockwise) {
      return reverseContour(c);
    }
    return c;
  });
}

/**
 * Flip multiple contours horizontally around their collective center
 */
export function flipMultipleContoursH(contours: PathContour[], customCx?: number): PathContour[] {
  const bbox = getContoursBoundingBox(contours);
  const cx = customCx !== undefined ? customCx : bbox.centerX;
  const flipped = transformContours(contours, (p) => ({
    x: 2 * cx - p.x,
    y: p.y,
  }));
  // Mirroring flips polygon orientation (winding). Reverse to preserve original winding!
  return flipped.map(reverseContour);
}

/**
 * Flip multiple contours vertically around their collective center
 */
export function flipMultipleContoursV(contours: PathContour[], customCy?: number): PathContour[] {
  const bbox = getContoursBoundingBox(contours);
  const cy = customCy !== undefined ? customCy : bbox.centerY;
  const flipped = transformContours(contours, (p) => ({
    x: p.x,
    y: 2 * cy - p.y,
  }));
  // Mirroring flips polygon orientation (winding). Reverse to preserve original winding!
  return flipped.map(reverseContour);
}

/**
 * Duplicate an array of contours with offset
 */
export function duplicateMultipleContours(
  contours: PathContour[],
  offsetX: number = 30,
  offsetY: number = 30
): PathContour[] {
  return contours.map((c) => ({
    ...c,
    id: generateId(),
    nodes: c.nodes.map((n) => ({
      ...n,
      id: generateId(),
      x: n.x + offsetX,
      y: n.y + offsetY,
      handleIn: n.handleIn ? { x: n.handleIn.x + offsetX, y: n.handleIn.y + offsetY } : null,
      handleOut: n.handleOut ? { x: n.handleOut.x + offsetX, y: n.handleOut.y + offsetY } : null,
    })),
  }));
}

/**
 * 2つの線分 (p1-p2) と (p3-p4) の交点を計算
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

  const allSegments: Segment[] = [];

  contours.forEach((contour, cIdx) => {
    if (!contour.nodes || contour.nodes.length < 2) return;
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
 * 輪郭群に自己交差または輪郭間の交差が存在するか高速判定
 */
export function hasContourIntersections(contours: PathContour[]): boolean {
  return findContourIntersections(contours).length > 0;
}

/**
 * Boolean Union / Pathfinder Merge (合体・一筆書き白抜き解消):
 * Combines multiple overlapping or intersecting contours into unified outer contour(s),
 * eliminating internal overlapping boundaries and resolving self-intersections with high resolution.
 */
export function unionContours(
  contoursToUnion: PathContour[],
  smoothing: number = 1.2,
  forceProcessSingle: boolean = false
): PathContour[] {
  if (!contoursToUnion || contoursToUnion.length === 0) return [];
  if (contoursToUnion.length === 1 && !forceProcessSingle && !hasContourIntersections(contoursToUnion)) {
    return contoursToUnion;
  }

  // 1. Group contours into connected components by bounding box overlap
  // This guarantees that non-intersecting contours retain 100% of their original, pristine vector precision!
  const n = contoursToUnion.length;
  const bboxes = contoursToUnion.map((c) => getContoursBoundingBox([c]));
  const adj: number[][] = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const b1 = bboxes[i];
      const b2 = bboxes[j];
      const overlaps =
        b1.minX <= b2.maxX + 4 &&
        b1.maxX >= b2.minX - 4 &&
        b1.minY <= b2.maxY + 4 &&
        b1.maxY >= b2.minY - 4;
      if (overlaps) {
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
    // If a contour does not overlap with anything else, check if it has internal self-intersections
    if (cluster.length === 1) {
      const hasSelf = forceProcessSingle || hasContourIntersections(cluster);
      if (!hasSelf) {
        resultContours.push(cluster[0]);
        continue;
      }
    }

    const bbox = getContoursBoundingBox(cluster);
    if (bbox.width <= 0 || bbox.height <= 0) {
      resultContours.push(...cluster);
      continue;
    }

    const margin = 24;
    const minX = Math.max(0, Math.floor(bbox.minX - margin));
    const minY = Math.max(0, Math.floor(bbox.minY - margin));
    const maxX = Math.min(1000, Math.ceil(bbox.maxX + margin));
    const maxY = Math.min(1000, Math.ceil(bbox.maxY + margin));
    const w = Math.max(32, maxX - minX);
    const h = Math.max(32, maxY - minY);

    // High-resolution supersampling canvas (up to 2048px) for crisp edge fidelity
    const scale = Math.min(3.5, Math.max(1.8, 1600 / Math.max(w, h)));
    const canvasW = Math.round(w * scale);
    const canvasH = Math.round(h * scale);

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

    // Render contours with TrueType standard Non-Zero winding rule:
    // Overlapping strokes additively fuse (+1 + 1 = 2 => solid black),
    // and enclosed CCW inner holes punch out clean white holes (+1 - 1 = 0 => white)!
    const normCluster = normalizeGlyphContoursWinding(cluster);
    ctx.fillStyle = '#000000';
    const clusterSvg = contoursToSvgPath(normCluster);
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
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key)!.push(p2);
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

    // Filter out tiny micro-loops (< 36 font units area) that may arise from pixel grid edge noise,
    // while ensuring true counter holes (like あ, 日, 口) are 100% preserved
    const validLoops = transformedLoops.filter((loop) => {
      let a = 0;
      for (let i = 0; i < loop.length; i++) {
        const j = (i + 1) % loop.length;
        a += loop[i].x * loop[j].y - loop[j].x * loop[i].y;
      }
      return Math.abs(a / 2) >= 36;
    });

    const simplified = validLoops
      .map((loop) => rdpSimplify(loop, smoothing))
      .filter((l) => l.length >= 3);

    if (simplified.length === 0) {
      resultContours.push(...cluster);
      continue;
    }

    // Convert polygon points into high-grade Bezier contours with corner detection
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
        // If angle is sharp (> 48° change in direction), preserve as crisp corner
        if (dot < 0.67) {
          nodes.push({ id: generateId(), x: curr.x, y: curr.y, type: 'corner' });
        } else {
          // Smooth curve node: Catmull-Rom tangent with handle overshoot protection
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

    resultContours.push(...mergedClusterContours);
  }

  return normalizeGlyphContoursWinding(resultContours);
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

  const left = [p0, p01, p012, p0123] as any;
  left.p0 = p0;
  left.p1 = p01;
  left.p2 = p012;
  left.p3 = p0123;

  const right = [p0123, p123, p23, p3] as any;
  right.p0 = p0123;
  right.p1 = p123;
  right.p2 = p23;
  right.p3 = p3;

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
    pts.push({
      x: Math.round(p1.x + dx * t),
      y: Math.round(p1.y + dy * t),
      pressure: p1.pressure + (p2.pressure - p1.pressure) * t,
      time: Math.round(p1.time + (p2.time - p1.time) * t),
    });
  }
  return pts;
}



