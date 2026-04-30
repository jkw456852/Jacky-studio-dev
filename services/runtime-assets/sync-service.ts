import type { StudioUserAssetApi } from "./api.ts";
import type { StudioUserAssetState } from "./user-asset-types.ts";
import type { StudioAssetSyncPolicy } from "./sync-policy.ts";
import {
  mergeStudioUserAssetStates,
  type StudioAssetMergeDecision,
} from "./sync-merge.ts";
import type { StudioRemoteUserAssetAdapterOptions } from "./remote-user-assets.ts";
import {
  fetchRemoteStudioUserAssetEnvelope,
  pushRemoteStudioUserAssetSnapshot,
} from "./remote-user-assets.ts";

export interface StudioUserAssetSyncApis {
  local: StudioUserAssetApi;
  remote: StudioUserAssetApi;
}

export interface StudioUserAssetSyncResult {
  localBefore: StudioUserAssetState;
  remoteBefore: StudioUserAssetState;
  merged: StudioUserAssetState;
  decisions: StudioAssetMergeDecision[];
}

export interface StudioAsyncUserAssetSyncResult
  extends StudioUserAssetSyncResult {
  remoteAuditCount: number;
}

export const syncStudioUserAssets = (args: {
  apis: StudioUserAssetSyncApis;
  policy?: StudioAssetSyncPolicy | null;
  writeBack?: "local" | "remote" | "both" | "none";
}): StudioUserAssetSyncResult => {
  const localBefore = args.apis.local.getSnapshot();
  const remoteBefore = args.apis.remote.getSnapshot();
  const mergeResult = mergeStudioUserAssetStates({
    local: localBefore,
    remote: remoteBefore,
    policy: args.policy,
  });
  const writeBack = args.writeBack || "both";

  if (writeBack === "local" || writeBack === "both") {
    args.apis.local.replaceSnapshot(mergeResult.merged, {
      audit: {
        action: "update",
        targetKind: "workspace-preference",
        summary: "Applied merged studio user asset snapshot from sync orchestration.",
      },
    });
  }

  if (writeBack === "remote" || writeBack === "both") {
    args.apis.remote.replaceSnapshot(mergeResult.merged, {
      audit: {
        action: "update",
        targetKind: "workspace-preference",
        summary: "Applied merged studio user asset snapshot to remote account layer.",
      },
    });
  }

  return {
    localBefore,
    remoteBefore,
    merged: mergeResult.merged,
    decisions: mergeResult.decisions,
  };
};

export const syncStudioUserAssetsWithRemoteEndpoint = async (args: {
  localApi: StudioUserAssetApi;
  remote: StudioRemoteUserAssetAdapterOptions;
  policy?: StudioAssetSyncPolicy | null;
  writeBack?: "local" | "remote" | "both" | "none";
}): Promise<StudioAsyncUserAssetSyncResult> => {
  const localBefore = args.localApi.getSnapshot();
  const remoteEnvelope = await fetchRemoteStudioUserAssetEnvelope(args.remote);
  const remoteBefore = remoteEnvelope.snapshot;
  const mergeResult = mergeStudioUserAssetStates({
    local: localBefore,
    remote: remoteBefore,
    policy: args.policy,
  });
  const writeBack = args.writeBack || "both";

  if (writeBack === "local" || writeBack === "both") {
    args.localApi.replaceSnapshot(mergeResult.merged, {
      audit: {
        action: "update",
        targetKind: "workspace-preference",
        summary: "Applied merged studio user asset snapshot from async remote sync orchestration.",
      },
    });
  }

  let remoteAuditCount = remoteEnvelope.auditEntries.length;
  if (writeBack === "remote" || writeBack === "both") {
    const pushed = await pushRemoteStudioUserAssetSnapshot({
      options: args.remote,
      snapshot: mergeResult.merged,
      audit: {
        action: "update",
        targetKind: "workspace-preference",
        summary: "Applied merged studio user asset snapshot to remote account layer.",
      },
    });
    remoteAuditCount = pushed.auditEntries.length;
  }

  return {
    localBefore,
    remoteBefore,
    merged: mergeResult.merged,
    decisions: mergeResult.decisions,
    remoteAuditCount,
  };
};
