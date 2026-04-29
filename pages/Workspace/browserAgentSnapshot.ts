import type { CanvasElement } from "../../types";

type Point = {
  x: number;
  y: number;
};

export type WorkspaceBrowserAgentElementSummary = {
  id: string;
  type: CanvasElement["type"];
  position: Point;
  size: {
    width: number;
    height: number;
  };
  zIndex: number;
  visibility: {
    locked: boolean;
    hidden: boolean;
  };
  content: {
    textPreview: string | null;
    shapeType: CanvasElement["shapeType"] | null;
    hasImageUrl: boolean;
    hasOriginalUrl: boolean;
    hasProxyUrl: boolean;
    referenceImageCount: number;
    previewImageCount: number;
  };
  grouping: {
    groupId: string | null;
    childCount: number;
    nodeParentId: string | null;
    nodeParentIds: string[];
    nodeLinkKind: CanvasElement["nodeLinkKind"] | null;
    treeNodeKind: CanvasElement["treeNodeKind"] | null;
    treeNodeTone: string | null;
  };
  generation: {
    model: string | null;
    providerId: string | null;
    aspectRatio: string | null;
    resolution: CanvasElement["genResolution"] | null;
    quality: CanvasElement["genImageQuality"] | null;
    imageCount: CanvasElement["genImageCount"] | null;
    infiniteRetry: boolean;
    referenceRoleMode: CanvasElement["genReferenceRoleMode"] | null;
    hasPrompt: boolean;
    isGenerating: boolean;
    phase: CanvasElement["genStatusPhase"] | null;
    statusTitle: string | null;
    statusLines: string[];
    error: string | null;
    promptPreview: string | null;
  };
};

export type WorkspaceBrowserAgentSnapshot = {
  project: {
    title: string;
    showAssistant: boolean;
    previewOpen: boolean;
  };
  canvas: {
    activeTool: string;
    creationMode: string;
    zoom: number;
    pan: Point;
    isPanning: boolean;
    isPickingFromCanvas: boolean;
    isMarqueeSelecting: boolean;
  };
  selection: {
    selectedElementId: string | null;
    selectedElementIds: string[];
    selectedCount: number;
    hasMultiSelection: boolean;
    primarySelectedElement: WorkspaceBrowserAgentElementSummary | null;
  };
  elements: {
    totalCount: number;
    visibleCount: number;
    rootCount: number;
    generatingCount: number;
    typeCounts: Partial<Record<CanvasElement["type"], number>>;
  };
};

type BuildWorkspaceBrowserAgentSnapshotArgs = {
  projectTitle: string;
  showAssistant: boolean;
  previewUrl: string | null;
  activeTool: string;
  creationMode: string;
  zoom: number;
  pan: Point;
  isPanning: boolean;
  isPickingFromCanvas: boolean;
  isMarqueeSelecting: boolean;
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedElement: CanvasElement | null;
  elements: CanvasElement[];
  visibleElements: CanvasElement[];
  rootElements: CanvasElement[];
};

const truncateText = (value: string | undefined, maxLength: number) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
};

