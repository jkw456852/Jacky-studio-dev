import type { AgentTask } from "../../types/agent.types";
import type { StudioUserAssetApi } from "./api.ts";
import { getStudioUserAssetApi } from "./api.ts";
import type {
  StudioMainBrainHeartbeatCadence,
  StudioMainBrainHeartbeatTask,
  StudioMainBrainMemoryCategory,
  StudioMainBrainMemoryRecord,
} from "./user-asset-types.ts";

const LONG_TERM_SIGNAL_REGEX =
  /(?:以后|下次|长期|默认|一律|统一|始终|每次|记住|请记住|都要|优先|必须|不要每次|别再|不要只|先.+再.+)/;

const NOISE_MESSAGE_REGEX = /^(?:好|好的|收到|继续|开始|干活|ok|okay|thanks|谢谢)[!！。\s]*$/i;

const MAX_CAPTURED_MEMORY_CANDIDATES_PER_EXCHANGE = 2;

const normalizeComparableText = (value: string): string =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[“”"'‘’]/g, "")
    .replace(/[，,。.!！？?；;：:\-—、（）()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const cleanSentence = (value: string): string =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-•*]+/, "")
    .trim();

const splitCandidateSentences = (text: string): string[] =>
  String(text || "")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .flatMap((line) => line.split(/[。！？!?；;]+/))
    .map(cleanSentence)
    .filter(Boolean);

const summarizeCandidate = (value: string): string => {
  const normalized = cleanSentence(value);
  if (normalized.length <= 48) return normalized;
  return `${normalized.slice(0, 48).trim()}…`;
};

const inferMemoryCategory = (value: string): StudioMainBrainMemoryCategory => {
  if (/(UI|界面|视觉|排版|留白|对齐|颜色|按钮|卡片|字体|图标|产品感|demo 感)/i.test(value)) {
    return "aesthetic";
  }
  if (/(角色|治理|审计|回滚|权限|草案|promote|archive|addon)/i.test(value)) {
    return "governance";
  }
  if (/(构建|链路|验证|测试|调试|修复|流程|联网|搜索|分析|先.+再.+|自动|手动)/i.test(value)) {
    return "workflow";
  }
  if (/(不要|禁止|避免|不能|别再|不允许)/.test(value)) {
    return "boundary";
  }
  if (/(我是|我们是|这个项目|当前项目|业务是|场景是|目标是)/.test(value)) {
    return "background";
  }
  return "preference";
};

const inferTags = (value: string): string[] => {
  const tags: string[] = [];
  if (/(构建|链路|验证|测试)/.test(value)) tags.push("verification");
  if (/(UI|界面|视觉|排版|留白|对齐|颜色|按钮|卡片|字体|图标)/i.test(value)) tags.push("ui");
  if (/(联网|搜索)/.test(value)) tags.push("search");
  if (/(角色|治理|审计|回滚)/.test(value)) tags.push("governance");
  if (/(不要|禁止|避免|不能|别再)/.test(value)) tags.push("boundary");
  if (/(默认|统一|每次|以后|下次|始终|优先)/.test(value)) tags.push("long-term");
  return Array.from(new Set(tags)).slice(0, 5);
};

const buildEvidence = (args: {
  userMessage: string;
  assistantMessage?: string;
  assistantSummary?: string;
}): string[] => {
  const evidence = [
    args.userMessage.trim() ? `User: ${args.userMessage.trim().slice(0, 220)}` : "",
    args.assistantSummary?.trim()
      ? `Assistant summary: ${args.assistantSummary.trim().slice(0, 220)}`
      : "",
    !args.assistantSummary?.trim() && args.assistantMessage?.trim()
      ? `Assistant response: ${args.assistantMessage.trim().slice(0, 220)}`
      : "",
  ].filter(Boolean);
  return Array.from(new Set(evidence)).slice(0, 3);
};

const shouldCaptureLine = (value: string): boolean => {
  const normalized = cleanSentence(value);
  if (!normalized || normalized.length < 8) return false;
  if (NOISE_MESSAGE_REGEX.test(normalized)) return false;
  return LONG_TERM_SIGNAL_REGEX.test(normalized);
};

const findDuplicateMemory = (
  existing: StudioMainBrainMemoryRecord[],
  summary: string,
  detail: string,
  topicId?: string,
): StudioMainBrainMemoryRecord | null => {
  const comparableSummary = normalizeComparableText(summary);
  const comparableDetail = normalizeComparableText(detail);
  return (
    existing.find((item) => {
      const sameTopic = String(item.topicId || "") === String(topicId || "");
      if (!sameTopic) return false;
      return (
        normalizeComparableText(item.summary) === comparableSummary ||
        normalizeComparableText(item.detail) === comparableDetail
      );
    }) || null
  );
};

const inferNextHeartbeatRunAt = (
  cadence: StudioMainBrainHeartbeatCadence,
  referenceTime: number,
): number | null => {
  if (cadence === "daily") return referenceTime + 24 * 60 * 60 * 1000;
  if (cadence === "weekly") return referenceTime + 7 * 24 * 60 * 60 * 1000;
  return null;
};

const mergeRecentHeartbeatSummaries = (
  nextItems: string[],
  existingItems: string[],
): string[] => {
  const merged = [...nextItems, ...existingItems]
    .map((item) => cleanSentence(item).slice(0, 220))
    .filter(Boolean);
  const deduped: string[] = [];
  merged.forEach((item) => {
    const normalized = normalizeComparableText(item);
    if (!normalized) return;
    if (deduped.some((entry) => normalizeComparableText(entry) === normalized)) return;
    deduped.push(item);
  });
  return deduped.slice(0, 12);
};

const sortHeartbeatTasksByRecency = (
  tasks: StudioMainBrainHeartbeatTask[],
): StudioMainBrainHeartbeatTask[] =>
  [...tasks].sort(
    (left, right) =>
      (right.lastRunAt || right.nextRunAt || 0) - (left.lastRunAt || left.nextRunAt || 0),
  );

export const recordMainBrainHeartbeatFromExchange = (args: {
  api?: StudioUserAssetApi;
  capturedMemorySummaries?: string[];
  task?: AgentTask | null;
}): {
  updated: boolean;
  summaries: string[];
} => {
  const api = args.api || getStudioUserAssetApi();
  const heartbeat = api.getMainBrainHeartbeat();
  if (!heartbeat.enabled) {
    return { updated: false, summaries: [] };
  }

  const now = Date.now();
  const currentMemory = api.getMainBrainMemory();
  const pendingCount = currentMemory.pendingMemoryCandidates.length;
  const latestPendingSummary = currentMemory.pendingMemoryCandidates
    .map((id) => currentMemory.memoryRecords[id]?.summary || "")
    .map((item) => cleanSentence(item))
    .find(Boolean);
  const summarySignals: string[] = [];
  const nextHeartbeatTasks: Record<string, StudioMainBrainHeartbeatTask> = {
    ...heartbeat.heartbeatTasks,
  };

  if ((args.capturedMemorySummaries || []).length > 0) {
    summarySignals.push(
      `新增待确认记忆 ${(args.capturedMemorySummaries || []).length} 条：${(args.capturedMemorySummaries || [])
        .slice(0, 2)
        .join("；")}`,
    );
  }

  const memoryReviewTask = Object.values(nextHeartbeatTasks).find(
    (task) => task.type === "memory_review_reminder" && task.enabled,
  );
  if (memoryReviewTask && pendingCount > 0) {
    const reminderSummary = latestPendingSummary
      ? `待确认记忆 ${pendingCount} 条，最新候选：${latestPendingSummary}`
      : `待确认记忆 ${pendingCount} 条，建议人工确认。`;
    nextHeartbeatTasks[memoryReviewTask.id] = {
      ...memoryReviewTask,
      lastRunAt: now,
      nextRunAt: inferNextHeartbeatRunAt(memoryReviewTask.cadence, now),
      lastSummary: reminderSummary,
    };
    summarySignals.push(reminderSummary);
  }

  if (args.task?.status === "failed") {
    const failureTask = Object.values(nextHeartbeatTasks).find(
      (task) => task.type === "failure_summary" && task.enabled,
    );
    const failureSummary = cleanSentence(
      args.task.output?.error?.message ||
        args.task.output?.message ||
        args.task.progressMessage ||
        "最近一次任务执行失败，需要人工复核。",
    ).slice(0, 180);
    if (failureSummary) {
      if (failureTask) {
        nextHeartbeatTasks[failureTask.id] = {
          ...failureTask,
          lastRunAt: now,
          nextRunAt: inferNextHeartbeatRunAt(failureTask.cadence, now),
          lastSummary: failureSummary,
        };
      }
      summarySignals.push(`最近失败：${failureSummary}`);
    }
  }

  const nextSummaries = mergeRecentHeartbeatSummaries(
    summarySignals,
    heartbeat.recentRunSummary,
  );

  const normalizedTaskSnapshot = JSON.stringify(
    sortHeartbeatTasksByRecency(Object.values(nextHeartbeatTasks)),
  );
  const previousTaskSnapshot = JSON.stringify(
    sortHeartbeatTasksByRecency(Object.values(heartbeat.heartbeatTasks)),
  );
  if (
    nextSummaries.length === heartbeat.recentRunSummary.length &&
    nextSummaries.every((item, index) => item === heartbeat.recentRunSummary[index]) &&
    normalizedTaskSnapshot === previousTaskSnapshot
  ) {
    return { updated: false, summaries: [] };
  }

  api.setMainBrainHeartbeat({
    recentRunSummary: nextSummaries,
    lastRunAt: now,
    nextRunAt: inferNextHeartbeatRunAt(heartbeat.cadence, now),
    heartbeatTasks: nextHeartbeatTasks,
  });

  return { updated: true, summaries: summarySignals };
};

export const captureMainBrainMemoryFromExchange = (args: {
  api?: StudioUserAssetApi;
  topicId?: string;
  userMessage: string;
  assistantMessage?: string;
  assistantSummary?: string;
  task?: AgentTask | null;
}): {
  createdIds: string[];
  createdSummaries: string[];
} => {
  const userMessage = String(args.userMessage || "").trim();
  if (!userMessage || NOISE_MESSAGE_REGEX.test(userMessage)) {
    return { createdIds: [], createdSummaries: [] };
  }

  const candidateLines = splitCandidateSentences(userMessage)
    .filter(shouldCaptureLine)
    .slice(0, MAX_CAPTURED_MEMORY_CANDIDATES_PER_EXCHANGE);

  if (candidateLines.length === 0) {
    return { createdIds: [], createdSummaries: [] };
  }

  const api = args.api || getStudioUserAssetApi();
  const current = api.getMainBrainMemory();
  const existingRecords = Object.values(current.memoryRecords || {});
  const now = Date.now();
  const createdIds: string[] = [];
  const createdSummaries: string[] = [];
  const nextRecords = { ...current.memoryRecords };

  candidateLines.forEach((line, index) => {
    const summary = summarizeCandidate(line);
    const detail = cleanSentence(line).slice(0, 600);
    const duplicate = findDuplicateMemory(existingRecords, summary, detail, args.topicId);
    if (duplicate) {
      return;
    }
    const id = `memory-auto-${now}-${index}`;
    nextRecords[id] = {
      id,
      schemaVersion: 1,
      createdAt: now + index,
      updatedAt: now + index,
      category: inferMemoryCategory(detail),
      source: "conversation",
      status: "candidate",
      summary,
      detail,
      evidence: buildEvidence({
        userMessage,
        assistantMessage: args.assistantMessage || args.task?.output?.message,
        assistantSummary: args.assistantSummary || args.task?.output?.postGenerationSummary,
      }),
      tags: inferTags(detail),
      ...(String(args.topicId || "").trim() ? { topicId: String(args.topicId || "").trim() } : {}),
    } satisfies StudioMainBrainMemoryRecord;
    createdIds.push(id);
    createdSummaries.push(summary);
  });

  if (createdIds.length === 0) {
    return { createdIds: [], createdSummaries: [] };
  }

  const nextPendingCandidates = Array.from(
    new Set([...createdIds, ...current.pendingMemoryCandidates]),
  ).slice(0, current.retentionPolicy.maxCandidateMemories);

  api.setMainBrainMemory({
    memoryRecords: nextRecords,
    pendingMemoryCandidates: nextPendingCandidates,
  });

  return { createdIds, createdSummaries };
};
