import { fetchAvailableModels } from './gemini';
import { safeLocalStorageSetItem } from '../utils/safe-storage';

export type ModelCategory = 'script' | 'image' | 'video';
export type ModelBrand =
  | 'Google'
  | 'OpenAI'
  | 'Anthropic'
  | 'DeepSeek'
  | 'Volcengine'
  | 'Bailian'
  | 'ChatGLM'
  | 'Wenxin'
  | 'Minimax'
  | 'Grok'
  | 'Moonshot'
  | 'Flux'
  | 'Ideogram'
  | 'Fal'
  | 'Replicate'
  | 'Midjourney'
  | 'Other';

export interface ModelInfo {
  id: string;
  name: string;
  brand?: ModelBrand;
  category: ModelCategory;
  provider?: string;
  providerId?: string;
}

export interface ApiProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  isCustom?: boolean;
}

export interface LoadedProviderSettings {
  providers: ApiProviderConfig[];
  activeProviderId: string;
  replicateKey: string;
  klingKey: string;
  selectedScriptModels: string[];
  selectedImageModels: string[];
  selectedVideoModels: string[];
  imageModelPostPaths: Record<string, ImageModelPostPathConfig>;
  visualOrchestratorModel: string;
  browserAgentModel: string;
  visualOrchestratorMaxReferenceImages: number;
  visualOrchestratorMaxInlineImageBytesMb: number;
  visualContinuity: boolean;
  systemModeration: boolean;
  autoSave: boolean;
  concurrentCount: number;
}

export interface MappedModelConfig {
  raw: string;
  providerId: string | null;
  providerName: string | null;
  modelId: string;
  category: ModelCategory;
  displayLabel: string;
}

export interface ImageModelPostPathConfig {
  withReferences: string;
  withoutReferences: string;
}

export interface ResolvedImageModelPostPathConfig extends ImageModelPostPathConfig {
  defaultWithReferences: string;
  defaultWithoutReferences: string;
  hasCustomWithReferences: boolean;
  hasCustomWithoutReferences: boolean;
}

const DEFAULT_SCRIPT_MODEL = 'gemini-3.1-flash-lite-preview';
const DEFAULT_IMAGE_MODEL = 'gemini-3-pro-image-preview';
const DEFAULT_VIDEO_MODEL = 'veo-3.1-fast-generate-preview';
const DEFAULT_VISUAL_ORCHESTRATOR_MODEL = 'auto';
const DEFAULT_BROWSER_AGENT_MODEL = 'auto';
const DEFAULT_VISUAL_ORCHESTRATOR_MAX_REFERENCE_IMAGES = 0;
const DEFAULT_VISUAL_ORCHESTRATOR_MAX_INLINE_IMAGE_BYTES_MB = 48;
const AUTO_IMAGE_OPTION_ID = 'Auto';
const MODEL_ENTRY_SEPARATOR = '@@';
const IMAGE_MODEL_POST_PATHS_STORAGE_KEY = 'setting_image_model_post_paths';

const IMAGE_MODEL_ALIASES: Record<string, string> = {
  Auto: DEFAULT_IMAGE_MODEL,
  'Nano Banana Pro': DEFAULT_IMAGE_MODEL,
  'gemini-3-pro-image-preview': DEFAULT_IMAGE_MODEL,
  NanoBanana2: 'gemini-3.1-flash-image-preview',
  'Nano Banana 2': 'gemini-3.1-flash-image-preview',
  'gemini-3.1-flash-image-preview': 'gemini-3.1-flash-image-preview',
  'Seedream5.0': 'doubao-seedream-5-0-260128',
  'Seedream 5.0': 'doubao-seedream-5-0-260128',
  'Seedream 4': 'doubao-seedream-5-0-260128',
  'doubao-seedream-5-0-260128': 'doubao-seedream-5-0-260128',
  'GPT Image 2': 'gpt-image-2',
  'gpt-image-2': 'gpt-image-2',
  'GPT Image 1.5': 'gpt-image-1.5-all',
  'gpt-image-1.5-all': 'gpt-image-1.5-all',
  'Flux.2 Max': 'flux-pro-max',
  'flux-pro-max': 'flux-pro-max',
};

