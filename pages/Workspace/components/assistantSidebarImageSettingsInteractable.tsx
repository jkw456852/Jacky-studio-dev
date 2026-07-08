"use client";

import React from "react";
import { unstable_useInteractable } from "@assistant-ui/react";

import {
  type AssistantSidebarImageSettingsState,
  assistantSidebarImageSettingsStateSchema,
  createAssistantSidebarImageSettingsState,
  diffAssistantSidebarImageSettingsOperations,
  normalizeAssistantSidebarImageSettingsState,
  serializeAssistantSidebarImageSettingsState,
} from "../../../services/assistant-ui/assistant-sidebar-image-settings-interactable.ts";
import type {
  AssistantSidebarImageGenerationUiProps,
  AssistantSidebarRuntimeConfig,
} from "./assistantSidebar.types";

const ASSISTANT_SIDEBAR_IMAGE_SETTINGS_INTERACTABLE_ID =
  "assistant-sidebar-image-settings";

type UseAssistantSidebarImageSettingsArgs = {
  runtimeConfig?: AssistantSidebarRuntimeConfig;
  imageGenerationUi?: AssistantSidebarImageGenerationUiProps;
  imageModeEnabled?: boolean;
  onImageModeEnabledChange?: (value: boolean) => void;
};

export const useAssistantSidebarImageSettings = ({
  runtimeConfig,
  imageGenerationUi,
  imageModeEnabled = false,
  onImageModeEnabledChange,
}: UseAssistantSidebarImageSettingsArgs) => {
  const initialState = React.useMemo(
    () =>
      createAssistantSidebarImageSettingsState({
        runtimeConfig,
        imageGenerationUi,
        imageModeEnabled,
      }),
    [
      imageGenerationUi?.autoModelSelect,
      imageModeEnabled,
      runtimeConfig?.activeImageModel,
      runtimeConfig?.activeImageProviderId,
      runtimeConfig?.preferredImageModel,
      runtimeConfig?.preferredImageProviderId,
      runtimeConfig?.imageGenRatio,
      runtimeConfig?.imageGenRes,
      runtimeConfig?.imageGenCount,
    ],
  );

  const [state, { setState }] = unstable_useInteractable(
    "imageGenerationSettings",
    {
      id: ASSISTANT_SIDEBAR_IMAGE_SETTINGS_INTERACTABLE_ID,
      description:
        "The current sidebar image-generation settings for createImage. Read this before image generation. " +
        "Use update_imageGenerationSettings only when the user explicitly wants to change persistent image mode " +
        "or image settings like model, provider, aspect ratio, resolution, or count. Do not change it for one-off prompt wording.",
      stateSchema: assistantSidebarImageSettingsStateSchema,
      initialState,
    },
  );

  const normalizedState = React.useMemo(
    () => normalizeAssistantSidebarImageSettingsState(state),
    [state],
  );
  const runtimeState = React.useMemo(
    () =>
      createAssistantSidebarImageSettingsState({
        runtimeConfig,
        imageGenerationUi,
        imageModeEnabled,
      }),
    [
      imageGenerationUi?.autoModelSelect,
      imageModeEnabled,
      runtimeConfig?.activeImageModel,
      runtimeConfig?.activeImageProviderId,
      runtimeConfig?.preferredImageModel,
      runtimeConfig?.preferredImageProviderId,
      runtimeConfig?.imageGenRatio,
      runtimeConfig?.imageGenRes,
      runtimeConfig?.imageGenCount,
    ],
  );
  const runtimeSerialized = React.useMemo(
    () => serializeAssistantSidebarImageSettingsState(runtimeState),
    [runtimeState],
  );
  const interactableSerialized = React.useMemo(
    () => serializeAssistantSidebarImageSettingsState(normalizedState),
    [normalizedState],
  );
  const pendingRuntimeTargetRef = React.useRef<string | null>(null);
  const previousRuntimeSerializedRef = React.useRef(runtimeSerialized);
  const previousInteractableSerializedRef = React.useRef(
    interactableSerialized,
  );
  const runtimeChanged =
    previousRuntimeSerializedRef.current !== runtimeSerialized;
  const interactableChanged =
    previousInteractableSerializedRef.current !== interactableSerialized;

  React.useEffect(() => {
    if (interactableSerialized === runtimeSerialized) {
      if (pendingRuntimeTargetRef.current === runtimeSerialized) {
        pendingRuntimeTargetRef.current = null;
      }
      return;
    }

    // Prefer the local sidebar controls when the runtime just changed and the
    // interactable has not; otherwise the stale interactable snapshot can
    // immediately revert a user click (e.g. opening image mode).
    if (runtimeChanged && !interactableChanged) {
      return;
    }

    if (pendingRuntimeTargetRef.current === interactableSerialized) {
      return;
    }

    const operations = diffAssistantSidebarImageSettingsOperations({
      current: runtimeState,
      next: normalizedState,
    });
    if (operations.length === 0) {
      return;
    }

    pendingRuntimeTargetRef.current = interactableSerialized;

    for (const operation of operations) {
      switch (operation.type) {
        case "setModeEnabled":
          onImageModeEnabledChange?.(operation.value);
          break;
        case "setAutoModelSelect":
          imageGenerationUi?.setAutoModelSelect(operation.value);
          break;
        case "setPreferredImageModel":
          imageGenerationUi?.setPreferredImageModel(operation.value);
          break;
        case "setPreferredImageProviderId":
          imageGenerationUi?.setPreferredImageProviderId(operation.value);
          break;
        case "setImageGenRatio":
          imageGenerationUi?.setImageGenRatio(operation.value);
          break;
        case "setImageGenRes":
          imageGenerationUi?.setImageGenRes(operation.value);
          break;
        case "setImageGenCount":
          imageGenerationUi?.setImageGenCount(operation.value);
          break;
      }
    }
  }, [
    imageGenerationUi,
    interactableChanged,
    interactableSerialized,
    normalizedState,
    onImageModeEnabledChange,
    runtimeChanged,
    runtimeSerialized,
    runtimeState,
  ]);

  React.useEffect(() => {
    if (interactableSerialized === runtimeSerialized) {
      if (pendingRuntimeTargetRef.current === runtimeSerialized) {
        pendingRuntimeTargetRef.current = null;
      }
      return;
    }

    if (
      pendingRuntimeTargetRef.current &&
      pendingRuntimeTargetRef.current !== runtimeSerialized
    ) {
      return;
    }

    // When the interactable just changed independently, let the
    // interactable-to-runtime effect apply it first.
    if (!runtimeChanged && interactableChanged) {
      return;
    }

    setState(runtimeState);
  }, [
    interactableChanged,
    interactableSerialized,
    runtimeChanged,
    runtimeSerialized,
    runtimeState,
    setState,
  ]);

  React.useEffect(() => {
    previousRuntimeSerializedRef.current = runtimeSerialized;
    previousInteractableSerializedRef.current = interactableSerialized;
  }, [interactableSerialized, runtimeSerialized]);

  const setModeEnabled = React.useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, modeEnabled: value }));
  }, [setState]);

  const setAutoModelSelect = React.useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, autoModelSelect: value }));
  }, [setState]);

  const setPreferredImageModel = React.useCallback((value: string) => {
    setState((prev) => ({ ...prev, modelId: value }));
  }, [setState]);

  const setPreferredImageProviderId = React.useCallback((value: string | null) => {
    setState((prev) => ({ ...prev, providerId: value }));
  }, [setState]);

  const setImageGenRatio = React.useCallback((value: string) => {
    setState((prev) => ({ ...prev, aspectRatio: value }));
  }, [setState]);

  const setImageGenRes = React.useCallback((value: "1K" | "2K" | "4K") => {
    setState((prev) => ({ ...prev, resolution: value }));
  }, [setState]);

  const setImageGenCount = React.useCallback((value: number) => {
    setState((prev) => ({ ...prev, count: value }));
  }, [setState]);

  return {
    state: normalizedState,
    setModeEnabled,
    setAutoModelSelect,
    setPreferredImageModel,
    setPreferredImageProviderId,
    setImageGenRatio,
    setImageGenRes,
    setImageGenCount,
  } satisfies {
    state: AssistantSidebarImageSettingsState;
    setModeEnabled: (value: boolean) => void;
    setAutoModelSelect: (value: boolean) => void;
    setPreferredImageModel: (value: string) => void;
    setPreferredImageProviderId: (value: string | null) => void;
    setImageGenRatio: (value: string) => void;
    setImageGenRes: (value: "1K" | "2K" | "4K") => void;
    setImageGenCount: (value: number) => void;
  };
};

type AssistantSidebarImageSettingsInteractableProps =
  UseAssistantSidebarImageSettingsArgs;

export const AssistantSidebarImageSettingsInteractable: React.FC<
  AssistantSidebarImageSettingsInteractableProps
> = (props) => {
  useAssistantSidebarImageSettings(props);
  return null;
};
