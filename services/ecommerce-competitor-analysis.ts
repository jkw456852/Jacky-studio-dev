import { Type } from "@google/genai";
import type {
  EcommerceCompetitorDeckAnalysis,
  EcommerceCompetitorDeckInput,
  EcommerceCompetitorImageAnalysisItem,
  EcommerceCompetitorPageAnalysis,
  EcommerceCompetitorPageRole,
  EcommerceCompetitorTextDensity,
} from "../types/workflow.types";
import { generateJsonResponse, getBestModelId } from "./gemini";
import { resolveStoredTopicAssetUrl } from "./topic-memory";
import { useImageHostStore } from "../stores/imageHost.store";
import { uploadImage } from "../utils/uploader";

type CompetitorDeckFailure = {
  deckId: string;
  deckName: string;
  reason: string;
};

export type EcommerceCompetitorAnalysisRunResult = {
  analyses: EcommerceCompetitorDeckAnalysis[];
  failedDecks: CompetitorDeckFailure[];
};

export type CompetitorImageRawAnalysisResult = EcommerceCompetitorImageAnalysisItem;

export type CompetitorVisionSmokeTestResult = {
  recordedAt: string;
  deckId: string;
  deckName?: string;
  imageIndex: number;
  imageUrl?: string;
  requestedModel: string;
  providerId?: string | null;
  baseUrl?: string | null;
  responseId?: string | null;
  responseModel?: string | null;
  finishReason?: string | null;
  responseText: string;
  responsePreview: string;
  nonEmpty: boolean;
  prompt: string;
  imageTransportSummary: Array<Record<string, unknown>>;
  imageInputDiagnostics: ImageInputDiagnostics;
  latestSnapshotPath?: string | null;
  dailyLogPath?: string | null;
};

type ImageInputDiagnostics = {
  imageCount: number;
  transportMode: "none" | "remote_url" | "inline_data" | "mixed";
  imageHostProvider: string;
  remoteImageCount: number;
  inlineImageCount: number;
  remoteHosts: string[];
  upstreamFetchRequired: boolean;
  inlinePayloadRequired: boolean;
  likelyFailureCauses: string[];
};

const DEFAULT_PAGE_ROLE: EcommerceCompetitorPageRole = "other";
const DEFAULT_TEXT_DENSITY: EcommerceCompetitorTextDensity = "medium";
const MAX_DECK_SCREENSHOTS = 8;
const MAX_INLINE_IMAGE_BYTES = 900_000;
const MAX_TOTAL_INLINE_BYTES = 4_800_000;
const MAX_IMAGE_EDGE = 1280;
const COMPRESSED_IMAGE_QUALITY = 0.76;
const ALLOWED_PAGE_ROLES = new Set<EcommerceCompetitorPageRole>([
  "hero",
  "white-bg",
  "selling",
  "scene",
  "comparison",
  "detail",
  "spec",
  "conversion",
  "other",
]);
const ALLOWED_TEXT_DENSITIES = new Set<EcommerceCompetitorTextDensity>([
  "low",
  "medium",
  "high",
]);

const trimText = (value: unknown, max = 160): string =>
  (value && typeof value === "object" && !Array.isArray(value) ? "" : String(value || ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const isEffectivelyEmptyRawAnalysisText = (value: unknown): boolean => {
  const normalized = String(value || "").replace(/\s+/g, "").trim();
  return (
    normalized.length === 0 ||
    normalized === "{}" ||
    normalized === "[]" ||
    normalized === "```json{}```" ||
    normalized === "```{}```"
  );
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const splitLooseStringList = (value: string): string[] => {
  const text = String(value || "").replace(/\r/g, "").trim();
  if (!text) return [];

  if (text.includes("\n")) {
    return text.split(/\n+/);
  }

  if (/[；;]+/.test(text)) {
    return text.split(/[；;]+/);
  }

  if (/\s*(?:->|→|=>|>)\s*/.test(text)) {
    return text.split(/\s*(?:->|→|=>|>)\s*/);
  }

  if (text.length <= 48 && text.includes("、")) {
    return text.split("、");
  }

  return [text];
};

const pickFirstValue = (
  record: Record<string, unknown>,
  keys: string[],
): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return undefined;
};

const pickFirstText = (
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: string[],
  max = 120,
): string => {
  for (const source of sources) {
    const record = asRecord(source);
    const candidate = trimText(pickFirstValue(record, keys), max);
    if (candidate) {
      return candidate;
    }
  }
  return "";
};

const summarizeValueShape = (value: unknown): string => {
  if (Array.isArray(value)) {
    if (value.length === 0) return "array(0)";
    const first = value[0];
    if (typeof first === "string") return `array(${value.length}):string`;
    if (first && typeof first === "object" && !Array.isArray(first)) {
      return `array(${value.length}):object(${Object.keys(asRecord(first)).slice(0, 6).join(",")})`;
    }
    return `array(${value.length}):${typeof first}`;
  }

  if (value && typeof value === "object") {
    return `object(${Object.keys(asRecord(value)).slice(0, 10).join(",")})`;
  }

  return typeof value;
};

const summarizeParsedCompetitorPayload = (
  parsed: unknown,
  normalized: EcommerceCompetitorDeckAnalysis,
) => {
  const raw = asRecord(parsed);
  const topLevelKeys = Object.keys(raw);
  const candidateSchemaKeys = [
    "overview",
    "pageSequence",
    "globalPatterns",
    "planningHints",
    "deckName",
    "deckType",
    "pageFlow",
    "pages",
    "sequence",
    "pageAnalysis",
    "pageBreakdown",
  ].filter((key) => key in raw);

  const keyShapes = topLevelKeys.slice(0, 12).map((key) => ({
    key,
    shape: summarizeValueShape(raw[key]),
  }));

  return {
    topLevelKeys,
    candidateSchemaKeys,
    keyShapes,
    normalizedOverviewFilled: [
      normalized.overview.productPositioning,
      normalized.overview.overallStyle,
      normalized.overview.narrativePattern,
      normalized.overview.conversionStrategy,
    ].filter(Boolean).length,
    normalizedPageCount: normalized.pageSequence.length,
    normalizedRecommendedPageSequence:
      normalized.planningHints.recommendedPageSequence.slice(0, 4),
    normalizedBorrowableCount: normalized.borrowablePrinciples.length,
  };
};

const shouldPersistCompetitorAnalysisDebugSnapshot = (): boolean => {
  if (typeof window === "undefined") return false;
  const host = String(window.location.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
};

const persistCompetitorAnalysisDebugSnapshot = async (payload: {
  deck: EcommerceCompetitorDeckInput;
  requestedModel: string;
  response: Awaited<ReturnType<typeof generateJsonResponse>>;
  parsed: unknown;
  normalized: EcommerceCompetitorDeckAnalysis;
  payloadSummary: ReturnType<typeof summarizeParsedCompetitorPayload> | null;
  imageTransportSummary?: Array<Record<string, unknown>>;
  imageInputDiagnostics?: ImageInputDiagnostics;
  attemptTrace?: Array<Record<string, unknown>>;
  finalStage?: string;
  responseFormat?: "schema" | "text";
  parseError?: string | null;
  failureReason?: string | null;
}) => {
  if (!shouldPersistCompetitorAnalysisDebugSnapshot()) {
    return;
  }

  try {
    const responseMeta = payload.response.meta || {};
    const responseRaw = (payload.response.raw || {}) as Record<string, unknown>;
    const responseChoices = Array.isArray(responseRaw.choices)
      ? (responseRaw.choices as Array<Record<string, unknown>>)
      : [];
    const finishReason = responseChoices[0]?.finish_reason;
    const result = await fetch("/api/debug-competitor-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deckId: payload.deck.id,
        deckName: payload.deck.name || "",
        imageCount: Array.isArray(payload.deck.images) ? payload.deck.images.length : 0,
        providerId: responseMeta.providerId || null,
        baseUrl: responseMeta.baseUrl || null,
        requestedModel: payload.requestedModel || responseMeta.model || null,
        responseId: responseRaw.id ? String(responseRaw.id) : null,
        responseModel:
          responseRaw.model || responseMeta.model
            ? String(responseRaw.model || responseMeta.model)
            : null,
        finishReason: finishReason ? String(finishReason) : null,
        payloadSummary: payload.payloadSummary,
        imageTransportSummary: payload.imageTransportSummary || [],
        imageInputDiagnostics: payload.imageInputDiagnostics || null,
        attemptTrace: payload.attemptTrace || [],
        finalStage: payload.finalStage || null,
        responseFormat: payload.responseFormat || null,
        parseError: payload.parseError || null,
        failureReason: payload.failureReason || null,
        rawText: String(payload.response.text || ""),
        parsedPayload: payload.parsed,
        normalizedAnalysis: payload.normalized,
      }),
    });

    if (!result.ok) {
      const failureText = await result.text().catch(() => "");
      console.warn("[ecomCompetitorDeckAnalysis] debug snapshot persist failed", {
        deckId: payload.deck.id,
        status: result.status,
        bodyPreview: failureText.slice(0, 200),
      });
      return;
    }

    const persisted = await result.json().catch(() => null);
    console.info("[ecomCompetitorDeckAnalysis] debug snapshot persisted", {
      deckId: payload.deck.id,
      latestSnapshotPath: persisted?.latestSnapshotPath || null,
      dailyLogPath: persisted?.dailyLogPath || null,
    });
  } catch (error) {
    console.warn("[ecomCompetitorDeckAnalysis] debug snapshot persist failed", {
      deckId: payload.deck.id,
      error:
        error instanceof Error ? error.message : String(error || "unknown_error"),
    });
  }
};

