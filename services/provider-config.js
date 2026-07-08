"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiKeyByProviderId = exports.getApiKey = exports.resolveFirstUsableProviderId = exports.hasUsableApiKeyForProviderId = exports.getProviderConfig = exports.getProviderConfigById = void 0;
var safe_storage_ts_1 = require("../utils/safe-storage.ts");
var FALLBACK_PROVIDER_CONFIGS = {
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
var safeStorageGetItem = function (key) {
    if (typeof localStorage === 'undefined')
        return null;
    try {
        return localStorage.getItem(key);
    }
    catch (_a) {
        return null;
    }
};
var normalizeProviderId = function (providerId) {
    var normalized = String(providerId || '').trim();
    if (!normalized)
        return null;
    if (normalized.toLowerCase() === 'default' || normalized.toLowerCase() === 'auto') {
        return null;
    }
    return normalized;
};
var getStoredProviders = function () {
    var providersRaw = safeStorageGetItem('api_providers');
    if (!providersRaw)
        return [];
    try {
        var providers = JSON.parse(providersRaw);
        return Array.isArray(providers) ? providers : [];
    }
    catch (error) {
        console.error('Parse providers error', error);
        return [];
    }
};
var getProviderConfigById = function (providerId) {
    var resolvedId = normalizeProviderId(providerId) ||
        normalizeProviderId(safeStorageGetItem('api_provider')) ||
        'yunwu';
    var storedProviders = getStoredProviders();
    var found = storedProviders.find(function (provider) { return (provider === null || provider === void 0 ? void 0 : provider.id) === resolvedId; });
    if (found) {
        return found;
    }
    var fallback = FALLBACK_PROVIDER_CONFIGS[resolvedId];
    if (fallback) {
        return __assign(__assign({}, fallback), { apiKey: fallback.id === 'yunwu'
                ? safeStorageGetItem('yunwu_api_key') || ''
                : fallback.id === 'gemini'
                    ? safeStorageGetItem('gemini_api_key') || ''
                    : fallback.apiKey || '' });
    }
    return { id: resolvedId || 'yunwu', apiKey: '' };
};
exports.getProviderConfigById = getProviderConfigById;
var getProviderConfig = function () {
    return (0, exports.getProviderConfigById)();
};
exports.getProviderConfig = getProviderConfig;
var hasUsableApiKeyForProviderId = function (providerId) {
    var normalizedProviderId = normalizeProviderId(providerId);
    if (!normalizedProviderId)
        return false;
    var keys = (0, exports.getApiKey)(true, normalizedProviderId);
    return Array.isArray(keys)
        ? keys.length > 0
        : Boolean(String(keys || '').trim());
};
exports.hasUsableApiKeyForProviderId = hasUsableApiKeyForProviderId;
var resolveFirstUsableProviderId = function (providerIds) {
    for (var _i = 0, providerIds_1 = providerIds; _i < providerIds_1.length; _i++) {
        var candidate = providerIds_1[_i];
        var normalized = normalizeProviderId(candidate);
        if (!normalized)
            continue;
        if ((0, exports.hasUsableApiKeyForProviderId)(normalized)) {
            return normalized;
        }
    }
    return null;
};
exports.resolveFirstUsableProviderId = resolveFirstUsableProviderId;
var getApiKey = function (all, providerId) {
    if (all === void 0) { all = false; }
    var win = window;
    if (!providerId && win.aistudio && win.aistudio.getKey) {
        var key = win.aistudio.getKey();
        if (key)
            return all ? [key] : key;
    }
    var config = (0, exports.getProviderConfigById)(providerId);
    var rawKeys = config.apiKey || '';
    if (rawKeys) {
        var keys = rawKeys
            .split('\n')
            .map(function (key) { return key.trim(); })
            .filter(function (key) { return key && !key.startsWith('#'); });
        if (keys.length > 0) {
            if (all)
                return keys;
            var storageKey = "api_poll_index_".concat(config.id);
            var currentIndex = parseInt(safeStorageGetItem(storageKey) || '0', 10);
            if (currentIndex >= keys.length)
                currentIndex = 0;
            var selectedKey = keys[currentIndex];
            (0, safe_storage_ts_1.safeLocalStorageSetItem)(storageKey, ((currentIndex + 1) % keys.length).toString());
            return selectedKey;
        }
    }
    return all ? [] : '';
};
exports.getApiKey = getApiKey;
var getApiKeyByProviderId = function (providerId, all) {
    if (all === void 0) { all = false; }
    return (0, exports.getApiKey)(all, providerId);
};
exports.getApiKeyByProviderId = getApiKeyByProviderId;
