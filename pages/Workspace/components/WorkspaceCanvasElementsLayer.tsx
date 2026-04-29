import React, { memo, useMemo } from "react";
import type { CanvasElement, WorkspaceNodeInteractionMode } from "../../../types";
import { WorkspaceCanvasElementContent } from "./WorkspaceCanvasElementContent";
import { WorkspaceCanvasElementShell } from "./WorkspaceCanvasElementShell";
import { WorkspaceCanvasGroupElement } from "./WorkspaceCanvasGroupElement";

type ResizeHandle = "nw" | "ne" | "sw" | "se" | "w" | "e" | string;

type WorkspaceCanvasElementsLayerProps = {
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
  getTextWidth: (
    text: string,
    fontSize: number,
    fontFamily: string,
    fontWeight?: string | number,
    letterSpacing?: number,
  ) => number;
  commitTextEdit: (elementId: string, rawText: string) => void;
  handleResizeStart: (
    event: React.MouseEvent,
    handle: ResizeHandle,
    elementId: string,
  ) => void;
  isExtractingText: boolean;
  getElementDisplayUrl: (element: CanvasElement) => string | undefined;
  getElementSourceUrl: (element: CanvasElement) => string | undefined;
  modelOptions: Array<{
    id: string;
    name: string;
    desc: string;
    time: string;
    providerName?: string;
  }>;
  aspectRatios: Array<{
    label: string;
    value: string;
    size: string;
  }>;
  updateSelectedElement: (updates: Partial<CanvasElement>) => void;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleRefImageUpload: (
    e: React.ChangeEvent<HTMLInputElement>,
    elementId: string,
  ) => void | Promise<void>;
  handleGenImage: (elementId: string) => void | Promise<void>;
  setEraserMode: React.Dispatch<React.SetStateAction<boolean>>;
  isTreeConnectionActive: boolean;
  handleTreeConnectionStart: (
    elementId: string,
    port?: "input" | "output",
  ) => void;
  handleTreeConnectionComplete: (elementId: string) => void;
  handleElementMouseDown: (event: React.MouseEvent, elementId: string) => void;
  handleUngroupSelected: () => void;
  deleteSelectedElement: () => void;
};

type WorkspaceCanvasElementItemProps = {
  element: CanvasElement;
  nodeInteractionMode: WorkspaceNodeInteractionMode;
  isSelected: boolean;
  isLocked: boolean;
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
  handleResizeStart: WorkspaceCanvasElementsLayerProps["handleResizeStart"];
  isExtractingText: boolean;
  getElementDisplayUrl: WorkspaceCanvasElementsLayerProps["getElementDisplayUrl"];
  getElementSourceUrl: WorkspaceCanvasElementsLayerProps["getElementSourceUrl"];
  modelOptions: WorkspaceCanvasElementsLayerProps["modelOptions"];
  aspectRatios: WorkspaceCanvasElementsLayerProps["aspectRatios"];
  updateSelectedElement: WorkspaceCanvasElementsLayerProps["updateSelectedElement"];
  setSelectedElementId: WorkspaceCanvasElementsLayerProps["setSelectedElementId"];
  setSelectedElementIds: WorkspaceCanvasElementsLayerProps["setSelectedElementIds"];
  handleRefImageUpload: WorkspaceCanvasElementsLayerProps["handleRefImageUpload"];
  handleGenImage: WorkspaceCanvasElementsLayerProps["handleGenImage"];
  setEraserMode: WorkspaceCanvasElementsLayerProps["setEraserMode"];
  isTreeConnectionActive: WorkspaceCanvasElementsLayerProps["isTreeConnectionActive"];
  handleTreeConnectionStart: WorkspaceCanvasElementsLayerProps["handleTreeConnectionStart"];
  handleTreeConnectionComplete: WorkspaceCanvasElementsLayerProps["handleTreeConnectionComplete"];
  handleElementMouseDown: WorkspaceCanvasElementsLayerProps["handleElementMouseDown"];
  handleUngroupSelected: WorkspaceCanvasElementsLayerProps["handleUngroupSelected"];
  deleteSelectedElement: WorkspaceCanvasElementsLayerProps["deleteSelectedElement"];
};

