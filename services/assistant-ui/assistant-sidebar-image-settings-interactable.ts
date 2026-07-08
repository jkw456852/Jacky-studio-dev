import { z } from "zod";

import type {
  AssistantSidebarImageGenerationUiProps,
  AssistantSidebarRuntimeConfig,
} from "../../pages/Workspace/components/assistantSidebar.types";

export const assistantSidebarImageSettingsStateSchema = z.object({
  modeEnabled: z
    .boolean()
    .describe("Whether sidebar image mode is currently enabled."),
  autoModelSelect: z
    .boolean()
    .describe("Whether the app should automatically choose the image model."),
  modelId: z
    .string()
    .describe("The selected image model id used by createImage."),
  providerId: z
    .string()
    .nullable()
    .describe("The selected image provider id used by createImage."),
  aspectRatio: z
    .string()
    .describe("The preferred image aspect ratio, such as 1:1 or 16:9."),
  resolution: z
    .enum(["1K", "2K", "4K"])
    .describe("The preferred image resolution."),
  count: z
    .number()
    .int()
    .min(1)
    .describe("The preferred number of images to generate."),
});

export type AssistantSidebarImageSettingsState = z.infer<
  typeof assistantSidebarImageSettingsStateSchema
>;

export type AssistantSidebarImageSettingsOperation =
  | { type: "setModeEnabled"; value: boolean }
  | { type: "setAutoModelSelect"; value: boolean }
  | { type: "setPreferredImageModel"; value: string }
  | { type: "setPreferredImageProviderId"; value: string | null }
  | { type: "setImageGenRatio"; value: string }
  | { type: "setImageGenRes"; value: "1K" | "2K" | "4K" }
  | { type: "setImageGenCount"; value: number };

const normalizeString = (value: unknown): string => String(value ?? "").trim();

const normalizeResolution = (value: unknown): "1K" | "2K" | "4K" => {
  const normalized = normalizeString(value).toUpperCase();
  return normalized === "2K" || normalized === "4K" ? normalized : "1K";
};

const normalizeCount = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.floor(numeric));
};

export const normalizeAssistantSidebarImageSettingsState = (
  value: Partial<AssistantSidebarImageSettingsState> | undefined,
): AssistantSidebarImageSettingsState => ({
  modeEnabled: value?.modeEnabled === true,
  autoModelSelect: value?.autoModelSelect !== false,
  modelId: normalizeString(value?.modelId),
  providerId: normalizeString(value?.providerId) || null,
  aspectRatio: normalizeString(value?.aspectRatio) || "1:1",
  resolution: normalizeResolution(value?.resolution),
  count: normalizeCount(value?.count),
});

export const createAssistantSidebarImageSettingsState = (options: {
  runtimeConfig?: AssistantSidebarRuntimeConfig;
  imageGenerationUi?: AssistantSidebarImageGenerationUiProps;
  imageModeEnabled: boolean;
}): AssistantSidebarImageSettingsState =>
  normalizeAssistantSidebarImageSettingsState({
    modeEnabled: options.imageModeEnabled,
    autoModelSelect: options.imageGenerationUi?.autoModelSelect ?? true,
    modelId:
      options.runtimeConfig?.activeImageModel ||
      options.runtimeConfig?.preferredImageModel ||
      "",
    providerId:
      options.runtimeConfig?.activeImageProviderId ||
      options.runtimeConfig?.preferredImageProviderId ||
      null,
    aspectRatio: options.runtimeConfig?.imageGenRatio || "1:1",
    resolution: options.runtimeConfig?.imageGenRes || "1K",
    count: options.runtimeConfig?.imageGenCount || 1,
  });

export const serializeAssistantSidebarImageSettingsState = (
  state: AssistantSidebarImageSettingsState,
) =>
  [
    state.modeEnabled ? "1" : "0",
    state.autoModelSelect ? "1" : "0",
    state.modelId,
    state.providerId || "",
    state.aspectRatio,
    state.resolution,
    String(state.count),
  ].join("|");

export const diffAssistantSidebarImageSettingsOperations = (options: {
  current: AssistantSidebarImageSettingsState;
  next: AssistantSidebarImageSettingsState;
}): AssistantSidebarImageSettingsOperation[] => {
  const operations: AssistantSidebarImageSettingsOperation[] = [];

  if (options.current.modeEnabled !== options.next.modeEnabled) {
    operations.push({
      type: "setModeEnabled",
      value: options.next.modeEnabled,
    });
  }
  if (options.current.autoModelSelect !== options.next.autoModelSelect) {
    operations.push({
      type: "setAutoModelSelect",
      value: options.next.autoModelSelect,
    });
  }
  if (options.current.modelId !== options.next.modelId) {
    operations.push({
      type: "setPreferredImageModel",
      value: options.next.modelId,
    });
  }
  if (options.current.providerId !== options.next.providerId) {
    operations.push({
      type: "setPreferredImageProviderId",
      value: options.next.providerId,
    });
  }
  if (options.current.aspectRatio !== options.next.aspectRatio) {
    operations.push({
      type: "setImageGenRatio",
      value: options.next.aspectRatio,
    });
  }
  if (options.current.resolution !== options.next.resolution) {
    operations.push({
      type: "setImageGenRes",
      value: options.next.resolution,
    });
  }
  if (options.current.count !== options.next.count) {
    operations.push({
      type: "setImageGenCount",
      value: options.next.count,
    });
  }

  return operations;
};
