import type { StudioUserAssetState } from "./user-asset-types.ts";
import type {
  StudioAssetSyncConflictPolicy,
  StudioAssetSyncPolicy,
} from "./sync-policy.ts";
import { resolveStudioAssetSyncPolicy } from "./sync-policy.ts";
import { getStudioUserAssetApi } from "./api.ts";

type MergeKind =
  | "main-brain"
  | "main-brain-soul"
  | "main-brain-user"
  | "main-brain-workflow"
  | "main-brain-memory"
  | "main-brain-heartbeat"
  | "main-brain-bootstrap"
  | "user-profile"
  | "role"
  | "style-library"
  | "plugin"
  | "workspace-preference"
  | "skill-preference"
  | "evolution-record";

export interface StudioAssetMergeDecision {
  kind: MergeKind;
  policy: StudioAssetSyncConflictPolicy;
  summary: string;
}

export interface StudioAssetMergeResult {
  merged: StudioUserAssetState;
  decisions: StudioAssetMergeDecision[];
}

const cloneState = (state: StudioUserAssetState): StudioUserAssetState =>
  JSON.parse(JSON.stringify(state)) as StudioUserAssetState;

const normalizeMergeState = (
  state: StudioUserAssetState | null | undefined,
): StudioUserAssetState => {
  const fallback = getStudioUserAssetApi().getSnapshot();
  if (!state || typeof state !== "object") {
    return cloneState(fallback);
  }

  try {
    const merged = {
      ...fallback,
      ...state,
      mainBrainPreferences: {
        ...fallback.mainBrainPreferences,
        ...(state.mainBrainPreferences || {}),
      },
      mainBrainSoul: {
        ...fallback.mainBrainSoul,
        ...(state.mainBrainSoul || {}),
      },
      mainBrainUser: {
        ...fallback.mainBrainUser,
        ...(state.mainBrainUser || {}),
      },
      mainBrainWorkflow: {
        ...fallback.mainBrainWorkflow,
        ...(state.mainBrainWorkflow || {}),
        roleGovernanceDefaults: {
          ...fallback.mainBrainWorkflow.roleGovernanceDefaults,
          ...(state.mainBrainWorkflow?.roleGovernanceDefaults || {}),
        },
      },
      mainBrainMemory: {
        ...fallback.mainBrainMemory,
        ...(state.mainBrainMemory || {}),
        retentionPolicy: {
          ...fallback.mainBrainMemory.retentionPolicy,
          ...(state.mainBrainMemory?.retentionPolicy || {}),
        },
      },
      mainBrainHeartbeat: {
        ...fallback.mainBrainHeartbeat,
        ...(state.mainBrainHeartbeat || {}),
        heartbeatTasks: {
          ...fallback.mainBrainHeartbeat.heartbeatTasks,
          ...(state.mainBrainHeartbeat?.heartbeatTasks || {}),
        },
      },
      mainBrainBootstrap: {
        ...fallback.mainBrainBootstrap,
        ...(state.mainBrainBootstrap || {}),
      },
      userProfile: {
        ...fallback.userProfile,
        ...(state.userProfile || {}),
      },
      workspacePreferences: {
        ...fallback.workspacePreferences,
        ...(state.workspacePreferences || {}),
        imageModelPostPaths: {
          ...fallback.workspacePreferences.imageModelPostPaths,
          ...(state.workspacePreferences?.imageModelPostPaths || {}),
        },
      },
      skillPreferences: {
        ...fallback.skillPreferences,
        ...(state.skillPreferences || {}),
        customSkillConfigs: {
          ...fallback.skillPreferences.customSkillConfigs,
          ...(state.skillPreferences?.customSkillConfigs || {}),
        },
      },
      pluginPreferences: {
        ...fallback.pluginPreferences,
        ...(state.pluginPreferences || {}),
        records: {
          ...fallback.pluginPreferences.records,
          ...(state.pluginPreferences?.records || {}),
        },
      },
      agentPromptAddons: {
        ...fallback.agentPromptAddons,
        ...(state.agentPromptAddons || {}),
      },
      latestRoleDrafts: {
        ...fallback.latestRoleDrafts,
        ...(state.latestRoleDrafts || {}),
      },
      roles: {
        ...fallback.roles,
        ...(state.roles || {}),
      },
      temporaryRoleDrafts: {
        ...fallback.temporaryRoleDrafts,
        ...(state.temporaryRoleDrafts || {}),
      },
      roleVersions: {
        ...fallback.roleVersions,
        ...(state.roleVersions || {}),
      },
      roleAuditEntries: {
        ...fallback.roleAuditEntries,
        ...(state.roleAuditEntries || {}),
      },
      styleLibraries: {
        ...fallback.styleLibraries,
        ...(state.styleLibraries || {}),
      },
      evolutionRecords: {
        ...fallback.evolutionRecords,
        ...(state.evolutionRecords || {}),
      },
    } satisfies StudioUserAssetState;

    return cloneState(merged);
  } catch {
    return cloneState(fallback);
  }
};

const mergeUnique = (left: string[], right: string[]): string[] =>
  Array.from(new Set([...(left || []), ...(right || [])])).filter(Boolean);