const WorkspaceCanvasElementItem = memo(
  ({
    element,
    nodeInteractionMode,
    isSelected,
    isLocked,
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
    modelOptions,
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
  }: WorkspaceCanvasElementItemProps) => {
    const activateNode = React.useCallback(
      (elementId: string) => {
        setSelectedElementId(elementId);
        setSelectedElementIds((prev) =>
          prev.length === 1 && prev[0] === elementId ? prev : [elementId],
        );
      },
      [setSelectedElementId, setSelectedElementIds],
    );

    if (element.type === "group") {
      return (
        <WorkspaceCanvasGroupElement
          element={element}
          isSelected={isSelected}
          isLocked={isLocked}
          activeTool={activeTool}
          onMouseDown={(event) =>
            !isLocked && handleElementMouseDown(event, element.id)
          }
          onUngroup={(event) => {
            event.stopPropagation();
            handleUngroupSelected();
          }}
          onDelete={(event) => {
            event.stopPropagation();
            deleteSelectedElement();
          }}
        />
      );
    }

    return (
      <WorkspaceCanvasElementShell
        element={element}
        nodeInteractionMode={nodeInteractionMode}
        isSelected={isSelected}
        isLocked={isLocked}
        isCtrlPressed={isCtrlPressed}
        activeTool={activeTool}
        editingTextId={editingTextId}
        isDraggingElement={isDraggingElement && isSelected}
        onMouseDown={(event) =>
          !isLocked && handleElementMouseDown(event, element.id)
        }
        onDoubleClick={() => {
          if (element.type === "text") {
            textEditDraftRef.current[element.id] = element.text || "";
            setEditingTextId(element.id);
          } else if (element.url) {
            setPreviewUrl(getElementSourceUrl(element) || element.url);
          }
        }}
        onDelete={deleteSelectedElement}
      >
        <WorkspaceCanvasElementContent
          element={element}
          nodeInteractionMode={nodeInteractionMode}
          isSelected={isSelected}
          editingTextId={editingTextId}
          zoom={zoom}
          elements={elements}
          textEditDraftRef={textEditDraftRef}
          pendingSelectAllTextIdRef={pendingSelectAllTextIdRef}
          setElementsSynced={setElementsSynced}
          setEditingTextId={setEditingTextId}
          setPreviewUrl={setPreviewUrl}
          getTextWidth={getTextWidth}
          commitTextEdit={commitTextEdit}
          handleResizeStart={handleResizeStart}
          isExtractingText={isExtractingText}
          getElementDisplayUrl={getElementDisplayUrl}
          modelOptions={modelOptions}
          aspectRatios={aspectRatios}
          updateSelectedElement={updateSelectedElement}
          onActivateNode={activateNode}
          handleRefImageUpload={handleRefImageUpload}
          handleGenImage={handleGenImage}
          setEraserMode={setEraserMode}
          isTreeConnectionActive={isTreeConnectionActive}
          handleTreeConnectionStart={handleTreeConnectionStart}
          handleTreeConnectionComplete={handleTreeConnectionComplete}
          deleteSelectedElement={deleteSelectedElement}
        />
      </WorkspaceCanvasElementShell>
    );
  },
  (prev, next) => {
    if (prev.element !== next.element) return false;
    if (prev.nodeInteractionMode !== next.nodeInteractionMode) return false;
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.isLocked !== next.isLocked) return false;
    if (prev.activeTool !== next.activeTool) return false;
    if (prev.isCtrlPressed !== next.isCtrlPressed) return false;
    if (prev.editingTextId !== next.editingTextId) return false;
    if (prev.isDraggingElement !== next.isDraggingElement) return false;
    if (prev.zoom !== next.zoom) return false;
    if (prev.isExtractingText !== next.isExtractingText) return false;
    if (prev.getElementDisplayUrl !== next.getElementDisplayUrl) return false;
    if (prev.getElementSourceUrl !== next.getElementSourceUrl) return false;
    if (prev.modelOptions !== next.modelOptions) return false;
    if (prev.aspectRatios !== next.aspectRatios) return false;
    if (prev.updateSelectedElement !== next.updateSelectedElement) return false;
    if (prev.setSelectedElementId !== next.setSelectedElementId) return false;
    if (prev.setSelectedElementIds !== next.setSelectedElementIds) return false;
    if (prev.handleRefImageUpload !== next.handleRefImageUpload) return false;
    if (prev.handleGenImage !== next.handleGenImage) return false;
    if (prev.setEraserMode !== next.setEraserMode) return false;
    if (prev.isTreeConnectionActive !== next.isTreeConnectionActive) return false;
    if (prev.handleTreeConnectionStart !== next.handleTreeConnectionStart) {
      return false;
    }
    if (prev.handleTreeConnectionComplete !== next.handleTreeConnectionComplete) {
      return false;
    }
    if (prev.handleElementMouseDown !== next.handleElementMouseDown) return false;
    if (prev.handleResizeStart !== next.handleResizeStart) return false;
    if (prev.deleteSelectedElement !== next.deleteSelectedElement) return false;
    if (prev.setEditingTextId !== next.setEditingTextId) return false;
    if (prev.setPreviewUrl !== next.setPreviewUrl) return false;
    if (prev.commitTextEdit !== next.commitTextEdit) return false;
    if (prev.getTextWidth !== next.getTextWidth) return false;
    if (prev.setElementsSynced !== next.setElementsSynced) return false;
    if (prev.textEditDraftRef !== next.textEditDraftRef) return false;
    if (prev.pendingSelectAllTextIdRef !== next.pendingSelectAllTextIdRef) {
      return false;
    }
    if (prev.handleUngroupSelected !== next.handleUngroupSelected) return false;

    const elementType = prev.element.type;
    if (elementType === "text" && prev.elements !== next.elements) return false;

    return true;
  },
);

