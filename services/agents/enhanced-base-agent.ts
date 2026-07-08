/**
 * 澧炲己鍨嬪熀纭€鏅鸿兘浣?
 * 浣跨敤Skills绯荤粺缁熶竴澶勭悊浠诲姟锛屾彁渚涘畬鍠勭殑閿欒澶勭悊鍜岀姸鎬佺鐞?
 */

import { Chat, Type } from "@google/genai";
import { createChatSession, generateJsonResponse, getApiKey, getBestModelSelection } from "../gemini";
import {
  AgentTask,
  AgentInfo,
  ProjectContext,
  GeneratedAsset,
} from "../../types/agent.types";
import { executeSkill, AVAILABLE_SKILLS } from "../skills/index.ts";
import {
  isAssetProducingSkillName,
  isImageGenerationSkillName,
  isVideoGenerationSkillName,
} from "../skills/skill-manifest.ts";
import { buildImageAssetsFromSkillResults } from "./image-result-extractor";
import { errorHandler, ErrorType, AppError } from "../../utils/error-handler";
import { buildEcommerceProposals } from "./shared/ecommerce-variants";
import { useAgentStore } from "../../stores/agent.store";
import { buildRuntimeRolePrompt } from "./runtime-role";
import { normalizeImageDataUrlString } from "./data-url-helpers.ts";
import { runMainBrainRuntime } from "./main-brain-runtime";
import { buildMainBrainTaskProgressUpdate } from "./main-brain-progress-state";
import { buildAnalyzePlanPrompt } from "./analyze-plan-prompt";
import { normalizePlannedMarkerSmartEditCalls } from "./planned-marker-smart-edit-normalizer.ts";
import { resolveMainBrainOutput } from "./main-brain-output";
import { prepareSkillExecutionCall } from "./skill-execution-preprocessor";
import {
  extractVisibleThoughtTrace,
  normalizeAgentJsonResponse,
} from "./agent-response-normalizer";
import {
  buildForcedGenerateImageCall,
  ensureForcedImagePlan,
} from "./forced-image-guard";
import { negotiateImageToolRequest } from "../image-generation/request-negotiator.ts";
import { retryMainBrainOperation } from "./main-brain-failure-policy";
import {
  buildAgentTaskOutput,
  buildMainBrainTaskOutput,
  buildSkillExecutionRuntimeEnvelope,
} from "./agent-task-output";
import { finalizeRoleGovernancePlan } from "./main-brain-role-governance";
import {
  normalizeSkillCalls,
} from "./skill-call-normalizer";
import { buildImageAttachmentTokens } from "./environment-input-protocol";
import {
  hydrateSkillCallWithFrontstageProfile,
  mergePreferredSkillsWithFrontstageProfile,
  prioritizeSkillCallsForFrontstageProfile,
  repairAutonomousSkillPlan,
  shouldBypassAutonomousChatSuppression,
  shouldExecuteFrontstageSkillSequentially,
} from "./frontstage-skill-execution.ts";
import {
  buildFailedSkillExecutionResult,
  buildReferenceInjectionTelemetry,
  buildSuccessfulSkillExecutionResult,
  executeSkillWithTimeout,
  normalizeSettledSkillExecutionResults,
  resolveSkillTimeoutMs,
} from "./skill-execution-runtime";
import { runWithTimeout, withTimeout } from "./timeout-utils";
import { resolveAnalyzePlanSystemPrompt } from "./analyze-plan-system-prompt.ts";
import {
  beginSkillRunForAgentTask,
  failSkillRunForAgentTask,
  finishSkillRunForAgentTask,
  recordClarifyEventForAgentTask,
  type ActiveAgentTaskRun,
} from "../skills/runtime/agent-task-skill-run-bridge.ts";
import { evaluateSkillClarifyGate } from "./skill-clarify-gate.ts";

const isWorkspaceChatDebugEnabled = (): boolean => {
  const env = (import.meta as unknown as {
    env?: Record<string, string | boolean | undefined>;
  }).env;
  if (!env?.DEV || typeof window === "undefined") return false;
  const toggle = window.localStorage.getItem("debug_workspace_chat");
  if (!toggle) return false;
  const normalized = toggle.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
};

const workspaceChatDebugLog = (...args: unknown[]) => {
  if (isWorkspaceChatDebugEnabled()) {
    console.log(...args);
  }
};

// 闄愭祦骞跺彂鎵ц鍣細闄愬埗鏈€澶?concurrency 涓换鍔″悓鏃舵墽琛?
const runWithConcurrency = async <T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> => {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let index = 0;

  const worker = async () => {
    while (index < tasks.length) {
      const i = index++;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (error: any) {
        results[i] = { status: "rejected", reason: error };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()),
  );
  return results;
};

const SKILL_EXECUTION_PROGRESS_STEPS = [
  "正在连接 Nano Banana Pro 模型...",
  "正在分析视觉元素与构图结构...",
  "正在细化光影层次与画面氛围...",
  "正在优化清晰度与输出质量...",
  "正在执行最后的细节精修...",
  "正在把结果同步到画布...",
];

const buildImageExecutionTrace = (params: Record<string, any> | undefined) => ({
  model: params?.model || null,
  providerId: params?.providerId || null,
  aspectRatio: params?.aspectRatio || null,
  imageSize: params?.imageSize || null,
  exactSize: params?.exactSize || null,
  imageQuality: params?.imageQuality || params?.quality || null,
  promptLanguagePolicy: params?.promptLanguagePolicy || null,
  referenceCount: Array.isArray(params?.referenceImages)
    ? params.referenceImages.length
    : params?.referenceImage
      ? 1
      : 0,
  hasMask: Boolean(params?.maskImage),
});

// Pull upstream diagnostics off an underlying error so the brain's failure
// summary can name the upstream provider / HTTP status instead of the
// generic "AI 服务调用失败" friendly text.
const extractSkillErrorDetail = (raw: unknown) => {
  if (!raw) return undefined;
  const original =
    (raw as any)?.originalError instanceof Error
      ? (raw as any).originalError
      : raw instanceof Error
        ? raw
        : null;
  if (!original) return undefined;
  const message = String(original.message || '');
  const httpStatus = (() => {
    const status = (original as any)?.status;
    if (typeof status === 'number' && Number.isFinite(status)) return status;
    const match = message.match(/\b(4\d{2}|5\d{2})\b/);
    return match ? Number(match[1]) : undefined;
  })();
  const proxyTarget = (() => {
    const direct = (original as any)?.proxyTarget;
    if (typeof direct === 'string' && direct) return direct;
    const ctx = (raw as any)?.context;
    if (ctx && typeof ctx.proxyTarget === 'string' && ctx.proxyTarget) {
      return ctx.proxyTarget;
    }
    return undefined;
  })();
  const detail: { rawMessage?: string; httpStatus?: number; proxyTarget?: string } = {};
  if (message) detail.rawMessage = message.length > 320 ? message.slice(0, 320) : message;
  if (typeof httpStatus === 'number') detail.httpStatus = httpStatus;
  if (proxyTarget) detail.proxyTarget = proxyTarget;
  return Object.keys(detail).length > 0 ? detail : undefined;
};

const buildNegotiatedImageExecutionTrace = (params: Record<string, any> | undefined) => {
  const requested = buildImageExecutionTrace(params);

  // If model/providerId are not yet set on the skill call, the negotiator
  // would synthesize a default placeholder (e.g. Auto -> NanoBanana2 @
  // api3.wlai.vip). That fake "resolved" block has caused real confusion in
  // logs ("why did my request go to wlai.vip?"). Only show the resolved view
  // when we actually have a concrete model to negotiate against.
  const hasModel = Boolean(params && String((params as any).model || '').trim());

  if (!hasModel) {
    return {
      phase: "pending-preferences",
      requested,
    };
  }

  try {
    const negotiated = negotiateImageToolRequest((params || {}) as any);
    return {
      phase: "resolved",
      requested,
      resolved: {
        ...buildImageExecutionTrace(negotiated.normalized as Record<string, any>),
        canonicalModel: negotiated.contractSummary.canonicalModel,
        selectedModel: negotiated.contractSummary.selectedModel,
        endpointBaseUrl: negotiated.contractSummary.endpointBaseUrl,
      },
      warnings: negotiated.warnings.map((item) => ({
        code: item.code,
        message: item.message,
      })),
    };
  } catch (error: any) {
    return {
      phase: "requested",
      requested,
      resolveError: error instanceof Error ? error.message : String(error || "unknown"),
    };
  }
};

/**
 * 浠诲姟鎵ц閰嶇疆
 */
interface ExecutionConfig {
  maxRetries: number;
  timeout: number;
  enableCache: boolean;
}

interface ImageParamsSchema {
  type: Type;
  properties: Record<string, { type: Type }>;
}

const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  maxRetries: 0,
  timeout: 600000, // 10 鍒嗛挓锛堝浘鐗囩敓鎴?+ 鍒嗘瀽鍙兘闇€瑕佽緝闀挎椂闂达級
  enableCache: true,
};

