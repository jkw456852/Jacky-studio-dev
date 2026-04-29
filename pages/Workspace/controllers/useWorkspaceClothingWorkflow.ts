import { useCallback, type MutableRefObject } from "react";
import type { CanvasElement, ChatMessage, InputBlock, Marker } from "../../../types";
import type { ImageModel } from "../../../types/common";
import type {
  ModelGenOptions,
  Requirements,
  WorkflowUiMessage,
} from "../../../types/workflow.types";
import {
  useClothingStudioChatStore,
  type ClothingSessionState,
} from "../../../stores/clothingStudioChat.store";
import { useImageHostStore } from "../../../stores/imageHost.store";
import { uploadImage } from "../../../utils/uploader";
import { executeSkill } from "../../../services/skills";
import {
  addTopicMemoryItem,
  extractConstraintHints,
  saveTopicAsset,
  upsertTopicSnapshot,
} from "../../../services/topic-memory";
import { getMappedModelIds } from "../../../services/provider-settings";

type ClothingActions = ReturnType<typeof useClothingStudioChatStore.getState>["actions"];

type WorkflowImage = { id: string; url: string; name?: string };
type SkillWorkflowImage = { url: string; label?: string };
type FailedWorkflowItem = { index: number; prompt: string; label?: string };

type HandleWorkflowSendArgs = {
  text: string;
  attachments: File[];
};

type UseWorkspaceClothingWorkflowOptions = {
  addMessage: (message: ChatMessage) => void;
  showAssistant: boolean;
  pan: { x: number; y: number };
  zoom: number;
  elementsRef: MutableRefObject<CanvasElement[]>;
  markersRef: MutableRefObject<Marker[]>;
  setElementsSynced: (nextElements: CanvasElement[]) => void;
  saveToHistory: (newElements: CanvasElement[], newMarkers: Marker[]) => void;
  setSelectedElementId: (id: string | null) => void;
  clothingState: ClothingSessionState;
  clothingActions: ClothingActions;
  setClothingWorkflowError: (message: string | null) => void;
  autoModelSelect: boolean;
  preferredImageModel: ImageModel;
  getCurrentTopicId: () => string;
  ensureTopicId: () => string;
  ensureClothingSession: () => string;
  setInputBlocks: (blocks: InputBlock[]) => void;
  setIsTyping: (typing: boolean) => void;
};

const EMPTY_INPUT_BLOCKS: InputBlock[] = [{ id: "init", type: "text", text: "" }];

const isSkillWorkflowImage = (value: unknown): value is SkillWorkflowImage =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { url?: unknown }).url === "string";

const normalizeSkillWorkflowImages = (value: unknown): SkillWorkflowImage[] =>
  Array.isArray(value) ? value.filter(isSkillWorkflowImage) : [];

const normalizeFailedWorkflowItems = (value: unknown): FailedWorkflowItem[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is FailedWorkflowItem =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { index?: unknown }).index === "number" &&
          typeof (item as { prompt?: unknown }).prompt === "string",
      )
    : [];

const getErrorMessage = (
  error: unknown,
  fallback: string,
): string => (error instanceof Error ? error.message : fallback);

const DEFAULT_AUTO_IMAGE_MODEL: ImageModel = "Nano Banana Pro";

const getEffectiveClothingImageModel = (
  autoModelSelect: boolean,
  preferredImageModel: ImageModel,
): ImageModel => {
  if (!autoModelSelect) return preferredImageModel;
  const [firstModel] = getMappedModelIds("image");
  return (firstModel?.trim() as ImageModel) || DEFAULT_AUTO_IMAGE_MODEL;
};

