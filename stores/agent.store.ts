import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  AgentRoleDraft,
  AgentTask,
  AgentType,
  RoleGovernanceMode,
  RoleSource,
} from '../types/agent.types.ts';
import type {
  CanvasElement,
  ChatMessage,
  ImageModel,
  ImageTextEditBlock,
  InputBlock,
  VideoModel,
  WorkspaceInputFile,
} from '../types/index.ts';
import {
  appendSanitizedProgressMessage,
  sanitizeAgentProgressLog,
  sanitizeAgentProgressMessage,
} from '../services/agents/progress-sanitizer.ts';

type VideoGenDuration = NonNullable<CanvasElement['genDuration']>;
type VideoGenQuality = NonNullable<CanvasElement['genQuality']>;

let inputBlockIdCounter = 0;

export const createInputBlockId = (prefix: string = 'text'): string => {
  inputBlockIdCounter += 1;
  return `${prefix}-${Date.now()}-${inputBlockIdCounter.toString(36)}`;
};

export interface AgentComposerState {
  inputBlocks: InputBlock[];
  activeBlockId: string;
  selectionIndex: number | null;
  selectionRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
  pendingAttachments: AttachmentItem[];
  confirmedAttachments: AttachmentItem[];
}

export interface AgentGenerationState {
  imageGenRatio: string;
  imageGenRes: '1K' | '2K' | '4K';
  imageGenCount: number;
  imageGenUploads: File[];
  isPickingFromCanvas: boolean;
  videoGenRatio: string;
  videoGenDuration: VideoGenDuration;
  videoGenQuality: VideoGenQuality;
  videoGenModel: VideoModel;
  videoGenMode: 'startEnd' | 'multiRef';
  videoStartFrame: File | null;
  videoEndFrame: File | null;
  videoMultiRefs: File[];
  showVideoModelDropdown: boolean;
}

export type AttachmentSource = 'upload' | 'canvas';

export interface AttachmentItem {
  id: string;
  file: WorkspaceInputFile;
  source: AttachmentSource;
  canvasElId?: string;
}

const ensureAttachmentId = (file: WorkspaceInputFile): string => {
  if (typeof file._attachmentId === 'string' && file._attachmentId) {
    return file._attachmentId;
  }
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  file._attachmentId = id;
  return id;
};

const collectConfirmedAttachmentsFromBlocks = (blocks: InputBlock[]): AttachmentItem[] => {
  const items: AttachmentItem[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    if (block.type !== 'file' || !block.file) continue;
    const file = block.file;
    const id = ensureAttachmentId(file);
    if (seen.has(id)) continue;
    seen.add(id);

    const source: AttachmentSource = (file._canvasElId || file._canvasAutoInsert) ? 'canvas' : 'upload';
    items.push({
      id,
      file,
      source,
      canvasElId: typeof file._canvasElId === 'string' ? file._canvasElId : undefined,
    });
  }

  return items;
};

type InputComposerState = Pick<
  AgentComposerState,
  'inputBlocks' | 'activeBlockId' | 'selectionIndex'
>;

const appendFileBlockToInput = (
  state: InputComposerState,
  file: WorkspaceInputFile,
) => {
  if (state.inputBlocks.length === 0) {
    state.inputBlocks.push({ id: createInputBlockId('text'), type: 'text', text: '' });
  }

  const fileBlock: InputBlock = { id: createInputBlockId('file'), type: 'file', file };
  const lastIndex = state.inputBlocks.length - 1;
  const lastBlock = state.inputBlocks[lastIndex];

  if (lastBlock?.type === 'text') {
    const lastText = lastBlock.text || '';

    if (lastText.length > 0) {
      const textBlock: InputBlock = { id: createInputBlockId('text'), type: 'text', text: '' };
      state.inputBlocks.push(fileBlock, textBlock);
      state.activeBlockId = textBlock.id;
      state.selectionIndex = 0;
      return;
    }

    state.inputBlocks.splice(lastIndex, 0, fileBlock);
    state.activeBlockId = lastBlock.id;
    state.selectionIndex = 0;
  } else {
    const textBlock: InputBlock = { id: createInputBlockId('text'), type: 'text', text: '' };
    state.inputBlocks.push(fileBlock, textBlock);
    state.activeBlockId = textBlock.id;
    state.selectionIndex = 0;
  }

  state.inputBlocks = normalizeInputBlocks(state.inputBlocks);
};

