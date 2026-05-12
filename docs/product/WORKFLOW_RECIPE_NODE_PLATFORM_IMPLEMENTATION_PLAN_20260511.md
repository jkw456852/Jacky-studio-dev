# 工作流配方节点平台完整版实施计划

最后更新：2026-05-11

适用范围：
- `pages/Workspace/*`
- `types/common.ts`
- `types/workflow.types.ts`
- `services/agents/*`
- `services/skills/*`
- `services/browser-agent/*`
- `services/runtime-assets/*`
- `docs/product/*`

---

## 1. 背景与目标

当前系统已经具备三类重要基础：

1. 画板容器基础
- 现有工作区已经不是单纯静态画布，而是具备节点父子关系、生成链路、分支关系、结果回灌的半结构化容器。
- 这意味着它天然适合向“节点化工作流容器”演进。

2. 原子能力基础
- 现有系统已具备生成、编辑、OCR、局部分析、联网搜索、工作流、角色治理等原子能力。
- 这些能力已经有注册、路由、执行、输出结构，只是目前更多以分散功能和专用控制器形式存在。

3. 资产与分享基础
- 系统已经存在插件资产、样式库、角色、分享包、导入导出等基础设施。
- 这为未来的“可分享工作流节点/配方包”提供了底座。

### 1.1 本方案要解决的问题

当前的主要问题不是“能力不够”，而是“能力组织方式不统一”：
- 新功能入口分散
- 专用控制器不断增多
- 同类能力接口不统一
- 工作流状态定义散落
- 导入、分享、执行、测试缺少统一协议
- 新增能力时需要反复修改多处主流程，维护成本高

### 1.2 本方案的核心目标

本方案要把系统从“功能堆叠型 AI 工作区”升级成“受控的视觉工作流配方节点平台”，核心目标如下：

1. 画板成为统一工作流容器
2. 节点成为标准化模块实例
3. 原子能力成为受控能力目录
4. 外部 AI / 开发工具生成的是“工作流配方”，不是任意代码插件
5. 配方可导入、可校验、可测试、可发布、可分享
6. 各类接口、状态、输出、执行日志、分享包全部标准化，避免继续分散演化

---

## 2. 总体原则

### 2.1 配方优先，插件后置
- 第一阶段不做开放式任意插件系统。
- 第一阶段只做“配方节点系统”。
- 真正新增平台级执行器时，才允许升格为正式插件。

### 2.2 节点是声明式模块，不是任意执行代码
- 节点由结构化 DSL 描述。
- 节点只能编排白名单原子能力。
- 节点导入时必须经过 schema 校验和依赖校验。

### 2.3 主脑不直接改平台结构
- 运行时主脑只负责使用、解释、编排现有节点。
- 新配方由外部 AI 或开发工具生成。
- 平台负责导入、测试、发布，不允许运行时静默创建永久结构。

### 2.4 所有接口标准化，禁止继续散点演化
- 能力目录统一
- 配方 DSL 统一
- 节点实例模型统一
- 执行状态统一
- 导入导出协议统一
- 分享包统一
- 错误码与日志结构统一

### 2.5 兼容现有工作区，不推翻重做
- 第一阶段必须兼容现有 `CanvasElement`、节点图、工作区生成链路。
- 采用“旁挂模型 + 渐进接入”的方式演进。

---

## 3. 一期边界（MVP）

### 3.1 一期要做

1. 工作流配方 DSL
2. 原子能力目录
3. 配方校验器
4. 配方执行器（只支持顺序步骤 + 简单条件）
5. 节点实例模型
6. 配方导入到测试区
7. 测试通过后发布到本地节点库
8. 配方包导出 / 导入 / 分享
9. 一个 MVP 样板：模特换装工作流节点

### 3.2 一期不做

1. 不支持任意 JS/TS 代码节点
2. 不支持第三方远程脚本执行
3. 不做开放式节点商店
4. 不做复杂循环 / 自定义表达式引擎
5. 不让运行时主脑直接创建永久节点
6. 不做多租户协作治理

---

## 4. 目标架构

推荐拆成 7 层：

1. 画板容器层
- 承载节点实例、连线关系、结果落位、输入输出可视化。

2. 节点实例层
- 画板中的每个工作流节点是一个“配方实例”。

3. 配方 DSL 层
- 用统一 JSON/TS 类型描述节点元数据、输入输出、步骤、参数映射、UI、状态。

