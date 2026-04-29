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
          className="inline-flex items-center gap-1 rounded-full pl-[2px] pr-1 select-none relative h-6 cursor-default transition-all border border-dashed border-blue-300 bg-blue-50/50 shrink-0 opacity-60 hover:opacity-100 group/pending"
        >
          <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 border border-blue-200 shadow-sm">
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
          <span className="text-[11px] text-blue-700 font-bold max-w-[100px] truncate ml-0.5">
            待确认
          </span>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onRemovePendingAttachment(pending.id);
            }}
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-blue-400 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover/pending:opacity-100"
          >
            <X size={10} />
          </button>
        </div>
      ))}
    </>
  );
};
