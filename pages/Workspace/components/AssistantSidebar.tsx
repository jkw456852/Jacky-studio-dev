import React, { memo } from "react";
import { motion } from "framer-motion";
import { useAgentStore } from "../../../stores/agent.store";
import type { BrowserAgentSessionRecord } from "../../../services/browser-agent";
import { getBrowserAgentModelLabel } from "../../../services/provider-settings";
import { buildUserChatMessagePayloadFromInputBlocks } from "../chatMessageContent";
import { createImagePreviewDataUrl } from "../workspaceShared";
import { useAssistantSidebarConversationUi } from "../controllers/useAssistantSidebarConversationUi";
import { useAssistantSidebarBrowserAgentUi } from "../controllers/useAssistantSidebarBrowserAgentUi";
import { useAssistantSidebarPanelUi } from "../controllers/useAssistantSidebarPanelUi";
import { useAssistantSidebarQuickSkills } from "../controllers/useAssistantSidebarQuickSkills";
import { AssistantSidebarHeader } from "./AssistantSidebarHeader";
import { AssistantSidebarPlanCard } from "./AssistantSidebarPlanCard";
import { AssistantSidebarQuickSkills } from "./AssistantSidebarQuickSkills";
import { AssistantSidebarStatusBanner } from "./AssistantSidebarStatusBanner";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { EcommerceWorkflowSummaryCard } from "./workflow/EcommerceWorkflowSummaryCard";
import { isEcommerceWorkflowChatMessage } from "./workflow/ecommerceWorkflowUi";
import type {
  InputAreaComposerProps,
  InputAreaInputUiProps,
  InputAreaModelPreferencesProps,
} from "./InputArea";

import { ConversationSession, Marker } from "../../../types";
import type { ChatMessage } from "../../../types";
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

  if (elementId) lines.push(`目标节点: ${elementId}`);
  if (requestId) lines.push(`请求 ID: ${requestId}`);
  if (controlId) lines.push(`控件: ${controlId}`);
  if (timeoutMs) lines.push(`超时: ${timeoutMs}ms`);

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

  if (elementId) lines.push(`目标节点: ${elementId}`);
  if (requestId) lines.push(`请求 ID: ${requestId}`);
  if (controlId) lines.push(`控件: ${controlId}`);
  if (timeoutMs) lines.push(`超时: ${timeoutMs}ms`);

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

const resolveStepElementId = (
  step: BrowserAgentSessionRecord["steps"][number],
  session: BrowserAgentSessionRecord | null,
) => {
  const resultRecord = isRecord(step.result) ? step.result : null;
  const toolResult = isRecord(resultRecord?.result) ? resultRecord.result : null;
  const payload = isRecord(toolResult?.payload) ? toolResult.payload : null;
  const report = isRecord(resultRecord?.report) ? resultRecord.report : null;

  const candidates = [
    readStringValue(step.resolvedInput?.elementId),
    readStringValue(payload?.targetElementId),
    readStringValue(payload?.elementId),
    readStringValue(report?.targetElementId),
    readStringValue(resultRecord?.elementId),
    readStringValue(session?.metadata?.targetElementId),
  ].filter(Boolean);

  return candidates[0] || null;
};

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
};

