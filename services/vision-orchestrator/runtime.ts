import type { ImageGenSkillParams } from "../../types";
import { planVisualGenerationWithModel } from "./planner";
import type {
  PlannedImageGeneration,
  PlannedVisualTaskUnit,
  PlannerConsistencyContext,
  VisualPlannerModelConfig,
  VisualTaskPlan,
} from "./types";

export type VisualAgentStage =
  | "bootstrap"
  | "generation_plan"
  | "generate"
  | "observe"
  | "finish"
  | "handoff"
  | "fail";

export type VisualAgentActionType =
  | "bootstrap"
  | "plan_generation"
  | "generate_image"
  | "observe_result";

export type VisualAgentActionStatus = "started" | "completed" | "failed";

export type VisualAgentAction = {
  type: VisualAgentActionType;
  status: VisualAgentActionStatus;
  startedAt: number;
  completedAt?: number;
  detail?: string;
  error?: string;
};

export type VisualAgentSession = {
  id: string;
  stage: VisualAgentStage;
  status: "running" | "completed" | "handoff" | "failed";
  startedAt: number;
  updatedAt: number;
  taskPlan: VisualTaskPlan;
  taskUnit: PlannedVisualTaskUnit;
  plannedGeneration?: PlannedImageGeneration;
  resultUrl?: string;
  error?: string;
  actions: VisualAgentAction[];
};

export type VisualAgentRuntimeEvent = {
  stage: VisualAgentStage;
  kind: VisualAgentActionStatus;
  title: string;
  message: string;
  session: VisualAgentSession;
};

export type RunVisualAgentLoopArgs = {
  sessionId?: string;
  prompt: string;
  manualReferenceImages: string[];
  referenceImages: string[];
  selectedGenerationModel: string;
  currentAspectRatio: string;
  imageSize: string;
  imageQuality: NonNullable<ImageGenSkillParams["imageQuality"]>;
  requestedReferenceRoleMode?: ImageGenSkillParams["referenceRoleMode"];
  translatePromptToEnglish?: boolean;
  enforceChineseTextInImage?: boolean;
  requiredChineseCopy?: string;
  consistencyContext?: PlannerConsistencyContext;
  taskPlan: VisualTaskPlan;
  taskUnit: PlannedVisualTaskUnit;
  modelConfig?: VisualPlannerModelConfig | null;
  onRuntimeEvent?: (event: VisualAgentRuntimeEvent) => void;
  generateImage: (args: {
    session: VisualAgentSession;
    plannedGeneration: PlannedImageGeneration;
    taskPlan: VisualTaskPlan;
    taskUnit: PlannedVisualTaskUnit;
  }) => Promise<string | null>;
};

export type RunVisualAgentLoopResult =
  | {
      status: "completed";
      session: VisualAgentSession;
      plannedGeneration: PlannedImageGeneration;
      resultUrl: string;
    }
  | {
      status: "handoff";
      session: VisualAgentSession;
      reason: string;
    }
  | {
      status: "failed";
      session: VisualAgentSession;
      error: string;
    };

const createInitialSession = (
  args: Pick<RunVisualAgentLoopArgs, "sessionId" | "taskPlan" | "taskUnit">,
): VisualAgentSession => {
  const now = Date.now();
  return {
    id:
      args.sessionId ||
      `visual-agent:${now}:${Math.random().toString(36).slice(2, 8)}`,
    stage: "bootstrap",
    status: "running",
    startedAt: now,
    updatedAt: now,
    taskPlan: args.taskPlan,
    taskUnit: args.taskUnit,
    actions: [],
  };
};

const cloneSession = (session: VisualAgentSession): VisualAgentSession => ({
  ...session,
  actions: session.actions.map((action) => ({ ...action })),
});

const emitRuntimeEvent = (
  callback: RunVisualAgentLoopArgs["onRuntimeEvent"],
  stage: VisualAgentStage,
  kind: VisualAgentActionStatus,
  title: string,
  message: string,
  session: VisualAgentSession,
) => {
  if (!callback) return;
  callback({
    stage,
    kind,
    title,
    message,
    session: cloneSession(session),
  });
};

const pushAction = (
  session: VisualAgentSession,
  action: VisualAgentAction,
): VisualAgentSession => ({
  ...session,
  actions: [...session.actions, action],
  updatedAt: Date.now(),
});

const updateLastAction = (
  session: VisualAgentSession,
  updater: (action: VisualAgentAction) => VisualAgentAction,
): VisualAgentSession => {
  if (session.actions.length === 0) return session;
  const actions = session.actions.slice();
  actions[actions.length - 1] = updater(actions[actions.length - 1]);
  return {
    ...session,
    actions,
    updatedAt: Date.now(),
  };
};

const toRuntimeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message || error.name || "Unknown runtime error";
  }
  return String(error || "Unknown runtime error");
};

