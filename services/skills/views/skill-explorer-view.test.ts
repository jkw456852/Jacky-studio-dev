import assert from "node:assert/strict";
import test from "node:test";
import {
  getSkillExplorerDetail,
  listSkillExplorerCards,
  summarizeSkillExplorer,
} from "./skill-explorer-view.ts";
import type { CustomSkillMarkdownAsset } from "../../runtime-assets/custom-skill-markdown.ts";
import { listLegacyPresetSkillCatalogEntries } from "../legacy/legacy-skill-catalog.ts";

const sampleCustomAsset: CustomSkillMarkdownAsset = {
  id: "explorer-custom-1",
  name: "Explorer Custom",
  description: "fixture",
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
  name: "Explorer Draft",
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
    currentPublishedVersionId: "skill_ver__workspace__explorer-custom-1__v1",
    currentDraftVersionId: "skill_ver__workspace__explorer-custom-1__v2",
    versions: [
      {
        id: "skill_ver__workspace__explorer-custom-1__v2",
        semver: "1.1.0",
        reviewStatus: "draft",
        releaseStatus: "draft",
        createdAt: 190,
        updatedAt: 200,
        createdBy: "workspace",
        snapshot: {
          name: "Explorer Draft",
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

test("listSkillExplorerCards returns builtin + workspace cards with stable ordering", () => {
  const cards = listSkillExplorerCards({
    customSkillMarkdownAssets: [sampleCustomAsset],
  });
  assert.ok(cards.length > 0);

  // builtin first
  assert.equal(cards[0].scope, "builtin");
  const lastBuiltinIdx = cards.findIndex((c) => c.scope === "workspace") - 1;
  assert.ok(lastBuiltinIdx >= 0);
  const builtinOrders = cards
    .filter((c) => c.scope === "builtin")
    .map((c) => c.order);
  for (let i = 1; i < builtinOrders.length; i += 1) {
    assert.ok(builtinOrders[i] >= builtinOrders[i - 1], "builtin should be sorted by order");
  }
});

test("listSkillExplorerCards filters by scope/tab/query", () => {
  const workspaceCards = listSkillExplorerCards({
    customSkillMarkdownAssets: [sampleCustomAsset],
    scope: "workspace",
  });
  assert.ok(workspaceCards.length >= 1);
  assert.ok(workspaceCards.every((c) => c.scope === "workspace"));

  const allBuiltin = listSkillExplorerCards({ scope: "builtin" });
  assert.ok(allBuiltin.every((c) => c.scope === "builtin"));

  const queried = listSkillExplorerCards({
    customSkillMarkdownAssets: [sampleCustomAsset],
    query: "explorer custom",
  });
  assert.equal(queried.length, 1);
  assert.equal(queried[0].legacy.customSkillId, sampleCustomAsset.id);
});

test("getSkillExplorerDetail returns rich detail with manifest and examples", () => {
  const sample = listLegacyPresetSkillCatalogEntries()[0];
  const byDef = getSkillExplorerDetail({ kind: "definitionId", value: sample.definition.id });
  assert.ok(byDef);
  assert.equal(byDef.definitionId, sample.definition.id);
  assert.equal(byDef.manifest.identity.displayName, sample.definition.name);
  assert.equal(Array.isArray(byDef.executionRecipe), true);

  const byPreset = getSkillExplorerDetail({ kind: "presetId", value: sample.preset.id });
  assert.ok(byPreset);
  assert.equal(byPreset.definitionId, sample.definition.id);
});

test("getSkillExplorerDetail returns null for unknown id", () => {
  assert.equal(getSkillExplorerDetail({ kind: "definitionId", value: "nope" }), null);
  assert.equal(getSkillExplorerDetail({ kind: "presetId", value: "" }), null);
});

test("summarizeSkillExplorer aggregates scope and tab counts", () => {
  const summary = summarizeSkillExplorer({
    customSkillMarkdownAssets: [sampleCustomAsset],
  });
  assert.ok(summary.total > 0);
  assert.ok(summary.builtin > 0);
  assert.equal(summary.workspace, 1);
  const tabTotal = Object.values(summary.byTab).reduce((s, n) => s + n, 0);
  assert.equal(tabTotal, summary.total);
});

test("workspace explorer cards project the working draft for custom skills", () => {
  const cards = listSkillExplorerCards({
    customSkillMarkdownAssets: [sampleCustomAsset],
    runtimeCustomConfigs: {
      "explorer-custom-1": sampleDraftRuntimeConfig,
    },
    scope: "workspace",
  });

  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.name, "Explorer Draft");
  assert.equal(cards[0]?.summary, "Draft explorer summary.");
  assert.equal(cards[0]?.versionId, "skill_ver__workspace__explorer-custom-1__v2");
  assert.equal(cards[0]?.activationHint, "fixture");
  assert.equal(cards[0]?.category, "branding");
});

test("workspace explorer detail projects the working draft manifest for custom skills", () => {
  const detail = getSkillExplorerDetail(
    { kind: "definitionId", value: "skill_def__workspace__explorer-custom-1" },
    {
      customSkillMarkdownAssets: [sampleCustomAsset],
      runtimeCustomConfigs: {
        "explorer-custom-1": sampleDraftRuntimeConfig,
      },
    },
  );

  assert.ok(detail);
  assert.equal(detail?.definition.name, "Explorer Draft");
  assert.equal(detail?.version.id, "skill_ver__workspace__explorer-custom-1__v2");
  assert.equal(detail?.version.semver, "1.1.0");
  assert.equal(detail?.manifest.routing.mode, "manual");
  assert.equal(detail?.manifest.routing.followUpMode, "direct-run");
  assert.equal(detail?.manifest.permissions.needsWorkspaceSearch, true);
  assert.deepEqual(detail?.outputBlueprint, ["hero visual", "claim block"]);
});
