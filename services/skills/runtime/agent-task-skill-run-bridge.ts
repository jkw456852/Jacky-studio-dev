import {
  finalizeRunFromExecutionOutcome,
  recordRunFromExecutionContext,
} from "./skill-run-helpers.ts";
import {
  getDefaultSkillRunRecorder,
  type SkillRunRecorder,
} from "../runs/skill-run-recorder.ts";
import type { RuntimeSkillData } from "../identity/skill-identity-resolver.ts";

export interface AgentTaskLike {
  id?: string;
  status?: string;
  input?: {
    message?: string;
    metadata?: {
      skillData?: RuntimeSkillData | null;
      allowAutonomousRouting?: boolean;
    } | null;
    uploadedAttachments?: Array<string | Record<string, unknown>>;
  };
  output?: {
    error?: { message?: string; code?: string } | null;
    message?: string;
  } | null;
}

export interface BeginAgentTaskRunOptions {
  recorder?: SkillRunRecorder;
  conversationId?: string;
  messageId?: string;
  triggerMode?: "manual" | "default-assistant" | "api" | "replay";
}

export interface ActiveAgentTaskRun {
  runId: string;
  definitionId: string;
  versionId: string;
}

const summarizeAttachments = (
  attachments: AgentTaskLike["input"] extends infer T
    ? T extends { uploadedAttachments?: infer U }
      ? U
      : never
    : never,
): Array<Record<string, unknown>> | undefined => {
  if (!Array.isArray(attachments) || attachments.length === 0) return undefined;
  return attachments.map((item, index) => {
    if (typeof item === "string") return { index, url: item };
    if (item && typeof item === "object") return { index, ...item };
    return { index, value: String(item ?? "") };
  });
};

export const beginSkillRunForAgentTask = (
  task: AgentTaskLike,
  options: BeginAgentTaskRunOptions = {},
): ActiveAgentTaskRun | null => {
  const metadata = task.input?.metadata ?? null;
  if (!metadata?.skillData) return null;

  const recorder = options.recorder ?? getDefaultSkillRunRecorder();
  const prompt = String(task.input?.message ?? "");
  const attachments = summarizeAttachments(task.input?.uploadedAttachments);

  const started = recordRunFromExecutionContext({
    metadata,
    prompt,
    attachments,
    conversationId: options.conversationId,
    messageId: options.messageId ?? task.id,
    triggerMode: options.triggerMode ?? "manual",
    recorder,
  });
  if (!started) return null;

  return {
    runId: started.run.id,
    definitionId: started.identity.definitionId,
    versionId: started.identity.versionId,
  };
};

export const finishSkillRunForAgentTask = (
  active: ActiveAgentTaskRun | null,
  task: AgentTaskLike,
  options: { recorder?: SkillRunRecorder } = {},
): void => {
  if (!active) return;
  const recorder = options.recorder ?? getDefaultSkillRunRecorder();
  const status = String(task.status ?? "");
  if (status === "completed") {
    finalizeRunFromExecutionOutcome(
      active.runId,
      {
        kind: "success",
        output: {
          text: typeof task.output?.message === "string" ? task.output.message : undefined,
        },
      },
      recorder,
    );
    return;
  }
  if (status === "failed") {
    const error = task.output?.error ?? null;
    finalizeRunFromExecutionOutcome(
      active.runId,
      {
        kind: "failure",
        error: {
          code: typeof error?.code === "string" && error.code ? error.code : "agent_task_failed",
          message:
            typeof error?.message === "string" && error.message
              ? error.message
              : "Agent task failed",
          stage: "execute",
        },
      },
      recorder,
    );
    return;
  }
};

export const failSkillRunForAgentTask = (
  active: ActiveAgentTaskRun | null,
  error: { code?: string; message?: string; stage?: string } | null | undefined,
  options: { recorder?: SkillRunRecorder } = {},
): void => {
  if (!active) return;
  const recorder = options.recorder ?? getDefaultSkillRunRecorder();
  finalizeRunFromExecutionOutcome(
    active.runId,
    {
      kind: "failure",
      error: {
        code: error?.code || "agent_task_threw",
        message: error?.message || "Agent task threw",
        stage: error?.stage || "execute",
      },
    },
    recorder,
  );
};

export interface RecordSkillRunClarifyEventArgs {
  active: ActiveAgentTaskRun | null;
  decision: { shouldClarify: boolean; question?: string | null; missingChecklist?: string[] } | null | undefined;
  recorder?: SkillRunRecorder;
}

export const recordClarifyEventForAgentTask = ({
  active,
  decision,
  recorder,
}: RecordSkillRunClarifyEventArgs): void => {
  if (!active || !decision) return;
  if (!decision.shouldClarify && !decision.question && !decision.missingChecklist?.length) {
    return;
  }
  const inner = recorder ?? getDefaultSkillRunRecorder();
  try {
    inner.appendClarifyEvent(active.runId, {
      shouldClarify: decision.shouldClarify === true,
      ...(decision.question ? { question: String(decision.question).slice(0, 600) } : {}),
      ...(decision.missingChecklist?.length
        ? { missingChecklist: decision.missingChecklist.slice(0, 8).map((s) => String(s).slice(0, 240)) }
        : {}),
      at: Date.now(),
    });
  } catch {
    // best effort
  }
};