const parseCompetitorAnalysisResponse = (responseText: string) => {
  const text = String(responseText || "").trim();
  if (!text) {
    return {
      ok: true as const,
      parsed: {},
    };
  }

  try {
    return {
      ok: true as const,
      parsed: JSON.parse(text),
    };
  } catch (error) {
    return {
      ok: false as const,
      parseError:
        error instanceof Error ? error.message : String(error || "json_parse_failed"),
      textPreview: text.slice(0, 700),
    };
  }
};

const persistCompetitorAnalysisFailureSnapshot = async (payload: {
  deck: EcommerceCompetitorDeckInput;
  requestedModel: string;
  response: Awaited<ReturnType<typeof generateJsonResponse>>;
  imageTransportSummary?: Array<Record<string, unknown>>;
  imageInputDiagnostics?: ImageInputDiagnostics;
  attemptTrace?: Array<Record<string, unknown>>;
  finalStage: string;
  responseFormat: "schema" | "text";
  parseError?: string | null;
  failureReason: string;
}) => {
  const fallbackParsed = {};
  const fallbackNormalized = normalizeDeckAnalysis(payload.deck, fallbackParsed);
  const fallbackSummary = summarizeParsedCompetitorPayload(
    fallbackParsed,
    fallbackNormalized,
  );

  await persistCompetitorAnalysisDebugSnapshot({
    deck: payload.deck,
    requestedModel: payload.requestedModel,
    response: payload.response,
    parsed: fallbackParsed,
    normalized: fallbackNormalized,
    payloadSummary: fallbackSummary,
    imageTransportSummary: payload.imageTransportSummary,
    imageInputDiagnostics: payload.imageInputDiagnostics,
    attemptTrace: payload.attemptTrace,
    finalStage: payload.finalStage,
    responseFormat: payload.responseFormat,
    parseError: payload.parseError || null,
    failureReason: payload.failureReason,
  });
};

const persistCompetitorVisionSmokeDebugSnapshot = async (payload: {
  stage: string;
  result: CompetitorVisionSmokeTestResult;
}) => {
  if (!shouldPersistCompetitorAnalysisDebugSnapshot()) {
    return {
      latestSnapshotPath: null,
      dailyLogPath: null,
    };
  }

  try {
    const response = await fetch("/api/debug-competitor-vision-smoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: payload.stage,
        payload: payload.result,
      }),
    });

    if (!response.ok) {
      const failureText = await response.text().catch(() => "");
      console.warn("[ecomCompetitorVisionSmokeTest] debug snapshot persist failed", {
        stage: payload.stage,
        status: response.status,
        bodyPreview: failureText.slice(0, 200),
      });
      return {
        latestSnapshotPath: null,
        dailyLogPath: null,
      };
    }

    const persisted = await response.json().catch(() => null);
    console.info("[ecomCompetitorVisionSmokeTest] debug snapshot persisted", {
      latestSnapshotPath: persisted?.latestSnapshotPath || null,
      dailyLogPath: persisted?.dailyLogPath || null,
    });
    return {
      latestSnapshotPath: persisted?.latestSnapshotPath || null,
      dailyLogPath: persisted?.dailyLogPath || null,
    };
  } catch (error) {
    console.warn("[ecomCompetitorVisionSmokeTest] debug snapshot persist failed", {
      stage: payload.stage,
      error:
        error instanceof Error ? error.message : String(error || "unknown_error"),
    });
    return {
      latestSnapshotPath: null,
      dailyLogPath: null,
    };
  }
};

const normalizeDeckFailureReason = (error: unknown): string => {
  const message =
    error instanceof Error ? error.message : String(error || "竞品详情页分析失败。");
  const lower = message.toLowerCase();

  if (
    lower.includes("413") ||
    lower.includes("content too large") ||
    lower.includes("request size") ||
    lower.includes("too large")
  ) {
    return "竞品截图体积仍然过大，虽然已自动压缩，但这组截图对当前接口来说还是太重。建议先减少到 4 到 8 张关键页后重试。";
  }

  if (
    lower.includes("cors") ||
    lower.includes("cross-origin") ||
    lower.includes("cross origin") ||
    lower.includes("浏览器无法直接访问")
  ) {
    return "当前竞品分析接口不允许浏览器直接跨域访问，或网关在大请求下返回了不带 CORS 的拦截响应。建议优先改用支持浏览器跨域的中转地址，或通过同源服务端代理转发。";
  }

  if (lower.includes("too large to analyze after compression")) {
    return "竞品截图在压缩后仍然过大，建议改成更少页数或先缩图后再分析。";
  }

  if (
    lower.includes("多模型、多页数降载后仍失败") ||
    lower.includes("server error") ||
    lower.includes("503")
  ) {
    return "竞品分析服务当前返回 503。系统已尝试有限重试和备用鉴权/密钥切换，但当前 API 节点仍不可用。请稍后手动重试，或检查当前 API 节点状态。";
  }

  if (
    lower.includes("非 json") ||
    lower.includes("invalid json") ||
    lower.includes("json parse") ||
    lower.includes("unexpected token")
  ) {
    return "竞品分析接口已经返回内容，但返回的不是可用 JSON。当前已把原始返回写入 debug 文件，下一步应先看是模型输出了自然语言，还是供应商包装了别的 schema。";
  }

  return message;
};

const normalizeStringList = (value: unknown, maxItems = 8, maxLength = 100) => {
  const sourceItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? splitLooseStringList(value)
      : [];

  return sourceItems
    .map((item) => trimText(item, maxLength))
    .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index)
    .slice(0, maxItems);
};

const pickFirstStringList = (
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: string[],
  maxItems = 8,
  maxLength = 100,
): string[] => {
  for (const source of sources) {
    const record = asRecord(source);
    const candidate = normalizeStringList(
      pickFirstValue(record, keys),
      maxItems,
      maxLength,
    );
    if (candidate.length > 0) {
      return candidate;
    }
  }
  return [];
};

const mergeStringLists = (
  groups: Array<string[] | null | undefined>,
  maxItems = 8,
  maxLength = 100,
): string[] =>
  Array.from(
    new Set(
      groups
        .flatMap((items) => (Array.isArray(items) ? items : []))
        .map((item) => trimText(item, maxLength))
        .filter(Boolean),
    ),
  ).slice(0, maxItems);

