import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ROUTES, createNewWorkspacePath } from "../utils/routes";
import { useAuthSession } from "../hooks/useAuthSession";
import {
  Home as HomeIcon,
  Folder,
  FolderKanban,
  Image as ImageIcon,
  Plus,
  Settings,
  User,
} from "lucide-react";

interface SidebarProps {
  onNewProject?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onNewProject }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthSession();

  const handleNewProject = () => {
    if (onNewProject) {
      onNewProject();
    } else {
      navigate(createNewWorkspacePath());
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="fixed left-6 top-1/2 z-50 hidden -translate-y-1/2 flex-col gap-4 lg:flex"
      >
        <div>
          <button
            onClick={handleNewProject}
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground text-background shadow-premium transition-all duration-200 hover:scale-105 active:scale-95"
            title="新建项目"
          >
            <Plus size={24} />
          </button>
        </div>

        <div className="flex w-12 flex-col items-center gap-6 rounded-full border border-border/50 bg-card/80 py-6 shadow-premium backdrop-blur-xl">
          <button
            onClick={() => navigate(ROUTES.dashboard)}
            className={`rounded-full p-2 transition ${
              isActive(ROUTES.dashboard)
                ? "bg-gray-100 text-black shadow-sm"
                : "text-gray-400 hover:bg-gray-50 hover:text-black"
            }`}
            title="首页"
          >
            <HomeIcon size={20} />
          </button>
          <button
            onClick={() => navigate(ROUTES.projects)}
            className={`rounded-full p-2 transition ${
              isActive(ROUTES.projects)
                ? "bg-gray-100 text-black shadow-sm"
                : "text-gray-400 hover:bg-gray-50 hover:text-black"
            }`}
            title="项目"
          >
            <Folder size={20} />
          </button>
          <button
            onClick={() => navigate(ROUTES.gptImageInspiration)}
            className={`rounded-full p-2 transition ${
              isActive(ROUTES.gptImageInspiration)
                ? "bg-gray-100 text-black shadow-sm"
                : "text-gray-400 hover:bg-gray-50 hover:text-black"
            }`}
            title="GPT Image 灵感库"
          >
            <ImageIcon size={20} />
          </button>
          <button
            onClick={() => navigate(ROUTES.styleLibraryCenter)}
            className={`rounded-full p-2 transition ${
              isActive(ROUTES.styleLibraryCenter)
                ? "bg-gray-100 text-black shadow-sm"
                : "text-gray-400 hover:bg-gray-50 hover:text-black"
            }`}
            title="风格库中心"
          >
            <FolderKanban size={20} />
          </button>
          <button
            onClick={() => navigate(ROUTES.settings)}
            className={`rounded-full p-2 transition ${
              isActive(ROUTES.settings)
                ? "bg-gray-100 text-black shadow-sm"
                : "text-gray-400 hover:bg-gray-50 hover:text-black"
            }`}
            title="设置 / API Key"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={() => navigate(ROUTES.userDetail)}
            className={`rounded-full p-2 transition ${
              isActive(ROUTES.userDetail)
                ? "bg-gray-100 text-black shadow-sm"
                : "text-gray-400 hover:bg-gray-50 hover:text-black"
            }`}
            title={isAuthenticated ? "账号中心" : "登录 / 注册"}
          >
            <div className="relative">
              <User size={20} />
              {isAuthenticated && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
              )}
            </div>
          </button>
        </div>
      </motion.div>

      <div className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-gray-100 bg-white/80 px-4 pb-safe backdrop-blur-xl lg:hidden">
        <button
          onClick={() => navigate(ROUTES.dashboard)}
          className={`flex flex-col items-center gap-1 ${
            isActive(ROUTES.dashboard) ? "text-black" : "text-gray-400"
          }`}
        >
          <HomeIcon
            size={20}
            strokeWidth={isActive(ROUTES.dashboard) ? 2.5 : 2}
          />
          <span className="text-[10px] font-black uppercase tracking-tighter">
            首页
          </span>
        </button>
        <button
          onClick={() => navigate(ROUTES.projects)}
          className={`flex flex-col items-center gap-1 ${
            isActive(ROUTES.projects) ? "text-black" : "text-gray-400"
          }`}
        >
          <Folder
            size={20}
            strokeWidth={isActive(ROUTES.projects) ? 2.5 : 2}
          />
          <span className="text-[10px] font-black uppercase tracking-tighter">
            项目
          </span>
        </button>
        <button
          onClick={() => navigate(ROUTES.gptImageInspiration)}
          className={`flex flex-col items-center gap-1 ${
            isActive(ROUTES.gptImageInspiration) ? "text-black" : "text-gray-400"
          }`}
        >
          <ImageIcon
            size={20}
            strokeWidth={isActive(ROUTES.gptImageInspiration) ? 2.5 : 2}
          />
          <span className="text-[10px] font-black uppercase tracking-tighter">
            灵感库
          </span>
        </button>
        <button
          onClick={() => navigate(ROUTES.styleLibraryCenter)}
          className={`flex flex-col items-center gap-1 ${
            isActive(ROUTES.styleLibraryCenter) ? "text-black" : "text-gray-400"
          }`}
        >
          <FolderKanban
            size={20}
            strokeWidth={isActive(ROUTES.styleLibraryCenter) ? 2.5 : 2}
          />
          <span className="text-[10px] font-black uppercase tracking-tighter">
            风格库
          </span>
        </button>

        <div className="-translate-y-4">
          <button
            onClick={handleNewProject}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white shadow-2xl shadow-black/20 transition-all active:scale-90"
          >
            <Plus size={28} />
          </button>
        </div>

        <button
          onClick={() => navigate(ROUTES.settings)}
          className={`flex flex-col items-center gap-1 ${
            isActive(ROUTES.settings) ? "text-black" : "text-gray-400"
          }`}
        >
          <Settings
            size={20}
            strokeWidth={isActive(ROUTES.settings) ? 2.5 : 2}
          />
          <span className="text-[10px] font-black uppercase tracking-tighter">
            设置
          </span>
        </button>
        <button
          onClick={() => navigate(ROUTES.userDetail)}
          className={`flex flex-col items-center gap-1 ${
            isActive(ROUTES.userDetail) ? "text-black" : "text-gray-400"
          }`}
        >
          <div className="relative">
            <User
              size={20}
              strokeWidth={isActive(ROUTES.userDetail) ? 2.5 : 2}
            />
            {isAuthenticated && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
            )}
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">
            我的
          </span>
        </button>
      </div>
    </>
  );
};

export default Sidebar;
