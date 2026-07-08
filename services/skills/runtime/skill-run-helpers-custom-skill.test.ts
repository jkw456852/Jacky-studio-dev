import assert from "node:assert/strict";
import test from "node:test";

import {
  finalizeRunFromExecutionOutcome,
  recordRunFromExecutionContext,
} from "./skill-run-helpers.ts";
import { createSkillRunRecorder } from "../runs/skill-run-recorder.ts";

const sampleCustomSkillData = () => ({
  id: "runtime-only-custom-run",
  name: "Runtime Only Custom Run",
  iconName: "Sparkles",
  config: {
    isCustomSkill: true,
    name: "Runtime Only Custom Run Draft",
    summary: "Draft summary for runtime-only custom run.",
    description: "Draft summary for runtime-only custom run.",
    instruction: "Draft instruction for runtime-only custom run.",
    iconName: "Sparkles",
    routeIntent: "branding",
    routeLabel: "Runtime Only Draft",
    routeSummary: "Draft route summary.",
    preferredSkills: ["workspaceSearch"],
    suggestedTaskMode: "research",
    followUpMode: "direct-run",
    executionRecipe: ["research", "generateCopy"],
    outputBlueprint: ["draft output"],
    updatedAt: 200,
    skillGovernance: {
      schemaVersion: 1,
      currentPublishedVersionId: "skill_ver__workspace__runtime-only-custom-run__v1",
      currentDraftVersionId: "skill_ver__workspace__runtime-only-custom-run__v2",
      versions: [
        {
          id: "skill_ver__workspace__runtime-only-custom-run__v2",
          semver: "1.1.0",
          reviewStatus: "draft",
          releaseStatus: "draft",
          createdAt: 190,
          updatedAt: 200,
          createdBy: "workspace",
          snapshot: {
            name: "Runtime Only Custom Run Draft",
            summary: "Draft summary for runtime-only custom run.",
            description: "Draft summary for runtime-only custom run.",
            instruction: "Draft instruction for runtime-only custom run.",
            iconName: "Sparkles",
            routeIntent: "branding",
            routeLabel: "Runtime Only Draft",
            routeSummary: "Draft route summary.",
            preferredSkills: ["workspaceSearch"],
            suggestedTaskMode: "research",
            followUpMode: "direct-run",
            executionRecipe: ["research", "generateCopy"],
            outputBlueprint: ["draft output"],
            updatedAt: 200,
          },
        },
      ],
      auditTrail: [],
    },
  },
});

test("recordRunFromExecutionContext resolves runtime-only custom skillData without explicit resolver options", () => {
  const recorder = createSkillRunRecorder();
  const skillData = sampleCustomSkillData();
  const started = recordRunFromExecutionContext({
    metadata: { skillData, conversationId: "c-runtime-only" },
    prompt: "run custom skill",
    recorder,
  });

  assert.ok(started);
  assert.equal(started?.identity.scope, "workspace");
  assert.equal(started?.identity.definitionId, "skill_def__workspace__runtime-only-custom-run");
  assert.equal(started?.identity.versionId, "skill_ver__workspace__runtime-only-custom-run__v2");
  assert.equal(started?.lookup.version.semver, "1.1.0");
  assert.equal(started?.run.skillVersionId, "skill_ver__workspace__runtime-only-custom-run__v2");

  const finished = finalizeRunFromExecutionOutcome(
    started!.run.id,
    { kind: "success", output: { text: "done" } },
    recorder,
  );
  assert.ok(finished);
  assert.equal(finished?.status, "succeeded");
});
