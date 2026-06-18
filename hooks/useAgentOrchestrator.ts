import { useState, useCallback, useRef } from 'react';
import { AgentTask, ProjectContext, GeneratedAsset, AgentTaskMetadata } from '../types/agent.types';
import { executeAgentTask } from '../services/agents';
import { CanvasElement } from '../types';
import { getTaskOutputProposals } from '../services/agents/agent-task-output';
import { useAgentStore } from '../stores/agent.store';
import { useImageHostStore } from '../stores/imageHost.store';
import { useProjectStore } from '../stores/project.store';
import { saveLatestAgentRoleDraft } from '../services/agents/role-draft-store';
import {
  shouldPreferAutonomousChatFallback as shouldPreferAutonomousChatFallbackModule,
} from '../services/agents/orchestrator-routing';
import {
  getReferenceResolutionPolicy,
} from '../services/agents/orchestrator-multimodal';
import {
  buildAutoRoleSessionState,
  buildImmediateResponseTask,
  buildRolePromptAddonFromDecision,
  shouldUseImmediateResponseShortcut,
} from '../services/agents/orchestrator-task-assembly';
import {
  maybeResolvePipeline,
  resolveRoutingDecision,
} from '../services/agents/orchestrator-routing-execution';
import { prepareAgentExecutionTask, prepareOrchestratorContext } from '../services/agents/orchestrator-preparation';
import {
  executeProposalTaskFlow,
} from '../services/agents/orchestrator-proposal-execution';
import {
  buildProcessMessageErrorTask,
  buildProposalExecutionErrorTask,
  finalizeExecutionSuccess,
} from '../services/agents/orchestrator-result-handlers';
import {
  dequeueNextOrchestratorMessage,
  enqueueOrchestratorMessage,
} from '../services/agents/orchestrator-queue';
import { withTimeout } from '../services/agents/timeout-utils';

const viteEnv =
  ((import.meta as unknown as {
    env?: Record<string, string | boolean | undefined>;
  }).env || {});

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
  onAssetsGenerated?: (assets: GeneratedAsset[]) => Promise<void> | void;
}

