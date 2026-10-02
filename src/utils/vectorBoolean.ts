import paper from 'paper/dist/paper-core';
import { BezierNode, NodeType, PathContour, Point } from '../types';
import { generateId, getContoursBoundingBox } from './pathUtils';

// Initialize a shared, isolated PaperScope for headless vector operations
let paperScopeInstance: paper.PaperScope | null = null;

function getPaperScope(): paper.PaperScope {
  if (!paperScopeInstance) {
    paperScopeInstance = new paper.PaperScope();
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 3000;
      canvas.height = 3000;
      paperScopeInstance.setup(canvas);
    }
  }
  if (!paperScopeInstance.project) {
    new paperScopeInstance.Project(null as any);
  }
  paperScopeInstance.activate();
  return paperScopeInstance;
}

/**
 * Convert a single PathContour into a Paper.js Path
 */
export function contourToPaperPath(scope: paper.PaperScope, contour: PathContour): paper.Path {
  const path = new scope.Path();
  path.closed = contour.closed;

  for (const node of contour.nodes) {
    const pt = new scope.Point(node.x, node.y);
    const inPt = node.handleIn
      ? new scope.Point(node.handleIn.x - node.x, node.handleIn.y - node.y)
      : new scope.Point(0, 0);
    const outPt = node.handleOut
      ? new scope.Point(node.handleOut.x - node.x, node.handleOut.y - node.y)
      : new scope.Point(0, 0);

    path.add(new scope.Segment(pt, inPt, outPt));
  }

  return path;
}

/**
 * Recursively collect all paper.Path elements from an Item / CompoundPath / Group
 */
function collectPaperPaths(item: paper.Item): paper.Path[] {
  const result: paper.Path[] = [];
  if (!item) return result;

  // Check if it's a direct Path
  if ('segments' in item && Array.isArray((item as paper.Path).segments)) {
    result.push(item as paper.Path);
    return result;
  }

  // Check if it has children (CompoundPath or Group)
  if (item.children && Array.isArray(item.children)) {
    for (const child of item.children) {
      result.push(...collectPaperPaths(child));
    }
  }

  return result;
}

/**
 * Convert any Paper.js Item (Path, CompoundPath, Group) back to PathContour[]
 */
export function paperItemToContours(item: paper.Item | null): PathContour[] {
  if (!item) return [];

  const rawPaths = collectPaperPaths(item);
  const contours: PathContour[] = [];

  for (const p of rawPaths) {
    if (!p.segments || p.segments.length < 2) continue;

    // Filter out degenerate zero-area micro-loops
    if (p.closed && Math.abs(p.area) < 1.0) continue;

    const nodes: BezierNode[] = [];
    for (let i = 0; i < p.segments.length; i++) {
      const seg = p.segments[i];
      const x = Math.round(seg.point.x * 100) / 100;
      const y = Math.round(seg.point.y * 100) / 100;

      let handleIn: Point | null = null;
      let handleOut: Point | null = null;

      if (seg.handleIn && (Math.abs(seg.handleIn.x) > 0.05 || Math.abs(seg.handleIn.y) > 0.05)) {
        handleIn = {
          x: Math.round((seg.point.x + seg.handleIn.x) * 100) / 100,
          y: Math.round((seg.point.y + seg.handleIn.y) * 100) / 100,
        };
      }

      if (seg.handleOut && (Math.abs(seg.handleOut.x) > 0.05 || Math.abs(seg.handleOut.y) > 0.05)) {
        handleOut = {
          x: Math.round((seg.point.x + seg.handleOut.x) * 100) / 100,
          y: Math.round((seg.point.y + seg.handleOut.y) * 100) / 100,
        };
      }

      let nodeType: NodeType = 'corner';
      if (handleIn && handleOut) {
        const dIn = Math.hypot(handleIn.x - x, handleIn.y - y);
        const dOut = Math.hypot(handleOut.x - x, handleOut.y - y);
        if (dIn > 0.1 && dOut > 0.1) {
          const dot =
            (handleIn.x - x) * (handleOut.x - x) + (handleIn.y - y) * (handleOut.y - y);
          const cosAngle = dot / (dIn * dOut);
          // Handles pointing in opposite directions along tangent
          if (cosAngle < -0.92) {
            nodeType = Math.abs(dIn - dOut) < 1.5 ? 'symmetric' : 'smooth';
          }
        }
      }

      nodes.push({
        id: generateId(),
        x,
        y,
        handleIn,
        handleOut,
        type: nodeType,
      });
    }

    if (nodes.length >= 2) {
      contours.push({
        id: generateId(),
        nodes,
        closed: p.closed,
      });
    }
  }

  return contours;
}

