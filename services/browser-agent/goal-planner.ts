import { Type } from "@google/genai";
import {
  getMappedPrimaryModelConfig,
  getBrowserAgentModelConfig,
  parseMappedModelStorageEntry,
  getModelDisplayLabel,
} from "../provider-settings";
import { getBrowserAgentSettings } from "../runtime-settings";
import { generateJsonResponse } from "../gemini";
import {
  buildPromptListSection,
  buildVisualPlaybookSections,
  getBrowserExecutionPolicyLines,
  getCorePlanningBrainLines,
  getSharedDeliverableDecompositionLines,
  getSharedPlanningSelfCheckLines,
  getSharedPlanningConstitutionLines,
  inferVisualTaskPlaybooks,
} from "../agents/shared/planning-policies";
import type { BrowserConsoleEvent } from "./console-bridge";
import type { BrowserAgentHostSummary } from "./runtime";
import type {
  BrowserAgentSessionRecord,
  BrowserAgentSessionSpec,
  BrowserAgentSessionStepSpec,
} from "./session-runtime";
import type { BrowserToolDefinition } from "./tool-registry";

export type BrowserAgentGoalSessionPlan = {
  title: string;
  description: string;
  rationaleSummary: string;
  done: boolean;
  finalSummary?: string;
  taskProfile?: {
    taskType: string;
    objective: string;
    deliverable: string;
  };
  researchNotes?: {
    domainConsiderations?: string[];
    informationGaps?: string[];
    successCriteria?: string[];
  };
  executionStrategy?: {
    modelConsiderations?: string[];
    outputPlan?: string[];
    approvalChecklist?: string[];
    risks?: string[];
  };
  plannerModel: {
    modelId: string;
    providerId: string | null;
    label: string;
  };
  targetHostId: string | null;
  targetElementId: string | null;
  plannedAt: number;
  steps: BrowserAgentSessionStepSpec[];
  rawResponseText?: string;
};

type GoalPlannerStepPatch = {
  id: string;
  title: string;
  summary?: string;
  kind: "tool" | "host_action";
  toolId?: string;
  hostId?: string;
  actionId?: string;
  input: Record<string, unknown>;
  continueOnError: boolean;
};

type GoalPlannerPatch = {
  title?: string;
  description?: string;
  rationaleSummary?: string;
  done?: boolean;
  finalSummary?: string;
  taskProfile?: BrowserAgentGoalSessionPlan["taskProfile"];
  researchNotes?: BrowserAgentGoalSessionPlan["researchNotes"];
  executionStrategy?: BrowserAgentGoalSessionPlan["executionStrategy"];
  steps?: GoalPlannerStepPatch[];
  rawResponseText?: string;
};

type PlannerCatalogResolver = {
  toolIds: Set<string>;
  actionIds: Set<string>;
  toolAliasMap: Map<string, string>;
  actionAliasMap: Map<string, string>;
  hostId: string | null;
};

const GOAL_PLAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    rationaleSummary: { type: Type.STRING },
    done: { type: Type.BOOLEAN },
    finalSummary: { type: Type.STRING },
    taskProfile: {
      type: Type.OBJECT,
      properties: {
        taskType: { type: Type.STRING },
        objective: { type: Type.STRING },
        deliverable: { type: Type.STRING },
      },
      required: ["taskType", "objective", "deliverable"],
    },
    researchNotes: {
      type: Type.OBJECT,
      properties: {
        domainConsiderations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        informationGaps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        successCriteria: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    },
    executionStrategy: {
      type: Type.OBJECT,
      properties: {
        modelConsiderations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        outputPlan: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        approvalChecklist: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        risks: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          kind: { type: Type.STRING },
          toolId: { type: Type.STRING },
          actionId: { type: Type.STRING },
          inputJson: { type: Type.STRING },
          continueOnError: { type: Type.BOOLEAN },
        },
        required: [
          "id",
          "title",
          "summary",
          "kind",
          "inputJson",
          "continueOnError",
        ],
      },
    },
  },
  required: ["title", "description", "rationaleSummary", "steps"],
};

