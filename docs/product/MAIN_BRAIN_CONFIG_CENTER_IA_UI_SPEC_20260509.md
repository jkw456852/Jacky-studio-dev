# 主脑配置中心信息架构与 UI 落地稿

日期：2026-05-09  
状态：实施前确认稿  
关联方案：[`MAIN_BRAIN_EXPLICIT_CONFIGURATION_MEMORY_HEARTBEAT_PLAN_20260509.md`](./MAIN_BRAIN_EXPLICIT_CONFIGURATION_MEMORY_HEARTBEAT_PLAN_20260509.md)

---

## 1. 目标

在不继续膨胀输入区的前提下，把当前零散的“主脑长期偏好”入口升级为统一的“主脑配置中心”，覆盖：

1. Overview
2. Soul
3. User
4. Workflow
5. Memory
6. Heartbeat
7. Bootstrap
8. Audit

并与现有角色治理、发送 metadata、运行时注入链路保持一致。

---

## 2. 现状勘察结论

### 2.1 已有入口

当前主脑入口已经存在于输入区工具栏：

- 入口触发：[`openMainBrainInspector()`](../../pages/Workspace/components/InputAreaBottomToolbar.tsx:435)
- 关闭逻辑：[`closeMainBrainInspector()`](../../pages/Workspace/components/InputAreaBottomToolbar.tsx:439)
- 当前弹层：[`showMainBrainInspector`](../../pages/Workspace/components/InputAreaBottomToolbar.tsx:2298)

说明：
- 当前入口并不是空白，需要复用。
- 现有 UI 仅支持“全局偏好行列表”的编辑，不足以承载 Soul / User / Workflow / Memory / Heartbeat / Bootstrap / Audit。

### 2.2 已有输入区边界

当前弹层本质是一个轻量全局偏好编辑器：

- 左栏显示默认基线：[`mainBrainDefaultText`](../../pages/Workspace/components/InputAreaBottomToolbar.tsx:2337)
- 右栏编辑用户长期偏好：[`mainBrainDraft`](../../pages/Workspace/components/InputAreaBottomToolbar.tsx:2351)
- 保存动作：[`handleSaveMainBrainPreferences()`](../../pages/Workspace/components/InputAreaBottomToolbar.tsx:843)
- 重置动作：[`handleResetMainBrainPreferences()`](../../pages/Workspace/components/InputAreaBottomToolbar.tsx:848)

结论：
- 现有弹层可作为“配置中心入口壳”。
- 输入区里只保留摘要与快捷入口，复杂编辑必须移出当前双栏简单弹层。

### 2.3 已有运行时挂载点

当前工作区发送链路已经具备统一 metadata 汇入点：

- 发送入口：[`useWorkspaceSend()`](../../pages/Workspace.tsx:4265)
- 已传入角色治理字段：[`selectedRoleId`](../../pages/Workspace.tsx:4271)、[`selectedRoleSource`](../../pages/Workspace.tsx:4272)、[`baseAgentId`](../../pages/Workspace.tsx:4273)、[`roleGovernanceMode`](../../pages/Workspace.tsx:4274)、[`allowMainBrainRoleMutation`](../../pages/Workspace.tsx:4275)、[`allowMainBrainRolePromotion`](../../pages/Workspace.tsx:4276)

结论：
- 后续 Soul / User / Workflow / Memory 摘要也应走同类“准备执行任务时注入”的模式。
- 不应新造第二套旁路 runtime 注入机制。

### 2.4 已有角色治理 UI 风格可复用

当前角色管理面板已经具备可直接复用的产品风格基线：

- 组件：[`RoleManagementPanel`](../../pages/Workspace/components/RoleManagementPanel.tsx:90)
- 当前主脑共享层预览：[`inspectedMainBrainBlock`](../../pages/Workspace/components/RoleManagementPanel.tsx:604)
- 治理权限区：[`主脑治理权限`](../../pages/Workspace/components/RoleManagementPanel.tsx:392)

结论：
- 主脑配置中心应延续同类卡片式、克制、说明右置的结构。
- 避免做成新的后台表单系统。

---

## 3. 信息架构落地稿

### 3.1 一级导航

主脑配置中心采用 8 个一级分区：

