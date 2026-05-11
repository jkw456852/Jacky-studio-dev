# 主脑能力单一声明源 / Handler 注册表 / 通用 Mutation Envelope 改造计划

日期：2026-05-09
状态：实施中（Phase 1 / 2 / 3 已完成，Phase 4 待补）
范围：主脑能力声明、规划契约、执行桥、权限治理、审计、测试脚手架

---

## 1. 背景与问题定义

当前主脑已经具备以下能力：
- 能理解用户意图
- 能在主脑回合中进行规划
- 能根据白名单能力调用技能或治理动作
- 能把部分治理动作持久化到账号资产

但随着功能持续增长，出现了越来越明显的接入成本问题：

1. **新增能力接入点过多**
   - 能力注册表要加
   - prompt 规划契约要加
   - 运行时执行器要加
   - 权限判断要加
   - 审计文案要加
   - 回归测试要加

2. **能力定义不是单一事实源**
   同一个动作的“说明 / 参数 / 约束 / 执行入口 / 测试预期”分散在多个文件中维护，容易漏改。

3. **主脑看起来像不知道新功能**
   新功能即使已经做完 UI 或存储，只要没接入主脑能力面，主脑就只能描述，不能执行。

4. **动作枚举会持续膨胀**
   目前角色治理已经从读、草案、升级、归档扩展到 addon 改写。接下来主脑配置中心还会继续增加：
   - Soul
   - User
   - Workflow
   - Memory
   - Heartbeat
   - Bootstrap

如果继续沿用“每个动作手工补多处”的方式，后续复杂度会持续上升。

---

## 2. 改造目标

### 2.1 核心目标

把当前“能力说明、规划提示、执行桥、权限、审计、测试”分散维护的模式，升级为：

**单一能力声明源 + Handler 注册表 + 通用 Mutation Envelope**

使新增能力时尽量收敛为：
- 注册一次能力定义
- 注册一个执行 handler
- 自动派生 prompt / 校验 / 审计 / 测试骨架

### 2.2 直接收益

1. 降低新增能力接入成本
2. 降低漏接 prompt / executor / 权限的概率
3. 提升主脑对新能力的可见性与一致性
4. 为主脑配置中心后续大量资产动作打基础
5. 让治理动作从枚举膨胀转向资源化管理

### 2.3 非目标

本轮**不**做以下事情：
- 不把主脑改造成自由 DOM 代理
- 不让模型绕过白名单直接操作页面
- 不推翻现有主脑 runtime 框架
- 不一次性重写所有现有技能系统
- 不在第一阶段就完成全域资源统一 mutation 化

---

## 3. 现状根因拆解

### 3.1 能力声明与执行分离，但未统一收敛

当前能力面主要存在于：
- 主脑能力注册表
- analyze plan prompt 合同
- 治理执行器或 skill 执行器
- 测试文件

这说明系统已经模块化，但还没有形成一个真正的“能力元数据中心”。

### 3.2 规划层知道动作，不等于执行层能执行

主脑即使在规划中正确表达意图，如果执行器没有对应 handler，也只能停留在文本说明层。

### 3.3 权限体系与能力体系耦合方式偏手工

每新增一个动作，通常都要在多处手动补“allow / mode / approval”逻辑，长期难维护。

### 3.4 审计与测试没有从能力定义自动派生

导致任何新动作都要手写回归用例和审计文案，重复劳动高。

---

## 4. 目标架构

### 4.1 三层结构

#### 第 1 层：Capability Manifest（单一能力声明源）

每个主脑能力统一定义：
- id
- kind
- resource
- operation
- plannerSummary
- useWhen / avoidWhen
- params schema
- permission policy
- audit template
- executor key
- example payload
- test fixture metadata

#### 第 2 层：Handler Registry（执行注册表）

将当前多个 switch / if 白名单分支逐步改造成：
- capabilityId / mutationKey -> handler
- handler 内部统一做：
  - 参数校验
  - 权限校验
  - 执行
  - 审计结果返回

#### 第 3 层：Mutation Envelope（通用变更协议）

将大量定制动作抽象成统一协议：
- resource
- operation
- target
- payload
- policy
- reason

