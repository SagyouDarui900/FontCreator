import { BezierNode, PathContour, Point } from '../types';
import { generateId, getContoursBoundingBox, transformContours } from './pathUtils';

export interface VectorizeOptions {
  threshold?: number; // 0 to 255 (default: 128)
  smoothing?: number; // RDP epsilon (default: 2.5)
  contrast?: number; // 0.5 to 2.5 (default: 1.1)
  brightness?: number; // -100 to 100 (default: 0)
  invert?: boolean; // invert binary mask (default: false)
  minArea?: number; // minimum contour point count to filter noise (default: 8)
  fitMargin?: number; // margin inside 1000x1000 EM box (default: 80)
}

export interface VectorizeResult {
  contours: PathContour[];
  svgString: string;
  width: number;
  height: number;
}

/**
 * High-performance browser-side vectorizer:
 * Converts raster image (sketches, handwriting, photo lettering) into smooth Cubic Bezier PathContour[]
 */
export async function vectorizeImage(
  imageSource: string | HTMLImageElement | HTMLCanvasElement,
  options: VectorizeOptions = {}
): Promise<VectorizeResult> {
  const opts = {
    threshold: 128,
    contrast: 1.1,
    brightness: 0,
    invert: false,
    smoothing: 2.5,
    minArea: 8,
    fitMargin: 80,
    ...options,
  };

  let canvasW: number;
  let canvasH: number;
  let ctx: CanvasRenderingContext2D;

  if (typeof imageSource === 'object' && imageSource !== null && 'getContext' in imageSource) {
    const srcCanvas = imageSource as HTMLCanvasElement;
    canvasW = srcCanvas.width;
    canvasH = srcCanvas.height;
    const maxDim = 600;
    if (canvasW > maxDim || canvasH > maxDim) {
      const scale = Math.min(maxDim / canvasW, maxDim / canvasH);
      canvasW = Math.round(canvasW * scale);
      canvasH = Math.round(canvasH * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const c = canvas.getContext('2d', { willReadFrequently: true });
    if (!c) throw new Error('Canvas 2D context creation failed');
    c.drawImage(srcCanvas, 0, 0, canvasW, canvasH);
    ctx = c;
  } else {
    // 1. Load image if string provided
    let img: HTMLImageElement;
    if (typeof imageSource === 'string') {
      img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
        img.src = imageSource;
      });
    } else {
      img = imageSource as HTMLImageElement;
    }

    // Limit processing resolution for fast interactive tracing (max 500px)
    const maxDim = 500;
    canvasW = img.naturalWidth || img.width || 400;
    canvasH = img.naturalHeight || img.height || 400;
    if (canvasW > maxDim || canvasH > maxDim) {
      const scale = Math.min(maxDim / canvasW, maxDim / canvasH);
      canvasW = Math.round(canvasW * scale);
      canvasH = Math.round(canvasH * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const c = canvas.getContext('2d', { willReadFrequently: true });
    if (!c) {
      throw new Error('Canvas 2D context creation failed');
    }
    c.drawImage(img, 0, 0, canvasW, canvasH);
    ctx = c;
  }
  const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
  const data = imgData.data;

  // 2. Preprocess & Binary Thresholding (Grayscale + Contrast + Threshold)
  const binary = new Uint8Array(canvasW * canvasH);
  const contrastFactor = opts.contrast;
  const threshold = opts.threshold;
  const invert = opts.invert;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const a = data[i + 3];

    // Transparent pixel is treated as background (white)
    if (a < 64) {
      binary[i / 4] = invert ? 1 : 0;
      continue;
    }

    // Apply brightness & contrast
    if (opts.brightness !== 0) {
      r = Math.min(255, Math.max(0, r + opts.brightness));
      g = Math.min(255, Math.max(0, g + opts.brightness));
      b = Math.min(255, Math.max(0, b + opts.brightness));
    }

    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    gray = (gray - 128) * contrastFactor + 128;
    gray = Math.min(255, Math.max(0, gray));

    // Foreground letter is typically darker (ink on paper)
    const isDark = gray < threshold;
    binary[i / 4] = invert ? (isDark ? 0 : 1) : isDark ? 1 : 0;
  }

  // 3. Marching Squares / Boundary Edge Walk
  const edgeMap = new Map<string, Point[]>();
  const visitedEdges = new Set<string>();

  const addEdge = (p1: Point, p2: Point) => {
    const key = `${p1.x},${p1.y}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, []);
    }
    edgeMap.get(key)!.push(p2);
  };

  const getPixel = (px: number, py: number): number => {
    if (px < 0 || px >= canvasW || py < 0 || py >= canvasH) return 0;
    return binary[py * canvasW + px];
  };

  // Find all horizontal and vertical boundaries between 1 and 0 pixels
  for (let y = 0; y <= canvasH; y++) {
    for (let x = 0; x <= canvasW; x++) {
      // Horizontal edge between (x, y-1) and (x, y)
      const top = getPixel(x, y - 1);
      const bottom = getPixel(x, y);

      if (top !== bottom) {
        if (top === 0 && bottom === 1) {
          // Left to right edge
          addEdge({ x, y }, { x: x + 1, y });
        } else {
          // Right to left edge
          addEdge({ x: x + 1, y }, { x, y });
        }
      }

      // Vertical edge between (x-1, y) and (x, y)
      const left = getPixel(x - 1, y);
      const right = getPixel(x, y);

      if (left !== right) {
        if (left === 1 && right === 0) {
          // Top to bottom edge
          addEdge({ x, y }, { x, y: y + 1 });
        } else {
          // Bottom to top edge
          addEdge({ x, y: y + 1 }, { x, y });
        }
      }
    }
  }

  // 4. Trace closed loops from edges
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

        // Check if loop closed
        if (curr.x === startPt.x && curr.y === startPt.y) {
          break;
        }
      }

      if (loop.length >= opts.minArea) {
        loops.push(loop);
      }
    }
  }

  // 5. Simplify loops with Ramer-Douglas-Peucker (RDP) algorithm
  const simplifiedLoops = loops
    .map((loop) => rdpSimplify(loop, opts.smoothing))
    .filter((loop) => loop.length >= 3);

  // 6. Convert simplified polygons to smooth cubic Bezier nodes
  const rawContours: PathContour[] = simplifiedLoops.map((pts) => {
    const nodes = pointsToBezierContourNodes(pts);
    return {
      id: generateId(),
      closed: true,
      nodes,
    };
  });

  // 7. Normalize & Fit to 1000x1000 EM Box coordinate system
  if (rawContours.length === 0) {
    return {
      contours: [],
      svgString: '<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg"></svg>',
      width: canvasW,
      height: canvasH,
    };
  }

  const bbox = getContoursBoundingBox(rawContours);
  const targetSize = 1000 - opts.fitMargin * 2;
  const scale = Math.min(targetSize / (bbox.width || 1), targetSize / (bbox.height || 1));

  const targetX = opts.fitMargin + (targetSize - bbox.width * scale) / 2;
  const targetY = opts.fitMargin + (targetSize - bbox.height * scale) / 2;

  const fittedContours = transformContours(rawContours, (p) => ({
    x: Math.round(targetX + (p.x - bbox.minX) * scale),
    y: Math.round(targetY + (p.y - bbox.minY) * scale),
  }));

  // Generate SVG string
  const svgPathData = fittedContours
    .map((c) => {
      if (c.nodes.length === 0) return '';
      let d = `M ${c.nodes[0].x} ${c.nodes[0].y}`;
      for (let i = 0; i < c.nodes.length; i++) {
        const curr = c.nodes[i];
        const next = c.nodes[(i + 1) % c.nodes.length];
        const cp1 = curr.handleOut || { x: curr.x, y: curr.y };
        const cp2 = next.handleIn || { x: next.x, y: next.y };
        d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${next.x} ${next.y}`;
      }
      d += ' Z';
      return d;
    })
    .join(' ');

  const svgString = `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">\n  <path d="${svgPathData}" fill="#000000" fill-rule="evenodd" />\n</svg>`;

  return {
    contours: fittedContours,
    svgString,
    width: canvasW,
    height: canvasH,
  };
}

