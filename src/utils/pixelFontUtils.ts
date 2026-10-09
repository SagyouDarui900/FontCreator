import { GlyphData, PathContour, Point, BezierNode, PixelDotShape } from '../types';

/**
 * Resample pixel grid from source dimensions (srcW, srcH) to destination dimensions (dstW, dstH)
 * using nearest-neighbor interpolation.
 */
export function resamplePixelGrid(
  sourceGrid: Uint8Array | number[],
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8Array {
  const result = new Uint8Array(dstW * dstH);
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0 || !sourceGrid || sourceGrid.length === 0) {
    return result;
  }

  for (let dy = 0; dy < dstH; dy++) {
    const sy = Math.min(srcH - 1, Math.floor((dy / dstH) * srcH));
    for (let dx = 0; dx < dstW; dx++) {
      const sx = Math.min(srcW - 1, Math.floor((dx / dstW) * srcW));
      const srcIdx = sy * srcW + sx;
      if (srcIdx < sourceGrid.length) {
        result[dy * dstW + dx] = sourceGrid[srcIdx] ? 1 : 0;
      }
    }
  }
  return result;
}

/**
 * Bresenham Line Drawing Algorithm
 */
export function getBresenhamLine(x0: number, y0: number, x1: number, y1: number): Point[] {
  const points: Point[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let cx = x0;
  let cy = y0;

  while (true) {
    points.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
  return points;
}

/**
 * Midpoint Circle Drawing Algorithm
 */
export function getMidpointCircle(
  cx: number,
  cy: number,
  radius: number,
  filled: boolean = false
): Point[] {
  const points: Point[] = [];
  const visited = new Set<string>();

  const addPt = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (!visited.has(key)) {
      visited.add(key);
      points.push({ x, y });
    }
  };

  if (radius <= 0) {
    addPt(cx, cy);
    return points;
  }

  let x = radius;
  let y = 0;
  let p = 1 - radius;

  const plotSymmetric = (x: number, y: number) => {
    if (filled) {
      for (let ix = cx - x; ix <= cx + x; ix++) {
        addPt(ix, cy + y);
        addPt(ix, cy - y);
      }
      for (let ix = cx - y; ix <= cx + y; ix++) {
        addPt(ix, cy + x);
        addPt(ix, cy - x);
      }
    } else {
      addPt(cx + x, cy + y);
      addPt(cx - x, cy + y);
      addPt(cx + x, cy - y);
      addPt(cx - x, cy - y);
      addPt(cx + y, cy + x);
      addPt(cx - y, cy + x);
      addPt(cx + y, cy - x);
      addPt(cx - y, cy - x);
    }
  };

  plotSymmetric(x, y);

  while (x > y) {
    y++;
    if (p <= 0) {
      p += 2 * y + 1;
    } else {
      x--;
      p += 2 * (y - x) + 1;
    }
    if (x < y) break;
    plotSymmetric(x, y);
  }

  return points;
}

/**
 * Flood fill algorithm for bucket tool
 */
export function floodFill(
  grid: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  targetVal: number,
  fillVal: number
): void {
  if (targetVal === fillVal) return;
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

  const startIndex = startY * width + startX;
  if (grid[startIndex] !== targetVal) return;

  const queue: [number, number][] = [[startX, startY]];
  grid[startIndex] = fillVal;

  while (queue.length > 0) {
    const [cx, cy] = queue.pop()!;
    const neighbors: [number, number][] = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIndex = ny * width + nx;
        if (grid[nIndex] === targetVal) {
          grid[nIndex] = fillVal;
          queue.push([nx, ny]);
        }
      }
    }
  }
}

/**
 * Convert 2D Pixel Grid into Vector Path Contours
 * Uses contour loop marching / segment chaining to merge adjacent pixels into optimal polygons.
 */
