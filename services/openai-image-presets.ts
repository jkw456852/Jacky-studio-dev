export const WORKSPACE_IMAGE_RESOLUTION_PRESETS = ["1K", "2K", "4K"] as const;

export type WorkspaceImageResolutionPreset =
  (typeof WORKSPACE_IMAGE_RESOLUTION_PRESETS)[number];

export type WorkspaceImageSupportStatus = "normal" | "warning" | "disabled";
export type WorkspaceImageSizeMode = "preset" | "custom" | "auto";

export const WORKSPACE_IMAGE_SIZE_MULTIPLE = 16;
export const WORKSPACE_IMAGE_MIN_EDGE = 16;
export const WORKSPACE_IMAGE_MAX_EDGE = 3840;
export const WORKSPACE_IMAGE_MIN_PIXELS = 655360;
export const WORKSPACE_IMAGE_MAX_PIXELS = 8294400;

export type WorkspaceNormalizedImageSize = {
  width: number;
  height: number;
  size: string;
  aspectRatio: string;
  adjusted: boolean;
  reasons: string[];
};

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

const clampDimensionToWorkspaceLimit = (value: number): number =>
  Math.max(
    WORKSPACE_IMAGE_MIN_EDGE,
    Math.min(WORKSPACE_IMAGE_MAX_EDGE, Math.round(value)),
  );

const snapDimensionToMultiple = (value: number): number => {
  const snapped =
    Math.round(value / WORKSPACE_IMAGE_SIZE_MULTIPLE) *
    WORKSPACE_IMAGE_SIZE_MULTIPLE;
  return Math.max(WORKSPACE_IMAGE_MIN_EDGE, snapped);
};

const gcd = (a: number, b: number): number => {
  let left = Math.abs(Math.round(a));
  let right = Math.abs(Math.round(b));
  while (right !== 0) {
    const next = left % right;
    left = right;
    right = next;
  }
  return Math.max(1, left);
};

const formatAspectRatioFromDimensions = (width: number, height: number): string => {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const divisor = gcd(safeWidth, safeHeight);
  return `${safeWidth / divisor}:${safeHeight / divisor}`;
};

const normalizeWorkspaceImagePair = (
  widthInput: number,
  heightInput: number,
): { width: number; height: number } => {
  let width = snapDimensionToMultiple(clampDimensionToWorkspaceLimit(widthInput));
  let height = snapDimensionToMultiple(clampDimensionToWorkspaceLimit(heightInput));

  if (width >= height) {
    width = Math.min(width, snapDimensionToMultiple(height * 3));
  } else {
    height = Math.min(height, snapDimensionToMultiple(width * 3));
  }

  width = snapDimensionToMultiple(clampDimensionToWorkspaceLimit(width));
  height = snapDimensionToMultiple(clampDimensionToWorkspaceLimit(height));

  return {
    width,
    height,
  };
};

const scaleWorkspaceImagePair = (
  width: number,
  height: number,
  factor: number,
): { width: number; height: number } =>
  normalizeWorkspaceImagePair(width * factor, height * factor);

export const normalizeWorkspaceImageSize = (args: {
  width: number;
  height: number;
}): WorkspaceNormalizedImageSize => {
  const reasons: string[] = [];
  const sourceWidth = Number(args.width);
  const sourceHeight = Number(args.height);

  let width = Number.isFinite(sourceWidth) && sourceWidth > 0 ? sourceWidth : 1024;
  let height = Number.isFinite(sourceHeight) && sourceHeight > 0 ? sourceHeight : 1024;

  if (width !== sourceWidth || height !== sourceHeight) {
    reasons.push("已将非法尺寸回退为默认合法值");
  }

  const originalRoundedWidth = Math.round(width);
  const originalRoundedHeight = Math.round(height);

  const normalizedInitial = normalizeWorkspaceImagePair(width, height);
  width = normalizedInitial.width;
  height = normalizedInitial.height;

  if (width !== originalRoundedWidth || height !== originalRoundedHeight) {
    reasons.push("已自动修正到 16px 倍数并限制最大边长 / 比例范围");
  }

  const tunePixelsToBounds = (
    currentWidth: number,
    currentHeight: number,
  ): { width: number; height: number } => {
    let nextWidth = currentWidth;
    let nextHeight = currentHeight;
    const ratio = nextWidth / Math.max(1, nextHeight);
    let safety = 0;

    while (
      safety < 512 &&
      (nextWidth * nextHeight < WORKSPACE_IMAGE_MIN_PIXELS ||
        nextWidth * nextHeight > WORKSPACE_IMAGE_MAX_PIXELS)
    ) {
      safety += 1;
      const shouldGrow = nextWidth * nextHeight < WORKSPACE_IMAGE_MIN_PIXELS;
      const delta = shouldGrow
        ? WORKSPACE_IMAGE_SIZE_MULTIPLE
        : -WORKSPACE_IMAGE_SIZE_MULTIPLE;
      const widthDominant = nextWidth >= nextHeight;

      if (widthDominant) {
        const candidateWidth = clampDimensionToWorkspaceLimit(nextWidth + delta);
        if (candidateWidth === nextWidth) {
          break;
        }
        nextWidth = candidateWidth;
        nextHeight = snapDimensionToMultiple(nextWidth / Math.max(ratio, 1e-6));
      } else {
        const candidateHeight = clampDimensionToWorkspaceLimit(nextHeight + delta);
        if (candidateHeight === nextHeight) {
          break;
        }
        nextHeight = candidateHeight;
        nextWidth = snapDimensionToMultiple(nextHeight * ratio);
      }

      const normalizedPair = normalizeWorkspaceImagePair(nextWidth, nextHeight);
      nextWidth = normalizedPair.width;
      nextHeight = normalizedPair.height;
    }

    return {
      width: nextWidth,
      height: nextHeight,
    };
  };

  let pixels = width * height;
  if (pixels < WORKSPACE_IMAGE_MIN_PIXELS) {
    const scaleUp = Math.sqrt(WORKSPACE_IMAGE_MIN_PIXELS / Math.max(1, pixels));
    const scaled = scaleWorkspaceImagePair(width, height, scaleUp);
    width = scaled.width;
    height = scaled.height;
    reasons.push("已自动放大到最小总像素要求");
  }

  pixels = width * height;
  if (pixels > WORKSPACE_IMAGE_MAX_PIXELS) {
    const scaleDown = Math.sqrt(WORKSPACE_IMAGE_MAX_PIXELS / pixels);
    const scaled = scaleWorkspaceImagePair(width, height, scaleDown);
    width = scaled.width;
    height = scaled.height;
    reasons.push("已自动缩小到最大总像素限制");
  }

  const tuned = tunePixelsToBounds(width, height);
  width = tuned.width;
  height = tuned.height;

  const finalNormalized = normalizeWorkspaceImagePair(width, height);
  width = finalNormalized.width;
  height = finalNormalized.height;

  return {
    width,
    height,
    size: `${width}x${height}`,
    aspectRatio: formatAspectRatioFromDimensions(width, height),
    adjusted: reasons.length > 0,
    reasons,
  };
};

