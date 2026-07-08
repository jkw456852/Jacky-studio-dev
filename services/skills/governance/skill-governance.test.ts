import assert from "node:assert/strict";
import test from "node:test";

import type {
  SkillDefinition,
  SkillManifest,
  SkillVersion,
} from "../catalog/skill-object-types.ts";
import { createInMemorySkillCatalogStore } from "../catalog/store/skill-catalog-store.ts";
import {
  assertActorCanPerformSkillAction,
  canActorPerformSkillAction,
  createInMemorySkillAuditStore,
  createSkillGovernanceService,
} from "./skill-governance.ts";

const manifest = (
  overrides: Partial<SkillManifest["permissions"]> = {},
): SkillManifest => ({
  kind: "agent-skill",
  identity: {
    key: "builtin.test.governed",
    displayName: "Governed Skill",
  },
  inputSchema: { type: "object" },
  ui: {},
  routing: { mode: "manual" },
  execution: { executorType: "agent-plan" },
  outputContract: {},
  permissions: {
    ...overrides,
  },
  observability: {
    traceLevel: "basic",
    saveInputs: true,
    saveOutputs: true,
    saveIntermediateCalls: false,
  },
});

const definition = (): SkillDefinition => ({
  id: "skill_def__governed",
  key: "builtin.test.governed",
  name: "Governed Skill",
  summary: "summary",
  ownerType: "system",
  ownerId: "system",
  sourceType: "builtin",
  tags: ["governance"],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
});

const version = (
  id: string,
  permissionOverrides: Partial<SkillManifest["permissions"]> = {},
): SkillVersion => ({
  id,
  skillDefinitionId: "skill_def__governed",
  semver: "1.0.0",
  manifest: manifest(permissionOverrides),
  reviewStatus: "draft",
  releaseStatus: "draft",
  createdAt: 1,
  createdBy: "editor-a",
});

test("role checks follow the documented RBAC matrix", () => {
  assert.equal(
    canActorPerformSkillAction(
      { id: "viewer", roles: ["skill_viewer"] },
      "create_draft",
    ),
    false,
  );
  assert.equal(
    canActorPerformSkillAction(
      { id: "editor", roles: ["skill_editor"] },
      "create_draft",
    ),
    true,
  );
  assert.equal(
    canActorPerformSkillAction(
      { id: "publisher", roles: ["skill_publisher"] },
      "publish",
    ),
    true,
  );
  assert.throws(
    () =>
      assertActorCanPerformSkillAction(
        { id: "viewer", roles: ["skill_viewer"] },
        "publish",
      ),
    /skill_governance_forbidden/,
  );
});

test("governance service audits draft creation, review submission, and approval", () => {
  const catalog = createInMemorySkillCatalogStore();
  const audits = createInMemorySkillAuditStore();
  const governance = createSkillGovernanceService({
    catalog,
    audits,
    workspaceId: "workspace-1",
  });

  governance.createDraft({
    actor: { id: "editor-a", roles: ["skill_editor"] },
    input: {
      definition: definition(),
      version: version("skill_ver__draft"),
    },
    reason: "create initial draft",
  });
  governance.submitVersionForReview({
    actor: { id: "editor-a", roles: ["skill_editor"] },
    versionId: "skill_ver__draft",
    reason: "ready for review",
  });
  governance.reviewVersion({
    actor: { id: "reviewer-a", roles: ["skill_reviewer"] },
    versionId: "skill_ver__draft",
    decision: "approved",
    reason: "looks good",
  });

  const records = governance.listAuditRecords();
  assert.equal(records.length, 4);
  assert.equal(records[0].eventType, "skill.version.reviewed");
  assert.equal(records[1].eventType, "skill.version.updated");
  assert.equal(records[2].eventType, "skill.version.created");
  assert.equal(records[3].eventType, "skill.definition.created");
});

