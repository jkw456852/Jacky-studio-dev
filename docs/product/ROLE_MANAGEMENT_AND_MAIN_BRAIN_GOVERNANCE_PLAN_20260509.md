# 产品级角色管理与主脑角色治理方案

日期：2026-05-09  
状态：第 1-4 步设计稿  
范围：角色库、主脑治理权限、角色路由、角色编辑器、审计与发布

---

## 1. 背景与问题定义

当前系统中的“角色”并不是独立产品实体，而是三类机制的组合：

1. 固定内置专家角色
2. 用户长期补充层
3. 最近一次临时角色草案

这套机制可以支持：
- 主脑做专家路由
- 临时角色增强
- 用户补充长期提示词

但它不能支持真正的产品级角色管理，原因包括：
- 没有独立角色实体 ID
- 没有生命周期：草稿 / 发布 / 归档
- 没有版本、审计、回滚
- 没有角色级工具权限与路由策略
- 主脑只有“路由权”，没有“角色治理权”

因此，当前 UI 中的“保存为正式角色”并不是真创建角色，而只是把临时草案合并进某个内置专家的长期补充层。

---

## 2. 第 1 步：产品经理

### 2.1 页面目标

构建一套真正可维护、可审计、可发布、可被主脑治理的角色系统，使用户能够：
- 创建自定义角色
- 管理角色库
- 控制主脑对角色的治理权限
- 将临时角色升级为长期角色
- 在聊天、出图、视频、工作流中复用角色

### 2.2 用户主任务

1. 创建新的自定义角色
2. 编辑角色能力、边界、提示词和工具权限
3. 选择某个角色执行当前任务
4. 查看主脑本轮如何选角、增强或创建临时角色
5. 将临时角色升级为正式角色
6. 回滚角色到历史版本
7. 限制主脑是否允许自动改角色

### 2.3 功能清单

#### 高优先级
- 角色库列表
- 新建自定义角色
- 角色编辑器
- 角色启用 / 停用 / 归档
- 角色版本记录
- 临时角色升级为正式角色
- 主脑角色治理权限控制
- 主脑路由到自定义角色

#### 中优先级
- 角色标签、分组、搜索
- 角色克隆
- 角色效果预览
- 路由偏好与优先级配置
- 角色引用关系（基于哪个内置专家）

#### 低优先级
- 角色分享
- 角色导入导出
- 多人审批流
- 角色实验环境

### 2.4 功能优先级判断

P0 必须先做：
- 角色实体化
- 路由打通
- 主脑治理权限模型

如果没有这三项：
- UI 再精致也只是补充层编辑器
- 主脑再聪明也只能临时拼接 prompt
- 用户无法真正拥有长期角色资产

### 2.5 信息架构

#### 一级信息架构
1. 角色库
2. 当前会话角色
3. 主脑治理
4. 版本与审计
5. 全局策略

#### 二级信息架构

**角色库**
- 系统角色
- 我的角色
- 临时角色
- 已归档角色

**当前会话角色**
- 自动路由
- 固定角色
- 本轮角色脑
- 临时增强

**主脑治理**
- 只读
- 可创建临时角色
- 可生成长期草案
- 可自动治理

**版本与审计**
- 发布记录
- Diff 对比
- 回滚
- 风险说明

**全局策略**
- 默认路由策略
- 主脑治理权限默认值
- 是否需要人工确认
- 是否允许自动发布

### 2.6 哪些功能进入二级入口，避免首页堆叠

不应直接堆在输入区首页：
- 最终提示词长文本预览
- 角色完整版本历史
- 角色审计日志
- Prompt diff
- 归档角色管理
- 主脑治理权限细项

输入区首页只保留：
- 当前角色
- 快速切换
- 新建角色
- 查看本轮角色脑

---

## 3. 第 2 步：定位主脑对角色管理权限不足的根因

### 3.1 根因一：角色不是实体，只是补充文本

当前长期层和临时层都围绕固定专家工作，没有真正的 Role 实体。  
主脑能管理的是：
- 选哪个内置专家
- 给这个专家临时拼一段角色覆盖文本

主脑不能管理的是：
- 创建长期存在的角色
- 发布角色版本
- 归档角色
- 变更角色工具权限
- 调整角色路由标签