const VIDEO_MODEL_ALIASES: Record<string, string> = {
  'veo-3.1-fast': DEFAULT_VIDEO_MODEL,
  'veo-3.1-fast-generate-preview': DEFAULT_VIDEO_MODEL,
  'Veo 3.1 Fast': DEFAULT_VIDEO_MODEL,
  'veo-3.1': 'veo-3.1-generate-preview',
  'Veo 3.1': 'veo-3.1-generate-preview',
  'Veo 3.1 Pro': 'veo-3.1-generate-preview',
  'veo3.1-4k': 'veo-3.1-generate-preview',
  'veo3.1-c': 'veo-3.1-generate-preview',
  'Sora 2': 'sora-2',
};

const SCRIPT_MODEL_ALIASES: Record<string, string> = {
  'Gemini 3.1 Pro': 'gemini-3.1-pro-preview',
  'Gemini 3 Pro': 'gemini-3-pro-preview',
  'Gemini 3.1 Flash Lite': DEFAULT_SCRIPT_MODEL,
  'gemini-3.1-flash-lite-preview': DEFAULT_SCRIPT_MODEL,
};

const MODEL_DISPLAY_LABELS: Record<string, string> = {
  [DEFAULT_IMAGE_MODEL]: 'Nano Banana Pro',
  'gemini-3.1-flash-image-preview': 'Nano Banana 2',
  'doubao-seedream-5-0-260128': 'Seedream 5.0',
  'gpt-image-2': 'GPT Image 2',
  'gpt-image-1.5-all': 'GPT Image 1.5',
  'flux-pro-max': 'Flux.2 Max',
  'veo-3.1-fast-generate-preview': 'Veo 3.1 Fast',
  'veo-3.1-generate-preview': 'Veo 3.1 Pro',
  'sora-2': 'Sora 2',
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
  'gemini-3-pro-preview': 'Gemini 3 Pro',
  [DEFAULT_SCRIPT_MODEL]: 'Gemini 3.1 Flash Lite',
};

const getLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

const normalizeImageModelPostPath = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      const next = `${url.pathname || ''}${url.search || ''}`.trim();
      return next.startsWith('/') ? next : next ? `/${next}` : '';
    }
  } catch {
    // keep raw fallback
  }

  if (!raw.startsWith('/')) {
    return `/${raw.replace(/^\/+/, '')}`;
  }

  return raw;
};

const getImageModelPostPathStorageKey = (
  providerId: string | null | undefined,
  modelId: string,
): string => {
  return buildMappedModelStorageEntry(
    providerId,
    canonicalizeMappedModelId('image', modelId),
  );
};

