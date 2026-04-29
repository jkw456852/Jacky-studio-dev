import { useState, useCallback, useRef } from 'react';
import { AgentType, AgentTask, ProjectContext, GeneratedAsset, AgentTaskMetadata } from '../types/agent.types';
import { routeToAgent, executeAgentTask, getAgentInfo, detectPipeline, executePipeline, PIPELINES } from '../services/agents';
import { ChatMessage, CanvasElement } from '../types';
import { assetsToCanvasElementsAtCenter } from '../utils/canvas-helpers';
import { useAgentStore } from '../stores/agent.store';
import { uploadImage } from '../utils/uploader';
import { useImageHostStore } from '../stores/imageHost.store';
import { localPreRoute } from '../services/agents/local-router';
import { addTopicMemoryItem, buildTopicPinnedContext, extractConstraintHints, mergeUniqueStrings, upsertTopicSnapshot } from '../services/topic-memory';
import { summarizeReferenceSet } from '../services/topic-memory';
import { getMemoryKey } from '../services/topicMemory/key';
import {
  detectExplicitAgentPin,
  detectOptimizeThenExecuteIntent,
  stripOptimizePipelineCommand,
} from '../services/agents/prompt-optimizer/intent';
import { optimizeUserText } from '../services/agents/prompt-optimizer/service';
import { useProjectStore } from '../stores/project.store';
import { rememberApprovedAsset } from '../services/topic-memory';

const viteEnv =
  ((import.meta as unknown as {
    env?: Record<string, string | boolean | undefined>;
  }).env || {});

const inferTaskModeFromRequest = (message: string, metadata?: AgentTaskMetadata) => {
  const lower = String(message || '').toLowerCase();
  if (metadata?.enableWebSearch || metadata?.multimodalContext?.research) return 'research' as const;
  if (metadata?.skillData?.name?.toLowerCase?.().includes('text') || /文字|文案|改字|text/i.test(lower)) return 'text-edit' as const;
  if (/排版|版式|layout/i.test(lower)) return 'layout-edit' as const;
  if (/局部|圈选|区域|点选|touch/i.test(lower)) return 'touch-edit' as const;
  if (/修改|替换|编辑|改成|换成|edit|replace|remove/i.test(lower)) return 'edit' as const;
  return 'generate' as const;
};

const MAX_ORCHESTRATOR_HISTORY_MESSAGES = 6;
const AGENT_EXECUTION_TIMEOUT_MS = 600_000; // 与 EnhancedBaseAgent 默认超时保持一致（10 分钟）
const PIPELINE_EXECUTION_TIMEOUT_MS = 180_000;

interface CanvasState {
  elements: CanvasElement[];
  pan: { x: number; y: number };
  zoom: number;
  showAssistant: boolean;
}

interface UseAgentOrchestratorOptions {
  projectContext: ProjectContext;
  canvasState?: CanvasState;
  onElementsUpdate?: (elements: CanvasElement[]) => void;
  onHistorySave?: (elements: CanvasElement[], markers: any[]) => void;
  autoAddToCanvas?: boolean;
}

