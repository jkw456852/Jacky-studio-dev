import assert from "node:assert/strict";
import test from "node:test";
import {
  createSkillRunRecorder,
  getDefaultSkillRunRecorder,
  resetDefaultSkillRunRecorder,
} from "./skill-run-recorder.ts";
import { listLegacyPresetSkillCatalogEntries } from "../legacy/legacy-skill-catalog.ts";
import type { CustomSkillMarkdownAsset } from "../../runtime-assets/custom-skill-markdown.ts";

const sampleEntry = () => {
  const entries = listLegacyPresetSkillCatalogEntries();
  assert.ok(entries.length > 0);
  return entries[0];
};

const sampleCustomAsset: CustomSkillMarkdownAsset = {
  id: "run-recorder-custom",
  name: "Run Recorder Custom",
  description: "fixture",
  iconName: "Sparkles",
  activationHint: "fixture",
  routeIntent: "general",
  routeLabel: "Custom",
  routeSummary: "fixture",
  preferredSkills: [],
  suggestedTaskMode: "generate",
  followUpMode: "direct-run",
  allowAutonomousRouting: true,
  mode: "unified-sidebar-agent",
  clarifyChecklist: [],
  reusableQuestions: [],
  executionOutline: [],
  executionRecipe: [],
  outputBlueprint: [],
  toolPolicy: [],
  instruction: "fixture",
  examplePrompt: "fixture prompt",
  sourceConversationTitle: null,
  sourceUserPrompt: "",
  distilledFromConversation: false,
  tags: [],
};

