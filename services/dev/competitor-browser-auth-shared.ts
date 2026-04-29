import fs from "fs";
import path from "path";

export type SharedCompetitorBrowserAuthConfig = {
  version: 1;
  taobao: {
    enabled: boolean;
    label?: string;
    updatedAt?: string;
    cookieCount?: number;
    originCount?: number;
    localStorageOriginCount?: number;
  };
};

const PRIMARY_RUNTIME_DIR = path.join(
  process.cwd(),
  ".jk-studio-runtime",
  "competitor-browser-auth",
);
const LEGACY_RUNTIME_DIR = path.join(
  process.cwd(),
  ".xc-studio-runtime",
  "competitor-browser-auth",
);

function resolveRuntimeDir(): string {
  if (fs.existsSync(PRIMARY_RUNTIME_DIR)) {
    return PRIMARY_RUNTIME_DIR;
  }
  if (fs.existsSync(LEGACY_RUNTIME_DIR)) {
    return LEGACY_RUNTIME_DIR;
  }
  return PRIMARY_RUNTIME_DIR;
}

function getConfigPath(): string {
  return path.join(resolveRuntimeDir(), "config.json");
}

function getStorageStatePath(): string {
  return path.join(resolveRuntimeDir(), "taobao-storage-state.json");
}

function readEnvValue(primaryKey: string, legacyKey: string): string {
  return String(process.env[primaryKey] || process.env[legacyKey] || "").trim();
}

function ensureRuntimeDir(): void {
  fs.mkdirSync(resolveRuntimeDir(), { recursive: true });
}

function getDefaultConfig(): SharedCompetitorBrowserAuthConfig {
  return {
    version: 1,
    taobao: {
      enabled: false,
    },
  };
}

export function getSharedCompetitorBrowserAuthPaths() {
  return {
    runtimeDir: resolveRuntimeDir(),
    configPath: getConfigPath(),
    storageStatePath: getStorageStatePath(),
  };
}

export function loadSharedCompetitorBrowserAuthConfig(): SharedCompetitorBrowserAuthConfig {
  try {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
      return getDefaultConfig();
    }

    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return getDefaultConfig();
    }

    return {
      version: 1,
      taobao: {
        enabled: Boolean(parsed?.taobao?.enabled),
        label:
          typeof parsed?.taobao?.label === "string" ? parsed.taobao.label : undefined,
        updatedAt:
          typeof parsed?.taobao?.updatedAt === "string"
            ? parsed.taobao.updatedAt
            : undefined,
        cookieCount:
          typeof parsed?.taobao?.cookieCount === "number"
            ? parsed.taobao.cookieCount
            : undefined,
        originCount:
          typeof parsed?.taobao?.originCount === "number"
            ? parsed.taobao.originCount
            : undefined,
        localStorageOriginCount:
          typeof parsed?.taobao?.localStorageOriginCount === "number"
            ? parsed.taobao.localStorageOriginCount
            : undefined,
      },
    };
  } catch {
    return getDefaultConfig();
  }
}

export function saveSharedCompetitorBrowserAuthConfig(
  config: SharedCompetitorBrowserAuthConfig,
): void {
  ensureRuntimeDir();
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf8");
}

export function getSharedStorageStatePath(): string | null {
  const storageStatePath = getStorageStatePath();
  return fs.existsSync(storageStatePath) ? storageStatePath : null;
}

export function clearSharedStorageState(): void {
  const nextConfig = getDefaultConfig();
  const storageStatePath = getStorageStatePath();
  if (fs.existsSync(storageStatePath)) {
    fs.unlinkSync(storageStatePath);
  }
  saveSharedCompetitorBrowserAuthConfig(nextConfig);
}

export function parseStorageStateSummary(rawText: string): {
  cookieCount: number;
  originCount: number;
  localStorageOriginCount: number;
} {
  const parsed = JSON.parse(rawText);
  const cookies = Array.isArray(parsed?.cookies) ? parsed.cookies : [];
  const origins = Array.isArray(parsed?.origins) ? parsed.origins : [];
  return {
    cookieCount: cookies.length,
    originCount: origins.length,
    localStorageOriginCount: origins.filter((item) =>
      Array.isArray(item?.localStorage) && item.localStorage.length > 0,
    ).length,
  };
}

export function importSharedStorageState(options: {
  rawText: string;
  label?: string | null;
}): SharedCompetitorBrowserAuthConfig {
  const normalizedText = String(options.rawText || "").trim();
  if (!normalizedText) {
    throw new Error("storage_state_empty");
  }

  const summary = parseStorageStateSummary(normalizedText);
  ensureRuntimeDir();
  fs.writeFileSync(getStorageStatePath(), normalizedText, "utf8");

  const nextConfig: SharedCompetitorBrowserAuthConfig = {
    version: 1,
    taobao: {
      enabled: true,
      label: String(options.label || "").trim() || "shared-storage-state",
      updatedAt: new Date().toISOString(),
      cookieCount: summary.cookieCount,
      originCount: summary.originCount,
      localStorageOriginCount: summary.localStorageOriginCount,
    },
  };

  saveSharedCompetitorBrowserAuthConfig(nextConfig);
  return nextConfig;
}

export function buildSharedCompetitorBrowserAuthStatus() {
  const config = loadSharedCompetitorBrowserAuthConfig();
  const profileDir = readEnvValue(
    "JK_STUDIO_COMPETITOR_BROWSER_PROFILE_DIR",
    "XC_STUDIO_COMPETITOR_BROWSER_PROFILE_DIR",
  );
  const storageStateEnvPath = readEnvValue(
    "JK_STUDIO_COMPETITOR_BROWSER_STORAGE_STATE",
    "XC_STUDIO_COMPETITOR_BROWSER_STORAGE_STATE",
  );
  const allowRawExport =
    readEnvValue(
      "JK_STUDIO_COMPETITOR_AUTH_ALLOW_RAW_EXPORT",
      "XC_STUDIO_COMPETITOR_AUTH_ALLOW_RAW_EXPORT",
    ).toLowerCase() === "true";
  const storageStatePath = getStorageStatePath();

  return {
    sharedStorageStateConfigured:
      config.taobao.enabled && fs.existsSync(storageStatePath),
    sharedStorageStateLabel: config.taobao.label || null,
    sharedStorageStateUpdatedAt: config.taobao.updatedAt || null,
    sharedStorageStateCookieCount: config.taobao.cookieCount || 0,
    sharedStorageStateOriginCount: config.taobao.originCount || 0,
    sharedStorageStateLocalStorageOriginCount:
      config.taobao.localStorageOriginCount || 0,
    sharedStorageStatePathExists: fs.existsSync(storageStatePath),
    localProfileModeConfigured: Boolean(profileDir && fs.existsSync(profileDir)),
    localProfileModePathMasked: profileDir
      ? `${profileDir.slice(0, 24)}...`
      : null,
    envStorageStateConfigured: Boolean(
      storageStateEnvPath && fs.existsSync(storageStateEnvPath),
    ),
    envStorageStatePathMasked: storageStateEnvPath
      ? `${storageStateEnvPath.slice(0, 24)}...`
      : null,
    rawExportAllowed: allowRawExport,
  };
}

export function exportSharedStorageStateRaw(): string {
  const storageStatePath = getStorageStatePath();
  if (!fs.existsSync(storageStatePath)) {
    throw new Error("storage_state_not_configured");
  }
  return fs.readFileSync(storageStatePath, "utf8");
}