const DEFAULT_MAIN_BRAIN_SOUL = {
  persona: "",
  tone: [] as string[],
  workingStyle: [] as string[],
  restraintRules: [] as string[],
  selfCheckRules: [] as string[],
  riskPreference: "balanced" as const,
};

const DEFAULT_MAIN_BRAIN_USER = {
  goals: [] as string[],
  workingHabits: [] as string[],
  businessContext: [] as string[],
  aestheticPreferences: [] as string[],
  communicationStyle: [] as string[],
  permanentNotes: [] as string[],
  memoryBlacklist: [] as string[],
};

const DEFAULT_MAIN_BRAIN_WORKFLOW = {
  defaultAnalysisDepth: "balanced" as const,
  searchPolicy: "auto" as const,
  clarifyBeforeExecution: false,
  toolUseGuidelines: [] as string[],
  failureRecoveryRules: [] as string[],
  roleGovernanceDefaults: {
    mode: "approval_required" as const,
    allowDraft: true,
    allowAutoPromote: false,
    allowAutoArchive: false,
  },
};

const DEFAULT_MAIN_BRAIN_MEMORY = {
  memoryIndex: [] as string[],
  memoryRecords: {} as Record<string, unknown>,
  pendingMemoryCandidates: [] as string[],
  memoryBlacklists: [] as string[],
  retentionPolicy: {
    maxActiveMemories: 200,
    maxCandidateMemories: 50,
    autoPromoteSimilarCount: 3,
  },
  dailySummary: [] as string[],
};

const DEFAULT_MAIN_BRAIN_HEARTBEAT = {
  enabled: false,
  cadence: "manual" as const,
  scope: [] as string[],
  heartbeatTasks: {} as Record<string, unknown>,
  recentRunSummary: [] as string[],
  lastRunAt: null as number | null,
  nextRunAt: null as number | null,
};

const DEFAULT_MAIN_BRAIN_BOOTSTRAP = {
  initialized: false,
  initializedAt: null as number | null,
  sourceTemplate: "",
  completedSteps: [] as string[],
  lastRebootstrapAt: null as number | null,
};

const DEFAULT_USER_PROFILE = {
  avatarUrl: "",
  preferenceNotes: [] as string[],
  commonTasks: [] as string[],
  aestheticPreferences: [] as string[],
  brandContextNotes: [] as string[],
  memoryNotes: [] as string[],
};

const DEFAULT_WORKSPACE_PREFERENCES = {
  chatModelMode: "fast" as const,
  chatWebEnabled: false,
  selectedScriptModels: ["gemini-3.1-flash-lite-preview"],
  selectedImageModels: ["Auto"],
  selectedVideoModels: ["veo-3.1-fast-generate-preview"],
  visualOrchestratorModel: "auto",
  browserAgentModel: "auto",
  visualOrchestratorMaxReferenceImages: 0,
  visualOrchestratorMaxInlineImageBytesMb: 48,
  visualContinuity: true,
  systemModeration: false,
  autoSave: true,
  concurrentCount: 1,
  autoModelSelect: true,
  preferredImageModel: "Nano Banana Pro",
  preferredImageProviderId: null as string | null,
  preferredVideoModel: "veo-3.1-fast-generate-preview",
  preferredVideoProviderId: null as string | null,
  preferred3DModel: "Auto",
  browserAgentChatEnabled: true,
};

const DEFAULT_SKILL_PREFERENCES = {
  activeQuickSkill: null,
  recentSkillIds: [] as string[],
  pinnedSkillIds: [] as string[],
  customSkillConfigs: {} as Record<string, Record<string, unknown>>,
};

const arraysEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((item, index) => item === right[index]);

const preferNonDefaultValue = <T,>(args: {
  local: T;
  remote: T;
  defaultValue: T;
  localUpdatedAt?: number;
  remoteUpdatedAt?: number;
}): T => {
  const {
    local,
    remote,
    defaultValue,
    localUpdatedAt = 0,
    remoteUpdatedAt = 0,
  } = args;
  const localIsDefault = Object.is(local, defaultValue);
  const remoteIsDefault = Object.is(remote, defaultValue);

  if (localIsDefault && !remoteIsDefault) {
    return remote;
  }
  if (!localIsDefault && remoteIsDefault) {
    return local;
  }
  if (!localIsDefault && !remoteIsDefault && remoteUpdatedAt > localUpdatedAt) {
    return remote;
  }
  return local;
};

const mergeTimestampedRecordMap = <T extends { updatedAt?: number }>(
  local: Record<string, T>,
  remote: Record<string, T>,
): Record<string, T> => {
  const merged = { ...(remote || {}), ...(local || {}) };
  for (const [key, remoteValue] of Object.entries(remote || {})) {
    const localValue = local?.[key];
    if (!localValue) {
      merged[key] = remoteValue;
      continue;
    }
    merged[key] = (Number(remoteValue?.updatedAt || 0) > Number(localValue?.updatedAt || 0))
      ? remoteValue
      : localValue;
  }
  return merged;
};

