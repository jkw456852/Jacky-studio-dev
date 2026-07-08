import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { tool, type ToolSet } from "ai";

import {
  assistantSidebarListStudioSkillsParameters,
  assistantSidebarPlanStudioWorkflowParameters,
  type AssistantSidebarListStudioSkillsArgs,
  type AssistantSidebarPlanStudioWorkflowArgs,
} from "../services/assistant-ui/assistant-sidebar-tool-schemas.ts";

type StudioSkillPreset = {
  name?: unknown;
  description?: unknown;
  category?: unknown;
  tab?: unknown;
  frontstagePriority?: unknown;
  activationHint?: unknown;
  preferredSkills?: unknown;
  clarifyChecklist?: unknown;
  executionOutline?: unknown;
  executionRecipe?: unknown;
  outputBlueprint?: unknown;
  toolPolicy?: unknown;
  examplePrompt?: unknown;
  tags?: unknown;
};

export type AssistantChatStudioSkillSummary = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tab?: string;
  frontstagePriority?: string;
  activationHint?: string;
  preferredSkills: string[];
  clarifyChecklist: string[];
  executionOutline: string[];
  executionRecipe: string[];
  outputBlueprint: string[];
  toolPolicy?: string;
  examplePrompt?: string;
  tags: string[];
};

export type AssistantChatStudioSkillsToolResult = {
  matches: AssistantChatStudioSkillSummary[];
  totalAvailable: number;
  guidance: string;
};

export type AssistantChatStudioWorkflowPlanResult = {
  workflowId: string;
  workflowName: string;
  workflowType: "image-set" | "product-detail-page" | "brand-system" | "social-carousel" | "creative-workflow";
  request: string;
  referenceImageCount: number;
  imageCount: number;
  productTruthChecklist: string[];
  deliverables: Array<{
    index: number;
    title: string;
    role: string;
    promptBrief: string;
    mustPreserve: string[];
  }>;
  plan: Array<{
    title: string;
    goal: string;
    createImagePromptBrief: string;
  }>;
  executionOrder: string[];
  createImageGuidance: {
    useSeparateImages: boolean;
    count: number;
    passReferenceImages: boolean;
    recommendedInput: {
      count: number;
      images: "pass-current-reference-images" | "none";
      promptStrategy: string;
      negativeInstruction: string;
    };
  };
  guidance: string;
};

const STUDIO_REGISTRY_URL = new URL(
  "../public/runtime-assets/studio-registry.json",
  import.meta.url,
);

const MAX_TEXT_LENGTH = 900;

const normalizeString = (value: unknown): string => String(value ?? "").trim();

const hasMojibake = (value: string): boolean =>
  /[\uFFFD\u9365\u9471\u6FB6\u5A11\u6748\u93BC\u7D31\u6C8C]/.test(value);

const cleanText = (value: unknown, maxLength = MAX_TEXT_LENGTH): string => {
  const text = normalizeString(value).replace(/\s+/g, " ");
  if (!text || hasMojibake(text)) return "";
  return text.length > maxLength
    ? `${text.slice(0, maxLength - 3).trim()}...`
    : text;
};

const cleanTextArray = (value: unknown, maxItems = 8): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 420))
    .filter(Boolean)
    .slice(0, maxItems);
};

const toSearchTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[\s,.;:!?()[\]{}"'`~|/\\\uFF0C\u3002\uFF1B\uFF1A\uFF01\uFF1F\uFF08\uFF09\u3010\u3011\u3001]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toStudioSkillSummary = (
  id: string,
  preset: StudioSkillPreset,
): AssistantChatStudioSkillSummary | null => {
  const name = cleanText(preset.name, 80);
  if (!id || !name) return null;

  return {
    id,
    name,
    ...(cleanText(preset.description, 240)
      ? { description: cleanText(preset.description, 240) }
      : {}),
    ...(cleanText(preset.category, 60)
      ? { category: cleanText(preset.category, 60) }
      : {}),
    ...(cleanText(preset.tab, 60) ? { tab: cleanText(preset.tab, 60) } : {}),
    ...(cleanText(preset.frontstagePriority, 60)
      ? { frontstagePriority: cleanText(preset.frontstagePriority, 60) }
      : {}),
    ...(cleanText(preset.activationHint, 360)
      ? { activationHint: cleanText(preset.activationHint, 360) }
      : {}),
    preferredSkills: cleanTextArray(preset.preferredSkills, 8),
    clarifyChecklist: cleanTextArray(preset.clarifyChecklist, 6),
    executionOutline: cleanTextArray(preset.executionOutline, 8),
    executionRecipe: cleanTextArray(preset.executionRecipe, 8),
    outputBlueprint: cleanTextArray(preset.outputBlueprint, 8),
    ...(cleanText(preset.toolPolicy, 360)
      ? { toolPolicy: cleanText(preset.toolPolicy, 360) }
      : {}),
    ...(cleanText(preset.examplePrompt, 360)
      ? { examplePrompt: cleanText(preset.examplePrompt, 360) }
      : {}),
    tags: cleanTextArray(preset.tags, 10),
  };
};

const loadStudioSkillSummaries = async (): Promise<
  AssistantChatStudioSkillSummary[]
> => {
  const registryPath = fileURLToPath(STUDIO_REGISTRY_URL);
  const registry = JSON.parse(await readFile(registryPath, "utf8")) as unknown;
  const skillPresets = isRecord(registry)
    ? (registry.skillPresets as unknown)
    : undefined;
  const entries = isRecord(skillPresets) ? Object.entries(skillPresets) : [];

  return entries
    .flatMap(([id, preset]) => {
      if (!isRecord(preset)) return [];
      const summary = toStudioSkillSummary(id, preset as StudioSkillPreset);
      return summary ? [summary] : [];
    })
    .sort((a, b) => {
      const priorityOrder = { primary: 0, secondary: 1 } as Record<string, number>;
      const left = priorityOrder[a.frontstagePriority || ""] ?? 9;
      const right = priorityOrder[b.frontstagePriority || ""] ?? 9;
      if (left !== right) return left - right;
      return a.name.localeCompare(b.name, "zh-CN");
    });
};

const scoreStudioSkill = (
  skill: AssistantChatStudioSkillSummary,
  options: AssistantSidebarListStudioSkillsArgs,
): number => {
  let score = skill.frontstagePriority === "primary" ? 10 : 4;
  const tab = cleanText(options.tab, 40);
  if (tab && skill.tab === tab) score += 30;

  const query = cleanText(options.query, 500);
  if (!query) return score;

  const searchable = [
    skill.id,
    skill.name,
    skill.description,
    skill.category,
    skill.tab,
    skill.activationHint,
    skill.preferredSkills.join(" "),
    skill.executionRecipe.join(" "),
    skill.outputBlueprint.join(" "),
    skill.tags.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const token of toSearchTokens(query)) {
    if (skill.id.toLowerCase().includes(token)) score += 12;
    if (skill.name.toLowerCase().includes(token)) score += 16;
    if (searchable.includes(token)) score += 6;
  }

  if (
    /[\u8be6\u8a73][\u60c5\u60c5][\u9875\u9801]|detail|pdp|listing|[\u7535\u96fb]\u5546|\u5546\u54c1|[\u4ea7\u7522]\u54c1|\u5957\u56fe|\u591a\u56fe|\u591a[\u5f20\u5f35]/i.test(
      query,
    )
  ) {
    if (skill.id === "cn-detail-page") score += 50;
    if (skill.tab === "commerce") score += 20;
  }
  if (
    /\u54c1\u724c|brand|logo|vi|[\u89c6\u8996][\u89c9\u89ba]\u7cfb\u7edf/i.test(
      query,
    ) &&
    skill.tab === "branding"
  ) {
    score += 25;
  }
  if (
    /\u793e\u5a92|\u5c0f\u7ea2\u4e66|instagram|carousel|[\u8f6e\u8f2a]\u64ad|post/i.test(
      query,
    ) &&
    skill.tab === "social"
  ) {
    score += 25;
  }

  return score;
};