export const WorkspaceCanvasElementsLayer: React.FC<
  WorkspaceCanvasElementsLayerProps
> = ({
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
  modelOptions,
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
}) => {
  const selectedIdSet = useMemo(
    () => new Set(selectedElementIds),
    [selectedElementIds],
  );

  return (
    <>
      {visibleCanvasElements.map((element) => {
        const isSelected =
          selectedElementId === element.id || selectedIdSet.has(element.id);
        const isLocked = Boolean(
          element.isLocked ||
            (element.groupId ? elementById.get(element.groupId)?.isLocked : false),
        );

        return (
          <WorkspaceCanvasElementItem
            key={element.id}
            element={element}
            nodeInteractionMode={nodeInteractionMode}
            isSelected={isSelected}
            isLocked={isLocked}
            activeTool={activeTool}
            isCtrlPressed={isCtrlPressed}
            editingTextId={editingTextId}
            isDraggingElement={isDraggingElement}
            textEditDraftRef={textEditDraftRef}
            pendingSelectAllTextIdRef={pendingSelectAllTextIdRef}
            setElementsSynced={setElementsSynced}
            setEditingTextId={setEditingTextId}
            setPreviewUrl={setPreviewUrl}
            zoom={zoom}
            elements={elements}
            getTextWidth={getTextWidth}
            commitTextEdit={commitTextEdit}
            handleResizeStart={handleResizeStart}
            isExtractingText={isExtractingText}
            getElementDisplayUrl={getElementDisplayUrl}
            getElementSourceUrl={getElementSourceUrl}
            modelOptions={modelOptions}
            aspectRatios={aspectRatios}
            updateSelectedElement={updateSelectedElement}
            setSelectedElementId={setSelectedElementId}
            setSelectedElementIds={setSelectedElementIds}
            handleRefImageUpload={handleRefImageUpload}
            handleGenImage={handleGenImage}
            setEraserMode={setEraserMode}
            isTreeConnectionActive={isTreeConnectionActive}
            handleTreeConnectionStart={handleTreeConnectionStart}
            handleTreeConnectionComplete={handleTreeConnectionComplete}
          handleElementMouseDown={handleElementMouseDown}
          handleUngroupSelected={handleUngroupSelected}
          deleteSelectedElement={deleteSelectedElement}
          />
        );
      })}
    </>
  );
};