const insertFileBlockAtSelection = (
  state: InputComposerState,
  file: WorkspaceInputFile,
) => {
  const activeIndex = state.inputBlocks.findIndex(
    (b) => b.id === state.activeBlockId,
  );

  if (activeIndex === -1) {
    const fileBlock: InputBlock = { id: createInputBlockId('file'), type: 'file', file };
    const textBlock: InputBlock = { id: createInputBlockId('text'), type: 'text', text: '' };
    state.inputBlocks.push(fileBlock, textBlock);
    state.activeBlockId = textBlock.id;
    state.selectionIndex = 0;
    return;
  }

  const activeBlock = state.inputBlocks[activeIndex];

  if (activeBlock.type === 'text') {
    const text = activeBlock.text || '';
    const idx = state.selectionIndex !== null ? state.selectionIndex : text.length;
    const preText = text.slice(0, idx);
    const postText = text.slice(idx);
    const newTextBlockId = createInputBlockId('text');

    const newBlocks: InputBlock[] = [
      { ...activeBlock, text: preText },
      { id: createInputBlockId('file'), type: 'file', file },
      { id: newTextBlockId, type: 'text', text: postText },
    ];

    state.inputBlocks.splice(activeIndex, 1, ...newBlocks);
    state.activeBlockId = newTextBlockId;
    state.selectionIndex = 0;
    return;
  }

  const fileBlock: InputBlock = { id: createInputBlockId('file'), type: 'file', file };
  const textBlock: InputBlock = { id: createInputBlockId('text'), type: 'text', text: '' };
  state.inputBlocks.push(fileBlock, textBlock);
  state.activeBlockId = textBlock.id;
  state.selectionIndex = 0;
};

// ─── Pure helper: normalize input blocks ───
export function normalizeInputBlocks(blocks: InputBlock[]): InputBlock[] {
  if (blocks.length === 0) return [{ id: createInputBlockId('text'), type: 'text', text: '' }];
  const result: InputBlock[] = [];
  const seenIds = new Set<string>();
  for (const block of blocks) {
    const last = result[result.length - 1];

    if (block.type === 'file' && last?.type === 'file') {
      result.push({ id: createInputBlockId('text'), type: 'text', text: '' });
    }

    if (block.type === 'text') {
      const currentLast = result[result.length - 1];
      if (currentLast && currentLast.type === 'text') {
        currentLast.text = (currentLast.text || '') + (block.text || '');
        continue;
      }
    }
    const candidateId = String(block.id || '').trim();
    const nextBlockId =
      candidateId && !seenIds.has(candidateId)
        ? candidateId
        : createInputBlockId(block.type === 'file' ? 'file' : 'text');
    seenIds.add(nextBlockId);
    result.push({ ...block, id: nextBlockId });
  }
  if (result[result.length - 1]?.type === 'file') {
    result.push({ id: createInputBlockId('text'), type: 'text', text: '' });
  }
  return result;
}

interface AgentState {
  // 智能体模式
  isAgentMode: boolean;

  // 当前任务
  currentTask: AgentTask | null;

  // 消息和输入
  messages: ChatMessage[];
  composer: AgentComposerState;

  // 聊天状态
  isTyping: boolean;
  chatAbortController: AbortController | null;

