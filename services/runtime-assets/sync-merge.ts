import type { StudioUserAssetState } from "./user-asset-types.ts";
import type {
  StudioAssetSyncConflictPolicy,
  StudioAssetSyncPolicy,
} from "./sync-policy.ts";
import { resolveStudioAssetSyncPolicy } from "./sync-policy.ts";

type MergeKind =
  | "main-brain"
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

const mergeUnique = (left: string[], right: string[]): string[] =>
  Array.from(new Set([...(left || []), ...(right || [])])).filter(Boolean);

const DEFAULT_USER_PROFILE = {
  avatarUrl: "",
  preferenceNotes: [] as string[],
  commonTasks: [] as string[],
  aestheticPreferences: [] as string[],
  brandContextNotes: [] as string[],
  memoryNotes: [] as string[],
};

const DEFAULT_WORKSPACE_PREFERENCES = {
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
  const local = cloneState(args.local);
  const remote = cloneState(args.remote);
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

  applyDecision("role", "Resolved role addons and temporary role drafts.", (policy) => {
    if (policy === "prefer_remote") {
      merged.agentPromptAddons = remote.agentPromptAddons;
      merged.latestRoleDrafts = remote.latestRoleDrafts;
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
      return;
    }
    merged.agentPromptAddons = local.agentPromptAddons;
    merged.latestRoleDrafts = local.latestRoleDrafts;
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
