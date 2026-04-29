import React from 'react';
import { CirclePlus, Clock, MessageSquare, Search, X } from 'lucide-react';
import type { ConversationSession } from '../../../types';

type AssistantSidebarHistoryPopoverProps = {
    open: boolean;
    historySearch: string;
    setHistorySearch: React.Dispatch<React.SetStateAction<string>>;
    conversations: ConversationSession[];
    activeConversationId: string;
    onToggle: () => void;
    onCreateConversation: () => void;
    onSelectConversation: (conversationId: string) => void;
    onDeleteConversation: (conversationId: string) => void;
};

export const AssistantSidebarHistoryPopover: React.FC<AssistantSidebarHistoryPopoverProps> = ({
    open,
    historySearch,
    setHistorySearch,
    conversations,
    activeConversationId,
    onToggle,
    onCreateConversation,
    onSelectConversation,
    onDeleteConversation,
}) => {
    const filteredConversations = conversations
        .filter(conversation =>
            !historySearch || conversation.title.toLowerCase().includes(historySearch.toLowerCase()),
        )
        .sort((a, b) => b.updatedAt - a.updatedAt);

    return (
        <div className="relative">
            <button
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                onClick={(event) => {
                    event.stopPropagation();
                    onToggle();
                }}
            >
                <Clock size={15} strokeWidth={1.8} />
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-[60] animate-in fade-in zoom-in-95 duration-200 text-left">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="font-medium text-sm text-gray-900">历史对话</h3>
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="搜索对话..."
                                value={historySearch}
                                onChange={(event) => setHistorySearch(event.target.value)}
                                className="w-32 h-7 pl-7 pr-2 text-xs bg-gray-50 border border-transparent rounded-md focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400"
                            />
                        </div>
                    </div>

                    <button
                        className="w-full flex items-center justify-center h-8 text-xs mb-3 border border-dashed rounded-md hover:bg-gray-50 transition-colors"
                        onClick={onCreateConversation}
                    >
                        <CirclePlus size={14} strokeWidth={1.5} className="mr-1" />
                        新对话
                    </button>

                    <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1 -mr-1 custom-scrollbar">
                        {filteredConversations.map(conversation => (
                            <div
                                key={conversation.id}
                                className={`p-2 rounded-lg cursor-pointer transition flex items-center gap-2 ${activeConversationId === conversation.id ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50'}`}
                                onClick={() => onSelectConversation(conversation.id)}
                            >
                                <MessageSquare size={13} className="text-gray-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-gray-700 truncate">{conversation.title}</div>
                                    <div className="text-[10px] text-gray-400 mt-0.5">
                                        {new Date(conversation.updatedAt).toLocaleDateString('zh-CN', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </div>
                                </div>
                                <button
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onDeleteConversation(conversation.id);
                                    }}
                                    className="text-gray-300 hover:text-red-400 transition flex-shrink-0"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                        {conversations.length === 0 && (
                            <div className="text-center text-xs text-gray-400 py-6">暂无历史对话</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
