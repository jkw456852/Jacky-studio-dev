import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const readSource = (path: string): string =>
  readFileSync(join(repoRoot, path), "utf8");

test("assistant sidebar composer keeps official mention and slash command wiring", () => {
  const thread = readSource("components/assistant-ui/thread.tsx");

  assert.match(thread, /\bunstable_useMentionAdapter\s*\(/);
  assert.match(thread, /\bASSISTANT_MENTION_CATEGORIES\b/);
  assert.match(thread, /\bcategories:\s*ASSISTANT_MENTION_CATEGORIES\b/);
  assert.match(thread, /includeModelContextTools:\s*\{/);
  assert.match(thread, /\bcategory:\s*\{\s*id:\s*"capabilities"/);
  assert.match(thread, /\bunstable_useSlashCommandAdapter\s*\(/);
  assert.match(thread, /removeOnExecute:\s*true/);
  assert.match(thread, /<ComposerTriggerPopover\s+char="@"/);
  assert.match(thread, /<ComposerTriggerPopover\s+char="\/"/);
  assert.match(thread, /directiveChip=\{DirectiveChip\}/);
  assert.match(thread, /<MessagePrimitive\.Parts\s+components=\{\{\s*Text:\s*DirectiveText/);
});

test("assistant sidebar does not wire textarea input history into Lexical composer", () => {
  const thread = readSource("components/assistant-ui/thread.tsx");

  assert.match(thread, /\bLexicalComposerInput\b/);
  assert.doesNotMatch(thread, /\bComposerPrimitive\.Input\b/);
  assert.doesNotMatch(thread, /\bunstable_useComposerInputHistory\b/);
});

test("assistant sidebar follow-up suggestions stay runtime-driven and do not render empty chrome", () => {
  const followups = readSource("components/assistant-ui/follow-up-suggestions.tsx");
  const thread = readSource("components/assistant-ui/thread.tsx");
  const runtime = readSource(
    "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx",
  );

  assert.match(runtime, /\bsuggestions:\s*Suggestions\s*\(\s*welcomeSuggestions\s*\)/);
  assert.match(thread, /<ThreadFollowupSuggestions\s*\/>/);
  assert.match(followups, /\buseAuiState\s*\(\s*\(s\)\s*=>\s*s\.thread\.suggestions\s*\)/);
  assert.match(followups, /if\s*\(\s*suggestions\.length\s*===\s*0\s*\)\s*\{\s*return\s+null\s*;/);
  assert.match(followups, /<ThreadPrimitive\.Suggestion[\s\S]*\bprompt=\{suggestion\.prompt\}[\s\S]*\bsend\b[\s\S]*\bclearComposer\b/);
  assert.doesNotMatch(followups, /\bagentData\b|\bskillData\b|\bChatMessage\b/);
  assert.doesNotMatch(followups, /\bautoSend\b|\bmethod=/);
});

test("assistant sidebar static system prompt uses official model context instructions hook", () => {
  const runtime = readSource(
    "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx",
  );
  const registryStart = runtime.indexOf("const buildModelContextRegistry");
  const registryEnd = runtime.indexOf("const toAssistantModelValue", registryStart);
  const registryBlock = runtime.slice(registryStart, registryEnd);

  assert.match(runtime, /\buseAssistantInstructions\b/);
  assert.match(runtime, /\bASSISTANT_SIDEBAR_MODEL_INSTRUCTIONS\b/);
  assert.match(runtime, /\buseAssistantInstructions\(\s*ASSISTANT_SIDEBAR_MODEL_INSTRUCTIONS\s*\)/);
  assert.match(runtime, /<AssistantRuntimeProvider\s+runtime=\{runtime\}\s+aui=\{aui\}>[\s\S]*<AssistantSidebarInstructions\s*\/>/);
  assert.match(registryBlock, /\bnew\s+ModelContextRegistry\s*\(\s*\)/);
  assert.match(registryBlock, /\bconfig:\s*\{/);
  assert.doesNotMatch(registryBlock, /\baddInstruction\s*\(/);
  assert.doesNotMatch(registryBlock, /\bsystem:\s*ASSISTANT_SIDEBAR/);
});

test("assistant sidebar dynamic workspace context uses official assistant context hook", () => {
  const runtime = readSource(
    "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx",
  );
  const contextStart = runtime.indexOf("const buildAssistantSidebarWorkspaceContext");
  const contextEnd = runtime.indexOf("const AssistantComposerImageModeControls", contextStart);
  const contextBlock = runtime.slice(contextStart, contextEnd);

  assert.match(runtime, /\buseAssistantContext\b/);
  assert.match(contextBlock, /\bconst\s+buildAssistantSidebarWorkspaceContext\b/);
  assert.match(contextBlock, /\bconst\s+AssistantSidebarWorkspaceContext\b/);
  assert.match(contextBlock, /\buseAssistantContext\s*\(\s*\{/);
  assert.match(contextBlock, /\bgetContext:\s*\(\)\s*=>/);
  assert.match(contextBlock, /\bCanvas elements:/);
  assert.match(contextBlock, /\bRoot canvas elements:/);
  assert.match(contextBlock, /\bSelected elements:/);
  assert.match(contextBlock, /\bSelected element label:/);
  assert.match(
    runtime,
    /<AssistantRuntimeProvider\s+runtime=\{runtime\}\s+aui=\{aui\}>[\s\S]*<AssistantSidebarWorkspaceContext[\s\S]*browserAgent=\{browserAgent\}[\s\S]*workspaceId=\{workspaceId\}[\s\S]*\/>/,
  );
  assert.doesNotMatch(
    contextBlock,
    /\boriginalUrl\b|\bproxyUrl\b|\bbase64\b|\bChatMessage\b|\bagentData\b|\bskillData\b|services\/agents|services\/skills/,
  );
});

test("assistant sidebar composer labels stay readable after UTF-8 round trips", () => {
  const thread = readSource("components/assistant-ui/thread.tsx");

  for (const label of [
    "图片生成工具",
    "画布目标工具",
    "天气卡片工具",
    "联网搜索工具",
    "本轮需要最新信息时，启用已配置的联网搜索。",
    "本轮需要天气信息时，启用天气查询和天气卡片。",
    "消息输入框，使用 @ 引用上下文，使用 / 调用命令",
    "输入消息，@ 引用上下文，/ 调用命令",
    "没有匹配的引用",
    "没有匹配的命令",
    "图片模式",
    "改图模式",
    "清空输入",
  ]) {
    assert.match(thread, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("assistant sidebar reasoning uses official grouped reasoning composition", () => {
  const api = readSource("api/assistant-chat.ts");
  const runtime = readSource(
    "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx",
  );
  const thread = readSource("components/assistant-ui/thread.tsx");
  const reasoning = readSource("components/assistant-ui/reasoning.tsx");

  assert.match(api, /sendReasoning:\s*true/);
  assert.match(api, /chunk\.type\s*===\s*"reasoning-delta"/);
  assert.match(runtime, /\bpart\.type\s*===\s*"reasoning"/);
  assert.match(thread, /\bMessagePrimitive\.GroupedParts\b/);
  assert.match(thread, /reasoning:\s*\["group-chainOfThought",\s*"group-reasoning"\]/);
  assert.match(thread, /case\s+"group-reasoning"/);
  assert.match(thread, /<ReasoningRoot\s+defaultOpen=\{running\}\s+streaming=\{running\}>/);
  assert.match(thread, /case\s+"reasoning":\s*return showReasoning \? <Reasoning \{\.\.\.part\} \/> : null;/);
  assert.match(reasoning, /const label = `思考过程\$\{durationText\}`;/);
  assert.match(runtime, /\bconst\s+handleReasoningDiagnosis\s*=\s*React\.useCallback\(/);
  assert.match(runtime, /\breasoning_diagnosis\b/);
  assert.match(runtime, /已请求 reasoning，但上游流没有返回 AI SDK reasoning part/);
  assert.match(
    runtime,
    /useAssistantChatRuntime\([\s\S]*setStreamStatus,\s*[\r\n\s]*handleReasoningDiagnosis[\s\S]*\)/,
  );
  assert.doesNotMatch(runtime, /progress-sanitizer|sanitizeAgentProgressMessage|AgentMessage|agentData|skillData/);
  assert.doesNotMatch(thread, /progress-sanitizer|sanitizeAgentProgressMessage|AgentMessage|agentData|skillData/);
});

test("assistant sidebar displays model metadata from AI SDK message metadata", () => {
  const api = readSource("api/assistant-chat.ts");
  const thread = readSource("components/assistant-ui/thread.tsx");

  assert.match(api, /\bmessageMetadata:\s*\(\{\s*part\s*\}\)\s*=>/);
  assert.match(api, /\bcreateAssistantChatMessageMetadata\(part,\s*\{/);
  assert.match(api, /\bmodelId,\s*\n\s*providerId:\s*provider\.id/);
  assert.match(thread, /\bconst\s+MessageModelMetadata\b/);
  assert.match(thread, /\bstate\.message[\s\S]*\.metadata\b/);
  assert.match(thread, /data-slot="message-model-metadata-trigger"/);
  assert.match(thread, /data-slot="message-model-metadata-popover"/);
  assert.match(thread, /<MessageModelMetadata\s+className=/);
  assert.doesNotMatch(thread, /\bagentData\b|\bskillData\b|\bChatMessage\b/);
});

test("assistant sidebar model selector keeps reasoning UI on official effort control", () => {
  const runtime = readSource(
    "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx",
  );

  assert.match(runtime, /<ModelSelector\.Effort\s+label="思考强度"\s*\/>/);
  assert.match(runtime, /\bconst\s+summarizeAssistantSidebarReasoningDiagnosis\b/);
  assert.doesNotMatch(runtime, /\bAssistantComposerModelReasoningStatus\b/);
  assert.doesNotMatch(runtime, /\bgetAssistantSidebarReasoningStatus\b/);
  assert.doesNotMatch(runtime, /\bgetAssistantSidebarReasoningToneClasses\b/);
});

test("assistant governance copy points maintainers toward official assistant-ui and AI SDK paths", () => {
  const mainBrainConfig = readSource(
    "pages/Workspace/components/MainBrainConfigCenter.tsx",
  );
  const roleManagement = readSource(
    "pages/Workspace/components/RoleManagementPanel.tsx",
  );
  const visibleGovernanceCopy = `${mainBrainConfig}\n${roleManagement}`;

  assert.match(visibleGovernanceCopy, /assistant-ui\s*\/\s*AI SDK 官方接法/);
  assert.doesNotMatch(
    visibleGovernanceCopy,
    /是否保留旧链路|回退到旧方案/,
  );
});