test("editing an approved draft resets it back to draft review status and audits the change", () => {
  const catalog = createInMemorySkillCatalogStore();
  const governance = createSkillGovernanceService({
    catalog,
    workspaceId: "workspace-1",
  });

  governance.createDraft({
    actor: { id: "editor-a", roles: ["skill_editor"] },
    input: {
      definition: definition(),
      version: version("skill_ver__editable"),
    },
    reason: "create editable draft",
  });
  governance.reviewVersion({
    actor: { id: "reviewer-a", roles: ["skill_reviewer"] },
    versionId: "skill_ver__editable",
    decision: "approved",
    reason: "approve once",
  });

  const updated = governance.updateDraftVersion({
    actor: { id: "editor-a", roles: ["skill_editor"] },
    versionId: "skill_ver__editable",
    patch: {
      manifest: {
        ...manifest(),
        execution: {
          executorType: "agent-plan",
          toolPolicy: ["tighten scope"],
        },
      },
    },
    reason: "tighten policy",
  });

  assert.equal(updated.reviewStatus, "draft");
  const audit = governance.listAuditRecords({
    eventType: "skill.version.updated",
    targetId: "skill_ver__editable",
  })[0];
  assert.ok(audit);
  assert.equal(audit.metadata?.reviewReset, true);
});

test("high-risk versions require dual approval before publish", () => {
  const catalog = createInMemorySkillCatalogStore();
  const governance = createSkillGovernanceService({
    catalog,
    workspaceId: "workspace-1",
  });

  governance.createDraft({
    actor: { id: "editor-a", roles: ["skill_editor"] },
    input: {
      definition: definition(),
      version: version("skill_ver__high-risk", { needsFileWrite: true }),
    },
    reason: "create risky draft",
  });
  governance.reviewVersion({
    actor: { id: "reviewer-a", roles: ["skill_reviewer"] },
    versionId: "skill_ver__high-risk",
    decision: "approved",
    reason: "first approval",
  });

  assert.throws(
    () =>
      governance.publishVersion({
        actor: { id: "publisher-a", roles: ["skill_publisher"] },
        versionId: "skill_ver__high-risk",
        reason: "publish risky version",
      }),
    /skill_version_requires_dual_approval/,
  );

  governance.reviewVersion({
    actor: { id: "reviewer-b", roles: ["skill_reviewer"] },
    versionId: "skill_ver__high-risk",
    decision: "approved",
    reason: "second approval",
  });

  const published = governance.publishVersion({
    actor: { id: "publisher-a", roles: ["skill_publisher"] },
    versionId: "skill_ver__high-risk",
    reason: "publish risky version",
  });
  assert.equal(published.releaseStatus, "published");
});

test("rollback writes an audit event and restores the target version", () => {
  const catalog = createInMemorySkillCatalogStore();
  const governance = createSkillGovernanceService({
    catalog,
    workspaceId: "workspace-1",
  });

  governance.createDraft({
    actor: { id: "editor-a", roles: ["skill_editor"] },
    input: {
      definition: definition(),
      version: version("skill_ver__v1"),
    },
    reason: "v1",
  });
  governance.reviewVersion({
    actor: { id: "reviewer-a", roles: ["skill_reviewer"] },
    versionId: "skill_ver__v1",
    decision: "approved",
    reason: "approve v1",
  });
  governance.publishVersion({
    actor: { id: "publisher-a", roles: ["skill_publisher"] },
    versionId: "skill_ver__v1",
    reason: "publish v1",
  });

  governance.createDraft({
    actor: { id: "editor-a", roles: ["skill_editor"] },
    input: {
      definition: catalog.getDefinition("skill_def__governed")!,
      version: version("skill_ver__v2"),
    },
    reason: "v2",
  });
  governance.reviewVersion({
    actor: { id: "reviewer-a", roles: ["skill_reviewer"] },
    versionId: "skill_ver__v2",
    decision: "approved",
    reason: "approve v2",
  });
  governance.publishVersion({
    actor: { id: "publisher-a", roles: ["skill_publisher"] },
    versionId: "skill_ver__v2",
    reason: "publish v2",
  });

  const restored = governance.rollbackVersion({
    actor: { id: "publisher-a", roles: ["skill_publisher"] },
    definitionId: "skill_def__governed",
    versionId: "skill_ver__v1",
    reason: "rollback regression",
  });

  assert.equal(restored.releaseStatus, "published");
  const rollbackAudit = governance.listAuditRecords({
    eventType: "skill.version.rolled_back",
  })[0];
  assert.ok(rollbackAudit);
  assert.equal(rollbackAudit.metadata?.fromVersionId, "skill_ver__v2");
  assert.equal(rollbackAudit.metadata?.toVersionId, "skill_ver__v1");
});