const DEFAULT_MAX_REFERENCE_IMAGES = 8;
const parsedMaxReferenceImages = Number.parseInt(
  String((import.meta as any).env?.VITE_MAX_REFERENCE_IMAGES ?? DEFAULT_MAX_REFERENCE_IMAGES),
  10,
);
const MAX_REFERENCE_IMAGES =
  Number.isFinite(parsedMaxReferenceImages) && parsedMaxReferenceImages > 0
    ? parsedMaxReferenceImages
    : DEFAULT_MAX_REFERENCE_IMAGES;

const IMAGE_TOOL_PARAMS_SCHEMA: ImageParamsSchema = {
  type: Type.OBJECT,
  properties: {
    prompt: { type: Type.STRING },
    model: { type: Type.STRING },
    aspectRatio: { type: Type.STRING },
    referenceImage: { type: Type.STRING },
    referenceImageUrl: { type: Type.STRING },
    reference_image_url: { type: Type.STRING },
    initImage: { type: Type.STRING },
    init_image: { type: Type.STRING },
  },
};
const MULTI_IMAGE_REQUEST_RE = /(\d+)\s*寮爘(\d+)\s*images?|涓€濂梶涓€缁剕绯诲垪|濂楀浘/i;
const ECOM_SET_RE = /浜氶┈閫妡amazon|listing|鍓浘|鐢靛晢|涓诲浘|璇︽儏鍥緗濂楀浘/i;
const BANNED_MULTI_FRAME_TERMS_RE =
  /\b(collage|set of images|multiple views|listing template|contact sheet|mosaic|grid panel)\b/gi;
type InlineImagePart = { inlineData: { mimeType: string; data: string } };

const dataUrlToInlinePart = (dataUrl: string): InlineImagePart | null => {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match || !match[1] || !match[2]) return null;
  return {
    inlineData: {
      mimeType: match[1],
      data: match[2],
    },
  };
};

const blobToInlinePart = async (blob: Blob): Promise<InlineImagePart | null> => {
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("image read failed"));
      reader.readAsDataURL(blob);
    });
    return dataUrlToInlinePart(dataUrl);
  } catch {
    return null;
  }
};

const fileToInlinePart = async (file: File): Promise<InlineImagePart | null> => {
  try {
    return await blobToInlinePart(file);
  } catch {
    return null;
  }
};

const urlToInlinePart = async (url: string): Promise<InlineImagePart | null> => {
  try {
    const normalizedUrl = String(url || "").trim();
    if (!/^https?:\/\//i.test(normalizedUrl) && !normalizeImageDataUrlString(normalizedUrl)) {
      return null;
    }
    const normalizedDataUrl = normalizeImageDataUrlString(normalizedUrl);
    if (normalizedDataUrl) {
      return dataUrlToInlinePart(normalizedDataUrl);
    }
    const response = await fetch(normalizedUrl);
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    const mimeType = String(blob.type || "").toLowerCase();
    if (mimeType && !mimeType.startsWith("image/")) {
      return null;
    }
    return blobToInlinePart(blob);
  } catch {
    return null;
  }
};

export abstract class EnhancedBaseAgent {
  protected chat: Chat | null = null;
  protected executionCache: Map<string, any> = new Map();

  abstract get agentInfo(): AgentInfo;
  abstract get systemPrompt(): string;
  abstract get preferredSkills(): string[]; // 鏅鸿兘浣撳亸濂界殑鎶€鑳?

  /** 鏈€澶у苟鍙戞暟锛堝瓙绫诲彲瑕嗙洊锛氬浘鐗囧瘑闆嗗瀷=3锛岃棰戝瘑闆嗗瀷=1锛屾贩鍚?2锛?*/
  get maxConcurrency(): number {
    return 2;
  }

  private shouldShowImageExecutionProgress(
    skillCalls: Array<{ skillName?: string }>,
  ): boolean {
    return skillCalls.some((call) =>
      ["generateImage", "smartEdit", "touchEdit"].includes(
        String(call?.skillName || ""),
      ),
    );
  }

