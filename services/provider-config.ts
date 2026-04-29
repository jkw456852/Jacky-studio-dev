import { safeLocalStorageSetItem } from '../utils/safe-storage';

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

const getStoredProviders = (): any[] => {
  const providersRaw = localStorage.getItem('api_providers');
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
  const resolvedId = String(providerId || localStorage.getItem('api_provider') || 'yunwu').trim() || 'yunwu';
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
          ? localStorage.getItem('yunwu_api_key') || ''
          : fallback.id === 'gemini'
            ? localStorage.getItem('gemini_api_key') || ''
            : fallback.apiKey || '',
    };
  }

  return { id: resolvedId || 'yunwu', apiKey: '' };
};

export const getProviderConfig = (): ProviderConfig => {
  return getProviderConfigById();
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
      let currentIndex = parseInt(localStorage.getItem(storageKey) || '0', 10);
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
