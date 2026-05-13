import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Bell,
  Check,
  ChevronDown,
  Zap,
  Globe,
  Box,
  ArrowUp,
  Lightbulb,
  Paperclip,
  Image as ImageIcon,
  Video,
  X,
  FileText,
  Trash2,
} from "lucide-react";
import type { ImageModel, Project, VideoModel } from "../types";
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
  getUnreadAnnouncementCount,
  markAllAnnouncementsAsRead,
  subscribeAnnouncementUnreadUpdates,
  SYSTEM_ANNOUNCEMENTS,
} from "../services/systemAnnouncements";
import { useWorkspaceModelPreferences } from "./Workspace/controllers/useWorkspaceModelPreferences";
import {
  getMappedModelConfigs,
  getMappedModelDisplaySummary,
  getModelDisplayLabel,
} from "../services/provider-settings";
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

type HomeCreationMode = "agent" | "image" | "video";

const MODE_OPTIONS: Array<{
  id: HomeCreationMode;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "agent", label: "主脑", icon: <Lightbulb size={14} strokeWidth={2.4} /> },
  { id: "image", label: "图片", icon: <ImageIcon size={14} strokeWidth={2.2} /> },
  { id: "video", label: "视频", icon: <Video size={14} strokeWidth={2.2} /> },
];

type HomeModelPreferenceTab = "image" | "video" | "3d";

type HomeToolbarModelOption = {
  optionKey?: string;
  id: string;
  name: string;
  desc: string;
  time?: string;
  badge?: string;
  providerId?: string | null;
};

const HOME_MODEL_OPTIONS: Record<HomeModelPreferenceTab, HomeToolbarModelOption[]> = {
  image: [
    {
      id: "Nano Banana Pro",
      name: "Nano Banana Pro",
      desc: "高质量细节优先，适合正式出图。",
      time: "~20s",
    },
    {
      id: "NanoBanana2",
      name: "Nano Banana 2",
      desc: "更快一点，适合大量试图。",
      time: "~15s",
    },
    {
      id: "Seedream5.0",
      name: "Seedream 5.0",
      desc: "偏电影感和质感表现。",
      time: "~15s",
    },
    {
      id: "GPT Image 2",
      name: "GPT Image 2",
      desc: "适合 OpenAI 图像链路。",
      time: "~30s",
    },
  ],
  video: [
    {
      id: "veo-3.1-fast-generate-preview",
      name: "Veo 3.1 Fast",
      desc: "出片更快，适合快速预览。",
      time: "~10s",
      badge: "极速版",
    },
    {
      id: "veo-3.1-generate-preview",
      name: "Veo 3.1 Pro",
      desc: "质量优先，适合正式视频生成。",
      time: "~180s",
      badge: "专业版",
    },
    {
      id: "sora-2",
      name: "Sora 2",
      desc: "适合高表现力视频任务。",
      time: "~300s",
    },
  ],
  "3d": [
    {
      id: "Tripo",
      name: "Tripo",
      desc: "默认 3D 生成模型。",
    },
  ],
};

const buildHomeModelOptions = (
  category: "image" | "video",
): HomeToolbarModelOption[] => {
  const mapped = getMappedModelConfigs(category).map((config) => ({
    optionKey: config.raw || `${config.providerId || "default"}::${config.modelId}`,
    id: category === "image" ? getModelDisplayLabel(config.modelId) : config.modelId,
    name: getModelDisplayLabel(config.modelId),
    providerId: config.providerId || null,
    desc: config.providerName
      ? `当前映射到 ${config.providerName}`
      : "当前已在设置中映射",
  }));

  return mapped.length > 0 ? mapped : HOME_MODEL_OPTIONS[category];
};

