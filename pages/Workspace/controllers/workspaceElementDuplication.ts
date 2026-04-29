import type { CanvasElement } from "../../../types";
import { collectNodeDescendantIds } from "../workspaceNodeGraph";

type Point = { x: number; y: number };

export type CanvasElementClipboardSnapshot = {
  anchorId: string | null;
  copiedAt: number;
  elements: CanvasElement[];
  pasteCount: number;
  selectionIds: string[];
};

type BuildDuplicatedCanvasSelectionArgs = {
  anchorId?: string | null;
  offset?: Point;
  selectionIds: string[];
  sourceElements: CanvasElement[];
  targetElements: CanvasElement[];
};

const createDuplicateId = (sourceId: string) =>
  `${sourceId}-copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cloneOriginalChildData = (
  originalChildData?: CanvasElement["originalChildData"],
) => {
  if (!originalChildData) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(originalChildData).map(([childId, value]) => [
      childId,
      { ...value },
    ]),
  );
};

const cloneCanvasElement = (element: CanvasElement): CanvasElement => ({
  ...element,
  children: element.children ? [...element.children] : undefined,
  detectedTexts: element.detectedTexts
    ? element.detectedTexts.map((item) => ({ ...item }))
    : undefined,
  genRefImages: element.genRefImages ? [...element.genRefImages] : undefined,
  genRefPreviewImages: element.genRefPreviewImages
    ? [...element.genRefPreviewImages]
    : undefined,
  genVideoRefs: element.genVideoRefs ? [...element.genVideoRefs] : undefined,
  nodeParentIds: element.nodeParentIds ? [...element.nodeParentIds] : undefined,
  originalChildData: cloneOriginalChildData(element.originalChildData),
});

export const resolveDuplicationSelectionIds = (
  sourceElements: CanvasElement[],
  baseSelectionIds: string[],
) => {
  const sourceById = new Map(
    sourceElements.map((element) => [element.id, element] as const),
  );
  const normalizedBaseIds = Array.from(
    new Set(
      baseSelectionIds.filter((selectionId) => sourceById.has(selectionId)),
    ),
  );

  if (normalizedBaseIds.length === 0) {
    return {
      baseSelectionIds: [],
      expandedSelectionIds: [],
    };
  }

  const expandedIdSet = new Set<string>(normalizedBaseIds);
  const pendingGroupIds = [...normalizedBaseIds];

  while (pendingGroupIds.length > 0) {
    const currentId = pendingGroupIds.shift()!;
    const currentElement = sourceById.get(currentId);
    if (currentElement?.type !== "group" || !currentElement.children) {
      continue;
    }

    for (const childId of currentElement.children) {
      if (!sourceById.has(childId) || expandedIdSet.has(childId)) {
        continue;
      }
      expandedIdSet.add(childId);
      pendingGroupIds.push(childId);
    }
  }

  const descendantIds = collectNodeDescendantIds(
    sourceElements,
    Array.from(expandedIdSet),
  );
  for (const descendantId of descendantIds) {
    if (sourceById.has(descendantId)) {
      expandedIdSet.add(descendantId);
    }
  }

  return {
    baseSelectionIds: normalizedBaseIds,
    expandedSelectionIds: sourceElements
      .filter((element) => expandedIdSet.has(element.id))
      .map((element) => element.id),
  };
};

export const createCanvasElementClipboardSnapshot = ({
  anchorId,
  selectionIds,
  sourceElements,
}: {
  anchorId?: string | null;
  selectionIds: string[];
  sourceElements: CanvasElement[];
}): CanvasElementClipboardSnapshot | null => {
  const { baseSelectionIds, expandedSelectionIds } =
    resolveDuplicationSelectionIds(sourceElements, selectionIds);

  if (expandedSelectionIds.length === 0) {
    return null;
  }

  const expandedSelectionIdSet = new Set(expandedSelectionIds);
  const normalizedAnchorId =
    anchorId && expandedSelectionIdSet.has(anchorId)
      ? anchorId
      : baseSelectionIds[0] || expandedSelectionIds[0] || null;

  return {
    anchorId: normalizedAnchorId,
    copiedAt: Date.now(),
    elements: sourceElements
      .filter((element) => expandedSelectionIdSet.has(element.id))
      .map(cloneCanvasElement),
    pasteCount: 0,
    selectionIds: baseSelectionIds,
  };
};

export const buildDuplicatedCanvasSelection = ({
  anchorId,
  offset,
  selectionIds,
  sourceElements,
  targetElements,
}: BuildDuplicatedCanvasSelectionArgs) => {
  const normalizedOffset = offset || { x: 32, y: 32 };
  const { baseSelectionIds, expandedSelectionIds } =
    resolveDuplicationSelectionIds(sourceElements, selectionIds);

  if (expandedSelectionIds.length === 0) {
    return null;
  }

  const sourceById = new Map(
    sourceElements.map((element) => [element.id, element] as const),
  );
  const idMap = new Map(
    expandedSelectionIds.map((selectionId) => [
      selectionId,
      createDuplicateId(selectionId),
    ]),
  );
  const nextZBase =
    targetElements.reduce(
      (maxZIndex, element) => Math.max(maxZIndex, element.zIndex || 0),
      0,
    ) + 1;

  const duplicatedElements = expandedSelectionIds.map((selectionId, index) => {
    const sourceElement = sourceById.get(selectionId)!;
    return {
      ...cloneCanvasElement(sourceElement),
      id: idMap.get(selectionId)!,
      isGenerating: false,
      generatingType: undefined,
      genError: undefined,
      hasFreshGeneratedGlow: false,
      x: sourceElement.x + normalizedOffset.x,
      y: sourceElement.y + normalizedOffset.y,
      zIndex: nextZBase + index,
    } satisfies CanvasElement;
  });

  const duplicateByOldId = new Map(
    expandedSelectionIds.map((selectionId, index) => [
      selectionId,
      duplicatedElements[index],
    ]),
  );

  for (const sourceId of expandedSelectionIds) {
    const sourceElement = sourceById.get(sourceId)!;
    const duplicatedElement = duplicateByOldId.get(sourceId)!;
    const sourceParentIds = sourceElement.nodeParentIds?.length
      ? sourceElement.nodeParentIds
      : sourceElement.nodeParentId
        ? [sourceElement.nodeParentId]
        : [];
    const nextParentIds = sourceParentIds
      .map((parentId) => idMap.get(parentId) || parentId)
      .filter(Boolean);

    duplicatedElement.groupId =
      sourceElement.groupId && idMap.has(sourceElement.groupId)
        ? idMap.get(sourceElement.groupId)
        : undefined;
    duplicatedElement.nodeParentIds =
      nextParentIds.length > 0 ? nextParentIds : undefined;
    duplicatedElement.nodeParentId = nextParentIds[0];

    if (sourceElement.type === "group") {
      const nextChildren = (sourceElement.children || [])
        .map((childId) => idMap.get(childId))
        .filter((childId): childId is string => Boolean(childId));

      duplicatedElement.children =
        nextChildren.length > 0 ? nextChildren : undefined;

      if (sourceElement.originalChildData) {
        const nextOriginalChildData: NonNullable<
          CanvasElement["originalChildData"]
        > = {};

        for (const [childId, childData] of Object.entries(
          sourceElement.originalChildData,
        )) {
          const nextChildId = idMap.get(childId);
          const duplicatedChild = duplicateByOldId.get(childId);
          if (!nextChildId || !duplicatedChild) {
            continue;
          }

          nextOriginalChildData[nextChildId] = {
            ...childData,
            x: childData.x + normalizedOffset.x,
            y: childData.y + normalizedOffset.y,
            zIndex: duplicatedChild.zIndex,
          };
        }

        duplicatedElement.originalChildData =
          Object.keys(nextOriginalChildData).length > 0
            ? nextOriginalChildData
            : undefined;
      } else {
        duplicatedElement.originalChildData = undefined;
      }
    }
  }

  const duplicatedSelectionIds = baseSelectionIds
    .map((selectionId) => idMap.get(selectionId))
    .filter((selectionId): selectionId is string => Boolean(selectionId));
  const duplicatedAnchorId =
    (anchorId && idMap.get(anchorId)) ||
    duplicatedSelectionIds[0] ||
    duplicatedElements[0]?.id ||
    null;
  const duplicatedStartPositions = Object.fromEntries(
    duplicatedElements.map((element) => [
      element.id,
      { x: element.x, y: element.y },
    ]),
  ) as Record<string, Point>;

  return {
    duplicatedAnchorId,
    duplicatedElements,
    duplicatedSelectionIds,
    duplicatedStartPositions,
    nextElements: [...targetElements, ...duplicatedElements],
  };
};
