# 通用视觉编排层实施方案

最后更新：2026-04-27

适用范围：
- `pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts`
- `services/skills/image-gen.skill.ts`
- `services/gemini.ts`
- `services/agents/*`
- 树节点生图链路、工作区图片生成链路，以及后续可复用到编辑/换背景/产品替换的视觉任务

## 1. 背景与目标

当前工作区生图链路已经具备以下能力：
- 关键词节点发起生图
- 多参考图输入
- 风格库/隐藏约束切换
- 狂暴重试、节点状态回写、连线状态反馈

但它和官方网页生图体验相比，最大的差距不在 UI，而在“生成前后缺少一层稳定的视觉任务编排”：
- 用户意图理解不够结构化
- 多参考图角色分配不够稳定
- 品牌、主体、构图等硬约束没有沉淀成统一计划对象
- 结果失败或跑偏后，修正逻辑还不够定向

本方案的目标不是做“海报专用逻辑”，而是建立一层通用视觉编排层，让系统先理解任务，再决定如何生成。

## 2. 核心原则

1. 先规划，后生成
- 不再直接把用户 prompt 原样打给模型。
- 每次生成前先产出结构化计划，再由执行层把计划转成最终 prompt 和参数。

2. 通用优先，场景特化后置
- 不把“海报模式”写死成主流程。
- 海报重建只是众多策略之一。

3. 多参考图必须显式角色化
- 每张参考图要有明确角色，而不是默认“全部一起喂进去”。
- 至少支持：构图、风格、产品、品牌、主体、细节、背景。

4. 约束显式化
- 把“不能改品牌”“保持产品结构”“保留构图”等要求从隐式 prompt 变成显式数据。

5. 失败处理要定向，不要盲重试
- 重试前先判断失败类型：超时、上游限流、品牌漂移、构图跑偏、主体变形、文字丢失。

6. 和现有工作区兼容
- 第一阶段不推翻现有树节点 UI。
- 优先在现有 `useWorkspaceElementImageGeneration` 前后插入编排层。

7. 智能决策禁止规则兜底
- 视觉编排层中的任务理解、参考图角色判断、策略选择、约束规划应由编排模型负责。
- 若编排模型失败，应显式暴露失败，不允许静默回退到规则决策链路。
- 规则仅可用于输入清洗、结构校验、非决策型预处理和开发诊断。

## 3. 现状判断

### 3.1 当前链路的优点

- 现有树节点生成链路已经能承载：
  - 参考图
  - 比例
  - 清晰度
  - 图片数量
  - 风格库
  - 狂暴重试
- `services/gemini.ts` 已经存在一定程度的隐藏约束、参考图角色提示、品牌保护补丁。
- 仓库已有 agent 基础设施，可复用为更强的规划层。

### 3.2 当前链路的不足

- 生成前缺少统一的任务理解对象。
- `poster-product` 这类逻辑虽然有价值，但仍然偏规则补丁，不是统一架构。
- 多图任务里“谁负责版式、谁负责产品、谁负责品牌”仍不够稳定。
- 当前“自检 -> 修正 -> 重试”闭环还比较弱。
- 不同场景共用能力不够清晰，扩展新任务会继续堆条件分支。

## 4. 目标架构

推荐把视觉任务分成 6 层：

1. 任务理解层
- 解析用户到底想做什么。

2. 参考图理解层
- 给每张参考图分配角色和权重。

3. 约束提取层
- 提取必须保留、允许改动、禁止改动的内容。

4. 策略选择层
- 根据任务类型选择最合适的生成策略。

5. 执行编排层
- 生成最终 prompt、模型参数、重试策略。

6. 结果评估层
- 检查结果是否跑偏，并给出修正指令。

## 5. 统一数据结构

建议新增统一计划对象：

```ts
export type VisualTaskIntent =
  | "poster_rebuild"
  | "product_scene"
  | "product_lock"
  | "background_replace"
  | "subject_consistency"
  | "multi_reference_fusion"
  | "text_preserve"
  | "style_transfer"
  | "unknown";

export type VisualReferenceRole =
  | "layout"
  | "style"
  | "product"
  | "brand"
  | "subject"
  | "detail"
  | "background"
  | "supporting";

export type VisualConstraintLock = {
  brandIdentity: boolean;
  subjectShape: boolean;
  packagingLayout: boolean;
  composition: boolean;
  textLayout: boolean;
  materialTexture: boolean;
};

export type VisualReferencePlan = {
  id: string;
  url: string;
  role: VisualReferenceRole;
  weight: number;
  notes?: string;
};

export type VisualGenerationPlan = {
  intent: VisualTaskIntent;
  userGoal: string;
  references: VisualReferencePlan[];
  locks: VisualConstraintLock;
  allowedEdits: string[];
  forbiddenEdits: string[];
  qualityHint: "low" | "medium" | "high";
  preferredModel?: string;
  strategyId: string;
  plannerNotes?: string[];
};
```

