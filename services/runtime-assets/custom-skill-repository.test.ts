import assert from "node:assert/strict";
import test from "node:test";
import {
  listMergedCustomSkillRecords,
  listMissingMarkdownAssetSkillIds,
  mergePersistedCustomSkillConfig,
  mergeCustomSkillConfigRecord,
  resolveMergedCustomSkillRecord,
  upsertCustomSkillMarkdownAsset,
} from "./custom-skill-repository.ts";

test("mergeCustomSkillConfigRecord keeps markdown workflow truth while preserving runtime memory overlay", () => {
  const merged = mergeCustomSkillConfigRecord({
    asset: {
      id: "custom-skill-brand",
      name: "Brand Sprint",
      description: "Markdown summary",
      iconName: "Sparkles",
      activationHint: "Markdown activation hint",
      routeIntent: "branding",
      routeLabel: "Branding",
      routeSummary: "Markdown route summary",
      preferredSkills: ["generateImage"],
      suggestedTaskMode: "generate",
      followUpMode: "auto-clarify",
      allowAutonomousRouting: true,
      mode: "unified-sidebar-agent",
      clarifyChecklist: ["brand tone"],
      reusableQuestions: ["What tone should we emphasize?"],
      executionOutline: ["Align direction", "Validate KV", "Ship assets"],
      executionRecipe: ["always :: none :: Align direction first"],
      outputBlueprint: ["Direction", "KV", "Execution"],
      toolPolicy: ["Do not skip direction alignment."],
      instruction: "Use the brand workflow first.",
      examplePrompt: "Create a premium brand kit.",
      sourceConversationTitle: null,
      sourceUserPrompt: "Create a premium brand kit.",
      distilledFromConversation: false,
      tags: [],
      filePath: "/skills/brand-sprint.md",
    },
    runtimeConfig: {
      summary: "Runtime summary should not override markdown summary",
      description: "Runtime summary should not override markdown summary",
      lastSuccessfulPrompt: "Create a softer version",
      successfulRuns: 2,
    },
  });

  assert.equal(String(merged.summary || ""), "Markdown summary");
  assert.equal(String(merged.description || ""), "Markdown summary");
  assert.equal(String(merged.lastSuccessfulPrompt || ""), "Create a softer version");
  assert.equal(Number(merged.successfulRuns || 0), 2);
  assert.equal(String(merged.markdownAssetPath || ""), "/skills/brand-sprint.md");
});

test("listMergedCustomSkillRecords includes both markdown-backed and runtime-only custom skills", () => {
  const records = listMergedCustomSkillRecords({
    assets: [
      {
        id: "custom-skill-brand",
        name: "Brand Sprint",
        description: "Markdown summary",
        iconName: "Sparkles",
        activationHint: "Hint",
        routeIntent: "branding",
        routeLabel: "Branding",
        routeSummary: "Summary",
        preferredSkills: ["generateImage"],
        suggestedTaskMode: "generate",
        followUpMode: "auto-clarify",
        allowAutonomousRouting: true,
        mode: "unified-sidebar-agent",
        clarifyChecklist: [],
        reusableQuestions: [],
        executionOutline: [],
        executionRecipe: [],
        outputBlueprint: [],
        toolPolicy: [],
        instruction: "",
        examplePrompt: "",
        sourceConversationTitle: null,
        sourceUserPrompt: "",
        distilledFromConversation: false,
        tags: [],
      },
    ],
    runtimeCustomConfigs: {
      "custom-skill-brand": {
        lastSuccessfulPrompt: "Create a softer version",
      },
      "custom-skill-runtime-only": {
        isCustomSkill: true,
        name: "Runtime Only",
        iconName: "Sparkles",
      },
    },
  });

  assert.equal(records.length, 2);
  assert.equal(records.some((item) => item.id === "custom-skill-brand"), true);
  assert.equal(records.some((item) => item.id === "custom-skill-runtime-only"), true);
});

