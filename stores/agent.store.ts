import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { AgentRoleDraft, AgentTask, AgentType } from '../types/agent.types';
import { CanvasElement, ChatMessage, InputBlock, ImageModel, VideoModel, WorkspaceInputFile } from '../types';

type VideoGenDuration = NonNullable<CanvasElement['genDuration']>;
type VideoGenQuality = NonNullable<CanvasElement['genQuality']>;

export interface AgentComposerState {
  inputBlocks: InputBlock[];
  activeBlockId: string;
  selectionIndex: number | null;
  pendingAttachments: AttachmentItem[];
  confirmedAttachments: AttachmentItem[];
}

export interface AgentGenerationState {
  imageGenRatio: string;
  imageGenRes: '1K' | '2K' | '4K';
  imageGenCount: 1 | 2 | 3 | 4;
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
    state.inputBlocks.push({ id: `text-${Date.now()}`, type: 'text', text: '' });
  }

  const fileBlock: InputBlock = { id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'file', file };
  const lastIndex = state.inputBlocks.length - 1;
  const lastBlock = state.inputBlocks[lastIndex];

  if (lastBlock?.type === 'text') {
    const lastText = lastBlock.text || '';

    if (lastText.length > 0) {
      const textBlock: InputBlock = { id: `text-${Date.now() + 1}`, type: 'text', text: '' };
      state.inputBlocks.push(fileBlock, textBlock);
      state.activeBlockId = textBlock.id;
      state.selectionIndex = 0;
      return;
    }

    state.inputBlocks.splice(lastIndex, 0, fileBlock);
    state.activeBlockId = lastBlock.id;
    state.selectionIndex = 0;
  } else {
    const textBlock: InputBlock = { id: `text-${Date.now() + 1}`, type: 'text', text: '' };
    state.inputBlocks.push(fileBlock, textBlock);
    state.activeBlockId = textBlock.id;
    state.selectionIndex = 0;
  }

  state.inputBlocks = normalizeInputBlocks(state.inputBlocks);
};

