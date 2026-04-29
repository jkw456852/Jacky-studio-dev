import React from "react";
import { AssistantSidebar } from "../components";
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
  id: string | undefined;
  conversations: React.ComponentProps<
    typeof AssistantSidebar
  >["session"]["conversations"];
  setConversations: React.ComponentProps<
    typeof AssistantSidebar
  >["session"]["setConversations"];
  activeConversationId: React.ComponentProps<
    typeof AssistantSidebar
  >["session"]["activeConversationId"];
  setActiveConversationId: React.ComponentProps<
    typeof AssistantSidebar
  >["session"]["setActiveConversationId"];
  showAssistant: boolean;
  setShowAssistant: React.ComponentProps<
    typeof AssistantSidebar
  >["panelUi"]["setShowAssistant"];
  onOpenEcommerceWorkflow: React.ComponentProps<
    typeof AssistantSidebar
  >["panelUi"]["onOpenEcommerceWorkflow"];
  handleSend: React.ComponentProps<
    typeof AssistantSidebar
  >["messageActions"]["handleSend"];
  handleSmartGenerate: React.ComponentProps<
    typeof AssistantSidebar
  >["messageActions"]["handleSmartGenerate"];
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
  creationMode: React.ComponentProps<
    typeof AssistantSidebar
  >["composer"]["creationMode"];
  setCreationMode: React.ComponentProps<
    typeof AssistantSidebar
  >["composer"]["setCreationMode"];
  setPrompt: React.ComponentProps<
    typeof AssistantSidebar
  >["composer"]["setPrompt"];
  handleModeSwitch: React.ComponentProps<
    typeof AssistantSidebar
  >["composer"]["handleModeSwitch"];
  fileInputRef: React.ComponentProps<
    typeof AssistantSidebar
  >["composer"]["fileInputRef"];
  selectedChipId: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["selectedChipId"];
  setSelectedChipId: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["setSelectedChipId"];
  hoveredChipId: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["hoveredChipId"];
  setHoveredChipId: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["setHoveredChipId"];
  showModeSelector: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["showModeSelector"];
  setShowModeSelector: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["setShowModeSelector"];
  showRatioPicker: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["showRatioPicker"];
  setShowRatioPicker: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["setShowRatioPicker"];
  showModelPicker: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["showModelPicker"];
  setShowModelPicker: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["setShowModelPicker"];
  isInputFocused: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["isInputFocused"];
  setIsInputFocused: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["setIsInputFocused"];
  isDragOver: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["isDragOver"];
  setIsDragOver: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["setIsDragOver"];
  isVideoPanelHovered: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["isVideoPanelHovered"];
  setIsVideoPanelHovered: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["setIsVideoPanelHovered"];
  showVideoSettingsDropdown: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["showVideoSettingsDropdown"];
  setShowVideoSettingsDropdown: React.ComponentProps<
    typeof AssistantSidebar
  >["inputUi"]["setShowVideoSettingsDropdown"];
  modelPreferences: React.ComponentProps<
    typeof AssistantSidebar
  >["modelPreferences"];
  markers: React.ComponentProps<typeof AssistantSidebar>["markers"];
  handleSaveMarkerLabel: NonNullable<
    React.ComponentProps<typeof AssistantSidebar>["onSaveMarkerLabel"]
  >;
  handleClothingSubmitRequirements: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["clothingActions"]
    >["onClothingSubmitRequirements"]
  >;
  handleClothingGenerateModel: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["clothingActions"]
    >["onClothingGenerateModel"]
  >;
  handleClothingPickModel: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["clothingActions"]
    >["onClothingPickModelCandidate"]
  >;
  insertResultToCanvas: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["clothingActions"]
    >["onClothingInsertToCanvas"]
  >;
  handleClothingRetryFailed: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["clothingActions"]
    >["onClothingRetryFailed"]
  >;
  handleEcommerceRefineAnalysis: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceRefineAnalysis"]
  >;
  handleEcommerceConfirmTypes: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceConfirmTypes"]
  >;
  handleEcommerceConfirmImageAnalyses: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceConfirmImageAnalyses"]
  >;
  handleEcommerceRetryImageAnalysis: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceRetryImageAnalysis"]
  >;
  handleEcommerceRewritePlanPrompt: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceRewritePlanPrompt"]
  >;
  handleEcommerceGeneratePlanItem: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceGeneratePlanItem"]
  >;
  handleEcommerceOpenOverlayEditor: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceOpenResultOverlayEditor"]
  >;
  handleEcommerceCloseOverlayEditor: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceCloseResultOverlayEditor"]
  >;
  handleEcommerceSaveResultOverlayDraft: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceSaveResultOverlayDraft"]
  >;
  handleEcommerceApplyResultOverlay: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceApplyResultOverlay"]
  >;
  handleEcommerceUploadResultOverlayFont: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceUploadResultOverlayFont"]
  >;
  handleEcommerceUploadResultOverlayIcon: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceUploadResultOverlayIcon"]
  >;
  handleEcommerceResetResultOverlay: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceResetResultOverlay"]
  >;
  handleEcommerceGenerateExtraPlanItem: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceGenerateExtraPlanItem"]
  >;
  handleEcommercePromoteResult: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommercePromoteResult"]
  >;
  handleEcommercePromoteSelectedResults: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommercePromoteSelectedResults"]
  >;
  handleEcommerceDeleteResult: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceDeleteResult"]
  >;
  handleEcommerceConfirmPlans: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceConfirmPlans"]
  >;
  handleEcommerceConfirmSupplements: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceConfirmSupplements"]
  >;
  handleEcommerceSelectModel: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceSelectModel"]
  >;
  handleEcommerceSyncBatchPlanItemRatio: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceSyncBatchPlanItemRatio"]
  >;
  handleEcommerceSyncBatchPrompt: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceSyncBatchPrompt"]
  >;
  handleEcommerceOpenBatchWorkbench: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceOpenBatchWorkbench"]
  >;
  handleEcommerceRunBatchGenerate: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceRunBatchGenerate"]
  >;
  handleEcommerceRetryFailedBatch: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
    >["onEcommerceRetryFailedBatch"]
  >;
  handleEcommerceInsertToCanvas: NonNullable<
    NonNullable<
      React.ComponentProps<typeof AssistantSidebar>["ecommerceActions"]
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
  id,
  conversations,
  setConversations,
  activeConversationId,
  setActiveConversationId,
  showAssistant,
  setShowAssistant,
  onOpenEcommerceWorkflow,
  handleSend,
  handleSmartGenerate,
  addGenImage,
  activeImageModel,
  activeImageProviderId,
  imageGenRatio,
  imageGenRes,
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
    ],
  );

  const assistantSidebarProps = React.useMemo<
    React.ComponentProps<typeof AssistantSidebar>
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
            ? `${selectedElement.treeNodeKind} · ${shortLabel}`
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
            nodeInteractionMode: "classic",
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
