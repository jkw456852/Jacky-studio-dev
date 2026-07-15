import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const SOURCE_ROOTS = ["api", "components", "hooks", "pages", "services"] as const;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const DOCUMENT_ROOTS = ["docs"] as const;
const DOCUMENT_EXTENSIONS = new Set([".md", ".txt"]);
const EXCLUDED_PATH_SEGMENTS = new Set([
  ".git",
  ".codex-temp",
  "dist",
  "node_modules",
]);

type ScannedFile = {
  path: string;
  text: string;
};

const hasSourceExtension = (path: string): boolean => {
  const match = /\.[^.\\/]+$/.exec(path);
  return Boolean(match && SOURCE_EXTENSIONS.has(match[0]));
};

const hasDocumentExtension = (path: string): boolean => {
  const match = /\.[^.\\/]+$/.exec(path);
  return Boolean(match && DOCUMENT_EXTENSIONS.has(match[0]));
};

const shouldSkipPath = (path: string): boolean => {
  const segments = path.split(/[\\/]+/);
  return segments.some((segment) => EXCLUDED_PATH_SEGMENTS.has(segment));
};

const collectSourceFiles = (directory: string): string[] => {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    if (shouldSkipPath(fullPath)) continue;

    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (!hasSourceExtension(fullPath) || /\.test\.[tj]sx?$/.test(fullPath)) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
};

const collectDocumentFiles = (directory: string): string[] => {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    if (shouldSkipPath(fullPath)) continue;

    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectDocumentFiles(fullPath));
      continue;
    }

    if (!hasDocumentExtension(fullPath)) continue;
    files.push(fullPath);
  }

  return files;
};

const readProjectSources = (): ScannedFile[] =>
  SOURCE_ROOTS.flatMap((root) => collectSourceFiles(join(repoRoot, root))).map(
    (path) => ({
      path: relative(repoRoot, path).split(sep).join("/"),
      text: readFileSync(path, "utf8"),
    }),
  );

const readProjectDocuments = (): ScannedFile[] =>
  DOCUMENT_ROOTS.flatMap((root) => collectDocumentFiles(join(repoRoot, root))).map(
    (path) => ({
      path: relative(repoRoot, path).split(sep).join("/"),
      text: readFileSync(path, "utf8"),
    }),
  );

const findPatternViolations = (
  files: ScannedFile[],
  patterns: Array<{ name: string; pattern: RegExp; allow?: (path: string) => boolean }>,
) => {
  const violations: string[] = [];

  for (const file of files) {
    for (const { name, pattern, allow } of patterns) {
      if (allow?.(file.path)) continue;
      if (!pattern.test(file.text)) continue;
      violations.push(`${file.path}: ${name}`);
    }
  }

  return violations;
};

