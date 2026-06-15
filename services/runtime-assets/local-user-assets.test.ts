import assert from "node:assert/strict";
import test from "node:test";
import { createLocalStudioUserAssetApi } from "./local-user-assets.ts";

const createStorageMock = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
};

const withMockWindow = (storage: Storage, run: () => void) => {
  storage.setItem("debug_model_mapping_writes", "off");
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
  });
  try {
    run();
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).window;
    }
  }
};

test("local asset api writes audit checkpoints and can replace snapshot", () => {
  const storage = createStorageMock();
  withMockWindow(storage, () => {
    const api = createLocalStudioUserAssetApi();
    api.setWorkspacePreferences({
      selectedImageModels: ["first-model"],
    });

    const firstAudit = api.listAuditEntries();
    assert.equal(firstAudit.length > 0, true);
    assert.equal(firstAudit[0]?.targetKind, "workspace-preference");

    const snapshot = api.getSnapshot();
    snapshot.mainBrainPreferences.lines = ["brain-a", "brain-b"];
    api.replaceSnapshot(snapshot, {
      audit: {
        action: "update",
        targetKind: "workspace-preference",
        summary: "Applied test snapshot.",
      },
    });

    assert.deepEqual(api.getMainBrainPreferences(), ["brain-a", "brain-b"]);
    assert.equal(api.listAuditEntries()[0]?.summary, "Applied test snapshot.");
  });
});

test("local asset api migrates legacy workspace and quick-skill keys into unified snapshot", () => {
  const storage = createStorageMock();
  storage.setItem("setting_image_models", JSON.stringify(["legacy-image-model"]));
  storage.setItem(
    "workspace_active_quick_skill",
    JSON.stringify({
      id: "legacy-skill",
      name: "Legacy Skill",
      iconName: "Sparkles",
    }),
  );

  withMockWindow(storage, () => {
    const api = createLocalStudioUserAssetApi();
    const snapshot = api.getSnapshot();
    assert.deepEqual(snapshot.workspacePreferences.selectedImageModels, [
      "legacy-image-model",
    ]);
    assert.equal(snapshot.skillPreferences.activeQuickSkill?.id, "legacy-skill");

    const rawUnified = storage.getItem("studio_user_assets_v1");
    assert.equal(Boolean(rawUnified), true);
    assert.equal(Boolean(storage.getItem("workspace_active_quick_skill")), true);
  });
});

test("local asset api can rollback to previous audit checkpoint", () => {
  const storage = createStorageMock();
  withMockWindow(storage, () => {
    const api = createLocalStudioUserAssetApi();
    api.setWorkspacePreferences({
      selectedImageModels: ["first-model"],
    });
    const baselineAuditId = api.listAuditEntries()[0]?.id || "";

    api.setWorkspacePreferences({
      selectedImageModels: ["second-model"],
    });
    assert.deepEqual(api.getWorkspacePreferences().selectedImageModels, [
      "second-model",
    ]);

    api.rollbackToAuditEntry(baselineAuditId);
    assert.deepEqual(api.getWorkspacePreferences().selectedImageModels, [
      "first-model",
    ]);
  });
});