这样主脑逐步从“记住很多离散动作名”转向“理解标准化资源操作模型”。

---

## 5. 推荐实施路线

采用分阶段收敛，而不是一次性大改。

### Phase 1：能力声明中心化（先治理动作，后扩全域）

目标：
- 先把主脑治理能力从说明型 registry 升级为真正 manifest
- 但不大改运行时主链路

交付：
1. 新建主脑能力 manifest 模块
2. 为角色治理动作补充结构化 schema / permission / audit 元数据
3. 让 prompt 摘要优先从 manifest 自动生成
4. 保持现有 runtime 兼容

优先纳入的动作：
- roleLibraryRead
- roleDraftCreate
- roleDraftUpdate
- rolePromote
- roleArchive
- roleAddonUpdate
- roleBindToTask
- roleSuggestReplacement

### Phase 2：治理执行器改为 Handler Registry

目标：
- 替换治理执行器内的动作分支膨胀
- 让新增治理动作只需要注册 handler

交付：
1. 抽象 governance action handler 接口
2. 建立 action -> handler 注册表
3. 把角色治理动作逐个迁入 handler
4. 统一权限判断、审计结果与错误输出

### Phase 3：引入通用 Mutation Envelope

目标：
- 从“动作名驱动”升级为“资源 + 操作驱动”
- 先覆盖角色治理，再为主脑配置中心资源预留复用能力

首批资源：
- role
- roleAddon
- mainBrainSoul
- mainBrainUser
- mainBrainWorkflow
- mainBrainMemory
- mainBrainHeartbeat
- mainBrainBootstrap

统一操作：
- read
- create
- update
- archive
- promote
- delete
- bind

### Phase 4：能力脚手架与自动化派生

目标：
- 降低未来新增能力的人力成本

交付：
1. 新能力模板脚手架
2. 最小测试骨架生成器
3. 审计文案模板派生
4. Prompt capability summary 自动生成
5. 能力清单与实现覆盖检查

---

## 6. Phase 1 详细计划

### 6.1 页面目标 / 产品目标

不是新增用户界面，而是构建一套更稳定的主脑内部能力协议，使后续所有主脑可执行能力都能更低成本接入。

### 6.2 开发主任务

1. 找出主脑治理能力的最小单一声明结构
2. 在不破坏现有行为的前提下完成 manifest 化
3. 保持现有 prompt 与执行行为兼容
4. 为 Phase 2 的 handler registry 预留标准接口

### 6.3 功能清单

#### 高优先级
- 新建 capability manifest 类型与数据结构
- 迁移角色治理能力定义
- 让 capability prompt summary 从 manifest 派生
- 补 manifest 级参数 schema 与权限元数据
- 补 Phase 1 回归测试

#### 中优先级
- 为 skill 类能力也建立同构 manifest 结构
- 加入 example payload 与风险标签
- 增加能力覆盖率检查

#### 低优先级
- 自动生成文档页
- 可视化能力面板

### 6.4 信息架构

#### 一级结构
1. Capability Manifest
2. Prompt Derivation
3. Permission Policy
4. Audit Template
5. Executor Binding
6. Test Fixture Metadata

#### 二级结构

**Capability Manifest**
- governance capabilities
- executable skills
- specialist routing targets
- internal modules awareness

**Prompt Derivation**
- planner capability summary
- role governance section
- action examples
- do / don’t rules

**Permission Policy**
- governance mode gates
- auto manage gates
- approval_required gates
- mutation / promotion scope

**Executor Binding**
- legacy switch compatibility
- future handler key
- runtime adapter hooks

### 6.5 文件级改造草案

#### 新增文件
- `services/agents/main-brain-capability-manifest.ts`
  - 统一定义主脑能力 manifest 类型与初始数据

#### 第一批调整文件
- `services/agents/main-brain-capability-registry.ts`
  - 从手写 registry 逐步改为基于 manifest 派生
- `services/agents/analyze-plan-prompt.ts`
  - 主脑能力提示摘要尽量从 manifest 派生
- `services/agents/main-brain-role-governance.ts`
  - 先兼容 manifest 的 executorKey / permissionPolicy
