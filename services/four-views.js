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
exports.composeFourViews = composeFourViews;
function composeFourViews(input) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, front, left, back, right, cellW, cellH, gap, canvas, ctx, blob;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        loadImage(input.front),
                        loadImage(input.left),
                        loadImage(input.back),
                        loadImage(input.right),
                    ])];
                case 1:
                    _a = _b.sent(), front = _a[0], left = _a[1], back = _a[2], right = _a[3];
                    cellW = Math.max(front.naturalWidth, left.naturalWidth, back.naturalWidth, right.naturalWidth);
                    cellH = Math.max(front.naturalHeight, left.naturalHeight, back.naturalHeight, right.naturalHeight);
                    gap = 12;
                    canvas = document.createElement('canvas');
                    canvas.width = cellW * 2 + gap * 3;
                    canvas.height = cellH * 2 + gap * 3;
                    ctx = canvas.getContext('2d');
                    if (!ctx)
                        throw new Error('无法初始化四视图合成画布');
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    drawCentered(ctx, front, gap, gap, cellW, cellH);
                    drawCentered(ctx, left, cellW + gap * 2, gap, cellW, cellH);
                    drawCentered(ctx, back, gap, cellH + gap * 2, cellW, cellH);
                    drawCentered(ctx, right, cellW + gap * 2, cellH + gap * 2, cellW, cellH);
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            canvas.toBlob(function (b) { return (b ? resolve(b) : reject(new Error('四视图合成失败'))); }, 'image/png', 0.98);
                        })];
                case 2:
                    blob = _b.sent();
                    return [2 /*return*/, URL.createObjectURL(blob)];
            }
        });
    });
}
function drawCentered(ctx, image, x, y, cellW, cellH) {
    var ratio = Math.min(cellW / image.naturalWidth, cellH / image.naturalHeight);
    var drawW = image.naturalWidth * ratio;
    var drawH = image.naturalHeight * ratio;
    var offsetX = x + (cellW - drawW) / 2;
    var offsetY = y + (cellH - drawH) / 2;
    ctx.drawImage(image, offsetX, offsetY, drawW, drawH);
}
function loadImage(url) {
    return new Promise(function (resolve, reject) {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () { return resolve(img); };
        img.onerror = function () { return reject(new Error('加载四视图图片失败')); };
        img.src = url;
    });
}
