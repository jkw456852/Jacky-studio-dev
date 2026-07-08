import assert from "node:assert/strict";
import test from "node:test";

import type { StudioSkillPreferencesAsset } from "../../../services/runtime-assets/user-asset-types.ts";
import { buildSkillAuditPanelModel } from "./skillAuditPanelData.ts";

const skillPreferences = (
  overrides: Partial<StudioSkillPreferencesAsset> = {},
): StudioSkillPreferencesAsset => ({
  schemaVersion: 1,
  updatedAt: 100,
  activeQuickSkill: null,
  recentSkillIds: [],
  pinnedSkillIds: [],
  customSkillConfigs: {},
  frontstageSkillRuntimeConfigs: {},
  ...overrides,
});

const customSkillAsset = () => ({
  id: "audit-draft-custom",
  name: "Audit Draft Custom",
  description: "Reusable workflow distilled from a successful conversation.",
  iconName: "Sparkles",
  activationHint: "Reuse the last proven workflow.",
  routeIntent: "branding" as const,
  routeLabel: "Branding",
  routeSummary: "Focus on composition and hierarchy.",
  preferredSkills: ["generateImage"],
  suggestedTaskMode: "generate",
  followUpMode: "auto-clarify" as const,
  allowAutonomousRouting: true,
  mode: "unified-sidebar-agent",
  clarifyChecklist: ["product image", "headline"],
  reusableQuestions: [],
  executionOutline: ["Clarify brief", "Generate concepts"],
  executionRecipe: ["clarify", "generateImage"],
  outputBlueprint: ["hero visual"],
  toolPolicy: ["prefer reference images"],
  instruction: "Confirm the visual goal first.",
  examplePrompt: "Make a cleaner premium poster for this product.",
  sourceConversationTitle: "618 poster sprint",
  sourceUserPrompt: "Redo the hero poster with a more premium direction.",
  distilledFromConversation: true,
  distillationMethod: "conversation-distill",
  createdAt: 10,
  updatedAt: 20,
  successfulRuns: 3,
  lastSuccessfulAt: 30,
  lastSuccessfulPrompt: "Make the KV feel more premium.",
  lastSuccessfulSummary: "Delivered three premium poster directions.",
  lastSuccessfulOutput: "Produced a hero KV and headline options.",
  tags: ["branding"],
} satisfies import("../../../services/runtime-assets/custom-skill-markdown").CustomSkillMarkdownAsset);

test("audit timeline uses the working draft as the version baseline when no governance audit trail exists yet", () => {
  const model = buildSkillAuditPanelModel({
    skillId: "audit-draft-custom",
    customSkillMarkdownAssets: [customSkillAsset()],
    skillPreferences: skillPreferences({
      customSkillConfigs: {
        "audit-draft-custom": {
          isCustomSkill: true,
          name: "Audit Draft Custom Draft",
          summary: "Draft summary for audit timeline.",
          description: "Draft summary for audit timeline.",
          instruction: "Draft instruction for audit timeline.",
          iconName: "Sparkles",
          routeIntent: "branding",
          routeLabel: "Brand Direction",
          routeSummary: "Push the premium visual system harder.",
          preferredSkills: ["workspaceSearch", "generateImage"],
          suggestedTaskMode: "research",
          followUpMode: "direct-run",
          executionRecipe: ["research", "generateImage", "generateCopy"],
          outputBlueprint: ["hero visual", "claim block"],
          examplePrompt: "Draft reusable prompt for audit panel.",
          sourceConversationTitle: "draft-conversation",
          updatedAt: 200,
          skillGovernance: {
            schemaVersion: 1,
            currentPublishedVersionId: "skill_ver__workspace__audit-draft-custom__v1",
            currentDraftVersionId: "skill_ver__workspace__audit-draft-custom__v2",
            versions: [
              {
                id: "skill_ver__workspace__audit-draft-custom__v2",
                semver: "1.1.0",
                reviewStatus: "draft",
                releaseStatus: "draft",
                createdAt: 190,
                updatedAt: 200,
                createdBy: "workspace",
                snapshot: {
                  name: "Audit Draft Custom Draft",
                  iconName: "Sparkles",
                  summary: "Draft summary for audit timeline.",
                  description: "Draft summary for audit timeline.",
                  instruction: "Draft instruction for audit timeline.",
                  routeIntent: "branding",
                  routeLabel: "Brand Direction",
                  routeSummary: "Push the premium visual system harder.",
                  preferredSkills: ["workspaceSearch", "generateImage"],
                  suggestedTaskMode: "research",
                  followUpMode: "direct-run",
                  executionRecipe: ["research", "generateImage", "generateCopy"],
                  outputBlueprint: ["hero visual", "claim block"],
                  examplePrompt: "Draft reusable prompt for audit panel.",
                  sourceConversationTitle: "draft-conversation",
                  updatedAt: 200,
                },
              },
            ],
            auditTrail: [],
          },
        },
      },
    }),
    recentMessages: [],
  });

  assert.ok(model);
  const createdEvent = model?.timeline.find(
    (item) => item.eventType === "skill.version.created",
  );
  assert.ok(createdEvent);
  assert.equal(createdEvent?.targetId, "skill_ver__workspace__audit-draft-custom__v2");
  assert.equal(
    createdEvent?.metadataSummary.some((item) => item.includes("semver: 1.1.0")),
    true,
  );

  const publishedEvent = model?.timeline.find(
    (item) => item.eventType === "skill.version.published",
  );
  assert.equal(publishedEvent, undefined);
});

