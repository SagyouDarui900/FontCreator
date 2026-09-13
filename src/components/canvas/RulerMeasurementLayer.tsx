import React from 'react';
import { Point } from '../../types';

interface RulerMeasurementLayerProps {
  rulerMeasurement: { start: Point; end: Point; active?: boolean } | null;
  zoom: number;
  onDrawLine?: () => void;
  onConvertToGuide?: () => void;
}

export const RulerMeasurementLayer: React.FC<RulerMeasurementLayerProps> = React.memo(
  ({ rulerMeasurement, zoom, onDrawLine, onConvertToGuide }) => {
    if (!rulerMeasurement) return null;

    const { start, end, active } = rulerMeasurement;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);
    const angleDeg = Math.round((Math.atan2(-dy, dx) * 180) / Math.PI);
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    return (
      <g className="ruler-measurement-layer select-none">
        {/* Delta X / Delta Y Projection lines */}
        {Math.abs(dx) > 10 && Math.abs(dy) > 10 && (
          <g className="pointer-events-none">
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={start.y}
              stroke="#0ea5e9"
              strokeWidth={1 / zoom}
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
            <line
              x1={end.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#0ea5e9"
              strokeWidth={1 / zoom}
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
            <text
              x={(start.x + end.x) / 2}
              y={start.y - 4 / zoom}
              fill="#0284c7"
              fontSize={9.5 / zoom}
              fontFamily="monospace"
              textAnchor="middle"
            >
              ΔX: {Math.round(Math.abs(dx))}px
            </text>
            <text
              x={end.x + (dx >= 0 ? 6 : -6) / zoom}
              y={(start.y + end.y) / 2}
              fill="#0284c7"
              fontSize={9.5 / zoom}
              fontFamily="monospace"
              textAnchor={dx >= 0 ? 'start' : 'end'}
            >
              ΔY: {Math.round(Math.abs(dy))}px
            </text>
          </g>
        )}

        {/* Main Ruler Measurement Vector Line */}
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="#0284c7"
          strokeWidth={2.5 / zoom}
          className="pointer-events-none"
        />

        {/* Start Point Marker */}
        <circle
          cx={start.x}
          cy={start.y}
          r={4.5 / zoom}
          fill="#0284c7"
          stroke="#ffffff"
          strokeWidth={1.5 / zoom}
          className="pointer-events-none"
        />

        {/* End Point Marker */}
        <circle
          cx={end.x}
          cy={end.y}
          r={4.5 / zoom}
          fill="#0369a1"
          stroke="#ffffff"
          strokeWidth={1.5 / zoom}
          className="pointer-events-none"
        />

        {/* Measurement HUD Pill Box */}
        <g transform={`translate(${midX}, ${midY})`}>
          <rect
            x={-60 / zoom}
            y={-14 / zoom}
            width={120 / zoom}
            height={28 / zoom}
            rx={14 / zoom}
            fill="#0369a1"
            fillOpacity={0.92}
            stroke="#ffffff"
            strokeWidth={1 / zoom}
            className="pointer-events-none"
          />
          <text
            x={0}
            y={-1 / zoom}
            fill="#ffffff"
            fontSize={10 / zoom}
            fontWeight="bold"
            fontFamily="monospace"
            textAnchor="middle"
            dominantBaseline="middle"
            className="pointer-events-none"
          >
            {Math.round(dist)}px
          </text>
          <text
            x={0}
            y={9 / zoom}
            fill="#bae6fd"
            fontSize={7.5 / zoom}
            fontFamily="monospace"
            textAnchor="middle"
            className="pointer-events-none"
          >
            {angleDeg}°
          </text>

          {/* Interactive Action Buttons when measurement is completed */}
          {!active && dist >= 8 && (
            <g transform={`translate(0, ${22 / zoom})`} className="pointer-events-auto cursor-pointer">
              {/* Draw Line Button */}
              {onDrawLine && (
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    onDrawLine();
                  }}
                  className="hover:opacity-90 active:scale-95 transition-transform"
                >
                  <rect
                    x={-58 / zoom}
                    y={0}
                    width={56 / zoom}
                    height={18 / zoom}
                    rx={9 / zoom}
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth={0.8 / zoom}
                  />
                  <text
                    x={-30 / zoom}
                    y={11.5 / zoom}
                    fill="#ffffff"
                    fontSize={8.5 / zoom}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    直線化
                  </text>
                </g>
              )}

              {/* Guide Line Button */}
              {onConvertToGuide && (
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    onConvertToGuide();
                  }}
                  className="hover:opacity-90 active:scale-95 transition-transform"
                >
                  <rect
                    x={2 / zoom}
                    y={0}
                    width={56 / zoom}
                    height={18 / zoom}
                    rx={9 / zoom}
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth={0.8 / zoom}
                  />
                  <text
                    x={30 / zoom}
                    y={11.5 / zoom}
                    fill="#ffffff"
                    fontSize={8.5 / zoom}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    ガイド化
                  </text>
                </g>
              )}
            </g>
          )}
        </g>
      </g>
    );
  }
);