export function pixelGridToContours(
  grid: Uint8Array,
  width: number,
  height: number,
  unitsPerEm: number = 1000,
  ascender: number = 800,
  descender: number = -200,
  advanceWidth: number = 1000,
  shape: PixelDotShape = 'square',
  mergeOptimized: boolean = true,
  marginPercent: number = 0.08
): PathContour[] {
  const contours: PathContour[] = [];

  const effectiveEm = ascender - descender;
  const marginY = effectiveEm * marginPercent;
  const marginX = advanceWidth * marginPercent;

  const usableWidth = advanceWidth - 2 * marginX;
  const usableHeight = effectiveEm - 2 * marginY;

  const cellW = usableWidth / width;
  const cellH = usableHeight / height;

  const originX = marginX;
  const topY = ascender - marginY;

  const getCellBounds = (gx: number, gy: number) => {
    const x0 = originX + gx * cellW;
    const x1 = x0 + cellW;
    const y1 = topY - gy * cellH;
    const y0 = y1 - cellH;
    return { x0, x1, y0, y1 };
  };

  // If shape is round/squircle/diamond or merge is disabled, generate individual dot contours
  if (shape !== 'square' || !mergeOptimized) {
    let dotId = 0;
    for (let gy = 0; gy < height; gy++) {
      for (let gx = 0; gx < width; gx++) {
        if (grid[gy * width + gx] === 1) {
          const { x0, x1, y0, y1 } = getCellBounds(gx, gy);
          const cx = (x0 + x1) / 2;
          const cy = (y0 + y1) / 2;
          const r = Math.min(cellW, cellH) / 2;

          if (shape === 'round') {
            const kappa = 0.5522847498;
            const ox = r * kappa;
            const oy = r * kappa;
            contours.push({
              id: `dot_${dotId++}`,
              closed: true,
              nodes: [
                { id: `d_${dotId}_0`, x: cx, y: cy + r, type: 'smooth', handleOut: { x: cx + ox, y: cy + r }, handleIn: { x: cx - ox, y: cy + r } },
                { id: `d_${dotId}_1`, x: cx + r, y: cy, type: 'smooth', handleOut: { x: cx + r, y: cy - oy }, handleIn: { x: cx + r, y: cy + oy } },
                { id: `d_${dotId}_2`, x: cx, y: cy - r, type: 'smooth', handleOut: { x: cx - ox, y: cy - r }, handleIn: { x: cx + ox, y: cy - r } },
                { id: `d_${dotId}_3`, x: cx - r, y: cy, type: 'smooth', handleOut: { x: cx - r, y: cy + oy }, handleIn: { x: cx - r, y: cy - oy } },
              ],
            });
          } else if (shape === 'diamond') {
            contours.push({
              id: `dot_${dotId++}`,
              closed: true,
              nodes: [
                { id: `d_${dotId}_0`, x: cx, y: y1, type: 'corner' },
                { id: `d_${dotId}_1`, x: x1, y: cy, type: 'corner' },
                { id: `d_${dotId}_2`, x: cx, y: y0, type: 'corner' },
                { id: `d_${dotId}_3`, x: x0, y: cy, type: 'corner' },
              ],
            });
          } else {
            // Square (individual)
            contours.push({
              id: `dot_${dotId++}`,
              closed: true,
              nodes: [
                { id: `d_${dotId}_0`, x: Math.round(x0), y: Math.round(y1), type: 'corner' },
                { id: `d_${dotId}_1`, x: Math.round(x1), y: Math.round(y1), type: 'corner' },
                { id: `d_${dotId}_2`, x: Math.round(x1), y: Math.round(y0), type: 'corner' },
                { id: `d_${dotId}_3`, x: Math.round(x0), y: Math.round(y0), type: 'corner' },
              ],
            });
          }
        }
      }
    }
    return contours;
  }

  // Merged Square Contours using Edge Marching / Tracing
  interface Edge {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }
  const edges: Edge[] = [];

  const getPixel = (gx: number, gy: number) => {
    if (gx < 0 || gx >= width || gy < 0 || gy >= height) return 0;
    return grid[gy * width + gx] ? 1 : 0;
  };

  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      if (getPixel(gx, gy) === 1) {
        const { x0, x1, y0, y1 } = getCellBounds(gx, gy);

        // Top edge
        if (getPixel(gx, gy - 1) === 0) {
          edges.push({ x0, y0: y1, x1, y1: y1 });
        }
        // Right edge
        if (getPixel(gx + 1, gy) === 0) {
          edges.push({ x0: x1, y0: y1, x1, y1: y0 });
        }
        // Bottom edge
        if (getPixel(gx, gy + 1) === 0) {
          edges.push({ x0: x1, y0, x1: x0, y1: y0 });
        }
        // Left edge
        if (getPixel(gx - 1, gy) === 0) {
          edges.push({ x0, y0, x1: x0, y1: y1 });
        }
      }
    }
  }

  if (edges.length === 0) return [];

  // Chain directed edges into closed polygon loops
  const edgeMap = new Map<string, Edge[]>();
  const pointKey = (x: number, y: number) => `${Math.round(x * 10)},${Math.round(y * 10)}`;

  for (const e of edges) {
    const k = pointKey(e.x0, e.y0);
    if (!edgeMap.has(k)) edgeMap.set(k, []);
    edgeMap.get(k)!.push(e);
  }

  const used = new Set<Edge>();
  let contourId = 0;

  for (const startEdge of edges) {
    if (used.has(startEdge)) continue;

    const rawPoints: Point[] = [{ x: startEdge.x0, y: startEdge.y0 }];
    used.add(startEdge);
    let curr = startEdge;

    while (true) {
      rawPoints.push({ x: curr.x1, y: curr.y1 });
      const nextKey = pointKey(curr.x1, curr.y1);
      const candidates = edgeMap.get(nextKey) || [];
      const nextEdge = candidates.find((cand) => !used.has(cand));

      if (nextEdge) {
        used.add(nextEdge);
        curr = nextEdge;
      } else {
        break;
      }
    }

    if (rawPoints.length >= 3) {
      // Remove collinear adjacent points
      const simplified: Point[] = [];
      const numPts = rawPoints.length;

      for (let j = 0; j < numPts; j++) {
        const prev = rawPoints[(j - 1 + numPts) % numPts];
        const curr = rawPoints[j];
        const next = rawPoints[(j + 1) % numPts];

        const isHorizontal = Math.abs(prev.y - curr.y) < 0.01 && Math.abs(curr.y - next.y) < 0.01;
        const isVertical = Math.abs(prev.x - curr.x) < 0.01 && Math.abs(curr.x - next.x) < 0.01;

        if (!isHorizontal && !isVertical) {
          simplified.push({ x: Math.round(curr.x), y: Math.round(curr.y) });
        }
      }

      if (simplified.length >= 3) {
        const nodes: BezierNode[] = simplified.map((p, idx) => ({
          id: `node_px_${contourId}_${idx}`,
          x: p.x,
          y: p.y,
          type: 'corner',
        }));
        contours.push({
          id: `contour_px_${contourId++}`,
          nodes,
          closed: true,
        });
      }
    }
  }

  return contours;
}