const normalizePageRole = (value: unknown): EcommerceCompetitorPageRole => {
  const raw = trimText(value, 48);
  const normalized = raw.toLowerCase();
  if (ALLOWED_PAGE_ROLES.has(normalized as EcommerceCompetitorPageRole)) {
    return normalized as EcommerceCompetitorPageRole;
  }

  if (/hero|首屏|首图|封面|开场|视觉锤/.test(normalized + raw)) return "hero";
  if (/white|白底|纯底|白场/.test(normalized + raw)) return "white-bg";
  if (/selling|卖点|亮点|优势/.test(normalized + raw)) return "selling";
  if (/scene|场景|使用|氛围/.test(normalized + raw)) return "scene";
  if (/comparison|对比|对照|差异/.test(normalized + raw)) return "comparison";
  if (/detail|细节|工艺|材质|特写/.test(normalized + raw)) return "detail";
  if (/spec|参数|规格|尺寸|配置/.test(normalized + raw)) return "spec";
  if (/conversion|cta|转化|收口|下单|保障|背书|成交/.test(normalized + raw)) {
    return "conversion";
  }
  return DEFAULT_PAGE_ROLE;
};

const normalizeTextDensity = (
  value: unknown,
): EcommerceCompetitorTextDensity => {
  const raw = trimText(value, 24);
  const normalized = raw.toLowerCase();
  if (ALLOWED_TEXT_DENSITIES.has(normalized as EcommerceCompetitorTextDensity)) {
    return normalized as EcommerceCompetitorTextDensity;
  }
  if (/low|低|少|简洁|稀/.test(normalized + raw)) return "low";
  if (/high|高|多|密|信息量大/.test(normalized + raw)) return "high";
  return DEFAULT_TEXT_DENSITY;
};

const normalizePageSequence = (
  value: unknown,
  fallbackCount: number,
): EcommerceCompetitorPageAnalysis[] =>
  (Array.isArray(value) ? value : [])
    .slice(0, Math.max(1, fallbackCount))
    .map((item, index) => {
      if (typeof item === "string") {
        const compact = trimText(item, 120);
        const detail =
          compact.split(/[：:]/).slice(1).join("：").trim() || compact;
        return {
          pageIndex: index + 1,
          pageRole: normalizePageRole(compact),
          titleSummary: trimText(compact, 80),
          businessTask: trimText(detail, 120),
          keySellingPoint: trimText(detail, 120),
          layoutPattern: "",
          textDensity: DEFAULT_TEXT_DENSITY,
          evidenceStyle: "",
          notes: "",
        };
      }

      const page = asRecord(item);
      const pageLayoutGrammar = asRecord(page.layoutGrammar);

      return {
        pageIndex:
          typeof page.pageIndex === "number" && Number.isFinite(page.pageIndex)
            ? Math.max(1, Math.round(page.pageIndex))
            : typeof page.index === "number" && Number.isFinite(page.index)
              ? Math.max(1, Math.round(page.index))
              : typeof page.page === "number" && Number.isFinite(page.page)
                ? Math.max(1, Math.round(page.page))
            : index + 1,
        pageRole: normalizePageRole(
          pickFirstValue(page, [
            "pageRole",
            "role",
            "pageType",
            "type",
            "stageType",
            "category",
          ]),
        ),
        titleSummary: pickFirstText(
          [page],
          [
            "titleSummary",
            "title",
            "summary",
            "pageSummary",
            "headline",
            "name",
            "stage",
            "label",
            "mainMessage",
            "sellingPointProgression",
            "mainFocus",
          ],
          80,
        ),
        businessTask: pickFirstText(
          [page],
          [
            "businessTask",
            "task",
            "goal",
            "purpose",
            "description",
            "intent",
            "conversionIntent",
            "mainFocus",
          ],
          120,
        ),
        keySellingPoint: pickFirstText(
          [page],
          [
            "keySellingPoint",
            "sellingPoint",
            "coreSellingPoint",
            "mainPoint",
            "highlight",
            "value",
            "mainMessage",
            "sellingPointProgression",
            "mainFocus",
          ],
          120,
        ),
        layoutPattern: pickFirstText(
          [page, pageLayoutGrammar],
          [
            "layoutPattern",
            "layout",
            "composition",
            "structure",
            "visualPattern",
            "layoutGrammar",
            "modulePattern",
            "visualFlow",
            "backgroundStyle",
          ],
          120,
        ),
        textDensity: normalizeTextDensity(
          pickFirstValue(page, ["textDensity", "density", "copyDensity", "textLoad"]),
        ),
        evidenceStyle: pickFirstText(
          [page],
          ["evidenceStyle", "proofStyle", "proof", "evidence", "trustSignal"],
          120,
        ),
        notes: pickFirstText(
          [page],
          [
            "notes",
            "note",
            "remark",
            "tips",
            "insight",
            "reusableStrategy",
            "strategyPrinciples",
          ],
          120,
        ),
      };
    });

const buildAlternateDeckAnalysisShape = (
  deck: EcommerceCompetitorDeckInput,
  value: unknown,
): EcommerceCompetitorDeckAnalysis => {
  const raw = asRecord(value);
  const overview = asRecord(
    pickFirstValue(raw, [
      "overview",
      "deckOverview",
      "summary",
      "overallSummary",
      "overall",
      "overallStrategy",
    ]),
  );
  const globalPatterns = asRecord(
    pickFirstValue(raw, ["globalPatterns", "patterns", "commonPatterns", "patternSummary"]),
  );
  const planningHints = asRecord(
    pickFirstValue(raw, ["planningHints", "strategyHints", "executionHints", "suggestions"]),
  );
  const overviewLayoutGrammar = asRecord(overview.layoutGrammar);

  const pageSequence = normalizePageSequence(
    pickFirstValue(raw, [
      "pageSequence",
      "pageFlow",
      "pages",
      "screens",
      "slides",
      "pageBreakdown",
      "pageAnalysis",
      "pageAnalyses",
      "sequence",
      "storyboard",
      "pagePlan",
    ]),
    deck.images.length,
  );

  const derivedSequenceLabels = mergeStringLists(
    [
      pageSequence.map(
        (page) => page.titleSummary || page.businessTask || page.keySellingPoint,
      ),
    ],
    8,
    60,
  );
  const derivedPageRoles = mergeStringLists(
    [pageSequence.map((page) => page.pageRole).filter((role) => role !== "other")],
    8,
    40,
  );
  const derivedLayoutPatterns = mergeStringLists(
    [pageSequence.map((page) => page.layoutPattern)],
    8,
    60,
  );

  const recommendedPageSequence = mergeStringLists(
    [
      pickFirstStringList(
        [planningHints, raw, overview],
        [
          "recommendedPageSequence",
          "pageFlow",
          "pageFlowSummary",
          "pageOrder",
          "recommendedFlow",
          "recommendedPages",
          "sellingPointProgression",
        ],
        8,
        50,
      ),
      derivedSequenceLabels,
    ],
    8,
    50,
  );

  const recommendedStoryOrder = mergeStringLists(
    [
      pickFirstStringList(
        [planningHints, raw, overview],
        [
          "recommendedStoryOrder",
          "storyOrder",
          "storyFlow",
          "narrativeSteps",
          "narrativeFlow",
          "storyLine",
          "sellingPointProgression",
        ],
        8,
        60,
      ),
      recommendedPageSequence,
    ],
    8,
    60,
  );

  const recommendedVisualPrinciples = mergeStringLists(
    [
      pickFirstStringList(
        [planningHints, raw, globalPatterns, overview, overviewLayoutGrammar],
        [
          "recommendedVisualPrinciples",
          "visualPrinciples",
          "visualStrategies",
          "visualPatterns",
          "layoutPatterns",
          "evidenceStyle",
        ],
        8,
        100,
      ),
      derivedLayoutPatterns,
    ],
    8,
    100,
  );

  const recommendedTextPrinciples = pickFirstStringList(
    [planningHints, raw, globalPatterns, overview],
    [
      "recommendedTextPrinciples",
      "textPrinciples",
      "copyPrinciples",
      "textStrategies",
      "copyStrategies",
    ],
    8,
    100,
  );

  const commonSellingPointOrder = mergeStringLists(
    [
      pickFirstStringList(
        [globalPatterns, raw, overview],
        [
          "commonSellingPointOrder",
          "sellingPointOrder",
          "valueOrder",
          "sellingSequence",
          "sellingPointProgression",
        ],
        8,
        60,
      ),
      recommendedStoryOrder,
    ],
    8,
    60,
  );

  return {
    competitorId: deck.id,
    competitorName:
      pickFirstText([raw], ["competitorName", "deckName", "productName", "title"], 80) ||
      trimText(deck.name, 80) ||
      undefined,
    overview: {
      productPositioning:
        pickFirstText(
          [overview, raw],
          [
            "productPositioning",
            "positioning",
            "deckType",
            "productType",
            "productCategory",
            "category",
            "pageType",
            "primaryCategory",
            "sourceType",
          ],
          120,
        ) || trimText(deck.name, 120),
      overallStyle: pickFirstText(
        [overview, overviewLayoutGrammar, raw],
        [
          "overallStyle",
          "visualStyle",
          "styleTone",
          "styleSummary",
          "visualTone",
          "visualDirection",
          "layoutGrammar",
          "composition",
          "backgroundStyle",
          "modulePattern",
          "visualFlow",
        ],
        120,
      ),
      narrativePattern:
        pickFirstText(
          [overview, raw],
          [
            "narrativePattern",
            "storyPattern",
            "pageFlowSummary",
            "sequenceSummary",
            "narrativeLogic",
            "strategicSummary",
          ],
          120,
        ) || trimText(recommendedStoryOrder.slice(0, 4).join(" -> "), 120),
      conversionStrategy: pickFirstText(
        [overview, raw, globalPatterns],
        [
          "conversionStrategy",
          "conversionLogic",
          "conversionPath",
          "closingStrategy",
          "conversionSignals",
          "trustSignals",
          "conversionIntent",
        ],
        120,
      ),
    },
    pageSequence,
    globalPatterns: {
      commonPageRoles: mergeStringLists(
        [
          pickFirstStringList(
            [globalPatterns, raw],
            ["commonPageRoles", "pageRoles", "commonRoles", "roleSequence"],
            8,
            40,
          ),
          derivedPageRoles,
        ],
        8,
        40,
      ),
      commonSellingPointOrder,
      commonLayoutPatterns: mergeStringLists(
        [
          pickFirstStringList(
            [globalPatterns, raw, overview, overviewLayoutGrammar],
            ["commonLayoutPatterns", "layoutPatterns", "visualLayouts", "pageLayouts"],
            8,
            60,
          ),
          derivedLayoutPatterns,
        ],
        8,
        60,
      ),
      commonTextStrategies: pickFirstStringList(
        [globalPatterns, raw, overview],
        [
          "commonTextStrategies",
          "textStrategies",
          "copyStrategies",
          "copyPatterns",
        ],
        8,
        60,
      ),
      commonConversionSignals: pickFirstStringList(
        [globalPatterns, raw, overview],
        [
          "commonConversionSignals",
          "conversionSignals",
          "trustSignals",
          "closingSignals",
          "evidenceStyle",
        ],
        8,
        60,
      ),
    },
    borrowablePrinciples: pickFirstStringList(
      [raw, overview],
        [
          "borrowablePrinciples",
          "reusablePrinciples",
          "strategyPrinciples",
          "borrowableStrategies",
          "canBorrow",
        ],
      8,
      100,
    ),
    avoidCopying: pickFirstStringList(
      [raw],
      ["avoidCopying", "doNotCopy", "avoidPoints", "doNotImitate"],
      8,
      100,
    ),
    opportunitiesForOurProduct: pickFirstStringList(
      [raw],
      [
        "opportunitiesForOurProduct",
        "ourProductOpportunities",
        "productOpportunities",
        "optimizationDirections",
      ],
      8,
      100,
    ),
    planningHints: {
      recommendedPageSequence,
      recommendedStoryOrder,
      recommendedVisualPrinciples,
      recommendedTextPrinciples,
    },
  };
};

