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
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistEcommerceProductAnalysisDebugSnapshot = void 0;
var shouldPersistEcommerceProductAnalysisDebugSnapshot = function () {
    if (typeof window === "undefined")
        return false;
    var host = String(window.location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
};
var persistEcommerceProductAnalysisDebugSnapshot = function (options) { return __awaiter(void 0, void 0, void 0, function () {
    var response, failureText, persisted, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!shouldPersistEcommerceProductAnalysisDebugSnapshot()) {
                    return [2 /*return*/];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 6, , 7]);
                return [4 /*yield*/, fetch("/api/debug-ecommerce-product-analysis", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            stage: options.stage,
                            payload: options.payload,
                        }),
                    })];
            case 2:
                response = _a.sent();
                if (!!response.ok) return [3 /*break*/, 4];
                return [4 /*yield*/, response.text().catch(function () { return ""; })];
            case 3:
                failureText = _a.sent();
                console.warn("[ecommerceProductAnalysisDebug] snapshot persist failed", {
                    stage: options.stage,
                    status: response.status,
                    bodyPreview: failureText.slice(0, 200),
                });
                return [2 /*return*/];
            case 4: return [4 /*yield*/, response.json().catch(function () { return null; })];
            case 5:
                persisted = _a.sent();
                console.info("[ecommerceProductAnalysisDebug] snapshot persisted", {
                    stage: options.stage,
                    latestSnapshotPath: (persisted === null || persisted === void 0 ? void 0 : persisted.latestSnapshotPath) || null,
                    dailyLogPath: (persisted === null || persisted === void 0 ? void 0 : persisted.dailyLogPath) || null,
                });
                return [3 /*break*/, 7];
            case 6:
                error_1 = _a.sent();
                console.warn("[ecommerceProductAnalysisDebug] snapshot persist failed", {
                    stage: options.stage,
                    error: error_1 instanceof Error ? error_1.message : String(error_1 || "unknown_error"),
                });
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); };
exports.persistEcommerceProductAnalysisDebugSnapshot = persistEcommerceProductAnalysisDebugSnapshot;
