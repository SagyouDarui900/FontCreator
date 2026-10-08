import { BezierNode, PathContour, Point } from '../types';
import { generateId, getContoursBoundingBox, transformContours } from './pathUtils';

export interface SvgParseResult {
  contours: PathContour[];
  width: number;
  height: number;
  rawPathCount: number;
}

/**
 * Parses SVG XML string and extracts all vector paths, polygons, rectangles, circles
 * and converts them into the app's internal PathContour[] cubic Bezier format.
 */
export function parseSvgStringToContours(
  svgString: string,
  fitTo1000Em: boolean = true
): SvgParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('SVGファイルの解析に失敗しました: XML構文エラー');
  }

  const svgEl = doc.querySelector('svg');
  let viewBoxW = 1000;
  let viewBoxH = 1000;

  if (svgEl) {
    const viewBoxAttr = svgEl.getAttribute('viewBox');
    if (viewBoxAttr) {
      const parts = viewBoxAttr.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        viewBoxW = parts[2];
        viewBoxH = parts[3];
      }
    } else {
      const w = parseFloat(svgEl.getAttribute('width') || '1000');
      const h = parseFloat(svgEl.getAttribute('height') || '1000');
      if (!isNaN(w) && w > 0) viewBoxW = w;
      if (!isNaN(h) && h > 0) viewBoxH = h;
    }
  }

  const contours: PathContour[] = [];

  // 1. Process <path> elements
  const pathElements = doc.querySelectorAll('path');
  pathElements.forEach((path) => {
    const d = path.getAttribute('d');
    if (d) {
      const parsed = parseSvgPathData(d);
      contours.push(...parsed);
    }
  });

  // 2. Process <rect> elements
  const rectElements = doc.querySelectorAll('rect');
  rectElements.forEach((rect) => {
    const x = parseFloat(rect.getAttribute('x') || '0');
    const y = parseFloat(rect.getAttribute('y') || '0');
    const width = parseFloat(rect.getAttribute('width') || '0');
    const height = parseFloat(rect.getAttribute('height') || '0');
    if (width > 0 && height > 0) {
      contours.push(createRectContourDirect(x, y, width, height));
    }
  });

  // 3. Process <circle> and <ellipse> elements
  const circleElements = doc.querySelectorAll('circle');
  circleElements.forEach((c) => {
    const cx = parseFloat(c.getAttribute('cx') || '0');
    const cy = parseFloat(c.getAttribute('cy') || '0');
    const r = parseFloat(c.getAttribute('r') || '0');
    if (r > 0) {
      contours.push(createEllipseContourDirect(cx, cy, r, r));
    }
  });

  const ellipseElements = doc.querySelectorAll('ellipse');
  ellipseElements.forEach((el) => {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const rx = parseFloat(el.getAttribute('rx') || '0');
    const ry = parseFloat(el.getAttribute('ry') || '0');
    if (rx > 0 && ry > 0) {
      contours.push(createEllipseContourDirect(cx, cy, rx, ry));
    }
  });

  // 4. Process <polygon> and <polyline> elements
  const polyElements = doc.querySelectorAll('polygon, polyline');
  polyElements.forEach((poly) => {
    const pointsAttr = poly.getAttribute('points');
    if (pointsAttr) {
      const nums = pointsAttr.trim().split(/[\s,]+/).map(Number);
      const isClosed = poly.tagName.toLowerCase() === 'polygon';
      const nodes: BezierNode[] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        nodes.push({
          id: generateId(),
          x: nums[i],
          y: nums[i + 1],
          type: 'corner',
        });
      }
      if (nodes.length > 1) {
        contours.push({
          id: generateId(),
          closed: isClosed,
          nodes,
        });
      }
    }
  });

  if (contours.length === 0) {
    return {
      contours: [],
      width: viewBoxW,
      height: viewBoxH,
      rawPathCount: 0,
    };
  }

  // 5. Fit contours into standard 1000x1000 coordinate system if requested
  let finalContours = contours;
  if (fitTo1000Em) {
    const bbox = getContoursBoundingBox(contours);
    if (bbox.width > 0 && bbox.height > 0) {
      const margin = 80;
      const targetSize = 1000 - margin * 2;
      const scale = Math.min(targetSize / bbox.width, targetSize / bbox.height);
      const targetX = margin + (targetSize - bbox.width * scale) / 2;
      const targetY = margin + (targetSize - bbox.height * scale) / 2;

      finalContours = transformContours(contours, (p) => ({
        x: Math.round(targetX + (p.x - bbox.minX) * scale),
        y: Math.round(targetY + (p.y - bbox.minY) * scale),
      }));
    }
  }

  return {
    contours: finalContours,
    width: viewBoxW,
    height: viewBoxH,
    rawPathCount: contours.length,
  };
}

/**
 * Parses standard SVG `d` attribute into PathContour[]
 * Supports M, m, L, l, H, h, V, v, C, c, S, s, Q, q, T, t, A, a, Z, z
 */
