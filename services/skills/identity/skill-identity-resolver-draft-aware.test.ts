import assert from "node:assert/strict";
import test from "node:test";

import type { CustomSkillMarkdownAsset } from "../../runtime-assets/custom-skill-markdown.ts";
import {
  resolveIdentityByDefinitionId,
  resolveIdentityByPresetId,
  resolveIdentityByVersionId,
} from "./skill-identity-resolver.ts";

const sampleCustomAsset: CustomSkillMarkdownAsset = {
  id: "identity-draft-aware-custom",
  name: "Identity Draft Aware",
  description: "identity fixture",
  iconName: "Sparkles",
  activationHint: "fixture",
  routeIntent: "general",
  routeLabel: "Identity Draft Aware",
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
  name: "Identity Draft Aware Draft",
  summary: "Draft summary for identity resolver.",
  description: "Draft summary for identity resolver.",
  instruction: "Draft instruction for identity resolver.",
  iconName: "Sparkles",
  routeIntent: "general",
  routeLabel: "Identity Draft Aware Draft",
  routeSummary: "Draft route summary.",
  preferredSkills: ["workspaceSearch"],
  suggestedTaskMode: "research",
  followUpMode: "direct-run",
  executionRecipe: ["research", "generateCopy"],
  outputBlueprint: ["draft output"],
  updatedAt: 200,
  skillGovernance: {
    schemaVersion: 1,
    currentPublishedVersionId: "skill_ver__workspace__identity-draft-aware-custom__v1",
    currentDraftVersionId: "skill_ver__workspace__identity-draft-aware-custom__v2",
    versions: [
      {
        id: "skill_ver__workspace__identity-draft-aware-custom__v2",
        semver: "1.1.0",
        reviewStatus: "draft",
        releaseStatus: "draft",
        createdAt: 190,
        updatedAt: 200,
        createdBy: "workspace",
        snapshot: {
          name: "Identity Draft Aware Draft",
          summary: "Draft summary for identity resolver.",
          description: "Draft summary for identity resolver.",
          instruction: "Draft instruction for identity resolver.",
          iconName: "Sparkles",
          routeIntent: "general",
          routeLabel: "Identity Draft Aware Draft",
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

test("identity resolver matches custom skill display ids from the working draft projection", () => {
  const byDefinition = resolveIdentityByDefinitionId(
    "skill_def__workspace__identity-draft-aware-custom",
    options,
  );
  assert.ok(byDefinition);
  assert.equal(byDefinition?.identity.scope, "workspace");
  assert.equal(byDefinition?.version.id, "skill_ver__workspace__identity-draft-aware-custom__v2");
  assert.equal(byDefinition?.version.reviewStatus, "draft");

  const byVersion = resolveIdentityByVersionId(
    "skill_ver__workspace__identity-draft-aware-custom__v2",
    options,
  );
  assert.ok(byVersion);
  assert.equal(byVersion?.identity.versionId, "skill_ver__workspace__identity-draft-aware-custom__v2");
  assert.equal(byVersion?.version.semver, "1.1.0");
  assert.equal(byVersion?.version.releaseStatus, "draft");

  const byPreset = resolveIdentityByPresetId(
    "skill_preset__workspace__identity-draft-aware-custom",
    options,
  );
  assert.ok(byPreset);
  assert.equal(byPreset?.identity.scope, "workspace");
  assert.equal(byPreset?.preset.label, "Identity Draft Aware Draft");
});