const parseStoredImageModelPostPaths = (
  value: string | null,
): Record<string, ImageModelPostPathConfig> => {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};

    return Object.entries(parsed).reduce<Record<string, ImageModelPostPathConfig>>((acc, [entry, config]) => {
      const parsedEntry = parseMappedModelStorageEntry('image', entry);
      if (!parsedEntry.modelId) return acc;

      const rawConfig = config && typeof config === 'object'
        ? config as Record<string, unknown>
        : {};
      const withReferences = normalizeImageModelPostPath(rawConfig.withReferences);
      const withoutReferences = normalizeImageModelPostPath(rawConfig.withoutReferences);

      if (!withReferences && !withoutReferences) {
        return acc;
      }

      acc[getImageModelPostPathStorageKey(parsedEntry.providerId, parsedEntry.modelId)] = {
        withReferences,
        withoutReferences,
      };
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const getStoredImageModelPostPaths = (): Record<string, ImageModelPostPathConfig> => {
  const storage = getLocalStorage();
  return parseStoredImageModelPostPaths(storage?.getItem(IMAGE_MODEL_POST_PATHS_STORAGE_KEY) || null);
};

const getDefaultImageModelPostPaths = (
  providerId: string | null | undefined,
  modelId: string,
): ImageModelPostPathConfig => {
  const normalizedProviderId = String(providerId || '').trim();
  const normalizedModelId = canonicalizeMappedModelId('image', modelId);

  if (normalizedProviderId === 'yunwu' && normalizedModelId === 'gemini-3.1-flash-image-preview') {
    return {
      withReferences: '/v1beta/models/gemini-3.1-flash-image-preview:generateContent',
      withoutReferences: '/v1beta/models/gemini-3.1-flash-image-preview:generateContent',
    };
  }

  if (normalizedProviderId === 'yunwu' && normalizedModelId === 'gemini-3-pro-image-preview') {
    return {
      withReferences: '/v1beta/models/gemini-3-pro-image-preview:generateContent',
      withoutReferences: '/v1beta/models/gemini-3-pro-image-preview:generateContent',
    };
  }

  if (normalizedProviderId === 'plato' && normalizedModelId === 'gpt-image-2') {
    return {
      withReferences: '/v1/images/edits',
      withoutReferences: '/v1/images/generations',
    };
  }

  if (normalizedModelId === 'gpt-image-2' || normalizedModelId === 'gpt-image-1.5-all') {
    return {
      withReferences: '/v1/images/edits',
      withoutReferences: '/v1/images/generations',
    };
  }

  return {
    withReferences: `/v1beta/models/${normalizedModelId}:generateContent`,
    withoutReferences: `/v1beta/models/${normalizedModelId}:generateContent`,
  };
};

const sanitizeImageModelPostPathSettings = (
  settings: Record<string, ImageModelPostPathConfig> | undefined,
): Record<string, ImageModelPostPathConfig> => {
  if (!settings || typeof settings !== 'object') return {};

  return Object.entries(settings).reduce<Record<string, ImageModelPostPathConfig>>((acc, [entry, config]) => {
    const parsedEntry = parseMappedModelStorageEntry('image', entry);
    if (!parsedEntry.modelId) return acc;

    const withReferences = normalizeImageModelPostPath(config?.withReferences);
    const withoutReferences = normalizeImageModelPostPath(config?.withoutReferences);
    if (!withReferences && !withoutReferences) return acc;

    acc[getImageModelPostPathStorageKey(parsedEntry.providerId, parsedEntry.modelId)] = {
      withReferences,
      withoutReferences,
    };
    return acc;
  }, {});
};

export const resolveImageModelPostPath = (args: {
  providerId?: string | null;
  modelId: string;
  hasReferences: boolean;
}): string => {
  const resolved = getResolvedImageModelPostPathConfig(args);
  return args.hasReferences ? resolved.withReferences : resolved.withoutReferences;
};

export const getResolvedImageModelPostPathConfig = (args: {
  providerId?: string | null;
  modelId: string;
}): ResolvedImageModelPostPathConfig => {
  const key = getImageModelPostPathStorageKey(args.providerId, args.modelId);
  const config = getStoredImageModelPostPaths()[key];
  const defaults = getDefaultImageModelPostPaths(args.providerId, args.modelId);
  const customWithReferences = normalizeImageModelPostPath(config?.withReferences);
  const customWithoutReferences = normalizeImageModelPostPath(config?.withoutReferences);

  return {
    withReferences: customWithReferences || defaults.withReferences,
    withoutReferences: customWithoutReferences || defaults.withoutReferences,
    defaultWithReferences: defaults.withReferences,
    defaultWithoutReferences: defaults.withoutReferences,
    hasCustomWithReferences: Boolean(customWithReferences),
    hasCustomWithoutReferences: Boolean(customWithoutReferences),
  };
};

export const getDefaultProviders = (): ApiProviderConfig[] => {
  return [
    { id: 'yunwu', name: 'Yunwu (OpenAI)', baseUrl: 'https://yunwu.ai', apiKey: '' },
    { id: 'plato', name: 'Plato (OpenAI)', baseUrl: 'https://api.bltcy.ai', apiKey: '' },
    { id: 'gemini', name: 'Gemini (Direct)', baseUrl: 'https://generativelanguage.googleapis.com', apiKey: '' },
  ];
};

const getProviderNameMap = (providers?: ApiProviderConfig[]): Record<string, string> => {
  const source = providers && providers.length > 0 ? providers : getDefaultProviders();
  return source.reduce<Record<string, string>>((acc, provider) => {
    acc[provider.id] = provider.name;
    return acc;
  }, {});
};

const mergeProviders = (
  storedProviders: ApiProviderConfig[],
  legacyKeys: { geminiKey: string; yunwuKey: string },
): ApiProviderConfig[] => {
  const defaults = getDefaultProviders();
  const mergedDefaults = defaults.map((provider) => {
    const stored = storedProviders.find((item) => item?.id === provider.id);

    if (stored) {
      return {
        ...provider,
        ...stored,
        apiKey: typeof stored.apiKey === 'string' ? stored.apiKey : provider.apiKey,
      };
    }

    if (provider.id === 'gemini' && legacyKeys.geminiKey) {
      return { ...provider, apiKey: legacyKeys.geminiKey };
    }

    if (provider.id === 'yunwu' && legacyKeys.yunwuKey) {
      return { ...provider, apiKey: legacyKeys.yunwuKey };
    }

    return provider;
  });

  const customProviders = storedProviders.filter(
    (provider) => provider && typeof provider.id === 'string' && !defaults.some((item) => item.id === provider.id),
  );

  return [...mergedDefaults, ...customProviders];
};

const normalizeVideoModels = (models: string[]): string[] => {
  if (!Array.isArray(models) || models.length === 0) return [DEFAULT_VIDEO_MODEL];
  const normalized = models.map((modelId) => VIDEO_MODEL_ALIASES[modelId] || modelId).filter(Boolean);
  return Array.from(new Set(normalized));
};

const safeJsonArray = (value: string | null, fallback: string[]): string[] => {
  try {
    const parsed = JSON.parse(value || '[]');
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === 'string');
    }
  } catch {
    // ignore
  }
  return fallback;
};

