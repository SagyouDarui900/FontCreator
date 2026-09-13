import { PathContour, Point, SnapGuideLine, GridSettings } from '../types';
import { getContoursBoundingBox } from './pathUtils';

export interface MetricsTargets {
  lsb: number;
  advanceWidth: number;
  baseline?: number; // 800
  ascender?: number; // 200
  capHeight?: number; // 300
  xHeight?: number; // 500
  descender?: number; // 1000
}

export interface CustomGuideTarget {
  id: string;
  type: 'h' | 'v';
  position: number;
}

export interface SnapOptions {
  gridSettings?: GridSettings;
  strictGridSnap?: boolean; // When shift is held or strict mode is desired
}

export interface SnapMovementResult {
  dx: number;
  dy: number;
  activeGuides: SnapGuideLine[];
}

export interface SnapPointResult {
  point: Point;
  activeGuides: SnapGuideLine[];
}

/**
 * Build all potential horizontal snap target lines
 */
export function getHorizontalSnapTargets(
  metrics: MetricsTargets,
  otherContours: PathContour[],
  customGuides: CustomGuideTarget[] = [],
  gridSettings?: GridSettings
): { position: number; name: string; type: SnapGuideLine['targetType']; color: string; priority: number }[] {
  const targets: { position: number; name: string; type: SnapGuideLine['targetType']; color: string; priority: number }[] = [];

  // 1. Baseline (Highest priority)
  const baselineY = metrics.baseline ?? 800;
  targets.push({
    position: baselineY,
    name: 'ベースライン (Baseline: 0)',
    type: 'baseline',
    color: '#ef4444', // Bright red
    priority: 10,
  });

  // 2. Other Standard Font Metrics
  const ascenderY = metrics.ascender ?? 200;
  targets.push({
    position: ascenderY,
    name: 'アセンダー (Ascender: +800)',
    type: 'metric',
    color: '#3b82f6',
    priority: 8,
  });

  const capHeightY = metrics.capHeight ?? 300;
  targets.push({
    position: capHeightY,
    name: 'キャップハイト (Cap Height: +700)',
    type: 'metric',
    color: '#0ea5e9',
    priority: 7,
  });

  const xHeightY = metrics.xHeight ?? 500;
  targets.push({
    position: xHeightY,
    name: 'エックスハイト (X-Height: +500)',
    type: 'metric',
    color: '#06b6d4',
    priority: 7,
  });

  const descenderY = metrics.descender ?? 1000;
  targets.push({
    position: descenderY,
    name: 'ディセンダー (Descender: -200)',
    type: 'metric',
    color: '#f97316',
    priority: 6,
  });

  // 3. Canvas Center (Y: 500)
  targets.push({
    position: 500,
    name: 'キャンバス中央 (Y: 500)',
    type: 'center',
    color: '#8b5cf6',
    priority: 5,
  });

  // 4. Japanese Guide Frames (田字格、九宮格、漢字枠、仮名枠)
  if (gridSettings?.japaneseGuide === 'tian' || gridSettings?.japaneseGuide === 'mi') {
    // 500 is already added
  }
  if (gridSettings?.japaneseGuide === 'jiugong') {
    targets.push(
      { position: 333.3, name: '九宮格 (Y: 333)', type: 'metric', color: '#0284c7', priority: 6 },
      { position: 666.7, name: '九宮格 (Y: 667)', type: 'metric', color: '#0284c7', priority: 6 }
    );
  }
  if (gridSettings?.showBodyFrame) {
    targets.push(
      { position: 75, name: '漢字字面枠上端 (Y: 75)', type: 'metric', color: '#059669', priority: 6 },
      { position: 925, name: '漢字字面枠下端 (Y: 925)', type: 'metric', color: '#059669', priority: 6 }
    );
  }
  if (gridSettings?.showKanaFrame) {
    targets.push(
      { position: 110, name: '仮名枠上端 (Y: 110)', type: 'metric', color: '#d97706', priority: 6 },
      { position: 890, name: '仮名枠下端 (Y: 890)', type: 'metric', color: '#d97706', priority: 6 }
    );
  }

  // 5. Custom User Horizontal Guidelines
  for (const guide of customGuides) {
    if (guide.type === 'h') {
      targets.push({
        position: guide.position,
        name: `ガイド (Y: ${Math.round(guide.position)})`,
        type: 'custom',
        color: '#06b6d4',
        priority: 7,
      });
    }
  }

  // 6. Bounding boxes & nodes of other contours
  for (let i = 0; i < otherContours.length; i++) {
    const contour = otherContours[i];
    const bbox = getContoursBoundingBox([contour]);
    if (bbox.width > 0 || bbox.height > 0) {
      targets.push({
        position: bbox.minY,
        name: `他パーツ上端 (Y: ${Math.round(bbox.minY)})`,
        type: 'contour',
        color: '#d946ef',
        priority: 4,
      });
      targets.push({
        position: bbox.centerY,
        name: `他パーツ中央 (Y: ${Math.round(bbox.centerY)})`,
        type: 'contour',
        color: '#d946ef',
        priority: 3,
      });
      targets.push({
        position: bbox.maxY,
        name: `他パーツ下端 (Y: ${Math.round(bbox.maxY)})`,
        type: 'contour',
        color: '#d946ef',
        priority: 4,
      });
    }
  }

  return targets;
}

