"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeReferenceToModelInputDataUrl = exports.normalizeReferenceToDataUrl = exports.isNormalizedImageDataUrl = exports.normalizeImageDataUrlString = void 0;
var api_client_ts_1 = require("./http/api-client.ts");
var imageHost_store_ts_1 = require("../stores/imageHost.store.ts");
var data_url_helpers_ts_1 = require("./agents/data-url-helpers.ts");
exports.normalizeImageDataUrlString = data_url_helpers_ts_1.normalizeImageDataUrlString;
exports.isNormalizedImageDataUrl = data_url_helpers_ts_1.isNormalizedImageDataUrl;
var referenceDataUrlCache = new Map();
var isNetworkFetchError = function (error) {
    var msg = ((error === null || error === void 0 ? void 0 : error.message) || '').toLowerCase();
    return (msg.includes('failed to fetch') ||
        msg.includes('network') ||
        msg.includes('cors') ||
        msg.includes('load failed') ||
        msg.includes('loadfailed') ||
        msg.includes('fetch_image_timeout') ||
        msg.includes('timeout'));
};
var blobToDataUrl = function (blob) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onloadend = function () { return resolve(String(reader.result || '')); };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            })];
    });
}); };
var loadImageFromDataUrl = function (dataUrl) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, new Promise(function (resolve, reject) {
                var image = new Image();
                image.onload = function () { return resolve(image); };
                image.onerror = function () { return reject(new Error('reference image decode failed')); };
                image.src = dataUrl;
            })];
    });
}); };
var flattenTransparentReferenceToWhiteJpeg = function (dataUrl_1) {
    var args_1 = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args_1[_i - 1] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([dataUrl_1], args_1, true), void 0, function (dataUrl, quality) {
        var image, width, height, canvas, context;
        if (quality === void 0) { quality = 0.95; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (typeof document === 'undefined') {
                        return [2 /*return*/, dataUrl];
                    }
                    return [4 /*yield*/, loadImageFromDataUrl(dataUrl)];
                case 1:
                    image = _a.sent();
                    width = Math.max(1, image.naturalWidth || image.width || 1);
                    height = Math.max(1, image.naturalHeight || image.height || 1);
                    canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    context = canvas.getContext('2d');
                    if (!context) {
                        return [2 /*return*/, dataUrl];
                    }
                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, width, height);
                    context.drawImage(image, 0, 0, width, height);
                    return [2 /*return*/, canvas.toDataURL('image/jpeg', quality)];
            }
        });
    });
};
var inferSafeCanvasExportMimeType = function (imageUrl, naturalWidth, naturalHeight) {
    var normalized = String(imageUrl || '').toLowerCase();
    if (normalized.includes('.png') ||
        normalized.includes('image/png') ||
        normalized.includes('.webp') ||
        normalized.includes('image/webp')) {
        return 'image/png';
    }
    if (naturalWidth <= 0 || naturalHeight <= 0) {
        return 'image/png';
    }
    return 'image/jpeg';
};
var fetchReferenceViaServer = function (imageUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var canvasDataUrl, err_1, proxies, _i, proxies_1, proxyUrl, response, blob, e_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('[reference-resolver] Using CORS fallback strategies for:', imageUrl);
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, new Promise(function (resolve, reject) {
                        var img = new Image();
                        img.crossOrigin = 'anonymous'; // Important for preventing tainted canvas
                        img.onload = function () {
                            try {
                                var canvas = document.createElement('canvas');
                                canvas.width = img.naturalWidth || img.width;
                                canvas.height = img.naturalHeight || img.height;
                                var ctx = canvas.getContext('2d');
                                if (!ctx)
                                    throw new Error('No 2d context available');
                                ctx.drawImage(img, 0, 0);
                                var exportMimeType = inferSafeCanvasExportMimeType(imageUrl, img.naturalWidth || img.width, img.naturalHeight || img.height);
                                resolve(exportMimeType === 'image/png'
                                    ? canvas.toDataURL('image/png')
                                    : canvas.toDataURL('image/jpeg', 0.95));
                            }
                            catch (e) {
                                reject(e);
                            }
                        };
                        img.onerror = function () { return reject(new Error('Image load failed')); };
                        // Add cache buster to force clean CORS response
                        img.src = "".concat(imageUrl).concat(imageUrl.includes('?') ? '&' : '?', "corsbuster=").concat(Date.now());
                    })];
            case 2:
                canvasDataUrl = _a.sent();
                console.log('[reference-resolver] Canvas strategy success!');
                return [2 /*return*/, canvasDataUrl];
            case 3:
                err_1 = _a.sent();
                console.warn('[reference-resolver] Canvas bypass strategy failed:', err_1);
                return [3 /*break*/, 4];
            case 4:
                proxies = [
                    "https://api.allorigins.win/raw?url=".concat(encodeURIComponent(imageUrl)),
                    "https://corsproxy.io/?".concat(encodeURIComponent(imageUrl))
                ];
                _i = 0, proxies_1 = proxies;
                _a.label = 5;
            case 5:
                if (!(_i < proxies_1.length)) return [3 /*break*/, 13];
                proxyUrl = proxies_1[_i];
                _a.label = 6;
            case 6:
                _a.trys.push([6, 11, , 12]);
                console.log('[reference-resolver] Trying Proxy:', proxyUrl);
                return [4 /*yield*/, fetch(proxyUrl)];
            case 7:
                response = _a.sent();
                if (!response.ok) return [3 /*break*/, 10];
                return [4 /*yield*/, response.blob()];
            case 8:
                blob = _a.sent();
                return [4 /*yield*/, blobToDataUrl(blob)];
            case 9: return [2 /*return*/, _a.sent()];
            case 10: return [3 /*break*/, 12];
            case 11:
                e_1 = _a.sent();
                console.warn('[reference-resolver] Proxy strategy failed for', proxyUrl, e_1);
                return [3 /*break*/, 12];
            case 12:
                _i++;
                return [3 /*break*/, 5];
            case 13: return [2 /*return*/, null];
        }
    });
}); };
var normalizeReferenceToDataUrl = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var normalizedDataUrl, normalizedInput, cached, entry, logPrefix, safePreview, selectedProvider, preferHostedUrls, resolvePromise, resolved, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!input || typeof input !== 'string')
                    return [2 /*return*/, null];
                normalizedDataUrl = (0, exports.normalizeImageDataUrlString)(input);
                if (normalizedDataUrl)
                    return [2 /*return*/, normalizedDataUrl];
                normalizedInput = String(input || '').trim();
                if (!normalizedInput)
                    return [2 /*return*/, null];
                cached = referenceDataUrlCache.get(normalizedInput);
                if (typeof cached === 'string') {
                    return [2 /*return*/, cached];
                }
                if (cached && typeof cached === 'object' && 'cachedAt' in cached && 'value' in cached) {
                    entry = cached;
                    if (Date.now() - entry.cachedAt < 30000) {
                        return [2 /*return*/, entry.value];
                    }
                    referenceDataUrlCache.delete(normalizedInput);
                }
                logPrefix = '[reference-resolver]';
                safePreview = function (value) {
                    var v = String(value || '').trim();
                    if (!v)
                        return '';
                    if (v.startsWith('data:image/'))
                        return "data:image/...(".concat(v.length, " chars)");
                    return v.length > 160 ? "".concat(v.slice(0, 160), "...") : v;
                };
                selectedProvider = imageHost_store_ts_1.useImageHostStore.getState().selectedProvider;
                preferHostedUrls = selectedProvider !== 'none';
                resolvePromise = (function () { return __awaiter(void 0, void 0, void 0, function () {
                    var res, blob, _a, serverDataUrl, res, serverDataUrl, blob, error_2, serverDataUrl;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                if (!/^blob:/i.test(normalizedInput)) return [3 /*break*/, 6];
                                _b.label = 1;
                            case 1:
                                _b.trys.push([1, 5, , 6]);
                                console.log("".concat(logPrefix, " resolving blob reference:"), safePreview(normalizedInput));
                                return [4 /*yield*/, (0, api_client_ts_1.fetchWithResilience)(normalizedInput, {}, { operation: 'generateImage.resolveBlobReference', retries: 0, timeoutMs: 20000 })];
                            case 2:
                                res = _b.sent();
                                if (!res.ok)
                                    return [2 /*return*/, null];
                                return [4 /*yield*/, res.blob()];
                            case 3:
                                blob = _b.sent();
                                if (!blob.type.startsWith('image/'))
                                    return [2 /*return*/, null];
                                return [4 /*yield*/, blobToDataUrl(blob)];
                            case 4: return [2 /*return*/, _b.sent()];
                            case 5:
                                _a = _b.sent();
                                console.warn("".concat(logPrefix, " blob reference failed, dropping:"), safePreview(normalizedInput));
                                return [2 /*return*/, null];
                            case 6:
                                if (!/^https?:\/\//i.test(normalizedInput)) return [3 /*break*/, 17];
                                console.log("".concat(logPrefix, " resolving url reference:"), safePreview(normalizedInput));
                                if (!(preferHostedUrls && /(^https?:\/\/i\.ibb\.co\/)|(^https?:\/\/ibb\.co\/)/i.test(normalizedInput))) return [3 /*break*/, 8];
                                return [4 /*yield*/, fetchReferenceViaServer(normalizedInput)];
                            case 7:
                                serverDataUrl = _b.sent();
                                if (serverDataUrl) {
                                    return [2 /*return*/, serverDataUrl];
                                }
                                _b.label = 8;
                            case 8:
                                _b.trys.push([8, 15, , 17]);
                                return [4 /*yield*/, (0, api_client_ts_1.fetchWithResilience)(normalizedInput, {}, { operation: 'generateImage.resolveReferenceUrl', retries: 1, timeoutMs: 30000 })];
                            case 9:
                                res = _b.sent();
                                if (!!res.ok) return [3 /*break*/, 12];
                                console.warn("".concat(logPrefix, " url fetch not ok (").concat(res.status, "), will try fallback:"), safePreview(normalizedInput));
                                if (![401, 403, 404, 408, 429, 500, 502, 503, 504].includes(res.status)) return [3 /*break*/, 11];
                                return [4 /*yield*/, fetchReferenceViaServer(normalizedInput)];
                            case 10:
                                serverDataUrl = _b.sent();
                                if (serverDataUrl)
                                    return [2 /*return*/, serverDataUrl];
                                _b.label = 11;
                            case 11: return [2 /*return*/, null];
                            case 12: return [4 /*yield*/, res.blob()];
                            case 13:
                                blob = _b.sent();
                                if (!blob.type.startsWith('image/'))
                                    return [2 /*return*/, null];
                                return [4 /*yield*/, blobToDataUrl(blob)];
                            case 14: return [2 /*return*/, _b.sent()];
                            case 15:
                                error_2 = _b.sent();
                                if (!isNetworkFetchError(error_2)) {
                                    return [2 /*return*/, null];
                                }
                                return [4 /*yield*/, fetchReferenceViaServer(normalizedInput)];
                            case 16:
                                serverDataUrl = _b.sent();
                                if (serverDataUrl) {
                                    return [2 /*return*/, serverDataUrl];
                                }
                                console.warn("".concat(logPrefix, " All attempts failed, continuing without reference:"), safePreview(normalizedInput));
                                return [2 /*return*/, null];
                            case 17: return [2 /*return*/, null];
                        }
                    });
                }); })();
                referenceDataUrlCache.set(normalizedInput, resolvePromise);
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, resolvePromise];
            case 2:
                resolved = _a.sent();
                if (resolved === null) {
                    referenceDataUrlCache.set(normalizedInput, { cachedAt: Date.now(), value: null });
                }
                else {
                    referenceDataUrlCache.set(normalizedInput, resolved);
                }
                return [2 /*return*/, resolved];
            case 3:
                error_1 = _a.sent();
                referenceDataUrlCache.delete(normalizedInput);
                throw error_1;
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.normalizeReferenceToDataUrl = normalizeReferenceToDataUrl;
var normalizeReferenceToModelInputDataUrl = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var normalized, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, exports.normalizeReferenceToDataUrl)(input)];
            case 1:
                normalized = _a.sent();
                if (!normalized)
                    return [2 /*return*/, null];
                if (!/^data:image\/png;base64,/i.test(normalized)) return [3 /*break*/, 5];
                _a.label = 2;
            case 2:
                _a.trys.push([2, 4, , 5]);
                return [4 /*yield*/, flattenTransparentReferenceToWhiteJpeg(normalized)];
            case 3: return [2 /*return*/, _a.sent()];
            case 4:
                error_3 = _a.sent();
                console.warn('[reference-resolver] png flatten failed, keeping original reference:', error_3);
                return [2 /*return*/, normalized];
            case 5: return [2 /*return*/, normalized];
        }
    });
}); };
exports.normalizeReferenceToModelInputDataUrl = normalizeReferenceToModelInputDataUrl;
