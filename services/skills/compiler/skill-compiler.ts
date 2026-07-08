import type {
  SkillVersion,
  SkillManifest,
  ExecutionRecipeStep,
  ToolPolicyRule,
} from "../catalog/skill-object-types.ts";
import {
  parseExecutionRecipeLines,
  normalizeFrontstageSkillRouteIntent,
  type FrontstageExecutionRecipeStep,
  type FrontstageSkillRouteIntent,
} from "../../runtime-assets/frontstage-skill-recipes.ts";
import { normalizeRegisteredSkillName } from "../skill-manifest.ts";

export interface SkillCompilerMetadata {
  allowAutonomousRouting?: boolean;
  enableWebSearch?: boolean;
  webResearchStatus?: string;
  taskMode?: string;
  skillFollowUpMode?: string;
  [extra: string]: unknown;
}

export interface CompiledSkillPlan {
  active: boolean;
  skillDefinitionId: string;
  skillVersionId: string;
  skillKey: string;
  skillLabel: string;
  routeIntent: FrontstageSkillRouteIntent;
  routeLabel: string;
  routeSummary: string;
  followUpMode: "auto-clarify" | "direct-run" | null;
  preferredSkills: string[];
  blockedSkills: string[];
  preferredFirstSkill: string | null;
  requiresResearchOptIn: boolean;
  suggestedTaskMode: string;
  requiresAttachments: boolean;
  isCustomSkill: boolean;
  instruction: string;
  clarifyChecklist: string[];
  executionOutline: string[];
  executionRecipeLines: string[];
  executionRecipe: FrontstageExecutionRecipeStep[];
  outputBlueprint: string[];
  toolPolicy: string[];
}

const clip = (value: unknown, maxChars = 240): string =>
  String(value ?? "").replace(/\r\n/g, "\n").trim().slice(0, maxChars);

const normalizeString = (value: unknown): string => clip(value, 1024);

const normalizeStringList = (value: unknown, maxItems = 8): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => clip(item, 240))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

const dedupeSkills = (skills: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const skill of skills) {
    const normalized = normalizeRegisteredSkillName(skill);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
};

const containsAny = (source: string, patterns: string[]): boolean =>
  patterns.some((pattern) => source.includes(pattern));

