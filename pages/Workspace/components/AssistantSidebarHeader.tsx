import React from 'react';
import { CirclePlus, PanelRightClose, Share2 } from 'lucide-react';
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
}) => {
    return (
        <div className="px-3 py-2.5 flex items-center justify-between border-b border-gray-100 z-20 shrink-0 select-none">
            <span className="text-sm font-semibold text-gray-900 pl-1">{title}</span>
            <div className="flex items-center gap-0.5">
                <button
                    className="h-7 px-2.5 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 flex items-center justify-center rounded-lg transition-all"
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

                <button className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all" title="Share">
                    <Share2 size={15} strokeWidth={1.5} />
                </button>

                <AssistantSidebarFilesPopover
                    open={filesOpen}
                    messages={messages}
                    onPreview={onPreview}
                    onToggle={onToggleFiles}
                />

                <div className="w-px h-3.5 bg-gray-200 mx-1 opacity-50"></div>

                <button
                    onClick={onClose}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                    title="Collapse"
                >
                    <PanelRightClose size={15} strokeWidth={1.5} />
                </button>
            </div>
        </div>
    );
};
