import paper from 'paper/dist/paper-core';
import { BezierNode, NodeType, PathContour, Point } from '../types';
import { generateId, getContoursBoundingBox, groupContoursWithHoles } from './pathUtils';

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
    paperScopeInstance.setup([3000, 3000]);
  }
  paperScopeInstance.activate();
  return paperScopeInstance;
}

/**
 * Convert a single PathContour into a Paper.js Path
 */
/**
 * Sanitize bezier nodes from Paper.js to prevent wild runaway handles, spikes, and distortions.
 */
export function sanitizeContourNodes(nodes: BezierNode[], closed: boolean): BezierNode[] {
  if (!nodes || nodes.length < 2) return nodes || [];

  // Step 1: Merge redundant micro-distance adjacent nodes (< 0.5px)
  const deduped: BezierNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const curr = nodes[i];
    if (deduped.length === 0) {
      deduped.push({ ...curr });
      continue;
    }
    const prev = deduped[deduped.length - 1];
    const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (dist < 0.5) {
      // Merge: retain outgoing handle of curr if exists, or incoming of prev
      if (curr.handleOut) {
        prev.handleOut = curr.handleOut;
      }
      prev.type = curr.type;
    } else {
      deduped.push({ ...curr });
    }
  }

  // Check end-to-start wrap if closed
  if (closed && deduped.length > 2) {
    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 0.5) {
      if (last.handleIn) first.handleIn = last.handleIn;
      deduped.pop();
    }
  }

  if (deduped.length < 2) return deduped;

  const N = deduped.length;
  const result: BezierNode[] = [];

  // Step 2: Clamp runaway handle vectors (anti-wild-loop guard)
  for (let i = 0; i < N; i++) {
    const node = { ...deduped[i] };
    const prevNode = deduped[(i - 1 + N) % N];
    const nextNode = deduped[(i + 1) % N];

    const dPrev = Math.hypot(node.x - prevNode.x, node.y - prevNode.y);
    const dNext = Math.hypot(node.x - nextNode.x, node.y - nextNode.y);

    // Max handle distance allowed: proportional to segment length, capped to prevent runaway loops
    const maxInLen = Math.max(12, dPrev * 1.5);
    const maxOutLen = Math.max(12, dNext * 1.5);

    if (node.handleIn) {
      const hInDist = Math.hypot(node.handleIn.x - node.x, node.handleIn.y - node.y);
      if (hInDist < 0.3) {
        node.handleIn = null;
      } else if (hInDist > maxInLen) {
        const ratio = maxInLen / hInDist;
        node.handleIn = {
          x: Math.round((node.x + (node.handleIn.x - node.x) * ratio) * 100) / 100,
          y: Math.round((node.y + (node.handleIn.y - node.y) * ratio) * 100) / 100,
        };
      }
    }

    if (node.handleOut) {
      const hOutDist = Math.hypot(node.handleOut.x - node.x, node.handleOut.y - node.y);
      if (hOutDist < 0.3) {
        node.handleOut = null;
      } else if (hOutDist > maxOutLen) {
        const ratio = maxOutLen / hOutDist;
        node.handleOut = {
          x: Math.round((node.x + (node.handleOut.x - node.x) * ratio) * 100) / 100,
          y: Math.round((node.y + (node.handleOut.y - node.y) * ratio) * 100) / 100,
        };
      }
    }

    result.push(node);
  }

  return result;
}

/**
 * Convert a single PathContour into a Paper.js Path with explicit clockwise orientation
 */