const normalizeDeckAnalysis = (
  deck: EcommerceCompetitorDeckInput,
  value: unknown,
): EcommerceCompetitorDeckAnalysis => {
  const raw = asRecord(value);
  const looksLikeAlternateShape =
    !raw.pageSequence &&
    !raw.overview &&
    (raw.deckName !== undefined ||
      raw.deckType !== undefined ||
      raw.overall !== undefined ||
      raw.overallStrategy !== undefined ||
      raw.screens !== undefined ||
      raw.slides !== undefined ||
      raw.pageFlow !== undefined ||
      raw.pages !== undefined ||
      raw.sequence !== undefined);

  if (looksLikeAlternateShape) {
    return buildAlternateDeckAnalysisShape(deck, raw);
  }

  const overview =
    raw.overview && typeof raw.overview === "object"
      ? (raw.overview as Record<string, unknown>)
      : {};
  const globalPatterns =
    raw.globalPatterns && typeof raw.globalPatterns === "object"
      ? (raw.globalPatterns as Record<string, unknown>)
      : {};
  const planningHints =
    raw.planningHints && typeof raw.planningHints === "object"
      ? (raw.planningHints as Record<string, unknown>)
      : {};

  return {
    competitorId: deck.id,
    competitorName:
      trimText(raw.competitorName, 80) || trimText(deck.name, 80) || undefined,
    overview: {
      productPositioning: trimText(overview.productPositioning, 120),
      overallStyle: trimText(overview.overallStyle, 120),
      narrativePattern: trimText(overview.narrativePattern, 120),
      conversionStrategy: trimText(overview.conversionStrategy, 120),
    },
    pageSequence: normalizePageSequence(raw.pageSequence, deck.images.length),
    globalPatterns: {
      commonPageRoles: normalizeStringList(
        globalPatterns.commonPageRoles,
        8,
        40,
      ),
      commonSellingPointOrder: normalizeStringList(
        globalPatterns.commonSellingPointOrder,
        8,
        60,
      ),
      commonLayoutPatterns: normalizeStringList(
        globalPatterns.commonLayoutPatterns,
        8,
        60,
      ),
      commonTextStrategies: normalizeStringList(
        globalPatterns.commonTextStrategies,
        8,
        60,
      ),
      commonConversionSignals: normalizeStringList(
        globalPatterns.commonConversionSignals,
        8,
        60,
      ),
    },
    borrowablePrinciples: normalizeStringList(
      raw.borrowablePrinciples,
      8,
      100,
    ),
    avoidCopying: normalizeStringList(raw.avoidCopying, 8, 100),
    opportunitiesForOurProduct: normalizeStringList(
      raw.opportunitiesForOurProduct,
      8,
      100,
    ),
    planningHints: {
      recommendedPageSequence: normalizeStringList(
        planningHints.recommendedPageSequence,
        8,
        50,
      ),
      recommendedStoryOrder: normalizeStringList(
        planningHints.recommendedStoryOrder,
        8,
        60,
      ),
      recommendedVisualPrinciples: normalizeStringList(
        planningHints.recommendedVisualPrinciples,
        8,
        100,
      ),
      recommendedTextPrinciples: normalizeStringList(
        planningHints.recommendedTextPrinciples,
        8,
        100,
      ),
    },
  };
};

const hasMeaningfulDeckAnalysis = (
  analysis: EcommerceCompetitorDeckAnalysis,
): boolean => {
  const overviewHasContent = [
    analysis.overview.productPositioning,
    analysis.overview.overallStyle,
    analysis.overview.narrativePattern,
    analysis.overview.conversionStrategy,
  ].some((item) => item.trim().length > 0);

  const pageSequenceHasContent = analysis.pageSequence.some((page) =>
    [
      page.titleSummary,
      page.businessTask,
      page.keySellingPoint,
      page.layoutPattern,
      page.evidenceStyle,
      page.notes,
    ].some((item) => item.trim().length > 0),
  );

  const listHasContent = [
    analysis.globalPatterns.commonPageRoles,
    analysis.globalPatterns.commonSellingPointOrder,
    analysis.globalPatterns.commonLayoutPatterns,
    analysis.globalPatterns.commonTextStrategies,
    analysis.globalPatterns.commonConversionSignals,
    analysis.borrowablePrinciples,
    analysis.avoidCopying,
    analysis.opportunitiesForOurProduct,
    analysis.planningHints.recommendedPageSequence,
    analysis.planningHints.recommendedStoryOrder,
    analysis.planningHints.recommendedVisualPrinciples,
    analysis.planningHints.recommendedTextPrinciples,
  ].some((items) => items.length > 0);

  return overviewHasContent || pageSequenceHasContent || listHasContent;
};

