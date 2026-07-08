"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNormalizedImageDataUrl = exports.normalizeImageDataUrlString = void 0;
var DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i;
var normalizeBase64Payload = function (value) {
    var sanitized = String(value || '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    var paddingNeeded = sanitized.length % 4;
    if (paddingNeeded === 0)
        return sanitized;
    return sanitized.padEnd(sanitized.length + (4 - paddingNeeded), '=');
};
var normalizeImageDataUrlString = function (input) {
    var normalizedInput = String(input || '').trim();
    if (!normalizedInput)
        return null;
    var match = normalizedInput.match(DATA_URL_RE);
    if (!match)
        return null;
    var mimeType = String(match[1] || '').toLowerCase();
    var base64 = normalizeBase64Payload(match[2] || '');
    if (!base64)
        return null;
    try {
        atob(base64);
    }
    catch (_a) {
        return null;
    }
    return "data:".concat(mimeType, ";base64,").concat(base64);
};
exports.normalizeImageDataUrlString = normalizeImageDataUrlString;
var isNormalizedImageDataUrl = function (input) {
    return Boolean((0, exports.normalizeImageDataUrlString)(input));
};
exports.isNormalizedImageDataUrl = isNormalizedImageDataUrl;
