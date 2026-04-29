# 电商一键工作流 Phase 2 UX 优化 PRD

Last updated: 2026-04-08 11:39 (UTC+8)  
Owner: XC 产品经理  
Status: Draft  
Scope: 基于已落地 Phase 1，继续收敛步骤 5-7 的信息层级与执行体验，仅输出产品方案，不涉及业务代码修改

## 1. Problem Statement

### 当前表现
- Phase 1 已经把“阶段主决策”立起来，抽屉顶部已有 [`workflowActionBarState`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx:829)，并在抽屉头部展示主动作 / 次动作 / 阻塞说明，见 [`EcommerceWorkflowDrawer`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx:1219)。
- 方案规划区已经支持“全部 / 待确认优先组 / 仅问题组”三种视图，见 [`planPriorityGroupIds`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:3082)、[`planProblemGroupIds`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:3094)、[`visiblePlanGroups`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:3113) 和视图按钮区 [`方案工作视图`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:7858)。
- 提示词定稿区已经按就绪率切换 CTA 主次，见 [`shouldPromotePreparePrompts`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:8763) 以及按钮区 [`提示词定稿队列`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:8897)。

### 仍然存在的问题
1. **步骤 5 仍然是“组卡 + 镜头编辑”同层展开**
   - 当前方案组虽然有筛选，但组内仍默认带着较多说明、竞品提示、镜头编辑项一起出现，见 [`visiblePlanGroups.map()`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:7911)。
   - 结果是：用户虽然更容易找到“该先看哪组”，但进入某组后，仍需要在同一层里阅读摘要、风险、竞品提示、镜头项和编辑内容。

2. **步骤 7 总览区已经更清楚，但还不像真正的“任务驾驶舱”**
   - 当前批量区总览仍以说明文案 + 统计卡 + CTA 为主，见 [`批量执行队列`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:8838)。
   - 现有 [`ECOMMERCE_ONECLICK_STEP7_LAYOUT_SPEC`](../product/ECOMMERCE_ONECLICK_STEP7_LAYOUT_SPEC.md:1) 明确要求 Step 7 更像高密度、可连续操作的生产工作台，但当前实现距离该规范仍有差距：
     - 还没有“失败 / 未开始 / 最近结果 / 当前首选”的系统聚焦入口。
     - “进入步骤七工作台”仍是独立跳转型 CTA，和“就地完成”原则存在张力，见 [`handleOpenBatchWorkbenchAction()`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:4042) 与 CTA 按钮 [`进入步骤七工作台`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:8942)。

3. **Phase 1 解决的是“先做什么”，Phase 2 要解决的是“先看什么、先改哪里”**
   - 也就是说，下一阶段重点不再是补一层提示，而是把成功路径从“可理解”继续收敛到“可高效连续操作”。

## 2. Goal

### 主目标
继续优化电商一键工作流步骤 5-7，让用户在真实大批量场景下：
1. 进入方案规划后，先看“组决策”，再按需进入“单图编辑”。
2. 进入批量执行后，先看“最该处理的任务”，而不是先读完整列表。
3. 在单个任务上尽量就地完成“看状态 → 改词 → 重跑 → 看结果 → 设首选”的闭环。

### 业务价值
- 降低 8 组 / 32 job 级别任务的浏览与切换成本。
- 降低“工作台入口”和“当前页面主路径”之间的认知冲突。
- 让工作流更像生产工具，而不是信息展示页。

## 3. Non-goals

本轮不做以下内容：
1. 不改 skill 调用链，不改 [`ecomRewritePromptSkill()`](../../services/skills/ecom-oneclick-workflow.skill.ts:10250) 或其它业务生成逻辑。
2. 不改 [`useWorkspaceEcommerceWorkflow`](../../pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts) 主时序。
3. 不做 overlay 编辑器重构，不处理文本叠加系统的深层交互。
4. 不做全量视觉重绘；优先做信息架构、展示层级和操作路径收敛。
5. 不在这一轮重新设计所有 message 类型或拆分整个 [`EcommerceOneClickCards`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:2856)。

## 4. Affected Steps / User Flow

