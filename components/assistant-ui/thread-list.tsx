"use client";

import React, {
  forwardRef,
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type FC,
  type KeyboardEvent,
} from "react";
import {
  ArchiveIcon,
  CheckIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  TrashIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import {
  AuiIf,
  ThreadListItemMorePrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const THREAD_LIST_COPY = {
  archived: "已归档",
  archive: "归档",
  cancelRename: "取消重命名",
  delete: "删除",
  emptySearchHint:
    "试试其他关键词，或新建一个话题。",
  emptySearchTitle: "没有匹配的话题",
  earlier: "更早",
  loadMore: "加载更多",
  loadingThreads: "正在加载话题",
  moreOptions: "更多操作",
  newThread: "新建对话",
  pinned: "置顶",
  pinThread: "置顶",
  rename: "重命名",
  renameThread: "重命名对话",
  saveThreadTitle: "保存对话名称",
  searchPlaceholder: "搜索历史话题",
  threadFallback: "新对话",
  today: "今天",
  unarchive: "取消归档",
  unpinThread: "取消置顶",
  yesterday: "昨天",
};

const normalizeThreadListSearchQuery = (value: string): string =>
  String(value || "").trim().toLowerCase();

const getSearchableThreadTitle = (
  thread: { title?: string | null } | undefined,
): string => {
  const normalized = String(thread?.title || "").trim();
  return normalized || THREAD_LIST_COPY.threadFallback;
};

const threadMatchesQuery = (
  thread: { title?: string | null } | undefined,
  normalizedQuery: string,
): boolean => {
  if (!normalizedQuery) return true;
  return getSearchableThreadTitle(thread).toLowerCase().includes(normalizedQuery);
};

type ThreadListSearchContextValue = {
  rawQuery: string;
  normalizedQuery: string;
  setRawQuery: (value: string) => void;
};

const ThreadListSearchContext =
  React.createContext<ThreadListSearchContextValue | null>(null);

const useThreadListSearch = () => {
  const value = React.useContext(ThreadListSearchContext);
  if (!value) {
    throw new Error("Thread list search context is unavailable.");
  }
  return value;
};

export const ThreadList: FC = () => {
  const [rawQuery, setRawQuery] = useState("");
  const normalizedQuery = useMemo(
    () => normalizeThreadListSearchQuery(rawQuery),
    [rawQuery],
  );
  const threadIds = useAuiState((state) => state.threads.threadIds);
  const archivedThreadIds = useAuiState((state) => state.threads.archivedThreadIds);
  const threadItems = useAuiState((state) => state.threads.threadItems);
  const hasSearchMatches = useMemo(() => {
    if (!normalizedQuery) return true;
    const itemsById = new Map(threadItems.map((item) => [item.id, item]));
    return [...threadIds, ...archivedThreadIds].some((id) =>
      threadMatchesQuery(itemsById.get(id), normalizedQuery),
    );
  }, [archivedThreadIds, normalizedQuery, threadIds, threadItems]);

  return (
    <ThreadListSearchContext.Provider
      value={{ rawQuery, normalizedQuery, setRawQuery }}
    >
      <ThreadListRoot>
        <ThreadListNew />
        <ThreadListSearch />
        {hasSearchMatches ? (
          <>
            <ThreadListItems />
            <ThreadListLoadMore />
            <ThreadListArchivedItems />
          </>
        ) : (
          <ThreadListSearchEmptyState />
        )}
      </ThreadListRoot>
    </ThreadListSearchContext.Provider>
  );
};

const ThreadListSearch: FC = () => {
  const { rawQuery, setRawQuery } = useThreadListSearch();

  return (
    <div className="px-2.5 py-2">
      <Input
        value={rawQuery}
        onChange={(event) => setRawQuery(event.target.value)}
        placeholder={THREAD_LIST_COPY.searchPlaceholder}
        aria-label={THREAD_LIST_COPY.searchPlaceholder}
        className="h-8 rounded-lg border-slate-200 bg-white px-2.5 text-sm shadow-none"
      />
    </div>
  );
};

const ThreadListSearchEmptyState: FC = () => {
  return (
    <div className="px-2.5 py-6">
      <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-3 py-4 text-center">
        <div className="text-sm font-medium text-slate-800">
          {THREAD_LIST_COPY.emptySearchTitle}
        </div>
        <div className="mt-1 text-xs leading-5 text-slate-500">
          {THREAD_LIST_COPY.emptySearchHint}
        </div>
      </div>
    </div>
  );
};

export const ThreadListRoot: FC<
  ComponentPropsWithoutRef<typeof ThreadListPrimitive.Root>
> = ({ className, ...props }) => {
  return (
    <ThreadListPrimitive.Root
      data-slot="aui_thread-list-root"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    />
  );
};

export const ThreadListItems: FC<ComponentPropsWithoutRef<"div">> = ({
  className,
  ...props
}) => {
  return (
    <div
      data-slot="aui_thread-list-items"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    >
      <AuiIf condition={(state) => state.threads.isLoading}>
        <ThreadListSkeleton />
      </AuiIf>
      <AuiIf condition={(state) => !state.threads.isLoading}>
        <ThreadListItemGroups />
      </AuiIf>
    </div>
  );
};

const ThreadListArchivedItems: FC = () => {
  const archivedThreadIds = useAuiState((state) => state.threads.archivedThreadIds);
  const threadItems = useAuiState((state) => state.threads.threadItems);
  const { normalizedQuery } = useThreadListSearch();
  const filteredArchivedIndices = useMemo(() => {
    if (!normalizedQuery) {
      return archivedThreadIds.map((_, index) => index);
    }
    const itemsById = new Map(threadItems.map((item) => [item.id, item]));
    return archivedThreadIds.flatMap((id, index) =>
      threadMatchesQuery(itemsById.get(id), normalizedQuery) ? [index] : [],
    );
  }, [archivedThreadIds, normalizedQuery, threadItems]);

  if (filteredArchivedIndices.length === 0) return null;

  return (
    <div
      data-slot="aui_thread-list-archived"
      className="mt-4 flex flex-col gap-0.5"
    >
      <div
        data-slot="aui_thread-list-archived-label"
        className="text-muted-foreground px-2.5 pb-1 text-xs font-medium"
      >
        {THREAD_LIST_COPY.archived}
      </div>
      {filteredArchivedIndices.map((index) => (
        <ThreadListPrimitive.ItemByIndex
          key={archivedThreadIds[index]}
          index={index}
          archived
          components={{ ThreadListItem }}
        />
      ))}
    </div>
  );
};

const ThreadListLoadMore: FC = () => {
  const hasMore = useAuiState((state) => state.threads.hasMore);
  const isLoading = useAuiState((state) => state.threads.isLoading);
  const isLoadingMore = useAuiState((state) => state.threads.isLoadingMore);
  const { normalizedQuery } = useThreadListSearch();

  if (!hasMore || normalizedQuery) return null;

  return (
    <ThreadListPrimitive.LoadMore
      className="hover:bg-muted mt-1 h-8 justify-start rounded-md px-2.5 text-sm font-medium disabled:opacity-50"
      disabled={isLoading || isLoadingMore}
    >
      {THREAD_LIST_COPY.loadMore}
    </ThreadListPrimitive.LoadMore>
  );
};

const DAY_IN_MS = 86_400_000;

type ThreadListItemCustomMetadata = {
  pinned?: boolean;
};

const dateGroupLabel = (date: Date | undefined, startOfToday: number): string => {
  if (!date || date.getTime() >= startOfToday) return THREAD_LIST_COPY.today;
  if (date.getTime() >= startOfToday - DAY_IN_MS) {
    return THREAD_LIST_COPY.yesterday;
  }
  return THREAD_LIST_COPY.earlier;
};

type ThreadListGroup = { label?: string; indices: number[] };

const ThreadListItemGroups: FC = () => {
  const threadIds = useAuiState((state) => state.threads.threadIds);
  const threadItems = useAuiState((state) => state.threads.threadItems);
  const { normalizedQuery } = useThreadListSearch();

  const groups = useMemo<ThreadListGroup[]>(() => {
    const itemsById = new Map(threadItems.map((item) => [item.id, item]));
    const allIndices = threadIds
      .map((_, index) => index)
      .filter((index) =>
        threadMatchesQuery(itemsById.get(threadIds[index]), normalizedQuery),
      );
    if (allIndices.length === 0) return [];

    const isPinned = (index: number) =>
      (itemsById.get(threadIds[index])?.custom as ThreadListItemCustomMetadata | undefined)
        ?.pinned === true;
    const dates = threadIds.map((id) => itemsById.get(id)?.lastMessageAt);
    const hasAnyDates = dates.some(Boolean);
    const pinnedIndices = allIndices.filter((index) => isPinned(index));
    const regularIndices = allIndices.filter((index) => !isPinned(index));

    if (!hasAnyDates) {
      return [
        ...(pinnedIndices.length > 0
          ? [{ label: THREAD_LIST_COPY.pinned, indices: pinnedIndices }]
          : []),
        ...(regularIndices.length > 0 ? [{ indices: regularIndices }] : []),
      ];
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const time = (index: number) =>
      dates[index]?.getTime() ?? Number.MIN_SAFE_INTEGER;
    const sortedPinnedIndices = [...pinnedIndices].sort(
      (a, b) => time(b) - time(a),
    );
    const sortedRegularIndices = [...regularIndices].sort(
      (a, b) => time(b) - time(a),
    );

    const result: ThreadListGroup[] = [];

    if (sortedPinnedIndices.length > 0) {
      result.push({
        label: THREAD_LIST_COPY.pinned,
        indices: sortedPinnedIndices,
      });
    }

    for (const index of sortedRegularIndices) {
      const label = dateGroupLabel(dates[index], startOfToday);
      const lastGroup = result[result.length - 1];
      if (lastGroup?.label === label) {
        lastGroup.indices.push(index);
      } else {
        result.push({ label, indices: [index] });
      }
    }

    return result;
  }, [normalizedQuery, threadIds, threadItems]);

  if (groups.length === 0) {
    return null;
  }

  return groups.map((group) => {
    const firstThreadId = threadIds[group.indices[0] ?? -1];
    const groupKey = [
      group.label ?? "ungrouped",
      firstThreadId ?? `index-${group.indices[0] ?? 0}`,
    ].join(":");

    return (
      <Fragment key={groupKey}>
        {group.label ? (
          <div
            data-slot="aui_thread-list-group-label"
            className="text-muted-foreground px-2.5 pt-3 pb-1 text-xs font-medium"
          >
            {group.label}
          </div>
        ) : null}
        {group.indices.map((index) => (
          <ThreadListPrimitive.ItemByIndex
            key={threadIds[index]}
            index={index}
            components={{ ThreadListItem }}
          />
        ))}
      </Fragment>
    );
  });
};

export const ThreadListNew = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof Button> & { labelClassName?: string }
>(({ className, labelClassName, children, ...props }, ref) => {
  return (
    <ThreadListPrimitive.New asChild>
      <Button
        ref={ref}
        variant="ghost"
        data-slot="aui_thread-list-new"
        className={cn(
          "hover:bg-muted data-active:bg-muted h-8 justify-start gap-2 rounded-md px-2.5 text-sm font-normal",
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <PlusIcon
              data-slot="aui_thread-list-new-icon"
              className="size-4 shrink-0"
            />
            <span
              data-slot="aui_thread-list-new-label"
              className={cn("whitespace-nowrap", labelClassName)}
            >
              {THREAD_LIST_COPY.newThread}
            </span>
          </>
        )}
      </Button>
    </ThreadListPrimitive.New>
  );
});

ThreadListNew.displayName = "ThreadListNew";

const ThreadListSkeleton: FC = () => {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          role="status"
          aria-label={THREAD_LIST_COPY.loadingThreads}
          data-slot="aui_thread-list-skeleton-wrapper"
          className="flex h-8 items-center px-2.5"
        >
          <Skeleton data-slot="aui_thread-list-skeleton" className="h-3.5 w-full" />
        </div>
      ))}
    </div>
  );
};

