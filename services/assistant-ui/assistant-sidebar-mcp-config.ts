import type { McpServerConfig } from "assistant-stream";

export type AssistantSidebarRemoteMcpServerConfig = Extract<
  McpServerConfig,
  { type: "http" | "sse" }
>;

type AssistantSidebarMcpServerInput = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  url?: unknown;
  headers?: unknown;
  token?: unknown;
  redirect?: unknown;
};

const normalizeString = (value: unknown): string =>
  String(value ?? "").trim();

const normalizeServerName = (value: unknown, fallback: string): string => {
  const raw = normalizeString(value || fallback)
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return raw || fallback;
};

const toHeaderRecord = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const headers = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
      const headerName = normalizeString(key);
      const headerValue = normalizeString(item);
      return headerName && headerValue ? [[headerName, headerValue]] : [];
    }),
  );
  return Object.keys(headers).length > 0 ? headers : undefined;
};

const parseMcpServerJson = (value: string): AssistantSidebarMcpServerInput[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed as AssistantSidebarMcpServerInput[];
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed as Record<string, unknown>).flatMap(
        ([id, server]) =>
          server && typeof server === "object"
            ? [{ id, ...(server as AssistantSidebarMcpServerInput) }]
            : [],
      );
    }
  } catch {
    return [];
  }
  return [];
};

const readAssistantSidebarMcpInputs = (
  env: Record<string, string | undefined>,
): AssistantSidebarMcpServerInput[] => {
  const configured = [
    ...parseMcpServerJson(normalizeString(env.ASSISTANT_SIDEBAR_MCP_SERVERS)),
    ...parseMcpServerJson(normalizeString(env.ASSISTANT_UI_MCP_SERVERS)),
  ];

  const singleUrl =
    normalizeString(env.ASSISTANT_SIDEBAR_MCP_URL) ||
    normalizeString(env.MCP_SERVER_URL);
  if (singleUrl) {
    configured.push({
      id: env.ASSISTANT_SIDEBAR_MCP_NAME || "workspace",
      type: env.ASSISTANT_SIDEBAR_MCP_TRANSPORT || "http",
      url: singleUrl,
      token: env.ASSISTANT_SIDEBAR_MCP_TOKEN || env.MCP_TOKEN,
    });
  }

  return configured;
};

export const createAssistantSidebarMcpToolkitDefinition = (
  env: Record<string, string | undefined> = process.env,
): Record<string, AssistantSidebarRemoteMcpServerConfig> => {
  const entries = readAssistantSidebarMcpInputs(env).flatMap(
    (server, index): Array<[string, AssistantSidebarRemoteMcpServerConfig]> => {
      const type = normalizeString(server.type || "http").toLowerCase();
      if (type !== "http" && type !== "sse") return [];

      const url = normalizeString(server.url);
      if (!url || !/^https?:\/\//i.test(url)) return [];

      const headers = toHeaderRecord(server.headers) || {};
      const token = normalizeString(server.token);
      if (token && !headers.Authorization) {
        headers.Authorization = `Bearer ${token}`;
      }

      const redirect = normalizeString(server.redirect).toLowerCase();
      const config: McpServerConfig = {
        type,
        url,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(redirect === "follow" || redirect === "error" ? { redirect } : {}),
      };

      return [
        [normalizeServerName(server.name || server.id, `mcp_${index + 1}`), config],
      ];
    },
  );

  return Object.fromEntries(entries);
};
