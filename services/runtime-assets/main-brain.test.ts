import assert from "node:assert/strict";
import test from "node:test";
import {
  getStudioUserAssetApi,
  setStudioUserAssetApi,
} from "./api.ts";
import { createLocalStudioUserAssetApi } from "./local-user-assets.ts";
import {
  captureMainBrainMemoryFromExchange,
  recordMainBrainHeartbeatFromExchange,
} from "./main-brain-auto-memory.ts";
import { getMainBrainPreferenceBlock } from "./main-brain.ts";
import { getEffectiveAgentPrompt } from "../agents/role-config.ts";
import { resolveAnalyzePlanSystemPrompt } from "../agents/analyze-plan-system-prompt.ts";
import { AgentRegistry } from "../agents/registry.ts";

const createStorageMock = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
};

const withMockWindow = <T,>(storage: Storage, run: () => T): T => {
  storage.setItem("debug_model_mapping_writes", "off");
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
  });
  try {
    return run();
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).window;
    }
  }
};

const withLocalAssetApi = (
  run: (api: ReturnType<typeof createLocalStudioUserAssetApi>) => void,
) => {
  const storage = createStorageMock();
  withMockWindow(storage, () => {
    const originalApi = getStudioUserAssetApi();
    const api = createLocalStudioUserAssetApi();
    setStudioUserAssetApi(api);
    try {
      run(api);
    } finally {
      setStudioUserAssetApi(originalApi);
    }
  });
};

test("getMainBrainPreferenceBlock includes structured soul user workflow and memory summaries", () => {
  withLocalAssetApi((api) => {
    api.setMainBrainPreferences(["优先验证真实链路"]);
    api.setMainBrainSoul({
      persona: "冷静的产品工程主脑",
      tone: ["克制", "直接"],
      workingStyle: ["先审链路", "再做实现"],
      restraintRules: ["不要伪装完成"],
      selfCheckRules: ["输出前检查真实闭环"],
      riskPreference: "conservative",
    });
    api.setMainBrainUser({
      goals: ["把配置中心做成真功能"],
      workingHabits: ["先修底层再修 UI"],
      businessContext: ["这是产品级工作台"],
      aestheticPreferences: ["克制的专业感"],
      communicationStyle: ["中文直达结论"],
      permanentNotes: ["不要只看构建通过"],
      memoryBlacklist: ["一次性临时口头示例"],
    });
    api.setMainBrainWorkflow({
      defaultAnalysisDepth: "deep",
      searchPolicy: "prefer",
      clarifyBeforeExecution: true,
      toolUseGuidelines: ["先读再改", "整链验证"],
      failureRecoveryRules: ["失败先定位根因"],
      roleGovernanceDefaults: {
        mode: "approval_required",
        allowDraft: true,
        allowAutoPromote: false,
        allowAutoArchive: false,
      },
    });
    api.setMainBrainMemory({
      memoryRecords: {
        "memory-topic": {
          id: "memory-topic",
          schemaVersion: 1,
          createdAt: 1,
          updatedAt: 20,
          category: "workflow",
          source: "manual",
          status: "active",
          summary: "topic 相关长期记忆",
          detail: "topic detail",
          evidence: [],
          tags: ["topic"],
          topicId: "topic-42",
        },
        "memory-global": {
          id: "memory-global",
          schemaVersion: 1,
          createdAt: 1,
          updatedAt: 10,
          category: "preference",
          source: "manual",
          status: "active",
          summary: "全局长期记忆",
          detail: "global detail",
          evidence: [],
          tags: ["global"],
        },
        "candidate-1": {
          id: "candidate-1",
          schemaVersion: 1,
          createdAt: 1,
          updatedAt: 8,
          category: "workflow",
          source: "manual",
          status: "candidate",
          summary: "待确认候选记忆 1",
          detail: "candidate detail 1",
          evidence: [],
          tags: ["candidate"],
        },
        "candidate-2": {
          id: "candidate-2",
          schemaVersion: 1,
          createdAt: 1,
          updatedAt: 7,
          category: "preference",
          source: "manual",
          status: "candidate",
          summary: "待确认候选记忆 2",
          detail: "candidate detail 2",
          evidence: [],
          tags: ["candidate"],
        },
      },
      dailySummary: ["最近经常出现假闭环风险"],
      memoryBlacklists: ["测试脏数据"],
      pendingMemoryCandidates: ["candidate-1", "candidate-2"],
    });

    const block = getMainBrainPreferenceBlock({ topicId: "topic-42" });
    assert.equal(block.includes("# Main Brain Soul Summary"), true);
    assert.equal(block.includes("Persona: 冷静的产品工程主脑"), true);
    assert.equal(block.includes("Goals: 把配置中心做成真功能"), true);
    assert.equal(block.includes("Default analysis depth: deep"), true);
    assert.equal(block.includes("Topic-linked active memories: topic 相关长期记忆"), true);
    assert.equal(block.includes("Pending memory candidates: 2"), true);
    assert.equal(block.includes("优先验证真实链路"), true);
  });
});

