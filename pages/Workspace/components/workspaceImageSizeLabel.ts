const GPT_IMAGE_2_MODEL_KEYS = new Set([
  "gptimage2",
]);

const SIZE_MULTIPLE = 16;
const GPT_IMAGE_2_4K_MAX_EDGE = 3840;
const GPT_IMAGE_2_4K_MAX_PIXELS = 8_294_400;

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
};

const normalizeModelKey = (model: string | null | undefined): string =>
  String(model || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const isGptImage2Model = (model: string | null | undefined): boolean =>
  GPT_IMAGE_2_MODEL_KEYS.has(normalizeModelKey(model));

const parseAspectRatio = (
  aspectRatio: string | null | undefined,
): { width: number; height: number } | null => {
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

  const divisor = gcd(width, height);
  return {
    width: width / divisor,
    height: height / divisor,
  };
};

const getGptImage24KActualSize = (
  aspectRatio: string | null | undefined,
): string | null => {
  const ratio = parseAspectRatio(aspectRatio || "1:1");
  if (!ratio) return null;

  const widthUnit = ratio.width * SIZE_MULTIPLE;
  const heightUnit = ratio.height * SIZE_MULTIPLE;
  const unitPixels = widthUnit * heightUnit;

  if (unitPixels <= 0) return null;

  const edgeLimitedScale = Math.floor(
    GPT_IMAGE_2_4K_MAX_EDGE / Math.max(widthUnit, heightUnit),
  );
  const pixelLimitedScale = Math.floor(
    Math.sqrt(GPT_IMAGE_2_4K_MAX_PIXELS / unitPixels),
  );
  const scale = Math.max(1, Math.min(edgeLimitedScale, pixelLimitedScale));

  const width = widthUnit * scale;
  const height = heightUnit * scale;

  if (width > GPT_IMAGE_2_4K_MAX_EDGE || height > GPT_IMAGE_2_4K_MAX_EDGE) {
    return null;
  }
  if (width * height > GPT_IMAGE_2_4K_MAX_PIXELS) {
    return null;
  }

  return `${width}×${height}`;
};

export const getImageResolutionDisplayLabel = (opts: {
  resolution: "1K" | "2K" | "4K";
  model?: string | null | undefined;
  aspectRatio?: string | null | undefined;
}): string => {
  if (opts.resolution !== "4K" || !isGptImage2Model(opts.model)) {
    return opts.resolution;
  }

  const actualSize = getGptImage24KActualSize(opts.aspectRatio);
  return actualSize ? `4K · ${actualSize}` : opts.resolution;
};
