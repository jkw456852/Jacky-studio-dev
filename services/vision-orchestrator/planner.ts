import type { ImageGenSkillParams } from "../../types";
import { generateVisualPlanModelPatch } from "./planner-model";
import { composeVisualGenerationPrompt } from "./prompt-composer";
import { analyzeVisualReferences } from "./reference-analyzer";
import type {
  PlanVisualGenerationInput,
  PlannedImageGeneration,
  PlannerConsistencyContext,
  VisualConstraintLock,
  VisualGenerationPlan,
  VisualPlannerModelConfig,
  VisualTaskIntent,
} from "./types";

const hasMeaningfulText = (value: string) => String(value || "").trim().length > 0;

const inferIntent = (
  prompt: string,
  effectiveReferenceRoleMode: VisualGenerationPlan["effectiveReferenceRoleMode"],
  referenceCount: number,
): VisualTaskIntent => {
  const normalizedPrompt = String(prompt || "").toLowerCase();

  if (effectiveReferenceRoleMode === "poster-product" && referenceCount >= 2) {
    return "poster_rebuild";
  }

  if (
    /换背景|背景替换|replace background|new background|change background/.test(
      normalizedPrompt,
    )
  ) {
    return "background_replace";
  }

  if (
    /保留文字|文案|排版|logo 位置|text layout|preserve text|keep text/.test(
      normalizedPrompt,
    )
  ) {
    return "text_preserve";
  }

  if (referenceCount > 1) {
    return "multi_reference_fusion";
  }

  if (referenceCount === 1) {
    return "product_lock";
  }

  return "product_scene";
};

const buildLocks = (intent: VisualTaskIntent, referenceCount: number): VisualConstraintLock => ({
  brandIdentity: referenceCount > 0,
  subjectShape: referenceCount > 0,
  packagingLayout:
    intent === "poster_rebuild" || intent === "product_lock" || intent === "text_preserve",
  composition: intent === "poster_rebuild" || intent === "text_preserve",
  textLayout: intent === "poster_rebuild" || intent === "text_preserve",
  materialTexture:
    intent === "poster_rebuild" ||
    intent === "product_lock" ||
    intent === "multi_reference_fusion",
});

const buildPlanNotes = (
  intent: VisualTaskIntent,
  referenceCount: number,
  effectiveReferenceRoleMode: VisualGenerationPlan["effectiveReferenceRoleMode"],
  consistencyContext?: PlannerConsistencyContext,
) => {
  const notes: string[] = [];

  notes.push(`intent=${intent}`);
  notes.push(`reference-role-mode=${effectiveReferenceRoleMode}`);

  if (referenceCount === 0) {
    notes.push("No references detected; planner will preserve the user's prompt as the main directive.");
  } else if (referenceCount === 1) {
    notes.push("Single reference detected; planner will bias toward subject and brand fidelity.");
  } else {
    notes.push("Multiple references detected; planner will keep role assignments explicit and preserve all supporting detail references.");
  }

  if (consistencyContext?.referenceSummary) {
    notes.push("Consistency summary is available and will be forwarded to the generation layer.");
  }

  if (consistencyContext?.forbiddenChanges?.length) {
    notes.push("Forbidden change hints are available and will be forwarded to the generation layer.");
  }

  return notes;
};

const buildAllowedEdits = (intent: VisualTaskIntent) => {
  if (intent === "background_replace") {
    return ["Background", "Lighting", "Scene ambience"];
  }

  if (intent === "poster_rebuild") {
    return ["Main product replacement", "Supporting decoration refinements"];
  }

  return ["Composition refinement", "Lighting refinement", "Supporting scene variation"];
};

const buildForbiddenEdits = (locks: VisualConstraintLock) => {
  const forbiddenEdits: string[] = [];
  if (locks.brandIdentity) {
    forbiddenEdits.push("Do not replace the visible brand with unrelated branding.");
  }
  if (locks.subjectShape) {
    forbiddenEdits.push("Do not change the main subject silhouette or product category.");
  }
  if (locks.packagingLayout) {
    forbiddenEdits.push("Do not redesign the packaging structure when it is visible in references.");
  }
  if (locks.composition) {
    forbiddenEdits.push("Do not drift away from the intended layout hierarchy.");
  }
  return forbiddenEdits;
};

