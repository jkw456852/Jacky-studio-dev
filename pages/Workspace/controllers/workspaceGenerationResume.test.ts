import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveLiveWorkspaceGenerationTargetIds,
  resolveWorkspaceGenerationResumeAction,
} from "./workspaceGenerationResume.ts";

test("reuses live generation cards when resuming after a refresh", () => {
  assert.deepEqual(
    resolveLiveWorkspaceGenerationTargetIds(
      ["generated-card-1", "generated-card-2"],
      ["prompt-node", "generated-card-1", "generated-card-2"],
    ),
    ["generated-card-1", "generated-card-2"],
  );
});

test("drops deleted and duplicate generation card ids during resume", () => {
  assert.deepEqual(
    resolveLiveWorkspaceGenerationTargetIds(
      ["deleted-card", "generated-card-1", "generated-card-1", ""],
      ["prompt-node", "generated-card-1"],
    ),
    ["generated-card-1"],
  );
});

test("interrupts a restored synchronous request instead of replaying it", () => {
  assert.equal(
    resolveWorkspaceGenerationResumeAction({ pollingTask: null }),
    "interrupt",
  );
});

test("continues polling only when the provider returned a resumable task id", () => {
  assert.equal(
    resolveWorkspaceGenerationResumeAction({
      pollingTask: { taskId: "image-task-123" },
    }),
    "poll",
  );
});
