export type VisualTaskPlaybook =
  | "detail_page_set"
  | "poster_edit"
  | "product_scene"
  | "multi_page_set";

const DETAIL_PAGE_KEYWORDS = [
  "详情页",
  "电商",
  "商品页",
  "卖点",
  "主图",
  "套图",
  "多页",
  "多屏",
  "产品介绍",
  "首屏",
  "白底图",
  "参数图",
  "场景图",
  "detail page",
  "e-commerce",
  "ecommerce",
  "selling point",
  "listing",
  "product page",
];

const POSTER_EDIT_KEYWORDS = [
  "海报",
  "主视觉",
  "kv",
  "poster",
  "banner",
  "campaign",
  "广告",
];

const PRODUCT_SCENE_KEYWORDS = [
  "场景",
  "场景图",
  "背景",
  "替换",
  "合成",
  "安装到",
  "换到",
  "车内",
  "scene",
  "lifestyle",
  "background",
  "replace",
  "edit",
];

const MULTI_PAGE_SET_KEYWORDS = [
  "套图",
  "系列",
  "多页",
  "一套",
  "组图",
  "成套",
  "多张",
  "pages",
  "set",
  "series",
];

const PRODUCT_NOUNS = [
  "产品",
  "商品",
  "机器人",
  "座椅套",
  "化妆品",
  "包装",
  "家电",
  "product",
  "robot",
];

const EDIT_ACTION_KEYWORDS = [
  "替换",
  "换到",
  "安装到",
  "保留",
  "保持",
  "融合",
  "edit",
  "replace",
  "swap",
];

const includesAnyKeyword = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword));

export const buildPromptListSection = (title: string, lines: string[]) =>
  [`[${title}]`, ...lines.map((line) => `- ${line}`)].join("\n");

export const getSharedPlanningConstitutionLines = () => [
  "Behave like a deliberate senior agent: first classify the task, infer the real deliverable, identify missing information, and only then decide actions.",
  "Do not reduce the request to keywords. Use the prompt, references, current controls, and existing workspace state as evidence.",
  "Keep user goal, deliverable form, execution plan, and validation criteria separate in your reasoning.",
  "Do not invent certainty. If important information is missing or the system cannot truly confirm something, surface that explicitly in the plan.",
  "Do not hide failures behind silent fallback behavior. If a model, tool, or setting is a bad fit, say so instead of pretending the plan is still strong.",
  "When the request has non-obvious consequences, make the approval checkpoints explicit before mutation or generation.",
  "Before finalizing the plan, self-check that the chosen model, aspect ratio, page structure, references, and success criteria all match the real job.",
];

export const getCorePlanningBrainLines = () => [
  "Start by naming the real job, not the surface wording. Distinguish between user prompt text, actual deliverable, execution medium, and review target.",
  "Run a hidden research pass before deciding actions: what a strong human expert would normally check first, what evidence the final output must carry, and what domain structure this kind of task usually requires.",
  "Infer missing but important information explicitly instead of silently pretending it does not matter. Separate confirmed facts, reasonable working assumptions, and unresolved gaps.",
  "Choose structure before detail: decide the page system, step order, composition family, or inspection order before writing prompts or mutations.",
  "Adapt to the selected model and tool reality. If the current model is weak at typography, layout fidelity, or dense collage control, change the plan to fit that weakness instead of ignoring it.",
  "Avoid template drift. If multiple outputs are needed, each one must have a distinct communication duty instead of being a shallow variant of the same layout.",
  "Self-criticize before finalizing: check whether the plan is too generic, too repetitive, under-specified, or likely to fail because of model fit, missing context, or structural ambiguity.",
];

export const getSharedDeliverableDecompositionLines = () => [
  "When the task implies multiple outputs, first decide the output system: how many items are actually needed, what order they should appear in, and what each item is responsible for proving or communicating.",
  "Do not let multiple outputs inherit the same vague role. Each output should answer a different question, serve a different conversion duty, or inspect a different layer of the same problem.",
  "Separate structural planning from surface prompting. First define roles, dependencies, and evaluation criteria; only then write the actual prompts or execution steps.",
  "If the task is under-specified, choose a practical decomposition instead of duplicating the user sentence across all outputs.",
];

export const getSharedPlanningSelfCheckLines = () => [
  "Before finalizing, check whether the plan is just restating the prompt instead of adding real task structure.",
  "Check whether multiple outputs accidentally collapse into template variants with the same layout, framing, or information duty.",
  "Check whether the chosen ratios, structure, and prompt strategy still make sense for the selected model rather than for an imaginary ideal model.",
  "Check whether the plan leaves enough room for missing context, text-safe layout, approval checkpoints, or runtime diagnosis where the task needs them.",
];

export const getBrowserExecutionPolicyLines = () => [
  "Only use listed tools and host actions. Never invent unsupported capabilities, ids, or hidden state.",
  "Prefer inspection before mutation: read target status, controls, trace, and dependencies before generating or changing anything.",
  "Anchor follow-up reads to the same request or target whenever ids are available so the session does not drift.",
  "Treat attached reference images as authoritative inputs when they are present.",
  "Keep steps concise, executable, and outcome-oriented. Each step should exist for a clear reason.",
];

export const getVisualPlanningPolicyLines = () => [
  "Infer the actual visual deliverable before choosing execution mode: single hero edit, coordinated set, iterative continuation, or another clearly named output.",
  "Think through information architecture, page roles, ratio strategy, subject continuity, copy load, typography risk, and model fit before writing prompts.",
  "For multi-image work, plan one image per communication goal instead of generic variations unless the user explicitly asks for variations.",
  "Prefer output structures that match real design workflows. Do not default every page to a square collage or dense multi-panel board.",
  "Use the currently selected generation model as part of the reasoning. Reflect its likely strengths, weaknesses, and prompting style instead of giving model-agnostic advice.",
  "Prompt directives should describe how to get a clean result from this model family, not simply restate the user request.",
  "When the task implies a known design domain such as ecommerce detail pages, poster edits, or scene replacement, expand the hidden research checklist before deciding the page plan.",
];

