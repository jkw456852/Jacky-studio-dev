import type {
  ExecutionRecipeStep,
  FallbackPolicy,
  JsonSchema,
  RetryPolicy,
  SkillManifest,
  ToolPolicyRule,
} from "../catalog/skill-object-types.ts";

export type ManifestValidationSeverity = "error" | "warning";

export interface ManifestValidationIssue {
  severity: ManifestValidationSeverity;
  path: string;
  code: string;
  message: string;
}

export interface ManifestValidationResult {
  valid: boolean;
  issues: ManifestValidationIssue[];
}

const MANIFEST_KINDS = new Set([
  "tool-skill",
  "workflow-skill",
  "agent-skill",
]);

const ROUTING_MODES = new Set(["manual", "autonomous", "hybrid"]);
const FOLLOW_UP_MODES = new Set(["auto-clarify", "direct-run"]);
const EXECUTOR_TYPES = new Set([
  "skill-call",
  "workflow-recipe",
  "agent-plan",
]);
const RETRY_STRATEGIES = new Set(["retry"]);
const FALLBACK_STRATEGIES = new Set([
  "skip",
  "retry",
  "degrade-to-chat",
  "switch-provider",
  "switch-skill",
  "abort",
]);
const TRACE_LEVELS = new Set(["basic", "verbose"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const pushError = (
  issues: ManifestValidationIssue[],
  path: string,
  code: string,
  message: string,
): void => {
  issues.push({ severity: "error", path, code, message });
};

const pushWarning = (
  issues: ManifestValidationIssue[],
  path: string,
  code: string,
  message: string,
): void => {
  issues.push({ severity: "warning", path, code, message });
};

const validateInputSchema = (
  schema: unknown,
  basePath: string,
  issues: ManifestValidationIssue[],
): void => {
  if (!isRecord(schema)) {
    pushError(issues, basePath, "schema_not_object", "inputSchema must be an object.");
    return;
  }
  if (schema.type !== undefined && schema.type !== "object") {
    pushWarning(
      issues,
      `${basePath}.type`,
      "schema_type_not_object",
      "inputSchema type should normally be 'object'.",
    );
  }
};

const validateOptionalJsonSchema = (
  schema: unknown,
  basePath: string,
  issues: ManifestValidationIssue[],
): void => {
  if (schema === undefined) return;
  if (!isRecord(schema)) {
    pushError(issues, basePath, "schema_not_object", `${basePath} must be an object when provided.`);
  }
};

const validateExecutionRecipe = (
  recipe: ExecutionRecipeStep[] | undefined,
  basePath: string,
  issues: ManifestValidationIssue[],
): void => {
  if (recipe === undefined) return;
  if (!Array.isArray(recipe)) {
    pushError(issues, basePath, "recipe_not_array", `${basePath} must be an array of steps.`);
    return;
  }
  recipe.forEach((step, index) => {
    const stepPath = `${basePath}[${index}]`;
    if (typeof step === "string") {
      if (!isNonEmptyString(step)) {
        pushError(issues, stepPath, "recipe_step_blank", "recipe step cannot be blank.");
      }
      return;
    }
    if (!isRecord(step)) {
      pushError(issues, stepPath, "recipe_step_invalid", "recipe step must be a string or object.");
    }
  });
};

const validateToolPolicy = (
  toolPolicy: ToolPolicyRule[] | undefined,
  basePath: string,
  issues: ManifestValidationIssue[],
): void => {
  if (toolPolicy === undefined) return;
  if (!Array.isArray(toolPolicy)) {
    pushError(issues, basePath, "tool_policy_not_array", `${basePath} must be an array.`);
    return;
  }
  toolPolicy.forEach((rule, index) => {
    const rulePath = `${basePath}[${index}]`;
    if (typeof rule === "string") {
      if (!isNonEmptyString(rule)) {
        pushError(issues, rulePath, "tool_policy_blank", "tool policy rule cannot be blank.");
      }
      return;
    }
    if (!isRecord(rule)) {
      pushError(issues, rulePath, "tool_policy_invalid", "tool policy rule must be a string or object.");
    }
  });
};

const validateRetryPolicy = (
  retryPolicy: RetryPolicy | undefined,
  basePath: string,
  issues: ManifestValidationIssue[],
): void => {
  if (retryPolicy === undefined) return;
  if (!isRecord(retryPolicy)) {
    pushError(issues, basePath, "retry_policy_invalid", `${basePath} must be an object.`);
    return;
  }
  if (
    retryPolicy.strategy !== undefined &&
    typeof retryPolicy.strategy === "string" &&
    !RETRY_STRATEGIES.has(retryPolicy.strategy)
  ) {
    pushError(
      issues,
      `${basePath}.strategy`,
      "retry_policy_strategy_invalid",
      `retryPolicy.strategy must be one of: ${[...RETRY_STRATEGIES].join(", ")}.`,
    );
  }
  if (
    retryPolicy.maxAttempts !== undefined &&
    (typeof retryPolicy.maxAttempts !== "number" || retryPolicy.maxAttempts <= 0)
  ) {
    pushError(
      issues,
      `${basePath}.maxAttempts`,
      "retry_policy_max_attempts_invalid",
      "retryPolicy.maxAttempts must be a positive number when provided.",
    );
  }
};

const validateFallbackPolicy = (
  fallbackPolicy: FallbackPolicy | undefined,
  basePath: string,
  issues: ManifestValidationIssue[],
): void => {
  if (fallbackPolicy === undefined) return;
  if (!isRecord(fallbackPolicy)) {
    pushError(issues, basePath, "fallback_policy_invalid", `${basePath} must be an object.`);
    return;
  }
  if (
    fallbackPolicy.strategy !== undefined &&
    typeof fallbackPolicy.strategy === "string" &&
    !FALLBACK_STRATEGIES.has(fallbackPolicy.strategy)
  ) {
    pushError(
      issues,
      `${basePath}.strategy`,
      "fallback_policy_strategy_invalid",
      `fallbackPolicy.strategy must be one of: ${[...FALLBACK_STRATEGIES].join(", ")}.`,
    );
  }
};

export const validateSkillManifest = (
  manifest: SkillManifest | null | undefined,
): ManifestValidationResult => {
  const issues: ManifestValidationIssue[] = [];

  if (!isRecord(manifest)) {
    pushError(issues, "$", "manifest_not_object", "Manifest must be an object.");
    return { valid: false, issues };
  }

  if (typeof manifest.kind !== "string" || !MANIFEST_KINDS.has(manifest.kind)) {
    pushError(
      issues,
      "kind",
      "kind_invalid",
      `manifest.kind must be one of: ${[...MANIFEST_KINDS].join(", ")}.`,
    );
  }

  if (!isRecord(manifest.identity)) {
    pushError(issues, "identity", "identity_missing", "manifest.identity is required.");
  } else {
    if (!isNonEmptyString(manifest.identity.key)) {
      pushError(issues, "identity.key", "identity_key_missing", "identity.key is required.");
    }
    if (!isNonEmptyString(manifest.identity.displayName)) {
      pushError(
        issues,
        "identity.displayName",
        "identity_display_name_missing",
        "identity.displayName is required.",
      );
    }
    if (
      manifest.identity.namespace !== undefined &&
      !isNonEmptyString(manifest.identity.namespace)
    ) {
      pushError(
        issues,
        "identity.namespace",
        "identity_namespace_blank",
        "identity.namespace must be a non-empty string when provided.",
      );
    }
  }

  validateInputSchema(manifest.inputSchema, "inputSchema", issues);
  validateOptionalJsonSchema(manifest.outputSchema, "outputSchema", issues);

  if (!isRecord(manifest.ui)) {
    pushError(issues, "ui", "ui_missing", "manifest.ui is required.");
  }

  if (!isRecord(manifest.routing)) {
    pushError(issues, "routing", "routing_missing", "manifest.routing is required.");
  } else {
    if (
      typeof manifest.routing.mode !== "string" ||
      !ROUTING_MODES.has(manifest.routing.mode)
    ) {
      pushError(
        issues,
        "routing.mode",
        "routing_mode_invalid",
        `routing.mode must be one of: ${[...ROUTING_MODES].join(", ")}.`,
      );
    }
    if (
      manifest.routing.followUpMode !== undefined &&
      !FOLLOW_UP_MODES.has(manifest.routing.followUpMode)
    ) {
      pushError(
        issues,
        "routing.followUpMode",
        "routing_follow_up_mode_invalid",
        `routing.followUpMode must be one of: ${[...FOLLOW_UP_MODES].join(", ")}.`,
      );
    }
    if (
      manifest.routing.clarifyChecklist !== undefined &&
      !Array.isArray(manifest.routing.clarifyChecklist)
    ) {
      pushError(
        issues,
        "routing.clarifyChecklist",
        "routing_clarify_checklist_invalid",
        "routing.clarifyChecklist must be an array of strings when provided.",
      );
    }
  }

  if (!isRecord(manifest.execution)) {
    pushError(issues, "execution", "execution_missing", "manifest.execution is required.");
  } else {
    if (
      typeof manifest.execution.executorType !== "string" ||
      !EXECUTOR_TYPES.has(manifest.execution.executorType)
    ) {
      pushError(
        issues,
        "execution.executorType",
        "execution_executor_type_invalid",
        `execution.executorType must be one of: ${[...EXECUTOR_TYPES].join(", ")}.`,
      );
    }
    if (
      manifest.execution.preferredSkills !== undefined &&
      !Array.isArray(manifest.execution.preferredSkills)
    ) {
      pushError(
        issues,
        "execution.preferredSkills",
        "execution_preferred_skills_invalid",
        "execution.preferredSkills must be an array when provided.",
      );
    }
    validateExecutionRecipe(manifest.execution.recipe, "execution.recipe", issues);
    validateToolPolicy(manifest.execution.toolPolicy, "execution.toolPolicy", issues);
    validateRetryPolicy(manifest.execution.retryPolicy, "execution.retryPolicy", issues);
    validateFallbackPolicy(manifest.execution.fallbackPolicy, "execution.fallbackPolicy", issues);

    if (
      manifest.execution.timeoutMs !== undefined &&
      (typeof manifest.execution.timeoutMs !== "number" || manifest.execution.timeoutMs <= 0)
    ) {
      pushError(
        issues,
        "execution.timeoutMs",
        "execution_timeout_invalid",
        "execution.timeoutMs must be a positive number when provided.",
      );
    }

    if (manifest.execution.executorType === "workflow-recipe") {
      const recipe = manifest.execution.recipe;
      if (!Array.isArray(recipe) || recipe.length === 0) {
        pushError(
          issues,
          "execution.recipe",
          "execution_workflow_recipe_required",
          "workflow-recipe executor requires a non-empty execution.recipe.",
        );
      }
    }
  }

  if (!isRecord(manifest.outputContract)) {
    pushError(issues, "outputContract", "output_contract_missing", "manifest.outputContract is required.");
  }

  if (!isRecord(manifest.permissions)) {
    pushError(issues, "permissions", "permissions_missing", "manifest.permissions is required.");
  }

  if (!isRecord(manifest.observability)) {
    pushError(issues, "observability", "observability_missing", "manifest.observability is required.");
  } else if (
    typeof manifest.observability.traceLevel !== "string" ||
    !TRACE_LEVELS.has(manifest.observability.traceLevel)
  ) {
    pushError(
      issues,
      "observability.traceLevel",
      "observability_trace_level_invalid",
      `observability.traceLevel must be one of: ${[...TRACE_LEVELS].join(", ")}.`,
    );
  }

  if (
    manifest.dependencies !== undefined &&
    !isRecord(manifest.dependencies)
  ) {
    pushError(
      issues,
      "dependencies",
      "dependencies_invalid",
      "manifest.dependencies must be an object when provided.",
    );
  }

  // Note: this validator intentionally does not mutate the manifest. JsonSchema runtime
  // verification of inputs is delegated to compile/run time in the runtime layer.
  const inputSchemaCheck: JsonSchema | undefined = isRecord(manifest.inputSchema)
    ? (manifest.inputSchema as JsonSchema)
    : undefined;
  if (inputSchemaCheck && !inputSchemaCheck.properties && !inputSchemaCheck.additionalProperties) {
    pushWarning(
      issues,
      "inputSchema",
      "schema_without_properties",
      "inputSchema has no declared properties; runtime validation will fall through.",
    );
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  return { valid: errorCount === 0, issues };
};

export const summarizeManifestValidation = (result: ManifestValidationResult): string => {
  if (result.valid) {
    const warningCount = result.issues.filter((i) => i.severity === "warning").length;
    return warningCount > 0
      ? `valid (with ${warningCount} warning${warningCount === 1 ? "" : "s"})`
      : "valid";
  }
  const errorCount = result.issues.filter((i) => i.severity === "error").length;
  return `invalid (${errorCount} error${errorCount === 1 ? "" : "s"})`;
};
