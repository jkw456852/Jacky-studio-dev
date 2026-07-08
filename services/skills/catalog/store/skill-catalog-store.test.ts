import assert from "node:assert/strict";
import test from "node:test";

import type {
  SkillDefinition,
  SkillManifest,
  SkillPreset,
  SkillVersion,
} from "../skill-object-types.ts";
import { createInMemorySkillCatalogStore } from "./skill-catalog-store.ts";

const createManifest = (): SkillManifest => ({
  kind: "agent-skill",
  identity: {
    key: "builtin.test.skill",
    displayName: "Test Skill",
  },
  inputSchema: {
    type: "object",
  },
  ui: {},
  routing: {
    mode: "manual",
  },
  execution: {
    executorType: "agent-plan",
  },
  outputContract: {},
  permissions: {},
  observability: {
    traceLevel: "basic",
    saveInputs: true,
    saveOutputs: true,
    saveIntermediateCalls: false,
  },
});

const createDefinition = (): SkillDefinition => ({
  id: "skill_def__test",
  key: "builtin.test.skill",
  name: "Test Skill",
  summary: "summary",
  ownerType: "system",
  ownerId: "system",
  sourceType: "builtin",
  tags: ["test"],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
});

const createVersion = (
  overrides: Partial<SkillVersion> = {},
): SkillVersion => ({
  id: "skill_ver__test",
  skillDefinitionId: "skill_def__test",
  semver: "1.0.0",
  manifest: createManifest(),
  reviewStatus: "draft",
  releaseStatus: "draft",
  createdAt: 1,
  createdBy: "author",
  ...overrides,
});

const createPreset = (): SkillPreset => ({
  id: "preset__test",
  skillDefinitionId: "skill_def__test",
  pinnedLocation: "sidebar",
  label: "Test Preset",
  createdAt: 1,
  updatedAt: 1,
});

test("createDraftVersion persists definition, preset, and current draft pointer", () => {
  let clock = 100;
  const store = createInMemorySkillCatalogStore({ now: () => (clock += 10) });

  const version = store.createDraftVersion({
    definition: createDefinition(),
    version: createVersion(),
    preset: createPreset(),
  });

  assert.equal(version.reviewStatus, "draft");
  assert.equal(store.getPreset("preset__test")?.label, "Test Preset");

  const definition = store.getDefinition("skill_def__test");
  assert.ok(definition);
  assert.equal(definition.currentDraftVersionId, "skill_ver__test");
  assert.equal(definition.defaultPresetId, "preset__test");
});

test("createDraftVersion validates version and preset ownership", () => {
  const store = createInMemorySkillCatalogStore();

  assert.throws(
    () =>
      store.createDraftVersion({
        definition: createDefinition(),
        version: createVersion({ skillDefinitionId: "skill_def__other" }),
      }),
    /skill_version_definition_mismatch/,
  );

  assert.throws(
    () =>
      store.createDraftVersion({
        definition: createDefinition(),
        version: createVersion(),
        preset: { ...createPreset(), skillDefinitionId: "skill_def__other" },
      }),
    /skill_preset_definition_mismatch/,
  );
});

test("updateDraftVersion updates only draft versions and preserves canonical identity", () => {
  const store = createInMemorySkillCatalogStore();
  store.createDraftVersion({
    definition: createDefinition(),
    version: createVersion(),
  });

  const updated = store.updateDraftVersion("skill_ver__test", {
    semver: "1.0.1",
    manifest: {
      ...createManifest(),
      execution: {
        executorType: "agent-plan",
        toolPolicy: ["keep references"],
      },
    },
    changelog: "tighten policy",
  });

  assert.equal(updated.semver, "1.0.1");
  assert.deepEqual(updated.manifest.execution.toolPolicy, ["keep references"]);
  assert.equal(updated.changelog, "tighten policy");

  store.updateVersionReviewStatus("skill_ver__test", "approved", "reviewer");
  store.publishVersion("skill_ver__test", "publisher");
  assert.throws(
    () => store.updateDraftVersion("skill_ver__test", { semver: "1.0.2" }),
    /skill_version_draft_required/,
  );

  store.createDraftVersion({
    definition: store.getDefinition("skill_def__test")!,
    version: createVersion({ id: "skill_ver__bad-key" }),
  });
  assert.throws(
    () =>
      store.updateDraftVersion("skill_ver__bad-key", {
        manifest: {
          ...createManifest(),
          identity: {
            key: "builtin.test.other",
            displayName: "Wrong Skill",
          },
        },
      }),
    /skill_manifest_identity_mismatch/,
  );
});

