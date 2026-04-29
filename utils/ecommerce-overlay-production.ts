import JSZip from "jszip";
import type {
  EcommerceOverlayBulletStyle,
  EcommerceOverlayPlatformPresetId,
  EcommerceOverlayTemplateId,
  EcommerceOverlayTextAlign,
  EcommerceOverlayTone,
} from "../types/workflow.types";
import {
  safeLocalStorageRemoveItem,
  safeLocalStorageSetItem,
  safeLocalStorageStateStorage,
} from "./safe-storage";

export type EcommerceOverlayBrandPreset = {
  id: string;
  name: string;
  fontFamily?: string;
  fontLabel?: string;
  fontUrl?: string;
  featureTagIconLabel?: string;
  featureTagIconUrl?: string;
  badge?: string;
  cta?: string;
  tone?: EcommerceOverlayTone;
  bulletStyle?: EcommerceOverlayBulletStyle;
  updatedAt: number;
};

export type EcommerceOverlayPlatformPresetConfig = {
  id: EcommerceOverlayPlatformPresetId;
  label: string;
  description: string;
  templateId: EcommerceOverlayTemplateId;
  textAlign: EcommerceOverlayTextAlign;
  tone: EcommerceOverlayTone;
  bulletStyle: EcommerceOverlayBulletStyle;
};

export const OVERLAY_BRAND_PRESET_STORAGE_KEY =
  "ecom_overlay_brand_presets_v1";

export const OVERLAY_PLATFORM_PRESET_OPTIONS: EcommerceOverlayPlatformPresetConfig[] =
  [
    {
      id: "general-detail",
      label: "通用详情页",
      description: "适合多数电商详情图，偏稳妥、通用。",
      templateId: "hero-left",
      textAlign: "left",
      tone: "dark",
      bulletStyle: "list",
    },
    {
      id: "taobao-detail",
      label: "淘宝详情页",
      description: "强调卖点与氛围，更适合促销感与品牌强调。",
      templateId: "hero-left",
      textAlign: "left",
      tone: "accent",
      bulletStyle: "chips",
    },
    {
      id: "jd-detail",
      label: "京东参数图",
      description: "偏理性参数表达，更适合规格和功能卡片。",
      templateId: "spec-band",
      textAlign: "left",
      tone: "light",
      bulletStyle: "cards",
    },
    {
      id: "douyin-window",
      label: "抖音橱窗图",
      description: "强调第一眼抓人，适合居中重点表达。",
      templateId: "hero-center",
      textAlign: "center",
      tone: "accent",
      bulletStyle: "chips",
    },
    {
      id: "xiaohongshu-cover",
      label: "小红书封面",
      description: "更轻、更干净，适合标题视觉优先。",
      templateId: "hero-center",
      textAlign: "center",
      tone: "light",
      bulletStyle: "list",
    },
    {
      id: "amazon-infographic",
      label: "亚马逊信息图",
      description: "更偏信息密度与解释型排版，适合参数对比图。",
      templateId: "spec-band",
      textAlign: "left",
      tone: "light",
      bulletStyle: "cards",
    },
  ];

export const getOverlayPlatformPresetConfig = (
  presetId?: EcommerceOverlayPlatformPresetId | "",
): EcommerceOverlayPlatformPresetConfig | null =>
  OVERLAY_PLATFORM_PRESET_OPTIONS.find((item) => item.id === presetId) || null;

export const loadOverlayBrandPresets = (): EcommerceOverlayBrandPreset[] => {
  try {
    const raw = safeLocalStorageStateStorage.getItem(
      OVERLAY_BRAND_PRESET_STORAGE_KEY,
    );
    if (typeof raw !== "string" || !raw) return [];
    const parsed = JSON.parse(raw) as EcommerceOverlayBrandPreset[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.id && item.name)
      .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
  } catch {
    return [];
  }
};

export const saveOverlayBrandPresets = (
  presets: EcommerceOverlayBrandPreset[],
): void => {
  safeLocalStorageSetItem(
    OVERLAY_BRAND_PRESET_STORAGE_KEY,
    JSON.stringify(presets),
  );
};

export const upsertOverlayBrandPreset = (
  preset: EcommerceOverlayBrandPreset,
): EcommerceOverlayBrandPreset[] => {
  const current = loadOverlayBrandPresets();
  const next = [
    preset,
    ...current.filter((item) => item.id !== preset.id),
  ].slice(0, 16);
  saveOverlayBrandPresets(next);
  return next;
};

export const deleteOverlayBrandPreset = (
  presetId: string,
): EcommerceOverlayBrandPreset[] => {
  const current = loadOverlayBrandPresets();
  const next = current.filter((item) => item.id !== presetId);
  if (next.length === 0) {
    safeLocalStorageRemoveItem(OVERLAY_BRAND_PRESET_STORAGE_KEY);
    return [];
  }
  saveOverlayBrandPresets(next);
  return next;
};

export const downloadOverlayImages = (
  items: Array<{ url: string; label: string }>,
): void => {
  items.forEach((item, index) => {
    const anchor = document.createElement("a");
    anchor.href = item.url;
    anchor.download = `${String(index + 1).padStart(2, "0")}-${item.label}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  });
};

export const exportOverlayImagesZip = async (options: {
  items: Array<{ url: string; label: string; meta?: Record<string, unknown> }>;
  filename: string;
}): Promise<void> => {
  if (options.items.length === 0) return;
  const zip = new JSZip();
  await Promise.all(
    options.items.map(async (item, index) => {
      const response = await fetch(item.url);
      if (!response.ok) {
        throw new Error(`下载失败：${item.label}`);
      }
      const blob = await response.blob();
      const extension =
        blob.type === "image/jpeg" || blob.type === "image/jpg" ? "jpg" : "png";
      zip.file(
        `${String(index + 1).padStart(2, "0")}-${item.label}.${extension}`,
        blob,
      );
    }),
  );
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        count: options.items.length,
        items: options.items.map((item, index) => ({
          index: index + 1,
          label: item.label,
          ...item.meta,
        })),
      },
      null,
      2,
    ),
  );
  const blob = await zip.generateAsync({ type: "blob" });
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = `${options.filename}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(blobUrl);
};