/**
 * Rasterize Vector Contours onto a Binary Grid
 */
export function rasterizeGlyphToPixelGrid(
  glyph: GlyphData,
  width: number,
  height: number,
  unitsPerEm: number = 1000,
  ascender: number = 800,
  descender: number = -200,
  marginPercent: number = 0.08
): Uint8Array {
  const grid = new Uint8Array(width * height);
  if (!glyph.contours || glyph.contours.length === 0) return grid;

  if (typeof document === 'undefined') return grid;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return grid;

  const effectiveEm = ascender - descender;
  const marginY = effectiveEm * marginPercent;
  const marginX = (glyph.advanceWidth || 1000) * marginPercent;

  const usableWidth = (glyph.advanceWidth || 1000) - 2 * marginX;
  const usableHeight = effectiveEm - 2 * marginY;

  const scaleX = width / usableWidth;
  const scaleY = height / usableHeight;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#000000';
  ctx.beginPath();

  for (const contour of glyph.contours) {
    if (!contour.nodes || contour.nodes.length === 0) continue;
    for (let i = 0; i < contour.nodes.length; i++) {
      const node = contour.nodes[i];
      const px = (node.x - marginX) * scaleX;
      const py = (ascender - marginY - node.y) * scaleY;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        const prev = contour.nodes[i - 1];
        if (prev.handleOut && node.handleIn) {
          const cp1x = (prev.handleOut.x - marginX) * scaleX;
          const cp1y = (ascender - marginY - prev.handleOut.y) * scaleY;
          const cp2x = (node.handleIn.x - marginX) * scaleX;
          const cp2y = (ascender - marginY - node.handleIn.y) * scaleY;
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
    }
    ctx.closePath();
  }

  ctx.fill('evenodd');

  const imgData = ctx.getImageData(0, 0, width, height).data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const brightness = imgData[idx]; // 0 is black (filled), 255 is white
      if (brightness < 128) {
        grid[y * width + x] = 1;
      }
    }
  }

  return grid;
}