export interface RecordSkillRunRepairEventArgs {
  active: ActiveAgentTaskRun | null;
  event: {
    reason?: string;
    injectedSkillNames?: string[];
    skillCallsBefore?: number;
    skillCallsAfter?: number;
    fallbackUsed?: boolean;
    [extra: string]: unknown;
  } | null | undefined;
  recorder?: SkillRunRecorder;
}

export const recordRepairEventForAgentTask = ({
  active,
  event,
  recorder,
}: RecordSkillRunRepairEventArgs): void => {
  if (!active || !event) return;
  if (!event.reason && !event.injectedSkillNames?.length && event.fallbackUsed !== true) return;
  const inner = recorder ?? getDefaultSkillRunRecorder();
  try {
    inner.appendRepairEvent(active.runId, {
      reason: event.reason ? String(event.reason).slice(0, 240) : undefined,
      injectedSkillNames: event.injectedSkillNames?.slice(0, 8).map((s) => String(s).slice(0, 120)),
      skillCallsBefore: typeof event.skillCallsBefore === "number" ? event.skillCallsBefore : undefined,
      skillCallsAfter: typeof event.skillCallsAfter === "number" ? event.skillCallsAfter : undefined,
      fallbackUsed: event.fallbackUsed === true ? true : undefined,
      at: Date.now(),
    });
  } catch {
    // best effort
  }
};

export interface RecordSkillRunFallbackEventArgs {
  active: ActiveAgentTaskRun | null;
  event: {
    kind?: "switch-skill" | "degrade-to-chat" | "retry" | "abort" | string;
    fromSkill?: string;
    toSkill?: string;
    reason?: string;
    errorCode?: string;
    [extra: string]: unknown;
  } | null | undefined;
  recorder?: SkillRunRecorder;
}

export const recordFallbackEventForAgentTask = ({
  active,
  event,
  recorder,
}: RecordSkillRunFallbackEventArgs): void => {
  if (!active || !event) return;
  if (!event.kind && !event.toSkill && !event.reason && !event.errorCode) return;
  const inner = recorder ?? getDefaultSkillRunRecorder();
  try {
    inner.appendFallbackEvent(active.runId, {
      kind: event.kind ? String(event.kind).slice(0, 60) : undefined,
      fromSkill: event.fromSkill ? String(event.fromSkill).slice(0, 120) : undefined,
      toSkill: event.toSkill ? String(event.toSkill).slice(0, 120) : undefined,
      reason: event.reason ? String(event.reason).slice(0, 240) : undefined,
      errorCode: event.errorCode ? String(event.errorCode).slice(0, 80) : undefined,
      at: Date.now(),
    });
  } catch {
    // best effort
  }
};

export interface RecordRepairEventByMessageIdArgs {
  messageId?: string | null;
  conversationId?: string | null;
  event: RecordSkillRunRepairEventArgs['event'];
  recorder?: SkillRunRecorder;
}

const findActiveRunIdByContext = (
  recorder: SkillRunRecorder,
  args: { messageId?: string | null; conversationId?: string | null },
): string | null => {
  const matchedByMessage = args.messageId
    ? recorder.store.list({ messageId: args.messageId, limit: 5 })
    : [];
  const candidate =
    matchedByMessage.find((run) => run.status !== 'succeeded' && run.status !== 'failed' && run.status !== 'cancelled') ??
    matchedByMessage[0] ??
    null;
  if (candidate) return candidate.id;
  if (args.conversationId) {
    const list = recorder.store.list({ conversationId: args.conversationId, limit: 5 });
    const found =
      list.find((run) => run.status !== 'succeeded' && run.status !== 'failed' && run.status !== 'cancelled') ??
      list[0] ??
      null;
    if (found) return found.id;
  }
  return null;
};

export const recordRepairEventByMessageId = ({
  messageId,
  conversationId,
  event,
  recorder,
}: RecordRepairEventByMessageIdArgs): void => {
  if (!event) return;
  if (!event.reason && !event.injectedSkillNames?.length && event.fallbackUsed !== true) return;
  const inner = recorder ?? getDefaultSkillRunRecorder();
  const runId = findActiveRunIdByContext(inner, { messageId, conversationId });
  if (!runId) return;
  recordRepairEventForAgentTask({
    active: { runId, definitionId: '', versionId: '' },
    event,
    recorder: inner,
  });
};

export const recordFallbackEventByMessageId = ({
  messageId,
  conversationId,
  event,
  recorder,
}: {
  messageId?: string | null;
  conversationId?: string | null;
  event: RecordSkillRunFallbackEventArgs['event'];
  recorder?: SkillRunRecorder;
}): void => {
  if (!event) return;
  if (!event.kind && !event.toSkill && !event.reason && !event.errorCode) return;
  const inner = recorder ?? getDefaultSkillRunRecorder();
  const runId = findActiveRunIdByContext(inner, { messageId, conversationId });
  if (!runId) return;
  recordFallbackEventForAgentTask({
    active: { runId, definitionId: '', versionId: '' },
    event,
    recorder: inner,
  });
};
