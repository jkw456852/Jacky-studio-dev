import assert from "node:assert/strict";
import test from "node:test";
import type { StudioRoleEntity } from "../../types/agent.types.ts";
import type { StudioUserAssetState } from "./user-asset-types.ts";
import { mergeStudioUserAssetStates } from "./sync-merge.ts";

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
    selectedScriptModels: ["gemini-3.1-flash-lite-preview"],
    selectedImageModels: ["Auto"],
    selectedVideoModels: ["veo-3.1-fast-generate-preview"],
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

test("mergeStudioUserAssetStates manual-merge keeps non-default local workspace preferences when remote is default", () => {
  const local = createState({
    workspacePreferences: {
      ...createState().workspacePreferences,
      selectedImageModels: ["local-image-model"],
      visualOrchestratorModel: "custom-orchestrator",
      autoSave: false,
    },
  });
  const remote = createState();

  const result = mergeStudioUserAssetStates({
    local,
    remote,
    policy: {
      defaultPolicy: "prefer_local",
      perAssetKind: {
        "workspace-preference": "manual_merge",
      },
    },
  });

  assert.deepEqual(result.merged.workspacePreferences.selectedImageModels, [
    "local-image-model",
  ]);
  assert.equal(
    result.merged.workspacePreferences.visualOrchestratorModel,
    "custom-orchestrator",
  );
  assert.equal(result.merged.workspacePreferences.autoSave, false);
});

test("mergeStudioUserAssetStates manual-merge keeps newer remote plugin record over older local record", () => {
  const local = createState({
    pluginPreferences: {
      schemaVersion: 1,
      updatedAt: 2,
      records: {
        alpha: {
          pluginId: "alpha",
          enabled: true,
          pinned: false,
          updatedAt: 10,
        },
      },
    },
  });
  const remote = createState({
    pluginPreferences: {
      schemaVersion: 1,
      updatedAt: 3,
      records: {
        alpha: {
          pluginId: "alpha",
          enabled: false,
          pinned: true,
          updatedAt: 20,
        },
      },
    },
  });

  const result = mergeStudioUserAssetStates({
    local,
    remote,
    policy: {
      defaultPolicy: "prefer_local",
      perAssetKind: {
        plugin: "manual_merge",
      },
    },
  });

  assert.equal(result.merged.pluginPreferences.records.alpha.enabled, false);
  assert.equal(result.merged.pluginPreferences.records.alpha.pinned, true);
});

test("mergeStudioUserAssetStates manual-merge restores remote avatar when local is empty default", () => {
  const local = createState();
  const remote = createState({
    userProfile: {
      ...createState().userProfile,
      updatedAt: 20,
      avatarUrl: "https://example.com/avatar.png",
      preferenceNotes: ["remote-note"],
    },
  });

  const result = mergeStudioUserAssetStates({
    local,
    remote,
    policy: {
      defaultPolicy: "prefer_local",
      perAssetKind: {
        "user-profile": "manual_merge",
      },
    },
  });

  assert.equal(
    result.merged.userProfile.avatarUrl,
    "https://example.com/avatar.png",
  );
  assert.deepEqual(result.merged.userProfile.preferenceNotes, ["remote-note"]);
});

test("mergeStudioUserAssetStates manual-merge keeps newer remote active quick skill over older local one", () => {
  const local = createState({
    skillPreferences: {
      schemaVersion: 1,
      updatedAt: 10,
      activeQuickSkill: {
        id: "local-skill",
        name: "Local Skill",
        iconName: "sparkles",
      },
      recentSkillIds: ["local-skill"],
      pinnedSkillIds: [],
      customSkillConfigs: {},
    },
  });
  const remote = createState({
    skillPreferences: {
      schemaVersion: 1,
      updatedAt: 20,
      activeQuickSkill: {
        id: "remote-skill",
        name: "Remote Skill",
        iconName: "wand",
      },
      recentSkillIds: ["remote-skill"],
      pinnedSkillIds: ["remote-skill"],
      customSkillConfigs: {},
    },
  });

  const result = mergeStudioUserAssetStates({
    local,
    remote,
    policy: {
      defaultPolicy: "prefer_local",
      perAssetKind: {
        "skill-preference": "manual_merge",
      },
    },
  });

  assert.equal(result.merged.skillPreferences.activeQuickSkill?.id, "remote-skill");
  assert.deepEqual(result.merged.skillPreferences.recentSkillIds, [
    "local-skill",
    "remote-skill",
  ]);
  assert.deepEqual(result.merged.skillPreferences.pinnedSkillIds, ["remote-skill"]);
});

