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
  version: 5,
  updatedAt: 1,
  mainBrainPreferences: {
    schemaVersion: 1,
    updatedAt: 1,
    lines: [],
  },
  mainBrainSoul: {
    schemaVersion: 1,
    updatedAt: 1,
    persona: "",
    tone: [],
    workingStyle: [],
    restraintRules: [],
    selfCheckRules: [],
    riskPreference: "balanced",
  },
  mainBrainUser: {
    schemaVersion: 1,
    updatedAt: 1,
    goals: [],
    workingHabits: [],
    businessContext: [],
    aestheticPreferences: [],
    communicationStyle: [],
    permanentNotes: [],
    memoryBlacklist: [],
  },
  mainBrainWorkflow: {
    schemaVersion: 1,
    updatedAt: 1,
    defaultAnalysisDepth: "balanced",
    searchPolicy: "auto",
    clarifyBeforeExecution: false,
    toolUseGuidelines: [],
    failureRecoveryRules: [],
    roleGovernanceDefaults: {
      mode: "approval_required",
      allowDraft: true,
      allowAutoPromote: false,
      allowAutoArchive: false,
    },
  },
  mainBrainMemory: {
    schemaVersion: 1,
    updatedAt: 1,
    memoryIndex: [],
    memoryRecords: {},
    pendingMemoryCandidates: [],
    memoryBlacklists: [],
    retentionPolicy: {
      maxActiveMemories: 200,
      maxCandidateMemories: 50,
      autoPromoteSimilarCount: 3,
    },
    dailySummary: [],
  },
  mainBrainHeartbeat: {
    schemaVersion: 1,
    updatedAt: 1,
    enabled: false,
    cadence: "manual",
    scope: [],
    heartbeatTasks: {},
    recentRunSummary: [],
    lastRunAt: null,
    nextRunAt: null,
  },
  mainBrainBootstrap: {
    schemaVersion: 1,
    updatedAt: 1,
    initialized: false,
    initializedAt: null,
    sourceTemplate: "",
    completedSteps: [],
    lastRebootstrapAt: null,
  },
  userProfile: {
    schemaVersion: 1,
    updatedAt: 1,
    avatarUrl: "",
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
  roles: {},
  temporaryRoleDrafts: {},
  roleVersions: {},
  roleAuditEntries: {},
  styleLibraries: {},
  styleLibraryCandidates: {},
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
    getMainBrainSoul: () => structuredClone(snapshot.mainBrainSoul),
    setMainBrainSoul: (patch) => {
      snapshot.mainBrainSoul = { ...snapshot.mainBrainSoul, ...patch };
      return structuredClone(snapshot);
    },
    getMainBrainUser: () => structuredClone(snapshot.mainBrainUser),
    setMainBrainUser: (patch) => {
      snapshot.mainBrainUser = { ...snapshot.mainBrainUser, ...patch };
      return structuredClone(snapshot);
    },
    getMainBrainWorkflow: () => structuredClone(snapshot.mainBrainWorkflow),
    setMainBrainWorkflow: (patch) => {
      snapshot.mainBrainWorkflow = { ...snapshot.mainBrainWorkflow, ...patch };
      return structuredClone(snapshot);
    },
    getMainBrainMemory: () => structuredClone(snapshot.mainBrainMemory),
    setMainBrainMemory: (patch) => {
      snapshot.mainBrainMemory = { ...snapshot.mainBrainMemory, ...patch };
      return structuredClone(snapshot);
    },
    getMainBrainHeartbeat: () => structuredClone(snapshot.mainBrainHeartbeat),
    setMainBrainHeartbeat: (patch) => {
      snapshot.mainBrainHeartbeat = { ...snapshot.mainBrainHeartbeat, ...patch };
      return structuredClone(snapshot);
    },
    getMainBrainBootstrap: () => structuredClone(snapshot.mainBrainBootstrap),
    setMainBrainBootstrap: (patch) => {
      snapshot.mainBrainBootstrap = { ...snapshot.mainBrainBootstrap, ...patch };
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
    listRoles: () => [],
    getRoleById: () => null,
    saveRole: () => null,
    archiveRole: () => structuredClone(snapshot),
    duplicateRole: () => null,
    saveTemporaryRoleDraft: () => null,
    promoteTemporaryRole: () => null,
    listRoleVersions: () => [],
    rollbackRoleVersion: () => null,
    listStyleLibraries: () => [],
    getStyleLibraryById: () => null,
    saveStyleLibrary: () => null,
    removeStyleLibrary: () => structuredClone(snapshot),
    listStyleLibraryCandidates: () => [],
    getStyleLibraryCandidateById: () => null,
    saveStyleLibraryCandidate: () => null,
    removeStyleLibraryCandidate: () => structuredClone(snapshot),
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

test("async remote sync orchestration merges durable role assets and pushes merged snapshot", async () => {
  const remote = createFetchMock();
  await pushRemoteStudioUserAssetSnapshot({
    options: {
      endpoint: "https://example.com/user-assets",
      fetchImpl: remote.fetchImpl,
    },
    snapshot: createState({
      roles: {
        "role-shared": {
          id: "role-shared",
          slug: "role-shared",
          title: "Remote Role",
          summary: "remote role",
          baseAgentId: "coco",
          source: "user",
          status: "active",
          tags: ["remote"],
          useWhen: ["remote use"],
          avoidWhen: ["remote avoid"],
          toolPolicy: {
            allowedSkills: [],
            blockedSkills: [],
            canRouteSubtasks: true,
            canUseNetworkResearch: true,
          },
          routingPolicy: {
            priority: 110,
            keywords: ["remote"],
            preferredTaskModes: [],
            autoRouteEligible: true,
          },
          promptLayers: {
            systemBaseline: "remote baseline",
            mainBrainShared: "remote main brain",
            durableRoleAddon: "remote addon",
          },
          governance: {
            mode: "auto_manage",
            requiresHumanApproval: false,
            allowMainBrainPromotion: true,
            allowMainBrainArchive: true,
            allowMainBrainMutation: true,
          },
          version: 3,
          createdAt: 2,
          updatedAt: 20,
        },
      },
      temporaryRoleDrafts: {
        "temp-remote": {
          id: "temp-remote",
          targetRoleId: "role-shared",
          targetBaseAgentId: "coco",
          title: "Remote Temp",
          summary: "remote temp",
          instructions: ["remote instruction"],
          roleStrategy: "create",
          roleStrategyReason: "remote reason",
          promotionSuggested: false,
          promotedRoleId: null,
          createdAt: 20,
          updatedAt: 20,
        },
      },
      roleVersions: {
        "role-shared": [
          {
            id: "version-remote-2",
            roleId: "role-shared",
            version: 2,
            changeType: "update",
            summary: "updated remotely",
            snapshot: {
              id: "role-shared",
              slug: "role-shared",
              title: "Remote Role v2",
              summary: "remote role",
              baseAgentId: "coco",
              source: "user",
              status: "active",
              tags: ["remote"],
              useWhen: ["remote use"],
              avoidWhen: ["remote avoid"],
              toolPolicy: {
                allowedSkills: [],
                blockedSkills: [],
                canRouteSubtasks: true,
                canUseNetworkResearch: true,
              },
              routingPolicy: {
                priority: 100,
                keywords: ["remote"],
                preferredTaskModes: [],
                autoRouteEligible: true,
              },
              promptLayers: {
                systemBaseline: "remote baseline",
                mainBrainShared: "remote main brain",
                durableRoleAddon: "remote addon",
              },
              governance: {
                mode: "approval_required",
                requiresHumanApproval: true,
                allowMainBrainPromotion: false,
                allowMainBrainArchive: false,
                allowMainBrainMutation: false,
              },
              version: 2,
              createdAt: 2,
              updatedAt: 12,
            },
            actor: "main_brain",
            createdAt: 12,
          },
          {
            id: "version-remote-3",
            roleId: "role-shared",
            version: 3,
            changeType: "update",
            summary: "promoted remotely",
            snapshot: {
              id: "role-shared",
              slug: "role-shared",
              title: "Remote Role",
              summary: "remote role",
              baseAgentId: "coco",
              source: "user",
              status: "active",
              tags: ["remote"],
              useWhen: ["remote use"],
              avoidWhen: ["remote avoid"],
              toolPolicy: {
                allowedSkills: [],
                blockedSkills: [],
                canRouteSubtasks: true,
                canUseNetworkResearch: true,
              },
              routingPolicy: {
                priority: 110,
                keywords: ["remote"],
                preferredTaskModes: [],
                autoRouteEligible: true,
              },
              promptLayers: {
                systemBaseline: "remote baseline",
                mainBrainShared: "remote main brain",
                durableRoleAddon: "remote addon",
              },
              governance: {
                mode: "auto_manage",
                requiresHumanApproval: false,
                allowMainBrainPromotion: true,
                allowMainBrainArchive: true,
                allowMainBrainMutation: true,
              },
              version: 3,
              createdAt: 2,
              updatedAt: 20,
            },
            actor: "main_brain",
            createdAt: 20,
          },
        ],
      },
      roleAuditEntries: {
        "role-shared": [
          {
            id: "audit-remote-3",
            roleId: "role-shared",
            version: 3,
            changeType: "update",
            summary: "remote audit",
            snapshot: {
              id: "role-shared",
              slug: "role-shared",
              title: "Remote Role",
              summary: "remote role",
              baseAgentId: "coco",
              source: "user",
              status: "active",
              tags: ["remote"],
              useWhen: ["remote use"],
              avoidWhen: ["remote avoid"],
              toolPolicy: {
                allowedSkills: [],
                blockedSkills: [],
                canRouteSubtasks: true,
                canUseNetworkResearch: true,
              },
              routingPolicy: {
                priority: 110,
                keywords: ["remote"],
                preferredTaskModes: [],
                autoRouteEligible: true,
              },
              promptLayers: {
                systemBaseline: "remote baseline",
                mainBrainShared: "remote main brain",
                durableRoleAddon: "remote addon",
              },
              governance: {
                mode: "auto_manage",
                requiresHumanApproval: false,
                allowMainBrainPromotion: true,
                allowMainBrainArchive: true,
                allowMainBrainMutation: true,
              },
              version: 3,
              createdAt: 2,
              updatedAt: 20,
            },
            actor: "main_brain",
            createdAt: 20,
          },
        ],
      },
    }),
  });

  const localApi = createMemoryLocalApi(
    createState({
      roles: {
        "role-shared": {
          id: "role-shared",
          slug: "role-shared",
          title: "Local Role",
          summary: "local role",
          baseAgentId: "coco",
          source: "user",
          status: "active",
          tags: ["local"],
          useWhen: ["local use"],
          avoidWhen: ["local avoid"],
          toolPolicy: {
            allowedSkills: [],
            blockedSkills: [],
            canRouteSubtasks: true,
            canUseNetworkResearch: true,
          },
          routingPolicy: {
            priority: 90,
            keywords: ["local"],
            preferredTaskModes: [],
            autoRouteEligible: true,
          },
          promptLayers: {
            systemBaseline: "local baseline",
            mainBrainShared: "local main brain",
            durableRoleAddon: "local addon",
          },
          governance: {
            mode: "approval_required",
            requiresHumanApproval: true,
            allowMainBrainPromotion: false,
            allowMainBrainArchive: false,
            allowMainBrainMutation: false,
          },
          version: 2,
          createdAt: 1,
          updatedAt: 10,
        },
      },
      temporaryRoleDrafts: {
        "temp-local": {
          id: "temp-local",
          targetRoleId: "role-shared",
          targetBaseAgentId: "coco",
          title: "Local Temp",
          summary: "local temp",
          instructions: ["local instruction"],
          roleStrategy: "augment",
          roleStrategyReason: "local reason",
          promotionSuggested: true,
          promotedRoleId: null,
          createdAt: 10,
          updatedAt: 10,
        },
      },
      roleVersions: {
        "role-shared": [
          {
            id: "version-local-1",
            roleId: "role-shared",
            version: 1,
            changeType: "create",
            summary: "created locally",
            snapshot: {
              id: "role-shared",
              slug: "role-shared",
              title: "Local Role v1",
              summary: "local role",
              baseAgentId: "coco",
              source: "user",
              status: "active",
              tags: ["local"],
              useWhen: ["local use"],
              avoidWhen: ["local avoid"],
              toolPolicy: {
                allowedSkills: [],
                blockedSkills: [],
                canRouteSubtasks: true,
                canUseNetworkResearch: true,
              },
              routingPolicy: {
                priority: 90,
                keywords: ["local"],
                preferredTaskModes: [],
                autoRouteEligible: true,
              },
              promptLayers: {
                systemBaseline: "local baseline",
                mainBrainShared: "local main brain",
                durableRoleAddon: "local addon",
              },
              governance: {
                mode: "approval_required",
                requiresHumanApproval: true,
                allowMainBrainPromotion: false,
                allowMainBrainArchive: false,
                allowMainBrainMutation: false,
              },
              version: 1,
              createdAt: 1,
              updatedAt: 1,
            },
            actor: "user",
            createdAt: 1,
          },
        ],
      },
      roleAuditEntries: {
        "role-shared": [
          {
            id: "audit-local-2",
            roleId: "role-shared",
            version: 2,
            changeType: "update",
            summary: "local audit",
            snapshot: {
              id: "role-shared",
              slug: "role-shared",
              title: "Local Role",
              summary: "local role",
              baseAgentId: "coco",
              source: "user",
              status: "active",
              tags: ["local"],
              useWhen: ["local use"],
              avoidWhen: ["local avoid"],
              toolPolicy: {
                allowedSkills: [],
                blockedSkills: [],
                canRouteSubtasks: true,
                canUseNetworkResearch: true,
              },
              routingPolicy: {
                priority: 90,
                keywords: ["local"],
                preferredTaskModes: [],
                autoRouteEligible: true,
              },
              promptLayers: {
                systemBaseline: "local baseline",
                mainBrainShared: "local main brain",
                durableRoleAddon: "local addon",
              },
              governance: {
                mode: "approval_required",
                requiresHumanApproval: true,
                allowMainBrainPromotion: false,
                allowMainBrainArchive: false,
                allowMainBrainMutation: false,
              },
              version: 2,
              createdAt: 1,
              updatedAt: 10,
            },
            actor: "user",
            createdAt: 10,
          },
        ],
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
        role: "manual_merge",
      },
    },
  });

  assert.equal(result.merged.roles["role-shared"]?.title, "Remote Role");
  assert.equal(Boolean(result.merged.temporaryRoleDrafts["temp-local"]), true);
  assert.equal(Boolean(result.merged.temporaryRoleDrafts["temp-remote"]), true);
  assert.deepEqual(
    result.merged.roleVersions["role-shared"]?.map((item) => item.version),
    [1, 2, 3],
  );
  assert.deepEqual(
    result.merged.roleAuditEntries["role-shared"]?.map((item) => item.version),
    [2, 3],
  );
  assert.equal(localApi.getSnapshot().roles["role-shared"]?.title, "Remote Role");
  assert.equal(
    remote.getEnvelope().snapshot.roles["role-shared"]?.title,
    "Remote Role",
  );
  assert.equal(Boolean(localApi.getSnapshot().temporaryRoleDrafts["temp-remote"]), true);
  assert.equal(
    Boolean(remote.getEnvelope().snapshot.temporaryRoleDrafts["temp-local"]),
    true,
  );
  assert.equal(result.remoteAuditCount >= 1, true);
});
