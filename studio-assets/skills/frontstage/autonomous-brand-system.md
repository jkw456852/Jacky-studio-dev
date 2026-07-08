```json
{
  "type": "skill-preset",
  "id": "autonomous-brand-system",
  "name": "品牌视觉",
  "description": "围绕品牌语气、视觉系统、KV 与延展素材来拆解和推进任务。",
  "category": "agent",
  "tab": "branding",
  "frontstagePriority": "primary",
  "executionType": "agent",
  "activationHint": "适合品牌调性、视觉系统、KV、campaign look and feel 这类任务。",
  "iconName": "Lightbulb",
  "order": 70,
  "skillDataId": "autonomous-main-brain",
  "skillDataName": "品牌视觉",
  "allowAutonomousRouting": true,
  "mode": "unified-sidebar-agent",
  "frontstageSkillId": "autonomous-brand-system",
  "routeIntent": "branding",
  "routeLabel": "Branding",
  "routeSummary": "Bias toward visual systems, brand direction, key visuals, and identity-aware execution.",
  "preferredSkills": ["generateImage", "generateCopy", "workspaceSearch"],
  "suggestedTaskMode": "generate",
  "followUpMode": "auto-clarify",
  "clarifyChecklist": ["品牌调性", "受众定位", "视觉参考与应用场景"],
  "outputBlueprint": ["先整理品牌方向", "再输出视觉系统/KV建议"],
  "tags": ["lovart", "branding", "kv"]
}
```

## Instruction
先统一品牌语气、受众和参考方向，再把任务拆成可执行的视觉系统或 KV 方案，不要只停留在风格形容词。

## ClarifyQuestions
- 这次品牌更想强化什么调性或情绪，不能碰什么俗套方向？
- 目标受众是谁，核心使用场景或触点是什么？
- 有没有竞品、参考案例或现有资产需要沿用？

## ExecutionOutline
- 先对齐品牌定位、受众和视觉目标。
- 再提炼视觉系统支柱，包括色彩、构图、材质、语气和 KV 方向。
- 最后把方向翻译成可执行的视觉资产、提示词或下一步任务。

## ExecutionRecipe
- always :: none :: 先统一品牌调性、受众和应用场景，再进入视觉执行
- explicit-research :: workspaceSearch :: 仅在用户明确要竞品、趋势或案例时补研究
- visual-request :: generateImage :: 一次验证一个 KV 或系统方向，不要把整套 campaign 压成一张图

## OutputBlueprint
- 先给品牌方向判断与关键词。
- 再给视觉系统、KV 主张与延展思路。
- 最后给落地建议、素材需求和执行优先级。

## ToolPolicy
- 先用 generateCopy 整理品牌策略和命名，再决定是否进入视觉生成。
- generateImage 用于验证 KV 或系统方向，不要拿它替代品牌定位判断。
- 需要补竞品或行业参考时再调用 workspaceSearch，不要把搜索当默认第一步。

## Notes
这是当前最通用的品牌前台 skill，适合继续作为品牌类默认入口。

## ExamplePrompt
我们要给一个面向 25-35 岁城市女性的轻医美护肤品牌做整套品牌视觉方向。请先帮我统一品牌调性、受众感知和视觉关键词，再拆出色彩、材质、构图、KV 主张和首批可落地资产建议。如果你觉得信息不够，先按品牌工作流补问。
