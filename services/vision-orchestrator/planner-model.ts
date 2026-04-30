import { Type } from "@google/genai";
import { generateJsonResponse } from "../gemini";
import { normalizeReferenceToModelInputDataUrl } from "../image-reference-resolver";
import { getVisualOrchestratorInputPolicy } from "../provider-settings";
import { getMainBrainPreferenceLines } from "../runtime-assets/main-brain";
import {
  buildPromptListSection,
  buildVisualPlaybookSections,
  getCorePlanningBrainLines,
  getSelectedGenerationModelPlanningLines,
  getSharedDeliverableDecompositionLines,
  getSharedPlanningSelfCheckLines,
  getSharedPlanningConstitutionLines,
  getVisualPlanningPolicyLines,
  inferVisualTaskPlaybooks,
} from "../agents/shared/planning-policies";
import {
  buildBuiltInStyleLibrarySummary,
  buildUserStyleLibrarySummary,
  normalizeWorkspaceStyleLibrary,
} from "./style-library";
import type {
  PlanVisualTaskInput,
  PlannerConsistencyContext,
  PlanVisualGenerationInput,
  VisualConstraintLock,
  VisualExecutionMode,
  VisualPagePlan,
  VisualPlanningThoughtHandler,
  VisualPlanningBrief,
  VisualPageRole,
  VisualResearchDecision,
  VisualResearchMode,
  VisualRoleOverlay,
  VisualStyleLibrary,
  VisualTaskPlan,
  VisualTaskIntent,
} from "./types";

const VALID_INTENTS = new Set<VisualTaskIntent>([
  "poster_rebuild",
  "product_scene",
  "product_lock",
  "background_replace",
  "subject_consistency",
  "multi_reference_fusion",
  "text_preserve",
  "style_transfer",
  "unknown",
]);

const VALID_REFERENCE_ROLE_MODES = new Set([
  "none",
  "default",
  "poster-product",
  "custom",
]);
const VALID_EXECUTION_MODES = new Set<VisualExecutionMode>([
  "single",
  "set",
  "iterative",
]);
const VALID_RESEARCH_MODES = new Set<VisualResearchMode>([
  "none",
  "images",
  "web+images",
]);
const VALID_PAGE_ROLES = new Set<VisualPageRole>([
  "cover",
  "selling_point",
  "detail",
  "comparison",
  "usage_scene",
  "size_spec",
  "story",
  "custom",
]);

type VisualPlanModelPatch = {
  intent?: VisualTaskIntent;
  strategyId?: string;
  referenceRoleMode?: "none" | "default" | "poster-product" | "custom";
  locks?: Partial<VisualConstraintLock>;
  allowedEdits?: string[];
  forbiddenEdits?: string[];
  plannerNotes?: string[];
  rawResponseText?: string;
};

type VisualTaskPlanModelPatch = {
  mode?: VisualExecutionMode;
  intent?: string;
  reasoningSummary?: string;
  toolChain?: string[];
  planningBrief?: VisualPlanningBrief;
  roleOverlay?: VisualRoleOverlay;
  styleLibrary?: VisualStyleLibrary;
  sharedStyleGuide?: VisualTaskPlan["sharedStyleGuide"];
  pages?: VisualPagePlan[];
  rawResponseText?: string;
};

const hasCompleteModelPatch = (patch: VisualPlanModelPatch | null): patch is VisualPlanModelPatch => {
  if (!patch) return false;
  return Boolean(
    patch.intent &&
      patch.strategyId &&
      patch.referenceRoleMode &&
      patch.locks &&
      patch.allowedEdits &&
      patch.allowedEdits.length > 0 &&
      patch.forbiddenEdits &&
      patch.forbiddenEdits.length > 0,
  );
};

const hasCompleteTaskPlanPatch = (
  patch: VisualTaskPlanModelPatch | null,
): patch is VisualTaskPlanModelPatch => {
  if (!patch) return false;
  if (!patch.mode || !patch.intent || !patch.reasoningSummary) return false;
  if (!patch.toolChain || patch.toolChain.length === 0) return false;
  if (!patch.planningBrief) return false;
  if (!patch.roleOverlay) return false;
  if (patch.mode === "set") {
    return Boolean(patch.pages && patch.pages.length > 0);
  }
  return true;
};

const hasUsableTaskPlanSkeleton = (
  patch: VisualTaskPlanModelPatch | null,
) => {
  if (!patch) return false;
  return Boolean(
    patch.intent ||
      patch.reasoningSummary ||
      (patch.toolChain && patch.toolChain.length > 0) ||
      patch.planningBrief ||
      patch.roleOverlay ||
      patch.styleLibrary ||
      (patch.pages && patch.pages.length > 0),
  );
};

const shouldAnnounceTaskPlanRetry = (
  patch: VisualTaskPlanModelPatch | null,
) => !hasUsableTaskPlanSkeleton(patch);

const VISUAL_PLAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING },
    strategyId: { type: Type.STRING },
    referenceRoleMode: { type: Type.STRING },
    locks: {
      type: Type.OBJECT,
      properties: {
        brandIdentity: { type: Type.BOOLEAN },
        subjectShape: { type: Type.BOOLEAN },
        packagingLayout: { type: Type.BOOLEAN },
        composition: { type: Type.BOOLEAN },
        textLayout: { type: Type.BOOLEAN },
        materialTexture: { type: Type.BOOLEAN },
      },
    },
    allowedEdits: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    forbiddenEdits: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    plannerNotes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    "intent",
    "strategyId",
    "referenceRoleMode",
    "locks",
    "allowedEdits",
    "forbiddenEdits",
    "plannerNotes",
  ],
};

const VISUAL_TASK_PLAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    mode: { type: Type.STRING },
    intent: { type: Type.STRING },
    reasoningSummary: { type: Type.STRING },
    toolChain: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    planningBrief: {
      type: Type.OBJECT,
      properties: {
        requestType: { type: Type.STRING },
        deliverableForm: { type: Type.STRING },
        aspectRatioStrategy: { type: Type.STRING },
        researchFocus: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        researchDecision: {
          type: Type.OBJECT,
          properties: {
            shouldResearch: { type: Type.BOOLEAN },
            mode: { type: Type.STRING },
            reason: { type: Type.STRING },
            topics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            searchQueries: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            "shouldResearch",
            "mode",
            "reason",
            "topics",
            "searchQueries",
          ],
        },
        modelFitNotes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        promptDirectives: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        risks: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: [
        "requestType",
        "deliverableForm",
        "aspectRatioStrategy",
        "researchFocus",
        "researchDecision",
        "modelFitNotes",
        "promptDirectives",
        "risks",
      ],
    },
    sharedStyleGuide: {
      type: Type.OBJECT,
      properties: {
        subjectIdentity: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        brandLocks: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        visualTone: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        compositionGrammar: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        materialLanguage: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        forbiddenDrift: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        preferredAspectRatios: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        continuityAnchorPolicy: { type: Type.STRING },
      },
    },
    roleOverlay: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        mindset: { type: Type.STRING },
        planningPolicy: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        executionDirectives: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        roles: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              role: { type: Type.STRING },
              mission: { type: Type.STRING },
              focus: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              outputContract: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ["role", "mission", "focus", "outputContract"],
          },
        },
      },
      required: [
        "summary",
        "mindset",
        "planningPolicy",
        "executionDirectives",
        "roles",
      ],
    },
    styleLibrary: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        summary: { type: Type.STRING },
        referenceInterpretation: { type: Type.STRING },
        planningDirectives: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        promptDirectives: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        createdBy: { type: Type.STRING },
      },
      required: [
        "title",
        "summary",
        "referenceInterpretation",
        "planningDirectives",
        "promptDirectives",
      ],
    },
    pages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          goal: { type: Type.STRING },
          pageRole: { type: Type.STRING },
          aspectRatio: { type: Type.STRING },
          mustShow: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          optionalShow: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          forbiddenEdits: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          dependsOn: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          executionPrompt: { type: Type.STRING },
        },
      },
    },
  },
  required: ["mode", "intent", "reasoningSummary", "toolChain", "roleOverlay"],
};

const trimStringArray = (value: unknown, limit = 8, maxLength = 160) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, limit);
};

const normalizeLocks = (value: unknown): Partial<VisualConstraintLock> | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const next: Partial<VisualConstraintLock> = {};
  const keys: Array<keyof VisualConstraintLock> = [
    "brandIdentity",
    "subjectShape",
    "packagingLayout",
    "composition",
    "textLayout",
    "materialTexture",
  ];

  keys.forEach((key) => {
    if (typeof raw[key] === "boolean") {
      next[key] = raw[key] as boolean;
    }
  });

  return Object.keys(next).length > 0 ? next : undefined;
};

