# 电商一键工作流 Phase 1 交互收敛架构方案

Last updated: 2026-04-08 09:39 (UTC+8)  
Owner: XC 架构师  
Scope: 步骤 5-7 的最小 UI 收敛方案，不改 skill 链路，不改主 store 结构

## 1. 为什么选这条路径

本轮优先做 Phase 1，而不是直接推进“大重构”，原因有三点：

1. 现有成功路径已经成立，最新快照显示方案规划可成功落地，见 [`latest-ecommerce-workflow-debug.json`](../../.jk-studio-runtime/ecommerce-workflow-debug/latest-ecommerce-workflow-debug.json)。当前更大的问题是成功路径理解成本，而不是主链路不可用。
2. 现有代码里，步骤拆分已经初步完成，见 [`WORKFLOW_ORDER`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx:162)；现在缺的是“顶部行动引导”和“内容筛选层”，不需要先动 controller / skill。
3. 大文件风险高，尤其 [`EcommerceOneClickCards`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:2854) 体量很大；最稳妥的做法是先通过局部派生状态和局部 UI 插槽做减负，而不是搬大块逻辑。

结论：本轮采用“只改 UI 层 + 只加派生状态 + 不改后端协议”的最小可验证方案。

## 2. 本轮要解决的核心问题

### 2.1 顶部只有状态，没有当前唯一决策
当前抽屉头部主要展示状态摘要、进度和回退入口，见 [`EcommerceWorkflowDrawer`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx:942)。

问题：
- 用户知道“我在看哪里”，但不够知道“我现在该做什么”。
- 当前信息结构更像 dashboard，不像 workflow 决策面板。

### 2.2 方案规划区默认信息过满
当前方案规划区会同时展示：
- 竞品上下文
- review
- 分组统计
- 分组卡
- 组级策略
- 单图编辑项

见 [`ecomOneClick.plans`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:7670)。

问题：
- 在 8 组 / 32 job 规模下，默认全量阅读成本高。
- “全部折叠 / 全部展开”是结构控制，但不是任务导向筛选。

### 2.3 提示词定稿区 CTA 仍在竞争
当前在定稿区会同时出现多个方向不同的 CTA，见 [`isFinalizeView`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:8619) 和 [`handlePrepareBatchPromptsAction()`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:8763)。

问题：
- 熟练用户会觉得灵活。
- 普通用户会不知道系统建议他先补词、先进工作台还是直接跑。

## 3. Phase 1 方案边界

### 包含
1. 抽屉顶部增加“阶段主决策行动条”
2. 方案规划区增加轻量筛选视图
3. 提示词定稿区 CTA 收敛为主次分明
4. 阶段内阻塞说明更明确

### 不包含
1. 不改 [`useWorkspaceEcommerceWorkflow`](../../pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts) 的主流程调用顺序
2. 不改 [`stores/ecommerceOneClick.store.ts`](../../stores/ecommerceOneClick.store.ts) 的核心状态结构
3. 不改 skill 入参 / 出参
4. 不处理 overlay 编辑器深度重构
5. 不做执行区复杂驾驶舱视图

## 4. 涉及文件与模块边界

### 4.1 [`pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx)
职责：
- 承载抽屉顶部总览
- 承载阶段切换
- 适合新增“阶段主决策行动条”

建议修改内容：
- 在现有头部摘要区下方插入一个新的 `phase1 action bar`
- 这个 action bar 只依赖现有 `state + summary + selectedStep`
- 不在这里写业务提交逻辑，只做“决策文案 + CTA 映射 + 阻塞提示”

原因：
- 顶部是全局语义层，放在 drawer 比放在 cards 更稳。
- 不会污染各阶段卡片内部的编辑逻辑。

### 4.2 [`pages/Workspace/components/workflow/EcommerceOneClickCards.tsx`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx)
职责：
- 承载步骤卡片内容
- 当前步骤 5 和步骤 6 的交互密度过高

建议修改内容：
- 在 [`ecomOneClick.plans`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:7670) 里增加 `plan view filter`
- 在 [`ecomOneClick.batch`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:8678) 里增加 `finalize CTA priority rule`
- 本轮不拆组件，只做局部派生和局部按钮规则调整