const buildDeckPrompt = (deck: EcommerceCompetitorDeckInput): string => {
  const deckName = trimText(deck.name, 80) || "Unnamed competitor deck";
  const deckNotes = trimText(deck.notes, 220);
  const referenceUrl = trimText(deck.referenceUrl, 220);

  return [
    "You are analyzing competitor ecommerce detail page screenshots.",
    "Treat the screenshots as a strategic reference, not as copy to imitate.",
    "Return JSON only.",
    "Write all string fields in concise Simplified Chinese.",
    "Infer the page role, selling-point progression, layout grammar, text density, evidence style, and conversion intent.",
    "Focus on reusable strategy principles instead of brand-specific wording.",
    "Do not copy exact slogans or claims from the screenshots.",
    `Deck name: ${deckName}.`,
    deckNotes ? `User notes: ${deckNotes}.` : "",
    referenceUrl ? `Reference URL: ${referenceUrl}.` : "",
    "Allowed pageRole values: hero, white-bg, selling, scene, comparison, detail, spec, conversion, other.",
    "Allowed textDensity values: low, medium, high.",
    "If information is uncertain, keep it generic and concise rather than inventing details.",
  ]
    .filter(Boolean)
    .join(" ");
};

const buildDeckRescuePrompt = (
  deck: EcommerceCompetitorDeckInput,
  screenshotCount: number,
): string => {
  const deckName = trimText(deck.name, 80) || "Unnamed competitor deck";
  const deckNotes = trimText(deck.notes, 220);
  const referenceUrl = trimText(deck.referenceUrl, 220);

  return [
    "You are analyzing competitor ecommerce detail page screenshots.",
    "Return one strict JSON object only. Do not return markdown. Do not return an empty object.",
    "Write all values in concise Simplified Chinese.",
    `This run includes ${screenshotCount} ordered screenshots for the deck "${deckName}".`,
    deckNotes ? `User notes: ${deckNotes}.` : "",
    referenceUrl ? `Reference URL: ${referenceUrl}.` : "",
    "Required top-level keys: competitorName, overview, pageSequence, globalPatterns, borrowablePrinciples, avoidCopying, opportunitiesForOurProduct, planningHints.",
    "Required overview keys: productPositioning, overallStyle, narrativePattern, conversionStrategy.",
    "Each pageSequence item should include: pageIndex, pageRole, titleSummary, businessTask, keySellingPoint, layoutPattern, textDensity, evidenceStyle, conversionIntent, notes.",
    "Allowed pageRole values: hero, white-bg, selling, scene, comparison, detail, spec, conversion, other.",
    "Allowed textDensity values: low, medium, high.",
    "Required globalPatterns keys: commonPageRoles, commonSellingPointOrder, commonLayoutPatterns, commonTextStrategies, commonConversionSignals.",
    "Required planningHints keys: recommendedPageSequence, recommendedStoryOrder, recommendedVisualPrinciples, recommendedTextPrinciples.",
    "If something is uncertain, keep strings short and arrays short, but do not leave the entire object empty.",
  ]
    .filter(Boolean)
    .join(" ");
};

const dataUrlToInlinePart = (dataUrl: string) => {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches || !matches[1] || !matches[2]) {
    throw new Error("invalid image data url");
  }
  return {
    inlineData: {
      mimeType: matches[1],
      data: matches[2],
    },
  };
};

const blobToDataUrl = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("image read failed"));
    reader.readAsDataURL(blob);
  });

const loadImageFromBlob = async (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image decode failed"));
    };
    image.src = objectUrl;
  });

const compressImageBlobToDataUrl = async (blob: Blob): Promise<string> => {
  const image = await loadImageFromBlob(blob);
  const sourceWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const sourceHeight = Math.max(1, image.naturalHeight || image.height || 1);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("canvas context unavailable");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  let quality = COMPRESSED_IMAGE_QUALITY;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const blobCandidate = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blobCandidate) {
      break;
    }
    const dataUrl = await blobToDataUrl(blobCandidate);
    if (dataUrl.length <= MAX_INLINE_IMAGE_BYTES || quality <= 0.48) {
      return dataUrl;
    }
    quality -= 0.1;
  }

  return blobToDataUrl(blob);
};

const toInlineImagePart = async (url: string) => {
  const resolvedUrl = await resolveStoredTopicAssetUrl(url);
  const normalized = String(resolvedUrl || "").trim();
  if (!normalized) {
    throw new Error("image URL is empty");
  }

  if (/^data:image\/.+;base64,/.test(normalized)) {
    const blob = await fetch(normalized).then((response) => response.blob());
    return dataUrlToInlinePart(await compressImageBlobToDataUrl(blob));
  }

  const response = await fetch(normalized);
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  const dataUrl = await compressImageBlobToDataUrl(blob);

  return dataUrlToInlinePart(dataUrl);
};

const buildImageFileName = (baseName: string, mimeType: string) => {
  const safeBaseName = String(baseName || "image").replace(/[^\w.-]+/g, "-");
  const extension =
    mimeType === "image/jpeg"
      ? "jpg"
      : mimeType === "image/png"
        ? "png"
        : mimeType === "image/webp"
          ? "webp"
          : mimeType === "image/gif"
            ? "gif"
            : "png";
  return safeBaseName.includes(".") ? safeBaseName : `${safeBaseName}.${extension}`;
};

const tryPromoteImageToPublicUrl = async (
  url: string,
  fileBaseName: string,
): Promise<string | null> => {
  const normalized = String(url || "").trim();
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (!/^(blob:|data:image\/)/i.test(normalized)) {
    return null;
  }

  const selectedProvider = useImageHostStore.getState().selectedProvider;
  if (selectedProvider === "none") {
    console.warn(
      "[ecomCompetitorDeckAnalysis] no public image host configured, fallback to inline image payload",
      {
        inputKind: normalized.startsWith("blob:") ? "blob" : "data",
      },
    );
    return null;
  }

  try {
    const response = await fetch(normalized);
    if (!response.ok) {
      throw new Error(`image fetch failed: ${response.status}`);
    }

    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      return null;
    }

    const file = new File(
      [blob],
      buildImageFileName(fileBaseName, blob.type || "image/png"),
      {
        type: blob.type || "image/png",
        lastModified: Date.now(),
      },
    );
    const uploadedUrl = await uploadImage(file);
    return /^https?:\/\//i.test(uploadedUrl) ? uploadedUrl : null;
  } catch (error) {
    console.warn(
      "[ecomCompetitorDeckAnalysis] promote image to public url failed",
      {
        inputKind: normalized.startsWith("blob:") ? "blob" : "data",
        selectedProvider,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    );
    return null;
  }
};

const toCompetitorImagePart = async (
  url: string,
  index: number,
): Promise<
  | { inlineData: { mimeType: string; data: string } }
  | { imageUrl: string }
> => {
  const resolvedUrl = await resolveStoredTopicAssetUrl(url);
  const normalized = String(resolvedUrl || "").trim();
  if (!normalized) {
    throw new Error("image URL is empty");
  }

  if (/^https?:\/\//i.test(normalized)) {
    return { imageUrl: normalized };
  }

  const publicUrl = await tryPromoteImageToPublicUrl(
    normalized,
    `competitor-deck-${index + 1}`,
  );
  if (publicUrl) {
    return { imageUrl: publicUrl };
  }

  console.warn("[ecomCompetitorDeckAnalysis] fallback to inline image payload", {
    index: index + 1,
    inputKind: normalized.startsWith("blob:")
      ? "blob"
      : normalized.startsWith("data:")
        ? "data"
        : "other",
  });
  return toInlineImagePart(normalized);
};

const summarizeCompetitorImageParts = (
  parts: Array<
    | { inlineData: { mimeType: string; data: string } }
    | { imageUrl: string }
  >,
) =>
  parts.map((part, index) => {
    if ("imageUrl" in part) {
      let host = "invalid-url";
      try {
        host = new URL(part.imageUrl).host || "unknown-host";
      } catch {
        host = "invalid-url";
      }
      return {
        index: index + 1,
        transport: "imageUrl",
        host,
        urlLength: part.imageUrl.length,
      };
    }

    return {
      index: index + 1,
      transport: "inlineData",
      mimeType: part.inlineData.mimeType || "unknown",
      approxBytes: Math.round(((part.inlineData.data.length || 0) * 3) / 4),
    };
  });