const sampleCustomDraftRuntimeConfig = {
  isCustomSkill: true,
  name: "Run Recorder Draft",
  summary: "Draft summary",
  description: "Draft summary",
  instruction: "Draft instruction",
  iconName: "Sparkles",
  routeIntent: "general",
  routeLabel: "Custom Draft",
  routeSummary: "Draft route summary.",
  preferredSkills: ["workspaceSearch"],
  suggestedTaskMode: "research",
  followUpMode: "direct-run",
  executionRecipe: ["research", "generateCopy"],
  outputBlueprint: ["draft output"],
  updatedAt: 200,
  skillGovernance: {
    schemaVersion: 1,
    currentPublishedVersionId: "skill_ver__workspace__run-recorder-custom__v1",
    currentDraftVersionId: "skill_ver__workspace__run-recorder-custom__v2",
    versions: [
      {
        id: "skill_ver__workspace__run-recorder-custom__v2",
        semver: "1.1.0",
        reviewStatus: "draft",
        releaseStatus: "draft",
        createdAt: 190,
        updatedAt: 200,
        createdBy: "workspace",
        snapshot: {
          name: "Run Recorder Draft",
          iconName: "Sparkles",
          summary: "Draft summary",
          description: "Draft summary",
          instruction: "Draft instruction",
          routeIntent: "general",
          routeLabel: "Custom Draft",
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
} satisfies Record<string, unknown>;

test("startRunFromLegacy creates a queued run keyed to canonical identity", () => {
  const entry = sampleEntry();
  const recorder = createSkillRunRecorder();
  const started = recorder.startRunFromLegacy({
    skillData: entry.legacyMetadata.skillData,
    prompt: "do thing",
    conversationId: "conv-1",
    messageId: "msg-1",
  });
  assert.ok(started);
  assert.equal(started.identity.definitionId, entry.definition.id);
  assert.equal(started.run.status, "queued");
  assert.equal(started.run.conversationId, "conv-1");
  assert.equal(started.run.skillVersionId, entry.version.id);
  assert.equal(started.run.input.prompt, "do thing");
});

test("startRunFromLegacy returns null when identity cannot be resolved", () => {
  const recorder = createSkillRunRecorder();
  const started = recorder.startRunFromLegacy({
    skillData: { id: "unknown", name: "u", iconName: "S", config: {} },
    prompt: "x",
  });
  assert.equal(started, null);
});

test("lifecycle helpers walk queued -> running -> succeeded and append events", () => {
  const entry = sampleEntry();
  let clock = 1000;
  const recorder = createSkillRunRecorder({ now: () => (clock += 5) });
  const started = recorder.startRunFromLegacy({
    skillData: entry.legacyMetadata.skillData,
    prompt: "run",
  });
  assert.ok(started);

  const runId = started.run.id;
  const running = recorder.markRunning(runId);
  assert.ok(running);
  assert.equal(running.status, "running");
  assert.ok(running.startedAt && running.startedAt > 0);

  recorder.appendActualCall(runId, { skill: "generateImage", ok: true });
  recorder.appendClarifyEvent(runId, { question: "are you sure?" });
  recorder.appendRepairEvent(runId, { kind: "repair", reason: "plan-fixup" });
  recorder.appendFallbackEvent(runId, { kind: "fallback", reason: "switch-skill" });

  const finished = recorder.finishWith(runId, {
    kind: "success",
    output: { text: "ok" },
  });
  assert.ok(finished);
  assert.equal(finished.status, "succeeded");
  assert.equal(finished.output?.text, "ok");
  assert.ok(finished.completedAt && finished.completedAt > 0);
  assert.equal(finished.actualCalls?.length, 1);
  assert.equal(finished.clarifyEvents?.length, 1);
  assert.equal(finished.repairEvents?.length, 1);
  assert.equal(finished.fallbackEvents?.length, 1);
});

test("finishWith failure stamps the error and forbids further transitions", () => {
  const entry = sampleEntry();
  const recorder = createSkillRunRecorder();
  const started = recorder.startRunFromLegacy({
    skillData: entry.legacyMetadata.skillData,
    prompt: "fail",
  });
  assert.ok(started);
  const runId = started.run.id;
  recorder.markRunning(runId);
  const failed = recorder.finishWith(runId, {
    kind: "failure",
    error: { code: "boom", message: "something broke", stage: "execute" },
  });
  assert.ok(failed);
  assert.equal(failed.status, "failed");
  assert.equal(failed.error?.code, "boom");
  assert.throws(() => recorder.markSucceeded(runId), /terminal_status_immutable/);
});

test("default recorder is a singleton until reset", () => {
  resetDefaultSkillRunRecorder();
  const first = getDefaultSkillRunRecorder();
  const second = getDefaultSkillRunRecorder();
  assert.equal(first, second);
  resetDefaultSkillRunRecorder();
  assert.notEqual(first, getDefaultSkillRunRecorder());
});


test("appendClarifyEvent / appendFallbackEvent auto-update metrics counters", () => {
  const entry = sampleEntry();
  const recorder = createSkillRunRecorder();
  const started = recorder.startRunFromLegacy({
    skillData: entry.legacyMetadata.skillData,
    prompt: "metrics",
  });
  assert.ok(started);
  const runId = started.run.id;
  recorder.markRunning(runId);
  recorder.appendClarifyEvent(runId, { question: "ask 1" });
  recorder.appendClarifyEvent(runId, { question: "ask 2" });
  recorder.appendFallbackEvent(runId, { kind: "switch-skill" });
  const updated = recorder.store.get(runId);
  assert.ok(updated);
  assert.equal(updated.metrics?.clarifyRounds, 2);
  assert.equal(updated.metrics?.fallbackCount, 1);
});

test("custom skill runs record the working draft version when resolver options include governance overlay", () => {
  const recorder = createSkillRunRecorder();
  const started = recorder.startRunFromLegacy({
    legacyConfig: {
      isCustomSkill: true,
      markdownAssetId: sampleCustomAsset.id,
    },
    prompt: "run custom draft",
    resolverOptions: {
      customSkillMarkdownAssets: [sampleCustomAsset],
      runtimeCustomConfigs: {
        [sampleCustomAsset.id]: sampleCustomDraftRuntimeConfig,
      },
    },
  });

  assert.ok(started);
  assert.equal(started.identity.scope, "workspace");
  assert.equal(started.identity.versionId, "skill_ver__workspace__run-recorder-custom__v2");
  assert.equal(started.lookup.version.semver, "1.1.0");
  assert.equal(started.run.skillVersionId, "skill_ver__workspace__run-recorder-custom__v2");
});
