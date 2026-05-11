import React from 'react';
import { CirclePlus, Clock, MessageSquare, Search, X } from 'lucide-react';
import type { ConversationSession } from '../../../types';

type AssistantSidebarHistoryPanelProps = {
  title?: string;
  historySearch: string;
  setHistorySearch: React.Dispatch<React.SetStateAction<string>>;
  conversations: ConversationSession[];
  activeConversationId: string;
  onCreateConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
};

const formatConversationTime = (updatedAt: number) =>
  new Date(updatedAt).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const AssistantSidebarHistoryPanel: React.FC<AssistantSidebarHistoryPanelProps> = ({
  title = '话题',
  historySearch,
  setHistorySearch,
  conversations,
  activeConversationId,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation,
}) => {
  const filteredConversations = React.useMemo(
    () =>
      conversations
        .filter((conversation) => {
          const normalizedSearch = historySearch.trim().toLowerCase();
          if (!normalizedSearch) return true;
          return conversation.title.toLowerCase().includes(normalizedSearch);
        })
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations, historySearch],
  );

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white/92 backdrop-blur-sm">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-2 text-slate-900">
          <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <Clock size={15} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-5">{title}</div>
            <div className="text-[12px] leading-5 text-slate-500">切换历史话题或开始一轮新的主任务</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onCreateConversation}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-[13px] font-semibold text-white transition hover:bg-slate-800"
        >
          <CirclePlus size={15} strokeWidth={1.8} />
          <span>新建话题</span>
        </button>

        <div className="relative mt-3">
          <Search
            size={14}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
            placeholder="搜索话题标题"
            className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {filteredConversations.length > 0 ? (
          <div className="space-y-2">
            {filteredConversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelectConversation(conversation.id)}
                  className={`group flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    isActive
                      ? 'border-blue-200 bg-blue-50/90 shadow-sm'
                      : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50/90'
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${
                      isActive ? 'bg-white text-blue-600' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <MessageSquare size={14} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate text-[13px] font-semibold ${
                        isActive ? 'text-slate-900' : 'text-slate-700'
                      }`}
                      title={conversation.title}
                    >
                      {conversation.title}
                    </div>
                    <div className="mt-1 text-[11px] leading-5 text-slate-400">
                      {formatConversationTime(conversation.updatedAt)}
                    </div>
                  </div>
                  <span
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteConversation(conversation.id);
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-white hover:text-red-400"
                    aria-label={`删除${conversation.title}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        onDeleteConversation(conversation.id);
                      }
                    }}
                  >
                    <X size={13} strokeWidth={2} />
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-white text-slate-400 shadow-sm">
              <MessageSquare size={18} strokeWidth={1.8} />
            </div>
            <div className="mt-4 text-[14px] font-semibold text-slate-700">
              {conversations.length === 0 ? '还没有历史话题' : '没有匹配的话题'}
            </div>
            <div className="mt-2 max-w-[220px] text-[12px] leading-5 text-slate-500">
              {conversations.length === 0
                ? '新建一个话题后，后续就可以在这里随时切换回来。'
                : '换个关键词试试，或者直接新建一个新的话题。'}
            </div>
            <button
              type="button"
              onClick={onCreateConversation}
              className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <CirclePlus size={14} strokeWidth={1.8} />
              <span>新建话题</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