test("audit panel reuses draft-aware storage notice for runtime-only custom skills", () => {
  const model = buildSkillAuditPanelModel({
    skillId: "runtime-only-draft-audit-skill",
    customSkillMarkdownAssets: [],
    skillPreferences: skillPreferences({
      customSkillConfigs: {
        "runtime-only-draft-audit-skill": {
          isCustomSkill: true,
          name: "Runtime Only Draft Audit Skill",
          summary: "Runtime only draft summary.",
          description: "Runtime only draft summary.",
          instruction: "Runtime only draft instruction.",
          iconName: "Sparkles",
          routeIntent: "branding",
          routeLabel: "Brand Direction",
          routeSummary: "Push the premium visual system harder.",
          preferredSkills: ["workspaceSearch", "generateImage"],
          suggestedTaskMode: "research",
          followUpMode: "direct-run",
          updatedAt: 200,
          skillGovernance: {
            schemaVersion: 1,
            currentPublishedVersionId:
              "skill_ver__workspace__runtime-only-draft-audit-skill__v1",
            currentDraftVersionId:
              "skill_ver__workspace__runtime-only-draft-audit-skill__v2",
            versions: [
              {
                id: "skill_ver__workspace__runtime-only-draft-audit-skill__v2",
                semver: "1.1.0",
                reviewStatus: "draft",
                releaseStatus: "draft",
                createdAt: 190,
                updatedAt: 200,
                createdBy: "workspace",
                snapshot: {
                  name: "Runtime Only Draft Audit Skill",
                  summary: "Runtime only draft summary.",
                  description: "Runtime only draft summary.",
                  instruction: "Runtime only draft instruction.",
                  routeIntent: "branding",
                  routeLabel: "Brand Direction",
                  routeSummary: "Push the premium visual system harder.",
                  preferredSkills: ["workspaceSearch", "generateImage"],
                  suggestedTaskMode: "research",
                  followUpMode: "direct-run",
                  updatedAt: 200,
                },
              },
            ],
            auditTrail: [],
          },
        },
      },
    }),
    recentMessages: [],
  });

  assert.ok(model);
  assert.equal(model?.customSkillSourceStatus, "runtime-only");
  assert.equal(model?.customSkillStorageBadge, "仅运行时");
  assert.equal(model?.customSkillStorageNotice?.title, "当前只有运行时配置");
  assert.equal(
    model?.customSkillStorageNotice?.body,
    "当前草稿不会影响线上版本，发布后会写入 Markdown Skill 文件。",
  );
});
