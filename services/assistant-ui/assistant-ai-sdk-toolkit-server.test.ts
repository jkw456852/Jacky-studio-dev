import test, { after } from "node:test";
import assert from "node:assert/strict";
import type { ToolExecutionOptions, ToolSet } from "ai";

import { createAssistantAiSdkToolkit } from "./assistant-ai-sdk-toolkit-server.ts";
import { createAssistantSidebarServerToolkit } from "./assistant-sidebar-server-toolkit.ts";

after(() => {
  // AISDKToolkit loads assistant-ui's server runtime, which can keep Node test
  // handles alive after close() in this environment. Assertions still run first.
  process.exitCode = process.exitCode ?? 0;
  setImmediate(() => process.exit(process.exitCode ?? 0));
});

const objectSchema = {
  type: "object",
  properties: {
    query: { type: "string" },
  },
  required: ["query"],
} as const;

test("assistant AI SDK toolkit keeps backend executes when frontend schemas use the same names", async () => {
  const webSearchExecuteCalls: unknown[] = [];
  const createImageExecuteCalls: unknown[] = [];
  const getWeatherExecuteCalls: unknown[] = [];
  const planStudioWorkflowExecuteCalls: unknown[] = [];
  const searchWorkspaceKnowledgeExecuteCalls: unknown[] = [];

  const serverToolkit = createAssistantSidebarServerToolkit({
    webSearchTools: {
      webSearch: {
        description: "Backend web search.",
        inputSchema: objectSchema,
        execute: async (input: unknown) => {
          webSearchExecuteCalls.push(input);
          return { source: "backend-web-search" };
        },
      },
    } as any,
    imageTools: {
      createImage: {
        description: "Backend image generation.",
        inputSchema: objectSchema,
        execute: async (input: unknown) => {
          createImageExecuteCalls.push(input);
          return { source: "backend-create-image", images: [] };
        },
      },
    } as any,
    weatherTools: {
      getWeather: {
        description: "Backend weather.",
        inputSchema: objectSchema,
        execute: async (input: unknown) => {
          getWeatherExecuteCalls.push(input);
          return { source: "backend-get-weather" };
        },
      },
    } as any,
    studioSkillTools: {
      planStudioWorkflow: {
        description: "Backend Studio workflow planner.",
        inputSchema: objectSchema,
        execute: async (input: unknown) => {
          planStudioWorkflowExecuteCalls.push(input);
          return { source: "backend-plan-studio-workflow", plan: [] };
        },
      },
    } as any,
    workspaceKnowledgeTools: {
      searchWorkspaceKnowledge: {
        description: "Backend workspace knowledge.",
        inputSchema: objectSchema,
        execute: async (input: unknown) => {
          searchWorkspaceKnowledgeExecuteCalls.push(input);
          return { source: "backend-search-workspace-knowledge", matches: [] };
        },
      },
    } as any,
  });

  const aiToolkit = await createAssistantAiSdkToolkit(serverToolkit);

  try {
    const tools = (await aiToolkit.tools({
      frontend: {
        webSearch: {
          description: "Frontend web search schema only.",
          parameters: objectSchema,
        },
        createImage: {
          description: "Frontend image schema only.",
          parameters: objectSchema,
        },
        getWeather: {
          description: "Frontend weather schema only.",
          parameters: objectSchema,
        },
        searchWorkspaceKnowledge: {
          description: "Frontend workspace knowledge schema only.",
          parameters: objectSchema,
        },
        planStudioWorkflow: {
          description: "Frontend Studio workflow schema only.",
          parameters: objectSchema,
        },
      },
    })) as ToolSet;
    const toolExecutionOptions = (
      toolCallId: string,
    ): ToolExecutionOptions => ({
      toolCallId,
      messages: [],
      abortSignal: new AbortController().signal,
    });

    assert.equal(typeof tools.webSearch.execute, "function");
    assert.equal(typeof tools.createImage.execute, "function");
    assert.equal(typeof tools.getWeather.execute, "function");
    assert.equal(typeof tools.planStudioWorkflow.execute, "function");
    assert.equal(typeof tools.searchWorkspaceKnowledge.execute, "function");

    assert.deepEqual(
      await tools.webSearch.execute?.(
        { query: "assistant-ui" },
        toolExecutionOptions("tool-web"),
      ),
      { source: "backend-web-search" },
    );
    assert.deepEqual(
      await tools.createImage.execute?.(
        { query: "generate image" },
        toolExecutionOptions("tool-image"),
      ),
      { source: "backend-create-image", images: [] },
    );
    assert.deepEqual(
      await tools.getWeather.execute?.(
        { query: "Chongqing weather" },
        toolExecutionOptions("tool-weather"),
      ),
      { source: "backend-get-weather" },
    );
    assert.deepEqual(
      await tools.planStudioWorkflow.execute?.(
        { query: "plan detail page" },
        toolExecutionOptions("tool-plan"),
      ),
      { source: "backend-plan-studio-workflow", plan: [] },
    );
    assert.deepEqual(
      await tools.searchWorkspaceKnowledge.execute?.(
        { query: "cn detail page" },
        toolExecutionOptions("tool-knowledge"),
      ),
      { source: "backend-search-workspace-knowledge", matches: [] },
    );

    assert.deepEqual(webSearchExecuteCalls, [{ query: "assistant-ui" }]);
    assert.deepEqual(createImageExecuteCalls, [{ query: "generate image" }]);
    assert.deepEqual(getWeatherExecuteCalls, [{ query: "Chongqing weather" }]);
    assert.deepEqual(planStudioWorkflowExecuteCalls, [
      { query: "plan detail page" },
    ]);
    assert.deepEqual(searchWorkspaceKnowledgeExecuteCalls, [
      { query: "cn detail page" },
    ]);
  } finally {
    await aiToolkit.close();
  }
});