test("resolveMergedCustomSkillRecord can resolve file-only skills without runtime preference entry", () => {
  const resolved = resolveMergedCustomSkillRecord({
    skillId: "custom-skill-brand",
    assets: [
      {
        id: "custom-skill-brand",
        name: "Brand Sprint",
        description: "Markdown summary",
        iconName: "Sparkles",
        activationHint: "Hint",
        routeIntent: "branding",
        routeLabel: "Branding",
        routeSummary: "Summary",
        preferredSkills: ["generateImage"],
        suggestedTaskMode: "generate",
        followUpMode: "auto-clarify",
        allowAutonomousRouting: true,
        mode: "unified-sidebar-agent",
        clarifyChecklist: [],
        reusableQuestions: [],
        executionOutline: [],
        executionRecipe: ["always :: none :: Align direction first"],
        outputBlueprint: [],
        toolPolicy: [],
        instruction: "",
        examplePrompt: "",
        sourceConversationTitle: null,
        sourceUserPrompt: "",
        distilledFromConversation: false,
        tags: [],
      },
    ],
    runtimeCustomConfigs: {},
  });

  assert.equal(resolved?.id, "custom-skill-brand");
  assert.equal(String(resolved?.config.name || ""), "Brand Sprint");
  assert.equal(
    (resolved?.config.executionRecipe as string[] | undefined)?.[0],
    "always :: none :: Align direction first",
  );
});

test("listMissingMarkdownAssetSkillIds identifies file-backed skills whose markdown asset is gone", () => {
  const missingIds = listMissingMarkdownAssetSkillIds({
    assets: [
      {
        id: "custom-skill-brand",
        name: "Brand Sprint",
        description: "Markdown summary",
        iconName: "Sparkles",
        activationHint: "Hint",
        routeIntent: "branding",
        routeLabel: "Branding",
        routeSummary: "Summary",
        preferredSkills: ["generateImage"],
        suggestedTaskMode: "generate",
        followUpMode: "auto-clarify",
        allowAutonomousRouting: true,
        mode: "unified-sidebar-agent",
        clarifyChecklist: [],
        reusableQuestions: [],
        executionOutline: [],
        executionRecipe: [],
        outputBlueprint: [],
        toolPolicy: [],
        instruction: "",
        examplePrompt: "",
        sourceConversationTitle: null,
        sourceUserPrompt: "",
        distilledFromConversation: false,
        tags: [],
      },
    ],
    runtimeCustomConfigs: {
      "custom-skill-brand": {
        markdownAssetId: "custom-skill-brand",
        storageFormat: "markdown-file",
        lastSuccessfulPrompt: "Create a softer version",
      },
      "custom-skill-missing": {
        markdownAssetId: "custom-skill-missing",
        storageFormat: "markdown-file",
        name: "Missing Skill",
      },
      "custom-skill-runtime-only": {
        isCustomSkill: true,
        name: "Runtime Only",
      },
    },
  });

  assert.deepEqual(missingIds, ["custom-skill-missing"]);
});