const clampInteger = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const canonicalizeMappedModelId = (category: ModelCategory, modelId: string): string => {
  const normalized = modelId.trim();
  if (!normalized) return normalized;

  if (category === 'image') {
    return IMAGE_MODEL_ALIASES[normalized] || normalized;
  }

  if (category === 'video') {
    return VIDEO_MODEL_ALIASES[normalized] || normalized;
  }

  return SCRIPT_MODEL_ALIASES[normalized] || normalized;
};

export const buildMappedModelStorageEntry = (providerId: string | null | undefined, modelId: string): string => {
  const normalizedModelId = String(modelId || '').trim();
  if (!normalizedModelId) return '';
  const normalizedProviderId = String(providerId || '').trim();
  return normalizedProviderId ? `${normalizedProviderId}${MODEL_ENTRY_SEPARATOR}${normalizedModelId}` : normalizedModelId;
};

export const parseMappedModelStorageEntry = (
  category: ModelCategory,
  entry: string,
): { raw: string; providerId: string | null; modelId: string } => {
  const raw = String(entry || '').trim();
  if (!raw) {
    return { raw, providerId: null, modelId: '' };
  }

  const separatorIndex = raw.indexOf(MODEL_ENTRY_SEPARATOR);
  if (separatorIndex === -1) {
    return {
      raw,
      providerId: null,
      modelId: canonicalizeMappedModelId(category, raw),
    };
  }

  const providerId = raw.slice(0, separatorIndex).trim() || null;
  const modelId = raw.slice(separatorIndex + MODEL_ENTRY_SEPARATOR.length).trim();
  return {
    raw,
    providerId,
    modelId: canonicalizeMappedModelId(category, modelId),
  };
};

const getStoredProviders = (): ApiProviderConfig[] => {
  const storage = getLocalStorage();
  if (!storage) return getDefaultProviders();

  const storedProviders = storage.getItem('api_providers');
  const geminiKey = storage.getItem('gemini_api_key') || '';
  const yunwuKey = storage.getItem('yunwu_api_key') || '';

  if (!storedProviders) {
    return mergeProviders([], { geminiKey, yunwuKey });
  }

  try {
    const parsed = JSON.parse(storedProviders);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return mergeProviders(parsed, { geminiKey, yunwuKey });
    }
  } catch {
    // keep defaults
  }

  return mergeProviders([], { geminiKey, yunwuKey });
};

const getStoredMappingEntries = (category: ModelCategory): string[] => {
  const storage = getLocalStorage();
  if (!storage) {
    if (category === 'image') return [DEFAULT_IMAGE_MODEL];
    if (category === 'video') return [DEFAULT_VIDEO_MODEL];
    return [DEFAULT_SCRIPT_MODEL];
  }

  if (category === 'image') {
    const selected = safeJsonArray(storage.getItem('setting_image_models'), [AUTO_IMAGE_OPTION_ID]);
    if (selected.length === 0) {
      return [AUTO_IMAGE_OPTION_ID];
    }
    return selected;
  }

  if (category === 'video') {
    return safeJsonArray(storage.getItem('setting_video_models'), [DEFAULT_VIDEO_MODEL]);
  }

  return safeJsonArray(storage.getItem('setting_script_models'), [DEFAULT_SCRIPT_MODEL]);
};

