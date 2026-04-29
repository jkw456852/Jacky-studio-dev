import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronDown, ChevronUp, Search, Eye, Sparkles, 
    ThumbsUp, ThumbsDown, Copy, Check, Wand2, Image as ImageIcon, Loader2
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
    deriveAgentMessageImageCards,
    deriveAgentMessageOneClickView,
    deriveProposalPrompt,
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
    onEcommerceSelectModel?: (modelId: string, promptLanguage?: "zh" | "en" | "auto") => void;
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
    onEcommerceInsertToCanvas?: (result: EcommerceResultItem | string, label?: string) => void;
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

    const oneClickView = useMemo(
        () => deriveAgentMessageOneClickView(cleanText, message),
        [cleanText, message],
    );

    const isWorkflowUi = message.kind === 'workflow_ui' && !!message.workflowUi;
    const workflowType = message.workflowUi?.type || '';
    const isClothingWorkflowUi = workflowType.startsWith('clothingStudio.');
    const isEcommerceWorkflowUi = workflowType.startsWith('ecomOneClick.');

    return (
        <div className="w-full group">
            {/* 时间头部 */}
            <div className="flex justify-start mb-1.5 px-1">
                <span className="text-[10px] text-gray-400 font-medium">
                    {new Date(message.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
            </div>

            <div className="flex flex-col gap-2 max-w-[95%]">
                {/* 0. 附件预览 (更紧凑的 Pill) */}
                {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-0.5 mb-0.5">
                        {message.attachments.map((att, i) => (
                            <div key={i} className="flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-500 font-medium whitespace-nowrap shadow-sm">
                                <ImageIcon size={10} className="text-gray-400" />
                                <span>Image_{i + 1}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* 1. 引导文字 */}
                {cleanText && oneClickView.sections.length === 0 && (
                    <div className={`agent-msg-text px-1 break-words ${message.error ? 'text-red-600 bg-red-50 p-2.5 rounded-xl mt-1 border border-red-100' : ''}`}>
                        <MarkdownRenderer text={cleanText} className="text-[13px]" />
                    </div>
                )}

                {browserSession && (
                    <div className="px-1 mt-1">
                        <AgentBrowserSessionCard
                            session={browserSession}
                            onPreview={onPreview}
                        />
                    </div>
                )}

                {isWorkflowUi && message.workflowUi && (
                    <div className="px-1 mt-1">
                        {isClothingWorkflowUi ? (
                            <ClothingStudioCards
                                message={message.workflowUi}
                                onSubmitRequirements={(data) => onClothingSubmitRequirements?.(data)}
                                onGenerateModel={(data) => onClothingGenerateModel?.(data)}
                                onPickModelCandidate={(url) => onClothingPickModelCandidate?.(url)}
                                onInsertToCanvas={(url, label) => onClothingInsertToCanvas?.(url, label)}
                                onRetryFailed={() => onClothingRetryFailed?.()}
                            />
                        ) : null}
                        {isEcommerceWorkflowUi ? (
                            <EcommerceOneClickCards
                                message={message.workflowUi}
                                onRefineAnalysis={(feedback) => onEcommerceRefineAnalysis?.(feedback)}
                                onConfirmTypes={(items) => onEcommerceConfirmTypes?.(items)}
                                onConfirmImageAnalyses={(items) => onEcommerceConfirmImageAnalyses?.(items)}
                                onRetryImageAnalysis={(imageId) => onEcommerceRetryImageAnalysis?.(imageId)}
                                onRewritePlanPrompt={(groups, planItemId, feedback) =>
                                    onEcommerceRewritePlanPrompt?.(groups, planItemId, feedback) ?? Promise.resolve(null)
                                }
                                onGeneratePlanItem={(groups, planItemId) =>
                                    onEcommerceGeneratePlanItem?.(groups, planItemId) ?? Promise.resolve()
                                }
                                onGenerateExtraPlanItem={(groups, typeId) =>
                                    onEcommerceGenerateExtraPlanItem?.(groups, typeId) ?? Promise.resolve()
                                }
                                onOpenResultOverlayEditor={(url) => onEcommerceOpenResultOverlayEditor?.(url)}
                                onCloseResultOverlayEditor={() => onEcommerceCloseResultOverlayEditor?.()}
                                onSaveResultOverlayDraft={(url, overlayState) =>
                                    onEcommerceSaveResultOverlayDraft?.(url, overlayState) ?? Promise.resolve()
                                }
                                onApplyResultOverlay={(url, overlayState) =>
                                    onEcommerceApplyResultOverlay?.(url, overlayState) ?? Promise.resolve()
                                }
                                onUploadResultOverlayFont={(url, file) =>
                                    onEcommerceUploadResultOverlayFont?.(url, file) ?? Promise.resolve()
                                }
                                onUploadResultOverlayIcon={(url, file) =>
                                    onEcommerceUploadResultOverlayIcon?.(url, file) ?? Promise.resolve()
                                }
                                onResetResultOverlay={(url) =>
                                    onEcommerceResetResultOverlay?.(url) ?? Promise.resolve()
                                }
                                onPromoteResult={(url) => onEcommercePromoteResult?.(url)}
                                onPromoteSelectedResults={(urls) => onEcommercePromoteSelectedResults?.(urls)}
                                onDeleteResult={(url) => onEcommerceDeleteResult?.(url)}
                                onConfirmPlans={(groups) => onEcommerceConfirmPlans?.(groups)}
                                onConfirmSupplements={(fields) => onEcommerceConfirmSupplements?.(fields)}
                                onSelectModel={(modelId, promptLanguage) => onEcommerceSelectModel?.(modelId, promptLanguage)}
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
                                onInsertToCanvas={(url, label) => onEcommerceInsertToCanvas?.(url, label)}
                            />
                        ) : null}
                    </div>
                )}

                {oneClickView.sections.length > 0 && (
                    <div className="px-1 mt-1 space-y-1.5">
                        {oneClickView.intro && (
                            <div className="rounded-lg border border-gray-200 bg-white/70 px-2.5 py-2">
                                <MarkdownRenderer text={oneClickView.intro} className="text-[12px]" />
                            </div>
                        )}
                        {oneClickView.sections.map((section, idx) => (
                            <details key={`${section.title}-${idx}`} className="rounded-lg border border-gray-200 bg-white/90" open={idx < 2}>
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

                {/* 1.5 生成结果预览 (图 2 要求在对话框显示) */}
                {imageCards.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-1 mt-1">
                        {imageCards.map((card, i) => (
                            <div 
                                key={i} 
                                className="relative rounded-lg overflow-hidden border border-gray-100 group/img bg-gray-50 cursor-pointer"
                                style={{ width: imageCards.length > 1 ? '140px' : '220px', aspectRatio: '1/1' }}
                                onClick={() => onPreview(card.url)}
                            >
                                <img src={card.url} alt="Generated" className="w-full h-full max-w-full max-h-[300px] object-contain transition-transform group-hover/img:scale-105" />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/5 transition-colors" />
                                <div className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] px-1.5 py-1 truncate">
                                    {card.title}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 2. 可折叠分析区 */}
                {agentData?.analysis && (
                    <div className="px-1">
                        <button 
                            onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100/60 hover:bg-gray-100 rounded-lg transition-all border border-gray-100/50 group/btn"
                        >
                            <Search size={12} className="text-gray-500 group-hover/btn:text-gray-800 transition-colors" />
                            <span className="text-[12px] font-medium text-gray-600 group-hover/btn:text-gray-900 transition-colors">
                                图片分析
                            </span>
                            {isAnalysisExpanded ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
                        </button>
                        
                        <AnimatePresence>
                            {isAnalysisExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-1.5 p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-[12px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                                        {agentData.analysis}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* 2.5 智能生成方案 (Lovart 深度对齐紧凑卡片) */}
                {proposals.length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-1">
                        {proposals.map((prop, idx) => (
                            <motion.div 
                                key={idx}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white/95 backdrop-blur-md border border-gray-100 rounded-lg p-2.5 shadow-sm hover:shadow-md transition-all group/card overflow-hidden"
                            >
                                {/* 方案预览图 (Lovart Style) */}
                                {(prop.previewUrl || prop.concept_image) && (
                                    <div className="mb-2 rounded-md overflow-hidden bg-gray-50 border border-gray-100 aspect-video relative group/preview">
                                        <img 
                                            src={prop.previewUrl || prop.concept_image} 
                                            alt="Preview" 
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/5 group-hover/card:bg-transparent transition-colors" />
                                    </div>
                                )}

                                <div className="flex justify-between items-center mb-1">
                                    <h4 className="text-[12px] font-bold text-gray-900 flex items-center gap-1">
                                        <Sparkles size={11} className="text-blue-500" />
                                        {prop.title || `方案 ${idx + 1}`}
                                    </h4>
                                    <span className="text-[8px] px-1 py-0.5 bg-blue-50/50 text-blue-600 rounded font-bold uppercase tracking-tighter border border-blue-100/50">PROPOSAL</span>
                                </div>
                                <p className="text-[11px] text-gray-500 leading-[1.3] mb-2.5 font-normal">
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
                                            (typeof promptFromSkillCall === 'string' ? promptFromSkillCall : '') ||
                                            '';
                                        if (prompt) {
                                            onSmartGenerate?.(prompt, prop.id);
                                        }
                                    }}
                                    className="w-full py-1.5 bg-gray-900 hover:bg-black text-white rounded-md text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-sm"
                                >
                                    <Wand2 size={11} strokeWidth={2.5} />
                                    立即生成
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* 3. 后继内容展示区 */}
                {agentData?.description && (
                    <div className="text-[12px] text-gray-700 leading-relaxed px-1">
                        {agentData.description}
                    </div>
                )}

                {/* 4. 模型标签区 */}
                {(agentData?.model || proposals.length > 0) && (
                    <div className="flex items-center gap-1 justify-start px-1">
                        <div className="flex items-center gap-1 text-gray-400">
                            <Eye size={12} strokeWidth={2.5} />
                            <span className="text-[10px] font-bold tracking-tight uppercase opacity-50">
                                {agentData?.model || 'Nano Banana Pro'}
                            </span>
                        </div>
                    </div>
                )}

                {/* 5. 最终生成结果 */}
                {imageCards.length > 0 && (
                    <div className="px-1 mt-1">
                        {imageCards.length === 1 ? (
                            <div className="relative rounded-xl overflow-hidden border border-gray-100 bg-gray-100/70">
                                <img 
                                    src={imageCards[0].url} 
                                    alt="Generated"
                                    className="w-full max-w-full h-auto max-h-[300px] object-contain cursor-zoom-in hover:opacity-95 transition"
                                    onClick={() => onPreview(imageCards[0].url)}
                                />
                                <div className="px-2 py-1.5 text-[11px] text-gray-600 border-t border-gray-100 bg-white/80">
                                    {imageCards[0].title}
                                </div>
                            </div>
                        ) : (
                            <div className={`grid gap-1.5 ${imageCards.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                {imageCards.map((card, i) => (
                                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                                        <img 
                                            src={card.url} 
                                            className="w-full h-full max-w-full max-h-[300px] object-contain cursor-zoom-in hover:opacity-95 transition"
                                            onClick={() => onPreview(card.url)}
                                        />
                                        <div className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] px-1.5 py-1 truncate">
                                            {card.title}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 5.5 生成中效果 */}
                {agentData?.isGenerating && imageCards.length === 0 && (
                    <div className="px-1 mt-1">
                        <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100/70 border border-gray-100 flex flex-col items-center justify-center gap-3">
                            <Loader2 size={24} className="text-gray-400 animate-spin" strokeWidth={2.5} />
                            <span className="text-[12px] font-medium text-gray-500 tracking-wider">正在使用 <span className="uppercase text-gray-600 font-bold">{agentData.model || 'AI'}</span> 生成中...</span>
                        </div>
                    </div>
                )}

                {/* 6. 建议按钮（可点击快速回复） */}
                {agentData?.suggestions && agentData.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1 mt-1.5">
                        {agentData.suggestions.map((suggestion, idx) => (
                            <button
                                key={idx}
                                onClick={() => onAction?.(suggestion)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[11px] font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900 hover:shadow-sm transition-all cursor-pointer"
                            >
                                <Wand2 size={10} strokeWidth={2} />
                                {suggestion}
                            </button>
                        ))}
                    </div>
                )}

                {/* 7. 操作栏 */}
                <div className="flex items-center gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 text-gray-300 hover:text-gray-500 transition-colors">
                        <ThumbsUp size={12} />
                    </button>
                    <button className="p-1 text-gray-300 hover:text-gray-500 transition-colors">
                        <ThumbsDown size={12} />
                    </button>
                    <button 
                        onClick={handleCopy}
                        className="p-1 text-gray-300 hover:text-gray-500 transition-colors relative"
                    >
                        {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    </button>
                </div>
            </div>
        </div>
    );
};
