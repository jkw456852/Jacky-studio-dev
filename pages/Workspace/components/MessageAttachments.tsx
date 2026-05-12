import React from 'react';
import { motion } from 'framer-motion';
import ReactDOM from 'react-dom';
import type { WorkspaceMarkerInfo } from '../../../types';
import { getRenderableImageAssetUrl } from '../workspaceShared';

type MessageAttachmentMetadata = {
  markerName?: string;
  markerInfo?: WorkspaceMarkerInfo;
};

interface MessageAttachmentsProps {
  attachments?: string[];
  attachmentMetadata?: MessageAttachmentMetadata[];
  onPreview?: (url: string) => void;
}

export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({
  attachments,
  attachmentMetadata,
  onPreview,
}) => {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mb-1 flex flex-wrap items-center gap-1.5">
      {attachments.map((url, index) => {
        const metadata = attachmentMetadata?.[index];
        const isMarker = !!metadata?.markerInfo;
        const previewUrl = getRenderableImageAssetUrl(url);
        const markerPreviewUrl = getRenderableImageAssetUrl(
          metadata?.markerInfo?.fullImageUrl,
        );
        const renderUrl = markerPreviewUrl || previewUrl;

        if (!previewUrl) {
          return null;
        }

        return (
          <div key={`${url}-${index}`} className="relative group/chip">
            <button
              id={`msg-chip-${index}`}
              type="button"
              onClick={() => onPreview?.(previewUrl)}
              onMouseEnter={() => setHoveredIdx(index)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-gray-100 bg-white py-0.5 pl-1 pr-2 shadow-sm transition duration-200 hover:bg-gray-50"
              title={metadata?.markerName || `参考内容 ${index + 1}`}
            >
              <div className="h-5 w-5 flex-shrink-0 overflow-hidden rounded-sm bg-white">
                <img src={previewUrl} className="h-full w-full object-cover" />
              </div>
              <span className="text-[11px] font-medium text-gray-600">
                {metadata?.markerName || `参考内容 ${index + 1}`}
              </span>
            </button>

            {hoveredIdx === index &&
            isMarker &&
            metadata?.markerInfo &&
            renderUrl &&
            (() => {
              const markerInfo = metadata.markerInfo;
              const maxSize = 220;
              const ratio = markerInfo.imageWidth / markerInfo.imageHeight;
              let renderWidth = maxSize;
              let renderHeight = maxSize;

              if (ratio > 1) {
                renderHeight = maxSize / ratio;
              } else {
                renderWidth = maxSize * ratio;
              }

              const chipEl = document.getElementById(`msg-chip-${index}`);
              const chipRect = chipEl?.getBoundingClientRect();
              if (!chipRect) return null;

              return ReactDOM.createPortal(
                <div
                  className="pointer-events-none fixed z-[9999]"
                  style={{
                    left: chipRect.left + chipRect.width / 2 - renderWidth / 2,
                    top: chipRect.top + chipRect.height + 8,
                    width: renderWidth,
                    height: renderHeight,
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="relative h-full w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
                  >
                    <motion.div
                      className="absolute inset-0"
                      initial={{ scale: 1 }}
                      animate={{ scale: 3 }}
                      transition={{
                        delay: 0.5,
                        duration: 0.8,
                        ease: [0.25, 0.1, 0.25, 1],
                      }}
                      style={{
                        transformOrigin: `${((markerInfo.x + markerInfo.width / 2) / markerInfo.imageWidth) * 100}% ${((markerInfo.y + markerInfo.height / 2) / markerInfo.imageHeight) * 100}%`,
                      }}
                    >
                      <img
                        src={renderUrl}
                        className="h-full w-full object-cover"
                      />
                      <div
                        className="absolute"
                        style={{
                          left: `${((markerInfo.x + markerInfo.width / 2) / markerInfo.imageWidth) * 100}%`,
                          top: `${((markerInfo.y + markerInfo.height / 2) / markerInfo.imageHeight) * 100}%`,
                          transform: 'translate(-50%, -100%)',
                          transformOrigin: 'bottom center',
                        }}
                      >
                        <motion.div
                          className="relative flex flex-col items-center"
                          initial={{ scale: 1, opacity: 0 }}
                          animate={{ scale: 0.333, opacity: 1 }}
                          transition={{
                            delay: 0.5,
                            duration: 0.8,
                            ease: [0.25, 0.1, 0.25, 1],
                          }}
                          style={{ transformOrigin: 'bottom center' }}
                        >
                          <div className="relative z-10 flex h-[28px] w-[28px] items-center justify-center rounded-full border-2 border-white bg-[#3B82F6] text-[12px] font-bold text-white shadow-lg">
                            {index + 1}
                          </div>
                          <div className="-mt-[1px] h-0 w-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#3B82F6]"></div>
                        </motion.div>
                      </div>
                    </motion.div>
                  </motion.div>
                </div>,
                document.body,
              );
            })()}
          </div>
        );
      })}
    </div>
  );
};
