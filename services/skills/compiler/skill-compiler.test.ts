import assert from "node:assert/strict";
import test from "node:test";

import {
  listLegacyPresetSkillCatalogEntries,
  listLegacyCustomSkillCatalogEntries,
} from "../legacy/legacy-skill-catalog.ts";
import { resolveFrontstageSkillExecutionProfile } from "../../agents/frontstage-skill-execution.ts";
import { compileSkillPlan } from "./skill-compiler.ts";

const findPresetEntry = (frontstageId: string) => {
  const all = listLegacyPresetSkillCatalogEntries();
  const entry = all.find(
    (e) => e.legacyMetadata.frontstagePreset?.id === frontstageId,
  );
  if (!entry) throw new Error(`preset not found: ${frontstageId}`);
  return entry;
};

const buildLegacyMetadata = (entry: ReturnType<typeof findPresetEntry>) => ({
  allowAutonomousRouting: true,
  enableWebSearch: true,
  skillData: entry.legacyMetadata.skillData,
});

test("compileSkillPlan returns the manifest-backed plan for builtin preset", () => {
  const entry = findPresetEntry("autonomous-social-campaign");
  const plan = compileSkillPlan({
    version: entry.version,
    metadata: { allowAutonomousRouting: true, enableWebSearch: true },
  });

  assert.equal(plan.active, true);
  assert.equal(plan.skillDefinitionId, entry.definition.id);
  assert.equal(plan.skillVersionId, entry.version.id);
  assert.ok(plan.skillLabel.length > 0);
  assert.ok(plan.preferredSkills.length > 0);
  assert.ok(plan.executionRecipe.length > 0);
  assert.equal(plan.requiresAttachments, entry.legacyMetadata.frontstagePreset?.requiresAttachments === true);
});

test("compileSkillPlan agrees with resolveFrontstageSkillExecutionProfile on key plan fields", () => {
  const targets = [
    "autonomous-social-campaign",
    "autonomous-brand-system",
    "autonomous-video-director",
    "ecom-oneclick-workflow",
    "cn-detail-page",
    "blog-to-carousel-repurpose",
  ];

  for (const id of targets) {
    const entry = findPresetEntry(id);
    const legacy = buildLegacyMetadata(entry);
    const profile = resolveFrontstageSkillExecutionProfile(legacy as any);
    const plan = compileSkillPlan({
      version: entry.version,
      metadata: legacy,
    });

    assert.equal(plan.active, profile.active, `${id}: active mismatch`);
    assert.equal(plan.routeIntent, profile.routeIntent, `${id}: routeIntent mismatch`);
    assert.deepEqual(plan.preferredSkills, profile.preferredSkills, `${id}: preferredSkills mismatch`);
    assert.deepEqual(plan.blockedSkills, profile.blockedSkills, `${id}: blockedSkills mismatch`);
    assert.equal(plan.preferredFirstSkill, profile.preferredFirstSkill, `${id}: preferredFirstSkill mismatch`);
    assert.equal(plan.requiresResearchOptIn, profile.requiresResearchOptIn, `${id}: research opt-in mismatch`);
    assert.equal(plan.followUpMode, profile.followUpMode, `${id}: followUpMode mismatch`);
    assert.equal(plan.suggestedTaskMode, profile.suggestedTaskMode, `${id}: taskMode mismatch`);
    assert.deepEqual(plan.executionRecipeLines, profile.executionRecipeLines, `${id}: recipe lines mismatch`);
    assert.deepEqual(
      plan.executionRecipe.map((step) => `${step.when}::${step.skillName ?? "none"}::${step.goal}`),
      profile.executionRecipe.map((step) => `${step.when}::${step.skillName ?? "none"}::${step.goal}`),
      `${id}: parsed recipe mismatch`,
    );
    assert.deepEqual(plan.outputBlueprint, profile.outputBlueprint, `${id}: blueprint mismatch`);
    assert.deepEqual(plan.toolPolicy, profile.toolPolicy, `${id}: toolPolicy mismatch`);
    assert.deepEqual(plan.clarifyChecklist, profile.clarifyChecklist, `${id}: clarifyChecklist mismatch`);
    assert.deepEqual(plan.executionOutline, profile.executionOutline, `${id}: executionOutline mismatch`);
  }
});

test("compileSkillPlan adds workspaceSearch to blocked list when web research disabled", () => {
  const entry = findPresetEntry("autonomous-social-campaign");
  const plan = compileSkillPlan({
    version: entry.version,
    metadata: { allowAutonomousRouting: true, enableWebSearch: false },
  });
  assert.equal(plan.blockedSkills.includes("workspaceSearch"), true);
});

test("compileSkillPlan keeps active=false when allowAutonomousRouting is missing", () => {
  const entry = findPresetEntry("autonomous-social-campaign");
  const plan = compileSkillPlan({ version: entry.version });
  assert.equal(plan.active, false);
});

test("compileSkillPlan handles a custom skill manifest", () => {
  const customEntries = listLegacyCustomSkillCatalogEntries({
    customSkillMarkdownAssets: [],
    runtimeCustomConfigs: {
      "demo-custom-1": {
        name: "Demo Brand Skill",
        routeIntent: "branding",
        preferredSkills: ["generateImage"],
        executionRecipe: [
          "always :: none :: 锁定 brand 调性",
          "visual-request :: generateImage :: 输出 KV",
        ],
        toolPolicy: ["不要把整套轮播压成一张图"],
        outputBlueprint: ["主 KV", "辅助应用图"],
        clarifyChecklist: ["要不要补 logo？"],
        reusableQuestions: ["品牌色和受众"],
        executionOutline: ["先理解 brand", "再产出 KV"],
        instruction: "保持 brand voice",
        isCustomSkill: true,
        allowAutonomousRouting: true,
      },
    },
  });
  assert.ok(customEntries.length > 0, "expected at least one custom skill entry");
  const entry = customEntries[0];
  const plan = compileSkillPlan({
    version: entry.version,
    metadata: { allowAutonomousRouting: true, enableWebSearch: true },
  });

  assert.equal(plan.active, true);
  assert.equal(plan.isCustomSkill, true);
  assert.equal(plan.routeIntent, "branding");
  assert.deepEqual(plan.preferredSkills, ["generateImage"]);
  assert.ok(plan.blockedSkills.includes("generateImage"));
  assert.equal(plan.preferredFirstSkill, null);
  assert.ok(plan.outputBlueprint.length > 0);
  assert.ok(plan.executionOutline.length > 0);
  assert.equal(plan.instruction.length > 0, true);
});
