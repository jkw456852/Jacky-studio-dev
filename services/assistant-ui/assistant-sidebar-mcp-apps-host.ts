import { createMCPClient, type MCPClient, type MCPClientConfig } from "@ai-sdk/mcp";
import type { McpServerConfig } from "assistant-stream";

import { createAssistantSidebarMcpToolkitDefinition } from "./assistant-sidebar-mcp-config.ts";
import type {
  AssistantSidebarRemoteMcpServerConfig,
} from "./assistant-sidebar-mcp-config.ts";

type AssistantSidebarMcpAppHostRequest = {
  method?: unknown;
  params?: unknown;
};

type AssistantSidebarMcpAppHostDependencies = {
  createMcpClient?: ((config: MCPClientConfig) => Promise<MCPClient>) | undefined;
  env?: Record<string, string | undefined> | undefined;
};

type AssistantSidebarMcpClientEntry = {
  client: MCPClient;
  name: string;
};

type AssistantSidebarMcpAppResourceContent = {
  blob?: unknown;
  mimeType?: unknown;
  text?: unknown;
  uri?: unknown;
  _meta?: unknown;
};

const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";

const mcpClientCache = new Map<string, Promise<MCPClient>>();

const normalizeString = (value: unknown): string => String(value ?? "").trim();

const toMCPClientConfig = (
  config: AssistantSidebarRemoteMcpServerConfig,
): MCPClientConfig => ({
  transport: {
    type: config.type,
    url: config.url,
    ...(config.headers ? { headers: config.headers } : {}),
    ...(config.redirect ? { redirect: config.redirect } : {}),
  },
  clientName: "xc-studio-assistant-ui-mcp-apps",
});

const getConfiguredMcpServers = (
  env?: Record<string, string | undefined>,
): Array<[string, AssistantSidebarRemoteMcpServerConfig]> =>
  Object.entries(createAssistantSidebarMcpToolkitDefinition(env));

const getMcpClient = (
  name: string,
  config: AssistantSidebarRemoteMcpServerConfig,
  dependencies: AssistantSidebarMcpAppHostDependencies,
) => {
  const cacheKey = `${name}:${JSON.stringify(config)}`;
  const existing = mcpClientCache.get(cacheKey);
  if (existing) return existing;

  const createClient = dependencies.createMcpClient ?? createMCPClient;
  const next = createClient(toMCPClientConfig(config)).catch((error) => {
    if (mcpClientCache.get(cacheKey) === next) {
      mcpClientCache.delete(cacheKey);
    }
    throw error;
  });
  mcpClientCache.set(cacheKey, next);
  return next;
};

const getConfiguredMcpClients = async (
  dependencies: AssistantSidebarMcpAppHostDependencies,
): Promise<AssistantSidebarMcpClientEntry[]> => {
  const servers = getConfiguredMcpServers(dependencies.env);
  return Promise.all(
    servers.map(async ([name, config]) => ({
      name,
      client: await getMcpClient(name, config, dependencies),
    })),
  );
};

const requireConfiguredMcpClients = async (
  dependencies: AssistantSidebarMcpAppHostDependencies,
) => {
  const clients = await getConfiguredMcpClients(dependencies);
  if (clients.length === 0) {
    throw new Error("assistant_sidebar_mcp_apps_not_configured");
  }
  return clients;
};

const getObjectParam = (params: unknown): Record<string, unknown> =>
  params && typeof params === "object" && !Array.isArray(params)
    ? (params as Record<string, unknown>)
    : {};

const readMcpAppResourceFromClient = async (
  entry: AssistantSidebarMcpClientEntry,
  uri: string,
) => {
  const result = await entry.client.readResource({ uri });
  const contents = Array.isArray(result.contents) ? result.contents : [];
  const content = contents.find((item) => {
    const candidate = item as AssistantSidebarMcpAppResourceContent;
    return (
      normalizeString(candidate.uri) === uri &&
      normalizeString(candidate.mimeType) === MCP_APP_MIME_TYPE &&
      typeof candidate.text === "string"
    );
  }) as AssistantSidebarMcpAppResourceContent | undefined;

  if (!content) return null;

  return {
    uri,
    mimeType: MCP_APP_MIME_TYPE,
    html: String(content.text),
    ...(content._meta && typeof content._meta === "object"
      ? { meta: content._meta }
      : {}),
  };
};