/**
 * Build all potential vertical snap target lines
 */
export function getVerticalSnapTargets(
  metrics: MetricsTargets,
  otherContours: PathContour[],
  customGuides: CustomGuideTarget[] = [],
  gridSettings?: GridSettings
): { position: number; name: string; type: SnapGuideLine['targetType']; color: string; priority: number }[] {
  const targets: { position: number; name: string; type: SnapGuideLine['targetType']; color: string; priority: number }[] = [];

  // 1. LSB (Left Side Bearing - Highest priority for X)
  targets.push({
    position: metrics.lsb,
    name: `左余白 (LSB: ${Math.round(metrics.lsb)})`,
    type: 'lsb',
    color: '#10b981', // Bright emerald
    priority: 10,
  });

  // 2. RSB (Advance Width)
  targets.push({
    position: metrics.advanceWidth,
    name: `送り幅 (RSB: ${Math.round(metrics.advanceWidth)})`,
    type: 'rsb',
    color: '#10b981',
    priority: 9,
  });

  // 3. Canvas Center (X: 500)
  targets.push({
    position: 500,
    name: 'キャンバス中央 (X: 500)',
    type: 'center',
    color: '#8b5cf6',
    priority: 5,
  });

  // 4. Japanese Guide Frames (九宮格、漢字枠、仮名枠)
  if (gridSettings?.japaneseGuide === 'jiugong') {
    targets.push(
      { position: 333.3, name: '九宮格 (X: 333)', type: 'metric', color: '#0284c7', priority: 6 },
      { position: 666.7, name: '九宮格 (X: 667)', type: 'metric', color: '#0284c7', priority: 6 }
    );
  }
  if (gridSettings?.showBodyFrame) {
    targets.push(
      { position: 75, name: '漢字字面枠左端 (X: 75)', type: 'metric', color: '#059669', priority: 6 },
      { position: 925, name: '漢字字面枠右端 (X: 925)', type: 'metric', color: '#059669', priority: 6 }
    );
  }
  if (gridSettings?.showKanaFrame) {
    targets.push(
      { position: 110, name: '仮名枠左端 (X: 110)', type: 'metric', color: '#d97706', priority: 6 },
      { position: 890, name: '仮名枠右端 (X: 890)', type: 'metric', color: '#d97706', priority: 6 }
    );
  }

  // 5. Custom User Vertical Guidelines
  for (const guide of customGuides) {
    if (guide.type === 'v') {
      targets.push({
        position: guide.position,
        name: `ガイド (X: ${Math.round(guide.position)})`,
        type: 'custom',
        color: '#06b6d4',
        priority: 7,
      });
    }
  }

  // 6. Bounding boxes of other contours
  for (let i = 0; i < otherContours.length; i++) {
    const contour = otherContours[i];
    const bbox = getContoursBoundingBox([contour]);
    if (bbox.width > 0 || bbox.height > 0) {
      targets.push({
        position: bbox.minX,
        name: `他パーツ左端 (X: ${Math.round(bbox.minX)})`,
        type: 'contour',
        color: '#d946ef',
        priority: 4,
      });
      targets.push({
        position: bbox.centerX,
        name: `他パーツ中央 (X: ${Math.round(bbox.centerX)})`,
        type: 'contour',
        color: '#d946ef',
        priority: 3,
      });
      targets.push({
        position: bbox.maxX,
        name: `他パーツ右端 (X: ${Math.round(bbox.maxX)})`,
        type: 'contour',
        color: '#d946ef',
        priority: 4,
      });
    }
  }

  return targets;
}

