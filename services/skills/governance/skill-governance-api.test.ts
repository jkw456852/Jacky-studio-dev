import assert from "node:assert/strict";
import test from "node:test";

import type {
  SkillDefinition,
  SkillManifest,
  SkillVersion,
} from "../catalog/skill-object-types.ts";
import { createInMemorySkillCatalogStore } from "../catalog/store/skill-catalog-store.ts";
import {
  createSkillGovernanceService,
} from "./skill-governance.ts";
import { createSkillGovernanceApi } from "./skill-governance-api.ts";

const manifest = (): SkillManifest => ({
  kind: "agent-skill",
  identity: {
    key: "builtin.test.api",
    displayName: "API Skill",
  },
  inputSchema: { type: "object" },
  ui: {},
  routing: { mode: "manual" },
  execution: { executorType: "agent-plan" },
  outputContract: {},
  permissions: {},
  observability: {
    traceLevel: "basic",
    saveInputs: true,
    saveOutputs: true,
    saveIntermediateCalls: false,
  },
});

const definition = (): SkillDefinition => ({
  id: "skill_def__api",
  key: "builtin.test.api",
  name: "API Skill",
  summary: "summary",
  ownerType: "system",
  ownerId: "system",
  sourceType: "builtin",
  tags: ["api"],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
});

const version = (id = "skill_ver__api"): SkillVersion => ({
  id,
  skillDefinitionId: "skill_def__api",
  semver: "1.0.0",
  manifest: manifest(),
  reviewStatus: "draft",
  releaseStatus: "draft",
  createdAt: 1,
  createdBy: "editor-a",
});

test("governance api exposes catalog reads and governance actions through one facade", () => {
  const catalog = createInMemorySkillCatalogStore();
  const governance = createSkillGovernanceService({
    catalog,
    workspaceId: "workspace-1",
  });
  const api = createSkillGovernanceApi({ catalog, governance });

  api.createDraft({
    actor: { id: "editor-a", roles: ["skill_editor"] },
    input: {
      definition: definition(),
      version: version(),
    },
    reason: "create draft",
  });

  assert.equal(api.listDefinitions().length, 1);
  assert.equal(api.listVersions("skill_def__api").length, 1);
  assert.equal(api.getVersion("skill_ver__api")?.reviewStatus, "draft");

  const updated = api.updateDraft({
    actor: { id: "editor-a", roles: ["skill_editor"] },
    versionId: "skill_ver__api",
    patch: {
      changelog: "api updated",
    },
    reason: "update draft",
  });
  assert.equal(updated.changelog, "api updated");

  api.review({
    actor: { id: "reviewer-a", roles: ["skill_reviewer"] },
    versionId: "skill_ver__api",
    decision: "approved",
    reason: "approve draft",
  });
  const published = api.publish({
    actor: { id: "publisher-a", roles: ["skill_publisher"] },
    versionId: "skill_ver__api",
    reason: "publish draft",
  });

  assert.equal(published.releaseStatus, "published");
  assert.equal(api.listAudits({ targetId: "skill_ver__api" }).length >= 2, true);
});