export const getModelDisplayLabel = (modelId: string): string => {
  return MODEL_DISPLAY_LABELS[modelId] || modelId;
};

export const getProviderDisplayLabel = (
  providerId: string | null | undefined,
  providers?: ApiProviderConfig[],
): string => {
  const normalizedProviderId = String(providerId || '').trim();
  if (!normalizedProviderId) return '';
  const providerNameMap = getProviderNameMap(providers || getStoredProviders());
  return providerNameMap[normalizedProviderId] || normalizedProviderId;
};

export const normalizeMappedModelId = (
  category: ModelCategory,
  modelId: string,
): string => canonicalizeMappedModelId(category, modelId);

export const getMappedModelConfigs = (
  category: ModelCategory,
  providers?: ApiProviderConfig[],
): MappedModelConfig[] => {
  const providerNameMap = getProviderNameMap(providers || getStoredProviders());
  const entries = getStoredMappingEntries(category);

  const configs = entries
    .map((entry) => parseMappedModelStorageEntry(category, entry))
    .filter((item) => item.modelId)
    .map((item) => ({
      raw: item.raw,
      providerId: item.providerId,
      providerName: item.providerId ? providerNameMap[item.providerId] || item.providerId : null,
      modelId: item.modelId,
      category,
      displayLabel: item.providerId && providerNameMap[item.providerId]
        ? `${getModelDisplayLabel(item.modelId)} @ ${providerNameMap[item.providerId]}`
        : getModelDisplayLabel(item.modelId),
    }));

  if (configs.length > 0) {
    return configs;
  }

  const fallbackModelId = category === 'image'
    ? DEFAULT_IMAGE_MODEL
    : category === 'video'
      ? DEFAULT_VIDEO_MODEL
      : DEFAULT_SCRIPT_MODEL;

  return [{
    raw: fallbackModelId,
    providerId: null,
    providerName: null,
    modelId: fallbackModelId,
    category,
    displayLabel: getModelDisplayLabel(fallbackModelId),
  }];
};

export const getMappedModelIds = (category: ModelCategory): string[] => {
  return getMappedModelConfigs(category).map((item) => item.modelId);
};

export const getMappedPrimaryModelConfig = (
  category: ModelCategory,
  providers?: ApiProviderConfig[],
): MappedModelConfig | null => {
  return getMappedModelConfigs(category, providers)[0] || null;
};

export const findMappedProviderIdForModel = (
  category: ModelCategory,
  modelId: string,
  providers?: ApiProviderConfig[],
): string | null => {
  const normalizedModelId = canonicalizeMappedModelId(category, String(modelId || ''));
  const matched = getMappedModelConfigs(category, providers).find((item) => item.modelId === normalizedModelId);
  return matched?.providerId || null;
};

export const getMappedPrimaryModelLabel = (category: ModelCategory): string => {
  return getMappedPrimaryModelConfig(category)?.displayLabel || '\u672a\u8bbe\u7f6e';
};

export const getVisualOrchestratorModelConfig = (
  providers?: ApiProviderConfig[],
): MappedModelConfig | null => {
  const storage = getLocalStorage();
  const raw = storage?.getItem('setting_visual_orchestrator_model') || DEFAULT_VISUAL_ORCHESTRATOR_MODEL;
  if (!raw || raw === DEFAULT_VISUAL_ORCHESTRATOR_MODEL) {
    return getMappedPrimaryModelConfig('script', providers);
  }

  const parsed = parseMappedModelStorageEntry('script', raw);
  if (!parsed.modelId) {
    return getMappedPrimaryModelConfig('script', providers);
  }

  const providerNameMap = getProviderNameMap(providers || getStoredProviders());
  return {
    raw,
    providerId: parsed.providerId,
    providerName: parsed.providerId ? providerNameMap[parsed.providerId] || parsed.providerId : null,
    modelId: parsed.modelId,
    category: 'script',
    displayLabel: parsed.providerId && providerNameMap[parsed.providerId]
      ? `${getModelDisplayLabel(parsed.modelId)} @ ${providerNameMap[parsed.providerId]}`
      : getModelDisplayLabel(parsed.modelId),
  };
};

