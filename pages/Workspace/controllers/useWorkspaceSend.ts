import { useCallback } from "react";
import type { AgentTask, AgentTaskMetadata, AgentType } from "../../../types/agent.types";
import { getAgentInfo } from "../../../services/agents";
import type {
  CanvasElement,
  ChatSendOptions,
  ChatMessage,
  GeneratedAsset,
  InputBlock,
  WorkspaceMarkerInfo,
  WorkspaceInputFile,
} from "../../../types";
import { createInputBlockId, useAgentStore } from "../../../stores/agent.store";
import { buildUserChatMessagePayloadFromInputBlocks } from "../chatMessageContent";
import type { SearchResponse } from "../../../services/research/search.service";
import {
  captureMainBrainMemoryFromExchange,
  recordMainBrainHeartbeatFromExchange,
} from "../../../services/runtime-assets/main-brain-auto-memory";
import {
  collectCanvasSelectionReferenceUrls,
  collectDerivedImageUrlsFromTask,
  EMPTY_WORKSPACE_SEND_INPUT_BLOCKS,
  gatherWorkspaceResearchContext,
  IMAGE_ERROR_PATTERN,
  type WorkspaceSendCreationMode,
  type WorkspaceSendReferenceWebPage,
  type WorkspaceSendResearchMode,
} from "./useWorkspaceSend.helpers";
import { createImagePreviewDataUrl } from "../workspaceShared";

export type WorkspaceSpecialSendHandlerParams = {
  text: string;
  attachments: File[];
  isWeb: boolean;
  skillData?: ChatMessage["skillData"];
  currentBlocks: InputBlock[];
};

type WorkspaceSendOptions = {
  isUploadingAttachments: boolean;
  isTyping: boolean;
  webEnabled: boolean;
  modelMode: "thinking" | "fast";
  creationMode: WorkspaceSendCreationMode;
  researchMode: WorkspaceSendResearchMode;
  imageGenRatio: string;
  imageGenRes: '1K' | '2K' | '4K';
  imageGenCount: 1 | 2 | 3 | 4;
  videoGenRatio: string;
  preferredImageModel: string;
  preferredImageProviderId: string | null;
  translatePromptToEnglish: boolean;
  enforceChineseTextInImage: boolean;
  requiredChineseCopy: string;
  selectedElementId: string | null;
  selectedElementIds: string[];
  elementsRef: React.MutableRefObject<CanvasElement[]>;
  getElementSourceUrl: (el: CanvasElement) => string | undefined;
  ensureConversationId: () => string;
  buildMemoryKey: (conversationId: string) => string;
  processMessage: (
    message: string,
    attachments?: File[],
    metadata?: AgentTaskMetadata,
    userMessageId?: string,
  ) => Promise<AgentTask | null>;
  addMessage: (message: ChatMessage) => void;
  setIsTyping: (typing: boolean) => void;
  setInputBlocks: (blocks: InputBlock[]) => void;
  clearInputDom?: () => void;
  handleSpecialSkillData?: (
    params: WorkspaceSpecialSendHandlerParams,
  ) => Promise<boolean>;
};

type BuildRequestMetadataParams = {
  topicId: string;
  isWeb: boolean;
  modelMode: "thinking" | "fast";
  creationMode: WorkspaceSendCreationMode;
  imageGenRatio: string;
  imageGenRes: '1K' | '2K' | '4K';
  imageGenCount: 1 | 2 | 3 | 4;
  videoGenRatio: string;
  preferredImageModel: string;
  preferredImageProviderId: string | null;
  translatePromptToEnglish: boolean;
  enforceChineseTextInImage: boolean;
  inlineParts?: ChatMessage["inlineParts"];
  requiredChineseCopy: string;
  skillData?: ChatMessage["skillData"];
  canvasSelectionReferenceUrls: string[];
  researchPayload: SearchResponse | null;
  researchReferenceImageUrls: string[];
  researchWebPages: WorkspaceSendReferenceWebPage[];
  researchStatus: "skipped" | "success" | "failed";
  researchErrorMessage?: string;
};