  private startSkillExecutionProgress(
    task: AgentTask,
    skillCalls: Array<{ skillName?: string }>,
  ): (() => void) | null {
    if (!this.shouldShowImageExecutionProgress(skillCalls)) {
      return null;
    }

    let progressIndex = 0;
    const intervalId = setInterval(() => {
      if (progressIndex >= SKILL_EXECUTION_PROGRESS_STEPS.length) {
        return;
      }

      useAgentStore.getState().actions.setCurrentTask({
        ...task,
        status: "executing",
        progressMessage: SKILL_EXECUTION_PROGRESS_STEPS[progressIndex],
        progressStep: 3,
        totalSteps: 4,
      });
      progressIndex += 1;
    }, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }

  private shouldSuppressAutonomousSkillExecution(
    task: AgentTask,
  ): boolean {
    const metadata = task.input.metadata;
    if (metadata?.allowAutonomousRouting !== true) {
      return false;
    }

    if (shouldBypassAutonomousChatSuppression(metadata, task.input.message)) {
      return false;
    }

    const taskMode = String(metadata?.taskMode || "").trim().toLowerCase();
    return taskMode === "chat" || taskMode === "research";
  }

  // 澧炲己鐢熷浘鎰忓浘璇嗗埆锛氬鏋滄秷鎭槑纭姹傝瑙変骇鍑猴紝鍒欏己鍒惰皟鐢ㄧ敓鍥惧伐鍏?
  private shouldForceImageToolCall(
    message: string,
    metadata?: Record<string, any>,
  ): boolean {
    // 涓婃父鍙樉寮忓己鍒?
    if (
      metadata?.forceToolCall === true ||
      metadata?.forceGenerateImage === true
    )
      return true;

    // 鍩虹鎰忓浘璇嗗埆锛氭槑纭浜у嚭瑙嗚鍐呭锛堟捣鎶ャ€佸ご鍥俱€丅anner銆丩ogo銆佺敾鍥剧瓑锛?
    const imageIntent =
      /(生成|出图|做图|画图|画一个|画一张|海报|poster|banner|封面|配图|图片|图像|视觉设计|头图|主图|设计一张|插图|绘图|design a|generate image|create poster|draw)/i.test(
        message,
      );

    // 鎺掗櫎绾挩璇㈡垨鏂囨绫诲満鏅?
    const consultOnly =
      /(解释|原理|教程|怎么做|如何做|为什么|文字稿|仅文案|不需要图|告诉我)/i.test(
        message,
      );

    const result = imageIntent && !consultOnly;
    if (result) {
      workspaceChatDebugLog(
        `[${this.agentInfo.id}] Detect Image Intent: Forced tool call activated.`,
      );
    }
    return result;
  }

  private parseRequestedImageCount(message: string): number {
    const match = message.match(MULTI_IMAGE_REQUEST_RE);
    if (!match) return 0;
    const parsed = parseInt(match[1] || match[2] || "0", 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return 5;
  }

  private shouldBypassFastPath(message: string): boolean {
    const requestedCount = this.parseRequestedImageCount(message);
    return requestedCount > 1 || ECOM_SET_RE.test(message);
  }

  private shouldForceAutoExecution(
    message: string,
    requestedCount: number,
    forceImageToolCall: boolean,
  ): boolean {
    return (
      forceImageToolCall || requestedCount > 1 || ECOM_SET_RE.test(message)
    );
  }

  private sanitizeSingleFramePrompt(prompt: string): string {
    const cleaned = (prompt || "").replace(BANNED_MULTI_FRAME_TERMS_RE, "").trim();
    if (!cleaned) {
      return "Single product hero shot, one scene only, clean composition, commercial photography, 8k";
    }
    return `${cleaned}. Single frame only, one scene only, no collage, no multi-panel layout.`;
  }

  private buildMultiImageFallbackCalls(
    message: string,
    count: number,
    attachments?: File[],
    metadata?: Record<string, any>,
  ): any[] {
    const numericCount = Number(count);
    const safeCount = Math.max(
      1,
      Number.isFinite(numericCount) ? Math.floor(numericCount) : 5,
    );
    const aspectRatio = (metadata?.preferredAspectRatio as string) || "1:1";
    const model = "Nano Banana Pro";
    const variants = [
      {
        title: "鐧藉簳涓诲浘",
        prompt:
          "Single hero product shot, pure white background, centered composition, soft shadow, commercial e-commerce style, 8k",
      },
      {
        title: "卖点信息图",
        prompt:
          "Single product infographic composition, clean white background, callout-friendly layout, feature emphasis, commercial listing style, 8k",
      },
      {
        title: "生活场景图",
        prompt:
          "Single lifestyle in-use scene with product as hero, warm natural light, authentic daily environment, editorial commercial photography, 8k",
      },
      {
        title: "材质细节图",
        prompt:
          "Single macro close-up of product material and texture, premium studio lighting, sharp focus, craftsmanship detail, 8k",
      },
      {
        title: "尺寸包装图",
        prompt:
          "Single size and packaging overview scene, product with box and accessories, clean informative composition, e-commerce visual language, 8k",
      },
      {
        title: "对比优势图",
        prompt:
          "Single comparison-focused scene highlighting product advantage, clear contrast narrative, trustworthy commercial style, 8k",
      },
      {
        title: "性能展示图",
        prompt:
          "Single performance demonstration scene with product as hero, controlled lighting, clear functionality communication, 8k",
      },
      {
        title: "品牌氛围图",
        prompt:
          "Single premium brand storytelling scene with product hero and copy-safe negative space, campaign quality, 8k",
      },
    ];

    return Array.from({ length: safeCount }).map((_, index) => {
      const variant = variants[index % variants.length];
      const cycle = Math.floor(index / variants.length) + 1;
      const params: Record<string, any> = {
        prompt: this.sanitizeSingleFramePrompt(
          `${variant.prompt}. ${cycle > 1 ? `Alternate set ${cycle}. ` : ""}Product requirement: ${message}`,
        ),
        aspectRatio: aspectRatio,
        model: model,
      };

      if (attachments && attachments.length > 0) {
        const attachmentRefs = buildImageAttachmentTokens(attachments);
        if (attachmentRefs.length > 0) {
          params.referenceImages = attachmentRefs;
          params.referenceImage = attachmentRefs[0];
          params.referencePriority = attachmentRefs.length > 1 ? "all" : "first";
          params.referenceMode = "product";
        }
      }

      return {
        skillName: "generateImage",
        params,
        description: `第 ${index + 1} 张（${variant.title}${cycle > 1 ? ` ${cycle}` : ""}）`,
      };
    });
  }

  private getPreferredImageCount(metadata?: Record<string, any>): number {
    const rawValue = Number.parseInt(
      String(metadata?.preferredImageCount ?? 1),
      10,
    );

    if (!Number.isFinite(rawValue)) {
      return 1;
    }

    return Math.max(1, rawValue);
  }

  private decoratePreferredImageVariantPrompt(
    prompt: string,
    index: number,
    total: number,
  ): string {
    if (index === 0 || total <= 1) {
      return prompt;
    }

    const variantHints = [
      "Create a distinct composition variation while preserving the same subject, style, and prompt intent.",
      "Create another clearly different framing and visual rhythm while keeping the same subject and style constraints.",
      "Create a fresh alternate shot with different composition emphasis, while preserving the same product, scene goal, and aesthetic direction.",
    ];
    const hint = variantHints[Math.min(index - 1, variantHints.length - 1)];

    return `${prompt}\n\nVariation ${index + 1}/${total}: ${hint}`;
  }

  private expandPreferredImageCountCalls(
    skillCalls: any[],
    preferredImageCount: number,
  ): any[] {
    if (preferredImageCount <= 1) {
      return skillCalls;
    }

    const generateImageIndices = skillCalls.reduce<number[]>(
      (indices, call, index) => {
        if (isImageGenerationSkillName(call?.skillName)) {
          indices.push(index);
        }
        return indices;
      },
      [],
    );

    if (generateImageIndices.length !== 1) {
      return skillCalls;
    }

    const targetIndex = generateImageIndices[0];
    const baseCall = skillCalls[targetIndex];
    const expandedCalls = Array.from({ length: preferredImageCount }).map(
      (_, index) => ({
        ...baseCall,
        params: {
          ...(baseCall?.params || {}),
          prompt: this.decoratePreferredImageVariantPrompt(
            String(baseCall?.params?.prompt || ""),
            index,
            preferredImageCount,
          ),
        },
        description:
          index === 0
            ? baseCall?.description
            : `Variation ${index + 1}/${preferredImageCount}`,
      }),
    );

    return [
      ...skillCalls.slice(0, targetIndex),
      ...expandedCalls,
      ...skillCalls.slice(targetIndex + 1),
    ];
  }

  /**
   * 鍒濆鍖栨櫤鑳戒綋
   */
  async initialize(context: ProjectContext): Promise<void> {
    try {
      this.chat = createChatSession(
        "gemini-3-pro-preview",
        [],
        this.systemPrompt,
      );
      workspaceChatDebugLog(`[${this.agentInfo.id}] Initialized successfully`);
    } catch (error) {
      throw errorHandler.handleError(error, {
        agent: this.agentInfo.id,
        function: "initialize",
      });
    }
  }

  /**
   * 鎵ц浠诲姟锛堟牳蹇冩柟娉曪級
   */
  async execute(
    task: AgentTask,
    config: Partial<ExecutionConfig> = {},
  ): Promise<AgentTask> {
    const finalConfig = { ...DEFAULT_EXECUTION_CONFIG, ...config };
    const taskId = task.id;
    // Phase 2 read-side double-write: record a SkillRun for any task carrying skillData.
    // This does not change execution behavior; failures here must never break the agent.
    let __skillRun: ActiveAgentTaskRun | null = null;
    try {
      __skillRun = beginSkillRunForAgentTask(task, { messageId: taskId });
    } catch {
      __skillRun = null;
    }

    try {
      workspaceChatDebugLog(`[${this.agentInfo.id}] Starting task execution:`, taskId);

      // 鏇存柊浠诲姟鐘舵€?
      task = this.updateTaskStatus(task, "analyzing");

      // 楠岃瘉杈撳叆
      this.validateInput(task);

      // 妫€鏌ョ紦瀛?
      if (finalConfig.enableCache) {
        const cached = this.getCachedResult(task);
        if (cached) {
          workspaceChatDebugLog(`[${this.agentInfo.id}] Using cached result`);
          return this.updateTaskStatus(cached, "completed");
        }
      }

      // 浣跨敤閿欒澶勭悊鍖呰鍣ㄦ墽琛?
      const result = await errorHandler.withRetry(
        () => this.executeWithTimeout(task, finalConfig.timeout),
        {
          maxRetries: finalConfig.maxRetries,
          delay: 1000,
          backoff: false,
          context: {
            agent: this.agentInfo.id,
            taskId,
            taskType: task.input.message.substring(0, 50),
          },
        },
      );

      // 缂撳瓨缁撴灉
      if (finalConfig.enableCache && result.status === "completed") {
        this.cacheResult(task, result);
      }

      workspaceChatDebugLog(`[${this.agentInfo.id}] Task completed:`, taskId);
      try {
        finishSkillRunForAgentTask(__skillRun, result);
      } catch {
        // best effort: never block agent task completion on run recording.
      }
      return result;
    } catch (error) {
      const appError = error as AppError;
      console.error(`[${this.agentInfo.id}] Task failed:`, appError.message);
      try {
        failSkillRunForAgentTask(__skillRun, {
          message: appError?.message,
          code: (appError as { code?: string } | undefined)?.code,
          stage: "execute",
        });
      } catch {
        // best effort.
      }

      return {
        ...task,
        status: "failed",
        output: {
          ...buildAgentTaskOutput({
            message: `执行失败：${appError.message}`,
            runtime: { mode: "skill-execution" },
          }),
          error: appError,
        },
        updatedAt: Date.now(),
      };
    }
  }

  /**
   * 甯﹁秴鏃剁殑鎵ц
   */
  private async executeWithTimeout(
    task: AgentTask,
    timeout: number,
  ): Promise<AgentTask> {
    return runWithTimeout({
      promise: this.executeInternal(task),
      timeoutMs: timeout,
      createTimeoutError: () =>
        errorHandler.createError(
          ErrorType.AGENT,
          "浠诲姟鎵ц瓒呮椂",
          undefined,
          { taskId: task.id, timeout },
          true,
        ),
    });
  }

  /**
   * 鍐呴儴鎵ц閫昏緫锛堜娇鐢⊿kills锛?
   */
  private async executeInternal(task: AgentTask): Promise<AgentTask> {
    const { message, context } = task.input;
    const store = useAgentStore.getState();
    const skillData = task.input.metadata?.skillData as
      | { id?: string; config?: Record<string, any> }
      | undefined;
    const allowAutonomousRouting =
      task.input.metadata?.allowAutonomousRouting === true;
    const forceImageToolCall = this.shouldForceImageToolCall(
      message,
      task.input.metadata,
    );

    if (allowAutonomousRouting) {
      return this.executeAutonomousMainBrainTask(task);
    }

    store.actions.setCurrentTask({
      ...task,
      status: "analyzing",
      progressMessage: "正在接收任务并整理上下文...",
      progressStep: 1,
      totalSteps: 4,
    });

    if (
      skillData?.id === "jkai-oneclick" ||
      skillData?.id === "xcai-oneclick"
    ) {
      store.actions.setCurrentTask({
        ...task,
        status: "executing",
        progressMessage: "正在执行 JKAI One-Click 工作流（Startup -> P5）...",
        progressStep: 3,
        totalSteps: 4,
      });

      const oneclickResult = await executeSkill("jkaiOneclick", {
        input: {
          message,
          referenceImages: task.input.uploadedAttachments || [],
          attachments: task.input.uploadedAttachments || [],
        },
        config: skillData.config || {},
      });

      return {
        ...task,
        status: "completed",
        output: buildAgentTaskOutput({
          message:
            typeof oneclickResult === "string"
              ? oneclickResult
              : "JKAI One-Click 执行完成。",
          analysis: "已按 Core + Packs 方式完成 Startup、P0-P5 分阶段编排。",
          adjustments: [
            "可继续：按 P3 主图指令直接生成",
            "可继续：按 P4 输出分批生成副图",
          ],
          proposals: [],
          assets: [],
          skillCalls: [],
          runtime: {
            mode: "skill-execution",
            proposalCount: 0,
            assetCount: 0,
            skillCallCount: 0,
            successfulSkillCount: 0,
            failedSkillCount: 0,
          },
        }),
        updatedAt: Date.now(),
      };
    }

    if (skillData?.id === "cn-detail-page") {
      store.actions.setCurrentTask({
        ...task,
        status: "executing",
        progressMessage: "正在生成国内电商中文详情页套图...",
        progressStep: 3,
        totalSteps: 4,
      });

      const imageFiles = (task.input.attachments || []).filter(
        (file) => file?.type && file.type.startsWith("image/"),
      );
      const uploadedRefs = (task.input.uploadedAttachments || []).filter((url) =>
        /^https?:\/\//i.test(String(url || "")),
      );
      const localRefs =
        uploadedRefs.length > 0
          ? []
          : await Promise.all(
              imageFiles.map(
                (file) =>
                  new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ""));
                    reader.onerror = () => resolve("");
                    reader.readAsDataURL(file);
                  }),
              ),
            );

