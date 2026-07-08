import {
  createEmptyAccountSecretsSnapshot,
  normalizeAccountSecretsSnapshot,
  type ApiProviderConfig,
  type ImageHostProvider,
  type StudioAccountSecretsSnapshot,
} from './account-secrets-shared.ts';
import {
  safeLocalStorageRemoveItem,
  safeLocalStorageSetItem,
  safeLocalStorageStateStorage,
} from '../utils/safe-storage.ts';
import { loadProviderSettings } from './provider-settings.ts';
import {
  clearSearchSettingsStorage,
  loadSearchSettings,
  saveSearchSettings,
} from './search-settings.ts';
import { useImageHostStore } from '../stores/imageHost.store.ts';

export interface PushAccountSecretsToAccountOptions {
  accessToken: string;
  snapshot: StudioAccountSecretsSnapshot;
  endpoint?: string;
  baseUpdatedAt?: number;
}

export interface PullAccountSecretsFromAccountOptions {
  accessToken: string;
  endpoint?: string;
}

export interface SyncAccountSecretsWithAccountResult {
  mode: 'restored_remote' | 'pushed_local' | 'noop';
  snapshot: StudioAccountSecretsSnapshot;
}

const PROVIDERS_STORAGE_KEY = 'api_providers';
const ACTIVE_PROVIDER_STORAGE_KEY = 'api_provider';
const REPLICATE_KEY_STORAGE_KEY = 'replicate_api_key';
const KLING_KEY_STORAGE_KEY = 'kling_api_key';
const LEGACY_GEMINI_KEY_STORAGE_KEY = 'gemini_api_key';
const LEGACY_YUNWU_KEY_STORAGE_KEY = 'yunwu_api_key';
const ACCOUNT_SECRETS_REMOTE_VERSION_STORAGE_KEY = 'account_secrets_remote_version_v1';
const IMAGE_HOST_STORAGE_KEY = 'image-host-storage';
const DEFAULT_ACTIVE_PROVIDER_ID = 'yunwu';
const DEFAULT_CUSTOM_IMAGE_HOST_CONFIG = createEmptyAccountSecretsSnapshot().imageHost.customConfig;

const clone = <T,>(value: T): T => structuredClone(value);

const normalizeString = (value: unknown): string => String(value ?? '').trim();

const DEFAULT_PROVIDERS_SIGNATURE = JSON.stringify(createEmptyAccountSecretsSnapshot().providers);
const DEFAULT_IMAGE_HOST_SIGNATURE = JSON.stringify(createEmptyAccountSecretsSnapshot().imageHost);
const DEFAULT_SEARCH_SIGNATURE = JSON.stringify(createEmptyAccountSecretsSnapshot().search);

const hasMeaningfulImageHostConfig = (
  imageHost: StudioAccountSecretsSnapshot['imageHost'],
): boolean => JSON.stringify(imageHost) !== DEFAULT_IMAGE_HOST_SIGNATURE;

const hasMeaningfulSearchConfig = (
  search: StudioAccountSecretsSnapshot['search'],
): boolean => JSON.stringify(search) !== DEFAULT_SEARCH_SIGNATURE;

const hasMeaningfulAccountSecretsSnapshot = (
  snapshot: StudioAccountSecretsSnapshot,
): boolean => {
  const normalized = normalizeAccountSecretsSnapshot(snapshot);
  const providersChanged = JSON.stringify(normalized.providers) !== DEFAULT_PROVIDERS_SIGNATURE;
  const activeProviderChanged = normalized.activeProviderId !== DEFAULT_ACTIVE_PROVIDER_ID;

  return (
    providersChanged
    || activeProviderChanged
    || Boolean(normalized.replicateKey)
    || Boolean(normalized.klingKey)
    || hasMeaningfulImageHostConfig(normalized.imageHost)
    || hasMeaningfulSearchConfig(normalized.search)
  );
};

