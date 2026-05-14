import React from "react";
import type { AssistantSidebarProps } from "../components/AssistantSidebar";
import { WorkspaceLeftPanel } from "../components/WorkspaceLeftPanel";
import type { ImageModel } from "../../../types";

type UseWorkspaceSidebarPropsArgs = {
  leftPanelMode: React.ComponentProps<
    typeof WorkspaceLeftPanel
  >["leftPanelMode"];
  setLeftPanelMode: React.Dispatch<
    React.SetStateAction<
      React.ComponentProps<typeof WorkspaceLeftPanel>["leftPanelMode"]
    >
  >;
  elements: React.ComponentProps<typeof WorkspaceLeftPanel>["elements"];
  rootElements: React.ComponentProps<typeof WorkspaceLeftPanel>["rootElements"];
  elementById: React.ComponentProps<typeof WorkspaceLeftPanel>["elementById"];
  selectedElementId: React.ComponentProps<
    typeof WorkspaceLeftPanel
  >["selectedElementId"];
  selectedElementIds: React.ComponentProps<
    typeof WorkspaceLeftPanel
  >["selectedElementIds"];
  isHistoryExpanded: React.ComponentProps<
    typeof WorkspaceLeftPanel
  >["isHistoryExpanded"];
  setIsHistoryExpanded: React.ComponentProps<
    typeof WorkspaceLeftPanel
  >["setIsHistoryExpanded"];
  handleElementMouseDown: React.ComponentProps<
    typeof WorkspaceLeftPanel
  >["onSelect"];
  setElements: React.Dispatch<
    React.SetStateAction<
      React.ComponentProps<typeof WorkspaceLeftPanel>["elements"]
    >
  >;
  setFocusedGroupId: React.Dispatch<React.SetStateAction<string | null>>;
  messages: React.ComponentProps<typeof WorkspaceLeftPanel>["messages"];
  setPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
  focusedGroupId: React.ComponentProps<
    typeof WorkspaceLeftPanel
  >["focusedGroupId"];
  workflowRecipesPanel: React.ComponentProps<
    typeof WorkspaceLeftPanel
  >["workflowRecipesPanel"];
  id: string | undefined;
  conversations: AssistantSidebarProps["session"]["conversations"];
  setConversations: AssistantSidebarProps["session"]["setConversations"];
  activeConversationId: AssistantSidebarProps["session"]["activeConversationId"];
  setActiveConversationId: AssistantSidebarProps["session"]["setActiveConversationId"];
  showAssistant: boolean;
  setShowAssistant: AssistantSidebarProps["panelUi"]["setShowAssistant"];
  isAssistantFullscreen: boolean;
  setIsAssistantFullscreen: NonNullable<
    AssistantSidebarProps["panelUi"]["setIsFullscreen"]
  >;
  onToggleAssistantFullscreen: NonNullable<
    AssistantSidebarProps["panelUi"]["onToggleFullscreen"]
  >;
  onOpenEcommerceWorkflow: AssistantSidebarProps["panelUi"]["onOpenEcommerceWorkflow"];
  handleSend: AssistantSidebarProps["messageActions"]["handleSend"];
  handleSmartGenerate: AssistantSidebarProps["messageActions"]["handleSmartGenerate"];
  addGenImage: (input?: {
    genPrompt?: string;
    genModel?: ImageModel;
    genProviderId?: string | null;
    genAspectRatio?: string;
    genResolution?: "1K" | "2K" | "4K";
    genRefImages?: string[];
    genRefPreviewImages?: string[];
    nodeInteractionMode?: "classic" | "branch";
    disableAutoParentLink?: boolean;
  }) => string;
  activeImageModel: ImageModel;
  activeImageProviderId: string | null;
  imageGenRatio: string;
  imageGenRes: "1K" | "2K" | "4K";
  nodeInteractionMode: "classic" | "branch";
  creationMode: AssistantSidebarProps["composer"]["creationMode"];
  setCreationMode: AssistantSidebarProps["composer"]["setCreationMode"];
  setPrompt: AssistantSidebarProps["composer"]["setPrompt"];
  handleModeSwitch: AssistantSidebarProps["composer"]["handleModeSwitch"];
  fileInputRef: AssistantSidebarProps["composer"]["fileInputRef"];
  selectedChipId: AssistantSidebarProps["inputUi"]["selectedChipId"];
  setSelectedChipId: AssistantSidebarProps["inputUi"]["setSelectedChipId"];
  hoveredChipId: AssistantSidebarProps["inputUi"]["hoveredChipId"];
  setHoveredChipId: AssistantSidebarProps["inputUi"]["setHoveredChipId"];
  showModeSelector: AssistantSidebarProps["inputUi"]["showModeSelector"];
  setShowModeSelector: AssistantSidebarProps["inputUi"]["setShowModeSelector"];
  showRatioPicker: AssistantSidebarProps["inputUi"]["showRatioPicker"];
  setShowRatioPicker: AssistantSidebarProps["inputUi"]["setShowRatioPicker"];
  showModelPicker: AssistantSidebarProps["inputUi"]["showModelPicker"];
  setShowModelPicker: AssistantSidebarProps["inputUi"]["setShowModelPicker"];
  isInputFocused: AssistantSidebarProps["inputUi"]["isInputFocused"];
  setIsInputFocused: AssistantSidebarProps["inputUi"]["setIsInputFocused"];
  isDragOver: AssistantSidebarProps["inputUi"]["isDragOver"];
  setIsDragOver: AssistantSidebarProps["inputUi"]["setIsDragOver"];
  isVideoPanelHovered: AssistantSidebarProps["inputUi"]["isVideoPanelHovered"];
  setIsVideoPanelHovered: AssistantSidebarProps["inputUi"]["setIsVideoPanelHovered"];
  showVideoSettingsDropdown: AssistantSidebarProps["inputUi"]["showVideoSettingsDropdown"];
  setShowVideoSettingsDropdown: AssistantSidebarProps["inputUi"]["setShowVideoSettingsDropdown"];
  modelPreferences: AssistantSidebarProps["modelPreferences"];
  markers: AssistantSidebarProps["markers"];
  handleSaveMarkerLabel: NonNullable<
    AssistantSidebarProps["onSaveMarkerLabel"]
  >;
  handleClothingSubmitRequirements: NonNullable<
    NonNullable<
      AssistantSidebarProps["clothingActions"]
    >["onClothingSubmitRequirements"]
  >;
  handleClothingGenerateModel: NonNullable<
    NonNullable<
      AssistantSidebarProps["clothingActions"]
    >["onClothingGenerateModel"]
  >;
  handleClothingPickModel: NonNullable<
    NonNullable<
      AssistantSidebarProps["clothingActions"]
    >["onClothingPickModelCandidate"]
  >;
  insertResultToCanvas: NonNullable<
    NonNullable<
      AssistantSidebarProps["clothingActions"]
    >["onClothingInsertToCanvas"]
  >;
  handleClothingRetryFailed: NonNullable<
    NonNullable<
      AssistantSidebarProps["clothingActions"]
    >["onClothingRetryFailed"]
  >;
  handleEcommerceRefineAnalysis: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceRefineAnalysis"]
  >;
  handleEcommerceConfirmTypes: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceConfirmTypes"]
  >;
  handleEcommerceConfirmImageAnalyses: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceConfirmImageAnalyses"]
  >;
  handleEcommerceRetryImageAnalysis: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceRetryImageAnalysis"]
  >;
  handleEcommerceRewritePlanPrompt: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceRewritePlanPrompt"]
  >;
  handleEcommerceGeneratePlanItem: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceGeneratePlanItem"]
  >;
  handleEcommerceOpenOverlayEditor: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceOpenResultOverlayEditor"]
  >;
  handleEcommerceCloseOverlayEditor: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceCloseResultOverlayEditor"]
  >;
  handleEcommerceSaveResultOverlayDraft: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceSaveResultOverlayDraft"]
  >;
  handleEcommerceApplyResultOverlay: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceApplyResultOverlay"]
  >;
  handleEcommerceUploadResultOverlayFont: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceUploadResultOverlayFont"]
  >;
  handleEcommerceUploadResultOverlayIcon: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceUploadResultOverlayIcon"]
  >;
  handleEcommerceResetResultOverlay: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceResetResultOverlay"]
  >;
  handleEcommerceGenerateExtraPlanItem: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceGenerateExtraPlanItem"]
  >;
  handleEcommercePromoteResult: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommercePromoteResult"]
  >;
  handleEcommercePromoteSelectedResults: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommercePromoteSelectedResults"]
  >;
  handleEcommerceDeleteResult: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceDeleteResult"]
  >;
  handleEcommerceConfirmPlans: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceConfirmPlans"]
  >;
  handleEcommerceConfirmSupplements: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceConfirmSupplements"]
  >;
  handleEcommerceSelectModel: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceSelectModel"]
  >;
  handleEcommerceSyncBatchPlanItemRatio: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceSyncBatchPlanItemRatio"]
  >;
  handleEcommerceSyncBatchPrompt: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceSyncBatchPrompt"]
  >;
  handleEcommerceOpenBatchWorkbench: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceOpenBatchWorkbench"]
  >;
  handleEcommerceRunBatchGenerate: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceRunBatchGenerate"]
  >;
  handleEcommerceRetryFailedBatch: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceRetryFailedBatch"]
  >;
  handleEcommerceInsertToCanvas: NonNullable<
    NonNullable<
      AssistantSidebarProps["ecommerceActions"]
    >["onEcommerceInsertToCanvas"]
  >;
};