export const ThreadListItem: FC<{ archived?: boolean }> = ({ archived = false }) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const currentTitle = useAuiState((state) => state.threadListItem.title || "");
  const isPinned = useAuiState(
    (state) =>
      (state.threadListItem.custom as ThreadListItemCustomMetadata | undefined)?.pinned ===
      true,
  );

  useEffect(() => {
    if (!isRenaming) {
      setDraftTitle(currentTitle);
    }
  }, [currentTitle, isRenaming]);

  return (
    <ThreadListItemPrimitive.Root
      data-slot="aui_thread-list-item"
      className="group hover:bg-muted focus-visible:bg-muted data-active:bg-muted has-focus-visible:bg-muted has-data-[state=open]:bg-muted relative flex h-8 items-center rounded-md transition-colors focus-visible:outline-none"
    >
      {isRenaming ? (
        <ThreadListItemRenameForm
          archived={archived}
          draftTitle={draftTitle}
          setDraftTitle={setDraftTitle}
          onCancel={() => {
            setDraftTitle(currentTitle);
            setIsRenaming(false);
          }}
          onComplete={() => {
            setIsRenaming(false);
          }}
        />
      ) : (
        <>
          <ThreadListItemPrimitive.Trigger
            data-slot="aui_thread-list-item-trigger"
            className="focus-visible:ring-ring/50 flex h-full min-w-0 flex-1 items-center rounded-md px-2.5 text-start text-sm outline-none group-hover:pe-9 group-has-focus-visible:pe-9 group-has-data-[state=open]:pe-9 group-data-active:pe-9 focus-visible:ring-[3px]"
          >
            <span data-slot="aui_thread-list-item-title" className="min-w-0 flex-1 truncate">
              <ThreadListItemPrimitive.Title fallback={THREAD_LIST_COPY.threadFallback} />
            </span>
            {!archived && isPinned ? (
              <PinIcon className="text-muted-foreground ms-1.5 size-3.5 shrink-0" />
            ) : null}
          </ThreadListItemPrimitive.Trigger>
          <ThreadListItemMore
            archived={archived}
            onRename={() => {
              setDraftTitle(currentTitle);
              setIsRenaming(true);
            }}
          />
        </>
      )}
    </ThreadListItemPrimitive.Root>
  );
};

