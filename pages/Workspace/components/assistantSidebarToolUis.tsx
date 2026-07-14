"use client";

import React from "react";
import { z } from "zod";
import {
  type ImageMessagePart,
  type ToolCallMessagePartComponent,
  useToolCallElapsed,
  useToolArgsStatus,
} from "@assistant-ui/react";

import {
  MapPinIcon,
} from "lucide-react";

import { Image as AssistantImage } from "@/components/assistant-ui/image";
import {
  WeatherWidget,
  type WeatherWidgetPayload,
} from "@/components/assistant-ui/tool-ui/weather-widget/runtime";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import type { AssistantSidebarCreateImageArgs } from "../../../services/assistant-ui/assistant-sidebar-tool-schemas.ts";
import { parseAssistantToolError } from "../../../services/assistant-ui/assistant-tool-error.ts";

type CreateTargetElementToolResult = {
  ok?: boolean;
  elementId?: string | null;
  prompt?: string;
  referenceCount?: number;
  error?: string;
};

type GenerateImageToolResultRawImage = {
  type?: "image";
  image?: string;
  url?: string;
  filename?: string;
  mediaType?: string;
  data?: string;
};

type GenerateImageToolResultImage = ImageMessagePart & {
  mediaType?: string;
  data?: string;
  url?: string;
};

type GenerateImageToolResult = {
  providerId?: string;
  providerName?: string;
  modelId?: string;
  prompt?: string;
  referenceCount?: number;
  size?: string;
  aspectRatio?: string;
  resolution?: string;
  count?: number;
  settingsLocked?: boolean;
  operation?: string;
  images?: GenerateImageToolResultRawImage[];
  metadata?: {
    revisedPrompt?: string;
  };
  warnings?: unknown;
};

type OpenAIImageGenerationToolResult = {
  result?: string;
};

type WeatherForecastDay = {
  date?: string;
  tempMax?: number;
  tempMin?: number;
  conditionCode?: number;
  condition?: string;
  precipitationProbability?: number;
  isDay?: boolean;
};

type WeatherToolResult = {
  id?: string;
  widget?: WeatherWidgetPayload;
  location?: {
    name?: string;
    resolvedName?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
  unit?: "celsius" | "fahrenheit";
  temperature?: number;
  temperatureUnit?: string;
  apparentTemperature?: number;
  humidity?: number;
  humidityUnit?: string;
  windSpeed?: number;
  windSpeedUnit?: string;
  precipitation?: number;
  precipitationUnit?: string;
  visibility?: number;
  visibilityUnit?: string;
  conditionCode?: number;
  condition?: string;
  isDay?: boolean;
  localTimeOfDay?: number;
  forecast?: WeatherForecastDay[];
  updatedAt?: string;
  source?: {
    name?: string;
    url?: string;
  };
};

type SearchToolResultItem = {
  title: string;
  url: string;
  snippet?: string;
  date?: string;
};

type SearchToolResultData = {
  answer?: string;
  results: SearchToolResultItem[];
};

type TavilyResearchToolResult = {
  answer?: string;
  results?: unknown[];
  sources?: unknown[];
  citations?: unknown[];
  data?: unknown[];
  pages?: unknown[];
  urls?: unknown[];
  resultsMap?: unknown;
  map?: unknown;
};

type StudioSkillToolResultItem = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tab?: string;
  frontstagePriority?: string;
  activationHint?: string;
  preferredSkills?: string[];
  clarifyChecklist?: string[];
  executionOutline?: string[];
  executionRecipe?: string[];
  outputBlueprint?: string[];
  toolPolicy?: string;
  examplePrompt?: string;
  tags?: string[];
};

type StudioSkillsToolResult = {
  matches?: StudioSkillToolResultItem[];
  totalAvailable?: number;
  guidance?: string;
};

type StudioWorkflowPlanStep = {
  title?: string;
  goal?: string;
  createImagePromptBrief?: string;
};

type StudioWorkflowDeliverable = {
  index?: number;
  title?: string;
  role?: string;
  promptBrief?: string;
  mustPreserve?: string[];
};

type StudioWorkflowPlanResult = {
  workflowId?: string;
  workflowName?: string;
  workflowType?: string;
  request?: string;
  referenceImageCount?: number;
  imageCount?: number;
  productTruthChecklist?: string[];
  deliverables?: StudioWorkflowDeliverable[];
  plan?: StudioWorkflowPlanStep[];
  executionOrder?: string[];
  createImageGuidance?: {
    useSeparateImages?: boolean;
    count?: number;
    passReferenceImages?: boolean;
    recommendedInput?: {
      count?: number;
      images?: string;
      promptStrategy?: string;
      negativeInstruction?: string;
    };
  };
  guidance?: string;
};

type WorkspaceKnowledgeToolResultItem = {
  source: "studio-assets" | "studio-skills" | "knowledge";
  path: string;
  title: string;
  excerpt: string;
  score: number;
};

type WorkspaceKnowledgeToolResult = {
  matches?: WorkspaceKnowledgeToolResultItem[];
  totalAvailable?: number;
  guidance?: string;
};

const searchToolResultItemSchema = z
  .object({
    title: z.string().optional(),
    name: z.string().optional(),
    url: z.string().optional(),
    link: z.string().optional(),
    snippet: z.string().optional(),
    summary: z.string().optional(),
    text: z.string().optional(),
    content: z.string().optional(),
    highlights: z.array(z.string()).optional(),
    publishedDate: z.string().optional(),
    date: z.string().optional(),
    last_updated: z.string().optional(),
    lastUpdated: z.string().optional(),
  })
  .passthrough();

const searchToolResultSchema = z
  .object({
    answer: z.string().optional(),
    results: z.array(searchToolResultItemSchema).optional(),
    sources: z.array(searchToolResultItemSchema).optional(),
    citations: z.array(searchToolResultItemSchema).optional(),
  })
  .passthrough();

const tavilyResearchToolResultSchema = z
  .object({
    answer: z.string().optional(),
    results: z.array(z.unknown()).optional(),
    sources: z.array(z.unknown()).optional(),
    citations: z.array(z.unknown()).optional(),
    data: z.array(z.unknown()).optional(),
    pages: z.array(z.unknown()).optional(),
    urls: z.array(z.unknown()).optional(),
    resultsMap: z.unknown().optional(),
    map: z.unknown().optional(),
  })
  .passthrough();


const studioSkillToolResultItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    category: z.string().optional(),
    tab: z.string().optional(),
    frontstagePriority: z.string().optional(),
    activationHint: z.string().optional(),
    preferredSkills: z.array(z.string()).optional(),
    clarifyChecklist: z.array(z.string()).optional(),
    executionOutline: z.array(z.string()).optional(),
    executionRecipe: z.array(z.string()).optional(),
    outputBlueprint: z.array(z.string()).optional(),
    toolPolicy: z.string().optional(),
    examplePrompt: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

const studioSkillsToolResultSchema = z
  .object({
    matches: z.array(studioSkillToolResultItemSchema).optional(),
    totalAvailable: z.number().optional(),
    guidance: z.string().optional(),
  })
  .passthrough();

const studioWorkflowPlanStepSchema = z
  .object({
    title: z.string().optional(),
    goal: z.string().optional(),
    createImagePromptBrief: z.string().optional(),
  })
  .passthrough();

const studioWorkflowDeliverableSchema = z
  .object({
    index: z.number().optional(),
    title: z.string().optional(),
    role: z.string().optional(),
    promptBrief: z.string().optional(),
    mustPreserve: z.array(z.string()).optional(),
  })
  .passthrough();

