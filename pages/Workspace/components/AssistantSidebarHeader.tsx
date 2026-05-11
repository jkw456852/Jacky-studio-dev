import React from 'react';
import { CirclePlus, Maximize2, Minimize2, PanelRightClose, Share2 } from 'lucide-react';
import type { ChatMessage, ConversationSession } from '../../../types';
import { AssistantSidebarFilesPopover } from './AssistantSidebarFilesPopover';
import { AssistantSidebarHistoryPopover } from './AssistantSidebarHistoryPopover';

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
  return (
    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 shrink-0 select-none">
      <div className="min-w-0 pr-3">
        <div className="truncate text-sm font-semibold text-gray-900">{title}</div>
        {isFullscreen ? (
          <div className="mt-0.5 text-[11px] text-gray-500">沉浸式聊天工作区</div>
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
              新对话
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

        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
          title="Share"
        >
          <Share2 size={15} strokeWidth={1.5} />
        </button>

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
            title={isFullscreen ? '退出全屏' : '进入全屏'}
            aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
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
          title="Collapse"
        >
          <PanelRightClose size={15} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};
