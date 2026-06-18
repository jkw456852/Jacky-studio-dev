import React from "react";
import { Archive, MoreHorizontal, Pencil, Pin, X } from "lucide-react";
import { formatConversationTitle } from "./conversationDisplay";

type AssistantSidebarConversationActionsProps = {
  archivedView?: boolean;
  isPinned?: boolean;
  conversationTitle: string;
  compact?: boolean;
  alwaysVisible?: boolean;
  onPin: () => void;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
};

export const AssistantSidebarConversationActions: React.FC<
  AssistantSidebarConversationActionsProps
> = ({
  archivedView = false,
  isPinned = false,
  conversationTitle,
  compact = false,
  alwaysVisible = false,
  onPin,
  onRename,
  onArchive,
  onDelete,
}) => {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const itemClassName = compact
    ? "flex h-7 w-7 items-center justify-center rounded-full bg-white/88 text-slate-300 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.78),0_10px_18px_-16px_rgba(15,23,42,0.12)] transition-all duration-200 hover:bg-white hover:text-slate-800"
    : "flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-300 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.82),0_10px_18px_-16px_rgba(15,23,42,0.12)] transition-all duration-200 hover:bg-white hover:text-slate-700";
  const triggerClassName = `${compact ? itemClassName : `${itemClassName} opacity-100`} ${
    isPinned
      ? "bg-amber-50 text-amber-600 shadow-[inset_0_0_0_1px_rgba(253,230,138,0.95)]"
      : ""
  }`;

  React.useEffect(() => {
    if (!open) return;

    const handleWindowPointerDown = (event: PointerEvent) => {
      const nextTarget = event.target;
      if (
        nextTarget instanceof Node &&
        containerRef.current?.contains(nextTarget)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handleWindowPointerDown);
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handleWindowPointerDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [open]);

  const formattedTitle = formatConversationTitle(conversationTitle);

  return (
    <div
      ref={containerRef}
      className={`relative flex shrink-0 items-center gap-1 transition-opacity duration-200 ${
        alwaysVisible
          ? "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
          : "opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100"
      }`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="relative">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          className={triggerClassName}
          aria-label={`打开对话操作：${formattedTitle}`}
          title="更多操作"
        >
          <MoreHorizontal size={compact ? 11 : 13} strokeWidth={2} />
        </button>

        {open ? (
          <div
            className={`absolute right-0 z-[80] min-w-[168px] rounded-[20px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-1.5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.24)] ${
              compact ? "top-full mt-2" : "bottom-full mb-2"
            }`}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onPin();
              }}
              className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-[12px] font-medium transition ${
                isPinned
                  ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Pin size={12} strokeWidth={2} />
              <span>{isPinned ? "取消置顶" : "置顶对话"}</span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onRename();
              }}
            className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Pencil size={12} strokeWidth={2} />
              <span>重命名</span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onArchive();
              }}
              className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Archive size={12} strokeWidth={2} />
              <span>{archivedView ? "恢复对话" : "归档对话"}</span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-[12px] font-medium text-rose-600 transition hover:bg-rose-50"
            >
              <X size={12} strokeWidth={2} />
              <span>删除对话</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
