import React, { memo } from "react";
import ReactDOM from "react-dom";
import type { CanvasElement } from "../../../types";
import { WorkspaceImageConfigPanel } from "./WorkspaceImageConfigPanel";
import { WorkspaceImageTextEditModal } from "./WorkspaceImageTextEditModal";
import { WorkspaceImageEraserOverlay } from "./WorkspaceImageEraserOverlay";
import { WorkspaceImageSideToolbar } from "./WorkspaceImageSideToolbar";
import { WorkspaceImageFastEditPanel } from "./WorkspaceImageFastEditPanel";
import { isWorkspaceTreeNode } from "../workspaceTreeNode";

type ImageModelOption = {
  id: string;
  name: string;
  desc: string;
  time: string;
  providerName?: string;
};

type AspectRatioOption = {
  label: string;
  value: string;
  size: string;
};

type EraserHistoryItem = {
  display: string;
  mask: string;
};

type Point = {
  x: number;
  y: number;
};

type WorkspaceImageToolbarProps = {
  canvasLayerRef: React.RefObject<HTMLDivElement | null>;
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedElement: CanvasElement | null;
  isDraggingElement: boolean;
  zoom: number;
  translatePromptToEnglish: boolean;
  enforceChineseTextInImage: boolean;
  requiredChineseCopy: string;
  showModelPicker: boolean;
  showResPicker: boolean;
  showRatioPicker: boolean;
  modelOptions: ImageModelOption[];
  aspectRatios: AspectRatioOption[];
  renderRatioIcon: (ratioStr: string, isActive?: boolean) => React.ReactNode;
  setTranslatePromptToEnglish: (value: boolean) => void;
  setEnforceChineseTextInImage: (value: boolean) => void;
  setRequiredChineseCopy: (value: string) => void;
  setShowModelPicker: React.Dispatch<React.SetStateAction<boolean>>;
  setShowResPicker: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRatioPicker: React.Dispatch<React.SetStateAction<boolean>>;
  updateSelectedElement: (updates: Partial<CanvasElement>) => void;
  handleRefImageUpload: (
    e: React.ChangeEvent<HTMLInputElement>,
    elementId: string,
  ) => void | Promise<void>;
  handleGenImage: (elementId: string) => void | Promise<void>;
  showTextEditModal: boolean;
  detectedTexts: string[];
  editedTexts: string[];
  isExtractingText: boolean;
  setEditedTexts: (texts: string[]) => void;
  setShowTextEditModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleApplyTextEdits: () => void | Promise<void>;
  eraserMode: boolean;
  eraserMaskCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  setEraserMaskDataUrl: (value: string | null) => void;
  eraserCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  eraserCanvasRectRef: React.MutableRefObject<DOMRect | null>;
  brushSize: number;
  eraserCursorRef: React.RefObject<HTMLDivElement | null>;
  setEraserHistory: React.Dispatch<React.SetStateAction<EraserHistoryItem[]>>;
  setIsDrawingEraser: React.Dispatch<React.SetStateAction<boolean>>;
  isDrawingEraser: boolean;
  setEraserHasPaint: React.Dispatch<React.SetStateAction<boolean>>;
  eraserHasPaint: boolean;
  eraserLastPointRef: React.MutableRefObject<Point | null>;
  handleUndoEraser: () => void;
  handleClearEraser: () => void;
  setBrushSize: (size: number) => void;
  setEraserMode: React.Dispatch<React.SetStateAction<boolean>>;
  handleCloseEraser: () => void;
  handleExecuteEraser: () => void | Promise<void>;
  toolbarExpanded: boolean;
  setToolbarExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  toolbarExpandTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  showUpscalePanel: boolean;
  setShowUpscalePanel: React.Dispatch<React.SetStateAction<boolean>>;
  selectedUpscaleRes: "2K" | "4K" | "8K";
  setSelectedUpscaleRes: React.Dispatch<React.SetStateAction<"2K" | "4K" | "8K">>;
  showUpscaleResDropdown: boolean;
  setShowUpscaleResDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  upscaleSourceSize: { width: number; height: number } | null;
  getUpscaleFactor: (res: "2K" | "4K" | "8K") => number;
  calcUpscaleTargetSize: (
    width: number,
    height: number,
    factor: number,
  ) => { width: number; height: number };
  handleUpscaleSelect: (factor: number) => void;
  handleRemoveBg: () => void | Promise<void>;
  showProductSwapPanel: boolean;
  setShowProductSwapPanel: React.Dispatch<React.SetStateAction<boolean>>;
  productSwapImages: string[];
  setProductSwapImages: React.Dispatch<React.SetStateAction<string[]>>;
  productSwapRes: "1K" | "2K" | "4K";
  setProductSwapRes: React.Dispatch<React.SetStateAction<"1K" | "2K" | "4K">>;
  showProductSwapResDropdown: boolean;
  setShowProductSwapResDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  fileToDataUrl: (file: File) => Promise<string>;
  handleProductSwap: () => void | Promise<void>;
  handleEditTextClick: () => void | Promise<void>;
  handleVectorRedraw: () => void | Promise<void>;
  handleDownload: () => void;
  showFastEdit: boolean;
  setShowFastEdit: React.Dispatch<React.SetStateAction<boolean>>;
  fastEditPrompt: string;
  setFastEditPrompt: (value: string) => void;
  handleFastEditRun: () => void | Promise<void>;
  consistencyCheckEnabled: boolean;
  currentConsistencyAnchorUrl: string | null;
  approvedConsistencyAssetIds: string[];
  handleSetConsistencyAnchorFromElement: (
    element: CanvasElement | null,
  ) => void | Promise<void>;
  handlePreviewConsistencyAnchor: (anchorUrl: string) => void;
};

