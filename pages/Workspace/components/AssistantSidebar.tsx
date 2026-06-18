import React, { memo } from "react";
import {
  Archive,
  Compass,
  GitBranch,
  ImagePlus,
  Loader2,
  Square,
  Video,
} from "lucide-react";
import { useAgentStore } from "../../../stores/agent.store";
import type { BrowserAgentSessionRecord } from "../../../services/browser-agent";
import { getBrowserAgentModelLabel } from "../../../services/provider-settings";
import { buildUserChatMessagePayloadFromInputBlocks } from "../chatMessageContent";
import {
  resolveBrowserAgentSessionResultElementIds as resolveSessionResultElementIds,
  resolveBrowserAgentStepElementId as resolveStepElementId,
} from "../browserAgentResultProtocol";
import { createImagePreviewDataUrl } from "../workspaceShared";
import { useAssistantSidebarConversationUi } from "../controllers/useAssistantSidebarConversationUi";
import { useAssistantSidebarBrowserAgentUi } from "../controllers/useAssistantSidebarBrowserAgentUi";
import { useAssistantSidebarPanelUi } from "../controllers/useAssistantSidebarPanelUi";
import {
  getActiveQuickSkillPreference,
  setActiveQuickSkillPreference,
} from "../../../services/runtime-assets/preferences";
import { createInputBlockId } from "../../../stores/agent.store";
import { hasConversationDraft, isConversationArchived } from "../conversationMeta";
import { AssistantSidebarHeader } from "./AssistantSidebarHeader";
import { AssistantSidebarHistoryPanel } from "./AssistantSidebarHistoryPanel";
import { AssistantSidebarPlanCard } from "./AssistantSidebarPlanCard";
import { AssistantSidebarStatusBanner } from "./AssistantSidebarStatusBanner";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { isEcommerceWorkflowChatMessage } from "./workflow/ecommerceWorkflowUi";
import type {
  InputAreaComposerProps,
  InputAreaInputUiProps,
  InputAreaModelPreferencesProps,
} from "./InputArea";

import { ConversationSession, Marker, InputBlock } from "../../../types";
import type { ChatMessage, ChatSendOptions } from "../../../types";
import type { WorkspaceInputFile } from "../../../types";
import type {
  EcommerceImageAnalysis,
  EcommerceOverlayState,
  EcommercePlanGroup,
  EcommerceResultItem,
  EcommerceRecommendedType,
  EcommerceSupplementField,
  Requirements,
  ModelGenOptions,
} from "../../../types/workflow.types";

type PendingConversationTransition = {
  key: string;
  label: string;
  action: () => void;
};

type PendingConversationDeletion = {
  conversationId: string;
  label: string;
  isActive: boolean;
};

type PendingDeletedConversation = {
  conversation: ConversationSession;
  label: string;
  wasActive: boolean;
  timeoutId: ReturnType<typeof setTimeout>;
};

type PendingArchivedConversation = {
  conversation: ConversationSession;
  label: string;
  wasActive: boolean;
  timeoutId: ReturnType<typeof setTimeout>;
};

type EmptyConversationStarter = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  mode?: "agent" | "image" | "video";
};

const getCreationModeDisplayLabel = (
  mode: EmptyConversationStarter["mode"] | undefined,
) => {
  if (mode === "image") return "图片";
  if (mode === "video") return "视频";
  return "对话";
};

const isTransientAttachmentPreviewUrl = (value: string | null | undefined) =>
  /^blob:/i.test(String(value || "").trim());

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readStringValue = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const readStringArrayValue = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];

const EXECUTION_INTENT_PATTERN =
  /(鐢熸垚|鍒朵綔|鍒涘缓|鍑哄浘|閲嶇敾|鏀瑰浘|浼樺寲|鎵ц|杩愯|寮€濮媩缁х画|鍚屾|鎻掑叆|鏇挎崲|apply|run|generate|create|make|edit|update|redesign|render)/i;
const CHAT_QUERY_PATTERN =
  /(鏄粈涔坾骞插槢|鍋氫粈涔坾浠€涔堟剰鎬潀鎬庝箞|涓轰粈涔坾鑳戒笉鑳借В閲妡瑙ｉ噴涓€涓媩鐪嬬湅|甯垜鐪媩杩欏潡|杩欓噷|what|why|how|explain|tell me|look at)/i;
const BROWSER_SURFACE_PATTERN =
  /(缃戦〉|椤甸潰|鐢诲竷|鑺傜偣|褰撳墠鑺傜偣|杩欎釜鑺傜偣|杩欏潡|杩欓噷|鎸夐挳|寮圭獥|宸ュ叿鏍弢渚ц竟鏍弢棰勮鍥緗鍥惧眰|妯″潡|鎺т欢|canvas|node|page|toolbar|sidebar|modal|panel|preview|element)/i;
const GENERAL_WORK_PATTERN =
  /(鎻掍欢|plugin|鏅鸿兘浣搢agent\s|agent妯℃澘|prompt|鎻愮ず璇峾鑴氭湰|浠ｇ爜|鏂囨。|markdown|鏂规|绛栫暐|鍒嗘瀽|鎬荤粨|璇存槑)/i;

const DIRECT_EXECUTION_KEYWORDS = [
  "顺手",
  "直接",
  "马上",
  "现在",
  "帮我",
  "替我",
  "请你",
  "去把",
  "然后执行",
  "并执行",
];

const shouldTreatAsDirectComposerSubmit = (
  overridePrompt?: string,
  overrideAttachments?: File[],
) => overridePrompt === undefined && overrideAttachments === undefined;

const buildEmptyConversationStarters = (
  selectedElementLabel: string | null | undefined,
): EmptyConversationStarter[] => {
  const selectedSurface = String(selectedElementLabel || "").trim();
  return [
    {
      id: "audit-ui",
      title: "审视这个界面",
      description: selectedSurface
        ? `检查 ${selectedSurface}，先找出最值得优先处理的界面问题。`
        : "检查当前工作区界面，先找出最值得优先处理的问题。",
      prompt: selectedSurface
        ? `检查选中的“${selectedSurface}”。告诉我哪里还不完整、哪里容易让人困惑、哪里视觉上还不够稳，然后按优先级列出需要先改的点。`
        : "检查当前工作区界面。告诉我哪里还不完整、哪里容易让人困惑、哪里视觉上还不够稳，然后按优先级列出需要先改的点。",
      mode: "agent",
    },
    {
      id: "plan-execution",
      title: "规划下一步",
      description: "把目标拆成明确步骤、风险点和最省力的高质量路径。",
      prompt:
        "帮我把这个工作区想法整理成可执行的构建计划。拆成里程碑，指出风险，并给出最快的高质量推进方式。",
      mode: "agent",
    },
    {
      id: "image-concept",
      title: "视觉方向",
      description: "生成更干净的画面方向、概念图或产品图提示词。",
      prompt:
        "为这个项目生成一版更完整的视觉方向。给我一个明确的图像概念，并说明构图、光线、材质和风格细节。",
      mode: "image",
    },
    {
      id: "motion-concept",
      title: "运动分镜",
      description: "生成更像产品内容的短动作思路或节奏提纲。",
      prompt:
        "为这个工作区生成一版简洁的高级感分镜。重点描述节奏、镜头运动和关键视觉节点。",
      mode: "video",
    },
  ];
};

const getEmptyConversationStarterIcon = (starter: EmptyConversationStarter) => {
  if (starter.mode === "image") return ImagePlus;
  if (starter.mode === "video") return Video;
  if (starter.id === "plan-execution") return GitBranch;
  return Compass;
};

const shouldRouteSidebarMessageToBrowserAgent = ({
  text,
  hasSelectedElement,
  chatEnabled,
}: {
  text: string;
  hasSelectedElement: boolean;
  chatEnabled: boolean;
}) => {
  const normalized = String(text || "").trim();
  if (!normalized || !chatEnabled || !hasSelectedElement) return false;

  const hasExecutionIntent = EXECUTION_INTENT_PATTERN.test(normalized);
  if (!hasExecutionIntent) return false;

  const containsDirectExecutionKeyword = DIRECT_EXECUTION_KEYWORDS.some((keyword) =>
    normalized.includes(keyword),
  );
  const isPureChatQuery =
    CHAT_QUERY_PATTERN.test(normalized) && !containsDirectExecutionKeyword;
  if (isPureChatQuery) return false;

  const referencesCurrentSurface =
    BROWSER_SURFACE_PATTERN.test(normalized) ||
    /(褰撳墠|杩欎釜|杩欓噷|閫変腑|selected|褰撳墠閫変腑)/i.test(normalized);

  if (referencesCurrentSurface) return true;

  return !GENERAL_WORK_PATTERN.test(normalized);
};

const getBrowserSessionStatusLabel = (status: string | null | undefined) => {
  switch (String(status || "").trim()) {
    case "pending":
      return "\u7b49\u5f85\u4e2d";
    case "running":
      return "\u6267\u884c\u4e2d";
    case "completed":
      return "\u5df2\u5b8c\u6210";
    case "completed_with_errors":
      return "\u90e8\u5206\u5b8c\u6210";
    case "failed":
      return "\u5931\u8d25";
    case "cancelled":
      return "\u5df2\u53d6\u6d88";
    case "skipped":
      return "\u5df2\u8df3\u8fc7";
    default:
      return "\u672a\u77e5\u72b6\u6001";
  }
};

const collectStepInputSummary = (input: Record<string, unknown> | null) => {
  if (!input) return [] as string[];

  const lines: string[] = [];
  const elementId = readStringValue(input.elementId);
  const requestId = readStringValue(input.requestId);
  const controlId = readStringValue(input.controlId);
  const timeoutMs =
    typeof input.timeoutMs === "number" ? String(input.timeoutMs) : null;

  if (elementId) lines.push(`鐩爣鑺傜偣: ${elementId}`);
  if (requestId) lines.push(`璇锋眰 ID: ${requestId}`);
  if (controlId) lines.push(`鎺т欢: ${controlId}`);
  if (timeoutMs) lines.push(`瓒呮椂: ${timeoutMs}ms`);

  return lines.slice(0, 4);
};

const collectStepInputSummarySafe = (input: Record<string, unknown> | null) => {
  if (!input) return [] as string[];

  const lines: string[] = [];
  const elementId = readStringValue(input.elementId);
  const requestId = readStringValue(input.requestId);
  const controlId = readStringValue(input.controlId);
  const timeoutMs =
    typeof input.timeoutMs === "number" ? String(input.timeoutMs) : null;

  if (elementId) lines.push(`鐩爣鑺傜偣: ${elementId}`);
  if (requestId) lines.push(`璇锋眰 ID: ${requestId}`);
  if (controlId) lines.push(`鎺т欢: ${controlId}`);
  if (timeoutMs) lines.push(`瓒呮椂: ${timeoutMs}ms`);

  return lines.slice(0, 4);
};

const readLatestDiagnosisSummary = (
  metadata: BrowserAgentSessionRecord["metadata"] | null | undefined,
) => readStringValue(metadata?.latestDiagnosisSummary);

const readLatestRepairSummary = (
  metadata: BrowserAgentSessionRecord["metadata"] | null | undefined,
) => readStringValue(metadata?.latestRepairSummary);

const readLatestRepairNotes = (
  metadata: BrowserAgentSessionRecord["metadata"] | null | undefined,
) => readStringArrayValue(metadata?.latestRepairNotes);

const readLatestDiagnosisIssues = (
  metadata: BrowserAgentSessionRecord["metadata"] | null | undefined,
) => readStringArrayValue(metadata?.latestDiagnosisIssues);


