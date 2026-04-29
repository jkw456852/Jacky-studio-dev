import React from "react";
import type {
  CanvasElement,
  InputBlock,
  WorkspaceNodeInteractionMode,
} from "../../../types";
import { WorkspaceCanvasElementsLayer } from "../components/WorkspaceCanvasElementsLayer";
import { WorkspaceCanvasMarkersLayer } from "../components/WorkspaceCanvasMarkersLayer";
import { WorkspaceNodeGraphLayer } from "../components/WorkspaceNodeGraphLayer";
import { WorkspaceCanvasOverlayLayer } from "../components/WorkspaceCanvasOverlayLayer";
import { WorkspaceImageToolbar } from "../components/WorkspaceImageToolbar";
import { WorkspaceMultiSelectToolbar } from "../components/WorkspaceMultiSelectToolbar";
import { WorkspaceShapeToolbar } from "../components/WorkspaceShapeToolbar";
import { WorkspaceTextToolbar } from "../components/WorkspaceTextToolbar";
import { WorkspaceVideoToolbar } from "../components/WorkspaceVideoToolbar";
import type { TreeConnectionDraft } from "../../Workspace";

type WorkspaceCanvasElementsLayerProps = React.ComponentProps<
  typeof WorkspaceCanvasElementsLayer
>;
type WorkspaceCanvasMarkersLayerProps = React.ComponentProps<
  typeof WorkspaceCanvasMarkersLayer
>;
type WorkspaceNodeGraphLayerProps = React.ComponentProps<
  typeof WorkspaceNodeGraphLayer
>;
type WorkspaceImageToolbarProps = React.ComponentProps<
  typeof WorkspaceImageToolbar
>;
type WorkspaceVideoToolbarProps = React.ComponentProps<
  typeof WorkspaceVideoToolbar
>;
type WorkspaceMultiSelectToolbarProps = React.ComponentProps<
  typeof WorkspaceMultiSelectToolbar
>;
type WorkspaceTextToolbarProps = React.ComponentProps<
  typeof WorkspaceTextToolbar
>;
type WorkspaceShapeToolbarProps = React.ComponentProps<
  typeof WorkspaceShapeToolbar
>;

