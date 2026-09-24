import React from 'react';
import { ThemeMode } from '../../utils/theme';

interface JapaneseGuidesLayerProps {
  guideType?: 'none' | 'cross' | 'tian' | 'jiugong' | 'mi';
  showBodyFrame?: boolean;
  showKanaFrame?: boolean;
  isLight: boolean;
  theme?: ThemeMode;
  activeChar?: string;
}

export const JapaneseGuidesLayer: React.FC<JapaneseGuidesLayerProps> = React.memo(
  ({ guideType, showBodyFrame, showKanaFrame, isLight, theme = 'light', activeChar = '' }) => {
    const isKana = /[ぁ-んァ-ヶー]/.test(activeChar);
    const isKanji = /[\u4e00-\u9faf\u3400-\u4dbf]/.test(activeChar);

    const primaryColor =
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

    const secondaryColor =
      theme === 'sepia'
        ? '#b45309'
        : theme === 'warm'
        ? '#d97706'
        : theme === 'nord'
        ? '#81a1c1'
        : theme === 'monochrome'
        ? '#52525b'
        : isLight
        ? '#0284c7'
        : '#38bdf8';

    const kanjiFrameColor =
      theme === 'sepia'
        ? '#8c531b'
        : theme === 'warm'
        ? '#c2410c'
        : theme === 'nord'
        ? '#88c0d0'
        : theme === 'monochrome'
        ? '#18181b'
        : isLight
        ? '#059669'
        : '#34d399';

    const kanaFrameColor =
      theme === 'sepia'
        ? '#b45309'
        : theme === 'warm'
        ? '#ea580c'
        : theme === 'nord'
        ? '#a3be8c'
        : theme === 'monochrome'
        ? '#71717a'
        : isLight
        ? '#d97706'
        : '#f59e0b';

    const kanjiBadgeBg =
      theme === 'sepia'
        ? '#f4ede2'
        : theme === 'warm'
        ? '#fbf3e8'
        : theme === 'nord'
        ? '#242933'
        : theme === 'monochrome'
        ? '#f4f4f5'
        : isLight
        ? '#ecfdf5'
        : '#064e3b';

    const kanaBadgeBg =
      theme === 'sepia'
        ? '#faf5eb'
        : theme === 'warm'
        ? '#fffdf7'
        : theme === 'nord'
        ? '#2e3440'
        : theme === 'monochrome'
        ? '#ffffff'
        : isLight
        ? '#fffbeb'
        : '#78350f';

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
              stroke={primaryColor}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
            <line
              x1={0}
              y1={500}
              x2={1000}
              y2={500}
              stroke={primaryColor}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
            {/* Center origin badge */}
            <circle cx={500} cy={500} r={3.5} fill={primaryColor} opacity={0.7} />
            <text
              x={508}
              y={516}
              fill={primaryColor}
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
              stroke={primaryColor}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.7}
            />
            <line
              x1={0}
              y1={500}
              x2={1000}
              y2={500}
              stroke={primaryColor}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.7}
            />
            <circle cx={500} cy={500} r={3.5} fill={primaryColor} opacity={0.7} />
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
              stroke={secondaryColor}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
            <line
              x1={666.7}
              y1={0}
              x2={666.7}
              y2={1000}
              stroke={secondaryColor}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
            <line
              x1={0}
              y1={333.3}
              x2={1000}
              y2={333.3}
              stroke={secondaryColor}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
            <line
              x1={0}
              y1={666.7}
              x2={1000}
              y2={666.7}
              stroke={secondaryColor}
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
              stroke={secondaryColor}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
            <line
              x1={0}
              y1={500}
              x2={1000}
              y2={500}
              stroke={secondaryColor}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              opacity={0.6}
            />
            <line
              x1={0}
              y1={0}
              x2={1000}
              y2={1000}
              stroke={secondaryColor}
              strokeDasharray="4 4"
              strokeWidth={1.2}
              opacity={0.45}
            />
            <line
              x1={1000}
              y1={0}
              x2={0}
              y2={1000}
              stroke={secondaryColor}
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
              stroke={kanjiFrameColor}
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
              fill={kanjiBadgeBg}
              stroke={kanjiFrameColor}
              strokeWidth={1}
            />
            <text
              x={82}
              y={69}
              fill={kanjiFrameColor}
              fontSize={10}
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              漢字字面枠 85% {isKanji ? '(推奨)' : ''}
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
              stroke={kanaFrameColor}
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
              fill={kanaBadgeBg}
              stroke={kanaFrameColor}
              strokeWidth={1}
            />
            <text
              x={117}
              y={104}
              fill={kanaFrameColor}
              fontSize={10}
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              仮名字面枠 78% {isKana ? '(推奨)' : ''}
            </text>
          </g>
        )}
      </g>
    );
  }
);
