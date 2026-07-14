import { z } from "zod";

export const assistantSidebarWebSearchParameters = z.object({
  query: z.string().min(1).describe("The web search query."),
});

export const assistantSidebarTavilyExtractParameters = z.object({
  urls: z
    .array(z.string().min(1))
    .min(1)
    .describe("URLs to extract structured page content from. XC Studio does not impose a project-level maximum."),
  extractDepth: z
    .enum(["basic", "advanced"])
    .optional()
    .describe("Optional Tavily extraction depth for this call."),
  query: z
    .string()
    .min(1)
    .optional()
    .describe("Optional focused extraction query."),
});

export const assistantSidebarTavilyCrawlParameters = z.object({
  url: z.string().min(1).describe("Base URL to crawl."),
  maxDepth: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .describe("Optional maximum crawl depth."),
  extractDepth: z
    .enum(["basic", "advanced"])
    .optional()
    .describe("Optional Tavily extraction depth for crawled pages."),
  instructions: z
    .string()
    .min(1)
    .optional()
    .describe("Optional natural language crawl instructions."),
  allowExternal: z
    .boolean()
    .optional()
    .describe("Whether Tavily may crawl external domains."),
});

export const assistantSidebarTavilyMapParameters = z.object({
  url: z.string().min(1).describe("Base URL to map."),
  maxDepth: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .describe("Optional maximum mapping depth."),
  instructions: z
    .string()
    .min(1)
    .optional()
    .describe("Optional natural language mapping instructions."),
  allowExternal: z
    .boolean()
    .optional()
    .describe("Whether Tavily may map external domains."),
});

export const assistantSidebarGetWeatherParameters = z.object({
  location: z
    .string()
    .min(1)
    .describe("The city, place name, or address to get weather for."),
  unit: z
    .enum(["celsius", "fahrenheit"])
    .optional()
    .describe("Temperature unit for the weather result."),
});

export const assistantSidebarCreateImageParameters = z.object({
  prompt: z
    .string()
    .min(1)
    .describe("The image generation or image editing instruction."),
  text: z
    .string()
    .min(1)
    .optional()
    .describe("Optional official AI SDK image prompt text. When provided, it overrides prompt."),
  images: z
    .array(z.string().min(1))
    .optional()
    .describe("Optional official AI SDK input images for image editing. Values can be image URLs, data URLs, or base64 strings. XC Studio does not impose a project-level maximum; the configured AI SDK provider decides what it can fulfill."),
  mask: z
    .string()
    .min(1)
    .optional()
    .describe("Optional official AI SDK mask image URL, data URL, or base64 string for inpainting/editing."),
  aspectRatio: z
    .string()
    .optional()
    .describe("Optional aspect ratio such as 1:1, 3:4, 4:3, 16:9, or 9:16."),
  size: z
    .string()
    .regex(/^\d+x\d+$/)
    .optional()
    .describe("Optional exact output size, for models that support size."),
  count: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Optional number of separate images to generate. For multi-image sets, detail pages, or listing assets, use count instead of asking for one collage/grid image. XC Studio does not impose a project-level maximum; the configured AI SDK provider decides what it can fulfill."),
});

export const assistantSidebarUpscaleImageParameters = z.object({
  image: z
    .string()
    .min(1)
    .optional()
    .describe("Optional source image URL, data URL, or base64 string to upscale. If omitted, XC Studio uses the latest available image reference from the conversation."),
  images: z
    .array(z.string().min(1))
    .optional()
    .describe("Optional source image candidates. XC Studio uses the first valid image for content-preserving upscale."),
  resolution: z
    .enum(["2K", "4K", "8K"])
    .optional()
    .describe("Target upscale resolution. 4K means the configured image provider's 4K output mode while preserving the source aspect ratio."),
  prompt: z
    .string()
    .min(1)
    .optional()
    .describe("Optional extra enhancement instruction. Do not use this to redesign the image."),
});

export const assistantSidebarListStudioSkillsParameters = z.object({
  query: z
    .string()
    .min(1)
    .optional()
    .describe("Optional user request or task summary to match against Studio skills."),
  tab: z
    .enum(["commerce", "branding", "social", "video"])
    .optional()
    .describe("Optional Studio work area to filter skills."),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Optional number of matching skills to return. XC Studio does not impose a project-level maximum."),
});

export const assistantSidebarPlanStudioWorkflowParameters = z.object({
  request: z
    .string()
    .min(1)
    .describe("The user's Studio workflow request to plan."),
  workflowId: z
    .string()
    .min(1)
    .optional()
    .describe("Optional matching Studio workflow id returned by listStudioSkills."),
  imageCount: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Optional number of separate image deliverables to plan. XC Studio does not impose a project-level maximum."),
  referenceImageCount: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("How many user or thread reference images are available."),
});

export const assistantSidebarSearchWorkspaceKnowledgeParameters = z.object({
  query: z
    .string()
    .min(1)
    .describe("The local XC Studio knowledge query."),
  source: z
    .enum(["studio-assets", "studio-skills", "knowledge"])
    .optional()
    .describe("Optional local knowledge source to search."),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Optional number of local knowledge matches to return. XC Studio does not impose a project-level maximum."),
});

export const assistantSidebarCreateTargetElementParameters = z.object({
  prompt: z
    .string()
    .optional()
    .describe("Optional prompt to seed the new canvas image target."),
  referenceImages: z
    .array(z.string().min(1))
    .optional()
    .describe("Optional image URLs, data URLs, or base64 strings to attach as references. XC Studio does not impose a project-level maximum; the configured AI SDK provider decides what it can fulfill."),
});

export type AssistantSidebarCreateTargetElementArgs = z.infer<
  typeof assistantSidebarCreateTargetElementParameters
>;

export type AssistantSidebarCreateImageArgs = z.infer<
  typeof assistantSidebarCreateImageParameters
>;

export type AssistantSidebarUpscaleImageArgs = z.infer<
  typeof assistantSidebarUpscaleImageParameters
>;

export type AssistantSidebarListStudioSkillsArgs = z.infer<
  typeof assistantSidebarListStudioSkillsParameters
>;

export type AssistantSidebarPlanStudioWorkflowArgs = z.infer<
  typeof assistantSidebarPlanStudioWorkflowParameters
>;

export type AssistantSidebarSearchWorkspaceKnowledgeArgs = z.infer<
  typeof assistantSidebarSearchWorkspaceKnowledgeParameters
>;

export type AssistantSidebarGetWeatherArgs = z.infer<
  typeof assistantSidebarGetWeatherParameters
>;

export type AssistantSidebarTavilyExtractArgs = z.infer<
  typeof assistantSidebarTavilyExtractParameters
>;

export type AssistantSidebarTavilyCrawlArgs = z.infer<
  typeof assistantSidebarTavilyCrawlParameters
>;

export type AssistantSidebarTavilyMapArgs = z.infer<
  typeof assistantSidebarTavilyMapParameters
>;
