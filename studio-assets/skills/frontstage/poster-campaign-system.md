```json
{
  "type": "skill-preset",
  "id": "poster-campaign-system",
  "name": "海报战役",
  "description": "把一次活动、上新或促销拆成主海报、延展尺寸、文案钩子和可继续迭代的 campaign 画面系统。",
  "category": "agent",
  "tab": "branding",
  "frontstagePriority": "secondary",
  "executionType": "agent",
  "activationHint": "适合新品发布、活动主视觉、促销 KV、线下海报和社媒 poster campaign 这种要先稳住主视觉再延展多尺寸的任务。",
  "iconName": "PanelsTopLeft",
  "order": 65,
  "skillDataId": "autonomous-main-brain",
  "skillDataName": "海报战役",
  "allowAutonomousRouting": true,
  "mode": "unified-sidebar-agent",
  "frontstageSkillId": "poster-campaign-system",
  "routeIntent": "branding",
  "routeLabel": "Poster",
  "routeSummary": "Bias toward key visual hierarchy, campaign hooks, readable typography zones, and master-poster-first expansion.",
  "preferredSkills": ["generateCopy", "generateImage", "workspaceSearch", "smartEdit"],
  "suggestedTaskMode": "generate",
  "followUpMode": "auto-clarify",
  "clarifyChecklist": ["活动/上新主题", "主标题与关键信息", "投放场景/尺寸"],
  "outputBlueprint": ["先给主海报核心钩子和视觉判断", "再拆主视觉/文案层级/延展尺寸", "最后给继续放大或改稿的执行建议"],
  "tags": ["lovart", "poster", "campaign", "kv", "brand"],
  "sources": [
    "https://www.lovart.ai/features/event-poster-maker",
    "https://www.lovart.ai/features/ai-poster-generator-illustration-optimization"
  ]
}
```

## Instruction
把 poster 当成 campaign 入口，而不是一张孤立成图。先锁主标题、核心卖点、层级和阅读路径，再决定主视觉、版式张力和延展尺寸。

## ClarifyQuestions
- 这次海报服务的是活动、上新、促销还是品牌宣发，最想让用户第一眼记住什么？
- 主标题、副标题、时间地点、CTA 这些信息里，哪些必须上第一屏，哪些可以退到次级层？
- 主要落地在什么场景：社媒封面、竖版海报、横幅、门店屏、地铁灯箱，还是要一套多尺寸延展？

## ExecutionOutline
- 先稳定 campaign hook、标题层级和视觉重心，避免一上来就空出图。
- 再定义主海报的构图母体、配色、字体区和可延展的版式规则。
- 最后决定需要哪些尺寸或变体，并把改字、改元素、继续延展的后续动作预留出来。

## ExecutionRecipe
- always :: generateCopy :: 先稳定海报主标题、信息层级和 campaign hook，再进入视觉执行
- explicit-research :: workspaceSearch :: 仅在用户明确要补竞品海报、行业案例或活动语境时补研究
- visual-request :: generateImage :: 先生成主海报或单一关键视觉，不要一上来把整套 campaign 压成一张拼贴

## OutputBlueprint
- 先给海报主钩子、标题层级和视觉母体判断。
- 再给主海报构图、文案区、主体关系和延展尺寸建议。
- 最后给继续改字、补 mockup、做横竖版延展的执行顺序。

## ToolPolicy
- 先用 generateCopy 稳定主标题和信息层级，再决定是否进入 generateImage。
- generateImage 优先只做 master poster，再往横版、竖版、社媒裁切去延展。
- 如用户后续只想改局部文字、位移主体或替换物料，优先切到 smartEdit 而不是整张重生。

## Notes
这个 preset 更偏 campaign poster workflow，不等同于随便生成一张好看的海报。

## Research
参考 Lovart 的 Event Poster Maker 与 Poster Generator 功能页，重点是先锁关键信息与主视觉，再做 text-safe layout、风格参照、尺寸延展和后续 campaign 资产。

## ExamplePrompt
为一场医美周年庆活动做 campaign poster 系统。请先锁主标题、活动利益点、时间地点和阅读路径，再拆主海报视觉、文案层级、延展尺寸和后续能继续放大的 campaign 资产，不要只给一张好看的静态图。
