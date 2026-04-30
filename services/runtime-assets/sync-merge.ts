import type { StudioUserAssetState } from "./user-asset-types.ts";
import type {
  StudioAssetSyncConflictPolicy,
  StudioAssetSyncPolicy,
} from "./sync-policy.ts";
import { resolveStudioAssetSyncPolicy } from "./sync-policy.ts";

type MergeKind =
  | "main-brain"
  | "role"
  | "style-library"
  | "plugin"
  | "workspace-preference";

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

  applyDecision("workspace-preference", "Resolved workspace preference state.", (policy) => {
    if (policy === "prefer_remote") {
      merged.workspacePreferences = remote.workspacePreferences;
      return;
    }
    if (policy === "manual_merge") {
      merged.workspacePreferences = {
        ...local.workspacePreferences,
        ...remote.workspacePreferences,
        selectedScriptModels: mergeUnique(
          local.workspacePreferences.selectedScriptModels,
          remote.workspacePreferences.selectedScriptModels,
        ),
        selectedImageModels: mergeUnique(
          local.workspacePreferences.selectedImageModels,
          remote.workspacePreferences.selectedImageModels,
        ),
        selectedVideoModels: mergeUnique(
          local.workspacePreferences.selectedVideoModels,
          remote.workspacePreferences.selectedVideoModels,
        ),
        imageModelPostPaths: {
          ...(local.workspacePreferences.imageModelPostPaths || {}),
          ...(remote.workspacePreferences.imageModelPostPaths || {}),
        },
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
        records: {
          ...(local.pluginPreferences.records || {}),
          ...(remote.pluginPreferences.records || {}),
        },
      };
      return;
    }
    merged.pluginPreferences = local.pluginPreferences;
  });

  applyDecision("role", "Resolved role addons and temporary role drafts.", (policy) => {
    if (policy === "prefer_remote") {
      merged.agentPromptAddons = remote.agentPromptAddons;
      merged.latestRoleDrafts = remote.latestRoleDrafts;
      return;
    }
    if (policy === "manual_merge") {
      merged.agentPromptAddons = {
        ...(local.agentPromptAddons || {}),
        ...(remote.agentPromptAddons || {}),
      };
      merged.latestRoleDrafts = {
        ...(local.latestRoleDrafts || {}),
        ...(remote.latestRoleDrafts || {}),
      };
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
      merged.styleLibraries = {
        ...(local.styleLibraries || {}),
        ...(remote.styleLibraries || {}),
      };
      return;
    }
    merged.styleLibraries = local.styleLibraries;
  });

  merged.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0, Date.now());

  return {
    merged,
    decisions,
  };
};
