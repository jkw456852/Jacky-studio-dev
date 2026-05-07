import { getStudioUserAssetApi } from "./api.ts";
import {
  DEFAULT_STUDIO_ASSET_SYNC_POLICY,
  type StudioAssetSyncPolicy,
} from "./sync-policy.ts";
import { syncStudioUserAssetsWithRemoteEndpoint } from "./sync-service.ts";

export interface SyncLocalStudioUserAssetsToAccountOptions {
  accessToken: string;
  endpoint?: string;
  policy?: StudioAssetSyncPolicy | null;
  writeBack?: "local" | "remote" | "both" | "none";
}

const createAuthorizedFetch = (accessToken: string): typeof fetch => {
  const fetchWithAuth: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers || undefined);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Accept", "application/json");
    return fetch(input, {
      ...init,
      headers,
    });
  };

  return fetchWithAuth;
};

export const syncLocalStudioUserAssetsToAccount = async ({
  accessToken,
  endpoint = "/api/account-sync",
  policy = DEFAULT_STUDIO_ASSET_SYNC_POLICY,
  writeBack = "both",
}: SyncLocalStudioUserAssetsToAccountOptions) => {
  const normalizedToken = String(accessToken || "").trim();

  if (!normalizedToken) {
    throw new Error("Missing access token for studio account sync.");
  }

  return syncStudioUserAssetsWithRemoteEndpoint({
    localApi: getStudioUserAssetApi(),
    remote: {
      endpoint,
      fetchImpl: createAuthorizedFetch(normalizedToken),
    },
    policy,
    writeBack,
  });
};