const buildImageInputDiagnostics = (
  imageTransportSummary: Array<Record<string, unknown>> | undefined,
  imageCount?: number,
): ImageInputDiagnostics => {
  const summary = Array.isArray(imageTransportSummary) ? imageTransportSummary : [];
  const imageHostProvider = trimText(
    useImageHostStore.getState().selectedProvider,
    40,
  ) || "unknown";
  const remoteHosts = Array.from(
    new Set(
      summary
        .map((item) => trimText(asRecord(item).host, 120).toLowerCase())
        .filter(Boolean),
    ),
  );
  const remoteImageCount = summary.filter(
    (item) => trimText(asRecord(item).transport, 32) === "imageUrl",
  ).length;
  const inlineImageCount = summary.filter(
    (item) => trimText(asRecord(item).transport, 32) === "inlineData",
  ).length;

  let transportMode: ImageInputDiagnostics["transportMode"] = "none";
  if (remoteImageCount > 0 && inlineImageCount > 0) {
    transportMode = "mixed";
  } else if (remoteImageCount > 0) {
    transportMode = "remote_url";
  } else if (inlineImageCount > 0) {
    transportMode = "inline_data";
  }

  const likelyFailureCauses: string[] = [];
  if (transportMode === "remote_url") {
    likelyFailureCauses.push("upstream_remote_image_fetch_or_hotlink_compatibility");
  }
  if (transportMode === "inline_data") {
    likelyFailureCauses.push("inline_image_payload_size_or_provider_inline_support");
  }
  if (transportMode === "mixed") {
    likelyFailureCauses.push("mixed_image_transport_complicates_provider_compatibility");
  }
  if (remoteHosts.some((host) => host === "i.ibb.co" || host.endsWith(".ibb.co"))) {
    likelyFailureCauses.push("imgbb_hosted_remote_image_dependency");
  }
  if (imageHostProvider === "none") {
    likelyFailureCauses.push("no_public_image_host_configured_inline_fallback_expected");
  }

  return {
    imageCount:
      typeof imageCount === "number" && Number.isFinite(imageCount)
        ? Math.max(0, Math.round(imageCount))
        : summary.length,
    transportMode,
    imageHostProvider,
    remoteImageCount,
    inlineImageCount,
    remoteHosts,
    upstreamFetchRequired: remoteImageCount > 0,
    inlinePayloadRequired: inlineImageCount > 0,
    likelyFailureCauses,
  };
};

