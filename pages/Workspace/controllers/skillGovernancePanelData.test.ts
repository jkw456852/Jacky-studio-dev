import assert from "node:assert/strict";
import test from "node:test";

import type { CustomSkillConfigRecord } from "../../../services/runtime-assets/custom-skill-markdown.ts";
import {
  SKILL_GOVERNANCE_OVERLAY_KEY,
  applySkillGovernanceAction,
  applySkillGovernanceDraftEdit,
  buildSkillGovernancePanelModel,
  readSkillGovernanceOverlay,
  resolveEditableCustomSkillConfig,
} from "./skillGovernancePanelData.ts";

const createBaseConfig = (): CustomSkillConfigRecord => ({
  name: "Poster Polish Skill",
  iconName: "Sparkles",
  summary: "Reusable premium poster workflow.",
  description: "Reusable premium poster workflow.",
  instruction: "Clarify goal, generate directions, then refine the chosen route.",
  customInstruction:
    "Clarify goal, generate directions, then refine the chosen route.",
  routeIntent: "branding",
  routeLabel: "Branding",
  routeSummary: "Focus on hero composition and premium hierarchy.",
  preferredSkills: ["generateImage"],
  suggestedTaskMode: "generate",
  followUpMode: "auto-clarify",
  clarifyChecklist: ["product image", "headline"],
  reusableQuestions: ["Should this feel more premium or more energetic?"],
  executionOutline: ["Clarify", "Generate", "Refine"],
  executionRecipe: ["clarify", "generateImage", "refineCopy"],
  outputBlueprint: ["hero visual", "headline direction"],
  toolPolicy: ["prefer reference images"],
  examplePrompt: "Make the poster feel more premium.",
  sourceConversationTitle: "618 poster sprint",
  sourceUserPrompt: "Redo the poster with a cleaner premium look.",
  updatedAt: 100,
});

test("draft edit creates a draft overlay without changing the live snapshot", () => {
  const result = applySkillGovernanceDraftEdit({
    skillId: "custom-skill-a",
    config: createBaseConfig(),
    nextConfig: {
      ...createBaseConfig(),
      summary: "Reusable premium poster workflow with stricter copy polish.",
      description: "Reusable premium poster workflow with stricter copy polish.",
      updatedAt: 110,
    },
    now: 110,
    actorId: "editor-a",
  });

  const overlay = result.overlay;
  assert.equal(overlay.currentPublishedVersionId, "skill_ver__workspace__custom-skill-a__v1");
  assert.equal(overlay.currentDraftVersionId, "skill_ver__workspace__custom-skill-a__v2");
  assert.equal(result.persistedConfig, undefined);
  assert.equal(result.nextRuntimeConfig.summary, "Reusable premium poster workflow.");
  assert.ok(result.nextRuntimeConfig[SKILL_GOVERNANCE_OVERLAY_KEY]);

  const editableConfig = resolveEditableCustomSkillConfig({
    skillId: "custom-skill-a",
    config: result.nextRuntimeConfig,
  });
  assert.equal(
    editableConfig.summary,
    "Reusable premium poster workflow with stricter copy polish.",
  );
});

test("governance actions move a draft through review and publish", () => {
  const draftResult = applySkillGovernanceDraftEdit({
    skillId: "custom-skill-a",
    config: createBaseConfig(),
    nextConfig: {
      ...createBaseConfig(),
      summary: "Draft summary v2",
      description: "Draft summary v2",
      updatedAt: 120,
    },
    now: 120,
    actorId: "editor-a",
  });

  const reviewingResult = applySkillGovernanceAction({
    skillId: "custom-skill-a",
    config: draftResult.nextRuntimeConfig,
    actionId: "submit_review",
    now: 130,
    actorId: "editor-a",
  });
  const approvedResult = applySkillGovernanceAction({
    skillId: "custom-skill-a",
    config: reviewingResult.nextRuntimeConfig,
    actionId: "approve",
    now: 140,
    actorId: "reviewer-a",
  });
  const publishedResult = applySkillGovernanceAction({
    skillId: "custom-skill-a",
    config: approvedResult.nextRuntimeConfig,
    actionId: "publish",
    now: 150,
    actorId: "publisher-a",
  });

  const overlay = readSkillGovernanceOverlay({
    skillId: "custom-skill-a",
    config: publishedResult.nextRuntimeConfig,
  });
  const currentPublished = overlay.versions.find(
    (version) => version.id === overlay.currentPublishedVersionId,
  );
  const previousPublished = overlay.versions.find(
    (version) => version.id === "skill_ver__workspace__custom-skill-a__v1",
  );

  assert.equal(currentPublished?.semver, "1.1.0");
  assert.equal(currentPublished?.releaseStatus, "published");
  assert.equal(currentPublished?.reviewStatus, "approved");
  assert.equal(previousPublished?.releaseStatus, "deprecated");
  assert.equal(publishedResult.persistedConfig?.summary, "Draft summary v2");
  assert.equal(publishedResult.nextRuntimeConfig.summary, "Draft summary v2");
  assert.equal(
    publishedResult.nextRuntimeConfig[SKILL_GOVERNANCE_OVERLAY_KEY] !== undefined,
    true,
  );
});

