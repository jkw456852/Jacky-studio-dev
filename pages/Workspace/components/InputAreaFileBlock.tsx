import React from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import { FileText, X } from 'lucide-react';
import type { InputBlock, Marker, WorkspaceInputFile } from '../../../types';

type InputAreaFileBlockProps = {
  block: InputBlock & { type: 'file'; file: WorkspaceInputFile };
  inputBlocks: InputBlock[];
  markers: Marker[];
  isSelected: boolean;
  isHovered: boolean;
  isAllInputSelected: boolean;
  isInputFocused: boolean;
  getObjectUrl: (file?: File | null) => string;
  onSelectChip: (blockId: string) => void;
  onHoverChip: (blockId: string | null) => void;
  onBeginEditMarker: (markerId: string, label: string) => void;
  onRemove: (blockId: string) => void;
};

export const InputAreaFileBlock: React.FC<InputAreaFileBlockProps> = ({
  block,
  inputBlocks,
  markers,
  isSelected,
  isHovered,
  isAllInputSelected,
  isInputFocused,
  getObjectUrl,
  onSelectChip,
  onHoverChip,
  onBeginEditMarker,
  onRemove,
}) => {
  const file = block.file;
  const markerId = file.markerId;
  const markerInfo = file.markerInfo;

  if (markerId) {
    return (
      <motion.div
        key={block.id}
        id={`marker-chip-${block.id}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`relative inline-flex h-8 cursor-default select-none items-center gap-1 rounded-full border pl-[3px] pr-2 transition-all ${
          isAllInputSelected || isSelected
            ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-400'
            : 'bg-gray-50/50 border-gray-100 hover:bg-gray-100'
        }`}
        onClick={(event) => {
          event.stopPropagation();
          if (isSelected) {
            onBeginEditMarker(markerId, file.markerName || '');
            return;
          }
          onSelectChip(block.id);
        }}
        onMouseEnter={() => onHoverChip(block.id)}
        onMouseLeave={() => onHoverChip(null)}
      >
        <div className="flex flex-shrink-0 items-center -space-x-1.5">
          <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full border border-gray-100 shadow-sm">
            <img src={getObjectUrl(file)} className="w-full h-full object-cover" />
          </div>
          <div className="z-10 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-white bg-[#3B82F6] text-[9px] font-black text-white shadow-sm">
            {markers.findIndex((marker) => marker.id === markerId) + 1 || '?'}
          </div>
        </div>
        <span className="ml-0.5 max-w-[96px] truncate text-[12px] font-semibold text-gray-700">
          {file.markerName || '区域'}
        </span>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onRemove(block.id);
          }}
          className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
        >
          <X size={10} />
        </button>

        {isHovered && markerInfo && (() => {
          const maxSize = 220;
          const ratio = markerInfo.imageWidth / markerInfo.imageHeight;
          let renderWidth = maxSize;
          let renderHeight = maxSize;

          if (ratio > 1) {
            renderHeight = maxSize / ratio;
          } else {
            renderWidth = maxSize * ratio;
          }

          const chipRect = document
            .getElementById(`marker-chip-${block.id}`)
            ?.getBoundingClientRect();

          return ReactDOM.createPortal(
            <div
              className="fixed z-[9999] pointer-events-none"
              style={{
                left:
                  (chipRect?.left || 0) +
                  (chipRect?.width || 0) / 2 -
                  renderWidth / 2,
                top: (chipRect?.top || 0) - renderHeight - 12,
                width: renderWidth,
                height: renderHeight,
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full bg-white rounded-2xl shadow-xl overflow-hidden relative border border-gray-200"
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
                    src={markerInfo.fullImageUrl || getObjectUrl(file)}
                    className="w-full h-full object-cover"
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
                      <div className="w-[28px] h-[28px] rounded-full bg-[#3B82F6] border-2 border-white flex items-center justify-center text-white font-bold text-[12px] relative z-10 shadow-lg">
                        {markers.findIndex((marker) => marker.id === markerId) + 1}
                      </div>
                      <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-[#3B82F6] -mt-[1px]" />
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>
            </div>,
            document.body,
          );
        })()}
      </motion.div>
    );
  }

  const isCanvasAuto = file._canvasAutoInsert;
  const chipLabel = isCanvasAuto
    ? `图片${
        inputBlocks.filter(
          (item) => item.type === 'file' && item.file?._canvasAutoInsert,
        ).indexOf(block) + 1
      }`
    : file.name.replace(/\.[^/.]+$/, '');
  const imageWidth = Number(file._canvasWidth || file._canvasW || 0);
  const imageHeight = Number(file._canvasHeight || file._canvasH || 0);
  const hasValidAspect = imageWidth > 0 && imageHeight > 0;
  const chipPreviewUrl =
    file._chipPreviewUrl || (file._chipPreviewUrl = getObjectUrl(file));

  return (
    <div
      key={block.id}
      id={`file-chip-${block.id}`}
      className={`relative inline-flex h-8 shrink-0 cursor-default select-none items-center gap-1 rounded-full border pl-[3px] pr-2 transition-all ${
        isAllInputSelected || isSelected
          ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-400'
          : isInputFocused
            ? 'bg-blue-50/30 border-blue-100'
            : 'bg-gray-50/50 border-gray-100 hover:bg-gray-100'
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onSelectChip(block.id);
      }}
      onMouseEnter={() => onHoverChip(block.id)}
      onMouseLeave={() => onHoverChip(null)}
    >
      <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full border border-gray-100 shadow-sm">
        {file.type.startsWith('image/') ? (
          <img src={chipPreviewUrl} className="w-full h-full object-cover" />
        ) : (
          <FileText size={10} className="text-gray-500" />
        )}
      </div>
      <span className="ml-0.5 max-w-[108px] truncate text-[12px] font-semibold text-gray-700">
        {chipLabel}
      </span>
      <button
        onClick={(event) => {
          event.stopPropagation();
          onRemove(block.id);
        }}
        className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
      >
        <X size={10} />
      </button>

      {isHovered &&
        file.type.startsWith('image/') &&
        (() => {
          const chipRect = document
            .getElementById(`file-chip-${block.id}`)
            ?.getBoundingClientRect();
          if (!chipRect) return null;

          const maxSize = 220;
          const ratio = hasValidAspect ? imageWidth / imageHeight : 1;
          const renderWidth = ratio > 1 ? maxSize : Math.max(120, maxSize * ratio);
          const renderHeight =
            ratio > 1 ? Math.max(120, maxSize / ratio) : maxSize;

          return ReactDOM.createPortal(
            <div
              className="fixed z-[9999] pointer-events-none"
              style={{
                left: chipRect.left + chipRect.width / 2 - renderWidth / 2,
                top: chipRect.top - renderHeight - 12,
                width: renderWidth,
                height: renderHeight,
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full h-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200"
              >
                <img src={chipPreviewUrl} className="w-full h-full object-cover" />
              </motion.div>
            </div>,
            document.body,
          );
        })()}
    </div>
  );
};