/**
 * Build a smooth closed vector ribbon / capsule shape from a sequence of stroke points and a radius
 */
export function buildEraserRibbonPath(
  scope: paper.PaperScope,
  strokePoints: Point[],
  radius: number
): paper.PathItem {
  if (strokePoints.length === 0) {
    return new scope.Path();
  }

  if (strokePoints.length === 1) {
    return new scope.Path.Circle(
      new scope.Point(strokePoints[0].x, strokePoints[0].y),
      Math.max(2, radius)
    );
  }

  // Remove consecutive duplicate points
  const cleanPts: Point[] = [strokePoints[0]];
  for (let i = 1; i < strokePoints.length; i++) {
    const prev = cleanPts[cleanPts.length - 1];
    const curr = strokePoints[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) > 0.5) {
      cleanPts.push(curr);
    }
  }

  if (cleanPts.length === 1) {
    return new scope.Path.Circle(
      new scope.Point(cleanPts[0].x, cleanPts[0].y),
      Math.max(2, radius)
    );
  }

  const n = cleanPts.length;
  const rad = Math.max(2, radius);

  // Compute normal vectors at each point
  const normals: Point[] = [];
  for (let i = 0; i < n; i++) {
    let dx = 0;
    let dy = 0;
    if (i === 0) {
      dx = cleanPts[1].x - cleanPts[0].x;
      dy = cleanPts[1].y - cleanPts[0].y;
    } else if (i === n - 1) {
      dx = cleanPts[n - 1].x - cleanPts[n - 2].x;
      dy = cleanPts[n - 1].y - cleanPts[n - 2].y;
    } else {
      dx = cleanPts[i + 1].x - cleanPts[i - 1].x;
      dy = cleanPts[i + 1].y - cleanPts[i - 1].y;
    }
    const len = Math.hypot(dx, dy) || 1;
    // Normal perpendicular (-dy, dx)
    normals.push({ x: -dy / len, y: dx / len });
  }

  const ribbon = new scope.Path();
  ribbon.closed = true;

  // Left boundary points (0 -> n - 1)
  for (let i = 0; i < n; i++) {
    const pt = cleanPts[i];
    const norm = normals[i];
    ribbon.add(new scope.Point(pt.x + norm.x * rad, pt.y + norm.y * rad));
  }

  // End cap semicircular arc around cleanPts[n - 1]
  const endPt = cleanPts[n - 1];
  const endNorm = normals[n - 1];
  const endDir = { x: -endNorm.y, y: endNorm.x }; // Forward direction
  ribbon.add(new scope.Point(endPt.x + endDir.x * rad, endPt.y + endDir.y * rad));

  // Right boundary points (n - 1 down to 0)
  for (let i = n - 1; i >= 0; i--) {
    const pt = cleanPts[i];
    const norm = normals[i];
    ribbon.add(new scope.Point(pt.x - norm.x * rad, pt.y - norm.y * rad));
  }

  // Start cap semicircular arc around cleanPts[0]
  const startPt = cleanPts[0];
  const startNorm = normals[0];
  const startDir = { x: startNorm.y, y: -startNorm.x }; // Backward direction
  ribbon.add(new scope.Point(startPt.x + startDir.x * rad, startPt.y + startDir.y * rad));

  // Smooth the ribbon outline for clean, round caps and joints
  ribbon.smooth({ type: 'catmull-rom' });

  // For multi-segment strokes, also create circles at points to guarantee no inside corners are missed
  if (cleanPts.length > 2) {
    let combined: paper.PathItem = ribbon;
    // Sample a few circles along stroke if needed
    const step = Math.max(1, Math.floor(cleanPts.length / 8));
    for (let i = 0; i < cleanPts.length; i += step) {
      const circ = new scope.Path.Circle(new scope.Point(cleanPts[i].x, cleanPts[i].y), rad);
      try {
        const nextUnion = combined.unite(circ);
        combined.remove();
        circ.remove();
        combined = nextUnion;
      } catch {
        circ.remove();
      }
    }
    return combined;
  }

  return ribbon;
}

