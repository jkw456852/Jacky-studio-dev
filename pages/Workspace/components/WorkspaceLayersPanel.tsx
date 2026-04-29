import React from "react";
import {
  Box,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  ImagePlus,
  Lock,
  Unlock,
  Video,
} from "lucide-react";
import { CanvasElement } from "../../../types";

type WorkspaceLayerItemProps = {
  el: CanvasElement;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent, id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleHide: (id: string) => void;
  onToggleCollapse?: (id: string) => void;
  onEnterGroup?: (id: string) => void;
  depth?: number;
};

type WorkspaceLayersPanelProps = {
  elements: CanvasElement[];
  rootElements: CanvasElement[];
  elementById: Map<string, CanvasElement>;
  selectedElementId: string | null;
  selectedElementIds: string[];
  isHistoryExpanded: boolean;
  setIsHistoryExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  onSelect: (e: React.MouseEvent, id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleHide: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onEnterGroup: (id: string) => void;
};

const getElementDisplayUrl = (el: CanvasElement): string | undefined =>
  el.proxyUrl || el.url;

const WorkspaceLayerItem: React.FC<WorkspaceLayerItemProps> = ({
  el,
  isSelected,
  onSelect,
  onToggleLock,
  onToggleHide,
  onToggleCollapse,
  onEnterGroup,
  depth = 0,
}) => (
  <div
    onClick={(e) => onSelect(e, el.id)}
    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition group/item ${isSelected ? "bg-blue-50 border border-blue-100" : "hover:bg-gray-50 border border-transparent"}`}
    style={{ marginLeft: depth * 12 }}
  >
    <div className="w-8 h-8 bg-gray-50 rounded-md border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
      {el.type === "text" && (
        <span className="font-serif text-gray-500 text-[10px]">T</span>
      )}
      {el.type === "image" && getElementDisplayUrl(el) && (
        <img
          src={getElementDisplayUrl(el)}
          className="w-full h-full object-cover"
          alt=""
        />
      )}
      {(el.type === "video" || el.type === "gen-video") && (
        <Video size={14} className="text-gray-500" />
      )}
      {el.type === "shape" && <Box size={14} className="text-gray-500" />}
      {el.type === "gen-image" && (
        <ImagePlus size={14} className="text-blue-500" />
      )}
      {el.type === "group" && <Folder size={14} className="text-amber-500" />}
    </div>
    {el.type === "group" && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleCollapse?.(el.id);
        }}
        className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
      >
        {el.isCollapsed ? (
          <ChevronRight size={12} />
        ) : (
          <ChevronDown size={12} />
        )}
      </button>
    )}
    <div className="flex-1 min-w-0">
      <div
        className={`truncate font-medium text-[11px] ${el.isHidden ? "text-gray-300" : "text-gray-700"}`}
      >
        {el.type === "text"
          ? el.text || "Text"
          : el.type === "gen-image"
            ? "Image Gen"
            : el.type === "gen-video"
              ? "Video Gen"
              : el.type === "image"
                ? "Image"
                : el.type === "shape"
                  ? `${el.shapeType || "Shape"}`
                  : el.type === "group"
                    ? "Group"
                    : "Element"}
      </div>
      <div className="truncate text-gray-400 text-[9px] uppercase tracking-tighter">
        {el.type === "text"
          ? "Text"
          : el.type === "gen-image" || el.type === "gen-video"
            ? "AI Generated"
            : el.type === "group"
              ? `${el.children?.length || 0} items`
              : "Graphic"}
      </div>
    </div>
    <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
      {el.type === "group" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEnterGroup?.(el.id);
          }}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
          title="进入组"
        >
          <FolderOpen size={12} />
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock(el.id);
        }}
        className={`w-6 h-6 flex items-center justify-center rounded transition ${el.isLocked ? "text-amber-500 bg-amber-50 opacity-100" : "text-gray-400 hover:text-amber-500 hover:bg-amber-50"}`}
        title={el.isLocked ? "解锁" : "锁定"}
      >
        {el.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleHide(el.id);
        }}
        className={`w-6 h-6 flex items-center justify-center rounded transition ${el.isHidden ? "text-blue-500 bg-blue-50 opacity-100" : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"}`}
        title={el.isHidden ? "显示" : "隐藏"}
      >
        {el.isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
    </div>
  </div>
);

export const WorkspaceLayersPanel: React.FC<WorkspaceLayersPanelProps> = ({
  elements,
  rootElements,
  elementById,
  selectedElementId,
  selectedElementIds,
  isHistoryExpanded,
  setIsHistoryExpanded,
  onSelect,
  onToggleLock,
  onToggleHide,
  onToggleCollapse,
  onEnterGroup,
}) => {
  return (
    <div className="flex flex-col">
      <div className="border-b border-gray-100">
        <div
          className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition"
          onClick={() => setIsHistoryExpanded((prev) => !prev)}
        >
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            历史记录
          </span>
          <ChevronUp
            size={14}
            className={`text-gray-400 transition-transform ${isHistoryExpanded ? "" : "rotate-180"}`}
          />
        </div>
        <div className={`px-4 ${isHistoryExpanded ? "pb-4" : "pb-0"}`}>
          {isHistoryExpanded && (
            <div className="h-24 bg-gray-50/80 rounded-lg flex flex-col items-center justify-center text-gray-400 text-xs border border-dashed border-gray-200">
              <ImageIcon size={24} className="opacity-15 mb-1.5" />
              暂无历史记录
            </div>
          )}
        </div>
      </div>

      <div className="p-1.5 space-y-0.5">
        {elements.length === 0 ? (
          <div className="py-16 text-center text-xs text-gray-400">
            暂无图层
          </div>
        ) : (
          [...rootElements].reverse().map((el) => (
            <React.Fragment key={el.id}>
              <WorkspaceLayerItem
                el={el}
                isSelected={
                  selectedElementId === el.id || selectedElementIds.includes(el.id)
                }
                onSelect={onSelect}
                onToggleLock={onToggleLock}
                onToggleHide={onToggleHide}
                onToggleCollapse={onToggleCollapse}
                onEnterGroup={onEnterGroup}
              />
              {el.type === "group" &&
                !el.isCollapsed &&
                el.children?.map((childId) => {
                  const child = elementById.get(childId);
                  if (!child) return null;
                  return (
                    <WorkspaceLayerItem
                      key={child.id}
                      el={child}
                      depth={1}
                      isSelected={
                        selectedElementId === child.id ||
                        selectedElementIds.includes(child.id)
                      }
                      onSelect={onSelect}
                      onToggleLock={onToggleLock}
                      onToggleHide={onToggleHide}
                    />
                  );
                })}
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
};