type AssistantSidebarMessageActionsProps = {
  handleSend: (
    overridePrompt?: string,
    overrideAttachments?: File[],
    overrideWeb?: boolean,
    skillData?: ChatMessage["skillData"],
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

interface AssistantSidebarProps {
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
  const {
    workspaceId,
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversationId,
  } = session;
  const { setShowAssistant, setPreviewUrl, onOpenEcommerceWorkflow } = panelUi;
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
    selectedElementId: browserAgent.selectedElementId,
    selectedElementLabel: browserAgent.selectedElementLabel,
    selectedElementType: browserAgent.selectedElementType,
    selectedTreeNodeKind: browserAgent.selectedTreeNodeKind,
    createTargetElement: browserAgent.createTargetElement,
  });
  const messages = useAgentStore((s) => s.messages);
  const visibleMessages = React.useMemo(
    () =>
      messages.filter((message) => !isEcommerceWorkflowChatMessage(message)),
    [messages],
  );
  const {
    addMessage,
    updateMessage,
    setMessages,
    clearMessages,
    setIsTyping,
    setInputBlocks,
    clearPendingAttachments,
  } = useAgentStore((s) => s.actions);
  const {
    currentTask,
    currentTaskLabel,
    showHistoryPopover,
    historySearch,
    showFileListModal,
    setHistorySearch,
    toggleHistoryPopover,
    closeHistoryPopover,
    toggleFileListModal,
  } = useAssistantSidebarPanelUi();
  const {
    activeQuickSkill,
    handleSendWithQuickSkill,
    clearActiveQuickSkill,
    quickSkillsProps,
  } = useAssistantSidebarQuickSkills({
    conversations,
    setConversations,
    activeConversationId,
    creationMode: composer.creationMode,
    onOpenEcommerceWorkflow,
    handleSend,
  });

  const {
    handleCreateConversation,
    handleSelectConversation,
    handleDeleteConversation,
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
    setPrompt: composer.setPrompt,
    setCreationMode: composer.setCreationMode,
    resetActiveQuickSkill: clearActiveQuickSkill,
    closeHistoryPopover,
  });

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
        if (traceStatus) pushLine(`Trace 状态: ${traceStatus}`);
        if (traceModel) pushLine(`生图模型: ${traceModel}`);
        if (previewImageCount !== null) {
          pushLine(`节点预览数: ${previewImageCount}`);
        }
        if (
          variantSummary &&
          typeof variantSummary.total === "number" &&
          typeof variantSummary.succeeded === "number"
        ) {
          pushLine(
            `变体结果: ${variantSummary.succeeded}/${variantSummary.total} 成功`,
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
        if (status) pushLine(`生成状态: ${status}`);
        if (elapsedMs !== null) pushLine(`耗时: ${elapsedMs}ms`);
        if (
          variantSummary &&
          typeof variantSummary.total === "number" &&
          typeof variantSummary.succeeded === "number"
        ) {
          pushLine(
            `变体结果: ${variantSummary.succeeded}/${variantSummary.total} 成功`,
          );
        }
        if (lastError) pushLine(`错误: ${lastError}`);
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
                control?.title || control?.id || "控件",
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
            `是否正在生成: ${
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
        if (requestId) pushLine(`请求 ID: ${requestId}`);
        if (traceStatus) pushLine(`Trace 状态: ${traceStatus}`);
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
        if (traceStatus) pushLine(`Trace 状态: ${traceStatus}`);
        if (traceModel) pushLine(`生图模型: ${traceModel}`);
        if (previewImageCount !== null) {
          pushLine(`节点预览数: ${previewImageCount}`);
        }
        if (
          variantSummary &&
          typeof variantSummary.total === "number" &&
          typeof variantSummary.succeeded === "number"
        ) {
          pushLine(
            `变体结果: ${variantSummary.succeeded}/${variantSummary.total} 成功`,
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
        if (status) pushLine(`生成状态: ${status}`);
        if (elapsedMs !== null) pushLine(`耗时: ${elapsedMs}ms`);
        if (
          variantSummary &&
          typeof variantSummary.total === "number" &&
          typeof variantSummary.succeeded === "number"
        ) {
          pushLine(
            `变体结果: ${variantSummary.succeeded}/${variantSummary.total} 成功`,
          );
        }
        if (lastError) pushLine(`错误: ${lastError}`);
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
              `${String(control?.title || control?.id || "控件")}: ${String(
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
        if (requestId) pushLine(`请求 ID: ${requestId}`);
        if (traceStatus) pushLine(`Trace 状态: ${traceStatus}`);
      } else if (actionLabel === "workspace.diagnose_generation_trace") {
        pushLine(
          readStringValue(toolResult?.summary) || "已完成一轮运行时诊断。",
        );
        readStringArrayValue(toolResult?.issues)
          .slice(0, 3)
          .forEach((issue) => pushLine(`诊断问题: ${issue}`));
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
          notes.slice(0, 3).forEach((note) => pushLine(`修复说明: ${note}`));
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
  const buildBrowserAgentSessionView = React.useCallback(
    (session: BrowserAgentSessionRecord | null) => {
      if (!session) return undefined;

      const steps = session.steps || [];
      const diagnosisSummary = readLatestDiagnosisSummary(session.metadata);
      const repairSummary = readLatestRepairSummary(session.metadata);
      const repairNotes = readLatestRepairNotes(session.metadata);
      const diagnosisIssues = readLatestDiagnosisIssues(session.metadata);
      const targetElementId =
        readStringValue(session.metadata?.targetElementId) || null;
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
        finalSummary && finalSummary !== text ? `总结: ${finalSummary}` : null,
        diagnosisSummary ? `诊断: ${diagnosisSummary}` : null,
        repairSummary ? `修复: ${repairSummary}` : null,
        diagnosisIssues[0] ? `问题: ${diagnosisIssues[0]}` : null,
        latestObservation?.summary ? `观察: ${latestObservation.summary}` : null,
        latestObservation?.nextAction?.id
          ? `下一步: ${latestObservation.nextAction.id}${
              latestObservation.nextAction.reason
                ? ` (${latestObservation.nextAction.reason})`
                : ""
            }`
          : null,
        latestObservation?.suggestions?.[0]
          ? `提示: ${latestObservation.suggestions[0]}`
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
          title: "\u6267\u884c\u4ee3\u7406",
          description: descriptionLines.join("\n") || undefined,
          isGenerating: status === "pending" || status === "running",
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
    ) => {
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
      const shouldUseBrowserAgentChat =
        chatEnabled &&
        composer.creationMode === "agent" &&
        !skillData;

      if (!shouldUseBrowserAgentChat) {
        return handleSendWithQuickSkill(
          overridePrompt,
          overrideAttachments,
          overrideWeb,
          skillData,
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
              ? "我先整理好了计划。当前判断这轮暂时不需要继续执行。"
              : "我先整理好了执行计划。你确认后我再开始真正执行。",
          agentData: {
            model: browserAgentModelLabel,
            title: "待确认计划",
            description: plan.rationaleSummary || plan.description,
            isGenerating: false,
          },
          timestamp: Date.now(),
        });
      } catch (error) {
        addMessage({
          id: `browser-agent-chat-error-${Date.now()}`,
          role: "model",
          text:
            error instanceof Error
              ? `执行代理启动失败：${error.message}`
              : `执行代理启动失败：${String(error || "未知错误")}`,
          timestamp: Date.now(),
          error: true,
        });
      } finally {
        setIsTyping(false);
      }
    },
    [
      addMessage,
      chatEnabled,
      clearPendingAttachments,
      composer.creationMode,
      buildBrowserAgentMessagePayload,
      buildUserAttachmentPayload,
      handleSendWithQuickSkill,
      handleStartGoalSession,
      setInputBlocks,
      setIsTyping,
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

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="absolute top-0 right-0 w-[480px] h-full min-h-0 bg-[#f8f9fc] border-l border-gray-200 shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-50 flex flex-col overflow-hidden"
    >
      <AssistantSidebarHeader
        title={activeConversationTitle}
        historyOpen={showHistoryPopover}
        historySearch={historySearch}
        setHistorySearch={setHistorySearch}
        conversations={conversations}
        activeConversationId={activeConversationId}
        filesOpen={showFileListModal}
        messages={messages}
        onPreview={setPreviewUrl}
        onToggleHistory={toggleHistoryPopover}
        onCreateConversation={handleCreateConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onToggleFiles={toggleFileListModal}
        onClose={() => setShowAssistant(false)}
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 no-scrollbar relative">
        <div className="space-y-4">
          <EcommerceWorkflowSummaryCard
            onOpen={onOpenEcommerceWorkflow}
            compact
          />
          {visibleMessages.length === 0 ? (
            <AssistantSidebarQuickSkills {...quickSkillsProps} />
          ) : (
            <MessageList
              onSend={handleSidebarSend}
              onSmartGenerate={handleSmartGenerate}
              onPreview={setPreviewUrl}
              clothingActions={clothingActions}
              ecommerceActions={ecommerceActions}
            />
          )}
          {preparedPlan ? (
            <AssistantSidebarPlanCard
              goal={preparedPlan.goal}
              plan={preparedPlan.plan}
              targetElementId={preparedPlan.targetElementId}
              targetElementPendingCreation={
                preparedPlan.targetElementPendingCreation
              }
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

      <AssistantSidebarStatusBanner
        label={currentTaskLabel}
        statusKey={currentTask?.status}
      />

      <div className="shrink-0 flex-shrink-0 border-t border-gray-100 bg-[#f8f9fc]">
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
          activeQuickSkill={activeQuickSkill}
          onClearQuickSkill={clearActiveQuickSkill}
        />
      </div>
    </motion.div>
  );
});