test("getEffectiveAgentPrompt injects structured main-brain summary into agent prompt", () => {
  withLocalAssetApi((api) => {
    api.setMainBrainSoul({ persona: "长期产品工程助手" });
    api.setMainBrainUser({ goals: ["优先做真闭环"] });

    const prompt = getEffectiveAgentPrompt("coco");
    assert.equal(prompt.includes("# Main Brain Soul Summary"), true);
    assert.equal(prompt.includes("长期产品工程助手"), true);
    assert.equal(prompt.includes("Goals: 优先做真闭环"), true);
    assert.equal(prompt.includes("# 单智能体执行约定"), true);
    assert.equal(prompt.includes("当前产品默认采用单智能体执行模式"), true);
    assert.equal(prompt.includes("# 专家智能体名册"), false);
  });
});

test("resolveAnalyzePlanSystemPrompt prefers topic-linked memory summaries when topicId is provided", () => {
  withLocalAssetApi((api) => {
    api.setMainBrainMemory({
      memoryRecords: {
        "memory-topic": {
          id: "memory-topic",
          schemaVersion: 1,
          createdAt: 1,
          updatedAt: 30,
          category: "workflow",
          source: "manual",
          status: "active",
          summary: "仅当前话题应看到的记忆",
          detail: "topic detail",
          evidence: [],
          tags: [],
          topicId: "topic-special",
        },
        "memory-other": {
          id: "memory-other",
          schemaVersion: 1,
          createdAt: 1,
          updatedAt: 20,
          category: "workflow",
          source: "manual",
          status: "active",
          summary: "其他话题记忆",
          detail: "other detail",
          evidence: [],
          tags: [],
          topicId: "topic-other",
        },
      },
    });

    const prompt = resolveAnalyzePlanSystemPrompt({
      agentId: "coco",
      fallbackSystemPrompt: "fallback prompt",
      metadata: { topicId: "topic-special" },
    });

    assert.equal(prompt.includes("仅当前话题应看到的记忆"), true);
    assert.equal(prompt.includes("其他话题记忆"), false);
    assert.equal(prompt.includes("fallback prompt"), false);
  });
});

test("AgentRegistry core reflects latest main-brain preferences at runtime", () => {
  withLocalAssetApi((api) => {
    api.setMainBrainSoul({ persona: "初始主脑设定" });
    const firstCore = AgentRegistry["jkai-oneclick"].core;

    api.setMainBrainSoul({ persona: "更新后的主脑设定" });
    const secondCore = AgentRegistry["jkai-oneclick"].core;

    assert.equal(firstCore.includes("初始主脑设定"), true);
    assert.equal(firstCore.includes("更新后的主脑设定"), false);
    assert.equal(secondCore.includes("更新后的主脑设定"), true);
  });
});

