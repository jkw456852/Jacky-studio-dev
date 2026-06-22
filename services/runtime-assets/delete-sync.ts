import {
  safeLocalStorageRemoveItem,
  safeLocalStorageSetItem,
} from "../../utils/safe-storage.ts";
import type { StudioUserAssetState } from "./user-asset-types.ts";

const PENDING_DELETE_STORAGE_KEY = "studio_user_asset_pending_deletes_v1";

export type StudioUserAssetDeleteKind =
  | "agent-role-addon"
  | "role-draft"
  | "style-library"
  | "style-library-candidate"
  | "skill-custom-config"
  | "plugin-preference-record";

export interface StudioUserAssetPendingDeleteEntry {
  kind: StudioUserAssetDeleteKind;
  targetId: string;
  deletedAt: number;
}

const getLocalStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const normalizePendingDeleteEntry = (
  value: unknown,
): StudioUserAssetPendingDeleteEntry | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const kind = String(raw.kind || "").trim() as StudioUserAssetDeleteKind;
  const targetId = String(raw.targetId || "").trim();
  const deletedAt = Number(raw.deletedAt || 0);
  if (!kind || !targetId || !Number.isFinite(deletedAt) || deletedAt <= 0) {
    return null;
  }
  return {
    kind,
    targetId,
    deletedAt,
  };
};

export const readPendingStudioUserAssetDeletes =
  (): StudioUserAssetPendingDeleteEntry[] => {
    const storage = getLocalStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(PENDING_DELETE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => normalizePendingDeleteEntry(item))
        .filter(Boolean) as StudioUserAssetPendingDeleteEntry[];
    } catch {
      return [];
    }
  };

const writePendingStudioUserAssetDeletes = (
  entries: StudioUserAssetPendingDeleteEntry[],
): void => {
  if (entries.length === 0) {
    safeLocalStorageRemoveItem(PENDING_DELETE_STORAGE_KEY);
    return;
  }
  safeLocalStorageSetItem(PENDING_DELETE_STORAGE_KEY, JSON.stringify(entries));
};

export const clearPendingStudioUserAssetDeletes = (): void => {
  safeLocalStorageRemoveItem(PENDING_DELETE_STORAGE_KEY);
};

export const recordPendingStudioUserAssetDelete = (
  kind: StudioUserAssetDeleteKind,
  targetId: string,
): void => {
  const normalizedTargetId = String(targetId || "").trim();
  if (!normalizedTargetId) return;
  const current = readPendingStudioUserAssetDeletes();
  const nextEntry: StudioUserAssetPendingDeleteEntry = {
    kind,
    targetId: normalizedTargetId,
    deletedAt: Date.now(),
  };
  const next = [
    nextEntry,
    ...current.filter(
      (item) => !(item.kind === kind && item.targetId === normalizedTargetId),
    ),
  ];
  writePendingStudioUserAssetDeletes(next);
};

export const cancelPendingStudioUserAssetDelete = (
  kind: StudioUserAssetDeleteKind,
  targetId: string,
): void => {
  const normalizedTargetId = String(targetId || "").trim();
  if (!normalizedTargetId) return;
  const current = readPendingStudioUserAssetDeletes();
  const next = current.filter(
    (item) => !(item.kind === kind && item.targetId === normalizedTargetId),
  );
  writePendingStudioUserAssetDeletes(next);
};

export const applyPendingDeletesToStudioUserAssetState = (
  snapshot: StudioUserAssetState,
  pendingDeletes: StudioUserAssetPendingDeleteEntry[],
): StudioUserAssetState => {
  const next = structuredClone(snapshot);

  for (const entry of pendingDeletes) {
    if (!entry.targetId) continue;
    switch (entry.kind) {
      case "agent-role-addon":
        delete next.agentPromptAddons[entry.targetId];
        break;
      case "role-draft":
        delete next.latestRoleDrafts[entry.targetId];
        break;
      case "style-library":
        delete next.styleLibraries[entry.targetId];
        break;
      case "style-library-candidate":
        delete next.styleLibraryCandidates[entry.targetId];
        break;
      case "skill-custom-config":
        delete next.skillPreferences.customSkillConfigs[entry.targetId];
        next.skillPreferences.recentSkillIds =
          next.skillPreferences.recentSkillIds.filter(
            (item) => item !== entry.targetId,
          );
        next.skillPreferences.pinnedSkillIds =
          next.skillPreferences.pinnedSkillIds.filter(
            (item) => item !== entry.targetId,
          );
        if (next.skillPreferences.activeQuickSkill?.id === entry.targetId) {
          next.skillPreferences.activeQuickSkill = null;
        }
        break;
      case "plugin-preference-record":
        delete next.pluginPreferences.records[entry.targetId];
        break;
      default:
        break;
    }
  }

  next.updatedAt = Date.now();
  next.skillPreferences.updatedAt = Date.now();
  next.pluginPreferences.updatedAt = Date.now();
  return next;
};
