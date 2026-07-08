import type { SkillRun } from "../catalog/skill-object-types.ts";

export type SkillRunStatus = SkillRun["status"];

export interface CreateSkillRunInput {
  id?: string;
  conversationId?: string;
  messageId?: string;
  skillDefinitionId: string;
  skillVersionId: string;
  presetId?: string;
  triggerMode: SkillRun["triggerMode"];
  status?: SkillRunStatus;
  input: SkillRun["input"];
  compiledPlan?: SkillRun["compiledPlan"];
  metrics?: SkillRun["metrics"];
}

export interface UpdateSkillRunPatch {
  status?: SkillRunStatus;
  compiledPlan?: SkillRun["compiledPlan"];
  actualCalls?: SkillRun["actualCalls"];
  output?: SkillRun["output"];
  clarifyEvents?: SkillRun["clarifyEvents"];
  repairEvents?: SkillRun["repairEvents"];
  fallbackEvents?: SkillRun["fallbackEvents"];
  error?: SkillRun["error"];
  metrics?: SkillRun["metrics"];
  auditRefIds?: SkillRun["auditRefIds"];
  startedAt?: number;
  completedAt?: number;
}

export interface SkillRunQuery {
  conversationId?: string;
  messageId?: string;
  skillDefinitionId?: string;
  skillVersionId?: string;
  presetId?: string;
  status?: SkillRunStatus;
  limit?: number;
}

export interface SkillRunStore {
  create(input: CreateSkillRunInput): SkillRun;
  get(runId: string): SkillRun | null;
  update(runId: string, patch: UpdateSkillRunPatch): SkillRun | null;
  list(query?: SkillRunQuery): SkillRun[];
  delete(runId: string): boolean;
  clear(): void;
}

const TERMINAL_STATUSES: ReadonlySet<SkillRunStatus> = new Set([
  "succeeded",
  "failed",
  "cancelled",
]);

const STATUS_TRANSITIONS: Record<SkillRunStatus, ReadonlySet<SkillRunStatus>> = {
  queued: new Set<SkillRunStatus>([
    "clarifying",
    "planning",
    "running",
    "cancelled",
    "failed",
  ]),
  clarifying: new Set<SkillRunStatus>([
    "planning",
    "running",
    "cancelled",
    "failed",
  ]),
  planning: new Set<SkillRunStatus>([
    "running",
    "cancelled",
    "failed",
  ]),
  running: new Set<SkillRunStatus>([
    "succeeded",
    "failed",
    "cancelled",
  ]),
  succeeded: new Set<SkillRunStatus>(),
  failed: new Set<SkillRunStatus>(),
  cancelled: new Set<SkillRunStatus>(),
};

const isTerminal = (status: SkillRunStatus): boolean => TERMINAL_STATUSES.has(status);

const canTransition = (from: SkillRunStatus, to: SkillRunStatus): boolean => {
  if (from === to) return true;
  return STATUS_TRANSITIONS[from]?.has(to) === true;
};

const cloneRun = (run: SkillRun): SkillRun => ({
  ...run,
  input: { ...run.input },
  compiledPlan: run.compiledPlan ? { ...run.compiledPlan } : undefined,
  actualCalls: run.actualCalls ? run.actualCalls.map((call) => ({ ...call })) : undefined,
  output: run.output ? { ...run.output } : undefined,
  clarifyEvents: run.clarifyEvents
    ? run.clarifyEvents.map((event) => ({ ...event }))
    : undefined,
  repairEvents: run.repairEvents
    ? run.repairEvents.map((event) => ({ ...event }))
    : undefined,
  fallbackEvents: run.fallbackEvents
    ? run.fallbackEvents.map((event) => ({ ...event }))
    : undefined,
  error: run.error ? { ...run.error } : undefined,
  metrics: run.metrics ? { ...run.metrics } : undefined,
  auditRefIds: run.auditRefIds ? [...run.auditRefIds] : undefined,
});

