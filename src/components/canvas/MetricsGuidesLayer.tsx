import React from 'react';

interface MetricsGuidesLayerProps {
  showMetrics: boolean;
  lsb: number;
  advanceWidth: number;
  activeChar?: string;
  isLight?: boolean;
  showVerticalCenter?: boolean;
  gridOpacity?: number;
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
  }) => {
    if (!showMetrics) return null;

    const isKana = /[ぁ-んァ-ヶー]/.test(activeChar);
    const isKanji = /[\u4e00-\u9faf\u3400-\u4dbf]/.test(activeChar);
    const isJapanese = isKana || isKanji;

    const opacityScale = Math.min(1.2, Math.max(0.2, (gridOpacity ?? 30) / 45));

    // When drafting Japanese characters, dim Western-specific metrics to avoid visual confusion
    const latinMetricsOpacity = (isJapanese ? 0.25 : 0.65) * opacityScale;

    return (
      <g className="metrics-guides-layer select-none font-mono text-[11px] pointer-events-none">
        {/* Ascender (+800 / y=200) */}
        <g opacity={latinMetricsOpacity}>
          <line
            x1={-100}
            y1={200}
            x2={1100}
            y2={200}
            stroke="#3b82f6"
            strokeWidth={1.2}
            strokeDasharray="6 3"
          />
          <text x={-95} y={192} fill="#3b82f6" fontWeight="bold" opacity={1.0}>Ascender (+800) 欧文上突抜</text>
        </g>

        {/* Cap Height (+700 / y=300) */}
        <g opacity={latinMetricsOpacity}>
          <line
            x1={-100}
            y1={300}
            x2={1100}
            y2={300}
            stroke="#0ea5e9"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text x={-95} y={292} fill="#0ea5e9" fontWeight="bold" opacity={1.0}>Cap Height (+700) 欧文大文字頭</text>
        </g>

        {/* X-Height (+500 / y=500) */}
        <g opacity={latinMetricsOpacity}>
          <line
            x1={-100}
            y1={500}
            x2={1100}
            y2={500}
            stroke="#0ea5e9"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text x={-95} y={492} fill="#0ea5e9" fontWeight="bold" opacity={1.0}>X-Height (+500) 欧文小文字頭</text>
        </g>

        {/* Baseline (0 / y=800) */}
        <g opacity={(isJapanese ? 0.35 : 0.75) * opacityScale}>
          <line
            x1={-100}
            y1={800}
            x2={1100}
            y2={800}
            stroke="#ef4444"
            strokeWidth={isJapanese ? 1.2 : 1.5}
            strokeDasharray={isJapanese ? '8 4' : undefined}
          />
          <text x={-95} y={792} fill="#ef4444" fontWeight="bold" opacity={1.0}>
            Baseline (0) {isJapanese ? '欧文底線 (和文は枠中央基準)' : '欧文底線 (基準)'}
          </text>
        </g>

        {/* Descender (-200 / y=1000) */}
        <g opacity={latinMetricsOpacity}>
          <line
            x1={-100}
            y1={1000}
            x2={1100}
            y2={1000}
            stroke="#f97316"
            strokeWidth={1.2}
            strokeDasharray="6 3"
          />
          <text x={-95} y={992} fill="#f97316" fontWeight="bold" opacity={1.0}>Descender (-200) 欧文下突抜</text>
        </g>

        {/* Vertical Center Axis (X=500 / 左右中心線) */}
        {showVerticalCenter && (
          <g opacity={0.6 * opacityScale}>
            <line
              x1={500}
              y1={-50}
              x2={500}
              y2={1050}
              stroke="#8b5cf6"
              strokeWidth={1.2}
              strokeDasharray="6 4"
            />
            <text
              x={506}
              y={-20}
              fill="#8b5cf6"
              fontWeight="bold"
              opacity={1.0}
            >
              Center (500) 左右中心
            </text>
          </g>
        )}

        {/* LSB (Left Side Bearing) */}
        <g opacity={0.65 * opacityScale}>
          <line
            x1={lsb}
            y1={-50}
            x2={lsb}
            y2={1050}
            stroke="#10b981"
            strokeWidth={1.4}
            strokeDasharray="4 2"
          />
          <text x={lsb + 6} y={-20} fill="#10b981" fontWeight="bold" opacity={1.0}>LSB: {lsb}</text>
        </g>

        {/* RSB / Advance Width */}
        <g opacity={0.65 * opacityScale}>
          <line
            x1={advanceWidth}
            y1={-50}
            x2={advanceWidth}
            y2={1050}
            stroke="#10b981"
            strokeWidth={1.4}
            strokeDasharray="4 2"
          />
          <text
            x={advanceWidth > lsb + 160 ? advanceWidth - 6 : advanceWidth + 6}
            textAnchor={advanceWidth > lsb + 160 ? 'end' : 'start'}
            y={-20}
            fill="#10b981"
            fontWeight="bold"
            opacity={1.0}
          >
            Advance: {advanceWidth}
          </text>
        </g>
      </g>
    );
  }
);