export const listAssistantChatStudioSkills = async (
  input: AssistantSidebarListStudioSkillsArgs = {},
): Promise<AssistantChatStudioSkillsToolResult> => {
  const skills = await loadStudioSkillSummaries();
  const tab = cleanText(input.tab, 40);
  const numericLimit = Number(input.limit);
  const limit = Number.isFinite(numericLimit)
    ? Math.max(1, Math.floor(numericLimit))
    : 4;
  const filtered = tab ? skills.filter((skill) => skill.tab === tab) : skills;
  const matches = filtered
    .map((skill) => ({
      skill,
      score: scoreStudioSkill(skill, input),
    }))
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name, "zh-CN"))
    .slice(0, limit)
    .map((entry) => entry.skill);

  return {
    matches,
    totalAvailable: skills.length,
    guidance:
      "\u8fd9\u4e9b\u662f Studio \u5de5\u4f5c\u6d41\u5efa\u8bae\uff0c\u4e0d\u662f\u65e7\u6280\u80fd\u6267\u884c\u94fe\u3002\u5148\u7528\u5339\u914d\u5230\u7684 skill \u89c4\u5212\u4ea4\u4ed8\u7ed3\u6784\uff1b\u53ea\u6709\u7528\u6237\u660e\u786e\u8981\u751f\u6210/\u7f16\u8f91\u56fe\u7247\u65f6\uff0c\u518d\u8c03\u7528 createImage\uff0c\u5e76\u628a\u591a\u56fe\u9700\u6c42\u4f5c\u4e3a separate images \u7684 count \u4f20\u5165\u3002",
  };
};

const normalizeWorkflowImageCount = (value: unknown, fallback = 4): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.floor(numeric));
};

const normalizeReferenceImageCount = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
};

const fallbackWorkflowPlanTitles = [
  "Product hero and first-screen value proposition",
  "Core ingredient or feature explanation",
  "Usage scene and benefit proof",
  "Conversion close with trust and offer cues",
];

const resolveWorkflowType = (
  request: string,
  workflowId: string,
  preferredWorkflow: AssistantChatStudioSkillSummary | undefined,
): AssistantChatStudioWorkflowPlanResult["workflowType"] => {
  const text = [
    request,
    workflowId,
    preferredWorkflow?.name,
    preferredWorkflow?.tab,
    preferredWorkflow?.tags.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/detail|pdp|listing|[\u8be6\u8a73][\u60c5\u60c5][\u9875\u9801]|[\u7535\u96fb]\u5546|商品|产品页|产品详情/.test(text)) {
    return "product-detail-page";
  }
  if (/brand|logo|vi|品牌|视觉系统/.test(text)) {
    return "brand-system";
  }
  if (/carousel|social|instagram|小红书|社媒|轮播/.test(text)) {
    return "social-carousel";
  }
  if (/image set|separate images|多图|套图|多张/.test(text)) {
    return "image-set";
  }
  return "creative-workflow";
};