/**
 * Ramer-Douglas-Peucker line simplification algorithm
 */
export function rdpSimplify(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, index + 1), epsilon);
    const right = rdpSimplify(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [first, last];
  }
}

export function perpendicularDistance(p: Point, p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - p1.x, p.y - p1.y);
  return Math.abs(dy * p.x - dx * p.y + p2.x * p1.y - p2.y * p1.x) / len;
}

/**
 * Convert polygon points into smooth cubic Bezier nodes with Catmull-Rom style handles,
 * while accurately preserving sharp corners (strokes, serifs, turns) and flat edges.
 */
export function pointsToBezierContourNodes(points: Point[]): BezierNode[] {
  const n = points.length;
  if (n === 0) return [];

  const nodes: BezierNode[] = [];
  const tension = 0.30; // smoothness factor for genuine curves

  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];

    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const len1 = Math.hypot(v1x, v1y);

    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len2 = Math.hypot(v2x, v2y);

    if (len1 === 0 || len2 === 0) {
      nodes.push({ id: generateId(), x: curr.x, y: curr.y, type: 'corner' });
      continue;
    }

    // Angle of deflection between incoming and outgoing segment
    const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
    const clampedDot = Math.max(-1, Math.min(1, dot));
    const turnAngleRad = Math.acos(clampedDot); // 0 = straight line, PI = 180° hairpin turn

    // If turn angle is sharp (e.g. > 30 degrees / 0.52 rad) or near straight (< 0.06 rad),
    // keep it as a crisp corner node with no protruding handles
    if (turnAngleRad > 0.52 || turnAngleRad < 0.06) {
      nodes.push({
        id: generateId(),
        x: curr.x,
        y: curr.y,
        type: 'corner',
        handleIn: null,
        handleOut: null,
      });
      continue;
    }

    // For smooth gentle curves, compute tangent bounded strictly by adjacent edge lengths
    const maxHandleLen = Math.min(len1, len2) * tension;
    const tangentX = next.x - prev.x;
    const tangentY = next.y - prev.y;
    const tangentLen = Math.hypot(tangentX, tangentY) || 1;
    const normTanX = tangentX / tangentLen;
    const normTanY = tangentY / tangentLen;

    nodes.push({
      id: generateId(),
      x: curr.x,
      y: curr.y,
      type: 'smooth',
      handleIn: {
        x: Math.round(curr.x - normTanX * maxHandleLen),
        y: Math.round(curr.y - normTanY * maxHandleLen),
      },
      handleOut: {
        x: Math.round(curr.x + normTanX * maxHandleLen),
        y: Math.round(curr.y + normTanY * maxHandleLen),
      },
    });
  }

  return nodes;
}
