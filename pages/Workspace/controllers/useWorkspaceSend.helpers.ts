import type { AgentTask } from "../../../types/agent.types.ts";
import type { CanvasElement, ChatMessage, InputBlock } from "../../../types";
import { extractImageUrlsFromResult } from "../../../services/agents/image-result-extractor";
import {
  extractWebPage,
  pickUsableReferenceImages,
  rehostImageUrl,
  runResearchSearch,
  type SearchResponse,
} from "../../../services/research/search.service.ts";

export type WorkspaceSendCreationMode = "agent" | "image" | "video";
export type WorkspaceSendResearchMode = "off" | "images" | "web+images";

export type WorkspaceSendReferenceWebPage = {
  title: string;
  url: string;
  snippet?: string;
  siteName?: string;
  cleanedTextExcerpt?: string;
  length?: number;
};

export type WorkspaceSendResearchStatus = "skipped" | "success" | "failed";

export type WorkspaceSendResearchContextResult = {
  researchPayload: SearchResponse | null;
  researchReferenceImageUrls: string[];
  researchWebPages: WorkspaceSendReferenceWebPage[];
  researchStatus: WorkspaceSendResearchStatus;
  researchErrorMessage?: string;
};

const isExtractableResearchUrl = (url: string): boolean => {
  const normalized = String(url || "").trim();
  if (!/^https?:\/\//i.test(normalized)) return false;

  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.toLowerCase();
    if (
      /\.(jpg|jpeg|png|webp|gif|svg|bmp|ico|pdf|zip|rar|7z|mp4|mp3|mov|avi)(?:$|\?)/i.test(
        pathname,
      )
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const executeWorkspaceResearchContext = async (
  text: string,
  researchMode: Exclude<WorkspaceSendResearchMode, "off">,
): Promise<WorkspaceSendResearchContextResult> => {
  let researchPayload: SearchResponse | null = null;
  let researchReferenceImageUrls: string[] = [];
  let researchWebPages: WorkspaceSendReferenceWebPage[] = [];

  const activeResearchMode =
    researchMode === "images" ? "images" : "web+images";
  researchPayload = await runResearchSearch(text, activeResearchMode);
  if (researchPayload.provider?.fallback) {
    console.warn(
      "[Workspace] research is using fallback providers (no Bing key)",
    );
  }

  const rawImageUrls = pickUsableReferenceImages(researchPayload.images, 8);
  if (rawImageUrls.length > 0) {
    const rehosted = await Promise.allSettled(
      rawImageUrls.map((url) => rehostImageUrl(url)),
    );
    researchReferenceImageUrls = rehosted
      .map((item, index) => {
        if (item.status === "fulfilled" && item.value?.hostedUrl) {
          return item.value.hostedUrl;
        }
        return rawImageUrls[index];
      })
      .filter((url) => /^https?:\/\//i.test(url));
  }

  const webCandidates = (researchPayload.web || [])
    .filter((item) => isExtractableResearchUrl(item.url))
    .slice(0, 8);
  const directExtractedWebs = webCandidates
    .filter((item) => String(item.cleanedTextExcerpt || "").trim())
    .map((item) => ({
      title: item.title,
      url: item.url,
      snippet:
        String(item.excerpt || "").trim() ||
        String(item.snippet || "").trim() ||
        undefined,
      siteName: item.siteName,
      cleanedTextExcerpt: String(item.cleanedTextExcerpt || "").trim(),
      length: typeof item.length === "number" ? item.length : undefined,
    }));
  const needsFallbackExtraction = webCandidates.filter(
    (item) => !String(item.cleanedTextExcerpt || "").trim(),
  );
  const extractedWebs = await Promise.allSettled(
    needsFallbackExtraction.map(async (item) => {
      const extracted = await extractWebPage(item.url, {
        query: text,
      });
      return {
        title: extracted.title || item.title,
        url: item.url,
        snippet: extracted.excerpt || item.snippet,
        siteName: item.siteName,
        cleanedTextExcerpt:
          String(extracted.cleanedText || "").trim() ||
          String(extracted.excerpt || "").trim() ||
          String(item.snippet || "").trim() ||
          undefined,
        length: extracted.length,
      };
    }),
  );
  const extractFailureCount = extractedWebs.filter(
    (item) => item.status === "rejected",
  ).length;
  if (extractFailureCount > 0) {
    console.warn("[Workspace] research extract partially fell back to snippets", {
      attempted: extractedWebs.length,
      failed: extractFailureCount,
    });
  }

  researchWebPages = extractedWebs
    .map((item, index) => {
      if (item.status === "fulfilled") return item.value;
      const fallback = needsFallbackExtraction[index];
      return {
        title: fallback?.title || "",
        url: fallback?.url || "",
        snippet: fallback?.snippet,
        siteName: fallback?.siteName,
        cleanedTextExcerpt: fallback?.cleanedTextExcerpt,
        length: fallback?.length,
      };
    })
    .filter((item) => /^https?:\/\//i.test(item.url))
    .map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      siteName: item.siteName,
      cleanedTextExcerpt: item.cleanedTextExcerpt,
      length: item.length,
    }));
  researchWebPages = [...directExtractedWebs, ...researchWebPages].slice(0, 8);

  const hasUsableSearchResult =
    researchReferenceImageUrls.length > 0 ||
    researchWebPages.length > 0 ||
    (researchPayload.web || []).length > 0 ||
    (researchPayload.images || []).length > 0;

  if (researchPayload.provider?.fallback && !hasUsableSearchResult) {
    return {
      researchPayload,
      researchReferenceImageUrls,
      researchWebPages,
      researchStatus: "failed",
      researchErrorMessage:
        "当前搜索源回退到免费模式后未返回可用结果，请配置可用联网搜索服务商或补充有效 Key。",
    };
  }

  return {
    researchPayload,
    researchReferenceImageUrls,
    researchWebPages,
    researchStatus: "success",
  };
};

export { executeWorkspaceResearchContext };

export type WorkspaceSendCanvasAttachmentRef = {
  source?: string;
  canvasElId?: string;
};

type DerivedTaskSkillCall = {
  success?: boolean;
  result?: unknown;
};

type CollectCanvasReferenceUrlsParams = {
  currentBlocks: InputBlock[];
  selectedIdsSnapshot: string[];
  elementsSnapshot: CanvasElement[];
  pendingAttachments: WorkspaceSendCanvasAttachmentRef[];
  getElementSourceUrl: (el: CanvasElement) => string | undefined;
};

const SHOULD_RESEARCH_PATTERN =
  /campaign|poster|style|landmark|route|event|video|cover|marketing|research|investigate|study|look up|reference|调查|调研|研究|查资料|查一下|搜集|搜一下|了解一下|资料|竞品|品牌信息|产品信息|活动信息|演出信息|官方公告|时间安排|阵容信息/i;

const SHOULD_FORCE_RESEARCH_PATTERN =
  /天气|气温|温度|下雨|降雨|空气质量|AQI|实时|现在|今天|明天|新闻|热搜|汇率|股价|油价|金价|路况|航班|高铁|日期|时间|几点|台风|什么时候|何时|哪天|几号|今年|本周|本月|举办|开幕|闭幕|活动|演出|音乐节|发布会|峰会|论坛|阵容|嘉宾|压轴|门票|票价|开票|地点|场馆/i;

const SHOULD_CONTINUE_RESEARCH_PATTERN =
  /^(查|查一下|搜|搜一下|继续查|继续搜|是的[，, ]?查|是的[，, ]?搜)$/i;

export const IMAGE_ERROR_PATTERN =
  /image|upload|base64|attachment|mime|format/i;

export const EMPTY_WORKSPACE_SEND_INPUT_BLOCKS: InputBlock[] = [
  { id: "init", type: "text", text: "" },
];

export const collectDerivedImageUrlsFromTask = (
  result: AgentTask,
): string[] => {
  if (result.output?.imageUrls && result.output.imageUrls.length > 0) {
    return result.output.imageUrls;
  }

  return [
    ...((result.output?.assets || [])
      .filter((asset) => asset?.type === "image" && typeof asset.url === "string")
      .map((asset) => asset.url)),
    ...(((result.output?.skillCalls || []) as DerivedTaskSkillCall[]).flatMap(
      (call) => (Boolean(call?.success) ? extractImageUrlsFromResult(call?.result) : []),
    )),
  ];
};

export const collectCanvasSelectionReferenceUrls = ({
  currentBlocks,
  selectedIdsSnapshot,
  elementsSnapshot,
  pendingAttachments,
  getElementSourceUrl,
}: CollectCanvasReferenceUrlsParams): string[] => {
  const urls: string[] = [];
  const seen = new Set<string>();
  const pushUrl = (url?: string) => {
    if (!url || typeof url !== "string") return;
    const normalized = url.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    urls.push(normalized);
  };

  if (selectedIdsSnapshot.length > 0) {
    for (const el of elementsSnapshot) {
      if (!selectedIdsSnapshot.includes(el.id)) continue;
      if (el.type !== "image" && el.type !== "gen-image") continue;
      pushUrl(getElementSourceUrl(el) || el.url);
    }
  }

  const confirmedCanvasIds = currentBlocks
    .filter(
      (block) =>
        block.type === "file" && block.file && block.file._canvasElId,
    )
    .map((block) => block.file?._canvasElId)
    .filter((canvasId): canvasId is string => typeof canvasId === "string");

  for (const canvasId of confirmedCanvasIds) {
    const hit = elementsSnapshot.find((element) => element.id === canvasId);
    if (!hit) continue;
    pushUrl(getElementSourceUrl(hit) || hit.url);
  }

  for (const pending of pendingAttachments) {
    if (pending.source !== "canvas" || !pending.canvasElId) continue;
    const hit = elementsSnapshot.find(
      (element) => element.id === pending.canvasElId,
    );
    if (!hit) continue;
    pushUrl(getElementSourceUrl(hit) || hit.url);
  }

  return urls;
};

export const shouldRunWorkspaceResearch = (
  text: string,
  researchMode: WorkspaceSendResearchMode,
  skillData?: ChatMessage["skillData"],
) => {
  const normalized = String(text || "").trim();
  if (researchMode === "off" || !normalized) return false;
  const allowAutonomousRouting =
    skillData?.config &&
    typeof skillData.config === "object" &&
    (skillData.config as Record<string, unknown>).allowAutonomousRouting === true;
  if (allowAutonomousRouting) {
    return (
      SHOULD_RESEARCH_PATTERN.test(normalized) ||
      SHOULD_FORCE_RESEARCH_PATTERN.test(normalized) ||
      SHOULD_CONTINUE_RESEARCH_PATTERN.test(normalized)
    );
  }
  return (
    !skillData &&
    (
      SHOULD_RESEARCH_PATTERN.test(normalized) ||
      SHOULD_FORCE_RESEARCH_PATTERN.test(normalized) ||
      SHOULD_CONTINUE_RESEARCH_PATTERN.test(normalized)
    )
  );
};

export const gatherWorkspaceResearchContext = async (
  text: string,
  researchMode: WorkspaceSendResearchMode,
  enableWebResearch: boolean = true,
): Promise<WorkspaceSendResearchContextResult> => {
  const effectiveResearchMode =
    !enableWebResearch && researchMode === "web+images" ? "off" : researchMode;

  if (!shouldRunWorkspaceResearch(text, effectiveResearchMode)) {
    return {
      researchPayload: null,
      researchReferenceImageUrls: [],
      researchWebPages: [],
      researchStatus: "skipped",
    };
  }

  try {
    return await executeWorkspaceResearchContext(
      text,
      effectiveResearchMode === "images" ? "images" : "web+images",
    );
  } catch (researchError) {
    console.warn(
      "[Workspace] research search failed, fallback to direct generation",
      researchError,
    );

    return {
      researchPayload: null,
      researchReferenceImageUrls: [],
      researchWebPages: [],
      researchStatus: "failed",
      researchErrorMessage:
        researchError instanceof Error
          ? researchError.message
          : String(researchError || "检索失败，请稍后重试"),
    };
  }
};