  // 模型配置
  modelMode: 'thinking' | 'fast';
  webEnabled: boolean;
  agentSelectionMode: 'auto' | 'manual';
  pinnedAgentId: AgentType;
  selectedRoleId: string | null;
  selectedRoleSource: RoleSource | null;
  baseAgentId: AgentType;
  roleGovernanceMode: RoleGovernanceMode;
  allowMainBrainRoleMutation: boolean;
  allowMainBrainRolePromotion: boolean;
  currentAutoRoleSession: {
    targetAgent: AgentType;
    targetRoleId?: string | null;
    roleStrategy: 'reuse' | 'augment' | 'create';
    roleStrategyReason: string;
    roleDraft: AgentRoleDraft | null;
    updatedAt: number;
  } | null;
  imageModelEnabled: boolean;
  translatePromptToEnglish: boolean;
  enforceChineseTextInImage: boolean;
  requiredChineseCopy: string;

  // 图像生成器配置
  generation: AgentGenerationState;

  // 文本编辑
  detectedTexts: ImageTextEditBlock[];
  editedTexts: ImageTextEditBlock[];
  isExtractingText: boolean;

  // 快捷编辑
  fastEditPrompt: string;

  // 擦除工具
  brushSize: number;
  upscaleMenuOpen: boolean;

  // Actions
  actions: {
    setIsAgentMode: (mode: boolean) => void;

    setCurrentTask: (task: AgentTask | null) => void;

    addMessage: (message: ChatMessage) => void;
    updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
    updateMessageAttachments: (messageId: string, attachments: string[]) => void;
    setMessages: (messages: ChatMessage[]) => void;
    clearMessages: () => void;

    setInputBlocks: (blocks: InputBlock[]) => void;
    addInputBlock: (block: InputBlock) => void;
    removeInputBlock: (id: string) => void;
    updateInputBlock: (id: string, updates: Partial<InputBlock>) => void;
    setActiveBlockId: (id: string) => void;
    setSelectionIndex: (index: number | null) => void;
    setSelectionRect: (rect: AgentComposerState['selectionRect']) => void;
    insertInputFile: (file: File) => void;
    appendInputFile: (file: File) => void;
    setPendingAttachments: (attachments: AttachmentItem[]) => void;
    addPendingAttachment: (attachment: AttachmentItem) => void;
    removePendingAttachment: (id: string) => void;
    confirmPendingAttachments: () => void;
    clearPendingAttachments: () => void;

    setIsTyping: (typing: boolean) => void;
    setChatAbortController: (controller: AbortController | null) => void;
    cancelChatGeneration: () => void;

    setModelMode: (mode: 'thinking' | 'fast') => void;
    setWebEnabled: (enabled: boolean) => void;
    setAgentSelectionMode: (mode: 'auto' | 'manual') => void;
    setPinnedAgentId: (agentId: AgentType) => void;
    setSelectedRoleSelection: (selection: {
      roleId: string | null;
      roleSource?: RoleSource | null;
      baseAgentId?: AgentType;
      governanceMode?: RoleGovernanceMode;
      allowMainBrainRoleMutation?: boolean;
      allowMainBrainRolePromotion?: boolean;
    }) => void;
    clearSelectedRoleSelection: () => void;
    setCurrentAutoRoleSession: (
      session: AgentState['currentAutoRoleSession'],
    ) => void;
    setImageModelEnabled: (enabled: boolean) => void;
    setTranslatePromptToEnglish: (enabled: boolean) => void;
    setEnforceChineseTextInImage: (enabled: boolean) => void;
    setRequiredChineseCopy: (copy: string) => void;

    setImageGenRatio: (ratio: string) => void;
    setImageGenRes: (res: '1K' | '2K' | '4K') => void;
    setImageGenCount: (count: number) => void;
    setImageGenUploads: (files: File[]) => void;
    setIsPickingFromCanvas: (picking: boolean) => void;

    setVideoGenRatio: (ratio: string) => void;
    setVideoGenDuration: (duration: VideoGenDuration) => void;
    setVideoGenQuality: (quality: VideoGenQuality) => void;
    setVideoGenModel: (model: VideoModel) => void;
    setVideoGenMode: (mode: 'startEnd' | 'multiRef') => void;
    setVideoStartFrame: (file: File | null) => void;
    setVideoEndFrame: (file: File | null) => void;
    setVideoMultiRefs: (refs: File[]) => void;
    setShowVideoModelDropdown: (show: boolean) => void;

    setDetectedTexts: (texts: ImageTextEditBlock[]) => void;
    setEditedTexts: (texts: ImageTextEditBlock[]) => void;
    setIsExtractingText: (extracting: boolean) => void;

    setFastEditPrompt: (prompt: string) => void;

    setBrushSize: (size: number) => void;
    setUpscaleMenuOpen: (open: boolean) => void;

    reset: () => void;
  };
}

