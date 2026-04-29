import React from "react";
import { ArrowRight, Package2 } from "lucide-react";
import { useEcommerceOneClickState } from "../../../../stores/ecommerceOneClick.store";
import { getEcommerceWorkflowSummary } from "./ecommerceWorkflowUi";

type EcommerceWorkflowSummaryCardProps = {
  onOpen: () => void;
  compact?: boolean;
};

export const EcommerceWorkflowSummaryCard: React.FC<
  EcommerceWorkflowSummaryCardProps
> = ({ onOpen, compact = false }) => {
  const ecommerceState = useEcommerceOneClickState();
  const summary = getEcommerceWorkflowSummary(ecommerceState);
  const workbenchCtaLabel = !summary.hasData
    ? "\u6253\u5f00\u5de5\u4f5c\u53f0"
    : summary.failedJobs > 0
      ? "\u5904\u7406\u5931\u8d25\u9879"
      : "\u7ee7\u7eed\u5de5\u4f5c\u53f0";
  const ctaClass =
    summary.failedJobs > 0
      ? "bg-red-600 text-white"
      : "bg-gray-900 text-white";
  const progressClass =
    summary.failedJobs > 0 ? "bg-red-500" : "bg-blue-500";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        "w-full rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white text-left shadow-sm transition hover:border-blue-200 hover:shadow-md active:scale-[0.995]",
        compact ? "p-3" : "p-4",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Package2 size={16} className="text-blue-600" />
            电商一键工作流
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {summary.statusText}
          </p>
          {summary.progressTotal > 0 ? (
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-gray-500">
                <span>{summary.progressText}</span>
                <span>
                  {summary.progressDone}/{summary.progressTotal}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white">
                <div
                  className={`h-full rounded-full transition-[width] ${progressClass}`}
                  style={{ width: `${summary.progressPercent}%` }}
                />
              </div>
            </div>
          ) : null}
           <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-500">
             <span className="rounded-full bg-white px-2 py-1">
               {summary.platformLabel}
             </span>
             <span className="rounded-full bg-white px-2 py-1">
               {summary.workflowModeLabel}
             </span>
             <span className="rounded-full bg-white px-2 py-1">
               商品图 {ecommerceState.productImages.length}
             </span>
            <span className="rounded-full bg-white px-2 py-1">
              方案 {summary.planCount}
            </span>
           <span className="rounded-full bg-white px-2 py-1">
              结果 {ecommerceState.results.length}
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
            {summary.failedJobs > 0 ? (
              <span className="rounded-full bg-red-50 px-2 py-1 text-red-600">
                失败 {summary.failedJobs}
              </span>
            ) : null}
          </div>
        </div>
        <div
          className={[
            "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold",
            ctaClass,
          ].join(" ")}
        >
          <span className="inline-flex items-center gap-1">
            {workbenchCtaLabel}
            <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </button>
  );
};
