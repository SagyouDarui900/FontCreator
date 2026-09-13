import React from 'react';
import { CustomGuideline } from '../../types';

interface CustomGuidelinesLayerProps {
  customGuidelines: CustomGuideline[];
  zoom: number;
  locked?: boolean;
  interactive?: boolean;
  onPointerDownGuide: (e: React.PointerEvent, guideId: string) => void;
  onDoubleClickGuide: (e: React.MouseEvent, guideId: string) => void;
}

export const CustomGuidelinesLayer: React.FC<CustomGuidelinesLayerProps> = React.memo(
  ({
    customGuidelines,
    zoom,
    locked = true,
    interactive = false,
    onPointerDownGuide,
    onDoubleClickGuide,
  }) => {
    if (customGuidelines.length === 0) return null;

    const canInteract = interactive && !locked;

    return (
      <g
        className={`custom-guidelines-layer select-none ${
          canInteract ? '' : 'pointer-events-none'
        }`}
      >
        {customGuidelines.map((guide) => (
          <g
            key={guide.id}
            className={canInteract ? 'cursor-pointer group' : 'pointer-events-none'}
            onPointerDown={canInteract ? (e) => onPointerDownGuide(e, guide.id) : undefined}
            onDoubleClick={canInteract ? (e) => onDoubleClickGuide(e, guide.id) : undefined}
          >
            {guide.type === 'h' ? (
              <>
                {/* Fat hit area (only interactive when allowed) */}
                {canInteract && (
                  <line
                    x1={-200}
                    y1={guide.position}
                    x2={1200}
                    y2={guide.position}
                    stroke="transparent"
                    strokeWidth={14 / zoom}
                    className="cursor-ns-resize"
                  />
                )}
                <line
                  x1={-200}
                  y1={guide.position}
                  x2={1200}
                  y2={guide.position}
                  stroke="#06b6d4"
                  strokeWidth={1.5 / zoom}
                  strokeDasharray="5 3"
                  className={
                    canInteract
                      ? 'group-hover:stroke-cyan-300 transition-colors cursor-ns-resize'
                      : 'pointer-events-none opacity-80'
                  }
                />
                <text
                  x={-40}
                  y={guide.position - 4 / zoom}
                  fill="#06b6d4"
                  fontSize={10 / zoom}
                  fontFamily="monospace"
                  className="select-none pointer-events-none"
                >
                  Y: {Math.round(guide.position)}
                </text>
              </>
            ) : (
              <>
                {/* Fat hit area (only interactive when allowed) */}
                {canInteract && (
                  <line
                    x1={guide.position}
                    y1={-200}
                    x2={guide.position}
                    y2={1200}
                    stroke="transparent"
                    strokeWidth={14 / zoom}
                    className="cursor-ew-resize"
                  />
                )}
                <line
                  x1={guide.position}
                  y1={-200}
                  x2={guide.position}
                  y2={1200}
                  stroke="#06b6d4"
                  strokeWidth={1.5 / zoom}
                  strokeDasharray="5 3"
                  className={
                    canInteract
                      ? 'group-hover:stroke-cyan-300 transition-colors cursor-ew-resize'
                      : 'pointer-events-none opacity-80'
                  }
                />
                <text
                  x={guide.position + 4 / zoom}
                  y={-10}
                  fill="#06b6d4"
                  fontSize={10 / zoom}
                  fontFamily="monospace"
                  className="select-none pointer-events-none"
                >
                  X: {Math.round(guide.position)}
                </text>
              </>
            )}
          </g>
        ))}
      </g>
    );
  }
);

