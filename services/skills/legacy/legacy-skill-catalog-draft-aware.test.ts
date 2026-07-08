import assert from "node:assert/strict";
import test from "node:test";

import type { CustomSkillMarkdownAsset } from "../../runtime-assets/custom-skill-markdown.ts";
import {
  resolvePresetByLegacyFrontstageSkillId,
  resolveSkillDefinitionByLegacySkillData,
  resolveSkillVersionByLegacyConfig,
} from "./legacy-skill-catalog.ts";

const sampleCustomAsset: CustomSkillMarkdownAsset = {
  id: "draft-aware-custom-skill",
  name: "Draft Aware Custom Skill",
  description: "legacy resolver fixture",
  iconName: "Sparkles",
  activationHint: "fixture",
  routeIntent: "general",
  routeLabel: "Draft Aware",
  routeSummary: "fixture",
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
  instruction: "fixture",
  examplePrompt: "fixture prompt",
  sourceConversationTitle: null,
  sourceUserPrompt: "",
  distilledFromConversation: false,
  tags: [],
};

const sampleDraftRuntimeConfig = {
  isCustomSkill: true,
  name: "Draft Aware Custom Skill Draft",
  summary: "Draft summary for legacy resolver.",
  description: "Draft summary for legacy resolver.",
  instruction: "Draft instruction for legacy resolver.",
  iconName: "Sparkles",
  routeIntent: "general",
  routeLabel: "Draft Aware Draft",
  routeSummary: "Draft route summary.",
  preferredSkills: ["workspaceSearch"],
  suggestedTaskMode: "research",
  followUpMode: "direct-run",
  executionRecipe: ["research", "generateCopy"],
  outputBlueprint: ["draft output"],
  updatedAt: 200,
  skillGovernance: {
    schemaVersion: 1,
    currentPublishedVersionId: "skill_ver__workspace__draft-aware-custom-skill__v1",
    currentDraftVersionId: "skill_ver__workspace__draft-aware-custom-skill__v2",
    versions: [
      {
        id: "skill_ver__workspace__draft-aware-custom-skill__v2",
        semver: "1.1.0",
        reviewStatus: "draft",
        releaseStatus: "draft",
        createdAt: 190,
        updatedAt: 200,
        createdBy: "workspace",
        snapshot: {
          name: "Draft Aware Custom Skill Draft",
          summary: "Draft summary for legacy resolver.",
          description: "Draft summary for legacy resolver.",
          instruction: "Draft instruction for legacy resolver.",
          iconName: "Sparkles",
          routeIntent: "general",
          routeLabel: "Draft Aware Draft",
          routeSummary: "Draft route summary.",
          preferredSkills: ["workspaceSearch"],
          suggestedTaskMode: "research",
          followUpMode: "direct-run",
          executionRecipe: ["research", "generateCopy"],
          outputBlueprint: ["draft output"],
          updatedAt: 200,
        },
      },
    ],
    auditTrail: [],
  },
} satisfies Record<string, unknown>;

const options = {
  customSkillMarkdownAssets: [sampleCustomAsset],
  runtimeCustomConfigs: {
    [sampleCustomAsset.id]: sampleDraftRuntimeConfig,
  },
};

test("legacy resolvers project the working draft for custom skills", () => {
  const definition = resolveSkillDefinitionByLegacySkillData(
    {
      id: sampleCustomAsset.id,
      name: sampleCustomAsset.name,
      iconName: sampleCustomAsset.iconName,
      config: {
        isCustomSkill: true,
      },
    },
    options,
  );
  assert.ok(definition);
  assert.equal(definition?.name, "Draft Aware Custom Skill Draft");
  assert.equal(
    definition?.currentDraftVersionId,
    "skill_ver__workspace__draft-aware-custom-skill__v2",
  );
  assert.equal(
    definition?.currentPublishedVersionId,
    "skill_ver__workspace__draft-aware-custom-skill__v1",
  );

  const version = resolveSkillVersionByLegacyConfig(
    {
      isCustomSkill: true,
      markdownAssetId: sampleCustomAsset.id,
    },
    options,
  );
  assert.ok(version);
  assert.equal(version?.id, "skill_ver__workspace__draft-aware-custom-skill__v2");
  assert.equal(version?.semver, "1.1.0");
  assert.equal(version?.reviewStatus, "draft");
  assert.equal(version?.releaseStatus, "draft");
  assert.equal(version?.createdAt, 190);
  assert.equal(version?.publishedAt, undefined);

  const preset = resolvePresetByLegacyFrontstageSkillId(sampleCustomAsset.id, options);
  assert.ok(preset);
  assert.equal(preset?.label, "Draft Aware Custom Skill Draft");
});
