import { useEffect, useState } from "react";
import type { ImageModel, VideoModel } from "../../../types";
import {
  getMappedModelIds,
  getMappedPrimaryModelConfig,
  parseMappedModelStorageEntry,
} from "../../../services/provider-settings";
import { safeLocalStorageSetItem } from "../../../utils/safe-storage";
import { getStudioUserAssetApi } from "../../../services/runtime-assets/api";

type WorkspaceModelMode = "thinking" | "fast";
type WorkspaceModelPreferenceTab = "image" | "video" | "3d";

type UseWorkspaceModelPreferencesArgs = {
  modelMode: WorkspaceModelMode;
  clearMessages: () => void;
  setModelMode: (mode: WorkspaceModelMode) => void;
};

const DEFAULT_AUTO_IMAGE_MODEL: ImageModel = "Nano Banana Pro";
const DEFAULT_VIDEO_MODEL: VideoModel = "veo-3.1-fast-generate-preview";
const LOCAL_STORAGE_KEYS = {
  autoModelSelect: "workspace_auto_model_select",
  preferredImageModel: "workspace_preferred_image_model",
  preferredImageProviderId: "workspace_preferred_image_provider_id",
  preferredVideoModel: "workspace_preferred_video_model",
  preferredVideoProviderId: "workspace_preferred_video_provider_id",
  preferred3DModel: "workspace_preferred_3d_model",
} as const;

const getWorkspacePreferencesAsset = () =>
  getStudioUserAssetApi().getWorkspacePreferences();

const STORAGE_ID_TO_PREFERRED_IMAGE_MODEL: Record<string, ImageModel> = {
  "gemini-3-pro-image-preview": "Nano Banana Pro",
  "Nano Banana Pro": "Nano Banana Pro",
  "gemini-3.1-flash-image-preview": "NanoBanana2",
  NanoBanana2: "NanoBanana2",
  "doubao-seedream-5-0-260128": "Seedream5.0",
  "Seedream5.0": "Seedream5.0",
  "gpt-image-2": "GPT Image 2",
  "GPT Image 2": "GPT Image 2",
  "gpt-image-1.5-all": "GPT Image 1.5",
  "GPT Image 1.5": "GPT Image 1.5",
  "Flux.2 Max": "Flux.2 Max",
};

const readStoredBoolean = (key: string, fallback: boolean): boolean => {
  const preferences = getWorkspacePreferencesAsset();
  if (key === LOCAL_STORAGE_KEYS.autoModelSelect) {
    return preferences.autoModelSelect;
  }
  return fallback;
};

const readStoredString = (key: string, fallback: string): string => {
  const preferences = getWorkspacePreferencesAsset();
  if (key === LOCAL_STORAGE_KEYS.preferredImageModel) {
    return preferences.preferredImageModel || fallback;
  }
  if (key === LOCAL_STORAGE_KEYS.preferredVideoModel) {
    return preferences.preferredVideoModel || fallback;
  }
  if (key === LOCAL_STORAGE_KEYS.preferred3DModel) {
    return preferences.preferred3DModel || fallback;
  }
  return fallback;
};

const readStoredOptionalString = (key: string): string | null => {
  const preferences = getWorkspacePreferencesAsset();
  if (key === LOCAL_STORAGE_KEYS.preferredImageProviderId) {
    return preferences.preferredImageProviderId || null;
  }
  if (key === LOCAL_STORAGE_KEYS.preferredVideoProviderId) {
    return preferences.preferredVideoProviderId || null;
  }
  return null;
};

const getMappedPrimaryImageRuntimeModel = (): ImageModel => {
  const [firstModel] = getMappedModelIds("image");
  return (firstModel?.trim() as ImageModel) || DEFAULT_AUTO_IMAGE_MODEL;
};

const getMappedPrimaryImageDisplayModel = (): ImageModel => {
  const mappedModel = getMappedPrimaryImageRuntimeModel();
  return STORAGE_ID_TO_PREFERRED_IMAGE_MODEL[mappedModel] || mappedModel;
};