export const planAssistantChatStudioWorkflow = async (
  input: AssistantSidebarPlanStudioWorkflowArgs,
): Promise<AssistantChatStudioWorkflowPlanResult> => {
  const request = cleanText(input.request, 900);
  const matches = await listAssistantChatStudioSkills({
    query: request || input.workflowId || "studio workflow",
    limit: 4,
  });
  const preferredWorkflow =
    matches.matches.find((skill) => skill.id === cleanText(input.workflowId, 80)) ||
    matches.matches[0];
  const workflowId = preferredWorkflow?.id || cleanText(input.workflowId, 80) || "studio-workflow";
  const workflowName = preferredWorkflow?.name || workflowId;
  const workflowType = resolveWorkflowType(request, workflowId, preferredWorkflow);
  const imageCount = normalizeWorkflowImageCount(input.imageCount);
  const referenceImageCount = normalizeReferenceImageCount(input.referenceImageCount);
  const outputBlueprint = preferredWorkflow?.outputBlueprint || [];
  const executionRecipe = preferredWorkflow?.executionRecipe || [];
  const clarifyChecklist = preferredWorkflow?.clarifyChecklist || [];
  const planTitles =
    outputBlueprint.length > 0
      ? outputBlueprint
      : fallbackWorkflowPlanTitles;
  const productPreservationRules =
    referenceImageCount > 0
      ? [
          "Preserve the uploaded/reference product appearance.",
          "Do not invent a different product, packaging shape, color, label, logo, material, or visible structure.",
          "Use the reference image as product identity, not merely loose inspiration.",
        ]
      : [
          "Keep product constraints explicit before execution.",
          "Ask for a product/reference image when visual fidelity matters.",
        ];
  const deliverables = Array.from({ length: imageCount }).map((_, index) => {
    const title = cleanText(planTitles[index] || fallbackWorkflowPlanTitles[index] || `Image ${index + 1}`, 120);
    const recipeHint = cleanText(executionRecipe[index] || executionRecipe[0] || "", 220);
    const role =
      recipeHint ||
      "One separate visual deliverable in the coordinated Studio workflow.";
    const promptBrief = [
      `Separate image ${index + 1} of ${imageCount}.`,
      `Role: ${title}.`,
      referenceImageCount > 0
        ? "Preserve the uploaded/reference product appearance; do not invent a different product."
        : "Ask for or infer missing product constraints before visual execution when product fidelity matters.",
      recipeHint ? `Direction: ${recipeHint}` : "",
      "Do not compose this as a collage, grid, contact sheet, or multi-panel single image.",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      index: index + 1,
      title,
      role,
      promptBrief,
      mustPreserve: productPreservationRules,
    };
  });
  const plan = deliverables.map((deliverable) => ({
    title: deliverable.title,
    goal: deliverable.role,
    createImagePromptBrief: deliverable.promptBrief,
  }));

  return {
    workflowId,
    workflowName,
    workflowType,
    request,
    referenceImageCount,
    imageCount,
    productTruthChecklist:
      clarifyChecklist.length > 0
        ? clarifyChecklist.slice(0, 6)
        : [
            "Confirm the exact product/reference image to preserve.",
            "Lock visible product shape, color, label, material, and packaging details.",
            "Keep generated assets as separate images, not one collage.",
          ],
    deliverables,
    plan,
    executionOrder: [
      "Summarize locked product/reference constraints to the user.",
      "Confirm the separate image/page roles before visual execution.",
      "Call createImage with count set to the number of separate deliverables when the user wants generation now.",
      "Pass available reference images through the official createImage images input for product consistency.",
    ],
    createImageGuidance: {
      useSeparateImages: true,
      count: imageCount,
      passReferenceImages: referenceImageCount > 0,
      recommendedInput: {
        count: imageCount,
        images:
          referenceImageCount > 0 ? "pass-current-reference-images" : "none",
        promptStrategy:
          "Use the deliverables array as the generation contract. If the model/provider supports n/count, request separate images in one createImage call; otherwise execute one deliverable per createImage call.",
        negativeInstruction:
          "Do not create one collage, four-grid, contact sheet, or multi-panel single image unless the user explicitly asks for a collage.",
      },
    },
    guidance:
      "This is an assistant-ui/AI SDK workflow planning tool result, not a legacy skill execution chain. Treat deliverables as the contract for later createImage calls: keep outputs separate, preserve reference products, and only execute when the user wants images generated or edited now.",
  };
};

export const createAssistantChatStudioSkillTools = (): { tools: ToolSet } => ({
  tools: {
    listStudioSkills: tool({
      description:
        "List matching XC Studio workflow skills for planning creative tasks before calling execution tools.",
      inputSchema: assistantSidebarListStudioSkillsParameters,
      execute: async (input) =>
        listAssistantChatStudioSkills(input as AssistantSidebarListStudioSkillsArgs),
    }),
    planStudioWorkflow: tool({
      description:
        "Plan a Studio creative workflow, such as a product-detail-page image set, before calling execution tools.",
      inputSchema: assistantSidebarPlanStudioWorkflowParameters,
      execute: async (input) =>
        planAssistantChatStudioWorkflow(input as AssistantSidebarPlanStudioWorkflowArgs),
    }),
  },
});
