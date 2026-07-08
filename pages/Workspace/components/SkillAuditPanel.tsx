import React from "react";
import {
  Activity,
  AlertTriangle,
  Box,
  CheckCircle2,
  Clock3,
  Hash,
  Image as ImageIcon,
  Layers,
  Library,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Type,
  Video,
  X,
  Zap,
} from "lucide-react";
import type { SkillGovernanceActionId } from "../controllers/skillGovernancePanelData";
import { formatSkillGovernanceTimestamp } from "../controllers/skillGovernancePanelData";
import type { SkillAuditPanelModel } from "../controllers/skillAuditPanelData";

const ICON_MAP: Record<string, React.ElementType> = {
  Activity,
  Box,
  CheckCircle2,
  Hash,
  ImageIcon,
  Layers,
  Library,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Type,
  Video,
  Zap,
};

const resolveSkillIcon = (iconName: string): React.ElementType =>
  ICON_MAP[String(iconName || "").trim()] || Sparkles;

const formatAbsoluteTime = (value?: number): string => {
  const timestamp = Number(value || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "未记录";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
};

const formatRelativeTime = (value?: number): string => {
  const timestamp = Number(value || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) {
    return `${Math.max(1, Math.floor(diff / (60 * 1000)))} 分钟前`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.max(1, Math.floor(diff / (60 * 60 * 1000)))} 小时前`;
  }
  return `${Math.max(1, Math.floor(diff / (24 * 60 * 60 * 1000)))} 天前`;
};

const getEventTone = (eventType: string): string => {
  if (eventType.includes("failed")) return "bg-rose-50 text-rose-700";
  if (eventType.includes("published") || eventType.includes("reviewed")) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (eventType.includes("updated") || eventType.includes("rolled_back")) {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-slate-100 text-slate-600";
};

const getActionButtonClass = (tone: "primary" | "secondary" | "danger"): string => {
  switch (tone) {
    case "primary":
      return "border-slate-900 bg-slate-900 text-white hover:bg-slate-800";
    case "danger":
      return "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100";
    case "secondary":
    default:
      return "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50";
  }
};

export interface SkillAuditPanelProps {
  model: SkillAuditPanelModel | null;
  open: boolean;
  onClose: () => void;
  onGovernanceAction?: (
    actionId: SkillGovernanceActionId,
    targetVersionId?: string,
  ) => void | Promise<void>;
}

export const SkillAuditPanel: React.FC<SkillAuditPanelProps> = ({
  model,
  open,
  onClose,
  onGovernanceAction,
}) => {
  if (!open || !model) return null;

  const SkillIcon = resolveSkillIcon(model.iconName);

  return (
    <div className="fixed inset-0 z-[345] flex justify-end bg-slate-950/18 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="关闭 Skill 审计面板"
        className="flex-1"
        onClick={onClose}
      />
      <div className="relative flex h-full w-[min(480px,calc(100vw-18px))] flex-col border-l border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(247,249,252,0.98))] shadow-[-18px_0_48px_-36px_rgba(15,23,42,0.35)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <SkillIcon size={12} strokeWidth={2.1} />
              {model.kindLabel}
            </div>
            <div className="mt-3 text-[20px] font-semibold tracking-[-0.03em] text-slate-900">
              {model.title}
            </div>
            <div className="mt-1 text-[12px] leading-6 text-slate-500">
              {model.summary}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
            aria-label="关闭"
          >
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
          <section className="rounded-[22px] border border-slate-200/85 bg-white/92 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.2)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-white">
                v{model.versionLabel}
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                {model.releaseLabel}
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                {model.reviewLabel}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                {model.sourceLabel}
              </span>
            </div>
            {model.capabilityTags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {model.capabilityTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {model.instruction ? (
              <div className="mt-4 rounded-[16px] bg-slate-50 px-3 py-3 text-[12px] leading-6 text-slate-600">
                {model.instruction}
              </div>
            ) : null}
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-slate-200/85 bg-white/90 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Audit
              </div>
              <div className="mt-3 grid gap-3">
                <div>
                  <div className="text-[22px] font-semibold tracking-[-0.03em] text-slate-900">
                    {model.auditSummary.total}
                  </div>
                  <div className="text-[11px] text-slate-500">可见事件</div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <ShieldCheck size={13} strokeWidth={2} />
                  {model.auditSummary.uniqueActors} 个参与方
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Clock3 size={13} strokeWidth={2} />
                  最近事件 {formatRelativeTime(model.auditSummary.latestTimestamp) || "未记录"}
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-slate-200/85 bg-white/90 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Runtime
              </div>
              <div className="mt-3 space-y-2">
                {model.performanceItems.length > 0 ? (
                  model.performanceItems.map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-3">
                      <div className="text-[11px] text-slate-500">{item.label}</div>
                      <div className="text-right text-[11px] font-medium text-slate-700">
                        {item.label === "最近使用" || item.label === "最近成功"
                          ? formatRelativeTime(Number(item.value)) || item.value
                          : item.value}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Activity size={13} strokeWidth={2} />
                    还没有可用的运行记忆
                  </div>
                )}
              </div>
            </div>
          </section>

          {model.governance ? (
            <section className="mt-4 rounded-[20px] border border-slate-200/85 bg-white/92 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Governance
                  </div>
                  <div className="mt-1 text-[14px] font-semibold text-slate-900">
                    {model.governance.headline}
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-slate-500">
                    {model.governance.supportingText}
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <div>工作版本 v{model.governance.workingVersionLabel}</div>
                  {model.governance.publishedVersionLabel ? (
                    <div>线上版本 v{model.governance.publishedVersionLabel}</div>
                  ) : null}
                </div>
              </div>

              {model.governance.actions.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {model.governance.actions.map((action) => (
                    <button
                      key={`${action.id}-${action.targetVersionId || "current"}`}
                      type="button"
                      onClick={() => onGovernanceAction?.(action.id, action.targetVersionId)}
                      className={`inline-flex h-9 items-center rounded-full border px-4 text-[12px] font-medium transition ${getActionButtonClass(
                        action.tone,
                      )}`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                {model.governance.versions.map((version) => (
                  <div
                    key={version.id}
                    className="rounded-[16px] border border-slate-200/80 bg-slate-50 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="text-[12px] font-semibold text-slate-900">
                          v{version.semver}
                        </div>
                        {version.isWorkingVersion ? (
                          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-semibold text-white">
                            当前
                          </span>
                        ) : null}
                        {version.isPublishedVersion ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                            线上
                          </span>
                        ) : null}
                        {version.isRollbackTarget ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                            可回滚
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {formatSkillGovernanceTimestamp(version.updatedAt)}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-blue-700">
                        {version.reviewLabel}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                        {version.releaseLabel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {model.customSkillStorageNotice ? (
                <div
                  className={`mt-4 rounded-[16px] border px-3 py-3 text-[11px] leading-5 ${
                    model.customSkillStorageNotice.tone === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : model.customSkillStorageNotice.tone === "info"
                        ? "border-sky-200 bg-sky-50 text-sky-800"
                        : "border-slate-200/80 bg-slate-50 text-slate-600"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {model.customSkillStorageNotice.title}
                    </span>
                    {model.customSkillStorageBadge ? (
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium">
                        {model.customSkillStorageBadge}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1">{model.customSkillStorageNotice.body}</div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="mt-4 rounded-[20px] border border-slate-200/85 bg-white/92 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Definition
            </div>
            <div className="mt-3 grid gap-2">
              {model.detailItems.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="flex items-start justify-between gap-4 rounded-[14px] bg-slate-50 px-3 py-2.5"
                >
                  <div className="text-[11px] text-slate-500">{item.label}</div>
                  <div className="max-w-[68%] text-right text-[11px] font-medium leading-5 text-slate-700">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            {model.examplePrompt ? (
              <div className="mt-3 rounded-[16px] border border-dashed border-slate-200 px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Example Prompt
                </div>
                <div className="mt-2 text-[12px] leading-6 text-slate-600">
                  {model.examplePrompt}
                </div>
              </div>
            ) : null}
          </section>

          <section className="mt-4 rounded-[20px] border border-slate-200/85 bg-white/92 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Timeline
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  最近的定义、版本和运行轨迹
                </div>
              </div>
              <div className="text-[11px] text-slate-400">
                {model.timeline.length} 条
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {model.timeline.length > 0 ? (
                model.timeline.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="flex w-8 shrink-0 flex-col items-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold ${getEventTone(
                          item.eventType,
                        )}`}
                      >
                        {item.eventType.includes("failed") ? (
                          <AlertTriangle size={14} strokeWidth={2.2} />
                        ) : item.eventType.includes("published") ? (
                          <CheckCircle2 size={14} strokeWidth={2.2} />
                        ) : (
                          <Clock3 size={14} strokeWidth={2.2} />
                        )}
                      </div>
                      <div className="mt-1 h-full w-px bg-slate-200" />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[12px] font-medium text-slate-800">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {formatAbsoluteTime(item.timestamp)}
                        </div>
                      </div>
                      <div className="mt-1 text-[11px] leading-5 text-slate-500">
                        {item.reason}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                        <span>执行者：{item.actor}</span>
                        <span>目标：{item.targetType}</span>
                        <span>{formatRelativeTime(item.timestamp)}</span>
                      </div>
                      {item.metadataSummary.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.metadataSummary.map((summary) => (
                            <span
                              key={`${item.id}-${summary}`}
                              className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500"
                            >
                              {summary}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[16px] border border-dashed border-slate-200 px-3 py-6 text-center text-[12px] text-slate-500">
                  还没有可展示的审计时间线
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
