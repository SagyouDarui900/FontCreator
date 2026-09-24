import React from 'react';
import { ThemeMode } from '../../utils/theme';

interface CanvasBackgroundLayerProps {
  isLight: boolean;
  theme?: ThemeMode;
  showGrid: boolean;
  gridSize: number;
}

export const CanvasBackgroundLayer: React.FC<CanvasBackgroundLayerProps> = React.memo(
  ({ isLight, theme = 'light', showGrid, gridSize }) => {
    const size = gridSize || 50;

    // Determine colors tailored for eye-comfort presets
    const gridStroke =
      theme === 'sepia'
        ? '#ded2be'
        : theme === 'warm'
        ? '#eedec8'
        : theme === 'nord'
        ? '#3b4252'
        : theme === 'monochrome'
        ? '#e4e4e7'
        : isLight
        ? '#cce5d8'
        : '#1f2d24';

    const dimmingFill =
      theme === 'sepia'
        ? 'rgba(60, 45, 30, 0.07)'
        : theme === 'warm'
        ? 'rgba(70, 45, 20, 0.06)'
        : theme === 'nord'
        ? 'rgba(0, 0, 0, 0.35)'
        : theme === 'monochrome'
        ? 'rgba(0, 0, 0, 0.08)'
        : isLight
        ? 'rgba(15, 30, 20, 0.04)'
        : 'rgba(0, 0, 0, 0.3)';

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
        ? '#8c673b'
        : theme === 'warm'
        ? '#c2410c'
        : theme === 'nord'
        ? '#5e81ac'
        : theme === 'monochrome'
        ? '#18181b'
        : isLight
        ? '#065f46'
        : '#2d4034';

    const cropMarkStroke =
      theme === 'sepia'
        ? '#a16207'
        : theme === 'warm'
        ? '#ea580c'
        : theme === 'nord'
        ? '#88c0d0'
        : theme === 'monochrome'
        ? '#18181b'
        : isLight
        ? '#059669'
        : '#10b981';

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
          d="M -4000 -4000 H 5000 V 5000 H -4000 Z M 0 0 V 1000 H 1000 V 0 Z"
          fill={dimmingFill}
          fillRule="evenodd"
        />

        {/* Em Square Box (1000x1000) Background */}
        <rect
          x={0}
          y={0}
          width={1000}
          height={1000}
          fill={emBoxFill}
          stroke={emBoxStroke}
          strokeWidth={3}
        />

        {/* Professional Font Drafting Corner Crop/Register Marks (トンボ) */}
        <g opacity={0.6}>
          {/* Top-Left */}
          <path d="M -30 0 L 0 0 M 0 -30 L 0 0" stroke={cropMarkStroke} strokeWidth={1.5} />
          {/* Top-Right */}
          <path d="M 1030 0 L 1000 0 M 1000 -30 L 1000 0" stroke={cropMarkStroke} strokeWidth={1.5} />
          {/* Bottom-Left */}
          <path d="M -30 1000 L 0 1000 M 0 1030 L 0 1000" stroke={cropMarkStroke} strokeWidth={1.5} />
          {/* Bottom-Right */}
          <path d="M 1030 1000 L 1000 1000 M 1000 1030 L 1000 1000" stroke={cropMarkStroke} strokeWidth={1.5} />
        </g>

        {/* Grid Overlay */}
        {showGrid && (
          <rect x={0} y={0} width={1000} height={1000} fill="url(#canvasGridPattern)" />
        )}
      </g>
    );
  }
);
