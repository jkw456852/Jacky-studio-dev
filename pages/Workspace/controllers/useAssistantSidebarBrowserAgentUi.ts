import React from "react";
import type {
  BrowserAgentGoalSessionPlan,
  BrowserAgentHostActionDefinition,
  BrowserAgentSessionRecord,
  BrowserToolDefinition,
} from "../../../services/browser-agent";
import { invokeBrowserAgentTool } from "../../../services/browser-agent";
import {
  WORKSPACE_BROWSER_AGENT_HOST_ID,
  type WorkspaceElementControlsReport,
} from "../browserAgentHost";
import { compressImage, createImagePreviewDataUrl } from "../workspaceShared";
import type { WorkspaceInputFile } from "../../../types";

type UseAssistantSidebarBrowserAgentUiArgs = {
  selectedElementId: string | null;
  selectedElementLabel: string | null;
  selectedElementType?: string | null;
  selectedTreeNodeKind?: string | null;
  createTargetElement?: (input: {
    prompt?: string;
    referenceImages?: string[];
  }) => string | null;
};

type GoalActionArgs = {
  goal: string;
  attachments?: File[];
};

type BrowserAgentSessionStatus =
  | "pending"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "cancelled";

type StepCatalogEntry = {
  id: string;
  title: string;
  description: string;
  category?: string | null;
};

type BrowserAgentRuntimeSummary = {
  initialized: boolean;
  hostCount: number;
  toolCount: number;
  sessionCount: number;
  runningSessionCount: number;
};

type BrowserAgentCapabilitySummary = {
  isGenerating: boolean;
  hasGenerationTrace: boolean;
  enabledActionCount: number;
  enabledToolCount: number;
  targetTreeNodeKind: string | null;
};

const MAX_AUTO_CONTINUATIONS = 4;
const MAX_REFERENCE_IMAGES = 4;
const REFERENCE_IMAGE_MAX_DIM = 1280;
const PENDING_TARGET_ELEMENT_ID = "__browser_agent_pending_target__";

const RUNNING_SESSION_STATUSES = new Set<BrowserAgentSessionStatus>([
  "pending",
  "running",
]);

const DEFAULT_GOAL_TEMPLATE =
  "先查看当前节点的上下文、可用工具和最近执行痕迹，再直接执行最合适的下一步，并把关键信息回写到对话里。";

const BROWSER_AGENT_CHAT_ENABLED_STORAGE_KEY =
  "workspace.browser-agent.chat-enabled";

const readInitialBrowserAgentChatEnabled = () => {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(
    BROWSER_AGENT_CHAT_ENABLED_STORAGE_KEY,
  );
  if (raw === "false") return false;
  if (raw === "true") return true;
  return true;
};

const getSessionStatusLabel = (
  status: BrowserAgentSessionStatus | undefined,
) => {
  switch (status) {
    case "pending":
      return "等待启动";
    case "running":
      return "执行中";
    case "completed":
      return "已完成";
    case "completed_with_errors":
      return "部分完成";
    case "failed":
      return "已失败";
    case "cancelled":
      return "已取消";
    default:
      return "未开始";
  }
};

const getStepStatusLabel = (status: string | undefined) => {
  switch (status) {
    case "pending":
      return "等待中";
    case "running":
      return "进行中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "skipped":
      return "已跳过";
    case "cancelled":
      return "已取消";
    default:
      return "未知";
  }
};

const isRunningSession = (session: BrowserAgentSessionRecord | null) =>
  Boolean(
    session?.status &&
      RUNNING_SESSION_STATUSES.has(
        session.status as BrowserAgentSessionStatus,
      ),
  );

const getPlannerModelLabelFromMetadata = (
  metadata: BrowserAgentSessionRecord["metadata"] | null | undefined,
) => {
  const plannerModel = metadata?.plannerModel;
  if (!plannerModel) return null;

  if (typeof plannerModel === "string") {
    return plannerModel.trim() || null;
  }

  if (typeof plannerModel === "object") {
    const label = String(
      (plannerModel as { label?: string; model?: string }).label ||
        (plannerModel as { label?: string; model?: string }).model ||
        "",
    ).trim();
    return label || null;
  }

  return null;
};

const getRationaleSummaryFromMetadata = (
  metadata: BrowserAgentSessionRecord["metadata"] | null | undefined,
) => {
  const summary = String(metadata?.rationaleSummary || "").trim();
  return summary || null;
};

const getGoalFromMetadata = (
  metadata: BrowserAgentSessionRecord["metadata"] | null | undefined,
) => {
  const goal = String(metadata?.goal || "").trim();
  return goal || null;
};

const getContinuationStatusFromMetadata = (
  metadata: BrowserAgentSessionRecord["metadata"] | null | undefined,
) => {
  const status = String(metadata?.continuationStatus || "").trim();
  return status || null;
};

