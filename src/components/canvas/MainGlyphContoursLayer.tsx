import React from 'react';
import { ThemeMode } from '../../utils/theme';

interface MainGlyphContoursLayerProps {
  mainSvgPath: string;
  isLight: boolean;
  theme?: ThemeMode;
}

export const MainGlyphContoursLayer: React.FC<MainGlyphContoursLayerProps> = React.memo(
  ({ mainSvgPath, isLight, theme = 'light' }) => {
    if (!mainSvgPath) return null;

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

    return (
      <path
        id="main-glyph-contours-path"
        d={mainSvgPath}
        fill={fillColor}
        fillRule="evenodd"
        stroke={strokeColor}
        strokeWidth={1.5}
      />
    );
  }
);
