import React from "react";
import type { CanvasElement } from "../../../types";
import {
  canUseNodeGraphParent,
  getNodeGraphEdgePoints,
} from "../workspaceNodeGraph";
import { getAllNodeParentIds } from "../workspaceTreeNode";
import type { TreeConnectionDraft } from "../../Workspace";
import {
  WORKSPACE_NODE_BERSERK_EDGE_GLOW,
  WORKSPACE_NODE_BERSERK_EDGE_STROKE,
} from "./workspaceNodeStyles";

type WorkspaceNodeGraphLayerProps = {
  elements: CanvasElement[];
  isDraggingElement: boolean;
  dragOffsetsRef?: React.MutableRefObject<Record<string, { x: number; y: number }>>;
  zoom: number;
  connectionDraft?: TreeConnectionDraft;
  onDisconnectEdge?: (parentId: string, childId: string) => void;
};

type GraphEdge = {
  child: CanvasElement;
  parent: CanvasElement;
  points: ReturnType<typeof getNodeGraphEdgePoints>;
};

type SelectedEdge = {
  parentId: string;
  childId: string;
};

const getEdgePathD = (
  points: ReturnType<typeof getNodeGraphEdgePoints>,
  minX: number,
  minY: number,
): string =>
  `M ${points.startX - minX} ${points.startY - minY} C ${
    points.control1X - minX
  } ${points.control1Y - minY}, ${points.control2X - minX} ${
    points.control2Y - minY
  }, ${points.endX - minX} ${points.endY - minY}`;

const getBezierMidpoint = (
  points: ReturnType<typeof getNodeGraphEdgePoints>,
): { x: number; y: number } => {
  const t = 0.5;
  const mt = 1 - t;
  const x =
    mt * mt * mt * points.startX +
    3 * mt * mt * t * points.control1X +
    3 * mt * t * t * points.control2X +
    t * t * t * points.endX;
  const y =
    mt * mt * mt * points.startY +
    3 * mt * mt * t * points.control1Y +
    3 * mt * t * t * points.control2Y +
    t * t * t * points.endY;

  return { x, y };
};

