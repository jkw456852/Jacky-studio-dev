import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeManifestValidation,
  validateSkillManifest,
  type ManifestValidationIssue,
} from "./manifest-validator.ts";
import type { SkillManifest } from "../catalog/skill-object-types.ts";
import { listLegacyPresetSkillCatalogEntries } from "../legacy/legacy-skill-catalog.ts";

const buildValidManifest = (overrides: Partial<SkillManifest> = {}): SkillManifest => ({
  kind: "tool-skill",
  identity: {
    key: "builtin.test",
    displayName: "Test Skill",
    namespace: "builtin",
  },
  inputSchema: {
    type: "object",
    properties: { prompt: { type: "string" } },
  },
  ui: { iconName: "Sparkles", activationHint: "Test activation" },
  routing: {
    mode: "manual",
    followUpMode: "direct-run",
    clarifyChecklist: [],
  },
  execution: {
    executorType: "skill-call",
    preferredSkills: [],
    toolPolicy: [],
  },
  outputContract: {},
  permissions: {},
  observability: {
    traceLevel: "basic",
    saveInputs: true,
    saveOutputs: true,
    saveIntermediateCalls: false,
  },
  ...overrides,
});

const errorCodes = (issues: ManifestValidationIssue[]) =>
  issues.filter((i) => i.severity === "error").map((i) => i.code);

test("validateSkillManifest accepts a minimal valid manifest", () => {
  const result = validateSkillManifest(buildValidManifest());
  assert.equal(result.valid, true);
  assert.equal(summarizeManifestValidation(result).startsWith("valid"), true);
});

test("validateSkillManifest rejects missing identity and unknown kind", () => {
  const result = validateSkillManifest({
    ...buildValidManifest(),
    kind: "non-existent-kind" as SkillManifest["kind"],
    identity: undefined as unknown as SkillManifest["identity"],
  });
  assert.equal(result.valid, false);
  const codes = errorCodes(result.issues);
  assert.ok(codes.includes("kind_invalid"));
  assert.ok(codes.includes("identity_missing"));
});

test("workflow-recipe executor requires a non-empty recipe", () => {
  const result = validateSkillManifest(
    buildValidManifest({
      execution: {
        executorType: "workflow-recipe",
        preferredSkills: [],
        toolPolicy: [],
        recipe: [],
      },
    }),
  );
  assert.equal(result.valid, false);
  assert.ok(errorCodes(result.issues).includes("execution_workflow_recipe_required"));
});

test("validateSkillManifest flags blank recipe steps and invalid policies", () => {
  const result = validateSkillManifest(
    buildValidManifest({
      execution: {
        executorType: "workflow-recipe",
        recipe: ["", { step: "ok" }],
        toolPolicy: [""],
        retryPolicy: { strategy: "retry", maxAttempts: -1 },
        fallbackPolicy: { strategy: "unknown" as never },
      },
    }),
  );
  const codes = errorCodes(result.issues);
  assert.ok(codes.includes("recipe_step_blank"));
  assert.ok(codes.includes("tool_policy_blank"));
  assert.ok(codes.includes("retry_policy_max_attempts_invalid"));
  assert.ok(codes.includes("fallback_policy_strategy_invalid"));
});

test("every legacy importer manifest passes validation", () => {
  const entries = listLegacyPresetSkillCatalogEntries();
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    const result = validateSkillManifest(entry.version.manifest);
    assert.equal(
      result.valid,
      true,
      `manifest for ${entry.legacyMetadata.frontstagePreset?.id} should validate, got: ` +
        JSON.stringify(result.issues),
    );
  }
});
