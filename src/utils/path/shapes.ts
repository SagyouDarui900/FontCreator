import {
  BezierNode,
  PathContour,
  Point,
  ShapePreset,
  ShapeType,
} from "../../types";
import { generateId } from "./id";
import { slantSingleContour } from "./transform";

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
  let w = width;
  let h = height;
  // If square or near-square aspect ratio (e.g. 1-click stamp or 1:1 box),
  // elongate to a 2:1 capsule aspect ratio so it never degenerates into a circle
  if (Math.abs(w - h) < Math.max(w, h) * 0.25) {
    if (w >= h) {
      h = w * 0.48;
    } else {
      w = h * 0.48;
    }
  }
  const isHorizontal = w >= h;
  const radius = isHorizontal ? h / 2 : w / 2;
  return createRoundedRectContour(cx, cy, w, h, radius);
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
  { id: 'circle', name: '正円', category: 'basic', description: '正円（4ノード高精度ベジェ）' },
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
