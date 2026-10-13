import React, { useMemo } from 'react';
import { PathContour } from '../types';
import { groupContoursForRendering } from '../utils/pathUtils';

export interface GlyphPreviewSvgProps {
  contours: PathContour[] | undefined | null;
  unitsPerEm?: number;
  className?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number | string;
  style?: React.CSSProperties;
}

/**
 * Robust vector glyph renderer that avoids the common SVG "evenodd white cutout" bug
 * on overlapping/intersecting strokes while correctly maintaining transparency for
 * character counter-holes (日, 口, 目, O, あ, etc.).
 */
export const GlyphPreviewSvg: React.FC<GlyphPreviewSvgProps> = ({
  contours,
  unitsPerEm = 1000,
  className = 'w-full h-full',
  fill = 'currentColor',
  stroke,
  strokeWidth,
  opacity,
  style,
}) => {
  const groups = useMemo(() => {
    if (!contours || contours.length === 0) return [];
    return groupContoursForRendering(contours);
  }, [contours]);

  if (!groups || groups.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${unitsPerEm} ${unitsPerEm}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={style}
    >
      {groups.map((group) => (
        <path
          key={group.id}
          d={group.d}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fillRule={group.fillRule}
          opacity={opacity}
        />
      ))}
    </svg>
  );
};
