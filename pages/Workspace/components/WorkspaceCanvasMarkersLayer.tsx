import React, { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Image as ImageIcon, MapPin, X } from "lucide-react";
import type { CanvasElement, InputBlock, Marker } from "../../../types";

type MarkerDragOffsetsRef = React.MutableRefObject<
  Record<string, { x: number; y: number }>
>;

type WorkspaceCanvasMarkersLayerProps = {
  markers: Marker[];
  elementById: Map<string, CanvasElement>;
  isDraggingElement: boolean;
  dragOffsetsRef: MarkerDragOffsetsRef;
  zoom: number;
  hoveredChipId: string | null;
  inputBlocks: InputBlock[];
  editingMarkerId: string | null;
  setEditingMarkerId: React.Dispatch<React.SetStateAction<string | null>>;
  editingMarkerLabel: string;
  setEditingMarkerLabel: React.Dispatch<React.SetStateAction<string>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  onSaveMarkerLabel: (markerId: string, label: string) => void;
};

export const WorkspaceCanvasMarkersLayer: React.FC<
  WorkspaceCanvasMarkersLayerProps
> = memo(({
  markers,
  elementById,
  isDraggingElement,
  dragOffsetsRef,
  zoom,
  hoveredChipId,
  inputBlocks,
  editingMarkerId,
  setEditingMarkerId,
  editingMarkerLabel,
  setEditingMarkerLabel,
  setZoom,
  onSaveMarkerLabel,
}) => {
  if (markers.length === 0) return null;

  return (
    <AnimatePresence mode="popLayout">
      {markers.map((marker, index) => {
        const element = elementById.get(marker.elementId);
        if (!element) return null;

        const dragPos = isDraggingElement
          ? dragOffsetsRef.current[element.id]
          : null;
        const baseX = dragPos ? dragPos.x : element.x;
        const baseY = dragPos ? dragPos.y : element.y;
        const pixelX = baseX + (element.width * marker.x) / 100;
        const pixelY = baseY + (element.height * marker.y) / 100;

        const isMarkerFileBlock = (block: InputBlock) =>
          block.type === "file" &&
          block.file &&
          (block.file as File & { markerId?: string }).markerId === marker.id;

        const isHoveredInChat =
          hoveredChipId &&
          inputBlocks.some(
            (block) => block.id === hoveredChipId && isMarkerFileBlock(block),
          );

        const inverseScale = 100 / zoom;

        return (
          <div
            key={marker.id}
            style={{
              left: pixelX,
              top: pixelY,
              position: "absolute",
              zIndex:
                editingMarkerId === marker.id
                  ? 2000
                  : isHoveredInChat
                    ? 600
                    : 500,
              transform: `translate(-50%, -100%) scale(${inverseScale})`,
              transformOrigin: "bottom center",
              pointerEvents: "auto",
            }}
            className="group/marker cursor-pointer"
            onMouseDown={(event) => {
              event.stopPropagation();
              setZoom(Math.max(100, zoom));
              setEditingMarkerId(marker.id);
              setEditingMarkerLabel(marker.label || "");
            }}
          >
            <motion.div
              initial={{ scale: 3, opacity: 0 }}
              animate={{
                scale: isHoveredInChat ? 1.2 : 1,
                opacity: 1,
              }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.2 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
              }}
              style={{ transformOrigin: "bottom center" }}
              className="relative flex flex-col items-center"
            >
              <div
                className={`w-[28px] h-[28px] rounded-full bg-[#3B82F6] border-2 border-white flex items-center justify-center text-white font-bold text-[12px] relative z-10 transition-shadow duration-300 ${isHoveredInChat ? "shadow-[0_0_0_5px_rgba(59,130,246,0.35)]" : "shadow-lg"}`}
              >
                {index + 1}
              </div>
              <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-[#3B82F6] -mt-[1px]"></div>
            </motion.div>

            <div className="absolute left-1/2 bottom-[110%] -translate-x-1/2 mb-1 bg-gray-900/90 backdrop-blur-sm px-2.5 py-1.5 rounded-xl shadow-2xl border border-white/10 opacity-0 group-hover/marker:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-[60] scale-90 group-hover/marker:scale-100 origin-bottom">
              <span className="text-[12px] font-bold text-white tracking-wide">
                {marker.label || marker.analysis || "璇嗗埆涓?.."}
              </span>
            </div>

            <AnimatePresence>
              {editingMarkerId === marker.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 5 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 z-[100]"
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <div className="bg-white rounded-[24px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] border border-gray-100 p-4 min-w-[260px] flex flex-col gap-3.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[12px] font-bold text-gray-400/80 tracking-tight">
                        Object Marked
                      </span>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingMarkerId(null);
                        }}
                        className="text-gray-300 hover:text-gray-500 transition p-1 hover:bg-gray-100 rounded-full"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="flex items-center gap-3.5 bg-gray-50/80 rounded-[20px] p-2 pr-4 border border-gray-100/30">
                      {marker.cropUrl ? (
                        <img
                          src={marker.cropUrl}
                          className="w-12 h-12 rounded-[14px] object-cover shadow-sm border border-white"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-[14px] bg-gray-200 flex items-center justify-center">
                          <ImageIcon size={20} className="text-gray-400" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-[15px] font-extrabold text-gray-800 leading-tight">
                          {marker.analysis || "璇嗗埆涓?.."}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 px-0.5">
                      <div className="w-10 h-10 flex items-center justify-center bg-gray-100/80 rounded-[14px] text-gray-400 shrink-0">
                        <MapPin size={20} className="opacity-50" />
                        <div className="absolute w-[8px] h-[1.5px] bg-gray-400/40 bottom-2.5 rounded-full"></div>
                      </div>
                      <div className="flex-1 relative">
                        <input
                          autoFocus
                          className="w-full h-10 pl-3.5 pr-10 bg-white border border-gray-200/80 rounded-[14px] text-[14px] font-bold text-gray-700 outline-none focus:ring-[5px] focus:ring-blue-500/5 focus:border-blue-500/50 transition-all placeholder:text-gray-300"
                          placeholder={marker.analysis || "自定义名称..."}
                          value={editingMarkerLabel}
                          onChange={(event) =>
                            setEditingMarkerLabel(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              onSaveMarkerLabel(marker.id, editingMarkerLabel);
                            } else if (event.key === "Escape") {
                              setEditingMarkerId(null);
                            }
                          }}
                        />
                        <button
                          onClick={() =>
                            onSaveMarkerLabel(marker.id, editingMarkerLabel)
                          }
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors"
                        >
                          <Check size={20} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[12px] border-t-white drop-shadow-[0_8px_8px_rgba(0,0,0,0.05)]"></div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </AnimatePresence>
  );
});