const normalizeConsistencyContext = (
  value: PlanVisualGenerationInput["consistencyContext"],
): PlannerConsistencyContext | undefined => {
  if (!value) return undefined;

  const approvedAssetIds = Array.isArray(value.approvedAssetIds)
    ? value.approvedAssetIds.map(String).filter(Boolean)
    : undefined;
  const subjectAnchors = Array.isArray(value.subjectAnchors)
    ? value.subjectAnchors.map(String).filter(Boolean)
    : undefined;
  const forbiddenChanges = Array.isArray(value.forbiddenChanges)
    ? value.forbiddenChanges.map(String).filter(Boolean)
    : undefined;
  const referenceSummary = hasMeaningfulText(String(value.referenceSummary || ""))
    ? String(value.referenceSummary)
    : undefined;

  if (
    !approvedAssetIds?.length &&
    !subjectAnchors?.length &&
    !forbiddenChanges?.length &&
    !referenceSummary
  ) {
    return undefined;
  }

  return {
    approvedAssetIds,
    subjectAnchors,
    referenceSummary,
    forbiddenChanges,
  };
};

const buildReferenceStrength = (
  intent: VisualTaskIntent,
  referenceCount: number,
): number | undefined => {
  if (referenceCount === 0) return undefined;
  if (intent === "poster_rebuild") return 0.94;
  if (intent === "multi_reference_fusion") return 0.9;
  return 0.88;
};

const buildReferencePriority = (
  referenceCount: number,
): ImageGenSkillParams["referencePriority"] => {
  if (referenceCount > 1) return "all";
  if (referenceCount === 1) return "first";
  return undefined;
};

const buildExecutionFromPlan = (
  input: PlanVisualGenerationInput,
  plan: VisualGenerationPlan,
  referenceImages: string[],
  consistencyContext?: PlannerConsistencyContext,
): PlannedImageGeneration["execution"] => ({
  basePrompt: input.prompt,
  composedPrompt: composeVisualGenerationPrompt(plan, input.prompt),
  referenceImages,
  referencePriority: buildReferencePriority(referenceImages.length),
  referenceStrength: buildReferenceStrength(plan.intent, referenceImages.length),
  referenceRoleMode: plan.effectiveReferenceRoleMode,
  promptLanguagePolicy: input.translatePromptToEnglish
    ? "translate-en"
    : "original-zh",
  textPolicy:
    input.enforceChineseTextInImage || hasMeaningfulText(input.requiredChineseCopy || "")
      ? {
          enforceChinese: input.enforceChineseTextInImage,
          requiredCopy: String(input.requiredChineseCopy || "").trim() || undefined,
        }
      : undefined,
  disableTransportRetries: Boolean(input.disableTransportRetries),
  consistencyContext,
});

const buildRuleBasedPlannedGeneration = (
  input: PlanVisualGenerationInput,
): PlannedImageGeneration => {
  const consistencyContext = normalizeConsistencyContext(input.consistencyContext);
  const analysis = analyzeVisualReferences({
    prompt: input.prompt,
    manualReferenceImages: input.manualReferenceImages,
    referenceImages: input.referenceImages,
    requestedReferenceRoleMode: input.requestedReferenceRoleMode,
  });

  const intent = inferIntent(
    input.prompt,
    analysis.effectiveReferenceRoleMode,
    analysis.orderedReferenceImages.length,
  );
  const locks = buildLocks(intent, analysis.orderedReferenceImages.length);
  const plannerNotes = buildPlanNotes(
    intent,
    analysis.orderedReferenceImages.length,
    analysis.effectiveReferenceRoleMode,
    consistencyContext,
  );
  const plan: VisualGenerationPlan = {
    intent,
    strategyId: intent,
    userGoal: input.prompt,
    references: analysis.references,
    taskRoleOverlay: input.taskRoleOverlay,
    styleLibrary: input.styleLibrary,
    locks,
    allowedEdits: buildAllowedEdits(intent),
    forbiddenEdits: buildForbiddenEdits(locks),
    qualityHint: input.imageQuality || "medium",
    plannerNotes,
    requestedReferenceRoleMode: input.requestedReferenceRoleMode || "default",
    effectiveReferenceRoleMode: analysis.effectiveReferenceRoleMode,
  };

  return {
    plan,
    plannerMeta: {
      source: "rule",
    },
    execution: buildExecutionFromPlan(
      input,
      plan,
      analysis.orderedReferenceImages,
      consistencyContext,
    ),
  };
};

const buildRuleFallbackPlannedGeneration = (args: {
  input: PlanVisualGenerationInput;
  modelConfig: VisualPlannerModelConfig;
  reason: string;
}): PlannedImageGeneration => {
  const fallback = buildRuleBasedPlannedGeneration(args.input);
  const fallbackNote = `Visual orchestration fallback: ${args.reason}`;
  return {
    ...fallback,
    plan: {
      ...fallback.plan,
      plannerNotes: Array.from(
        new Set([
          ...fallback.plan.plannerNotes,
          `planner-model=${args.modelConfig.label || args.modelConfig.modelId}`,
          fallbackNote,
        ]),
      ).slice(0, 12),
    },
  };
};

