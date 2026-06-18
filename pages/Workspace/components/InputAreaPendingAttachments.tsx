import React from 'react';
import { FileText, Image as ImageIcon, X } from 'lucide-react';
import type { WorkspaceInputFile } from '../../../types';

type PendingAttachment = {
  id: string;
  file: WorkspaceInputFile;
};

type InputAreaPendingAttachmentsProps = {
  pendingAttachments: PendingAttachment[];
  getObjectUrl: (file?: File | null) => string;
  onRemovePendingAttachment: (id: string) => void;
};

export const InputAreaPendingAttachments: React.FC<
  InputAreaPendingAttachmentsProps
> = ({ pendingAttachments, getObjectUrl, onRemovePendingAttachment }) => {
  return (
    <>
      {pendingAttachments.map((pending) => (
        <div
          key={pending.id}
          className="group/pending relative inline-flex h-8 shrink-0 cursor-default select-none items-center gap-1 rounded-full border border-dashed border-blue-300 bg-blue-50/50 pl-[3px] pr-2 opacity-60 transition-all hover:opacity-100"
          style={
            pending.file._pendingPreviewRect
              ? {
                  position: 'absolute',
                  left: pending.file._pendingPreviewRect.left,
                  top:
                    pending.file._pendingPreviewRect.top +
                    Math.max(pending.file._pendingPreviewRect.height, 22) +
                    6,
                  zIndex: 4,
                }
              : undefined
          }
        >
          <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full border border-blue-200 shadow-sm">
            {pending.file._canvasAutoInsert ? (
              <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600">
                <ImageIcon size={10} />
              </div>
            ) : pending.file.type.startsWith('image/') ? (
              <img
                src={pending.file._chipPreviewUrl || getObjectUrl(pending.file)}
                className="w-full h-full object-cover"
              />
            ) : (
              <FileText size={10} className="text-blue-500" />
            )}
          </div>
          <span className="ml-0.5 max-w-[108px] truncate text-[12px] font-semibold text-blue-700">
            待确认
          </span>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onRemovePendingAttachment(pending.id);
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full text-blue-400 opacity-0 transition group-hover/pending:opacity-100 hover:bg-red-50 hover:text-red-500"
          >
            <X size={10} />
          </button>
        </div>
      ))}
    </>
  );
};