export const summarizeCanvasElementForBrowserAgent = (
  element: CanvasElement | null,
): WorkspaceBrowserAgentElementSummary | null => {
  if (!element) return null;

  return {
    id: element.id,
    type: element.type,
    position: {
      x: element.x,
      y: element.y,
    },
    size: {
      width: element.width,
      height: element.height,
    },
    zIndex: element.zIndex,
    visibility: {
      locked: Boolean(element.isLocked),
      hidden: Boolean(element.isHidden),
    },
    content: {
      textPreview: truncateText(element.text, 160),
      shapeType: element.shapeType || null,
      hasImageUrl: Boolean(element.url),
      hasOriginalUrl: Boolean(element.originalUrl),
      hasProxyUrl: Boolean(element.proxyUrl),
      referenceImageCount: Array.isArray(element.genRefImages)
        ? element.genRefImages.length
        : element.genRefImage
          ? 1
          : 0,
      previewImageCount: Array.isArray(element.genRefPreviewImages)
        ? element.genRefPreviewImages.length
        : element.genRefPreviewImage
          ? 1
          : 0,
    },
    grouping: {
      groupId: element.groupId || null,
      childCount: Array.isArray(element.children) ? element.children.length : 0,
      nodeParentId: element.nodeParentId || null,
      nodeParentIds: Array.isArray(element.nodeParentIds)
        ? element.nodeParentIds.filter(Boolean)
        : [],
      nodeLinkKind: element.nodeLinkKind || null,
      treeNodeKind: element.treeNodeKind || null,
      treeNodeTone: element.treeNodeTone || null,
    },
    generation: {
      model: element.genModel ? String(element.genModel) : null,
      providerId: element.genProviderId || null,
      aspectRatio: element.genAspectRatio || null,
      resolution: element.genResolution || null,
      quality: element.genImageQuality || null,
      imageCount: element.genImageCount || null,
      infiniteRetry: Boolean(element.genInfiniteRetry),
      referenceRoleMode: element.genReferenceRoleMode || null,
      hasPrompt: Boolean(String(element.genPrompt || "").trim()),
      isGenerating: Boolean(element.isGenerating),
      phase: element.genStatusPhase || null,
      statusTitle: element.genStatusTitle || null,
      statusLines: Array.isArray(element.genStatusLines)
        ? element.genStatusLines
            .map((line) => String(line || "").trim())
            .filter(Boolean)
            .slice(0, 5)
        : [],
      error: element.genError || null,
      promptPreview: truncateText(element.genPrompt, 260),
    },
  };
};

export const summarizeCanvasElementsForBrowserAgent = (
  elements: CanvasElement[],
): WorkspaceBrowserAgentElementSummary[] =>
  elements
    .map((element) => summarizeCanvasElementForBrowserAgent(element))
    .filter(
      (element): element is WorkspaceBrowserAgentElementSummary => Boolean(element),
    );

export const buildWorkspaceBrowserAgentSnapshot = ({
  projectTitle,
  showAssistant,
  previewUrl,
  activeTool,
  creationMode,
  zoom,
  pan,
  isPanning,
  isPickingFromCanvas,
  isMarqueeSelecting,
  selectedElementId,
  selectedElementIds,
  selectedElement,
  elements,
  visibleElements,
  rootElements,
}: BuildWorkspaceBrowserAgentSnapshotArgs): WorkspaceBrowserAgentSnapshot => {
  const normalizedSelectedIds =
    selectedElementIds.length > 0
      ? selectedElementIds.filter(Boolean)
      : selectedElementId
        ? [selectedElementId]
        : [];

  const typeCounts = elements.reduce<
    Partial<Record<CanvasElement["type"], number>>
  >((accumulator, element) => {
    const nextCount = accumulator[element.type] || 0;
    accumulator[element.type] = nextCount + 1;
    return accumulator;
  }, {});

  return {
    project: {
      title: projectTitle,
      showAssistant,
      previewOpen: Boolean(previewUrl),
    },
    canvas: {
      activeTool,
      creationMode,
      zoom,
      pan,
      isPanning,
      isPickingFromCanvas,
      isMarqueeSelecting,
    },
    selection: {
      selectedElementId,
      selectedElementIds: normalizedSelectedIds,
      selectedCount: normalizedSelectedIds.length,
      hasMultiSelection: normalizedSelectedIds.length > 1,
      primarySelectedElement: summarizeCanvasElementForBrowserAgent(
        selectedElement,
      ),
    },
    elements: {
      totalCount: elements.length,
      visibleCount: visibleElements.length,
      rootCount: rootElements.length,
      generatingCount: elements.filter((element) => element.isGenerating).length,
      typeCounts,
    },
  };
};