const getContinuationCountFromMetadata = (
  metadata: BrowserAgentSessionRecord["metadata"] | null | undefined,
) => {
  const value = Number(metadata?.continuationCount || 0);
  return Number.isFinite(value) ? value : 0;
};

type PreparedGoalSessionPlan = {
  goal: string;
  targetElementId: string | null;
  targetElementPendingCreation: boolean;
  referenceImages: string[];
  referenceImageCount: number;
  plan: BrowserAgentGoalSessionPlan;
  repairNotes: string[];
  controlSummary: {
    model: string | null;
    aspectRatio: string | null;
    resolution: string | null;
    imageCount: string | null;
    quality: string | null;
  } | null;
};

const extractPreparedPlanControlSummary = (
  report: WorkspaceElementControlsReport | null | undefined,
) => {
  const controls = Array.isArray(report?.controls) ? report.controls : [];
  if (controls.length === 0) return null;

  const findValue = (controlId: string) => {
    const hit = controls.find((control) => control.id === controlId);
    if (!hit) return null;
    if (typeof hit.currentValue === "boolean") {
      return hit.currentValue ? "on" : "off";
    }
    return String(hit.currentValue || "").trim() || null;
  };

  return {
    model: findValue("genModel"),
    aspectRatio: findValue("genAspectRatio"),
    resolution: findValue("genResolution"),
    imageCount: findValue("genImageCount"),
    quality: findValue("genImageQuality"),
  };
};

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];

const repairGoalPlanForPresentation = (args: {
  goal: string;
  plan: BrowserAgentGoalSessionPlan;
}) => {
  const repairNotes: string[] = [];
  const normalizedSteps = Array.isArray(args.plan.steps)
    ? args.plan.steps.map((step, index) => {
        const nextStep = { ...step };
        if (!String(nextStep.id || "").trim()) {
          nextStep.id = `step_${index + 1}`;
          repairNotes.push(`步骤 ${index + 1} 缺少 id，已补默认值。`);
        }
        if (!String(nextStep.title || "").trim()) {
          nextStep.title =
            nextStep.kind === "host_action"
              ? `执行动作 ${index + 1}`
              : `读取信息 ${index + 1}`;
          repairNotes.push(`步骤 ${index + 1} 缺少标题，已补默认标题。`);
        }
        if (!String(nextStep.summary || "").trim()) {
          nextStep.summary = "这一小步会在正式执行时补充必要信息并推进当前任务。";
          repairNotes.push(`步骤 ${index + 1} 缺少摘要，已补展示文案。`);
        }
        return nextStep;
      })
    : [];

  const normalizedPlan: BrowserAgentGoalSessionPlan = {
    ...args.plan,
    title:
      String(args.plan.title || "").trim() || "待确认执行计划",
    description:
      String(args.plan.description || "").trim() ||
      String(args.plan.rationaleSummary || "").trim() ||
      `围绕“${args.goal}”生成一份执行计划。`,
    rationaleSummary:
      String(args.plan.rationaleSummary || "").trim() ||
      "我会先检查节点上下文、生成参数、执行痕迹和风险，再决定是否继续生成或先修复问题。",
    steps: normalizedSteps,
    plannerModel: {
      modelId: String(args.plan.plannerModel?.modelId || "").trim() || "unknown",
      providerId: args.plan.plannerModel?.providerId || null,
      label:
        String(args.plan.plannerModel?.label || "").trim() ||
        String(args.plan.plannerModel?.modelId || "").trim() ||
        "Planner",
    },
  };

  if (!String(args.plan.title || "").trim()) {
    repairNotes.push("计划标题缺失，已补默认标题。");
  }
  if (!String(args.plan.description || "").trim()) {
    repairNotes.push("计划说明缺失，已用推理摘要补足展示文案。");
  }
  if (!String(args.plan.rationaleSummary || "").trim()) {
    repairNotes.push("计划推理摘要缺失，已补一版可读说明。");
  }
  if (!String(args.plan.plannerModel?.label || "").trim()) {
    repairNotes.push("规划模型标签缺失，已退回使用模型 ID 展示。");
  }

  return {
    plan: normalizedPlan,
    repairNotes: Array.from(new Set(repairNotes)),
  };
};

const buildSessionAutoRepairSignature = (session: BrowserAgentSessionRecord) =>
  [
    session.id,
    session.status,
    session.completedAt || 0,
    session.lastError || "",
    session.steps.length,
    session.steps.filter((step) => step.status === "failed").length,
  ].join(":");

