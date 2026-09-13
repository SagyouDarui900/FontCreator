import React from 'react';

interface MetricsGuidesLayerProps {
  showMetrics: boolean;
  lsb: number;
  advanceWidth: number;
}

export const MetricsGuidesLayer: React.FC<MetricsGuidesLayerProps> = React.memo(
  ({ showMetrics, lsb, advanceWidth }) => {
    if (!showMetrics) return null;

    return (
      <g className="metrics-guides-layer select-none font-mono text-[11px] pointer-events-none">
        {/* Ascender (+800) */}
        <line x1={-100} y1={200} x2={1100} y2={200} stroke="#2563eb" strokeWidth={1.5} strokeDasharray="6 3" />
        <text x={-95} y={192} fill="#2563eb">Ascender (+800)</text>

        {/* Cap Height (+700) */}
        <line x1={-100} y1={300} x2={1100} y2={300} stroke="#0284c7" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
        <text x={-95} y={292} fill="#0284c7" opacity={0.7}>Cap Height (+700)</text>

        {/* X-Height (+500) */}
        <line x1={-100} y1={500} x2={1100} y2={500} stroke="#0284c7" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
        <text x={-95} y={492} fill="#0284c7" opacity={0.7}>X-Height (+500)</text>

        {/* Baseline (0) */}
        <line x1={-100} y1={800} x2={1100} y2={800} stroke="#dc2626" strokeWidth={2} />
        <text x={-95} y={792} fill="#dc2626" fontWeight="bold">Baseline (0)</text>

        {/* Descender (-200) */}
        <line x1={-100} y1={1000} x2={1100} y2={1000} stroke="#ea580c" strokeWidth={1.5} strokeDasharray="6 3" />
        <text x={-95} y={992} fill="#ea580c">Descender (-200)</text>

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
        <text x={advanceWidth - 90} y={-20} fill="#059669" fontWeight="bold">Advance: {advanceWidth}</text>
      </g>
    );
  }
);
