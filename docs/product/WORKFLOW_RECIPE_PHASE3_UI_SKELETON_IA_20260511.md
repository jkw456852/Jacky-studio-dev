# Workflow Recipe Phase 3 UI Skeleton IA / UI Spec

日期：2026-05-11
阶段：Phase 3（导入 / 测试区 / 发布区骨架，已完成）
关联文档：
- `docs/product/WORKFLOW_RECIPE_NODE_PLATFORM_MASTER_PLAN_20260511.md`
- `services/workflow-recipes/importer.ts`
- `services/workflow-recipes/testing.ts`
- `services/workflow-recipes/publisher.ts`

---

## 1. 产品经理阶段

### 1.1 页面目标
在当前工作区内提供一套最小可用的 workflow recipe 管理骨架，让用户可以：
1. 导入 recipe 分享包
2. 在测试区查看校验结果并运行 smoke test
3. 在通过后执行发布
4. 查看已发布记录与回滚信息

### 1.2 用户主任务
主任务只有一个：
**把一个 recipe 从“外部包 / 草稿”推进到“可测试、可发布、可回滚”的受控状态。**

### 1.3 功能清单
高优先级：
1. 导入 JSON / 粘贴 JSON
2. 展示校验报告
3. 展示 compatibility gate 结果
4. 运行 smoke test
5. 展示测试结果 / 输出 / 错误
6. 发布 recipe
7. 展示 publish history / rollback history

中优先级：
1. 测试输入区域
2. 依赖 capability 清单
3. 只读 envelope 预览

低优先级：
1. 搜索与筛选
2. 多版本对比
3. 批量导入
4. 分享复制入口

### 1.4 功能优先级
- P0：导入、校验、测试、发布、回滚记录可见
- P1：测试输入编辑、输出预览、依赖清单
- P2：搜索、筛选、批量操作、版本对比

### 1.5 信息架构
一级区块：
1. Recipe 导入区
2. 测试区
3. 发布区 / 库区
4. 运行与历史摘要区

数据流顺序：
- 导入区 → 生成 import report
- 测试区 → 生成 testing report
- 发布区 → 生成 publish record
- 历史区 → 展示 publish / rollback 历史

### 1.6 应进入二级入口的功能
以下功能不应直接堆在首页主界面：
- 原始 JSON 全量预览
- 多版本差异对比
- 批量导入
- 高级依赖诊断
- 分享导出高级选项

---

## 2. UI 设计师阶段

### 2.1 页面区块划分
推荐采用左侧轻导航 + 右侧单主内容区：
1. 顶部标题栏：页面标题、当前 recipe id / version、主状态
2. 左侧标签导航：导入 / 测试 / 发布库
3. 主内容区：当前阶段唯一重点内容
4. 右侧次级信息栏：依赖、状态摘要、最近测试结果

### 2.2 模块布局建议

#### A. 导入页
- 顶部：页面标题 + 简短说明
- 主卡片 1：粘贴 / 上传 recipe JSON
- 主卡片 2：导入校验报告
- 侧边卡片：兼容闸门摘要、依赖 capability 列表

#### B. 测试页
- 主卡片 1：测试输入表单
- 主卡片 2：测试结果摘要（pass / fail / code）
- 主卡片 3：输出预览
- 次级折叠区：执行日志、步骤状态

#### C. 发布页
- 主卡片 1：发布前检查摘要
- 主卡片 2：发布结果 / 当前发布状态
- 主卡片 3：publish history
- 主卡片 4：rollback history

### 2.3 低保真线框说明

```text
┌──────────────────────────────────────────────┐
│ Recipe Lifecycle                             │
│ 当前状态: Testing / Published                │
├───────────────┬──────────────────────────────┤
│ 导入          │ [主卡片：导入 / 校验]        │
│ 测试区        │ [主卡片：输入 / 测试结果]    │
│ 发布库        │ [主卡片：发布 / 历史]        │
│               │                              │
│               │ [次级卡片：依赖 / 运行摘要]  │
└───────────────┴──────────────────────────────┘
```

### 2.4 视觉规范建议
- typography
  - 页面标题：20 / semibold
  - 模块标题：16 / semibold
  - 正文：14 / regular
  - 辅助说明：12 / regular
- spacing
  - 外层：24
  - 卡片内边距：16
  - 表单项间距：12
  - 区块间距：24
- colors
  - 中性色为主
  - 主色仅用于当前阶段高亮、成功状态、小面积强调
  - 成功 / 警告 / 错误使用低饱和语义色
- radius
  - 统一 12
- icon size
  - 16 为主，标题旁 18

### 2.5 容易混乱或拥挤的风险点
1. 同屏同时展示原始 JSON、校验报告、日志、输出，信息会爆炸
2. 导入 / 测试 / 发布按钮若同时突出，会失去主任务焦点
3. 历史记录若不做折叠或分页，右侧栏会过长
4. 错误详情若不限制换行和滚动，容易撑坏布局
5. dependencyChecks 若直接全量展开，低频信息会淹没主流程

---

## 3. 前端工程师阶段实施边界

### 3.1 本阶段只做骨架，不做完整接线
本阶段 UI 仅要求：
1. 面板结构到位
2. props 边界清晰
3. 状态展示骨架到位
4. 后续可直接接 `importer.ts` / `testing.ts` / `publisher.ts`

### 3.2 推荐组件拆分
- `pages/Workspace/components/workflow-recipes/RecipeLifecyclePanel.tsx`
- `pages/Workspace/components/workflow-recipes/RecipeImportPanel.tsx`
- `pages/Workspace/components/workflow-recipes/RecipeTestPanel.tsx`
- `pages/Workspace/components/workflow-recipes/RecipeLibraryPanel.tsx`
- `pages/Workspace/components/workflow-recipes/RecipeRuntimeInspector.tsx`
- `pages/Workspace/components/workflow-recipes/recipeLifecycle.types.ts`

### 3.3 布局策略
- 复用现有左侧侧栏挂载方式，不新发明第二套容器
- 统一使用卡片式块布局
- 导入 / 测试 / 发布使用 tabs 切换，避免三屏并列挤压
- 右侧 inspector 仅显示摘要，不承载主操作

---

## 4. 代码审阅阶段预设检查点
- 不允许页面直接调用底层 capability 执行细节
- 不允许把 import / test / publish 状态散落在多个无关组件
- 不允许新发明与 `WorkflowRecipeImportReport`、`WorkflowRecipeTestingRecord`、`WorkflowRecipePublishRecord` 重叠的私有结构
- 所有空状态 / 错误态 / 禁用态必须预留

---

## 5. 设计审稿阶段预设检查点
- 首页只有一个主要操作焦点
- 低频信息不与主任务抢注意力
- 状态标签、时间、版本号对齐一致
- 长错误信息、长 recipeId、长 capabilityId 要支持换行或截断
- 面板标题、按钮、辅助文案层级必须稳定
