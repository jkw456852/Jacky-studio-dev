```json
{
  "type": "skill-preset",
  "id": "blog-to-carousel-repurpose",
  "name": "长文转轮播",
  "description": "把博客、文章、长文摘要拆成封面 hook、页序结构和可发布的社媒轮播。",
  "category": "agent",
  "tab": "social",
  "frontstagePriority": "secondary",
  "executionType": "agent",
  "activationHint": "适合把博客、newsletter、访谈纪要或长文内容改造成 Instagram / 小红书 / LinkedIn 轮播。",
  "iconName": "Library",
  "order": 45,
  "skillDataId": "autonomous-main-brain",
  "skillDataName": "长文转轮播",
  "allowAutonomousRouting": true,
  "mode": "unified-sidebar-agent",
  "frontstageSkillId": "blog-to-carousel-repurpose",
  "routeIntent": "social",
  "routeLabel": "Repurpose",
  "routeSummary": "Bias toward summarization, slide narrative, cover hooks, typography hierarchy, and multi-format carousel output.",
  "preferredSkills": ["generateImage", "generateCopy", "workspaceSearch"],
  "suggestedTaskMode": "generate",
  "followUpMode": "auto-clarify",
  "clarifyChecklist": ["原始内容", "平台/比例", "页数与想强调的主线"],
  "outputBlueprint": ["先给轮播主线和封面 hook", "再逐页拆标题/信息点/视觉方向", "最后给发布格式和导出建议"],
  "tags": ["lovart", "carousel", "repurpose", "social", "content"],
  "sources": [
    "https://www.lovart.ai/features/blog-post-to-instagram-ai-repurposing",
    "https://www.lovart.ai/blog/02-cluster-instagram-carousel"
  ]
}
```

## Instruction
把长文内容先压缩成适合移动端阅读的轮播主线，再拆成封面、分页叙事和结尾 CTA，不要只是把原文机械分段贴进图片里。

## ClarifyQuestions
- 原始内容是博客、newsletter、采访纪要还是课程笔记，哪一部分最值得做成封面 hook？
- 主要发哪个平台，想做 1:1、4:5 还是 9:16 变体？
- 这组轮播更偏教育、观点、案例总结还是转化导向？

## ExecutionOutline
- 先提炼原始内容里最值得传播的主线和封面 hook。
- 再把内容拆成 5-10 页的轮播节奏，明确每页承担的信息角色。
- 最后补齐每页标题、正文层级、视觉 metaphor 和导出规格建议。

## ExecutionRecipe
- always :: none :: 先提炼主线、封面 hook 和页序节奏，再进入视觉执行
- visual-request :: generateImage :: 按封面或分页职责分别出图，不要把整套内容压成一张图
- explicit-research :: workspaceSearch :: 仅在用户明确要补案例、行业趋势或参考素材时补研究

## OutputBlueprint
- 先给轮播主线、封面标题和阅读承诺。
- 再逐页给页标题、关键信息、视觉方向和文案层级。
- 最后给导出比例、封面优先级和发布建议。

## ToolPolicy
- 先稳定 slide narrative 和标题层级，再考虑每页具体视觉。
- 文案要为移动端阅读优化，避免大段原文照搬。
- 如果需要多规格导出，优先保住封面和核心信息层级的一致性。

## Notes
这个 preset 更偏“内容 repurpose”，和通用社媒轮播的区别在于它先做总结和重组，再做分页视觉。

## Research
参考 Lovart 的 Blog Post to Instagram Carousels 能力页和 Carousel 博文，这类任务的重点是 smart summarization、auto-carousel layouts、typography hierarchy 和多格式导出。

## ExamplePrompt
把这篇关于“抗糖护肤误区”的长文改造成 8 页小红书轮播。请先帮我提炼最适合移动端传播的主线和封面 hook，再逐页拆标题、信息点、视觉重点和结尾 CTA，不要把原文机械切段贴进去。