export function useAgentOrchestrator(options: UseAgentOrchestratorOptions) {
  const {
    projectContext,
    canvasState,
    onElementsUpdate,
    onHistorySave,
    autoAddToCanvas = true,
    onAssetsGenerated,
  } = options;

  // Read from store instead of local state
  const currentTask = useAgentStore(s => s.currentTask);
  const isAgentMode = useAgentStore(s => s.isAgentMode);
  const currentAutoRoleSession = useAgentStore(s => s.currentAutoRoleSession);
  const { setCurrentTask, setCurrentAutoRoleSession, setChatAbortController } = useAgentStore(s => s.actions);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const isProcessingRef = useRef(false);
  const writtenAssetKeysRef = useRef<Set<string>>(new Set());
  const messageQueue = useRef<Array<{
    message: string;
    attachments?: File[];
    metadata?: AgentTaskMetadata;
    userMessageId?: string;
  }>>([]);

  const addAssetsToCanvas = useCallback(async (assets: GeneratedAsset[]) => {
    if (!autoAddToCanvas || assets.length === 0) {
      console.log('[useAgentOrchestrator] Canvas integration disabled or not configured');
      return;
    }

    try {
      const pendingAssets = assets.filter((asset) => {
        const url = typeof asset?.url === 'string' ? asset.url.trim() : '';
        if (!url) return false;
        const key = `${asset.type}:${url}`;
        return !writtenAssetKeysRef.current.has(key);
      });

      if (pendingAssets.length === 0) {
        console.log('[useAgentOrchestrator] Skipping canvas writeback; all assets already inserted');
        return;
      }

      console.log('[useAgentOrchestrator] Processing', pendingAssets.length, 'assets for canvas');

      if (onAssetsGenerated) {
        console.log('[useAgentOrchestrator] Handing assets to workspace-aware insertion');
        await onAssetsGenerated(pendingAssets);
        pendingAssets.forEach((asset) => {
          writtenAssetKeysRef.current.add(`${asset.type}:${asset.url.trim()}`);
        });
        return;
      }

      if (!canvasState || !onElementsUpdate) {
        console.log('[useAgentOrchestrator] Canvas integration disabled or not configured');
        return;
      }

      const newElements: CanvasElement[] = pendingAssets.map((asset, index) => ({
        id: asset.id || `agent-asset-${Date.now()}-${index}`,
        type: asset.type === 'video' ? 'gen-video' : 'gen-image',
        url: asset.url,
        originalUrl: asset.url,
        x: 100 + index * 40,
        y: 100 + index * 40,
        width: asset.metadata.width || 512,
        height: asset.metadata.height || 512,
        zIndex: canvasState.elements.length + index + 1,
        genPrompt: asset.metadata.prompt,
        genModel: asset.metadata.model as any,
      }));

      console.log('[useAgentOrchestrator] Created', newElements.length, 'legacy canvas elements');

      const updatedElements = [...canvasState.elements, ...newElements];
      onElementsUpdate(updatedElements);

      if (onHistorySave) {
        onHistorySave(updatedElements, []);
      }

      console.log('[useAgentOrchestrator] Canvas updated successfully');
      pendingAssets.forEach((asset) => {
        writtenAssetKeysRef.current.add(`${asset.type}:${asset.url.trim()}`);
      });
    } catch (error) {
      console.error('[useAgentOrchestrator] Failed to add assets to canvas:', error);
    }
  }, [autoAddToCanvas, canvasState, onAssetsGenerated, onElementsUpdate, onHistorySave]);

  const processMessage = useCallback(async (
    message: string,
    attachments?: File[],
    metadata?: AgentTaskMetadata,
    userMessageId?: string
  ): Promise<AgentTask | null> => {
    if (!message.trim()) return null;

    if (isProcessingRef.current) {
      const queueSize = enqueueOrchestratorMessage(messageQueue.current, {
        message,
        attachments,
        metadata,
        userMessageId,
      });
      console.log('[useAgentOrchestrator] Message queued, queue size:', queueSize);
      return null;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    const chatAbortController = new AbortController();
    setChatAbortController(chatAbortController);

    let executingTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      console.log('[useAgentOrchestrator] Processing message:', message.substring(0, 50));

      const freshDesignSession = useProjectStore.getState().designSession;
      const projectActions = useProjectStore.getState().actions;
      const { shouldPreferUploadedReferences } = getReferenceResolutionPolicy(metadata);
      const hostProvider = useImageHostStore.getState().selectedProvider;

      const {
        uploadedUrls,
        updatedContext,
        topicId,
        topicPinnedContext,
        topicPinnedRefs,
        inferredTaskMode,
        messageForExecution,
        pinnedAgent,
        useOptimizeThenExecute,
        optimizerUsed,
        optimizerStatus,
        optimizedMessageForTrace,
        isUnifiedSidebarAgent,
      } = await prepareOrchestratorContext({
        message,
        attachments,
        metadata: {
          ...(metadata || {}),
          signal: chatAbortController.signal,
        },
        userMessageId,
        projectContext,
        freshDesignSession,
        brandInfo: useProjectStore.getState().brandInfo,
        conversationHistory: useAgentStore.getState().messages.slice(-MAX_ORCHESTRATOR_HISTORY_MESSAGES),
        selectedHostProvider: hostProvider,
        setIsUploadingAttachments,
        setCurrentTask,
        updateMessageAttachments: useAgentStore.getState().actions.updateMessageAttachments,
        setTaskMode: projectActions.setTaskMode,
      });

      const pipelineRun = await maybeResolvePipeline({
        message: messageForExecution,
        isUnifiedSidebarAgent,
        useOptimizeThenExecute,
        updatedContext,
        timeoutMs: PIPELINE_EXECUTION_TIMEOUT_MS,
        withTimeout,
        onStep: (stepIdx, stepResult) => {
          console.log(`[useAgentOrchestrator] Pipeline step ${stepIdx} done:`, stepResult.status);
          setCurrentTask(stepResult);
        },
      });

      if (pipelineRun) {
        const { pipeline, pipelineResult } = pipelineRun;
        console.log('[useAgentOrchestrator] Pipeline detected:', pipeline.name);

        setCurrentTask({
          id: `pipeline-${Date.now()}`,
          agentId: pipeline.steps?.[0]?.agentId || 'poster',
          status: 'analyzing',
          input: { message: messageForExecution, context: updatedContext },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        console.log('[useAgentOrchestrator] Pipeline request start');
        console.log('[useAgentOrchestrator] Pipeline request done');

        if (pipelineResult.allAssets.length > 0) {
          addAssetsToCanvas(pipelineResult.allAssets);
        }

        const lastStep = pipelineResult.steps[pipelineResult.steps.length - 1];
        if (lastStep && lastStep.output) {
          lastStep.output.assets = pipelineResult.allAssets;
        }
        setCurrentTask(lastStep || null);
        return lastStep || null;
      }

      console.log('[useAgentOrchestrator] Routing to agent...');
      const shouldPreferAutonomousChatFallback = shouldPreferAutonomousChatFallbackModule(
        messageForExecution,
        metadata,
        attachments,
      );
      const decision = await resolveRoutingDecision({
        message: messageForExecution,
        metadata: {
          ...(metadata || {}),
          signal: chatAbortController.signal,
        },
        attachments,
        updatedContext,
        pinnedAgent,
        isUnifiedSidebarAgent,
        shouldPreferAutonomousChatFallback,
        optimizerUsed,
        optimizedMessageForTrace,
        withTimeout,
      });

      const executionAgentId = decision.targetAgent || 'coco';
      console.log('[useAgentOrchestrator] Routed to:', executionAgentId);

      if (metadata?.agentSelectionMode === 'auto' && decision.targetAgent) {
        setCurrentAutoRoleSession(buildAutoRoleSessionState(decision));
      } else {
        setCurrentAutoRoleSession(null);
      }

      if (decision.roleDraft && decision.targetAgent) {
        saveLatestAgentRoleDraft(decision.targetAgent, decision.roleDraft, {
          roleStrategy: decision.roleStrategy,
          roleStrategyReason: decision.roleStrategyReason,
        });
      }

      const rolePromptLayer = buildRolePromptAddonFromDecision(
        decision,
        messageForExecution,
      );

      if (shouldUseImmediateResponseShortcut(decision, metadata)) {
        const responseTask = buildImmediateResponseTask({
          decision,
          messageForExecution,
          attachments,
          uploadedUrls,
          updatedContext,
          metadata,
        });
        setCurrentTask(responseTask);
        return responseTask;
      }

      if (decision.action === 'respond' || decision.action === 'clarify') {
        console.warn(
          '[useAgentOrchestrator] Autonomous routing request returned a direct-response decision; bypassing immediate shortcut and forcing agent execution.',
          {
            action: decision.action,
            targetAgent: decision.targetAgent,
            allowAutonomousRouting: metadata?.allowAutonomousRouting === true,
          },
        );
      }

      const lastTask = useAgentStore.getState().currentTask;
      const { task, inheritedReferenceUrls } = await prepareAgentExecutionTask({
        agentId: executionAgentId,
        message,
        messageForExecution,
        attachments,
        metadata: {
          ...(metadata || {}),
          signal: chatAbortController.signal,
        },
        uploadedUrls,
        updatedContext,
        projectActions,
        existingDesignSession: projectContext.designSession || freshDesignSession,
        hostProvider,
        topicId,
        topicPinnedContext,
        topicPinnedRefs,
        inferredTaskMode,
        optimizerUsed,
        optimizerStatus,
        optimizedMessageForTrace,
        originalMessage: message,
        shouldPreferUploadedReferences,
        roleStrategy: decision.roleStrategy,
        roleStrategyReason: decision.roleStrategyReason,
        roleDraft: decision.roleDraft,
        rolePromptLabel: rolePromptLayer.rolePromptLabel,
        rolePromptAddon: rolePromptLayer.rolePromptAddon,
        currentTaskAssetUrls: (lastTask?.output?.assets || [])
          .map((a: any) => a.url)
          .filter((u: string) => /^https?:\/\//i.test(u)),
        sessionApprovedUrls: (useProjectStore.getState().designSession?.approvedAssetIds || [])
          .filter((u: string) => /^https?:\/\//i.test(u)),
        recentHistoryAttachmentUrls: useAgentStore.getState().messages
          .slice(-6)
          .flatMap((msg: any) => msg.attachments || [])
          .filter((u: string) => /^https?:\/\//i.test(u) && /\.(jpg|jpeg|png|webp|gif)/i.test(u)),
        isAttachmentValidationStrict: Boolean(viteEnv.MODE === 'test' || viteEnv.DEV),
      });

      if (inheritedReferenceUrls.length > 0) {
        console.log('[useAgentOrchestrator] Follow-up edit: auto-injecting reference URLs:', inheritedReferenceUrls);
      }

      setCurrentTask({ ...task, status: 'analyzing' });

      console.log('[useAgentOrchestrator] Executing task...');
      executingTimer = setTimeout(() => {
        const cur = useAgentStore.getState().currentTask;
        if (cur && cur.status === 'analyzing') {
          setCurrentTask({ ...cur, status: 'executing' });
        }
      }, 200);

      console.log('[useAgentOrchestrator] Starting agent execution...');
      const result = await withTimeout(
        executeAgentTask(task),
        AGENT_EXECUTION_TIMEOUT_MS,
        'Agent execution timed out',
      );
      console.log('[useAgentOrchestrator] Agent execution finished');
      if (executingTimer) {
        clearTimeout(executingTimer);
        executingTimer = null;
      }
      console.log('[useAgentOrchestrator] Task result:', result.status);

      await finalizeExecutionSuccess({
        result,
        topicId,
        decisionLabel: `Agent output was adopted as a downstream design anchor: ${executionAgentId}`,
        addAssetsToCanvas,
        updateDesignSession: projectActions.updateDesignSession,
        getCurrentApprovedAssetIds: () =>
          useProjectStore.getState().designSession.approvedAssetIds || [],
        getCurrentSubjectAnchors: () =>
          useProjectStore.getState().designSession.subjectAnchors || [],
      });

      setCurrentTask(result);
      return result;
    } catch (error) {
      if (chatAbortController.signal.aborted) {
        const currentTaskSnapshot = useAgentStore.getState().currentTask;
        const cancelledTask: AgentTask = {
          ...(currentTaskSnapshot || {
            id: `cancelled-${Date.now()}`,
            agentId: 'coco',
            input: {
              message,
              attachments,
              context: projectContext,
              metadata,
            },
            createdAt: Date.now(),
          }),
          status: 'completed',
          output: {
            message: 'Generation stopped.',
            runtime: {
              mode: 'skill-execution',
              stopReason: 'wait-for-input',
              stopReasonLabel: 'need-user-input',
            },
            error: {
              message: 'Generation cancelled by user.',
              code: 'USER_CANCELLED',
            },
          },
          updatedAt: Date.now(),
        };
        setCurrentTask(cancelledTask);
        return cancelledTask;
      }
      console.error('Agent Pipeline Failure', { stage: 'processMessage', error });
      console.error('[useAgentOrchestrator] Error:', error);
      const errorTask = buildProcessMessageErrorTask(
        message,
        projectContext,
        error,
      );
      setCurrentTask(errorTask);
      return errorTask;
    } finally {
      const wasCancelled = chatAbortController.signal.aborted;
      if (executingTimer) {
        clearTimeout(executingTimer);
      }
      setIsUploadingAttachments(false);
      isProcessingRef.current = false;
      setIsProcessing(false);
      setChatAbortController(null);

      if (wasCancelled) {
        messageQueue.current.length = 0;
        return;
      }

      const next = dequeueNextOrchestratorMessage(messageQueue.current);
      if (next) {
        queueMicrotask(() => {
          processMessage(next.message, next.attachments, next.metadata, next.userMessageId);
        });
      }
    }
  }, [projectContext, addAssetsToCanvas, setCurrentAutoRoleSession]);

  const executeProposal = useCallback(async (proposalId: string): Promise<void> => {
    const curTask = useAgentStore.getState().currentTask;
    const projectActions = useProjectStore.getState().actions;
    const currentProposals = getTaskOutputProposals(curTask);
    if (!curTask || currentProposals.length === 0) {
      console.error('[useAgentOrchestrator] No current task or proposals');
      return;
    }

    const proposal = currentProposals.find(p => p.id === proposalId);
    if (!proposal) {
      console.error('[useAgentOrchestrator] Proposal not found:', proposalId);
      return;
    }

    try {
      console.log('[useAgentOrchestrator] Executing proposal:', proposal.title);

      setCurrentTask({ ...curTask, status: 'executing' });

      const { result } = await executeProposalTaskFlow({
        curTask,
        proposalId,
        projectContext,
        executeTask: async (task) => {
          console.log('[useAgentOrchestrator] Proposal request start', { proposalId });
          const result = await withTimeout(
            executeAgentTask(task),
            AGENT_EXECUTION_TIMEOUT_MS,
            '方案执行超时，请稍后重试'
          );
          console.log('[useAgentOrchestrator] Proposal request done', { status: result.status });
          return result;
        },
        addAssetsToCanvas: async (assets) => {
          if (assets.length > 0) {
            console.log('[useAgentOrchestrator] Auto-adding proposal assets to canvas...');
          }
          await addAssetsToCanvas(assets);
        },
        updateDesignSession: projectActions.updateDesignSession,
        getCurrentApprovedAssetIds: () =>
          useProjectStore.getState().designSession.approvedAssetIds || [],
        getCurrentSubjectAnchors: () =>
          useProjectStore.getState().designSession.subjectAnchors || [],
      });
      console.log('[useAgentOrchestrator] Proposal execution result:', result.status);

      setCurrentTask(result);
    } catch (error) {
      console.error('Agent Pipeline Failure', { stage: 'executeProposal', error });
      console.error('[useAgentOrchestrator] Proposal execution error:', error);
      const cur = useAgentStore.getState().currentTask;
      if (cur) {
        setCurrentTask(buildProposalExecutionErrorTask(cur));
      }
      return;
    }
  }, [projectContext, addAssetsToCanvas]);

  const resetAgent = useCallback(() => {
    setCurrentTask(null);
    setCurrentAutoRoleSession(null);
    useAgentStore.getState().actions.clearMessages();
  }, [setCurrentAutoRoleSession]);

  return {
    currentTask,
    currentAutoRoleSession,
    isAgentMode,
    isProcessing,
    isUploadingAttachments,
    processMessage,
    executeProposal,
    addAssetsToCanvas,
    resetAgent,
  };
}