const generateRunId = (existing: Set<string>): string => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `skill_run_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `skill_run_${Date.now()}_${existing.size + 1}`;
};

export interface CreateInMemorySkillRunStoreOptions {
  now?: () => number;
}

export const createInMemorySkillRunStore = (
  options: CreateInMemorySkillRunStoreOptions = {},
): SkillRunStore => {
  const runs = new Map<string, SkillRun>();
  const now = options.now ?? (() => Date.now());

  return {
    create(input) {
      const id = input.id ?? generateRunId(new Set(runs.keys()));
      if (runs.has(id)) {
        throw new Error(`skill_run_already_exists: ${id}`);
      }
      const timestamp = now();
      const run: SkillRun = {
        id,
        conversationId: input.conversationId,
        messageId: input.messageId,
        skillDefinitionId: input.skillDefinitionId,
        skillVersionId: input.skillVersionId,
        presetId: input.presetId,
        triggerMode: input.triggerMode,
        status: input.status ?? "queued",
        input: { ...input.input },
        compiledPlan: input.compiledPlan ? { ...input.compiledPlan } : undefined,
        metrics: input.metrics ? { ...input.metrics } : undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      runs.set(id, run);
      return cloneRun(run);
    },

    get(runId) {
      const existing = runs.get(runId);
      return existing ? cloneRun(existing) : null;
    },

    update(runId, patch) {
      const existing = runs.get(runId);
      if (!existing) return null;
      if (isTerminal(existing.status) && patch.status && patch.status !== existing.status) {
        throw new Error(
          `skill_run_terminal_status_immutable: ${existing.id} is ${existing.status}`,
        );
      }
      if (patch.status && !canTransition(existing.status, patch.status)) {
        throw new Error(
          `skill_run_invalid_transition: ${existing.status} -> ${patch.status}`,
        );
      }
      const timestamp = now();
      const next: SkillRun = {
        ...existing,
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.compiledPlan ? { compiledPlan: { ...patch.compiledPlan } } : {}),
        ...(patch.actualCalls
          ? { actualCalls: patch.actualCalls.map((call) => ({ ...call })) }
          : {}),
        ...(patch.output ? { output: { ...patch.output } } : {}),
        ...(patch.clarifyEvents
          ? { clarifyEvents: patch.clarifyEvents.map((event) => ({ ...event })) }
          : {}),
        ...(patch.repairEvents
          ? { repairEvents: patch.repairEvents.map((event) => ({ ...event })) }
          : {}),
        ...(patch.fallbackEvents
          ? { fallbackEvents: patch.fallbackEvents.map((event) => ({ ...event })) }
          : {}),
        ...(patch.error ? { error: { ...patch.error } } : {}),
        ...(patch.metrics
          ? { metrics: { ...(existing.metrics ?? {}), ...patch.metrics } }
          : {}),
        ...(patch.auditRefIds ? { auditRefIds: [...patch.auditRefIds] } : {}),
        ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
        ...(patch.completedAt !== undefined ? { completedAt: patch.completedAt } : {}),
        updatedAt: timestamp,
      };
      if (patch.status === "running" && !next.startedAt) {
        next.startedAt = timestamp;
      }
      if (patch.status && isTerminal(patch.status) && !next.completedAt) {
        next.completedAt = timestamp;
      }
      runs.set(runId, next);
      return cloneRun(next);
    },

    list(query = {}) {
      const filtered: SkillRun[] = [];
      for (const run of runs.values()) {
        if (query.conversationId && run.conversationId !== query.conversationId) continue;
        if (query.messageId && run.messageId !== query.messageId) continue;
        if (query.skillDefinitionId && run.skillDefinitionId !== query.skillDefinitionId) continue;
        if (query.skillVersionId && run.skillVersionId !== query.skillVersionId) continue;
        if (query.presetId && run.presetId !== query.presetId) continue;
        if (query.status && run.status !== query.status) continue;
        filtered.push(cloneRun(run));
      }
      filtered.sort((a, b) => b.updatedAt - a.updatedAt);
      if (query.limit && query.limit > 0) return filtered.slice(0, query.limit);
      return filtered;
    },

    delete(runId) {
      return runs.delete(runId);
    },

    clear() {
      runs.clear();
    },
  };
};

export const SKILL_RUN_TERMINAL_STATUSES = TERMINAL_STATUSES;

export const isTerminalSkillRunStatus = (status: SkillRunStatus): boolean =>
  TERMINAL_STATUSES.has(status);

export const canTransitionSkillRunStatus = (
  from: SkillRunStatus,
  to: SkillRunStatus,
): boolean => canTransition(from, to);