const getMappedPrimaryImageProviderId = (): string | null => {
  return getMappedPrimaryModelConfig("image")?.providerId || null;
};

const getMappedPrimaryVideoModel = (): VideoModel => {
  const [firstModel] = getMappedModelIds("video");
  return (firstModel?.trim() as VideoModel) || DEFAULT_VIDEO_MODEL;
};

const getMappedPrimaryVideoProviderId = (): string | null => {
  return getMappedPrimaryModelConfig("video")?.providerId || null;
};

const parseStoredImagePreference = (
  raw: string,
  fallbackProviderId: string | null,
): { model: ImageModel; providerId: string | null } => {
  const parsed = parseMappedModelStorageEntry("image", raw);
  if (parsed.modelId) {
    return {
      model: normalizePreferredImageModel(parsed.modelId),
      providerId: parsed.providerId || fallbackProviderId,
    };
  }
  return {
    model: normalizePreferredImageModel(raw),
    providerId: fallbackProviderId,
  };
};

const parseStoredVideoPreference = (
  raw: string,
  fallbackProviderId: string | null,
): { model: VideoModel; providerId: string | null } => {
  const parsed = parseMappedModelStorageEntry("video", raw);
  if (parsed.modelId) {
    return {
      model: normalizePreferredVideoModel(parsed.modelId),
      providerId: parsed.providerId || fallbackProviderId,
    };
  }
  return {
    model: normalizePreferredVideoModel(raw),
    providerId: fallbackProviderId,
  };
};

const normalizePreferredImageModel = (raw: string): ImageModel => {
  const normalized = raw.trim();
  if (!normalized || normalized.toLowerCase() === "auto") {
    return getMappedPrimaryImageDisplayModel();
  }
  return STORAGE_ID_TO_PREFERRED_IMAGE_MODEL[normalized] || (normalized as ImageModel);
};

const normalizePreferredVideoModel = (raw: string): VideoModel => {
  const normalized = raw.trim();
  if (!normalized || normalized.toLowerCase() === "auto") {
    return getMappedPrimaryVideoModel();
  }
  return normalized as VideoModel;
};

