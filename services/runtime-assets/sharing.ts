import type { AgentType } from "../../types/agent.types";
import { getAgentRoleProfile } from "../agents/role-catalog";
import {
  getAgentPromptAddon,
  getBuiltInAgentPrompt,
  getLatestRoleDraft,
} from "../agents/role-export-helpers";
import {
  getPluginPreferenceRecord,
} from "./preferences.ts";
import {
  getStudioPluginAsset,
  getStudioStyleLibraryAsset,
} from "./studio-registry.ts";
import { getStudioUserAssetApi } from "./api.ts";
import type {
  StudioPluginPreferenceEntry,
  StudioStoredRoleDraft,
  StudioStoredStyleLibrary,
} from "./user-asset-types.ts";

export type StudioShareAssetKind = "role" | "style-library" | "plugin";

export interface StudioShareMeta {
  author: string;
  summary: string;
  tags: string[];
  compatibilityVersion: number;
  createdAt: number;
  updatedAt: number;
  source: "built-in" | "user" | "composite";
}

export interface StudioRoleSharePayload {
  agentId: AgentType;
  builtInPrompt: string;
  roleProfile: ReturnType<typeof getAgentRoleProfile>;
  promptAddon: string;
  latestDraft: StudioStoredRoleDraft | null;
}

export interface StudioStyleLibrarySharePayload {
  library: StudioStoredStyleLibrary;
}

export interface StudioPluginSharePayload {
  pluginAsset: ReturnType<typeof getStudioPluginAsset>;
  preference: StudioPluginPreferenceEntry | null;
}

export interface StudioAssetSharePackage {
  schemaVersion: 1;
  kind: StudioShareAssetKind;
  id: string;
  meta: StudioShareMeta;
  payload:
    | StudioRoleSharePayload
    | StudioStyleLibrarySharePayload
    | StudioPluginSharePayload;
}

const DEFAULT_SHARE_AUTHOR = "jkw456852";
const SHARE_SCHEMA_VERSION = 1 as const;

const normalizeTags = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];

const clipSummary = (value: unknown, fallback: string): string => {
  const normalized = String(value || "").trim();
  return (normalized || fallback).slice(0, 240);
};

export const buildRoleSharePackage = (
  agentId: AgentType,
): StudioAssetSharePackage => {
  const promptAddon = getAgentPromptAddon(agentId);
  const latestDraft = getLatestRoleDraft(agentId);
  const roleProfile = getAgentRoleProfile(agentId);
  const builtInPrompt = getBuiltInAgentPrompt(agentId);
  const updatedAt = Math.max(
    latestDraft?.updatedAt || 0,
    promptAddon ? Date.now() : 0,
  );

  return {
    schemaVersion: SHARE_SCHEMA_VERSION,
    kind: "role",
    id: `role:${agentId}`,
    meta: {
      author: DEFAULT_SHARE_AUTHOR,
      summary: clipSummary(
        latestDraft?.summary,
        `${roleProfile.purpose} (${agentId})`,
      ),
      tags: normalizeTags([agentId, "role", ...(roleProfile.useWhen || [])]),
      compatibilityVersion: SHARE_SCHEMA_VERSION,
      createdAt: latestDraft?.updatedAt || Date.now(),
      updatedAt: updatedAt || Date.now(),
      source: promptAddon || latestDraft ? "composite" : "built-in",
    },
    payload: {
      agentId,
      builtInPrompt,
      roleProfile,
      promptAddon,
      latestDraft,
    },
  };
};

export const buildStyleLibrarySharePackage = (
  styleLibraryId: string,
): StudioAssetSharePackage | null => {
  const library = getStudioUserAssetApi().getStyleLibraryById(styleLibraryId);
  if (!library) return null;

  return {
    schemaVersion: SHARE_SCHEMA_VERSION,
    kind: "style-library",
    id: `style-library:${library.id}`,
    meta: {
      author: DEFAULT_SHARE_AUTHOR,
      summary: clipSummary(library.summary, library.title),
      tags: normalizeTags([
        library.slug,
        library.sourceMode,
        library.createdBy,
        "style-library",
      ]),
      compatibilityVersion: SHARE_SCHEMA_VERSION,
      createdAt: library.updatedAt || Date.now(),
      updatedAt: library.updatedAt || Date.now(),
      source: library.createdBy === "system" ? "built-in" : "user",
    },
    payload: {
      library,
    },
  };
};

export const buildBuiltInStyleLibrarySharePackage = (
  mode: "default" | "poster-product",
): StudioAssetSharePackage => {
  const asset = getStudioStyleLibraryAsset(mode);
  const library: StudioStoredStyleLibrary = {
    ...asset.library,
    id: asset.library.id || mode,
    slug: asset.library.slug || mode,
    schemaVersion: 1,
    sourceMode: mode,
  };

  return {
    schemaVersion: SHARE_SCHEMA_VERSION,
    kind: "style-library",
    id: `style-library:${mode}`,
    meta: {
      author: DEFAULT_SHARE_AUTHOR,
      summary: clipSummary(asset.library.summary, asset.label),
      tags: normalizeTags([mode, "style-library", ...(asset.notes ? ["notes"] : [])]),
      compatibilityVersion: SHARE_SCHEMA_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: "built-in",
    },
    payload: {
      library,
    },
  };
};

export const buildPluginSharePackage = (
  pluginId: string,
): StudioAssetSharePackage => {
  const pluginAsset = getStudioPluginAsset(pluginId);
  const preference = getPluginPreferenceRecord(pluginId);
  const updatedAt = preference?.updatedAt || Date.now();

  return {
    schemaVersion: SHARE_SCHEMA_VERSION,
    kind: "plugin",
    id: `plugin:${pluginId}`,
    meta: {
      author: DEFAULT_SHARE_AUTHOR,
      summary: clipSummary(pluginAsset.description, pluginAsset.label),
      tags: normalizeTags([pluginAsset.category, ...(pluginAsset.tags || [])]),
      compatibilityVersion: SHARE_SCHEMA_VERSION,
      createdAt: updatedAt,
      updatedAt,
      source: preference ? "composite" : "built-in",
    },
    payload: {
      pluginAsset,
      preference,
    },
  };
};

export const exportSharePackageToJson = (
  sharePackage: StudioAssetSharePackage,
): string => JSON.stringify(sharePackage, null, 2);

export const parseSharePackageFromJson = (
  value: string,
): StudioAssetSharePackage | null => {
  try {
    const parsed = JSON.parse(value) as StudioAssetSharePackage;
    if (!parsed || parsed.schemaVersion !== SHARE_SCHEMA_VERSION) return null;
    if (!parsed.kind || !parsed.id || !parsed.meta || !parsed.payload) return null;
    return parsed;
  } catch {
    return null;
  }
};
