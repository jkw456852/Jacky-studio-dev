import { useCallback, type MutableRefObject } from "react";
import type {
  CanvasElement,
  ImageModel,
  Marker,
  ShapeType,
  VideoModel,
  WorkspaceNodeInteractionMode,
} from "../../../types";
import { getCanvasCenterPoint } from "../workspaceShared";
import {
  getWorkspaceImageNodeHeight,
  WORKSPACE_IMAGE_NODE_WIDTH,
} from "../workspaceTreeNode";
import {
  canUseNodeGraphParent,
  resolveNodeGraphPlacement,
} from "../workspaceNodeGraph";

type ToolType =
  | "select"
  | "hand"
  | "mark"
  | "insert"
  | "shape"
  | "text"
  | "brush"
  | "eraser";

type AddTextOptions = {
  x?: number;
  y?: number;
  enterEdit?: boolean;
  switchToSelect?: boolean;
};

type AddGenImageOptions = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  genPrompt?: string;
  genModel?: ImageModel;
  genProviderId?: string | null;
  genAspectRatio?: string;
  genResolution?: NonNullable<CanvasElement["genResolution"]>;
  genImageQuality?: NonNullable<CanvasElement["genImageQuality"]>;
  genRefImages?: string[];
  genRefPreviewImages?: string[];
  nodeInteractionMode?: WorkspaceNodeInteractionMode;
  parentElementId?: string;
  parentElementIds?: string[];
  disableAutoParentLink?: boolean;
};

type UseWorkspaceCanvasElementCreationOptions = {
  showAssistant: boolean;
  pan: { x: number; y: number };
  zoom: number;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  elementsRef: MutableRefObject<CanvasElement[]>;
  markersRef: MutableRefObject<Marker[]>;
  setElementsSynced: (nextElements: CanvasElement[]) => void;
  saveToHistory: (newElements: CanvasElement[], newMarkers: Marker[]) => void;
  setSelectedElementId: (id: string | null) => void;
  setSelectedElementIds: (ids: string[]) => void;
  startTextEditing: (elementId: string, text: string) => void;
  setActiveTool: (tool: ToolType) => void;
  activeImageModel: ImageModel;
  activeImageProviderId: string | null;
  videoGenModel: VideoModel;
  activeVideoProviderId: string | null;
  videoGenRatio: NonNullable<CanvasElement["genAspectRatio"]>;
  videoGenQuality: NonNullable<CanvasElement["genQuality"]>;
  videoGenDuration: NonNullable<CanvasElement["genDuration"]>;
  videoStartFrame: File | null;
  videoEndFrame: File | null;
  videoMultiRefs: File[];
  nodeInteractionMode: WorkspaceNodeInteractionMode;
  selectedElementId: string | null;
};

const DEFAULT_IMAGE_WIDTH = WORKSPACE_IMAGE_NODE_WIDTH;
const DEFAULT_IMAGE_HEIGHT = 300;
const DEFAULT_SHAPE_SIZE = 100;
const DEFAULT_TEXT_WIDTH = 10;
const DEFAULT_TEXT_HEIGHT = 48;
const DEFAULT_GEN_IMAGE_SIZE = 1024;
const DEFAULT_BRANCH_NODE_WIDTH = 420;
const DEFAULT_BRANCH_NODE_HEIGHT = 320;

