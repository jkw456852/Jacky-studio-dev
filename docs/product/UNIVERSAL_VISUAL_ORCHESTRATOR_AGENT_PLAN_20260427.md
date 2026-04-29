# 通用视觉 Orchestrator Agent 实施方案

最后更新：2026-04-27

适用范围：
- `pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts`
- `services/vision-orchestrator/*`
- `services/skills/image-gen.skill.ts`
- `services/gemini.ts`
- `services/agents/*`
- 树状关键词节点生图链路

## 1. 目标

当前关键词节点已经具备：
- 参考图输入
- 单次视觉编排
- prompt 改写
- 多张变体生成
- 狂暴重试

但它还不是“会做事的智能体”，而更像：
- 一次性 planner
- 产出一个改写后的 prompt
- 然后直接调用生图工具

本方案的目标是把它升级成一层真正的视觉 Orchestrator Agent，让它像 Codex 一样：
- 先理解任务
- 再决定要不要拆解任务
- 再决定调用哪些工具
- 执行过程中持续观察结果
- 必要时继续调用下一步工具
- 最后交付单张图或一整套图

重点不是做“海报专用逻辑”，而是做一层通用视觉任务执行代理。

## 2. 核心原则

1. 禁止静默兜底
- 视觉任务理解、任务拆解、策略选择、页数规划、工具调用顺序，必须由编排模型或 agent 决策。
- 不允许在模型失败时静默退回规则链替代“智能决策”。
- 规则只允许用于输入清洗、结构校验、字段补全、开发期诊断。

2. 工具优先，不靠超长 prompt 硬撑
- 复杂任务不要继续往单次 prompt 里塞更多隐藏约束。
- 要让 agent 显式调用工具分步完成任务。

3. 单图和套图是两类任务
- “给我出 4 张变体”不等于“给我规划一套 4P 详情页”。
- 套图任务必须先拆页，再逐页执行。

4. 一致性要成为显式资产
- 主体身份
- 品牌
- 配色方向
- 光线方向
- 材质语言
- 构图语法
- 文案密度

以上都不应只是隐含在第一张图里，而要被抽成可复用的共享上下文。

5. agent 必须能看见中间状态
- 当前在做什么
- 为什么这样做
- 下一步准备调用什么工具
- 已经产出了哪些中间结果

### 2.1 执行前对齐规则（强制）

从这一版开始，后续所有实现都不允许再“凭记忆理解方案后直接开做”，必须先回看这份方案原文，再判断当前步骤有没有跑偏。

每次开始新的实现前，至少先完成下面 5 个核对项：

1. 当前要做的内容，属于本方案的哪一个阶段
- 必须明确是阶段 A、B、C、D，还是 Runtime / Browser Native Agent 扩展段。

2. 当前代码已经做到哪一步
- 不是看主观感觉，而是对照本方案的目标能力、主循环、工具边界、UI 语义逐项判断。

3. 本次改动是否仍在该阶段边界内
- 如果本次只是做 Runtime 壳子，就不能顺手把产品做成“planner 展示器”。
- 如果本次只是做 UI 承接，就不能偷偷把决策层挪回规则链里。

4. 本次实现是否出现概念跑偏
- 是否把“通用 agent”做偏成“专门写计划的 agent”
- 是否把“内部规划能力”错误外显成产品主身份
- 是否把“工具调用循环”偷换成“一次 planner + 直接执行”
- 是否又引入了隐藏规则兜底、静默降级、补丁套补丁

5. 当前改动是否会破坏长期目标
- 是否增加了新的跨层耦合
- 是否让设置、工具、宿主 API、节点 UI 再次混在一起
- 是否让后续 Browser Runtime / Visual Agent 更难接入

每次完成一个具体子步骤后，还要再做一次“跑偏复核”：
- 这一步落地产物，是否真的让系统更接近 `Codex / OpenClaw` 风格的通用执行 agent
- 还是只是让现有链路看起来更复杂、但本质仍是一次性 planner
- 如果发现方向偏了，优先停下来回到方案修正，不继续顺着错误方向堆实现

后续默认执行口径：
- 开发前先引用本方案对应阶段
- 开发中持续说明“本次改动在方案中的位置”
- 开发后明确说明“本次是否仍然对齐总方案”

这条规则本身也属于本方案的一部分，后续推进时必须执行，不作为可选建议。

## 3. 现状判断

当前已有能力：
- `useWorkspaceElementImageGeneration.ts` 已经承担节点级任务发起、状态更新、批量变体执行。
- `vision-orchestrator` 已经具备单次计划对象 `VisualGenerationPlan / PlannedImageGeneration`。
- `image-gen.skill.ts` 和 `gemini.ts` 已经是稳定的底层执行工具。
- 电商工作流已经有“先规划多项，再批量执行”的经验。

当前缺失能力：
- 没有“任务拆解器”
- 没有“套图计划对象”
- 没有“工具调用循环”
- 没有“中间资产管理”
- 没有“结果驱动的下一步决策”

所以现在的关键词节点更接近：
- `planner -> composedPrompt -> generate`

而不是：
- `agent -> decide -> call tool -> observe -> call next tool -> deliver`

## 4. 目标能力边界

第一阶段要支持三类输出：

1. 单图任务
- 海报
- 产品替换
- 场景图
- 背景替换
- 风格迁移

2. 套图任务
- 电商详情页多 P
- 社媒内容组图
- 多场景卖点图
- 一套统一风格海报

3. 迭代任务
- 基于某张已生成结果继续扩图
- 保持品牌和主体一致，继续追加新页面
- 对套图中的单页进行定向重做

第一阶段不做：
- 自动人眼审美评分
- 自动文案生成与排版闭环
- 完整跨会话长期任务编排

## 5. 新的任务模型

建议在现有 `VisualGenerationPlan` 之上新增“套图级计划”。

### 5.1 任务级计划

```ts
export type VisualExecutionMode =
  | "single"
  | "set"
  | "iterative";

export type VisualTaskPlan = {
  mode: VisualExecutionMode;
  userGoal: string;
  intent: string;
  reasoningSummary: string;
  toolChain: string[];
  sharedStyleGuide?: SharedStyleGuide;
  pages?: VisualPagePlan[];
  single?: VisualGenerationPlan;
};
```

### 5.2 共享风格资产

```ts
export type SharedStyleGuide = {
  subjectIdentity: string[];
  brandLocks: string[];
  visualTone: string[];
  compositionGrammar: string[];
  materialLanguage: string[];
  forbiddenDrift: string[];
  preferredAspectRatios?: string[];
  continuityAnchorPolicy?: "none" | "first_approved" | "latest_approved";
};
```

