import React from 'react';

interface JapaneseGuidesLayerProps {
  guideType?: 'none' | 'cross' | 'tian' | 'jiugong' | 'mi';
  showBodyFrame?: boolean;
  showKanaFrame?: boolean;
  isLight: boolean;
}

export const JapaneseGuidesLayer: React.FC<JapaneseGuidesLayerProps> = React.memo(
  ({ guideType, showBodyFrame, showKanaFrame, isLight }) => {
    return (
      <g className="japanese-guides-layer pointer-events-none select-none">
        {/* Center Crosshairs (+十字格) */}
        {guideType === 'cross' && (
          <g>
            <line
              x1={500}
              y1={0}
              x2={500}
              y2={1000}
              stroke={isLight ? '#a7d5be' : '#27382d'}
              strokeDasharray="6 4"
              strokeWidth={1.5}
            />
            <line
              x1={0}
              y1={500}
              x2={1000}
              y2={500}
              stroke={isLight ? '#a7d5be' : '#27382d'}
              strokeDasharray="6 4"
              strokeWidth={1.5}
            />
          </g>
        )}

        {/* 田字格 */}
        {guideType === 'tian' && (
          <g>
            <line
              x1={500}
              y1={0}
              x2={500}
              y2={1000}
              stroke={isLight ? '#059669' : '#10b981'}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.65}
            />
            <line
              x1={0}
              y1={500}
              x2={1000}
              y2={500}
              stroke={isLight ? '#059669' : '#10b981'}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.65}
            />
          </g>
        )}

        {/* 九宮格 (3x3 Grid: 333.3px, 666.7px) */}
        {guideType === 'jiugong' && (
          <g>
            <line
              x1={333.3}
              y1={0}
              x2={333.3}
              y2={1000}
              stroke={isLight ? '#0284c7' : '#38bdf8'}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
            <line
              x1={666.7}
              y1={0}
              x2={666.7}
              y2={1000}
              stroke={isLight ? '#0284c7' : '#38bdf8'}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
            <line
              x1={0}
              y1={333.3}
              x2={1000}
              y2={333.3}
              stroke={isLight ? '#0284c7' : '#38bdf8'}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
            <line
              x1={0}
              y1={666.7}
              x2={1000}
              y2={666.7}
              stroke={isLight ? '#0284c7' : '#38bdf8'}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
          </g>
        )}

        {/* 米字格 (Cross + Diagonals) */}
        {guideType === 'mi' && (
          <g>
            <line
              x1={500}
              y1={0}
              x2={500}
              y2={1000}
              stroke={isLight ? '#d97706' : '#fbbf24'}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
            <line
              x1={0}
              y1={500}
              x2={1000}
              y2={500}
              stroke={isLight ? '#d97706' : '#fbbf24'}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
            <line
              x1={0}
              y1={0}
              x2={1000}
              y2={1000}
              stroke={isLight ? '#d97706' : '#fbbf24'}
              strokeDasharray="4 4"
              strokeWidth={1.2}
              opacity={0.45}
            />
            <line
              x1={1000}
              y1={0}
              x2={0}
              y2={1000}
              stroke={isLight ? '#d97706' : '#fbbf24'}
              strokeDasharray="4 4"
              strokeWidth={1.2}
              opacity={0.45}
            />
          </g>
        )}

        {/* 漢字字面枠 85% (850x850 body frame) */}
        {showBodyFrame && (
          <g>
            <rect
              x={75}
              y={75}
              width={850}
              height={850}
              fill="none"
              stroke={isLight ? '#059669' : '#34d399'}
              strokeDasharray="5 5"
              strokeWidth={1.2}
              opacity={0.55}
            />
            <text
              x={80}
              y={92}
              fill={isLight ? '#059669' : '#34d399'}
              fontSize={10}
              fontFamily="sans-serif"
              opacity={0.7}
            >
              漢字字面枠 85%
            </text>
          </g>
        )}

        {/* 仮名字面枠 78% (780x780 kana frame) */}
        {showKanaFrame && (
          <g>
            <rect
              x={110}
              y={110}
              width={780}
              height={780}
              fill="none"
              stroke={isLight ? '#d97706' : '#f59e0b'}
              strokeDasharray="4 4"
              strokeWidth={1.2}
              opacity={0.6}
            />
            <text
              x={115}
              y={127}
              fill={isLight ? '#d97706' : '#f59e0b'}
              fontSize={10}
              fontFamily="sans-serif"
              opacity={0.75}
            >
              仮名枠 78%
            </text>
          </g>
        )}
      </g>
    );
  }
);