export const runVisualAgentLoop = async (
  args: RunVisualAgentLoopArgs,
): Promise<RunVisualAgentLoopResult> => {
  let session = createInitialSession(args);

  emitRuntimeEvent(
    args.onRuntimeEvent,
    "bootstrap",
    "started",
    "运行时已启动",
    "已创建本次视觉 agent 会话，准备进入执行循环。",
    session,
  );

  if (args.taskPlan.mode !== "single") {
    session = {
      ...session,
      stage: "handoff",
      status: "handoff",
      updatedAt: Date.now(),
    };
    emitRuntimeEvent(
      args.onRuntimeEvent,
      "handoff",
      "completed",
      "切换到扩展链路",
      `当前任务模式为 ${args.taskPlan.mode}，最小 runtime 先交回外层处理。`,
      session,
    );
    return {
      status: "handoff",
      session,
      reason: `unsupported-mode:${args.taskPlan.mode}`,
    };
  }

  try {
    while (session.status === "running") {
      if (session.stage === "bootstrap") {
        session = {
          ...session,
          stage: "generation_plan",
          updatedAt: Date.now(),
        };
        continue;
      }

      if (session.stage === "generation_plan") {
        session = pushAction(session, {
          type: "plan_generation",
          status: "started",
          startedAt: Date.now(),
          detail: "Preparing model-specific generation plan.",
        });
        emitRuntimeEvent(
          args.onRuntimeEvent,
          "generation_plan",
          "started",
          "正在编排执行方案",
          "正在把任务目标、参考图分工和模型约束整理成可执行生图方案。",
          session,
        );

        const plannedGeneration = await planVisualGenerationWithModel(
          {
            prompt: args.prompt,
            manualReferenceImages: args.manualReferenceImages,
            referenceImages: args.referenceImages,
            selectedGenerationModel: args.selectedGenerationModel,
            taskRoleOverlay: args.taskPlan.roleOverlay,
            taskPlanningBrief: args.taskPlan.planningBrief,
            requestedReferenceRoleMode: args.requestedReferenceRoleMode,
            imageQuality: args.imageQuality,
            translatePromptToEnglish: args.translatePromptToEnglish,
            enforceChineseTextInImage: args.enforceChineseTextInImage,
            requiredChineseCopy: args.requiredChineseCopy,
            consistencyContext: args.consistencyContext,
          },
          args.modelConfig,
        );

        session = updateLastAction(
          {
            ...session,
            plannedGeneration,
            stage: "generate",
            updatedAt: Date.now(),
          },
          (action) => ({
            ...action,
            status: "completed",
            completedAt: Date.now(),
            detail: plannedGeneration.plan.strategyId,
          }),
        );
        emitRuntimeEvent(
          args.onRuntimeEvent,
          "generation_plan",
          "completed",
          "执行方案已确定",
          `已完成执行方案编排，策略为 ${plannedGeneration.plan.strategyId}。`,
          session,
        );
        continue;
      }

      if (session.stage === "generate") {
        const plannedGeneration = session.plannedGeneration;
        if (!plannedGeneration) {
          throw new Error("Runtime is missing the planned generation payload.");
        }

        session = pushAction(session, {
          type: "generate_image",
          status: "started",
          startedAt: Date.now(),
          detail: "Calling image generation tool.",
        });
        emitRuntimeEvent(
          args.onRuntimeEvent,
          "generate",
          "started",
          "正在执行当前生图",
          "开始调用图像生成工具，并把执行方案转成底层模型请求。",
          session,
        );

        const resultUrl = await args.generateImage({
          session,
          plannedGeneration,
          taskPlan: args.taskPlan,
          taskUnit: args.taskUnit,
        });
        if (!resultUrl) {
          throw new Error("Image generation returned no result URL.");
        }

        session = updateLastAction(
          {
            ...session,
            resultUrl,
            stage: "observe",
            updatedAt: Date.now(),
          },
          (action) => ({
            ...action,
            status: "completed",
            completedAt: Date.now(),
            detail: "Image result captured.",
          }),
        );
        emitRuntimeEvent(
          args.onRuntimeEvent,
          "generate",
          "completed",
          "已拿到生成结果",
          "底层模型已经返回图像结果，准备进入结果观察阶段。",
          session,
        );
        continue;
      }

      if (session.stage === "observe") {
        session = pushAction(session, {
          type: "observe_result",
          status: "started",
          startedAt: Date.now(),
          detail: "Observing generation output.",
        });
        emitRuntimeEvent(
          args.onRuntimeEvent,
          "observe",
          "started",
          "正在观察结果",
          "本轮先确认结果已经成功返回，后续再继续接 evaluator / replan 能力。",
          session,
        );

        session = updateLastAction(
          {
            ...session,
            stage: "finish",
            updatedAt: Date.now(),
          },
          (action) => ({
            ...action,
            status: "completed",
            completedAt: Date.now(),
            detail: "Single-image runtime observation completed.",
          }),
        );
        emitRuntimeEvent(
          args.onRuntimeEvent,
          "observe",
          "completed",
          "结果观察完成",
          "当前最小 runtime 已确认结果返回成功，准备结束本轮会话。",
          session,
        );
        continue;
      }

      if (session.stage === "finish") {
        session = {
          ...session,
          status: "completed",
          updatedAt: Date.now(),
        };
        emitRuntimeEvent(
          args.onRuntimeEvent,
          "finish",
          "completed",
          "运行时完成",
          "本轮单图 agent loop 已结束。",
          session,
        );
        return {
          status: "completed",
          session,
          plannedGeneration: session.plannedGeneration!,
          resultUrl: session.resultUrl!,
        };
      }
    }
  } catch (error) {
    const reason = toRuntimeError(error);
    session = updateLastAction(
      {
        ...session,
        stage: "fail",
        status: "failed",
        error: reason,
        updatedAt: Date.now(),
      },
      (action) => ({
        ...action,
        status: "failed",
        completedAt: Date.now(),
        error: reason,
      }),
    );
    emitRuntimeEvent(
      args.onRuntimeEvent,
      "fail",
      "failed",
      "运行时失败",
      reason,
      session,
    );
    return {
      status: "failed",
      session,
      error: reason,
    };
  }

  return {
    status: "failed",
    session,
    error: "Visual runtime exited unexpectedly.",
  };
};
