```json
{
  "type": "skill-preset",
  "id": "brand-style-guide",
  "name": "品牌手册",
  "description": "围绕 logo、色板、字体、版式与品牌规则来输出可落地的 style guide。",
  "category": "agent",
  "tab": "branding",
  "frontstagePriority": "primary",
  "executionType": "agent",
  "activationHint": "适合品牌启动包、品牌手册、风格规范与视觉规则整理。",
  "iconName": "Type",
  "order": 80,
  "skillDataId": "autonomous-main-brain",
  "skillDataName": "品牌手册",
  "allowAutonomousRouting": true,
  "mode": "unified-sidebar-agent",
  "frontstageSkillId": "brand-style-guide",
  "routeIntent": "branding",
  "routeLabel": "Style Guide",
  "routeSummary": "Bias toward identity systems, logo usage, color palettes, typography rules, and reusable brand guidelines.",
  "preferredSkills": ["generateImage", "generateCopy", "workspaceSearch"],
  "suggestedTaskMode": "generate",
  "followUpMode": "auto-clarify",
  "clarifyChecklist": ["品牌名称/定位", "现有 logo/参考", "需要覆盖的应用场景"],
  "outputBlueprint": ["先梳理品牌核心调性", "再输出 logo/色板/字体/应用规则"],
  "tags": ["lovart", "brand-kit", "style-guide"]
}
```

## Instruction
把品牌手册当成一套系统，而不是几张好看的 moodboard。先确认品牌定位和应用场景，再拆 logo、色板、字体、页面/物料示例。

## ClarifyQuestions
- 品牌名称、定位和希望长期传达的气质是什么？
- 现有 logo、字体、色板或参考资产有哪些必须沿用？
- 这份手册要覆盖哪些应用场景，例如包装、海报、社媒还是网页？

## ExecutionOutline
- 先统一品牌核心、受众和应用边界。
- 再拆 logo 使用、色彩、字体、版式和视觉规则。
- 最后补齐应用示例、禁用规则和交付结构。

## ExecutionRecipe
- always :: none :: 先明确品牌核心、受众和应用触点，再进入系统规范整理
- explicit-research :: workspaceSearch :: 仅在用户明确要竞品、行业或参考案例时补研究
- visual-request :: generateImage :: 用单张 KV 或单个规范样张验证方向，不要拿出图替代系统判断

## OutputBlueprint
- 先给品牌原则与视觉基调。
- 再给 logo、色板、字体和版式规则。
- 最后给应用示例方向、禁用规则和交付建议。

## ToolPolicy
- 先用 generateCopy 梳理规则结构和命名，不要直接输出空洞 moodboard。
- 需要示例页或品牌应用画面时再调用 generateImage。
- 只有用户要补行业案例或竞品 brand kit 时，再调用 workspaceSearch。

## Notes
适合对标 Lovart 与第三方测评里最常被提到的 brand kit / style guide 类工作流。

## Research
Lovart 官方近一年持续在推 style guide、brand kit、presentation 这类可复用品牌资产场景，这个预设是最值得前台化的品牌类案例之一。

## ExamplePrompt
请帮我给“山野植物实验室”做一版可落地的品牌手册草案，覆盖 logo 使用逻辑、主辅色、字体层级、版式规则和社媒/包装应用场景。先从品牌定位和应用场景补齐，再输出 style guide 结构，不要只给 moodboard。
