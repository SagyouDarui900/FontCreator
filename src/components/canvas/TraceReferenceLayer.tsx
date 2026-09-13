import React from 'react';
import { TraceSettings, ToolMode } from '../../types';

const SCREEN_BASELINE_Y = 800;

interface TraceReferenceLayerProps {
  traceSettings: TraceSettings;
  isLight: boolean;
  activeChar: string;
  selectedUnicode?: string;
  toolMode: ToolMode;
  onPointerDownImage?: (e: React.PointerEvent) => void;
}

export const TraceReferenceLayer: React.FC<TraceReferenceLayerProps> = React.memo(
  ({
    traceSettings,
    isLight,
    activeChar,
    selectedUnicode,
    toolMode,
    onPointerDownImage,
  }) => {
    if (!traceSettings.enabled) return null;

    return (
      <g
        className="trace-reference-layer"
        opacity={traceSettings.opacity}
        transform={`translate(${traceSettings.offsetX}, ${traceSettings.offsetY}) scale(${traceSettings.scale})`}
      >
        {traceSettings.type === 'char' ? (
          <text
            x={500}
            y={SCREEN_BASELINE_Y}
            textAnchor="middle"
            fontSize={traceSettings.fontSize || 800}
            fontFamily={traceSettings.fontFamily || 'serif'}
            fill={isLight ? '#0284c7' : '#38bdf8'}
            className="font-normal pointer-events-none select-none"
          >
            {traceSettings.text || activeChar}
          </text>
        ) : (() => {
          const currentImageSrc =
            (selectedUnicode && traceSettings.charImages?.[selectedUnicode]) ||
            traceSettings.imageSrc;
          if (!currentImageSrc) return null;

          const filterStyle: React.CSSProperties = {
            filter: `
              contrast(${traceSettings.contrast || 1})
              brightness(${traceSettings.brightness || 1})
              ${traceSettings.grayscale ? 'grayscale(100%)' : ''}
              ${traceSettings.invert ? 'invert(100%)' : ''}
            `.trim(),
          };

          return (
            <g
              transform={`
                rotate(${traceSettings.rotation || 0}, 500, 500)
                scale(${traceSettings.flipH ? -1 : 1}, ${traceSettings.flipV ? -1 : 1})
              `}
              style={{ transformOrigin: '500px 500px' }}
            >
              <image
                href={currentImageSrc}
                x={0}
                y={0}
                width={1000}
                height={1000}
                preserveAspectRatio="xMidYMid meet"
                style={filterStyle}
                className="pointer-events-none select-none"
              />
              {toolMode === 'trace_adjust' && (
                <rect
                  x={0}
                  y={0}
                  width={1000}
                  height={1000}
                  fill="transparent"
                  stroke="#0284c7"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  className="cursor-move pointer-events-auto"
                  onPointerDown={onPointerDownImage}
                />
              )}
            </g>
          );
        })()}
      </g>
    );
  }
);
