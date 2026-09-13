import React from 'react';
import { Point } from '../../types';

interface CanvasRulersLayerProps {
  showRulers: boolean;
  isLight: boolean;
  hoverPos: Point | null;
}

export const CanvasRulersLayer: React.FC<CanvasRulersLayerProps> = React.memo(
  ({ showRulers, isLight, hoverPos }) => {
    if (!showRulers) return null;

    return (
      <g className="canvas-rulers-layer select-none font-mono text-[9px] pointer-events-none">
        {/* Top Ruler Bar Background */}
        <rect
          x={-50}
          y={-36}
          width={1100}
          height={36}
          fill={isLight ? '#f1f5f3' : '#142018'}
          stroke={isLight ? '#cbdad2' : '#25382c'}
          strokeWidth={1}
        />
        {/* Left Ruler Bar Background */}
        <rect
          x={-36}
          y={-50}
          width={36}
          height={1100}
          fill={isLight ? '#f1f5f3' : '#142018'}
          stroke={isLight ? '#cbdad2' : '#25382c'}
          strokeWidth={1}
        />

        {/* Top Ruler Ticks & Numbers (0 to 1000) */}
        {Array.from({ length: 11 }, (_, i) => i * 100).map((x) => (
          <g key={`top-tick-${x}`}>
            <line
              x1={x}
              y1={-18}
              x2={x}
              y2={0}
              stroke={isLight ? '#065f46' : '#34d399'}
              strokeWidth={1.5}
            />
            <text
              x={x + 3}
              y={-22}
              fill={isLight ? '#065f46' : '#6ee7b7'}
              fontWeight="bold"
            >
              {x}
            </text>
            {/* 50px minor tick */}
            {x < 1000 && (
              <line
                x1={x + 50}
                y1={-10}
                x2={x + 50}
                y2={0}
                stroke={isLight ? '#64748b' : '#475569'}
                strokeWidth={1}
              />
            )}
          </g>
        ))}

        {/* Left Ruler Ticks & Numbers (0 to 1000) */}
        {Array.from({ length: 11 }, (_, i) => i * 100).map((y) => (
          <g key={`left-tick-${y}`}>
            <line
              x1={-18}
              y1={y}
              x2={0}
              y2={y}
              stroke={isLight ? '#065f46' : '#34d399'}
              strokeWidth={1.5}
            />
            <text
              x={-33}
              y={y + 9}
              fill={isLight ? '#065f46' : '#6ee7b7'}
              fontWeight="bold"
            >
              {y}
            </text>
            {/* 50px minor tick */}
            {y < 1000 && (
              <line
                x1={-10}
                y1={y + 50}
                x2={0}
                y2={y + 50}
                stroke={isLight ? '#64748b' : '#475569'}
                strokeWidth={1}
              />
            )}
          </g>
        ))}

        {/* Real-time Cursor Indicator on Rulers (Red tracking ticks) */}
        {hoverPos && (
          <>
            <line
              x1={hoverPos.x}
              y1={-36}
              x2={hoverPos.x}
              y2={0}
              stroke="#ef4444"
              strokeWidth={2}
            />
            <line
              x1={-36}
              y1={hoverPos.y}
              x2={0}
              y2={hoverPos.y}
              stroke="#ef4444"
              strokeWidth={2}
            />
          </>
        )}
      </g>
    );
  }
);