const readStoredRemoteVersion = (): number => {
  const raw = safeLocalStorageStateStorage.getItem(ACCOUNT_SECRETS_REMOTE_VERSION_STORAGE_KEY);
  const value = Number(raw || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const writeStoredRemoteVersion = (updatedAt: number): void => {
  const safeUpdatedAt = Number.isFinite(updatedAt) && updatedAt > 0 ? Math.floor(updatedAt) : 0;
  if (safeUpdatedAt > 0) {
    safeLocalStorageSetItem(ACCOUNT_SECRETS_REMOTE_VERSION_STORAGE_KEY, String(safeUpdatedAt));
  } else {
    safeLocalStorageRemoveItem(ACCOUNT_SECRETS_REMOTE_VERSION_STORAGE_KEY);
  }
};

const clearStoredRemoteVersion = (): void => {
  safeLocalStorageRemoveItem(ACCOUNT_SECRETS_REMOTE_VERSION_STORAGE_KEY);
};

export const clearLocalAccountSecretsStorage = (): void => {
  safeLocalStorageRemoveItem(PROVIDERS_STORAGE_KEY);
  safeLocalStorageRemoveItem(ACTIVE_PROVIDER_STORAGE_KEY);
  safeLocalStorageRemoveItem(REPLICATE_KEY_STORAGE_KEY);
  safeLocalStorageRemoveItem(KLING_KEY_STORAGE_KEY);
  safeLocalStorageRemoveItem(LEGACY_GEMINI_KEY_STORAGE_KEY);
  safeLocalStorageRemoveItem(LEGACY_YUNWU_KEY_STORAGE_KEY);
  clearStoredRemoteVersion();
  safeLocalStorageRemoveItem(IMAGE_HOST_STORAGE_KEY);
  clearSearchSettingsStorage();
  useImageHostStore.setState({
    selectedProvider: 'none',
    imgbbKey: '',
    customConfig: clone(DEFAULT_CUSTOM_IMAGE_HOST_CONFIG),
  });
};


export const collectLocalAccountSecretsSnapshot = (): StudioAccountSecretsSnapshot => {
  const loaded = loadProviderSettings();
  const imageHostState = useImageHostStore.getState();
  const searchSettings = loadSearchSettings();

  return normalizeAccountSecretsSnapshot({
    version: 1,
    updatedAt: Date.now(),
    providers: loaded.providers,
    activeProviderId: loaded.activeProviderId,
    replicateKey: loaded.replicateKey,
    klingKey: loaded.klingKey,
    imageHost: {
      selectedProvider: imageHostState.selectedProvider,
      imgbbKey: imageHostState.imgbbKey,
      customConfig: imageHostState.customConfig,
    },
    search: searchSettings,
  });
};

export const applyLocalAccountSecretsSnapshot = (
  snapshot: unknown,
): StudioAccountSecretsSnapshot => {
  const normalized = normalizeAccountSecretsSnapshot(snapshot);

  safeLocalStorageSetItem(
    PROVIDERS_STORAGE_KEY,
    JSON.stringify(normalized.providers),
  );
  safeLocalStorageSetItem(
    ACTIVE_PROVIDER_STORAGE_KEY,
    normalized.activeProviderId,
  );
  safeLocalStorageSetItem(
    REPLICATE_KEY_STORAGE_KEY,
    normalized.replicateKey,
  );
  safeLocalStorageSetItem(
    KLING_KEY_STORAGE_KEY,
    normalized.klingKey,
  );
  writeStoredRemoteVersion(normalized.updatedAt);

  useImageHostStore.setState({
    selectedProvider: normalized.imageHost.selectedProvider,
    imgbbKey: normalized.imageHost.imgbbKey,
    customConfig: clone(normalized.imageHost.customConfig),
  });
  saveSearchSettings(normalized.search);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('provider-settings-updated', {
        detail: {
          providers: normalized.providers,
          activeProviderId: normalized.activeProviderId,
        },
      }),
    );
  }

  return normalized;
};

const createAuthorizedFetch = (accessToken: string): typeof fetch => {
  const fetchWithAuth: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers || undefined);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Accept', 'application/json');
    return fetch(input, {
      ...init,
      headers,
    });
  };

  return fetchWithAuth;
};

const readSnapshotResponse = async (
  response: Response,
  actionLabel: string,
): Promise<StudioAccountSecretsSnapshot> => {
  const payload = await response.json().catch(() => null) as {
    snapshot?: StudioAccountSecretsSnapshot;
    error?: string;
  } | null;

  if (!response.ok) {
    const error = new Error(
      payload?.error || `${actionLabel} failed: ${response.status} ${response.statusText}`,
    ) as Error & { conflictSnapshot?: StudioAccountSecretsSnapshot };
    if (response.status === 409 && payload?.snapshot) {
      error.name = 'AccountSecretsConflictError';
      error.conflictSnapshot = normalizeAccountSecretsSnapshot(payload.snapshot);
    }
    throw error;
  }

  return normalizeAccountSecretsSnapshot(payload?.snapshot);
};

export const pushAccountSecretsToAccount = async ({
  accessToken,
  snapshot,
  endpoint = '/api/account-secrets',
  baseUpdatedAt,
}: PushAccountSecretsToAccountOptions): Promise<StudioAccountSecretsSnapshot> => {
  const normalizedToken = normalizeString(accessToken);
  if (!normalizedToken) {
    throw new Error('Missing access token for sensitive config sync.');
  }

  const fetchImpl = createAuthorizedFetch(normalizedToken);
  const response = await fetchImpl(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      snapshot: normalizeAccountSecretsSnapshot(snapshot),
      baseUpdatedAt: Number.isFinite(Number(baseUpdatedAt)) ? Number(baseUpdatedAt) : undefined,
    }),
  });

  return readSnapshotResponse(response, 'Sensitive config sync');
};

