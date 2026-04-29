import type {
  VisualConstraintLock,
  VisualGenerationPlan,
  VisualReferencePlan,
  VisualRoleOverlay,
  VisualTaskIntent,
} from "./types";

const INTENT_LABELS: Record<VisualTaskIntent, string> = {
  poster_rebuild: "Poster Reconstruction",
  product_scene: "Product Scene Generation",
  product_lock: "Product Identity Lock",
  background_replace: "Background Replace",
  subject_consistency: "Subject Consistency",
  multi_reference_fusion: "Multi-Reference Fusion",
  text_preserve: "Text Layout Preservation",
  style_transfer: "Style Transfer",
  unknown: "General Visual Generation",
};

const REFERENCE_ROLE_LABELS: Record<VisualReferencePlan["role"], string> = {
  layout: "layout anchor",
  style: "style anchor",
  product: "product identity anchor",
  brand: "brand anchor",
  subject: "subject anchor",
  detail: "detail anchor",
  background: "background anchor",
  supporting: "supporting reference",
};

const buildLockLines = (locks: VisualConstraintLock) => {
  const lines: string[] = [];
  if (locks.brandIdentity) {
    lines.push("- Preserve visible brand name, logo spelling, and brand identity.");
  }
  if (locks.subjectShape) {
    lines.push("- Preserve the main subject silhouette, structure, and product category.");
  }
  if (locks.packagingLayout) {
    lines.push("- Preserve packaging layout and major structure when visible.");
  }
  if (locks.composition) {
    lines.push("- Preserve composition hierarchy and overall layout direction.");
  }
  if (locks.textLayout) {
    lines.push("- Preserve text-safe regions and text layout structure when relevant.");
  }
  if (locks.materialTexture) {
    lines.push("- Preserve core material texture and signature surface details.");
  }
  return lines;
};

const buildIntentInstructions = (intent: VisualTaskIntent) => {
  switch (intent) {
    case "poster_rebuild":
      return [
        "- Rebuild the poster composition as closely as possible from the layout/style anchor.",
        "- Replace only the main product or hero subject where required by the user request.",
        "- Do not redesign the poster into a different generic advertisement structure.",
      ];
    case "product_lock":
      return [
        "- Keep the product identity stable across shape, package, logo, and materials.",
        "- Allow scene, ambience, and composition refinement only if they do not alter product identity.",
      ];
    case "background_replace":
      return [
        "- Keep the main subject stable and change only background, environment, or ambience.",
        "- Do not alter the subject identity while changing the scene.",
      ];
    case "multi_reference_fusion":
      return [
        "- Use all references together rather than randomly following only one image.",
        "- Merge the strongest compatible traits into one coherent result.",
      ];
    case "text_preserve":
      return [
        "- Keep text layout, headline areas, and composition rhythm stable.",
        "- Do not replace brand text or move text-safe empty space unless the user explicitly requests it.",
      ];
    case "style_transfer":
      return [
        "- Transfer the intended style direction without replacing the core subject identity.",
      ];
    case "subject_consistency":
      return [
        "- Preserve the same subject identity across the result.",
      ];
    case "product_scene":
      return [
        "- Generate a polished product-focused scene while preserving the intended subject identity.",
      ];
    default:
      return [
        "- Follow the user's request faithfully while preserving relevant reference identity.",
      ];
  }
};

const buildReferenceLines = (references: VisualReferencePlan[]) => {
  return references.map((reference, index) => {
    const parts = [
      `- Reference image ${index + 1} is the ${REFERENCE_ROLE_LABELS[reference.role]}.`,
    ];
    if (reference.notes) {
      parts.push(`Notes: ${reference.notes}.`);
    }
    return parts.join(" ");
  });
};

const buildOptionalSection = (title: string, lines: string[]) => {
  if (lines.length === 0) return "";
  return `\n[${title}]\n${lines.join("\n")}`;
};

const buildRoleOverlayLines = (overlay?: VisualRoleOverlay) => {
  if (!overlay) return [];
  const lines: string[] = [];
  if (overlay.summary) {
    lines.push(`- Task brain summary: ${overlay.summary}`);
  }
  if (overlay.mindset) {
    lines.push(`- Working mindset: ${overlay.mindset}`);
  }
  overlay.roles.forEach((item, index) => {
    lines.push(`- Role ${index + 1}: ${item.role} | mission: ${item.mission}`);
    item.focus.forEach((focusItem) => {
      lines.push(`  focus: ${focusItem}`);
    });
    item.outputContract.forEach((contractItem) => {
      lines.push(`  output: ${contractItem}`);
    });
  });
  return lines;
};

export const composeVisualGenerationPrompt = (
  plan: VisualGenerationPlan,
  userPrompt: string,
): string => {
  const intentLines = buildIntentInstructions(plan.intent);
  const lockLines = buildLockLines(plan.locks);
  const referenceLines = buildReferenceLines(plan.references);
  const allowedLines = (plan.allowedEdits || []).map((item) => `- ${item}`);
  const forbiddenLines = (plan.forbiddenEdits || []).map((item) => `- ${item}`);
  const noteLines = (plan.plannerNotes || []).map((item) => `- ${item}`);
  const roleOverlayLines = buildRoleOverlayLines(plan.taskRoleOverlay);
  const planningPolicyLines = (plan.taskRoleOverlay?.planningPolicy || []).map(
    (item) => `- ${item}`,
  );
  const executionDirectiveLines = (
    plan.taskRoleOverlay?.executionDirectives || []
  ).map((item) => `- ${item}`);

  return [
    `[Visual Orchestration Plan]`,
    `- Intent: ${INTENT_LABELS[plan.intent]}.`,
    `- Strategy: ${plan.strategyId}.`,
    `- Reference role mode: ${plan.effectiveReferenceRoleMode}.`,
    buildOptionalSection("Task Role Overlay", roleOverlayLines),
    buildOptionalSection("Task Planning Policy", planningPolicyLines),
    buildOptionalSection("Task Execution Directives", executionDirectiveLines),
    buildOptionalSection("Intent Instructions", intentLines),
    buildOptionalSection("Reference Roles", referenceLines),
    buildOptionalSection("Required Locks", lockLines),
    buildOptionalSection("Allowed Edits", allowedLines),
    buildOptionalSection("Forbidden Edits", forbiddenLines),
    buildOptionalSection("Planner Notes", noteLines),
    `\n[User Request]\n${userPrompt}`,
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
};