/**
 * Snap contour movement (dragging entire path) to Baseline, LSB, Metrics, and other contours
 */
export function snapContourMovement(
  initialBBox: { minX: number; minY: number; maxX: number; maxY: number; centerX: number; centerY: number },
  rawDx: number,
  rawDy: number,
  otherContours: PathContour[],
  metrics: MetricsTargets,
  customGuides: CustomGuideTarget[] = [],
  threshold: number = 10,
  activeContourNodes?: { x: number; y: number }[],
  gridSettings?: GridSettings
): SnapMovementResult {
  const hTargets = getHorizontalSnapTargets(metrics, otherContours, customGuides, gridSettings);
  const vTargets = getVerticalSnapTargets(metrics, otherContours, customGuides, gridSettings);

  const activeGuides: SnapGuideLine[] = [];

  // Current tentative positions with raw delta
  const curMinX = initialBBox.minX + rawDx;
  const curCenterX = initialBBox.centerX + rawDx;
  const curMaxX = initialBBox.maxX + rawDx;

  const curMinY = initialBBox.minY + rawDy;
  const curCenterY = initialBBox.centerY + rawDy;
  const curMaxY = initialBBox.maxY + rawDy;

  // --- Horizontal Snapping (Y-axis: Baseline, etc.) ---
  const ySources = [
    { pos: curMaxY, name: '下端', priority: 3 }, // Bottom edge (especially for baseline)
    { pos: curMinY, name: '上端', priority: 2 },
    { pos: curCenterY, name: '中央', priority: 1 },
  ];

  // Also include nodes if provided (up to 10 nodes to keep it fast)
  if (activeContourNodes && activeContourNodes.length > 0) {
    const sampledNodes = activeContourNodes.slice(0, 10);
    for (const node of sampledNodes) {
      ySources.push({ pos: node.y + rawDy, name: 'アンカー', priority: 2 });
    }
  }

  let bestSnapY: { delta: number; target: typeof hTargets[0]; source: typeof ySources[0]; score: number } | null = null;
  let minDiffY = threshold;

  for (const src of ySources) {
    for (const target of hTargets) {
      const diff = Math.abs(src.pos - target.position);
      if (diff <= threshold) {
        // Boost priority for baseline with bottom edge
        const isBaselineBottom = target.type === 'baseline' && src.name === '下端';
        // Priority gives a slight bonus (up to 4px) to favor key metrics when difference is similar
        const priorityBonus = (target.priority + src.priority + (isBaselineBottom ? 4 : 0)) * 0.3;
        const score = diff - priorityBonus;

        if (bestSnapY === null || score < bestSnapY.score) {
          bestSnapY = {
            delta: target.position - src.pos,
            target,
            source: src,
            score,
          };
          minDiffY = diff;
        }
      }
    }
  }

  // Check magnetic grid snap candidate
  let bestGridSnapY: { delta: number; nearestGridY: number; source: typeof ySources[0]; diff: number } | null = null;
  if (gridSettings?.snapToGrid && gridSettings.gridSize > 1) {
    const step = gridSettings.gridSize;
    for (const src of ySources) {
      const nearestGridY = Math.round(src.pos / step) * step;
      const diff = Math.abs(src.pos - nearestGridY);
      if (diff <= threshold) {
        if (bestGridSnapY === null || diff < bestGridSnapY.diff) {
          bestGridSnapY = {
            delta: nearestGridY - src.pos,
            nearestGridY,
            source: src,
            diff,
          };
        }
      }
    }
  }

  // Determine whether guide snap or grid snap wins for Y
  let finalDy = rawDy;
  // If snapToGrid is enabled, grid snap is chosen if no guide snap, or if grid snap is closer
  const useGridY = bestGridSnapY !== null && (bestSnapY === null || bestGridSnapY.diff < minDiffY - 1);

  if (useGridY && bestGridSnapY) {
    finalDy = rawDy + bestGridSnapY.delta;
    activeGuides.push({
      id: `snap-grid-h-${bestGridSnapY.nearestGridY}`,
      type: 'h',
      position: bestGridSnapY.nearestGridY,
      targetName: `グリッド線 (Y: ${bestGridSnapY.nearestGridY}) [${bestGridSnapY.source.name}吸着]`,
      targetType: 'grid',
      color: '#10b981',
      matchedSource: bestGridSnapY.source.name,
      snapPoint: { x: curCenterX, y: bestGridSnapY.nearestGridY },
    });
  } else if (bestSnapY) {
    finalDy = rawDy + bestSnapY.delta;
    activeGuides.push({
      id: `snap-h-${bestSnapY.target.type}-${bestSnapY.target.position}`,
      type: 'h',
      position: bestSnapY.target.position,
      targetName: `${bestSnapY.target.name} [${bestSnapY.source.name}吸着]`,
      targetType: bestSnapY.target.type,
      color: bestSnapY.target.color,
      matchedSource: bestSnapY.source.name,
      snapPoint: {
        x: curCenterX,
        y: bestSnapY.target.position,
      },
    });
  }

  // --- Vertical Snapping (X-axis: LSB, etc.) ---
  const xSources = [
    { pos: curMinX, name: '左端', priority: 3 }, // Left edge (especially for LSB)
    { pos: curCenterX, name: '中央', priority: 1 },
    { pos: curMaxX, name: '右端', priority: 2 },
  ];

  if (activeContourNodes && activeContourNodes.length > 0) {
    const sampledNodes = activeContourNodes.slice(0, 10);
    for (const node of sampledNodes) {
      xSources.push({ pos: node.x + rawDx, name: 'アンカー', priority: 2 });
    }
  }

  let bestSnapX: { delta: number; target: typeof vTargets[0]; source: typeof xSources[0]; score: number } | null = null;
  let minDiffX = threshold;

  for (const src of xSources) {
    for (const target of vTargets) {
      const diff = Math.abs(src.pos - target.position);
      if (diff <= threshold) {
        const isLsbLeft = target.type === 'lsb' && src.name === '左端';
        const priorityBonus = (target.priority + src.priority + (isLsbLeft ? 4 : 0)) * 0.3;
        const score = diff - priorityBonus;

        if (bestSnapX === null || score < bestSnapX.score) {
          bestSnapX = {
            delta: target.position - src.pos,
            target,
            source: src,
            score,
          };
          minDiffX = diff;
        }
      }
    }
  }

  // Check magnetic grid snap candidate for X
  let bestGridSnapX: { delta: number; nearestGridX: number; source: typeof xSources[0]; diff: number } | null = null;
  if (gridSettings?.snapToGrid && gridSettings.gridSize > 1) {
    const step = gridSettings.gridSize;
    for (const src of xSources) {
      const nearestGridX = Math.round(src.pos / step) * step;
      const diff = Math.abs(src.pos - nearestGridX);
      if (diff <= threshold) {
        if (bestGridSnapX === null || diff < bestGridSnapX.diff) {
          bestGridSnapX = {
            delta: nearestGridX - src.pos,
            nearestGridX,
            source: src,
            diff,
          };
        }
      }
    }
  }

  let finalDx = rawDx;
  const useGridX = bestGridSnapX !== null && (bestSnapX === null || bestGridSnapX.diff < minDiffX - 1);

  if (useGridX && bestGridSnapX) {
    finalDx = rawDx + bestGridSnapX.delta;
    activeGuides.push({
      id: `snap-grid-v-${bestGridSnapX.nearestGridX}`,
      type: 'v',
      position: bestGridSnapX.nearestGridX,
      targetName: `グリッド線 (X: ${bestGridSnapX.nearestGridX}) [${bestGridSnapX.source.name}吸着]`,
      targetType: 'grid',
      color: '#10b981',
      matchedSource: bestGridSnapX.source.name,
      snapPoint: { x: bestGridSnapX.nearestGridX, y: curCenterY + (finalDy - rawDy) },
    });
  } else if (bestSnapX) {
    finalDx = rawDx + bestSnapX.delta;
    activeGuides.push({
      id: `snap-v-${bestSnapX.target.type}-${bestSnapX.target.position}`,
      type: 'v',
      position: bestSnapX.target.position,
      targetName: `${bestSnapX.target.name} [${bestSnapX.source.name}吸着]`,
      targetType: bestSnapX.target.type,
      color: bestSnapX.target.color,
      matchedSource: bestSnapX.source.name,
      snapPoint: {
        x: bestSnapX.target.position,
        y: curCenterY + (finalDy - rawDy),
      },
    });
  }

  return {
    dx: Math.round(finalDx),
    dy: Math.round(finalDy),
    activeGuides,
  };
}