原因：
- 方案筛选和 CTA 收敛都属于展示层策略，最适合留在 cards 层。
- 不需要进入 store 或 controller。

### 4.3 [`docs/product/ECOMMERCE_ONECLICK_UX_HANDOFF_20260408.md`](../product/ECOMMERCE_ONECLICK_UX_HANDOFF_20260408.md)
职责：
- 作为 PM 交接输入
- 本方案直接继承其中 P0/P1 优先级

本轮不需要修改，但实施前后都应以它为验收参考。

## 5. 需要新增的最小派生状态

本轮建议全部使用组件内 `useMemo` 派生，不落 store。

### 5.1 顶部行动条派生
放在 [`EcommerceWorkflowDrawer`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx) 内。

建议派生一个 `workflowActionBarState`：
- `title`
- `description`
- `primaryActionLabel`
- `secondaryActionLabel`
- `blockerText`
- `emphasisTone`
- `actionTarget`

数据来源：
- `state.step`
- `selectedStep`
- `summary.progressDone / progressTotal / progressText`
- `state.planGroups.length`
- `state.batchJobs.length`
- `summary.failedJobs`

说明：
- 这是纯展示派生，不写回任何状态。
- `actionTarget` 只映射现有 handler，不新增 controller 入口。

### 5.2 方案规划筛选派生
放在 [`ecomOneClick.plans`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:7670) 内。

建议新增局部视图状态：
- `planViewMode = "all" | "priority" | "problem"`

建议新增派生字段：
- `planProblemGroupIds`
- `planPriorityGroupIds`
- `filteredPlanGroups`

判定规则先做轻量版：
- `problem`：
  - 组内项数 `< PLAN_ITEM_BASELINE_COUNT`
  - 或无 `group.strategy`
  - 或高优先级但当前 `groupResultCount === 0`
- `priority`：
  - `group.priority === "high"`
  - 若为空则退化为前 3 组

说明：
- 第一版不追求完美语义，只要让用户快速聚焦“更该先看哪组”。
- 这些规则仅在前端派生，回滚成本低。

### 5.3 定稿区 CTA 规则派生
放在 [`ecomOneClick.batch`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:8678) 内。

建议派生：
- `promptReadyRatio`
- `shouldPromotePreparePrompts`
- `shouldPromoteRunBatch`
- `shouldDemoteWorkbenchEntry`

推荐规则：
- 当 `promptReadyRatio < 0.7`：
  - 主按钮：整理提示词
  - 次按钮：进入工作台
  - 弱化直接执行
- 当 `promptReadyRatio >= 0.7`：
  - 主按钮：开始执行
  - 次按钮：补齐剩余提示词
  - 工作台入口降级为边按钮

说明：
- 这里只改按钮层级与文案，不改现有 handler。

## 6. 数据流 / 状态流影响

### 6.1 不新增持久化状态
本轮全部使用组件内派生状态和少量局部 `useState`：
- 抽屉行动条：纯 `useMemo`
- 方案筛选模式：局部 `useState`
- CTA 优先级：纯 `useMemo`

因此：
- 不影响 session hydrate
- 不影响缓存恢复
- 不影响 debug 快照结构
- 不影响 skill 输入输出

### 6.2 现有状态读取路径保持不变
仍然基于：
- [`useEcommerceOneClickState()`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx:594)
- `summary`
- `message.jobs`
- `draftPlanGroups`
- `resultCountByPlanItem`

因此数据流是“只读增强”，不是“写路径改造”。

## 7. 向后兼容与迁移考虑

### 向后兼容
- 旧 session 不需要迁移。
- 旧缓存不需要补字段。
- 老的 debug 文件仍可直接读取。
- 现有 controller / store / types 不需要 schema 迁移。

### 潜在兼容点
- 如果某些旧 session 的 `group.strategy` 缺失，正好会落入 `problem` 组，这是可接受的展示降级。
- 如果 `batchJobs` 为空，顶部行动条和 CTA 都应回退到“暂无可执行任务”文案。

## 8. 最小实现顺序

### Step 1：先补顶部行动条
目标文件：[`EcommerceWorkflowDrawer.tsx`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx)

