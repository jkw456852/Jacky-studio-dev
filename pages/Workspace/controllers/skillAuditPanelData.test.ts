import assert from "node:assert/strict";
import test from "node:test";

import type { ChatMessage } from "../../../types/index.ts";
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
  id: "custom-skill-a",
  name: "Poster Polish Skill",
  description: "Reusable poster workflow distilled from a successful conversation.",
  iconName: "Sparkles",
  activationHint: "Reuse the last proven poster workflow.",
  routeIntent: "branding" as const,
  routeLabel: "Branding",
  routeSummary: "Focus on hero composition, brand tone, and cleaner poster hierarchy.",
  preferredSkills: ["generateImage"],
  suggestedTaskMode: "generate",
  followUpMode: "auto-clarify" as const,
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
} satisfies import("../../../services/runtime-assets/custom-skill-markdown").CustomSkillMarkdownAsset);

const recentMessages = (): ChatMessage[] => [
  {
    id: "user-1",
    role: "user",
    text: "Use Poster Polish Skill to redo the current KV.",
    timestamp: 60,
    skillData: {
      id: "custom-skill-a",
      name: "Poster Polish Skill",
      iconName: "Sparkles",
      config: {
        isCustomSkill: true,
      },
    },
  },
  {
    id: "assistant-1",
    role: "model",
    text: "The run failed.",
    timestamp: 66,
    responseToMessageId: "user-1",
    error: true,
    agentData: {
      executionTrace: {
        status: "failed",
        errorMessage: "Not enough references to complete the run.",
      },
    },
  },
];

test("buildSkillAuditPanelModel assembles a browser-safe audit view for custom skills", () => {
  const model = buildSkillAuditPanelModel({
    skillId: "custom-skill-a",
    customSkillMarkdownAssets: [customSkillAsset()],
    skillPreferences: skillPreferences({
      customSkillConfigs: {
        "custom-skill-a": {
          isCustomSkill: true,
          name: "Poster Polish Skill",
          routeIntent: "branding",
          successfulRuns: 4,
          lastUsedAt: 70,
          lastSuccessfulAt: 65,
          lastSuccessfulPrompt: "Keep using the premium poster workflow.",
          sourceConversationTitle: "618 poster sprint",
          instruction: "Preserve the brand tone, clarify missing inputs, then execute.",
          examplePrompt: "Make the poster feel more premium and more focused.",
          markdownAssetUpdatedAt: 64,
        },
      },
    }),
    recentMessages: recentMessages(),
  });

  assert.ok(model);
  assert.equal(model?.title, "Poster Polish Skill");
  assert.equal(model?.kindLabel, "My Skill");
  assert.equal(model?.sourceLabel, "对话蒸馏");
  assert.equal(model?.reviewLabel, "已批准");
  assert.equal(model?.releaseLabel, "已发布");
  assert.equal(model?.timeline.some((item) => item.eventType === "skill.run.failed"), true);
  assert.equal(model?.capabilityTags.includes("会先补问"), true);
  assert.equal(model?.performanceItems.some((item) => item.label === "成功次数"), true);
  assert.equal(
    model?.examplePrompt,
    "Make the poster feel more premium and more focused.",
  );
  assert.ok(model?.governance);
});

