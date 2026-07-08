import { useCallback, type ChangeEvent, type DragEvent, type MutableRefObject } from "react";
import type { CanvasElement, WorkspaceNodeInteractionMode } from "../../../types";
import {
  calcInitialDisplaySize,
  DEFAULT_PROXY_MAX_DIM,
  fileToDataUrl,
  getCanvasCenterPoint,
  getCanvasViewportSize,
  makeImageProxyFromUrl,
  makeImageProxyDataUrl,
} from "../workspaceShared";
import {
  getWorkspaceImageNodeDisplaySize,
} from "../workspaceTreeNode";

type PlacementPoint = {
  x: number;
  y: number;
};

type UrlAssetImportInput = {
  url: string;
  type: "image" | "video" | "file";
  title?: string;
  mediaType?: string;
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
        const imageDisplaySize = getWorkspaceImageNodeDisplaySize(
          originalWidth,
          originalHeight,
        );
        const placement = getPlacement({
          width: imageDisplaySize.width,
          height: imageDisplaySize.height,
        });

        return {
          id: Date.now().toString() + index,
          type: "image",
          url: displayUrl,
          originalUrl,
          proxyUrl: displayUrl !== originalUrl ? displayUrl : undefined,
          x: placement.x,
          y: placement.y,
          width: imageDisplaySize.width,
          height: imageDisplaySize.height,
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
        const imageDisplaySize = getWorkspaceImageNodeDisplaySize(
          img.width,
          img.height,
        );
        const viewport = getCanvasViewportSize(showAssistant);
        const placement = getPlacement({
          width: imageDisplaySize.width,
          height: imageDisplaySize.height,
        });

        return {
          id: Date.now().toString() + index,
          type: "image",
          url: fallbackUrl,
          originalUrl: fallbackUrl,
          x: placement.x,
          y: placement.y,
          width: imageDisplaySize.width,
          height: imageDisplaySize.height,
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

  const importUrlAssetToCanvas = useCallback(
    async (asset: UrlAssetImportInput): Promise<string | null> => {
      const url = String(asset.url || "").trim();
      if (!url || asset.type === "file") return null;

      const index = 0;
      const baseZIndex =
        elementsRef.current.reduce(
          (max, element) => Math.max(max, element.zIndex || 0),
          0,
        ) + 1;
      const viewport = getCanvasViewportSize(showAssistant);
      const canvasCenter = getCanvasCenterPoint({
        showAssistant,
        pan,
        zoom,
        viewport,
      });
      const id = `${asset.type}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      if (asset.type === "video") {
        const nextElement: CanvasElement = {
          id,
          type: "video",
          url,
          originalUrl: url,
          x: canvasCenter.x - VIDEO_DEFAULT_WIDTH / 2,
          y: canvasCenter.y - VIDEO_DEFAULT_HEIGHT / 2,
          width: VIDEO_DEFAULT_WIDTH,
          height: VIDEO_DEFAULT_HEIGHT,
          zIndex: baseZIndex,
          genPrompt: asset.title,
          nodeInteractionMode:
            nodeInteractionMode === "branch" ? "branch" : undefined,
        };
        appendElementsAndSaveHistory([nextElement]);
        return id;
      }

      const proxied = await makeImageProxyFromUrl(
        url,
        DEFAULT_PROXY_MAX_DIM,
        viewport,
      );
      const imageDisplaySize = getWorkspaceImageNodeDisplaySize(
        proxied.originalWidth,
        proxied.originalHeight,
      );
      const nextElement: CanvasElement = {
        id,
        type: "image",
        url: proxied.displayUrl,
        originalUrl: proxied.originalUrl,
        proxyUrl:
          proxied.displayUrl !== proxied.originalUrl
            ? proxied.displayUrl
            : undefined,
        x: canvasCenter.x - imageDisplaySize.width / 2,
        y: canvasCenter.y - imageDisplaySize.height / 2,
        width: imageDisplaySize.width,
        height: imageDisplaySize.height,
        zIndex: baseZIndex + index,
        genPrompt: asset.title,
        genAspectRatio: `${proxied.originalWidth}:${proxied.originalHeight}`,
        nodeInteractionMode:
          nodeInteractionMode === "branch" ? "branch" : undefined,
        treeNodeKind: nodeInteractionMode === "branch" ? "image" : undefined,
      };
      appendElementsAndSaveHistory([nextElement]);
      return id;
    },
    [
      appendElementsAndSaveHistory,
      elementsRef,
      nodeInteractionMode,
      pan,
      showAssistant,
      zoom,
    ],
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
    importUrlAssetToCanvas,
  };
}
