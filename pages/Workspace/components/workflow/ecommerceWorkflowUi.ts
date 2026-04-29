import type { ChatMessage } from "../../../../types";
import type { EcommerceOneClickSessionState } from "../../../../stores/ecommerceOneClick.store";
import type { EcommerceWorkflowStep } from "../../../../types/workflow.types";

export type EcommercePublicStageId =
  | "INPUT"
  | "ANALYZE"
  | "PLAN"
  | "GENERATE";

export const ECOMMERCE_PUBLIC_STAGE_ORDER: EcommercePublicStageId[] = [
  "INPUT",
  "ANALYZE",
  "PLAN",
  "GENERATE",
];

export const ECOMMERCE_PUBLIC_STAGE_META: Record<
  EcommercePublicStageId,
  {
    label: string;
    detail: string;
    internalSteps: EcommerceWorkflowStep[];
  }
> = {
  INPUT: {
    label: "上传商品",
    detail: "上传商品图并建立本轮商品上下文。",
    internalSteps: ["WAIT_PRODUCT"],
  },
  ANALYZE: {
    label: "理解商品",
    detail: "分析商品、补齐信息、筛参考图。",
    internalSteps: ["ANALYZE_PRODUCT", "SUPPLEMENT_INFO", "ANALYZE_IMAGES"],
  },
  PLAN: {
    label: "规划方案",
    detail: "整理方案并把执行提示词定稿。",
    internalSteps: ["PLAN_SCHEMES", "FINALIZE_PROMPTS"],
  },
  GENERATE: {
    label: "生成结果",
    detail: "执行批量生成并筛选最终结果。",
    internalSteps: ["BATCH_GENERATE", "DONE"],
  },
};

export const getEcommercePublicStageId = (
  step: EcommerceWorkflowStep,
): EcommercePublicStageId => {
  if (step === "WAIT_PRODUCT") return "INPUT";
  if (
    step === "ANALYZE_PRODUCT" ||
    step === "SUPPLEMENT_INFO" ||
    step === "ANALYZE_IMAGES"
  ) {
    return "ANALYZE";
  }
  if (step === "PLAN_SCHEMES" || step === "FINALIZE_PROMPTS") {
    return "PLAN";
  }
  return "GENERATE";
};

export const getEcommercePublicStageIndex = (
  step: EcommerceWorkflowStep,
): number => ECOMMERCE_PUBLIC_STAGE_ORDER.indexOf(getEcommercePublicStageId(step));

export const resolveRepresentativeStepForPublicStage = (
  stage: EcommercePublicStageId,
  state: EcommerceOneClickSessionState,
): EcommerceWorkflowStep => {
  if (getEcommercePublicStageId(state.step) === stage) {
    return state.step;
  }

  switch (stage) {
    case "INPUT":
      return "WAIT_PRODUCT";
    case "ANALYZE":
      if (state.imageAnalyses.length > 0) return "ANALYZE_IMAGES";
      if (state.supplementFields.length > 0) return "SUPPLEMENT_INFO";
      return "ANALYZE_PRODUCT";
    case "PLAN":
      if (state.modelOptions.length > 0) return "FINALIZE_PROMPTS";
      return "PLAN_SCHEMES";
    case "GENERATE":
      if (state.results.length > 0) return "DONE";
      return "BATCH_GENERATE";
    default:
      return state.step;
  }
};

export const ECOMMERCE_STEP_HINTS: Record<
  string,
  {
    label: string;
    next: string;
    goal: string;
    input: string;
    output: string;
    impact: string;
  }