const normalizeModelPatch = (raw: unknown): VisualPlanModelPatch | null => {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const next: VisualPlanModelPatch = {};

  if (typeof data.intent === "string" && VALID_INTENTS.has(data.intent as VisualTaskIntent)) {
    next.intent = data.intent as VisualTaskIntent;
  }

  if (typeof data.strategyId === "string" && data.strategyId.trim()) {
    next.strategyId = data.strategyId.trim().slice(0, 80);
  }

  if (
    typeof data.referenceRoleMode === "string" &&
    VALID_REFERENCE_ROLE_MODES.has(data.referenceRoleMode)
  ) {
    next.referenceRoleMode = data.referenceRoleMode as
      | "none"
      | "default"
      | "poster-product"
      | "custom";
  }

  const locks = normalizeLocks(data.locks);
  if (locks) next.locks = locks;

  const allowedEdits = trimStringArray(data.allowedEdits);
  if (allowedEdits.length > 0) next.allowedEdits = allowedEdits;

  const forbiddenEdits = trimStringArray(data.forbiddenEdits);
  if (forbiddenEdits.length > 0) next.forbiddenEdits = forbiddenEdits;

  const plannerNotes = trimStringArray(data.plannerNotes, 10);
  if (plannerNotes.length > 0) next.plannerNotes = plannerNotes;

  if (!next.intent && !next.strategyId && !next.referenceRoleMode) {
    return null;
  }

  return next;
};

const trimAspectRatio = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized || "";
};

const normalizeSharedStyleGuide = (
  value: unknown,
): VisualTaskPlan["sharedStyleGuide"] | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const next: NonNullable<VisualTaskPlan["sharedStyleGuide"]> = {
    subjectIdentity: trimStringArray(raw.subjectIdentity, 8),
    brandLocks: trimStringArray(raw.brandLocks, 8),
    visualTone: trimStringArray(raw.visualTone, 8),
    compositionGrammar: trimStringArray(raw.compositionGrammar, 8),
    materialLanguage: trimStringArray(raw.materialLanguage, 8),
    forbiddenDrift: trimStringArray(raw.forbiddenDrift, 8),
  };

  const preferredAspectRatios = trimStringArray(raw.preferredAspectRatios, 6)
    .map((item) => trimAspectRatio(item))
    .filter(Boolean);
  if (preferredAspectRatios.length > 0) {
    next.preferredAspectRatios = preferredAspectRatios;
  }

  const continuityAnchorPolicy = String(raw.continuityAnchorPolicy || "").trim();
  if (
    continuityAnchorPolicy === "none" ||
    continuityAnchorPolicy === "first_approved" ||
    continuityAnchorPolicy === "latest_approved"
  ) {
    next.continuityAnchorPolicy = continuityAnchorPolicy;
  }

  const hasMeaningfulField = Object.values(next).some((entry) =>
    Array.isArray(entry) ? entry.length > 0 : Boolean(entry),
  );

  return hasMeaningfulField ? next : undefined;
};

const normalizeResearchDecision = (
  value: unknown,
): VisualResearchDecision | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.shouldResearch !== "boolean") return undefined;

  const mode = String(raw.mode || "").trim() as VisualResearchMode;
  const reason = String(raw.reason || "").trim().slice(0, 220);
  const topics = trimStringArray(raw.topics, 8, 120);
  const searchQueries = trimStringArray(raw.searchQueries, 6, 120);

  if (!VALID_RESEARCH_MODES.has(mode) || !reason) {
    return undefined;
  }
  if (raw.shouldResearch && topics.length === 0) {
    return undefined;
  }
  if (!raw.shouldResearch && mode !== "none") {
    return undefined;
  }

  return {
    shouldResearch: raw.shouldResearch,
    mode,
    reason,
    topics,
    searchQueries,
  };
};

const normalizePlanningBrief = (
  value: unknown,
): VisualTaskPlan["planningBrief"] | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const requestType = String(raw.requestType || "").trim().slice(0, 80);
  const deliverableForm = String(raw.deliverableForm || "").trim().slice(0, 140);
  const aspectRatioStrategy = String(raw.aspectRatioStrategy || "")
    .trim()
    .slice(0, 180);
  const researchFocus = trimStringArray(raw.researchFocus, 8, 120);
  const researchDecision = normalizeResearchDecision(raw.researchDecision);
  const modelFitNotes = trimStringArray(raw.modelFitNotes, 8, 120);
  const promptDirectives = trimStringArray(raw.promptDirectives, 8, 140);
  const risks = trimStringArray(raw.risks, 8, 120);

  if (
    !requestType ||
    !deliverableForm ||
    !aspectRatioStrategy ||
    researchFocus.length === 0 ||
    !researchDecision ||
    modelFitNotes.length === 0 ||
    promptDirectives.length === 0
  ) {
    return undefined;
  }

  return {
    requestType,
    deliverableForm,
    aspectRatioStrategy,
    researchFocus,
    researchDecision,
    modelFitNotes,
    promptDirectives,
    risks,
  };
};

const normalizeRoleOverlay = (
  value: unknown,
): VisualTaskPlan["roleOverlay"] | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const summary = String(raw.summary || "").trim().slice(0, 220);
  const mindset = String(raw.mindset || "").trim().slice(0, 220);
  const planningPolicy = trimStringArray(raw.planningPolicy, 8, 180);
  const executionDirectives = trimStringArray(raw.executionDirectives, 8, 180);
  const roles = Array.isArray(raw.roles)
    ? raw.roles
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const roleRaw = item as Record<string, unknown>;
          const role = String(roleRaw.role || "").trim().slice(0, 80);
          const mission = String(roleRaw.mission || "").trim().slice(0, 220);
          const focus = trimStringArray(roleRaw.focus, 6, 140);
          const outputContract = trimStringArray(
            roleRaw.outputContract,
            6,
            160,
          );
          if (!role || !mission || focus.length === 0 || outputContract.length === 0) {
            return null;
          }
          return {
            role,
            mission,
            focus,
            outputContract,
          };
        })
        .filter((item): item is VisualRoleOverlay["roles"][number] => Boolean(item))
        .slice(0, 6)
    : [];

  if (
    !summary ||
    !mindset ||
    planningPolicy.length === 0 ||
    executionDirectives.length === 0 ||
    roles.length === 0
  ) {
    return undefined;
  }

  return {
    summary,
    mindset,
    planningPolicy,
    executionDirectives,
    roles,
  };
};

const normalizeStyleLibrary = (
  value: unknown,
): VisualTaskPlan["styleLibrary"] | undefined =>
  normalizeWorkspaceStyleLibrary(value);

const normalizePagePlan = (value: unknown, fallbackIndex: number): VisualPagePlan | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const pageRole = String(raw.pageRole || "").trim();
  const title = String(raw.title || "").trim();
  const goal = String(raw.goal || "").trim();
  const aspectRatio = trimAspectRatio(raw.aspectRatio);
  const mustShow = trimStringArray(raw.mustShow, 10);
  const forbiddenEdits = trimStringArray(raw.forbiddenEdits, 10);

  if (
    !VALID_PAGE_ROLES.has(pageRole as VisualPageRole) ||
    !title ||
    !goal ||
    !aspectRatio ||
    mustShow.length === 0 ||
    forbiddenEdits.length === 0
  ) {
    return null;
  }

  const id = String(raw.id || "").trim() || `page-${fallbackIndex + 1}`;
  const optionalShow = trimStringArray(raw.optionalShow, 10);
  const dependsOn = trimStringArray(raw.dependsOn, 10);
  const executionPrompt = String(raw.executionPrompt || "").trim();

  return {
    id,
    title: title.slice(0, 80),
    goal,
    pageRole: pageRole as VisualPageRole,
    aspectRatio,
    mustShow,
    optionalShow: optionalShow.length > 0 ? optionalShow : undefined,
    forbiddenEdits,
    dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
    executionPrompt: executionPrompt ? executionPrompt.slice(0, 1800) : undefined,
  };
};

const normalizeTaskPlanPatch = (raw: unknown): VisualTaskPlanModelPatch | null => {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const next: VisualTaskPlanModelPatch = {};

  if (
    typeof data.mode === "string" &&
    VALID_EXECUTION_MODES.has(data.mode as VisualExecutionMode)
  ) {
    next.mode = data.mode as VisualExecutionMode;
  }

  if (typeof data.intent === "string" && data.intent.trim()) {
    next.intent = data.intent.trim().slice(0, 120);
  }

  if (typeof data.reasoningSummary === "string" && data.reasoningSummary.trim()) {
    next.reasoningSummary = data.reasoningSummary.trim().slice(0, 280);
  }

  const toolChain = trimStringArray(data.toolChain, 8);
  if (toolChain.length > 0) {
    next.toolChain = toolChain;
  }

  const planningBrief = normalizePlanningBrief(data.planningBrief);
  if (planningBrief) {
    next.planningBrief = planningBrief;
  }

  const roleOverlay = normalizeRoleOverlay(data.roleOverlay);
  if (roleOverlay) {
    next.roleOverlay = roleOverlay;
  }

  const styleLibrary = normalizeStyleLibrary(data.styleLibrary);
  if (styleLibrary) {
    next.styleLibrary = styleLibrary;
  }

  const sharedStyleGuide = normalizeSharedStyleGuide(data.sharedStyleGuide);
  if (sharedStyleGuide) {
    next.sharedStyleGuide = sharedStyleGuide;
  }

  if (Array.isArray(data.pages)) {
    const pages = data.pages
      .map((item, index) => normalizePagePlan(item, index))
      .filter((item): item is VisualPagePlan => Boolean(item))
      .slice(0, 12);
    if (pages.length > 0) {
      next.pages = pages;
    }
  }

  if (!next.mode && !next.intent && !next.reasoningSummary) {
    return null;
  }

  return next;
};

