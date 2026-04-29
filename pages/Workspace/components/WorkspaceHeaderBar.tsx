import React from "react";
import { ChevronDown, GitBranch, LayoutTemplate, MessageSquare } from "lucide-react";
import type { WorkspaceNodeInteractionMode } from "../../../types";

type WorkspaceHeaderBarProps = {
  showAssistant: boolean;
  projectTitle: string;
  setProjectTitle: React.Dispatch<React.SetStateAction<string>>;
  nodeInteractionMode: WorkspaceNodeInteractionMode;
  setNodeInteractionMode: React.Dispatch<React.SetStateAction<WorkspaceNodeInteractionMode>>;
  onOpenDashboard: () => void;
  onShowAssistant: () => void;
};

const NODE_INTERACTION_MODE_META: Record<
  WorkspaceNodeInteractionMode,
  { label: string; shortLabel: string; icon: typeof LayoutTemplate }
> = {
  classic: {
    label: "原始模式",
    shortLabel: "原始",
    icon: LayoutTemplate,
  },
  branch: {
    label: "树状模式",
    shortLabel: "树状",
    icon: GitBranch,
  },
};

export const WorkspaceHeaderBar: React.FC<WorkspaceHeaderBarProps> = ({
  showAssistant,
  projectTitle,
  setProjectTitle,
  nodeInteractionMode,
  setNodeInteractionMode,
  onOpenDashboard,
  onShowAssistant,
}) => {
  const currentModeMeta = NODE_INTERACTION_MODE_META[nodeInteractionMode];
  const CurrentModeIcon = currentModeMeta.icon;

  return (
    <div
      className="absolute top-4 left-5 right-5 flex justify-between items-center z-30 pointer-events-none transition-all duration-300"
      style={{ paddingRight: showAssistant ? "500px" : "0" }}
    >
      <div className="flex items-center gap-3 pointer-events-auto">
        <button
          onClick={onOpenDashboard}
          className="w-9 h-9 bg-black rounded-full flex items-center justify-center text-white font-bold text-[10px] tracking-wide shadow-sm hover:scale-105 transition"
        >
          JK
        </button>
        <div className="flex items-center gap-2 rounded-full bg-white/50 px-2.5 py-1 backdrop-blur-sm transition hover:bg-white/65">
          <input
            className="font-medium text-sm text-gray-900 bg-transparent border-none focus:outline-none w-20 focus:w-40 transition-all"
            value={projectTitle}
            onChange={(event) => setProjectTitle(event.target.value)}
          />
          <ChevronDown size={12} className="text-gray-400" />
        </div>
        <div className="relative group/mode">
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-full border border-gray-200/80 bg-white/80 px-3 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur-sm transition hover:border-gray-300 hover:bg-white"
            title="选择节点交互模式"
          >
            <CurrentModeIcon size={14} className="text-gray-500" />
            <span>{currentModeMeta.shortLabel}</span>
            <ChevronDown size={12} className="text-gray-400" />
          </button>
          <div className="pointer-events-none absolute left-0 top-full z-40 hidden min-w-[180px] pt-2 group-hover/mode:block group-hover/mode:pointer-events-auto">
            <div className="rounded-2xl border border-gray-100 bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
              {(Object.entries(NODE_INTERACTION_MODE_META) as Array<
                [WorkspaceNodeInteractionMode, typeof currentModeMeta]
              >).map(([mode, meta]) => {
                const Icon = meta.icon;
                const active = mode === nodeInteractionMode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setNodeInteractionMode(mode)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      active
                        ? "bg-gray-900 text-white"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon
                      size={15}
                      className={active ? "text-white/90" : "text-gray-400"}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold">{meta.label}</div>
                      <div
                        className={`text-[11px] ${
                          active ? "text-white/65" : "text-gray-400"
                        }`}
                      >
                        {mode === "branch"
                          ? "新节点走树状分支交互"
                          : "新节点保持当前经典交互"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        {!showAssistant && (
          <button
            onClick={onShowAssistant}
            className="h-8 px-3.5 bg-gray-100/90 backdrop-blur-sm rounded-full flex items-center gap-1.5 text-gray-700 hover:text-gray-900 hover:bg-gray-200/90 transition text-xs font-medium border border-transparent shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          >
            <MessageSquare
              size={13}
              className="text-gray-500 fill-gray-500"
            />
            对话
          </button>
        )}
      </div>
    </div>
  );
};
