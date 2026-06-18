import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Search,
  Eye,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  Wand2,
  Image as ImageIcon,
  Loader2,
  Globe,
  FileText,
  ExternalLink,
  GitBranch,
} from 'lucide-react';
import { ChatMessage } from '../../../types';
import { getAgentInfo } from '../../../services/agents';
import type { AgentType } from '../../../types/agent.types';
import { AgentBrowserSessionCard } from './AgentBrowserSessionCard';
import { MarkdownRenderer } from './MarkdownRenderer';
const ClothingStudioCards = lazy(async () => {
  const module = await import('./workflow/ClothingStudioCards');
  return { default: module.ClothingStudioCards };
});
const EcommerceOneClickCards = lazy(async () => {
  const module = await import('./workflow/EcommerceOneClickCards');
  return { default: module.EcommerceOneClickCards };
});
import type {
  EcommerceImageAnalysis,
  EcommerceOverlayState,
  EcommercePlanGroup,
  EcommerceRecommendedType,
  EcommerceResultItem,
  EcommerceSupplementField,
  Requirements,
  ModelGenOptions,
} from '../../../types/workflow.types';
import {
  deriveAgentMessageContent,
  deriveAgentMessageExecutionMode,
  deriveAgentMessageImageCards,
  deriveLiveUserFacingText,
  deriveAgentMessageOneClickView,
  deriveAgentMessagePlanningBlock,
  deriveAgentMessagePresentation,
  deriveAgentMessageResearchView,
  deriveThinkingSummary,
  deriveUserFacingAssistantText,
} from './AgentMessage.helpers';
import {
  getMessageVersionLabel,
  getMessageVersionSourceLabel,
} from '../conversationMeta';

export type AgentMessageClothingActionsProps = {
  onClothingSubmitRequirements?: (data: Requirements) => void;
  onClothingGenerateModel?: (data: ModelGenOptions) => void;
  onClothingPickModelCandidate?: (url: string) => void;
  onClothingInsertToCanvas?: (url: string, label?: string) => void;
  onClothingRetryFailed?: () => void;
};

export type AgentMessageEcommerceActionsProps = {
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
  onEcommerceOpenResultOverlayEditor?: (url: string) => void;
  onEcommerceCloseResultOverlayEditor?: () => void;
  onEcommerceSaveResultOverlayDraft?: (
    url: string,
    overlayState: EcommerceOverlayState | null,
  ) => Promise<void> | void;
  onEcommerceApplyResultOverlay?: (
    url: string,
    overlayState: EcommerceOverlayState | null,
  ) => Promise<void> | void;
  onEcommerceUploadResultOverlayFont?: (
    url: string,
    file: File,
  ) => Promise<void> | void;
  onEcommerceUploadResultOverlayIcon?: (
    url: string,
    file: File,
  ) => Promise<void> | void;
  onEcommerceResetResultOverlay?: (url: string) => Promise<void> | void;
  onEcommercePromoteResult?: (url: string) => void;
  onEcommercePromoteSelectedResults?: (urls: string[]) => void;
  onEcommerceDeleteResult?: (url: string) => void;
  onEcommerceConfirmPlans?: (groups: EcommercePlanGroup[]) => void;
  onEcommerceConfirmSupplements?: (fields: EcommerceSupplementField[]) => void;
  onEcommerceSelectModel?: (
    modelId: string,
    promptLanguage?: 'zh' | 'en' | 'auto',
  ) => void;
  onEcommerceSyncBatchPlanItemRatio?: (
    planItemId: string,
    ratio: string,
  ) => Promise<void> | void;
  onEcommerceSyncBatchPrompt?: (
    planItemId: string,
    prompt: string,
  ) => Promise<void> | void;
  onEcommerceRunBatchGenerate?: (
    promptOverrides?: Record<string, string>,
    options?: {
      promptOnly?: boolean;
      targetPlanItemIds?: string[];
      preserveExistingResults?: boolean;
    },
  ) => void;
  onEcommerceRetryFailedBatch?: () => void;
  onEcommerceInsertToCanvas?: (
    result: EcommerceResultItem | string,
    label?: string,
  ) => void;
};

const formatAgentIdentityLabel = (value: string | null | undefined) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '助手';
  if (
    normalized === 'coco' ||
    normalized === 'vireo' ||
    normalized === 'cameron' ||
    normalized === 'poster' ||
    normalized === 'package' ||
    normalized === 'motion' ||
    normalized === 'campaign' ||
    normalized === 'prompt-optimizer'
  ) {
    try {
      const agentName = getAgentInfo(normalized as AgentType).name || '';
      if (!agentName || agentName.toLowerCase() === 'coco') {
        return normalized === 'prompt-optimizer' ? '提示词优化' : '助手';
      }
      return agentName;
    } catch {
      return normalized === 'prompt-optimizer' ? '提示词优化' : '助手';
    }
  }
  return value || '助手';
};

interface AgentMessageProps {
  message: ChatMessage;
  versionSiblings?: ChatMessage[];
  activeVersionIndex?: number;
  onPreview: (url: string) => void;
  onAction?: (action: string) => void;
  onSmartGenerate?: (prompt: string, proposalId?: string) => void;
  onReuseToComposer?: (message: ChatMessage) => void | Promise<void>;
  onRetryResponse?: (message: ChatMessage) => void | Promise<void>;
  onFeedback?: (
    message: ChatMessage,
    feedback: ChatMessage["feedback"],
  ) => void | Promise<void>;
  onBranchConversation?: (message: ChatMessage) => void | Promise<void>;
  clothingActions?: AgentMessageClothingActionsProps;
  ecommerceActions?: AgentMessageEcommerceActionsProps;
}

