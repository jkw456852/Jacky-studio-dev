import fs from "fs";
import path from "path";

type PersonalBrowserAuthSession = {
  clientId: string;
  context: any;
  page: any;
  startedAt: string;
};

export type PersonalCompetitorBrowserAuthStatus = {
  clientId: string;
  configured: boolean;
  loginInProgress: boolean;
  updatedAt: string | null;
  mode: "personal-profile";
};

const PRIMARY_RUNTIME_ROOT = path.join(process.cwd(), ".jk-studio-runtime");
const LEGACY_RUNTIME_ROOT = path.join(process.cwd(), ".xc-studio-runtime");

function resolvePersonalRuntimeRoot(): string {
  const primaryRoot = path.join(
    PRIMARY_RUNTIME_ROOT,
    "competitor-browser-auth-personal",
  );
  const legacyRoot = path.join(
    LEGACY_RUNTIME_ROOT,
    "competitor-browser-auth-personal",
  );

  if (fs.existsSync(primaryRoot)) {
    return primaryRoot;
  }
  if (fs.existsSync(legacyRoot)) {
    return legacyRoot;
  }
  return primaryRoot;
}

const activeSessions = new Map<string, PersonalBrowserAuthSession>();

function ensureRootDir() {
  fs.mkdirSync(resolvePersonalRuntimeRoot(), { recursive: true });
}

function sanitizeClientId(clientId: string): string {
  const normalized = String(clientId || "").trim();
  if (!/^[a-zA-Z0-9_-]{12,128}$/.test(normalized)) {
    throw new Error("invalid_client_id");
  }
  return normalized;
}

function getClientDir(clientId: string): string {
  ensureRootDir();
  return path.join(resolvePersonalRuntimeRoot(), sanitizeClientId(clientId));
}

function getClientProfileDir(clientId: string): string {
  return path.join(getClientDir(clientId), "profile");
}

function getClientStorageStatePath(clientId: string): string {
  return path.join(getClientDir(clientId), "storage-state.json");
}

function getClientMetaPath(clientId: string): string {
  return path.join(getClientDir(clientId), "meta.json");
}

function readMeta(clientId: string): Record<string, any> {
  try {
    const raw = fs.readFileSync(getClientMetaPath(clientId), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMeta(clientId: string, patch: Record<string, any>) {
  const next = {
    ...readMeta(clientId),
    ...patch,
  };
  fs.mkdirSync(getClientDir(clientId), { recursive: true });
  fs.writeFileSync(getClientMetaPath(clientId), JSON.stringify(next, null, 2), "utf8");
}

export function getPersonalBrowserAuthPaths(clientId: string) {
  const safeClientId = sanitizeClientId(clientId);
  return {
    clientId: safeClientId,
    clientDir: getClientDir(safeClientId),
    profileDir: getClientProfileDir(safeClientId),
    storageStatePath: getClientStorageStatePath(safeClientId),
  };
}

export function getPersonalCompetitorBrowserAuthStatus(
  clientId: string,
): PersonalCompetitorBrowserAuthStatus {
  const safeClientId = sanitizeClientId(clientId);
  const meta = readMeta(safeClientId);
  const paths = getPersonalBrowserAuthPaths(safeClientId);
  const configured =
    fs.existsSync(paths.storageStatePath) || fs.existsSync(paths.profileDir);

  return {
    clientId: safeClientId,
    configured,
    loginInProgress: activeSessions.has(safeClientId),
    updatedAt: typeof meta.updatedAt === "string" ? meta.updatedAt : null,
    mode: "personal-profile",
  };
}

export async function registerPersonalBrowserAuthSession(options: {
  clientId: string;
  context: any;
  page: any;
}) {
  const safeClientId = sanitizeClientId(options.clientId);
  activeSessions.set(safeClientId, {
    clientId: safeClientId,
    context: options.context,
    page: options.page,
    startedAt: new Date().toISOString(),
  });
  writeMeta(safeClientId, {
    loginInProgress: true,
    startedAt: new Date().toISOString(),
  });
}

export function getActivePersonalBrowserAuthSession(clientId: string) {
  return activeSessions.get(sanitizeClientId(clientId)) || null;
}

export async function finalizePersonalBrowserAuthSession(
  clientId: string,
): Promise<PersonalCompetitorBrowserAuthStatus> {
  const safeClientId = sanitizeClientId(clientId);
  const session = activeSessions.get(safeClientId);
  const paths = getPersonalBrowserAuthPaths(safeClientId);

  if (!session) {
    throw new Error("personal_login_session_not_found");
  }

  fs.mkdirSync(paths.clientDir, { recursive: true });
  await session.context.storageState({ path: paths.storageStatePath });
  await session.context.close();
  activeSessions.delete(safeClientId);

  writeMeta(safeClientId, {
    loginInProgress: false,
    updatedAt: new Date().toISOString(),
    mode: "personal-profile",
  });

  return getPersonalCompetitorBrowserAuthStatus(safeClientId);
}

export async function clearPersonalBrowserAuthSession(
  clientId: string,
): Promise<PersonalCompetitorBrowserAuthStatus> {
  const safeClientId = sanitizeClientId(clientId);
  const session = activeSessions.get(safeClientId);
  if (session) {
    try {
      await session.context.close();
    } catch {
      // Ignore close failures.
    }
    activeSessions.delete(safeClientId);
  }

  const paths = getPersonalBrowserAuthPaths(safeClientId);
  if (fs.existsSync(paths.clientDir)) {
    fs.rmSync(paths.clientDir, { recursive: true, force: true });
  }

  return getPersonalCompetitorBrowserAuthStatus(safeClientId);
}
