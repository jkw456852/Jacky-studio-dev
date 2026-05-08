export type ImageHostProvider = 'none' | 'imgbb' | 'custom';

export interface ApiProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  isCustom?: boolean;
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

const DEFAULT_PROVIDERS: ApiProviderConfig[] = [
  { id: 'yunwu', name: 'Yunwu (OpenAI)', baseUrl: 'https://yunwu.ai', apiKey: '' },
  { id: 'plato', name: 'Plato (OpenAI)', baseUrl: 'https://api.bltcy.ai', apiKey: '' },
  { id: 'gemini', name: 'Gemini (Direct)', baseUrl: 'https://generativelanguage.googleapis.com', apiKey: '' },
];

const clone = <T,>(value: T): T => structuredClone(value);

const normalizeString = (value: unknown): string => String(value ?? '').trim();

const getDefaultProviders = (): ApiProviderConfig[] => clone(DEFAULT_PROVIDERS);

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
  };
};