### 5.3 套图页计划

```ts
export type VisualPagePlan = {
  id: string;
  title: string;
  goal: string;
  pageRole:
    | "cover"
    | "selling_point"
    | "detail"
    | "comparison"
    | "usage_scene"
    | "size_spec"
    | "story"
    | "custom";
  aspectRatio: string;
  mustShow: string[];
  optionalShow?: string[];
  forbiddenEdits: string[];
  dependsOn?: string[];
  executionPrompt?: string;
};
```

这个结构的价值是：
- `single` 模式继续兼容当前单图 planner
- `set` 模式支持多 P 套图
- `iterative` 模式支持对既有结果继续扩写

## 6. 工具化思路

agent 不应该直接“自己全做”，而应该调用一组明确工具。

建议第一批工具如下。

### 6.1 `task-classifier`
- 判断当前任务属于单图、套图还是迭代任务
- 判断任务意图：海报、详情页、卖点图、品牌图、场景图等

### 6.2 `reference-analyzer`
- 分析参考图角色
- 分析哪张是产品、哪张是构图、哪张是品牌、哪张是细节
- 输出权重和冲突点

### 6.3 `set-planner`
- 专门用于拆“套图任务”
- 决定需要多少 P
- 决定每一 P 的职责
- 决定整套的共享视觉约束

### 6.4 `prompt-composer`
- 为单图或每一 P 生成最终执行 prompt
- 输出适配底层模型的参数

### 6.5 `image-generator`
- 复用现有 `image-gen.skill.ts`
- 只负责按参数调用 provider

### 6.6 `consistency-anchor-builder`
- 从用户参考图或首张成功结果里提取共享一致性锚点
- 给后续页面持续复用

### 6.7 `result-evaluator`
- 检查输出是否偏离任务目标
- 检查品牌漂移、主体漂移、构图跑偏、页职责错位

### 6.8 `retry-director`
- 决定是否重试
- 决定只重试某一页还是重跑整套
- 决定是否切换锚点或补充约束

## 7. Agent 决策循环

建议把 agent 行为固定成下面这条循环：

1. `Understand`
- 读取用户 prompt、参考图、节点参数、历史结果

2. `Classify`
- 判断任务模式：`single / set / iterative`

3. `Plan`
- 单图走 `planner`
- 套图走 `set-planner`

4. `Prepare`
- 生成共享风格资产
- 生成每页执行 prompt

5. `Execute`
- 创建对应数量的子节点
- 逐页调用 `image-generator`

6. `Observe`
- 收集每页结果
- 写回每页状态和元信息

7. `Evaluate`
- 调用 `result-evaluator`

8. `Decide Next`
- 成功则结束
- 单页失败则重试单页
- 套图风格不统一则更新共享锚点后重跑部分页面

这条循环是本方案的核心。后续所有代码都围绕这条循环搭建。

## 8. 关键词节点如何触发 agent

关键词节点点击生图后，不再默认等同于“立即单图生成”。

而是：

1. 读取当前节点上下文
- prompt
- 参考图
- 当前模型
- 比例
- 质量
- 是否有上游结果

2. 先进入 `agent.start`

3. agent 返回三种模式之一：
- `single`
- `set`
- `iterative`

4. 根据模式决定节点行为

### 8.1 `single`
- 保持当前行为
- 创建 1 个或多个结果子节点

### 8.2 `set`
- 一次性创建多个“待生成子节点”
- 每个子节点对应一页，不再只是 `Variation 1/4`
- UI 显示 `1P 主视觉封面`、`2P 卖点页`、`3P 细节页`

### 8.3 `iterative`
- 允许基于某一已成功结果继续扩展
- 例如“再做两张同风格卖点页”

## 9. UI 行为建议

第一阶段不大改节点主体，但要补足 agent 感。

### 9.1 节点状态文案

从现在的：
- 生图中

升级为：
- 正在识别任务类型
- 正在规划整套页面
- 正在生成共享风格约束
- 正在生成 1P 主视觉封面
- 正在评估 2P 卖点页一致性

### 9.2 套图子节点标题

不要只显示：
- `1/4`
- `2/4`

而要显示：
- `1P 封面`
- `2P 卖点`
- `3P 细节`
- `4P 尺寸`

### 9.3 右侧查看区

给用户一个简洁入口查看：
- 编排后的总目标
- 套图页计划
- 每页改写后的 prompt

不要把这堆信息重新塞回节点主体里，避免继续拥挤。

## 10. 与现有代码的接入点

### 10.1 `useWorkspaceElementImageGeneration.ts`

这是主入口，后续升级为：
- 当前：节点级单任务执行器
- 目标：调用 `visual orchestrator agent` 的前端宿主

新增职责：
- 发起 agent run
- 创建套图子节点
- 维护多页状态
- 承接 agent 的工具调用结果

### 10.2 `services/vision-orchestrator/*`

从当前的 planner 集合升级成：
- planner 子模块
- set planner 子模块
- tool registry
- evaluator
- retry director
- orchestrator agent 主循环

### 10.3 `services/gemini.ts`

继续负责：
- provider 路由
- 底层 prompt 拼装的最后一层落地
- 图片 API 调用

不要把高层任务编排重新堆回这里。

### 10.4 `image-gen.skill.ts`

继续保持工具属性：
- 输入明确参数
- 返回生成结果
- 不夹带任务决策逻辑

## 11. 最小落地路线

### 阶段 A：Agent 壳子

目标：
- 先让链路从“直接 planner”切换成“agent 驱动 planner”

任务：
- 新增 `orchestrator-agent.ts`
- 新增 `runVisualOrchestratorAgent()`
- 先只支持 `single`

验收：
- 行为结果与现状接近
- 但日志和状态已经是 agent 语义

### 阶段 B：套图规划

目标：
- 支持 `set` 模式

任务：
- 新增 `set-planner.ts`
- 新增 `VisualTaskPlan / VisualPagePlan`
- 关键词节点支持一次性创建多 P 子节点

验收：
- 用户输入“做一套详情页”时，节点能自动拆页

### 阶段 C：共享风格资产

目标：
- 让整套图不只是“多张不同图”，而是“同一视觉系统”

任务：
- 新增 `consistency-anchor-builder`
- 把首张成功结果或指定参考图转成共享锚点

验收：
- 套图的一致性明显提升

