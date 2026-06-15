import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { CanvasElement, ChatMessage } from "../../../types";
import { WorkspaceFocusedGroupBanner } from "./WorkspaceFocusedGroupBanner";
import { WorkspaceGeneratedFilesPanel } from "./WorkspaceGeneratedFilesPanel";
import { WorkspaceLayersPanel } from "./WorkspaceLayersPanel";

type WorkspaceLeftPanelMode = "layers" | "files" | "workflow-recipes" | null;

type WorkspaceLeftPanelProps = {
  leftPanelMode: WorkspaceLeftPanelMode;
  onClose: () => void;
  elements: CanvasElement[];
  rootElements: CanvasElement[];
  elementById: Map<string, CanvasElement>;
  selectedElementId: string | null;
  selectedElementIds: string[];
  isHistoryExpanded: boolean;
  setIsHistoryExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  onSelect: (event: React.MouseEvent, id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleHide: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onEnterGroup: (id: string) => void;
  messages: ChatMessage[];
  onPreviewImage: (url: string) => void;
  focusedGroupId: string | null;
  onExitFocusedGroup: () => void;
  workflowRecipesPanel?: React.ReactNode;
};

const PANEL_TITLE = {
  layers: "\u56fe\u5c42",
  files: "\u5df2\u751f\u6210\u6587\u4ef6\u5217\u8868",
  workflowRecipes: "Workflow Recipe",
} as const;

export const WorkspaceLeftPanel: React.FC<WorkspaceLeftPanelProps> = ({
  leftPanelMode,
  onClose,
  elements,
  rootElements,
  elementById,
  selectedElementId,
  selectedElementIds,
  isHistoryExpanded,
  setIsHistoryExpanded,
  onSelect,
  onToggleLock,
  onToggleHide,
  onToggleCollapse,
  onEnterGroup,
  messages,
  onPreviewImage,
  focusedGroupId,
  onExitFocusedGroup,
  workflowRecipesPanel,
}) => {
  return (
    <AnimatePresence>
      {leftPanelMode && (
        <motion.div
          initial={{ opacity: 0, x: -280 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -280 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={[
            "absolute z-50 flex flex-col bg-white/98 shadow-[4px_0_24px_rgba(0,0,0,0.04)] backdrop-blur-xl",
            leftPanelMode === "workflow-recipes"
              ? "top-16 left-5 right-5 bottom-5 overflow-hidden rounded-[24px] border border-gray-200 shadow-[0_24px_64px_rgba(15,23,42,0.16)]"
              : "top-0 left-0 bottom-0 w-[220px] border-r border-gray-200/60",
          ].join(" ")}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3.5">
            <span className="text-sm font-semibold text-gray-900">
              {leftPanelMode === "layers"
                ? PANEL_TITLE.layers
                : leftPanelMode === "files"
                  ? PANEL_TITLE.files
                  : PANEL_TITLE.workflowRecipes}
            </span>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {leftPanelMode === "layers" ? (
              <WorkspaceLayersPanel
                elements={elements}
                rootElements={rootElements}
                elementById={elementById}
                selectedElementId={selectedElementId}
                selectedElementIds={selectedElementIds}
                isHistoryExpanded={isHistoryExpanded}
                setIsHistoryExpanded={setIsHistoryExpanded}
                onSelect={onSelect}
                onToggleLock={onToggleLock}
                onToggleHide={onToggleHide}
                onToggleCollapse={onToggleCollapse}
                onEnterGroup={onEnterGroup}
              />
            ) : leftPanelMode === "files" ? (
              <WorkspaceGeneratedFilesPanel
                messages={messages}
                onPreviewImage={onPreviewImage}
              />
            ) : (
              workflowRecipesPanel || (
                <div className="p-4 text-sm text-gray-500">
                  Workflow recipe 面板骨架尚未接入运行时数据。
                </div>
              )
            )}

            {leftPanelMode !== "workflow-recipes" ? (
              <WorkspaceFocusedGroupBanner
                focusedGroupId={focusedGroupId}
                elements={elements}
                onExit={onExitFocusedGroup}
              />
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
