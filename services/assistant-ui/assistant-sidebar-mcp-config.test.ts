import test from "node:test";
import assert from "node:assert/strict";

import { createAssistantSidebarMcpToolkitDefinition } from "./assistant-sidebar-mcp-config.ts";

test("assistant sidebar MCP config parses array and object env definitions", () => {
  const config = createAssistantSidebarMcpToolkitDefinition({
    ASSISTANT_SIDEBAR_MCP_SERVERS: JSON.stringify([
      {
        id: "github tools",
        type: "http",
        url: "https://mcp.example.com/github",
        headers: {
          "X-Team": "design",
        },
      },
    ]),
    ASSISTANT_UI_MCP_SERVERS: JSON.stringify({
      files: {
        type: "sse",
        url: "https://mcp.example.com/files",
      },
    }),
  });

  assert.deepEqual(config, {
    github_tools: {
      type: "http",
      url: "https://mcp.example.com/github",
      headers: {
        "X-Team": "design",
      },
    },
    files: {
      type: "sse",
      url: "https://mcp.example.com/files",
    },
  });
});

test("assistant sidebar MCP config supports single URL env with bearer token", () => {
  const config = createAssistantSidebarMcpToolkitDefinition({
    MCP_SERVER_URL: "https://mcp.example.com/workspace",
    MCP_TOKEN: "workspace-token",
  });

  assert.deepEqual(config, {
    workspace: {
      type: "http",
      url: "https://mcp.example.com/workspace",
      headers: {
        Authorization: "Bearer workspace-token",
      },
    },
  });
});

test("assistant sidebar MCP config keeps explicit Authorization header over token", () => {
  const config = createAssistantSidebarMcpToolkitDefinition({
    ASSISTANT_SIDEBAR_MCP_SERVERS: JSON.stringify([
      {
        id: "secure",
        type: "http",
        url: "https://mcp.example.com/secure",
        token: "ignored-token",
        headers: {
          Authorization: "Bearer explicit-token",
        },
        redirect: "error",
      },
    ]),
  });

  assert.deepEqual(config, {
    secure: {
      type: "http",
      url: "https://mcp.example.com/secure",
      headers: {
        Authorization: "Bearer explicit-token",
      },
      redirect: "error",
    },
  });
});

test("assistant sidebar MCP config rejects unsupported transports and invalid URLs", () => {
  const config = createAssistantSidebarMcpToolkitDefinition({
    ASSISTANT_SIDEBAR_MCP_SERVERS: JSON.stringify([
      {
        id: "stdio-dev-only",
        type: "stdio",
        url: "node ./server.js",
      },
      {
        id: "local-file",
        type: "http",
        url: "file:///tmp/mcp.sock",
      },
      {
        id: "valid",
        type: "http",
        url: "https://mcp.example.com/valid",
        redirect: "manual",
      },
    ]),
  });

  assert.deepEqual(config, {
    valid: {
      type: "http",
      url: "https://mcp.example.com/valid",
    },
  });
});
