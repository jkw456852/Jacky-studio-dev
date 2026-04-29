import React from "react";
import type { CanvasElement } from "../../types";

export const FONTS = [
  "Inter",
  "Anonymous Pro",
  "Crimson Text",
  "Albert Sans",
  "Roboto",
  "Roboto Mono",
  "Source Serif Pro",
  "Pacifico",
  "Helvetica",
  "Arial",
  "Times New Roman",
];

export const ASPECT_RATIOS = [
  { label: "8:1", value: "8:1", size: "1024*128", width: 1024, height: 128 },
  { label: "4:1", value: "4:1", size: "1024*256", width: 1024, height: 256 },
  { label: "21:9", value: "21:9", size: "1568*672", width: 1568, height: 672 },
  { label: "16:9", value: "16:9", size: "1456*816", width: 1456, height: 816 },
  { label: "3:2", value: "3:2", size: "1344*896", width: 1344, height: 896 },
  { label: "4:3", value: "4:3", size: "1232*928", width: 1232, height: 928 },
  { label: "5:4", value: "5:4", size: "1280*1024", width: 1280, height: 1024 },
  { label: "1:1", value: "1:1", size: "1024*1024", width: 1024, height: 1024 },
  { label: "4:5", value: "4:5", size: "1024*1280", width: 1024, height: 1280 },
  { label: "3:4", value: "3:4", size: "928*1232", width: 928, height: 1232 },
  { label: "2:3", value: "2:3", size: "896*1344", width: 896, height: 1344 },
  { label: "9:16", value: "9:16", size: "816*1456", width: 816, height: 1456 },
  { label: "1:4", value: "1:4", size: "256*1024", width: 256, height: 1024 },
  { label: "1:8", value: "1:8", size: "128*1024", width: 128, height: 1024 },
];

export const DEFAULT_PROXY_MAX_DIM = 2560;

const PROXY_TRIGGER_PIXELS = 8_000_000;
const IMAGE_FIT_VIEWPORT_RATIO = 0.6;
const IMAGE_FIT_MAX_WIDTH = 1280;
const IMAGE_FIT_MAX_HEIGHT = 900;
const DISPLAY_PROXY_MIN_EDGE = 1024;
const DISPLAY_PROXY_OVERSAMPLE = 2;
const DATA_URL_PREFIX = /^data:/i;
const TRANSIENT_ASSET_URL = /^(data:|blob:)/i;
const REFERENCE_IMAGE_NORMALIZE_TRIGGER_BYTES = 256 * 1024;
const REFERENCE_IMAGE_PREVIEW_MAX_BYTES = 200 * 1024;

export const renderRatioIcon = (
  ratioStr: string,
  isActive: boolean = false,
) => {
  const [wStr, hStr] = ratioStr.split(":");
  const width = parseFloat(wStr) || 1;
  const height = parseFloat(hStr) || 1;
  const maxDim = 14;
  const scaledW = width > height ? maxDim : maxDim * (width / height);
  const scaledH = height > width ? maxDim : maxDim * (height / width);

  return (
    <div className="flex items-center justify-center w-5 h-5 shrink-0">
      <div
        className={`border-[1.5px] rounded-[2px] transition-colors ${
          isActive ? "border-blue-600" : "border-gray-400"
        }`}
        style={{ width: scaledW, height: scaledH }}
      />
    </div>
  );
};

export const calcInitialDisplaySize = (
  imgW: number,
  imgH: number,
  viewportW: number,
  viewportH: number,
) => {
  const safeW = Math.max(1, imgW);
  const safeH = Math.max(1, imgH);
  const maxW = Math.min(
    viewportW * IMAGE_FIT_VIEWPORT_RATIO,
    IMAGE_FIT_MAX_WIDTH,
  );
  const maxH = Math.min(
    viewportH * IMAGE_FIT_VIEWPORT_RATIO,
    IMAGE_FIT_MAX_HEIGHT,
  );
  const scale = Math.min(maxW / safeW, maxH / safeH, 1);

  return {
    displayW: Math.max(1, Math.round(safeW * scale)),
    displayH: Math.max(1, Math.round(safeH * scale)),
  };
};