const studioWorkflowPlanResultSchema = z
  .object({
    workflowId: z.string().optional(),
    workflowName: z.string().optional(),
    workflowType: z.string().optional(),
    request: z.string().optional(),
    referenceImageCount: z.number().optional(),
    imageCount: z.number().optional(),
    productTruthChecklist: z.array(z.string()).optional(),
    deliverables: z.array(studioWorkflowDeliverableSchema).optional(),
    plan: z.array(studioWorkflowPlanStepSchema).optional(),
    executionOrder: z.array(z.string()).optional(),
    createImageGuidance: z
      .object({
        useSeparateImages: z.boolean().optional(),
        count: z.number().optional(),
        passReferenceImages: z.boolean().optional(),
        recommendedInput: z
          .object({
            count: z.number().optional(),
            images: z.string().optional(),
            promptStrategy: z.string().optional(),
            negativeInstruction: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    guidance: z.string().optional(),
  })
  .passthrough();

const workspaceKnowledgeToolResultItemSchema = z
  .object({
    source: z.enum(["studio-assets", "studio-skills", "knowledge"]),
    path: z.string().min(1),
    title: z.string().min(1),
    excerpt: z.string(),
    score: z.number(),
  })
  .passthrough();

const workspaceKnowledgeToolResultSchema = z
  .object({
    matches: z.array(workspaceKnowledgeToolResultItemSchema).optional(),
    totalAvailable: z.number().optional(),
    guidance: z.string().optional(),
  })
  .passthrough();

const weatherConditionCodeSchema = z.enum([
  "clear",
  "partly-cloudy",
  "cloudy",
  "overcast",
  "fog",
  "drizzle",
  "rain",
  "heavy-rain",
  "thunderstorm",
  "snow",
  "sleet",
  "hail",
  "windy",
]);

const weatherWidgetPayloadSchema = z
  .object({
    version: z.literal("3.1"),
    id: z.string().min(1),
    location: z.object({ name: z.string().min(1) }).passthrough(),
    units: z
      .object({
        temperature: z.enum(["celsius", "fahrenheit"]),
      })
      .passthrough(),
    current: z
      .object({
        conditionCode: weatherConditionCodeSchema,
        temperature: z.number(),
        tempMin: z.number(),
        tempMax: z.number(),
        windSpeed: z.number().optional(),
        precipitationLevel: z
          .enum(["none", "light", "moderate", "heavy"])
          .optional(),
        visibility: z.number().optional(),
      })
      .passthrough(),
    forecast: z.array(
      z
        .object({
          label: z.string(),
          conditionCode: weatherConditionCodeSchema,
          tempMin: z.number(),
          tempMax: z.number(),
        })
        .passthrough(),
    ),
    time: z
      .object({
        timeBucket: z.number().int().min(0).max(11).optional(),
        localTimeOfDay: z.number().optional(),
      })
      .passthrough(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

const weatherToolResultSchema = z
  .object({
    id: z.string().optional(),
    widget: weatherWidgetPayloadSchema.optional(),
    location: z
      .object({
        name: z.string().optional(),
        resolvedName: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        timezone: z.string().optional(),
      })
      .passthrough()
      .optional(),
    unit: z.enum(["celsius", "fahrenheit"]).optional(),
    temperature: z.number().optional(),
    temperatureUnit: z.string().optional(),
    apparentTemperature: z.number().optional(),
    humidity: z.number().optional(),
    humidityUnit: z.string().optional(),
    windSpeed: z.number().optional(),
    windSpeedUnit: z.string().optional(),
    precipitation: z.number().optional(),
    precipitationUnit: z.string().optional(),
    visibility: z.number().optional(),
    visibilityUnit: z.string().optional(),
    conditionCode: z.number().optional(),
    condition: z.string().optional(),
    isDay: z.boolean().optional(),
    localTimeOfDay: z.number().optional(),
    forecast: z.array(z.unknown()).optional(),
    updatedAt: z.string().optional(),
    source: z
      .object({
        name: z.string().optional(),
        url: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const generatedImagePartSchema = z
  .object({
    type: z.literal("image").optional(),
    image: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
    filename: z.string().optional(),
    mediaType: z.string().optional(),
    data: z.string().optional(),
  })
  .passthrough()
  .refine(
    (value) =>
      Boolean(
        pickNonEmptyString(value.image, value.url) ||
          (pickNonEmptyString(value.data) &&
            pickNonEmptyString(value.mediaType).startsWith("image/")),
      ),
    "Generated image results must include image, url, or image data with mediaType.",
  );

const generateImageToolResultSchema = z
  .object({
    providerId: z.string().optional(),
    providerName: z.string().optional(),
    modelId: z.string().optional(),
    prompt: z.string().optional(),
    referenceCount: z.number().optional(),
    size: z.string().optional(),
    aspectRatio: z.string().optional(),
    resolution: z.string().optional(),
    count: z.number().optional(),
    settingsLocked: z.boolean().optional(),
    operation: z.string().optional(),
    images: z.array(generatedImagePartSchema).optional(),
    metadata: z
      .object({
        revisedPrompt: z.string().optional(),
      })
      .passthrough()
      .optional(),
    warnings: z.unknown().optional(),
  })
  .passthrough();

const openAIImageGenerationToolResultSchema = z
  .object({
    result: z.string().min(1).optional(),
  })
  .passthrough();

const createTargetElementToolResultSchema = z
  .object({
    ok: z.boolean().optional(),
    elementId: z.string().nullable().optional(),
    prompt: z.string().optional(),
    referenceCount: z.number().optional(),
    error: z.string().optional(),
  })
  .passthrough();

const TOOL_CARD_CLASS_NAME =
  "my-2 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/90";

const TOOL_CARD_SECTION_LABEL_CLASS_NAME =
  "text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500";

const TOOL_CARD_PRE_CLASS_NAME =
  "mt-1 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs whitespace-pre-wrap text-slate-700 dark:bg-slate-950/80 dark:text-slate-200";

const getWeatherEmoji = (conditionCode?: string): string => {
  switch (conditionCode) {
    case "clear":
      return "☀️";
    case "partly-cloudy":
      return "⛅";
    case "cloudy":
      return "☁️";
    case "overcast":
      return "☁️";
    case "fog":
      return "🌫️";
    case "drizzle":
      return "🌦️";
    case "rain":
      return "🌧️";
    case "heavy-rain":
      return "⛈️";
    case "thunderstorm":
      return "⛈️";
    case "snow":
      return "❄️";
    case "sleet":
      return "🌨️";
    case "hail":
      return "🌨️";
    case "windy":
      return "💨";
    default:
      return "🌤️";
  }
};

const formatToolDuration = (ms: number) => {
  if (ms < 1000) return "<1s";
  const seconds = ms / 1000;
  if (seconds < 10) return `${(Math.floor(seconds * 10) / 10).toFixed(1)}s`;
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
};

const ToolDurationMeta: React.FC = () => {
  const elapsedMs = useToolCallElapsed();
  if (elapsedMs === undefined) return null;

  return (
    <span className="text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
      {formatToolDuration(elapsedMs)}
    </span>
  );
};

const getToolStatusMeta = (
  status: { type: string; reason?: string },
  completeClassName: string,
) => {
  const isRunning = status.type === "running";
  const isError = status.type === "incomplete" && status.reason === "error";

  return {
    isRunning,
    isError,
    badgeClassName: isRunning
      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
      : isError
        ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
        : completeClassName,
    badgeLabel: isRunning ? "运行中" : isError ? "出错" : "完成",
  };
};

const pickNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return "";
};

const truncateToolText = (value: string, maxLength = 220): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
};

const normalizeSearchToolResultDate = (...values: unknown[]): string | undefined => {
  const raw = pickNonEmptyString(...values);
  if (!raw) return undefined;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(parsed);
  } catch {
    return raw;
  }
};

const extractSearchToolResultItems = (value: unknown): SearchToolResultItem[] => {
  const seen = new Set<string>();
  const items: SearchToolResultItem[] = [];

  const visit = (entry: unknown, depth = 0) => {
    if (depth > 5 || !entry) return;

    if (typeof entry === "string") {
      const url = entry.trim();
      if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
      seen.add(url);
      items.push({ title: url, url });
      return;
    }

    if (Array.isArray(entry)) {
      for (const item of entry) visit(item, depth + 1);
      return;
    }

    if (typeof entry !== "object") return;
    const record = entry as Record<string, unknown>;
    const url = pickNonEmptyString(record.url, record.link);
    if (url && !seen.has(url)) {
      const title = pickNonEmptyString(record.title, record.name, url);
      const snippet = pickNonEmptyString(
        record.snippet,
        record.summary,
        record.text,
        Array.isArray(record.highlights)
          ? (record.highlights as unknown[])
              .filter((item): item is string => typeof item === "string")
              .join(" ")
          : "",
        record.content,
      );
      const date = normalizeSearchToolResultDate(
        record.publishedDate,
        record.date,
        record.last_updated,
        record.lastUpdated,
      );

      seen.add(url);
      items.push({
        title,
        url,
        ...(snippet ? { snippet: truncateToolText(snippet) } : {}),
        ...(date ? { date } : {}),
      });
    }

    for (const key of [
      "results",
      "sources",
      "citations",
      "data",
      "pages",
      "urls",
      "items",
      "documents",
      "subpages",
    ]) {
      visit(record[key], depth + 1);
    }

    if (record.extras && typeof record.extras === "object") {
      const extras = record.extras as Record<string, unknown>;
      visit(extras.links, depth + 1);
    }

    for (const key of ["resultsMap", "map"]) {
      const nested = record[key];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        visit(Object.values(nested as Record<string, unknown>), depth + 1);
      }
    }
  };

  visit(value);

  return items.slice(0, 6);
};

const normalizeSearchToolResult = (result: unknown): SearchToolResultData => {
  if (!result || typeof result !== "object") {
    return { results: [] };
  }

  const record = result as Record<string, unknown>;
  const results = [
    ...extractSearchToolResultItems(record.results),
    ...extractSearchToolResultItems(record.sources),
    ...extractSearchToolResultItems(record.citations),
  ].filter(
    (item, index, array) =>
      array.findIndex((candidate) => candidate.url === item.url) === index,
  );

  return {
    answer: pickNonEmptyString(record.answer),
    results,
  };
};

const extractTavilyResearchItems = (
  result: TavilyResearchToolResult | undefined,
): SearchToolResultItem[] => {
  if (!result) return [];

  const candidates = [
    result.results,
    result.sources,
    result.citations,
    result.data,
    result.pages,
    result.urls,
  ].flatMap((value) => (Array.isArray(value) ? value : []));

  return extractSearchToolResultItems(candidates).slice(0, 6);
};

const getTavilyResearchCount = (
  result: TavilyResearchToolResult | undefined,
): number => {
  if (!result) return 0;

  for (const value of [
    result.results,
    result.sources,
    result.citations,
    result.data,
    result.pages,
    result.urls,
  ]) {
    if (Array.isArray(value) && value.length > 0) return value.length;
  }

  return 0;
};

const formatNumber = (value: unknown, fractionDigits = 0): string => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "--";
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: fractionDigits,
  }).format(numeric);
};

const getNestedToolArgs = (args: Record<string, unknown>) => {
  const nested =
    args.parameters && typeof args.parameters === "object"
      ? (args.parameters as Record<string, unknown>)
      : {};

  return nested;
};

const toFiniteNumber = (value: unknown): number | undefined => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const getToolArgString = (
  args: Record<string, unknown>,
  ...keys: string[]
): string => {
  const nested = getNestedToolArgs(args);
  return pickNonEmptyString(
    ...keys.map((key) => args[key]),
    ...keys.map((key) => nested[key]),
  );
};

const renderToolTextSection = (
  label: string,
  text: string,
  preformatted = false,
) => {
  const normalized = String(text || "").trim();
  if (!normalized) return null;

  return (
    <div className="mt-3">
      <div className={TOOL_CARD_SECTION_LABEL_CLASS_NAME}>{label}</div>
      {preformatted ? (
        <pre className={TOOL_CARD_PRE_CLASS_NAME}>{normalized}</pre>
      ) : (
        <div className="mt-1 text-sm leading-6 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
          {normalized}
        </div>
      )}
    </div>
  );
};

const getGenerateImageResultImages = (
  result: GenerateImageToolResult | undefined,
): GenerateImageToolResultImage[] => {
  const images = Array.isArray(result?.images) ? result.images : [];
  return images.flatMap((image) => {
    if (!image || typeof image !== "object") return [];
    const mediaType = pickNonEmptyString(image.mediaType);
    const resolvedImage =
      pickNonEmptyString(image.image, image.url) ||
      (mediaType.startsWith("image/") && pickNonEmptyString(image.data)
        ? `data:${mediaType};base64,${pickNonEmptyString(image.data)}`
        : "");
    if (!resolvedImage) return [];
    return [
      {
        ...image,
        type: "image" as const,
        image: resolvedImage,
        ...(mediaType ? { mediaType } : {}),
      },
    ];
  });
};

const normalizeOpenAIImageGenerationResultImage = (
  result: OpenAIImageGenerationToolResult | undefined,
): GenerateImageToolResultImage[] => {
  const rawImage = pickNonEmptyString(result?.result);
  if (!rawImage) return [];

  const image = rawImage.startsWith("data:")
    ? rawImage
    : `data:image/png;base64,${rawImage}`;

  return [
    {
      type: "image",
      image,
      filename: "openai-image-generation.png",
      mediaType: "image/png",
    },
  ];
};

const getGenerateImageWarningMessages = (warnings: unknown): string[] => {
  if (!Array.isArray(warnings)) return [];

  const messages = warnings
    .flatMap((warning) => {
      if (typeof warning === "string") {
        return warning.trim() ? [warning.trim()] : [];
      }
      if (!warning || typeof warning !== "object") return [];

      const record = warning as Record<string, unknown>;
      const directMessage = pickNonEmptyString(
        record.message,
        record.text,
        record.details,
      );
      if (directMessage) return [directMessage];

      const composite = [
        pickNonEmptyString(record.type),
        pickNonEmptyString(record.setting),
        pickNonEmptyString(record.detail),
      ]
        .filter(Boolean)
        .join(" · ");
      return composite ? [composite] : [];
    })
    .filter(Boolean);

  return messages.filter(
    (message, index, array) => array.indexOf(message) === index,
  );
};

const getAspectRatioClassName = (aspectRatio: string): string => {
  switch (aspectRatio) {
    case "16:9":
      return "aspect-[16/9]";
    case "9:16":
      return "aspect-[9/16]";
    case "4:3":
      return "aspect-[4/3]";
    case "3:4":
      return "aspect-[3/4]";
    case "1:1":
    default:
      return "aspect-square";
  }
};

type GenerateImageGalleryItem = {
  id: string;
  title: string;
  caption?: string;
  part: GenerateImageToolResultImage;
};

const toGenerateImageGalleryItems = (
  imageParts: GenerateImageToolResultImage[],
): GenerateImageGalleryItem[] =>
  imageParts.map((part, index) => ({
    id: `${part.filename || "generated-image"}-${index}-${part.image.slice(0, 48)}`,
    title: part.filename || `生成图片 ${index + 1}`,
    caption: part.mediaType,
    part,
  }));

const GenerateImageGallery: React.FC<{
  items: GenerateImageGalleryItem[];
  aspectRatioClassName: string;
}> = ({ items, aspectRatioClassName }) => {
  if (items.length === 0) return null;

  return (
    <div
      data-slot="tool-ui-image-gallery"
      className={`grid gap-2 ${items.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
    >
      {items.map((item) => (
        <figure
          key={item.id}
          className="group min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900/70"
        >
          <AssistantImage.Root
            variant="ghost"
            size="full"
            className="border-0 bg-transparent"
          >
            <AssistantImage.Zoom
              src={item.part.image}
              alt={item.title}
            >
              <AssistantImage.Preview
                src={item.part.image}
                alt={item.title}
                containerClassName={aspectRatioClassName}
                className="h-full w-full object-cover"
              />
            </AssistantImage.Zoom>
            <div className="flex items-center justify-between gap-2 px-2 py-1">
              <AssistantImage.Filename className="min-w-0 px-0 py-0">
                {item.title}
              </AssistantImage.Filename>
              <AssistantImage.Actions
                part={item.part}
                className="shrink-0 p-0 opacity-80 transition-opacity group-hover:opacity-100"
              />
            </div>
          </AssistantImage.Root>
          {item.caption ? (
            <figcaption className="sr-only">{item.caption}</figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
};

const isStreamingToolArg = <TArgs extends Record<string, unknown>>(
  propStatus: Partial<Record<keyof TArgs, "streaming" | "complete">>,
  key: keyof TArgs,
): boolean => propStatus[key] === "streaming";

const getImageToolRunningPhase = (options: {
  propStatus: Partial<
    Record<keyof AssistantSidebarCreateImageArgs, "streaming" | "complete">
  >;
  providerLabel: string;
  modelLabel: string;
  requestedCount: number;
  requestedAspectRatio: string;
  referenceCount: number;
  promptReady: boolean;
}): {
  title: string;
  description: string;
} => {
  const { propStatus } = options;
  const promptStreaming =
    isStreamingToolArg(propStatus, "prompt") ||
    isStreamingToolArg(propStatus, "text");
  const referenceStreaming =
    isStreamingToolArg(propStatus, "images") ||
    isStreamingToolArg(propStatus, "referenceImages") ||
    isStreamingToolArg(propStatus, "mask") ||
    isStreamingToolArg(propStatus, "maskImage");
  const settingsStreaming =
    isStreamingToolArg(propStatus, "aspectRatio") ||
    isStreamingToolArg(propStatus, "size") ||
    isStreamingToolArg(propStatus, "count");

  if (promptStreaming && !options.promptReady) {
    return {
      title: "正在准备提示词",
      description:
        "模型正在整理最终生图指令，完成后才会发送给图片供应商。",
    };
  }

  if (referenceStreaming && !options.promptReady) {
    return {
      title: "正在准备参考图",
      description:
        "正在附加参考图和蒙版输入，准备发送图片请求。",
    };
  }

  if (settingsStreaming && !options.promptReady) {
    return {
      title: "正在确认图片设置",
      description:
        "正在锁定比例、尺寸和张数等输出设置。",
    };
  }

  const providerSummary = [options.providerLabel, options.modelLabel]
    .filter(Boolean)
    .join(" · ");
  const generationTarget = `${options.requestedCount} 张图片`;
  const ratioSuffix = options.requestedAspectRatio
    ? `，比例 ${options.requestedAspectRatio}`
    : "";
  const referenceSuffix =
    options.referenceCount > 0
      ? `，参考图 ${options.referenceCount} 张`
      : "";

  return {
    title: "等待图片供应商",
    description: providerSummary
      ? `${providerSummary} 正在生成 ${generationTarget}${ratioSuffix}${referenceSuffix}。`
      : `图片供应商正在生成 ${generationTarget}${ratioSuffix}${referenceSuffix}。`,
  };
};

const WEATHER_CARD_FRAME_CLASS_NAME =
  "my-2 flex w-full max-w-[26.5rem] flex-col gap-1.5";

const WEATHER_EFFECTS = {
  quality: "medium" as const,
};

const WeatherWidgetHost: React.FC<{ widget: WeatherWidgetPayload }> = React.memo(
  ({ widget }) => {
    const stableWidgetRef = React.useRef(widget);

    if (stableWidgetRef.current.id !== widget.id) {
      stableWidgetRef.current = widget;
    }

    return (
      <div
        className="w-full max-w-[26.5rem] shrink-0 overflow-hidden rounded-2xl"
        style={{
          aspectRatio: "4 / 3",
          contain: "layout",
        }}
      >
        <WeatherWidget
          {...stableWidgetRef.current}
          effects={WEATHER_EFFECTS}
          className="h-full w-full max-w-none"
        />
      </div>
    );
  },
  (previousProps, nextProps) => previousProps.widget.id === nextProps.widget.id,
);

WeatherWidgetHost.displayName = "WeatherWidgetHost";

const WeatherToolLoadingCard: React.FC<{ requestedLocation?: string }> = ({
  requestedLocation,
}) => {
  return (
    <div className={WEATHER_CARD_FRAME_CLASS_NAME}>
      <div className="flex items-center gap-3">
        <div className="size-12 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
        <div className="min-w-0 flex-1">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-2 h-3 w-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          {requestedLocation ? (
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              正在查询 {requestedLocation}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const WeatherToolResultCard: React.FC<{
  result: WeatherToolResult;
  requestedLocation: string;
}> = ({ result, requestedLocation }) => {
  if (!result.widget) return null;

  const requestedName = pickNonEmptyString(
    requestedLocation,
    result.location?.name,
  );
  const resolvedName = pickNonEmptyString(
    result.location?.resolvedName,
    result.location?.name,
  );
  const shouldShowResolvedNote =
    Boolean(requestedName) &&
    Boolean(resolvedName) &&
    resolvedName.toLowerCase() !== requestedName.toLowerCase();

  return (
    <div className={WEATHER_CARD_FRAME_CLASS_NAME}>
      <WeatherWidgetHost widget={result.widget} />
      {shouldShowResolvedNote ? (
        <div className="px-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          已匹配附近天气站：{resolvedName}
        </div>
      ) : null}
    </div>
  );
};

export const WorkspaceSearchToolUI: ToolCallMessagePartComponent<
  Record<string, unknown>,
  SearchToolResultData | Record<string, unknown>
> = ({
  args,
  result,
  status,
  addResult,
  resume,
  approval,
  respondToApproval,
  interrupt,
}) => {
  const query = getToolArgString(args, "query", "q");
  const isRunning = status.type === "running";
  const isError = status.type === "incomplete" && status.reason === "error";
  const parsedResult = searchToolResultSchema.safeParse(result);
  const normalizedResult = normalizeSearchToolResult(
    parsedResult.success ? parsedResult.data : undefined,
  );
  const { badgeClassName, badgeLabel } = getToolStatusMeta(
    status,
    "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  );

  return (
    <div className={TOOL_CARD_CLASS_NAME}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            联网搜索
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isRunning
              ? "正在搜索网页"
              : isError
                ? "联网搜索失败"
                : normalizedResult.results.length > 0
                  ? `找到 ${normalizedResult.results.length} 个来源`
                  : "来源会显示在助手回复下方。"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToolDurationMeta />
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badgeClassName}`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>

      {query ? renderToolTextSection("查询", query, false) : null}
      {normalizedResult.answer ? (
        <div className="mt-3 rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 py-2 text-sm leading-6 text-slate-700 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-slate-200">
          {normalizedResult.answer}
        </div>
      ) : null}
      {status.type === "requires-action" ? (
        <ToolFallback.Approval
          className="mt-3"
          resume={resume}
          approval={approval}
          respondToApproval={respondToApproval}
          interrupt={interrupt}
        />
      ) : null}
    </div>
  );
};

const TavilyResearchToolUI: ToolCallMessagePartComponent<
  Record<string, unknown>,
  TavilyResearchToolResult | Record<string, unknown>
> = ({ toolName, args, result, status }) => {
  const parsedResult = tavilyResearchToolResultSchema.safeParse(result);
  const toolResult = parsedResult.success
    ? (parsedResult.data as TavilyResearchToolResult)
    : undefined;
  const isRunning = status.type === "running";
  const isError = status.type === "incomplete" && status.reason === "error";
  const url = getToolArgString(args, "url");
  const urls = Array.isArray(args.urls)
    ? args.urls
        .filter((item): item is string => typeof item === "string")
        .slice(0, 4)
    : [];
  const query = getToolArgString(args, "query", "instructions");
  const resultItems = extractTavilyResearchItems(toolResult);
  const resultCount = getTavilyResearchCount(toolResult);
  const toolMeta =
    toolName === "tavilyExtract"
      ? {
          title: "Tavily 网页抽取",
          running: "正在抽取网页内容",
          complete: resultCount > 0 ? `抽取到 ${resultCount} 条内容` : "网页抽取完成",
        }
      : toolName === "tavilyCrawl"
        ? {
            title: "Tavily 网站爬取",
            running: "正在爬取网站页面",
            complete: resultCount > 0 ? `爬取到 ${resultCount} 个页面` : "网站爬取完成",
          }
        : {
            title: "Tavily 站点地图",
            running: "正在映射站点结构",
            complete: resultCount > 0 ? `映射到 ${resultCount} 个页面` : "站点地图完成",
          };
  const { badgeClassName, badgeLabel } = getToolStatusMeta(
    status,
    "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200",
  );

  return (
    <div className={TOOL_CARD_CLASS_NAME}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {toolMeta.title}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isRunning
              ? toolMeta.running
              : isError
                ? "Tavily 工具调用失败"
                : toolMeta.complete}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToolDurationMeta />
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badgeClassName}`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>

      {url ? renderToolTextSection("URL", url, false) : null}
      {urls.length > 0
        ? renderToolTextSection("URLs", urls.join("\n"), true)
        : null}
      {query ? renderToolTextSection("指令", query, false) : null}
      {resultItems.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {resultItems.map((item) => (
            <div
              key={item.url}
              className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-950/60"
            >
              <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {item.title}
              </div>
              <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {item.url}
              </div>
              {item.snippet ? (
                <div className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  {item.snippet}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const TavilyExtractToolUI = TavilyResearchToolUI;
export const TavilyCrawlToolUI = TavilyResearchToolUI;
export const TavilyMapToolUI = TavilyResearchToolUI;

export const NativeWebSearchToolUI: ToolCallMessagePartComponent<
  Record<string, unknown>,
  unknown
> = ({ toolName, args, status }) => {
  const isRunning = status.type === "running";
  const isError = status.type === "incomplete" && status.reason === "error";
  const query = getToolArgString(args, "query", "search_query", "q");
  const providerLabel =
    toolName === "google_search"
      ? "Google Search 联网"
      : "供应商原生联网";
  const { badgeClassName, badgeLabel } = getToolStatusMeta(
    status,
    "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200",
  );

  return (
    <div className={TOOL_CARD_CLASS_NAME}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {providerLabel}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isRunning
              ? "正在使用供应商原生联网"
              : isError
                ? "供应商原生联网失败"
                : "来源会显示在助手回复下方。"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToolDurationMeta />
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badgeClassName}`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>
      {query ? renderToolTextSection("查询", query, false) : null}
    </div>
  );
};

export const ListStudioSkillsToolUI: ToolCallMessagePartComponent<
  Record<string, unknown>,
  StudioSkillsToolResult
> = ({ args, result, status, addResult, resume, approval, respondToApproval, interrupt }) => {
  const parsedResult = studioSkillsToolResultSchema.safeParse(result);
  const toolResult = parsedResult.success
    ? (parsedResult.data as StudioSkillsToolResult)
    : undefined;
  const query = getToolArgString(args, "query");
  const tab = getToolArgString(args, "tab");
  const matches = Array.isArray(toolResult?.matches) ? toolResult.matches : [];
  const { isRunning, isError, badgeClassName, badgeLabel } = getToolStatusMeta(
    status,
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200",
  );

  return (
    <div className={TOOL_CARD_CLASS_NAME}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Studio Skills
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isRunning
              ? "正在匹配适合的工作流"
              : isError
                ? "工作流匹配失败"
                : matches.length > 0
                  ? `匹配到 ${matches.length} 个工作流建议`
                  : "没有匹配到明确的工作流"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToolDurationMeta />
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badgeClassName}`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>

      {query ? renderToolTextSection("需求", query, false) : null}
      {tab ? renderToolTextSection("区域", tab, false) : null}

      {matches.length > 0 ? (
        <div className="mt-3 space-y-2">
          {matches.map((skill) => {
            const recipe = Array.isArray(skill.executionRecipe)
              ? skill.executionRecipe.slice(0, 3)
              : [];
            const preferredSkills = Array.isArray(skill.preferredSkills)
              ? skill.preferredSkills.slice(0, 5)
              : [];
            return (
              <div
                key={skill.id}
                className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-950/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {skill.name}
                    </div>
                    {skill.description ? (
                      <div className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                        {skill.description}
                      </div>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
                    {skill.tab || skill.category || skill.id}
                  </span>
                </div>
                {preferredSkills.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {preferredSkills.map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : null}
                {recipe.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    {recipe.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {toolResult?.guidance
        ? renderToolTextSection("执行原则", toolResult.guidance, false)
        : null}
      {status.type === "requires-action" ? (
        <ToolFallback.Approval
          className="mt-3"
          resume={resume}
          approval={approval}
          respondToApproval={respondToApproval}
          interrupt={interrupt}
        />
      ) : null}
    </div>
  );
};

export const PlanStudioWorkflowToolUI: ToolCallMessagePartComponent<
  Record<string, unknown>,
  StudioWorkflowPlanResult
> = ({ args, result, status, addResult, resume, approval, respondToApproval, interrupt }) => {
  const parsedResult = studioWorkflowPlanResultSchema.safeParse(result);
  const toolResult = parsedResult.success
    ? (parsedResult.data as StudioWorkflowPlanResult)
    : undefined;
  const request = pickNonEmptyString(
    toolResult?.request,
    getToolArgString(args, "request"),
  );
  const workflowName = pickNonEmptyString(
    toolResult?.workflowName,
    toolResult?.workflowId,
    getToolArgString(args, "workflowId"),
  );
  const workflowType = pickNonEmptyString(toolResult?.workflowType);
  const deliverables = Array.isArray(toolResult?.deliverables)
    ? toolResult.deliverables
    : [];
  const plan =
    deliverables.length > 0
      ? deliverables.map((deliverable, index) => ({
          title: deliverable.title || `画面 ${deliverable.index || index + 1}`,
          goal: deliverable.role,
          createImagePromptBrief: deliverable.promptBrief,
          mustPreserve: deliverable.mustPreserve,
        }))
      : Array.isArray(toolResult?.plan)
        ? toolResult.plan
        : [];
  const checklist = Array.isArray(toolResult?.productTruthChecklist)
    ? toolResult.productTruthChecklist.slice(0, 6)
    : [];
  const executionOrder = Array.isArray(toolResult?.executionOrder)
    ? toolResult.executionOrder.slice(0, 6)
    : [];
  const imageCount = Math.max(
    0,
    Math.floor(toFiniteNumber(toolResult?.imageCount) ?? 0),
  );
  const referenceImageCount = Math.max(
    0,
    Math.floor(toFiniteNumber(toolResult?.referenceImageCount) ?? 0),
  );
  const guidanceCount = Math.max(
    0,
    Math.floor(toFiniteNumber(toolResult?.createImageGuidance?.count) ?? 0),
  );
  const recommendedInput = toolResult?.createImageGuidance?.recommendedInput;
  const recommendedInputItems = [
    toFiniteNumber(recommendedInput?.count)
      ? { label: "count", value: String(Math.floor(toFiniteNumber(recommendedInput?.count) ?? 0)) }
      : null,
    recommendedInput?.images
      ? { label: "images", value: recommendedInput.images }
      : null,
  ].filter(
    (item): item is { label: string; value: string } =>
      Boolean(item?.label && item?.value),
  );
  const { isRunning, isError, badgeClassName, badgeLabel } = getToolStatusMeta(
    status,
    "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-200",
  );

  return (
    <div className={TOOL_CARD_CLASS_NAME}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Studio 工作流规划
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isRunning
              ? "正在规划产品约束和多图分镜"
              : isError
                ? "工作流规划失败"
                : plan.length > 0
                  ? `已规划 ${plan.length} 个独立画面`
                  : "已生成工作流规划"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToolDurationMeta />
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badgeClassName}`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>

      {request ? renderToolTextSection("需求", request, false) : null}
      {workflowName ? renderToolTextSection("工作流", workflowName, false) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {workflowType ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-700/50 dark:text-slate-200">
            {workflowType}
          </span>
        ) : null}
        {imageCount > 0 ? (
          <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-medium text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-200">
            {imageCount} 张独立图片
          </span>
        ) : null}
        {referenceImageCount > 0 ? (
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">
            {referenceImageCount} 张参考图
          </span>
        ) : null}
        {toolResult?.createImageGuidance?.useSeparateImages ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
            separate images
          </span>
        ) : null}
        {toolResult?.createImageGuidance?.passReferenceImages ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
            保持产品参考
          </span>
        ) : null}
      </div>

      {checklist.length > 0 ? (
        <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-950/50">
          <div className={TOOL_CARD_SECTION_LABEL_CLASS_NAME}>
            产品事实锁定
          </div>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {plan.map((step, index) => (
            <div
              key={`${step.title || "step"}-${index}`}
              className="rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-700/80 dark:bg-slate-900/70"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-slate-100 dark:text-slate-950">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {step.title || `画面 ${index + 1}`}
                  </div>
                  {step.goal ? (
                    <div className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {step.goal}
                    </div>
                  ) : null}
                  {step.createImagePromptBrief ? (
                    <div className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] leading-5 text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
                      {step.createImagePromptBrief}
                    </div>
                  ) : null}
                  {Array.isArray((step as StudioWorkflowPlanStep & { mustPreserve?: string[] }).mustPreserve) &&
                  (step as StudioWorkflowPlanStep & { mustPreserve?: string[] }).mustPreserve?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(step as StudioWorkflowPlanStep & { mustPreserve?: string[] }).mustPreserve
                        ?.slice(0, 3)
                        .map((rule) => (
                          <span
                            key={rule}
                            className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
                          >
                            {rule}
                          </span>
                        ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {executionOrder.length > 0 ? (
        <div className="mt-3">
          <div className={TOOL_CARD_SECTION_LABEL_CLASS_NAME}>执行顺序</div>
          <ol className="mt-2 space-y-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {executionOrder.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      ) : null}
      {guidanceCount > 0
        ? renderToolTextSection("createImage 建议张数", String(guidanceCount), false)
        : null}
      {recommendedInputItems.length > 0 ||
      recommendedInput?.promptStrategy ||
      recommendedInput?.negativeInstruction ? (
        <div className="mt-3 rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <div className={TOOL_CARD_SECTION_LABEL_CLASS_NAME}>
            createImage 输入建议
          </div>
          {recommendedInputItems.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recommendedInputItems.map((item) => (
                <span
                  key={`${item.label}:${item.value}`}
                  className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
                >
                  {item.label}: {item.value}
                </span>
              ))}
            </div>
          ) : null}
          {recommendedInput?.promptStrategy ? (
            <div className="mt-2 text-xs leading-5 text-emerald-900 dark:text-emerald-100">
              {recommendedInput.promptStrategy}
            </div>
          ) : null}
          {recommendedInput?.negativeInstruction ? (
            <div className="mt-2 rounded-lg bg-white/80 px-2 py-1.5 text-[11px] leading-5 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
              {recommendedInput.negativeInstruction}
            </div>
          ) : null}
        </div>
      ) : null}
      {toolResult?.guidance
        ? renderToolTextSection("使用原则", toolResult.guidance, false)
        : null}
      {status.type === "requires-action" ? (
        <ToolFallback.Approval
          className="mt-3"
          resume={resume}
          approval={approval}
          respondToApproval={respondToApproval}
          interrupt={interrupt}
        />
      ) : null}
    </div>
  );
};

export const SearchWorkspaceKnowledgeToolUI: ToolCallMessagePartComponent<
  Record<string, unknown>,
  WorkspaceKnowledgeToolResult
> = ({ args, result, status, addResult, resume, approval, respondToApproval, interrupt }) => {
  const parsedResult = workspaceKnowledgeToolResultSchema.safeParse(result);
  const toolResult = parsedResult.success
    ? (parsedResult.data as WorkspaceKnowledgeToolResult)
    : undefined;
  const query = getToolArgString(args, "query");
  const source = getToolArgString(args, "source");
  const matches = Array.isArray(toolResult?.matches) ? toolResult.matches : [];
  const { isRunning, isError, badgeClassName, badgeLabel } = getToolStatusMeta(
    status,
    "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200",
  );

  return (
    <div className={TOOL_CARD_CLASS_NAME}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            本地知识检索
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isRunning
              ? "正在检索项目知识文件"
              : isError
                ? "本地知识检索失败"
                : matches.length > 0
                  ? `找到 ${matches.length} 条相关片段`
                  : "没有找到相关片段"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToolDurationMeta />
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badgeClassName}`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>

      {query ? renderToolTextSection("查询", query, false) : null}
      {source ? renderToolTextSection("来源", source, false) : null}

      {matches.length > 0 ? (
        <div className="mt-3 space-y-2">
          {matches.map((item) => (
            <div
              key={`${item.source}:${item.path}`}
              className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-950/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {item.title}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {item.path}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
                  {item.source}
                </span>
              </div>
              {item.excerpt ? (
                <div className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  {item.excerpt}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {toolResult?.guidance
        ? renderToolTextSection("使用原则", toolResult.guidance, false)
        : null}
      {status.type === "requires-action" ? (
        <ToolFallback.Approval
          className="mt-3"
          resume={resume}
          approval={approval}
          respondToApproval={respondToApproval}
          interrupt={interrupt}
        />
      ) : null}
    </div>
  );
};

export const WeatherToolUI: ToolCallMessagePartComponent<
  Record<string, unknown>,
  WeatherToolResult
> = ({ args, result, status }) => {
  const requestedLocation = getToolArgString(args, "location", "query");
  const parsedResult = weatherToolResultSchema.safeParse(result);
  const toolResult = parsedResult.success
    ? (parsedResult.data as WeatherToolResult)
    : undefined;
  const isRunning = status.type === "running";
  const isError = status.type === "incomplete" && status.reason === "error";
  const resolvedLocation = pickNonEmptyString(
    toolResult?.location?.resolvedName,
    toolResult?.location?.name,
  );
  const temperatureUnit = pickNonEmptyString(toolResult?.temperatureUnit);
  const summarySegments = [
    toFiniteNumber(toolResult?.temperature) !== undefined
      ? `${formatNumber(toolResult?.temperature, 1)}${temperatureUnit || ""}`
      : "",
    pickNonEmptyString(toolResult?.condition),
    toFiniteNumber(toolResult?.windSpeed) !== undefined
      ? `风速 ${formatNumber(toolResult?.windSpeed, 1)} ${pickNonEmptyString(toolResult?.windSpeedUnit)}`
      : "",
  ].filter(Boolean);
  const hasWeatherData =
    summarySegments.length > 0 ||
    Array.isArray(toolResult?.forecast) ||
    Boolean(toolResult?.widget);

  if (toolResult?.widget) {
    return (
      <WeatherToolResultCard
        result={toolResult}
        requestedLocation={requestedLocation}
      />
    );
  }

  if (isRunning) {
    return <WeatherToolLoadingCard requestedLocation={requestedLocation} />;
  }

  if (isError) {
    return (
      <div className={TOOL_CARD_CLASS_NAME}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-rose-700 dark:text-rose-200">
              天气查询失败
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              天气卡片未能生成。
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ToolDurationMeta />
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
              出错
            </span>
          </div>
        </div>
        {requestedLocation
          ? renderToolTextSection("请求位置", requestedLocation, false)
          : null}
      </div>
    );
  }

  if (!isRunning && !hasWeatherData) {
    return (
      <div className={TOOL_CARD_CLASS_NAME}>
        <div className="text-sm font-semibold text-amber-700 dark:text-amber-200">
          天气数据不可用
        </div>
        <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {requestedLocation
            ? `没有查到 ${requestedLocation} 的天气数据，可以试试附近城市或更宽泛的位置。`
            : "没有查到天气数据。"}
        </div>
      </div>
    );
  }

  return (
    <div className={TOOL_CARD_CLASS_NAME}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            天气
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            已获取天气摘要。
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToolDurationMeta />
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
            完成
          </span>
        </div>
      </div>
      {requestedLocation
        ? renderToolTextSection("请求位置", requestedLocation, false)
        : null}
      {resolvedLocation &&
      resolvedLocation.toLowerCase() !== requestedLocation.toLowerCase()
        ? renderToolTextSection("匹配位置", resolvedLocation, false)
        : null}
      {summarySegments.length > 0
        ? renderToolTextSection("天气快照", summarySegments.join(" · "), false)
        : null}
    </div>
  );
};

export const GenerateImageToolUI: ToolCallMessagePartComponent<
  Record<string, unknown>,
  GenerateImageToolResult
> = ({
  args,
  result,
  status,
  addResult,
  resume,
  approval,
  respondToApproval,
  interrupt,
}) => {
  const { propStatus } = useToolArgsStatus<AssistantSidebarCreateImageArgs>();
  const parsedResult = generateImageToolResultSchema.safeParse(result);
  const toolResult = parsedResult.success
    ? (parsedResult.data as GenerateImageToolResult)
    : undefined;
  const isUpscaleOperation = toolResult?.operation === "upscale";
  const promptStreaming =
    isStreamingToolArg(propStatus, "prompt") ||
    isStreamingToolArg(propStatus, "text");
  const aspectRatioStreaming = isStreamingToolArg(propStatus, "aspectRatio");
  const sizeStreaming = isStreamingToolArg(propStatus, "size");
  const countStreaming = isStreamingToolArg(propStatus, "count");
  const prompt = pickNonEmptyString(
    toolResult?.prompt,
    !promptStreaming ? getToolArgString(args, "text", "prompt") : "",
  );
  const promptReady = Boolean(getToolArgString(args, "text", "prompt"));
  const revisedPrompt = pickNonEmptyString(toolResult?.metadata?.revisedPrompt);
  const imageParts = getGenerateImageResultImages(toolResult);
  const warnings = getGenerateImageWarningMessages(toolResult?.warnings);
  const appliedAspectRatio = pickNonEmptyString(
    toolResult?.aspectRatio,
    !aspectRatioStreaming ? getToolArgString(args, "aspectRatio") : "",
  );
  const previewAspectRatio = appliedAspectRatio || "1:1";
  const aspectRatioClassName = getAspectRatioClassName(previewAspectRatio);
  const imageGalleryItems = toGenerateImageGalleryItems(imageParts);
  const appliedCount = Math.max(
    1,
    Math.floor(
      toFiniteNumber(toolResult?.count) ??
        (!countStreaming ? toFiniteNumber(args.count) : undefined) ??
        toFiniteNumber(getNestedToolArgs(args).count) ??
        (imageParts.length > 0 ? imageParts.length : 1),
    ),
  );
  const toolError =
    status.type === "incomplete" && status.reason === "error"
      ? parseAssistantToolError(status.error)
      : null;
  const providerLabel = pickNonEmptyString(
    toolResult?.providerName,
    toolResult?.providerId,
    toolError?.providerId,
  );
  const modelLabel = pickNonEmptyString(toolResult?.modelId, toolError?.modelId);
  const sizeLabel = pickNonEmptyString(
    toolResult?.size,
    !sizeStreaming ? getToolArgString(args, "size") : "",
  );
  const resolutionLabel = pickNonEmptyString(toolResult?.resolution);
  const referenceCount = Math.max(
    0,
    Math.floor(toFiniteNumber(toolResult?.referenceCount) ?? 0),
  );
  const settingsLocked = toolResult?.settingsLocked === true;
  const requestedCount = Math.max(
    1,
    Math.floor(
      toFiniteNumber(toolResult?.count) ??
        (!countStreaming ? toFiniteNumber(args.count) : undefined) ??
        toFiniteNumber(getNestedToolArgs(args).count) ??
        1,
    ),
  );
  const { isRunning, isError, badgeClassName, badgeLabel } =
    getToolStatusMeta(
      status,
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    );
  const runningPhase = isRunning
    ? getImageToolRunningPhase({
        propStatus,
        providerLabel,
        modelLabel,
        requestedCount,
        requestedAspectRatio: appliedAspectRatio,
        referenceCount,
        promptReady,
      })
    : null;
  const countLabel =
    imageParts.length > 0
      ? isError
        ? `供应商报错前已返回 ${imageParts.length} 张图片`
        : isUpscaleOperation
          ? `${imageParts.length} 张高清放大结果`
          : `${imageParts.length} 张图片结果`
      : isRunning
        ? runningPhase?.title ||
          (isUpscaleOperation
            ? "正在高清放大图片"
            : `正在生成 ${appliedCount} 张图片`)
        : isError
          ? isUpscaleOperation
            ? "高清放大失败"
            : "图片生成失败"
          : isUpscaleOperation
            ? "高清放大完成"
            : "图片生成完成";
  const metaItems = [
    isUpscaleOperation ? { label: "类型", value: "高清放大" } : null,
    providerLabel ? { label: "供应商", value: providerLabel } : null,
    modelLabel ? { label: "模型", value: modelLabel } : null,
    appliedAspectRatio ? { label: "比例", value: appliedAspectRatio } : null,
    resolutionLabel ? { label: "分辨率", value: resolutionLabel } : null,
    sizeLabel ? { label: "尺寸", value: sizeLabel } : null,
    appliedCount > 0 ? { label: "张数", value: String(appliedCount) } : null,
    referenceCount > 0
      ? { label: "参考图", value: String(referenceCount) }
      : null,
    settingsLocked ? { label: "模式", value: "面板设置" } : null,
  ].filter(
    (item): item is { label: string; value: string } =>
      Boolean(item?.label && item?.value),
  );
  const approvalSummaryItems = [
    isUpscaleOperation ? { label: "类型", value: "高清放大" } : null,
    requestedCount > 0 ? { label: "张数", value: String(requestedCount) } : null,
    providerLabel ? { label: "供应商", value: providerLabel } : null,
    modelLabel ? { label: "模型", value: modelLabel } : null,
    appliedAspectRatio ? { label: "比例", value: appliedAspectRatio } : null,
    resolutionLabel ? { label: "分辨率", value: resolutionLabel } : null,
    sizeLabel ? { label: "尺寸", value: sizeLabel } : null,
    referenceCount > 0
      ? { label: "参考图", value: String(referenceCount) }
      : null,
    settingsLocked ? { label: "模式", value: "面板设置" } : null,
  ].filter(
    (item): item is { label: string; value: string } =>
      Boolean(item?.label && item?.value),
  );

  return (
    <div className="my-2 space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {countLabel}
          </div>
          {runningPhase?.description ? (
            <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {runningPhase.description}
            </div>
          ) : null}
          {metaItems.length > 0 ? (
            <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
              {metaItems.map((item) => `${item.label}: ${item.value}`).join(" · ")}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToolDurationMeta />
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badgeClassName}`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>

      {status.type === "requires-action" ? (
        <div className="aui-generate-image-approval-summary rounded-2xl border border-sky-200/80 bg-sky-50/80 p-3 text-sm text-sky-950 shadow-sm dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-50">
          <div className="font-semibold">确认生成图片</div>
          <div className="mt-1 text-xs leading-5 text-sky-900/80 dark:text-sky-100/80">
            即将调用已配置的 AI SDK 生图工具。确认后才会发送到供应商。
          </div>
          {approvalSummaryItems.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {approvalSummaryItems.map((item) => (
                <span
                  key={`${item.label}:${item.value}`}
                  className="rounded-full border border-sky-200/80 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-sky-800 dark:border-sky-400/20 dark:bg-sky-950/30 dark:text-sky-100"
                >
                  {item.label}: {item.value}
                </span>
              ))}
            </div>
          ) : null}
          {prompt ? (
            <div className="mt-3 rounded-xl bg-white/80 p-2.5 text-xs leading-5 text-slate-700 dark:bg-slate-950/30 dark:text-slate-200">
              <div className="mb-1 font-medium text-slate-500 dark:text-slate-400">
                提示词
              </div>
              {truncateToolText(prompt, 360)}
            </div>
          ) : null}
          <ToolFallback.Approval
            className="mt-3"
            resume={resume}
            approval={approval}
            respondToApproval={respondToApproval}
            interrupt={interrupt}
          />
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}
      {isError ? (
        <div className="rounded-xl border border-rose-200/80 bg-rose-50/80 px-3 py-2.5 text-xs text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
          <div className="font-semibold">
            {toolError?.title || "图片供应商返回失败"}
          </div>
          <div className="mt-1 whitespace-pre-wrap break-words leading-5">
            {toolError?.message || "上游没有提供可读取的失败原因。"}
          </div>
          {toolError ? (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-rose-800/80 dark:text-rose-100/75">
              {toolError.providerId ? (
                <span>供应商: {toolError.providerId}</span>
              ) : null}
              {toolError.modelId ? <span>模型: {toolError.modelId}</span> : null}
              {toolError.requestId ? (
                <span>请求 ID: {toolError.requestId}</span>
              ) : null}
            </div>
          ) : null}
          {toolError?.raw ? (
            <details className="mt-2">
              <summary className="cursor-pointer select-none font-medium">
                查看完整上游返回
              </summary>
              <div className="mt-1.5 whitespace-pre-wrap break-all rounded-lg bg-white/65 px-2 py-1.5 font-mono text-[10px] leading-4 text-rose-950 dark:bg-rose-950/35 dark:text-rose-50">
                {toolError.raw}
              </div>
            </details>
          ) : null}
          {imageParts.length > 0 ? (
            <div className="mt-2 leading-5">
              供应商报错前已经返回了可用图片，下面的结果仍然可以放大、复制或下载。
            </div>
          ) : null}
        </div>
      ) : null}

      {imageParts.length > 0 ? (
        <div>
          <GenerateImageGallery
            items={imageGalleryItems}
            aspectRatioClassName={aspectRatioClassName}
          />
          {revisedPrompt && revisedPrompt !== prompt
            ? (
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  修订提示词：
                </span>{" "}
                {revisedPrompt}
              </p>
            )
            : null}
        </div>
      ) : isRunning ? (
        <div>
          <div className={`grid gap-2 ${requestedCount > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {Array.from({ length: requestedCount }).map((_, index) => (
              <AssistantImage.Root
                key={`image-skeleton-${index}`}
                variant="muted"
                size="full"
                className={aspectRatioClassName}
              >
                <AssistantImage.Generating className="h-full min-h-full" />
              </AssistantImage.Root>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const OpenAIImageGenerationToolUI: ToolCallMessagePartComponent<
  Record<string, unknown>,
  OpenAIImageGenerationToolResult
> = ({
  result,
  status,
  addResult,
  resume,
  approval,
  respondToApproval,
  interrupt,
}) => {
  const parsedResult = openAIImageGenerationToolResultSchema.safeParse(result);
  const toolResult = parsedResult.success
    ? (parsedResult.data as OpenAIImageGenerationToolResult)
    : undefined;
  const imageParts = normalizeOpenAIImageGenerationResultImage(toolResult);
  const imageGalleryItems = toGenerateImageGalleryItems(imageParts);
  const { isRunning, isError, badgeClassName, badgeLabel } =
    getToolStatusMeta(
      status,
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    );

  return (
    <div className="my-2 space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {isRunning
              ? "OpenAI 正在生成图片"
              : isError
                ? "OpenAI 图片生成失败"
                : imageParts.length > 0
                  ? "OpenAI 图片生成完成"
                  : "OpenAI 图片生成"}
          </div>
          <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            Responses API 原生 image_generation 工具
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToolDurationMeta />
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badgeClassName}`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>

      {status.type === "requires-action" ? (
        <ToolFallback.Approval
          resume={resume}
          approval={approval}
          respondToApproval={respondToApproval}
          interrupt={interrupt}
        />
      ) : null}

      {imageParts.length > 0 ? (
        <GenerateImageGallery
          items={imageGalleryItems}
          aspectRatioClassName="aspect-square"
        />
      ) : isRunning ? (
        <AssistantImage.Root
          variant="muted"
          size="full"
          className="aspect-square"
        >
          <AssistantImage.Generating className="h-full min-h-full" />
        </AssistantImage.Root>
      ) : null}
    </div>
  );
};

export const CreateTargetElementToolUI: ToolCallMessagePartComponent<
  Record<string, unknown>,
  CreateTargetElementToolResult | string | Record<string, unknown>
> = ({
  args,
  result,
  status,
  addResult,
  resume,
  approval,
  respondToApproval,
  interrupt,
}) => {
  const prompt = getToolArgString(args, "prompt", "text");
  const referenceCount =
    Array.isArray(args.referenceImages) || Array.isArray(args.images)
      ? (Array.isArray(args.referenceImages)
          ? args.referenceImages.length
          : 0) + (Array.isArray(args.images) ? args.images.length : 0)
      : 0;
  const parsedResult =
    typeof result === "string"
      ? null
      : createTargetElementToolResultSchema.safeParse(result);
  const normalizedResult =
    typeof result === "string"
      ? ({ ok: true, elementId: result } as CreateTargetElementToolResult)
      : parsedResult?.success
        ? (parsedResult.data as CreateTargetElementToolResult)
        : null;
  const elementId =
    typeof normalizedResult?.elementId === "string"
      ? normalizedResult.elementId.trim()
      : "";
  const error =
    typeof normalizedResult?.error === "string"
      ? normalizedResult.error.trim()
      : "";
  const { isRunning, isError, badgeClassName, badgeLabel } = getToolStatusMeta(
    status,
    "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
  );

  return (
    <div className={TOOL_CARD_CLASS_NAME}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            画布目标
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isRunning
              ? "正在创建目标元素"
              : isError
                ? "创建失败"
                : "创建完成"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToolDurationMeta />
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badgeClassName}`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>

      {prompt ? renderToolTextSection("提示词", prompt, false) : null}
      {referenceCount > 0
        ? renderToolTextSection("参考图", String(referenceCount), false)
        : null}
      {elementId ? renderToolTextSection("元素", elementId, false) : null}
      {error ? renderToolTextSection("错误", error, false) : null}
      {status.type === "requires-action" ? (
        <ToolFallback.Approval
          className="mt-3"
          resume={resume}
          approval={approval}
          respondToApproval={respondToApproval}
          interrupt={interrupt}
        />
      ) : null}
    </div>
  );
};