test("bootstrap initialization writes defaults that appear in runtime preference block", () => {
  withLocalAssetApi((api) => {
    api.setMainBrainSoul({ persona: "旧主脑人格" });
    api.setMainBrainUser({ goals: ["旧目标"] });
    api.setMainBrainWorkflow({
      defaultAnalysisDepth: "light",
      searchPolicy: "never",
      clarifyBeforeExecution: false,
      toolUseGuidelines: ["旧工具规则"],
      failureRecoveryRules: ["旧恢复规则"],
      roleGovernanceDefaults: {
        mode: "manual_only",
        allowDraft: false,
        allowAutoPromote: false,
        allowAutoArchive: false,
      },
    });

    api.setMainBrainSoul({
      persona: "可靠、克制、以推进和交付为先的执行型主脑。",
      tone: [
        "默认先给结论、判断与下一步，再按需展开分析。",
        "表达直接、克制，避免空话与装饰性表述。",
      ],
      workingStyle: [
        "先拆解任务与依赖，再推进执行。",
        "默认产出可落地的下一步与验证动作。",
      ],
      restraintRules: ["不要伪装已完成或已验证。"],
      selfCheckRules: ["涉及实现时检查真实链路是否打通，而不只看构建结果。"],
      riskPreference: "balanced",
    });
    api.setMainBrainUser({
      goals: ["围绕用户的长期目标持续优化产品、协作流程与交付质量。"],
      workingHabits: ["默认先确认现状与链路，再做实现或结论输出。"],
      businessContext: ["常见项目类型：AI 配置中心 / 产品工作台"],
      aestheticPreferences: ["界面应克制、专业、统一，避免 demo 感。"],
      communicationStyle: ["默认先给结论、判断与下一步，再按需展开分析。"],
      permanentNotes: [
        "Bootstrap 来源：executor / conclusion_first / 搜索 prefer",
        "允许后续 Heartbeat 模块定期整理长期记忆。",
      ],
    });
    api.setMainBrainWorkflow({
      defaultAnalysisDepth: "balanced",
      searchPolicy: "prefer",
      clarifyBeforeExecution: false,
      toolUseGuidelines: [
        "先读上下文、再动手修改。",
        "变更后验证真实链路，不只以构建通过作为完成标准。",
      ],
      failureRecoveryRules: ["失败先定位根因，再决定重试或回退。"],
      roleGovernanceDefaults: {
        mode: "approval_required",
        allowDraft: true,
        allowAutoPromote: false,
        allowAutoArchive: false,
      },
    });
    api.setMainBrainBootstrap({
      initialized: true,
      initializedAt: 1710000000000,
      sourceTemplate: "bootstrap-questionnaire-v1|executor|conclusion_first|prefer|draft:1|heartbeat:1",
      completedSteps: [
        "collaboration-mode",
        "response-style",
        "search-policy",
        "role-draft-enabled",
        "heartbeat-enabled",
        "project-types",
        "bootstrap-applied",
      ],
      lastRebootstrapAt: null,
    });

    const block = getMainBrainPreferenceBlock();
    const bootstrapAsset = api.getMainBrainBootstrap();

    assert.equal(bootstrapAsset.initialized, true);
    assert.equal(
      bootstrapAsset.sourceTemplate,
      "bootstrap-questionnaire-v1|executor|conclusion_first|prefer|draft:1|heartbeat:1",
    );
    assert.equal(block.includes("Persona: 可靠、克制、以推进和交付为先的执行型主脑。"), true);
    assert.equal(block.includes("Business context: 常见项目类型：AI 配置中心 / 产品工作台"), true);
    assert.equal(block.includes("Default analysis depth: balanced"), true);
    assert.equal(block.includes("Search policy: prefer"), true);
    assert.equal(
      block.includes(
        "Role governance defaults: mode=approval_required, allowDraft=yes, allowAutoPromote=no, allowAutoArchive=no",
      ),
      true,
    );
    assert.equal(block.includes("旧主脑人格"), false);
    assert.equal(block.includes("旧目标"), false);
  });
});

