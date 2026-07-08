import type {
  SkillRun,
} from "../catalog/skill-object-types.ts";
import {
  createInMemorySkillRunStore,
  type CreateInMemorySkillRunStoreOptions,
  type CreateSkillRunInput,
  type SkillRunStatus,
  type SkillRunStore,
  type UpdateSkillRunPatch,
} from "./skill-run-store.ts";
import {
  resolveIdentityByLegacyConfig,
  resolveIdentityByLegacyFrontstageId,
  resolveIdentityByLegacySkillData,
  type SkillCanonicalIdentity,
  type SkillIdentityLookup,
  type RuntimeSkillData,
} from "../identity/skill-identity-resolver.ts";
import type { LegacySkillResolverOptions } from "../legacy/legacy-skill-catalog.ts";

export type SkillRunTriggerMode = SkillRun["triggerMode"];

export interface StartRunFromLegacyArgs {
  skillData?: RuntimeSkillData | null;
  legacyConfig?: Record<string, unknown> | null;
  legacyFrontstageId?: string | null;
  conversationId?: string;
  messageId?: string;
  prompt: string;
  attachments?: Array<Record<string, unknown>>;
  contextSnapshot?: unknown;
  triggerMode?: SkillRunTriggerMode;
  initialStatus?: SkillRunStatus;
  resolverOptions?: LegacySkillResolverOptions;
}

export interface RecordedRunStart {
  run: SkillRun;
  identity: SkillCanonicalIdentity;
  lookup: SkillIdentityLookup;
}

export interface SkillRunRecorder {
  store: SkillRunStore;
  startRunFromLegacy(args: StartRunFromLegacyArgs): RecordedRunStart | null;
  transition(runId: string, patch: UpdateSkillRunPatch): SkillRun | null;
  appendClarifyEvent(runId: string, event: Record<string, unknown>): SkillRun | null;
  appendRepairEvent(runId: string, event: Record<string, unknown>): SkillRun | null;
  appendFallbackEvent(runId: string, event: Record<string, unknown>): SkillRun | null;
  appendActualCall(runId: string, call: Record<string, unknown>): SkillRun | null;
  markRunning(runId: string): SkillRun | null;
  markSucceeded(runId: string, output?: SkillRun["output"]): SkillRun | null;
  markFailed(runId: string, error: SkillRun["error"]): SkillRun | null;
  markCancelled(runId: string): SkillRun | null;
  finishWith(
    runId: string,
    outcome:
      | { kind: "success"; output?: SkillRun["output"] }
      | { kind: "failure"; error: SkillRun["error"] }
      | { kind: "cancelled" },
  ): SkillRun | null;
}

export interface CreateSkillRunRecorderOptions
  extends CreateInMemorySkillRunStoreOptions {
  store?: SkillRunStore;
}

const resolveIdentityFromArgs = (
  args: StartRunFromLegacyArgs,
): SkillIdentityLookup | null => {
  if (args.legacyConfig) {
    const byConfig = resolveIdentityByLegacyConfig(args.legacyConfig, args.resolverOptions);
    if (byConfig) return byConfig;
  }
  if (args.skillData) {
    const bySkillData = resolveIdentityByLegacySkillData(
      args.skillData,
      args.resolverOptions,
    );
    if (bySkillData) return bySkillData;
  }
  if (args.legacyFrontstageId) {
    const byFrontstage = resolveIdentityByLegacyFrontstageId(
      args.legacyFrontstageId,
      args.resolverOptions,
    );
    if (byFrontstage) return byFrontstage;
  }
  return null;
};

export const createSkillRunRecorder = (
  options: CreateSkillRunRecorderOptions = {},
): SkillRunRecorder => {
  const store: SkillRunStore =
    options.store ?? createInMemorySkillRunStore({ now: options.now });

  const appendListField = <K extends "actualCalls" | "clarifyEvents" | "repairEvents" | "fallbackEvents">(
    runId: string,
    field: K,
    item: Record<string, unknown>,
  ): SkillRun | null => {
    const existing = store.get(runId);
    if (!existing) return null;
    const current = (existing[field] as Array<Record<string, unknown>> | undefined) ?? [];
    const nextList = [...current, { ...item }];
    const patch: UpdateSkillRunPatch = { [field]: nextList } as UpdateSkillRunPatch;
    if (field === "clarifyEvents") {
      patch.metrics = { clarifyRounds: nextList.length };
    } else if (field === "fallbackEvents") {
      patch.metrics = { fallbackCount: nextList.length };
    }
    return store.update(runId, patch);
  };

  const recorder: SkillRunRecorder = {
    store,

    startRunFromLegacy(args) {
      const lookup = resolveIdentityFromArgs(args);
      if (!lookup) return null;

      const createInput: CreateSkillRunInput = {
        conversationId: args.conversationId,
        messageId: args.messageId,
        skillDefinitionId: lookup.definition.id,
        skillVersionId: lookup.version.id,
        presetId: lookup.preset.id,
        triggerMode: args.triggerMode ?? "manual",
        status: args.initialStatus ?? "queued",
        input: {
          prompt: args.prompt,
          ...(args.attachments ? { attachments: args.attachments } : {}),
          ...(args.contextSnapshot !== undefined
            ? { contextSnapshot: args.contextSnapshot }
            : {}),
        },
      };
      const run = store.create(createInput);
      return { run, identity: lookup.identity, lookup };
    },

    transition(runId, patch) {
      return store.update(runId, patch);
    },

    appendClarifyEvent(runId, event) {
      return appendListField(runId, "clarifyEvents", event);
    },

    appendRepairEvent(runId, event) {
      return appendListField(runId, "repairEvents", event);
    },

    appendFallbackEvent(runId, event) {
      return appendListField(runId, "fallbackEvents", event);
    },

    appendActualCall(runId, call) {
      return appendListField(runId, "actualCalls", call);
    },

    markRunning(runId) {
      return store.update(runId, { status: "running" });
    },

    markSucceeded(runId, output) {
      return store.update(runId, {
        status: "succeeded",
        ...(output ? { output } : {}),
      });
    },

    markFailed(runId, error) {
      return store.update(runId, { status: "failed", error });
    },

    markCancelled(runId) {
      return store.update(runId, { status: "cancelled" });
    },

    finishWith(runId, outcome) {
      switch (outcome.kind) {
        case "success":
          return recorder.markSucceeded(runId, outcome.output);
        case "failure":
          return recorder.markFailed(runId, outcome.error);
        case "cancelled":
          return recorder.markCancelled(runId);
        default:
          return null;
      }
    },
  };

  return recorder;
};

let defaultRecorder: SkillRunRecorder | null = null;

export const getDefaultSkillRunRecorder = (): SkillRunRecorder => {
  if (!defaultRecorder) defaultRecorder = createSkillRunRecorder();
  return defaultRecorder;
};

export const resetDefaultSkillRunRecorder = (): void => {
  defaultRecorder = null;
};