export const planVisualGeneration = (
  input: PlanVisualGenerationInput,
): PlannedImageGeneration => buildRuleBasedPlannedGeneration(input);

export const planVisualGenerationWithModel = async (
  input: PlanVisualGenerationInput,
  modelConfig?: VisualPlannerModelConfig | null,
): Promise<PlannedImageGeneration> => {
  if (!modelConfig?.modelId) {
    throw new Error(
      "Visual orchestration model is not configured. Please choose a visual orchestrator model in Settings before generating images.",
    );
  }

  const patch = await generateVisualPlanModelPatch({
    input,
    modelId: modelConfig.modelId,
    providerId: modelConfig.providerId,
  });

  if (!patch) {
    return buildRuleFallbackPlannedGeneration({
      input,
      modelConfig,
      reason: "model patch missing after planner/repair",
    });
  }

  if (!patch.intent || !patch.strategyId || !patch.referenceRoleMode) {
    const patchPreview = JSON.stringify({
      intent: patch.intent || null,
      strategyId: patch.strategyId || null,
      referenceRoleMode: patch.referenceRoleMode || null,
      locks: patch.locks || null,
      allowedEdits: patch.allowedEdits || null,
      forbiddenEdits: patch.forbiddenEdits || null,
      plannerNotes: patch.plannerNotes || null,
      rawResponseText: patch.rawResponseText
        ? patch.rawResponseText.slice(0, 800)
        : null,
    });
    return buildRuleFallbackPlannedGeneration({
      input,
      modelConfig,
      reason: `incomplete core plan ${patchPreview}`,
    });
  }

  if (
    patch.referenceRoleMode === "poster-product" &&
    input.manualReferenceImages.length < 2
  ) {
    return buildRuleFallbackPlannedGeneration({
      input,
      modelConfig,
      reason:
        "poster-product mode requires at least two manual references",
    });
  }

  const consistencyContext = normalizeConsistencyContext(input.consistencyContext);
  const analysis = analyzeVisualReferences(
    {
      prompt: input.prompt,
      manualReferenceImages: input.manualReferenceImages,
      referenceImages: input.referenceImages,
      requestedReferenceRoleMode: patch.referenceRoleMode,
    },
    {
      strictRequestedMode: true,
    },
  );

  const nextPlan: VisualGenerationPlan = {
    intent: patch.intent,
    strategyId: patch.strategyId,
    userGoal: input.prompt,
    references: analysis.references,
    taskRoleOverlay: input.taskRoleOverlay,
    styleLibrary: input.styleLibrary,
    locks: {
      brandIdentity: Boolean(patch.locks?.brandIdentity),
      subjectShape: Boolean(patch.locks?.subjectShape),
      packagingLayout: Boolean(patch.locks?.packagingLayout),
      composition: Boolean(patch.locks?.composition),
      textLayout: Boolean(patch.locks?.textLayout),
      materialTexture: Boolean(patch.locks?.materialTexture),
    },
    allowedEdits:
      patch.allowedEdits && patch.allowedEdits.length > 0
        ? patch.allowedEdits
        : [],
    forbiddenEdits:
      patch.forbiddenEdits && patch.forbiddenEdits.length > 0
        ? patch.forbiddenEdits
        : [],
    qualityHint: input.imageQuality || "medium",
    plannerNotes: Array.from(
      new Set([
        ...(patch.plannerNotes || []),
        `planner-model=${modelConfig.label || modelConfig.modelId}`,
      ]),
    ).slice(0, 12),
    requestedReferenceRoleMode: patch.referenceRoleMode,
    effectiveReferenceRoleMode: analysis.effectiveReferenceRoleMode,
  };

  if (nextPlan.allowedEdits.length === 0 || nextPlan.forbiddenEdits.length === 0) {
    const patchPreview = JSON.stringify({
      allowedEdits: patch.allowedEdits || null,
      forbiddenEdits: patch.forbiddenEdits || null,
      plannerNotes: patch.plannerNotes || null,
      rawResponseText: patch.rawResponseText
        ? patch.rawResponseText.slice(0, 800)
        : null,
    });
    return buildRuleFallbackPlannedGeneration({
      input,
      modelConfig,
      reason: `incomplete edit constraint set ${patchPreview}`,
    });
  }

  return {
    plan: nextPlan,
    plannerMeta: {
      source: "model",
      modelId: modelConfig.modelId,
      providerId: modelConfig.providerId || null,
    },
    execution: buildExecutionFromPlan(
      input,
      nextPlan,
      analysis.orderedReferenceImages,
      consistencyContext,
    ),
  };
};
