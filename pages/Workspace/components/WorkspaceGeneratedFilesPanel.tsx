import React from "react";
import { Download, Video } from "lucide-react";
import type { ChatMessage } from "../../../types";

type GeneratedFile = {
  url: string;
  type: "image" | "video";
  title: string;
  time: number;
  model: string;
};

type WorkspaceGeneratedFilesPanelProps = {
  messages: ChatMessage[];
  onPreviewImage: (url: string) => void;
};

const getGeneratedFiles = (messages: ChatMessage[]): GeneratedFile[] =>
  messages.flatMap((message, messageIndex) => {
    const imageFiles = (message.agentData?.imageUrls || []).map((url, fileIndex) => ({
      url,
      type: "image" as const,
      title: message.agentData?.title || `生成图片 ${messageIndex + 1}-${fileIndex + 1}`,
      time: message.timestamp,
      model: message.agentData?.model || "AI",
    }));
    const videoFiles = (message.agentData?.videoUrls || []).map((url, fileIndex) => ({
      url,
      type: "video" as const,
      title: message.agentData?.title || `生成视频 ${messageIndex + 1}-${fileIndex + 1}`,
      time: message.timestamp,
      model: message.agentData?.model || "AI",
    }));

    return [...imageFiles, ...videoFiles];
  });

export const WorkspaceGeneratedFilesPanel: React.FC<WorkspaceGeneratedFilesPanelProps> = ({
  messages,
  onPreviewImage,
}) => {
  const files = getGeneratedFiles(messages);

  if (files.length === 0) {
    return <div className="py-16 text-center text-xs text-gray-400">暂无文件</div>;
  }

  return (
    <div className="p-2">
      {files.reverse().map((file, index) => (
        <div
          key={`${file.url}-${index}`}
          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition group"
          onClick={() =>
            file.type === "image" ? onPreviewImage(file.url) : window.open(file.url)
          }
        >
          <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 border border-gray-100 bg-gray-50 flex items-center justify-center">
            {file.type === "image" ? (
              <img src={file.url} className="w-full h-full object-cover" alt="" />
            ) : (
              <Video size={16} className="text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-700 truncate">{file.title}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {file.model} ·{" "}
              {new Date(file.time).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <a
            href={file.url}
            download={`${file.title}.${file.type === "image" ? "png" : "mp4"}`}
            onClick={(event) => event.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 transition"
          >
            <Download size={13} />
          </a>
        </div>
      ))}
    </div>
  );
};
