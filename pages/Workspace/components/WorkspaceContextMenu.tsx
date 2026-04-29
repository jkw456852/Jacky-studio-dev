import React from "react";
import { Download } from "lucide-react";

type WorkspaceContextMenuProps = {
  contextMenu: { x: number; y: number } | null;
  canDownloadImage: boolean;
  onClose: () => void;
  onManualPaste: () => void;
  onDownload: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onResetZoom: () => void;
};

export const WorkspaceContextMenu: React.FC<WorkspaceContextMenuProps> = ({
  contextMenu,
  canDownloadImage,
  onClose,
  onManualPaste,
  onDownload,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onResetZoom,
}) => {
  if (!contextMenu) return null;

  const menuItemClassName =
    "w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex justify-between items-center group";

  return (
    <div
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200/80 py-1.5 w-52 text-sm backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => {
          onManualPaste();
          onClose();
        }}
        className={menuItemClassName}
      >
        <span>{"\u7c98\u8d34"}</span>
        <span className="text-xs text-gray-400 font-sans group-hover:text-gray-500">
          Ctrl + V
        </span>
      </button>

      {canDownloadImage && (
        <button
          onClick={() => {
            onDownload();
            onClose();
          }}
          className={menuItemClassName}
        >
          <span>{"\u4e0b\u8f7d\u56fe\u7247"}</span>
          <Download
            size={14}
            className="text-gray-400 group-hover:text-gray-500"
          />
        </button>
      )}

      <div className="h-px bg-gray-100 my-1"></div>

      <button
        onClick={() => {
          onZoomIn();
          onClose();
        }}
        className={menuItemClassName}
      >
        <span>{"\u653e\u5927"}</span>
        <span className="text-xs text-gray-400 font-sans group-hover:text-gray-500">
          Ctrl + +
        </span>
      </button>

      <button
        onClick={() => {
          onZoomOut();
          onClose();
        }}
        className={menuItemClassName}
      >
        <span>{"\u7f29\u5c0f"}</span>
        <span className="text-xs text-gray-400 font-sans group-hover:text-gray-500">
          Ctrl + -
        </span>
      </button>

      <button
        onClick={() => {
          onFitToScreen();
          onClose();
        }}
        className={menuItemClassName}
      >
        <span>{"\u663e\u793a\u753b\u5e03\u6240\u6709\u5185\u5bb9"}</span>
        <span className="text-xs text-gray-400 font-sans group-hover:text-gray-500">
          Shift + 1
        </span>
      </button>

      <button
        onClick={() => {
          onResetZoom();
          onClose();
        }}
        className={menuItemClassName}
      >
        <span>{"\u7f29\u653e 100%"}</span>
        <span className="text-xs text-gray-400 font-sans group-hover:text-gray-500">
          Ctrl + 0
        </span>
      </button>
    </div>
  );
};
