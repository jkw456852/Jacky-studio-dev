import type { LoadedProviderSettings } from "../provider-settings";
import {
  DEFAULT_RUNTIME_SETTINGS_SNAPSHOT,
  RUNTIME_SETTINGS_VERSION,
} from "./defaults";
import type {
  RuntimeImagePostPathMap,
  RuntimeSettingsSnapshot,
} from "./schema";

const clampInteger = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
};

const sanitizePostPathMap = (
  value: LoadedProviderSettings["imageModelPostPaths"] | undefined,
): RuntimeImagePostPathMap => {
  if (!value || typeof value !== "object") return {};
  return Object.entries(value).reduce<RuntimeImagePostPathMap>(
    (acc, [key, config]) => {
      const withReferences = String(config?.withReferences || "").trim();
      const withoutReferences = String(config?.withoutReferences || "").trim();
      if (!withReferences && !withoutReferences) return acc;
      acc[key] = {
        withReferences,
        withoutReferences,
      };
      return acc;
    },
    {},
  );
};

export const normalizeRuntimeSettingsSnapshot = (
  settings: Partial<LoadedProviderSettings> | null | undefined,
): RuntimeSettingsSnapshot => {
  const defaults = DEFAULT_RUNTIME_SETTINGS_SNAPSHOT;

  return {
    version: RUNTIME_SETTINGS_VERSION,
    models: {
      script: {
        selected:
          sanitizeStringArray(settings?.selectedScriptModels).length > 0
            ? sanitizeStringArray(settings?.selectedScriptModels)
            : [...defaults.models.script.selected],
      },
      image: {
        selected:
          sanitizeStringArray(settings?.selectedImageModels).length > 0
            ? sanitizeStringArray(settings?.selectedImageModels)
            : [...defaults.models.image.selected],
        postPaths: sanitizePostPathMap(settings?.imageModelPostPaths),
      },
      video: {
        selected:
          sanitizeStringArray(settings?.selectedVideoModels).length > 0
            ? sanitizeStringArray(settings?.selectedVideoModels)
            : [...defaults.models.video.selected],
      },
    },
    visualOrchestrator: {
      model:
        String(settings?.visualOrchestratorModel || "").trim() ||
        defaults.visualOrchestrator.model,
      maxReferenceImages: clampInteger(
        settings?.visualOrchestratorMaxReferenceImages,
        defaults.visualOrchestrator.maxReferenceImages,
        0,
        64,
      ),
      maxInlineImageBytesMb: clampInteger(
        settings?.visualOrchestratorMaxInlineImageBytesMb,
        defaults.visualOrchestrator.maxInlineImageBytesMb,
        1,
        64,
      ),
      continuityEnabled:
        typeof settings?.visualContinuity === "boolean"
          ? settings.visualContinuity
          : defaults.visualOrchestrator.continuityEnabled,
    },
    workspace: {
      autoSave:
        typeof settings?.autoSave === "boolean"
          ? settings.autoSave
          : defaults.workspace.autoSave,
      concurrentCount: clampInteger(
        settings?.concurrentCount,
        defaults.workspace.concurrentCount,
        1,
        16,
      ),
      systemModeration:
        typeof settings?.systemModeration === "boolean"
          ? settings.systemModeration
          : defaults.workspace.systemModeration,
    },
    agent: {
      browserRuntimeEnabled: true,
      model:
        String(settings?.browserAgentModel || "").trim() ||
        defaults.agent.model,
      toolAuthoringEnabled: false,
      allowConsoleRead: true,
      allowWorkflowAuthoring: false,
    },
  };
};