### 3.2 根因二：能力注册里没有角色治理技能

主脑当前能力表主要包含：
- 内部模块 awareness
- 可执行 skills
- specialist-agent 路由目标

专家角色目前只是路由目标，不是治理对象。  
缺少可执行的角色治理技能，例如：
- `roleLibraryRead`
- `roleDraftCreate`
- `roleDraftUpdate`
- `rolePromote`
- `roleArchive`
- `roleBindToTask`

### 3.3 根因三：请求元数据只支持固定专家

当前发送链路只支持：
- `agentSelectionMode`
- `pinnedAgentId`

这意味着系统天然假设执行目标一定是固定内置专家之一，而不是“角色实体 + 执行壳”。

### 3.4 根因四：预处理阶段有固定白名单

预处理链路里对手动固定角色使用固定白名单判断，会阻止任何用户自定义角色进入执行链路。

### 3.5 根因五：运行时角色层是任务级易失层

当前运行时角色增强只在本轮任务中附加 prompt，不具备：
- 资产化
- 生命周期
- 审计
- 发布
- 版本化

### 3.6 根因六：远端资产 API 没有角色库同步契约

当前远端同步只兼容旧资产结构，没有角色库 CRUD 和角色版本同步协议。即使本地做出角色实体，也无法完成项目级 / 账号级同步闭环。

---

## 4. 第 3 步：角色实体模型、主脑授权模型与存储接口扩展

### 4.1 核心原则

必须把“执行壳”和“角色实体”拆开：
- 执行壳：继续使用现有内置专家能力集合
- 角色实体：描述这个壳以什么身份、边界、偏好和工具策略工作

### 4.2 角色实体模型

```ts
export type RoleSource = 'system' | 'user' | 'temporary' | 'promoted';
export type RoleStatus = 'draft' | 'active' | 'archived';
export type RoleGovernanceMode =
  | 'manual_only'
  | 'draft_only'
  | 'approval_required'
  | 'auto_manage';

export interface StudioRoleEntity {
  id: string;
  slug: string;
  title: string;
  summary: string;
  baseAgentId: AgentType;
  source: RoleSource;
  status: RoleStatus;
  tags: string[];
  useWhen: string[];
  avoidWhen: string[];
  toolPolicy: {
    allowedSkills?: string[];
    blockedSkills?: string[];
    canRouteSubtasks: boolean;
    canUseNetworkResearch: boolean;
  };
  routingPolicy: {
    priority: number;
    keywords: string[];
    preferredTaskModes: string[];
    autoRouteEligible: boolean;
  };
  promptLayers: {
    systemBaseline: string;
    mainBrainShared: string;
    durableRoleAddon: string;
  };
  governance: {
    mode: RoleGovernanceMode;
    requiresHumanApproval: boolean;
    allowMainBrainPromotion: boolean;
    allowMainBrainArchive: boolean;
  };
  version: number;
  createdAt: number;
  updatedAt: number;
}
```

### 4.3 临时角色草案模型

```ts
export interface StudioTemporaryRoleDraft {
  id: string;
  targetRoleId?: string | null;
  targetBaseAgentId: AgentType;
  title: string;
  summary: string;
  instructions: string[];
  roleStrategy: 'reuse' | 'augment' | 'create';
  roleStrategyReason: string;
  sourceTaskId?: string;
  sourceConversationId?: string;
  promotionSuggested: boolean;
  promotedRoleId?: string | null;
  createdAt: number;
  updatedAt: number;
}
```

### 4.4 角色版本模型

```ts
export interface StudioRoleVersionRecord {
  id: string;
  roleId: string;
  version: number;
  changeType: 'create' | 'update' | 'promote' | 'archive' | 'rollback';
  summary: string;
  diffPreview?: string;
  snapshot: StudioRoleEntity;
  actor: 'user' | 'main_brain' | 'system';
  createdAt: number;
}
```

### 4.5 请求元数据升级方案

当前 metadata 需要从：
- `pinnedAgentId`

升级为：
- `selectedRoleId`
- `selectedRoleSource`
- `baseAgentId`
- `roleGovernanceMode`
- `allowMainBrainRoleMutation`
- `allowMainBrainRolePromotion`

### 4.6 主脑授权模型