export const getVisualOrchestratorModelLabel = (
  providers?: ApiProviderConfig[],
): string => {
  const config = getVisualOrchestratorModelConfig(providers);
  return config?.displayLabel || getMappedPrimaryModelLabel('script');
};

export const getBrowserAgentModelConfig = (
  providers?: ApiProviderConfig[],
): MappedModelConfig | null => {
  const storage = getLocalStorage();
  const raw = storage?.getItem('setting_browser_agent_model') || DEFAULT_BROWSER_AGENT_MODEL;
  if (!raw || raw === DEFAULT_BROWSER_AGENT_MODEL) {
    return getMappedPrimaryModelConfig('script', providers);
  }

  const parsed = parseMappedModelStorageEntry('script', raw);
  if (!parsed.modelId) {
    return getMappedPrimaryModelConfig('script', providers);
  }

  const providerNameMap = getProviderNameMap(providers || getStoredProviders());
  return {
    raw,
    providerId: parsed.providerId,
    providerName: parsed.providerId ? providerNameMap[parsed.providerId] || parsed.providerId : null,
    modelId: parsed.modelId,
    category: 'script',
    displayLabel: parsed.providerId && providerNameMap[parsed.providerId]
      ? `${getModelDisplayLabel(parsed.modelId)} @ ${providerNameMap[parsed.providerId]}`
      : getModelDisplayLabel(parsed.modelId),
  };
};

export const getBrowserAgentModelLabel = (
  providers?: ApiProviderConfig[],
): string => {
  const config = getBrowserAgentModelConfig(providers);
  return config?.displayLabel || getMappedPrimaryModelLabel('script');
};

export const getVisualOrchestratorInputPolicy = (): {
  maxReferenceImages: number;
  maxInlineImageBytesMb: number;
} => {
  const storage = getLocalStorage();
  return {
    maxReferenceImages: clampInteger(
      storage?.getItem('setting_visual_orchestrator_max_reference_images'),
      DEFAULT_VISUAL_ORCHESTRATOR_MAX_REFERENCE_IMAGES,
      0,
      64,
    ),
    maxInlineImageBytesMb: clampInteger(
      storage?.getItem('setting_visual_orchestrator_max_inline_image_bytes_mb'),
      DEFAULT_VISUAL_ORCHESTRATOR_MAX_INLINE_IMAGE_BYTES_MB,
      1,
      64,
    ),
  };
};

export const getMappedModelDisplaySummary = (category: ModelCategory): string => {
  const labels = Array.from(new Set(getMappedModelConfigs(category).map((item) => item.displayLabel).filter(Boolean)));
  if (labels.length === 0) return '\u672a\u8bbe\u7f6e';
  if (labels.length === 1) return labels[0];
  if (labels.length <= 3) return labels.join(' / ');
  return `${labels.slice(0, 2).join(' / ')} +${labels.length - 2}`;
};

export const loadProviderSettings = (): LoadedProviderSettings => {
  const storage = getLocalStorage();
  const providers = getStoredProviders();
  const activeProviderId = storage?.getItem('api_provider') || providers.find((provider) => provider.id === 'yunwu')?.id || providers[0]?.id || 'yunwu';
  const selectedVideoModels = normalizeVideoModels(
    getMappedModelIds('video'),
  );

  safeLocalStorageSetItem('setting_video_models', JSON.stringify(getStoredMappingEntries('video')));

  return {
    providers,
    activeProviderId: providers.some((provider) => provider.id === activeProviderId)
      ? activeProviderId
      : providers.find((provider) => provider.id === 'yunwu')?.id || providers[0]?.id || 'yunwu',
    replicateKey: storage?.getItem('replicate_api_key') || '',
    klingKey: storage?.getItem('kling_api_key') || '',
    selectedScriptModels: getStoredMappingEntries('script'),
    selectedImageModels: getStoredMappingEntries('image'),
    selectedVideoModels: getStoredMappingEntries('video').length > 0 ? getStoredMappingEntries('video') : selectedVideoModels,
    imageModelPostPaths: getStoredImageModelPostPaths(),
    visualOrchestratorModel: storage?.getItem('setting_visual_orchestrator_model') || DEFAULT_VISUAL_ORCHESTRATOR_MODEL,
    browserAgentModel: storage?.getItem('setting_browser_agent_model') || DEFAULT_BROWSER_AGENT_MODEL,
    visualOrchestratorMaxReferenceImages: clampInteger(
      storage?.getItem('setting_visual_orchestrator_max_reference_images'),
      DEFAULT_VISUAL_ORCHESTRATOR_MAX_REFERENCE_IMAGES,
      0,
      64,
    ),
    visualOrchestratorMaxInlineImageBytesMb: clampInteger(
      storage?.getItem('setting_visual_orchestrator_max_inline_image_bytes_mb'),
      DEFAULT_VISUAL_ORCHESTRATOR_MAX_INLINE_IMAGE_BYTES_MB,
      1,
      64,
    ),
    visualContinuity: storage?.getItem('setting_visual_continuity') !== 'false',
    systemModeration: storage?.getItem('setting_system_moderation') === 'true',
    autoSave: storage?.getItem('setting_auto_save') !== 'false',
    concurrentCount: parseInt(storage?.getItem('setting_concurrent_count') || '1', 10),
  };
};