type AssistantSidebarComposerProps = Omit<
  InputAreaComposerProps,
  "handleSend"
> & {
  setPrompt: (prompt: string) => void;
};

type AssistantSidebarInputUiProps = InputAreaInputUiProps;

type AssistantSidebarModelPreferenceProps = InputAreaModelPreferencesProps;

type AssistantSidebarSessionProps = {
  workspaceId: string;
  conversations: ConversationSession[];
  setConversations: React.Dispatch<React.SetStateAction<ConversationSession[]>>;
  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
};

type AssistantSidebarPanelUiProps = {
  showAssistant: boolean;
  setShowAssistant: (show: boolean) => void;
  setPreviewUrl: (url: string) => void;
  onOpenEcommerceWorkflow: () => void;
  isFullscreen?: boolean;
  setIsFullscreen?: (value: boolean) => void;
  onToggleFullscreen?: () => void;
};

type AssistantSidebarMessageActionsProps = {
  handleSend: (
    overridePrompt?: string,
    overrideAttachments?: File[],
    overrideWeb?: boolean,
    skillData?: ChatMessage["skillData"],
    sendOptions?: ChatSendOptions,
  ) => Promise<void>;
  handleSmartGenerate: (prompt: string, proposalId?: string) => void;
};

type AssistantSidebarBrowserAgentProps = {
  selectedElementId: string | null;
  selectedElementLabel: string | null;
  selectedElementType?: string | null;
  selectedTreeNodeKind?: string | null;
  resolveElementAsset?: (elementId: string) => {
    previewUrl: string | null;
    label: string | null;
  } | null;
  createTargetElement?: (input: {
    prompt?: string;
    referenceImages?: string[];
  }) => string | null;
};

type AssistantSidebarClothingActionsProps = {
  onClothingSubmitRequirements?: (data: Requirements) => void;
  onClothingGenerateModel?: (data: ModelGenOptions) => void;
  onClothingPickModelCandidate?: (url: string) => void;
  onClothingInsertToCanvas?: (url: string, label?: string) => void;
  onClothingRetryFailed?: () => void;
};

type AssistantSidebarEcommerceActionsProps = {
  onEcommerceRefineAnalysis?: (feedback: string) => Promise<void> | void;
  onEcommerceConfirmTypes?: (items: EcommerceRecommendedType[]) => void;
  onEcommerceConfirmImageAnalyses?: (items: EcommerceImageAnalysis[]) => void;
  onEcommerceRetryImageAnalysis?: (imageId: string) => void;
  onEcommerceRewritePlanPrompt?: (
    groups: EcommercePlanGroup[],
    planItemId: string,
    feedback?: string,
  ) => Promise<string | null>;
  onEcommerceGeneratePlanItem?: (
    groups: EcommercePlanGroup[],
    planItemId: string,
  ) => Promise<void>;
  onEcommerceGenerateExtraPlanItem?: (
    groups: EcommercePlanGroup[],
    typeId: string,
  ) => Promise<void>;
  onEcommerceOpenResultOverlayEditor?: (url: string) => void | Promise<void>;
  onEcommerceCloseResultOverlayEditor?: () => void | Promise<void>;
  onEcommerceSaveResultOverlayDraft?: (
    url: string,
    overlayState: EcommerceOverlayState | null,
  ) => void | Promise<void>;
  onEcommerceApplyResultOverlay?: (
    url: string,
    overlayState: EcommerceOverlayState | null,
  ) => void | Promise<void>;
  onEcommerceUploadResultOverlayFont?: (
    url: string,
    file: File,
  ) => void | Promise<void>;
  onEcommerceUploadResultOverlayIcon?: (
    url: string,
    file: File,
  ) => void | Promise<void>;
  onEcommerceResetResultOverlay?: (url: string) => void | Promise<void>;
  onEcommercePromoteResult?: (url: string) => void;
  onEcommercePromoteSelectedResults?: (urls: string[]) => void;
  onEcommerceDeleteResult?: (url: string) => void;
  onEcommerceConfirmPlans?: (groups: EcommercePlanGroup[]) => void;
  onEcommerceConfirmSupplements?: (fields: EcommerceSupplementField[]) => void;
  onEcommerceSelectModel?: (modelId: string, promptLanguage?: "zh" | "en" | "auto") => void;
  onEcommerceSyncBatchPlanItemRatio?: (
    planItemId: string,
    ratio: string,
  ) => Promise<void> | void;
  onEcommerceSyncBatchPrompt?: (
    planItemId: string,
    prompt: string,
  ) => Promise<void> | void;
  onEcommerceOpenBatchWorkbench?: () => void | Promise<void>;
  onEcommerceRunBatchGenerate?: (
    promptOverrides?: Record<string, string>,
    options?: {
      promptOnly?: boolean;
      targetPlanItemIds?: string[];
      preserveExistingResults?: boolean;
    },
  ) => void;
  onEcommerceRetryFailedBatch?: () => void;
  onEcommerceInsertToCanvas?: (result: EcommerceResultItem | string, label?: string) => void;
};

export interface AssistantSidebarProps {
  session: AssistantSidebarSessionProps;
  panelUi: AssistantSidebarPanelUiProps;
  messageActions: AssistantSidebarMessageActionsProps;
  browserAgent: AssistantSidebarBrowserAgentProps;
  composer: AssistantSidebarComposerProps;
  inputUi: AssistantSidebarInputUiProps;
  modelPreferences: AssistantSidebarModelPreferenceProps;
  markers: Marker[];
  onSaveMarkerLabel?: (markerId: string, label: string) => void;
  clothingActions?: AssistantSidebarClothingActionsProps;
  ecommerceActions?: AssistantSidebarEcommerceActionsProps;
}

