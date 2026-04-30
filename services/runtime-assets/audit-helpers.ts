import type { StudioUserAssetAuditEntry } from "./user-asset-types.ts";
import { getStudioUserAssetApi } from "./api.ts";

export const listRecentAssetAuditEntries = (
  limit = 10,
): StudioUserAssetAuditEntry[] =>
  getStudioUserAssetApi().listAuditEntries().slice(0, Math.max(1, limit));

export const buildAssetAuditSummary = (
  entries: StudioUserAssetAuditEntry[],
): string =>
  entries
    .map(
      (entry) =>
        `- ${entry.targetKind}${entry.targetId ? `:${entry.targetId}` : ""} | ${entry.action} | ${entry.summary}`,
    )
    .join("\n");

export const rollbackLatestAssetAuditEntry = () => {
  const latest = getStudioUserAssetApi().listAuditEntries()[0];
  if (!latest) return getStudioUserAssetApi().getSnapshot();
  return getStudioUserAssetApi().rollbackToAuditEntry(latest.id);
};

export const rollbackAssetAuditEntryById = (auditEntryId: string) => {
  const normalizedId = String(auditEntryId || "").trim();
  if (!normalizedId) return getStudioUserAssetApi().getSnapshot();
  return getStudioUserAssetApi().rollbackToAuditEntry(normalizedId);
};