// ─── Pure helper: normalize input blocks ───
export function normalizeInputBlocks(blocks: InputBlock[]): InputBlock[] {
  if (blocks.length === 0) return [{ id: `text-${Date.now()}`, type: 'text', text: '' }];
  const result: InputBlock[] = [];
  for (const block of blocks) {
    const last = result[result.length - 1];

    if (block.type === 'file' && last?.type === 'file') {
      result.push({ id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'text', text: '' });
    }

    if (block.type === 'text') {
      const currentLast = result[result.length - 1];
      if (currentLast && currentLast.type === 'text') {
        currentLast.text = (currentLast.text || '') + (block.text || '');
        continue;
      }
    }
    result.push({ ...block });
  }
  if (result[result.length - 1]?.type === 'file') {
    result.push({ id: `text-${Date.now()}`, type: 'text', text: '' });
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

  // 模型配置
  modelMode: 'thinking' | 'fast';
  webEnabled: boolean;
  agentSelectionMode: 'auto' | 'manual';
  pinnedAgentId: AgentType;
  currentAutoRoleSession: {
    targetAgent: AgentType;
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
  detectedTexts: string[];
  editedTexts: string[];
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
    insertInputFile: (file: File) => void;
    appendInputFile: (file: File) => void;
    setPendingAttachments: (attachments: AttachmentItem[]) => void;
    addPendingAttachment: (attachment: AttachmentItem) => void;
    removePendingAttachment: (id: string) => void;
    confirmPendingAttachments: () => void;
    clearPendingAttachments: () => void;

    setIsTyping: (typing: boolean) => void;

    setModelMode: (mode: 'thinking' | 'fast') => void;
    setWebEnabled: (enabled: boolean) => void;
    setAgentSelectionMode: (mode: 'auto' | 'manual') => void;
    setPinnedAgentId: (agentId: AgentType) => void;
    setCurrentAutoRoleSession: (
      session: AgentState['currentAutoRoleSession'],
    ) => void;
    setImageModelEnabled: (enabled: boolean) => void;
    setTranslatePromptToEnglish: (enabled: boolean) => void;
    setEnforceChineseTextInImage: (enabled: boolean) => void;
    setRequiredChineseCopy: (copy: string) => void;

    setImageGenRatio: (ratio: string) => void;
    setImageGenRes: (res: '1K' | '2K' | '4K') => void;
    setImageGenCount: (count: 1 | 2 | 3 | 4) => void;
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

    setDetectedTexts: (texts: string[]) => void;
    setEditedTexts: (texts: string[]) => void;
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
    pendingAttachments: [] as AttachmentItem[],
    confirmedAttachments: [] as AttachmentItem[],
  },

  isTyping: false,

  modelMode: 'fast' as const,
  webEnabled: false,
  agentSelectionMode: 'auto' as const,
  pinnedAgentId: 'coco' as AgentType,
  currentAutoRoleSession: null,
  imageModelEnabled: false,
  translatePromptToEnglish: false,
  enforceChineseTextInImage: true,
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
          const prevLog = state.currentTask?.progressLog || [];
          const newMsg = task.progressMessage;
          let log = prevLog;
          if (newMsg && (prevLog.length === 0 || prevLog[prevLog.length - 1] !== newMsg)) {
            log = [...prevLog, newMsg];
          }
          // 任务切换（新 id）时重置 log
          if (state.currentTask?.id !== task.id) {
            log = newMsg ? [newMsg] : [];
          }
          state.currentTask = { ...task, progressLog: log };
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
              state.composer.inputBlocks.push({ id: `text-${Date.now()}`, type: 'text', text: '' });
            }
          }

          state.composer.confirmedAttachments = collectConfirmedAttachmentsFromBlocks(state.composer.inputBlocks);
        }),

        updateInputBlock: (id, updates) => set((state) => {
          const block = state.composer.inputBlocks.find(b => b.id === id);
          if (block) {
            Object.assign(block, updates);
            state.composer.confirmedAttachments = collectConfirmedAttachmentsFromBlocks(state.composer.inputBlocks);
          }
        }),

        setActiveBlockId: (id) => set((state) => {
          state.composer.activeBlockId = id;
        }),
        setSelectionIndex: (index) => set((state) => {
          state.composer.selectionIndex = index;
        }),

        insertInputFile: (file) => set((state) => {
          const activeIndex = state.composer.inputBlocks.findIndex(b => b.id === state.composer.activeBlockId);

          if (activeIndex === -1) {
            const fileBlock: InputBlock = { id: `file-${Date.now()}`, type: 'file', file };
            const textBlock: InputBlock = { id: `text-${Date.now() + 1}`, type: 'text', text: '' };
            state.composer.inputBlocks.push(fileBlock, textBlock);
            state.composer.activeBlockId = textBlock.id;
            state.composer.selectionIndex = 0;
            return;
          }

          const activeBlock = state.composer.inputBlocks[activeIndex];

          if (activeBlock.type === 'text') {
            const text = activeBlock.text || '';
            const idx = state.composer.selectionIndex !== null ? state.composer.selectionIndex : text.length;
            const preText = text.slice(0, idx);
            const postText = text.slice(idx);
            const newTextBlockId = `text-${Date.now() + 1}`;

            const newBlocks: InputBlock[] = [
              { ...activeBlock, text: preText },
              { id: `file-${Date.now()}`, type: 'file', file },
              { id: newTextBlockId, type: 'text', text: postText }
            ];

            state.composer.inputBlocks.splice(activeIndex, 1, ...newBlocks);
            state.composer.activeBlockId = newTextBlockId;
            state.composer.selectionIndex = 0;
            // Focus is handled reactively via useEffect on activeBlockId in the UI
          } else {
            const fileBlock: InputBlock = { id: `file-${Date.now()}`, type: 'file', file };
            const textBlock: InputBlock = { id: `text-${Date.now() + 1}`, type: 'text', text: '' };
            state.composer.inputBlocks.push(fileBlock, textBlock);
            state.composer.activeBlockId = textBlock.id;
            state.composer.selectionIndex = 0;
          }

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
            appendFileBlockToInput(state.composer, pending.file);
          }

          state.composer.confirmedAttachments = collectConfirmedAttachmentsFromBlocks(state.composer.inputBlocks);
          state.composer.pendingAttachments = [];
        }),

        clearPendingAttachments: () => set((state) => {
          state.composer.pendingAttachments = [];
        }),

        setIsTyping: (typing) => set({ isTyping: typing }),

        setModelMode: (mode) => set({ modelMode: mode }),
        setWebEnabled: (enabled) => set({ webEnabled: enabled }),
        setAgentSelectionMode: (mode) => set({ agentSelectionMode: mode }),
        setPinnedAgentId: (agentId) => set({ pinnedAgentId: agentId }),
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
          state.generation.imageGenCount = count;
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
