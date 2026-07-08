"use generative";

import {
  defineToolkit,
  externalTool,
  providerTool,
  stubTool,
} from "@assistant-ui/react";

import {
  assistantSidebarCreateImageParameters,
  assistantSidebarCreateTargetElementParameters,
  assistantSidebarGetWeatherParameters,
  assistantSidebarListStudioSkillsParameters,
  assistantSidebarPlanStudioWorkflowParameters,
  assistantSidebarSearchWorkspaceKnowledgeParameters,
  assistantSidebarTavilyCrawlParameters,
  assistantSidebarTavilyExtractParameters,
  assistantSidebarTavilyMapParameters,
  assistantSidebarWebSearchParameters,
} from "../../../services/assistant-ui/assistant-sidebar-tool-schemas.ts";

import {
  CreateTargetElementToolUI,
  GenerateImageToolUI,
  ListStudioSkillsToolUI,
  NativeWebSearchToolUI,
  OpenAIImageGenerationToolUI,
  PlanStudioWorkflowToolUI,
  SearchWorkspaceKnowledgeToolUI,
  TavilyCrawlToolUI,
  TavilyExtractToolUI,
  TavilyMapToolUI,
  WeatherToolUI,
  WorkspaceSearchToolUI,
} from "./assistantSidebarToolUis.tsx";

export default defineToolkit({
  webSearch: {
    description: "Search the web with the configured AI SDK search provider.",
    display: "standalone",
    parameters: assistantSidebarWebSearchParameters,
    execute: externalTool(),
    render: WorkspaceSearchToolUI,
  },
  tavilyExtract: {
    description:
      "Extract structured page content from URLs with Tavily's AI SDK tool.",
    display: "standalone",
    parameters: assistantSidebarTavilyExtractParameters,
    execute: externalTool(),
    render: TavilyExtractToolUI,
  },
  tavilyCrawl: {
    description:
      "Crawl a website with Tavily's AI SDK tool when deeper page discovery is needed.",
    display: "standalone",
    parameters: assistantSidebarTavilyCrawlParameters,
    execute: externalTool(),
    render: TavilyCrawlToolUI,
  },
  tavilyMap: {
    description:
      "Map a website structure with Tavily's AI SDK tool before extracting or summarizing pages.",
    display: "standalone",
    parameters: assistantSidebarTavilyMapParameters,
    execute: externalTool(),
    render: TavilyMapToolUI,
  },
  web_search: {
    description: "Use the model provider's native web search.",
    display: "standalone",
    execute: providerTool({
      providerId: "openai.web_search",
      args: {
        externalWebAccess: true,
        searchContextSize: "medium",
      },
    }),
    render: NativeWebSearchToolUI,
  },
  google_search: {
    description: "Use Google Search grounding through the model provider.",
    display: "standalone",
    execute: providerTool({
      providerId: "google.google_search",
      args: {
        searchTypes: { webSearch: {} },
      },
    }),
    render: NativeWebSearchToolUI,
  },
  image_generation: {
    description:
      "Render OpenAI Responses API native image_generation tool results.",
    display: "standalone",
    execute: providerTool({
      providerId: "openai.image_generation",
      args: {},
    }),
    render: OpenAIImageGenerationToolUI,
  },
  getWeather: {
    description: "Get current weather and a short forecast for a city or place.",
    display: "standalone",
    parameters: assistantSidebarGetWeatherParameters,
    execute: externalTool(),
    render: WeatherToolUI,
  },
  createImage: {
    description:
      "Generate or edit images with the configured AI SDK image model.",
    display: "standalone",
    parameters: assistantSidebarCreateImageParameters,
    execute: externalTool(),
    render: GenerateImageToolUI,
  },
  listStudioSkills: {
    description:
      "Find matching XC Studio workflow skills before planning creative execution.",
    display: "standalone",
    parameters: assistantSidebarListStudioSkillsParameters,
    execute: externalTool(),
    render: ListStudioSkillsToolUI,
  },
  planStudioWorkflow: {
    description:
      "Plan a Studio creative workflow before calling execution tools.",
    display: "standalone",
    parameters: assistantSidebarPlanStudioWorkflowParameters,
    execute: externalTool(),
    render: PlanStudioWorkflowToolUI,
  },
  searchWorkspaceKnowledge: {
    description:
      "Search local XC Studio knowledge files before answering project-specific questions.",
    display: "standalone",
    parameters: assistantSidebarSearchWorkspaceKnowledgeParameters,
    execute: externalTool(),
    render: SearchWorkspaceKnowledgeToolUI,
  },
  createTargetElement: {
    description:
      "Create a new image-generation target on the current canvas for later visual work.",
    display: "standalone",
    parameters: assistantSidebarCreateTargetElementParameters,
    execute: stubTool(),
    render: CreateTargetElementToolUI,
  },
});
