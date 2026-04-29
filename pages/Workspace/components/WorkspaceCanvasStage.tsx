import React from "react";
import type {
  WorkspaceBrowserAgentElementSummary,
  WorkspaceBrowserAgentSnapshot,
} from "../browserAgentSnapshot";
import {
  invokeWorkspaceBrowserAgentAction,
  registerWorkspaceBrowserAgentTools,
  WORKSPACE_BROWSER_AGENT_HOST_ID,
  WORKSPACE_BROWSER_AGENT_HOST_ACTIONS,
  type WorkspaceBrowserAgentAspectRatioOption,
  type WorkspaceBrowserAgentActions,
  type WorkspaceBrowserAgentModelOption,
} from "../browserAgentHost";
import { ToolbarBottom } from "./ToolbarBottom";
import { WorkspaceCanvasElementsLayer } from "./WorkspaceCanvasElementsLayer";
import { WorkspaceCanvasOverlayLayer } from "./WorkspaceCanvasOverlayLayer";
import { WorkspaceCtrlCursor } from "./WorkspaceCtrlCursor";
import { WorkspaceHeaderBar } from "./WorkspaceHeaderBar";
import { WorkspaceTopToolbar } from "./WorkspaceTopToolbar";
import {
  ensureBrowserAgentRuntime,
  registerBrowserAgentHost,
  unregisterBrowserAgentHost,
} from "../../../services/browser-agent";

type Point = {
  x: number;
  y: number;
};

type WorkspaceCanvasStageProps = {
  isCtrlPressed: boolean;
  headerBar: React.ComponentProps<typeof WorkspaceHeaderBar>;
  bottomToolbar: React.ComponentProps<typeof ToolbarBottom>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasLayerRef: React.RefObject<HTMLDivElement | null>;
  marqueeBoxRef: React.RefObject<HTMLDivElement | null>;
  cutterTrailGlowRef: React.RefObject<SVGPathElement | null>;
  cutterTrailPathRef: React.RefObject<SVGPathElement | null>;
  cutterTrailTipRef: React.RefObject<SVGCircleElement | null>;
  creationMode: string;
  isPickingFromCanvas: boolean;
  activeTool: string;
  isPanning: boolean;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: () => void;
  onCanvasDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  topToolbar: React.ComponentProps<typeof WorkspaceTopToolbar>;
  isMarqueeSelecting: boolean;
  marqueeStart: Point;
  marqueeEnd: Point;
  pan: Point;
  zoom: number;
  browserAgentSnapshot: WorkspaceBrowserAgentSnapshot;
  browserAgentElementSummaries: WorkspaceBrowserAgentElementSummary[];
  browserAgentImageModelOptions: WorkspaceBrowserAgentModelOption[];
  browserAgentAspectRatioOptions: WorkspaceBrowserAgentAspectRatioOption[];
  browserAgentActions: WorkspaceBrowserAgentActions;
  canvasElementsLayer: React.ComponentProps<typeof WorkspaceCanvasElementsLayer>;
  canvasOverlayLayer: React.ComponentProps<typeof WorkspaceCanvasOverlayLayer>;
};

