import React from "react";
import {
  CirclePlus,
  Maximize2,
  Minimize2,
  PanelRightClose,
} from "lucide-react";
import type { ChatMessage, ConversationSession } from "../../../types";
import { AssistantSidebarFilesPopover } from "./AssistantSidebarFilesPopover";
import { AssistantSidebarHistoryPopover } from "./AssistantSidebarHistoryPopover";

type AssistantSidebarHeaderProps = {
  title: string;
  historyOpen: boolean;
  historySearch: string;
  setHistorySearch: React.Dispatch<React.SetStateAction<string>>;
  conversations: ConversationSession[];
  activeConversationId: string;
  filesOpen: boolean;
  messages: ChatMessage[];
  onPreview: (url: string) => void;
  onToggleHistory: () => void;
  onCreateConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onToggleFiles: () => void;
  onClose: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

const FULLSCREEN_LABEL = "\u5f53\u524d\u5bf9\u8bdd";
const NEW_CONVERSATION_LABEL = "\u65b0\u5bf9\u8bdd";
const ENTER_FULLSCREEN_LABEL = "\u8fdb\u5165\u5168\u5c4f";
const EXIT_FULLSCREEN_LABEL = "\u9000\u51fa\u5168\u5c4f";
const COLLAPSE_SIDEBAR_LABEL = "\u6536\u8d77\u4fa7\u680f";

export const AssistantSidebarHeader: React.FC<AssistantSidebarHeaderProps> = ({
  title,
  historyOpen,
  historySearch,
  setHistorySearch,
  conversations,
  activeConversationId,
  filesOpen,
  messages,
  onPreview,
  onToggleHistory,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation,
  onToggleFiles,
  onClose,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const fullscreenToggleLabel = isFullscreen
    ? EXIT_FULLSCREEN_LABEL
    : ENTER_FULLSCREEN_LABEL;

  return (
    <div className="flex shrink-0 select-none items-center justify-between border-b border-gray-100 px-4 py-3">
      <div className="min-w-0 pr-3">
        <div className="truncate text-sm font-semibold text-gray-900">{title}</div>
        {isFullscreen ? (
          <div className="mt-0.5 text-[11px] text-gray-500">
            {FULLSCREEN_LABEL}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        {!isFullscreen ? (
          <>
            <button
              className="flex h-8 items-center justify-center rounded-lg px-2.5 text-xs text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-800"
              onClick={onCreateConversation}
            >
              <CirclePlus size={15} strokeWidth={1.5} className="mr-1" />
              {NEW_CONVERSATION_LABEL}
            </button>

            <AssistantSidebarHistoryPopover
              open={historyOpen}
              historySearch={historySearch}
              setHistorySearch={setHistorySearch}
              conversations={conversations}
              activeConversationId={activeConversationId}
              onToggle={onToggleHistory}
              onCreateConversation={onCreateConversation}
              onSelectConversation={onSelectConversation}
              onDeleteConversation={onDeleteConversation}
            />
          </>
        ) : null}

        <AssistantSidebarFilesPopover
          open={filesOpen}
          messages={messages}
          onPreview={onPreview}
          onToggle={onToggleFiles}
        />

        {onToggleFullscreen ? (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
            title={fullscreenToggleLabel}
            aria-label={fullscreenToggleLabel}
          >
            {isFullscreen ? (
              <Minimize2 size={15} strokeWidth={1.6} />
            ) : (
              <Maximize2 size={15} strokeWidth={1.6} />
            )}
          </button>
        ) : null}

        <div className="mx-1 h-3.5 w-px bg-gray-200 opacity-50"></div>

        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
          title={COLLAPSE_SIDEBAR_LABEL}
          aria-label={COLLAPSE_SIDEBAR_LABEL}
        >
          <PanelRightClose size={15} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};
