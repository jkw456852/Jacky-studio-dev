import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus,
  Bell,
  ChevronDown,
  Box,
  ArrowUp,
  Mic,
  Image as ImageIcon,
  X,
  FileText,
  Trash2,
} from "lucide-react";
import type { Project } from "../types";
import SystemAnnouncementModal from "../components/SystemAnnouncementModal";
import {
  deleteProject,
  getProject,
  getProjectSummaries,
} from "../services/storage";
import { deleteTopicMemory } from "../services/topic-memory";
import { getMemoryKey } from "../services/topicMemory/key";
import Sidebar from "../components/Sidebar";
import {
  buildGptImageInspirationImageCandidates,
  createGptImageInspirationShuffleSeed,
  fetchGptImageInspiration,
  GPT_IMAGE_INSPIRATION_REFRESH_INTERVAL_MS,
  shuffleGptImageInspirationCases,
  type GptImageInspirationCase,
  type GptImageInspirationPayload,
} from "../services/gpt-image-inspiration";
import {
  getUnreadAnnouncementCount,
  markAllAnnouncementsAsRead,
  subscribeAnnouncementUnreadUpdates,
  SYSTEM_ANNOUNCEMENTS,
} from "../services/systemAnnouncements";
import { ROUTES, createNewWorkspacePath, workspacePath } from "../utils/routes";

const toMemoryKey = (workspaceId: string, conversationId: string): string => {
  if (!workspaceId || !conversationId) return conversationId;
  if (conversationId.includes(":")) return conversationId;
  return getMemoryKey(workspaceId, conversationId);
};

interface HeaderProps {
  unreadAnnouncementCount: number;
  onOpenAnnouncements: () => void;
}

const Header: React.FC<HeaderProps> = ({
  unreadAnnouncementCount,
  onOpenAnnouncements,
}) => (
  <header className="fixed top-0 left-0 right-0 h-16 px-8 flex items-center justify-between z-40 bg-white/70 backdrop-blur-md border-b border-white/20 shadow-sm shadow-gray-100/20">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white font-bold text-xs">
        JK
      </div>
      <span className="font-bold text-xl tracking-tight">Jacky-Studio</span>
    </div>
    <div className="flex items-center gap-6">
      <div className="text-sm font-medium text-gray-600 flex items-center gap-1 cursor-pointer">
        简体中文 <ChevronDown size={14} />
      </div>
      <button
        type="button"
        onClick={onOpenAnnouncements}
        className="relative rounded-full border border-black/5 bg-white/80 p-2 text-gray-600 transition hover:bg-gray-100 hover:text-black"
        aria-label="打开系统公告"
      >
        <Bell size={20} className="text-current" />
        {unreadAnnouncementCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-5 text-white shadow-md shadow-red-500/25">
            {unreadAnnouncementCount > 9 ? "9+" : unreadAnnouncementCount}
          </span>
        ) : null}
      </button>
      <div className="w-8 h-8 rounded-full border border-gray-200 cursor-pointer bg-black text-white text-[10px] font-bold flex items-center justify-center">
        JK
      </div>
    </div>
  </header>
);

const HOME_ICON_BUTTON_CLASS =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200";
const HOME_GEMINI_GHOST_BUTTON_CLASS =
  `${HOME_ICON_BUTTON_CLASS} text-[#202124] hover:bg-[#3c4043]/6`;
const DAILY_INSPIRATION_COUNT = 72;

const HomeInspirationImage: React.FC<{
  alt: string;
  className?: string;
  src: string;
}> = ({ alt, className, src }) => {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const candidates = React.useMemo(
    () => buildGptImageInspirationImageCandidates(src),
    [src],
  );

  useEffect(() => {
    setCandidateIndex(0);
    setExhausted(false);
  }, [src]);

  if (!candidates[candidateIndex] || exhausted) {
    return (
      <div
        className={`flex min-h-[160px] items-center justify-center bg-[#f3f3f1] px-4 text-center text-xs leading-5 text-slate-400 ${
          className || ""
        }`}
      >
        {alt || "灵感图片加载失败"}
      </div>
    );
  }

  return (
    <img
      src={candidates[candidateIndex]}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (candidateIndex < candidates.length - 1) {
          setCandidateIndex((current) => current + 1);
          return;
        }
        setExhausted(true);
      }}
    />
  );
};