1. Overview
2. Soul
3. User
4. Workflow
5. Memory
6. Heartbeat
7. Bootstrap
8. Audit

### 3.2 各分区主任务与首页承载策略

#### A. Overview
主任务：
- 让用户快速看懂主脑当前长期配置状态。
- 快速发现待处理事项。

承载内容：
- Soul 摘要
- User 摘要
- Workflow 摘要
- Role Governance 默认策略摘要
- 最近记忆摘要
- 最近 Heartbeat 摘要
- 待确认记忆数
- 最近配置变更

不承载：
- 全量规则正文
- 全量记忆列表
- 全量心跳日志
- 审计 diff 明细

#### B. Soul
主任务：
- 定义主脑人格、表达风格、态度与风险偏好。

承载内容：
- 人格定位
- 表达风格
- 回答克制规则
- 自检偏好
- 风险偏好

#### C. User
主任务：
- 定义对“用户本人”的长期认识，而不是任务规则。

承载内容：
- 用户目标
- 工作习惯
- 业务背景
- 美学偏好
- 沟通习惯
- 长期备注
- 记忆黑名单

#### D. Workflow
主任务：
- 定义主脑在“如何做事”层面的默认策略。

承载内容：
- 默认分析深度
- 是否优先搜索
- 是否先澄清
- 工具使用原则
- 失败恢复策略
- 默认角色治理策略

#### E. Memory
主任务：
- 管理主脑长期记忆，而不是简单展示长文本。

承载内容：
- 待确认记忆
- 已确认长期记忆
- 最近自动提炼
- 记忆来源
- 提升 / 删除 / 降级动作

#### F. Heartbeat
主任务：
- 管理低频自治整理任务。

承载内容：
- 任务列表
- 执行频率
- 任务开关
- 最近摘要
- 风险说明

#### G. Bootstrap
主任务：
- 完成首次初始化和后续重跑初始化。

承载内容：
- 初始化状态
- 首次问卷
- 模板来源
- 最近初始化时间
- 重新初始化入口

#### H. Audit
主任务：
- 让配置、记忆、Heartbeat、角色治理变更可追踪、可回看。

承载内容：
- 主脑配置变更记录
- 记忆变更记录
- Heartbeat 执行记录
- 与角色治理关联记录
- 回滚入口

---

## 4. 首页与二级入口边界

### 4.1 首页只保留

Overview 只保留：

- 当前状态摘要
- 待处理提醒
- 关键风险
- 最近变化
- 快速入口

### 4.2 必须下沉到二级入口的内容

以下内容禁止直接堆在 Overview：

1. 大段规则全文
2. Memory 全量列表
3. Heartbeat 完整执行日志
4. 审计 diff 明细
5. 回滚历史详情
6. Bootstrap 全量问卷表单

---

## 5. UI 挂载策略

### 5.1 入口不新增，复用现有输入区主脑入口

保留当前输入区主脑按钮与打开逻辑：

- 入口仍由 [`openMainBrainInspector()`](../../pages/Workspace/components/InputAreaBottomToolbar.tsx:435) 触发

但将当前“简单双栏偏好编辑弹层”升级为“主脑配置中心容器”。

### 5.2 输入区只保留轻量职责

输入区主脑入口仅承担：

1. 当前主脑状态摘要
2. 待处理记忆数量
3. 最近 Heartbeat 摘要提示
4. 进入配置中心按钮

输入区不再承担：

- 大表单编辑
- 全量记忆操作
- 全量审计查看
- 心跳任务细粒度配置

### 5.3 第一阶段采用模态配置中心，而非新路由页

第一阶段建议仍挂在 [`InputAreaBottomToolbar.tsx`](../../pages/Workspace/components/InputAreaBottomToolbar.tsx) 的弹层体系内，以降低改造成本：

- 优先替换 [`showMainBrainInspector`](../../pages/Workspace/components/InputAreaBottomToolbar.tsx:2298) 对应内容
- 演进为带左侧导航的宽模态
- 后续如内容增长明显，再考虑独立路由页

原因：
- 已有入口稳定
- 与角色管理弹层心智一致
- 当前用户主要在 Workspace 内使用主脑配置

---

## 6. 低保真布局方案

### 6.1 整体框架

统一采用三段式结构：