> = {
  WAIT_PRODUCT: {
    label: "等待商品资料",
    next: "上传 1 到 9 张商品图，并补一句商品说明。",
    goal: "建立本轮商品资料、平台目标和工作模式。",
    input: "商品图、商品说明、平台选择、快速/专业模式。",
    output: "可进入商品分析的基础上下文。",
    impact: "这里的信息会影响后续推荐类型、补充问题和方案风格。",
  },
  ANALYZE_PRODUCT: {
    label: "商品分析",
    next: "查看 AI 生成的商品分析与推荐出图类型。",
    goal: "判断商品定位、卖点重点和适合的图型组合。",
    input: "商品图、商品说明、平台模式、反馈意见。",
    output: "商品分析总结、推荐类型、复核意见。",
    impact: "确认后的类型会决定后续补充问题和方案规划方向。",
  },
  SUPPLEMENT_INFO: {
    label: "补充信息",
    next: "确认平台、卖点、风格和补充约束。",
    goal: "补齐 AI 无法仅靠图片判断的业务信息。",
    input: "卖点、人群、风格、尺寸、适用场景、补充图片。",
    output: "更完整的商品约束集合。",
    impact: "会直接影响图片分析判断、方案文案和最终提示词。",
  },
  ANALYZE_IMAGES: {
    label: "图片分析",
    next: "检查每张图的分析结果，并确认哪些图可作为参考图。",
    goal: "为每张图建立可用性判断，挑出最稳的参考图。",
    input: "商品图和补充约束。",
    output: "单图分析结果、可参考图标记、图片复核意见。",
    impact: "错误的参考图会直接导致后续方案和生成结果跑偏。",
  },
  PLAN_SCHEMES: {
    label: "方案规划",
    next: "调整方案内容，确认后进入提示词定稿。",
    goal: "把图型拆成可执行的分组方案和具体分镜。",
    input: "已选图型、图片分析、补充信息、平台目标。",
    output: "分组方案、分镜项、规划复核意见。",
    impact: "这里决定最终要生成什么图，也是后续批量队列的来源。",
  },
  FINALIZE_PROMPTS: {
    label: "提示词定稿",
    next: "可先批量整理提示词，也可直接开始批量生成，并沿途逐条微调。",
    goal: "把方案项整理成最终可执行提示词，并确认默认执行模型。",
    input: "方案结构、提示词草稿、平台目标、模型特性。",
    output: "可执行提示词和本轮默认模型配置。",
    impact: "这里会影响执行前输入质量，但不应阻止你先进入步骤七开跑。",
  },
  BATCH_GENERATE: {
    label: "批量生成",
    next: "查看任务进度，处理失败项，或继续预览新结果。",
    goal: "按已定稿方案批量执行生成，并及时处理失败归因。",
    input: "默认模型、最终提示词、参考图。",
    output: "批量任务状态、失败原因、持续增长的结果集。",
    impact: "失败任务的归因和重试策略会影响整体产出效率。",
  },
  DONE: {
    label: "结果评审",
    next: "筛选优选图、插入画布、下载结果，或继续补图。",
    goal: "像选片台一样比较版本、筛选优选图并导出。",
    input: "全部生成结果和批量任务来源。",
    output: "优选序列、已导出结果、可继续迭代的版本记录。",
    impact: "这里决定最终交付给用户或画布的结果集合。",
  },
};

const ECOMMERCE_STEP_CTA: Record<string, string> = {
  WAIT_PRODUCT: "开始上传",
  ANALYZE_PRODUCT: "查看类型",
  SUPPLEMENT_INFO: "补充信息",
  ANALYZE_IMAGES: "查看分析",
  PLAN_SCHEMES: "确认方案",
  FINALIZE_PROMPTS: "定稿提示词",
  BATCH_GENERATE: "查看进度",
  DONE: "查看结果",
};

