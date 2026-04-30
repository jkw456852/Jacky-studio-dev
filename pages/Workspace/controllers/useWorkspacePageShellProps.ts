import React from "react";
import type { CanvasElement, WorkspaceNodeInteractionMode } from "../../../types";
import { readWorkspaceGenerationTraceByElementId } from "../browserAgentGenerationTrace";
import {
  buildWorkspaceBrowserAgentSnapshot,
  summarizeCanvasElementsForBrowserAgent,
} from "../browserAgentSnapshot";
import type {
  WorkspaceBrowserAgentAspectRatioOption,
  WorkspaceBrowserAgentModelOption,
} from "../browserAgentHost";
import { AssistantSidebar } from "../components";
import { ToolbarBottom } from "../components/ToolbarBottom";
import { WorkspaceCanvasElementsLayer } from "../components/WorkspaceCanvasElementsLayer";
import { WorkspaceCanvasOverlayLayer } from "../components/WorkspaceCanvasOverlayLayer";
import { WorkspaceCanvasStage } from "../components/WorkspaceCanvasStage";
import { WorkspaceContextMenu } from "../components/WorkspaceContextMenu";
import { WorkspaceFeatureNotice } from "../components/WorkspaceFeatureNotice";
import { WorkspaceLeftPanel } from "../components/WorkspaceLeftPanel";
import { WorkspaceModeSwitchDialog } from "../components/WorkspaceModeSwitchDialog";
import { WorkspacePageOverlays } from "../components/WorkspacePageOverlays";
import { WorkspacePreviewModal } from "../components/WorkspacePreviewModal";
import { WorkspaceSidebarLayer } from "../components/WorkspaceSidebarLayer";
import { WorkspaceTopToolbar } from "../components/WorkspaceTopToolbar";
import { WorkspaceTouchEditIndicator } from "../components/WorkspaceTouchEditIndicator";
import { WorkspaceTouchEditPopup } from "../components/WorkspaceTouchEditPopup";
import { getElementSourceUrl } from "../workspaceShared";
import { createStyleLibraryDraftFromMode } from "../../../services/vision-orchestrator/style-library";

type Point = {
  x: number;
  y: number;
};

