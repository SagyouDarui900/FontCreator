import React from 'react';
import { ThemeMode } from '../../utils/theme';

interface CanvasBackgroundLayerProps {
  isLight: boolean;
  theme?: ThemeMode;
  showGrid: boolean;
  gridSize: number;
  gridOpacity?: number;
  unitsPerEm?: number;
}

export const CanvasBackgroundLayer: React.FC<CanvasBackgroundLayerProps> = React.memo(
  ({ isLight, theme = 'light', showGrid, gridSize, gridOpacity = 30, unitsPerEm = 1000 }) => {
    const size = gridSize || 50;
    const upm = unitsPerEm || 1000;
    const opacityFactor = Math.min(1, Math.max(0.08, gridOpacity / 100));

    // Determine colors tailored for eye-comfort presets - subtle, non-intrusive lines
    const gridStroke =
      theme === 'sepia'
        ? 'rgba(140, 103, 59, 0.45)'
        : theme === 'warm'
        ? 'rgba(194, 65, 12, 0.4)'
        : theme === 'nord'
        ? 'rgba(94, 129, 172, 0.45)'
        : theme === 'monochrome'
        ? 'rgba(0, 0, 0, 0.25)'
        : isLight
        ? 'rgba(5, 150, 105, 0.35)'
        : 'rgba(52, 211, 153, 0.3)';

    const dimmingFill =
      theme === 'sepia'
        ? 'rgba(60, 45, 30, 0.05)'
        : theme === 'warm'
        ? 'rgba(70, 45, 20, 0.04)'
        : theme === 'nord'
        ? 'rgba(0, 0, 0, 0.25)'
        : theme === 'monochrome'
        ? 'rgba(0, 0, 0, 0.05)'
        : isLight
        ? 'rgba(15, 30, 20, 0.03)'
        : 'rgba(0, 0, 0, 0.25)';

    const emBoxFill =
      theme === 'sepia'
        ? '#faf5eb'
        : theme === 'warm'
        ? '#fffdf7'
        : theme === 'nord'
        ? '#2e3440'
        : theme === 'monochrome'
        ? '#ffffff'
        : isLight
        ? '#ffffff'
        : '#161f19';

    const emBoxStroke =
      theme === 'sepia'
        ? 'rgba(140, 103, 59, 0.4)'
        : theme === 'warm'
        ? 'rgba(194, 65, 12, 0.35)'
        : theme === 'nord'
        ? 'rgba(94, 129, 172, 0.4)'
        : theme === 'monochrome'
        ? 'rgba(24, 24, 27, 0.35)'
        : isLight
        ? 'rgba(5, 150, 105, 0.35)'
        : 'rgba(52, 211, 153, 0.3)';

    const cropMarkStroke =
      theme === 'sepia'
        ? 'rgba(161, 98, 7, 0.45)'
        : theme === 'warm'
        ? 'rgba(234, 88, 12, 0.45)'
        : theme === 'nord'
        ? 'rgba(136, 192, 208, 0.5)'
        : theme === 'monochrome'
        ? 'rgba(24, 24, 27, 0.35)'
        : isLight
        ? 'rgba(5, 150, 105, 0.4)'
        : 'rgba(16, 185, 129, 0.45)';

    return (
      <g className="canvas-background-layer pointer-events-none select-none">
        <defs>
          <pattern
            id="canvasGridPattern"
            width={size}
            height={size}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${size} 0 L 0 0 0 ${size}`}
              fill="none"
              stroke={gridStroke}
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {/* Surrounding Outer Area Dimming Frame */}
        <path
          d={`M -4000 -4000 H 5000 V 5000 H -4000 Z M 0 0 V ${upm} H ${upm} V 0 Z`}
          fill={dimmingFill}
          fillRule="evenodd"
        />

        {/* Em Square Box Background with subtle, gentle frame border */}
        <rect
          x={0}
          y={0}
          width={upm}
          height={upm}
          fill={emBoxFill}
          stroke={emBoxStroke}
          strokeWidth={1.5}
        />

        {/* Professional Font Drafting Corner Crop/Register Marks (トンボ) */}
        <g opacity={0.4}>
          {/* Top-Left */}
          <path d="M -30 0 L 0 0 M 0 -30 L 0 0" stroke={cropMarkStroke} strokeWidth={1.2} />
          {/* Top-Right */}
          <path d={`M ${upm + 30} 0 L ${upm} 0 M ${upm} -30 L ${upm} 0`} stroke={cropMarkStroke} strokeWidth={1.2} />
          {/* Bottom-Left */}
          <path d={`M -30 ${upm} L 0 ${upm} M 0 ${upm + 30} L 0 ${upm}`} stroke={cropMarkStroke} strokeWidth={1.2} />
          {/* Bottom-Right */}
          <path d={`M ${upm + 30} ${upm} L ${upm} ${upm} M ${upm} ${upm + 30} L ${upm} ${upm}`} stroke={cropMarkStroke} strokeWidth={1.2} />
        </g>

        {/* Grid Overlay with configurable opacity */}
        {showGrid && (
          <rect
            x={0}
            y={0}
            width={upm}
            height={upm}
            fill="url(#canvasGridPattern)"
            opacity={opacityFactor}
          />
        )}
      </g>
    );
  }
);