这个对象是整个编排层的核心，后续所有策略、执行器、自检器都围绕它运作。

## 6. 通用策略体系

第一批建议支持 5 个高价值策略：

### 6.1 `poster_rebuild`

适用场景：
- 图一做版式参考
- 图二提供产品
- 目标是“尽量还原海报，只换主体”

核心要求：
- 锁定构图、留白、视觉节奏、背景语气
- 锁定产品品牌、包装结构、颜色和关键细节

### 6.2 `product_lock`

适用场景：
- 用户最关心的是产品不能变
- 背景、场景、氛围可以变化

核心要求：
- 强化主体结构、材质、logo、品牌文字保护

### 6.3 `multi_reference_fusion`

适用场景：
- 多张参考图共同定义一个结果
- 一部分给主体，一部分给细节，一部分给氛围

核心要求：
- 防止模型只看第一张
- 防止多图互相冲突导致主体漂移

### 6.4 `background_replace`

适用场景：
- 主体不动
- 仅更换环境、背景、布景或灯光

核心要求：
- 主体锁死
- 背景自由度提升

### 6.5 `text_preserve`

适用场景：
- 海报上有文字区
- 用户要求版式和文字位置尽量稳定

核心要求：
- 保持文字区结构
- 不随意改品牌名或换错文案

## 7. 模块拆分建议

建议新增一个独立模块目录：

```text
services/vision-orchestrator/
  types.ts
  planner.ts
  reference-analyzer.ts
  constraint-extractor.ts
  strategy-selector.ts
  prompt-composer.ts
  result-evaluator.ts
  retry-director.ts
  index.ts
```

职责建议如下：

### 7.1 `types.ts`
- 放统一类型定义

### 7.2 `planner.ts`
- 总入口
- 输入：当前节点信息、prompt、参考图、UI 参数
- 输出：`VisualGenerationPlan`

### 7.3 `reference-analyzer.ts`
- 解析参考图角色
- 支持显式文案，如“图一做海报，图二换产品”
- 也支持根据当前模式和上下文做推断

### 7.4 `constraint-extractor.ts`
- 从 prompt、风格库、品牌保护需求中提取硬约束和软约束

### 7.5 `strategy-selector.ts`
- 根据意图和参考图情况选定策略

### 7.6 `prompt-composer.ts`
- 把 `VisualGenerationPlan` 转成真正的最终 prompt
- 同时产出：
  - `referenceStrength`
  - `referencePriority`
  - `referenceRoleMode`
  - `imageQuality`
  - `disableTransportRetries`

### 7.7 `result-evaluator.ts`
- 对首轮结果做自动自检
- 检查是否有：
  - 品牌漂移
  - 主体漂移
  - 构图偏离
  - 文字区结构丢失

### 7.8 `retry-director.ts`
- 根据评估结果生成修正 prompt
- 决定是否在同节点重试

## 8. 和现有代码的接入点

### 8.1 生成前接入点

现有主入口：
- `pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts`

建议改造：
- 在 `runGeneration(...)` 之前，先调用 `planVisualGeneration(...)`
- 由编排层返回：
  - 最终 prompt
  - 参考图角色说明
  - 参数覆盖项
  - 重试策略

### 8.2 执行层接入点

现有技能入口：
- `services/skills/image-gen.skill.ts`

建议改造：
- 保持 skill 足够薄，不在这里塞越来越多业务判断
- skill 只负责调用 provider
- 所有任务理解都前移到 `vision-orchestrator`

### 8.3 Prompt 组装接入点

现有逻辑集中在：
- `services/gemini.ts`

建议改造：
- 把通用规则和策略规则分层
- `gemini.ts` 负责 provider 路由和底层生成协议
- 视觉任务语义尽量上移到 `prompt-composer.ts`

### 8.4 Agent 接入点

现有 agent 基础设施：
- `services/agents/index.ts`
- `services/agents/enhanced-base-agent.ts`

建议改造：
- 第一阶段不强依赖完整聊天 agent
- 先实现“轻量规划 agent”能力
- 后续可将 planner 升级成真正多步 agent 执行器