interface ProjectCardProps {
  project?: Project;
  isNew?: boolean;
  featured?: boolean;
  onDelete?: (
    project: Project,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  isNew = false,
  featured = false,
  onDelete,
}) => {
  const navigate = useNavigate();

  if (isNew) {
    return (
      <div
        onClick={() => navigate(createNewWorkspacePath())}
        className="aspect-[4/3] bg-gray-100 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition group"
      >
        <Plus
          size={32}
          className="text-gray-400 group-hover:scale-110 transition"
        />
        <span className="mt-2 text-sm font-medium text-gray-600">新建项目</span>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        if (project?.id) navigate(workspacePath(project.id));
      }}
      className="flex flex-col gap-2 cursor-pointer group"
    >
      <div className="aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden border border-gray-100 group-hover:shadow-md transition relative">
        {project?.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Box size={40} />
          </div>
        )}
        {project && onDelete && (
          <button
            onClick={(e) => onDelete(project, e)}
            className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg border border-black/5 shadow-sm text-red-500 hover:bg-red-50 hover:border-red-200 transition opacity-0 group-hover:opacity-100"
            title="删除项目"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-900 truncate">
          {project?.title || "未命名"}
        </h3>
        <p className="text-xs text-gray-400">更新于 {project?.updatedAt}</p>
      </div>
    </div>
  );
};

interface WideProjectCardProps {
  project?: Project;
  isNew?: boolean;
  onDelete?: (
    project: Project,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => void;
}

const WideProjectCard: React.FC<WideProjectCardProps> = ({
  project,
  isNew = false,
  onDelete,
}) => {
  const navigate = useNavigate();

  if (isNew) {
    return (
      <div
        onClick={() => navigate(createNewWorkspacePath())}
        className="group grid aspect-[4/3] cursor-pointer rounded-[18px] bg-white p-2 shadow-[0_18px_46px_-36px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_56px_-38px_rgba(15,23,42,0.22)]"
      >
        <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[14px] bg-[#f3f3f1] text-slate-900">
          <Plus size={28} className="mb-3 transition duration-300 group-hover:scale-110" />
          <span className="text-base font-semibold tracking-tight">新建项目</span>
        </div>
      </div>
    );
  }

  const title = project?.title || "未命名项目";
  const updatedAt = project?.updatedAt || "";

  return (
    <div
      onClick={() => {
        if (project?.id) navigate(workspacePath(project.id));
      }}
      className="group grid aspect-[4/3] cursor-pointer grid-rows-[minmax(0,1fr)_28%] rounded-[18px] bg-white p-2 shadow-[0_18px_46px_-36px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_56px_-38px_rgba(15,23,42,0.22)]"
    >
      <div className="relative min-h-0 overflow-hidden rounded-[14px] bg-[#f3f3f1]">
        {project?.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,#f7f7f6,#efefec)] text-slate-300">
            <Box size={44} />
          </div>
        )}
        {project && onDelete ? (
          <button
            onClick={(e) => onDelete(project, e)}
            className="absolute right-3 top-3 rounded-lg border border-white/40 bg-white/90 p-1.5 text-red-500 opacity-0 shadow-sm backdrop-blur-sm transition hover:border-red-200 hover:bg-red-50 group-hover:opacity-100"
            title="删除项目"
          >
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-col justify-center px-2 py-2">
        <h3 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-slate-400">更新于 {updatedAt}</p>
      </div>
    </div>
  );
};

const Home: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const recentProjectsPreview = recentProjects.slice(0, 20);
  const [inspirationPayload, setInspirationPayload] =
    useState<GptImageInspirationPayload | null>(null);
  const [inspirationError, setInspirationError] = useState("");
  const [inspirationShuffleSeed] = useState(
    createGptImageInspirationShuffleSeed,
  );

  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const attachmentPreviewUrlMapRef = useRef<Map<File, string>>(new Map());

  const [isDragOver, setIsDragOver] = useState(false);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0);

  const loadRecentProjects = async () => {
    const all = await getProjectSummaries();
    setRecentProjects(all.slice(0, 20));
  };

  useEffect(() => {
    void loadRecentProjects();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let lastRefreshAt = 0;

    const loadDailyInspirations = async () => {
      try {
        const payload = await fetchGptImageInspiration();
        if (cancelled) return;
        setInspirationPayload(payload);
        setInspirationError("");
        lastRefreshAt = Date.now();
      } catch (error) {
        if (cancelled) return;
        console.warn("[Home] failed to load daily inspirations", error);
        setInspirationError("灵感加载失败");
      }
    };

    const refreshIfStale = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRefreshAt >= GPT_IMAGE_INSPIRATION_REFRESH_INTERVAL_MS
      ) {
        void loadDailyInspirations();
      }
    };

    void loadDailyInspirations();
    const refreshTimer = window.setInterval(
      refreshIfStale,
      GPT_IMAGE_INSPIRATION_REFRESH_INTERVAL_MS,
    );
    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, []);