test("mergeStudioUserAssetStates manual-merge keeps newer remote style library and evolution record", () => {
  const local = createState({
    styleLibraries: {
      shared: {
        id: "shared",
        slug: "shared",
        schemaVersion: 1,
        title: "Local Style",
        summary: "local",
        referenceInterpretation: "local",
        planningDirectives: ["local"],
        promptDirectives: ["local"],
        createdBy: "user",
        updatedAt: 10,
        sourceMode: "custom",
      },
    },
    evolutionRecords: {
      evo: {
        id: "evo",
        schemaVersion: 1,
        createdAt: 1,
        updatedAt: 10,
        category: "other",
        title: "Local Evo",
        summary: "local",
        proposal: "local",
        evidence: [],
        riskNotes: [],
        source: "manual",
        approvalStatus: "pending_review",
      },
    },
  });
  const remote = createState({
    styleLibraries: {
      shared: {
        id: "shared",
        slug: "shared",
        schemaVersion: 1,
        title: "Remote Style",
        summary: "remote",
        referenceInterpretation: "remote",
        planningDirectives: ["remote"],
        promptDirectives: ["remote"],
        createdBy: "user",
        updatedAt: 20,
        sourceMode: "custom",
      },
    },
    evolutionRecords: {
      evo: {
        id: "evo",
        schemaVersion: 1,
        createdAt: 1,
        updatedAt: 20,
        category: "other",
        title: "Remote Evo",
        summary: "remote",
        proposal: "remote",
        evidence: [],
        riskNotes: [],
        source: "manual",
        approvalStatus: "approved",
      },
    },
  });

  const result = mergeStudioUserAssetStates({
    local,
    remote,
    policy: {
      defaultPolicy: "prefer_local",
      perAssetKind: {
        "style-library": "manual_merge",
        "evolution-record": "manual_merge",
      },
    },
  });

  assert.equal(result.merged.styleLibraries.shared.title, "Remote Style");
  assert.equal(result.merged.evolutionRecords.evo.title, "Remote Evo");
  assert.equal(result.merged.evolutionRecords.evo.approvalStatus, "approved");
});

