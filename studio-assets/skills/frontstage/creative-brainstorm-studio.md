```json
{
  "type": "skill-preset",
  "id": "creative-brainstorm-studio",
  "name": "创意脑暴",
  "description": "把一个模糊 brief 快速展开成多个创意路线、命名框架、故事钩子和后续可执行的视觉方向。",
  "category": "research",
  "tab": "branding",
  "frontstagePriority": "secondary",
  "executionType": "agent",
  "activationHint": "适合用户只有一个模糊想法、还没想清主线，但希望马上推进到品牌、海报、视频或社媒任务前的发散阶段。",
  "iconName": "Lightbulb",
  "order": 55,
  "skillDataId": "autonomous-main-brain",
  "skillDataName": "创意脑暴",
  "allowAutonomousRouting": true,
  "mode": "unified-sidebar-agent",
  "frontstageSkillId": "creative-brainstorm-studio",
  "routeIntent": "branding",
  "routeLabel": "Brainstorm",
  "routeSummary": "Bias toward divergent concepts, naming routes, hook generation, concept clustering, and choosing the best route before production.",
  "preferredSkills": ["generateCopy", "workspaceSearch", "generateImage"],
  "suggestedTaskMode": "generate",
  "followUpMode": "auto-clarify",
  "clarifyChecklist": ["想解决的核心问题", "希望最终落到什么载体", "有没有必须保留或避开的元素"],
  "outputBlueprint": ["先给创意发散框架", "再拆成 3-5 条可比较的方向", "最后给推荐路线和下一步该切到哪个执行 skill"],
  "tags": ["lovart", "brainstorm", "concept", "direction", "creative"],
  "sources": [
    "https://www.lovart.ai/features/creative-brainstorming-with-ai-image-generator"
  ]
}
```

## Instruction
把“脑暴”当成前置工作流，不是漫无边际地列想法，而是要把一个模糊 brief 拉成几条可比较、可命名、可继续执行的创意路线。

## ClarifyQuestions
- 你现在最想解决的问题是什么：名字想不出来、风格没方向、卖点不聚焦，还是故事钩子太弱？
- 最终这次创意会落到什么载体：品牌、海报、短视频、社媒轮播、包装，还是一个整套 campaign？
- 有没有必须保留的关键词、元素、文化母题，或者明确不想碰的风格与竞品既视感？

## ExecutionOutline
- 先定义这次脑暴要回答的问题和评估标准，不要只丢一堆空灵概念词。
- 再发散成 3-5 条路线，每条都给命名、核心钩子、视觉语气和适配场景。
- 最后选择最值得继续推进的一条，并明确应切换到哪一个执行型 skill。

## ExecutionRecipe
- always :: generateCopy :: 先发散概念、命名和钩子，再决定是否进入研究或视觉验证
- explicit-research :: workspaceSearch :: 仅当用户明确要竞品、风格参考、趋势语境时补研究
- visual-request :: generateImage :: 当方向已收敛后再生成代表性概念帧，不要在脑暴阶段直接假装最终成片成立

## OutputBlueprint
- 先给这次脑暴的目标和评估维度。
- 再逐条给创意路线名、核心钩子、视觉语气、适配载体和潜在风险。
- 最后给推荐路线、淘汰理由和下一步应该进入的执行 skill。

## ToolPolicy
- generateCopy 是主工具，承担路线命名、钩子生成、故事骨架和方向比较。
- workspaceSearch 只在需要真实趋势、案例或参考语境时调用。
- generateImage 只用于代表性概念帧验证，不负责在脑暴阶段直接冒充最终资产。

## Notes
这个 preset 是“前置创意工作台”，最适合给后续 brand / poster / video / carousel skill 做路由前置。

## Research
参考 Lovart 的 Creative Brainstorming 功能页，核心是用 AI 先扩写创意路径和视觉路线，再把最佳方向推入后续 production workflow。

## ExamplePrompt
我要给一个“城市夜间修复”主题的护肤 campaign 做前期脑暴。请不要泛泛而谈，而是帮我先拉出 3 到 5 条可比较的创意路线，每条都要有命名、故事钩子、视觉关键词和更适合继续走海报、品牌还是视频的判断。
