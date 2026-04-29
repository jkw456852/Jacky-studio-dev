import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { CanvasElement, ChatMessage } from "../../../types";
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
  messages: ChatMessage[];
  onPreviewImage: (url: string) => void;
  focusedGroupId: string | null;
  onExitFocusedGroup: () => void;
};

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
}) => {
  return (
    <AnimatePresence>
      {leftPanelMode && (
        <motion.div
          initial={{ opacity: 0, x: -280 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -280 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute top-0 left-0 bottom-0 w-[220px] bg-white/98 backdrop-blur-xl border-r border-gray-200/60 z-50 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.04)]"
        >
          <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-100 shrink-0">
            <span className="font-semibold text-sm text-gray-900">
              {leftPanelMode === "layers" ? "图层" : "已生成文件列表"}
            </span>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition"
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
                messages={messages}
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
      )}
    </AnimatePresence>
  );
};