### 阶段 D：评估与局部重做

目标：
- 失败时不再只会盲重试

任务：
- 新增 `result-evaluator`
- 新增 `retry-director`

验收：
- 能只重做某一页
- 能提示哪一页偏了、为什么偏

## 12. 第一批建议支持的高价值任务

1. 电商详情页多 P
- 最适合体现 agent 价值

2. 一套品牌海报
- 适合验证风格统一和主体锁定

3. 同产品多场景卖点图
- 适合验证共享锚点和逐页职责

4. 基于已成功图继续扩图
- 适合验证迭代模式

## 13. 不该做的事情

1. 不要继续把更多隐藏 prompt 规则堆进 `gemini.ts`
2. 不要用“多张 variation”冒充“套图编排”
3. 不要在模型失败时偷偷退回硬编码决策
4. 不要把完整思考过程塞回节点主体 UI
5. 不要让 `image-gen.skill.ts` 承担高层任务理解

## 14. 一句话结论

关键词节点下一步最值得做的，不是“继续优化单图 prompt 改写”，而是升级成一层会调用工具的通用视觉 Orchestrator Agent。

它的核心价值不是“更聪明一点”，而是：
- 会拆任务
- 会调工具
- 会批量执行
- 会看结果继续推进

这样它才真正接近“像 Codex 一样在做事”，而不是“只是在帮你把 prompt 写长”。

## 15. 升级为更像 Codex 的 Runtime

上面的方案已经定义了正确方向，但如果要更像 Codex，还需要把它从“静态编排方案”升级成“持续运行的 agent runtime”。

差别在于：
- 静态编排：先出一份计划，再按计划执行
- Codex 式 runtime：每做完一步，就根据结果决定下一步

所以第二版架构的重点不是再增加 prompt 规则，而是补齐运行时机制。

## 16. Runtime 目标

这一层 runtime 必须具备四个能力：

1. 有持续运行的主循环
- 不是一次 planner 调完就结束
- 而是每一步都能产出 `next_action`

2. 有工作记忆
- 知道已经做过什么
- 知道哪些结果成功
- 知道哪些尝试失败
- 知道当前最值得复用的锚点是什么

3. 有动态重规划
- 初始计划不是最终真理
- 如果中途发现某页失败、首图风格不稳、某张参考图更适合做锚点，后续步骤要能改

4. 有结果驱动决策
- 下一步做什么，不是写死
- 而是看上一步工具返回了什么，再决定

## 17. Agent Runtime 主循环

建议把 runtime 固定成下面这个循环：

```ts
while (!session.done) {
  const nextAction = decideNextAction(session);
  const result = await runAction(nextAction, session);
  session = applyActionResult(session, nextAction, result);
}
```

这和现在“planner 一次返回所有东西”的核心区别是：
- planner 是一次性产物
- runtime 是持续更新的过程

### 17.1 推荐循环阶段

1. `bootstrap`
- 建立会话
- 收集用户输入、参考图、节点参数、已有结果

2. `understand`
- 提炼任务目标
- 判定当前属于单图、套图还是迭代任务

3. `plan`
- 生成初始任务计划

4. `act`
- 选择一个最值得立即执行的动作

5. `observe`
- 接收工具结果

6. `reflect`
- 判断当前结果是否推进了目标

7. `replan`
- 如果需要，修改任务计划

8. `finish`
- 当交付条件满足时结束

## 18. 工作记忆模型

如果没有工作记忆，它就永远只会像“增强版函数调用器”，不像 Codex。

建议新增 `VisualAgentSession`：

```ts
export type VisualAgentSession = {
  sessionId: string;
  sourceElementId: string;
  mode: "single" | "set" | "iterative";
  goal: string;
  status: "running" | "waiting" | "failed" | "completed";
  currentStepLabel: string;
  planVersion: number;
  taskPlan: VisualTaskPlan | null;
  sharedStyleGuide?: SharedStyleGuide;
  approvedAnchor?: SessionAnchor;
  pages: SessionPageState[];
  actionHistory: SessionActionRecord[];
  observations: SessionObservation[];
  openIssues: string[];
  finalSummary?: string;
};
```

### 18.1 页面级记忆

```ts
export type SessionPageState = {
  pageId: string;
  title: string;
  status: "pending" | "running" | "approved" | "failed";
  attempts: number;
  latestPrompt?: string;
  latestResultUrl?: string;
  bestResultUrl?: string;
  evaluatorNotes: string[];
  dependsOn?: string[];
};
```

### 18.2 锚点记忆

```ts
export type SessionAnchor = {
  source: "reference" | "generated";
  pageId?: string;
  assetUrl: string;
  reason: string;
  lockedTraits: string[];
};
```

这个设计的关键是：
- 首张图成功后，它可以变成全套锚点
- 某页失败后，不会只知道“失败了”，而是知道“为什么失败、失败过几次、当前最好结果是谁”

## 19. 动作模型

要像 Codex，不能只定义工具，还要定义“agent 当前能做哪些动作”。

建议把动作拆成两层：

### 19.1 高层动作

```ts
export type VisualAgentAction =
  | { type: "classify_task" }
  | { type: "plan_single" }
  | { type: "plan_set" }
  | { type: "build_anchor"; candidatePageId?: string }
  | { type: "compose_page_prompt"; pageId: string }
  | { type: "generate_page"; pageId: string }
  | { type: "evaluate_page"; pageId: string }
  | { type: "approve_page"; pageId: string }
  | { type: "retry_page"; pageId: string; reason: string }
  | { type: "replan_set"; reason: string }
  | { type: "finish_session" };
```

### 19.2 工具动作映射

- `classify_task` -> `task-classifier`
- `plan_single` -> `planner`
- `plan_set` -> `set-planner`
- `build_anchor` -> `consistency-anchor-builder`
- `compose_page_prompt` -> `prompt-composer`
- `generate_page` -> `image-generator`
- `evaluate_page` -> `result-evaluator`
- `retry_page` -> `retry-director`

这样做的价值是：
- agent 思考的是“下一步动作”
- 工具只负责“执行动作”

这比让模型直接吐一堆底层参数更像 Codex。

## 20. 工具结果模型

Codex 式 runtime 的关键不是工具本身，而是工具返回结果必须足够结构化，方便下一步决策。

建议统一结果结构：

```ts
export type ToolExecutionResult<TPayload = unknown> = {
  ok: boolean;
  tool: string;
  summary: string;
  payload?: TPayload;
  issues?: string[];
  suggestions?: string[];
  retryable?: boolean;
};
```

