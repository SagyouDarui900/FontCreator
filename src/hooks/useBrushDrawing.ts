import React, { useRef, useCallback, useEffect } from 'react';
import {
  StrokePoint,
  Point,
  PathContour,
  ToolMode,
  BrushStyle,
  PressureCurveConfig,
  PenPresetInfo,
  UserPenPreset,
  CustomGuideline,
} from '../types';
import {
  strokePointsToOutline,
  contoursToSvgPath,
  generateStraightStrokePoints,
  snapToStraightAngle,
} from '../utils/pathUtils';

export const getDecimatedPointsForLivePreview = (pts: StrokePoint[]): StrokePoint[] => {
  if (pts.length <= 4) return pts;
  return pts.filter((_, idx) => idx % 2 === 0 || idx === pts.length - 1);
};

export interface UseBrushDrawingOptions {
  toolMode: ToolMode;
  brushWidth: number;
  brushStyle: BrushStyle;
  pressureSensitivity: 'high' | 'normal' | 'low' | 'off';
  pressureCurve?: PressureCurveConfig | null;
  smoothingIntensity: number;
  autoSmoothBrush?: boolean;
  smoothStrength?: 'light' | 'standard' | 'strong' | 'mild';
  activePenPreset?: PenPresetInfo | UserPenPreset | null;
  brushStraightMode?: boolean;
  customGuidelines?: CustomGuideline[];
  screenToCanvas: (clientX: number, clientY: number) => Point;
  contoursRef: React.MutableRefObject<PathContour[]>;
  onChangeContours: (contours: PathContour[]) => void;
  onCommitHistory?: () => void;
  setIsStylusActive?: (active: boolean) => void;
  isStylusActive?: boolean;
  onPressureUpdate?: (pressureVal: number) => void;
}

export interface UseBrushDrawingReturn {
  brushStrokePointsRef: React.MutableRefObject<StrokePoint[]>;
  activeBrushPathRef: React.RefObject<SVGPathElement | null>;
  activeBrushSvgDRef: React.MutableRefObject<string>;
  resetBrushDrawing: () => void;
  handleBrushPointerDown: (e: React.PointerEvent<SVGSVGElement>, pos: Point) => void;
  handleBrushPointerMove: (e: React.PointerEvent<SVGSVGElement>) => boolean;
  handleBrushPointerUp: (e: React.PointerEvent<SVGSVGElement>) => boolean;
  isActivelyDrawing: () => boolean;
}

