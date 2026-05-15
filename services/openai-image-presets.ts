export const WORKSPACE_IMAGE_RESOLUTION_PRESETS = ["1K", "2K", "4K"] as const;

export type WorkspaceImageResolutionPreset =
  (typeof WORKSPACE_IMAGE_RESOLUTION_PRESETS)[number];

export type WorkspaceImageSupportStatus = "normal" | "warning" | "disabled";

export const WORKSPACE_IMAGE_ASPECT_RATIO_VALUES = [
  "8:1",
  "4:1",
  "21:9",
  "16:9",
  "3:2",
  "4:3",
  "5:4",
  "1:1",
  "4:5",
  "3:4",
  "2:3",
  "9:16",
  "1:4",
  "1:8",
] as const;

const GPT_IMAGE_2_FAMILY_MODEL_KEYS = new Set(["gptimage2", "gptimage2all"]);
const GPT_IMAGE_2_ALL_MODEL_KEYS = new Set(["gptimage2all"]);

const GPT_IMAGE_2_OFFICIAL_SIZE_MAP: Record<
  WorkspaceImageResolutionPreset,
  Record<string, string>
> = {
  "1K": {
    "21:9": "1568x672",
    "16:9": "1536x864",
    "3:2": "1536x1024",
    "4:3": "1024x768",
    "5:4": "1280x1024",
    "1:1": "1024x1024",
    "4:5": "1024x1280",
    "3:4": "768x1024",
    "2:3": "1024x1536",
    "9:16": "864x1536",
  },
  "2K": {
    "21:9": "2016x864",
    "16:9": "2048x1152",
    "3:2": "1728x1152",
    "4:3": "1664x1248",
    "5:4": "1600x1280",
    "1:1": "1440x1440",
    "4:5": "1280x1600",
    "3:4": "1248x1664",
    "2:3": "1152x1728",
    "9:16": "1152x2048",
  },
  "4K": {
    "21:9": "3808x1632",
    "16:9": "3840x2160",
    "3:2": "3456x2304",
    "4:3": "3264x2448",
    "5:4": "3200x2560",
    "1:1": "2880x2880",
    "4:5": "2560x3200",
    "3:4": "2448x3264",
    "2:3": "2304x3456",
    "9:16": "2160x3840",
  },
};

const LEGACY_PREVIEW_SIZE_MAP: Record<
  WorkspaceImageResolutionPreset,
  Record<string, string>
> = {
  "1K": {
    "8:1": "1024x128",
    "4:1": "1024x256",
    "1:4": "256x1024",
    "1:8": "128x1024",
  },
  "2K": {
    "8:1": "2048x256",
    "4:1": "2048x512",
    "1:4": "512x2048",
    "1:8": "256x2048",
  },
  "4K": {
    "8:1": "3840x480",
    "4:1": "3840x960",
    "1:4": "960x3840",
    "1:8": "480x3840",
  },
};

const YUNWU_GPT_IMAGE_2_ALL_NATIVE_SIZES = new Set([
  "1024x1024",
  "1536x1024",
  "1024x1536",
]);

const YUNWU_GPT_IMAGE_2_NATIVE_SIZES = new Set([
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "2048x2048",
  "2048x1152",
  "3840x2160",
  "2160x3840",
]);

const OFFICIAL_GPT_IMAGE_2_ASPECT_RATIOS = Object.keys(
  GPT_IMAGE_2_OFFICIAL_SIZE_MAP["1K"],
);

