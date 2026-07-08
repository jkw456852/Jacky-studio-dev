import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionSkillRunStatus,
  compileSkillPlan,
  createInMemorySkillAuditStore,
  createInMemorySkillCatalogStore,
  createSkillGovernanceApi,
  createSkillGovernanceService,
  createInMemorySkillRunStore,
  isCompiledSkillPlanActive,
  listSkillAuditTimeline,
  listLegacyPresetSkillCatalogEntries,
  recordClarifyEventForAgentTask,
  beginSkillRunForAgentTask,
  resolveSkillIdentity,
  summarizeManifestValidation,
  validateSkillManifest,
} from "./index-platform.ts";

test("index-platform exposes the integrated phase-1 contract", () => {
  const entries = listLegacyPresetSkillCatalogEntries();
  assert.ok(entries.length > 0, "expected at least one builtin entry");

  const sample = entries[0];
  const lookup = resolveSkillIdentity({
    kind: "definitionId",
    value: sample.definition.id,
  });
  assert.ok(lookup);
  assert.equal(lookup.definition.id, sample.definition.id);

  const validation = validateSkillManifest(sample.version.manifest);
  assert.equal(validation.valid, true, summarizeManifestValidation(validation));

  const store = createInMemorySkillRunStore();
  const run = store.create({
    skillDefinitionId: lookup.definition.id,
    skillVersionId: lookup.version.id,
    presetId: lookup.preset.id,
    triggerMode: "manual",
    input: { prompt: "smoke" },
  });
  assert.equal(run.status, "queued");
  assert.equal(canTransitionSkillRunStatus("queued", "running"), true);
});

test("compileSkillPlan + clarify recorder are exposed through the index", async () => {
  const entry = listLegacyPresetSkillCatalogEntries()[0];
  const plan = compileSkillPlan({
    version: entry.version,
    metadata: { allowAutonomousRouting: true, enableWebSearch: true },
  });
  assert.equal(typeof plan.skillKey, "string");
  assert.equal(isCompiledSkillPlanActive(plan), plan.active);

  const { createSkillRunRecorder } = await import("./runs/skill-run-recorder.ts");
  const recorder = createSkillRunRecorder();
  const active = beginSkillRunForAgentTask(
    {
      id: "smoke-clarify",
      input: { message: "go", metadata: { skillData: entry.legacyMetadata.skillData } },
    },
    { recorder },
  );
  assert.ok(active);
  recordClarifyEventForAgentTask({
    active,
    decision: { shouldClarify: true, question: "补充上下文", missingChecklist: ["平台"] },
    recorder,
  });
  const stored = recorder.store.get(active.runId);
  assert.ok(stored);
  assert.equal(stored.clarifyEvents?.length, 1);
});

test("governance exports can create, review, and publish a draft", () => {
  const catalog = createInMemorySkillCatalogStore();
  const governance = createSkillGovernanceService({
    catalog,
    workspaceId: "workspace-1",
  });

  const definition = {
    id: "skill_def__index",
    key: "builtin.test.index",
    name: "Index Skill",
    summary: "summary",
    ownerType: "system" as const,
    ownerId: "system",
    sourceType: "builtin" as const,
    tags: ["index"],
    status: "active" as const,
    createdAt: 1,
    updatedAt: 1,
  };
  const version = {
    id: "skill_ver__index",
    skillDefinitionId: "skill_def__index",
    semver: "1.0.0",
    manifest: {
      kind: "agent-skill" as const,
      identity: {
        key: "builtin.test.index",
        displayName: "Index Skill",
      },
      inputSchema: { type: "object" },
      ui: {},
      routing: { mode: "manual" as const },
      execution: { executorType: "agent-plan" as const },
      outputContract: {},
      permissions: {},
      observability: {
        traceLevel: "basic" as const,
        saveInputs: true,
        saveOutputs: true,
        saveIntermediateCalls: false,
      },
    },
    reviewStatus: "draft" as const,
    releaseStatus: "draft" as const,
    createdAt: 1,
    createdBy: "editor-a",
  };

  governance.createDraft({
    actor: { id: "editor-a", roles: ["skill_editor"] },
    input: { definition, version },
    reason: "create draft",
  });
  governance.reviewVersion({
    actor: { id: "reviewer-a", roles: ["skill_reviewer"] },
    versionId: "skill_ver__index",
    decision: "approved",
    reason: "approve draft",
  });
  const published = governance.publishVersion({
    actor: { id: "publisher-a", roles: ["skill_publisher"] },
    versionId: "skill_ver__index",
    reason: "publish draft",
  });

  assert.equal(published.releaseStatus, "published");
  assert.equal(
    governance.listAuditRecords({ targetId: "skill_ver__index" }).length >= 2,
    true,
  );
});

test("audit timeline and governance api are exposed through the platform index", () => {
  const catalog = createInMemorySkillCatalogStore();
  const audits = createInMemorySkillAuditStore({
    now: () => 100,
  });
  const governance = createSkillGovernanceService({
    catalog,
    audits,
    workspaceId: "workspace-1",
  });
  const api = createSkillGovernanceApi({ catalog, governance });

  api.createDraft({
    actor: { id: "editor-a", roles: ["skill_editor"] },
    input: {
      definition: {
        id: "skill_def__timeline",
        key: "builtin.test.timeline",
        name: "Timeline Skill",
        summary: "summary",
        ownerType: "system",
        ownerId: "system",
        sourceType: "builtin",
        tags: ["timeline"],
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      },
      version: {
        id: "skill_ver__timeline",
        skillDefinitionId: "skill_def__timeline",
        semver: "1.0.0",
        manifest: {
          kind: "agent-skill",
          identity: {
            key: "builtin.test.timeline",
            displayName: "Timeline Skill",
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
        },
        reviewStatus: "draft",
        releaseStatus: "draft",
        createdAt: 1,
        createdBy: "editor-a",
      },
    },
    reason: "create timeline draft",
  });

  const rows = listSkillAuditTimeline({
    source: audits,
    targetId: "skill_ver__timeline",
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Version created");
});
