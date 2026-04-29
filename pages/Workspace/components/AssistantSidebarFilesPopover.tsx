import React from 'react';
import { Download, File as FileIcon, Image as ImageIcon, Video } from 'lucide-react';
import type { ChatMessage } from '../../../types';

type AssistantSidebarFilesPopoverProps = {
    open: boolean;
    messages: ChatMessage[];
    onPreview: (url: string) => void;
    onToggle: () => void;
};

type GeneratedFile = {
    url: string;
    type: 'image' | 'video';
    title: string;
    time: number;
    model: string;
};

const getGeneratedFiles = (messages: ChatMessage[]): GeneratedFile[] =>
    messages.flatMap((message, messageIndex) => {
        const imageFiles = (message.agentData?.imageUrls || []).map((url, fileIndex) => ({
            url,
            type: 'image' as const,
            title: message.agentData?.title || `生成图片 ${messageIndex + 1}-${fileIndex + 1}`,
            time: message.timestamp,
            model: message.agentData?.model || 'AI',
        }));
        const videoFiles = (message.agentData?.videoUrls || []).map((url, fileIndex) => ({
            url,
            type: 'video' as const,
            title: message.agentData?.title || `生成视频 ${messageIndex + 1}-${fileIndex + 1}`,
            time: message.timestamp,
            model: message.agentData?.model || 'AI',
        }));

        return [...imageFiles, ...videoFiles];
    });

export const AssistantSidebarFilesPopover: React.FC<AssistantSidebarFilesPopoverProps> = ({
    open,
    messages,
    onPreview,
    onToggle,
}) => {
    const files = getGeneratedFiles(messages);
    const imageCount = messages.flatMap(message => message.agentData?.imageUrls || []).length;

    return (
        <div className="relative">
            <button
                onClick={(event) => {
                    event.stopPropagation();
                    onToggle();
                }}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${open ? 'text-gray-700 bg-gray-100' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                title="Files"
            >
                <FileIcon size={15} strokeWidth={1.5} />
            </button>
            {open && (
                <div
                    className="absolute top-full right-0 mt-2 w-[320px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-900 text-sm">已生成文件列表</h3>
                        <span className="text-[10px] text-gray-400">{imageCount} 个文件</span>
                    </div>
                    {files.length === 0 ? (
                        <div className="h-[250px] flex flex-col items-center justify-center text-gray-400 gap-2">
                            <ImageIcon size={28} className="opacity-20" />
                            <span className="text-xs text-gray-400">暂无生成文件</span>
                        </div>
                    ) : (
                        <div className="max-h-[350px] overflow-y-auto no-scrollbar p-2 space-y-1">
                            {files.reverse().map((file, index) => (
                                <div
                                    key={`${file.url}-${index}`}
                                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition group"
                                    onClick={() => file.type === 'image' ? onPreview(file.url) : window.open(file.url)}
                                >
                                    <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 border border-gray-100 bg-gray-50 flex items-center justify-center">
                                        {file.type === 'image' ? (
                                            <img src={file.url} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <Video size={16} className="text-gray-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-gray-700 truncate">{file.title}</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                                            <span>{file.model}</span>
                                            <span>·</span>
                                            <span>{new Date(file.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                    <a
                                        href={file.url}
                                        download={`${file.title}.${file.type === 'image' ? 'png' : 'mp4'}`}
                                        onClick={(event) => event.stopPropagation()}
                                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 transition"
                                    >
                                        <Download size={14} />
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
