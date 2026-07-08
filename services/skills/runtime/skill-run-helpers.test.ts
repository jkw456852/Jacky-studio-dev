import assert from "node:assert/strict";
import test from "node:test";
import {
  finalizeRunFromExecutionOutcome,
  recordRunFromExecutionContext,
} from "./skill-run-helpers.ts";
import { createSkillRunRecorder } from "../runs/skill-run-recorder.ts";
import { listLegacyPresetSkillCatalogEntries } from "../legacy/legacy-skill-catalog.ts";

const sampleSkillData = () =>
  listLegacyPresetSkillCatalogEntries()[0].legacyMetadata.skillData;

test("recordRunFromExecutionContext bridges a legacy AgentTaskMetadata-shaped object", () => {
  const recorder = createSkillRunRecorder();
  const skillData = sampleSkillData();
  const started = recordRunFromExecutionContext({
    metadata: { skillData, conversationId: "c-9" },
    prompt: "hello",
    recorder,
  });
  assert.ok(started);
  assert.equal(started.run.conversationId, "c-9");
  assert.equal(started.run.input.prompt, "hello");

  const finished = finalizeRunFromExecutionOutcome(
    started.run.id,
    { kind: "success", output: { text: "done" } },
    recorder,
  );
  assert.ok(finished);
  assert.equal(finished.status, "succeeded");
});

test("recordRunFromExecutionContext gives null when metadata has no skillData", () => {
  const recorder = createSkillRunRecorder();
  const started = recordRunFromExecutionContext({
    metadata: { conversationId: "c" },
    prompt: "x",
    recorder,
  });
  assert.equal(started, null);
});
