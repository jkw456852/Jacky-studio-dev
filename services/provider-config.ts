import { safeLocalStorageSetItem } from '../utils/safe-storage.ts';

export type ProviderConfig = {
  id: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
};

const FALLBACK_PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  yunwu: {
    id: 'yunwu',
    name: 'Yunwu',
    baseUrl: 'https://yunwu.ai',
    apiKey: '',
  },
  plato: {
    id: 'plato',
    name: 'Plato',
    baseUrl: 'https://api.bltcy.ai',
    apiKey: '',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: '',
  },
};

const safeStorageGetItem = (key: string): string | null => {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const normalizeProviderId = (providerId?: string | null): string | null => {
  const normalized = String(providerId || '').trim();
  if (!normalized) return null;
  if (normalized.toLowerCase() === 'default' || normalized.toLowerCase() === 'auto') {
    return null;
  }
  return normalized;
};

const getStoredProviders = (): any[] => {
  const providersRaw = safeStorageGetItem('api_providers');
  if (!providersRaw) return [];
  try {
    const providers = JSON.parse(providersRaw);
    return Array.isArray(providers) ? providers : [];
  } catch (error) {
    console.error('Parse providers error', error);
    return [];
  }
};

export const getProviderConfigById = (providerId?: string | null): ProviderConfig => {
  const resolvedId =
    normalizeProviderId(providerId) ||
    normalizeProviderId(safeStorageGetItem('api_provider')) ||
    'yunwu';
  const storedProviders = getStoredProviders();
  const found = storedProviders.find((provider: any) => provider?.id === resolvedId);
  if (found) {
    return found;
  }

  const fallback = FALLBACK_PROVIDER_CONFIGS[resolvedId];
  if (fallback) {
    return {
      ...fallback,
      apiKey:
        fallback.id === 'yunwu'
          ? safeStorageGetItem('yunwu_api_key') || ''
          : fallback.id === 'gemini'
            ? safeStorageGetItem('gemini_api_key') || ''
            : fallback.apiKey || '',
    };
  }

  return { id: resolvedId || 'yunwu', apiKey: '' };
};

export const getProviderConfig = (): ProviderConfig => {
  return getProviderConfigById();
};

export const hasUsableApiKeyForProviderId = (providerId?: string | null): boolean => {
  const normalizedProviderId = normalizeProviderId(providerId);
  if (!normalizedProviderId) return false;
  const keys = getApiKey(true, normalizedProviderId);
  return Array.isArray(keys)
    ? keys.length > 0
    : Boolean(String(keys || '').trim());
};

export const resolveFirstUsableProviderId = (
  providerIds: Array<string | null | undefined>,
): string | null => {
  for (const candidate of providerIds) {
    const normalized = normalizeProviderId(candidate);
    if (!normalized) continue;
    if (hasUsableApiKeyForProviderId(normalized)) {
      return normalized;
    }
  }
  return null;
};

export const getApiKey = (all: boolean = false, providerId?: string | null): string | string[] => {
  const win = window as any;

  if (!providerId && win.aistudio && win.aistudio.getKey) {
    const key = win.aistudio.getKey();
    if (key) return all ? [key] : key;
  }

  const config = getProviderConfigById(providerId);
  const rawKeys = config.apiKey || '';

  if (rawKeys) {
    const keys = rawKeys
      .split('\n')
      .map((key) => key.trim())
      .filter((key) => key && !key.startsWith('#'));

    if (keys.length > 0) {
      if (all) return keys;

      const storageKey = `api_poll_index_${config.id}`;
      let currentIndex = parseInt(safeStorageGetItem(storageKey) || '0', 10);
      if (currentIndex >= keys.length) currentIndex = 0;
      const selectedKey = keys[currentIndex];
      safeLocalStorageSetItem(storageKey, ((currentIndex + 1) % keys.length).toString());
      return selectedKey;
    }
  }

  return all ? [] : '';
};

export const getApiKeyByProviderId = (providerId?: string | null, all: boolean = false): string | string[] => {
  return getApiKey(all, providerId);
};