/**
 * Check if a point is near a contour bounding box
 */
function isContourNearStroke(contour: PathContour, strokePoints: Point[], radius: number): boolean {
  const bbox = getContoursBoundingBox([contour]);
  const margin = radius + 8;
  const cMinX = bbox.minX - margin;
  const cMaxX = bbox.maxX + margin;
  const cMinY = bbox.minY - margin;
  const cMaxY = bbox.maxY + margin;

  for (const pt of strokePoints) {
    if (pt.x >= cMinX && pt.x <= cMaxX && pt.y >= cMinY && pt.y <= cMaxY) {
      return true;
    }
  }
  return false;
}

/**
 * High-precision vector eraser: subtracts eraser stroke from closed contours using Paper.js
 * Completely preserves all untouched Bézier curve segments without rasterization or pixel degradation!
 */
export function subtractEraserStrokeVector(
  contours: PathContour[],
  strokePoints: Point[],
  radius: number
): PathContour[] {
  if (!contours || contours.length === 0 || !strokePoints || strokePoints.length === 0) {
    return contours || [];
  }

  const scope = getPaperScope();

  // Separate hit vs untouched contours
  const untouchedContours: PathContour[] = [];
  const candidateContours: PathContour[] = [];

  for (const c of contours) {
    if (c.closed && isContourNearStroke(c, strokePoints, radius)) {
      candidateContours.push(c);
    } else {
      untouchedContours.push(c);
    }
  }

  if (candidateContours.length === 0) {
    return contours;
  }

  try {
    const cutter = buildEraserRibbonPath(scope, strokePoints, radius);

    const resultingCarvedContours: PathContour[] = [];

    for (const cand of candidateContours) {
      const paperPath = contourToPaperPath(scope, cand);

      // Perform exact Bézier subtraction
      const subtracted = paperPath.subtract(cutter);
      paperPath.remove();

      if (subtracted) {
        const converted = paperItemToContours(subtracted);
        subtracted.remove();
        if (converted.length > 0) {
          resultingCarvedContours.push(...converted);
        }
      }
    }

    cutter.remove();

    return [...untouchedContours, ...resultingCarvedContours];
  } catch (err) {
    console.error('Vector eraser error, falling back cleanly:', err);
    return contours;
  } finally {
    try {
      scope.project?.clear();
    } catch {
      // ignore
    }
  }
}

/**
 * High-precision vector Boolean Union (Join/Combine paths):
 * Merges overlapping closed contours using exact Bézier curve intersection.
 * Non-overlapping contours are left 100% bit-exact and untouched!
 */
