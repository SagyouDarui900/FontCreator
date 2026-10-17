import {
  BezierNode,
  PathContour,
  Point,
  RadicalPlacement,
} from "../../types";
import { generateId } from "./id";
import {
  getContoursBoundingBox,
  reverseContour,
  normalizeGlyphContoursWinding,
} from "./bounds";
import { optimizeContourNodes } from "./stroke";

export function smoothAndFixTransformedContours(contours: PathContour[]): PathContour[] {
  return contours.map((contour) => {
    if (!contour.nodes || contour.nodes.length === 0) return contour;

    const nodes = contour.nodes.map((node) => {
      // Preserve subpixel precision
      const x = Math.round(node.x * 100) / 100;
      const y = Math.round(node.y * 100) / 100;
      let handleIn = node.handleIn
        ? { x: Math.round(node.handleIn.x * 100) / 100, y: Math.round(node.handleIn.y * 100) / 100 }
        : null;
      let handleOut = node.handleOut
        ? { x: Math.round(node.handleOut.x * 100) / 100, y: Math.round(node.handleOut.y * 100) / 100 }
        : null;

      // Re-align collinearity for smooth or symmetric Bezier nodes
      if ((node.type === 'smooth' || node.type === 'symmetric') && handleIn && handleOut) {
        const dxIn = handleIn.x - x;
        const dyIn = handleIn.y - y;
        const lenIn = Math.hypot(dxIn, dyIn);

        const dxOut = handleOut.x - x;
        const dyOut = handleOut.y - y;
        const lenOut = Math.hypot(dxOut, dyOut);

        if (lenIn > 0.05 && lenOut > 0.05) {
          const angle = Math.atan2(dyOut, dxOut);
          if (node.type === 'symmetric') {
            const avgLen = (lenIn + lenOut) / 2;
            handleOut = {
              x: Math.round((x + Math.cos(angle) * avgLen) * 100) / 100,
              y: Math.round((y + Math.sin(angle) * avgLen) * 100) / 100,
            };
            handleIn = {
              x: Math.round((x - Math.cos(angle) * avgLen) * 100) / 100,
              y: Math.round((y - Math.sin(angle) * avgLen) * 100) / 100,
            };
          } else {
            handleIn = {
              x: Math.round((x - Math.cos(angle) * lenIn) * 100) / 100,
              y: Math.round((y - Math.sin(angle) * lenIn) * 100) / 100,
            };
          }
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

    return {
      ...contour,
      nodes,
    };
  });
}

/**
 * Transform contours by matrix/function with subpixel precision and smooth handle protection
 */
export function transformContours(
  contours: PathContour[],
  transformFn: (p: Point) => Point
): PathContour[] {
  const transformed = contours.map((contour) => ({
    ...contour,
    nodes: contour.nodes.map((node) => {
      const newPt = transformFn({ x: node.x, y: node.y });
      let handleIn: Point | null = null;
      if (node.handleIn) {
        if (Math.abs(node.handleIn.x - node.x) < 0.01 && Math.abs(node.handleIn.y - node.y) < 0.01) {
          handleIn = { x: newPt.x, y: newPt.y };
        } else {
          handleIn = transformFn(node.handleIn);
        }
      }
      let handleOut: Point | null = null;
      if (node.handleOut) {
        if (Math.abs(node.handleOut.x - node.x) < 0.01 && Math.abs(node.handleOut.y - node.y) < 0.01) {
          handleOut = { x: newPt.x, y: newPt.y };
        } else {
          handleOut = transformFn(node.handleOut);
        }
      }
      return {
        ...node,
        x: Math.round(newPt.x * 100) / 100,
        y: Math.round(newPt.y * 100) / 100,
        handleIn: handleIn ? { x: Math.round(handleIn.x * 100) / 100, y: Math.round(handleIn.y * 100) / 100 } : null,
        handleOut: handleOut ? { x: Math.round(handleOut.x * 100) / 100, y: Math.round(handleOut.y * 100) / 100 } : null,
      };
    }),
  }));

  return transformed;
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
 * Slant / Italicize contours with high subpixel precision
 */
export function slantContours(contours: PathContour[], angleDeg: number = 12): PathContour[] {
  const rad = (angleDeg * Math.PI) / 180;
  const tan = Math.tan(rad);
  const bbox = getContoursBoundingBox(contours);
  const cy = bbox.centerY;

  return transformContours(contours, (p) => ({
    x: p.x + (p.y - cy) * tan,
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
export function scaleContours(contours: PathContour[], scaleX: number, scaleY: number = scaleX): PathContour[] {
  const bbox = getContoursBoundingBox(contours);
  const cx = bbox.centerX;
  const cy = bbox.centerY;

  return transformContours(contours, (p) => ({
    x: Math.round((cx + (p.x - cx) * scaleX) * 100) / 100,
    y: Math.round((cy + (p.y - cy) * scaleY) * 100) / 100,
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
 * Auto-fit contours safely inside the standard Em-box (e.g. 85% for Kanji, or custom target ratio)
 * Pulls overflowing contours back inside the canvas boundaries with proportional scaling.
 */
export function fitContoursToEmBox(
  contours: PathContour[],
  boxWidth: number = 1000,
  boxHeight: number = 1000,
  targetRatio: number = 0.85
): PathContour[] {
  if (!contours || contours.length === 0) return [];
  const bbox = getContoursBoundingBox(contours);
  if (bbox.width <= 0 || bbox.height <= 0) return contours;

  const targetW = boxWidth * targetRatio;
  const targetH = boxHeight * targetRatio;

  // Scale down if contours exceed the target box, or scale to optimal 85% frame
  const scaleX = bbox.width > targetW ? targetW / bbox.width : 1.0;
  const scaleY = bbox.height > targetH ? targetH / bbox.height : 1.0;
  const scale = Math.min(scaleX, scaleY);

  const targetCenterX = boxWidth / 2;
  const targetCenterY = boxHeight / 2;

  const currentCenterX = bbox.centerX;
  const currentCenterY = bbox.centerY;

  return transformContours(contours, (p) => ({
    x: Math.round((targetCenterX + (p.x - currentCenterX) * scale) * 10) / 10,
    y: Math.round((targetCenterY + (p.y - currentCenterY) * scale) * 10) / 10,
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
    x: Math.round((actualX + (p.x - bbox.minX) * scale) * 100) / 100,
    y: Math.round((actualY + (p.y - bbox.minY) * scale) * 100) / 100,
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
 * Takes Bézier curve handles into account by dense sampling if present.
 * In screen coordinates (Y downwards):
 * - Positive area (> 0) means CLOCKWISE in screen space (Clockwise in TrueType font Y-up space)
 * - Negative area (< 0) means COUNTER-CLOCKWISE in screen space (Counter-Clockwise in TrueType space)
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
