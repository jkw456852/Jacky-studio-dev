export type ImageHostProvider = 'none' | 'imgbb' | 'custom';
export type SearchProviderType = 'bing' | 'searxng' | 'tavily' | 'exa' | 'custom';
export type SearchMode = 'web+images' | 'web' | 'images';
export type SearchSafeSearch = 'off' | 'moderate' | 'strict';
export type SearchTimeRange = 'day' | 'week' | 'month' | 'year' | 'any';
export type SearchCompressionMode = 'none' | 'balanced';

export interface ApiProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  isCustom?: boolean;
}

export interface SearchProviderConfig {
  id: string;
  name: string;
  catalogId?: string;
  providerType: SearchProviderType;
  apiKey: string;
  baseUrl: string;
  isCustom?: boolean;
}

export interface SearchDefaultsConfig {
  enabledByDefault: boolean;
  mode: SearchMode;
  webCount: number;
  imageCount: number;
  safeSearch: SearchSafeSearch;
  timeRange: SearchTimeRange;
  includeDate: boolean;
  compressionMode: SearchCompressionMode;
  blockedDomains: string[];
}

export interface AccountSecretsCustomImageHostConfig {
  uploadUrl: string;
  method: 'POST' | 'PUT';
  fileParamName: string;
  apiKeyParamName: string;
  apiKeyHeaderName: string;
  apiKey: string;
  responsePath: string;
}

export interface StudioAccountSecretsSnapshot {
  version: 1;
  updatedAt: number;
  providers: ApiProviderConfig[];
  activeProviderId: string;
  replicateKey: string;
  klingKey: string;
  imageHost: {
    selectedProvider: ImageHostProvider;
    imgbbKey: string;
    customConfig: AccountSecretsCustomImageHostConfig;
  };
  search: {
    activeProviderId: string;
    providers: SearchProviderConfig[];
    defaults: SearchDefaultsConfig;
  };
}

const DEFAULT_ACTIVE_PROVIDER_ID = 'yunwu';

const DEFAULT_CUSTOM_IMAGE_HOST_CONFIG: AccountSecretsCustomImageHostConfig = {
  uploadUrl: '',
  method: 'POST',
  fileParamName: 'image',
  apiKeyParamName: 'key',
  apiKeyHeaderName: '',
  apiKey: '',
  responsePath: 'data.url',
};

const DEFAULT_IMAGE_HOST_STATE = {
  selectedProvider: 'none' as ImageHostProvider,
  imgbbKey: '',
  customConfig: DEFAULT_CUSTOM_IMAGE_HOST_CONFIG,
};

const DEFAULT_SEARCH_PROVIDERS: SearchProviderConfig[] = [
  {
    id: 'bing',
    name: 'Bing Search API',
    catalogId: 'bing',
    providerType: 'bing',
    apiKey: '',
    baseUrl: 'https://api.bing.microsoft.com',
  },
  {
    id: 'tavily',
    name: 'Tavily',
    catalogId: 'tavily',
    providerType: 'tavily',
    apiKey: '',
    baseUrl: 'https://api.tavily.com',
  },
  {
    id: 'exa',
    name: 'Exa',
    catalogId: 'exa',
    providerType: 'exa',
    apiKey: '',
    baseUrl: 'https://api.exa.ai',
  },
  {
    id: 'searxng',
    name: 'SearXNG',
    catalogId: 'searxng',
    providerType: 'searxng',
    apiKey: '',
    baseUrl: '',
  },
  {
    id: 'custom',
    name: '自定义搜索代理',
    catalogId: 'custom',
    providerType: 'custom',
    apiKey: '',
    baseUrl: '',
    isCustom: true,
  },
];

const DEFAULT_SEARCH_DEFAULTS: SearchDefaultsConfig = {
  enabledByDefault: false,
  mode: 'web+images',
  webCount: 8,
  imageCount: 16,
  safeSearch: 'moderate',
  timeRange: 'any',
  includeDate: false,
  compressionMode: 'balanced',
  blockedDomains: [],
};

const DEFAULT_SEARCH_STATE = {
  activeProviderId: 'bing',
  providers: DEFAULT_SEARCH_PROVIDERS,
  defaults: DEFAULT_SEARCH_DEFAULTS,
};

const DEFAULT_PROVIDERS: ApiProviderConfig[] = [
  { id: 'yunwu', name: 'Yunwu (OpenAI)', baseUrl: 'https://yunwu.ai', apiKey: '' },
  { id: 'plato', name: 'Plato (OpenAI)', baseUrl: 'https://api.bltcy.ai', apiKey: '' },
  { id: 'gemini', name: 'Gemini (Direct)', baseUrl: 'https://generativelanguage.googleapis.com', apiKey: '' },
];