const buildResearchSummary = (
  researchWebPages: WorkspaceSendReferenceWebPage[],
  researchReferenceImageUrls: string[],
) => {
  if (researchWebPages.length > 0) {
    return `本次研究包含 ${researchWebPages.length} 个网页来源和 ${researchReferenceImageUrls.length} 张参考图片。`;
  }
  return `本次研究包含 ${researchReferenceImageUrls.length} 张参考图片。`;
};

const buildResearchProviderLabel = (researchPayload: SearchResponse | null) => {
  if (!researchPayload?.provider) return undefined;
  const labels = [researchPayload.provider.web, researchPayload.provider.images].filter(
    Boolean,
  );
  return labels.length > 0 ? labels.join(' / ') : undefined;
};

const buildResearchHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return undefined;
  }
};

const buildAgentResearchPayload = ({
  researchPayload,
  researchReferenceImageUrls,
  researchWebPages,
}: {
  researchPayload: SearchResponse | null;
  researchReferenceImageUrls: string[];
  researchWebPages: WorkspaceSendReferenceWebPage[];
}) => {
  if (!researchPayload) return undefined;

  const extractedCount = researchWebPages.filter((page) =>
    Boolean(String(page.cleanedTextExcerpt || "").trim()),
  ).length;

  return {
    status: 'completed' as const,
    mode: researchPayload.mode,
    query: researchPayload.query,
    summary: buildResearchSummary(
      researchWebPages,
      researchReferenceImageUrls,
    ),
    providerLabel: buildResearchProviderLabel(researchPayload),
    fallback: Boolean(researchPayload.provider?.fallback),
    webCount: Array.isArray(researchPayload.web) ? researchPayload.web.length : 0,
    imageCount: Array.isArray(researchPayload.images) ? researchPayload.images.length : 0,
    extractedCount,
    citations: researchWebPages.map((page) => ({
      title: page.title,
      url: page.url,
      host: buildResearchHost(page.url),
      siteName: page.siteName,
      snippet: page.snippet,
      excerpt: page.cleanedTextExcerpt || page.snippet,
    })),
    extractedPages: researchWebPages.map((page) => ({
      title: page.title,
      url: page.url,
      excerpt: page.snippet,
      cleanedTextExcerpt: page.cleanedTextExcerpt,
      length: page.length,
    })),
    suggestedQueries: researchPayload.hints?.suggestedQueries || [],
  };
};