export const getCanvasViewportSize = (showAssistant: boolean) => ({
  width: Math.max(320, window.innerWidth - (showAssistant ? 480 : 0)),
  height: Math.max(240, window.innerHeight),
});

export const getCanvasCenterPoint = ({
  showAssistant,
  pan,
  zoom,
  viewport = getCanvasViewportSize(showAssistant),
}: {
  showAssistant: boolean;
  pan: { x: number; y: number };
  zoom: number;
  viewport?: { width: number; height: number };
}) => ({
  x: (viewport.width / 2 - pan.x) / (zoom / 100),
  y: (viewport.height / 2 - pan.y) / (zoom / 100),
  viewport,
});

export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve((event.target?.result as string) || "");
    reader.onerror = () =>
      reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

export const makeImageProxyDataUrl = async (
  file: File,
  maxDim: number = DEFAULT_PROXY_MAX_DIM,
  fitViewport: { width: number; height: number } = {
    width: window.innerWidth,
    height: window.innerHeight,
  },
): Promise<{
  originalUrl: string;
  displayUrl: string;
  originalWidth: number;
  originalHeight: number;
  displayWidth: number;
  displayHeight: number;
}> => {
  const originalUrl = await fileToDataUrl(file);
  const full = await createImageBitmap(file);
  const originalWidth = full.width;
  const originalHeight = full.height;
  const pixelCount = originalWidth * originalHeight;
  const fitted = calcInitialDisplaySize(
    originalWidth,
    originalHeight,
    fitViewport.width,
    fitViewport.height,
  );
  let displayUrl = originalUrl;
  let displayWidth = fitted.displayW;
  let displayHeight = fitted.displayH;
  const desiredMaxEdge = Math.min(
    maxDim,
    Math.max(
      DISPLAY_PROXY_MIN_EDGE,
      Math.round(Math.max(displayWidth, displayHeight) * DISPLAY_PROXY_OVERSAMPLE),
    ),
  );
  const proxyScale = Math.min(
    1,
    desiredMaxEdge / Math.max(originalWidth, originalHeight),
  );
  const shouldCreateDisplayProxy =
    pixelCount > PROXY_TRIGGER_PIXELS || proxyScale < 0.98;

  if (shouldCreateDisplayProxy) {
    const targetW = Math.max(1, Math.round(originalWidth * proxyScale));
    const targetH = Math.max(1, Math.round(originalHeight * proxyScale));

    let proxyBitmap: ImageBitmap | null = null;
    try {
      proxyBitmap = await createImageBitmap(file, {
        resizeWidth: targetW,
        resizeHeight: targetH,
        resizeQuality: "high",
      });
    } catch {
      proxyBitmap = null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      if (proxyBitmap) {
        ctx.drawImage(proxyBitmap, 0, 0, targetW, targetH);
      } else {
        ctx.drawImage(full, 0, 0, targetW, targetH);
      }
      displayUrl = canvas.toDataURL("image/webp", 0.85);
    }

    proxyBitmap?.close?.();
  }

  full.close?.();
  return {
    originalUrl,
    displayUrl,
    originalWidth,
    originalHeight,
    displayWidth,
    displayHeight,
  };
};

