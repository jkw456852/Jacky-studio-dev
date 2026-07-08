```json
{
  "type": "skill-preset",
  "id": "cn-detail-page",
  "name": "中文详情页",
  "description": "基于商品图和 brief 直接产出中文详情页套图。",
  "category": "workflow",
  "tab": "commerce",
  "frontstagePriority": "primary",
  "executionType": "skill",
  "activationHint": "直接进入详情页套图执行，最好先附上商品图。",
  "iconName": "Box",
  "order": 110,
  "skillDataId": "cn-detail-page",
  "skillDataName": "中文详情页套图",
  "requiresAttachments": true,
  "followUpMode": "direct-run",
  "frontstageSkillId": "cn-detail-page",
  "clarifyChecklist": ["商品图", "卖点", "详情页页数/规格"],
  "examplePrompt": "这里有商品图，帮我按天猫中文详情页拆一套 6 屏结构，先定页序和每屏卖点。",
  "tags": ["commerce", "detail-page"]
}
```

## Instruction
默认按中文详情页套图执行，优先利用商品图、卖点与页数规格直接组织详情页页面结构。

## ClarifyQuestions
- 商品图是否完整，主图、细节图、卖点图分别有没有？
- 核心卖点、价格带和目标平台是什么？
- 详情页需要几屏，是否有固定尺寸、页数或模块要求？

## ExecutionOutline
- 先锁定商品真值、卖点和页数规格。
- 再按中文详情页常见节奏拆封面、痛点、卖点、细节、场景和收尾模块。
- 最后为每一屏给出文案重点、视觉重点和执行提示。

## ExecutionRecipe
- always :: none :: 先锁定商品真值、卖点和页型结构，再进入详情页执行
- visual-request :: generateImage :: 按页面职责逐屏生成，不要把整套详情页压成一张图

## OutputBlueprint
- 先给整套详情页结构与页序。
- 再逐屏说明标题、卖点、画面任务和素材需求。
- 最后给生成或设计执行建议与缺口提醒。

## ToolPolicy
- 商品图和卖点是详情页真值，不能被风格化表达覆盖。
- 优先按多屏页面结构组织，不要把任务退化成单张海报。
- 能直接进入详情页执行时不要绕回普通聊天，但缺少主体商品图时要明确指出。

## Notes
它不是“商品海报生成器”，而是专门面向中文详情页页序、卖点递进和逐屏执行的 skill。

## Research
参考国内电商详情页的常见页型节奏，以及 Lovart 一类产品把多资产任务拆成页序结构再执行的工作方式，这类 skill 的关键是“逐屏职责”，不是单张视觉效果。

## ExamplePrompt
基于这款美容仪的商品图和卖点，帮我做一套中文详情页结构。目标平台是天猫，预计 6 屏，卖点重点是提拉、紧致和家用便捷。请先排页序和每屏职责，再给每屏标题、文案主线和视觉建议。
