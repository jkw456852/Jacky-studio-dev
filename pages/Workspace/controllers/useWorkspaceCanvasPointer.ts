import { useCallback, useRef, type MutableRefObject } from "react";
import type React from "react";
import { flushSync } from "react-dom";
import type { CanvasElement, Marker } from "../../../types";
import {
  canUseNodeGraphParent,
  collectNodeDescendantIds,
  getNodeGraphEdgePoints,
} from "../workspaceNodeGraph";
import { getAllNodeParentIds } from "../workspaceTreeNode";

type Point = { x: number; y: number };
type Guide = { type: "h" | "v"; pos: number };
type ResizeState = {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  top: number;
  fontSize: number;
};
type ResizePreview = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
} | null;
type MarqueePreviewIdsRef = MutableRefObject<string[]>;
type DragDidMoveRef = MutableRefObject<boolean>;
type ToolType = "select" | "hand" | "mark" | "insert" | "shape" | "text" | "brush" | "eraser";
type EdgePoints = ReturnType<typeof getNodeGraphEdgePoints>;

const RIGHT_DRAG_THRESHOLD = 4;
const EDGE_CUT_SAMPLE_STEPS = 18;
const EDGE_CUT_HIT_RADIUS = 12;

const getCanvasPointFromClient = (
  clientX: number,
  clientY: number,
  container: HTMLDivElement | null,
  pan: Point,
  zoom: number,
): Point | null => {
  const rect = container?.getBoundingClientRect();
  if (!rect) {
    return null;
  }

  return {
    x: (clientX - rect.left - pan.x) / (zoom / 100),
    y: (clientY - rect.top - pan.y) / (zoom / 100),
  };
};

const getContainerPointFromClient = (
  clientX: number,
  clientY: number,
  container: HTMLDivElement | null,
): Point | null => {
  const rect = container?.getBoundingClientRect();
  if (!rect) {
    return null;
  }

  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
};

const cubicBezierPointAt = (
  t: number,
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
): Point => {
  const inverse = 1 - t;
  const inverse2 = inverse * inverse;
  const inverse3 = inverse2 * inverse;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x:
      inverse3 * start.x +
      3 * inverse2 * t * control1.x +
      3 * inverse * t2 * control2.x +
      t3 * end.x,
    y:
      inverse3 * start.y +
      3 * inverse2 * t * control1.y +
      3 * inverse * t2 * control2.y +
      t3 * end.y,
  };
};

const distanceSquared = (a: Point, b: Point) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

const distancePointToSegmentSquared = (
  point: Point,
  segmentStart: Point,
  segmentEnd: Point,
) => {
  const dx = segmentEnd.x - segmentStart.x;
  const dy = segmentEnd.y - segmentStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return distanceSquared(point, segmentStart);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) /
        lengthSquared,
    ),
  );

  return distanceSquared(point, {
    x: segmentStart.x + dx * t,
    y: segmentStart.y + dy * t,
  });
};

const orientation = (a: Point, b: Point, c: Point) => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 0.0001) {
    return 0;
  }
  return value > 0 ? 1 : 2;
};

const onSegment = (a: Point, b: Point, c: Point) =>
  b.x <= Math.max(a.x, c.x) + 0.0001 &&
  b.x + 0.0001 >= Math.min(a.x, c.x) &&
  b.y <= Math.max(a.y, c.y) + 0.0001 &&
  b.y + 0.0001 >= Math.min(a.y, c.y);

const segmentsIntersect = (
  aStart: Point,
  aEnd: Point,
  bStart: Point,
  bEnd: Point,
) => {
  const o1 = orientation(aStart, aEnd, bStart);
  const o2 = orientation(aStart, aEnd, bEnd);
  const o3 = orientation(bStart, bEnd, aStart);
  const o4 = orientation(bStart, bEnd, aEnd);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  if (o1 === 0 && onSegment(aStart, bStart, aEnd)) return true;
  if (o2 === 0 && onSegment(aStart, bEnd, aEnd)) return true;
  if (o3 === 0 && onSegment(bStart, aStart, bEnd)) return true;
  if (o4 === 0 && onSegment(bStart, aEnd, bEnd)) return true;

  return false;
};

const segmentDistanceSquared = (
  aStart: Point,
  aEnd: Point,
  bStart: Point,
  bEnd: Point,
) => {
  if (segmentsIntersect(aStart, aEnd, bStart, bEnd)) {
    return 0;
  }

  return Math.min(
    distancePointToSegmentSquared(aStart, bStart, bEnd),
    distancePointToSegmentSquared(aEnd, bStart, bEnd),
    distancePointToSegmentSquared(bStart, aStart, aEnd),
    distancePointToSegmentSquared(bEnd, aStart, aEnd),
  );
};

const doesCutSegmentHitEdge = (
  cutStart: Point,
  cutEnd: Point,
  edgePoints: EdgePoints,
) => {
  const start = { x: edgePoints.startX, y: edgePoints.startY };
  const control1 = { x: edgePoints.control1X, y: edgePoints.control1Y };
  const control2 = { x: edgePoints.control2X, y: edgePoints.control2Y };
  const end = { x: edgePoints.endX, y: edgePoints.endY };
  const hitRadiusSquared = EDGE_CUT_HIT_RADIUS * EDGE_CUT_HIT_RADIUS;

  let previous = start;
  for (let step = 1; step <= EDGE_CUT_SAMPLE_STEPS; step += 1) {
    const current = cubicBezierPointAt(
      step / EDGE_CUT_SAMPLE_STEPS,
      start,
      control1,
      control2,
      end,
    );

    if (
      segmentDistanceSquared(cutStart, cutEnd, previous, current) <=
      hitRadiusSquared
    ) {
      return true;
    }

    previous = current;
  }

  return false;
};

