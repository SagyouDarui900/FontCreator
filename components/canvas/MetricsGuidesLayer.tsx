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
        {/* Ascender */}
        <g opacity={latinMetricsOpacity}>
          <line
            x1={0}
            y1={ascenderY}
            x2={Math.max(upm, advanceWidth)}
            y2={ascenderY}
            stroke="#3b82f6"
            strokeWidth={1.2}
            strokeDasharray="6 3"
          />
          <text x={12} y={ascenderY - 8} fill="#3b82f6" fontWeight="bold" opacity={0.85}>Ascender</text>
        </g>

        {/* Cap Height */}
        <g opacity={latinMetricsOpacity}>
          <line
            x1={0}
            y1={capHeightY}
            x2={Math.max(upm, advanceWidth)}
            y2={capHeightY}
            stroke="#0ea5e9"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text x={12} y={capHeightY - 8} fill="#0ea5e9" fontWeight="bold" opacity={0.85}>Cap Height</text>
        </g>

        {/* X-Height */}
        <g opacity={latinMetricsOpacity}>
          <line
            x1={0}
            y1={xHeightY}
            x2={Math.max(upm, advanceWidth)}
            y2={xHeightY}
            stroke="#0ea5e9"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text x={12} y={xHeightY - 8} fill="#0ea5e9" fontWeight="bold" opacity={0.85}>X-Height</text>
        </g>

        {/* Baseline */}
        <g opacity={(isJapanese ? 0.35 : 0.75) * opacityScale}>
          <line
            x1={0}
            y1={baselineY}
            x2={Math.max(upm, advanceWidth)}
            y2={baselineY}
            stroke="#ef4444"
            strokeWidth={isJapanese ? 1.2 : 1.5}
            strokeDasharray={isJapanese ? '8 4' : undefined}
          />
          <text x={12} y={baselineY - 8} fill="#ef4444" fontWeight="bold" opacity={0.9}>
            Baseline {isJapanese ? '(欧文基準)' : ''}
          </text>
        </g>

        {/* Descender */}
        <g opacity={latinMetricsOpacity}>
          <line
            x1={0}
            y1={descenderY}
            x2={Math.max(upm, advanceWidth)}
            y2={descenderY}
            stroke="#f97316"
            strokeWidth={1.2}
            strokeDasharray="6 3"
          />
          <text x={12} y={descenderY - 8} fill="#f97316" fontWeight="bold" opacity={0.85}>Descender</text>
        </g>

        {/* Vertical Center Axis */}
        {showVerticalCenter && (
          <g opacity={0.6 * opacityScale}>
            <line
              x1={centerX}
              y1={0}
              x2={centerX}
              y2={upm}
              stroke="#8b5cf6"
              strokeWidth={1.2}
              strokeDasharray="6 4"
            />
            <text
              x={centerX + 6}
              y={24}
              fill="#8b5cf6"
              fontWeight="bold"
              opacity={0.85}
            >
              Center ({centerX})
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
