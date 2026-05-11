import {
  createEmptyAccountSecretsSnapshot,
  normalizeAccountSecretsSnapshot,
  type SearchDefaultsConfig,
  type SearchProviderConfig,
} from './account-secrets-shared.js';
import {
  safeLocalStorageRemoveItem,
  safeLocalStorageSetItem,
} from '../utils/safe-storage.js';

export interface LoadedSearchSettings {
  activeProviderId: string;
  providers: SearchProviderConfig[];
  defaults: SearchDefaultsConfig;
}

const SEARCH_SETTINGS_STORAGE_KEY = 'search_settings_v1';

const clone = <T,>(value: T): T => structuredClone(value);

const getDefaultSearchSettings = (): LoadedSearchSettings =>
  clone(createEmptyAccountSecretsSnapshot().search);

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const normalizeSearchSettings = (value: unknown): LoadedSearchSettings =>
  normalizeAccountSecretsSnapshot({ search: value }).search;

export const loadSearchSettings = (): LoadedSearchSettings => {
  const storage = getStorage();
  if (!storage) return getDefaultSearchSettings();

  const raw = storage.getItem(SEARCH_SETTINGS_STORAGE_KEY);
  if (!raw) return getDefaultSearchSettings();

  try {
    return normalizeSearchSettings(JSON.parse(raw));
  } catch {
    return getDefaultSearchSettings();
  }
};

export const saveSearchSettings = (
  settings: LoadedSearchSettings,
): LoadedSearchSettings => {
  const normalized = normalizeSearchSettings(settings);
  safeLocalStorageSetItem(
    SEARCH_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalized),
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('search-settings-updated', {
        detail: normalized,
      }),
    );
  }

  return normalized;
};

export const clearSearchSettingsStorage = (): void => {
  safeLocalStorageRemoveItem(SEARCH_SETTINGS_STORAGE_KEY);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('search-settings-updated', {
        detail: getDefaultSearchSettings(),
      }),
    );
  }
};

export const getActiveSearchProvider = (
  settings: LoadedSearchSettings = loadSearchSettings(),
): SearchProviderConfig => {
  return (
    settings.providers.find(
      (provider) => provider.id === settings.activeProviderId,
    ) || settings.providers[0]
  );
};
