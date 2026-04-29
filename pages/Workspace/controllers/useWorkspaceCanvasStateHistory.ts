import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { CanvasElement, Marker } from "../../../types";

import {
  capHistoryLength,
  compactHistoryState,
  type HistoryState,
} from './workspacePersistence';

type UseWorkspaceCanvasStateHistoryOptions = {
  history: HistoryState[];
  historyStep: number;
  elementsRef: MutableRefObject<CanvasElement[]>;
  markersRef: MutableRefObject<Marker[]>;
  setHistory: Dispatch<SetStateAction<HistoryState[]>>;
  setHistoryStep: Dispatch<SetStateAction<number>>;
  setElements: Dispatch<SetStateAction<CanvasElement[]>>;
  setMarkers: Dispatch<SetStateAction<Marker[]>>;
};

export function useWorkspaceCanvasStateHistory(
  options: UseWorkspaceCanvasStateHistoryOptions,
) {
  const {
    history,
    historyStep,
    elementsRef,
    markersRef,
    setHistory,
    setHistoryStep,
    setElements,
    setMarkers,
  } = options;

  const saveToHistory = useCallback(
    (nextElements: CanvasElement[], nextMarkers: Marker[]) => {
      const nextHistory = history.slice(0, historyStep + 1);
      nextHistory.push(
        compactHistoryState({ elements: nextElements, markers: nextMarkers }),
      );
      const cappedHistory = capHistoryLength(nextHistory);
      setHistory(cappedHistory);
      setHistoryStep(cappedHistory.length - 1);
    },
    [history, historyStep, setHistory, setHistoryStep],
  );

  const setElementsSynced = useCallback(
    (
      nextElements:
        | CanvasElement[]
        | ((prev: CanvasElement[]) => CanvasElement[]),
    ) => {
      const resolved =
        typeof nextElements === "function"
          ? (nextElements as (prev: CanvasElement[]) => CanvasElement[])(
              elementsRef.current,
            )
          : nextElements;
      elementsRef.current = resolved;
      setElements(resolved);
    },
    [elementsRef, setElements],
  );

  const setMarkersSynced = useCallback(
    (nextMarkers: Marker[] | ((prev: Marker[]) => Marker[])) => {
      const resolved =
        typeof nextMarkers === "function"
          ? (nextMarkers as (prev: Marker[]) => Marker[])(markersRef.current)
          : nextMarkers;
      markersRef.current = resolved;
      setMarkers(resolved);
    },
    [markersRef, setMarkers],
  );

  const updateMarkersAndSaveHistory = useCallback(
    (nextMarkers: Marker[]) => {
      setMarkersSynced(nextMarkers);
      saveToHistory(elementsRef.current, nextMarkers);
    },
    [elementsRef, saveToHistory, setMarkersSynced],
  );

  const appendElementsAndSaveHistory = useCallback(
    (items: CanvasElement[]) => {
      if (items.length === 0) {
        return;
      }

      const nextElements = [...elementsRef.current, ...items];
      setElementsSynced(nextElements);
      saveToHistory(nextElements, markersRef.current);
    },
    [elementsRef, markersRef, saveToHistory, setElementsSynced],
  );

  const undo = useCallback(() => {
    if (historyStep <= 0) {
      return;
    }

    const previousStep = historyStep - 1;
    setHistoryStep(previousStep);
    setElementsSynced(history[previousStep].elements);
    setMarkersSynced(history[previousStep].markers);
  }, [history, historyStep, setElementsSynced, setHistoryStep, setMarkersSynced]);

  const redo = useCallback(() => {
    if (historyStep >= history.length - 1) {
      return;
    }

    const nextStep = historyStep + 1;
    setHistoryStep(nextStep);
    setElementsSynced(history[nextStep].elements);
    setMarkersSynced(history[nextStep].markers);
  }, [history, historyStep, setElementsSynced, setHistoryStep, setMarkersSynced]);

  return {
    saveToHistory,
    setElementsSynced,
    setMarkersSynced,
    updateMarkersAndSaveHistory,
    appendElementsAndSaveHistory,
    undo,
    redo,
  };
}
