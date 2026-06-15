import { safeLocalStorageSetItem } from '../../utils/safe-storage.ts'

export type OpenAIAuthMode = 'bearer' | 'query'
export type OpenAIAuthStrategy = 'auto' | 'bearer-only' | 'query-only'

const OPENAI_QUERY_AUTH_BLOCKED_HOSTS = new Set<string>([
  'api3.wlai.vip',
  'api.xcode.best',
])

const OPENAI_QUERY_AUTH_BLOCKED_HOST_PATH_PREFIXES: Record<string, string[]> = {
  'api.bltcy.ai': ['/v1/images/edits', '/v1/images/generations'],
}

const OPENAI_AUTH_MODE_CACHE_KEY = 'openai_auth_mode_cache_v1'
const openAIAuthModeMemoryCache = new Map<string, OpenAIAuthMode>()

export const normalizeUrl = (baseUrl: string): string => {
  const url = (baseUrl || '').trim().replace(/\/+$/, '')
  if (!url) return 'https://generativelanguage.googleapis.com'
  return url
}

export const shouldTryAlternateAuth = (status: number): boolean => {
  return status === 401 || status === 403 || status === 404
}

export const isRateLimited = (status: number): boolean => {
  return status === 429
}

export const isServerError = (status: number): boolean => {
  return status >= 500 && status < 600
}

const readOpenAIAuthModeCache = (): Record<string, OpenAIAuthMode> => {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(OPENAI_AUTH_MODE_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const normalized: Record<string, OpenAIAuthMode> = {}
    Object.entries(parsed || {}).forEach(([key, value]) => {
      if (value === 'bearer' || value === 'query') {
        normalized[key] = value
      }
    })
    return normalized
  } catch {
    return {}
  }
}

const writeOpenAIAuthModeCache = (cache: Record<string, OpenAIAuthMode>): void => {
  if (typeof window === 'undefined') return
  safeLocalStorageSetItem(OPENAI_AUTH_MODE_CACHE_KEY, JSON.stringify(cache))
}

export const getOpenAIAuthCacheEntryKey = (baseUrl: string, path: string): string => {
  const root = normalizeUrl(baseUrl || '').toLowerCase()
  const normalizedPath = String(path || '').trim() || '/v1/chat/completions'
  return `${root}::${normalizedPath}`
}

export const getCachedOpenAIAuthMode = (cacheKey: string): OpenAIAuthMode | undefined => {
  const memoryHit = openAIAuthModeMemoryCache.get(cacheKey)
  if (memoryHit) return memoryHit

  const persisted = readOpenAIAuthModeCache()[cacheKey]
  if (persisted) {
    openAIAuthModeMemoryCache.set(cacheKey, persisted)
    return persisted
  }

  return undefined
}

export const setCachedOpenAIAuthMode = (cacheKey: string, mode: OpenAIAuthMode): void => {
  openAIAuthModeMemoryCache.set(cacheKey, mode)
  const persisted = readOpenAIAuthModeCache()
  persisted[cacheKey] = mode
  writeOpenAIAuthModeCache(persisted)
}

export const clearCachedOpenAIAuthMode = (cacheKey: string): void => {
  openAIAuthModeMemoryCache.delete(cacheKey)
  const persisted = readOpenAIAuthModeCache()
  if (persisted[cacheKey]) {
    delete persisted[cacheKey]
    writeOpenAIAuthModeCache(persisted)
  }
}

export const buildOpenAIPath = (baseUrl: string, path: string): string => {
  const root = normalizeUrl(baseUrl)
  return path.startsWith('/') ? `${root}${path}` : `${root}/${path}`
}

export const shouldAllowQueryAuthFallback = (baseUrl: string, path: string): boolean => {
  const normalizedPath = String(path || '').trim() || '/v1/chat/completions'

  try {
    const host = new URL(normalizeUrl(baseUrl || '')).host.toLowerCase()
    const blockedPrefixes = OPENAI_QUERY_AUTH_BLOCKED_HOST_PATH_PREFIXES[host] || []
    if (blockedPrefixes.some((prefix) => normalizedPath.startsWith(prefix))) {
      return false
    }

    if (normalizedPath !== '/v1/chat/completions') {
      return true
    }

    if (OPENAI_QUERY_AUTH_BLOCKED_HOSTS.has(host)) {
      return false
    }
  } catch {
    if (normalizedPath !== '/v1/chat/completions') {
      return true
    }
  }

  return true
}

export const resolveOpenAIAuthPlans = (
  cachedMode: OpenAIAuthMode | undefined,
  authStrategy: OpenAIAuthStrategy,
  allowQueryFallback: boolean,
): OpenAIAuthMode[] => {
  if (authStrategy === 'bearer-only') return ['bearer']
  if (authStrategy === 'query-only') return ['query']

  if (!allowQueryFallback) {
    return ['bearer']
  }

  if (cachedMode === 'bearer' || cachedMode === 'query') {
    const alternateMode: OpenAIAuthMode = cachedMode === 'bearer' ? 'query' : 'bearer'
    return [cachedMode, alternateMode]
  }

  return ['bearer', 'query']
}

export const normalizeApiKeyCandidates = (apiKeyOrKeys: string | string[]): string[] => {
  const rawKeys = Array.isArray(apiKeyOrKeys)
    ? apiKeyOrKeys
    : String(apiKeyOrKeys || '').split('\n')
  return Array.from(
    new Set(
      rawKeys
        .map((key) => String(key || '').trim())
        .filter((key) => key.length > 0 && !key.startsWith('#')),
    ),
  )
}

export const buildOpenAIHeaders = (authMode: OpenAIAuthMode, apiKey: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (authMode === 'bearer') {
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  return headers
}

export const buildOpenAIFormHeaders = (authMode: OpenAIAuthMode, apiKey: string): Record<string, string> => {
  const headers: Record<string, string> = {}
  if (authMode === 'bearer') {
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  return headers
}

export const buildOpenAIUrl = (
  baseUrl: string,
  path: string,
  authMode: OpenAIAuthMode,
  apiKey: string,
): string => {
  const base = buildOpenAIPath(baseUrl, path)
  if (authMode === 'query') {
    return `${base}${base.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`
  }
  return base
}
