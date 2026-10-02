import React from 'react';
import { ThemeMode } from '../../utils/theme';
import { JapaneseGuidePattern, VerticalGuidePattern } from '../../types';

interface JapaneseGuidesLayerProps {
  guideType?: JapaneseGuidePattern;
  verticalGuide?: VerticalGuidePattern;
  showBodyFrame?: boolean;
  showKanaFrame?: boolean;
  isLight: boolean;
  theme?: ThemeMode;
  activeChar?: string;
  gridOpacity?: number;
}

// Pre-compiled static path strings for instant GPU-accelerated rendering
const PATH_VERTICAL_CENTER = 'M 500 -30 L 500 1030';
const PATH_VERTICAL_THIRDS = 'M 333.3 -30 L 333.3 1030 M 666.7 -30 L 666.7 1030';
const PATH_VERTICAL_QUARTERS = 'M 250 -30 L 250 1030 M 500 -30 L 500 1030 M 750 -30 L 750 1030';
const PATH_VERTICAL_EIGHTHS =
  'M 125 -30 L 125 1030 M 250 -30 L 250 1030 M 375 -30 L 375 1030 M 500 -30 L 500 1030 M 625 -30 L 625 1030 M 750 -30 L 750 1030 M 875 -30 L 875 1030';

const PATH_GRID_CROSS = 'M 500 0 L 500 1000 M 0 500 L 1000 500';
const PATH_GRID_JIUGONG =
  'M 333.3 0 L 333.3 1000 M 666.7 0 L 666.7 1000 M 0 333.3 L 1000 333.3 M 0 666.7 L 1000 666.7';
const PATH_GRID_SIXTEEN_OUTER =
  'M 250 0 L 250 1000 M 750 0 L 750 1000 M 0 250 L 1000 250 M 0 750 L 1000 750';
const PATH_GRID_MI_DIAGONALS = 'M 0 0 L 1000 1000 M 1000 0 L 0 1000';

