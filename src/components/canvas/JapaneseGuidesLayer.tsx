import React, { useMemo } from 'react';
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
  unitsPerEm?: number;
}

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
    unitsPerEm = 1000,
  }) => {
    if (
      guideType === 'none' &&
      verticalGuide === 'none' &&
      !showBodyFrame &&
      !showKanaFrame
    ) {
      return null;
    }

    const upm = unitsPerEm || 1000;
    const half = upm / 2;
    const third1 = Number((upm / 3).toFixed(1));
    const third2 = Number(((upm * 2) / 3).toFixed(1));
    const q1 = upm / 4;
    const q3 = (upm * 3) / 4;

    const paths = useMemo(() => {
      const e1 = Number((upm / 8).toFixed(1));
      const e2 = Number((upm / 4).toFixed(1));
      const e3 = Number(((upm * 3) / 8).toFixed(1));
      const e4 = Number((upm / 2).toFixed(1));
      const e5 = Number(((upm * 5) / 8).toFixed(1));
      const e6 = Number(((upm * 3) / 4).toFixed(1));
      const e7 = Number(((upm * 7) / 8).toFixed(1));

      return {
        verticalCenter: `M ${half} 0 L ${half} ${upm}`,
        verticalThirds: `M ${third1} 0 L ${third1} ${upm} M ${third2} 0 L ${third2} ${upm}`,
        verticalQuarters: `M ${q1} 0 L ${q1} ${upm} M ${half} 0 L ${half} ${upm} M ${q3} 0 L ${q3} ${upm}`,
        verticalEighths: `M ${e1} 0 L ${e1} ${upm} M ${e2} 0 L ${e2} ${upm} M ${e3} 0 L ${e3} ${upm} M ${e4} 0 L ${e4} ${upm} M ${e5} 0 L ${e5} ${upm} M ${e6} 0 L ${e6} ${upm} M ${e7} 0 L ${e7} ${upm}`,
        cross: `M ${half} 0 L ${half} ${upm} M 0 ${half} L ${upm} ${half}`,
        jiugong: `M ${third1} 0 L ${third1} ${upm} M ${third2} 0 L ${third2} ${upm} M 0 ${third1} L ${upm} ${third1} M 0 ${third2} L ${upm} ${third2}`,
        sixteen: `M ${q1} 0 L ${q1} ${upm} M ${q3} 0 L ${q3} ${upm} M 0 ${q1} L ${upm} ${q1} M 0 ${q3} L ${upm} ${q3}`,
        mi: `M 0 0 L ${upm} ${upm} M ${upm} 0 L 0 ${upm}`,
      };
    }, [upm, half, third1, third2, q1, q3]);

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

    const verticalGuidePath =
      verticalGuide === 'center'
        ? paths.verticalCenter
        : verticalGuide === 'thirds'
        ? paths.verticalThirds
        : verticalGuide === 'quarters'
        ? paths.verticalQuarters
        : verticalGuide === 'eighths'
        ? paths.verticalEighths
        : null;

    // Body Frame (85% Kanji Frame) & Kana Frame (78% Kana Frame) proportional to upm
    const bodyInset = upm * 0.075;
    const bodySize = upm * 0.85;
    const kanaInset = upm * 0.11;
    const kanaSize = upm * 0.78;

    return (
      <g
        className="japanese-guides-layer pointer-events-none select-none font-mono text-[10px]"
        opacity={Math.min(1, 0.75 * opacityScale)}
      >
        {/* 1. Dedicated Vertical Guideline System */}
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
            {verticalGuide === 'center' && (
              <text x={half} y={16} fill={verticalGuideColor} textAnchor="middle" fontWeight="bold" fontSize={11} opacity={1.0}>
                X:{half} (中心)
              </text>
            )}
            {verticalGuide === 'thirds' && (
              <>
                <text x={third1} y={16} fill={verticalGuideColor} textAnchor="middle" fontWeight="bold" fontSize={11} opacity={1.0}>
                  X:{third1}
                </text>
                <text x={third2} y={16} fill={verticalGuideColor} textAnchor="middle" fontWeight="bold" fontSize={11} opacity={1.0}>
                  X:{third2}
                </text>
              </>
            )}
          </>
        )}

        {/* 2. 和文目安ガイド */}
        {(guideType === 'cross' || guideType === 'tian') && (
          <g opacity={0.55}>
            <path
              d={paths.cross}
              stroke={primaryColor}
              strokeDasharray="6 4"
              strokeWidth={1.2}
            />
            <circle cx={half} cy={half} r={3} fill={primaryColor} />
          </g>
        )}

        {guideType === 'jiugong' && (
          <g opacity={0.5}>
            <path
              d={paths.jiugong}
              stroke={primaryColor}
              strokeDasharray="5 3"
              strokeWidth={1.1}
            />
            <path
              d={paths.mi}
              stroke={secondaryColor}
              strokeDasharray="4 4"
              strokeWidth={0.9}
              opacity={0.6}
            />
          </g>
        )}

        {guideType === 'sixteen' && (
          <g opacity={0.5}>
            <path
              d={paths.sixteen}
              stroke={primaryColor}
              strokeDasharray="5 3"
              strokeWidth={1.1}
            />
            <path
              d={paths.cross}
              stroke={secondaryColor}
              strokeWidth={1.0}
              opacity={0.7}
            />
            <path
              d={paths.mi}
              stroke={secondaryColor}
              strokeDasharray="4 4"
              strokeWidth={0.8}
              opacity={0.5}
            />
          </g>
        )}

        {guideType === 'mi' && (
          <g opacity={0.55}>
            <path
              d={paths.mi}
              stroke={primaryColor}
              strokeDasharray="5 3"
              strokeWidth={1.2}
            />
            <path
              d={paths.cross}
              stroke={secondaryColor}
              strokeDasharray="4 4"
              strokeWidth={1.0}
            />
            <circle cx={half} cy={half} r={3} fill={primaryColor} />
          </g>
        )}

        {/* 3. 十字格・漢字字面枠 (85%) */}
        {showBodyFrame && (
          <g opacity={0.65}>
            <rect
              x={bodyInset}
              y={bodyInset}
              width={bodySize}
              height={bodySize}
              fill="none"
              stroke={kanjiFrameColor}
              strokeWidth={1.4}
              strokeDasharray="8 4"
              rx={4}
            />
          </g>
        )}

        {/* 4. 仮名字面枠 (78%) */}
        {showKanaFrame && (
          <g opacity={0.65}>
            <rect
              x={kanaInset}
              y={kanaInset}
              width={kanaSize}
              height={kanaSize}
              fill="none"
              stroke={kanaFrameColor}
              strokeWidth={1.4}
              strokeDasharray="4 4"
              rx={4}
            />
          </g>
        )}
      </g>
    );
  }
);