1. 顶部标题栏
2. 左侧导航
3. 中间主编辑区 + 右侧说明区

推荐布局：
- 顶部：标题 / 状态 / 主按钮
- 左栏：8 个一级分区导航
- 中栏：当前分区主编辑内容
- 右栏：说明、影响范围、最近变更、摘要预览

### 6.2 Overview 低保真

顶部区：
- 页面标题：主脑配置中心
- 辅助说明：长期规则、记忆和低频自治在这里统一管理
- 右侧主按钮：初始化 / 查看最近变更

摘要卡区：
- 2 x 2 卡片
  - Soul 摘要
  - User 摘要
  - Workflow 摘要
  - Role Governance 摘要

运行状态区：
- 左：最近记忆
- 中：最近 Heartbeat
- 右：最近治理动作

风险待办区：
- 待确认记忆
- 冲突配置提醒
- 失败的 Heartbeat

### 6.3 Soul / User / Workflow 低保真

中栏：
- 分组卡片表单
- 每个分组 2-5 个字段
- 支持摘要预览而非长文本堆砌

右栏：
- 当前注入摘要预览
- 影响范围说明
- 最近一次变更时间

### 6.4 Memory 低保真

中栏：
- 顶部筛选条：待确认 / 已确认 / 最近提炼
- 左侧列表：记忆卡片
- 右侧详情：来源、分类、证据、操作按钮

右栏：
- 记忆进入运行时的摘要预览
- 风险说明：哪些不应长期记住

### 6.5 Heartbeat 低保真

中栏：
- 左：任务列表卡片
- 右：任务详情
  - 开关
  - 频率
  - 范围
  - 最近结果摘要
  - 风险边界说明

### 6.6 Bootstrap 低保真

中栏：
- 初始化状态卡
- 问卷分步表单
- 完成后生成初始 Soul / User / Workflow / Governance 默认值摘要

### 6.7 Audit 低保真

中栏：
- 审计列表
- 支持按资产类型筛选
- 支持跳转查看关联角色治理动作

右栏：
- 摘要 diff
- 风险提示
- 回滚说明

---

## 7. 视觉与交互规范

沿用当前角色管理体系的产品语言：

1. 卡片化分区，不做长页面连续表单
2. 页面主标题 20-24 / semibold
3. 区块标题 16-18 / semibold
4. 正文 14-16 / regular
5. 辅助说明 12-14 / regular
6. 圆角统一 12
7. 卡片内边距 16 或 24
8. 模块间距 24
9. 仅风险 / 待确认 / 回滚使用低饱和强调色
10. 操作按钮高度统一，避免每区块风格漂移

---

## 8. 与现有链路的对齐要求

### 8.1 与用户资产层对齐

新配置中心不得另起存储烟囱，必须扩展现有资产结构：

- 现有状态根：[`StudioUserAssetState`](../../services/runtime-assets/user-asset-types.ts:155)
- 现有主脑偏好资产：[`StudioMainBrainPreferencesAsset`](../../services/runtime-assets/user-asset-types.ts:53)

后续应在现有状态上扩展出结构化主脑资产，而不是继续依赖一组字符串行。

### 8.2 与角色治理对齐

Workflow 中必须直接承载角色治理默认策略，避免出现两套互相冲突的默认值。

### 8.3 与运行时对齐

后续 runtime 注入应复用现有“准备执行任务时统一汇入 metadata / prompt 层”的模式，不新增第三套注入路径。

---

## 9. 第一阶段实施结论

### 9.1 第 1 步结论

信息架构确认如下：

- Overview / Soul / User / Workflow / Memory / Heartbeat / Bootstrap / Audit

该结构满足方案要求，也与当前 UI/运行时边界兼容。

### 9.2 第 2 步结论

UI 挂载与低保真建议如下：

- 复用输入区现有主脑入口
- 用宽模态配置中心替换当前简单偏好弹层
- 输入区只留摘要与快速入口
- 复杂编辑放入左导航 + 中编辑区 + 右说明区的配置中心布局

### 9.3 下一步

进入资产模型扩展阶段：

1. 扩展账号资产模型
2. 扩展审计 targetKind
3. 扩展本地默认快照 / merge / sync / 写回
4. 再接 runtime 注入与 UI 初版
