import React from 'react';

interface AdjacentGlyphsLayerProps {
  isLight: boolean;
  advanceWidth: number;
  unitsPerEm?: number;
}

export const AdjacentGlyphsLayer: React.FC<AdjacentGlyphsLayerProps> = React.memo(
  ({ isLight, advanceWidth, unitsPerEm = 1000 }) => {
    const upm = unitsPerEm || 1000;

    return (
      <g className="adjacent-glyphs-layer pointer-events-none opacity-20 select-none">
        {/* Previous Glyph Box (-upm to 0) */}
        <rect
          x={-upm}
          y={0}
          width={upm}
          height={upm}
          fill="none"
          stroke={isLight ? '#065f46' : '#2d4034'}
          strokeWidth={1.5}
          strokeDasharray="6 6"
        />
        <text
          x={-upm / 2}
          y={upm / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={isLight ? '#065f46' : '#34d399'}
          fontSize="24"
          fontFamily="sans-serif"
          letterSpacing="2"
        >
          前文字領域
        </text>

        {/* Next Glyph Box (advanceWidth to advanceWidth + upm) */}
        <rect
          x={advanceWidth}
          y={0}
          width={upm}
          height={upm}
          fill="none"
          stroke={isLight ? '#065f46' : '#2d4034'}
          strokeWidth={1.5}
          strokeDasharray="6 6"
        />
        <text
          x={advanceWidth + upm / 2}
          y={upm / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={isLight ? '#065f46' : '#34d399'}
          fontSize="24"
          fontFamily="sans-serif"
          letterSpacing="2"
        >
          次文字領域
        </text>
      </g>
    );
  }
);
