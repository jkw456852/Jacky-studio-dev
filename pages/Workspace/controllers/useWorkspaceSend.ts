import { useCallback } from "react";
import type { AgentTask, AgentTaskMetadata, AgentType } from "../../../types/agent.types";
import { getAgentInfo } from "../../../services/agents";
import type {
  CanvasElement,
  ChatMessage,
  InputBlock,
  WorkspaceInputFile,
} from "../../../types";
import { useAgentStore } from "../../../stores/agent.store";
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
  agentSelectionMode: "auto" | "manual";
  pinnedAgentId: AgentType;
  selectedRoleId: string | null;
  selectedRoleSource: AgentTaskMetadata["selectedRoleSource"] | null;
  baseAgentId: AgentType;
  roleGovernanceMode: NonNullable<AgentTaskMetadata["roleGovernanceMode"]>;
  allowMainBrainRoleMutation: boolean;
  allowMainBrainRolePromotion: boolean;
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
  agentSelectionMode: "auto" | "manual";
  pinnedAgentId: AgentType;
  selectedRoleId: string | null;
  selectedRoleSource: AgentTaskMetadata["selectedRoleSource"] | null;
  baseAgentId: AgentType;
  roleGovernanceMode: NonNullable<AgentTaskMetadata["roleGovernanceMode"]>;
  allowMainBrainRoleMutation: boolean;
  allowMainBrainRolePromotion: boolean;
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
    extractedCount: researchWebPages.length,
    citations: researchWebPages.map((page) => ({
      title: page.title,
      url: page.url,
      host: buildResearchHost(page.url),
      siteName: page.siteName,
      snippet: page.snippet,
      excerpt: page.snippet,
    })),
    extractedPages: researchWebPages.map((page) => ({
      title: page.title,
      url: page.url,
      excerpt: page.snippet,
      cleanedTextExcerpt: page.snippet,
    })),
    suggestedQueries: researchPayload.hints?.suggestedQueries || [],
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

const hydrateCanvasAttachmentFile = async (
  file: WorkspaceInputFile,
  elementsSnapshot: CanvasElement[],
  getElementSourceUrl: (el: CanvasElement) => string | undefined,
): Promise<WorkspaceInputFile | null> => {
  if (!(file._canvasElId || file._canvasAutoInsert)) {
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
    String(file._chipPreviewUrl || "").trim(),
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
  agentSelectionMode,
  pinnedAgentId,
  selectedRoleId,
  selectedRoleSource,
  baseAgentId,
  roleGovernanceMode,
  allowMainBrainRoleMutation,
  allowMainBrainRolePromotion,
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
  const effectiveCreationMode = allowAutonomousRouting ? "agent" : creationMode;

  return {
    topicId,
    enableWebSearch: isWeb && researchStatus !== "failed",
    webResearchStatus: researchStatus,
    webResearchError:
      researchStatus === "failed"
        ? researchErrorMessage || "检索失败，请稍后重试"
        : undefined,
    agentSelectionMode,
    pinnedAgentId: agentSelectionMode === "manual" ? pinnedAgentId : undefined,
    selectedRoleId: selectedRoleId || undefined,
    selectedRoleSource: selectedRoleSource || undefined,
    baseAgentId,
    roleGovernanceMode,
    allowMainBrainRoleMutation,
    allowMainBrainRolePromotion,
    creationMode: effectiveCreationMode,
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
    agentSelectionMode,
    pinnedAgentId,
    selectedRoleId,
    selectedRoleSource,
    baseAgentId,
    roleGovernanceMode,
    allowMainBrainRoleMutation,
    allowMainBrainRolePromotion,
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
            id: `override-text-${Date.now()}`,
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

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        text,
        attachments: userMessagePayload.attachments,
        attachmentMetadata: userMessagePayload.attachmentMetadata,
        inlineParts: userMessagePayload.inlineParts,
        timestamp: Date.now(),
        skillData,
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
        const {
          researchPayload,
          researchReferenceImageUrls,
          researchWebPages,
          researchStatus,
          researchErrorMessage,
        } = await gatherWorkspaceResearchContext(text, researchMode);

        const requestMetadata = buildRequestMetadata({
          topicId: effectiveTopicId,
          isWeb,
          agentSelectionMode,
          pinnedAgentId,
          selectedRoleId,
          selectedRoleSource,
          baseAgentId,
          roleGovernanceMode,
          allowMainBrainRoleMutation,
          allowMainBrainRolePromotion,
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
          const agentInfo = getAgentInfo(result.agentId);
          const derivedImageUrls = collectDerivedImageUrlsFromTask(result);
          const agentMsg: ChatMessage = {
            id: result.id,
            role: "model",
            text: result.output.message || "Task completed.",
            timestamp: Date.now(),
            error: result.status === "failed",
            agentData: {
              model: result.agentId,
              title: agentInfo.name,
              description: agentInfo.description,
              imageUrls: Array.from(new Set(derivedImageUrls)),
              proposals: result.output.proposals,
              skillCalls: result.output.skillCalls,
              analysis: result.output.analysis,
              preGenerationMessage: result.output.preGenerationMessage,
              postGenerationSummary: result.output.postGenerationSummary,
              suggestions: result.output.adjustments || [],
              research: buildAgentResearchPayload({
                researchPayload,
                researchReferenceImageUrls,
                researchWebPages,
              }),
            },
          };
          addMessage(agentMsg);

          if (result.status === "completed") {
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
