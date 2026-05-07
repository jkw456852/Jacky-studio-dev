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
