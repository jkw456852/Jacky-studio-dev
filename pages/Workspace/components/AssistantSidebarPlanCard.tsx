import React from "react";
import type { BrowserAgentGoalSessionPlan } from "../../../services/browser-agent";

type AssistantSidebarPlanCardProps = {
  goal: string;
  plan: BrowserAgentGoalSessionPlan;
  targetElementId: string | null;
  targetElementPendingCreation?: boolean;
  referenceImageCount: number;
  controlSummary?: {
    model: string | null;
    aspectRatio: string | null;
    resolution: string | null;
    imageCount: string | null;
    quality: string | null;
  } | null;
  repairNotes?: string[];
  isExecuting: boolean;
  onApprove: () => void;
  onDismiss: () => void;
};

const buildStepKindLabel = (
  step: BrowserAgentGoalSessionPlan["steps"][number],
) => (step.kind === "host_action" ? "执行动作" : "信息读取");

const buildTargetNodeLabel = ({
  targetElementId,
  targetElementPendingCreation,
}: Pick<
  AssistantSidebarPlanCardProps,
  "targetElementId" | "targetElementPendingCreation"
>) => {
  if (targetElementPendingCreation) {
    return "确认后自动创建承接节点";
  }
  if (targetElementId) {
    return `当前目标节点（ID ${targetElementId}）`;
  }
  return "暂未绑定具体节点";
};

const renderListSection = (
  title: string,
  items?: string[],
  tone: "default" | "warn" = "default",
) => {
  if (!items || items.length === 0) return null;
  const wrapperClass =
    tone === "warn"
      ? "rounded-xl border border-rose-200 bg-rose-50/80 p-3"
      : "rounded-xl border border-slate-200 bg-white/90 p-3";
  const bulletClass =
    tone === "warn" ? "text-rose-700" : "text-slate-700";

  return (
    <div className={wrapperClass}>
      <div className="text-[12px] font-semibold text-slate-900">{title}</div>
      <div className="mt-2 space-y-1.5">
        {items.map((item, index) => (
          <div
            key={`${title}-${index}`}
            className={`text-[11px] leading-5 ${bulletClass}`}
          >
            {`• ${item}`}
          </div>
        ))}
      </div>
    </div>
  );
};

export const AssistantSidebarPlanCard: React.FC<
  AssistantSidebarPlanCardProps
> = ({
  goal,
  plan,
  targetElementId,
  targetElementPendingCreation = false,
  referenceImageCount,
  controlSummary,
  repairNotes,
  isExecuting,
  onApprove,
  onDismiss,
}) => {
  const executable = !plan.done && plan.steps.length > 0;
  const taskProfile = plan.taskProfile;
  const researchNotes = plan.researchNotes;
  const executionStrategy = plan.executionStrategy;
  const plannerModelLabel =
    String(plan.plannerModel?.label || "").trim() ||
    String(plan.plannerModel?.modelId || "").trim() ||
    "Planner";

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-[0.18em] text-amber-600">
            PLAN
          </div>
          <h3 className="mt-1 text-[15px] font-semibold text-slate-900">
            {plan.title || "待确认执行计划"}
          </h3>
          <p className="mt-1 text-[12px] leading-5 text-slate-600">
            {plan.description ||
              "我先把这次任务的理解、风险和执行步骤整理出来，等你确认后再真正开始。"}
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-medium text-amber-700">
          {plannerModelLabel}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white/90 p-3">
        <div className="text-[12px] font-semibold text-slate-900">任务判断</div>
        <div className="mt-2 space-y-2">
          <div>
            <div className="text-[11px] text-slate-400">你的目标</div>
            <div className="mt-1 text-[12px] leading-5 text-slate-700">{goal}</div>
          </div>
          {taskProfile ? (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <div className="text-[10px] text-slate-400">任务类型</div>
                <div className="mt-1 text-[12px] font-medium text-slate-800">
                  {taskProfile.taskType}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <div className="text-[10px] text-slate-400">成功目标</div>
                <div className="mt-1 text-[12px] leading-5 text-slate-800">
                  {taskProfile.objective}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <div className="text-[10px] text-slate-400">准备交付</div>
                <div className="mt-1 text-[12px] leading-5 text-slate-800">
                  {taskProfile.deliverable}
                </div>
              </div>
            </div>
          ) : null}
          {plan.rationaleSummary ? (
            <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-5 text-slate-600">
              {plan.rationaleSummary}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
          <div className="text-slate-400">目标节点</div>
          <div className="mt-1 font-medium text-slate-800">
            {buildTargetNodeLabel({ targetElementId, targetElementPendingCreation })}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
          <div className="text-slate-400">参考图</div>
          <div className="mt-1 font-medium text-slate-800">
            {`${referenceImageCount} 张`}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
          <div className="text-slate-400">当前生图模型</div>
          <div className="mt-1 font-medium text-slate-800">
            {controlSummary?.model || "执行前再读取"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
          <div className="text-slate-400">比例 / 分辨率</div>
          <div className="mt-1 font-medium text-slate-800">
            {controlSummary?.aspectRatio || "?"} / {controlSummary?.resolution || "?"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
          <div className="text-slate-400">张数</div>
          <div className="mt-1 font-medium text-slate-800">
            {controlSummary?.imageCount || "?"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
          <div className="text-slate-400">质量</div>
          <div className="mt-1 font-medium text-slate-800">
            {controlSummary?.quality || "?"}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {renderListSection("执行前会重点考虑", researchNotes?.domainConsiderations)}
        {renderListSection("当前还缺的信息", researchNotes?.informationGaps)}
        {renderListSection("结果需要满足", researchNotes?.successCriteria)}
        {renderListSection("模型与生成策略", executionStrategy?.modelConsiderations)}
        {renderListSection("输出与页面规划", executionStrategy?.outputPlan)}
        {renderListSection("你确认前建议检查", executionStrategy?.approvalChecklist)}
        {renderListSection("自动修复补充", repairNotes)}
        {renderListSection("潜在风险", executionStrategy?.risks, "warn")}
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white/90 p-3">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-semibold text-slate-900">执行步骤</div>
          <div className="text-[10px] text-slate-400">{`${plan.steps.length} 步`}</div>
        </div>
        {plan.steps.length > 0 ? (
          <div className="mt-2 space-y-2">
            {plan.steps.map((step, index) => (
              <div
                key={step.id}
                className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[12px] font-medium text-slate-900">
                        {step.title || `步骤 ${index + 1}`}
                      </div>
                      <div className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                        {buildStepKindLabel(step)}
                      </div>
                    </div>
                    {step.summary ? (
                      <div className="mt-1 text-[11px] leading-5 text-slate-600">
                        {step.summary}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500">
            当前计划判断这轮暂时不需要继续执行。
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          {executable ? "先不执行" : "收起"}
        </button>
        {executable ? (
          <button
            type="button"
            onClick={onApprove}
            disabled={isExecuting}
            className="rounded-xl bg-slate-900 px-3 py-2 text-[12px] font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExecuting ? "正在启动执行" : "同意执行"}
          </button>
        ) : null}
      </div>
    </div>
  );
};