export function useWorkspaceCanvasElementCreation(
  options: UseWorkspaceCanvasElementCreationOptions,
) {
  const {
    showAssistant,
    pan,
    zoom,
    containerRef,
    elementsRef,
    markersRef,
    setElementsSynced,
    saveToHistory,
    setSelectedElementId,
    setSelectedElementIds,
    startTextEditing,
    setActiveTool,
    activeImageModel,
    videoGenModel,
    activeImageProviderId,
    activeVideoProviderId,
    videoGenRatio,
    videoGenQuality,
    videoGenDuration,
    videoStartFrame,
    videoEndFrame,
    videoMultiRefs,
    nodeInteractionMode,
    selectedElementId,
  } = options;

  const appendSingleElement = useCallback(
    (element: CanvasElement, options?: { selectIds?: string[] }) => {
      const nextElements = [...elementsRef.current, element];
      setElementsSynced(nextElements);
      saveToHistory(nextElements, markersRef.current);
      setSelectedElementId(element.id);
      if (options?.selectIds) {
        setSelectedElementIds(options.selectIds);
      }
    },
    [
      elementsRef,
      markersRef,
      saveToHistory,
      setElementsSynced,
      setSelectedElementId,
      setSelectedElementIds,
    ],
  );

  const addElement = useCallback(
    (
      type: "image" | "video",
      url: string,
      dims?: { width: number; height: number },
    ) => {
      const canvasCenter = getCanvasCenterPoint({
        showAssistant,
        pan,
        zoom,
      });
      const ratioWidth = Math.max(1, dims?.width || DEFAULT_IMAGE_WIDTH);
      const ratioHeight = Math.max(1, dims?.height || DEFAULT_IMAGE_HEIGHT);
      const width = type === "image" ? WORKSPACE_IMAGE_NODE_WIDTH : ratioWidth;
      const height =
        type === "image"
          ? getWorkspaceImageNodeHeight(ratioWidth, ratioHeight)
          : ratioHeight;
      appendSingleElement({
        id: Date.now().toString(),
        type,
        url,
        x: canvasCenter.x - width / 2,
        y: canvasCenter.y - height / 2,
        width,
        height,
        zIndex: elementsRef.current.length + 1,
        nodeInteractionMode:
          type === "image" && nodeInteractionMode === "branch"
            ? "branch"
            : undefined,
        treeNodeKind:
          type === "image" && nodeInteractionMode === "branch"
            ? "image"
            : undefined,
      });
    },
    [
      appendSingleElement,
      elementsRef,
      nodeInteractionMode,
      pan,
      showAssistant,
      zoom,
    ],
  );

  const addShape = useCallback(
    (shapeType: ShapeType) => {
      const canvasCenter = getCanvasCenterPoint({
        showAssistant,
        pan,
        zoom,
      });
      const size = DEFAULT_SHAPE_SIZE;
      appendSingleElement({
        id: Date.now().toString(),
        type: "shape",
        shapeType,
        x: canvasCenter.x - size / 2,
        y: canvasCenter.y - size / 2,
        width: size,
        height: size,
        fillColor: "#9CA3AF",
        strokeColor: "transparent",
        strokeWidth: 2,
        cornerRadius: 0,
        aspectRatioLocked: false,
        zIndex: elementsRef.current.length + 1,
      });
    },
    [appendSingleElement, elementsRef, pan, showAssistant, zoom],
  );

  const addText = useCallback(
    (opts?: AddTextOptions) => {
      const canvasCenter = getCanvasCenterPoint({
        showAssistant,
        pan,
        zoom,
      });
      const nextX = typeof opts?.x === "number" ? opts.x : canvasCenter.x;
      const nextY =
        typeof opts?.y === "number"
          ? opts.y
          : canvasCenter.y - DEFAULT_TEXT_HEIGHT / 2;
      const newElement: CanvasElement = {
        id: Date.now().toString(),
        type: "text",
        text: "",
        x: nextX,
        y: nextY,
        width: DEFAULT_TEXT_WIDTH,
        height: DEFAULT_TEXT_HEIGHT,
        fontSize: 48,
        fontFamily: "Inter",
        fontWeight: 400,
        fillColor: "#000000",
        strokeColor: "transparent",
        textAlign: "left",
        lineHeight: 1.2,
        letterSpacing: 0,
        textTransform: "none",
        zIndex: elementsRef.current.length + 1,
      };
      appendSingleElement(newElement, {
        selectIds: [newElement.id],
      });
      if (opts?.enterEdit) {
        startTextEditing(newElement.id, newElement.text || "");
      }
      if (opts?.switchToSelect) {
        setActiveTool("select");
      }
    },
    [
      appendSingleElement,
      elementsRef,
      pan,
      setActiveTool,
      showAssistant,
      startTextEditing,
      zoom,
    ],
  );

  const addTextAtClientPoint = useCallback(
    (
      clientX: number,
      clientY: number,
      opts?: { enterEdit?: boolean; switchToSelect?: boolean },
    ) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const canvasX = (clientX - rect.left - pan.x) / (zoom / 100);
      const canvasY = (clientY - rect.top - pan.y) / (zoom / 100);
      addText({
        x: canvasX,
        y: canvasY,
        enterEdit: opts?.enterEdit,
        switchToSelect: opts?.switchToSelect,
      });
    },
    [addText, containerRef, pan.x, pan.y, zoom],
  );

  const addGenImage = useCallback(
    (options?: AddGenImageOptions) => {
      const canvasCenter = getCanvasCenterPoint({
        showAssistant,
        pan,
        zoom,
      });
      const refImages = (options?.genRefImages || [])
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6);
      const refPreviewImages = (options?.genRefPreviewImages || [])
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, refImages.length || 6);
      const nextNodeInteractionMode =
        options?.nodeInteractionMode || nodeInteractionMode;
      const width =
        options?.width ||
        (nextNodeInteractionMode === "branch"
          ? DEFAULT_BRANCH_NODE_WIDTH
          : DEFAULT_GEN_IMAGE_SIZE);
      const height =
        options?.height ||
        (nextNodeInteractionMode === "branch"
          ? Math.max(
              DEFAULT_BRANCH_NODE_HEIGHT,
              DEFAULT_BRANCH_NODE_HEIGHT +
                Math.max(0, Math.ceil(refImages.length / 4) - 1) * 64,
            )
          : DEFAULT_GEN_IMAGE_SIZE);
      const parentElementId =
        typeof options?.parentElementId === "string"
          ? options.parentElementId
          : nextNodeInteractionMode === "branch" &&
            !options?.disableAutoParentLink
          ? selectedElementId
          : null;
      const parentElement =
        nextNodeInteractionMode === "branch" && parentElementId
          ? elementsRef.current.find((element) => element.id === parentElementId) ||
            null
          : null;
      const graphPlacement =
        nextNodeInteractionMode === "branch" && canUseNodeGraphParent(parentElement)
          ? resolveNodeGraphPlacement({
            elements: elementsRef.current,
            parentElement,
            childWidth: width,
            childHeight: height,
            preferredLinkKind: "generation",
          })
          : null;
      const fallbackPrimaryParentId =
        graphPlacement?.nodeParentId ||
        options?.parentElementId ||
        options?.parentElementIds?.[0];
      const resolvedParentIds =
        options?.parentElementIds ||
        (fallbackPrimaryParentId ? [fallbackPrimaryParentId] : undefined);
      const newElement: CanvasElement = {
        id: Date.now().toString(),
        type: "gen-image",
        x:
          graphPlacement
            ? graphPlacement.x
            : typeof options?.x === "number"
            ? options.x
            : canvasCenter.x - width / 2,
        y:
          graphPlacement
            ? graphPlacement.y
            : typeof options?.y === "number"
            ? options.y
            : canvasCenter.y - height / 2,
        width,
        height,
        zIndex: elementsRef.current.length + 1,
        genModel: options?.genModel || activeImageModel,
        genProviderId:
          options?.genProviderId === undefined
            ? activeImageProviderId
            : options.genProviderId,
        genAspectRatio: options?.genAspectRatio || "1:1",
        genResolution: options?.genResolution || "1K",
        genImageQuality: options?.genImageQuality || "medium",
        genPrompt: options?.genPrompt || "",
        genRefImages: refImages,
        genRefImage: refImages[0],
        genRefPreviewImages: refPreviewImages,
        genRefPreviewImage: refPreviewImages[0],
        nodeInteractionMode: nextNodeInteractionMode,
        nodeParentId: fallbackPrimaryParentId,
        nodeParentIds: resolvedParentIds,
        nodeLinkKind:
          graphPlacement?.nodeLinkKind ||
          (fallbackPrimaryParentId ? "generation" : undefined),
        treeNodeKind:
          nextNodeInteractionMode === "branch" ? "prompt" : undefined,
        treeNodeTone:
          nextNodeInteractionMode === "branch" ? "lavender" : undefined,
        treeChildrenCollapsed:
          nextNodeInteractionMode === "branch" ? false : undefined,
      };

      appendSingleElement(newElement, {
        selectIds: [newElement.id],
      });

      return newElement.id;
    },
    [
      activeImageModel,
      activeImageProviderId,
      appendSingleElement,
      elementsRef,
      nodeInteractionMode,
      pan,
      selectedElementId,
      showAssistant,
      zoom,
    ],
  );

  const addGenVideo = useCallback(() => {
    const canvasCenter = getCanvasCenterPoint({
      showAssistant,
      pan,
      zoom,
    });

    let startW = 1920;
    let startH = 1080;
    if (videoGenRatio === "9:16") {
      startW = 1080;
      startH = 1920;
    } else if (videoGenRatio === "1:1") {
      startW = 1080;
      startH = 1080;
    }

    appendSingleElement({
      id: Date.now().toString(),
      type: "gen-video",
      x: canvasCenter.x - startW / 2,
      y: canvasCenter.y - startH / 2,
      width: startW,
      height: startH,
      zIndex: elementsRef.current.length + 1,
      genModel: videoGenModel,
      genProviderId: activeVideoProviderId,
      genAspectRatio: videoGenRatio,
      genQuality: videoGenQuality,
      genPrompt: "",
      genDuration: videoGenDuration,
      genStartFrame: videoStartFrame
        ? URL.createObjectURL(videoStartFrame)
        : undefined,
      genEndFrame: videoEndFrame
        ? URL.createObjectURL(videoEndFrame)
        : undefined,
      genVideoRefs: videoMultiRefs.map((file) => URL.createObjectURL(file)),
      nodeInteractionMode,
    });
  }, [
    appendSingleElement,
    elementsRef,
    nodeInteractionMode,
    pan,
    showAssistant,
    videoEndFrame,
    videoGenDuration,
    videoGenModel,
    videoGenQuality,
    videoGenRatio,
    videoMultiRefs,
    activeVideoProviderId,
    videoStartFrame,
    zoom,
  ]);

  return {
    addElement,
    addShape,
    addText,
    addTextAtClientPoint,
    addGenImage,
    addGenVideo,
  };
}