test("local asset api preserves legacy style-library keys so delete survives reload", () => {
  const storage = createStorageMock();
  const now = Date.now();
  storage.setItem(
    "studio_user_assets_v1",
    JSON.stringify({
      version: 5,
      updatedAt: now,
      mainBrainPreferences: {
        schemaVersion: 1,
        updatedAt: now,
        lines: [],
      },
      mainBrainSoul: {
        schemaVersion: 1,
        updatedAt: now,
        persona: "",
        tone: [],
        workingStyle: [],
        restraintRules: [],
        selfCheckRules: [],
        riskPreference: "balanced",
      },
      mainBrainUser: {
        schemaVersion: 1,
        updatedAt: now,
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
        updatedAt: now,
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
        updatedAt: now,
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
        updatedAt: now,
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
        updatedAt: now,
        initialized: false,
        initializedAt: null,
        sourceTemplate: "",
        completedSteps: [],
        lastRebootstrapAt: null,
      },
      userProfile: {
        schemaVersion: 1,
        updatedAt: now,
        avatarUrl: "",
        preferenceNotes: [],
        commonTasks: [],
        aestheticPreferences: [],
        brandContextNotes: [],
        memoryNotes: [],
      },
      workspacePreferences: {
        schemaVersion: 1,
        updatedAt: now,
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
        updatedAt: now,
        activeQuickSkill: null,
        recentSkillIds: [],
        pinnedSkillIds: [],
        customSkillConfigs: {},
      },
      pluginPreferences: {
        schemaVersion: 1,
        updatedAt: now,
        records: {},
      },
      agentPromptAddons: {},
      latestRoleDrafts: {},
      roles: {},
      temporaryRoleDrafts: {},
      roleVersions: {},
      roleAuditEntries: {},
      styleLibraries: {
        "legacy-style-card": {
          title: "海报复刻",
          summary: "legacy summary",
          referenceInterpretation: "legacy interpretation",
          planningDirectives: ["plan"],
          promptDirectives: ["prompt"],
          createdBy: "user",
          updatedAt: 1,
          sourceMode: "custom",
        },
      },
      styleLibraryCandidates: {
        "legacy-candidate-card": {
          title: "多角度主体",
          summary: "legacy summary",
          referenceInterpretation: "legacy interpretation",
          planningDirectives: ["plan"],
          promptDirectives: ["prompt"],
          createdBy: "user",
          updatedAt: 1,
          createdAt: 1,
          sourceMode: "custom",
          status: "draft",
        },
      },
      evolutionRecords: {},
    }),
  );

  withMockWindow(storage, () => {
    const api = createLocalStudioUserAssetApi();
    assert.equal(api.listStyleLibraries()[0]?.id, "legacy-style-card");
    assert.equal(
      api.listStyleLibraryCandidates()[0]?.id,
      "legacy-candidate-card",
    );

    api.removeStyleLibrary("legacy-style-card");
    api.removeStyleLibraryCandidate("legacy-candidate-card");

    const reloadedApi = createLocalStudioUserAssetApi();
    assert.equal(reloadedApi.listStyleLibraries().length, 0);
    assert.equal(reloadedApi.listStyleLibraryCandidates().length, 0);
  });
});

test("local asset api can promote temporary role draft and rollback to an earlier role version", () => {
  const storage = createStorageMock();
  withMockWindow(storage, () => {
    const api = createLocalStudioUserAssetApi();
    const draft = api.saveTemporaryRoleDraft({
      targetBaseAgentId: "coco",
      title: "新品转化角色",
      summary: "负责新品图文转化策略",
      instructions: ["先给结构化分析", "再给可执行建议"],
      roleStrategy: "create",
      roleStrategyReason: "来自主脑治理建议",
      promotionSuggested: true,
    });

    assert.equal(Boolean(draft?.id), true);

    const promoted = api.promoteTemporaryRole(draft?.id || "");
    assert.equal(promoted?.status, "active");
    assert.equal(promoted?.source, "promoted");
    assert.equal(
      promoted?.promptLayers.durableRoleAddon.includes("先给结构化分析"),
      true,
    );

    const promotedDraft = api.getSnapshot().temporaryRoleDrafts[draft?.id || ""];
    assert.equal(promotedDraft?.promotedRoleId, promoted?.id);
    assert.equal(promotedDraft?.promotionSuggested, false);

    const updated = api.saveRole({
      ...promoted,
      title: "新品转化角色 v2",
      summary: "加入更强的投放归因视角",
      promptLayers: {
        ...promoted?.promptLayers,
        durableRoleAddon: "手工修订后的长期角色补充提示词",
      },
    });
    assert.equal(updated?.version, 2);

    const rolledBack = api.rollbackRoleVersion(promoted?.id || "", 1);
    assert.equal(rolledBack?.title, "新品转化角色");
    assert.equal(rolledBack?.version, 3);
    assert.equal(
      rolledBack?.promptLayers.durableRoleAddon.includes("先给结构化分析"),
      true,
    );

    assert.deepEqual(
      api.listRoleVersions(promoted?.id || "").map((item) => item.version),
      [3, 2, 1],
    );
    assert.equal(api.listAuditEntries()[0]?.targetKind, "role-version");
    assert.equal(api.listAuditEntries()[0]?.action, "rollback");
  });
});
