# 工作流配方节点平台 + 原子能力体系总实施计划

最后更新：2026-05-11

关联文档：
- [`WORKFLOW_RECIPE_NODE_PLATFORM_IMPLEMENTATION_PLAN_20260511.md`](docs/product/WORKFLOW_RECIPE_NODE_PLATFORM_IMPLEMENTATION_PLAN_20260511.md)
- [`UNIVERSAL_VISUAL_ORCHESTRATION_PLAN_20260427.md`](docs/product/UNIVERSAL_VISUAL_ORCHESTRATION_PLAN_20260427.md)
- [`MAIN_BRAIN_CAPABILITY_MANIFEST_REFACTOR_PLAN_20260509.md`](docs/product/MAIN_BRAIN_CAPABILITY_MANIFEST_REFACTOR_PLAN_20260509.md)
- [`MAIN_BRAIN_EXPLICIT_CONFIGURATION_MEMORY_HEARTBEAT_PLAN_20260509.md`](docs/product/MAIN_BRAIN_EXPLICIT_CONFIGURATION_MEMORY_HEARTBEAT_PLAN_20260509.md)

---

## 1. 文档目标

这份计划不是补一个新功能，而是给项目建立一套统一的长期架构，解决以下根问题：

1. 新能力接入分散，入口东一块西一块。
2. 工作流、技能、画板节点、分享包之间没有统一协议。
3. 业务功能越多，越依赖特例控制器和硬编码流程。
4. 运行时主脑、外部智能体、画板节点、技能执行器之间缺少标准分工。
5. 如果后续要覆盖类似 [`XcAI AI Studio`](https://github.com/xiaoche0907/XcAi-ai-studio) 这类完整平台能力，没有原子能力目录就会持续失控。

本计划的核心任务是把现有项目升级成：

- **画板 = 容器**
- **节点 = 标准模块实例**
- **原子能力 = 唯一真值源**
- **配方 = 工作流 DSL**
- **外部 AI / 开发工具 = 配方设计器**
- **主脑 = 配方与节点的使用者 / 编排者 / 解释者**
- **平台 = 校验、执行、测试、发布、分享的治理中心**

---

## 2. 最终目标形态

### 2.1 用户视角

最终用户可以：

1. 在画板里拖入一个工作流节点。
2. 给节点传入图片、文本、参数。
3. 让节点自动执行多步配方。
4. 把结果回写到画板、消息区或下游节点。
5. 导出这个节点或整条配方。
6. 导入别人分享的节点包，在测试区先验证，再正式发布使用。
7. 直接告诉主脑“我想实现什么效果的工作流”，由主脑基于已有原子能力目录、配方 DSL 与节点模板先产出可测试的工作流草案，再由平台导入测试区验证、发布和复用。

### 2.2 系统视角

系统内部会稳定分成 6 个层次：

1. 原子能力目录层
2. 配方 DSL 层
3. 节点实例层
4. 画板容器层
5. 执行治理层
6. 分享与发布层

---

## 3. 核心原则

### 3.0 最高优先级架构红线

这一条高于一切功能目标：

**绝对禁止分散实现，绝对禁止同类能力多入口、多协议、多状态机、多套调用方式长期并存。**

后续所有设计与开发都必须围绕以下目标约束：

1. 边界清晰
- 每一层只能做自己该做的事。
- 页面层不允许兼做能力编排层。
- 配方层不允许兼做底层执行器。
- 主脑不允许兼做平台结构改写器。

2. 接口规范
- 同类能力必须共享统一输入输出协议。
- 同类状态必须共享统一状态机。
- 同类导入导出必须共享统一包结构。
- 禁止为了赶进度给单个功能单独发明一套私有字段和私有流程。

3. 单一真值源
- 能力目录只有一份。
- 配方 DSL 只有一份。
- 节点实例模型只有一份。
- 分享包 schema 只有一份。
- 校验与执行入口只有一份。

4. 调用必须简单
- 上层调用下层时必须通过稳定 facade / registry / executor，不允许跨层直连零散实现。
- 新增一个功能时，不应该要求开发者同时修改大量页面、控制器、状态、提示词和脚本。
- 理想状态是：新增能力只需“注册能力 + 补 schema + 补测试 + 接入目录”。

5. 新增 / 修改 / 维护成本必须可控
- 任何新原子能力接入都必须走固定流水线：适配器 → 目录注册 → schema → validator → executor → smoke test。
- 任何新节点接入都必须走固定流水线：recipe → 导入校验 → 测试区 → 发布区 → 分享包。
- 如果一个功能的接入需要到处改代码，说明架构已经失控，必须先重构再继续加功能。

6. 允许局部失败，禁止系统性瘫痪
- 单个能力失效时，影响必须被隔离在能力层或节点层，不能波及整个工作区主链路。
- 单个 recipe 导入失败时，只能阻止该 recipe 发布，不能污染现有节点库。
- 单个原子能力升级时，必须通过兼容层、版本字段、依赖校验来避免全局报错。

### 3.0.1 强制执行规则

后续实现时，必须把下面这些作为硬性红线：

- 禁止页面层直接调用多个散落 skill 拼业务流程。
- 禁止 controller 私自维护一套 recipe 状态机。
- 禁止同类能力在不同地方出现不同命名、不同输入字段、不同输出结构。
- 禁止新功能绕过能力目录直接暴露给主脑、节点或分享层。
- 禁止未通过 schema / smoke test 的能力或 recipe 进入正式库。
- 禁止“先临时写死，后面再统一”长期存在。

### 3.1 配方优先，插件后置

第一阶段不做任意代码插件平台。

正确顺序：
1. 先统一原子能力。
2. 再统一配方 DSL。
3. 再让配方实例化为节点。
4. 最后只把高频成熟配方升级为正式插件。

### 3.2 节点只能编排白名单能力

节点不是任意脚本。

节点只能调用在能力目录中注册过的原子能力，例如：
- 生图
- 编辑
- OCR
- 搜索
- 分析
- 工作流适配器

### 3.3 运行时主脑不允许直接创造永久节点

主脑职责：
- 识别需求
- 选择能力
- 调用节点
- 解释结果
- 生成配方草案建议

主脑不负责：
- 直接改平台结构
- 直接落永久节点资产
- 直接安装新执行器

### 3.4 所有协议标准化

必须建立唯一真值源：
- 原子能力目录只有一份
- 配方 DSL 只有一份
- 节点实例状态机只有一份
- 分享包 schema 只有一份
- 导入校验流程只有一份

### 3.5 兼容现有工作区，渐进替换

不推翻现有 [`CanvasElement`](types/common.ts:75) 和现有工作区生成链路。

第一阶段采用：
- 旁挂数据模型
- 适配器接入
- 新旧共存

---

## 4. 为什么必须先补原子能力目录

如果直接做节点和配方，而不先统一原子能力，后果是：

1. 配方内部会直接引用散乱的页面控制器。
2. 节点可复用性极差。
3. 导入别人配方时无法判断依赖。
4. 测试区无法判断这个节点到底缺什么。
5. 后续分享生态一定炸。

所以原子能力目录不是“锦上添花”，而是整个节点平台的地基。

---

## 5. 目标能力覆盖范围

如果目标是未来覆盖类似 [`XcAI AI Studio`](https://github.com/xiaoche0907/XcAi-ai-studio) 的完整功能，需要把平台能力统一抽象成以下 12 个能力域：

1. `asset.*`
2. `vision.*`
3. `research.*`
4. `planning.*`
5. `image.*`
6. `fashion.*`
7. `commerce.*`
8. `video.*`
9. `copy.*`
10. `workflow.*`
11. `canvas.*`
12. `package.*` / `governance.*` / `trace.*`

这 12 组能力域不是一次全做完，而是作为唯一长期能力地图。

---

## 6. 原子能力体系设计

建议统一命名规范：

- `domain.verb.object`

例如：
- `vision.analyze.product`
- `vision.ocr.extract-text`
- `image.generate.multi-reference`
- `image.edit.background-replace`
- `research.search.web`
- `workflow.execute.recipe`
- `canvas.write.result-asset`
- `package.export.recipe`

### 6.1 A. 资产输入与预处理域 `asset.*`

负责一切输入接入和预处理。

必须能力：
- `asset.ingest.image`
- `asset.ingest.video`
- `asset.ingest.url`
- `asset.normalize.image`
- `asset.normalize.video`
- `asset.crop.region`
- `asset.bundle.attachments`
- `asset.rehost.public-url`
- `asset.persist.session`

### 6.2 B. 视觉理解域 `vision.*`

负责所有识别、结构化理解、参考图分析。

必须能力：
- `vision.analyze.product`
- `vision.analyze.region`
- `vision.extract.attributes`
- `vision.detect.material-color-fit`
- `vision.extract.anchor-constraints`
- `vision.ocr.extract-text`
- `vision.compare.multi-image`
- `vision.score.reference-quality`
- `vision.detect.brand-elements`

### 6.3 C. 研究域 `research.*`

负责市场搜索、竞品抓取、页面提取、市场分析。

必须能力：
- `research.search.web`
- `research.search.images`
- `research.extract.page`
- `research.collect.competitor-assets`
- `research.cluster.keywords`
- `research.summarize.market-gap`
- `research.rank.opportunities`
- `research.build.positioning-brief`

### 6.4 D. 规划域 `planning.*`

负责把用户目标转成结构化计划对象。

必须能力：
- `planning.parse.user-intent`
- `planning.plan.visual-system`
- `planning.plan.image-sequence`
- `planning.plan.a-plus-layout`
- `planning.plan.storyboard`
- `planning.plan.copy-structure`
- `planning.plan.recipe`
- `planning.expand.prompt`
- `planning.apply.brand-constraints`
- `planning.self-check.output`

### 6.5 E. 图片生成与编辑域 `image.*`

负责所有核心视觉产出。

必须能力：
- `image.generate.single`
- `image.generate.batch`
- `image.generate.multi-reference`
- `image.generate.subject-consistency`
- `image.edit.replace`
- `image.edit.remove`
- `image.edit.recolor`
- `image.edit.background-replace`
- `image.edit.upscale`
- `image.edit.local-retouch`
- `image.compose.layout`
- `image.protect.brand-elements`

### 6.6 F. 服装 / 模特 / 试穿域 `fashion.*`

为“模特换装节点”这种复杂垂直能力做独立原子层。

必须能力：
- `fashion.analyze.garment`
- `fashion.analyze.model`
- `fashion.extract.tryon-constraints`
- `fashion.generate.model`
- `fashion.compose.tryon`
- `fashion.repair.tryon-artifacts`
- `fashion.rank.tryon-results`

### 6.7 G. 电商生产域 `commerce.*`

负责电商视觉、A+、卖点图、平台适配。

必须能力：
- `commerce.plan.page-types`
- `commerce.plan.selling-points`
- `commerce.plan.a-plus-modules`
- `commerce.plan.image-sequence`
- `commerce.generate.listing-copy`
- `commerce.generate.a-plus-copy`
- `commerce.generate.image-prompts`
- `commerce.review.compliance`
- `commerce.review.platform-fit`

### 6.8 H. 视频域 `video.*`

负责从脚本到视频交付。

必须能力：
- `video.plan.script`
- `video.plan.storyboard`
- `video.plan.shot-list`
- `video.generate.clip`
- `video.generate.multi-shot`
- `video.edit.sequence`
- `video.compose.subtitles`
- `video.compose.music-voice`
- `video.export.delivery`

### 6.9 I. 文案域 `copy.*`

负责创意、卖点、脚本、平台文案。

必须能力：
- `copy.generate.headline`
- `copy.generate.selling-points`
- `copy.generate.a-plus-section`
- `copy.generate.video-script`
- `copy.localize.multi-language`
- `copy.rewrite.platform-tone`

### 6.10 J. 工作流域 `workflow.*`

负责 recipe 执行、步骤调度、输出路由。

必须能力：
- `workflow.instantiate.recipe`
- `workflow.validate.schema`
- `workflow.bind.inputs`
- `workflow.route.outputs`
- `workflow.execute.step`
- `workflow.handle.error`
- `workflow.retry.policy`
- `workflow.persist.runtime-state`
- `workflow.publish.node`
- `workflow.share.package`

### 6.11 K. 画板交互域 `canvas.*`

负责节点和画布对象的连接。

必须能力：
- `canvas.create.workflow-node`
- `canvas.bind.parent-child`
- `canvas.bind.data-edge`
- `canvas.mount.input-panel`
- `canvas.render.node-status`
- `canvas.write.result-asset`
- `canvas.inspect.runtime`
- `canvas.export.selection`

### 6.12 L. 打包 / 治理 / 观测域 `package.*` `governance.*` `trace.*`

负责导入导出、版本、校验、可观测性。

必须能力：
- `package.export.recipe`
- `package.import.recipe`
- `package.validate.compatibility`
- `package.resolve.dependencies`
- `package.publish.library`
- `package.share.external`
- `governance.capability-whitelist`
- `governance.recipe-approval`
- `governance.publish-gate`
- `trace.capture.execution`
- `trace.capture.input-output`
- `trace.capture.failure`
- `audit.record.recipe-change`
- `audit.rollback.recipe`

---

## 7. 我们当前已有的能力底座

现有系统并非从零开始，已经具备关键底座：

- 搜索：[`workspaceSearchSkill()`](services/skills/workspace-search.skill.ts:113)
- OCR：[`extractTextFromImage()`](services/gemini.ts:2165)
- 区域分析：[`analyzeImageRegion()`](services/gemini.ts:2099)
- 图片生成：[`generateImage()`](services/gemini.ts:3290)
- 视频生成：[`generateVideo()`](services/gemini.ts:3546)
- 图片编辑：[`smartEditSkill()`](services/skills/smart-edit.skill.ts:46)、[`touchEditSkill()`](services/skills/touch-edit.skill.ts:4)
- 插件资产模型：[`StudioPluginAsset`](services/runtime-assets/types.ts:42)
- 插件读取：[`getStudioPluginAsset()`](services/runtime-assets/studio-registry.ts:63)
- 分享基础：[`buildPluginSharePackage()`](services/runtime-assets/sharing.ts:177)
- 浏览器工具注册：[`registerBrowserTool()`](services/browser-agent/tool-registry.ts:54)
- 画板节点关系：[`resolveNodeGraphPlacement()`](pages/Workspace/workspaceNodeGraph.ts:68)
- 视觉编排计划对象思路：[`VisualTaskIntent`](docs/product/UNIVERSAL_VISUAL_ORCHESTRATION_PLAN_20260427.md:105)

所以这次规划重点不是“再加一堆能力”，而是把这些已有能力收敛成统一目录与统一协议。

---

## 8. 平台目录重组方案

必须建立专门域，禁止继续零散扩散。

建议新增：

```txt
/types
  capability-catalog.types.ts
  workflow-recipe.types.ts
  workflow-node.types.ts
  workflow-runtime.types.ts
  workflow-package.types.ts

/services/capability-catalog
  registry.ts
  registry.test.ts
  adapters/
    skill-capability.adapter.ts
    browser-tool-capability.adapter.ts
    workflow-capability.adapter.ts

/services/workflow-recipes
  validator.ts
  validator.test.ts
  executor.ts
  executor.test.ts
  runtime-state.ts
  importer.ts
  importer.test.ts
  publisher.ts
  publisher.test.ts
  serializer.ts
  serializer.test.ts
  sample-recipes/
    fashion-model-tryon.recipe.json

/services/workflow-node-library
  registry.ts
  registry.test.ts
  share.ts
  share.test.ts

/pages/Workspace/components/workflow-recipes
  RecipeImportPanel.tsx
  RecipeTestPanel.tsx
  RecipeLibraryPanel.tsx
  RecipeRuntimeInspector.tsx
  WorkflowNodeCard.tsx

/pages/Workspace/controllers
  useWorkflowRecipeImport.ts
  useWorkflowRecipeExecution.ts
  useWorkflowRecipeLibrary.ts
  useWorkflowNodeCanvasBridge.ts
```

组织规则：
1. 原子能力只允许进 [`registry.ts`](services/capability-catalog/registry.ts)
2. 配方执行只允许从 [`executeWorkflowRecipeInstance()`](services/workflow-recipes/executor.ts) 进入
3. 导入导出只允许走 [`importer.ts`](services/workflow-recipes/importer.ts) / [`serializer.ts`](services/workflow-recipes/serializer.ts)
4. 画板层不允许再直接拼散乱 skill 组合
5. UI 不允许越过配方执行层直接触达底层能力实现

---

## 9. 配方 DSL 设计

### 9.1 顶层定义

建议新增 [`WorkflowRecipeDefinition`](types/workflow-recipe.types.ts)：

```ts
export interface WorkflowRecipeDefinition {
  schemaVersion: 1;
  recipeId: string;
  version: string;
  title: string;
  summary: string;
  category: 'visual-edit' | 'visual-generate' | 'analysis' | 'workflow' | 'other';
  tags: string[];
  status: 'draft' | 'testing' | 'published' | 'archived';
  inputs: WorkflowRecipeInputField[];
  outputs: WorkflowRecipeOutputField[];
  steps: WorkflowRecipeStep[];
  ui: WorkflowRecipeUiSchema;
  constraints: WorkflowRecipeConstraintSet;
  sharing: WorkflowRecipeShareMeta;
}
```

### 9.2 输入输出类型

一期统一只支持：
- `image`
- `image_list`
- `text`
- `number`
- `boolean`
- `enum`
- `json`

禁止：
- 任意可执行脚本
- 任意 eval
- 无 schema 的动态对象

### 9.3 步骤定义

```ts
export interface WorkflowRecipeStep {
  stepId: string;
  type: 'capability' | 'transform' | 'condition' | 'output';
  title: string;
  capabilityRef?: string;
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
  runWhen?: WorkflowRecipeCondition;
  onError?: 'stop' | 'skip' | 'fallback';
  fallbackStepId?: string;
}
```

### 9.4 参数映射规则

只允许：
- `inputs.xxx`
- `steps.stepId.outputs.xxx`
- `context.xxx`
- `constants.xxx`

不允许：
- 任意 JS 表达式
- 任意函数体

---

## 10. 能力目录实现方案

建议新增 [`RecipeCapabilityDefinition`](types/capability-catalog.types.ts)：

```ts
export interface RecipeCapabilityDefinition {
  id: string;
  label: string;
  domain:
    | 'asset'
    | 'vision'
    | 'research'
    | 'planning'
    | 'image'
    | 'fashion'
    | 'commerce'
    | 'video'
    | 'copy'
    | 'workflow'
    | 'canvas'
    | 'package'
    | 'governance'
    | 'trace';
  kind: 'skill' | 'browser-tool' | 'workflow-adapter' | 'internal-service';
  summary: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  safeForRecipe: boolean;
  executorRef: string;
  tags: string[];
  deprecated?: boolean;
  replacedBy?: string;
}
```

### 10.1 目录接入顺序

任何能力想进入 recipe 白名单，必须按顺序完成：
1. 实现执行器或 adapter
2. 注册到能力目录
3. 补 input/output schema
4. 补校验测试
5. 补执行测试
6. 才允许 recipe 引用

### 10.2 能力来源统一

- skill 能力：适配到目录
- browser tool 能力：适配到目录
- 复杂专用工作流：先写 adapter，再适配到目录

原则：recipe 永远不能直接依赖页面 controller。

---

## 11. 节点实例模型

不建议把所有状态都塞进 [`CanvasElement`](types/common.ts:75)。

建议旁挂独立实例表，新增 [`WorkflowNodeInstance`](types/workflow-node.types.ts)：

```ts
export interface WorkflowNodeInstance {
  nodeId: string;
  recipeId: string;
  recipeVersion: string;
  title: string;
  status: 'idle' | 'configured' | 'running' | 'success' | 'failed' | 'cancelled';
  inputValues: Record<string, unknown>;
  outputValues: Record<string, unknown>;
  stepStates: WorkflowNodeStepState[];
  lastRunAt?: number;
  lastError?: string;
}
```

### 11.1 与画板元素的关系

`CanvasElement` 只保留最小绑定：
- `workflowNodeId`
- `workflowRecipeId`
- `workflowNodeRole`

详细运行态全部放在实例 store。

### 11.2 节点连接规则

一期只支持：
- 顺序连接
- 单路输入
- 单路输出
- 简单分支

二期再考虑：
- 多路聚合
- 循环
- 高级表达式路由

---

## 12. 执行架构

### 12.1 统一执行入口

所有配方执行必须只走：
- [`executeWorkflowRecipeInstance()`](services/workflow-recipes/executor.ts)

### 12.2 执行流程

1. 读取 recipe
2. 校验输入
3. 解析 capabilityRef
4. 执行步骤
5. 写 step state
6. 验证输出 schema
7. 回写实例状态
8. 回写画板结果
9. 产生日志与审计记录

### 12.3 标准状态机

节点级状态：
- `idle`
- `configured`
- `running`
- `success`
- `failed`
- `cancelled`

步骤级状态：
- `pending`
- `running`
- `success`
- `failed`
- `skipped`

### 12.4 标准错误结构

```ts
export interface WorkflowRecipeError {
  code:
    | 'schema_invalid'
    | 'capability_missing'
    | 'input_invalid'
    | 'execution_failed'
    | 'output_invalid'
    | 'publish_blocked';
  message: string;
  detail?: unknown;
  stepId?: string;
}
```

---

## 13. 导入 / 校验 / 测试 / 发布 / 分享

### 13.1 导入流程

1. 读取 JSON
2. schema 校验
3. capabilityRef 白名单校验
4. 输入输出兼容性校验
5. 版本兼容校验
6. 生成导入报告

### 13.2 测试区机制

导入后的配方只能先进入测试区，不能直接正式上架。

测试内容：
- schema test
- dry-run test
- sample input smoke run
- output schema verification

### 13.3 发布门槛

只有满足以下条件才可发布：
- schema 合法
- capabilityRef 全可解析
- smoke run 成功
- 分享元数据完整

### 13.4 分享包扩展

建议在 [`StudioShareAssetKind`](services/runtime-assets/sharing.ts:22) 基础上新增：
- `workflow-recipe`

分享包必须包含：
- recipe definition
- schemaVersion
- dependency summary
- compatibilityVersion
- author / summary / tags / updatedAt

### 13.5 回滚与版本

必须支持：
- recipe version
- dependency compatibilityVersion
- publish history
- rollback record

### 13.6 能力版本治理

除了 recipe 本身带版本，原子能力目录也必须具备版本治理字段，至少包括：
- `introducedIn`
- `deprecatedIn`
- `replacedBy`
- `compatibilityLevel`

治理规则：
1. 改 capability 输入 schema，必须标注兼容级别变化。
2. 改 `executorRef`，必须触发该 capability 的依赖 recipe 回归。
3. 标记废弃能力时，必须同步提供 `replacedBy` 或迁移说明。
4. 任何破坏性变更禁止直接静默覆盖正式能力目录。

### 13.7 导入兼容闸门

导入 recipe / node package 时，必须执行兼容闸门：
- recipe schema 版本检查
- capability 版本下限检查
- dependency compatibilityVersion 检查
- 已废弃 capability 检查
- `replacedBy` 提示与迁移建议

如果兼容闸门不通过：
- 只允许停留在测试区
- 禁止进入正式节点库
- 禁止发布分享

---

## 14. 与现有系统的迁移方案

### 14.1 原则：先适配，不推翻

现有：
- 服装工作流
- 电商工作流
- 快速技能体系
- 视觉编排链路

第一阶段不强制全部重写。

### 14.2 迁移顺序

#### Phase 0：协议冻结
产出：
- [`workflow-recipe.types.ts`](types/workflow-recipe.types.ts)
- [`workflow-node.types.ts`](types/workflow-node.types.ts)
- [`capability-catalog.types.ts`](types/capability-catalog.types.ts)

#### Phase 1：能力目录
产出：
- [`registry.ts`](services/capability-catalog/registry.ts)
- 初始能力白名单
- registry tests

#### Phase 2：校验器与执行器
产出：
- [`validator.ts`](services/workflow-recipes/validator.ts)
- [`executor.ts`](services/workflow-recipes/executor.ts)
- 统一 runtime state

#### Phase 3：测试区与发布区
产出：
- 导入面板
- 测试面板
- 发布流程

#### Phase 4：画板接入
产出：
- workflow node instance store
- 画板节点实例 UI
- 结果回写画板

#### Phase 5：分享与导入导出
产出：
- recipe share package
- recipe import/export
- 兼容校验

#### Phase 6：样板业务
产出：
- 模特换装 recipe
- 第二个样板 recipe（商品图分析或电商图序列）

---

## 15. MVP 业务样板：模特换装工作流节点

### 15.1 选择原因

- 输入输出明确
- 业务价值高
- 能体现多步编排
- 可直观看到结果是否可用
- 适合验证“配方实例化为节点”的可行性

### 15.2 输入

- `garmentImage`
- `modelImage`
- `tryonInstruction`
- `styleConstraint`
- `aspectRatio`

### 15.3 输出

- `resultImage`
- `analysisSummary`
- `debugTrace`

### 15.4 步骤建议

1. `fashion.analyze.garment`
2. `fashion.analyze.model`
3. `fashion.extract.tryon-constraints`
4. `fashion.compose.tryon`
5. `fashion.repair.tryon-artifacts`
6. `image.protect.brand-elements`
7. `workflow.route.outputs`

### 15.5 MVP 成功标准

- recipe 可导入
- smoke run 可跑通
- 可生成结果图
- 可回写到画板
- 可导出 recipe 分享包
- 别人可导入测试

---

## 16. UI 规划

一期只做 4 个核心面板：

1. [`RecipeImportPanel.tsx`](pages/Workspace/components/workflow-recipes/RecipeImportPanel.tsx)
- 上传 / 粘贴 recipe
- 显示校验报告
- 导入测试区

2. [`RecipeTestPanel.tsx`](pages/Workspace/components/workflow-recipes/RecipeTestPanel.tsx)
- 填输入
- 运行测试
- 看日志和输出
- 发布节点

3. [`RecipeLibraryPanel.tsx`](pages/Workspace/components/workflow-recipes/RecipeLibraryPanel.tsx)
- 查看已发布 recipe
- 搜索 / 分类 / 拖入画板
- 导出分享

4. [`RecipeRuntimeInspector.tsx`](pages/Workspace/components/workflow-recipes/RecipeRuntimeInspector.tsx)
- 看节点状态
- 看步骤日志
- 看错误
- 看输出

---

## 17. 治理规则（强制执行）

为了避免继续回到“东一点西一点”的结构，必须执行以下规则：

1. 原子能力必须先入目录，后允许配方调用。
2. 页面层禁止直接拼接 recipe 内部执行逻辑。
3. 导入包必须先测试，后发布。
4. 没有 schema 的节点一律禁止进入节点库。
5. 没有 capabilityRef 白名单校验的能力一律禁止暴露给 recipe。
6. 运行时主脑不允许静默创建永久节点资产。
7. 配方执行日志、错误码、输出结构必须统一。
8. 任何新能力接入都必须补 catalog / validator / executor / smoke test。

### 17.1 熔断隔离机制

必须把“允许局部失败，禁止系统性瘫痪”落成机制，而不是停留在原则层：

1. 单 capability 连续失败达到阈值时，自动标记为：
- 不允许进入正式发布链路
- 不允许被新 recipe 正式依赖
- 必须在测试区先恢复验证

2. 单 recipe step 执行失败时：
- 只允许阻断当前节点实例
- 不允许污染整个画板全局运行态
- 不允许把未定义结构写回下游节点

3. 导入包校验失败时：
- 只能停留在测试区
- 不能写入正式节点库
- 不能覆盖现有稳定版本

### 17.2 变更准入机制

任何变更都必须带准入门，不允许“顺手改一下直接进主链路”：

1. 改 capability schema：
- 必须跑依赖 recipe 回归
- 必须跑 catalog 兼容性检查

2. 改 `executorRef` 或底层执行器：
- 必须跑该 capability 的 smoke case
- 必须跑至少一条真实 recipe 集成回归

3. 改分享包结构：
- 必须跑导入/导出兼容测试
- 必须验证旧包仍能解析或被明确拒绝

4. 改节点实例模型：
- 必须跑画板集成测试
- 必须检查旧运行态快照是否仍可读取

### 17.3 最低观测指标集

后续必须补齐最小观测指标，否则无法快速发现脆弱点：
- recipe 执行成功率
- step 失败率
- capability 调用失败率
- 平均执行时长
- 导入失败原因分布
- 发布后回滚率
- 被熔断 capability 数量

这些指标至少要支持：
- 调试面板查看
- 测试区对比
- 发布前后变化追踪

---

## 18. 测试策略

必须补齐 5 类测试：

1. Schema 测试
- recipe 定义是否合法

2. Catalog 测试
- capabilityRef 是否都可解析

3. Executor 测试
- 顺序步骤是否可执行
- 条件分支是否生效
- 失败恢复是否正确

4. Import/Export 测试
- 导出再导入是否一致
- 分享包兼容是否正确

5. MVP Smoke 测试
- 模特换装 recipe 能否从输入到输出完整跑通

---

## 19. 与主脑能力真值化改造的关系

这套方案和最近已经做完的主脑能力真值化并不冲突，反而是同方向延伸。

现有真值化已经解决：
- 主脑在回答“我会什么”时不再只靠自由总结。

下一步这个平台化方案要解决：
- 系统到底有哪些原子能力
- 节点到底可调用哪些能力
- 配方到底依赖哪些能力
- 导入别人节点时是否真的能跑

也就是说：
- 主脑能力真值化解决“口径问题”
- 原子能力目录 + 配方平台解决“结构问题”

---

## 20. 最终结论

真正要做的，不是“补一个节点系统”，而是建立一套新的平台标准：

1. 原子能力目录标准
2. 配方 DSL 标准
3. 节点实例标准
4. 执行状态标准
5. 导入 / 测试 / 发布 / 分享标准
6. 迁移与治理标准

一句话总结：

**本计划的目标，是把当前工作区升级成一个以画板为容器、以原子能力目录为底座、以配方 DSL 为核心、以节点实例为交互单元、以测试发布分享为治理闭环的视觉工作流平台。**

只有先把这套标准立起来，后面新增能力、模特换装节点、电商图工作流、视频工作流、分享生态才不会继续分散失控。