const EMPTY_GEN_IMAGE_PANEL_PLACEHOLDER: CanvasElement = {
  id: "__empty-gen-panel-placeholder__",
  type: "gen-image",
  x: -100000,
  y: -100000,
  width: 1024,
  height: 1024,
  zIndex: -1,
  genPrompt: "",
  genModel: "Nano Banana Pro",
  genAspectRatio: "1:1",
  genResolution: "1K",
  genImageQuality: "medium",
  genImageCount: 1,
};

const WorkspaceImageToolbarImpl: React.FC<WorkspaceImageToolbarProps> = ({
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
  modelOptions,
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
}) => {
  const el = selectedElement;
  const [cachedEmptyGenImageElement, setCachedEmptyGenImageElement] =
    React.useState<CanvasElement | null>(null);
  const hasSingleImageSelection =
    !!selectedElementId &&
    selectedElementIds.length <= 1 &&
    !!el &&
    (el.type === "gen-image" || el.type === "image");
  const shouldShowSingleImageToolbar =
    hasSingleImageSelection && !isDraggingElement;
  const isEmptyGenImageSelection =
    shouldShowSingleImageToolbar &&
    el.type === "gen-image" &&
    el.nodeInteractionMode !== "branch" &&
    !el.url &&
    !el.isGenerating;
  const isTreeNodeSelection =
    shouldShowSingleImageToolbar && !!el && isWorkspaceTreeNode(el);
  const isBranchPromptSelection =
    isTreeNodeSelection && el.type === "gen-image";
  const isBranchImageSelection = isTreeNodeSelection && el.type === "image";

  React.useEffect(() => {
    if (isEmptyGenImageSelection) {
      setCachedEmptyGenImageElement(el);
    }
  }, [el, isEmptyGenImageSelection]);

  const activeEmptyGenImageElement = isEmptyGenImageSelection
    ? el
    : cachedEmptyGenImageElement;
  const configPanelElement =
    activeEmptyGenImageElement || EMPTY_GEN_IMAGE_PANEL_PLACEHOLDER;
  const approvedConsistencyAssetIdSet = React.useMemo(
    () => new Set(approvedConsistencyAssetIds),
    [approvedConsistencyAssetIds],
  );

  // Canvas-space coordinates (toolbar lives inside the CSS transform layer)
  const elX = el?.x ?? activeEmptyGenImageElement?.x ?? 0;
  const elY = el?.y ?? activeEmptyGenImageElement?.y ?? 0;
  const canvasCenterX = elX + (el?.width ?? activeEmptyGenImageElement?.width ?? 0) / 2;
  const counterScale = 100 / zoom;

  const emptyGenPanelScreenPosition = React.useMemo(() => {
    if (!isEmptyGenImageSelection && !activeEmptyGenImageElement) {
      return {
        left: -100000,
        top: -100000,
      };
    }

    const panelElement = activeEmptyGenImageElement || el;
    const canvasRect = canvasLayerRef.current?.getBoundingClientRect() ?? null;
    if (!panelElement || !canvasRect) {
      return {
        left: -100000,
        top: -100000,
      };
    }

    const zoomScale = zoom / 100;
    const panelX = panelElement.x + panelElement.width / 2;
    return {
      left: canvasRect.left + panelX * zoomScale,
      top: canvasRect.top + (panelElement.y + panelElement.height + 16) * zoomScale,
    };
  }, [
    activeEmptyGenImageElement,
    canvasLayerRef,
    el,
    isEmptyGenImageSelection,
    zoom,
  ]);

  const emptyGenConfigPanel =
    typeof document !== "undefined"
      ? ReactDOM.createPortal(
          <WorkspaceImageConfigPanel
            element={configPanelElement}
            visible={isEmptyGenImageSelection}
            canvasCenterX={canvasCenterX}
            elementY={elY}
            zoom={zoom}
            screenPosition={emptyGenPanelScreenPosition}
            translatePromptToEnglish={translatePromptToEnglish}
            enforceChineseTextInImage={enforceChineseTextInImage}
            requiredChineseCopy={requiredChineseCopy}
            showModelPicker={showModelPicker}
            showResPicker={showResPicker}
            showRatioPicker={showRatioPicker}
            modelOptions={modelOptions}
            aspectRatios={aspectRatios}
            renderRatioIcon={renderRatioIcon}
            setTranslatePromptToEnglish={setTranslatePromptToEnglish}
            setEnforceChineseTextInImage={setEnforceChineseTextInImage}
            setRequiredChineseCopy={setRequiredChineseCopy}
            setShowModelPicker={setShowModelPicker}
            setShowResPicker={setShowResPicker}
            setShowRatioPicker={setShowRatioPicker}
            updateSelectedElement={updateSelectedElement}
            handleRefImageUpload={handleRefImageUpload}
            handleGenImage={handleGenImage}
          />,
          document.body,
        )
      : null;

  // Configuration Toolbar for Empty Gen-Image
  if (isEmptyGenImageSelection) {
    return emptyGenConfigPanel;
  }

  if (!shouldShowSingleImageToolbar || !el) {
    return emptyGenConfigPanel;
  }

  if (isBranchPromptSelection) {
    return null;
  }

  if (isBranchImageSelection && !eraserMode && !showTextEditModal) {
    return null;
  }

  // Only show if it has a URL (actual image)
  // if (!el.url && el.type === 'gen-image') return null; // This line is replaced by the above block

  // Calculate scaling logic (cap the scaling to avoid huge toolbars when zoomed in, keep them reasonable sized)
  // Adjust baseline scale depending on viewport zoom
  const adaptiveScale = Math.max(0.1, Math.min(2.0, zoom / 100));
  const flexibleScale = 1 + (1 / adaptiveScale - 1) * 0.85;
  const rightToolbarLeft = elX + el.width + 16 / adaptiveScale;
  const topToolbarTop = elY;
  const bottomButtonTop = elY + el.height + 12 / adaptiveScale;
  const elementSourceUrl = el.originalUrl || el.url || "";
  const isCurrentElementAnchor =
    approvedConsistencyAssetIdSet.has(el.id) ||
    (!!elementSourceUrl &&
      !!currentConsistencyAnchorUrl &&
      elementSourceUrl === currentConsistencyAnchorUrl);

    // Text Edit Modal logic
    if (showTextEditModal) {
      const modalLeft = elX + el.width + 30 / adaptiveScale;
      const modalTop = elY;
      return (
        <>
          {emptyGenConfigPanel}
          <WorkspaceImageTextEditModal
            show={showTextEditModal}
            left={modalLeft}
            top={modalTop}
            scale={1 / adaptiveScale}
            detectedTexts={detectedTexts}
            editedTexts={editedTexts}
            isExtractingText={isExtractingText}
            setEditedTexts={setEditedTexts}
            onClose={() => setShowTextEditModal(false)}
            onApply={handleApplyTextEdits}
          />
        </>
      );
    }

    // ERASER MODE UI
    if (eraserMode) {
      const selectedImageEl = selectedElement;
      const canDrawMask =
        !!selectedImageEl &&
        (selectedImageEl.type === "image" ||
          selectedImageEl.type === "gen-image") &&
        !!selectedImageEl.url;

      const syncMaskSnapshot = () => {
        const maskCanvas = eraserMaskCanvasRef.current;
        if (!maskCanvas) return;
        const data = maskCanvas.toDataURL("image/png");
        setEraserMaskDataUrl(data);
      };

      const getPointerPos = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = eraserCanvasRef.current;
        if (!canvas) return null;
        const rect =
          eraserCanvasRectRef.current || canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
        const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
        return { x, y };
      };

      const getCanvasBrushSize = () => {
        const viewScale = Math.max(0.001, zoom / 100);
        return Math.max(4, brushSize) / viewScale;
      };

      const updateEraserCursor = (
        event: React.PointerEvent<HTMLCanvasElement>,
      ) => {
        const canvas = eraserCanvasRef.current;
        const cursor = eraserCursorRef.current;
        if (!canvas || !cursor) return;
        const rect =
          eraserCanvasRectRef.current || canvas.getBoundingClientRect();
        const viewScale = Math.max(0.001, zoom / 100);
        const x = (event.clientX - rect.left) / viewScale;
        const y = (event.clientY - rect.top) / viewScale;
        const size = Math.max(8, brushSize / viewScale);
        cursor.style.width = `${size}px`;
        cursor.style.height = `${size}px`;
        cursor.style.transform = `translate3d(${x - size / 2}px, ${y - size / 2}px, 0)`;
        cursor.style.opacity = "1";
      };

      const hideEraserCursor = () => {
        const cursor = eraserCursorRef.current;
        if (!cursor) return;
        cursor.style.opacity = "0";
        cursor.style.transform = "translate3d(-9999px,-9999px,0)";
      };

      const handleEraserPointerDown = (
        event: React.PointerEvent<HTMLCanvasElement>,
      ) => {
        if (!canDrawMask) return;
        const canvas = eraserCanvasRef.current;
        const maskCanvas = eraserMaskCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const maskCtx = maskCanvas?.getContext("2d");
        if (!ctx || !maskCtx || !maskCanvas) return;
        const pt = getPointerPos(event);
        if (!pt) return;

        event.stopPropagation();

        setEraserHistory((prev) => [
          ...prev,
          {
            display: canvas.toDataURL("image/png"),
            mask: maskCanvas.toDataURL("image/png"),
          },
        ]);

        setIsDrawingEraser(true);
        canvas.setPointerCapture(event.pointerId);
        eraserCanvasRectRef.current = canvas.getBoundingClientRect();
        const canvasBrushSize = getCanvasBrushSize();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
        ctx.globalAlpha = 1;
        ctx.lineWidth = canvasBrushSize;
        ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
        ctx.shadowBlur = 6;
        maskCtx.lineCap = "round";
        maskCtx.lineJoin = "round";
        maskCtx.strokeStyle = "#FFFFFF";
        maskCtx.globalAlpha = 1;
        maskCtx.lineWidth = canvasBrushSize;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        maskCtx.beginPath();
        maskCtx.moveTo(pt.x, pt.y);
        eraserLastPointRef.current = pt;
        updateEraserCursor(event);
      };

      const handleEraserPointerMove = (
        event: React.PointerEvent<HTMLCanvasElement>,
      ) => {
        updateEraserCursor(event);
        if (!isDrawingEraser) return;
        const canvas = eraserCanvasRef.current;
        const maskCanvas = eraserMaskCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const maskCtx = maskCanvas?.getContext("2d");
        if (!ctx || !maskCtx) return;
        const pt = getPointerPos(event);
        if (!pt) return;
        event.stopPropagation();

        const last = eraserLastPointRef.current || pt;
        const canvasBrushSize = getCanvasBrushSize();
        ctx.save();
        ctx.beginPath();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
        ctx.lineWidth = canvasBrushSize * 1.08;
        ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
        ctx.shadowBlur = 10;
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
        ctx.lineWidth = canvasBrushSize;
        ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
        ctx.shadowBlur = 6;
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();

        maskCtx.lineTo(pt.x, pt.y);
        maskCtx.stroke();
        eraserLastPointRef.current = pt;
      };

      const handleEraserPointerUp = (
        event: React.PointerEvent<HTMLCanvasElement>,
      ) => {
        if (!isDrawingEraser) return;
        const canvas = eraserCanvasRef.current;
        const maskCanvas = eraserMaskCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          const maskCtx = maskCanvas?.getContext("2d");
          ctx?.closePath();
          maskCtx?.closePath();
          if (ctx) {
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
          }
          canvas.releasePointerCapture(event.pointerId);
        }
        event.stopPropagation();
        setIsDrawingEraser(false);
        setEraserHasPaint(true);
        syncMaskSnapshot();
        eraserLastPointRef.current = null;
      };

      return (
        <>
          {emptyGenConfigPanel}
          <WorkspaceImageEraserOverlay
            panelLeft={elX + el.width + 12 / adaptiveScale}
            panelTop={elY}
            panelScale={1 / adaptiveScale}
            brushSize={brushSize}
            eraserHasPaint={eraserHasPaint}
            isDrawingEraser={isDrawingEraser}
            canDrawMask={canDrawMask}
            selectedImageEl={selectedImageEl}
            canvasRef={eraserCanvasRef}
            cursorRef={eraserCursorRef}
            onUndo={handleUndoEraser}
            onClear={handleClearEraser}
            onBrushSizeChange={setBrushSize}
            onClose={handleCloseEraser}
            onApply={handleExecuteEraser}
            onPointerEnter={updateEraserCursor}
            onPointerDown={handleEraserPointerDown}
            onPointerMove={handleEraserPointerMove}
            onPointerUp={handleEraserPointerUp}
            onPointerLeave={(e) => {
              handleEraserPointerUp(e);
              hideEraserCursor();
            }}
          />
        </>
      );
    }

    return (
      <>
        {emptyGenConfigPanel}
        <WorkspaceImageSideToolbar
          key={`image-side-toolbar-${el.id}`}
          element={el}
          isDraggingElement={isDraggingElement}
          left={rightToolbarLeft}
          top={topToolbarTop}
          scale={flexibleScale}
          toolbarExpanded={toolbarExpanded}
          setToolbarExpanded={setToolbarExpanded}
          toolbarExpandTimer={toolbarExpandTimer}
          showUpscalePanel={showUpscalePanel}
          setShowUpscalePanel={setShowUpscalePanel}
          selectedUpscaleRes={selectedUpscaleRes}
          setSelectedUpscaleRes={setSelectedUpscaleRes}
          showUpscaleResDropdown={showUpscaleResDropdown}
          setShowUpscaleResDropdown={setShowUpscaleResDropdown}
          upscaleSourceSize={upscaleSourceSize}
          getUpscaleFactor={getUpscaleFactor}
          calcUpscaleTargetSize={calcUpscaleTargetSize}
          handleUpscaleSelect={handleUpscaleSelect}
          handleRemoveBg={handleRemoveBg}
          showProductSwapPanel={showProductSwapPanel}
          setShowProductSwapPanel={setShowProductSwapPanel}
          productSwapImages={productSwapImages}
          setProductSwapImages={setProductSwapImages}
          productSwapRes={productSwapRes}
          setProductSwapRes={setProductSwapRes}
          showProductSwapResDropdown={showProductSwapResDropdown}
          setShowProductSwapResDropdown={setShowProductSwapResDropdown}
          fileToDataUrl={fileToDataUrl}
          handleProductSwap={handleProductSwap}
          handleGenImage={handleGenImage}
          setEraserMode={setEraserMode}
          handleEditTextClick={handleEditTextClick}
          handleVectorRedraw={handleVectorRedraw}
          handleDownload={handleDownload}
          setShowFastEdit={setShowFastEdit}
          consistencyCheckEnabled={consistencyCheckEnabled}
          currentConsistencyAnchorUrl={currentConsistencyAnchorUrl}
          isCurrentElementAnchor={isCurrentElementAnchor}
          onSetCurrentAsAnchor={() =>
            void handleSetConsistencyAnchorFromElement(el)
          }
          onPreviewCurrentAnchor={handlePreviewConsistencyAnchor}
        />

        {/* Bottom Center Fast Edit Mode Tool when active */}
        <WorkspaceImageFastEditPanel
          show={showFastEdit}
          left={canvasCenterX}
          top={bottomButtonTop}
          scale={1 / adaptiveScale}
          prompt={fastEditPrompt}
          isGenerating={el.isGenerating}
          setPrompt={setFastEditPrompt}
          onClose={() => setShowFastEdit(false)}
          onRun={handleFastEditRun}
        />
      </>
    );
};

