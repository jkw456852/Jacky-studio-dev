import { useCallback, type MutableRefObject } from "react";
import type { CanvasElement, ChatMessage } from "../../../types";
import type { ImageModel } from "../../../types/common";
import { useAgentStore } from "../../../stores/agent.store";
import { useProjectStore } from "../../../stores/project.store";
import { imageGenSkill } from "../../../services/skills/image-gen.skill";
import {
  canUseNodeGraphParent,
  resolveNodeGraphPlacement,
} from "../workspaceNodeGraph";
import type { WorkspaceNodeInteractionMode } from "../../../types";

type UseWorkspaceSmartGenerateOptions = {
  addMessage: (message: ChatMessage) => void;
  setIsTyping: (typing: boolean) => void;
  executeProposal: (proposalId: string) => Promise<unknown>;
  showAssistant: boolean;
  pan: { x: number; y: number };
  zoom: number;
  elementsRef: MutableRefObject<CanvasElement[]>;
  setElementsSynced: (nextElements: CanvasElement[]) => void;
  setSelectedElementId: (id: string | null) => void;
  selectedElementId: string | null;
  activeImageModel: ImageModel;
  activeImageProviderId: string | null;
  nodeInteractionMode: WorkspaceNodeInteractionMode;
  translatePromptToEnglish: boolean;
  enforceChineseTextInImage: boolean;
  requiredChineseCopy: string;
  getDesignConsistencyContext: () => Record<string, unknown>;
  mergeConsistencyAnchorIntoReferences: (referenceUrls?: string[]) => string[];
  retryWithConsistencyFix: (
    label: string,
    initialUrl: string,
    rerun: (fixPrompt?: string) => Promise<string | null>,
    anchorOverride?: string,
    genPrompt?: string,
    referenceCount?: number,
  ) => Promise<string>;
  applyGeneratedImageToElement: (
    elementId: string,
    resultUrl: string,
    keepCurrentSize?: boolean,
  ) => Promise<void>;
  createGeneratingTreeImageChildren: (
    sourceElementId: string,
    totalCount: number,
    options?: {
      baseElementsOverride?: CanvasElement[];
      sourceElementOverride?: CanvasElement | null;
    },
  ) => string[];
};

type DerivedImageTask = {
  output?: {
    imageUrls?: string[];
    assets?: Array<{ type?: string; url?: string }>;
    skillCalls?: Array<{ success?: boolean; result?: unknown }>;
  };
};

const collectDerivedImageUrls = (task: DerivedImageTask): string[] => {
  if (task?.output?.imageUrls?.length) {
    return task.output.imageUrls;
  }

  return [
    ...((task?.output?.assets || [])
      .filter(
        (asset): asset is { type: "image"; url: string } =>
          asset?.type === "image" && typeof asset.url === "string",
      )
      .map((asset) => asset.url)),
    ...((task?.output?.skillCalls || [])
      .filter(
        (
          call,
        ): call is {
          success: true;
          result: string;
        } => Boolean(call?.success) && typeof call?.result === "string",
      )
      .map((call) => call.result)),
  ];
};