const buildAgentResearchPayloadFromSkillResults = (
  skillResults: unknown,
) => {
  if (!Array.isArray(skillResults)) return undefined;

  const latestWorkspaceSearch = [...skillResults]
    .reverse()
    .find(
      (item) =>
        item &&
        typeof item === "object" &&
        (item as { success?: boolean }).success === true &&
        (item as { skillName?: string }).skillName === "workspaceSearch" &&
        (item as { result?: unknown }).result &&
        typeof (item as { result?: unknown }).result === "object",
    ) as
    | {
        result?: {
          mode?: "web" | "images" | "web+images";
          query?: string;
          summary?: string;
          provider?: {
            web?: string;
            images?: string;
            fallback?: boolean;
          };
          webResults?: Array<{
            title?: string;
            url?: string;
            snippet?: string;
            siteName?: string;
            excerpt?: string;
          }>;
          imageResults?: Array<unknown>;
          citations?: Array<{
            title?: string;
            url?: string;
          }>;
          extractedPages?: Array<{
            title?: string;
            url?: string;
            excerpt?: string;
            cleanedTextExcerpt?: string;
            length?: number;
            error?: string;
          }>;
          suggestedQueries?: string[];
        };
      }
    | undefined;

  const result = latestWorkspaceSearch?.result;
  if (!result) return undefined;

  const citations = Array.isArray(result.citations)
    ? result.citations
        .map((item) => {
          const title = String(item?.title || "").trim();
          const url = String(item?.url || "").trim();
          if (!title || !url) return null;

          const webMatch = Array.isArray(result.webResults)
            ? result.webResults.find((page) => String(page?.url || "").trim() === url)
            : undefined;

          return {
            title,
            url,
            host: buildResearchHost(url),
            siteName: String(webMatch?.siteName || "").trim() || undefined,
            snippet: String(webMatch?.snippet || "").trim() || undefined,
            excerpt:
              String(webMatch?.excerpt || "").trim() ||
              String(webMatch?.snippet || "").trim() ||
              undefined,
          };
        })
        .filter(Boolean)
    : [];

  const extractedPages = Array.isArray(result.extractedPages)
    ? result.extractedPages
        .map((page) => {
          const title = String(page?.title || "").trim();
          const url = String(page?.url || "").trim();
          if (!title || !url) return null;
          return {
            title,
            url,
            excerpt: String(page?.excerpt || "").trim() || undefined,
            cleanedTextExcerpt:
              String(page?.cleanedTextExcerpt || "").trim() || undefined,
            length:
              typeof page?.length === "number" ? page.length : undefined,
            error: String(page?.error || "").trim() || undefined,
          };
        })
        .filter(Boolean)
    : [];

  return {
    status: "completed" as const,
    mode: result.mode || "web",
    query: String(result.query || "").trim() || undefined,
    summary: String(result.summary || "").trim() || undefined,
    providerLabel:
      [result.provider?.web, result.provider?.images].filter(Boolean).join(" / ") ||
      undefined,
    fallback: Boolean(result.provider?.fallback),
    webCount: Array.isArray(result.webResults) ? result.webResults.length : 0,
    imageCount: Array.isArray(result.imageResults) ? result.imageResults.length : 0,
    extractedCount: extractedPages.filter((page) => page.cleanedTextExcerpt).length,
    citations,
    extractedPages,
    suggestedQueries: Array.isArray(result.suggestedQueries)
      ? result.suggestedQueries
      : [],
  };
};

const isTransientAttachmentPreviewUrl = (value: string | null | undefined) =>
  /^blob:/i.test(String(value || "").trim());

