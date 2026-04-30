import assert from "node:assert/strict";
import test from "node:test";
import type { StudioUserAssetState } from "./user-asset-types.ts";
import { mergeStudioUserAssetStates } from "./sync-merge.ts";

const createState = (
  patch: Partial<StudioUserAssetState> = {},
): StudioUserAssetState => ({
  version: 3,
  updatedAt: 1,
  mainBrainPreferences: {
    schemaVersion: 1,
    updatedAt: 1,
    lines: [],
  },
  userProfile: {
    schemaVersion: 1,
    updatedAt: 1,
    preferenceNotes: [],
    commonTasks: [],
    aestheticPreferences: [],
    brandContextNotes: [],
    memoryNotes: [],
  },
  workspacePreferences: {
    schemaVersion: 1,
    updatedAt: 1,
    selectedScriptModels: [],
    selectedImageModels: [],
    selectedVideoModels: [],
    imageModelPostPaths: {},
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
    preferredImageProviderId: null,
    preferredVideoModel: "veo-3.1-fast-generate-preview",
    preferredVideoProviderId: null,
    preferred3DModel: "Auto",
    browserAgentChatEnabled: true,
  },
  skillPreferences: {
    schemaVersion: 1,
    updatedAt: 1,
    activeQuickSkill: null,
    recentSkillIds: [],
    pinnedSkillIds: [],
    customSkillConfigs: {},
  },
  pluginPreferences: {
    schemaVersion: 1,
    updatedAt: 1,
    records: {},
  },
  agentPromptAddons: {},
  latestRoleDrafts: {},
  styleLibraries: {},
  evolutionRecords: {},
  ...patch,
});

test("mergeStudioUserAssetStates honors prefer_remote workspace preference policy", () => {
  const local = createState({
    workspacePreferences: {
      ...createState().workspacePreferences,
      selectedImageModels: ["local-image"],
    },
  });
  const remote = createState({
    workspacePreferences: {
      ...createState().workspacePreferences,
      selectedImageModels: ["remote-image"],
    },
  });

  const result = mergeStudioUserAssetStates({
    local,
    remote,
    policy: {
      defaultPolicy: "prefer_local",
      perAssetKind: {
        "workspace-preference": "prefer_remote",
      },
    },
  });

  assert.deepEqual(result.merged.workspacePreferences.selectedImageModels, [
    "remote-image",
  ]);
});

test("mergeStudioUserAssetStates manual-merges main brain lines", () => {
  const local = createState({
    mainBrainPreferences: {
      schemaVersion: 1,
      updatedAt: 1,
      lines: ["keep local"],
    },
  });
  const remote = createState({
    mainBrainPreferences: {
      schemaVersion: 1,
      updatedAt: 1,
      lines: ["keep remote"],
    },
  });

  const result = mergeStudioUserAssetStates({
    local,
    remote,
    policy: {
      defaultPolicy: "prefer_local",
      perAssetKind: {
        "main-brain": "manual_merge",
      },
    },
  });

  assert.deepEqual(result.merged.mainBrainPreferences.lines, [
    "keep local",
    "keep remote",
  ]);
});

test("mergeStudioUserAssetStates manual-merges plugin records", () => {
  const local = createState({
    pluginPreferences: {
      schemaVersion: 1,
      updatedAt: 1,
      records: {
        alpha: {
          pluginId: "alpha",
          enabled: true,
          pinned: false,
          updatedAt: 1,
        },
      },
    },
  });
  const remote = createState({
    pluginPreferences: {
      schemaVersion: 1,
      updatedAt: 1,
      records: {
        beta: {
          pluginId: "beta",
          enabled: false,
          pinned: true,
          updatedAt: 2,
        },
      },
    },
  });

  const result = mergeStudioUserAssetStates({
    local,
    remote,
    policy: {
      defaultPolicy: "manual_merge",
    },
  });

  assert.equal(Boolean(result.merged.pluginPreferences.records.alpha), true);
  assert.equal(Boolean(result.merged.pluginPreferences.records.beta), true);
});