### 20.1 示例：评估结果

```ts
export type PageEvaluationPayload = {
  pageId: string;
  verdict: "pass" | "soft_fail" | "hard_fail";
  driftTypes: Array<
    "brand_drift" |
    "subject_drift" |
    "layout_drift" |
    "role_mismatch" |
    "quality_issue"
  >;
  notes: string[];
  recommendReuseAsAnchor: boolean;
};
```

这会直接影响下一步动作：
- `pass` -> `approve_page`
- `soft_fail` -> `retry_page`
- `recommendReuseAsAnchor = true` -> `build_anchor`
- 多页连续 `layout_drift` -> `replan_set`

## 21. 动态重规划规则

这部分是它像不像 Codex 的关键。

如果只是：
- 先规划 4P
- 然后机械执行 4P

那它还是普通 workflow，不像 agent。

必须允许这些情况：

1. 首图比原参考图更适合作为整套锚点
- 后续页面改为跟随首图而不是继续硬跟原始参考图

2. 原计划页数不够
- 用户说“做详情页”
- agent 发现当前商品复杂度更适合 5P 而不是 3P
- 允许扩页

3. 某一页职责判断错误
- 原本定义为“细节页”
- 结果发现更应该拆成“材质页 + 结构页”
- 允许重写后续页面定义

4. 某页多次失败
- 连续 2 到 3 次失败后
- 不是无脑再试
- 而是触发 `replan_set`

### 21.1 重规划触发条件

建议第一版只支持这些明确触发器：
- 某页 `hard_fail`
- 某页连续两次 `soft_fail`
- 首张通过页被 evaluator 标记为 `recommendReuseAsAnchor`
- 套图里超过一半页面出现同类漂移

## 22. 更像 Codex 的“最小必要行动”

Codex 一个很重要的特征是：
- 不会一开始把所有事情都做满
- 会先做最关键、最阻塞的下一步

所以视觉 agent 也应该遵守：

1. 单图任务
- 先规划
- 直接出图
- 评估
- 需要才重试

2. 套图任务
- 先规划整套
- 优先只生成最关键的封面页或锚点页
- 等锚点稳定后，再生成剩余页

这点非常重要。

如果一开始就并发生成整套 6P，虽然快，但会丢掉 Codex 式“先拿关键中间结果再推进”的能力。

### 22.1 推荐执行策略

- `single`：串行
- `set`：先 `cover`，后 `parallel or staged`
- `iterative`：只生成新增页，不重跑已批准页

## 23. UI 如何体现 Runtime 感

为了更像 Codex，UI 不该只是“显示在转圈”，而要能体现当前动作。

建议状态栏显示：
- 当前动作
- 当前对象
- 下一步预期

例如：
- 正在识别任务类型
- 正在规划 4P 详情页
- 正在生成 1P 主视觉封面
- 正在评估 1P 是否可作为整套锚点
- 已确认 1P 为共享风格锚点，准备生成其余页面

这会比现在“生图中”更像真正 agent 在工作。

## 24. 实现顺序再细化

如果要按“更像 Codex”的目标推进，推荐顺序如下。

### 阶段 1：Runtime 壳子
- 新增 `VisualAgentSession`
- 新增 `VisualAgentAction`
- 新增 `runVisualAgentLoop()`
- 先只接单图任务

### 阶段 2：结果驱动单图闭环
- 单图任务支持 `generate -> evaluate -> retry/finish`
- 不再只是 planner 后直接结束

### 阶段 3：套图 session
- 支持 `VisualTaskPlan.pages`
- 支持页面状态管理
- 支持 1P、2P、3P 这种明确页职责

### 阶段 4：锚点驱动套图
- 首先生成封面
- 通过后提炼共享锚点
- 再继续其余页面

### 阶段 5：动态重规划
- evaluator 能触发 `replan_set`
- retry director 不再只是修 prompt，而是能重排计划

## 25. 这一版和上一版的关系

可以把两版理解成：

- 上一版：
  定义“要做什么模块”

- 这一版：
  定义“这些模块如何像 agent 一样活起来”

上一版已经是正确骨架。
这一版补的是：
- 主循环
- 记忆
- 动作
- 工具结果结构
- 动态重规划

也就是说：
- 上一版像“器官列表”
- 这一版像“循环系统和神经系统”

## 26. 最终判断标准

如果未来实现出来后，满足下面几点，就可以说它开始像 Codex 了：

1. 不是一次 planner 后死执行
2. 每一步都有明确 `next_action`
3. 有持续更新的 session memory
4. 会基于结果改后续计划
5. 会优先做最关键的中间步骤
6. 能告诉用户当前为什么在做这一步

如果做不到这些，它仍然只是“更复杂的工作流”，还不是“Codex 式 agent runtime”。

## 27. 真正接近 Codex / OpenClaw 还缺什么

如果目标不是“更强的视觉 agent”，而是“像真正 Codex 和 OpenClaw 一样会看网页、懂工具、调工具、造工具、编流程”，那还必须再补一层浏览器原生 agent runtime。

也就是说，后续系统不能只理解：
- prompt
- 参考图
- 图片生成工具

还要理解：
- 当前网页里有哪些可操作工具
- 哪些是页面内工具，哪些是系统级工具
- 当前浏览器 console 正在报什么
- 页面上哪个面板、哪个按钮、哪个输入框对应什么能力
- 当现有工具不够用时，如何生成一个新的工具或工作流

## 28. 浏览器原生能力目标

这一层建议单独定义为：
- `Browser Native Agent Runtime`

它不是取代视觉 Orchestrator Agent，而是给它提供“像 Codex 一样的手脚和眼睛”。

目标能力包括：

1. 看懂网页里可用的工具
2. 调用网页里的工具
3. 看到网页 console 和调试信息
4. 看到运行时状态和失败原因
5. 在现有工具不够时，自己生成新工具
6. 把多个工具编排成可复用流程

## 29. 网页工具发现机制

这是最关键的一层。

真正像 Codex / OpenClaw，不是因为模型更玄学，而是因为它知道自己“当前环境里能做什么”。

所以建议新增页面工具注册协议。

### 29.1 Tool Registry

建议新增：

```ts
export type BrowserToolDefinition = {
  id: string;
  title: string;
 description: string;
  category: "canvas" | "image" | "workflow" | "debug" | "system" | "custom";
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  visibility: "user" | "agent" | "both";
  dangerous?: boolean;
  needsSelection?: boolean;
  needsConfirmation?: boolean;
};
```

