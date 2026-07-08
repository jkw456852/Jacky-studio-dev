import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const readSource = (path: string): string =>
  readFileSync(join(repoRoot, path), "utf8");

test("assistant sidebar GPT reasoning efforts follow official OpenAI limits", () => {
  const runtime = readSource(
    "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx",
  );

  assert.match(runtime, /\bconst\s+OPENAI_GPT5_REASONING_EFFORTS\b/);
  assert.match(runtime, /\bconst\s+OPENAI_GPT51_REASONING_EFFORTS\b/);
  assert.match(runtime, /\bconst\s+OPENAI_GPT51_CODEX_MAX_REASONING_EFFORTS\b/);
  assert.match(runtime, /\bconst\s+OPENAI_COMPATIBLE_REASONING_EFFORTS\b/);
  assert.match(runtime, /normalized\.startsWith\("gpt-5\.1-codex-max"\)/);
  assert.match(runtime, /normalized\.startsWith\("gpt-5\.1"\)/);
  assert.match(runtime, /isAssistantSidebarOfficialOpenAIProvider\(provider\)/);
  assert.match(runtime, /OPENAI_COMPATIBLE_REASONING_EFFORTS/);
  assert.match(runtime, /buildAssistantChatProviderConfig\(config\.providerId\)/);

  const gpt5Start = runtime.indexOf("const OPENAI_GPT5_REASONING_EFFORTS");
  const gpt51Start = runtime.indexOf("const OPENAI_GPT51_REASONING_EFFORTS");
  const gpt5Block = runtime.slice(gpt5Start, gpt51Start);
  const compatibleStart = runtime.indexOf("const OPENAI_COMPATIBLE_REASONING_EFFORTS");
  const standardStart = runtime.indexOf("const OPENAI_STANDARD_REASONING_EFFORTS");
  const compatibleBlock = runtime.slice(compatibleStart, standardStart);

  assert.doesNotMatch(gpt5Block, /id:\s*"none"/);
  assert.doesNotMatch(gpt5Block, /id:\s*"xhigh"/);
  assert.match(gpt5Block, /id:\s*"minimal"/);
  assert.match(compatibleBlock, /id:\s*"none"/);
  assert.match(compatibleBlock, /id:\s*"xhigh"/);
});

test("assistant sidebar defaults reasoning effort through official model context", () => {
  const runtime = readSource(
    "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx",
  );
  const modelSelector = readSource("components/assistant-ui/model-selector.tsx");

  assert.match(runtime, /\bconst\s+getDefaultReasoningEffortForSelection\b/);
  assert.match(runtime, /modelMode\s*===\s*"thinking"\s*\?\s*"high"\s*:\s*"medium"/);
  assert.match(runtime, /\bresolveModelEffort\(\s*modelOptions,\s*selectedModelValue,\s*preferred\s*,\s*\)/);
  assert.match(runtime, /\bresolveModelEffort\(\s*modelOptions,\s*selectedModelValue,\s*"medium"\s*,?\s*\)/);
  assert.match(runtime, /\bsetSelectedReasoningEffort\(\(current\)\s*=>\s*\{/);
  assert.match(runtime, /if\s*\(\s*resolveModelEffort\(modelOptions,\s*selectedModelValue,\s*current\)\s*\)/);
  assert.match(runtime, /return\s+defaultEffort;/);
  assert.match(runtime, /getDefaultReasoningEffortForSelection\(\s*modelOptions,\s*selectedModelValue,\s*modelMode,\s*\)/);
  assert.match(modelSelector, /\bModelSelector\.ModelContext\s*=\s*ModelSelectorModelContext/);
  assert.match(runtime, /<ModelSelector\.ModelContext\s*\/>/);
  assert.doesNotMatch(runtime, /\bAssistantComposerModelContextBridge\b/);
});