定义四档权限：

#### Level 0：只读
- 读取角色库
- 做路由
- 不可写任何角色资产

#### Level 1：临时写
- 可生成临时角色草案
- 可给当前任务附加临时角色层
- 不可写入长期角色库

#### Level 2：待审写
- 可创建长期角色草案
- 可提出升级建议
- 需要用户确认后发布

#### Level 3：自动治理
- 可自动创建长期角色
- 可自动更新角色版本
- 可归档低质量角色
- 必须记录审计与回滚点

默认推荐：**Level 2：待审写**。

### 4.7 存储接口扩展

在用户资产 API 中新增真正的角色库接口：

```ts
interface StudioUserAssetApi {
  listRoles(): StudioRoleEntity[];
  getRoleById(roleId: string): StudioRoleEntity | null;
  saveRole(role: Partial<StudioRoleEntity>, options?: { preferredId?: string }): StudioRoleEntity | null;
  archiveRole(roleId: string): StudioUserAssetState;
  duplicateRole(roleId: string): StudioRoleEntity | null;
  saveTemporaryRoleDraft(draft: Partial<StudioTemporaryRoleDraft>): StudioTemporaryRoleDraft | null;
  promoteTemporaryRole(draftId: string, options?: { targetRoleId?: string | null }): StudioRoleEntity | null;
  listRoleVersions(roleId: string): StudioRoleVersionRecord[];
  rollbackRoleVersion(roleId: string, version: number): StudioRoleEntity | null;
}
```

### 4.8 状态结构扩展

用户资产状态新增：

```ts
interface StudioUserAssetState {
  roles: Record<string, StudioRoleEntity>;
  temporaryRoleDrafts: Record<string, StudioTemporaryRoleDraft>;
  roleVersions: Record<string, StudioRoleVersionRecord[]>;
  roleAuditEntries: Record<string, StudioRoleVersionRecord[]>;
}
```

### 4.9 主脑能力扩展

新增角色治理能力组：
- `roleLibraryRead`
- `roleDraftCreate`
- `roleDraftUpdate`
- `rolePromote`
- `roleArchive`
- `roleBindToTask`
- `roleSuggestReplacement`

规则：
- specialist-agent 仍然是 routing targets
- role governance 才是 executable skills

---

## 5. 第 4 步：UI 设计师

### 5.1 页面区块划分

#### A. 输入区轻入口
保留：
- 当前角色名称
- 自动 / 固定切换
- 新建角色按钮
- 查看本轮角色脑按钮

移除出首页：
- 长文本最终 prompt 预览
- 全局偏好大编辑区
- 复杂版本历史

#### B. 角色管理全屏面板
三栏结构：

**左栏：角色列表**
- 系统角色
- 我的角色
- 临时角色
- 已归档
- 搜索 / 标签筛选

**中栏：角色详情**
- 角色名称
- 说明
- 基于哪个专家壳
- 适用 / 不适用场景
- 标签
- 路由资格
- 工具权限
- 主脑治理权限

**右栏：提示词与版本**
- 系统基线
- 主脑共享层
- 角色长期层
- 临时覆盖层
- 最终预览
- 版本历史
- Diff 对比

#### C. 主脑治理面板
独立区块展示：
- 当前权限等级
- 自动治理开关
- 需人工确认开关
- 主脑最近角色治理动作
- 风险提示与回滚入口

### 5.2 模块布局建议

- 左栏宽度：280-320
- 中栏宽度：360-420
- 右栏自适应
- 主编辑区域卡片统一圆角 12
- 标题层级控制在 4 档内
- 模块间距统一 24
- 卡片内边距统一 16 / 24

### 5.3 低保真线框说明

#### 角色管理首页
- 顶部：页面标题 + 新建角色 + 搜索
- 左侧角色列表：按来源分组
- 中间详情：基础信息 / 权限 / 路由
- 右侧：提示词 / 版本 / Diff

#### 会话中的角色切换器
- 当前角色 chip
- 自动路由说明
- 本轮角色脑摘要
- “进入角色库”按钮

#### 临时角色升级弹层
- 显示草案标题 / 摘要 / 指令
- 选择：覆盖已有角色 / 新建为独立角色
- 选择主脑权限策略
- 展示发布后影响范围

