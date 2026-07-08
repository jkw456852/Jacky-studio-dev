import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveIdentityByDefinitionId,
  resolveIdentityByLegacyConfig,
  resolveIdentityByLegacyFrontstageId,
  resolveIdentityByLegacySkillData,
  resolveIdentityByPresetId,
  resolveIdentityByVersionId,
  resolveSkillIdentity,
} from "./skill-identity-resolver.ts";
import {
  listLegacyCustomSkillCatalogEntries,
  listLegacyPresetSkillCatalogEntries,
} from "../legacy/legacy-skill-catalog.ts";
import type { CustomSkillMarkdownAsset } from "../../runtime-assets/custom-skill-markdown.ts";

const sampleBuiltinEntry = () => {
  const entries = listLegacyPresetSkillCatalogEntries();
  assert.ok(entries.length > 0, "expected at least one builtin preset");
  return entries[0];
};

const sampleCustomAsset: CustomSkillMarkdownAsset = {
  id: "custom-skill-identity",
  name: "Identity Custom",
  description: "Identity resolver fixture",
  iconName: "Sparkles",
  activationHint: "fixture",
  routeIntent: "general",
  routeLabel: "Custom",
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

const sampleCustomDraftRuntimeConfig = {
  isCustomSkill: true,
  name: "Identity Custom Draft",
  summary: "Draft summary for identity resolver.",
  description: "Draft summary for identity resolver.",
  instruction: "Draft instruction for identity resolver.",
  iconName: "Sparkles",
  routeIntent: "general",
  routeLabel: "Custom Draft",
  routeSummary: "Draft route summary.",
  preferredSkills: ["workspaceSearch"],
  suggestedTaskMode: "research",
  followUpMode: "direct-run",
  executionRecipe: ["research", "generateCopy"],
  outputBlueprint: ["draft output"],
  updatedAt: 200,
  skillGovernance: {
    schemaVersion: 1,
    currentPublishedVersionId: "skill_ver__workspace__custom-skill-identity__v1",
    currentDraftVersionId: "skill_ver__workspace__custom-skill-identity__v2",
    versions: [
      {
        id: "skill_ver__workspace__custom-skill-identity__v2",
        semver: "1.1.0",
        reviewStatus: "draft",
        releaseStatus: "draft",
        createdAt: 190,
        updatedAt: 200,
        createdBy: "workspace",
        snapshot: {
          name: "Identity Custom Draft",
          iconName: "Sparkles",
          summary: "Draft summary for identity resolver.",
          description: "Draft summary for identity resolver.",
          instruction: "Draft instruction for identity resolver.",
          routeIntent: "general",
          routeLabel: "Custom Draft",
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

test("resolveIdentityByDefinitionId/VersionId/PresetId all round-trip a builtin entry", () => {
  const entry = sampleBuiltinEntry();

  const byDef = resolveIdentityByDefinitionId(entry.definition.id);
  assert.ok(byDef);
  assert.equal(byDef.identity.definitionId, entry.definition.id);
  assert.equal(byDef.identity.versionId, entry.version.id);
  assert.equal(byDef.identity.scope, "builtin");
  assert.equal(byDef.identity.source, "skill-definition-id");

  const byVer = resolveIdentityByVersionId(entry.version.id);
  assert.ok(byVer);
  assert.equal(byVer.identity.definitionId, entry.definition.id);
  assert.equal(byVer.identity.source, "skill-version-id");

  const byPreset = resolveIdentityByPresetId(entry.preset.id);
  assert.ok(byPreset);
  assert.equal(byPreset.identity.definitionId, entry.definition.id);
  assert.equal(byPreset.identity.source, "skill-preset-id");
});

test("resolveIdentityByLegacyFrontstageId / SkillData / Config all resolve to the same canonical identity", () => {
  const entry = sampleBuiltinEntry();
  const frontstageId = entry.legacyMetadata.frontstagePreset!.id;

  const byFrontstage = resolveIdentityByLegacyFrontstageId(frontstageId);
  assert.ok(byFrontstage);

  const bySkillData = resolveIdentityByLegacySkillData(entry.legacyMetadata.skillData);
  assert.ok(bySkillData);

  const byConfig = resolveIdentityByLegacyConfig({ frontstageSkillId: frontstageId });
  assert.ok(byConfig);

  assert.equal(byFrontstage.identity.definitionId, bySkillData.identity.definitionId);
  assert.equal(bySkillData.identity.definitionId, byConfig.identity.definitionId);
  assert.equal(byFrontstage.identity.scope, "builtin");
  assert.equal(byFrontstage.identity.legacy.frontstageSkillId, frontstageId);
});

test("resolveSkillIdentity dispatches across input kinds with stable scope", () => {
  const entry = sampleBuiltinEntry();
  const frontstageId = entry.legacyMetadata.frontstagePreset!.id;

  const cases = [
    { kind: "definitionId", value: entry.definition.id } as const,
    { kind: "versionId", value: entry.version.id } as const,
    { kind: "presetId", value: entry.preset.id } as const,
    { kind: "legacyFrontstageId", value: frontstageId } as const,
    { kind: "legacySkillData", value: entry.legacyMetadata.skillData } as const,
    { kind: "legacyConfig", value: { frontstageSkillId: frontstageId } } as const,
  ];

  for (const c of cases) {
    const lookup = resolveSkillIdentity(c);
    assert.ok(lookup, `expected lookup for kind=${c.kind}`);
    assert.equal(lookup.identity.scope, "builtin");
    assert.equal(lookup.identity.definitionId, entry.definition.id);
  }
});

test("custom skills resolve to workspace scope via markdownAssetId or legacySkillId", () => {
  const options = { customSkillMarkdownAssets: [sampleCustomAsset] };

  const customEntries = listLegacyCustomSkillCatalogEntries(options);
  assert.equal(customEntries.length, 1);

  const byConfig = resolveIdentityByLegacyConfig(
    { isCustomSkill: true, markdownAssetId: sampleCustomAsset.id },
    options,
  );
  assert.ok(byConfig);
  assert.equal(byConfig.identity.scope, "workspace");
  assert.equal(byConfig.identity.legacy.customSkillId, sampleCustomAsset.id);

  const byLegacyId = resolveIdentityByLegacyConfig(
    { isCustomSkill: true },
    { ...options, legacySkillId: sampleCustomAsset.id },
  );
  assert.ok(byLegacyId);
  assert.equal(byLegacyId.identity.scope, "workspace");
  assert.equal(byLegacyId.identity.legacy.customSkillId, sampleCustomAsset.id);

  const byFrontstage = resolveIdentityByLegacyFrontstageId(sampleCustomAsset.id, options);
  assert.ok(byFrontstage);
  assert.equal(byFrontstage.identity.scope, "workspace");
});

test("custom skill identity lookup returns the working draft projection when present", () => {
  const options = {
    customSkillMarkdownAssets: [sampleCustomAsset],
    runtimeCustomConfigs: {
      [sampleCustomAsset.id]: sampleCustomDraftRuntimeConfig,
    },
  };

  const byConfig = resolveIdentityByLegacyConfig(
    { isCustomSkill: true, markdownAssetId: sampleCustomAsset.id },
    options,
  );
  assert.ok(byConfig);
  assert.equal(byConfig.identity.versionId, "skill_ver__workspace__custom-skill-identity__v2");
  assert.equal(byConfig.definition.name, "Identity Custom Draft");
  assert.equal(byConfig.version.semver, "1.1.0");
  assert.equal(byConfig.version.manifest.routing.followUpMode, "direct-run");
  assert.equal(byConfig.preset.label, "Identity Custom Draft");
});

test("runtime-only custom skillData resolves to workspace draft identity without markdown assets", () => {
  const runtimeOnlySkillData = {
    id: "runtime-only-identity",
    name: "Runtime Only Identity",
    iconName: "Sparkles",
    config: {
      isCustomSkill: true,
      name: "Runtime Only Identity Draft",
      summary: "Draft summary for runtime-only identity resolver.",
      description: "Draft summary for runtime-only identity resolver.",
      instruction: "Draft instruction for runtime-only identity resolver.",
      iconName: "Sparkles",
      routeIntent: "general",
      routeLabel: "Runtime Only Identity Draft",
      routeSummary: "Draft route summary.",
      preferredSkills: ["workspaceSearch"],
      suggestedTaskMode: "research",
      followUpMode: "direct-run",
      executionRecipe: ["research", "generateCopy"],
      outputBlueprint: ["draft output"],
      updatedAt: 200,
      skillGovernance: {
        schemaVersion: 1,
        currentPublishedVersionId: "skill_ver__workspace__runtime-only-identity__v1",
        currentDraftVersionId: "skill_ver__workspace__runtime-only-identity__v2",
        versions: [
          {
            id: "skill_ver__workspace__runtime-only-identity__v2",
            semver: "1.1.0",
            reviewStatus: "draft",
            releaseStatus: "draft",
            createdAt: 190,
            updatedAt: 200,
            createdBy: "workspace",
            snapshot: {
              name: "Runtime Only Identity Draft",
              summary: "Draft summary for runtime-only identity resolver.",
              description: "Draft summary for runtime-only identity resolver.",
              instruction: "Draft instruction for runtime-only identity resolver.",
              iconName: "Sparkles",
              routeIntent: "general",
              routeLabel: "Runtime Only Identity Draft",
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
    },
  };

  const bySkillData = resolveIdentityByLegacySkillData(runtimeOnlySkillData);
  assert.ok(bySkillData);
  assert.equal(bySkillData.identity.scope, "workspace");
  assert.equal(bySkillData.identity.definitionId, "skill_def__workspace__runtime-only-identity");
  assert.equal(bySkillData.identity.versionId, "skill_ver__workspace__runtime-only-identity__v2");
  assert.equal(bySkillData.version.semver, "1.1.0");
  assert.equal(bySkillData.definition.name, "Runtime Only Identity Draft");

  const byConfig = resolveIdentityByLegacyConfig({
    ...(runtimeOnlySkillData.config as Record<string, unknown>),
  });
  assert.equal(byConfig?.identity.versionId, "skill_ver__workspace__runtime-only-identity__v2");
});

test("resolver returns null for unknown ids and blank input", () => {
  assert.equal(resolveIdentityByDefinitionId(""), null);
  assert.equal(resolveIdentityByVersionId("non-existent"), null);
  assert.equal(resolveIdentityByLegacySkillData(null), null);
  assert.equal(resolveIdentityByLegacyConfig(null), null);
});
