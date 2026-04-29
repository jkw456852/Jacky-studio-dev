import React from "react";
import type { CanvasElement, WorkspaceNodeInteractionMode } from "../../../types";
import { WorkspaceCanvasImageElement } from "./WorkspaceCanvasImageElement";
import { WorkspaceCanvasShapeElement } from "./WorkspaceCanvasShapeElement";
import { WorkspaceCanvasTextElement } from "./WorkspaceCanvasTextElement";
import { WorkspaceCanvasVideoElement } from "./WorkspaceCanvasVideoElement";

type ResizeHandle = "nw" | "ne" | "sw" | "se" | "w" | "e" | string;

type WorkspaceCanvasElementContentProps = {
  element: CanvasElement;
  nodeInteractionMode: WorkspaceNodeInteractionMode;
  isSelected: boolean;
  editingTextId: string | null;
  zoom: number;
  elements: CanvasElement[];
  textEditDraftRef: React.MutableRefObject<Record<string, string>>;
  pendingSelectAllTextIdRef: React.MutableRefObject<string | null>;
  setElementsSynced: React.Dispatch<React.SetStateAction<CanvasElement[]>>;
  setEditingTextId: React.Dispatch<React.SetStateAction<string | null>>;
  setPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
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
  onActivateNode: (elementId: string) => void;
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
  deleteSelectedElement: () => void;
};

export const WorkspaceCanvasElementContent: React.FC<
  WorkspaceCanvasElementContentProps
> = ({
  element,
  nodeInteractionMode,
  isSelected,
  editingTextId,
  zoom,
  elements,
  textEditDraftRef,
  pendingSelectAllTextIdRef,
  setElementsSynced,
  setEditingTextId,
  setPreviewUrl,
  getTextWidth,
  commitTextEdit,
  handleResizeStart,
  isExtractingText,
  getElementDisplayUrl,
  modelOptions,
  aspectRatios,
  updateSelectedElement,
  onActivateNode,
  handleRefImageUpload,
  handleGenImage,
  setEraserMode,
  isTreeConnectionActive,
  handleTreeConnectionStart,
  handleTreeConnectionComplete,
  deleteSelectedElement,
}) => (
  <>
    {element.type === "text" && (
      <WorkspaceCanvasTextElement
        element={element}
        isSelected={isSelected}
        isEditing={editingTextId === element.id}
        zoom={zoom}
        elements={elements}
        setElementsSynced={setElementsSynced}
        textEditDraftRef={textEditDraftRef}
        pendingSelectAllTextIdRef={pendingSelectAllTextIdRef}
        setEditingTextId={setEditingTextId}
        getTextWidth={getTextWidth}
        commitTextEdit={commitTextEdit}
        handleResizeStart={handleResizeStart}
      />
    )}
    {element.type === "shape" && (
      <WorkspaceCanvasShapeElement element={element} />
    )}
    {(element.type === "image" || element.type === "gen-image") && (
      <WorkspaceCanvasImageElement
        element={element}
        nodeInteractionMode={nodeInteractionMode}
        isSelected={isSelected}
        zoom={zoom}
        isExtractingText={isExtractingText}
        elements={elements}
        setElementsSynced={setElementsSynced}
        setPreviewUrl={setPreviewUrl}
        getElementDisplayUrl={getElementDisplayUrl}
        modelOptions={modelOptions}
        aspectRatios={aspectRatios}
        updateSelectedElement={updateSelectedElement}
        onActivateNode={onActivateNode}
        handleRefImageUpload={handleRefImageUpload}
        handleGenImage={handleGenImage}
        setEraserMode={setEraserMode}
        isTreeConnectionActive={isTreeConnectionActive}
        handleTreeConnectionStart={handleTreeConnectionStart}
        handleTreeConnectionComplete={handleTreeConnectionComplete}
        deleteSelectedElement={deleteSelectedElement}
        onResizeStart={handleResizeStart}
      />
    )}
    {(element.type === "gen-video" || element.type === "video") && (
      <WorkspaceCanvasVideoElement
        element={element}
        isSelected={isSelected}
        zoom={zoom}
        onResizeStart={handleResizeStart}
      />
    )}
  </>
);