test("publishVersion requires approval, deprecates the prior published version, and clears the draft pointer", () => {
  let clock = 1000;
  const store = createInMemorySkillCatalogStore({ now: () => (clock += 5) });
  store.createDraftVersion({
    definition: createDefinition(),
    version: createVersion({ id: "skill_ver__v1", semver: "1.0.0" }),
  });
  store.updateVersionReviewStatus("skill_ver__v1", "approved", "reviewer-a");
  const publishedV1 = store.publishVersion("skill_ver__v1", "publisher-a");
  assert.equal(publishedV1.releaseStatus, "published");

  store.createDraftVersion({
    definition: store.getDefinition("skill_def__test")!,
    version: createVersion({
      id: "skill_ver__v2",
      semver: "1.1.0",
      reviewStatus: "draft",
      releaseStatus: "draft",
    }),
  });
  store.updateVersionReviewStatus("skill_ver__v2", "approved", "reviewer-a");
  const publishedV2 = store.publishVersion("skill_ver__v2", "publisher-b");

  assert.equal(publishedV2.releaseStatus, "published");
  assert.equal(store.getVersion("skill_ver__v1")?.releaseStatus, "deprecated");
  assert.equal(store.getDefinition("skill_def__test")?.currentPublishedVersionId, "skill_ver__v2");
  assert.equal(store.getDefinition("skill_def__test")?.currentDraftVersionId, undefined);
});

test("deprecateVersion clears the published pointer when deprecating the active version", () => {
  const store = createInMemorySkillCatalogStore();
  store.createDraftVersion({
    definition: createDefinition(),
    version: createVersion(),
  });
  store.updateVersionReviewStatus("skill_ver__test", "approved", "reviewer");
  store.publishVersion("skill_ver__test", "publisher");

  const deprecated = store.deprecateVersion("skill_ver__test", "publisher");
  assert.equal(deprecated.releaseStatus, "deprecated");
  assert.equal(store.getDefinition("skill_def__test")?.currentPublishedVersionId, undefined);
});

test("rollbackToVersion restores the target and marks the current published version as rolled back", () => {
  const store = createInMemorySkillCatalogStore();
  store.createDraftVersion({
    definition: createDefinition(),
    version: createVersion({ id: "skill_ver__v1", semver: "1.0.0" }),
  });
  store.updateVersionReviewStatus("skill_ver__v1", "approved", "reviewer");
  store.publishVersion("skill_ver__v1", "publisher");

  store.createDraftVersion({
    definition: store.getDefinition("skill_def__test")!,
    version: createVersion({
      id: "skill_ver__v2",
      semver: "1.1.0",
    }),
  });
  store.updateVersionReviewStatus("skill_ver__v2", "approved", "reviewer");
  store.publishVersion("skill_ver__v2", "publisher");

  const rolledBack = store.rollbackToVersion("skill_def__test", "skill_ver__v1", "publisher");
  assert.equal(rolledBack.releaseStatus, "published");
  assert.equal(store.getVersion("skill_ver__v2")?.releaseStatus, "rolled_back");
  assert.equal(store.getDefinition("skill_def__test")?.currentPublishedVersionId, "skill_ver__v1");
});

test("upsertPreset returns the persisted preset with a stamped updatedAt", () => {
  let clock = 10;
  const store = createInMemorySkillCatalogStore({ now: () => (clock += 7) });
  const preset = store.upsertPreset(createPreset());
  assert.equal(preset.updatedAt, 17);
  assert.equal(store.getPreset("preset__test")?.updatedAt, 17);
});