      const productImages = [...uploadedRefs, ...localRefs]
        .filter(Boolean)
        .slice(0, 6);

      if (productImages.length === 0) {
        return {
          ...task,
          status: "completed",
          output: buildAgentTaskOutput({
            message: "请先上传至少 1 张商品图片，我再为你生成中文详情页套图。",
            proposals: [],
            assets: [],
            adjustments: ["上传商品图后重试", "可补充品牌调性与人群定位"],
            runtime: {
              mode: "skill-execution",
              proposalCount: 0,
              assetCount: 0,
              skillCallCount: 0,
              successfulSkillCount: 0,
              failedSkillCount: 0,
            },
          }),
          updatedAt: Date.now(),
        };
      }

      const defaults = (skillData.config?.defaults || {}) as Record<string, any>;
      const promptVersion =
        defaults.promptVersion === "original" ? "original" : "new";
      const textMode =
        defaults.textMode === "withText" || defaults.textMode === "noText"
          ? defaults.textMode
          : "auto";
      const ratioMode = defaults.ratioMode === "fixed" ? "fixed" : "adaptive";
      const fixedAspectRatio =
        typeof defaults.fixedAspectRatio === "string"
          ? defaults.fixedAspectRatio
          : "";
      const qualityThreshold = Number.isFinite(
        Number(defaults.qualityThreshold),
      )
        ? Number(defaults.qualityThreshold)
        : 0.68;
      const replacementBudget = Number.isFinite(
        Number(defaults.replacementBudget),
      )
        ? Number(defaults.replacementBudget)
        : 2;
      const retryPolicy =
        defaults.retryPolicy && typeof defaults.retryPolicy === "object"
          ? defaults.retryPolicy
          : undefined;

      const cnDetailResult = await executeSkill("cnDetailPage", {
        productImages,
        brief: message,
        count: Number(defaults.count ?? 6),
        aspectRatio: String(defaults.aspectRatio || "3:4"),
        imageSize: defaults.imageSize || "2K",
        model: defaults.model || "nanobanana2",
        promptVersion,
        textMode,
        ratioMode,
        fixedAspectRatio,
        qualityThreshold,
        replacementBudget,
        retryPolicy,
      });

      const images = Array.isArray(cnDetailResult?.images)
        ? cnDetailResult.images.filter(
            (item: any) => typeof item?.url === "string" && item.url,
          )
        : [];
      const assets: GeneratedAsset[] = images.map((item: any) => ({
        id: `asset-${Date.now()}-${Math.random()}`,
        type: "image",
        url: item.url,
        metadata: {
          prompt: item.title || "国内电商中文详情页",
          model: defaults.model || "nanobanana2",
          agentId: this.agentInfo.id,
        },
      }));
      const imageUrls = assets.map((asset) => asset.url);