test("assistant-ui integration stays on official toolkit APIs", () => {
  const files = readProjectSources();
  const violations = findPatternViolations(files, [
    {
      name: "deprecated component-scoped tool API",
      pattern:
        /\b(?:useAssistantTool|makeAssistantTool|useAssistantToolUI|makeAssistantToolUI)\b/,
    },
    {
      name: "deprecated react-ai-sdk generativeTools helper",
      pattern: /\bgenerativeTools\s*\(/,
    },
    {
      name: "direct frontendTools helper use instead of AISDKToolkit.tools({ frontend })",
      pattern: /\bfrontendTools\s*\(/,
    },
    {
      name: "direct AISDKToolkit construction outside the server wrapper",
      pattern: /\bnew\s+AISDKToolkit\s*\(/,
      allow: (path) =>
        path === "services/assistant-ui/assistant-ai-sdk-toolkit-server.ts",
    },
  ]);

  assert.deepEqual(violations, []);
});

test("assistant sidebar exposes tools through official frontend and backend toolkit anchors", () => {
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const frontendToolkit = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolkit.tsx"),
    "utf8",
  );
  const backendToolkit = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-server-toolkit.ts"),
    "utf8",
  );
  const aiSdkWrapper = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-ai-sdk-toolkit-server.ts"),
    "utf8",
  );
  const viteConfig = readFileSync(join(repoRoot, "vite.config.ts"), "utf8");
  const mcpAppsHost = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-mcp-apps-host.ts"),
    "utf8",
  );
  const mcpAppsApi = readFileSync(join(repoRoot, "api/mcp-apps.ts"), "utf8");
  const assistantChatApi = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );

  assert.match(runtime, /Tools\s*\(\s*\{\s*[\s\S]*toolkit:\s*assistantSidebarToolkit[\s\S]*mcpApp:\s*McpAppRenderer\s*\(/);
  assert.match(runtime, /\bMcpAppsRemoteHost\s*\(\s*\{\s*url:\s*ASSISTANT_SIDEBAR_MCP_APPS_URL\s*\}/);
  assert.match(frontendToolkit, /defineToolkit\s*\(/);
  assert.match(frontendToolkit, /\bexternalTool\s*\(/);
  assert.match(frontendToolkit, /\bproviderTool\s*\(/);
  assert.match(viteConfig, /import\s+\{\s*aui\s*\}\s+from\s+["']@assistant-ui\/vite["']/);
  assert.match(viteConfig, /plugins:\s*\[[\s\S]*?\baui\(\)/);
  assert.match(backendToolkit, /defineToolkit\s*\(/);
  assert.match(backendToolkit, /defineMcpToolkit\s*\(/);
  assert.match(aiSdkWrapper, /new\s+AISDKToolkit\s*\(\s*\{\s*toolkit\s*\}\s*\)/);
  assert.match(mcpAppsHost, /\bcreateMCPClient\b/);
  assert.match(mcpAppsHost, /\bcreateAssistantSidebarMcpToolkitDefinition\b/);
  assert.match(mcpAppsApi, /\bhandleAssistantSidebarMcpAppsHostRequest\b/);
  assert.match(assistantChatApi, /\.tools\s*\(\s*\{\s*frontend:\s*frontendToolSchemas\s*,?\s*\}\s*\)/);
});

test("assistant sidebar declares provider-native tools with official providerTool", () => {
  const frontendToolkit = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolkit.tsx"),
    "utf8",
  );

  for (const [toolName, providerId] of [
    ["web_search", "openai.web_search"],
    ["google_search", "google.google_search"],
    ["image_generation", "openai.image_generation"],
  ] as const) {
    const start = frontendToolkit.indexOf(`${toolName}:`);
    assert.ok(start >= 0, `${toolName} toolkit block should exist`);
    const end = frontendToolkit.indexOf("\n  },", start);
    const block = frontendToolkit.slice(start, end + 5);
    assert.match(block, /\bexecute:\s*providerTool\(\{/);
    assert.match(block, new RegExp(`providerId:\\s*["']${providerId.replace(".", "\\.")}["']`));
    assert.doesNotMatch(block, /\bexecute:\s*externalTool\(\)/);
  }
});

test("assistant sidebar mounts the official developer-only devtools", () => {
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );

  assert.match(
    runtime,
    /import\s+\{\s*DevToolsModal\s*\}\s+from\s+["']@assistant-ui\/react-devtools["']/,
  );
  assert.match(
    runtime,
    /<AssistantRuntimeProvider\s+runtime=\{runtime\}\s+aui=\{aui\}>[\s\S]*?\{import\.meta\.env\.DEV\s*\?\s*<DevToolsModal\s*\/>\s*:\s*null\}/,
  );
  assert.doesNotMatch(runtime, /\bAgentMessage\b|\bagentData\b|\bskillData\b|\bChatMessage\b/);
});

test("assistant chat uses official AI SDK DevTools only in local development", () => {
  const api = readFileSync(join(repoRoot, "api/assistant-chat.ts"), "utf8");
  const devTools = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-ai-sdk-devtools.ts"),
    "utf8",
  );
  const packageJson = readFileSync(join(repoRoot, "package.json"), "utf8");
  const gitignore = readFileSync(join(repoRoot, ".gitignore"), "utf8");

  assert.match(packageJson, /"@ai-sdk\/devtools":\s*"0\.0\.24"/);
  assert.match(devTools, /import\s*\{[\s\S]*\bwrapLanguageModel\b[\s\S]*\}\s*from\s*["']ai["']/);
  assert.match(devTools, /import\(["']@ai-sdk\/devtools["']\)/);
  assert.match(devTools, /middleware:\s*devToolsMiddleware\(\)/);
  assert.match(devTools, /NODE_ENV\s*!==\s*["']production["']/);
  assert.match(devTools, /VERCEL_ENV\s*!==\s*["']production["']/);
  assert.match(api, /await\s+wrapAssistantLanguageModelWithDevTools\(baseModel\)/);
  assert.match(gitignore, /^\.devtools\/$/m);
});

test("assistant sidebar first-party tools render as standalone toolkit UIs", () => {
  const thread = readFileSync(
    join(repoRoot, "components/assistant-ui/thread.tsx"),
    "utf8",
  );
  const attachment = readFileSync(
    join(repoRoot, "components/assistant-ui/attachment.tsx"),
    "utf8",
  );
  const serverToolkit = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-server-toolkit.ts"),
    "utf8",
  );
  const frontendToolkit = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolkit.tsx"),
    "utf8",
  );
  const toolUis = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolUis.tsx"),
    "utf8",
  );

  for (const [toolName, renderName] of [
    ["webSearch", "WorkspaceSearchToolUI"],
    ["tavilyExtract", "TavilyExtractToolUI"],
    ["tavilyCrawl", "TavilyCrawlToolUI"],
    ["tavilyMap", "TavilyMapToolUI"],
    ["web_search", "NativeWebSearchToolUI"],
    ["google_search", "NativeWebSearchToolUI"],
    ["getWeather", "WeatherToolUI"],
    ["createImage", "GenerateImageToolUI"],
    ["listStudioSkills", "ListStudioSkillsToolUI"],
    ["planStudioWorkflow", "PlanStudioWorkflowToolUI"],
    ["searchWorkspaceKnowledge", "SearchWorkspaceKnowledgeToolUI"],
    ["createTargetElement", "CreateTargetElementToolUI"],
  ] as const) {
    const toolBlock = new RegExp(
      `${toolName}:\\s*\\{[\\s\\S]*?display:\\s*["']standalone["'][\\s\\S]*?render:\\s*${renderName}`,
    );
    assert.match(frontendToolkit, toolBlock);
    assert.match(toolUis, new RegExp(`export\\s+const\\s+${renderName}\\b`));
  }

  for (const toolName of [
    "webSearch",
    "tavilyExtract",
    "tavilyCrawl",
    "tavilyMap",
    "createImage",
    "getWeather",
    "listStudioSkills",
    "planStudioWorkflow",
    "searchWorkspaceKnowledge",
  ] as const) {
    assert.match(
      serverToolkit,
      new RegExp(`\\?\\s*\\{\\s*${toolName}:\\s*${toolName}Tool\\s*\\}`),
    );
    assert.match(
      frontendToolkit,
      new RegExp(
        `${toolName}:\\s*\\{[\\s\\S]*?display:\\s*["']standalone["']`,
      ),
    );
  }

  for (const toolName of [
    "webSearch",
    "tavilyExtract",
    "tavilyCrawl",
    "tavilyMap",
    "createImage",
    "getWeather",
    "listStudioSkills",
    "planStudioWorkflow",
    "searchWorkspaceKnowledge",
  ] as const) {
    const frontendToolStart = frontendToolkit.indexOf(`${toolName}:`);
    assert.ok(frontendToolStart >= 0, `${toolName} frontend toolkit block should exist`);
    const frontendToolEnd = frontendToolkit.indexOf("\n  },", frontendToolStart);
    const frontendToolBlock = frontendToolkit.slice(
      frontendToolStart,
      frontendToolEnd + 5,
    );
    assert.match(frontendToolBlock, /\bexecute:\s*externalTool\(\)/);
    assert.doesNotMatch(frontendToolBlock, /\bexecute:\s*providerTool\(/);
    assert.doesNotMatch(frontendToolBlock, /\bexecute:\s*stubTool\(\)/);
    assert.match(
      serverToolkit,
      new RegExp(`\\bconst\\s+${toolName}Tool\\s*=\\s*toBackendToolkitEntry\\(`),
    );
  }

  for (const toolName of ["web_search", "google_search", "image_generation"] as const) {
    const frontendToolStart = frontendToolkit.indexOf(`${toolName}:`);
    assert.ok(frontendToolStart >= 0, `${toolName} frontend toolkit block should exist`);
    const frontendToolEnd = frontendToolkit.indexOf("\n  },", frontendToolStart);
    const frontendToolBlock = frontendToolkit.slice(
      frontendToolStart,
      frontendToolEnd + 5,
    );
    assert.match(frontendToolBlock, /\bexecute:\s*providerTool\(\{/);
    assert.doesNotMatch(frontendToolBlock, /\bexecute:\s*externalTool\(\)/);
    assert.doesNotMatch(frontendToolBlock, /\bexecute:\s*stubTool\(\)/);
    assert.doesNotMatch(
      serverToolkit,
      new RegExp(`\\b${toolName}Tool\\b|\\?\\s*\\{\\s*${toolName}:`),
    );
  }

  const createTargetStart = frontendToolkit.indexOf("createTargetElement:");
  assert.ok(createTargetStart >= 0, "createTargetElement frontend toolkit block should exist");
  const createTargetEnd = frontendToolkit.indexOf("\n  },", createTargetStart);
  const createTargetBlock = frontendToolkit.slice(createTargetStart, createTargetEnd + 5);
  assert.match(createTargetBlock, /\bexecute:\s*stubTool\(\)/);
  assert.doesNotMatch(createTargetBlock, /\bexecute:\s*externalTool\(\)/);
  assert.doesNotMatch(createTargetBlock, /\bexecute:\s*providerTool\(/);
  assert.doesNotMatch(serverToolkit, /\bcreateTargetElementTool\b|\?\s*\{\s*createTargetElement:/);

  assert.match(thread, /"standalone-tool-call":\s*\[\]/);
  assert.match(thread, /case\s+["']tool-call["']:\s*return\s+part\.toolUI\s*\?\?\s*<ToolFallbackComponent\s+\{\.\.\.part\}\s*\/>/);
  assert.match(thread, /\bMessagePrimitive\.GroupedParts\b[\s\S]*groupAssistantMessagePart\(part,\s*context\)/);
  assert.match(thread, /\bToolFallbackComponent\s*=\s*ToolFallback\b/);
  assert.doesNotMatch(frontendToolkit, /\bcreateVideo\b/);
  assert.doesNotMatch(toolUis, /\bCreateVideoToolUI\b|\bVideoToolUI\b/);
});

test("assistant createImage schema exposes official AI SDK image edit fields only", () => {
  const schemas = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-tool-schemas.ts"),
    "utf8",
  );
  const imageTools = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-chat-image-tools.ts"),
    "utf8",
  );
  const studioSkills = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-chat-studio-skills.ts"),
    "utf8",
  );

  const schemaStart = schemas.indexOf("export const assistantSidebarCreateImageParameters");
  const schemaEnd = schemas.indexOf("export const assistantSidebarListStudioSkillsParameters", schemaStart);
  const createImageSchemaBlock = schemas.slice(schemaStart, schemaEnd);

  assert.match(createImageSchemaBlock, /\bimages:\s*z\s*\.\s*array\(/);
  assert.match(createImageSchemaBlock, /\bmask:\s*z\s*\.\s*string\(\)/);
  assert.match(createImageSchemaBlock, /\bcount:\s*z\s*\.\s*number\(\)/);
  assert.doesNotMatch(createImageSchemaBlock, /\breferenceImages\b|\bmaskImage\b|Deprecated alias/);
  assert.match(imageTools, /\btype\s+AssistantChatCreateImageExecutionInput\b[\s\S]*\breferenceImages\?:/);
  assert.match(imageTools, /\btype\s+AssistantChatCreateImageExecutionInput\b[\s\S]*\bmaskImage\?:/);
  assert.doesNotMatch(studioSkills, /\bimages\/referenceImages\b/);
  assert.match(studioSkills, /official createImage images input/);
});

test("assistant sidebar keeps deferred video generation out of the new chat route", () => {
  const files = readProjectSources().filter((file) => {
    if (file.path === "api/assistant-chat.ts") return true;
    if (file.path.startsWith("services/assistant-ui/")) return true;
    if (file.path.startsWith("components/assistant-ui/")) return true;
    return /^pages\/Workspace\/components\/assistantSidebar/i.test(file.path);
  });

  const violations = findPatternViolations(files, [
    {
      name: "deferred video tool registration",
      pattern: /\bcreateVideo\b/,
    },
    {
      name: "experimental video generation in assistant sidebar route",
      pattern: /\bexperimental_generateVideo\b|\bgenerateVideo\s*\(/,
    },
  ]);

  assert.deepEqual(violations, []);
});

test("assistant sidebar dynamic canvas target tool uses official stub override path", () => {
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const frontendToolkit = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolkit.tsx"),
    "utf8",
  );

  const createTargetToolkitBlock = frontendToolkit.slice(
    frontendToolkit.indexOf("createTargetElement:"),
  );
  const overrideStart = runtime.indexOf("const AssistantSidebarToolOverrides");
  const overrideEnd = runtime.indexOf("const useAssistantChatRuntime", overrideStart);
  const overrideBlock = runtime.slice(overrideStart, overrideEnd);

  assert.match(frontendToolkit, /import\s+\{[\s\S]*\bdefineToolkit\b[\s\S]*\bexternalTool\b[\s\S]*\bproviderTool\b[\s\S]*\bstubTool\b[\s\S]*\}\s+from\s+["']@assistant-ui\/react["']/);
  assert.match(createTargetToolkitBlock, /createTargetElement:\s*\{[\s\S]*execute:\s*stubTool\(\)/);
  assert.match(runtime, /import\s+\{[\s\S]*useAuiToolOverrides[\s\S]*\}\s+from\s+["']@assistant-ui\/react["']/);
  assert.match(overrideBlock, /\buseAuiToolOverrides\s*\(\s*\{\s*createTargetElement:\s*\{/);
  assert.match(overrideBlock, /\bexecute:\s*async\s*\(\s*args:\s*AssistantSidebarCreateTargetElementArgs\s*\)\s*=>/);
  assert.match(overrideBlock, /\bcreateTargetElementRef\.current\b/);
  assert.match(overrideBlock, /\breferenceImages:\s*args\.referenceImages\s*\|\|\s*\[\]/);
  assert.doesNotMatch(overrideBlock, /\bservices\/agents\b|\bservices\/skills\b|\bagentData\b|\bskillData\b|\bChatMessage\b/);
});

test("assistant sidebar first-party rich tool UIs validate result payloads before rendering", () => {
  const toolUis = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolUis.tsx"),
    "utf8",
  );

  assert.match(toolUis, /import\s+\{\s*z\s*\}\s+from\s+["']zod["']/);
  assert.match(toolUis, /type\s+ToolCallMessagePartComponent/);
  assert.match(toolUis, /\buseToolCallElapsed\b/);
  assert.match(toolUis, /\buseToolArgsStatus\b/);
  assert.match(toolUis, /\bparseAssistantToolError\b/);
  assert.match(toolUis, /import\s+\{\s*Image\s+as\s+AssistantImage\s*\}\s+from\s+["']@\/components\/assistant-ui\/image["']/);
  assert.match(toolUis, /import\s+\{[\s\S]*\bWeatherWidget\b[\s\S]*\}\s+from\s+["']@\/components\/assistant-ui\/tool-ui\/weather-widget\/runtime["']/);
  assert.match(toolUis, /\bconst\s+searchToolResultItemSchema\s*=\s*z\b/);
  assert.match(toolUis, /\bconst\s+searchToolResultSchema\s*=\s*z\b/);
  assert.match(toolUis, /\bconst\s+weatherWidgetPayloadSchema\s*=\s*z\b/);
  assert.match(toolUis, /\bconst\s+weatherToolResultSchema\s*=\s*z\b/);
  assert.match(toolUis, /\bconst\s+generatedImagePartSchema\s*=\s*z\b/);
  assert.match(toolUis, /\burl:\s*z\.string\(\)\.min\(1\)\.optional\(\)/);
  assert.match(toolUis, /Generated image results must include image, url, or image data with mediaType/);
  assert.match(toolUis, /\bconst\s+generateImageToolResultSchema\s*=\s*z\b/);
  assert.match(toolUis, /\bconst\s+openAIImageGenerationToolResultSchema\s*=\s*z\b/);
  assert.match(toolUis, /\bconst\s+createTargetElementToolResultSchema\s*=\s*z\b/);
  assert.match(toolUis, /\bsearchToolResultSchema\.safeParse\(result\)/);
  assert.match(toolUis, /\bweatherToolResultSchema\.safeParse\(result\)/);
  assert.match(toolUis, /\bgenerateImageToolResultSchema\.safeParse\(result\)/);
  assert.match(toolUis, /\bopenAIImageGenerationToolResultSchema\.safeParse\(result\)/);
  assert.match(toolUis, /\bcreateTargetElementToolResultSchema\.safeParse\(result\)/);
  assert.match(toolUis, /\bconst\s+toolResult\s*=\s*parsedResult\.success/);

  const searchStart = toolUis.indexOf("export const WorkspaceSearchToolUI");
  const weatherStart = toolUis.indexOf("export const WeatherToolUI");
  const imageStart = toolUis.indexOf("export const GenerateImageToolUI");
  const targetStart = toolUis.indexOf("export const CreateTargetElementToolUI");
  const searchBlock = toolUis.slice(searchStart, weatherStart);
  const weatherBlock = toolUis.slice(weatherStart, imageStart);
  const imageBlock = toolUis.slice(imageStart, targetStart);
  const targetBlock = toolUis.slice(targetStart);

  assert.match(weatherBlock, /export\s+const\s+WeatherToolUI:\s*ToolCallMessagePartComponent/);
  assert.match(imageBlock, /export\s+const\s+GenerateImageToolUI:\s*ToolCallMessagePartComponent/);
  assert.match(searchBlock, /\bnormalizeSearchToolResult\(\s*parsedResult\.success\s*\?\s*parsedResult\.data\s*:\s*undefined,\s*\)/);
  assert.doesNotMatch(searchBlock, /\bnormalizedResult\.results\.map\b/);
  assert.doesNotMatch(searchBlock, /<a\s+[\s\S]*?href=\{item\.url\}/);
  assert.match(toolUis, /\bconst\s+WeatherWidgetHost:\s*React\.FC<\{\s*widget:\s*WeatherWidgetPayload\s*\}>/);
  assert.match(toolUis, /\bstableWidgetRef\.current\.id\s*!==\s*widget\.id/);
  assert.match(toolUis, /<WeatherWidget[\s\S]*\{\.\.\.stableWidgetRef\.current\}[\s\S]*effects=\{WEATHER_EFFECTS\}/);
  assert.match(weatherBlock, /\btoolResult\?\.widget\b/);
  assert.match(weatherBlock, /\bresult=\{toolResult\}/);
  assert.doesNotMatch(weatherBlock, /\bresult\?\.(?:widget|temperature|condition|windSpeed|forecast|location)\b/);
  assert.match(imageBlock, /\bgetGenerateImageResultImages\(toolResult\)/);
  assert.match(toolUis, /\bconst\s+resolvedImage\s*=/);
  assert.match(toolUis, /\bpickNonEmptyString\(image\.image,\s*image\.url\)/);
  assert.match(toolUis, /\bimage:\s*resolvedImage\b/);
  assert.match(imageBlock, /\btoGenerateImageGalleryItems\(imageParts\)/);
  assert.match(imageBlock, /<GenerateImageGallery\b/);
  assert.match(toolUis, /\bconst\s+GenerateImageGallery:\s*React\.FC/);
  assert.match(toolUis, /<AssistantImage\.Root\b/);
  assert.match(toolUis, /<AssistantImage\.Zoom\b/);
  assert.match(toolUis, /<AssistantImage\.Preview\b/);
  assert.match(toolUis, /<AssistantImage\.Actions\b/);
  assert.match(imageBlock, /<AssistantImage\.Generating\b/);
  assert.match(imageBlock, /\btoolError\?\.title\b/);
  assert.match(imageBlock, /\btoolError\?\.message\b/);
  assert.match(imageBlock, /\btoolError\?\.raw\b/);
  assert.match(imageBlock, /<details\b/);
  assert.match(imageBlock, /\bstatus\.type\s*===\s*["']requires-action["']/);
  assert.match(imageBlock, /\baui-generate-image-approval-summary\b/);
  assert.match(imageBlock, /确认生成图片/);
  assert.match(imageBlock, /\bapprovalSummaryItems\b/);
  assert.match(imageBlock, /\brequestedCount\b[\s\S]*?\blabel:\s*["']张数["']/);
  assert.match(imageBlock, /\bproviderLabel\b[\s\S]*?\blabel:\s*["']供应商["']/);
  assert.match(imageBlock, /\bmodelLabel\b[\s\S]*?\blabel:\s*["']模型["']/);
  assert.match(imageBlock, /\btruncateToolText\(prompt,\s*360\)/);
  assert.match(imageBlock, /<ToolFallback\.Approval\b[\s\S]*?respondToApproval=\{respondToApproval\}/);
  assert.doesNotMatch(imageBlock, /<AssistantImage\s+\{\.\.\.part\}/);
  assert.doesNotMatch(imageBlock, /window\.open\s*\(/);
  assert.doesNotMatch(toolUis, /typeof\s+image\.image\s*===\s*["']string["']/);
  assert.doesNotMatch(imageBlock, /\bresult\?\.(?:images|prompt|providerName|providerId|modelId|size|resolution|referenceCount|settingsLocked|count)\b/);
  assert.doesNotMatch(imageBlock, /\bresume\s*\(\s*\{?\s*approved\b|\baddResult\s*\(\s*["']Approved by user["']/);
  assert.match(targetBlock, /\btypeof\s+result\s+===\s+["']string["'][\s\S]*?\{[\s\S]*?elementId:\s*result/);
  assert.match(targetBlock, /\bparsedResult\?\.success\b[\s\S]*?\(parsedResult\.data\s+as\s+CreateTargetElementToolResult\)/);
  assert.doesNotMatch(targetBlock, /result\s+&&\s+typeof\s+result\s+===\s+["']object["'][\s\S]*?as\s+CreateTargetElementToolResult/);
});

test("assistant generic tool fallback surfaces official assistant-ui tool-call diagnostics", () => {
  const toolFallback = readFileSync(
    join(repoRoot, "components/assistant-ui/tool-fallback.tsx"),
    "utf8",
  );

  assert.match(toolFallback, /\bToolFallbackDiagnosticSection\b/);
  for (const field of [
    "toolCallId",
    "artifact",
    "modelContent",
    "mcp",
  ] as const) {
    assert.match(toolFallback, new RegExp(`\\b${field}\\b`));
  }
  for (const label of ["Call id", "Artifact", "Model content", "MCP"] as const) {
    assert.match(toolFallback, new RegExp(`label=["']${label}["']`));
  }
  assert.match(toolFallback, /data-slot=["']tool-fallback-diagnostic-section["']/);
  assert.doesNotMatch(
    toolFallback,
    /ToolFallbackNestedMessages|MessagePartPrimitive\.Messages|nested sub-agent message/,
  );
  assert.doesNotMatch(
    toolFallback,
    /\bagentData\b|\bskillData\b|\bChatMessage\b|\bsanitizeAgentProgressMessage\b/,
  );
});

test("assistant sidebar MCP integration stays on official assistant-ui and AI SDK APIs", () => {
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const backendToolkit = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-server-toolkit.ts"),
    "utf8",
  );
  const api = readFileSync(join(repoRoot, "api/assistant-chat.ts"), "utf8");
  const aiSdkWrapper = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-ai-sdk-toolkit-server.ts"),
    "utf8",
  );
  const mcpAppsHost = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-mcp-apps-host.ts"),
    "utf8",
  );
  const mcpAppsApi = readFileSync(join(repoRoot, "api/mcp-apps.ts"), "utf8");

  assert.match(backendToolkit, /import\s+\{\s*defineMcpToolkit,\s*defineToolkit\s*\}\s+from\s+["']@assistant-ui\/react["']/);
  assert.match(backendToolkit, /\.\.\.defineMcpToolkit\s*\(\s*createAssistantSidebarMcpToolkitDefinition\s*\(\s*\)\s*\)/);
  assert.match(aiSdkWrapper, /import\(["']@assistant-ui\/react-ai-sdk["']\)/);
  assert.match(aiSdkWrapper, /\bnew\s+AISDKToolkit\s*\(\s*\{\s*toolkit\s*\}\s*\)/);
  assert.match(api, /\bcreateAssistantSidebarServerToolkit\s*\(/);
  assert.match(api, /\bcreateAssistantAiSdkToolkit\s*\(\s*serverToolkit\s*\)/);
  assert.match(api, /\bawait\s+aiToolkit\.tools\s*\(\s*\{\s*frontend:\s*frontendToolSchemas\s*,?\s*\}\s*\)/);
  assert.match(api, /\bconst\s+closeAiToolkit\s*=\s*async\s*\(\)\s*=>/);
  assert.match(api, /\bawait\s+aiToolkit\?\.close\(\)/);
  assert.match(api, /finally\s*\{\s*\n\s*await\s+closeAiToolkit\(\);/);
  assert.doesNotMatch(api, /\bfrontendTools\s*\(|\bgenerativeTools\s*\(/);
  assert.match(mcpAppsHost, /from\s+["']@ai-sdk\/mcp["']/);
  assert.match(mcpAppsHost, /\bcreateMCPClient\b/);
  assert.match(mcpAppsHost, /\bclientName:\s*["']xc-studio-assistant-ui-mcp-apps["']/);
  assert.match(mcpAppsHost, /transport:\s*\{[\s\S]*type:\s*config\.type[\s\S]*url:\s*config\.url/);
  assert.doesNotMatch(mcpAppsHost, /\bexperimental_createMCPClient\b|\bexperimental_MCPClient\b/);
  assert.match(runtime, /\bMcpAppsRemoteHost\s*\(\s*\{\s*url:\s*ASSISTANT_SIDEBAR_MCP_APPS_URL\s*\}\s*\)/);
  assert.match(runtime, /\bMcpAppRenderer\s*\(\s*\{\s*host:\s*McpAppsRemoteHost\s*\(/);
  assert.match(mcpAppsApi, /\bhandleAssistantSidebarMcpAppsHostRequest\b/);
});

test("assistant sidebar MCP files do not import legacy agent or skill runtimes", () => {
  const files = [
    "api/mcp-apps.ts",
    "services/assistant-ui/assistant-sidebar-mcp-config.ts",
    "services/assistant-ui/assistant-sidebar-mcp-apps-host.ts",
    "services/assistant-ui/assistant-sidebar-server-toolkit.ts",
  ].map((path) => ({
    path,
    text: readFileSync(join(repoRoot, path), "utf8"),
  }));

  const violations = findPatternViolations(files, [
    {
      name: "legacy agent service import",
      pattern: /from\s+["'][^"']*services\/agents(?:\/|["'])/,
    },
    {
      name: "legacy skill runtime import",
      pattern: /from\s+["'][^"']*services\/skills(?:\/|["'])/,
    },
    {
      name: "legacy agent store import",
      pattern: /from\s+["'][^"']*stores\/agent\.store(?:\.ts)?["']/,
    },
    {
      name: "legacy skill execution symbols",
      pattern: /\bexecuteSkill\s*\(|\bskillData\b|\bagentData\b|\bChatMessage\b/,
    },
  ]);

  assert.deepEqual(violations, []);
});

test("assistant sidebar keeps attachments on official react-ai-sdk adapter path", () => {
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const attachmentUi = readFileSync(
    join(repoRoot, "components/assistant-ui/attachment.tsx"),
    "utf8",
  );
  const reactAiSdkRuntime = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/react-ai-sdk/src/ui/use-chat/useAISDKRuntime.ts"),
    "utf8",
  );
  const reactAiSdkAttachmentAdapter = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/react-ai-sdk/src/ui/utils/vercelAttachmentAdapter.ts"),
    "utf8",
  );
  const reactAiSdkToCreateMessage = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/react-ai-sdk/src/ui/utils/toCreateMessage.ts"),
    "utf8",
  );
  const useChatRuntimeCall = runtime.slice(runtime.indexOf("return useChatRuntime({"));
  const workspaceAdaptersStart = runtime.indexOf("const WorkspaceRuntimeAdapters");
  const workspaceAdaptersEnd = runtime.indexOf(
    "const AssistantComposerModelSelector",
    workspaceAdaptersStart,
  );
  const workspaceAdaptersBlock = runtime.slice(
    workspaceAdaptersStart,
    workspaceAdaptersEnd,
  );

  assert.match(runtime, /\bCompositeAttachmentAdapter\b/);
  assert.match(runtime, /\bSimpleImageAttachmentAdapter\b/);
  assert.match(runtime, /\bSimpleTextAttachmentAdapter\b/);
  assert.match(runtime, /\bAssistantSidebarCompressedImageAttachmentAdapter\b/);
  assert.match(runtime, /\bcreateAssistantSidebarAttachmentAdapter\b/);
  assert.match(runtime, /\bASSISTANT_SIDEBAR_ATTACHMENT_MAX_DATA_URL_CHARS\b/);
  assert.match(runtime, /\bmustUseCompressedAttachment\b/);
  assert.match(runtime, /\bcompressAssistantSidebarImageFile\b/);
  assert.match(runtime, /\battachment_image_prepared\b/);
  assert.match(runtime, /\boriginalChars\b/);
  assert.match(runtime, /\bsentChars\b/);
  assert.match(runtime, /type:\s*["']file["'][\s\S]{0,160}mimeType:\s*compressed\.mediaType/);
  assert.match(runtime, /filename:\s*attachment\.name/);
  assert.doesNotMatch(runtime, /type:\s*["']image["'][\s\S]{0,120}image:\s*compressed\.dataUrl/);
  assert.doesNotMatch(
    runtime,
    /if\s*\(\s*bestDataUrl\.length\s*>=\s*originalDataUrl\.length\s*\)\s*\{\s*return\s*\{\s*dataUrl:\s*originalDataUrl/,
  );
  assert.doesNotMatch(runtime, /\bassistantSidebarFileAttachmentAdapter\b/);
  assert.doesNotMatch(runtime, /\bassistantSidebarFileToDataUrl\b/);
  assert.doesNotMatch(useChatRuntimeCall, /adapters:\s*\{\s*attachments\s*,?\s*\}/);
  assert.match(reactAiSdkRuntime, /attachments:\s*vercelAttachmentAdapter/);
  assert.match(reactAiSdkAttachmentAdapter, /mimeType:\s*attachment\.contentType\s*\?\?\s*["']/);
  assert.match(reactAiSdkAttachmentAdapter, /filename:\s*attachment\.name/);
  assert.match(reactAiSdkToCreateMessage, /url:\s*part\.data/);
  assert.match(reactAiSdkToCreateMessage, /mediaType:\s*part\.mimeType/);
  assert.doesNotMatch(runtime, /\bunsupportedAssistantSidebarFileAttachmentAdapter\b/);
  assert.doesNotMatch(runtime, /This file was not parsed or uploaded into the model context/);
  assert.match(workspaceAdaptersBlock, /\bconst\s+attachments\s*=\s*React\.useMemo\(/);
  assert.match(workspaceAdaptersBlock, /\battachments\s*,/);
  assert.match(workspaceAdaptersBlock, /<RuntimeAdapterProvider\s+adapters=\{adapters\}>/);
  assert.match(attachmentUi, /type\s+AttachmentStatus\b/);
  assert.match(attachmentUi, /\bAttachmentPrimitive\.Root\b/);
  assert.match(attachmentUi, /\bAttachmentPrimitive\.Name\b/);
  assert.match(attachmentUi, /\bAttachmentPrimitive\.Remove\b/);
  assert.match(attachmentUi, /\bpart\.data\s*\|\|\s*part\.url\s*\|\|\s*part\.image\b/);
  assert.match(attachmentUi, /\bMessagePrimitive\.Attachments\b/);
  assert.match(attachmentUi, /\bComposerPrimitive\.Attachments\b/);
  assert.match(attachmentUi, /\bComposerPrimitive\.AddAttachment\b/);
  assert.match(attachmentUi, /\{\s*renderUserMessageAttachment\s*\}/);
  assert.match(attachmentUi, /\{\s*renderComposerAttachment\s*\}/);
  assert.match(attachmentUi, /\bconst\s+status\s*=\s*attachment\.status/);
  assert.match(attachmentUi, /\bconst\s+statusInfo\s*=\s*getAttachmentStatusInfo\(status\)/);
  assert.doesNotMatch(attachmentUi, /\buseAuiState\b/);
  assert.doesNotMatch(attachmentUi, /\buseShallow\b/);
  assert.doesNotMatch(attachmentUi, /useAuiState\(\s*(?:useShallow\()?[\s\S]*?return\s+\{/);
  assert.match(attachmentUi, /\bcase\s+["']running["']/);
  assert.match(attachmentUi, /\bcase\s+["']requires-action["']/);
  assert.match(attachmentUi, /\bcase\s+["']incomplete["']/);
  assert.doesNotMatch(attachmentUi, /\bAgentMessage\b|\bagentData\b|\bskillData\b|\bChatMessage\b/);
});

test("assistant message file parts render through official assistant-ui part slots", () => {
  const thread = readFileSync(
    join(repoRoot, "components/assistant-ui/thread.tsx"),
    "utf8",
  );
  const fileUi = readFileSync(
    join(repoRoot, "components/assistant-ui/file.tsx"),
    "utf8",
  );
  const reactAiSdkConverter = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/react-ai-sdk/src/ui/utils/convertMessage.ts"),
    "utf8",
  );
  const aiSdkChatbotDocs = readFileSync(
    join(repoRoot, "node_modules/ai/docs/04-ai-sdk-ui/02-chatbot.mdx"),
    "utf8",
  );

  assert.match(aiSdkChatbotDocs, /When images are generated, they are exposed as files to the client/);
  assert.match(reactAiSdkConverter, /part\.type\s*===\s*["']file["']/);
  assert.match(reactAiSdkConverter, /type:\s*["']file["']/);
  assert.match(reactAiSdkConverter, /data:\s*part\.url/);
  assert.match(reactAiSdkConverter, /mimeType:\s*part\.mediaType/);
  assert.match(thread, /import\s+\{\s*File\s+as\s+AssistantFile\s*\}/);
  assert.match(thread, /case\s+["']file["']:\s*return\s+<AssistantFile\s+\{\.\.\.part\}\s*\/>/);
  assert.match(fileUi, /\bFileMessagePartComponent\b/);
  assert.match(fileUi, /\bpart\.mimeType\b/);
  assert.match(fileUi, /\bmediaType\?:\s*string\b/);
  assert.match(fileUi, /\bpart\.data\s*\|\|\s*record\.url\s*\|\|\s*record\.image\b/);
  assert.match(fileUi, /<AssistantImage\b/);
  assert.match(fileUi, /\bdownload=\{filename\}/);
  assert.doesNotMatch(fileUi, /\bAgentMessage\b|\bagentData\b|\bskillData\b|\bChatMessage\b/);
});

test("assistant UIMessage normalization keeps file parts compatible with official FileUIPart", () => {
  const normalization = readFileSync(
    join(repoRoot, "services/assistant-ui/ui-message-normalization.ts"),
    "utf8",
  );
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );
  const normalizationTest = readFileSync(
    join(repoRoot, "services/assistant-ui/ui-message-normalization.test.ts"),
    "utf8",
  );
  const aiSdkUiMessages = readFileSync(
    join(repoRoot, "node_modules/ai/src/ui/ui-messages.ts"),
    "utf8",
  );
  const reactAiSdkConverter = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/react-ai-sdk/src/ui/utils/convertMessage.ts"),
    "utf8",
  );

  assert.match(aiSdkUiMessages, /export\s+type\s+FileUIPart\s*=\s*\{[\s\S]*?mediaType:\s*string/);
  assert.match(reactAiSdkConverter, /part\.mediaType\.startsWith\(["']image\/["']\)/);
  assert.match(normalization, /\binferFilePartMediaType\b/);
  assert.match(normalization, /\binferDataUrlMediaType\(url\)/);
  assert.match(normalization, /\binferFilenameMediaType\(part\.filename\)/);
  assert.match(normalization, /["']application\/octet-stream["']/);
  assert.match(normalization, /\bexplicitType\s*&&\s*explicitType\s*!==\s*genericType\b/);
  assert.match(normalization, /\bif\s*\(\s*filenameType\s*\)\s*return\s+filenameType\b/);
  assert.doesNotMatch(normalization, /if\s*\(!url\s*\|\|\s*!mediaType\)\s*return\s+null/);
  assert.match(api, /\binferAssistantChatFilenameMediaType\(part\.filename\)/);
  assert.match(api, /\bconst\s+genericType\s*=\s*["']application\/octet-stream["']/);
  assert.match(api, /\bif\s*\(\s*filenameType\s*\)\s*return\s+filenameType\b/);
  assert.match(runtime, /\binferAssistantSidebarFilenameMediaType\(part\.filename\)/);
  assert.match(normalizationTest, /empty MIME/);
  assert.match(normalizationTest, /application\/octet-stream/);
  assert.match(normalizationTest, /prefers filename media type over generic octet-stream upload hints/);
});

test("assistant sidebar logs official file part payload sizes without custom attachment uploads", () => {
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );
  const combined = `${runtime}\n${api}`;

  assert.match(combined, /\bfilePayloadCharCount\b/);
  assert.match(combined, /\bimagePayloadCharCount\b/);
  assert.match(combined, /\blargestFilePayloadChars\b/);
  assert.match(combined, /\blargestImagePayloadChars\b/);
  assert.match(runtime, /\bgetAssistantSidebarPartPayloadText\b/);
  assert.match(api, /\bgetAssistantChatPartPayloadText\b/);
  assert.match(runtime, /\buploadAssistantSidebarImageFile\b/);
  assert.match(runtime, /\bcompressed attachment image host upload failed\b/);
  assert.match(runtime, /\bprepareAssistantSidebarMessageImagesForRequest\b/);
  assert.match(runtime, /\bprepareAssistantChatFetchInit\b/);
  assert.match(runtime, /\brequest_images_prepared\b/);
  assert.match(runtime, /const\s+preparedInit\s*=\s*await\s+prepareAssistantChatFetchInit\(init\)/);
  assert.match(runtime, /\bbaseFetch\(input,\s*preparedInit\)/);
  assert.doesNotMatch(runtime, /\bassistantSidebarFileAttachmentAdapter\b/);
  assert.doesNotMatch(api, /readAsDataURL\(/);
});

test("assistant generative-ui parts render only through the official allowlist primitive", () => {
  const thread = readFileSync(
    join(repoRoot, "components/assistant-ui/thread.tsx"),
    "utf8",
  );
  const primitive = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/core/src/react/primitives/generativeUI/GenerativeUI.tsx"),
    "utf8",
  );
  const messageTypes = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/core/src/types/message.ts"),
    "utf8",
  );
  const primitiveTests = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/react/src/tests/generative-ui.primitive.test.tsx"),
    "utf8",
  );

  assert.match(messageTypes, /readonly\s+type:\s*["']generative-ui["']/);
  assert.match(messageTypes, /Render with `<MessagePrimitive\.GenerativeUI components=\{\.\.\.\} \/>`/);
  assert.match(primitive, /\bMessagePrimitiveGenerativeUI\b/);
  assert.match(primitive, /\bcomponents:\s*GenerativeUIComponentRegistry\b/);
  assert.match(primitive, /GenerativeUIRenderError/);
  assert.match(primitiveTests, /components=\{\{\s*Card,\s*Button\s*\}\}/);
  assert.match(primitiveTests, /`components\.generativeUI\.components` allowlist/);
  assert.match(thread, /\bgenerativeUI\?:/);
  assert.match(thread, /\bGenerativeUIComponentRegistry\b/);
  assert.match(thread, /\bGenerativeUIRenderProps\b/);
  assert.match(thread, /case\s+["']generative-ui["']:/);
  assert.match(thread, /<MessagePrimitive\.GenerativeUI\s+components=\{generativeUI\.components\}/);
  assert.match(thread, /Fallback=\{generativeUI\.Fallback\}/);
  assert.match(thread, /return\s+generativeUI\s*\?/);
  assert.doesNotMatch(thread, /\bgenerativeUI\s*\?\?\s*\{/);
  assert.doesNotMatch(thread, /case\s+["']generative-ui["']:[\s\S]{0,300}<GenerativeUIRender/);
});

test("assistant sidebar wires action adapters through official runtime adapter slots", () => {
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const thread = readFileSync(
    join(repoRoot, "components/assistant-ui/thread.tsx"),
    "utf8",
  );
  const workspaceAdaptersStart = runtime.indexOf("const WorkspaceRuntimeAdapters");
  const workspaceAdaptersEnd = runtime.indexOf(
    "const createWorkspaceRemoteThreadListAdapter",
    workspaceAdaptersStart,
  );
  const workspaceAdaptersBlock = runtime.slice(
    workspaceAdaptersStart,
    workspaceAdaptersEnd,
  );

  assert.match(runtime, /\bWebSpeechSynthesisAdapter\b/);
  assert.match(runtime, /\bWebSpeechDictationAdapter\b/);
  assert.match(workspaceAdaptersBlock, /\bconst\s+feedback\s*=\s*React\.useMemo<FeedbackAdapter>/);
  assert.match(workspaceAdaptersBlock, /\bsubmit:\s*\(\{\s*message\s*,\s*type\s*\}\)\s*=>/);
  assert.match(workspaceAdaptersBlock, /\bapplyAssistantThreadSubmittedFeedback\s*\(/);
  assert.match(workspaceAdaptersBlock, /<RuntimeAdapterProvider\s+adapters=\{adapters\}>/);
  assert.match(workspaceAdaptersBlock, /\bhistory\s*,\s*feedback\s*,/);
  assert.match(workspaceAdaptersBlock, /\.\.\.\(speech\s*\?\s*\{\s*speech\s*\}\s*:\s*\{\}\)/);
  assert.match(workspaceAdaptersBlock, /\.\.\.\(dictation\s*\?\s*\{\s*dictation\s*\}\s*:\s*\{\}\)/);
  assert.match(thread, /<ActionBarPrimitive\.FeedbackPositive\s+asChild>/);
  assert.match(thread, /<ActionBarPrimitive\.FeedbackNegative\s+asChild>/);
  assert.match(thread, /<ActionBarPrimitive\.Speak\s+asChild>/);
  assert.match(thread, /<ActionBarPrimitive\.StopSpeaking\s+asChild>/);
});

test("assistant thread actions stay on official assistant-ui primitives", () => {
  const thread = readFileSync(
    join(repoRoot, "components/assistant-ui/thread.tsx"),
    "utf8",
  );

  for (const primitive of [
    "ActionBarPrimitive.Copy",
    "ActionBarPrimitive.Reload",
    "ActionBarPrimitive.Edit",
    "ActionBarPrimitive.FeedbackPositive",
    "ActionBarPrimitive.FeedbackNegative",
    "ActionBarPrimitive.Speak",
    "ActionBarPrimitive.StopSpeaking",
    "ActionBarPrimitive.ExportMarkdown",
    "BranchPickerPrimitive.Root",
    "BranchPickerPrimitive.Previous",
    "BranchPickerPrimitive.Next",
    "ComposerPrimitive.Dictate",
    "ComposerPrimitive.StopDictation",
  ]) {
    assert.match(thread, new RegExp(primitive.replace(".", "\\.")));
  }

  assert.match(thread, /<ActionBarPrimitive\.Root[\s\S]*hideWhenRunning[\s\S]*autohide="not-last"/);
  assert.match(thread, /<BranchPickerPrimitive\.Number\s*\/>\s*\/\s*<BranchPickerPrimitive\.Count\s*\/>/);
  assert.doesNotMatch(thread, /\bagentData\b|\bskillData\b|\bChatMessage\b/);
  assert.doesNotMatch(thread, /\bonRetryAssistantResponse\b|\bonResendMessage\b|\bonReuseToComposer\b/);
});

test("assistant thread history uses official thread-list primitives with readable copy", () => {
  const threadList = readFileSync(
    join(repoRoot, "components/assistant-ui/thread-list.tsx"),
    "utf8",
  );
  const threadListSidebar = readFileSync(
    join(repoRoot, "components/assistant-ui/threadlist-sidebar.tsx"),
    "utf8",
  );
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );

  for (const primitive of [
    "ThreadListPrimitive.Root",
    "ThreadListPrimitive.New",
    "ThreadListPrimitive.ItemByIndex",
    "ThreadListPrimitive.LoadMore",
    "ThreadListItemPrimitive.Root",
    "ThreadListItemPrimitive.Trigger",
    "ThreadListItemPrimitive.Title",
    "ThreadListItemPrimitive.Archive",
    "ThreadListItemPrimitive.Unarchive",
    "ThreadListItemPrimitive.Delete",
    "ThreadListItemMorePrimitive.Root",
    "ThreadListItemMorePrimitive.Trigger",
    "ThreadListItemMorePrimitive.Content",
    "ThreadListItemMorePrimitive.Item",
  ]) {
    assert.match(threadList, new RegExp(primitive.replace(".", "\\.")));
  }

  for (const label of [
    "搜索历史话题",
    "新建对话",
    "已归档",
    "置顶",
    "重命名",
    "删除",
    "对话",
    "历史话题",
  ]) {
    assert.match(`${threadList}\n${threadListSidebar}`, new RegExp(label));
  }

  assert.match(threadListSidebar, /\bSidebarTrigger\b/);
  assert.doesNotMatch(threadListSidebar, /\bSidebarRail\b/);
  assert.match(runtime, /\buseRemoteThreadListRuntime\s*\(/);
  assert.match(runtime, /\bThreadListSidebar\b/);
  assert.doesNotMatch(`${threadList}\n${threadListSidebar}`, /AssistantSidebarHistoryPanel|ChatMessage|agentData|skillData/);
});

test("assistant sidebar history adapter updates from latest React state", () => {
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const historyStart = runtime.indexOf("const createWorkspaceHistoryAdapter");
  const historyEnd = runtime.indexOf("type WorkspaceRuntimeAdapterProps", historyStart);
  const historyBlock = runtime.slice(historyStart, historyEnd);
  const appendBlock = historyBlock.slice(
    historyBlock.indexOf("async append(item: MessageFormatItem<TMessage>)"),
    historyBlock.indexOf("async update(item: MessageFormatItem<TMessage>", historyBlock.indexOf("async append(item: MessageFormatItem<TMessage>)")),
  );
  const updateBlock = historyBlock.slice(
    historyBlock.indexOf("async update(item: MessageFormatItem<TMessage>"),
    historyBlock.indexOf("async delete(items: MessageFormatItem<TMessage>[])", historyBlock.indexOf("async update(item: MessageFormatItem<TMessage>")),
  );
  const deleteBlock = historyBlock.slice(
    historyBlock.indexOf("async delete(items: MessageFormatItem<TMessage>[])"),
    historyBlock.indexOf("};", historyBlock.indexOf("async delete(items: MessageFormatItem<TMessage>[])")),
  );

  assert.match(historyBlock, /\bwithFormat<[\s\S]*GenericThreadHistoryAdapter<TMessage>/);
  assert.match(appendBlock, /\brefs\.setConversations\(\(previous\)\s*=>/);
  assert.match(appendBlock, /\bloadRepositoryFromConversations\(/);
  assert.match(updateBlock, /\brefs\.setConversations\(\(previous\)\s*=>/);
  assert.match(updateBlock, /\bloadRepositoryFromConversations\(/);
  assert.match(deleteBlock, /\brefs\.setConversations\(\(previous\)\s*=>/);
  assert.match(deleteBlock, /\bloadRepositoryFromConversations\(/);
  assert.match(deleteBlock, /\bdeleteRepositoryMessages\(/);
  assert.doesNotMatch(deleteBlock, /\bheadId:\s*messages\.at\(-1\)\?\.id\s*\?\?\s*null/);
  assert.doesNotMatch(updateBlock, /\bconst\s+current\s*=\s*loadRepository\(/);
  assert.doesNotMatch(deleteBlock, /\bconst\s+current\s*=\s*loadRepository\(/);
});

test("assistant thread list waits for project conversation hydration instead of active thread id", () => {
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const hydratedRefStart = runtime.indexOf("const isThreadListHydratedRef");
  const hydratedRefEnd = runtime.indexOf(
    "const threadListHydrationWaitersRef",
    hydratedRefStart,
  );
  const hydratedRefBlock = runtime.slice(hydratedRefStart, hydratedRefEnd);
  const hydrationEffectStart = runtime.indexOf(
    "React.useEffect(() => {\n    const hydrated =",
    hydratedRefEnd,
  );
  const hydrationEffectEnd = runtime.indexOf(
    "const waitForThreadListHydration",
    hydrationEffectStart,
  );
  const hydrationEffectBlock = runtime.slice(
    hydrationEffectStart,
    hydrationEffectEnd,
  );

  assert.match(runtime, /\bisHydrated:\s*isSessionHydrated/);
  assert.match(hydratedRefBlock, /\bisSessionHydrated\b/);
  assert.match(hydrationEffectBlock, /\bisSessionHydrated\b/);
  assert.doesNotMatch(
    `${hydratedRefBlock}\n${hydrationEffectBlock}`,
    /Boolean\(String\(activeConversationId/,
  );
});

test("workspace project loader remembers loaded conversations before assistant sidebar hydration", () => {
  const loader = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceProjectLoader.ts"),
    "utf8",
  );
  const workspace = readFileSync(join(repoRoot, "pages/Workspace.tsx"), "utf8");
  const sidebarProps = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceSidebarProps.ts"),
    "utf8",
  );

  assert.match(loader, /\brememberLoadedProjectConversationsForPersistence\(loadedProject\)/);
  assert.match(loader, /\bmergeLoadedProjectConversationsForHydration\(loadedProject\)/);
  assert.match(loader, /\bsetProjectHydrated\?\.\(false\)/);
  assert.match(loader, /\bsetProjectHydrated\?\.\(true\)/);
  assert.match(workspace, /\bconst\s+\[isProjectHydrated,\s*setIsProjectHydrated\]/);
  assert.match(workspace, /\bsetProjectHydrated:\s*setIsProjectHydrated\b/);
  assert.match(sidebarProps, /\bisHydrated:\s*isProjectHydrated\b/);
});

test("assistant sidebar entrypoints do not import legacy agent, skill, or workflow chains", () => {
  const files = readProjectSources().filter((file) => {
    if (file.path === "api/assistant-chat.ts") return true;
    if (file.path === "api/mcp-apps.ts") return true;
    if (file.path.startsWith("services/assistant-ui/")) return true;
    if (file.path.startsWith("components/assistant-ui/")) return true;
    return /^pages\/Workspace\/components\/assistantSidebar/i.test(file.path);
  });

  const violations = findPatternViolations(files, [
    {
      name: "legacy agent service import",
      pattern: /from\s+["'][^"']*services\/agents(?:\/|["'])/,
    },
    {
      name: "legacy skill runtime import",
      pattern: /from\s+["'][^"']*services\/skills(?:\/|["'])/,
    },
    {
      name: "legacy workflow recipe chain import",
      pattern:
        /from\s+["'][^"']*(?:services|pages\/Workspace\/components)\/workflow-recipes(?:\/|["'])|\bworkflow-recipes\b/,
    },
    {
      name: "legacy agent store import",
      pattern: /from\s+["'][^"']*stores\/agent\.store(?:\.ts)?["']/,
    },
    {
      name: "legacy AgentMessage component import",
      pattern: /from\s+["'][^"']*AgentMessage(?:\.tsx?)?["']/,
    },
    {
      name: "legacy ExternalStoreRuntime sidebar path",
      pattern:
        /\bExternalStoreRuntime\b|\buseExternalStoreRuntime\b|\bassistantSidebarExternalStore\b/,
    },
    {
      name: "legacy progress sanitizer import",
      pattern:
        /\bprogress-sanitizer\b|\bsanitizeAgentProgressMessage\b/,
    },
    {
      name: "legacy workspace agent send/orchestrator hook",
      pattern: /\buseAgentOrchestrator\b|\buseWorkspaceSend\b/,
    },
    {
      name: "legacy ChatMessage data shape",
      pattern: /\bChatMessage\b|\bagentData\b|\bskillData\b/,
    },
    {
      name: "legacy executeSkill runtime",
      pattern: /\bexecuteSkill\s*\(/,
    },
    {
      name: "deprecated direct AI SDK tool conversion helper",
      pattern: /\bfrontendTools\s*\(|\bgenerativeTools\s*\(/,
    },
  ]);

  assert.deepEqual(violations, []);
});

test("workspace does not keep obsolete Zustand chat examples that conflict with assistant-ui runtime", () => {
  const sources = readProjectSources();
  const documents = readProjectDocuments();
  const paths = [...sources, ...documents].map((file) => file.path);

  assert.equal(paths.includes("pages/Workspace/components/ExampleStoreUsage.tsx"), false);
  assert.equal(paths.includes("pages/Workspace/WorkspaceRefactored.example.tsx"), false);
  assert.equal(paths.includes("pages/Workspace/components/index.ts"), false);
  assert.equal(paths.includes("stores/README.md"), false);
  for (const obsoleteInputAreaPath of [
    "pages/Workspace/components/InputArea.tsx",
    "pages/Workspace/components/InputAreaBottomToolbar.tsx",
    "pages/Workspace/components/InputAreaEditor.tsx",
    "pages/Workspace/components/InputAreaFileBlock.tsx",
    "pages/Workspace/components/InputAreaMarkerEditPopover.tsx",
    "pages/Workspace/components/InputAreaMediaUploadPanel.tsx",
    "pages/Workspace/components/InputAreaPendingAttachments.tsx",
    "pages/Workspace/controllers/useInputAreaFileHandling.ts",
    "pages/Workspace/controllers/activeSkillViewData.ts",
    "pages/Workspace/controllers/useWorkspaceSend.ts",
    "pages/Workspace/controllers/useWorkspaceSmartGenerate.ts",
    "hooks/useAgentOrchestrator.ts",
    "hooks/useProjectContext.ts",
    "components/agents/AgentSelector.tsx",
    "components/agents/AgentAvatar.tsx",
    "components/agents/ProposalSelector.tsx",
    "components/agents/TaskProgress.tsx",
    "pages/Workspace/components/AgentBrowserSessionCard.tsx",
  ]) {
    assert.equal(paths.includes(obsoleteInputAreaPath), false);
  }
  assert.equal(
    paths.includes("docs/product/WORKSPACE_SIDEBAR_MAIN_BRAIN_REFACTOR_PLAN_20260512.md"),
    false,
  );
  for (const obsoleteProductPlan of [
    "docs/product/MAIN_BRAIN_CONFIG_CENTER_IA_UI_SPEC_20260509.md",
    "docs/product/MULTI_AGENT_INTEGRATION_PRD.md",
    "docs/product/ECOMMERCE_ONECLICK_WORKFLOW_PLAN.md",
    "docs/product/WORKSPACE_PROJECT_REHOST_AND_ACCOUNT_SYNC_PRODUCT_PLAN_20260515.md",
    "docs/product/ECOMMERCE_EDITABLE_TEXT_PROGRESS_20260401.md",
    "docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md",
    "docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_REVIEW_PM_UI_20260514.md",
    "docs/product/ATOMIC_CAPABILITY_NODE_UI_IA_SPEC_20260512.md",
    "docs/product/WORKFLOW_RECIPE_NODE_PLATFORM_IMPLEMENTATION_PLAN_20260511.md",
    "docs/product/WORKFLOW_RECIPE_NODE_PLATFORM_MASTER_PLAN_20260511.md",
    "docs/product/WORKFLOW_RECIPE_PHASE3_UI_SKELETON_IA_20260511.md",
  ]) {
    assert.equal(paths.includes(obsoleteProductPlan), false);
  }
  assert.equal(existsSync(join(repoRoot, "services/workflow-recipes")), false);
  assert.equal(existsSync(join(repoRoot, "services/capability-catalog")), false);
  for (const obsoleteRecipeType of [
    "types/workflow-recipe.types.ts",
    "types/workflow-node.types.ts",
    "types/capability-catalog.types.ts",
  ]) {
    assert.equal(existsSync(join(repoRoot, obsoleteRecipeType)), false);
  }
  assert.equal(
    paths.includes("docs/changelog/PROJECT_RUNTIME_LOG_2026-06-16.md"),
    false,
  );
  assert.equal(paths.includes("docs/changelog/PROJECT_CHANGELOG.md"), false);
  assert.equal(
    paths.includes(
      "docs/product/WORKSPACE_IMAGE_GENERATION_REFACTOR_IMPLEMENTATION_PLAN_20260610.md",
    ),
    false,
  );

  const violations = findPatternViolations([...sources, ...documents], [
    {
      name: "obsolete agent store chat tutorial",
      pattern:
        /\bExampleStoreUsage\b|\bWorkspaceRefactored\b|setMessages\(messages\)|useAgentStore\(state\s*=>\s*state\.messages\)/,
    },
    {
      name: "obsolete deleted sidebar implementation docs",
      pattern:
        /pages\/Workspace\/components\/AssistantSidebar\.tsx|AssistantSidebarHistoryPanel|AssistantSidebarConversationActions|AssistantSidebarPlanCard|AssistantSidebarFilesPopover|useAssistantSidebarBrowserAgentUi/,
    },
    {
      name: "obsolete workflow recipe platform docs",
      pattern:
        /WORKFLOW_RECIPE_NODE_PLATFORM|WORKFLOW_RECIPE_PHASE3|ATOMIC_CAPABILITY_NODE_UI|services\/workflow-recipes|services\/capability-catalog|pages\/Workspace\/components\/workflow-recipes|workflow-recipe\.types|workflow-node\.types|capability-catalog\.types/,
    },
    {
      name: "obsolete pre-assistant-ui image generation refactor docs",
      pattern:
        /WORKSPACE_IMAGE_GENERATION_REFACTOR_IMPLEMENTATION_PLAN|pages\/Workspace\/controllers\/useWorkspaceSmartGenerate\.ts/,
      allow: (path) =>
        path === "docs/architecture/PROJECT_MODULE_MAP.md" ||
        path === "docs/architecture/WORKSPACE_REFACTOR_MAP.md",
    },
  ]);

  const sourceText = sources.map((file) => file.text).join("\n");
  assert.doesNotMatch(sourceText, /\bfrom\s+["'][^"']*activeSkillViewData(?:\.ts)?["']/);
  assert.doesNotMatch(sourceText, /\bfrom\s+["'][^"']*useInputAreaFileHandling(?:\.ts)?["']/);
  assert.doesNotMatch(sourceText, /\bworkflowRecipeId\b|\bworkflowRecipeVersion\b|\bworkflowNodeRole\b/);
  assert.deepEqual(violations, []);
});

test("assistant sidebar keeps AI SDK runtime errors diagnosable without Object-only logs", () => {
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );

  assert.match(runtime, /\bconst\s+summarizeClientErrorForLog\s*=/);
  assert.match(runtime, /\bconst\s+formatAssistantSidebarErrorForConsole\s*=/);
  assert.match(runtime, /\bmessage:\s*getClientErrorMessage\(error\)/);
  assert.match(runtime, /\bstatusCode\b/);
  assert.match(runtime, /\brequestId\b/);
  assert.match(runtime, /\bAssistantSidebarStreamErrorDiagnostic\b/);
  assert.match(runtime, /\blastStreamErrorDiagnosticRef\b/);
  assert.match(runtime, /\bonStreamError\b/);
  assert.match(runtime, /\blastStreamError=/);
  assert.match(runtime, /\[assistant-sidebar\]\s+assistant-chat\s+\$\{chunk\.type\}:\s+\$\{formatAssistantSidebarErrorForConsole\(errorText\)\}/);
  assert.match(runtime, /\[assistant-sidebar\]\s+chat runtime error:\s+\$\{formatAssistantSidebarErrorForConsole\(error\)\}/);
  assert.match(runtime, /\berror:\s*summarizeClientErrorForLog\(error\)/);
  assert.doesNotMatch(runtime, /console\.error\("\[assistant-sidebar\] chat runtime error",\s*\{\s*error:\s*getClientErrorMessage\(error\)/);
});

test("assistant chat stream errors include provider model and tool context", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );

  assert.match(api, /\bconst\s+summarizeAssistantChatErrorForLog\s*=/);
  assert.match(api, /\bconst\s+formatAssistantChatStreamErrorText\s*=/);
  assert.match(api, /\bconst\s+enrichAssistantChatUiErrorChunk\s*=/);
  assert.match(api, /\bisAssistantChatUiErrorChunk\(chunk\)/);
  assert.match(api, /\bresponseBodyPreview\b/);
  assert.match(api, /\bproviderBaseUrl:\s*summarizeProviderBaseUrl\(provider\.baseUrl\)/);
  assert.match(api, /\brequestedToolChoice\b/);
  assert.match(api, /\btoolChoice\b/);
  assert.match(api, /\bactiveTools\b/);
  assert.match(api, /\bstream_text_error\b[\s\S]*\berror:\s*summarizeAssistantChatErrorForLog\(error\)/);
  assert.match(api, /\bformatAssistantChatStreamErrorText\(\s*error,\s*streamErrorContext\(\),\s*\)/);
  assert.match(
    api,
    /chunk\.type\s*===\s*["']tool-output-error["']\s*\|\|\s*isAssistantChatDebugEnabled\(\)/,
  );
});

test("assistant image tools fail visibly without blind AI SDK retries", () => {
  const imageTools = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-chat-image-tools.ts"),
    "utf8",
  );
  const toolUis = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolUis.tsx"),
    "utf8",
  );

  assert.match(imageTools, /\bmaxRetries:\s*0\b/);
  assert.match(imageTools, /\babortSignal:\s*options\.abortSignal\b/);
  assert.match(toolUis, /\bpromptReady\b/);
  assert.match(toolUis, /\bparseAssistantToolError\(status\.error\)/);
  assert.match(toolUis, /查看完整上游返回/);
});

test("assistant chat does not force specific tool_choice objects through custom OpenAI-compatible providers", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );

  assert.match(api, /\bconst\s+resolved\s*=\s*resolveAssistantChatToolChoice\(/);
  assert.match(api, /typeof\s+resolved\s+===\s+["']object["']/);
  assert.match(api, /!isGoogleProvider\(options\.provider\)/);
  assert.match(api, /!isOfficialOpenAIProvider\(options\.provider\)/);
  assert.match(api, /return\s+["']auto["']\s+as\s+const/);
});

test("assistant chat separates official model config from project provider connection config", () => {
  const provider = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-chat-provider.ts"),
    "utf8",
  );
  const runtime = readFileSync(
    join(
      repoRoot,
      "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx",
    ),
    "utf8",
  );
  const apiTest = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-chat.test.ts"),
    "utf8",
  );
  const providerIdStart = provider.indexOf("const providerId =");
  const providerIdEnd = provider.indexOf("const googleLike", providerIdStart);
  const providerIdBlock = provider.slice(providerIdStart, providerIdEnd);

  assert.match(provider, /\bparseRegistryModelName\(/);
  assert.match(provider, /\bString\(body\.config\?\.modelName\s*\|\|\s*["']["']\)/);
  assert.match(providerIdBlock, /\bmodelNameSelection\.providerId\b/);
  assert.match(provider, /\bbody\.providerConfig\?\.provider\b/);
  assert.match(provider, /\bprovider\.baseUrl\b/);
  assert.match(provider, /\bprovider\.apiKey\b/);
  assert.doesNotMatch(provider, /\bbody\.config\?\.(?:baseUrl|apiKey)\b/);
  assert.doesNotMatch(provider, /\bbody\.config\?\.(?:provider|providerId|providerName|modelId|model)\b/);
  assert.match(runtime, /\bproviderConfig:\s*\{\s*provider,?\s*\}/);
  assert.doesNotMatch(runtime, /\bbuildModelContextRegistry\b|\bModelContextRegistry\b/);
  assert.match(apiTest, /project provider config carries the selected provider connection settings/);
});

test("assistant chat gates OpenAI native image_generation to safe provider-tool usage", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );
  const provider = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-chat-provider.ts"),
    "utf8",
  );

  assert.match(provider, /\bopenai\.tools\.imageGeneration\(/);
  assert.doesNotMatch(provider, /\bstore\s*:\s*false\b/);
  assert.match(api, /\bresolveAssistantChatNativeOpenAIImageGeneration\b/);
  assert.match(api, /\bexplicitImageToolRequested\b/);
  assert.match(api, /\bprovider_not_official_openai\b/);
  assert.match(api, /\bimage_provider_mismatch\b/);
  assert.match(api, /\bunsupported_settings\b/);
  assert.match(api, /\bhas_reference_images\b/);
  assert.match(api, /\bresolveAssistantChatRequestedActiveTools\b/);
  assert.match(api, /String\(toolName\s*\|\|\s*["']["']\)\.trim\(\)\s*===\s*["']createImage["']/);
  assert.match(api, /\?\s*["']image_generation["']/);
  assert.match(api, /\bnativeOpenAIImageGenerationReason\b/);
  assert.match(api, /\bObject\.prototype\.hasOwnProperty\.call\(aiSdkTools,\s*["']image_generation["']\)/);
});

test("assistant chat uses AI SDK smoothStream with CJK-aware chunking", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );

  assert.match(api, /import\s+\{[\s\S]*\bsmoothStream\b[\s\S]*\}\s+from\s+["']ai["']/);
  assert.match(api, /\bconst\s+createAssistantChatSmoothStreamTransform\s*=/);
  assert.match(api, /new\s+Intl\.Segmenter\(\s*["']zh["']/);
  assert.match(api, /chunking:\s*segmenter\s*\|\|\s*["']line["']/);
  assert.match(api, /experimental_transform:\s*createAssistantChatSmoothStreamTransform\(\)/);
  assert.doesNotMatch(api, /experimental_transform:\s*smoothStream\(\s*\)/);
});

test("assistant chat observes model and tool lifecycle through AI SDK callbacks", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );

  assert.match(api, /\bexperimental_onStart:\s*\(event\)\s*=>/);
  assert.match(api, /\bexperimental_onStepStart:\s*\(event\)\s*=>/);
  assert.match(api, /\bexperimental_onToolCallStart:\s*\(event\)\s*=>/);
  assert.match(api, /\bexperimental_onToolCallFinish:\s*\(event\)\s*=>/);
  assert.match(api, /\bai_sdk_start\b/);
  assert.match(api, /\bai_sdk_step_start\b/);
  assert.match(api, /\bai_sdk_tool_call_start\b/);
  assert.match(api, /\bai_sdk_tool_call_finish\b/);
  assert.match(api, /\bconst\s+summarizeToolInputForLog\s*=/);
  assert.doesNotMatch(api, /\bservices\/agents\b/);
  assert.doesNotMatch(api, /\bservices\/skills\b/);
});

test("assistant sidebar streams transient status with official AI SDK data parts", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );

  assert.match(api, /\bcreateAssistantChatStatusChunk\b/);
  assert.match(api, /\bgetReadableAssistantChatStatusMessage\b/);
  assert.match(api, /\btype\s+AssistantChatDataParts\s*=\s*\{/);
  assert.match(api, /["']assistant-status["']:\s*AssistantChatStatusData/);
  assert.match(api, /\bASSISTANT_CHAT_METADATA_SCHEMA\b/);
  assert.match(api, /\bsubmittedFeedback:\s*z\b/);
  assert.match(api, /\bcustom:\s*z\b/);
  assert.match(api, /\bquote:\s*z\b/);
  assert.match(api, /\btype\s+AssistantChatMessageMetadata\s*=\s*z\.infer</);
  assert.match(api, /\btype\s+AssistantChatUiMessage\s*=\s*UIMessage<\s*AssistantChatMessageMetadata,\s*AssistantChatDataParts\s*>/);
  assert.match(api, /import\s+\{\s*z\s*\}\s+from\s+["']zod["']/);
  assert.match(api, /\bASSISTANT_CHAT_DATA_SCHEMAS\b/);
  assert.match(api, /["']assistant-status["']:\s*z\.object\(/);
  assert.match(api, /\btype\s+InferUIMessageChunk\b/);
  assert.match(api, /satisfies\s+InferUIMessageChunk<AssistantChatUiMessage>/);
  assert.match(api, /\bsafeValidateUIMessages<AssistantChatUiMessage>\s*\(/);
  assert.match(api, /\bmetadataSchema:\s*ASSISTANT_CHAT_METADATA_SCHEMA/);
  assert.match(api, /\bdataSchemas:\s*ASSISTANT_CHAT_DATA_SCHEMAS/);
  assert.match(api, /\bcreateUIMessageStream<AssistantChatUiMessage>\s*\(/);
  assert.match(api, /type:\s*["']data-assistant-status["']/);
  assert.match(api, /transient:\s*true/);
  assert.match(api, /message:\s*getReadableAssistantChatStatusMessage\(data\)/);
  assert.match(api, /正在请求模型/);
  assert.match(api, /正在调用图片生成工具/);
  assert.match(api, /请求出错，正在整理错误信息/);
  assert.match(
    api,
    /const\s+createAssistantChatStatusChunk[\s\S]*type:\s*["']data-assistant-status["'][\s\S]*transient:\s*true/,
  );
  assert.doesNotMatch(
    api,
    /type:\s*["']data-assistant-status["'][\s\S]{0,500}transient:\s*false/,
  );
  assert.match(api, /\bwriter\.write\(\s*createAssistantChatStatusChunk\(/);
  assert.match(
    api,
    /for await\s*\(const chunk of result\.toUIMessageStream\(uiMessageStreamOptions\)\)[\s\S]*writer\.write\(chunk\)/,
  );
  assert.match(runtime, /\btoAssistantSidebarStreamStatus\b/);
  assert.match(runtime, /if\s*\(\s*data\.type\s*!==\s*["']data-assistant-status["']\s*\)\s*return null/);
  assert.match(runtime, /const\s+payload\s*=\s*isObjectRecord\(data\.data\)\s*\?\s*data\.data\s*:\s*\{\}/);
  assert.match(runtime, /\bonData:\s*\(data\)\s*=>/);
  assert.match(runtime, /\bonData:\s*\(data\)\s*=>\s*\{[\s\S]*toAssistantSidebarStreamStatus\(data\)/);
  assert.match(runtime, /\bAssistantStreamStatusFooter\b/);
  assert.match(runtime, /\bAssistantComposerFooter\b/);
  assert.match(runtime, /\bComposerFooter\b/);
  assert.match(
    runtime,
    /const\s+ComposerFooter\s*=\s*React\.useCallback\([\s\S]*<AssistantComposerFooter[\s\S]*modelContextWindow=\{modelContextWindow\}[\s\S]*status=\{streamStatus\}/,
  );
  assert.match(
    runtime,
    /const\s+threadComponents\s*=\s*React\.useMemo\([\s\S]*ComposerFooter[\s\S]*ComposerInlineControls/,
  );
  assert.doesNotMatch(runtime, /\bprogress-sanitizer\b|\bsanitizeAgentProgressMessage\b|\bTaskProgress\b/);
  assert.doesNotMatch(runtime, /\bAgentMessage\b/);
  assert.doesNotMatch(runtime, /\bagentData\b|\bskillData\b/);
});

test("assistant chat validates UI messages before model conversion and streaming", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );

  const normalizeIndex = api.indexOf(
    "const messages = normalizeAssistantUiMessages(body.messages)",
  );
  const toolsIndex = api.indexOf("const aiSdkTools = {");
  const validationIndex = api.indexOf(
    "const validation = await safeValidateUIMessages<AssistantChatUiMessage>",
  );
  const validatedMessagesIndex = api.indexOf("const validatedMessages = validation.data");
  const stripIndex = api.indexOf(
    "stripOversizedImageFilePartsForModelMessages(\n      validatedMessages",
  );
  const convertIndex = api.indexOf("const rawModelMessages = await convertToModelMessages");
  const streamOptionsIndex = api.indexOf("const uiMessageStreamOptions = {");
  const originalMessagesIndex = api.indexOf("originalMessages: validatedMessages");

  assert.notEqual(normalizeIndex, -1);
  assert.notEqual(toolsIndex, -1);
  assert.notEqual(validationIndex, -1);
  assert.notEqual(validatedMessagesIndex, -1);
  assert.notEqual(stripIndex, -1);
  assert.notEqual(convertIndex, -1);
  assert.notEqual(streamOptionsIndex, -1);
  assert.notEqual(originalMessagesIndex, -1);
  assert.ok(normalizeIndex < toolsIndex);
  assert.ok(toolsIndex < validationIndex);
  assert.ok(validationIndex < validatedMessagesIndex);
  assert.ok(validatedMessagesIndex < stripIndex);
  assert.ok(stripIndex < convertIndex);
  assert.ok(convertIndex < streamOptionsIndex);
  assert.ok(streamOptionsIndex < originalMessagesIndex);

  const validationBlock = api.slice(validationIndex, validatedMessagesIndex);
  assert.match(validationBlock, /\bmetadataSchema:\s*ASSISTANT_CHAT_METADATA_SCHEMA/);
  assert.match(validationBlock, /\bdataSchemas:\s*ASSISTANT_CHAT_DATA_SCHEMAS/);
  assert.match(validationBlock, /\btools:\s*toValidationTools\(aiSdkTools\)/);
  assert.match(api, /if\s*\(\s*validation\.success\s*===\s*false\s*\)/);
  assert.match(api, /error:\s*["']assistant_chat_invalid_messages["']/);
  assert.doesNotMatch(
    api,
    /const\s+rawModelMessages\s*=\s*await\s+convertToModelMessages\(\s*(?:messages|body\.messages)/,
  );
  assert.doesNotMatch(api, /originalMessages:\s*messages\b/);
});

test("assistant sidebar registers resolved reasoning effort through official ModelContext", () => {
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const modelSelector = readFileSync(
    join(repoRoot, "components/assistant-ui/model-selector.tsx"),
    "utf8",
  );
  const transport = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/react-ai-sdk/src/ui/use-chat/AssistantChatTransport.ts"),
    "utf8",
  );

  assert.match(modelSelector, /\bapi\.modelContext\(\)\.register\(/);
  assert.match(modelSelector, /\bmodelName:\s*value\b/);
  assert.match(modelSelector, /\breasoningEffort:\s*effort\b/);
  assert.match(transport, /\bconfig:\s*context\?\.config\b/);
  assert.match(
    runtime,
    /<AssistantComposerModelSelector[\s\S]*reasoningEffort=\{props\.reasoningEffort\}[\s\S]*selectedModelValue=\{props\.selectedModelValue\}/,
  );
  assert.doesNotMatch(
    runtime,
    /<AssistantComposerModelSelector[\s\S]*reasoningEffort=\{props\.selectedReasoningEffort\}/,
  );
});

test("assistant quote context uses the official react-ai-sdk injector", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );
  const officialQuoteInjector = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/react-ai-sdk/src/injectQuoteContext.ts"),
    "utf8",
  );
  const thread = readFileSync(
    join(repoRoot, "components/assistant-ui/thread.tsx"),
    "utf8",
  );
  const quote = readFileSync(
    join(repoRoot, "components/assistant-ui/quote.tsx"),
    "utf8",
  );

  assert.match(officialQuoteInjector, /Use this in your route handler before `convertToModelMessages`/);
  assert.match(officialQuoteInjector, /\bexport function injectQuoteContext\(messages:\s*UIMessage\[\]\)/);
  assert.match(api, /injectQuoteContext\s+as\s+injectAssistantQuoteContext/);
  assert.match(api, /from\s+["']@assistant-ui\/react-ai-sdk["']/);
  assert.match(
    api,
    /convertToModelMessages\(\s*[\s\S]*injectAssistantQuoteContext\(modelMessageSource\.messages\)[\s\S]*\)/,
  );
  assert.match(api, /\bquote:\s*z\b/);
  assert.match(api, /\bmetadataSchema:\s*ASSISTANT_CHAT_METADATA_SCHEMA/);
  assert.doesNotMatch(api, /\bconst\s+getQuoteText\s*=/);
  assert.doesNotMatch(api, /\bconst\s+injectAssistantQuoteContext\s*=\s*\(/);
  assert.match(thread, /\bComposerQuotePreview\b/);
  assert.match(thread, /\bSelectionToolbar\b/);
  assert.match(quote, /\bComposerPrimitive\.Quote\b/);
  assert.match(quote, /\bComposerPrimitive\.QuoteText\b/);
  assert.match(quote, /\bComposerPrimitive\.QuoteDismiss\b/);
  assert.match(quote, /\bSelectionToolbarQuote\b/);
  assert.match(quote, /\bSelectionToolbarPrimitive\.Quote\b/);
  assert.doesNotMatch(`${thread}\n${quote}`, /\bagentData\b|\bskillData\b|\bChatMessage\b/);
});

test("assistant sidebar image settings use official interactables and reach model messages", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const imageSettingsComponent = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarImageSettingsInteractable.tsx"),
    "utf8",
  );
  const imageSettings = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-image-settings-interactable.ts"),
    "utf8",
  );
  const reactAiSdkInject = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/react-ai-sdk/src/injectInteractableContext.ts"),
    "utf8",
  );
  const interactableMetadata = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/core/src/model-context/interactable-composer-metadata.ts"),
    "utf8",
  );

  const convertStart = api.indexOf("const rawModelMessages = await convertToModelMessages");
  const convertEnd = api.indexOf("const modelMessages =", convertStart);
  const convertBlock = api.slice(convertStart, convertEnd);

  assert.match(runtime, /\bunstable_Interactables\s*\(\s*\)/);
  assert.match(runtime, /<AssistantSidebarImageSettingsInteractable[\s\S]*imageModeEnabled=\{imageModeEnabled\}/);
  assert.match(imageSettingsComponent, /import\s+\{\s*unstable_useInteractable\s*\}\s+from\s+["']@assistant-ui\/react["']/);
  assert.match(imageSettingsComponent, /\bunstable_useInteractable\(\s*["']imageGenerationSettings["']/);
  assert.match(imageSettingsComponent, /\bstateSchema:\s*assistantSidebarImageSettingsStateSchema\b/);
  assert.match(imageSettingsComponent, /\bsetState\(runtimeState\)/);
  assert.match(imageSettings, /\bassistantSidebarImageSettingsStateSchema\s*=\s*z\.object\(/);
  assert.match(imageSettings, /\bmodeEnabled:\s*z\s*\.\s*boolean\(\)/);
  assert.match(imageSettings, /\bmodelId:\s*z\s*\.\s*string\(\)/);
  assert.match(imageSettings, /\baspectRatio:\s*z\s*\.\s*string\(\)/);
  assert.match(imageSettings, /\bcount:\s*z\s*\.\s*number\(\)\s*\.\s*int\(\)\s*\.\s*min\(1\)/);
  assert.match(api, /\bunstable_injectInteractableContext\b/);
  assert.match(api, /from\s+["']@assistant-ui\/react-ai-sdk["']/);
  assert.match(convertBlock, /\bconvertToModelMessages\(/);
  assert.match(convertBlock, /\bunstable_injectInteractableContext\(/);
  assert.ok(
    convertBlock.indexOf("unstable_injectInteractableContext(") <
      convertBlock.indexOf("{\n        tools: aiSdkTools"),
    "interactable context must be injected before convertToModelMessages options",
  );
  assert.match(reactAiSdkInject, /metadata\.custom\.interactables/);
  assert.match(reactAiSdkInject, /convertToModelMessages/);
  assert.match(interactableMetadata, /unstable_injectInteractableContext/);
  assert.doesNotMatch(imageSettingsComponent, /\bservices\/agents\b|\bservices\/skills\b|\bagentData\b|\bskillData\b|\bChatMessage\b/);
});

test("assistant persistent data parts can use official assistant-ui data renderers", () => {
  const thread = readFileSync(
    join(repoRoot, "components/assistant-ui/thread.tsx"),
    "utf8",
  );
  const messageParts = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/core/src/react/primitives/message/MessageParts.tsx"),
    "utf8",
  );
  const dataUiHook = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/core/src/react/model-context/useAssistantDataUI.ts"),
    "utf8",
  );
  const aiSdkStreamingDataDocs = readFileSync(
    join(repoRoot, "node_modules/ai/docs/04-ai-sdk-ui/20-streaming-data.mdx"),
    "utf8",
  );

  assert.match(aiSdkStreamingDataDocs, /Regular data parts are added to the message history and appear in `message\.parts`/);
  assert.match(messageParts, /\bdata\?:\s*DataConfig\s*\|\s*undefined/);
  assert.match(messageParts, /\bDataUIDisplay\b/);
  assert.match(messageParts, /\bdataRendererUI\b/);
  assert.match(dataUiHook, /\buseAssistantDataUI\b/);
  assert.match(dataUiHook, /\bsetDataUI\(dataUI\.name,\s*dataUI\.render\)/);
  assert.match(thread, /\bDataMessagePartComponent\b/);
  assert.match(thread, /\bdata\?:\s*\|\s*\{/);
  assert.match(thread, /\bby_name\?:\s*Record<string,\s*DataMessagePartComponent\s*\|\s*undefined>/);
  assert.match(thread, /\bFallback\?:\s*DataMessagePartComponent\s*\|\s*undefined/);
  assert.match(thread, /case\s+["']data["']:\s*\{/);
  assert.match(thread, /\bpart\.dataRendererUI\s*\?\?/);
  assert.match(thread, /\bdata\?\.by_name\?\.\[part\.name\]\s*\?\?\s*data\?\.Fallback/);
  assert.match(thread, /DataRenderer\s*\?\s*<DataRenderer\s+\{\.\.\.part\}\s*\/>\s*:\s*null/);
  assert.doesNotMatch(thread, /case\s+["']data["']:\s*return\s+null/);
});

test("assistant audio parts expose the official unstable audio renderer slot", () => {
  const thread = readFileSync(
    join(repoRoot, "components/assistant-ui/thread.tsx"),
    "utf8",
  );
  const messageTypes = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/core/src/types/message.ts"),
    "utf8",
  );
  const messageParts = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/core/src/react/primitives/message/MessageParts.tsx"),
    "utf8",
  );

  assert.match(messageTypes, /\btype\s+Unstable_AudioMessagePart\b/);
  assert.match(messageTypes, /readonly\s+type:\s*["']audio["']/);
  assert.match(messageParts, /\bUnstable_Audio\?:\s*Unstable_AudioMessagePartComponent/);
  assert.match(messageParts, /case\s+["']audio["']:\s*return\s+<Audio\s+\{\.\.\.part\}\s*\/>/);
  assert.match(thread, /\bUnstable_AudioMessagePartComponent\b/);
  assert.match(thread, /\bUnstable_Audio\?:\s*Unstable_AudioMessagePartComponent\s*\|\s*undefined/);
  assert.match(thread, /case\s+["']audio["']:\s*return\s+Unstable_Audio\s*\?\s*<Unstable_Audio\s+\{\.\.\.part\}\s*\/>\s*:\s*null/);
  assert.doesNotMatch(thread, /<audio\b/);
  assert.doesNotMatch(thread, /\bAudioPlayer\b/);
});

test("assistant sidebar uses official context display and streaming timing UI", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );
  const thread = readFileSync(
    join(repoRoot, "components/assistant-ui/thread.tsx"),
    "utf8",
  );
  const contextDisplay = readFileSync(
    join(repoRoot, "components/assistant-ui/context-display.tsx"),
    "utf8",
  );
  const runtime = readFileSync(
    join(
      repoRoot,
      "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx",
    ),
    "utf8",
  );
  const messageTiming = readFileSync(
    join(repoRoot, "components/assistant-ui/message-timing.tsx"),
    "utf8",
  );
  const useAiSdkRuntime = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/react-ai-sdk/src/ui/use-chat/useAISDKRuntime.ts"),
    "utf8",
  );
  const convertMessage = readFileSync(
    join(repoRoot, "node_modules/@assistant-ui/react-ai-sdk/src/ui/utils/convertMessage.ts"),
    "utf8",
  );

  assert.match(api, /\bmessageMetadata:\s*\(\{\s*part\s*\}\)\s*=>/);
  assert.match(api, /\bcreateAssistantChatMessageMetadata\(part,\s*\{/);
  assert.match(api, /\busage:\s*part\.totalUsage\b/);
  assert.match(thread, /<MessageTiming\b/);
  assert.doesNotMatch(thread, /\bTokenUsage\b/);
  assert.match(contextDisplay, /\buseThreadTokenUsage\(\)/);
  assert.match(contextDisplay, /data-slot="context-display-trigger"/);
  assert.match(contextDisplay, /data-slot="context-display-popover"/);
  assert.match(runtime, /<ContextDisplay\.Ring\b/);
  assert.match(runtime, /\bresolveAssistantModelContextWindow\(/);
  assert.match(messageTiming, /\buseMessageTiming\(\)/);
  assert.match(useAiSdkRuntime, /\bconst\s+messageTiming\s*=\s*useStreamingTiming\(/);
  assert.match(useAiSdkRuntime, /\bmessageTiming,\s*$/m);
  assert.match(convertMessage, /\bmetadata\.messageTiming\?\.\[message\.id\]/);
  assert.match(convertMessage, /\.\.\.\(timing\s*&&\s*\{\s*timing\s*\}\)/);
  assert.doesNotMatch(thread, /\bAgentMessage\b/);
  assert.doesNotMatch(thread, /\bagentData\b|\bskillData\b/);
});

test("assistant sidebar composer uses official mention slash primitives with healthy copy", () => {
  const thread = readFileSync(
    join(repoRoot, "components/assistant-ui/thread.tsx"),
    "utf8",
  );
  const triggerPopover = readFileSync(
    join(repoRoot, "components/assistant-ui/composer-trigger-popover.tsx"),
    "utf8",
  );

  assert.match(thread, /\bunstable_useMentionAdapter\(\{/);
  assert.match(thread, /\bunstable_useSlashCommandAdapter\(\{/);
  assert.match(thread, /<LexicalComposerInput\b/);
  assert.match(thread, /<ComposerPrimitive\.Unstable_TriggerPopoverRoot>/);
  assert.match(thread, /<ComposerTriggerPopover\s+char=["']@["']/);
  assert.match(thread, /<ComposerTriggerPopover\s+char=["']\/["']/);
  assert.match(thread, /\bASSISTANT_MENTION_CATEGORIES\b/);
  assert.match(thread, /\bcategories:\s*ASSISTANT_MENTION_CATEGORIES\b/);
  assert.match(thread, /\bincludeModelContextTools:\s*\{/);
  assert.match(thread, /\bcategory:\s*\{\s*id:\s*["']capabilities["']/);
  assert.doesNotMatch(
    thread,
    /\bunstable_useMentionAdapter\(\{\s*items:\s*ASSISTANT_MENTION_ITEMS[\s\S]{0,300}\bincludeModelContextTools:/,
  );
  assert.match(thread, /planStudioWorkflow:\s*["']Studio 工作流规划["']/);
  assert.match(thread, /placeholder=["']\u8f93\u5165\u6d88\u606f\uff0c@\s*\u5f15\u7528\u4e0a\u4e0b\u6587\uff0c\/\s*\u8c03\u7528\u547d\u4ee4["']/);
  assert.match(thread, /emptyItemsLabel=["']\u6ca1\u6709\u5339\u914d\u7684\u5f15\u7528["']/);
  assert.match(thread, /emptyItemsLabel=["']\u6ca1\u6709\u5339\u914d\u7684\u547d\u4ee4["']/);
  assert.match(thread, /label:\s*["']\u56fe\u7247\u6a21\u5f0f["']/);
  assert.match(thread, /label:\s*["']\u8054\u7f51\u641c\u7d22["']/);
  assert.match(thread, /label:\s*["']\u5929\u6c14["']/);
  assert.match(triggerPopover, /ComposerPrimitive\.Unstable_TriggerPopover\.Directive/);
  assert.match(triggerPopover, /ComposerPrimitive\.Unstable_TriggerPopover\.Action/);

  const mojibakePattern =
    /[\uFFFD\u9365\u9471\u6FB6\u5A11\u6748\u93BC\u7D31\u6C8C]/;
  assert.doesNotMatch(thread, mojibakePattern);
  assert.doesNotMatch(triggerPopover, mojibakePattern);
  assert.doesNotMatch(thread, /\bAgentMessage\b/);
  assert.doesNotMatch(thread, /\bagentData\b|\bskillData\b/);
});

test("assistant sidebar supports official AI SDK tool approval continuation", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );
  const imageTools = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-chat-image-tools.ts"),
    "utf8",
  );
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const serverToolkit = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-server-toolkit.ts"),
    "utf8",
  );
  const toolFallback = readFileSync(
    join(repoRoot, "components/assistant-ui/tool-fallback.tsx"),
    "utf8",
  );
  const toolUis = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolUis.tsx"),
    "utf8",
  );

  assert.match(runtime, /\blastAssistantMessageIsCompleteWithApprovalResponses\b/);
  assert.match(runtime, /\bassistantSidebarShouldSendAutomatically\b/);
  assert.match(runtime, /\blastAssistantMessageIsCompleteWithToolCalls\(options\)\s*\|\|\s*[\s\S]*lastAssistantMessageIsCompleteWithApprovalResponses\(options\)/);
  assert.match(runtime, /\bsendAutomaticallyWhen:\s*assistantSidebarShouldSendAutomatically\b/);
  assert.match(imageTools, /\brequiresApproval\?:\s*boolean\s*\|\s*null/);
  assert.match(imageTools, /\bconfig\.requiresApproval\s*===\s*true\s*\?\s*true\b/);
  assert.match(imageTools, /\bconst\s+needsImageApproval\s*=/);
  assert.match(imageTools, /\bneedsApproval:\s*needsImageApproval\b/);
  assert.match(imageTools, /\beffectiveCount\s*>\s*1\b/);
  assert.match(imageTools, /\bexplicitReferenceCount\s*>\s*0\b/);
  assert.match(imageTools, /\bdefaultReferenceImages\.length\s*>\s*0\b/);
  assert.match(api, /\bpreserveAssistantChatServerToolApproval\b/);
  assert.match(api, /\bapprovalToolCount\b/);
  assert.match(serverToolkit, /\bneedsApproval\b/);
  assert.match(toolFallback, /\brespondToApproval\(\{\s*approved\s*\}\)/);
  assert.match(toolFallback, /\brespondToApproval\?\.\(\{\s*optionId:\s*option\.id\s*\}\)/);
  assert.match(toolFallback, /waiting for an official approval response/);
  assert.doesNotMatch(toolFallback, /\bApproved by user\b|\bUser denied tool execution\b/);
  assert.doesNotMatch(toolFallback, /\baddResult\?\.\(\s*approved\s*\?/);
  assert.doesNotMatch(toolFallback, /Pick<ToolCallMessagePartProps,\s*["']addResult["']/);
  assert.doesNotMatch(toolUis, /<ToolFallback\.Approval[\s\S]*?addResult=\{addResult\}/);
});

test("assistant image generation keeps UI images out of language-model tool output", () => {
  const imageTools = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-chat-image-tools.ts"),
    "utf8",
  );
  const serverToolkit = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-server-toolkit.ts"),
    "utf8",
  );

  assert.match(imageTools, /\btoModelOutput:\s*\(\{\s*output\s*\}\)\s*=>\s*\(\{/);
  assert.match(imageTools, /image bytes are intentionally not included/);
  assert.doesNotMatch(imageTools, /\btype:\s*["']image-data["']/);
  assert.doesNotMatch(imageTools, /\bgetImageDataForModelOutput\b/);
  assert.doesNotMatch(imageTools, /\bMAX_IMAGE_MODEL_OUTPUT_IMAGES\b/);
  assert.match(serverToolkit, /\btoAssistantImageModelOutput\b/);
  assert.match(serverToolkit, /image bytes are intentionally not included/);
  assert.doesNotMatch(serverToolkit, /\btype:\s*["']file["']/);
  assert.doesNotMatch(serverToolkit, /\bgetImageModelContentPart\b/);
  assert.doesNotMatch(serverToolkit, /\bMAX_IMAGE_MODEL_OUTPUT_IMAGES\b/);
});

test("workspace generated files read official assistant-ui thread parts", () => {
  const generatedFiles = readFileSync(
    join(repoRoot, "pages/Workspace/components/generatedFiles.ts"),
    "utf8",
  );
  const projectLoader = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceProjectLoader.ts"),
    "utf8",
  );
  const workspacePersistence = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/workspacePersistence.ts"),
    "utf8",
  );
  const panel = readFileSync(
    join(repoRoot, "pages/Workspace/components/WorkspaceGeneratedFilesPanel.tsx"),
    "utf8",
  );
  const leftPanel = readFileSync(
    join(repoRoot, "pages/Workspace/components/WorkspaceLeftPanel.tsx"),
    "utf8",
  );
  const sidebarProps = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceSidebarProps.ts"),
    "utf8",
  );
  const sidebarTypes = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebar.types.ts"),
    "utf8",
  );

  assert.match(generatedFiles, /\bnormalizeAssistantUiStorageEntries\b/);
  assert.match(generatedFiles, /\bnormalizeAssistantUiStorageEntryRows\b/);
  assert.match(generatedFiles, /\bgetGeneratedConversationFilesFromAssistantThread\b/);
  assert.match(generatedFiles, /type\s*!==\s*`tool-\$\{toolName\}`/);
  assert.match(generatedFiles, /getAssistantPartToolOutput\(part,\s*["']createImage["']\)/);
  assert.doesNotMatch(generatedFiles, /\bgetGeneratedConversationFilesFromStoredMessages\b/);
  assert.doesNotMatch(generatedFiles, /from\s+["']\.\/generatedFilesLegacy\.ts["']/);
  assert.doesNotMatch(generatedFiles, /\bGeneratedFilesMessage\b/);
  assert.doesNotMatch(generatedFiles, /\bChatMessage\b|\bagentData\b|\bskillData\b/);
  assert.doesNotMatch(generatedFiles, /\bgetGeneratedConversationFilesFromAgentData\b/);
  assert.equal(
    existsSync(join(repoRoot, "pages/Workspace/components/generatedFilesLegacy.ts")),
    false,
  );
  assert.doesNotMatch(projectLoader, /generatedFilesLegacy|getGeneratedConversationFilesFromAgentData|getGeneratedConversationFilesFromStoredMessages/);
  assert.doesNotMatch(workspacePersistence, /generatedFilesLegacy|getGeneratedConversationFilesFromAgentData|getGeneratedConversationFilesFromStoredMessages/);
  assert.doesNotMatch(projectLoader, /\bagentData\.(?:imageUrls|videoUrls|assets)\b/);
  assert.doesNotMatch(workspacePersistence, /\bagentData\.(?:imageUrls|videoUrls|assets)\b/);
  assert.doesNotMatch(generatedFiles, /\[\s*\.\.\.legacyFiles\s*,\s*\.\.\.assistantFiles\s*\]/);
  assert.doesNotMatch(generatedFiles, /generatedFiles\.legacy/);
  assert.match(panel, /\bassistantThread\?:\s*ConversationSession\["assistantThread"\]/);
  assert.match(panel, /\bgetGeneratedConversationFilesFromAssistantThread\(assistantThread\)/);
  assert.doesNotMatch(panel, /\bGeneratedFilesMessage\b|\bChatMessage\b|\bagentData\b|\bskillData\b/);
  assert.match(leftPanel, /\bassistantThread=\{assistantThread\}/);
  assert.doesNotMatch(leftPanel, /\bGeneratedFilesMessage\b|\bChatMessage\b|\bagentData\b|\bskillData\b/);
  assert.match(sidebarProps, /\bactiveAssistantThread\b/);
  assert.doesNotMatch(sidebarProps, /\bactiveGeneratedFilesFallbackMessages\b/);
  assert.doesNotMatch(sidebarProps, /\bactiveConversationMessages\b/);
  assert.doesNotMatch(sidebarProps, /\btimestamp:\s*message\.timestamp\b/);
  assert.doesNotMatch(sidebarProps, /\bagentData:\s*message\.agentData\b/);
  assert.match(sidebarProps, /\.assistantThread\b/);
  assert.doesNotMatch(sidebarProps, /\bmessages:\s*React\.ComponentProps<typeof WorkspaceLeftPanel>\["messages"\]/);
  assert.match(sidebarTypes, /\bexport\s+type\s+AssistantSidebarConversation\s*=\s*Pick</);
  assert.match(sidebarTypes, /\bconversations:\s*AssistantSidebarConversation\[\]/);
  assert.doesNotMatch(sidebarTypes, /\bconversations:\s*ConversationSession\[\]/);
  assert.match(sidebarProps, /\bconst\s+assistantSidebarConversations\s*=\s*React\.useMemo/);
  assert.match(sidebarProps, /\bconversations:\s*assistantSidebarConversations\b/);
  assert.doesNotMatch(sidebarProps, /session:\s*\{[\s\S]{0,160}conversations,\s*setConversations/);
  assert.doesNotMatch(generatedFiles, /\bservices\/agents\b|\bservices\/skills\b/);
});

test("assistant sidebar topic assets reuse official UIMessage parts and composer attachments", () => {
  const generatedFiles = readFileSync(
    join(repoRoot, "pages/Workspace/components/generatedFiles.ts"),
    "utf8",
  );
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const thread = readFileSync(
    join(repoRoot, "components/assistant-ui/thread.tsx"),
    "utf8",
  );
  const attachment = readFileSync(
    join(repoRoot, "components/assistant-ui/attachment.tsx"),
    "utf8",
  );
  const sidebarTypes = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebar.types.ts"),
    "utf8",
  );
  const sidebarProps = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceSidebarProps.ts"),
    "utf8",
  );
  const canvasAssetImport = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceCanvasAssetImport.ts"),
    "utf8",
  );
  const canvasElementInteraction = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceCanvasElementInteraction.ts"),
    "utf8",
  );
  const canvasElementsLayer = readFileSync(
    join(repoRoot, "pages/Workspace/components/WorkspaceCanvasElementsLayer.tsx"),
    "utf8",
  );
  const workspace = readFileSync(
    join(repoRoot, "pages/Workspace.tsx"),
    "utf8",
  );

  assert.match(generatedFiles, /\bexport\s+type\s+ConversationThreadAsset\b/);
  assert.match(generatedFiles, /\bgetConversationAssetsFromAssistantThread\b/);
  assert.match(generatedFiles, /\bgetVisibleAssistantThreadMessages\(thread\)/);
  assert.match(generatedFiles, /\bmessage\.parts\.flatMap\b/);
  assert.match(generatedFiles, /getAssistantPartToolOutput\(part,\s*["']createImage["']\)/);
  assert.doesNotMatch(
    generatedFiles,
    /\bChatMessage\b|\bagentData\b|\bskillData\b|services\/agents|services\/skills/,
  );

  assert.match(runtime, /\btype\s+CreateAttachment\b/);
  assert.match(runtime, /\btoAssistantAssetAttachment\b/);
  assert.match(runtime, /\bgetConversationAssetsFromAssistantThread\(/);
  assert.match(runtime, /\bruntime\.thread\.composer\.addAttachment\(/);
  assert.match(runtime, /\bAssistantThreadAssetsPopover\b/);
  assert.match(sidebarTypes, /\bimportAssetToCanvas\?:\s*\(input:/);
  assert.match(sidebarProps, /\bimportAssetToCanvas:\s*importUrlAssetToCanvas\b/);
  assert.match(workspace, /\bimportUrlAssetToCanvas\b/);
  assert.match(canvasAssetImport, /\bimportUrlAssetToCanvas\b/);
  assert.match(canvasAssetImport, /\bmakeImageProxyFromUrl\(/);
  assert.match(runtime, /\bhandleImportConversationAssetToCanvas\b/);
  assert.match(runtime, /\bonImportAssetToCanvas\b/);
  assert.match(runtime, /\btopic_asset_imported_to_canvas\b/);
  assert.match(runtime, /\btoCanvasElementAttachment\b/);
  assert.match(runtime, /\btoMarkerReferenceAttachment\b/);
  assert.match(runtime, /\bselectedCanvasAsset\b/);
  assert.match(runtime, /\bselectedMarkerAsset\b/);
  assert.match(runtime, /\bbrowserAgent\.resolveMarkerAsset\(/);
  assert.match(runtime, /\bbrowserAgent\.resolveElementAsset\(/);
  assert.match(runtime, /\bresolveAssistantReferenceDirective\b/);
  assert.match(runtime, /\bresolveCanvasReferenceDirective\b/);
  assert.match(runtime, /\binsertCanvasReferenceDirectiveIntoText\b/);
  assert.match(runtime, /\bmapCanvasReferenceVisibleOffsetToSourceOffset\b/);
  assert.match(runtime, /\bpendingCanvasReferenceAssets\b/);
  assert.match(runtime, /\binsertPendingCanvasReferenceDirective\b/);
  assert.match(runtime, /\bhandleCommitPendingCanvasReferences\b/);
  assert.match(runtime, /\brememberComposerVisibleCursorOffset\b/);
  assert.match(runtime, /\bcanvasDirectivePreviews\b/);
  assert.match(runtime, /\bgetCanvasDirectivePreview\b/);
  assert.match(runtime, /\bconst\s+composer\s*=\s*runtime\.thread\.composer\b/);
  assert.match(runtime, /\bcomposer\.setText\(/);
  assert.match(runtime, /\bhasCanvasReferenceAttachment\b/);
  assert.match(runtime, /\bbrowserAgent\.referenceSelectionNonce\b/);
  assert.match(runtime, /\bgetAttachmentByIndex\(attachmentIndex\)\.remove\(\)/);
  assert.match(thread, /\bgetCanvasDirectivePreview\b/);
  assert.match(thread, /\bisCanvasDirectivePending\b/);
  assert.match(thread, /\bonComposerSendIntent\b/);
  assert.match(thread, /\baui-directive-chip-preview\b/);
  assert.match(thread, /\baui-directive-chip-hover-preview\b/);
  assert.match(thread, /\bhideArrow\b/);
  assert.match(thread, /\bobject-contain\b/);
  assert.match(thread, /directiveType\s*===\s*["']mark["']/);
  assert.match(attachment, /\(\?:canvas\|mark\)-/);
  assert.match(sidebarTypes, /\bresolveMarkerAsset\?:\s*\(markerId:\s*string\)/);
  assert.match(sidebarTypes, /\breferenceSelectionNonce\?:\s*number/);
  assert.match(sidebarProps, /\belement\.persistedOriginalUrl\b/);
  assert.match(canvasElementInteraction, /\bonReferenceElementSelect\?\.\(id\)/);
  assert.match(canvasElementInteraction, /\bonMarkerPlaced\?:\s*\(markerId:\s*string\)/);
  assert.match(canvasElementInteraction, /\bonMarkerPlaced\?\.\(newMarkerId\)/);
  assert.ok(
    canvasElementInteraction.indexOf('activeTool === "mark"') <
      canvasElementInteraction.indexOf("onReferenceElementSelect?.(id)"),
    "mark placement must run before ordinary canvas reference selection",
  );
  assert.match(
    canvasElementsLayer,
    /onMouseDown=\{\(event\)\s*=>\s*handleElementMouseDown\(event,\s*element\.id\)\}/,
  );
  assert.match(workspace, /\breferenceSelectionNonce:\s*assistantReferenceSelection\.nonce/);
  assert.match(workspace, /\bonMarkerPlaced:\s*handleAssistantMarkerPlaced\b/);
  assert.match(workspace, /\bsetEditingMarkerId\(markerId\)/);
  assert.match(workspace, /\bcurrent\.elementId\s*===\s*null[\s\S]*elementId:\s*null/);
  assert.match(workspace, /\bhandleAssistantReferenceSelectionClear\b/);
  assert.match(
    workspace,
    /setSelectedElementIds\(\[\]\);\s*handleAssistantReferenceSelectionClear\(\)/,
  );
  assert.match(sidebarProps, /\bresolveMarkerAsset:\s*\(markerId:\s*string\)/);
  assert.match(workspace, /\bselectedMarkerId:\s*editingMarkerId\b/);
  assert.match(
    runtime,
    /Number\(browserAgent\.referenceSelectionNonce\s*\|\|\s*0\)\s*<=\s*0[\s\S]*browserAgent\.selectedElementId/,
  );
  assert.match(runtime, /\bremoveAssistantReferenceDirectiveFromText\b/);
  assert.match(runtime, /\bclearPendingAssistantReferences\b/);
  assert.match(
    runtime,
    /!confirmedCanvasReferenceIdsRef\.current\.has\(directiveId\)/,
  );
  assert.match(runtime, /\bpending_canvas_references_cleared\b/);
  assert.match(thread, /\bonComposerInputIntent\b/);
  assert.match(runtime, /\bselected_canvas_asset_attached\b/);
  assert.doesNotMatch(
    runtime,
    /\bgetGeneratedConversationFilesFromAgentData\b|\bGeneratedFilesMessage\b|\bagentData\b|\bskillData\b|\bChatMessage\b/,
  );
  assert.doesNotMatch(
    canvasAssetImport,
    /\bChatMessage\b|\bagentData\b|\bskillData\b|\bservices\/agents\b|\bservices\/skills\b/,
  );
});

test("assistant image input helpers stay in neutral image-generation modules", () => {
  const projectSources = readProjectSources()
    .filter((file) => file.path !== "services/assistant-ui/assistant-ui-official-integration-guard.test.ts")
    .map((file) => file.text)
    .join("\n");
  const imageReferenceResolver = readFileSync(
    join(repoRoot, "services/image-reference-resolver.ts"),
    "utf8",
  );
  const openaiImageSpec = readFileSync(
    join(repoRoot, "services/image-generation/core/openai-image-spec.ts"),
    "utf8",
  );
  const imageDataUrl = readFileSync(
    join(repoRoot, "services/image-generation/core/image-data-url.ts"),
    "utf8",
  );

  assert.match(imageDataUrl, /\bnormalizeImageDataUrlString\b/);
  assert.match(imageReferenceResolver, /image-generation\/core\/image-data-url/);
  assert.match(openaiImageSpec, /\.\/image-data-url\.ts/);
  assert.equal(existsSync(join(repoRoot, "services/agents/data-url-helpers.ts")), false);
  assert.equal(existsSync(join(repoRoot, "services/agents/data-url-helpers.test.ts")), false);
  assert.doesNotMatch(projectSources, /data-url-helpers/);
  assert.doesNotMatch(
    `${imageReferenceResolver}\n${openaiImageSpec}`,
    /agents\/data-url-helpers|services\/agents/,
  );
});

test("tracked TypeScript services do not keep duplicate compiled JavaScript entrypoints", () => {
  for (const basename of [
    "ecommerce-product-analysis-debug",
    "ecommerce-supplement-debug",
    "four-views",
    "image-postprocess",
    "provider-config",
    "validators",
  ]) {
    assert.equal(existsSync(join(repoRoot, `services/${basename}.ts`)), true);
    assert.equal(existsSync(join(repoRoot, `services/${basename}.js`)), false);
  }
});

test("workspace assistant thread repository keeps official UIMessage storage separate from legacy ChatMessage mirrors", () => {
  const assistantThreadRepository = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/assistantThreadRepository.ts"),
    "utf8",
  );
  const conversationPersistence = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceConversationPersistence.ts"),
    "utf8",
  );
  const workspace = readFileSync(
    join(repoRoot, "pages/Workspace.tsx"),
    "utf8",
  );
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const projectLoader = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceProjectLoader.ts"),
    "utf8",
  );
  const conversationMeta = readFileSync(
    join(repoRoot, "pages/Workspace/conversationMeta.ts"),
    "utf8",
  );
  const legacyAssistantText = readFileSync(
    join(repoRoot, "pages/Workspace/legacyAssistantText.ts"),
    "utf8",
  );

  assert.match(assistantThreadRepository, /import\s+type\s+\{\s*UIMessage\s*\}\s+from\s+["']ai["']/);
  assert.match(assistantThreadRepository, /\bnormalizeAssistantUiStorageEntries\b/);
  assert.match(assistantThreadRepository, /\bnormalizeAssistantUiStorageEntryRows\b/);
  assert.match(assistantThreadRepository, /\bgetAssistantThreadVisibleUiMessages\b/);
  assert.match(assistantThreadRepository, /\bapplyAssistantThreadSubmittedFeedback\b/);
  assert.match(assistantThreadRepository, /\bsliceConversationAssistantThreadToHead\b/);
  assert.doesNotMatch(assistantThreadRepository, /\bChatMessage\b|\bagentData\b|\bskillData\b/);
  assert.doesNotMatch(assistantThreadRepository, /\bgetConversationVisibleMessages\b/);
  assert.match(assistantThreadRepository, /\bresolveAssistantThreadHeadId\b/);
  assert.equal(
    existsSync(join(repoRoot, "pages/Workspace/controllers/assistantThreadLegacyProjection.ts")),
    false,
  );

  assert.doesNotMatch(
    runtime,
    /assistantThreadRepository\.legacy|getAssistantThreadVisibleLegacyMessages\b|\bChatMessage\b/,
  );
  assert.match(runtime, /messages:\s*Array\.isArray\(nextConversation\.messages\)/);
  assert.doesNotMatch(runtime, /messages:\s*visibleMessages\b/);
  assert.match(projectLoader, /from\s+["']\.\/assistantThreadRepository\.ts["']/);
  assert.doesNotMatch(
    projectLoader,
    /assistantThreadLegacyProjection|getConversationVisibleMessages/,
  );
  assert.match(projectLoader, /\bresolveAssistantThreadHeadId\(/);
  assert.doesNotMatch(projectLoader, /assistantThreadRepository\.legacy/);
  assert.doesNotMatch(projectLoader, /\.actions\.setMessages\(/);
  assert.match(conversationMeta, /from\s+["']\.\/legacyAssistantText\.ts["']/);
  assert.doesNotMatch(
    conversationMeta,
    /AgentMessage\.helpers|services\/agents|services\/skills|progress-sanitizer|agentData|skillData|deriveConversationStatusSummary|ConversationStatusSummary/,
  );
  assert.equal(
    existsSync(join(repoRoot, "pages/Workspace/legacyConversationStatus.ts")),
    false,
  );
  assert.match(legacyAssistantText, /\bnormalizeLegacyAssistantMessageText\b/);
  assert.doesNotMatch(legacyAssistantText, /AgentMessage|ChatMessage|agentData|skillData|services\/agents|services\/skills/);
  assert.doesNotMatch(
    conversationPersistence,
    /\blegacyMessages\b|resolveLegacyConversationMessagesForPersistence|conversationMessagePersistence/,
  );
  assert.match(
    conversationPersistence,
    /Array\.isArray\(existingConversation\?\.messages\)/,
  );
  assert.equal(
    existsSync(join(repoRoot, "pages/Workspace/controllers/conversationMessagePersistence.ts")),
    false,
  );
  assert.equal(
    existsSync(join(repoRoot, "pages/Workspace/controllers/useWorkspaceConversationPersistence.test.ts")),
    false,
  );
  assert.doesNotMatch(workspace, /\buseAgentStore\(\(s\)\s*=>\s*s\.messages\)/);
  assert.doesNotMatch(workspace, /\bchatSessionRef\b|\bcreateChatSession\b/);
  assert.doesNotMatch(
    workspace,
    /useWorkspaceConversationPersistence\(\{[\s\S]{0,400}\blegacyMessages\b/,
  );
});

test("workspace persistence keeps official assistant-ui thread history complete", () => {
  const workspacePersistence = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/workspacePersistence.ts"),
    "utf8",
  );
  const assistantThreadPersistence = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/workspaceAssistantThreadPersistence.ts"),
    "utf8",
  );
  const assistantThreadPersistenceTest = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/workspaceAssistantThreadPersistence.test.ts"),
    "utf8",
  );

  assert.match(workspacePersistence, /\bcompactAssistantThreadForPersistence\b/);
  assert.match(assistantThreadPersistence, /\bnormalizeAssistantUiStorageEntryRows\b/);
  assert.match(assistantThreadPersistenceTest, /length:\s*95/);
  assert.match(assistantThreadPersistenceTest, /messages\.length,\s*95/);
  assert.doesNotMatch(assistantThreadPersistence, /\bMAX_CONVERSATION_MESSAGES\b/);
  assert.doesNotMatch(assistantThreadPersistence, /\b(?:messages|thread\.messages)\.slice\s*\(/);
  assert.doesNotMatch(assistantThreadPersistence, /\bservices\/agents\b|\bservices\/skills\b|\bagentData\b|\bskillData\b/);
});

test("workspace project loader recovers images from official assistant-ui thread parts", () => {
  const projectLoader = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceProjectLoader.ts"),
    "utf8",
  );
  const workspaceSendHelpers = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceSend.helpers.ts"),
    "utf8",
  );
  const generatedFiles = readFileSync(
    join(repoRoot, "pages/Workspace/components/generatedFiles.ts"),
    "utf8",
  );

  assert.match(generatedFiles, /\bgetGeneratedConversationImageUrls\b/);
  assert.match(generatedFiles, /\bgetGeneratedConversationFilesFromAssistantThread\(\s*conversation\.assistantThread/);
  assert.doesNotMatch(generatedFiles, /\bgetGeneratedConversationFiles\(/);
  assert.match(generatedFiles, /\bconversation\.assistantThread\b/);
  assert.match(projectLoader, /\bgetGeneratedConversationImageUrls\b/);
  assert.match(projectLoader, /getGeneratedConversationImageUrls\(conversation\)/);
  assert.match(projectLoader, /\bseen\.has\(normalized\)/);
  assert.doesNotMatch(projectLoader, /\bservices\/agents\/image-result-extractor\b/);
  assert.doesNotMatch(projectLoader, /\bservices\/skills\/image-gen\.skill\b/);
  assert.match(workspaceSendHelpers, /\bservices\/image-generation\/core\/image-result-extractor\.ts\b/);
  assert.doesNotMatch(workspaceSendHelpers, /\bservices\/agents\/image-result-extractor\b/);
  assert.doesNotMatch(workspaceSendHelpers, /\bservices\/skills\/image-gen\.skill\b/);
});

test("workspace safe-load preserves the complete assistant-ui thread list", () => {
  const projectLoader = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceProjectLoader.ts"),
    "utf8",
  );
  const workspacePersistence = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/workspacePersistence.ts"),
    "utf8",
  );
  const storage = readFileSync(
    join(repoRoot, "services/storage.ts"),
    "utf8",
  );
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );

  assert.doesNotMatch(projectLoader, /\bSAFE_LOAD_CONVERSATION_LIMIT\b/);
  assert.doesNotMatch(projectLoader, /\.slice\(0,\s*SAFE_LOAD_CONVERSATION_LIMIT\)/);
  assert.doesNotMatch(workspacePersistence, /\bMAX_CONVERSATIONS\b/);
  assert.doesNotMatch(workspacePersistence, /\.slice\(0,\s*MAX_CONVERSATIONS\)/);
  assert.match(
    projectLoader,
    /const\s+safeConversations\s*=\s*trimmedConversations\s*\.\s*map/,
  );
  assert.match(projectLoader, /\.slice\(-SAFE_LOAD_ACTIVE_MESSAGE_LIMIT\)/);
  assert.match(storage, /\bmergeMissingConversationsForSave\b/);
  assert.match(storage, /\bmergeConversationBackupsIntoProject\b/);
  assert.match(storage, /\bmergeConversationBackupsForSave\b/);
  assert.match(storage, /\breadProjectConversationBackups\b/);
  assert.match(storage, /\bCONVERSATION_BACKUP_STORE\b/);
  const dbVersionMatch = /const\s+DB_VERSION\s*=\s*(\d+)/.exec(storage);
  assert.ok(dbVersionMatch, "DB_VERSION should stay explicit for IndexedDB migrations");
  assert.ok(
    Number(dbVersionMatch[1]) >= 7,
    "DB_VERSION must include the conversation backup store migration",
  );
  assert.match(storage, /\bdeletedConversationIdsByProject\b/);
  assert.match(runtime, /\bmarkProjectConversationDeleted\(/);
});

test("assistant image edit follow-ups reuse recent images through official createImage tool", () => {
  const script = `
    import assert from "node:assert/strict";
    import {
      deriveAssistantChatDirectiveRequestOverrides,
      getDefaultImageReferenceUrls,
      getRecentGeneratedImageReferenceUrls,
      shouldUseRecentGeneratedImagesAsReferences,
    } from "./api/assistant-chat.ts";

    const uploadedImageUrl = \`data:image/jpeg;base64,\${"u".repeat(80)}\`;
    const generatedImageUrl = \`data:image/png;base64,\${"g".repeat(80)}\`;
    const messages = [
      {
        id: "user-upload",
        role: "user",
        parts: [
          {
            type: "text",
            text: "\\u8fd9\\u662f\\u539f\\u56fe\\uff0c\\u5148\\u6309\\u8fd9\\u5f20\\u751f\\u6210\\u4e00\\u5f20\\u56fe",
          },
          {
            type: "file",
            mediaType: "image/jpeg",
            url: uploadedImageUrl,
            filename: "original.jpg",
          },
        ],
      },
      {
        id: "assistant-generated",
        role: "assistant",
        parts: [
          {
            type: "tool-createImage",
            toolCallId: "tool-1",
            state: "output-available",
            output: {
              images: [
                {
                  type: "image",
                  image: generatedImageUrl,
                  mediaType: "image/png",
                },
              ],
            },
          },
        ],
      },
      {
        id: "user-edit",
        role: "user",
        parts: [
          {
            type: "text",
            text: "\\u8fd9\\u5f20\\u4e0d\\u7b26\\u5408\\u6211\\u7684\\u9884\\u671f\\uff0c\\u53c2\\u8003\\u539f\\u6765\\u56fe\\u7247\\u7ee7\\u7eed\\u4fee\\u6539",
          },
        ],
      },
    ];

    assert.equal(shouldUseRecentGeneratedImagesAsReferences(messages), true);
    assert.deepEqual(getDefaultImageReferenceUrls(messages), [
      generatedImageUrl,
      uploadedImageUrl,
    ]);
    assert.deepEqual(
      deriveAssistantChatDirectiveRequestOverrides({}, messages).activeTools,
      ["createImage"],
    );

    const officialAssistantFileUrl = "https://cdn.example.test/assistant-file.webp";
    const officialFileMessages = [
      {
        id: "assistant-file-image",
        role: "assistant",
        parts: [
          {
            type: "file",
            mediaType: "image/webp",
            url: officialAssistantFileUrl,
            filename: "assistant-file.webp",
          },
        ],
      },
      {
        id: "user-edit-file",
        role: "user",
        parts: [{ type: "text", text: "Edit the previous image into a warmer variant." }],
      },
    ];

    assert.deepEqual(getRecentGeneratedImageReferenceUrls(officialFileMessages), [
      officialAssistantFileUrl,
    ]);
    assert.deepEqual(getDefaultImageReferenceUrls(officialFileMessages), [
      officialAssistantFileUrl,
    ]);
    process.exit(0);
  `;

  execFileSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "--eval", script],
    { cwd: repoRoot, stdio: "pipe" },
  );
});

test("assistant multi-image product detail-page requests stay on official createImage n/images flow", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );
  const apiTest = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-chat.test.ts"),
    "utf8",
  );
  const imageTools = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-chat-image-tools.ts"),
    "utf8",
  );
  const toolSchemas = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-tool-schemas.ts"),
    "utf8",
  );

  assert.match(api, /\bMULTI_IMAGE_ASSET_REQUEST_PATTERN\b/);
  assert.match(api, /\bisAssistantChatMultiImageAssetRequest\b/);
  assert.match(api, /\bresolveAssistantChatRequestedImageCount\b/);
  assert.doesNotMatch(api, /\bMAX_ASSISTANT_CHAT_IMAGE_MEMORY_ITEMS\b/);
  assert.doesNotMatch(api, /\bMath\.min\(24,\s*options\.maxItems/);
  assert.match(api, /\/\(\s*\\d\+\s*\)\\s\*/);
  assert.doesNotMatch(api, /\\d\{1,2\}/);
  assert.match(api, /\bparseAssistantChatChineseImageCount\b/);
  assert.match(api, /\bCHINESE_IMAGE_COUNT_LARGE_UNITS\b/);
  assert.doesNotMatch(api, /\\u4e5d\\u5341\]\{1,3\}/);
  assert.match(api, /\bshouldUseRecentUserImagesForImageAssetRequest\b/);
  assert.match(api, /\["listStudioSkills",\s*"planStudioWorkflow",\s*"createImage"\]/);
  assert.match(api, /\bASSISTANT_CHAT_STUDIO_SKILLS_SYSTEM_HINT\b/);
  assert.match(api, /\bASSISTANT_CHAT_STUDIO_WORKFLOW_PLAN_SYSTEM_HINT\b/);
  assert.match(api, /\bresolveAssistantChatStudioWorkflowPrepareStep\b/);
  assert.match(api, /\bprepareStep:\s*\(\{\s*stepNumber,\s*steps\s*\}\)\s*=>/);
  assert.match(api, /\bstudioWorkflowPlanningRequired\b/);
  assert.match(api, /\bASSISTANT_CHAT_STUDIO_WORKFLOW_PLANNING_TOOLS\b/);
  assert.match(api, /activeTools:\s*planningTools/);
  assert.match(api, /\bstudioSkillsToolAvailable\b/);
  assert.match(api, /\bstudioWorkflowPlanToolAvailable\b/);
  assert.match(api, /\bisAssistantChatFilePartSupportedByModel\b/);
  assert.match(api, /\bstrippedUnsupportedFilePartCount\b/);
  assert.match(api, /generic AI SDK file parts/);
  assert.match(api, /\bpreserveLatestUserImages\b/);
  assert.match(api, /\bshouldPreserveMessageImages\b/);
  assert.match(api, /stripOversizedImageFilePartsForModelMessages\(\s*validatedMessages,\s*\{\s*provider,\s*modelId\s*\}/);
  assert.match(api, /\bgetRecentUserImageReferenceUrls\(messages\)/);
  assert.doesNotMatch(api, /\bgetRecentUserImageReferenceUrls\(messages,\s*\{\s*maxImages:\s*8\s*\}\)/);
  assert.match(api, /\bminimumCount:\s*requestedImageCountFromText\b/);
  assert.match(api, /First write a concise user-visible plan/);
  assert.match(api, /separate images rather than one collage/);
  assert.doesNotMatch(api, /from\s+["']\.\.\/services\/skills/);
  assert.doesNotMatch(api, /from\s+["']\.\.\/services\/agents/);

  assert.match(imageTools, /\bminimumCount\?:\s*number\s*\|\s*null/);
  assert.match(imageTools, /\bn:\s*imageCount\b/);
  assert.doesNotMatch(imageTools, /\bMAX_IMAGES_PER_GENERATE_IMAGE_CALL\b/);
  assert.doesNotMatch(imageTools, /\bmaxImagesPerCall:\s*4\b/);
  assert.match(imageTools, /\bimages:\s*resolvedReferenceImages\b/);
  assert.match(imageTools, /\bMath\.max\(minimumCount,\s*normalizeImageCount\(input\.count,\s*defaultCount\)\)/);
  assert.match(toolSchemas, /separate images to generate/);
  assert.match(toolSchemas, /instead of asking for one collage\/grid image/);
  assert.match(toolSchemas, /does not impose a project-level maximum/);
  assert.match(toolSchemas, /count:\s*z\s*\.\s*number\(\)\s*\.\s*int\(\)\s*\.\s*min\(1\)\s*\.\s*optional\(\)/);
  assert.doesNotMatch(toolSchemas, /count:\s*z\s*\.\s*number\(\)[\s\S]{0,120}\.max\(/);
  assert.match(toolSchemas, /imageCount:\s*z\s*\.\s*number\(\)\s*\.\s*int\(\)\s*\.\s*min\(1\)\s*\.\s*optional\(\)/);
  assert.doesNotMatch(toolSchemas, /imageCount:\s*z\s*\.\s*number\(\)[\s\S]{0,120}\.max\(/);
  assert.doesNotMatch(toolSchemas, /\.max\(8\)/);
  assert.doesNotMatch(toolSchemas, /Maximum number of matching|Maximum number of local/);
  assert.match(apiTest, /\bresolveAssistantChatStudioWorkflowPrepareStep\b/);
  assert.match(apiTest, /activeTools:\s*\["listStudioSkills",\s*"planStudioWorkflow"\]/);
  assert.match(apiTest, /toolChoice:\s*"required"/);
});

test("assistant sidebar image count is not capped by project UI state", () => {
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );
  const imageSettings = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-image-settings-interactable.ts"),
    "utf8",
  );
  const imageSettingsTest = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-image-settings-interactable.test.ts"),
    "utf8",
  );
  const sidebarTypes = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebar.types.ts"),
    "utf8",
  );
  const store = readFileSync(join(repoRoot, "stores/agent.store.ts"), "utf8");
  const legacyWorkflowUi = readFileSync(
    join(repoRoot, "pages/Workspace/components/workflow/ClothingStudioCards.tsx"),
    "utf8",
  );
  const workspace = readFileSync(join(repoRoot, "pages/Workspace.tsx"), "utf8");
  const ecommerceWorkflowController = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts"),
    "utf8",
  );
  const imageRequestNegotiator = readFileSync(
    join(repoRoot, "services/image-generation/request-negotiator.ts"),
    "utf8",
  );
  const legacyImageSkillFiles = [
    "services/agents/enhanced-base-agent.ts",
    "services/skills/generate-model.skill.ts",
    "services/skills/amazon-listing.skill.ts",
    "services/skills/cn-detail-page.skill.ts",
    "services/skills/clothing-studio.skill.ts",
    "services/skills/clothing-studio-workflow.skill.ts",
    "services/skills/ecom-oneclick-workflow.skill.ts",
  ]
    .map((file) => readFileSync(join(repoRoot, file), "utf8"))
    .join("\n");
  const paths = readProjectSources().map((file) => file.path);

  assert.match(runtime, /\bIMAGE_COUNT_QUICK_OPTIONS\s*=\s*\[1,\s*2,\s*4,\s*8,\s*16,\s*32\]/);
  assert.equal(paths.includes("pages/Workspace/components/InputAreaBottomToolbar.tsx"), false);
  assert.match(
    readFileSync(join(repoRoot, "pages/Workspace/components/WorkspaceImageConfigPanel.tsx"), "utf8"),
    /\bIMAGE_COUNT_QUICK_OPTIONS\s*=\s*\[1,\s*2,\s*4,\s*8,\s*16,\s*32\]/,
  );
  assert.match(
    readFileSync(join(repoRoot, "pages/Workspace/components/WorkspaceTreePromptNode.tsx"), "utf8"),
    /\bIMAGE_COUNT_QUICK_OPTIONS\s*=\s*\[1,\s*2,\s*4,\s*8,\s*16,\s*32\]/,
  );
  assert.match(runtime, /type=["']number["'][\s\S]*?min=\{1\}[\s\S]*?step=\{1\}/);
  assert.match(runtime, /不限上限/);
  assert.match(runtime, /const\s+currentSummary\s*=/);
  assert.match(runtime, /import\s+\{\s*Button\s*\}\s+from\s+["']@\/components\/ui\/button["']/);
  assert.match(runtime, /import\s+\{\s*Input\s*\}\s+from\s+["']@\/components\/ui\/input["']/);
  assert.match(runtime, /<select[\s\S]*?aria-label=["']图片生成模型["']/);
  assert.doesNotMatch(runtime, /当前请求会使用/);
  assert.doesNotMatch(runtime, /aria-label=["']图片生成张数["'][\s\S]{0,200}\bmax=/);
  assert.match(imageSettings, /count:\s*z\s*\.\s*number\(\)\s*\.\s*int\(\)\s*\.\s*min\(1\)/);
  assert.match(imageSettings, /\breturn\s+Math\.max\(1,\s*Math\.floor\(numeric\)\)/);
  assert.match(imageSettingsTest, /preserves arbitrary positive image counts/);
  assert.match(sidebarTypes, /\bimageGenCount:\s*number\b/);
  assert.match(sidebarTypes, /\bsetImageGenCount:\s*\(value:\s*number\)\s*=>\s*void\b/);
  assert.match(store, /\bimageGenCount:\s*number\b/);
  assert.match(imageRequestNegotiator, /\bn:\s*normalizeMinimumCount\(input\.n,\s*1\)/);
  assert.match(imageRequestNegotiator, /\bn:\s*normalized\.n\b/);
  assert.doesNotMatch(runtime, /\bIMAGE_COUNT_OPTIONS\s*=\s*\[1,\s*2,\s*3,\s*4\]/);
  assert.doesNotMatch(imageSettings, /z\.union\(\[z\.literal\(1\),\s*z\.literal\(2\),\s*z\.literal\(3\),\s*z\.literal\(4\)\]\)/);
  assert.doesNotMatch(imageSettings, /\bnumeric\s*>=\s*4[\s\S]{0,80}return\s+4/);
  assert.doesNotMatch(sidebarTypes, /\bimageGenCount:\s*1\s*\|\s*2\s*\|\s*3\s*\|\s*4\b/);
  assert.doesNotMatch(store, /\bimageGenCount:\s*1\s*\|\s*2\s*\|\s*3\s*\|\s*4\b/);
  assert.doesNotMatch(imageRequestNegotiator, /\bn:\s*normalizeBoundedCount\(input\.n,/);
  assert.doesNotMatch(imageRequestNegotiator, /\bn:\s*normalize\w*Count\(input\.n,\s*1,\s*(?:4|8|10|12)\)/);
  assert.doesNotMatch(
    readFileSync(join(repoRoot, "types/agent.types.ts"), "utf8"),
    /\bpreferredImageCount\??:\s*1\s*\|\s*2\s*\|\s*3\s*\|\s*4\b/,
  );
  assert.doesNotMatch(
    readFileSync(
      join(repoRoot, "services/vision-orchestrator/style-library-draft.ts"),
      "utf8",
    ),
    /imageCount:\s*["']["']\s*\|\s*["']1["']\s*\|\s*["']2["']\s*\|\s*["']3["']\s*\|\s*["']4["']/,
  );
  assert.doesNotMatch(
    readFileSync(
      join(repoRoot, "services/vision-orchestrator/style-library.ts"),
      "utf8",
    ),
    /imageCount\s*===\s*1\s*\|\|\s*imageCount\s*===\s*2\s*\|\|\s*imageCount\s*===\s*3\s*\|\|\s*imageCount\s*===\s*4/,
  );
  assert.doesNotMatch(legacyImageSkillFiles, /\bpreferredImageCount[\s\S]{0,200}\bMath\.min\(4,/);
  assert.doesNotMatch(legacyImageSkillFiles, /\bcount:\s*z\s*\.\s*number\(\)\s*\.\s*int\(\)\s*\.\s*min\(1\)\s*\.max\((?:4|8|10|12)\)/);
  assert.doesNotMatch(legacyImageSkillFiles, /\bimageCount:\s*z\s*\.\s*number\(\)\s*\.\s*int\(\)\s*\.\s*min\(1\)\s*\.max\(12\)/);
  assert.doesNotMatch(legacyImageSkillFiles, /\bMath\.min\(Math\.max\(imageCount,\s*1\),\s*12\)/);
  assert.doesNotMatch(legacyImageSkillFiles, /\bMath\.min\((?:4|8|10|12),\s*Number\((?:params|item)\.count/);
  assert.doesNotMatch(legacyImageSkillFiles, /\bMath\.min\(\s*(?:count|preferredImageCount)[\s\S]{0,80},\s*(?:4|8|10|12)\s*\)/);
  assert.doesNotMatch(legacyWorkflowUi, /\bmax=\{(?:4|8|10|12)\}/);
  assert.doesNotMatch(legacyWorkflowUi, /\bMath\.min\((?:4|8|10|12),[\s\S]{0,120}(?:count|Number\(e\.target\.value\)|form\.count)/);
  assert.doesNotMatch(workspace, /\bMath\.min\((?:4|8|10|12),[\s\S]{0,120}clothingState\.requirements\.count/);
  assert.doesNotMatch(ecommerceWorkflowController, /\bPLAN_ITEMS_MAX_PER_GROUP\b/);
  assert.doesNotMatch(ecommerceWorkflowController, /\bMath\.min\(PLAN_ITEMS_MAX_PER_GROUP,/);
});

test("workspace initial prompt bootstrap uses official assistant-ui composer, not legacy send hook", () => {
  const workspace = readFileSync(join(repoRoot, "pages/Workspace.tsx"), "utf8");
  const home = readFileSync(join(repoRoot, "pages/Home.tsx"), "utf8");
  const projectLoader = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceProjectLoader.ts"),
    "utf8",
  );
  const conversationPersistence = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceConversationPersistence.ts"),
    "utf8",
  );
  const runtimeAssetPreferences = readFileSync(
    join(repoRoot, "services/runtime-assets/preferences.ts"),
    "utf8",
  );
  const sidebarTypes = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebar.types.ts"),
    "utf8",
  );
  const sidebarProps = readFileSync(
    join(repoRoot, "pages/Workspace/controllers/useWorkspaceSidebarProps.ts"),
    "utf8",
  );
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );

  assert.doesNotMatch(workspace, /import\s+\{\s*useWorkspaceSend\s*\}/);
  assert.doesNotMatch(workspace, /import\s+\{\s*useWorkspaceSmartGenerate\s*\}/);
  assert.doesNotMatch(workspace, /import\s+\{\s*useAgentOrchestrator\s*\}/);
  assert.doesNotMatch(workspace, /\bconst\s+handleSend\s*=\s*useWorkspaceSend\s*\(/);
  assert.doesNotMatch(workspace, /\bconst\s+handleSmartGenerate\s*=\s*useWorkspaceSmartGenerate\s*\(/);
  assert.doesNotMatch(workspace, /\bprocessMessage\b/);
  assert.doesNotMatch(workspace, /\bcurrentTask\b|\bisUploadingAttachments\b/);
  assert.doesNotMatch(workspace, /\bexecuteProposal\b/);
  assert.equal(
    existsSync(join(repoRoot, "pages/Workspace/controllers/useWorkspaceSmartGenerate.ts")),
    false,
  );
  assert.doesNotMatch(projectLoader, /\bhandleSend\b/);
  assert.doesNotMatch(projectLoader, /\bChatSendOptions\b/);
  assert.doesNotMatch(home, /\binitialSkillData\b/);
  assert.doesNotMatch(home, /\binitialModelMode\b/);
  assert.doesNotMatch(home, /\binitialWebEnabled\b/);
  assert.doesNotMatch(home, /\binitialImageModel\b/);
  assert.doesNotMatch(home, /\binitialCreationMode\b/);
  assert.doesNotMatch(home, /\bChatMessage\b/);
  assert.doesNotMatch(home, /\bgetActiveQuickSkillPreference\b/);
  assert.doesNotMatch(
    `${workspace}\n${projectLoader}\n${conversationPersistence}\n${runtimeAssetPreferences}`,
    /\b(?:get|set)ActiveQuickSkillPreference\b|\bpersistedActiveQuickSkill\b|\bactiveQuickSkill:\s*persistedActiveQuickSkill\b/,
  );
  assert.equal(
    existsSync(join(repoRoot, "pages/Workspace/controllers/activeQuickSkillPreference.ts")),
    false,
  );
  assert.equal(
    existsSync(join(repoRoot, "pages/Workspace/controllers/activeQuickSkillPreference.test.ts")),
    false,
  );
  assert.doesNotMatch(home, /\bHomeModelPreferencePopover\b/);
  assert.doesNotMatch(home, /\buseWorkspaceModelPreferences\b/);
  assert.doesNotMatch(projectLoader, /\binitialSkillData\b/);
  assert.doesNotMatch(projectLoader, /\binitialModelMode\b/);
  assert.doesNotMatch(projectLoader, /\binitialWebEnabled\b/);
  assert.doesNotMatch(projectLoader, /\binitialImageModel\b/);
  assert.doesNotMatch(projectLoader, /\binitialCreationMode\b/);
  assert.doesNotMatch(projectLoader, /\bcreateInputBlockId\b/);
  assert.doesNotMatch(projectLoader, /\bsetInputBlocks\(blocks\)/);
  assert.match(projectLoader, /\bconst\s+initialConversationId\s*=\s*createConversationId\(\)/);
  assert.match(projectLoader, /\bconst\s+initialConversation:\s*ConversationSession\s*=/);
  assert.match(projectLoader, /\bassistantThread:\s*\{\s*headId:\s*null,\s*messages:\s*\[\]/);
  assert.match(projectLoader, /\bsetConversations\(\[initialConversation\]\)/);
  assert.match(projectLoader, /\bsetActiveConversationId\(initialConversationId\)/);
  assert.match(projectLoader, /\bconversations:\s*\[initialConversation\]/);
  assert.match(projectLoader, /\bsetAssistantBootstrapRequest\?\.\(\{/);
  assert.match(
    workspace,
    /navigate\(location\.pathname,\s*\{\s*replace:\s*true,\s*state:\s*null/,
  );
  assert.match(sidebarTypes, /\bexport\s+type\s+AssistantSidebarBootstrapRequest\b/);
  assert.match(sidebarProps, /\bbootstrapRequest:\s*assistantBootstrapRequest\b/);
  assert.match(runtime, /\bprops\.bootstrapRequest\b/);
  assert.match(runtime, /\bbootstrap_send_start\b/);
  assert.match(runtime, /\bawait\s+waitForThreadListHydration\(\)/);
  assert.match(runtime, /\bbootstrapRequestInFlightIdRef\.current\s*===\s*request\.id\b/);
  assert.match(runtime, /\bbootstrapMountedRef\.current\s*=\s*true\b/);
  assert.match(runtime, /\bbootstrapMountedRef\.current\s*=\s*false\b/);
  assert.match(runtime, /\bcurrentRuntime\.thread\.composer\b/);
  assert.match(runtime, /\bcomposer\.addAttachment\(/);
  assert.match(runtime, /\bcomposer\.send\(\{\s*startRun:\s*true\s*\}\)/);
  assert.match(runtime, /\bbootstrap_send_sent\b/);
  assert.match(runtime, /\bbootstrap_send_failed\b/);
  assert.doesNotMatch(runtime, /\bgetLoadThreadsPromise\(\)/);
  const bootstrapSendIndex = runtime.indexOf(
    "composer.send({ startRun: true })",
  );
  const bootstrapConsumeIndex = runtime.indexOf(
    "consumedBootstrapRequestIdRef.current = request.id",
  );
  assert.ok(bootstrapSendIndex >= 0);
  assert.ok(bootstrapConsumeIndex > bootstrapSendIndex);
});

test("assistant Studio skills catalog is a read-only official tool, not the legacy skill runtime", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );
  const studioSkills = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-chat-studio-skills.ts"),
    "utf8",
  );
  const frontendToolkit = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolkit.tsx"),
    "utf8",
  );
  const backendToolkit = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-server-toolkit.ts"),
    "utf8",
  );
  const toolUis = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolUis.tsx"),
    "utf8",
  );

  assert.match(studioSkills, /from\s+["']ai["'][\s\S]*\btool\b/);
  assert.match(studioSkills, /studio-registry\.json/);
  assert.match(studioSkills, /\blistStudioSkills:\s*tool\(/);
  assert.match(studioSkills, /\bplanStudioWorkflow:\s*tool\(/);
  assert.match(studioSkills, /\bconst\s+workflowType\s*=\s*resolveWorkflowType\(/);
  assert.match(studioSkills, /\bworkflowType,\s*\n\s*request,/);
  assert.match(studioSkills, /\bdeliverables\s*=\s*Array\.from\(\{\s*length:\s*imageCount\s*\}\)/);
  assert.match(studioSkills, /\breturn\s+Math\.max\(1,\s*Math\.floor\(numeric\)\)/);
  assert.doesNotMatch(studioSkills, /\bMath\.min\(8,\s*Math\.floor\(Number\(input\.limit\)/);
  assert.doesNotMatch(studioSkills, /\bMath\.min\(4,\s*Math\.floor\(numeric\)\)/);
  assert.match(studioSkills, /\bcreateImageGuidance:\s*\{[\s\S]*?\brecommendedInput:\s*\{/);
  assert.match(studioSkills, /Use the deliverables array as the generation contract/);
  assert.match(studioSkills, /Do not create one collage, four-grid, contact sheet, or multi-panel single image/);
  assert.match(frontendToolkit, /\blistStudioSkills:\s*\{[\s\S]*execute:\s*externalTool\(\)[\s\S]*render:\s*ListStudioSkillsToolUI/);
  assert.match(frontendToolkit, /\bplanStudioWorkflow:\s*\{[\s\S]*execute:\s*externalTool\(\)[\s\S]*render:\s*PlanStudioWorkflowToolUI/);
  assert.match(backendToolkit, /\bstudioSkillTools\?:\s*ToolSet/);
  assert.match(backendToolkit, /\blistStudioSkillsTool\b/);
  assert.match(backendToolkit, /\bplanStudioWorkflowTool\b/);
  assert.match(api, /\bcreateAssistantChatStudioSkillTools\b/);
  assert.match(api, /\.\.\.studioSkillTools\.tools/);
  assert.match(toolUis, /\bexport\s+const\s+ListStudioSkillsToolUI\b/);
  assert.match(toolUis, /\bexport\s+const\s+PlanStudioWorkflowToolUI\b/);
  assert.match(toolUis, /\bconst\s+studioWorkflowDeliverableSchema\s*=\s*z\b/);
  assert.match(toolUis, /\bdeliverables:\s*z\.array\(studioWorkflowDeliverableSchema\)\.optional\(\)/);
  assert.match(toolUis, /\bconst\s+deliverables\s*=\s*Array\.isArray\(toolResult\?\.deliverables\)/);
  assert.match(toolUis, /\bimageParts\.map\(\(part,\s*index\)\s*=>/);
  assert.doesNotMatch(toolUis, /\bimageParts\.slice\(0,\s*4\)/);
  assert.doesNotMatch(toolUis, /Showing 4 of/);
  assert.match(toolUis, /createImage 输入建议/);
  assert.match(toolUis, /\brecommendedInput\?\.negativeInstruction\b/);
  assert.doesNotMatch(studioSkills, /services\/skills|services\/agents|executeSkill|skillData|agentData|ChatMessage/);
  assert.doesNotMatch(frontendToolkit, /services\/skills|services\/agents|executeSkill|skillData|agentData|ChatMessage/);
  assert.doesNotMatch(backendToolkit, /services\/skills|services\/agents|executeSkill|skillData|agentData|ChatMessage/);
});

test("assistant workspace knowledge search is a read-only AI SDK tool, not legacy workspaceSearch", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );
  const knowledgeTool = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-chat-workspace-knowledge.ts"),
    "utf8",
  );
  const frontendToolkit = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolkit.tsx"),
    "utf8",
  );
  const backendToolkit = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-server-toolkit.ts"),
    "utf8",
  );
  const toolUis = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolUis.tsx"),
    "utf8",
  );

  assert.match(knowledgeTool, /from\s+["']ai["'][\s\S]*\btool\b/);
  assert.match(knowledgeTool, /\breadFile\b/);
  assert.match(knowledgeTool, /\bstudio-assets\b/);
  assert.match(knowledgeTool, /\bstudio-skills\b/);
  assert.match(knowledgeTool, /\bknowledge\b/);
  assert.match(knowledgeTool, /\bsearchWorkspaceKnowledge:\s*tool\(/);
  assert.match(frontendToolkit, /\bsearchWorkspaceKnowledge:\s*\{[\s\S]*execute:\s*externalTool\(\)[\s\S]*render:\s*SearchWorkspaceKnowledgeToolUI/);
  assert.match(backendToolkit, /\bworkspaceKnowledgeTools\?:\s*ToolSet/);
  assert.match(backendToolkit, /\bsearchWorkspaceKnowledgeTool\b/);
  assert.match(api, /\bcreateAssistantChatWorkspaceKnowledgeTools\b/);
  assert.match(api, /\bextractAssistantChatWorkspaceKnowledgeSources\b/);
  assert.match(api, /\.\.\.workspaceKnowledgeTools\.tools/);
  assert.match(api, /\bworkspace_knowledge_sources_injected\b/);
  assert.match(api, /type:\s*["']source-document["']/);
  assert.match(api, /mediaType:\s*["']text\/markdown["']/);
  assert.match(toolUis, /\bexport\s+const\s+SearchWorkspaceKnowledgeToolUI\b/);
  assert.doesNotMatch(knowledgeTool, /\bMAX_MATCHES\b/);
  assert.doesNotMatch(knowledgeTool, /\bMath\.min\(MAX_MATCHES,/);
  assert.doesNotMatch(knowledgeTool, /\bsources\.slice\(0,\s*8\)/);
  assert.doesNotMatch(knowledgeTool, /workspace-search\.skill|runResearchSearch|services\/skills|services\/agents|executeSkill|skillData|agentData|ChatMessage/);
  assert.doesNotMatch(frontendToolkit, /workspace-search\.skill|runResearchSearch|services\/skills|services\/agents|executeSkill|skillData|agentData|ChatMessage/);
  assert.doesNotMatch(backendToolkit, /workspace-search\.skill|runResearchSearch|services\/skills|services\/agents|executeSkill|skillData|agentData|ChatMessage/);
});

test("assistant chat web search citations use official AI SDK source parts", () => {
  const api = readFileSync(
    join(repoRoot, "api/assistant-chat.ts"),
    "utf8",
  );
  const thread = readFileSync(
    join(repoRoot, "components/assistant-ui/thread.tsx"),
    "utf8",
  );
  const sources = readFileSync(
    join(repoRoot, "components/assistant-ui/sources.tsx"),
    "utf8",
  );
  const toolUis = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolUis.tsx"),
    "utf8",
  );
  const searchStart = toolUis.indexOf("export const WorkspaceSearchToolUI");
  const nativeSearchStart = toolUis.indexOf("export const NativeWebSearchToolUI");
  const searchBlock = toolUis.slice(searchStart, nativeSearchStart);

  assert.match(api, /\bsendSources:\s*true\b/);
  assert.match(api, /\bextractAssistantChatWebSearchSources\(chunk\.output\)/);
  assert.match(api, /\btype:\s*["']source-url["']/);
  assert.match(api, /\bsearch_sources_injected\b/);
  assert.match(thread, /\bsource:\s*\[\s*["']group-sources["']\s*\]/);
  assert.match(thread, /case\s+["']source["']:\s*return\s+<Sources\s+\{\.\.\.part\}\s*\/>/);
  assert.match(sources, /\bSourceMessagePartComponent\b/);
  assert.match(sources, /part\.sourceType\s*===\s*["']url["']/);
  assert.match(sources, /part\.sourceType\s*===\s*["']document["']/);
  assert.match(sources, /\bgetDocumentSourceTitle\b/);
  assert.match(sources, /part\.title\s*\|\|\s*part\.filename\s*\|\|\s*\(part\.id\s*\?\s*`Document \$\{part\.id\}`\s*:\s*["']Document["']\)/);
  assert.match(searchBlock, /来源会显示在助手回复下方。/);
  assert.doesNotMatch(searchBlock, /\bnormalizedResult\.results\.map\b/);
  assert.doesNotMatch(searchBlock, /<a\s+[\s\S]*?href=\{item\.url\}/);
});

test("assistant chat Tavily research tools use official AI SDK package and assistant-ui toolkit path", () => {
  const webSearch = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-chat-web-search.ts"),
    "utf8",
  );
  const frontendToolkit = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolkit.tsx"),
    "utf8",
  );
  const backendToolkit = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-server-toolkit.ts"),
    "utf8",
  );
  const toolSchemas = readFileSync(
    join(repoRoot, "services/assistant-ui/assistant-sidebar-tool-schemas.ts"),
    "utf8",
  );
  const toolUis = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarToolUis.tsx"),
    "utf8",
  );

  assert.match(webSearch, /from\s+["']@tavily\/ai-sdk["']/);
  assert.match(webSearch, /\btavilySearch\(\{/);
  assert.match(webSearch, /\btavilyExtract\(\{/);
  assert.match(webSearch, /\btavilyCrawl\(\{/);
  assert.match(webSearch, /\btavilyMap\(\{/);
  assert.match(webSearch, /\bproviderType\s*===\s*["']tavily["']/);
  assert.doesNotMatch(webSearch, /\bMath\.min\(10,/);
  assert.doesNotMatch(webSearch, /\bcitations\.slice\(0,\s*8\)/);
  assert.doesNotMatch(webSearch, /\btoMaxResults\([^)]*,\s*6,\s*10\)/);
  assert.doesNotMatch(toolSchemas, /urls:\s*z[\s\S]{0,160}\.max\(8\)/);

  for (const [toolName, schemaName, renderName] of [
    [
      "tavilyExtract",
      "assistantSidebarTavilyExtractParameters",
      "TavilyExtractToolUI",
    ],
    [
      "tavilyCrawl",
      "assistantSidebarTavilyCrawlParameters",
      "TavilyCrawlToolUI",
    ],
    [
      "tavilyMap",
      "assistantSidebarTavilyMapParameters",
      "TavilyMapToolUI",
    ],
  ] as const) {
    assert.match(toolSchemas, new RegExp(`export\\s+const\\s+${schemaName}\\b`));
    assert.match(
      frontendToolkit,
      new RegExp(
        `${toolName}:\\s*\\{[\\s\\S]*?parameters:\\s*${schemaName}[\\s\\S]*?execute:\\s*externalTool\\(\\)[\\s\\S]*?render:\\s*${renderName}`,
      ),
    );
    assert.match(
      backendToolkit,
      new RegExp(`${toolName}Tool\\s*=\\s*toBackendToolkitEntry`),
    );
    assert.match(
      backendToolkit,
      new RegExp(
        `\\.\\.\\.\\(\\s*${toolName}Tool\\s*\\?\\s*\\{\\s*${toolName}:\\s*${toolName}Tool\\s*\\}`,
      ),
    );
    assert.match(toolUis, new RegExp(`export\\s+const\\s+${renderName}\\b`));
  }

  assert.match(toolUis, /\bconst\s+tavilyResearchToolResultSchema\s*=\s*z\b/);
  assert.match(toolUis, /\btavilyResearchToolResultSchema\.safeParse\(result\)/);
  assert.match(toolUis, /\bconst\s+TavilyResearchToolUI\b/);
  assert.match(toolUis, /\bextractTavilyResearchItems\(toolResult\)/);

  assert.doesNotMatch(webSearch, /services\/research|\/api\/search|workspaceSearch|runResearchSearch|services\/skills|services\/agents|executeSkill|skillData|agentData|ChatMessage/);
  assert.doesNotMatch(frontendToolkit, /services\/research|\/api\/search|workspaceSearch|runResearchSearch|services\/skills|services\/agents|executeSkill|skillData|agentData|ChatMessage/);
  assert.doesNotMatch(backendToolkit, /services\/research|\/api\/search|workspaceSearch|runResearchSearch|services\/skills|services\/agents|executeSkill|skillData|agentData|ChatMessage/);
});

test("assistant sidebar logs selected image provider model and locked panel settings", () => {
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );

  assert.match(runtime, /\bimageProviderId:\s*imageGenerationConfig\.provider\.id/);
  assert.match(runtime, /\bimageProviderName:\s*imageGenerationConfig\.provider\.name/);
  assert.match(runtime, /\bimageModelId:\s*imageGenerationConfig\.modelId/);
  assert.match(runtime, /\bimageAspectRatio:\s*imageGenerationConfig\.aspectRatio/);
  assert.match(runtime, /\bimageResolution:\s*imageGenerationConfig\.resolution/);
  assert.match(runtime, /\bimageCount:\s*imageGenerationConfig\.count/);
  assert.match(runtime, /\bimageSettingsLocked:\s*imageGenerationConfig\.enforceSettings\s*===\s*true/);
  assert.match(runtime, /\bimageGenerationConfig\.aspectRatio,/);
  assert.match(runtime, /\bimageGenerationConfig\.resolution,/);
  assert.match(runtime, /\bimageGenerationConfig\.count,/);
  assert.match(runtime, /\bimageGeneration:\s*imageGenerationConfig/);
  assert.match(runtime, /\bimageAspectRatio:\s*parsed\.imageGeneration\?\.aspectRatio\s*\|\|\s*undefined/);
  assert.match(runtime, /\bimageResolution:\s*parsed\.imageGeneration\?\.resolution\s*\|\|\s*undefined/);
  assert.match(runtime, /\bimageSettingsLocked:\s*parsed\.imageGeneration\?\.enforceSettings\s*===\s*true/);
});

test("assistant sidebar logs selected web search provider and defaults", () => {
  const runtime = readFileSync(
    join(repoRoot, "pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx"),
    "utf8",
  );

  assert.match(runtime, /\bwebSearchActiveProviderId:\s*webSearchConfig\.activeProviderId/);
  assert.match(runtime, /\bwebSearchProviderId:\s*webSearchConfig\.provider\?\.id/);
  assert.match(runtime, /\bwebSearchProviderName:\s*webSearchConfig\.provider\?\.name/);
  assert.match(runtime, /\bwebSearchProviderType:\s*[\s\S]*webSearchConfig\.provider\?\.providerType[\s\S]*webSearchConfig\.provider\?\.catalogId/);
  assert.match(runtime, /\bwebSearchProviderBaseUrl:\s*summarizeProviderBaseUrl\(\s*webSearchConfig\.provider\?\.baseUrl/);
  assert.match(runtime, /\bwebSearchMode:\s*webSearchConfig\.defaults\?\.mode/);
  assert.match(runtime, /\bwebSearchWebCount:\s*webSearchConfig\.defaults\?\.webCount/);
  assert.match(runtime, /\bwebSearchImageCount:\s*webSearchConfig\.defaults\?\.imageCount/);
  assert.match(runtime, /\bwebSearchTimeRange:\s*webSearchConfig\.defaults\?\.timeRange/);
  assert.match(runtime, /\bwebSearchCompressionMode:\s*webSearchConfig\.defaults\?\.compressionMode/);
  assert.match(runtime, /\bwebSearchActiveProviderId:\s*parsed\.webSearch\?\.activeProviderId\s*\|\|\s*undefined/);
  assert.match(runtime, /\bwebSearchProviderType:\s*[\s\S]*parsed\.webSearch\?\.provider\?\.providerType[\s\S]*parsed\.webSearch\?\.provider\?\.catalogId/);
  assert.match(runtime, /\bwebSearchMode:\s*parsed\.webSearch\?\.defaults\?\.mode\s*\|\|\s*undefined/);
});

test("inspiration pages reshuffle per page load and refresh their synced data", () => {
  const home = readFileSync(join(repoRoot, "pages/Home.tsx"), "utf8");
  const inspirationPage = readFileSync(
    join(repoRoot, "pages/GptImageInspiration.tsx"),
    "utf8",
  );
  const inspirationService = readFileSync(
    join(repoRoot, "services/gpt-image-inspiration.ts"),
    "utf8",
  );
  const viteConfig = readFileSync(join(repoRoot, "vite.config.ts"), "utf8");

  assert.match(home, /\bcreateGptImageInspirationShuffleSeed\b/);
  assert.match(home, /\bshuffleGptImageInspirationCases\b/);
  assert.doesNotMatch(home, /\bgetDailyInspirationSeed\b|\bseededRandom\b/);
  assert.match(inspirationPage, /\bcreateGptImageInspirationShuffleSeed\b/);
  assert.match(inspirationPage, /\bshuffleGptImageInspirationCases\b/);
  assert.match(inspirationService, /\?v=\$\{Date\.now\(\)\}/);
  assert.match(
    inspirationService,
    /\bGPT_IMAGE_INSPIRATION_REFRESH_INTERVAL_MS\b/,
  );
  assert.match(viteConfig, /\bgptImageInspirationDevSyncPlugin\b/);
  assert.match(viteConfig, /scripts\/sync-gpt-image-inspiration\.mjs/);
  assert.equal(
    existsSync(
      join(repoRoot, ".github/workflows/sync-gpt-image-inspiration.yml"),
    ),
    true,
  );
});

test("Vercel api directory stays within the Hobby function limit", () => {
  const collectApiEntrypoints = (directory: string): string[] =>
    readdirSync(directory).flatMap((entry) => {
      const fullPath = join(directory, entry);
      return statSync(fullPath).isDirectory()
        ? collectApiEntrypoints(fullPath)
        : hasSourceExtension(fullPath)
          ? [fullPath]
          : [];
    });

  const apiEntrypoints = collectApiEntrypoints(join(repoRoot, "api"));

  assert.ok(
    apiEntrypoints.length <= 12,
    `Vercel Hobby supports at most 12 functions, found ${apiEntrypoints.length}: ${apiEntrypoints
      .map((path) => relative(repoRoot, path).split(sep).join("/"))
      .join(", ")}`,
  );

  for (const entrypoint of apiEntrypoints) {
    assert.match(
      readFileSync(entrypoint, "utf8"),
      /export\s+default\s+async\s+function\s+handler\b/,
      `${relative(repoRoot, entrypoint)} is not a Vercel function entrypoint`,
    );
  }
});
