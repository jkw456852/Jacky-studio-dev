import React from "react";
import { Package2, Sparkles } from "lucide-react";
import { useEcommerceOneClickState } from "../../../../stores/ecommerceOneClick.store";
import { getEcommerceWorkflowSummary } from "./ecommerceWorkflowUi";

type EcommerceCanvasQuickCardProps = {
  visible: boolean;
  onOpen: () => void;
};

type EcommerceCanvasQuickCardBodyProps = {
  onOpen: () => void;
};

const EcommerceCanvasQuickCardBody: React.FC<
  EcommerceCanvasQuickCardBodyProps
> = ({ onOpen }) => {
  const ecommerceState = useEcommerceOneClickState();
  const summary = getEcommerceWorkflowSummary(ecommerceState);
  const ctaClass =
    summary.failedJobs > 0
      ? "bg-red-50 text-red-600"
      : "bg-blue-50 text-blue-700";
  const progressClass =
    summary.failedJobs > 0 ? "bg-red-500" : "bg-blue-500";

  return (
    <div className="pointer-events-none absolute bottom-24 left-6 z-[45]">
      <button
        type="button"
        onClick={onOpen}
        className="pointer-events-auto w-[280px] rounded-3xl border border-gray-200/80 bg-white/95 p-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.12)] backdrop-blur transition active:scale-[0.995]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Package2 size={16} className="text-blue-600" />
              电商一键工作流
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {summary.hint.label}
            </div>
          </div>
          <div
            className={[
              "rounded-full px-2 py-1 text-[10px] font-semibold",
              ctaClass,
            ].join(" ")}
          >
            {summary.ctaLabel}
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-gray-600">
          {summary.hint.next}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-gray-500">
          <span className="rounded-full bg-gray-100 px-2 py-1">
            {summary.platformLabel}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-1">
            {summary.workflowModeLabel}
          </span>
          {typeof summary.bestResultScore === "number" ? (
            <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
              最高评审分 {summary.bestResultScore}
            </span>
          ) : null}
          {summary.highScoreResultCount > 0 ? (
            <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700">
              高分图 {summary.highScoreResultCount}
            </span>
          ) : null}
        </div>
        {summary.progressTotal > 0 ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-gray-500">
              <span className="truncate">{summary.progressText}</span>
              <span>
                {summary.progressDone}/{summary.progressTotal}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full transition-[width] ${progressClass}`}
                style={{ width: `${summary.progressPercent}%` }}
              />
            </div>
          </div>
        ) : null}
        {summary.failedJobs > 0 ? (
          <div className="mt-3 inline-flex rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600">
            当前有 {summary.failedJobs} 个失败任务待处理
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
          <Sparkles size={13} className="text-amber-500" />
          在画布区也能随时继续，不用回头找聊天入口
        </div>
      </button>
    </div>
  );
};

export const EcommerceCanvasQuickCard = React.memo(
  ({ visible, onOpen }: EcommerceCanvasQuickCardProps) => {
    if (!visible) {
      return null;
    }

    return <EcommerceCanvasQuickCardBody onOpen={onOpen} />;
  },
);
