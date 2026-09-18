import React from 'react';
import { TraceSettings, ToolMode } from '../../types';

const SCREEN_BASELINE_Y = 800;

export type TraceResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';

interface TraceReferenceLayerProps {
  traceSettings: TraceSettings;
  isLight: boolean;
  activeChar: string;
  selectedUnicode?: string;
  toolMode: ToolMode;
  onPointerDownImage?: (e: React.PointerEvent) => void;
  onPointerDownResize?: (e: React.PointerEvent, handle: TraceResizeHandle) => void;
  onDoubleClickReset?: () => void;
  isResizing?: boolean;
}

export const TraceReferenceLayer: React.FC<TraceReferenceLayerProps> = React.memo(
  ({
    traceSettings,
    isLight,
    activeChar,
    selectedUnicode,
    toolMode,
    onPointerDownImage,
    onPointerDownResize,
    onDoubleClickReset,
  }) => {
    if (!traceSettings.enabled) return null;

    const scale = traceSettings.scale ?? 1;
    const offsetX = traceSettings.offsetX ?? 0;
    const offsetY = traceSettings.offsetY ?? 0;
    const isAdjustMode = toolMode === 'trace_adjust';

    const charToRender = traceSettings.text || activeChar || 'あ';
    const isKana = /[ぁ-んァ-ヶー]/.test(charToRender);
    const isKanji = /[\u4e00-\u9faf\u3400-\u4dbf]/.test(charToRender);
    const isJapanese = isKana || isKanji || /[、。々〆〇\u3000-\u303F\uFF01-\uFF60]/.test(charToRender);

    // Char bounding box virtual dimension (centered around 500, 500)
    const charBoxSize = isKana ? 780 : isKanji ? 850 : 800;
    const charBoxX = 500 - charBoxSize / 2;
    const charBoxY = 500 - charBoxSize / 2;

    // Image bounding box (0, 0, 1000, 1000)
    const imgBoxX = 0;
    const imgBoxY = 0;
    const imgBoxSize = 1000;

    const activeBoxX = traceSettings.type === 'char' ? charBoxX : imgBoxX;
    const activeBoxY = traceSettings.type === 'char' ? charBoxY : imgBoxY;
    const activeBoxW = traceSettings.type === 'char' ? charBoxSize : imgBoxSize;
    const activeBoxH = traceSettings.type === 'char' ? charBoxSize : imgBoxSize;

    return (
      <g
        className="trace-reference-layer"
        opacity={traceSettings.opacity ?? 0.25}
        // Center-anchored scale transformation around (500, 500)
        transform={`translate(${offsetX}, ${offsetY}) translate(500, 500) scale(${scale}) translate(-500, -500)`}
      >
        {traceSettings.type === 'char' ? (
          <g>
            {isJapanese ? (
              // 和文（ひらがな・カタカナ・漢字）: 十字格 (500, 500) および 字面枠 (78% / 85%) に完全一致する中央揃え
              <text
                x={500}
                y={500}
                dominantBaseline="central"
                textAnchor="middle"
                fontSize={traceSettings.fontSize || 1000}
                fontFamily={traceSettings.fontFamily || "'Noto Sans JP', sans-serif"}
                fill={isLight ? '#0284c7' : '#38bdf8'}
                className="font-normal pointer-events-none select-none"
              >
                {charToRender}
              </text>
            ) : (
              // 欧文（アルファベット等）: Baseline (y=800) 揃え
              <text
                x={500}
                y={SCREEN_BASELINE_Y}
                textAnchor="middle"
                fontSize={traceSettings.fontSize || 800}
                fontFamily={traceSettings.fontFamily || "'Noto Sans JP', sans-serif"}
                fill={isLight ? '#0284c7' : '#38bdf8'}
                className="font-normal pointer-events-none select-none"
              >
                {charToRender}
              </text>
            )}

            {/* In Trace Adjust Mode: Interactive Move Backdrop for Char */}
            {isAdjustMode && (
              <rect
                x={charBoxX}
                y={charBoxY}
                width={charBoxSize}
                height={charBoxSize}
                fill="transparent"
                stroke={isLight ? '#0284c7' : '#38bdf8'}
                strokeWidth={2}
                strokeDasharray="6 4"
                className="cursor-move pointer-events-auto hover:stroke-emerald-500 transition-colors"
                onPointerDown={onPointerDownImage}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDoubleClickReset?.();
                }}
              />
            )}
          </g>
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
              {isAdjustMode && (
                <rect
                  x={0}
                  y={0}
                  width={1000}
                  height={1000}
                  fill="transparent"
                  stroke={isLight ? '#0284c7' : '#38bdf8'}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  className="cursor-move pointer-events-auto hover:stroke-emerald-500 transition-colors"
                  onPointerDown={onPointerDownImage}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onDoubleClickReset?.();
                  }}
                />
              )}
            </g>
          );
        })()}

        {/* INTERACTIVE RESIZE BOUNDING BOX & CORNER HANDLES IN ADJUST MODE */}
        {isAdjustMode && (
          <g className="trace-adjust-handles pointer-events-auto select-none">
            {/* Center Cross Indicator */}
            <line
              x1={485}
              y1={500}
              x2={515}
              y2={500}
              stroke={isLight ? '#0284c7' : '#38bdf8'}
              strokeWidth={1.5}
            />
            <line
              x1={500}
              y1={485}
              x2={500}
              y2={515}
              stroke={isLight ? '#0284c7' : '#38bdf8'}
              strokeWidth={1.5}
            />

            {/* Corner Resize Handles */}
            {/* Top-Left (NW) */}
            <g
              transform={`translate(${activeBoxX}, ${activeBoxY})`}
              className="cursor-nwse-resize"
              onPointerDown={(e) => onPointerDownResize?.(e, 'nw')}
            >
              <rect
                x={-9}
                y={-9}
                width={18}
                height={18}
                fill={isLight ? '#ffffff' : '#0f172a'}
                stroke={isLight ? '#0284c7' : '#38bdf8'}
                strokeWidth={2.5}
                rx={3}
                className="hover:fill-emerald-400 hover:stroke-emerald-600 transition-colors"
              />
            </g>

            {/* Top-Right (NE) */}
            <g
              transform={`translate(${activeBoxX + activeBoxW}, ${activeBoxY})`}
              className="cursor-nesw-resize"
              onPointerDown={(e) => onPointerDownResize?.(e, 'ne')}
            >
              <rect
                x={-9}
                y={-9}
                width={18}
                height={18}
                fill={isLight ? '#ffffff' : '#0f172a'}
                stroke={isLight ? '#0284c7' : '#38bdf8'}
                strokeWidth={2.5}
                rx={3}
                className="hover:fill-emerald-400 hover:stroke-emerald-600 transition-colors"
              />
            </g>

            {/* Bottom-Right (SE) */}
            <g
              transform={`translate(${activeBoxX + activeBoxW}, ${activeBoxY + activeBoxH})`}
              className="cursor-nwse-resize"
              onPointerDown={(e) => onPointerDownResize?.(e, 'se')}
            >
              <rect
                x={-9}
                y={-9}
                width={18}
                height={18}
                fill={isLight ? '#ffffff' : '#0f172a'}
                stroke={isLight ? '#0284c7' : '#38bdf8'}
                strokeWidth={2.5}
                rx={3}
                className="hover:fill-emerald-400 hover:stroke-emerald-600 transition-colors"
              />
            </g>

            {/* Bottom-Left (SW) */}
            <g
              transform={`translate(${activeBoxX}, ${activeBoxY + activeBoxH})`}
              className="cursor-nesw-resize"
              onPointerDown={(e) => onPointerDownResize?.(e, 'sw')}
            >
              <rect
                x={-9}
                y={-9}
                width={18}
                height={18}
                fill={isLight ? '#ffffff' : '#0f172a'}
                stroke={isLight ? '#0284c7' : '#38bdf8'}
                strokeWidth={2.5}
                rx={3}
                className="hover:fill-emerald-400 hover:stroke-emerald-600 transition-colors"
              />
            </g>

            {/* Scale % Tag at Top-Center of Bounding Box */}
            <g
              transform={`translate(500, ${activeBoxY - 14})`}
              className="pointer-events-none"
            >
              <rect
                x={-42}
                y={-14}
                width={84}
                height={20}
                rx={10}
                fill={isLight ? '#0284c7' : '#0369a1'}
                stroke="#ffffff"
                strokeWidth={1.5}
              />
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize={11}
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                {Math.round(scale * 100)}%
              </text>
            </g>
          </g>
        )}
      </g>
    );
  }
);

