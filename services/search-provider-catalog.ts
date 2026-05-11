export type SearchCatalogAdapterType = 'bing' | 'searxng' | 'tavily' | 'exa' | 'custom';
export type SearchCatalogGroupId = 'official' | 'ai-research' | 'aggregator';
export type SearchCatalogFieldType = 'apiKey' | 'baseUrl' | 'text' | 'select';
export type SearchCatalogCapability = 'web' | 'images';

export interface SearchProviderCatalogFieldOption {
  value: string;
  label: string;
}

export interface SearchProviderCatalogField {
  key: string;
  label: string;
  type: SearchCatalogFieldType;
  placeholder?: string;
  description?: string;
  required?: boolean;
  secret?: boolean;
  rows?: number;
  defaultValue?: string;
  options?: SearchProviderCatalogFieldOption[];
}

export interface SearchProviderCatalogItem {
  id: string;
  label: string;
  shortLabel?: string;
  description: string;
  groupId: SearchCatalogGroupId;
  groupLabel: string;
  adapterType: SearchCatalogAdapterType;
  websiteUrl: string;
  docsUrl: string;
  defaultBaseUrl: string;
  supports: SearchCatalogCapability[];
  supportsUserSuppliedBaseUrl: boolean;
  badges: string[];
  fields: SearchProviderCatalogField[];
}