test("buildSkillAuditPanelModel reflects the working draft in audit panel display", () => {
  const model = buildSkillAuditPanelModel({
    skillId: "custom-skill-a",
    customSkillMarkdownAssets: [customSkillAsset()],
    skillPreferences: skillPreferences({
      customSkillConfigs: {
        "custom-skill-a": {
          isCustomSkill: true,
          name: "Poster Polish Draft",
          summary: "Draft summary for premium poster QA.",
          description: "Draft summary for premium poster QA.",
          instruction: "Draft instruction that should replace the published instruction.",
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
                  iconName: "Sparkles",
                  summary: "Draft summary for premium poster QA.",
                  description: "Draft summary for premium poster QA.",
                  instruction: "Draft instruction that should replace the published instruction.",
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
  assert.equal(model?.title, "Poster Polish Draft");
  assert.equal(model?.summary, "Draft summary for premium poster QA.");
  assert.equal(
    model?.instruction,
    "Draft instruction that should replace the published instruction.",
  );
  assert.equal(model?.versionLabel, "1.1.0");
  assert.equal(
    model?.detailItems.find((item) => item.label === "版本 ID")?.value,
    "skill_ver__workspace__custom-skill-a__v2",
  );
  assert.equal(
    model?.detailItems.find((item) => item.label === "路由模式")?.value,
    "手动选择",
  );
  assert.equal(
    model?.detailItems.find((item) => item.label === "跟进方式")?.value,
    "直接执行",
  );
  assert.equal(model?.capabilityTags.includes("工作区检索"), true);
  assert.equal(
    model?.performanceItems.find((item) => item.label === "示例提示")?.value,
    "Draft reusable prompt for audit panel.",
  );
});

test("buildSkillAuditPanelModel resolves builtin presets through legacy catalog mapping", () => {
  const model = buildSkillAuditPanelModel({
    skillId: "autonomous-video-director",
    customSkillMarkdownAssets: [],
    skillPreferences: skillPreferences({
      frontstageSkillRuntimeConfigs: {
        "autonomous-video-director": {
          successfulRuns: 2,
          lastSuccessfulAt: 88,
        },
      },
    }),
    recentMessages: [],
  });

  assert.ok(model);
  assert.equal(model?.isCustomSkill, false);
  assert.equal(model?.definition.key.startsWith("builtin."), true);
  assert.equal(
    model?.timeline.some((item) => item.eventType === "skill.version.published"),
    true,
  );
  assert.equal(model?.governance, null);
});

test("buildSkillAuditPanelModel returns null for unknown skills", () => {
  const model = buildSkillAuditPanelModel({
    skillId: "missing-skill",
    customSkillMarkdownAssets: [],
    skillPreferences: skillPreferences(),
    recentMessages: [],
  });

  assert.equal(model, null);
});

test("buildSkillAuditPanelModel exposes runtime-only custom skill storage state", () => {
  const model = buildSkillAuditPanelModel({
    skillId: "runtime-only-audit-skill",
    customSkillMarkdownAssets: [],
    skillPreferences: skillPreferences({
      customSkillConfigs: {
        "runtime-only-audit-skill": {
          isCustomSkill: true,
          name: "Runtime Only Audit Skill",
          summary: "Runtime only summary.",
          description: "Runtime only summary.",
          instruction: "Runtime only instruction.",
          iconName: "Sparkles",
          routeIntent: "branding",
          routeLabel: "Branding",
          routeSummary: "Runtime only route summary.",
          preferredSkills: ["workspaceSearch"],
          suggestedTaskMode: "research",
          followUpMode: "direct-run",
          updatedAt: 200,
          skillGovernance: {
            schemaVersion: 1,
            currentPublishedVersionId: "skill_ver__workspace__runtime-only-audit-skill__v1",
            versions: [],
            auditTrail: [],
          },
        },
      },
    }),
    recentMessages: [],
  });

  assert.ok(model);
  assert.equal(model?.customSkillSourceStatus, "runtime-only");
  assert.equal(
    model?.detailItems.find((item) => item.label === "存储状态")?.value,
    "仅运行时配置",
  );
  assert.equal(model?.customSkillStorageBadge, "仅运行时");
  assert.equal(model?.customSkillStorageNotice?.title, "当前只有运行时配置");
  assert.equal(
    model?.customSkillStorageNotice?.body,
    "保存会继续更新本地 runtime 配置；发布后才会写入 Markdown Skill 文件。",
  );
});

test("buildSkillAuditPanelModel exposes missing markdown asset state without dropping runtime overlay", () => {
  const model = buildSkillAuditPanelModel({
    skillId: "missing-markdown-audit-skill",
    customSkillMarkdownAssets: [],
    skillPreferences: skillPreferences({
      customSkillConfigs: {
        "missing-markdown-audit-skill": {
          isCustomSkill: true,
          name: "Missing Markdown Audit Skill",
          summary: "Missing markdown summary.",
          description: "Missing markdown summary.",
          instruction: "Missing markdown instruction.",
          iconName: "Sparkles",
          routeIntent: "branding",
          routeLabel: "Branding",
          routeSummary: "Missing markdown route summary.",
          preferredSkills: ["workspaceSearch"],
          suggestedTaskMode: "research",
          followUpMode: "direct-run",
          markdownAssetId: "missing-markdown-audit-skill",
          storageFormat: "markdown-file",
          updatedAt: 200,
          skillGovernance: {
            schemaVersion: 1,
            currentPublishedVersionId: "skill_ver__workspace__missing-markdown-audit-skill__v1",
            versions: [],
            auditTrail: [],
          },
        },
      },
    }),
    recentMessages: [],
  });

  assert.ok(model);
  assert.equal(model?.customSkillSourceStatus, "missing-markdown-asset");
  assert.equal(
    model?.detailItems.find((item) => item.label === "存储状态")?.value,
    "Markdown 资源缺失",
  );
  assert.equal(model?.customSkillStorageBadge, "源文件缺失");
  assert.equal(model?.customSkillStorageNotice?.title, "原 Markdown 文件缺失");
  assert.equal(
    model?.customSkillStorageNotice?.body,
    "当前仍保留 runtime overlay。你可以继续编辑，发布时会按当前内容重建 Markdown Skill 文件。",
  );
  assert.equal(model?.title, "Missing Markdown Audit Skill");
});