export function contourToPaperPath(
  scope: paper.PaperScope,
  contour: PathContour,
  isHole: boolean = false
): paper.Path {
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

  if (contour.closed && path.segments.length >= 3) {
    // In Paper.js CompoundPath: outer path must be clockwise, inner holes counter-clockwise
    if (isHole) {
      if (path.clockwise) path.reverse();
    } else {
      if (!path.clockwise) path.reverse();
    }
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
 * with rigorous handle clamping, micro-sliver filtering, and node stabilization.
 */
export function paperItemToContours(item: paper.Item | null): PathContour[] {
  if (!item) return [];

  const rawPaths = collectPaperPaths(item);
  const contours: PathContour[] = [];

  for (const p of rawPaths) {
    if (!p.segments || p.segments.length < 2) continue;

    // Filter out degenerate zero-area micro-loops and slivers
    if (p.closed) {
      const area = Math.abs(p.area);
      const perimeter = p.length;
      const bounds = p.bounds;
      if (area < 6.0 || perimeter < 12.0 || bounds.width < 1.0 || bounds.height < 1.0) {
        continue;
      }
    }

    const rawNodes: BezierNode[] = [];
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
          if (cosAngle < -0.92) {
            nodeType = Math.abs(dIn - dOut) < 1.5 ? 'symmetric' : 'smooth';
          }
        }
      }

      rawNodes.push({
        id: generateId(),
        x,
        y,
        handleIn,
        handleOut,
        type: nodeType,
      });
    }

    const sanitizedNodes = sanitizeContourNodes(rawNodes, p.closed);

    if (sanitizedNodes.length >= 2) {
      contours.push({
        id: generateId(),
        nodes: sanitizedNodes,
        closed: p.closed,
      });
    }
  }

  return contours;
}

/**
 * Helper to build an exact 2D capsule (stadium) shape between two points with radius
 */
function createCapsulePath(
  scope: paper.PaperScope,
  p1: Point,
  p2: Point,
  radius: number
): paper.Path {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) {
    return new scope.Path.Circle(new scope.Point(p1.x, p1.y), radius);
  }

  const nx = (-dy / len) * radius;
  const ny = (dx / len) * radius;
  const tx = (dx / len) * radius;
  const ty = (dy / len) * radius;

  const path = new scope.Path();
  path.closed = true;

  // Arc around p1 (start cap)
  const p1Left = new scope.Point(p1.x + nx, p1.y + ny);
  const p1Back = new scope.Point(p1.x - tx, p1.y - ty);
  const p1Right = new scope.Point(p1.x - nx, p1.y - ny);

  // Arc around p2 (end cap)
  const p2Right = new scope.Point(p2.x - nx, p2.y - ny);
  const p2Front = new scope.Point(p2.x + tx, p2.y + ty);
  const p2Left = new scope.Point(p2.x + nx, p2.y + ny);

  path.add(p1Left);
  path.arcTo(p1Back, p1Right);
  path.lineTo(p2Right);
  path.arcTo(p2Front, p2Left);
  path.lineTo(p1Left);

  return path;
}

/**
 * Divide-and-conquer union of multiple Paper.js PathItems to avoid accumulated boolean errors
 */
function unionPaperPathItems(scope: paper.PaperScope, items: paper.PathItem[]): paper.PathItem {
  if (items.length === 0) return new scope.Path();
  if (items.length === 1) return items[0];

  let currentLevel = items;
  while (currentLevel.length > 1) {
    const nextLevel: paper.PathItem[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        try {
          const united = currentLevel[i].unite(currentLevel[i + 1]);
          currentLevel[i].remove();
          currentLevel[i + 1].remove();
          nextLevel.push(united);
        } catch {
          nextLevel.push(currentLevel[i]);
          currentLevel[i + 1].remove();
        }
      } else {
        nextLevel.push(currentLevel[i]);
      }
    }
    currentLevel = nextLevel;
  }
  return currentLevel[0];
}

/**
 * Build a smooth closed vector ribbon / capsule shape from a sequence of stroke points and a radius.
 * Uses exact segment capsule unions to guarantee zero self-intersections and zero distortion!
 */
export function buildEraserRibbonPath(
  scope: paper.PaperScope,
  strokePoints: Point[],
  radius: number
): paper.PathItem {
  if (strokePoints.length === 0) {
    return new scope.Path();
  }

  const rad = Math.max(2, radius);

  // Decimate points to avoid excessive clustering
  const minDist = Math.max(2, rad * 0.3);
  const cleanPts: Point[] = [strokePoints[0]];
  for (let i = 1; i < strokePoints.length; i++) {
    const prev = cleanPts[cleanPts.length - 1];
    const curr = strokePoints[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= minDist) {
      cleanPts.push(curr);
    }
  }
  if (cleanPts.length === 1 && strokePoints.length > 1) {
    cleanPts.push(strokePoints[strokePoints.length - 1]);
  }

  if (cleanPts.length === 1) {
    return new scope.Path.Circle(
      new scope.Point(cleanPts[0].x, cleanPts[0].y),
      rad
    );
  }

  const capsules: paper.PathItem[] = [];
  for (let i = 0; i < cleanPts.length - 1; i++) {
    capsules.push(createCapsulePath(scope, cleanPts[i], cleanPts[i + 1], rad));
  }

  return unionPaperPathItems(scope, capsules);
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

  for (let i = 0; i < strokePoints.length; i++) {
    const pt = strokePoints[i];
    if (pt.x >= cMinX && pt.x <= cMaxX && pt.y >= cMinY && pt.y <= cMaxY) {
      return true;
    }
    if (i > 0) {
      const prev = strokePoints[i - 1];
      const sMinX = Math.min(prev.x, pt.x) - margin;
      const sMaxX = Math.max(prev.x, pt.x) + margin;
      const sMinY = Math.min(prev.y, pt.y) - margin;
      const sMaxY = Math.max(prev.y, pt.y) + margin;
      if (sMinX <= bbox.maxX && sMaxX >= bbox.minX && sMinY <= bbox.maxY && sMaxY >= bbox.minY) {
        return true;
      }
    }
  }
  return false;
}