并提供统一注册入口：

```ts
registerBrowserTool(definition, executor)
```

这样 agent 就可以在运行时先问：
- 当前有哪些工具
- 每个工具需要什么输入
- 哪些工具只能在选中节点时运行
- 哪些工具需要确认

### 29.2 页面工具发现来源

第一版建议从三类地方采集：

1. 手工注册工具
- 最稳定
- 最适合核心能力

2. 从现有 skill 映射工具
- `image-gen.skill.ts`
- `touch-edit.skill.ts`
- `smart-edit.skill.ts`

3. 从页面组件暴露工具描述
- 某些 Workspace 面板、侧栏、工作流抽屉可以直接声明自己的 agent tools

## 30. Console 与调试观测能力

你提的“要能看到网页调试界面的 console 信息”非常关键，这其实就是 agent 的观察器。

建议新增 `console bridge`。

### 30.1 Console Capture

在浏览器侧拦截：
- `console.log`
- `console.info`
- `console.warn`
- `console.error`

统一写入：

```ts
export type BrowserConsoleEvent = {
  id: string;
  level: "log" | "info" | "warn" | "error";
  timestamp: number;
  source?: string;
  message: string;
  payload?: unknown[];
};
```

然后提供给 agent 两种能力：

1. `read_recent_console`
- 读最近 N 条日志

2. `watch_console_stream`
- 在任务运行期间订阅新增日志

### 30.2 Console 过滤能力

必须支持按上下文过滤：
- 只看 `[workspace.imggen]`
- 只看 `[visualOrchestratorPlan]`
- 只看 `useWorkspaceElementImageGeneration`
- 只看 `error / warn`

这样 agent 才能真正理解：
- 为什么这次失败
- 是 planner 失败了还是 provider 失败了
- 是 429、超时、JSON 不完整，还是页面状态没更新

### 30.3 Debug Panel Snapshot

如果页面里有调试面板或状态面板，建议再暴露工具：
- `get_debug_panel_snapshot`
- `get_workspace_runtime_snapshot`

这比让 agent 只看字符串日志更稳定。

## 31. 页面可见对象模型

如果只给 console，还不够像 Codex。

还要让它看懂当前网页有哪些“可操作对象”。

建议新增简化版页面语义树：

```ts
export type BrowserCapabilityNode = {
  id: string;
  kind: "button" | "input" | "panel" | "node" | "toolbar" | "dialog" | "list";
  title: string;
  role?: string;
  visible: boolean;
  enabled: boolean;
  selected?: boolean;
  actions?: string[];
  children?: BrowserCapabilityNode[];
};
```

这不是完整 DOM 抓取，而是“给 agent 用的页面能力树”。

例如在 Workspace 里，它能看到：
- 当前选中的关键词节点
- 上方工具栏
- 风格库
- 狂暴按钮
- 右侧查看区
- 当前生图子节点
- 当前工作流抽屉

这样 agent 才真正像在“看懂网页工具”，而不是盲调接口。

## 32. 浏览器动作工具

为了像 OpenClaw，还要有基础浏览器动作层。

建议第一版提供这些通用动作：

- `click_ui_target`
- `set_input_value`
- `open_panel`
- `close_panel`
- `select_canvas_node`
- `read_selected_node_state`
- `invoke_browser_tool`
- `read_recent_console`
- `read_runtime_snapshot`

其中最重要的是：
- 优先调用结构化工具
- 尽量不要让 agent 直接做低级 DOM 爬行动作

也就是说，能结构化就结构化，只有结构化工具没有覆盖时，才允许更底层的 UI 操作。

## 33. 自制工具能力

这是你说的“能自己制作工具”的核心。

真正像 Codex，不只是会调工具，还会在工具不够时补工具。

建议把“自制工具”分成两层：

### 33.1 轻量工具生成

由 agent 生成：
- 工具定义
- 输入 schema
- 输出 schema
- 执行描述

例如：
- `extract_selected_prompt_metadata`
- `collect_generating_nodes_status`
- `summarize_imggen_failures`

这类工具可以先做成：
- 浏览器内组合工具
- 基于已有工具拼装出的 meta tool

### 33.2 代码级工具生成

当浏览器内组合工具不够时，再进入真正代码生成：
- 在 `services/browser-tools/*` 或 `services/vision-orchestrator/tools/*` 新增工具文件
- 自动补 `registerBrowserTool`
- 自动生成基础测试和调试日志

但这一层必须加权限与审核边界，不能默认自动落盘执行。

## 34. 流程与工作流生成能力

你说的“流程之类的”，建议不要只理解成固定 workflow，而是：
- agent 可以生成一个临时流程
- 也可以沉淀成可复用 workflow

建议新增：

```ts
export type BrowserWorkflowDefinition = {
  id: string;
  title: string;
  description: string;
  trigger: "manual" | "node_generate" | "node_selected" | "error_detected";
  steps: Array<{
    id: string;
    action: string;
    params?: Record<string, unknown>;
    onSuccess?: string;
    onFailure?: string;
  }>;
};
```

### 34.1 两类流程

1. 临时流程
- 当前任务现场生成
- 任务结束后可丢弃

2. 沉淀流程
- 用户确认后保存
- 以后直接复用

比如：
- “详情页多 P 生成流程”
- “图片失败诊断流程”
- “模型 route 调试流程”

## 35. 安全与权限边界

这层能力很强，必须明确边界。

### 35.1 权限分级

建议把工具权限分成：

1. `read`
- 读节点状态
- 读 console
- 读运行时快照

2. `write`
- 改节点参数
- 触发工具
- 创建子节点

3. `execute`
- 运行工作流
- 触发批量生成

4. `author`
- 生成新工具
- 注册新流程
- 写入工具配置

### 35.2 自制工具默认策略

默认不允许 agent 静默写代码并立即启用。

正确策略是：
- 先产出工具草案
- 让系统校验 schema
- 必要时给用户确认
- 再注册使用

这样才不会把“像 Codex”做成“高风险自修改器”。

## 36. 与现有工程的接入建议

基于当前仓库，建议新增以下模块：

```text
services/browser-agent/
  tool-registry.ts
  console-bridge.ts
  capability-tree.ts
  action-runner.ts
  workflow-registry.ts
  tool-authoring.ts
  runtime.ts
```

### 36.1 建议职责

- `tool-registry.ts`
  统一注册浏览器可调用工具