const clone = <T,>(value: T): T => structuredClone(value);

const normalizeString = (value: unknown): string => String(value ?? '').trim();

const getDefaultProviders = (): ApiProviderConfig[] => clone(DEFAULT_PROVIDERS);
const getDefaultSearchProviders = (): SearchProviderConfig[] => clone(DEFAULT_SEARCH_PROVIDERS);
const getDefaultSearchDefaults = (): SearchDefaultsConfig => clone(DEFAULT_SEARCH_DEFAULTS);

const normalizeProviderConfig = (
  value: unknown,
  index: number,
): ApiProviderConfig | null => {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Record<string, unknown>;
  const id = normalizeString(raw.id) || `provider_${index + 1}`;
  const name = normalizeString(raw.name) || id;
  const baseUrl = normalizeString(raw.baseUrl);
  const apiKey = normalizeString(raw.apiKey);
  const isCustom = Boolean(raw.isCustom);

  return {
    id,
    name,
    baseUrl,
    apiKey,
    ...(isCustom ? { isCustom: true } : {}),
  };
};

const normalizeProviders = (value: unknown): ApiProviderConfig[] => {
  const input = Array.isArray(value) ? value : [];
  const normalized = input
    .map((item, index) => normalizeProviderConfig(item, index))
    .filter((item): item is ApiProviderConfig => Boolean(item));

  if (normalized.length === 0) {
    return getDefaultProviders();
  }

  const deduped = new Map<string, ApiProviderConfig>();
  normalized.forEach((provider) => {
    deduped.set(provider.id, provider);
  });

  return Array.from(deduped.values());
};

const normalizeSearchProviderType = (value: unknown): SearchProviderType => {
  const normalized = normalizeString(value).toLowerCase();
  if (
    normalized === 'searxng'
    || normalized === 'tavily'
    || normalized === 'exa'
    || normalized === 'custom'
  ) {
    return normalized;
  }
  return 'bing';
};

const normalizeSearchProviderConfig = (
  value: unknown,
  index: number,
): SearchProviderConfig | null => {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Record<string, unknown>;
  const id = normalizeString(raw.id) || `search_provider_${index + 1}`;
  const providerType = normalizeSearchProviderType(raw.providerType ?? raw.catalogId ?? raw.id);
  const catalogId = normalizeString(raw.catalogId) || id;
  const name = normalizeString(raw.name) || catalogId || id;
  const apiKey = normalizeString(raw.apiKey);
  const baseUrl = normalizeString(raw.baseUrl);
  const isCustom = Boolean(raw.isCustom);

  return {
    id,
    name,
    catalogId,
    providerType,
    apiKey,
    baseUrl,
    ...(isCustom ? { isCustom: true } : {}),
  };
};

const normalizeSearchProviders = (value: unknown): SearchProviderConfig[] => {
  const input = Array.isArray(value) ? value : [];
  const normalized = input
    .map((item, index) => normalizeSearchProviderConfig(item, index))
    .filter((item): item is SearchProviderConfig => Boolean(item));

  const deduped = new Map<string, SearchProviderConfig>();
  getDefaultSearchProviders().forEach((provider) => {
    deduped.set(provider.id, provider);
  });

  normalized.forEach((provider) => {
    const existing = deduped.get(provider.id);
    deduped.set(provider.id, {
      ...existing,
      ...provider,
    });
  });

  return Array.from(deduped.values());
};

const normalizeSearchMode = (value: unknown): SearchMode => {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'web' || normalized === 'images') {
    return normalized;
  }
  return 'web+images';
};

const normalizeSearchSafeSearch = (value: unknown): SearchSafeSearch => {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'off' || normalized === 'strict') {
    return normalized;
  }
  return 'moderate';
};

const normalizeSearchTimeRange = (value: unknown): SearchTimeRange => {
  const normalized = normalizeString(value).toLowerCase();
  if (
    normalized === 'day'
    || normalized === 'week'
    || normalized === 'month'
    || normalized === 'year'
  ) {
    return normalized;
  }
  return 'any';
};

const normalizeSearchCompressionMode = (
  value: unknown,
): SearchCompressionMode => {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'none') {
    return 'none';
  }
  return 'balanced';
};