### 5.4 设计 token 建议

#### Typography
- 页面标题：20 / semibold
- 区块标题：16 / semibold
- 正文：14 / regular
- 辅助文案：12 / regular

#### Spacing
- 外层：24 / 32
- 卡片内：16 / 24
- 表单项：12 / 16
- 图标与文字：8

#### Colors
- 主色：低饱和蓝灰
- 成功：低饱和绿
- 风险：低饱和橙
- 危险：低饱和红
- 主背景：中性浅灰白

#### Radius
- 主卡片：12
- 小型胶囊：999
- 输入框：12

#### Icon size
- 列表：16
- 一级操作：18
- 辅助状态：14

### 5.5 风险点

高风险：
- 把“角色编辑”“主脑治理”“全局偏好”继续塞在一个模态里，会继续混乱
- 把“临时草案”和“长期角色”视觉权重做得一样，会误导用户
- 如果没有清晰区分“执行壳”和“角色实体”，用户会始终搞不懂自己到底改了谁

中风险：
- 右侧 prompt 预览过长，容易挤压主要编辑区
- 版本历史和 Diff 同时常驻会导致页面信息过载

低风险：
- 标签过多会显得拥挤，应限制最多显示 3-5 个，更多进入展开区

---

## 6. 前端实现前的组件结构拆分建议

### 6.1 组件拆分

- `RoleManagementDrawer`
- `RoleLibrarySidebar`
- `RoleListSection`
- `RoleDetailPanel`
- `RolePromptEditorPanel`
- `RoleVersionTimeline`
- `RoleDiffViewer`
- `RoleGovernancePanel`
- `TemporaryRolePromotionDialog`
- `ConversationRoleSwitcher`
- `ActiveRoleBadge`

### 6.2 控制器拆分

- `useRoleLibraryState`
- `useRoleEditorState`
- `useRoleGovernanceState`
- `useTemporaryRolePromotion`
- `useConversationRoleSelection`

### 6.3 布局策略

- 输入区只保留轻交互
- 完整角色编辑进入独立抽屉 / 全屏层
- 所有长文本区域必须支持滚动与折叠
- 所有标题、角色名、标签必须处理超长截断

---

## 7. 实施顺序

### P0：数据层与权限层
1. 新增角色实体与版本模型
2. 扩展本地用户资产 API
3. 扩展远端同步契约
4. 定义主脑治理权限模型

### P1：路由与执行层
1. 升级请求 metadata
2. 去除固定角色白名单限制
3. 让执行链路支持 `selectedRoleId + baseAgentId`
4. 让运行时角色层支持正式角色版本信息

### P2：主脑治理能力
1. 注册角色治理 skills
2. 改主脑共享指令
3. 改主脑路由 prompt
4. 增加主脑治理审计输出

### P3：UI 重构
1. 抽离输入区复杂角色编辑能力
2. 落地独立角色管理面板
3. 落地角色版本 / 审计 / 发布流
4. 落地临时角色升级流程

### P4：验证
1. 本地构建验证
2. 路由闭环验证
3. 主脑治理权限验证
4. 远端同步验证
5. 角色升级 / 回滚验证

---

## 8. 验收标准

以下任一情况出现，视为未通过：
- 用户新增角色后，主脑仍无法路由到该角色
- “保存为正式角色”仍然只是改补充层
- 主脑可以改角色，但没有审计与回滚
- UI 无法清楚区分系统角色、我的角色、临时角色
- 角色编辑器仍然与全局偏好混在一个高拥挤模态里
- 角色信息、长标题、提示词预览出现溢出或布局错乱

通过标准：
- 角色成为真正资产实体
- 主脑具备清晰可控的角色治理权限
- 用户可以创建、编辑、发布、归档、回滚角色
- 临时角色可以明确升级为正式角色
- UI 达到产品级秩序感，而不是提示词编辑 demo

---

## 9. 下一步实施建议

下一轮建议按以下顺序进入实现：

1. 先扩展角色数据模型与用户资产接口
2. 再打通发送 metadata 与执行链路
3. 然后增加主脑角色治理能力注册与策略
4. 最后重做角色管理 UI

这一步完成后，系统才会从“角色补充层”升级为真正的“产品级角色管理系统”。
