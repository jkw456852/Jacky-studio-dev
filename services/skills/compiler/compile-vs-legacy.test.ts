import assert from "node:assert/strict";
import test from "node:test";

import { listLegacyPresetSkillCatalogEntries } from "../legacy/legacy-skill-catalog.ts";
import { resolveFrontstageSkillExecutionProfile } from "../../agents/frontstage-skill-execution.ts";
import { compileSkillPlan } from "./skill-compiler.ts";
import {
  diffCompiledSkillPlanAgainstLegacy,
  summarizeCompiledSkillPlanDiff,
} from "./compile-vs-legacy.ts";

test("diff utility shows match for every builtin preset under autonomous+web research", () => {
  const entries = listLegacyPresetSkillCatalogEntries();
  assert.ok(entries.length > 0);
  const mismatches: string[] = [];
  for (const entry of entries) {
    const metadata = {
      allowAutonomousRouting: true,
      enableWebSearch: true,
      skillData: entry.legacyMetadata.skillData,
    };
    const profile = resolveFrontstageSkillExecutionProfile(metadata as any);
    const plan = compileSkillPlan({ version: entry.version, metadata });
    const result = diffCompiledSkillPlanAgainstLegacy(plan, profile);
    if (!result.match) {
      mismatches.push(`${entry.legacyMetadata.frontstagePreset?.id}: ${summarizeCompiledSkillPlanDiff(result)}`);
    }
  }
  assert.equal(mismatches.length, 0, mismatches.join("\n---\n"));
});

test("diff utility reports drift fields when web search is disabled", () => {
  const entry = listLegacyPresetSkillCatalogEntries().find(
    (e) => e.version.manifest.execution?.preferredSkills?.includes("workspaceSearch") === true,
  );
  assert.ok(entry, "expected at least one preset with workspaceSearch in preferred skills");
  const metadataOn = { allowAutonomousRouting: true, enableWebSearch: true, skillData: entry!.legacyMetadata.skillData };
  const metadataOff = { allowAutonomousRouting: true, enableWebSearch: false, skillData: entry!.legacyMetadata.skillData };
  const profileOff = resolveFrontstageSkillExecutionProfile(metadataOff as any);
  const planOn = compileSkillPlan({ version: entry!.version, metadata: metadataOn });
  const resultDrift = diffCompiledSkillPlanAgainstLegacy(planOn, profileOff);
  assert.equal(resultDrift.match, false);
  assert.ok(resultDrift.drift.some((d) => d.path === "blockedSkills"));
});