      return {
        ...task,
        status: "completed",
        output: buildAgentTaskOutput({
          message:
            imageUrls.length > 0
              ? `已为你生成 ${imageUrls.length} 张国内电商中文详情页分屏图。`
              : "本次未生成有效图片，请调整需求后重试。",
          analysis: "已按中文详情页结构（KV、卖点、参数、场景、对比、转化）执行。",
          proposals: [],
          assets,
          skillCalls: [
            {
              skillName: "cnDetailPage",
              params: {
                count: Number(defaults.count ?? 6),
                aspectRatio: String(defaults.aspectRatio || "3:4"),
                imageSize: defaults.imageSize || "2K",
                model: defaults.model || "nanobanana2",
                promptVersion,
                textMode,
                ratioMode,
                fixedAspectRatio,
                qualityThreshold,
                replacementBudget,
                retryPolicy,
              },
              result: cnDetailResult,
            },
          ],
          adjustments:
            imageUrls.length > 0
              ? [
                  "继续细化卖点分屏",
                  "改成更强转化风格",
                  "替换场景氛围",
                  "重新生成",
                ]
              : ["上传更清晰的产品图", "补充更具体的卖点要求"],
          runtime: buildSkillExecutionRuntimeEnvelope({
            assets,
            skillResults: [
              {
                skillName: "cnDetailPage",
                params: {
                  count: Number(defaults.count ?? 6),
                  aspectRatio: String(defaults.aspectRatio || "3:4"),
                  imageSize: defaults.imageSize || "2K",
                  model: defaults.model || "nanobanana2",
                  promptVersion,
                  textMode,
                  ratioMode,
                  fixedAspectRatio,
                  qualityThreshold,
                  replacementBudget,
                  retryPolicy,
                },
                result: cnDetailResult,
                success: imageUrls.length > 0,
              },
            ],
            proposals: [],
          }),
        }),
        updatedAt: Date.now(),
      };
    }

    const fixSkillCalls = (obj: any) => {
      if (!obj || typeof obj !== "object") return;
      const keys = Object.keys(obj);
      for (const key of keys) {
        const lowerKey = key.toLowerCase();
        const isSkillKey = [
          "skillcalls",
          "skills",
          "calls",
          "actions",
          "tool_calls",
          "skill_calls",
        ].includes(lowerKey);
        if (isSkillKey && Array.isArray(obj[key]) && obj[key].length > 0) {
          if (!obj.skillCalls || obj.skillCalls.length === 0) {
            obj.skillCalls = obj[key];
          }
        }
      }
    };

    let plan: any;
    const workflowMode =
      task.input.metadata?.workflowMode === "fast" ? "fast" : "designer";
    const requestedCount = this.parseRequestedImageCount(message);
    const bypassFastPath = this.shouldBypassFastPath(message);
    const shouldUseFastPath =
      workflowMode === "fast" &&
      forceImageToolCall &&
      !bypassFastPath;

    store.actions.setCurrentTask({
      ...task,
      status: "analyzing",
      progressMessage: "正在分析需求并制定执行方案...",
      progressStep: 2,
      totalSteps: 4,
    });

    if (shouldUseFastPath) {
      const directCall = buildForcedGenerateImageCall(
        message,
        task.input.attachments,
        task.input.metadata,
      );
      directCall.params.prompt = this.sanitizeSingleFramePrompt(
        directCall.params.prompt || "",
      );
      plan = {
        analysis: "已识别为快速生图模式，跳过方案沟通并直接执行。",
        preGenerationMessage: "已收到需求，正在快速生成视觉稿。",
        postGenerationSummary: "本次快速模式已完成基础构图与视觉输出，可继续精修。",
        message: "好的，正在根据你的需求直接开始生成。",
        skillCalls: [directCall],
        proposals: [],
        suggestions: ["换个风格重试", "改成其他比例"],
      };
    } else {
      try {
        plan = await this.analyzeAndPlan(
          message,
          context,
          task.input.attachments,
          task.input.uploadedAttachments,
          {
            ...(task.input.metadata || {}),
            taskId: task.id,
            forceImageToolCall,
          },
        );
      } catch (error) {
        console.error(`[${this.agentInfo.id}] analyzeAndPlan failed:`, error);
        if (!forceImageToolCall) {
          throw error;
        }

        if (requestedCount > 1 || bypassFastPath) {
          const fallbackCount = Math.max(requestedCount, 5);
          plan = {
            analysis: "分析阶段超时，已自动切换为多图拆解兜底执行。",
            preGenerationMessage: `正在为你拆解并并行生成 ${fallbackCount} 张独立图片。`,
            postGenerationSummary: "本次已按单图策略拆解生成，可继续逐张微调。",
            message: `已按多图需求拆解为 ${fallbackCount} 个独立画面并开始生成。`,
            skillCalls: this.buildMultiImageFallbackCalls(
              message,
              fallbackCount,
              task.input.attachments,
              task.input.metadata,
            ),
            proposals: [],
          };
        } else {
          plan = {
            analysis: "分析阶段超时，已为你进入安全降级的直接出图流程。",
            preGenerationMessage:
              "我已理解你的设计目标，先为你生成首版视觉稿，随后给出设计复盘。",
            postGenerationSummary:
              "首版已完成，后续可按风格、构图和光影继续微调。",
            message: "分析稍慢，我先为你生成第一版图像。",
            skillCalls: [
              buildForcedGenerateImageCall(
                message,
                task.input.attachments,
                task.input.metadata,
              ),
            ],
            proposals: [],
          };
        }
      }
    }

    fixSkillCalls(plan);
    if (Array.isArray(plan.proposals)) {
      plan.proposals.forEach(fixSkillCalls);
    }

    if (!plan.preGenerationMessage && forceImageToolCall) {
      plan.preGenerationMessage = this.composePreGenerationMessage(task, plan);
    }

    const requestedCountFromMessage = this.parseRequestedImageCount(message);
    const shouldSuppressAutonomousSkillExecution =
      this.shouldSuppressAutonomousSkillExecution(task);

    if (shouldSuppressAutonomousSkillExecution) {
      return {
        ...task,
        status: "completed",
        output: {
          message: plan.message || plan.analysis || "已完成本轮响应。",
          analysis: plan.analysis,
          proposals: [],
          assets: [],
          adjustments: plan.suggestions || [],
        },
        updatedAt: Date.now(),
      };
    }

    let activeSkillCalls = Array.isArray(plan.skillCalls)
      ? [...plan.skillCalls]
      : [];

    if (activeSkillCalls.length === 0 && forceImageToolCall) {
      activeSkillCalls =
        requestedCountFromMessage > 1
          ? this.buildMultiImageFallbackCalls(
              message,
              requestedCountFromMessage,
              task.input.attachments,
              task.input.metadata,
            )
          : [
              buildForcedGenerateImageCall(
                message,
                task.input.attachments,
                task.input.metadata,
              ),
            ];
    }

    const selectedSkillCalls = Array.isArray(
      task.input.metadata?.selectedSkillCalls,
    )
      ? task.input.metadata.selectedSkillCalls
      : [];
    if (selectedSkillCalls.length > 0) {
      activeSkillCalls = [...selectedSkillCalls];
    }

    if (requestedCountFromMessage > 1) {
      if (activeSkillCalls.length <= 1) {
        activeSkillCalls = this.buildMultiImageFallbackCalls(
          message,
          requestedCountFromMessage,
          task.input.attachments,
          task.input.metadata,
        );
      }

      activeSkillCalls = activeSkillCalls.map((call: any) => {
        if (isImageGenerationSkillName(call?.skillName)) {
          call.params = call.params || {};
          call.params.prompt = this.sanitizeSingleFramePrompt(
            call.params.prompt || "",
          );
        }
        return call;
      });
    }

    const preferredImageCount = this.getPreferredImageCount(
      task.input.metadata,
    );
    if (requestedCountFromMessage <= 1 && preferredImageCount > 1) {
      activeSkillCalls = this.expandPreferredImageCountCalls(
        activeSkillCalls,
        preferredImageCount,
      );
    }

    let skillResults: any[] = [];
    if (activeSkillCalls.length > 0) {
      const imageCount = activeSkillCalls.filter((c) =>
        isImageGenerationSkillName(c.skillName),
      ).length;
      const videoCount = activeSkillCalls.filter((c) =>
        isVideoGenerationSkillName(c.skillName),
      ).length;
      const genDesc =
        imageCount > 0
          ? `${imageCount} 张图片`
          : videoCount > 0
            ? `${videoCount} 个视频`
            : "内容";

      store.actions.setCurrentTask({
        ...task,
        status: "executing",
        progressMessage:
          plan.preGenerationMessage || `方案已就绪，正在生成${genDesc}...`,
        progressStep: 3,
        totalSteps: 4,
      });

      skillResults = await this.executeSkills(activeSkillCalls, task);
    }

    const assets = this.extractAssets(skillResults);
    const assetUrls = assets.map((asset) => asset.url);

    if (assets.length > 0) {
      store.actions.setCurrentTask({
        ...task,
        status: "executing",
        progressMessage: `已生成 ${assets.length} 项结果，正在整理并同步到画布...`,
        progressStep: 4,
        totalSteps: 4,
      });
    }

    let finalMessage =
      assets.length > 0
        ? plan.message ||
          `我已经根据方案为你生成了 ${assets.length} 张图片，并添加到了画布。`
        : plan.message || plan.analysis || "任务已完成。";

    const postGenerationSummary =
      plan.postGenerationSummary ||
      (assets.length > 0
        ? this.composePostGenerationSummary(task, plan, assets.length)
        : undefined);

    if (assets.length > 0 && postGenerationSummary) {
      finalMessage = `${finalMessage}\n\n${postGenerationSummary}`;
    }

    finalMessage = finalMessage
      .replace(/```json:generation\s*[\s\S]*?```/g, "")
      .trim();

    const effectivePlan = finalizeRoleGovernancePlan({
      task,
      finalPlan: plan,
    });
    const roleGovernanceAudit =
      effectivePlan?.roleGovernanceAudit &&
      Array.isArray(effectivePlan.roleGovernanceAudit.actions)
        ? effectivePlan.roleGovernanceAudit
        : undefined;

    const currentProgressTask = useAgentStore.getState().currentTask;
    const finalProgressTask =
      currentProgressTask?.id === task.id ? currentProgressTask : null;
    store.actions.setCurrentTask(null);

    return {
      ...task,
      status: "completed",
      progressMessage: finalProgressTask?.progressMessage,
      progressStep: finalProgressTask?.progressStep,
      totalSteps: finalProgressTask?.totalSteps,
      progressLog: finalProgressTask?.progressLog,
      thoughtTrace: finalProgressTask?.thoughtTrace,
      streamingText: finalProgressTask?.streamingText,
      reasoningText: finalProgressTask?.reasoningText,
      output: buildAgentTaskOutput({
        message: finalMessage,
        analysis: effectivePlan.analysis,
        preGenerationMessage: effectivePlan.preGenerationMessage,
        postGenerationSummary,
        proposals: [],
        assets,
        skillCalls: skillResults,
        adjustments:
          assets.length > 0
            ? this.getAdjustments(message, [])
            : effectivePlan.suggestions || [],
        roleGovernanceAudit,
        runtime: buildSkillExecutionRuntimeEnvelope({
          assets,
          skillResults,
          proposals: [],
        }),
      }),
      updatedAt: Date.now(),
    };
  }

  private async executeAutonomousMainBrainTask(
    task: AgentTask,
  ): Promise<AgentTask> {
    const store = useAgentStore.getState();

    store.actions.setCurrentTask(
      buildMainBrainTaskProgressUpdate(
        task,
        "understand",
        "正在读取需求、附件和工作区状态...",
      ),
    );

    const runtimeResult = await runMainBrainRuntime({
      task,
      analyzeAndPlan: (message, context, attachments, uploadedAttachments, metadata) =>
        this.analyzeAndPlan(
          message,
          context,
          attachments,
          uploadedAttachments,
          metadata,
        ),
      executeSkills: (skillCalls, runtimeTask) =>
        this.executeSkills(skillCalls, runtimeTask),
      extractAssets: (skillResults) => this.extractAssets(skillResults),
      onPhaseChange: (phase, detail) => {
        store.actions.setCurrentTask(
          buildMainBrainTaskProgressUpdate(task, phase, detail.summary),
        );
      },
    });

    const finalPlan = runtimeResult.finalPlan || {};
    const assets = runtimeResult.allAssets;
    const effectiveFinalPlan = finalizeRoleGovernancePlan({
      task,
      finalPlan,
    });
    const resolvedOutput = resolveMainBrainOutput({
      task,
      runtimeResult,
      finalPlan: effectiveFinalPlan,
      assets,
      getAdjustments: (message, proposals) =>
        this.getAdjustments(message, proposals),
      composePostGenerationSummary: (currentTask, plan, assetCount) =>
        this.composePostGenerationSummary(currentTask, plan, assetCount),
    });

    const currentProgressTask = useAgentStore.getState().currentTask;
    const finalProgressTask =
      currentProgressTask?.id === task.id ? currentProgressTask : null;
    store.actions.setCurrentTask(null);

    return {
      ...task,
      status: "completed",
      progressMessage: finalProgressTask?.progressMessage,
      progressStep: finalProgressTask?.progressStep,
      totalSteps: finalProgressTask?.totalSteps,
      progressLog: finalProgressTask?.progressLog,
      thoughtTrace: finalProgressTask?.thoughtTrace,
      streamingText: finalProgressTask?.streamingText,
      reasoningText: finalProgressTask?.reasoningText,
      output: buildMainBrainTaskOutput({
        finalPlan: effectiveFinalPlan,
        assets,
        runtimeResult,
        resolvedOutput,
      }),
      updatedAt: Date.now(),
    };
  }

  /**
   * 鍒嗘瀽浠诲姟骞跺埗瀹氭墽琛岃鍒?
   */
  private async analyzeAndPlan(
    message: string,
    context: ProjectContext,
    attachments?: File[],
    uploadedAttachments?: string[],
    metadata?: Record<string, any>,
  ): Promise<any> {
    try {
      const allowAutonomousRouting = metadata?.allowAutonomousRouting === true;
      const repairMessageId =
        String(metadata?.messageId || metadata?.taskId || "").trim() ||
        undefined;
      const forceImageToolCall = this.shouldForceImageToolCall(
        message,
        metadata,
      );

        const promptBuild = buildAnalyzePlanPrompt({
          agentId: this.agentInfo.id,
          systemPrompt: resolveAnalyzePlanSystemPrompt({
            agentId: this.agentInfo.id,
            fallbackSystemPrompt: this.systemPrompt,
            metadata,
          }),
          preferredSkills: mergePreferredSkillsWithFrontstageProfile(
            this.preferredSkills,
            metadata,
          ),
          message,
          context,
          attachments,
          uploadedAttachments,
        metadata,
        forceImageToolCall,
        allowAutonomousRouting,
      });
      const fullPrompt = promptBuild.fullPrompt;
      const MAX_PROMPT_CHARS = 240000;
      const safePrompt =
        fullPrompt.length > MAX_PROMPT_CHARS
          ? fullPrompt.slice(0, MAX_PROMPT_CHARS) +
            '\n\n[提示：对话内容过长，后续已自动截断]'
          : fullPrompt;

      const attachmentInlineParts = (
        await Promise.all((attachments || []).map((file) => fileToInlinePart(file)))
      ).filter(Boolean) as InlineImagePart[];
      const inheritedReferenceInlineParts =
        attachmentInlineParts.length === 0 &&
        metadata?.multimodalContext?.isolateVisualQa !== true
          ? (
              await Promise.all(
                (metadata?.multimodalContext?.referenceImageUrls || [])
                  .filter((url: string) =>
                    /^https?:\/\//i.test(String(url || "")) ||
                    Boolean(normalizeImageDataUrlString(String(url || "")))
                  )
                  .filter(
                    (url: string, index: number, list: string[]) =>
                      list.indexOf(url) === index &&
                      !(uploadedAttachments || []).includes(url),
                  )
                  .slice(0, 3)
                  .map((url: string) => urlToInlinePart(url)),
              )
            ).filter(Boolean) as InlineImagePart[]
          : [];
      const parts: any[] = [
        { text: safePrompt },
        ...attachmentInlineParts,
        ...inheritedReferenceInlineParts,
      ];

      const selectedMode =
        metadata?.workflowMode === 'fast' ? 'fast' : 'thinking';
      const bestModel = getBestModelSelection(
        selectedMode === 'thinking' ? 'thinking' : 'text',
      );

      const payloadDiagnostics = {
        promptChars: safePrompt.length,
        historyCount: promptBuild.historyCount,
        historyUsed: promptBuild.historyCount,
        attachmentCount: attachments?.length || 0,
        uploadedAttachmentCount: metadata?.multimodalContext?.uploadedAttachmentCount || 0,
        inheritedReferenceInlineImageCount: inheritedReferenceInlineParts.length,
        includesInlineImages:
          attachmentInlineParts.length > 0 || inheritedReferenceInlineParts.length > 0,
        estimatedPayloadChars: JSON.stringify({ prompt: safePrompt }).length,
        model: bestModel.modelId,
        providerId: bestModel.providerId || null,
      };
      workspaceChatDebugLog(
        `[${this.agentInfo.id}] [analyzeAndPlan] payload diagnostics`,
        payloadDiagnostics,
      );

      const toolConfig: any = {};
      if (metadata?.enableWebSearch) {
        toolConfig.tools = [{ googleSearch: {} }];
      }

      const forcedSchema = forceImageToolCall && !allowAutonomousRouting
        ? {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            message: { type: Type.STRING },
            answerSegments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  citationOrdinals: {
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER },
                  },
                },
                required: ['text'],
              },
            },
            preGenerationMessage: { type: Type.STRING },
            postGenerationSummary: { type: Type.STRING },
            proposals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  skillCalls: {
                    type: Type.ARRAY,
                    minItems: 1,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        skillName: {
                          type: Type.STRING,
                          enum: ['generateImage'],
                        },
                        params: IMAGE_TOOL_PARAMS_SCHEMA,
                      },
                      required: ['skillName', 'params'],
                    },
                  },
                },
                required: ['id', 'title', 'description', 'skillCalls'],
              },
            },
            skillCalls: {
              type: Type.ARRAY,
              minItems: 1,
              items: {
                type: Type.OBJECT,
                properties: {
                  skillName: { type: Type.STRING, enum: ['generateImage'] },
                  params: IMAGE_TOOL_PARAMS_SCHEMA,
                },
                required: ['skillName', 'params'],
              },
            },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        }
        : undefined;

      const response = await withTimeout(
        retryMainBrainOperation({
          operation: async () => {
            let streamedText = "";
            let streamedReasoning = "";
            workspaceChatDebugLog(
              `[analyzeAndPlan] [${selectedMode}] requesting model: ${bestModel.modelId} @ ${bestModel.providerId || 'default'}`,
            );
            return generateJsonResponse({
              model: bestModel.modelId,
              providerId: bestModel.providerId || undefined,
              parts,
              temperature: forceImageToolCall && !allowAutonomousRouting ? 0.2 : 0.7,
              ...(forcedSchema ? { responseSchema: forcedSchema } : {}),
              ...(toolConfig?.tools ? { tools: toolConfig.tools } : {}),
              operation: `${this.agentInfo.id}.analyzeAndPlan`,
              onTextDelta: (delta) => {
                streamedText += String(delta || "");
                const currentTask = useAgentStore.getState().currentTask;
                if (!currentTask) return;
                const visibleThoughtTrace = extractVisibleThoughtTrace(streamedText);
                useAgentStore.getState().actions.setCurrentTask({
                  ...currentTask,
                  streamingText: streamedText,
                  reasoningText: streamedReasoning,
                  thoughtTrace:
                    visibleThoughtTrace.length > 0
                      ? visibleThoughtTrace
                      : currentTask.thoughtTrace || [],
                  progressMessage:
                    currentTask.progressMessage || "正在生成回复...",
                });
              },
              onReasoningDelta: (delta) => {
                streamedReasoning += String(delta || "");
                const currentTask = useAgentStore.getState().currentTask;
                if (!currentTask) return;
                const visibleThoughtTrace = extractVisibleThoughtTrace(streamedReasoning);
                useAgentStore.getState().actions.setCurrentTask({
                  ...currentTask,
                  streamingText: streamedText,
                  reasoningText: streamedReasoning,
                  thoughtTrace:
                    visibleThoughtTrace.length > 0
                      ? visibleThoughtTrace
                      : currentTask.thoughtTrace || [],
                });
              },
            });
          },
          label: `${this.agentInfo.id}.analyzeAndPlan`,
          maxRetries: 3,
        }),
        120000,
        'analyzeAndPlan timeout',
      ) as any;
      workspaceChatDebugLog(
        `[${this.agentInfo.id}] [analyzeAndPlan] response received`,
        {
          textLength: response?.text ? String(response.text).length : 0,
          textPreview:
            response?.text
              ? String(response.text).slice(0, 200)
              : null,
        },
      );

      const parsedPlan = normalizeAgentJsonResponse(response.text || '{}');
        const normalizedThoughtTrace = Array.isArray(parsedPlan?.thoughtTrace)
          ? parsedPlan.thoughtTrace
              .map((item: unknown) => String(item || "").trim())
              .filter(Boolean)
          : [];
        if (normalizedThoughtTrace.length > 0) {
          const currentTask = useAgentStore.getState().currentTask;
          if (currentTask) {
            useAgentStore.getState().actions.setCurrentTask({
              ...currentTask,
              thoughtTrace: normalizedThoughtTrace,
            });
          }
        }
        normalizePlannedMarkerSmartEditCalls({
          parsedPlan,
          attachments,
          uploadedAttachments,
        });
        const repairedPlan = repairAutonomousSkillPlan({
          plan: parsedPlan,
          originalMessage: message,
          attachments,
          metadata,
          conversationHistory: context?.conversationHistory,
          onRepair: async (event) => {
            try {
              const mod = await import('../skills/runtime/agent-task-skill-run-bridge.ts');
              mod.recordRepairEventByMessageId({
                messageId: repairMessageId,
                conversationId: (metadata as any)?.conversationId,
                event: {
                  reason:
                    event.kind === 'backfill'
                      ? 'backfill: ' + event.injectedSkillNames.join(',')
                      : 'fallback: ' + event.reason,
                  injectedSkillNames:
                    event.kind === 'backfill'
                      ? event.injectedSkillNames
                      : event.firstSkillName
                      ? [event.firstSkillName]
                      : undefined,
                  skillCallsBefore:
                    event.kind === 'backfill' ? event.skillCallsBefore : undefined,
                  skillCallsAfter: event.skillCallsAfter,
                  fallbackUsed: event.kind === 'fallback',
                },
              });
            } catch {
              // best effort: repair recording must never block execution
            }
          },
        });

        if (forceImageToolCall) {
          ensureForcedImagePlan({
            parsedPlan: repairedPlan,
            message,
            attachments,
            metadata,
          });
        }

      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks && groundingChunks.length > 0) {
        const sources = groundingChunks
          .map((chunk: any) => {
            if (chunk.web) {
              return `[${chunk.web.title}](${chunk.web.uri})`;
            }
            return null;
          })
          .filter((s: any) => s) as string[];

          if (sources.length > 0) {
            const sourceText = `\n\n**参考来源**\n${sources
              .map((s: string) => `- ${s}`)
              .join("\n")}`;
            if (repairedPlan.message) {
              repairedPlan.message += sourceText;
            }
            if (repairedPlan.analysis) {
              repairedPlan.analysis += sourceText;
            }
          }
        }

        return repairedPlan;
    } catch (error) {
      throw errorHandler.handleError(error, {
        agent: this.agentInfo.id,
        function: 'analyzeAndPlan',
      });
    }
  }

  protected async executeSkills(
    skillCalls: any[],
    task: AgentTask,
  ): Promise<any[]> {
    const normalizedCalls = prioritizeSkillCallsForFrontstageProfile(
      normalizeSkillCalls(skillCalls || []),
      task.input.metadata,
    );
    const stopProgress = this.startSkillExecutionProgress(task, normalizedCalls);

    try {
      if (
        shouldExecuteFrontstageSkillSequentially({
          skillCalls: normalizedCalls,
          metadata: task.input.metadata,
        })
      ) {
        const results: any[] = [];
        for (const call of normalizedCalls) {
          const hydratedCall = hydrateSkillCallWithFrontstageProfile({
            call,
            metadata: task.input.metadata,
            originalMessage: task.input.message,
            priorResults: results,
          });
          try {
            const result = await this.executeSingleSkillCall(
              hydratedCall,
              results.length,
              task,
            );
            results.push(buildSuccessfulSkillExecutionResult(hydratedCall, result));
          } catch (error) {
            const appError = errorHandler.handleError(error, {
              skill: hydratedCall?.skillName,
              agent: this.agentInfo.id,
            });
            results.push(
              buildFailedSkillExecutionResult(
                hydratedCall,
                appError.message,
                extractSkillErrorDetail(appError) || extractSkillErrorDetail(error),
              ),
            );
          }
        }
        return results;
      }

      const jobs = normalizedCalls.map((call, callIndex) => async () => {
        const hydratedCall = hydrateSkillCallWithFrontstageProfile({
          call,
          metadata: task.input.metadata,
          originalMessage: task.input.message,
        });
        try {
          const result = await this.executeSingleSkillCall(
            hydratedCall,
            callIndex,
            task,
          );
          return buildSuccessfulSkillExecutionResult(hydratedCall, result);
        } catch (error) {
          const appError = errorHandler.handleError(error, {
            skill: hydratedCall?.skillName,
            agent: this.agentInfo.id,
          });
          return buildFailedSkillExecutionResult(
            hydratedCall,
            appError.message,
            extractSkillErrorDetail(appError) || extractSkillErrorDetail(error),
          );
        }
      });

      const settled = await runWithConcurrency(jobs, this.maxConcurrency);
      return normalizeSettledSkillExecutionResults(settled);

    } finally {
      stopProgress?.();
    }
  }

  private async executeSingleSkillCall(
    call: any,
    callIndex: number,
    task: AgentTask,
  ): Promise<any> {
    console.log(
      `[${this.agentInfo.id}] [executeSkills] 解析技能参数: ${call.skillName}`,
      { params: call.params, editType: call.params?.editType, prompt: call.params?.prompt?.slice(0, 200), model: call.params?.model },
    );
    if (call.skillName === "generateImage") {
      console.info(
        `[${this.agentInfo.id}] [imggen] planner-request`,
        buildNegotiatedImageExecutionTrace(call.params),
      );
    }

    const prepared = await prepareSkillExecutionCall({
      call,
      task,
      callIndex,
      maxReferenceImages: MAX_REFERENCE_IMAGES,
    });

    const telemetry = buildReferenceInjectionTelemetry({
      prepared,
      call,
      task,
      maxReferenceImages: MAX_REFERENCE_IMAGES,
    });

    if (telemetry?.warningMessage) {
      console.warn(`[${this.agentInfo.id}] ${telemetry.warningMessage}`);
    }

    if (telemetry) {
      console.info(
        `[${this.agentInfo.id}] reference injection stats`,
        telemetry.stats,
      );
    }

    if (call.skillName === "generateImage") {
      const preparedParams = {
        ...(call.params || {}),
        signal: task.input.metadata?.signal,
      };
      console.info(
        `[${this.agentInfo.id}] [imggen] prepared-request`,
        buildNegotiatedImageExecutionTrace(preparedParams),
      );
      preparedParams.onTransportPrepared = (snapshot: any) => {
        console.info(
          `[${this.agentInfo.id}] [imggen] transport-prepared`,
          {
            requested: buildNegotiatedImageExecutionTrace(preparedParams),
            resolvedModel: snapshot?.resolvedModel || null,
            resolvedAspectRatio: snapshot?.resolvedAspectRatio || null,
            resolvedSize: snapshot?.resolvedSize || null,
            providerId: snapshot?.providerId || null,
            route: snapshot?.effectiveRoute || snapshot?.route || null,
            requestMode: snapshot?.requestMode || null,
            payloadMode: snapshot?.payloadMode || null,
            warnings: Array.isArray(snapshot?.warnings)
              ? snapshot.warnings.map((item: any) => ({
                  code: item?.code || null,
                  message: item?.message || null,
                }))
              : [],
          },
        );
      };
      preparedParams.onSubmitted = (payload: any) => {
        console.info(
          `[${this.agentInfo.id}] [imggen] submitted`,
          {
            taskId: payload?.taskId || null,
            providerId: payload?.providerId || null,
            model: payload?.model || null,
            route: payload?.route || null,
            transport: payload?.transportRequestSnapshot
              ? {
                  resolvedModel:
                    payload.transportRequestSnapshot.resolvedModel || null,
                  resolvedAspectRatio:
                    payload.transportRequestSnapshot.resolvedAspectRatio || null,
                  resolvedSize:
                    payload.transportRequestSnapshot.resolvedSize || null,
                  effectiveRoute:
                    payload.transportRequestSnapshot.effectiveRoute || null,
                  requestMode:
                    payload.transportRequestSnapshot.requestMode || null,
                  payloadMode:
                    payload.transportRequestSnapshot.payloadMode || null,
                  warnings: Array.isArray(
                    payload.transportRequestSnapshot.warnings,
                  )
                    ? payload.transportRequestSnapshot.warnings.map(
                        (item: any) => ({
                          code: item?.code || null,
                          message: item?.message || null,
                        }),
                      )
                    : [],
                }
              : null,
          },
        );
      };

      return executeSkillWithTimeout({
        skillName: call.skillName,
        params: preparedParams,
        timeoutMs: resolveSkillTimeoutMs(call.skillName),
        executeSkillFn: executeSkill,
      });
    }

    return executeSkillWithTimeout({
      skillName: call.skillName,
      params: {
        ...(call.params || {}),
        signal: task.input.metadata?.signal,
      },
      timeoutMs: resolveSkillTimeoutMs(call.skillName),
      executeSkillFn: executeSkill,
    });
  }

  /**
   * 浠庢妧鑳界粨鏋滀腑鎻愬彇璧勪骇
   */
  protected extractAssets(skillCalls: any[]): GeneratedAsset[] {
    // 璁板綍澶辫触鐨?skillCalls 浠ヤ究璋冭瘯
    const failed = skillCalls.filter((s) => !s.success);
    if (failed.length > 0) {
      console.warn(
        `[${this.agentInfo.id}] ${failed.length} skill calls failed:`,
        failed.map((s) => `${s.skillName}: ${s.error}`),
      );
    }

    const videoAssets = skillCalls
      .filter(
        (s) =>
          s.success &&
          s.result &&
          isAssetProducingSkillName(s.skillName) &&
          isVideoGenerationSkillName(s.skillName) &&
          typeof s.result === "string",
      )
      .map((s) => ({
        id: `asset-${Date.now()}-${Math.random()}`,
        type: "video" as const,
        url: s.result,
        metadata: {
          prompt: s.params?.prompt || s.params?.editType || "",
          model: s.params?.model || "edit",
          agentId: this.agentInfo.id,
        },
      }));

    const imageAssets = buildImageAssetsFromSkillResults(
      skillCalls.filter((s) =>
        s.success &&
        s.result &&
        isAssetProducingSkillName(s.skillName) &&
        !isVideoGenerationSkillName(s.skillName),
      ),
      this.agentInfo.id,
    );

    return [...imageAssets, ...videoAssets];
  }

  /**
   * 鏍规嵁浠诲姟绫诲瀷鍔ㄦ€佺敓鎴愬揩鎹锋搷浣滄寜閽?
   */
  private getAdjustments(message: string, proposals: any[]): string[] {
    const isEdit =
      /鎹㈡垚|鏀规垚|鏀逛负|鏇挎崲|淇敼|璋冩暣|鍘绘帀|鍒犻櫎|绉婚櫎|鍘婚櫎|鍘昏儗鏅瘄鎹㈣儗鏅瘄鎹㈤鑹瞸鏀归鑹瞸recolor|remove|replace/i.test(
        message,
      );

    if (isEdit) {
      return ["继续微调", "一键抠图", "提升画质", "尝试不同配色"];
    }

    const isLandscape = /(妯増|妯睆|瀹藉睆|16:9|landscape)/i.test(message);
    const isPortrait = /(绔栫増|绔栧睆|鎵嬫満灞弢9:16|portrait)/i.test(message);
    const isSquare = /(鏂瑰浘|1:1|姝ｆ柟褰square)/i.test(message);

    const suggestions = [];
    if (isLandscape) suggestions.push("换成竖版");
    else if (isPortrait) suggestions.push("换成横版");
    else suggestions.push("尝试横版", "尝试竖版");

    suggestions.push("换个风格", "换个配色", "重新生成");

    return suggestions.slice(0, 4);
  }

  private composePreGenerationMessage(task: AgentTask, plan: any): string {
    const uploaded = task.input.uploadedAttachments || [];
    const ctxRefs =
      task.input.metadata?.multimodalContext?.referenceImageUrls || [];
    const refCount = Math.max(uploaded.length, ctxRefs.length);
    const styleHint =
      typeof plan?.analysis === "string" && plan.analysis.trim().length > 0
        ? plan.analysis.trim().slice(0, 48)
        : "电影质感与高级商业构图";

    if (refCount > 0) {
      return `我看到了您上传的 ${refCount} 张参考图，接下来我会围绕主体特征进行设计，并按“${styleHint}”这个方向完成本次视觉稿。`;
    }

    return `我已理解您的需求，接下来我会以“${styleHint}”为核心，先完成一版主视觉，并保证构图与氛围统一。`;
  }

  private composePostGenerationSummary(
    task: AgentTask,
    plan: any,
    assetCount: number,
  ): string {
    const hasRefs =
      (task.input.uploadedAttachments?.length || 0) > 0 ||
      (task.input.metadata?.multimodalContext?.referenceImageUrls?.length || 0) >
      0;
    const lighting = /澶滄櫙|cinematic|鐢靛奖|neon|闇撹櫣/i.test(
      task.input.message || "",
    )
      ? "光影层次更偏电影感"
      : "光线分布更强调主体识别";
    const colorTone = /暖|warm|金|gold/i.test(task.input.message || "")
      ? "色调偏暖，氛围更亲和"
      : "色调控制在清爽且耐看的商业区间";

    const planTail =
      typeof plan?.analysis === "string" && plan.analysis.trim().length > 0
        ? `，并延续了“${plan.analysis.trim().slice(0, 24)}”的设计目标`
        : "";

    return `设计复盘：本次共输出 ${assetCount} 张结果，${lighting}，${colorTone}，构图重点突出核心信息${planTail}${hasRefs ? "，并保持了与参考图主体的一致性" : ""}。`;
  }

  /**
   * 瑙ｆ瀽鍝嶅簲
   */
  protected parseResponse(response: string): any {
    return normalizeAgentJsonResponse(response);
  }

  private validateInput(task: AgentTask): void {
    if (!task.input.message || !task.input.message.trim()) {
      throw errorHandler.createError(
        ErrorType.VALIDATION,
        "任务消息不能为空",
        undefined,
        { taskId: task.id },
        false,
      );
    }

    if (!task.input.context) {
      throw errorHandler.createError(
        ErrorType.VALIDATION,
        "任务上下文缺失",
        undefined,
        { taskId: task.id },
        false,
      );
    }
  }

  /**
   * 鏇存柊浠诲姟鐘舵€?
   */
  private updateTaskStatus(
    task: AgentTask,
    status: AgentTask["status"],
  ): AgentTask {
    return {
      ...task,
      status,
      updatedAt: Date.now(),
    };
  }

  /**
   * 缂撳瓨缁撴灉锛堝甫TTL锛?
   */
  private cacheResult(task: AgentTask, result: AgentTask): void {
    const key = this.getCacheKey(task);
    this.executionCache.set(key, { result, timestamp: Date.now() });
  }

  /**
   * 鑾峰彇缂撳瓨缁撴灉锛堝甫TTL妫€鏌ワ級
   */
  private getCachedResult(task: AgentTask): AgentTask | null {
    const key = this.getCacheKey(task);
    const cached = this.executionCache.get(key);
    if (!cached) return null;

    // TTL: 5鍒嗛挓杩囨湡
    const CACHE_TTL = 5 * 60 * 1000;
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.executionCache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * 鐢熸垚缂撳瓨閿紙鑰冭檻闄勪欢鍜屼笂涓嬫枃锛?
   * 甯﹂檮浠剁殑璇锋眰涓嶇紦瀛橈紙姣忔閮芥槸鏂扮殑鍒涗綔鎰忓浘锛?
   */
  private getCacheKey(task: AgentTask): string {
    // 甯﹂檮浠剁殑璇锋眰涓嶇紦瀛?
    if (task.input.attachments && task.input.attachments.length > 0) {
      return `nocache-${Date.now()}-${Math.random()}`;
    }
    const meta = task.input.metadata || {};
    const skillId =
      typeof meta.skillData?.id === "string" && meta.skillData.id.trim()
        ? meta.skillData.id.trim()
        : typeof meta.skillData?.name === "string"
          ? meta.skillData.name.trim()
          : "";
    const metaKey = [
      `web:${!!meta.enableWebSearch}`,
      `force:${!!meta.forceSkills}`,
      `workflow:${meta.workflowMode === "fast" ? "fast" : "designer"}`,
      `task:${typeof meta.taskMode === "string" ? meta.taskMode : ""}`,
      `creation:${typeof meta.creationMode === "string" ? meta.creationMode : ""}`,
      `skill:${skillId}`,
    ].join("|");
    const contextHash = task.input.context?.projectTitle || "";
    return `${this.agentInfo.id}:${task.input.message}:${contextHash}:${metaKey}`;
  }

  /**
   * 閲嶇疆鏅鸿兘浣?
   */
  reset(): void {
    this.chat = null;
    this.executionCache.clear();
  }
}