const buildCutterTrailPath = (points: Point[]) => {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  return points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");
};

type UseWorkspaceCanvasPointerOptions = {
  contextMenu: { x: number; y: number } | null;
  setContextMenu: (value: { x: number; y: number } | null) => void;
  suppressNextContextMenuRef: MutableRefObject<boolean>;
  cutterTrailGlowRef: MutableRefObject<SVGPathElement | null>;
  cutterTrailPathRef: MutableRefObject<SVGPathElement | null>;
  cutterTrailTipRef: MutableRefObject<SVGCircleElement | null>;
  activeTool: ToolType;
  isSpacePressedRef: MutableRefObject<boolean>;
  setIsPanning: (value: boolean) => void;
  setDragStart: (point: Point) => void;
  panRef: MutableRefObject<Point>;
  panStartRef: MutableRefObject<Point>;
  panChangedRef: MutableRefObject<boolean>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  canvasLayerRef: MutableRefObject<HTMLDivElement | null>;
  marqueeBoxRef: MutableRefObject<HTMLDivElement | null>;
  marqueePreviewIdsRef: MarqueePreviewIdsRef;
  addTextAtClientPoint: (
    clientX: number,
    clientY: number,
    opts?: { enterEdit?: boolean; switchToSelect?: boolean },
  ) => void;
  setIsMarqueeSelecting: (value: boolean) => void;
  setMarqueeStart: (point: Point) => void;
  setMarqueeEndIfChanged: (point: Point) => void;
  isResizing: boolean;
  selectedElementId: string | null;
  resizeStart: ResizeState;
  zoom: number;
  resizeHandle: string | null;
  elementById: Map<string, CanvasElement>;
  resizePreviewRef: MutableRefObject<ResizePreview>;
  resizeRafIdRef: MutableRefObject<number>;
  isPanning: boolean;
  dragStart: Point;
  panRafIdRef: MutableRefObject<number>;
  isMarqueeSelecting: boolean;
  marqueeStart: Point;
  pan: Point;
  elements: CanvasElement[];
  visibleElements: CanvasElement[];
  setSelectedElementIdsIfChanged: (ids: string[]) => void;
  setSelectedElementId: (id: string | null) => void;
  isDraggingElement: boolean;
  dragDidMoveRef: DragDidMoveRef;
  pendingDragElementIdRef: MutableRefObject<string | null>;
  dragSelectionIdsRef: MutableRefObject<string[]>;
  pendingAltDragDuplicateRef: MutableRefObject<{
    anchorId: string;
    selectionIds: string[];
  } | null>;
  didDuplicateOnCurrentDragRef: MutableRefObject<boolean>;
  elementStartPos: Point;
  setElementStartPos: (point: Point) => void;
  selectedElementIds: string[];
  getCachedDragOthers: (draggingIds: Set<string>) => CanvasElement[];
  setAlignmentGuides: (guides: Guide[]) => void;
  groupDragStartRef: MutableRefObject<Record<string, Point>>;
  dragOffsetsRef: MutableRefObject<Record<string, Point>>;
  rafIdRef: MutableRefObject<number>;
  getClosestAspectRatio: (width: number, height: number) => string;
  elementsRef: MutableRefObject<CanvasElement[]>;
  setElementsSynced: (nextElements: CanvasElement[]) => void;
  saveToHistory: (newElements: CanvasElement[], newMarkers: Marker[]) => void;
  markersRef: MutableRefObject<Marker[]>;
  setIsResizing: (value: boolean) => void;
  setResizeHandle: (value: string | null) => void;
  setPan: (point: Point) => void;
  setIsDraggingElement: (value: boolean) => void;
  beginAltDragDuplicate: (
    selectionIds: string[],
    anchorId: string,
  ) => {
    anchorId: string | null;
    selectionIds: string[];
    startPositions: Record<string, Point>;
  } | null;
  onDisconnectEdge?: (parentId: string, childId: string) => void;
};

