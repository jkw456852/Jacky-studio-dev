import assert from "node:assert/strict";
import test from "node:test";

import type { CustomSkillMarkdownAsset } from "../../../services/runtime-assets/custom-skill-markdown.ts";
import {
  listCustomSkillBookCardModels,
  listFrontstageSkillBookCardModels,
  listSkillBookCardModels,
} from "./skillBookViewData.ts";

const customSkillAsset = (): CustomSkillMarkdownAsset => ({
  id: "custom-skill-a",
  name: "Poster Polish Skill",
  description: "Reusable poster workflow distilled from a successful conversation.",
  iconName: "Sparkles",
  activationHint: "Reuse the last proven poster workflow.",
  routeIntent: "branding",
  routeLabel: "Branding",
  routeSummary: "Focus on hero composition, brand tone, and cleaner poster hierarchy.",
  preferredSkills: ["generateImage"],
  suggestedTaskMode: "generate",
  followUpMode: "auto-clarify",
  allowAutonomousRouting: true,
  mode: "unified-sidebar-agent",
  clarifyChecklist: ["product image", "headline"],
  reusableQuestions: ["Should this version feel more premium or more energetic?"],
  executionOutline: ["Clarify brief", "Generate concepts", "Tighten copy"],
  executionRecipe: ["clarify", "generateImage", "generateCopy"],
  outputBlueprint: ["hero visual", "headline direction"],
  toolPolicy: ["prefer reference images"],
  instruction: "Confirm the visual goal first, then generate concepts and refine copy.",
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
  lastSuccessfulOutput: "Produced a hero KV, backup composition, and headline options.",
  tags: ["branding"],
});

test("listCustomSkillBookCardModels maps custom skills into unified card models", () => {
  const cards = listCustomSkillBookCardModels({
    assets: [customSkillAsset()],
    runtimeCustomConfigs: {},
  });

  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.isCustomSkill, true);
  assert.equal(cards[0]?.isActive, false);
  assert.equal(cards[0]?.showEditAction, true);
  assert.equal(cards[0]?.showAuditAction, true);
  assert.equal(cards[0]?.actionDisplay, "group");
  assert.deepEqual(
    cards[0]?.actions.map((item) => item.id),
    ["audit", "edit"],
  );
  assert.equal(cards[0]?.descriptionTone, "custom");
  assert.equal(cards[0]?.metaTokenTone, "custom");
  assert.equal(cards[0]?.description, "Reusable poster workflow distilled from a successful conversation.");
  assert.deepEqual(cards[0]?.metaTokens, ["My Skill", "会先补问"]);
  assert.equal(cards[0]?.showSecondaryMeta, true);
  assert.deepEqual(
    cards[0]?.secondaryMetaItems,
    [{ id: "source-conversation", text: "来源：618 poster sprint", truncate: true }],
  );
  assert.equal(cards[0]?.secondaryMeta?.sourceConversation, "618 poster sprint");
});

test("listFrontstageSkillBookCardModels maps builtin presets into unified card models", () => {
  const cards = listFrontstageSkillBookCardModels();
  const branding = cards.find((item) => item.id === "brand-style-guide");

  assert.ok(cards.length > 0);
  assert.equal(branding?.isCustomSkill, false);
  assert.equal(branding?.isActive, false);
  assert.equal(branding?.showEditAction, false);
  assert.equal(branding?.showAuditAction, true);
  assert.equal(branding?.actionDisplay, "single");
  assert.deepEqual(
    branding?.actions.map((item) => item.id),
    ["audit"],
  );
  assert.deepEqual(branding?.secondaryMetaItems, []);
  assert.equal(branding?.descriptionTone, "default");
  assert.equal(branding?.metaTokenTone, "default");
  assert.equal(Array.isArray(branding?.metaTokens), true);
  assert.equal(typeof branding?.description, "string");
});

test("listSkillBookCardModels merges custom and frontstage cards for a tab", () => {
  const result = listSkillBookCardModels({
    assets: [customSkillAsset()],
    runtimeCustomConfigs: {},
    skillCategoryTab: "branding",
    activeQuickSkillId: "custom-skill-a",
    modelMode: "fast",
    canCreateFromConversation: true,
  });

  assert.equal(result.customSkillCards.some((item) => item.id === "custom-skill-a"), true);
  assert.equal(result.frontstageSkillCards.length > 0, true);
  assert.equal(result.trigger.title, "Skill：已选择");
  assert.equal(result.trigger.highlighted, true);
  assert.equal(result.trigger.showActiveIndicator, true);
  assert.equal(result.header.title, "Skill");
  assert.equal(result.header.showClearAction, true);
  assert.equal(result.createSkillCta.visible, true);
  assert.equal(result.createSkillCta.enabled, false);
  assert.equal(result.createSkillCta.metaBadgeLabel, "需 Thinking");
  assert.equal(result.activeTab, "branding");
  assert.deepEqual(
    result.tabs.map((item) => item.id),
    ["video", "social", "commerce", "branding"],
  );
  assert.equal(result.blendedSkillCards[0]?.id, "custom-skill-a");
  assert.equal(result.blendedSkillCards[0]?.isCustomSkill, true);
  assert.equal(result.blendedSkillCards[0]?.isActive, true);
  assert.equal(result.blendedSkillCards[0]?.showEditAction, true);
  assert.equal(result.blendedSkillCards[0]?.showAuditAction, true);
  assert.equal(result.blendedSkillCards[0]?.actionDisplay, "group");
  assert.equal(result.blendedSkillCards[0]?.descriptionTone, "custom");
  assert.deepEqual(result.blendedSkillCards[0]?.metaTokens, ["My Skill", "会先补问"]);
  assert.equal(
    result.frontstageSkillCards.every((item) => item.isActive === false),
    true,
  );
});

test("listCustomSkillBookCardModels exposes warning presentation for missing markdown assets", () => {
  const cards = listCustomSkillBookCardModels({
    assets: [],
    runtimeCustomConfigs: {
      "custom-skill-a": {
        isCustomSkill: true,
        name: "Poster Polish Draft",
        summary: "Draft summary for premium poster QA.",
        description: "Draft summary for premium poster QA.",
        iconName: "Sparkles",
        routeIntent: "branding",
        followUpMode: "direct-run",
        markdownAssetId: "custom-skill-a",
        storageFormat: "markdown-file",
        skillGovernance: {
          schemaVersion: 1,
          currentPublishedVersionId: "skill_ver__workspace__custom-skill-a__v1",
          currentDraftVersionId: "skill_ver__workspace__custom-skill-a__v2",
          versions: [
            {
              id: "skill_ver__workspace__custom-skill-a__v2",
              semver: "1.1.0",
              reviewStatus: "draft",
              releaseStatus: "draft",
              createdAt: 190,
              updatedAt: 200,
              createdBy: "workspace",
              snapshot: {
                name: "Poster Polish Draft",
                summary: "Draft summary for premium poster QA.",
                description: "Draft summary for premium poster QA.",
                routeIntent: "branding",
                followUpMode: "direct-run",
                updatedAt: 200,
              },
            },
          ],
          auditTrail: [],
        },
      },
    },
  });

  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.customSkillSourceStatus, "missing-markdown-asset");
  assert.equal(cards[0]?.descriptionTone, "warning");
  assert.equal(cards[0]?.showStatusNotice, true);
  assert.equal(cards[0]?.actionDisplay, "group");
  assert.deepEqual(
    cards[0]?.actions.map((item) => item.id),
    ["audit", "edit"],
  );
  assert.deepEqual(cards[0]?.metaTokens, ["My Skill", "源文件缺失"]);
});
