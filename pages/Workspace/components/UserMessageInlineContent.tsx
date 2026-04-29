import React from "react";
import type { ChatMessage } from "../../../types";

type UserMessageInlineContentProps = {
  inlineParts: NonNullable<ChatMessage["inlineParts"]>;
  onPreview?: (url: string) => void;
  textClassName?: string;
};

export const UserMessageInlineContent: React.FC<UserMessageInlineContentProps> = ({
  inlineParts,
  onPreview,
  textClassName = "text-[14px] text-gray-800",
}) => {
  if (!inlineParts || inlineParts.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-start content-start gap-[4px] leading-6">
      {inlineParts.map((part, index) =>
        part.type === "text" ? (
          <span
            key={`inline-text-${index}`}
            className={`${textClassName} whitespace-pre-wrap break-words leading-6`}
          >
            {part.text}
          </span>
        ) : (
          <button
            key={`inline-attachment-${index}`}
            type="button"
            onClick={() => onPreview?.(part.url)}
            title={part.label}
            className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white pl-[2px] pr-2 py-[2px] shadow-sm transition hover:bg-gray-50"
          >
            <div className="h-5 w-5 overflow-hidden rounded-full border border-gray-100 bg-white">
              <img
                src={part.url}
                alt={part.label}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="max-w-[120px] truncate text-[11px] font-semibold text-gray-700">
              {part.label}
            </span>
          </button>
        ),
      )}
    </div>
  );
};
