import React from "react";
import {
  Copy,
  Download,
  File as FileIcon,
  Image as ImageIcon,
  Search,
  Video,
} from "lucide-react";
import type { ChatMessage } from "../../../types";
import { downloadFromUrls, downloadUrlGroupsAsZip } from "../../../utils/download";
import { getGeneratedConversationFiles } from "./generatedFiles";

type AssistantSidebarFilesPopoverProps = {
  open: boolean;
  messages: ChatMessage[];
  onPreview: (url: string) => void;
  onToggle: () => void;
  inlinePanel?: boolean;
  triggerOnly?: boolean;
};

const formatOutputGroupLabel = (time: number) => {
  const target = new Date(time);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  ).getTime();
  const diffDays = Math.round(
    (startOfToday - startOfTarget) / (24 * 60 * 60 * 1000),
  );

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays > 1 && diffDays < 7) return "最近 7 天";

  return target.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
};

export const AssistantSidebarFilesPopover: React.FC<
  AssistantSidebarFilesPopoverProps
> = ({
  open,
  messages,
  onPreview,
  onToggle,
  inlinePanel = false,
  triggerOnly = false,
}) => {
  const files = getGeneratedConversationFiles(messages);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "image" | "video">("all");
  const [sortMode, setSortMode] = React.useState<"latest" | "oldest">("latest");
  const [isDownloadingAll, setIsDownloadingAll] = React.useState(false);
  const [downloadingGroupKey, setDownloadingGroupKey] = React.useState<string | null>(
    null,
  );
  const [copiedSummary, setCopiedSummary] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const normalizedSearch = search.trim().toLowerCase();

  const filteredFiles = React.useMemo(() => {
    const next = files.filter((file) => {
      if (filter !== "all" && file.type !== filter) return false;
      if (!normalizedSearch) return true;
      return [file.title, file.model]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });

    return [...next].sort((left, right) =>
      sortMode === "latest" ? right.time - left.time : left.time - right.time,
    );
  }, [files, filter, normalizedSearch, sortMode]);

  const fileCount = filteredFiles.length;
  const imageCount = files.filter((file) => file.type === "image").length;
  const videoCount = files.filter((file) => file.type === "video").length;
  const hasActiveFilters =
    filter !== "all" || sortMode !== "latest" || normalizedSearch.length > 0;
  const groupedFiles = React.useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; files: typeof filteredFiles }
    >();

    filteredFiles.forEach((file) => {
      const label = formatOutputGroupLabel(file.time);
      const key = `${label}-${new Date(file.time).toDateString()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label,
          files: [],
        });
      }
      groups.get(key)?.files.push(file);
    });

    return Array.from(groups.values());
  }, [filteredFiles]);

  const summaryText = React.useMemo(() => {
    if (filteredFiles.length === 0) {
      return "当前没有可整理的产出。";
    }

    const lines = [
      `当前筛选结果：${filteredFiles.length} 个文件`,
      `类型：${filter === "all" ? "全部" : filter === "image" ? "图片" : "视频"}`,
      `排序：${sortMode === "latest" ? "最新优先" : "最早优先"}`,
    ];
    if (normalizedSearch) {
      lines.push(`关键词：${search.trim()}`);
    }
    lines.push("");
    filteredFiles.forEach((file, index) => {
      lines.push(
        `${index + 1}. ${file.title} · ${file.model} · ${new Date(
          file.time,
        ).toLocaleString("zh-CN")}`,
      );
    });
    return lines.join("\n");
  }, [filter, filteredFiles, normalizedSearch, search, sortMode]);

  const handleDownloadCurrentResults = React.useCallback(async () => {
    if (filteredFiles.length === 0 || isDownloadingAll) return;
    setIsDownloadingAll(true);
    try {
      await downloadUrlGroupsAsZip(
        filteredFiles.map((file, index) => ({
          candidateUrls: [file.url],
          baseFilename: `${String(index + 1).padStart(2, "0")}-${file.title}`,
        })),
        `workspace-results-${filter}-${sortMode}`,
      );
    } finally {
      setIsDownloadingAll(false);
    }
  }, [filter, filteredFiles, isDownloadingAll, sortMode]);

  const handleDownloadGroup = React.useCallback(
    async (
      groupKey: string,
      groupLabel: string,
      items: Array<(typeof filteredFiles)[number]>,
    ) => {
      if (items.length === 0 || downloadingGroupKey) return;
      setDownloadingGroupKey(groupKey);
      try {
        await downloadUrlGroupsAsZip(
          items.map((file, index) => ({
            candidateUrls: [file.url],
            baseFilename: `${String(index + 1).padStart(2, "0")}-${file.title}`,
          })),
          `workspace-results-${groupLabel}`,
        );
      } finally {
        setDownloadingGroupKey(null);
      }
    },
    [downloadingGroupKey],
  );

  const handleCopySummary = React.useCallback(async () => {
    if (!summaryText || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopiedSummary(true);
      window.setTimeout(() => {
        setCopiedSummary(false);
      }, 1600);
    } catch (error) {
      console.warn("[assistant-sidebar] copy output summary failed", error);
    }
  }, [summaryText]);

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (inlinePanel) return;
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) {
        return;
      }
      onToggle();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onToggle();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [inlinePanel, onToggle, open]);

  return (
    <div ref={containerRef} className={inlinePanel ? "contents" : "relative"}>
      {!inlinePanel ? (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
            open
              ? "bg-white text-slate-700 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.95),0_8px_18px_-16px_rgba(15,23,42,0.22)]"
              : "bg-white/66 text-slate-400 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.72)] hover:bg-white hover:text-slate-700"
          }`}
          title="查看产出"
          aria-label="查看产出"
        >
          <FileIcon size={15} strokeWidth={1.6} />
        </button>
      ) : null}

      {open && !triggerOnly ? (
        <div
          data-assistant-inline-panel={inlinePanel ? "files" : undefined}
          className={`overflow-hidden ${
            inlinePanel
              ? "flex h-full flex-col bg-[#f8f9fc]"
              : "absolute right-0 top-full z-[60] mt-2 w-[296px] rounded-[20px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.988),rgba(248,249,252,0.97))] shadow-[0_20px_52px_-36px_rgba(15,23,42,0.24)] backdrop-blur-md"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className={`${
              inlinePanel
                ? "border-b border-slate-200/80 bg-[#f8f9fc] px-4 py-3.5"
                : "border-b border-slate-200/80 px-3 py-2.5"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {!inlinePanel ? (
                  <div>
                    <div className="text-[13px] font-semibold leading-5 text-slate-900">
                      本轮产出
                    </div>
                    <div className="mt-1 text-[10.5px] leading-4 text-slate-500">
                      快速查看当前对话生成的图片、视频和文件
                    </div>
                  </div>
                ) : (
                  <div className="text-[13px] font-medium text-slate-500">
                    本轮结果总览
                  </div>
                )}
              </div>
              <span className="inline-flex shrink-0 items-center rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-medium text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.95)]">
                {fileCount} 个文件
              </span>
            </div>
              <div className="mt-2 space-y-2">
              <div className="relative">
                <Search
                  size={13}
                  strokeWidth={1.8}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索文件名或模型"
                  className="h-9 w-full rounded-full bg-white/88 pl-9 pr-3 text-[12px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white shadow-[inset_0_0_0_1px_rgba(226,232,240,0.95)]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: "all", label: "全部", count: files.length },
                  { key: "image", label: "图片", count: imageCount },
                  { key: "video", label: "视频", count: videoCount },
                ].map((option) => {
                  const isActive = filter === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() =>
                        setFilter(option.key as "all" | "image" | "video")
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.25 text-[10px] font-semibold transition ${
                        isActive
                          ? "bg-slate-900 text-white"
                          : "bg-white/88 text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.92)] hover:bg-white hover:text-slate-800"
                      }`}
                    >
                      <span>{option.label}</span>
                      <span className={isActive ? "text-white/70" : "text-slate-400"}>
                        {option.count}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setSortMode((current) =>
                      current === "latest" ? "oldest" : "latest",
                    )
                  }
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/88 px-2.5 py-1.25 text-[10px] font-semibold text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.92)] transition hover:bg-white hover:text-slate-800"
                >
                  <span>{sortMode === "latest" ? "最新优先" : "最早优先"}</span>
                </button>
              </div>
              {filteredFiles.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleDownloadCurrentResults();
                    }}
                    disabled={isDownloadingAll}
                    className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download size={12} strokeWidth={1.8} />
                    <span>{isDownloadingAll ? "打包中..." : "下载当前结果"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCopySummary();
                    }}
                    className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Copy size={12} strokeWidth={1.8} />
                    <span>{copiedSummary ? "已复制摘要" : "复制摘要"}</span>
                  </button>
                </div>
              ) : null}
              {hasActiveFilters ? (
                <div className="flex items-center justify-between gap-3 rounded-[16px] bg-slate-50 px-3 py-2 text-[10px] text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.75)]">
                  <span>当前筛出 {fileCount} 个结果</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                      setSortMode("latest");
                    }}
                    className="font-semibold text-slate-700 transition hover:text-slate-900"
                  >
                    重置筛选
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {filteredFiles.length === 0 ? (
            <div className="flex h-[240px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
                <ImageIcon size={18} strokeWidth={1.8} />
              </div>
              <div className="mt-4 text-[13px] font-semibold text-slate-800">
                {files.length === 0 ? "还没有可查看的产出" : "没有匹配的产出"}
              </div>
              <div className="mt-2 max-w-[220px] text-[11px] leading-5 text-slate-500">
                {files.length === 0
                  ? "生成图片、视频或文件后，这里会成为你的快速预览入口。"
                  : "换个关键词、类型或排序方式试试。"}
              </div>
              {files.length === 0 ? (
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-medium text-slate-500">
                  <span>建议先生成一张图或一段视频，再回到这里筛选和整理。</span>
                </div>
              ) : null}
              {files.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                    setSortMode("latest");
                  }}
                  className="mt-4 inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  清空筛选
                </button>
              ) : null}
            </div>
          ) : (
            <div
              className={`space-y-2 overflow-y-auto p-2.5 custom-scrollbar ${
                inlinePanel
                  ? "min-h-0 flex-1 bg-[#f8f9fc]"
                  : "max-h-[320px]"
              }`}
            >
              {groupedFiles.map((group) => (
                <section key={group.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {group.label}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                        {group.files.length} 项
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDownloadGroup(group.key, group.label, group.files);
                      }}
                      disabled={downloadingGroupKey === group.key}
                      className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download size={11} strokeWidth={1.8} />
                      <span>
                        {downloadingGroupKey === group.key ? "打包中..." : "下载这组"}
                      </span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {group.files.map((file, index) => (
                      <div
                        key={`${file.url}-${index}`}
                        className="group flex cursor-pointer items-center gap-3 rounded-[16px] bg-white/78 px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.84)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-white hover:shadow-[0_12px_24px_-26px_rgba(15,23,42,0.16),inset_0_0_0_1px_rgba(203,213,225,0.9)]"
                        onClick={() =>
                          file.type === "image"
                            ? onPreview(file.url)
                            : window.open(file.url)
                        }
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-slate-100">
                          {file.type === "image" ? (
                            <img
                              src={file.url}
                              className="h-full w-full object-cover"
                              alt=""
                            />
                          ) : (
                            <Video size={16} className="text-slate-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-semibold text-slate-800">
                            {file.title}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                            <span>{file.model}</span>
                            <span>·</span>
                            <span>
                              {new Date(file.time).toLocaleTimeString("zh-CN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void downloadFromUrls([file.url], file.title);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
                          title="下载"
                          aria-label="下载"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