const buildSuggestedGoal = (args: {
  selectedElementLabel: string | null;
  selectedElementType?: string | null;
  selectedTreeNodeKind?: string | null;
}) => {
  const label = String(args.selectedElementLabel || "").trim() || "当前节点";
  const elementType = String(args.selectedElementType || "").trim();
  const treeNodeKind = String(args.selectedTreeNodeKind || "").trim();

  if (treeNodeKind === "prompt") {
    return `查看 ${label} 的上下文、参考关系和可用控件，必要时调整参数，然后再执行最合适的图片生成下一步。`;
  }

  if (
    treeNodeKind === "image" ||
    elementType === "gen-image" ||
    elementType === "image"
  ) {
    return `检查 ${label} 的生成痕迹、可用工具和关联上下文，判断下一步更适合继续生成、改参重试还是读取 trace，并直接执行。`;
  }

  return `检查 ${label} 的上下文、可用工具和参数，再围绕这个节点执行最合适的下一步，并返回关键信息。`;
};

export const useAssistantSidebarBrowserAgentUi = ({
  selectedElementId,
  selectedElementLabel,
  selectedElementType,
  selectedTreeNodeKind,
  createTargetElement,
}: UseAssistantSidebarBrowserAgentUiArgs) => {
  const [currentSession, setCurrentSession] =
    React.useState<BrowserAgentSessionRecord | null>(null);
  const [toolCatalog, setToolCatalog] = React.useState<StepCatalogEntry[]>([]);
  const [hostActionCatalog, setHostActionCatalog] = React.useState<
    StepCatalogEntry[]
  >([]);
  const [runtimeSummary, setRuntimeSummary] =
    React.useState<BrowserAgentRuntimeSummary | null>(null);
  const [capabilitySummary, setCapabilitySummary] =
    React.useState<BrowserAgentCapabilitySummary | null>(null);
  const [chatEnabledState, setChatEnabledState] = React.useState(
    readInitialBrowserAgentChatEnabled,
  );
  const [preparedPlan, setPreparedPlan] =
    React.useState<PreparedGoalSessionPlan | null>(null);
  const [isPlanning, setIsPlanning] = React.useState(false);
  const [isStarting, setIsStarting] = React.useState(false);
  const [isContinuing, setIsContinuing] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const autoContinuationSessionIdRef = React.useRef<string | null>(null);
  const autoContinuationSignatureRef = React.useRef<string | null>(null);
  const autoRepairSignatureRef = React.useRef<string | null>(null);

  const chatEnabled = chatEnabledState;
  const setChatEnabled = React.useCallback((value: boolean) => {
    setChatEnabledState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        BROWSER_AGENT_CHAT_ENABLED_STORAGE_KEY,
        value ? "true" : "false",
      );
    }
  }, []);

  const buildReferenceImagesFromAttachments = React.useCallback(
    async (attachments?: File[]) => {
      const imageFiles = (attachments || [])
        .filter((file) => String(file?.type || "").startsWith("image/"))
        .slice(0, MAX_REFERENCE_IMAGES);

      if (imageFiles.length === 0) {
        return [] as string[];
      }

      return Promise.all(
        imageFiles.map(async (file) => {
          const workspaceFile = file as WorkspaceInputFile;
          const canvasPreviewUrl = String(workspaceFile._chipPreviewUrl || "").trim();
          const isCanvasPlaceholder = Boolean(
            workspaceFile._canvasAutoInsert || workspaceFile._canvasElId,
          );

          if (isCanvasPlaceholder && canvasPreviewUrl) {
            try {
              return await createImagePreviewDataUrl(
                canvasPreviewUrl,
                REFERENCE_IMAGE_MAX_DIM,
                0.82,
              );
            } catch (error) {
              console.warn(
                "[browser-agent] failed to normalize canvas attachment preview, fallback to raw preview url",
                {
                  fileName: file.name,
                  elementId: workspaceFile._canvasElId || null,
                  error,
                },
              );
              return canvasPreviewUrl;
            }
          }

          return compressImage(file, REFERENCE_IMAGE_MAX_DIM);
        }),
      );
    },
    [],
  );

  const syncReferenceImagesToSelectedElement = React.useCallback(
    async (elementId: string, referenceImages: string[]) => {
      if (referenceImages.length === 0) {
        return;
      }

      const normalizedElementId = String(elementId || "").trim();
      if (!normalizedElementId) {
        throw new Error("Agent 模式当前没有可用的目标节点来承接参考图。");
      }

      await invokeBrowserAgentTool("browser.invoke_host_action", {
        hostId: WORKSPACE_BROWSER_AGENT_HOST_ID,
        actionId: "workspace.update_element_control",
        input: {
          elementId: normalizedElementId,
          controlId: "genRefImages",
          value: referenceImages,
        },
      });
    },
    [],
  );

  const suggestedGoal = React.useMemo(
    () =>
      selectedElementId
        ? buildSuggestedGoal({
            selectedElementLabel,
            selectedElementType,
            selectedTreeNodeKind,
          })
        : DEFAULT_GOAL_TEMPLATE,
    [
      selectedElementId,
      selectedElementLabel,
      selectedElementType,
      selectedTreeNodeKind,
    ],
  );

  const replacePendingTargetElementId = React.useCallback(
    (value: unknown, targetElementId: string): unknown => {
      if (typeof value === "string") {
        return value.trim() === PENDING_TARGET_ELEMENT_ID ? targetElementId : value;
      }
      if (Array.isArray(value)) {
        return value.map((item) =>
          replacePendingTargetElementId(item, targetElementId),
        );
      }
      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
            key,
            replacePendingTargetElementId(nested, targetElementId),
          ]),
        );
      }
      return value;
    },
    [],
  );

  const resolveGoalTargetElementId = React.useCallback(
    async (goal: string, referenceImages: string[]) => {
      const currentSelectedId = String(selectedElementId || "").trim();
      if (currentSelectedId) {
        return {
          targetElementId: currentSelectedId,
          targetElementPendingCreation: false,
        };
      }

      if (referenceImages.length === 0) {
        return {
          targetElementId: null,
          targetElementPendingCreation: false,
        };
      }

      if (!createTargetElement) {
        throw new Error("Agent 当前没有可用目标节点，而且暂时无法自动创建承接参考图的节点。");
      }

      return {
        targetElementId: PENDING_TARGET_ELEMENT_ID,
        targetElementPendingCreation: true,
      };
    },
    [createTargetElement, selectedElementId],
  );

  const refreshSessionById = React.useCallback(async (sessionId: string) => {
    const normalizedSessionId = String(sessionId || "").trim();
    if (!normalizedSessionId) return null;

    const result = (await invokeBrowserAgentTool("browser.read_session", {
      sessionId: normalizedSessionId,
    })) as {
      session?: BrowserAgentSessionRecord | null;
    };

    const nextSession = result?.session || null;
    setCurrentSession(nextSession);
    return nextSession;
  }, []);

  const updateSessionRepairMetadata = React.useCallback(
    async (sessionId: string, metadataPatch: Record<string, unknown>) => {
      const normalizedSessionId = String(sessionId || "").trim();
      if (!normalizedSessionId) return null;
      const result = (await invokeBrowserAgentTool(
        "browser.update_session_metadata",
        {
          sessionId: normalizedSessionId,
          metadataPatch,
        },
      )) as {
        session?: BrowserAgentSessionRecord | null;
      };
      const nextSession = result?.session || null;
      if (nextSession) {
        setCurrentSession(nextSession);
      }
      return nextSession;
    },
    [],
  );

  const refreshLatestSessionForSelection = React.useCallback(async () => {
    if (!selectedElementId) {
      setCurrentSession(null);
      return null;
    }

    setIsRefreshing(true);
    try {
      const result = (await invokeBrowserAgentTool("browser.list_sessions", {
        limit: 20,
      })) as {
        sessions?: BrowserAgentSessionRecord[];
      };
      const sessions = Array.isArray(result?.sessions) ? result.sessions : [];
      const matched =
        sessions.find((session) => {
          const metadata = session.metadata || {};
          return (
            String(metadata.targetHostId || "") ===
              WORKSPACE_BROWSER_AGENT_HOST_ID &&
            String(metadata.targetElementId || "") === selectedElementId
          );
        }) || null;

      setCurrentSession(matched);
      return matched;
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedElementId]);

  const refreshCatalog = React.useCallback(async () => {
    try {
      const [toolsResult, hostActionsResult, runtimeResult] = await Promise.all([
        invokeBrowserAgentTool("browser.list_tools", {}),
        invokeBrowserAgentTool("browser.read_host_actions", {
          hostId: WORKSPACE_BROWSER_AGENT_HOST_ID,
        }),
        invokeBrowserAgentTool("browser.read_runtime_snapshot", {}),
      ]);

      const tools = Array.isArray((toolsResult as { tools?: unknown[] })?.tools)
        ? ((toolsResult as { tools?: BrowserToolDefinition[] }).tools || [])
        : [];
      const hostActions = Array.isArray(
        (hostActionsResult as { actions?: unknown[] })?.actions,
      )
        ? ((hostActionsResult as { actions?: BrowserAgentHostActionDefinition[] })
            .actions || [])
        : [];

      setToolCatalog(
        tools.map((tool) => ({
          id: tool.id,
          title: tool.title || tool.id,
          description: tool.description || "",
          category: tool.category || null,
        })),
      );
      setHostActionCatalog(
        hostActions.map((action) => ({
          id: action.id,
          title: action.title || action.id,
          description: action.description || "",
          category: "host_action",
        })),
      );

      const runtimeSnapshot = (runtimeResult as {
        snapshot?: BrowserAgentRuntimeSummary;
      })?.snapshot;
      setRuntimeSummary(runtimeSnapshot || null);
    } catch {
      setToolCatalog([]);
      setHostActionCatalog([]);
      setRuntimeSummary(null);
    }
  }, []);

  React.useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const refreshCapabilitySummary = React.useCallback(async () => {
    if (!selectedElementId) {
      setCapabilitySummary(null);
      return null;
    }

    try {
      const result = (await invokeBrowserAgentTool(
        "workspace.read_element_capabilities",
        {
          elementId: selectedElementId,
        },
      )) as {
        report?: {
          isGenerating?: boolean;
          hasGenerationTrace?: boolean;
          targetTreeNodeKind?: string | null;
          actions?: Array<{ enabled?: boolean }>;
          tools?: Array<{ enabled?: boolean }>;
        } | null;
      };
      const report = result?.report;
      if (!report) {
        setCapabilitySummary(null);
        return null;
      }

      const nextSummary: BrowserAgentCapabilitySummary = {
        isGenerating: Boolean(report.isGenerating),
        hasGenerationTrace: Boolean(report.hasGenerationTrace),
        enabledActionCount: Array.isArray(report.actions)
          ? report.actions.filter((item) => item?.enabled).length
          : 0,
        enabledToolCount: Array.isArray(report.tools)
          ? report.tools.filter((item) => item?.enabled).length
          : 0,
        targetTreeNodeKind: String(report.targetTreeNodeKind || "").trim() || null,
      };
      setCapabilitySummary(nextSummary);
      return nextSummary;
    } catch {
      setCapabilitySummary(null);
      return null;
    }
  }, [selectedElementId]);

  const runAutomaticSessionRepair = React.useCallback(
    async (session: BrowserAgentSessionRecord) => {
      const sessionId = String(session.id || "").trim();
      if (!sessionId) return null;

      const targetElementId =
        String(session.metadata?.targetElementId || "").trim() || "";
      if (!targetElementId) {
        return null;
      }

      const sourceSignature = buildSessionAutoRepairSignature(session);
      if (
        String(session.metadata?.autoRepairSourceSignature || "").trim() ===
        sourceSignature
      ) {
        return session;
      }

      const diagnosisWrapper = (await invokeBrowserAgentTool(
        "workspace.diagnose_generation_trace",
        {
          elementId: targetElementId,
        },
      )) as {
        result?: {
          ok?: boolean;
          summary?: string;
          issues?: string[];
          payload?: {
            diagnosisItems?: Array<{
              repaired?: boolean;
              message?: string;
              repairSummary?: string | null;
            }>;
            unresolvedIssueCount?: number;
            repairedIssueCount?: number;
          };
        } | null;
      };

      const diagnosisResult = diagnosisWrapper?.result || null;
      const diagnosisPayload =
        diagnosisResult?.payload && typeof diagnosisResult.payload === "object"
          ? diagnosisResult.payload
          : null;
      const diagnosisItems = Array.isArray(diagnosisPayload?.diagnosisItems)
        ? diagnosisPayload.diagnosisItems
        : [];
      const diagnosisIssues = normalizeStringArray(diagnosisResult?.issues);
      const unresolvedIssueCount = Number(
        diagnosisPayload?.unresolvedIssueCount || 0,
      );
      const repairedIssueCount = Number(
        diagnosisPayload?.repairedIssueCount || 0,
      );
      const diagnosisSummary =
        String(diagnosisResult?.summary || "").trim() ||
        "已完成一轮自动诊断。";

      let repairActionResult:
        | {
            accepted?: boolean;
            repairedFields?: string[];
            notes?: string[];
            reason?: string | null;
          }
        | null = null;

      if (
        unresolvedIssueCount > 0 ||
        diagnosisIssues.length > 0 ||
        diagnosisItems.some((item) => !item?.repaired)
      ) {
        const repairWrapper = (await invokeBrowserAgentTool(
          "browser.invoke_host_action",
          {
            hostId: WORKSPACE_BROWSER_AGENT_HOST_ID,
            actionId: "workspace.repair_generation_state",
            input: {
              elementId: targetElementId,
            },
          },
        )) as {
          result?: {
            accepted?: boolean;
            repairedFields?: string[];
            notes?: string[];
            reason?: string | null;
          } | null;
        };
        repairActionResult = repairWrapper?.result || null;
      }

      const repairNotes = Array.from(
        new Set(
          [
            ...diagnosisItems
              .filter((item) => item?.repaired && String(item?.repairSummary || "").trim())
              .map((item) => String(item?.repairSummary || "").trim()),
            ...normalizeStringArray(repairActionResult?.notes),
          ].filter(Boolean),
        ),
      );
      const repairedFields = normalizeStringArray(
        repairActionResult?.repairedFields,
      );

      const repairSummary = repairActionResult
        ? repairActionResult.accepted
          ? repairedFields.length > 0
            ? `已自动修复当前节点状态，修复字段：${repairedFields.join("、")}。`
            : "已执行自动修复检查，当前节点没有需要补写的字段。"
          : String(repairActionResult.reason || "").trim() ||
            "尝试自动修复当前节点状态，但这次没有成功。"
        : repairedIssueCount > 0
          ? `本轮已检测到 ${repairedIssueCount} 项已自愈问题，无需再次补写节点状态。`
          : unresolvedIssueCount > 0
            ? "已发现问题，但还没有执行宿主修复动作。"
            : "本轮没有发现需要修复的结构性问题。";

      const nextSession = await updateSessionRepairMetadata(sessionId, {
        latestDiagnosisSummary: diagnosisSummary,
        latestDiagnosisIssues: diagnosisIssues,
        latestRepairSummary: repairSummary,
        latestRepairNotes: repairNotes,
        latestRepairTargetElementId: targetElementId,
        latestRepairUpdatedAt: Date.now(),
        autoRepairSourceSignature: sourceSignature,
      });

      return nextSession;
    },
    [updateSessionRepairMetadata],
  );

  React.useEffect(() => {
    if (!selectedElementId) {
      setError(null);
      return;
    }

    setError(null);
    void refreshLatestSessionForSelection();
    void refreshCapabilitySummary();
  }, [
    refreshCapabilitySummary,
    refreshLatestSessionForSelection,
    selectedElementId,
  ]);

  React.useEffect(() => {
    if (!isRunningSession(currentSession)) {
      return;
    }

    const timer = window.setInterval(() => {
      if (!currentSession?.id) return;
      void refreshSessionById(currentSession.id);
    }, 1200);

    return () => {
      window.clearInterval(timer);
    };
  }, [currentSession, refreshSessionById]);

  const handleStartGoalSession = React.useCallback(
    async ({ goal: nextGoal, attachments }: GoalActionArgs) => {
      const normalizedGoal = String(nextGoal || "").trim();
      if (!normalizedGoal) {
        setError("请输入执行目标。");
        return null;
      }

      setIsPlanning(true);
      setPreparedPlan(null);
      setError(null);
      try {
        console.log("[browser-agent] start_goal_session.prepare.begin", {
          selectedElementId: String(selectedElementId || "").trim() || null,
          attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
        });
        const referenceImages =
          await buildReferenceImagesFromAttachments(attachments);
        console.log("[browser-agent] start_goal_session.prepare.refs_ready", {
          referenceImageCount: referenceImages.length,
        });
        const targetResolution = await resolveGoalTargetElementId(
          normalizedGoal,
          referenceImages,
        );
        const targetElementId = targetResolution.targetElementId;
        console.log("[browser-agent] start_goal_session.prepare.target_ready", {
          targetElementId,
          targetElementPendingCreation:
            targetResolution.targetElementPendingCreation,
        });

        console.log("[browser-agent] start_goal_session.invoke", {
          targetElementId: targetElementId || null,
          referenceImageCount: referenceImages.length,
        });
        const controlsResult = targetElementId
          && targetElementId !== PENDING_TARGET_ELEMENT_ID
          ? ((await invokeBrowserAgentTool("workspace.read_element_controls", {
              elementId: targetElementId,
            })) as {
              report?: WorkspaceElementControlsReport | null;
            })
          : null;
        const result = (await invokeBrowserAgentTool("browser.plan_goal_session", {
          goal: normalizedGoal,
          hostId: WORKSPACE_BROWSER_AGENT_HOST_ID,
          targetElementId: targetElementId || undefined,
          includeConsole: true,
          recentConsoleLimit: 8,
          recentSession: currentSession || undefined,
          referenceImages,
        })) as {
          plan?: BrowserAgentGoalSessionPlan | null;
        };

        const nextPlan = result?.plan || null;
        if (!nextPlan) {
          throw new Error("Browser agent failed to prepare an execution plan.");
        }
        const repairedPresentationPlan = repairGoalPlanForPresentation({
          goal: normalizedGoal,
          plan: nextPlan,
        });
        console.log("[browser-agent] start_goal_session.success", {
          sessionId: null,
          status: "planned",
        });
        setPreparedPlan({
          goal: normalizedGoal,
          targetElementId:
            targetElementId === PENDING_TARGET_ELEMENT_ID
              ? null
              : targetElementId || null,
          targetElementPendingCreation:
            targetResolution.targetElementPendingCreation,
          referenceImages,
          referenceImageCount: referenceImages.length,
          plan: repairedPresentationPlan.plan,
          repairNotes: repairedPresentationPlan.repairNotes,
          controlSummary: extractPreparedPlanControlSummary(
            controlsResult?.report,
          ),
        });
        autoContinuationSessionIdRef.current = null;
        autoContinuationSignatureRef.current = null;
        autoRepairSignatureRef.current = null;
        setCurrentSession(null);
        return {
          plan: repairedPresentationPlan.plan,
          session: null,
        };
      } catch (sessionError) {
        const message =
          sessionError instanceof Error
            ? sessionError.message
            : String(sessionError || "执行代理规划失败。");
        console.error("[browser-agent] start_goal_session.failed", sessionError);
        setError(message);
        return null;
      } finally {
        setIsPlanning(false);
      }
    },
    [
      buildReferenceImagesFromAttachments,
      currentSession,
      resolveGoalTargetElementId,
    ],
  );

  const handleContinueGoalSession = React.useCallback(
    async (session: BrowserAgentSessionRecord) => {
      const sessionId = String(session.id || "").trim();
      if (!sessionId) return null;

      const goal =
        getGoalFromMetadata(session.metadata) ||
        String(session.description || "").trim() ||
        String(session.title || "").trim();
      if (!goal) return null;

      setIsContinuing(true);
      setError(null);
      try {
        const result = (await invokeBrowserAgentTool(
          "browser.continue_goal_session",
          {
            sessionId,
            goal,
            includeConsole: true,
            recentConsoleLimit: 8,
            autoStart: true,
          },
        )) as {
          session?: BrowserAgentSessionRecord | null;
        };

        const nextSession = result?.session || null;
        setCurrentSession(nextSession);
        return nextSession;
      } catch (sessionError) {
        const message =
          sessionError instanceof Error
            ? sessionError.message
            : String(sessionError || "继续执行失败。");
        setError(message);
        return null;
      } finally {
        setIsContinuing(false);
      }
    },
    [],
  );

  const handleCancelSession = React.useCallback(async () => {
    if (preparedPlan) {
      setPreparedPlan(null);
      setError(null);
      return null;
    }
    if (!currentSession?.id) return null;
    try {
      const result = (await invokeBrowserAgentTool("browser.cancel_session", {
        sessionId: currentSession.id,
      })) as {
        session?: BrowserAgentSessionRecord | null;
      };
      const nextSession = result?.session || null;
      setCurrentSession(nextSession);
      return nextSession;
    } catch (sessionError) {
      const message =
        sessionError instanceof Error
          ? sessionError.message
          : String(sessionError || "取消会话失败。");
      setError(message);
      return null;
    }
  }, [currentSession?.id, preparedPlan]);

  const handleApprovePreparedPlan = React.useCallback(async () => {
    if (!preparedPlan) return null;

    setIsStarting(true);
    setError(null);
    try {
      let targetElementId =
        String(preparedPlan.plan.targetElementId || "").trim() || null;

      if (
        preparedPlan.targetElementPendingCreation ||
        targetElementId === PENDING_TARGET_ELEMENT_ID
      ) {
        if (!createTargetElement) {
          throw new Error("Agent 缺少目标节点，且当前无法在执行前创建承接节点。");
        }

        const createdElementId = createTargetElement({
          prompt: preparedPlan.goal,
          referenceImages: preparedPlan.referenceImages,
        });
        const normalizedCreatedId = String(createdElementId || "").trim();
        if (!normalizedCreatedId) {
          throw new Error("Agent 自动创建目标节点失败，请稍后重试。");
        }
        targetElementId = normalizedCreatedId;
      }

      if (targetElementId) {
        await syncReferenceImagesToSelectedElement(
          targetElementId,
          preparedPlan.referenceImages,
        );
      }

      const normalizedSteps = targetElementId
        ? preparedPlan.plan.steps.map((step) => ({
            ...step,
            input: replacePendingTargetElementId(
              step.input || {},
              targetElementId,
            ) as Record<string, unknown>,
          }))
        : preparedPlan.plan.steps;

      const result = (await invokeBrowserAgentTool("browser.start_session", {
        title: preparedPlan.plan.title,
        description: preparedPlan.plan.description,
        metadata: {
          goal: preparedPlan.goal,
          planner: "goal-session-approved-plan",
          plannerModel: preparedPlan.plan.plannerModel,
          rationaleSummary: preparedPlan.plan.rationaleSummary,
          finalSummary: preparedPlan.plan.finalSummary || null,
          taskProfile: preparedPlan.plan.taskProfile || null,
          researchNotes: preparedPlan.plan.researchNotes || null,
          executionStrategy: preparedPlan.plan.executionStrategy || null,
          continuationStatus: "done",
          continuationCount: 0,
          targetHostId: preparedPlan.plan.targetHostId,
          targetElementId,
          plannedAt: preparedPlan.plan.plannedAt,
          inputReferenceImages: preparedPlan.referenceImages,
          approvedFromPlan: true,
          approvedRepairNotes: preparedPlan.repairNotes,
        },
        autoStart: true,
        steps: normalizedSteps,
      })) as {
        session?: BrowserAgentSessionRecord | null;
      };
      const nextSession = result?.session || null;
      setPreparedPlan(null);
      autoContinuationSessionIdRef.current = nextSession?.id || null;
      autoContinuationSignatureRef.current = null;
      autoRepairSignatureRef.current = null;
      setCurrentSession(nextSession);
      return nextSession;
    } catch (sessionError) {
      const message =
        sessionError instanceof Error
          ? sessionError.message
          : String(sessionError || "执行代理启动失败。");
      setError(message);
      return null;
    } finally {
      setIsStarting(false);
    }
  }, [
    createTargetElement,
    preparedPlan,
    replacePendingTargetElementId,
    syncReferenceImagesToSelectedElement,
  ]);

  React.useEffect(() => {
    if (!chatEnabled || isStarting || isRefreshing || isContinuing || preparedPlan) {
      return;
    }

    const session = currentSession;
    if (!session) return;
    if (autoContinuationSessionIdRef.current !== session.id) return;

    const status = session.status as BrowserAgentSessionStatus;
    if (status !== "completed" && status !== "completed_with_errors") {
      return;
    }

    if (getContinuationStatusFromMetadata(session.metadata) === "done") {
      return;
    }

    const continuationCount = getContinuationCountFromMetadata(session.metadata);
    if (continuationCount >= MAX_AUTO_CONTINUATIONS) {
      return;
    }

    const goal = getGoalFromMetadata(session.metadata);
    if (!goal) {
      return;
    }

    const signature = [
      session.id,
      session.steps.length,
      session.completedAt || 0,
      continuationCount,
      session.lastError || "",
    ].join(":");

    if (autoContinuationSignatureRef.current === signature) {
      return;
    }

    autoContinuationSignatureRef.current = signature;
    void handleContinueGoalSession(session);
  }, [
    chatEnabled,
    currentSession,
    handleContinueGoalSession,
    isContinuing,
    preparedPlan,
    isRefreshing,
    isStarting,
  ]);

  React.useEffect(() => {
    if (preparedPlan || isStarting || isRefreshing || isContinuing) {
      return;
    }

    const session = currentSession;
    if (!session) return;

    const status = session.status as BrowserAgentSessionStatus;
    const shouldRepair =
      status === "failed" ||
      status === "completed_with_errors" ||
      ((status === "completed" || status === "cancelled") &&
        (Boolean(String(session.lastError || "").trim()) ||
          session.steps.some((step) => step.status === "failed")));
    if (!shouldRepair) {
      return;
    }

    const signature = buildSessionAutoRepairSignature(session);
    if (autoRepairSignatureRef.current === signature) {
      return;
    }

    autoRepairSignatureRef.current = signature;
    void runAutomaticSessionRepair(session).catch((repairError) => {
      console.warn("[browser-agent] automatic session repair failed", {
        sessionId: session.id,
        error: repairError,
      });
      autoRepairSignatureRef.current = null;
    });
  }, [
    currentSession,
    isContinuing,
    isRefreshing,
    isStarting,
    preparedPlan,
    runAutomaticSessionRepair,
  ]);

  const currentStep =
    currentSession?.steps.find(
      (step) => step.id === currentSession.currentStepId,
    ) || null;

  const sessionSummary = React.useMemo(
    () => ({
      selectedElementLabel:
        selectedElementLabel || selectedElementId || "未选中节点",
      selectedElementId: selectedElementId || null,
      statusLabel: getSessionStatusLabel(
        currentSession?.status as BrowserAgentSessionStatus,
      ),
      isRunning: isRunningSession(currentSession),
      currentStepTitle: isContinuing ? "正在规划下一轮动作" : currentStep?.title || null,
      currentStepStatusLabel: currentStep
        ? getStepStatusLabel(currentStep.status)
        : null,
      plannerLabel: getPlannerModelLabelFromMetadata(currentSession?.metadata),
      rationaleSummary: getRationaleSummaryFromMetadata(currentSession?.metadata),
      runtimeSummary,
      capabilitySummary,
      toolCount: toolCatalog.length,
      hostActionCount: hostActionCatalog.length,
    }),
    [
      capabilitySummary,
      isContinuing,
      currentSession?.metadata,
      currentSession?.status,
      currentStep,
      hostActionCatalog.length,
      runtimeSummary,
      selectedElementId,
      selectedElementLabel,
      toolCatalog.length,
    ],
  );

  return {
    chatEnabled,
    setChatEnabled,
    suggestedGoal,
    preparedPlan,
    currentSession,
    isPlanning,
    isStarting,
    isContinuing,
    isRefreshing,
    error,
    sessionSummary,
    handleStartGoalSession,
    handleApprovePreparedPlan,
    handleCancelSession,
    handleRefreshSession: () =>
      currentSession?.id
        ? refreshSessionById(currentSession.id)
        : refreshLatestSessionForSelection(),
  };
};