export const useWorkspaceSidebarProps = ({
  leftPanelMode,
  setLeftPanelMode,
  elements,
  rootElements,
  elementById,
  selectedElementId,
  selectedElementIds,
  isHistoryExpanded,
  setIsHistoryExpanded,
  handleElementMouseDown,
  setElements,
  setFocusedGroupId,
  messages,
  setPreviewUrl,
  focusedGroupId,
  workflowRecipesPanel,
  id,
  conversations,
  setConversations,
  activeConversationId,
  setActiveConversationId,
  showAssistant,
  setShowAssistant,
  isAssistantFullscreen,
  setIsAssistantFullscreen,
  onToggleAssistantFullscreen,
  onOpenEcommerceWorkflow,
  handleSend,
  handleSmartGenerate,
  addGenImage,
  activeImageModel,
  activeImageProviderId,
  imageGenRatio,
  imageGenRes,
  nodeInteractionMode,
  creationMode,
  setCreationMode,
  setPrompt,
  handleModeSwitch,
  fileInputRef,
  selectedChipId,
  setSelectedChipId,
  hoveredChipId,
  setHoveredChipId,
  showModeSelector,
  setShowModeSelector,
  showRatioPicker,
  setShowRatioPicker,
  showModelPicker,
  setShowModelPicker,
  isInputFocused,
  setIsInputFocused,
  isDragOver,
  setIsDragOver,
  isVideoPanelHovered,
  setIsVideoPanelHovered,
  showVideoSettingsDropdown,
  setShowVideoSettingsDropdown,
  modelPreferences,
  markers,
  handleSaveMarkerLabel,
  handleClothingSubmitRequirements,
  handleClothingGenerateModel,
  handleClothingPickModel,
  insertResultToCanvas,
  handleClothingRetryFailed,
  handleEcommerceRefineAnalysis,
  handleEcommerceConfirmTypes,
  handleEcommerceConfirmImageAnalyses,
  handleEcommerceRetryImageAnalysis,
  handleEcommerceRewritePlanPrompt,
  handleEcommerceGenerateExtraPlanItem,
  handleEcommerceGeneratePlanItem,
  handleEcommerceOpenOverlayEditor,
  handleEcommerceCloseOverlayEditor,
  handleEcommerceSaveResultOverlayDraft,
  handleEcommerceApplyResultOverlay,
  handleEcommerceUploadResultOverlayFont,
  handleEcommerceUploadResultOverlayIcon,
  handleEcommerceResetResultOverlay,
  handleEcommercePromoteResult,
  handleEcommercePromoteSelectedResults,
  handleEcommerceDeleteResult,
  handleEcommerceConfirmPlans,
  handleEcommerceConfirmSupplements,
  handleEcommerceSelectModel,
  handleEcommerceSyncBatchPlanItemRatio,
  handleEcommerceSyncBatchPrompt,
  handleEcommerceOpenBatchWorkbench,
  handleEcommerceRunBatchGenerate,
  handleEcommerceRetryFailedBatch,
  handleEcommerceInsertToCanvas,
}: UseWorkspaceSidebarPropsArgs) => {
  const handleCloseLeftPanel = React.useCallback(
    () => setLeftPanelMode(null),
    [setLeftPanelMode],
  );

  const handleExitFocusedGroup = React.useCallback(
    () => setFocusedGroupId(null),
    [setFocusedGroupId],
  );

  const handleToggleLock = React.useCallback(
    (panelId: string) =>
      setElements((prev) =>
        prev.map((element) =>
          element.id === panelId
            ? { ...element, isLocked: !element.isLocked }
            : element,
        ),
      ),
    [setElements],
  );

  const handleToggleHide = React.useCallback(
    (panelId: string) => {
      const hit = elementById.get(panelId);
      const newHidden = !hit?.isHidden;
      setElements((prev) =>
        prev.map((element) => {
          if (element.id === panelId) {
            return { ...element, isHidden: newHidden };
          }
          if (element.groupId === panelId) {
            return { ...element, isHidden: newHidden };
          }
          return element;
        }),
      );
    },
    [elementById, setElements],
  );

  const handleToggleCollapse = React.useCallback(
    (panelId: string) =>
      setElements((prev) =>
        prev.map((element) =>
          element.id === panelId
            ? { ...element, isCollapsed: !element.isCollapsed }
            : element,
        ),
      ),
    [setElements],
  );

  const workspaceLeftPanelProps = React.useMemo<
    React.ComponentProps<typeof WorkspaceLeftPanel>
  >(
    () => ({
      leftPanelMode,
      onClose: handleCloseLeftPanel,
      elements,
      rootElements,
      elementById,
      selectedElementId,
      selectedElementIds,
      isHistoryExpanded,
      setIsHistoryExpanded,
      onSelect: handleElementMouseDown,
      onToggleLock: handleToggleLock,
      onToggleHide: handleToggleHide,
      onToggleCollapse: handleToggleCollapse,
      onEnterGroup: setFocusedGroupId,
      messages,
      onPreviewImage: setPreviewUrl,
      focusedGroupId,
      onExitFocusedGroup: handleExitFocusedGroup,
      workflowRecipesPanel,
    }),
    [
      elementById,
      elements,
      focusedGroupId,
      handleCloseLeftPanel,
      handleElementMouseDown,
      handleExitFocusedGroup,
      handleToggleCollapse,
      handleToggleHide,
      handleToggleLock,
      isHistoryExpanded,
      leftPanelMode,
      messages,
      rootElements,
      selectedElementId,
      selectedElementIds,
      setFocusedGroupId,
      setIsHistoryExpanded,
      setPreviewUrl,
      workflowRecipesPanel,
    ],
  );

  const assistantSidebarProps = React.useMemo<
    AssistantSidebarProps
  >(
    () => ({
      session: {
        workspaceId: id || "",
        conversations,
        setConversations,
        activeConversationId,
        setActiveConversationId,
      },
      panelUi: {
        showAssistant,
        setShowAssistant,
        setPreviewUrl,
        isFullscreen: isAssistantFullscreen,
        setIsFullscreen: setIsAssistantFullscreen,
        onToggleFullscreen: onToggleAssistantFullscreen,
        onOpenEcommerceWorkflow,
      },
      messageActions: {
        handleSend,
        handleSmartGenerate,
      },
      browserAgent: {
        selectedElementId,
        selectedElementType:
          (selectedElementId ? elementById.get(selectedElementId) : null)?.type ||
          null,
        selectedTreeNodeKind:
          (selectedElementId ? elementById.get(selectedElementId) : null)
            ?.treeNodeKind || null,
        selectedElementLabel: (() => {
          const selectedElement = selectedElementId
            ? elementById.get(selectedElementId) || null
            : null;
          if (!selectedElement) return null;
          const preview = String(
            selectedElement.genPrompt ||
              selectedElement.text ||
              selectedElement.type ||
              "",
          )
            .replace(/\s+/g, " ")
            .trim();
          const shortLabel = preview ? preview.slice(0, 48) : selectedElement.type;
          return selectedElement.treeNodeKind
            ? `${selectedElement.treeNodeKind} 路 ${shortLabel}`
            : shortLabel;
        })(),
        resolveElementAsset: (elementId: string) => {
          const element = elementById.get(elementId) || null;
          if (!element) {
            return {
              previewUrl: null,
              label: null,
            };
          }
          const previewUrl = String(
            element.originalUrl || element.proxyUrl || element.url || "",
          ).trim();
          const labelSource = String(
            element.genPrompt || element.text || element.type || "",
          )
            .replace(/\s+/g, " ")
            .trim();
          return {
            previewUrl: previewUrl || null,
            label: labelSource ? labelSource.slice(0, 48) : element.type,
          };
        },
        createTargetElement: ({ prompt, referenceImages }) =>
          addGenImage({
            genPrompt: prompt || "",
            genModel: activeImageModel,
            genProviderId: activeImageProviderId,
            genAspectRatio: imageGenRatio,
            genResolution: imageGenRes,
            genRefImages: referenceImages || [],
            genRefPreviewImages: referenceImages || [],
            nodeInteractionMode,
            disableAutoParentLink: true,
          }),
      },
      composer: {
        creationMode,
        setCreationMode,
        setPrompt,
        handleModeSwitch,
        fileInputRef,
      },
      inputUi: {
        selectedChipId,
        setSelectedChipId,
        hoveredChipId,
        setHoveredChipId,
        showModeSelector,
        setShowModeSelector,
        showRatioPicker,
        setShowRatioPicker,
        showModelPicker,
        setShowModelPicker,
        isInputFocused,
        setIsInputFocused,
        isDragOver,
        setIsDragOver,
        isVideoPanelHovered,
        setIsVideoPanelHovered,
        showVideoSettingsDropdown,
        setShowVideoSettingsDropdown,
      },
      modelPreferences,
      markers,
      onSaveMarkerLabel: handleSaveMarkerLabel,
      clothingActions: {
        onClothingSubmitRequirements: handleClothingSubmitRequirements,
        onClothingGenerateModel: handleClothingGenerateModel,
        onClothingPickModelCandidate: handleClothingPickModel,
        onClothingInsertToCanvas: insertResultToCanvas,
        onClothingRetryFailed: handleClothingRetryFailed,
      },
      ecommerceActions: {
        onEcommerceRefineAnalysis: handleEcommerceRefineAnalysis,
        onEcommerceConfirmTypes: handleEcommerceConfirmTypes,
        onEcommerceConfirmImageAnalyses: handleEcommerceConfirmImageAnalyses,
        onEcommerceRetryImageAnalysis: handleEcommerceRetryImageAnalysis,
        onEcommerceRewritePlanPrompt: handleEcommerceRewritePlanPrompt,
        onEcommerceGenerateExtraPlanItem: handleEcommerceGenerateExtraPlanItem,
        onEcommerceGeneratePlanItem: handleEcommerceGeneratePlanItem,
        onEcommerceOpenResultOverlayEditor: handleEcommerceOpenOverlayEditor,
        onEcommerceCloseResultOverlayEditor: handleEcommerceCloseOverlayEditor,
        onEcommerceSaveResultOverlayDraft: handleEcommerceSaveResultOverlayDraft,
        onEcommerceApplyResultOverlay: handleEcommerceApplyResultOverlay,
        onEcommerceUploadResultOverlayFont: handleEcommerceUploadResultOverlayFont,
        onEcommerceUploadResultOverlayIcon: handleEcommerceUploadResultOverlayIcon,
        onEcommerceResetResultOverlay: handleEcommerceResetResultOverlay,
        onEcommercePromoteResult: handleEcommercePromoteResult,
        onEcommercePromoteSelectedResults: handleEcommercePromoteSelectedResults,
        onEcommerceDeleteResult: handleEcommerceDeleteResult,
        onEcommerceConfirmPlans: handleEcommerceConfirmPlans,
        onEcommerceConfirmSupplements: handleEcommerceConfirmSupplements,
        onEcommerceSelectModel: handleEcommerceSelectModel,
        onEcommerceSyncBatchPlanItemRatio: handleEcommerceSyncBatchPlanItemRatio,
        onEcommerceSyncBatchPrompt: handleEcommerceSyncBatchPrompt,
        onEcommerceOpenBatchWorkbench: handleEcommerceOpenBatchWorkbench,
        onEcommerceRunBatchGenerate: handleEcommerceRunBatchGenerate,
        onEcommerceRetryFailedBatch: handleEcommerceRetryFailedBatch,
        onEcommerceInsertToCanvas: handleEcommerceInsertToCanvas,
      },
    }),
    [
      activeConversationId,
      conversations,
      creationMode,
      fileInputRef,
      handleClothingGenerateModel,
      handleClothingPickModel,
      handleClothingRetryFailed,
      handleClothingSubmitRequirements,
      handleEcommerceApplyResultOverlay,
      handleEcommerceCloseOverlayEditor,
      handleEcommerceConfirmImageAnalyses,
      handleEcommerceConfirmPlans,
      handleEcommerceConfirmSupplements,
      handleEcommerceConfirmTypes,
      handleEcommerceDeleteResult,
      handleEcommerceGenerateExtraPlanItem,
      handleEcommerceGeneratePlanItem,
      handleEcommerceInsertToCanvas,
      handleEcommerceOpenBatchWorkbench,
      handleEcommerceOpenOverlayEditor,
      handleEcommercePromoteResult,
      handleEcommercePromoteSelectedResults,
      handleEcommerceRefineAnalysis,
      handleEcommerceResetResultOverlay,
      handleEcommerceRetryFailedBatch,
      handleEcommerceRetryImageAnalysis,
      handleEcommerceRewritePlanPrompt,
      handleEcommerceRunBatchGenerate,
      handleEcommerceSaveResultOverlayDraft,
      handleEcommerceSelectModel,
      handleEcommerceSyncBatchPlanItemRatio,
      handleEcommerceSyncBatchPrompt,
      handleEcommerceUploadResultOverlayFont,
      handleEcommerceUploadResultOverlayIcon,
      handleModeSwitch,
      handleSaveMarkerLabel,
      handleSend,
      handleSmartGenerate,
      hoveredChipId,
      id,
      elementById,
      insertResultToCanvas,
      isDragOver,
      isInputFocused,
      isVideoPanelHovered,
      markers,
      modelPreferences,
      onOpenEcommerceWorkflow,
      onToggleAssistantFullscreen,
      isAssistantFullscreen,
      selectedChipId,
      setActiveConversationId,
      setConversations,
      setCreationMode,
      setHoveredChipId,
      setIsDragOver,
      setIsInputFocused,
      setIsVideoPanelHovered,
      setPreviewUrl,
      setPrompt,
      setSelectedChipId,
      setShowAssistant,
      setIsAssistantFullscreen,
      setShowModeSelector,
      setShowModelPicker,
      setShowRatioPicker,
      setShowVideoSettingsDropdown,
      showAssistant,
      showModeSelector,
      showModelPicker,
      showRatioPicker,
      showVideoSettingsDropdown,
      selectedElementId,
    ],
  );

  return {
    workspaceLeftPanelProps,
    assistantSidebarProps,
  };
};

