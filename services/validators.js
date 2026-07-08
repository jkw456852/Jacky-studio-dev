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
exports.validateModelIdentity = validateModelIdentity;
exports.validateProductConsistency = validateProductConsistency;
exports.validateApprovedAnchorConsistency = validateApprovedAnchorConsistency;
var gemini_1 = require("./gemini");
var toInlinePart = function (url, signal) { return __awaiter(void 0, void 0, void 0, function () {
    var m_1, res, blob_1, dataUrl, m, error_1, message;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                if (/^data:image\/.+;base64,/.test(url)) {
                    m_1 = url.match(/^data:([^;]+);base64,(.+)$/);
                    if (!m_1 || !m_1[1] || !m_1[2]) {
                        throw new Error('invalid data url format');
                    }
                    return [2 /*return*/, { inlineData: { mimeType: m_1[1], data: m_1[2] } }];
                }
                return [4 /*yield*/, fetch(url, { signal: signal })];
            case 1:
                res = _a.sent();
                if (!res.ok) {
                    throw new Error("fetch failed: ".concat(res.status, " ").concat(res.statusText));
                }
                return [4 /*yield*/, res.blob()];
            case 2:
                blob_1 = _a.sent();
                return [4 /*yield*/, new Promise(function (resolve, reject) {
                        var reader = new FileReader();
                        reader.onloadend = function () { return resolve(reader.result); };
                        reader.onerror = function () { return reject(new Error('image read failed')); };
                        reader.readAsDataURL(blob_1);
                    })];
            case 3:
                dataUrl = _a.sent();
                m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (!m || !m[1] || !m[2]) {
                    throw new Error('convert image failed: invalid base64 format');
                }
                return [2 /*return*/, { inlineData: { mimeType: m[1], data: m[2] } }];
            case 4:
                error_1 = _a.sent();
                message = error_1 instanceof Error ? error_1.message : String(error_1);
                throw new Error("Failed to process image data: ".concat(message));
            case 5: return [2 /*return*/];
        }
    });
}); };
function parseValidation(text) {
    try {
        if (!text || typeof text !== 'string') {
            return {
                pass: false,
                reasons: ['质检响应为空'],
                suggestedFix: '请检查 API 连接或重试',
            };
        }
        var trimmed = text.trim();
        if (!trimmed) {
            return {
                pass: false,
                reasons: ['质检响应为空'],
                suggestedFix: '请检查 API 连接或重试',
            };
        }
        var json = JSON.parse(trimmed);
        return {
            pass: !!json.pass,
            reasons: Array.isArray(json.reasons) ? json.reasons : (json.reasons ? [String(json.reasons)] : []),
            suggestedFix: typeof json.suggestedFix === 'string' ? json.suggestedFix : undefined,
        };
    }
    catch (error) {
        var errorMsg = error instanceof Error ? error.message : String(error);
        return {
            pass: false,
            reasons: ["\u8D28\u68C0\u54CD\u5E94\u89E3\u6790\u5931\u8D25: ".concat(errorMsg)],
            suggestedFix: '请在 prompt 中强调一致性并重试',
        };
    }
}
function isMissingInputValidation(result) {
    if (result.pass)
        return false;
    var content = __spreadArray(__spreadArray([], (result.reasons || []), true), [result.suggestedFix || ''], false).join('；')
        .toLowerCase();
    if (!content)
        return false;
    return [
        '未提供待检图',
        '待检图信息缺失',
        '锚点图信息缺失',
        '请上传待检图',
        '请上传锚点',
        '无法进行一致性校验',
        'cannot compare',
        'missing anchor',
        'missing candidate',
        'reference image is missing',
    ].some(function (keyword) { return content.includes(keyword); });
}
function isInfrastructureValidationIssue(text) {
    var content = String(text || '').toLowerCase();
    if (!content)
        return false;
    return [
        'validation timeout',
        'timeout',
        'rate limited',
        'too many requests',
        '429',
        '502',
        '503',
        '504',
        'bad gateway',
        'failed to fetch',
        'fetch failed',
        'network',
        'cors',
        'unauthorized',
        'forbidden',
        'api error',
    ].some(function (keyword) { return content.includes(keyword); });
}
function shouldBypassApprovedAnchorValidation(result) {
    if (result.pass)
        return false;
    if (isMissingInputValidation(result))
        return true;
    var content = __spreadArray(__spreadArray([], (result.reasons || []), true), [result.suggestedFix || ''], false).join('；');
    return isInfrastructureValidationIssue(content);
}
function runWithValidationTimeout(runner_1) {
    return __awaiter(this, arguments, void 0, function (runner, timeoutMs) {
        var controller, timeoutId;
        if (timeoutMs === void 0) { timeoutMs = 90000; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    controller = new AbortController();
                    timeoutId = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 3, 4]);
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            timeoutId = setTimeout(function () {
                                controller.abort();
                                reject(new Error("validation timeout after ".concat(Math.round(timeoutMs / 1000), "s")));
                            }, timeoutMs);
                            runner(controller.signal).then(resolve, reject);
                        })];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function validateModelIdentity(anchorSheetUrl, generatedUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var error_2, message;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, runWithValidationTimeout(function (signal) { return __awaiter(_this, void 0, void 0, function () {
                            var _a, anchor, generated, result;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, Promise.all([
                                            toInlinePart(anchorSheetUrl, signal),
                                            toInlinePart(generatedUrl, signal),
                                        ])];
                                    case 1:
                                        _a = _b.sent(), anchor = _a[0], generated = _a[1];
                                        return [4 /*yield*/, (0, gemini_1.generateJsonResponse)({
                                                model: (0, gemini_1.getBestModelId)('text'),
                                                operation: 'validateModelIdentity',
                                                temperature: 0.1,
                                                parts: [
                                                    { text: '你是图像一致性质检器。比较两张图人物是否为同一模特，仅返回 JSON: {"pass":boolean,"reasons":string[],"suggestedFix":string}。重点看脸部骨相、五官比例、肤色和发型。' },
                                                    anchor,
                                                    { text: '上面是模特锚点板。' },
                                                    generated,
                                                    { text: '上面是待检图片。若有明显差异则 pass=false，并给出简短修正建议。' },
                                                ],
                                            })];
                                    case 2:
                                        result = _b.sent();
                                        return [2 /*return*/, parseValidation(result.text)];
                                }
                            });
                        }); })];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_2 = _a.sent();
                    console.warn('[validateModelIdentity] validation failed:', error_2);
                    message = error_2 instanceof Error ? error_2.message : String(error_2);
                    return [2 /*return*/, {
                            pass: false,
                            reasons: ["\u6A21\u7279\u68C0\u67E5\u5F02\u5E38: ".concat(message)],
                            suggestedFix: '请重新上传清晰的模特参考图',
                        }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function validateProductConsistency(productAnchorUrl, generatedUrl, anchorDescription, forbiddenChanges) {
    return __awaiter(this, void 0, void 0, function () {
        var error_3, message;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, runWithValidationTimeout(function (signal) { return __awaiter(_this, void 0, void 0, function () {
                            var _a, anchor, generated, result;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, Promise.all([
                                            toInlinePart(productAnchorUrl, signal),
                                            toInlinePart(generatedUrl, signal),
                                        ])];
                                    case 1:
                                        _a = _b.sent(), anchor = _a[0], generated = _a[1];
                                        return [4 /*yield*/, (0, gemini_1.generateJsonResponse)({
                                                model: (0, gemini_1.getBestModelId)('text'),
                                                operation: 'validateProductConsistency',
                                                temperature: 0.1,
                                                parts: [
                                                    {
                                                        text: "\u4F60\u662F\u7535\u5546\u670D\u88C5\u4E00\u81F4\u6027\u8D28\u68C0\u5668\u3002\u6BD4\u8F83\u4EA7\u54C1\u951A\u70B9\u56FE\u4E0E\u5F85\u68C0\u56FE\uFF0C\u4E25\u683C\u5224\u65AD\u4EA7\u54C1\u662F\u5426\u4E00\u81F4\u3002\n\u951A\u70B9\u63CF\u8FF0: ".concat(anchorDescription, "\n\u7981\u6B62\u53D8\u5316: ").concat(forbiddenChanges.join('；'), "\n\u4EC5\u8FD4\u56DE JSON: {\"pass\":boolean,\"reasons\":string[],\"suggestedFix\":string}"),
                                                    },
                                                    anchor,
                                                    { text: '上面是产品锚点图。' },
                                                    generated,
                                                    { text: '上面是待检图。若版型、结构线、颜色块、材质纹理有变化则 pass=false。' },
                                                ],
                                            })];
                                    case 2:
                                        result = _b.sent();
                                        return [2 /*return*/, parseValidation(result.text)];
                                }
                            });
                        }); })];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_3 = _a.sent();
                    console.warn('[validateProductConsistency] validation failed:', error_3);
                    message = error_3 instanceof Error ? error_3.message : String(error_3);
                    return [2 /*return*/, {
                            pass: false,
                            reasons: ["\u4EA7\u54C1\u68C0\u67E5\u5F02\u5E38: ".concat(message)],
                            suggestedFix: '请确保上传的产品参考图清晰可见',
                        }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// 冷却缓存：同一对图片 30 秒内不重复调用 API
var _anchorValidationCache = new Map();
var ANCHOR_VALIDATION_COOLDOWN_MS = 30000;
function validateApprovedAnchorConsistency(approvedUrl, candidateUrl, summaryText, forbiddenChanges, genPrompt) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheKey, cached, finalResult, error_4, message;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!approvedUrl || !candidateUrl) {
                        return [2 /*return*/, { pass: true, reasons: [] }];
                    }
                    cacheKey = "".concat(approvedUrl, "||").concat(candidateUrl);
                    cached = _anchorValidationCache.get(cacheKey);
                    if (cached && Date.now() - cached.ts < ANCHOR_VALIDATION_COOLDOWN_MS) {
                        console.log('[validateApprovedAnchorConsistency] cache hit, skipping API call');
                        return [2 /*return*/, cached.result];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, runWithValidationTimeout(function (signal) { return __awaiter(_this, void 0, void 0, function () {
                            var _a, anchor, generated, promptSection, result, parsed;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, Promise.all([
                                            toInlinePart(approvedUrl, signal),
                                            toInlinePart(candidateUrl, signal),
                                        ])];
                                    case 1:
                                        _a = _b.sent(), anchor = _a[0], generated = _a[1];
                                        promptSection = genPrompt
                                            ? "\n\u751F\u56FE\u5173\u952E\u8BCD\uFF08\u6700\u9AD8\u4F18\u5148\u7EA7\uFF0C\u4E0E\u53C2\u8003\u56FE\u51B2\u7A81\u65F6\u4EE5\u6B64\u4E3A\u51C6\uFF09: ".concat(genPrompt)
                                            : '';
                                        return [4 /*yield*/, (0, gemini_1.generateJsonResponse)({
                                                model: (0, gemini_1.getBestModelId)('text'),
                                                operation: 'validateApprovedAnchorConsistency',
                                                temperature: 0.1,
                                                parts: [
                                                    {
                                                        text: "\u4F60\u662F\u901A\u7528\u8BBE\u8BA1\u4E00\u81F4\u6027\u8D28\u68C0\u5668\u3002\u6BD4\u8F83\u5DF2\u6279\u51C6\u951A\u70B9\u56FE\u4E0E\u5F85\u68C0\u56FE\uFF0C\u5224\u65AD\u662F\u5426\u4ECD\u5C5E\u4E8E\u540C\u4E00\u8BBE\u8BA1\u8FDE\u7EED\u7248\u672C\u3002".concat(promptSection, "\n\u951A\u70B9\u6458\u8981: ").concat(summaryText || '无', "\n\u7981\u6B62\u53D8\u5316: ").concat((forbiddenChanges || []).join('；') || '无', "\n\n\u91CD\u8981\u89C4\u5219\uFF1A\u82E5\u63D0\u4F9B\u4E86\u751F\u56FE\u5173\u952E\u8BCD\uFF0C\u5219\u4EE5\u5173\u952E\u8BCD\u63CF\u8FF0\u7684\u8BBE\u8BA1\u610F\u56FE\u4E3A\u6700\u7EC8\u57FA\u51C6\uFF1B\u53C2\u8003\u56FE\u4EC5\u4F5C\u8F85\u52A9\u53C2\u8003\uFF0C\u5F53\u53C2\u8003\u56FE\u4E0E\u5173\u952E\u8BCD\u5B58\u5728\u51B2\u7A81\u65F6\uFF0C\u4EE5\u5173\u952E\u8BCD\u4E3A\u51C6\u5224\u65AD\u5F85\u68C0\u56FE\u662F\u5426\u5408\u683C\u3002\n\u4EC5\u8FD4\u56DE JSON: {\"pass\":boolean,\"reasons\":string[],\"suggestedFix\":string}"),
                                                    },
                                                    anchor,
                                                    { text: '上面是已批准的设计锚点图（辅助参考）。' },
                                                    generated,
                                                    { text: '上面是待检图。若主体身份、logo位置、关键配色、结构或文案布局明显偏离基准（关键词优先，无关键词则以锚点图为准），则 pass=false。' },
                                                ],
                                            })];
                                    case 2:
                                        result = _b.sent();
                                        parsed = parseValidation(result.text);
                                        if (shouldBypassApprovedAnchorValidation(parsed)) {
                                            return [2 /*return*/, { pass: true, reasons: [] }];
                                        }
                                        return [2 /*return*/, parsed];
                                }
                            });
                        }); })];
                case 2:
                    finalResult = _a.sent();
                    _anchorValidationCache.set(cacheKey, { result: finalResult, ts: Date.now() });
                    return [2 /*return*/, finalResult];
                case 3:
                    error_4 = _a.sent();
                    console.warn('[validateApprovedAnchorConsistency] validation failed:', error_4);
                    message = error_4 instanceof Error ? error_4.message : String(error_4);
                    if (isInfrastructureValidationIssue(message)) {
                        return [2 /*return*/, { pass: true, reasons: [] }];
                    }
                    return [2 /*return*/, {
                            pass: false,
                            reasons: ["\u4E00\u81F4\u6027\u8D28\u68C0\u5F02\u5E38: ".concat(message)],
                            suggestedFix: '请重试或检查图片质量',
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
