"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOpenAIUrl = exports.buildOpenAIFormHeaders = exports.buildOpenAIHeaders = exports.normalizeApiKeyCandidates = exports.resolveOpenAIAuthPlans = exports.shouldAllowQueryAuthFallback = exports.buildOpenAIPath = exports.clearCachedOpenAIAuthMode = exports.setCachedOpenAIAuthMode = exports.getCachedOpenAIAuthMode = exports.getOpenAIAuthCacheEntryKey = exports.isServerError = exports.isRateLimited = exports.shouldTryAlternateAuth = exports.normalizeUrl = void 0;
var safe_storage_ts_1 = require("../../utils/safe-storage.ts");
var OPENAI_QUERY_AUTH_BLOCKED_HOSTS = new Set([
    'api3.wlai.vip',
    'api.xcode.best',
]);
var OPENAI_QUERY_AUTH_BLOCKED_HOST_PATH_PREFIXES = {
    'api.bltcy.ai': ['/v1/images/edits', '/v1/images/generations'],
};
var OPENAI_AUTH_MODE_CACHE_KEY = 'openai_auth_mode_cache_v1';
var openAIAuthModeMemoryCache = new Map();
var normalizeUrl = function (baseUrl) {
    var url = (baseUrl || '').trim().replace(/\/+$/, '');
    if (!url)
        return 'https://generativelanguage.googleapis.com';
    return url;
};
exports.normalizeUrl = normalizeUrl;
var shouldTryAlternateAuth = function (status) {
    return status === 401 || status === 403 || status === 404;
};
exports.shouldTryAlternateAuth = shouldTryAlternateAuth;
var isRateLimited = function (status) {
    return status === 429;
};
exports.isRateLimited = isRateLimited;
var isServerError = function (status) {
    return status >= 500 && status < 600;
};
exports.isServerError = isServerError;
var readOpenAIAuthModeCache = function () {
    if (typeof window === 'undefined')
        return {};
    try {
        var raw = window.localStorage.getItem(OPENAI_AUTH_MODE_CACHE_KEY);
        if (!raw)
            return {};
        var parsed = JSON.parse(raw);
        var normalized_1 = {};
        Object.entries(parsed || {}).forEach(function (_a) {
            var key = _a[0], value = _a[1];
            if (value === 'bearer' || value === 'query') {
                normalized_1[key] = value;
            }
        });
        return normalized_1;
    }
    catch (_a) {
        return {};
    }
};
var writeOpenAIAuthModeCache = function (cache) {
    if (typeof window === 'undefined')
        return;
    (0, safe_storage_ts_1.safeLocalStorageSetItem)(OPENAI_AUTH_MODE_CACHE_KEY, JSON.stringify(cache));
};
var getOpenAIAuthCacheEntryKey = function (baseUrl, path) {
    var root = (0, exports.normalizeUrl)(baseUrl || '').toLowerCase();
    var normalizedPath = String(path || '').trim() || '/v1/chat/completions';
    return "".concat(root, "::").concat(normalizedPath);
};
exports.getOpenAIAuthCacheEntryKey = getOpenAIAuthCacheEntryKey;
var getCachedOpenAIAuthMode = function (cacheKey) {
    var memoryHit = openAIAuthModeMemoryCache.get(cacheKey);
    if (memoryHit)
        return memoryHit;
    var persisted = readOpenAIAuthModeCache()[cacheKey];
    if (persisted) {
        openAIAuthModeMemoryCache.set(cacheKey, persisted);
        return persisted;
    }
    return undefined;
};
exports.getCachedOpenAIAuthMode = getCachedOpenAIAuthMode;
var setCachedOpenAIAuthMode = function (cacheKey, mode) {
    openAIAuthModeMemoryCache.set(cacheKey, mode);
    var persisted = readOpenAIAuthModeCache();
    persisted[cacheKey] = mode;
    writeOpenAIAuthModeCache(persisted);
};
exports.setCachedOpenAIAuthMode = setCachedOpenAIAuthMode;
var clearCachedOpenAIAuthMode = function (cacheKey) {
    openAIAuthModeMemoryCache.delete(cacheKey);
    var persisted = readOpenAIAuthModeCache();
    if (persisted[cacheKey]) {
        delete persisted[cacheKey];
        writeOpenAIAuthModeCache(persisted);
    }
};
exports.clearCachedOpenAIAuthMode = clearCachedOpenAIAuthMode;
var buildOpenAIPath = function (baseUrl, path) {
    var root = (0, exports.normalizeUrl)(baseUrl);
    return path.startsWith('/') ? "".concat(root).concat(path) : "".concat(root, "/").concat(path);
};
exports.buildOpenAIPath = buildOpenAIPath;
var shouldAllowQueryAuthFallback = function (baseUrl, path) {
    var normalizedPath = String(path || '').trim() || '/v1/chat/completions';
    try {
        var host = new URL((0, exports.normalizeUrl)(baseUrl || '')).host.toLowerCase();
        var blockedPrefixes = OPENAI_QUERY_AUTH_BLOCKED_HOST_PATH_PREFIXES[host] || [];
        if (blockedPrefixes.some(function (prefix) { return normalizedPath.startsWith(prefix); })) {
            return false;
        }
        if (normalizedPath !== '/v1/chat/completions') {
            return true;
        }
        if (OPENAI_QUERY_AUTH_BLOCKED_HOSTS.has(host)) {
            return false;
        }
    }
    catch (_a) {
        if (normalizedPath !== '/v1/chat/completions') {
            return true;
        }
    }
    return true;
};
exports.shouldAllowQueryAuthFallback = shouldAllowQueryAuthFallback;
var resolveOpenAIAuthPlans = function (cachedMode, authStrategy, allowQueryFallback) {
    if (authStrategy === 'bearer-only')
        return ['bearer'];
    if (authStrategy === 'query-only')
        return ['query'];
    if (!allowQueryFallback) {
        return ['bearer'];
    }
    if (cachedMode === 'bearer' || cachedMode === 'query') {
        var alternateMode = cachedMode === 'bearer' ? 'query' : 'bearer';
        return [cachedMode, alternateMode];
    }
    return ['bearer', 'query'];
};
exports.resolveOpenAIAuthPlans = resolveOpenAIAuthPlans;
var normalizeApiKeyCandidates = function (apiKeyOrKeys) {
    var rawKeys = Array.isArray(apiKeyOrKeys)
        ? apiKeyOrKeys
        : String(apiKeyOrKeys || '').split('\n');
    return Array.from(new Set(rawKeys
        .map(function (key) { return String(key || '').trim(); })
        .filter(function (key) { return key.length > 0 && !key.startsWith('#'); })));
};
exports.normalizeApiKeyCandidates = normalizeApiKeyCandidates;
var buildOpenAIHeaders = function (authMode, apiKey) {
    var headers = {
        'Content-Type': 'application/json',
    };
    if (authMode === 'bearer') {
        headers['Authorization'] = "Bearer ".concat(apiKey);
    }
    return headers;
};
exports.buildOpenAIHeaders = buildOpenAIHeaders;
var buildOpenAIFormHeaders = function (authMode, apiKey) {
    var headers = {};
    if (authMode === 'bearer') {
        headers['Authorization'] = "Bearer ".concat(apiKey);
    }
    return headers;
};
exports.buildOpenAIFormHeaders = buildOpenAIFormHeaders;
var buildOpenAIUrl = function (baseUrl, path, authMode, apiKey) {
    var base = (0, exports.buildOpenAIPath)(baseUrl, path);
    if (authMode === 'query') {
        return "".concat(base).concat(base.includes('?') ? '&' : '?', "key=").concat(encodeURIComponent(apiKey));
    }
    return base;
};
exports.buildOpenAIUrl = buildOpenAIUrl;