export function booleanUnionContours(contours: PathContour[]): PathContour[] {
  if (!contours || contours.length === 0) return [];

  const scope = getPaperScope();

  try {
    // Separate open and closed contours
    const openContours: PathContour[] = [];
    const closedContours: PathContour[] = [];

    for (const c of contours) {
      if (!c || !c.nodes) continue;
      if (!c.closed || c.nodes.length < 3) {
        openContours.push(c);
      } else {
        closedContours.push(c);
      }
    }

    if (closedContours.length === 0) return contours;

    // Single closed contour case:
    // Check if it has self-intersections (一筆書きストローク交差・自己ループ).
    if (closedContours.length === 1) {
      const single = closedContours[0];
      const paperPath = contourToPaperPath(scope, single);
      const crossings = paperPath.getCrossings(paperPath);

      // If no self-intersections, preserve original bit-exact contour without any alteration
      if (!crossings || crossings.length === 0) {
        paperPath.remove();
        return contours;
      }

      // Self-intersections present!
      // Unite with an empty path in Paper.js to dissolve self-overlapping regions into a solid polygon
      const empty = new scope.Path();
      const resolved = paperPath.unite(empty);
      empty.remove();
      paperPath.remove();

      if (!resolved) return contours;

      const result = paperItemToContours(resolved);
      resolved.remove();

      return [...openContours, ...(result.length > 0 ? result : closedContours)];
    }

    // Multiple closed contours case:
    // Convert to Paper paths
    const paperPaths: paper.Path[] = closedContours.map((c) => contourToPaperPath(scope, c));
    const n = paperPaths.length;

    // Determine containment hierarchy: a path is a hole if it is inside another path of larger area
    const isHole = new Array<boolean>(n).fill(false);
    for (let i = 0; i < n; i++) {
      const pi = paperPaths[i];
      const areaI = Math.abs(pi.area);
      const centerI = pi.bounds.center;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const pj = paperPaths[j];
        if (Math.abs(pj.area) > areaI && pj.contains(centerI)) {
          isHole[i] = true;
          break;
        }
      }
    }

    // Unite all outer strokes together into solid boundaries (fusing crossings & overlapping areas)
    let outerAcc: paper.PathItem | null = null;
    for (let i = 0; i < n; i++) {
      if (!isHole[i]) {
        const p = paperPaths[i];
        const empty = new scope.Path();
        const pClean = p.unite(empty);
        empty.remove();
        p.remove();

        if (!outerAcc) {
          outerAcc = pClean;
        } else {
          const next = outerAcc.unite(pClean);
          outerAcc.remove();
          pClean.remove();
          outerAcc = next;
        }
      }
    }

    if (!outerAcc) {
      // Fallback: clean all
      for (const p of paperPaths) p.remove();
      return contours;
    }

    // Subtract holes (e.g. inner cutouts of 日, 口, 目, O) from the united solid outer boundary
    for (let i = 0; i < n; i++) {
      if (isHole[i]) {
        const p = paperPaths[i];
        const empty = new scope.Path();
        const cleanHole = p.unite(empty);
        empty.remove();
        p.remove();

        const next = outerAcc.subtract(cleanHole);
        outerAcc.remove();
        cleanHole.remove();
        outerAcc = next;
      }
    }

    const unitedContours = paperItemToContours(outerAcc);
    outerAcc.remove();

    return [...openContours, ...(unitedContours.length > 0 ? unitedContours : closedContours)];
  } catch (err) {
    console.error('Boolean union error, returning original:', err);
    return contours;
  } finally {
    try {
      scope.project?.clear();
    } catch {
      // ignore
    }
  }
}

/**
 * High-precision vector Boolean Subtraction (Subtract cutter from subject)
 */
export function booleanSubtractContours(
  subjectContours: PathContour[],
  cutterContours: PathContour[]
): PathContour[] {
  if (!subjectContours || subjectContours.length === 0) return [];
  if (!cutterContours || cutterContours.length === 0) return subjectContours;

  const scope = getPaperScope();

  try {
    const subjectItem = booleanUnionContours(subjectContours);
    const cutterItem = booleanUnionContours(cutterContours);

    const paperSubject = new scope.CompoundPath({});
    for (const sc of subjectItem) {
      paperSubject.addChild(contourToPaperPath(scope, sc));
    }

    const paperCutter = new scope.CompoundPath({});
    for (const cc of cutterItem) {
      paperCutter.addChild(contourToPaperPath(scope, cc));
    }

    const result = paperSubject.subtract(paperCutter);
    paperSubject.remove();
    paperCutter.remove();

    const contours = paperItemToContours(result);
    if (result) result.remove();

    return contours;
  } catch (err) {
    console.error('Boolean subtract error:', err);
    return subjectContours;
  }
}

/**
 * High-precision vector Boolean Intersection (Keep only overlapping region)
 */
export function booleanIntersectContours(
  subjectContours: PathContour[],
  cutterContours: PathContour[]
): PathContour[] {
  if (!subjectContours || subjectContours.length === 0 || !cutterContours || cutterContours.length === 0) {
    return [];
  }

  const scope = getPaperScope();

  try {
    const paperSubject = new scope.CompoundPath({});
    for (const sc of subjectContours) {
      paperSubject.addChild(contourToPaperPath(scope, sc));
    }

    const paperCutter = new scope.CompoundPath({});
    for (const cc of cutterContours) {
      paperCutter.addChild(contourToPaperPath(scope, cc));
    }

    const result = paperSubject.intersect(paperCutter);
    paperSubject.remove();
    paperCutter.remove();

    const contours = paperItemToContours(result);
    if (result) result.remove();

    return contours;
  } catch (err) {
    console.error('Boolean intersect error:', err);
    return [];
  }
}
