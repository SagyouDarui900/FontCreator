import React, { useMemo } from 'react';
import { ThemeMode } from '../../utils/theme';
import { PathContour } from '../../types';
import { contoursToSvgPath, getContoursBoundingBox } from '../../utils/pathUtils';

interface RenderGroup {
  id: string;
  d: string;
  fillRule: 'nonzero' | 'evenodd';
}

interface MainGlyphContoursLayerProps {
  contours?: PathContour[];
  mainSvgPath?: string;
  isLight: boolean;
  theme?: ThemeMode;
  outlineOnly?: boolean;
}

export function groupContoursForRendering(contours: PathContour[]): RenderGroup[] {
  if (!contours || contours.length === 0) return [];

  if (contours.length === 1) {
    return [
      {
        id: contours[0].id,
        d: contoursToSvgPath(contours),
        fillRule: 'nonzero',
      },
    ];
  }

  const bboxes = contours.map((c) => getContoursBoundingBox([c]));
  const parentMap = new Map<number, number>();

  for (let i = 0; i < contours.length; i++) {
    const b1 = bboxes[i];
    if (b1.width === 0 || b1.height === 0) continue;

    for (let j = 0; j < contours.length; j++) {
      if (i === j) continue;
      const b2 = bboxes[j];
      if (
        b1.minX >= b2.minX - 2 &&
        b1.maxX <= b2.maxX + 2 &&
        b1.minY >= b2.minY - 2 &&
        b1.maxY <= b2.maxY + 2 &&
        b2.maxX - b2.minX > b1.maxX - b1.minX &&
        b2.maxY - b2.minY > b1.maxY - b1.minY
      ) {
        parentMap.set(i, j);
        break;
      }
    }
  }

  const groups: PathContour[][] = [];
  const processed = new Set<number>();

  for (let i = 0; i < contours.length; i++) {
    if (processed.has(i)) continue;
    processed.add(i);

    const currentGroup = [contours[i]];
    for (let j = 0; j < contours.length; j++) {
      if (!processed.has(j) && parentMap.get(j) === i) {
        processed.add(j);
        currentGroup.push(contours[j]);
      }
    }
    groups.push(currentGroup);
  }

  return groups.map((group, idx) => ({
    id: group.map((c) => c.id).join('-') || `group-${idx}`,
    d: contoursToSvgPath(group),
    fillRule: group.length > 1 ? 'evenodd' : 'nonzero',
  }));
}

export const MainGlyphContoursLayer: React.FC<MainGlyphContoursLayerProps> = React.memo(
  ({ contours, mainSvgPath, isLight, theme = 'light', outlineOnly = false }) => {
    const renderGroups = useMemo(() => {
      if (contours !== undefined) {
        if (!contours || contours.length === 0) return [];
        return groupContoursForRendering(contours);
      }
      if (mainSvgPath) {
        return [{ id: 'main-fallback', d: mainSvgPath, fillRule: 'nonzero' as const }];
      }
      return [];
    }, [contours, mainSvgPath]);

    if (renderGroups.length === 0 && (!contours || contours.length === 0)) return null;

    const fillColor =
      theme === 'sepia'
        ? '#2d2217'
        : theme === 'warm'
        ? '#292019'
        : theme === 'nord'
        ? '#eceff4'
        : theme === 'monochrome'
        ? '#000000'
        : isLight
        ? '#1f2937'
        : '#ecfdf5';

    const strokeColor =
      theme === 'sepia'
        ? '#8c673b'
        : theme === 'warm'
        ? '#ea580c'
        : theme === 'nord'
        ? '#88c0d0'
        : theme === 'monochrome'
        ? '#000000'
        : isLight
        ? '#065f46'
        : '#34d399';

    const outlineStrokeColor =
      theme === 'sepia'
        ? (isLight ? '#78350f' : '#fbbf24')
        : theme === 'warm'
        ? (isLight ? '#c2410c' : '#fb923c')
        : theme === 'nord'
        ? (isLight ? '#5e81ac' : '#88c0d0')
        : theme === 'monochrome'
        ? (isLight ? '#0f172a' : '#f8fafc')
        : isLight
        ? '#0284c7'
        : '#38bdf8';

    // Outline stroke width is fixed at a crisp 1.5px on screen using non-scaling-stroke so zoom does not distort thickness
    const outlineStrokeWidth = 1.5;

    // When Outline Mode (輪郭のみモード) is active, remove fills entirely and stroke every contour outline
    if (outlineOnly) {
      return (
        <g id="main-glyph-contours-layer" className="transition-opacity duration-150">
          {contours && contours.length > 0 ? (
            contours.map((contour, idx) => {
              const d = contoursToSvgPath([contour]);
              if (!d) return null;
              return (
                <path
                  key={`outline-contour-${contour.id || idx}`}
                  d={d}
                  fill="none"
                  stroke={outlineStrokeColor}
                  strokeWidth={outlineStrokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })
          ) : (
            renderGroups.map((group) => (
              <path
                key={`glyph-path-group-${group.id}`}
                d={group.d}
                fill="none"
                stroke={outlineStrokeColor}
                strokeWidth={outlineStrokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))
          )}
        </g>
      );
    }

    return (
      <g id="main-glyph-contours-layer">
        {renderGroups.map((group) => (
          <path
            key={`glyph-path-group-${group.id}`}
            d={group.d}
            fill={fillColor}
            fillRule={group.fillRule}
            stroke={strokeColor}
            strokeWidth={1.5}
          />
        ))}
      </g>
    );
  }
);