test("mergeStudioUserAssetStates manual-merge merges durable roles, temp drafts, versions, and audits", () => {
  const sharedRoleLocal: StudioRoleEntity = {
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
      priority: 100,
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
  };
  const sharedRoleRemote: StudioRoleEntity = {
    ...sharedRoleLocal,
    title: "Remote Role",
    summary: "remote role",
    tags: ["remote"],
    promptLayers: {
      systemBaseline: "remote baseline",
      mainBrainShared: "remote main brain",
      durableRoleAddon: "remote addon",
    },
    version: 3,
    updatedAt: 20,
  };

  const local = createState({
    agentPromptAddons: {
      coco: {
        agentId: "coco",
        value: "local addon",
        schemaVersion: 1,
        updatedAt: 10,
      },
    },
    latestRoleDrafts: {
      coco: {
        agentId: "coco",
        title: "Local Draft",
        summary: "local draft",
        instructions: ["local instruction"],
        schemaVersion: 1,
        updatedAt: 10,
        roleStrategy: "augment",
        roleStrategyReason: "local reason",
      },
    },
    roles: {
      "role-shared": sharedRoleLocal,
      "role-local-only": {
        ...sharedRoleLocal,
        id: "role-local-only",
        slug: "role-local-only",
        title: "Local Only Role",
        updatedAt: 11,
      },
    },
    temporaryRoleDrafts: {
      "temp-local": {
        id: "temp-local",
        targetBaseAgentId: "coco",
        title: "Temp Local",
        summary: "temp local",
        instructions: ["local temp"],
        roleStrategy: "create",
        roleStrategyReason: "local temp reason",
        promotionSuggested: true,
        createdAt: 1,
        updatedAt: 10,
      },
    },
    roleVersions: {
      "role-shared": [
        {
          id: "version-local-2",
          roleId: "role-shared",
          version: 2,
          changeType: "update",
          summary: "Local version 2",
          snapshot: sharedRoleLocal,
          actor: "user",
          createdAt: 10,
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
          summary: "Local audit 2",
          snapshot: sharedRoleLocal,
          actor: "user",
          createdAt: 10,
        },
      ],
    },
  });

  const remote = createState({
    agentPromptAddons: {
      coco: {
        agentId: "coco",
        value: "remote addon",
        schemaVersion: 1,
        updatedAt: 20,
      },
    },
    latestRoleDrafts: {
      coco: {
        agentId: "coco",
        title: "Remote Draft",
        summary: "remote draft",
        instructions: ["remote instruction"],
        schemaVersion: 1,
        updatedAt: 20,
        roleStrategy: "create",
        roleStrategyReason: "remote reason",
      },
    },
    roles: {
      "role-shared": sharedRoleRemote,
      "role-remote-only": {
        ...sharedRoleRemote,
        id: "role-remote-only",
        slug: "role-remote-only",
        title: "Remote Only Role",
        updatedAt: 21,
      },
    },
    temporaryRoleDrafts: {
      "temp-remote": {
        id: "temp-remote",
        targetBaseAgentId: "coco",
        title: "Temp Remote",
        summary: "temp remote",
        instructions: ["remote temp"],
        roleStrategy: "augment",
        roleStrategyReason: "remote temp reason",
        promotionSuggested: false,
        createdAt: 2,
        updatedAt: 20,
      },
    },
    roleVersions: {
      "role-shared": [
        {
          id: "version-remote-1",
          roleId: "role-shared",
          version: 1,
          changeType: "create",
          summary: "Remote version 1",
          snapshot: { ...sharedRoleRemote, version: 1, updatedAt: 5 },
          actor: "user",
          createdAt: 5,
        },
        {
          id: "version-remote-3",
          roleId: "role-shared",
          version: 3,
          changeType: "update",
          summary: "Remote version 3",
          snapshot: sharedRoleRemote,
          actor: "user",
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
          summary: "Remote audit 3",
          snapshot: sharedRoleRemote,
          actor: "user",
          createdAt: 20,
        },
      ],
    },
  });

  const result = mergeStudioUserAssetStates({
    local,
    remote,
    policy: {
      defaultPolicy: "prefer_local",
      perAssetKind: {
        role: "manual_merge",
      },
    },
  });

  assert.equal(result.merged.agentPromptAddons.coco?.value, "remote addon");
  assert.equal(result.merged.latestRoleDrafts.coco?.title, "Remote Draft");
  assert.equal(result.merged.roles["role-shared"]?.title, "Remote Role");
  assert.equal(Boolean(result.merged.roles["role-local-only"]), true);
  assert.equal(Boolean(result.merged.roles["role-remote-only"]), true);
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
});

test("mergeStudioUserAssetStates manual-merge restores non-default remote workspace preferences when local is default", () => {
  const local = createState();
  const remote = createState({
    workspacePreferences: {
      ...createState().workspacePreferences,
      selectedImageModels: ["remote-image-model"],
      visualOrchestratorModel: "remote-orchestrator",
      autoSave: false,
    },
  });

  const result = mergeStudioUserAssetStates({
    local,
    remote,
    policy: {
      defaultPolicy: "prefer_local",
      perAssetKind: {
        "workspace-preference": "manual_merge",
      },
    },
  });

  assert.deepEqual(result.merged.workspacePreferences.selectedImageModels, [
    "remote-image-model",
  ]);
  assert.equal(
    result.merged.workspacePreferences.visualOrchestratorModel,
    "remote-orchestrator",
  );
  assert.equal(result.merged.workspacePreferences.autoSave, false);
});