export const WorkspaceCanvasStage: React.FC<WorkspaceCanvasStageProps> = ({
  isCtrlPressed,
  headerBar,
  bottomToolbar,
  containerRef,
  canvasLayerRef,
  marqueeBoxRef,
  cutterTrailGlowRef,
  cutterTrailPathRef,
  cutterTrailTipRef,
  creationMode,
  isPickingFromCanvas,
  activeTool,
  isPanning,
  onContextMenu,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onCanvasDrop,
  topToolbar,
  isMarqueeSelecting,
  pan,
  zoom,
  browserAgentSnapshot,
  browserAgentElementSummaries,
  browserAgentImageModelOptions,
  browserAgentAspectRatioOptions,
  browserAgentActions,
  canvasElementsLayer,
  canvasOverlayLayer,
}) => {
  const browserAgentSnapshotRef = React.useRef(browserAgentSnapshot);
  const browserAgentElementSummariesRef = React.useRef(browserAgentElementSummaries);
  const browserAgentImageModelOptionsRef = React.useRef(browserAgentImageModelOptions);
  const browserAgentAspectRatioOptionsRef = React.useRef(browserAgentAspectRatioOptions);
  const browserAgentActionsRef = React.useRef(browserAgentActions);

  React.useEffect(() => {
    browserAgentSnapshotRef.current = browserAgentSnapshot;
  }, [browserAgentSnapshot]);

  React.useEffect(() => {
    browserAgentElementSummariesRef.current = browserAgentElementSummaries;
  }, [browserAgentElementSummaries]);

  React.useEffect(() => {
    browserAgentImageModelOptionsRef.current = browserAgentImageModelOptions;
  }, [browserAgentImageModelOptions]);

  React.useEffect(() => {
    browserAgentAspectRatioOptionsRef.current = browserAgentAspectRatioOptions;
  }, [browserAgentAspectRatioOptions]);

  React.useEffect(() => {
    browserAgentActionsRef.current = browserAgentActions;
  }, [browserAgentActions]);

  React.useEffect(() => {
    ensureBrowserAgentRuntime();
    const hostId = WORKSPACE_BROWSER_AGENT_HOST_ID;
    const cleanupWorkspaceTools = registerWorkspaceBrowserAgentTools({
      snapshotRef: browserAgentSnapshotRef,
      elementSummariesRef: browserAgentElementSummariesRef,
      imageModelOptionsRef: browserAgentImageModelOptionsRef,
      aspectRatioOptionsRef: browserAgentAspectRatioOptionsRef,
    });

    registerBrowserAgentHost({
      id: hostId,
      kind: "canvas",
      title: "Workspace Canvas",
      metadata: {
        surface: "workspace",
        snapshotVersion: "v1",
      },
      actions: WORKSPACE_BROWSER_AGENT_HOST_ACTIONS,
      getSnapshot: () => browserAgentSnapshotRef.current,
      invokeAction: (actionId, input) =>
        invokeWorkspaceBrowserAgentAction({
          actionId,
          input,
          snapshot: browserAgentSnapshotRef.current,
          actions: browserAgentActionsRef.current,
        }),
    });

    return () => {
      cleanupWorkspaceTools();
      unregisterBrowserAgentHost(hostId);
    };
  }, []);

  React.useEffect(() => {
    const handleGlobalPointerRelease = () => {
      onMouseUp();
    };

    window.addEventListener("mouseup", handleGlobalPointerRelease);
    window.addEventListener("pointerup", handleGlobalPointerRelease);
    window.addEventListener("blur", handleGlobalPointerRelease);

    return () => {
      window.removeEventListener("mouseup", handleGlobalPointerRelease);
      window.removeEventListener("pointerup", handleGlobalPointerRelease);
      window.removeEventListener("blur", handleGlobalPointerRelease);
    };
  }, [onMouseUp]);

  return (
    <div
      className={`flex-1 relative flex flex-col h-full overflow-hidden ${isCtrlPressed ? "cursor-none" : ""}`}
    >
      <WorkspaceCtrlCursor visible={isCtrlPressed} />
      <WorkspaceHeaderBar {...headerBar} />
      <ToolbarBottom {...bottomToolbar} />

      <div
        ref={containerRef}
        data-browser-agent-host="workspace-canvas"
        data-browser-agent-host-id="workspace-canvas-main"
        className="flex-1 overflow-hidden relative bg-[#E8E8E8] w-full h-full select-none"
        onContextMenu={onContextMenu}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={onCanvasDrop}
        style={{
          cursor:
            creationMode === "image" && isPickingFromCanvas
              ? "crosshair"
              : isCtrlPressed || activeTool === "mark"
                ? "none"
                : activeTool === "hand" || isPanning
                  ? isPanning
                    ? "grabbing"
                    : "grab"
                  : "default",
          WebkitUserSelect: "none",
        }}
      >
        <WorkspaceTopToolbar {...topToolbar} />

        <div
          ref={marqueeBoxRef}
          className={`workspace-marquee-box absolute border border-blue-500/80 bg-transparent pointer-events-none z-[9999] rounded-sm shadow-[0_0_0_1px_rgba(255,255,255,0.7)] ${isMarqueeSelecting ? "block" : "hidden"}`}
          style={{
            willChange: isMarqueeSelecting ? "left, top, width, height" : "auto",
          }}
        />

        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-[9998] overflow-visible"
          aria-hidden="true"
        >
          <path
            ref={cutterTrailGlowRef}
            d=""
            fill="none"
            stroke="rgba(255,107,53,0.22)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0, transition: "opacity 120ms ease-out" }}
          />
          <path
            ref={cutterTrailPathRef}
            d=""
            fill="none"
            stroke="rgba(255,92,24,0.92)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6 8"
            style={{ opacity: 0, transition: "opacity 120ms ease-out" }}
          />
          <circle
            ref={cutterTrailTipRef}
            cx="0"
            cy="0"
            r="3.5"
            fill="rgba(255,92,24,0.98)"
            style={{ opacity: 0, transition: "opacity 120ms ease-out" }}
          />
        </svg>

        <div
          ref={canvasLayerRef}
          className="absolute top-0 left-0 w-0 h-0 overflow-visible"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom / 100})`,
            transformOrigin: "0 0",
            willChange: isPanning ? "transform" : "auto",
            pointerEvents: isMarqueeSelecting ? "none" : "auto",
            WebkitFontSmoothing: "antialiased",
            textRendering: "optimizeLegibility",
          }}
        >
          <WorkspaceCanvasElementsLayer {...canvasElementsLayer} />
          <WorkspaceCanvasOverlayLayer {...canvasOverlayLayer} />
        </div>
      </div>
    </div>
  );
};