const dedupeWorkspaceAttachmentFiles = (files: WorkspaceInputFile[]) => {
  const seen = new Set<string>();
  return files.filter((file, index) => {
    const key =
      typeof file._attachmentId === "string" && file._attachmentId
        ? file._attachmentId
        : `${file.name}:${file.size}:${file.type}:${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const cloneWorkspaceInputFileFromBlob = (
  sourceFile: WorkspaceInputFile,
  blob: Blob,
): WorkspaceInputFile => {
  const nextFile = new File(
    [blob],
    sourceFile.name || `attachment-${Date.now()}.png`,
    {
      type: blob.type || sourceFile.type || "image/png",
      lastModified: Date.now(),
    },
  ) as WorkspaceInputFile;
  nextFile.markerId = sourceFile.markerId;
  nextFile.markerName = sourceFile.markerName;
  nextFile.markerInfo = sourceFile.markerInfo;
  nextFile.lastAiAnalysis = sourceFile.lastAiAnalysis;
  nextFile._canvasAutoInsert = sourceFile._canvasAutoInsert;
  nextFile._canvasElId = sourceFile._canvasElId;
  nextFile._canvasWidth = sourceFile._canvasWidth;
  nextFile._canvasHeight = sourceFile._canvasHeight;
  nextFile._attachmentId = sourceFile._attachmentId;
  nextFile._chipPreviewUrl = sourceFile._chipPreviewUrl;
  return nextFile;
};

const shouldPreloadResearchBeforeAgent = ({
  creationMode,
  skillData,
}: {
  creationMode: WorkspaceSendCreationMode;
  skillData?: ChatMessage["skillData"];
}) => {
  const allowAutonomousRouting =
    skillData?.config &&
    typeof skillData.config === "object" &&
    (skillData.config as Record<string, unknown>).allowAutonomousRouting === true;

  if (allowAutonomousRouting) {
    return false;
  }

  return creationMode !== "agent";
};

const hydrateCanvasAttachmentFile = async (
  file: WorkspaceInputFile,
  elementsSnapshot: CanvasElement[],
  getElementSourceUrl: (el: CanvasElement) => string | undefined,
): Promise<WorkspaceInputFile | null> => {
  const previewCandidate = String(file._chipPreviewUrl || "").trim();
  const canHydrateFromCanvas = Boolean(file._canvasElId || file._canvasAutoInsert);
  const canHydrateFromPreview = Boolean(previewCandidate);

  if (!canHydrateFromCanvas && !canHydrateFromPreview) {
    return file;
  }

  if (file.size > 32) {
    return file;
  }

  const matchedElement =
    typeof file._canvasElId === "string" && file._canvasElId
      ? elementsSnapshot.find((element) => element.id === file._canvasElId)
      : undefined;

  const sourceCandidates = [
    previewCandidate,
    String(
      matchedElement
        ? getElementSourceUrl(matchedElement) || matchedElement.url || ""
        : "",
    ).trim(),
  ].filter(Boolean);

  for (const candidate of sourceCandidates) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) continue;
      const blob = await response.blob();
      if (!blob.size) continue;
      return cloneWorkspaceInputFileFromBlob(file, blob);
    } catch {
      // try next candidate
    }
  }

  return null;
};

const buildRequestMetadata = ({
  topicId,
  isWeb,
  modelMode,
  creationMode,
  imageGenRatio,
  imageGenRes,
  imageGenCount,
  videoGenRatio,
  preferredImageModel,
  preferredImageProviderId,
  translatePromptToEnglish,
  enforceChineseTextInImage,
  requiredChineseCopy,
  skillData,
  canvasSelectionReferenceUrls,
  researchPayload,
  researchReferenceImageUrls,
  researchWebPages,
  researchStatus,
  researchErrorMessage,
  inlineParts,
}: BuildRequestMetadataParams): AgentTaskMetadata => {
  const allowAutonomousRouting =
    skillData?.config &&
    typeof skillData.config === "object" &&
    (skillData.config as Record<string, unknown>).allowAutonomousRouting === true;
  const skillConfig =
    skillData?.config && typeof skillData.config === "object"
      ? (skillData.config as Record<string, unknown>)
      : undefined;
  const effectiveCreationMode = allowAutonomousRouting ? "agent" : creationMode;
  const suggestedTaskMode = String(skillConfig?.suggestedTaskMode || "").trim().toLowerCase();
  const effectiveTaskMode =
    allowAutonomousRouting &&
    ['chat', 'research', 'layout-edit', 'text-edit', 'touch-edit', 'edit', 'generate'].includes(
      suggestedTaskMode,
    )
      ? suggestedTaskMode
      : undefined;

  return {
    topicId,
    enableWebSearch: isWeb && researchStatus !== "failed",
    webResearchStatus: researchStatus,
    webResearchError:
      researchStatus === "failed"
        ? researchErrorMessage || "检索失败，请稍后重试"
        : undefined,
    creationMode: effectiveCreationMode,
    taskMode: effectiveTaskMode,
    workflowMode: modelMode === "fast" ? "fast" : "designer",
    preferredAspectRatio:
      effectiveCreationMode === "video" ? videoGenRatio : imageGenRatio,
    preferredImageModel:
      effectiveCreationMode === "video" ? undefined : preferredImageModel,
    preferredImageProviderId:
      effectiveCreationMode === "video" ? undefined : preferredImageProviderId,
    preferredImageSize: imageGenRes,
    preferredImageCount: effectiveCreationMode === "image" ? imageGenCount : 1,
    promptLanguagePolicy: translatePromptToEnglish
      ? "translate-en"
      : "original-zh",
    textRenderPolicy: {
      enforceChinese: enforceChineseTextInImage,
      requiredCopy: (requiredChineseCopy || "").trim(),
    },
    skillData,
    allowAutonomousRouting,
    multimodalContext: {
      referenceImageUrls: Array.from(
        new Set([
          ...canvasSelectionReferenceUrls,
          ...researchReferenceImageUrls,
        ]),
      ),
      referencePolicy:
        allowAutonomousRouting && effectiveCreationMode === "agent"
          ? "uploaded-only"
          : "default",
      uploadedAttachmentCount: 0,
      referenceWebPages: researchWebPages,
      inlineParts,
      research: researchPayload
        ? {
            requestId: researchPayload.requestId,
            query: researchPayload.query,
            mode: researchPayload.mode,
            provider: researchPayload.provider,
            suggestedQueries: researchPayload.hints?.suggestedQueries || [],
            reportBrief: buildResearchSummary(
              researchWebPages,
              researchReferenceImageUrls,
            ),
            reportFull: researchWebPages
              .map(
                (page, index) =>
                  `${index + 1}. ${page.title}\n${page.url}\n${page.snippet || ""}`,
              )
              .join("\n\n"),
            citations: researchWebPages.map((page) => ({
              title: page.title,
              url: page.url,
            })),
          }
        : undefined,
    },
  };
};

export function useWorkspaceSend(options: WorkspaceSendOptions) {
  const {
    isUploadingAttachments,
    isTyping,
    webEnabled,
    modelMode,
    creationMode,
    researchMode,
    imageGenRatio,
    imageGenRes,
    imageGenCount,
    videoGenRatio,
    preferredImageModel,
    preferredImageProviderId,
    translatePromptToEnglish,
    enforceChineseTextInImage,
    requiredChineseCopy,
    selectedElementId,
    selectedElementIds,
    elementsRef,
    getElementSourceUrl,
    ensureConversationId,
    buildMemoryKey,
    processMessage,
    addMessage,
    setIsTyping,
    setInputBlocks,
    clearInputDom,
    handleSpecialSkillData,
  } = options;

  return useCallback(
    async (
      overridePrompt?: string,
      overrideAttachments?: File[],
      overrideWeb?: boolean,
      skillData?: ChatMessage["skillData"],
      sendOptions?: ChatSendOptions,
    ) => {
      if (isUploadingAttachments) {
        addMessage({
          id: `upload-wait-${Date.now()}`,
          role: "model",
          text: "附件仍在上传中，请等待上传完成后再发送。",
          timestamp: Date.now(),
          error: true,
        });
        return;
      }

      if (isTyping) {
        return;
      }

      const currentBlocks = useAgentStore.getState().composer.inputBlocks;
      const text =
        overridePrompt ??
        currentBlocks
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join(" ")
          .trim();
      const selectedIdsSnapshot =
        selectedElementIds.length > 0
          ? [...selectedElementIds]
          : selectedElementId
            ? [selectedElementId]
            : [];
      const elementsSnapshot = [...elementsRef.current];
      const pendingAttachments =
        useAgentStore.getState().composer.pendingAttachments || [];
      const confirmedAttachmentFiles =
        overrideAttachments ??
        ((currentBlocks
          .filter((block) => block.type === "file" && block.file)
          .map((block) => block.file!) as WorkspaceInputFile[]));
      const allAttachmentFiles =
        overrideAttachments !== undefined
          ? (overrideAttachments as WorkspaceInputFile[])
          : dedupeWorkspaceAttachmentFiles([
              ...confirmedAttachmentFiles,
              ...pendingAttachments.map((item) => item.file as WorkspaceInputFile),
            ]);
      const attachments = (
        await Promise.all(
          allAttachmentFiles.map((file) =>
            hydrateCanvasAttachmentFile(
              file as WorkspaceInputFile,
              elementsSnapshot,
              getElementSourceUrl,
            ),
          ),
        )
      ).filter(Boolean) as WorkspaceInputFile[];
      const isWeb = overrideWeb ?? webEnabled;

      if (handleSpecialSkillData) {
        const handled = await handleSpecialSkillData({
          text,
          attachments,
          isWeb,
          skillData,
          currentBlocks,
        });
        if (handled) {
          return;
        }
      }

      if (!text && attachments.length === 0) return;

      const effectiveConversationId = ensureConversationId();
      const effectiveTopicId = buildMemoryKey(effectiveConversationId);

      // 强制所有发送都走 buildUserChatMessagePayloadFromInputBlocks 确保 inlineParts 被构建
      let effectiveBlocks: InputBlock[] = currentBlocks;
      let effectivePendingFiles: WorkspaceInputFile[] = pendingAttachments.map(
        (item) => item.file as WorkspaceInputFile,
      );

      if (overridePrompt !== undefined || overrideAttachments !== undefined) {
        effectiveBlocks = [];

        // 如果有 overridePrompt 文本，添加为 text block
        if (overridePrompt !== undefined && overridePrompt.trim()) {
          effectiveBlocks.push({
            id: createInputBlockId("override-text"),
            type: 'text' as const,
            text: overridePrompt.trim(),
          });
        }

        // 如果有 overrideAttachments，添加为 file blocks
        if (overrideAttachments !== undefined && overrideAttachments.length > 0) {
          for (let i = 0; i < overrideAttachments.length; i++) {
            effectiveBlocks.push({
              id: `override-file-${i}-${Date.now()}`,
              type: 'file' as const,
              file: overrideAttachments[i] as WorkspaceInputFile,
            });
          }
          effectivePendingFiles = [];
        }
      }

      const userMessagePayload =
        await buildUserChatMessagePayloadFromInputBlocks({
          inputBlocks: effectiveBlocks,
          pendingFiles: effectivePendingFiles,
        });

      const userMessageId = Date.now().toString();
      const normalizedLineageSource = sendOptions?.lineage?.source || "send";
      const normalizedVersionRootMessageId =
        String(sendOptions?.lineage?.versionRootMessageId || "").trim() ||
        userMessageId;
      const normalizedPreviousVersionMessageId =
        String(sendOptions?.lineage?.previousVersionMessageId || "").trim() ||
        undefined;
      const normalizedTriggerMessageId =
        String(sendOptions?.lineage?.triggerMessageId || "").trim() || undefined;
      const normalizedPreviousAssistantMessageId =
        String(sendOptions?.lineage?.previousAssistantMessageId || "").trim() ||
        undefined;
      const nextVersionNumber =
        normalizedVersionRootMessageId === userMessageId
          ? 1
          : 1 +
            useAgentStore
              .getState()
              .messages.filter(
                (message) =>
                  message.role === "user" &&
                  message.lineage?.versionRootMessageId ===
                    normalizedVersionRootMessageId,
              ).length;

      const userMsg: ChatMessage = {
        id: userMessageId,
        role: "user",
        text,
        attachments: userMessagePayload.attachments,
        attachmentMetadata: userMessagePayload.attachmentMetadata,
        inlineParts: userMessagePayload.inlineParts,
        timestamp: Date.now(),
        skillData,
        lineage: {
          versionRootMessageId: normalizedVersionRootMessageId,
          previousVersionMessageId: normalizedPreviousVersionMessageId,
          versionNumber: nextVersionNumber,
          source: normalizedLineageSource,
          triggerMessageId: normalizedTriggerMessageId,
        },
      };
      addMessage(userMsg);

      setIsTyping(true);
      setInputBlocks(EMPTY_WORKSPACE_SEND_INPUT_BLOCKS);
      clearInputDom?.();

      try {
        const canvasSelectionReferenceUrls = collectCanvasSelectionReferenceUrls({
          currentBlocks,
          selectedIdsSnapshot,
          elementsSnapshot,
          pendingAttachments: useAgentStore.getState().composer.pendingAttachments || [],
          getElementSourceUrl,
        });
        let researchPayload: SearchResponse | null = null;
        let researchReferenceImageUrls: string[] = [];
        let researchWebPages: WorkspaceSendReferenceWebPage[] = [];
        let researchStatus: "skipped" | "success" | "failed" = "skipped";
        let researchErrorMessage: string | undefined;

        if (
          shouldPreloadResearchBeforeAgent({
            creationMode,
            skillData,
          })
        ) {
          ({
            researchPayload,
            researchReferenceImageUrls,
            researchWebPages,
            researchStatus,
            researchErrorMessage,
          } = await gatherWorkspaceResearchContext(text, researchMode, isWeb));
        } else {
          console.log(
            "[Workspace] handleSend: skip eager research, defer to agent workspaceSearch",
            {
              creationMode,
              isWeb,
              hasSkill: Boolean(skillData?.id || skillData?.name),
            },
          );
        }

        const requestMetadata = buildRequestMetadata({
          topicId: effectiveTopicId,
          isWeb,
          modelMode,
          creationMode,
          imageGenRatio,
          imageGenRes,
          imageGenCount,
          videoGenRatio,
          preferredImageModel,
          preferredImageProviderId,
          translatePromptToEnglish,
          enforceChineseTextInImage,
          requiredChineseCopy,
          skillData,
          canvasSelectionReferenceUrls,
          researchPayload,
          researchReferenceImageUrls,
          researchWebPages,
          researchStatus,
          researchErrorMessage,
          inlineParts: userMessagePayload.inlineParts,
        });
        if (requestMetadata.multimodalContext) {
          requestMetadata.multimodalContext.uploadedAttachmentCount =
            attachments.length;
          if (attachments.length > 0) {
            requestMetadata.multimodalContext.referencePolicy = "uploaded-only";
          }
        }

        if (researchStatus === "failed") {
          addMessage({
            id: `research-unavailable-${Date.now()}`,
            role: "model",
            text: `本轮联网检索未成功：${researchErrorMessage || "检索失败，请稍后重试"}。如果继续回答，只能基于已有知识，不能视为实时查询结果。`,
            timestamp: Date.now(),
            error: true,
          });
        }

        console.log(
          "[Workspace] handleSend: calling processMessage with text:",
          text.substring(0, 50),
        );
        const result = await processMessage(
          text,
          attachments,
          requestMetadata,
          userMsg.id,
        );
        console.log(
          "[Workspace] handleSend: processMessage returned:",
          result?.status,
          result?.output?.message?.substring(0, 50),
        );

        if (result && result.output) {
          const wasUserCancelled =
            result.output.error?.code === "USER_CANCELLED";
          const agentInfo = getAgentInfo(result.agentId);
          const derivedImageUrls = collectDerivedImageUrlsFromTask(result);
          const derivedVideoUrls = (result.output.assets || [])
            .filter(
              (asset): asset is GeneratedAsset =>
                asset?.type === "video" &&
                typeof asset.id === "string" &&
                typeof asset.url === "string" &&
                Boolean(asset?.metadata),
            )
            .map((asset) => asset.url);
          const agentMsg: ChatMessage = {
            id: result.id,
            role: "model",
            text: result.output.message || "Task completed.",
            timestamp: Date.now(),
            responseToMessageId: userMsg.id,
            lineage: {
              versionRootMessageId: normalizedVersionRootMessageId,
              previousVersionMessageId: normalizedPreviousAssistantMessageId,
              versionNumber: nextVersionNumber,
              source: normalizedLineageSource,
              triggerMessageId:
                normalizedPreviousAssistantMessageId || normalizedTriggerMessageId,
            },
            error: result.status === "failed",
            agentData: {
              model: result.agentId,
              title: agentInfo.name,
              description: agentInfo.description,
              imageUrls: Array.from(new Set(derivedImageUrls)),
              videoUrls: Array.from(new Set(derivedVideoUrls)),
              assets: result.output.assets,
              proposals: result.output.proposals,
              skillCalls: result.output.skillCalls,
              analysis: result.output.analysis,
              answerSegments: result.output.answerSegments,
              preGenerationMessage: result.output.preGenerationMessage,
              postGenerationSummary: result.output.postGenerationSummary,
              suggestions: result.output.adjustments || [],
              presentation: wasUserCancelled
                ? {
                    kind: "execution_record",
                    statusLabel: "已停止",
                    detailTitle: "查看执行记录",
                    detailNotice: "这次生成由你主动停止，已保留上下文与执行记录。",
                  }
                : undefined,
              executionTrace: {
                status:
                  result.status === "analyzing" ||
                  result.status === "executing" ||
                  result.status === "completed" ||
                  result.status === "failed"
                    ? result.status
                    : "completed",
                progressMessage: result.progressMessage,
                progressStep: result.progressStep,
                totalSteps: result.totalSteps,
                progressLog: result.progressLog,
                streamingText: result.streamingText,
                reasoningText: result.reasoningText,
                stopReason: result.output.runtime?.stopReason,
                stopReasonLabel: result.output.runtime?.stopReasonLabel,
                errorCode: result.output.error?.code,
                errorMessage: result.output.error?.message,
              },
              research:
                buildAgentResearchPayload({
                  researchPayload,
                  researchReferenceImageUrls,
                  researchWebPages,
                }) ||
                buildAgentResearchPayloadFromSkillResults(
                  result.output.skillCalls,
                ),
            },
          };
          addMessage(agentMsg);

          if (result.status === "completed" && !wasUserCancelled) {
            const memoryCapture = captureMainBrainMemoryFromExchange({
              topicId: effectiveTopicId,
              userMessage: text,
              assistantMessage: result.output.message || "",
              assistantSummary: result.output.postGenerationSummary,
              task: result,
            });
            recordMainBrainHeartbeatFromExchange({
              capturedMemorySummaries: memoryCapture.createdSummaries,
              task: result,
            });
          }
        }
      } catch (error) {
        console.error("[Workspace] handleSend failed:", error);
        const rawError =
          error instanceof Error ? error.message : String(error || "");
        const isImageError = IMAGE_ERROR_PATTERN.test(rawError);
        addMessage({
          id: `err-${Date.now()}`,
          role: "model",
          text: isImageError
            ? "Image processing failed. Please check the upload and try again."
            : "Something went wrong while handling the request. Please try again.",
          timestamp: Date.now(),
          responseToMessageId: userMsg.id,
          lineage: {
            versionRootMessageId: normalizedVersionRootMessageId,
            previousVersionMessageId: normalizedPreviousAssistantMessageId,
            versionNumber: nextVersionNumber,
            source: normalizedLineageSource,
            triggerMessageId:
              normalizedPreviousAssistantMessageId || normalizedTriggerMessageId,
          },
          error: true,
        });
      } finally {
        setIsTyping(false);
      }
    },
    [
      addMessage,
      buildMemoryKey,
      clearInputDom,
      creationMode,
      elementsRef,
      enforceChineseTextInImage,
      getElementSourceUrl,
      handleSpecialSkillData,
      imageGenRatio,
      imageGenRes,
      imageGenCount,
      isTyping,
      isUploadingAttachments,
      preferredImageModel,
      preferredImageProviderId,
      processMessage,
      requiredChineseCopy,
      researchMode,
      selectedElementId,
      selectedElementIds,
      setInputBlocks,
      setIsTyping,
      translatePromptToEnglish,
      videoGenRatio,
      webEnabled,
      ensureConversationId,
    ],
  );
}