export const SEARCH_PROVIDER_CATALOG: SearchProviderCatalogItem[] = [
  {
    id: 'bing',
    label: 'Bing Search API',
    shortLabel: 'Bing',
    description: '微软搜索服务，支持网页与图片搜索。',
    groupId: 'official',
    groupLabel: '官方 / 标准 API',
    adapterType: 'bing',
    websiteUrl: 'https://www.microsoft.com/bing',
    docsUrl: 'https://www.microsoft.com/bing',
    defaultBaseUrl: 'https://api.bing.microsoft.com',
    supports: ['web', 'images'],
    supportsUserSuppliedBaseUrl: true,
    badges: ['官方 API', '网页', '图片'],
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'apiKey',
        placeholder: '输入你的 Bing Search API Key',
        description: '必填。',
        required: true,
        secret: true,
        rows: 4,
      },
      {
        key: 'baseUrl',
        label: '可选自定义 Endpoint',
        type: 'baseUrl',
        placeholder: '留空使用默认 Bing 地址',
        description: '一般不用填写。',
      },
    ],
  },
  {
    id: 'searxng',
    label: 'SearXNG',
    description: '兼容 SearXNG 的聚合搜索实例，适合自建或第三方聚合场景。',
    groupId: 'aggregator',
    groupLabel: '聚合 / 自建',
    adapterType: 'searxng',
    websiteUrl: 'https://docs.searxng.org/',
    docsUrl: 'https://docs.searxng.org/',
    defaultBaseUrl: '',
    supports: ['web', 'images'],
    supportsUserSuppliedBaseUrl: true,
    badges: ['聚合实例', '网页', '图片'],
    fields: [
      {
        key: 'baseUrl',
        label: '实例基础地址',
        type: 'baseUrl',
        placeholder: 'https://your-searxng.example.com',
        description: '必填，服务端会把请求代理到该实例的 /search 接口。',
        required: true,
      },
      {
        key: 'apiKey',
        label: 'API Key / Token',
        type: 'apiKey',
        placeholder: '可选：实例要求时填写 API Key / Token',
        description: '若实例开启了鉴权，可在此填写 Token。',
        secret: true,
        rows: 4,
      },
    ],
  },
  {
    id: 'tavily',
    label: 'Tavily',
    description: '面向 AI 研究场景的搜索 API，适合深度检索与问答上下文构建。',
    groupId: 'ai-research',
    groupLabel: 'AI Research Search',
    adapterType: 'tavily',
    websiteUrl: 'https://tavily.com/',
    docsUrl: 'https://docs.tavily.com/',
    defaultBaseUrl: 'https://api.tavily.com',
    supports: ['web'],
    supportsUserSuppliedBaseUrl: true,
    badges: ['Research', '网页'],
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'apiKey',
        placeholder: 'tvly-...',
        description: '必填。适合研究型网页搜索。',
        required: true,
        secret: true,
        rows: 4,
      },
      {
        key: 'baseUrl',
        label: '可选自定义 Endpoint',
        type: 'baseUrl',
        placeholder: '留空时使用 Tavily 官方 Endpoint',
        description: '通常无需填写；仅在你通过企业网关转发时设置。',
      },
    ],
  },
  {
    id: 'exa',
    label: 'Exa',
    description: '偏语义检索的搜索服务，适合知识发现、相似内容搜索与高质量网页发现。',
    groupId: 'ai-research',
    groupLabel: 'AI Research Search',
    adapterType: 'exa',
    websiteUrl: 'https://exa.ai/',
    docsUrl: 'https://docs.exa.ai/',
    defaultBaseUrl: 'https://api.exa.ai',
    supports: ['web'],
    supportsUserSuppliedBaseUrl: true,
    badges: ['Semantic', '网页'],
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'apiKey',
        placeholder: 'exa-...',
        description: '必填。适合语义搜索与高质量网页发现。',
        required: true,
        secret: true,
        rows: 4,
      },
      {
        key: 'baseUrl',
        label: '可选自定义 Endpoint',
        type: 'baseUrl',
        placeholder: '留空时使用 Exa 官方 Endpoint',
        description: '通常无需填写；仅在你通过企业网关转发时设置。',
      },
    ],
  },
  {
    id: 'custom',
    label: '自定义搜索代理',
    shortLabel: 'Custom',
    description: '用于兼容自建搜索网关、企业内部统一代理或其他第三方搜索协议。',
    groupId: 'aggregator',
    groupLabel: '聚合 / 自建',
    adapterType: 'custom',
    websiteUrl: 'https://docs.searxng.org/',
    docsUrl: 'https://docs.searxng.org/',
    defaultBaseUrl: '',
    supports: ['web', 'images'],
    supportsUserSuppliedBaseUrl: true,
    badges: ['自定义', '网页', '图片'],
    fields: [
      {
        key: 'baseUrl',
        label: '代理基础地址',
        type: 'baseUrl',
        placeholder: 'https://your-search-proxy.example.com',
        description: '必填。第一阶段按兼容 SearXNG 的通用 JSON 搜索协议接入。',
        required: true,
      },
      {
        key: 'apiKey',
        label: 'API Key / Token',
        type: 'apiKey',
        placeholder: '可选：按你的代理协议填写 Token / Secret',
        description: '如果代理要求鉴权，可在此填写。',
        secret: true,
        rows: 4,
      },
    ],
  },
];

export const SEARCH_PROVIDER_GROUPS: Array<{
  id: SearchCatalogGroupId;
  label: string;
}> = [
  { id: 'official', label: '官方 / 标准 API' },
  { id: 'ai-research', label: 'AI Research Search' },
  { id: 'aggregator', label: '聚合 / 自建' },
];

const CATALOG_BY_ID = new Map(
  SEARCH_PROVIDER_CATALOG.map((item) => [item.id, item] as const),
);

export const getSearchProviderCatalogItem = (
  id: string | null | undefined,
): SearchProviderCatalogItem | null => {
  if (!id) return null;
  return CATALOG_BY_ID.get(String(id).trim()) || null;
};

export const getSearchProvidersByGroup = (): Array<{
  id: SearchCatalogGroupId;
  label: string;
  items: SearchProviderCatalogItem[];
}> => {
  return SEARCH_PROVIDER_GROUPS.map((group) => ({
    ...group,
    items: SEARCH_PROVIDER_CATALOG.filter((item) => item.groupId === group.id),
  }));
};