/**
 * Snap a single point (Node drag, Pen tool, Shape drawing) to Baseline, LSB, Metrics, Guides, and Grid
 */
export function snapSinglePoint(
  rawPos: Point,
  otherContours: PathContour[],
  metrics: MetricsTargets,
  customGuides: CustomGuideTarget[] = [],
  threshold: number = 10,
  gridSettings?: GridSettings
): SnapPointResult {
  const hTargets = getHorizontalSnapTargets(metrics, otherContours, customGuides, gridSettings);
  const vTargets = getVerticalSnapTargets(metrics, otherContours, customGuides, gridSettings);

  const activeGuides: SnapGuideLine[] = [];

  // Y axis snap
  let snappedY = rawPos.y;
  let bestTargetY: typeof hTargets[0] | null = null;
  let minDiffY = threshold;

  for (const target of hTargets) {
    const diff = Math.abs(rawPos.y - target.position);
    if (diff <= minDiffY) {
      minDiffY = diff;
      bestTargetY = target;
    }
  }

  // Evaluate grid snap for Y
  let gridSnapY: number | null = null;
  let gridDiffY = threshold + 1;
  if (gridSettings?.snapToGrid && gridSettings.gridSize > 1) {
    const step = gridSettings.gridSize;
    const nearestGridY = Math.round(rawPos.y / step) * step;
    const diff = Math.abs(rawPos.y - nearestGridY);
    if (diff <= threshold) {
      gridSnapY = nearestGridY;
      gridDiffY = diff;
    }
  }

  // If snapToGrid is active, grid snap wins if it's closer than the nearest guide, or if guide is absent
  const useGridY = gridSnapY !== null && (bestTargetY === null || gridDiffY < minDiffY);

  if (useGridY && gridSnapY !== null) {
    snappedY = gridSnapY;
    activeGuides.push({
      id: `snap-pt-grid-h-${gridSnapY}`,
      type: 'h',
      position: gridSnapY,
      targetName: `グリッド線 (Y: ${gridSnapY})`,
      targetType: 'grid',
      color: '#10b981',
      snapPoint: { x: rawPos.x, y: gridSnapY },
    });
  } else if (bestTargetY) {
    snappedY = bestTargetY.position;
    activeGuides.push({
      id: `snap-pt-h-${bestTargetY.type}-${bestTargetY.position}`,
      type: 'h',
      position: bestTargetY.position,
      targetName: bestTargetY.name,
      targetType: bestTargetY.type,
      color: bestTargetY.color,
      snapPoint: { x: rawPos.x, y: bestTargetY.position },
    });
  }

  // X axis snap
  let snappedX = rawPos.x;
  let bestTargetX: typeof vTargets[0] | null = null;
  let minDiffX = threshold;

  for (const target of vTargets) {
    const diff = Math.abs(rawPos.x - target.position);
    if (diff <= minDiffX) {
      minDiffX = diff;
      bestTargetX = target;
    }
  }

  // Evaluate grid snap for X
  let gridSnapX: number | null = null;
  let gridDiffX = threshold + 1;
  if (gridSettings?.snapToGrid && gridSettings.gridSize > 1) {
    const step = gridSettings.gridSize;
    const nearestGridX = Math.round(rawPos.x / step) * step;
    const diff = Math.abs(rawPos.x - nearestGridX);
    if (diff <= threshold) {
      gridSnapX = nearestGridX;
      gridDiffX = diff;
    }
  }

  // If snapToGrid is active, grid snap wins if it's closer than the nearest guide, or if guide is absent
  const useGridX = gridSnapX !== null && (bestTargetX === null || gridDiffX < minDiffX);

  if (useGridX && gridSnapX !== null) {
    snappedX = gridSnapX;
    activeGuides.push({
      id: `snap-pt-grid-v-${gridSnapX}`,
      type: 'v',
      position: gridSnapX,
      targetName: `グリッド線 (X: ${gridSnapX})`,
      targetType: 'grid',
      color: '#10b981',
      snapPoint: { x: gridSnapX, y: snappedY },
    });
  } else if (bestTargetX) {
    snappedX = bestTargetX.position;
    activeGuides.push({
      id: `snap-pt-v-${bestTargetX.type}-${bestTargetX.position}`,
      type: 'v',
      position: bestTargetX.position,
      targetName: bestTargetX.name,
      targetType: bestTargetX.type,
      color: bestTargetX.color,
      snapPoint: { x: bestTargetX.position, y: snappedY },
    });
  }

  return {
    point: { x: Math.round(snappedX), y: Math.round(snappedY) },
    activeGuides,
  };
}