export const saveProviderSettings = (settings: LoadedProviderSettings): void => {
  safeLocalStorageSetItem('api_providers', JSON.stringify(settings.providers));
  safeLocalStorageSetItem('api_provider', settings.activeProviderId);
  safeLocalStorageSetItem('replicate_api_key', settings.replicateKey.trim());
  safeLocalStorageSetItem('kling_api_key', settings.klingKey.trim());
  safeLocalStorageSetItem('setting_script_models', JSON.stringify(settings.selectedScriptModels));
  safeLocalStorageSetItem('setting_image_models', JSON.stringify(settings.selectedImageModels));
  safeLocalStorageSetItem('setting_video_models', JSON.stringify(settings.selectedVideoModels));
  safeLocalStorageSetItem(
    IMAGE_MODEL_POST_PATHS_STORAGE_KEY,
    JSON.stringify(sanitizeImageModelPostPathSettings(settings.imageModelPostPaths)),
  );
  safeLocalStorageSetItem('setting_visual_orchestrator_model', settings.visualOrchestratorModel || DEFAULT_VISUAL_ORCHESTRATOR_MODEL);
  safeLocalStorageSetItem('setting_browser_agent_model', settings.browserAgentModel || DEFAULT_BROWSER_AGENT_MODEL);
  safeLocalStorageSetItem(
    'setting_visual_orchestrator_max_reference_images',
    clampInteger(
      settings.visualOrchestratorMaxReferenceImages,
      DEFAULT_VISUAL_ORCHESTRATOR_MAX_REFERENCE_IMAGES,
      0,
      64,
    ).toString(),
  );
  safeLocalStorageSetItem(
    'setting_visual_orchestrator_max_inline_image_bytes_mb',
    clampInteger(
      settings.visualOrchestratorMaxInlineImageBytesMb,
      DEFAULT_VISUAL_ORCHESTRATOR_MAX_INLINE_IMAGE_BYTES_MB,
      1,
      64,
    ).toString(),
  );
  safeLocalStorageSetItem('setting_visual_continuity', settings.visualContinuity ? 'true' : 'false');
  safeLocalStorageSetItem('setting_system_moderation', settings.systemModeration ? 'true' : 'false');
  safeLocalStorageSetItem('setting_auto_save', settings.autoSave ? 'true' : 'false');
  safeLocalStorageSetItem('setting_concurrent_count', settings.concurrentCount.toString());

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('provider-settings-updated', {
        detail: {
          selectedScriptModels: settings.selectedScriptModels,
          selectedImageModels: settings.selectedImageModels,
          selectedVideoModels: settings.selectedVideoModels,
          imageModelPostPaths: sanitizeImageModelPostPathSettings(settings.imageModelPostPaths),
          visualOrchestratorModel: settings.visualOrchestratorModel || DEFAULT_VISUAL_ORCHESTRATOR_MODEL,
          browserAgentModel: settings.browserAgentModel || DEFAULT_BROWSER_AGENT_MODEL,
          visualOrchestratorMaxReferenceImages: clampInteger(
            settings.visualOrchestratorMaxReferenceImages,
            DEFAULT_VISUAL_ORCHESTRATOR_MAX_REFERENCE_IMAGES,
            0,
            64,
          ),
          visualOrchestratorMaxInlineImageBytesMb: clampInteger(
            settings.visualOrchestratorMaxInlineImageBytesMb,
            DEFAULT_VISUAL_ORCHESTRATOR_MAX_INLINE_IMAGE_BYTES_MB,
            1,
            64,
          ),
        },
      }),
    );
  }
};