export const useWorkspaceModelPreferences = ({
  modelMode,
  clearMessages,
  setModelMode,
}: UseWorkspaceModelPreferencesArgs) => {
  const initialImagePreference = parseStoredImagePreference(
    readStoredString(
      LOCAL_STORAGE_KEYS.preferredImageModel,
      getMappedPrimaryImageDisplayModel(),
    ),
    readStoredOptionalString(LOCAL_STORAGE_KEYS.preferredImageProviderId),
  );
  const initialVideoPreference = parseStoredVideoPreference(
    readStoredString(
      LOCAL_STORAGE_KEYS.preferredVideoModel,
      getMappedPrimaryVideoModel(),
    ),
    readStoredOptionalString(LOCAL_STORAGE_KEYS.preferredVideoProviderId),
  );
  const [showModeSwitchDialog, setShowModeSwitchDialog] = useState(false);
  const [pendingModelMode, setPendingModelMode] =
    useState<WorkspaceModelMode | null>(null);
  const [doNotAskModeSwitch, setDoNotAskModeSwitch] = useState(false);

  const [showModelPreference, setShowModelPreference] = useState(false);
  const [modelPreferenceTab, setModelPreferenceTab] =
    useState<WorkspaceModelPreferenceTab>("image");
  const [autoModelSelect, setAutoModelSelect] = useState(() =>
    readStoredBoolean(LOCAL_STORAGE_KEYS.autoModelSelect, true),
  );
  const [preferredImageModel, setPreferredImageModel] = useState<ImageModel>(
    initialImagePreference.model,
  );
  const [preferredImageProviderId, setPreferredImageProviderId] = useState<
    string | null
  >(initialImagePreference.providerId);
  const [preferredVideoModel, setPreferredVideoModel] = useState<VideoModel>(
    initialVideoPreference.model,
  );
  const [preferredVideoProviderId, setPreferredVideoProviderId] = useState<
    string | null
  >(initialVideoPreference.providerId);
  const [preferred3DModel, setPreferred3DModel] = useState(() =>
    readStoredString(LOCAL_STORAGE_KEYS.preferred3DModel, "Auto"),
  );

  const activeImageModel = autoModelSelect
    ? getMappedPrimaryImageRuntimeModel()
    : preferredImageModel;
  const activeImageProviderId = autoModelSelect
    ? getMappedPrimaryImageProviderId()
    : preferredImageProviderId;
  const activeVideoProviderId = autoModelSelect
    ? getMappedPrimaryVideoProviderId()
    : preferredVideoProviderId;

  useEffect(() => {
    getStudioUserAssetApi().setWorkspacePreferences({
      autoModelSelect,
    });
    safeLocalStorageSetItem(
      LOCAL_STORAGE_KEYS.autoModelSelect,
      autoModelSelect ? "true" : "false",
    );
  }, [autoModelSelect]);

  useEffect(() => {
    getStudioUserAssetApi().setWorkspacePreferences({
      preferredImageModel,
    });
    safeLocalStorageSetItem(
      LOCAL_STORAGE_KEYS.preferredImageModel,
      preferredImageModel,
    );
  }, [preferredImageModel]);

  useEffect(() => {
    getStudioUserAssetApi().setWorkspacePreferences({
      preferredImageProviderId,
    });
    safeLocalStorageSetItem(
      LOCAL_STORAGE_KEYS.preferredImageProviderId,
      preferredImageProviderId || "",
    );
  }, [preferredImageProviderId]);

  useEffect(() => {
    getStudioUserAssetApi().setWorkspacePreferences({
      preferredVideoModel,
    });
    safeLocalStorageSetItem(
      LOCAL_STORAGE_KEYS.preferredVideoModel,
      preferredVideoModel,
    );
  }, [preferredVideoModel]);

  useEffect(() => {
    getStudioUserAssetApi().setWorkspacePreferences({
      preferredVideoProviderId,
    });
    safeLocalStorageSetItem(
      LOCAL_STORAGE_KEYS.preferredVideoProviderId,
      preferredVideoProviderId || "",
    );
  }, [preferredVideoProviderId]);

  useEffect(() => {
    getStudioUserAssetApi().setWorkspacePreferences({
      preferred3DModel,
    });
    safeLocalStorageSetItem(
      LOCAL_STORAGE_KEYS.preferred3DModel,
      preferred3DModel,
    );
  }, [preferred3DModel]);

  const handleModeSwitch = (newMode: WorkspaceModelMode) => {
    if (newMode === modelMode) return;

    if (doNotAskModeSwitch) {
      setModelMode(newMode);
      clearMessages();
      return;
    }

    setPendingModelMode(newMode);
    setShowModeSwitchDialog(true);
  };

  const closeModeSwitchDialog = () => {
    setShowModeSwitchDialog(false);
    setPendingModelMode(null);
  };

  const toggleDoNotAskModeSwitch = () => {
    setDoNotAskModeSwitch((value) => !value);
  };

  const confirmModeSwitch = () => {
    if (pendingModelMode) {
      setModelMode(pendingModelMode);
      clearMessages();
    }

    closeModeSwitchDialog();
  };

  return {
    activeImageModel,
    activeImageProviderId,
    activeVideoProviderId,
    handleModeSwitch,
    modelPreferences: {
      showModelPreference,
      setShowModelPreference,
      modelPreferenceTab,
      setModelPreferenceTab,
      autoModelSelect,
      setAutoModelSelect,
      preferredImageModel,
      setPreferredImageModel,
      preferredImageProviderId,
      setPreferredImageProviderId,
      preferredVideoModel,
      setPreferredVideoModel,
      preferredVideoProviderId,
      setPreferredVideoProviderId,
      preferred3DModel,
      setPreferred3DModel,
    },
    modeSwitchDialog: {
      open: showModeSwitchDialog,
      doNotAsk: doNotAskModeSwitch,
      onClose: closeModeSwitchDialog,
      onToggleDoNotAsk: toggleDoNotAskModeSwitch,
      onConfirm: confirmModeSwitch,
    },
  };
};
