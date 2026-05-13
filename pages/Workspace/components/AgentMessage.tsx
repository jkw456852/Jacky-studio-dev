import React, { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { ChatMessage } from '../../../types';
import { AgentBrowserSessionCard } from './AgentBrowserSessionCard';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ClothingStudioCards } from './workflow/ClothingStudioCards';
import { EcommerceOneClickCards } from './workflow/EcommerceOneClickCards';
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
  deriveAgentMessageOneClickView,
  deriveAgentMessagePlanningBlock,
  deriveAgentMessagePresentation,
  deriveAgentMessageResearchView,
} from './AgentMessage.helpers';

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

interface AgentMessageProps {
  message: ChatMessage;
  onPreview: (url: string) => void;
  onAction?: (action: string) => void;
  onSmartGenerate?: (prompt: string, proposalId?: string) => void;
  clothingActions?: AgentMessageClothingActionsProps;
  ecommerceActions?: AgentMessageEcommerceActionsProps;
}

export const AgentMessage: React.FC<AgentMessageProps> = ({
  message,
  onPreview,
  onAction,
  onSmartGenerate,
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
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
  const analysisContent =
    agentData?.analysis ||
    (presentationView?.kind === 'execution_plan' ? agentData?.description || '' : '');
  const executionModeBadgeLabel =
    presentationView?.modeLabel ||
    (executionMode === 'true_edit'
      ? '定向编辑'
      : executionMode === 'reference_guided_generate'
        ? '参考出图'
        : executionMode === 'generate'
          ? '生成'
          : null);

  return (
    <div className="group inline-block max-w-full align-top">
      <div className="overflow-hidden rounded-[24px] rounded-tl-md border border-sky-100 bg-[#eef6ff] px-3 py-3 shadow-sm">
        <div className="mb-1.5 flex justify-start px-1">
          <span className="text-[10px] font-medium text-gray-400">
            {new Date(message.timestamp).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>

        <div className="flex max-w-full flex-col gap-2">
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-0.5 flex flex-wrap gap-1.5 px-0.5">
              {message.attachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-medium whitespace-nowrap text-gray-500 shadow-sm"
                >
                  <ImageIcon size={10} className="text-gray-400" />
                  <span>Image_{i + 1}</span>
                </div>
              ))}
            </div>
          )}

        {researchView && (
          <div className="px-1">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm">
              <div className="border-b border-slate-100 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          researchView.status === 'failed'
                            ? 'bg-rose-100 text-rose-700'
                            : researchView.status === 'searching'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {researchView.statusLabel}
                      </span>
                      {researchView.providerLabel && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          <Globe size={10} />
                          {researchView.providerLabel}
                        </span>
                      )}
                      {researchView.fallback && (
                        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                          fallback
                        </span>
                      )}
                    </div>
                    {researchView.query && (
                      <div className="mt-2 text-[12px] font-medium text-slate-800">
                        {researchView.query}
                      </div>
                    )}
                    {researchView.summary && (
                      <div className="mt-1 text-[11px] leading-5 text-slate-500">
                        {researchView.summary}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 rounded-xl bg-slate-100 p-2 text-slate-500">
                    <Search size={14} />
                  </div>
                </div>

                {researchView.stats.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {researchView.stats.map((stat) => (
                      <div
                        key={`${stat.label}-${stat.value}`}
                        className="min-w-[64px] rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2"
                      >
                        <div className="text-[10px] text-slate-500">{stat.label}</div>
                        <div className="mt-0.5 text-[13px] font-semibold text-slate-800">
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  {researchView.steps.map((step) => (
                    <div
                      key={step.key}
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium ${
                        step.status === 'done'
                          ? 'bg-emerald-50 text-emerald-700'
                          : step.status === 'current'
                            ? 'bg-blue-50 text-blue-700'
                            : step.status === 'error'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {step.label}
                    </div>
                  ))}
                </div>

                {researchView.citations.length > 0 && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12px] font-semibold text-slate-700">
                        引用来源
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setIsResearchSourcesExpanded((value) => !value)
                        }
                        className="text-[11px] font-medium text-slate-500 transition hover:text-slate-800"
                      >
                        {isResearchSourcesExpanded ? '收起来源' : '展开来源'}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {researchView.citations.slice(0, 4).map((citation, index) => (
                        <a
                          key={citation.id}
                          href={citation.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-100 px-1 text-[10px] font-semibold text-slate-700">
                            {index + 1}
                          </span>
                          <span className="max-w-[160px] truncate">{citation.host}</span>
                        </a>
                      ))}
                      {researchView.citations.length > 4 && (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
                          +{researchView.citations.length - 4}
                        </span>
                      )}
                    </div>

                    <AnimatePresence initial={false}>
                      {isResearchSourcesExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
                            {researchView.citations.map((citation, index) => (
                              <a
                                key={citation.id}
                                href={citation.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-slate-300"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1 text-[10px] font-semibold text-slate-700">
                                        {index + 1}
                                      </span>
                                      <div className="truncate text-[12px] font-medium text-slate-800">
                                        {citation.title}
                                      </div>
                                    </div>
                                    <div className="mt-1 truncate text-[10px] text-slate-500">
                                      {citation.siteName || citation.host}
                                    </div>
                                    {(citation.excerpt || citation.snippet) && (
                                      <div className="mt-1 text-[11px] leading-5 text-slate-500">
                                        {citation.excerpt || citation.snippet}
                                      </div>
                                    )}
                                  </div>
                                  <ExternalLink
                                    size={12}
                                    className="mt-0.5 shrink-0 text-slate-400"
                                  />
                                </div>
                              </a>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {researchView.extractedPages.length > 0 && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700">
                        <FileText size={12} />
                        网页摘录
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setIsResearchExtractsExpanded((value) => !value)
                        }
                        className="text-[11px] font-medium text-slate-500 transition hover:text-slate-800"
                      >
                        {isResearchExtractsExpanded ? '收起摘录' : '展开摘录'}
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {isResearchExtractsExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
                            {researchView.extractedPages.map((page, index) => (
                              <div
                                key={page.id}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1 text-[10px] font-semibold text-slate-700">
                                    {index + 1}
                                  </span>
                                  <div className="truncate text-[12px] font-medium text-slate-800">
                                    {page.title}
                                  </div>
                                </div>
                                <div className="mt-1 break-all text-[10px] text-slate-400">
                                  {page.url}
                                </div>
                                <div className="mt-1 text-[11px] leading-5 text-slate-500 whitespace-pre-wrap">
                                  {page.cleanedTextExcerpt || page.excerpt || '暂无正文摘录'}
                                </div>
                                {page.error && (
                                  <div className="mt-1 text-[10px] text-rose-600">
                                    {page.error}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {sanitizedVisibleText && oneClickView.sections.length === 0 && (
          <div
            className={`agent-msg-text break-words px-1 ${
              message.error
                ? 'mt-1 rounded-xl border border-red-100 bg-red-50 p-2.5 text-red-600'
                : ''
            }`}
          >
            <MarkdownRenderer text={sanitizedVisibleText} className="text-[13px]" />
          </div>
        )}

        {planningBlock && !analysisContent && oneClickView.sections.length === 0 && (
          <div className="px-1">
            <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/76">
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
          </div>
        )}

        {oneClickView.sections.length > 0 && (
          <div className="mt-1 space-y-1.5 px-1">
            {oneClickView.intro && (
              <div className="rounded-lg border border-gray-200 bg-white/70 px-2.5 py-2">
                <MarkdownRenderer
                  text={oneClickView.intro}
                  className="text-[12px]"
                />
              </div>
            )}
            {oneClickView.sections.map((section, idx) => (
              <details
                key={`${section.title}-${idx}`}
                className="rounded-lg border border-gray-200 bg-white/90"
                open={idx < 2}
              >
                <summary className="cursor-pointer select-none px-2.5 py-2 text-[12px] font-semibold text-gray-800">
                  {section.title}
                </summary>
                <div className="border-t border-gray-100 px-2.5 py-2">
                  <MarkdownRenderer text={section.body} className="text-[12px]" />
                </div>
              </details>
            ))}
          </div>
        )}

        {analysisContent ? (
          <div className="px-1">
            <button
              onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
              className="group/btn inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/70 px-2.5 py-1 text-[11px] transition-all hover:border-slate-300 hover:bg-white"
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
                  <div className="mt-2 rounded-2xl border border-slate-200/70 bg-white/76 px-3 py-3 text-[12px] leading-6 text-slate-600 whitespace-pre-wrap">
                    {analysisContent}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : null}

        {proposals.length > 0 && (
          <div className="mb-1 flex flex-col gap-1.5">
            {proposals.map((prop, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group/card overflow-hidden rounded-lg border border-gray-100 bg-white/95 p-2.5 shadow-sm backdrop-blur-md transition-all hover:shadow-md"
              >
                {(prop.previewUrl || prop.concept_image) && (
                  <div className="group/preview relative mb-2 aspect-video overflow-hidden rounded-md border border-gray-100 bg-gray-50">
                    <img
                      src={prop.previewUrl || prop.concept_image}
                      alt="Preview"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/5 transition-colors group-hover/card:bg-transparent" />
                  </div>
                )}

                <div className="mb-1 flex items-center justify-between">
                  <h4 className="flex items-center gap-1 text-[12px] font-bold text-gray-900">
                    <Sparkles size={11} className="text-blue-500" />
                    {prop.title || `方案 ${idx + 1}`}
                  </h4>
                  <span className="rounded border border-blue-100/50 bg-blue-50/50 px-1 py-0.5 text-[8px] font-bold tracking-tighter text-blue-600 uppercase">
                    PROPOSAL
                  </span>
                </div>

                <p className="mb-2.5 text-[11px] leading-[1.3] font-normal text-gray-500">
                  {prop.description}
                </p>

                <button
                  onClick={() => {
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
                    if (prompt) {
                      onSmartGenerate?.(prompt, prop.id);
                    }
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-gray-900 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-black active:scale-[0.98]"
                >
                  <Wand2 size={11} strokeWidth={2.5} />
                  立即生成
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {(agentData?.model || proposals.length > 0 || presentationStatusLabel) ? (
          <div className="flex items-center justify-start gap-1 px-1 opacity-70">
            {presentationStatusLabel ? (
              <span className="rounded-full border border-slate-200/70 bg-white/75 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {presentationStatusLabel}
              </span>
            ) : null}
            {(agentData?.model || proposals.length > 0) ? (
              <div className="flex items-center gap-1 text-slate-400">
                <Eye size={11} strokeWidth={2.2} />
                <span className="text-[10px] font-medium tracking-tight text-slate-400 uppercase">
                  {agentData?.model || 'Nano Banana Pro'}
                </span>
              </div>
            ) : null}
            {executionModeBadgeLabel ? (
              <span className="rounded-full border border-slate-200/70 bg-white/70 px-2 py-0.5 text-[10px] font-medium text-slate-400">
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
                  alt="Generated"
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

      <div className="mt-2 px-3">
        {agentData?.suggestions && agentData.suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {agentData.suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onAction?.(suggestion)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-600 transition-all hover:border-gray-400 hover:text-gray-900 hover:shadow-sm"
              >
                <Wand2 size={10} strokeWidth={2} />
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-2 flex items-center gap-0.5 px-1 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100">
          <button className="p-1 transition-colors hover:text-gray-500">
            <ThumbsUp size={12} />
          </button>
          <button className="p-1 transition-colors hover:text-gray-500">
            <ThumbsDown size={12} />
          </button>
          <button
            onClick={handleCopy}
            className="relative p-1 transition-colors hover:text-gray-500"
          >
            {copied ? (
              <Check size={12} className="text-green-500" />
            ) : (
              <Copy size={12} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
