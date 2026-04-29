import type { AgentTask } from "../../../types/agent.types";
import type { CanvasElement, ChatMessage, InputBlock } from "../../../types";
import {
  extractWebPage,
  pickUsableReferenceImages,
  rehostImageUrl,
  runResearchSearch,
  type SearchResponse,
} from "../../../services/research/search.service";

export type WorkspaceSendCreationMode = "agent" | "image" | "video";
export type WorkspaceSendResearchMode = "off" | "images" | "web+images";

export type WorkspaceSendReferenceWebPage = {
  title: string;
  url: string;
  snippet?: string;
  siteName?: string;
};

export type WorkspaceSendResearchContextResult = {
  researchPayload: SearchResponse | null;
  researchReferenceImageUrls: string[];
  researchWebPages: WorkspaceSendReferenceWebPage[];
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

  const webCandidates = (researchPayload.web || []).slice(0, 8);
  const extractedWebs = await Promise.allSettled(
    webCandidates.map(async (item) => {
      const extracted = await extractWebPage(item.url);
      return {
        title: extracted.title || item.title,
        url: item.url,
        snippet: extracted.excerpt || item.snippet,
        siteName: item.siteName,
      };
    }),
  );

  researchWebPages = extractedWebs
    .map((item, index) => {
      if (item.status === "fulfilled") return item.value;
      const fallback = webCandidates[index];
      return {
        title: fallback?.title || "",
        url: fallback?.url || "",
        snippet: fallback?.snippet,
        siteName: fallback?.siteName,
      };
    })
    .filter((item) => /^https?:\/\//i.test(item.url))
    .map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      siteName: item.siteName,
    }));

  return {
    researchPayload,
    researchReferenceImageUrls,
    researchWebPages,
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
  /campaign|poster|style|landmark|route|event|video|cover|marketing/i;

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
      (call) =>
        Boolean(call?.success) && typeof call?.result === "string"
          ? [call.result]
          : [],
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
) =>
  researchMode !== "off" &&
  !skillData &&
  SHOULD_RESEARCH_PATTERN.test(text);

export const gatherWorkspaceResearchContext = async (
  text: string,
  researchMode: WorkspaceSendResearchMode,
): Promise<WorkspaceSendResearchContextResult> => {
  if (!shouldRunWorkspaceResearch(text, researchMode)) {
    return {
      researchPayload: null,
      researchReferenceImageUrls: [],
      researchWebPages: [],
    };
  }

  try {
    return await executeWorkspaceResearchContext(
      text,
      researchMode === "images" ? "images" : "web+images",
    );
  } catch (researchError) {
    console.warn(
      "[Workspace] research search failed, fallback to direct generation",
      researchError,
    );
  }

  return {
    researchPayload: null,
    researchReferenceImageUrls: [],
    researchWebPages: [],
  };
};