const BRANCH_NODE_WIDTH = 380;
const BRANCH_NODE_HEIGHT = 280;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export function useWorkspaceSmartGenerate(
  options: UseWorkspaceSmartGenerateOptions,
) {
  const {
    addMessage,
    setIsTyping,
    executeProposal,
    showAssistant,
    pan,
    zoom,
    elementsRef,
    setElementsSynced,
    setSelectedElementId,
    selectedElementId,
    activeImageModel,
    activeImageProviderId,
    nodeInteractionMode,
    translatePromptToEnglish,
    enforceChineseTextInImage,
    requiredChineseCopy,
    mergeConsistencyAnchorIntoReferences,
    retryWithConsistencyFix,
    applyGeneratedImageToElement,
    createGeneratingTreeImageChildren,
  } = options;

  return useCallback(
    async (prompt: string, proposalId?: string) => {
      if (proposalId) {
        try {
          setIsTyping(true);
          await executeProposal(proposalId);
          const latestTask = useAgentStore.getState().currentTask;
          if (latestTask?.output) {
            const derivedImageUrls = collectDerivedImageUrls(latestTask);
            addMessage({
              id: `proposal-${latestTask.id}-${Date.now()}`,
              role: "model",
              text: latestTask.output.message || "Proposal executed.",
              timestamp: Date.now(),
              agentData: {
                model: latestTask.agentId,
                title: "Proposal result",
                imageUrls: Array.from(new Set(derivedImageUrls)),
                analysis: latestTask.output.analysis,
                suggestions: latestTask.output.adjustments || [],
              },
            });
          }
        } catch (error) {
          console.error("[Workspace] executeProposal failed:", error);
          addMessage({
            id: `proposal-err-${Date.now()}`,
            role: "model",
            text: "Proposal execution failed. Please try again.",
            timestamp: Date.now(),
          });
        } finally {
          setIsTyping(false);
        }
        return;
      }

      const id = `gen-${Date.now()}`;
      const containerW = window.innerWidth - (showAssistant ? 480 : 0);
      const containerH = window.innerHeight;
      const centerX = (containerW / 2 - pan.x) / (zoom / 100);
      const centerY = (containerH / 2 - pan.y) / (zoom / 100);
      const nodeWidth =
        nodeInteractionMode === "branch" ? BRANCH_NODE_WIDTH : 512;
      const nodeHeight =
        nodeInteractionMode === "branch" ? BRANCH_NODE_HEIGHT : 512;
      const parentElement =
        nodeInteractionMode === "branch" && selectedElementId
          ? elementsRef.current.find((element) => element.id === selectedElementId) ||
            null
          : null;
      const graphPlacement =
        nodeInteractionMode === "branch" && canUseNodeGraphParent(parentElement)
          ? resolveNodeGraphPlacement({
            elements: elementsRef.current,
            parentElement,
            childWidth: nodeWidth,
            childHeight: nodeHeight,
            preferredLinkKind: "generation",
          })
          : null;

      const newEl: CanvasElement = {
        id,
        type: "gen-image",
        x: graphPlacement ? graphPlacement.x : centerX - nodeWidth / 2,
        y: graphPlacement ? graphPlacement.y : centerY - nodeHeight / 2,
        width: nodeWidth,
        height: nodeHeight,
        genPrompt: prompt,
        genModel: activeImageModel,
        genProviderId: activeImageProviderId,
        zIndex: elementsRef.current.length + 10,
        isGenerating: true,
        nodeInteractionMode,
        nodeParentId: graphPlacement?.nodeParentId,
        nodeParentIds: graphPlacement?.nodeParentId
          ? [graphPlacement.nodeParentId]
          : undefined,
        nodeLinkKind: graphPlacement?.nodeLinkKind,
        treeNodeKind: nodeInteractionMode === "branch" ? "prompt" : undefined,
        treeNodeTone: nodeInteractionMode === "branch" ? "lavender" : undefined,
        treeChildrenCollapsed:
          nodeInteractionMode === "branch" ? false : undefined,
      };
      const nextElementsWithPrompt = [...elementsRef.current, newEl];
      setElementsSynced(nextElementsWithPrompt);
      setSelectedElementId(id);

      const markGenerationFailed = () => {
        setElementsSynced(
          elementsRef.current.map((el) =>
            el.id === id ? { ...el, isGenerating: false } : el,
          ),
        );
      };

      try {
        let referenceImages: string[] = [];

        const currentBlocks = useAgentStore.getState().composer.inputBlocks;
        const blockFiles = currentBlocks
          .filter((block) => block.type === "file" && block.file)
          .map((block) => block.file!) as File[];

        for (const file of blockFiles) {
          try {
            referenceImages.push(await readFileAsDataUrl(file));
          } catch {
            // Ignore individual file read failures and continue.
          }
        }

        if (referenceImages.length === 0) {
          const canvasImages = elementsRef.current.filter(
            (element) =>
              (element.type === "image" || element.type === "gen-image") &&
              element.url,
          );
          if (canvasImages.length > 0) {
            referenceImages = canvasImages.slice(-3).map((element) => element.url!);
          }
        }

        referenceImages = mergeConsistencyAnchorIntoReferences(referenceImages);
        const referencePriority =
          referenceImages.length > 1
            ? "all"
            : referenceImages.length === 1
              ? "first"
              : undefined;
        const referenceStrength =
          referenceImages.length > 0 ? 0.88 : undefined;

        const runImageGeneration = (fixPrompt?: string) =>
          imageGenSkill({
            prompt: fixPrompt
              ? `${prompt}\n\nConsistency fix: ${fixPrompt}`
              : prompt,
            model: activeImageModel,
            providerId: activeImageProviderId,
            aspectRatio: newEl.genAspectRatio || "1:1",
            referenceImages:
              referenceImages.length > 0 ? referenceImages : undefined,
            referencePriority,
            referenceStrength,
            promptLanguagePolicy: translatePromptToEnglish
              ? "translate-en"
              : "original-zh",
            textPolicy: {
              enforceChinese: enforceChineseTextInImage,
              requiredCopy: (requiredChineseCopy || "").trim() || undefined,
            },
          });

        const resultUrl = await runImageGeneration();
        if (!resultUrl) {
          markGenerationFailed();
          return;
        }

        const uploadedAnchor =
          useProjectStore.getState().designSession.subjectAnchors?.length
            ? undefined
            : referenceImages[0];
        const finalUrl = await retryWithConsistencyFix(
          "Smart generate result",
          resultUrl,
          runImageGeneration,
          uploadedAnchor,
          prompt,
          referenceImages.length,
        );
        if (nodeInteractionMode === "branch") {
          const childIds = createGeneratingTreeImageChildren(id, 1, {
            baseElementsOverride: nextElementsWithPrompt,
            sourceElementOverride: newEl,
          });
          const childId = childIds[0];
          if (!childId) {
            throw new Error("Failed to create tree image child node");
          }
          await applyGeneratedImageToElement(childId, finalUrl, true);
          setElementsSynced(
            elementsRef.current.map((element) =>
              element.id === id ? { ...element, isGenerating: false } : element,
            ),
          );
        } else {
          await applyGeneratedImageToElement(id, finalUrl, false);
        }
      } catch (error) {
        console.error("Smart gen failed", error);
        markGenerationFailed();
      }
    },
    [
      activeImageModel,
      activeImageProviderId,
      addMessage,
      applyGeneratedImageToElement,
      elementsRef,
      enforceChineseTextInImage,
      executeProposal,
      mergeConsistencyAnchorIntoReferences,
      nodeInteractionMode,
      pan.x,
      pan.y,
      requiredChineseCopy,
      retryWithConsistencyFix,
      selectedElementId,
      createGeneratingTreeImageChildren,
      setElementsSynced,
      setIsTyping,
      setSelectedElementId,
      showAssistant,
      translatePromptToEnglish,
      zoom,
    ],
  );
}