export const makeImageProxyFromUrl = async (
  url: string,
  maxDim: number = DEFAULT_PROXY_MAX_DIM,
  fitViewport: { width: number; height: number } = {
    width: window.innerWidth,
    height: window.innerHeight,
  },
): Promise<{
  originalUrl: string;
  displayUrl: string;
  originalWidth: number;
  originalHeight: number;
  displayWidth: number;
  displayHeight: number;
}> => {
  let fitted = calcInitialDisplaySize(
    1,
    1,
    fitViewport.width,
    fitViewport.height,
  );
  const readNaturalSize = (src: string) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () =>
        resolve({
          width: img.naturalWidth || img.width || 1,
          height: img.naturalHeight || img.height || 1,
        });
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = src;
    });

  let originalWidth = 1;
  let originalHeight = 1;
  let displayUrl = url;

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const full = await createImageBitmap(blob);
    originalWidth = full.width;
    originalHeight = full.height;
    fitted = calcInitialDisplaySize(
      originalWidth,
      originalHeight,
      fitViewport.width,
      fitViewport.height,
    );
    const pixelCount = originalWidth * originalHeight;
    const desiredMaxEdge = Math.min(
      maxDim,
      Math.max(
        DISPLAY_PROXY_MIN_EDGE,
        Math.round(
          Math.max(fitted.displayW, fitted.displayH) * DISPLAY_PROXY_OVERSAMPLE,
        ),
      ),
    );
    const proxyScale = Math.min(
      1,
      desiredMaxEdge / Math.max(originalWidth, originalHeight),
    );
    const shouldCreateDisplayProxy =
      pixelCount > PROXY_TRIGGER_PIXELS || proxyScale < 0.98;

    if (shouldCreateDisplayProxy) {
      const targetW = Math.max(1, Math.round(originalWidth * proxyScale));
      const targetH = Math.max(1, Math.round(originalHeight * proxyScale));

      let proxyBitmap: ImageBitmap | null = null;
      try {
        proxyBitmap = await createImageBitmap(blob, {
          resizeWidth: targetW,
          resizeHeight: targetH,
          resizeQuality: "high",
        });
      } catch {
        proxyBitmap = null;
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (proxyBitmap) {
          ctx.drawImage(proxyBitmap, 0, 0, targetW, targetH);
        } else {
          ctx.drawImage(full, 0, 0, targetW, targetH);
        }
        displayUrl = canvas.toDataURL("image/webp", 0.85);
      }

      proxyBitmap?.close?.();
    }

    full.close?.();
  } catch {
    try {
      const size = await readNaturalSize(url);
      originalWidth = size.width;
      originalHeight = size.height;
      fitted = calcInitialDisplaySize(
        originalWidth,
        originalHeight,
        fitViewport.width,
        fitViewport.height,
      );
    } catch {
      originalWidth = 1024;
      originalHeight = 1024;
      fitted = calcInitialDisplaySize(
        originalWidth,
        originalHeight,
        fitViewport.width,
        fitViewport.height,
      );
    }
  }

  return {
    originalUrl: url,
    displayUrl,
    originalWidth,
    originalHeight,
    displayWidth: fitted.displayW,
    displayHeight: fitted.displayH,
  };
};

export const compressImage = (
  file: File,
  maxDim: number = 2048,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const resultUrl = event.target?.result as string;
      const img = new Image();
      img.onerror = () => {
        reject(new Error(`Failed to decode image file: ${file.name || "unknown"}`));
      };
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const shouldReencode =
          width > maxDim || height > maxDim || file.size > 1024 * 1024;

        if (shouldReencode) {
          if (width > height) {
            if (width > maxDim) {
              height = (height / width) * maxDim;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = (width / height) * maxDim;
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width));
          canvas.height = Math.max(1, Math.round(height));
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } else {
          resolve(resultUrl);
        }
      };
      img.src = resultUrl;
    };
    reader.onerror = () => {
      reject(reader.error || new Error(`Failed to read image file: ${file.name || "unknown"}`));
    };
    reader.readAsDataURL(file);
  });
};

export const isTransientAssetUrl = (value: string | null | undefined): boolean =>
  TRANSIENT_ASSET_URL.test(String(value || "").trim());

export const estimateDataUrlBytes = (value: string | null | undefined): number => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return 0;
  }

  const commaIndex = normalized.indexOf(",");
  if (commaIndex < 0) {
    return normalized.length;
  }

  return Math.floor(((normalized.length - commaIndex - 1) * 3) / 4);
};

export const isLikelyGeneratedReferencePreview = (
  value: string | null | undefined,
  maxBytes: number = REFERENCE_IMAGE_PREVIEW_MAX_BYTES,
): boolean => {
  const normalized = String(value || "").trim();
  if (!normalized || !DATA_URL_PREFIX.test(normalized)) {
    return false;
  }

  return estimateDataUrlBytes(normalized) <= maxBytes;
};

export const shouldNormalizeReferenceImageSource = (
  value: string | null | undefined,
  thresholdBytes: number = REFERENCE_IMAGE_NORMALIZE_TRIGGER_BYTES,
): boolean => {
  const normalized = String(value || "").trim();
  if (!DATA_URL_PREFIX.test(normalized)) {
    return false;
  }

  return estimateDataUrlBytes(normalized) > thresholdBytes;
};