### 主要影响步骤
- Step 5：方案规划
- Step 6：提示词定稿
- Step 7：批量执行与结果筛选

### 目标用户路径
1. 用户完成分析与补充信息后，进入步骤 5。
2. 用户先确认方案组是否成立，再进入某个组的单图编辑。
3. 用户进入步骤 6 时，系统根据定稿完成度引导先补词或先执行。
4. 用户进入步骤 7 时，系统默认聚焦失败项 / 未开始项 / 最新结果。
5. 用户在单个任务卡内完成改词、重跑、结果筛选与首选设置。

## 5. Evidence Sources

1. 产品交接文档：[`ECOMMERCE_ONECLICK_UX_HANDOFF_20260408.md`](../product/ECOMMERCE_ONECLICK_UX_HANDOFF_20260408.md:1)
2. Phase 1 架构文档：[`ECOMMERCE_ONECLICK_PHASE1_UX_ARCHITECTURE_20260408.md`](../architecture/ECOMMERCE_ONECLICK_PHASE1_UX_ARCHITECTURE_20260408.md:1)
3. Step 7 规范文档：[`ECOMMERCE_ONECLICK_STEP7_LAYOUT_SPEC.md`](../product/ECOMMERCE_ONECLICK_STEP7_LAYOUT_SPEC.md:1)
4. 当前抽屉实现：[`workflowActionBarState`](../../pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx:829)
5. 当前方案规划实现：[`visiblePlanGroups`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:3113) 与 [`方案工作视图`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:7858)
6. 当前批量执行实现：[`提示词定稿队列 / 批量执行队列`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:8838)

## 6. Key Findings

### 6.1 Step 5 已经有筛选，但缺“组层 / 项层”分层
- 当前已经能先筛出“优先组 / 问题组”，这是正确方向。
- 但从 [`visiblePlanGroups.map()`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:7911) 看，组卡和组内编辑仍然连续铺开，说明“找重点”与“开始编辑”还没有被拆成两层任务。

### 6.2 Step 7 规范已有，但实现仍停留在“总览 + CTA + 全量队列”
- [`ECOMMERCE_ONECLICK_STEP7_LAYOUT_SPEC`](../product/ECOMMERCE_ONECLICK_STEP7_LAYOUT_SPEC.md:127) 已明确：分组卡只负责说明“这一组是什么”，任务卡才承载编辑操作。
- 当前实现中，虽然已经有总览和分组，但系统还没有主动提供“失败优先 / 最近结果 / 当前首选”视图入口，距离 [`结果卡排序原则`](../product/ECOMMERCE_ONECLICK_STEP7_LAYOUT_SPEC.md:189) 还有落差。

### 6.3 工作台入口仍是旁路，不是主路径的一部分
- 当前 CTA 中依然保留 [`进入步骤七工作台`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:8942)，说明系统默认仍把一部分高频操作寄托给外部工作台。
- 这与 [`Step 7 交互规则`](../product/ECOMMERCE_ONECLICK_STEP7_LAYOUT_SPEC.md:238) 中“所有单条任务操作都应就地完成，避免把用户赶到别的面板”并不完全一致。

## 7. Recommended Direction

## 7.1 P0：步骤 5 改成“先组后项”的渐进披露
### 方案
- 默认组卡只保留：
  - 组标题
  - 组摘要
  - 本组任务数 / 结果数 / 优先级
  - 1 个主动作：“进入本组编辑”
- 单图编辑区改成按需展开：
  - 可做组内二级面板
  - 或右侧局部详情区
- 竞品提示默认降到证据层，不与组摘要同权常驻。

### 预期收益
- 用户先判断“这组值不值得看”，再进入细项编辑。
- 首屏不再被整组镜头编辑内容淹没。

## 7.2 P0：步骤 7 增加系统推荐视图
### 方案
在 [`批量执行队列`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:8838) 顶部新增执行视图过滤：
- 优先看失败任务
- 优先看未开始任务
- 优先看最近结果
- 优先看当前首选

### 规则建议
- 默认优先级：
  1. 有失败任务时，默认落在“失败任务”
  2. 无失败但有 idle 时，默认落在“未开始任务”
  3. 全部完成后，默认落在“最近结果”
