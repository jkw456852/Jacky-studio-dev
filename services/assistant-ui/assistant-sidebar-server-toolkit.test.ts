import test, { after } from "node:test";
import assert from "node:assert/strict";

import { createAssistantSidebarServerToolkit } from "./assistant-sidebar-server-toolkit.ts";

after(() => {
  // Importing @assistant-ui/react in this Node test environment can leave
  // framework/runtime handles open even after all assertions finish.
  process.exitCode = process.exitCode ?? 0;
  setImmediate(() => process.exit(process.exitCode ?? 0));
});

const withoutMcpServers = <T>(callback: () => T): T => {
  const previousMcpServers = process.env.ASSISTANT_SIDEBAR_MCP_SERVERS;
  delete process.env.ASSISTANT_SIDEBAR_MCP_SERVERS;
  try {
    return callback();
  } finally {
    if (previousMcpServers === undefined) {
      delete process.env.ASSISTANT_SIDEBAR_MCP_SERVERS;
    } else {
      process.env.ASSISTANT_SIDEBAR_MCP_SERVERS = previousMcpServers;
    }
  }
};

test("assistant sidebar server toolkit exposes backend weather, image, web search, Studio skill, and knowledge tools", () => {
  const toolkit = withoutMcpServers(() => createAssistantSidebarServerToolkit({
    webSearchTools: {
      webSearch: {
        description: "Search the web.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
        },
        execute: async () => ({ results: [] }),
      },
      tavilyExtract: {
        description: "Extract pages with Tavily.",
        inputSchema: {
          type: "object",
          properties: {
            urls: { type: "array" },
          },
        },
        execute: async () => ({ results: [] }),
      },
      tavilyCrawl: {
        description: "Crawl a site with Tavily.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
          },
        },
        execute: async () => ({ results: [] }),
      },
      tavilyMap: {
        description: "Map a site with Tavily.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
          },
        },
        execute: async () => ({ results: [] }),
      },
    } as any,
    imageTools: {
      createImage: {
        description: "Create an image.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
          },
        },
        execute: async () => ({ images: [] }),
      },
    } as any,
    weatherTools: {
      getWeather: {
        description: "Get weather.",
        inputSchema: {
          type: "object",
          properties: {
            location: { type: "string" },
          },
        },
        execute: async () => ({ temperature: 26 }),
      },
    } as any,
    studioSkillTools: {
      listStudioSkills: {
        description: "List Studio skills.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
        },
        execute: async () => ({ matches: [] }),
      },
      planStudioWorkflow: {
        description: "Plan Studio workflow.",
        inputSchema: {
          type: "object",
          properties: {
            request: { type: "string" },
          },
        },
        execute: async () => ({ plan: [] }),
      },
    } as any,
    workspaceKnowledgeTools: {
      searchWorkspaceKnowledge: {
        description: "Search workspace knowledge.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
        },
        execute: async () => ({ matches: [] }),
      },
    } as any,
  })) as any;

  assert.equal(toolkit.webSearch.description, "Search the web.");
  assert.deepEqual(toolkit.webSearch.parameters.properties.query, {
    type: "string",
  });
  assert.equal(typeof toolkit.webSearch.execute, "function");

  assert.equal(toolkit.tavilyExtract.description, "Extract pages with Tavily.");
  assert.deepEqual(toolkit.tavilyExtract.parameters.properties.urls, {
    type: "array",
  });
  assert.equal(typeof toolkit.tavilyExtract.execute, "function");

  assert.equal(toolkit.tavilyCrawl.description, "Crawl a site with Tavily.");
  assert.deepEqual(toolkit.tavilyCrawl.parameters.properties.url, {
    type: "string",
  });
  assert.equal(typeof toolkit.tavilyCrawl.execute, "function");

  assert.equal(toolkit.tavilyMap.description, "Map a site with Tavily.");
  assert.deepEqual(toolkit.tavilyMap.parameters.properties.url, {
    type: "string",
  });
  assert.equal(typeof toolkit.tavilyMap.execute, "function");

  assert.equal(toolkit.createImage.description, "Create an image.");
  assert.deepEqual(toolkit.createImage.parameters.properties.prompt, {
    type: "string",
  });
  assert.equal(typeof toolkit.createImage.execute, "function");
  assert.equal(typeof toolkit.createImage.toModelOutput, "function");

  assert.equal(toolkit.getWeather.description, "Get weather.");
  assert.deepEqual(toolkit.getWeather.parameters.properties.location, {
    type: "string",
  });
  assert.equal(typeof toolkit.getWeather.execute, "function");

  assert.equal(toolkit.listStudioSkills.description, "List Studio skills.");
  assert.deepEqual(toolkit.listStudioSkills.parameters.properties.query, {
    type: "string",
  });
  assert.equal(typeof toolkit.listStudioSkills.execute, "function");

  assert.equal(toolkit.planStudioWorkflow.description, "Plan Studio workflow.");
  assert.deepEqual(toolkit.planStudioWorkflow.parameters.properties.request, {
    type: "string",
  });
  assert.equal(typeof toolkit.planStudioWorkflow.execute, "function");

  assert.equal(
    toolkit.searchWorkspaceKnowledge.description,
    "Search workspace knowledge.",
  );
  assert.deepEqual(toolkit.searchWorkspaceKnowledge.parameters.properties.query, {
    type: "string",
  });
  assert.equal(typeof toolkit.searchWorkspaceKnowledge.execute, "function");
});

