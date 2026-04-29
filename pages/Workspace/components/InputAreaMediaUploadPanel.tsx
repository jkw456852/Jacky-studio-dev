import React from 'react';
import { Plus, X } from 'lucide-react';

type InputAreaMediaUploadPanelProps = {
  creationMode: 'agent' | 'image' | 'video';
  isVideoPanelHovered: boolean;
  imageGenUploads: File[];
  isPickingFromCanvas: boolean;
  videoStartFrame: File | null;
  videoEndFrame: File | null;
  videoMultiRefs: File[];
  videoGenMode: 'startEnd' | 'multiRef';
  isSoraVideoModel: boolean;
  getObjectUrl: (file?: File | null) => string;
  handlePickedFiles: (files: File[]) => void;
  setImageGenUploads: (files: File[]) => void;
  setIsPickingFromCanvas: (picking: boolean) => void;
  setVideoStartFrame: (file: File | null) => void;
  setVideoEndFrame: (file: File | null) => void;
  setVideoMultiRefs: (files: File[]) => void;
};

export const InputAreaMediaUploadPanel: React.FC<
  InputAreaMediaUploadPanelProps
> = ({
  creationMode,
  isVideoPanelHovered,
  imageGenUploads,
  isPickingFromCanvas,
  videoStartFrame,
  videoEndFrame,
  videoMultiRefs,
  videoGenMode,
  isSoraVideoModel,
  getObjectUrl,
  handlePickedFiles,
  setImageGenUploads,
  setIsPickingFromCanvas,
  setVideoStartFrame,
  setVideoEndFrame,
  setVideoMultiRefs,
}) => {
  if (creationMode === 'image') {
    return (
      <div
        className="transition-all duration-300 overflow-visible px-4 flex flex-col justify-end"
        style={{
          maxHeight: isVideoPanelHovered ? '92px' : '0px',
          opacity: isVideoPanelHovered ? 1 : 0,
          paddingTop: isVideoPanelHovered ? '16px' : '0px',
          paddingBottom: isVideoPanelHovered ? '4px' : '0px',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.multiple = true;
                input.onchange = (event) => {
                  const files = Array.from(
                    (event.target as HTMLInputElement).files || [],
                  );
                  if (files.length > 0) {
                    handlePickedFiles(files);
                  }
                };
                input.click();
              }}
              className={`w-[72px] h-[72px] border border-dashed border-gray-200 rounded-[14px] flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition group/upload bg-gray-50/50 ${
                isPickingFromCanvas ? 'border-blue-400 bg-blue-50/40' : ''
              }`}
            >
              <Plus
                size={20}
                strokeWidth={1.5}
                className="text-gray-300 group-hover/upload:text-blue-500 transition mb-1"
              />
              <span className="text-[12px] font-bold text-gray-400 group-hover/upload:text-blue-500 transition">
                图片
              </span>
            </div>
          </div>

          {imageGenUploads.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="relative w-[72px] h-[72px] border border-gray-200 rounded-[14px] overflow-visible shadow-sm shrink-0 bg-white"
            >
              <img
                src={getObjectUrl(file)}
                className="w-full h-full object-cover rounded-[14px]"
              />
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setImageGenUploads(
                    imageGenUploads.filter((_, index) => index !== idx),
                  );
                  setIsPickingFromCanvas(false);
                }}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-black/80 hover:bg-black text-white rounded-full flex items-center justify-center z-10 shadow-sm border border-white/20"
              >
                <X size={10} />
              </button>
            </div>
          ))}

          {isPickingFromCanvas && (
            <div className="text-[11px] text-blue-600 font-medium bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
              请在画布中点击一张图片
            </div>
          )}
        </div>
      </div>
    );
  }

  if (creationMode !== 'video') {
    return null;
  }

  const isExpanded =
    isVideoPanelHovered ||
    Boolean(videoStartFrame) ||
    Boolean(videoEndFrame) ||
    videoMultiRefs.length > 0;

  return (
    <div
      className="px-4 transition-all duration-300 overflow-hidden flex flex-col justify-end"
      style={{
        maxHeight: isExpanded ? '140px' : '0px',
        opacity: isExpanded ? 1 : 0,
        paddingTop: isExpanded ? '20px' : '0px',
        paddingBottom: isExpanded ? '10px' : '0px',
      }}
    >
      {isSoraVideoModel ? (
        <div className="flex items-center gap-4">
          <div className="relative">
            <label
              className={`w-[72px] h-[72px] border rounded-[14px] flex flex-col items-center justify-center cursor-pointer transition overflow-hidden group/upload ${
                videoStartFrame
                  ? 'border-gray-200 border-solid shadow-sm'
                  : 'border border-dashed border-gray-200 bg-gray-50/50 hover:border-blue-400 hover:bg-blue-50/30'
              }`}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  if (event.target.files?.[0]) {
                    setVideoStartFrame(event.target.files[0]);
                    setVideoEndFrame(null);
                    setVideoMultiRefs([]);
                  }
                }}
              />
              {videoStartFrame ? (
                <img
                  src={getObjectUrl(videoStartFrame)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  <Plus
                    size={20}
                    strokeWidth={1.5}
                    className="text-gray-300 group-hover/upload:text-blue-500 transition mb-1"
                  />
                  <span className="text-[12px] font-bold text-gray-400 group-hover/upload:text-blue-500 transition">
                    参考图
                  </span>
                </>
              )}
            </label>
            {videoStartFrame && (
              <button
                onClick={(event) => {
                  event.preventDefault();
                  setVideoStartFrame(null);
                }}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-black/80 hover:bg-black text-white rounded-full flex items-center justify-center z-10 shadow-sm border border-white/20"
              >
                <X size={10} />
              </button>
            )}
          </div>
          <div className="text-[11px] leading-relaxed text-gray-500 font-medium max-w-[180px]">
            Sora 2 仅支持单张参考图，并限制为横版/竖版与 10s/15s。
          </div>
        </div>
      ) : videoGenMode === 'startEnd' ? (
        <div className="flex items-center gap-4">
          <div className="relative">
            <label
              className={`w-[72px] h-[72px] border rounded-[14px] flex flex-col items-center justify-center cursor-pointer transition overflow-hidden group/upload ${
                videoStartFrame
                  ? 'border-gray-200 border-solid shadow-sm'
                  : 'border border-dashed border-gray-200 bg-gray-50/50 hover:border-blue-400 hover:bg-blue-50/30'
              }`}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  if (event.target.files?.[0]) {
                    setVideoStartFrame(event.target.files[0]);
                  }
                }}
              />
              {videoStartFrame ? (
                <img
                  src={getObjectUrl(videoStartFrame)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  <Plus
                    size={20}
                    strokeWidth={1.5}
                    className="text-gray-300 group-hover/upload:text-blue-500 transition mb-1"
                  />
                  <span className="text-[12px] font-bold text-gray-400 group-hover/upload:text-blue-500 transition">
                    首帧
                  </span>
                </>
              )}
            </label>
            {videoStartFrame && (
              <button
                onClick={(event) => {
                  event.preventDefault();
                  setVideoStartFrame(null);
                }}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-black/80 hover:bg-black text-white rounded-full flex items-center justify-center z-10 shadow-sm border border-white/20"
              >
                <X size={10} />
              </button>
            )}
          </div>
          <div className="relative">
            <label
              className={`w-[72px] h-[72px] border rounded-[14px] flex flex-col items-center justify-center cursor-pointer transition overflow-hidden group/upload ${
                videoEndFrame
                  ? 'border-gray-200 border-solid shadow-sm'
                  : 'border border-dashed border-gray-200 bg-gray-50/50 hover:border-blue-400 hover:bg-blue-50/30'
              }`}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  if (event.target.files?.[0]) {
                    setVideoEndFrame(event.target.files[0]);
                  }
                }}
              />
              {videoEndFrame ? (
                <img
                  src={getObjectUrl(videoEndFrame)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  <Plus
                    size={20}
                    strokeWidth={1.5}
                    className="text-gray-300 group-hover/upload:text-blue-500 transition mb-1"
                  />
                  <span className="text-[12px] font-bold text-gray-400 group-hover/upload:text-blue-500 transition">
                    尾帧
                  </span>
                </>
              )}
            </label>
            {videoEndFrame && (
              <button
                onClick={(event) => {
                  event.preventDefault();
                  setVideoEndFrame(null);
                }}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-black/80 hover:bg-black text-white rounded-full flex items-center justify-center z-10 shadow-sm border border-white/20"
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 overflow-x-auto scroller-hidden">
          {videoMultiRefs.map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="relative flex-shrink-0">
              <div className="w-14 h-14 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <img
                  src={getObjectUrl(file)}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() =>
                  setVideoMultiRefs(
                    videoMultiRefs.filter((_, index) => index !== idx),
                  )
                }
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-600 hover:bg-gray-800 text-white rounded-full flex items-center justify-center z-10 shadow border border-white"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <label className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition flex-shrink-0 group">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) {
                  setVideoMultiRefs([
                    ...videoMultiRefs,
                    ...Array.from(event.target.files),
                  ]);
                }
              }}
            />
            <Plus size={16} className="group-hover:text-blue-500 transition" />
          </label>
        </div>
      )}
    </div>
  );
};