先做原因：
- 影响面最小
- 收益最直接
- 不需要碰大段卡片内部结构

预期产出：
- 用户一打开抽屉就知道当前要做什么

### Step 2：再做方案筛选
目标文件：[`EcommerceOneClickCards.tsx`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx)

先做原因：
- 这是当前信息减负收益最大的点
- 只要在 `visiblePlanGroups` 之前增加一层筛选即可

预期产出：
- 进入规划页默认先看重点组，而不是被全量组淹没

### Step 3：最后做定稿区 CTA 收敛
目标文件：[`EcommerceOneClickCards.tsx`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx)

最后做原因：
- 规则较明确
- 但按钮顺序和文案调整更容易触发使用习惯变化，适合在前两步完成后再做

预期产出：
- 减少“我应该先点哪个”的犹豫

## 9. 验证方式

### 9.1 静态验证
1. 抽屉顶部在 [`PLAN_SCHEMES`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx:167)、[`FINALIZE_PROMPTS`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx:168)、[`BATCH_GENERATE`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx:169) 三个阶段都能展示不同的主决策条。
2. `planViewMode` 切换后，分组统计和列表内容同步变化。
3. 定稿区不同 `promptReadyRatio` 下，主按钮和次按钮优先级正确切换。

### 9.2 手工路径验证
1. 准备一个已有 `planGroups >= 5` 的 session。
2. 进入方案规划页：
   - 默认能看到筛选入口
   - 切到“仅问题组”后数量减少且仍能编辑
3. 进入提示词定稿页：
   - 当多数 job 无 prompt 时，主按钮应是“整理提示词”
   - 当多数 job 已有 prompt 时，主按钮应是“开始执行”
4. 进入执行页：
   - 顶部行动条应把失败数 / 待执行数表达清楚

### 9.3 回归关注点
- 回退步骤按钮仍可用，见 [`onSetWorkflowStep`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx:991)
- 方案组展开 / 折叠不受影响，见 [`togglePlanGroupCollapsed`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:7944)
- 现有批量按钮 handler 不改，只改排序和文案

## 10. 风险

### 风险 1：前端派生规则不稳定
表现：
- “问题组”判定可能不完全符合业务直觉。

控制方式：
- 第一版规则保持简单可解释。
- 不写入 store，后续可快速调整。

### 风险 2：大文件局部改动引发样式耦合
表现：
- [`EcommerceOneClickCards.tsx`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:2854) 本身较大，插入逻辑点不对容易影响渲染层级。

控制方式：
- 仅在现有统计条和按钮区附近插入新块。
- 不先拆文件，不做大搬运。

### 风险 3：按钮层级变化影响熟练用户习惯
表现：
- 老用户可能习惯直接点“开始执行”。

控制方式：
- 不删除旧入口，只调整主次顺序。
- 保留工作台入口作为次级操作。

## 11. 回滚点

本轮所有改动都集中在 UI 展示层，因此回滚非常直接：

1. 删除 drawer 顶部新增行动条区块
2. 删除 `planViewMode` 和对应过滤逻辑
3. 恢复定稿区原按钮顺序与文案

因为不改 store / types / controller / skill，所以不存在数据迁移回滚问题。

## 12. 给 coder 的落地指令建议

如果下一步切到 coder，建议严格按以下顺序实施：

1. 先在 [`EcommerceWorkflowDrawer.tsx`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx) 加顶部行动条，不改任何现有 handler 签名。
2. 再在 [`EcommerceOneClickCards.tsx`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx) 的方案规划段加入 `planViewMode` 和前端过滤。
3. 最后在定稿区加入 `promptReadyRatio` 派生和 CTA 排序规则。
4. 每一步都只做可视化层验证，不串联大改。

## 13. 本轮结论

最小可信方案不是“重构流程”，而是：
- 在 [`EcommerceWorkflowDrawer.tsx`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx) 顶部补一层决策语义
- 在 [`EcommerceOneClickCards.tsx`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx) 的方案规划区补一层筛选语义
- 在同文件的定稿区补一层 CTA 优先级语义

这样能在不动主数据流的前提下，直接降低步骤 5-7 的理解成本、浏览成本和决策成本。