export const normalizeReferenceImageSource = async (
  source: string,
  maxDim: number = 1280,
  quality: number = 0.82,
): Promise<string> => {
  if (!shouldNormalizeReferenceImageSource(source)) {
    return source;
  }

  const normalized = await createImagePreviewDataUrl(source, maxDim, quality);
  return normalized.length < source.length * 0.95 ? normalized : source;
};

export const createImagePreviewDataUrl = async (
  source: File | string,
  maxDim: number = 160,
  quality: number = 0.72,
): Promise<string> => {
  const src =
    typeof source === "string" ? source : await fileToDataUrl(source);

  return new Promise((resolve) => {
    let settled = false;
    const finalize = (value: string) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const img = new Image();
    img.decoding = "async";
    if (
      typeof source === "string" &&
      /^https?:\/\//i.test(src)
    ) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      try {
        const width = Math.max(1, img.naturalWidth || img.width || maxDim);
        const height = Math.max(1, img.naturalHeight || img.height || maxDim);
        const scale = Math.min(1, maxDim / Math.max(width, height));
        const targetWidth = Math.max(1, Math.round(width * scale));
        const targetHeight = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          finalize(src);
          return;
        }
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        finalize(canvas.toDataURL("image/jpeg", quality));
      } catch {
        finalize(src);
      }
    };
    img.onerror = () => finalize(src);
    window.setTimeout(() => finalize(src), 8000);
    img.src = src;
  });
};

export const dataURLtoFile = (dataUrl: string, filename: string): File => {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let length = bstr.length;
  const bytes = new Uint8Array(length);

  while (length--) {
    bytes[length] = bstr.charCodeAt(length);
  }

  return new File([bytes], filename, { type: mime });
};

export const getElementDisplayUrl = (
  element: CanvasElement,
): string | undefined => element.proxyUrl || element.url;

export const getElementSourceUrl = (
  element: CanvasElement,
): string | undefined => element.originalUrl || element.url;

export const getUpscaleFactor = (res: "2K" | "4K" | "8K") =>
  res === "2K" ? 2 : res === "4K" ? 4 : 8;

export const getNearestAspectRatio = (
  width: number,
  height: number,
): string => {
  const ratio = width / height;
  const supported = [
    "1:1",
    "3:4",
    "4:3",
    "9:16",
    "16:9",
    "21:9",
    "3:2",
    "2:3",
    "5:4",
    "4:5",
  ];
  let nearest = supported[0];
  let minDiff = Number.POSITIVE_INFINITY;

  for (const item of supported) {
    const [w, h] = item.split(":").map(Number);
    const candidate = w / h;
    const diff = Math.abs(candidate - ratio);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = item;
    }
  }

  return nearest;
};

export const getClosestAspectRatio = (
  width: number,
  height: number,
): string => {
  const ratio = width / height;
  let closest = "1:1";
  let minDiff = Infinity;

  for (const aspectRatio of ASPECT_RATIOS) {
    const [w, h] = aspectRatio.value.split(":").map(Number);
    const candidate = w / h;
    const diff = Math.abs(ratio - candidate);
    if (diff < minDiff) {
      minDiff = diff;
      closest = aspectRatio.value;
    }
  }

  return closest;
};

export const loadElementSourceSize = async (
  element: CanvasElement,
): Promise<{ width: number; height: number }> => {
  if (!element.url) {
    return {
      width: Math.max(1, Math.round(element.width)),
      height: Math.max(1, Math.round(element.height)),
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || Math.max(1, Math.round(element.width)),
        height: img.naturalHeight || Math.max(1, Math.round(element.height)),
      });
    };
    img.onerror = () => {
      resolve({
        width: Math.max(1, Math.round(element.width)),
        height: Math.max(1, Math.round(element.height)),
      });
    };
    img.src = element.url as string;
  });
};

export const calcUpscaleTargetSize = (
  sourceWidth: number,
  sourceHeight: number,
  factor: number,
) => ({
  width: Math.max(1, Math.round(sourceWidth * factor)),
  height: Math.max(1, Math.round(sourceHeight * factor)),
});