export const AgentMessage: React.FC<AgentMessageProps> = ({
  message,
  versionSiblings = [],
  activeVersionIndex = -1,
  onPreview,
  onAction,
  onSmartGenerate,
  onReuseToComposer,
  onRetryResponse,
  onFeedback,
  onBranchConversation,
  clothingActions,
  ecommerceActions,
}) => {
  const {
    onClothingSubmitRequirements,
    onClothingGenerateModel,
    onClothingPickModelCandidate,
    onClothingInsertToCanvas,
    onClothingRetryFailed,
  } = clothingActions || {};

  const {
    onEcommerceConfirmTypes,
    onEcommerceRefineAnalysis,
    onEcommerceConfirmImageAnalyses,
    onEcommerceRetryImageAnalysis,
    onEcommerceRewritePlanPrompt,
    onEcommerceGenerateExtraPlanItem,
    onEcommerceGeneratePlanItem,
    onEcommerceOpenResultOverlayEditor,
    onEcommerceCloseResultOverlayEditor,
    onEcommerceSaveResultOverlayDraft,
    onEcommerceApplyResultOverlay,
    onEcommerceUploadResultOverlayFont,
    onEcommerceUploadResultOverlayIcon,
    onEcommerceResetResultOverlay,
    onEcommercePromoteResult,
    onEcommercePromoteSelectedResults,
    onEcommerceDeleteResult,
    onEcommerceConfirmPlans,
    onEcommerceConfirmSupplements,
    onEcommerceSelectModel,
    onEcommerceSyncBatchPlanItemRatio,
    onEcommerceSyncBatchPrompt,
    onEcommerceRunBatchGenerate,
    onEcommerceRetryFailedBatch,
    onEcommerceInsertToCanvas,
  } = ecommerceActions || {};

  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false);
  const [isPlanningExpanded, setIsPlanningExpanded] = useState(false);
  const [isResearchSourcesExpanded, setIsResearchSourcesExpanded] =
    useState(false);
  const [isResearchExtractsExpanded, setIsResearchExtractsExpanded] =
    useState(false);
  const [activeResearchCitationId, setActiveResearchCitationId] =
    useState<string | null>(null);
  const researchFloatingAreaRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const currentFeedback = message.feedback || null;
  const previousVersion =
    activeVersionIndex > 0 ? versionSiblings[activeVersionIndex - 1] : null;
  const nextVersion =
    activeVersionIndex >= 0 && activeVersionIndex < versionSiblings.length - 1
      ? versionSiblings[activeVersionIndex + 1]
      : null;
  const versionLabel = getMessageVersionLabel(message);
  const versionSourceLabel = getMessageVersionSourceLabel(message.lineage);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToVersion = (targetMessageId: string | null | undefined) => {
    const normalizedMessageId = String(targetMessageId || '').trim();
    if (!normalizedMessageId) return;
    document
      .getElementById(`chat-message-${normalizedMessageId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleFeedback = (
    nextFeedback: NonNullable<ChatMessage["feedback"]>,
  ) => {
    void onFeedback?.(
      message,
      currentFeedback === nextFeedback ? null : nextFeedback,
    );
  };

  useEffect(() => {
    if (!isResearchSourcesExpanded && !isResearchExtractsExpanded) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (researchFloatingAreaRef.current?.contains(target)) return;
      setIsResearchSourcesExpanded(false);
      setIsResearchExtractsExpanded(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsResearchSourcesExpanded(false);
      setIsResearchExtractsExpanded(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isResearchExtractsExpanded, isResearchSourcesExpanded]);

  const { cleanText, proposals } = useMemo(
    () => deriveAgentMessageContent(message),
    [message],
  );

  const agentData = message.agentData;
  const browserSession = agentData?.browserSession;

  const imageCards = useMemo(
    () => deriveAgentMessageImageCards(agentData),
    [agentData],
  );

  const executionMode = useMemo(
    () => deriveAgentMessageExecutionMode(agentData),
    [agentData],
  );

  const oneClickView = useMemo(
    () => deriveAgentMessageOneClickView(cleanText, message),
    [cleanText, message],
  );

  const planningBlock = useMemo(
    () => deriveAgentMessagePlanningBlock(cleanText),
    [cleanText],
  );

  const researchView = useMemo(
    () => deriveAgentMessageResearchView(message),
    [message],
  );
  const activeResearchCitation = useMemo(() => {
    if (!researchView?.citations.length || !activeResearchCitationId) return null;
    return (
      researchView.citations.find((item) => item.id === activeResearchCitationId) || null
    );
  }, [activeResearchCitationId, researchView]);
  const researchOutcomeSummary = useMemo(() => {
    if (!researchView) return '';
    if (researchView.status === 'failed') {
      return '本轮研究未成功完成，以下仅保留已拿到的线索。';
    }
    if (researchView.status === 'searching') {
      return '正在收集网页与正文证据，完成后会自动整理成结论。';
    }
    const parts = researchView.stats.map((item) => `${item.value} 个${item.label}`);
    if (parts.length === 0) {
      return '已完成联网检索，并整理出可引用的结论。';
    }
    return `本次研究包含 ${parts.join('、')}。`;
  }, [researchView]);
  const isResearchSearching = researchView?.status === 'searching';
  const isResearchCompleted = researchView?.status === 'completed';
  const presentationView = useMemo(
    () => deriveAgentMessagePresentation(agentData),
    [agentData],
  );

  const visibleText = planningBlock?.visibleText || cleanText;
  const sanitizedVisibleText = visibleText
    .replace(/(^|\n)你的专属设计助手，帮你找到最合适的专家(?=\n|$)/g, '$1')
    .trim();
  const isWorkflowUi = message.kind === 'workflow_ui' && !!message.workflowUi;
  const workflowType = message.workflowUi?.type || '';
  const isClothingWorkflowUi = workflowType.startsWith('clothingStudio.');
  const isEcommerceWorkflowUi = workflowType.startsWith('ecomOneClick.');
  const analysisPanelTitle = presentationView?.detailTitle || '查看思考过程';
  const presentationStatusLabel = presentationView?.statusLabel || null;
  const executionTrace = agentData?.executionTrace;
  const liveStreamingText = String(executionTrace?.streamingText || '').trim();
  const liveProgressMessage = String(executionTrace?.progressMessage || '').trim();
  const liveReasoningText = String(executionTrace?.reasoningText || "").trim();
  const liveUserFacingText = deriveLiveUserFacingText(
    liveStreamingText,
    liveReasoningText,
    liveProgressMessage,
  );
  const liveThinkingSummary = deriveThinkingSummary(
    liveReasoningText,
    liveProgressMessage,
  );
  const isLiveStreamingReply =
    (executionTrace?.status === "analyzing" ||
      executionTrace?.status === "executing") &&
    !isWorkflowUi &&
    (Boolean(liveReasoningText) ||
      Boolean(liveStreamingText) ||
      Boolean(liveProgressMessage));
  const liveStatusLabel =
    executionTrace?.status === 'executing' ? '正在回复' : '正在思考';
  const liveStepLabel =
    typeof executionTrace?.progressStep === 'number' &&
    typeof executionTrace?.totalSteps === 'number' &&
    executionTrace.totalSteps > 0
      ? `${executionTrace.progressStep}/${executionTrace.totalSteps}`
      : null;
  const isFailedReply = Boolean(
    message.error ||
      executionTrace?.status === 'failed' ||
      presentationStatusLabel === '失败',
  );
  const analysisContent =
    agentData?.analysis ||
    (presentationView?.kind === 'execution_plan' ? agentData?.description || '' : '');
  const sanitizedAnalysisContent = deriveThinkingSummary(
    String(analysisContent || ''),
    '',
  );
  const safeAssistantBodyText = deriveUserFacingAssistantText(
    sanitizedVisibleText,
    agentData,
  );
  const assistantBodyParagraphs = useMemo(
    () =>
      safeAssistantBodyText
        .split(/\n{2,}/)
        .map((item) => item.trim())
        .filter(Boolean),
    [safeAssistantBodyText],
  );
  const assistantAnswerSegments = useMemo(
    () =>
      Array.isArray(agentData?.answerSegments)
        ? agentData.answerSegments
            .map((item) =>
              item && typeof item === 'object'
                ? {
                    text: String(item.text || '').trim(),
                    citationOrdinals: Array.isArray(item.citationOrdinals)
                      ? item.citationOrdinals
                          .map((value) => Number(value))
                          .filter((value) => Number.isInteger(value) && value > 0)
                      : [],
                  }
                : null,
            )
            .filter((item) => Boolean(item?.text))
        : [],
    [agentData?.answerSegments],
  );
  const executionModeBadgeLabel =
    presentationView?.modeLabel ||
    (executionMode === 'true_edit'
      ? '定向编辑'
      : executionMode === 'reference_guided_generate'
        ? '参考出图'
        : executionMode === 'generate'
          ? '生成'
          : null);
  const modelLabel = formatAgentIdentityLabel(agentData?.model || 'AI');
  const failureReason = sanitizedVisibleText || '这次回复没有成功完成。';
  const failureRecoveryHint = onRetryResponse
    ? '可以先重试；如果同样失败，回填后补充更明确的要求再继续。'
    : '建议回填到输入框，补充更明确的要求后继续。';

  return (
    <div className="group inline-block max-w-full align-top">
      <div className="overflow-visible px-0.5 py-0.5">
        <div className="mb-1 flex justify-start px-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium text-gray-400">
              {new Date(message.timestamp).toLocaleDateString('zh-CN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            {versionLabel ? (
              <span className="rounded-full border border-slate-200/70 bg-white/75 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {versionLabel}
              </span>
            ) : null}
            {versionSourceLabel ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                {versionSourceLabel}
              </span>
            ) : null}
            {versionSiblings.length > 1 ? (
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 bg-white/75 px-1 py-0.5 text-[10px] text-slate-500">
                <button
                  type="button"
                  onClick={() => scrollToVersion(previousVersion?.id)}
                  disabled={!previousVersion}
                  className="rounded-full px-1.5 py-0.5 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一版
                </button>
                <span className="px-0.5 text-slate-400">
                  {activeVersionIndex + 1}/{versionSiblings.length}
                </span>
                <button
                  type="button"
                  onClick={() => scrollToVersion(nextVersion?.id)}
                  disabled={!nextVersion}
                  className="rounded-full px-1.5 py-0.5 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一版
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex max-w-full flex-col gap-1.5">
          {isFailedReply ? (
            <div className="px-1">
              <div className="rounded-[18px] border border-rose-200/85 bg-white/96 px-3 py-2.5 shadow-[0_16px_36px_-30px_rgba(190,24,93,0.26)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50/90 px-2.5 py-1 text-[10px] font-semibold text-rose-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      回复失败
                    </div>
                    <div className="mt-1.5 text-[12.5px] font-medium leading-[1.75] text-slate-900">
                      {failureReason}
                    </div>
                    <div className="mt-1.5 text-[11px] leading-5 text-slate-500">
                      {failureRecoveryHint}
                    </div>
                  </div>
                  <div className="rounded-full border border-rose-100 bg-rose-50/80 p-2 text-rose-400">
                    <Loader2 size={14} strokeWidth={2} />
                  </div>
                </div>
                {(onRetryResponse || onReuseToComposer) && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {onRetryResponse ? (
                      <button
                        type="button"
                        onClick={() => void onRetryResponse(message)}
                        className="inline-flex h-8 items-center justify-center rounded-full border border-rose-200 bg-rose-600 px-3.5 text-[11px] font-semibold text-white transition hover:border-rose-300 hover:bg-rose-700"
                      >
                        立即重试
                      </button>
                    ) : null}
                    {onReuseToComposer ? (
                      <button
                        type="button"
                        onClick={() => void onReuseToComposer(message)}
                        className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        回填后继续
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-0.5 flex flex-wrap gap-1.5 px-0.5">
              {message.attachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/82 px-2.5 py-1 text-[10px] font-medium whitespace-nowrap text-slate-500 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.16)]"
                >
                  <ImageIcon size={10} className="text-gray-400" />
                  <span>{`参考图 ${i + 1}`}</span>
                </div>
              ))}
            </div>
          )}

        {researchView && (
          <div className="px-1" data-testid="agent-research-message">
            <div
              data-testid="agent-research-shell"
              className="overflow-visible border-l-2 border-sky-200/85 pl-3"
            >
              <div className="py-1.5" data-testid="agent-research-summary">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0 rounded-full bg-sky-50/80 p-1.5 text-sky-500">
                    <Search size={11} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          researchView.status === 'failed'
                            ? 'border-rose-100 bg-rose-50 text-rose-700'
                            : researchView.status === 'searching'
                              ? 'border-amber-100 bg-amber-50 text-amber-700'
                              : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {researchView.statusLabel}
                      </span>
                      {researchView.providerLabel ? (
                        <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/78 px-2 py-0.5 text-[10px] text-slate-500">
                          {researchView.providerLabel}
                        </span>
                      ) : null}
                      {researchView.fallback && (
                        <span className="inline-flex rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                          备用结果
                        </span>
                      )}
                      {isResearchCompleted
                        ? researchView.stats.map((stat) => (
                            <span
                              key={`${stat.label}-${stat.value}`}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200/55 bg-white/72 px-2 py-0.5 text-[10px] text-slate-500"
                            >
                              <span>{stat.label}</span>
                              <span className="font-semibold text-slate-700">{stat.value}</span>
                            </span>
                          ))
                        : null}
                    </div>
                    {researchView.query ? (
                      <div className="mt-0.5 line-clamp-1 text-[12.5px] font-semibold leading-5 text-slate-800">
                        {researchView.query}
                      </div>
                    ) : null}
                    <div className="mt-0.5 line-clamp-1 text-[11px] leading-5 text-slate-500">
                      {researchOutcomeSummary}
                    </div>
                  </div>
                </div>

                {isResearchSearching && researchView.steps.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1" data-testid="agent-research-steps">
                    {researchView.steps.map((step) => (
                      <span
                        key={step.key}
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-medium transition ${
                          step.status === 'current'
                            ? 'border-sky-200 bg-sky-50 text-sky-700'
                            : step.status === 'done'
                              ? 'border-emerald-100/90 bg-emerald-50/90 text-emerald-700'
                              : step.status === 'error'
                                ? 'border-rose-100 bg-rose-50 text-rose-700'
                                : 'border-slate-200/60 bg-white/70 text-slate-500'
                        }`}
                      >
                        {step.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {(researchView.citations.length > 0 ||
                researchView.extractedPages.length > 0 ||
                researchView.suggestedQueries.length > 0) && (
                <div
                  className="pb-1 pt-1"
                  data-testid="agent-research-evidence"
                >
                  <div
                    ref={researchFloatingAreaRef}
                    className="relative"
                    data-testid="agent-research-floating-area"
                  >
                    <div className="flex flex-wrap items-center gap-1">
                      {researchView.citations.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsResearchSourcesExpanded((value) => !value);
                            setIsResearchExtractsExpanded(false);
                          }}
                          className={`inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-[10px] font-medium transition ${
                            isResearchSourcesExpanded
                              ? 'border-sky-200 bg-sky-50/90 text-sky-700'
                              : 'border-slate-200/65 bg-white/78 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-800'
                          }`}
                        >
                          <ExternalLink size={11} />
                          来源
                          <span className="text-slate-400">
                            {researchView.citations.length}
                          </span>
                        </button>
                      )}
                      {researchView.extractedPages.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsResearchExtractsExpanded((value) => !value);
                            setIsResearchSourcesExpanded(false);
                          }}
                          className={`inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-[10px] font-medium transition ${
                            isResearchExtractsExpanded
                              ? 'border-sky-200 bg-sky-50/90 text-sky-700'
                              : 'border-slate-200/60 bg-white/76 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700'
                          }`}
                        >
                          <FileText size={11} />
                          摘录
                          {researchView.extractedPages.length > 0 ? (
                            <span className="text-slate-400">
                              {researchView.extractedPages.length}
                            </span>
                          ) : null}
                        </button>
                      )}
                    </div>

                    <AnimatePresence initial={false}>
                      {isResearchSourcesExpanded && researchView.citations.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className="absolute left-0 top-full z-10 mt-1.5 w-[min(100%,280px)]"
                        >
                          <div
                            className="rounded-[14px] border border-slate-200/65 bg-white/96 p-1.5 shadow-[0_18px_32px_-24px_rgba(15,23,42,0.16)] backdrop-blur-md"
                            data-testid="agent-research-source-list"
                          >
                            <div className="mb-1.5 flex items-center gap-2 px-1">
                              <div className="text-[10px] font-semibold text-slate-700">
                                来源
                              </div>
                              <div className="text-[9.5px] text-slate-400">
                                {researchView.citations.length}
                              </div>
                            </div>
                            <div className="space-y-1">
                              {researchView.citations.slice(0, 5).map((citation, index) => (
                                <a
                                  key={citation.id}
                                  href={citation.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onMouseEnter={() => setActiveResearchCitationId(citation.id)}
                                  className={`block rounded-[10px] border px-2 py-1 transition ${
                                    activeResearchCitation?.id === citation.id
                                      ? 'border-sky-200 bg-sky-50/55'
                                      : 'border-slate-200/75 bg-white/88 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-100 px-1 text-[9.5px] font-semibold text-slate-700">
                                      {index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-[10px] font-medium text-slate-800">
                                        {citation.title}
                                      </div>
                                      <div className="truncate text-[9.5px] text-slate-500">
                                        {citation.siteName || citation.host}
                                      </div>
                                    </div>
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {isResearchExtractsExpanded && researchView.extractedPages.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className="absolute left-0 top-full z-10 mt-1.5 w-[min(100%,280px)]"
                        >
                          <div
                            className="rounded-[14px] border border-slate-200/65 bg-white/96 p-1.5 shadow-[0_18px_32px_-24px_rgba(15,23,42,0.16)] backdrop-blur-md"
                            data-testid="agent-research-extracts"
                          >
                            <div className="mb-1.5 flex items-center gap-2 px-1">
                              <div className="text-[10px] font-semibold text-slate-700">
                                摘录
                              </div>
                              <div className="text-[9.5px] text-slate-400">
                                {researchView.extractedPages.length}
                              </div>
                            </div>
                            <div className="space-y-1">
                              {researchView.extractedPages.slice(0, 4).map((page, index) => (
                                <div
                                  key={page.id}
                                  className="rounded-[10px] border border-slate-200/75 bg-white/88 px-2 py-1"
                                >
                                  <div className="truncate text-[10px] font-medium text-slate-800">
                                    {index + 1}. {page.title}
                                  </div>
                                  <div className="mt-1 line-clamp-1 text-[9.5px] leading-4 text-slate-500">
                                    {page.cleanedTextExcerpt || page.excerpt || '暂无正文摘录'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {isLiveStreamingReply ? (
          <div className="px-1">
            <div className="overflow-hidden rounded-2xl border border-sky-100/60 bg-white/70">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="inline-flex items-center gap-2 text-[11px] font-medium text-sky-700">
                  <Loader2 size={12} className="animate-spin" strokeWidth={2.2} />
                  <span>{liveStatusLabel}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                  {liveStepLabel ? (
                    <span className="rounded-full border border-sky-100 bg-white/80 px-2 py-0.5 font-medium text-sky-700">
                      {liveStepLabel}
                    </span>
                  ) : null}
                  {liveProgressMessage ? (
                    <span className="max-w-[220px] truncate">{liveProgressMessage}</span>
                  ) : null}
                </div>
              </div>
              <div className="border-t border-sky-100/50 px-3 py-3">
                {liveUserFacingText ? (
                  <div className="agent-msg-text break-words">
                    <MarkdownRenderer
                      text={liveUserFacingText}
                      className="text-[13px] font-medium tracking-[0.01em] leading-[1.8] text-slate-900 [&_p]:font-medium [&_strong]:text-slate-950"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[12px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400 [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300 [animation-delay:240ms]" />
                    </span>
                    <span>{liveProgressMessage || '正在思考...'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {safeAssistantBodyText &&
          !isLiveStreamingReply &&
          oneClickView.sections.length === 0 &&
          !isFailedReply && (
          <div
            className={`agent-msg-text break-words px-1 ${
              message.error
                ? 'mt-1 rounded-xl border border-red-100 bg-red-50 p-2.5 text-red-600'
                : ''
            }`}
          >
            {assistantAnswerSegments.length > 0 && researchView?.citations.length ? (
              <div className="px-1 py-0.5">
                {assistantAnswerSegments.map((segment, segmentIndex) => {
                  const segmentCitations = segment.citationOrdinals
                    .map((ordinal) => ({
                      ordinal,
                      citation: researchView.citations[ordinal - 1] || null,
                    }))
                    .filter((item) => item.citation);

                  return (
                    <div
                      key={`assistant-segment-${segmentIndex}`}
                      className={`${
                        segmentIndex === 0
                          ? 'pb-2'
                          : 'pt-2'
                      }`}
                    >
                      <MarkdownRenderer
                        text={segment.text}
                        className={
                          segmentIndex === 0
                            ? 'text-[13px] font-medium tracking-[0.01em] leading-[1.84] text-slate-900 [&_p]:mb-0 [&_p]:font-medium [&_strong]:font-semibold [&_strong]:text-slate-950'
                            : 'text-[13px] font-medium tracking-[0.01em] leading-[1.8] text-slate-900 [&_p]:mb-0 [&_p]:font-medium [&_strong]:font-semibold [&_strong]:text-slate-950'
                        }
                      />
                      {segmentCitations.length > 0 ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {segmentCitations.map(({ ordinal, citation }) => (
                            <button
                              key={`${citation!.id}-${ordinal}`}
                              type="button"
                              onClick={() => {
                                setActiveResearchCitationId(citation!.id);
                                setIsResearchExtractsExpanded(false);
                                setIsResearchSourcesExpanded(true);
                              }}
                              className={`inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full border px-1.5 text-[9px] font-semibold transition ${
                                activeResearchCitation?.id === citation!.id
                                  ? 'border-sky-200 bg-sky-50 text-sky-700'
                                  : 'border-slate-200/80 bg-white/96 text-slate-500 hover:border-slate-300 hover:text-slate-800'
                              }`}
                              title={citation!.host}
                            >
                              {ordinal}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <MarkdownRenderer
                text={safeAssistantBodyText}
                className="text-[13px] font-medium tracking-[0.01em] leading-[1.8] text-slate-900 [&_p]:font-medium [&_strong]:font-semibold [&_strong]:text-slate-950"
              />
            )}
          </div>
        )}

        {liveThinkingSummary && isLiveStreamingReply && !analysisContent ? (
          <div className="px-1">
            <div className="overflow-hidden rounded-[18px] border border-slate-200/75 bg-white/82 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.16)] backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setIsPlanningExpanded((value) => !value)}
                className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-white/90"
              >
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-slate-600">
                    查看思考过程
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">
                    {liveThinkingSummary}
                  </div>
                </div>
                <div className="mt-0.5 shrink-0 text-slate-400">
                  {isPlanningExpanded ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </div>
              </button>
              <AnimatePresence initial={false}>
                {isPlanningExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="border-t border-slate-200/70"
                  >
                    <div className="px-3 py-3 whitespace-pre-wrap text-[12px] leading-6 text-slate-600">
                      {liveThinkingSummary}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : null}

        {planningBlock &&
          !isLiveStreamingReply &&
          !analysisContent &&
          oneClickView.sections.length === 0 && (
          <div className="px-1">
            <div className="overflow-hidden rounded-[18px] border border-slate-200/75 bg-white/82 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.16)] backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setIsPlanningExpanded((value) => !value)}
                className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-white/90"
              >
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-slate-600">
                    查看思考过程
                  </div>
                  {planningBlock.previewLines.length > 0 && (
                    <div className="mt-1 text-[11px] leading-5 text-slate-500">
                      {planningBlock.previewLines.join('  ·  ')}
                    </div>
                  )}
                </div>
                <div className="mt-0.5 shrink-0 text-slate-400">
                  {isPlanningExpanded ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </div>
              </button>
              <AnimatePresence initial={false}>
                {isPlanningExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="border-t border-slate-200/70"
                  >
                    <div className="px-3 py-3">
                      <MarkdownRenderer
                        text={planningBlock.hiddenText}
                        className="text-[12px]"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {browserSession && (
          <div className="mt-1 px-1">
            <AgentBrowserSessionCard
              session={browserSession}
              onPreview={onPreview}
            />
          </div>
        )}

        {isWorkflowUi && message.workflowUi && (
          <div className="mt-1 px-1">
            <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[12px] text-slate-500">正在加载工作流卡片…</div>}>
              {isClothingWorkflowUi ? (
                <ClothingStudioCards
                  message={message.workflowUi}
                  onSubmitRequirements={(data) =>
                    onClothingSubmitRequirements?.(data)
                  }
                  onGenerateModel={(data) => onClothingGenerateModel?.(data)}
                  onPickModelCandidate={(url) =>
                    onClothingPickModelCandidate?.(url)
                  }
                  onInsertToCanvas={(url, label) =>
                    onClothingInsertToCanvas?.(url, label)
                  }
                  onRetryFailed={() => onClothingRetryFailed?.()}
                />
              ) : null}

              {isEcommerceWorkflowUi ? (
                <EcommerceOneClickCards
                  message={message.workflowUi}
                  onRefineAnalysis={(feedback) =>
                    onEcommerceRefineAnalysis?.(feedback)
                  }
                  onConfirmTypes={(items) => onEcommerceConfirmTypes?.(items)}
                  onConfirmImageAnalyses={(items) =>
                    onEcommerceConfirmImageAnalyses?.(items)
                  }
                  onRetryImageAnalysis={(imageId) =>
                    onEcommerceRetryImageAnalysis?.(imageId)
                  }
                  onRewritePlanPrompt={(groups, planItemId, feedback) =>
                    onEcommerceRewritePlanPrompt?.(
                      groups,
                      planItemId,
                      feedback,
                    ) ?? Promise.resolve(null)
                  }
                  onGeneratePlanItem={(groups, planItemId) =>
                    onEcommerceGeneratePlanItem?.(groups, planItemId) ??
                    Promise.resolve()
                  }
                  onGenerateExtraPlanItem={(groups, typeId) =>
                    onEcommerceGenerateExtraPlanItem?.(groups, typeId) ??
                    Promise.resolve()
                  }
                  onOpenResultOverlayEditor={(url) =>
                    onEcommerceOpenResultOverlayEditor?.(url)
                  }
                  onCloseResultOverlayEditor={() =>
                    onEcommerceCloseResultOverlayEditor?.()
                  }
                  onSaveResultOverlayDraft={(url, overlayState) =>
                    onEcommerceSaveResultOverlayDraft?.(url, overlayState) ??
                    Promise.resolve()
                  }
                onApplyResultOverlay={(url, overlayState) =>
                  onEcommerceApplyResultOverlay?.(url, overlayState) ??
                  Promise.resolve()
                }
                onUploadResultOverlayFont={(url, file) =>
                  onEcommerceUploadResultOverlayFont?.(url, file) ??
                  Promise.resolve()
                }
                onUploadResultOverlayIcon={(url, file) =>
                  onEcommerceUploadResultOverlayIcon?.(url, file) ??
                  Promise.resolve()
                }
                onResetResultOverlay={(url) =>
                  onEcommerceResetResultOverlay?.(url) ?? Promise.resolve()
                }
                onPromoteResult={(url) => onEcommercePromoteResult?.(url)}
                onPromoteSelectedResults={(urls) =>
                  onEcommercePromoteSelectedResults?.(urls)
                }
                onDeleteResult={(url) => onEcommerceDeleteResult?.(url)}
                onConfirmPlans={(groups) => onEcommerceConfirmPlans?.(groups)}
                onConfirmSupplements={(fields) =>
                  onEcommerceConfirmSupplements?.(fields)
                }
                onSelectModel={(modelId, promptLanguage) =>
                  onEcommerceSelectModel?.(modelId, promptLanguage)
                }
                onSyncBatchPlanItemRatio={(planItemId, ratio) =>
                  onEcommerceSyncBatchPlanItemRatio?.(planItemId, ratio)
                }
                onSyncBatchPrompt={(planItemId, prompt) =>
                  onEcommerceSyncBatchPrompt?.(planItemId, prompt)
                }
                onRunBatchGenerate={(promptOverrides, options) =>
                  onEcommerceRunBatchGenerate?.(promptOverrides, options)
                }
                onRetryFailedBatch={() => onEcommerceRetryFailedBatch?.()}
                onInsertToCanvas={(url, label) =>
                  onEcommerceInsertToCanvas?.(url, label)
                }
                />
              ) : null}
            </Suspense>
          </div>
        )}

        {oneClickView.sections.length > 0 && (
          <div className="mt-1 space-y-1.5 px-1">
            {oneClickView.intro && (
              <div className="rounded-[16px] border border-slate-200/75 bg-white/82 px-3 py-2.5 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.14)] backdrop-blur-sm">
                <MarkdownRenderer
                  text={oneClickView.intro}
                  className="text-[12px]"
                />
              </div>
            )}
            {oneClickView.sections.map((section, idx) => (
              <details
                key={`${section.title}-${idx}`}
                className="rounded-[16px] border border-slate-200/75 bg-white/86 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.14)] backdrop-blur-sm"
                open={idx < 2}
              >
                <summary className="cursor-pointer select-none px-3 py-2.5 text-[12px] font-semibold text-slate-800">
                  {section.title}
                </summary>
                <div className="border-t border-slate-200/70 px-3 py-2.5">
                  <MarkdownRenderer text={section.body} className="text-[12px]" />
                </div>
              </details>
            ))}
          </div>
        )}

        {!isLiveStreamingReply && sanitizedAnalysisContent ? (
          <div className="px-1">
            <button
              onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
              className="group/btn inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/82 px-2.5 py-1 text-[11px] transition-all hover:border-slate-300 hover:bg-white"
            >
              <Search
                size={11}
                className="text-slate-400 transition-colors group-hover/btn:text-slate-600"
              />
              <span className="font-medium text-slate-500 transition-colors group-hover/btn:text-slate-800">
                {analysisPanelTitle}
              </span>
              {isAnalysisExpanded ? (
                <ChevronUp size={11} className="text-slate-400" />
              ) : (
                <ChevronDown size={11} className="text-slate-400" />
              )}
            </button>

            <AnimatePresence>
              {isAnalysisExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-[18px] border border-slate-200/75 bg-white/82 px-3 py-3 whitespace-pre-wrap text-[12px] leading-6 text-slate-600 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.16)] backdrop-blur-sm">
                    {sanitizedAnalysisContent}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : null}

        {!isLiveStreamingReply && proposals.length > 0 && (
          <div className="mb-1 flex flex-col gap-1.5">
            {proposals.map((prop, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group/card overflow-hidden rounded-[18px] border border-slate-200/75 bg-white/86 p-3 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.18)] backdrop-blur-sm transition-all hover:border-slate-300 hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.2)]"
              >
                {(prop.previewUrl || prop.concept_image) && (
                  <div className="group/preview relative mb-2.5 aspect-video overflow-hidden rounded-[14px] border border-slate-200/75 bg-slate-50/70">
                    <img
                      src={prop.previewUrl || prop.concept_image}
                      alt="方案预览"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/5 transition-colors group-hover/card:bg-transparent" />
                  </div>
                )}

                <div className="mb-1.5 flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 text-[12px] font-bold text-slate-900">
                    <Sparkles size={11} className="text-blue-500" />
                    {prop.title || `方案 ${idx + 1}`}
                  </h4>
                  <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[8px] font-bold tracking-[0.08em] text-blue-600">
                    方案提案
                  </span>
                </div>

                <p className="mb-3 text-[11px] leading-[1.55] font-normal text-slate-500">
                  {prop.description}
                </p>

                {(() => {
                  const promptFromSkillCall = prop.skillCalls?.find(
                    (skillCall) => skillCall?.skillName === 'generateImage',
                  )?.params?.prompt;
                  const prompt =
                    prop.prompt ||
                    (typeof prop.skillCalls?.[0]?.params?.prompt === 'string'
                      ? prop.skillCalls[0]?.params?.prompt
                      : '') ||
                    (typeof promptFromSkillCall === 'string'
                      ? promptFromSkillCall
                      : '') ||
                    '';
                  const canGenerate = Boolean(onSmartGenerate && prompt);

                  return canGenerate ? (
                    <button
                      onClick={() => onSmartGenerate?.(prompt, prop.id)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-900 py-2 text-[11px] font-semibold text-white shadow-[0_12px_24px_-18px_rgba(15,23,42,0.32)] transition-all hover:bg-black active:scale-[0.98]"
                    >
                      <Wand2 size={11} strokeWidth={2.5} />
                      立即生成
                    </button>
                  ) : (
                    <div className="flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-slate-200 bg-slate-50/80 py-2 text-[11px] font-semibold text-slate-400">
                      <Wand2 size={11} strokeWidth={2.5} />
                      无可执行生成动作
                    </div>
                  );
                })()}
              </motion.div>
            ))}
          </div>
        )}

        {!isLiveStreamingReply &&
        (agentData?.model || proposals.length > 0 || presentationStatusLabel) ? (
          <div className="flex items-center justify-start gap-1 px-1 opacity-75">
            {presentationStatusLabel ? (
              <span className="rounded-full border border-slate-200/70 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {presentationStatusLabel}
              </span>
            ) : null}
            {(agentData?.model || proposals.length > 0) ? (
              <div className="flex items-center gap-1 text-slate-400">
                <Eye size={11} strokeWidth={2.2} />
                <span className="text-[10px] font-medium tracking-tight text-slate-400">
                  {modelLabel}
                </span>
              </div>
            ) : null}
            {executionModeBadgeLabel ? (
              <span className="rounded-full border border-slate-200/70 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                {executionModeBadgeLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        {imageCards.length > 0 && (
          <div className="mt-1 px-1">
            {imageCards.length === 1 ? (
              <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-gray-100/70">
                <img
                  src={imageCards[0].url}
                  alt={imageCards[0].title || '生成结果预览'}
                  className="h-auto max-h-[300px] w-full max-w-full cursor-zoom-in object-contain transition hover:opacity-95"
                  onClick={() => onPreview(imageCards[0].url)}
                />
                <div className="border-t border-gray-100 bg-white/80 px-2 py-1.5 text-[11px] text-gray-600">
                  {imageCards[0].title}
                </div>
              </div>
            ) : (
              <div
                className={`grid gap-1.5 ${
                  imageCards.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'
                }`}
              >
                {imageCards.map((card, i) => (
                  <div
                    key={i}
                    className="relative aspect-square overflow-hidden rounded-lg border border-gray-100 bg-gray-50"
                  >
                    <img
                      src={card.url}
                      className="h-full max-h-[300px] w-full max-w-full cursor-zoom-in object-contain transition hover:opacity-95"
                      onClick={() => onPreview(card.url)}
                    />
                    <div className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[10px] text-white">
                      {card.title}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {agentData?.isGenerating && imageCards.length === 0 && (
          <div className="mt-1 px-1">
            <div className="relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-gray-100 bg-gray-100/70">
              <Loader2
                size={24}
                className="animate-spin text-gray-400"
                strokeWidth={2.5}
              />
              <span className="text-[12px] font-medium tracking-wider text-gray-500">
                正在使用{' '}
                <span className="font-bold text-gray-600 uppercase">
                  {agentData.model || 'AI'}
                </span>{' '}
                生成中...
              </span>
            </div>
          </div>
        )}

        </div>
      </div>

      {!isLiveStreamingReply ? (
        <div className="mt-1 px-1.5">
        {agentData?.suggestions && agentData.suggestions.length > 0 ? (
          <div className="flex max-w-[332px] flex-wrap gap-1.5">
            {agentData.suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onAction?.(suggestion)}
                className="inline-flex h-[30px] cursor-pointer items-center gap-1 rounded-full border border-slate-200/90 bg-white px-2.5 py-0 text-[10px] font-medium text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                <Wand2 size={10} strokeWidth={2} />
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-1.5 inline-flex w-fit max-w-[320px] flex-wrap items-center gap-1 rounded-full border border-slate-200/90 bg-white/92 px-1.5 py-1 text-slate-500 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.14)]">
          {onFeedback ? (
            <>
              <button
                type="button"
                onClick={() => handleFeedback("up")}
                aria-pressed={currentFeedback === "up"}
                title={currentFeedback === "up" ? "取消赞同" : "赞同这条回复"}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                  currentFeedback === "up"
                    ? "bg-emerald-50 text-emerald-600"
                    : "hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                <ThumbsUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleFeedback("down")}
                aria-pressed={currentFeedback === "down"}
                title={
                  currentFeedback === "down" ? "取消点踩" : "这条回复还不够好"
                }
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                  currentFeedback === "down"
                    ? "bg-rose-50 text-rose-600"
                    : "hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                <ThumbsDown size={12} />
              </button>
            </>
          ) : null}
          {onRetryResponse ? (
            <button
              type="button"
              onClick={() => void onRetryResponse(message)}
              className="inline-flex h-7 items-center rounded-full px-2.5 text-[10px] font-medium transition-colors hover:bg-slate-50 hover:text-slate-700"
              title="重新生成这条回复"
            >
              重试
            </button>
          ) : null}
          {onReuseToComposer ? (
            <button
              type="button"
              onClick={() => void onReuseToComposer(message)}
              className="inline-flex h-7 items-center rounded-full px-2.5 text-[10px] font-medium transition-colors hover:bg-slate-50 hover:text-slate-700"
              title="回填到输入框继续编辑"
            >
              回填
            </button>
          ) : null}
          {onBranchConversation ? (
            <button
              type="button"
              onClick={() => void onBranchConversation(message)}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-medium transition-colors hover:bg-slate-50 hover:text-slate-700"
              title="从这条回复分支为新对话"
            >
              <GitBranch size={10} />
              分支
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleCopy}
            className="relative inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-slate-50 hover:text-slate-700"
            title={copied ? "已复制" : "复制回复"}
          >
            {copied ? (
              <Check size={12} className="text-green-500" />
            ) : (
              <Copy size={12} />
            )}
          </button>
        </div>
        </div>
      ) : null}
    </div>
  );
};