export const pullAccountSecretsFromAccount = async ({
  accessToken,
  endpoint = '/api/account-secrets',
}: PullAccountSecretsFromAccountOptions): Promise<StudioAccountSecretsSnapshot> => {
  const normalizedToken = normalizeString(accessToken);
  if (!normalizedToken) {
    throw new Error('Missing access token for sensitive config restore.');
  }

  const fetchImpl = createAuthorizedFetch(normalizedToken);
  const response = await fetchImpl(endpoint, {
    method: 'GET',
  });

  return readSnapshotResponse(response, 'Sensitive config restore');
};

export const syncLocalAccountSecretsToAccount = async (
  options: Omit<PushAccountSecretsToAccountOptions, 'snapshot'>,
): Promise<StudioAccountSecretsSnapshot> => {
  const localSnapshot = collectLocalAccountSecretsSnapshot();
  const remoteSnapshot = await pullAccountSecretsFromAccount(options);
  const lastKnownRemoteVersion = readStoredRemoteVersion();

  if (
    lastKnownRemoteVersion > 0
    && remoteSnapshot.updatedAt > lastKnownRemoteVersion
  ) {
    const conflictError = new Error(
      '账号上的敏感配置已在其他设备更新，请先从账号恢复后再保存，或确认后重新保存。',
    ) as Error & { conflictSnapshot?: StudioAccountSecretsSnapshot };
    conflictError.name = 'AccountSecretsConflictError';
    conflictError.conflictSnapshot = remoteSnapshot;
    throw conflictError;
  }

  const storedSnapshot = await pushAccountSecretsToAccount({
    ...options,
    snapshot: localSnapshot,
    baseUpdatedAt: remoteSnapshot.updatedAt,
  });
  writeStoredRemoteVersion(storedSnapshot.updatedAt);
  return storedSnapshot;
};

export const syncAccountSecretsWithAccount = async (
  options: Omit<PushAccountSecretsToAccountOptions, 'snapshot'>,
): Promise<SyncAccountSecretsWithAccountResult> => {
  const remoteSnapshot = await pullAccountSecretsFromAccount(options);
  const localSnapshot = collectLocalAccountSecretsSnapshot();

  if (remoteSnapshot.updatedAt > 0) {
    const localHasImageHost = hasMeaningfulImageHostConfig(localSnapshot.imageHost);
    const remoteHasImageHost = hasMeaningfulImageHostConfig(remoteSnapshot.imageHost);
    const localHasSearch = hasMeaningfulSearchConfig(localSnapshot.search);
    const remoteHasSearch = hasMeaningfulSearchConfig(remoteSnapshot.search);

    if ((localHasImageHost && !remoteHasImageHost) || (localHasSearch && !remoteHasSearch)) {
      const storedSnapshot = await pushAccountSecretsToAccount({
        ...options,
        snapshot: {
          ...remoteSnapshot,
          updatedAt: Date.now(),
          imageHost: localHasImageHost && !remoteHasImageHost
            ? clone(localSnapshot.imageHost)
            : clone(remoteSnapshot.imageHost),
          search: localHasSearch && !remoteHasSearch
            ? clone(localSnapshot.search)
            : clone(remoteSnapshot.search),
        },
        baseUpdatedAt: remoteSnapshot.updatedAt,
      });
      const applied = applyLocalAccountSecretsSnapshot(storedSnapshot);
      writeStoredRemoteVersion(applied.updatedAt);
      return {
        mode: 'pushed_local',
        snapshot: applied,
      };
    }

    const applied = applyLocalAccountSecretsSnapshot(remoteSnapshot);
    writeStoredRemoteVersion(applied.updatedAt);
    return {
      mode: 'restored_remote',
      snapshot: applied,
    };
  }

  if (!hasMeaningfulAccountSecretsSnapshot(localSnapshot)) {
    writeStoredRemoteVersion(remoteSnapshot.updatedAt);
    return {
      mode: 'noop',
      snapshot: remoteSnapshot,
    };
  }

  const storedSnapshot = await pushAccountSecretsToAccount({
    ...options,
    snapshot: localSnapshot,
    baseUpdatedAt: remoteSnapshot.updatedAt,
  });
  const applied = applyLocalAccountSecretsSnapshot(storedSnapshot);
  writeStoredRemoteVersion(applied.updatedAt);
  return {
    mode: 'pushed_local',
    snapshot: applied,
  };
};

export const restoreLocalAccountSecretsFromAccount = async (
  options: PullAccountSecretsFromAccountOptions,
): Promise<StudioAccountSecretsSnapshot> => {
  const snapshot = await pullAccountSecretsFromAccount(options);
  const applied = applyLocalAccountSecretsSnapshot(snapshot);
  writeStoredRemoteVersion(applied.updatedAt);
  return applied;
};