export function useAgentOrchestrator(options: UseAgentOrchestratorOptions) {
  const {
    projectContext,
    canvasState,
    onElementsUpdate,
    onHistorySave,
    autoAddToCanvas = true
  } = options;

  // Read from store instead of local state
  const currentTask = useAgentStore(s => s.currentTask);
  const isAgentMode = useAgentStore(s => s.isAgentMode);
  const { setCurrentTask, setIsAgentMode } = useAgentStore(s => s.actions);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const isProcessingRef = useRef(false);
  const messageQueue = useRef<Array<{
    message: string;
    attachments?: File[];
    metadata?: AgentTaskMetadata;
    userMessageId?: string;
  }>>([]);

  const withTimeout = useCallback(async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs))
    ]);
  }, []);

  const addAssetsToCanvas = useCallback(async (assets: GeneratedAsset[]) => {
    if (!canvasState || !onElementsUpdate || !autoAddToCanvas) {
      console.log('[useAgentOrchestrator] Canvas integration disabled or not configured');
      return;
    }

    try {
      const containerW = window.innerWidth - (canvasState.showAssistant ? 400 : 0);
      const containerH = window.innerHeight;

      console.log('[useAgentOrchestrator] Processing', assets.length, 'assets for canvas');

      // 异步获取所有图片的原始尺寸
      const assetsWithDimensions = await Promise.all(assets.map(async (asset) => {
        if (asset.type === 'image' && (!asset.metadata.width || !asset.metadata.height)) {
          try {
            const dimensions = await new Promise<{ w: number, h: number }>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve({ w: img.width, h: img.height });
              img.onerror = reject;
              img.src = asset.url;
            });
            return {
              ...asset,
              metadata: { ...asset.metadata, width: dimensions.w, height: dimensions.h }
            };
          } catch (e) {
            console.warn('[useAgentOrchestrator] Failed to load image dimensions, using default', e);
            return asset;
          }
        }
        return asset;
      }));

      const newElements = assetsToCanvasElementsAtCenter(
        assetsWithDimensions,
        containerW,
        containerH,
        canvasState.pan,
        canvasState.zoom,
        canvasState.elements.length
      );

      console.log('[useAgentOrchestrator] Created', newElements.length, 'canvas elements');

      const updatedElements = [...canvasState.elements, ...newElements];
      onElementsUpdate(updatedElements);

      if (onHistorySave) {
        onHistorySave(updatedElements, []);
      }

      console.log('[useAgentOrchestrator] Canvas updated successfully');
    } catch (error) {
      console.error('[useAgentOrchestrator] Failed to add assets to canvas:', error);
    }
  }, [canvasState, onElementsUpdate, onHistorySave, autoAddToCanvas]);

  const processMessage = useCallback(async (
    message: string,
    attachments?: File[],
    metadata?: AgentTaskMetadata,
    userMessageId?: string
  ): Promise<AgentTask | null> => {
    if (!message.trim()) return null;

    if (isProcessingRef.current) {
      messageQueue.current.push({ message, attachments, metadata, userMessageId });
      console.log('[useAgentOrchestrator] Message queued, queue size:', messageQueue.current.length);
      return null;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);

    let executingTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      console.log('[useAgentOrchestrator] Processing message:', message.substring(0, 50));

      // 图片上传逻辑
      let uploadedUrls: string[] = [];
      if (attachments && attachments.length > 0) {
        const hostProvider = useImageHostStore.getState().selectedProvider;
        if (hostProvider !== 'none') {
          console.log('[useAgentOrchestrator] Uploading attachments to host...');
          setIsUploadingAttachments(true);
          // 更新状态提示用户
          setCurrentTask({
            id: `upload-${Date.now()}`,
            agentId: 'coco' as AgentType,
            status: 'analyzing', // 借用 analyzing 状态显示上传中
            progressMessage: '正在同步图片至云端...',
            input: { message, attachments, context: projectContext },
            createdAt: Date.now(),
            updatedAt: Date.now()
          });

          try {
            const uploadResults = await Promise.allSettled(
              attachments.map((file) => uploadImage(file))
            );
            const failedUploads = uploadResults.filter(
              (result): result is PromiseRejectedResult => result.status === 'rejected'
            );

            if (failedUploads.length > 0) {
              throw new Error('图片上传失败，请检查网络或重新上传');
            }

            uploadedUrls = uploadResults
              .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
              .map((result) => result.value)
              .filter((url) => /^https?:\/\//i.test(url));

            if (uploadedUrls.length !== attachments.length) {
              throw new Error('图片上传结果异常，请重新上传后重试');
            }

            console.log('[useAgentOrchestrator] Upload success:', uploadedUrls);

            // 上传成功后回填为真实公网 URL，避免后续上下文使用 blob: 占位链接
            if (userMessageId) {
              useAgentStore.getState().actions.updateMessageAttachments(userMessageId, uploadedUrls);
            }
          } finally {
            setIsUploadingAttachments(false);
          }
        }
      }

      // Read conversation history from store (single source of truth)
      const hostProvider = useImageHostStore.getState().selectedProvider;
      // 直接从 store 读取最新的 designSession，避免 React 闭包快照导致
      // 新项目第一条消息仍携带旧项目 subjectAnchors/approvedAssetIds 的问题
      const freshDesignSession = useProjectStore.getState().designSession;
      const updatedContext = {
        ...projectContext,
        designSession: {
          ...freshDesignSession,
          brand: {
            ...freshDesignSession.brand,
            ...useProjectStore.getState().brandInfo,
          },
        },
        conversationHistory: useAgentStore.getState().messages.slice(-MAX_ORCHESTRATOR_HISTORY_MESSAGES)
      };

      const activeConversationId = String(projectContext.conversationId || '').trim();
      const topicId = String(
        (
          metadata?.topicId ||
          (activeConversationId
            ? getMemoryKey(projectContext.projectId, activeConversationId)
            : '') ||
          ''
        )
      ).trim();
      let topicPinnedContext = '';
      let topicPinnedRefs: string[] = [];
      const projectActions = useProjectStore.getState().actions;
      const inferredTaskMode = inferTaskModeFromRequest(message, metadata);
      projectActions.setTaskMode(inferredTaskMode);

      if (topicId) {
        try {
          const pinned = await buildTopicPinnedContext(topicId);
          topicPinnedContext = pinned.text;
          topicPinnedRefs = pinned.refs;

          const hints = extractConstraintHints(message);
          if (hints.length > 0) {
            await upsertTopicSnapshot(topicId, {
              pinned: {
                constraints: hints,
                decisions: [],
              },
            });
          }

          if (message.trim()) {
            await addTopicMemoryItem({
              topicId,
              type: 'instruction',
              text: message.trim(),
            });
          }
        } catch {
        }
      }

      const optimizerEnabled =
        viteEnv.VITE_PROMPT_OPTIMIZER_ENABLED !== 'false';
      const optimizerPipelineEnabled =
        viteEnv.VITE_PROMPT_OPTIMIZER_PIPELINE_ENABLED !== 'false';
      const isInternalCall = metadata?.internalCall === true;

      let messageForExecution = message;
      let pinnedAgent: AgentType | null = null;
      let useOptimizeThenExecute = false;
      let optimizerUsed = false;
      let optimizerStatus: 'ok' | 'timeout' | 'fail' | 'skipped' = 'skipped';
      let optimizedMessageForTrace: string | undefined;

      if (
        !isInternalCall &&
        optimizerEnabled &&
        optimizerPipelineEnabled &&
        detectOptimizeThenExecuteIntent(message)
      ) {
        useOptimizeThenExecute = true;
        optimizerUsed = true;
        const strippedInput = stripOptimizePipelineCommand(message) || message;
        const optimized = await optimizeUserText(strippedInput, updatedContext, {
          requestId: userMessageId,
        });
        if (optimized.ok && optimized.optimizedText) {
          messageForExecution = optimized.optimizedText;
          optimizedMessageForTrace = optimized.optimizedText;
          optimizerStatus = 'ok';
        } else {
          const failReason = (optimized as { reason?: string }).reason || '';
          optimizerStatus = failReason === 'timeout' ? 'timeout' : 'fail';
        }

        const pinned = detectExplicitAgentPin(message);
        if (
          pinned &&
          [
            'coco',
            'vireo',
            'cameron',
            'poster',
            'package',
            'motion',
            'campaign',
          ].includes(pinned)
        ) {
          pinnedAgent = pinned as AgentType;
        }
      }

      if (
        metadata?.agentSelectionMode === 'manual' &&
        metadata?.pinnedAgentId &&
        [
          'coco',
          'vireo',
          'cameron',
          'poster',
          'package',
          'motion',
          'campaign',
          'prompt-optimizer',
        ].includes(metadata.pinnedAgentId)
      ) {
        pinnedAgent = metadata.pinnedAgentId;
      }

      // Pipeline detection
      const pipelineId = !useOptimizeThenExecute ? detectPipeline(messageForExecution) : null;
      if (pipelineId && PIPELINES[pipelineId]) {
        const pipeline = PIPELINES[pipelineId];
        console.log('[useAgentOrchestrator] Pipeline detected:', pipeline.name);

        setCurrentTask({
          id: `pipeline-${Date.now()}`,
          agentId: pipeline.steps[0].agentId,
          status: 'analyzing',
          input: { message: messageForExecution, context: updatedContext },
          createdAt: Date.now(),
          updatedAt: Date.now()
        });

        console.log('[useAgentOrchestrator] Pipeline request start');
        const pipelineResult = await withTimeout(
          executePipeline(pipeline, messageForExecution, updatedContext, (stepIdx, stepResult) => {
            console.log(`[useAgentOrchestrator] Pipeline step ${stepIdx} done:`, stepResult.status);
            setCurrentTask(stepResult);
          }),
          PIPELINE_EXECUTION_TIMEOUT_MS,
          '流水线执行超时，请稍后重试'
        );
        console.log('[useAgentOrchestrator] Pipeline request done');

        if (pipelineResult.allAssets.length > 0) {
          addAssetsToCanvas(pipelineResult.allAssets);
        }

        const lastStep = pipelineResult.steps[pipelineResult.steps.length - 1];
        if (lastStep && lastStep.output) {
          lastStep.output.assets = pipelineResult.allAssets;
        }
        setCurrentTask(lastStep || null);

        // Messages are managed by Workspace via addMessage — no need to push here

        return lastStep || null;
      }

      // Single agent routing — try local keyword match first to skip API call
      console.log('[useAgentOrchestrator] Routing to agent...');
      const localAgent = localPreRoute(messageForExecution);
      let decision;
      if (pinnedAgent) {
        decision = {
          action: 'route' as const,
          targetAgent: pinnedAgent,
          taskType:
            metadata?.agentSelectionMode === 'manual'
              ? 'manual-role'
              : 'optimized-routed',
          complexity: 'simple' as const,
          handoffMessage:
            optimizerUsed && optimizedMessageForTrace
              ? `用户请求(已优化): ${messageForExecution}`
              : `用户请求: ${messageForExecution}`,
          confidence: 0.9,
        };
      } else if (localAgent) {
        console.log('[useAgentOrchestrator] Local pre-route hit:', localAgent);
        decision = {
          action: 'route' as const,
          targetAgent: localAgent,
          taskType: 'local-routed',
          complexity: 'simple' as const,
          handoffMessage: `用户请求: ${messageForExecution}`,
          confidence: 0.75
        };
      } else {
        console.log('[useAgentOrchestrator] 发起路由请求...');
        decision = await withTimeout(
          routeToAgent(messageForExecution, updatedContext),
          60000,
          '路由请求超时，请稍后重试'
        );
        console.log('[useAgentOrchestrator] 路由请求返回:', decision?.targetAgent);
      }

      if (!decision) {
        console.warn('[useAgentOrchestrator] All routing failed, using poster fallback');
        decision = {
          action: 'route' as const,
          targetAgent: 'poster' as AgentType,
          taskType: 'fallback',
          complexity: 'simple' as const,
          handoffMessage: `用户请求: ${messageForExecution}`,
          confidence: 0.4
        };
      }

      console.log('[useAgentOrchestrator] Routed to:', decision.targetAgent);

      if (decision.action === 'respond' || decision.action === 'clarify') {
        const guidance = [
          ...(decision.questions || []),
          ...(decision.suggestions || []),
        ].filter(Boolean);
        const guidanceText = guidance.length > 0 ? `\n\n${guidance.join('\n')}` : '';
        const responseTask: AgentTask = {
          id: `task-${Date.now()}`,
          agentId: 'coco',
          status: 'completed',
          input: {
            message: messageForExecution,
            attachments,
            uploadedAttachments: uploadedUrls.length > 0 ? uploadedUrls : undefined,
            context: updatedContext,
            metadata,
          },
          output: {
            message: `${decision.message || decision.handoffMessage || '我先帮你梳理一下需求。'}${guidanceText}`,
            questions: decision.questions,
            suggestions: decision.suggestions,
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setCurrentTask(responseTask);
        return responseTask;
      }

      // ── 跟进消息自动继承上次生成图作为参考 ──────────────────────────────
      // 当用户没有上传新图（"换个风格"/"换个色调"等跟进指令），
      // 自动把上一次任务生成的图片 URL 注入为参考，防止从头生成无关内容
      const isFollowUpEdit = !attachments?.length && !uploadedUrls.length && (
        /换个|换种|换成|改变|调整|重新|再来|再生|另一|不同|其他|新的风格|新的色调|新角度/i.test(message) ||
        /change|another|different|new style|retry|redo|again/i.test(message)
      );

      let inheritedReferenceUrls: string[] = [];
      if (isFollowUpEdit) {
        // 优先从当前 task 的 output assets 拿
        const lastTask = useAgentStore.getState().currentTask;
        const taskAssetUrls = (lastTask?.output?.assets || [])
          .map((a: any) => a.url)
          .filter((u: string) => /^https?:\/\//i.test(u))
          .slice(0, 2);

        // 其次从 designSession.approvedAssetIds 拿（从 store 实时读，避免闭包旧值）
        const sessionAssetUrls = (useProjectStore.getState().designSession?.approvedAssetIds || [])
          .filter((u: string) => /^https?:\/\//i.test(u))
          .slice(0, 2);

        // 也从消息历史里找最近的图片附件（已上传的 ImgBB URL）
        const historyImageUrls = useAgentStore.getState().messages
          .slice(-6)
          .flatMap((msg: any) => msg.attachments || [])
          .filter((u: string) => /^https?:\/\//i.test(u) && /\.(jpg|jpeg|png|webp|gif)/i.test(u))
          .slice(0, 2);

        inheritedReferenceUrls = [...new Set([...taskAssetUrls, ...historyImageUrls, ...sessionAssetUrls])].slice(0, 3);

        if (inheritedReferenceUrls.length > 0) {
          console.log('[useAgentOrchestrator] Follow-up edit: auto-injecting reference URLs:', inheritedReferenceUrls);
        }
      }
      // ────────────────────────────────────────────────────────────────────────

      const taskMetadata = {
        ...(metadata || {}),
        imageHostProvider: hostProvider,
        topicId,
        topicPinnedContext,
        taskMode: inferredTaskMode,
        originalMessage: message,
        optimizedMessage: optimizedMessageForTrace,
        optimizerUsed,
        optimizerStatus,
        allReferenceImageUrls: [...uploadedUrls],
        injectedReferenceImageUrls: [] as string[],
        multimodalContext: {
          ...(metadata?.multimodalContext || {}),
          referenceImageUrls: [
            ...topicPinnedRefs,
            ...((metadata?.multimodalContext?.referenceImageUrls || [])),
            ...uploadedUrls,
            ...inheritedReferenceUrls,  // ← 自动继承上次生成图
          ].filter((url, idx, arr) => typeof url === 'string' && !!url && arr.indexOf(url) === idx),
          hasReferenceImages:
            topicPinnedRefs.length +
            (((metadata?.multimodalContext?.referenceImageUrls as string[]) || []).length) +
            uploadedUrls.length +
            inheritedReferenceUrls.length >
            0,
          referenceSummary: summarizeReferenceSet([
            ...topicPinnedRefs,
            ...((metadata?.multimodalContext?.referenceImageUrls || [])),
            ...uploadedUrls,
            ...inheritedReferenceUrls,
          ]),
        },
      };

      const existingDesignSession = projectContext.designSession;
      const sessionConstraints = extractConstraintHints(message);
      projectActions.updateDesignSession({
        taskMode: inferredTaskMode,
        referenceSummary: taskMetadata.multimodalContext.referenceSummary,
        subjectAnchors: taskMetadata.multimodalContext.referenceImageUrls.slice(0, 8),
        styleHints: mergeUniqueStrings([
          ...(existingDesignSession?.styleHints || []),
          typeof metadata?.creationMode === 'string' ? metadata.creationMode : '',
          typeof metadata?.multimodalContext?.research?.reportBrief === 'string'
            ? metadata.multimodalContext.research.reportBrief
            : '',
        ].filter(Boolean), [], 8),
        constraints: mergeUniqueStrings([
          ...(existingDesignSession?.constraints || []),
          ...sessionConstraints,
        ], [], 20),
        researchSummary: typeof metadata?.multimodalContext?.research?.reportBrief === 'string'
          ? metadata.multimodalContext.research.reportBrief
          : existingDesignSession?.researchSummary,
        referenceWebPages: Array.isArray(metadata?.multimodalContext?.referenceWebPages)
          ? metadata.multimodalContext.referenceWebPages.slice(0, 8)
          : existingDesignSession?.referenceWebPages,
      });

      if (topicId) {
        const researchBrief = metadata?.multimodalContext?.research?.reportBrief;
        const topicConstraints = mergeUniqueStrings(
          sessionConstraints,
          typeof researchBrief === 'string' && researchBrief ? [researchBrief] : [],
          20,
        );
        const topicDecisions = mergeUniqueStrings(
          existingDesignSession?.styleHints || [],
          typeof metadata?.creationMode === 'string' ? [metadata.creationMode] : [],
          20,
        );
        await upsertTopicSnapshot(topicId, {
          summaryText: taskMetadata.multimodalContext.referenceSummary || existingDesignSession?.referenceSummary || '',
          pinned: {
            constraints: topicConstraints,
            decisions: topicDecisions,
          },
        });
      }

      if (topicId && taskMetadata.multimodalContext.referenceSummary) {
        await upsertTopicSnapshot(topicId, {
          summaryText: taskMetadata.multimodalContext.referenceSummary,
        });
      }

      const originalAttachmentCount = attachments?.length || 0;
      const originalUploadedCount = uploadedUrls.length;

      const task: AgentTask = {
        id: `task-${Date.now()}`,
        agentId: decision.targetAgent,
        status: 'pending',
        input: {
          message: messageForExecution,
          attachments,
          uploadedAttachments: uploadedUrls.length > 0 ? uploadedUrls : undefined,
          context: updatedContext,
          metadata: taskMetadata,
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const passthroughAttachmentCount = task.input.attachments?.length || 0;
      const passthroughUploadedCount = task.input.uploadedAttachments?.length || 0;
      if (
        passthroughAttachmentCount !== originalAttachmentCount ||
        passthroughUploadedCount !== originalUploadedCount
      ) {
        const err =
          `[useAgentOrchestrator] Attachment passthrough mismatch: attachments ${passthroughAttachmentCount}/${originalAttachmentCount}, uploaded ${passthroughUploadedCount}/${originalUploadedCount}`;
        if (viteEnv.MODE === 'test' || viteEnv.DEV) {
          throw new Error(err);
        }
        console.error(err);
      }

      setCurrentTask({ ...task, status: 'analyzing' });

      console.log('[useAgentOrchestrator] Executing task...');

      // Auto-switch to executing after 200ms
      executingTimer = setTimeout(() => {
        const cur = useAgentStore.getState().currentTask;
        if (cur && cur.status === 'analyzing') {
          setCurrentTask({ ...cur, status: 'executing' });
        }
      }, 200);

      console.log('[useAgentOrchestrator] 发起 Agent 执行请求...');
      const result = await withTimeout(
        executeAgentTask(task),
        AGENT_EXECUTION_TIMEOUT_MS,
        '任务执行超时，请稍后重试'
      );
      console.log('[useAgentOrchestrator] 收到 Agent 执行回复');
      if (executingTimer) {
        clearTimeout(executingTimer);
        executingTimer = null;
      }
      console.log('[useAgentOrchestrator] Task result:', result.status);

      if (result.output?.assets && result.output.assets.length > 0) {
        console.log('[useAgentOrchestrator] Auto-adding assets to canvas...');
        addAssetsToCanvas(result.output.assets);
      }

      const approvedUrls = [
        ...(result.output?.imageUrls || []),
        ...((result.output?.assets || [])
          .filter((asset) => asset?.type === 'image' && typeof asset.url === 'string')
          .map((asset) => asset.url)),
      ].filter((url, index, arr) => !!url && arr.indexOf(url) === index);

      if (topicId && approvedUrls.length > 0) {
        const approvedAssetIds = mergeUniqueStrings(
          useProjectStore.getState().designSession.approvedAssetIds || [],
          approvedUrls,
          12,
        );
        projectActions.updateDesignSession({
          approvedAssetIds,
          subjectAnchors: mergeUniqueStrings(
            useProjectStore.getState().designSession.subjectAnchors || [],
            approvedUrls,
            8,
          ),
          referenceSummary: summarizeReferenceSet(approvedUrls),
        });

        for (const url of approvedUrls.slice(0, 4)) {
          await rememberApprovedAsset(topicId, {
            url,
            role: 'result',
            summary: summarizeReferenceSet([url]),
            decision: `Agent 输出已采用为后续设计锚点: ${decision.targetAgent}`,
          });
        }
      }

      setCurrentTask(result);

      // Messages are managed by Workspace via addMessage — no need to push here

      return result;
    } catch (error) {
      console.error('Agent Pipeline Failure', { stage: 'processMessage', error });
      console.error('生成流中断:', error);
      console.error('[useAgentOrchestrator] Error:', error);
      const rawMessage = error instanceof Error ? error.message : String(error || '');
      const imageFailure = /图片|image|upload|base64|attachment|mime|格式/i.test(rawMessage);
      const failMessage = imageFailure
        ? '图片处理失败，请检查网络或重新上传'
        : '抱歉，生成过程中遇到网络或解析错误，请重试。';
      const errorTask: AgentTask = {
        id: `task-${Date.now()}`,
        agentId: 'coco' as AgentType,
        status: 'failed',
        input: { message, context: projectContext },
        output: {
          message: failMessage
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setCurrentTask(errorTask);
      return errorTask;
    } finally {
      if (executingTimer) {
        clearTimeout(executingTimer);
      }
      setIsUploadingAttachments(false);
      isProcessingRef.current = false;
      setIsProcessing(false);

      if (messageQueue.current.length > 0) {
        const next = messageQueue.current.shift()!;
        queueMicrotask(() => {
          processMessage(next.message, next.attachments, next.metadata, next.userMessageId);
        });
      }
    }
  }, [projectContext, addAssetsToCanvas]);

  const executeProposal = useCallback(async (proposalId: string): Promise<void> => {
    const curTask = useAgentStore.getState().currentTask;
    const projectActions = useProjectStore.getState().actions;
    if (!curTask || !curTask.output?.proposals) {
      console.error('[useAgentOrchestrator] No current task or proposals');
      return;
    }

    const proposal = curTask.output.proposals.find(p => p.id === proposalId);
    if (!proposal) {
      console.error('[useAgentOrchestrator] Proposal not found:', proposalId);
      return;
    }

    try {
      console.log('[useAgentOrchestrator] Executing proposal:', proposal.title);

      setCurrentTask({ ...curTask, status: 'executing' });

      const task: AgentTask = {
        id: `task-${Date.now()}`,
        agentId: curTask.agentId,
        status: 'executing',
        input: {
          message: `执行方案: ${proposal.title}`,
          attachments: curTask.input.attachments,
          uploadedAttachments: curTask.input.uploadedAttachments,
          context: curTask.input.context || projectContext,
          metadata: {
            ...(curTask.input.metadata || {}),
            forceSkills: true,
            executeProposalId: proposal.id,
            selectedSkillCalls: (proposal.skillCalls || []).map(call => ({
              ...call,
              params: { ...(call.params || {}) }
            }))
          }
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      console.log('[useAgentOrchestrator] Proposal request start', { proposalId });
      const result = await withTimeout(
        executeAgentTask(task),
        AGENT_EXECUTION_TIMEOUT_MS,
        '方案执行超时，请稍后重试'
      );
      console.log('[useAgentOrchestrator] Proposal request done', { status: result.status });
      console.log('[useAgentOrchestrator] Proposal execution result:', result.status);

      if (result.output?.assets && result.output.assets.length > 0) {
        console.log('[useAgentOrchestrator] Auto-adding proposal assets to canvas...');
        addAssetsToCanvas(result.output.assets);
      }

      const proposalApprovedUrls = [
        ...(result.output?.imageUrls || []),
        ...((result.output?.assets || [])
          .filter((asset) => asset?.type === 'image' && typeof asset.url === 'string')
          .map((asset) => asset.url)),
      ].filter((url, index, arr) => !!url && arr.indexOf(url) === index);

      const proposalTopicId = curTask.input.metadata?.topicId as string | undefined;
      if (proposalTopicId && proposalApprovedUrls.length > 0) {
        projectActions.updateDesignSession({
          approvedAssetIds: mergeUniqueStrings(
            useProjectStore.getState().designSession.approvedAssetIds || [],
            proposalApprovedUrls,
            12,
          ),
          subjectAnchors: mergeUniqueStrings(
            useProjectStore.getState().designSession.subjectAnchors || [],
            proposalApprovedUrls,
            8,
          ),
          referenceSummary: summarizeReferenceSet(proposalApprovedUrls),
        });

        for (const url of proposalApprovedUrls.slice(0, 4)) {
          await rememberApprovedAsset(proposalTopicId, {
            url,
            role: 'result',
            summary: summarizeReferenceSet([url]),
            decision: `方案执行结果已采用: ${proposal.title}`,
          });
        }
      }

      setCurrentTask(result);
    } catch (error) {
      console.error('Agent Pipeline Failure', { stage: 'executeProposal', error });
      console.error('[useAgentOrchestrator] Proposal execution error:', error);
      const cur = useAgentStore.getState().currentTask;
      if (cur) {
        setCurrentTask({
          ...cur,
          status: 'failed',
          output: {
            ...(cur.output || {}),
            message: '抱歉，生成过程中遇到网络或解析错误，请重试。'
          },
          updatedAt: Date.now()
        });
      }
      return;
    }
  }, [projectContext, addAssetsToCanvas]);

  const resetAgent = useCallback(() => {
    setCurrentTask(null);
    useAgentStore.getState().actions.clearMessages();
  }, []);

  return {
    currentTask,
    isAgentMode,
    isProcessing,
    isUploadingAttachments,
    processMessage,
    executeProposal,
    addAssetsToCanvas,
    resetAgent,
  };
}