test("memory lifecycle mutations update runtime preference block summaries", () => {
  withLocalAssetApi((api) => {
    api.setMainBrainMemory({
      memoryRecords: {
        "candidate-memory": {
          id: "candidate-memory",
          schemaVersion: 1,
          createdAt: 1,
          updatedAt: 10,
          category: "workflow",
          source: "manual",
          status: "candidate",
          summary: "候选记忆摘要",
          detail: "待确认的长期偏好",
          evidence: ["来自人工整理"],
          tags: ["candidate"],
        },
        "active-memory": {
          id: "active-memory",
          schemaVersion: 1,
          createdAt: 1,
          updatedAt: 20,
          category: "preference",
          source: "manual",
          status: "active",
          summary: "已确认长期记忆",
          detail: "已经进入运行时摘要",
          evidence: [],
          tags: ["active"],
        },
      },
      memoryIndex: ["active-memory"],
      pendingMemoryCandidates: ["candidate-memory"],
      dailySummary: ["最近需要重点确认新的工作流偏好"],
      memoryBlacklists: ["一次性临时玩笑"],
    });

    const initialBlock = getMainBrainPreferenceBlock();
    assert.equal(initialBlock.includes("Active long-term memories: 已确认长期记忆"), true);
    assert.equal(initialBlock.includes("候选记忆摘要"), false);
    assert.equal(initialBlock.includes("Pending memory candidates: 1"), true);

    const current = api.getMainBrainMemory();
    api.setMainBrainMemory({
      memoryRecords: {
        ...current.memoryRecords,
        "candidate-memory": {
          ...current.memoryRecords["candidate-memory"],
          status: "active",
          updatedAt: 30,
        },
      },
      memoryIndex: ["candidate-memory", ...current.memoryIndex],
      pendingMemoryCandidates: [],
    });

    const promotedBlock = getMainBrainPreferenceBlock();
    assert.equal(promotedBlock.includes("候选记忆摘要"), true);
    assert.equal(promotedBlock.includes("Pending memory candidates: 1"), false);

    const promoted = api.getMainBrainMemory();
    api.setMainBrainMemory({
      memoryRecords: {
        ...promoted.memoryRecords,
        "candidate-memory": {
          ...promoted.memoryRecords["candidate-memory"],
          status: "candidate",
          updatedAt: 40,
        },
      },
      memoryIndex: promoted.memoryIndex.filter((id) => id !== "candidate-memory"),
      pendingMemoryCandidates: ["candidate-memory"],
    });

    const demotedBlock = getMainBrainPreferenceBlock();
    assert.equal(demotedBlock.includes("候选记忆摘要"), false);
    assert.equal(demotedBlock.includes("Pending memory candidates: 1"), true);

    const demoted = api.getMainBrainMemory();
    const nextRecords = { ...demoted.memoryRecords };
    delete nextRecords["candidate-memory"];
    api.setMainBrainMemory({
      memoryRecords: nextRecords,
      memoryIndex: demoted.memoryIndex.filter((id) => id !== "candidate-memory"),
      pendingMemoryCandidates: [],
    });

    const deletedBlock = getMainBrainPreferenceBlock();
    assert.equal(deletedBlock.includes("候选记忆摘要"), false);
    assert.equal(deletedBlock.includes("Pending memory candidates: 1"), false);
    assert.equal(deletedBlock.includes("已确认长期记忆"), true);
  });
});

