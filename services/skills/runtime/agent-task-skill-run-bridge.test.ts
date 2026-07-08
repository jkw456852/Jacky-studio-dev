import assert from "node:assert/strict";
import test from "node:test";
import {
  beginSkillRunForAgentTask,
  failSkillRunForAgentTask,
  finishSkillRunForAgentTask,
} from "./agent-task-skill-run-bridge.ts";
import { createSkillRunRecorder } from "../runs/skill-run-recorder.ts";
import { listLegacyPresetSkillCatalogEntries } from "../legacy/legacy-skill-catalog.ts";

const sampleSkillData = () =>
  listLegacyPresetSkillCatalogEntries()[0].legacyMetadata.skillData;

test("beginSkillRunForAgentTask records a queued run when metadata carries skillData", () => {
  const recorder = createSkillRunRecorder();
  const active = beginSkillRunForAgentTask(
    {
      id: "task-1",
      input: {
        message: "go",
        metadata: { skillData: sampleSkillData() },
        uploadedAttachments: ["https://example.com/a.png", "blob://x"],
      },
    },
    { recorder, conversationId: "c1" },
  );
  assert.ok(active);
  const run = recorder.store.get(active.runId);
  assert.ok(run);
  assert.equal(run.input.prompt, "go");
  assert.equal(run.conversationId, "c1");
  assert.equal(run.messageId, "task-1");
  assert.equal(run.input.attachments?.length, 2);
});

test("beginSkillRunForAgentTask returns null when no skillData", () => {
  const recorder = createSkillRunRecorder();
  const active = beginSkillRunForAgentTask(
    {
      id: "task-2",
      input: { message: "go", metadata: null },
    },
    { recorder },
  );
  assert.equal(active, null);
});

test("finishSkillRunForAgentTask succeeds when task completes", () => {
  const recorder = createSkillRunRecorder();
  const active = beginSkillRunForAgentTask(
    {
      id: "task-3",
      input: { message: "go", metadata: { skillData: sampleSkillData() } },
    },
    { recorder },
  );
  assert.ok(active);
  finishSkillRunForAgentTask(active, {
    status: "completed",
    output: { message: "done" },
  }, { recorder });

  const run = recorder.store.get(active.runId);
  assert.ok(run);
  assert.equal(run.status, "succeeded");
  assert.equal(run.output?.text, "done");
});

test("finishSkillRunForAgentTask marks failure when task fails", () => {
  const recorder = createSkillRunRecorder();
  const active = beginSkillRunForAgentTask(
    {
      id: "task-4",
      input: { message: "go", metadata: { skillData: sampleSkillData() } },
    },
    { recorder },
  );
  assert.ok(active);
  finishSkillRunForAgentTask(active, {
    status: "failed",
    output: { error: { message: "boom", code: "E_X" } },
  }, { recorder });

  const run = recorder.store.get(active.runId);
  assert.ok(run);
  assert.equal(run.status, "failed");
  assert.equal(run.error?.code, "E_X");
  assert.equal(run.error?.message, "boom");
});

test("failSkillRunForAgentTask captures thrown errors", () => {
  const recorder = createSkillRunRecorder();
  const active = beginSkillRunForAgentTask(
    {
      id: "task-5",
      input: { message: "go", metadata: { skillData: sampleSkillData() } },
    },
    { recorder },
  );
  assert.ok(active);
  failSkillRunForAgentTask(active, { message: "thrown!" }, { recorder });
  const run = recorder.store.get(active.runId);
  assert.ok(run);
  assert.equal(run.status, "failed");
  assert.equal(run.error?.message, "thrown!");
});

test("noop when active is null (defensive)", () => {
  const recorder = createSkillRunRecorder();
  finishSkillRunForAgentTask(null, { status: "completed" }, { recorder });
  failSkillRunForAgentTask(null, { message: "x" }, { recorder });
  assert.equal(recorder.store.list().length, 0);
});