export const JapaneseGuidesLayer: React.FC<JapaneseGuidesLayerProps> = React.memo(
  ({
    guideType = 'none',
    verticalGuide = 'none',
    showBodyFrame,
    showKanaFrame,
    isLight,
    theme = 'light',
    activeChar = '',
    gridOpacity = 30,
  }) => {
    if (
      guideType === 'none' &&
      verticalGuide === 'none' &&
      !showBodyFrame &&
      !showKanaFrame
    ) {
      return null;
    }

    const isKana = /[ぁ-んァ-ヶー]/.test(activeChar);
    const isKanji = /[\u4e00-\u9faf\u3400-\u4dbf]/.test(activeChar);

    const opacityScale = Math.min(1.2, Math.max(0.2, (gridOpacity ?? 30) / 45));

    const primaryColor =
      theme === 'sepia'
        ? '#92400e'
        : theme === 'warm'
        ? '#c2410c'
        : theme === 'nord'
        ? '#88c0d0'
        : theme === 'monochrome'
        ? '#3f3f46'
        : isLight
        ? '#059669'
        : '#34d399';

    const secondaryColor =
      theme === 'sepia'
        ? '#a16207'
        : theme === 'warm'
        ? '#b45309'
        : theme === 'nord'
        ? '#81a1c1'
        : theme === 'monochrome'
        ? '#71717a'
        : isLight
        ? '#0284c7'
        : '#38bdf8';

    const verticalGuideColor =
      theme === 'sepia'
        ? '#78350f'
        : theme === 'warm'
        ? '#b45309'
        : theme === 'nord'
        ? '#81a1c1'
        : theme === 'monochrome'
        ? '#52525b'
        : isLight
        ? '#7c3aed'
        : '#a78bfa';

    const kanjiFrameColor =
      theme === 'sepia'
        ? '#8c531b'
        : theme === 'warm'
        ? '#b45309'
        : theme === 'nord'
        ? '#88c0d0'
        : theme === 'monochrome'
        ? '#3f3f46'
        : isLight
        ? '#059669'
        : '#34d399';

    const kanaFrameColor =
      theme === 'sepia'
        ? '#a16207'
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

    const verticalGuidePath =
      verticalGuide === 'center'
        ? PATH_VERTICAL_CENTER
        : verticalGuide === 'thirds'
        ? PATH_VERTICAL_THIRDS
        : verticalGuide === 'quarters'
        ? PATH_VERTICAL_QUARTERS
        : verticalGuide === 'eighths'
        ? PATH_VERTICAL_EIGHTHS
        : null;

    return (
      <g
        className="japanese-guides-layer pointer-events-none select-none font-mono text-[10px]"
        opacity={Math.min(1, 0.75 * opacityScale)}
      >
        {/* 1. Dedicated Vertical Guideline System (Consolidated single path) */}
        {verticalGuidePath && (
          <>
            <g opacity={0.65}>
              <path
                d={verticalGuidePath}
                stroke={verticalGuideColor}
                strokeDasharray="5 3"
                strokeWidth={1.2}
              />
            </g>
            {/* High-contrast text labels for vertical markers */}
            {verticalGuide === 'center' && (
              <text x={500} y={-8} fill={verticalGuideColor} textAnchor="middle" fontWeight="bold" fontSize={11} opacity={1.0}>
                X:500 (中心)
              </text>
            )}
            {verticalGuide === 'thirds' && (
              <>
                <text x={333.3} y={-8} fill={verticalGuideColor} textAnchor="middle" fontWeight="bold" fontSize={11} opacity={1.0}>
                  X:333 (偏)
                </text>
                <text x={666.7} y={-8} fill={verticalGuideColor} textAnchor="middle" fontWeight="bold" fontSize={11} opacity={1.0}>
                  X:667 (旁)
                </text>
              </>
            )}
            {verticalGuide === 'quarters' && (
              <>
                <text x={250} y={-8} fill={verticalGuideColor} textAnchor="middle" fontWeight="bold" fontSize={11} opacity={1.0}>
                  1/4
                </text>
                <text x={500} y={-8} fill={verticalGuideColor} textAnchor="middle" fontWeight="bold" fontSize={11} opacity={1.0}>
                  1/2
                </text>
                <text x={750} y={-8} fill={verticalGuideColor} textAnchor="middle" fontWeight="bold" fontSize={11} opacity={1.0}>
                  3/4
                </text>
              </>
            )}
          </>
        )}

        {/* 2. 和文目安ガイド (Fast consolidated paths) */}
        {/* Cross / Tian */}
        {(guideType === 'cross' || guideType === 'tian') && (
          <g opacity={0.55}>
            <path
              d={PATH_GRID_CROSS}
              stroke={primaryColor}
              strokeDasharray="6 4"
              strokeWidth={1.2}
            />
            <circle cx={500} cy={500} r={3} fill={primaryColor} />
          </g>
        )}

        {/* Jiugong (3x3) */}
        {guideType === 'jiugong' && (
          <path
            d={PATH_GRID_JIUGONG}
            stroke={secondaryColor}
            strokeDasharray="6 4"
            strokeWidth={1.2}
            opacity={0.55}
          />
        )}

        {/* Sixteen (4x4) */}
        {guideType === 'sixteen' && (
          <g opacity={0.55}>
            <path
              d={PATH_GRID_CROSS}
              stroke={primaryColor}
              strokeDasharray="6 4"
              strokeWidth={1.4}
            />
            <path
              d={PATH_GRID_SIXTEEN_OUTER}
              stroke={secondaryColor}
              strokeDasharray="5 3"
              strokeWidth={1.1}
            />
            <circle cx={500} cy={500} r={3} fill={primaryColor} />
          </g>
        )}

        {/* Mi (米字格) */}
        {guideType === 'mi' && (
          <g opacity={0.55}>
            <path
              d={PATH_GRID_CROSS}
              stroke={primaryColor}
              strokeDasharray="6 4"
              strokeWidth={1.2}
            />
            <path
              d={PATH_GRID_MI_DIAGONALS}
              stroke={secondaryColor}
              strokeDasharray="4 4"
              strokeWidth={1.0}
              opacity={0.7}
            />
          </g>
        )}

        {/* 漢字字面枠 85% (850x850 body frame) */}
        {showBodyFrame && (
          <g opacity={isKanji ? 0.9 : isKana ? 0.35 : 0.6}>
            <rect
              x={75}
              y={75}
              width={850}
              height={850}
              fill="none"
              stroke={kanjiFrameColor}
              strokeDasharray={isKanji ? '6 4' : '5 5'}
              strokeWidth={1.4}
            />
            <rect
              x={75}
              y={56}
              width={140}
              height={18}
              rx={3}
              fill={kanjiBadgeBg}
              stroke={kanjiFrameColor}
              strokeWidth={0.8}
            />
            <text
              x={82}
              y={69}
              fill={kanjiFrameColor}
              fontSize={10}
              fontWeight="bold"
            >
              漢字字面枠 85%
            </text>
          </g>
        )}

        {/* 仮名字面枠 78% (780x780 kana frame) */}
        {showKanaFrame && (
          <g opacity={isKana ? 0.9 : isKanji ? 0.35 : 0.6}>
            <rect
              x={110}
              y={110}
              width={780}
              height={780}
              fill="none"
              stroke={kanaFrameColor}
              strokeDasharray={isKana ? '6 4' : '4 4'}
              strokeWidth={1.4}
            />
            <rect
              x={110}
              y={91}
              width={140}
              height={18}
              rx={3}
              fill={kanaBadgeBg}
              stroke={kanaFrameColor}
              strokeWidth={0.8}
            />
            <text
              x={117}
              y={104}
              fill={kanaFrameColor}
              fontSize={10}
              fontWeight="bold"
            >
              仮名字面枠 78%
            </text>
          </g>
        )}
      </g>
    );
  }
);
