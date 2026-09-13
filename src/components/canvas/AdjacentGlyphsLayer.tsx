import React from 'react';

interface AdjacentGlyphsLayerProps {
  isLight: boolean;
  advanceWidth: number;
}

export const AdjacentGlyphsLayer: React.FC<AdjacentGlyphsLayerProps> = React.memo(
  ({ isLight, advanceWidth }) => {
    return (
      <g className="adjacent-glyphs-layer pointer-events-none opacity-20 select-none">
        {/* Previous Glyph Box (-1000 to 0) */}
        <rect
          x={-1000}
          y={0}
          width={1000}
          height={1000}
          fill="none"
          stroke={isLight ? '#065f46' : '#2d4034'}
          strokeWidth={1.5}
          strokeDasharray="6 6"
        />
        <text
          x={-500}
          y={500}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={isLight ? '#065f46' : '#34d399'}
          fontSize="28"
          fontFamily="sans-serif"
          letterSpacing="2"
        >
          前文字領域 (Previous)
        </text>

        {/* Next Glyph Box (advanceWidth to advanceWidth + 1000) */}
        <rect
          x={advanceWidth}
          y={0}
          width={1000}
          height={1000}
          fill="none"
          stroke={isLight ? '#065f46' : '#2d4034'}
          strokeWidth={1.5}
          strokeDasharray="6 6"
        />
        <text
          x={advanceWidth + 500}
          y={500}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={isLight ? '#065f46' : '#34d399'}
          fontSize="28"
          fontFamily="sans-serif"
          letterSpacing="2"
        >
          次文字領域 (Next)
        </text>
      </g>
    );
  }
);
