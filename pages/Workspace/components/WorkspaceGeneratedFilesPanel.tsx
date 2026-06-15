import React from "react";
import { Download, Video } from "lucide-react";
import type { ChatMessage } from "../../../types";
import { getGeneratedConversationFiles } from "./generatedFiles";

type WorkspaceGeneratedFilesPanelProps = {
  messages: ChatMessage[];
  onPreviewImage: (url: string) => void;
};

export const WorkspaceGeneratedFilesPanel: React.FC<
  WorkspaceGeneratedFilesPanelProps
> = ({ messages, onPreviewImage }) => {
  const files = getGeneratedConversationFiles(messages);

  if (files.length === 0) {
    return <div className="py-16 text-center text-xs text-gray-400">暂无文件</div>;
  }

  return (
    <div className="p-2">
      {[...files].reverse().map((file, index) => (
        <div
          key={`${file.url}-${index}`}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 transition hover:bg-gray-50 group"
          onClick={() =>
            file.type === "image" ? onPreviewImage(file.url) : window.open(file.url)
          }
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-100 bg-gray-50">
            {file.type === "image" ? (
              <img src={file.url} className="h-full w-full object-cover" alt="" />
            ) : (
              <Video size={16} className="text-gray-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-gray-700">
              {file.title}
            </div>
            <div className="mt-0.5 text-[10px] text-gray-400">
              {file.model} 路{" "}
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
            className="text-gray-400 opacity-0 transition group-hover:opacity-100 hover:text-gray-700"
          >
            <Download size={13} />
          </a>
        </div>
      ))}
    </div>
  );
};