export const AssistantSidebar: React.FC<AssistantSidebarProps> = memo(({
  session,
  panelUi,
  messageActions,
  browserAgent,
  composer,
  inputUi,
  modelPreferences,
  markers,
  onSaveMarkerLabel,
  clothingActions,
  ecommerceActions,
}) => {
  const lastBrowserAgentLivePayloadRef = React.useRef<Record<string, string>>({});
  const pendingDeletedConversationRef =
    React.useRef<PendingDeletedConversation | null>(null);
  const pendingArchivedConversationRef =
    React.useRef<PendingArchivedConversation | null>(null);
  const finalizeDeletedConversationRef =
    React.useRef<
      ((conversationId: string) => void) | null
    >(null);
  const {
    workspaceId,
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversationId,
  } = session;
  const {
    setShowAssistant,
    setPreviewUrl,
    onOpenEcommerceWorkflow,
    isFullscreen = false,
    setIsFullscreen = () => {},
    onToggleFullscreen,
  } = panelUi;
  const { handleSend, handleSmartGenerate } = messageActions;
  const {
    chatEnabled,
    setChatEnabled,
    suggestedGoal,
    preparedPlan,
    currentSession,
    isPlanning,
    isStarting,
    isContinuing,
    isRefreshing,
    error,
    sessionSummary,
    handleStartGoalSession,
    handleApprovePreparedPlan,
    handleCancelSession,
    handleRefreshSession,
  } = useAssistantSidebarBrowserAgentUi({
    workspaceId,
    activeConversationId,
    selectedElementId: browserAgent.selectedElementId,
    selectedElementLabel: browserAgent.selectedElementLabel,
    selectedElementType: browserAgent.selectedElementType,
    selectedTreeNodeKind: browserAgent.selectedTreeNodeKind,
    createTargetElement: browserAgent.createTargetElement,
  });
  const messages = useAgentStore((s) => s.messages);
  const isTyping = useAgentStore((s) => s.isTyping);
  const visibleMessages = React.useMemo(
    () =>
      messages.filter((message) => !isEcommerceWorkflowChatMessage(message)),
    [messages],
  );
  const activeConversation = React.useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId) ||
      null,
    [activeConversationId, conversations],
  );
  const {
    addMessage,
    cancelChatGeneration,
    updateMessage,
    setMessages,
    clearMessages,
    setIsTyping,
    setInputBlocks,
    setActiveBlockId,
    clearPendingAttachments,
  } = useAgentStore((s) => s.actions);
  const currentInputBlocks = useAgentStore((s) => s.composer.inputBlocks);
  const currentTask = useAgentStore((s) => s.currentTask);
  const {
    currentTaskLabel,
    showHistoryPopover,
    historySearch,
    showFileListModal,
    setHistorySearch,
    toggleHistoryPopover,
    closeHistoryPopover,
    toggleFileListModal,
  } = useAssistantSidebarPanelUi({
    activeConversation,
    currentTaskConversationId:
      String(currentTask?.input?.context?.conversationId || "").trim() || null,
    currentTaskVisible:
      String(currentTask?.input?.context?.conversationId || "").trim() ===
        String(activeConversationId || "").trim() ||
      (isTyping &&
        !String(currentTask?.input?.context?.conversationId || "").trim()),
    isTyping,
    isBrowserConversationBusy: Boolean(
      preparedPlan ||
        isPlanning ||
        isStarting ||
        isContinuing ||
        isRefreshing ||
        sessionSummary.isRunning,
    ),
    browserStepTitle: sessionSummary.currentStepTitle,
  });
  const {
    handleCreateConversation,
    handleSelectConversation,
    handleDeleteConversation,
    finalizeDeletedConversation,
    restoreConversationSnapshot,
    handleRenameConversation,
    handleToggleConversationPinned,
    handleToggleConversationArchived,
    handleBranchConversationFromMessage,
    activeConversationTitle,
  } = useAssistantSidebarConversationUi({
    workspaceId,
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversationId,
    messages,
    clearMessages,
    setMessages,
    creationMode: composer.creationMode,
    setCreationMode: composer.setCreationMode,
    currentInputBlocks,
    setInputBlocks,
    setActiveBlockId,
    clearPendingAttachments,
    getActiveQuickSkill: () => getActiveQuickSkillPreference() || undefined,
    setActiveQuickSkill: (skill) => {
      setActiveQuickSkillPreference(skill || null);
    },
    closeHistoryPopover,
  });
  const [pendingConversationTransition, setPendingConversationTransition] =
    React.useState<PendingConversationTransition | null>(null);
  const [isStoppingForConversationTransition, setIsStoppingForConversationTransition] =
    React.useState(false);
  const [pendingConversationDeletion, setPendingConversationDeletion] =
    React.useState<PendingConversationDeletion | null>(null);
  const [pendingDeletedConversation, setPendingDeletedConversation] =
    React.useState<PendingDeletedConversation | null>(null);
  const [pendingArchivedConversation, setPendingArchivedConversation] =
    React.useState<PendingArchivedConversation | null>(null);
  const [pendingRestoreComposerState, setPendingRestoreComposerState] =
    React.useState<{
      conversationId: string;
      prompt: string;
      blockId: string;
    } | null>(null);

  const clearPendingDeletedConversation = React.useCallback(() => {
    setPendingDeletedConversation((previous) => {
      if (previous?.timeoutId) {
        clearTimeout(previous.timeoutId);
      }
      return null;
    });
  }, []);
  const clearPendingArchivedConversation = React.useCallback(() => {
    setPendingArchivedConversation((previous) => {
      if (previous?.timeoutId) {
        clearTimeout(previous.timeoutId);
      }
      return null;
    });
  }, []);

  const browserAgentModelLabel =
    sessionSummary.plannerLabel || getBrowserAgentModelLabel();
  const buildUserAttachmentPayload = React.useCallback(async (files: File[]) => {
    const normalizedFiles = Array.isArray(files) ? files : [];
    return {
      attachments: await Promise.all(
        normalizedFiles.map(async (file) => {
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
      attachmentMetadata: normalizedFiles.map((file) => {
        const workspaceFile = file as WorkspaceInputFile;
        return workspaceFile.markerInfo
          ? {
              markerName: workspaceFile.markerName,
              markerInfo: workspaceFile.markerInfo,
            }
          : workspaceFile.markerName
            ? {
                markerName: workspaceFile.markerName,
              }
            : undefined;
      }),
      inlineParts: undefined,
    };
  }, []);
  const restoreMessageToComposer = React.useCallback(
    async (message: ChatMessage) => {
      const inlineParts = Array.isArray(message.inlineParts)
        ? message.inlineParts
        : [];
      const fallbackAttachmentParts =
        inlineParts.length === 0 && Array.isArray(message.attachments)
          ? message.attachments.map((url, index) => ({
              type: "attachment" as const,
              url,
              label:
                String(message.attachmentMetadata?.[index]?.markerName || "").trim() ||
                `鍙傝€冨唴瀹?{index + 1}`,
              markerInfo: message.attachmentMetadata?.[index]?.markerInfo,
            }))
          : [];
      const sourceParts =
        inlineParts.length > 0
          ? inlineParts
          : [
              ...(String(message.text || "")
                ? [{ type: "text" as const, text: String(message.text || "") }]
                : []),
              ...fallbackAttachmentParts,
            ];

      const buildFileName = (label: string, mimeType?: string) => {
        const normalizedLabel = String(label || "").trim() || "参考内容";
        const safeBase =
          normalizedLabel.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 48) || "reference";
        const extension = mimeType?.includes("jpeg") || mimeType?.includes("jpg")
          ? ".jpg"
          : mimeType?.includes("webp")
            ? ".webp"
            : mimeType?.includes("gif")
              ? ".gif"
              : ".png";
        return safeBase.endsWith(extension) ? safeBase : `${safeBase}${extension}`;
      };

      const nextBlocks: InputBlock[] = [];
      let nextActiveBlockId: string | null = null;

      for (const part of sourceParts) {
        if (part.type === "text") {
          if (!String(part.text || "").length) continue;
          const blockId = createInputBlockId("text");
          nextBlocks.push({
            id: blockId,
            type: "text",
            text: String(part.text || ""),
          });
          nextActiveBlockId = blockId;
          continue;
        }

        try {
          const response = await fetch(part.url);
          if (!response.ok) {
            throw new Error(`Failed to restore attachment: ${response.status}`);
          }
          const blob = await response.blob();
          if (!blob.size) continue;

          const file = new File(
            [blob],
            buildFileName(part.label, blob.type),
            {
              type: blob.type || "image/png",
              lastModified: Date.now(),
            },
          ) as WorkspaceInputFile;
          file._chipPreviewUrl = part.url;
          if (part.markerInfo) {
            file.markerName = String(part.label || "").trim() || "鍖哄煙";
            file.markerInfo = part.markerInfo;
          }

          nextBlocks.push({
            id: createInputBlockId("file"),
            type: "file",
            file,
          });
        } catch (error) {
          console.warn("[assistant-sidebar] restore message attachment failed", error);
        }
      }

      if (nextBlocks.length === 0) {
        const textId = createInputBlockId("text");
        nextBlocks.push({
          id: textId,
          type: "text",
          text: String(message.text || ""),
        });
        nextActiveBlockId = textId;
      } else if (nextBlocks[nextBlocks.length - 1]?.type !== "text") {
        const trailingTextId = createInputBlockId("text");
        nextBlocks.push({
          id: trailingTextId,
          type: "text",
          text: "",
        });
        nextActiveBlockId = trailingTextId;
      }

      clearPendingAttachments();
      setInputBlocks(nextBlocks);
      if (nextActiveBlockId) {
        setActiveBlockId(nextActiveBlockId);
      }
      console.log("[assistant-sidebar] restoreMessageToComposer", {
        messageId: message.id,
        role: message.role,
        blockCount: nextBlocks.length,
        textPreview: nextBlocks
          .filter((block) => block.type === "text")
          .map((block) => String(block.text || ""))
          .join(" ")
          .slice(0, 160),
      });
      setIsTyping(false);
    },
    [clearPendingAttachments, setActiveBlockId, setInputBlocks, setIsTyping],
  );
  const buildResendPayloadFromMessage = React.useCallback(
    async (message: ChatMessage) => {
      const inlineParts = Array.isArray(message.inlineParts)
        ? message.inlineParts
        : [];
      const attachmentParts =
        inlineParts.length > 0
          ? inlineParts.filter(
              (
                part,
              ): part is Extract<
                NonNullable<ChatMessage["inlineParts"]>[number],
                { type: "attachment" }
              > => part.type === "attachment",
            )
          : (Array.isArray(message.attachments)
              ? message.attachments.map((url, index) => ({
                  type: "attachment" as const,
                  url,
                  label:
                    String(message.attachmentMetadata?.[index]?.markerName || "").trim() ||
                    `Reference ${index + 1}`,
                  markerInfo: message.attachmentMetadata?.[index]?.markerInfo,
                }))
              : []);

      const restoredFiles: WorkspaceInputFile[] = [];
      for (const part of attachmentParts) {
        try {
          const response = await fetch(part.url);
          if (!response.ok) {
            throw new Error(`Failed to restore attachment: ${response.status}`);
          }
          const blob = await response.blob();
          if (!blob.size) continue;

          const safeBase =
            (String(part.label || "").trim() || "reference")
              .replace(/[\\/:*?"<>|]+/g, "-")
              .slice(0, 48) || "reference";
          const extension = blob.type.includes("jpeg") || blob.type.includes("jpg")
            ? ".jpg"
            : blob.type.includes("webp")
              ? ".webp"
              : blob.type.includes("gif")
                ? ".gif"
                : ".png";
          const file = new File([blob], `${safeBase}${extension}`, {
            type: blob.type || "image/png",
            lastModified: Date.now(),
          }) as WorkspaceInputFile;
          file._chipPreviewUrl = part.url;
          if (part.markerInfo) {
            file.markerName = String(part.label || "").trim() || "鍖哄煙";
            file.markerInfo = part.markerInfo;
          }
          restoredFiles.push(file);
        } catch (error) {
          console.warn("[assistant-sidebar] rebuild resend attachment failed", error);
        }
      }

      return {
        text: String(message.text || ""),
        attachments: restoredFiles,
        skillData: message.skillData,
      };
    },
    [],
  );
  const readLatestObservationFromSession = React.useCallback(
    (session: typeof currentSession) => {
      const steps = session?.steps || [];
      for (let index = steps.length - 1; index >= 0; index -= 1) {
        const step = steps[index];
        if (step.status !== "completed") continue;
        if (step.toolId !== "workspace.observe_generation_target") continue;

        const wrapper = step.result as
          | {
              result?: {
                summary?: string;
                suggestions?: string[];
                payload?: {
                  recommendedNextActions?: Array<{
                    id?: string;
                    reason?: string;
                  }>;
                };
              };
            }
          | null;
        const observation = wrapper?.result;
        if (!observation) continue;

        const summary = String(observation.summary || "").trim() || null;
        const suggestions = Array.isArray(observation.suggestions)
          ? observation.suggestions
              .map((item) => String(item || "").trim())
              .filter(Boolean)
          : [];
        const nextAction =
          observation.payload?.recommendedNextActions?.find(
            (item) => String(item?.id || "").trim(),
          ) || null;

        return {
          summary,
          suggestions,
          nextAction: nextAction
            ? {
                id: String(nextAction.id || "").trim(),
                reason: String(nextAction.reason || "").trim() || null,
              }
            : null,
        };
      }

      return null;
    },
    [currentSession],
  );
  const buildBrowserAgentStepView = React.useCallback(
    (step: BrowserAgentSessionRecord["steps"][number], session: BrowserAgentSessionRecord) => {
      const resultRecord = isRecord(step.result) ? step.result : null;
      const toolResult = isRecord(resultRecord?.result) ? resultRecord.result : null;
      const payload = isRecord(toolResult?.payload) ? toolResult.payload : null;
      const report = isRecord(resultRecord?.report) ? resultRecord.report : null;
      const actionLabel =
        step.kind === "tool"
          ? String(step.toolId || "").trim() || undefined
          : String(step.actionId || "").trim() || undefined;
      const inputSummary = collectStepInputSummary(step.resolvedInput);
      const resultSummary: string[] = [];

      const pushLine = (value: string | null | undefined) => {
        const normalized = String(value || "").trim();
        if (normalized) resultSummary.push(normalized);
      };

      if (step.status === "failed" && step.error) {
        pushLine(step.error);
      } else if (actionLabel === "workspace.observe_generation_target") {
        pushLine(
          readStringValue(toolResult?.summary) ||
            "已读取目标节点观察结果。",
        );
        const traceStatus = readStringValue(payload?.traceStatus);
        const traceModel = readStringValue(payload?.traceModel);
        const previewImageCount =
          typeof payload?.previewImageCount === "number"
            ? payload.previewImageCount
            : null;
        const variantSummary = isRecord(payload?.variantSummary)
          ? payload.variantSummary
          : null;
        if (traceStatus) pushLine(`Trace 鐘舵€? ${traceStatus}`);
        if (traceModel) pushLine(`鐢熷浘妯″瀷: ${traceModel}`);
        if (previewImageCount !== null) {
          pushLine(`鑺傜偣棰勮鏁? ${previewImageCount}`);
        }
        if (
          variantSummary &&
          typeof variantSummary.total === "number" &&
          typeof variantSummary.succeeded === "number"
        ) {
          pushLine(
            `鍙樹綋缁撴灉: ${variantSummary.succeeded}/${variantSummary.total} 鎴愬姛`,
          );
        }
      } else if (actionLabel === "workspace.await_generation_completion") {
        pushLine(
          readStringValue(toolResult?.summary) ||
            "已等待生成流程结束。",
        );
        const status = readStringValue(payload?.status);
        const elapsedMs =
          typeof payload?.elapsedMs === "number" ? payload.elapsedMs : null;
        const lastError = readStringValue(payload?.lastError);
        const variantSummary = isRecord(payload?.variantSummary)
          ? payload.variantSummary
          : null;
        if (status) pushLine(`鐢熸垚鐘舵€? ${status}`);
        if (elapsedMs !== null) pushLine(`鑰楁椂: ${elapsedMs}ms`);
        if (
          variantSummary &&
          typeof variantSummary.total === "number" &&
          typeof variantSummary.succeeded === "number"
        ) {
          pushLine(
            `鍙樹綋缁撴灉: ${variantSummary.succeeded}/${variantSummary.total} 鎴愬姛`,
          );
        }
        if (lastError) pushLine(`閿欒: ${lastError}`);
      } else if (actionLabel === "workspace.read_element_controls") {
        const controls = Array.isArray(report?.controls)
          ? (report.controls as Array<Record<string, unknown>>)
          : [];
        pushLine(`读取到 ${controls.length} 个控件。`);
        const importantControlIds = [
          "genModel",
          "genAspectRatio",
          "genResolution",
          "genImageCount",
          "genImageQuality",
        ];
        controls
          .filter((control) => importantControlIds.includes(String(control?.id || "")))
          .slice(0, 4)
          .forEach((control) => {
            pushLine(
              `${String(
                control?.title || control?.id || "鎺т欢",
              )}: ${String(control?.currentValue ?? "")}`,
            );
          });
      } else if (actionLabel === "workspace.read_element_capabilities") {
        const actions = Array.isArray(report?.actions)
          ? (report.actions as Array<Record<string, unknown>>)
          : [];
        const tools = Array.isArray(report?.tools)
          ? (report.tools as Array<Record<string, unknown>>)
          : [];
        pushLine(
          `能力检查完成。动作 ${actions.length} 个，工具 ${tools.length} 个。`,
        );
        if (typeof report?.isGenerating === "boolean") {
          pushLine(
            `鏄惁姝ｅ湪鐢熸垚: ${
              report.isGenerating ? "是" : "否"
            }`,
          );
        }
      } else if (actionLabel === "workspace.generate_image") {
        if (typeof resultRecord?.accepted === "boolean") {
          pushLine(
            resultRecord.accepted
              ? "已发起生成请求。"
              : "生成请求未被接受。",
          );
        }
        const requestId = readStringValue(resultRecord?.requestId);
        const traceStatus = readStringValue(resultRecord?.traceStatus);
        if (requestId) pushLine(`璇锋眰 ID: ${requestId}`);
        if (traceStatus) pushLine(`Trace 鐘舵€? ${traceStatus}`);
      } else if (readStringValue(toolResult?.summary)) {
        pushLine(readStringValue(toolResult?.summary));
      } else if (step.status === "completed") {
        pushLine("步骤已完成。");
      }

      const elementId = resolveStepElementId(step, session);
      const asset = elementId ? browserAgent.resolveElementAsset?.(elementId) : null;
      const shouldShowMedia =
        Boolean(asset?.previewUrl) &&
        (actionLabel === "workspace.observe_generation_target" ||
          actionLabel === "workspace.await_generation_completion" ||
          actionLabel === "workspace.open_preview");

      return {
        id: step.id,
        title: step.title,
        status: step.status,
        statusLabel: getBrowserSessionStatusLabel(step.status),
        kind: step.kind,
        actionLabel,
        summary:
          step.status === "running"
            ? "正在执行这一步。"
            : resultSummary[0] ||
              step.summary ||
              (step.error ? step.error : undefined),
        error: step.error,
        inputSummary,
        resultSummary: resultSummary.slice(1),
        media:
          shouldShowMedia && asset?.previewUrl
            ? [
                {
                  url: asset.previewUrl,
                  title:
                    actionLabel === "workspace.await_generation_completion"
                      ? "本步生成结果"
                      : "当前节点预览",
                  subtitle: asset.label,
                },
              ]
            : [],
      };
    },
    [browserAgent.resolveElementAsset],
  );
  const buildBrowserAgentStepViewSafe = React.useCallback(
    (
      step: BrowserAgentSessionRecord["steps"][number],
      session: BrowserAgentSessionRecord,
    ) => {
      const resultRecord = isRecord(step.result) ? step.result : null;
      const toolResult = isRecord(resultRecord?.result)
        ? resultRecord.result
        : null;
      const payload = isRecord(toolResult?.payload) ? toolResult.payload : null;
      const report = isRecord(resultRecord?.report) ? resultRecord.report : null;
      const actionLabel =
        step.kind === "tool"
          ? String(step.toolId || "").trim() || undefined
          : String(step.actionId || "").trim() || undefined;
      const inputSummary = collectStepInputSummarySafe(step.resolvedInput);
      const resultSummary: string[] = [];

      const pushLine = (value: string | null | undefined) => {
        const normalized = String(value || "").trim();
        if (normalized) resultSummary.push(normalized);
      };

      if (step.status === "failed" && step.error) {
        pushLine(step.error);
      } else if (actionLabel === "workspace.observe_generation_target") {
        pushLine(
          readStringValue(toolResult?.summary) || "已读取当前节点的生成观察结果。",
        );
        const traceStatus = readStringValue(payload?.traceStatus);
        const traceModel = readStringValue(payload?.traceModel);
        const previewImageCount =
          typeof payload?.previewImageCount === "number"
            ? payload.previewImageCount
            : null;
        const variantSummary = isRecord(payload?.variantSummary)
          ? payload.variantSummary
          : null;
        if (traceStatus) pushLine(`Trace 鐘舵€? ${traceStatus}`);
        if (traceModel) pushLine(`鐢熷浘妯″瀷: ${traceModel}`);
        if (previewImageCount !== null) {
          pushLine(`鑺傜偣棰勮鏁? ${previewImageCount}`);
        }
        if (
          variantSummary &&
          typeof variantSummary.total === "number" &&
          typeof variantSummary.succeeded === "number"
        ) {
          pushLine(
            `鍙樹綋缁撴灉: ${variantSummary.succeeded}/${variantSummary.total} 鎴愬姛`,
          );
        }
      } else if (actionLabel === "workspace.await_generation_completion") {
        pushLine(
          readStringValue(toolResult?.summary) || "已等待当前生成流程结束。",
        );
        const status = readStringValue(payload?.status);
        const elapsedMs =
          typeof payload?.elapsedMs === "number" ? payload.elapsedMs : null;
        const lastError = readStringValue(payload?.lastError);
        const variantSummary = isRecord(payload?.variantSummary)
          ? payload.variantSummary
          : null;
        if (status) pushLine(`鐢熸垚鐘舵€? ${status}`);
        if (elapsedMs !== null) pushLine(`鑰楁椂: ${elapsedMs}ms`);
        if (
          variantSummary &&
          typeof variantSummary.total === "number" &&
          typeof variantSummary.succeeded === "number"
        ) {
          pushLine(
            `鍙樹綋缁撴灉: ${variantSummary.succeeded}/${variantSummary.total} 鎴愬姛`,
          );
        }
        if (lastError) pushLine(`閿欒: ${lastError}`);
      } else if (actionLabel === "workspace.read_element_controls") {
        const controls = Array.isArray(report?.controls)
          ? (report.controls as Array<Record<string, unknown>>)
          : [];
        pushLine(`已读取 ${controls.length} 个控件。`);
        const importantControlIds = [
          "genModel",
          "genAspectRatio",
          "genResolution",
          "genImageCount",
          "genImageQuality",
        ];
        controls
          .filter((control) =>
            importantControlIds.includes(String(control?.id || "")),
          )
          .slice(0, 4)
          .forEach((control) => {
            pushLine(
              `${String(control?.title || control?.id || "鎺т欢")}: ${String(
                control?.currentValue ?? "",
              )}`,
            );
          });
      } else if (actionLabel === "workspace.read_element_capabilities") {
        const actions = Array.isArray(report?.actions)
          ? (report.actions as Array<Record<string, unknown>>)
          : [];
        const tools = Array.isArray(report?.tools)
          ? (report.tools as Array<Record<string, unknown>>)
          : [];
        pushLine(
          `能力检查完成。动作 ${actions.length} 个，工具 ${tools.length} 个。`,
        );
        if (typeof report?.isGenerating === "boolean") {
          pushLine(`是否正在生成: ${report.isGenerating ? "是" : "否"}`);
        }
      } else if (actionLabel === "workspace.generate_image") {
        if (typeof resultRecord?.accepted === "boolean") {
          pushLine(
            resultRecord.accepted
              ? "已发起生成请求。"
              : "生成请求未被接受。",
          );
        }
        const requestId = readStringValue(resultRecord?.requestId);
        const traceStatus = readStringValue(resultRecord?.traceStatus);
        if (requestId) pushLine(`璇锋眰 ID: ${requestId}`);
        if (traceStatus) pushLine(`Trace 鐘舵€? ${traceStatus}`);
      } else if (actionLabel === "workspace.diagnose_generation_trace") {
        pushLine(
          readStringValue(toolResult?.summary) || "已完成一轮运行时诊断。",
        );
        readStringArrayValue(toolResult?.issues)
          .slice(0, 3)
          .forEach((issue) => pushLine(`璇婃柇闂: ${issue}`));
      } else if (actionLabel === "browser.invoke_host_action") {
        const nestedActionId = readStringValue(toolResult?.actionId);
        if (nestedActionId === "workspace.repair_generation_state") {
          const nestedResult = isRecord(toolResult?.result)
            ? toolResult.result
            : null;
          const repairedFields = readStringArrayValue(
            nestedResult?.repairedFields,
          );
          const notes = readStringArrayValue(nestedResult?.notes);
          pushLine(
            nestedResult?.accepted === false
              ? readStringValue(nestedResult?.reason) ||
                  "已尝试修复节点状态，但没有成功。"
              : repairedFields.length > 0
                ? `已补写字段: ${repairedFields.join("、")}`
                : "已执行节点修复检查。",
          );
          notes.slice(0, 3).forEach((note) => pushLine(`淇璇存槑: ${note}`));
        } else if (readStringValue(toolResult?.summary)) {
          pushLine(readStringValue(toolResult?.summary));
        }
      } else if (readStringValue(toolResult?.summary)) {
        pushLine(readStringValue(toolResult?.summary));
      } else if (step.status === "completed") {
        pushLine("这一步已完成。");
      }

      const elementId = resolveStepElementId(step, session);
      const asset = elementId
        ? browserAgent.resolveElementAsset?.(elementId)
        : null;
      const shouldShowMedia =
        Boolean(asset?.previewUrl) &&
        (actionLabel === "workspace.observe_generation_target" ||
          actionLabel === "workspace.await_generation_completion" ||
          actionLabel === "workspace.open_preview");

      return {
        id: step.id,
        title: step.title,
        status: step.status,
        statusLabel: getBrowserSessionStatusLabel(step.status),
        kind: step.kind,
        actionLabel,
        summary:
          step.status === "running"
            ? "正在执行这一步。"
            : resultSummary[0] ||
              step.summary ||
              (step.error ? step.error : undefined),
        error: step.error,
        inputSummary,
        resultSummary: resultSummary.slice(1),
        media:
          shouldShowMedia && asset?.previewUrl
            ? [
                {
                  url: asset.previewUrl,
                  title:
                    actionLabel === "workspace.await_generation_completion"
                      ? "鏈鐢熸垚缁撴灉"
                      : "褰撳墠鑺傜偣棰勮",
                  subtitle: asset.label,
                },
              ]
            : [],
      };
    },
    [browserAgent.resolveElementAsset],
  );
  const buildBrowserAgentSessionView = React.useCallback(
    (session: BrowserAgentSessionRecord | null) => {
      if (!session) return undefined;

      const steps = session.steps || [];
      const diagnosisSummary = readLatestDiagnosisSummary(session.metadata);
      const repairSummary = readLatestRepairSummary(session.metadata);
      const repairNotes = readLatestRepairNotes(session.metadata);
      const diagnosisIssues = readLatestDiagnosisIssues(session.metadata);
      const resultElementIds = resolveSessionResultElementIds(session);
      const targetElementId = resultElementIds[0] || null;
      const targetAsset = targetElementId
        ? browserAgent.resolveElementAsset?.(targetElementId)
        : null;

      return {
        sessionId: session.id,
        status: session.status,
        statusLabel: getBrowserSessionStatusLabel(session.status),
        title: session.title,
        summary: String(session.description || "").trim() || undefined,
        diagnosisSummary,
        repairSummary,
        repairNotes,
        diagnosisIssues,
        currentStepTitle: session.currentStepId
          ? steps.find((step) => step.id === session.currentStepId)?.title || null
          : null,
        targetElementId,
        targetElementLabel:
          targetAsset?.label || sessionSummary.selectedElementLabel || null,
        stepStats: {
          total: steps.length,
          completed: steps.filter((step) => step.status === "completed").length,
          failed: steps.filter((step) => step.status === "failed").length,
          running: steps.filter((step) => step.status === "running").length,
          pending: steps.filter((step) => step.status === "pending").length,
        },
        steps: steps.map((step) => buildBrowserAgentStepViewSafe(step, session)),
      };
    },
    [
      browserAgent.resolveElementAsset,
      buildBrowserAgentStepViewSafe,
      sessionSummary.selectedElementLabel,
    ],
  );
  const buildBrowserAgentMessagePayload = React.useCallback(
    (session: typeof currentSession) => {
      const status = String(session?.status || "").trim();
      const finalSummary = String(session?.metadata?.finalSummary || "").trim();
      const diagnosisSummary = readLatestDiagnosisSummary(session?.metadata);
      const repairSummary = readLatestRepairSummary(session?.metadata);
      const diagnosisIssues = readLatestDiagnosisIssues(session?.metadata);
      const continuationStatus = String(
        session?.metadata?.continuationStatus || "",
      ).trim();
      const steps = session?.steps || [];
      const totalSteps = steps.length;
      const completedSteps = steps.filter(
        (step) => step.status === "completed",
      ).length;
      const failedSteps = steps.filter((step) => step.status === "failed").length;
      const currentStep = steps.find(
        (step) => step.id === session?.currentStepId,
      );
      const resultElementIds = resolveSessionResultElementIds(session || null);
      const targetElementId = resultElementIds[0] || null;
      const targetAsset = targetElementId
        ? browserAgent.resolveElementAsset?.(targetElementId)
        : null;
      const targetPreviewUrl = readStringValue(targetAsset?.previewUrl);
      const rationaleSummary = String(sessionSummary.rationaleSummary || "").trim();
      const latestObservation = readLatestObservationFromSession(session);
      const text =
        status === "completed"
          ? failedSteps > 0
            ? "\u8fd9\u4e00\u8f6e\u5df2\u7ecf\u6267\u884c\u5b8c\u4e86\uff0c\u4f46\u8fd8\u6709\u51e0\u6b65\u6ca1\u6709\u6210\u529f\u3002"
            : continuationStatus === "done" && finalSummary
              ? finalSummary
              : "\u8fd9\u4e00\u8f6e\u5df2\u7ecf\u5904\u7406\u5b8c\u6210\u3002"
          : status === "completed_with_errors"
            ? "\u8fd9\u4e00\u8f6e\u5df2\u7ecf\u6267\u884c\u5b8c\u4e86\uff0c\u4f46\u8fd8\u6709\u51e0\u6b65\u6ca1\u6709\u6210\u529f\u3002"
            : status === "failed"
              ? currentStep
                ? `${currentStep.title} \u8fd9\u4e00\u6b65\u6ca1\u6709\u8dd1\u901a\u3002`
                : "\u8fd9\u4e00\u8f6e\u6ca1\u6709\u987a\u5229\u8dd1\u901a\u3002"
              : status === "cancelled"
                ? "\u8fd9\u4e00\u8f6e\u5148\u505c\u5728\u8fd9\u91cc\u3002"
                : currentStep?.title || "\u6211\u5148\u68c0\u67e5\u5f53\u524d\u8282\u70b9\u548c\u53ef\u7528\u5de5\u5177\u3002";
      const descriptionLines = [
        finalSummary && finalSummary !== text ? `鎬荤粨: ${finalSummary}` : null,
        diagnosisSummary ? `璇婃柇: ${diagnosisSummary}` : null,
        repairSummary ? `淇: ${repairSummary}` : null,
        diagnosisIssues[0] ? `闂: ${diagnosisIssues[0]}` : null,
        latestObservation?.summary ? `瑙傚療: ${latestObservation.summary}` : null,
        latestObservation?.nextAction?.id
          ? `涓嬩竴姝? ${latestObservation.nextAction.id}${
              latestObservation.nextAction.reason
                ? ` (${latestObservation.nextAction.reason})`
                : ""
            }`
          : null,
        latestObservation?.suggestions?.[0]
          ? `鎻愮ず: ${latestObservation.suggestions[0]}`
          : null,
        rationaleSummary ? `\u601d\u8def: ${rationaleSummary}` : null,
        totalSteps > 0
          ? status === "pending" || status === "running"
            ? `\u5df2\u5b8c\u6210 ${completedSteps}/${totalSteps} \u6b65`
            : `\u672c\u8f6e\u5b8c\u6210 ${completedSteps}/${totalSteps} \u6b65`
          : null,
        failedSteps > 0 ? `\u8fd8\u6709 ${failedSteps} \u6b65\u672a\u6210\u529f` : null,
        session?.lastError ? `\u62a5\u9519: ${session.lastError}` : null,
      ].filter(Boolean);

      return {
        text,
        agentData: {
          model: browserAgentModelLabel,
          title: "\u5904\u7406\u8bb0\u5f55",
          description: descriptionLines.join("\n") || undefined,
          imageUrls: targetPreviewUrl ? [targetPreviewUrl] : undefined,
          isGenerating: status === "pending" || status === "running",
          presentation: {
            kind: "execution_record" as const,
            statusLabel: getBrowserSessionStatusLabel(status),
            detailTitle: "鏌ョ湅鎵ц璁板綍",
          },
          browserSession: buildBrowserAgentSessionView(session || null),
        },
        error: status === "failed",
      };
    },
    [
      browserAgentModelLabel,
      buildBrowserAgentSessionView,
      currentSession,
      readLatestObservationFromSession,
      sessionSummary.rationaleSummary,
    ],
  );

  const handleSidebarSend = React.useCallback(
    async (
      overridePrompt?: string,
      overrideAttachments?: File[],
      overrideWeb?: boolean,
      skillData?: ChatMessage["skillData"],
      sendOptions?: ChatSendOptions,
    ) => {
      if (activeConversation?.archivedAt) {
        return;
      }
      const currentBlocks = useAgentStore.getState().composer.inputBlocks;
      const currentBlockText = currentBlocks
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join(" ")
        .trim();
      const currentBlockAttachments = currentBlocks
        .filter((block) => block.type === "file" && block.file)
        .map((block) => block.file!);
      const pendingAttachmentFiles = (
        useAgentStore.getState().composer.pendingAttachments || []
      ).map((item) => item.file);
      const text = String(overridePrompt ?? currentBlockText ?? "").trim();
      const effectiveAttachments =
        overrideAttachments && overrideAttachments.length > 0
          ? overrideAttachments
          : [...currentBlockAttachments, ...pendingAttachmentFiles];
      const userAttachmentPayload =
        currentBlocks.length > 0 || pendingAttachmentFiles.length > 0
          ? await buildUserChatMessagePayloadFromInputBlocks({
              inputBlocks: currentBlocks,
              pendingFiles: pendingAttachmentFiles as WorkspaceInputFile[],
            })
          : effectiveAttachments.length > 0
            ? await buildUserAttachmentPayload(effectiveAttachments)
            : {
                attachments: undefined,
                attachmentMetadata: undefined,
                inlineParts: undefined,
              };
      const autonomousChatSkill: ChatMessage["skillData"] = {
        id: "autonomous-main-brain",
        name: "鑷富 Agent 璺敱",
        iconName: "Sparkles",
        config: {
          allowAutonomousRouting: true,
          mode: "unified-sidebar-agent",
        },
      };
      const normalizedSkillData = shouldTreatAsDirectComposerSubmit(
        overridePrompt,
        overrideAttachments,
      )
        ? undefined
        : skillData;
      const shouldUseBrowserAgentChat =
        chatEnabled &&
        !normalizedSkillData &&
        shouldRouteSidebarMessageToBrowserAgent({
          text,
          hasSelectedElement: Boolean(browserAgent.selectedElementId),
          chatEnabled,
        });

      if (!shouldUseBrowserAgentChat) {
        return handleSend(
          overridePrompt,
          overrideAttachments,
          overrideWeb,
          normalizedSkillData || autonomousChatSkill,
          sendOptions,
        );
      }

      if (!text) return;

      const now = Date.now();
      addMessage({
        id: `browser-agent-user-${now}`,
        role: "user",
        text,
        timestamp: now,
        attachments: userAttachmentPayload.attachments,
        attachmentMetadata: userAttachmentPayload.attachmentMetadata,
        inlineParts: userAttachmentPayload.inlineParts,
      });
      setIsTyping(true);
      setInputBlocks([{ id: `text-${now}`, type: "text", text: "" }]);
      clearPendingAttachments();

      try {
        const result = await handleStartGoalSession({
          goal: text,
          attachments: effectiveAttachments,
          skillData: autonomousChatSkill,
        });
        const plan = result?.plan || null;
        if (!plan) {
          addMessage({
            id: `browser-agent-chat-error-${Date.now()}`,
            role: "model",
            text: "执行会话没有成功建立，请查看上方状态提示或控制台日志。",
            timestamp: Date.now(),
            error: true,
          });
          return;
        }
        addMessage({
          id: `browser-agent-plan-ready-${Date.now()}`,
          role: "model",
          text:
            plan.done || plan.steps.length === 0
              ? "我先把这次思考过程整理好了。按现在的信息，暂时不需要继续执行。"
              : "我先把这次思考过程和执行路径整理好了。你确认后，我再开始。",
          agentData: {
            model: browserAgentModelLabel,
            title: "我准备这样做",
            description:
              plan.rationaleSummary ||
              plan.description ||
              "开始前我会先把真实的检查思路、目标判断和执行路径说明白，再决定是否继续。",
            isGenerating: false,
            presentation: {
              kind: "execution_plan" as const,
              statusLabel:
                plan.done || plan.steps.length === 0 ? "无需执行" : "待你确认",
              detailTitle: "查看思考过程",
              detailNotice:
                plan.done || plan.steps.length === 0
                  ? "这里展示的是当前真实思考过程；按现在的信息，这一轮暂时不需要继续执行。"
                  : "这里展示的是当前真实思考过程与执行路径，确认后我再继续。",
            },
          },
          timestamp: Date.now(),
        });
      } catch (error) {
        addMessage({
          id: `browser-agent-chat-error-${Date.now()}`,
          role: "model",
          text:
            error instanceof Error
              ? `杩欎竴姝ユ病鑳藉紑濮嬶細${error.message}`
              : `杩欎竴姝ユ病鑳藉紑濮嬶細${String(error || "鏈煡閿欒")}`,
          timestamp: Date.now(),
          error: true,
        });
      } finally {
        setIsTyping(false);
      }
    },
    [
      addMessage,
      activeConversation?.archivedAt,
      browserAgent.selectedElementId,
      browserAgentModelLabel,
      handleSend,
      chatEnabled,
      clearPendingAttachments,
      composer.creationMode,
      buildBrowserAgentMessagePayload,
      buildUserAttachmentPayload,
      handleStartGoalSession,
      setInputBlocks,
      setIsTyping,
    ],
  );
  const handleResendUserMessage = React.useCallback(
    async (message: ChatMessage) => {
      const resendPayload = await buildResendPayloadFromMessage(message);
      const versionRootMessageId =
        String(message.lineage?.versionRootMessageId || "").trim() || message.id;
      await handleSidebarSend(
        resendPayload.text,
        resendPayload.attachments,
        undefined,
        resendPayload.skillData,
        {
          lineage: {
            source: "resend",
            versionRootMessageId,
            previousVersionMessageId: message.id,
            triggerMessageId: message.id,
          },
        },
      );
    },
    [buildResendPayloadFromMessage, handleSidebarSend],
  );
  const handleEditAndResendMessage = React.useCallback(
    async (message: ChatMessage, nextText: string) => {
      const resendPayload = await buildResendPayloadFromMessage(message);
      const versionRootMessageId =
        String(message.lineage?.versionRootMessageId || "").trim() || message.id;
      await handleSidebarSend(
        nextText,
        resendPayload.attachments,
        undefined,
        resendPayload.skillData,
        {
          lineage: {
            source: "edit_resend",
            versionRootMessageId,
            previousVersionMessageId: message.id,
            triggerMessageId: message.id,
          },
        },
      );
    },
    [buildResendPayloadFromMessage, handleSidebarSend],
  );
  const handleAssistantMessageFeedback = React.useCallback(
    (
      message: ChatMessage,
      feedback: ChatMessage["feedback"],
    ) => {
      const feedbackUpdatedAt = Date.now();
      updateMessage(message.id, {
        feedback,
        feedbackUpdatedAt,
      });
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id !== activeConversationId
            ? conversation
            : {
                ...conversation,
                updatedAt: feedbackUpdatedAt,
                messages: (conversation.messages || []).map((item) =>
                  item.id === message.id
                    ? {
                        ...item,
                        feedback,
                        feedbackUpdatedAt,
                      }
                    : item,
                ),
              },
        ),
      );
    },
    [activeConversationId, setConversations, updateMessage],
  );
  const handleRetryAssistantResponse = React.useCallback(
    async (message: ChatMessage) => {
      const relatedUserMessageId = String(message.responseToMessageId || "").trim();
      const relatedUserMessage =
        (relatedUserMessageId
          ? visibleMessages.find(
              (item) => item.role === "user" && item.id === relatedUserMessageId,
            )
          : null) ||
        (() => {
          const assistantIndex = visibleMessages.findIndex(
            (item) => item.id === message.id,
          );
          if (assistantIndex <= 0) return null;
          for (let index = assistantIndex - 1; index >= 0; index -= 1) {
            if (visibleMessages[index]?.role === "user") {
              return visibleMessages[index];
            }
          }
          return null;
        })();
      if (!relatedUserMessage) return;

      const resendPayload = await buildResendPayloadFromMessage(relatedUserMessage);
      const versionRootMessageId =
        String(relatedUserMessage.lineage?.versionRootMessageId || "").trim() ||
        relatedUserMessage.id;
      await handleSidebarSend(
        resendPayload.text,
        resendPayload.attachments,
        undefined,
        resendPayload.skillData,
        {
          lineage: {
            source: "assistant_retry",
            versionRootMessageId,
            previousVersionMessageId: relatedUserMessage.id,
            previousAssistantMessageId: message.id,
            triggerMessageId: message.id,
          },
        },
      );
    },
    [buildResendPayloadFromMessage, handleSidebarSend, visibleMessages],
  );
  const currentTaskConversationId = String(
    currentTask?.input?.context?.conversationId || "",
  ).trim();
  const isActiveConversationTask =
    currentTaskConversationId === String(activeConversationId || "").trim();
  const isTypingWithoutBoundTask = isTyping && !currentTaskConversationId;
  const activeConversationTaskVisible =
    isActiveConversationTask || isTypingWithoutBoundTask;
  const isWorkspaceConversationBusy =
    activeConversationTaskVisible &&
    (isTyping ||
      currentTask?.status === "analyzing" ||
      currentTask?.status === "executing");
  const isBrowserConversationBusy = Boolean(
    preparedPlan ||
      isPlanning ||
      isStarting ||
      isContinuing ||
      isRefreshing ||
      sessionSummary.isRunning,
  );
  const isConversationTransitionBlocked =
    isWorkspaceConversationBusy || isBrowserConversationBusy;
  const activeConversationRunning = isConversationTransitionBlocked;
  const activeConversationHasDraft = Boolean(
    activeConversation && hasConversationDraft(activeConversation),
  );
  const activeConversationArchived = Boolean(
    activeConversation && isConversationArchived(activeConversation),
  );
  const showEmptyActiveConversationState = Boolean(
    activeConversation &&
      !activeConversationArchived &&
      !activeConversation?.parentConversationId &&
      visibleMessages.length === 0 &&
      !activeConversationTaskVisible &&
      !preparedPlan,
  );
  const activeConversationMatchesPendingArchive = Boolean(
    activeConversation &&
      pendingArchivedConversation &&
      activeConversation.id === pendingArchivedConversation.conversation.id,
  );
  const showEmptyArchivedConversationState = Boolean(
    activeConversationArchived &&
      !activeConversation?.parentConversationId &&
      visibleMessages.length === 0 &&
      !activeConversationTaskVisible &&
      !preparedPlan,
  );
  const emptyConversationStarters = React.useMemo(
    () => buildEmptyConversationStarters(browserAgent.selectedElementLabel),
    [browserAgent.selectedElementLabel],
  );
  const currentComposerDraftText = React.useMemo(
    () =>
      currentInputBlocks
        .map((block) => (block.type === "text" ? String(block.text || "") : ""))
        .join("")
        .trim(),
    [currentInputBlocks],
  );
  const currentComposerHasDraft = React.useMemo(
    () =>
      currentComposerDraftText.length > 0 ||
      currentInputBlocks.some((block) => block.type === "file" && block.file),
    [currentComposerDraftText, currentInputBlocks],
  );
  const shouldSuppressDraftBanner = Boolean(
    currentComposerHasDraft && showEmptyActiveConversationState,
  );
  const activeEmptyConversationStarterId = React.useMemo(() => {
    if (!currentComposerDraftText) return null;

    const matchedByPrompt = emptyConversationStarters.find(
      (starter) => starter.prompt.trim() === currentComposerDraftText,
    );
    if (matchedByPrompt) return matchedByPrompt.id;

    const matchedByModeAndPrompt = emptyConversationStarters.find(
      (starter) =>
        starter.mode === composer.creationMode &&
        starter.prompt.trim() === currentComposerDraftText,
    );
    return matchedByModeAndPrompt?.id || null;
  }, [composer.creationMode, currentComposerDraftText, emptyConversationStarters]);
  const activeEmptyConversationStarter = React.useMemo(
    () =>
      activeEmptyConversationStarterId
        ? emptyConversationStarters.find(
            (starter) => starter.id === activeEmptyConversationStarterId,
          ) || null
        : null,
    [activeEmptyConversationStarterId, emptyConversationStarters],
  );
  const effectiveComposerMode = activeEmptyConversationStarter?.mode || composer.creationMode;
  const selectedSurfaceLabel = React.useMemo(
    () => String(browserAgent.selectedElementLabel || "").trim(),
    [browserAgent.selectedElementLabel],
  );
  const queueConversationTransition = React.useCallback(
    (label: string, action: () => void) => {
      closeHistoryPopover();
      setIsStoppingForConversationTransition(false);
      setPendingConversationTransition({
        key: `conversation-transition-${Date.now()}`,
        label,
        action,
      });
    },
    [closeHistoryPopover],
  );
  const runConversationTransition = React.useCallback(
    (label: string, action: () => void) => {
      if (isConversationTransitionBlocked) {
        queueConversationTransition(label, action);
        return;
      }
      action();
    },
    [isConversationTransitionBlocked, queueConversationTransition],
  );
  const handleCreateConversationGuarded = React.useCallback(() => {
    runConversationTransition("新建对话", handleCreateConversation);
  }, [handleCreateConversation, runConversationTransition]);
  const handleSelectConversationGuarded = React.useCallback(
    (
      conversationId: string,
      options?: {
        restoreComposer?: boolean;
      },
    ) => {
      const targetConversation = conversations.find(
        (conversation) => conversation.id === conversationId,
      );
      const conversationLabel =
        String(targetConversation?.title || "").trim() || "这个对话";
      runConversationTransition(
        `对话“${conversationLabel}”`,
        () => handleSelectConversation(conversationId, options),
      );
    },
    [conversations, handleSelectConversation, runConversationTransition],
  );
  const handleDeleteConversationGuarded = React.useCallback(
    (conversationId: string) => {
      const targetConversation = conversations.find(
        (conversation) => conversation.id === conversationId,
      );
      const conversationLabel =
        String(targetConversation?.title || "").trim() || "这个对话";
      closeHistoryPopover();
      setPendingConversationDeletion({
        conversationId,
        label: conversationLabel,
        isActive: conversationId === activeConversationId,
      });
    },
    [
      activeConversationId,
      closeHistoryPopover,
      conversations,
    ],
  );
  const clearPendingConversationDeletion = React.useCallback(() => {
    setPendingConversationDeletion(null);
  }, []);
  const handleConfirmConversationDeletion = React.useCallback(() => {
    if (!pendingConversationDeletion) return;

    const { conversationId, isActive } = pendingConversationDeletion;
    clearPendingConversationDeletion();

    const finalizeDeletion = (resolvedConversationId: string) => {
      finalizeDeletedConversation(resolvedConversationId);
      setPendingDeletedConversation((previous) =>
        previous?.conversation.id === resolvedConversationId ? null : previous,
      );
    };
    const commitDeletion = () => {
      const deletionResult = handleDeleteConversation(conversationId, {
        deferMemoryCleanup: true,
      });
      if (!deletionResult) return;

      clearPendingDeletedConversation();

      const timeoutId = setTimeout(() => {
        finalizeDeletion(deletionResult.deletedConversation.id);
      }, 6000);

      setPendingDeletedConversation({
        conversation: deletionResult.deletedConversation,
        label:
          String(deletionResult.deletedConversation.title || "").trim() || "这个对话",
        wasActive: deletionResult.wasActive,
        timeoutId,
      });
    };

    if (!isActive) {
      commitDeletion();
      return;
    }

    runConversationTransition("删除当前对话", commitDeletion);
  }, [
    clearPendingDeletedConversation,
    clearPendingConversationDeletion,
    finalizeDeletedConversation,
    handleDeleteConversation,
    pendingConversationDeletion,
    runConversationTransition,
  ]);
  const handleUndoConversationDeletion = React.useCallback(() => {
    if (!pendingDeletedConversation) return;

    restoreConversationSnapshot(pendingDeletedConversation.conversation, {
      activate: pendingDeletedConversation.wasActive,
    });
    clearPendingDeletedConversation();
  }, [
    clearPendingDeletedConversation,
    pendingDeletedConversation,
    restoreConversationSnapshot,
  ]);
  const handleUndoConversationArchive = React.useCallback(() => {
    if (!pendingArchivedConversation) return;

    restoreConversationSnapshot(
      {
        ...pendingArchivedConversation.conversation,
        archivedAt: undefined,
      },
      {
        activate: pendingArchivedConversation.wasActive,
      },
    );
    clearPendingArchivedConversation();
  }, [
    clearPendingArchivedConversation,
    pendingArchivedConversation,
    restoreConversationSnapshot,
  ]);
  const handleClearDraftComposer = React.useCallback(() => {
    if (activeConversationArchived) return;
    const textId = createInputBlockId("text");
    composer.setCreationMode("agent");
    composer.setPrompt("");
    setInputBlocks([{ id: textId, type: "text", text: "" }]);
    setActiveBlockId(textId);
    clearPendingAttachments();
    setActiveQuickSkillPreference(null);
  }, [
    activeConversationArchived,
    clearPendingAttachments,
    composer,
    setActiveBlockId,
    setInputBlocks,
  ]);
  const handleContinueConversationFromHistory = React.useCallback(
    (conversationId: string) => {
      handleSelectConversationGuarded(conversationId);
    },
    [handleSelectConversationGuarded],
  );
  const handleRestoreConversationInputFromHistory = React.useCallback(
    async (conversationId: string, messageToRestore?: ChatMessage | null) => {
      console.log("[assistant-sidebar] restore-input:invoke", {
        conversationId,
        hasMessageToRestore: Boolean(messageToRestore),
      });
      const conversation = conversations.find(
        (item) => item.id === conversationId,
      );
      if (!conversation) return;

      const sourceMessages = Array.isArray(conversation.messages)
        ? conversation.messages
        : [];
      const relatedUserMessage =
        messageToRestore ||
        (() => {
          for (let index = sourceMessages.length - 1; index >= 0; index -= 1) {
            if (sourceMessages[index]?.role === "user") {
              return sourceMessages[index];
            }
          }
          return null;
        })();

      if (!relatedUserMessage) {
        handleSelectConversationGuarded(conversationId);
        return;
      }

      if (activeConversationId !== conversationId) {
        handleSelectConversationGuarded(conversationId, {
          restoreComposer: false,
        });
      } else {
        closeHistoryPopover();
      }

      const normalizedPrompt = String(relatedUserMessage.text || "").trim();
      const nextBlockId = createInputBlockId("text");
      setPendingRestoreComposerState({
        conversationId,
        prompt: normalizedPrompt,
        blockId: nextBlockId,
      });
      (window as typeof window & {
        __assistantRestoreDebug?: Record<string, unknown>;
      }).__assistantRestoreDebug = {
        stage: "queued",
        conversationId,
        activeConversationId,
        targetConversationId: conversation.id,
        promptLength: normalizedPrompt.length,
        promptPreview: normalizedPrompt.slice(0, 160),
      };
      console.log("[assistant-sidebar] restore-input:queued", {
        conversationId,
        activeConversationId,
        targetConversationId: conversation.id,
        promptLength: normalizedPrompt.length,
        promptPreview: normalizedPrompt.slice(0, 160),
      });
    },
    [
      activeConversationId,
      closeHistoryPopover,
      conversations,
      handleSelectConversationGuarded,
    ],
  );
  React.useEffect(() => {
    pendingDeletedConversationRef.current = pendingDeletedConversation;
  }, [pendingDeletedConversation]);
  React.useEffect(() => {
    pendingArchivedConversationRef.current = pendingArchivedConversation;
  }, [pendingArchivedConversation]);
  React.useEffect(() => {
    finalizeDeletedConversationRef.current = finalizeDeletedConversation;
  }, [finalizeDeletedConversation]);
  React.useEffect(() => {
    if (!pendingRestoreComposerState) return;
    if (activeConversationId !== pendingRestoreComposerState.conversationId) return;

    composer.setCreationMode("agent");
    composer.setPrompt(pendingRestoreComposerState.prompt);
    clearPendingAttachments();
    setInputBlocks([
      {
        id: pendingRestoreComposerState.blockId,
        type: "text",
        text: pendingRestoreComposerState.prompt,
      },
    ]);
    setActiveBlockId(pendingRestoreComposerState.blockId);
    (window as typeof window & {
      __assistantRestoreDebug?: Record<string, unknown>;
    }).__assistantRestoreDebug = {
      stage: "applied",
      conversationId: pendingRestoreComposerState.conversationId,
      activeConversationId,
      promptLength: pendingRestoreComposerState.prompt.length,
      promptPreview: pendingRestoreComposerState.prompt.slice(0, 160),
    };
    console.log("[assistant-sidebar] restore-input:applied", {
      conversationId: pendingRestoreComposerState.conversationId,
      activeConversationId,
      promptLength: pendingRestoreComposerState.prompt.length,
      promptPreview: pendingRestoreComposerState.prompt.slice(0, 160),
    });
    setPendingRestoreComposerState(null);
  }, [
    activeConversationId,
    clearPendingAttachments,
    composer,
    pendingRestoreComposerState,
    setActiveBlockId,
    setInputBlocks,
  ]);
  React.useEffect(() => {
    return () => {
      const pendingDeletion = pendingDeletedConversationRef.current;
      if (pendingDeletion?.timeoutId) {
        clearTimeout(pendingDeletion.timeoutId);
        finalizeDeletedConversationRef.current?.(pendingDeletion.conversation.id);
      }
      const pendingArchive = pendingArchivedConversationRef.current;
      if (pendingArchive?.timeoutId) {
        clearTimeout(pendingArchive.timeoutId);
      }
    };
  }, []);
  const handleToggleConversationArchivedGuarded = React.useCallback(
    (conversationId: string) => {
      const targetConversation = conversations.find(
        (conversation) => conversation.id === conversationId,
      );
      const willArchiveActiveConversation =
        conversationId === activeConversationId && !targetConversation?.archivedAt;
      const willRestoreConversation = Boolean(targetConversation?.archivedAt);

      if (!willArchiveActiveConversation) {
        if (willRestoreConversation) {
          setPendingArchivedConversation((previous) => {
            if (previous?.conversation.id === conversationId) {
              if (previous.timeoutId) {
                clearTimeout(previous.timeoutId);
              }
              return null;
            }
            return previous;
          });
        }
        const archiveResult = handleToggleConversationArchived(conversationId);
        if (archiveResult?.archived) {
          clearPendingArchivedConversation();
          const timeoutId = setTimeout(() => {
            setPendingArchivedConversation((previous) =>
              previous?.conversation.id === archiveResult.conversationBeforeChange.id
                ? null
                : previous,
            );
          }, 6000);
          setPendingArchivedConversation({
            conversation: archiveResult.conversationBeforeChange,
            label:
              String(archiveResult.conversationBeforeChange.title || "").trim() ||
              "这个对话",
            wasActive: archiveResult.wasActive,
            timeoutId,
          });
        }
        return;
      }

      runConversationTransition("归档当前对话", () => {
        const archiveResult = handleToggleConversationArchived(conversationId);
        if (archiveResult?.archived) {
          clearPendingArchivedConversation();
          const timeoutId = setTimeout(() => {
            setPendingArchivedConversation((previous) =>
              previous?.conversation.id === archiveResult.conversationBeforeChange.id
                ? null
                : previous,
            );
          }, 6000);
          setPendingArchivedConversation({
            conversation: archiveResult.conversationBeforeChange,
            label:
              String(archiveResult.conversationBeforeChange.title || "").trim() ||
              "这个对话",
            wasActive: archiveResult.wasActive,
            timeoutId,
          });
        }
      });
    },
    [
      activeConversationId,
      clearPendingArchivedConversation,
      conversations,
      handleToggleConversationArchived,
      runConversationTransition,
    ],
  );
  const handleBranchConversationGuarded = React.useCallback(
    (message: ChatMessage) => {
      runConversationTransition("分支对话", () =>
        handleBranchConversationFromMessage(message),
      );
    },
    [handleBranchConversationFromMessage, runConversationTransition],
  );
  const clearPendingConversationTransition = React.useCallback(() => {
    setPendingConversationTransition(null);
    setIsStoppingForConversationTransition(false);
  }, []);
  const handleConfirmPendingConversationTransition = React.useCallback(async () => {
    if (!pendingConversationTransition) return;

    if (!isConversationTransitionBlocked) {
      const nextAction = pendingConversationTransition.action;
      clearPendingConversationTransition();
      nextAction();
      return;
    }

    setIsStoppingForConversationTransition(true);

    try {
      if (isBrowserConversationBusy) {
        await handleCancelSession();
      }
      if (isWorkspaceConversationBusy) {
        cancelChatGeneration();
      }
    } catch (error) {
      console.warn(
        "[assistant-sidebar] failed to stop current run before switching chats",
        error,
      );
      setIsStoppingForConversationTransition(false);
    }
  }, [
    cancelChatGeneration,
    clearPendingConversationTransition,
    handleCancelSession,
    isBrowserConversationBusy,
    isConversationTransitionBlocked,
    isWorkspaceConversationBusy,
    pendingConversationTransition,
  ]);
  React.useEffect(() => {
    if (!pendingConversationTransition || !isStoppingForConversationTransition) {
      return;
    }
    if (isConversationTransitionBlocked) {
      return;
    }

    const nextAction = pendingConversationTransition.action;
    clearPendingConversationTransition();
    nextAction();
  }, [
    clearPendingConversationTransition,
    isConversationTransitionBlocked,
    isStoppingForConversationTransition,
    pendingConversationTransition,
  ]);
  const handleOpenParentConversation = React.useCallback(() => {
    const parentConversationId = String(
      activeConversation?.parentConversationId || "",
    ).trim();
    if (!parentConversationId) return;
    const parentConversationLabel =
      String(activeConversation?.parentConversationTitle || "").trim() ||
      "上级对话";
    runConversationTransition(
      `上级对话“${parentConversationLabel}”`,
      () => handleSelectConversation(parentConversationId),
    );
  }, [
    activeConversation?.parentConversationId,
    activeConversation?.parentConversationTitle,
    handleSelectConversation,
    runConversationTransition,
  ]);
  const primeComposerWithPrompt = React.useCallback(
    (prompt: string, mode: "agent" | "image" | "video" = "agent") => {
      const normalizedPrompt = String(prompt || "").trim();
      const nextBlockId = createInputBlockId("text");
      composer.setCreationMode(mode);
      composer.setPrompt(normalizedPrompt);
      setInputBlocks([
        {
          id: nextBlockId,
          type: "text",
          text: normalizedPrompt,
        },
      ]);
      setActiveBlockId(nextBlockId);
    },
    [composer, setActiveBlockId, setInputBlocks],
  );
  const handleStartEmptyConversationPrompt = React.useCallback(
    async (starter: EmptyConversationStarter) => {
      if (activeConversationArchived) return;
      const nextMode = starter.mode || "agent";
      if (activeConversationHasDraft) {
        primeComposerWithPrompt(starter.prompt, nextMode);
        return;
      }
      if (nextMode === "agent") {
        await handleSidebarSend(starter.prompt);
        return;
      }
      primeComposerWithPrompt(starter.prompt, nextMode);
    },
    [
      activeConversationArchived,
      activeConversationHasDraft,
      handleSidebarSend,
      primeComposerWithPrompt,
    ],
  );

  React.useEffect(() => {
    const sessionId = String(currentSession?.id || "").trim();
    if (!sessionId) return;

    const liveMessageId = `browser-agent-live-${sessionId}`;
    const payload = buildBrowserAgentMessagePayload(currentSession);
    const payloadSignature = JSON.stringify({
      text: payload.text,
      agentData: payload.agentData || null,
      error: Boolean(payload.error),
    });
    if (lastBrowserAgentLivePayloadRef.current[liveMessageId] === payloadSignature) {
      return;
    }
    lastBrowserAgentLivePayloadRef.current[liveMessageId] = payloadSignature;

    const existing = useAgentStore
      .getState()
      .messages.find((message) => message.id === liveMessageId);
    if (existing) {
      updateMessage(liveMessageId, {
        text: payload.text,
        agentData: payload.agentData,
        error: payload.error,
      });
      return;
    }

    addMessage({
      id: liveMessageId,
      role: "model",
      text: payload.text,
      agentData: payload.agentData,
      timestamp: Date.now(),
      error: payload.error,
    });
  }, [
    addMessage,
    buildBrowserAgentMessagePayload,
    currentSession,
    updateMessage,
  ]);

  const messageThreadNode = (
    <div
      className="relative flex-1 min-h-0 overflow-y-auto bg-[linear-gradient(180deg,#fbfcfe_0%,#f6f8fb_100%)] px-4 pb-3 pt-2.5 no-scrollbar transition-all duration-200"
    >
      <div className="space-y-3">
        {pendingConversationTransition ? (
          <div className="px-1">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>正在保护当前运行</span>
                  </div>
                  <div className="mt-2 text-[13px] font-medium text-amber-900">
                    当前对话还在运行
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-amber-800">
                    切换到“{pendingConversationTransition.label}”前，需要先停止当前任务，避免后续消息写入错误的对话。
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={clearPendingConversationTransition}
                    disabled={isStoppingForConversationTransition}
                    className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-medium text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    留在这里
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleConfirmPendingConversationTransition()
                    }
                    disabled={isStoppingForConversationTransition}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-500 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isStoppingForConversationTransition ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>正在停止</span>
                      </>
                    ) : isConversationTransitionBlocked ? (
                      <>
                        <Square size={12} />
                        <span>停止并切换</span>
                      </>
                    ) : (
                      <span>立即切换</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {pendingConversationDeletion ? (
          <div className="px-1">
            <div className="rounded-2xl border border-rose-200 bg-rose-50/95 px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-rose-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    <span>确认删除</span>
                  </div>
                  <div className="mt-2 text-[13px] font-medium text-rose-900">
                    删除“{pendingConversationDeletion.label}”？
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-rose-800">
                    {pendingConversationDeletion.isActive
                      ? "我们会先安全切换到其它对话，再把当前对话从历史中移除。"
                      : "这个对话会从工作区历史记录中移除。"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={clearPendingConversationDeletion}
                    className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmConversationDeletion}
                    className="rounded-full border border-rose-300 bg-rose-500 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-rose-600"
                  >
                    删除对话
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {pendingDeletedConversation ? (
          <div className="px-1">
            <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                    <span>对话已删除</span>
                  </div>
                  <div className="mt-2 text-[13px] font-medium text-slate-900">
                    “{pendingDeletedConversation.label}”已从历史中移除
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-slate-600">
                    {pendingDeletedConversation.wasActive
                      ? "已切换到其它对话。撤销后会恢复刚删除的对话。"
                      : "撤销后会把这个对话恢复到历史列表。"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUndoConversationDeletion}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  撤销
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {pendingArchivedConversation && !activeConversationMatchesPendingArchive ? (
          <div className="px-1">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/95 px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span>对话已归档</span>
                  </div>
                  <div className="mt-2 text-[13px] font-medium text-blue-900">
                    “{pendingArchivedConversation.label}”已移到归档对话
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-blue-800">
                    {pendingArchivedConversation.wasActive
                      ? "已切换到其它活跃对话。撤销后会恢复并重新打开它。"
                      : "撤销后会把这个对话恢复到活跃历史列表。"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUndoConversationArchive}
                  className="shrink-0 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-medium text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                >
                  撤销
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {activeConversationArchived && !showEmptyArchivedConversationState ? (
          <div className="px-1">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/95 px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    <Archive size={11} strokeWidth={2} />
                    <span>归档对话</span>
                  </div>
                  <div className="mt-2 text-[13px] font-medium text-slate-900">
                    你正在查看已归档的对话
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-slate-600">
                    恢复后它会回到活跃列表，你可以继续从这里跟进。
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleConversationArchivedGuarded(activeConversation.id)
                  }
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  恢复对话
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {activeConversation?.parentConversationId ? (
          <div className="px-1">
            <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    <GitBranch size={11} strokeWidth={2} />
                    <span>分支对话</span>
                  </div>
                  <div className="mt-2 text-[13px] font-medium text-slate-800">
                    当前对话来自
                    <span className="mx-1 text-slate-900">
                      {activeConversation.parentConversationTitle || "上一个对话"}
                    </span>
                    的分支
                  </div>
                  {activeConversation.branchPointLabel ? (
                    <div className="mt-1 text-[12px] leading-5 text-slate-500">
                      分支起点：{activeConversation.branchPointLabel}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={handleOpenParentConversation}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  回到源对话
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {visibleMessages.length > 0 || activeConversationTaskVisible ? (
          <MessageList
            onSend={handleSidebarSend}
            onSmartGenerate={handleSmartGenerate}
            onPreview={setPreviewUrl}
            onFeedback={handleAssistantMessageFeedback}
            onBranchConversation={handleBranchConversationGuarded}
            onReuseToComposer={restoreMessageToComposer}
            onResendMessage={handleResendUserMessage}
            onEditAndResendMessage={handleEditAndResendMessage}
            onRetryAssistantResponse={handleRetryAssistantResponse}
            isTyping={isTyping}
            currentTask={currentTask}
            showCurrentTaskProgress={activeConversationTaskVisible}
            clothingActions={clothingActions}
            ecommerceActions={ecommerceActions}
          />
        ) : showEmptyActiveConversationState ? (
          <div className="flex min-h-[68px] items-end px-3 pb-1.5 pt-2">
            <div className="mx-auto flex w-full max-w-[320px] flex-col items-center">
              <div className="text-center text-[10px] font-medium text-slate-400">
                直接开始，或先用一个起手任务带路。
              </div>
              <div className="mt-2 flex w-full flex-wrap justify-center gap-1.5">
                {emptyConversationStarters.slice(0, 2).map((starter) => {
                  const isActiveStarter =
                    activeEmptyConversationStarter?.id === starter.id;
                  return (
                    <button
                      key={starter.id}
                      type="button"
                      onClick={() => {
                        void handleStartEmptyConversationPrompt(starter);
                      }}
                      className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[9.5px] font-medium transition ${
                        isActiveStarter
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200/90 bg-white/88 text-slate-500 hover:border-slate-300 hover:text-slate-800"
                      }`}
                    >
                      {starter.title}
                    </button>
                  );
                })}
              </div>
              {selectedSurfaceLabel ? (
                <div className="mt-1.5 inline-flex max-w-full items-center rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 text-[9px] font-medium text-slate-500">
                  当前焦点：{selectedSurfaceLabel}
                </div>
              ) : null}
            </div>
          </div>
        ) : showEmptyArchivedConversationState ? (
            <div className="flex min-h-[340px] items-center px-1 py-4">
            <div className="mx-auto flex max-w-[360px] flex-col items-center rounded-[28px] border border-dashed border-slate-200 bg-white/82 px-8 py-10 text-center shadow-[0_18px_48px_-36px_rgba(15,23,42,0.45)]">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-slate-900 text-white shadow-sm">
                <Archive size={22} strokeWidth={1.9} />
              </div>
              <div className="mt-5 text-[15px] font-semibold text-slate-900">
                归档对话
              </div>
              <div className="mt-2 text-[12px] leading-6 text-slate-500">
                这个对话已作为参考保留。需要继续跟进、追加消息或放回活跃列表时，可以随时恢复。
              </div>
              <button
                type="button"
                onClick={() =>
                  activeConversation
                    ? handleToggleConversationArchivedGuarded(activeConversation.id)
                    : undefined
                }
                className="mt-6 inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-[12px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                恢复对话
              </button>
            </div>
          </div>
        ) : null}
        {preparedPlan ? (
          <AssistantSidebarPlanCard
            goal={preparedPlan.goal}
            plan={preparedPlan.plan}
            targetElementId={preparedPlan.targetElementId}
            targetElementPendingCreation={preparedPlan.targetElementPendingCreation}
            referenceImageCount={preparedPlan.referenceImageCount}
            controlSummary={preparedPlan.controlSummary}
            repairNotes={preparedPlan.repairNotes}
            isExecuting={isStarting}
            onApprove={() => {
              void handleApprovePreparedPlan();
            }}
            onDismiss={() => {
              void handleCancelSession();
            }}
          />
        ) : null}
      </div>
    </div>
  );

  const composerNode = (
    <>
      <AssistantSidebarStatusBanner
        label={currentTaskLabel}
        statusKey={
          isBrowserConversationBusy
            ? "executing"
            : activeConversationTaskVisible
              ? currentTask?.status
              : undefined
        }
        hideWhenEmpty={shouldSuppressDraftBanner}
      />

      <div className="shrink-0 flex-shrink-0 bg-[linear-gradient(180deg,rgba(246,248,251,0)_0%,rgba(246,248,251,0.72)_12%,rgba(248,249,252,0.98)_30%,rgba(248,249,252,1)_100%)] pt-1">
        <InputArea
          composer={{
            ...composer,
            handleSend: handleSidebarSend,
          }}
          inputUi={inputUi}
          modelPreferences={modelPreferences}
          browserAgent={{
            chatEnabled,
            setChatEnabled,
            currentStepTitle: sessionSummary.currentStepTitle,
            selectedElementLabel: sessionSummary.selectedElementLabel,
            plannerModelLabel: browserAgentModelLabel,
            suggestedGoal,
            hasPendingPlan: Boolean(preparedPlan),
            isPlanning,
            isRunning: sessionSummary.isRunning,
            isStarting,
            isContinuing,
            isRefreshing,
            error,
            onRefresh: () => {
              if (preparedPlan) return;
              void handleRefreshSession();
            },
            onCancel: () => {
              void handleCancelSession();
            },
          }}
          markers={markers}
          onSaveMarkerLabel={onSaveMarkerLabel}
          archivedView={{
            isArchived: activeConversationArchived,
            onRestore: () => {
              if (!activeConversation) return;
              handleToggleConversationArchivedGuarded(activeConversation.id);
            },
          }}
        />
      </div>
    </>
  );

  return (
    <div
      data-assistant-sidebar-root
      className={`absolute right-0 top-0 z-50 flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#f9fafc_0%,#f3f5f8_100%)] ${
        isFullscreen
          ? "inset-0 w-full border-l-0 shadow-none"
          : "w-[480px] border-l border-slate-200/90 shadow-[-18px_0_42px_-32px_rgba(15,23,42,0.18)]"
      }`}
    >
      <AssistantSidebarHeader
        title={activeConversationTitle}
        historyOpen={showHistoryPopover}
        historySearch={historySearch}
        setHistorySearch={setHistorySearch}
        conversations={conversations}
        activeConversationId={activeConversationId}
        activeConversationRunning={activeConversationRunning}
        activeConversationHasDraft={activeConversationHasDraft}
        filesOpen={showFileListModal}
        messages={messages}
        onPreview={setPreviewUrl}
        onToggleHistory={toggleHistoryPopover}
        onCreateConversation={handleCreateConversationGuarded}
        onSelectConversation={handleSelectConversationGuarded}
        onDeleteConversation={handleDeleteConversationGuarded}
        onRenameConversation={handleRenameConversation}
        onToggleConversationPinned={handleToggleConversationPinned}
        onToggleConversationArchived={handleToggleConversationArchivedGuarded}
        onContinueConversation={handleContinueConversationFromHistory}
        onRestoreConversationInput={handleRestoreConversationInputFromHistory}
        branchInfo={
          activeConversation?.parentConversationId
            ? {
                parentTitle:
                  activeConversation.parentConversationTitle || "上一个对话",
                branchPointLabel: activeConversation.branchPointLabel,
                onOpenParent: handleOpenParentConversation,
              }
            : null
        }
        onToggleFiles={toggleFileListModal}
        onClose={() => {
          setIsFullscreen(false);
          setShowAssistant(false);
        }}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />

      {isFullscreen ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="w-[292px] shrink-0">
            <AssistantSidebarHistoryPanel
              historySearch={historySearch}
              setHistorySearch={setHistorySearch}
              conversations={conversations}
              activeConversationId={activeConversationId}
              activeConversationRunning={activeConversationRunning}
              onCreateConversation={handleCreateConversationGuarded}
              onSelectConversation={handleSelectConversationGuarded}
              onDeleteConversation={handleDeleteConversationGuarded}
              onRenameConversation={handleRenameConversation}
              onToggleConversationPinned={handleToggleConversationPinned}
              onToggleConversationArchived={
                handleToggleConversationArchivedGuarded
              }
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,#fafbfd_0%,#f4f6fa_100%)]">
            {messageThreadNode}
            {composerNode}
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,#fafbfd_0%,#f4f6fa_100%)] transition-all duration-200">
          <>
            {messageThreadNode}
            {composerNode}
          </>
        </div>
      )}
    </div>
  );
});