test("upsertCustomSkillMarkdownAsset replaces same-id asset and keeps latest assets first", () => {
  const result = upsertCustomSkillMarkdownAsset({
    assets: [
      {
        id: "older-skill",
        name: "Older Skill",
        description: "older",
        iconName: "Sparkles",
        activationHint: "older",
        routeIntent: "branding",
        routeLabel: "Branding",
        routeSummary: "older",
        preferredSkills: [],
        suggestedTaskMode: "generate",
        followUpMode: "direct-run",
        allowAutonomousRouting: true,
        mode: "unified-sidebar-agent",
        clarifyChecklist: [],
        reusableQuestions: [],
        executionOutline: [],
        executionRecipe: [],
        outputBlueprint: [],
        toolPolicy: [],
        instruction: "",
        examplePrompt: "",
        sourceConversationTitle: null,
        sourceUserPrompt: "",
        distilledFromConversation: false,
        tags: [],
        updatedAt: 100,
      },
      {
        id: "custom-skill-brand",
        name: "Brand Sprint",
        description: "old version",
        iconName: "Sparkles",
        activationHint: "old hint",
        routeIntent: "branding",
        routeLabel: "Branding",
        routeSummary: "old",
        preferredSkills: [],
        suggestedTaskMode: "generate",
        followUpMode: "direct-run",
        allowAutonomousRouting: true,
        mode: "unified-sidebar-agent",
        clarifyChecklist: [],
        reusableQuestions: [],
        executionOutline: [],
        executionRecipe: [],
        outputBlueprint: [],
        toolPolicy: [],
        instruction: "",
        examplePrompt: "",
        sourceConversationTitle: null,
        sourceUserPrompt: "",
        distilledFromConversation: false,
        tags: [],
        updatedAt: 50,
      },
    ],
    asset: {
      id: "custom-skill-brand",
      name: "Brand Sprint Updated",
      description: "new version",
      iconName: "Sparkles",
      activationHint: "new hint",
      routeIntent: "branding",
      routeLabel: "Branding",
      routeSummary: "new",
      preferredSkills: [],
      suggestedTaskMode: "generate",
      followUpMode: "direct-run",
      allowAutonomousRouting: true,
      mode: "unified-sidebar-agent",
      clarifyChecklist: [],
      reusableQuestions: [],
      executionOutline: [],
      executionRecipe: [],
      outputBlueprint: [],
      toolPolicy: [],
      instruction: "",
      examplePrompt: "",
      sourceConversationTitle: null,
      sourceUserPrompt: "",
      distilledFromConversation: false,
      tags: [],
      updatedAt: 200,
    },
  });

  assert.equal(result.length, 2);
  assert.equal(result[0]?.id, "custom-skill-brand");
  assert.equal(result[0]?.name, "Brand Sprint Updated");
});

test("mergePersistedCustomSkillConfig promotes a saved asset to markdown-backed runtime config", () => {
  const merged = mergePersistedCustomSkillConfig({
    asset: {
      id: "custom-skill-brand",
      name: "Brand Sprint",
      description: "Markdown summary",
      iconName: "Sparkles",
      activationHint: "Hint",
      routeIntent: "branding",
      routeLabel: "Branding",
      routeSummary: "Summary",
      preferredSkills: ["generateImage"],
      suggestedTaskMode: "generate",
      followUpMode: "auto-clarify",
      allowAutonomousRouting: true,
      mode: "unified-sidebar-agent",
      clarifyChecklist: [],
      reusableQuestions: [],
      executionOutline: [],
      executionRecipe: [],
      outputBlueprint: [],
      toolPolicy: [],
      instruction: "",
      examplePrompt: "",
      sourceConversationTitle: null,
      sourceUserPrompt: "",
      distilledFromConversation: false,
      tags: [],
      filePath: "/skills/brand-sprint.md",
      updatedAt: 200,
    },
    runtimeConfig: {
      isCustomSkill: true,
      name: "Brand Sprint Draft",
      successfulRuns: 3,
      skillGovernance: {
        schemaVersion: 1,
      },
    },
  });

  assert.equal(String(merged.markdownAssetId || ""), "custom-skill-brand");
  assert.equal(String(merged.storageFormat || ""), "markdown-file");
  assert.equal(String(merged.markdownAssetPath || ""), "/skills/brand-sprint.md");
  assert.equal(Number(merged.successfulRuns || 0), 3);
  assert.equal(
    typeof merged.skillGovernance === "object" && merged.skillGovernance !== null,
    true,
  );
});

test("resolveMergedCustomSkillRecord preserves missing-markdown-asset runtime overlays", () => {
  const resolved = resolveMergedCustomSkillRecord({
    skillId: "custom-skill-missing",
    assets: [],
    runtimeCustomConfigs: {
      "custom-skill-missing": {
        isCustomSkill: true,
        name: "Missing Skill",
        summary: "Missing markdown summary",
        markdownAssetId: "custom-skill-missing",
        storageFormat: "markdown-file",
      },
    },
  });

  assert.equal(resolved?.id, "custom-skill-missing");
  assert.equal(resolved?.asset, null);
  assert.equal(resolved?.sourceStatus, "missing-markdown-asset");
  assert.equal(String(resolved?.config.name || ""), "Missing Skill");
});