const ThreadListItemRenameForm: FC<{
  archived: boolean;
  draftTitle: string;
  setDraftTitle: (value: string) => void;
  onCancel: () => void;
  onComplete: () => void;
}> = ({
  archived,
  draftTitle,
  setDraftTitle,
  onCancel,
  onComplete,
}) => {
  const aui = useAui();
  const currentTitle = useAuiState((state) => state.threadListItem.title || "");
  const [isSaving, setIsSaving] = useState(false);

  const submitRename = async () => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle || nextTitle === currentTitle.trim()) {
      onComplete();
      return;
    }

    setIsSaving(true);
    try {
      await aui.threadListItem().rename(nextTitle);
      onComplete();
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitRename();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-1 items-center gap-1 px-1.5">
      <Input
        value={draftTitle}
        autoFocus
        disabled={isSaving}
        onChange={(event) => setDraftTitle(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={THREAD_LIST_COPY.renameThread}
        className="h-7 min-w-0 flex-1 rounded-md border-slate-200 bg-white px-2 text-sm shadow-none"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={isSaving}
        onClick={() => void submitRename()}
        className="size-6 shrink-0 rounded-md"
        aria-label={THREAD_LIST_COPY.saveThreadTitle}
      >
        <CheckIcon className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={isSaving}
        onClick={onCancel}
        className="size-6 shrink-0 rounded-md"
        aria-label={THREAD_LIST_COPY.cancelRename}
      >
        <XIcon className="size-3.5" />
      </Button>
      {!archived ? <ThreadListItemMore archived={archived} compact /> : null}
    </div>
  );
};

const ThreadListItemMore: FC<{
  archived?: boolean;
  compact?: boolean;
  onRename?: () => void;
}> = ({ archived = false, compact = false, onRename }) => {
  const aui = useAui();
  const isPinned = useAuiState(
    (state) =>
      (state.threadListItem.custom as ThreadListItemCustomMetadata | undefined)
        ?.pinned === true,
  );

  return (
    <ThreadListItemMorePrimitive.Root>
      <ThreadListItemMorePrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-slot="aui_thread-list-item-more"
          className={cn(
            "data-[state=open]:bg-accent size-6 p-0",
            compact
              ? "shrink-0 rounded-md"
              : "absolute end-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-has-focus-visible:opacity-100 group-data-active:opacity-100 data-[state=open]:opacity-100",
          )}
        >
          <MoreHorizontalIcon className="size-3.5" />
          <span className="sr-only">{THREAD_LIST_COPY.moreOptions}</span>
        </Button>
      </ThreadListItemMorePrimitive.Trigger>
      <ThreadListItemMorePrimitive.Content
        side="right"
        align="start"
        sideOffset={6}
        data-slot="aui_thread-list-item-more-content"
        className="bg-popover/95 text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-32 overflow-hidden rounded-xl border p-1.5 shadow-lg backdrop-blur-sm"
      >
        {onRename ? (
          <ThreadListItemMorePrimitive.Item
            data-slot="aui_thread-list-item-more-item"
            className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
            onSelect={(event) => {
              event.preventDefault();
              onRename();
            }}
          >
            <PencilIcon className="size-4" />
            {THREAD_LIST_COPY.rename}
          </ThreadListItemMorePrimitive.Item>
        ) : null}
        {!archived ? (
          <ThreadListItemMorePrimitive.Item
            data-slot="aui_thread-list-item-more-item"
            className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
            onSelect={(event) => {
              event.preventDefault();
              const threadCustom =
                (aui.threadListItem().getState()
                  .custom as ThreadListItemCustomMetadata | undefined) || {};
              void aui.threadListItem().updateCustom({
                ...threadCustom,
                pinned: !isPinned,
              });
            }}
          >
            {isPinned ? (
              <PinOffIcon className="size-4" />
            ) : (
              <PinIcon className="size-4" />
            )}
            {isPinned ? THREAD_LIST_COPY.unpinThread : THREAD_LIST_COPY.pinThread}
          </ThreadListItemMorePrimitive.Item>
        ) : null}
        {archived ? (
          <ThreadListItemPrimitive.Unarchive asChild>
            <ThreadListItemMorePrimitive.Item
              data-slot="aui_thread-list-item-more-item"
              className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
            >
              <Undo2Icon className="size-4" />
              {THREAD_LIST_COPY.unarchive}
            </ThreadListItemMorePrimitive.Item>
          </ThreadListItemPrimitive.Unarchive>
        ) : (
          <ThreadListItemPrimitive.Archive asChild>
            <ThreadListItemMorePrimitive.Item
              data-slot="aui_thread-list-item-more-item"
              className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
            >
              <ArchiveIcon className="size-4" />
              {THREAD_LIST_COPY.archive}
            </ThreadListItemMorePrimitive.Item>
          </ThreadListItemPrimitive.Archive>
        )}
        <ThreadListItemPrimitive.Delete asChild>
          <ThreadListItemMorePrimitive.Item
            data-slot="aui_thread-list-item-more-item"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
          >
            <TrashIcon className="size-4" />
            {THREAD_LIST_COPY.delete}
          </ThreadListItemMorePrimitive.Item>
        </ThreadListItemPrimitive.Delete>
      </ThreadListItemMorePrimitive.Content>
    </ThreadListItemMorePrimitive.Root>
  );
};
