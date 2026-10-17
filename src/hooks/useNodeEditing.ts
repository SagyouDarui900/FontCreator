import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  BezierNode,
  PathContour,
  Point,
  ToolMode,
  GridSettings,
  SnapGuideLine,
  CustomGuideline,
} from '../types';
import { generateId } from '../utils/path/id';
import { toggleNodeType, insertNodeOnContourAtPoint } from '../utils/path/stroke';
import { snapSinglePoint } from '../utils/snapUtils';

export interface NodeDragSession {
  contourId: string;
  nodeId: string;
  handleType: 'node' | 'handleIn' | 'handleOut';
  startPos: Point;
  initialNode: BezierNode;
  initialContour: PathContour;
}

export interface UseNodeEditingOptions {
  toolMode: ToolMode;
  zoom: number;
  contours: PathContour[];
  contoursRef: React.MutableRefObject<PathContour[]>;
  onChangeContours: (contours: PathContour[], options?: { skipHistory?: boolean }) => void;
  onCommitHistory?: () => void;
  screenToCanvas: (clientX: number, clientY: number) => Point;
  gridSettings: GridSettings;
  snapMetrics: {
    lsb: number;
    advanceWidth: number;
    baseline: number;
    ascender: number;
    capHeight: number;
    xHeight: number;
    descender: number;
  };
  customGuidelines?: CustomGuideline[];
  showCanvasToast: (message: string, subText?: string) => void;
  onDeleteSelectedContour?: () => void;
  setActiveSnapGuides?: React.Dispatch<React.SetStateAction<SnapGuideLine[]>>;
}

export interface UseNodeEditingReturn {
  // Selection state
  selectedContourIds: string[];
  setSelectedContourIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedContourId: string | null;
  setSelectedContourId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedNodeId: string | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedHandleType: 'node' | 'handleIn' | 'handleOut' | null;
  setSelectedHandleType: React.Dispatch<React.SetStateAction<'node' | 'handleIn' | 'handleOut' | null>>;

  // Touch loupe magnifier state
  touchLoupeState: {
    visible: boolean;
    screenX: number;
    screenY: number;
    canvasPos: Point | null;
  };
  setTouchLoupeState: React.Dispatch<
    React.SetStateAction<{
      visible: boolean;
      screenX: number;
      screenY: number;
      canvasPos: Point | null;
    }>
  >;

  // Drag session ref and pending contours
  nodeDragSessionRef: React.MutableRefObject<NodeDragSession | null>;
  pendingContoursRef: React.MutableRefObject<PathContour[] | null>;

  // Node & handle interaction handlers
  startNodeOrHandleDrag: (
    e: React.PointerEvent,
    contour: PathContour,
    node: BezierNode,
    handleType: 'node' | 'handleIn' | 'handleOut'
  ) => void;
  handleNodePointerDownOnCanvas: (pos: Point, e: React.PointerEvent) => boolean;
  handleInsertNodeOnContour: (e: React.PointerEvent, contour: PathContour) => boolean;
  handleNodeDragMove: (e: React.PointerEvent, pos: Point) => boolean;
  handleNodeDragEnd: () => boolean;
  handleToggleNodeType: (contourId: string, nodeId: string) => void;
  handleAddNodeToSelected: () => void;
  handleDeleteSelectedNode: () => void;
  handleNudgeSelectedNode: (dx: number, dy: number) => boolean;
  clearNodeSelection: () => void;
}

