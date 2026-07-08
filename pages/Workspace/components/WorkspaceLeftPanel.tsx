import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { CanvasElement, ConversationSession } from "../../../types";
import { WorkspaceFocusedGroupBanner } from "./WorkspaceFocusedGroupBanner";
import { WorkspaceGeneratedFilesPanel } from "./WorkspaceGeneratedFilesPanel";
import { WorkspaceLayersPanel } from "./WorkspaceLayersPanel";

type WorkspaceLeftPanelMode = "layers" | "files" | null;

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
  assistantThread?: ConversationSession["assistantThread"];
  onPreviewImage: (url: string) => void;
  focusedGroupId: string | null;
  onExitFocusedGroup: () => void;
};

const PANEL_TITLE = {
  layers: "Layers",
  files: "Generated Files",
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
  assistantThread,
  onPreviewImage,
  focusedGroupId,
  onExitFocusedGroup,
}) => {
  return (
    <AnimatePresence>
      {leftPanelMode ? (
        <motion.div
          initial={{ opacity: 0, x: -280 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -280 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute left-0 top-0 bottom-0 z-50 flex w-[220px] flex-col border-r border-gray-200/60 bg-white/98 shadow-[4px_0_24px_rgba(0,0,0,0.04)] backdrop-blur-xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3.5">
            <span className="text-sm font-semibold text-gray-900">
              {leftPanelMode === "layers" ? PANEL_TITLE.layers : PANEL_TITLE.files}
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
            ) : (
              <WorkspaceGeneratedFilesPanel
                assistantThread={assistantThread}
                onPreviewImage={onPreviewImage}
              />
            )}

            <WorkspaceFocusedGroupBanner
              focusedGroupId={focusedGroupId}
              elements={elements}
              onExit={onExitFocusedGroup}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