const toolPolicyToStrings = (rules?: ToolPolicyRule[]): string[] => {
  if (!Array.isArray(rules)) return [];
  return rules
    .map((rule) => {
      if (typeof rule === "string") return clip(rule, 240);
      if (rule && typeof rule === "object") {
        const text = (rule as Record<string, unknown>).text;
        if (typeof text === "string") return clip(text, 240);
        return clip(JSON.stringify(rule), 240);
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 8);
};

const recipeToLines = (recipe?: ExecutionRecipeStep[]): string[] => {
  if (!Array.isArray(recipe)) return [];
  return recipe
    .map((step) => (typeof step === "string" ? clip(step, 240) : clip(JSON.stringify(step), 240)))
    .filter(Boolean)
    .slice(0, 8);
};

const inferBlockedSkillsFromToolPolicy = (toolPolicy: string[]): string[] => {
  const text = toolPolicy.join("\n").toLowerCase();
  const blocked = new Set<string>();
  if (
    containsAny(text, [
      "不要一上来直接出成片",
      "不要一上来直接出视频",
      "不要直接出成片",
      "先不要直接生成视频",
      "不要先做视频",
      "do not jump straight into final video",
      "don't start with final video",
      "do not generate final video first",
    ])
  ) {
    blocked.add("generateVideo");
  }
  if (
    containsAny(text, [
      "不要把整套轮播压成一张图",
      "不要把多屏压成一张图",
      "不要压成一张图",
      "do not compress the whole set into one image",
      "do not compress multiple pages into one image",
    ])
  ) {
    blocked.add("generateImage");
  }
  return [...blocked];
};

const inferPreferredFirstSkillFromToolPolicy = (
  toolPolicy: string[],
  preferredSkills: string[],
): string | null => {
  const text = toolPolicy.join("\n").toLowerCase();
  if (
    containsAny(text, [
      "先用 generatecopy",
      "优先用 generatecopy",
      "use generatecopy first",
      "start with generatecopy",
    ]) &&
    preferredSkills.includes("generateCopy")
  ) {
    return "generateCopy";
  }
  if (
    containsAny(text, [
      "先用 workspacesearch",
      "先搜索",
      "先研究",
      "use workspacesearch first",
      "start with workspacesearch",
      "start with research",
    ]) &&
    preferredSkills.includes("workspaceSearch")
  ) {
    return "workspaceSearch";
  }
  if (
    containsAny(text, [
      "先用 smartedit",
      "先编辑",
      "use smartedit first",
      "start with smartedit",
    ]) &&
    preferredSkills.includes("smartEdit")
  ) {
    return "smartEdit";
  }
  return preferredSkills[0] || null;
};

const inferRequiresResearchOptInFromToolPolicy = (toolPolicy: string[]): boolean => {
  const text = toolPolicy.join("\n").toLowerCase();
  return containsAny(text, [
    "只有用户明确要补竞品",
    "只有用户明确要补研究",
    "明确要补竞品",
    "明确要补趋势",
    "才调用 workspacesearch",
    "only when the user explicitly asks for research",
    "only search when explicit",
    "only use workspacesearch when explicit",
    "only call workspacesearch when",
  ]);
};

export interface CompileSkillPlanArgs {
  version: SkillVersion;
  metadata?: SkillCompilerMetadata | Record<string, unknown>;
}

export const compileSkillPlan = ({ version, metadata }: CompileSkillPlanArgs): CompiledSkillPlan => {
  const manifest: SkillManifest = version.manifest;
  const meta = (metadata ?? {}) as Record<string, unknown>;

  const preferredSkills = dedupeSkills(
    (manifest.execution?.preferredSkills ?? []).map((s) => normalizeRegisteredSkillName(s)),
  );
  const toolPolicy = toolPolicyToStrings(manifest.execution?.toolPolicy);
  const blockedFromManifest = dedupeSkills(
    (manifest.execution?.blockedSkills ?? []).map((s) => normalizeRegisteredSkillName(s)),
  );
  const blockedFromPolicy = dedupeSkills(
    inferBlockedSkillsFromToolPolicy(toolPolicy).map((s) => normalizeRegisteredSkillName(s)),
  );
  const blocked = dedupeSkills([...blockedFromManifest, ...blockedFromPolicy]);

  const networkResearchEnabled =
    meta.enableWebSearch === true && meta.webResearchStatus !== "failed";
  if (!networkResearchEnabled) {
    if (!blocked.includes("workspaceSearch")) blocked.push("workspaceSearch");
  }

  const inferredFirst = normalizeRegisteredSkillName(
    inferPreferredFirstSkillFromToolPolicy(toolPolicy, preferredSkills) ?? "",
  );
  const preferredFromManifest = normalizeRegisteredSkillName(
    manifest.execution?.preferredFirstSkill ?? "",
  );
  const preferredFirstCandidate =
    inferredFirst || preferredFromManifest || preferredSkills[0] || "";
  const preferredFirstSkill =
    preferredFirstCandidate && !blocked.includes(preferredFirstCandidate)
      ? preferredFirstCandidate
      : null;

  const followUpFromMeta = clip(meta.skillFollowUpMode, 40);
  const followUpFromManifest = clip(manifest.routing?.followUpMode, 40);
  const followUpRaw = followUpFromMeta || followUpFromManifest;
  const followUpMode =
    followUpRaw === "auto-clarify" || followUpRaw === "direct-run" ? followUpRaw : null;

  const routeIntent = normalizeFrontstageSkillRouteIntent(manifest.routing?.routeIntent);
  const executionRecipeLines = recipeToLines(manifest.execution?.recipe);
  const executionRecipe = parseExecutionRecipeLines(executionRecipeLines, routeIntent, 8);

  const skillLabel = clip(manifest.identity?.displayName, 120);
  const skillKey = clip(manifest.identity?.key, 120) || clip(version.skillDefinitionId, 120);

  const activeFlag =
    meta.allowAutonomousRouting === true &&
    Boolean(version.skillDefinitionId || skillKey);

  return {
    active: activeFlag,
    skillDefinitionId: clip(version.skillDefinitionId, 120),
    skillVersionId: clip(version.id, 120),
    skillKey,
    skillLabel,
    routeIntent,
    routeLabel: skillLabel,
    routeSummary: clip(manifest.identity?.namespace, 240),
    followUpMode,
    preferredSkills,
    blockedSkills: blocked,
    preferredFirstSkill,
    requiresResearchOptIn: inferRequiresResearchOptInFromToolPolicy(toolPolicy),
    suggestedTaskMode: clip(manifest.routing?.taskMode, 40).toLowerCase(),
    requiresAttachments: manifest.ui?.requiresAttachments === true,
    isCustomSkill: manifest.identity?.namespace === "workspace" || version.skillDefinitionId.includes("__workspace__"),
    instruction: clip(manifest.ui?.activationHint, 1024),
    clarifyChecklist: normalizeStringList(manifest.routing?.clarifyChecklist, 8),
    executionOutline: normalizeStringList(manifest.outputContract?.executionOutline, 8),
    executionRecipeLines,
    executionRecipe,
    outputBlueprint: normalizeStringList(manifest.outputContract?.blueprint, 8),
    toolPolicy,
  };
};

export const isCompiledSkillPlanActive = (plan: CompiledSkillPlan | null | undefined): boolean =>
  Boolean(plan?.active);
