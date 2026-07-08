import assert from "node:assert/strict";
import test from "node:test";

import { beginSkillRunForAgentTask } from "./agent-task-skill-run-bridge.ts";
import { createSkillRunRecorder } from "../runs/skill-run-recorder.ts";

const sampleCustomSkillData = () => ({
  id: "agent-task-custom-run",
  name: "Agent Task Custom Run",
  iconName: "Sparkles",
  config: {
    isCustomSkill: true,
    name: "Agent Task Custom Run Draft",
    summary: "Draft summary for agent task custom run.",
    description: "Draft summary for agent task custom run.",
    instruction: "Draft instruction for agent task custom run.",
    iconName: "Sparkles",
    routeIntent: "general",
    routeLabel: "Agent Task Draft",
    routeSummary: "Draft route summary.",
    preferredSkills: ["workspaceSearch"],
    suggestedTaskMode: "research",
    followUpMode: "direct-run",
    executionRecipe: ["research", "generateCopy"],
    outputBlueprint: ["draft output"],
    updatedAt: 200,
    skillGovernance: {
      schemaVersion: 1,
      currentPublishedVersionId: "skill_ver__workspace__agent-task-custom-run__v1",
      currentDraftVersionId: "skill_ver__workspace__agent-task-custom-run__v2",
      versions: [
        {
          id: "skill_ver__workspace__agent-task-custom-run__v2",
          semver: "1.1.0",
          reviewStatus: "draft",
          releaseStatus: "draft",
          createdAt: 190,
          updatedAt: 200,
          createdBy: "workspace",
          snapshot: {
            name: "Agent Task Custom Run Draft",
            summary: "Draft summary for agent task custom run.",
            description: "Draft summary for agent task custom run.",
            instruction: "Draft instruction for agent task custom run.",
            iconName: "Sparkles",
            routeIntent: "general",
            routeLabel: "Agent Task Draft",
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

test("beginSkillRunForAgentTask records runtime-only custom skillData as a workspace draft run", () => {
  const recorder = createSkillRunRecorder();
  const active = beginSkillRunForAgentTask(
    {
      id: "task-custom-runtime-only",
      input: {
        message: "go custom",
        metadata: { skillData: sampleCustomSkillData() },
      },
    },
    { recorder, conversationId: "conv-custom-runtime-only" },
  );

  assert.ok(active);
  assert.equal(active?.definitionId, "skill_def__workspace__agent-task-custom-run");
  assert.equal(active?.versionId, "skill_ver__workspace__agent-task-custom-run__v2");

  const run = recorder.store.get(active!.runId);
  assert.ok(run);
  assert.equal(run?.conversationId, "conv-custom-runtime-only");
  assert.equal(run?.skillDefinitionId, "skill_def__workspace__agent-task-custom-run");
  assert.equal(run?.skillVersionId, "skill_ver__workspace__agent-task-custom-run__v2");
});