export function useWorkspaceCanvasPointer(
  options: UseWorkspaceCanvasPointerOptions,
) {
  const {
    contextMenu,
    setContextMenu,
    suppressNextContextMenuRef,
    cutterTrailGlowRef,
    cutterTrailPathRef,
    cutterTrailTipRef,
    activeTool,
    isSpacePressedRef,
    setIsPanning,
    setDragStart,
    panRef,
    panStartRef,
    panChangedRef,
    containerRef,
    canvasLayerRef,
    marqueeBoxRef,
    marqueePreviewIdsRef,
    addTextAtClientPoint,
    setIsMarqueeSelecting,
    setMarqueeStart,
    setMarqueeEndIfChanged,
    isResizing,
    selectedElementId,
    resizeStart,
    zoom,
    resizeHandle,
    elementById,
    resizePreviewRef,
    resizeRafIdRef,
    isPanning,
    dragStart,
    panRafIdRef,
    isMarqueeSelecting,
    marqueeStart,
    pan,
    elements,
    visibleElements,
    setSelectedElementIdsIfChanged,
    setSelectedElementId,
    isDraggingElement,
    dragDidMoveRef,
    pendingDragElementIdRef,
    dragSelectionIdsRef,
    pendingAltDragDuplicateRef,
    didDuplicateOnCurrentDragRef,
    elementStartPos,
    setElementStartPos,
    selectedElementIds,
    getCachedDragOthers,
    setAlignmentGuides,
    groupDragStartRef,
    dragOffsetsRef,
    rafIdRef,
    getClosestAspectRatio,
    elementsRef,
    setElementsSynced,
    saveToHistory,
    markersRef,
    setIsResizing,
    setResizeHandle,
    setPan,
    setIsDraggingElement,
    beginAltDragDuplicate,
    onDisconnectEdge,
  } = options;

  const rightPointerDownRef = useRef(false);
  const rightPointerDownClientRef = useRef<Point | null>(null);
  const rightPointerDownLocalRef = useRef<Point | null>(null);
  const rightDragDidMoveRef = useRef(false);
  const cutterLastCanvasPointRef = useRef<Point | null>(null);
  const cutterTrailPointsRef = useRef<Point[]>([]);
  const cutEdgeKeysRef = useRef<Set<string>>(new Set());

  const syncMarqueePreviewHighlight = useCallback(
    (nextIds: string[]) => {
      const previousIds = marqueePreviewIdsRef.current;
      const nextSet = new Set(nextIds);

      for (const id of previousIds) {
        if (nextSet.has(id)) continue;
        document
          .getElementById(`canvas-el-${id}`)
          ?.classList.remove("canvas-marquee-preview");
      }

      const previousSet = new Set(previousIds);
      for (const id of nextIds) {
        if (previousSet.has(id)) continue;
        document
          .getElementById(`canvas-el-${id}`)
          ?.classList.add("canvas-marquee-preview");
      }

      marqueePreviewIdsRef.current = nextIds;
    },
    [marqueePreviewIdsRef],
  );

  const syncFloatingToolbarPosition = useCallback(
    (anchorElementId: string | null) => {
      if (!anchorElementId) {
        return;
      }

      const toolbar = document.getElementById("active-empty-gen-toolbar");
      const anchor = document.getElementById(`canvas-el-${anchorElementId}`);
      if (!(toolbar instanceof HTMLElement) || !(anchor instanceof HTMLElement)) {
        return;
      }

      const rect = anchor.getBoundingClientRect();
      toolbar.style.left = `${rect.left + rect.width / 2}px`;
      toolbar.style.top = `${rect.bottom + 16 * (zoom / 100)}px`;
    },
    [zoom],
  );

  const cutIntersectingEdges = useCallback(
    (cutStart: Point, cutEnd: Point) => {
      if (!onDisconnectEdge) {
        return;
      }

      const baseElements = elementsRef.current;
      if (baseElements.length === 0) {
        return;
      }

      const elementMap = new Map(
        baseElements.map((element) => [element.id, element] as const),
      );

      for (const child of baseElements) {
        if (child.type === "group") {
          continue;
        }

        const parentIds = getAllNodeParentIds(child);
        for (const parentId of parentIds) {
          const parent = elementMap.get(parentId);
          if (!canUseNodeGraphParent(parent)) {
            continue;
          }

          const edgeKey = `${parent.id}=>${child.id}`;
          if (cutEdgeKeysRef.current.has(edgeKey)) {
            continue;
          }

          const edgePoints = getNodeGraphEdgePoints(parent, child);
          if (!doesCutSegmentHitEdge(cutStart, cutEnd, edgePoints)) {
            continue;
          }

          cutEdgeKeysRef.current.add(edgeKey);
          onDisconnectEdge(parent.id, child.id);
        }
      }
    },
    [elementsRef, onDisconnectEdge],
  );

  const clearCutterTrail = useCallback(() => {
    cutterTrailPointsRef.current = [];

    if (cutterTrailGlowRef.current) {
      cutterTrailGlowRef.current.setAttribute("d", "");
      cutterTrailGlowRef.current.style.opacity = "0";
    }

    if (cutterTrailPathRef.current) {
      cutterTrailPathRef.current.setAttribute("d", "");
      cutterTrailPathRef.current.style.opacity = "0";
    }

    if (cutterTrailTipRef.current) {
      cutterTrailTipRef.current.style.opacity = "0";
    }
  }, [cutterTrailGlowRef, cutterTrailPathRef, cutterTrailTipRef]);

  const renderCutterTrail = useCallback(
    (points: Point[]) => {
      cutterTrailPointsRef.current = points;
      const d = buildCutterTrailPath(points);
      const lastPoint = points[points.length - 1];

      if (cutterTrailGlowRef.current) {
        cutterTrailGlowRef.current.setAttribute("d", d);
        cutterTrailGlowRef.current.style.opacity = points.length >= 2 ? "1" : "0";
      }

      if (cutterTrailPathRef.current) {
        cutterTrailPathRef.current.setAttribute("d", d);
        cutterTrailPathRef.current.style.opacity = points.length >= 2 ? "1" : "0";
      }

      if (cutterTrailTipRef.current && lastPoint && points.length >= 2) {
        cutterTrailTipRef.current.setAttribute("cx", lastPoint.x.toFixed(1));
        cutterTrailTipRef.current.setAttribute("cy", lastPoint.y.toFixed(1));
        cutterTrailTipRef.current.style.opacity = "1";
      } else if (cutterTrailTipRef.current) {
        cutterTrailTipRef.current.style.opacity = "0";
      }
    },
    [cutterTrailGlowRef, cutterTrailPathRef, cutterTrailTipRef],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (contextMenu) setContextMenu(null);
    cancelAnimationFrame(rafIdRef.current);
    if (dragDidMoveRef) {
      dragDidMoveRef.current = false;
    }
    pendingDragElementIdRef.current = null;
    dragSelectionIdsRef.current = [];
    pendingAltDragDuplicateRef.current = null;
    didDuplicateOnCurrentDragRef.current = false;
    const target = e.target as HTMLElement;
    const clickedNodeGraphBlankArea =
      target instanceof SVGSVGElement &&
      target.classList.contains("workspace-node-graph-layer");
    const clickedNodeGraphHitArea = Boolean(
      target.closest?.("[data-node-graph-hit='true']"),
    );

    if (e.button === 2) {
      e.preventDefault();
      suppressNextContextMenuRef.current = false;
      rightPointerDownRef.current = true;
      rightPointerDownClientRef.current = { x: e.clientX, y: e.clientY };
      rightPointerDownLocalRef.current = getContainerPointFromClient(
        e.clientX,
        e.clientY,
        containerRef.current,
      );
      rightDragDidMoveRef.current = false;
      cutEdgeKeysRef.current = new Set();
      cutterLastCanvasPointRef.current = getCanvasPointFromClient(
        e.clientX,
        e.clientY,
        containerRef.current,
        panRef.current,
        zoom,
      );
      clearCutterTrail();
      return;
    }

    if (
      activeTool === "hand" ||
      e.button === 1 ||
      (e.button === 0 && isSpacePressedRef.current)
    ) {
      e.preventDefault();
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      panStartRef.current = panRef.current;
      panChangedRef.current = false;
      return;
    }

    if (
      !clickedNodeGraphHitArea &&
      (target === containerRef.current ||
        target === canvasLayerRef.current ||
        target.classList.contains("canvas-background") ||
        clickedNodeGraphBlankArea)
    ) {
      e.preventDefault();
      (document.activeElement as HTMLElement)?.blur();
      if (activeTool === "text") {
        addTextAtClientPoint(e.clientX, e.clientY, {
          enterEdit: true,
          switchToSelect: true,
        });
      } else if (activeTool === "select") {
        syncMarqueePreviewHighlight([]);
        setIsMarqueeSelecting(true);
        setMarqueeStart({ x: e.clientX, y: e.clientY });
        setMarqueeEndIfChanged({ x: e.clientX, y: e.clientY });
        const rect = containerRef.current?.getBoundingClientRect();
        const marqueeBox = marqueeBoxRef.current;
        if (rect && marqueeBox) {
          const left = e.clientX - rect.left;
          const top = e.clientY - rect.top;
          marqueeBox.style.left = `${left}px`;
          marqueeBox.style.top = `${top}px`;
          marqueeBox.style.width = "0px";
          marqueeBox.style.height = "0px";
        }
      } else {
        setIsPanning(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        panStartRef.current = panRef.current;
        panChangedRef.current = false;
      }
    }
  }, [
    activeTool,
    addTextAtClientPoint,
    canvasLayerRef,
    containerRef,
    marqueeBoxRef,
    contextMenu,
    isSpacePressedRef,
    panRef,
    panStartRef,
    panChangedRef,
    setContextMenu,
    setDragStart,
    setIsMarqueeSelecting,
    setIsPanning,
    setMarqueeEndIfChanged,
    setMarqueeStart,
    syncMarqueePreviewHighlight,
    pendingDragElementIdRef,
    rafIdRef,
    clearCutterTrail,
    suppressNextContextMenuRef,
    zoom,
  ]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (rightPointerDownRef.current) {
      e.preventDefault();

      const downPoint = rightPointerDownClientRef.current;
      const downLocalPoint = rightPointerDownLocalRef.current;
      const currentLocalPoint = getContainerPointFromClient(
        e.clientX,
        e.clientY,
        containerRef.current,
      );
      const currentCanvasPoint = getCanvasPointFromClient(
        e.clientX,
        e.clientY,
        containerRef.current,
        panRef.current,
        zoom,
      );

      if (
        downPoint &&
        Math.hypot(e.clientX - downPoint.x, e.clientY - downPoint.y) >=
          RIGHT_DRAG_THRESHOLD
      ) {
        if (!rightDragDidMoveRef.current && downLocalPoint && currentLocalPoint) {
          renderCutterTrail([downLocalPoint, currentLocalPoint]);
        }
        rightDragDidMoveRef.current = true;
        suppressNextContextMenuRef.current = true;
      }

      if (!currentCanvasPoint || !currentLocalPoint) {
        return;
      }

      const previousCanvasPoint =
        cutterLastCanvasPointRef.current || currentCanvasPoint;
      cutterLastCanvasPointRef.current = currentCanvasPoint;

      if (rightDragDidMoveRef.current) {
        const trailPoints = cutterTrailPointsRef.current;
        const lastTrailPoint = trailPoints[trailPoints.length - 1];
        if (
          !lastTrailPoint ||
          Math.hypot(
            currentLocalPoint.x - lastTrailPoint.x,
            currentLocalPoint.y - lastTrailPoint.y,
          ) >= 2
        ) {
          renderCutterTrail([...trailPoints, currentLocalPoint]);
        }
        cutIntersectingEdges(previousCanvasPoint, currentCanvasPoint);
      }

      return;
    }

    if (isResizing && selectedElementId) {
      const dx = (e.clientX - resizeStart.x) / (zoom / 100);
      const dy = (e.clientY - resizeStart.y) / (zoom / 100);
      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;
      let newX = resizeStart.left;
      let newY = resizeStart.top;
      if (resizeHandle?.includes("e")) {
        newWidth = Math.max(20, resizeStart.width + dx);
      }
      if (resizeHandle?.includes("s")) {
        newHeight = Math.max(20, resizeStart.height + dy);
      }
      if (resizeHandle?.includes("w")) {
        const widthDiff = Math.min(resizeStart.width - 20, dx);
        newWidth = resizeStart.width - widthDiff;
        newX = resizeStart.left + widthDiff;
      }
      if (resizeHandle?.includes("n")) {
        const heightDiff = Math.min(resizeStart.height - 20, dy);
        newHeight = resizeStart.height - heightDiff;
        newY = resizeStart.top + heightDiff;
      }

      const el = elementById.get(selectedElementId);
      const shouldLockAspect =
        Boolean(el?.aspectRatioLocked) ||
        el?.type === "image" ||
        el?.type === "gen-image";
      if (el && shouldLockAspect) {
        const ratio = Math.max(0.0001, resizeStart.width / resizeStart.height);

        if (resizeHandle?.length === 2) {
          const scaleX = newWidth / resizeStart.width;
          const scaleY = newHeight / resizeStart.height;
          const scale = Math.max(scaleX, scaleY);
          newWidth = Math.max(20, resizeStart.width * scale);
          newHeight = Math.max(20, newWidth / ratio);

          newX = resizeHandle.includes("w")
            ? resizeStart.left + (resizeStart.width - newWidth)
            : resizeStart.left;
          newY = resizeHandle.includes("n")
            ? resizeStart.top + (resizeStart.height - newHeight)
            : resizeStart.top;
        } else if (resizeHandle?.includes("e") || resizeHandle?.includes("w")) {
          newHeight = Math.max(20, newWidth / ratio);
          newY = resizeStart.top + (resizeStart.height - newHeight) / 2;
          if (resizeHandle.includes("w")) {
            newX = resizeStart.left + (resizeStart.width - newWidth);
          }
        } else if (resizeHandle?.includes("n") || resizeHandle?.includes("s")) {
          newWidth = Math.max(20, newHeight * ratio);
          newX = resizeStart.left + (resizeStart.width - newWidth) / 2;
          if (resizeHandle.includes("n")) {
            newY = resizeStart.top + (resizeStart.height - newHeight);
          }
        }
      }

      let scale = 1;
      if (el?.type === "text") {
        const scaleX = newWidth / resizeStart.width;
        const scaleY = newHeight / resizeStart.height;
        if (resizeHandle?.length === 2) {
          scale = Math.max(scaleX, scaleY);
        } else {
          scale = resizeHandle === "e" || resizeHandle === "w" ? scaleX : scaleY;
        }
      }

      resizePreviewRef.current = {
        id: selectedElementId,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
        fontSize:
          el?.type === "text"
            ? Math.max(8, Math.min(512, Math.round(resizeStart.fontSize * scale)))
            : undefined,
      };

      cancelAnimationFrame(resizeRafIdRef.current);
      resizeRafIdRef.current = requestAnimationFrame(() => {
        const dom = document.getElementById(`canvas-el-${selectedElementId}`);
        if (!dom) return;
        dom.style.left = `${newX}px`;
        dom.style.top = `${newY}px`;
        dom.style.width = `${newWidth}px`;
        dom.style.height = `${newHeight}px`;
        if (el?.type === "text") {
          const newFontSize = Math.max(
            8,
            Math.min(512, Math.round(resizeStart.fontSize * scale)),
          );
          const textInner = dom.querySelector(".text-inner-target") || dom;
          if (textInner instanceof HTMLElement) {
            textInner.style.fontSize = `${newFontSize}px`;
          }
        }
      });
      return;
    }

    if (isPanning) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const nextPan = {
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      };
      panRef.current = nextPan;
      panChangedRef.current = true;
      cancelAnimationFrame(panRafIdRef.current);
      panRafIdRef.current = requestAnimationFrame(() => {
        const layer = canvasLayerRef.current;
        if (!layer) return;
        layer.style.transform = `translate3d(${nextPan.x}px, ${nextPan.y}px, 0) scale(${zoom / 100})`;
        layer.style.willChange = "transform";
        syncFloatingToolbarPosition(selectedElementId);
      });
      return;
    }

    if (isMarqueeSelecting) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clampedX = Math.max(rect.left, Math.min(e.clientX, rect.right));
      const clampedY = Math.max(rect.top, Math.min(e.clientY, rect.bottom));
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const marqueeBox = marqueeBoxRef.current;
        if (!marqueeBox) return;
        marqueeBox.style.left = `${Math.min(marqueeStart.x, clampedX) - rect.left}px`;
        marqueeBox.style.top = `${Math.min(marqueeStart.y, clampedY) - rect.top}px`;
        marqueeBox.style.width = `${Math.abs(clampedX - marqueeStart.x)}px`;
        marqueeBox.style.height = `${Math.abs(clampedY - marqueeStart.y)}px`;
      });

      const sx =
        (Math.min(marqueeStart.x, clampedX) - rect.left - pan.x) / (zoom / 100);
      const sy =
        (Math.min(marqueeStart.y, clampedY) - rect.top - pan.y) / (zoom / 100);
      const sw = Math.abs(clampedX - marqueeStart.x) / (zoom / 100);
      const sh = Math.abs(clampedY - marqueeStart.y) / (zoom / 100);
      const hitSet = new Set<string>();
      for (const el of visibleElements) {
        if (
          el.x < sx + sw &&
          el.x + el.width > sx &&
          el.y < sy + sh &&
          el.y + el.height > sy
        ) {
          hitSet.add(el.id);
        }
      }
      const hits = visibleElements
        .filter((el) => hitSet.has(el.id))
        .map((el) => el.id);
      syncMarqueePreviewHighlight(hits);
      return;
    }

    const pendingDragElementId = pendingDragElementIdRef.current;
    let dragTargetId = pendingDragElementId;
    const passedDragThreshold =
      !!pendingDragElementId &&
      Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) >= 4;

    if (!isDraggingElement && passedDragThreshold) {
      const pendingAltDragDuplicate = pendingAltDragDuplicateRef.current;
      if (pendingAltDragDuplicate && dragTargetId) {
        const duplicated = beginAltDragDuplicate(
          pendingAltDragDuplicate.selectionIds,
          pendingAltDragDuplicate.anchorId,
        );
        pendingAltDragDuplicateRef.current = null;
        if (duplicated?.anchorId) {
          dragTargetId = duplicated.anchorId;
          pendingDragElementIdRef.current = duplicated.anchorId;
          dragSelectionIdsRef.current = duplicated.selectionIds;
          groupDragStartRef.current = duplicated.startPositions;
          const anchorStart = duplicated.startPositions[duplicated.anchorId];
          if (anchorStart) {
            setElementStartPos(anchorStart);
          }
        }
      }
      if (dragDidMoveRef) {
        dragDidMoveRef.current = true;
      }
      setIsDraggingElement(true);
    }

    if ((isDraggingElement || passedDragThreshold) && dragTargetId) {
      if (dragDidMoveRef) {
        dragDidMoveRef.current = true;
      }
      const liveElements = elementsRef.current;
      const liveElementById = new Map(
        liveElements.map((element) => [element.id, element] as const),
      );
      const dx = (e.clientX - dragStart.x) / (zoom / 100);
      const dy = (e.clientY - dragStart.y) / (zoom / 100);
      const dragEl = liveElementById.get(dragTargetId);
      if (!dragEl) return;

      const baseX = elementStartPos.x + dx;
      const baseY = elementStartPos.y + dy;
      let newX = baseX;
      let newY = baseY;
      const SNAP_THRESHOLD = 4;
      const guides: Guide[] = [];
      const activeSelectionIds = dragSelectionIdsRef.current;
      let draggingIds =
        activeSelectionIds.length > 1 && activeSelectionIds.includes(dragTargetId)
          ? [...activeSelectionIds]
          : [dragTargetId];
      const draggingIdSet = new Set(draggingIds);
      for (const did of [...draggingIds]) {
        const dEl = liveElementById.get(did);
        if (dEl?.type === "group" && dEl.children) {
          for (const cid of dEl.children) {
            if (!draggingIdSet.has(cid)) {
              draggingIds.push(cid);
              draggingIdSet.add(cid);
            }
          }
        }
      }
      for (const descendantId of collectNodeDescendantIds(
        liveElements,
        draggingIds,
      )) {
        if (draggingIdSet.has(descendantId)) {
          continue;
        }
        draggingIds.push(descendantId);
        draggingIdSet.add(descendantId);
      }

      const others = getCachedDragOthers(draggingIdSet);
      const dragCX = baseX + dragEl.width / 2;
      const dragCY = baseY + dragEl.height / 2;
      const dragR = baseX + dragEl.width;
      const dragB = baseY + dragEl.height;
      let bestVerticalSnap:
        | {
            delta: number;
            nextX: number;
            guidePos: number;
          }
        | null = null;
      let bestHorizontalSnap:
        | {
            delta: number;
            nextY: number;
            guidePos: number;
          }
        | null = null;

      const considerVerticalSnap = (
        delta: number,
        nextXCandidate: number,
        guidePos: number,
      ) => {
        const absDelta = Math.abs(delta);
        if (absDelta > SNAP_THRESHOLD) {
          return;
        }
        if (!bestVerticalSnap || absDelta < bestVerticalSnap.delta) {
          bestVerticalSnap = {
            delta: absDelta,
            nextX: nextXCandidate,
            guidePos,
          };
        }
      };

      const considerHorizontalSnap = (
        delta: number,
        nextYCandidate: number,
        guidePos: number,
      ) => {
        const absDelta = Math.abs(delta);
        if (absDelta > SNAP_THRESHOLD) {
          return;
        }
        if (!bestHorizontalSnap || absDelta < bestHorizontalSnap.delta) {
          bestHorizontalSnap = {
            delta: absDelta,
            nextY: nextYCandidate,
            guidePos,
          };
        }
      };

      for (const other of others) {
        const oCX = other.x + other.width / 2;
        const oCY = other.y + other.height / 2;
        const oR = other.x + other.width;
        const oB = other.y + other.height;

        considerVerticalSnap(baseX - other.x, other.x, other.x);
        considerVerticalSnap(dragR - oR, oR - dragEl.width, oR);
        considerVerticalSnap(dragCX - oCX, oCX - dragEl.width / 2, oCX);
        considerVerticalSnap(baseX - oR, oR, oR);
        considerVerticalSnap(dragR - other.x, other.x - dragEl.width, other.x);

        considerHorizontalSnap(baseY - other.y, other.y, other.y);
        considerHorizontalSnap(dragB - oB, oB - dragEl.height, oB);
        considerHorizontalSnap(dragCY - oCY, oCY - dragEl.height / 2, oCY);
        considerHorizontalSnap(baseY - oB, oB, oB);
        considerHorizontalSnap(
          dragB - other.y,
          other.y - dragEl.height,
          other.y,
        );
      }

      if (bestVerticalSnap) {
        newX = bestVerticalSnap.nextX;
        guides.push({ type: "v", pos: bestVerticalSnap.guidePos });
      }

      if (bestHorizontalSnap) {
        newY = bestHorizontalSnap.nextY;
        guides.push({ type: "h", pos: bestHorizontalSnap.guidePos });
      }

      setAlignmentGuides(guides);

      const primaryStart = groupDragStartRef.current[dragTargetId];
      const totalDx = newX - (primaryStart?.x ?? elementStartPos.x);
      const totalDy = newY - (primaryStart?.y ?? elementStartPos.y);

      const newOffsets: Record<string, Point> = {};
      for (const elId of draggingIds) {
        const start = groupDragStartRef.current[elId];
        if (start) {
          newOffsets[elId] = { x: start.x + totalDx, y: start.y + totalDy };
        } else if (elId === dragTargetId) {
          newOffsets[elId] = { x: newX, y: newY };
        }
      }
      dragOffsetsRef.current = newOffsets;

      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        for (const [elId, pos] of Object.entries(newOffsets)) {
          const dom = document.getElementById(`canvas-el-${elId}`);
          if (!dom) continue;
          const current = liveElementById.get(elId);
          if (!current) continue;
          dom.style.transform = `translate3d(${pos.x - current.x}px, ${pos.y - current.y}px, 0)`;
        }
        syncFloatingToolbarPosition(selectedElementId);
      });
    }
  }, [
    canvasLayerRef,
    containerRef,
    dragOffsetsRef,
    dragStart,
    elementById,
    elementStartPos,
    elements,
    elementsRef,
    beginAltDragDuplicate,
    clearCutterTrail,
    cutIntersectingEdges,
    getCachedDragOthers,
    groupDragStartRef,
    isDraggingElement,
    isMarqueeSelecting,
    isPanning,
    isResizing,
    marqueeBoxRef,
    marqueePreviewIdsRef,
    marqueeStart,
    pan,
    panChangedRef,
    panRafIdRef,
    panRef,
    panStartRef,
    rafIdRef,
    resizeHandle,
    resizePreviewRef,
    resizeRafIdRef,
    resizeStart,
    selectedElementId,
    dragSelectionIdsRef,
    pendingAltDragDuplicateRef,
    setElementStartPos,
    pendingDragElementIdRef,
    setAlignmentGuides,
    setMarqueeEndIfChanged,
    setSelectedElementIdsIfChanged,
    syncMarqueePreviewHighlight,
    syncFloatingToolbarPosition,
    zoom,
    renderCutterTrail,
    suppressNextContextMenuRef,
  ]);

  const handleMouseUp = useCallback(() => {
    if (rightPointerDownRef.current) {
      suppressNextContextMenuRef.current = rightDragDidMoveRef.current;
      rightPointerDownRef.current = false;
      rightPointerDownClientRef.current = null;
      rightPointerDownLocalRef.current = null;
      rightDragDidMoveRef.current = false;
      cutterLastCanvasPointRef.current = null;
      cutEdgeKeysRef.current = new Set();
      clearCutterTrail();
    }

    const pendingDragElementId = pendingDragElementIdRef.current;
    const dragDidMove = dragDidMoveRef?.current ?? isDraggingElement;
    const dragSelectionIds = dragSelectionIdsRef.current;
    const didDuplicateOnCurrentDrag = didDuplicateOnCurrentDragRef.current;
    cancelAnimationFrame(rafIdRef.current);
    if (isResizing) {
      cancelAnimationFrame(resizeRafIdRef.current);
      setIsResizing(false);
      setResizeHandle(null);
      const preview = resizePreviewRef.current;
      if (preview) {
        const nextElements = elementsRef.current.map((el) => {
          if (el.id !== preview.id) return el;
          const ar = getClosestAspectRatio(preview.width, preview.height);
          return {
            ...el,
            x: preview.x,
            y: preview.y,
            width: preview.width,
            height: preview.height,
            fontSize:
              el.type === "text" && preview.fontSize
                ? Math.max(8, Math.min(512, preview.fontSize))
                : el.fontSize,
            genAspectRatio: el.type === "gen-image" ? ar : el.genAspectRatio,
          };
        });
        setElementsSynced(nextElements);
        saveToHistory(nextElements, markersRef.current);
      }
      resizePreviewRef.current = null;
    }

    if (isPanning) {
      cancelAnimationFrame(panRafIdRef.current);
      if (panChangedRef.current) {
        setPan(panRef.current);
      }
      panChangedRef.current = false;
    }

    if (pendingDragElementId && dragDidMove) {
      const offsets = dragOffsetsRef.current;
      const offsetIds = Object.keys(offsets);
      const previousElements = elementsRef.current;
      let nextElements = previousElements;
      let changed = false;

      if (offsetIds.length > 0) {
        nextElements = previousElements.map((el) => {
          const pos = offsets[el.id];
          if (!pos) {
            return el;
          }

          if (el.x === pos.x && el.y === pos.y) {
            return el;
          }

          changed = true;
          return { ...el, x: pos.x, y: pos.y };
        });
      }

      if (offsetIds.length > 0 && changed) {
        flushSync(() => {
          setElementsSynced(nextElements);
        });
      }

      if ((offsetIds.length > 0 && changed) || didDuplicateOnCurrentDrag) {
        saveToHistory(changed ? nextElements : previousElements, markersRef.current);
      }

      if (offsetIds.length > 0) {
        for (const elId of offsetIds) {
          const dom = document.getElementById(`canvas-el-${elId}`);
          if (!(dom instanceof HTMLElement)) {
            continue;
          }

          dom.style.transform = "";
          dom.style.willChange = "";
        }
      }

      dragOffsetsRef.current = {};
      groupDragStartRef.current = {};
      if (dragDidMoveRef) {
        dragDidMoveRef.current = false;
      }
      didDuplicateOnCurrentDragRef.current = false;
      pendingAltDragDuplicateRef.current = null;

      if (
        dragSelectionIds.length > 1 &&
        dragSelectionIds.includes(pendingDragElementId)
      ) {
        setSelectedElementId(pendingDragElementId);
        setSelectedElementIdsIfChanged(dragSelectionIds);
      } else {
        setSelectedElementId(pendingDragElementId);
        setSelectedElementIdsIfChanged([pendingDragElementId]);
      }
    }

    if (
      pendingDragElementId &&
      !dragDidMove &&
      !isMarqueeSelecting &&
      !isPanning &&
      !isResizing
    ) {
      setSelectedElementId(pendingDragElementId);
      setSelectedElementIdsIfChanged([pendingDragElementId]);
    }

    if (isMarqueeSelecting) {
      const marqueeBox = marqueeBoxRef.current;
      if (marqueeBox) {
        const scale = zoom / 100;
        const sx = (marqueeBox.offsetLeft - pan.x) / scale;
        const sy = (marqueeBox.offsetTop - pan.y) / scale;
        const sw = marqueeBox.offsetWidth / scale;
        const sh = marqueeBox.offsetHeight / scale;
        const hitSet = new Set<string>();

        for (const el of visibleElements) {
          if (
            el.x < sx + sw &&
            el.x + el.width > sx &&
            el.y < sy + sh &&
            el.y + el.height > sy
          ) {
            hitSet.add(el.id);
          }
        }

        const hits = visibleElements
          .filter((el) => hitSet.has(el.id))
          .map((el) => el.id);

        setSelectedElementIdsIfChanged(hits);
        setSelectedElementId(hits.length === 1 ? hits[0] : null);
      }

      syncMarqueePreviewHighlight([]);
      setIsMarqueeSelecting(false);
      if (marqueeBox) {
        marqueeBox.style.width = "0px";
        marqueeBox.style.height = "0px";
      }
    }
    setAlignmentGuides([]);
    setIsPanning(false);
    setIsDraggingElement(false);
    if (dragDidMoveRef) {
      dragDidMoveRef.current = false;
    }
    dragSelectionIdsRef.current = [];
    pendingAltDragDuplicateRef.current = null;
    didDuplicateOnCurrentDragRef.current = false;
    pendingDragElementIdRef.current = null;
  }, [
    dragOffsetsRef,
    dragDidMoveRef,
    dragSelectionIdsRef,
    pendingAltDragDuplicateRef,
    didDuplicateOnCurrentDragRef,
    elementsRef,
    getClosestAspectRatio,
    isDraggingElement,
    isMarqueeSelecting,
    isPanning,
    isResizing,
    marqueeBoxRef,
    marqueePreviewIdsRef,
    groupDragStartRef,
    markersRef,
    panChangedRef,
    panRafIdRef,
    panRef,
    rafIdRef,
    resizePreviewRef,
    resizeRafIdRef,
    saveToHistory,
    clearCutterTrail,
    setAlignmentGuides,
    setElementsSynced,
    setIsDraggingElement,
    setIsMarqueeSelecting,
    setIsPanning,
    setIsResizing,
    setPan,
    setResizeHandle,
    setSelectedElementId,
    setSelectedElementIdsIfChanged,
    suppressNextContextMenuRef,
    syncMarqueePreviewHighlight,
    visibleElements,
    pendingDragElementIdRef,
  ]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
