import React from "react";
import {
  Download,
  File as FileIcon,
  Image as ImageIcon,
  Video,
} from "lucide-react";
import type { ChatMessage } from "../../../types";
import { getGeneratedConversationFiles } from "./generatedFiles";

type AssistantSidebarFilesPopoverProps = {
  open: boolean;
  messages: ChatMessage[];
  onPreview: (url: string) => void;
  onToggle: () => void;
};

export const AssistantSidebarFilesPopover: React.FC<
  AssistantSidebarFilesPopoverProps
> = ({ open, messages, onPreview, onToggle }) => {
  const files = getGeneratedConversationFiles(messages);
  const fileCount = files.length;

  return (
    <div className="relative">
      <button
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
          open
            ? "bg-gray-100 text-gray-700"
            : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        }`}
        title="查看产出"
        aria-label="查看产出"
      >
        <FileIcon size={15} strokeWidth={1.5} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[320px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">本次产出</h3>
            <span className="text-[10px] text-gray-400">{fileCount} 个文件</span>
          </div>
          {files.length === 0 ? (
            <div className="flex h-[250px] flex-col items-center justify-center gap-2 text-gray-400">
              <ImageIcon size={28} className="opacity-20" />
              <span className="text-xs text-gray-500">
                当前对话还没有产出文件
              </span>
            </div>
          ) : (
            <div className="max-h-[350px] space-y-1 overflow-y-auto p-2 no-scrollbar">
              {[...files].reverse().map((file, index) => (
                <div
                  key={`${file.url}-${index}`}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 transition hover:bg-gray-50 group"
                  onClick={() =>
                    file.type === "image" ? onPreview(file.url) : window.open(file.url)
                  }
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-100 bg-gray-50">
                    {file.type === "image" ? (
                      <img
                        src={file.url}
                        className="h-full w-full object-cover"
                        alt=""
                      />
                    ) : (
                      <Video size={16} className="text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-gray-700">
                      {file.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-400">
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
                  <a
                    href={file.url}
                    download={`${file.title}.${file.type === "image" ? "png" : "mp4"}`}
                    onClick={(event) => event.stopPropagation()}
                    className="text-gray-400 opacity-0 transition group-hover:opacity-100 hover:text-gray-700"
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
