import React from "react";

import type { ImageModel } from "../../../types";
import type {
  AssistantSidebarConversation,
  AssistantSidebarProps,
} from "../components/assistantSidebar.types";
import { WorkspaceLeftPanel } from "../components/WorkspaceLeftPanel";

type AssistantModelPreferences = {
  preferredImageModel: string;
  preferredImageProviderId: string | null;
  preferredVideoModel: string;
  preferredVideoProviderId: string | null;
  translatePromptToEnglish: boolean;
  enforceChineseTextInImage: boolean;
  requiredChineseCopy: string;
};

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
  setPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
  focusedGroupId: React.ComponentProps<
    typeof WorkspaceLeftPanel
  >["focusedGroupId"];
  id: string | undefined;
  conversations: AssistantSidebarProps["session"]["conversations"];
  setConversations: AssistantSidebarProps["session"]["setConversations"];
  isProjectHydrated: boolean;
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
  modelMode: "thinking" | "fast";
  webEnabled: boolean;
  researchMode: "off" | "images" | "web+images";
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
  activeVideoModel: string;
  activeVideoProviderId?: string | null;
  imageGenRatio: string;
  imageGenRes: "1K" | "2K" | "4K";
  imageGenCount: number;
  videoGenRatio: string;
  videoGenDuration: string;
  nodeInteractionMode: "classic" | "branch";
  modelPreferences: AssistantModelPreferences;
  imageGenerationUi: AssistantSidebarProps["imageGenerationUi"];
  importUrlAssetToCanvas: NonNullable<
    AssistantSidebarProps["browserAgent"]["importAssetToCanvas"]
  >;
  assistantBootstrapRequest?: AssistantSidebarProps["bootstrapRequest"];
  onAssistantBootstrapRequestConsumed?: AssistantSidebarProps["onBootstrapRequestConsumed"];
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
  setPreviewUrl,
  focusedGroupId,
  id,
  conversations,
  setConversations,
  isProjectHydrated,
  activeConversationId,
  setActiveConversationId,
  showAssistant,
  setShowAssistant,
  isAssistantFullscreen,
  setIsAssistantFullscreen,
  onToggleAssistantFullscreen,
  modelMode,
  webEnabled,
  researchMode,
  addGenImage,
  activeImageModel,
  activeImageProviderId,
  activeVideoModel,
  activeVideoProviderId,
  imageGenRatio,
  imageGenRes,
  imageGenCount,
  videoGenRatio,
  videoGenDuration,
  nodeInteractionMode,
  modelPreferences,
  imageGenerationUi,
  importUrlAssetToCanvas,
  assistantBootstrapRequest,
  onAssistantBootstrapRequestConsumed,
}: UseWorkspaceSidebarPropsArgs) => {
  const activeConversation = React.useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, conversations],
  );
  const activeAssistantThread = activeConversation?.assistantThread;
  const assistantSidebarConversations = React.useMemo<
    AssistantSidebarConversation[]
  >(
    () =>
      conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        assistantThread: conversation.assistantThread,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        autoTitle: conversation.autoTitle,
        pinned: conversation.pinned,
        archivedAt: conversation.archivedAt,
      })),
    [conversations],
  );

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
      assistantThread: activeAssistantThread,
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
      activeAssistantThread,
      isHistoryExpanded,
      leftPanelMode,
      rootElements,
      selectedElementId,
      selectedElementIds,
      setFocusedGroupId,
      setIsHistoryExpanded,
      setPreviewUrl,
    ],
  );

  const assistantSidebarProps = React.useMemo<AssistantSidebarProps>(
    () => ({
      session: {
        workspaceId: id || "",
        isHydrated: isProjectHydrated,
        conversations: assistantSidebarConversations,
        setConversations,
        activeConversationId,
        setActiveConversationId,
      },
      panelUi: {
        showAssistant,
        setShowAssistant,
        isFullscreen: isAssistantFullscreen,
        setIsFullscreen: setIsAssistantFullscreen,
        onToggleFullscreen: onToggleAssistantFullscreen,
      },
      messageActions: {
        runtimeConfig: {
          modelMode,
          webEnabled,
          researchMode,
          imageGenRatio,
          imageGenRes,
          imageGenCount,
          videoGenRatio,
          videoGenDuration,
          preferredVideoModel: modelPreferences.preferredVideoModel,
          preferredVideoProviderId: modelPreferences.preferredVideoProviderId,
          activeVideoModel,
          activeVideoProviderId,
          preferredImageModel: modelPreferences.preferredImageModel,
          preferredImageProviderId: modelPreferences.preferredImageProviderId,
          activeImageModel,
          activeImageProviderId,
          translatePromptToEnglish: modelPreferences.translatePromptToEnglish,
          enforceChineseTextInImage: modelPreferences.enforceChineseTextInImage,
          requiredChineseCopy: modelPreferences.requiredChineseCopy,
        },
      },
      bootstrapRequest: assistantBootstrapRequest,
      onBootstrapRequestConsumed: onAssistantBootstrapRequestConsumed,
      imageGenerationUi,
      browserAgent: {
        selectedElementId,
        selectedElementCount: Array.isArray(selectedElementIds)
          ? selectedElementIds.length
          : selectedElementId
            ? 1
            : 0,
        canvasElementCount: elements.length,
        rootElementCount: rootElements.length,
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
          if (selectedElement.treeNodeKind) {
            return `${selectedElement.treeNodeKind} - ${shortLabel}`;
          }
          return selectedElement.treeNodeKind
            ? `${selectedElement.treeNodeKind} è·?${shortLabel}`
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
        importAssetToCanvas: importUrlAssetToCanvas,
      },
    }),
    [
      activeConversationId,
      activeImageModel,
      activeImageProviderId,
      activeVideoModel,
      activeVideoProviderId,
      addGenImage,
      assistantSidebarConversations,
      conversations,
      elementById,
      elements,
      id,
      imageGenCount,
      imageGenRatio,
      imageGenRes,
      importUrlAssetToCanvas,
      isAssistantFullscreen,
      assistantBootstrapRequest,
      modelMode,
      modelPreferences,
      nodeInteractionMode,
      onAssistantBootstrapRequestConsumed,
      onToggleAssistantFullscreen,
      researchMode,
      rootElements,
      selectedElementId,
      selectedElementIds,
      setActiveConversationId,
      setConversations,
      setIsAssistantFullscreen,
      setShowAssistant,
      showAssistant,
      videoGenDuration,
      videoGenRatio,
      webEnabled,
      imageGenerationUi,
      isProjectHydrated,
    ],
  );

  return {
    workspaceLeftPanelProps,
    assistantSidebarProps,
  };
};

