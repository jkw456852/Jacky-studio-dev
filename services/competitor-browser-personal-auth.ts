import { safeLocalStorageSetItem } from "../utils/safe-storage";

export type PersonalCompetitorBrowserAuthStatus = {
  clientId: string;
  configured: boolean;
  loginInProgress: boolean;
  updatedAt: string | null;
  mode: "personal-profile";
};

const PERSONAL_COMPETITOR_BROWSER_CLIENT_ID_KEY =
  "jk_studio_personal_competitor_browser_client_id";
const LEGACY_PERSONAL_COMPETITOR_BROWSER_CLIENT_ID_KEY =
  "xc_studio_personal_competitor_browser_client_id";

function buildClientId(): string {
  return `pcba_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 18)}`;
}

export function getPersonalCompetitorBrowserClientId(): string {
  const existing =
    typeof window !== "undefined" && window.localStorage
      ? String(
          window.localStorage.getItem(
            PERSONAL_COMPETITOR_BROWSER_CLIENT_ID_KEY,
          ) ||
            window.localStorage.getItem(
              LEGACY_PERSONAL_COMPETITOR_BROWSER_CLIENT_ID_KEY,
            ) ||
            "",
        ).trim()
      : "";
  if (/^[a-zA-Z0-9_-]{12,128}$/.test(existing)) {
    safeLocalStorageSetItem(PERSONAL_COMPETITOR_BROWSER_CLIENT_ID_KEY, existing);
    return existing;
  }

  const next = buildClientId();
  safeLocalStorageSetItem(PERSONAL_COMPETITOR_BROWSER_CLIENT_ID_KEY, next);
  return next;
}

async function readJson(response: Response): Promise<any> {
  return response.json().catch(() => null);
}

function resolveErrorMessage(payload: any, fallback: string): string {
  return String(payload?.message || payload?.error || "").trim() || fallback;
}

export async function fetchPersonalCompetitorBrowserAuthStatus(): Promise<PersonalCompetitorBrowserAuthStatus> {
  const clientId = getPersonalCompetitorBrowserClientId();
  const response = await fetch(
    `/api/competitor-browser-auth/personal/status?clientId=${encodeURIComponent(clientId)}`,
  );
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(resolveErrorMessage(payload, "加载个人淘宝登录态失败。"));
  }
  return payload as PersonalCompetitorBrowserAuthStatus;
}

export async function startPersonalCompetitorBrowserLogin(): Promise<PersonalCompetitorBrowserAuthStatus> {
  const clientId = getPersonalCompetitorBrowserClientId();
  const response = await fetch("/api/competitor-browser-auth/personal/start-login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clientId }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(resolveErrorMessage(payload, "打开淘宝登录窗口失败。"));
  }
  return payload?.status as PersonalCompetitorBrowserAuthStatus;
}

export async function finishPersonalCompetitorBrowserLogin(): Promise<PersonalCompetitorBrowserAuthStatus> {
  const clientId = getPersonalCompetitorBrowserClientId();
  const response = await fetch("/api/competitor-browser-auth/personal/finish-login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clientId }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(resolveErrorMessage(payload, "确认淘宝登录失败。"));
  }
  return payload?.status as PersonalCompetitorBrowserAuthStatus;
}

export async function clearPersonalCompetitorBrowserAuth(): Promise<PersonalCompetitorBrowserAuthStatus> {
  const clientId = getPersonalCompetitorBrowserClientId();
  const response = await fetch("/api/competitor-browser-auth/personal/clear", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clientId }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(resolveErrorMessage(payload, "清空个人淘宝登录态失败。"));
  }
  return payload?.status as PersonalCompetitorBrowserAuthStatus;
}