test("assistant sidebar server toolkit preserves AI SDK tool approval metadata", () => {
  const toolkit = withoutMcpServers(() => createAssistantSidebarServerToolkit({
    imageTools: {
      createImage: {
        description: "Create an image.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
          },
        },
        needsApproval: true,
        execute: async () => ({ images: [] }),
      },
    } as any,
  })) as any;

  assert.equal(toolkit.createImage.needsApproval, true);
});

test("assistant sidebar server toolkit converts image tool output to model-visible image content", async () => {
  const toolkit = withoutMcpServers(() => createAssistantSidebarServerToolkit({
    imageTools: {
      createImage: {
        description: "Create an image.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
          },
        },
        execute: async () => ({
          images: [
            {
              data: "abc123",
              mediaType: "image/png",
              filename: "demo.png",
            },
          ],
        }),
      },
    } as any,
  })) as any;

  const modelOutput = await toolkit.createImage.toModelOutput({
    toolCallId: "tool-1",
    input: { prompt: "demo" },
    output: {
      providerName: "Plato",
      modelId: "gpt-image-2",
      prompt: "demo",
      size: "1536x864",
      aspectRatio: "16:9",
      resolution: "2K",
      images: [
        {
          data: "abc123",
          mediaType: "image/png",
          filename: "demo.png",
        },
      ],
    },
  });

  assert.deepEqual(modelOutput, [
    {
      type: "text",
      text:
        "Generated 1 image. Provider: Plato. Model: gpt-image-2. " +
        "Size: 1536x864. Aspect ratio: 16:9. Resolution: 2K. " +
        "Images were returned to the UI as tool output and remain available to future createImage calls as references; " +
        "image bytes are intentionally not included in the language-model tool result. Prompt: demo",
    },
  ]);
  assert.equal(modelOutput.some((part) => part.type === "file"), false);
});

test("assistant sidebar server toolkit does not expose legacy agent or skill tools", () => {
  const legacyTool = {
    description: "Legacy tool that must not be exposed through assistant-ui.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
      },
    },
    execute: async () => ({ ok: true }),
  };

  const toolkit = withoutMcpServers(() => createAssistantSidebarServerToolkit({
    webSearchTools: {
      webSearch: legacyTool,
      workspaceSearch: legacyTool,
      "workspace-search": legacyTool,
      research: legacyTool,
      browserAgent: legacyTool,
    } as any,
    imageTools: {
      createImage: legacyTool,
      imageGen: legacyTool,
      "image-gen": legacyTool,
      generateModel: legacyTool,
      "generate-model": legacyTool,
      smartEdit: legacyTool,
      "smart-edit": legacyTool,
      touchEdit: legacyTool,
      "touch-edit": legacyTool,
    } as any,
    weatherTools: {
      getWeather: legacyTool,
      weather: legacyTool,
    } as any,
  })) as Record<string, unknown>;

  assert.deepEqual(
    Object.keys(toolkit).filter((key) =>
      [
        "workspaceSearch",
        "workspace-search",
        "research",
        "browserAgent",
        "imageGen",
        "image-gen",
        "generateModel",
        "generate-model",
        "smartEdit",
        "smart-edit",
        "touchEdit",
        "touch-edit",
        "weather",
      ].includes(key),
    ),
    [],
  );

  assert.equal(typeof toolkit.webSearch, "object");
  assert.equal(typeof toolkit.createImage, "object");
  assert.equal(typeof toolkit.getWeather, "object");
});

test("assistant sidebar server toolkit keeps first-party tools ahead of MCP name collisions", () => {
  const previousMcpServers = process.env.ASSISTANT_SIDEBAR_MCP_SERVERS;
  process.env.ASSISTANT_SIDEBAR_MCP_SERVERS = JSON.stringify([
    {
      name: "webSearch",
      type: "http",
      url: "https://mcp.example.com/web",
    },
    {
      name: "createImage",
      type: "http",
      url: "https://mcp.example.com/image",
    },
    {
      name: "getWeather",
      type: "http",
      url: "https://mcp.example.com/weather",
    },
    {
      name: "skillCatalog",
      type: "http",
      url: "https://mcp.example.com/skills",
    },
  ]);

  try {
    const firstPartyTool = {
      description: "First-party tool.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
      },
      execute: async () => ({ ok: true }),
    };

    const toolkit = createAssistantSidebarServerToolkit({
      webSearchTools: { webSearch: firstPartyTool } as any,
      imageTools: { createImage: firstPartyTool } as any,
      weatherTools: { getWeather: firstPartyTool } as any,
    }) as Record<string, any>;

    assert.equal(toolkit.webSearch.type, undefined);
    assert.equal(toolkit.createImage.type, undefined);
    assert.equal(toolkit.getWeather.type, undefined);
    assert.equal(typeof toolkit.webSearch.execute, "function");
    assert.equal(typeof toolkit.createImage.execute, "function");
    assert.equal(typeof toolkit.getWeather.execute, "function");

    assert.equal(toolkit.skillCatalog.type, "mcp");
    assert.deepEqual(toolkit.skillCatalog.server, {
      type: "http",
      url: "https://mcp.example.com/skills",
    });
  } finally {
    if (previousMcpServers === undefined) {
      delete process.env.ASSISTANT_SIDEBAR_MCP_SERVERS;
    } else {
      process.env.ASSISTANT_SIDEBAR_MCP_SERVERS = previousMcpServers;
    }
  }
});
