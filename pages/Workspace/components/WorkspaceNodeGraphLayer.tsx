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

export const WorkspaceNodeGraphLayer: React.FC<WorkspaceNodeGraphLayerProps> = ({
  elements,
  isDraggingElement,
  dragOffsetsRef,
  zoom,
  connectionDraft,
  onDisconnectEdge,
}) => {
  const [dragFrameVersion, setDragFrameVersion] = React.useState(0);

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
          if (!canUseNodeGraphParent(parent)) return null;
          return {
            child,
            parent,
            points: getNodeGraphEdgePoints(parent, child),
          };
        });
      })
      .filter(
        (
          edge,
        ): edge is {
          child: CanvasElement;
          parent: CanvasElement;
          points: ReturnType<typeof getNodeGraphEdgePoints>;
        } => Boolean(edge),
      );

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
    const padding = 48;
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

  if (!graph && !connectionDraft) {
    return null;
  }

  const draftGraph = connectionDraft
    ? {
        minX:
          Math.min(connectionDraft.fromX, connectionDraft.toX) - 48,
        minY:
          Math.min(connectionDraft.fromY, connectionDraft.toY) - 48,
        width:
          Math.abs(connectionDraft.toX - connectionDraft.fromX) + 96,
        height:
          Math.abs(connectionDraft.toY - connectionDraft.fromY) + 96,
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

  return (
    <svg
      className="workspace-node-graph-layer absolute overflow-visible z-[1]"
      style={{
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY,
        pointerEvents: isDraggingElement ? "none" : undefined,
      }}
      viewBox={`0 0 ${maxX - minX} ${maxY - minY}`}
      fill="none"
    >
      {graph?.edges.map(({ child, parent, points }) => {
        const isBerserkEdge =
          child.nodeLinkKind === "generation" &&
          child.treeNodeKind === "image" &&
          Boolean(child.genInfiniteRetry);
        const isGeneratingBerserkEdge = isBerserkEdge && Boolean(child.isGenerating);
        const d = `M ${points.startX - minX} ${points.startY - minY} C ${
          points.control1X - minX
        } ${points.control1Y - minY}, ${points.control2X - minX} ${
          points.control2Y - minY
        }, ${points.endX - minX} ${points.endY - minY}`;

        return (
          <path
            key={`glow-${parent.id}-${child.id}-${points.startX}-${points.endX}-${zoom}`}
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
        );
      })}
      {graph?.edges.map(({ child, parent, points }) => {
        const isBerserkEdge =
          child.nodeLinkKind === "generation" &&
          child.treeNodeKind === "image" &&
          Boolean(child.genInfiniteRetry);
        const isGeneratingBerserkEdge = isBerserkEdge && Boolean(child.isGenerating);
        const d = `M ${points.startX - minX} ${points.startY - minY} C ${
          points.control1X - minX
        } ${points.control1Y - minY}, ${points.control2X - minX} ${
          points.control2Y - minY
        }, ${points.endX - minX} ${points.endY - minY}`;

        return (
          <path
            key={`${parent.id}-${child.id}-${points.startX}-${points.endX}-${zoom}`}
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
          >
            {isGeneratingBerserkEdge ? (
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="-22"
                dur="0.8s"
                repeatCount="indefinite"
              />
            ) : null}
          </path>
        );
      })}
      {graph?.edges.map(({ child, parent, points }) => {
        if (!onDisconnectEdge) return null;
        const shouldDisableHitArea = Boolean(child.isGenerating);

        const d = `M ${points.startX - minX} ${points.startY - minY} C ${
          points.control1X - minX
        } ${points.control1Y - minY}, ${points.control2X - minX} ${
          points.control2Y - minY
        }, ${points.endX - minX} ${points.endY - minY}`;

        return (
          <path
            key={`hit-${parent.id}-${child.id}-${points.startX}-${points.endX}-${zoom}`}
            data-node-graph-hit="true"
            d={d}
            stroke="rgba(0,0,0,0.001)"
            strokeWidth={18}
            strokeLinecap="round"
            fill="none"
            pointerEvents={
              isDraggingElement || shouldDisableHitArea ? "none" : "stroke"
            }
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDisconnectEdge(parent.id, child.id);
            }}
          />
        );
      })}
      {connectionDraft ? (
        (() => {
          const startX = connectionDraft.fromX - minX;
          const startY = connectionDraft.fromY - minY;
          const endX = connectionDraft.toX - minX;
          const endY = connectionDraft.toY - minY;
          const controlOffset = Math.max(54, Math.abs(endY - startY) * 0.32);
          const d = `M ${startX} ${startY} C ${startX} ${startY + controlOffset}, ${endX} ${endY - controlOffset}, ${endX} ${endY}`;

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