export const inferVisualTaskPlaybooks = (args: {
  prompt: string;
  requestedImageCount?: number;
  referenceCount?: number;
}): VisualTaskPlaybook[] => {
  const normalized = String(args.prompt || "").toLowerCase();
  const requestedImageCount = Math.max(0, Number(args.requestedImageCount || 0));
  const referenceCount = Math.max(0, Number(args.referenceCount || 0));
  const playbooks: VisualTaskPlaybook[] = [];

  if (
    includesAnyKeyword(normalized, DETAIL_PAGE_KEYWORDS) ||
    (requestedImageCount > 1 && includesAnyKeyword(normalized, PRODUCT_NOUNS))
  ) {
    playbooks.push("detail_page_set");
  }

  if (includesAnyKeyword(normalized, POSTER_EDIT_KEYWORDS)) {
    playbooks.push("poster_edit");
  }

  if (
    includesAnyKeyword(normalized, PRODUCT_SCENE_KEYWORDS) ||
    (referenceCount >= 2 && includesAnyKeyword(normalized, EDIT_ACTION_KEYWORDS))
  ) {
    playbooks.push("product_scene");
  }

  if (
    requestedImageCount > 1 ||
    includesAnyKeyword(normalized, MULTI_PAGE_SET_KEYWORDS)
  ) {
    playbooks.push("multi_page_set");
  }

  return Array.from(new Set(playbooks));
};

export const getVisualPlaybookLines = (
  playbook: VisualTaskPlaybook,
): string[] => {
  switch (playbook) {
    case "detail_page_set":
      return [
        "Audit what a convincing detail-page set actually needs: cover page, core selling points, feature proof, material or structure detail, usage scene, and spec or comparison coverage when relevant.",
        "Decide whether this is a marketplace detail set, a hero-plus-modules product page, or a lighter conversion set before fixing page count.",
        "Choose ratios and page count based on commerce communication needs rather than copying the current canvas ratio by default.",
        "Plan one page = one main communication job. Avoid turning the whole detail-page set into a single 1:1 collage unless the user explicitly asks for collage output.",
        "Reserve clean text-safe regions, but do not overload the image with dense copy when the selected model is weak at typography.",
      ];
    case "poster_edit":
      return [
        "Separate layout inheritance from content replacement: decide what must stay from the original poster and what may change.",
        "Protect headline hierarchy, product hero dominance, brand cues, and visual focus before adjusting decorative elements.",
        "If the model is weak at faithful typography reconstruction, bias toward clean visual recreation plus controlled text-safe layout instead of fake dense text blocks.",
      ];
    case "product_scene":
      return [
        "Distinguish subject-lock constraints from editable scene variables such as background, lighting mood, props, camera distance, and installation contact points.",
        "When multiple references have different duties, explicitly infer which image controls product identity and which image controls scene or composition.",
        "Protect realism at contact points, perspective, scale, shadows, reflections, and materials so the inserted subject looks genuinely installed in the scene.",
      ];
    case "multi_page_set":
      return [
        "Make each page play a distinct role with a clear review order instead of producing near-duplicate outputs.",
        "Define the continuity anchors that must remain stable across the set: subject identity, lighting family, materials, palette, brand grammar, and ratio family when appropriate.",
        "Keep the set commercially coherent while allowing composition changes that support each page's communication goal.",
      ];
    default:
      return [];
  }
};

export const buildVisualPlaybookSections = (playbooks: VisualTaskPlaybook[]) =>
  playbooks.map((playbook) =>
    buildPromptListSection(
      `Role Playbook: ${playbook}`,
      getVisualPlaybookLines(playbook),
    ),
  );

export const getSelectedGenerationModelPlanningLines = (
  model: string | null | undefined,
): string[] => {
  const normalized = String(model || "").trim().toLowerCase();
  if (!normalized || normalized === "unspecified") {
    return [
      "No reliable generation-model hint is available, so keep prompt directives conservative: one image = one job, simple composition, explicit subject priority, and clean text-safe regions.",
      "Do not assume the model can render dense typography or complex multi-panel layouts well unless the task absolutely requires it.",
    ];
  }

  if (
    normalized.includes("gpt-image") ||
    normalized.includes("gpt image")
  ) {
    return [
      "This model family is usually better at clean composition, object placement, and faithful edit-style instructions than at dense commercial typography.",
      "Prefer direct, structured page prompts with one dominant scene or module per image. Keep copy expectations low and preserve clear text-safe zones instead of demanding lots of readable small text.",
    ];
  }

  if (
    normalized.includes("gemini") ||
    normalized.includes("nanobanana") ||
    normalized.includes("flash-image")
  ) {
    return [
      "This model family often follows broad visual direction well, but can drift into collage-like packing or over-stuffed layouts if the prompt bundles too many page duties together.",
      "Bias prompts toward one commercial job per image, explicit subject priority, simple page architecture, and negative instructions against multi-panel montage, screenshot grids, or dense fake detail-page text.",
    ];
  }

  return [
    `Plan prompts with the selected model (${model}) in mind instead of using a model-agnostic template.`,
    "If the task includes text-heavy layouts, explain how to reduce typography load and convert copy needs into text-safe composition guidance when necessary.",
  ];
};