const buildRepairPrompt = (rawResponseText: string) =>
  [
    "Rewrite the following model output into a strict JSON object for a visual orchestration planner.",
    "Return JSON only.",
    "Do not include markdown fences.",
    "Do not include any fields except:",
    "- intent",
    "- strategyId",
    "- referenceRoleMode",
    "- locks",
    "- allowedEdits",
    "- forbiddenEdits",
    "- plannerNotes",
    "",
    "[Requirements]",
    "- strategyId must be a short stable identifier and should normally match the intent unless a clearer strategy id is required.",
    "- locks must include all six boolean fields: brandIdentity, subjectShape, packagingLayout, composition, textLayout, materialTexture.",
    "- allowedEdits must be a non-empty array of strings.",
    "- forbiddenEdits must be a non-empty array of strings.",
    "- plannerNotes must be a non-empty array of short strings.",
    "- Keep the original meaning; only repair the structure.",
    "",
    "[Raw Model Output]",
    rawResponseText,
  ].join("\n");

const buildTaskPlanRepairPrompt = (rawResponseText: string) =>
  [
    "Rewrite the following model output into a strict JSON object for a visual task planner.",
    "Return JSON only.",
    "Do not include markdown fences.",
    "Do not include any fields except:",
    "- mode",
    "- intent",
    "- reasoningSummary",
    "- toolChain",
    "- planningBrief",
    "- roleOverlay",
    "- styleLibrary",
    "- sharedStyleGuide",
    "- pages",
    "",
    "[Requirements]",
    "- mode must be one of: single, set, iterative.",
    "- reasoningSummary must be a short explanation of why this execution mode fits.",
    "- toolChain must be a non-empty array of short tool step names.",
    "- planningBrief must include: requestType, deliverableForm, aspectRatioStrategy, researchFocus, researchDecision, modelFitNotes, promptDirectives, risks.",
    "- planningBrief.researchDecision must include: shouldResearch, mode, reason, topics, searchQueries.",
    "- roleOverlay must include: summary, mindset, planningPolicy, executionDirectives, roles.",
    "- If styleLibrary is present, it must include: title, summary, referenceInterpretation, planningDirectives, promptDirectives.",
    "- If mode=set, pages must be a non-empty array.",
    "- Each page must include: id, title, goal, pageRole, aspectRatio, mustShow, forbiddenEdits, and should include executionPrompt when page-specific prompting matters.",
    "- Keep the original meaning; only repair the structure.",
    "",
    "[Raw Model Output]",
    rawResponseText,
  ].join("\n");

const buildTaskPlanAgentFallbackPrompt = (args: {
  rawResponseText: string;
  partialPatch: VisualTaskPlanModelPatch | null;
}) =>
  [
    "The previous visual task planner result was incomplete.",
    "Act as the main planning agent and regenerate a complete visual task plan JSON from the original context in this conversation.",
    "Do not preserve the previous wording if it was weak. Re-think the task and return a complete object.",
    "",
    "Rules:",
    "- Return all required fields: mode, intent, reasoningSummary, toolChain, planningBrief, roleOverlay.",
    "- When needed, you may also return styleLibrary with title, summary, referenceInterpretation, planningDirectives, promptDirectives.",
    "- planningBrief must include: requestType, deliverableForm, aspectRatioStrategy, researchFocus, researchDecision, modelFitNotes, promptDirectives, risks.",
    "- roleOverlay must describe a temporary task-specific main-brain setup for this exact task, not a generic fixed team template.",
    "- roles should only include roles that are truly necessary for this task. If one main-brain role is enough, keep it to one.",
    "- Infer missing fields intelligently from the original task, references, ratio, model context, and the partial result below.",
    "- Prefer concise Chinese when the original task is Chinese.",
    "",
    "[Previous Raw Response]",
    args.rawResponseText || "{}",
    "",
    "[Partial Parsed Patch]",
    JSON.stringify(args.partialPatch || {}, null, 2),
  ].join("\n");

const emitPlanningThought = (
  onThought: VisualPlanningThoughtHandler | undefined,
  title: string,
  message: string,
  phase: "task-planner" | "generation-planner" = "task-planner",
) => {
  const normalizedMessage = String(message || "").replace(/\s+/g, " ").trim();
  if (!onThought || !normalizedMessage) return;
  onThought({
    phase,
    title,
    message: normalizedMessage,
  });
};

const createStreamingPlanningThoughtBridge = (
  onThought: VisualPlanningThoughtHandler | undefined,
) => {
  let reasoningBuffer = "";
  let lastEmitAt = 0;

  const flush = (force = false) => {
    const normalized = reasoningBuffer.replace(/\s+/g, " ").trim();
    if (!normalized) return;
    const now = Date.now();
    const hasBoundary = /[。！？；.!?;\n]/.test(reasoningBuffer);
    if (!force && normalized.length < 24 && !hasBoundary) return;
    if (!force && now - lastEmitAt < 220) return;
    reasoningBuffer = "";
    lastEmitAt = now;
    emitPlanningThought(onThought, "模型思考中", normalized);
  };

  return {
    onReasoningDelta: (delta: string) => {
      reasoningBuffer += String(delta || "");
      flush(false);
    },
    flush: () => flush(true),
  };
};

