import {
  PathContour,
} from "../../types";

const SVG_PATH_CACHE = new WeakMap<PathContour[], string>();

/**
 * Convert contours to standard SVG path string 'd' with WeakMap memoization
 */
export function contoursToSvgPath(contours: PathContour[]): string {
  if (!contours || contours.length === 0) return '';
  const cached = SVG_PATH_CACHE.get(contours);
  if (cached !== undefined) return cached;

  let d = '';
  const fmt = (n: number) => Number(n.toFixed(2));

  for (const contour of contours) {
    const nodes = contour.nodes;
    if (!nodes || nodes.length === 0) continue;

    const first = nodes[0];
    d += `M ${fmt(first.x)} ${fmt(first.y)} `;

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
        d += `L ${fmt(next.x)} ${fmt(next.y)} `;
      } else {
        d += `C ${fmt(cp1.x)} ${fmt(cp1.y)}, ${fmt(cp2.x)} ${fmt(cp2.y)}, ${fmt(next.x)} ${fmt(next.y)} `;
      }
    }

    if (contour.closed) {
      d += 'Z ';
    }
  }

  const result = d.trim();
  SVG_PATH_CACHE.set(contours, result);
  return result;
}

/**
 * Calculate bounding box of contours
 */
