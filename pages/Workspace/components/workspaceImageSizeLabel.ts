import {
  getImageModelSupportState,
  isGptImage2FamilyModel,
  type WorkspaceImageResolutionPreset,
} from "../../../services/openai-image-presets";

export const getImageResolutionDisplayLabel = (opts: {
  resolution: WorkspaceImageResolutionPreset;
  model?: string | null | undefined;
  aspectRatio?: string | null | undefined;
}): string => {
  if (!isGptImage2FamilyModel(opts.model)) {
    return opts.resolution;
  }

  const support = getImageModelSupportState({
    model: opts.model,
    aspectRatio: opts.aspectRatio,
    resolution: opts.resolution,
  });

  return support.actualSize
    ? `${opts.resolution} · ${support.actualSize}`
    : opts.resolution;
};