const buildGoalPlannerPrompt = (args: {
  goal: string;
  host: BrowserAgentHostSummary | null;
  hostSnapshot: unknown;
  tools: BrowserToolDefinition[];
  recentConsole: BrowserConsoleEvent[];
  recentSession?: BrowserAgentSessionRecord | null;
  targetElementId?: string | null;
  referenceImageCount?: number;
}) => {
  const toolCatalog = args.tools.map((tool) => ({
    id: tool.id,
    category: tool.category,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));

  const hostActionCatalog = (args.host?.actions || []).map((action) => ({
    id: action.id,
    description: action.description,
    inputSchema: action.inputSchema || {},
  }));

  const consoleSummary = args.recentConsole.map((event) => ({
    level: event.level,
    message: String(event.message || "").slice(0, 280),
    source: event.source || null,
    at: event.timestamp,
  }));
  const recentSessionSummary = summarizeRecentSession(args.recentSession);
  const playbookSections = buildVisualPlaybookSections(
    inferVisualTaskPlaybooks({
      prompt: args.goal,
      referenceCount: Number(args.referenceImageCount || 0),
    }),
  );

  return [
    "You are a browser-native workspace execution planner.",
    "Your job is to turn the user's goal into a strict, executable browser-agent session plan.",
    "Return JSON only.",
    "Do not include markdown fences.",
    "Do not omit required fields.",
    "",
    "[Primary Goal]",
    args.goal,
    "",
    "[Target Host]",
    JSON.stringify({
      id: args.host?.id || null,
      kind: args.host?.kind || null,
      title: args.host?.title || null,
      targetElementId: args.targetElementId || null,
    }),
    "",
    "[Host Snapshot Summary]",
    JSON.stringify(summarizeHostSnapshot(args.hostSnapshot)),
    "",
    "[Available Tools]",
    JSON.stringify(toolCatalog),
    "",
    "[Available Host Actions]",
    JSON.stringify(hostActionCatalog),
    "",
    "[Recent Console Context]",
    JSON.stringify(consoleSummary),
    "",
    "[Recent Session Context]",
    JSON.stringify(recentSessionSummary),
    "",
    "[Attached Reference Images]",
    JSON.stringify({
      count: Number(args.referenceImageCount || 0),
      available: Number(args.referenceImageCount || 0) > 0,
    }),
    "",
    buildPromptListSection(
      "Shared Agent Constitution",
      getSharedPlanningConstitutionLines(),
    ),
    "",
    buildPromptListSection(
      "Core Planning Brain",
      getCorePlanningBrainLines(),
    ),
    "",
    buildPromptListSection(
      "Shared Deliverable Decomposition",
      getSharedDeliverableDecompositionLines(),
    ),
    "",
    buildPromptListSection(
      "Shared Planning Self Check",
      getSharedPlanningSelfCheckLines(),
    ),
    "",
    buildPromptListSection(
      "Browser Execution Constitution",
      getBrowserExecutionPolicyLines(),
    ),
    ...(playbookSections.length > 0 ? ["", ...playbookSections] : []),
    "",
    "[Planning Rules]",
    "- First think like a strong generalist agent, not a keyword executor. Classify the job, identify the real deliverable, note missing information, and only then decide the step sequence.",
    "- Every step must be executable with the listed tools or host actions only.",
    "- Use kind=tool only for listed tool ids.",
    "- Use kind=host_action only for listed host action ids.",
    "- Prefer exact ids such as workspace.read_element_capabilities or workspace.generate_image. Do not shorten ids unless they are identical to the listed ids.",
    "- inputJson must always be a JSON object string such as {} or {\"elementId\":\"123\"}.",
    "- A step may reference earlier step outputs inside inputJson by using template placeholders such as {{steps.generate_image.result.requestId}}.",
    "- Prefer inspection before mutation: read capabilities, controls, and trace before changing state or generating.",
    "- When a target element is available, prefer workspace.observe_generation_target as the first observation step because it returns a structured summary, issues, and suggested next actions.",
    "- If a recent session already inspected the same element and the new goal is a follow-up, use that session context to avoid redundant reads when safe.",
    "- When attached reference images are available, treat them as authoritative visual input for the current goal and use them to resolve ambiguities in style, layout, and subject matter.",
    "- After triggering workspace.generate_image, prefer workspace.await_generation_completion over arbitrary browser.wait when the goal is to observe the current run result.",
    "- If workspace.generate_image returns a requestId, pass that requestId into subsequent wait / trace / activity reads so they stay anchored to the same run.",
    "- When a generation fails or behaves strangely, prefer workspace.diagnose_generation_trace before blind retries so the plan can inspect repaired issues, unresolved risks, and reference-chain failures.",
    "- If the recent session context already shows the goal is satisfied, prefer done=true instead of appending redundant steps.",
    "- If the goal is about image generation, inspect the target element context first, then update controls only when necessary, then trigger generation, then wait, then read trace/activity.",
    "- If targetElementId is provided, keep the plan anchored to that element unless the goal clearly requires another target.",
    "- Keep the plan concise and high-signal. Usually 3 to 10 steps.",
    "- If the goal is already satisfied or no more action is needed, return done=true, steps=[], and a short finalSummary.",
    "- If more work is still needed, return done=false and include the concrete next steps.",
    "- rationaleSummary should briefly explain the execution strategy.",
    "- taskProfile.taskType must classify the request, for example: single_edit, detail_page_set, product_scene, inspection, retry, trace_read, parameter_adjustment.",
    "- taskProfile.objective should state what success looks like in one sentence.",
    "- taskProfile.deliverable should name the actual output, for example: one edited hero image, a 4-page detail set, a status diagnosis.",
    "- researchNotes.domainConsiderations should capture what a capable agent should think about before acting. For example, detail pages usually need page structure, ratio choices, selling-point coverage, copy strategy, and model-fit awareness.",
    "- researchNotes.informationGaps should list missing but important information. Leave it as [] only when nothing meaningful is missing.",
    "- researchNotes.successCriteria should define what the result must satisfy.",
    "- executionStrategy.modelConsiderations should mention the currently relevant model or control implications when image generation is involved.",
    "- executionStrategy.outputPlan should explain the planned output structure, such as page roles, image count, or review order.",
    "- executionStrategy.approvalChecklist should say what the user should verify before execution when the plan has non-obvious consequences.",
    "- executionStrategy.risks should state likely failure modes or ambiguity traps.",
    "- Each step title must be human-readable and outcome-oriented. Never use generic ids like step_1 or observe_target as the visible title.",
    "- Each step summary must explain why that step exists and what it will confirm or change.",
    "- Do not invent tools, actions, ids, or unsupported fields.",
    "",
    "[Useful Planning Patterns]",
    JSON.stringify(
      [
        {
          goal: "inspect current node",
          steps: [
            {
              title: "检查目标节点当前状态",
              summary: "先读取结构化观察结果，确认当前节点在生成什么、缺什么、有没有异常。",
              kind: "tool",
              toolId: "workspace.observe_generation_target",
              inputJson: "{\"elementId\":\"TARGET_ELEMENT_ID\"}",
            },
            {
              title: "读取节点详细信息",
              summary: "补充查看节点本身的内容和挂载关系，避免只凭一句 prompt 做判断。",
              kind: "tool",
              toolId: "workspace.read_selected_element",
              inputJson: "{\"elementId\":\"TARGET_ELEMENT_ID\"}",
            },
          ],
        },
        {
          goal: "run current image generation cycle",
          steps: [
            {
              title: "检查目标节点当前状态",
              summary: "先确认节点已有内容、参考关系和最近生成痕迹，再决定是否直接生成。",
              kind: "tool",
              toolId: "workspace.observe_generation_target",
              inputJson: "{\"elementId\":\"TARGET_ELEMENT_ID\"}",
            },
            {
              title: "读取当前生成参数",
              summary: "查看模型、比例、质量和张数，确认这轮执行会真正用什么配置。",
              kind: "tool",
              toolId: "workspace.read_element_controls",
              inputJson: "{\"elementId\":\"TARGET_ELEMENT_ID\"}",
            },
            {
              title: "发起本轮生成",
              summary: "在确认节点和参数无误后，再正式触发当前节点的生成动作。",
              kind: "host_action",
              actionId: "workspace.generate_image",
              inputJson: "{\"elementId\":\"TARGET_ELEMENT_ID\"}",
            },
            {
              title: "等待本轮生成完成",
              summary: "绑定同一 requestId 等待结果，避免把别的历史任务误当成当前结果。",
              kind: "tool",
              toolId: "workspace.await_generation_completion",
              inputJson: "{\"elementId\":\"TARGET_ELEMENT_ID\",\"requestId\":\"{{steps.generate_image.result.requestId}}\",\"timeoutMs\":45000,\"pollIntervalMs\":1200}",
            },
            {
              title: "读取生成轨迹",
              summary: "回读 trace 和活动记录，确认这轮到底用了什么模型、出了什么状态。",
              kind: "tool",
              toolId: "workspace.read_generation_trace",
              inputJson: "{\"elementId\":\"TARGET_ELEMENT_ID\",\"requestId\":\"{{steps.generate_image.result.requestId}}\"}",
            },
            {
              title: "回看节点结果",
              summary: "重新观察节点结果，确认最终画面和节点状态是否符合这轮目标。",
              kind: "tool",
              toolId: "workspace.observe_generation_target",
              inputJson: "{\"elementId\":\"TARGET_ELEMENT_ID\"}",
            },
          ],
        },
      ],
      null,
      2,
    ),
  ].join("\n");
};

const buildRepairPrompt = (rawResponseText: string) =>
  [
    "Rewrite the following model output into a strict browser-agent session JSON object.",
    "Return JSON only.",
    "Do not include markdown fences.",
    "Allowed top-level fields only: title, description, rationaleSummary, done, finalSummary, taskProfile, researchNotes, executionStrategy, steps.",
    "Each step may only contain: id, title, summary, kind, toolId, actionId, inputJson, continueOnError.",
    "inputJson must be a JSON object string.",
    "taskProfile may only contain: taskType, objective, deliverable.",
    "researchNotes may only contain: domainConsiderations, informationGaps, successCriteria.",
    "executionStrategy may only contain: modelConsiderations, outputPlan, approvalChecklist, risks.",
    "If no more action is needed, set done=true, keep steps as [], and preserve any completion summary in finalSummary.",
    "Keep the original meaning. Only repair the structure.",
    "",
    "[Raw Model Output]",
    rawResponseText,
  ].join("\n");

const canonicalizePlannerCatalogId = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[`"'“”‘’]/g, "")
    .replace(/\s+/g, "")
    .replace(/_/g, ".")
    .replace(/:+/g, ".")
    .replace(/\/+/g, ".")
    .replace(/^\.+|\.+$/g, "");

const buildPlannerCatalogResolver = (args: {
  tools: BrowserToolDefinition[];
  host: BrowserAgentHostSummary | null;
}): PlannerCatalogResolver => {
  const toolAliasMap = new Map<string, string>();
  const actionAliasMap = new Map<string, string>();
  const toolIds = new Set<string>();
  const actionIds = new Set<string>();

  const registerAliases = (
    aliasMap: Map<string, string>,
    targetId: string,
    extraAliases: string[],
  ) => {
    const candidates = [targetId, ...extraAliases];
    candidates.forEach((candidate) => {
      const normalized = canonicalizePlannerCatalogId(candidate);
      if (!normalized || aliasMap.has(normalized)) return;
      aliasMap.set(normalized, targetId);
    });
  };

  args.tools.forEach((tool) => {
    const targetId = String(tool.id || "").trim();
    if (!targetId) return;
    toolIds.add(targetId);
    const tail = targetId.split(".").pop() || targetId;
    registerAliases(toolAliasMap, targetId, [
      tool.title || "",
      tail,
      tail.replace(/\./g, ""),
      targetId.replace(/^browser\./, ""),
      targetId.replace(/^workspace\./, ""),
    ]);
  });

  (args.host?.actions || []).forEach((action) => {
    const targetId = String(action.id || "").trim();
    if (!targetId) return;
    actionIds.add(targetId);
    const tail = targetId.split(".").pop() || targetId;
    registerAliases(actionAliasMap, targetId, [
      action.title || "",
      tail,
      tail.replace(/\./g, ""),
      targetId.replace(/^workspace\./, ""),
    ]);
  });

  return {
    toolIds,
    actionIds,
    toolAliasMap,
    actionAliasMap,
    hostId: args.host?.id || null,
  };
};

const resolvePlannerCatalogId = (
  rawValue: unknown,
  aliasMap: Map<string, string>,
  idSet: Set<string>,
) => {
  const raw = String(rawValue || "").trim();
  if (!raw) return "";
  if (idSet.has(raw)) return raw;
  const normalized = canonicalizePlannerCatalogId(raw);
  return aliasMap.get(normalized) || "";
};

const trimPlannerString = (value: unknown, maxLength = 160) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, maxLength) : "";
};

const trimPlannerStringArray = (value: unknown, limit = 6, maxLength = 160) => {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => trimPlannerString(item, maxLength))
    .filter(Boolean)
    .slice(0, limit);
};

const normalizeTaskProfile = (
  value: unknown,
): BrowserAgentGoalSessionPlan["taskProfile"] | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const taskType = trimPlannerString(raw.taskType, 80);
  const objective = trimPlannerString(raw.objective, 180);
  const deliverable = trimPlannerString(raw.deliverable, 180);
  if (!taskType || !objective || !deliverable) return undefined;
  return {
    taskType,
    objective,
    deliverable,
  };
};

const normalizeResearchNotes = (
  value: unknown,
): BrowserAgentGoalSessionPlan["researchNotes"] | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const domainConsiderations = trimPlannerStringArray(
    raw.domainConsiderations,
    6,
    120,
  );
  const informationGaps = trimPlannerStringArray(raw.informationGaps, 6, 120);
  const successCriteria = trimPlannerStringArray(raw.successCriteria, 6, 120);
  if (
    domainConsiderations.length === 0 &&
    informationGaps.length === 0 &&
    successCriteria.length === 0
  ) {
    return undefined;
  }
  return {
    domainConsiderations:
      domainConsiderations.length > 0 ? domainConsiderations : undefined,
    informationGaps: informationGaps.length > 0 ? informationGaps : undefined,
    successCriteria: successCriteria.length > 0 ? successCriteria : undefined,
  };
};

const normalizeExecutionStrategy = (
  value: unknown,
): BrowserAgentGoalSessionPlan["executionStrategy"] | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const modelConsiderations = trimPlannerStringArray(
    raw.modelConsiderations,
    6,
    120,
  );
  const outputPlan = trimPlannerStringArray(raw.outputPlan, 8, 140);
  const approvalChecklist = trimPlannerStringArray(
    raw.approvalChecklist,
    6,
    120,
  );
  const risks = trimPlannerStringArray(raw.risks, 6, 120);
  if (
    modelConsiderations.length === 0 &&
    outputPlan.length === 0 &&
    approvalChecklist.length === 0 &&
    risks.length === 0
  ) {
    return undefined;
  }
  return {
    modelConsiderations:
      modelConsiderations.length > 0 ? modelConsiderations : undefined,
    outputPlan: outputPlan.length > 0 ? outputPlan : undefined,
    approvalChecklist:
      approvalChecklist.length > 0 ? approvalChecklist : undefined,
    risks: risks.length > 0 ? risks : undefined,
  };
};

const buildDefaultPlannerStepTitle = (args: {
  kind: "tool" | "host_action";
  toolId?: string;
  actionId?: string;
  index: number;
}) => {
  const actionOrToolId =
    trimPlannerString(args.toolId || args.actionId, 120) || `step_${args.index + 1}`;
  const labelMap: Record<string, string> = {
    "workspace.observe_generation_target": "检查目标节点当前状态",
    "workspace.read_element_capabilities": "读取节点可执行能力",
    "workspace.read_element_controls": "读取当前生成参数",
    "workspace.diagnose_generation_trace": "诊断生成错误与自修复状态",
    "workspace.repair_generation_state": "修复当前节点生成状态",
    "workspace.generate_image": "发起本轮图片生成",
    "workspace.await_generation_completion": "等待本轮生成完成",
    "workspace.read_generation_trace": "回读生成轨迹与结果",
    "workspace.open_preview": "打开结果预览确认画面",
    "workspace.read_selected_element": "读取当前选中节点信息",
  };
  return labelMap[actionOrToolId] || actionOrToolId;
};

const normalizeGoalPlannerPatch = (args: {
  raw: unknown;
  resolver: PlannerCatalogResolver;
}): GoalPlannerPatch | null => {
  if (!args.raw || typeof args.raw !== "object") return null;
  const data = args.raw as Record<string, unknown>;

  const rawTitle = String(data.title || "").trim();
  const rawDescription = String(data.description || "").trim();
  const rationaleSummary = String(data.rationaleSummary || "").trim();
  const finalSummary = String(data.finalSummary || "").trim();
  const taskProfile = normalizeTaskProfile(data.taskProfile);
  const researchNotes = normalizeResearchNotes(data.researchNotes);
  const executionStrategy = normalizeExecutionStrategy(data.executionStrategy);
  const rawSteps = Array.isArray(data.steps) ? data.steps : [];
  const done =
    data.done === true ||
    (data.done !== false && rawSteps.length === 0 && Boolean(finalSummary));
  const steps = rawSteps
    .map((step, index) =>
      normalizeGoalPlannerStepPatch({
        raw: step,
        index,
        resolver: args.resolver,
      }),
    )
    .filter((step): step is GoalPlannerStepPatch => Boolean(step))
    .slice(0, 16);
  const description =
    rawDescription ||
    finalSummary ||
    rationaleSummary ||
    (steps.length > 0 ? "Model-generated browser-agent execution plan." : "");
  const title =
    rawTitle ||
    (description ? description.slice(0, 80) : "") ||
    (steps.length > 0 ? "Browser Agent Goal Session" : "");

  if (!description || !rationaleSummary) {
    return null;
  }

  if (!done && steps.length === 0) {
    return null;
  }

  return {
    title,
    description,
    rationaleSummary,
    done,
    finalSummary: finalSummary || undefined,
    taskProfile,
    researchNotes,
    executionStrategy,
    steps,
  };
};

const normalizeGoalPlannerStepPatch = (args: {
  raw: unknown;
  index: number;
  resolver: PlannerCatalogResolver;
}): GoalPlannerStepPatch | null => {
  if (!args.raw || typeof args.raw !== "object") return null;
  const data = args.raw as Record<string, unknown>;
  const hintedKind = String(data.kind || "").trim();
  const normalizedToolId = resolvePlannerCatalogId(
    data.toolId,
    args.resolver.toolAliasMap,
    args.resolver.toolIds,
  );
  const normalizedActionId = resolvePlannerCatalogId(
    data.actionId,
    args.resolver.actionAliasMap,
    args.resolver.actionIds,
  );
  const kind =
    hintedKind === "host_action" ||
    (!hintedKind && !normalizedToolId && Boolean(normalizedActionId))
      ? "host_action"
      : "tool";
  const id = String(data.id || "").trim() || `step_${args.index + 1}`;
  const title =
    trimPlannerString(data.title, 120) ||
    buildDefaultPlannerStepTitle({
      kind,
      toolId: normalizedToolId,
      actionId: normalizedActionId,
      index: args.index,
    });
  const summary = trimPlannerString(data.summary, 220) || undefined;
  const continueOnError = Boolean(data.continueOnError);
  const input = parseInputJson(data.inputJson);

  if (kind === "tool") {
    if (!normalizedToolId) return null;
    return {
      id,
      title,
      summary,
      kind,
      toolId: normalizedToolId,
      input,
      continueOnError,
    };
  }

  if (!normalizedActionId) return null;
  return {
    id,
    title,
    summary,
    kind,
    hostId: args.resolver.hostId || undefined,
    actionId: normalizedActionId,
    input,
    continueOnError,
  };
};

const parseInputJson = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  const raw = String(value || "").trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
};

const summarizeHostSnapshot = (snapshot: unknown) => {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  const data = snapshot as Record<string, unknown>;

  return {
    project: isPlainRecord(data.project)
      ? {
          title: data.project.title || null,
          showAssistant: data.project.showAssistant || false,
          previewOpen: data.project.previewOpen || false,
        }
      : null,
    canvas: isPlainRecord(data.canvas)
      ? {
          activeTool: data.canvas.activeTool || null,
          zoom: data.canvas.zoom || null,
          isPanning: data.canvas.isPanning || false,
        }
      : null,
    selection: isPlainRecord(data.selection)
      ? {
          selectedElementId: data.selection.selectedElementId || null,
          selectedCount: data.selection.selectedCount || 0,
          primarySelectedElement: summarizeElement(
            (data.selection as Record<string, unknown>).primarySelectedElement,
          ),
        }
      : null,
    elements: isPlainRecord(data.elements)
      ? {
          totalCount: data.elements.totalCount || 0,
          generatingCount: data.elements.generatingCount || 0,
          typeCounts: data.elements.typeCounts || {},
        }
      : null,
  };
};

const summarizeElement = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const generation = isPlainRecord(data.generation)
    ? {
        model: data.generation.model || null,
        aspectRatio: data.generation.aspectRatio || null,
        quality: data.generation.quality || null,
        imageCount: data.generation.imageCount || null,
        hasPrompt: data.generation.hasPrompt || false,
        isGenerating: data.generation.isGenerating || false,
        statusTitle: data.generation.statusTitle || null,
        statusLines: Array.isArray(data.generation.statusLines)
          ? (data.generation.statusLines as unknown[]).slice(0, 4)
          : [],
      }
    : null;

  return {
    id: data.id || null,
    type: data.type || null,
    content: isPlainRecord(data.content)
      ? {
          textPreview: data.content.textPreview || null,
          referenceImageCount: data.content.referenceImageCount || 0,
          previewImageCount: data.content.previewImageCount || 0,
        }
      : null,
    grouping: isPlainRecord(data.grouping)
      ? {
          treeNodeKind: data.grouping.treeNodeKind || null,
          nodeParentId: data.grouping.nodeParentId || null,
        }
      : null,
    generation,
  };
};

const summarizeRecentSession = (session?: BrowserAgentSessionRecord | null) => {
  if (!session) return null;

  const completedSteps = (session.steps || [])
    .filter((step) => step.status === "completed")
    .slice(0, 8)
    .map((step) => ({
      id: step.id,
      title: step.title,
      summary: step.summary || null,
      kind: step.kind,
      toolId: step.toolId || null,
      actionId: step.actionId || null,
      resultSummary: summarizeUnknown(step.result),
    }));

  const failedSteps = (session.steps || [])
    .filter((step) => step.status === "failed")
    .slice(0, 4)
    .map((step) => ({
      id: step.id,
      title: step.title,
      error: step.error || null,
    }));

  return {
    id: session.id,
    title: session.title,
    status: session.status,
    currentStepId: session.currentStepId || null,
    lastError: session.lastError || null,
    targetHostId: String(session.metadata?.targetHostId || "").trim() || null,
    targetElementId: String(session.metadata?.targetElementId || "").trim() || null,
    rationaleSummary:
      String(session.metadata?.rationaleSummary || "").trim() || null,
    finalSummary: String(session.metadata?.finalSummary || "").trim() || null,
    continuationStatus:
      String(session.metadata?.continuationStatus || "").trim() || null,
    continuationCount: Number(session.metadata?.continuationCount || 0) || 0,
    completedSteps,
    failedSteps,
  };
};

const summarizeUnknown = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => summarizeUnknown(item, depth + 1));
  }
  if (typeof value === "object") {
    if (depth >= 1) {
      return `[object keys=${Object.keys(value as Record<string, unknown>).length}]`;
    }
    return Object.entries(value as Record<string, unknown>)
      .slice(0, 6)
      .reduce<Record<string, unknown>>((acc, [key, entry]) => {
        acc[key] = summarizeUnknown(entry, depth + 1);
        return acc;
      }, {});
  }
  return String(value);
};

const resolveBrowserAgentPlannerModel = () => {
  const settings = getBrowserAgentSettings();
  const configuredModel = String(settings.model || "").trim();
  const config = getBrowserAgentModelConfig();

  if (config) {
    return {
      modelId: config.modelId,
      providerId: config.providerId || null,
      label: config.displayLabel,
    };
  }

  if (configuredModel && configuredModel !== "auto") {
    const parsed = parseMappedModelStorageEntry("script", configuredModel);
    if (parsed.modelId) {
      return {
        modelId: parsed.modelId,
        providerId: parsed.providerId || null,
        label: getModelDisplayLabel(parsed.modelId),
      };
    }
  }

  const fallback = getMappedPrimaryModelConfig("script");
  if (fallback?.modelId) {
    return {
      modelId: fallback.modelId,
      providerId: fallback.providerId || null,
      label: fallback.displayLabel,
    };
  }

  throw new Error(
    "Browser agent model is not configured. Please choose a browser agent model in Settings before starting a goal session.",
  );
};

const toInlineImagePart = (dataUrl: string) => {
  const match = String(dataUrl || "").trim().match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    inlineData: {
      mimeType: match[1],
      data: match[2],
    },
  };
};

export const planBrowserAgentGoalSession = async (args: {
  goal: string;
  host: BrowserAgentHostSummary | null;
  hostSnapshot: unknown;
  tools: BrowserToolDefinition[];
  recentConsole?: BrowserConsoleEvent[];
  recentSession?: BrowserAgentSessionRecord | null;
  targetElementId?: string | null;
  referenceImages?: string[];
}): Promise<BrowserAgentGoalSessionPlan> => {
  const goal = String(args.goal || "").trim();
  if (!goal) {
    throw new Error("Browser agent goal is required.");
  }

  const agentSettings = getBrowserAgentSettings();
  if (!agentSettings.browserRuntimeEnabled) {
    throw new Error("Browser agent runtime is currently disabled in Settings.");
  }

  const plannerModel = resolveBrowserAgentPlannerModel();
  const resolver = buildPlannerCatalogResolver({
    tools: args.tools,
    host: args.host,
  });
  const referenceImages = Array.isArray(args.referenceImages)
    ? args.referenceImages
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const prompt = buildGoalPlannerPrompt({
    goal,
    host: args.host,
    hostSnapshot: args.hostSnapshot,
    tools: args.tools,
    recentConsole: Array.isArray(args.recentConsole) ? args.recentConsole.slice(-12) : [],
    recentSession: args.recentSession || null,
    targetElementId: args.targetElementId || null,
    referenceImageCount: referenceImages.length,
  });
  const parts = [
    {
      text: prompt,
    },
    ...referenceImages
      .map((image) => toInlineImagePart(image))
      .filter(Boolean),
  ];

  const response = await generateJsonResponse({
    model: plannerModel.modelId,
    providerId: plannerModel.providerId || undefined,
    parts,
    temperature: 0.2,
    responseSchema: GOAL_PLAN_RESPONSE_SCHEMA,
    operation: "browserAgentGoalPlan",
    queueKey: "browserAgentGoalPlan",
    minIntervalMs: 400,
    requestTuning: {
      timeoutMs: 45000,
      retries: 1,
      baseDelayMs: 800,
      maxDelayMs: 3000,
    },
  });

  let normalized = normalizeGoalPlannerPatch({
    raw: JSON.parse(response.text || "{}"),
    resolver,
  });

  if (!normalized) {
    const repairResponse = await generateJsonResponse({
      model: plannerModel.modelId,
      providerId: plannerModel.providerId || undefined,
      parts: [
        {
          text: buildRepairPrompt(response.text || "{}"),
        },
      ],
      temperature: 0.1,
      responseSchema: GOAL_PLAN_RESPONSE_SCHEMA,
      operation: "browserAgentGoalPlan.repair",
      queueKey: "browserAgentGoalPlan",
      minIntervalMs: 400,
      requestTuning: {
        timeoutMs: 30000,
        retries: 0,
        baseDelayMs: 500,
        maxDelayMs: 1500,
      },
    });

    normalized = normalizeGoalPlannerPatch({
      raw: JSON.parse(repairResponse.text || "{}"),
      resolver,
    });

    if (!normalized) {
      throw new Error(
        `Browser agent goal planning returned an incomplete plan. ${String(
          repairResponse.text || response.text || "",
        ).slice(0, 1200)}`,
      );
    }

    normalized.rawResponseText = repairResponse.text || "";
  } else {
    normalized.rawResponseText = response.text || "";
  }

  return {
    title: normalized.title || "Browser Agent Goal Session",
    description: normalized.description || goal,
    rationaleSummary: normalized.rationaleSummary || "Model-generated execution plan.",
    done: Boolean(normalized.done),
    finalSummary:
      normalized.finalSummary ||
      (normalized.done ? normalized.rationaleSummary || undefined : undefined),
    taskProfile: normalized.taskProfile,
    researchNotes: normalized.researchNotes,
    executionStrategy: normalized.executionStrategy,
    plannerModel,
    targetHostId: args.host?.id || null,
    targetElementId: String(args.targetElementId || "").trim() || null,
    plannedAt: Date.now(),
    steps: (normalized.steps || []).map((step) => ({ ...step })),
    rawResponseText: normalized.rawResponseText,
  };
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
