import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchRemoteStudioUserAssetEnvelope,
  pushRemoteStudioUserAssetSnapshot,
  restoreRemoteStudioUserAssetAuditEntry,
} from "./remote-user-assets.ts";
import { syncStudioUserAssetsWithRemoteEndpoint } from "./sync-service.ts";
import type { StudioUserAssetState } from "./user-asset-types.ts";
import type { StudioUserAssetApi } from "./api.ts";

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

const createMemoryLocalApi = (initial: StudioUserAssetState): StudioUserAssetApi => {
  let snapshot = structuredClone(initial);
  return {
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
};

const createFetchMock = () => {
  let envelope = {
    snapshot: createState(),
    auditEntries: [] as Array<Record<string, unknown>>,
  };

  const fetchImpl: typeof fetch = (async (input, init) => {
    const url = String(input);
    assert.equal(url, "https://example.com/user-assets");
    const method = init?.method || "GET";
    if (method === "GET") {
      return new Response(JSON.stringify(envelope), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (method === "PUT") {
      envelope = JSON.parse(String(init?.body || "{}"));
      return new Response(JSON.stringify(envelope), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("unsupported", { status: 405 });
  }) as typeof fetch;

  return {
    fetchImpl,
    getEnvelope: () => structuredClone(envelope),
  };
};

test("remote asset helpers can push snapshot and restore by audit entry", async () => {
  const remote = createFetchMock();
  await pushRemoteStudioUserAssetSnapshot({
    options: {
      endpoint: "https://example.com/user-assets",
      fetchImpl: remote.fetchImpl,
    },
    snapshot: createState({
      mainBrainPreferences: {
        schemaVersion: 1,
        updatedAt: 2,
        lines: ["remote-brain"],
      },
    }),
    audit: {
      summary: "Saved remote snapshot.",
      targetKind: "workspace-preference",
    },
  });

  const envelopeAfterPush = await fetchRemoteStudioUserAssetEnvelope({
    endpoint: "https://example.com/user-assets",
    fetchImpl: remote.fetchImpl,
  });
  assert.deepEqual(envelopeAfterPush.snapshot.mainBrainPreferences.lines, [
    "remote-brain",
  ]);
  assert.equal(envelopeAfterPush.auditEntries.length, 1);

  const restoreTargetId = String(envelopeAfterPush.auditEntries[0]?.id || "");
  await pushRemoteStudioUserAssetSnapshot({
    options: {
      endpoint: "https://example.com/user-assets",
      fetchImpl: remote.fetchImpl,
    },
    snapshot: createState({
      mainBrainPreferences: {
        schemaVersion: 1,
        updatedAt: 3,
        lines: ["changed"],
      },
    }),
    audit: {
      summary: "Saved newer remote snapshot.",
      targetKind: "workspace-preference",
    },
  });

  const restored = await restoreRemoteStudioUserAssetAuditEntry({
    options: {
      endpoint: "https://example.com/user-assets",
      fetchImpl: remote.fetchImpl,
    },
    auditEntryId: restoreTargetId,
  });
  assert.deepEqual(restored.snapshot.mainBrainPreferences.lines, ["remote-brain"]);
  assert.equal(restored.auditEntries.length >= 2, true);
});

test("async remote sync orchestration merges local and remote snapshots", async () => {
  const remote = createFetchMock();
  await pushRemoteStudioUserAssetSnapshot({
    options: {
      endpoint: "https://example.com/user-assets",
      fetchImpl: remote.fetchImpl,
    },
    snapshot: createState({
      mainBrainPreferences: {
        schemaVersion: 1,
        updatedAt: 2,
        lines: ["remote"],
      },
    }),
  });

  const localApi = createMemoryLocalApi(
    createState({
      mainBrainPreferences: {
        schemaVersion: 1,
        updatedAt: 1,
        lines: ["local"],
      },
    }),
  );

  const result = await syncStudioUserAssetsWithRemoteEndpoint({
    localApi,
    remote: {
      endpoint: "https://example.com/user-assets",
      fetchImpl: remote.fetchImpl,
    },
    policy: {
      defaultPolicy: "prefer_local",
      perAssetKind: {
        "main-brain": "manual_merge",
      },
    },
  });

  assert.deepEqual(result.merged.mainBrainPreferences.lines, ["local", "remote"]);
  assert.deepEqual(localApi.getSnapshot().mainBrainPreferences.lines, [
    "local",
    "remote",
  ]);
  assert.deepEqual(
    remote.getEnvelope().snapshot.mainBrainPreferences.lines,
    ["local", "remote"],
  );
});
