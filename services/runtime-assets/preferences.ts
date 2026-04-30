import type { ChatMessage } from "../../types";
import { getStudioUserAssetApi } from "./api.ts";

type SkillData = NonNullable<ChatMessage["skillData"]>;

const normalizeSkillData = (
  skill: ChatMessage["skillData"] | null | undefined,
): SkillData | null => {
  if (!skill?.id || !skill?.name || !skill?.iconName) return null;
  return {
    id: skill.id,
    ...(skill.pluginId ? { pluginId: skill.pluginId } : {}),
    name: skill.name,
    iconName: skill.iconName,
    ...(skill.config ? { config: skill.config } : {}),
  };
};

export const getActiveQuickSkillPreference = (): SkillData | null =>
  normalizeSkillData(getStudioUserAssetApi().getSkillPreferences().activeQuickSkill);

export const setActiveQuickSkillPreference = (
  skill: ChatMessage["skillData"] | null,
): void => {
  const api = getStudioUserAssetApi();
  const current = api.getSkillPreferences();
  const normalized = normalizeSkillData(skill);
  const recentSkillIds = normalized?.id
    ? Array.from(new Set([normalized.id, ...(current.recentSkillIds || [])])).slice(
        0,
        12,
      )
    : current.recentSkillIds;
  api.setSkillPreferences({
    activeQuickSkill: normalized,
    recentSkillIds,
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