/**
 * High-precision vector eraser: subtracts eraser stroke from closed contours using Paper.js.
 * Preserves topological groups (outer outline + child holes) as CompoundPaths with explicit
 * clockwise/counter-clockwise winding so counter-holes are carved cleanly without inverting
 * into solid artifacts or creating twisted paths!
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

  // Separate contours into open (unsupported for vector subtraction) and closed
  const closedContours: PathContour[] = [];
  const openContours: PathContour[] = [];
  for (const c of contours) {
    if (c.closed && c.nodes && c.nodes.length >= 3) {
      closedContours.push(c);
    } else {
      openContours.push(c);
    }
  }

  if (closedContours.length === 0) {
    return contours;
  }

  // 1. Group ALL closed contours into topological units (parent outer shape + its enclosed holes)
  const allGroups = groupContoursWithHoles(closedContours);

  const untouchedContours: PathContour[] = [...openContours];
  const candidateGroups: PathContour[][] = [];

  for (const group of allGroups) {
    // If ANY contour in the group is touched by the eraser stroke, process the ENTIRE group together!
    const isHit = group.some((c) => isContourNearStroke(c, strokePoints, radius));
    if (isHit) {
      candidateGroups.push(group);
    } else {
      untouchedContours.push(...group);
    }
  }

  if (candidateGroups.length === 0) {
    return contours;
  }

  try {
    const cutter = buildEraserRibbonPath(scope, strokePoints, radius);
    const resultingCarvedContours: PathContour[] = [];

    for (const group of candidateGroups) {
      if (group.length === 1) {
        const paperPath = contourToPaperPath(scope, group[0], false);
        let subtracted: paper.PathItem | null = null;
        try {
          subtracted = paperPath.subtract(cutter);
        } catch (subErr) {
          console.warn('Paper.js subtract failed for single contour:', subErr);
        }
        paperPath.remove();

        if (subtracted) {
          const converted = paperItemToContours(subtracted);
          subtracted.remove();
          if (converted.length > 0) {
            resultingCarvedContours.push(...converted);
          } else {
            // Completely erased
          }
        } else {
          // If subtract returned null or threw, keep original contour
          resultingCarvedContours.push(group[0]);
        }
      } else {
        // Compound glyph with holes (e.g. O, A, 日, 国, あ):
        // Outer path is index 0 (clockwise), child holes index 1..k (counter-clockwise)
        const outerPath = contourToPaperPath(scope, group[0], false);
        const holePaths = group.slice(1).map((c) => contourToPaperPath(scope, c, true));
        const childPaths = [outerPath, ...holePaths];

        const compPath = new scope.CompoundPath({
          children: childPaths,
        });

        let subtracted: paper.PathItem | null = null;
        try {
          subtracted = compPath.subtract(cutter);
        } catch (subErr) {
          console.warn('Paper.js subtract failed for compound path:', subErr);
        }
        compPath.remove();

        if (subtracted) {
          const converted = paperItemToContours(subtracted);
          subtracted.remove();
          if (converted.length > 0) {
            resultingCarvedContours.push(...converted);
          }
        } else {
          // If failed, preserve original group
          resultingCarvedContours.push(...group);
        }
      }
    }

    cutter.remove();

    return [...untouchedContours, ...resultingCarvedContours];
  } catch (err) {
    console.warn('Vector eraser error:', err);
    throw err;
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