const mergeVersionedRecordMap = <T extends { id: string; version?: number; createdAt?: number }>(
  local: Record<string, T[]>,
  remote: Record<string, T[]>,
): Record<string, T[]> => {
  const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  const merged: Record<string, T[]> = {};

  for (const key of keys) {
    const mergedById = new Map<string, T>();

    for (const item of [...(remote?.[key] || []), ...(local?.[key] || [])]) {
      const existing = mergedById.get(item.id);
      if (!existing) {
        mergedById.set(item.id, item);
        continue;
      }
      const existingWeight = Number(existing.version || existing.createdAt || 0);
      const nextWeight = Number(item.version || item.createdAt || 0);
      mergedById.set(item.id, nextWeight >= existingWeight ? item : existing);
    }

    const records = Array.from(mergedById.values()).sort((left, right) => {
      const versionDiff = Number(left.version || 0) - Number(right.version || 0);
      if (versionDiff !== 0) return versionDiff;
      return Number(left.createdAt || 0) - Number(right.createdAt || 0);
    });

    if (records.length > 0) {
      merged[key] = records;
    }
  }

  return merged;
};

const mergeWorkspacePreferenceArray = (
  local: string[],
  remote: string[],
  defaultValue: string[],
): string[] => {
  const localIsDefault = arraysEqual(local, defaultValue);
  const remoteIsDefault = arraysEqual(remote, defaultValue);

  if (localIsDefault && !remoteIsDefault) {
    return remote;
  }
  if (!localIsDefault && remoteIsDefault) {
    return local;
  }
  if (localIsDefault && remoteIsDefault) {
    return local;
  }

  return mergeUnique(local, remote);
};