test("recordClarifyEventForAgentTask appends clarify events with question + checklist", async () => {
  const recorder = createSkillRunRecorder();
  const active = beginSkillRunForAgentTask(
    {
      id: "task-clarify",
      input: { message: "go", metadata: { skillData: sampleSkillData() } },
    },
    { recorder },
  );
  assert.ok(active);
  const { recordClarifyEventForAgentTask } = await import("./agent-task-skill-run-bridge.ts");
  recordClarifyEventForAgentTask({
    active,
    decision: {
      shouldClarify: true,
      question: "请补充投放平台",
      missingChecklist: ["平台", "投放周期"],
    },
    recorder,
  });
  const run = recorder.store.get(active.runId);
  assert.ok(run);
  assert.equal(run.clarifyEvents?.length, 1);
  assert.equal(run.clarifyEvents?.[0]?.shouldClarify, true);
  assert.equal(run.clarifyEvents?.[0]?.question, "请补充投放平台");
});

test("recordClarifyEventForAgentTask skips when no signal is provided", async () => {
  const recorder = createSkillRunRecorder();
  const active = beginSkillRunForAgentTask(
    {
      id: "task-clarify-noop",
      input: { message: "go", metadata: { skillData: sampleSkillData() } },
    },
    { recorder },
  );
  assert.ok(active);
  const { recordClarifyEventForAgentTask } = await import("./agent-task-skill-run-bridge.ts");
  recordClarifyEventForAgentTask({
    active,
    decision: { shouldClarify: false },
    recorder,
  });
  const run = recorder.store.get(active.runId);
  assert.ok(run);
  assert.equal(run.clarifyEvents?.length, undefined);
});

test("recordRepairEventForAgentTask appends a repair event when reason is provided", async () => {
  const recorder = createSkillRunRecorder();
  const active = beginSkillRunForAgentTask(
    {
      id: "task-repair",
      input: { message: "go", metadata: { skillData: sampleSkillData() } },
    },
    { recorder },
  );
  assert.ok(active);
  const { recordRepairEventForAgentTask } = await import("./agent-task-skill-run-bridge.ts");
  recordRepairEventForAgentTask({
    active,
    event: {
      reason: "missing prerequisite skill",
      injectedSkillNames: ["workspaceSearch"],
      skillCallsBefore: 1,
      skillCallsAfter: 2,
      fallbackUsed: true,
    },
    recorder,
  });
  const run = recorder.store.get(active.runId);
  assert.ok(run);
  assert.equal(run.repairEvents?.length, 1);
  assert.equal(run.repairEvents?.[0]?.reason, "missing prerequisite skill");
  assert.deepEqual(run.repairEvents?.[0]?.injectedSkillNames, ["workspaceSearch"]);
});

test("recordRepairEventForAgentTask skips empty events", async () => {
  const recorder = createSkillRunRecorder();
  const active = beginSkillRunForAgentTask(
    {
      id: "task-repair-noop",
      input: { message: "go", metadata: { skillData: sampleSkillData() } },
    },
    { recorder },
  );
  assert.ok(active);
  const { recordRepairEventForAgentTask } = await import("./agent-task-skill-run-bridge.ts");
  recordRepairEventForAgentTask({ active, event: {}, recorder });
  const run = recorder.store.get(active.runId);
  assert.ok(run);
  assert.equal(run.repairEvents?.length, undefined);
});

test("recordFallbackEventForAgentTask appends a fallback event", async () => {
  const recorder = createSkillRunRecorder();
  const active = beginSkillRunForAgentTask(
    {
      id: "task-fallback",
      input: { message: "go", metadata: { skillData: sampleSkillData() } },
    },
    { recorder },
  );
  assert.ok(active);
  const { recordFallbackEventForAgentTask } = await import("./agent-task-skill-run-bridge.ts");
  recordFallbackEventForAgentTask({
    active,
    event: {
      kind: "switch-skill",
      fromSkill: "generateVideo",
      toSkill: "generateImage",
      reason: "video provider unavailable",
      errorCode: "PROVIDER_DOWN",
    },
    recorder,
  });
  const run = recorder.store.get(active.runId);
  assert.ok(run);
  assert.equal(run.fallbackEvents?.length, 1);
  assert.equal(run.fallbackEvents?.[0]?.kind, "switch-skill");
  assert.equal(run.fallbackEvents?.[0]?.toSkill, "generateImage");
});