const isEmptyGenImageSelectionState = (
  props: WorkspaceImageToolbarProps,
) => {
  const el = props.selectedElement;
  return (
    !!props.selectedElementId &&
    props.selectedElementIds.length <= 1 &&
    !props.isDraggingElement &&
    !!el &&
    el.type === "gen-image" &&
    el.nodeInteractionMode !== "branch" &&
    !el.url &&
    !el.isGenerating
  );
};

export const WorkspaceImageToolbar = memo(
  WorkspaceImageToolbarImpl,
  (prev, next) => {
    const prevIsEmptyGen = isEmptyGenImageSelectionState(prev);
    const nextIsEmptyGen = isEmptyGenImageSelectionState(next);

    if (!prevIsEmptyGen || !nextIsEmptyGen) {
      return false;
    }

    return (
      prev.selectedElement === next.selectedElement &&
      prev.selectedElementId === next.selectedElementId &&
      prev.selectedElementIds.length === next.selectedElementIds.length &&
      prev.isDraggingElement === next.isDraggingElement &&
      prev.zoom === next.zoom &&
      prev.translatePromptToEnglish === next.translatePromptToEnglish &&
      prev.enforceChineseTextInImage === next.enforceChineseTextInImage &&
      prev.requiredChineseCopy === next.requiredChineseCopy &&
      prev.showModelPicker === next.showModelPicker &&
      prev.showResPicker === next.showResPicker &&
      prev.showRatioPicker === next.showRatioPicker
    );
  },
);
