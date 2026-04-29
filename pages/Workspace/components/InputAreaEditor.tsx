import React from 'react';
import { useAgentStore } from '../../../stores/agent.store';
import type { ChatMessage, InputBlock, Marker } from '../../../types';
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
  setInputBlocks: (blocks: InputBlock[]) => void;
  handleSend: (
    overridePrompt?: string,
    overrideAttachments?: File[],
    overrideWeb?: boolean,
    skillData?: ChatMessage['skillData'],
  ) => Promise<void>;
  sendSkill?: ChatMessage['skillData'];
  removeInputBlock: (id: string) => void;
  removePendingAttachment: (id: string) => void;
  setEditingMarkerId: (id: string | null) => void;
  setEditingMarkerLabel: (label: string) => void;
};

export const InputAreaEditor: React.FC<InputAreaEditorProps> = ({
  creationMode,
  agentPlaceholder,
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
  setInputBlocks,
  handleSend,
  sendSkill,
  removeInputBlock,
  removePendingAttachment,
  setEditingMarkerId,
  setEditingMarkerLabel,
}) => {
  const moveCaretToLeftOfFirstChip = () => {
    const textId = `text-${Date.now()}`;
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

  return (
    <div
      className="px-3 pt-1.5 pb-1.5 cursor-text transition-all"
      onKeyDownCapture={(event) => {
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
        if (isAllInputSelected) setIsAllInputSelected(false);
        commitPendingAttachments();
        const target = event.target as HTMLElement;
        if (target.closest('[id^="file-chip-"]') || target.closest('[id^="marker-chip-"]')) return;
        selectLatestCanvasChip();
      }}
      onClick={(event) => {
        if (isAllInputSelected) setIsAllInputSelected(false);
        const target = event.target as HTMLElement;
        if (target.closest('[id^="input-block-"]')) return;
        if (target.closest('[id^="file-chip-"]') || target.closest('[id^="marker-chip-"]')) return;

        const clickedContainer = target === event.currentTarget;
        const clickedFlowBackground = target.classList.contains('input-flow-container');
        if (!clickedContainer && !clickedFlowBackground) return;

        const lastText = inputBlocks.filter((block) => block.type === 'text').pop();
        const targetId = lastText?.id || inputBlocks[inputBlocks.length - 1].id;
        const el = document.getElementById(`input-block-${targetId}`);
        el?.focus();
      }}
    >
      <div
        className="input-flow-container flex flex-wrap items-start content-start gap-[2px] pt-2 min-h-[80px] max-h-[200px] overflow-y-auto pr-1"
        style={{
          minHeight: '80px',
          maxHeight: '200px',
          overflowY: 'auto',
          wordBreak: 'break-word',
          lineHeight: '22px',
        }}
      >
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
              ? creationMode === 'agent'
                ? agentPlaceholder || '请输入你的目标或想法'
                : '今天我们要创作什么'
              : '';

          return (
            <span
              key={block.id}
              id={`input-block-${block.id}`}
              contentEditable
              suppressContentEditableWarning
              className={`ce-placeholder border-none outline-none text-sm ${
                isAllInputSelected && hasText
                  ? 'bg-blue-100 text-blue-900 rounded px-0.5'
                  : 'bg-transparent text-gray-800'
              }`}
              data-placeholder={placeholder}
              style={{
                display: 'inline-block',
                verticalAlign: 'top',
                lineHeight: '22px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                caretColor: '#111827',
                minWidth: '4px',
                margin: '0 2px',
                flex: isLastTextBlock
                  ? pendingAttachments.length > 0
                    ? '0 1 auto'
                    : '1 1 auto'
                  : '0 1 auto',
              }}
              ref={(el) => {
                if (el && document.activeElement !== el && el.textContent !== (block.text || '')) {
                  el.textContent = block.text || '';
                }
              }}
              onInput={(event) => {
                if (isAllInputSelected) setIsAllInputSelected(false);
                updateInputBlock(block.id, { text: event.currentTarget.textContent || '' });
                if (selectedChipId) setSelectedChipId(null);
              }}
              onPaste={(event) => handleEditorPaste(event, block.id)}
              onFocus={() => {
                commitPendingAttachments();
                setActiveBlockId(block.id);
                setIsInputFocused(true);
              }}
              onBlur={() => setIsInputFocused(false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend(undefined, undefined, undefined, sendSkill);
                  return;
                }

                if (
                  selectedChipId &&
                  !['ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key)
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