export const classifyModel = (modelId: string): Pick<ModelInfo, 'brand' | 'category'> => {
  const lowerId = modelId.toLowerCase();

  let brand: ModelInfo['brand'] = 'Other';
  if (lowerId.includes('gemini') || lowerId.includes('goog') || lowerId.includes('veo') || lowerId.includes('imagen')) brand = 'Google';
  else if (lowerId.includes('gpt') || lowerId.includes('o1-') || lowerId.includes('o3-')) brand = 'OpenAI';
  else if (lowerId.includes('claude')) brand = 'Anthropic';
  else if (lowerId.includes('deepseek')) brand = 'DeepSeek';
  else if (lowerId.includes('doubao') || lowerId.includes('volc')) brand = 'Volcengine';
  else if (lowerId.includes('qw')) brand = 'Bailian';
  else if (lowerId.includes('glm')) brand = 'ChatGLM';
  else if (lowerId.includes('ernie')) brand = 'Wenxin';
  else if (lowerId.includes('minimax')) brand = 'Minimax';
  else if (lowerId.includes('grok')) brand = 'Grok';
  else if (lowerId.includes('moonshot')) brand = 'Moonshot';
  else if (lowerId.includes('flux')) brand = 'Flux';
  else if (lowerId.includes('ideogram')) brand = 'Ideogram';
  else if (lowerId.includes('fal')) brand = 'Fal';
  else if (lowerId.includes('replicate')) brand = 'Replicate';
  else if (lowerId.includes('midjourney')) brand = 'Midjourney';

  let category: ModelCategory = 'script';
  if (lowerId.includes('vision') || lowerId.includes('dall-e') || lowerId.includes('flux') || lowerId.includes('imagen') || lowerId.includes('image') || lowerId.includes('stable-diffusion') || lowerId.includes('midjourney') || lowerId.includes('sdxl') || lowerId.includes('ideogram') || lowerId.includes('kolors') || lowerId.includes('playground') || lowerId.includes('aura') || lowerId.includes('recraft') || lowerId.includes('seedream')) category = 'image';
  else if (lowerId.includes('video') || lowerId.includes('kling') || lowerId.includes('hailuo') || lowerId.includes('veo') || lowerId.includes('luma') || lowerId.includes('sora') || lowerId.includes('pika') || lowerId.includes('gen-2') || lowerId.includes('gen-3') || lowerId.includes('animate') || lowerId.includes('movie')) category = 'video';

  return { brand, category };
};

export const formatModels = (models: string[], providerName: string, providerId?: string): ModelInfo[] => {
  return (models || []).map((id) => {
    const { brand, category } = classifyModel(id);
    return { id, name: id, brand, category, provider: providerName, providerId };
  });
};

export const refreshProviderModels = async (
  providerId: string,
  providers: ApiProviderConfig[],
): Promise<ModelInfo[]> => {
  const provider = providers.find((item) => item.id === providerId);
  if (!provider) return [];
  const keys = provider.apiKey.split('\n').map((item) => item.trim()).filter(Boolean);
  if (keys.length === 0) return [];
  const models = await fetchAvailableModels(providerId, keys, provider.baseUrl);
  return formatModels(models || [], provider.name, provider.id);
};

export const refreshAllProviderModels = async (
  providers: ApiProviderConfig[],
): Promise<ModelInfo[]> => {
  const results = await Promise.all(
    providers.map(async (provider) => {
      try {
        return await refreshProviderModels(provider.id, providers);
      } catch (error) {
        console.warn(`[provider-settings] failed to refresh models for ${provider.id}`, error);
        return [] as ModelInfo[];
      }
    }),
  );

  const merged = results.flat();
  const seen = new Set<string>();
  return merged.filter((model) => {
    const key = `${model.providerId || 'unknown'}::${model.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
