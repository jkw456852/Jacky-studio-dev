import React from 'react';
import type { ChatMessage, ChatSendOptions, InputBlock, Marker } from '../../../types';
import {
  getFrontstageSkillLabelKind,
  isUnifiedSidebarAgentSkill,
  normalizeFrontstageSkillPresentation,
} from '../../../services/runtime-assets/skill-identity';
import { createInputBlockId } from '../../../stores/agent.store';
import { InputAreaFileBlock } from './InputAreaFileBlock';
import { InputAreaPendingAttachments } from './InputAreaPendingAttachments';

const getCECursorPos = (el: HTMLElement): number => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
};

const setCECursorPos = (el: HTMLElement, pos: number) => {
  el.focus();
  const selection = window.getSelection();
  if (!selection) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let current = 0;
  let node = walker.nextNode();
  while (node) {
    const len = (node.textContent || '').length;
    if (current + len >= pos) {
      const range = document.createRange();
      range.setStart(node, pos - current);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    current += len;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

type InputAreaEditorProps = {
  creationMode: 'agent' | 'image' | 'video';
  agentPlaceholder?: string;
  archivedReadOnly?: boolean;
  inputBlocks: InputBlock[];
  markers: Marker[];
  pendingAttachments: Array<{ id: string; file: File }>;
  selectedChipId: string | null;
  setSelectedChipId: (id: string | null) => void;
  hoveredChipId: string | null;
  setHoveredChipId: (id: string | null) => void;
  isInputFocused: boolean;
  setIsInputFocused: (value: boolean) => void;
  isAllInputSelected: boolean;
  setIsAllInputSelected: (value: boolean) => void;
  getObjectUrl: (file?: File | null) => string;
  handleEditorPaste: (
    event: React.ClipboardEvent<HTMLSpanElement>,
    blockId: string,
  ) => void;
  commitPendingAttachments: () => void;
  selectLatestCanvasChip: () => void;
  clearAllInputBlocks: () => void;
  updateInputBlock: (id: string, updates: Partial<InputBlock>) => void;
  setActiveBlockId: (id: string) => void;
  setSelectionIndex: (index: number | null) => void;
  setSelectionRect: (
    rect: {
      left: number;
      top: number;
      width: number;
      height: number;
    } | null,
  ) => void;
  setInputBlocks: (blocks: InputBlock[]) => void;
  handleSend: (
    overridePrompt?: string,
    overrideAttachments?: File[],
    overrideWeb?: boolean,
    skillData?: ChatMessage['skillData'],
    sendOptions?: ChatSendOptions,
  ) => Promise<void>;
  sendSkill?: ChatMessage['skillData'];
  onClearSendSkill?: () => void;
  onEditSendSkill?: () => void;
  removeInputBlock: (id: string) => void;
  removePendingAttachment: (id: string) => void;
  setEditingMarkerId: (id: string | null) => void;
  setEditingMarkerLabel: (label: string) => void;
};

export const InputAreaEditor: React.FC<InputAreaEditorProps> = ({
  creationMode,
  agentPlaceholder,
  archivedReadOnly = false,
  inputBlocks,
  markers,
  pendingAttachments,
  selectedChipId,
  setSelectedChipId,
  hoveredChipId,
  setHoveredChipId,
  isInputFocused,
  setIsInputFocused,
  isAllInputSelected,
  setIsAllInputSelected,
  getObjectUrl,
  handleEditorPaste,
  commitPendingAttachments,
  selectLatestCanvasChip,
  clearAllInputBlocks,
  updateInputBlock,
  setActiveBlockId,
  setSelectionIndex,
  setSelectionRect,
  setInputBlocks,
  handleSend,
  sendSkill,
  onClearSendSkill,
  onEditSendSkill,
  removeInputBlock,
  removePendingAttachment,
  setEditingMarkerId,
  setEditingMarkerLabel,
}) => {
  const displaySendSkill = React.useMemo(
    () => normalizeFrontstageSkillPresentation(sendSkill),
    [sendSkill],
  );
  const hasTypedText = inputBlocks.some(
    (block) => block.type === 'text' && (block.text || '').trim().length > 0,
  );
  const hasAttachedFiles = inputBlocks.some((block) => block.type === 'file' && block.file);
  const showComposerHint =
    !archivedReadOnly && !hasTypedText && !hasAttachedFiles && pendingAttachments.length === 0;
  const activeSkillState = React.useMemo(() => {
    const config =
      sendSkill?.config && typeof sendSkill.config === 'object'
        ? (sendSkill.config as Record<string, unknown>)
        : null;
    const usesCustomBehavior = config?.isCustomSkill === true;
    const customConfig = usesCustomBehavior ? config : null;

    return {
      usesCustomBehavior,
      customConfig,
      customSummary: String(
        customConfig?.summary || customConfig?.description || '',
      ).trim(),
      customExamplePrompt: String(
        customConfig?.examplePrompt || customConfig?.sourceUserPrompt || '',
      ).trim(),
    };
  }, [sendSkill?.config]);

  const composerPlaceholder =
    creationMode === 'agent'
      ? displaySendSkill?.id === 'ecom-oneclick-workflow'
        ? '先说商品、目标和约束，我会按电商工作流继续补问并推进。'
        : displaySendSkill?.id === 'clothing-studio-workflow'
          ? '先说服饰图、风格目标和限制条件，我会按服饰工作流继续推进。'
        : displaySendSkill?.id === 'cn-detail-page'
          ? '先说商品、卖点和详情页目标，我会按中文详情页流程继续拆解。'
        : displaySendSkill?.id === 'jkai-oneclick'
          ? '先说你要的结果和参考方向，我会按 One Click 流程继续推进。'
          : isUnifiedSidebarAgentSkill(displaySendSkill)
                ? `继续说明这次要做什么，我会按「${displaySendSkill?.name || '当前 Skill'}」的方式继续推进。`
                : activeSkillState.usesCustomBehavior
                  ? activeSkillState.customExamplePrompt ||
                    activeSkillState.customSummary ||
                    `继续说明这次要做什么，我会按「${displaySendSkill?.name || '当前 Skill'}」的方式继续推进。`
                : agentPlaceholder || '告诉助手要检查、修改或继续推进的下一步。'
      : creationMode === 'image'
        ? '描述画面、风格、构图和必须保留的关键细节。'
        : '描述场景、镜头运动、节奏和时长要求。';
  const skillHintVisible = creationMode === 'agent' && Boolean(displaySendSkill?.name);
  const selectedSkillMeta = React.useMemo(() => {
    switch (getFrontstageSkillLabelKind(displaySendSkill)) {
      case 'workflow':
        return { label: 'Workflow', detail: '', tone: 'blue' as const };
      case 'my-skill':
        return {
          label: 'My Skill',
          detail: activeSkillState.customSummary || '',
          tone: 'violet' as const,
        };
      case 'skill':
      default:
        return {
          label: 'Skill',
          detail: '',
          tone: isUnifiedSidebarAgentSkill(displaySendSkill) ? 'emerald' as const : 'amber' as const,
        };
    }
  }, [activeSkillState.customSummary, displaySendSkill]);
  const inputFlowRef = React.useRef<HTMLDivElement | null>(null);
  const baseComposerHeight = showComposerHint ? 96 : 84;
  const maxComposerHeight = baseComposerHeight * 2;

  const captureSelectionAnchorRect = (el: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.startContainer)) return null;
    const nextRange = range.cloneRange();
    const rects = nextRange.getClientRects();
    const rect =
      rects.length > 0
        ? rects[0]
        : nextRange.getBoundingClientRect?.() || null;
    if (!rect || (!rect.width && !rect.height)) return null;
    const flowRect = inputFlowRef.current?.getBoundingClientRect();
    if (!flowRect) return null;
    return {
      left: rect.left - flowRect.left,
      top: rect.top - flowRect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const syncComposerHeight = React.useCallback(() => {
    const el = inputFlowRef.current;
    if (!el) return;

    el.style.height = 'auto';
    const nextHeight = Math.max(
      baseComposerHeight,
      Math.min(el.scrollHeight, maxComposerHeight),
    );
    el.style.height = `${nextHeight}px`;
  }, [baseComposerHeight, maxComposerHeight]);

  React.useLayoutEffect(() => {
    syncComposerHeight();
  }, [
    syncComposerHeight,
    creationMode,
    inputBlocks.length,
    pendingAttachments.length,
    displaySendSkill?.id,
    displaySendSkill?.name,
    showComposerHint,
  ]);

  const moveCaretToLeftOfFirstChip = () => {
    const textId = createInputBlockId('text');
    setInputBlocks([{ id: textId, type: 'text', text: '' }, ...inputBlocks]);
    setActiveBlockId(textId);
    setSelectedChipId(null);
    setIsAllInputSelected(false);
    requestAnimationFrame(() => {
      const leftEl = document.getElementById(`input-block-${textId}`);
      if (leftEl) {
        setCECursorPos(leftEl, 0);
      }
    });
  };

  const syncSelectionToStore = (el: HTMLElement, blockId: string) => {
    setActiveBlockId(blockId);
    setSelectionIndex(getCECursorPos(el));
    setSelectionRect(captureSelectionAnchorRect(el));
  };

  const scheduleSelectionSync = (el: HTMLElement | null, blockId: string) => {
    if (!el) return;
    requestAnimationFrame(() => {
      if (!document.body.contains(el)) return;
      syncSelectionToStore(el, blockId);
    });
  };

  return (
    <div
      className={`px-4 pb-1 pt-2.5 transition-all ${
        archivedReadOnly ? 'cursor-not-allowed opacity-70' : 'cursor-text'
      }`}
      onKeyDownCapture={(event) => {
        if (archivedReadOnly) {
          event.preventDefault();
          return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
          event.preventDefault();
          const selection = window.getSelection();
          if (selection) selection.removeAllRanges();
          setIsAllInputSelected(true);
          setSelectedChipId(null);
          return;
        }

        if (isAllInputSelected && (event.key === 'Backspace' || event.key === 'Delete')) {
          event.preventDefault();
          clearAllInputBlocks();
        }
      }}
      onMouseDown={(event) => {
        if (archivedReadOnly) {
          event.preventDefault();
          return;
        }
        if (isAllInputSelected) setIsAllInputSelected(false);
        commitPendingAttachments();
        const target = event.target as HTMLElement;
        if (target.closest('[id^="file-chip-"]') || target.closest('[id^="marker-chip-"]')) {
          return;
        }
        selectLatestCanvasChip();
      }}
      onClick={(event) => {
        if (archivedReadOnly) {
          event.preventDefault();
          return;
        }
        if (isAllInputSelected) setIsAllInputSelected(false);
        const target = event.target as HTMLElement;
        if (target.closest('[id^="input-block-"]')) return;
        if (target.closest('[id^="file-chip-"]') || target.closest('[id^="marker-chip-"]')) {
          return;
        }

        const clickedContainer = target === event.currentTarget;
        const clickedFlowBackground = target.classList.contains('input-flow-container');
        if (!clickedContainer && !clickedFlowBackground) return;

        const lastText = inputBlocks.filter((block) => block.type === 'text').pop();
        const targetId = lastText?.id || inputBlocks[inputBlocks.length - 1]?.id;
        if (!targetId) return;
        const el = document.getElementById(`input-block-${targetId}`);
        el?.focus();
      }}
    >
      <div
        ref={inputFlowRef}
        className={`input-flow-container custom-scrollbar relative flex w-full flex-wrap items-start content-start gap-1 overflow-y-auto px-2 pb-3 pr-2 pt-1 transition-[height] duration-150 ${
          showComposerHint ? 'min-h-[96px]' : 'min-h-[84px]'
        }`}
        style={{
          minHeight: `${baseComposerHeight}px`,
          maxHeight: `${maxComposerHeight}px`,
          overflowY: 'auto',
          wordBreak: 'break-word',
          lineHeight: '26px',
        }}
      >
        {skillHintVisible ? (
          <div
            data-active-skill-hint={displaySendSkill?.id || 'active-skill'}
            className={`mb-1.5 inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border pl-[3px] pr-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${
              activeSkillState.usesCustomBehavior
                ? 'border-violet-200/90 bg-violet-50/80'
                : 'border-slate-200/90 bg-slate-50/92'
            }`}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={`inline-flex h-6 items-center rounded-full px-2.5 text-[9px] font-semibold tracking-[0.08em] ${
                  selectedSkillMeta.tone === 'emerald'
                    ? 'bg-emerald-50 text-emerald-700'
                  : selectedSkillMeta.tone === 'blue'
                      ? 'bg-blue-50 text-blue-700'
                    : selectedSkillMeta.tone === 'amber'
                        ? 'bg-amber-50 text-amber-700'
                      : selectedSkillMeta.tone === 'violet'
                        ? 'bg-violet-100/90 text-violet-700'
                        : 'bg-white text-slate-400'
                }`}
              >
                {selectedSkillMeta.label}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-slate-700">
                  {displaySendSkill?.name}
                </div>
                {selectedSkillMeta.detail ? (
                  <div className={`truncate text-[9px] leading-3 ${
                    activeSkillState.usesCustomBehavior ? 'text-violet-500/80' : 'text-slate-400'
                  }`}>
                    {selectedSkillMeta.detail}
                  </div>
                ) : null}
              </div>
            </div>
            {activeSkillState.usesCustomBehavior && onEditSendSkill ? (
              <button
                type="button"
                data-edit-active-skill
                onClick={(event) => {
                  event.stopPropagation();
                  onEditSendSkill();
                }}
                className="inline-flex h-6 items-center rounded-full bg-white/90 px-2 text-[10px] font-medium text-violet-600 transition hover:bg-white hover:text-violet-700"
                aria-label="编辑当前 Skill"
                title="编辑当前 Skill"
              >
                编辑
              </button>
            ) : null}
            <button
              type="button"
              data-clear-active-skill
              onClick={(event) => {
                event.stopPropagation();
                onClearSendSkill?.();
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="清除当前 Skill"
            >
              ×
            </button>
          </div>
        ) : null}
        {inputBlocks.map((block) => {
          if (block.type === 'file' && block.file) {
            return (
              <InputAreaFileBlock
                key={block.id}
                block={block as InputBlock & { type: 'file'; file: File }}
                inputBlocks={inputBlocks}
                markers={markers}
                isSelected={selectedChipId === block.id}
                isHovered={hoveredChipId === block.id}
                isAllInputSelected={isAllInputSelected}
                isInputFocused={isInputFocused}
                getObjectUrl={getObjectUrl}
                onSelectChip={(blockId) => {
                  setIsAllInputSelected(false);
                  setSelectedChipId(blockId);
                }}
                onHoverChip={setHoveredChipId}
                onBeginEditMarker={(markerId, label) => {
                  setIsAllInputSelected(false);
                  setEditingMarkerId(markerId);
                  setEditingMarkerLabel(label);
                }}
                onRemove={(blockId) => {
                  removeInputBlock(blockId);
                  setSelectedChipId(null);
                }}
              />
            );
          }

          if (block.type !== 'text') {
            return null;
          }

          const textBlocks = inputBlocks.filter((item) => item.type === 'text');
          const isLastTextBlock = textBlocks[textBlocks.length - 1]?.id === block.id;
          const hasText = (block.text || '').trim().length > 0;
          const placeholder =
            isLastTextBlock && textBlocks.length <= 1 && pendingAttachments.length === 0
              ? composerPlaceholder
              : '';

          return (
            <span
              key={block.id}
              id={`input-block-${block.id}`}
              contentEditable={!archivedReadOnly}
              suppressContentEditableWarning
              className={`ce-placeholder border-none outline-none text-[15px] ${
                isAllInputSelected && hasText
                  ? 'rounded px-0.5 bg-blue-100 text-blue-900'
                  : 'bg-transparent text-slate-600'
              }`}
              data-placeholder={placeholder}
              style={{
                display: 'inline-block',
                verticalAlign: 'top',
                lineHeight: '26px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                caretColor: '#0f172a',
                minWidth: '8px',
                margin: '1px 2px',
                flex: isLastTextBlock
                  ? pendingAttachments.length > 0
                    ? '0 1 auto'
                    : '1 1 auto'
                  : '0 1 auto',
              }}
              ref={(el) => {
                if (
                  el &&
                  document.activeElement !== el &&
                  el.textContent !== (block.text || '')
                ) {
                  el.textContent = block.text || '';
                }
              }}
              onInput={(event) => {
                if (isAllInputSelected) setIsAllInputSelected(false);
                updateInputBlock(block.id, { text: event.currentTarget.textContent || '' });
                if (selectedChipId) setSelectedChipId(null);
                scheduleSelectionSync(event.currentTarget, block.id);
                requestAnimationFrame(syncComposerHeight);
              }}
              onPaste={(event) => {
                handleEditorPaste(event, block.id);
                scheduleSelectionSync(event.currentTarget, block.id);
                requestAnimationFrame(syncComposerHeight);
              }}
              onFocus={(event) => {
                commitPendingAttachments();
                setIsInputFocused(true);
                scheduleSelectionSync(event.currentTarget, block.id);
              }}
              onClick={(event) => {
                if (selectedChipId) setSelectedChipId(null);
                scheduleSelectionSync(event.currentTarget, block.id);
              }}
              onMouseUp={(event) => {
                scheduleSelectionSync(event.currentTarget, block.id);
              }}
              onKeyUp={(event) => {
                scheduleSelectionSync(event.currentTarget, block.id);
              }}
              onBlur={() => setIsInputFocused(false)}
              onKeyDown={(event) => {
                if (archivedReadOnly) {
                  event.preventDefault();
                  return;
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend(undefined, undefined, undefined, sendSkill);
                  return;
                }

                if (
                  selectedChipId &&
                  ![
                    'ArrowLeft',
                    'ArrowRight',
                    'Backspace',
                    'Delete',
                    'Shift',
                    'Control',
                    'Alt',
                    'Meta',
                  ].includes(event.key)
                ) {
                  setSelectedChipId(null);
                }

                const pos = getCECursorPos(event.currentTarget);
                const textLen = (event.currentTarget.textContent || '').length;
                const blockIndex = inputBlocks.findIndex((item) => item.id === block.id);

                if (event.key === 'ArrowLeft' && pos === 0) {
                  if (isAllInputSelected) setIsAllInputSelected(false);
                  const prevBlock = inputBlocks[blockIndex - 1];
                  if (prevBlock?.type === 'file') {
                    event.preventDefault();
                    if (selectedChipId === prevBlock.id) {
                      const prevPrev = inputBlocks[blockIndex - 2];
                      if (prevPrev?.type === 'text') {
                        const prevEl = document.getElementById(`input-block-${prevPrev.id}`);
                        if (prevEl) {
                          setCECursorPos(prevEl, (prevEl.textContent || '').length);
                        }
                        setSelectedChipId(null);
                      } else if (prevPrev?.type === 'file') {
                        setSelectedChipId(prevPrev.id);
                      }
                    } else {
                      setSelectedChipId(prevBlock.id);
                    }
                  }
                }

                if (event.key === 'ArrowRight' && pos === textLen) {
                  if (isAllInputSelected) setIsAllInputSelected(false);
                  const nextBlock = inputBlocks[blockIndex + 1];
                  if (nextBlock?.type === 'file') {
                    event.preventDefault();
                    if (selectedChipId === nextBlock.id) {
                      const nextNext = inputBlocks[blockIndex + 2];
                      if (nextNext?.type === 'text') {
                        const nextEl = document.getElementById(`input-block-${nextNext.id}`);
                        if (nextEl) {
                          setCECursorPos(nextEl, 0);
                        }
                        setSelectedChipId(null);
                      } else if (nextNext?.type === 'file') {
                        setSelectedChipId(nextNext.id);
                      }
                    } else {
                      setSelectedChipId(nextBlock.id);
                    }
                  }
                }

                if (event.key === 'Backspace' && pos === 0) {
                  const prevBlock = inputBlocks[blockIndex - 1];
                  if (prevBlock?.type === 'file') {
                    event.preventDefault();
                    if (selectedChipId === prevBlock.id) {
                      removeInputBlock(prevBlock.id);
                      setSelectedChipId(null);
                    } else {
                      setSelectedChipId(prevBlock.id);
                    }
                  }
                }

                if (event.key === 'Delete' && pos === textLen) {
                  const nextBlock = inputBlocks[blockIndex + 1];
                  if (nextBlock?.type === 'file') {
                    event.preventDefault();
                    if (selectedChipId === nextBlock.id) {
                      removeInputBlock(nextBlock.id);
                      setSelectedChipId(null);
                    } else {
                      setSelectedChipId(nextBlock.id);
                    }
                  }
                }

                if (selectedChipId && event.key === 'ArrowLeft') {
                  if (isAllInputSelected) setIsAllInputSelected(false);
                  event.preventDefault();
                  const chipIndex = inputBlocks.findIndex((item) => item.id === selectedChipId);
                  if (chipIndex === -1) return;
                  const prevBlock = inputBlocks[chipIndex - 1];
                  if (prevBlock?.type === 'text') {
                    const prevEl = document.getElementById(`input-block-${prevBlock.id}`);
                    if (prevEl) {
                      setCECursorPos(prevEl, (prevEl.textContent || '').length);
                    }
                    setSelectedChipId(null);
                    return;
                  }
                  if (prevBlock?.type === 'file') {
                    setSelectedChipId(prevBlock.id);
                    return;
                  }

                  moveCaretToLeftOfFirstChip();
                }

                if (selectedChipId && event.key === 'ArrowRight') {
                  if (isAllInputSelected) setIsAllInputSelected(false);
                  event.preventDefault();
                  const chipIndex = inputBlocks.findIndex((item) => item.id === selectedChipId);
                  if (chipIndex === -1) return;
                  const nextBlock = inputBlocks[chipIndex + 1];
                  if (nextBlock?.type === 'text') {
                    const nextEl = document.getElementById(`input-block-${nextBlock.id}`);
                    if (nextEl) {
                      setCECursorPos(nextEl, 0);
                    }
                    setSelectedChipId(null);
                    return;
                  }
                  if (nextBlock?.type === 'file') {
                    setSelectedChipId(nextBlock.id);
                  }
                }

                if (selectedChipId && (event.key === 'Backspace' || event.key === 'Delete')) {
                  event.preventDefault();
                  removeInputBlock(selectedChipId);
                  setSelectedChipId(null);
                }
              }}
            />
          );
        })}

        <InputAreaPendingAttachments
          pendingAttachments={pendingAttachments}
          getObjectUrl={getObjectUrl}
          onRemovePendingAttachment={removePendingAttachment}
        />
      </div>
    </div>
  );
};
