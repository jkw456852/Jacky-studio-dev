```json
{
  "type": "skill-preset",
  "id": "social-carousel-system",
  "name": "社媒轮播",
  "description": "围绕封面、页序结构、信息递进和多页排版来组织轮播帖内容。",
  "category": "agent",
  "tab": "social",
  "frontstagePriority": "primary",
  "executionType": "agent",
  "activationHint": "适合小红书、Instagram、LinkedIn 等轮播帖和多页内容任务。",
  "iconName": "Layers",
  "order": 50,
  "skillDataId": "autonomous-main-brain",
  "skillDataName": "社媒轮播",
  "allowAutonomousRouting": true,
  "mode": "unified-sidebar-agent",
  "frontstageSkillId": "social-carousel-system",
  "routeIntent": "social",
  "routeLabel": "Carousel",
  "routeSummary": "Bias toward cover-page hooks, swipe narrative, per-page hierarchy, and multi-slide social storytelling.",
  "preferredSkills": ["generateImage", "generateCopy", "workspaceSearch"],
  "suggestedTaskMode": "generate",
  "followUpMode": "auto-clarify",
  "clarifyChecklist": ["平台与尺寸", "页数", "主题主线与每页信息层级"],
  "outputBlueprint": ["先给轮播主线", "再拆封面/内页/结尾 CTA", "最后给每页文案和视觉建议"],
  "tags": ["lovart", "carousel", "social"]
}
```

## Instruction
把轮播帖当成多页叙事结构，先定封面 hook 和页序逻辑，再拆每页信息和视觉角色。

## ClarifyQuestions
- 这次主要发哪个平台，尺寸或比例有没有固定要求？
- 一共准备做几页，封面和结尾 CTA 需要承担什么任务？
- 这组轮播最想推进的主线是什么，有没有必须出现的信息层级？

## ExecutionOutline
- 先确认平台尺寸、页数和主线目标。
- 再定义封面 hook、页序递进和每页角色分工。
- 最后输出每页文案、视觉重点和可直接执行的生成建议。

## ExecutionRecipe
- always :: none :: 先确定封面 hook、传播主线和页序角色，再进入执行
- explicit-research :: workspaceSearch :: 仅在用户明确要案例、趋势或平台参考时补研究
- visual-request :: generateImage :: 按封面或分页职责分别出图，不要把整套内容压成一张图

## OutputBlueprint
- 先给轮播主线与封面 hook。
- 再逐页拆信息层级、文案角色和视觉重点。
- 最后给结尾 CTA、制作顺序和执行建议。

## ToolPolicy
- 先用 generateCopy 稳定页序与文案骨架，再决定是否进入画面生成。
- 如需视觉稿，generateImage 应按页面职责分别生成，不要把整套轮播压成一张图。
- 只有用户明确要补竞品、趋势或案例时，才调用 workspaceSearch 补研究。

## Notes
比通用“社媒内容”更适合多页内容和 swipe narrative。

## Research
参考 Lovart 官方 Carousel 类案例，这类任务最核心的是页序结构，不是单页视觉。

## ExamplePrompt
帮我做一组 7 页的小红书轮播，主题是“为什么你的抗老护肤一直没效果”。请先确定封面 hook、页序推进和每页角色，再逐页给标题、信息重点、文案语气和视觉建议。如果需要补信息，就先按轮播工作流补问。
