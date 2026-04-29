import { useCallback, type ChangeEvent, type DragEvent, type MutableRefObject } from "react";
import type { CanvasElement, WorkspaceNodeInteractionMode } from "../../../types";
import {
  calcInitialDisplaySize,
  DEFAULT_PROXY_MAX_DIM,
  fileToDataUrl,
  getCanvasCenterPoint,
  getCanvasViewportSize,
  makeImageProxyDataUrl,
} from "../workspaceShared";
import {
  getWorkspaceImageNodeHeight,
  WORKSPACE_IMAGE_NODE_WIDTH,
} from "../workspaceTreeNode";

type PlacementPoint = {
  x: number;
  y: number;
};

type UseWorkspaceCanvasAssetImportOptions = {
  showAssistant: boolean;
  pan: { x: number; y: number };
  zoom: number;
  nodeInteractionMode: WorkspaceNodeInteractionMode;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  elementsRef: MutableRefObject<CanvasElement[]>;
  appendElementsAndSaveHistory: (items: CanvasElement[]) => void;
};

const MAX_IMPORT_FILES = 10;
const VIDEO_DEFAULT_WIDTH = 800;
const VIDEO_DEFAULT_HEIGHT = 450;

export function useWorkspaceCanvasAssetImport(
  options: UseWorkspaceCanvasAssetImportOptions,
) {
  const {
    showAssistant,
    pan,
    zoom,
    nodeInteractionMode,
    containerRef,
    elementsRef,
    appendElementsAndSaveHistory,
  } = options;

  const buildImageElement = useCallback(
    async (
      file: File,
      index: number,
      baseZIndex: number,
      getPlacement: (size: { width: number; height: number }) => PlacementPoint,
    ): Promise<CanvasElement> => {
      try {
        const viewport = getCanvasViewportSize(showAssistant);
        const {
          originalUrl,
          displayUrl,
          originalWidth,
          originalHeight,
        } = await makeImageProxyDataUrl(file, DEFAULT_PROXY_MAX_DIM, viewport);
        const placement = getPlacement({
          width: WORKSPACE_IMAGE_NODE_WIDTH,
          height: getWorkspaceImageNodeHeight(originalWidth, originalHeight),
        });

        return {
          id: Date.now().toString() + index,
          type: "image",
          url: displayUrl,
          originalUrl,
          proxyUrl: displayUrl !== originalUrl ? displayUrl : undefined,
          x: placement.x,
          y: placement.y,
          width: WORKSPACE_IMAGE_NODE_WIDTH,
          height: getWorkspaceImageNodeHeight(originalWidth, originalHeight),
          zIndex: baseZIndex + index + 1,
          genAspectRatio: `${originalWidth}:${originalHeight}`,
          nodeInteractionMode:
            nodeInteractionMode === "branch" ? "branch" : undefined,
          treeNodeKind: nodeInteractionMode === "branch" ? "image" : undefined,
        };
      } catch (error) {
        console.warn("Failed to create image proxy, fallback to dataURL", error);
        const fallbackUrl = await fileToDataUrl(file);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const next = new Image();
          next.onload = () => resolve(next);
          next.onerror = () => reject(new Error("Failed to load fallback image"));
          next.src = fallbackUrl;
        });
        const viewport = getCanvasViewportSize(showAssistant);
        const placement = getPlacement({
          width: WORKSPACE_IMAGE_NODE_WIDTH,
          height: getWorkspaceImageNodeHeight(img.width, img.height),
        });

        return {
          id: Date.now().toString() + index,
          type: "image",
          url: fallbackUrl,
          originalUrl: fallbackUrl,
          x: placement.x,
          y: placement.y,
          width: WORKSPACE_IMAGE_NODE_WIDTH,
          height: getWorkspaceImageNodeHeight(img.width, img.height),
          zIndex: baseZIndex + index + 1,
          genAspectRatio: `${Math.max(1, img.width)}:${Math.max(1, img.height)}`,
          nodeInteractionMode:
            nodeInteractionMode === "branch" ? "branch" : undefined,
          treeNodeKind: nodeInteractionMode === "branch" ? "image" : undefined,
        };
      }
    },
    [nodeInteractionMode, showAssistant],
  );

  const buildVideoElement = useCallback(
    async (
      file: File,
      index: number,
      baseZIndex: number,
      getPlacement: (size: { width: number; height: number }) => PlacementPoint,
    ): Promise<CanvasElement> => {
      const url = await fileToDataUrl(file);
      const placement = getPlacement({
        width: VIDEO_DEFAULT_WIDTH,
        height: VIDEO_DEFAULT_HEIGHT,
      });

      return {
        id: Date.now().toString() + index,
        type: "video",
        url,
        x: placement.x,
        y: placement.y,
        width: VIDEO_DEFAULT_WIDTH,
        height: VIDEO_DEFAULT_HEIGHT,
        zIndex: baseZIndex + index + 1,
      };
    },
    [],
  );

  const importFilesToCanvas = useCallback(
    (
      files: File[],
      getPlacement: (size: { width: number; height: number }, index: number) => PlacementPoint,
    ) => {
      if (files.length === 0) return;

      const baseZIndex = elementsRef.current.length;

      void Promise.all(
        files.map(async (file, index) => {
          const withOffsetPlacement = (size: { width: number; height: number }) =>
            getPlacement(size, index);

          if (file.type.startsWith("image/")) {
            return buildImageElement(file, index, baseZIndex, withOffsetPlacement);
          }

          return buildVideoElement(file, index, baseZIndex, withOffsetPlacement);
        }),
      ).then((items) => {
        appendElementsAndSaveHistory(items);
      });
    },
    [
      appendElementsAndSaveHistory,
      buildImageElement,
      buildVideoElement,
      elementsRef,
    ],
  );

  const handleFileUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>, type: "image" | "video") => {
      const files = Array.from(event.target.files || [])
        .filter((file) =>
          type === "image"
            ? file.type.startsWith("image/")
            : file.type.startsWith("video/"),
        )
        .slice(0, MAX_IMPORT_FILES);
      if (files.length === 0) return;

      importFilesToCanvas(files, (size, index) => {
        const viewport = getCanvasViewportSize(showAssistant);
        const canvasCenter = getCanvasCenterPoint({
          showAssistant,
          pan,
          zoom,
          viewport,
        });
        const offset = index * 20;
        return {
          x: canvasCenter.x - size.width / 2 + offset,
          y: canvasCenter.y - size.height / 2 + offset,
        };
      });

      event.target.value = "";
    },
    [importFilesToCanvas, pan, showAssistant, zoom],
  );

  const handleCanvasDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const files = Array.from(event.dataTransfer.files)
        .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
        .slice(0, MAX_IMPORT_FILES);
      if (files.length === 0) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dropX = event.clientX - rect.left;
      const dropY = event.clientY - rect.top;
      const canvasDropX = (dropX - pan.x) / (zoom / 100);
      const canvasDropY = (dropY - pan.y) / (zoom / 100);

      importFilesToCanvas(files, (size, index) => {
        const offset = index * 20;
        return {
          x: canvasDropX - size.width / 2 + offset,
          y: canvasDropY - size.height / 2 + offset,
        };
      });
    },
    [containerRef, importFilesToCanvas, pan.x, pan.y, zoom],
  );

  return {
    handleFileUpload,
    handleCanvasDrop,
  };
}
