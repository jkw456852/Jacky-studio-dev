import { useEffect, useRef } from 'react';
import type { ClipboardEvent } from 'react';
import type { InputBlock } from '../../../types';

type UseInputAreaFileHandlingArgs = {
  creationMode: 'agent' | 'image' | 'video';
  inputBlocks: InputBlock[];
  imageGenUploads: File[];
  videoStartFrame: File | null;
  videoEndFrame: File | null;
  videoMultiRefs: File[];
  pendingAttachments: Array<{ file: File }>;
  selectedChipId: string | null;
  appendInputFile: (file: File) => void;
  setImageGenUploads: (files: File[]) => void;
  confirmPendingAttachments: () => void;
  setSelectedChipId: (id: string | null) => void;
  setInputBlocks: (blocks: InputBlock[]) => void;
  updateInputBlock: (id: string, updates: Partial<InputBlock>) => void;
  setActiveBlockId: (id: string) => void;
  onResetInputSelectionState?: () => void;
};

export const useInputAreaFileHandling = ({
  creationMode,
  inputBlocks,
  imageGenUploads,
  videoStartFrame,
  videoEndFrame,
  videoMultiRefs,
  pendingAttachments,
  selectedChipId,
  appendInputFile,
  setImageGenUploads,
  confirmPendingAttachments,
  setSelectedChipId,
  setInputBlocks,
  updateInputBlock,
  setActiveBlockId,
  onResetInputSelectionState,
}: UseInputAreaFileHandlingArgs) => {
  const objectUrlMapRef = useRef<Map<File, string>>(new Map());

  const getObjectUrl = (file?: File | null) => {
    if (!file) return '';
    const existing = objectUrlMapRef.current.get(file);
    if (existing) return existing;
    const next = URL.createObjectURL(file);
    objectUrlMapRef.current.set(file, next);
    return next;
  };

  useEffect(() => {
    return () => {
      objectUrlMapRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlMapRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const activeFiles = new Set<File>();
    const push = (file?: File | null) => {
      if (file) activeFiles.add(file);
    };

    inputBlocks.forEach((block) => {
      if (block.type === 'file' && block.file) push(block.file);
    });
    imageGenUploads.forEach(push);
    push(videoStartFrame);
    push(videoEndFrame);
    videoMultiRefs.forEach(push);
    pendingAttachments.forEach((pending) => push(pending.file));

    objectUrlMapRef.current.forEach((url, file) => {
      if (!activeFiles.has(file)) {
        URL.revokeObjectURL(url);
        objectUrlMapRef.current.delete(file);
      }
    });
  }, [
    inputBlocks,
    imageGenUploads,
    videoStartFrame,
    videoEndFrame,
    videoMultiRefs,
    pendingAttachments,
  ]);

  const selectLatestCanvasChip = () => {
    if (selectedChipId) return;
    const autoCanvasBlocks = inputBlocks.filter(
      (block) =>
        block.type === 'file' && block.file && block.file._canvasAutoInsert,
    );
    const lastAutoBlock = autoCanvasBlocks[autoCanvasBlocks.length - 1];
    if (lastAutoBlock) {
      setSelectedChipId(lastAutoBlock.id);
    }
  };

  const commitPendingAttachments = () => {
    if (pendingAttachments.length > 0) {
      confirmPendingAttachments();
    }
  };

  const handlePickedFiles = (files: File[]) => {
    if (!files || files.length === 0) return;

    if (creationMode === 'image') {
      const images = files.filter((file) => file.type.startsWith('image/')).slice(0, 10);
      if (images.length > 0) {
        const currentUploads = Array.isArray(imageGenUploads) ? imageGenUploads : [];
        setImageGenUploads([...currentUploads, ...images].slice(0, 10));
      }
      return;
    }

    files.forEach((file) => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        appendInputFile(file);
      }
    });
  };

  const handleEditorPaste = (
    e: ClipboardEvent<HTMLSpanElement>,
    blockId: string,
  ) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const items = Array.from(clipboardData.items || []);
    const imageFiles: File[] = [];

    for (const item of items) {
      if (item.type && item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) return;

    e.preventDefault();
    handlePickedFiles(imageFiles);

    const plainText = clipboardData.getData('text/plain');
    if (plainText) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(plainText);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    updateInputBlock(blockId, { text: e.currentTarget.textContent || '' });
  };

  const clearAllInputBlocks = () => {
    const textId = `text-${Date.now()}`;
    setInputBlocks([{ id: textId, type: 'text', text: '' }]);
    setActiveBlockId(textId);
    setSelectedChipId(null);
    onResetInputSelectionState?.();
  };

  return {
    getObjectUrl,
    selectLatestCanvasChip,
    commitPendingAttachments,
    handlePickedFiles,
    handleEditorPaste,
    clearAllInputBlocks,
  };
};
