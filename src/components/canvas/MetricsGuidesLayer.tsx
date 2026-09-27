import React from 'react';

interface MetricsGuidesLayerProps {
  showMetrics: boolean;
  lsb: number;
  advanceWidth: number;
  activeChar?: string;
  isLight?: boolean;
}

export const MetricsGuidesLayer: React.FC<MetricsGuidesLayerProps> = React.memo(
  ({ showMetrics, lsb, advanceWidth, activeChar = '', isLight = true }) => {
    if (!showMetrics) return null;

    const isKana = /[ぁ-んァ-ヶー]/.test(activeChar);
    const isKanji = /[\u4e00-\u9faf\u3400-\u4dbf]/.test(activeChar);
    const isJapanese = isKana || isKanji;

    // When drafting Japanese characters, dim Western-specific metrics to avoid visual confusion
    const latinMetricsOpacity = isJapanese ? 0.32 : 0.85;

    return (
      <g className="metrics-guides-layer select-none font-mono text-[11px] pointer-events-none">
        {/* Ascender (+800 / y=200) */}
        <g opacity={latinMetricsOpacity}>
          <line x1={-100} y1={200} x2={1100} y2={200} stroke="#2563eb" strokeWidth={1.5} strokeDasharray="6 3" />
          <text x={-95} y={192} fill="#2563eb">Ascender (+800) 欧文上突抜</text>
        </g>

        {/* Cap Height (+700 / y=300) */}
        <g opacity={latinMetricsOpacity}>
          <line x1={-100} y1={300} x2={1100} y2={300} stroke="#0284c7" strokeWidth={1} strokeDasharray="3 3" />
          <text x={-95} y={292} fill="#0284c7">Cap Height (+700) 欧文大文字頭</text>
        </g>

        {/* X-Height (+500 / y=500) */}
        <g opacity={latinMetricsOpacity}>
          <line x1={-100} y1={500} x2={1100} y2={500} stroke="#0284c7" strokeWidth={1} strokeDasharray="3 3" />
          <text x={-95} y={492} fill="#0284c7">X-Height (+500) 欧文小文字頭</text>
        </g>

        {/* Baseline (0 / y=800) */}
        <g opacity={isJapanese ? 0.45 : 1}>
          <line x1={-100} y1={800} x2={1100} y2={800} stroke="#dc2626" strokeWidth={isJapanese ? 1.5 : 2} strokeDasharray={isJapanese ? '8 4' : undefined} />
          <text x={-95} y={792} fill="#dc2626" fontWeight="bold">
            Baseline (0) {isJapanese ? '欧文底線 (和文は枠中央基準)' : '欧文底線 (基準)'}
          </text>
        </g>

        {/* Descender (-200 / y=1000) */}
        <g opacity={latinMetricsOpacity}>
          <line x1={-100} y1={1000} x2={1100} y2={1000} stroke="#ea580c" strokeWidth={1.5} strokeDasharray="6 3" />
          <text x={-95} y={992} fill="#ea580c">Descender (-200) 欧文下突抜</text>
        </g>

        {/* LSB (Left Side Bearing) */}
        <line
          x1={lsb}
          y1={-50}
          x2={lsb}
          y2={1050}
          stroke="#059669"
          strokeWidth={2}
          strokeDasharray="4 2"
          opacity={0.8}
        />
        <text x={lsb + 6} y={-20} fill="#059669" fontWeight="bold">LSB: {lsb}</text>

        {/* RSB / Advance Width */}
        <line
          x1={advanceWidth}
          y1={-50}
          x2={advanceWidth}
          y2={1050}
          stroke="#059669"
          strokeWidth={2}
          strokeDasharray="4 2"
          opacity={0.8}
        />
        <text
          x={advanceWidth > lsb + 160 ? advanceWidth - 6 : advanceWidth + 6}
          textAnchor={advanceWidth > lsb + 160 ? 'end' : 'start'}
          y={-20}
          fill="#059669"
          fontWeight="bold"
        >
          Advance: {advanceWidth}
        </text>
      </g>
    );
  }
);