test("captureMainBrainMemoryFromExchange writes pending candidate memories into runtime summary without mutating durable soul user workflow", () => {
  withLocalAssetApi((api) => {
    api.setMainBrainSoul({ persona: "原始主脑人格" });
    api.setMainBrainUser({ goals: ["原始长期目标"] });
    api.setMainBrainWorkflow({
      defaultAnalysisDepth: "balanced",
      searchPolicy: "auto",
      clarifyBeforeExecution: false,
      toolUseGuidelines: ["原始工具规则"],
      failureRecoveryRules: ["原始恢复规则"],
      roleGovernanceDefaults: {
        mode: "approval_required",
        allowDraft: true,
        allowAutoPromote: false,
        allowAutoArchive: false,
      },
    });

    const result = captureMainBrainMemoryFromExchange({
      api,
      topicId: "topic-auto-1",
      userMessage: "以后不要只看构建通过，每次改完都要先验证真实链路再给结论。",
      assistantMessage: "收到，这次会按真实链路验证。",
      assistantSummary: "已记录长期协作偏好。",
    });

    const memory = api.getMainBrainMemory();
    const block = getMainBrainPreferenceBlock({ topicId: "topic-auto-1" });

    assert.equal(result.createdIds.length, 1);
    assert.equal(result.createdSummaries[0]?.includes("以后不要只看构建通过"), true);
    assert.equal(memory.pendingMemoryCandidates.length, 1);
    assert.equal(memory.memoryRecords[result.createdIds[0]]?.status, "candidate");
    assert.equal(memory.memoryRecords[result.createdIds[0]]?.source, "conversation");
    assert.equal(memory.memoryRecords[result.createdIds[0]]?.topicId, "topic-auto-1");
    assert.equal(block.includes("Pending memory candidates: 1"), true);
    assert.equal(block.includes("以后不要只看构建通过"), false);
    assert.equal(api.getMainBrainSoul().persona, "原始主脑人格");
    assert.equal(api.getMainBrainUser().goals[0], "原始长期目标");
    assert.equal(api.getMainBrainWorkflow().toolUseGuidelines[0], "原始工具规则");
  });
});

test("captureMainBrainMemoryFromExchange ignores noise and avoids duplicate candidate inflation", () => {
  withLocalAssetApi((api) => {
    const first = captureMainBrainMemoryFromExchange({
      api,
      topicId: "topic-dup-1",
      userMessage: "以后默认先查真实链路，再决定是否继续改。",
      assistantMessage: "收到。",
    });

    const second = captureMainBrainMemoryFromExchange({
      api,
      topicId: "topic-dup-1",
      userMessage: "以后默认先查真实链路，再决定是否继续改。",
      assistantMessage: "再次收到。",
    });

    const noise = captureMainBrainMemoryFromExchange({
      api,
      topicId: "topic-dup-1",
      userMessage: "继续",
      assistantMessage: "好。",
    });

    const memory = api.getMainBrainMemory();

    assert.equal(first.createdIds.length, 1);
    assert.equal(second.createdIds.length, 0);
    assert.equal(noise.createdIds.length, 0);
    assert.equal(memory.pendingMemoryCandidates.length, 1);
    assert.equal(Object.keys(memory.memoryRecords).length, 1);
  });
});

