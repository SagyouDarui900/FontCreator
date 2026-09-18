import React from 'react';

interface JapaneseGuidesLayerProps {
  guideType?: 'none' | 'cross' | 'tian' | 'jiugong' | 'mi';
  showBodyFrame?: boolean;
  showKanaFrame?: boolean;
  isLight: boolean;
  activeChar?: string;
}

export const JapaneseGuidesLayer: React.FC<JapaneseGuidesLayerProps> = React.memo(
  ({ guideType, showBodyFrame, showKanaFrame, isLight, activeChar = '' }) => {
    const isKana = /[ぁ-んァ-ヶー]/.test(activeChar);
    const isKanji = /[\u4e00-\u9faf\u3400-\u4dbf]/.test(activeChar);

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
              stroke={isLight ? '#059669' : '#10b981'}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
            <line
              x1={0}
              y1={500}
              x2={1000}
              y2={500}
              stroke={isLight ? '#059669' : '#10b981'}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
            {/* Center origin badge */}
            <circle cx={500} cy={500} r={3.5} fill={isLight ? '#059669' : '#10b981'} opacity={0.7} />
            <text
              x={508}
              y={516}
              fill={isLight ? '#059669' : '#10b981'}
              fontSize={10}
              fontWeight="bold"
              fontFamily="sans-serif"
              opacity={0.75}
            >
              中心
            </text>
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
              opacity={0.7}
            />
            <line
              x1={0}
              y1={500}
              x2={1000}
              y2={500}
              stroke={isLight ? '#059669' : '#10b981'}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.7}
            />
            <circle cx={500} cy={500} r={3.5} fill={isLight ? '#059669' : '#10b981'} opacity={0.7} />
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
          <g opacity={isKanji ? 1 : isKana ? 0.45 : 0.7}>
            <rect
              x={75}
              y={75}
              width={850}
              height={850}
              fill="none"
              stroke={isLight ? '#059669' : '#34d399'}
              strokeDasharray={isKanji ? '6 4' : '5 5'}
              strokeWidth={isKanji ? 2.0 : 1.2}
            />
            {/* Tag badge with clear explanation */}
            <rect
              x={75}
              y={56}
              width={160}
              height={18}
              rx={3}
              fill={isLight ? '#ecfdf5' : '#064e3b'}
              stroke={isLight ? '#059669' : '#34d399'}
              strokeWidth={1}
            />
            <text
              x={82}
              y={69}
              fill={isLight ? '#047857' : '#6ee7b7'}
              fontSize={10}
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              漢字字面枠 85% {isKanji ? '★推奨' : ''}
            </text>
          </g>
        )}

        {/* 仮名字面枠 78% (780x780 kana frame) */}
        {showKanaFrame && (
          <g opacity={isKana ? 1 : isKanji ? 0.45 : 0.7}>
            <rect
              x={110}
              y={110}
              width={780}
              height={780}
              fill="none"
              stroke={isLight ? '#d97706' : '#f59e0b'}
              strokeDasharray={isKana ? '6 4' : '4 4'}
              strokeWidth={isKana ? 2.0 : 1.2}
            />
            {/* Tag badge with clear explanation */}
            <rect
              x={110}
              y={91}
              width={168}
              height={18}
              rx={3}
              fill={isLight ? '#fffbeb' : '#78350f'}
              stroke={isLight ? '#d97706' : '#f59e0b'}
              strokeWidth={1}
            />
            <text
              x={117}
              y={104}
              fill={isLight ? '#b45309' : '#fcd34d'}
              fontSize={10}
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              仮名字面枠 78% {isKana ? '★推奨' : ''}
            </text>
          </g>
        )}
      </g>
    );
  }
);
