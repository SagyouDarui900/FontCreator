import React, { useMemo } from 'react';
import { GlyphOverlaySettings, FontProject, GlyphData } from '../../types';
import { contoursToSvgPath } from '../../utils/pathUtils';

interface GlyphComparisonLayerProps {
  overlaySettings?: GlyphOverlaySettings;
  project?: FontProject;
  isLight: boolean;
  activeChar?: string;
  activeUnicode?: number;
}

export const GlyphComparisonLayer: React.FC<GlyphComparisonLayerProps> = React.memo(
  ({ overlaySettings, project, isLight, activeChar, activeUnicode }) => {
    if (!overlaySettings?.enabled || !project) return null;

    // Find reference glyph data
    const refGlyph: GlyphData | undefined = useMemo(() => {
      if (!project?.glyphs) return undefined;

      if (overlaySettings.referenceUnicode != null) {
        return project.glyphs[overlaySettings.referenceUnicode];
      }

      if (overlaySettings.referenceChar) {
        const u = overlaySettings.referenceChar.charCodeAt(0);
        if (project.glyphs[u]) return project.glyphs[u];
        // Search through all glyphs
        const glyphList = Object.values(project.glyphs) as GlyphData[];
        return glyphList.find((g) => g && g.char === overlaySettings.referenceChar);
      }

      return undefined;
    }, [project, overlaySettings.referenceUnicode, overlaySettings.referenceChar]);

    const pathData = useMemo(() => {
      if (!refGlyph || !refGlyph.contours || refGlyph.contours.length === 0) {
        return null;
      }
      return contoursToSvgPath(refGlyph.contours);
    }, [refGlyph]);

    if (!refGlyph || !pathData) return null;

    const opacity = overlaySettings.opacity ?? 0.45;
    const color = overlaySettings.color || (isLight ? '#0284c7' : '#38bdf8');
    const scale = overlaySettings.scale ?? 1;
    const offsetX = overlaySettings.offsetX ?? 0;
    const offsetY = overlaySettings.offsetY ?? 0;
    const renderMode = overlaySettings.renderMode || 'outline';

    const transform = `translate(${offsetX}, ${offsetY}) translate(500, 500) scale(${scale}) translate(-500, -500)`;

    return (
      <g
        className="glyph-comparison-layer pointer-events-none select-none"
        opacity={opacity}
        transform={transform}
      >
        {/* Reference Glyph Metrics (Ghost guide lines) */}
        {overlaySettings.showMetrics && refGlyph.advanceWidth && (
          <g opacity={0.6} className="font-mono text-[10px]">
            <line
              x1={refGlyph.lsb || 0}
              y1={-20}
              x2={refGlyph.lsb || 0}
              y2={1020}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <line
              x1={refGlyph.advanceWidth}
              y1={-20}
              x2={refGlyph.advanceWidth}
              y2={1020}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <text x={refGlyph.lsb + 4} y={-8} fill={color}>
              比較LSB: {refGlyph.lsb}
            </text>
            <text x={refGlyph.advanceWidth - 80} y={-8} fill={color}>
              比較幅: {refGlyph.advanceWidth}
            </text>
          </g>
        )}

        {/* Outline Mode */}
        {renderMode === 'outline' && (
          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeDasharray="4 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Fill Mode */}
        {renderMode === 'fill' && (
          <path
            d={pathData}
            fill={color}
            fillRule="evenodd"
            stroke={color}
            strokeWidth={1}
            opacity={0.8}
          />
        )}

        {/* Difference Mode (Fill + Solid Accent Outline) */}
        {renderMode === 'difference' && (
          <g>
            <path
              d={pathData}
              fill={color}
              fillRule="evenodd"
              opacity={0.35}
            />
            <path
              d={pathData}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </g>
        )}

        {/* Reference character floating watermark tag */}
        <g transform="translate(30, 70)" opacity={0.85}>
          <rect
            x={-6}
            y={-14}
            width={64}
            height={20}
            rx={4}
            fill={isLight ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'}
            stroke={color}
            strokeWidth={1}
          />
          <text
            x={26}
            y={0}
            textAnchor="middle"
            fill={color}
            fontSize="10"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            比較: {refGlyph.char || `U+${refGlyph.unicode.toString(16).toUpperCase()}`}
          </text>
        </g>
      </g>
    );
  }
);