type UseWorkspaceCanvasLayerPropsArgs = {
  canvasLayerRef: React.RefObject<HTMLDivElement | null>;
  visibleCanvasElements: CanvasElement[];
  nodeInteractionMode: WorkspaceNodeInteractionMode;
  selectedElementId: string | null;
  selectedElementIds: string[];
  elementById: Map<string, CanvasElement>;
  activeTool: string;
  isCtrlPressed: boolean;
  editingTextId: string | null;
  isDraggingElement: boolean;
  textEditDraftRef: React.MutableRefObject<Record<string, string>>;
  pendingSelectAllTextIdRef: React.MutableRefObject<string | null>;
  setElementsSynced: React.Dispatch<React.SetStateAction<CanvasElement[]>>;
  setEditingTextId: React.Dispatch<React.SetStateAction<string | null>>;
  setPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
  zoom: number;
  elements: CanvasElement[];
  getTextWidth: WorkspaceCanvasElementsLayerProps["getTextWidth"];
  commitTextEdit: WorkspaceCanvasElementsLayerProps["commitTextEdit"];
  handleResizeStart: (event: React.MouseEvent, handle: string, elementId: string) => void;
  isExtractingText: boolean;
  getElementDisplayUrl: (element: CanvasElement) => string | undefined;
  getElementSourceUrl: (element: CanvasElement) => string | undefined;
  handleElementMouseDown: (event: React.MouseEvent, elementId: string) => void;
  handleUngroupSelected: () => void;
  deleteSelectedElement: WorkspaceCanvasElementsLayerProps["deleteSelectedElement"];
  markers: WorkspaceCanvasMarkersLayerProps["markers"];
  dragOffsetsRef: WorkspaceCanvasMarkersLayerProps["dragOffsetsRef"];
  hoveredChipId: string | null;
  inputBlocks: InputBlock[];
  editingMarkerId: string | null;
  setEditingMarkerId: React.Dispatch<React.SetStateAction<string | null>>;
  editingMarkerLabel: string;
  setEditingMarkerLabel: React.Dispatch<React.SetStateAction<string>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  handleSaveMarkerLabel: (markerId: string, label: string) => void;
  selectedElement: CanvasElement | null;
  translatePromptToEnglish: boolean;
  enforceChineseTextInImage: boolean;
  requiredChineseCopy: string;
  showModelPicker: boolean;
  showResPicker: boolean;
  showRatioPicker: boolean;
  imageModelOptions: WorkspaceImageToolbarProps["modelOptions"];
  aspectRatios: WorkspaceImageToolbarProps["aspectRatios"];
  renderRatioIcon: WorkspaceImageToolbarProps["renderRatioIcon"];
  setTranslatePromptToEnglish: React.Dispatch<React.SetStateAction<boolean>>;
  setEnforceChineseTextInImage: React.Dispatch<React.SetStateAction<boolean>>;
  setRequiredChineseCopy: React.Dispatch<React.SetStateAction<string>>;
  setShowModelPicker: React.Dispatch<React.SetStateAction<boolean>>;
  setShowResPicker: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRatioPicker: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  updateSelectedElement: WorkspaceImageToolbarProps["updateSelectedElement"];
  handleRefImageUpload: WorkspaceImageToolbarProps["handleRefImageUpload"];
  handleGenImage: WorkspaceImageToolbarProps["handleGenImage"];
  isTreeConnectionActive: boolean;
  handleTreeConnectionStart: (
    elementId: string,
    port?: "input" | "output",
  ) => void;
  handleTreeConnectionComplete: (elementId: string) => void;
  handleTreeConnectionDisconnect: (parentId: string, childId: string) => void;
  showTextEditModal: boolean;
  detectedTexts: string[];
  editedTexts: string[];
  setEditedTexts: React.Dispatch<React.SetStateAction<string[]>>;
  setShowTextEditModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleApplyTextEdits: WorkspaceImageToolbarProps["handleApplyTextEdits"];
  eraserMode: WorkspaceImageToolbarProps["eraserMode"];
  eraserMaskCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  setEraserMaskDataUrl: WorkspaceImageToolbarProps["setEraserMaskDataUrl"];
  eraserCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  eraserCanvasRectRef: React.MutableRefObject<DOMRect | null>;
  brushSize: number;
  eraserCursorRef: React.RefObject<HTMLDivElement | null>;
  setEraserHistory: WorkspaceImageToolbarProps["setEraserHistory"];
  setIsDrawingEraser: React.Dispatch<React.SetStateAction<boolean>>;
  isDrawingEraser: boolean;
  setEraserHasPaint: React.Dispatch<React.SetStateAction<boolean>>;
  eraserHasPaint: boolean;
  eraserLastPointRef: React.MutableRefObject<{ x: number; y: number } | null>;
  handleUndoEraser: WorkspaceImageToolbarProps["handleUndoEraser"];
  handleClearEraser: WorkspaceImageToolbarProps["handleClearEraser"];
  setBrushSize: React.Dispatch<React.SetStateAction<number>>;
  setEraserMode: WorkspaceImageToolbarProps["setEraserMode"];
  handleCloseEraser: WorkspaceImageToolbarProps["handleCloseEraser"];
  handleExecuteEraser: WorkspaceImageToolbarProps["handleExecuteEraser"];
  toolbarExpanded: boolean;
  setToolbarExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  toolbarExpandTimer: React.ComponentProps<
    typeof WorkspaceImageToolbar
  >["toolbarExpandTimer"];
  showUpscalePanel: boolean;
  setShowUpscalePanel: React.Dispatch<React.SetStateAction<boolean>>;
  selectedUpscaleRes: React.ComponentProps<
    typeof WorkspaceImageToolbar
  >["selectedUpscaleRes"];
  setSelectedUpscaleRes: React.ComponentProps<
    typeof WorkspaceImageToolbar
  >["setSelectedUpscaleRes"];
  showUpscaleResDropdown: boolean;
  setShowUpscaleResDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  upscaleSourceSize: WorkspaceImageToolbarProps["upscaleSourceSize"];
  getUpscaleFactor: WorkspaceImageToolbarProps["getUpscaleFactor"];
  calcUpscaleTargetSize: WorkspaceImageToolbarProps["calcUpscaleTargetSize"];
  handleUpscaleSelect: WorkspaceImageToolbarProps["handleUpscaleSelect"];
  handleRemoveBg: WorkspaceImageToolbarProps["handleRemoveBg"];
  showProductSwapPanel: boolean;
  setShowProductSwapPanel: React.Dispatch<React.SetStateAction<boolean>>;
  productSwapImages: WorkspaceImageToolbarProps["productSwapImages"];
  setProductSwapImages: WorkspaceImageToolbarProps["setProductSwapImages"];
  productSwapRes: React.ComponentProps<
    typeof WorkspaceImageToolbar
  >["productSwapRes"];
  setProductSwapRes: React.ComponentProps<
    typeof WorkspaceImageToolbar
  >["setProductSwapRes"];
  showProductSwapResDropdown: boolean;
  setShowProductSwapResDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  fileToDataUrl: WorkspaceImageToolbarProps["fileToDataUrl"];
  handleProductSwap: WorkspaceImageToolbarProps["handleProductSwap"];
  handleEditTextClick: WorkspaceImageToolbarProps["handleEditTextClick"];
  handleVectorRedraw: WorkspaceImageToolbarProps["handleVectorRedraw"];
  handleDownload: WorkspaceImageToolbarProps["handleDownload"];
  showFastEdit: boolean;
  setShowFastEdit: React.Dispatch<React.SetStateAction<boolean>>;
  fastEditPrompt: string;
  setFastEditPrompt: React.Dispatch<React.SetStateAction<string>>;
  handleFastEditRun: WorkspaceImageToolbarProps["handleFastEditRun"];
  consistencyCheckEnabled: boolean;
  currentConsistencyAnchorUrl: string | null;
  approvedConsistencyAssetIds: string[];
  handleSetConsistencyAnchorFromElement: (
    element: CanvasElement | null,
  ) => void | Promise<void>;
  handlePreviewConsistencyAnchor: (anchorUrl: string) => void;
  videoToolbarTab: WorkspaceVideoToolbarProps["videoToolbarTab"];
  setVideoToolbarTab: WorkspaceVideoToolbarProps["setVideoToolbarTab"];
  handleVideoRefUpload: WorkspaceVideoToolbarProps["handleVideoRefUpload"];
  showVideoModelPicker: boolean;
  setShowVideoModelPicker: React.Dispatch<React.SetStateAction<boolean>>;
  handleGenVideo: WorkspaceVideoToolbarProps["handleGenVideo"];
  showAlignMenu: boolean;
  showSpacingMenu: boolean;
  setShowAlignMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSpacingMenu: React.Dispatch<React.SetStateAction<boolean>>;
  alignSelectedElements: WorkspaceMultiSelectToolbarProps["alignSelectedElements"];
  distributeSelectedElements: WorkspaceMultiSelectToolbarProps["distributeSelectedElements"];
  handleGroupSelected: WorkspaceMultiSelectToolbarProps["handleGroupSelected"];
  handleMergeSelected: WorkspaceMultiSelectToolbarProps["handleMergeSelected"];
  fontTriggerRef: React.ComponentProps<
    typeof WorkspaceTextToolbar
  >["fontTriggerRef"];
  weightTriggerRef: React.ComponentProps<
    typeof WorkspaceTextToolbar
  >["weightTriggerRef"];
  textSettingsTriggerRef: React.ComponentProps<
    typeof WorkspaceTextToolbar
  >["textSettingsTriggerRef"];
  fontPopoverRef: React.RefObject<HTMLDivElement | null>;
  weightPopoverRef: React.RefObject<HTMLDivElement | null>;
  textSettingsPopoverRef: React.RefObject<HTMLDivElement | null>;
  toggleFontPicker: WorkspaceTextToolbarProps["toggleFontPicker"];
  toggleWeightPicker: WorkspaceTextToolbarProps["toggleWeightPicker"];
  toggleTextSettings: WorkspaceTextToolbarProps["toggleTextSettings"];
  showFontPicker: boolean;
  showWeightPicker: boolean;
  showTextSettings: boolean;
  fontPickerPos: WorkspaceTextToolbarProps["fontPickerPos"];
  weightPickerPos: WorkspaceTextToolbarProps["weightPickerPos"];
  textSettingsPos: WorkspaceTextToolbarProps["textSettingsPos"];
  setShowFontPicker: React.Dispatch<React.SetStateAction<boolean>>;
  setShowWeightPicker: React.Dispatch<React.SetStateAction<boolean>>;
  fonts: WorkspaceTextToolbarProps["fonts"];
  treeConnectionDraft: TreeConnectionDraft;
};

