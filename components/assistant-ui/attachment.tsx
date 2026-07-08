"use client";

import { type FC, type PropsWithChildren, useEffect, useState } from "react";
import { FileText, PlusIcon, XIcon } from "lucide-react";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  type CompleteAttachment,
  type Attachment,
  type AttachmentStatus,
} from "@assistant-ui/react";

import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type AttachmentStatusInfo = {
  label: string;
  className: string;
  progress?: number | undefined;
};

const getAttachmentStatusInfo = (
  status: AttachmentStatus,
): AttachmentStatusInfo | null => {
  switch (status.type) {
    case "running":
      return {
        label: "Uploading",
        className:
          "bg-blue-600 text-white dark:bg-blue-500 dark:text-white",
        progress: Number.isFinite(status.progress)
          ? Math.max(0, Math.min(1, Number(status.progress)))
          : undefined,
      };
    case "requires-action":
      return {
        label: status.reason === "composer-send" ? "Ready" : "Action needed",
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100",
      };
    case "incomplete":
      return {
        label: status.reason === "upload-paused" ? "Paused" : "Failed",
        className:
          "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-100",
      };
    default:
      return null;
  }
};

const useFileSrc = (file: File | undefined) => {
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!file) {
      setSrc(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return src;
};

const getAttachmentFileMediaType = (part: Record<string, unknown>): string =>
  String(part.mimeType || part.mediaType || part.contentType || "").toLowerCase();

const getAttachmentFileUrl = (part: Record<string, unknown>): string =>
  String(part.data || part.url || part.image || "").trim();

const getAttachmentContentImageSrc = (attachment: Attachment): string | undefined => {
  if (attachment.type !== "image") return undefined;
  const imagePart = attachment.content?.find((item) => item.type === "image");
  if (imagePart?.type === "image") return imagePart.image;

  const filePart = attachment.content?.find(
    (item) =>
      item.type === "file" &&
      getAttachmentFileMediaType(item as Record<string, unknown>).startsWith("image/"),
  );
  return filePart?.type === "file"
    ? getAttachmentFileUrl(filePart as Record<string, unknown>)
    : undefined;
};

const useAttachmentSrc = (attachment: Attachment) => {
  const file = attachment.type === "image" ? attachment.file : undefined;
  const src = getAttachmentContentImageSrc(attachment);

  return useFileSrc(file) ?? src;
};

const AttachmentPreview: FC<{ src: string }> = ({ src }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <img
      src={src}
      alt="Attachment preview"
      className={cn(
        "block h-auto max-h-[80vh] w-auto max-w-full object-contain",
        isLoaded
          ? "aui-attachment-preview-image-loaded"
          : "aui-attachment-preview-image-loading invisible",
      )}
      onLoad={() => setIsLoaded(true)}
    />
  );
};