export const getEcommerceWorkflowSummary = (
  state: EcommerceOneClickSessionState,
) => {
  const hint =
    ECOMMERCE_STEP_HINTS[state.step] || ECOMMERCE_STEP_HINTS.WAIT_PRODUCT;
  const planCount = state.planGroups.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );
  const doneJobs = state.batchJobs.filter((job) => job.status === "done").length;
  const failedJobs = state.batchJobs.filter(
    (job) => job.status === "failed",
  ).length;
  const progressDone = Math.max(0, state.progress.done || 0);
  const progressTotal = Math.max(0, state.progress.total || 0);
  const reviewedResults = state.results.filter(
    (item) => typeof item.review?.score === "number",
  );
  const bestResultScore =
    reviewedResults.length > 0
      ? Math.max(...reviewedResults.map((item) => item.review?.score || 0))
      : null;
  const highScoreResultCount = reviewedResults.filter(
    (item) => (item.review?.score || 0) >= 90,
  ).length;
  const progressPercent =
    progressTotal > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((progressDone / progressTotal) * 100)),
        )
      : 0;
  const hasData =
    state.productImages.length > 0 ||
    state.description.trim().length > 0 ||
    state.recommendedTypes.length > 0 ||
    state.supplementFields.length > 0 ||
    state.imageAnalyses.length > 0 ||
    state.planGroups.length > 0 ||
    state.batchJobs.length > 0 ||
    state.results.length > 0;
  const ctaLabel = !hasData
    ? "开始工作流"
    : state.step === "ANALYZE_PRODUCT"
      ? "确认推荐类型"
      : state.step === "SUPPLEMENT_INFO"
        ? "补齐关键信息"
        : state.step === "ANALYZE_IMAGES"
          ? "确认参考图"
          : state.step === "PLAN_SCHEMES"
            ? "确认方案并进入定稿"
            : state.step === "FINALIZE_PROMPTS"
              ? "确认提示词"
    : (state.step === "BATCH_GENERATE" || state.step === "DONE") &&
        failedJobs > 0
      ? "处理失败"
      : state.step === "BATCH_GENERATE" && state.results.length > 0
        ? "查看结果"
        : ECOMMERCE_STEP_CTA[state.step] || "继续处理";
  const statusText = !hasData
    ? "先进入工作流，再上传商品图和商品说明开始完整流程。"
    : state.step === "BATCH_GENERATE"
      ? failedJobs > 0
        ? `当前阶段：${hint.label}。已完成 ${doneJobs}/${state.batchJobs.length}，失败 ${failedJobs} 个任务。`
        : `当前阶段：${hint.label}。已完成 ${doneJobs}/${state.batchJobs.length}，可以继续查看结果。`
      : state.step === "DONE"
        ? failedJobs > 0
          ? `当前阶段：${hint.label}。当前已有 ${state.results.length} 张结果图，仍有 ${failedJobs} 个失败任务待处理。`
          : `当前阶段：${hint.label}。当前已有 ${state.results.length} 张结果图，可以继续筛选。`
        : `当前阶段：${hint.label}。下一步：${hint.next}`;

  return {
    hint,
    planCount,
    hasData,
    doneJobs,
    failedJobs,
    progressDone,
    progressTotal,
    progressPercent,
    bestResultScore,
    highScoreResultCount,
    progressText: state.progress.text || hint.next,
    ctaLabel,
    statusText,
    platformLabel:
      state.platformMode === "taobao"
        ? "淘宝/天猫"
        : state.platformMode === "jd"
          ? "京东"
          : state.platformMode === "pdd"
            ? "拼多多"
            : state.platformMode === "douyin"
              ? "抖音电商"
              : state.platformMode === "xiaohongshu"
                ? "小红书"
                : state.platformMode === "amazon"
                  ? "亚马逊"
                  : "通用电商",
    workflowModeLabel:
      state.workflowMode === "quick" ? "快速模式" : "专业模式",
  };
};

export const getEcommerceDrawerEntryStep = (
  state: EcommerceOneClickSessionState,
): EcommerceOneClickSessionState["step"] => {
  if (state.step === "DONE") {
    return "DONE";
  }

  if (
    state.step === "BATCH_GENERATE" &&
    (state.results.length > 0 ||
      state.batchJobs.some((job) => job.status === "failed"))
  ) {
    return "BATCH_GENERATE";
  }

  return state.step;
};

export const isEcommerceWorkflowChatMessage = (
  message: ChatMessage,
): boolean => {
  if (message.skillData?.id === "ecom-oneclick-workflow") {
    return true;
  }

  if (
    message.kind === "workflow_ui" &&
    message.workflowUi?.type?.startsWith("ecomOneClick.")
  ) {
    return true;
  }

  if (message.role === "model" && /^ecom-/.test(message.id)) {
    return true;
  }

  return false;
};
