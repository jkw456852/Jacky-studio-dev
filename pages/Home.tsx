import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home as HomeIcon,
  Folder,
  User,
  Info,
  Plus,
  Bell,
  ChevronDown,
  Zap,
  Globe,
  Box,
  ArrowUp,
  Lightbulb,
  Paperclip,
  Image as ImageIcon,
  Video,
  Hash,
  X,
  FileText,
  Banana,
  ShoppingCart,
  Palette,
  Star,
  Settings,
  Trash2,
} from "lucide-react";
import { Project } from "../types";
import {
  deleteProject,
  getProject,
  getProjectSummaries,
} from "../services/storage";
import { deleteTopicMemory } from "../services/topic-memory";
import { getMemoryKey } from "../services/topicMemory/key";
import { SettingsModal } from "../components/SettingsModal";
import Sidebar from "../components/Sidebar";
import { ROUTES, createNewWorkspacePath, workspacePath } from "../utils/routes";

const toMemoryKey = (workspaceId: string, conversationId: string): string => {
  if (!workspaceId || !conversationId) return conversationId;
  if (conversationId.includes(":")) return conversationId;
  return getMemoryKey(workspaceId, conversationId);
};

const Header = () => (
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
      <button className="p-2 rounded-full hover:bg-gray-200 transition">
        <Bell size={20} className="text-gray-600" />
      </button>
      <div className="w-8 h-8 rounded-full border border-gray-200 cursor-pointer bg-black text-white text-[10px] font-bold flex items-center justify-center">
        JK
      </div>
    </div>
  </header>
);

interface FilterPillProps {
  icon?: React.ReactNode;
  text: string;
  active?: boolean;
}

const FilterPill: React.FC<FilterPillProps> = ({
  icon,
  text,
  active = false,
}) => (
  <button
    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 border transition ${
      active
        ? "bg-orange-50 border-orange-200 text-orange-600"
        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
    }`}
  >
    {icon}
    {text}
  </button>
);

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

  // Attachments State
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Model State: 'thinking' (Pro) or 'fast' (Flash)
  const [modelMode, setModelMode] = useState<"thinking" | "fast">("fast");

  // New States for Features
  const [webEnabled, setWebEnabled] = useState(false);
  const [imageModelEnabled, setImageModelEnabled] = useState(false); // Cube icon: "Nano Banana Pro"

  // UI States
  const loadRecentProjects = async () => {
    const all = await getProjectSummaries();
    setRecentProjects(all.slice(0, 20));
  };

  useEffect(() => {
    void loadRecentProjects();
  }, []);

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
          initialImageModel: imageModelEnabled ? "Nano Banana Pro" : undefined,
        },
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments((prev) => {
        const combined = [...prev, ...newFiles];
        return combined.slice(0, 10);
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-gray-50 to-white">
      <Header />
      <Sidebar />
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

        {/* Input Area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-4xl relative mb-8"
        >
          <div className="bg-white rounded-[28px] border border-gray-200/50 shadow-xl shadow-gray-100/50 hover:shadow-2xl hover:shadow-gray-200/50 transition-all duration-300 relative group focus-within:ring-2 focus-within:ring-black/5 focus-within:border-gray-300 overflow-hidden">
            <div className="p-4 pt-3">
              {/* Input Field */}
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

              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar px-1">
                  {attachments.map((file, i) => (
                    <div
                      key={i}
                      className="relative w-14 h-14 bg-gray-50 border border-gray-200 rounded-xl flex-shrink-0 flex items-center justify-center group overflow-hidden"
                    >
                      {file.type.startsWith("image/") ? (
                        <img
                          src={URL.createObjectURL(file)}
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

              {/* Bottom Toolbar */}
              <div className="flex justify-between items-center mt-2">
                {/* Left: Attachment & Agent */}
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

                {/* Right: Controls */}
                <div className="flex items-center gap-2">
                  {/* Model Switcher Pill */}
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

                  {/* Globe (Web Search) */}
                  {/* Globe (Web Search) */}
                  <button
                    onClick={() => setWebEnabled(!webEnabled)}
                    className={`w-9 h-9 rounded-full border flex items-center justify-center transition ${webEnabled ? "bg-black text-white border-black" : "border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50"}`}
                    title="Networking Mode (Web Search)"
                  >
                    <Globe size={18} strokeWidth={1.5} />
                  </button>

                  {/* Cube (Image Model Selection - Nano Banana Pro) */}
                  <button
                    onClick={() => setImageModelEnabled(!imageModelEnabled)}
                    className={`w-9 h-9 rounded-full border flex items-center justify-center transition ${imageModelEnabled ? "bg-blue-50 border-blue-200 text-blue-500" : "border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50"}`}
                    title="Image Model: Nano Banana Pro"
                  >
                    <Box size={18} strokeWidth={2} />
                  </button>

                  {/* Send Button */}
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

        {/* Filters / Tags */}
        <div className="flex flex-wrap justify-center gap-3 mb-16">
          <FilterPill
            text={
              modelMode === "thinking" ? "Nano Banana Pro" : "Nano Banana Flash"
            }
            icon={
              <Banana
                size={16}
                className={
                  modelMode === "thinking"
                    ? "text-orange-500"
                    : "text-yellow-500"
                }
              />
            }
            active={true}
          />
          <FilterPill text="Design" icon={<Box size={16} />} />
          <FilterPill text="Branding" icon={<Star size={16} />} />
          <FilterPill text="Illustration" icon={<Palette size={16} />} />
          <FilterPill text="E-Commerce" icon={<ShoppingCart size={16} />} />
          <FilterPill text="Video" icon={<Video size={16} />} />
        </div>

        {/* Recent Projects */}
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