const AttachmentPreviewDialog: FC<PropsWithChildren<{ src?: string }>> = ({
  children,
  src,
}) => {

  if (!src) return children;

  return (
    <Dialog>
      <DialogTrigger
        className="aui-attachment-preview-trigger hover:bg-accent/50 cursor-pointer transition-colors"
        asChild
      >
        {children}
      </DialogTrigger>
      <DialogContent className="aui-attachment-preview-dialog-content [&>button]:bg-foreground/60 [&_svg]:text-background [&>button]:hover:[&_svg]:text-destructive p-2 sm:max-w-3xl [&>button]:rounded-full [&>button]:p-1 [&>button]:opacity-100 [&>button]:ring-0!">
        <DialogTitle className="aui-sr-only sr-only">
          Image Attachment Preview
        </DialogTitle>
        <div className="aui-attachment-preview bg-background relative mx-auto flex max-h-[80dvh] w-full items-center justify-center overflow-hidden">
          <AttachmentPreview src={src} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AttachmentThumb: FC<{ src?: string }> = ({ src }) => {
  return (
    <Avatar className="aui-attachment-tile-avatar h-full w-full rounded-none">
      <AvatarImage
        src={src}
        alt="Attachment preview"
        className="aui-attachment-tile-image object-cover"
      />
      <AvatarFallback>
        <FileText className="aui-attachment-tile-fallback-icon text-muted-foreground size-8" />
      </AvatarFallback>
    </Avatar>
  );
};

const getAttachmentTypeLabel = (attachment: Attachment): string => {
  switch (attachment.type) {
    case "image":
      return "Image";
    case "document":
      return "Document";
    case "file":
      return "File";
    default:
      return attachment.type;
  }
};

const AttachmentUI: FC<{
  attachment: Attachment;
  isComposer: boolean;
}> = ({ attachment, isComposer }) => {
  const isImage = attachment.type === "image";
  const status = attachment.status;
  const statusInfo = getAttachmentStatusInfo(status);
  const typeLabel = getAttachmentTypeLabel(attachment);
  const src = useAttachmentSrc(attachment);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <AttachmentPrimitive.Root
          className={cn(
            "aui-attachment-root relative",
            isImage &&
              !isComposer &&
              "aui-attachment-root-message only:*:first:size-24",
          )}
        >
          <AttachmentPreviewDialog src={src}>
            <TooltipTrigger asChild>
              <div
                className="aui-attachment-tile bg-muted relative size-14 cursor-pointer overflow-hidden rounded-[calc(var(--composer-radius)-var(--composer-padding))] border transition-opacity hover:opacity-75"
                role="button"
                tabIndex={0}
                aria-label={`${typeLabel} attachment`}
              >
                <AttachmentThumb src={src} />
                {statusInfo ? (
                  <span
                    className={cn(
                      "aui-attachment-status absolute inset-x-1 bottom-1 rounded-full px-1.5 py-0.5 text-center text-[10px] font-medium leading-none shadow-sm",
                      statusInfo.className,
                    )}
                  >
                    {statusInfo.progress !== undefined
                      ? `${Math.round(statusInfo.progress * 100)}%`
                      : statusInfo.label}
                  </span>
                ) : null}
              </div>
            </TooltipTrigger>
          </AttachmentPreviewDialog>
          {isComposer ? <AttachmentRemove /> : null}
        </AttachmentPrimitive.Root>
        <TooltipContent side="top">
          <AttachmentPrimitive.Name />
          {statusInfo ? (
            <span className="aui-attachment-status-tooltip text-muted-foreground ml-1">
              - {statusInfo.label}
            </span>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const renderUserMessageAttachment = ({
  attachment,
}: {
  attachment: CompleteAttachment;
}) => <AttachmentUI attachment={attachment} isComposer={false} />;

const renderComposerAttachment = ({ attachment }: { attachment: Attachment }) => (
  <AttachmentUI attachment={attachment} isComposer />
);

const AttachmentRemove: FC = () => {
  return (
    <AttachmentPrimitive.Remove asChild>
      <TooltipIconButton
        tooltip="Remove file"
        side="top"
        className="aui-attachment-tile-remove text-muted-foreground hover:[&_svg]:text-destructive absolute end-1.5 top-1.5 size-3.5 rounded-full bg-white opacity-100 shadow-sm hover:bg-white! [&_svg]:text-black"
      >
        <XIcon className="aui-attachment-remove-icon size-3 dark:stroke-[2.5px]" />
      </TooltipIconButton>
    </AttachmentPrimitive.Remove>
  );
};

export const UserMessageAttachments: FC = () => {
  return (
    <div className="aui-user-message-attachments-end flex w-full flex-row flex-wrap justify-end gap-2 empty:hidden">
      <MessagePrimitive.Attachments>
        {renderUserMessageAttachment}
      </MessagePrimitive.Attachments>
    </div>
  );
};

export const ComposerAttachments: FC = () => {
  return (
    <div className="aui-composer-attachments flex w-full flex-row items-center gap-2 overflow-x-auto empty:hidden">
      <ComposerPrimitive.Attachments>
        {renderComposerAttachment}
      </ComposerPrimitive.Attachments>
    </div>
  );
};

export const ComposerAddAttachment: FC = () => {
  return (
    <ComposerPrimitive.AddAttachment asChild>
      <TooltipIconButton
        tooltip="Add Attachment"
        side="bottom"
        variant="ghost"
        size="icon"
        className="aui-composer-add-attachment hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30 size-7 rounded-full p-1 text-xs font-semibold"
        aria-label="Add Attachment"
      >
        <PlusIcon className="aui-attachment-add-icon size-4.5 stroke-[1.5px]" />
      </TooltipIconButton>
    </ComposerPrimitive.AddAttachment>
  );
};