- `types/agent.types.ts`
  - 若需要补充统一 mutation / action 类型基础定义
- `services/agents/main-brain-role-governance.test.ts`
  - 补 manifest 派生下的治理回归测试

### 6.6 兼容性策略

Phase 1 不要求立刻删除旧结构，而是：
- 先建立 manifest
- 再由现有 registry / prompt summary 读取 manifest
- 保持旧测试通过
- 确认能力接入链路无回归后再进入 handler 重构

---

## 7. Phase 2 详细计划：Handler Registry

### 7.1 目标

把治理执行从“动作 switch 分支”收敛成“标准 handler 注册”。

### 7.2 设计草案

建议建立统一接口：

```ts
export interface MainBrainGovernanceHandler {
  id: string;
  canHandle(action: MainBrainRoleGovernanceAction): boolean;
  validate(input: GovernanceExecutionInput): GovernanceValidationResult;
  execute(input: GovernanceExecutionInput): GovernanceExecutionResult;
}
```

或更直接：

```ts
export type MainBrainGovernanceHandlerMap = Record<
  MainBrainRoleGovernanceAction['action'],
  (input: GovernanceExecutionInput) => GovernanceExecutionResult
>;
```

### 7.3 执行原则

每个 handler 内部统一完成：
- 参数校验
- 权限校验
- 持久化动作
- 审计 note 生成
- 失败原因标准化

### 7.4 收益

- 新增治理动作只需要注册 handler
- 不再修改大段 switch
- 单测粒度更清晰

---

## 8. Phase 3 详细计划：通用 Mutation Envelope

### 8.1 背景

角色治理只是开始。主脑配置中心资产一旦逐步开放给主脑治理，就会继续复制动作膨胀问题。

### 8.2 推荐 Envelope

```ts
export interface MainBrainMutationEnvelope {
  resource:
    | 'role'
    | 'roleAddon'
    | 'mainBrainSoul'
    | 'mainBrainUser'
    | 'mainBrainWorkflow'
    | 'mainBrainMemory'
    | 'mainBrainHeartbeat'
    | 'mainBrainBootstrap';
  operation:
    | 'read'
    | 'create'
    | 'update'
    | 'archive'
    | 'promote'
    | 'delete'
    | 'bind';
  targetId?: string;
  targetBaseAgentId?: string;
  payload?: Record<string, unknown>;
  governanceMode?: string;
  requiresHumanApproval?: boolean;
  reason: string;
}
```

### 8.3 迁移顺序

1. 角色治理动作先提供 envelope 镜像输出
2. 再让配置中心资产动作直接使用 envelope
3. 最后再考虑把旧 action 枚举收口为 envelope 兼容层

---

## 9. 测试策略

### 9.1 Phase 1
- manifest 是否覆盖现有治理能力
- prompt summary 是否从 manifest 正确派生
- 旧的治理闭环测试不回归

### 9.2 Phase 2
- 每个 governance handler 独立测试
- handler registry 路由正确性测试
- 权限拦截与 requiresHumanApproval 分支测试

### 9.3 Phase 3
- mutation envelope 到具体资源执行器的分发测试
- 通用审计结构测试
- role / memory / heartbeat 资源一致性测试

### 9.4 回归底线

至少保证：
- 现有角色治理能力不退化
- addon_update 闭环不退化
- selectedRole metadata 执行链不退化
- 主脑能力摘要与实际可执行面不再分叉

---

## 10. 风险与防护

### 风险 1：改造期 prompt 与执行面不一致

防护：
- Phase 1 先做 manifest 派生，不立即砍旧逻辑
- 用测试对比 registry 与 summary 输出

### 风险 2：过早抽象导致实现变重

防护：
- 先只覆盖治理动作
- skills 与配置中心资源在第二轮逐步纳入

### 风险 3：mutation envelope 设计过宽

防护：
- 先限定首批资源
- payload schema 仍由具体资源模块负责

### 风险 4：团队理解成本上升

防护：
- 文档先行
- manifest 字段命名尽量贴近当前已有概念
- 提供新能力接入模板

---

## 11. 验收标准

