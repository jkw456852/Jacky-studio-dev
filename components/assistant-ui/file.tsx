"use client";

import { memo } from "react";
import { DownloadIcon, FileTextIcon } from "lucide-react";
import type {
  FileMessagePart,
  FileMessagePartComponent,
} from "@assistant-ui/react";

import { Image as AssistantImage } from "@/components/assistant-ui/image";
import { cn } from "@/lib/utils";

const extensionForMimeType = (mimeType?: string): string => {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    case "application/pdf":
      return "pdf";
    default:
      return "file";
  }
};

const isImageFile = (mimeType?: string): boolean =>
  String(mimeType || "").toLowerCase().startsWith("image/");

const getFileMediaType = (part: FileMessagePart): string | undefined => {
  const record = part as FileMessagePart & { mediaType?: string };
  return part.mimeType || record.mediaType;
};

const getFileData = (part: FileMessagePart): string => {
  const record = part as FileMessagePart & { url?: string; image?: string };
  return part.data || record.url || record.image || "";
};

const getFileName = (part: FileMessagePart) =>
  part.filename || `file.${extensionForMimeType(getFileMediaType(part))}`;

const FileImpl: FileMessagePartComponent = (part) => {
  const mimeType = getFileMediaType(part);
  const data = getFileData(part);

  if (isImageFile(mimeType) && data) {
    return (
      <AssistantImage
        type="image"
        image={data}
        filename={getFileName(part)}
        status={{ type: "complete" }}
      />
    );
  }

  const filename = getFileName(part);

  return (
    <a
      data-slot="file-root"
      className={cn(
        "aui-file-root border-border bg-muted/35 hover:bg-muted/60 my-2 flex max-w-md items-center gap-3 rounded-2xl border px-3 py-2 text-sm transition-colors",
        "text-[#1f1f1f] dark:text-[#e3e3e3]",
      )}
      href={data}
      download={filename}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="bg-background flex size-9 shrink-0 items-center justify-center rounded-xl border">
        <FileTextIcon className="text-muted-foreground size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{filename}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {mimeType || "file"}
        </span>
      </span>
      <DownloadIcon className="text-muted-foreground size-4 shrink-0" />
    </a>
  );
};

const File = memo(FileImpl) as FileMessagePartComponent;
File.displayName = "File";

export { File };