type UseWorkspacePageShellPropsArgs = {
  workspaceLeftPanelProps: React.ComponentProps<typeof WorkspaceLeftPanel>;
  assistantSidebarProps: React.ComponentProps<typeof AssistantSidebar>;
  workspaceCanvasElementsLayerProps: React.ComponentProps<
    typeof WorkspaceCanvasElementsLayer
  >;
  workspaceCanvasOverlayLayerProps: React.ComponentProps<
    typeof WorkspaceCanvasOverlayLayer
  >;
  showAssistant: boolean;
  setShowAssistant: React.Dispatch<React.SetStateAction<boolean>>;
  isCtrlPressed: boolean;
  projectTitle: string;
  setProjectTitle: React.Dispatch<React.SetStateAction<string>>;
  nodeInteractionMode: WorkspaceNodeInteractionMode;
  setNodeInteractionMode: React.Dispatch<React.SetStateAction<WorkspaceNodeInteractionMode>>;
  navigateToDashboard: () => void;
  leftPanelMode: React.ComponentProps<typeof ToolbarBottom>["leftPanelMode"];
  setLeftPanelMode: React.ComponentProps<typeof ToolbarBottom>["setLeftPanelMode"];
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasLayerRef: React.RefObject<HTMLDivElement | null>;
  marqueeBoxRef: React.RefObject<HTMLDivElement | null>;
  cutterTrailGlowRef: React.RefObject<SVGPathElement | null>;
  cutterTrailPathRef: React.RefObject<SVGPathElement | null>;
  cutterTrailTipRef: React.RefObject<SVGCircleElement | null>;
  creationMode: string;
  isPickingFromCanvas: boolean;
  activeTool: string;
  setActiveTool: (tool: string) => void;
  imageModelOptions: WorkspaceBrowserAgentModelOption[];
  aspectRatioOptions: WorkspaceBrowserAgentAspectRatioOption[];
  isPanning: boolean;
  handleContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseUp: () => void;
  handleCanvasDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  handleFileUpload: React.ComponentProps<typeof WorkspaceTopToolbar>["handleFileUpload"];
  showFeatureComingSoon: React.ComponentProps<
    typeof WorkspaceTopToolbar
  >["showFeatureComingSoon"];
  addShape: React.ComponentProps<typeof WorkspaceTopToolbar>["addShape"];
  addGenImage: React.ComponentProps<typeof WorkspaceTopToolbar>["addGenImage"];
  addGenVideo: React.ComponentProps<typeof WorkspaceTopToolbar>["addGenVideo"];
  consistencyCheckEnabled: boolean;
  currentConsistencyAnchorUrl: string | null;
  handleToggleConsistencyCheck: (enabled: boolean) => void;
  handleUploadConsistencyAnchor: (
    file: File,
  ) => void | Promise<void>;
  handleClearConsistencyAnchor: () => void | Promise<void>;
  handlePreviewConsistencyAnchor: (anchorUrl: string) => void;
  isMarqueeSelecting: boolean;
  marqueeStart: Point;
  marqueeEnd: Point;
  pan: Point;
  elements: CanvasElement[];
  visibleCanvasElements: CanvasElement[];
  rootElements: CanvasElement[];
  contextMenu: React.ComponentProps<typeof WorkspaceContextMenu>["contextMenu"];
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedElement: CanvasElement | null;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  updateElementById: (
    elementId: string,
    updates: Partial<CanvasElement>,
  ) => boolean;
  handleGenImage: (elementId: string) => void | Promise<void>;
  handleManualPaste: React.ComponentProps<
    typeof WorkspaceContextMenu
  >["onManualPaste"];
  handleDownload: React.ComponentProps<typeof WorkspaceContextMenu>["onDownload"];
  fitToScreen: React.ComponentProps<typeof WorkspaceContextMenu>["onFitToScreen"];
  setContextMenu: React.Dispatch<
    React.SetStateAction<
      React.ComponentProps<typeof WorkspaceContextMenu>["contextMenu"]
    >
  >;
  previewUrl: React.ComponentProps<typeof WorkspacePreviewModal>["previewUrl"];
  setPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
  modeSwitchDialog: React.ComponentProps<typeof WorkspaceModeSwitchDialog>;
  featureNotice: React.ComponentProps<typeof WorkspaceFeatureNotice>["featureNotice"];
  touchEditMode: React.ComponentProps<
    typeof WorkspaceTouchEditIndicator
  >["touchEditMode"];
  setTouchEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  touchEditPopup: React.ComponentProps<typeof WorkspaceTouchEditPopup>["popup"];
  touchEditInstruction: React.ComponentProps<
    typeof WorkspaceTouchEditPopup
  >["instruction"];
  isTouchEditing: React.ComponentProps<
    typeof WorkspaceTouchEditPopup
  >["isTouchEditing"];
  setTouchEditPopup: React.Dispatch<
    React.SetStateAction<React.ComponentProps<typeof WorkspaceTouchEditPopup>["popup"]>
  >;
  setTouchEditInstruction: React.ComponentProps<
    typeof WorkspaceTouchEditPopup
  >["onInstructionChange"];
  handleTouchEditExecute: React.ComponentProps<
    typeof WorkspaceTouchEditPopup
  >["onExecute"];
};