达到以下条件，视为 Phase 1 通过：

1. 新增一个治理能力时，不再需要手工同时修改 5 处以上位置
2. prompt capability summary 能由 manifest 自动生成
3. 现有角色治理动作全部有 manifest 定义
4. addon_update / promote / archive / draft_update 回归测试通过
5. 旧有角色治理行为不回归

达到以下条件，视为 Phase 2 通过：

1. 治理执行器不再依赖大段 switch 扩张
2. 新治理动作可以通过注册 handler 接入
3. 权限校验与审计输出逻辑统一收口

达到以下条件，视为 Phase 3 通过：

1. 角色治理与主脑配置中心资产可以共享 mutation 协议
2. 新资产动作不再需要单独设计一套 planner 词汇体系
3. 资源操作具备统一审计、统一权限与统一分发能力

---

## 12. 推荐执行顺序

### 第一步：先做计划确认
- 明确采用“单一能力声明源 + handler 注册表 + 通用 mutation envelope”的路线

### 第二步：实施 Phase 1
- 新建 manifest
- 迁移角色治理能力定义
- prompt summary 派生化
- 补回归测试

### 第三步：实施 Phase 2
- handler registry 化治理执行器
- 统一权限判断与执行结果结构

### 第四步：实施 Phase 3
- 为主脑配置中心资产引入通用 mutation envelope
- 与 Soul / User / Workflow / Memory / Heartbeat / Bootstrap 逐步接轨

### 第五步：实施 Phase 4
- 做脚手架与自动化派生
- 降低长期维护成本

---

## 13. 立即落地建议

下一轮实现从 **Phase 1** 开始，聚焦最小闭环：

1. 新建 capability manifest 文件
2. 把现有角色治理能力迁过去
3. 让主脑 capability summary 从 manifest 派生
4. 保持当前执行器兼容
5. 跑主脑治理测试确保无回归

这是改造成本最低、收益最高、且最不容易把现有主脑搞崩的第一阶段方案。

---

## 14. 当前实施结果（2026-05-09）

### 14.1 已完成

1. 已新增 `services/agents/main-brain-capability-manifest.ts`，把主脑能力面集中为单一声明源，覆盖：
   - internal modules
   - executable skills
   - governance capabilities
   - specialist routing targets

2. 已重构 `services/agents/main-brain-capability-registry.ts`，使其从 manifest 派生：
   - `MAIN_BRAIN_CAPABILITY_REGISTRY`
   - governance capability id 列表
   - governance executor key 列表
   - executor key -> capability 查询
   - manifest 驱动的 prompt summary / governance contract

3. 已重构 `services/agents/analyze-plan-prompt.ts`：
   - 角色治理 prompt 不再硬编码大段 capability 文案
   - 改为通过 manifest 派生 `buildRoleGovernancePromptContract()`

4. 已重构 `services/agents/main-brain-role-governance.ts`：
   - 治理执行从大段 action switch 演进为 handler registry
   - 已接入 manifest executorKey / permissionPolicy
   - 已支持 action 与 mutation envelope 并行兼容
   - 已支持 capabilityId / executorKey 反查能力元数据

5. 已扩展 `types/agent.types.ts`：
   - `MainBrainMutationEnvelope`
   - capability audit / permission / mutation metadata
   - governance action 上的 `capabilityId` 与 `mutation`

6. 已新增专项回归测试：
   - `services/agents/main-brain-capability-registry.test.ts`
   - `services/agents/main-brain-capability-manifest.test.ts`

7. 已通过主脑相关测试：
   - `npm run test:optimizer`
   - 当前结果：105 passed / 0 failed

### 14.2 当前结论

本轮已完成原计划中的：
- Phase 1：能力声明中心化
- Phase 2：治理执行器 handler registry 化
- Phase 3：角色治理范围内的 mutation envelope 接入
- 测试回归补强与全量验证

### 14.3 剩余项

尚未完成的仅剩：
- Phase 4：脚手架 / 覆盖校验 / 自动派生工具化
- 面向未来主脑配置中心资源（Soul / User / Workflow / Memory / Heartbeat / Bootstrap）的进一步复用扩展