const clipThoughtText = (value: string, maxLength = 120) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trim()}...`
    : normalized;
};

const buildTaskPlannerResultThoughts = (
  patch: VisualTaskPlanModelPatch,
): string[] => {
  const lines: string[] = [];
  const planningBrief = patch.planningBrief;
  const roleOverlay = patch.roleOverlay;
  const pageCount = patch.pages?.length || 0;

  if (planningBrief?.requestType) {
    lines.push(`任务归类为 ${planningBrief.requestType}。`);
  } else if (patch.intent) {
    lines.push(`任务意图归类为 ${patch.intent}。`);
  }

  if (planningBrief?.deliverableForm) {
    lines.push(`我理解最终交付应该是：${clipThoughtText(planningBrief.deliverableForm)}。`);
  }

  if (patch.reasoningSummary) {
    lines.push(`这样判断的核心原因是：${clipThoughtText(patch.reasoningSummary)}。`);
  }

  if (planningBrief?.aspectRatioStrategy) {
    lines.push(`比例策略会按 ${clipThoughtText(planningBrief.aspectRatioStrategy, 96)} 来处理。`);
  }

  if (planningBrief?.researchDecision) {
    const decision = planningBrief.researchDecision;
    if (decision.shouldResearch) {
      lines.push(
        `决定先做 ${decision.mode} 预研，因为 ${clipThoughtText(decision.reason, 96)}。`,
      );
      if (decision.searchQueries[0]) {
        lines.push(`预研会先查：${clipThoughtText(decision.searchQueries[0], 96)}。`);
      }
    } else {
      lines.push(`判断这次先不做额外调研，因为 ${clipThoughtText(decision.reason, 96)}。`);
    }
  }

  if (roleOverlay?.summary) {
    lines.push(`这次会临时切到这样的工作脑子：${clipThoughtText(roleOverlay.summary, 110)}。`);
  }

  if (roleOverlay?.roles?.length) {
    lines.push(
      `我会同时按 ${roleOverlay.roles
        .slice(0, 4)
        .map((item) => item.role)
        .join(" / ")} 这几种角色视角一起推进。`,
    );
  }

  if (planningBrief?.modelFitNotes?.[0]) {
    lines.push(`模型注意点：${clipThoughtText(planningBrief.modelFitNotes[0], 96)}。`);
  }

  if (patch.toolChain?.length) {
    lines.push(`后续执行链路会是：${patch.toolChain.join(" -> ")}。`);
  }

  if (patch.mode === "set" && pageCount > 0) {
    const pagePreview = (patch.pages || [])
      .slice(0, 4)
      .map((page) => `${page.title}(${page.aspectRatio})`)
      .join(" / ");
    lines.push(`这次不会做成普通变体，而是拆成 ${pageCount} 个职责不同的页面：${pagePreview}。`);
  }

  if (planningBrief?.promptDirectives?.[0]) {
    lines.push(`写 prompt 时会优先遵守：${clipThoughtText(planningBrief.promptDirectives[0], 100)}。`);
  }

  if (planningBrief?.risks?.[0]) {
    lines.push(`当前最需要防的风险是：${clipThoughtText(planningBrief.risks[0], 96)}。`);
  }

  return lines.slice(0, 10);
};

const buildTaskPlannerResultThoughtsClean = (
  patch: VisualTaskPlanModelPatch,
): string[] => {
  const lines: string[] = [];
  const planningBrief = patch.planningBrief;
  const roleOverlay = patch.roleOverlay;
  const styleLibrary = patch.styleLibrary;
  const pageCount = patch.pages?.length || 0;

  if (planningBrief?.requestType) {
    lines.push(`任务归类：${planningBrief.requestType}。`);
  } else if (patch.intent) {
    lines.push(`任务意图：${patch.intent}。`);
  }

  if (planningBrief?.deliverableForm) {
    lines.push(`我理解最终交付会是：${clipThoughtText(planningBrief.deliverableForm)}。`);
  }

  if (patch.reasoningSummary) {
    lines.push(`这样判断的核心原因是：${clipThoughtText(patch.reasoningSummary)}。`);
  }

  if (planningBrief?.aspectRatioStrategy) {
    lines.push(`比例策略：${clipThoughtText(planningBrief.aspectRatioStrategy, 96)}。`);
  }

  if (planningBrief?.researchDecision) {
    const decision = planningBrief.researchDecision;
    if (decision.shouldResearch) {
      lines.push(
        `会先做 ${decision.mode} 预研，因为 ${clipThoughtText(decision.reason, 96)}。`,
      );
      if (decision.searchQueries[0]) {
        lines.push(`预研会先查：${clipThoughtText(decision.searchQueries[0], 96)}。`);
      }
    } else {
      lines.push(`这次先不额外预研，因为 ${clipThoughtText(decision.reason, 96)}。`);
    }
  }

  if (roleOverlay?.summary) {
    lines.push(`这次会临时切到这样的工作脑子：${clipThoughtText(roleOverlay.summary, 110)}。`);
  }

  if (roleOverlay?.roles?.length) {
    lines.push(
      `我会同时按 ${roleOverlay.roles
        .slice(0, 4)
        .map((item) => item.role)
        .join(" / ")} 这些视角一起推进。`,
    );
  }

  if (styleLibrary?.title) {
    lines.push(`会同步启用一个临时风格库：${clipThoughtText(styleLibrary.title, 84)}。`);
  }

  if (styleLibrary?.summary) {
    lines.push(`这个风格库的作用是：${clipThoughtText(styleLibrary.summary, 100)}。`);
  }

  if (planningBrief?.modelFitNotes?.[0]) {
    lines.push(`模型注意点：${clipThoughtText(planningBrief.modelFitNotes[0], 96)}。`);
  }

  if (patch.toolChain?.length) {
    lines.push(`后续执行链路会是：${patch.toolChain.join(" -> ")}。`);
  }

  if (patch.mode === "set" && pageCount > 0) {
    const pagePreview = (patch.pages || [])
      .slice(0, 4)
      .map((page) => `${page.title}(${page.aspectRatio})`)
      .join(" / ");
    lines.push(`这次不会做成普通变体，而是拆成 ${pageCount} 个职责不同的页面：${pagePreview}。`);
  }

  if (planningBrief?.promptDirectives?.[0]) {
    lines.push(`写 prompt 时会优先遵守：${clipThoughtText(planningBrief.promptDirectives[0], 100)}。`);
  }

  if (planningBrief?.risks?.[0]) {
    lines.push(`当前最需要防的风险是：${clipThoughtText(planningBrief.risks[0], 96)}。`);
  }

  return lines.slice(0, 10);
};

const inferTaskModeFromInput = (
  input: PlanVisualTaskInput,
): VisualExecutionMode => {
  const prompt = String(input.prompt || "").toLowerCase();
  if (
    /详情页|詳情頁|detail page|campaign set|套图|组图|系列|multi[\s-]?page|cover|卖点页/.test(
      prompt,
    )
  ) {
    return "set";
  }
  return Math.max(1, Number(input.requestedImageCount || 1)) > 1 ? "set" : "single";
};

const inferResearchDecisionFromInput = (
  input: PlanVisualTaskInput,
  mode: VisualExecutionMode,
): VisualResearchDecision => {
  const prompt = String(input.prompt || "").trim();
  const normalizedPrompt = prompt.toLowerCase();
  const isConventionHeavy =
    /详情页|詳情頁|detail page|电商|e-?commerce|campaign|海报系列|卖点|主图/.test(
      normalizedPrompt,
    );
  if (isConventionHeavy && input.referenceImages.length <= 2) {
    const query = /详情页|detail page|电商|e-?commerce/.test(normalizedPrompt)
      ? `${prompt} 详情页 版式 卖点 结构`
      : `${prompt} 视觉参考`;
    return {
      shouldResearch: true,
      mode: "web+images",
      reason:
        "当前需求涉及交付规范和页面职责判断，仅靠现有输入还不足以稳定推导完整结构。",
      topics: ["页面结构", "卖点层级", "比例策略", "模型容易出错的地方"],
      searchQueries: [query.slice(0, 120)],
    };
  }

  return {
    shouldResearch: false,
    mode: "none",
    reason:
      mode === "single"
        ? "当前需求目标和参考约束已经足够清晰，可以直接进入单图编排。"
        : "当前输入已经足以先完成成组结构拆分，不需要额外预研。",
    topics: [],
    searchQueries: [],
  };
};

const buildLocalSetPages = (
  input: PlanVisualTaskInput,
  count: number,
): VisualPagePlan[] => {
  const ratio = String(input.currentAspectRatio || "").trim() || "1:1";
  const prompt = String(input.prompt || "").trim();
  const templates: Array<Pick<VisualPagePlan, "title" | "goal" | "pageRole">> = [
    { title: "封面主视觉", goal: "建立第一眼主视觉与产品识别。", pageRole: "cover" },
    { title: "核心卖点", goal: "集中表达最值得被记住的核心卖点。", pageRole: "selling_point" },
    { title: "功能细节", goal: "展示结构、材质或关键功能细节。", pageRole: "detail" },
    { title: "使用场景", goal: "补足真实使用场景与情绪氛围。", pageRole: "usage_scene" },
  ];

  return Array.from({ length: Math.max(2, count) }, (_, index) => {
    const template = templates[index] || templates[templates.length - 1];
    return {
      id: `page-${index + 1}`,
      title: template.title,
      goal: template.goal,
      pageRole: template.pageRole,
      aspectRatio: ratio,
      mustShow: ["主体稳定", "画面职责清晰"],
      forbiddenEdits: ["不要做拼贴详情总览图", "不要重复上一页职责"],
      executionPrompt: `${prompt}\n\n[页面职责]\n第 ${index + 1} 页：${template.title}。${template.goal}`,
    };
  }).slice(0, 12);
};

const buildMainBrainFallbackPlanningBrief = (
  input: PlanVisualTaskInput,
  patch: VisualTaskPlanModelPatch,
  mode: VisualExecutionMode,
): VisualPlanningBrief => {
  const ratio = String(input.currentAspectRatio || "").trim() || "1:1";
  const count = Math.max(
    1,
    Number(input.requestedImageCount || (mode === "set" ? 4 : 1)),
  );
  return {
    requestType:
      patch.intent ||
      (mode === "set" ? "visual_set_generation" : "single_visual_generation"),
    deliverableForm:
      mode === "set" ? `${count} 张成组视觉输出` : "1 张单图视觉输出",
    aspectRatioStrategy:
      mode === "set"
        ? `先按页面职责决定比例，当前可先以 ${ratio} 作为默认起点。`
        : `保持 ${ratio} 作为当前单图输出比例。`,
    researchFocus:
      mode === "set"
        ? ["交付结构", "页面职责", "比例策略", "模型适配"]
        : ["主体约束", "编辑边界", "模型适配", "输出真实性"],
    researchDecision: inferResearchDecisionFromInput(input, mode),
    modelFitNotes: [
      input.selectedGenerationModel
        ? `${input.selectedGenerationModel} 需要优先保证主体关系、画面职责和执行边界清晰。`
        : "需要优先保证主体关系、画面职责和执行边界清晰。",
    ],
    promptDirectives:
      mode === "set"
        ? ["每张图只承担当前页面职责，不把整套内容混进单张图。"]
        : ["只围绕当前目标输出单张结果，不额外展开成套版式。"],
    risks: [
      mode === "set"
        ? "如果页面职责不够分离，容易退化成重复页面。"
        : "如果主体边界不清，模型容易把多参考图混成错误主体。",
    ],
  };
};

const buildMainBrainFallbackRoleOverlay = (
  mode: VisualExecutionMode,
): VisualRoleOverlay => ({
  summary:
    mode === "set"
      ? "主脑 agent 先判断整套交付结构，再按任务需要临时组织角色视角。"
      : "主脑 agent 先锁定目标、主体和边界，再按任务需要临时组织角色视角。",
  mindset:
    mode === "set"
      ? "先判断交付，再拆页面职责，最后再写执行 prompt。"
      : "先明确什么不能漂移，再决定怎么生成。",
  planningPolicy: [
    "优先围绕真实任务目标组织思考，不把固定模块角色当成默认答案。",
    "需要角色时由主脑 agent 按当前任务临时定义。",
    "先明确约束和风险，再进入生成执行。",
  ],
  executionDirectives:
    mode === "set"
      ? [
          "输出页级执行结果，不把整套内容硬塞进单张图。",
          "保留清晰主体区和信息层级。",
        ]
      : [
          "直接围绕当前目标输出单张结果。",
          "保持主体关系稳定，避免自由发挥造成偏移。",
        ],
  roles: [
    {
      role: "Main Brain Agent",
      mission:
        mode === "set"
          ? "统筹整套交付目标，并按任务现状临时决定需要哪些角色视角。"
          : "统筹当前单图目标，并按任务现状临时决定需要哪些角色视角。",
      focus:
        mode === "set"
          ? ["交付结构", "页面职责", "约束边界", "执行顺序"]
          : ["主体一致性", "编辑边界", "执行约束", "风险控制"],
      outputContract:
        mode === "set"
          ? ["给出稳定的整套执行方向", "只在必要时再展开临时角色分工"]
          : ["给出稳定的单图执行方向", "只在必要时再展开临时角色分工"],
    },
  ],
});

const repairIncompleteTaskPlanPatchLocally = (args: {
  patch: VisualTaskPlanModelPatch | null;
  input: PlanVisualTaskInput;
}): VisualTaskPlanModelPatch | null => {
  const base = args.patch ? { ...args.patch } : {};
  const mode = base.mode || inferTaskModeFromInput(args.input);
  const repaired: VisualTaskPlanModelPatch = {
    ...base,
    mode,
    intent:
      base.intent ||
      (mode === "set" ? "visual_set_generation" : "single_visual_generation"),
    reasoningSummary:
      base.reasoningSummary ||
      (mode === "set"
        ? "这次任务更适合先拆清每张图的职责，再进入逐页执行。"
        : "这次任务目标明确，适合直接按单图约束推进。"),
    toolChain:
      base.toolChain && base.toolChain.length > 0
        ? base.toolChain
        : ["classify", "plan", "compose", "generate"],
    planningBrief:
      base.planningBrief ||
      buildMainBrainFallbackPlanningBrief(args.input, base, mode),
    roleOverlay:
      base.roleOverlay || buildMainBrainFallbackRoleOverlay(mode),
    styleLibrary: base.styleLibrary || args.input.currentStyleLibrary,
    sharedStyleGuide:
      mode === "set"
        ? base.sharedStyleGuide || {
            subjectIdentity: ["主体身份保持一致"],
            brandLocks: ["保留已知品牌与主体识别"],
            visualTone: ["保持整套视觉基调统一"],
            compositionGrammar: ["每页只承担一个主要职责"],
            materialLanguage: ["材质与结构表达保持连续"],
            forbiddenDrift: ["不要退化成拼贴图", "不要把每页做成同一种版式"],
            preferredAspectRatios: [
              String(args.input.currentAspectRatio || "").trim() || "1:1",
            ],
            continuityAnchorPolicy: "latest_approved",
          }
        : base.sharedStyleGuide,
    pages:
      mode === "set"
        ? base.pages && base.pages.length > 0
          ? base.pages
          : buildLocalSetPages(
              args.input,
              Math.max(2, Number(args.input.requestedImageCount || 4)),
            )
        : base.pages,
  };

  return hasCompleteTaskPlanPatch(repaired) ? repaired : null;
};

const tryCompleteTaskPlanPatchLocally = (args: {
  patch: VisualTaskPlanModelPatch | null;
  input: PlanVisualTaskInput;
}) => {
  if (!hasUsableTaskPlanSkeleton(args.patch)) {
    return null;
  }
  return repairIncompleteTaskPlanPatchLocally(args);
};

const summarizeConsistencyContext = (context?: PlannerConsistencyContext) => ({
  subjectAnchorCount: context?.subjectAnchors?.length || 0,
  hasReferenceSummary: Boolean(context?.referenceSummary),
  referenceSummaryExcerpt: String(context?.referenceSummary || "")
    .trim()
    .slice(0, 800),
  forbiddenChanges: (context?.forbiddenChanges || []).slice(0, 6),
});

const buildPlannerPrompt = (
  input: PlanVisualGenerationInput,
  referenceImageCount: number,
  multimodalDiagnostics: {
    inputReferenceCount: number;
    includedReferenceCount: number;
    totalInlineBytes: number;
    maxInlineBytes: number;
  },
) => {
  const requestedMode = input.requestedReferenceRoleMode || "default";
  const consistencySummary = summarizeConsistencyContext(input.consistencyContext);
  const selectedGenerationModel =
    String(input.selectedGenerationModel || "").trim() || "unspecified";
  const selectedModelPlanningLines =
    getSelectedGenerationModelPlanningLines(selectedGenerationModel);
  const taskRoleOverlay = input.taskRoleOverlay;
  const styleLibrary = input.styleLibrary;
  const playbookSections = buildVisualPlaybookSections(
    inferVisualTaskPlaybooks({
      prompt: input.prompt,
      referenceCount: referenceImageCount,
    }),
  );
  const mainBrainPreferenceLines = getMainBrainPreferenceLines();

  return [
    "You are a visual generation planner for an image-generation workspace.",
    "Your job is to classify the user's task and refine the orchestration plan before image generation.",
    "Return JSON only.",
    "Do not include markdown fences.",
    "Do not include explanatory prose.",
    "You must return all required fields: intent, strategyId, referenceRoleMode, locks, allowedEdits, forbiddenEdits, plannerNotes.",
    "",
    "[User Prompt]",
    input.prompt,
    "",
    "[Planner Context]",
    `requestedReferenceRoleMode=${requestedMode}`,
    `manualReferenceCount=${input.manualReferenceImages.length}`,
    `totalReferenceCount=${referenceImageCount}`,
    `includedReferenceCount=${multimodalDiagnostics.includedReferenceCount}`,
    `plannerInlineBudgetBytes=${multimodalDiagnostics.maxInlineBytes}`,
    `plannerInlineBytesUsed=${multimodalDiagnostics.totalInlineBytes}`,
    `imageQuality=${input.imageQuality || "medium"}`,
    `selectedGenerationModel=${selectedGenerationModel}`,
    `translatePromptToEnglish=${input.translatePromptToEnglish ? "true" : "false"}`,
    `enforceChineseTextInImage=${input.enforceChineseTextInImage ? "true" : "false"}`,
    `requiredChineseCopy=${String(input.requiredChineseCopy || "").trim() || "none"}`,
    "",
    "[Consistency Context]",
    JSON.stringify(consistencySummary),
    "",
    taskRoleOverlay
      ? "[Task Role Overlay]\n" +
        JSON.stringify(
          {
            summary: taskRoleOverlay.summary,
            mindset: taskRoleOverlay.mindset,
            planningPolicy: taskRoleOverlay.planningPolicy,
            executionDirectives: taskRoleOverlay.executionDirectives,
            roles: taskRoleOverlay.roles,
          },
          null,
          2,
        )
      : "",
    taskRoleOverlay ? "" : "",
    styleLibrary
      ? "[Task Style Library]\n" +
        JSON.stringify(styleLibrary, null, 2)
      : "",
    styleLibrary ? "" : "",
    input.taskPlanningBrief
      ? "[Task Planning Brief]\n" +
        JSON.stringify(input.taskPlanningBrief, null, 2)
      : "",
    input.taskPlanningBrief ? "" : "",
    buildPromptListSection(
      "Shared Agent Constitution",
      getSharedPlanningConstitutionLines(),
    ),
    "",
    buildPromptListSection(
      "Core Planning Brain",
      getCorePlanningBrainLines(),
    ),
    "",
    buildPromptListSection(
      "Shared Deliverable Decomposition",
      getSharedDeliverableDecompositionLines(),
    ),
    "",
    buildPromptListSection(
      "Shared Planning Self Check",
      getSharedPlanningSelfCheckLines(),
    ),
    "",
    buildPromptListSection(
      "Visual Planning Constitution",
      getVisualPlanningPolicyLines(),
    ),
    mainBrainPreferenceLines.length > 0
      ? ""
      : "",
    mainBrainPreferenceLines.length > 0
      ? buildPromptListSection(
          "User Main Brain Preferences",
          mainBrainPreferenceLines,
        )
      : "",
    "",
    buildPromptListSection(
      "Selected Generation Model Fit Guide",
      selectedModelPlanningLines,
    ),
    "",
    "[Rules]",
    "- If the user clearly wants poster/layout reconstruction with product replacement, use intent=poster_rebuild.",
    "- If the user mainly wants the product identity to stay stable, use intent=product_lock.",
    "- If the user mainly wants background changes while keeping subject stable, use intent=background_replace.",
    "- If the user references multiple images with mixed duties, use intent=multi_reference_fusion unless poster_rebuild is clearly better.",
    "- Only output referenceRoleMode=poster-product when there are at least two manual reference images and the user intent clearly assigns different jobs to them.",
    "- Only output referenceRoleMode=custom when Task Style Library is present and should remain the active upstream constraint.",
    "- Preserve brand identity, product silhouette, packaging structure, and text layout when the user clearly implies they should stay stable.",
    "- strategyId must be present and should usually match the intent unless a clearer strategy id is necessary.",
    "- locks must include all six boolean fields even if some are false.",
    "- Keep allowedEdits and forbiddenEdits concise and practical.",
    "- plannerNotes should explain why you chose the strategy in short phrases.",
    "- Use the Selected Generation Model Fit Guide actively. If the model is prone to collage drift, weak typography, or over-packed compositions, counteract that in strategy, locks, and notes.",
    "- Treat Task Role Overlay as an active temporary system overlay for this task. Let it influence strategy choice, lock strictness, allowed edits, and planner notes.",
    "- If Task Role Overlay says the agent should think through page architecture, model fit, copy load, detail-page logic, or deliverable structure, you must reflect that in the returned plan.",
    "- If requestedReferenceRoleMode=custom and Task Style Library is present, treat that style library as an active upstream constraint.",
    "- For custom style libraries, keep the same reference-role assignment discipline as default mode unless the task clearly requires poster-product behavior.",
    "- Use Task Style Library to clarify how references should be interpreted and what the final prompt must keep constrained.",
    ...(playbookSections.length > 0 ? ["", ...playbookSections] : []),
  ].join("\n");
};

const buildTaskPlannerPrompt = (
  input: PlanVisualTaskInput,
  multimodalDiagnostics: {
    inputReferenceCount: number;
    includedReferenceCount: number;
    totalInlineBytes: number;
    maxInlineBytes: number;
  },
) => {
  const requestedMode = input.requestedReferenceRoleMode || "default";
  const consistencySummary = summarizeConsistencyContext(input.consistencyContext);
  const selectedGenerationModel =
    String(input.selectedGenerationModel || "").trim() || "unspecified";
  const selectedModelPlanningLines =
    getSelectedGenerationModelPlanningLines(selectedGenerationModel);
  const currentStyleLibrary = input.currentStyleLibrary;
  const builtInStyleLibrarySummary = buildBuiltInStyleLibrarySummary();
  const userStyleLibrarySummary = buildUserStyleLibrarySummary();
  const playbooks = inferVisualTaskPlaybooks({
    prompt: input.prompt,
    requestedImageCount: input.requestedImageCount,
    referenceCount: input.referenceImages.length,
  });
  const playbookSections = buildVisualPlaybookSections(playbooks);
  const mainBrainPreferenceLines = getMainBrainPreferenceLines();

  return [
    "You are a visual task planner for an image-generation workspace.",
    "Your job is to decide whether the user's request should run as a single image, a coordinated multi-page set, or an iterative continuation task.",
    "Return JSON only.",
    "Do not include markdown fences.",
    "Do not include explanatory prose outside the JSON fields.",
    "You must return: mode, intent, reasoningSummary, toolChain, planningBrief.",
    "You must also return roleOverlay for this exact task.",
    "When the built-in style-library modes are not enough, you may also return styleLibrary.",
    "If mode=set, also return sharedStyleGuide and pages.",
    "",
    "[User Prompt]",
    input.prompt,
    "",
    "[Task Context]",
    `requestedImageCount=${Math.max(1, Number(input.requestedImageCount || 1))}`,
    `currentAspectRatio=${String(input.currentAspectRatio || "").trim() || "unspecified"}`,
    `imageSize=${String(input.imageSize || "").trim() || "unspecified"}`,
    `imageQuality=${input.imageQuality || "medium"}`,
    `requestedReferenceRoleMode=${requestedMode}`,
    `manualReferenceCount=${input.manualReferenceImages.length}`,
    `totalReferenceCount=${input.referenceImages.length}`,
    `includedReferenceCount=${multimodalDiagnostics.includedReferenceCount}`,
    `plannerInlineBudgetBytes=${multimodalDiagnostics.maxInlineBytes}`,
    `plannerInlineBytesUsed=${multimodalDiagnostics.totalInlineBytes}`,
    `selectedGenerationModel=${selectedGenerationModel}`,
    "",
    "[Consistency Context]",
    JSON.stringify(consistencySummary),
    "",
    currentStyleLibrary
      ? "[Current Style Library]\n" +
        JSON.stringify(currentStyleLibrary, null, 2)
      : "",
    currentStyleLibrary ? "" : "",
    "[Built-in Style Libraries]",
    builtInStyleLibrarySummary || "No built-in style libraries available.",
    "",
    "[User Saved Style Libraries]",
    userStyleLibrarySummary || "No saved user style libraries are currently available.",
    "",
    buildPromptListSection(
      "Shared Agent Constitution",
      getSharedPlanningConstitutionLines(),
    ),
    "",
    buildPromptListSection(
      "Core Planning Brain",
      getCorePlanningBrainLines(),
    ),
    "",
    buildPromptListSection(
      "Shared Deliverable Decomposition",
      getSharedDeliverableDecompositionLines(),
    ),
    "",
    buildPromptListSection(
      "Shared Planning Self Check",
      getSharedPlanningSelfCheckLines(),
    ),
    "",
    buildPromptListSection(
      "Visual Planning Constitution",
      getVisualPlanningPolicyLines(),
    ),
    mainBrainPreferenceLines.length > 0
      ? ""
      : "",
    mainBrainPreferenceLines.length > 0
      ? buildPromptListSection(
          "User Main Brain Preferences",
          mainBrainPreferenceLines,
        )
      : "",
    "",
    buildPromptListSection(
      "Selected Generation Model Fit Guide",
      selectedModelPlanningLines,
    ),
    ...(playbookSections.length > 0 ? ["", ...playbookSections] : []),
    "",
    "[Decision Rules]",
    "- Think like a senior visual strategist, not a keyword expander. First infer the true deliverable, the missing information, the likely page architecture, and the model-fit constraints before choosing mode.",
    "- Expand a hidden research pass before deciding: what kind of deliverable this really is, what a strong human designer would need to check first, what proof or information the final images must carry, and what the selected model is likely to mishandle.",
    "- Use mode=single for one final image request, even if the user wants a few ordinary variations.",
    "- Use mode=set when the user wants a coordinated multi-page deliverable, such as detail pages, social sets, campaign sets, cover + selling points + details, or any request where each image should play a different role.",
    "- Use mode=iterative when the user clearly wants to continue from earlier approved results or extend an existing set.",
    "- Do not collapse a multi-page set into generic variations.",
    "- If mode=set, pages must describe distinct page roles rather than duplicate prompts.",
    "- sharedStyleGuide should capture what must stay visually consistent across the set.",
    "- Each page must specify aspectRatio, mustShow, and forbiddenEdits.",
    "- planningBrief.requestType should classify the job, for example: product_detail_page_set, poster_edit, product_scene, lifestyle_set, comparison_sheet.",
    "- planningBrief.deliverableForm should describe the actual output form, such as a 4-page e-commerce detail set or one edited hero image.",
    "- planningBrief.aspectRatioStrategy should explain why the chosen ratios fit the deliverable rather than blindly copying the current ratio.",
    "- planningBrief.researchFocus should list what a strong agent must think through. For detail pages this often includes selling points, page roles, visual hierarchy, copy load, specification coverage, and scene coverage.",
    "- planningBrief.researchDecision should decide whether real pre-generation research would materially improve the plan.",
    "- planningBrief.researchDecision.mode must be one of: none, images, web+images.",
    "- Use researchDecision.mode=web+images when the task depends on external conventions, platform norms, category references, deliverable standards, or evidence not already contained in the current prompt and attachments.",
    "- Use researchDecision.mode=images when the main missing value is broader visual reference gathering rather than web-page facts.",
    "- If Consistency Context already includes a meaningful referenceSummaryExcerpt from prior research, treat that as available evidence and avoid requesting the same research again unless there is a clearly new unresolved gap.",
    "- If you choose shouldResearch=false, explain why the current prompt and references are already sufficient.",
    "- If you choose shouldResearch=true, researchDecision.topics should name what to investigate first, and researchDecision.searchQueries should provide concrete search phrases for the next step.",
    "- planningBrief.modelFitNotes should reflect likely strengths or weaknesses of the selected image model family for this task, grounded in selectedGenerationModel when it is provided, such as whether it tends to make collage-like pages, struggles with dense copy, or is better for hero scenes than typography.",
    "- planningBrief.promptDirectives should capture how prompts should be written for this task, such as one page per image, avoid multi-panel collage, keep clean hero composition, or reserve text-safe space.",
    "- planningBrief.risks should list likely failure modes or ambiguities.",
    "- If the task implies ecommerce detail pages, the plan must reflect actual detail-page thinking: page architecture, page order, evidence coverage, ratio choice, text-safe layout, and conversion logic. Do not answer like a keyword clustering tool.",
    "- If the user provides a broad goal like '做详情页' with only a product reference, infer a practical page system instead of repeating the same request across all pages.",
    "- toolChain should describe the high-level execution order, such as classify, plan, compose, generate, evaluate.",
    "- roleOverlay is a temporary task-specific role composition, not a fixed persona name. Use it to define how a strong agent should think for this job before writing prompts.",
    "- roleOverlay.summary should explain what kind of combined brain this task needs.",
    "- roleOverlay.mindset should describe the working stance, such as strategist first, then prompt engineer, then model-fit reviewer.",
    "- roleOverlay.planningPolicy should list how this temporary role set should reason through the task.",
    "- roleOverlay.executionDirectives should list what the downstream visual planner and prompt composer must keep doing.",
    "- roleOverlay.roles should list distinct temporary roles with mission, focus, and outputContract.",
    "- Built-in style libraries are preferred when they are sufficient. Do not invent a custom style library just to rename an existing default behavior.",
    "- First decide whether an existing built-in style library already fits. Reuse should be the default when the existing library is already sufficient.",
    "- If a saved user style library already matches the task, prefer reusing it or lightly refining it instead of inventing a brand-new temporary library.",
    "- Prefer refining the Current Style Library when it already carries the right upstream reference-interpretation logic and only needs small adjustments.",
    "- Only return styleLibrary when the built-in style-library modes are not enough and the task clearly needs a task-specific upstream reference-interpretation policy.",
    "- If you return styleLibrary, it must describe how to interpret the references and what prompt/planning constraints must stay active downstream.",
    "- If Current Style Library is already present and still fits the task, you may keep or refine it instead of discarding it.",
    "- Create a brand-new temporary styleLibrary only when neither the built-in libraries, nor the current library, nor the saved user libraries can responsibly cover the task.",
    "",
    "[Page Planning Guidance]",
    "- Prefer concise Chinese-friendly titles if the prompt is in Chinese.",
    "- Reuse the user's current aspect ratio when appropriate unless a page clearly needs a different ratio.",
    "- If the user explicitly asks for N pages, plan around that count unless it would obviously violate the request.",
    "- If the user does not specify page count, decide a practical set size.",
    "- For product detail pages, do not plan every page as a generic square poster. Prefer a commercially sensible structure such as cover, selling point, detail, and scene/spec pages when appropriate.",
    "- For product detail pages, avoid repeating the same goal in every page. Each page should answer a different buyer question or perform a different conversion duty.",
    "- If the user asks for detail pages, ecommerce pages, campaign sets, or other convention-heavy deliverables but does not provide page architecture, selling points, specs, or conversion logic, you should usually request researchDecision.shouldResearch=true.",
    "- If the user provides only a product image and a broad request like '做详情页', assume the plan is under-specified. Think through what information a competent designer would need, and prefer research that helps you infer page roles, evidence coverage, and common ratio conventions.",
    "- Do not treat a broad task as solved just by polishing keywords. First decide what must be learned, what must be inferred, and what must be deliberately constrained.",
    "- When the selected model is weak at dense typography or tends to over-pack compositions, keep page prompts visually clean and explicitly prohibit collage drift where needed.",
    "- For mode=set, executionPrompt should usually be present for each page whenever generic page fields would still leave room for bland or repetitive prompting.",
    "- For each set page, include executionPrompt when page-level prompting needs to be more precise than the generic plan. executionPrompt should explicitly describe that page only, not the whole set.",
    "- If the request is under-specified, surface the missing information inside planningBrief instead of pretending nothing is ambiguous.",
  ].join("\n");
};

const estimateDataUrlBytes = (dataUrl: string): number => {
  const value = String(dataUrl || "");
  const commaIndex = value.indexOf(",");
  const base64 = commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
  return Math.floor((base64.length * 3) / 4);
};

const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REFERENCE_IMAGE_EDGE = 2048;
const REFERENCE_COMPRESS_QUALITIES = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42];

const blobToDataUrl = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("reference image read failed"));
    reader.readAsDataURL(blob);
  });

const loadImageFromBlob = async (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("reference image decode failed"));
    };
    image.src = objectUrl;
  });

const renderCanvasToBlob = async (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });

const shouldPreserveReferenceTransparency = (mimeType: string): boolean => {
  const normalized = String(mimeType || "").toLowerCase();
  return (
    normalized.includes("png") ||
    normalized.includes("webp") ||
    normalized.includes("gif")
  );
};

const compressReferenceDataUrlIfNeeded = async (
  dataUrl: string,
  maxBytes: number,
): Promise<string> => {
  const originalBytes = estimateDataUrlBytes(dataUrl);
  if (originalBytes <= maxBytes) {
    return dataUrl;
  }

  if (typeof document === "undefined") {
    return dataUrl;
  }

  const sourceBlob = await fetch(dataUrl).then((response) => response.blob());
  const sourceMimeType =
    String(sourceBlob.type || "").trim() ||
    String(dataUrl.match(/^data:(.+);base64,/)?.[1] || "").trim() ||
    "image/png";
  const preserveTransparency = shouldPreserveReferenceTransparency(sourceMimeType);
  const image = await loadImageFromBlob(sourceBlob);
  const sourceWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const sourceHeight = Math.max(1, image.naturalHeight || image.height || 1);

  let scale = Math.min(1, MAX_REFERENCE_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
  let bestDataUrl = dataUrl;
  let bestBytes = originalBytes;

  for (let pass = 0; pass < 6; pass += 1) {
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("canvas context unavailable");
    }
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    if (preserveTransparency) {
      const blob = await renderCanvasToBlob(canvas, "image/png");
      if (blob) {
        const candidateDataUrl = await blobToDataUrl(blob);
        const candidateBytes = estimateDataUrlBytes(candidateDataUrl);
        if (candidateBytes < bestBytes) {
          bestBytes = candidateBytes;
          bestDataUrl = candidateDataUrl;
        }
        if (candidateBytes <= maxBytes) {
          return candidateDataUrl;
        }
      }
    } else {
      for (const quality of REFERENCE_COMPRESS_QUALITIES) {
        const blob = await renderCanvasToBlob(canvas, "image/jpeg", quality);
        if (!blob) continue;
        const candidateDataUrl = await blobToDataUrl(blob);
        const candidateBytes = estimateDataUrlBytes(candidateDataUrl);
        if (candidateBytes < bestBytes) {
          bestBytes = candidateBytes;
          bestDataUrl = candidateDataUrl;
        }
        if (candidateBytes <= maxBytes) {
          return candidateDataUrl;
        }
      }
    }

    scale *= 0.82;
  }

  return bestDataUrl;
};

const buildReferenceParts = async (referenceImages: string[]) => {
  const policy = getVisualOrchestratorInputPolicy();
  const maxReferenceImages = policy.maxReferenceImages;
  const maxInlineBytes = Math.max(1, policy.maxInlineImageBytesMb) * 1024 * 1024;
  if (maxReferenceImages > 0 && referenceImages.length > maxReferenceImages) {
    throw new Error(
      `Visual orchestration received ${referenceImages.length} reference images, which exceeds the configured limit of ${maxReferenceImages}. Raise the limit in Settings or reduce the references before generating.`,
    );
  }

  const parts: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> = [];
  let totalInlineBytes = 0;

  for (let index = 0; index < referenceImages.length; index += 1) {
    const normalized = await normalizeReferenceToModelInputDataUrl(referenceImages[index]);
    if (!normalized) {
      throw new Error(
        `Visual orchestration could not load reference image ${index + 1}. Planning was stopped to avoid silently ignoring that reference.`,
      );
    }
    const match = normalized.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      throw new Error(
        `Visual orchestration could not decode reference image ${index + 1} into a valid multimodal input.`,
      );
    }
    const compressed = await compressReferenceDataUrlIfNeeded(
      normalized,
      MAX_REFERENCE_IMAGE_BYTES,
    );
    const compressedMatch = compressed.match(/^data:(.+);base64,(.+)$/);
    if (!compressedMatch) {
      throw new Error(
        `Visual orchestration could not decode reference image ${index + 1} after compression.`,
      );
    }
    const candidateBytes = estimateDataUrlBytes(compressed);
    if (candidateBytes > MAX_REFERENCE_IMAGE_BYTES) {
      throw new Error(
        `Visual orchestration could not compress reference image ${index + 1} under the per-image limit of 8MB. Current size is ${(candidateBytes / 1024 / 1024).toFixed(2)}MB. Please reduce that reference image before generating.`,
      );
    }
    if (totalInlineBytes + candidateBytes > maxInlineBytes) {
      throw new Error(
        `Visual orchestration image budget exceeded at reference ${index + 1}. Used ${(totalInlineBytes / 1024 / 1024).toFixed(2)}MB, next image adds ${(candidateBytes / 1024 / 1024).toFixed(2)}MB, budget is ${policy.maxInlineImageBytesMb}MB. Raise the budget in Settings or reduce the references before generating.`,
      );
    }

    parts.push({
      text: `Reference image ${index + 1}`,
    });
    parts.push({
      inlineData: {
        mimeType: compressedMatch[1],
        data: compressedMatch[2],
      },
    });
    totalInlineBytes += candidateBytes;
  }

  return {
    parts,
    diagnostics: {
      inputReferenceCount: referenceImages.length,
      includedReferenceCount: referenceImages.length,
      totalInlineBytes,
      maxInlineBytes,
    },
  };
};

export const generateVisualPlanModelPatch = async (args: {
  input: PlanVisualGenerationInput;
  modelId: string;
  providerId?: string | null;
}): Promise<VisualPlanModelPatch | null> => {
  const { input, modelId, providerId } = args;
  const { parts: referenceParts, diagnostics } = await buildReferenceParts(
    input.referenceImages,
  );
  const prompt = buildPlannerPrompt(
    input,
    input.referenceImages.length,
    diagnostics,
  );
  const parts = [
    ...referenceParts,
    {
      text: prompt,
    },
  ];

  try {
    const response = await generateJsonResponse({
      model: modelId,
      providerId,
      parts,
      temperature: 0.2,
      responseSchema: VISUAL_PLAN_RESPONSE_SCHEMA,
      operation: "visualOrchestratorPlan",
      queueKey: "visualOrchestratorPlan",
      minIntervalMs: 400,
      requestTuning: {
        timeoutMs: 45000,
        retries: 1,
        baseDelayMs: 800,
        maxDelayMs: 3000,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const normalized = normalizeModelPatch(parsed);
    if (normalized) {
      normalized.rawResponseText = response.text || "";
    }
    if (hasCompleteModelPatch(normalized)) {
      return normalized;
    }

    const repairResponse = await generateJsonResponse({
      model: modelId,
      providerId,
      parts: [
        {
          text: buildRepairPrompt(response.text || "{}"),
        },
      ],
      temperature: 0.1,
      responseSchema: VISUAL_PLAN_RESPONSE_SCHEMA,
      operation: "visualOrchestratorPlan.repair",
      queueKey: "visualOrchestratorPlan",
      minIntervalMs: 400,
      requestTuning: {
        timeoutMs: 30000,
        retries: 0,
        baseDelayMs: 500,
        maxDelayMs: 1500,
      },
    });

    const repairedParsed = JSON.parse(repairResponse.text || "{}");
    const repaired = normalizeModelPatch(repairedParsed);
    if (repaired) {
      repaired.rawResponseText = repairResponse.text || "";
    }
    return repaired;
  } catch (error) {
    console.warn("[vision-orchestrator] model planning failed", {
      modelId,
      providerId: providerId || null,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const generateVisualTaskPlanModelPatch = async (args: {
  input: PlanVisualTaskInput;
  modelId: string;
  providerId?: string | null;
  onThought?: VisualPlanningThoughtHandler;
  requestId?: string;
  onQueueEvent?: (event: {
    phase: "waiting" | "running";
    queueKey: string;
    waitMs: number;
  }) => void;
}): Promise<VisualTaskPlanModelPatch | null> => {
  const { input, modelId, providerId, onThought, requestId, onQueueEvent } = args;
  const { parts: referenceParts, diagnostics } = await buildReferenceParts(
    input.referenceImages,
  );
  const prompt = buildTaskPlannerPrompt(input, diagnostics);
  const parts = [
    ...referenceParts,
    {
      text: prompt,
    },
  ];
  const streamingThoughtBridge = createStreamingPlanningThoughtBridge(onThought);

  try {
    const response = await generateJsonResponse({
      model: modelId,
      providerId,
      parts,
      temperature: 0.2,
      responseSchema: VISUAL_TASK_PLAN_RESPONSE_SCHEMA,
      operation: "visualTaskPlan",
      queueKey: "visualTaskPlan",
      minIntervalMs: 400,
      onReasoningDelta: streamingThoughtBridge.onReasoningDelta,
      onQueueEvent,
      requestTuning: {
        timeoutMs: 45000,
        retries: 1,
        baseDelayMs: 800,
        maxDelayMs: 3000,
        requestFingerprint: requestId,
      },
    });

    streamingThoughtBridge.flush();
    emitPlanningThought(onThought, "正在解析返回结果", "规划模型已返回，开始读取它的任务判断。");
    const parsed = JSON.parse(response.text || "{}");
    const normalized = normalizeTaskPlanPatch(parsed);
    if (normalized) {
      normalized.rawResponseText = response.text || "";
      buildTaskPlannerResultThoughtsClean(normalized).forEach((line) => {
        emitPlanningThought(onThought, "正在展开思路", line);
      });
    }
    if (hasCompleteTaskPlanPatch(normalized)) {
      return normalized;
    }
    const localCompletion = tryCompleteTaskPlanPatchLocally({
      patch: normalized,
      input,
    });
    if (localCompletion) {
      return localCompletion;
    }
    const announcedTaskPlanRetry = shouldAnnounceTaskPlanRetry(normalized);
    if (announcedTaskPlanRetry) {
      emitPlanningThought(
      onThought,
      "正在智能补全规划",
      "首轮返回字段不够完整，我会基于原始上下文和部分结果再做一轮智能补全。",
    );
    }
    const agentFallbackResponse = await generateJsonResponse({
      model: modelId,
      providerId,
      parts: [
        ...referenceParts,
        {
          text: prompt,
        },
        {
          text: buildTaskPlanAgentFallbackPrompt({
            rawResponseText: response.text || "{}",
            partialPatch: normalized,
          }),
        },
      ],
      temperature: 0.15,
      responseSchema: VISUAL_TASK_PLAN_RESPONSE_SCHEMA,
      operation: "visualTaskPlan.agentFallback",
      queueKey: "visualTaskPlan",
      minIntervalMs: 400,
      onReasoningDelta: streamingThoughtBridge.onReasoningDelta,
      onQueueEvent,
      requestTuning: {
        timeoutMs: 35000,
        retries: 0,
        baseDelayMs: 500,
        maxDelayMs: 1800,
        requestFingerprint: requestId,
      },
    });

    streamingThoughtBridge.flush();
    if (announcedTaskPlanRetry) {
      emitPlanningThought(
      onThought,
      "正在校验智能补全结果",
      "智能补全结果已返回，正在重新校验字段完整性。",
    );
    }
    const agentFallbackParsed = JSON.parse(agentFallbackResponse.text || "{}");
    const agentFallback = normalizeTaskPlanPatch(agentFallbackParsed);
    if (agentFallback) {
      agentFallback.rawResponseText = agentFallbackResponse.text || "";
      buildTaskPlannerResultThoughtsClean(agentFallback).forEach((line) => {
        emitPlanningThought(onThought, "正在展开思路", line);
      });
    }
    if (hasCompleteTaskPlanPatch(agentFallback)) {
      return agentFallback;
    }
    const localCompletionAfterFallback = tryCompleteTaskPlanPatchLocally({
      patch: agentFallback,
      input,
    });
    if (localCompletionAfterFallback) {
      return localCompletionAfterFallback;
    }
    emitPlanningThought(
      onThought,
      "正在修复规划结果",
      "首轮返回结构不够完整，我会先修复结构，再继续往下执行。",
    );
    const repairResponse = await generateJsonResponse({
      model: modelId,
      providerId,
      parts: [
        {
          text: buildTaskPlanRepairPrompt(
            agentFallbackResponse.text || response.text || "{}",
          ),
        },
      ],
      temperature: 0.1,
      responseSchema: VISUAL_TASK_PLAN_RESPONSE_SCHEMA,
      operation: "visualTaskPlan.repair",
      queueKey: "visualTaskPlan",
      minIntervalMs: 400,
      onReasoningDelta: streamingThoughtBridge.onReasoningDelta,
      onQueueEvent,
      requestTuning: {
        timeoutMs: 30000,
        retries: 0,
        baseDelayMs: 500,
        maxDelayMs: 1500,
        requestFingerprint: requestId,
      },
    });

    streamingThoughtBridge.flush();
    emitPlanningThought(onThought, "正在修复规划结果", "修复结果已返回，正在重新校验字段完整性。");
    const repairedParsed = JSON.parse(repairResponse.text || "{}");
    const repaired = normalizeTaskPlanPatch(repairedParsed);
    if (repaired) {
      repaired.rawResponseText = repairResponse.text || "";
      buildTaskPlannerResultThoughtsClean(repaired).forEach((line) => {
        emitPlanningThought(onThought, "正在展开思路", line);
      });
    }
    return (
      repaired ||
      repairIncompleteTaskPlanPatchLocally({
        patch: agentFallback || normalized,
        input,
      })
    );
  } catch (error) {
    streamingThoughtBridge.flush();
    const localFallback = repairIncompleteTaskPlanPatchLocally({
      patch: null,
      input,
    });
    if (localFallback) {
      emitPlanningThought(
        onThought,
        "正在补全规划结构",
        "远端修复步骤失败了，我已改为本地补结构继续执行这次任务。",
      );
      return localFallback;
    }
    emitPlanningThought(
      onThought,
      "规划失败",
      `任务规划阶段出错：${clipThoughtText(
        error instanceof Error ? error.message : String(error),
        120,
      )}`,
    );
    console.warn("[vision-orchestrator] task planning failed", {
      modelId,
      providerId: providerId || null,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