## 9. UI 层配合方案

本方案不要求第一阶段大改 UI，但建议做这几处最小增强：

1. 风格库保留
- `无 / 默认 / 海报参考+产品参考` 继续保留
- 作为对 planner 的显式提示，而不是直接等于最终生成模式

2. 质量参数保留
- `low / medium / high`
- 编排层可在必要时给出建议，但默认仍尊重用户选择

3. 增加开发调试信息
- 在开发模式下显示：
  - 当前识别到的任务类型
  - 每张参考图角色
  - 当前策略
  - 最终 prompt 摘要

4. 后续再考虑可视化高级面板
- 不急着塞进节点主 UI，避免拥挤

## 10. 分阶段实施计划

### 阶段 A：结构化计划落地

目标：
- 让每次生图前先生成 `VisualGenerationPlan`

任务：
- 新增 `services/vision-orchestrator/types.ts`
- 新增 `planner.ts`
- 把树节点生图入口改成先走 planner
- 日志打印完整计划摘要

验收：
- 控制台能看到结构化计划
- 不再只是打印原始 prompt 和基础参数

### 阶段 B：参考图角色稳定化

目标：
- 让多参考图输入不再像“随机只看一张”

任务：
- 新增 `reference-analyzer.ts`
- 支持：
  - 无模式
  - 默认模式
  - 海报参考+产品参考模式
  - 从用户 prompt 推断图 1 / 图 2 角色

验收：
- “图一做海报，图二用产品”识别稳定
- 品牌和主体漂移率下降

### 阶段 C：策略驱动的 prompt 编排

目标：
- 用策略统一生成最终 prompt，而不是继续叠加 scattered patch

任务：
- 新增 `strategy-selector.ts`
- 新增 `prompt-composer.ts`
- 逐步把 `gemini.ts` 里的视觉策略文案上移

验收：
- 同样输入下，生成方向更稳定
- 官方网页常见场景的表现更接近

### 阶段 D：结果自检与定向修复

目标：
- 出图后不是直接判成功，而是先检查是否偏题

任务：
- 新增 `result-evaluator.ts`
- 新增 `retry-director.ts`
- 在当前节点原位重试，不新开失败节点

验收：
- “产品对了但海报不像”这类错误能被识别
- 修正重试比盲重试更有效

### 阶段 E：上下文记忆

目标：
- 连续多次生成时保持风格、品牌、主体连续性

任务：
- 给关键词节点绑定最近一次成功生成计划摘要
- 记录：
  - 上次策略
  - 参考图角色
  - 品牌禁改项
  - 结果摘要

验收：
- 用户微调 prompt 再生图时，理解不重新归零

## 11. 风险与注意事项

1. 不能把编排层继续做成散乱 if/else
- 否则只是把问题从 `gemini.ts` 挪到新文件夹。

2. 不要过早做重 UI
- 先让底层结果变稳，再决定可视化方式。

3. 第一阶段不要强绑定完整聊天 agent
- 否则复杂度和不确定性太高。
- 先做 deterministic planner，再逐步升级成更智能 agent。

4. 自检逻辑要控制成本
- 不是每次都跑一整轮重分析。
- 优先对高价值场景开启。

5. 需要保留用户显式控制权
- 用户选“无”时，应尽量关闭额外隐藏约束。
- 编排层不能偷偷覆写用户意图。

## 12. 推荐的最小可用版本

为了尽快落地，推荐先做一个 MVP：

范围：
- 只接入树关键词节点生图
- 支持 `无 / 默认 / 海报参考+产品参考`
- 生成前产出结构化计划
- 用策略生成最终 prompt
- 对首张结果做一次轻量自检

MVP 验收标准：
- 多参考图时角色更稳定
- 品牌漂移减少
- 海报复刻换产品场景效果明显提升
- 控制台和调试层能看懂系统到底是怎么决定的

## 13. 预期收益

完成这层之后，系统会获得这几个长期价值：
- 不再只靠补丁堆 prompt
- 新增场景时只需要加策略，不用重写主流程
- 更容易接近官方网页那种“理解后再生成”的体验
- 后续无论接海报、电商主图、换背景、局部编辑，都能复用同一套编排骨架

## 14. 建议执行顺序

固定顺序如下：

1. 先做 `VisualGenerationPlan`
2. 再做参考图角色分析
3. 再做策略选择和 prompt 编排
4. 再做结果自检和定向修复
5. 最后做上下文记忆和调试 UI

不建议一开始就同时做完整 agent、完整 UI、完整自检，以免范围失控。
