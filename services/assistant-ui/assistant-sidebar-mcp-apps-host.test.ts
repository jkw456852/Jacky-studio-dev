import test from "node:test";
import assert from "node:assert/strict";

import {
  closeAssistantSidebarMcpAppsHostClients,
  handleAssistantSidebarMcpAppsHostRequest,
} from "./assistant-sidebar-mcp-apps-host.ts";

const mcpEnv = {
  ASSISTANT_SIDEBAR_MCP_SERVERS: JSON.stringify([
    { id: "widgets", type: "http", url: "https://mcp.example.com/widgets" },
  ]),
};

const createFakeMcpClient = (overrides: Record<string, unknown> = {}) => ({
  close: async () => undefined,
  listResources: async () => ({
    resources: [{ uri: "ui://weather/card", name: "weather-card" }],
  }),
  readResource: async ({ uri }: { uri: string }) => ({
    contents: [
      {
        uri,
        mimeType: "text/html;profile=mcp-app",
        text: "<div>MCP Weather</div>",
      },
    ],
  }),
  tools: async () => ({
    refreshWeather: {
      execute: async (args: unknown) => ({ ok: true, args }),
    },
  }),
  ...overrides,
});

test("assistant sidebar MCP Apps host returns MCP app HTML resources", async () => {
  await closeAssistantSidebarMcpAppsHostClients();
  const result = await handleAssistantSidebarMcpAppsHostRequest(
    {
      method: "mcp-apps/read-resource",
      params: { uri: "ui://weather/card" },
    },
    {
      env: mcpEnv,
      createMcpClient: async () => createFakeMcpClient() as any,
    },
  );

  assert.deepEqual(result, {
    uri: "ui://weather/card",
    mimeType: "text/html;profile=mcp-app",
    html: "<div>MCP Weather</div>",
  });
});

test("assistant sidebar MCP Apps host creates official AI SDK MCP clients", async () => {
  await closeAssistantSidebarMcpAppsHostClients();
  const capturedConfigs: unknown[] = [];
  const result = await handleAssistantSidebarMcpAppsHostRequest(
    { method: "resources/list", params: {} },
    {
      env: {
        ASSISTANT_SIDEBAR_MCP_SERVERS: JSON.stringify([
          {
            id: "secure widgets",
            type: "http",
            url: "https://mcp.example.com/widgets",
            headers: { "X-Team": "design" },
            token: "widget-token",
            redirect: "follow",
          },
        ]),
      },
      createMcpClient: async (config) => {
        capturedConfigs.push(config);
        return createFakeMcpClient() as any;
      },
    },
  );

  assert.deepEqual(result, {
    resources: [{ uri: "ui://weather/card", name: "weather-card" }],
  });
  assert.deepEqual(capturedConfigs, [
    {
      transport: {
        type: "http",
        url: "https://mcp.example.com/widgets",
        headers: {
          "X-Team": "design",
          Authorization: "Bearer widget-token",
        },
        redirect: "follow",
      },
      clientName: "xc-studio-assistant-ui-mcp-apps",
    },
  ]);
});

test("assistant sidebar MCP Apps host forwards resources/list and resources/read", async () => {
  await closeAssistantSidebarMcpAppsHostClients();
  const dependencies = {
    env: mcpEnv,
    createMcpClient: async () => createFakeMcpClient() as any,
  };

  assert.deepEqual(
    await handleAssistantSidebarMcpAppsHostRequest(
      { method: "resources/list", params: {} },
      dependencies,
    ),
    {
      resources: [{ uri: "ui://weather/card", name: "weather-card" }],
    },
  );

  assert.deepEqual(
    await handleAssistantSidebarMcpAppsHostRequest(
      { method: "resources/read", params: { uri: "ui://weather/card" } },
      dependencies,
    ),
    {
      contents: [
        {
          uri: "ui://weather/card",
          mimeType: "text/html;profile=mcp-app",
          text: "<div>MCP Weather</div>",
        },
      ],
    },
  );
});

test("assistant sidebar MCP Apps host calls MCP tools by name", async () => {
  await closeAssistantSidebarMcpAppsHostClients();
  const result = await handleAssistantSidebarMcpAppsHostRequest(
    {
      method: "tools/call",
      params: { name: "refreshWeather", arguments: { city: "Chongqing" } },
    },
    {
      env: mcpEnv,
      createMcpClient: async () => createFakeMcpClient() as any,
    },
  );

  assert.deepEqual(result, { ok: true, args: { city: "Chongqing" } });
});

test("assistant sidebar MCP Apps host fails clearly when no MCP servers are configured", async () => {
  await closeAssistantSidebarMcpAppsHostClients();
  await assert.rejects(
    () =>
      handleAssistantSidebarMcpAppsHostRequest(
        { method: "resources/list", params: {} },
        { env: {}, createMcpClient: async () => createFakeMcpClient() as any },
      ),
    /assistant_sidebar_mcp_apps_not_configured/,
  );
});
