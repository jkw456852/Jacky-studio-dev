import React from "react";

type WorkspaceModeSwitchDialogProps = {
  open: boolean;
  doNotAsk: boolean;
  onClose: () => void;
  onToggleDoNotAsk: () => void;
  onConfirm: () => void;
};

export const WorkspaceModeSwitchDialog: React.FC<WorkspaceModeSwitchDialogProps> = ({
  open,
  doNotAsk,
  onClose,
  onToggleDoNotAsk,
  onConfirm,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-[360px] p-6 animate-in zoom-in-95 duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-2">新建对话?</h3>
        <p className="text-sm text-gray-500 mb-5">
          切换模式会新建对话。您可以随时从历史列表中访问此对话。
        </p>
        <label className="flex items-center gap-2 mb-5 cursor-pointer select-none">
          <div
            onClick={onToggleDoNotAsk}
            className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${doNotAsk ? "bg-black" : "bg-gray-300"}`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${doNotAsk ? "translate-x-4" : "translate-x-0.5"}`}
            />
          </div>
          <span className="text-sm text-gray-600">不再询问</span>
        </label>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-10 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition"
          >
            新建
          </button>
        </div>
      </div>
    </div>
  );
};
