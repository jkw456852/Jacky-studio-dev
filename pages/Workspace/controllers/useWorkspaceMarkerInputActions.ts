import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { useAgentStore } from "../../../stores/agent.store";
import type { Marker } from "../../../types";

type UseWorkspaceMarkerInputActionsOptions = {
  markersRef: MutableRefObject<Marker[]>;
  updateMarkersAndSaveHistory: (nextMarkers: Marker[]) => void;
  setEditingMarkerId: Dispatch<SetStateAction<string | null>>;
};

export function useWorkspaceMarkerInputActions(
  options: UseWorkspaceMarkerInputActionsOptions,
) {
  const {
    markersRef,
    updateMarkersAndSaveHistory,
    setEditingMarkerId,
  } = options;

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

      useAgentStore.getState().actions.setInputBlocks([...nextBlocks]);
    },
    [markersRef, setEditingMarkerId, updateMarkersAndSaveHistory],
  );

  return {
    handleSaveMarkerLabel,
  };
}
