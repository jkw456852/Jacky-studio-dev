import assert from "node:assert/strict";
import test from "node:test";

import type { CustomSkillMarkdownAsset } from "../../../services/runtime-assets/custom-skill-markdown.ts";
import { listLegacySkillCatalogEntries } from "../../../services/skills/legacy/legacy-skill-catalog.ts";
import {
  buildCustomSkillBookPresentation,
  buildDraftAwareSkillCatalogDisplay,
  listCustomSkillPresentationRecords,
  resolveCustomSkillPresentationRecord,
} from "./customSkillPresentationData.ts";

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

const runtimeDraftConfig = {
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
} satisfies Record<string, unknown>;

test("listCustomSkillPresentationRecords exposes editable draft config and governance", () => {
  const records = listCustomSkillPresentationRecords({
    assets: [customSkillAsset()],
    runtimeCustomConfigs: {
      "custom-skill-a": runtimeDraftConfig,
    },
  });

  assert.equal(records.length, 1);
  assert.equal(records[0]?.editableConfig.name, "Poster Polish Draft");
  assert.equal(records[0]?.governance.workingVersionLabel, "1.1.0");
  assert.equal(records[0]?.governance.hasDraft, true);
});

test("resolveCustomSkillPresentationRecord returns null for unknown skills", () => {
  const record = resolveCustomSkillPresentationRecord({
    skillId: "missing-skill",
    assets: [customSkillAsset()],
    runtimeCustomConfigs: {},
  });

  assert.equal(record, null);
});

test("buildDraftAwareSkillCatalogDisplay projects the working draft over legacy catalog data", () => {
  const entry = listLegacySkillCatalogEntries({
    customSkillMarkdownAssets: [customSkillAsset()],
    runtimeCustomConfigs: {
      "custom-skill-a": runtimeDraftConfig,
    },
  }).find((item) => item.legacyMetadata.source === "custom-skill");

  assert.ok(entry);

  const display = buildDraftAwareSkillCatalogDisplay({
    entry: entry!,
    skillId: "custom-skill-a",
    runtimeConfig: runtimeDraftConfig,
  });

  assert.equal(display.definition.name, "Poster Polish Draft");
  assert.equal(display.definition.summary, "Draft summary for premium poster QA.");
  assert.equal(display.version.id, "skill_ver__workspace__custom-skill-a__v2");
  assert.equal(display.version.semver, "1.1.0");
  assert.equal(display.version.manifest.routing.mode, "manual");
  assert.equal(display.version.manifest.routing.followUpMode, "direct-run");
  assert.equal(display.version.manifest.permissions.needsWorkspaceSearch, true);
  assert.equal(display.preset?.label, "Poster Polish Draft");
  assert.equal(
    display.runtimeConfig.examplePrompt,
    "Draft reusable prompt for audit panel.",
  );
  assert.equal(display.governance?.workingVersionId, "skill_ver__workspace__custom-skill-a__v2");
});

test("buildCustomSkillBookPresentation explains runtime-only draft governance state", () => {
  const record = resolveCustomSkillPresentationRecord({
    skillId: "runtime-only-audit-skill",
    assets: [],
    runtimeCustomConfigs: {
      "runtime-only-audit-skill": {
        isCustomSkill: true,
        name: "Runtime Only Draft",
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
          currentDraftVersionId: "skill_ver__workspace__runtime-only-audit-skill__v2",
          versions: [
            {
              id: "skill_ver__workspace__runtime-only-audit-skill__v2",
              semver: "1.1.0",
              reviewStatus: "draft",
              releaseStatus: "draft",
              createdAt: 190,
              updatedAt: 200,
              createdBy: "workspace",
              snapshot: {
                name: "Runtime Only Draft",
                summary: "Runtime only summary.",
                description: "Runtime only summary.",
                instruction: "Runtime only instruction.",
                routeIntent: "branding",
                routeLabel: "Branding",
                routeSummary: "Runtime only route summary.",
                preferredSkills: ["workspaceSearch"],
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
  });

  assert.ok(record);
  const presentation = buildCustomSkillBookPresentation(record!);
  assert.equal(presentation.description, "Runtime only summary.");
  assert.deepEqual(presentation.metaTokens, ["My Skill", "仅运行时"]);
  assert.equal(presentation.secondaryMeta, null);
  assert.deepEqual(presentation.statusBadges, [
    {
      label: "草稿 1.1.0",
      tone: "draft",
    },
  ]);
  assert.equal(presentation.statusNotice?.tone, "info");
  assert.equal(
    presentation.statusNotice?.text,
    "当前只有本地运行时配置；当前草稿不会影响线上版本，发布后会写入 Markdown Skill 文件。",
  );
});

test("buildCustomSkillBookPresentation explains missing markdown draft governance state", () => {
  const record = resolveCustomSkillPresentationRecord({
    skillId: "custom-skill-a",
    assets: [],
    runtimeCustomConfigs: {
      "custom-skill-a": {
        ...runtimeDraftConfig,
        markdownAssetId: "custom-skill-a",
        storageFormat: "markdown-file",
      },
    },
  });

  assert.ok(record);
  const presentation = buildCustomSkillBookPresentation(record!);
  assert.equal(presentation.description, "Draft summary for premium poster QA.");
  assert.deepEqual(presentation.metaTokens, ["My Skill", "源文件缺失"]);
  assert.equal(
    presentation.secondaryMeta?.sourceConversation,
    "draft-conversation",
  );
  assert.deepEqual(presentation.statusBadges, [
    {
      label: "草稿 1.1.0",
      tone: "draft",
    },
    {
      label: "Markdown 资源缺失",
      tone: "warning",
    },
  ]);
  assert.equal(presentation.statusNotice?.tone, "warning");
  assert.equal(
    presentation.statusNotice?.text,
    "原 Markdown 文件缺失；当前草稿不会影响线上版本，发布后会按当前内容重建。",
  );
});

test("buildCustomSkillBookPresentation stays quiet for markdown-backed published state", () => {
  const record = resolveCustomSkillPresentationRecord({
    skillId: "custom-skill-a",
    assets: [customSkillAsset()],
    runtimeCustomConfigs: {},
  });

  assert.ok(record);
  const presentation = buildCustomSkillBookPresentation(record!);
  assert.equal(
    presentation.description,
    "Reusable poster workflow distilled from a successful conversation.",
  );
  assert.deepEqual(presentation.metaTokens, ["My Skill", "会先补问"]);
  assert.equal(
    presentation.secondaryMeta?.sourceConversation,
    "618 poster sprint",
  );
  assert.deepEqual(presentation.statusBadges, []);
  assert.equal(presentation.statusNotice, null);
});