export function useBrushDrawing(options: UseBrushDrawingOptions): UseBrushDrawingReturn {
  const {
    toolMode,
    brushWidth,
    brushStyle,
    pressureSensitivity,
    pressureCurve,
    smoothingIntensity,
    autoSmoothBrush,
    smoothStrength,
    activePenPreset,
    brushStraightMode,
    customGuidelines,
    screenToCanvas,
    contoursRef,
    onChangeContours,
    onCommitHistory,
    setIsStylusActive,
    isStylusActive,
    onPressureUpdate,
  } = options;

  const brushStrokePointsRef = useRef<StrokePoint[]>([]);
  const brushStrokeStartTimeRef = useRef<number>(0);
  const brushStrokeStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pendingBrushEventsRef = useRef<
    { clientX: number; clientY: number; pressure: number; timeStamp: number; pointerType: string }[]
  >([]);
  const activeBrushPathRef = useRef<SVGPathElement | null>(null);
  const activeBrushSvgDRef = useRef<string>('');
  const brushRafIdRef = useRef<number | null>(null);
  const mouseSmoothSpeedRef = useRef<number>(0.5);
  const lastBrushPointRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const resetBrushDrawing = useCallback(() => {
    if (brushRafIdRef.current != null) {
      cancelAnimationFrame(brushRafIdRef.current);
      brushRafIdRef.current = null;
    }
    brushStrokePointsRef.current = [];
    pendingBrushEventsRef.current = [];
    activeBrushSvgDRef.current = '';
    if (activeBrushPathRef.current) {
      activeBrushPathRef.current.setAttribute('d', '');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (brushRafIdRef.current != null) {
        cancelAnimationFrame(brushRafIdRef.current);
      }
    };
  }, []);

  const getProcessedBrushContour = useCallback(
    (pts: StrokePoint[], isFinalize: boolean = false) => {
      let strokePts = pts;
      // 描画中のプレビュー時は軽量化してフレームレート（60/120fps）を最大化
      if (!isFinalize && pts.length > 80) {
        strokePts = getDecimatedPointsForLivePreview(pts);
      }

      // 手ブレ補正設定に応じた平滑化強度を適用
      const effectiveSmoothing = autoSmoothBrush
        ? smoothStrength === 'strong'
          ? Math.max(82, smoothingIntensity)
          : smoothStrength === 'standard'
          ? Math.max(62, smoothingIntensity)
          : Math.max(40, smoothingIntensity)
        : smoothingIntensity;

      const rawContour = strokePointsToOutline(
        strokePts,
        brushWidth,
        brushStyle,
        true,
        pressureSensitivity,
        pressureCurve,
        effectiveSmoothing,
        isFinalize
          ? { customPreset: activePenPreset || undefined }
          : { subdivisionStep: 1.5, density: 'high', widthSmoothingPasses: 1, customPreset: activePenPreset || undefined }
      );

      return rawContour;
    },
    [
      brushWidth,
      brushStyle,
      pressureSensitivity,
      pressureCurve,
      smoothingIntensity,
      autoSmoothBrush,
      smoothStrength,
      activePenPreset,
    ]
  );

  const handleBrushPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>, pos: Point) => {
      pendingBrushEventsRef.current = [];
      mouseSmoothSpeedRef.current = 0.5;
      brushStrokeStartTimeRef.current = Date.now();
      brushStrokeStartPosRef.current = { x: pos.x, y: pos.y };
      const isPen = e.pointerType === 'pen';
      let pres = 0.5;
      if (pressureSensitivity === 'off') {
        pres = 0.5;
      } else if (isPen) {
        if (!isStylusActive && setIsStylusActive) {
          setIsStylusActive(true);
        }
        const rawP = e.pressure && e.pressure > 0 ? e.pressure : 0.15;
        pres = Math.max(0.04, Math.min(1.0, (rawP - 0.03) / 0.65));
        if (onPressureUpdate) {
          onPressureUpdate(Math.round(pres * 100));
        }
      } else if (e.pressure && e.pressure > 0 && e.pressure !== 0.5) {
        pres = e.pressure;
      } else {
        pres = 0.55;
      }

      // Shift-Click straight line connection from previous stroke endpoint (like Photoshop / Paint Tool SAI)
      if (e.shiftKey && lastBrushPointRef.current && Date.now() - lastBrushPointRef.current.time < 120000) {
        const pPrev: StrokePoint = {
          x: lastBrushPointRef.current.x,
          y: lastBrushPointRef.current.y,
          pressure: pres,
          time: Date.now() - 50,
        };
        const pCurr: StrokePoint = { x: pos.x, y: pos.y, pressure: pres, time: Date.now() };
        const straightPts = generateStraightStrokePoints(pPrev, pCurr);
        brushStrokePointsRef.current = straightPts;
        if (activeBrushPathRef.current) {
          const contour = getProcessedBrushContour(brushStrokePointsRef.current, false);
          const d = contoursToSvgPath([contour]);
          activeBrushSvgDRef.current = d;
          activeBrushPathRef.current.setAttribute('d', d);
        }
      } else {
        brushStrokePointsRef.current = [
          { x: pos.x, y: pos.y, pressure: pres, time: Date.now(), pointerType: e.pointerType },
        ];
        // 初期タップ瞬間には画面に巨大な丸をプレビュー表示せず、動いた時または描画確定時に表示
        if (activeBrushPathRef.current) {
          activeBrushPathRef.current.setAttribute('d', '');
        }
      }
    },
    [
      pressureSensitivity,
      isStylusActive,
      setIsStylusActive,
      onPressureUpdate,
      getProcessedBrushContour,
    ]
  );

  const handleBrushPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): boolean => {
      if (toolMode !== 'brush' || brushStrokePointsRef.current.length === 0) {
        return false;
      }
      const isPen = e.pointerType === 'pen';
      if (isPen && !isStylusActive && setIsStylusActive) {
        setIsStylusActive(true);
      }

      // Straight Ruler Assist: When Shift is held or straight mode is ON, lock stroke to perfect 0°/45°/90° straight line
      if (e.shiftKey || brushStraightMode) {
        const p0 = brushStrokePointsRef.current[0];
        const subPos = screenToCanvas(e.clientX, e.clientY);
        const snapped = snapToStraightAngle(p0.x, p0.y, subPos.x, subPos.y);
        let endX = snapped.x;
        let endY = snapped.y;

        // Snap to custom guidelines if within 12px
        if (customGuidelines && customGuidelines.length > 0) {
          for (const guide of customGuidelines) {
            if (guide.type === 'h' && Math.abs(endY - guide.position) < 12) {
              endY = guide.position;
            } else if (guide.type === 'v' && Math.abs(endX - guide.position) < 12) {
              endX = guide.position;
            }
          }
        }

        let pres = 0.5;
        if (pressureSensitivity === 'off') {
          pres = 0.5;
        } else if (isPen) {
          pres = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
        }

        const pEnd: StrokePoint = {
          x: endX,
          y: endY,
          pressure: pres,
          time: e.timeStamp || Date.now(),
        };

        brushStrokePointsRef.current = generateStraightStrokePoints(p0, pEnd);

        if (brushRafIdRef.current == null) {
          brushRafIdRef.current = requestAnimationFrame(() => {
            brushRafIdRef.current = null;
            if (activeBrushPathRef.current && brushStrokePointsRef.current.length > 0) {
              const contour = getProcessedBrushContour(brushStrokePointsRef.current, false);
              const d = contoursToSvgPath([contour]);
              activeBrushSvgDRef.current = d;
              activeBrushPathRef.current.setAttribute('d', d);
            }
          });
        }
        return true;
      }

      // Defer all non-straight brush drawing events to requestAnimationFrame
      const nativeEv = (e.nativeEvent || e) as PointerEvent;
      const rawEvents = typeof nativeEv?.getCoalescedEvents === 'function' ? nativeEv.getCoalescedEvents() : null;
      const eventsToProcess = rawEvents && rawEvents.length > 0 ? rawEvents : [e];

      for (let k = 0; k < eventsToProcess.length; k++) {
        const ev = eventsToProcess[k];
        pendingBrushEventsRef.current.push({
          clientX: ev.clientX,
          clientY: ev.clientY,
          pressure: ev.pressure,
          timeStamp: ev.timeStamp || Date.now(),
          pointerType: ev.pointerType,
        });
      }

      if (brushRafIdRef.current == null) {
        brushRafIdRef.current = requestAnimationFrame(() => {
          brushRafIdRef.current = null;
          if (pendingBrushEventsRef.current.length === 0) return;

          const events = pendingBrushEventsRef.current;
          pendingBrushEventsRef.current = [];

          let lastP = brushStrokePointsRef.current[brushStrokePointsRef.current.length - 1];
          let hasNewPoints = false;

          for (let k = 0; k < events.length; k++) {
            const ev = events[k];
            let subPos = screenToCanvas(ev.clientX, ev.clientY);

            // マウス特有の離散化ジッター（1pxの階段状ノイズ）を直前座標と適応的に融合して除去
            if (ev.pointerType === 'mouse' && lastP) {
              subPos = {
                x: subPos.x * 0.75 + lastP.x * 0.25,
                y: subPos.y * 0.75 + lastP.y * 0.25,
              };
            }

            // 距離が極小（1.5px未満）の重複サンプリングは補間に寄与せず計算爆発を招くため除外
            if (lastP) {
              const dx = subPos.x - lastP.x;
              const dy = subPos.y - lastP.y;
              if (dx * dx + dy * dy < 2.25) {
                continue;
              }
            }

            let rawPres = 0.5;
            if (pressureSensitivity === 'off') {
              rawPres = 0.5;
            } else if (ev.pointerType === 'pen') {
              // Apple Pencil / スタイラス：ハードウェアの筆圧センサー値を全域フルレンジで校正
              const p = typeof ev.pressure === 'number' ? ev.pressure : 0;
              if (p > 0) {
                rawPres = Math.max(0.04, Math.min(1.0, (p - 0.03) / 0.65));
              } else {
                rawPres = 0.15;
              }
            } else if (typeof ev.pressure === 'number' && ev.pressure > 0 && ev.pressure !== 0.5) {
              rawPres = ev.pressure;
            } else {
              // マウス・タッチ：安定した速度推定EMAで太さの脈動・ガタつきを抑止
              if (lastP && lastP.time) {
                const dt = Math.max(8, ev.timeStamp - lastP.time);
                const ds = Math.hypot(subPos.x - lastP.x, subPos.y - lastP.y);
                const instantSpeed = Math.min(3.0, ds / dt);
                mouseSmoothSpeedRef.current = mouseSmoothSpeedRef.current * 0.85 + instantSpeed * 0.15;
                const smoothSpeed = mouseSmoothSpeedRef.current;
                rawPres = Math.max(0.35, Math.min(0.80, 0.65 - (smoothSpeed - 0.5) * 0.18));
              }
            }

            // ペンタブレットは即応（88%新筆圧）、マウス時は高平滑（75%直前筆圧）で線の波打ちを徹底防止
            const pres =
              pressureSensitivity === 'off'
                ? 0.5
                : ev.pointerType === 'pen'
                ? lastP && typeof lastP.pressure === 'number'
                  ? lastP.pressure * 0.12 + rawPres * 0.88
                  : rawPres
                : lastP && typeof lastP.pressure === 'number'
                ? lastP.pressure * 0.75 + rawPres * 0.25
                : rawPres;
            const ptItem: StrokePoint = {
              x: subPos.x,
              y: subPos.y,
              pressure: pres,
              time: ev.timeStamp,
              pointerType: ev.pointerType,
            };
            brushStrokePointsRef.current.push(ptItem);
            lastP = ptItem;
            hasNewPoints = true;
          }

          // 新規点が追加された場合のみパス再計算とDOM更新を行い、減速・停止時の無駄な再描画を回避
          if (hasNewPoints && activeBrushPathRef.current && brushStrokePointsRef.current.length > 0) {
            const contour = getProcessedBrushContour(brushStrokePointsRef.current, false);
            const d = contoursToSvgPath([contour]);
            activeBrushSvgDRef.current = d;
            activeBrushPathRef.current.setAttribute('d', d);
          }
        });
      }
      return true;
    },
    [
      toolMode,
      isStylusActive,
      setIsStylusActive,
      brushStraightMode,
      screenToCanvas,
      customGuidelines,
      pressureSensitivity,
      getProcessedBrushContour,
    ]
  );

  const handleBrushPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): boolean => {
      if (
        toolMode !== 'brush' ||
        (brushStrokePointsRef.current.length === 0 && pendingBrushEventsRef.current.length === 0)
      ) {
        return false;
      }

      if (pendingBrushEventsRef.current.length > 0) {
        const events = pendingBrushEventsRef.current;
        pendingBrushEventsRef.current = [];

        let lastP = brushStrokePointsRef.current[brushStrokePointsRef.current.length - 1];

        for (let k = 0; k < events.length; k++) {
          const ev = events[k];
          let subPos = screenToCanvas(ev.clientX, ev.clientY);

          if (ev.pointerType === 'mouse' && lastP) {
            subPos = {
              x: subPos.x * 0.75 + lastP.x * 0.25,
              y: subPos.y * 0.75 + lastP.y * 0.25,
            };
          }

          if (lastP) {
            const dx = subPos.x - lastP.x;
            const dy = subPos.y - lastP.y;
            if (dx * dx + dy * dy < 2.25) {
              continue;
            }
          }

          let rawPres = 0.5;
          if (pressureSensitivity === 'off') {
            rawPres = 0.5;
          } else if (ev.pointerType === 'pen') {
            const p = typeof ev.pressure === 'number' ? ev.pressure : 0;
            rawPres = p > 0 ? Math.max(0.04, Math.min(1.0, (p - 0.03) / 0.65)) : 0.15;
          } else if (typeof ev.pressure === 'number' && ev.pressure > 0 && ev.pressure !== 0.5) {
            rawPres = ev.pressure;
          } else {
            if (lastP && lastP.time) {
              const dt = Math.max(8, ev.timeStamp - lastP.time);
              const ds = Math.hypot(subPos.x - lastP.x, subPos.y - lastP.y);
              const instantSpeed = Math.min(3.0, ds / dt);
              mouseSmoothSpeedRef.current = mouseSmoothSpeedRef.current * 0.85 + instantSpeed * 0.15;
              const smoothSpeed = mouseSmoothSpeedRef.current;
              rawPres = Math.max(0.35, Math.min(0.80, 0.65 - (smoothSpeed - 0.5) * 0.18));
            }
          }

          const pres =
            pressureSensitivity === 'off'
              ? 0.5
              : ev.pointerType === 'pen'
              ? lastP && typeof lastP.pressure === 'number'
                ? lastP.pressure * 0.12 + rawPres * 0.88
                : rawPres
              : lastP && typeof lastP.pressure === 'number'
              ? lastP.pressure * 0.75 + rawPres * 0.25
              : rawPres;
          const ptItem: StrokePoint = {
            x: subPos.x,
            y: subPos.y,
            pressure: pres,
            time: ev.timeStamp,
            pointerType: ev.pointerType,
          };
          brushStrokePointsRef.current.push(ptItem);
          lastP = ptItem;
        }
      }

      if (brushRafIdRef.current != null) {
        cancelAnimationFrame(brushRafIdRef.current);
        brushRafIdRef.current = null;
      }
      if (activeBrushPathRef.current) {
        activeBrushPathRef.current.setAttribute('d', '');
      }
      const pts = brushStrokePointsRef.current;
      brushStrokePointsRef.current = [];

      // 終端付近の微細ブレ（スタイラス離脱時の微小変位）をトリミングし、滑らかな終端形状を確保
      while (pts.length > 2) {
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const dx = last.x - prev.x;
        const dy = last.y - prev.y;
        if (dx * dx + dy * dy < 2.25) {
          // < 1.5px
          pts.pop();
        } else {
          break;
        }
      }

      // 軽くタップしただけの偶発接触（stray touch / accidental tap）を判別
      const duration = Date.now() - brushStrokeStartTimeRef.current;
      const startPos = brushStrokeStartPosRef.current;
      let maxDistFromStart = 0;
      let totalStrokeLength = 0;
      for (let i = 0; i < pts.length; i++) {
        const dStart = Math.hypot(pts[i].x - startPos.x, pts[i].y - startPos.y);
        if (dStart > maxDistFromStart) maxDistFromStart = dStart;
        if (i > 0) {
          totalStrokeLength += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
      }

      // スタイラス（ペン）で意図してしっかり押し当てた点打ち（筆圧 > 0.38）は許可
      const isDeliberatePenTap = e.pointerType === 'pen' && pts.some((p: { pressure?: number }) => (p.pressure || 0) > 0.38);

      // スマホ・タブレット等の微小タップや誤接触を破棄
      const isAccidentalTap =
        !isDeliberatePenTap &&
        (pts.length <= 1 || (maxDistFromStart < 5.0 && totalStrokeLength < 8.0)) &&
        duration < 280;
      if (isAccidentalTap) {
        return true;
      }

      if (pts.length > 0) {
        const finalizedContour = getProcessedBrushContour(pts, true);
        const currentContours = contoursRef.current || [];
        const nextContours = [...currentContours, finalizedContour];
        contoursRef.current = nextContours;
        onChangeContours(nextContours);
        lastBrushPointRef.current = {
          x: pts[pts.length - 1].x,
          y: pts[pts.length - 1].y,
          time: Date.now(),
        };
        onCommitHistory?.();
      }
      return true;
    },
    [
      toolMode,
      screenToCanvas,
      pressureSensitivity,
      getProcessedBrushContour,
      contoursRef,
      onChangeContours,
      onCommitHistory,
    ]
  );

  const isActivelyDrawing = useCallback(() => {
    return brushStrokePointsRef.current.length > 0;
  }, []);

  return {
    brushStrokePointsRef,
    activeBrushPathRef,
    activeBrushSvgDRef,
    resetBrushDrawing,
    handleBrushPointerDown,
    handleBrushPointerMove,
    handleBrushPointerUp,
    isActivelyDrawing,
  };
}
