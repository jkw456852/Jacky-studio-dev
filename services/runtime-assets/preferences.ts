import type { ChatMessage } from "../../types";
import type { AgentSkillData } from "../../types/agent.types.ts";
import { getStudioUserAssetApi } from "./api.ts";
import {
  getFrontstageSkillId,
  normalizeFrontstageSkillPresentation,
  sanitizeFrontstageSkillName,
} from "./skill-identity.ts";
import { updateCustomSkillMarkdownAssetToApi } from "./custom-skill-files.client.ts";

type SkillData = NonNullable<ChatMessage["skillData"]>;
type RuntimeSkillData = ChatMessage["skillData"] | AgentSkillData;

export const SKILL_PREFERENCES_UPDATED_EVENT =
  "studio:skill-preferences-updated";

const emitSkillPreferencesUpdated = (): void => {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }
  window.dispatchEvent(new CustomEvent(SKILL_PREFERENCES_UPDATED_EVENT));
};

const normalizeSkillData = (
  skill: RuntimeSkillData | null | undefined,
): SkillData | null => {
  if (!skill?.id || !skill?.name || !skill?.iconName) return null;
  return normalizeFrontstageSkillPresentation({
    id: skill.id,
    ...(skill.pluginId ? { pluginId: skill.pluginId } : {}),
    name: skill.name,
    iconName: skill.iconName,
    ...(skill.config ? { config: skill.config } : {}),
  });
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const buildCustomSkillRuntimeSeedConfig = (args: {
  skillId: string;
  name?: unknown;
  iconName?: unknown;
  baseConfig?: Record<string, unknown> | null;
}): Record<string, unknown> => {
  const baseConfig = isObjectRecord(args.baseConfig) ? args.baseConfig : {};
  const now = Date.now();
  const markdownAssetId = String(baseConfig.markdownAssetId || "").trim();
  const markdownAssetPath = String(baseConfig.markdownAssetPath || "").trim();
  const storageFormat = String(baseConfig.storageFormat || "").trim();
  const isExplicitMarkdownBacked =
    storageFormat === "markdown-file" ||
    (markdownAssetId.length > 0 && String(baseConfig.isCustomSkill) === "true");

  return {
    ...baseConfig,
    name: sanitizeFrontstageSkillName(baseConfig.name || args.name || ""),
    iconName: String(baseConfig.iconName || args.iconName || "Sparkles"),
    isCustomSkill: true,
    createdAt: Number(baseConfig.createdAt || now),
    updatedAt: now,
    ...(markdownAssetId
      ? { markdownAssetId }
      : {}),
    ...(markdownAssetPath
      ? { markdownAssetPath }
      : {}),
    ...(isExplicitMarkdownBacked && markdownAssetId
      ? { storageFormat: "markdown-file" }
      : {}),
  };
};

const buildFrontstageSkillRuntimeConfig = (args: {
  skillId: string;
  name?: unknown;
  iconName?: unknown;
  baseConfig?: Record<string, unknown> | null;
}): Record<string, unknown> => {
  const baseConfig = isObjectRecord(args.baseConfig) ? args.baseConfig : {};
  const now = Date.now();
  return {
    ...baseConfig,
    name: sanitizeFrontstageSkillName(baseConfig.name || args.name || ""),
    iconName: String(baseConfig.iconName || args.iconName || "Sparkles"),
    createdAt: Number(baseConfig.createdAt || now),
    updatedAt: now,
  };
};

const mergeRuntimeMemoryIntoSkill = (
  skill: SkillData | null,
  runtimeConfig?: Record<string, unknown> | null,
): SkillData | null => {
  if (!skill) return null;
  const config =
    skill.config && typeof skill.config === "object"
      ? (skill.config as Record<string, unknown>)
      : {};
  const runtimeRecord = isObjectRecord(runtimeConfig) ? runtimeConfig : null;
  if (!runtimeRecord) return skill;

  return {
    ...skill,
    config: {
      ...runtimeRecord,
      ...config,
      ...(runtimeRecord.lastSuccessfulPrompt
        ? { lastSuccessfulPrompt: runtimeRecord.lastSuccessfulPrompt }
        : {}),
      ...(runtimeRecord.lastSuccessfulSummary
        ? { lastSuccessfulSummary: runtimeRecord.lastSuccessfulSummary }
        : {}),
      ...(runtimeRecord.lastSuccessfulOutput
        ? { lastSuccessfulOutput: runtimeRecord.lastSuccessfulOutput }
        : {}),
      ...(runtimeRecord.successfulRuns
        ? { successfulRuns: runtimeRecord.successfulRuns }
        : {}),
      ...(runtimeRecord.lastSuccessfulAt
        ? { lastSuccessfulAt: runtimeRecord.lastSuccessfulAt }
        : {}),
      ...(runtimeRecord.examplePrompt
        ? { examplePrompt: runtimeRecord.examplePrompt }
        : {}),
    },
  };
};

export const hydrateSkillDataWithPreferences = (
  skill: ChatMessage["skillData"] | null | undefined,
): SkillData | null => {
  const preferences = getStudioUserAssetApi().getSkillPreferences();
  const normalized = normalizeSkillData(skill);
  if (!normalized) return null;

  const config =
    normalized.config && typeof normalized.config === "object"
      ? (normalized.config as Record<string, unknown>)
      : null;
  const skillId = getFrontstageSkillId(normalized);
  const runtimeConfig =
    config?.isCustomSkill === true
      ? preferences.customSkillConfigs?.[skillId]
      : preferences.frontstageSkillRuntimeConfigs?.[skillId];

  return mergeRuntimeMemoryIntoSkill(normalized, runtimeConfig || null);
};

export const getActiveQuickSkillPreference = (): SkillData | null =>
  hydrateSkillDataWithPreferences(
    getStudioUserAssetApi().getSkillPreferences().activeQuickSkill,
  );

export const setActiveQuickSkillPreference = (
  skill: ChatMessage["skillData"] | null,
): void => {
  const api = getStudioUserAssetApi();
  const current = api.getSkillPreferences();
  const normalized = normalizeSkillData(skill);
  const normalizedId = getFrontstageSkillId(normalized);
  const recentSkillIds = normalizedId
    ? Array.from(new Set([normalizedId, ...(current.recentSkillIds || [])])).slice(
        0,
        12,
      )
    : current.recentSkillIds;
  const activeConfig =
    normalized?.config && typeof normalized.config === "object"
      ? (normalized.config as Record<string, unknown>)
      : null;
  const nextCustomSkillConfigs =
    normalizedId && activeConfig?.isCustomSkill === true
      ? {
          ...(current.customSkillConfigs || {}),
          [normalizedId]: {
            ...buildCustomSkillRuntimeSeedConfig({
              skillId: normalizedId,
              name: normalized?.name,
              iconName: normalized?.iconName,
              baseConfig: current.customSkillConfigs?.[normalizedId] || activeConfig,
            }),
            lastUsedAt: Date.now(),
          },
        }
      : current.customSkillConfigs;
  const nextFrontstageSkillRuntimeConfigs =
    normalizedId && activeConfig?.isCustomSkill !== true
      ? {
          ...(current.frontstageSkillRuntimeConfigs || {}),
          [normalizedId]: {
            ...buildFrontstageSkillRuntimeConfig({
              skillId: normalizedId,
              name: normalized?.name,
              iconName: normalized?.iconName,
              baseConfig: current.frontstageSkillRuntimeConfigs?.[normalizedId] || activeConfig,
            }),
            lastUsedAt: Date.now(),
          },
        }
      : current.frontstageSkillRuntimeConfigs;
  api.setSkillPreferences({
    activeQuickSkill: normalized,
    recentSkillIds,
    ...(nextCustomSkillConfigs ? { customSkillConfigs: nextCustomSkillConfigs } : {}),
    ...(nextFrontstageSkillRuntimeConfigs
      ? { frontstageSkillRuntimeConfigs: nextFrontstageSkillRuntimeConfigs }
      : {}),
  });
  emitSkillPreferencesUpdated();
};

export const pinSkillPreference = (skillId: string, pinned = true): void => {
  const api = getStudioUserAssetApi();
  const current = api.getSkillPreferences();
  const normalizedId = String(skillId || "").trim();
  if (!normalizedId) return;
  const next = pinned
    ? Array.from(new Set([normalizedId, ...(current.pinnedSkillIds || [])])).slice(
        0,
        24,
      )
    : (current.pinnedSkillIds || []).filter((item) => item !== normalizedId);
  api.setSkillPreferences({
    pinnedSkillIds: next,
  });
  emitSkillPreferencesUpdated();
};

export const setSkillCustomConfigPreference = (
  skillId: string,
  config: Record<string, unknown>,
): void => {
  const api = getStudioUserAssetApi();
  const current = api.getSkillPreferences();
  const normalizedId = String(skillId || "").trim();
  if (!normalizedId) return;
  api.setSkillPreferences({
    customSkillConfigs: {
      ...(current.customSkillConfigs || {}),
      [normalizedId]: config,
    },
  });
  emitSkillPreferencesUpdated();
};

export const removeCustomSkillPreference = (skillId: string): void => {
  const normalizedId = String(skillId || "").trim();
  if (!normalizedId) return;
  const api = getStudioUserAssetApi();
  const current = api.getSkillPreferences();
  const nextCustomSkillConfigs = { ...(current.customSkillConfigs || {}) };
  delete nextCustomSkillConfigs[normalizedId];
  api.setSkillPreferences({
    activeQuickSkill:
      current.activeQuickSkill?.id === normalizedId
        ? null
        : current.activeQuickSkill,
    recentSkillIds: (current.recentSkillIds || []).filter(
      (item) => item !== normalizedId,
    ),
    pinnedSkillIds: (current.pinnedSkillIds || []).filter(
      (item) => item !== normalizedId,
    ),
    customSkillConfigs: nextCustomSkillConfigs,
    frontstageSkillRuntimeConfigs: {
      ...(current.frontstageSkillRuntimeConfigs || {}),
    },
  });
  emitSkillPreferencesUpdated();
};

export const upsertCustomSkillPreference = (skill: {
  id: string;
  name: string;
  iconName?: string;
  config?: Record<string, unknown>;
  pin?: boolean;
}): void => {
  const normalizedId = String(skill.id || "").trim();
  const normalizedName = sanitizeFrontstageSkillName(skill.name);
  if (!normalizedId || !normalizedName) return;
  const api = getStudioUserAssetApi();
  const current = api.getSkillPreferences();
  const existing = current.customSkillConfigs?.[normalizedId] || {};
  const nextConfig = {
    ...existing,
    ...(skill.config || {}),
    name: normalizedName,
    iconName: String(skill.iconName || existing.iconName || "Sparkles"),
    isCustomSkill: true,
    createdAt: Number(existing.createdAt || Date.now()),
    updatedAt: Date.now(),
  };
  const nextPinnedSkillIds =
    skill.pin === true
      ? Array.from(new Set([normalizedId, ...(current.pinnedSkillIds || [])])).slice(0, 24)
      : current.pinnedSkillIds;
  const nextRecentSkillIds = Array.from(
    new Set([normalizedId, ...(current.recentSkillIds || [])]),
  ).slice(0, 12);
  api.setSkillPreferences({
    pinnedSkillIds: nextPinnedSkillIds,
    recentSkillIds: nextRecentSkillIds,
    customSkillConfigs: {
      ...(current.customSkillConfigs || {}),
      [normalizedId]: nextConfig,
    },
  });
  emitSkillPreferencesUpdated();
};

export const recordCustomSkillSuccessfulRun = async (args: {
  skill: RuntimeSkillData | null | undefined;
  prompt?: string;
  summary?: string;
  outputText?: string;
}): Promise<void> => {
  const normalized = normalizeSkillData(args.skill);
  const normalizedId = getFrontstageSkillId(normalized || args.skill || null);
  const config =
    normalized?.config && typeof normalized.config === "object"
      ? (normalized.config as Record<string, unknown>)
      : args.skill?.config && typeof args.skill.config === "object"
      ? (args.skill.config as Record<string, unknown>)
      : null;
  if (!normalizedId) return;

  const api = getStudioUserAssetApi();
  const current = api.getSkillPreferences();

  const nextPrompt = String(args.prompt || "").trim();
  const nextSummary = String(args.summary || "").trim();
  const nextOutputText = String(args.outputText || "").trim();

  if (config?.isCustomSkill !== true) {
    const existingFrontstageConfig =
      current.frontstageSkillRuntimeConfigs?.[normalizedId];
    const baseFrontstageConfig = buildFrontstageSkillRuntimeConfig({
      skillId: normalizedId,
      name: normalized?.name || args.skill?.name,
      iconName: normalized?.iconName || args.skill?.iconName,
      baseConfig:
        (existingFrontstageConfig && typeof existingFrontstageConfig === "object"
          ? (existingFrontstageConfig as Record<string, unknown>)
          : null) || config,
    });
    const successfulRuns = Number(baseFrontstageConfig.successfulRuns || 0) + 1;
    const now = Date.now();
    const lastSuccessfulPrompt =
      nextPrompt ||
      String(
        baseFrontstageConfig.lastSuccessfulPrompt ||
          baseFrontstageConfig.examplePrompt ||
          '',
      ).trim();
    const lastSuccessfulSummary =
      nextSummary ||
      String(
        baseFrontstageConfig.lastSuccessfulSummary ||
          baseFrontstageConfig.summary ||
          '',
      ).trim();
    const lastSuccessfulOutput =
      nextOutputText.slice(0, 600) ||
      String(baseFrontstageConfig.lastSuccessfulOutput || '').trim();

    api.setSkillPreferences({
      frontstageSkillRuntimeConfigs: {
        ...(current.frontstageSkillRuntimeConfigs || {}),
        [normalizedId]: {
          ...baseFrontstageConfig,
          name: sanitizeFrontstageSkillName(
            baseFrontstageConfig.name || normalized?.name || args.skill?.name || "",
          ),
          lastUsedAt: now,
          updatedAt: now,
          successfulRuns,
          lastSuccessfulAt: now,
          lastSuccessfulPrompt,
          lastSuccessfulSummary,
          lastSuccessfulOutput,
          examplePrompt:
            nextPrompt ||
            String(baseFrontstageConfig.examplePrompt || '').trim(),
        },
      },
    });
    emitSkillPreferencesUpdated();
    return;
  }

  const existing = current.customSkillConfigs?.[normalizedId];
  const existingConfig = buildCustomSkillRuntimeSeedConfig({
    skillId: normalizedId,
    name: normalized?.name || args.skill?.name,
    iconName: normalized?.iconName || args.skill?.iconName,
    baseConfig:
      (existing && typeof existing === "object" ? (existing as Record<string, unknown>) : null) ||
      config,
  });
  const successfulRuns = Number(existingConfig.successfulRuns || 0) + 1;
  const now = Date.now();
  const lastSuccessfulPrompt =
    nextPrompt ||
    String(existingConfig.lastSuccessfulPrompt || existingConfig.examplePrompt || '').trim();
  const lastSuccessfulSummary =
    nextSummary ||
    String(existingConfig.lastSuccessfulSummary || existingConfig.summary || '').trim();
  const lastSuccessfulOutput =
    nextOutputText.slice(0, 600) ||
    String(existingConfig.lastSuccessfulOutput || '').trim();

  api.setSkillPreferences({
    customSkillConfigs: {
      ...(current.customSkillConfigs || {}),
      [normalizedId]: {
        ...existingConfig,
        name: sanitizeFrontstageSkillName(
          existingConfig.name || normalized?.name || args.skill?.name || "",
        ),
        lastUsedAt: now,
        updatedAt: now,
        successfulRuns,
        lastSuccessfulAt: now,
        lastSuccessfulPrompt,
        lastSuccessfulSummary,
        lastSuccessfulOutput,
        examplePrompt:
          nextPrompt ||
          String(existingConfig.examplePrompt || existingConfig.sourceUserPrompt || '').trim(),
      },
    },
  });
  emitSkillPreferencesUpdated();

  const markdownAssetId = String(
    existingConfig.markdownAssetId || config?.markdownAssetId || '',
  ).trim();
  const storageFormat = String(
    existingConfig.storageFormat || config?.storageFormat || '',
  ).trim();
  if (!markdownAssetId || storageFormat !== 'markdown-file') {
    return;
  }

  try {
    await updateCustomSkillMarkdownAssetToApi({
      skillId: markdownAssetId,
      patch: {
        successfulRuns,
        lastSuccessfulAt: now,
        lastSuccessfulPrompt,
        lastSuccessfulSummary,
        lastSuccessfulOutput,
        examplePrompt:
          nextPrompt ||
          String(existingConfig.examplePrompt || existingConfig.sourceUserPrompt || '').trim(),
        updatedAt: now,
      },
    });
  } catch (error) {
    console.warn('[preferences] failed to persist custom skill successful run to markdown asset', {
      skillId: markdownAssetId,
      error,
    });
  }
};

export const getPluginPreferenceRecord = (pluginId: string) => {
  const normalizedId = String(pluginId || "").trim();
  if (!normalizedId) return null;
  return (
    getStudioUserAssetApi().getPluginPreferences().records[normalizedId] || null
  );
};

export const setPluginPreferenceRecord = (args: {
  pluginId: string;
  enabled?: boolean;
  pinned?: boolean;
  config?: Record<string, unknown>;
}): void => {
  const normalizedId = String(args.pluginId || "").trim();
  if (!normalizedId) return;
  const api = getStudioUserAssetApi();
  const current = api.getPluginPreferences();
  const existing = current.records[normalizedId];
  api.setPluginPreferences({
    records: {
      ...(current.records || {}),
      [normalizedId]: {
        pluginId: normalizedId,
        enabled: typeof args.enabled === "boolean" ? args.enabled : existing?.enabled ?? true,
        pinned: typeof args.pinned === "boolean" ? args.pinned : existing?.pinned ?? false,
        updatedAt: Date.now(),
        ...(existing?.config ? { config: existing.config } : {}),
        ...(args.config ? { config: args.config } : {}),
      },
    },
  });
};

export const removePluginPreferenceRecord = (pluginId: string): void => {
  const normalizedId = String(pluginId || "").trim();
  if (!normalizedId) return;
  const api = getStudioUserAssetApi();
  const current = api.getPluginPreferences();
  const nextRecords = { ...(current.records || {}) };
  delete nextRecords[normalizedId];
  api.setPluginPreferences({
    records: nextRecords,
  });
};

export const recordPluginActivation = (pluginId: string): void => {
  const normalizedId = String(pluginId || "").trim();
  if (!normalizedId) return;
  const existing = getPluginPreferenceRecord(normalizedId);
  const currentLaunchCount = Number(existing?.config?.launchCount || 0);
  setPluginPreferenceRecord({
    pluginId: normalizedId,
    enabled: true,
    config: {
      ...(existing?.config || {}),
      launchCount: Number.isFinite(currentLaunchCount) ? currentLaunchCount + 1 : 1,
      lastUsedAt: Date.now(),
    },
  });
};
