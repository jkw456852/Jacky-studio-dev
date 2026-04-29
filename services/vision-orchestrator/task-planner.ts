import { generateVisualTaskPlanModelPatch } from "./planner-model";
import type {
  PlanVisualTaskInput,
  PlannedVisualTask,
  PlannedVisualTaskUnit,
  VisualPagePlan,
  VisualPlannerModelConfig,
  VisualPlanningThoughtHandler,
  VisualTaskPlan,
} from "./types";

const buildSetPagePrompt = (
  userPrompt: string,
  taskPlan: VisualTaskPlan,
  page: VisualPagePlan,
  pageIndex: number,
  totalPages: number,
) => {
  const sharedStyleGuide = taskPlan.sharedStyleGuide;
  const subjectIdentity = sharedStyleGuide?.subjectIdentity || [];
  const brandLocks = sharedStyleGuide?.brandLocks || [];
  const visualTone = sharedStyleGuide?.visualTone || [];
  const compositionGrammar = sharedStyleGuide?.compositionGrammar || [];
  const materialLanguage = sharedStyleGuide?.materialLanguage || [];
  const forbiddenDrift = sharedStyleGuide?.forbiddenDrift || [];
  const planningBrief = taskPlan.planningBrief;
  const roleOverlay = taskPlan.roleOverlay;

  const formatLines = (title: string, values?: string[]) => {
    if (!values || values.length === 0) return "";
    return `\n[${title}]\n${values.map((item) => `- ${item}`).join("\n")}`;
  };

  return [
    "[Visual Set Task]",
    `- Overall intent: ${taskPlan.intent}.`,
    `- Page: ${pageIndex + 1}/${totalPages}.`,
    `- Page title: ${page.title}.`,
    `- Page role: ${page.pageRole}.`,
    `- Target aspect ratio: ${page.aspectRatio}.`,
    `- Page goal: ${page.goal}.`,
    planningBrief?.deliverableForm
      ? `- Deliverable form: ${planningBrief.deliverableForm}.`
      : "",
    planningBrief?.aspectRatioStrategy
      ? `- Aspect ratio strategy: ${planningBrief.aspectRatioStrategy}.`
      : "",
    roleOverlay?.summary ? `- Task role overlay: ${roleOverlay.summary}.` : "",
    roleOverlay?.mindset ? `- Overlay mindset: ${roleOverlay.mindset}.` : "",
    formatLines(
      "Overlay Planning Policy",
      roleOverlay?.planningPolicy,
    ),
    formatLines(
      "Overlay Execution Directives",
      roleOverlay?.executionDirectives,
    ),
    formatLines(
      "Overlay Active Roles",
      roleOverlay?.roles?.map(
        (item) =>
          `${item.role} | mission: ${item.mission} | focus: ${item.focus.join(", ")}`,
      ),
    ),
    formatLines("Must Show", page.mustShow),
    formatLines("Optional Show", page.optionalShow),
    formatLines("Forbidden Edits", page.forbiddenEdits),
    formatLines("Depends On", page.dependsOn),
    formatLines("Research Focus", planningBrief?.researchFocus),
    planningBrief?.researchDecision
      ? `\n[Research Decision]\n- shouldResearch: ${planningBrief.researchDecision.shouldResearch}\n- mode: ${planningBrief.researchDecision.mode}\n- reason: ${planningBrief.researchDecision.reason}`
      : "",
    formatLines("Research Topics", planningBrief?.researchDecision?.topics),
    formatLines("Model Fit Notes", planningBrief?.modelFitNotes),
    formatLines("Prompt Directives", planningBrief?.promptDirectives),
    formatLines("Risks", planningBrief?.risks),
    formatLines("Shared Subject Identity", subjectIdentity),
    formatLines("Shared Brand Locks", brandLocks),
    formatLines("Shared Visual Tone", visualTone),
    formatLines("Shared Composition Grammar", compositionGrammar),
    formatLines("Shared Material Language", materialLanguage),
    formatLines("Shared Forbidden Drift", forbiddenDrift),
    "\n[Set Page Discipline]",
    "- This prompt is for one page only, not a collage board and not a summary of the whole set.",
    "- Give this page one dominant communication job and keep the composition organized around that job.",
    "- If text will be added later, reserve clean text-safe space instead of generating dense fake copy blocks.",
    "\n[Original User Request]",
    userPrompt,
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
};

const buildSingleUnit = (
  input: PlanVisualTaskInput,
): PlannedVisualTaskUnit => ({
  id: "single-1",
  title: "单图",
  goal: input.prompt,
  aspectRatio: String(input.currentAspectRatio || "").trim() || "1:1",
  prompt: input.prompt,
  pageIndex: 0,
  totalPages: 1,
});

const buildRuleFallbackPlannedTask = (args: {
  input: PlanVisualTaskInput;
  modelConfig: VisualPlannerModelConfig;
  reason: string;
}): PlannedVisualTask => {
  const aspectRatio =
    String(args.input.currentAspectRatio || "").trim() || "1:1";
  const taskPlan: VisualTaskPlan = {
    mode: "single",
    userGoal: args.input.prompt,
    intent: "unknown",
    reasoningSummary: `Rule fallback planner engaged: ${args.reason}`,
    toolChain: ["rule-planner", "compose", "generate"],
    planningBrief: {
      requestType: "single-image",
      deliverableForm: `${Math.max(1, args.input.requestedImageCount || 1)} image`,
      aspectRatioStrategy: aspectRatio,
      researchFocus: [],
      researchDecision: {
        shouldResearch: false,
        mode: "none",
        reason: "Planner model unavailable or incomplete; continue with local rule planner.",
        topics: [],
        searchQueries: [],
      },
      modelFitNotes: [
        `planner-model=${args.modelConfig.label || args.modelConfig.modelId}`,
      ],
      promptDirectives: [
        "Preserve the user's latest prompt as the main directive.",
        "Keep all available references in the execution chain.",
      ],
      risks: [
        "Planner model did not return a fully usable task plan, so the workflow continued with a simplified fallback.",
      ],
    },
  };

  return {
    taskPlan,
    units: normalizeTaskPlanToUnits(args.input, taskPlan),
  };
};

const normalizeTaskPlanToUnits = (
  input: PlanVisualTaskInput,
  taskPlan: VisualTaskPlan,
): PlannedVisualTaskUnit[] => {
  if (taskPlan.mode !== "set" || !taskPlan.pages || taskPlan.pages.length === 0) {
    return [buildSingleUnit(input)];
  }

  return taskPlan.pages.map((page, index, pages) => ({
    id: page.id,
    title: page.title,
    goal: page.goal,
    aspectRatio:
      String(page.aspectRatio || "").trim() ||
      String(input.currentAspectRatio || "").trim() ||
      "1:1",
    prompt:
      String(page.executionPrompt || "").trim() ||
      buildSetPagePrompt(input.prompt, taskPlan, page, index, pages.length),
    pageRole: page.pageRole,
    pageIndex: index,
    totalPages: pages.length,
  }));
};

export const planVisualTaskWithModel = async (
  input: PlanVisualTaskInput,
  modelConfig?: VisualPlannerModelConfig | null,
  options?: {
    onThought?: VisualPlanningThoughtHandler;
    requestId?: string;
    onQueueEvent?: (event: {
      phase: "waiting" | "running";
      queueKey: string;
      waitMs: number;
    }) => void;
  },
): Promise<PlannedVisualTask> => {
  if (!modelConfig?.modelId) {
    throw new Error(
      "Visual orchestration model is not configured. Please choose a visual orchestrator model in Settings before generating images.",
    );
  }

  const patch = await generateVisualTaskPlanModelPatch({
    input,
    modelId: modelConfig.modelId,
    providerId: modelConfig.providerId,
    onThought: options?.onThought,
    requestId: options?.requestId,
    onQueueEvent: options?.onQueueEvent,
  });

  if (!patch) {
    return buildRuleFallbackPlannedTask({
      input,
      modelConfig,
      reason: "model patch missing after planner/repair",
    });
  }

  if (!patch.mode || !patch.intent || !patch.reasoningSummary || !patch.toolChain?.length) {
    const patchPreview = JSON.stringify({
      mode: patch.mode || null,
      intent: patch.intent || null,
      reasoningSummary: patch.reasoningSummary || null,
      toolChain: patch.toolChain || null,
      planningBrief: patch.planningBrief || null,
      pageCount: patch.pages?.length || 0,
      rawResponseText: patch.rawResponseText
        ? patch.rawResponseText.slice(0, 800)
        : null,
    });
    return buildRuleFallbackPlannedTask({
      input,
      modelConfig,
      reason: `incomplete plan ${patchPreview}`,
    });
  }

  if (patch.mode === "set" && (!patch.pages || patch.pages.length === 0)) {
    const patchPreview = JSON.stringify({
      mode: patch.mode,
      intent: patch.intent,
      reasoningSummary: patch.reasoningSummary,
      toolChain: patch.toolChain,
      planningBrief: patch.planningBrief || null,
      rawResponseText: patch.rawResponseText
        ? patch.rawResponseText.slice(0, 800)
        : null,
    });
    return buildRuleFallbackPlannedTask({
      input,
      modelConfig,
      reason: `set mode without pages ${patchPreview}`,
    });
  }

  const taskPlan: VisualTaskPlan = {
    mode: patch.mode,
    userGoal: input.prompt,
    intent: patch.intent,
    reasoningSummary: patch.reasoningSummary,
    toolChain: patch.toolChain,
    planningBrief: patch.planningBrief,
    roleOverlay: patch.roleOverlay,
    sharedStyleGuide: patch.sharedStyleGuide,
    pages: patch.pages,
  };

  return {
    taskPlan,
    units: normalizeTaskPlanToUnits(input, taskPlan),
  };
};