const normalizeSearchDefaults = (value: unknown): SearchDefaultsConfig => {
  const raw = value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
  const blockedDomains = Array.isArray(raw.blockedDomains)
    ? raw.blockedDomains
        .map((item) => normalizeString(item))
        .filter(Boolean)
        .slice(0, 50)
    : [];

  const webCount = Number(raw.webCount);
  const imageCount = Number(raw.imageCount);

  return {
    enabledByDefault: Boolean(raw.enabledByDefault),
    mode: normalizeSearchMode(raw.mode),
    webCount: Number.isFinite(webCount) ? Math.max(1, Math.min(20, Math.floor(webCount))) : DEFAULT_SEARCH_DEFAULTS.webCount,
    imageCount: Number.isFinite(imageCount) ? Math.max(1, Math.min(50, Math.floor(imageCount))) : DEFAULT_SEARCH_DEFAULTS.imageCount,
    safeSearch: normalizeSearchSafeSearch(raw.safeSearch),
    timeRange: normalizeSearchTimeRange(raw.timeRange),
    includeDate: Boolean(raw.includeDate),
    compressionMode: normalizeSearchCompressionMode(raw.compressionMode),
    blockedDomains,
  };
};

const normalizeCustomImageHostConfig = (
  value: unknown,
): AccountSecretsCustomImageHostConfig => {
  const raw = value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
  const method = normalizeString(raw.method).toUpperCase() === 'PUT' ? 'PUT' : 'POST';

  return {
    uploadUrl: normalizeString(raw.uploadUrl),
    method,
    fileParamName: normalizeString(raw.fileParamName) || DEFAULT_CUSTOM_IMAGE_HOST_CONFIG.fileParamName,
    apiKeyParamName: normalizeString(raw.apiKeyParamName) || DEFAULT_CUSTOM_IMAGE_HOST_CONFIG.apiKeyParamName,
    apiKeyHeaderName: normalizeString(raw.apiKeyHeaderName),
    apiKey: normalizeString(raw.apiKey),
    responsePath: normalizeString(raw.responsePath) || DEFAULT_CUSTOM_IMAGE_HOST_CONFIG.responsePath,
  };
};

const normalizeImageHostProvider = (value: unknown): ImageHostProvider => {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'imgbb' || normalized === 'custom') {
    return normalized;
  }
  return 'none';
};

export const createEmptyAccountSecretsSnapshot = (
  updatedAt = 0,
): StudioAccountSecretsSnapshot => ({
  version: 1,
  updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? Math.floor(updatedAt) : 0,
  providers: getDefaultProviders(),
  activeProviderId: DEFAULT_ACTIVE_PROVIDER_ID,
  replicateKey: '',
  klingKey: '',
  imageHost: clone(DEFAULT_IMAGE_HOST_STATE),
  search: clone(DEFAULT_SEARCH_STATE),
});

export const normalizeAccountSecretsSnapshot = (
  value: unknown,
): StudioAccountSecretsSnapshot => {
  const raw = value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
  const providers = normalizeProviders(raw.providers);
  const updatedAtSource = raw.updatedAt;
  const updatedAt = updatedAtSource === undefined || updatedAtSource === null || updatedAtSource === ''
    ? Date.now()
    : Number(updatedAtSource);
  const requestedActiveProviderId = normalizeString(raw.activeProviderId);
  const activeProviderId = providers.some((provider) => provider.id === requestedActiveProviderId)
    ? requestedActiveProviderId
    : providers.find((provider) => provider.id === DEFAULT_ACTIVE_PROVIDER_ID)?.id
      || providers[0]?.id
      || DEFAULT_ACTIVE_PROVIDER_ID;
  const imageHostRaw = raw.imageHost && typeof raw.imageHost === 'object'
    ? (raw.imageHost as Record<string, unknown>)
    : {};
  const searchRaw = raw.search && typeof raw.search === 'object'
    ? (raw.search as Record<string, unknown>)
    : {};
  const searchProviders = normalizeSearchProviders(searchRaw.providers);
  const requestedSearchProviderId = normalizeString(searchRaw.activeProviderId);
  const searchActiveProviderId = searchProviders.some((provider) => provider.id === requestedSearchProviderId)
    ? requestedSearchProviderId
    : searchProviders[0]?.id || DEFAULT_SEARCH_STATE.activeProviderId;

  return {
    version: 1,
    updatedAt: Number.isFinite(updatedAt) ? Math.max(0, updatedAt) : Date.now(),
    providers,
    activeProviderId,
    replicateKey: normalizeString(raw.replicateKey),
    klingKey: normalizeString(raw.klingKey),
    imageHost: {
      selectedProvider: normalizeImageHostProvider(imageHostRaw.selectedProvider),
      imgbbKey: normalizeString(imageHostRaw.imgbbKey),
      customConfig: normalizeCustomImageHostConfig(imageHostRaw.customConfig),
    },
    search: {
      activeProviderId: searchActiveProviderId,
      providers: searchProviders,
      defaults: normalizeSearchDefaults(searchRaw.defaults),
    },
  };
};