export function useWorkspaceClothingWorkflow(
  options: UseWorkspaceClothingWorkflowOptions,
) {
  const {
    addMessage,
    showAssistant,
    pan,
    zoom,
    elementsRef,
    markersRef,
    setElementsSynced,
    saveToHistory,
    setSelectedElementId,
    clothingState,
    clothingActions,
    setClothingWorkflowError,
    autoModelSelect,
    preferredImageModel,
    getCurrentTopicId,
    ensureTopicId,
    ensureClothingSession,
    setInputBlocks,
    setIsTyping,
  } = options;
  const effectiveImageModel = getEffectiveClothingImageModel(
    autoModelSelect,
    preferredImageModel,
  );

  const pushWorkflowUiMessage = useCallback(
    (ui: WorkflowUiMessage, text = "Clothing workflow") => {
      addMessage({
        id: `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "model",
        text,
        kind: "workflow_ui",
        workflowUi: ui,
        timestamp: Date.now(),
      } as ChatMessage);
    },
    [addMessage],
  );

  const insertResultToCanvas = useCallback(
    (url: string, label?: string) => {
      const containerW = window.innerWidth - (showAssistant ? 480 : 0);
      const containerH = window.innerHeight;
      const centerX = (containerW / 2 - pan.x) / (zoom / 100);
      const centerY = (containerH / 2 - pan.y) / (zoom / 100);
      const newEl: CanvasElement = {
        id: `workflow-img-${Date.now()}`,
        type: "image",
        url,
        x: centerX - 240,
        y: centerY - 320,
        width: 480,
        height: 640,
        zIndex: elementsRef.current.length + 1,
        genPrompt: label || "Clothing workflow result",
      };
      const next = [...elementsRef.current, newEl];
      setElementsSynced(next);
      saveToHistory(next, markersRef.current);
      setSelectedElementId(newEl.id);
    },
    [
      elementsRef,
      markersRef,
      pan.x,
      pan.y,
      saveToHistory,
      setElementsSynced,
      setSelectedElementId,
      showAssistant,
      zoom,
    ],
  );

  const startClothingWorkflow = useCallback(() => {
    ensureClothingSession();
    clothingActions.reset();
    setClothingWorkflowError(null);
    clothingActions.setStep("WAIT_PRODUCT");
    pushWorkflowUiMessage({
      type: "clothingStudio.product",
      productCount: 0,
      max: 6,
    });
  }, [
    clothingActions,
    ensureClothingSession,
    pushWorkflowUiMessage,
    setClothingWorkflowError,
  ]);

  const handleClothingGenerateModel = useCallback(
    async (options: ModelGenOptions) => {
      ensureClothingSession();
      clothingActions.setStep("MODEL_GENERATING");
      clothingActions.setModelOptions(options);
      setClothingWorkflowError(null);
      pushWorkflowUiMessage(
        {
          type: "clothingStudio.progress",
          done: 0,
          total: Math.max(1, options.count || 1),
          text: "Generating model images...",
        },
        "Generating model images...",
      );

      try {
        const candidates = await executeSkill("generateModel", {
          options,
          preferredImageModel: effectiveImageModel,
        });
        const candidatePayload = candidates as
          | SkillWorkflowImage[]
          | { images?: unknown; anchorSheetUrl?: unknown };
        const images = Array.isArray(candidatePayload)
          ? normalizeSkillWorkflowImages(candidatePayload)
          : normalizeSkillWorkflowImages(candidatePayload?.images);
        const anchorSheetUrl =
          typeof candidatePayload === "object" &&
          candidatePayload !== null &&
          !Array.isArray(candidatePayload) &&
          typeof candidatePayload.anchorSheetUrl === "string"
            ? candidatePayload.anchorSheetUrl
            : undefined;

        if (images.length === 0) {
          throw new Error("No model candidates were generated.");
        }

        clothingActions.setModelViews(
          images.map((item, idx: number) => ({
            id: `model-view-${idx}-${Date.now()}`,
            url: item.url,
          })),
        );
        if (anchorSheetUrl) {
          clothingActions.setModelAnchorSheetUrl(anchorSheetUrl);
        }
        clothingActions.setModelCandidates(
          images.map((item, idx: number) => ({
            id: `model-${idx}-${Date.now()}`,
            url: item.url,
          })),
        );

        if (images.length === 1) {
          const picked = images[0];
          clothingActions.setModelImage({
            id: `model-auto-${Date.now()}`,
            url: picked.url,
          });
          clothingActions.setStep("WAIT_REQUIREMENTS");
          pushWorkflowUiMessage(
            {
              type: "clothingStudio.requirementsForm",
              defaults: clothingState.requirements,
            },
            "Model selected. Fill in the composition requirements.",
          );
        } else {
          pushWorkflowUiMessage(
            { type: "clothingStudio.modelCandidates", images },
            "Model candidates are ready. Pick one as the anchor.",
          );
        }

        const topicId = getCurrentTopicId();
        if (topicId) {
          if (anchorSheetUrl) {
            await saveTopicAsset(topicId, "model_anchor_sheet", {
              url: anchorSheetUrl,
              mime: "image/png",
            });
          }
          if (images[0]?.url) {
            await saveTopicAsset(topicId, "model", {
              url: images[0].url,
              mime: "image/png",
            });
          }
        }
      } catch (error) {
        const message = getErrorMessage(
          error,
          "Failed to generate model images. Check the provider config and try again.",
        );
        setClothingWorkflowError(message);
        addMessage({
          id: `workflow-model-err-${Date.now()}`,
          role: "model",
          text: `Model generation failed: ${message}`,
          timestamp: Date.now(),
          error: true,
        });
        pushWorkflowUiMessage(
          {
            type: "clothingStudio.generateModelForm",
            defaults: clothingState.modelOptions,
          },
          "Adjust the model options and try again.",
        );
      }
    },
    [
      addMessage,
      clothingActions,
      clothingState.modelOptions,
      clothingState.requirements,
      effectiveImageModel,
      ensureClothingSession,
      getCurrentTopicId,
      pushWorkflowUiMessage,
      setClothingWorkflowError,
    ],
  );

  const handleClothingPickModel = useCallback(
    (url: string) => {
      ensureClothingSession();
      clothingActions.setModelImage({ id: `model-pick-${Date.now()}`, url });
      clothingActions.setStep("WAIT_REQUIREMENTS");
      addMessage({
        id: `workflow-model-anchor-${Date.now()}`,
        role: "model",
        text: "Model anchor confirmed.",
        timestamp: Date.now(),
      });
      pushWorkflowUiMessage({
        type: "clothingStudio.requirementsForm",
        defaults: clothingState.requirements,
      });

      const topicId = getCurrentTopicId();
      if (topicId) {
        void saveTopicAsset(topicId, "model", { url, mime: "image/png" });
      }
    },
    [
      addMessage,
      clothingActions,
      clothingState.requirements,
      ensureClothingSession,
      getCurrentTopicId,
      pushWorkflowUiMessage,
    ],
  );

  const runClothingGeneration = useCallback(
    async (requirements: Requirements, retryFailed = false) => {
      ensureClothingSession();
      if (!clothingState.modelImage?.url) {
        clothingActions.setStep("NEED_MODEL");
        pushWorkflowUiMessage(
          { type: "clothingStudio.needModel" },
          "Select or generate a model anchor first.",
        );
        return;
      }

      clothingActions.setRequirements(requirements);
      clothingActions.setStep("GENERATING");
      clothingActions.setGenerating(true);
      setClothingWorkflowError(null);
      const ctrl = clothingActions.startAbortSession();

      pushWorkflowUiMessage({
        type: "clothingStudio.progress",
        done: 0,
        total: requirements.count,
        text: "Preparing generation...",
      });

      try {
        const result = await executeSkill("clothingStudioWorkflow", {
          productImages: clothingState.productImages.map((item) => item.url),
          modelImage: clothingState.modelImage?.url,
          modelAnchorSheetUrl:
            clothingState.modelAnchorSheetUrl || clothingState.modelImage?.url,
          productAnchorUrl:
            clothingState.productAnchorUrl ||
            clothingState.productImages[0]?.url ||
            undefined,
          analysis: clothingState.analysis,
          topicId: ensureTopicId(),
          preferredImageModel: effectiveImageModel,
          requirements,
          retryFailedItems: retryFailed ? clothingState.failedItems : undefined,
          signal: ctrl.signal,
          onProgress: (done: number, total: number, text?: string) => {
            clothingActions.setProgress({ done, total, text });
            pushWorkflowUiMessage({
              type: "clothingStudio.progress",
              done,
              total,
              text,
            });
          },
        });

        const resultPayload = result as {
          images?: unknown;
          ui?: { images?: unknown };
          failedItems?: unknown;
        };
        const images = normalizeSkillWorkflowImages(
          resultPayload?.images || resultPayload?.ui?.images,
        );
        const failedItems = normalizeFailedWorkflowItems(
          resultPayload?.failedItems,
        );
        clothingActions.setResults(images);
        clothingActions.setFailedItems(failedItems);
        clothingActions.setStep("DONE");
        pushWorkflowUiMessage(
          { type: "clothingStudio.results", images },
          "Clothing workflow completed.",
        );

        const topicId = getCurrentTopicId();
        if (topicId) {
          await Promise.all(
            images.slice(0, 20).map((img) =>
              saveTopicAsset(topicId, "result", {
                url: img.url,
                mime: "image/png",
              }),
            ),
          );
        }
      } catch (error) {
        const isAbort =
          (error instanceof Error && error.name === "AbortError") ||
          /abort|aborted|cancel/i.test(
            String(error instanceof Error ? error.message : ""),
          );
        const message = isAbort
          ? "Generation cancelled."
          : getErrorMessage(error, "Clothing workflow generation failed.");
        setClothingWorkflowError(message);
        clothingActions.setStep("WAIT_REQUIREMENTS");
        addMessage({
          id: `workflow-generate-err-${Date.now()}`,
          role: "model",
          text: isAbort ? message : `Generation failed: ${message}`,
          timestamp: Date.now(),
          error: !isAbort,
        });
      } finally {
        clothingActions.clearAbortSession();
        clothingActions.setGenerating(false);
      }
    },
    [
      addMessage,
      clothingActions,
      clothingState.analysis,
      clothingState.failedItems,
      clothingState.modelAnchorSheetUrl,
      clothingState.modelImage,
      clothingState.productAnchorUrl,
      clothingState.productImages,
      effectiveImageModel,
      ensureClothingSession,
      ensureTopicId,
      getCurrentTopicId,
      pushWorkflowUiMessage,
      setClothingWorkflowError,
    ],
  );

  const handleClothingSubmitRequirements = useCallback(
    async (requirements: Requirements) => {
      await runClothingGeneration(requirements, false);
    },
    [runClothingGeneration],
  );

  const handleClothingRetryFailed = useCallback(async () => {
    if (!clothingState.failedItems.length) return;
    await runClothingGeneration(clothingState.requirements, true);
  }, [
    clothingState.failedItems.length,
    clothingState.requirements,
    runClothingGeneration,
  ]);

  const handleClothingWorkflowSend = useCallback(
    async ({ text, attachments }: HandleWorkflowSendArgs) => {
      try {
        setIsTyping(true);
        const topicId = ensureTopicId();
        if (topicId && text?.trim()) {
          const hints = extractConstraintHints(text);
          if (hints.length > 0) {
            await upsertTopicSnapshot(topicId, {
              pinned: {
                constraints: hints,
                decisions: [],
              },
            });
          }
          await addTopicMemoryItem({
            topicId,
            type: "instruction",
            text: text.trim(),
          });
        }

        if (attachments.length > 0) {
          const hostProvider = useImageHostStore.getState().selectedProvider;
          if (hostProvider === "none") {
            throw new Error(
              "Enable an image host in Settings before uploading product references.",
            );
          }

          const uploaded: WorkflowImage[] = [];
          const failedNames: string[] = [];

          for (const file of attachments) {
            try {
              const url = await uploadImage(file);
              uploaded.push({
                id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                url,
                name: file.name,
              });
              if (topicId) {
                const role =
                  clothingState.step === "WAIT_PRODUCT" ? "product" : "reference";
                await saveTopicAsset(topicId, role, {
                  url,
                  mime: file.type || "image/png",
                });
              }
            } catch (error) {
              failedNames.push(file.name || "unnamed-file");
              console.error("[ClothingWorkflow] upload failed", error);
            }
          }

          if (uploaded.length !== attachments.length) {
            const detail =
              failedNames.length > 0
                ? ` Failed files: ${failedNames.join(", ")}`
                : "";
            throw new Error(`Image upload failed.${detail}`);
          }

          if (clothingState.step === "WAIT_PRODUCT") {
            clothingActions.addProductImages(uploaded);
            const nextCount = Math.min(
              6,
              clothingState.productImages.length + uploaded.length,
            );
            clothingActions.setStep("ANALYZING_PRODUCT");
            pushWorkflowUiMessage(
              {
                type: "clothingStudio.product",
                productCount: nextCount,
                max: 6,
              },
              `Product references received: ${nextCount}/6`,
            );
            pushWorkflowUiMessage(
              { type: "clothingStudio.analyzing" },
              "Analyzing product anchor...",
            );

            try {
              const mergedProductImages = [
                ...clothingState.productImages.map((item) => item.url),
                ...uploaded.map((item) => item.url),
              ].slice(0, 6);
              const analysis = await executeSkill("analyzeClothingProduct", {
                productImages: mergedProductImages,
                brief: text,
              });

              clothingActions.setAnalysis(analysis);
              const anchorIndex = Math.max(
                0,
                Math.min(
                  mergedProductImages.length - 1,
                  Number(analysis?.productAnchorIndex || 0),
                ),
              );
              clothingActions.setProductAnchorUrl(
                mergedProductImages[anchorIndex] || mergedProductImages[0],
              );
              clothingActions.setStep("WAIT_MODEL_OPTIONAL");

              if (topicId) {
                await upsertTopicSnapshot(topicId, {
                  pinned: {
                    constraints: ["Pure white background", "Clarity 2K"],
                    decisions: ["Product anchor locked after analysis"],
                  },
                });
              }

              pushWorkflowUiMessage(
                {
                  type: "clothingStudio.analysis",
                  analysis,
                },
                "Product analysis completed.",
              );
              pushWorkflowUiMessage(
                { type: "clothingStudio.needModel" },
                "Upload or generate a model anchor next.",
              );
              pushWorkflowUiMessage(
                {
                  type: "clothingStudio.generateModelForm",
                  defaults: clothingState.modelOptions,
                },
                "You can generate the model anchor directly here.",
              );
            } catch (analysisError) {
              clothingActions.setStep("WAIT_MODEL_OPTIONAL");
              addMessage({
                id: `workflow-analysis-err-${Date.now()}`,
                role: "model",
                text: `Product analysis failed: ${getErrorMessage(analysisError, "unknown error")}`,
                timestamp: Date.now(),
                error: true,
              });
            }
          } else if (
            ["NEED_MODEL", "MODEL_GENERATING", "WAIT_MODEL_OPTIONAL"].includes(
              clothingState.step,
            )
          ) {
            const last = uploaded[uploaded.length - 1];
            if (last) {
              clothingActions.setModelImage(last);
              clothingActions.setStep("WAIT_REQUIREMENTS");
              pushWorkflowUiMessage(
                {
                  type: "clothingStudio.requirementsForm",
                  defaults: clothingState.requirements,
                },
                "Model image confirmed. Fill in the generation requirements.",
              );
            }
          } else {
            clothingActions.addProductImages(uploaded);
            pushWorkflowUiMessage(
              {
                type: "clothingStudio.product",
                productCount: Math.min(
                  6,
                  clothingState.productImages.length + uploaded.length,
                ),
                max: 6,
              },
              "Product references updated.",
            );
          }

          const hasModel = !!clothingState.modelImage;
          const productCount = Math.min(
            6,
            clothingState.productImages.length + uploaded.length,
          );
          addMessage({
            id: `workflow-anchor-${Date.now()}`,
            role: "model",
            text: hasModel
              ? `Anchors ready: 1 model anchor and ${productCount} product anchors.`
              : `Received ${productCount} product anchors. Add a model anchor next.`,
            timestamp: Date.now(),
          });
        } else {
          if (clothingState.step === "WAIT_PRODUCT") {
            pushWorkflowUiMessage(
              {
                type: "clothingStudio.product",
                productCount: clothingState.productImages.length,
                max: 6,
              },
              "Upload 1 to 6 product images first.",
            );
          } else if (clothingState.step === "WAIT_MODEL_OPTIONAL") {
            if (!clothingState.modelImage) {
              clothingActions.setStep("NEED_MODEL");
              pushWorkflowUiMessage(
                { type: "clothingStudio.needModel" },
                "A model anchor is still required.",
              );
              pushWorkflowUiMessage(
                {
                  type: "clothingStudio.generateModelForm",
                  defaults: clothingState.modelOptions,
                },
                "Generate or upload a model anchor.",
              );
            } else {
              clothingActions.setStep("WAIT_REQUIREMENTS");
              pushWorkflowUiMessage(
                {
                  type: "clothingStudio.requirementsForm",
                  defaults: clothingState.requirements,
                },
                "Fill in the generation requirements.",
              );
            }
          }
        }

        setInputBlocks(EMPTY_INPUT_BLOCKS);
      } catch (error) {
        const message = getErrorMessage(
          error,
          "Clothing workflow request failed.",
        );
        setClothingWorkflowError(message);
        addMessage({
          id: `workflow-send-err-${Date.now()}`,
          role: "model",
          text: `Clothing workflow failed: ${message}`,
          timestamp: Date.now(),
          error: true,
        });
      } finally {
        setIsTyping(false);
      }
    },
    [
      addMessage,
      clothingActions,
      clothingState.modelImage,
      clothingState.modelOptions,
      clothingState.productImages,
      clothingState.requirements,
      clothingState.step,
      ensureTopicId,
      setClothingWorkflowError,
      setInputBlocks,
      setIsTyping,
      pushWorkflowUiMessage,
    ],
  );

  return {
    pushWorkflowUiMessage,
    insertResultToCanvas,
    startClothingWorkflow,
    handleClothingGenerateModel,
    handleClothingPickModel,
    handleClothingSubmitRequirements,
    handleClothingRetryFailed,
    handleClothingWorkflowSend,
  };
}
