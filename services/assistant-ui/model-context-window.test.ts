import assert from "node:assert/strict";
import test from "node:test";

import { resolveAssistantModelContextWindow } from "./model-context-window.ts";

test("resolves documented context windows for supported assistant models", () => {
  assert.equal(resolveAssistantModelContextWindow("gpt-5.4"), 1_048_576);
  assert.equal(resolveAssistantModelContextWindow("gpt-5.4-2026-06-01"), 1_048_576);
  assert.equal(resolveAssistantModelContextWindow("gpt-5.2"), 400_000);
  assert.equal(resolveAssistantModelContextWindow("gpt-4.1-mini"), 1_047_576);
  assert.equal(
    resolveAssistantModelContextWindow("gemini-3.1-flash-lite-preview"),
    1_048_576,
  );
});

test("does not invent a context window for unknown custom models", () => {
  assert.equal(resolveAssistantModelContextWindow("custom-model"), undefined);
  assert.equal(resolveAssistantModelContextWindow(""), undefined);
  assert.equal(resolveAssistantModelContextWindow(null), undefined);
});