4. 原子能力目录层
- 对现有技能、浏览器工具、工作流执行器做统一白名单登记。

5. 配方执行器层
- 负责执行步骤、处理上下文、映射输入输出、记录状态、写回结果。

6. 导入校验发布层
- 负责配方导入、schema 校验、依赖检查、测试运行、发布到节点库。

7. 分享层
- 负责导出、导入、版本兼容、分享包元数据。

---

## 5. 标准目录与文件组织

必须建立一个专用域，禁止再把逻辑东一块西一块散在各处。

建议新增以下目录：

```txt
/types
  workflow-recipe.types.ts
  workflow-node.types.ts
  capability-catalog.types.ts

/services/workflow-recipes
  capability-catalog.ts
  validator.ts
  validator.test.ts
  executor.ts
  executor.test.ts
  importer.ts
  importer.test.ts
  publisher.ts
  publisher.test.ts
  serializer.ts
  recipe-runtime-state.ts
  sample-recipes/
    fashion-model-tryon.recipe.json

/services/node-library
  registry.ts
  registry.test.ts
  share.ts
  share.test.ts

/pages/Workspace/components/workflow-recipes
  RecipeImportPanel.tsx
  RecipeTestPanel.tsx
  RecipeNodeCard.tsx
  RecipeLibraryPanel.tsx

/pages/Workspace/controllers
  useWorkflowRecipeImport.ts
  useWorkflowRecipeExecution.ts
  useWorkflowRecipeLibrary.ts
```

### 5.1 组织规则

1. 配方类型只允许定义在 `types/workflow-recipe.types.ts`
2. 节点实例类型只允许定义在 `types/workflow-node.types.ts`
3. 原子能力目录只允许由 `services/workflow-recipes/capability-catalog.ts` 提供
4. 执行逻辑只允许从 `services/workflow-recipes/executor.ts` 进入
5. 导入导出只允许通过 importer / serializer / share 层，不允许 UI 直接拼包
6. 工作区页面层不允许直接引用散乱 skill 组合逻辑，必须经由 recipe executor 或 capability catalog

---

## 6. 配方 DSL 设计

### 6.1 顶层结构

建议新增：
- `WorkflowRecipeDefinition`
- `WorkflowRecipeInputField`
- `WorkflowRecipeOutputField`
- `WorkflowRecipeStep`
- `WorkflowRecipeUiSchema`
- `WorkflowRecipeShareMeta`

### 6.2 顶层字段建议

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

### 6.3 输入输出类型标准

一期只允许以下标准数据类型：
- `image`
- `image_list`
- `text`
- `number`
- `boolean`
- `enum`
- `json`

禁止：
- 任意函数
- 任意 class
- 任意运行时代码
- 无 schema 的动态对象

### 6.4 步骤模型

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

### 6.5 参数映射规则

必须统一成字符串路径或显式表达式子集，不允许脚本。

建议支持：
- `inputs.garmentImage`
- `inputs.modelImage`
- `steps.analyze_garment.outputs.summary`
- `context.selectedElementId`
- `constants.defaultAspectRatio`

禁止：
- 直接写 JS 表达式
- 任意 eval
- 任意 Function 构造器

---

## 7. 原子能力目录设计

## 7.1 为什么必须做能力目录

当前系统能力很多，但接入点分散：
- skill 体系
- browser tool 体系
- 工作流控制器
- 专用 controller

如果不做统一目录，未来 recipe 只会继续把这些分散点打包引用，问题会重复出现。

## 7.2 统一能力目录字段