const normalizeModelKey = (model: string | null | undefined): string =>
  String(model || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const parseAspectRatioValue = (
  aspectRatio: string | null | undefined,
): number | null => {
  const raw = String(aspectRatio || "").trim();
  if (!raw.includes(":")) return null;

  const [widthText, heightText] = raw.split(":");
  const width = Number(widthText);
  const height = Number(heightText);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return width / height;
};

export const isGptImage2FamilyModel = (
  model: string | null | undefined,
): boolean => GPT_IMAGE_2_FAMILY_MODEL_KEYS.has(normalizeModelKey(model));

export const isGptImage2AllModel = (
  model: string | null | undefined,
): boolean => GPT_IMAGE_2_ALL_MODEL_KEYS.has(normalizeModelKey(model));

export const isOfficialGptImage2AspectRatio = (
  aspectRatio: string | null | undefined,
): boolean =>
  Object.prototype.hasOwnProperty.call(
    GPT_IMAGE_2_OFFICIAL_SIZE_MAP["1K"],
    String(aspectRatio || "").trim(),
  );

export const getNearestOfficialGptImage2AspectRatio = (
  aspectRatio: string | null | undefined,
): string => {
  const target = parseAspectRatioValue(aspectRatio);
  if (!target) return "1:1";

  let closest = "1:1";
  let minDiff = Number.POSITIVE_INFINITY;

  for (const candidate of OFFICIAL_GPT_IMAGE_2_ASPECT_RATIOS) {
    const candidateRatio = parseAspectRatioValue(candidate);
    if (!candidateRatio) continue;
    const diff = Math.abs(candidateRatio - target);
    if (diff < minDiff) {
      minDiff = diff;
      closest = candidate;
    }
  }

  return closest;
};

export const getNormalizedAspectRatioForImageModel = (
  model: string | null | undefined,
  aspectRatio: string | null | undefined,
): string => {
  const normalized = String(aspectRatio || "").trim() || "1:1";
  if (!isGptImage2FamilyModel(model)) {
    return normalized;
  }
  if (isOfficialGptImage2AspectRatio(normalized)) {
    return normalized;
  }
  return getNearestOfficialGptImage2AspectRatio(normalized);
};

export const getOfficialGptImage2Size = (
  aspectRatio: string | null | undefined,
  resolution: WorkspaceImageResolutionPreset,
): string | null =>
  GPT_IMAGE_2_OFFICIAL_SIZE_MAP[resolution][String(aspectRatio || "").trim()] ||
  null;

export const getAspectRatioPreviewSize = (
  aspectRatio: string | null | undefined,
  resolution: WorkspaceImageResolutionPreset = "1K",
): string | null => {
  const normalized = String(aspectRatio || "").trim();
  return (
    GPT_IMAGE_2_OFFICIAL_SIZE_MAP[resolution][normalized] ||
    LEGACY_PREVIEW_SIZE_MAP[resolution][normalized] ||
    null
  );
};

export const getImageModelSupportState = (args: {
  model: string | null | undefined;
  aspectRatio: string | null | undefined;
  resolution: WorkspaceImageResolutionPreset;
}): {
  status: WorkspaceImageSupportStatus;
  actualSize: string | null;
  officialSupported: boolean;
  yunwuSupported: boolean;
  reason: string | null;
} => {
  const normalizedAspectRatio = String(args.aspectRatio || "").trim() || "1:1";
  const actualSize = getOfficialGptImage2Size(
    normalizedAspectRatio,
    args.resolution,
  );

  if (!isGptImage2FamilyModel(args.model)) {
    return {
      status: "normal",
      actualSize:
        actualSize ||
        getAspectRatioPreviewSize(normalizedAspectRatio, args.resolution),
      officialSupported: true,
      yunwuSupported: true,
      reason: null,
    };
  }

  if (!actualSize) {
    return {
      status: "disabled",
      actualSize: null,
      officialSupported: false,
      yunwuSupported: false,
      reason:
        "\u5f53\u524d\u6bd4\u4f8b\u8d85\u51fa gpt-image-2 \u5b98\u65b9\u7ea6\u675f\u8303\u56f4\uff08\u4ec5\u652f\u6301\u6700\u957f\u8fb9\u6bd4\u4f8b\u4e0d\u8d85\u8fc7 3:1\uff09\u3002",
    };
  }

  const yunwuSupported = isGptImage2AllModel(args.model)
    ? YUNWU_GPT_IMAGE_2_ALL_NATIVE_SIZES.has(actualSize)
    : YUNWU_GPT_IMAGE_2_NATIVE_SIZES.has(actualSize);

  if (!yunwuSupported) {
    return {
      status: "warning",
      actualSize,
      officialSupported: true,
      yunwuSupported,
      reason:
        isGptImage2AllModel(args.model)
          ? "\u5f53\u524d\u5c3a\u5bf8\u7b26\u5408 gpt-image-2 \u5b98\u65b9\u7ea6\u675f\uff0c\u4f46\u4e91\u96fe\u6587\u6863\u672a\u5217\u4e3a gpt-image-2-all \u7684\u6807\u51c6\u53ef\u7528\u5c3a\u5bf8\u3002"
          : "\u5f53\u524d\u5c3a\u5bf8\u7b26\u5408 gpt-image-2 \u5b98\u65b9\u7ea6\u675f\uff0c\u4f46\u4e91\u96fe\u6587\u6863\u672a\u5217\u4e3a gpt-image-2 \u7684\u6807\u51c6\u53ef\u7528\u5c3a\u5bf8\u3002",
    };
  }

  return {
    status: "normal",
    actualSize,
    officialSupported: true,
    yunwuSupported: true,
    reason: null,
  };
};
