import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { CanvasElement } from "../../../types";

type Point = { x: number; y: number };

type UseWorkspaceCanvasPointerHelpersOptions = {
  elements: CanvasElement[];
  dragOthersCacheRef: MutableRefObject<{
    key: string;
    source: CanvasElement[];
    others: CanvasElement[];
  } | null>;
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  setMarqueeEnd: Dispatch<SetStateAction<Point>>;
};

export function useWorkspaceCanvasPointerHelpers(
  options: UseWorkspaceCanvasPointerHelpersOptions,
) {
  const {
    elements,
    dragOthersCacheRef,
    setSelectedElementIds,
    setMarqueeEnd,
  } = options;

  const setSelectedElementIdsIfChanged = useCallback(
    (nextIds: string[]) => {
      setSelectedElementIds((previousIds) => {
        if (
          previousIds.length === nextIds.length &&
          previousIds.every((id, index) => id === nextIds[index])
        ) {
          return previousIds;
        }

        return nextIds;
      });
    },
    [setSelectedElementIds],
  );

  const setMarqueeEndIfChanged = useCallback(
    (nextPoint: Point) => {
      setMarqueeEnd((previousPoint) =>
        previousPoint.x === nextPoint.x && previousPoint.y === nextPoint.y
          ? previousPoint
          : nextPoint,
      );
    },
    [setMarqueeEnd],
  );

  const getCachedDragOthers = useCallback(
    (draggingIds: Set<string>) => {
      const key = Array.from(draggingIds).sort().join("|");
      const cached = dragOthersCacheRef.current;
      if (cached && cached.key === key && cached.source === elements) {
        return cached.others;
      }

      const others = elements.filter((element) => !draggingIds.has(element.id));
      dragOthersCacheRef.current = { key, source: elements, others };
      return others;
    },
    [dragOthersCacheRef, elements],
  );

  return {
    setSelectedElementIdsIfChanged,
    setMarqueeEndIfChanged,
    getCachedDragOthers,
  };
}