test("reject keeps the draft and marks it rejected for continued editing", () => {
  const draftResult = applySkillGovernanceDraftEdit({
    skillId: "custom-skill-a",
    config: createBaseConfig(),
    nextConfig: {
      ...createBaseConfig(),
      summary: "Draft summary pending revision",
      description: "Draft summary pending revision",
      updatedAt: 120,
    },
    now: 120,
    actorId: "editor-a",
  });
  const reviewingResult = applySkillGovernanceAction({
    skillId: "custom-skill-a",
    config: draftResult.nextRuntimeConfig,
    actionId: "submit_review",
    now: 130,
    actorId: "editor-a",
  });
  const rejectedResult = applySkillGovernanceAction({
    skillId: "custom-skill-a",
    config: reviewingResult.nextRuntimeConfig,
    actionId: "reject",
    now: 140,
    actorId: "reviewer-a",
  });

  const panel = buildSkillGovernancePanelModel({
    skillId: "custom-skill-a",
    config: rejectedResult.nextRuntimeConfig,
  });

  assert.equal(panel.reviewLabel, "已驳回");
  assert.equal(panel.hasDraft, true);
  assert.equal(panel.actions[0]?.id, "submit_review");
});

test("rollback restores the previous published snapshot", () => {
  const firstDraft = applySkillGovernanceDraftEdit({
    skillId: "custom-skill-a",
    config: createBaseConfig(),
    nextConfig: {
      ...createBaseConfig(),
      summary: "Published v2 summary",
      description: "Published v2 summary",
      updatedAt: 120,
    },
    now: 120,
    actorId: "editor-a",
  });
  const firstReview = applySkillGovernanceAction({
    skillId: "custom-skill-a",
    config: firstDraft.nextRuntimeConfig,
    actionId: "submit_review",
    now: 130,
    actorId: "editor-a",
  });
  const firstApprove = applySkillGovernanceAction({
    skillId: "custom-skill-a",
    config: firstReview.nextRuntimeConfig,
    actionId: "approve",
    now: 140,
    actorId: "reviewer-a",
  });
  const publishedV2 = applySkillGovernanceAction({
    skillId: "custom-skill-a",
    config: firstApprove.nextRuntimeConfig,
    actionId: "publish",
    now: 150,
    actorId: "publisher-a",
  });

  const rollbackResult = applySkillGovernanceAction({
    skillId: "custom-skill-a",
    config: publishedV2.nextRuntimeConfig,
    actionId: "rollback",
    now: 160,
    actorId: "publisher-a",
    targetVersionId: "skill_ver__workspace__custom-skill-a__v1",
  });

  const overlay = readSkillGovernanceOverlay({
    skillId: "custom-skill-a",
    config: rollbackResult.nextRuntimeConfig,
  });
  const restoredVersion = overlay.versions.find(
    (version) => version.id === "skill_ver__workspace__custom-skill-a__v1",
  );
  const rolledBackVersion = overlay.versions.find(
    (version) => version.id === "skill_ver__workspace__custom-skill-a__v2",
  );

  assert.equal(overlay.currentPublishedVersionId, "skill_ver__workspace__custom-skill-a__v1");
  assert.equal(restoredVersion?.releaseStatus, "published");
  assert.equal(rolledBackVersion?.releaseStatus, "rolled_back");
  assert.equal(
    rollbackResult.persistedConfig?.summary,
    "Reusable premium poster workflow.",
  );
  assert.equal(
    rollbackResult.nextRuntimeConfig.summary,
    "Reusable premium poster workflow.",
  );
});
