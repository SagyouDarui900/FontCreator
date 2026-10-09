import React, { useState } from 'react';
import { CustomGuideline } from '../../types';

interface CustomGuidelinesLayerProps {
  customGuidelines: CustomGuideline[];
  zoom: number;
  locked?: boolean;
  interactive?: boolean;
  unitsPerEm?: number;
  isGuideEraserActive?: boolean;
  onPointerDownGuide: (e: React.PointerEvent, guideId: string) => void;
  onDoubleClickGuide: (e: React.MouseEvent, guideId: string) => void;
  onDeleteGuide?: (guideId: string) => void;
}

export const CustomGuidelinesLayer: React.FC<CustomGuidelinesLayerProps> = React.memo(
  ({
    customGuidelines,
    zoom,
    locked = true,
    interactive = false,
    unitsPerEm = 1000,
    isGuideEraserActive = false,
    onPointerDownGuide,
    onDoubleClickGuide,
    onDeleteGuide,
  }) => {
    const [hoveredGuideId, setHoveredGuideId] = useState<string | null>(null);

    if (customGuidelines.length === 0) return null;

    const canInteract = (interactive && !locked) || isGuideEraserActive;
    const upm = unitsPerEm || 1000;
    const spanEnd = upm + 300;
    const spanStart = -300;

    // Helper to calculate infinite line points for diagonal guideline
    const getDiagonalLineEndpoints = (guide: CustomGuideline) => {
      const p1 = guide.p1 || { x: 500, y: 500 };
      let dx = 1;
      let dy = 0;

      if (guide.p2 && (Math.abs(guide.p2.x - p1.x) > 0.001 || Math.abs(guide.p2.y - p1.y) > 0.001)) {
        dx = guide.p2.x - p1.x;
        dy = guide.p2.y - p1.y;
      } else if (guide.angle !== undefined) {
        const rad = (guide.angle * Math.PI) / 180;
        dx = Math.cos(rad);
        dy = Math.sin(rad);
      }

      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const span = Math.max(upm * 4, 6000);

      return {
        x1: p1.x - ux * span,
        y1: p1.y - uy * span,
        x2: p1.x + ux * span,
        y2: p1.y + uy * span,
        originX: p1.x,
        originY: p1.y,
        angleDeg: guide.angle !== undefined ? Math.round(guide.angle * 10) / 10 : Math.round((Math.atan2(dy, dx) * 180 / Math.PI) * 10) / 10,
      };
    };

    const handleGuideClick = (e: React.PointerEvent, guideId: string) => {
      if (isGuideEraserActive && onDeleteGuide) {
        e.stopPropagation();
        e.preventDefault();
        onDeleteGuide(guideId);
        return;
      }
      onPointerDownGuide(e, guideId);
    };

    return (
      <g
        className={`custom-guidelines-layer select-none ${
          canInteract ? '' : 'pointer-events-none'
        }`}
      >
        {customGuidelines.map((guide) => {
          const isHovered = hoveredGuideId === guide.id;
          const strokeColor = isGuideEraserActive && isHovered
            ? '#ef4444' // Red highlight on eraser hover
            : isHovered
            ? '#22d3ee' // Bright cyan on hover
            : guide.color || '#06b6d4'; // Cyan default

          if (guide.type === 'diagonal') {
            const diag = getDiagonalLineEndpoints(guide);
            return (
              <g
                key={guide.id}
                className={canInteract ? 'cursor-pointer group' : 'pointer-events-none'}
                onPointerEnter={() => canInteract && setHoveredGuideId(guide.id)}
                onPointerLeave={() => canInteract && setHoveredGuideId(null)}
                onPointerDown={canInteract ? (e) => handleGuideClick(e, guide.id) : undefined}
                onDoubleClick={canInteract && !isGuideEraserActive ? (e) => onDoubleClickGuide(e, guide.id) : undefined}
              >
                {/* Hit area */}
                {canInteract && (
                  <line
                    x1={diag.x1}
                    y1={diag.y1}
                    x2={diag.x2}
                    y2={diag.y2}
                    stroke="transparent"
                    strokeWidth={18 / zoom}
                    className={isGuideEraserActive ? 'cursor-not-allowed' : 'cursor-move'}
                  />
                )}
                {/* Visible guide line */}
                <line
                  x1={diag.x1}
                  y1={diag.y1}
                  x2={diag.x2}
                  y2={diag.y2}
                  stroke={strokeColor}
                  strokeWidth={(isHovered ? 2 : 1.5) / zoom}
                  strokeDasharray="6 3"
                  className="transition-colors"
                />

                {/* Angle badge & quick delete badge */}
                <g
                  transform={`translate(${diag.originX}, ${diag.originY})`}
                  className="pointer-events-auto"
                >
                  <rect
                    x={-28 / zoom}
                    y={-18 / zoom}
                    width={56 / zoom}
                    height={16 / zoom}
                    rx={3 / zoom}
                    fill={isGuideEraserActive && isHovered ? '#ef4444' : '#0f172a'}
                    stroke={strokeColor}
                    strokeWidth={1 / zoom}
                    opacity={0.92}
                  />
                  <text
                    x={0}
                    y={-7 / zoom}
                    fill={isGuideEraserActive && isHovered ? '#ffffff' : '#38bdf8'}
                    fontSize={9 / zoom}
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="select-none pointer-events-none"
                  >
                    {isGuideEraserActive && isHovered ? '削除' : `${diag.angleDeg}°`}
                  </text>

                  {/* Individual delete 'x' button when hovered and not in mass eraser mode */}
                  {canInteract && isHovered && !isGuideEraserActive && onDeleteGuide && (
                    <g
                      transform={`translate(${34 / zoom}, ${-10 / zoom})`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteGuide(guide.id);
                      }}
                    >
                      <circle
                        r={7 / zoom}
                        fill="#ef4444"
                        stroke="#ffffff"
                        strokeWidth={1 / zoom}
                      />
                      <text
                        x={0}
                        y={2.5 / zoom}
                        fill="#ffffff"
                        fontSize={8 / zoom}
                        fontWeight="bold"
                        textAnchor="middle"
                        className="select-none"
                      >
                        ×
                      </text>
                    </g>
                  )}
                </g>
              </g>
            );
          }

          return (
            <g
              key={guide.id}
              className={canInteract ? 'cursor-pointer group' : 'pointer-events-none'}
              onPointerEnter={() => canInteract && setHoveredGuideId(guide.id)}
              onPointerLeave={() => canInteract && setHoveredGuideId(null)}
              onPointerDown={canInteract ? (e) => handleGuideClick(e, guide.id) : undefined}
              onDoubleClick={canInteract && !isGuideEraserActive ? (e) => onDoubleClickGuide(e, guide.id) : undefined}
            >
              {guide.type === 'h' ? (
                <>
                  {/* Hit area */}
                  {canInteract && (
                    <line
                      x1={spanStart}
                      y1={guide.position}
                      x2={spanEnd}
                      y2={guide.position}
                      stroke="transparent"
                      strokeWidth={18 / zoom}
                      className={isGuideEraserActive ? 'cursor-not-allowed' : 'cursor-ns-resize'}
                    />
                  )}
                  {/* Visible guideline */}
                  <line
                    x1={spanStart}
                    y1={guide.position}
                    x2={spanEnd}
                    y2={guide.position}
                    stroke={strokeColor}
                    strokeWidth={(isHovered ? 2 : 1.5) / zoom}
                    strokeDasharray="5 3"
                    className="transition-colors"
                  />
                  {/* Label badge */}
                  <g transform={`translate(${-50}, ${guide.position})`}>
                    <rect
                      x={-5 / zoom}
                      y={-14 / zoom}
                      width={(isGuideEraserActive && isHovered ? 40 : 54) / zoom}
                      height={14 / zoom}
                      rx={2 / zoom}
                      fill={isGuideEraserActive && isHovered ? '#ef4444' : '#0f172a'}
                      stroke={strokeColor}
                      strokeWidth={1 / zoom}
                      opacity={0.9}
                    />
                    <text
                      x={((isGuideEraserActive && isHovered ? 40 : 54) / 2 - 5) / zoom}
                      y={-3 / zoom}
                      fill={isGuideEraserActive && isHovered ? '#ffffff' : strokeColor}
                      fontSize={9 / zoom}
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="select-none pointer-events-none"
                    >
                      {isGuideEraserActive && isHovered ? '削除' : `Y: ${Math.round(guide.position)}`}
                    </text>

                    {/* Quick delete 'x' button on hover */}
                    {canInteract && isHovered && !isGuideEraserActive && onDeleteGuide && (
                      <g
                        transform={`translate(${55 / zoom}, ${-7 / zoom})`}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteGuide(guide.id);
                        }}
                      >
                        <circle
                          r={6 / zoom}
                          fill="#ef4444"
                          stroke="#ffffff"
                          strokeWidth={1 / zoom}
                        />
                        <text
                          x={0}
                          y={2.2 / zoom}
                          fill="#ffffff"
                          fontSize={7.5 / zoom}
                          fontWeight="bold"
                          textAnchor="middle"
                          className="select-none"
                        >
                          ×
                        </text>
                      </g>
                    )}
                  </g>
                </>
              ) : (
                <>
                  {/* Hit area */}
                  {canInteract && (
                    <line
                      x1={guide.position}
                      y1={spanStart}
                      x2={guide.position}
                      y2={spanEnd}
                      stroke="transparent"
                      strokeWidth={18 / zoom}
                      className={isGuideEraserActive ? 'cursor-not-allowed' : 'cursor-ew-resize'}
                    />
                  )}
                  {/* Visible guideline */}
                  <line
                    x1={guide.position}
                    y1={spanStart}
                    x2={guide.position}
                    y2={spanEnd}
                    stroke={strokeColor}
                    strokeWidth={(isHovered ? 2 : 1.5) / zoom}
                    strokeDasharray="5 3"
                    className="transition-colors"
                  />
                  {/* Label badge */}
                  <g transform={`translate(${guide.position}, ${-20})`}>
                    <rect
                      x={-24 / zoom}
                      y={-14 / zoom}
                      width={(isGuideEraserActive && isHovered ? 40 : 54) / zoom}
                      height={14 / zoom}
                      rx={2 / zoom}
                      fill={isGuideEraserActive && isHovered ? '#ef4444' : '#0f172a'}
                      stroke={strokeColor}
                      strokeWidth={1 / zoom}
                      opacity={0.9}
                    />
                    <text
                      x={((isGuideEraserActive && isHovered ? 40 : 54) / 2 - 24) / zoom}
                      y={-3 / zoom}
                      fill={isGuideEraserActive && isHovered ? '#ffffff' : strokeColor}
                      fontSize={9 / zoom}
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="select-none pointer-events-none"
                    >
                      {isGuideEraserActive && isHovered ? '削除' : `X: ${Math.round(guide.position)}`}
                    </text>

                    {/* Quick delete 'x' button on hover */}
                    {canInteract && isHovered && !isGuideEraserActive && onDeleteGuide && (
                      <g
                        transform={`translate(${35 / zoom}, ${-7 / zoom})`}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteGuide(guide.id);
                        }}
                      >
                        <circle
                          r={6 / zoom}
                          fill="#ef4444"
                          stroke="#ffffff"
                          strokeWidth={1 / zoom}
                        />
                        <text
                          x={0}
                          y={2.2 / zoom}
                          fill="#ffffff"
                          fontSize={7.5 / zoom}
                          fontWeight="bold"
                          textAnchor="middle"
                          className="select-none"
                        >
                          ×
                        </text>
                      </g>
                    )}
                  </g>
                </>
              )}
            </g>
          );
        })}
      </g>
    );
  }
);
CustomGuidelinesLayer.displayName = 'CustomGuidelinesLayer';
