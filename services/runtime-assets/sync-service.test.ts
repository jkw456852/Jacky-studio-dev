import assert from "node:assert/strict";
import test from "node:test";
import type { StudioUserAssetApi } from "./api.ts";
import { syncStudioUserAssets } from "./sync-service.ts";
import type { StudioUserAssetState } from "./user-asset-types.ts";

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

const createMemoryApi = (initial: StudioUserAssetState): StudioUserAssetApi => {
  let snapshot = structuredClone(initial);
  const api: StudioUserAssetApi = {
    getSnapshot: () => structuredClone(snapshot),
    getMainBrainPreferences: () => [...snapshot.mainBrainPreferences.lines],
    setMainBrainPreferences: (lines) => {
      snapshot.mainBrainPreferences.lines = [...lines];
      return structuredClone(snapshot);
    },
    getUserProfile: () => structuredClone(snapshot.userProfile),
    setUserProfile: (patch) => {
      snapshot.userProfile = { ...snapshot.userProfile, ...patch };
      return structuredClone(snapshot);
    },
    getWorkspacePreferences: () => structuredClone(snapshot.workspacePreferences),
    setWorkspacePreferences: (patch) => {
      snapshot.workspacePreferences = {
        ...snapshot.workspacePreferences,
        ...patch,
      };
      return structuredClone(snapshot);
    },
    getSkillPreferences: () => structuredClone(snapshot.skillPreferences),
    setSkillPreferences: (patch) => {
      snapshot.skillPreferences = { ...snapshot.skillPreferences, ...patch };
      return structuredClone(snapshot);
    },
    getPluginPreferences: () => structuredClone(snapshot.pluginPreferences),
    setPluginPreferences: (patch) => {
      snapshot.pluginPreferences = { ...snapshot.pluginPreferences, ...patch };
      return structuredClone(snapshot);
    },
    getAgentPromptAddon: () => "",
    setAgentPromptAddon: () => structuredClone(snapshot),
    clearAgentPromptAddon: () => structuredClone(snapshot),
    getLatestRoleDraft: () => null,
    saveLatestRoleDraft: () => structuredClone(snapshot),
    clearLatestRoleDraft: () => structuredClone(snapshot),
    listStyleLibraries: () => [],
    getStyleLibraryById: () => null,
    saveStyleLibrary: () => null,
    removeStyleLibrary: () => structuredClone(snapshot),
    listEvolutionRecords: () => [],
    getEvolutionRecordById: () => null,
    saveEvolutionRecord: () => null,
    reviewEvolutionRecord: () => structuredClone(snapshot),
    listAuditEntries: () => [],
    getAuditEntryById: () => null,
    rollbackToAuditEntry: () => structuredClone(snapshot),
    replaceSnapshot: (next) => {
      snapshot = structuredClone(next);
      return structuredClone(snapshot);
    },
  };
  return api;
};

test("syncStudioUserAssets merges and writes back to both asset layers", () => {
  const local = createMemoryApi(
    createState({
      mainBrainPreferences: {
        schemaVersion: 1,
        updatedAt: 1,
        lines: ["local brain"],
      },
    }),
  );
  const remote = createMemoryApi(
    createState({
      mainBrainPreferences: {
        schemaVersion: 1,
        updatedAt: 2,
        lines: ["remote brain"],
      },
    }),
  );

  const result = syncStudioUserAssets({
    apis: { local, remote },
    policy: {
      defaultPolicy: "prefer_local",
      perAssetKind: {
        "main-brain": "manual_merge",
      },
    },
  });

  assert.deepEqual(result.merged.mainBrainPreferences.lines, [
    "local brain",
    "remote brain",
  ]);
  assert.deepEqual(local.getSnapshot().mainBrainPreferences.lines, [
    "local brain",
    "remote brain",
  ]);
  assert.deepEqual(remote.getSnapshot().mainBrainPreferences.lines, [
    "local brain",
    "remote brain",
  ]);
});
