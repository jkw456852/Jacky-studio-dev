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
  creationMode: WorkspaceSendCreationMode;
  researchMode: WorkspaceSendResearchMode;
  imageGenRatio: string;
  imageGenRes: '1K' | '2K' | '4K';
  imageGenCount: 1 | 2 | 3 | 4;
  videoGenRatio: string;
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
  creationMode: WorkspaceSendCreationMode;
  imageGenRatio: string;
  imageGenRes: '1K' | '2K' | '4K';
  imageGenCount: 1 | 2 | 3 | 4;
  videoGenRatio: string;
  translatePromptToEnglish: boolean;
  enforceChineseTextInImage: boolean;
  requiredChineseCopy: string;
  skillData?: ChatMessage["skillData"];
  canvasSelectionReferenceUrls: string[];
  researchPayload: SearchResponse | null;
  researchReferenceImageUrls: string[];
  researchWebPages: WorkspaceSendReferenceWebPage[];
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

const isTransientAttachmentPreviewUrl = (value: string | null | undefined) =>
  /^blob:/i.test(String(value || "").trim());


const buildRequestMetadata = ({
  topicId,
  isWeb,
  agentSelectionMode,
  pinnedAgentId,
  creationMode,
  imageGenRatio,
  imageGenRes,
  imageGenCount,
  videoGenRatio,
  translatePromptToEnglish,
  enforceChineseTextInImage,
  requiredChineseCopy,
  skillData,
  canvasSelectionReferenceUrls,
  researchPayload,
  researchReferenceImageUrls,
  researchWebPages,
}: BuildRequestMetadataParams): AgentTaskMetadata => {
  return {
    topicId,
    enableWebSearch: isWeb,
    agentSelectionMode,
    pinnedAgentId: agentSelectionMode === "manual" ? pinnedAgentId : undefined,
    creationMode,
    preferredAspectRatio:
      creationMode === "video" ? videoGenRatio : imageGenRatio,
    preferredImageSize: imageGenRes,
    preferredImageCount: creationMode === "image" ? imageGenCount : 1,
    promptLanguagePolicy: translatePromptToEnglish
      ? "translate-en"
      : "original-zh",
    textRenderPolicy: {
      enforceChinese: enforceChineseTextInImage,
      requiredCopy: (requiredChineseCopy || "").trim(),
    },
    skillData,
    multimodalContext: {
      referenceImageUrls: Array.from(
        new Set([
          ...canvasSelectionReferenceUrls,
          ...researchReferenceImageUrls,
        ]),
      ),
      referenceWebPages: researchWebPages,
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
    creationMode,
    researchMode,
    imageGenRatio,
    imageGenRes,
    imageGenCount,
    videoGenRatio,
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
      const allAttachmentFiles =
        overrideAttachments ??
        (currentBlocks
          .filter((block) => block.type === "file" && block.file)
          .map((block) => block.file!) as File[]);
      const attachments = allAttachmentFiles.filter(
        (file) => !(file as WorkspaceInputFile)._canvasElId,
      );
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

      const selectedIdsSnapshot =
        selectedElementIds.length > 0
          ? [...selectedElementIds]
          : selectedElementId
            ? [selectedElementId]
            : [];
      const elementsSnapshot = [...elementsRef.current];

      const effectiveConversationId = ensureConversationId();
      const effectiveTopicId = buildMemoryKey(effectiveConversationId);
      const pendingAttachments =
        useAgentStore.getState().composer.pendingAttachments || [];
      const userMessagePayload =
        overridePrompt === undefined && overrideAttachments === undefined
          ? await buildUserChatMessagePayloadFromInputBlocks({
              inputBlocks: currentBlocks,
              pendingFiles: pendingAttachments.map(
                (item) => item.file as WorkspaceInputFile,
              ),
            })
          : {
              attachments: await Promise.all(
                allAttachmentFiles.map(async (file) => {
                  const workspaceFile = file as WorkspaceInputFile;
                  if (
                    workspaceFile._chipPreviewUrl &&
                    !isTransientAttachmentPreviewUrl(workspaceFile._chipPreviewUrl)
                  ) {
                    return workspaceFile._chipPreviewUrl;
                  }
                  return createImagePreviewDataUrl(file, 512, 0.82);
                }),
              ),
              attachmentMetadata: undefined,
              inlineParts: undefined,
            };

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
        } = await gatherWorkspaceResearchContext(text, researchMode);

        const requestMetadata = buildRequestMetadata({
          topicId: effectiveTopicId,
          isWeb,
          agentSelectionMode,
          pinnedAgentId,
          creationMode,
          imageGenRatio,
          imageGenRes,
          imageGenCount,
          videoGenRatio,
          translatePromptToEnglish,
          enforceChineseTextInImage,
          requiredChineseCopy,
          skillData,
          canvasSelectionReferenceUrls,
          researchPayload,
          researchReferenceImageUrls,
          researchWebPages,
        });

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
            },
          };
          addMessage(agentMsg);
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