```ts
export interface RecipeCapabilityDefinition {
  id: string;
  label: string;
  kind: 'skill' | 'browser-tool' | 'workflow-adapter';
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

## 7.3 一期建议纳入目录的能力

1. 视觉分析类
- 局部分析
- OCR 提字
- 商品分析

2. 视觉编辑类
- smart edit
- touch edit
- 背景替换

3. 视觉生成类
- 图片生成
- 视频生成（只作为二期可选）

4. 研究类
- workspaceSearch

5. 适配类
- 现有服装工作流适配器
- 现有电商工作流适配器

### 7.4 能力来源绑定

- 来自 skill 的能力：绑定到现有 `services/skills/*`
- 来自 browser tool 的能力：绑定到现有 `services/browser-agent/tool-registry.ts`
- 来自专用工作流的能力：必须先写 adapter，再暴露给 recipe catalog

原则：
- recipe 永远不能直接依赖零散页面控制器
- recipe 只能依赖 catalog 中声明过的能力

---

## 8. 画板节点实例模型

### 8.1 不建议直接把所有 recipe 状态塞进 CanvasElement

`CanvasElement` 现在已经承担了大量职责。
如果继续把 recipe 执行态、配方定义、测试结果都塞进去，后面只会更乱。

### 8.2 推荐旁挂实例表

建议新增：

```ts
export interface WorkflowNodeInstance {
  nodeId: string;
  recipeId: string;
  recipeVersion: string;
  title: string;
  status: 'idle' | 'configured' | 'running' | 'success' | 'failed';
  inputValues: Record<string, unknown>;
  outputValues: Record<string, unknown>;
  stepStates: WorkflowNodeStepState[];
  lastRunAt?: number;
  lastError?: string;
}
```

### 8.3 与 CanvasElement 的关系

`CanvasElement` 只保存最少绑定信息，例如：
- `workflowNodeId`
- `workflowRecipeId`
- `workflowNodeRole`

详细运行态放在独立 store / service 中。

### 8.4 节点连接规则

第一阶段只支持：
- 单节点输入
- 单节点输出
- 顺序连接
- 简单分支连接

不支持：
- 任意多路聚合
- 动态拓扑变更
- 复杂循环回边

---

## 9. 执行架构

### 9.1 执行入口

所有 recipe 执行只允许走一个统一入口：
- `executeWorkflowRecipeInstance()`

### 9.2 执行流程

1. 读取 recipe 定义
2. 校验输入
3. 解析 capabilityRef
4. 按步骤顺序执行
5. 写入 stepStates
6. 产出 outputs
7. 回写画板 / 资产 / 消息区日志

### 9.3 状态机

统一状态机必须标准化：
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

### 9.4 错误处理标准

统一错误结构：

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

禁止：
- 任意字符串错误满天飞
- 页面层直接自己解释各种底层异常

---

## 10. 导入 / 校验 / 测试 / 发布 / 分享流程

### 10.1 导入流程

1. 读取 JSON
2. schema 校验
3. capabilityRef 白名单校验
4. 输入输出兼容性校验
5. 版本兼容校验
6. 生成导入报告

### 10.2 测试流程

测试区必须独立，不能导入后直接作为正式节点启用。

建议测试包含：
- schema test
- dry-run test
- sample input smoke run
- output schema verification

### 10.3 发布流程

只有满足以下条件才允许发布：
- schema 校验通过
- 所有 capabilityRef 可解析
- 至少一次 smoke run 成功
- 分享元数据完整

### 10.4 分享流程

建议扩展分享包种类：
- `workflow-recipe`

分享包必须包含：
- recipe definition
- schemaVersion
- dependency summary
- compatibilityVersion
- author / updatedAt / summary / tags

### 10.5 导入时的兼容策略

- 主版本不兼容：禁止导入
- 次版本差异：允许导入，但给出警告
- 能力被废弃：提示替代项 `replacedBy`

---

## 11. UI 规划

一期只做 4 个面板，不做市场：

### 11.1 Recipe Import Panel
- 上传 / 粘贴配方 JSON
- 立即展示校验报告
- 展示依赖能力
- “导入到测试区”按钮

### 11.2 Recipe Test Panel
- 填输入参数
- 运行 smoke test
- 查看步骤日志
- 查看输出结果
- “发布为节点”按钮

### 11.3 Recipe Library Panel
- 查看本地已发布 recipe
- 搜索 / 分类 / 标签过滤
- 拖到画板生成节点实例
- 导出分享

### 11.4 Node Runtime Inspector
- 查看节点输入
- 查看节点步骤状态
- 查看输出
- 查看错误

---

## 12. 与现有系统的兼容策略

### 12.1 不直接拆现有服装 / 电商工作流

现有：
- 服装工作流
- 电商一键工作流
- 快速技能体系
- 视觉编排体系

第一阶段不要求它们全部重写成 recipe。

### 12.2 先做 adapter

先把现有复杂工作流包装成 `workflow-adapter` 能力，让 recipe 可以调用。
这样可以渐进迁移，而不是一次性推翻。

### 12.3 迁移顺序

1. 先接入一个新 recipe 系统
2. 再把一两个典型流程迁进去
3. 再逐步把散乱功能统一收口

---

## 13. MVP：模特换装工作流节点

### 13.1 选择理由
- 用户价值高
- 输入输出清晰
- 能体现多步编排价值
- 可验证效果直观

### 13.2 输入
- `garmentImage`
- `modelImage`
- `tryonInstruction`
- `styleConstraint`
- `aspectRatio`

### 13.3 输出
- `resultImage`
- `analysisSummary`
- `debugTrace`

### 13.4 推荐步骤
1. 服装图分析
2. 模特图分析
3. 约束提取
4. 换装执行
5. 局部修复
6. 输出整理

### 13.5 MVP 成功标准
- 能导入 recipe
- 能在测试区跑通
- 能生成结果图
- 能把结果回写到画板
- 能导出 recipe 分享包给他人导入

---

## 14. 标准化约束（必须执行）

为了避免再回到“东一点西一点”的状态，必须执行以下治理规则：

### 14.1 单一真值源
- 能力目录只有一份
- recipe schema 只有一份
- 节点实例状态机只有一份
- 分享包 schema 只有一份

### 14.2 目录隔离
- recipe 逻辑不允许散落到任意页面 controller
- 所有 recipe 相关执行必须集中在 `services/workflow-recipes/*`

### 14.3 新增能力接入顺序固定
任何新能力如果想被 recipe 使用，必须按顺序接入：
1. 写原子执行器或 adapter
2. 注册到 capability catalog
3. 补 input/output schema
4. 补 validator case
5. 补 executor case
6. 才允许被 recipe 引用

### 14.4 分享前必须测试
- 未经过 smoke run 的 recipe 禁止发布
- 未通过 schema 校验的 recipe 禁止导出分享

### 14.5 禁止页面层直连底层散乱 skill
- 页面层如果要使用 recipe 节点，只能通过 recipe executor 或 node runtime facade

---

## 15. 测试策略

必须补齐 5 类测试：

1. Schema 测试
- recipe 定义是否合法

2. Catalog 测试
- capabilityRef 是否都能被解析

3. Executor 测试
- 顺序步骤是否按预期执行
- 错误是否按 `onError` 策略处理

4. Import/Export 测试
- 导出包再导入后结构一致

5. MVP Smoke 测试
- 模特换装 recipe 能跑通最小链路

---

## 16. 分阶段实施计划

### Phase 0：协议冻结
目标：把 schema、目录、状态机定下来
交付：
- `workflow-recipe.types.ts`
- `workflow-node.types.ts`
- `capability-catalog.types.ts`
- 文档冻结版

### Phase 1：能力目录与校验器
交付：
- `capability-catalog.ts`
- `validator.ts`
- `validator.test.ts`

### Phase 2：执行器与运行态
交付：
- `executor.ts`
- `recipe-runtime-state.ts`
- `executor.test.ts`

### Phase 3：导入测试区
交付：
- import panel
- importer
- 测试运行
- 发布按钮

### Phase 4：节点实例与画板集成
交付：
- node instance store
- 节点实例 UI
- 输出结果回写画板

### Phase 5：分享与导出
交付：
- recipe share package
- 导出 / 导入
- 兼容校验

### Phase 6：MVP 业务样板
交付：
- 模特换装 recipe
- 样板输入输出表单
- smoke case

---

## 17. 风险与应对

### 风险 1：接口再次分散
应对：
- 所有 recipe 相关功能只允许进专用目录
- 禁止 controller 私自拼 recipe 逻辑

### 风险 2：外部 AI 生成质量不稳定
应对：
- 强 schema
- 白名单 capabilityRef
- 导入校验
- 测试后发布

### 风险 3：节点过多导致治理困难
应对：
- 一期只允许本地发布
- 后续再做分享审核机制

### 风险 4：现有复杂工作流迁移成本高
应对：
- 先 adapter 化，不强行重写

---

## 18. 最终建议

如果决定做，这件事必须按“平台治理工程”对待，而不是当成一个普通功能开发。

正确顺序不是：
- 先做几个节点试试看

而是：
1. 先统一协议
2. 再建能力目录
3. 再做执行器
4. 再做导入测试发布
5. 最后再做样板节点

否则后面一定会再次回到：
- 接口分散
- 状态混乱
- 能力重复接线
- 节点不可分享
- 节点不可维护

---

## 19. 一句话结论

本方案的本质不是“增加几个新节点”，而是：

**把工作区升级成一个以画板为容器、以配方为中心、以原子能力目录为基础、以标准化导入测试发布为治理核心的视觉工作流节点平台。**

只有这样，后续新能力、新节点、新分享链路才不会再次变成分散、脆弱、不可维护的拼装结构。