export const WorkspaceNodeGraphLayer: React.FC<WorkspaceNodeGraphLayerProps> = ({
  elements,
  isDraggingElement,
  dragOffsetsRef,
  zoom,
  connectionDraft,
  onDisconnectEdge,
}) => {
  const [dragFrameVersion, setDragFrameVersion] = React.useState(0);
  const [selectedEdge, setSelectedEdge] = React.useState<SelectedEdge | null>(null);

  React.useEffect(() => {
    if (!isDraggingElement && !connectionDraft) {
      return;
    }

    let frameId = 0;

    const tick = () => {
      setDragFrameVersion((current) => current + 1);
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [connectionDraft, isDraggingElement]);

  const graph = React.useMemo(() => {
    const dragOffsets = dragOffsetsRef?.current || {};
    const hasDragOffsets =
      isDraggingElement && Object.keys(dragOffsets).length > 0;
    const resolvedElements = hasDragOffsets
      ? elements.map((element) => {
          const dragPos = dragOffsets[element.id];
          return dragPos ? { ...element, x: dragPos.x, y: dragPos.y } : element;
        })
      : elements;

    const elementMap = new Map(
      resolvedElements.map((element) => [element.id, element]),
    );
    const edges = resolvedElements
      .flatMap((child) => {
        if (child.type === "group") {
          return [];
        }

        const parentIds = getAllNodeParentIds(child);

        return parentIds.map((parentId) => {
          const parent = elementMap.get(parentId);
          if (!parent || !canUseNodeGraphParent(parent)) return null;
          return {
            child,
            parent,
            points: getNodeGraphEdgePoints(parent, child),
          };
        });
      })
      .filter((edge): edge is GraphEdge => Boolean(edge));

    if (edges.length === 0) {
      return null;
    }

    const coords = edges.flatMap((edge) => [
      edge.points.startX,
      edge.points.endX,
      edge.points.control1X,
      edge.points.control2X,
    ]);
    const verticalCoords = edges.flatMap((edge) => [
      edge.points.startY,
      edge.points.endY,
      edge.points.control1Y,
      edge.points.control2Y,
    ]);
    const padding = 64;
    const minX = Math.min(...coords) - padding;
    const minY = Math.min(...verticalCoords) - padding;
    const maxX = Math.max(...coords) + padding;
    const maxY = Math.max(...verticalCoords) + padding;

    return {
      edges,
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [dragFrameVersion, dragOffsetsRef, elements, isDraggingElement]);

  React.useEffect(() => {
    if (!selectedEdge) {
      return;
    }

    if (!onDisconnectEdge || connectionDraft || !graph) {
      setSelectedEdge(null);
      return;
    }

    const stillExists = graph.edges.some(
      ({ parent, child }) =>
        parent.id === selectedEdge.parentId && child.id === selectedEdge.childId,
    );

    if (!stillExists) {
      setSelectedEdge(null);
    }
  }, [connectionDraft, graph, onDisconnectEdge, selectedEdge]);

  if (!graph && !connectionDraft) {
    return null;
  }

  const draftGraph = connectionDraft
    ? {
        minX: Math.min(connectionDraft.fromX, connectionDraft.toX) - 48,
        minY: Math.min(connectionDraft.fromY, connectionDraft.toY) - 48,
        width: Math.abs(connectionDraft.toX - connectionDraft.fromX) + 96,
        height: Math.abs(connectionDraft.toY - connectionDraft.fromY) + 96,
      }
    : null;

  const minX = graph ? Math.min(graph.minX, draftGraph?.minX ?? graph.minX) : draftGraph!.minX;
  const minY = graph ? Math.min(graph.minY, draftGraph?.minY ?? graph.minY) : draftGraph!.minY;
  const maxX = graph
    ? Math.max(graph.minX + graph.width, (draftGraph?.minX || 0) + (draftGraph?.width || 0))
    : draftGraph!.minX + draftGraph!.width;
  const maxY = graph
    ? Math.max(graph.minY + graph.height, (draftGraph?.minY || 0) + (draftGraph?.height || 0))
    : draftGraph!.minY + draftGraph!.height;
  const graphWidth = maxX - minX;
  const graphHeight = maxY - minY;

  return (
    <svg
      className="workspace-node-graph-layer absolute overflow-visible z-[1]"
      style={{
        left: minX,
        top: minY,
        width: graphWidth,
        height: graphHeight,
        pointerEvents: "none",
      }}
      viewBox={`0 0 ${graphWidth} ${graphHeight}`}
      fill="none"
    >
      {graph?.edges.map(({ child, parent, points }) => {
        const isBerserkEdge =
          child.nodeLinkKind === "generation" &&
          child.treeNodeKind === "image" &&
          Boolean(child.genInfiniteRetry);
        const isSelectedEdge =
          selectedEdge?.parentId === parent.id &&
          selectedEdge?.childId === child.id;
        const d = getEdgePathD(points, minX, minY);
        const midpoint = getBezierMidpoint(points);
        const chipX = Math.min(Math.max(midpoint.x - minX, 40), graphWidth - 40);
        const chipY = Math.min(Math.max(midpoint.y - minY, 18), graphHeight - 18);

        return (
          <React.Fragment key={`${parent.id}-${child.id}-${points.startX}-${points.endX}-${zoom}`}>
            <path
              d={d}
              stroke={
                isBerserkEdge
                  ? WORKSPACE_NODE_BERSERK_EDGE_GLOW
                  : "rgba(124,92,255,0.22)"
              }
              strokeWidth={isBerserkEdge ? 8 : 6}
              strokeLinecap="round"
              pointerEvents="none"
            />
            {isSelectedEdge ? (
              <path
                d={d}
                stroke="rgba(79,70,229,0.18)"
                strokeWidth={12}
                strokeLinecap="round"
                pointerEvents="none"
              />
            ) : null}
            <path
              d={d}
              stroke={
                isBerserkEdge
                  ? WORKSPACE_NODE_BERSERK_EDGE_STROKE
                  : child.nodeLinkKind === "branch"
                    ? "rgba(124,92,255,0.98)"
                    : "rgba(79,70,229,0.98)"
              }
              strokeDasharray={
                isBerserkEdge
                  ? "3 8"
                  : child.nodeLinkKind === "branch"
                    ? "10 12"
                    : "6 9"
              }
              strokeWidth={isBerserkEdge ? 3.4 : 3}
              strokeLinecap="round"
              pointerEvents="none"
            />
            {onDisconnectEdge ? (
              <path
                d={d}
                fill="none"
                stroke="rgba(99,102,241,0.001)"
                strokeWidth={24}
                strokeLinecap="round"
                pointerEvents="stroke"
                onPointerDown={(event) => {
                  if (event.pointerType !== "touch" && event.pointerType !== "pen") {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedEdge((current) =>
                    current?.parentId === parent.id && current?.childId === child.id
                      ? null
                      : {
                          parentId: parent.id,
                          childId: child.id,
                        },
                  );
                }}
              />
            ) : null}
            {onDisconnectEdge && isSelectedEdge ? (
              <g
                transform={`translate(${chipX}, ${chipY})`}
                pointerEvents="all"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDisconnectEdge(parent.id, child.id);
                  setSelectedEdge(null);
                }}
              >
                <rect
                  x={-32}
                  y={-14}
                  width={64}
                  height={28}
                  rx={10}
                  fill="rgba(255,255,255,0.96)"
                  stroke="rgba(79,70,229,0.18)"
                />
                <line
                  x1={-22}
                  y1={0}
                  x2={-14}
                  y2={0}
                  stroke="rgba(79,70,229,0.92)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <text
                  x={2}
                  y={0}
                  fill="rgba(55,65,81,0.92)"
                  fontSize={11}
                  fontWeight={600}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  断开
                </text>
              </g>
            ) : null}
          </React.Fragment>
        );
      })}
      {connectionDraft ? (
        (() => {
          const startX = connectionDraft.fromX - minX;
          const startY = connectionDraft.fromY - minY;
          const endX = connectionDraft.toX - minX;
          const endY = connectionDraft.toY - minY;
          const controlOffset = Math.max(54, Math.abs(endY - startY) * 0.32);
          const d = `M ${startX} ${startY} C ${startX} ${
            startY + controlOffset
          }, ${endX} ${endY - controlOffset}, ${endX} ${endY}`;

          return (
            <path
              d={d}
              stroke="rgba(124,92,255,0.92)"
              strokeWidth={2.2}
              strokeDasharray="8 10"
              strokeLinecap="round"
              fill="none"
              pointerEvents="none"
            />
          );
        })()
      ) : null}
    </svg>
  );
};
