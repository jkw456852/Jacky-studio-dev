import type { ChatMessage } from "../../types";
import { getStudioUserAssetApi } from "./api.ts";
import {
  getFrontstageSkillId,
  normalizeFrontstageSkillPresentation,
} from "./skill-identity.ts";

type SkillData = NonNullable<ChatMessage["skillData"]>;

const normalizeSkillData = (
  skill: ChatMessage["skillData"] | null | undefined,
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

export const getActiveQuickSkillPreference = (): SkillData | null =>
  normalizeSkillData(getStudioUserAssetApi().getSkillPreferences().activeQuickSkill);

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
  const nextCustomSkillConfigs =
    normalizedId && current.customSkillConfigs?.[normalizedId]
      ? {
          ...(current.customSkillConfigs || {}),
          [normalizedId]: {
            ...(current.customSkillConfigs?.[normalizedId] || {}),
            lastUsedAt: Date.now(),
          },
        }
      : current.customSkillConfigs;
  api.setSkillPreferences({
    activeQuickSkill: normalized,
    recentSkillIds,
    ...(nextCustomSkillConfigs ? { customSkillConfigs: nextCustomSkillConfigs } : {}),
  });
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
};

export const upsertCustomSkillPreference = (skill: {
  id: string;
  name: string;
  iconName?: string;
  config?: Record<string, unknown>;
  pin?: boolean;
}): void => {
  const normalizedId = String(skill.id || "").trim();
  const normalizedName = String(skill.name || "").trim();
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