const initialState: Omit<AgentState, 'actions'> = {
  isAgentMode: false,

  currentTask: null,

  messages: [],
  composer: {
    inputBlocks: [{ id: 'init', type: 'text' as const, text: '' }],
    activeBlockId: 'init',
    selectionIndex: null,
    selectionRect: null,
    pendingAttachments: [] as AttachmentItem[],
    confirmedAttachments: [] as AttachmentItem[],
  },

  isTyping: false,
  chatAbortController: null,

  modelMode: 'fast' as const,
  webEnabled: false,
  agentSelectionMode: 'auto' as const,
  pinnedAgentId: 'coco' as AgentType,
  selectedRoleId: null,
  selectedRoleSource: null,
  baseAgentId: 'coco' as AgentType,
  roleGovernanceMode: 'manual_only' as RoleGovernanceMode,
  allowMainBrainRoleMutation: false,
  allowMainBrainRolePromotion: false,
  currentAutoRoleSession: null,
  imageModelEnabled: false,
  translatePromptToEnglish: false,
  enforceChineseTextInImage: false,
  requiredChineseCopy: '',

  generation: {
    imageGenRatio: '1:1',
    imageGenRes: '1K',
    imageGenCount: 1,
    imageGenUploads: [] as File[],
    isPickingFromCanvas: false,
    videoGenRatio: '16:9',
    videoGenDuration: '5s',
    videoGenQuality: '1080p',
    videoGenModel: 'veo-3.1-fast-generate-preview' as VideoModel,
    videoGenMode: 'startEnd' as const,
    videoStartFrame: null,
    videoEndFrame: null,
    videoMultiRefs: [] as File[],
    showVideoModelDropdown: false,
  },

  detectedTexts: [],
  editedTexts: [],
  isExtractingText: false,

  fastEditPrompt: '',

  brushSize: 30,
  upscaleMenuOpen: false,
};