- `console-bridge.ts`
  收集 console 流

- `capability-tree.ts`
  输出给 agent 用的页面能力树

- `action-runner.ts`
  执行浏览器动作和结构化工具调用

- `workflow-registry.ts`
  保存与运行流程

- `tool-authoring.ts`
  生成、校验、注册新工具

- `runtime.ts`
  浏览器原生 agent 主循环

## 36.2 画板容器化原则

你提出的方向是对的，而且我认为这是后续不把整个网页搞崩的关键前提。

建议把 Workspace 里的“画板”定义成一个受控容器：
- 画板是 agent 的主工作容器
- 工具 UI 尽量挂载在画板内部
- 新增工具优先作为画板内部能力扩展
- 不允许新工具直接随意污染整个页面的全局状态

但要说实话：
- “把工具放进画板里”这个思路是对的
- 但“只要在画板里就安全”这件事是不对的

因为如果它们仍然在同一个 React 树、同一个全局 store、同一个事件系统里乱写状态，照样可以把整个页面搞坏。

所以真正正确的说法应该是：
- 画板是受控宿主容器
- 工具是容器内插件
- 插件必须通过宿主 API 工作
- 不能直接越权改整个页面

## 36.3 Canvas Tool Host 架构

建议新增一层：

```text
Workspace
  -> Canvas Host
      -> Tool Slots
      -> Tool Runtime
      -> Host Action API
      -> Error Isolation
```

### Canvas Host 的职责

1. 提供统一挂载位
- 顶部工具槽
- 右侧面板槽
- 节点内浮层槽
- 调试信息槽

2. 提供统一动作 API
- 选中节点
- 读取节点状态
- 更新节点参数
- 创建子节点
- 触发生图
- 读取 console
- 打开工作流面板

3. 提供统一权限控制
- 工具不能直接拿全局 store 裸写
- 只能通过 Host Action API 提交变更

4. 提供统一稳定性保护
- 单工具崩溃时不拖垮整个 Workspace

## 36.4 工具应该“在画板里显示”，但“不一定在画板里执行业务逻辑”

这点很重要。

更稳妥的分层应该是：

1. 工具 UI
- 尽量在画板容器里显示
- 这样交互语义统一，也更像你想要的“都在画板里”

2. 工具逻辑
- 尽量走宿主服务层
- 不要让每个工具自己随便碰全局状态、网络层、持久化层

也就是说：
- 显示层在画板里
- 执行层在受控 runtime 里

这比“工具 UI 和工具逻辑全都直接塞进画板组件树里”安全很多。

## 36.5 新增工具的防崩原则

为了尽可能不把整页搞坏，建议新增工具必须满足这些限制：

1. Error Boundary
- 每个工具实例必须有独立错误边界
- 某个工具渲染报错时，只卸载该工具，不影响画板主体

2. Host API Only
- 工具不得直接改全局 store
- 工具只能调用受控 action

3. Local State First
- 工具自己的临时状态尽量保留在工具局部
- 不要一上来就把中间态写到全局

4. Draft Before Commit
- 工具先产出草稿结果
- 宿主校验后再提交到正式状态

5. Feature Flag
- 新工具先以实验模式挂载
- 出问题可以快速禁用

6. Health Check
- 工具注册后要有最基础的 schema 校验和启动检查

7. Fail Closed
- 工具初始化失败时默认禁用
- 不允许“半初始化成功”还继续污染页面

## 36.6 自制工具不要直接改主页面

你担心“新增工具的过程中把整个网页搞崩溃搞坏”，这个担心非常对。

所以自制工具必须走分阶段发布：

1. `draft`
- 只生成工具定义
- 不挂载

2. `validate`
- 校验 schema
- 校验依赖
- 校验权限

3. `sandbox`
- 挂到隔离插槽里试运行
- 只给最小权限

4. `enable`
- 通过后再正式注册

绝对不要：
- agent 直接写一个工具
- 立刻全局启用
- 然后让它接触整个 Workspace

## 36.7 建议的工具隔离等级

可以按风险分三层：

1. 低风险工具
- 只读状态
- 读 console
- 读节点信息

2. 中风险工具
- 改节点参数
- 创建子节点
- 触发工作流

3. 高风险工具
- 写工具定义
- 注册新流程
- 修改宿主配置

高风险工具默认不能自动启用。

## 36.8 最诚实的判断

你的思路总体是对的，但需要改成更严格的版本：

对的部分：
- 工具尽量收敛在画板容器里
- 把画板当成 agent 工作空间
- 新增工具优先在这个空间内生长

不够的部分：
- 不能只靠“放进画板里”来防崩
- 必须补：
  - 宿主 API
  - 错误边界
  - 权限分级
  - 草稿发布
  - 工具隔离

所以我给你的实话结论是：

- 方向对
- 但要从“画板里堆工具”
- 升级成“画板宿主 + 工具插件 + 受控执行”

如果只是前者，后面一定越来越乱。
如果按后者做，这条路是很稳的。

## 36.9 全局设置必须升级成规范配置接口

这个判断我也认同，而且我觉得是必须做，不是可选优化。

现在“全局设置”如果只是：
- 设置页 UI
- 若干 `localStorage` key
- 各模块自己去读

那后面一定会出现这些问题：
- agent 读到的配置和 UI 显示的不一致
- 工具 A、工具 B 对同一个设置字段理解不一致
- 工作流把旧值缓存住，设置页改了却没生效
- 新增工具又开始自己发明新的设置读取方式

所以从现在开始，全局设置不能再只被视为“设置页面的数据源”，而要被视为：
- `规范化运行时配置接口`

也就是：
- UI 只是这个接口的一个编辑器
- agent、tools、workflow、runtime 都读取同一份规范化配置

## 36.10 配置分层原则

建议把设置分成四层：

1. `raw storage`
- localStorage
- 持久化后端
- 临时草稿

2. `normalized settings`
- 做 schema 校验
- 做默认值填充
- 做别名兼容
- 做版本迁移

3. `runtime settings snapshot`
- 当前会话实际运行所用配置
- 给 agent / tools / workflow 读取

4. `settings editor state`
- 只是设置页的编辑态
- 不能直接等同于运行态

这层次一旦明确，后面就不会再出现“谁都能随便读写设置”的混乱局面。

## 36.11 推荐设置接口模型

建议新增一个统一接口：

