import type { FrontstageSkillExecutionProfile } from "../../agents/frontstage-skill-execution.ts";
import type { CompiledSkillPlan } from "./skill-compiler.ts";

export interface CompiledSkillPlanDiffField {
  path: string;
  legacyValue: unknown;
  compiledValue: unknown;
}

export interface CompiledSkillPlanDiffResult {
  match: boolean;
  drift: CompiledSkillPlanDiffField[];
}

const eq = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!eq(a[i], b[i])) return false;
    }
    return true;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a as Record<string, unknown>).sort();
    const bk = Object.keys(b as Record<string, unknown>).sort();
    if (!eq(ak, bk)) return false;
    for (const k of ak) {
      if (!eq((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
    }
    return true;
  }
  return Object.is(a, b);
};

const pushIfDiff = (
  out: CompiledSkillPlanDiffField[],
  path: string,
  legacyValue: unknown,
  compiledValue: unknown,
): void => {
  if (!eq(legacyValue, compiledValue)) {
    out.push({ path, legacyValue, compiledValue });
  }
};

export const diffCompiledSkillPlanAgainstLegacy = (
  plan: CompiledSkillPlan,
  profile: FrontstageSkillExecutionProfile,
): CompiledSkillPlanDiffResult => {
  const drift: CompiledSkillPlanDiffField[] = [];
  pushIfDiff(drift, "active", profile.active, plan.active);
  pushIfDiff(drift, "routeIntent", profile.routeIntent, plan.routeIntent);
  pushIfDiff(drift, "followUpMode", profile.followUpMode, plan.followUpMode);
  pushIfDiff(drift, "preferredSkills", profile.preferredSkills, plan.preferredSkills);
  pushIfDiff(drift, "blockedSkills", profile.blockedSkills, plan.blockedSkills);
  pushIfDiff(drift, "preferredFirstSkill", profile.preferredFirstSkill, plan.preferredFirstSkill);
  pushIfDiff(drift, "requiresResearchOptIn", profile.requiresResearchOptIn, plan.requiresResearchOptIn);
  pushIfDiff(drift, "suggestedTaskMode", profile.suggestedTaskMode, plan.suggestedTaskMode);
  pushIfDiff(drift, "requiresAttachments", profile.requiresAttachments, plan.requiresAttachments);
  pushIfDiff(drift, "toolPolicy", profile.toolPolicy, plan.toolPolicy);
  pushIfDiff(drift, "executionRecipeLines", profile.executionRecipeLines, plan.executionRecipeLines);
  pushIfDiff(drift, "clarifyChecklist", profile.clarifyChecklist, plan.clarifyChecklist);
  pushIfDiff(drift, "outputBlueprint", profile.outputBlueprint, plan.outputBlueprint);
  pushIfDiff(drift, "executionOutline", profile.executionOutline, plan.executionOutline);
  return { match: drift.length === 0, drift };
};

export const summarizeCompiledSkillPlanDiff = (
  result: CompiledSkillPlanDiffResult,
): string => {
  if (result.match) return "compiled-plan matches legacy profile";
  return result.drift
    .map((d) => `${d.path}: legacy=${JSON.stringify(d.legacyValue)} compiled=${JSON.stringify(d.compiledValue)}`)
    .join("\n");
};