export const useWorkspacePageShellProps = ({
  workspaceLeftPanelProps,
  assistantSidebarProps,
  workspaceCanvasElementsLayerProps,
  workspaceCanvasOverlayLayerProps,
  showAssistant,
  setShowAssistant,
  isCtrlPressed,
  projectTitle,
  setProjectTitle,
  nodeInteractionMode,
  setNodeInteractionMode,
  navigateToDashboard,
  leftPanelMode,
  setLeftPanelMode,
  zoom,
  setZoom,
  containerRef,
  canvasLayerRef,
  marqueeBoxRef,
  cutterTrailGlowRef,
  cutterTrailPathRef,
  cutterTrailTipRef,
  creationMode,
  isPickingFromCanvas,
  activeTool,
  setActiveTool,
  imageModelOptions,
  aspectRatioOptions,
  isPanning,
  handleContextMenu,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleCanvasDrop,
  handleFileUpload,
  showFeatureComingSoon,
  addShape,
  addGenImage,
  addGenVideo,
  consistencyCheckEnabled,
  currentConsistencyAnchorUrl,
  handleToggleConsistencyCheck,
  handleUploadConsistencyAnchor,
  handleClearConsistencyAnchor,
  handlePreviewConsistencyAnchor,
  isMarqueeSelecting,
  marqueeStart,
  marqueeEnd,
  pan,
  elements,
  visibleCanvasElements,
  rootElements,
  contextMenu,
  selectedElementId,
  selectedElementIds,
  selectedElement,
  setSelectedElementId,
  setSelectedElementIds,
  updateElementById,
  handleGenImage,
  handleManualPaste,
  handleDownload,
  fitToScreen,
  setContextMenu,
  previewUrl,
  setPreviewUrl,
  modeSwitchDialog,
  featureNotice,
  touchEditMode,
  setTouchEditMode,
  touchEditPopup,
  touchEditInstruction,
  isTouchEditing,
  setTouchEditPopup,
  setTouchEditInstruction,
  handleTouchEditExecute,
}: UseWorkspacePageShellPropsArgs) => {
  const resolvePreviewUrlForElement = React.useCallback(
    (element: CanvasElement | null): string | null => {
      if (!element) return null;
      return (
        getElementSourceUrl(element) ||
        element.proxyUrl ||
        element.url ||
        element.genRefPreviewImage ||
        (Array.isArray(element.genRefPreviewImages)
          ? element.genRefPreviewImages[0] || null
          : null) ||
        element.genRefImage ||
        (Array.isArray(element.genRefImages) ? element.genRefImages[0] || null : null)
      );
    },
    [],
  );

  const handleOpenAssistant = React.useCallback(
    () => setShowAssistant(true),
    [setShowAssistant],
  );

  const handleZoomIn = React.useCallback(() => {
    setZoom((prev) => Math.min(prev + 10, 500));
  }, [setZoom]);

  const handleZoomOut = React.useCallback(() => {
    setZoom((prev) => Math.max(prev - 10, 10));
  }, [setZoom]);

  const handleResetZoom = React.useCallback(() => {
    setZoom(100);
  }, [setZoom]);

  const handleCloseContextMenu = React.useCallback(
    () => setContextMenu(null),
    [setContextMenu],
  );

  const handlePreviewClose = React.useCallback(
    () => setPreviewUrl(null),
    [setPreviewUrl],
  );

  const handleTouchEditIndicatorClose = React.useCallback(
    () => setTouchEditMode(false),
    [setTouchEditMode],
  );

  const handleTouchEditPopupClose = React.useCallback(() => {
    setTouchEditPopup(null);
    setTouchEditInstruction("");
  }, [setTouchEditInstruction, setTouchEditPopup]);

  const workspaceSidebarLayerProps = React.useMemo<
    React.ComponentProps<typeof WorkspaceSidebarLayer>
  >(
    () => ({
      leftPanel: workspaceLeftPanelProps,
      assistant: assistantSidebarProps,
      showAssistant,
    }),
    [assistantSidebarProps, showAssistant, workspaceLeftPanelProps],
  );

  const browserAgentElementSummaries = React.useMemo(
    () => summarizeCanvasElementsForBrowserAgent(elements),
    [elements],
  );

  const browserAgentActions = React.useMemo<
    React.ComponentProps<typeof WorkspaceCanvasStage>["browserAgentActions"]
  >(
    () => ({
      setAssistantVisible: (visible) => setShowAssistant(visible),
      setPreviewUrl,
      setActiveTool,
      fitToScreen,
      clearSelection: () => {
        setSelectedElementId(null);
        setSelectedElementIds([]);
      },
      selectElementById: (elementId) => {
        const targetId = String(elementId || "").trim();
        if (!targetId) return false;
        const exists = elements.some((element) => element.id === targetId);
        if (!exists) return false;
        setSelectedElementId(targetId);
        setSelectedElementIds([]);
        return true;
      },
      triggerImageGeneration: (elementId) => {
        const targetId = String(elementId || "").trim();
        if (!targetId) {
          return {
            accepted: false,
            elementId: "",
            requestId: null,
            traceStatus: null,
          };
        }
        const targetElement =
          elements.find((element) => element.id === targetId) || null;
        if (!targetElement) {
          return {
            accepted: false,
            elementId: targetId,
            requestId: null,
            traceStatus: null,
          };
        }
        const parentPromptElement =
          targetElement.nodeParentId
            ? elements.find((element) => element.id === targetElement.nodeParentId) || null
            : null;
        const effectivePrompt =
          String(targetElement.genPrompt || "").trim() ||
          String(parentPromptElement?.genPrompt || "").trim();
        if (!effectivePrompt) {
          return {
            accepted: false,
            elementId: targetId,
            requestId: null,
            traceStatus: null,
          };
        }
        void Promise.resolve(handleGenImage(targetId));
        const trace = readWorkspaceGenerationTraceByElementId(targetId);
        return {
          accepted: true,
          elementId: targetId,
          requestId: trace?.requestId || null,
          traceStatus: trace?.status || null,
        };
      },
      updateElementControl: (elementId, controlId, rawValue) => {
        const targetId = String(elementId || "").trim();
        const normalizedControlId = String(controlId || "").trim();
        if (!targetId || !normalizedControlId) {
          return { accepted: false, reason: "Missing elementId or controlId." };
        }

        const targetElement =
          elements.find((element) => element.id === targetId) || null;
        if (!targetElement) {
          return { accepted: false, reason: `Element not found: ${targetId}` };
        }

        switch (normalizedControlId) {
          case "genPrompt": {
            const nextPrompt = String(rawValue ?? "").trim();
            const accepted = updateElementById(targetId, {
              genPrompt: nextPrompt,
              genStatusPhase: undefined,
              genStatusTitle: undefined,
              genStatusLines: undefined,
            });
            return {
              accepted,
              reason: accepted ? null : "Prompt update was not applied.",
            };
          }
          case "genModel": {
            const modelKey = String(rawValue ?? "").trim();
            const modelOption = imageModelOptions.find((option) => {
              const optionKey = option.providerId
                ? `${option.id}::${option.providerId}`
                : option.id;
              return optionKey === modelKey || option.id === modelKey;
            });
            if (!modelOption) {
              return { accepted: false, reason: `Unknown model option: ${modelKey}` };
            }
            const accepted = updateElementById(targetId, {
              genModel: modelOption.id as CanvasElement["genModel"],
              genProviderId: modelOption.providerId || null,
            });
            return {
              accepted,
              reason: accepted ? null : "Model update was not applied.",
            };
          }
          case "genImageCount": {
            const nextCount = Number(rawValue);
            if (![1, 2, 3, 4].includes(nextCount)) {
              return { accepted: false, reason: `Invalid image count: ${rawValue}` };
            }
            const accepted = updateElementById(targetId, {
              genImageCount: nextCount as CanvasElement["genImageCount"],
            });
            return {
              accepted,
              reason: accepted ? null : "Image count update was not applied.",
            };
          }
          case "genResolution": {
            const nextResolution = String(rawValue ?? "").trim();
            if (!["1K", "2K", "4K"].includes(nextResolution)) {
              return { accepted: false, reason: `Invalid resolution: ${nextResolution}` };
            }
            const accepted = updateElementById(targetId, {
              genResolution: nextResolution as CanvasElement["genResolution"],
            });
            return {
              accepted,
              reason: accepted ? null : "Resolution update was not applied.",
            };
          }
          case "genAspectRatio": {
            const nextRatio = String(rawValue ?? "").trim();
            const ratioOption = aspectRatioOptions.find(
              (option) => option.value === nextRatio,
            );
            if (!ratioOption) {
              return { accepted: false, reason: `Unknown aspect ratio: ${nextRatio}` };
            }
            const accepted = updateElementById(targetId, {
              genAspectRatio: nextRatio,
            });
            return {
              accepted,
              reason: accepted ? null : "Aspect ratio update was not applied.",
            };
          }
          case "genImageQuality": {
            const nextQuality = String(rawValue ?? "").trim();
            if (!["high", "medium", "low"].includes(nextQuality)) {
              return { accepted: false, reason: `Invalid quality: ${nextQuality}` };
            }
            const accepted = updateElementById(targetId, {
              genImageQuality: nextQuality as CanvasElement["genImageQuality"],
            });
            return {
              accepted,
              reason: accepted ? null : "Quality update was not applied.",
            };
          }
          case "genRefImages": {
            const nextImages = Array.isArray(rawValue)
              ? rawValue
                  .map((item) => String(item ?? "").trim())
                  .filter(Boolean)
              : [];
            if (nextImages.length === 0) {
              return {
                accepted: false,
                reason: "Reference image update requires a non-empty string array.",
              };
            }
            const accepted = updateElementById(targetId, {
              genRefImages: nextImages,
              genRefImage: nextImages[0],
              genRefPreviewImages: nextImages,
              genRefPreviewImage: nextImages[0],
            });
            return {
              accepted,
              reason: accepted ? null : "Reference images update was not applied.",
            };
          }
          case "genReferenceRoleMode": {
            const nextMode = String(rawValue ?? "").trim();
            if (!["none", "default", "poster-product", "custom"].includes(nextMode)) {
              return { accepted: false, reason: `Invalid style library mode: ${nextMode}` };
            }
            if (nextMode === "poster-product") {
              const refCount =
                (targetElement.genRefImages?.length || 0) +
                (targetElement.genRefImage && !targetElement.genRefImages?.length ? 1 : 0);
              if (refCount < 2) {
                return {
                  accepted: false,
                  reason: "Poster/Product mode requires at least two reference images.",
                };
              }
            }
            const nextPatch: Partial<CanvasElement> = {
              genReferenceRoleMode:
                nextMode as NonNullable<CanvasElement["genReferenceRoleMode"]>,
            };
            if (nextMode === "custom" && !targetElement.genStyleLibrary) {
              nextPatch.genStyleLibrary = createStyleLibraryDraftFromMode(
                targetElement.genReferenceRoleMode,
                "user",
              );
            }
            const accepted = updateElementById(targetId, nextPatch);
            return {
              accepted,
              reason: accepted ? null : "Style library update was not applied.",
            };
          }
          case "genInfiniteRetry": {
            const nextValue =
              typeof rawValue === "boolean"
                ? rawValue
                : ["true", "1", "yes", "on"].includes(
                    String(rawValue ?? "").trim().toLowerCase(),
                  );
            const accepted = updateElementById(targetId, {
              genInfiniteRetry: nextValue,
            });
            return {
              accepted,
              reason: accepted ? null : "Berserk retry update was not applied.",
            };
          }
          case "treeNodeTone": {
            const nextTone = String(rawValue ?? "").trim();
            if (!["lavender", "mint", "peach", "sky", "sand"].includes(nextTone)) {
              return { accepted: false, reason: `Invalid tone: ${nextTone}` };
            }
            const accepted = updateElementById(targetId, {
              treeNodeTone: nextTone,
            });
            return {
              accepted,
              reason: accepted ? null : "Node tone update was not applied.",
            };
          }
          default:
            return {
              accepted: false,
              reason: `Unsupported control: ${normalizedControlId}`,
            };
        }
      },
      repairGenerationState: (elementId) => {
        const targetId = String(elementId || "").trim();
        if (!targetId) {
          return {
            accepted: false,
            reason: "Missing elementId.",
            repairedFields: [],
            notes: [],
          };
        }

        const targetElement =
          elements.find((element) => element.id === targetId) || null;
        if (!targetElement) {
          return {
            accepted: false,
            reason: `Element not found: ${targetId}`,
            repairedFields: [],
            notes: [],
          };
        }

        const repairedFields: string[] = [];
        const notes: string[] = [];
        const nextPatch: Partial<CanvasElement> = {};
        const sourceRefs =
          targetElement.genRefImages ||
          (targetElement.genRefImage ? [targetElement.genRefImage] : []);
        const previewRefs =
          targetElement.genRefPreviewImages ||
          (targetElement.genRefPreviewImage ? [targetElement.genRefPreviewImage] : []);
        const parentPrompt =
          targetElement.nodeParentId
            ? String(
                (
                  elements.find(
                    (element) => element.id === targetElement.nodeParentId,
                  ) || null
                )?.genPrompt || "",
              ).trim()
            : "";

        if (sourceRefs.length === 0 && previewRefs.length > 0) {
          nextPatch.genRefImages = [...previewRefs];
          nextPatch.genRefImage = previewRefs[0];
          repairedFields.push("genRefImages", "genRefImage");
          notes.push("Recovered the primary reference chain from preview references.");
        }

        if (previewRefs.length === 0 && sourceRefs.length > 0) {
          nextPatch.genRefPreviewImages = [...sourceRefs];
          nextPatch.genRefPreviewImage = sourceRefs[0];
          repairedFields.push("genRefPreviewImages", "genRefPreviewImage");
          notes.push("Backfilled preview references from the current primary reference chain.");
        }

        if (!String(targetElement.genPrompt || "").trim() && parentPrompt) {
          nextPatch.genPrompt = parentPrompt;
          repairedFields.push("genPrompt");
          notes.push("Inherited the parent prompt onto the current child image node.");
        }

        if (!targetElement.isGenerating && targetElement.genError) {
          nextPatch.genError = undefined;
          nextPatch.genStatusPhase = undefined;
          nextPatch.genStatusTitle = undefined;
          nextPatch.genStatusLines = undefined;
          repairedFields.push(
            "genError",
            "genStatusPhase",
            "genStatusTitle",
            "genStatusLines",
          );
          notes.push("Cleared stale generation error/status state on an idle element.");
        }

        if (repairedFields.length === 0) {
          return {
            accepted: true,
            reason: null,
            repairedFields: [],
            notes: ["No repairable generation-state issue was found on this element."],
          };
        }

        const accepted = updateElementById(targetId, nextPatch);
        return {
          accepted,
          reason: accepted ? null : "Repair patch was not applied.",
          repairedFields,
          notes,
        };
      },
      openElementPreviewById: (elementId) => {
        const targetId = String(elementId || "").trim() || selectedElementId || "";
        if (!targetId) {
          return { opened: false, reason: "No element selected." };
        }
        const targetElement =
          elements.find((element) => element.id === targetId) || null;
        if (!targetElement) {
          return { opened: false, reason: `Element not found: ${targetId}` };
        }
        const previewTargetUrl = resolvePreviewUrlForElement(targetElement);
        if (!previewTargetUrl) {
          return {
            opened: false,
            reason: `Element has no previewable image: ${targetId}`,
          };
        }
        setPreviewUrl(previewTargetUrl);
        return {
          opened: true,
          url: previewTargetUrl,
        };
      },
    }),
    [
      elements,
      fitToScreen,
      handleGenImage,
      imageModelOptions,
      aspectRatioOptions,
      resolvePreviewUrlForElement,
      selectedElementId,
      setActiveTool,
      setPreviewUrl,
      setSelectedElementId,
      setSelectedElementIds,
      setShowAssistant,
      updateElementById,
    ],
  );

  const workspaceCanvasStageProps = React.useMemo<
    React.ComponentProps<typeof WorkspaceCanvasStage>
  >(
    () => ({
      browserAgentSnapshot: buildWorkspaceBrowserAgentSnapshot({
        projectTitle,
        showAssistant,
        previewUrl,
        activeTool,
        creationMode,
        zoom,
        pan,
        isPanning,
        isPickingFromCanvas,
        isMarqueeSelecting,
        selectedElementId,
        selectedElementIds,
        selectedElement,
        elements,
        visibleElements: visibleCanvasElements,
        rootElements,
      }),
      browserAgentElementSummaries,
      browserAgentImageModelOptions: imageModelOptions,
      browserAgentAspectRatioOptions: aspectRatioOptions,
      browserAgentActions,
      isCtrlPressed,
      headerBar: {
        showAssistant,
        projectTitle,
        setProjectTitle,
        nodeInteractionMode,
        setNodeInteractionMode,
        onOpenDashboard: navigateToDashboard,
        onShowAssistant: handleOpenAssistant,
      },
      bottomToolbar: {
        leftPanelMode,
        setLeftPanelMode,
        zoom,
        setZoom,
      },
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
      onContextMenu: handleContextMenu,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onCanvasDrop: handleCanvasDrop,
      topToolbar: {
        activeTool,
        showAssistant,
        setActiveTool,
        handleFileUpload,
        onOpenEcommerceWorkflow:
          assistantSidebarProps.panelUi.onOpenEcommerceWorkflow,
        showFeatureComingSoon,
        addShape,
        addGenImage,
        addGenVideo,
        consistencyCheckEnabled,
        currentConsistencyAnchorUrl,
        onToggleConsistencyCheck: handleToggleConsistencyCheck,
        onUploadConsistencyAnchor: handleUploadConsistencyAnchor,
        onClearConsistencyAnchor: handleClearConsistencyAnchor,
        onPreviewConsistencyAnchor: handlePreviewConsistencyAnchor,
      },
      isMarqueeSelecting,
      marqueeStart,
      marqueeEnd,
      pan,
      zoom,
      canvasElementsLayer: workspaceCanvasElementsLayerProps,
      canvasOverlayLayer: workspaceCanvasOverlayLayerProps,
    }),
    [
      activeTool,
      addGenImage,
      addGenVideo,
      addShape,
      assistantSidebarProps,
      browserAgentActions,
      aspectRatioOptions,
      browserAgentElementSummaries,
      imageModelOptions,
      canvasLayerRef,
      elements,
      consistencyCheckEnabled,
      containerRef,
      creationMode,
      cutterTrailGlowRef,
      cutterTrailPathRef,
      cutterTrailTipRef,
      currentConsistencyAnchorUrl,
      handleCanvasDrop,
      handleClearConsistencyAnchor,
      handleContextMenu,
      handleFileUpload,
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleOpenAssistant,
      handlePreviewConsistencyAnchor,
      handleToggleConsistencyCheck,
      handleUploadConsistencyAnchor,
      isCtrlPressed,
      isMarqueeSelecting,
      isPanning,
      isPickingFromCanvas,
      leftPanelMode,
      marqueeBoxRef,
      marqueeEnd,
      marqueeStart,
      navigateToDashboard,
      nodeInteractionMode,
      pan,
      previewUrl,
      projectTitle,
      rootElements,
      setActiveTool,
      setLeftPanelMode,
      setNodeInteractionMode,
      setProjectTitle,
      selectedElement,
      selectedElementId,
      selectedElementIds,
      showAssistant,
      showFeatureComingSoon,
      visibleCanvasElements,
      workspaceCanvasElementsLayerProps,
      workspaceCanvasOverlayLayerProps,
      zoom,
      setZoom,
    ],
  );

  const workspacePageOverlaysProps = React.useMemo<
    React.ComponentProps<typeof WorkspacePageOverlays>
  >(
    () => ({
      contextMenu: {
        contextMenu,
        canDownloadImage: Boolean(
          selectedElement &&
            selectedElement.url &&
            (selectedElement.type === "image" ||
              selectedElement.type === "gen-image"),
        ),
        onClose: handleCloseContextMenu,
        onManualPaste: handleManualPaste,
        onDownload: handleDownload,
        onZoomIn: handleZoomIn,
        onZoomOut: handleZoomOut,
        onFitToScreen: fitToScreen,
        onResetZoom: handleResetZoom,
      },
      previewModal: {
        previewUrl,
        onClose: handlePreviewClose,
      },
      modeSwitchDialog,
      featureNotice: {
        featureNotice,
      },
      touchEditIndicator: {
        touchEditMode,
        onClose: handleTouchEditIndicatorClose,
      },
      touchEditPopup: {
        popup: touchEditPopup,
        instruction: touchEditInstruction,
        isTouchEditing,
        onClose: handleTouchEditPopupClose,
        onInstructionChange: setTouchEditInstruction,
        onExecute: handleTouchEditExecute,
      },
    }),
    [
      contextMenu,
      featureNotice,
      fitToScreen,
      handleCloseContextMenu,
      handleDownload,
      handleManualPaste,
      handlePreviewClose,
      handleResetZoom,
      handleTouchEditExecute,
      handleTouchEditIndicatorClose,
      handleTouchEditPopupClose,
      handleZoomIn,
      handleZoomOut,
      isTouchEditing,
      modeSwitchDialog,
      previewUrl,
      selectedElement,
      setTouchEditInstruction,
      touchEditInstruction,
      touchEditMode,
      touchEditPopup,
    ],
  );

  return {
    workspaceSidebarLayerProps,
    workspaceCanvasStageProps,
    workspacePageOverlaysProps,
  };
};
