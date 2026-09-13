import React from 'react';

interface MainGlyphContoursLayerProps {
  mainSvgPath: string;
  isLight: boolean;
}

export const MainGlyphContoursLayer: React.FC<MainGlyphContoursLayerProps> = React.memo(
  ({ mainSvgPath, isLight }) => {
    if (!mainSvgPath) return null;

    return (
      <path
        id="main-glyph-contours-path"
        d={mainSvgPath}
        fill={isLight ? '#1f2937' : '#ecfdf5'}
        fillRule="evenodd"
        stroke={isLight ? '#065f46' : '#34d399'}
        strokeWidth={1.5}
      />
    );
  }
);