const analyzeSingleDeck = async (
  deck: EcommerceCompetitorDeckInput,
  model: string,
  maxImages = MAX_DECK_SCREENSHOTS,
): Promise<EcommerceCompetitorDeckAnalysis> => {
  const images = (deck.images || []).slice(0, Math.max(1, maxImages));
  if (images.length === 0) {
    throw new Error("deck has no screenshots");
  }

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
    | { imageUrl: string }
  > = [{ text: buildDeckPrompt(deck) }];
  let totalInlineBytes = 0;
  let includedImageCount = 0;
  const includedImageParts: Array<
    | { inlineData: { mimeType: string; data: string } }
    | { imageUrl: string }
  > = [];

  for (const [index, image] of images.entries()) {
    const imagePart = await toCompetitorImagePart(image.url, index);
    const inlineBytes =
      "inlineData" in imagePart ? imagePart.inlineData.data.length : 0;
    if (
      includedImageCount > 0 &&
      inlineBytes > 0 &&
      totalInlineBytes + inlineBytes > MAX_TOTAL_INLINE_BYTES
    ) {
      parts.push({
        text: `Only the first ${includedImageCount} screenshots are included because later screenshots would exceed the request size budget. Preserve page order using the included screenshots only.`,
      });
      break;
    }

    parts.push({
      text: `Screenshot ${index + 1} of ${images.length}. Original order matters.`,
    });
    parts.push(imagePart);
    includedImageParts.push(imagePart);
    includedImageCount += 1;
    totalInlineBytes += inlineBytes;
  }

  if (includedImageCount === 0) {
    throw new Error("deck screenshots are too large to analyze after compression");
  }

  const imageTransportSummary = summarizeCompetitorImageParts(includedImageParts);
  const imageInputDiagnostics = buildImageInputDiagnostics(
    imageTransportSummary,
    includedImageCount,
  );
  const attemptTrace: Array<Record<string, unknown>> = [
    {
      phase: "primary",
      mode: "schema",
      imageCount: includedImageCount,
    },
  ];
  console.info("[ecomCompetitorDeckAnalysis] image inputs ready", {
    deckId: deck.id,
    deckName: deck.name || "",
    includedImageCount,
    totalInlineBytes,
    imageTransportSummary,
    imageInputDiagnostics,
  });

  const requestOptions = {
    model: model || getBestModelId("text"),
    operation: "ecomCompetitorDeckAnalysis",
    queueKey: "ecomCompetitorDeckAnalysis",
    minIntervalMs: 1200,
    temperature: 0.2,
    disableTextOnlyFallback: true,
    injectSchemaPrompt: false,
    requestTuning: {
      retries: 2,
      baseDelayMs: 1200,
      maxDelayMs: 6000,
    },
  } as const;

  const responseSchema = {
      type: Type.OBJECT,
      properties: {
        competitorName: { type: Type.STRING },
        overview: {
          type: Type.OBJECT,
          properties: {
            productPositioning: { type: Type.STRING },
            overallStyle: { type: Type.STRING },
            narrativePattern: { type: Type.STRING },
            conversionStrategy: { type: Type.STRING },
          },
          required: [
            "productPositioning",
            "overallStyle",
            "narrativePattern",
            "conversionStrategy",
          ],
        },
        pageSequence: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              pageIndex: { type: Type.NUMBER },
              pageRole: { type: Type.STRING },
              titleSummary: { type: Type.STRING },
              businessTask: { type: Type.STRING },
              keySellingPoint: { type: Type.STRING },
              layoutPattern: { type: Type.STRING },
              textDensity: { type: Type.STRING },
              evidenceStyle: { type: Type.STRING },
              notes: { type: Type.STRING },
            },
            required: [
              "pageIndex",
              "pageRole",
              "titleSummary",
              "businessTask",
              "keySellingPoint",
              "layoutPattern",
              "textDensity",
              "evidenceStyle",
              "notes",
            ],
          },
        },
        globalPatterns: {
          type: Type.OBJECT,
          properties: {
            commonPageRoles: { type: Type.ARRAY, items: { type: Type.STRING } },
            commonSellingPointOrder: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            commonLayoutPatterns: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            commonTextStrategies: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            commonConversionSignals: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            "commonPageRoles",
            "commonSellingPointOrder",
            "commonLayoutPatterns",
            "commonTextStrategies",
            "commonConversionSignals",
          ],
        },
        borrowablePrinciples: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        avoidCopying: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        opportunitiesForOurProduct: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        planningHints: {
          type: Type.OBJECT,
          properties: {
            recommendedPageSequence: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            recommendedStoryOrder: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            recommendedVisualPrinciples: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            recommendedTextPrinciples: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            "recommendedPageSequence",
            "recommendedStoryOrder",
            "recommendedVisualPrinciples",
            "recommendedTextPrinciples",
          ],
        },
      },
      required: [
        "overview",
        "pageSequence",
        "globalPatterns",
        "borrowablePrinciples",
        "avoidCopying",
        "opportunitiesForOurProduct",
        "planningHints",
      ],
    };

  let response = await generateJsonResponse({
    ...requestOptions,
    responseSchema,
    parts,
  });

  let finalStage = "primary";
  let finalResponseFormat: "schema" | "text" = "schema";
  let parsedResult = parseCompetitorAnalysisResponse(String(response.text || ""));
  if (!parsedResult.ok) {
    console.warn("[ecomCompetitorDeckAnalysis] invalid JSON response", {
      deckId: deck.id,
      deckName: deck.name || "",
      finalStage,
      responseFormat: finalResponseFormat,
      parseError: parsedResult.parseError,
      textPreview: parsedResult.textPreview,
      imageInputDiagnostics,
      attemptTrace,
    });
    await persistCompetitorAnalysisFailureSnapshot({
      deck,
      requestedModel: model,
      response,
      imageTransportSummary,
      imageInputDiagnostics,
      attemptTrace,
      finalStage,
      responseFormat: finalResponseFormat,
      parseError: parsedResult.parseError,
      failureReason: "invalid_json_response",
    });
    throw new Error("竞品分析在主结构阶段返回了非 JSON 内容，已写入 debug 文件。");
  }

  let parsed = parsedResult.parsed;
  let normalized = normalizeDeckAnalysis(deck, parsed);

  if (!hasMeaningfulDeckAnalysis(normalized)) {
    const rescueParts = [
      { text: buildDeckRescuePrompt(deck, includedImageCount) },
      ...parts.slice(1),
    ] as Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
      | { imageUrl: string }
    >;
    attemptTrace.push({
      phase: "rescue",
      mode: "text",
      imageCount: includedImageCount,
    });
    console.warn("[ecomCompetitorDeckAnalysis] empty schema result, retrying text rescue", {
      deckId: deck.id,
      imageCount: includedImageCount,
    });
    response = await generateJsonResponse({
      ...requestOptions,
      operation: "ecomCompetitorDeckAnalysis.rescue",
      responseFormat: "text",
      parts: rescueParts,
    });
    finalStage = "rescue";
    finalResponseFormat = "text";
    parsedResult = parseCompetitorAnalysisResponse(String(response.text || ""));
    if (!parsedResult.ok) {
      console.warn("[ecomCompetitorDeckAnalysis] invalid JSON response", {
        deckId: deck.id,
        deckName: deck.name || "",
        finalStage,
        responseFormat: finalResponseFormat,
        parseError: parsedResult.parseError,
        textPreview: parsedResult.textPreview,
        imageInputDiagnostics,
        attemptTrace,
      });
      await persistCompetitorAnalysisFailureSnapshot({
        deck,
        requestedModel: model,
        response,
        imageTransportSummary,
        imageInputDiagnostics,
        attemptTrace,
        finalStage,
        responseFormat: finalResponseFormat,
        parseError: parsedResult.parseError,
        failureReason: "invalid_json_response",
      });
      throw new Error("竞品分析在救援阶段返回了非 JSON 内容，已写入 debug 文件。");
    }
    parsed = parsedResult.parsed;
    normalized = normalizeDeckAnalysis(deck, parsed);
  }

  if (!hasMeaningfulDeckAnalysis(normalized) && includedImageCount > 4) {
    const reducedImageParts = includedImageParts.slice(0, 4);
    const reducedParts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
      | { imageUrl: string }
    > = [{ text: buildDeckRescuePrompt(deck, reducedImageParts.length) }];
    reducedImageParts.forEach((imagePart, index) => {
      reducedParts.push({
        text: `Screenshot ${index + 1} of ${reducedImageParts.length}. Original order matters.`,
      });
      reducedParts.push(imagePart);
    });
    attemptTrace.push({
      phase: "rescue-reduced-images",
      mode: "text",
      imageCount: reducedImageParts.length,
    });
    console.warn("[ecomCompetitorDeckAnalysis] text rescue still empty, retrying with fewer screenshots", {
      deckId: deck.id,
      imageCount: reducedImageParts.length,
    });
    response = await generateJsonResponse({
      ...requestOptions,
      operation: "ecomCompetitorDeckAnalysis.reducedImages",
      responseFormat: "text",
      parts: reducedParts,
    });
    finalStage = "rescue-reduced-images";
    finalResponseFormat = "text";
    parsedResult = parseCompetitorAnalysisResponse(String(response.text || ""));
    if (!parsedResult.ok) {
      console.warn("[ecomCompetitorDeckAnalysis] invalid JSON response", {
        deckId: deck.id,
        deckName: deck.name || "",
        finalStage,
        responseFormat: finalResponseFormat,
        parseError: parsedResult.parseError,
        textPreview: parsedResult.textPreview,
        imageInputDiagnostics,
        attemptTrace,
      });
      await persistCompetitorAnalysisFailureSnapshot({
        deck,
        requestedModel: model,
        response,
        imageTransportSummary,
        imageInputDiagnostics,
        attemptTrace,
        finalStage,
        responseFormat: finalResponseFormat,
        parseError: parsedResult.parseError,
        failureReason: "invalid_json_response",
      });
      throw new Error("竞品分析在降图救援阶段返回了非 JSON 内容，已写入 debug 文件。");
    }
    parsed = parsedResult.parsed;
    normalized = normalizeDeckAnalysis(deck, parsed);
  }

  const payloadSummary = summarizeParsedCompetitorPayload(parsed, normalized);

  console.info("[ecomCompetitorDeckAnalysis] parsed payload summary", {
    deckId: deck.id,
    deckName: deck.name || "",
    responseId:
      (response.raw as { id?: unknown } | undefined)?.id
        ? String((response.raw as { id?: unknown }).id)
        : null,
    responseModel:
      (response.raw as { model?: unknown } | undefined)?.model
        ? String((response.raw as { model?: unknown }).model)
        : null,
    finishReason:
      (response.raw as { choices?: Array<{ finish_reason?: unknown }> } | undefined)?.choices?.[0]
        ?.finish_reason || null,
    textPreview: String(response.text || "").slice(0, 700),
    ...payloadSummary,
  });

  void persistCompetitorAnalysisDebugSnapshot({
    deck,
    requestedModel: model,
    response,
    parsed,
    normalized,
    payloadSummary,
    imageTransportSummary,
    imageInputDiagnostics,
    attemptTrace,
    finalStage,
    responseFormat: finalResponseFormat,
  });

  if (!hasMeaningfulDeckAnalysis(normalized)) {
    console.warn("[ecomCompetitorDeckAnalysis] empty analysis payload", {
      deckId: deck.id,
      deckName: deck.name || "",
      imageCount: images.length,
      responseTextPreview: String(response.text || "").slice(0, 400),
      imageTransportSummary,
      imageInputDiagnostics,
      attemptTrace,
      ...payloadSummary,
    });
    throw new Error(
      "竞品分析返回了空结果。当前模型或供应商可能没有真正读到截图内容，或返回了空 JSON。",
    );
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    !("overview" in (parsed as Record<string, unknown>)) &&
    ("deckName" in (parsed as Record<string, unknown>) ||
      "deckType" in (parsed as Record<string, unknown>) ||
      "pageFlow" in (parsed as Record<string, unknown>))
  ) {
    console.info("[ecomCompetitorDeckAnalysis] adapted alternate payload schema", {
      deckId: deck.id,
      topLevelKeys: Object.keys(parsed as Record<string, unknown>),
    });
  }

  return normalized;
};

export const analyzeEcommerceCompetitorDecks = async (options: {
  decks: EcommerceCompetitorDeckInput[];
  model?: string | null;
}): Promise<EcommerceCompetitorAnalysisRunResult> => {
  const decks = Array.isArray(options.decks) ? options.decks : [];
  const model = String(options.model || "").trim() || getBestModelId("text");
  const analyses: EcommerceCompetitorDeckAnalysis[] = [];
  const failedDecks: CompetitorDeckFailure[] = [];

  for (const deck of decks) {
    try {
      analyses.push(await analyzeSingleDeck(deck, model));
    } catch (error) {
      failedDecks.push({
        deckId: deck.id,
        deckName: trimText(deck.name, 80) || deck.id,
        reason: normalizeDeckFailureReason(error),
      });
      break;
    }
  }

  return {
    analyses,
    failedDecks,
  };
};