```ts
export type RuntimeSettingsSnapshot = {
  version: string;
  models: {
    script: {
      selected: string[];
    };
    image: {
      selected: string[];
      postPaths: Record<string, {
        withReferences: string;
        withoutReferences: string;
      }>;
    };
    video: {
      selected: string[];
    };
  };
  visualOrchestrator: {
    model: string;
    maxReferenceImages: number;
    maxInlineImageBytesMb: number;
    continuityEnabled: boolean;
  };
  workspace: {
    autoSave: boolean;
    concurrentCount: number;
    systemModeration: boolean;
  };
  agent: {
    browserRuntimeEnabled: boolean;
    toolAuthoringEnabled: boolean;
    allowConsoleRead: boolean;
    allowWorkflowAuthoring: boolean;
  };
};
```

这个结构的重点不是字段本身，而是：
- 它是给“运行时”读的
- 不是给某个页面组件私有读的

## 36.12 建议新增统一 Settings Service

建议从现有 `provider-settings.ts` 往上再包一层，新增类似：

```text
services/runtime-settings/
  schema.ts
  defaults.ts
  storage.ts
  normalize.ts
  snapshot.ts
  access.ts
```

### 建议职责

- `schema.ts`
  定义设置结构与字段约束

- `defaults.ts`
  定义默认值

- `storage.ts`
  负责原始持久化读写

- `normalize.ts`
  负责迁移、兼容、校验、补默认值

- `snapshot.ts`
  生成可供运行时读取的只读快照

- `access.ts`
  提供统一读取接口

## 36.13 Agent / Tool 不应直接读 localStorage

这一条建议写成硬规范：

1. agent 不允许直接读 `window.localStorage`
2. tool 不允许直接拼 `setting_xxx`
3. workflow 不允许绕过 settings service 读原始 key

正确做法只能是：
- `getRuntimeSettingsSnapshot()`
- `getAgentSettings()`
- `getVisualOrchestratorSettings()`
- `getWorkspaceExecutionSettings()`

这样后面哪怕存储实现变了，agent 和工具层都不用跟着重写。

## 36.14 配置读取要支持“作用域”

仅有全局设置还不够，后面一定会出现不同层级的覆盖需求。

建议一开始就支持四级作用域：

1. `global`
- 全站默认设置

2. `workspace`
- 当前项目/画板级设置

3. `session`
- 当前 agent 会话临时覆盖

4. `tool run`
- 单次工具执行时的临时参数

优先级建议：
- `tool run > session > workspace > global`

例如：
- 全局默认 `visualOrchestrator.model = auto`
- 当前画板改成 `gemini-3.1-pro-preview`
- 当前 agent 会话临时锁成 `gpt-4.1`
- 某次工具执行再用 `tool run` 明确覆盖

这套优先级如果不先定，后面 agent 一旦复杂起来，配置一定打架。

## 36.15 建议给 agent 提供“只读配置视图”

为了稳定，agent 最好不要拿到可随便改的 settings 对象。

建议默认给 agent 的是：
- 只读快照
- 带版本号
- 带来源说明

例如：

```ts
export type RuntimeSettingsView<T> = {
  value: T;
  version: string;
  source: "global" | "workspace" | "session" | "merged";
  updatedAt: number;
};
```

这样 agent 可以知道：
- 自己当前看到的是哪一版配置
- 这个值来自全局还是会话覆盖

## 36.16 哪些设置必须优先结构化

第一批我建议先结构化这些，不要全量一口气做：

1. 视觉编排模型相关
- `visualOrchestratorModel`
- `visualOrchestratorMaxReferenceImages`
- `visualOrchestratorMaxInlineImageBytesMb`

2. 图片模型路由相关
- `selectedImageModels`
- `imageModelPostPaths`

3. 运行时执行相关
- `concurrentCount`
- `autoSave`
- `systemModeration`

4. agent 权限相关
- `allowConsoleRead`
- `toolAuthoringEnabled`
- `allowWorkflowAuthoring`

因为这几类最直接影响未来 browser runtime 和 visual agent。

## 36.17 设置变更要有订阅能力

如果以后 agent 和工具是长时间运行的，就不能只支持“读一次设置”。

还要支持：
- 配置变更订阅
- 配置快照失效通知

建议提供：

```ts
subscribeRuntimeSettings(listener)
```

用途包括：
- 设置页改了编排模型，agent 新任务立即生效
- 工具运行期间发现配置版本变了，可以决定是否刷新上下文

## 36.18 最诚实的判断

这条需求非常对，而且属于“越早做越省事”的基础设施。

我的实话判断是：

- 如果不把全局设置做成规范接口
  后面 agent、tool、workflow 一多，配置一定失控

- 如果现在就把它升级成统一 settings service
  后面浏览器 runtime、视觉 agent、自制工具这三块都会顺很多

所以这件事不是锦上添花，而是：
- 未来整套 agent 体系能不能稳住的地基之一

## 36.19 工程约束与运行保障

到这里为止，方案的方向已经比较完整，但如果不把运行期约束写清楚，后面实现时还是很容易重新长成“改一处牵一片”的结构。

这一节专门补 5 类工程保障：
- 并发与取消
- 动作提交与回滚
- 持久化与恢复
- contract 测试
- console / debug 预算与脱敏

## 36.20 Session 并发与取消模型

这一层必须先定，否则 agent 一跑起来就会互踩。

### 基本原则

1. 一个源节点同一时刻只允许一个 `active session`
2. 同一源节点再次点击生图时，不能默认并行覆盖
3. 并发必须显式区分：
- `replace`
- `queue`
- `reject`
- `branch`

### 推荐第一版策略

- `single` 任务：
  同节点重复触发时默认 `replace`

- `set` 任务：
  同节点重复触发时默认 `reject` 或 `confirm replace`

- `iterative` 任务：
  如果基于已批准结果新增页面，可允许 `branch`

### 建议数据结构

```ts
export type SessionConcurrencyMode =
  | "replace"
  | "queue"
  | "reject"
  | "branch";

export type SessionLease = {
  sourceElementId: string;
  sessionId: string;
  acquiredAt: number;
  mode: SessionConcurrencyMode;
};
```

### 取消语义

必须区分：
- `cancel_requested`
- `cancelled`
- `interrupted`
- `superseded`

含义不同：
- `cancel_requested`：用户发起取消，但工具可能还没停
- `cancelled`：成功停止，未继续写状态
- `interrupted`：页面刷新或运行时崩溃中断
- `superseded`：被新 session 顶替

## 36.21 Host Action 提交、幂等与回滚

如果没有这一层，Host API 仍然会退化成“大家都能调的全局改状态函数”。