export const useAgentStore = create<AgentState>()(
  devtools(
    immer((set) => ({
      ...initialState,

      actions: {
        setIsAgentMode: (mode) => set({ isAgentMode: mode }),

        setCurrentTask: (task) => set((state) => {
          if (!task) {
            state.currentTask = null;
            return;
          }
          // 自动把新的 progressMessage 追加到 progressLog（去重 + 保留历史）
          const isSameTask = state.currentTask?.id === task.id;
          const prevLog = isSameTask
            ? sanitizeAgentProgressLog(state.currentTask?.progressLog || [])
            : [];
          const incomingLog = sanitizeAgentProgressLog(task.progressLog || []);
          const hasIncomingProgressMessage = Object.prototype.hasOwnProperty.call(
            task,
            "progressMessage",
          );
          const previousStreamingText = isSameTask
            ? state.currentTask?.streamingText || ""
            : "";
          const previousReasoningText = isSameTask
            ? state.currentTask?.reasoningText || ""
            : "";
          const previousThoughtTrace = isSameTask
            ? state.currentTask?.thoughtTrace || []
            : [];
          const previousProgressMessage = sanitizeAgentProgressMessage(
            state.currentTask?.progressMessage || "",
          );
          const newMsg = hasIncomingProgressMessage
            ? sanitizeAgentProgressMessage(task.progressMessage)
            : "";
          let log = sanitizeAgentProgressLog([...prevLog, ...incomingLog]);
          if (newMsg) {
            log = appendSanitizedProgressMessage(log, newMsg);
          }
          // 任务切换（新 id）时重置 log
          const progressMessage = hasIncomingProgressMessage
            ? newMsg || (isSameTask ? previousProgressMessage : "") || undefined
            : isSameTask
              ? previousProgressMessage || undefined
              : undefined;
          const nextStreamingText =
            typeof task.streamingText === "string"
              ? task.streamingText
              : isSameTask
                ? previousStreamingText
                : "";
          const nextReasoningText =
            typeof task.reasoningText === "string"
              ? task.reasoningText
              : isSameTask
                ? previousReasoningText
                : "";
          const nextThoughtTrace =
            Array.isArray(task.thoughtTrace) && task.thoughtTrace.length > 0
              ? sanitizeAgentProgressLog(task.thoughtTrace)
              : isSameTask && previousThoughtTrace.length > 0
                ? sanitizeAgentProgressLog(previousThoughtTrace)
                : log;
          state.currentTask = {
            ...state.currentTask,
            ...task,
            progressMessage,
            progressLog: log,
            thoughtTrace: nextThoughtTrace,
            streamingText: nextStreamingText,
            reasoningText: nextReasoningText,
          };
        }),

        addMessage: (message) => set((state) => {
          // 幂等：已存在相同 ID 的消息时跳过，防止重复 key 警告
          if (state.messages.some(m => m.id === message.id)) return;
          state.messages.push(message);
        }),

        updateMessage: (id, updates) => set((state) => {
          const msgIndex = state.messages.findIndex(m => m.id === id);
          if (msgIndex !== -1) {
            const currentMessage = state.messages[msgIndex];
            const nextMessage = { ...currentMessage, ...updates };
            const currentSignature = JSON.stringify({
              text: currentMessage.text ?? null,
              error: Boolean(currentMessage.error),
              agentData: currentMessage.agentData ?? null,
              attachments: currentMessage.attachments ?? null,
            });
            const nextSignature = JSON.stringify({
              text: nextMessage.text ?? null,
              error: Boolean(nextMessage.error),
              agentData: nextMessage.agentData ?? null,
              attachments: nextMessage.attachments ?? null,
            });
            if (currentSignature === nextSignature) {
              return;
            }
            state.messages[msgIndex] = nextMessage;
          }
        }),

        updateMessageAttachments: (messageId, attachments) => set((state) => {
          const msg = state.messages.find(m => m.id === messageId);
          if (msg) {
            msg.attachments = attachments;
            if (Array.isArray(msg.inlineParts) && msg.inlineParts.length > 0) {
              let attachmentIndex = 0;
              msg.inlineParts = msg.inlineParts.map((part) => {
                if (part.type !== 'attachment') {
                  return part;
                }
                const nextUrl = attachments[attachmentIndex] || part.url;
                attachmentIndex += 1;
                return {
                  ...part,
                  url: nextUrl,
                };
              });
            }
          }
        }),

        setMessages: (messages) => set({ messages }),

        clearMessages: () => set((state) => {
          state.messages = [];
          state.composer = {
            ...initialState.composer,
            inputBlocks: [...initialState.composer.inputBlocks],
          };
        }),

        setInputBlocks: (blocks) => {
          const normalized = normalizeInputBlocks(blocks);
          set((state) => {
            state.composer.inputBlocks = normalized;
            state.composer.confirmedAttachments = collectConfirmedAttachmentsFromBlocks(normalized);
          });
        },

        addInputBlock: (block) => set((state) => {
          state.composer.inputBlocks.push(block);
          state.composer.confirmedAttachments = collectConfirmedAttachmentsFromBlocks(state.composer.inputBlocks);
        }),

        removeInputBlock: (id) => set((state) => {
          const idx = state.composer.inputBlocks.findIndex(b => b.id === id);
          if (idx === -1) return;

          const left = state.composer.inputBlocks[idx - 1];
          const right = state.composer.inputBlocks[idx + 1];

          if (left?.type === 'text' && right?.type === 'text') {
            left.text = (left.text || '') + (right.text || '');
            state.composer.inputBlocks.splice(idx, 2);
          } else {
            state.composer.inputBlocks.splice(idx, 1);
            if (state.composer.inputBlocks.length === 0) {
              state.composer.inputBlocks.push({ id: createInputBlockId('text'), type: 'text', text: '' });
            }
          }

          state.composer.confirmedAttachments = collectConfirmedAttachmentsFromBlocks(state.composer.inputBlocks);
        }),

        updateInputBlock: (id, updates) => set((state) => {
          const block = state.composer.inputBlocks.find(b => b.id === id);
          if (!block) return;
          // Fast path: text-only updates on text blocks cannot change
          // confirmedAttachments (only file blocks produce attachments). This
          // runs on every keystroke, so skipping the rescan + array rebuild
          // keeps typing snappy.
          const updateKeys = Object.keys(updates as Record<string, unknown>);
          const isPureTextUpdate =
            block.type === 'text' &&
            updateKeys.length > 0 &&
            updateKeys.every((key) => key === 'text');
          Object.assign(block, updates);
          if (isPureTextUpdate) return;
          state.composer.confirmedAttachments = collectConfirmedAttachmentsFromBlocks(state.composer.inputBlocks);
        }),

        setActiveBlockId: (id) => set((state) => {
          state.composer.activeBlockId = id;
        }),
        setSelectionIndex: (index) => set((state) => {
          state.composer.selectionIndex = index;
        }),
        setSelectionRect: (rect) => set((state) => {
          state.composer.selectionRect = rect;
        }),

        insertInputFile: (file) => set((state) => {
          insertFileBlockAtSelection(state.composer, file as WorkspaceInputFile);
          state.composer.confirmedAttachments = collectConfirmedAttachmentsFromBlocks(state.composer.inputBlocks);
        }),

        appendInputFile: (file) => set((state) => {
          appendFileBlockToInput(state.composer, file);
          state.composer.confirmedAttachments = collectConfirmedAttachmentsFromBlocks(state.composer.inputBlocks);
        }),

        setPendingAttachments: (attachments) => set((state) => {
          state.composer.pendingAttachments = attachments;
        }),

        addPendingAttachment: (attachment) => set((state) => {
          if (!state.composer.pendingAttachments.find(a => a.id === attachment.id)) {
            state.composer.pendingAttachments.push(attachment);
          }
        }),

        removePendingAttachment: (id) => set((state) => {
          state.composer.pendingAttachments = state.composer.pendingAttachments.filter(a => a.id !== id);
        }),

        confirmPendingAttachments: () => set((state) => {
          const pendings = state.composer.pendingAttachments;
          if (pendings.length === 0) return;

          for (const pending of pendings) {
            pending.file._canvasAutoInsert = false;
            insertFileBlockAtSelection(state.composer, pending.file);
          }

          state.composer.confirmedAttachments = collectConfirmedAttachmentsFromBlocks(state.composer.inputBlocks);
          state.composer.pendingAttachments = [];
        }),

        clearPendingAttachments: () => set((state) => {
          state.composer.pendingAttachments = [];
        }),

        setIsTyping: (typing) => set({ isTyping: typing }),
        setChatAbortController: (controller) => set({ chatAbortController: controller }),
        cancelChatGeneration: () => set((state) => {
          const controller = state.chatAbortController;
          if (controller && !controller.signal.aborted) {
            controller.abort();
          }
          state.chatAbortController = null;
          state.isTyping = false;
        }),

        setModelMode: (mode) => set({ modelMode: mode }),
        setWebEnabled: (enabled) => set({ webEnabled: enabled }),
        setAgentSelectionMode: (mode) => set({ agentSelectionMode: mode }),
        setPinnedAgentId: (agentId) => set((state) => {
          state.pinnedAgentId = agentId;
          if (!state.selectedRoleId) {
            state.baseAgentId = agentId;
          }
        }),
        setSelectedRoleSelection: (selection) => set((state) => {
          state.selectedRoleId = selection.roleId;
          state.selectedRoleSource = selection.roleSource ?? null;
          state.baseAgentId = selection.baseAgentId || state.pinnedAgentId;
          state.roleGovernanceMode = selection.governanceMode || 'manual_only';
          state.allowMainBrainRoleMutation = selection.allowMainBrainRoleMutation === true;
          state.allowMainBrainRolePromotion = selection.allowMainBrainRolePromotion === true;
        }),
        clearSelectedRoleSelection: () => set((state) => {
          state.selectedRoleId = null;
          state.selectedRoleSource = null;
          state.baseAgentId = state.pinnedAgentId;
          state.roleGovernanceMode = 'manual_only';
          state.allowMainBrainRoleMutation = false;
          state.allowMainBrainRolePromotion = false;
        }),
        setCurrentAutoRoleSession: (session) => set({ currentAutoRoleSession: session }),
        setImageModelEnabled: (enabled) => set({ imageModelEnabled: enabled }),
        setTranslatePromptToEnglish: (enabled) => set({ translatePromptToEnglish: enabled }),
        setEnforceChineseTextInImage: (enabled) => set({ enforceChineseTextInImage: enabled }),
        setRequiredChineseCopy: (copy) => set({ requiredChineseCopy: copy }),

        setImageGenRatio: (ratio) => set((state) => {
          state.generation.imageGenRatio = ratio;
        }),
        setImageGenRes: (res) => set((state) => {
          state.generation.imageGenRes = res;
        }),
        setImageGenCount: (count) => set((state) => {
          const numeric = Number(count);
          state.generation.imageGenCount = Number.isFinite(numeric)
            ? Math.max(1, Math.floor(numeric))
            : 1;
        }),
        setImageGenUploads: (files) => set((state) => {
          state.generation.imageGenUploads = files;
        }),
        setIsPickingFromCanvas: (picking) => set((state) => {
          state.generation.isPickingFromCanvas = picking;
        }),

        setVideoGenRatio: (ratio) => set((state) => {
          state.generation.videoGenRatio = ratio;
        }),
        setVideoGenDuration: (duration) => set((state) => {
          state.generation.videoGenDuration = duration;
        }),
        setVideoGenQuality: (quality) => set((state) => {
          state.generation.videoGenQuality = quality;
        }),
        setVideoGenModel: (model) => set((state) => {
          state.generation.videoGenModel = model;
        }),
        setVideoGenMode: (mode) => set((state) => {
          state.generation.videoGenMode = mode;
        }),
        setVideoStartFrame: (file) => set((state) => {
          state.generation.videoStartFrame = file;
        }),
        setVideoEndFrame: (file) => set((state) => {
          state.generation.videoEndFrame = file;
        }),
        setVideoMultiRefs: (refs) => set((state) => {
          state.generation.videoMultiRefs = refs;
        }),
        setShowVideoModelDropdown: (show) => set((state) => {
          state.generation.showVideoModelDropdown = show;
        }),

        setDetectedTexts: (texts) => set({ detectedTexts: texts }),
        setEditedTexts: (texts) => set({ editedTexts: texts }),
        setIsExtractingText: (extracting) => set({ isExtractingText: extracting }),

        setFastEditPrompt: (prompt) => set({ fastEditPrompt: prompt }),

        setBrushSize: (size) => set({ brushSize: size }),
        setUpscaleMenuOpen: (open) => set({ upscaleMenuOpen: open }),

        reset: () => set(initialState),
      }
    })),
    { name: 'AgentStore' })
);

// ─── Selectors（避免组件订阅整个 store 导致不必要的重渲染）───
export const useAgentMode = () => useAgentStore(s => s.isAgentMode);
export const useAgentMessages = () => useAgentStore(s => s.messages);
export const useAgentTyping = () => useAgentStore(s => s.isTyping);
export const useCurrentTask = () => useAgentStore(s => s.currentTask);
export const useInputBlocks = () => useAgentStore(s => s.composer.inputBlocks);
export const useComposerState = () => useAgentStore(s => s.composer);
export const useGenerationState = () => useAgentStore(s => s.generation);
export const useModelMode = () => useAgentStore(s => s.modelMode);
export const useAgentActions = () => useAgentStore(s => s.actions);
