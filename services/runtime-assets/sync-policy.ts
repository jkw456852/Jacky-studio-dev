export type StudioAssetSyncConflictPolicy =
  | "prefer_local"
  | "prefer_remote"
  | "manual_merge";

export interface StudioAssetSyncPolicy {
  defaultPolicy: StudioAssetSyncConflictPolicy;
  perAssetKind?: Partial<
    Record<
      | "main-brain"
      | "user-profile"
      | "role"
      | "style-library"
      | "plugin"
      | "workspace-preference"
      | "skill-preference"
      | "evolution-record",
      StudioAssetSyncConflictPolicy
    >
  >;
}

export const DEFAULT_STUDIO_ASSET_SYNC_POLICY: StudioAssetSyncPolicy = {
  defaultPolicy: "prefer_local",
  perAssetKind: {
    "main-brain": "manual_merge",
    "user-profile": "manual_merge",
    role: "manual_merge",
    "style-library": "manual_merge",
    plugin: "manual_merge",
    "workspace-preference": "manual_merge",
    "skill-preference": "manual_merge",
    "evolution-record": "manual_merge",
  },
};

export const resolveStudioAssetSyncPolicy = (
  kind:
    | "main-brain"
    | "user-profile"
    | "role"
    | "style-library"
    | "plugin"
    | "workspace-preference"
    | "skill-preference"
    | "evolution-record",
  policy?: StudioAssetSyncPolicy | null,
): StudioAssetSyncConflictPolicy => {
  const source = policy || DEFAULT_STUDIO_ASSET_SYNC_POLICY;
  return source.perAssetKind?.[kind] || source.defaultPolicy;
};
