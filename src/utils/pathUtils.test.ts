import { describe, it, expect } from 'vitest';
import {
  generateId,
  getContoursBoundingBox,
  createRectContour,
  createCircleContour,
  flipContoursHorizontal,
  flipContoursVertical,
  scaleContours,
  simplifyContour,
} from './pathUtils';
import { PathContour } from '../types';

describe('pathUtils - Vector Path and Geometry Engine', () => {
  describe('generateId', () => {
    it('generates non-empty string IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(4);
      expect(id1).not.toBe(id2);
    });

    it('generates unique IDs in sequence without collisions', () => {
      const set = new Set<string>();
      for (let i = 0; i < 100; i++) {
        set.add(generateId());
      }
      expect(set.size).toBe(100);
    });
  });

  describe('createRectContour', () => {
    it('creates a closed 4-node rectangular contour matching coordinates', () => {
      const rect = createRectContour(100, 200, 500, 600);
      expect(rect.closed).toBe(true);
      expect(rect.nodes.length).toBe(4);

      // Verify corner points exist
      const xs = rect.nodes.map((n) => n.x);
      const ys = rect.nodes.map((n) => n.y);
      expect(Math.min(...xs)).toBe(100);
      expect(Math.max(...xs)).toBe(500);
      expect(Math.min(...ys)).toBe(200);
      expect(Math.max(...ys)).toBe(600);
    });
  });

  describe('createCircleContour', () => {
    it('creates a smooth 4-node Bezier circle contour with control handles', () => {
      const circle = createCircleContour(500, 500, 200);
      expect(circle.closed).toBe(true);
      expect(circle.nodes.length).toBe(4);

      // Verify nodes have Bezier handles
      circle.nodes.forEach((n) => {
        expect(n.handleIn).not.toBeNull();
        expect(n.handleOut).not.toBeNull();
      });
    });
  });

  describe('getContoursBoundingBox', () => {
    it('calculates correct bounds for rectangular contour', () => {
      const rect = createRectContour(120, 150, 480, 750);
      const bbox = getContoursBoundingBox([rect]);

      expect(bbox).not.toBeNull();
      if (bbox) {
        expect(bbox.minX).toBe(120);
        expect(bbox.minY).toBe(150);
        expect(bbox.maxX).toBe(480);
        expect(bbox.maxY).toBe(750);
        expect(bbox.width).toBe(360);
        expect(bbox.height).toBe(600);
      }
    });

    it('returns null or empty fallback for empty contour array', () => {
      const bbox = getContoursBoundingBox([]);
      expect(bbox === null || (bbox.width === 0 && bbox.height === 0)).toBe(true);
    });
  });

  describe('flipContoursHorizontal and flipContoursVertical', () => {
    it('flips contour horizontally around its center', () => {
      // Triangle pointing to the left
      const triangle: PathContour = {
        id: 'tri_1',
        closed: true,
        nodes: [
          { id: 'n1', x: 100, y: 500, type: 'corner' },
          { id: 'n2', x: 400, y: 200, type: 'corner' },
          { id: 'n3', x: 400, y: 800, type: 'corner' },
        ],
      };

      const flipped = flipContoursHorizontal([triangle]);
      expect(flipped.length).toBe(1);

      // Point at x=100 should now be at x=400, and points at x=400 should now be at x=100
      const newX0 = flipped[0].nodes[0].x;
      expect(newX0).toBe(400);
    });

    it('flips contour vertically around its center', () => {
      const rect = createRectContour(200, 100, 600, 500);
      const flipped = flipContoursVertical([rect]);
      expect(flipped.length).toBe(1);
      const bbox = getContoursBoundingBox(flipped);
      expect(bbox?.minY).toBe(100);
      expect(bbox?.maxY).toBe(500);
    });
  });

  describe('scaleContours', () => {
    it('scales contour coordinates by given factor', () => {
      const rect = createRectContour(100, 100, 300, 300);
      const scaled = scaleContours([rect], 2.0);
      const bbox = getContoursBoundingBox(scaled);
      expect(bbox?.width).toBe(400); // 200 * 2.0
      expect(bbox?.height).toBe(400);
    });
  });

  describe('simplifyContour', () => {
    it('preserves essential corner topology while reducing collinear points', () => {
      // A straight line segment with unnecessary intermediate collinear points
      const collinearContour: PathContour = {
        id: 'c_test',
        closed: false,
        nodes: [
          { id: 'n1', x: 0, y: 0, type: 'corner' },
          { id: 'n2', x: 25, y: 0, type: 'corner' },
          { id: 'n3', x: 50, y: 0, type: 'corner' },
          { id: 'n4', x: 75, y: 0, type: 'corner' },
          { id: 'n5', x: 100, y: 0, type: 'corner' },
          { id: 'n6', x: 100, y: 100, type: 'corner' },
        ],
      };

      const simplified = simplifyContour(collinearContour, 5);
      expect(simplified.nodes.length).toBeLessThan(collinearContour.nodes.length);
      expect(simplified.nodes[0].x).toBe(0);
      expect(simplified.nodes[0].y).toBe(0);
      expect(simplified.nodes[simplified.nodes.length - 1].x).toBe(100);
      expect(simplified.nodes[simplified.nodes.length - 1].y).toBe(100);
    });
  });
});
