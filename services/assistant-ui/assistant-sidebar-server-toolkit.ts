import type { ToolSet } from "ai";
import type { ToolModelContentPart } from "assistant-stream";

import { defineMcpToolkit, defineToolkit } from "@assistant-ui/react";

import { createAssistantSidebarMcpToolkitDefinition } from "./assistant-sidebar-mcp-config.ts";

type AssistantSidebarServerToolkitOptions = {
  webSearchTools?: ToolSet;
  imageTools?: ToolSet;
  weatherTools?: ToolSet;
  studioSkillTools?: ToolSet;
  workspaceKnowledgeTools?: ToolSet;
};

type AssistantAiSdkToolLike = {
  description?: unknown;
  inputSchema?: unknown;
  execute?: ((args: unknown, context: unknown) => unknown | Promise<unknown>) | undefined;
  needsApproval?: unknown;
};

type ImageToolResultLike = {
  aspectRatio?: unknown;
  count?: unknown;
  images?: Array<{
    data?: unknown;
    image?: unknown;
    mediaType?: unknown;
    filename?: unknown;
    url?: unknown;
  }>;
  modelId?: unknown;
  prompt?: unknown;
  providerId?: unknown;
  providerName?: unknown;
  resolution?: unknown;
  size?: unknown;
};

const normalizeString = (value: unknown): string => String(value ?? "").trim();

const toBackendToolkitEntry = (
  tool: AssistantAiSdkToolLike | undefined,
  options: {
    toModelOutput?: ((options: {
      toolCallId: string;
      input: unknown;
      output: unknown;
    }) => readonly ToolModelContentPart[] | Promise<readonly ToolModelContentPart[]>) | undefined;
  } = {},
) => {
  if (!tool || typeof tool.execute !== "function" || !tool.inputSchema) {
    return undefined;
  }

  return {
    ...(typeof tool.description === "string" && tool.description.trim()
      ? { description: tool.description.trim() }
      : {}),
    parameters: tool.inputSchema,
    execute: tool.execute,
    ...(tool.needsApproval !== undefined ? { needsApproval: tool.needsApproval } : {}),
    ...(options.toModelOutput ? { toModelOutput: options.toModelOutput } : {}),
  };
};

const toAssistantImageModelOutput = ({
  output,
}: {
  toolCallId: string;
  input: unknown;
  output: unknown;
}): readonly ToolModelContentPart[] => {
  const images = Array.isArray((output as ImageToolResultLike | undefined)?.images)
    ? (output as ImageToolResultLike).images
    : [];

  const imageResult = (output || {}) as ImageToolResultLike;
  return [
    {
      type: "text" as const,
      text: [
        `Generated ${images.length} image${images.length === 1 ? "" : "s"}.`,
        normalizeString(imageResult.providerName) ||
        normalizeString(imageResult.providerId)
          ? `Provider: ${
              normalizeString(imageResult.providerName) ||
              normalizeString(imageResult.providerId)
            }.`
          : "",
        normalizeString(imageResult.modelId)
          ? `Model: ${normalizeString(imageResult.modelId)}.`
          : "",
        normalizeString(imageResult.size)
          ? `Size: ${normalizeString(imageResult.size)}.`
          : "",
        normalizeString(imageResult.aspectRatio)
          ? `Aspect ratio: ${normalizeString(imageResult.aspectRatio)}.`
          : "",
        normalizeString(imageResult.resolution)
          ? `Resolution: ${normalizeString(imageResult.resolution)}.`
          : "",
        "Images were returned to the UI as tool output and remain available to future createImage calls as references; image bytes are intentionally not included in the language-model tool result.",
        normalizeString(imageResult.prompt)
          ? `Prompt: ${normalizeString(imageResult.prompt)}`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
  ];
};

export const createAssistantSidebarServerToolkit = (
  options: AssistantSidebarServerToolkitOptions = {},
) => {
  const webSearchTool = toBackendToolkitEntry(
    options.webSearchTools?.webSearch as AssistantAiSdkToolLike | undefined,
  );
  const tavilyExtractTool = toBackendToolkitEntry(
    options.webSearchTools?.tavilyExtract as
      | AssistantAiSdkToolLike
      | undefined,
  );
  const tavilyCrawlTool = toBackendToolkitEntry(
    options.webSearchTools?.tavilyCrawl as AssistantAiSdkToolLike | undefined,
  );
  const tavilyMapTool = toBackendToolkitEntry(
    options.webSearchTools?.tavilyMap as AssistantAiSdkToolLike | undefined,
  );
  const createImageTool = toBackendToolkitEntry(
    options.imageTools?.createImage as AssistantAiSdkToolLike | undefined,
    {
      toModelOutput: toAssistantImageModelOutput,
    },
  );
  const getWeatherTool = toBackendToolkitEntry(
    options.weatherTools?.getWeather as AssistantAiSdkToolLike | undefined,
  );
  const listStudioSkillsTool = toBackendToolkitEntry(
    options.studioSkillTools?.listStudioSkills as
      | AssistantAiSdkToolLike
      | undefined,
  );
  const planStudioWorkflowTool = toBackendToolkitEntry(
    options.studioSkillTools?.planStudioWorkflow as
      | AssistantAiSdkToolLike
      | undefined,
  );
  const searchWorkspaceKnowledgeTool = toBackendToolkitEntry(
    options.workspaceKnowledgeTools?.searchWorkspaceKnowledge as
      | AssistantAiSdkToolLike
      | undefined,
  );

  return defineToolkit({
    ...defineMcpToolkit(createAssistantSidebarMcpToolkitDefinition()),
    ...(webSearchTool ? { webSearch: webSearchTool } : {}),
    ...(tavilyExtractTool ? { tavilyExtract: tavilyExtractTool } : {}),
    ...(tavilyCrawlTool ? { tavilyCrawl: tavilyCrawlTool } : {}),
    ...(tavilyMapTool ? { tavilyMap: tavilyMapTool } : {}),
    ...(createImageTool ? { createImage: createImageTool } : {}),
    ...(getWeatherTool ? { getWeather: getWeatherTool } : {}),
    ...(listStudioSkillsTool ? { listStudioSkills: listStudioSkillsTool } : {}),
    ...(planStudioWorkflowTool
      ? { planStudioWorkflow: planStudioWorkflowTool }
      : {}),
    ...(searchWorkspaceKnowledgeTool
      ? { searchWorkspaceKnowledge: searchWorkspaceKnowledgeTool }
      : {}),
  });
};
