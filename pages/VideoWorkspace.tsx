import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { VideoApp } from 'jackystudio';
import { ROUTES } from '../utils/routes';

const VideoWorkspace: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="flex relative h-screen w-full bg-[#0a0a0c] overflow-hidden">
            {/* 返回首页按钮 */}
            <button
                onClick={() => navigate(ROUTES.dashboard)}
                className="absolute top-6 left-6 z-[100] flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md border border-white/5 transition-all shadow-lg hover:scale-105"
            >
                <Home size={18} />
                <span className="text-sm font-medium tracking-wide">返回首页</span>
            </button>

            {/* 主工作区 - 原生挂载的视频组件 */}
            <div className="flex-1 relative h-full w-full">
                <VideoApp />
            </div>
        </div>
    );
};

export default VideoWorkspace;
