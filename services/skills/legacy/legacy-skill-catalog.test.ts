import assert from "node:assert/strict";
import test from "node:test";
import {
  listLegacyPresetSkillCatalogEntries,
  listLegacyCustomSkillCatalogEntries,
  resolveSkillDefinitionByLegacySkillData,
  resolveSkillVersionByLegacyConfig,
  resolvePresetByLegacyFrontstageSkillId,
} from "./legacy-skill-catalog.ts";
import type { CustomSkillMarkdownAsset } from "../../runtime-assets/custom-skill-markdown.ts";

test("内置preset catalog条目完整保留legacy元数据和skillData结构", () => {
  const entries = listLegacyPresetSkillCatalogEntries();
  assert.ok(entries.length > 0);
  
  entries.forEach((entry) => {
    assert.equal(entry.legacyMetadata.source, "frontstage-preset");
    assert.ok(entry.legacyMetadata.skillData);
    assert.ok(entry.legacyMetadata.frontstagePreset);
    assert.ok(entry.definition);
    assert.ok(entry.version);
    assert.ok(entry.preset);
    
    const skillData = entry.legacyMetadata.skillData;
    assert.ok(skillData.id);
    assert.ok(skillData.name);
    assert.ok(skillData.iconName);
    assert.ok(skillData.config);
    assert.equal(typeof skillData.config, "object");
  });
  
  const presetIds = new Set(entries.map((e) => e.legacyMetadata.frontstagePreset!.id));
  assert.ok(presetIds.has("autonomous-social-campaign"));
  assert.ok(presetIds.has("social-carousel-system"));
  assert.ok(presetIds.has("brand-style-guide"));
});

test("共享相同skillDataId的不同内置preset可以被正确识别", () => {
  const entries = listLegacyPresetSkillCatalogEntries();
  
  const mainBrainEntries = entries.filter(
    (e) => e.legacyMetadata.skillData.id === "autonomous-main-brain"
  );
  assert.ok(mainBrainEntries.length > 1, "应该有多个preset共享autonomous-main-brain的skillDataId");
  
  const frontstageIds = new Set(
    mainBrainEntries.map((e) => e.legacyMetadata.skillData.config.frontstageSkillId)
  );
  assert.equal(frontstageIds.size, mainBrainEntries.length, "每个preset应该有独立的frontstageSkillId");
});

test("通过legacy frontstageSkillId可以正确解析内置preset", () => {
  const socialPreset = resolvePresetByLegacyFrontstageSkillId("social-carousel-system");
  assert.ok(socialPreset);
  assert.equal(typeof socialPreset.label, "string");
  assert.ok(socialPreset.label.length > 0);
  
  const brandPreset = resolvePresetByLegacyFrontstageSkillId("brand-style-guide");
  assert.ok(brandPreset);
  assert.equal(typeof brandPreset.label, "string");
  assert.ok(brandPreset.label.length > 0);
  
  const brandVersion = resolveSkillVersionByLegacyConfig({
    frontstageSkillId: "brand-style-guide",
  });
  assert.ok(brandVersion);
  assert.equal(brandVersion.manifest.identity.key.includes("brand-style-guide"), true);
  
  const sampleSkillData = listLegacyPresetSkillCatalogEntries()[0].legacyMetadata.skillData;
  const resolvedDefinition = resolveSkillDefinitionByLegacySkillData(sampleSkillData);
  assert.ok(resolvedDefinition);
  assert.equal(resolvedDefinition.name, sampleSkillData.name);
});

test("自定义skill条目正确暴露exampleSet和performanceOverlay字段", () => {
  const testCustomAsset: CustomSkillMarkdownAsset = {
    id: "test-custom-skill",
    name: "测试自定义技能",
    description: "自定义技能描述",
    iconName: "Sparkles",
    activationHint: "测试提示",
    routeIntent: "general",
    routeLabel: "自定义技能",
    routeSummary: "测试摘要",
    preferredSkills: [],
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
    instruction: "测试指令",
    examplePrompt: "测试示例prompt",
    sourceConversationTitle: null,
    sourceUserPrompt: "",
    distilledFromConversation: false,
    tags: [],
    successfulRuns: 5,
    lastSuccessfulAt: Date.now(),
    lastSuccessfulPrompt: "最近一次成功prompt",
  };
  
  const entries = listLegacyCustomSkillCatalogEntries({
    customSkillMarkdownAssets: [testCustomAsset],
    runtimeCustomConfigs: {
      "test-custom-skill": {
        successfulRuns: 5,
        lastSuccessfulAt: testCustomAsset.lastSuccessfulAt,
        lastSuccessfulPrompt: testCustomAsset.lastSuccessfulPrompt,
      },
    },
  });
  
  assert.equal(entries.length, 1);
  const customEntry = entries[0];
  assert.equal(customEntry.legacyMetadata.source, "custom-skill");
  
  assert.ok(customEntry.performanceOverlay);
  assert.equal(customEntry.performanceOverlay.successfulRuns, 5);
  assert.equal(customEntry.performanceOverlay.lastSuccessfulAt, testCustomAsset.lastSuccessfulAt);
  
  assert.ok(customEntry.exampleSet);
  assert.ok(customEntry.exampleSet.examples.length >= 1);
  assert.ok(customEntry.exampleSet.examples.some(e => e.prompt === testCustomAsset.examplePrompt));
});

test("通过markdownAssetId或legacySkillId可以正确解析自定义skill", () => {
  const testCustomAsset: CustomSkillMarkdownAsset = {
    id: "test-custom-skill-2",
    name: "测试自定义技能2",
    description: "自定义技能描述2",
    iconName: "Image",
    activationHint: "测试提示2",
    routeIntent: "branding",
    routeLabel: "自定义品牌技能",
    routeSummary: "测试摘要2",
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
    instruction: "测试指令2",
    examplePrompt: "测试示例prompt2",
    sourceConversationTitle: null,
    sourceUserPrompt: "",
    distilledFromConversation: false,
    tags: [],
  };
  
  const version1 = resolveSkillVersionByLegacyConfig(
    {
      isCustomSkill: true,
      markdownAssetId: "test-custom-skill-2",
    },
    {
      customSkillMarkdownAssets: [testCustomAsset],
    }
  );
  assert.ok(version1);
  assert.equal(version1.manifest.identity.displayName, "测试自定义技能2");
  
  const version2 = resolveSkillVersionByLegacyConfig(
    {
      isCustomSkill: true,
    },
    {
      customSkillMarkdownAssets: [testCustomAsset],
      legacySkillId: "test-custom-skill-2",
    }
  );
  assert.ok(version2);
  assert.equal(version2.manifest.identity.displayName, "测试自定义技能2");
  
  const customPreset = resolvePresetByLegacyFrontstageSkillId("test-custom-skill-2", {
    customSkillMarkdownAssets: [testCustomAsset],
  });
  assert.ok(customPreset);
  assert.equal(customPreset.iconName, "Image");
});