export function useNodeEditing(options: UseNodeEditingOptions): UseNodeEditingReturn {
  const {
    toolMode,
    zoom,
    contours,
    contoursRef,
    onChangeContours,
    onCommitHistory,
    screenToCanvas,
    gridSettings,
    snapMetrics,
    customGuidelines,
    showCanvasToast,
    onDeleteSelectedContour,
    setActiveSnapGuides,
  } = options;

  // Selection & Node Editing State
  const [selectedContourIds, setSelectedContourIds] = useState<string[]>([]);
  const selectedContourId = selectedContourIds.length > 0 ? selectedContourIds[0] : null;
  const setSelectedContourId = useCallback((idOrUpdater: React.SetStateAction<string | null>) => {
    setSelectedContourIds((prev) => {
      const current = prev.length > 0 ? prev[0] : null;
      const next = typeof idOrUpdater === 'function' ? (idOrUpdater as (prev: string | null) => string | null)(current) : idOrUpdater;
      return next ? [next] : [];
    });
  }, []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedHandleType, setSelectedHandleType] = useState<'node' | 'handleIn' | 'handleOut' | null>(null);

  // Mobile / Tablet Touch Precision Magnifier Loupe state
  const [touchLoupeState, setTouchLoupeState] = useState<{
    visible: boolean;
    screenX: number;
    screenY: number;
    canvasPos: Point | null;
  }>({
    visible: false,
    screenX: 0,
    screenY: 0,
    canvasPos: null,
  });

  // Drag Session Refs & Throttled RAF for 60fps dragging
  const nodeDragRafRef = useRef<number | null>(null);
  const pendingContoursRef = useRef<PathContour[] | null>(null);
  const nodeDragSessionRef = useRef<NodeDragSession | null>(null);

  // External contour selection listener (e.g. from radical insertion)
  useEffect(() => {
    const handleExternalSelect = (e: Event) => {
      const customEvent = e as CustomEvent<{ ids?: string[] }>;
      if (customEvent.detail && Array.isArray(customEvent.detail.ids) && customEvent.detail.ids.length > 0) {
        setSelectedContourIds(customEvent.detail.ids);
        setSelectedNodeId(null);
        setSelectedHandleType(null);
      }
    };
    const handleDeselectAll = () => {
      setSelectedContourIds([]);
      setSelectedNodeId(null);
      setSelectedHandleType(null);
    };
    window.addEventListener('font_editor_select_contours', handleExternalSelect);
    window.addEventListener('font_editor_deselect_all', handleDeselectAll);
    return () => {
      window.removeEventListener('font_editor_select_contours', handleExternalSelect);
      window.removeEventListener('font_editor_deselect_all', handleDeselectAll);
    };
  }, []);

  // When switching tool modes away from selection / node editing, automatically clear contour selections
  useEffect(() => {
    if (toolMode !== 'select' && toolMode !== 'node') {
      setSelectedContourIds([]);
      setSelectedNodeId(null);
      setSelectedHandleType(null);
    }
  }, [toolMode]);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (nodeDragRafRef.current != null) {
        cancelAnimationFrame(nodeDragRafRef.current);
      }
    };
  }, []);

  // Direct handle or node drag start (e.g. clicked on SVG handle/node circle)
  const startNodeOrHandleDrag = useCallback(
    (
      e: React.PointerEvent,
      contour: PathContour,
      node: BezierNode,
      handleType: 'node' | 'handleIn' | 'handleOut'
    ) => {
      e.stopPropagation();
      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch {
        // Ignored
      }
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setSelectedContourId(contour.id);
      setSelectedContourIds([contour.id]);
      setSelectedNodeId(node.id);
      setSelectedHandleType(handleType);
      nodeDragSessionRef.current = {
        contourId: contour.id,
        nodeId: node.id,
        handleType,
        startPos: canvasPos,
        initialNode: { ...node },
        initialContour: { ...contour },
      };
    },
    [screenToCanvas, setSelectedContourId]
  );

  // Check if clicking existing handle or node on main canvas pointer down
  const handleNodePointerDownOnCanvas = useCallback(
    (pos: Point, e: React.PointerEvent): boolean => {
      if (toolMode !== 'select' && toolMode !== 'node') return false;

      let foundNode = false;
      const isTouchMode = e.pointerType === 'touch';
      const handleHitDist = isTouchMode ? Math.max(30 / zoom, 24) : 16 / zoom;
      const nodeHitDist = isTouchMode ? Math.max(32 / zoom, 26) : 18 / zoom;

      for (const contour of contours) {
        for (const node of contour.nodes) {
          // Check handleOut
          if (node.handleOut && Math.hypot(node.handleOut.x - pos.x, node.handleOut.y - pos.y) <= handleHitDist) {
            setSelectedContourId(contour.id);
            setSelectedContourIds([contour.id]);
            setSelectedNodeId(node.id);
            setSelectedHandleType('handleOut');
            nodeDragSessionRef.current = {
              contourId: contour.id,
              nodeId: node.id,
              handleType: 'handleOut',
              startPos: pos,
              initialNode: { ...node },
              initialContour: { ...contour },
            };
            foundNode = true;
            break;
          }
          // Check handleIn
          if (node.handleIn && Math.hypot(node.handleIn.x - pos.x, node.handleIn.y - pos.y) <= handleHitDist) {
            setSelectedContourId(contour.id);
            setSelectedContourIds([contour.id]);
            setSelectedNodeId(node.id);
            setSelectedHandleType('handleIn');
            nodeDragSessionRef.current = {
              contourId: contour.id,
              nodeId: node.id,
              handleType: 'handleIn',
              startPos: pos,
              initialNode: { ...node },
              initialContour: { ...contour },
            };
            foundNode = true;
            break;
          }
          // Check node anchor
          if (Math.hypot(node.x - pos.x, node.y - pos.y) <= nodeHitDist) {
            setSelectedContourId(contour.id);
            setSelectedContourIds([contour.id]);
            setSelectedNodeId(node.id);
            setSelectedHandleType('node');
            nodeDragSessionRef.current = {
              contourId: contour.id,
              nodeId: node.id,
              handleType: 'node',
              startPos: pos,
              initialNode: { ...node },
              initialContour: { ...contour },
            };
            foundNode = true;
            break;
          }
        }
        if (foundNode) break;
      }

      if (foundNode) {
        return true;
      }

      // Deselect if clicked empty canvas area (unless Shift is pressed)
      if (!e.shiftKey) {
        setSelectedContourIds([]);
        setSelectedContourId(null);
      }
      setSelectedNodeId(null);
      setSelectedHandleType(null);
      return false;
    },
    [toolMode, zoom, contours, setSelectedContourId]
  );

  // Insert node on contour at point (node tool click on stroke)
  const handleInsertNodeOnContour = useCallback(
    (e: React.PointerEvent, contour: PathContour): boolean => {
      if (toolMode !== 'node') return false;
      e.stopPropagation();
      const clickPos = screenToCanvas(e.clientX, e.clientY);
      const insertResult = insertNodeOnContourAtPoint(contour, clickPos, 16 / zoom);
      if (insertResult) {
        const newContours = contours.map((c) => (c.id === contour.id ? insertResult.updatedContour : c));
        onChangeContours(newContours);
        setSelectedContourId(contour.id);
        setSelectedContourIds([contour.id]);
        setSelectedNodeId(insertResult.newNodeId);
        setSelectedHandleType('node');
        const insertedNode = insertResult.updatedContour.nodes.find((n) => n.id === insertResult.newNodeId);
        if (insertedNode) {
          nodeDragSessionRef.current = {
            contourId: contour.id,
            nodeId: insertResult.newNodeId,
            handleType: 'node',
            startPos: clickPos,
            initialNode: { ...insertedNode },
            initialContour: { ...insertResult.updatedContour },
          };
          try {
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          } catch {
            // Ignored
          }
        }
        onCommitHistory?.();
        showCanvasToast('頂点を追加しました', 'ドラッグして位置を調整できます');
        return true;
      }
      setSelectedContourId(contour.id);
      setSelectedContourIds([contour.id]);
      return false;
    },
    [toolMode, screenToCanvas, zoom, contours, onChangeContours, setSelectedContourId, onCommitHistory, showCanvasToast]
  );

  // Synchronous ref-accelerated 0ms latency node and handle dragging
  const handleNodeDragMove = useCallback(
    (e: React.PointerEvent, pos: Point): boolean => {
      const isDraggingNode = Boolean(
        nodeDragSessionRef.current ||
        ((toolMode === 'select' || toolMode === 'node') && selectedContourId && selectedNodeId && selectedHandleType)
      );

      if (!isDraggingNode) return false;

      const activeContourId = nodeDragSessionRef.current?.contourId || selectedContourId!;
      const activeNodeId = nodeDragSessionRef.current?.nodeId || selectedNodeId!;
      const activeHandleType = nodeDragSessionRef.current?.handleType || selectedHandleType!;

      let snapPos = pos;

      if (e.pointerType === 'touch') {
        setTouchLoupeState({
          visible: true,
          screenX: e.clientX,
          screenY: e.clientY,
          canvasPos: snapPos,
        });
      }

      if (activeHandleType === 'node' && !e.altKey && (Boolean(gridSettings.snapToGuides) || Boolean(gridSettings.snapToGrid))) {
        const otherContours = contours.filter((c) => c.id !== activeContourId);
        const snapThreshold = Math.min(6, Math.max(2, Math.round(5 / zoom)));
        const snapResult = snapSinglePoint(
          pos,
          otherContours,
          snapMetrics,
          customGuidelines,
          snapThreshold,
          gridSettings
        );
        snapPos = snapResult.point;
        if (setActiveSnapGuides) {
          setActiveSnapGuides(snapResult.activeGuides);
        }
      } else if (activeHandleType === 'node' && setActiveSnapGuides) {
        setActiveSnapGuides([]);
      }

      const currentContours: PathContour[] = (contoursRef.current as PathContour[]) || contours;
      const updatedContours = currentContours.map((contour: PathContour) => {
        if (contour.id !== activeContourId) return contour;

        return {
          ...contour,
          nodes: contour.nodes.map((node: BezierNode) => {
            if (node.id !== activeNodeId) return node;

            if (activeHandleType === 'node') {
              const dx = snapPos.x - node.x;
              const dy = snapPos.y - node.y;
              return {
                ...node,
                x: snapPos.x,
                y: snapPos.y,
                handleIn: node.handleIn ? { x: node.handleIn.x + dx, y: node.handleIn.y + dy } : null,
                handleOut: node.handleOut ? { x: node.handleOut.x + dx, y: node.handleOut.y + dy } : null,
              };
            } else if (activeHandleType === 'handleOut') {
              if (e.altKey) {
                return {
                  ...node,
                  handleOut: { x: pos.x, y: pos.y },
                  type: 'corner' as const,
                };
              }
              if (node.type === 'smooth' || node.type === 'symmetric') {
                const dx = pos.x - node.x;
                const dy = pos.y - node.y;
                const lenOut = Math.hypot(dx, dy);
                let handleIn = node.handleIn;
                if (lenOut > 0.01 && handleIn) {
                  const lenIn =
                    node.type === 'symmetric'
                      ? lenOut
                      : Math.hypot(handleIn.x - node.x, handleIn.y - node.y);
                  const angle = Math.atan2(dy, dx);
                  handleIn = {
                    x: Math.round(node.x - Math.cos(angle) * lenIn),
                    y: Math.round(node.y - Math.sin(angle) * lenIn),
                  };
                }
                return {
                  ...node,
                  handleOut: { x: pos.x, y: pos.y },
                  handleIn,
                };
              }
              return {
                ...node,
                handleOut: { x: pos.x, y: pos.y },
              };
            } else if (activeHandleType === 'handleIn') {
              if (e.altKey) {
                return {
                  ...node,
                  handleIn: { x: pos.x, y: pos.y },
                  type: 'corner' as const,
                };
              }
              if (node.type === 'smooth' || node.type === 'symmetric') {
                const dx = pos.x - node.x;
                const dy = pos.y - node.y;
                const lenIn = Math.hypot(dx, dy);
                let handleOut = node.handleOut;
                if (lenIn > 0.01 && handleOut) {
                  const lenOut =
                    node.type === 'symmetric'
                      ? lenIn
                      : Math.hypot(handleOut.x - node.x, handleOut.y - node.y);
                  const angle = Math.atan2(dy, dx);
                  handleOut = {
                    x: Math.round(node.x - Math.cos(angle) * lenOut),
                    y: Math.round(node.y - Math.sin(angle) * lenOut),
                  };
                }
                return {
                  ...node,
                  handleIn: { x: pos.x, y: pos.y },
                  handleOut,
                };
              }
              return {
                ...node,
                handleIn: { x: pos.x, y: pos.y },
              };
            }
            return node;
          }),
        };
      });

      contoursRef.current = updatedContours;
      pendingContoursRef.current = updatedContours;
      if (nodeDragRafRef.current == null) {
        nodeDragRafRef.current = requestAnimationFrame(() => {
          nodeDragRafRef.current = null;
          if (pendingContoursRef.current) {
            onChangeContours(pendingContoursRef.current);
          }
        });
      }
      return true;
    },
    [
      toolMode,
      selectedContourId,
      selectedNodeId,
      selectedHandleType,
      gridSettings,
      contours,
      zoom,
      snapMetrics,
      customGuidelines,
      contoursRef,
      onChangeContours,
      setActiveSnapGuides,
    ]
  );

  // Finalize node/handle drag
  const handleNodeDragEnd = useCallback((): boolean => {
    if (nodeDragSessionRef.current || ((toolMode === 'select' || toolMode === 'node') && selectedHandleType)) {
      if (nodeDragRafRef.current != null) {
        cancelAnimationFrame(nodeDragRafRef.current);
        nodeDragRafRef.current = null;
      }
      if (pendingContoursRef.current) {
        onChangeContours(pendingContoursRef.current);
        pendingContoursRef.current = null;
      }
      nodeDragSessionRef.current = null;
      setSelectedHandleType(null);
      onCommitHistory?.();
      return true;
    }
    return false;
  }, [toolMode, selectedHandleType, onChangeContours, onCommitHistory]);

  // Toggle smooth / corner / symmetric node type
  const handleToggleNodeType = useCallback(
    (contourId: string, nodeId: string) => {
      const target = contours.find((c) => c.id === contourId);
      if (!target) return;
      const newNodes = target.nodes.map((n) => {
        if (n.id === nodeId) {
          return toggleNodeType(n);
        }
        return n;
      });
      const updated = { ...target, nodes: newNodes };
      onChangeContours(contours.map((c) => (c.id === contourId ? updated : c)));
      onCommitHistory?.();
      showCanvasToast('ノード種別を切り替えました');
    },
    [contours, onChangeContours, onCommitHistory, showCanvasToast]
  );

  // Add node next to selected node in contour
  const handleAddNodeToSelected = useCallback(() => {
    if (!selectedContourId) return;
    const target = contours.find((c) => c.id === selectedContourId);
    if (!target || target.nodes.length < 2) return;
    let idx = target.nodes.findIndex((n) => n.id === selectedNodeId);
    if (idx === -1) idx = 0;
    const nextIdx = (idx + 1) % target.nodes.length;
    const n1 = target.nodes[idx];
    const n2 = target.nodes[nextIdx];

    const newNode: BezierNode = {
      id: generateId(),
      x: Math.round((n1.x + n2.x) / 2),
      y: Math.round((n1.y + n2.y) / 2),
      type: n1.type || 'smooth',
    };

    const newNodes = [...target.nodes];
    newNodes.splice(idx + 1, 0, newNode);
    const updated = { ...target, nodes: newNodes };
    onChangeContours(contours.map((c) => (c.id === selectedContourId ? updated : c)));
    setSelectedNodeId(newNode.id);
    onCommitHistory?.();
  }, [selectedContourId, selectedNodeId, contours, onChangeContours, onCommitHistory]);

  const onDeleteSelectedContourRef = useRef(onDeleteSelectedContour);
  useEffect(() => {
    onDeleteSelectedContourRef.current = onDeleteSelectedContour;
  }, [onDeleteSelectedContour]);

  // Delete selected node (or whole contour if <= 2 nodes remain)
  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedContourId || !selectedNodeId) return;
    const target = contours.find((c) => c.id === selectedContourId);
    if (!target) return;
    if (target.nodes.length <= 2) {
      onDeleteSelectedContourRef.current?.();
      return;
    }
    const newNodes = target.nodes.filter((n) => n.id !== selectedNodeId);
    const updated = { ...target, nodes: newNodes };
    onChangeContours(contours.map((c) => (c.id === selectedContourId ? updated : c)));
    setSelectedNodeId(null);
    onCommitHistory?.();
  }, [selectedContourId, selectedNodeId, contours, onChangeContours, onCommitHistory]);

  // Keyboard arrow nudge for single selected node
  const handleNudgeSelectedNode = useCallback(
    (dx: number, dy: number): boolean => {
      if (selectedContourIds.length === 1 && selectedNodeId) {
        const targetId = selectedContourIds[0];
        const updated = contours.map((c) => {
          if (c.id !== targetId) return c;
          return {
            ...c,
            nodes: c.nodes.map((n) => {
              if (n.id !== selectedNodeId) return n;
              return {
                ...n,
                x: Math.round(n.x + dx),
                y: Math.round(n.y + dy),
                handleIn: n.handleIn ? { x: Math.round(n.handleIn.x + dx), y: Math.round(n.handleIn.y + dy) } : null,
                handleOut: n.handleOut ? { x: Math.round(n.handleOut.x + dx), y: Math.round(n.handleOut.y + dy) } : null,
              };
            }),
          };
        });
        onChangeContours(updated);
        onCommitHistory?.();
        return true;
      }
      return false;
    },
    [selectedContourIds, selectedNodeId, contours, onChangeContours, onCommitHistory]
  );

  // Clear all node & contour selection
  const clearNodeSelection = useCallback(() => {
    setSelectedContourIds([]);
    setSelectedNodeId(null);
    setSelectedHandleType(null);
  }, []);

  return {
    selectedContourIds,
    setSelectedContourIds,
    selectedContourId,
    setSelectedContourId,
    selectedNodeId,
    setSelectedNodeId,
    selectedHandleType,
    setSelectedHandleType,
    touchLoupeState,
    setTouchLoupeState,
    nodeDragSessionRef,
    pendingContoursRef,
    startNodeOrHandleDrag,
    handleNodePointerDownOnCanvas,
    handleInsertNodeOnContour,
    handleNodeDragMove,
    handleNodeDragEnd,
    handleToggleNodeType,
    handleAddNodeToSelected,
    handleDeleteSelectedNode,
    handleNudgeSelectedNode,
    clearNodeSelection,
  };
}
