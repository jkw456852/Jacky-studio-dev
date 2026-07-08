import type { Dispatch, SetStateAction } from "react";

import type { ConversationSession } from "../../../types/index.ts";

export type AssistantSidebarRuntimeConfig = {
  modelMode: "thinking" | "fast";
  webEnabled: boolean;
  researchMode: "off" | "images" | "web+images";
  imageGenRatio: string;
  imageGenRes: "1K" | "2K" | "4K";
  imageGenCount: number;
  videoGenRatio: string;
  videoGenDuration?: string;
  preferredImageModel: string;
  preferredImageProviderId: string | null;
  activeImageModel?: string;
  activeImageProviderId?: string | null;
  preferredVideoModel: string;
  preferredVideoProviderId: string | null;
  activeVideoModel?: string;
  activeVideoProviderId?: string | null;
  translatePromptToEnglish: boolean;
  enforceChineseTextInImage: boolean;
  requiredChineseCopy: string;
};

export type AssistantSidebarImageGenerationUiProps = {
  autoModelSelect: boolean;
  setAutoModelSelect: (value: boolean) => void;
  setImageGenRatio: (value: string) => void;
  setImageGenRes: (value: "1K" | "2K" | "4K") => void;
  setImageGenCount: (value: number) => void;
  setPreferredImageModel: (value: string) => void;
  setPreferredImageProviderId: (value: string | null) => void;
};

export type AssistantSidebarConversation = Pick<
  ConversationSession,
  | "id"
  | "title"
  | "assistantThread"
  | "createdAt"
  | "updatedAt"
  | "autoTitle"
  | "pinned"
  | "archivedAt"
>;

export type AssistantSidebarSessionProps = {
  workspaceId: string;
  isHydrated?: boolean;
  conversations: AssistantSidebarConversation[];
  setConversations: Dispatch<SetStateAction<ConversationSession[]>>;
  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
};

export type AssistantSidebarBootstrapRequest = {
  id: number;
  prompt?: string;
  attachments?: File[];
};

export type AssistantSidebarPanelUiProps = {
  showAssistant: boolean;
  setShowAssistant: (show: boolean) => void;
  isFullscreen?: boolean;
  setIsFullscreen?: (value: boolean) => void;
  onToggleFullscreen?: () => void;
};

export type AssistantSidebarMessageActionsProps = {
  runtimeConfig?: AssistantSidebarRuntimeConfig;
};

export type AssistantSidebarBrowserAgentProps = {
  selectedElementId: string | null;
  selectedElementLabel: string | null;
  selectedElementType?: string | null;
  selectedTreeNodeKind?: string | null;
  selectedElementCount?: number;
  canvasElementCount?: number;
  rootElementCount?: number;
  resolveElementAsset?: (elementId: string) => {
    previewUrl: string | null;
    label: string | null;
  } | null;
  createTargetElement?: (input: {
    prompt?: string;
    referenceImages?: string[];
  }) => string | null;
  importAssetToCanvas?: (input: {
    url: string;
    type: "image" | "video" | "file";
    title?: string;
    mediaType?: string;
  }) => Promise<string | null> | string | null;
};

export interface AssistantSidebarProps {
  session: AssistantSidebarSessionProps;
  panelUi: AssistantSidebarPanelUiProps;
  messageActions: AssistantSidebarMessageActionsProps;
  bootstrapRequest?: AssistantSidebarBootstrapRequest | null;
  onBootstrapRequestConsumed?: (id: number) => void;
  imageGenerationUi?: AssistantSidebarImageGenerationUiProps;
  browserAgent: AssistantSidebarBrowserAgentProps;
}