export const mergeStudioUserAssetStates = (args: {
  local: StudioUserAssetState;
  remote: StudioUserAssetState;
  policy?: StudioAssetSyncPolicy | null;
}): StudioAssetMergeResult => {
  const local = normalizeMergeState(args.local);
  const remote = normalizeMergeState(args.remote);
  const merged = cloneState(local);
  const decisions: StudioAssetMergeDecision[] = [];

  const applyDecision = (
    kind: MergeKind,
    summary: string,
    effect: (policy: StudioAssetSyncConflictPolicy) => void,
  ) => {
    const policy = resolveStudioAssetSyncPolicy(kind, args.policy);
    effect(policy);
    decisions.push({ kind, policy, summary });
  };

  applyDecision("main-brain", "Merged durable main-brain preference lines.", (policy) => {
    if (policy === "prefer_remote") {
      merged.mainBrainPreferences = remote.mainBrainPreferences;
      return;
    }
    if (policy === "manual_merge") {
      merged.mainBrainPreferences = {
        ...local.mainBrainPreferences,
        lines: mergeUnique(
          local.mainBrainPreferences.lines,
          remote.mainBrainPreferences.lines,
        ),
      };
      return;
    }
    merged.mainBrainPreferences = local.mainBrainPreferences;
  });

  applyDecision("main-brain-soul", "Resolved main-brain soul configuration.", (policy) => {
    if (policy === "prefer_remote") {
      merged.mainBrainSoul = remote.mainBrainSoul;
      return;
    }
    if (policy === "manual_merge") {
      merged.mainBrainSoul = {
        ...local.mainBrainSoul,
        updatedAt: Math.max(local.mainBrainSoul.updatedAt || 0, remote.mainBrainSoul.updatedAt || 0),
        persona: preferNonDefaultValue({
          local: local.mainBrainSoul.persona,
          remote: remote.mainBrainSoul.persona,
          defaultValue: DEFAULT_MAIN_BRAIN_SOUL.persona,
          localUpdatedAt: local.mainBrainSoul.updatedAt,
          remoteUpdatedAt: remote.mainBrainSoul.updatedAt,
        }),
        tone: mergeUnique(local.mainBrainSoul.tone, remote.mainBrainSoul.tone),
        workingStyle: mergeUnique(
          local.mainBrainSoul.workingStyle,
          remote.mainBrainSoul.workingStyle,
        ),
        restraintRules: mergeUnique(
          local.mainBrainSoul.restraintRules,
          remote.mainBrainSoul.restraintRules,
        ),
        selfCheckRules: mergeUnique(
          local.mainBrainSoul.selfCheckRules,
          remote.mainBrainSoul.selfCheckRules,
        ),
        riskPreference: preferNonDefaultValue({
          local: local.mainBrainSoul.riskPreference,
          remote: remote.mainBrainSoul.riskPreference,
          defaultValue: DEFAULT_MAIN_BRAIN_SOUL.riskPreference,
          localUpdatedAt: local.mainBrainSoul.updatedAt,
          remoteUpdatedAt: remote.mainBrainSoul.updatedAt,
        }),
      };
      return;
    }
    merged.mainBrainSoul = local.mainBrainSoul;
  });

  applyDecision("main-brain-user", "Resolved main-brain user configuration.", (policy) => {
    if (policy === "prefer_remote") {
      merged.mainBrainUser = remote.mainBrainUser;
      return;
    }
    if (policy === "manual_merge") {
      merged.mainBrainUser = {
        ...local.mainBrainUser,
        updatedAt: Math.max(local.mainBrainUser.updatedAt || 0, remote.mainBrainUser.updatedAt || 0),
        goals: mergeUnique(local.mainBrainUser.goals, remote.mainBrainUser.goals),
        workingHabits: mergeUnique(
          local.mainBrainUser.workingHabits,
          remote.mainBrainUser.workingHabits,
        ),
        businessContext: mergeUnique(
          local.mainBrainUser.businessContext,
          remote.mainBrainUser.businessContext,
        ),
        aestheticPreferences: mergeUnique(
          local.mainBrainUser.aestheticPreferences,
          remote.mainBrainUser.aestheticPreferences,
        ),
        communicationStyle: mergeUnique(
          local.mainBrainUser.communicationStyle,
          remote.mainBrainUser.communicationStyle,
        ),
        permanentNotes: mergeUnique(
          local.mainBrainUser.permanentNotes,
          remote.mainBrainUser.permanentNotes,
        ),
        memoryBlacklist: mergeUnique(
          local.mainBrainUser.memoryBlacklist,
          remote.mainBrainUser.memoryBlacklist,
        ),
      };
      return;
    }
    merged.mainBrainUser = local.mainBrainUser;
  });

  applyDecision("main-brain-workflow", "Resolved main-brain workflow configuration.", (policy) => {
    if (policy === "prefer_remote") {
      merged.mainBrainWorkflow = remote.mainBrainWorkflow;
      return;
    }
    if (policy === "manual_merge") {
      merged.mainBrainWorkflow = {
        ...local.mainBrainWorkflow,
        updatedAt: Math.max(
          local.mainBrainWorkflow.updatedAt || 0,
          remote.mainBrainWorkflow.updatedAt || 0,
        ),
        defaultAnalysisDepth: preferNonDefaultValue({
          local: local.mainBrainWorkflow.defaultAnalysisDepth,
          remote: remote.mainBrainWorkflow.defaultAnalysisDepth,
          defaultValue: DEFAULT_MAIN_BRAIN_WORKFLOW.defaultAnalysisDepth,
          localUpdatedAt: local.mainBrainWorkflow.updatedAt,
          remoteUpdatedAt: remote.mainBrainWorkflow.updatedAt,
        }),
        searchPolicy: preferNonDefaultValue({
          local: local.mainBrainWorkflow.searchPolicy,
          remote: remote.mainBrainWorkflow.searchPolicy,
          defaultValue: DEFAULT_MAIN_BRAIN_WORKFLOW.searchPolicy,
          localUpdatedAt: local.mainBrainWorkflow.updatedAt,
          remoteUpdatedAt: remote.mainBrainWorkflow.updatedAt,
        }),
        clarifyBeforeExecution: preferNonDefaultValue({
          local: local.mainBrainWorkflow.clarifyBeforeExecution,
          remote: remote.mainBrainWorkflow.clarifyBeforeExecution,
          defaultValue: DEFAULT_MAIN_BRAIN_WORKFLOW.clarifyBeforeExecution,
          localUpdatedAt: local.mainBrainWorkflow.updatedAt,
          remoteUpdatedAt: remote.mainBrainWorkflow.updatedAt,
        }),
        toolUseGuidelines: mergeUnique(
          local.mainBrainWorkflow.toolUseGuidelines,
          remote.mainBrainWorkflow.toolUseGuidelines,
        ),
        failureRecoveryRules: mergeUnique(
          local.mainBrainWorkflow.failureRecoveryRules,
          remote.mainBrainWorkflow.failureRecoveryRules,
        ),
        roleGovernanceDefaults: {
          mode: preferNonDefaultValue({
            local: local.mainBrainWorkflow.roleGovernanceDefaults.mode,
            remote: remote.mainBrainWorkflow.roleGovernanceDefaults.mode,
            defaultValue: DEFAULT_MAIN_BRAIN_WORKFLOW.roleGovernanceDefaults.mode,
            localUpdatedAt: local.mainBrainWorkflow.updatedAt,
            remoteUpdatedAt: remote.mainBrainWorkflow.updatedAt,
          }),
          allowDraft: preferNonDefaultValue({
            local: local.mainBrainWorkflow.roleGovernanceDefaults.allowDraft,
            remote: remote.mainBrainWorkflow.roleGovernanceDefaults.allowDraft,
            defaultValue: DEFAULT_MAIN_BRAIN_WORKFLOW.roleGovernanceDefaults.allowDraft,
            localUpdatedAt: local.mainBrainWorkflow.updatedAt,
            remoteUpdatedAt: remote.mainBrainWorkflow.updatedAt,
          }),
          allowAutoPromote: preferNonDefaultValue({
            local: local.mainBrainWorkflow.roleGovernanceDefaults.allowAutoPromote,
            remote: remote.mainBrainWorkflow.roleGovernanceDefaults.allowAutoPromote,
            defaultValue: DEFAULT_MAIN_BRAIN_WORKFLOW.roleGovernanceDefaults.allowAutoPromote,
            localUpdatedAt: local.mainBrainWorkflow.updatedAt,
            remoteUpdatedAt: remote.mainBrainWorkflow.updatedAt,
          }),
          allowAutoArchive: preferNonDefaultValue({
            local: local.mainBrainWorkflow.roleGovernanceDefaults.allowAutoArchive,
            remote: remote.mainBrainWorkflow.roleGovernanceDefaults.allowAutoArchive,
            defaultValue: DEFAULT_MAIN_BRAIN_WORKFLOW.roleGovernanceDefaults.allowAutoArchive,
            localUpdatedAt: local.mainBrainWorkflow.updatedAt,
            remoteUpdatedAt: remote.mainBrainWorkflow.updatedAt,
          }),
        },
      };
      return;
    }
    merged.mainBrainWorkflow = local.mainBrainWorkflow;
  });

  applyDecision("main-brain-memory", "Resolved main-brain memory configuration.", (policy) => {
    if (policy === "prefer_remote") {
      merged.mainBrainMemory = remote.mainBrainMemory;
      return;
    }
    if (policy === "manual_merge") {
      merged.mainBrainMemory = {
        ...local.mainBrainMemory,
        updatedAt: Math.max(local.mainBrainMemory.updatedAt || 0, remote.mainBrainMemory.updatedAt || 0),
        memoryIndex: mergeUnique(
          local.mainBrainMemory.memoryIndex,
          remote.mainBrainMemory.memoryIndex,
        ),
        memoryRecords: mergeTimestampedRecordMap(
          local.mainBrainMemory.memoryRecords || {},
          remote.mainBrainMemory.memoryRecords || {},
        ),
        pendingMemoryCandidates: mergeUnique(
          local.mainBrainMemory.pendingMemoryCandidates,
          remote.mainBrainMemory.pendingMemoryCandidates,
        ),
        memoryBlacklists: mergeUnique(
          local.mainBrainMemory.memoryBlacklists,
          remote.mainBrainMemory.memoryBlacklists,
        ),
        retentionPolicy: {
          maxActiveMemories: preferNonDefaultValue({
            local: local.mainBrainMemory.retentionPolicy.maxActiveMemories,
            remote: remote.mainBrainMemory.retentionPolicy.maxActiveMemories,
            defaultValue: DEFAULT_MAIN_BRAIN_MEMORY.retentionPolicy.maxActiveMemories,
            localUpdatedAt: local.mainBrainMemory.updatedAt,
            remoteUpdatedAt: remote.mainBrainMemory.updatedAt,
          }),
          maxCandidateMemories: preferNonDefaultValue({
            local: local.mainBrainMemory.retentionPolicy.maxCandidateMemories,
            remote: remote.mainBrainMemory.retentionPolicy.maxCandidateMemories,
            defaultValue: DEFAULT_MAIN_BRAIN_MEMORY.retentionPolicy.maxCandidateMemories,
            localUpdatedAt: local.mainBrainMemory.updatedAt,
            remoteUpdatedAt: remote.mainBrainMemory.updatedAt,
          }),
          autoPromoteSimilarCount: preferNonDefaultValue({
            local: local.mainBrainMemory.retentionPolicy.autoPromoteSimilarCount,
            remote: remote.mainBrainMemory.retentionPolicy.autoPromoteSimilarCount,
            defaultValue: DEFAULT_MAIN_BRAIN_MEMORY.retentionPolicy.autoPromoteSimilarCount,
            localUpdatedAt: local.mainBrainMemory.updatedAt,
            remoteUpdatedAt: remote.mainBrainMemory.updatedAt,
          }),
        },
        dailySummary: mergeUnique(
          local.mainBrainMemory.dailySummary,
          remote.mainBrainMemory.dailySummary,
        ),
      };
      return;
    }
    merged.mainBrainMemory = local.mainBrainMemory;
  });

  applyDecision("main-brain-heartbeat", "Resolved main-brain heartbeat configuration.", (policy) => {
    if (policy === "prefer_remote") {
      merged.mainBrainHeartbeat = remote.mainBrainHeartbeat;
      return;
    }
    if (policy === "manual_merge") {
      merged.mainBrainHeartbeat = {
        ...local.mainBrainHeartbeat,
        updatedAt: Math.max(
          local.mainBrainHeartbeat.updatedAt || 0,
          remote.mainBrainHeartbeat.updatedAt || 0,
        ),
        enabled: preferNonDefaultValue({
          local: local.mainBrainHeartbeat.enabled,
          remote: remote.mainBrainHeartbeat.enabled,
          defaultValue: DEFAULT_MAIN_BRAIN_HEARTBEAT.enabled,
          localUpdatedAt: local.mainBrainHeartbeat.updatedAt,
          remoteUpdatedAt: remote.mainBrainHeartbeat.updatedAt,
        }),
        cadence: preferNonDefaultValue({
          local: local.mainBrainHeartbeat.cadence,
          remote: remote.mainBrainHeartbeat.cadence,
          defaultValue: DEFAULT_MAIN_BRAIN_HEARTBEAT.cadence,
          localUpdatedAt: local.mainBrainHeartbeat.updatedAt,
          remoteUpdatedAt: remote.mainBrainHeartbeat.updatedAt,
        }),
        scope: mergeUnique(local.mainBrainHeartbeat.scope, remote.mainBrainHeartbeat.scope),
        heartbeatTasks: {
          ...(remote.mainBrainHeartbeat.heartbeatTasks || {}),
          ...(local.mainBrainHeartbeat.heartbeatTasks || {}),
        },
        recentRunSummary: mergeUnique(
          local.mainBrainHeartbeat.recentRunSummary,
          remote.mainBrainHeartbeat.recentRunSummary,
        ),
        lastRunAt: preferNonDefaultValue({
          local: local.mainBrainHeartbeat.lastRunAt,
          remote: remote.mainBrainHeartbeat.lastRunAt,
          defaultValue: DEFAULT_MAIN_BRAIN_HEARTBEAT.lastRunAt,
          localUpdatedAt: local.mainBrainHeartbeat.updatedAt,
          remoteUpdatedAt: remote.mainBrainHeartbeat.updatedAt,
        }),
        nextRunAt: preferNonDefaultValue({
          local: local.mainBrainHeartbeat.nextRunAt,
          remote: remote.mainBrainHeartbeat.nextRunAt,
          defaultValue: DEFAULT_MAIN_BRAIN_HEARTBEAT.nextRunAt,
          localUpdatedAt: local.mainBrainHeartbeat.updatedAt,
          remoteUpdatedAt: remote.mainBrainHeartbeat.updatedAt,
        }),
      };
      return;
    }
    merged.mainBrainHeartbeat = local.mainBrainHeartbeat;
  });

  applyDecision("main-brain-bootstrap", "Resolved main-brain bootstrap configuration.", (policy) => {
    if (policy === "prefer_remote") {
      merged.mainBrainBootstrap = remote.mainBrainBootstrap;
      return;
    }
    if (policy === "manual_merge") {
      merged.mainBrainBootstrap = {
        ...local.mainBrainBootstrap,
        updatedAt: Math.max(
          local.mainBrainBootstrap.updatedAt || 0,
          remote.mainBrainBootstrap.updatedAt || 0,
        ),
        initialized: preferNonDefaultValue({
          local: local.mainBrainBootstrap.initialized,
          remote: remote.mainBrainBootstrap.initialized,
          defaultValue: DEFAULT_MAIN_BRAIN_BOOTSTRAP.initialized,
          localUpdatedAt: local.mainBrainBootstrap.updatedAt,
          remoteUpdatedAt: remote.mainBrainBootstrap.updatedAt,
        }),
        initializedAt: preferNonDefaultValue({
          local: local.mainBrainBootstrap.initializedAt,
          remote: remote.mainBrainBootstrap.initializedAt,
          defaultValue: DEFAULT_MAIN_BRAIN_BOOTSTRAP.initializedAt,
          localUpdatedAt: local.mainBrainBootstrap.updatedAt,
          remoteUpdatedAt: remote.mainBrainBootstrap.updatedAt,
        }),
        sourceTemplate: preferNonDefaultValue({
          local: local.mainBrainBootstrap.sourceTemplate,
          remote: remote.mainBrainBootstrap.sourceTemplate,
          defaultValue: DEFAULT_MAIN_BRAIN_BOOTSTRAP.sourceTemplate,
          localUpdatedAt: local.mainBrainBootstrap.updatedAt,
          remoteUpdatedAt: remote.mainBrainBootstrap.updatedAt,
        }),
        completedSteps: mergeUnique(
          local.mainBrainBootstrap.completedSteps,
          remote.mainBrainBootstrap.completedSteps,
        ),
        lastRebootstrapAt: preferNonDefaultValue({
          local: local.mainBrainBootstrap.lastRebootstrapAt,
          remote: remote.mainBrainBootstrap.lastRebootstrapAt,
          defaultValue: DEFAULT_MAIN_BRAIN_BOOTSTRAP.lastRebootstrapAt,
          localUpdatedAt: local.mainBrainBootstrap.updatedAt,
          remoteUpdatedAt: remote.mainBrainBootstrap.updatedAt,
        }),
      };
      return;
    }
    merged.mainBrainBootstrap = local.mainBrainBootstrap;
  });

  applyDecision("user-profile", "Resolved user profile preference state.", (policy) => {
    if (policy === "prefer_remote") {
      merged.userProfile = remote.userProfile;
      return;
    }
    if (policy === "manual_merge") {
      merged.userProfile = {
        ...local.userProfile,
        updatedAt: Math.max(local.userProfile.updatedAt || 0, remote.userProfile.updatedAt || 0),
        avatarUrl: preferNonDefaultValue({
          local: local.userProfile.avatarUrl,
          remote: remote.userProfile.avatarUrl,
          defaultValue: DEFAULT_USER_PROFILE.avatarUrl,
          localUpdatedAt: local.userProfile.updatedAt,
          remoteUpdatedAt: remote.userProfile.updatedAt,
        }),
        preferenceNotes: mergeUnique(
          local.userProfile.preferenceNotes,
          remote.userProfile.preferenceNotes,
        ),
        commonTasks: mergeUnique(
          local.userProfile.commonTasks,
          remote.userProfile.commonTasks,
        ),
        aestheticPreferences: mergeUnique(
          local.userProfile.aestheticPreferences,
          remote.userProfile.aestheticPreferences,
        ),
        brandContextNotes: mergeUnique(
          local.userProfile.brandContextNotes,
          remote.userProfile.brandContextNotes,
        ),
        memoryNotes: mergeUnique(
          local.userProfile.memoryNotes,
          remote.userProfile.memoryNotes,
        ),
      };
      return;
    }
    merged.userProfile = local.userProfile;
  });

  applyDecision("workspace-preference", "Resolved workspace preference state.", (policy) => {
    if (policy === "prefer_remote") {
      merged.workspacePreferences = remote.workspacePreferences;
      return;
    }
    if (policy === "manual_merge") {
      merged.workspacePreferences = {
        ...local.workspacePreferences,
        ...remote.workspacePreferences,
        selectedScriptModels: mergeWorkspacePreferenceArray(
          local.workspacePreferences.selectedScriptModels,
          remote.workspacePreferences.selectedScriptModels,
          DEFAULT_WORKSPACE_PREFERENCES.selectedScriptModels,
        ),
        selectedImageModels: mergeWorkspacePreferenceArray(
          local.workspacePreferences.selectedImageModels,
          remote.workspacePreferences.selectedImageModels,
          DEFAULT_WORKSPACE_PREFERENCES.selectedImageModels,
        ),
        selectedVideoModels: mergeWorkspacePreferenceArray(
          local.workspacePreferences.selectedVideoModels,
          remote.workspacePreferences.selectedVideoModels,
          DEFAULT_WORKSPACE_PREFERENCES.selectedVideoModels,
        ),
        imageModelPostPaths: {
          ...(local.workspacePreferences.imageModelPostPaths || {}),
          ...(remote.workspacePreferences.imageModelPostPaths || {}),
        },
        visualOrchestratorModel: preferNonDefaultValue({
          local: local.workspacePreferences.visualOrchestratorModel,
          remote: remote.workspacePreferences.visualOrchestratorModel,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.visualOrchestratorModel,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
        browserAgentModel: preferNonDefaultValue({
          local: local.workspacePreferences.browserAgentModel,
          remote: remote.workspacePreferences.browserAgentModel,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.browserAgentModel,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
        visualOrchestratorMaxReferenceImages: preferNonDefaultValue({
          local: local.workspacePreferences.visualOrchestratorMaxReferenceImages,
          remote: remote.workspacePreferences.visualOrchestratorMaxReferenceImages,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.visualOrchestratorMaxReferenceImages,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
        visualOrchestratorMaxInlineImageBytesMb: preferNonDefaultValue({
          local: local.workspacePreferences.visualOrchestratorMaxInlineImageBytesMb,
          remote: remote.workspacePreferences.visualOrchestratorMaxInlineImageBytesMb,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.visualOrchestratorMaxInlineImageBytesMb,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
        visualContinuity: preferNonDefaultValue({
          local: local.workspacePreferences.visualContinuity,
          remote: remote.workspacePreferences.visualContinuity,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.visualContinuity,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
        systemModeration: preferNonDefaultValue({
          local: local.workspacePreferences.systemModeration,
          remote: remote.workspacePreferences.systemModeration,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.systemModeration,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
        autoSave: preferNonDefaultValue({
          local: local.workspacePreferences.autoSave,
          remote: remote.workspacePreferences.autoSave,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.autoSave,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
        concurrentCount: preferNonDefaultValue({
          local: local.workspacePreferences.concurrentCount,
          remote: remote.workspacePreferences.concurrentCount,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.concurrentCount,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
        autoModelSelect: preferNonDefaultValue({
          local: local.workspacePreferences.autoModelSelect,
          remote: remote.workspacePreferences.autoModelSelect,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.autoModelSelect,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
        preferredImageModel: preferNonDefaultValue({
          local: local.workspacePreferences.preferredImageModel,
          remote: remote.workspacePreferences.preferredImageModel,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.preferredImageModel,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
        preferredImageProviderId: preferNonDefaultValue({
          local: local.workspacePreferences.preferredImageProviderId,
          remote: remote.workspacePreferences.preferredImageProviderId,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.preferredImageProviderId,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
        preferredVideoModel: preferNonDefaultValue({
          local: local.workspacePreferences.preferredVideoModel,
          remote: remote.workspacePreferences.preferredVideoModel,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.preferredVideoModel,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
        preferredVideoProviderId: preferNonDefaultValue({
          local: local.workspacePreferences.preferredVideoProviderId,
          remote: remote.workspacePreferences.preferredVideoProviderId,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.preferredVideoProviderId,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
        preferred3DModel: preferNonDefaultValue({
          local: local.workspacePreferences.preferred3DModel,
          remote: remote.workspacePreferences.preferred3DModel,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.preferred3DModel,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
        browserAgentChatEnabled: preferNonDefaultValue({
          local: local.workspacePreferences.browserAgentChatEnabled,
          remote: remote.workspacePreferences.browserAgentChatEnabled,
          defaultValue: DEFAULT_WORKSPACE_PREFERENCES.browserAgentChatEnabled,
          localUpdatedAt: local.workspacePreferences.updatedAt,
          remoteUpdatedAt: remote.workspacePreferences.updatedAt,
        }),
      };
      return;
    }
    merged.workspacePreferences = local.workspacePreferences;
  });

  applyDecision("plugin", "Resolved plugin preference records.", (policy) => {
    if (policy === "prefer_remote") {
      merged.pluginPreferences = remote.pluginPreferences;
      return;
    }
    if (policy === "manual_merge") {
      merged.pluginPreferences = {
        ...local.pluginPreferences,
        updatedAt: Math.max(local.pluginPreferences.updatedAt || 0, remote.pluginPreferences.updatedAt || 0),
        records: mergeTimestampedRecordMap(
          local.pluginPreferences.records || {},
          remote.pluginPreferences.records || {},
        ),
      };
      return;
    }
    merged.pluginPreferences = local.pluginPreferences;
  });

  applyDecision("skill-preference", "Resolved skill preference state.", (policy) => {
    if (policy === "prefer_remote") {
      merged.skillPreferences = remote.skillPreferences;
      return;
    }
    if (policy === "manual_merge") {
      merged.skillPreferences = {
        ...local.skillPreferences,
        updatedAt: Math.max(local.skillPreferences.updatedAt || 0, remote.skillPreferences.updatedAt || 0),
        activeQuickSkill: preferNonDefaultValue({
          local: local.skillPreferences.activeQuickSkill,
          remote: remote.skillPreferences.activeQuickSkill,
          defaultValue: DEFAULT_SKILL_PREFERENCES.activeQuickSkill,
          localUpdatedAt: local.skillPreferences.updatedAt,
          remoteUpdatedAt: remote.skillPreferences.updatedAt,
        }),
        recentSkillIds: mergeUnique(
          local.skillPreferences.recentSkillIds,
          remote.skillPreferences.recentSkillIds,
        ),
        pinnedSkillIds: mergeUnique(
          local.skillPreferences.pinnedSkillIds,
          remote.skillPreferences.pinnedSkillIds,
        ),
        customSkillConfigs: {
          ...(remote.skillPreferences.customSkillConfigs || {}),
          ...(local.skillPreferences.customSkillConfigs || {}),
        },
      };
      return;
    }
    merged.skillPreferences = local.skillPreferences;
  });

  applyDecision("role", "Resolved durable role assets, drafts, versions, and audit trails.", (policy) => {
    if (policy === "prefer_remote") {
      merged.agentPromptAddons = remote.agentPromptAddons;
      merged.latestRoleDrafts = remote.latestRoleDrafts;
      merged.roles = remote.roles;
      merged.temporaryRoleDrafts = remote.temporaryRoleDrafts;
      merged.roleVersions = remote.roleVersions;
      merged.roleAuditEntries = remote.roleAuditEntries;
      return;
    }
    if (policy === "manual_merge") {
      merged.agentPromptAddons = mergeTimestampedRecordMap(
        local.agentPromptAddons || {},
        remote.agentPromptAddons || {},
      );
      merged.latestRoleDrafts = mergeTimestampedRecordMap(
        local.latestRoleDrafts || {},
        remote.latestRoleDrafts || {},
      );
      merged.roles = mergeTimestampedRecordMap(local.roles || {}, remote.roles || {});
      merged.temporaryRoleDrafts = mergeTimestampedRecordMap(
        local.temporaryRoleDrafts || {},
        remote.temporaryRoleDrafts || {},
      );
      merged.roleVersions = mergeVersionedRecordMap(
        local.roleVersions || {},
        remote.roleVersions || {},
      );
      merged.roleAuditEntries = mergeVersionedRecordMap(
        local.roleAuditEntries || {},
        remote.roleAuditEntries || {},
      );
      return;
    }
    merged.agentPromptAddons = local.agentPromptAddons;
    merged.latestRoleDrafts = local.latestRoleDrafts;
    merged.roles = local.roles;
    merged.temporaryRoleDrafts = local.temporaryRoleDrafts;
    merged.roleVersions = local.roleVersions;
    merged.roleAuditEntries = local.roleAuditEntries;
  });

  applyDecision("style-library", "Resolved durable style libraries.", (policy) => {
    if (policy === "prefer_remote") {
      merged.styleLibraries = remote.styleLibraries;
      return;
    }
    if (policy === "manual_merge") {
      merged.styleLibraries = mergeTimestampedRecordMap(
        local.styleLibraries || {},
        remote.styleLibraries || {},
      );
      return;
    }
    merged.styleLibraries = local.styleLibraries;
  });

  applyDecision("evolution-record", "Resolved evolution records.", (policy) => {
    if (policy === "prefer_remote") {
      merged.evolutionRecords = remote.evolutionRecords;
      return;
    }
    if (policy === "manual_merge") {
      merged.evolutionRecords = mergeTimestampedRecordMap(
        local.evolutionRecords || {},
        remote.evolutionRecords || {},
      );
      return;
    }
    merged.evolutionRecords = local.evolutionRecords;
  });

  merged.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0, Date.now());

  return {
    merged,
    decisions,
  };
};