const HomeModelPreferencePopover: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  modelPreferenceTab: HomeModelPreferenceTab;
  setModelPreferenceTab: (tab: HomeModelPreferenceTab) => void;
  autoModelSelect: boolean;
  setAutoModelSelect: (value: boolean) => void;
  preferredImageModel: ImageModel;
  setPreferredImageModel: (value: ImageModel) => void;
  preferredImageProviderId: string | null;
  setPreferredImageProviderId: (value: string | null) => void;
  preferredVideoModel: VideoModel;
  setPreferredVideoModel: (value: VideoModel) => void;
  preferredVideoProviderId: string | null;
  setPreferredVideoProviderId: (value: string | null) => void;
  preferred3DModel: string;
  setPreferred3DModel: (value: string) => void;
}> = ({
  isOpen,
  onClose,
  anchorRef,
  modelPreferenceTab,
  setModelPreferenceTab,
  autoModelSelect,
  setAutoModelSelect,
  preferredImageModel,
  setPreferredImageModel,
  preferredImageProviderId,
  setPreferredImageProviderId,
  preferredVideoModel,
  setPreferredVideoModel,
  preferredVideoProviderId,
  setPreferredVideoProviderId,
  preferred3DModel,
  setPreferred3DModel,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const mappedImageSummary = getMappedModelDisplaySummary("image");
  const mappedVideoSummary = getMappedModelDisplaySummary("video");
  const mappedScriptSummary = getMappedModelDisplaySummary("script");

  const visibleImageOptions = useMemo(() => buildHomeModelOptions("image"), []);
  const visibleVideoOptions = useMemo(() => buildHomeModelOptions("video"), []);
  const visible3DOptions = HOME_MODEL_OPTIONS["3d"];

  useEffect(() => {
    if (!isOpen) return;

    const syncPosition = () => {
      if (!anchorRef.current) return;
      setAnchorRect(anchorRef.current.getBoundingClientRect());
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    syncPosition();
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, isOpen, onClose]);

  const currentOptions =
    modelPreferenceTab === "video"
      ? visibleVideoOptions
      : modelPreferenceTab === "image"
        ? visibleImageOptions
        : visible3DOptions;

  const currentValue =
    modelPreferenceTab === "image"
      ? preferredImageModel
      : modelPreferenceTab === "video"
        ? preferredVideoModel
        : preferred3DModel;

  return (
    <AnimatePresence>
      {isOpen && anchorRect ? (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed z-[95] w-[350px] max-w-[calc(100vw-32px)] rounded-[32px] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)]"
          style={{
            top: Math.max(16, anchorRect.top - 24 - 540),
            left: Math.min(
              Math.max(16, anchorRect.right - 350),
              window.innerWidth - 366,
            ),
          }}
        >
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-[17px] font-bold tracking-tight text-slate-900">
              模型偏好
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                自动选择
              </span>
              <button
                type="button"
                onClick={() => setAutoModelSelect(!autoModelSelect)}
                className={`relative h-6 w-11 rounded-full transition-all duration-300 ${
                  autoModelSelect ? "bg-black" : "bg-slate-200 p-0.5"
                }`}
              >
                <motion.div
                  animate={{ x: autoModelSelect ? 24 : 2 }}
                  className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </div>

          <div className="mb-6 flex rounded-2xl bg-slate-100/70 p-1.5">
            {(["image", "video", "3d"] as HomeModelPreferenceTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setModelPreferenceTab(tab)}
                className={`flex-1 rounded-xl py-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${
                  modelPreferenceTab === tab
                    ? "bg-white text-black shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-4 px-1 pb-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                设置映射
              </div>
              <div className="mt-2 text-[12px] font-semibold leading-6 text-slate-700">
                图像：{mappedImageSummary}
              </div>
              <div className="text-[12px] font-semibold leading-6 text-slate-700">
                视频：{mappedVideoSummary}
              </div>
              <div className="text-[12px] font-semibold leading-6 text-slate-700">
                文本：{mappedScriptSummary}
              </div>
            </div>

            <div className="text-[11px] font-bold uppercase text-slate-600">
              {modelPreferenceTab === "image"
                ? "图像"
                : modelPreferenceTab === "video"
                  ? "视频"
                  : "3D"}{" "}
              生成调度模型
            </div>

            <input
              type="text"
              value={currentValue}
              onChange={(event) => {
                const value = event.target.value;
                if (modelPreferenceTab === "image") {
                  setPreferredImageModel(value as ImageModel);
                  setPreferredImageProviderId(null);
                } else if (modelPreferenceTab === "video") {
                  setPreferredVideoModel(value as VideoModel);
                  setPreferredVideoProviderId(null);
                } else {
                  setPreferred3DModel(value);
                }
                setAutoModelSelect(false);
              }}
              className={`w-full rounded-xl border bg-slate-50/60 px-4 py-3 text-[13px] font-bold text-slate-800 outline-none transition-all hover:bg-white focus:bg-white focus:ring-4 focus:ring-black/5 ${
                !autoModelSelect
                  ? "border-black"
                  : "border-slate-200 focus:border-black"
              }`}
            />

            <div className="mt-2 flex max-h-[220px] flex-col gap-1.5 overflow-y-auto border-b border-slate-100 pb-4 pr-2 select-none custom-scrollbar">
              {currentOptions.map((preset) => {
                const isSelected =
                  modelPreferenceTab === "image"
                    ? currentValue === preset.id &&
                      (autoModelSelect ||
                        (preset.providerId || null) ===
                          (preferredImageProviderId || null))
                    : modelPreferenceTab === "video"
                      ? currentValue === preset.id &&
                        (autoModelSelect ||
                          (preset.providerId || null) ===
                            (preferredVideoProviderId || null))
                      : currentValue === preset.id;

                return (
                  <button
                    key={preset.optionKey || preset.id}
                    type="button"
                    onClick={() => {
                      if (modelPreferenceTab === "image") {
                        setPreferredImageModel(preset.id as ImageModel);
                        setPreferredImageProviderId(preset.providerId || null);
                      } else if (modelPreferenceTab === "video") {
                        setPreferredVideoModel(preset.id as VideoModel);
                        setPreferredVideoProviderId(preset.providerId || null);
                      } else {
                        setPreferred3DModel(preset.id);
                      }
                      setAutoModelSelect(false);
                      onClose();
                    }}
                    className={`rounded-2xl border p-3 text-left transition-all ${
                      isSelected
                        ? "border-slate-200/70 bg-slate-50/80 shadow-sm"
                        : "border-transparent bg-transparent hover:border-slate-100 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-0.5 flex items-center gap-2">
                          <span
                            className={`text-[14px] font-bold ${
                              isSelected ? "text-slate-900" : "text-slate-700"
                            }`}
                          >
                            {preset.name}
                          </span>
                          {preset.badge ? (
                            <span className="rounded-md border border-blue-100/50 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-500">
                              {preset.badge}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs font-medium text-slate-500">
                          {preset.desc}
                        </div>
                        {preset.time ? (
                          <div className="mt-1.5 inline-flex rounded-md bg-slate-100/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                            {preset.time}
                          </div>
                        ) : null}
                      </div>
                      {isSelected ? (
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white shadow-sm">
                          <Check size={12} className="text-black" strokeWidth={3} />
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="pt-2 text-[11px] font-medium leading-relaxed text-slate-400">
              这里改的是和侧边栏同一份模型偏好。后面你在工作台里继续出图或出视频，会沿用这套设置。
            </p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

interface ProjectCardProps {
  project?: Project;
  isNew?: boolean;
  onDelete?: (
    project: Project,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  isNew = false,
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

const Home: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentPreviewUrlMapRef = useRef<Map<File, string>>(new Map());
  const modelPreferenceAnchorRef = useRef<HTMLButtonElement>(null);

  const [modelMode, setModelMode] = useState<"thinking" | "fast">("fast");
  const [creationMode, setCreationMode] = useState<HomeCreationMode>("agent");

  const [webEnabled, setWebEnabled] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0);
  const [preferredImageModelLabel, setPreferredImageModelLabel] =
    useState("Nano Banana Pro");

  const {
    modelPreferences: {
      showModelPreference,
      setShowModelPreference,
      modelPreferenceTab,
      setModelPreferenceTab,
      autoModelSelect,
      setAutoModelSelect,
      preferredImageModel,
      setPreferredImageModel,
      preferredImageProviderId,
      setPreferredImageProviderId,
      preferredVideoModel,
      setPreferredVideoModel,
      preferredVideoProviderId,
      setPreferredVideoProviderId,
      preferred3DModel,
      setPreferred3DModel,
    },
  } = useWorkspaceModelPreferences({
    modelMode,
    clearMessages: () => {},
    setModelMode,
  });

  const loadRecentProjects = async () => {
    const all = await getProjectSummaries();
    setRecentProjects(all.slice(0, 20));
  };

  useEffect(() => {
    void loadRecentProjects();
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
    setPreferredImageModelLabel(String(preferredImageModel || "Nano Banana Pro"));
  }, [preferredImageModel]);

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
          initialModelMode: modelMode,
          initialWebEnabled: webEnabled,
          initialImageModel:
            creationMode === "image" ? preferredImageModelLabel : undefined,
          initialCreationMode: creationMode,
        },
      });
    }
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
      <HomeModelPreferencePopover
        isOpen={showModelPreference}
        onClose={() => setShowModelPreference(false)}
        anchorRef={modelPreferenceAnchorRef}
        modelPreferenceTab={modelPreferenceTab}
        setModelPreferenceTab={setModelPreferenceTab}
        autoModelSelect={autoModelSelect}
        setAutoModelSelect={setAutoModelSelect}
        preferredImageModel={preferredImageModel}
        setPreferredImageModel={setPreferredImageModel}
        preferredImageProviderId={preferredImageProviderId}
        setPreferredImageProviderId={setPreferredImageProviderId}
        preferredVideoModel={preferredVideoModel}
        setPreferredVideoModel={setPreferredVideoModel}
        preferredVideoProviderId={preferredVideoProviderId}
        setPreferredVideoProviderId={setPreferredVideoProviderId}
        preferred3DModel={preferred3DModel}
        setPreferred3DModel={setPreferred3DModel}
      />
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

      <main className="pt-20 lg:pt-24 px-4 sm:px-10 lg:px-[10%] max-w-7xl mx-auto flex flex-col items-center pb-32 lg:pb-10">
        <div className="h-8"></div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-4xl font-bold text-center mb-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-xs">
              JK
            </div>
            Jacky-Studio 让设计更简单
          </h1>
          <p className="text-gray-500 mb-10 text-center">
            懂你的设计代理，帮你搞定一切
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-4xl relative mb-16"
        >
          <div
            className={`bg-white rounded-[28px] border shadow-xl shadow-gray-100/50 hover:shadow-2xl hover:shadow-gray-200/50 transition-all duration-300 relative group focus-within:ring-2 focus-within:ring-black/5 focus-within:border-gray-300 overflow-hidden ${
              isDragOver
                ? "border-blue-400 ring-2 ring-blue-100 bg-blue-50/30"
                : "border-gray-200/50"
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
              <div className="absolute inset-0 z-30 rounded-[28px] bg-blue-50/80 border-2 border-dashed border-blue-400 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon size={24} className="text-blue-500" />
                  <span className="text-sm font-medium text-blue-600">
                    将图片拖到这里添加到对话
                  </span>
                </div>
              </div>
            ) : null}
            <div className="p-4 pt-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="请输入你的设计需求"
                className="w-full h-14 bg-transparent border-none outline-none text-lg placeholder:text-gray-300 resize-none font-medium text-gray-700"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSearch(e);
                  }
                }}
              />

              {attachments.length > 0 && (
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar px-1">
                  {attachments.map((file, i) => (
                    <div
                      key={i}
                      className="relative w-14 h-14 bg-gray-50 border border-gray-200 rounded-xl flex-shrink-0 flex items-center justify-center group overflow-hidden"
                    >
                      {file.type.startsWith("image/") ? (
                        <img
                          src={getAttachmentPreviewUrl(file)}
                          alt="preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-gray-400 flex flex-col items-center p-1">
                          <FileText size={16} />
                          <span className="text-[7px] uppercase mt-1 truncate w-10 text-center">
                            {file.name.split(".").pop()}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => removeAttachment(i)}
                        className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition backdrop-blur-sm"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {creationMode !== "agent" ? (
                <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                        {creationMode === "image" ? (
                          <ImageIcon size={16} className="text-gray-500" />
                        ) : (
                          <Video size={16} className="text-gray-500" />
                        )}
                        <span>{creationMode === "image" ? "图片任务" : "视频任务"}</span>
                      </div>
                      <p className="mt-1 text-[12px] leading-5 text-gray-500">
                        {creationMode === "image"
                          ? `当前会以图片任务方式启动工作台，后续默认沿用 ${preferredImageModelLabel}。`
                          : `当前会以视频任务方式启动工作台，后续默认沿用 ${String(preferredVideoModel || "视频模型") }。`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setModelPreferenceTab(creationMode === "image" ? "image" : "video");
                        setShowModelPreference(true);
                      }}
                      className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                    >
                      调整设置
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-500">
                    <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1">
                      模式：{creationMode === "image" ? "图片" : "视频"}
                    </span>
                    <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1">
                      {creationMode === "image"
                        ? `默认模型：${preferredImageModelLabel}`
                        : `默认模型：${String(preferredVideoModel || "未设置")}`}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition"
                      title="Upload files (Max 10)"
                    >
                      <Paperclip size={18} />
                    </button>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept=".doc,.docx,.pdf,.md,.txt,.jpg,.jpeg,.png,.webp"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50/70 p-0.5">
                    {MODE_OPTIONS.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setCreationMode(mode.id)}
                        className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium transition ${
                          creationMode === mode.id
                            ? "bg-white text-black shadow-sm ring-1 ring-black/5"
                            : "text-gray-400 hover:text-gray-700"
                        }`}
                        title={`切换到${mode.label}模式`}
                      >
                        {mode.icon}
                        <span>{mode.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="h-9 rounded-full border border-gray-200 bg-gray-50/50 flex items-center p-0.5 gap-1">
                    <button
                      onClick={() => setModelMode("thinking")}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${modelMode === "thinking" ? "bg-white shadow-sm text-black ring-1 ring-black/5" : "text-gray-400 hover:text-gray-600"}`}
                      title="Thinking Mode (Pro)"
                    >
                      <Lightbulb size={14} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => setModelMode("fast")}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${modelMode === "fast" ? "bg-white shadow-sm text-black ring-1 ring-black/5" : "text-gray-400 hover:text-gray-600"}`}
                      title="Fast Mode (Flash)"
                    >
                      <Zap size={14} strokeWidth={2.5} />
                    </button>
                  </div>

                  <button
                    onClick={() => setWebEnabled(!webEnabled)}
                    className={`w-9 h-9 rounded-full border flex items-center justify-center transition ${webEnabled ? "bg-black text-white border-black" : "border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50"}`}
                    title="Networking Mode (Web Search)"
                  >
                    <Globe size={18} strokeWidth={1.5} />
                  </button>

                  <button
                    ref={modelPreferenceAnchorRef}
                    onClick={() => setShowModelPreference(!showModelPreference)}
                    className={`w-9 h-9 rounded-full border flex items-center justify-center transition ${
                      showModelPreference
                        ? "bg-blue-50 border-blue-200 text-blue-500"
                        : "border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                    title="模型偏好"
                  >
                    <Box size={18} strokeWidth={2} />
                  </button>

                  <button
                    onClick={handleSearch}
                    disabled={!prompt.trim() && attachments.length === 0}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow-sm ${
                      prompt.trim() || attachments.length > 0
                        ? "bg-gray-400 text-white hover:bg-black transform hover:scale-105"
                        : "bg-gray-200 text-white cursor-not-allowed"
                    }`}
                  >
                    <ArrowUp size={18} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium">最近项目</h2>
            <button
              onClick={() => navigate(ROUTES.projects)}
              className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              查看全部 <span className="text-xs">{">"}</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <ProjectCard isNew />
            {recentProjects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onDelete={handleDeleteProject}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
