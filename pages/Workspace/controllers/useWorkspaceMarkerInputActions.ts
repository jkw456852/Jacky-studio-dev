import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { normalizeInputBlocks, useAgentStore } from "../../../stores/agent.store";
import type { InputBlock, Marker } from "../../../types";

type UseWorkspaceMarkerInputActionsOptions = {
  markersRef: MutableRefObject<Marker[]>;
  updateMarkersAndSaveHistory: (nextMarkers: Marker[]) => void;
  setActiveBlockId: (id: string) => void;
  setInputBlocks: (blocks: InputBlock[]) => void;
  setEditingMarkerId: Dispatch<SetStateAction<string | null>>;
};

export function useWorkspaceMarkerInputActions(
  options: UseWorkspaceMarkerInputActionsOptions,
) {
  const {
    markersRef,
    updateMarkersAndSaveHistory,
    setActiveBlockId,
    setInputBlocks,
    setEditingMarkerId,
  } = options;

  const removeInputBlock = useCallback(
    (blockId: string) => {
      const currentBlocks = useAgentStore.getState().composer.inputBlocks;
      const index = currentBlocks.findIndex((block) => block.id === blockId);
      if (index === -1) {
        return;
      }

      const nextBlocks = [...currentBlocks];
      const targetBlock = nextBlocks[index];

      if (targetBlock.file?.markerId) {
        const markerId = targetBlock.file.markerId;
        const nextMarkers = markersRef.current.filter(
          (marker) => marker.id !== markerId,
        );
        updateMarkersAndSaveHistory(nextMarkers);
      }

      nextBlocks.splice(index, 1);
      const normalizedBlocks = normalizeInputBlocks(nextBlocks);

      const nextActiveIndex = Math.min(index, normalizedBlocks.length - 1);
      const nextActiveBlock =
        normalizedBlocks.find(
          (block, blockIndex) =>
            blockIndex >= nextActiveIndex && block.type === "text",
        ) ||
        [...normalizedBlocks].reverse().find((block) => block.type === "text");

      if (nextActiveBlock) {
        setActiveBlockId(nextActiveBlock.id);
      }

      setInputBlocks(normalizedBlocks);
    },
    [markersRef, setActiveBlockId, setInputBlocks, updateMarkersAndSaveHistory],
  );

  const handleSaveMarkerLabel = useCallback(
    (markerId: string, label: string) => {
      const nextMarkers = markersRef.current.map((marker) =>
        marker.id === markerId ? { ...marker, label } : marker,
      );
      updateMarkersAndSaveHistory(nextMarkers);
      setEditingMarkerId(null);

      const currentBlocks = useAgentStore.getState().composer.inputBlocks;
      const nextBlocks = currentBlocks.map((block) => {
        if (
          block.type === "file" &&
          block.file &&
          block.file.markerId === markerId
        ) {
          block.file.markerName =
            label || block.file.lastAiAnalysis || "识别中...";
        }
        return block;
      });

      setInputBlocks([...nextBlocks]);
    },
    [markersRef, setEditingMarkerId, setInputBlocks, updateMarkersAndSaveHistory],
  );

  return {
    removeInputBlock,
    handleSaveMarkerLabel,
  };
}