export const analyzeCompetitorDeckImageRaw = async (options: {
  deck: EcommerceCompetitorDeckInput;
  imageIndex: number;
  model?: string | null;
}): Promise<CompetitorImageRawAnalysisResult> => {
  const deck = options.deck;
  const requestedModel =
    String(options.model || "").trim() || getBestModelId("text");
  const imageIndex = Math.max(
    0,
    Math.min(
      Number.isFinite(options.imageIndex) ? Math.floor(options.imageIndex) : 0,
      Math.max(0, (deck.images?.length || 1) - 1),
    ),
  );
  const image = deck.images?.[imageIndex];
  if (!image?.url) {
    throw new Error("当前竞品组没有可用于逐图分析的截图。");
  }

  const startedAt = new Date().toISOString();
  const prompt = [
    "请只分析这一张电商详情页截图。",
    "请直接用简体中文自然语言回答，不要返回 JSON，不要返回 markdown。",
    "请尽量覆盖这 5 点：",
    "1. 这张图属于什么页面或承担什么作用",
    "2. 图里直接能看出的卖点、功能或利益点",
    "3. 版式结构、文案组织和视觉重点",
    "4. 这张图最值得借鉴的表达方式",
    "5. 看不清或不确定的地方",
    "回答尽量正常、具体、可读，不要只输出空对象或占位符。",
  ].join("\n");

  const imagePart = await toCompetitorImagePart(image.url, imageIndex);
  const imageTransportSummary = summarizeCompetitorImageParts([imagePart]);
  const imageInputDiagnostics = buildImageInputDiagnostics(imageTransportSummary, 1);
  console.info("[ecomCompetitorImageRawAnalysis] image input ready", {
    deckId: deck.id,
    deckName: deck.name || "",
    imageId: image.id,
    imageIndex: imageIndex + 1,
    imageTransportSummary,
    imageInputDiagnostics,
  });

  const response = await generateJsonResponse({
    model: requestedModel,
    operation: "ecomCompetitorImageRawAnalysis",
    queueKey: "ecomCompetitorImageRawAnalysis",
    minIntervalMs: 900,
    temperature: 0.2,
    responseFormat: "text",
    disableTextOnlyFallback: true,
    injectSchemaPrompt: false,
    requestTuning: {
      retries: 1,
      baseDelayMs: 1200,
      maxDelayMs: 4000,
    },
    parts: [
      { text: prompt },
      {
        text: `当前是竞品组 "${trimText(deck.name, 80) || deck.id}" 的第 ${imageIndex + 1} 张截图。`,
      },
      imagePart,
    ],
  });

  const responseText = String(response.text || "");
  const responseRaw = (response.raw || {}) as Record<string, unknown>;
  const responseChoices = Array.isArray(responseRaw.choices)
    ? (responseRaw.choices as Array<Record<string, unknown>>)
    : [];
  const finishReason = responseChoices[0]?.finish_reason;

  const result: CompetitorImageRawAnalysisResult = {
    id: `${deck.id}:${image.id || `image-${imageIndex + 1}`}`,
    deckId: deck.id,
    imageId: String(image.id || `image-${imageIndex + 1}`),
    imageIndex: imageIndex + 1,
    imageUrl: String(image.url || ""),
    status: isEffectivelyEmptyRawAnalysisText(responseText) ? "failed" : "success",
    requestedModel,
    providerId: response.meta?.providerId || null,
    baseUrl: response.meta?.baseUrl || null,
    responseId: responseRaw.id ? String(responseRaw.id) : null,
    responseModel:
      responseRaw.model || response.meta?.model
        ? String(responseRaw.model || response.meta?.model)
        : null,
    finishReason: finishReason ? String(finishReason) : null,
    responseText,
    responsePreview: responseText.slice(0, 240),
    errorMessage: isEffectivelyEmptyRawAnalysisText(responseText)
      ? "逐图竞品分析返回了空内容。"
      : null,
    startedAt,
    completedAt: new Date().toISOString(),
  };

  const persisted = await persistCompetitorVisionSmokeDebugSnapshot({
    stage: "single-image-raw-analysis",
    result: {
      recordedAt: new Date().toISOString(),
      deckId: deck.id,
      deckName: trimText(deck.name, 120) || undefined,
      imageIndex: imageIndex + 1,
      imageUrl: trimText(image.url, 240) || undefined,
      requestedModel,
      providerId: response.meta?.providerId || null,
      baseUrl: response.meta?.baseUrl || null,
      responseId: responseRaw.id ? String(responseRaw.id) : null,
      responseModel:
        responseRaw.model || response.meta?.model
          ? String(responseRaw.model || response.meta?.model)
          : null,
      finishReason: finishReason ? String(finishReason) : null,
      responseText,
      responsePreview: responseText.slice(0, 400),
      nonEmpty: !isEffectivelyEmptyRawAnalysisText(responseText),
      prompt,
      imageTransportSummary,
      imageInputDiagnostics,
    },
  });
  result.latestDebugPath = persisted.latestSnapshotPath;
  result.dailyDebugPath = persisted.dailyLogPath;

  console.info("[ecomCompetitorImageRawAnalysis] completed", {
    deckId: deck.id,
    imageId: image.id,
    imageIndex: imageIndex + 1,
    status: result.status,
    providerId: result.providerId,
    responseModel: result.responseModel,
    responsePreview: result.responsePreview,
    latestDebugPath: result.latestDebugPath || null,
  });

  return result;
};

export const runCompetitorVisionSmokeTest = async (options: {
  deck: EcommerceCompetitorDeckInput;
  imageIndex?: number;
  model?: string | null;
}): Promise<CompetitorVisionSmokeTestResult> => {
  const deck = options.deck;
  const requestedModel =
    String(options.model || "").trim() || getBestModelId("text");
  const imageIndex = Math.max(
    0,
    Math.min(
      Number.isFinite(options.imageIndex) ? Math.floor(options.imageIndex as number) : 0,
      Math.max(0, (deck.images?.length || 1) - 1),
    ),
  );
  const image = deck.images?.[imageIndex];
  if (!image?.url) {
    throw new Error("当前竞品组没有可用于单图测试的截图。");
  }

  const prompt = [
    "请只基于这1张电商详情页截图做视觉识别。",
    "请用简体中文直接回答，不要返回 JSON，不要返回 markdown。",
    "按以下三行输出：",
    "1. 这是什么商品或页面",
    "2. 你能直接从图里看出的一个卖点或功能",
    "3. 你能直接从图里看出的一个版式特征",
    "如果看不清，就明确说看不清，不要输出 {}。",
  ].join("\n");

  const imagePart = await toCompetitorImagePart(image.url, imageIndex);
  const imageTransportSummary = summarizeCompetitorImageParts([imagePart]);
  const imageInputDiagnostics = buildImageInputDiagnostics(imageTransportSummary, 1);
  console.info("[ecomCompetitorVisionSmokeTest] image input ready", {
    deckId: deck.id,
    deckName: deck.name || "",
    imageIndex: imageIndex + 1,
    imageTransportSummary,
    imageInputDiagnostics,
  });

  const response = await generateJsonResponse({
    model: requestedModel,
    operation: "ecomCompetitorVisionSmokeTest",
    queueKey: "ecomCompetitorVisionSmokeTest",
    minIntervalMs: 1200,
    temperature: 0.1,
    responseFormat: "text",
    disableTextOnlyFallback: true,
    injectSchemaPrompt: false,
    requestTuning: {
      retries: 1,
      baseDelayMs: 1200,
      maxDelayMs: 4000,
    },
    parts: [
      { text: prompt },
      {
        text: `当前是竞品组 "${trimText(deck.name, 80) || deck.id}" 的第 ${imageIndex + 1} 张截图。`,
      },
      imagePart,
    ],
  });

  const responseRaw = (response.raw || {}) as Record<string, unknown>;
  const responseChoices = Array.isArray(responseRaw.choices)
    ? (responseRaw.choices as Array<Record<string, unknown>>)
    : [];
  const finishReason = responseChoices[0]?.finish_reason;
  const result: CompetitorVisionSmokeTestResult = {
    recordedAt: new Date().toISOString(),
    deckId: deck.id,
    deckName: trimText(deck.name, 120) || undefined,
    imageIndex: imageIndex + 1,
    imageUrl: trimText(image.url, 240) || undefined,
    requestedModel,
    providerId: response.meta?.providerId || null,
    baseUrl: response.meta?.baseUrl || null,
    responseId: responseRaw.id ? String(responseRaw.id) : null,
    responseModel:
      responseRaw.model || response.meta?.model
        ? String(responseRaw.model || response.meta?.model)
        : null,
    finishReason: finishReason ? String(finishReason) : null,
    responseText: String(response.text || ""),
    responsePreview: String(response.text || "").slice(0, 400),
    nonEmpty: String(response.text || "").trim().length > 0,
    prompt,
    imageTransportSummary,
    imageInputDiagnostics,
  };

  const persisted = await persistCompetitorVisionSmokeDebugSnapshot({
    stage: "single-image-minimal-vision-smoke",
    result,
  });
  result.latestSnapshotPath = persisted.latestSnapshotPath;
  result.dailyLogPath = persisted.dailyLogPath;

  console.info("[ecomCompetitorVisionSmokeTest] completed", result);
  return result;
};