### 基本原则

1. agent / tool 不直接改最终状态
2. 所有写操作必须以 `action commit` 的形式提交给宿主
3. 宿主必须支持幂等 key
4. 复合动作必须能部分失败、整体回滚或显式补偿

### 建议动作结构

```ts
export type HostActionCommit = {
  id: string;
  sessionId: string;
  toolId?: string;
  type: string;
  idempotencyKey: string;
  dryRun?: boolean;
  payload: Record<string, unknown>;
};
```

### 幂等要求

这些动作必须幂等：
- 创建占位子节点
- 写页面状态
- 绑定 session 与子节点
- 批量更新工具元信息

例如：
- 同一个 `generate_page(pageId=2)` 重放两次
- 不能创建两个 2P 节点

### 回滚策略

第一版建议不做数据库式强事务，做“显式补偿回滚”：

1. 先记录 action intent
2. 执行局部变更
3. 如果后续失败，调用 compensating action

例如：
- 已创建 4 个待生成子节点
- 第 3 步校验失败
- 可补偿删除未绑定结果的临时子节点

## 36.22 Session 持久化与恢复模型

这个产品不是一次性表单，而是长时间画板工作区，所以 session 不能只活在内存里。

### 必须回答的问题

1. 刷新页面后 session 是否恢复
2. 恢复时是继续跑、暂停等待，还是标记中断
3. 哪些信息可持久化，哪些只能内存态

### 推荐第一版策略

可持久化：
- session 基本信息
- taskPlan
- page states
- approved anchor
- action history 摘要
- open issues

不持久化或仅短期缓存：
- 全量 console 流
- 大型原始模型响应
- 高频 debug payload

### 恢复语义

建议恢复后先进入：
- `rehydrated_waiting`

然后由 runtime 做一次 `resume check`：
- 如果上次正在跑的动作不可安全重放，转 `interrupted`
- 如果动作可安全续跑，转 `running`

### 建议状态补充

```ts
type SessionStatus =
  | "running"
  | "waiting"
  | "rehydrated_waiting"
  | "failed"
  | "completed"
  | "cancelled"
  | "interrupted"
  | "superseded";
```

## 36.23 Contract 测试与接口守卫

接口统一化之后，最怕的是“看起来规范了，但没人守”。

所以必须把 tool / settings / workflow 都纳入 contract 测试。

### 第一批必须有的测试

1. Tool Registry contract
- 每个 tool definition 必须有合法 id
- input/output schema 必须可解析
- visibility / permission 字段必须合法

2. Settings Snapshot contract
- 旧版 raw storage 能正常迁移
- 缺省字段能补默认值
- 作用域覆盖优先级正确

3. Workflow contract
- step 引用的 action 必须存在
- step 跳转不能形成非法死循环
- 高风险步骤必须标记权限

4. Host Action contract
- 同 idempotencyKey 重放不会重复创建资源
- rollback / compensate 路径可执行

### 建议目录

```text
tests/contracts/
  browser-tools.contract.test.ts
  runtime-settings.contract.test.ts
  workflows.contract.test.ts
  host-actions.contract.test.ts
```

## 36.24 Console / Debug 预算与脱敏模型

console bridge 很重要，但它天然带来两个风险：
- 性能风险
- 敏感信息泄漏风险

### 第一版必须限制

1. 只保留最近 N 条
2. 单条 payload 长度上限
3. 默认只给 agent 最近窗口，而不是全历史
4. 按 source / level 过滤后再提供

### 建议预算

```ts
export type ConsoleBudgetPolicy = {
  maxEvents: number;
  maxPayloadCharsPerEvent: number;
  maxReadWindow: number;
  persistErrorsOnly: boolean;
};
```

建议默认：
- `maxEvents = 500`
- `maxPayloadCharsPerEvent = 4000`
- `maxReadWindow = 50`
- `persistErrorsOnly = true`

### 脱敏要求

以下内容默认脱敏：
- API key
- Authorization header
- base64 大图正文
- 用户隐私文本
- provider 密钥与 token

### Agent 读取策略

agent 默认不应直接拿整段原始日志，而是先读：
- 摘要
- 错误计数
- 最近高优先级事件

只有在显式需要时再拉详细片段。

## 36.25 第一批必须补进总纲的硬规范

如果要把这份方案真正变成“后面谁来做都不会走偏”的蓝图，我建议把下面几条升成硬规范：

1. 一个源节点同一时刻只能有一个 active session lease
2. 所有写操作必须通过 host action commit
3. 所有可重放动作必须带 idempotencyKey
4. session 必须支持持久化摘要和恢复检查
5. tool / workflow / settings 都必须过 contract 测试
6. console bridge 必须有预算和脱敏策略

## 36.26 最诚实的补充判断

前面你总结的“接口规范统一化、工具模块化、边界清晰”是总原则。

这一节补的其实是另一半：
- 运行期不能乱

因为很多系统不是死在架构图，而是死在：
- 并发互踩
- 重试重复写
- 刷新后状态丢失
- 日志太重
- 新工具没有守卫

所以这 5 类保障不是附属品，而是让前面整套架构真正能活下来的保险丝。

## 37. 这和视觉 Orchestrator Agent 的关系

两层不是替代关系，而是上下层关系：

1. `Browser Native Agent Runtime`
- 负责看网页
- 负责看 console
- 负责发现和调用页面工具
- 负责生成工具和流程

2. `Visual Orchestrator Agent`
- 负责视觉任务理解
- 负责单图与套图规划
- 负责图像生成、评估、重规划

也就是说：
- Browser Runtime 像“操作系统”
- Visual Orchestrator 像“专业视觉执行 agent”

未来最理想的状态是：
- Visual Agent 需要一个新能力
- 先问 Browser Runtime 当前有没有对应工具
- 没有就临时拼装工具或建议生成新工具
- 然后继续完成任务

## 38. 最终判断标准再升级

如果最终要说“它真的开始像 Codex / OpenClaw 了”，至少要满足：

1. 能枚举当前网页可用工具
2. 能按 schema 调用这些工具
3. 能读取近期 console 和运行时错误
4. 能基于 console/状态决定下一步
5. 能把多个工具串成临时流程
6. 在工具不够时，能生成新工具草案
7. 能让视觉 agent 和浏览器 runtime 协同工作

如果还做不到这些，它更像：
- 会调图片工具的视觉 agent

而不是：
- 真正具备网页原生操作能力的 Codex / OpenClaw 风格 agent
