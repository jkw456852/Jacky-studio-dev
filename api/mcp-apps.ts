import { handleAssistantSidebarMcpAppsHostRequest } from "../services/assistant-ui/assistant-sidebar-mcp-apps-host.ts";

type ApiResponse = {
  status?: (code: number) => ApiResponse;
  json?: (payload: unknown) => unknown;
};

const parseRequestBody = (body: unknown): unknown => {
  if (typeof body !== "string") return body ?? {};
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return {};
  }
};

export default async function handler(req: any, res: ApiResponse) {
  if (req.method !== "POST") {
    res.status?.(405).json?.({ error: "Method not allowed" });
    return;
  }

  try {
    const body = parseRequestBody(req.body);
    const result = await handleAssistantSidebarMcpAppsHostRequest(
      body && typeof body === "object" ? (body as any) : {},
    );
    res.status?.(200).json?.(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "assistant_sidebar_mcp_apps_failed";
    const statusCode = message.includes("not_configured") ? 501 : 500;
    res.status?.(statusCode).json?.({
      error: "assistant_sidebar_mcp_apps_failed",
      message,
    });
  }
}
