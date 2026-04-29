import { z } from "zod";
import { Type } from "@google/genai";
import { generateJsonResponse, getBestModelId } from "../gemini";
import {
  buildMappedModelStorageEntry,
  getMappedModelConfigs,
  getMappedPrimaryModelConfig,
} from "../provider-settings";
import { persistEcommerceProductAnalysisDebugSnapshot } from "../ecommerce-product-analysis-debug";
import { persistEcommerceSupplementDebugSnapshot } from "../ecommerce-supplement-debug";
import { useImageHostStore } from "../../stores/imageHost.store";
import type {
  EcommerceAnalysisReview,
  EcommerceArchetypeEvolutionProposal,
  EcommerceComponentNeed,
  EcommerceImageAnalysis,
  EcommerceImageRole,
  EcommerceLayoutAreaKind,
  EcommerceLayoutIntent,
  EcommerceLayoutMode,
  EcommercePlanItem,
  EcommercePlatformMode,
  EcommercePlanGroup,
  EcommerceRecommendedType,
  EcommerceStageReview,
  EcommerceSupplementField,
  EcommerceWorkflowMode,
} from "../../types/workflow.types";
import { splitEcommerceImageAnalysisTextFieldList } from "../../utils/ecommerce-image-analysis";
import {
  normalizePlannedEcommercePlanRatio,
  resolveEcommercePlanRatio,
} from "../../utils/ecommerce-plan-ratio";
import { uploadImage } from "../../utils/uploader";

const platformModeSchema = z.enum([
  "general",
  "taobao",
  "jd",
  "pdd",
  "douyin",
  "xiaohongshu",
  "amazon",
]);

const workflowModeSchema = z.enum(["quick", "professional"]);

const analyzeProductSchema = z.object({
  productImages: z.array(z.string()).min(1).max(9),
  brief: z.string().optional(),
  feedback: z.string().optional(),
  platformMode: platformModeSchema.optional(),
  workflowMode: workflowModeSchema.optional(),
});

const supplementsSchema = z.object({
  productImages: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
        name: z.string().optional(),
      }),
    )
    .default([]),
  brief: z.string().optional(),
  analysisSummary: z.string().optional(),
  platformMode: platformModeSchema.optional(),
  workflowMode: workflowModeSchema.optional(),
  fallbackMode: z.enum(["block", "allow", "force"]).default("block"),
  recommendedTypes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      selected: z.boolean(),
    }),
  ),
});

const analyzeImagesSchema = z.object({
  productImages: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      name: z.string().optional(),
    }),
  ),
  brief: z.string().optional(),
  platformMode: platformModeSchema.optional(),
  workflowMode: workflowModeSchema.optional(),
  supplementSummary: z.string().optional(),
});

const generatePlansSchema = z.object({
  selectedTypes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      imageCount: z.number().int().min(1).max(12),
    }),
  ),
  imageAnalyses: z.array(
    z.object({
      imageId: z.string(),
      title: z.string(),
      description: z.string(),
      analysisConclusion: z.string().optional(),
    }),
  ),
  brief: z.string().optional(),
  supplementSummary: z.string().optional(),
  platformMode: platformModeSchema.optional(),
  workflowMode: workflowModeSchema.optional(),
  fallbackMode: z.enum(["block", "allow", "force"]).default("block"),
});

const rewritePromptSchema = z.object({
  productDescription: z.string().optional(),
  typeTitle: z.string(),
  planTitle: z.string(),
  planDescription: z.string().optional(),
  currentPrompt: z.string(),
  supplementSummary: z.string().optional(),
  targetRatio: z.string().optional(),
  feedback: z.string().optional(),
  imageAnalyses: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        analysisConclusion: z.string().optional(),
        angle: z.string().optional(),
      }),
    )
    .optional(),
});

const reviewGeneratedResultSchema = z.object({
  imageUrl: z.string(),
  planTitle: z.string(),
  typeTitle: z.string().optional(),
  productDescription: z.string().optional(),
  prompt: z.string().optional(),
  platformMode: platformModeSchema.optional(),
  referenceImages: z.array(z.string()).optional(),
});

const MAX_PROMPT_REFERENCE_IMAGES = 3;

const recommendedTypeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  imageCount: z.number().int().min(1).max(12),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  platformTags: z.array(z.string()).default([]),
  selected: z.boolean().default(true),
  reason: z.string().default(""),
  highlights: z.array(z.string()).default([]),
  recommended: z.boolean().optional(),
  required: z.boolean().optional(),
  goal: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  evidence: z.array(z.string()).optional(),
  omittedReason: z.string().optional(),
});

const analysisReviewSchema = z.object({
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  verdict: z.string().default(""),
  reviewerNotes: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});

const archetypeEvolutionProposalSchema = z.object({
  candidateId: z.string().default(""),
  label: z.string().default(""),
  appliesWhen: z.string().default(""),
  whyCurrentArchetypesFail: z.string().default(""),
  proposedDecisionFactors: z.array(z.string()).default([]),
  proposedMustShow: z.array(z.string()).default([]),
  proposedVisualProofGrammar: z.array(z.string()).default([]),
  boundaryExamples: z.array(z.string()).default([]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

const stageReviewSchema = z.object({
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  verdict: z.string().default(""),
  reviewerNotes: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});

const resultReviewSchema = z.object({
  score: z.number().min(0).max(100),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  summary: z.string().default(""),
  strengths: z.array(z.string()).default([]),
  issues: z.array(z.string()).default([]),
  recommendedUse: z.string().optional(),
});

const analyzeProductOutputSchema = z.object({
  summary: z.string().default(""),
  recommendedTypes: z.array(recommendedTypeSchema).min(1),
  evolutionProposals: z.array(archetypeEvolutionProposalSchema).default([]),
});

const analyzeProductReviewedOutputSchema = z.object({
  summary: z.string().default(""),
  recommendedTypes: z.array(recommendedTypeSchema).min(1),
  evolutionProposals: z.array(archetypeEvolutionProposalSchema).default([]),
  review: analysisReviewSchema,
});

const recommendedTypeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    imageCount: { type: Type.INTEGER },
    priority: {
      type: Type.STRING,
      enum: ["high", "medium", "low"],
    },
    platformTags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    selected: { type: Type.BOOLEAN },
    reason: { type: Type.STRING },
    highlights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    recommended: { type: Type.BOOLEAN },
    required: { type: Type.BOOLEAN },
    goal: { type: Type.STRING },
    confidence: {
      type: Type.STRING,
      enum: ["high", "medium", "low"],
    },
    evidence: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    omittedReason: { type: Type.STRING },
  },
  required: [
    "id",
    "title",
    "description",
    "imageCount",
    "priority",
    "platformTags",
    "selected",
    "reason",
    "highlights",
  ],
};

const analysisReviewResponseSchema = {
  type: Type.OBJECT,
  properties: {
    confidence: {
      type: Type.STRING,
      enum: ["high", "medium", "low"],
    },
    verdict: { type: Type.STRING },
    reviewerNotes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    risks: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["confidence", "verdict", "reviewerNotes", "risks"],
};

const archetypeEvolutionProposalResponseSchema = {
  type: Type.OBJECT,
  properties: {
    candidateId: { type: Type.STRING },
    label: { type: Type.STRING },
    appliesWhen: { type: Type.STRING },
    whyCurrentArchetypesFail: { type: Type.STRING },
    proposedDecisionFactors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    proposedMustShow: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    proposedVisualProofGrammar: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    boundaryExamples: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    confidence: {
      type: Type.STRING,
      enum: ["high", "medium", "low"],
    },
  },
  required: [
    "candidateId",
    "label",
    "appliesWhen",
    "whyCurrentArchetypesFail",
    "proposedDecisionFactors",
    "proposedMustShow",
    "proposedVisualProofGrammar",
    "boundaryExamples",
    "confidence",
  ],
};

const analyzeProductReviewedOutputResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    recommendedTypes: {
      type: Type.ARRAY,
      items: recommendedTypeResponseSchema,
    },
    evolutionProposals: {
      type: Type.ARRAY,
      items: archetypeEvolutionProposalResponseSchema,
    },
    review: analysisReviewResponseSchema,
  },
  required: ["summary", "recommendedTypes", "review", "evolutionProposals"],
};

const supplementFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["text", "textarea", "single-select", "multi-select", "image"]),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  value: z.union([z.string(), z.array(z.string())]).optional(),
  helperText: z.string().optional(),
  maxItems: z.number().int().min(1).max(9).optional(),
  valueSource: z.enum(["user", "ai", "estimated"]).optional(),
  valueConfidence: z.enum(["high", "medium", "low"]).optional(),
  valueNote: z.string().optional(),
});

const supplementOutputSchema = z.object({
  fields: z.array(supplementFieldSchema).default([]),
});

const supplementFieldResponseSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    label: { type: Type.STRING },
    kind: {
      type: Type.STRING,
      enum: ["text", "textarea", "single-select", "multi-select", "image"],
    },
    required: { type: Type.BOOLEAN },
    placeholder: { type: Type.STRING },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    helperText: { type: Type.STRING },
    maxItems: { type: Type.INTEGER },
    valueSource: {
      type: Type.STRING,
      enum: ["user", "ai", "estimated"],
    },
    valueConfidence: {
      type: Type.STRING,
      enum: ["high", "medium", "low"],
    },
    valueNote: { type: Type.STRING },
  },
  required: ["id", "label", "kind", "required"],
};

const supplementOutputResponseSchema = {
  type: Type.OBJECT,
  properties: {
    fields: {
      type: Type.ARRAY,
      items: supplementFieldResponseSchema,
    },
  },
  required: ["fields"],
};

const autofillSupplementsSchema = z.object({
  productImages: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
        name: z.string().optional(),
      }),
    )
    .default([]),
  brief: z.string().optional(),
  platformMode: platformModeSchema.optional(),
  workflowMode: workflowModeSchema.optional(),
  recommendedTypes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      selected: z.boolean(),
    }),
  ),
  fields: z.array(supplementFieldSchema).default([]),
});

const imageAnalysisSchema = z.object({
  imageId: z.string(),
  title: z.string(),
  description: z.string(),
  analysisConclusion: z.string().optional().default(""),
  angle: z.string().optional(),
  usableAsReference: z.boolean().default(true),
  highlights: z.array(z.string()).default([]),
  materials: z.array(z.string()).default([]),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  evidence: z.array(z.string()).optional(),
});

const analyzeImagesOutputSchema = z.object({
  items: z.array(imageAnalysisSchema).default([]),
  review: stageReviewSchema.optional(),
});

const planItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  promptOutline: z.string(),
  ratio: z.string(),
  referenceImageIds: z.array(z.string()).default([]),
  status: z.enum(["draft", "ready"]).default("ready"),
  marketingGoal: z.string().optional(),
  keyMessage: z.string().optional(),
  mustShow: z.array(z.string()).default([]),
  composition: z.string().optional(),
  styling: z.string().optional(),
  background: z.string().optional(),
  lighting: z.string().optional(),
  platformFit: z.array(z.string()).optional(),
  riskNotes: z.array(z.string()).optional(),
  layoutIntent: z
    .object({
      imageRole: z
        .enum([
          "hero",
          "selling-point",
          "parameter",
          "structure",
          "detail",
          "scene",
          "comparison",
          "summary",
        ])
        .optional(),
      layoutMode: z
        .enum([
          "top-banner",
          "left-copy",
          "right-copy",
          "bottom-panel",
          "center-focus-with-edge-space",
          "split-info",
        ])
        .optional(),
      componentNeed: z
        .enum([
          "text-only",
          "text-and-icons",
          "text-and-stats",
          "annotation-heavy",
          "comparison-heavy",
        ])
        .optional(),
      reservedAreas: z
        .array(
          z.enum([
            "headline",
            "subheadline",
            "stats",
            "icons",
            "body",
            "comparison",
            "annotation",
          ]),
        )
        .optional(),
    })
    .optional(),
});

const planGroupSchema = z.object({
  typeId: z.string(),
  typeTitle: z.string(),
  summary: z.string().optional(),
  strategy: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    )
    .default([]),
  platformTags: z.array(z.string()).default([]),
  priority: z.enum(["high", "medium", "low"]).optional(),
  items: z.array(planItemSchema).default([]),
});

const generatePlansOutputSchema = z.object({
  groups: z.array(planGroupSchema).default([]),
  review: stageReviewSchema.optional(),
});

const planItemResponseSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    promptOutline: { type: Type.STRING },
    ratio: { type: Type.STRING },
    referenceImageIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    layoutIntent: {
      type: Type.OBJECT,
      properties: {
        imageRole: {
          type: Type.STRING,
          enum: [
            "hero",
            "selling-point",
            "parameter",
            "structure",
            "detail",
            "scene",
            "comparison",
            "summary",
          ],
        },
        layoutMode: {
          type: Type.STRING,
          enum: [
            "top-banner",
            "left-copy",
            "right-copy",
            "bottom-panel",
            "center-focus-with-edge-space",
            "split-info",
          ],
        },
        componentNeed: {
          type: Type.STRING,
          enum: [
            "text-only",
            "text-and-icons",
            "text-and-stats",
            "annotation-heavy",
            "comparison-heavy",
          ],
        },
        reservedAreas: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            enum: [
              "headline",
              "subheadline",
              "stats",
              "icons",
              "body",
              "comparison",
              "annotation",
            ],
          },
        },
      },
    },
  },
  required: ["id", "title", "description", "promptOutline", "ratio"],
};

const planGroupResponseSchema = {
  type: Type.OBJECT,
  properties: {
    typeId: { type: Type.STRING },
    typeTitle: { type: Type.STRING },
    summary: { type: Type.STRING },
    strategy: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.STRING },
        },
        required: ["label", "value"],
      },
    },
    priority: {
      type: Type.STRING,
      enum: ["high", "medium", "low"],
    },
    items: {
      type: Type.ARRAY,
      items: planItemResponseSchema,
    },
  },
  required: ["typeId", "typeTitle", "items"],
};

const planGroupsResponseSchema = {
  type: Type.OBJECT,
  properties: {
    groups: {
      type: Type.ARRAY,
      items: planGroupResponseSchema,
    },
  },
  required: ["groups"],
};

const autofillImageAnalysesSchema = z.object({
  productImages: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      name: z.string().optional(),
    }),
  ),
  brief: z.string().optional(),
  platformMode: platformModeSchema.optional(),
  workflowMode: workflowModeSchema.optional(),
  supplementSummary: z.string().optional(),
  currentItems: z.array(imageAnalysisSchema).default([]),
});

const autofillPlansSchema = z.object({
  selectedTypes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      imageCount: z.number().int().min(1).max(12),
    }),
  ),
  imageAnalyses: z.array(
    z.object({
      imageId: z.string(),
      title: z.string(),
      description: z.string(),
      analysisConclusion: z.string().optional(),
    }),
  ),
  currentGroups: z.array(planGroupSchema).default([]),
  brief: z.string().optional(),
  supplementSummary: z.string().optional(),
  platformMode: platformModeSchema.optional(),
  workflowMode: workflowModeSchema.optional(),
});

const toInlinePart = async (
  url: string,
): Promise<{ inlineData: { mimeType: string; data: string } }> => {
  if (/^data:image\/.+;base64,/.test(url)) {
    const match = url.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      throw new Error("invalid data url");
    }
    return { inlineData: { mimeType: match[1], data: match[2] } };
  }

  const response = await fetch(url);
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("file reader failed"));
    reader.readAsDataURL(blob);
  });
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error("convert image failed");
  }
  return { inlineData: { mimeType: match[1], data: match[2] } };
};

const buildImageFileName = (baseName: string, mimeType: string) => {
  const safeBaseName = String(baseName || "image").replace(/[^\w.-]+/g, "-");
  const extension =
    mimeType === "image/jpeg"
      ? "jpg"
      : mimeType === "image/png"
        ? "png"
        : mimeType === "image/webp"
          ? "webp"
          : mimeType === "image/gif"
            ? "gif"
            : "png";
  return safeBaseName.includes(".") ? safeBaseName : `${safeBaseName}.${extension}`;
};

const tryPromoteImageToPublicUrl = async (
  url: string,
  fileBaseName: string,
): Promise<string | null> => {
  const normalized = String(url || "").trim();
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (!/^(blob:|data:image\/)/i.test(normalized)) {
    return null;
  }

  const selectedProvider = useImageHostStore.getState().selectedProvider;
  if (selectedProvider === "none") {
    console.warn("[ecomAnalyzeProductSkill] no public image host configured, fallback to inline image payload", {
      inputKind: normalized.startsWith("blob:") ? "blob" : "data",
    });
    return null;
  }

  try {
    const response = await fetch(normalized);
    if (!response.ok) {
      throw new Error(`image fetch failed: ${response.status}`);
    }

    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      return null;
    }

    const file = new File([blob], buildImageFileName(fileBaseName, blob.type), {
      type: blob.type || "image/png",
      lastModified: Date.now(),
    });
    const uploadedUrl = await uploadImage(file);
    return /^https?:\/\//i.test(uploadedUrl) ? uploadedUrl : null;
  } catch (error) {
    console.warn("[ecomAnalyzeProductSkill] promote image to public url failed", {
      inputKind: normalized.startsWith("blob:") ? "blob" : "data",
      selectedProvider,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const toModelImagePart = async (
  url: string,
  index: number,
): Promise<
  | { inlineData: { mimeType: string; data: string } }
  | { imageUrl: string }
> => {
  const normalized = String(url || "").trim();
  if (/^https?:\/\//i.test(normalized)) {
    return { imageUrl: normalized };
  }

  const publicUrl = await tryPromoteImageToPublicUrl(
    normalized,
    `ecom-product-${index + 1}`,
  );
  if (publicUrl) {
    return { imageUrl: publicUrl };
  }

  console.warn("[ecomAnalyzeProductSkill] fallback to inline image payload", {
    index: index + 1,
    inputKind: normalized.startsWith("blob:")
      ? "blob"
      : normalized.startsWith("data:")
        ? "data"
        : "other",
  });
  return toInlinePart(normalized);
};

const summarizeImageUrlsForLog = (urls: string[]) => {
  return urls.map((url, index) => {
    const normalized = String(url || "");
    const isDataUrl = normalized.startsWith("data:");
    let host = "inline";
    try {
      if (!isDataUrl) {
        host = new URL(normalized).host || "unknown-host";
      }
    } catch {
      host = "invalid-url";
    }

    return {
      index: index + 1,
      host,
      isDataUrl,
      urlLength: normalized.length,
    };
  });
};

const summarizeInlinePartsForLog = (
  parts: Array<{ inlineData?: { mimeType?: string; data?: string } }>,
) => {
  return parts.map((part, index) => ({
    index: index + 1,
    mimeType: part.inlineData?.mimeType || "unknown",
    approxBytes: Math.round(((part.inlineData?.data?.length || 0) * 3) / 4),
  }));
};

const summarizeModelImagePartsForLog = (
  parts: Array<{
    inlineData?: { mimeType?: string; data?: string };
    imageUrl?: string;
  }>,
) => {
  return parts.map((part, index) => {
    if (part.imageUrl) {
      let host = "invalid-url";
      try {
        host = new URL(part.imageUrl).host || "unknown-host";
      } catch {
        host = "invalid-url";
      }
      return {
        index: index + 1,
        transport: "imageUrl",
        host,
        urlLength: part.imageUrl.length,
      };
    }

    return {
      index: index + 1,
      transport: "inlineData",
      mimeType: part.inlineData?.mimeType || "unknown",
      approxBytes: Math.round(((part.inlineData?.data?.length || 0) * 3) / 4),
    };
  });
};

type EcommerceProductArchetype =
  | "care-device"
  | "cleanser"
  | "serum-cream"
  | "beauty-makeup"
  | "supplement-health"
  | "food-beverage"
  | "apparel-accessory"
  | "digital-gadget"
  | "home-lifestyle"
  | "general";

const PRODUCT_ARCHETYPE_GUIDES: Record<
  EcommerceProductArchetype,
  {
    label: string;
    analysisAngles: string[];
    decisionFactors: string[];
    mustShow: string[];
    avoid: string[];
    recommendationBias: string[];
    supplementFocus: string[];
  }
> = {
  "care-device": {
    label: "护理仪器/理疗器械",
    analysisAngles: ["结构与接触面", "使用部位", "操作门槛", "便携性", "安全感与专业感"],
    decisionFactors: ["是否好理解", "适用部位是否明确", "结构是否可信", "护理场景是否真实"],
    mustShow: ["主体外形", "按键或操作方式", "接触结构", "适用部位", "尺寸或握持关系"],
    avoid: ["把理疗设备写成泛家居摆件", "虚构医疗疗效", "忽略使用步骤与部位展示"],
    recommendationBias: ["主图", "白底图", "核心卖点图", "使用场景图", "操作步骤图", "结构说明图"],
    supplementFocus: ["主打卖点", "目标人群", "适用部位", "结构原理", "尺寸重量", "补充角度图"],
  },
  cleanser: {
    label: "洁面/清洁型护肤品",
    analysisAngles: ["包装识别", "核心成分", "清洁与温和感", "质地/泡沫", "洁面流程场景"],
    decisionFactors: ["清洁力", "温和度", "成分可信度", "肤感想象", "包装质感"],
    mustShow: ["品牌与容量", "核心成分或净颜卖点", "质地或泡沫", "真实洁面语境"],
    avoid: ["把洁面产品当成泛护肤海报", "空泛美白修复承诺", "忽略质地与使用感证据"],
    recommendationBias: ["主图", "白底图", "核心卖点图", "成分功效图", "质地图/泡沫图", "洁面场景图"],
    supplementFocus: ["核心成分", "目标肤质", "主打功效", "质地偏好", "品牌调性", "包装/质地补图"],
  },
  "serum-cream": {
    label: "精华/面霜/乳液/防晒等功效型护肤品",
    analysisAngles: ["包装形态", "功效与成分", "肤感质地", "适用人群", "专业背书感"],
    decisionFactors: ["功效可信度", "成分记忆点", "肤感/吸收想象", "品牌调性", "使用场景"],
    mustShow: ["核心功效", "成分依据", "质地状态", "包装细节", "使用前后或涂抹语境"],
    avoid: ["泛泛而谈护肤高级感", "把多功效混成一句空话", "忽略质地和人群适配"],
    recommendationBias: ["主图", "白底图", "核心卖点图", "成分功效图", "质地图", "护肤场景图"],
    supplementFocus: ["主打功效", "目标肌肤问题", "核心成分", "肤感方向", "品牌语气", "补充包装图"],
  },
  "beauty-makeup": {
    label: "彩妆/香氛/妆效表达型产品",
    analysisAngles: ["包装辨识", "色号或妆效", "质地显色", "人群风格", "场景种草感"],
    decisionFactors: ["显色/妆效", "风格适配", "包装质感", "试色表现", "内容传播感"],
    mustShow: ["包装主体", "色彩或妆效结果", "质地/刷色", "上脸或近景风格氛围"],
    avoid: ["把彩妆写成通用护肤文案", "缺少妆效或试色", "用抽象词替代颜色和风格证据"],
    recommendationBias: ["主图", "白底图", "核心卖点图", "质地试色图", "妆效场景图", "细节特写图"],
    supplementFocus: ["色号/款式", "妆效风格", "目标人群", "显色偏好", "模特气质", "补充试色参考图"],
  },
  "supplement-health": {
    label: "保健品/营养补充剂",
    analysisAngles: ["包装形态", "核心成分", "服用方式", "目标人群", "合规表达"],
    decisionFactors: ["可信度", "核心功效记忆点", "规格与剂型", "服用场景", "避免夸大承诺"],
    mustShow: ["瓶身/盒装信息", "成分卖点", "剂型/规格", "服用场景", "人群适配"],
    avoid: ["医疗化夸张表述", "功效承诺过满", "忽略剂型和服用方式"],
    recommendationBias: ["主图", "白底图", "核心卖点图", "成分说明图", "服用场景图"],
    supplementFocus: ["主打营养点", "目标人群", "食用方式", "口味或剂型", "是否有合规限制", "补充包装图"],
  },
  "food-beverage": {
    label: "食品/饮料/零食",
    analysisAngles: ["包装与规格", "口味记忆点", "食欲感", "食用场景", "成分/配料信息"],
    decisionFactors: ["看起来好不好吃", "口味是否清楚", "规格价值感", "场景是否诱人"],
    mustShow: ["包装主体", "口味/风味", "食材或冲泡状态", "食用场景", "规格容量"],
    avoid: ["只有包装没有食欲感", "口味描述抽象", "忽略开袋/冲泡/饮用状态"],
    recommendationBias: ["主图", "白底图", "核心卖点图", "口味质地图", "食用场景图"],
    supplementFocus: ["主打口味", "目标人群", "食用场景", "规格/口感", "补充开封或冲泡参考图"],
  },
  "apparel-accessory": {
    label: "服饰/配件",
    analysisAngles: ["版型轮廓", "材质纹理", "穿戴效果", "搭配风格", "尺寸信息"],
    decisionFactors: ["上身效果", "材质高级感", "细节做工", "风格适配", "尺码判断"],
    mustShow: ["正面轮廓", "材质细节", "穿戴状态", "搭配场景", "尺寸/尺码线索"],
    avoid: ["只拍静物不展示穿戴", "材质描述空泛", "忽略版型和细节做工"],
    recommendationBias: ["主图", "白底图", "细节特写", "穿搭场景图", "尺码信息图"],
    supplementFocus: ["尺码信息", "主打风格", "面料卖点", "目标人群", "模特气质", "补充上身图"],
  },
  "digital-gadget": {
    label: "智能设备/清洁电器/数码配件",
    analysisAngles: ["结构接口或清洁部件", "功能亮点", "尺寸便携", "使用场景", "科技感与可信度"],
    decisionFactors: ["功能是否一眼能懂", "接口/按键/部件是否清楚", "适用场景", "外观质感与结构可信度"],
    mustShow: ["主体结构", "接口/按键/滚刷等关键部件", "使用方式", "尺寸比例", "典型场景"],
    avoid: ["只讲氛围不讲功能", "接口或关键结构模糊", "缺少使用场景和结构说明", "把设备写成护肤食品或服饰"],
    recommendationBias: ["主图", "白底图", "功能卖点图", "场景图", "结构细节图", "参数说明图"],
    supplementFocus: ["核心功能", "适用场景", "接口/参数/关键部件", "风格方向", "补充多角度细节图"],
  },
  "home-lifestyle": {
    label: "家居/收纳/生活方式用品",
    analysisAngles: ["材质结构", "尺寸占地", "收纳或使用场景", "搭配风格", "细节做工"],
    decisionFactors: ["是否实用", "是否好看好搭", "尺寸是否清楚", "场景代入是否成立"],
    mustShow: ["主体结构", "材质质感", "空间关系", "使用场景", "细节做工"],
    avoid: ["只有单物静物图", "看不出大小和使用方式", "氛围过强抢掉主体"],
    recommendationBias: ["主图", "白底图", "卖点图", "场景图", "尺寸图"],
    supplementFocus: ["使用场景", "空间风格", "尺寸参数", "材质卖点", "补充侧面或细节图"],
  },
  general: {
    label: "通用商品",
    analysisAngles: ["主体外观", "核心卖点", "使用方式", "平台任务", "信任感建立"],
    decisionFactors: ["是否一眼看懂", "卖点是否清楚", "使用场景是否可信", "平台是否适配"],
    mustShow: ["主体外观", "核心卖点", "使用关系", "细节证据", "平台必需图"],
    avoid: ["套用通用模板", "凑数式推荐图型", "无证据地夸大卖点"],
    recommendationBias: ["主图", "白底图", "卖点图", "场景图", "细节图"],
    supplementFocus: ["主打卖点", "目标人群", "风格方向", "场景信息", "补充角度图"],
  },
};

const RECOMMENDED_TYPE_INFO_HINTS: Record<string, string[]> = {
  hero_multi: ["品牌识别与主打卖点", "主体外观是否完整", "首屏需要先讲什么"],
  white_bg: ["包装/机身标准外观", "颜色与材质真实还原", "规格容量或主体比例"],
  selling_points: ["最强卖点排序", "是否有明确证据支撑", "平台详情页需要解决的疑问"],
  usage_scene: ["目标人群与使用场景", "适用部位或典型使用动作", "氛围与主体谁做主谁做辅"],
  steps: ["操作顺序", "每一步需要展示的动作或结果", "是否需要辅图说明"],
  size_hold: ["尺寸重量参数", "手持或对比参照物", "便携性表达重点"],
  structure: ["结构组成", "原理或功能分区", "不能编造的技术细节"],
  ingredient_story: ["核心成分", "成分与功效的对应关系", "需要避免的空泛护肤话术"],
  texture_demo: ["质地状态", "是否起泡/显色/拉丝", "近景特写要强调什么"],
  lifestyle: ["使用氛围", "搭配场景", "情绪价值和主体卖点如何平衡"],
  detail_highlights: ["细节特写点位", "材质或工艺证据", "哪些局部必须放大"],
  feature_comparison: ["差异化卖点", "需要对比解释的重点", "不能硬造的优势点"],
};

const uniqueStrings = (items: string[]): string[] =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const buildPromptListText = (items: string[]): string =>
  uniqueStrings(items).join("；") || "无";

const inferProductArchetype = (brief: string): EcommerceProductArchetype => {
  const normalized = brief.toLowerCase();

  if (
    /(扫地机器人|扫拖机器人|扫拖一体|扫地机|洗地机|吸尘器|除螨仪|清洁机器人|清洁机|拖地机|基站|滚刷|滚筒洗地|尘盒|水箱|边刷|自动集尘|自动清洗|热风烘干|家电|电器)/.test(
      brief,
    ) ||
    normalized.includes("robot vacuum") ||
    normalized.includes("vacuum") ||
    normalized.includes("cleaning robot")
  ) {
    return "digital-gadget";
  }
  if (
    /(美容仪|按摩仪|理疗|护颈|热敷|艾灸|肩颈|经络|仪器|护理|按摩器|刮痧|热灸|热疗)/.test(
      brief,
    ) ||
    normalized.includes("massager") ||
    normalized.includes("care device")
  ) {
    return "care-device";
  }
  if (/(洁面|洗面奶|洁颜|净颜|卸妆|洁肤|清洁泥膜|泡沫洁面)/.test(brief)) {
    return "cleanser";
  }
  if (
    /(精华|面霜|乳液|喷雾|面膜|防晒|爽肤水|化妆水|眼霜|精油|护手霜|次抛|原液|冻干|修护霜)/.test(
      brief,
    )
  ) {
    return "serum-cream";
  }
  if (
    /(口红|唇釉|粉底|气垫|眼影|睫毛膏|腮红|眉笔|彩妆|香水|高光|修容|遮瑕|妆前|定妆)/.test(
      brief,
    )
  ) {
    return "beauty-makeup";
  }
  if (
    /(维生素|益生菌|胶囊|软糖|保健品|膳食|鱼油|叶黄素|蛋白粉|营养补充|营养素|褪黑素|钙片)/.test(
      brief,
    )
  ) {
    return "supplement-health";
  }
  if (
    /(零食|咖啡|茶|饮料|果汁|燕麦|饼干|糖果|坚果|酱|调味|速食|面包|麦片|牛奶|饮品|冲泡)/.test(
      brief,
    )
  ) {
    return "food-beverage";
  }
  if (
    /(衣|裙|裤|鞋|包|帽|项链|耳环|手链|围巾|内衣|家居服|袜|眼镜|手表|外套|衬衫|T恤|服饰)/.test(
      brief,
    )
  ) {
    return "apparel-accessory";
  }
  if (
    /(耳机|音箱|充电|数据线|手机壳|键盘|鼠标|支架|相机|数码|蓝牙|智能|平板壳|充电宝|麦克风)/.test(
      brief,
    )
  ) {
    return "digital-gadget";
  }
  if (/(杯|壶|收纳|香薰|床品|锅|家居|桌面|抱枕|清洁工具|灯|置物|生活用品)/.test(brief)) {
    return "home-lifestyle";
  }

  return "general";
};

const inferCategoryHint = (brief: string) => {
  const archetype = inferProductArchetype(brief);

  if (archetype === "care-device") {
    return "care-device";
  }
  if (
    archetype === "cleanser" ||
    archetype === "serum-cream" ||
    archetype === "beauty-makeup"
  ) {
    return "beauty";
  }
  if (archetype === "home-lifestyle") {
    return "home";
  }

  return "general";
};

const getPlatformModeLabel = (
  mode: EcommercePlatformMode | undefined,
): string => {
  switch (mode) {
    case "taobao":
      return "淘宝/天猫";
    case "jd":
      return "京东";
    case "pdd":
      return "拼多多";
    case "douyin":
      return "抖音电商";
    case "xiaohongshu":
      return "小红书";
    case "amazon":
      return "亚马逊";
    default:
      return "通用电商";
  }
};

const getWorkflowModeLabel = (
  mode: EcommerceWorkflowMode | undefined,
): string => (mode === "quick" ? "快速模式" : "专业模式");

const buildPlatformRequirementText = (
  platformMode: EcommercePlatformMode | undefined,
): string => {
  switch (platformMode) {
    case "taobao":
      return "优先满足主图点击率、白底图规范、详情页卖点承接和转化链路完整性。";
    case "jd":
      return "优先满足白底规范、结构清晰、卖点直给、参数表达明确。";
    case "pdd":
      return "优先突出强卖点、直接利益点、首屏抓眼能力和低门槛理解。";
    case "douyin":
      return "优先考虑封面抓眼、场景带入、短内容传播感和停留率。";
    case "xiaohongshu":
      return "优先考虑种草感、生活方式表达、真实场景和分享感。";
    case "amazon":
      return "优先考虑主图规范、白底、功能卖点、尺寸信息和合规表达。";
    default:
      return "兼顾平台规范、点击率、详情页转化和内容可读性。";
  }
};

const buildArchetypePromptContext = (brief: string): string => {
  const archetype = inferProductArchetype(brief);
  const guide = PRODUCT_ARCHETYPE_GUIDES[archetype];
  const isDeviceLike =
    archetype === "digital-gadget" || archetype === "care-device";

  return [
    `推断商品细分类型：${guide.label}`,
    `优先分析维度：${buildPromptListText(guide.analysisAngles)}`,
    `购买决策关注点：${buildPromptListText(guide.decisionFactors)}`,
    `必须展示或说明的证据点：${buildPromptListText(guide.mustShow)}`,
    `应避免的误判或低质量写法：${buildPromptListText(guide.avoid)}`,
    `更可能成立的图型方向：${buildPromptListText(guide.recommendationBias)}`,
    `补充提问优先补足：${buildPromptListText(guide.supplementFocus)}`,
    isDeviceLike
      ? "设备类额外约束：必须围绕整机结构、关键部件、使用动作、功能逻辑和真实场景来规划，禁止写成护肤、彩妆、食品、服饰或保健品。"
      : "跨品类约束：禁止套用其他商品品类的话术和镜头逻辑。",
  ].join("\n");
};

const buildPlanGroundingPromptContext = ({
  brief,
  supplementSummary,
  imageAnalyses,
}: {
  brief?: string;
  supplementSummary?: string;
  imageAnalyses?: Array<{
    title?: string;
    description?: string;
    analysisConclusion?: string;
  }>;
}): string => {
  const snippets = extractPlanGroundingAnchors({
    brief,
    supplementSummary,
    imageAnalyses,
  }).slice(0, 6);

  return [
    "强相关约束：",
    "1. 方案必须和当前商品属于同一品类，不得跨品类套模板。",
    "2. 必须尽量复用当前商品可见的识别锚点，例如品牌、型号、结构部件、使用对象、典型动作、关键卖点。",
    `3. 当前商品识别锚点：${snippets.join("；") || "无"}`,
    "4. 如果当前商品更像设备/家电/机器人，禁止写成护肤、彩妆、食品、服饰或保健品。",
    "5. 任何组摘要、方案描述、规划草稿，只要换成另一类商品也能成立，就视为无效方案。",
  ].join("\n");
};

const getBriefSubjectLabel = (brief: string, fallback: string): string => {
  const normalized = brief
    .replace(/[【】\[\]()（）]/g, " ")
    .split(/[\n，。,；;、|]/)
    .map((segment) => segment.trim())
    .find((segment) => segment.length >= 2);

  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, 18);
};

const getImageSlotHint = (
  index: number,
  total: number,
): {
  slotLabel: string;
  titleHint: string;
  angleHint: string;
  likelyTasks: string[];
  focus: string[];
  referencePriority: "high" | "medium" | "low";
  likelyReference: boolean;
} => {
  if (index === 0) {
    return {
      slotLabel: "主视图",
      titleHint: "正面主视图",
      angleHint: "正面",
      likelyTasks: ["主图展示", "白底主体图", "核心卖点图"],
      focus: ["主体比例", "正面识别信息", "整体轮廓"],
      referencePriority: "high",
      likelyReference: true,
    };
  }

  if (index === 1) {
    return {
      slotLabel: "补角图",
      titleHint: "45度侧前视图",
      angleHint: "45度侧前视角",
      likelyTasks: ["45度补角图", "结构说明图", "主体补充图"],
      focus: ["侧边结构", "立体层次", "机身转折细节"],
      referencePriority: "medium",
      likelyReference: total <= 2,
    };
  }

  if (index === 2) {
    return {
      slotLabel: "细节图",
      titleHint: "局部细节特写",
      angleHint: "顶部/接口/按键",
      likelyTasks: ["细节展示图", "卖点说明图", "材质补充图"],
      focus: ["局部结构细节", "材质质感", "关键部件"],
      referencePriority: "low",
      likelyReference: false,
    };
  }

  if (index === 3) {
    return {
      slotLabel: "场景图",
      titleHint: "使用场景展示",
      angleHint: "环境/桌面/空间",
      likelyTasks: ["场景展示图", "氛围表达图", "生活化补充图"],
      focus: ["环境氛围", "空间尺度", "使用情境"],
      referencePriority: "low",
      likelyReference: false,
    };
  }

  return {
    slotLabel: "补充图",
    titleHint: `补充角度 ${index + 1}`,
    angleHint: "补充视角",
    likelyTasks: ["补充展示图", "信息补强图", "构图备用图"],
    focus: ["新增结构信息", "新增材质线索", "新增场景信息"],
    referencePriority: "low",
    likelyReference: false,
  };
};

const buildImageAnalysisPromptContext = (
  brief: string,
  index: number,
  total: number,
  platformMode?: EcommercePlatformMode,
  workflowMode?: EcommerceWorkflowMode,
  supplementSummary?: string,
): string => {
  const archetype = inferProductArchetype(brief);
  const guide = PRODUCT_ARCHETYPE_GUIDES[archetype];
  const slotHint = getImageSlotHint(index, total);

  return [
    `推断商品细分类：${guide.label}`,
    `当前目标平台：${getPlatformModeLabel(platformMode)}`,
    `当前工作模式：${getWorkflowModeLabel(workflowMode)}`,
    `用户说明：${brief || "无"}`,
    `补充信息摘要：${supplementSummary || "无"}`,
    `当前是第 ${index + 1} / ${total} 张商品图，按上传顺序更像「${slotHint.slotLabel}」`,
    `这一张图优先承担：${buildPromptListText(slotHint.likelyTasks)}`,
    `这一张图重点检查：${buildPromptListText(slotHint.focus)}`,
    `该细分类最该看：${buildPromptListText(guide.analysisAngles)}`,
    `该细分类必须看到的证据：${buildPromptListText(guide.mustShow)}`,
    `该细分类购买决策关注：${buildPromptListText(guide.decisionFactors)}`,
    `禁止写法：${buildPromptListText(guide.avoid)}`,
  ].join("\n");
};

const buildImageAnalysisFallbackTitle = (
  brief: string,
  index: number,
): string => {
  const archetype = inferProductArchetype(brief);
  const subject = getBriefSubjectLabel(
    brief,
    PRODUCT_ARCHETYPE_GUIDES[archetype].label,
  );
  const slotHint = getImageSlotHint(index, Number.MAX_SAFE_INTEGER);
  return `${subject}${slotHint.titleHint}`;
};

const normalizeAnalysisFingerprint = (value?: string | null): string =>
  String(value || "")
    .replace(/\s+/g, "")
    .replace(/[，。、“”"'‘’；：！？,.!?;:()（）【】\[\]-]/g, "")
    .trim();

const looksLikeWeakImageAnalysisText = (value?: string | null): boolean => {
  const text = String(value || "").trim();
  if (!text) {
    return true;
  }
  if (text.length < 42) {
    return true;
  }
  return /(主体清晰|结构完整|补充角度|帮助后续|更稳定|适合作为.*参考图|保持主体一致性)/.test(
    text,
  );
};

const looksLikeWeakRecommendedTypeText = (
  value?: string | null,
  minLength = 20,
): boolean => {
  const text = String(value || "").trim();
  if (!text) {
    return true;
  }
  if (text.length < minLength) {
    return true;
  }
  return /(适合.*展示|适合.*详情页|帮助用户更好了解|用于展示|提升转化|增强吸引力|围绕.*生成|突出商品主体|适合当前商品|补充展示信息)/.test(
    text,
  );
};

const areWeakRecommendedHighlights = (values?: string[] | null): boolean => {
  const items = (values || []).map((item) => String(item || "").trim()).filter(Boolean);
  if (items.length < 2) {
    return true;
  }
  const weakCount = items.filter(
    (item) =>
      item.length < 3 ||
      /(主体|细节|卖点|场景|氛围|展示|信息|质感|结构)/.test(item),
  ).length;
  return weakCount >= items.length;
};

const areWeakRecommendedEvidence = (values?: string[] | null): boolean => {
  const items = (values || []).map((item) => String(item || "").trim()).filter(Boolean);
  if (items.length < 1) {
    return true;
  }
  return items.every(
    (item) =>
      item.length < 8 ||
      /(适合|可以|有助于|更容易|更适合|能提升|用户会看)/.test(item),
  );
};

const enrichImageAnalysesWithFallback = (
  items: EcommerceImageAnalysis[],
  fallback: EcommerceImageAnalysis[],
): EcommerceImageAnalysis[] => {
  return items.map((item, index) => {
    const fallbackItem = fallback[index];
    const shouldUseFallbackTitle =
      !item.title ||
      /^商品图\s*\d+$/u.test(item.title.trim()) ||
      !hasChineseText(item.title);
    const shouldUseFallbackDescription =
      !hasChineseText(item.description) ||
      String(item.description || "").trim().length < 24;
    const usedFallback =
      item.source === "fallback" ||
      shouldUseFallbackTitle ||
      shouldUseFallbackDescription;

    return {
      ...item,
      title: shouldUseFallbackTitle ? fallbackItem.title : item.title,
      description: shouldUseFallbackDescription
        ? fallbackItem.description
        : item.description,
      angle: item.angle,
      highlights: item.highlights || [],
      materials: item.materials || [],
      evidence: item.evidence || [],
      source: item.source === "fallback" ? "fallback" : "ai",
      usedFallback,
      fallbackReason:
        item.source === "fallback"
          ? item.fallbackReason || "单图分析未返回可用结构，当前展示的是兜底结果。"
          : usedFallback
            ? "单图分析缺少关键文本内容，当前仅补齐了必要字段。"
            : undefined,
    };
  });
};

const buildSelectedTypeNeedText = (
  items: Array<{ id: string; title: string; selected: boolean }>,
): string => buildSelectedTypePrincipleNeedText(items);

const buildSelectedTypeSummaryText = (
  items: Array<{ id: string; title: string; selected: boolean }>,
): string => buildSelectedTypePrincipleSummaryText(items);

const hasChineseText = (value?: string | null): boolean =>
  /[\u4e00-\u9fff]/.test(String(value || ""));

const normalizeKnownEcommerceText = (value?: string | null): string => {
  const source = String(value || "").trim();
  if (!source) return "";

  return ([
    [/Main Image/gi, "主图"],
    [/Detail Highlights/gi, "细节特写"],
    [/Lifestyle Scene/gi, "场景图"],
    [/Feature Comparison/gi, "差异卖点图"],
    [/Target Platform/gi, "目标平台"],
    [/Brand Tone/gi, "品牌调性"],
    [/Must-show selling points/gi, "必展卖点"],
    [/Clean hero shot for the listing thumbnail\./gi, "用于商品列表首图的干净主视觉图。"],
    [/Close-ups that explain craftsmanship and quality\./gi, "用特写展示材质、做工与品质细节。"],
    [/Scene-based composition for use-case storytelling\./gi, "用场景化构图呈现使用情境与代入感。"],
    [/One card focused on the strongest differentiator\./gi, "聚焦最强差异卖点的单张说明图。"],
    [/Planned frame/gi, "方案分镜"],
    [/Focus on/gi, "聚焦"],
    [/keep product consistency/gi, "保持商品主体一致性"],
    [/\bAmazon\b/gi, "亚马逊"],
    [/\bPremium\b/gi, "高级质感"],
    [/\bMinimal\b/gi, "极简"],
    [/\bOutdoor\b/gi, "户外"],
    [/\bYouthful\b/gi, "年轻活力"],
    [/\bTechnical\b/gi, "科技理性"],
    [/\bdetail page\b/gi, "详情页"],
    [/\bsocial\b/gi, "社媒"],
    [/\bads\b/gi, "广告投放"],
    [/\bshop\b/gi, "店铺"],
  ] as Array<[RegExp, string]>).reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    source,
  );
};

const ensureChineseUiText = (
  value: string | null | undefined,
  fallback: string,
): string => {
  const normalized = normalizeKnownEcommerceText(value);
  return hasChineseText(normalized) ? normalized : fallback;
};

const normalizeUiStringList = (
  values: Array<string | null | undefined> | undefined,
  fallbackFactory?: (index: number) => string,
): string[] =>
  (values || [])
    .map((value, index) =>
      ensureChineseUiText(value, fallbackFactory?.(index) || `补充信息 ${index + 1}`),
    )
    .filter((value) => value.trim().length > 0);

const RECOMMENDED_TYPE_TITLE_FALLBACKS: Record<string, string> = {
  hero_multi: "商品主图（多角度轮播）",
  white_bg: "白底标准图",
  selling_points: "核心卖点图",
  usage_scene: "使用场景图",
  steps: "操作步骤图",
  size_hold: "尺寸握持图",
  structure: "结构说明图",
  ingredient_story: "成分功效图",
  texture_demo: "质地展示图",
  lifestyle: "氛围生活方式图",
  main_image: "主图",
  detail_highlights: "细节特写",
  lifestyle_scene: "场景图",
  feature_comparison: "差异卖点图",
};

const RECOMMENDED_TYPE_DESCRIPTION_FALLBACKS: Record<string, string> = {
  hero_multi: "用于首屏主视觉与轮播承接的核心展示图，优先建立第一眼点击和商品认知。",
  white_bg: "用于平台规范展示的标准白底图，重点保证主体外观、颜色和比例真实清晰。",
  selling_points: "围绕当前商品最值得成交的卖点，快速建立理解与购买理由。",
  usage_scene: "通过使用状态或适用场景展示商品在真实环境中的价值与代入感。",
  steps: "通过连续步骤说明使用方式、操作流程或效果承接，降低理解门槛。",
  size_hold: "通过尺寸、握持或参照物对比，帮助用户快速建立大小感知。",
  structure: "通过结构拆解或分区说明，让用户更清楚理解组成与功能关系。",
  ingredient_story: "用于解释成分、配方或核心材料的价值，提升专业感与信任度。",
  texture_demo: "通过质地、纹理、泡沫、显色等细节展示真实感受与使用预期。",
  lifestyle: "通过氛围化构图增强生活方式联想与情绪价值表达。",
  main_image: "用于商品列表首图的主视觉图，优先建立第一眼点击与产品认知。",
  detail_highlights: "通过细节特写展示材质、做工与品质信息，提升信任感。",
  lifestyle_scene: "用场景化构图展示使用情境与生活方式代入感。",
  feature_comparison: "聚焦最强差异卖点，用单张图快速讲清优势。",
};

const RECOMMENDED_TYPE_ID_ALIASES: Record<string, string> = {
  heromulti: "hero_multi",
  heroimage: "hero_multi",
  hero: "hero_multi",
  mainimage: "hero_multi",
  producthero: "hero_multi",
  whitebg: "white_bg",
  whitebackground: "white_bg",
  whiteimage: "white_bg",
  sellingpoint: "selling_points",
  sellingpoints: "selling_points",
  usagescene: "usage_scene",
  sceneusage: "usage_scene",
  step: "steps",
  steps: "steps",
  sizehold: "size_hold",
  size: "size_hold",
  holdsize: "size_hold",
  structurenotes: "structure",
  structuredetail: "structure",
  structure: "structure",
  ingredientstory: "ingredient_story",
  ingredient: "ingredient_story",
  ingredients: "ingredient_story",
  texturedemo: "texture_demo",
  texture: "texture_demo",
  lifestyle: "lifestyle",
  lifestylescene: "lifestyle",
  detailhighlight: "detail_highlights",
  detailhighlights: "detail_highlights",
  details: "detail_highlights",
  featurecompare: "feature_comparison",
  featurecomparison: "feature_comparison",
  comparison: "feature_comparison",
  compare: "feature_comparison",
};

const normalizeRecommendedTypeLookupKey = (value: string): string =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-（）()【】\[\]·,，.、/]+/g, "");

const resolveRecommendedTypeId = (
  rawId: string,
  title?: string,
): string => {
  const directId = String(rawId || "").trim();
  if (directId && RECOMMENDED_TYPE_TITLE_FALLBACKS[directId]) {
    return directId;
  }

  const aliasId = RECOMMENDED_TYPE_ID_ALIASES[
    normalizeRecommendedTypeLookupKey(directId)
  ];
  if (aliasId) {
    return aliasId;
  }

  const normalizedTitle = normalizeKnownEcommerceText(title || "").replace(
    /\s+/g,
    "",
  );
  if (!normalizedTitle) {
    return directId;
  }

  if (/主图|首图|轮播/.test(normalizedTitle)) {
    return "hero_multi";
  }
  if (/白底/.test(normalizedTitle)) {
    return "white_bg";
  }
  if (/卖点/.test(normalizedTitle)) {
    return "selling_points";
  }
  if (/步骤|流程|使用方法/.test(normalizedTitle)) {
    return "steps";
  }
  if (/尺寸|手持|握持|大小/.test(normalizedTitle)) {
    return "size_hold";
  }
  if (/结构|拆解|部位|原理/.test(normalizedTitle)) {
    return "structure";
  }
  if (/成分|配方/.test(normalizedTitle)) {
    return "ingredient_story";
  }
  if (/质地|纹理|泡沫|膏体|显色/.test(normalizedTitle)) {
    return "texture_demo";
  }
  if (/细节|特写|工艺|局部/.test(normalizedTitle)) {
    return "detail_highlights";
  }
  if (/差异|对比|比较/.test(normalizedTitle)) {
    return "feature_comparison";
  }
  if (/生活方式|氛围|搭配/.test(normalizedTitle)) {
    return "lifestyle";
  }
  if (/场景|使用|适用/.test(normalizedTitle)) {
    return "usage_scene";
  }

  return directId;
};

type CommercialDesignPrincipleProfile = {
  imageRole: EcommerceImageRole;
  informationGoal: string;
  evidenceGoal: string;
  businessGoal: string;
  whitespaceRule: string;
  layoutMode: EcommerceLayoutMode;
  componentNeed: EcommerceComponentNeed;
  reservedAreas: EcommerceLayoutAreaKind[];
  contentDensity: "low" | "medium" | "high";
  questionFocus: string[];
};

const DEFAULT_DESIGN_PRINCIPLE_PROFILE: CommercialDesignPrincipleProfile = {
  imageRole: "hero",
  informationGoal: "建立第一眼识别，并交代这件商品最值得优先理解的价值。",
  evidenceGoal: "优先证明商品主体、关键结构锚点和最核心的购买理由。",
  businessGoal: "让用户快速看懂商品是什么、值在哪里，并愿意继续往下浏览。",
  whitespaceRule: "至少保留一个稳定标题区，主体不能把信息区全部占满。",
  layoutMode: "center-focus-with-edge-space",
  componentNeed: "text-and-icons",
  reservedAreas: ["headline", "icons"],
  contentDensity: "medium",
  questionFocus: [
    "这张图最先要证明哪个购买理由",
    "哪些识别锚点绝不能被遮挡或改写",
    "后续准备叠加标题、图标还是参数说明",
  ],
};

const DESIGN_PRINCIPLE_PROFILES: Partial<
  Record<string, CommercialDesignPrincipleProfile>
> = {
  hero_multi: {
    imageRole: "hero",
    informationGoal: "建立第一印象与品牌感，让用户一眼认出主体并知道主打价值。",
    evidenceGoal: "证明主体外观、品牌识别锚点、主卖点入口和可信质感。",
    businessGoal: "承担首屏点击与浏览承接任务，像详情页第一屏而不是普通产品照。",
    whitespaceRule: "保留强标题区和少量摘要区，背景克制，主体保持统治力。",
    layoutMode: "left-copy",
    componentNeed: "text-and-icons",
    reservedAreas: ["headline", "subheadline", "icons", "body"],
    contentDensity: "medium",
    questionFocus: [
      "首屏应该先讲品牌感、核心卖点还是新品定位",
      "哪几个外观锚点必须稳定出现",
      "文案区更适合横向标题还是纵向信息带",
    ],
  },
  main_image: {
    imageRole: "hero",
    informationGoal: "建立主视觉认知并承担列表点击与详情页首屏承接。",
    evidenceGoal: "证明完整主体、轮廓比例和最强第一卖点。",
    businessGoal: "把商品稳稳立住，不能被氛围和道具抢走主位。",
    whitespaceRule: "主体之外至少要留一个可放标题或卖点短句的清洁区域。",
    layoutMode: "left-copy",
    componentNeed: "text-and-icons",
    reservedAreas: ["headline", "subheadline", "icons", "body"],
    contentDensity: "medium",
    questionFocus: [
      "主图最先要打哪一个价值点",
      "哪些结构/颜色关系最能代表这件商品",
      "首图更偏平台主图还是详情页首屏",
    ],
  },
  white_bg: {
    imageRole: "hero",
    informationGoal: "完成平台标准展示，让主体边缘、比例、颜色与规格识别可信。",
    evidenceGoal: "证明外观真实性、结构完整度和平台合规性。",
    businessGoal: "承担标准商品展示，优先消除用户对外观和规格的误判。",
    whitespaceRule: "白底干净均匀，不做伪高级杂色阴影；留白服务识别与审核。",
    layoutMode: "top-banner",
    componentNeed: "text-only",
    reservedAreas: ["headline", "subheadline"],
    contentDensity: "low",
    questionFocus: [
      "标准图需要保留哪些正面/侧面识别信息",
      "是否有容量、规格或配件必须同屏说明",
      "平台对背景、比例或边缘展示有没有硬约束",
    ],
  },
  selling_points: {
    imageRole: "selling-point",
    informationGoal: "单张图只讲一个核心卖点，并把抽象利益转成可见证据。",
    evidenceGoal: "证明卖点对应的结构、功能结果或使用收益，而不是只喊口号。",
    businessGoal: "承担说服任务，回答“为什么值得买”。",
    whitespaceRule: "主视觉区与说明区分离，给标题、图标或数字留出清晰阅读路径。",
    layoutMode: "split-info",
    componentNeed: "text-and-icons",
    reservedAreas: ["headline", "icons", "body"],
    contentDensity: "medium",
    questionFocus: [
      "当前最应该优先证明的卖点是什么",
      "这个卖点最有说服力的视觉证据是什么",
      "哪些信息必须拆开成多张图而不能挤在一张里",
    ],
  },
  feature_comparison: {
    imageRole: "comparison",
    informationGoal: "建立差异化认知，让用户清楚看到你优于常见替代方案的地方。",
    evidenceGoal: "证明比较维度、优势结果和可视化对照依据。",
    businessGoal: "承担对比说服任务，回答“为什么选你而不是别人”。",
    whitespaceRule: "必须预留对比区与主体区，避免把对比信息挤成杂乱海报。",
    layoutMode: "split-info",
    componentNeed: "comparison-heavy",
    reservedAreas: ["headline", "comparison", "body"],
    contentDensity: "high",
    questionFocus: [
      "要和什么对象或旧方案比较",
      "比较维度是性能、结构、体验还是效率",
      "哪些优势可以视觉化证明，哪些不能硬造",
    ],
  },
  detail_highlights: {
    imageRole: "detail",
    informationGoal: "放大一个局部证据，让用户相信品质、做工或材质真的更好。",
    evidenceGoal: "证明纹理、接缝、表面工艺、结构边界或部件细节。",
    businessGoal: "承担信任建立任务，让用户知道贵在哪里、好在哪里。",
    whitespaceRule: "背景与辅助元素极简，注意力集中到一个明确证据点。",
    layoutMode: "bottom-panel",
    componentNeed: "text-only",
    reservedAreas: ["headline", "subheadline"],
    contentDensity: "low",
    questionFocus: [
      "最值得放大的细节点位是哪里",
      "这个局部到底要证明材质、做工还是结构精度",
      "是否需要保留局部与整机的对应关系",
    ],
  },
  texture_demo: {
    imageRole: "detail",
    informationGoal: "呈现真实质地、显色、泡沫、拉丝或纹理触感，建立使用预期。",
    evidenceGoal: "证明质地状态和近景可感知细节。",
    businessGoal: "承担感知预期建立任务，避免用户对使用体验想象失真。",
    whitespaceRule: "以主体或质地证据为唯一主角，信息只做轻量点题。",
    layoutMode: "bottom-panel",
    componentNeed: "text-only",
    reservedAreas: ["headline", "subheadline"],
    contentDensity: "low",
    questionFocus: [
      "用户最关心哪一种真实触感或状态",
      "需要展示的是起泡、显色、拉丝还是表面纹理",
      "是否需要补充局部放大而非整图描述",
    ],
  },
  usage_scene: {
    imageRole: "scene",
    informationGoal: "证明商品在真实场景中的使用语境与价值，而不是拍一张泛生活照。",
    evidenceGoal: "证明使用动作、空间关系、适用对象与场景可信度。",
    businessGoal: "承担场景代入和生活方式说服任务。",
    whitespaceRule: "场景要服务商品，仍需预留可放标题或短卖点的清洁区域。",
    layoutMode: "right-copy",
    componentNeed: "text-and-icons",
    reservedAreas: ["headline", "subheadline", "icons", "body"],
    contentDensity: "medium",
    questionFocus: [
      "最真实、最能转化的使用场景是什么",
      "场景里谁是主角、谁只能做辅助",
      "哪些道具或动作能证明价值，哪些会抢掉主体",
    ],
  },
  lifestyle: {
    imageRole: "scene",
    informationGoal: "建立品牌调性与生活方式联想，但仍保持商品识别与商业可用性。",
    evidenceGoal: "证明商品与环境、材质、道具的调性匹配，而不是脱离商品乱造氛围。",
    businessGoal: "承担品牌调性强化与种草任务。",
    whitespaceRule: "氛围不能塞满画面，要给主标题或情绪短句留出呼吸区。",
    layoutMode: "left-copy",
    componentNeed: "text-and-icons",
    reservedAreas: ["headline", "subheadline", "body"],
    contentDensity: "medium",
    questionFocus: [
      "这张图更偏品牌感还是偏实际使用语境",
      "环境材质和色调应该服务哪种品牌气质",
      "如何在氛围表达里仍稳住主体识别",
    ],
  },
  size_hold: {
    imageRole: "parameter",
    informationGoal: "建立大小、重量、便携或握持感知，降低尺寸误判。",
    evidenceGoal: "证明比例关系、参照物关系和关键数字信息的落点。",
    businessGoal: "承担参数理解与决策安心任务。",
    whitespaceRule: "主体与参数区必须可分离，适合放数字、尺寸线或说明卡片。",
    layoutMode: "split-info",
    componentNeed: "text-and-stats",
    reservedAreas: ["headline", "stats", "body"],
    contentDensity: "high",
    questionFocus: [
      "用户最容易误判哪一个尺寸或重量信息",
      "适合用手持、桌面对比还是参照物展示",
      "哪些数字必须明确，哪些可以留给后续排版补充",
    ],
  },
  structure: {
    imageRole: "structure",
    informationGoal: "解释结构组成、分区关系、功能原理或关键部件逻辑。",
    evidenceGoal: "证明部件位置、功能关系、接口路径与说明重点。",
    businessGoal: "承担理解教育任务，让用户更快看懂商品怎么工作。",
    whitespaceRule: "四周或一侧必须留出标注与说明位置，主体与标注区不能打架。",
    layoutMode: "center-focus-with-edge-space",
    componentNeed: "annotation-heavy",
    reservedAreas: ["headline", "annotation", "body"],
    contentDensity: "high",
    questionFocus: [
      "哪些部件或功能关系必须被解释清楚",
      "哪些技术细节不能编造只能按可见事实表达",
      "说明更适合分区标注、拆解还是局部放大",
    ],
  },
  steps: {
    imageRole: "summary",
    informationGoal: "降低理解门槛，让用户明白使用流程、顺序和结果承接。",
    evidenceGoal: "证明操作动作、前后顺序和步骤结果。",
    businessGoal: "承担使用教育与顾虑消除任务。",
    whitespaceRule: "必须保留步骤说明与序号区，不能只有漂亮画面没有流程承载能力。",
    layoutMode: "bottom-panel",
    componentNeed: "annotation-heavy",
    reservedAreas: ["headline", "annotation", "body"],
    contentDensity: "high",
    questionFocus: [
      "真正影响理解的关键步骤是哪几步",
      "哪些动作需要分开讲，哪些可以并到一张图里",
      "用户更需要看到过程、结果还是注意事项",
    ],
  },
  ingredient_story: {
    imageRole: "parameter",
    informationGoal: "解释成分、配方、原料或技术依据，建立专业感与可信度。",
    evidenceGoal: "证明核心成分/材料与对应作用的关系，避免空泛功效词。",
    businessGoal: "承担专业说服和信任建立任务。",
    whitespaceRule: "商品和说明区都要清楚，给成分卡、功效点或说明短句保留秩序化区域。",
    layoutMode: "split-info",
    componentNeed: "text-and-stats",
    reservedAreas: ["headline", "stats", "body"],
    contentDensity: "high",
    questionFocus: [
      "最值得解释的成分或核心材料是什么",
      "成分与功效之间哪些关系可以直接表达",
      "哪些说法属于高风险夸大，必须避免",
    ],
  },
};

const getDesignPrincipleProfile = (
  rawTypeId: string,
  typeTitle?: string,
  planTitle?: string,
): CommercialDesignPrincipleProfile => {
  const resolvedTypeId = resolveRecommendedTypeId(
    rawTypeId,
    typeTitle || planTitle,
  );
  return (
    DESIGN_PRINCIPLE_PROFILES[resolvedTypeId] || DEFAULT_DESIGN_PRINCIPLE_PROFILE
  );
};

const buildDesignPrincipleChecklist = (): string =>
  [
    "1. 先定义单图商业任务，再决定镜头、构图和氛围，禁止先堆画面再找说法。",
    "2. 每张图只承担一个主证明任务，卖点、参数、结构、对比、场景不要混成一张万能海报。",
    "3. 主体识别锚点优先于风格修饰，轮廓、关键部件、主色关系、品牌识别必须稳定。",
    "4. 信息层级必须可扫描，标题区、证据区、参数区、标注区要有明确主次和阅读路径。",
    "5. 留白不是浪费，而是后续标题、数字、图标、对比卡和标注的版式资源。",
    "6. 场景和氛围只能证明语境，不能抢走商品主位，更不能把商品拍成另一类产品。",
    "7. 结构、参数、对比类图片必须先考虑信息承载能力，而不是先追求大片感。",
  ].join("\n");

const buildSelectedTypePrincipleSummaryText = (
  items: Array<{ id: string; title: string; selected: boolean }>,
): string =>
  items
    .filter((item) => item.selected)
    .map((item) => {
      const profile = getDesignPrincipleProfile(item.id, item.title);
      return `${item.title}（职责：${profile.businessGoal}；主证明任务：${profile.evidenceGoal}；信息密度：${profile.contentDensity}；推荐留白：${profile.layoutMode} / ${profile.reservedAreas.join("、")}）`;
    })
    .join("；") || "无";

const buildSelectedTypePrincipleNeedText = (
  items: Array<{ id: string; title: string; selected: boolean }>,
): string =>
  buildPromptListText(
    items
      .filter((item) => item.selected)
      .flatMap((item) => getDesignPrincipleProfile(item.id, item.title).questionFocus),
  );

const buildTypeRequirementPrincipleText = (
  typeItem: { id: string; title: string; imageCount: number },
): string => {
  const profile = getDesignPrincipleProfile(typeItem.id, typeItem.title);
  const targetCount = getPlanGroupTargetItemCount(typeItem.id, typeItem.imageCount);
  return [
    `- ${typeItem.title}（${typeItem.id}）：目标不少于 ${targetCount} 张`,
    `商业职责：${profile.businessGoal}`,
    `信息任务：${profile.informationGoal}`,
    `证据任务：${profile.evidenceGoal}`,
    `版式建议：${profile.layoutMode}，组件需求 ${profile.componentNeed}，优先预留 ${profile.reservedAreas.join("、")}`,
    `留白纪律：${profile.whitespaceRule}`,
  ].join("；");
};

const buildCommercialDesignPrincipleContext = ({
  selectedTypes,
  brief,
  supplementSummary,
}: {
  selectedTypes?: Array<{ id: string; title: string; imageCount: number }>;
  brief?: string;
  supplementSummary?: string;
}): string => {
  const archetype = inferProductArchetype(String(brief || "").trim());
  const guide = PRODUCT_ARCHETYPE_GUIDES[archetype];
  const selectedTypeLines = (selectedTypes || []).map((item) =>
    buildTypeRequirementPrincipleText(item),
  );
  const selectedTypeProofLines = (selectedTypes || []).map((item) =>
    buildTypeSpecificVisualProofHint(item.id, item.title),
  );

  return [
    "详情页设计原理：",
    buildDesignPrincipleChecklist(),
    `当前商品更像：${guide.label}`,
    `这类商品决策最看重：${buildPromptListText(guide.decisionFactors)}`,
    `这类商品最需要被证明：${buildPromptListText(guide.mustShow)}`,
    supplementSummary
      ? `用户补充信息应优先用于约束：${supplementSummary}`
      : "当前暂无额外补充信息，缺口判断必须围绕商品识别、证据表达与版式承载能力展开。",
    selectedTypeLines.length > 0
      ? `已选图型的职责拆解：\n${selectedTypeLines.join("\n")}`
      : "",
    selectedTypeProofLines.length > 0
      ? `已选图型的视觉证据建议：\n${selectedTypeProofLines.join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
};

const buildTypeSpecificVisualProofHint = (
  typeId: string,
  typeTitle: string,
): string => {
  const resolvedTypeId = resolveRecommendedTypeId(typeId, typeTitle);

  switch (resolvedTypeId) {
    case "hero_multi":
    case "main_image":
      return `${typeTitle}：优先用主视觉大特写、45 度体积关系、核心局部证据和清晰标题区来建立第一眼统治力，不要把首图做成信息拼盘。`;
    case "white_bg":
      return `${typeTitle}：优先用标准正面、45 度补角、边缘清晰度、比例与规格可信度来完成合规展示，不靠氛围做说服。`;
    case "selling_points":
      return `${typeTitle}：优先把卖点转成单一证据，如结构透视、功能路径、局部放大、状态前后对比或真实使用动作。`;
    case "feature_comparison":
      return `${typeTitle}：优先用对比区、参数差异、before/after、结构差异点或结果差异来完成说服，而不是只喊“更强”。`;
    case "structure":
      return `${typeTitle}：优先用分区、剖面、爆炸、引线标注、局部放大来解释部件关系和功能逻辑。`;
    case "size_hold":
      return `${typeTitle}：优先用参照物、手持关系、尺寸线和参数卡来证明大小感知，不要只写“轻巧便携”。`;
    case "detail_highlights":
    case "texture_demo":
      return `${typeTitle}：优先用微距、切面、接缝、纹理、材质反射或显色/起泡/拉丝状态来给出可放大的品质证据。`;
    case "usage_scene":
    case "lifestyle":
      return `${typeTitle}：优先用真实动作、空间关系、场景交互和环境材质证明语境成立，同时保持商品仍是主角。`;
    case "steps":
      return `${typeTitle}：优先用步骤顺序、动作切换、结果承接和说明区来降低理解门槛，而不是拍成一张普通场景图。`;
    case "ingredient_story":
      return `${typeTitle}：优先用成分关系、原料特写、剖面示意、参数卡或作用路径来建立专业可信度，避免空泛功效词。`;
    default:
      return `${typeTitle}：优先把抽象卖点转成结构、局部、路径、参数、对比或场景动作等可见证据。`;
  }
};

const buildVisualProofGrammarContext = (brief?: string): string => {
  const archetype = inferProductArchetype(String(brief || "").trim());

  switch (archetype) {
    case "digital-gadget":
    case "care-device":
      return [
        "卖点视觉化原理：",
        "1. 功能类卖点必须尽量转成结构、路径、状态或交互证据，而不是只写“更智能、更强、更高效”。",
        "2. 可优先使用的视觉语法：结构透视、局部爆炸、剖面关系、引线标注、点云扫描、数据流/HUD、风流/水流/热流路径、before/after、操作动作演示。",
        "3. 如果信息不足，不要伪造复杂内部结构；可以改为示意化功能层或外部可见部件的说明式表达。",
      ].join("\n");
    case "cleanser":
    case "serum-cream":
    case "beauty-makeup":
      return [
        "卖点视觉化原理：",
        "1. 护肤彩妆类卖点必须尽量转成质地、渗透、成分关系、肤感结果或局部使用状态，而不是空喊功效。",
        "2. 可优先使用的视觉语法：液滴/精华流动、剖面示意、成分关系、显色/延展/起泡状态、before/after、微观纹理放大。",
        "3. 不要把专业感做成堆素材拼贴，商品主体与关键证据必须保持明确主次。",
      ].join("\n");
    case "food-beverage":
      return [
        "卖点视觉化原理：",
        "1. 食品饮料类卖点必须尽量转成原料、颗粒、切面、冲泡/蒸腾/挂壁状态和真实食欲证据。",
        "2. 可优先使用的视觉语法：原料特写、颗粒放大、液体轨迹、蒸汽状态、切面结构、冲泡路径、口感联想细节。",
        "3. 不要为了戏剧化牺牲主体真实形态，也不要伪造看不见的功能结构。",
      ].join("\n");
    case "apparel-accessory":
      return [
        "卖点视觉化原理：",
        "1. 服饰配件类卖点必须尽量转成版型、垂坠、车线、面料纹理、穿戴关系和搭配语境，而不是只写风格词。",
        "2. 可优先使用的视觉语法：局部车线特写、面料纹理放大、人体动态、搭配环境、尺寸参照、五金/边角/皮面细节。",
        "3. 不要只做静物氛围，也不要为了搭配感把核心产品识别冲淡。",
      ].join("\n");
    default:
      return [
        "卖点视觉化原理：",
        "1. 抽象卖点必须尽量转成可被看到的证据，如结构关系、局部放大、参数承载、路径示意、场景动作或前后对比。",
        "2. 如果某个卖点无法被视觉化证明，说明它不适合做当前单图的主任务，应换成别的图承担。",
      ].join("\n");
  }
};

const buildVisualSystemConsistencyContext = ({
  platformMode,
  selectedTypes,
}: {
  platformMode?: EcommercePlatformMode;
  selectedTypes?: Array<{ id: string; title: string; imageCount: number }>;
}): string => {
  const hasInfoHeavyType = (selectedTypes || []).some((item) =>
    ["size_hold", "structure", "ingredient_story", "feature_comparison", "steps"].includes(
      resolveRecommendedTypeId(item.id, item.title),
    ),
  );

  return [
    "整套视觉系统原则：",
    "1. 全套图必须像同一品牌详情页系统，而不是不同模型随机生成的散图。",
    "2. 至少统一这些维度：主色/辅色/点缀色、背景材质倾向、光比与色温、镜头语言、UI/说明图形语气、精致度等级。",
    platformMode === "amazon"
      ? "3. 亚马逊类平台优先统一为克制、标准、可读、偏信息化的商业系统。"
      : platformMode === "xiaohongshu" || platformMode === "douyin"
        ? "3. 内容平台可保留更强情绪感，但仍要保持统一镜头语言与品牌世界观。"
        : "3. 详情页导向平台优先统一为可排版、可说明、可落地的商业系统。",
    hasInfoHeavyType
      ? "4. 既然当前存在结构/参数/对比类图，全套系统必须兼容说明型模块，不能只会做漂亮主视觉。"
      : "4. 即便当前信息型图较少，也要保证后续扩展成详情页时系统感仍能延续。",
  ].join("\n");
};

const buildPromptDesignPrincipleBlock = ({
  typeTitle,
  planTitle,
  planDescription,
  currentPrompt,
}: {
  typeTitle: string;
  planTitle: string;
  planDescription?: string;
  currentPrompt: string;
}): string => {
  const resolvedTypeId = resolveRecommendedTypeId("", `${typeTitle}${planTitle}`);
  const profile = getDesignPrincipleProfile(resolvedTypeId, typeTitle, planTitle);
  const inferredIntent = inferLayoutIntent({
    typeId: resolvedTypeId,
    typeTitle,
    title: planTitle,
    description: String(planDescription || "").trim(),
    promptOutline: currentPrompt,
  });

  return [
    "设计原理约束：",
    `单图角色：${profile.businessGoal}`,
    `信息任务：${profile.informationGoal}`,
    `证据任务：${profile.evidenceGoal}`,
    "视觉层级：商品主体始终是唯一主角，辅助环境与说明模块只能服务当前任务。",
    `留白纪律：${profile.whitespaceRule}`,
    buildVisualProofGrammarContext(`${typeTitle} ${planTitle}`),
    "系统统一：这一张必须延续整套图统一的主色/辅色、材质倾向、光影色温、镜头语言和说明图形语气。",
    `建议版式：${inferredIntent.layoutMode || profile.layoutMode}`,
    `组件负载：${inferredIntent.componentNeed || profile.componentNeed}`,
    `优先预留：${(inferredIntent.reservedAreas || profile.reservedAreas).join("、")}`,
  ].join("\n");
};

const buildPlanSystemStrategyDefaults = (
  typeId: string,
  typeTitle: string,
  platformMode?: EcommercePlatformMode,
): Array<{ label: string; value: string }> => {
  const profile = getDesignPrincipleProfile(typeId, typeTitle);
  const systemTone =
    platformMode === "amazon"
      ? "克制、标准、信息化"
      : platformMode === "xiaohongshu" || platformMode === "douyin"
        ? "有情绪感但保持品牌统一"
        : "可排版、可说明、可落地";

  return [
    {
      label: "组内分工",
      value: `围绕“${profile.evidenceGoal}”拆分镜头，每张图只承担一个主说明任务，避免同组重复换说法。`,
    },
    {
      label: "系统统一",
      value: `整组 ${typeTitle} 保持同一套主色/辅色、背景材质、光影色温与镜头语言，整体气质偏 ${systemTone}。`,
    },
  ];
};

const buildPlanItemPrincipleDefaults = ({
  typeId,
  typeTitle,
  title,
  description,
}: {
  typeId: string;
  typeTitle: string;
  title: string;
  description: string;
}) => {
  const profile = getDesignPrincipleProfile(typeId, typeTitle, title);
  const layoutIntent = inferLayoutIntent({
    typeId,
    typeTitle,
    title,
    description,
    promptOutline: description,
  });
  const reservedAreas = layoutIntent.reservedAreas || profile.reservedAreas;

  return {
    composition: `围绕${profile.evidenceGoal}组织画面，采用${layoutIntent.layoutMode || profile.layoutMode}结构，主体与${reservedAreas.join("、")}区域必须清晰分离。`,
    styling: `保持整套图统一的主色、材质和镜头语言，这一张优先呈现${profile.businessGoal}`,
    background: `背景只服务${profile.informationGoal}，并为${reservedAreas.join("、")}保留可叠加的信息空间。`,
    lighting: `光线优先照清${profile.evidenceGoal}相关结构或材质，避免只有氛围没有证据。`,
  };
};

type PromptVisualTemplate = {
  label: string;
  businessRole: string;
  composition: string;
  background: string;
  lighting: string;
  material: string;
  avoid: string;
};

const PROMPT_VISUAL_TEMPLATE_LIBRARY: Record<string, PromptVisualTemplate> = {
  hero_multi: {
    label: "首屏主视觉模板",
    businessRole: "承担首图点击与第一印象建立任务，商品要第一眼立住，先建立品牌/品类/价值认知。",
    composition:
      "单一主焦点的商业主视觉构图，主体完整清晰，占据主要视觉重心，可用正面或 45 度角度建立体积，保留适度留白，不要平均铺满所有元素。",
    background:
      "背景克制、干净、有品牌气质，可用柔和渐变、亚克力台面、低干扰几何布景或轻场景线索，只能衬托主体，不能像随手搭景。",
    lighting:
      "使用商业棚拍式主光 + 边缘高光/轮廓光，把主体体积、边缘和材质打出来，避免平、灰、没有层次的平均照明。",
    material:
      "明确表现包装或主体材质的真实反射、珠光、金属、玻璃、磨砂或塑料细节，让商品看起来贵、稳、可买。",
    avoid:
      "不要把它写成普通场景照、概念海报或空泛氛围图，不要让道具、人物或背景抢走主体。",
  },
  main_image: {
    label: "首屏主视觉模板",
    businessRole: "承担首图点击与第一印象建立任务，商品要第一眼立住，先建立品牌/品类/价值认知。",
    composition:
      "单一主焦点的商业主视觉构图，主体完整清晰，占据主要视觉重心，可用正面或 45 度角度建立体积，保留适度留白，不要平均铺满所有元素。",
    background:
      "背景克制、干净、有品牌气质，可用柔和渐变、亚克力台面、低干扰几何布景或轻场景线索，只能衬托主体，不能像随手搭景。",
    lighting:
      "使用商业棚拍式主光 + 边缘高光/轮廓光，把主体体积、边缘和材质打出来，避免平、灰、没有层次的平均照明。",
    material:
      "明确表现包装或主体材质的真实反射、珠光、金属、玻璃、磨砂或塑料细节，让商品看起来贵、稳、可买。",
    avoid:
      "不要把它写成普通场景照、概念海报或空泛氛围图，不要让道具、人物或背景抢走主体。",
  },
  white_bg: {
    label: "标准白底模板",
    businessRole: "承担平台标准展示与审核合规任务，优先让主体外观、颜色、比例、规格信息清楚可信。",
    composition:
      "主体完整、比例统一、居中或标准商品位构图，边缘清楚，留白稳定，适合做平台白底图或基础商品图，不需要花哨视角。",
    background:
      "纯白或极浅白背景，绝不加入多余场景、复杂道具或情绪化元素，重点是干净、规范、可读。",
    lighting:
      "中性干净的柔光棚拍，保持颜色准确、边缘利落、阴影极轻，避免偏色、脏灰或反差过重。",
    material:
      "材质要真实但克制，以清楚呈现产品轮廓、表面信息和结构为主，不追求花哨光效。",
    avoid:
      "不要写成氛围图、海报图或种草图，不要加入会影响审核和识别的背景元素。",
  },
  selling_points: {
    label: "卖点承接模板",
    businessRole: "承担详情页卖点承接与转化说明任务，一张图只讲一个核心卖点，帮助用户快速理解购买理由。",
    composition:
      "商品主体仍是主角，但要为单一卖点预留清晰的说明区、模块区或辅助信息区，形成主次明确的详情页阅读结构。",
    background:
      "背景可以比主图更功能化，允许轻模块、色块或单一辅助元素，但必须围绕该卖点服务，不能做成信息堆满的一屏。",
    lighting:
      "光线要稳定、清楚、偏解释型，既保证商品质感，也保证卖点相关局部或功能点容易被看懂。",
    material:
      "如果卖点涉及材质、功效、工艺或结构，需要把相关局部写具体，让材质与功能形成证据感。",
    avoid:
      "不要把所有卖点塞进一张图，不要只喊“突出卖点”，要明确这张图到底讲哪一个卖点。",
  },
  feature_comparison: {
    label: "差异对比模板",
    businessRole: "承担差异化价值说明任务，用一张图快速讲清商品为什么更值得买。",
    composition:
      "采用清晰的对比式或分区式构图，主商品必须稳居核心位置，对比信息围绕主商品展开，不可做成杂乱信息海报。",
    background:
      "背景与版面简洁克制，适合做对比信息承载，重点是清楚与决策效率，不靠花哨场景吸引。",
    lighting:
      "使用稳定清楚的说明型光线，重点保证主体外观、差异点和结构细节都容易辨认。",
    material:
      "如果差异点和材质/做工有关，要把对应局部质感写具体，增强可信度。",
    avoid:
      "不要编造并不存在的优势，不要让对比版式盖过商品主体。",
  },
  detail_highlights: {
    label: "细节特写模板",
    businessRole: "承担品质感、做工和细节证据展示任务，用近景特写建立信任感。",
    composition:
      "用近景或微距特写聚焦单个细节点位，画面聚焦明确，主体局部放大但仍能判断它属于这件商品。",
    background:
      "背景极简，甚至虚化处理，只保留必要的衬托关系，让视线全部落在细节本身。",
    lighting:
      "用高细节柔光、边缘高光或受控反射把表面纹理、做工、切面、按键、印刷、工艺层次打出来。",
    material:
      "明确写出局部材质表现，例如金属边缘、玻璃反射、磨砂颗粒、压纹、膏体切面、液体质地等。",
    avoid:
      "不要只写“细节特写、突出质感”，要明确放大哪个局部、怎么打光、要证明什么。",
  },
  texture_demo: {
    label: "质地展示模板",
    businessRole: "承担真实肤感、质地、显色或纹理展示任务，帮助用户形成使用预期。",
    composition:
      "以局部近景、涂抹轨迹、泡沫状态、膏体切面或显色层次为核心，突出单一质地信息，不做复杂场景。",
    background:
      "背景中性克制，确保显色或质地层次最清楚，避免背景抢走肤感、色感和纹理信息。",
    lighting:
      "使用近距离柔光或受控高光，兼顾真实显色、透明感、润泽感、颗粒感或纹理起伏。",
    material:
      "把质地状态写具体，例如延展性、水润感、成膜感、泡沫密度、粉体颗粒、膏体切面、显色层次。",
    avoid:
      "不要把它写成普通产品摆拍，也不要只写“质地高级、肤感好”这种无证据空话。",
  },
  usage_scene: {
    label: "使用场景模板",
    businessRole: "承担真实使用代入与场景可信度建立任务，让用户明白商品在什么语境中被使用。",
    composition:
      "主体与使用关系同框，但商品仍是主角；场景、手部、人物或空间只作为辅助，不得淹没商品本身。",
    background:
      "用真实但克制的使用场景支撑代入感，例如梳妆台、浴室、桌面、车内、家居角落等，避免元素过多导致像普通生活照。",
    lighting:
      "光线要自然可信，同时保持商品轮廓、品牌识别和关键结构清晰，不可只剩氛围感。",
    material:
      "即使在场景图中，也要保住主体材质、轮廓和包装/结构识别，不让场景把商品质感冲掉。",
    avoid:
      "不要把它写成纯氛围大片、人物写真或杂志生活照，场景必须服务商品而不是反过来。",
  },
  lifestyle: {
    label: "种草氛围模板",
    businessRole: "承担品牌调性、情绪价值与种草氛围建立任务，但仍需保证商品有明确主视觉地位。",
    composition:
      "允许更强的氛围与生活方式表达，但要保留商品清晰主位、辅助层级和品牌识别，不能沦为纯氛围摆设。",
    background:
      "背景可以更讲究质感与情绪，例如高级台面、布料、浴室陈列、生活方式角落，但整体必须克制统一。",
    lighting:
      "光线可更有情绪，但必须继续服务商品体积、轮廓和材质，不要只有柔美氛围而缺少商品辨识。",
    material:
      "通过材质呼应品牌调性，例如石材、玻璃、金属、织物、水汽、木纹等，但要让主体仍是最贵、最稳的那个点。",
    avoid:
      "不要为了氛围牺牲商品存在感，不要让整张图变成看背景和道具的情绪图。",
  },
  steps: {
    label: "步骤说明模板",
    businessRole: "承担操作流程说明任务，降低理解门槛，让用户清楚怎么用、先后顺序是什么。",
    composition:
      "按步骤或逻辑分区组织画面，每一部分只承担一个动作或结果说明，结构清楚、顺序明确。",
    background:
      "背景功能化、说明化即可，不追求强氛围，重点是信息清楚。",
    lighting:
      "稳定清楚的说明型光线，保证每一步动作、结构和主体都容易辨认。",
    material:
      "若涉及接触部位、结构件或使用结果，要明确写出这些局部的可读性。",
    avoid:
      "不要把步骤图写成大片构图，也不要把多个动作糊成一张模糊场景图。",
  },
  size_hold: {
    label: "尺寸对比模板",
    businessRole: "承担大小感知、便携感或握持感建立任务，帮助用户快速判断实际尺寸。",
    composition:
      "通过手持、桌面对比或标准参照物建立尺寸感，主体比例关系必须直观，不要故意夸张透视。",
    background:
      "背景简洁真实，重点衬托尺寸关系与握持状态，不需要复杂氛围。",
    lighting:
      "稳定清楚的棚拍或自然说明光，保证边界、比例和接触关系清楚。",
    material:
      "即使强调尺寸，也要保持主体材质和结构真实，不让主体看起来像廉价模型。",
    avoid:
      "不要只说“便携小巧”，要让观众通过画面直接感到它有多大、多好握。",
  },
  structure: {
    label: "结构说明模板",
    businessRole: "承担结构、分区、组成或功能原理说明任务，让用户更快看懂这件商品。",
    composition:
      "构图要围绕结构清晰度组织，可用分区、拆解、局部放大或说明式镜头，但主体关系必须稳定清楚。",
    background:
      "背景简洁、说明化，服务结构阅读，不需要氛围堆砌。",
    lighting:
      "使用解释型光线，把结构边界、接口、层次和功能分区照清楚。",
    material:
      "如果结构与材质/工艺相关，要明确表现这些连接关系和部件细节。",
    avoid:
      "不要编造参考图中看不到的结构，不要为了酷炫把结构说明做成概念海报。",
  },
  ingredient_story: {
    label: "成分功效模板",
    businessRole: "承担成分、配方、原料或功效依据说明任务，重点建立专业感和可信度。",
    composition:
      "商品主体仍需清楚出现，但可搭配单一成分或功效线索做说明式构图，信息主次必须明确。",
    background:
      "背景偏专业、洁净、克制，可用实验室感、原料感或低干扰氛围，但不能太杂。",
    lighting:
      "光线要干净、专业、可信，既照清商品，也照清成分线索或功能证据。",
    material:
      "如果涉及液体、粉体、植物、胶囊或配方质感，要让这些材质线索可感知但不喧宾夺主。",
    avoid:
      "不要把成分图写成堆素材拼贴图，也不要夸大功效到失真。",
  },
};

const buildPromptVisualTemplateBlock = (
  rawTypeId: string,
  typeTitle?: string,
  planTitle?: string,
) => {
  const resolvedTypeId = resolveRecommendedTypeId(rawTypeId, typeTitle || planTitle);
  const template =
    PROMPT_VISUAL_TEMPLATE_LIBRARY[resolvedTypeId] ||
    PROMPT_VISUAL_TEMPLATE_LIBRARY[
      resolveRecommendedTypeId("", `${typeTitle || ""}${planTitle || ""}`)
    ];

  if (!template) {
    return "";
  }

  return [
    `图型模板：${template.label}`,
    `商业任务：${template.businessRole}`,
    `构图骨架：${template.composition}`,
    `背景控制：${template.background}`,
    `光线执行：${template.lighting}`,
    `材质表现：${template.material}`,
    `避坑提醒：${template.avoid}`,
  ].join("\n");
};

const buildPromptFlagshipDirectionBlock = (
  rawTypeId: string,
  typeTitle?: string,
  planTitle?: string,
) => {
  const resolvedTypeId = resolveRecommendedTypeId(rawTypeId, typeTitle || planTitle);

  switch (resolvedTypeId) {
    case "hero_multi":
    case "main_image":
      return [
        "旗舰电商强化：",
        "品牌系统：整组图要像同一品牌 campaign 的连续页，色温、布景材质、镜头语气和产品气质保持同一套视觉系统，不要像临时拼出来的单图。",
        "主体权重：商品必须是唯一主角，第一眼先看到商品本体，再看到场景或道具；主体权重明确，不做双主角或平均发力。",
        "负空间纪律：保留干净、成体系的留白和呼吸区，让画面有旗舰页那种克制与权威感，不要把元素塞满。",
        "识别锚点：优先守住轮廓、顶盖/边框/接口、标签位置、主色关系、关键材质反射这些品牌识别锚点。",
        "单图任务：这一张只承担首图点击、品牌定调和品质感建立，不顺手塞进多段卖点说明。",
      ].join("\n");
    case "white_bg":
      return [
        "旗舰电商强化：",
        "标准展示：不是普通抠图白底，而是高完成度旗舰白底商品照，先让主体比例、边缘、颜色和版面秩序可信。",
        "主体权重：商品位置稳定、轮廓完整、信息面清楚，像平台标准商品位，不搞夸张透视和装饰叙事。",
        "负空间纪律：白底要干净、均匀、克制，留白服务识别与审核，不做漂浮感过强或影调脏灰的伪高级效果。",
        "识别锚点：容量、包装正面、logo 或品牌字样、瓶盖/喷头/接口等关键结构必须稳定。",
        "单图任务：这一张只负责标准展示和识别，不承担种草氛围或复杂卖点。",
      ].join("\n");
    case "selling_points":
    case "feature_comparison":
      return [
        "旗舰电商强化：",
        "信息纪律：一张图只讲一个核心卖点或一个差异理由，像旗舰详情页里的单屏模块，不要把整套话术堆到同一张图。",
        "主体权重：商品仍然是主角，卖点说明区只做辅助，不能把商品压缩成角落配角。",
        "版式权威：构图要有清楚的信息区和主视觉区，留白明确，阅读路径直接，不做杂乱拼贴海报。",
        "识别锚点：卖点再强，也不能牺牲包装、结构、主色关系和材质真实性。",
        "光线策略：打光既要保住商品体积和质感，也要让与卖点相关的局部证据足够清楚。",
      ].join("\n");
    case "detail_highlights":
    case "texture_demo":
      return [
        "旗舰电商强化：",
        "证据导向：这类图不是单纯好看，而是要提供可放大的品质证据，让人一眼知道细节好在哪里、贵在哪里。",
        "主体权重：聚焦一个明确局部，不要同屏塞多个细节任务；放大局部时仍要保留它属于原商品的识别关系。",
        "光线雕刻：通过受控高光、边缘反射、微距柔光或切面照明把纹理、材质、做工层次打出来，避免一片雾化柔焦。",
        "识别锚点：把关键细节落到具体结构，如边角、接缝、压纹、标签、切面、按钮、喷头、液体状态等。",
        "负空间纪律：背景和辅助元素极简，让注意力完全落在被证明的那一个细节上。",
      ].join("\n");
    case "usage_scene":
    case "lifestyle":
      return [
        "旗舰电商强化：",
        "场景角色：场景只负责证明使用语境或品牌调性，不能反客为主把商品拍成普通生活方式照片。",
        "主体权重：即使有人物、手部或空间，商品也必须保持明确主位，第一眼能被认出来是这件商品。",
        "品牌系统：环境材质、道具颜色、家具或台面风格要与商品调性同系统，像品牌世界观的一部分，不像随手借来的背景。",
        "负空间纪律：场景元素有选择地出现，宁少勿乱，保留旗舰内容图应有的秩序感和呼吸感。",
        "识别锚点：场景化时仍要稳住轮廓、包装正面、主色关系和关键材质，不让商品变成另一个东西。",
      ].join("\n");
    case "steps":
    case "size_hold":
    case "structure":
    case "ingredient_story":
      return [
        "旗舰电商强化：",
        "功能优先：先保证用户一眼看懂结构、尺寸、步骤或成分关系，再谈风格，不做过度情绪化包装。",
        "主体权重：说明信息围绕商品展开，商品本体必须稳、准、清楚，不能被说明模块切碎成失真拼图。",
        "版式权威：像成熟品牌详情页的功能模块，信息层级直接、秩序清楚、留白克制。",
        "识别锚点：所有说明都建立在真实可见的包装、结构、比例和局部细节上，不虚构额外品牌承诺。",
        "单图任务：每张图只解决一个理解问题，不把多个问题强行塞进同一屏。",
      ].join("\n");
    default:
      return [
        "旗舰电商强化：",
        "品牌系统：画面要像成熟品牌旗舰店素材，不像随机生成的单张商业图。",
        "主体权重：商品是唯一主角，背景和道具只做辅助。",
        "负空间纪律：保留克制留白与清楚层级，不要把画面塞满。",
        "识别锚点：守住轮廓、主色关系、关键结构和主要材质反射。",
        "单图任务：每张图只完成一个最重要的商业表达目标。",
      ].join("\n");
  }
};

const normalizeRecommendedTypesForUi = (
  items: EcommerceRecommendedType[],
): EcommerceRecommendedType[] =>
  items.map((item, index) => {
    const titleFallback =
      RECOMMENDED_TYPE_TITLE_FALLBACKS[item.id] || `推荐图型 ${index + 1}`;
    const title = ensureChineseUiText(item.title, titleFallback);
    const description = ensureChineseUiText(
      item.description,
      RECOMMENDED_TYPE_DESCRIPTION_FALLBACKS[item.id] ||
        `用于「${title}」的电商展示图。`,
    );

    return {
      ...item,
      title,
      description,
      platformTags: normalizeUiStringList(item.platformTags, (tagIndex) => `平台标签 ${tagIndex + 1}`),
      reason: ensureChineseUiText(item.reason, `推荐将「${title}」纳入当前电商出图组合。`),
      highlights: normalizeUiStringList(item.highlights, (tagIndex) => `亮点 ${tagIndex + 1}`),
      goal: item.goal
        ? ensureChineseUiText(item.goal, `围绕「${title}」提升当前平台转化表达。`)
        : item.goal,
      evidence: item.evidence
        ? normalizeUiStringList(item.evidence, (evidenceIndex) => `判断依据 ${evidenceIndex + 1}`)
        : item.evidence,
      omittedReason: item.omittedReason
        ? ensureChineseUiText(item.omittedReason, "当前阶段不建议优先生成该图型。")
        : item.omittedReason,
    };
  });

const getRecommendedTypeTargetCount = (
  workflowMode?: EcommerceWorkflowMode,
): number => (workflowMode === "quick" ? 6 : 9);

const expandRecommendedTypesWithFallback = (
  items: EcommerceRecommendedType[],
  fallback: EcommerceRecommendedType[],
  workflowMode?: EcommerceWorkflowMode,
): EcommerceRecommendedType[] => {
  if (items.length > 0) {
    return items;
  }

  const byId = new Set(items.map((item) => item.id));
  const merged = [...items];
  const targetCount = getRecommendedTypeTargetCount(workflowMode);

  fallback
    .filter((item) => item.required && !byId.has(item.id))
    .forEach((item) => {
      merged.push({
        ...item,
        source: "fallback",
        usedFallback: true,
        fallbackReason: "该推荐项来自保护性推荐池补全。",
      });
      byId.add(item.id);
    });

  const candidateBuckets = [
    fallback.filter(
      (item) => item.recommended && item.priority === "high" && !byId.has(item.id),
    ),
    fallback.filter(
      (item) => item.recommended && item.priority === "medium" && !byId.has(item.id),
    ),
    fallback.filter((item) => item.priority === "medium" && !byId.has(item.id)),
    fallback.filter((item) => !byId.has(item.id)),
  ];

  for (const bucket of candidateBuckets) {
    for (const item of bucket) {
      if (merged.length >= targetCount) {
        break;
      }
      merged.push({
        ...item,
        source: "fallback",
        usedFallback: true,
        fallbackReason: "该推荐项来自保护性推荐池补全。",
      });
      byId.add(item.id);
    }
    if (merged.length >= targetCount) {
      break;
    }
  }

  return merged;
};

const normalizeSupplementFieldsForUi = (
  fields: EcommerceSupplementField[],
): EcommerceSupplementField[] =>
  fields.map((field, index) => ({
    ...field,
    required: field.kind === "image" ? false : Boolean(field.required),
    label: ensureChineseUiText(field.label, `补充信息 ${index + 1}`),
    placeholder: field.placeholder
      ? ensureChineseUiText(field.placeholder, "请补充该字段内容")
      : field.placeholder,
    helperText: field.helperText
      ? ensureChineseUiText(field.helperText, "该信息会影响后续方案和提示词。")
      : field.helperText,
    options: field.options
      ? normalizeUiStringList(field.options, (optionIndex) => `选项 ${optionIndex + 1}`)
      : field.options,
    valueSource:
      field.valueSource === "user" ||
      field.valueSource === "ai" ||
      field.valueSource === "estimated"
        ? field.valueSource
        : field.valueSource,
    valueConfidence: normalizeConfidenceValue(field.valueConfidence),
    valueNote: field.valueNote
      ? ensureChineseUiText(field.valueNote, "该答案来自 AI 的保守估计，建议后续再核对。")
      : field.valueNote,
  }));

const isSupplementFieldAnswered = (field: EcommerceSupplementField): boolean => {
  if (field.kind === "image") {
    return Array.isArray(field.value) && field.value.length > 0;
  }
  if (Array.isArray(field.value)) {
    return field.value.some((item) => {
      const text = String(item || "").trim();
      return text.length > 0 && !isPlaceholderSupplementValue(text);
    });
  }
  const text = String(field.value || "").trim();
  return text.length > 0 && !isPlaceholderSupplementValue(text);
};

const isPlaceholderSupplementValue = (value?: string): boolean => {
  const text = String(value || "").trim();
  if (!text) return false;

  return /请补充|参数请补充|其他参数|其余参数|待补充|后续补充|信息不足|建议后续覆盖|保守估填|保守估计|先做猜测补全|先按.*理解|先按.*规划/.test(
    text,
  );
};

const normalizeImageAnalysesForUi = (
  items: EcommerceImageAnalysis[],
): EcommerceImageAnalysis[] =>
  items.map((item, index) => ({
    ...item,
    title: ensureChineseUiText(item.title, `商品图 ${index + 1}`),
    description: ensureChineseUiText(
      item.description,
      `这张图可作为商品第 ${index + 1} 张参考图，用于保持主体一致性与结构信息。`,
    ),
    angle: item.angle ? ensureChineseUiText(item.angle, "常规商品视角") : item.angle,
    highlights: normalizeUiStringList(item.highlights, (highlightIndex) => `亮点 ${highlightIndex + 1}`),
    materials: normalizeUiStringList(item.materials, (materialIndex) => `材质线索 ${materialIndex + 1}`),
    evidence: item.evidence
      ? normalizeUiStringList(item.evidence, (evidenceIndex) => `判断依据 ${evidenceIndex + 1}`)
      : item.evidence,
  }));

const ensureStructuredImageAnalysisFields = (
  items: EcommerceImageAnalysis[],
): EcommerceImageAnalysis[] =>
  items.map((item, index) => ({
    ...item,
    description: ensureChineseUiText(
      item.description,
      `这张图展示了商品第 ${index + 1} 个参考视角，请补充主体外观、结构、材质、按钮接口、品牌字样和背景光线等可见事实。`,
    ),
    analysisConclusion: ensureChineseUiText(
      item.analysisConclusion,
      item.usableAsReference
        ? "这张图可以作为后续生成的参考图，请重点核对主体完整度和结构稳定性。"
        : "这张图更适合作为补充说明，不建议单独承担主体一致性约束。",
    ),
  }));

const ensureSeparatedImageAnalysisFields = (
  items: EcommerceImageAnalysis[],
): EcommerceImageAnalysis[] =>
  splitEcommerceImageAnalysisTextFieldList(ensureStructuredImageAnalysisFields(items)).map(
    (item, index) => ({
      ...item,
      description: ensureChineseUiText(
        item.description,
        `这张图展示了商品第 ${index + 1} 个参考视角，请补充主体外观、结构、材质、按钮接口、品牌字样和背景光线等可见事实。`,
      ),
      analysisConclusion: ensureChineseUiText(
        item.analysisConclusion,
        item.usableAsReference
          ? "这张图可以作为后续生成的参考图，请重点核对主体完整度和结构稳定性。"
          : "这张图更适合作为补充说明，不建议单独承担主体一致性约束。",
      ),
    }),
  );

const normalizeStageReviewForUi = (
  review: EcommerceStageReview | null | undefined,
  fallbackVerdict: string,
): EcommerceStageReview | null =>
  review
    ? {
        ...review,
        verdict: ensureChineseUiText(review.verdict, fallbackVerdict),
        reviewerNotes: normalizeUiStringList(review.reviewerNotes, (index) => `复核意见 ${index + 1}`),
        risks: normalizeUiStringList(review.risks, (index) => `风险提示 ${index + 1}`),
      }
    : null;

const normalizeAnalysisReviewForUi = (
  review: EcommerceAnalysisReview | null | undefined,
  fallbackVerdict: string,
): EcommerceAnalysisReview | null =>
  review
    ? {
        ...review,
        verdict: ensureChineseUiText(review.verdict, fallbackVerdict),
        reviewerNotes: normalizeUiStringList(review.reviewerNotes, (index) => `复核意见 ${index + 1}`),
        risks: normalizeUiStringList(review.risks, (index) => `风险提示 ${index + 1}`),
      }
    : null;

const withAnalysisReviewMeta = (
  review: EcommerceAnalysisReview,
  source: "ai" | "fallback",
  fallbackReason?: string,
): EcommerceAnalysisReview => ({
  ...review,
  source,
  usedFallback: source === "fallback" || Boolean(fallbackReason),
  fallbackReason,
});

const withStageReviewMeta = (
  review: EcommerceStageReview,
  source: "ai" | "fallback",
  fallbackReason?: string,
): EcommerceStageReview => ({
  ...review,
  source,
  usedFallback: source === "fallback",
  fallbackReason,
});

const normalizeResultReviewForUi = (
  review: z.infer<typeof resultReviewSchema>,
  fallbackSummary: string,
): z.infer<typeof resultReviewSchema> => ({
  ...review,
  summary: ensureChineseUiText(review.summary, fallbackSummary),
  strengths: normalizeUiStringList(review.strengths, (index) => `优点 ${index + 1}`),
  issues: normalizeUiStringList(review.issues, (index) => `问题 ${index + 1}`),
  recommendedUse: review.recommendedUse
    ? ensureChineseUiText(review.recommendedUse, "适合作为当前方案的候选结果继续比较。")
    : review.recommendedUse,
});

const normalizePlanGroupsForUi = (
  groups: EcommercePlanGroup[],
): EcommercePlanGroup[] =>
  groups.map((group, groupIndex) => {
    const typeTitle = ensureChineseUiText(
      group.typeTitle,
      RECOMMENDED_TYPE_TITLE_FALLBACKS[group.typeId] || `方案分组 ${groupIndex + 1}`,
    );

    return {
      ...group,
      typeTitle,
      summary: group.summary
        ? ensureChineseUiText(group.summary, "") || group.summary.trim() || undefined
        : undefined,
      strategy: (group.strategy || [])
        .map((entry, entryIndex) => ({
          label: ensureChineseUiText(entry.label, `策略 ${entryIndex + 1}`),
          value: ensureChineseUiText(entry.value, "") || entry.value,
        }))
        .filter((entry) => entry.label.trim().length > 0 && entry.value.trim().length > 0),
      platformTags: normalizeUiStringList(group.platformTags),
      items: (group.items || []).map((item, itemIndex) => ({
        ...item,
        title: ensureChineseUiText(item.title, `${typeTitle} ${itemIndex + 1}`),
        description: ensureChineseUiText(item.description, "") || item.description || "",
        promptOutline:
          ensureChineseUiText(item.promptOutline, "") ||
          ensureChineseUiText(item.description, "") ||
          item.promptOutline ||
          item.description ||
          "",
        mustShow: normalizeUiStringList(item.mustShow),
        composition: item.composition
          ? ensureChineseUiText(item.composition, "") || item.composition
          : item.composition,
        styling: item.styling
          ? ensureChineseUiText(item.styling, "") || item.styling
          : item.styling,
        background: item.background
          ? ensureChineseUiText(item.background, "") || item.background
          : item.background,
        lighting: item.lighting
          ? ensureChineseUiText(item.lighting, "") || item.lighting
          : item.lighting,
        marketingGoal: item.marketingGoal
          ? ensureChineseUiText(item.marketingGoal, "") || item.marketingGoal
          : item.marketingGoal,
        keyMessage: item.keyMessage
          ? ensureChineseUiText(item.keyMessage, "") || item.keyMessage
          : item.keyMessage,
        platformFit: item.platformFit
          ? normalizeUiStringList(item.platformFit)
          : item.platformFit,
        riskNotes: item.riskNotes
          ? normalizeUiStringList(item.riskNotes)
          : item.riskNotes,
      })),
    };
  });

const getFallbackRecommendedTypes = (
  brief: string,
  platformMode?: EcommercePlatformMode,
  workflowMode?: EcommerceWorkflowMode,
): EcommerceRecommendedType[] => {
  const archetype = inferProductArchetype(brief);
  const category = inferCategoryHint(brief);
  const isCareDevice = category === "care-device";
  const isBeauty = category === "beauty";
  const isQuick = workflowMode === "quick";
  const targetCount = getRecommendedTypeTargetCount(workflowMode);

  if (isBeauty) {
    const beautyTypes: EcommerceRecommendedType[] = [
      {
        id: "hero_multi",
        title: "商品主图（主视觉轮播）",
        description:
          "围绕包装正面、品牌识别、净颜提亮感和高级洁净氛围，建立第一眼点击吸引力。",
        imageCount: 4,
        priority: "high",
        platformTags: ["全平台", "点击率提升关键"],
        selected: true,
        reason: "主图需要先讲清这是什么产品，并把品牌感与质感立住。",
        highlights: ["正面包装", "品牌标识", "香槟金质感", "洁净高级氛围"],
        recommended: true,
        required: true,
        goal: "建立第一印象",
        confidence: "high",
        evidence: ["承担首屏点击任务", "包装质感直接影响护肤品信任感"],
      },
      {
        id: "white_bg",
        title: "白底标准图",
        description:
          "用标准白底完整展示软管包装、容量和品牌信息，满足平台搜索和审核场景。",
        imageCount: 3,
        priority: "high",
        platformTags: ["淘宝/天猫", "京东", "拼多多", "平台必需"],
        selected: true,
        reason: "护肤清洁品在搜索流量和审核场景下通常都需要标准白底图。",
        highlights: ["正面白底", "45 度白底", "容量信息"],
        recommended: true,
        required: true,
        goal: "满足平台标准图要求",
        confidence:
          platformMode === "xiaohongshu" || platformMode === "douyin"
            ? "medium"
            : "high",
        evidence: ["平台规范常要求白底或标准图", "有利于商品信息清晰展示"],
      },
      {
        id: "selling_points",
        title: "核心卖点图",
        description:
          "把积雪草、净颜提亮、温和清洁、肤感体验等关键信息转成易读的详情页卖点内容。",
        imageCount: 4,
        priority: "high",
        platformTags: ["全平台", "详情页", "高转化"],
        selected: true,
        reason: "护肤洁面产品需要快速讲清功效、成分和使用感，才能承接点击后的转化。",
        highlights: ["积雪草", "净颜提亮", "温和清洁", "洁净肤感"],
        recommended: true,
        goal: "讲清产品为什么值得买",
        confidence: "high",
        evidence: ["详情页需要承接用户功效疑问", "适合解释成分与肤感卖点"],
      },
      {
        id: "ingredient_story",
        title: "成分功效图",
        description:
          "重点解释积雪草等核心成分与净颜提亮诉求，强化专业感与成分可信度。",
        imageCount: 3,
        priority: "high",
        platformTags: ["淘宝/天猫", "京东", "详情页"],
        selected: true,
        reason: "护肤品用户通常会先看成分与功效依据，成分图能明显提升专业感。",
        highlights: ["核心成分", "功效表达", "专业可信"],
        recommended: true,
        goal: "提升成分信任感",
        confidence: "high",
        evidence: ["成分是护肤品核心决策因素", "适合承接品牌专业表达"],
      },
      {
        id: "texture_demo",
        title: "质地图/泡沫图",
        description:
          "用膏体、啫喱、起泡或水感细节呈现肤感与清洁体验，强化真实使用想象。",
        imageCount: 3,
        priority: "medium",
        platformTags: ["淘宝/天猫", "小红书", "内容种草"],
        selected: true,
        reason: "洁面产品的质地和泡沫观感会直接影响用户对温和度与使用感的判断。",
        highlights: ["啫喱质地", "泡沫状态", "清透肤感"],
        goal: "强化使用感认知",
        confidence: "medium",
        evidence: ["洁面产品购买判断高度依赖质地和肤感想象"],
      },
      {
        id: "usage_scene",
        title: "洁面场景图",
        description:
          "通过洗漱台、浴室或手部使用场景，呈现产品在真实护肤流程中的使用氛围。",
        imageCount: 3,
        priority: "medium",
        platformTags: ["淘宝/天猫", "小红书", "内容种草"],
        selected: true,
        reason: "场景图能补足护肤流程感，帮助用户快速代入日常使用状态。",
        highlights: ["洗漱台", "洁净水感", "护肤仪式感"],
        recommended: true,
        goal: "建立真实使用联想",
        confidence: "medium",
        evidence: ["场景图适合种草和详情页情绪承接"],
      },
      {
        id: "detail_highlights",
        title: "包装细节特写图",
        description:
          "放大展示瓶口、翻盖、印刷细节、表面质感与局部做工，补强品质感和包装可信度。",
        imageCount: 2,
        priority: "medium",
        platformTags: ["淘宝/天猫", "小红书", "细节说服"],
        selected: true,
        reason: "仅靠主图和白底图还不够，局部细节能进一步证明包装质感与做工是否靠谱。",
        highlights: ["瓶口/翻盖", "印刷细节", "包装质感"],
        recommended: true,
        goal: "补强品质与包装信任",
        confidence: "medium",
        evidence: ["细节特写适合承接用户对做工和质感的进一步判断"],
      },
      {
        id: "feature_comparison",
        title: "差异卖点对比图",
        description:
          "把清洁力、温和度、成分感、肤感体验等核心优势整理成一屏可读的对比型信息图。",
        imageCount: 2,
        priority: "medium",
        platformTags: ["淘宝/天猫", "京东", "详情页转化"],
        selected: true,
        reason: "当产品卖点较多时，对比型图能帮助用户更快抓住“为什么买它”的核心差异。",
        highlights: ["清洁力", "温和度", "成分优势"],
        recommended: true,
        goal: "快速讲清差异化价值",
        confidence: "medium",
        evidence: ["适合把多条卖点压缩成更易读的决策图"],
      },
      {
        id: "lifestyle",
        title: "品牌氛围种草图",
        description:
          "通过高级洁净、晨间洗护或浴室陈列氛围，补足品牌情绪价值与内容种草感。",
        imageCount: 2,
        priority: "low",
        platformTags: ["小红书", "抖音电商", "内容种草"],
        selected: false,
        reason: "氛围图不是所有平台都必须，但在内容渠道和品牌页里有助于提升整体质感。",
        highlights: ["洁净氛围", "浴室陈列", "品牌调性"],
        goal: "补足情绪价值与种草力",
        confidence: "low",
        evidence: ["更适合内容平台、店铺首页和品牌感承接"],
      },
    ];

    if (archetype === "serum-cream") {
      const serumTypes: EcommerceRecommendedType[] = [
        {
          id: "hero_multi",
          title: "商品主图（功效主视觉）",
          description:
            "围绕包装主体、核心功效关键词与专业肤感氛围建立第一眼认知，先讲清产品定位与品牌可信度。",
          imageCount: 4,
          priority: "high",
          platformTags: ["全平台", "点击率提升关键"],
          selected: true,
          reason: "功效型护肤品需要先把产品定位、包装质感和专业感立住，才能承接点击。",
          highlights: ["包装主体", "品牌识别", "专业护肤气质", "核心功效线索"],
          recommended: true,
          required: true,
          goal: "建立第一印象与专业感",
          confidence: "high",
          evidence: ["护肤品首屏必须先建立信任感", "包装和功效定位直接影响点击判断"],
        },
        {
          id: "white_bg",
          title: "白底标准图",
          description:
            "以标准白底完整展示瓶身/软管外观、容量与品牌信息，满足平台搜索、审核与商品基础信息展示。",
          imageCount: 3,
          priority: "high",
          platformTags: ["淘宝/天猫", "京东", "拼多多", "平台必需"],
          selected: true,
          reason: "功效型护肤品在搜索流量、审核场景和商品详情中通常都需要标准白底图。",
          highlights: ["正面白底", "45 度白底", "容量规格"],
          recommended: true,
          required: true,
          goal: "满足平台标准图要求",
          confidence:
            platformMode === "xiaohongshu" || platformMode === "douyin"
              ? "medium"
              : "high",
          evidence: ["平台规范常要求白底或标准图", "有利于基础商品信息展示"],
        },
        {
          id: "selling_points",
          title: "核心卖点图",
          description:
            "围绕修护、保湿、舒缓、抗老、防晒等关键信息拆解详情页卖点，让用户快速理解产品价值。",
          imageCount: 4,
          priority: "high",
          platformTags: ["全平台", "详情页", "高转化"],
          selected: true,
          reason: "功效型护肤品用户会重点看功效逻辑、适用问题和购买理由，卖点图是承接转化的主阵地。",
          highlights: ["核心功效", "适用问题", "肤感体验", "专业信任"],
          recommended: true,
          goal: "讲清产品为什么值得买",
          confidence: "high",
          evidence: ["详情页需要承接用户对功效和适用性的疑问"],
        },
        {
          id: "ingredient_story",
          title: "成分功效图",
          description:
            "围绕核心成分、配方逻辑与功效依据建立专业可信度，让产品不只停留在情绪化表达。",
          imageCount: 3,
          priority: "high",
          platformTags: ["淘宝/天猫", "京东", "详情页"],
          selected: true,
          reason: "成分与功效依据是功效型护肤品最核心的购买判断之一。",
          highlights: ["核心成分", "功效依据", "专业背书"],
          recommended: true,
          goal: "提升专业信任感",
          confidence: "high",
          evidence: ["用户通常会先判断成分是否可信、是否适合自己"],
        },
        {
          id: "texture_demo",
          title: "质地图/肤感图",
          description:
            "通过乳霜、精华、乳液或防晒成膜等近景细节呈现质地与肤感，强化使用想象。",
          imageCount: 3,
          priority: "medium",
          platformTags: ["淘宝/天猫", "小红书", "内容种草"],
          selected: true,
          reason: "质地与肤感是功效型护肤品的重要决策因素，尤其影响温和度和高级感判断。",
          highlights: ["乳霜质地", "延展性", "水润感", "肤感细节"],
          goal: "强化使用感认知",
          confidence: "medium",
          evidence: ["护肤品购买判断高度依赖肤感想象"],
        },
        {
          id: "usage_scene",
          title: "护肤场景图",
          description:
            "通过梳妆台、晨晚护肤流程或手部涂抹场景，承接真实护肤语境和品牌氛围。",
          imageCount: 3,
          priority: "medium",
          platformTags: ["淘宝/天猫", "小红书", "内容种草"],
          selected: true,
          reason: "场景图适合把产品放回真实护肤流程里，增强代入感和种草感。",
          highlights: ["梳妆台", "涂抹动作", "晨晚护肤氛围"],
          recommended: true,
          goal: "建立真实使用联想",
          confidence: "medium",
          evidence: ["适合详情页情绪承接和内容平台种草"],
        },
        {
          id: "detail_highlights",
          title: "包装细节特写图",
          description:
            "放大展示瓶盖、滴管、泵头、瓶身印刷和局部材质，强化品质感与包装细节可信度。",
          imageCount: 2,
          priority: "medium",
          platformTags: ["淘宝/天猫", "小红书", "细节说服"],
          selected: true,
          reason: "功效型护肤品除了成分逻辑，也需要用包装与做工细节建立高级感与信任感。",
          highlights: ["滴管/泵头", "瓶身印刷", "材质细节"],
          recommended: true,
          goal: "补强品质感与包装信任",
          confidence: "medium",
          evidence: ["细节特写能补足用户对品质和高级感的判断"],
        },
        {
          id: "feature_comparison",
          title: "功效差异对比图",
          description:
            "把核心功效、适用问题、肤感方向和配方亮点整理成更适合快速阅读的对比型图层。",
          imageCount: 2,
          priority: "medium",
          platformTags: ["淘宝/天猫", "京东", "详情页转化"],
          selected: true,
          reason: "当产品需要同时讲多个功效点时，对比型表达更利于用户快速建立判断。",
          highlights: ["核心功效", "适用问题", "配方亮点"],
          recommended: true,
          goal: "提高功效信息可读性",
          confidence: "medium",
          evidence: ["适合把分散卖点收束成更强的决策画面"],
        },
        {
          id: "lifestyle",
          title: "品牌氛围种草图",
          description:
            "通过梳妆台陈列、晨晚护肤氛围或高净值生活方式视觉，补足品牌情绪价值和种草感。",
          imageCount: 2,
          priority: "low",
          platformTags: ["小红书", "抖音电商", "内容种草"],
          selected: false,
          reason: "氛围种草图不是基础必需项，但对品牌升级感、内容分发和店铺视觉统一很有帮助。",
          highlights: ["梳妆台陈列", "生活方式感", "品牌氛围"],
          goal: "补足品牌情绪价值",
          confidence: "low",
          evidence: ["更适合内容平台、品牌页和种草型渠道"],
        },
      ];

      return isQuick
        ? serumTypes
            .filter(
              (item) =>
                item.required || item.priority === "high" || item.recommended,
            )
            .slice(0, targetCount)
        : serumTypes;
    }

    if (archetype === "beauty-makeup") {
      const makeupTypes: EcommerceRecommendedType[] = [
        {
          id: "hero_multi",
          title: "商品主图（风格主视觉）",
          description:
            "围绕包装、色彩识别和风格气质建立首屏吸引力，先让用户一眼知道这是什么妆感或风格产品。",
          imageCount: 4,
          priority: "high",
          platformTags: ["全平台", "点击率提升关键"],
          selected: true,
          reason: "彩妆产品首图需要同时建立包装质感和风格想象，避免只剩包装而没有妆效联想。",
          highlights: ["包装主体", "风格气质", "色彩线索", "高级妆感氛围"],
          recommended: true,
          required: true,
          goal: "建立第一印象与风格预期",
          confidence: "high",
          evidence: ["彩妆购买判断高度依赖风格与颜值第一印象"],
        },
        {
          id: "white_bg",
          title: "白底标准图",
          description:
            "完整展示包装外观、规格与色号/系列信息，满足平台商品规范和基础信息露出。",
          imageCount: 3,
          priority: "high",
          platformTags: ["淘宝/天猫", "京东", "拼多多", "平台必需"],
          selected: true,
          reason: "彩妆产品在搜索、审核和商品页通常仍需要标准白底图，尤其是包装和规格展示。",
          highlights: ["包装正面", "系列识别", "规格信息"],
          recommended: true,
          required: true,
          goal: "满足平台标准图要求",
          confidence:
            platformMode === "xiaohongshu" || platformMode === "douyin"
              ? "medium"
              : "high",
          evidence: ["平台搜索和审核场景依赖标准商品图"],
        },
        {
          id: "selling_points",
          title: "核心卖点图",
          description:
            "围绕持妆、显色、服帖、提气色、便携补妆等关键信息拆解详情页卖点。",
          imageCount: 4,
          priority: "high",
          platformTags: ["全平台", "详情页", "高转化"],
          selected: true,
          reason: "彩妆产品需要快速讲清妆效优势和使用价值，卖点图适合承接点击后的转化判断。",
          highlights: ["显色度", "服帖感", "持妆力", "风格适配"],
          recommended: true,
          goal: "讲清妆效与卖点",
          confidence: "high",
          evidence: ["用户会重点关注显色、妆效与场景适配"],
        },
        {
          id: "texture_demo",
          title: "试色/质地图",
          description:
            "通过刷色、膏体、粉质或上唇/上手近景展示显色、细腻度与质地特征。",
          imageCount: 3,
          priority: "high",
          platformTags: ["淘宝/天猫", "小红书", "内容种草"],
          selected: true,
          reason: "没有试色和质地展示，用户很难快速判断彩妆产品是否适合自己。",
          highlights: ["试色效果", "膏体/粉质", "显色层次"],
          recommended: true,
          goal: "建立显色与质地预期",
          confidence: "high",
          evidence: ["彩妆购买高度依赖试色和质地证据"],
        },
        {
          id: "usage_scene",
          title: "妆效场景图",
          description:
            "通过上脸近景、半身风格妆容或通勤/约会等场景，建立真实风格代入。",
          imageCount: 3,
          priority: "medium",
          platformTags: ["小红书", "抖音电商", "内容种草"],
          selected: true,
          reason: "彩妆产品需要通过妆效场景建立风格和使用想象，场景图能补足种草力。",
          highlights: ["上脸效果", "风格妆感", "人群代入"],
          recommended: true,
          goal: "建立真实妆效联想",
          confidence: "medium",
          evidence: ["内容平台和详情页都需要妆效代入"],
        },
        {
          id: "detail_highlights",
          title: "包装细节特写图",
          description:
            "通过局部特写展示壳体、压纹、刷头、膏体切面等细节，强化品质感与做工印象。",
          imageCount: 2,
          priority: "medium",
          platformTags: ["淘宝/天猫", "小红书", "细节说服"],
          selected: true,
          reason: "彩妆用户会在意包装做工和膏体/刷头等细节，特写能增强高级感与信任感。",
          highlights: ["壳体细节", "刷头/膏体", "工艺质感"],
          goal: "补强品质感与细节信任",
          confidence: "medium",
          evidence: ["细节特写适合放大工艺和质地证据"],
        },
        {
          id: "feature_comparison",
          title: "妆效差异卖点图",
          description:
            "把显色度、持妆力、质地体验、适配场景等核心优势整理成对比式卖点表达，方便用户快速决策。",
          imageCount: 2,
          priority: "medium",
          platformTags: ["淘宝/天猫", "京东", "详情页转化"],
          selected: true,
          reason: "彩妆用户往往在多个妆效点之间快速比较，对比型卖点图能提高理解效率。",
          highlights: ["显色度", "持妆力", "风格适配"],
          recommended: true,
          goal: "提高妆效卖点可读性",
          confidence: "medium",
          evidence: ["适合压缩多个妆效卖点，减少阅读成本"],
        },
        {
          id: "lifestyle",
          title: "种草氛围图",
          description:
            "通过梳妆台陈列、出门补妆、礼盒感或时尚搭配氛围，补足内容平台传播感和分享欲。",
          imageCount: 2,
          priority: "low",
          platformTags: ["小红书", "抖音电商", "内容种草"],
          selected: false,
          reason: "氛围图不一定是必需项，但对小红书、短视频封面和品牌内容页很有帮助。",
          highlights: ["梳妆台陈列", "时尚氛围", "礼物感"],
          goal: "增强传播感与分享欲",
          confidence: "low",
          evidence: ["内容平台更吃氛围感和可分享性"],
        },
      ];

      return isQuick
        ? makeupTypes
            .filter(
              (item) =>
                item.required || item.priority === "high" || item.recommended,
            )
            .slice(0, targetCount)
        : makeupTypes;
    }

    return isQuick
      ? beautyTypes
          .filter(
            (item) =>
              item.required || item.priority === "high" || item.recommended,
          )
          .slice(0, targetCount)
      : beautyTypes;
  }

  const types: EcommerceRecommendedType[] = [
    {
      id: "hero_multi",
      title: "商品主图（多角度轮播）",
      description:
        "采用 1:1 画幅组织多角度轮播，重点展示正面、侧面、顶部与关键按键细节，建立用户对产品外观的第一认知。",
      imageCount: 5,
      priority: "high",
      platformTags: ["全平台", "点击率提升关键"],
      selected: true,
      reason:
        "主图是第一屏转化入口，必须优先建立产品形态、材质和便携感。",
      highlights: ["正面", "45 度", "顶部结构", "按键细节", "握持状态"],
      recommended: true,
      required: true,
      goal: "建立第一印象",
      confidence: "high",
      evidence: ["承担首屏点击任务", "需要建立商品第一认知"],
    },
    {
      id: "white_bg",
      title: "白底图",
      description:
        "纯白背景展示整机形态与关键结构，适合搜索流量、审核通过和详情页的标准化露出。",
      imageCount: 4,
      priority: "high",
      platformTags: ["淘宝/天猫", "京东", "拼多多", "平台必需"],
      selected: true,
      reason: "标准白底图能提升审核通过率，也方便平台统一呈现商品。",
      highlights: ["主机完整外观", "45 度白底", "顶部细节", "按键局部"],
      recommended: true,
      required: true,
      goal: "满足平台标准图要求",
      confidence:
        platformMode === "xiaohongshu" || platformMode === "douyin"
          ? "medium"
          : "high",
      evidence: ["平台规范常要求白底或标准图", "有利于审核和搜索展示"],
    },
    {
      id: "selling_points",
      title: "核心卖点信息图",
      description:
        "把便携小巧、单键操作、舒适护理、结构亮点等信息转成用户一眼能懂的详情页内容。",
      imageCount: 5,
      priority: "high",
      platformTags: ["全平台", "详情页", "高转化"],
      selected: true,
      reason: "卖点型内容能承接主图点击后的疑问，直接推动详情页转化。",
      highlights: ["便携小巧", "一键操作", "顶部接触结构", "居家可用"],
      recommended: true,
      goal: "讲清产品为什么值得买",
      confidence: "high",
      evidence: ["详情页需要承接用户疑问", "适合解释差异化卖点"],
    },
    {
      id: "usage_scene",
      title: "使用场景图（适用部位展示）",
      description:
        "通过真人或半身局部场景展示颈部、肩部、腰背、手臂等适用部位，强化真实使用联想。",
      imageCount: isCareDevice ? 5 : 3,
      priority: "high",
      platformTags: ["淘宝/天猫", "京东", "小红书", "内容种草"],
      selected: isCareDevice,
      reason:
        "对于护理类产品，消费者需要直观看到使用位置和场景，才能形成真实联想。",
      highlights: ["颈部", "肩部", "腰背", "手臂", "局部接触关系"],
      recommended: isCareDevice,
      goal: "建立真实使用场景",
      confidence: isCareDevice ? "high" : "medium",
      evidence: ["护理类商品需要建立使用联想", "适合内容平台和详情页转化"],
    },
    {
      id: "steps",
      title: "操作步骤图",
      description:
        "用 3 到 4 步说明开机、贴近使用、模式切换和结束收纳，降低理解与咨询成本。",
      imageCount: 4,
      priority: "high",
      platformTags: ["全平台", "推荐", "转化"],
      selected: true,
      reason: "流程图可以降低新用户理解门槛，特别适合易上手类产品。",
      highlights: ["启动", "贴近使用", "持续护理", "结束收纳"],
      recommended: true,
      goal: "降低学习成本",
      confidence: isQuick ? "medium" : "high",
      evidence: ["帮助用户快速理解使用方法"],
    },
    {
      id: "size_hold",
      title: "尺寸握持图",
      description:
        "通过单手握持、掌心对比和桌面摆放等方式直观呈现尺寸比例，突出小巧便携。",
      imageCount: 3,
      priority: "medium",
      platformTags: ["淘宝/天猫", "拼多多", "小红书", "提升点击率"],
      selected: true,
      reason: "便携和尺寸感知是转化关键之一，适合用对比场景直观说明。",
      highlights: ["手掌对比", "掌心对比", "桌面摆放"],
      goal: "强化便携认知",
      confidence: "medium",
      evidence: ["尺寸感知直接影响购买判断"],
    },
    {
      id: "detail_highlights",
      title: "细节特写图",
      description:
        "放大展示顶部接触面、按键、接口、转折边缘和局部工艺，让结构与品质证据更完整。",
      imageCount: 3,
      priority: "medium",
      platformTags: ["淘宝/天猫", "京东", "细节说服"],
      selected: true,
      reason: "很多用户会在意按键、接口、接触头和做工细节，单靠主图不够支撑信任。",
      highlights: ["接触面", "按键细节", "局部做工"],
      recommended: true,
      goal: "补强结构与品质信任",
      confidence: "medium",
      evidence: ["细节位是解释产品做工和结构可信度的重要证据"],
    },
    {
      id: "structure",
      title: "结构原理示意图",
      description:
        "用剖面或说明性示意图展示散热区域、接触面和内部逻辑，增强产品可信度。",
      imageCount: 3,
      priority: "medium",
      platformTags: ["淘宝/天猫", "京东", "1688", "差异化"],
      selected: isCareDevice,
      reason: "结构解释型内容适合承接“为什么这样设计”的用户疑问。",
      highlights: ["顶部接触点", "散热结构", "功能分区"],
      goal: "提升理解与信任",
      confidence: isCareDevice ? "medium" : "low",
      evidence: ["适合解释结构设计逻辑"],
    },
    {
      id: "feature_comparison",
      title: "差异卖点对比图",
      description:
        "把便携性、适用部位、操作难度、结构亮点或使用体验整理成一屏易读的对比型图层。",
      imageCount: 2,
      priority: "medium",
      platformTags: ["淘宝/天猫", "京东", "详情页转化"],
      selected: true,
      reason: "当商品卖点较多时，对比型表达更适合帮助用户迅速抓住购买理由。",
      highlights: ["便携性", "使用体验", "结构亮点"],
      recommended: true,
      goal: "提高卖点理解效率",
      confidence: "medium",
      evidence: ["适合把多条卖点压缩到一张更容易阅读的图里"],
    },
  ];

  if (!isCareDevice) {
    types.push({
      id: "lifestyle",
      title: "生活方式氛围图",
      description:
        "通过桌面、客厅或卧室氛围构图，强化产品与生活方式的关联感。",
      imageCount: 2,
      priority: "low",
      platformTags: ["小红书", "抖店", "内容种草"],
      selected: false,
      reason: "氛围图更适合种草内容，不是所有平台都必须。",
      highlights: ["桌面搭配", "空间氛围"],
      goal: "增加情绪价值",
      confidence: "low",
      evidence: ["更偏种草，不是所有平台都必须"],
    });
  }

  if (isQuick) {
    return types
      .filter(
        (item) => item.required || item.priority === "high" || item.recommended,
      )
      .slice(0, targetCount);
  }

  return types;
};

const parseJsonText = (text: string) => {
  const source = String(text || "").trim();
  if (!source) {
    return {};
  }

  const unwrapJsonLikeString = (value: unknown): unknown => {
    if (typeof value !== "string") {
      return value;
    }

    const cleaned = value.replace(/```json|```/gi, "").trim();
    if (!cleaned) {
      return value;
    }

    try {
      const parsed = JSON.parse(cleaned);
      return typeof parsed === "string" ? unwrapJsonLikeString(parsed) : parsed;
    } catch {
      return value;
    }
  };

  const extractBalancedJsonCandidate = (value: string): string | null => {
    const start = value.search(/[\[{]/);
    if (start === -1) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < value.length; index += 1) {
      const char = value[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === "{" || char === "[") {
        depth += 1;
      } else if (char === "}" || char === "]") {
        depth -= 1;
        if (depth === 0) {
          return value.slice(start, index + 1);
        }
      }
    }

    return null;
  };

  const direct = unwrapJsonLikeString(source);
  if (direct !== source) {
    return direct;
  }

  try {
    return JSON.parse(source);
  } catch {
    const candidate = extractBalancedJsonCandidate(source);
    if (!candidate) {
      return {};
    }

    try {
      const parsed = JSON.parse(candidate);
      return typeof parsed === "string" ? unwrapJsonLikeString(parsed) : parsed;
    } catch {
      return {};
    }
  }
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toStringList = (
  value: unknown,
  splitPattern = /[\n；;]+/,
): string[] => {
  if (Array.isArray(value)) {
    return uniqueStrings(
      value
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0),
    );
  }

  if (typeof value === "string") {
    return uniqueStrings(
      value
        .split(splitPattern)
        .map((item) => item.replace(/^[-•\d.)\s]+/, "").trim())
        .filter((item) => item.length > 0),
    );
  }

  return [];
};

const normalizeConfidenceValue = (
  value: unknown,
): "high" | "medium" | "low" | undefined => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low"
  ) {
    return normalized;
  }

  if (/高|high/.test(normalized)) {
    return "high";
  }
  if (/中|medium|mid/.test(normalized)) {
    return "medium";
  }
  if (/低|low/.test(normalized)) {
    return "low";
  }

  return undefined;
};

const normalizeBooleanValue = (
  value: unknown,
  fallback: boolean,
): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (["true", "yes", "1", "是", "可用", "适合", "可以"].includes(normalized)) {
    return true;
  }
  if (
    ["false", "no", "0", "否", "不可用", "不适合", "不可以"].includes(normalized)
  ) {
    return false;
  }

  return fallback;
};

const parseImageAnalysisResult = (
  raw: unknown,
  imageId: string,
): EcommerceImageAnalysis | null => {
  const normalizedRaw = parseJsonText(
    typeof raw === "string" ? raw : JSON.stringify(raw || {}),
  );
  const itemsCandidate = asRecord(normalizedRaw)?.items;
  const arrayLike: unknown[] = Array.isArray(normalizedRaw)
    ? normalizedRaw
    : Array.isArray(itemsCandidate)
      ? itemsCandidate
      : [];
  const firstArrayItem = arrayLike[0];
  const nestedRecord =
    asRecord(firstArrayItem) ||
    asRecord(asRecord(normalizedRaw)?.item) ||
    asRecord(asRecord(normalizedRaw)?.result) ||
    asRecord(asRecord(normalizedRaw)?.analysis) ||
    asRecord(normalizedRaw);
  const record = nestedRecord;
  if (!record) {
    return null;
  }

  const nestedDescriptionPayload = parseJsonText(
    String(
      record.description ||
        record.analysis ||
        record.summary ||
        record.reason ||
        "",
    ),
  );
  const nestedDescriptionItems = asRecord(nestedDescriptionPayload)?.items;
  const nestedDescriptionRecord = Array.isArray(nestedDescriptionPayload)
    ? asRecord(nestedDescriptionPayload[0])
    : Array.isArray(nestedDescriptionItems)
      ? asRecord(nestedDescriptionItems[0])
      : asRecord(nestedDescriptionPayload);
  const effectiveRecord = nestedDescriptionRecord || record;

  const title =
    String(
      effectiveRecord.title ||
        effectiveRecord.name ||
        effectiveRecord.imageTitle ||
        effectiveRecord.angle ||
        record.title ||
        record.name ||
        record.imageTitle ||
        record.angle ||
        "",
    ).trim() || "商品图分析";
  const highlights = toStringList(
    effectiveRecord.highlights ||
      effectiveRecord.keyPoints ||
      effectiveRecord.features ||
      record.highlights ||
      record.keyPoints ||
      record.features,
    /[\n；;、]+/,
  );
  const evidence = toStringList(
    effectiveRecord.evidence ||
      effectiveRecord.basis ||
      effectiveRecord.observations ||
      record.evidence ||
      record.basis ||
      record.observations,
    /[\n；;。]+/,
  );
  const description =
    String(
      effectiveRecord.visualDescription ||
        effectiveRecord.productDescription ||
        effectiveRecord.appearance ||
        effectiveRecord.description ||
        effectiveRecord.analysis ||
        effectiveRecord.summary ||
        effectiveRecord.reason ||
        record.visualDescription ||
        record.productDescription ||
        record.appearance ||
        record.description ||
        record.analysis ||
        record.summary ||
        record.reason ||
        "",
    ).trim() ||
    [String(effectiveRecord.angle || record.angle || "").trim(), ...highlights.slice(0, 2)]
      .filter((item) => item.length > 0)
      .join("，");

  const analysisConclusion = String(
    effectiveRecord.analysisConclusion ||
      effectiveRecord.referenceAssessment ||
      effectiveRecord.referenceConclusion ||
      effectiveRecord.recommendation ||
      effectiveRecord.verdict ||
      record.analysisConclusion ||
      record.referenceAssessment ||
      record.referenceConclusion ||
      record.recommendation ||
      record.verdict ||
      "",
  ).trim();

  if (!description) {
    return null;
  }

  return {
    imageId,
    title,
    description,
    analysisConclusion: analysisConclusion || undefined,
    angle:
      String(effectiveRecord.angle || record.angle || "").trim() || undefined,
    usableAsReference: normalizeBooleanValue(
      effectiveRecord.usableAsReference ?? record.usableAsReference,
      true,
    ),
    highlights,
    materials: toStringList(
      effectiveRecord.materials ||
        effectiveRecord.material ||
        effectiveRecord.texture ||
        record.materials ||
        record.material ||
        record.texture,
      /[\n；;、,，]+/,
    ),
    confidence: normalizeConfidenceValue(
      effectiveRecord.confidence || record.confidence,
    ),
    evidence,
    source: "ai",
    usedFallback: false,
  };
};

const salvageImageAnalysisFromText = (
  rawText: string,
  imageId: string,
  fallbackItem: EcommerceImageAnalysis,
): EcommerceImageAnalysis | null => {
  const cleaned = String(rawText || "")
    .replace(/```json|```/gi, "")
    .trim();

  if (!cleaned || !hasChineseText(cleaned)) {
    return null;
  }

  const lineCandidates = cleaned
    .split(/\r?\n+/)
    .map((line) => line.replace(/^[-*#>\s]+/, "").trim())
    .filter((line) => line.length > 0);

  const extractField = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
    return "";
  };

  const title =
    extractField([
      /(?:title|标题|图名|名称)\s*[:：]\s*([^\n]+)/i,
      /(?:angle|视角)\s*[:：]\s*([^\n]+)/i,
    ]) ||
    lineCandidates.find((line) => line.length >= 4 && line.length <= 24) ||
    fallbackItem.title;

  const explicitDescription = extractField([
    /(?:description|描述|说明|分析)\s*[:：]\s*([\s\S]{20,})/i,
  ]);
  const descriptionSource =
    explicitDescription ||
    lineCandidates
      .filter((line) => line !== title)
      .join(" ")
      .trim();
  const description =
    descriptionSource.length >= 24 ? descriptionSource : fallbackItem.description;
  const analysisConclusion =
    extractField([
      /(?:analysisConclusion|referenceAssessment|referenceConclusion|结论|参考判断|是否适合参考)\s*[:：]?\s*([\s\S]{12,})/i,
    ]) ||
    fallbackItem.analysisConclusion ||
    "";

  if (!title || !description) {
    return null;
  }

  const angle =
    extractField([/(?:angle|视角|画面焦点)\s*[:：]\s*([^\n]+)/i]) ||
    fallbackItem.angle;
  const usableAsReference = /不适合参考|不建议作为参考|局部|细节补充/.test(cleaned)
    ? false
    : /适合作为参考|主参考|主体完整|正面完整/.test(cleaned)
      ? true
      : fallbackItem.usableAsReference;
  const highlights = uniqueStrings(
    toStringList(
      extractField([/(?:highlights|亮点)\s*[:：]\s*([\s\S]+)/i]) || cleaned,
      /[\n；;。]/,
    ),
  ).slice(0, 5);
  const evidence = uniqueStrings(
    toStringList(
      extractField([/(?:evidence|依据|判断依据)\s*[:：]\s*([\s\S]+)/i]) || cleaned,
      /[\n；;。]/,
    ),
  ).slice(0, 4);

  return {
    imageId,
    title,
    description,
    analysisConclusion:
      analysisConclusion ||
      (usableAsReference
        ? "这张图可以作为后续生成的参考图，但建议继续核对主体完整度和结构信息。"
        : "这张图更适合作为补充说明，不建议单独承担主体一致性约束。"),
    angle,
    usableAsReference,
    highlights: highlights.length >= 2 ? highlights : fallbackItem.highlights,
    materials: fallbackItem.materials,
    confidence: normalizeConfidenceValue(cleaned) || fallbackItem.confidence || "medium",
    evidence: evidence.length >= 1 ? evidence : fallbackItem.evidence,
    source: "ai",
    usedFallback: true,
    fallbackReason: "单图分析未完整返回结构化 JSON，当前已尽量从原始分析文本中提取可用内容。",
  };
};

const parseStageReviewResult = (raw: unknown): EcommerceStageReview | null => {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const verdict = String(record.verdict || "").trim();
  const reviewerNotes = toStringList(record.reviewerNotes);
  const risks = toStringList(record.risks);
  const confidence = normalizeConfidenceValue(record.confidence) || "medium";

  if (!verdict && reviewerNotes.length === 0 && risks.length === 0) {
    return null;
  }

  return {
    confidence,
    verdict,
    reviewerNotes,
    risks,
  };
};

const parseAnalysisReviewResult = (
  raw: unknown,
): EcommerceAnalysisReview | null => {
  const parsed = parseStageReviewResult(
    typeof raw === "string" ? parseJsonText(raw) : raw,
  );
  return parsed
    ? {
        confidence: parsed.confidence,
        verdict: parsed.verdict,
        reviewerNotes: parsed.reviewerNotes,
        risks: parsed.risks,
      }
    : null;
};

const summarizeUnknownValueShape = (value: unknown): string => {
  if (Array.isArray(value)) {
    if (value.length === 0) return "array(0)";
    const first = value[0];
    if (typeof first === "string") return `array(${value.length}):string`;
    if (first && typeof first === "object" && !Array.isArray(first)) {
      return `array(${value.length}):object(${Object.keys(asRecord(first) || {}).slice(0, 6).join(",")})`;
    }
    return `array(${value.length}):${typeof first}`;
  }

  if (value && typeof value === "object") {
    return `object(${Object.keys(asRecord(value) || {}).slice(0, 10).join(",")})`;
  }

  return typeof value;
};

const ANALYZE_PRODUCT_NESTED_RECORD_KEYS = [
  "data",
  "result",
  "output",
  "payload",
  "analysis",
  "response",
  "content",
];

const ANALYZE_PRODUCT_TYPE_ARRAY_KEYS = [
  "recommendedTypes",
  "types",
  "recommendations",
  "recommended",
  "suggestedTypes",
  "typeSuggestions",
  "outputTypes",
];

const ANALYZE_PRODUCT_REVIEW_KEYS = [
  "review",
  "analysisReview",
  "reviewResult",
  "finalReview",
  "audit",
  "verification",
];

const ANALYZE_PRODUCT_SUMMARY_KEYS = [
  "summary",
  "analysisSummary",
  "overview",
  "conclusion",
  "productSummary",
];

const ANALYZE_PRODUCT_EVOLUTION_KEYS = [
  "evolutionProposals",
  "archetypeEvolutionProposals",
  "evolutionCandidates",
];

const collectAnalyzeProductCandidateRecords = (
  raw: unknown,
): Record<string, unknown>[] => {
  const queue: unknown[] = [typeof raw === "string" ? parseJsonText(raw) : raw];
  const results: Record<string, unknown>[] = [];
  const seen = new Set<Record<string, unknown>>();

  while (queue.length > 0) {
    const current = asRecord(queue.shift());
    if (!current || seen.has(current)) {
      continue;
    }

    seen.add(current);
    results.push(current);

    ANALYZE_PRODUCT_NESTED_RECORD_KEYS.forEach((key) => {
      const nested = asRecord(current[key]);
      if (nested && !seen.has(nested)) {
        queue.push(nested);
      }
    });
  }

  return results;
};

const extractAnalyzeProductRecommendedTypeCandidates = (
  raw: unknown,
): unknown[] => {
  for (const record of collectAnalyzeProductCandidateRecords(raw)) {
    for (const key of ANALYZE_PRODUCT_TYPE_ARRAY_KEYS) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[];
      }
    }
  }
  return [];
};

const extractAnalyzeProductEvolutionCandidates = (
  raw: unknown,
): unknown[] => {
  for (const record of collectAnalyzeProductCandidateRecords(raw)) {
    for (const key of ANALYZE_PRODUCT_EVOLUTION_KEYS) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[];
      }
    }
  }
  return [];
};

const extractAnalyzeProductReviewCandidate = (
  raw: unknown,
): unknown => {
  const root = asRecord(typeof raw === "string" ? parseJsonText(raw) : raw);
  if (
    root &&
    (root.confidence !== undefined ||
      root.verdict !== undefined ||
      root.reviewerNotes !== undefined ||
      root.risks !== undefined)
  ) {
    return root;
  }

  for (const record of collectAnalyzeProductCandidateRecords(raw)) {
    for (const key of ANALYZE_PRODUCT_REVIEW_KEYS) {
      if (record[key] !== undefined) {
        return record[key];
      }
    }
  }
  return null;
};

const extractAnalyzeProductSummaryText = (raw: unknown): string => {
  for (const record of collectAnalyzeProductCandidateRecords(raw)) {
    for (const key of ANALYZE_PRODUCT_SUMMARY_KEYS) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }
  return "";
};

const summarizeAnalyzeProductPayload = (
  parsed: unknown,
  extractedTypeCount: number,
  extractedReview: EcommerceAnalysisReview | null,
  evolutionProposalCount: number,
) => {
  const raw = asRecord(parsed) || {};
  const topLevelKeys = Object.keys(raw);
  const candidateSchemaKeys = [
    ...ANALYZE_PRODUCT_TYPE_ARRAY_KEYS,
    ...ANALYZE_PRODUCT_REVIEW_KEYS,
    ...ANALYZE_PRODUCT_SUMMARY_KEYS,
    ...ANALYZE_PRODUCT_EVOLUTION_KEYS,
  ].filter((key, index, all) => all.indexOf(key) === index && key in raw);

  return {
    topLevelKeys,
    candidateSchemaKeys,
    keyShapes: topLevelKeys.slice(0, 12).map((key) => ({
      key,
      shape: summarizeUnknownValueShape(raw[key]),
    })),
    extractedTypeCount,
    extractedReviewPresent: Boolean(extractedReview),
    extractedReviewConfidence: extractedReview?.confidence || null,
    extractedSummaryLength: extractAnalyzeProductSummaryText(parsed).length,
    evolutionProposalCount,
  };
};

const buildAnalyzeProductRescuePrompt = (params: {
  brief: string;
  feedback: string;
  platformMode?: EcommercePlatformMode;
  workflowMode?: EcommerceWorkflowMode;
}) => {
  const minimumTypeCount = params.workflowMode === "quick" ? 5 : 8;
  const skeleton = {
    summary: "用中文总结商品定位、购买理由和详情页应优先讲什么",
    recommendedTypes: [
      {
        id: "hero_multi",
        title: "商品主图",
        description: "用中文写这组图要展示什么",
        imageCount: 4,
        priority: "high",
        platformTags: [],
        selected: true,
        reason: "用中文说明为什么必须做",
        highlights: ["中文亮点 1", "中文亮点 2"],
        recommended: true,
        required: true,
        goal: "用中文说明转化目标",
        confidence: "medium",
        evidence: ["中文依据 1", "中文依据 2"],
      },
    ],
    review: {
      confidence: "medium",
      verdict: "用中文说明当前推荐是否可以进入下一步",
      reviewerNotes: ["中文复核点 1", "中文复核点 2"],
      risks: ["中文风险点"],
    },
    evolutionProposals: [],
  };

  return [
    "Return exactly one JSON object.",
    "Do not return {}.",
    "All user-visible strings must be Simplified Chinese.",
    `Return at least ${minimumTypeCount} recommendedTypes unless the product image truly makes that impossible.`,
    "Infer conservatively from the product images even if the user brief is short or empty.",
    "Use only these top-level keys: summary, recommendedTypes, review, evolutionProposals.",
    "Reuse stable ecommerce ids when possible, such as hero_multi, white_bg, selling_points, usage_scene, steps, size_hold, structure, ingredient_story, texture_demo, lifestyle, detail_highlights, feature_comparison.",
    `Platform mode: ${getPlatformModeLabel(params.platformMode)}`,
    `Workflow mode: ${getWorkflowModeLabel(params.workflowMode)}`,
    `Platform requirements: ${buildPlatformRequirementText(params.platformMode)}`,
    `User brief: ${params.brief || "(empty)"}`,
    `User feedback: ${params.feedback || "(empty)"}`,
    "Output example schema:",
    JSON.stringify(skeleton),
  ].join("\n");
};

const getAlternateAnalyzeProductModels = (primaryModel: string): string[] => {
  const configured = getMappedModelConfigs("script")
    .slice(1)
    .map((item) => String(item.raw || item.modelId || "").trim())
    .filter(Boolean);

  return configured
    .filter((candidate) => candidate !== primaryModel)
    .slice(0, 6);
};

const normalizeSupplementFieldKind = (
  value: unknown,
): EcommerceSupplementField["kind"] | undefined => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

  if (
    normalized === "text" ||
    normalized === "textarea" ||
    normalized === "single-select" ||
    normalized === "multi-select" ||
    normalized === "image"
  ) {
    return normalized;
  }
  if (
    normalized === "single" ||
    normalized === "select" ||
    normalized === "radio" ||
    normalized === "single-choice" ||
    normalized === "choice" ||
    normalized === "dropdown" ||
    normalized === "??"
  ) {
    return "single-select";
  }
  if (
    normalized === "multi" ||
    normalized === "multiselect" ||
    normalized === "checkbox" ||
    normalized === "multiple-choice" ||
    normalized === "multi-choice" ||
    normalized === "??"
  ) {
    return "multi-select";
  }
  if (
    normalized === "text-area" ||
    normalized === "long-text" ||
    normalized === "paragraph" ||
    normalized === "???" ||
    normalized === "????"
  ) {
    return "textarea";
  }
  if (normalized === "??" || normalized === "????" || normalized === "input") {
    return "text";
  }
  if (normalized === "??" || normalized === "image-upload" || normalized === "upload") {
    return "image";
  }
  return undefined;
};

const parseSupplementFieldResult = (
  raw: unknown,
  index: number,
): EcommerceSupplementField | null => {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const kind = normalizeSupplementFieldKind(
    record.kind ||
      record.type ||
      record.inputType ||
      record.controlType ||
      record.component ||
      record.widget,
  );
  const label = String(
    record.label ||
      record.question ||
      record.prompt ||
      record.fieldLabel ||
      record.title ||
      record.name ||
      "",
  ).trim();
  const id =
    String(
      record.id ||
        record.fieldId ||
        record.key ||
        record.name ||
        record.code ||
        "",
    ).trim() || `supplement_field_${index + 1}`;

  if (!kind || !label) {
    return null;
  }

  const valueRaw =
    record.value ??
    record.defaultValue ??
    record.answer ??
    record.suggestedValue ??
    record.initialValue;
  const value =
    kind === "multi-select" || kind === "image"
      ? toStringList(valueRaw, /[\n,\uFF0C\u3001\uFF1B;]+/)
      : Array.isArray(valueRaw)
        ? toStringList(valueRaw, /[\n,\uFF0C\u3001\uFF1B;]+/)[0] || undefined
        : typeof valueRaw === "string"
          ? valueRaw.trim() || undefined
          : undefined;

  const maxItemsRaw =
    typeof (record.maxItems ?? record.limit ?? record.maxCount) === "number"
      ? Number(record.maxItems ?? record.limit ?? record.maxCount)
      : Number.parseInt(
          String(record.maxItems ?? record.limit ?? record.maxCount ?? ""),
          10,
        );

  return {
    id,
    label,
    kind,
    required:
      kind === "image"
        ? false
        : normalizeBooleanValue(record.required ?? record.isRequired, false),
    placeholder: String(record.placeholder || record.example || "").trim() || undefined,
    options: toStringList(
      record.options ??
        record.choices ??
        record.items ??
        record.candidates ??
        record.suggestedOptions,
      /[\n,\uFF0C\u3001\uFF1B;]+/,
    ),
    value,
    helperText: String(
      record.helperText ||
        record.helpText ||
        record.reason ||
        record.why ||
        record.hint ||
        "",
    ).trim() || undefined,
    maxItems:
      Number.isFinite(maxItemsRaw) && maxItemsRaw >= 1 && maxItemsRaw <= 9
        ? maxItemsRaw
        : undefined,
    valueSource:
      record.valueSource === "user" ||
      record.valueSource === "ai" ||
      record.valueSource === "estimated"
        ? record.valueSource
        : undefined,
    valueConfidence: normalizeConfidenceValue(record.valueConfidence),
    valueNote: String(record.valueNote || record.note || "").trim() || undefined,
  };
};

const parseSupplementFieldsFromUnknown = (
  raw: unknown,
): EcommerceSupplementField[] => {
  const parsedRaw = typeof raw === "string" ? parseJsonText(raw) : raw;
  const queue: unknown[] = [parsedRaw];
  const seen = new Set<Record<string, unknown>>();
  const candidateArrays: unknown[][] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      candidateArrays.push(current);
      continue;
    }

    const record = asRecord(current);
    if (!record || seen.has(record)) {
      continue;
    }
    seen.add(record);

    const arrayCandidates = [
      record.fields,
      record.data,
      record.result,
      record.output,
      record.payload,
      record.supplements,
      record.answers,
      record.items,
      record.values,
      asRecord(record.data)?.fields,
      asRecord(record.result)?.fields,
      asRecord(record.output)?.fields,
      asRecord(record.payload)?.fields,
      asRecord(record.data)?.supplements,
      asRecord(record.result)?.supplements,
      asRecord(record.output)?.supplements,
      asRecord(record.payload)?.supplements,
      asRecord(record.data)?.items,
      asRecord(record.result)?.items,
      asRecord(record.output)?.items,
      asRecord(record.payload)?.items,
    ].filter(Array.isArray) as unknown[][];

    candidateArrays.push(...arrayCandidates);

    [
      record.data,
      record.result,
      record.output,
      record.payload,
      record.response,
      record.content,
      record.message,
    ].forEach((nested) => {
      if (nested !== undefined) {
        queue.push(nested);
      }
    });
  }

  for (const candidates of candidateArrays) {
    const parsedFields = candidates
      .map((item, index) => parseSupplementFieldResult(item, index))
      .filter((item): item is EcommerceSupplementField => Boolean(item));
    if (parsedFields.length > 0) {
      return parsedFields;
    }
  }

  return [];
};

const parsePriorityValue = (
  value: unknown,
): "high" | "medium" | "low" | undefined => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low"
  ) {
    return normalized;
  }
  if (/高|high/.test(normalized)) {
    return "high";
  }
  if (/中|medium|mid/.test(normalized)) {
    return "medium";
  }
  if (/低|low/.test(normalized)) {
    return "low";
  }
  return undefined;
};

const parseRecommendedTypeResult = (
  raw: unknown,
): EcommerceRecommendedType | null => {
  const record = asRecord(typeof raw === "string" ? parseJsonText(raw) : raw);
  if (!record) {
    return null;
  }

  const rawId = String(record.id || record.typeId || "").trim();
  const title =
    String(record.title || record.typeTitle || record.name || "").trim() ||
    (rawId ? RECOMMENDED_TYPE_TITLE_FALLBACKS[rawId] || "" : "");
  const id = resolveRecommendedTypeId(rawId, title);
  const reason =
    String(
      record.reason || record.why || record.recommendReason || "",
    ).trim() || undefined;
  const goal =
    String(record.goal || record.target || record.marketingGoal || "").trim() ||
    undefined;
  const description =
    String(record.description || record.desc || record.summary || "").trim() ||
    reason ||
    goal ||
    (id ? RECOMMENDED_TYPE_DESCRIPTION_FALLBACKS[id] || "" : "");

  if (!id || !title || !description) {
    return null;
  }

  const imageCount = Number.parseInt(
    String(record.imageCount || record.count || record.image_count || "0"),
    10,
  );

  return {
    id,
    title,
    description,
    imageCount:
      Number.isFinite(imageCount) && imageCount > 0
        ? Math.min(Math.max(imageCount, 1), 12)
        : 3,
    priority: parsePriorityValue(record.priority) || "medium",
    platformTags: toStringList(
      record.platformTags || record.platformFit || record.tags,
      /[\n；;、,，]+/,
    ),
    selected: normalizeBooleanValue(record.selected, true),
    reason,
    highlights: toStringList(
      record.highlights || record.keyPoints || record.sellingPoints,
      /[\n；;、]+/,
    ),
    recommended: record.recommended === undefined
      ? undefined
      : normalizeBooleanValue(record.recommended, false),
    required: record.required === undefined
      ? undefined
      : normalizeBooleanValue(record.required, false),
    goal,
    confidence: normalizeConfidenceValue(record.confidence),
    evidence: toStringList(
      record.evidence || record.basis || record.supportingPoints,
    ),
    omittedReason:
      String(record.omittedReason || record.skipReason || "").trim() ||
      undefined,
    source: "ai",
    usedFallback: false,
  };
};

const normalizeEvolutionProposalCandidateId = (
  value: string,
  fallbackLabel: string,
): string => {
  const normalized = String(value || fallbackLabel || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "candidate-archetype";
};

const parseEvolutionProposalResult = (
  raw: unknown,
): EcommerceArchetypeEvolutionProposal | null => {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const label = String(
    record.label || record.title || record.name || "",
  ).trim();
  const appliesWhen = String(
    record.appliesWhen || record.whenToUse || record.scope || "",
  ).trim();
  const whyCurrentArchetypesFail = String(
    record.whyCurrentArchetypesFail ||
      record.whyCurrentRulesFail ||
      record.problem ||
      "",
  ).trim();
  const proposedDecisionFactors = toStringList(
    record.proposedDecisionFactors || record.decisionFactors,
  );
  const proposedMustShow = toStringList(
    record.proposedMustShow || record.mustShow,
  );
  const proposedVisualProofGrammar = toStringList(
    record.proposedVisualProofGrammar ||
      record.visualProofGrammar ||
      record.visualGrammar,
  );
  const boundaryExamples = toStringList(
    record.boundaryExamples || record.examples,
  );
  const confidence = normalizeConfidenceValue(record.confidence) || "medium";

  if (!label || !appliesWhen || !whyCurrentArchetypesFail) {
    return null;
  }

  return {
    candidateId: normalizeEvolutionProposalCandidateId(
      String(record.candidateId || record.id || ""),
      label,
    ),
    label,
    appliesWhen,
    whyCurrentArchetypesFail,
    proposedDecisionFactors,
    proposedMustShow,
    proposedVisualProofGrammar,
    boundaryExamples,
    confidence,
  };
};

const normalizeEvolutionProposalsForUi = (
  items: EcommerceArchetypeEvolutionProposal[],
): EcommerceArchetypeEvolutionProposal[] => {
  const merged = new Map<string, EcommerceArchetypeEvolutionProposal>();

  items.forEach((item) => {
    const candidateId = String(item.candidateId || "").trim();
    if (!candidateId) {
      return;
    }
    const previous = merged.get(candidateId);
    if (!previous) {
      merged.set(candidateId, {
        ...item,
        proposedDecisionFactors: Array.from(
          new Set(item.proposedDecisionFactors || []),
        ),
        proposedMustShow: Array.from(new Set(item.proposedMustShow || [])),
        proposedVisualProofGrammar: Array.from(
          new Set(item.proposedVisualProofGrammar || []),
        ),
        boundaryExamples: Array.from(new Set(item.boundaryExamples || [])),
      });
      return;
    }

    merged.set(candidateId, {
      ...previous,
      ...item,
      label:
        String(item.label || "").trim().length >=
        String(previous.label || "").trim().length
          ? item.label
          : previous.label,
      appliesWhen:
        String(item.appliesWhen || "").trim().length >=
        String(previous.appliesWhen || "").trim().length
          ? item.appliesWhen
          : previous.appliesWhen,
      whyCurrentArchetypesFail:
        String(item.whyCurrentArchetypesFail || "").trim().length >=
        String(previous.whyCurrentArchetypesFail || "").trim().length
          ? item.whyCurrentArchetypesFail
          : previous.whyCurrentArchetypesFail,
      proposedDecisionFactors: Array.from(
        new Set([
          ...(previous.proposedDecisionFactors || []),
          ...(item.proposedDecisionFactors || []),
        ]),
      ),
      proposedMustShow: Array.from(
        new Set([...(previous.proposedMustShow || []), ...(item.proposedMustShow || [])]),
      ),
      proposedVisualProofGrammar: Array.from(
        new Set([
          ...(previous.proposedVisualProofGrammar || []),
          ...(item.proposedVisualProofGrammar || []),
        ]),
      ),
      boundaryExamples: Array.from(
        new Set([...(previous.boundaryExamples || []), ...(item.boundaryExamples || [])]),
      ),
      confidence:
        previous.confidence === "high" || item.confidence === "high"
          ? "high"
          : previous.confidence === "medium" || item.confidence === "medium"
            ? "medium"
            : "low",
    });
  });

  return Array.from(merged.values());
};

const enrichRecommendedTypesWithFallback = (
  items: EcommerceRecommendedType[],
  fallback: EcommerceRecommendedType[],
): EcommerceRecommendedType[] => {
  const fallbackById = new Map(fallback.map((item) => [item.id, item]));

  return items.map((item) => {
    const fallbackItem = fallbackById.get(item.id);
    if (!fallbackItem) {
      return { ...item, source: item.source || "ai", usedFallback: false };
    }

    const shouldBorrowDescription =
      !item.description || !hasChineseText(item.description);
    const shouldBorrowReason = !item.reason || !hasChineseText(item.reason);
    const shouldBorrowHighlights =
      !item.highlights || item.highlights.length === 0;
    const shouldBorrowEvidence =
      !item.evidence || item.evidence.length === 0;
    const usedFallback =
      item.source === "fallback" ||
      shouldBorrowDescription ||
      (shouldBorrowReason && shouldBorrowHighlights && shouldBorrowEvidence);

    return {
      ...item,
      description: shouldBorrowDescription ? fallbackItem.description : item.description,
      imageCount: item.imageCount || 1,
      priority: item.priority || "medium",
      platformTags: item.platformTags || [],
      reason: shouldBorrowReason ? fallbackItem.reason : item.reason,
      highlights:
        item.highlights && item.highlights.length > 0
          ? item.highlights
          : shouldBorrowHighlights
            ? fallbackItem.highlights
            : item.highlights,
      recommended:
        item.recommended === undefined
          ? true
          : item.recommended,
      required:
        item.required === undefined ? false : item.required,
      goal: item.goal,
      confidence: item.confidence || "medium",
      evidence:
        item.evidence && item.evidence.length > 0
          ? item.evidence
          : shouldBorrowEvidence
            ? fallbackItem.evidence
            : item.evidence,
      omittedReason: item.omittedReason,
      source: item.source || "ai",
      usedFallback,
      fallbackReason:
        item.source === "fallback"
          ? item.fallbackReason || "该推荐项来自保护性推荐池补全。"
          : usedFallback
            ? "该推荐项缺少关键信息，当前仅补齐了必要字段。"
            : undefined,
    };
  });
};

const LAYOUT_MODE_VALUES: EcommerceLayoutMode[] = [
  "top-banner",
  "left-copy",
  "right-copy",
  "bottom-panel",
  "center-focus-with-edge-space",
  "split-info",
];

const IMAGE_ROLE_VALUES: EcommerceImageRole[] = [
  "hero",
  "selling-point",
  "parameter",
  "structure",
  "detail",
  "scene",
  "comparison",
  "summary",
];

const COMPONENT_NEED_VALUES: EcommerceComponentNeed[] = [
  "text-only",
  "text-and-icons",
  "text-and-stats",
  "annotation-heavy",
  "comparison-heavy",
];

const LAYOUT_AREA_VALUES: EcommerceLayoutAreaKind[] = [
  "headline",
  "subheadline",
  "stats",
  "icons",
  "body",
  "comparison",
  "annotation",
];

const parseEnumValue = <T extends string>(
  value: unknown,
  candidates: readonly T[],
): T | undefined => {
  const text = String(value || "").trim();
  return candidates.includes(text as T) ? (text as T) : undefined;
};

const uniqueStringList = <T extends string>(items: Array<T | undefined>): T[] =>
  Array.from(new Set(items.filter((item): item is T => Boolean(item))));

const inferLayoutIntent = ({
  typeId,
  typeTitle,
  title,
  description,
  promptOutline,
  marketingGoal,
  keyMessage,
}: {
  typeId: string;
  typeTitle: string;
  title: string;
  description: string;
  promptOutline: string;
  marketingGoal?: string;
  keyMessage?: string;
}): EcommerceLayoutIntent => {
  const text = [
    typeId,
    typeTitle,
    title,
    description,
    promptOutline,
    marketingGoal || "",
    keyMessage || "",
  ]
    .join(" ")
    .toLowerCase();

  const imageRole: EcommerceImageRole =
    typeId === "white_bg"
      ? "hero"
      : typeId === "selling_points"
        ? "selling-point"
        : typeId === "usage_scene"
          ? "scene"
          : typeId === "steps"
            ? "detail"
            : typeId === "size_hold"
              ? "parameter"
              : /对比|pk|before|after|vs/.test(text)
                ? "comparison"
                : /参数|尺寸|规格|容量|数字/.test(text)
                  ? "parameter"
                  : /结构|拆解|剖面|内部/.test(text)
                    ? "structure"
                    : /细节|特写|纹理|材质|局部/.test(text)
                      ? "detail"
                      : /场景|客厅|卧室|厨房|人物|氛围|空间|使用/.test(text)
                        ? "scene"
                        : /总结|合集|总览|汇总/.test(text)
                          ? "summary"
                          : "hero";

  const layoutMode: EcommerceLayoutMode =
    /左侧留白|左文右图|left copy|left text/.test(text)
      ? "left-copy"
      : /右侧留白|右文左图|right copy|right text/.test(text)
        ? "right-copy"
        : /顶部标题|顶部横幅|top banner/.test(text)
          ? "top-banner"
          : /底部信息|底栏|bottom panel/.test(text)
            ? "bottom-panel"
            : imageRole === "comparison" || imageRole === "parameter"
              ? "split-info"
              : imageRole === "scene" || imageRole === "hero"
                ? "center-focus-with-edge-space"
                : "bottom-panel";

  const componentNeed: EcommerceComponentNeed =
    imageRole === "comparison"
      ? "comparison-heavy"
      : imageRole === "parameter"
        ? "text-and-stats"
        : imageRole === "structure" || /标注|箭头|说明|圈点/.test(text)
          ? "annotation-heavy"
          : /图标|icon|卖点词/.test(text)
            ? "text-and-icons"
            : imageRole === "hero" || imageRole === "scene"
              ? "text-and-icons"
              : "text-only";

  const reservedAreas = uniqueStringList<EcommerceLayoutAreaKind>([
    "headline",
    componentNeed === "text-only" ? "subheadline" : undefined,
    componentNeed === "text-and-icons" ? "icons" : undefined,
    componentNeed === "text-and-stats" ? "stats" : undefined,
    componentNeed === "annotation-heavy" ? "annotation" : undefined,
    componentNeed === "comparison-heavy" ? "comparison" : undefined,
    layoutMode === "left-copy" || layoutMode === "right-copy" ? "body" : undefined,
  ]);

  return {
    imageRole,
    layoutMode,
    componentNeed,
    reservedAreas,
  };
};

const parseLayoutIntentRecord = (
  record: Record<string, unknown>,
): EcommerceLayoutIntent | undefined => {
  const reservedAreas = toStringList(record.reservedAreas).filter((item) =>
    LAYOUT_AREA_VALUES.includes(item as EcommerceLayoutAreaKind),
  ) as EcommerceLayoutAreaKind[];
  const imageRole = parseEnumValue(record.imageRole, IMAGE_ROLE_VALUES);
  const layoutMode = parseEnumValue(record.layoutMode, LAYOUT_MODE_VALUES);
  const componentNeed = parseEnumValue(
    record.componentNeed,
    COMPONENT_NEED_VALUES,
  );

  if (!imageRole && !layoutMode && !componentNeed && reservedAreas.length === 0) {
    return undefined;
  }

  return {
    imageRole,
    layoutMode,
    componentNeed,
    reservedAreas,
  };
};

const parsePlanItemResult = (
  raw: unknown,
  index: number,
  typeId: string,
  typeTitle: string,
  platformMode?: EcommercePlatformMode,
): EcommercePlanItem | null => {
  const parsedRaw = parseJsonText(
    typeof raw === "string" ? raw : JSON.stringify(raw || {}),
  );
  const record = asRecord(parsedRaw) || asRecord(raw);
  if (!record) {
    return null;
  }

  const title =
    String(record.title || record.name || "").trim() || `${typeTitle} ${index + 1}`;
  const description =
    String(record.description || record.summary || record.idea || "").trim() ||
    String(record.keyMessage || record.marketingGoal || "").trim();
  const promptOutline =
    String(
      record.promptOutline ||
        record.prompt ||
        record.promptDraft ||
        record.scenePrompt ||
        "",
    ).trim() ||
    description;

  if (!title || !description || !promptOutline) {
    return null;
  }

  const directLayoutIntent =
    parseLayoutIntentRecord(asRecord(record.layoutIntent) || {}) ||
    parseLayoutIntentRecord(record);
  const layoutIntent =
    directLayoutIntent ||
    inferLayoutIntent({
      typeId,
      typeTitle,
      title,
      description,
      promptOutline,
      marketingGoal: String(record.marketingGoal || "").trim(),
      keyMessage: String(record.keyMessage || "").trim(),
    });

  return {
    id: String(record.id || `${typeTitle}-${index + 1}`).trim() || `${typeTitle}-${index + 1}`,
    title,
    description,
    promptOutline,
    ratio: normalizePlannedEcommercePlanRatio({
      platformMode,
      typeId,
      typeTitle,
      itemTitle: title,
      itemDescription: description,
      preferredRatio: String(record.ratio || "").trim(),
    }),
    referenceImageIds: toStringList(record.referenceImageIds, /[\n；;、,，]+/),
    status:
      String(record.status || "").trim() === "draft" ? "draft" : "ready",
    marketingGoal: String(record.marketingGoal || "").trim() || undefined,
    keyMessage: String(record.keyMessage || "").trim() || undefined,
    mustShow: toStringList(record.mustShow, /[\n；;、,，]+/),
    composition: String(record.composition || "").trim() || undefined,
    styling: String(record.styling || "").trim() || undefined,
    background: String(record.background || "").trim() || undefined,
    lighting: String(record.lighting || "").trim() || undefined,
    platformFit: toStringList(record.platformFit, /[\n；;、,，]+/),
    riskNotes: toStringList(record.riskNotes),
    layoutIntent,
  };
};

const parsePlanGroupResult = (
  raw: unknown,
  index: number,
  platformMode?: EcommercePlatformMode,
): EcommercePlanGroup | null => {
  const parsedRaw = parseJsonText(
    typeof raw === "string" ? raw : JSON.stringify(raw || {}),
  );
  const record =
    asRecord(parsedRaw) ||
    asRecord(asRecord(parsedRaw)?.group) ||
    asRecord(raw);
  if (!record) {
    return null;
  }

  const rawTypeId = String(record.typeId || record.id || "").trim();
  const rawTypeTitle = String(record.typeTitle || record.title || "").trim();
  const typeId = resolveRecommendedTypeId(rawTypeId, rawTypeTitle);
  const typeTitle =
    rawTypeTitle ||
    (typeId ? RECOMMENDED_TYPE_TITLE_FALLBACKS[typeId] || "" : "");
  const rawItems = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.plans)
      ? record.plans
      : Array.isArray(record.planItems)
        ? record.planItems
        : [];
  const parsedItems = rawItems
    .map((item, itemIndex) =>
      parsePlanItemResult(
        item,
        itemIndex,
        typeId,
        typeTitle || typeId || `方案分组${index + 1}`,
        platformMode,
      ),
    )
    .filter((item): item is EcommercePlanItem => Boolean(item));
  const directItem =
    parsedItems.length === 0
      ? parsePlanItemResult(
          record,
          0,
          typeId,
          typeTitle || typeId || `方案分组${index + 1}`,
          platformMode,
        )
      : null;
  const items = directItem ? [directItem] : parsedItems;

  if (!typeId || !typeTitle || items.length === 0) {
    return null;
  }

  return {
    typeId,
    typeTitle,
    items,
    summary:
      String(record.summary || record.description || record.groupSummary || "").trim() ||
      undefined,
    strategy: (
      Array.isArray(record.strategy)
        ? record.strategy
        : Array.isArray(record.planStrategy)
          ? record.planStrategy
          : []
    )
      .map((entry, strategyIndex) => {
        if (typeof entry === "string") {
          const value = String(entry || "").trim();
          return value
            ? { label: `策略 ${strategyIndex + 1}`, value }
            : null;
        }
        const parsed = asRecord(entry);
        if (!parsed) return null;
        const label =
          String(
            parsed.label ||
              parsed.title ||
              parsed.name ||
              `策略 ${strategyIndex + 1}`,
          ).trim() || `策略 ${strategyIndex + 1}`;
        const value = String(parsed.value || parsed.description || parsed.text || "").trim();
        return label && value ? { label, value } : null;
      })
      .filter((entry): entry is { label: string; value: string } => Boolean(entry)),
    platformTags: toStringList(
      record.platformTags || record.platformFit || record.tags,
      /[\n；;、,，]+/,
    ),
    priority: parsePriorityValue(record.priority),
    source: "ai",
    usedFallback: false,
  };
};

const PLAN_GROUP_MIN_ITEM_COUNT: Record<string, number> = {
  hero_multi: 3,
  white_bg: 2,
  selling_points: 3,
  usage_scene: 2,
  steps: 2,
  size_hold: 2,
  structure: 2,
  ingredient_story: 2,
  texture_demo: 2,
  detail_highlights: 2,
};

const getPlanGroupTargetItemCount = (typeId: string, requestedCount: number) =>
  Math.max(1, requestedCount || PLAN_GROUP_MIN_ITEM_COUNT[typeId] || 1);

const mergePlanStrategyWithFallback = (
  strategy: Array<{ label: string; value: string }> = [],
  fallback: Array<{ label: string; value: string }> = [],
) => {
  const merged = new Map<string, { label: string; value: string }>();
  fallback.forEach((entry) => {
    if (entry.label && entry.value) {
      merged.set(entry.label, entry);
    }
  });
  strategy.forEach((entry) => {
    if (entry.label && entry.value) {
      merged.set(entry.label, entry);
    }
  });
  return Array.from(merged.values());
};

type PlanGroupRequirement = {
  typeId: string;
  typeTitle: string;
  expectedItemCount: number;
  priority?: "high" | "medium" | "low";
};

const buildPlanRequirementsFromSelectedTypes = (
  selectedTypes: Array<{ id: string; title: string; imageCount: number }>,
): PlanGroupRequirement[] =>
  selectedTypes.map((typeItem) => ({
    typeId: typeItem.id,
    typeTitle: typeItem.title,
    expectedItemCount: typeItem.imageCount,
  }));

const buildPlanRequirementsFromGroups = (
  groups: EcommercePlanGroup[],
): PlanGroupRequirement[] =>
  groups.map((group) => ({
    typeId: group.typeId,
    typeTitle: group.typeTitle,
    expectedItemCount: group.items.length,
    priority: group.priority,
  }));

const buildPlanTypeRequirementText = (
  selectedTypes: Array<{ id: string; title: string; imageCount: number }>,
) =>
  selectedTypes.map((typeItem) => buildTypeRequirementPrincipleText(typeItem)).join("\n");

const PLAN_PROMPT_MAX_IMAGE_ANALYSES = 3;
const PLAN_PROMPT_MAX_GROUP_ITEMS = 3;

const buildCompactPlanSelectedTypesText = (
  selectedTypes: Array<{ id: string; title: string; imageCount: number }>,
): string =>
  JSON.stringify(
    selectedTypes.map((typeItem) => ({
      id: typeItem.id,
      title: typeItem.title,
      imageCount: getPlanGroupTargetItemCount(typeItem.id, typeItem.imageCount),
    })),
  );

const buildCompactPlanImageAnalysesText = (
  imageAnalyses: Array<Record<string, unknown>>,
): string =>
  JSON.stringify(
    imageAnalyses.slice(0, PLAN_PROMPT_MAX_IMAGE_ANALYSES).map((item, index) => ({
      index: index + 1,
      imageId: String(item.imageId || ''),
      title: String(item.title || ''),
      angle: String(item.angle || ''),
      description: String(item.description || '').slice(0, 120),
      analysisConclusion: String(item.analysisConclusion || '').slice(0, 100),
      usableAsReference: Boolean(item.usableAsReference),
    })),
  );

const buildCompactPlanGroupsText = (
  groups: EcommercePlanGroup[],
): string =>
  JSON.stringify(
    groups.map((group) => ({
      typeId: group.typeId,
      typeTitle: group.typeTitle,
      summary: String(group.summary || '').slice(0, 80),
      strategy: (group.strategy || []).slice(0, 2).map((entry) => ({
        label: String(entry.label || '').slice(0, 20),
        value: String(entry.value || '').slice(0, 50),
      })),
      items: (group.items || []).slice(0, PLAN_PROMPT_MAX_GROUP_ITEMS).map((item) => ({
        id: item.id,
        title: item.title,
        description: String(item.description || '').slice(0, 80),
        promptOutline: String(item.promptOutline || '').slice(0, 80),
        ratio: item.ratio,
        layoutIntent: item.layoutIntent,
      })),
    })),
  );

const normalizePlanDiagnosticText = (value?: string | null): string =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？、；：,.!?;:()（）【】\[\]'"“”‘’—\-_/]/g, "")
    .trim();

const extractPlanGroundingAnchors = ({
  brief,
  supplementSummary,
  imageAnalyses,
}: {
  brief?: string;
  supplementSummary?: string;
  imageAnalyses?: Array<{
    title?: string;
    description?: string;
    analysisConclusion?: string;
  }>;
}): string[] => {
  const rawItems = [
    getBriefSubjectLabel(String(brief || "").trim(), "当前商品"),
    ...((imageAnalyses || []).slice(0, 3).flatMap((item) => [
      String(item.title || "").trim(),
      String(item.description || "").trim().slice(0, 48),
      String(item.analysisConclusion || "").trim().slice(0, 36),
    ]) || []),
    String(supplementSummary || "").trim().slice(0, 48),
  ].filter((item) => item && item.length >= 2);

  return uniqueStrings(
    rawItems.flatMap((item) => {
      const trimmed = String(item || "").trim();
      if (!trimmed) {
        return [];
      }
      const segments = trimmed
        .replace(/[【】\[\]]/g, " ")
        .split(/[\n，。,；;、|：:]/)
        .map((segment) => segment.trim())
        .filter((segment) => segment.length >= 2)
        .map((segment) => segment.slice(0, 18));
      return [trimmed.slice(0, 18), ...segments];
    }),
  ).slice(0, 10);
};

const buildHighQualityPlanGenerationPrompt = (
  params: z.infer<typeof generatePlansSchema>,
) => {
  const archetypeContext = buildArchetypePromptContext(
    String(params.brief || "").trim(),
  );
  const groundingContext = buildPlanGroundingPromptContext({
    brief: params.brief,
    supplementSummary: params.supplementSummary,
    imageAnalyses: params.imageAnalyses,
  });
  const principleContext = buildCommercialDesignPrincipleContext({
    selectedTypes: params.selectedTypes,
    brief: params.brief,
    supplementSummary: params.supplementSummary,
  });
  const visualProofContext = buildVisualProofGrammarContext(params.brief);
  const visualSystemContext = buildVisualSystemConsistencyContext({
    platformMode: params.platformMode,
    selectedTypes: params.selectedTypes,
  });
  const typeRequirementText = buildPlanTypeRequirementText(params.selectedTypes);

  return `????????????????????????????????????????????????????????????????????????????????????? JSON??????? groups?
?????
1. ?? item ????????????????????????????????????????????????
2. ??????????????????????????????????????????????
3. ??????????????????????????????????????????????????????????
4. layoutIntent ????????????????????????????????????????????????????????????
?????
1. ?????????????????????
2. group.summary ??? 40 ? 80 ????????????????????????????????????
3. group.strategy ?? 2 ?????????? 1 ????????????????????? 1 ??????????????????
4. ?? item ????? layoutIntent???????? {"imageRole":"...","layoutMode":"...","componentNeed":"...","reservedAreas":["..."]}?
5. item.title ???????????????????????????????????
6. item.description ??? 40 ? 120 ???????????????????????????????????????????????????????
7. item.promptOutline ??? 55 ? 140 ??????????????????????????????????????????????????????????????????????/UI?
8. layoutIntent.imageRole ??? hero?selling-point?parameter?structure?detail?scene?comparison?summary?
9. layoutIntent.layoutMode ??? top-banner?left-copy?right-copy?bottom-panel?center-focus-with-edge-space?split-info?
10. layoutIntent.componentNeed ??? text-only?text-and-icons?text-and-stats?annotation-heavy?comparison-heavy?
11. reservedAreas ??? headline?subheadline?stats?icons?body?comparison?annotation ?? 1 ? 4 ?????????????????
12. ????????????????????????????????????????????????????????????????????
13. ?? item ??????????????????????????????????????????before/after??????????????????????
14. ??????????????????????????????????????????????????????
15. ?????????????????????????????????????????????
16. ?????????????????????????
17. ????????????
?????${typeRequirementText}

${archetypeContext}
${groundingContext}
${principleContext}
${visualProofContext}
${visualSystemContext}
?????${getPlatformModeLabel(params.platformMode)}
?????${getWorkflowModeLabel(params.workflowMode)}
?????${buildPlatformRequirementText(params.platformMode)}
?????${params.brief || "?"}
?????${params.supplementSummary || "?"}
?????${buildCompactPlanSelectedTypesText(params.selectedTypes)}
??????${buildCompactPlanImageAnalysesText(params.imageAnalyses as unknown as Array<Record<string, unknown>>)}`;
};

const buildHighQualityPlanAutofillPrompt = (
  params: z.infer<typeof autofillPlansSchema>,
  currentGroups: EcommercePlanGroup[],
) => {
  const archetypeContext = buildArchetypePromptContext(
    String(params.brief || "").trim(),
  );
  const groundingContext = buildPlanGroundingPromptContext({
    brief: params.brief,
    supplementSummary: params.supplementSummary,
    imageAnalyses: params.imageAnalyses,
  });
  const principleContext = buildCommercialDesignPrincipleContext({
    selectedTypes: currentGroups.map((group) => ({
      id: group.typeId,
      title: group.typeTitle,
      imageCount: group.items.length,
    })),
    brief: params.brief,
    supplementSummary: params.supplementSummary,
  });
  const visualProofContext = buildVisualProofGrammarContext(params.brief);
  const visualSystemContext = buildVisualSystemConsistencyContext({
    platformMode: params.platformMode,
    selectedTypes: currentGroups.map((group) => ({
      id: group.typeId,
      title: group.typeTitle,
      imageCount: group.items.length,
    })),
  });
  const typeRequirementText = buildPlanTypeRequirementText(
    currentGroups.map((group) => ({
      id: group.typeId,
      title: group.typeTitle,
      imageCount: group.items.length,
    })),
  );

  return `?????????????????????????????????????????????????????????????????????????????????????? JSON??????? groups?
?????
1. ?????? typeId?typeTitle ? item.id????????????????????????????????????? item?
2. ???? summary?strategy?title?description?promptOutline ? layoutIntent??????????
3. ?? item ?????????????????????????????????????????
4. ??? item ?????????????????????????????????????????????
5. ??? item ????????????????????????reservedAreas ? componentNeed???????????
6. description ????????????????????????????????????????????????????
7. promptOutline ????????????????????????????????????????????????????????/UI??
8. ??? layoutIntent ????????????????????????reservedAreas ??????????????????????????
9. ?? item ???????????????????????????????????????before/after??????????????????????
10. ????? strategy ?????????????????????? strategy ????????????????????
11. ??????????????????????????????????????????
12. ????????????
???????${typeRequirementText}

${archetypeContext}
${groundingContext}
${principleContext}
${visualProofContext}
${visualSystemContext}
?????${getPlatformModeLabel(params.platformMode)}
?????${getWorkflowModeLabel(params.workflowMode)}
?????${params.supplementSummary || "?"}
??????${buildCompactPlanImageAnalysesText(params.imageAnalyses as unknown as Array<Record<string, unknown>>)}
?????${buildCompactPlanGroupsText(currentGroups)}`;
};

type PlanQualityIssue = {
  scope: "group" | "item";
  typeId: string;
  typeTitle: string;
  itemId?: string;
  itemTitle?: string;
  reasons: string[];
};

type PlanQualityReport = {
  passed: boolean;
  missingTypeIds: string[];
  issues: PlanQualityIssue[];
};

const PLAN_GROUP_SUMMARY_MIN_LENGTH = 24;
const PLAN_ITEM_DESCRIPTION_MIN_LENGTH = 28;
const PLAN_ITEM_PROMPT_OUTLINE_MIN_LENGTH = 28;
const PLAN_ITEM_MIN_SIGNAL_GROUPS = 2;
const PLAN_ITEM_MIN_PROOF_SIGNALS = 1;
const PLAN_GENERIC_PROOF_REGEX =
  /(剖面|爆炸|引线|标注|放大|微距|点云|路径|before|after|水流|风流|热流|扫描|透视|分层|示意|局部特写|参数卡|对比区)/;
const PLAN_TYPE_PROOF_REGEXES: Partial<Record<string, RegExp[]>> = {
  hero_multi: [
    /(大特写|主视觉|45度|体积关系|核心局部|主体识别|轮廓清晰|首屏)/,
  ],
  main_image: [
    /(大特写|主视觉|45度|体积关系|核心局部|主体识别|轮廓清晰|首屏)/,
  ],
  white_bg: [
    /(白底|标准正面|45度补角|45度|边缘清晰|比例|规格|合规|无遮挡|轮廓清楚)/,
  ],
  selling_points: [
    /(结构透视|功能路径|局部放大|状态对比|before|after|动作演示|真实动作|参数承载|引线标注|说明区)/,
  ],
  feature_comparison: [
    /(对比区|参数差异|差异点|before|after|相较于|相比|对照|对比卡|对比表)/,
  ],
  structure: [
    /(剖面|爆炸|引线|标注|局部放大|结构分区|部件关系|接口|按键|水箱|喷头|开盖|拆解)/,
  ],
  size_hold: [
    /(参照物|手持|掌心|桌面对比|桌面对照|尺寸线|比例感|握持|大小感知|收纳位)/,
  ],
  detail_highlights: [
    /(微距|接缝|纹理|材质反射|边角|局部特写|细节放大|做工细节)/,
  ],
  texture_demo: [
    /(微距|接缝|纹理|材质反射|边角|局部特写|细节放大|做工细节)/,
  ],
  usage_scene: [
    /(真实动作|动作演示|场景交互|空间关系|换衣前|出门前|整理衣物|挂烫动作|熨烫动作|收纳场景|桌面摆放|衣架)/,
  ],
  lifestyle: [
    /(真实动作|动作演示|场景交互|空间关系|换衣前|出门前|整理衣物|挂烫动作|熨烫动作|收纳场景|桌面摆放|衣架)/,
  ],
  steps: [
    /(步骤|分栏|顺序|开机|预热|贴近|来回|结束|收纳|动作切换|结果承接)/,
  ],
  ingredient_story: [
    /(成分关系|原料特写|剖面示意|参数卡|作用路径|原料放大)/,
  ],
};
const PLAN_VAGUE_PHRASES = [
  "主体居中",
  "背景简洁",
  "突出质感",
  "提升转化",
  "适合电商展示",
  "增强氛围",
  "画面高级",
  "视觉吸引力",
  "强化卖点",
  "突出产品",
];
const PLAN_CATEGORY_CONFLICT_LEXICONS = {
  beauty: ["精华", "面霜", "乳液", "防晒", "肌肤", "洁面", "泡沫", "成分", "妆效", "口红", "试色", "上脸"],
  food: ["口味", "食材", "冲泡", "饮用", "零食", "咀嚼", "奶香", "酥脆", "开袋", "饮品"],
  apparel: ["穿搭", "上身", "尺码", "面料", "版型", "模特", "搭配", "裙摆", "鞋面", "佩戴"],
  supplement: ["服用", "胶囊", "片剂", "营养", "每日", "含量", "剂型", "咀嚼片"],
} as const;
const PLAN_SEMANTIC_SIGNAL_GROUPS: Array<{
  label: string;
  keywords: string[];
}> = [
  {
    label: "视角",
    keywords: ["正面", "侧面", "背面", "顶面", "底部", "底面", "45度", "俯视", "仰视", "平视", "平拍", "近景", "特写", "局部", "全景", "微距", "开箱", "手持", "场景", "步骤", "对比"],
  },
  {
    label: "主体",
    keywords: ["产品", "机身", "包装", "主机", "主体", "模块", "瓶身", "盒身", "接口", "按键", "喷头", "盖子", "面板", "结构", "材质", "纹理", "Logo", "logo", "容量", "刻度", "配件", "细节", "边刷", "传感器", "LiDAR", "APP", "底部"],
  },
  {
    label: "信息任务",
    keywords: ["目标", "任务", "职责", "负责", "用于", "聚焦", "专注", "说明", "交代", "展示", "强调", "解释", "证明", "补充", "承接", "承担", "回应", "建立", "覆盖", "传达", "回答", "呈现", "体现", "服务于"],
  },
  {
    label: "差异分工",
    keywords: ["区别在于", "区别于", "不同于", "相较于", "相比", "对比", "分工", "职责不同", "专门负责", "避免重复", "这一张", "这一类", "与前一张", "与主图相比", "同组内", "补充前面", "另一张", "单独负责"],
  },
  {
    label: "卖点功能",
    keywords: ["卖点", "优势", "亮点", "便携", "容量", "工艺", "功能", "使用场景", "效果", "效率", "安全", "耐用", "转化", "说服", "导航", "建图", "避障", "联动", "清洁", "覆盖率"],
  },
  {
    label: "视觉证据",
    keywords: ["剖面", "爆炸", "引线", "标注", "放大", "微距", "点云", "路径", "before", "after", "水流", "风流", "热流", "扫描", "透视", "分层", "示意", "局部特写", "参数卡", "对比区"],
  },
  {
    label: "系统统一",
    keywords: ["统一", "同套", "主色", "辅色", "点缀色", "色温", "材质系统", "镜头语言", "光影", "ui语气", "说明风格", "品牌系统", "连续页", "同一套"],
  },
];

const getPlanTextDensityLength = (value?: string | null): number =>
  String(value || "")
    .replace(/\s+/g, "")
    .replace(/[，。！？、；：,.!?;:()（）【】\[\]'"“”‘’—\-_/]/g, "")
    .length;

const countPlanSemanticSignalGroups = (value: string): number =>
  PLAN_SEMANTIC_SIGNAL_GROUPS.filter(({ keywords }) =>
    keywords.some((keyword) => value.includes(keyword)),
  ).length;

const collectPlanVaguePhraseHits = (value: string): string[] =>
  PLAN_VAGUE_PHRASES.filter((phrase) => value.includes(phrase));

const isPlanItemTitleTooGeneric = (
  title: string,
  typeTitle: string,
  itemIndex: number,
): boolean => {
  const normalized = title.replace(/\s+/g, "");
  const normalizedTypeTitle = typeTitle.replace(/\s+/g, "");
  return (
    normalized === `${normalizedTypeTitle}${itemIndex + 1}` ||
    /^方案\d+$/.test(normalized) ||
    /^镜头\d+$/.test(normalized) ||
    /^图片\d+$/.test(normalized)
  );
};

const buildPlanGroupIssueLabel = (
  issue: PlanQualityIssue,
): string =>
  issue.scope === "group"
    ? `${issue.typeTitle}组`
    : `${issue.typeTitle} / ${issue.itemTitle || issue.itemId || "方案项"}`;

const summarizePlanQualityReport = (report: PlanQualityReport): string => {
  const lines: string[] = [];
  if (report.missingTypeIds.length > 0) {
    lines.push(`缺失分组: ${report.missingTypeIds.join("、")}`);
  }

  report.issues.slice(0, 6).forEach((issue) => {
    lines.push(`${buildPlanGroupIssueLabel(issue)}: ${issue.reasons.join("；")}`);
  });

  return lines.length > 0 ? lines.join("\n") : "当前方案未发现明显质量问题。";
};

const canSoftAcceptPlanQualityReport = (
  report: PlanQualityReport,
): boolean => {
  if (report.passed || report.missingTypeIds.length > 0 || report.issues.length === 0) {
    return report.passed;
  }

  if (report.issues.length > 8) {
    return false;
  }

  return report.issues.every((issue) => {
    if (issue.scope !== "item") {
      return false;
    }

    return issue.reasons.every((reason) =>
      /描述过短|规划草稿过短|缺少具体规划信号/.test(String(reason || "").trim()),
    );
  });
};

const hasStructurallyCompletePlanGroups = (
  groups: EcommercePlanGroup[],
  requirements: PlanGroupRequirement[],
): boolean => {
  const groupById = new Map(groups.map((group) => [group.typeId, group]));

  return requirements.every((requirement) => {
    const group = groupById.get(requirement.typeId);
    if (!group || !String(group.summary || "").trim()) {
      return false;
    }

    const strategyCount = (group.strategy || []).filter(
      (entry) => String(entry.label || "").trim() && String(entry.value || "").trim(),
    ).length;
    if (strategyCount < 1) {
      return false;
    }

    if ((group.items || []).length < 1) {
      return false;
    }

    return (group.items || []).every(
      (item) =>
        String(item.title || "").trim() &&
        String(item.description || "").trim() &&
        String(item.promptOutline || "").trim(),
    );
  });
};

const buildPlanQualityIssueDigest = (report: PlanQualityReport) => ({
  passed: report.passed,
  missingTypeIds: report.missingTypeIds,
  issueCount: report.issues.length,
  topIssues: report.issues.slice(0, 6).map((issue) => ({
    label: buildPlanGroupIssueLabel(issue),
    reasons: issue.reasons.slice(0, 3),
  })),
});

const buildPlanInputSnapshot = (
  params: z.infer<typeof generatePlansSchema>,
  generationPrompt: string,
) => {
  const brief = String(params.brief || "").trim();
  const supplementSummary = String(params.supplementSummary || "").trim();
  const archetype = inferProductArchetype(brief);
  const guide = PRODUCT_ARCHETYPE_GUIDES[archetype];
  const groundingAnchors = extractPlanGroundingAnchors({
    brief,
    supplementSummary,
    imageAnalyses: params.imageAnalyses,
  });

  return {
    brief,
    briefLength: brief.length,
    supplementSummary,
    supplementSummaryLength: supplementSummary.length,
    selectedTypes: params.selectedTypes.map((item) => ({
      id: item.id,
      title: item.title,
      targetImageCount: getPlanGroupTargetItemCount(item.id, item.imageCount),
    })),
    imageAnalysisCount: params.imageAnalyses.length,
    weakImageAnalysisCount: params.imageAnalyses.filter((item) =>
      looksLikeWeakImageAnalysisText(
        `${String(item.description || "").trim()} ${String(
          item.analysisConclusion || "",
        ).trim()}`.trim(),
      ),
    ).length,
    imageAnalyses: params.imageAnalyses.slice(0, 3).map((item, index) => ({
      index: index + 1,
      imageId: item.imageId,
      title: String(item.title || "").trim(),
      description: String(item.description || "").trim().slice(0, 120),
      analysisConclusion: String(item.analysisConclusion || "")
        .trim()
        .slice(0, 100),
    })),
    inferredArchetype: archetype,
    inferredArchetypeLabel: guide.label,
    groundingAnchors,
    generationPromptLength: generationPrompt.length,
  };
};

const inspectPlanCandidateDiagnostics = ({
  groups,
  requirements,
  qualityReport,
  brief,
  supplementSummary,
  imageAnalyses,
}: {
  groups: EcommercePlanGroup[];
  requirements: PlanGroupRequirement[];
  qualityReport: PlanQualityReport;
  brief?: string;
  supplementSummary?: string;
  imageAnalyses: Array<{
    imageId: string;
    title: string;
    description: string;
    analysisConclusion?: string;
  }>;
}) => {
  const combinedText = groups
    .flatMap((group) => [
      group.typeId,
      group.typeTitle,
      group.summary,
      ...(group.strategy || []).flatMap((entry) => [entry.label, entry.value]),
      ...(group.items || []).flatMap((item) => [
        item.title,
        item.description,
        item.promptOutline,
        item.marketingGoal,
        item.keyMessage,
        item.composition,
        item.background,
        item.lighting,
        ...(item.mustShow || []),
      ]),
    ])
    .filter(Boolean)
    .join(" ");
  const normalizedText = normalizePlanDiagnosticText(combinedText);
  const groundingAnchors = extractPlanGroundingAnchors({
    brief,
    supplementSummary,
    imageAnalyses,
  });
  const anchorHits = groundingAnchors.filter((anchor) =>
    normalizedText.includes(normalizePlanDiagnosticText(anchor)),
  );
  const genericTitleCount = groups.reduce(
    (count, group) =>
      count +
      (group.items || []).filter((item, itemIndex) =>
        isPlanItemTitleTooGeneric(item.title, group.typeTitle, itemIndex),
      ).length,
    0,
  );

  return {
    groupCount: groups.length,
    itemCount: groups.reduce((sum, group) => sum + (group.items || []).length, 0),
    groupTitles: groups.map((group) => ({
      typeId: group.typeId,
      typeTitle: group.typeTitle,
      itemCount: (group.items || []).length,
    })),
    requirementCoverage: requirements.map((item) => {
      const group = groups.find((entry) => entry.typeId === item.typeId);
      return {
        typeId: item.typeId,
        typeTitle: item.typeTitle,
        expectedItemCount: getPlanGroupTargetItemCount(
          item.typeId,
          item.expectedItemCount,
        ),
        actualItemCount: group?.items.length || 0,
      };
    }),
    grounding: {
      anchorCount: groundingAnchors.length,
      anchorHits,
      missingAnchors: groundingAnchors
        .filter((anchor) => !anchorHits.includes(anchor))
        .slice(0, 6),
      crossCategoryHits: collectPlanCrossCategoryHits(combinedText, brief),
    },
    genericTitleCount,
    quality: buildPlanQualityIssueDigest(qualityReport),
  };
};

const logPlanGenerationDiagnostics = (
  label: string,
  payload: Record<string, unknown>,
  level: "info" | "warn" = "info",
): void => {
  if (level === "warn") {
    console.warn(`[ecomGeneratePlansSkill] ${label}`, payload);
    return;
  }
  console.info(`[ecomGeneratePlansSkill] ${label}`, payload);
};

const shouldAttemptPlanRepair = (report: PlanQualityReport): boolean => {
  if (report.missingTypeIds.length > 0) {
    return true;
  }

  const hasGroupLevelIssue = report.issues.some((issue) => issue.scope === "group");
  if (hasGroupLevelIssue) {
    return true;
  }

  return report.issues.length > 2;
};

const shouldAttemptPlanRepairForWorkflow = (
  report: PlanQualityReport,
  workflowMode?: EcommerceWorkflowMode,
): boolean => {
  if (!shouldAttemptPlanRepair(report)) {
    return false;
  }
  if (workflowMode !== "quick") {
    return true;
  }
  if (report.missingTypeIds.length > 0) {
    return true;
  }
  return report.issues.some((issue) => issue.scope === "group");
};

const collectPlanCrossCategoryHits = (
  text: string,
  brief?: string,
): string[] => {
  const normalizedText = String(text || "");
  const archetype = inferProductArchetype(String(brief || "").trim());
  const hits: string[] = [];
  const isBeautyArchetype =
    archetype === "cleanser" ||
    archetype === "serum-cream" ||
    archetype === "beauty-makeup";

  if (!isBeautyArchetype) {
    const beautyHits = PLAN_CATEGORY_CONFLICT_LEXICONS.beauty.filter((token) =>
      normalizedText.includes(token),
    );
    if (beautyHits.length >= 2) {
      hits.push(`出现明显美妆/护肤词：${beautyHits.slice(0, 3).join("、")}`);
    }
  }
  if (archetype !== "food-beverage") {
    const foodHits = PLAN_CATEGORY_CONFLICT_LEXICONS.food.filter((token) =>
      normalizedText.includes(token),
    );
    if (foodHits.length >= 2) {
      hits.push(`出现明显食品/饮料词：${foodHits.slice(0, 3).join("、")}`);
    }
  }
  if (archetype !== "apparel-accessory") {
    const apparelHits = PLAN_CATEGORY_CONFLICT_LEXICONS.apparel.filter((token) =>
      normalizedText.includes(token),
    );
    if (apparelHits.length >= 2) {
      hits.push(`出现明显服饰词：${apparelHits.slice(0, 3).join("、")}`);
    }
  }
  if (archetype !== "supplement-health") {
    const supplementHits = PLAN_CATEGORY_CONFLICT_LEXICONS.supplement.filter((token) =>
      normalizedText.includes(token),
    );
    if (supplementHits.length >= 2) {
      hits.push(`出现明显保健品词：${supplementHits.slice(0, 3).join("、")}`);
    }
  }

  return hits;
};

const countPlanProofSignals = ({
  typeId,
  typeTitle,
  itemTitle,
  text,
}: {
  typeId: string;
  typeTitle: string;
  itemTitle: string;
  text: string;
}): number => {
  const resolvedTypeId = resolveRecommendedTypeId(
    typeId,
    `${typeTitle} ${itemTitle}`,
  );
  const proofRegexes = [
    PLAN_GENERIC_PROOF_REGEX,
    ...(PLAN_TYPE_PROOF_REGEXES[resolvedTypeId] || []),
  ];
  return proofRegexes.some((pattern) => pattern.test(text)) ? 1 : 0;
};

const inspectPlanGroupsQuality = (
  groups: EcommercePlanGroup[],
  requirements: PlanGroupRequirement[],
  context?: {
    brief?: string;
  },
): PlanQualityReport => {
  const requirementById = new Map(
    requirements.map((item) => [item.typeId, item]),
  );
  const groupById = new Map(groups.map((group) => [group.typeId, group]));
  const missingTypeIds = requirements
    .filter((item) => !groupById.has(item.typeId))
    .map((item) => item.typeId);
  const issues: PlanQualityIssue[] = [];

  groups.forEach((group) => {
    const requirement = requirementById.get(group.typeId);
    const groupReasons: string[] = [];
    const summaryLength = getPlanTextDensityLength(group.summary);
    const targetCount = getPlanGroupTargetItemCount(
      group.typeId,
      requirement?.expectedItemCount || group.items.length || 1,
    );

    if (summaryLength < PLAN_GROUP_SUMMARY_MIN_LENGTH) {
      groupReasons.push(`组摘要过短（当前 ${summaryLength}，至少 ${PLAN_GROUP_SUMMARY_MIN_LENGTH}）`);
    }
    if ((group.strategy || []).length < 2) {
      groupReasons.push("组策略少于 2 条，未交代分工逻辑");
    }
    if ((group.items || []).length < targetCount) {
      groupReasons.push(`组内方案数量不足（当前 ${group.items.length}，目标 ${targetCount}）`);
    }
    const hasSystemConsistencyStrategy = (group.strategy || []).some((entry) =>
      /统一|同套|主色|辅色|点缀色|色温|材质|镜头语言|品牌系统|说明风格|连续页/.test(
        `${entry.label} ${entry.value}`,
      ),
    );
    if (!hasSystemConsistencyStrategy) {
      groupReasons.push("缺少整套视觉系统一致性策略");
    }
    const groupConflictHits = collectPlanCrossCategoryHits(
      [
        group.typeTitle,
        group.summary,
        ...(group.strategy || []).flatMap((entry) => [entry.label, entry.value]),
        ...(group.items || []).flatMap((item) => [
          item.title,
          item.description,
          item.promptOutline,
          item.marketingGoal,
          item.keyMessage,
        ]),
      ]
        .filter(Boolean)
        .join(" "),
      context?.brief,
    );
    if (groupConflictHits.length > 0) {
      groupReasons.push(...groupConflictHits);
    }

    if (groupReasons.length > 0) {
      issues.push({
        scope: "group",
        typeId: group.typeId,
        typeTitle: group.typeTitle,
        reasons: groupReasons,
      });
    }

    (group.items || []).forEach((item, itemIndex) => {
      const combinedText = [
        item.title,
        item.description,
        item.promptOutline,
        item.marketingGoal,
        item.keyMessage,
        item.composition,
        item.background,
        item.lighting,
        ...(item.mustShow || []),
      ]
        .filter(Boolean)
        .join(" ");
      const descriptionLength = getPlanTextDensityLength(item.description);
      const promptOutlineLength = getPlanTextDensityLength(item.promptOutline);
      const signalCount = countPlanSemanticSignalGroups(combinedText);
      const proofSignalCount = countPlanProofSignals({
        typeId: group.typeId,
        typeTitle: group.typeTitle,
        itemTitle: item.title,
        text: combinedText,
      });
      const vagueHits = collectPlanVaguePhraseHits(combinedText);
      const itemReasons: string[] = [];

      if (descriptionLength < PLAN_ITEM_DESCRIPTION_MIN_LENGTH) {
        itemReasons.push(`描述过短（当前 ${descriptionLength}，至少 ${PLAN_ITEM_DESCRIPTION_MIN_LENGTH}）`);
      }
      if (promptOutlineLength < PLAN_ITEM_PROMPT_OUTLINE_MIN_LENGTH) {
        itemReasons.push(`规划草稿过短（当前 ${promptOutlineLength}，至少 ${PLAN_ITEM_PROMPT_OUTLINE_MIN_LENGTH}）`);
      }
      if (signalCount < PLAN_ITEM_MIN_SIGNAL_GROUPS) {
        itemReasons.push(`缺少具体规划信号（仅命中 ${signalCount} 类，应至少 ${PLAN_ITEM_MIN_SIGNAL_GROUPS} 类）`);
      }
      if (proofSignalCount < PLAN_ITEM_MIN_PROOF_SIGNALS) {
        itemReasons.push("缺少明确的卖点视觉化证明方式");
      }
      if (vagueHits.length >= 2 && signalCount <= PLAN_ITEM_MIN_SIGNAL_GROUPS) {
        itemReasons.push(`空泛套话过多（${vagueHits.slice(0, 3).join("、")}）`);
      }
      if (isPlanItemTitleTooGeneric(item.title, group.typeTitle, itemIndex)) {
        itemReasons.push("标题过于通用，没体现这张图的职责");
      }
      const itemConflictHits = collectPlanCrossCategoryHits(
        combinedText,
        context?.brief,
      );
      if (itemConflictHits.length > 0) {
        itemReasons.push(...itemConflictHits);
      }

      if (itemReasons.length > 0) {
        issues.push({
          scope: "item",
          typeId: group.typeId,
          typeTitle: group.typeTitle,
          itemId: item.id,
          itemTitle: item.title,
          reasons: itemReasons,
        });
      }
    });
  });

  return {
    passed: missingTypeIds.length === 0 && issues.length === 0,
    missingTypeIds,
    issues,
  };
};

const parsePlanGroupsFromUnknown = (
  raw: unknown,
  platformMode?: EcommercePlatformMode,
): EcommercePlanGroup[] => {
  const candidates = extractPlanGroupCandidates(raw);
  const source = candidates.length > 0 ? candidates : [raw];
  return source
    .map((group, index) => parsePlanGroupResult(group, index, platformMode))
    .filter((group): group is EcommercePlanGroup => Boolean(group));
};

const ECOM_SUPPLEMENT_AUTOFILL_REQUEST_TUNING = {
  timeoutMs: 90000,
  idleTimeoutMs: 180000,
  retries: 1,
  baseDelayMs: 1200,
  maxDelayMs: 6000,
} as const;

const ECOM_PLAN_REQUEST_TUNING = {
  timeoutMs: 90000,
  idleTimeoutMs: 180000,
  retries: 1,
  baseDelayMs: 1200,
  maxDelayMs: 6000,
} as const;

const requestPlanGroupsFromAi = async ({
  model,
  prompt,
  temperature,
  operation,
  queueKey,
  minIntervalMs,
  platformMode,
}: {
  model: string;
  prompt: string;
  temperature: number;
  operation: string;
  queueKey: string;
  minIntervalMs: number;
  platformMode?: EcommercePlatformMode;
}): Promise<EcommercePlanGroup[]> => {
  const response = await generateJsonResponse({
    model,
    parts: [{ text: prompt }],
    temperature,
    responseSchema: planGroupsResponseSchema,
    operation,
    disableTextOnlyFallback: true,
    queueKey,
    minIntervalMs,
    requestTuning: ECOM_PLAN_REQUEST_TUNING,
  });
  const parsedJson = parseJsonText(response.text);
  const parsed = generatePlansOutputSchema.safeParse(parsedJson);
  if (parsed.success) {
    return parsed.data.groups;
  }
  return parsePlanGroupsFromUnknown(parsedJson, platformMode);
};

const finalizePlanGroupsForPlanning = (
  groups: EcommercePlanGroup[],
  requirements: PlanGroupRequirement[],
  platformMode?: EcommercePlatformMode,
): EcommercePlanGroup[] =>
  normalizePlanGroupsForUi(
    enrichPlanGroupsForPlanning(groups, requirements, platformMode),
  );

type PlanFallbackSeed = {
  title: string;
  description: string;
  promptOutline: string;
  strategy: Array<{ label: string; value: string }>;
  summary: string;
};

const buildPlanFallbackSeed = ({
  typeId,
  typeTitle,
  subjectLabel,
  anchorText,
}: {
  typeId: string;
  typeTitle: string;
  subjectLabel: string;
  anchorText: string;
}): PlanFallbackSeed => {
  switch (typeId) {
    case "hero_multi":
    case "main_image":
      return {
        title: "首屏主体主视觉",
        description: `用完整主体建立 ${subjectLabel} 的第一眼识别，优先交代品牌、型号、核心外观与主打卖点，并为后续文案留出清晰信息区。${anchorText}`,
        promptOutline:
          "主图负责第一眼识别与点击动机，主体完整稳居视觉中心，画面干净，有品牌感，保留后续文案与图标可落位空间。",
        strategy: [
          { label: "画面任务", value: "先讲清主体是谁，再建立首屏点击理由。" },
          { label: "版面纪律", value: "主体高权重，背景克制，预留标题与卖点区。" },
        ],
        summary:
          "承担首屏主视觉任务，先建立主体识别、品牌气质与点击动机，不把多种详情页职责挤进一张图。",
      };
    case "white_bg":
      return {
        title: "标准白底展示",
        description: `用标准白底完整展示 ${subjectLabel} 的主体外观、颜色、比例和正面信息，保证边缘清楚、结构真实，适合做平台规范展示。${anchorText}`,
        promptOutline:
          "白底图以标准展示为先，主体居中或标准商品位，颜色真实，结构清楚，不加入抢主体的场景元素。",
        strategy: [
          { label: "画面任务", value: "先满足审核与标准展示，再兼顾基础质感。" },
          { label: "版面纪律", value: "纯净留白，不做复杂场景，不破坏轮廓识别。" },
        ],
        summary:
          "承担平台白底与标准展示职责，重点保证主体比例、颜色、边缘和结构信息可信清楚。",
      };
    case "selling_points":
      return {
        title: "核心卖点承接图",
        description: `围绕 ${subjectLabel} 当前最值得成交的一个卖点组织画面，让主体与卖点说明形成主次清楚的单屏模块，并给后续上字预留稳定区块。${anchorText}`,
        promptOutline:
          "一张图只讲一个核心卖点，主体仍是主角，卖点说明区清楚可读，适合详情页模块化承接。",
        strategy: [
          { label: "画面任务", value: "把最强卖点讲清楚，不把所有卖点堆到同屏。" },
          { label: "版面纪律", value: "预留标题、短说明、图标或数据模块位置。" },
        ],
        summary:
          "承担详情页卖点承接任务，用单屏结构把一个核心卖点讲清楚，并保留充足说明空间。",
      };
    case "usage_scene":
    case "lifestyle_scene":
    case "lifestyle":
      return {
        title: "真实使用场景图",
        description: `把 ${subjectLabel} 放进可信的真实场景或使用动作里，强调主体仍然是主角，场景只负责建立代入感与使用语境，并为后续文案区保留秩序。${anchorText}`,
        promptOutline:
          "场景图重点证明真实使用语境，商品主体与关键结构必须清楚，场景氛围服务商品，不抢主体。",
        strategy: [
          { label: "画面任务", value: "用真实场景证明价值，不把画面做成普通生活照。" },
          { label: "版面纪律", value: "主体与场景有主次，并预留标题或说明区。" },
        ],
        summary:
          "承担真实使用代入与场景可信度任务，让用户明白商品在什么语境中被使用，同时保住主体识别。",
      };
    case "steps":
      return {
        title: "步骤流程说明图",
        description: `按顺序说明 ${subjectLabel} 的使用流程或关键动作，每一分区只承担一个步骤信息，让用户一眼看懂先后顺序与操作门槛。${anchorText}`,
        promptOutline:
          "步骤图按顺序分区，每块只讲一个动作或结果，结构清楚，适合后续补充箭头、编号和说明文字。",
        strategy: [
          { label: "画面任务", value: "降低理解门槛，让动作顺序一眼可读。" },
          { label: "版面纪律", value: "分区明确，保留编号、箭头与短句说明位。" },
        ],
        summary:
          "承担流程说明任务，用清楚的分区与顺序帮助用户快速理解怎么用、先后关系是什么。",
      };
    case "size_hold":
      return {
        title: "尺寸握持对比图",
        description: `通过手持、桌面对比或参照物帮助用户快速建立 ${subjectLabel} 的大小、比例和便携感判断，重点是直观可信，不夸张透视。${anchorText}`,
        promptOutline:
          "尺寸图要先建立比例感，再补充便携或握持关系，主体结构清楚，适合后续补充尺寸数字与标注。",
        strategy: [
          { label: "画面任务", value: "先让用户感知大小与比例，再解释便携或握持。" },
          { label: "版面纪律", value: "参照关系简单明确，留出尺寸标注区。" },
        ],
        summary:
          "承担尺寸与握持关系说明任务，让用户更快形成大小感知，并为尺寸标注预留空间。",
      };
    case "structure":
      return {
        title: "结构分区说明图",
        description: `围绕 ${subjectLabel} 的结构组成、关键部件或功能分区组织画面，重点让用户看懂部件关系、结构边界与说明逻辑，并为后续标注预留版面。${anchorText}`,
        promptOutline:
          "结构图强调分区、部件、接口或功能关系，画面说明化、克制，适合后续加注释线、标签和局部框。",
        strategy: [
          { label: "画面任务", value: "先讲清结构关系，再补充局部功能说明。" },
          { label: "版面纪律", value: "信息区、标注区、局部放大区要可落位。" },
        ],
        summary:
          "承担结构、组成或功能分区说明任务，让用户更快看懂这件商品，并适配后续上字标注。",
      };
    case "ingredient_story":
      return {
        title: "成分功效说明图",
        description: `围绕 ${subjectLabel} 的核心成分、配方或材料价值组织信息，让用户更容易理解为什么有效、为什么值得买，并保留成分说明区。${anchorText}`,
        promptOutline:
          "成分图以专业可信和可读性为先，主体与成分信息共同服务说服，不做空泛概念图。",
        strategy: [
          { label: "画面任务", value: "先把核心成分和功效关系讲清楚。" },
          { label: "版面纪律", value: "预留成分名、功效点和辅助图标空间。" },
        ],
        summary:
          "承担成分、配方或材料价值说明任务，用可读结构提升专业感与信任感。",
      };
    case "texture_demo":
      return {
        title: "质地状态展示图",
        description: `聚焦 ${subjectLabel} 的质地、纹理、泡沫、显色或触感状态，让用户对真实使用感受形成直观预期，并保留短句说明位。${anchorText}`,
        promptOutline:
          "质地图突出单一质地信息，用近景或局部状态证明真实感受，不做复杂场景。",
        strategy: [
          { label: "画面任务", value: "让用户先感知质地，再形成使用想象。" },
          { label: "版面纪律", value: "局部聚焦清楚，预留少量说明文字位。" },
        ],
        summary:
          "承担质地、纹理或显色展示任务，让用户更直观理解真实使用感受。",
      };
    case "detail_highlights":
      return {
        title: "关键细节特写图",
        description: `放大 ${subjectLabel} 的关键局部、材质、做工或结构细节，用单点证据建立品质感和可信度，同时保证仍能看出它属于同一商品。${anchorText}`,
        promptOutline:
          "细节图聚焦一个明确局部，用近景特写和受控打光证明做工、材质或结构品质。",
        strategy: [
          { label: "画面任务", value: "一张图只证明一个细节点位，不分散焦点。" },
          { label: "版面纪律", value: "背景极简，保留局部说明或高亮标注区。" },
        ],
        summary:
          "承担细节证据与品质感证明任务，用单点特写强化做工、材质和结构可信度。",
      };
    case "feature_comparison":
      return {
        title: "差异卖点对比图",
        description: `围绕 ${subjectLabel} 最值得被记住的差异优势做清晰对比说明，让用户快速理解“为什么选它”，并为对比文案和图标模块留空间。${anchorText}`,
        promptOutline:
          "对比图只讲一个核心差异点，主体稳居中心或主位，对比模块清楚，不做杂乱信息海报。",
        strategy: [
          { label: "画面任务", value: "聚焦一个差异理由，帮助用户快速做决策。" },
          { label: "版面纪律", value: "预留对比文案、图标和数据模块区域。" },
        ],
        summary:
          "承担差异化价值说明任务，用单屏结构把一个核心优势讲清楚，提升决策效率。",
      };
    default:
      return {
        title: `${typeTitle}主任务图`,
        description: `围绕 ${subjectLabel} 的 ${typeTitle} 任务组织画面，先保证主体识别和信息重点正确，再为后续上字与图标说明预留稳定空间。${anchorText}`,
        promptOutline:
          "这张图先承担单一商业任务，主体清楚，信息重点明确，适合后续叠加标题、短说明和图标。",
        strategy: [
          { label: "画面任务", value: "每张图只承担一个明确商业任务。" },
          { label: "版面纪律", value: "主体清楚，说明区稳定，可继续叠加文字。" },
        ],
        summary:
          "承担单一详情页说明任务，先保证主体识别正确，再围绕该图型安排内容承接。",
      };
  }
};

const buildPlanFallbackGroups = ({
  selectedTypes,
  brief,
  supplementSummary,
  imageAnalyses,
  platformMode,
}: {
  selectedTypes: Array<{ id: string; title: string; imageCount: number }>;
  brief?: string;
  supplementSummary?: string;
  imageAnalyses: Array<{
    imageId: string;
    title: string;
    description: string;
    analysisConclusion?: string;
  }>;
  platformMode?: EcommercePlatformMode;
}): EcommercePlanGroup[] => {
  const subjectLabel = getBriefSubjectLabel(String(brief || "").trim(), "当前商品");
  const anchors = extractPlanGroundingAnchors({
    brief,
    supplementSummary,
    imageAnalyses,
  });
  const anchorText =
    anchors.length > 0
      ? `重点围绕这些已知锚点展开：${anchors.slice(0, 3).join("、")}。`
      : "";
  const referenceImageIds = imageAnalyses.slice(0, 3).map((item) => item.imageId);

  return selectedTypes.map((selectedType) => {
    const resolvedTypeId = resolveRecommendedTypeId(
      selectedType.id,
      selectedType.title,
    );
    const typeTitle =
      String(selectedType.title || "").trim() ||
      RECOMMENDED_TYPE_TITLE_FALLBACKS[resolvedTypeId] ||
      resolvedTypeId;
    const seed = buildPlanFallbackSeed({
      typeId: resolvedTypeId,
      typeTitle,
      subjectLabel,
      anchorText,
    });
    const targetCount = getPlanGroupTargetItemCount(
      resolvedTypeId,
      selectedType.imageCount,
    );
    const items = Array.from({ length: targetCount }, (_, index) => {
      const title =
        index === 0 ? seed.title : `${seed.title}${index + 1}`;
      const description =
        index === 0
          ? seed.description
          : `${seed.description} 当前为该组的补充镜头 ${index + 1}，需要和同组其他画面分工明确，避免重复表达。`;
      const promptOutline =
        index === 0
          ? seed.promptOutline
          : `${seed.promptOutline} 当前镜头是该组的补充版本 ${index + 1}，要换一个更具体的视角、局部或信息切口。`;

      return {
        id: `${resolvedTypeId}-${index + 1}`,
        title,
        description,
        promptOutline,
        ratio: normalizePlannedEcommercePlanRatio({
          platformMode,
          typeId: resolvedTypeId,
          typeTitle,
          itemTitle: title,
          itemDescription: description,
          preferredRatio: undefined,
        }),
        referenceImageIds,
        status: "ready" as const,
        mustShow: anchors.slice(0, 3),
        platformFit: [getPlatformModeLabel(platformMode)],
      };
    });

    return {
      typeId: resolvedTypeId,
      typeTitle,
      summary: seed.summary,
      strategy: seed.strategy,
      platformTags: [getPlatformModeLabel(platformMode)],
      priority: "medium" as const,
      items,
      source: "fallback" as const,
      usedFallback: true,
      fallbackReason: "已按用户显式选择，生成保守兜底方案骨架。",
    };
  });
};

const buildPlanQualityRepairPrompt = ({
  currentGroups,
  requirements,
  qualityReport,
  brief,
  supplementSummary,
  imageAnalyses,
  platformMode,
  workflowMode,
}: {
  currentGroups: EcommercePlanGroup[];
  requirements: PlanGroupRequirement[];
  qualityReport: PlanQualityReport;
  brief?: string;
  supplementSummary?: string;
  imageAnalyses: Array<{
    imageId: string;
    title: string;
    description: string;
    analysisConclusion?: string;
  }>;
  platformMode?: EcommercePlatformMode;
  workflowMode?: EcommerceWorkflowMode;
}) => {
  const archetypeContext = buildArchetypePromptContext(String(brief || "").trim());
  const groundingContext = buildPlanGroundingPromptContext({
    brief,
    supplementSummary,
    imageAnalyses,
  });
  const principleContext = buildCommercialDesignPrincipleContext({
    selectedTypes: requirements.map((item) => ({
      id: item.typeId,
      title: item.typeTitle,
      imageCount: item.expectedItemCount,
    })),
    brief,
    supplementSummary,
  });
  const visualProofContext = buildVisualProofGrammarContext(brief);
  const visualSystemContext = buildVisualSystemConsistencyContext({
    platformMode,
    selectedTypes: requirements.map((item) => ({
      id: item.typeId,
      title: item.typeTitle,
      imageCount: item.expectedItemCount,
    })),
  });
  const requirementText = buildPlanTypeRequirementText(
    requirements.map((item) => ({
      id: item.typeId,
      title: item.typeTitle,
      imageCount: item.expectedItemCount,
    })),
  );

  return `你是电商方案修订器，只做一次最小必要修正，不要重写成大段空话，也不要输出最终生图提示词。
请基于现有方案完成一次质量修复，只输出严格 JSON，顶层只能包含 groups。

最小必要修正原则：
1. 已有 group.typeId 必须保留；已有 item.id 必须原样保留，不得随意改名或删除。
2. 只有在缺失必需分组时，才补 requirements 里的缺失 typeId。
3. 只有在组内数量不足或内容明显不合格时，才新增或重写 item。
4. summary 要写清该组目的、信息分工、与其他组的区别、平台任务。
5. 每个 item 都必须带 layoutIntent，且其中的 imageRole、layoutMode、componentNeed、reservedAreas 必须和当前任务一致。
6. item.description 要写清视角或主体部位、可见信息、组内差异、承担的说明任务。
7. promptOutline 仍然只是方案草稿，不是最终生图指令；必须体现版式和留白，而不是只讲氛围。
8. 禁止空话套话，禁止无意义扩写，优先短而准。
9. 如果当前方案缺少清晰的信息承载能力，优先修复留白结构、组件预留和单图单任务。
10. 如果当前方案缺少“卖点视觉化证明方式”，优先补成结构透视、局部放大、路径示意、参数承载、before/after 或真实场景动作等具体表达。
11. 如果当前方案缺少整套统一感，优先在 strategy 和 styling 里补足主色、材质、光影、镜头语言或说明图形语气的一致性。
12. 全部使用简体中文。

质量问题摘要：
${summarizePlanQualityReport(qualityReport)}

分组要求：
${requirementText}

${archetypeContext}
${groundingContext}
${principleContext}
${visualProofContext}
${visualSystemContext}
目标平台：${getPlatformModeLabel(platformMode)}
工作模式：${getWorkflowModeLabel(workflowMode)}
平台要求：${buildPlatformRequirementText(platformMode)}
商品简述：${brief || "无"}
补充约束：${supplementSummary || "无"}
参考图分析：${buildCompactPlanImageAnalysesText(imageAnalyses as unknown as Array<Record<string, unknown>>)}
当前方案：${buildCompactPlanGroupsText(currentGroups)}`;
};

const repairPlanGroupsWithAi = async ({
  currentGroups,
  requirements,
  qualityReport,
  brief,
  supplementSummary,
  imageAnalyses,
  platformMode,
  workflowMode,
  operation,
  queueKey,
  minIntervalMs,
}: {
  currentGroups: EcommercePlanGroup[];
  requirements: PlanGroupRequirement[];
  qualityReport: PlanQualityReport;
  brief?: string;
  supplementSummary?: string;
  imageAnalyses: Array<{
    imageId: string;
    title: string;
    description: string;
    analysisConclusion?: string;
  }>;
  platformMode?: EcommercePlatformMode;
  workflowMode?: EcommerceWorkflowMode;
  operation: string;
  queueKey: string;
  minIntervalMs: number;
}): Promise<EcommercePlanGroup[]> => {
  if (currentGroups.length === 0 && qualityReport.missingTypeIds.length === 0) {
    return [];
  }

  try {
    const repairedGroups = await requestPlanGroupsFromAi({
      model: getBestModelId("thinking"),
      prompt: buildPlanQualityRepairPrompt({
        currentGroups,
        requirements,
        qualityReport,
        brief,
        supplementSummary,
        imageAnalyses,
        platformMode,
        workflowMode,
      }),
      temperature: 0.15,
      operation,
      queueKey,
      minIntervalMs,
      platformMode,
    });
    if (repairedGroups.length === 0) {
      return [];
    }
    return finalizePlanGroupsForPlanning(
      repairedGroups,
      requirements,
      platformMode,
    );
  } catch (error) {
    console.error(`${operation} error:`, error);
    return [];
  }
};

const PROMPT_GENERIC_VISUAL_PHRASES = [
  "高级感",
  "质感",
  "氛围感",
  "画面干净",
  "背景简洁",
  "简洁背景",
  "突出商品",
  "适合电商",
  "提升转化",
  "视觉冲击力",
  "高质量",
  "高级电商感",
  "商业感",
  "精致感",
];

type PromptCommercialQualityReport = {
  passed: boolean;
  score: number;
  issues: string[];
  genericHits: string[];
};

const inspectPromptCommercialQuality = (
  prompt: string,
): PromptCommercialQualityReport => {
  const source = String(prompt || "");
  const normalized = source.replace(/\s+/g, "");
  const genericHits = PROMPT_GENERIC_VISUAL_PHRASES.filter((phrase) =>
    normalized.includes(phrase.replace(/\s+/g, "")),
  );
  const hasBusinessRole =
    /(hero|main image|selling point|comparison|detail|scene|lifestyle|white\s?bg|steps?|usage|feature|benefit|proof|conversion)/i.test(
      source,
    );
  const hasComposition =
    /(composition|layout|framing|close[- ]?up|wide shot|top view|side view|45|angle|foreground|background|center|left|right|crop)/i.test(
      source,
    );
  const hasLightingOrMaterial =
    /(light|lighting|shadow|highlight|material|texture|metal|fabric|gloss|matte|surface)/i.test(
      source,
    );
  const hasBackgroundControl =
    /(background|backdrop|white\s?bg|scene|environment|clean background|gradient|plain)/i.test(
      source,
    );
  const hasProofGrammar =
    /(before|after|comparison|contrast|proof|evidence|parameter|metric|spec|badge|label|callout)/i.test(
      source,
    );
  const hasSystemConsistency =
    /(system|series|kit|family|same style|consistent|ui|brand system|grid|module)/i.test(
      source,
    );
  const hasTextSafeLayout =
    /(text safe|copy area|headline area|overlay|editable text|blank space|negative space|layout safe|title area)/i.test(
      source,
    );
  const forbidsRenderedText =
    /(no rendered text|avoid rendered text|avoid logo|remove logo|no ui|avoid ui|no watermark|avoid watermark)/i.test(
      source,
    );

  const issues: string[] = [];
  if (normalized.length < 160) {
    issues.push("Prompt is too short for stable commercial planning.");
  }
  if (!hasBusinessRole) {
    issues.push("Missing explicit business role or image purpose.");
  }
  if (!hasComposition) {
    issues.push("Missing composition or framing guidance.");
  }
  if (!hasLightingOrMaterial) {
    issues.push("Missing lighting or material detail.");
  }
  if (!hasBackgroundControl) {
    issues.push("Missing background control guidance.");
  }
  if (!hasProofGrammar) {
    issues.push("Missing proof, comparison, or evidence grammar.");
  }
  if (!hasSystemConsistency) {
    issues.push("Missing system or consistency guidance.");
  }
  if (!hasTextSafeLayout) {
    issues.push("Missing text-safe or editable-text layout guidance.");
  }
  if (!forbidsRenderedText) {
    issues.push("Missing explicit ban on rendered text, logo, or UI.");
  }
  if (genericHits.length >= 3) {
    issues.push(`Too many generic visual phrases: ${genericHits.join(", ")}`);
  }

  const score =
    (hasBusinessRole ? 2 : 0) +
    (hasComposition ? 2 : 0) +
    (hasLightingOrMaterial ? 2 : 0) +
    (hasBackgroundControl ? 1 : 0) +
    (hasProofGrammar ? 1 : 0) +
    (hasSystemConsistency ? 1 : 0) +
    (hasTextSafeLayout ? 2 : 0) +
    (forbidsRenderedText ? 1 : 0) +
    Math.min(2, Math.floor(normalized.length / 120)) -
    genericHits.length;

  return {
    passed:
      issues.length === 0 ||
      (score >= 8 && genericHits.length <= 2 && normalized.length >= 180),
    score,
    issues,
    genericHits,
  };
};

type ResultReviewCoverageReport = {
  passed: boolean;
  issues: string[];
};

const inspectResultReviewCoverage = (
  review: z.infer<typeof resultReviewSchema>,
): ResultReviewCoverageReport => {
  const combined = [
    review.summary,
    ...(review.strengths || []),
    ...(review.issues || []),
    review.recommendedUse || "",
  ]
    .filter(Boolean)
    .join(" ");

  const issues: string[] = [];
  if (!/(一致|同一商品|轮廓|结构|主色|材质|接口|瓶盖|按钮|包装)/.test(combined)) {
    issues.push("没有明确说明商品一致性判断依据");
  }
  if (!/(剖面|爆炸|引线|标注|放大|微距|点云|路径|before|after|水流|风流|热流|扫描|透视|分层|示意|参数|对比|证据)/.test(combined)) {
    issues.push("没有判断卖点是否被视觉化证明");
  }
  if (!/(统一|同套|主色|辅色|点缀色|色温|材质系统|镜头语言|光影|ui语气|说明风格|品牌系统|连续页)/.test(combined)) {
    issues.push("没有判断是否延续整套视觉系统");
  }
  if (!/(首图|主图|卖点|参数|结构|场景|对比|详情页|任务|职责)/.test(combined)) {
    issues.push("没有判断这张图是否完成当前单图职责");
  }

  return {
    passed: issues.length === 0,
    issues,
  };
};

const enrichPlanGroupsWithFallback = (
  groups: EcommercePlanGroup[],
  fallback: EcommercePlanGroup[],
): EcommercePlanGroup[] => {
  const fallbackById = new Map(fallback.map((group) => [group.typeId, group]));

  return groups.map((group) => {
    const fallbackGroup = fallbackById.get(group.typeId);
    if (!fallbackGroup) {
      return { ...group, source: group.source || "ai", usedFallback: false };
    }

    const usedFallback =
      group.source === "fallback" ||
      !group.items ||
      group.items.length === 0;
    const nextItems = (group.items || []).map((item) => ({
      ...item,
      ratio: normalizePlannedEcommercePlanRatio({
        typeId: group.typeId,
        typeTitle: group.typeTitle,
        itemTitle: item.title,
        itemDescription: item.description,
        preferredRatio: item.ratio,
      }),
      referenceImageIds: item.referenceImageIds || [],
      mustShow: item.mustShow || [],
      platformFit: item.platformFit || [],
      riskNotes: item.riskNotes || [],
    }));

    return {
      ...group,
      summary: group.summary,
      strategy: group.strategy || [],
      platformTags: group.platformTags || [],
      priority: group.priority || "medium",
      items: nextItems,
      source: group.source || "ai",
      usedFallback,
      fallbackReason: usedFallback
        ? "该方案组缺少实际可用内容，当前仅保留必要兜底结构。"
        : undefined,
    };
  });
};

const enrichPlanGroupsForPlanning = (
  groups: EcommercePlanGroup[],
  requirements: PlanGroupRequirement[],
  platformMode?: EcommercePlatformMode,
): EcommercePlanGroup[] => {
  const requirementById = new Map(
    requirements.map((item) => [item.typeId, item]),
  );

  return groups.map((group) => {
    const requirement = requirementById.get(group.typeId);
    const normalizedItems: EcommercePlanItem[] = (group.items || []).map(
      (item, index) => {
        const title =
          String(item.title || "").trim() ||
          `${group.typeTitle || requirement?.typeTitle || "方案项"} ${index + 1}`;
        const description = String(item.description || "").trim();
        const principleDefaults = buildPlanItemPrincipleDefaults({
          typeId: group.typeId,
          typeTitle: group.typeTitle || requirement?.typeTitle || group.typeId,
          title,
          description,
        });

        return {
          ...item,
          title,
          description,
          promptOutline:
            String(item.promptOutline || "").trim() ||
            String(item.description || "").trim(),
          ratio: normalizePlannedEcommercePlanRatio({
            platformMode,
            typeId: group.typeId,
            typeTitle: group.typeTitle || requirement?.typeTitle,
            itemTitle: item.title,
            itemDescription: item.description,
            preferredRatio: item.ratio,
          }),
          referenceImageIds: item.referenceImageIds || [],
          mustShow: item.mustShow || [],
          platformFit: item.platformFit || [],
          riskNotes: item.riskNotes || [],
          marketingGoal: String(item.marketingGoal || "").trim() || undefined,
          keyMessage: String(item.keyMessage || "").trim() || undefined,
          composition:
            String(item.composition || "").trim() || principleDefaults.composition,
          styling: String(item.styling || "").trim() || principleDefaults.styling,
          background:
            String(item.background || "").trim() || principleDefaults.background,
          lighting: String(item.lighting || "").trim() || principleDefaults.lighting,
        };
      },
    );

    const targetCount = getPlanGroupTargetItemCount(
      group.typeId,
      requirement?.expectedItemCount || normalizedItems.length || 1,
    );
    const gapNotes: string[] = [];
    if (!String(group.summary || "").trim()) {
      gapNotes.push("缺少组摘要");
    }
    if ((group.strategy || []).filter((entry) => entry.label && entry.value).length < 2) {
      gapNotes.push("组策略不足");
    }
    if (normalizedItems.length < targetCount) {
      gapNotes.push(`组内方案数量不足：当前 ${normalizedItems.length}，目标 ${targetCount}`);
    }
    const thinItemCount = normalizedItems.filter(
      (item) => String(item.description || "").trim().length < 28,
    ).length;
    if (thinItemCount > 0) {
      gapNotes.push(`${thinItemCount} 条方案描述过短`);
    }

    return {
      ...group,
      typeTitle: group.typeTitle || requirement?.typeTitle || group.typeId,
      summary: String(group.summary || "").trim() || undefined,
      strategy: mergePlanStrategyWithFallback(
        (group.strategy || []).filter(
          (entry) =>
            String(entry.label || "").trim() && String(entry.value || "").trim(),
        ),
        buildPlanSystemStrategyDefaults(
          group.typeId,
          group.typeTitle || requirement?.typeTitle || group.typeId,
          platformMode,
        ),
      ),
      platformTags: group.platformTags || [],
      priority: group.priority || requirement?.priority || "medium",
      items: normalizedItems,
      source: group.source || "ai",
      usedFallback: group.source === "fallback",
      fallbackReason:
        gapNotes.length > 0 ? `当前方案仍有待补强：${gapNotes.join("；")}` : undefined,
    };
  });
};

const extractPlanGroupCandidates = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) {
    return raw;
  }

  const record = asRecord(raw);
  if (!record) {
    return [];
  }

  const candidateKeys = [
    "groups",
    "plans",
    "planGroups",
    "data",
    "result",
    "output",
  ] as const;

  for (const key of candidateKeys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
    const nested = asRecord(value);
    if (nested) {
      const nestedArray =
        (Array.isArray(nested.groups) && nested.groups) ||
        (Array.isArray(nested.plans) && nested.plans) ||
        (Array.isArray(nested.planGroups) && nested.planGroups);
      if (nestedArray) {
        return nestedArray;
      }
    }
  }

  return [];
};

const buildSupplementFallback = (
  brief: string,
  recommendedTypes: Array<{ id: string; title: string; selected: boolean }>,
): EcommerceSupplementField[] => {
  const archetype = inferProductArchetype(brief);
  const category = inferCategoryHint(brief);
  const selectedTypeIds = new Set(
    recommendedTypes.filter((item) => item.selected).map((item) => item.id),
  );
  const selectedTitles = recommendedTypes
    .filter((item) => item.selected)
    .map((item) => item.title);
  const wantsUsageScene = recommendedTypes.some(
    (item) => item.selected && item.id === "usage_scene",
  );
  const wantsStructure = recommendedTypes.some(
    (item) => item.selected && item.id === "structure",
  );
  const wantsSize = recommendedTypes.some(
    (item) => item.selected && item.id === "size_hold",
  );
  const appendFieldIfMissing = (
    fields: EcommerceSupplementField[],
    nextField: EcommerceSupplementField,
  ) => {
    if (fields.length >= 8) {
      return;
    }
    if (fields.some((field) => field.id === nextField.id)) {
      return;
    }
    fields.push(nextField);
  };
  const appendReferenceFields = (
    fields: EcommerceSupplementField[],
    options?: {
      angleLabel?: string;
      angleHelperText?: string;
      detailLabel?: string;
      detailHelperText?: string;
    },
  ) => {
    fields.push({
      id: "angle_reference",
      label: options?.angleLabel || "补充侧面/45°商品图",
      kind: "image",
      required: false,
      value: [],
      helperText: options?.angleHelperText
        ? options.angleHelperText
        : brief
          ? `当前商品说明：${brief}`
          : "可补充更完整的多角度商品图，帮助主图、白底图和细节图更稳定。",
      maxItems: 3,
    });
    fields.push({
      id: "detail_reference",
      label: options?.detailLabel || "补充顶部/细节特写图",
      kind: "image",
      required: false,
      value: [],
      helperText:
        options?.detailHelperText ||
        "建议补充顶部接触点、按钮、开孔、材质纹理等细节。",
      maxItems: 3,
    });
  };

  if (category === "beauty") {
    if (archetype === "serum-cream") {
      const serumFields: EcommerceSupplementField[] = [
        {
          id: "core_benefits",
          label: "这次最想强调哪些核心功效或护肤问题？",
          kind: "multi-select",
          required: true,
          options: ["保湿补水", "舒缓修护", "提亮肤感", "抗初老/淡纹", "维稳强韧", "防晒隔离"],
          value: [],
          helperText: `会重点影响：${selectedTitles.join("、") || "全部已选类型"}`,
        },
        {
          id: "target_skin_concern",
          label: "希望优先打动哪些肌肤问题或人群？",
          kind: "multi-select",
          required: false,
          options: ["敏感泛红", "干燥缺水", "暗沉无光", "屏障脆弱", "通勤维稳", "轻熟龄抗老"],
          value: [],
          helperText: "会影响卖点表达、场景语气和模特/手部表现方式。",
        },
        {
          id: "texture_direction",
          label: "质地展示更想突出哪种感觉？",
          kind: "single-select",
          required: false,
          options: ["轻薄水润", "柔润滋养", "绵密乳霜感", "快速成膜感"],
          value: "",
          helperText: "会影响质地图、涂抹细节图和护肤场景图。",
        },
        {
          id: "brand_tone",
          label: "整体视觉更偏向哪种品牌气质？",
          kind: "single-select",
          required: true,
          options: ["医美专业感", "轻奢科技感", "极简纯净感", "自然修护感"],
          value: "",
          helperText: "会贯穿主图氛围、成分图和场景图。",
        },
        {
          id: "packaging_reference",
          label: "补充侧面/背面包装图",
          kind: "image",
          required: false,
          value: [],
          helperText: brief
            ? `当前商品说明：${brief}`
            : "可补充背标说明、滴管/泵头/瓶盖细节，帮助保持包装一致性。",
          maxItems: 3,
        },
        {
          id: "texture_reference",
          label: "补充乳液/精华/面霜质地参考图",
          kind: "image",
          required: false,
          value: [],
          helperText: "建议补充手背试用、拉丝延展或成膜效果图，用于质地与肤感方案。",
          maxItems: 3,
        },
      ];

      if (selectedTypeIds.has("ingredient_story")) {
        appendFieldIfMissing(serumFields, {
          id: "ingredient_proof",
          label: "成分图里最希望讲清哪些成分与功效对应关系？",
          kind: "textarea",
          required: false,
          placeholder: "例如：积雪草主打舒缓修护，玻尿酸强调保湿补水，烟酰胺强调提亮肤感",
          helperText: "会影响成分故事图和功效说明图，避免 AI 只写空泛护肤话术。",
        });
      }

      if (selectedTypeIds.has("selling_points")) {
        appendFieldIfMissing(serumFields, {
          id: "proof_points",
          label: "哪些卖点是你最希望被优先放大的转化重点？",
          kind: "multi-select",
          required: false,
          options: ["功效更明确", "成分更有说服力", "肤感更讨喜", "温和安心感", "包装质感更高级"],
          value: [],
          helperText: "会影响卖点图的信息排序、镜头重点和文案语气。",
        });
      }

      return serumFields;
    }

    if (archetype === "beauty-makeup") {
      const makeupFields: EcommerceSupplementField[] = [
        {
          id: "shade_or_style",
          label: "这次最想突出哪些色号、妆效或风格关键词？",
          kind: "multi-select",
          required: true,
          options: ["日常通勤", "元气提气色", "高级冷调", "温柔裸感", "显白显气质", "精致派对感"],
          value: [],
          helperText: `会重点影响：${selectedTitles.join("、") || "全部已选类型"}`,
        },
        {
          id: "target_audience",
          label: "希望优先打动哪些人群或使用场景？",
          kind: "multi-select",
          required: false,
          options: ["学生党", "通勤白领", "新手日常妆", "约会妆容", "拍照出片需求", "礼物送女生"],
          value: [],
          helperText: "会影响妆效场景、模特状态和文案语气。",
        },
        {
          id: "finish_direction",
          label: "更想突出哪种质地或妆效感觉？",
          kind: "single-select",
          required: false,
          options: ["清透自然", "丝绒柔雾", "水润光泽", "高显色高级感"],
          value: "",
          helperText: "会影响试色图、妆效场景图和近景质地表现。",
        },
        {
          id: "model_tone",
          label: "模特或整体气质更偏向哪种方向？",
          kind: "single-select",
          required: false,
          options: ["自然清新", "精致轻熟", "甜酷时髦", "高级冷感"],
          value: "",
          helperText: "会影响妆效场景图和风格主视觉的整体气质。",
        },
        {
          id: "packaging_reference",
          label: "补充包装/刷头/膏体细节图",
          kind: "image",
          required: false,
          value: [],
          helperText: "建议补充刷头、膏体切面、压纹或盒身局部细节，帮助稳定包装与质地表现。",
          maxItems: 3,
        },
        {
          id: "swatch_reference",
          label: "补充试色/上脸参考图",
          kind: "image",
          required: false,
          value: [],
          helperText: "如有真实试色、上唇或上脸效果图，能显著提升妆效场景和试色图稳定性。",
          maxItems: 3,
        },
      ];

      if (selectedTypeIds.has("detail_highlights")) {
        appendFieldIfMissing(makeupFields, {
          id: "detail_focus",
          label: "细节特写最应该放大哪些局部？",
          kind: "multi-select",
          required: false,
          options: ["刷头细节", "膏体切面", "压纹/粉体纹理", "包装工艺", "色号标识"],
          value: [],
          helperText: "会影响细节图和工艺质感图的镜头重点。",
        });
      }

      if (selectedTypeIds.has("selling_points")) {
        appendFieldIfMissing(makeupFields, {
          id: "proof_points",
          label: "哪些购买理由最值得被优先讲清？",
          kind: "multi-select",
          required: false,
          options: ["显色更好看", "更适合日常通勤", "更有高级感", "上脸更自然", "送礼更有吸引力"],
          value: [],
          helperText: "会影响卖点图、妆效图和风格主视觉的表达重点。",
        });
      }

      return makeupFields;
    }

    const beautyFields: EcommerceSupplementField[] = [
      {
        id: "core_ingredients",
        label: "这次最想强调哪些核心成分或功效点？",
        kind: "multi-select",
        required: true,
        options: [
          "积雪草舒缓",
          "净颜清洁",
          "提亮肤感",
          "温和不紧绷",
          "适合日常洁面",
          "高级香槟金质感",
        ],
        value: [],
        helperText: `会重点影响：${selectedTitles.join("、") || "全部已选类型"}`,
      },
      {
        id: "skin_type",
        label: "希望优先面向哪些肤质或人群？",
        kind: "multi-select",
        required: false,
        options: ["油皮/混油", "干皮", "敏感肌", "熬夜暗沉肌", "通勤护肤人群"],
        value: [],
        helperText: "会影响卖点表达、场景语气和模特状态。",
      },
      {
        id: "texture_direction",
        label: "质地展示更想突出哪种感觉？",
        kind: "single-select",
        required: false,
        options: ["清透啫喱感", "绵密泡沫感", "柔润洁净感", "医美洁面专业感"],
        value: "",
        helperText: "会影响质地图、泡沫图和局部特写方案。",
      },
      {
        id: "brand_tone",
        label: "整体视觉更偏向哪种品牌气质？",
        kind: "single-select",
        required: true,
        options: ["医美专业感", "轻奢精致感", "极简洁净感", "自然草本感"],
        value: "",
        helperText: "会贯穿主图氛围、成分图和场景图。",
      },
      {
        id: "packaging_reference",
        label: "补充侧面/背面包装图",
        kind: "image",
        required: false,
        value: [],
        helperText: brief
          ? `当前商品说明：${brief}`
          : "可补充背面说明、侧面弧度和封口细节，帮助保持包装一致性。",
        maxItems: 3,
      },
      {
        id: "texture_reference",
        label: "补充膏体/啫喱/泡沫参考图",
        kind: "image",
        required: false,
        value: [],
        helperText: "建议补充膏体拉丝、手背试用或起泡效果图，用于质地与使用感方案。",
        maxItems: 3,
      },
    ];

    if (selectedTypeIds.has("ingredient_story")) {
      appendFieldIfMissing(beautyFields, {
        id: "ingredient_proof",
        label: "成分/功效图最想重点讲清哪些成分与依据？",
        kind: "textarea",
        required: false,
        placeholder: "例如：强调某成分对应舒缓、保湿、提亮或温和洁净等方向",
        helperText: "会影响成分故事图和功效说明图，避免 AI 只写空泛护肤话术。",
      });
    }

    if (selectedTypeIds.has("selling_points")) {
      appendFieldIfMissing(beautyFields, {
        id: "proof_points",
        label: "卖点图里最想优先放大哪些转化重点？",
        kind: "multi-select",
        required: false,
        options: ["功效更明确", "肤感更讨喜", "温和安心感", "包装更高级", "更适合日常使用"],
        value: [],
        helperText: "会影响卖点图的信息排序、镜头重点和文案语气。",
      });
    }

    return beautyFields;
  }

  if (archetype === "digital-gadget") {
    const fields: EcommerceSupplementField[] = [
      {
        id: "selling_points",
        label: "这次最想重点突出的功能卖点有哪些？",
        kind: "multi-select",
        required: true,
        options: ["核心功能更直观", "关键部件更清楚", "自动化/省事感更强", "适用场景更贴近日常", "清洁/效率结果更有说服力", "外观更有科技感"],
        value: [],
        helperText: `会重点影响：${selectedTitles.join("、") || "全部已选类型"}`,
      },
      {
        id: "style_direction",
        label: "整体出图风格更偏向哪一种？",
        kind: "single-select",
        required: true,
        options: ["极简科技风", "高端家电风", "家庭场景可信风", "参数说明清晰风"],
        value: "",
        helperText: "风格会贯穿主图、卖点图、结构图和场景图。",
      },
      {
        id: "target_audience",
        label: "本次视觉更想打动哪些使用人群或家庭场景？",
        kind: "multi-select",
        required: false,
        options: ["养宠家庭", "有娃家庭", "上班族省事清洁", "大户型家庭", "重视家电品质的人群"],
        value: [],
        helperText: "会影响场景图、卖点图的痛点表达和画面任务分配。",
      },
    ];

    if (wantsUsageScene) {
      fields.push({
        id: "usage_scene_focus",
        label: "场景图里最想优先展示哪类使用环境或痛点？",
        kind: "multi-select",
        required: true,
        options: ["客厅大面积地面", "沙发/床底低矮区域", "宠物毛发清洁", "餐桌碎屑/厨房周边", "回充/自清洁基站区域"],
        value: [],
        helperText: "会影响场景图的空间选择、动作逻辑和卖点落点。",
      });
    }

    if (wantsSize) {
      fields.push({
        id: "size_info",
        label: "如果要做尺寸/占地图，最希望说明哪类空间关系？",
        kind: "textarea",
        required: false,
        placeholder: "例如：机身高度方便进入沙发底，基站宽度适合靠墙摆放，占地不要显得太大",
        helperText: "会影响尺寸图、握持/占地图和空间关系图的表达方式。",
      });
    }

    if (wantsStructure) {
      fields.push({
        id: "structure_notes",
        label: "结构说明图最需要讲清哪些部件或功能分区？",
        kind: "textarea",
        required: false,
        placeholder: "例如：滚刷、边刷、尘盒、水箱、雷达/传感器、基站清洗仓等哪些要重点解释",
        helperText: "越清楚的部件说明，越容易做出可信的结构说明图。",
      });
    }

    if (selectedTypeIds.has("selling_points")) {
      appendFieldIfMissing(fields, {
        id: "proof_points",
        label: "这些卖点里，哪些是你最希望 AI 着重放大的转化证据？",
        kind: "multi-select",
        required: false,
        options: ["清洁结果更直观", "结构逻辑更好懂", "参数/规格更清楚", "场景痛点更贴近", "省时省力感更强"],
        value: [],
        helperText: "会直接影响卖点图的信息排序、镜头重点和说明逻辑。",
      });
    }

    if (selectedTypeIds.has("steps")) {
      appendFieldIfMissing(fields, {
        id: "step_sequence",
        label: "如果要做步骤图，最希望展示哪几个关键流程？",
        kind: "textarea",
        required: false,
        placeholder: "例如：启动清洁 -> 穿行家具底部 -> 回基站自清洁 -> 倒尘/补水维护",
        helperText: "会影响步骤图的分镜顺序、动作安排和局部说明重点。",
      });
    }

    if (selectedTypeIds.has("detail_highlights")) {
      appendFieldIfMissing(fields, {
        id: "detail_focus",
        label: "细节特写最应该放大哪些局部？",
        kind: "multi-select",
        required: false,
        options: ["滚刷/边刷", "尘盒/水箱", "按键/屏显", "基站/清洗仓", "传感器/顶部结构", "logo/型号"],
        value: [],
        helperText: "会影响细节图的拍摄点位和局部说明图的内容取舍。",
      });
    }

    if (selectedTypeIds.has("white_bg")) {
      appendFieldIfMissing(fields, {
        id: "spec_focus",
        label: "白底图里还有哪些型号、配置或套装信息需要被看清？",
        kind: "text",
        required: false,
        placeholder: "例如：型号、颜色、套装包含主机+基站、适用面积或续航信息",
        helperText: "会影响白底图的信息完整度和标准展示内容。",
      });
    }

    if (selectedTypeIds.has("feature_comparison")) {
      appendFieldIfMissing(fields, {
        id: "comparison_focus",
        label: "如果要做差异卖点图，最想突出哪一类优势？",
        kind: "textarea",
        required: false,
        placeholder: "例如：更省事、更贴边、更适合养宠家庭、基站功能更完整",
        helperText: "会影响差异卖点图的论证方向，避免 AI 乱编优势点。",
      });
    }

    appendReferenceFields(fields, {
      angleLabel: "补充侧面/45°整机或基站图",
      angleHelperText: brief
        ? `当前商品说明：${brief}`
        : "可补充整机侧面、45°视角或基站组合图，帮助主图、白底图和结构图更稳定。",
      detailLabel: "补充滚刷/尘盒/按键等细节图",
      detailHelperText: "建议补充滚刷、边刷、尘盒、水箱、按键或基站细节，帮助结构说明与卖点图更可信。",
    });
    return fields;
  }

  if (archetype === "home-lifestyle") {
    const fields: EcommerceSupplementField[] = [
      {
        id: "selling_points",
        label: "这次最想重点突出的使用卖点有哪些？",
        kind: "multi-select",
        required: true,
        options: ["更省空间", "材质/做工更有质感", "使用更顺手", "收纳/摆放更方便", "风格更百搭", "细节设计更贴心"],
        value: [],
        helperText: `会重点影响：${selectedTitles.join("、") || "全部已选类型"}`,
      },
      {
        id: "style_direction",
        label: "整体出图风格更偏向哪一种？",
        kind: "single-select",
        required: true,
        options: ["自然家居风", "极简清爽风", "日常生活方式风", "温暖氛围风"],
        value: "",
        helperText: "风格会贯穿主图、卖点图和空间场景图。",
      },
      {
        id: "target_audience",
        label: "本次视觉更想打动哪些使用人群或居家需求？",
        kind: "multi-select",
        required: false,
        options: ["小户型收纳", "租房/宿舍人群", "桌面整理需求", "家庭日常使用", "送礼自用场景"],
        value: [],
        helperText: "会影响使用场景、文案语气和搭配方式。",
      },
    ];

    if (wantsUsageScene) {
      fields.push({
        id: "usage_scene_focus",
        label: "场景图最想优先放在哪类空间里展示？",
        kind: "multi-select",
        required: true,
        options: ["客厅", "卧室", "桌面/书房", "厨房/餐边", "浴室/玄关"],
        value: [],
        helperText: "会影响场景图的空间选择、搭配道具和氛围方向。",
      });
    }
    if (wantsSize) {
      fields.push({
        id: "size_info",
        label: "如果要做尺寸/占地图，最希望说明哪类空间关系？",
        kind: "textarea",
        required: false,
        placeholder: "例如：适合小桌面、可放进抽屉、放在床头不会显得拥挤",
        helperText: "会影响尺寸图、摆放图和空间占比表现。",
      });
    }
    if (wantsStructure) {
      fields.push({
        id: "structure_notes",
        label: "结构说明图最需要讲清哪些组成或开合方式？",
        kind: "textarea",
        required: false,
        placeholder: "例如：分层收纳、抽拉结构、开盖方式、挂钩或底部防滑设计",
        helperText: "越清楚的结构信息，越容易做出可信的结构说明图。",
      });
    }
    if (selectedTypeIds.has("detail_highlights")) {
      appendFieldIfMissing(fields, {
        id: "detail_focus",
        label: "细节特写最应该放大哪些局部？",
        kind: "multi-select",
        required: false,
        options: ["材质纹理", "边角做工", "开合/抽拉细节", "五金/连接件", "logo/标识"],
        value: [],
        helperText: "会影响细节图和质感说明图的镜头重点。",
      });
    }
    if (selectedTypeIds.has("white_bg")) {
      appendFieldIfMissing(fields, {
        id: "spec_focus",
        label: "白底图里还有哪些尺寸、容量或套装信息需要被看清？",
        kind: "text",
        required: false,
        placeholder: "例如：长宽高、分层数量、套装包含内容",
        helperText: "会影响白底图的信息完整度和摆放表现。",
      });
    }
    if (selectedTypeIds.has("feature_comparison")) {
      appendFieldIfMissing(fields, {
        id: "comparison_focus",
        label: "如果要做差异卖点图，最想突出哪一类优势？",
        kind: "textarea",
        required: false,
        placeholder: "例如：更省空间、更稳固、更耐看、更适合小户型",
        helperText: "会影响差异卖点图的论证方向。",
      });
    }
    appendReferenceFields(fields, {
      angleLabel: "补充侧面/背面/摆放角度图",
      detailLabel: "补充材质/做工细节图",
      detailHelperText: "建议补充材质纹理、边角做工、开合细节或搭配场景局部图。",
    });
    return fields;
  }

  if (archetype === "food-beverage") {
    const fields: EcommerceSupplementField[] = [
      {
        id: "selling_points",
        label: "这次最想重点突出的食品卖点有哪些？",
        kind: "multi-select",
        required: true,
        options: ["口味记忆点", "原料/配方更有说服力", "食欲感更强", "食用更方便", "规格更划算", "包装更适合送礼/囤货"],
        value: [],
        helperText: `会重点影响：${selectedTitles.join("、") || "全部已选类型"}`,
      },
      {
        id: "style_direction",
        label: "整体出图风格更偏向哪一种？",
        kind: "single-select",
        required: true,
        options: ["食欲诱人风", "干净配料风", "日常早餐/下午茶风", "高级送礼风"],
        value: "",
        helperText: "风格会影响主图、口味图和场景图的氛围方向。",
      },
      {
        id: "target_audience",
        label: "本次视觉更想打动哪些人群或食用场景？",
        kind: "multi-select",
        required: false,
        options: ["早餐代餐人群", "办公室囤货", "学生党", "健身/控糖需求", "家庭分享场景"],
        value: [],
        helperText: "会影响场景图、卖点图和文案语气。",
      },
      {
        id: "flavor_direction",
        label: "最想优先强调哪种口味或风味方向？",
        kind: "single-select",
        required: false,
        options: ["浓郁香甜", "清爽不腻", "醇厚谷物感", "果香/花香感"],
        value: "",
        helperText: "会影响口味图、场景图和食欲感表达。",
      },
    ];

    if (wantsUsageScene) {
      fields.push({
        id: "usage_scene_focus",
        label: "场景图最想优先表现哪类食用情境？",
        kind: "multi-select",
        required: true,
        options: ["早餐桌面", "办公室加餐", "运动后补给", "家庭分享", "冲泡/开袋即食过程"],
        value: [],
        helperText: "会影响场景图的道具选择、动作安排和食欲感重点。",
      });
    }
    if (selectedTypeIds.has("ingredient_story")) {
      appendFieldIfMissing(fields, {
        id: "ingredient_proof",
        label: "配料/成分图最想重点讲清哪些原料或依据？",
        kind: "textarea",
        required: false,
        placeholder: "例如：燕麦、坚果、低糖配方、真果粒或高蛋白信息",
        helperText: "会影响配料说明图和卖点图的信息重点。",
      });
    }
    if (selectedTypeIds.has("white_bg")) {
      appendFieldIfMissing(fields, {
        id: "spec_focus",
        label: "白底图里还有哪些规格、净含量或套装信息需要被看清？",
        kind: "text",
        required: false,
        placeholder: "例如：净含量、口味组合、盒装/袋装数量",
        helperText: "会影响白底图的信息完整度和包装展示取舍。",
      });
    }
    if (selectedTypeIds.has("feature_comparison")) {
      appendFieldIfMissing(fields, {
        id: "comparison_focus",
        label: "如果要做差异卖点图，最想突出哪一类优势？",
        kind: "textarea",
        required: false,
        placeholder: "例如：配料更干净、口味更讨喜、便携更方便、囤货更划算",
        helperText: "会影响差异卖点图的论证方向。",
      });
    }
    appendReferenceFields(fields, {
      angleLabel: "补充包装侧面/背标图",
      detailLabel: "补充开封/冲泡/食材细节图",
      detailHelperText: "建议补充开封状态、冲泡过程、食材纹理或成品状态图，帮助食欲感和口味图更稳定。",
    });
    return fields;
  }

  if (archetype === "supplement-health") {
    const fields: EcommerceSupplementField[] = [
      {
        id: "selling_points",
        label: "这次最想重点突出的营养卖点有哪些？",
        kind: "multi-select",
        required: true,
        options: ["核心营养点更清楚", "成分/配方更有说服力", "服用方式更易懂", "目标人群更明确", "规格更安心", "品牌专业感更强"],
        value: [],
        helperText: `会重点影响：${selectedTitles.join("、") || "全部已选类型"}`,
      },
      {
        id: "style_direction",
        label: "整体出图风格更偏向哪一种？",
        kind: "single-select",
        required: true,
        options: ["专业可信风", "清爽成分风", "家庭健康管理风", "高端营养补充风"],
        value: "",
        helperText: "风格会贯穿主图、成分图、卖点图和服用场景图。",
      },
      {
        id: "target_audience",
        label: "本次视觉更想打动哪些目标人群？",
        kind: "multi-select",
        required: false,
        options: ["久坐熬夜人群", "中老年日常补充", "学生/脑力工作者", "健身运动人群", "日常保养人群"],
        value: [],
        helperText: "会影响场景图、卖点图和服用说明的表达重点。",
      },
      {
        id: "serving_method",
        label: "最想优先讲清哪类服用方式或剂型信息？",
        kind: "single-select",
        required: false,
        options: ["胶囊/片剂", "冲泡粉末", "软糖/咀嚼", "滴剂/液体"],
        value: "",
        helperText: "会影响服用场景图、规格图和卖点说明图。",
      },
    ];

    if (wantsUsageScene) {
      fields.push({
        id: "usage_scene_focus",
        label: "场景图最想优先展示哪类服用场景？",
        kind: "multi-select",
        required: true,
        options: ["早餐前后", "办公桌日常补充", "运动后补给", "家庭常备场景", "旅行便携服用"],
        value: [],
        helperText: "会影响场景图的道具、人物状态和说服逻辑。",
      });
    }
    if (selectedTypeIds.has("ingredient_story")) {
      appendFieldIfMissing(fields, {
        id: "ingredient_proof",
        label: "成分图最想讲清哪些成分或营养依据？",
        kind: "textarea",
        required: false,
        placeholder: "例如：叶黄素、鱼油、维生素组合及各自承担的营养角色",
        helperText: "会影响成分故事图和卖点图的信息重点。",
      });
    }
    if (selectedTypeIds.has("white_bg")) {
      appendFieldIfMissing(fields, {
        id: "spec_focus",
        label: "白底图里还有哪些规格、剂型或装量信息需要被看清？",
        kind: "text",
        required: false,
        placeholder: "例如：60粒、2盒装、软糖剂型、每日2粒",
        helperText: "会影响白底图的信息完整度和包装展示取舍。",
      });
    }
    appendReferenceFields(fields, {
      angleLabel: "补充瓶身/盒身侧面或背标图",
      detailLabel: "补充剂型/颗粒/冲泡状态细节图",
      detailHelperText: "建议补充瓶身细节、剂型特写或冲泡状态图，帮助规格图和成分图更可信。",
    });
    return fields;
  }

  if (archetype === "apparel-accessory") {
    const fields: EcommerceSupplementField[] = [
      {
        id: "selling_points",
        label: "这次最想重点突出的穿搭卖点有哪些？",
        kind: "multi-select",
        required: true,
        options: ["版型更利落", "面料质感更好", "细节做工更高级", "搭配更容易出效果", "尺码信息更清楚", "上身更显气质"],
        value: [],
        helperText: `会重点影响：${selectedTitles.join("、") || "全部已选类型"}`,
      },
      {
        id: "style_direction",
        label: "整体出图风格更偏向哪一种？",
        kind: "single-select",
        required: true,
        options: ["简约通勤风", "休闲日常风", "高级质感风", "潮流出片风"],
        value: "",
        helperText: "风格会影响主图、上身图、细节图和搭配场景图。",
      },
      {
        id: "target_audience",
        label: "本次视觉更想打动哪些穿搭人群或场景？",
        kind: "multi-select",
        required: false,
        options: ["通勤上班", "学生日常", "约会出行", "送礼场景", "轻运动休闲"],
        value: [],
        helperText: "会影响上身场景、搭配方式和文案语气。",
      },
    ];

    if (wantsUsageScene) {
      fields.push({
        id: "usage_scene_focus",
        label: "场景图最想优先展示哪类穿搭或使用情境？",
        kind: "multi-select",
        required: true,
        options: ["通勤搭配", "周末休闲", "出行旅行", "室内日常", "礼物送人"],
        value: [],
        helperText: "会影响上身图、场景图和搭配道具的选择。",
      });
    }
    if (wantsSize) {
      fields.push({
        id: "size_info",
        label: "如果要做尺码/尺寸图，最希望说明哪些信息？",
        kind: "textarea",
        required: false,
        placeholder: "例如：肩宽、衣长、包包容量、上身效果偏宽松/合身",
        helperText: "会影响尺码图、上身图和对比说明图的表达重点。",
      });
    }
    if (selectedTypeIds.has("detail_highlights")) {
      appendFieldIfMissing(fields, {
        id: "detail_focus",
        label: "细节特写最应该放大哪些局部？",
        kind: "multi-select",
        required: false,
        options: ["面料纹理", "领口/袖口", "五金/拉链", "走线/做工", "logo/吊牌"],
        value: [],
        helperText: "会影响细节图和做工说明图的镜头重点。",
      });
    }
    if (selectedTypeIds.has("white_bg")) {
      appendFieldIfMissing(fields, {
        id: "spec_focus",
        label: "白底图里还有哪些尺码、颜色或套装信息需要被看清？",
        kind: "text",
        required: false,
        placeholder: "例如：M/L尺码、黑白两色、单肩/斜挎两种背法",
        helperText: "会影响白底图的信息完整度和展示方式。",
      });
    }
    appendReferenceFields(fields, {
      angleLabel: "补充上身/侧面/背面展示图",
      detailLabel: "补充面料/五金/走线细节图",
      detailHelperText: "建议补充面料纹理、五金、走线或上身局部图，帮助细节图和质感图更稳定。",
    });
    return fields;
  }

  if (archetype === "care-device") {
    const fields: EcommerceSupplementField[] = [
      {
        id: "selling_points",
        label: "这次出图最想重点突出的卖点有哪些？",
        kind: "multi-select",
        required: true,
        options: ["便携小巧", "一键操作/简单易用", "贴合舒适", "结构设计", "居家放松护理", "轻便易携带"],
        value: [],
        helperText: `会重点影响：${selectedTitles.join("、") || "全部已选类型"}`,
      },
      {
        id: "style_direction",
        label: "整体出图风格更偏向哪一种？",
        kind: "single-select",
        required: true,
        options: ["暖感疗愈风", "极简科技风", "轻奢精致风", "居家生活方式风"],
        value: "",
        helperText: "风格会贯穿后续方案文案、场景和色彩建议。",
      },
      {
        id: "target_audience",
        label: "本次视觉更想打动哪些目标人群？",
        kind: "multi-select",
        required: false,
        options: ["久坐办公人群", "居家养生人群", "运动后放松人群", "中老年家庭护理", "女性日常护理"],
        value: [],
        helperText: "人群定位会影响使用场景、文案语气和构图重点。",
      },
    ];

    if (wantsUsageScene) {
      fields.push({
        id: "use_positions",
        label: "使用场景图中，优先展示哪些适用部位？",
        kind: "multi-select",
        required: true,
        options: ["颈部", "肩部", "腰背", "手臂", "腿部"],
        value: [],
        helperText: "会影响真人场景构图和局部镜头规划。",
      });
    }
    if (wantsSize) {
      fields.push({
        id: "size_info",
        label: "请补充产品尺寸与重量参数",
        kind: "textarea",
        required: false,
        placeholder: "例如：高 11.8cm、直径 5.6cm、重量 220g",
        helperText: "用于生成尺寸握持图、掌心对比图、桌面摆放图。",
      });
    }
    if (wantsStructure) {
      fields.push({
        id: "structure_notes",
        label: "请补充结构原理示意图所需的结构说明",
        kind: "textarea",
        required: false,
        placeholder: "例如：顶部为接触按摩头，内部为发热区，中部开孔用于散热，底部为电源键与充电位。",
        helperText: "越清楚的结构说明，越容易做出可信的结构示意图。",
      });
    }
    if (selectedTypeIds.has("selling_points")) {
      appendFieldIfMissing(fields, {
        id: "proof_points",
        label: "这些卖点里，哪些是你最希望 AI 着重放大的转化证据？",
        kind: "multi-select",
        required: false,
        options: ["使用结果更直观", "结构设计更特别", "材质/做工更高级", "操作更简单", "适用场景更明确"],
        value: [],
        helperText: "会直接影响卖点图的信息排序、文案重点和镜头分配。",
      });
    }
    if (selectedTypeIds.has("steps")) {
      appendFieldIfMissing(fields, {
        id: "step_sequence",
        label: "如果要做步骤图，最希望展示哪几个关键步骤？",
        kind: "textarea",
        required: false,
        placeholder: "例如：开机预热 -> 接触颈部 -> 来回护理 -> 结束收纳",
        helperText: "会影响步骤图的分镜顺序、动作安排和是否需要局部特写。",
      });
    }
    if (selectedTypeIds.has("detail_highlights")) {
      appendFieldIfMissing(fields, {
        id: "detail_focus",
        label: "细节特写最应该放大哪些局部？",
        kind: "multi-select",
        required: false,
        options: ["按键/接口", "顶部接触区域", "材质纹理", "边缘做工", "包装细节", "logo/标识"],
        value: [],
        helperText: "会影响细节图的拍摄点位和近景镜头重点。",
      });
    }
    if (selectedTypeIds.has("white_bg")) {
      appendFieldIfMissing(fields, {
        id: "spec_focus",
        label: "白底图里还有哪些规格/型号/容量信息需要被看清？",
        kind: "text",
        required: false,
        placeholder: "例如：容量 30ml、型号 A3、套装包含主机+充电线",
        helperText: "会影响白底图的信息完整度和细节展示取舍。",
      });
    }
    if (selectedTypeIds.has("feature_comparison")) {
      appendFieldIfMissing(fields, {
        id: "comparison_focus",
        label: "如果要做差异卖点图，最想突出哪一类优势？",
        kind: "textarea",
        required: false,
        placeholder: "例如：更便携、更适合居家护理、操作更简单、外观更高级",
        helperText: "会影响差异卖点图的论证方向，避免 AI 乱编对比优势。",
      });
    }
    if (selectedTypeIds.has("ingredient_story")) {
      appendFieldIfMissing(fields, {
        id: "ingredient_proof",
        label: "成分/功效图最想重点讲清哪几个成分或依据？",
        kind: "multi-select",
        required: false,
        options: ["核心成分名称", "成分对应功效", "温和/安全感", "使用肤感", "配方专业感"],
        value: [],
        helperText: "会影响成分故事图和功效解释图的信息重点。",
      });
    }
    appendReferenceFields(fields);
    return fields;
  }

  const fields: EcommerceSupplementField[] = [
    {
      id: "selling_points",
      label: "这次出图最想重点突出的卖点有哪些？",
      kind: "multi-select",
      required: true,
      options: ["核心功能/卖点", "主体外观更清楚", "适用场景更明确", "材质/做工更有说服力", "规格信息更完整"],
      value: [],
      helperText: `会重点影响：${selectedTitles.join("、") || "全部已选类型"}`,
    },
    {
      id: "style_direction",
      label: "整体出图风格更偏向哪一种？",
      kind: "single-select",
      required: true,
      options: ["极简清晰风", "品质电商风", "日常生活方式风", "信息说明清楚风"],
      value: "",
      helperText: "风格会贯穿主图、卖点图和场景图。",
    },
    {
      id: "target_audience",
      label: "本次视觉更想打动哪些目标人群或使用需求？",
      kind: "multi-select",
      required: false,
      options: ["日常自用", "家庭场景", "送礼需求", "看重质感的人群", "追求实用性的人群"],
      value: [],
      helperText: "会影响场景图、文案语气和卖点排序。",
    },
  ];
  if (wantsUsageScene) {
    fields.push({
      id: "usage_scene_focus",
      label: "场景图最想优先展示哪类使用情境？",
      kind: "multi-select",
      required: true,
      options: ["居家日常", "桌面/收纳", "通勤/出行", "家庭使用", "礼物/展示场景"],
      value: [],
      helperText: "会影响场景图的空间选择、道具搭配和表达重点。",
    });
  }
  if (wantsSize) {
    fields.push({
      id: "size_info",
      label: "如果要做尺寸/规格图，最希望说明哪些信息？",
      kind: "textarea",
      required: false,
      placeholder: "例如：长宽高、容量、握持感、摆放占地等",
      helperText: "会影响尺寸图、规格图和空间关系图的表达方式。",
    });
  }
  if (wantsStructure) {
    fields.push({
      id: "structure_notes",
      label: "结构说明图最需要讲清哪些组成或关键部位？",
      kind: "textarea",
      required: false,
      placeholder: "例如：主要结构、开合方式、关键部位或功能分区",
      helperText: "越清楚的结构信息，越容易做出可信的说明图。",
    });
  }
  if (selectedTypeIds.has("detail_highlights")) {
    appendFieldIfMissing(fields, {
      id: "detail_focus",
      label: "细节特写最应该放大哪些局部？",
      kind: "multi-select",
      required: false,
      options: ["材质纹理", "边角做工", "按键/接口", "logo/标识", "包装细节"],
      value: [],
      helperText: "会影响细节图和近景镜头重点。",
    });
  }
  if (selectedTypeIds.has("white_bg")) {
    appendFieldIfMissing(fields, {
      id: "spec_focus",
      label: "白底图里还有哪些规格、型号或套装信息需要被看清？",
      kind: "text",
      required: false,
      placeholder: "例如：型号、容量、颜色、套装包含内容",
      helperText: "会影响白底图的信息完整度和展示取舍。",
    });
  }
  appendReferenceFields(fields);
  return fields;
};

const buildEstimatedSupplementAnswer = (
  field: EcommerceSupplementField,
  brief: string,
  recommendedTypes: Array<{ id: string; title: string; selected: boolean }>,
): {
  value: string | string[];
  valueSource: "estimated";
  valueConfidence: "low" | "medium";
  valueNote: string;
} | null => {
  if (field.kind === "image" || isSupplementFieldAnswered(field)) {
    return null;
  }

  const archetype = inferProductArchetype(brief);
  const selectedTypeIds = new Set(
    recommendedTypes.filter((item) => item.selected).map((item) => item.id),
  );
  const selectedTitles = recommendedTypes
    .filter((item) => item.selected)
    .map((item) => item.title)
    .join("、");
  const mediumNote = "AI 已根据当前商品图、商品说明和已选图型做保守估计，建议你有更准确信息时再覆盖。";
  const lowNote = "AI 已结合商品外观与常见商品逻辑先做猜测补全，可靠性一般，建议后续核对。";
  const chooseOption = (candidates: string[]): string => {
    const options = field.options || [];
    return (
      candidates.find((candidate) => options.includes(candidate)) ||
      options[0] ||
      candidates[0] ||
      ""
    );
  };

  switch (field.id) {
    case "style_direction":
      return {
        value: chooseOption(
          selectedTypeIds.has("usage_scene")
            ? ["居家生活方式风", "暖感疗愈风", "极简科技风"]
            : ["极简科技风", "暖感疗愈风", "轻奢精致风"],
        ),
        valueSource: "estimated",
        valueConfidence: "medium",
        valueNote: mediumNote,
      };
    case "brand_tone":
      return {
        value: chooseOption(
          archetype === "serum-cream"
            ? ["医美专业感", "极简纯净感", "自然修护感"]
            : ["医美专业感", "轻奢精致感", "极简洁净感"],
        ),
        valueSource: "estimated",
        valueConfidence: "medium",
        valueNote: mediumNote,
      };
    case "finish_direction":
    case "texture_direction":
      return {
        value: chooseOption(
          archetype === "beauty-makeup"
            ? ["清透自然", "高显色高级感", "丝绒柔雾"]
            : archetype === "cleanser"
              ? ["清透啫喱感", "绵密泡沫感", "柔润洁净感"]
              : ["轻薄水润", "柔润滋养", "快速成膜感"],
        ),
        valueSource: "estimated",
        valueConfidence: "medium",
        valueNote: mediumNote,
      };
    case "selling_points":
    case "proof_points":
      return {
        value:
          field.kind === "multi-select"
            ? (field.options || []).slice(0, Math.min(3, (field.options || []).length))
            : selectedTitles || brief
              ? `优先围绕 ${selectedTitles || "当前主推图型"} 所需的核心卖点展开。`
              : "优先讲清商品主体、核心卖点和适用场景。",
        valueSource: "estimated",
        valueConfidence: "medium",
        valueNote: mediumNote,
      };
    case "target_audience":
    case "target_skin_concern":
    case "skin_type":
    case "usage_scene_focus":
      return {
        value:
          field.kind === "multi-select"
            ? (field.options || []).slice(0, Math.min(2, (field.options || []).length))
            : chooseOption(field.options || []),
        valueSource: "estimated",
        valueConfidence: "low",
        valueNote: lowNote,
      };
    case "use_positions":
    case "detail_focus":
      return {
        value: (field.options || []).slice(0, Math.min(2, (field.options || []).length)),
        valueSource: "estimated",
        valueConfidence: "medium",
        valueNote: mediumNote,
      };
    case "size_info":
      return {
        value:
          archetype === "digital-gadget"
            ? "基于当前外观先按“家电/设备主体 + 需要说明机身与基站或空间关系”来保守规划；如果后续能补充更准确的尺寸、占地或高度信息，再替换成精确表达。"
            : archetype === "home-lifestyle"
              ? "基于当前外观先按“适合家居摆放、需要说明占地与收纳关系”的思路保守规划；具体尺寸数据待你后续补充后再替换。"
              : archetype === "apparel-accessory"
                ? "基于当前信息先按“需要说明尺码/上身或容量关系”的思路保守规划；具体尺码参数待你后续补充后再替换。"
                : "基于当前外观先按“小型可单手操作设备”估计：建议后续画面按可手持、小体积、可放入床头或桌面收纳区域来规划；具体尺寸参数待你后续补充后再替换。",
        valueSource: "estimated",
        valueConfidence: "low",
        valueNote: lowNote,
      };
    case "structure_notes":
      return {
        value:
          archetype === "digital-gadget"
            ? "基于当前外观与同类设备常见结构，先按“主体外壳 + 关键执行部件 + 集尘/储液或控制区域 + 底部/顶部传感或连接结构”理解；若要做结构图，请保持示意级表达，避免画成不存在的内部精密零件。"
            : archetype === "home-lifestyle"
              ? "可先按“主体结构 + 开合/抽拉/分层部分 + 与摆放或收纳相关的关键细节”来保守理解；若没有更多实物信息，建议保持说明级表达，不要编造复杂内部结构。"
              : "基于当前外观与同类产品常见结构，先按“外壳 + 主驱动/功能模组 + 控制板/电池仓 + 与顶部工作区连接结构”理解；若要做内部结构图，请保持示意级表达，避免画成过于精密或不符合实际的内部零件。",
        valueSource: "estimated",
        valueConfidence: "low",
        valueNote: lowNote,
      };
    case "step_sequence":
      return {
        value:
          "可先按“拿起设备 -> 接触目标部位 -> 进行主要护理动作 -> 结束后收纳/放回”这类保守步骤理解，后续如有更准确信息再细化。",
        valueSource: "estimated",
        valueConfidence: "low",
        valueNote: lowNote,
      };
    case "spec_focus":
      return {
        value: "建议优先看清型号、容量/规格、套装包含内容或机身核心参数；当前可先按基础展示需求处理。",
        valueSource: "estimated",
        valueConfidence: "low",
        valueNote: lowNote,
      };
    case "flavor_direction":
      return {
        value: chooseOption(["浓郁香甜", "清爽不腻", "醇厚谷物感"]),
        valueSource: "estimated",
        valueConfidence: "medium",
        valueNote: mediumNote,
      };
    case "serving_method":
      return {
        value: chooseOption(["胶囊/片剂", "软糖/咀嚼", "冲泡粉末"]),
        valueSource: "estimated",
        valueConfidence: "low",
        valueNote: lowNote,
      };
    case "comparison_focus":
    case "ingredient_proof":
      return {
        value:
          selectedTitles
            ? `建议优先服务这些已选图型：${selectedTitles}，重点讲清当前商品最容易被用户感知到的核心差异或成分依据。`
            : "建议优先讲清当前商品最容易被用户理解的核心差异或成分依据。",
        valueSource: "estimated",
        valueConfidence: "low",
        valueNote: lowNote,
      };
    default:
      if (field.kind === "text" || field.kind === "textarea") {
        return null;
      }
      if (field.kind === "single-select") {
        return {
          value: chooseOption(field.options || []),
          valueSource: "estimated",
          valueConfidence: "low",
          valueNote: lowNote,
        };
      }
      if (field.kind === "multi-select") {
        return {
          value: (field.options || []).slice(0, Math.min(2, (field.options || []).length)),
          valueSource: "estimated",
          valueConfidence: "low",
          valueNote: lowNote,
        };
      }
      if (field.kind === "text" || field.kind === "textarea") {
        return {
          value: "AI 已结合当前商品图和已选图型先做保守估填，建议后续有更准确信息时再覆盖。",
          valueSource: "estimated",
          valueConfidence: "low",
          valueNote: lowNote,
        };
      }
      return null;
  }
};

const applyEstimatedSupplementFallbacks = (
  fields: EcommerceSupplementField[],
  brief: string,
  recommendedTypes: Array<{ id: string; title: string; selected: boolean }>,
): EcommerceSupplementField[] =>
  fields.map((field) => {
    const estimated = buildEstimatedSupplementAnswer(field, brief, recommendedTypes);
    return estimated ? { ...field, ...estimated } : field;
  });

const SUPPLEMENT_FIELD_CONFLICT_LEXICONS = {
  bodycare: ["颈部", "肩部", "腰背", "手臂", "腿部", "按摩", "理疗", "热敷", "艾灸", "接触部位"],
} as const;

const inspectSupplementFieldRelevance = (
  fields: EcommerceSupplementField[],
  brief: string,
): {
  passed: boolean;
  reasons: string[];
  fieldCount: number;
  fieldIds: string[];
} => {
  const combinedText = fields
    .flatMap((field) => [
      field.id,
      field.label,
      field.placeholder,
      field.helperText,
      ...(field.options || []),
    ])
    .filter(Boolean)
    .join(" ");
  const archetype = inferProductArchetype(String(brief || "").trim());
  const reasons = collectPlanCrossCategoryHits(combinedText, brief);

  if (archetype !== "care-device") {
    const bodycareHits = SUPPLEMENT_FIELD_CONFLICT_LEXICONS.bodycare.filter((token) =>
      combinedText.includes(token),
    );
    if (bodycareHits.length >= 2) {
      reasons.push(`出现明显护理仪/身体部位提问：${bodycareHits.slice(0, 4).join("、")}`);
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
    fieldCount: fields.length,
    fieldIds: fields.map((field) => field.id),
  };
};

const buildImageAnalysisFallback = (
  images: Array<{ id: string; name?: string }>,
  brief = "",
): EcommerceImageAnalysis[] =>
  images.map((image, index) => {
    const archetype = inferProductArchetype(brief);
    const guide = PRODUCT_ARCHETYPE_GUIDES[archetype];
    const category = inferCategoryHint(brief);
    const slotHint = getImageSlotHint(index, images.length);
    const subject = getBriefSubjectLabel(brief, guide.label);

    let materials: string[] = ["塑料机身", "金属装饰件"];
    let highlightPool = ["主体轮廓", "结构比例", "商品一致性线索"];
    let missingRisk = "如果缺少正面品牌或关键结构信息，不适合单独承担主参考图。";

    if (category === "beauty") {
      materials =
        archetype === "beauty-makeup"
          ? ["亮面/磨砂外壳", "透明件或金属件", "膏体/粉质线索"]
          : archetype === "serum-cream"
            ? ["玻璃或珠光瓶身", "金属泵头/瓶盖", "护肤品柔润质感"]
            : ["珠光软管", "金色印刷", "细闪或磨砂表面"];
      highlightPool =
        archetype === "beauty-makeup"
          ? ["包装辨识度", "色彩或刷头信息", "局部工艺细节"]
          : ["包装正面信息", "容量或品牌识别", "质地/材质线索"];
      missingRisk =
        archetype === "beauty-makeup"
          ? "如果只看到局部刷头或膏体、看不到完整包装，就不适合独立锁定主包装一致性。"
          : "如果只有局部质地或侧面弧度、缺少完整包装正面，就不适合独立锁定后续主图。";
    } else if (archetype === "care-device") {
      materials = ["机身外壳", "接触头/发热区", "按键或装饰环"];
      highlightPool = ["适用部位线索", "操作结构", "接触面或按键细节"];
      missingRisk =
        "如果看不到接触面、按键或主体正面比例，就难以支撑结构说明和使用场景图。";
    } else if (archetype === "food-beverage") {
      materials = ["包装袋/瓶身", "食材或饮品状态", "印刷标签"];
      highlightPool = ["口味识别", "包装规格", "食欲感线索"];
      missingRisk =
        "如果没有开封状态、食材形态或饮用状态，后续食欲表达会比较单薄。";
    } else if (archetype === "apparel-accessory") {
      materials = ["面料纹理", "五金或辅料", "走线或轮廓结构"];
      highlightPool = ["版型轮廓", "材质做工", "穿戴或搭配线索"];
      missingRisk =
        "如果没有上身效果或关键细节，只靠静物图很难支撑转化。";
    }

    const title =
      image.name && hasChineseText(image.name)
        ? image.name
        : buildImageAnalysisFallbackTitle(brief, index);
    const evidence = [
      `按上传顺序推断，这张图更像「${slotHint.slotLabel}」`,
      `更适合支撑 ${slotHint.likelyTasks.slice(0, 2).join("、")} 等任务`,
      missingRisk,
    ];

    return {
      imageId: image.id,
      title,
      description:
        index === 0
          ? `按当前上传顺序判断，这张图更像 ${subject} 的主参考候选，后续最适合先拿它来锁定主体比例、正面识别和整体轮廓。对于${guide.label}来说，${guide.mustShow.slice(0, 3).join("、")}这类信息通常会直接影响主图、白底图和核心卖点图的一致性；如果这张图里的正面信息完整，它就应该优先承担参考底图角色。`
          : index === 1
            ? `这张图更像用于补足主参考的第二视角，价值在于补充侧边厚度、弧面转折或包装立体感，帮助后续 45 度主视觉、白底补角度和结构说明图避免“只有正面、侧面靠猜”的问题。若该角度确实能看清边缘结构与体块关系，它适合作为辅助参考；若信息和首图重复太多，则参考价值会下降。`
            : index === 2
              ? `这张图更偏向局部细节证据位，通常更适合承担按钮、顶部、接口、泵头、质地或局部工艺说明，而不是直接做整图参考。它的优势是能补足 ${guide.mustShow.slice(0, 2).join("、")} 这类关键细节，但如果画面只剩局部、看不到整体比例，就更适合作为细节参考而不是主参考。`
              : `这张图更像补充性的细节或材质参考，价值在于提供前几张图没有覆盖到的纹理、工艺、局部结构或场景线索。它可以辅助后续局部特写图、卖点说明图或场景构图，但是否值得保留做参考，要看它是否真的补进了 ${slotHint.focus.slice(0, 2).join("、")} 这些新增信息。`,
      analysisConclusion:
        index === 0
          ? "这张图更适合优先作为主参考图，用来锁定主体比例、整体轮廓和核心识别面。"
          : index === 1
            ? "这张图更适合作为补充参考图，主要用于补强侧向结构和立体信息，不建议单独承担主体一致性约束。"
            : index === 2
              ? "这张图更适合作为细节补充参考，用于补强局部结构或材质信息，不建议单独作为主参考图。"
              : "这张图更适合作为补充说明，是否保留为参考图取决于它是否真的提供了新的有效信息。",
      angle: slotHint.angleHint,
      usableAsReference: slotHint.likelyReference,
      highlights: uniqueStrings([
        slotHint.slotLabel,
        ...highlightPool,
        ...slotHint.focus,
      ]).slice(0, 4),
      materials,
      confidence: slotHint.referencePriority === "high" ? "high" : "medium",
      evidence,
      source: "fallback",
      usedFallback: true,
      fallbackReason: "单图分析未返回可用结构，当前展示的是兜底结果。",
    };
  });

const buildPlanGroupFallback = (
  typeItem: { id: string; title: string; imageCount: number },
  imageAnalyses: Array<{ imageId: string; title: string; description: string }>,
  brief = "",
  platformMode?: EcommercePlatformMode,
): EcommercePlanGroup => {
  const archetype = inferProductArchetype(brief);
  const category = inferCategoryHint(brief);
  const referenceIds = imageAnalyses.map((item) => item.imageId).slice(0, 4);
  const ratio = resolveEcommercePlanRatio({
    platformMode,
    typeId: typeItem.id,
    typeTitle: typeItem.title,
  });
  const targetItemCount = getPlanGroupTargetItemCount(
    typeItem.id,
    typeItem.imageCount,
  );

  if (category === "beauty") {
    let beautyStrategyMap: Record<string, Array<{ label: string; value: string }>> = {
      hero_multi: [
        { label: "拍摄思路", value: "以包装正面为核心，突出品牌名、容量与香槟金洁净质感。" },
        { label: "配色方案", value: "暖白、奶油金、浅肤金，高级干净不过度艳丽。" },
        { label: "光线建议", value: "柔和商业棚拍光，边缘高光控制包装珠光与细闪质感。" },
        { label: "构图风格", value: "主体居中，留白充足，适合首图点击与轮播展示。" },
      ],
      white_bg: [
        { label: "拍摄思路", value: "完整展示软管包装正面、45 度和容量信息，符合平台标准图习惯。" },
        { label: "配色方案", value: "纯白背景 + 包装本色，保证信息清晰与真实还原。" },
        { label: "光线建议", value: "均匀白光，阴影轻，避免偏色和包装反光过曝。" },
        { label: "构图风格", value: "主体居中、比例统一、边缘干净利落。" },
      ],
      selling_points: [
        { label: "拍摄思路", value: "用包装主视觉配合卖点分区，拆解净颜提亮、温和洁净与肤感体验。" },
        { label: "配色方案", value: "奶油白、香槟金、浅绿色点缀，兼顾高级感与成分感。" },
        { label: "光线建议", value: "明亮柔光，局部成分或卖点模块可适度提亮。" },
        { label: "构图风格", value: "主体 + 信息模块组合，适合详情页阅读。 " },
      ],
      ingredient_story: [
        { label: "拍摄思路", value: "围绕积雪草等核心成分展开，兼顾成分视觉与功效表达。" },
        { label: "配色方案", value: "浅米白、草本绿、淡金色，体现专业与温和。" },
        { label: "光线建议", value: "通透柔光，增强成分洁净感与可信度。" },
        { label: "构图风格", value: "成分元素 + 包装主体 + 功效文案三段式组合。" },
      ],
      texture_demo: [
        { label: "拍摄思路", value: "展示啫喱膏体、起泡状态或清透肤感，强化使用感想象。" },
        { label: "配色方案", value: "清透白、浅米金、水感高光。" },
        { label: "光线建议", value: "近距离柔光，保留啫喱反光与质地细节。" },
        { label: "构图风格", value: "局部特写、留白简洁，突出膏体与泡沫状态。" },
      ],
      usage_scene: [
        { label: "拍摄思路", value: "在洗漱台、浴室或手部洁面情境中建立真实护肤流程感。" },
        { label: "配色方案", value: "暖白、米色、轻水感灰蓝，突出洁净舒适氛围。" },
        { label: "光线建议", value: "自然柔光或高级浴室环境光，避免场景过重抢主体。" },
        { label: "构图风格", value: "主体清晰，场景辅助，保留品牌与包装辨识度。" },
      ],
    };

    let beautySummaryMap: Record<string, string> = {
      hero_multi: "以电商首图点击率为核心，先建立品牌识别，再强化包装质感与高级洁净感。",
      white_bg: "以标准白底规范完整展示包装外观，满足平台搜索与审核需求。",
      selling_points: "围绕净颜提亮、温和洁净和肤感体验拆解详情页卖点表达。",
      ingredient_story: "围绕核心成分与功效依据建立专业感和成分信任感。",
      texture_demo: "通过膏体、泡沫和近景质地强化真实使用感想象。",
      usage_scene: "通过真实洗护场景承接护肤流程感，提升代入与种草氛围。",
    };

    let beautyTitleMap: Record<string, string[]> = {
      hero_multi: ["正面主视觉图", "45° 包装质感图", "品牌与容量识别图", "高级洁净氛围图"],
      white_bg: ["正面白底图", "45° 白底图", "容量与包装细节白底图"],
      selling_points: ["净颜提亮卖点图", "温和洁净卖点图", "肤感体验卖点图", "品牌高级感卖点图"],
      ingredient_story: ["积雪草核心成分图", "成分功效说明图", "专业可信背书图"],
      texture_demo: ["啫喱质地图", "泡沫展示图", "清透肤感特写图"],
      usage_scene: ["洗漱台洁面场景图", "手部使用氛围图", "护肤流程代入图"],
    };

    let beautyDomainLabel = "护肤清洁产品";
    let beautyPromptTone =
      "突出包装一致性、品牌识别、真实材质和高级洁净感。";
    let beautyStyling = "高级、洁净、可信的护肤品牌视觉风格。";
    let beautyUsageRisk = [
      "场景元素过多时可能削弱包装主体",
      "真人手部或水花不宜喧宾夺主",
    ];
    let beautyTextureRisk = ["质地过度夸张时容易显得不真实"];

    if (archetype === "serum-cream") {
      beautyDomainLabel = "功效型护肤产品";
      beautyPromptTone =
        "突出包装一致性、专业成分逻辑、真实肤感和功效可信度。";
      beautyStyling = "专业、纯净、可信的功效护肤品牌视觉风格。";
      beautyStrategyMap = {
        hero_multi: [
          { label: "拍摄思路", value: "以包装正面和核心功效定位为核心，突出品牌识别与专业感。" },
          { label: "配色方案", value: "暖白、浅米、淡金或浅蓝灰，兼顾专业感与高级感。" },
          { label: "光线建议", value: "柔和商业棚拍光，强调瓶身质感与干净肤感。" },
          { label: "构图风格", value: "主体居中，留白清楚，便于首图和详情页承接。" },
        ],
        white_bg: [
          { label: "拍摄思路", value: "完整展示瓶身/软管正面、45 度和容量信息，符合平台标准图习惯。" },
          { label: "配色方案", value: "纯白背景 + 包装本色，保证专业、真实、清晰。" },
          { label: "光线建议", value: "均匀白光，保留瓶身和泵头结构，不偏色不过曝。" },
          { label: "构图风格", value: "主体居中、比例统一、信息清晰利落。" },
        ],
        selling_points: [
          { label: "拍摄思路", value: "围绕功效、人群痛点和使用体验拆解详情页卖点模块。" },
          { label: "配色方案", value: "米白、浅蓝灰、淡金或草本色点缀，强化专业与修护感。" },
          { label: "光线建议", value: "明亮柔光，重点内容区适度提亮增强可读性。" },
          { label: "构图风格", value: "主体 + 信息模块组合，适合详情页阅读和转化。" },
        ],
        ingredient_story: [
          { label: "拍摄思路", value: "围绕核心成分、配方逻辑与功效依据展开，建立专业可信度。" },
          { label: "配色方案", value: "浅米白、冷淡绿、低饱和金属色，体现科学感与纯净感。" },
          { label: "光线建议", value: "通透柔光，增强成分洁净感与实验室式可信度。" },
          { label: "构图风格", value: "成分元素 + 包装主体 + 功效文案三段式组合。" },
        ],
        texture_demo: [
          { label: "拍摄思路", value: "展示精华、乳液或面霜的延展性、成膜感和肤感细节。" },
          { label: "配色方案", value: "清透白、浅米、柔润高光，突出肤感与细腻度。" },
          { label: "光线建议", value: "近距离柔光，保留质地反光和细节纹理。" },
          { label: "构图风格", value: "局部特写、留白简洁，突出质地与涂抹效果。" },
        ],
        usage_scene: [
          { label: "拍摄思路", value: "在梳妆台、晨晚护肤流程或手部涂抹场景中建立真实护肤语境。" },
          { label: "配色方案", value: "暖白、浅木色、柔灰，突出专业护肤与生活方式平衡。" },
          { label: "光线建议", value: "自然柔光或室内漫反射，避免场景过重抢主体。" },
          { label: "构图风格", value: "主体清晰，动作辅助，保留品牌与包装辨识度。" },
        ],
      };
      beautySummaryMap = {
        hero_multi: "以首图点击率为核心，先建立产品功效定位，再强化包装质感与专业可信度。",
        white_bg: "以标准白底规范完整展示包装外观与规格信息，满足平台基础展示需求。",
        selling_points: "围绕功效、人群问题与使用体验拆解详情页卖点表达。",
        ingredient_story: "围绕核心成分与功效依据建立专业感和成分信任感。",
        texture_demo: "通过质地、延展性与肤感近景强化真实使用想象。",
        usage_scene: "通过真实护肤场景承接晨晚流程感，提升代入与种草氛围。",
      };
      beautyTitleMap = {
        hero_multi: ["正面功效主视觉图", "45° 包装质感图", "品牌与功效识别图", "专业护肤氛围图"],
        white_bg: ["正面白底图", "45° 白底图", "规格与包装细节白底图"],
        selling_points: ["核心功效卖点图", "适用问题卖点图", "肤感体验卖点图", "专业信任卖点图"],
        ingredient_story: ["核心成分图", "配方功效图", "专业背书图"],
        texture_demo: ["质地延展图", "涂抹肤感图", "近景纹理特写图"],
        usage_scene: ["梳妆台护肤场景图", "手部涂抹氛围图", "晨晚护肤流程图"],
      };
    }

    if (archetype === "beauty-makeup") {
      beautyDomainLabel = "彩妆产品";
      beautyPromptTone =
        "突出包装一致性、显色质感、风格妆效和内容种草感。";
      beautyStyling = "精致、时髦、显色可信的彩妆视觉风格。";
      beautyUsageRisk = [
        "模特妆容或场景过强时可能抢走商品主体",
        "妆效过度滤镜化会削弱真实可买感",
      ];
      beautyTextureRisk = [
        "试色过度修饰时容易失真",
        "显色和材质表现不一致会影响用户判断",
      ];
      beautyStrategyMap = {
        hero_multi: [
          { label: "拍摄思路", value: "以包装主体和风格妆感线索为核心，先建立产品颜值和风格定位。" },
          { label: "配色方案", value: "根据产品色系匹配同色或低饱和背景，突出时髦和显色感。" },
          { label: "光线建议", value: "柔和但有层次的商业光，兼顾包装反光与色彩真实度。" },
          { label: "构图风格", value: "主体突出，色彩点缀克制，适合首图点击与内容封面。" },
        ],
        white_bg: [
          { label: "拍摄思路", value: "完整展示包装正面、45 度和规格/系列信息，符合平台商品规范。" },
          { label: "配色方案", value: "纯白背景 + 包装本色，保证信息清晰和色号识别。" },
          { label: "光线建议", value: "均匀白光，避免壳体高光过曝和显色偏差。" },
          { label: "构图风格", value: "主体居中、边缘干净、适合标准商品图。" },
        ],
        selling_points: [
          { label: "拍摄思路", value: "围绕显色、服帖、持妆、风格适配等信息拆解详情页卖点。" },
          { label: "配色方案", value: "以产品主色为视觉锚点，搭配低饱和中性色增强高级感。" },
          { label: "光线建议", value: "明亮但不过曝，重点保证显色和材质真实度。" },
          { label: "构图风格", value: "主体 + 卖点模块组合，适合详情页阅读和转化。" },
        ],
        texture_demo: [
          { label: "拍摄思路", value: "展示试色、膏体、粉质或刷头细节，强化显色与质地判断。" },
          { label: "配色方案", value: "中性底色 + 产品主色点缀，突出显色层次。" },
          { label: "光线建议", value: "近距离柔光，兼顾显色准确与材质细节。" },
          { label: "构图风格", value: "局部特写、留白简洁，突出试色与膏体状态。" },
        ],
        usage_scene: [
          { label: "拍摄思路", value: "在上脸近景、半身风格妆容或通勤/约会场景中建立真实妆效联想。" },
          { label: "配色方案", value: "根据妆效风格选暖调或冷调背景，避免喧宾夺主。" },
          { label: "光线建议", value: "自然柔光或干净棚拍光，保留妆效与皮肤质感。" },
          { label: "构图风格", value: "模特气质辅助商品表达，主体与妆效同时清晰。" },
        ],
        detail_highlights: [
          { label: "拍摄思路", value: "放大包装工艺、刷头、膏体切面或压纹细节，强化品质感。" },
          { label: "配色方案", value: "用中性背景或局部金属高光衬托工艺细节。" },
          { label: "光线建议", value: "高细节柔光，避免局部反光过强导致细节丢失。" },
          { label: "构图风格", value: "近景特写为主，局部细节清楚利落。" },
        ],
      };
      beautySummaryMap = {
        hero_multi: "以首图点击率为核心，先建立包装颜值与风格妆感预期。",
        white_bg: "以标准白底完整展示包装外观与规格，满足平台基础商品图需求。",
        selling_points: "围绕显色、服帖、持妆与风格适配拆解详情页卖点表达。",
        texture_demo: "通过试色、膏体与近景质地强化真实显色和使用想象。",
        usage_scene: "通过上脸或风格场景承接真实妆效联想，增强种草氛围。",
        detail_highlights: "通过局部特写强化包装做工、膏体质感与品质印象。",
      };
      beautyTitleMap = {
        hero_multi: ["正面风格主视觉图", "45° 包装颜值图", "品牌与系列识别图", "妆感氛围图"],
        white_bg: ["正面白底图", "45° 白底图", "规格与包装细节白底图"],
        selling_points: ["显色卖点图", "服帖持妆卖点图", "风格适配卖点图", "品质感卖点图"],
        texture_demo: ["试色展示图", "膏体质地图", "显色层次特写图"],
        usage_scene: ["上脸妆效图", "半身风格场景图", "通勤/约会代入图"],
        detail_highlights: ["包装工艺特写图", "刷头/膏体细节图"],
      };
    }

    return {
      typeId: typeItem.id,
      typeTitle: typeItem.title,
      summary:
        beautySummaryMap[typeItem.id] || `围绕 ${typeItem.title} 生成成组方案。`,
      strategy: beautyStrategyMap[typeItem.id] || [],
      priority:
        typeItem.id === "hero_multi" || typeItem.id === "white_bg"
          ? "high"
          : "medium",
      platformTags: [],
      items: Array.from({ length: targetItemCount }, (_, idx) => ({
        id: `${typeItem.id}-${idx + 1}`,
        title: beautyTitleMap[typeItem.id]?.[idx] || `${typeItem.title} ${idx + 1}`,
        description: `围绕 ${typeItem.title} 生成第 ${idx + 1} 张图，保持包装主体一致，并突出当前${beautyDomainLabel}分镜重点。`,
        promptOutline:
          `电商${beautyDomainLabel}产品图，主题为${typeItem.title}，${beautyPromptTone}` +
          (imageAnalyses[0]
            ? ` 参考商品分析：${imageAnalyses[0].title}，${imageAnalyses[0].description}`
            : ""),
        ratio,
        referenceImageIds: referenceIds,
        status: "ready",
        marketingGoal: beautySummaryMap[typeItem.id],
        keyMessage: `围绕 ${typeItem.title} 提升${beautyDomainLabel}认知与转化。`,
        mustShow: imageAnalyses.slice(0, 3).map((item) => item.title),
        composition: "主体突出，包装信息清晰，预留文案展示空间。",
        styling: beautyStyling,
        background: typeItem.id === "white_bg" ? "纯白背景" : "简洁通透背景，不抢主体",
        lighting: "柔和均匀的商业棚拍光线，适度表现包装珠光与细闪。",
        platformFit:
          typeItem.id === "white_bg"
            ? ["淘宝/天猫", "京东", "拼多多", "亚马逊"]
            : ["通用电商", "小红书", "详情页"],
        riskNotes:
          typeItem.id === "usage_scene"
            ? beautyUsageRisk
            : typeItem.id === "texture_demo"
              ? beautyTextureRisk
              : [],
      })),
    };
  }

  const strategyMap: Record<string, Array<{ label: string; value: string }>> = {
    hero_multi: [
      { label: "拍摄思路", value: "正面+45 度+顶部细节+握持，多角度覆盖第一印象。" },
      { label: "配色方案", value: "暖白、浅米、微橙高光，突出温润与品质。" },
      { label: "光线建议", value: "柔和棚拍光，边缘轻高光，保持干净利落。" },
      { label: "构图风格", value: "主体居中，局部可加入轻微特写。" },
    ],
    white_bg: [
      { label: "拍摄思路", value: "整机外观完整，补充 45 度与顶部细节白底版本。" },
      { label: "配色方案", value: "纯白背景 + 产品本色，强化标准白底质感。" },
      { label: "光线建议", value: "明影极轻，无偏色，边缘干净。" },
      { label: "构图风格", value: "主体居中、比例统一、边缘干净。" },
    ],
    selling_points: [
      { label: "拍摄思路", value: "产品主视觉 + 局部结构 + 卖点说明模块组合。" },
      { label: "配色方案", value: "暖米色、浅金色、微橙点缀。" },
      { label: "光线建议", value: "柔光表现疗愈感，重点区域适度提亮。" },
      { label: "构图风格", value: "中心主体 + 模块化信息分区。" },
    ],
    usage_scene: [
      { label: "拍摄思路", value: "半身局部展示，强调真实接触关系与适用部位。" },
      { label: "配色方案", value: "米白、浅木色、暖灰软装。" },
      { label: "光线建议", value: "自然柔光或室内漫反射。" },
      { label: "构图风格", value: "半身局部，情绪真实可信。" },
    ],
    steps: [
      { label: "拍摄思路", value: "步骤分栏清晰，突出开机、贴近使用、持续护理和收纳。" },
      { label: "配色方案", value: "暖白底 + 浅米图标点缀。" },
      { label: "光线建议", value: "均匀柔光，保证按键和动作清晰。" },
      { label: "构图风格", value: "信息分栏清楚，图标辅助不复杂。" },
    ],
    size_hold: [
      { label: "拍摄思路", value: "单手握持 + 掌心对比 + 桌面对照三种方式。" },
      { label: "配色方案", value: "暖白、浅木色、少量办公道具灰色。" },
      { label: "光线建议", value: "自然柔光，避免硬阴影压缩体积。" },
      { label: "构图风格", value: "比例清晰，预留参数标注空间。" },
    ],
    structure: [
      { label: "拍摄思路", value: "整体结构 + 顶部接触 + 散热逻辑三层递进。" },
      { label: "配色方案", value: "浅米、淡金、灰色线稿。" },
      { label: "光线建议", value: "偏示意图风格，兼顾真实材质。" },
      { label: "构图风格", value: "剖面标注 + 模块说明，专业但不生硬。" },
    ],
  };

  const summaryMap: Record<string, string> = {
    hero_multi: "以第一屏点击率为核心，先建立产品形态认知，再突出结构与便携感。",
    white_bg: "以标准电商白底规范展开，统一输出清晰、利落、真实的产品形态。",
    selling_points: "以图文结合方式拆解卖点，承接点击后的转化信息需求。",
    usage_scene: "用真实可信的局部场景强化使用联想，解决“怎么用、适合谁”的问题。",
    steps: "把操作流程拆成清晰步骤，降低理解门槛与咨询成本。",
    size_hold: "通过手持与对比场景直观表达尺寸感与便携感。",
    structure: "用可信结构说明提升理解度与产品信任感。",
  };

  return {
    typeId: typeItem.id,
    typeTitle: typeItem.title,
    summary: summaryMap[typeItem.id] || `围绕 ${typeItem.title} 生成成组方案。`,
    strategy: strategyMap[typeItem.id] || [],
    priority:
      typeItem.id === "hero_multi" || typeItem.id === "white_bg"
        ? "high"
        : "medium",
    platformTags: [],
    items: Array.from({ length: targetItemCount }, (_, idx) => ({
      id: `${typeItem.id}-${idx + 1}`,
      title:
        typeItem.id === "hero_multi"
          ? ["正面主视觉轮播", "45° 侧面立体展示", "顶部接触头特写", "按键与底部细节图", "单手握持场景展示"][idx] ||
            `${typeItem.title} ${idx + 1}`
          : `${typeItem.title} ${idx + 1}`,
      description: `围绕 ${typeItem.title} 生成第 ${idx + 1} 张图，保持产品主体、材质与结构一致，并突出当前分镜重点。`,
      promptOutline:
        `电商产品图，主题为${typeItem.title}，突出商品主体一致性、结构细节、真实材质和明确构图。` +
        (imageAnalyses[0]
          ? ` 参考商品分析：${imageAnalyses[0].title}，${imageAnalyses[0].description}`
          : ""),
      ratio,
      referenceImageIds: referenceIds,
      status: "ready",
      marketingGoal: summaryMap[typeItem.id],
      keyMessage: `围绕 ${typeItem.title} 提升认知与转化。`,
      mustShow: imageAnalyses.slice(0, 3).map((item) => item.title),
      composition: "主体突出，留出信息展示空间。",
      styling: "温暖、干净、可信的电商视觉风格。",
      background:
        typeItem.id === "white_bg" ? "纯白背景" : "简洁背景，不抢主体",
      lighting: "柔和均匀的商业棚拍光线。",
      platformFit:
        typeItem.id === "white_bg"
          ? ["淘宝/天猫", "京东", "拼多多", "亚马逊"]
          : ["通用电商"],
      riskNotes:
        typeItem.id === "usage_scene"
          ? ["场景元素过多时可能削弱商品主体", "真人场景需注意不要喧宾夺主"]
          : typeItem.id === "structure"
            ? ["示意感过强时可能不够像真实电商图"]
            : [],
    })),
  };
};

const buildFallbackAnalysisReview = (
  brief: string,
  recommendedTypes: EcommerceRecommendedType[],
  feedback: string,
): EcommerceAnalysisReview => {
  const requiredCount = recommendedTypes.filter((item) => item.required).length;
  const confidence =
    recommendedTypes.length >= 7 && requiredCount >= 1 ? "medium" : "low";

  return {
    confidence,
    verdict: feedback
      ? "已结合你的修改意见重新复核推荐方向，建议继续确认平台必需图和卖点覆盖是否完整。"
      : "已完成基础复核，当前推荐可以继续进入补充资料与方案规划阶段。",
    reviewerNotes: [
      `当前共保留 ${recommendedTypes.length} 类推荐出图方向。`,
      requiredCount > 0
        ? `其中包含 ${requiredCount} 类平台必需或高优先级图型。`
        : "当前未识别出明确的平台必需图型，建议人工再看是否需要补白底图或标准主图。",
      brief
        ? "已参考商品说明做一致性检查。"
        : "当前商品说明偏少，后续建议继续补充卖点、人群和使用场景信息。",
    ],
    risks:
      brief.trim().length > 0
        ? []
        : ["商品说明不足，当前复核更多基于图片外观与通用电商逻辑。"],
  };
};

const buildFallbackAnalysisSummary = (
  brief: string,
  imageCount: number,
  feedback = "",
): string => {
  if (feedback) {
    return `已结合“${feedback}”重新分析 ${imageCount} 张商品图，并同步更新推荐出图类型。`;
  }

  switch (inferProductArchetype(brief)) {
    case "care-device":
      return "从图片与商品说明判断，这是一款偏便携、强调使用部位与操作体验的护理类设备。建议优先覆盖主图、白底图、核心卖点、适用部位场景、操作步骤与结构说明，先解决“这是什么、怎么用、适合谁”的转化问题。";
    case "cleanser":
      return "从图片与商品说明判断，这是一款偏洁面净颜方向的清洁型护肤产品。建议优先覆盖主图、白底图、核心卖点、成分功效、质地/泡沫与洁面场景，形成从首屏点击到详情页信任建立的完整表达。";
    case "serum-cream":
      return "从图片与商品说明判断，这是一款强调功效、成分与肤感体验的护肤产品。建议优先覆盖主图、白底图、核心卖点、成分功效、质地展示与护肤场景，先把功效依据和使用感讲清，再承接转化。";
    case "beauty-makeup":
      return "从图片与商品说明判断，这是一款更依赖包装质感、色彩/妆效表达与种草氛围的美妆产品。建议优先覆盖主图、白底图、核心卖点、试色/质地图、妆效场景与细节特写，帮助用户快速形成风格与效果预期。";
    case "supplement-health":
      return "从图片与商品说明判断，这是一款强调成分、规格与目标人群适配的营养补充类商品。建议优先覆盖主图、白底图、核心卖点、成分说明与服用场景，重点建立可信度与购买理解。";
    case "food-beverage":
      return "从图片与商品说明判断，这是一款需要同时讲清包装、口味记忆点和食用诱因的食品饮料类商品。建议优先覆盖主图、白底图、核心卖点、口味质感与食用场景，先建立食欲感和规格认知。";
    case "apparel-accessory":
      return "从图片与商品说明判断，这是一款更依赖版型、材质细节和穿戴效果判断的服饰配件类商品。建议优先覆盖主图、白底图、细节特写、上身/搭配场景与尺码信息，帮助用户快速理解风格与适配度。";
    case "digital-gadget":
      return "从图片与商品说明判断，这是一款强调结构、功能与场景适配的数码配件类商品。建议优先覆盖主图、白底图、功能卖点、结构细节与使用场景，先把功能理解和兼容关系讲清楚。";
    case "home-lifestyle":
      return "从图片与商品说明判断，这是一款偏生活方式与空间搭配表达的家居用品。建议优先覆盖主图、白底图、核心卖点、尺寸信息与空间场景，帮助用户建立材质、大小和使用方式认知。";
    default:
      return `已识别 ${imageCount} 张商品图，并按电商详情页逻辑整理出一套推荐出图类型。`;
  }
};

const reviewProductAnalysisDraft = async (
  params: z.infer<typeof analyzeProductSchema>,
  draft: z.infer<typeof analyzeProductOutputSchema>,
): Promise<
  | {
      summary: string;
      recommendedTypes: EcommerceRecommendedType[];
      review: EcommerceAnalysisReview;
      evolutionProposals: EcommerceArchetypeEvolutionProposal[];
    }
  | null
> => {
  try {
    const archetypeContext = buildArchetypePromptContext(
      String(params.brief || "").trim(),
    );
    const parts = [
      {
        text: [
          "你是电商商品分析复核师。请复核当前分析摘要、推荐图型和复核意见是否足够贴近当前商品与平台，并输出严格 JSON。",
          "JSON 只包含 summary、recommendedTypes、review、evolutionProposals。",
          "只有在你认为现有 archetype / 图型语法不足以准确覆盖当前商品时，才输出 1 到 2 条 evolutionProposals；否则返回空数组。",
          archetypeContext,
          `当前目标平台：${getPlatformModeLabel(params.platformMode)}`,
          `当前工作模式：${getWorkflowModeLabel(params.workflowMode)}`,
          `平台策略：${buildPlatformRequirementText(params.platformMode)}`,
          `当前分析草稿：${JSON.stringify(draft, null, 2)}`,
        ].join("\n"),
      },
    ];

    const response = await generateJsonResponse({
      model: getBestModelId("thinking"),
      parts,
      temperature: 0.2,
      operation: "ecomAnalyzeProductReviewSkill",
      queueKey: "ecomAnalyzeProduct",
      minIntervalMs: 1800,
    });

    const parsedJson = parseJsonText(response.text);
    const parsedRecord = asRecord(parsedJson);
    const parsedTypes = Array.isArray(parsedRecord?.recommendedTypes)
      ? parsedRecord.recommendedTypes
          .map((item) => parseRecommendedTypeResult(item))
          .filter((item): item is EcommerceRecommendedType => Boolean(item))
      : [];
    const parsedReview = parseAnalysisReviewResult(parsedRecord?.review);
    const parsedEvolutionProposals = Array.isArray(
      parsedRecord?.evolutionProposals,
    )
      ? normalizeEvolutionProposalsForUi(
          parsedRecord.evolutionProposals
            .map((item) => parseEvolutionProposalResult(item))
            .filter(
              (item): item is EcommerceArchetypeEvolutionProposal =>
                Boolean(item),
            ),
        )
      : [];

    if (parsedTypes.length > 0 && parsedReview) {
      const fallbackTypes = getFallbackRecommendedTypes(
        String(params.brief || "").trim(),
        params.platformMode,
        params.workflowMode,
      );
      const normalizedTypes = normalizeRecommendedTypesForUi(
        expandRecommendedTypesWithFallback(
          enrichRecommendedTypesWithFallback(parsedTypes, fallbackTypes),
          fallbackTypes,
          params.workflowMode,
        ),
      );
      return {
        summary: ensureChineseUiText(
          String(parsedRecord?.summary || ""),
          "已完成商品分析复核，可继续确认推荐的出图类型。",
        ),
        recommendedTypes: normalizedTypes,
        evolutionProposals: parsedEvolutionProposals,
        review:
          withAnalysisReviewMeta(
            normalizeAnalysisReviewForUi(
              parsedReview,
              "已完成商品分析复核，可继续确认推荐的出图类型。",
            ) || {
              confidence: "medium",
              verdict: "已完成商品分析复核，可继续确认推荐的出图类型。",
              reviewerNotes: ["当前复核结果已整理为中文可读版本。"],
              risks: [],
            },
            "ai",
          ),
      };
    }
  } catch (error) {
    console.error("ecomAnalyzeProductReviewSkill error:", error);
  }

  return null;
};

const fillMissingRecommendedTypesWithAi = async (
  params: z.infer<typeof analyzeProductSchema>,
  currentItems: EcommerceRecommendedType[],
): Promise<EcommerceRecommendedType[]> => {
  const targetCount = getRecommendedTypeTargetCount(params.workflowMode);
  const existingIds = new Set(currentItems.map((item) => item.id));
  const gap = targetCount - existingIds.size;

  if (gap <= 0 || currentItems.length === 0) {
    return [];
  }

  try {
    const archetypeContext = buildArchetypePromptContext(
      String(params.brief || "").trim(),
    );
    const parts = [
      {
        text: [
          "你是电商商品分析补强助手。当前已有一部分推荐图型，但数量或覆盖面仍不足，请只补充缺失的推荐图型并输出严格 JSON。",
          "JSON 只包含 summary、recommendedTypes、review。",
          "不要重复已经存在的图型，不要为了凑数输出和商品无关的图型。",
          archetypeContext,
          `当前目标平台：${getPlatformModeLabel(params.platformMode)}`,
          `当前工作模式：${getWorkflowModeLabel(params.workflowMode)}`,
          `平台策略：${buildPlatformRequirementText(params.platformMode)}`,
          `当前已有图型：${JSON.stringify(currentItems, null, 2)}`,
          `目标数量：${targetCount}`,
          `仍需补充数量：${gap}`,
        ].join("\n"),
      },
    ];

    const response = await generateJsonResponse({
      model: getBestModelId("text"),
      parts,
      temperature: 0.2,
      operation: "ecomAnalyzeProductExpandSkill",
      queueKey: "ecomAnalyzeProduct",
      minIntervalMs: 1800,
    });

    const parsedJson = parseJsonText(response.text);
    const parsedRecord = asRecord(parsedJson);
    const parsedTypes = Array.isArray(parsedRecord?.recommendedTypes)
      ? parsedRecord.recommendedTypes
          .map((item) => parseRecommendedTypeResult(item))
          .filter((item): item is EcommerceRecommendedType => Boolean(item))
          .filter((item) => !existingIds.has(item.id))
      : [];

    return parsedTypes.slice(0, gap);
  } catch (error) {
    console.error("fillMissingRecommendedTypesWithAi error:", error);
    return [];
  }
};

export async function ecomAnalyzeProductSkill(raw: unknown): Promise<{
  summary: string;
  recommendedTypes: EcommerceRecommendedType[];
  review: EcommerceAnalysisReview;
  evolutionProposals: EcommerceArchetypeEvolutionProposal[];
}> {
  const params = analyzeProductSchema.parse(raw);
  const brief = String(params.brief || "").trim();
  const feedback = String(params.feedback || "").trim();
  const stepStartedAt = Date.now();
  const requestedImageUrls = params.productImages.slice(0, 4);
  const fallback = getFallbackRecommendedTypes(
    brief,
    params.platformMode,
    params.workflowMode,
  );
  const requestedModel = getBestModelId("thinking");
  const modelAttemptTrace: Array<Record<string, unknown>> = [];
  let imageTransportSummary: Array<Record<string, unknown>> = [];

  console.info("[ecomAnalyzeProductSkill] start", {
    totalImageCount: params.productImages.length,
    requestedImageCount: requestedImageUrls.length,
    briefLength: brief.length,
    feedbackLength: feedback.length,
    platformMode: params.platformMode || "general",
    workflowMode: params.workflowMode || "quick",
    imageInputs: summarizeImageUrlsForLog(requestedImageUrls),
  });

  try {
    const archetypeContext = buildArchetypePromptContext(brief);
    const parts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
      imageUrl?: string;
    }> = [
      {
        text:
          "你是电商一键出图工作流里的商品分析智能体，不是模板填空器。请先真正分析商品图和商品说明，再输出严格 JSON。\n" +
          "分析原则：\n" +
          "1. 必须先判断商品细分类型、包装或主体形态、购买决策因素、平台转化任务、必须展示的证据点，以及应避免的误判。\n" +
          "2. summary 必须像真实电商运营/策划给出的阶段结论，要讲清这是什么商品、用户为什么会买、视觉上应该先讲什么后讲什么。\n" +
          "3. recommendedTypes 只能推荐与当前商品强相关的图型，不相关的图型不要为了凑数量硬塞；但也不要只给过少的基础项，要形成相对完整的建议池。\n" +
          "4. 每个图型都必须把 reason、highlights、evidence 写成基于当前商品的判断，禁止写空泛套话。\n" +
          "5. 如果某个图型是平台必需或强推荐，要通过 required、recommended、priority、confidence 明确表达；如果当前阶段不建议默认勾选，可以 selected=false 并填写 omittedReason，作为备选保留。\n" +
          "6. 如图片信息不足，必须在 confidence 或 evidence 中诚实体现，不要假装确定。\n" +
          "7. 所有给用户看的文案都必须是中文，不能混英文，也不要写通用模板腔。\n" +
          "8. 除了 summary 与 recommendedTypes，还要同时输出 review，避免再额外发起一次复核请求。review 必须包含 confidence、verdict、reviewerNotes、risks。\n" +
          "9. 如果你判断当前商品已经超出既有 archetype / 图型语法的精度边界，可以额外输出 evolutionProposals，作为候选规则升级提案；如果现有体系已够用，就返回空数组。evolutionProposals 只允许是候选，不代表自动生效。\n" +
          "10. 每条 evolutionProposals 必须说明：适用于什么边界、为什么现有 archetype 不够、应该新增哪些判定因子、必须展示什么、视觉证明语法应该怎么定义、边界示例是什么。\n" +
          "11. 输出 JSON 只能包含 summary、recommendedTypes、review、evolutionProposals。recommendedTypes 每项只允许这些字段：id,title,description,imageCount,priority,platformTags,selected,reason,highlights,recommended,required,goal,confidence,evidence,omittedReason。evolutionProposals 每项只允许这些字段：candidateId,label,appliesWhen,whyCurrentArchetypesFail,proposedDecisionFactors,proposedMustShow,proposedVisualProofGrammar,boundaryExamples,confidence。\n" +
          "12. 专业模式通常推荐 8 到 10 类图型，快速模式通常推荐 5 到 7 类图型；其中应包含核心必做项和合理备选项，imageCount 要依据商品复杂度与平台任务分配，不要机械平均。\n" +
          "13. review 里必须明确说明这组推荐是否覆盖了平台必需图、卖点承接图和可选增强图，不能只写空话。\n" +
          "14. 优先复用这些稳定图型 id：hero_multi, white_bg, selling_points, usage_scene, steps, size_hold, structure, ingredient_story, texture_demo, lifestyle, detail_highlights, feature_comparison；只有确有必要时再新增简洁英文 id。\n" +
          `${archetypeContext}\n` +
          `当前目标平台：${getPlatformModeLabel(params.platformMode)}\n` +
          `当前工作模式：${getWorkflowModeLabel(params.workflowMode)}\n` +
          `平台策略：${buildPlatformRequirementText(params.platformMode)}\n` +
          `用户商品说明：${brief || "无"}\n` +
          `用户补充反馈：${feedback || "无"}`,
      },
    ];

    const preparedImages = await Promise.all(
      requestedImageUrls.map((url, index) => toModelImagePart(url, index)),
    );
    console.info("[ecomAnalyzeProductSkill] image inputs ready", {
      elapsedMs: Date.now() - stepStartedAt,
      imageSummaries: summarizeModelImagePartsForLog(preparedImages),
    });
    imageTransportSummary = summarizeModelImagePartsForLog(preparedImages);
    preparedImages.forEach((part, index) => {
      parts.push({ text: `商品图 #${index + 1}` });
      parts.push(part);
    });

    let latestResponse: Awaited<ReturnType<typeof generateJsonResponse>> | null = null;
    let latestParsedJson: unknown = null;
    let parsedTypes: EcommerceRecommendedType[] = [];
    let inlineReview: EcommerceAnalysisReview | null = null;
    let inlineEvolutionProposals: EcommerceArchetypeEvolutionProposal[] = [];
    let extractedSummary = "";
    let attemptCount = 0;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      attemptCount = attempt;
      modelAttemptTrace.push({
        phase: "primary",
        attempt,
        model: requestedModel,
        mode: "schema",
      });
      const response = await generateJsonResponse({
        model: requestedModel,
        parts:
          attempt === 1
            ? parts
            : [
                {
                  text:
                    "Retry instruction: return a strict JSON object with only summary, recommendedTypes, review, and evolutionProposals. Do not rename these keys.",
                },
                ...parts,
              ],
        temperature: 0.25,
        responseSchema: analyzeProductReviewedOutputResponseSchema,
        operation: "ecomAnalyzeProductSkill",
        queueKey: "ecomAnalyzeProduct",
        minIntervalMs: 1800,
      });

      latestResponse = response;
      latestParsedJson = parseJsonText(response.text);

      const schemaParsed =
        analyzeProductReviewedOutputSchema.safeParse(latestParsedJson);
      const schemaTypes = schemaParsed.success
        ? schemaParsed.data.recommendedTypes
            .map((item) => parseRecommendedTypeResult(item))
            .filter((item): item is EcommerceRecommendedType => Boolean(item))
        : [];
      const alternateTypes = extractAnalyzeProductRecommendedTypeCandidates(
        latestParsedJson,
      )
        .map((item) => parseRecommendedTypeResult(item))
        .filter((item): item is EcommerceRecommendedType => Boolean(item));

      parsedTypes = schemaTypes.length > 0 ? schemaTypes : alternateTypes;
      inlineReview = parseAnalysisReviewResult(
        schemaParsed.success
          ? schemaParsed.data.review
          : extractAnalyzeProductReviewCandidate(latestParsedJson),
      );
      inlineEvolutionProposals = normalizeEvolutionProposalsForUi(
        (
          schemaParsed.success
            ? schemaParsed.data.evolutionProposals
            : extractAnalyzeProductEvolutionCandidates(latestParsedJson)
        )
          .map((item) => parseEvolutionProposalResult(item))
          .filter(
            (item): item is EcommerceArchetypeEvolutionProposal =>
              Boolean(item),
          ),
      );
      extractedSummary = schemaParsed.success
        ? String(schemaParsed.data.summary || "")
        : extractAnalyzeProductSummaryText(latestParsedJson);

      if (parsedTypes.length > 0) {
        break;
      }

      console.warn("[ecomAnalyzeProductSkill] invalid structured output", {
        attempt,
        responseTextLength: response.text.length,
        responsePreview: response.text.slice(0, 400),
        payloadSummary: summarizeAnalyzeProductPayload(
          latestParsedJson,
          parsedTypes.length,
          inlineReview,
          inlineEvolutionProposals.length,
        ),
      });
    }

    const latestParsedRecord = asRecord(latestParsedJson);
    const shouldAttemptEmptyObjectRescue =
      parsedTypes.length === 0 &&
      latestParsedRecord &&
      Object.keys(latestParsedRecord).length === 0;

    if (shouldAttemptEmptyObjectRescue) {
      console.warn(
        "[ecomAnalyzeProductSkill] empty object response detected, running rescue request",
        {
          attemptCount,
          responseText: latestResponse?.text || "",
        },
      );

      const rescueParts: Array<{
        text?: string;
        inlineData?: { mimeType: string; data: string };
        imageUrl?: string;
      }> = [
        {
          text: buildAnalyzeProductRescuePrompt({
            brief,
            feedback,
            platformMode: params.platformMode,
            workflowMode: params.workflowMode,
          }),
        },
      ];
      preparedImages.forEach((part, index) => {
        rescueParts.push({ text: `Product image #${index + 1}` });
        rescueParts.push(part);
      });

      const rescueResponse = await generateJsonResponse({
        model: requestedModel,
        parts: rescueParts,
        temperature: 0.15,
        responseFormat: "text",
        operation: "ecomAnalyzeProductSkill.emptyObjectRescue",
        queueKey: "ecomAnalyzeProduct",
        minIntervalMs: 1800,
      });

      attemptCount += 1;
      modelAttemptTrace.push({
        phase: "rescue",
        attempt: attemptCount,
        model: requestedModel,
        mode: "text",
      });
      latestResponse = rescueResponse;
      latestParsedJson = parseJsonText(rescueResponse.text);

      const rescueSchemaParsed =
        analyzeProductReviewedOutputSchema.safeParse(latestParsedJson);
      const rescueSchemaTypes = rescueSchemaParsed.success
        ? rescueSchemaParsed.data.recommendedTypes
            .map((item) => parseRecommendedTypeResult(item))
            .filter((item): item is EcommerceRecommendedType => Boolean(item))
        : [];
      const rescueAlternateTypes = extractAnalyzeProductRecommendedTypeCandidates(
        latestParsedJson,
      )
        .map((item) => parseRecommendedTypeResult(item))
        .filter((item): item is EcommerceRecommendedType => Boolean(item));

      parsedTypes =
        rescueSchemaTypes.length > 0 ? rescueSchemaTypes : rescueAlternateTypes;
      inlineReview = parseAnalysisReviewResult(
        rescueSchemaParsed.success
          ? rescueSchemaParsed.data.review
          : extractAnalyzeProductReviewCandidate(latestParsedJson),
      );
      inlineEvolutionProposals = normalizeEvolutionProposalsForUi(
        (
          rescueSchemaParsed.success
            ? rescueSchemaParsed.data.evolutionProposals
            : extractAnalyzeProductEvolutionCandidates(latestParsedJson)
        )
          .map((item) => parseEvolutionProposalResult(item))
          .filter(
            (item): item is EcommerceArchetypeEvolutionProposal =>
              Boolean(item),
          ),
      );
      extractedSummary = rescueSchemaParsed.success
        ? String(rescueSchemaParsed.data.summary || "")
        : extractAnalyzeProductSummaryText(latestParsedJson);

      console.info("[ecomAnalyzeProductSkill] rescue response parsed", {
        parsedTypeCount: parsedTypes.length,
        hasReview: Boolean(inlineReview),
        evolutionProposalCount: inlineEvolutionProposals.length,
        summaryLength: extractedSummary.length,
        responseTextLength: rescueResponse.text.length,
        responsePreview: rescueResponse.text.slice(0, 400),
      });

      const rescueParsedRecord = asRecord(latestParsedJson);
      const shouldTryAlternateModels =
        parsedTypes.length === 0 &&
        rescueParsedRecord &&
        Object.keys(rescueParsedRecord).length === 0;

      if (shouldTryAlternateModels) {
        const alternateModels = getAlternateAnalyzeProductModels(requestedModel);
        for (const [index, alternateModel] of alternateModels.entries()) {
          console.warn(
            "[ecomAnalyzeProductSkill] rescue still empty, trying alternate model",
            {
              index: index + 1,
              total: alternateModels.length,
              alternateModel,
            },
          );

          try {
            const alternateResponse = await generateJsonResponse({
              model: alternateModel,
              parts: rescueParts,
              temperature: 0.15,
              responseFormat: "text",
              operation: `ecomAnalyzeProductSkill.modelFallback.${index + 1}`,
              queueKey: "ecomAnalyzeProduct",
              minIntervalMs: 1800,
            });

            attemptCount += 1;
            modelAttemptTrace.push({
              phase: "alternate-model",
              attempt: attemptCount,
              model: alternateModel,
              mode: "text",
              resultPreview: alternateResponse.text.slice(0, 120),
            });
            latestResponse = alternateResponse;
            latestParsedJson = parseJsonText(alternateResponse.text);

            const alternateSchemaParsed =
              analyzeProductReviewedOutputSchema.safeParse(latestParsedJson);
            const alternateSchemaTypes = alternateSchemaParsed.success
              ? alternateSchemaParsed.data.recommendedTypes
                  .map((item) => parseRecommendedTypeResult(item))
                  .filter(
                    (item): item is EcommerceRecommendedType => Boolean(item),
                  )
              : [];
            const alternateParsedTypes =
              alternateSchemaTypes.length > 0
                ? alternateSchemaTypes
                : extractAnalyzeProductRecommendedTypeCandidates(
                    latestParsedJson,
                  )
                    .map((item) => parseRecommendedTypeResult(item))
                    .filter(
                      (item): item is EcommerceRecommendedType => Boolean(item),
                    );

            parsedTypes = alternateParsedTypes;
            inlineReview = parseAnalysisReviewResult(
              alternateSchemaParsed.success
                ? alternateSchemaParsed.data.review
                : extractAnalyzeProductReviewCandidate(latestParsedJson),
            );
            inlineEvolutionProposals = normalizeEvolutionProposalsForUi(
              (
                alternateSchemaParsed.success
                  ? alternateSchemaParsed.data.evolutionProposals
                  : extractAnalyzeProductEvolutionCandidates(latestParsedJson)
              )
                .map((item) => parseEvolutionProposalResult(item))
                .filter(
                  (item): item is EcommerceArchetypeEvolutionProposal =>
                    Boolean(item),
                ),
            );
            extractedSummary = alternateSchemaParsed.success
              ? String(alternateSchemaParsed.data.summary || "")
              : extractAnalyzeProductSummaryText(latestParsedJson);

            console.info(
              "[ecomAnalyzeProductSkill] alternate model response parsed",
              {
                alternateModel,
                parsedTypeCount: parsedTypes.length,
                hasReview: Boolean(inlineReview),
                evolutionProposalCount: inlineEvolutionProposals.length,
                summaryLength: extractedSummary.length,
                responseTextLength: alternateResponse.text.length,
                responsePreview: alternateResponse.text.slice(0, 400),
              },
            );

            if (parsedTypes.length > 0) {
              break;
            }
          } catch (alternateError) {
            console.error(
              "[ecomAnalyzeProductSkill] alternate model request failed",
              {
                alternateModel,
                errorName:
                  alternateError instanceof Error
                    ? alternateError.name
                    : typeof alternateError,
                errorMessage:
                  alternateError instanceof Error
                    ? alternateError.message
                    : String(alternateError),
                alternateError,
              },
            );
            modelAttemptTrace.push({
              phase: "alternate-model-error",
              attempt: attemptCount + 1,
              model: alternateModel,
              mode: "text",
              errorName:
                alternateError instanceof Error
                  ? alternateError.name
                  : typeof alternateError,
              errorMessage:
                alternateError instanceof Error
                  ? alternateError.message
                  : String(alternateError),
            });
          }
        }
      }
    }

    const payloadSummary = summarizeAnalyzeProductPayload(
      latestParsedJson,
      parsedTypes.length,
      inlineReview,
      inlineEvolutionProposals.length,
    );
    console.info("[ecomAnalyzeProductSkill] parsed response", {
      elapsedMs: Date.now() - stepStartedAt,
      responseTextLength: latestResponse?.text.length || 0,
      parsedTypeCount: parsedTypes.length,
      hasReview: Boolean(inlineReview),
      evolutionProposalCount: inlineEvolutionProposals.length,
      summaryLength: extractedSummary.length,
      attemptCount,
      payloadSummary,
    });

    if (latestResponse) {
      void persistEcommerceProductAnalysisDebugSnapshot({
        stage: parsedTypes.length > 0 ? "parsed" : "invalid-structure",
        payload: {
          briefLength: brief.length,
          feedbackLength: feedback.length,
          productImageCount: params.productImages.length,
          requestedImageCount: requestedImageUrls.length,
          requestedModel,
          attemptCount,
          modelAttemptTrace,
          imageTransportSummary,
          responseMeta: latestResponse.meta || {},
          responseId:
            (latestResponse.raw as Record<string, unknown> | undefined)?.id || null,
          rawText: String(latestResponse.text || ""),
          parsedPayload: latestParsedJson,
          payloadSummary,
          extractedSummary,
          extractedReview: inlineReview,
          evolutionProposalCount: inlineEvolutionProposals.length,
        },
      });
    }

    if (parsedTypes.length > 0) {
      const normalizedSummary = ensureChineseUiText(
        extractedSummary,
        "已完成商品分析，请确认推荐的出图类型。",
      );
      const supplementedTypes = [
        ...parsedTypes,
        ...(await fillMissingRecommendedTypesWithAi(params, parsedTypes)),
      ];
      const normalizedTypes = normalizeRecommendedTypesForUi(
        expandRecommendedTypesWithFallback(
          enrichRecommendedTypesWithFallback(supplementedTypes, fallback),
          fallback,
          params.workflowMode,
        ),
      );

      return {
        summary: normalizedSummary,
        recommendedTypes: normalizedTypes,
        evolutionProposals: inlineEvolutionProposals,
        review: withAnalysisReviewMeta(
          normalizeAnalysisReviewForUi(
            inlineReview ||
              buildFallbackAnalysisReview(brief, normalizedTypes, feedback),
            "已完成基础复核，可继续确认推荐类型并进入下一步。",
          ) || buildFallbackAnalysisReview(brief, normalizedTypes, feedback),
          "ai",
          inlineReview
            ? undefined
            : "商品分析复核未返回结构化结论，当前已基于分析内容自动整理复核摘要。",
        ),
      };
    }
  } catch (error) {
    void persistEcommerceProductAnalysisDebugSnapshot({
      stage: "error",
      payload: {
        briefLength: brief.length,
        feedbackLength: feedback.length,
        productImageCount: params.productImages.length,
        requestedImageCount: requestedImageUrls.length,
        requestedModel,
        modelAttemptTrace,
        imageTransportSummary,
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    console.error("ecomAnalyzeProductSkill error:", {
      elapsedMs: Date.now() - stepStartedAt,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      error,
    });
  }

  const fallbackResult = {
    summary: buildFallbackAnalysisSummary(
      brief,
      params.productImages.length,
      feedback,
    ),
    recommendedTypes: fallback.map((item) => ({
      ...item,
      source: "fallback" as const,
      usedFallback: true,
      fallbackReason: "该推荐项来自保护性推荐池补全。",
    })),
    evolutionProposals: [],
    review: withAnalysisReviewMeta(
      buildFallbackAnalysisReview(brief, fallback, feedback),
      "fallback",
      "商品分析模型未返回可用结构，当前展示的是容灾推荐结果。",
    ),
  };

  void persistEcommerceProductAnalysisDebugSnapshot({
    stage: "fallback",
    payload: {
      briefLength: brief.length,
      feedbackLength: feedback.length,
      productImageCount: params.productImages.length,
      requestedImageCount: requestedImageUrls.length,
      requestedModel,
      modelAttemptTrace,
      imageTransportSummary,
      fallbackSummary: fallbackResult.summary,
      fallbackTypeIds: fallbackResult.recommendedTypes.map((item) => item.id),
      fallbackReview: fallbackResult.review,
    },
  });

  return fallbackResult;
}

export async function ecomSupplementQuestionsSkill(
  raw: unknown,
): Promise<{
  fields: EcommerceSupplementField[];
  mode?: "ai" | "fallback";
  reason?: string;
}> {
  const params = supplementsSchema.parse(raw);
  const brief = String(params.brief || "").trim();
  const analysisSummary = String(params.analysisSummary || "").trim();
  const groundingBrief = [brief, analysisSummary].filter(Boolean).join("\n").trim();
  const fallback = buildSupplementFallback(
    groundingBrief,
    params.recommendedTypes,
  );
  if (params.fallbackMode === "force") {
    console.warn("[ecomSupplementQuestionsSkill] fallback_forced", {
      inferredArchetype: inferProductArchetype(groundingBrief),
      fallbackFieldIds: fallback.map((field) => field.id),
    });
    return {
      fields: fallback,
      mode: "fallback",
      reason: "已按用户显式选择，直接使用保守兜底问题。",
    };
  }
  console.info("[ecomSupplementQuestionsSkill] start", {
    briefLength: brief.length,
    analysisSummaryLength: analysisSummary.length,
    inferredArchetype: inferProductArchetype(groundingBrief),
    selectedTypeIds: params.recommendedTypes
      .filter((item) => item.selected)
      .map((item) => item.id),
    fallbackFieldIds: fallback.map((field) => field.id),
  });

  try {
    const archetypeContext = buildArchetypePromptContext(groundingBrief);
    const selectedTypeSummary = buildSelectedTypeSummaryText(
      params.recommendedTypes,
    );
    const selectedTypeNeedText = buildSelectedTypeNeedText(
      params.recommendedTypes,
    );
    const prompt =
      "你是电商出图补充资料规划智能体，不是固定问卷生成器。请先结合商品图、商品说明和已选图型判断当前真正缺什么，再输出严格 JSON。\n" +
      "任务目标：只追问 AI 目前无法稳定从已有商品图和 brief 推断、但又会明显影响后续方案、提示词和生成结果的关键信息。\n" +
      "你要像详情页设计团队里的策略策划与信息架构师，先判断这套图分别要证明什么、哪些地方需要留出说明空间、用户的购买决策还缺哪类证据。\n" +
      "生成原则：\n" +
      "1. 必须先判断：当前商品图里已经清楚可见了什么、仍然缺什么、哪些信息只要不问清就会让后续方案跑偏。\n" +
      "2. 能从现有商品图或商品说明直接看出来的信息，不要重复问。\n" +
      "3. 优先追问会同时影响多个已选图型的上游信息，再追问只影响局部图型的信息。\n" +
      "4. 问题要明确对应已选图型，不要输出放在哪个商品都成立的模板问题。\n" +
      "5. 如果某类信息用户大概率不知道，就换一种更容易回答的问法，而不是机械追问专业参数。\n" +
      "6. 对于白底图、卖点图、场景图、步骤图、尺寸图、结构图、成分图、细节图、差异图等，要按已选类型缺口有针对性地问，不要漏掉明显关键约束。\n" +
      "7. 互斥选项用 single-select；可并存选项用 multi-select；只有必须自由输入时才用 text 或 textarea；只有角度、结构、细节明显不足时才用 image。\n" +
      "8. image 类型字段只能作为建议补图，不能设成 required=true，更不能作为卡住流程的唯一前置条件。\n" +
      "9. 对尺寸、内部结构、参数这类用户未必知道的问题，优先换成更容易回答的描述型问题，而不是强迫用户提供精确数据。\n" +
      "10. helperText 必须明确说明这个字段会影响哪些图型或哪类生成判断，不能只写空话。\n" +
      "11. options 必须是中文、互相有区分度、用户一看就能选；如果无法可靠预填，就保持空值，不要自作主张默认替用户选答案。\n" +
      "12. 字段总数控制在 5 到 8 个，宁少勿滥；但如果已选图型明显需要额外关键信息，不要漏问。\n" +
      "13. 所有 label、placeholder、helperText、options 都必须用中文。\n" +
      "14. 输出 JSON 只能包含 fields。每个字段只允许使用：id,label,kind,required,placeholder,options,value,helperText,maxItems,valueSource,valueConfidence,valueNote。\n" +
      "15. 如果某个关键信息本质上是在决定版式和信息承载能力，例如需要对比、需要参数卡、需要结构标注、需要主标题区，请直接问清，不要绕成泛泛风格题。\n" +
      `${buildCommercialDesignPrincipleContext({
        selectedTypes: params.recommendedTypes
          .filter((item) => item.selected)
          .map((item) => ({ id: item.id, title: item.title, imageCount: 1 })),
        brief: groundingBrief,
      })}\n` +
      `${archetypeContext}\n` +
      `当前目标平台：${getPlatformModeLabel(params.platformMode)}\n` +
      `当前工作模式：${getWorkflowModeLabel(params.workflowMode)}\n` +
      `平台策略：${buildPlatformRequirementText(params.platformMode)}\n` +
      `用户说明：${brief || "无"}\n` +
      `步骤二商品分析结论：${analysisSummary || "无"}\n` +
      `已选类型：${selectedTypeSummary}\n` +
      `这些已选类型当前最缺的信息：${selectedTypeNeedText}`;

    const parts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }> = [{ text: prompt }];

    const inlineImages = await Promise.all(
      params.productImages.slice(0, 4).map((image) => toInlinePart(image.url)),
    );
    inlineImages.forEach((part, index) => {
      parts.push({ text: `补充提问参考商品图 #${index + 1}` });
      parts.push(part);
    });

    const response = await generateJsonResponse({
      model: getBestModelId("thinking"),
      parts,
      temperature: 0.25,
      responseSchema: supplementOutputResponseSchema,
      operation: "ecomSupplementQuestionsSkill",
      disableTextOnlyFallback: true,
      queueKey: "ecomSupplementQuestions",
      minIntervalMs: 1200,
    });
    const parsedJson = parseJsonText(response.text);
    const parsed = supplementOutputSchema.safeParse(parsedJson);
    const candidateFields =
      parsed.success && parsed.data.fields.length > 0
        ? parsed.data.fields
        : parseSupplementFieldsFromUnknown(parsedJson);
    if (candidateFields.length > 0) {
      const normalizedFields = normalizeSupplementFieldsForUi(candidateFields);
      const relevanceReport = inspectSupplementFieldRelevance(
        normalizedFields,
        groundingBrief,
      );
      console.info("[ecomSupplementQuestionsSkill] parsed", {
        fieldCount: normalizedFields.length,
        fieldIds: normalizedFields.map((field) => field.id),
        relevancePassed: relevanceReport.passed,
        relevanceReasons: relevanceReport.reasons,
      });
      if (relevanceReport.passed) {
        return { fields: normalizedFields, mode: "ai" };
      }
      console.warn("[ecomSupplementQuestionsSkill] rejected_irrelevant_fields", relevanceReport);
      if (params.fallbackMode === "allow") {
        return {
          fields: fallback,
          mode: "fallback",
          reason: `AI 返回的补题和当前商品不相关，已按允许兜底模式回退。${relevanceReport.reasons.join("；")}`,
        };
      }
      throw new Error(
        `AI 返回的补充问题与当前商品不相关，已阻止自动兜底。${relevanceReport.reasons.join("；")}`,
      );
    }
    console.warn("[ecomSupplementQuestionsSkill] invalid_structured_output", {
      responseTextLength: response.text.length,
      responsePreview: String(response.text || "").slice(0, 500),
      schemaErrors: parsed.success ? undefined : parsed.error.issues.slice(0, 6),
      briefLength: brief.length,
      analysisSummaryLength: analysisSummary.length,
    });
    if (params.fallbackMode === "allow") {
      return {
        fields: fallback,
        mode: "fallback",
        reason: "AI 没有返回可用的结构化补题结果，已按允许兜底模式回退。",
      };
    }
    throw new Error("AI 没有返回可用的结构化补题结果，已阻止自动兜底。");
  } catch (error) {
    console.error("ecomSupplementQuestionsSkill error:", error);
    if (params.fallbackMode === "allow") {
      console.warn("[ecomSupplementQuestionsSkill] fallback_used", {
        inferredArchetype: inferProductArchetype(groundingBrief),
        fallbackFieldIds: fallback.map((field) => field.id),
      });
      return {
        fields: fallback,
        mode: "fallback",
        reason:
          error instanceof Error
            ? error.message
            : "补充问题生成失败，已按允许兜底模式回退。",
      };
    }
    throw error instanceof Error
      ? error
      : new Error("补充问题生成失败，已阻止自动兜底。");
  }
}

const reviewImageAnalysesDraft = async (
  params: z.infer<typeof analyzeImagesSchema>,
  items: EcommerceImageAnalysis[],
): Promise<EcommerceStageReview | null> => {
  try {
    const archetypeContext = buildArchetypePromptContext(params.brief || "");
    const prompt = `你是电商图片分析阶段的总复核员。请基于下面这组图片分析草稿，输出一个严格 JSON 对象。
要求：
1. verdict 用一句话判断当前整组图片分析是否足够支撑后续方案规划与参考图选择。
2. reviewerNotes 必须写 3 条，每条都要指出优点、缺口或需要人工确认的点，不能写空话。
3. risks 只写真正影响主参考图选择、45 度补角判断或主体一致性的风险；没有就返回空数组。
4. 只允许返回 confidence、verdict、reviewerNotes、risks 四个字段。
5. 所有内容必须使用简体中文，禁止输出 Markdown、解释文字或额外字段。
${archetypeContext}
当前目标平台：${getPlatformModeLabel(params.platformMode)}
当前工作模式：${getWorkflowModeLabel(params.workflowMode)}
补充信息摘要：${params.supplementSummary || "无"}
图片分析草稿：${JSON.stringify(items, null, 2)}`;

    const response = await generateJsonResponse({
      model: getBestModelId("text"),
      parts: [{ text: prompt }],
      temperature: 0.2,
      operation: "ecomAnalyzeImagesReviewSkill",
      queueKey: "ecomAnalyzeImages",
      minIntervalMs: 1400,
    });

    const parsed = parseStageReviewResult(parseJsonText(response.text));
    return parsed
      ? withStageReviewMeta(
          normalizeStageReviewForUi(
            parsed,
            "图片复核暂未形成稳定结论，请结合单图分析继续人工确认。",
          ) || {
            confidence: "medium",
            verdict: "图片复核暂未形成稳定结论，请结合单图分析继续人工确认。",
            reviewerNotes: [
              "建议优先检查主参考图、45 度补角图和局部细节图之间是否互相支撑。",
            ],
            risks: [],
          },
          "ai",
        )
      : null;
  } catch (error) {
    console.error("ecomAnalyzeImagesReviewSkill error:", error);
    return null;
  }
};

export async function ecomAnalyzeImagesSkill(
  raw: unknown,
): Promise<{ items: EcommerceImageAnalysis[]; review: EcommerceStageReview }> {
  const params = analyzeImagesSchema.parse(raw);
  const fallback = buildImageAnalysisFallback(
    params.productImages,
    String(params.brief || "").trim(),
  );

  try {
    const tasks = params.productImages.map(async (image, index) => {
      const promptContext = buildImageAnalysisPromptContext(
        String(params.brief || "").trim(),
        index,
        params.productImages.length,
        params.platformMode,
        params.workflowMode,
        params.supplementSummary,
      );
      const parts: Array<{
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }> = [
        {
          text:
            "你是电商工作流里的资深商品审图员，不是模板填空器。请只输出 JSON。\n" +
            "要求：\n" +
            "1. title 必须像真实商品图标签，直接写出这张图的角色，例如正面主体、45度补角度、按钮细节、材质特写，禁止只写“商品图1”。\n" +
            "2. 所有字段都必须用简体中文。\n" +
            "3. description 必须写成 60 到 180 个中文字符，并且只能写真实可见的产品与画面事实，例如外观、结构、材质、按钮接口、logo、背景、光线、包装和视角。\n" +
            "4. analysisConclusion 必须写成 30 到 120 个中文字符，只负责说明这张图是否适合作为参考图、适合支撑哪些后续出图任务、还缺什么关键信息。\n" +
            "5. angle 用一句中文概括视角或内容焦点。\n" +
            "6. usableAsReference 只有在主体轮廓或关键结构足够稳定时才写 true；如果只是局部细节、材质特写或信息重复图，要写 false。\n" +
            "7. highlights 写 3 到 5 个具体亮点，不能写空泛词。materials 写 1 到 4 个可以从图里推断的材质/工艺线索；看不出来就留空数组，不要编造。evidence 写 2 到 4 条非常具体的判断依据。\n" +
            "8. 不要把每张图都写成同一句话，不要重复“主体清晰、适合作为参考图、帮助后续生成”这种模板表达。\n" +
            "9. 看不清的地方可以明确写“不足以判断”或“信息缺失”，但不要编造图中不存在的元素。\n" +
            "10. 如果把“适合作为参考图”“支持后续生成”“更适合作为补充参考”等判断写进 description，视为格式错误，必须改写到 analysisConclusion。\n" +
            "11. 最终 JSON 字段包括 title、description、analysisConclusion、angle、usableAsReference、highlights、materials、confidence、evidence。\n" +
            `${promptContext}`,
        },
      ];
      parts.push(await toInlinePart(image.url));

      const response = await generateJsonResponse({
        model: getBestModelId("text"),
        parts,
        temperature: 0.2,
        operation: `ecomAnalyzeImage.${index + 1}`,
        queueKey: "ecomAnalyzeImages",
        minIntervalMs: 1400,
      });
      const parsed = parseImageAnalysisResult(parseJsonText(response.text), image.id);

      if (parsed) {
        return parsed;
      }

      const salvaged = salvageImageAnalysisFromText(
        response.text,
        image.id,
        fallback[index],
      );
      if (salvaged) {
        return salvaged;
      }

      console.warn(`ecomAnalyzeImage.${index + 1} parse fallback`, response.text);
      return {
        ...fallback[index],
        imageId: image.id,
      };
    });

    const items = ensureSeparatedImageAnalysisFields(
      normalizeImageAnalysesForUi(
        enrichImageAnalysesWithFallback(await Promise.all(tasks), fallback),
      ),
    );
    const reviewed = await reviewImageAnalysesDraft(params, items);
    const hasStrongAiItems = items.some((item) => item.source === "ai");
    const review = reviewed
      ? reviewed
      : withStageReviewMeta(
          normalizeStageReviewForUi(
            buildFallbackImageReview(items, params.workflowMode),
            params.workflowMode === "quick"
              ? "已完成快速图片复核，后续会优先用可参考图继续生成方案。"
              : "已完成图片复核，请重点确认哪些图片最能稳定约束商品一致性。",
          ) || buildFallbackImageReview(items, params.workflowMode),
          hasStrongAiItems ? "ai" : "fallback",
          hasStrongAiItems
            ? "图片复核模型未返回结构化结论，当前已基于单图分析自动整理复核摘要。"
            : "图片复核未返回可用结构，当前展示的是基础复核结果。",
        );
    return { items, review };
  } catch (error) {
    console.error("ecomAnalyzeImagesSkill error:", error);
    const normalizedFallback = ensureSeparatedImageAnalysisFields(
      normalizeImageAnalysesForUi(fallback),
    );
    return {
      items: normalizedFallback,
      review: withStageReviewMeta(
        normalizeStageReviewForUi(
          buildFallbackImageReview(normalizedFallback, params.workflowMode),
          params.workflowMode === "quick"
            ? "已完成快速图片复核，后续会优先用可参考图继续生成方案。"
            : "已完成图片复核，请重点确认哪些图片最能稳定约束商品一致性。",
        ) || buildFallbackImageReview(normalizedFallback, params.workflowMode),
        "fallback",
        "图片分析模型未返回可用结构，当前展示的是容灾结果。",
      ),
    };
  }
}

export async function ecomGeneratePlansSkill(
  raw: unknown,
): Promise<{ groups: EcommercePlanGroup[]; review: EcommerceStageReview }> {
  const params = generatePlansSchema.parse(raw);
  const requirements = buildPlanRequirementsFromSelectedTypes(params.selectedTypes);
  const generationPrompt = buildHighQualityPlanGenerationPrompt(params);
  let latestRejectedReport: PlanQualityReport | null = null;
  let shouldAttemptRebuildFromScratch = false;

  const buildPlanSkillResultFromGroups = async (
    seedGroups: EcommercePlanGroup[],
  ): Promise<{ groups: EcommercePlanGroup[]; review: EcommerceStageReview }> => {
    const normalizedGroups = normalizePlanGroupsForUi(seedGroups);
    const qualityReport = inspectPlanGroupsQuality(normalizedGroups, requirements);
    const missingTypeTitles = params.selectedTypes
      .filter((typeItem) => !normalizedGroups.some((group) => group.typeId === typeItem.id))
      .map((typeItem) => typeItem.title);
    const thinGroups = normalizedGroups
      .filter((group) => {
        const requirement = requirements.find((item) => item.typeId === group.typeId);
        const targetCount = getPlanGroupTargetItemCount(
          group.typeId,
          requirement?.expectedItemCount || group.items.length || 1,
        );
        const shortDescriptions = group.items.filter(
          (item) => String(item.description || "").trim().length < 28,
        ).length;
        return (
          !String(group.summary || "").trim() ||
          (group.strategy || []).length < 2 ||
          group.items.length < targetCount ||
          shortDescriptions > 0
        );
      })
      .map((group) => group.typeTitle);
    const hasAiGroups = normalizedGroups.length > 0;

    if (!hasAiGroups) {
      return {
        groups: [],
        review: withStageReviewMeta(
          {
            confidence: "low",
            verdict: "方案规划未生成通过质量验收的有效结果。",
            reviewerNotes: [
              `本次目标分组共 ${params.selectedTypes.length} 组，但没有得到可用规划结果。`,
              "系统没有再用硬兜底内容假装完成，而是直接拦截了低质量结果。",
            ],
            risks: ["当前无法直接进入批量生图，否则会把低质量规划继续放大。"],
            source: "fallback",
            usedFallback: false,
            fallbackReason: "规划结果为空，或未通过内容质量闸门。",
          },
          "fallback",
          "规划结果为空，或未通过内容质量闸门。",
        ),
      };
    }

    const cleanReviewPrompt = `你是电商方案规划复核员。请检查下面这批方案是否真的完成了分组规划，而不是只有字段齐全。
只输出 JSON。

检查重点：
1. 分组是否齐全，且每组职责明确
2. 组摘要是否解释了规划动机和信息分工
3. description 是否具体，不是短句或模板话
4. 组内方案之间是否有明确差异，不是重复换说法
5. 是否已经具备进入后续批量生成阶段的条件

目标平台：${getPlatformModeLabel(params.platformMode)}
工作模式：${getWorkflowModeLabel(params.workflowMode)}
平台要求：${buildPlatformRequirementText(params.platformMode)}
质量闸门摘要：
${summarizePlanQualityReport(qualityReport)}
当前方案：
${JSON.stringify(normalizedGroups, null, 2)}`;
    const planReviewVerdict =
      "方案规划已整理完成，请重点确认分组分工和组内镜头差异。";
    const planReviewFallbackReason =
      "规划复核模型未返回结构化结论，当前改用本地质量闸门摘要。";
    const fallbackNotes = [
      `当前共得到 ${normalizedGroups.length} 个有效分组。`,
      missingTypeTitles.length > 0
        ? `仍缺少分组：${missingTypeTitles.join("、")}`
        : "目标分组已覆盖。",
      thinGroups.length > 0
        ? `以下分组仍偏薄：${thinGroups.join("、")}`
        : "分组密度达到当前验收标准。",
      qualityReport.issues.length > 0
        ? `质量闸门记录了 ${qualityReport.issues.length} 个问题点。`
        : "质量闸门未发现明显问题。",
    ];
    const fallbackRisks = [
      missingTypeTitles.length > 0 ? `缺失分组：${missingTypeTitles.join("、")}` : "",
      thinGroups.length > 0 ? `组内内容仍可能偏薄：${thinGroups.join("、")}` : "",
    ].filter(Boolean);
    const planReviewFallback: EcommerceStageReview = {
      confidence:
        missingTypeTitles.length === 0 && thinGroups.length === 0 ? "medium" : "low",
      verdict: planReviewVerdict,
      reviewerNotes: fallbackNotes,
      risks: fallbackRisks,
    };

    let review: EcommerceStageReview | null = null;
    try {
      const reviewResponse = await generateJsonResponse({
        model: getBestModelId("text"),
        parts: [{ text: cleanReviewPrompt }],
        temperature: 0.2,
        operation: "ecomGeneratePlansReviewSkill",
        queueKey: "ecomGeneratePlans",
        minIntervalMs: 1500,
      });
      review = parseStageReviewResult(parseJsonText(reviewResponse.text));
    } catch (error) {
      console.error("ecomGeneratePlansReviewSkill error:", error);
    }

    return {
      groups: normalizedGroups,
      review: review
        ? withStageReviewMeta(
            normalizeStageReviewForUi(review, planReviewVerdict) || planReviewFallback,
            "ai",
          )
        : withStageReviewMeta(
            normalizeStageReviewForUi(
            planReviewFallback,
            planReviewVerdict,
          ) || planReviewFallback,
            "ai",
            planReviewFallbackReason,
          ),
    };
  };

  const acceptGenerateCandidate = async (
    candidateGroups: EcommercePlanGroup[],
    operation: string,
  ): Promise<EcommercePlanGroup[] | null> => {
    const finalizedGroups = finalizePlanGroupsForPlanning(
      candidateGroups,
      requirements,
      params.platformMode,
    );
    const hasStructuralCoverage = hasStructurallyCompletePlanGroups(
      finalizedGroups,
      requirements,
    );
    if (hasStructuralCoverage) {
      return finalizedGroups;
    }
    const qualityReport = inspectPlanGroupsQuality(finalizedGroups, requirements);

    if (qualityReport.passed || canSoftAcceptPlanQualityReport(qualityReport)) {
      return finalizedGroups;
    }

    latestRejectedReport = qualityReport;
    const repairedGroups = await repairPlanGroupsWithAi({
      currentGroups: finalizedGroups,
      requirements,
      qualityReport,
      brief: params.brief,
      supplementSummary: params.supplementSummary,
      imageAnalyses: params.imageAnalyses,
      platformMode: params.platformMode,
      workflowMode: params.workflowMode,
      operation,
      queueKey: "ecomGeneratePlans",
      minIntervalMs: 1500,
    });
    if (repairedGroups.length === 0) {
      return null;
    }

    const repairedReport = inspectPlanGroupsQuality(repairedGroups, requirements);
    if (!repairedReport.passed) {
      latestRejectedReport = repairedReport;
      return null;
    }

    return repairedGroups;
  };

  const rebuildPlanGroupsFromScratch = async (): Promise<EcommercePlanGroup[]> => {
    const rebuildReport =
      latestRejectedReport ||
      ({
        passed: false,
        missingTypeIds: requirements.map((item) => item.typeId),
        issues: [],
      } satisfies PlanQualityReport);
    latestRejectedReport = rebuildReport;

    return repairPlanGroupsWithAi({
      currentGroups: [],
      requirements,
      qualityReport: rebuildReport,
      brief: params.brief,
      supplementSummary: params.supplementSummary,
      imageAnalyses: params.imageAnalyses,
      platformMode: params.platformMode,
      workflowMode: params.workflowMode,
      operation: "ecomGeneratePlansSkill.rebuild",
      queueKey: "ecomGeneratePlans",
      minIntervalMs: 1500,
    });
  };

  try {
    const parsedGroups = await requestPlanGroupsFromAi({
      model: getBestModelId("thinking"),
      prompt: generationPrompt,
      temperature: 0.3,
      operation: "ecomGeneratePlansSkill",
      queueKey: "ecomGeneratePlans",
      minIntervalMs: 1500,
      platformMode: params.platformMode,
    });
    if (parsedGroups.length > 0) {
      const acceptedGroups = await acceptGenerateCandidate(
        parsedGroups,
        "ecomGeneratePlansSkill.qualityRepair",
      );
      if (acceptedGroups) {
        return buildPlanSkillResultFromGroups(acceptedGroups);
      }
    } else {
      shouldAttemptRebuildFromScratch = true;
    }
  } catch (error) {
    console.error("ecomGeneratePlansSkill error:", error);
    shouldAttemptRebuildFromScratch = true;
  }

  if (shouldAttemptRebuildFromScratch) {
    const rebuiltGroups = await rebuildPlanGroupsFromScratch();
    if (rebuiltGroups.length > 0) {
      const rebuiltReport = inspectPlanGroupsQuality(rebuiltGroups, requirements);
      if (rebuiltReport.passed) {
        return buildPlanSkillResultFromGroups(rebuiltGroups);
      }
      latestRejectedReport = rebuiltReport;
    }
  }

  return {
    groups: [],
    review: withStageReviewMeta(
      {
        confidence: "low",
        verdict: "方案规划未生成通过质量验收的有效结果。",
        reviewerNotes: [
          `本次目标分组共 ${params.selectedTypes.length} 组，但生成结果没有通过质量闸门。`,
          latestRejectedReport
            ? "已尝试一次质量修复，但内容仍然偏薄或分组仍有缺失。"
            : "模型没有返回可用的结构化规划结果。",
          latestRejectedReport
            ? summarizePlanQualityReport(latestRejectedReport)
            : "当前没有可用于进入下一阶段的真实规划内容。",
        ],
        risks: ["建议先修复规划质量，再进入批量生图，否则只会放大低质量内容。"],
        source: "fallback",
        usedFallback: false,
        fallbackReason: "规划结果未通过内容质量闸门，已停止后续放行。",
      },
      "fallback",
      "规划结果未通过内容质量闸门，已停止后续放行。",
    ),
  };
}

export async function ecomAutofillSupplementsSkill(
  raw: unknown,
): Promise<{ fields: EcommerceSupplementField[] }> {
  const params = autofillSupplementsSchema.parse(raw);
  const currentFields = normalizeSupplementFieldsForUi(params.fields);
  const unansweredFields = currentFields.filter(
    (field) => field.kind !== "image" && !isSupplementFieldAnswered(field),
  );

  if (unansweredFields.length === 0) {
    return { fields: currentFields };
  }

  try {
    const archetypeContext = buildArchetypePromptContext(
      String(params.brief || "").trim(),
    );
    const selectedTypeSummary = buildSelectedTypeSummaryText(
      params.recommendedTypes,
    );
    const selectedTypeNeedText = buildSelectedTypeNeedText(
      params.recommendedTypes,
    );
    const parts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }> = [
      {
        text:
          "你是电商一键出图工作流里的补充资料智能代填助手。你的任务不是瞎编答案，而是只补那些能从商品图、商品说明和已选图型中可靠推断出来的字段，并输出严格 JSON。\n" +
          "代填规则：\n" +
          "1. 先补你有把握推断的字段；如果无法直接判断，但可以基于商品图、品类、常见电商表达做保守估计，也可以补一个“估计值”。\n" +
          "2. 如果使用保守估计，请把 valueSource 设为 estimated，并填写 valueConfidence（low 或 medium）与 valueNote，明确告诉用户这是 AI 的估填/猜测，方便后续覆盖。\n" +
          "3. 不允许虚构品牌承诺、夸张功效、精确尺寸、证书、成分浓度、适用人群限制等图片和说明中看不出来的硬事实；估计时要用保守表达，如“可先按……理解”“建议先按……规划”。\n" +
          "4. 已经有值的字段默认以用户填写为准，不要乱改；但如果当前值明显像系统早期的通用默认占位答案、过于泛泛且与你基于商品图的判断不一致，可以谨慎改成更贴合当前商品的答案。\n" +
          "5. image 类型字段不要伪造图片地址，保持原样；没有更多商品图也不能因此让流程卡住。\n" +
          "6. single-select 和 multi-select 尽量优先从现有 options 中选择；如果确有必要，也可以输出简洁中文自定义值。\n" +
          "7. 输出必须保留原字段的 id、label、kind、required、placeholder、options、helperText、maxItems，只调整 value，并可补充 valueSource、valueConfidence、valueNote。\n" +
          "8. 所有输出给用户看的内容都必须是中文。\n" +
          "9. 输出 JSON 只能包含 fields。\n" +
          `${archetypeContext}\n` +
          `当前目标平台：${getPlatformModeLabel(params.platformMode)}\n` +
          `当前工作模式：${getWorkflowModeLabel(params.workflowMode)}\n` +
          `平台策略：${buildPlatformRequirementText(params.platformMode)}\n` +
          `用户商品说明：${String(params.brief || "").trim() || "无"}\n` +
          `已选图型：${selectedTypeSummary}\n` +
          `这些图型当前最缺的信息：${selectedTypeNeedText}\n` +
          `当前字段：${JSON.stringify(currentFields, null, 2)}`,
      },
    ];

    const inlineImages = await Promise.all(
      params.productImages.slice(0, 1).map((image) => toInlinePart(image.url)),
    );
    inlineImages.forEach((part, index) => {
      parts.push({ text: `参考商品图 #${index + 1}` });
      parts.push(part);
    });

    const response = await generateJsonResponse({
      model: getBestModelId("text"),
      parts,
      temperature: 0.1,
      responseSchema: supplementOutputResponseSchema,
      operation: "ecomAutofillSupplementsSkill",
      disableTextOnlyFallback: true,
      queueKey: "ecomAutofillSupplements",
      minIntervalMs: 1200,
      requestTuning: ECOM_SUPPLEMENT_AUTOFILL_REQUEST_TUNING,
    });

    const parsedJson = parseJsonText(response.text);
    const parsed = supplementOutputSchema.safeParse(parsedJson);
    const extractedUnknownFields =
      parsed.success && parsed.data.fields.length > 0
        ? []
        : parseSupplementFieldsFromUnknown(parsedJson);
    const candidateFields =
      parsed.success && parsed.data.fields.length > 0
        ? parsed.data.fields
        : extractedUnknownFields;

    const payloadSummary = {
      topLevelShape: summarizeUnknownValueShape(parsedJson),
      topLevelKeys: Object.keys(asRecord(parsedJson) || {}).slice(0, 12),
      fieldsShape: summarizeUnknownValueShape(asRecord(parsedJson)?.fields),
      dataShape: summarizeUnknownValueShape(asRecord(parsedJson)?.data),
      resultShape: summarizeUnknownValueShape(asRecord(parsedJson)?.result),
      outputShape: summarizeUnknownValueShape(asRecord(parsedJson)?.output),
      payloadShape: summarizeUnknownValueShape(asRecord(parsedJson)?.payload),
      candidateFieldCount: candidateFields.length,
      unknownExtractedFieldCount: extractedUnknownFields.length,
    };

    void persistEcommerceSupplementDebugSnapshot({
      stage: candidateFields.length > 0 ? "autofill-parsed" : "autofill-empty",
      payload: {
        briefLength: String(params.brief || "").trim().length,
        productImageCount: params.productImages.length,
        recommendedTypeCount: params.recommendedTypes.length,
        inputFieldCount: currentFields.length,
        unansweredFieldCount: unansweredFields.length,
        requestedModel: response.meta?.model || getBestModelId("text"),
        responseMeta: response.meta || {},
        responseId:
          (response.raw as Record<string, unknown> | undefined)?.id || null,
        rawText: String(response.text || ""),
        parsedPayload: parsedJson,
        schemaSuccess: parsed.success,
        schemaFieldCount: parsed.success ? parsed.data.fields.length : 0,
        payloadSummary,
      },
    });

    if (candidateFields.length > 0) {
      return {
        fields: normalizeSupplementFieldsForUi(
          applyEstimatedSupplementFallbacks(
            candidateFields,
            String(params.brief || "").trim(),
            params.recommendedTypes,
          ),
        ),
      };
    }
    throw new Error(
      `AI 没有返回可用的补充资料代填结果。shape=${payloadSummary.topLevelShape}; keys=${payloadSummary.topLevelKeys.join(",") || "none"}`,
    );
  } catch (error) {
    console.error("ecomAutofillSupplementsSkill error:", error);
    void persistEcommerceSupplementDebugSnapshot({
      stage: "autofill-error",
      payload: {
        briefLength: String(params.brief || "").trim().length,
        productImageCount: params.productImages.length,
        recommendedTypeCount: params.recommendedTypes.length,
        inputFieldCount: currentFields.length,
        unansweredFieldCount: unansweredFields.length,
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error || "unknown_error"),
      },
    });
    throw error instanceof Error
      ? error
      : new Error("补充资料代填失败，已阻止静默回退。");
  }
}

export async function ecomAutofillImageAnalysesSkill(
  raw: unknown,
): Promise<{ items: EcommerceImageAnalysis[] }> {
  const params = autofillImageAnalysesSchema.parse(raw);
  const currentItems = ensureSeparatedImageAnalysisFields(
    normalizeImageAnalysesForUi(params.currentItems),
  );

  if (currentItems.length === 0) {
    return { items: currentItems };
  }

  try {
    const archetypeContext = buildArchetypePromptContext(
      String(params.brief || "").trim(),
    );
    const parts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }> = [
      {
        text:
          "你是电商一键出图工作流里的图片分析补全助手。请基于商品图、补充信息和当前草稿，补全并修正每张商品图的分析结果，并输出严格 JSON。\n" +
          "要求：\n" +
          "1. 必须保留每张图原有 imageId，不要新增或删除条目。\n" +
          "2. 所有输出都用简体中文，不能写模板空话，必须针对当前图片内容分别分析。\n" +
          "3. description 只能写图片里真实可见的事实，例如主体外观、结构、材质、按钮接口、logo、背景、光线、包装和视角。\n" +
          "4. analysisConclusion 只能写判断结论，例如这张图是否适合作为参考图、适合支撑哪些后续出图任务、还缺哪些关键信息。\n" +
          "5. 看不清的地方要明确写信息不足、降低 confidence，不能编造图中看不到的元素。\n" +
          "6. 输出 JSON 只能包含 items，且每项字段只允许：imageId,title,description,analysisConclusion,angle,usableAsReference,highlights,materials,confidence,evidence。\n" +
          `${archetypeContext}\n` +
          `当前目标平台：${getPlatformModeLabel(params.platformMode)}\n` +
          `当前工作模式：${getWorkflowModeLabel(params.workflowMode)}\n` +
          `补充信息摘要：${params.supplementSummary || "无"}\n` +
          `当前图片分析草稿：${JSON.stringify(currentItems, null, 2)}`,
      },
    ];

    const inlineImages = await Promise.all(
      params.productImages.slice(0, 4).map((image) => toInlinePart(image.url)),
    );
    inlineImages.forEach((part, index) => {
      parts.push({ text: `参考商品图 #${index + 1}` });
      parts.push(part);
    });

    const response = await generateJsonResponse({
      model: getBestModelId("thinking"),
      parts,
      temperature: 0.2,
      operation: "ecomAutofillImageAnalysesSkill",
      disableTextOnlyFallback: true,
      queueKey: "ecomAutofillImageAnalyses",
      minIntervalMs: 1200,
    });

    const parsed = analyzeImagesOutputSchema.safeParse(parseJsonText(response.text));
    if (parsed.success && parsed.data.items.length > 0) {
      return {
        items: ensureSeparatedImageAnalysisFields(
          normalizeImageAnalysesForUi(parsed.data.items),
        ),
      };
    }
    throw new Error("AI 没有返回可用的图片分析补全结果。");
  } catch (error) {
    console.error("ecomAutofillImageAnalysesSkill error:", error);
    throw error instanceof Error
      ? error
      : new Error("图片分析补全失败，已阻止静默回退。");
  }
}

export async function ecomAutofillPlansSkill(
  raw: unknown,
): Promise<{ groups: EcommercePlanGroup[] }> {
  const params = autofillPlansSchema.parse(raw);
  const currentGroups = normalizePlanGroupsForUi(params.currentGroups);
  const requirements = buildPlanRequirementsFromGroups(currentGroups);
  const autofillPrompt = buildHighQualityPlanAutofillPrompt(params, currentGroups);

  if (currentGroups.length === 0) {
    return { groups: currentGroups };
  }

  const acceptAutofillCandidate = async (
    candidateGroups: EcommercePlanGroup[],
  ): Promise<EcommercePlanGroup[] | null> => {
    const finalizedGroups = finalizePlanGroupsForPlanning(
      candidateGroups,
      requirements,
      params.platformMode,
    );
    const qualityReport = inspectPlanGroupsQuality(finalizedGroups, requirements, {
      brief: params.brief,
    });

    if (qualityReport.passed) {
      return finalizedGroups;
    }
    if (!shouldAttemptPlanRepairForWorkflow(qualityReport, params.workflowMode)) {
      return finalizedGroups;
    }

    const repairedGroups = await repairPlanGroupsWithAi({
      currentGroups: finalizedGroups,
      requirements,
      qualityReport,
      brief: params.brief,
      supplementSummary: params.supplementSummary,
      imageAnalyses: params.imageAnalyses,
      platformMode: params.platformMode,
      workflowMode: params.workflowMode,
      operation: "ecomAutofillPlansSkill.qualityRepair",
      queueKey: "ecomAutofillPlans",
      minIntervalMs: 1200,
    });
    if (repairedGroups.length === 0) {
      return null;
    }

    const repairedReport = inspectPlanGroupsQuality(repairedGroups, requirements, {
      brief: params.brief,
    });
    if (repairedReport.passed || !shouldAttemptPlanRepairForWorkflow(repairedReport, params.workflowMode)) {
      return repairedGroups;
    }
    return null;
  };

  try {
    const candidateGroups = await requestPlanGroupsFromAi({
      model: getBestModelId("thinking"),
      prompt: autofillPrompt,
      temperature: 0.15,
      operation: "ecomAutofillPlansSkill",
      queueKey: "ecomAutofillPlans",
      minIntervalMs: 1200,
      platformMode: params.platformMode,
    });
    if (candidateGroups.length > 0) {
      const acceptedGroups = await acceptAutofillCandidate(candidateGroups);
      if (acceptedGroups) {
        return { groups: acceptedGroups };
      }
    }
    throw new Error("AI 没有返回通过质量校验的方案补全结果。");
  } catch (error) {
    console.error("ecomAutofillPlansSkill error:", error);
    throw error instanceof Error
      ? error
      : new Error("方案补全失败，已阻止静默回退。");
  }
}

const buildFallbackImageReview = (
  items: EcommerceImageAnalysis[],
  workflowMode?: EcommerceWorkflowMode,
): EcommerceStageReview => {
  const preferredItems = items.filter((item) => item.usableAsReference);
  const preferredTitles = preferredItems
    .slice(0, 2)
    .map((item) => `“${item.title}”`);
  const missingAngleNote = items.some(
    (item) => ["正面", "45度", "侧面", "顶部", "细节"].some(
      (keyword) => (item.angle || "").includes(keyword),
    ),
  )
    ? "当前角度信息已经覆盖主视图与 45 度补角，后续优先核对它们是否能稳定支撑主体一致性。"
    : "当前角度信息还不够完整，建议补充正面或 45 度视角后再进入下一步。";

  return {
    confidence: preferredItems.length >= 1 ? "medium" : "low",
    verdict:
      preferredTitles.length > 0
        ? workflowMode === "quick"
          ? `当前已有可用参考图，建议优先保留 ${preferredTitles.join("、")} 继续推进。`
          : `当前图片分析已能初步支撑后续方案规划，建议优先围绕 ${preferredTitles.join("、")} 作为参考图。`
        : "当前图片分析还不足以稳定支撑后续方案规划，建议先补充更明确的主体参考图。",
    reviewerNotes: [
      `当前共分析 ${items.length} 张图片，其中 ${preferredItems.length} 张更适合作为后续参考图。`,
      preferredItems.length > 0
        ? `${preferredTitles[0]} 当前是最优先的参考候选，建议继续核对它与其他图片之间的主体一致性。`
        : "目前还没有足够稳定的参考图，建议优先补充正面主体或 45 度补角图。",
      missingAngleNote,
    ],
    risks:
      preferredItems.length > 0
        ? []
        : ["缺少稳定参考图时，后续方案规划和主体一致性判断会明显变弱。"],
  };
};

export async function ecomRewritePromptSkill(
  raw: unknown,
): Promise<{ prompt: string }> {
  const params = rewritePromptSchema.parse(raw);
  const imageAnalysisSummary = (params.imageAnalyses || [])
    .slice(0, MAX_PROMPT_REFERENCE_IMAGES)
    .map(
      (item, index) =>
        `参考图${index + 1}：${item.title}${
          item.angle ? `，角度 ${item.angle}` : ""
        }；${item.description}`,
    )
    .join("\n");
  const designPrincipleBlock = buildPromptDesignPrincipleBlock({
    typeTitle: params.typeTitle,
    planTitle: params.planTitle,
    planDescription: params.planDescription,
    currentPrompt: params.currentPrompt,
  });

  const prompt = `你是电商商品图提示词编辑，不是安全说明书。请把下面这段方案草稿改写成更适合 Nano Banana 2 / Gemini 图像生成模型直接执行的最终中文提示词。

核心目标：
1. 第一优先级是“同一商品主体一致性”，参考图里的商品必须被视为同一个真实商品。
2. 只保留当前这张图真正需要的识别锚点、镜头任务和场景信息，不要把所有规则都重复抄一遍。
3. 输出必须是可直接生图、也方便人工继续微调的一段自然中文提示词。
4. 最终画面必须像“有商业完成度的电商图”，而不是“内容没错但很普通的场景图”。
5. 这段提示词必须明确这张图承担什么商业任务，例如首图点击、品质感建立、卖点承接、内容种草或详情页说明。

写法要求：
1. 优先写成 220 到 420 个中文字符；如果任务确实复杂，可以略长，但不要堆砌重复禁令和同义反复。
2. 按这个顺序组织：出图目标 -> 主体锚定 -> 当前镜头与构图 -> 背景或场景 -> 光线与材质 -> 电商用途 -> 结尾少量关键限制。
3. 主体锚定只保留 3 到 6 个最关键识别特征，优先选择和当前任务最相关的结构，不要把全部结构逐条抄写。
4. “不要改商品”“不要拼图”“不要多商品”“不要海报字”这类限制，只在结尾集中写一次，不要在全文反复出现。
5. 如果是白底图，要突出平台合规、主体轮廓和标准展示；如果是卖点图、场景图、详情图，只突出这张图负责说明的单一任务，不要把全套卖点塞进一张图。
6. 如果草稿或参考图里有重复信息，要主动压缩合并，保留最能约束主体一致性和镜头执行的内容。
7. 每段提示词都要写出明确的视觉层级：商品是唯一主角，背景/道具/人物只负责烘托，不能把画面写成平均发力的普通场景图。
8. 光线和材质不能只写“高级感、质感、氛围感”，必须落到具体执行，比如干净棚拍侧逆光、柔和边缘高光、玻璃/金属/磨砂表面反射控制、前景虚化或景深控制。
9. 不要写成流程说明、审计清单、标签堆砌或空泛营销话术；少用“绝对不允许”“必须严格”“高质量”“高级感”这类空强化词，除非后面紧跟具体镜头、光线、材质或构图细节。
10. 如果改写后的提示词看起来像“换成别的商品也能用”的通用句子，说明仍然太普通，必须继续具体化到这件商品、这次镜头任务和这张图的商业角色。
11. 最终只输出一段中文提示词，不要解释，不要标题，不要 Markdown。

出图类型：${params.typeTitle}
方案标题：${params.planTitle}
方案说明：${params.planDescription || "无"}
当前提示词草稿：
${params.currentPrompt}

商品说明：${params.productDescription || "无"}
补充约束：${params.supplementSummary || "无"}
目标比例：${params.targetRatio || "未指定"}
额外修改建议：${params.feedback || "无"}
${designPrincipleBlock ? `\n${designPrincipleBlock}` : ""}
${imageAnalysisSummary ? `最关键的参考图片分析（最多 ${MAX_PROMPT_REFERENCE_IMAGES} 张）：\n${imageAnalysisSummary}` : ""}

请只返回严格 JSON，格式为 {"prompt":"最终提示词"}。`;

  try {
    const requestRewrite = async (extraDirective?: string) => {
      const response = await generateJsonResponse({
        model: getBestModelId("thinking"),
        parts: [
          {
            text: extraDirective
              ? `${prompt}\n\n补充修正要求：\n${extraDirective}`
              : prompt,
          },
        ],
        temperature: extraDirective ? 0.25 : 0.35,
        operation: "ecomRewritePromptSkill",
        disableTextOnlyFallback: true,
        queueKey: "ecomRewritePrompt",
        minIntervalMs: 1200,
      });

      const parsed = parseJsonText(response.text);
      const rewritten =
        typeof parsed?.prompt === "string"
          ? parsed.prompt.trim()
          : typeof response.text === "string"
            ? response.text.trim()
            : "";
      const normalized = normalizeKnownEcommerceText(rewritten);
      if (!normalized || !hasChineseText(normalized)) {
        throw new Error("AI 没有返回有效的中文提示词改写结果。");
      }

      return normalized;
    };

    const firstPrompt = await requestRewrite();
    const firstReport = inspectPromptCommercialQuality(firstPrompt);

    if (firstReport.passed) {
      return { prompt: firstPrompt };
    }

    const repairedPrompt = await requestRewrite(
      `上一版提示词仍然偏普通，不足以支撑高调性的电商主视觉。请重点修复这些问题：${firstReport.issues.join(
        "；",
      )}。必须补足商业任务、主次层级、背景控制、具体光线材质执行；不要只喊“高级感、质感、氛围感”，也不要写成换个商品也能复用的通用句子。`,
    );
    const repairedReport = inspectPromptCommercialQuality(repairedPrompt);

    return {
      prompt:
        repairedReport.score >= firstReport.score ? repairedPrompt : firstPrompt,
    };
  } catch (error) {
    console.error("ecomRewritePromptSkill error:", error);
    throw error instanceof Error
      ? error
      : new Error("提示词改写失败");
  }
}

export async function ecomReviewGeneratedResultSkill(
  raw: unknown,
): Promise<z.infer<typeof resultReviewSchema>> {
  const params = reviewGeneratedResultSchema.parse(raw);
  const fallback: z.infer<typeof resultReviewSchema> = {
    score: 42,
    confidence: "low",
    summary: `当前未完成基于设计原理的可靠评审，这张图暂时只能作为「${params.planTitle}」的待人工复核候选图。`,
    strengths: ["结果已经成功生成", "可继续人工核对商品一致性、证据表达与系统统一性"],
    issues: ["当前未完成可靠的参考图对比评审，不能把这张图当作高分结果看待"],
    recommendedUse:
      params.platformMode === "douyin" || params.platformMode === "xiaohongshu"
        ? "建议先人工确认与原商品一致后，再判断是否保留为内容候选图"
        : "建议先人工确认与原商品一致后，再判断是否继续用于详情页或标准图",
  };

  try {
    const designPrincipleBlock = buildPromptDesignPrincipleBlock({
      typeTitle: params.typeTitle || "未提供",
      planTitle: params.planTitle,
      planDescription: params.productDescription,
      currentPrompt: params.prompt || "",
    });
    const visualProofContext = buildVisualProofGrammarContext(
      `${params.typeTitle || ""} ${params.planTitle} ${params.productDescription || ""}`,
    );
    const visualSystemContext = buildVisualSystemConsistencyContext({
      platformMode: params.platformMode,
      selectedTypes: params.typeTitle
        ? [{ id: params.typeTitle, title: params.typeTitle, imageCount: 1 }]
        : undefined,
    });
    const parts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }> = [
      {
        text:
          "你是电商结果评审师，同时也是详情页设计总监。请把“商品一致性”放在最高优先级，审核当前生成结果，只输出严格 JSON。\n" +
          "要求：\n" +
          "1. 给 0-100 的 score。\n" +
          "2. 给 summary、strengths、issues、recommendedUse。\n" +
          "3. 必须优先检查商品一致性、主体清晰度、卖点表达、平台适配、构图执行度、单图职责完成度、证据是否成立、整套视觉系统是否延续。\n" +
          "4. 如果生成结果与参考图中的商品不是同一个主体，或关键结构/颜色/包装明显不一致，score 不得高于 45。\n" +
          "5. 如果只是场景好看、光影不错，但商品主体不像原商品，仍然必须给低分。\n" +
          "6. strengths 和 issues 必须写具体观察，不能写空话。\n" +
          "7. 如果 score >= 70，strengths 里必须至少点名 2 个与参考图一致的具体特征，例如轮廓、瓶盖、logo 位置、按钮数量、主色关系、材质趋势。\n" +
          "8. 只要存在“像是另一款商品、另一种包装或另一套结构”的嫌疑，issues 必须明确写出，且不能给高分。\n" +
          "9. 不要被氛围感误导，先判断是不是同一个商品，再看场景、构图和光线是否优秀。\n" +
          "10. 如果当前图没有把卖点转成可见证据，例如只有空氛围没有结构/局部/参数/对比/路径/动作支撑，不能给高分。\n" +
          "11. 如果当前图看起来像另一套视觉系统，没有延续该任务应有的主色、材质、光影、镜头语言或说明图形语气，也不能给高分。\n" +
          "12. 如果当前图没有完成这张图自己的单图职责，例如卖点图却只剩漂亮场景，结构图却没有可读结构，参数图却没有信息承载空间，必须明确扣分。\n" +
          "13. 如果 score >= 75，strengths 或 summary 里必须至少提到 1 条“卖点视觉化证据”观察，以及 1 条“整套系统统一性”观察。\n" +
          "14. 全部字段必须用中文。\n" +
          `${designPrincipleBlock}\n` +
          `${visualProofContext}\n` +
          `${visualSystemContext}\n` +
          `当前目标平台：${getPlatformModeLabel(params.platformMode)}\n` +
          `方案标题：${params.planTitle}\n` +
          `所属类型：${params.typeTitle || "未提供"}\n` +
          `商品说明：${params.productDescription || "无"}\n` +
          `生成提示词：${params.prompt || "无"}\n` +
          `参考图数量：${params.referenceImages?.length || 0}`,
      },
    ];

    for (const [index, url] of (params.referenceImages || [])
      .slice(0, MAX_PROMPT_REFERENCE_IMAGES)
      .entries()) {
      parts.push({ text: `参考商品图 ${index + 1}` });
      parts.push(await toInlinePart(url));
    }

    parts.push({ text: "待评审生成结果" });
    parts.push(await toInlinePart(params.imageUrl));

    const requestReview = async (extraDirective?: string) => {
      const response = await generateJsonResponse({
        model: getBestModelId("thinking"),
        parts: [
          {
            text: extraDirective
              ? `${parts[0].text}\n\n补充复核要求：\n${extraDirective}`
              : parts[0].text,
          },
          ...parts.slice(1),
        ],
        temperature: extraDirective ? 0.15 : 0.2,
        operation: extraDirective
          ? "ecomReviewGeneratedResultSkill.coverageRepair"
          : "ecomReviewGeneratedResultSkill",
        disableTextOnlyFallback: true,
        queueKey: "ecomResultReview",
        minIntervalMs: 1200,
        requestTuning: {
          timeoutMs: 30000,
          idleTimeoutMs: 45000,
          retries: 0,
          baseDelayMs: 800,
          maxDelayMs: 2500,
        },
      });

      return resultReviewSchema.safeParse(parseJsonText(response.text));
    };

    const firstParsed = await requestReview();
    if (firstParsed.success) {
      const firstCoverage = inspectResultReviewCoverage(firstParsed.data);
      if (firstCoverage.passed) {
        return normalizeResultReviewForUi(
          firstParsed.data,
          `已完成设计原理评审，这张图可作为「${params.planTitle}」的候选版本继续比较。`,
        );
      }

      const repairedParsed = await requestReview(
        `上一版评审仍不够专业，缺少这些判断：${firstCoverage.issues.join(
          "；",
        )}。请补足商品一致性依据、卖点是否被视觉化证明、是否延续整套视觉系统、以及这张图是否完成自己的单图职责。不要只给泛泛的“画面不错/质感可以”式评语。`,
      );
      if (repairedParsed.success) {
        return normalizeResultReviewForUi(
          repairedParsed.data,
          `已完成设计原理评审，这张图可作为「${params.planTitle}」的候选版本继续比较。`,
        );
      }
    }
  } catch (error) {
    console.error("ecomReviewGeneratedResultSkill error:", error);
  }

  return normalizeResultReviewForUi(
    fallback,
    `当前未完成设计原理评审，这张图暂时只能作为「${params.planTitle}」的待人工复核候选图。`,
  );
}