export const useWorkspaceCanvasLayerProps = ({
  canvasLayerRef,
  visibleCanvasElements,
  nodeInteractionMode,
  selectedElementId,
  selectedElementIds,
  elementById,
  activeTool,
  isCtrlPressed,
  editingTextId,
  isDraggingElement,
  textEditDraftRef,
  pendingSelectAllTextIdRef,
  setElementsSynced,
  setEditingTextId,
  setPreviewUrl,
  zoom,
  elements,
  getTextWidth,
  commitTextEdit,
  handleResizeStart,
  isExtractingText,
  getElementDisplayUrl,
  getElementSourceUrl,
  handleElementMouseDown,
  handleUngroupSelected,
  deleteSelectedElement,
  markers,
  dragOffsetsRef,
  hoveredChipId,
  inputBlocks,
  editingMarkerId,
  setEditingMarkerId,
  editingMarkerLabel,
  setEditingMarkerLabel,
  setZoom,
  handleSaveMarkerLabel,
  selectedElement,
  translatePromptToEnglish,
  enforceChineseTextInImage,
  requiredChineseCopy,
  showModelPicker,
  showResPicker,
  showRatioPicker,
  imageModelOptions,
  aspectRatios,
  renderRatioIcon,
  setTranslatePromptToEnglish,
  setEnforceChineseTextInImage,
  setRequiredChineseCopy,
  setShowModelPicker,
  setShowResPicker,
  setShowRatioPicker,
  setSelectedElementId,
  setSelectedElementIds,
  updateSelectedElement,
  handleRefImageUpload,
  handleGenImage,
  isTreeConnectionActive,
  handleTreeConnectionStart,
  handleTreeConnectionComplete,
  handleTreeConnectionDisconnect,
  showTextEditModal,
  detectedTexts,
  editedTexts,
  setEditedTexts,
  setShowTextEditModal,
  handleApplyTextEdits,
  eraserMode,
  eraserMaskCanvasRef,
  setEraserMaskDataUrl,
  eraserCanvasRef,
  eraserCanvasRectRef,
  brushSize,
  eraserCursorRef,
  setEraserHistory,
  setIsDrawingEraser,
  isDrawingEraser,
  setEraserHasPaint,
  eraserHasPaint,
  eraserLastPointRef,
  handleUndoEraser,
  handleClearEraser,
  setBrushSize,
  setEraserMode,
  handleCloseEraser,
  handleExecuteEraser,
  toolbarExpanded,
  setToolbarExpanded,
  toolbarExpandTimer,
  showUpscalePanel,
  setShowUpscalePanel,
  selectedUpscaleRes,
  setSelectedUpscaleRes,
  showUpscaleResDropdown,
  setShowUpscaleResDropdown,
  upscaleSourceSize,
  getUpscaleFactor,
  calcUpscaleTargetSize,
  handleUpscaleSelect,
  handleRemoveBg,
  showProductSwapPanel,
  setShowProductSwapPanel,
  productSwapImages,
  setProductSwapImages,
  productSwapRes,
  setProductSwapRes,
  showProductSwapResDropdown,
  setShowProductSwapResDropdown,
  fileToDataUrl,
  handleProductSwap,
  handleEditTextClick,
  handleVectorRedraw,
  handleDownload,
  showFastEdit,
  setShowFastEdit,
  fastEditPrompt,
  setFastEditPrompt,
  handleFastEditRun,
  consistencyCheckEnabled,
  currentConsistencyAnchorUrl,
  approvedConsistencyAssetIds,
  handleSetConsistencyAnchorFromElement,
  handlePreviewConsistencyAnchor,
  videoToolbarTab,
  setVideoToolbarTab,
  handleVideoRefUpload,
  showVideoModelPicker,
  setShowVideoModelPicker,
  handleGenVideo,
  showAlignMenu,
  showSpacingMenu,
  setShowAlignMenu,
  setShowSpacingMenu,
  alignSelectedElements,
  distributeSelectedElements,
  handleGroupSelected,
  handleMergeSelected,
  fontTriggerRef,
  weightTriggerRef,
  textSettingsTriggerRef,
  fontPopoverRef,
  weightPopoverRef,
  textSettingsPopoverRef,
  toggleFontPicker,
  toggleWeightPicker,
  toggleTextSettings,
  showFontPicker,
  showWeightPicker,
  showTextSettings,
  fontPickerPos,
  weightPickerPos,
  textSettingsPos,
  setShowFontPicker,
  setShowWeightPicker,
  fonts,
  treeConnectionDraft,
}: UseWorkspaceCanvasLayerPropsArgs) => {
  const workspaceCanvasElementsLayerProps: React.ComponentProps<
    typeof WorkspaceCanvasElementsLayer
  > = {
    visibleCanvasElements,
    nodeInteractionMode,
    selectedElementId,
    selectedElementIds,
    elementById,
    activeTool,
    isCtrlPressed,
    editingTextId,
    isDraggingElement,
    textEditDraftRef,
    pendingSelectAllTextIdRef,
    setElementsSynced,
    setEditingTextId,
    setPreviewUrl,
    zoom,
    elements,
    getTextWidth,
    commitTextEdit,
    handleResizeStart,
    isExtractingText,
    getElementDisplayUrl,
    getElementSourceUrl,
    modelOptions: imageModelOptions,
    aspectRatios,
    updateSelectedElement,
    setSelectedElementId,
    setSelectedElementIds,
    handleRefImageUpload,
    handleGenImage,
    setEraserMode,
    isTreeConnectionActive,
    handleTreeConnectionStart,
    handleTreeConnectionComplete,
    handleElementMouseDown,
    handleUngroupSelected,
    deleteSelectedElement,
  };

  const workspaceCanvasOverlayLayerProps: React.ComponentProps<
    typeof WorkspaceCanvasOverlayLayer
  > = {
    nodeGraphLayer: {
      elements: visibleCanvasElements,
      isDraggingElement,
      dragOffsetsRef,
      zoom,
      connectionDraft: treeConnectionDraft,
      onDisconnectEdge: handleTreeConnectionDisconnect,
    },
    markersLayer: {
      markers,
      elementById,
      isDraggingElement,
      dragOffsetsRef,
      zoom,
      hoveredChipId,
      inputBlocks,
      editingMarkerId,
      setEditingMarkerId,
      editingMarkerLabel,
      setEditingMarkerLabel,
      setZoom,
      onSaveMarkerLabel: handleSaveMarkerLabel,
    },
    imageToolbar: {
      canvasLayerRef,
      selectedElementId,
      selectedElementIds,
      selectedElement,
      isDraggingElement,
      zoom,
      translatePromptToEnglish,
      enforceChineseTextInImage,
      requiredChineseCopy,
      showModelPicker,
      showResPicker,
      showRatioPicker,
      modelOptions: imageModelOptions,
      aspectRatios,
      renderRatioIcon,
      setTranslatePromptToEnglish,
      setEnforceChineseTextInImage,
      setRequiredChineseCopy,
      setShowModelPicker,
      setShowResPicker,
      setShowRatioPicker,
      updateSelectedElement,
      handleRefImageUpload,
      handleGenImage,
      showTextEditModal,
      detectedTexts,
      editedTexts,
      isExtractingText,
      setEditedTexts,
      setShowTextEditModal,
      handleApplyTextEdits,
      eraserMode,
      eraserMaskCanvasRef,
      setEraserMaskDataUrl,
      eraserCanvasRef,
      eraserCanvasRectRef,
      brushSize,
      eraserCursorRef,
      setEraserHistory,
      setIsDrawingEraser,
      isDrawingEraser,
      setEraserHasPaint,
      eraserHasPaint,
      eraserLastPointRef,
      handleUndoEraser,
      handleClearEraser,
      setBrushSize,
      setEraserMode,
      handleCloseEraser,
      handleExecuteEraser,
      toolbarExpanded,
      setToolbarExpanded,
      toolbarExpandTimer,
      showUpscalePanel,
      setShowUpscalePanel,
      selectedUpscaleRes,
      setSelectedUpscaleRes,
      showUpscaleResDropdown,
      setShowUpscaleResDropdown,
      upscaleSourceSize,
      getUpscaleFactor,
      calcUpscaleTargetSize,
      handleUpscaleSelect,
      handleRemoveBg,
      showProductSwapPanel,
      setShowProductSwapPanel,
      productSwapImages,
      setProductSwapImages,
      productSwapRes,
      setProductSwapRes,
      showProductSwapResDropdown,
      setShowProductSwapResDropdown,
      fileToDataUrl,
      handleProductSwap,
      handleEditTextClick,
      handleVectorRedraw,
      handleDownload,
      showFastEdit,
      setShowFastEdit,
      fastEditPrompt,
      setFastEditPrompt,
      handleFastEditRun,
      consistencyCheckEnabled,
      currentConsistencyAnchorUrl,
      approvedConsistencyAssetIds,
      handleSetConsistencyAnchorFromElement,
      handlePreviewConsistencyAnchor,
    },
    videoToolbar: {
      selectedElementId,
      selectedElementIds,
      selectedElement,
      isDraggingElement,
      zoom,
      videoToolbarTab,
      setVideoToolbarTab,
      updateSelectedElement,
      handleVideoRefUpload,
      showVideoModelPicker,
      setShowVideoModelPicker,
      showRatioPicker,
      setShowRatioPicker,
      handleGenVideo,
    },
    multiSelectToolbar: {
      selectedElementIds,
      elements,
      isDraggingElement,
      dragOffsetsRef,
      zoom,
      showAlignMenu,
      showSpacingMenu,
      setShowAlignMenu,
      setShowSpacingMenu,
      alignSelectedElements,
      distributeSelectedElements,
      handleDownload,
      handleGroupSelected,
      handleMergeSelected,
    },
    textToolbar: {
      selectedElementId,
      selectedElementIds,
      selectedElement,
      isDraggingElement,
      zoom,
      elements,
      setElementsSynced,
      textEditDraftRef,
      getTextWidth,
      fontTriggerRef,
      weightTriggerRef,
      textSettingsTriggerRef,
      fontPopoverRef,
      weightPopoverRef,
      textSettingsPopoverRef,
      toggleFontPicker,
      toggleWeightPicker,
      toggleTextSettings,
      showFontPicker,
      showWeightPicker,
      showTextSettings,
      fontPickerPos,
      weightPickerPos,
      textSettingsPos,
      setShowFontPicker,
      setShowWeightPicker,
      fonts,
    },
    shapeToolbar: {
      selectedElementId,
      selectedElementIds,
      selectedElement,
      elements,
      setElementsSynced,
      updateSelectedElement,
    },
  };

  return {
    workspaceCanvasElementsLayerProps,
    workspaceCanvasOverlayLayerProps,
  };
};