export const inferAutoImageSizeFromReference = (args: {
  width: number;
  height: number;
}): WorkspaceNormalizedImageSize =>
  normalizeWorkspaceImageSize({
    width: args.width,
    height: args.height,
  });

export const parseImageSizeString = (
  value: string | null | undefined,
): { width: number; height: number } | null => {
  const raw = String(value || "").trim().toLowerCase();
  const match = raw.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (!match) {
    return null;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    width,
    height,
  };
};

export const getPresetImageSizeDimensions = (args: {
  aspectRatio: string | null | undefined;
  resolution: WorkspaceImageResolutionPreset;
}): WorkspaceNormalizedImageSize | null => {
  const official = getOfficialGptImage2Size(args.aspectRatio, args.resolution);
  const fallback = getAspectRatioPreviewSize(args.aspectRatio, args.resolution);
  const parsed = parseImageSizeString(official || fallback);
  if (!parsed) {
    return null;
  }
  return normalizeWorkspaceImageSize(parsed);
};

export const buildPresetSizeCandidatesForAspectRatio = (
  aspectRatio: string | null | undefined,
): Array<{
  resolution: WorkspaceImageResolutionPreset;
  normalized: WorkspaceNormalizedImageSize | null;
}> =>
  WORKSPACE_IMAGE_RESOLUTION_PRESETS.map((resolution) => ({
    resolution,
    normalized: getPresetImageSizeDimensions({
      aspectRatio,
      resolution,
    }),
  }));

export const getClosestWorkspaceImageResolutionPresetForSize = (args: {
  aspectRatio: string | null | undefined;
  width: number;
  height: number;
}): WorkspaceImageResolutionPreset => {
  const target = normalizeWorkspaceImageSize({
    width: args.width,
    height: args.height,
  });
  const candidates = buildPresetSizeCandidatesForAspectRatio(args.aspectRatio);

  let best: WorkspaceImageResolutionPreset = "1K";
  let bestScore = Number.POSITIVE_INFINITY;

  for (const item of candidates) {
    if (!item.normalized) continue;
    const score =
      Math.abs(item.normalized.width - target.width) +
      Math.abs(item.normalized.height - target.height);
    if (score < bestScore) {
      bestScore = score;
      best = item.resolution;
    }
  }

  return best;
};

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

export const getClosestWorkspaceAspectRatioFromSize = (
  width: number,
  height: number,
): string => {
  const normalized = normalizeWorkspaceImageSize({ width, height });
  const target = normalized.width / Math.max(1, normalized.height);
  let closest = "1:1";
  let minDiff = Number.POSITIVE_INFINITY;

  for (const candidate of WORKSPACE_IMAGE_ASPECT_RATIO_VALUES) {
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

export const getDefaultWorkspaceImageSizeForAspectRatio = (args: {
  aspectRatio: string | null | undefined;
  resolution?: WorkspaceImageResolutionPreset;
}): WorkspaceNormalizedImageSize => {
  const preset = getPresetImageSizeDimensions({
    aspectRatio: args.aspectRatio,
    resolution: args.resolution || "1K",
  });
  return preset || normalizeWorkspaceImageSize({ width: 1024, height: 1024 });
};

export const isWorkspaceImageAutoSizeSupportedForModel = (
  model: string | null | undefined,
): boolean => isGptImage2FamilyModel(model);

export const resolveAutoWorkspaceImageSize = (args: {
  model: string | null | undefined;
  referenceWidth?: number | null;
  referenceHeight?: number | null;
  fallbackAspectRatio?: string | null;
  fallbackResolution?: WorkspaceImageResolutionPreset;
}): WorkspaceNormalizedImageSize => {
  const referenceWidth = Number(args.referenceWidth);
  const referenceHeight = Number(args.referenceHeight);
  if (
    isWorkspaceImageAutoSizeSupportedForModel(args.model) &&
    Number.isFinite(referenceWidth) &&
    Number.isFinite(referenceHeight) &&
    referenceWidth > 0 &&
    referenceHeight > 0
  ) {
    return inferAutoImageSizeFromReference({
      width: referenceWidth,
      height: referenceHeight,
    });
  }

  return getDefaultWorkspaceImageSizeForAspectRatio({
    aspectRatio: args.fallbackAspectRatio || "1:1",
    resolution: args.fallbackResolution || "1K",
  });
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