export function parseSvgPathData(d: string): PathContour[] {
  const contours: PathContour[] = [];
  const commandRegex = /([a-df-z])([^a-df-z]*)/gi;
  let match: RegExpExecArray | null;

  let currentPos: Point = { x: 0, y: 0 };
  let startPos: Point = { x: 0, y: 0 };
  let currentContour: PathContour | null = null;
  let prevControlPoint: Point | null = null;

  const ensureContour = () => {
    if (!currentContour) {
      currentContour = {
        id: generateId(),
        closed: false,
        nodes: [{ id: generateId(), x: currentPos.x, y: currentPos.y, type: 'corner' }],
      };
    }
  };

  while ((match = commandRegex.exec(d)) !== null) {
    const cmd = match[1];
    const isRelative = cmd === cmd.toLowerCase();
    const upperCmd = cmd.toUpperCase();
    const args = parseNumbers(match[2]);
    let argIdx = 0;

    switch (upperCmd) {
      case 'M': {
        // Move to
        if (currentContour && currentContour.nodes.length > 0) {
          contours.push(currentContour);
          currentContour = null;
        }
        if (args.length >= 2) {
          const x = isRelative ? currentPos.x + args[0] : args[0];
          const y = isRelative ? currentPos.y + args[1] : args[1];
          currentPos = { x, y };
          startPos = { x, y };
          currentContour = {
            id: generateId(),
            closed: false,
            nodes: [{ id: generateId(), x, y, type: 'corner' }],
          };
          prevControlPoint = null;
          argIdx = 2;

          // Subsequent coordinates are implicit L / l
          while (argIdx + 1 < args.length) {
            const lx = isRelative ? currentPos.x + args[argIdx++] : args[argIdx++];
            const ly = isRelative ? currentPos.y + args[argIdx++] : args[argIdx++];
            currentContour.nodes.push({ id: generateId(), x: lx, y: ly, type: 'corner' });
            currentPos = { x: lx, y: ly };
          }
        }
        break;
      }

      case 'L': {
        // Line to
        ensureContour();
        while (argIdx + 1 < args.length) {
          const x = isRelative ? currentPos.x + args[argIdx++] : args[argIdx++];
          const y = isRelative ? currentPos.y + args[argIdx++] : args[argIdx++];
          currentContour!.nodes.push({ id: generateId(), x, y, type: 'corner' });
          currentPos = { x, y };
          prevControlPoint = null;
        }
        break;
      }

      case 'H': {
        // Horizontal Line to
        ensureContour();
        while (argIdx < args.length) {
          const x = isRelative ? currentPos.x + args[argIdx++] : args[argIdx++];
          currentContour!.nodes.push({
            id: generateId(),
            x,
            y: currentPos.y,
            type: 'corner',
          });
          currentPos = { x, y: currentPos.y };
          prevControlPoint = null;
        }
        break;
      }

      case 'V': {
        // Vertical Line to
        ensureContour();
        while (argIdx < args.length) {
          const y = isRelative ? currentPos.y + args[argIdx++] : args[argIdx++];
          currentContour!.nodes.push({
            id: generateId(),
            x: currentPos.x,
            y,
            type: 'corner',
          });
          currentPos = { x: currentPos.x, y };
          prevControlPoint = null;
        }
        break;
      }

      case 'C': {
        // Cubic Bezier curve
        ensureContour();
        while (argIdx + 5 < args.length) {
          const cp1x = isRelative ? currentPos.x + args[argIdx++] : args[argIdx++];
          const cp1y = isRelative ? currentPos.y + args[argIdx++] : args[argIdx++];
          const cp2x = isRelative ? currentPos.x + args[argIdx++] : args[argIdx++];
          const cp2y = isRelative ? currentPos.y + args[argIdx++] : args[argIdx++];
          const x = isRelative ? currentPos.x + args[argIdx++] : args[argIdx++];
          const y = isRelative ? currentPos.y + args[argIdx++] : args[argIdx++];

          const lastNode = currentContour!.nodes[currentContour!.nodes.length - 1];
          if (lastNode) {
            lastNode.handleOut = { x: cp1x, y: cp1y };
          }

          const newNode: BezierNode = {
            id: generateId(),
            x,
            y,
            type: 'smooth',
            handleIn: { x: cp2x, y: cp2y },
          };
          currentContour!.nodes.push(newNode);

          prevControlPoint = { x: cp2x, y: cp2y };
          currentPos = { x, y };
        }
        break;
      }

      case 'S': {
        // Smooth Cubic Bezier
        ensureContour();
        while (argIdx + 3 < args.length) {
          let cp1x = currentPos.x;
          let cp1y = currentPos.y;
          if (prevControlPoint) {
            cp1x = 2 * currentPos.x - prevControlPoint.x;
            cp1y = 2 * currentPos.y - prevControlPoint.y;
          }

          const cp2x = isRelative ? currentPos.x + args[argIdx++] : args[argIdx++];
          const cp2y = isRelative ? currentPos.y + args[argIdx++] : args[argIdx++];
          const x = isRelative ? currentPos.x + args[argIdx++] : args[argIdx++];
          const y = isRelative ? currentPos.y + args[argIdx++] : args[argIdx++];

          const lastNode = currentContour!.nodes[currentContour!.nodes.length - 1];
          if (lastNode) {
            lastNode.handleOut = { x: cp1x, y: cp1y };
          }

          const newNode: BezierNode = {
            id: generateId(),
            x,
            y,
            type: 'smooth',
            handleIn: { x: cp2x, y: cp2y },
          };
          currentContour!.nodes.push(newNode);

          prevControlPoint = { x: cp2x, y: cp2y };
          currentPos = { x, y };
        }
        break;
      }

      case 'Q': {
        // Quadratic Bezier -> Elevate to Cubic Bezier
        ensureContour();
        while (argIdx + 3 < args.length) {
          const qpx = isRelative ? currentPos.x + args[argIdx++] : args[argIdx++];
          const qpy = isRelative ? currentPos.y + args[argIdx++] : args[argIdx++];
          const x = isRelative ? currentPos.x + args[argIdx++] : args[argIdx++];
          const y = isRelative ? currentPos.y + args[argIdx++] : args[argIdx++];

          // Elevate Quadratic (p0, qp, p1) to Cubic (cp1, cp2)
          const cp1x = currentPos.x + (2 / 3) * (qpx - currentPos.x);
          const cp1y = currentPos.y + (2 / 3) * (qpy - currentPos.y);
          const cp2x = x + (2 / 3) * (qpx - x);
          const cp2y = y + (2 / 3) * (qpy - y);

          const lastNode = currentContour!.nodes[currentContour!.nodes.length - 1];
          if (lastNode) {
            lastNode.handleOut = { x: cp1x, y: cp1y };
          }

          const newNode: BezierNode = {
            id: generateId(),
            x,
            y,
            type: 'smooth',
            handleIn: { x: cp2x, y: cp2y },
          };
          currentContour!.nodes.push(newNode);

          prevControlPoint = { x: qpx, y: qpy };
          currentPos = { x, y };
        }
        break;
      }

      case 'Z': {
        // Close Path
        if (currentContour) {
          currentContour.closed = true;
          // If first and last node are very close, merge handles
          if (currentContour.nodes.length > 1) {
            const first = currentContour.nodes[0];
            const last = currentContour.nodes[currentContour.nodes.length - 1];
            if (Math.hypot(first.x - last.x, first.y - last.y) < 2) {
              if (last.handleIn && !first.handleIn) {
                first.handleIn = last.handleIn;
              }
              currentContour.nodes.pop();
            }
          }
          contours.push(currentContour);
          currentContour = null;
        }
        currentPos = { ...startPos };
        prevControlPoint = null;
        break;
      }
    }
  }

  if (currentContour && currentContour.nodes.length > 0) {
    contours.push(currentContour);
  }

  return contours;
}

