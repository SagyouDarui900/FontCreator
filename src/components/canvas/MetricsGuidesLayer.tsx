import React from 'react';

interface MetricsGuidesLayerProps {
  showMetrics: boolean;
  lsb: number;
  advanceWidth: number;
  activeChar?: string;
  isLight?: boolean;
  showVerticalCenter?: boolean;
  gridOpacity?: number;
  unitsPerEm?: number;
}

export const MetricsGuidesLayer: React.FC<MetricsGuidesLayerProps> = React.memo(
  ({
    showMetrics,
    lsb,
    advanceWidth,
    activeChar = '',
    isLight = true,
    showVerticalCenter = true,
    gridOpacity = 30,
    unitsPerEm = 1000,
  }) => {
    if (!showMetrics) return null;

    const upm = unitsPerEm || 1000;
    const isKana = /[ぁ-んァ-ヶー]/.test(activeChar);
    const isKanji = /[\u4e00-\u9faf\u3400-\u4dbf]/.test(activeChar);
    const isJapanese = isKana || isKanji;

    const opacityScale = Math.min(1.2, Math.max(0.2, (gridOpacity ?? 30) / 45));

    // When drafting Japanese characters, dim Western-specific metrics to avoid visual confusion
    const latinMetricsOpacity = (isJapanese ? 0.25 : 0.65) * opacityScale;

    // Proportional metrics offsets based on UPM (e.g. 1000, 1200, 1500)
    const ascenderY = Math.round(upm * 0.2);
    const capHeightY = Math.round(upm * 0.3);
    const xHeightY = Math.round(upm * 0.5);
    const baselineY = Math.round(upm * 0.8);
    const descenderY = upm;
    const centerX = upm / 2;

    return (
      <g className="metrics-guides-layer select-none font-mono text-[11px] pointer-events-none">
        {/* Ascender - Distinct long-dash pattern (10 4) */}
        <g opacity={latinMetricsOpacity}>
          <line
            x1={0}
            y1={ascenderY}
            x2={Math.max(upm, advanceWidth)}
            y2={ascenderY}
            stroke={isLight ? '#ffffff' : '#000000'}
            strokeWidth={2.8}
            strokeDasharray="10 4"
            strokeOpacity={0.6}
          />
          <line
            x1={0}
            y1={ascenderY}
            x2={Math.max(upm, advanceWidth)}
            y2={ascenderY}
            stroke="#3b82f6"
            strokeWidth={1.3}
            strokeDasharray="10 4"
          />
          <text
            x={12}
            y={ascenderY - 8}
            fill="#3b82f6"
            fontWeight="bold"
            opacity={0.9}
            style={{ textShadow: isLight ? '0 0 3px #fff, 0 0 3px #fff' : '0 0 3px #000, 0 0 3px #000' }}
          >
            Ascender ──
          </text>
        </g>

        {/* Cap Height - Fine dash pattern (4 2) */}
        <g opacity={latinMetricsOpacity}>
          <line
            x1={0}
            y1={capHeightY}
            x2={Math.max(upm, advanceWidth)}
            y2={capHeightY}
            stroke={isLight ? '#ffffff' : '#000000'}
            strokeWidth={2.5}
            strokeDasharray="4 2"
            strokeOpacity={0.5}
          />
          <line
            x1={0}
            y1={capHeightY}
            x2={Math.max(upm, advanceWidth)}
            y2={capHeightY}
            stroke="#0ea5e9"
            strokeWidth={1.1}
            strokeDasharray="4 2"
          />
          <text
            x={12}
            y={capHeightY - 8}
            fill="#0ea5e9"
            fontWeight="bold"
            opacity={0.9}
            style={{ textShadow: isLight ? '0 0 3px #fff, 0 0 3px #fff' : '0 0 3px #000, 0 0 3px #000' }}
          >
            Cap Height ┄┄
          </text>
        </g>

        {/* X-Height - Fine dot pattern (2 2) */}
        <g opacity={latinMetricsOpacity}>
          <line
            x1={0}
            y1={xHeightY}
            x2={Math.max(upm, advanceWidth)}
            y2={xHeightY}
            stroke={isLight ? '#ffffff' : '#000000'}
            strokeWidth={2.5}
            strokeDasharray="2 2"
            strokeOpacity={0.5}
          />
          <line
            x1={0}
            y1={xHeightY}
            x2={Math.max(upm, advanceWidth)}
            y2={xHeightY}
            stroke="#0284c7"
            strokeWidth={1.1}
            strokeDasharray="2 2"
          />
          <text
            x={12}
            y={xHeightY - 8}
            fill="#0284c7"
            fontWeight="bold"
            opacity={0.9}
            style={{ textShadow: isLight ? '0 0 3px #fff, 0 0 3px #fff' : '0 0 3px #000, 0 0 3px #000' }}
          >
            x-Height ┈┈
          </text>
        </g>

        {/* Baseline - Solid line with Distinct Arrow Marker & High-Contrast Halo */}
        <g opacity={(isJapanese ? 0.45 : 0.85) * opacityScale}>
          <line
            x1={0}
            y1={baselineY}
            x2={Math.max(upm, advanceWidth)}
            y2={baselineY}
            stroke={isLight ? '#ffffff' : '#000000'}
            strokeWidth={3.2}
            strokeOpacity={0.7}
          />
          <line
            x1={0}
            y1={baselineY}
            x2={Math.max(upm, advanceWidth)}
            y2={baselineY}
            stroke="#ef4444"
            strokeWidth={isJapanese ? 1.4 : 1.8}
            strokeDasharray={isJapanese ? '8 4' : undefined}
          />
          {/* Distinct Shape Marker (Filled Triangle) at origin for color-blind identification */}
          <polygon
            points={`0,${baselineY - 5} 8,${baselineY} 0,${baselineY + 5}`}
            fill="#ef4444"
            stroke={isLight ? '#ffffff' : '#000000'}
            strokeWidth={1}
          />
          <text
            x={14}
            y={baselineY - 7}
            fill="#ef4444"
            fontWeight="bold"
            opacity={0.95}
            style={{ textShadow: isLight ? '0 0 3px #fff, 0 0 3px #fff' : '0 0 3px #000, 0 0 3px #000' }}
          >
            ▶ Baseline {isJapanese ? '(欧文底線)' : '(底線)'}
          </text>
        </g>

        {/* Descender - Dash-dot-dot pattern (6 2 2 2) */}
        <g opacity={latinMetricsOpacity}>
          <line
            x1={0}
            y1={descenderY}
            x2={Math.max(upm, advanceWidth)}
            y2={descenderY}
            stroke={isLight ? '#ffffff' : '#000000'}
            strokeWidth={2.8}
            strokeDasharray="6 2 2 2"
            strokeOpacity={0.6}
          />
          <line
            x1={0}
            y1={descenderY}
            x2={Math.max(upm, advanceWidth)}
            y2={descenderY}
            stroke="#f97316"
            strokeWidth={1.3}
            strokeDasharray="6 2 2 2"
          />
          <text
            x={12}
            y={descenderY - 8}
            fill="#f97316"
            fontWeight="bold"
            opacity={0.9}
            style={{ textShadow: isLight ? '0 0 3px #fff, 0 0 3px #fff' : '0 0 3px #000, 0 0 3px #000' }}
          >
            Descender ─・
          </text>
        </g>

        {/* Vertical Center Axis */}
        {showVerticalCenter && (
          <g opacity={0.7 * opacityScale}>
            <line
              x1={centerX}
              y1={0}
              x2={centerX}
              y2={upm}
              stroke={isLight ? '#ffffff' : '#000000'}
              strokeWidth={2.8}
              strokeDasharray="6 4"
              strokeOpacity={0.6}
            />
            <line
              x1={centerX}
              y1={0}
              x2={centerX}
              y2={upm}
              stroke="#8b5cf6"
              strokeWidth={1.3}
              strokeDasharray="6 4"
            />
            <text
              x={centerX + 6}
              y={24}
              fill="#8b5cf6"
              fontWeight="bold"
              opacity={0.95}
              style={{ textShadow: isLight ? '0 0 3px #fff, 0 0 3px #fff' : '0 0 3px #000, 0 0 3px #000' }}
            >
              | Center ({centerX})
            </text>
          </g>
        )}

        {/* LSB (Left Side Bearing) */}
        <g opacity={0.65 * opacityScale}>
          <line
            x1={lsb}
            y1={0}
            x2={lsb}
            y2={upm}
            stroke="#10b981"
            strokeWidth={1.4}
            strokeDasharray="4 2"
          />
          <text x={lsb + 6} y={42} fill="#10b981" fontWeight="bold" opacity={0.9}>LSB: {lsb}</text>
        </g>

        {/* RSB / Advance Width */}
        <g opacity={0.65 * opacityScale}>
          <line
            x1={advanceWidth}
            y1={0}
            x2={advanceWidth}
            y2={upm}
            stroke="#10b981"
            strokeWidth={1.4}
            strokeDasharray="4 2"
          />
          <text
            x={advanceWidth > lsb + 160 ? advanceWidth - 6 : advanceWidth + 6}
            textAnchor={advanceWidth > lsb + 160 ? 'end' : 'start'}
            y={42}
            fill="#10b981"
            fontWeight="bold"
            opacity={0.9}
          >
            Adv: {advanceWidth}
          </text>
        </g>
      </g>
    );
  }
);
