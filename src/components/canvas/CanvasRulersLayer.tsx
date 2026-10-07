import React, { useMemo } from 'react';
import { Point } from '../../types';

interface CanvasRulersLayerProps {
  showRulers: boolean;
  isLight: boolean;
  hoverPos: Point | null;
  unitsPerEm?: number;
}

export const CanvasRulersLayer: React.FC<CanvasRulersLayerProps> = React.memo(
  ({ showRulers, isLight, hoverPos, unitsPerEm = 1000 }) => {
    if (!showRulers) return null;

    const upm = unitsPerEm || 1000;

    const rulerTicks = useMemo(() => {
      const ticks = [];
      const step = upm > 1500 ? 200 : upm > 1000 ? 150 : 100;
      for (let i = 0; i <= upm; i += step) {
        ticks.push(i);
      }
      if (ticks[ticks.length - 1] !== upm) ticks.push(upm);
      return ticks;
    }, [upm]);

    const staticRulerContent = useMemo(() => {
      const strokePrimary = isLight ? '#065f46' : '#34d399';
      const fillText = isLight ? '#065f46' : '#6ee7b7';
      const strokeMinor = isLight ? '#64748b' : '#475569';

      return (
        <>
          {/* Top Ruler Bar Background */}
          <rect
            x={-50}
            y={-36}
            width={upm + 100}
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
            height={upm + 100}
            fill={isLight ? '#f1f5f3' : '#142018'}
            stroke={isLight ? '#cbdad2' : '#25382c'}
            strokeWidth={1}
          />

          {/* Top Ruler Ticks & Numbers */}
          {rulerTicks.map((x) => (
            <g key={`top-tick-${x}`}>
              <line
                x1={x}
                y1={-18}
                x2={x}
                y2={0}
                stroke={strokePrimary}
                strokeWidth={1.5}
              />
              <text
                x={x + 3}
                y={-22}
                fill={fillText}
                fontWeight="bold"
              >
                {x}
              </text>
              {/* Minor tick */}
              {x < upm && (
                <line
                  x1={x + 50}
                  y1={-10}
                  x2={x + 50}
                  y2={0}
                  stroke={strokeMinor}
                  strokeWidth={1}
                />
              )}
            </g>
          ))}

          {/* Left Ruler Ticks & Numbers */}
          {rulerTicks.map((y) => (
            <g key={`left-tick-${y}`}>
              <line
                x1={-18}
                y1={y}
                x2={0}
                y2={y}
                stroke={strokePrimary}
                strokeWidth={1.5}
              />
              <text
                x={-33}
                y={y + 9}
                fill={fillText}
                fontWeight="bold"
              >
                {y}
              </text>
              {/* Minor tick */}
              {y < upm && (
                <line
                  x1={-10}
                  y1={y + 50}
                  x2={0}
                  y2={y + 50}
                  stroke={strokeMinor}
                  strokeWidth={1}
                />
              )}
            </g>
          ))}
        </>
      );
    }, [isLight, upm, rulerTicks]);

    return (
      <g className="canvas-rulers-layer select-none font-mono text-[9px] pointer-events-none">
        {staticRulerContent}

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