- “当前首选”作为复盘视图，不作为默认入口。

### 预期收益
- 执行区从“完整列表”升级为“系统先帮你找最该处理的事”。

## 7.3 P1：把“进入步骤七工作台”降级为辅助入口
### 方案
- 当前主路径应优先支持：
  - 批量整理提示词
  - 单条改词
  - 失败重试
  - 结果设首选
- [`进入步骤七工作台`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:8942) 保留，但降级到更多操作或二级入口。

### 理由
- 当前规范要求就地完成高频任务，不应让工作台承担主流程必经操作。

## 7.4 P1：结果区按“首选 / 最新 / 历史”稳定排序
### 方案
- 在每个任务内固定结果顺序：
  1. 当前首选
  2. 最新结果
  3. 其它历史结果
- 默认只展开前 1-2 张高价值结果；历史版本折叠。

### 理由
- 对齐 [`Step 7 结果卡排序`](../product/ECOMMERCE_ONECLICK_STEP7_LAYOUT_SPEC.md:189)，减少用户在历史结果海里寻找当前结论的成本。

## 8. Acceptance Criteria

1. 进入步骤 5 时，首屏以“方案组决策”而非“全量镜头编辑”作为主内容。
2. 用户不展开单组详情时，看不到大面积单图编辑表单。
3. 进入步骤 7 时，系统可一键切到失败 / 未开始 / 最近结果 / 当前首选视图。
4. 当存在失败任务时，执行区默认先聚焦失败任务。
5. 用户在当前页面可完成至少以下闭环：查看任务状态 → 改词或重跑 → 查看结果 → 设首选。
6. [`进入步骤七工作台`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:8942) 不再与主动作同权竞争。

## 9. Dependencies and Risks

### 依赖
- 继续复用当前 Phase 1 的派生状态模式，不优先落 store。
- 需要在 [`EcommerceOneClickCards`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:2856) 内增加更多局部展示派生与局部视图状态。
- Step 7 需复用现有结果状态、失败状态、首选结果状态，而不是新建协议。

### 风险
1. [`EcommerceOneClickCards`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:2856) 文件过大，继续叠加局部逻辑容易让渲染块更重。
2. 如果“组层 / 项层”分层方案设计不清，可能反而增加一次点击成本。
3. 如果过早删除工作台主入口，可能影响熟练用户的高频路径。

### 风险控制
- 先做“默认折叠 + 局部展开”，不做大规模组件重写。
- 保留工作台入口，但明确降级。
- 所有新规则先做展示派生，不先改 controller / store。

## 10. Suggested Implementation Order

### Phase 2A：方案规划分层
1. 组卡默认信息减负
2. 单图编辑改按需展开
3. 竞品信息降级到证据层

### Phase 2B：执行区聚焦模式
1. 新增失败 / 未开始 / 最近结果 / 当前首选视图
2. 加默认聚焦规则
3. 调整总览卡文案与 CTA 顺序

### Phase 2C：结果区收口
1. 结果卡按首选 / 最新 / 历史排序
2. 历史结果默认折叠
3. 把工作台入口降级为辅助入口

## 11. Suggested First Engineering Scope

建议下一位先收敛到以下最小实现范围：
1. 在 [`ecomOneClick.plans`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:7724) 中，把组级摘要与单图编辑拆成默认折叠的两层展示。
2. 在 [`ecomOneClick.batch`](../../pages/Workspace/components/workflow/EcommerceOneClickCards.tsx:8669) 中，新增执行视图筛选和默认聚焦规则。
3. 在每个任务的结果区内，按“首选 / 最新 / 历史”统一排序与折叠逻辑。
4. 不改 skill 入参 / 出参，不改 [`useWorkspaceEcommerceWorkflow`](../../pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts) 主调用链。

## 12. Final Note

Phase 1 解决的是“当前该做什么”；Phase 2 应该解决的是“当前先看什么、先改哪里、先处理哪批任务”。如果这一步做对，步骤 5-7 才会从“可用”真正变成“高效”。