const readMcpAppResource = async (
  params: unknown,
  dependencies: AssistantSidebarMcpAppHostDependencies,
) => {
  const uri = normalizeString(getObjectParam(params).uri);
  if (!uri) {
    throw new Error("assistant_sidebar_mcp_apps_resource_uri_required");
  }

  const clients = await requireConfiguredMcpClients(dependencies);
  const errors: unknown[] = [];

  for (const entry of clients) {
    try {
      const resource = await readMcpAppResourceFromClient(entry, uri);
      if (resource) return resource;
    } catch (error) {
      errors.push(error);
    }
  }

  throw new Error(
    errors.length > 0
      ? "assistant_sidebar_mcp_apps_resource_unavailable"
      : "assistant_sidebar_mcp_apps_resource_not_found",
  );
};

const listMcpResources = async (
  params: unknown,
  dependencies: AssistantSidebarMcpAppHostDependencies,
) => {
  const clients = await requireConfiguredMcpClients(dependencies);
  const requestParams = getObjectParam(params);
  const results = await Promise.all(
    clients.map(async ({ client }) => client.listResources({ params: requestParams })),
  );
  return {
    resources: results.flatMap((result) =>
      Array.isArray(result.resources) ? result.resources : [],
    ),
  };
};

const readMcpResource = async (
  params: unknown,
  dependencies: AssistantSidebarMcpAppHostDependencies,
) => {
  const uri = normalizeString(getObjectParam(params).uri);
  if (!uri) {
    throw new Error("assistant_sidebar_mcp_apps_resource_uri_required");
  }

  const clients = await requireConfiguredMcpClients(dependencies);
  const errors: unknown[] = [];
  for (const entry of clients) {
    try {
      return await entry.client.readResource({ uri });
    } catch (error) {
      errors.push(error);
    }
  }

  throw new Error(
    errors.length > 0
      ? "assistant_sidebar_mcp_apps_resource_unavailable"
      : "assistant_sidebar_mcp_apps_resource_not_found",
  );
};

const callMcpTool = async (
  params: unknown,
  dependencies: AssistantSidebarMcpAppHostDependencies,
) => {
  const normalizedParams = getObjectParam(params);
  const name = normalizeString(normalizedParams.name);
  if (!name) {
    throw new Error("assistant_sidebar_mcp_apps_tool_name_required");
  }

  const clients = await requireConfiguredMcpClients(dependencies);
  const matches: Array<{
    entry: AssistantSidebarMcpClientEntry;
    execute: NonNullable<Awaited<ReturnType<MCPClient["tools"]>>[string]["execute"]>;
  }> = [];

  for (const entry of clients) {
    const tools = await entry.client.tools();
    const tool = tools[name];
    if (tool?.execute) {
      matches.push({ entry, execute: tool.execute });
    }
  }

  if (matches.length === 0) {
    throw new Error(`assistant_sidebar_mcp_apps_tool_not_found:${name}`);
  }
  if (matches.length > 1) {
    throw new Error(`assistant_sidebar_mcp_apps_tool_name_collision:${name}`);
  }

  const [match] = matches;
  return match.execute(normalizedParams.arguments ?? {}, {
    toolCallId: `mcp-app-${Date.now()}`,
    messages: [],
    abortSignal: new AbortController().signal,
  });
};

export const handleAssistantSidebarMcpAppsHostRequest = async (
  request: AssistantSidebarMcpAppHostRequest,
  dependencies: AssistantSidebarMcpAppHostDependencies = {},
) => {
  switch (request.method) {
    case "mcp-apps/read-resource":
      return readMcpAppResource(request.params, dependencies);
    case "tools/call":
      return callMcpTool(request.params, dependencies);
    case "resources/read":
      return readMcpResource(request.params, dependencies);
    case "resources/list":
      return listMcpResources(request.params, dependencies);
    default:
      throw new Error(
        `assistant_sidebar_mcp_apps_method_not_supported:${normalizeString(
          request.method,
        )}`,
      );
  }
};

export const closeAssistantSidebarMcpAppsHostClients = async () => {
  const clients = await Promise.allSettled(mcpClientCache.values());
  mcpClientCache.clear();
  const closeResults = await Promise.allSettled(
    clients.flatMap((result) =>
      result.status === "fulfilled" ? [result.value.close()] : [],
    ),
  );
  const errors = [
    ...clients.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    ),
    ...closeResults.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    ),
  ];
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      "Failed to close assistant sidebar MCP app clients",
    );
  }
};