test("recordMainBrainHeartbeatFromExchange updates low-frequency summaries and task snapshots", () => {
  withLocalAssetApi((api) => {
    api.setMainBrainMemory({
      memoryRecords: {
        "candidate-auto": {
          id: "candidate-auto",
          schemaVersion: 1,
          createdAt: 1,
          updatedAt: 10,
          category: "workflow",
          source: "conversation",
          status: "candidate",
          summary: "以后默认先验证真实链路",
          detail: "以后默认先验证真实链路，再判断是否完成。",
          evidence: ["User: 以后默认先验证真实链路"],
          tags: ["verification"],
          topicId: "topic-heartbeat-1",
        },
      },
      pendingMemoryCandidates: ["candidate-auto"],
      memoryIndex: [],
    });
    api.setMainBrainHeartbeat({
      enabled: true,
      cadence: "weekly",
      scope: ["memory", "workflow"],
      recentRunSummary: [],
      heartbeatTasks: {
        "heartbeat-memory-review": {
          id: "heartbeat-memory-review",
          type: "memory_review_reminder",
          title: "提醒确认待提升记忆",
          enabled: true,
          cadence: "daily",
          scope: ["memory"],
          lastRunAt: null,
          nextRunAt: null,
          lastSummary: "",
        },
        "heartbeat-failure": {
          id: "heartbeat-failure",
          type: "failure_summary",
          title: "汇总最近失败原因",
          enabled: true,
          cadence: "weekly",
          scope: ["workflow"],
          lastRunAt: null,
          nextRunAt: null,
          lastSummary: "",
        },
      },
    });

    const heartbeatResult = recordMainBrainHeartbeatFromExchange({
      api,
      capturedMemorySummaries: ["以后默认先验证真实链路"],
      task: {
        id: "task-failed-1",
        agentId: "coco",
        status: "failed",
        input: { message: "修一下", context: {} as never },
        output: {
          message: "本轮执行失败，需要回头检查真实链路。",
          error: { message: "构建通过但运行时仍然崩溃" },
        },
        createdAt: 1,
        updatedAt: 2,
      },
    });

    const heartbeat = api.getMainBrainHeartbeat();
    const block = getMainBrainPreferenceBlock();

    assert.equal(heartbeatResult.updated, true);
    assert.equal(heartbeat.recentRunSummary.some((item) => item.includes("新增待确认记忆 1 条")), true);
    assert.equal(heartbeat.recentRunSummary.some((item) => item.includes("待确认记忆 1 条")), true);
    assert.equal(heartbeat.recentRunSummary.some((item) => item.includes("最近失败：构建通过但运行时仍然崩溃")), true);
    assert.equal(heartbeat.heartbeatTasks["heartbeat-memory-review"]?.lastSummary.includes("待确认记忆 1 条"), true);
    assert.equal(heartbeat.heartbeatTasks["heartbeat-failure"]?.lastSummary, "构建通过但运行时仍然崩溃");
    assert.equal(block.includes("# Main Brain Heartbeat Summary"), true);
    assert.equal(block.includes("Heartbeat recent summaries"), true);
    assert.equal(block.includes("最近失败：构建通过但运行时仍然崩溃"), true);
  });
});

test("heartbeat configuration updates runtime preference block summaries", () => {
  withLocalAssetApi((api) => {
    api.setMainBrainHeartbeat({
      enabled: true,
      cadence: "weekly",
      scope: ["memory", "workflow", "roles"],
      recentRunSummary: ["最近整理了重复偏好", "提醒处理待确认记忆"],
      lastRunAt: 1710000000000,
      nextRunAt: 1710600000000,
      heartbeatTasks: {
        "heartbeat-memory-review": {
          id: "heartbeat-memory-review",
          type: "memory_review_reminder",
          title: "提醒确认待提升记忆",
          enabled: true,
          cadence: "daily",
          scope: ["memory"],
          lastRunAt: 1710000000000,
          nextRunAt: 1710086400000,
          lastSummary: "发现 2 条待确认记忆需要人工处理",
        },
        "heartbeat-conflict": {
          id: "heartbeat-conflict",
          type: "rule_conflict_check",
          title: "检查默认规则冲突",
          enabled: false,
          cadence: "weekly",
          scope: ["workflow", "memory"],
          lastRunAt: null,
          nextRunAt: null,
          lastSummary: "当前暂无新的规则冲突记录",
        },
      },
    });

    const block = getMainBrainPreferenceBlock();
    const heartbeat = api.getMainBrainHeartbeat();

    assert.equal(heartbeat.enabled, true);
    assert.equal(heartbeat.cadence, "weekly");
    assert.equal(heartbeat.recentRunSummary[0], "最近整理了重复偏好");
    assert.equal(heartbeat.heartbeatTasks["heartbeat-memory-review"]?.title, "提醒确认待提升记忆");
    assert.equal(block.includes("最近整理了重复偏好"), true);
    assert.equal(block.includes("Heartbeat cadence: weekly"), true);

    api.setMainBrainPreferences([
      "Heartbeat 仅允许低频整理、提醒和冲突检查，不允许无限制联网搜索或无确认高风险发布。",
    ]);
    const guardedBlock = getMainBrainPreferenceBlock();
    assert.equal(
      guardedBlock.includes(
        "Heartbeat 仅允许低频整理、提醒和冲突检查，不允许无限制联网搜索或无确认高风险发布。",
      ),
      true,
    );
  });
});
