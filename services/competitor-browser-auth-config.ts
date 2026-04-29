export type CompetitorBrowserAuthStatus = {
  sharedStorageStateConfigured: boolean;
  sharedStorageStateLabel: string | null;
  sharedStorageStateUpdatedAt: string | null;
  sharedStorageStateCookieCount: number;
  sharedStorageStateOriginCount: number;
  sharedStorageStateLocalStorageOriginCount: number;
  sharedStorageStatePathExists: boolean;
  localProfileModeConfigured: boolean;
  localProfileModePathMasked: string | null;
  envStorageStateConfigured: boolean;
  envStorageStatePathMasked: string | null;
  rawExportAllowed: boolean;
};

async function readJsonResponse(response: Response): Promise<any> {
  return response.json().catch(() => null);
}

function toErrorMessage(payload: any, fallback: string): string {
  return String(payload?.message || payload?.error || "").trim() || fallback;
}

export async function fetchCompetitorBrowserAuthStatus(): Promise<CompetitorBrowserAuthStatus> {
  const response = await fetch("/api/competitor-browser-auth/status");
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "加载共享登录态配置失败。"));
  }
  return payload as CompetitorBrowserAuthStatus;
}

export async function importCompetitorBrowserStorageState(options: {
  storageStateText: string;
  label?: string | null;
}): Promise<CompetitorBrowserAuthStatus> {
  const response = await fetch("/api/competitor-browser-auth/storage-state/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "导入共享登录态失败。"));
  }
  return payload?.status as CompetitorBrowserAuthStatus;
}

export async function clearCompetitorBrowserStorageState(): Promise<CompetitorBrowserAuthStatus> {
  const response = await fetch("/api/competitor-browser-auth/storage-state/clear", {
    method: "POST",
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "清空共享登录态失败。"));
  }
  return payload?.status as CompetitorBrowserAuthStatus;
}

export async function exportCompetitorBrowserStorageState(): Promise<string> {
  const response = await fetch("/api/competitor-browser-auth/storage-state/export");
  if (!response.ok) {
    const payload = await readJsonResponse(response);
    throw new Error(toErrorMessage(payload, "导出共享登录态失败。"));
  }
  return response.text();
}