function parseNumbers(str: string): number[] {
  if (!str) return [];
  const matches = str.match(/-?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
  return matches ? matches.map(Number) : [];
}

function createRectContourDirect(x: number, y: number, w: number, h: number): PathContour {
  return {
    id: generateId(),
    closed: true,
    nodes: [
      { id: generateId(), x, y, type: 'corner' },
      { id: generateId(), x: x + w, y, type: 'corner' },
      { id: generateId(), x: x + w, y: y + h, type: 'corner' },
      { id: generateId(), x, y: y + h, type: 'corner' },
    ],
  };
}

function createEllipseContourDirect(cx: number, cy: number, rx: number, ry: number): PathContour {
  const kx = rx * 0.5522847498;
  const ky = ry * 0.5522847498;
  return {
    id: generateId(),
    closed: true,
    nodes: [
      {
        id: generateId(),
        x: cx,
        y: cy - ry,
        type: 'smooth',
        handleIn: { x: cx - kx, y: cy - ry },
        handleOut: { x: cx + kx, y: cy - ry },
      },
      {
        id: generateId(),
        x: cx + rx,
        y: cy,
        type: 'smooth',
        handleIn: { x: cx + rx, y: cy - ky },
        handleOut: { x: cx + rx, y: cy + ky },
      },
      {
        id: generateId(),
        x: cx,
        y: cy + ry,
        type: 'smooth',
        handleIn: { x: cx + kx, y: cy + ry },
        handleOut: { x: cx - kx, y: cy + ry },
      },
      {
        id: generateId(),
        x: cx - rx,
        y: cy,
        type: 'smooth',
        handleIn: { x: cx - rx, y: cy + ky },
        handleOut: { x: cx - rx, y: cy - ky },
      },
    ],
  };
}
