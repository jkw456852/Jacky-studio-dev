export type StudioAssetSyncConflictPolicy =
  | "prefer_local"
  | "prefer_remote"
  | "manual_merge";

export interface StudioAssetSyncPolicy {
  defaultPolicy: StudioAssetSyncConflictPolicy;
  perAssetKind?: Partial<
    Record<
      "main-brain" | "role" | "style-library" | "plugin" | "workspace-preference",
      StudioAssetSyncConflictPolicy
    >
  >;
}

export const DEFAULT_STUDIO_ASSET_SYNC_POLICY: StudioAssetSyncPolicy = {
  defaultPolicy: "prefer_local",
  perAssetKind: {
    "main-brain": "manual_merge",
    role: "manual_merge",
    "style-library": "prefer_local",
    plugin: "prefer_local",
    "workspace-preference": "prefer_remote",
  },
};

export const resolveStudioAssetSyncPolicy = (
  kind:
    | "main-brain"
    | "role"
    | "style-library"
    | "plugin"
    | "workspace-preference",
  policy?: StudioAssetSyncPolicy | null,
): StudioAssetSyncConflictPolicy => {
  const source = policy || DEFAULT_STUDIO_ASSET_SYNC_POLICY;
  return source.perAssetKind?.[kind] || source.defaultPolicy;
};
