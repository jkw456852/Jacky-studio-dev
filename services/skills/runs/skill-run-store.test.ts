import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionSkillRunStatus,
  createInMemorySkillRunStore,
  isTerminalSkillRunStatus,
} from "./skill-run-store.ts";

const baseInput = {
  skillDefinitionId: "skill_def__test",
  skillVersionId: "skill_ver__test",
  triggerMode: "manual" as const,
  input: { prompt: "hello" },
};

test("createInMemorySkillRunStore assigns ids and defaults status to queued", () => {
  const store = createInMemorySkillRunStore();
  const run = store.create(baseInput);
  assert.ok(run.id.startsWith("skill_run_"));
  assert.equal(run.status, "queued");
  assert.equal(run.input.prompt, "hello");
  assert.ok(run.createdAt > 0);
  assert.equal(run.createdAt, run.updatedAt);
});

test("update walks legal transitions and stamps startedAt / completedAt", () => {
  let clock = 100;
  const store = createInMemorySkillRunStore({ now: () => (clock += 10) });
  const run = store.create(baseInput);

  const planning = store.update(run.id, { status: "planning" });
  assert.ok(planning);
  assert.equal(planning.status, "planning");

  const running = store.update(run.id, { status: "running" });
  assert.ok(running);
  assert.equal(running.status, "running");
  assert.ok(running.startedAt && running.startedAt > 0);

  const succeeded = store.update(run.id, {
    status: "succeeded",
    output: { text: "ok" },
  });
  assert.ok(succeeded);
  assert.equal(succeeded.status, "succeeded");
  assert.equal(succeeded.output?.text, "ok");
  assert.ok(succeeded.completedAt && succeeded.completedAt > 0);
});

test("update rejects illegal transitions and keeps terminal runs immutable", () => {
  const store = createInMemorySkillRunStore();
  const run = store.create(baseInput);

  assert.throws(
    () => store.update(run.id, { status: "succeeded" }),
    /skill_run_invalid_transition/,
  );

  store.update(run.id, { status: "running" });
  store.update(run.id, { status: "failed", error: { code: "e", message: "x" } });

  assert.throws(
    () => store.update(run.id, { status: "succeeded" }),
    /skill_run_terminal_status_immutable/,
  );
});

test("list applies filters and respects limit, ordered by updatedAt desc", () => {
  let clock = 1000;
  const store = createInMemorySkillRunStore({ now: () => (clock += 5) });
  const a = store.create({ ...baseInput, conversationId: "c1" });
  const b = store.create({ ...baseInput, conversationId: "c2" });
  store.update(a.id, { status: "planning" });

  const all = store.list();
  assert.equal(all.length, 2);
  assert.equal(all[0].id, a.id, "most recently updated should be first");

  const filtered = store.list({ conversationId: "c2" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, b.id);

  const limited = store.list({ limit: 1 });
  assert.equal(limited.length, 1);
});

test("helpers expose transition table and terminal predicate", () => {
  assert.equal(isTerminalSkillRunStatus("succeeded"), true);
  assert.equal(isTerminalSkillRunStatus("running"), false);
  assert.equal(canTransitionSkillRunStatus("queued", "running"), true);
  assert.equal(canTransitionSkillRunStatus("running", "queued"), false);
  assert.equal(canTransitionSkillRunStatus("succeeded", "running"), false);
});
