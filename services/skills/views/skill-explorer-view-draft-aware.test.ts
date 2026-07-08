import assert from "node:assert/strict";
import test from "node:test";

import type { CustomSkillMarkdownAsset } from "../../runtime-assets/custom-skill-markdown.ts";
import { getSkillExplorerDetail } from "./skill-explorer-view.ts";

const sampleCustomAsset: CustomSkillMarkdownAsset = {
  id: "explorer-draft-aware-custom",
  name: "Explorer Draft Aware",
  description: "explorer fixture",
  iconName: "Sparkles",
  activationHint: "fixture",
  routeIntent: "branding",
  routeLabel: "Branding",
  routeSummary: "fixture",
  preferredSkills: [],
  suggestedTaskMode: "generate",
  followUpMode: "direct-run",
  allowAutonomousRouting: true,
  mode: "unified-sidebar-agent",
  clarifyChecklist: ["audience"],
  reusableQuestions: [],
  executionOutline: [],
  executionRecipe: ["always :: none :: validate"],
  outputBlueprint: ["Direction"],
  toolPolicy: ["no surprises"],
  instruction: "fixture",
  examplePrompt: "fixture prompt",
  sourceConversationTitle: null,
  sourceUserPrompt: "",
  distilledFromConversation: false,
  tags: [],
};

const sampleDraftRuntimeConfig = {
  isCustomSkill: true,
  name: "Explorer Draft Aware Draft",
  summary: "Draft explorer summary.",
  description: "Draft explorer summary.",
  instruction: "Draft explorer instruction.",
  iconName: "Sparkles",
  routeIntent: "branding",
  routeLabel: "Brand Direction",
  routeSummary: "Push the draft direction harder.",
  preferredSkills: ["workspaceSearch", "generateImage"],
  suggestedTaskMode: "research",
  followUpMode: "direct-run",
  executionRecipe: ["research", "generateImage", "generateCopy"],
  outputBlueprint: ["hero visual", "claim block"],
  updatedAt: 200,
  skillGovernance: {
    schemaVersion: 1,
    currentPublishedVersionId: "skill_ver__workspace__explorer-draft-aware-custom__v1",
    currentDraftVersionId: "skill_ver__workspace__explorer-draft-aware-custom__v2",
    versions: [
      {
        id: "skill_ver__workspace__explorer-draft-aware-custom__v2",
        semver: "1.1.0",
        reviewStatus: "draft",
        releaseStatus: "draft",
        createdAt: 190,
        updatedAt: 200,
        createdBy: "workspace",
        snapshot: {
          name: "Explorer Draft Aware Draft",
          iconName: "Sparkles",
          summary: "Draft explorer summary.",
          description: "Draft explorer summary.",
          instruction: "Draft explorer instruction.",
          routeIntent: "branding",
          routeLabel: "Brand Direction",
          routeSummary: "Push the draft direction harder.",
          preferredSkills: ["workspaceSearch", "generateImage"],
          suggestedTaskMode: "research",
          followUpMode: "direct-run",
          executionRecipe: ["research", "generateImage", "generateCopy"],
          outputBlueprint: ["hero visual", "claim block"],
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

test("explorer detail matches custom skill working draft version ids", () => {
  const byVersion = getSkillExplorerDetail(
    { kind: "versionId", value: "skill_ver__workspace__explorer-draft-aware-custom__v2" },
    options,
  );

  assert.ok(byVersion);
  assert.equal(byVersion?.definition.name, "Explorer Draft Aware Draft");
  assert.equal(byVersion?.version.id, "skill_ver__workspace__explorer-draft-aware-custom__v2");
  assert.equal(byVersion?.version.semver, "1.1.0");
  assert.equal(byVersion?.version.reviewStatus, "draft");
  assert.equal(byVersion?.version.releaseStatus, "draft");
  assert.equal(byVersion?.preset.label, "Explorer Draft Aware Draft");
});