  useEffect(() => {
    const syncUnreadCount = () => {
      setUnreadAnnouncementCount(getUnreadAnnouncementCount());
    };
    syncUnreadCount();
    return subscribeAnnouncementUnreadUpdates(syncUnreadCount);
  }, []);

  useEffect(() => {
    const activeFiles = new Set(attachments);
    attachmentPreviewUrlMapRef.current.forEach((url, file) => {
      if (!activeFiles.has(file)) {
        URL.revokeObjectURL(url);
        attachmentPreviewUrlMapRef.current.delete(file);
      }
    });
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentPreviewUrlMapRef.current.forEach((url) => URL.revokeObjectURL(url));
      attachmentPreviewUrlMapRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const textarea = promptTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 44), 144)}px`;
  }, [prompt]);

  const handleDeleteProject = async (
    project: Project,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();
    if (!project?.id) return;
    if (!window.confirm("确定要删除这个项目吗？此操作无法撤销。")) return;

    try {
      const fullProject = await getProject(project.id);
      const conversations = fullProject?.conversations || [];
      for (const conversation of conversations) {
        await deleteTopicMemory(toMemoryKey(project.id, conversation.id));
      }
      await deleteTopicMemory(project.id);
      await deleteProject(project.id);
      await loadRecentProjects();
    } catch (error) {
      console.error("[Home] delete project failed", error);
      window.alert("删除失败，请稍后重试。");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() || attachments.length > 0) {
      navigate(createNewWorkspacePath(), {
        state: {
          initialPrompt: prompt,
          initialAttachments: attachments,
        },
      });
    }
  };

  const handleUseInspirationPrompt = (item: GptImageInspirationCase) => {
    const nextPrompt = String(item.prompt || item.promptPreview || "").trim();
    if (!nextPrompt) return;

    setPrompt(nextPrompt);
    requestAnimationFrame(() => {
      promptTextareaRef.current?.focus();
      promptTextareaRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  const getAttachmentPreviewUrl = (file: File) => {
    const existing = attachmentPreviewUrlMapRef.current.get(file);
    if (existing) return existing;
    const next = URL.createObjectURL(file);
    attachmentPreviewUrlMapRef.current.set(file, next);
    return next;
  };

  const appendFiles = (files: File[]) => {
    const acceptedFiles = files
      .filter(
        (file) =>
          file.type.startsWith("image/") ||
          file.type.startsWith("video/") ||
          /\.(doc|docx|pdf|md|txt|jpg|jpeg|png|webp)$/i.test(file.name),
      )
      .slice(0, 10);
    if (acceptedFiles.length === 0) return;

    setAttachments((prev) => [...prev, ...acceptedFiles].slice(0, 10));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      appendFiles(Array.from(e.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const dailyInspirationCases = React.useMemo(
    () =>
      shuffleGptImageInspirationCases(
        inspirationPayload?.cases || [],
        inspirationShuffleSeed,
      ).slice(0, DAILY_INSPIRATION_COUNT),
    [inspirationPayload, inspirationShuffleSeed],
  );

  const handleOpenAnnouncements = () => {
    setIsAnnouncementOpen(true);
    markAllAnnouncementsAsRead();
    setUnreadAnnouncementCount(0);
  };

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-gray-50 to-white">
      <Header
        unreadAnnouncementCount={unreadAnnouncementCount}
        onOpenAnnouncements={handleOpenAnnouncements}
      />
      <Sidebar />
      <SystemAnnouncementModal
        isOpen={isAnnouncementOpen}
        announcements={SYSTEM_ANNOUNCEMENTS}
        onClose={() => setIsAnnouncementOpen(false)}
      />
      {onExit && (
        <button
          onClick={onExit || (() => navigate(ROUTES.dashboard))}
          className="fixed top-24 left-6 z-[60] px-4 py-2 bg-white backdrop-blur-md border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all font-medium text-sm flex items-center gap-2 shadow-sm"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          返回主页
        </button>
      )}

      <main className="relative flex w-full flex-col items-center px-4 pb-32 pt-20 sm:px-8 lg:px-10 lg:pb-10 lg:pt-24 xl:px-12">
        <section className="relative flex min-h-[280px] w-full flex-col items-center justify-center pb-12 pt-14 sm:min-h-[330px] sm:pb-16 sm:pt-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[58%] h-[430px] w-[980px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(187,222,255,0.92)_0%,rgba(211,235,255,0.68)_34%,rgba(239,248,255,0.34)_58%,rgba(255,255,255,0)_78%)] blur-2xl"
          />
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="relative z-10 mb-9 text-center"
          >
            <h1 className="text-[28px] font-normal tracking-[-0.04em] text-[#202124] sm:text-[38px] md:text-[42px]">
              让创意设计更简单
            </h1>
          </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.16 }}
          className="relative z-10 w-full max-w-5xl"
        >
          <div
            className={`group relative mx-auto flex w-full max-w-[730px] flex-col overflow-visible rounded-[2rem] border border-black/[0.03] bg-white p-3 shadow-[0_2px_6px_rgba(60,64,67,0.08),0_12px_32px_rgba(60,64,67,0.12)] transition-colors focus-within:shadow-[0_2px_8px_rgba(60,64,67,0.1),0_18px_42px_rgba(60,64,67,0.16)] ${
              isDragOver
                ? "ring-2 ring-[#1f3b9b]/20"
                : ""
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsDragOver(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsDragOver(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsDragOver(false);
              if (event.dataTransfer.files.length > 0) {
                appendFiles(Array.from(event.dataTransfer.files));
              }
            }}
          >
              {isDragOver ? (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-[2rem] border border-dashed border-[#1f3b9b]/35 bg-[#f8fafd]/90">
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon size={24} className="text-[#1f3b9b]" />
                    <span className="text-sm font-medium text-[#1f3b9b]">
                      拖到这里添加到对话
                    </span>
                  </div>
                </div>
            ) : null}
            <div className="flex min-w-0 flex-col gap-2">
              {attachments.length > 0 && (
                <div className="flex flex-row gap-2.5 overflow-x-auto px-1 pt-1 pb-2.5 no-scrollbar">
                  {attachments.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[#dadce0] bg-[#f8fafd] text-[#5f6368]"
                    >
                      {file.type.startsWith("image/") ? (
                        <img
                          src={getAttachmentPreviewUrl(file)}
                          alt={file.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center">
                          <FileText size={17} />
                          <span className="w-12 truncate text-[9px] font-medium uppercase">
                            {file.name.split(".").pop()}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                        aria-label="移除附件"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                ref={promptTextareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={1}
                placeholder="输入你的想法，设计马上呈现"
                className="relative max-h-40 min-h-10 w-full min-w-0 resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-[17px] leading-6 text-[#1f1f1f] outline-none placeholder:text-[#575b5f]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSearch(e);
                  }
                }}
              />

              <div className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={HOME_GEMINI_GHOST_BUTTON_CLASS}
                  title="添加照片和文件"
                  aria-label="添加照片和文件"
                >
                  <Plus size={19} strokeWidth={1.9} />
                </button>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".doc,.docx,.pdf,.md,.txt,.jpg,.jpeg,.png,.webp"
                />

                <div className="min-w-0 flex-1" aria-hidden="true" />

                <button
                  type="button"
                  className={`${HOME_ICON_BUTTON_CLASS} text-[#202124] hover:bg-[#3c4043]/6`}
                  title="语音输入"
                  aria-label="语音输入"
                >
                  <Mic size={18} strokeWidth={2} />
                </button>

                <button
                  onClick={handleSearch}
                  disabled={!prompt.trim() && attachments.length === 0}
                  className={`${HOME_ICON_BUTTON_CLASS} ${
                    prompt.trim() || attachments.length > 0
                      ? "bg-[#1f3b9b] text-white hover:bg-[#274aad]"
                      : "bg-[#eef0f2] text-[#5f6368]/45 cursor-not-allowed"
                  }`}
                  aria-label="发送消息"
                >
                  <ArrowUp size={16} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
        </section>

        <div className="w-[calc(100vw-2rem)] max-w-none overflow-x-clip lg:w-[calc(100vw-12rem)]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-medium">最近项目</h2>
            <button
              onClick={() => navigate(ROUTES.projects)}
              className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              查看全部 <span className="text-xs">{">"}</span>
            </button>
          </div>
          <div className="grid justify-center gap-5 [grid-template-columns:repeat(auto-fill,minmax(260px,320px))]">
              <WideProjectCard isNew />
              {recentProjectsPreview.map((p) => (
                <WideProjectCard
                  key={p.id}
                  project={p}
                  onDelete={handleDeleteProject}
                />
              ))}
          </div>
        </div>

        <section className="mt-16 w-[calc(100vw-2rem)] max-w-none overflow-x-clip lg:w-[calc(100vw-12rem)]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-medium">每日灵感</h2>
          </div>

          {dailyInspirationCases.length > 0 ? (
            <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 2xl:columns-6">
              {dailyInspirationCases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleUseInspirationPrompt(item)}
                  className="group mb-4 inline-block w-full overflow-hidden rounded-[18px] bg-white text-left shadow-[0_18px_46px_-36px_rgba(15,23,42,0.2)] ring-1 ring-slate-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_58px_-40px_rgba(15,23,42,0.28)]"
                >
                  <div className="overflow-hidden bg-[#f3f3f1]">
                    <HomeInspirationImage
                      src={item.image}
                      alt={item.imageAlt || item.title}
                      className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                    />
                  </div>
                  <div className="px-3 py-3">
                    <div className="line-clamp-2 text-[13px] font-semibold leading-5 text-slate-900">
                      {item.title}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-400">
                      {item.promptPreview || item.sourceLabel}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center text-sm text-slate-400">
              {inspirationError || "正在加载每日灵感..."}
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => navigate(ROUTES.gptImageInspiration)}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.22)] transition hover:border-slate-300 hover:text-slate-950"
            >
              前往灵感库发现更多灵感
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
