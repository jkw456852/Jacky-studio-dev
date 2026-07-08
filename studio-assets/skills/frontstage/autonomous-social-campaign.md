```json
{
  "type": "skill-preset",
  "id": "autonomous-social-campaign",
  "name": "社媒内容",
  "description": "围绕封面、帖子、社媒系列图与传播场景来组织创意和执行。",
  "category": "agent",
  "tab": "social",
  "frontstagePriority": "primary",
  "executionType": "agent",
  "activationHint": "适合小红书、封面、海报、社媒系列内容和传播导向任务。",
  "iconName": "Hash",
  "order": 40,
  "skillDataId": "autonomous-main-brain",
  "skillDataName": "社媒内容",
  "allowAutonomousRouting": true,
  "mode": "unified-sidebar-agent",
  "frontstageSkillId": "autonomous-social-campaign",
  "routeIntent": "social",
  "routeLabel": "Social Media",
  "routeSummary": "Bias toward campaign, poster, copy, and multi-asset social content workflows.",
  "preferredSkills": ["generateImage", "generateCopy", "generateVideo"],
  "suggestedTaskMode": "generate",
  "followUpMode": "auto-clarify",
  "clarifyChecklist": ["发布渠道", "受众/卖点", "素材规格与数量"],
  "outputBlueprint": ["先明确传播角度", "再拆分封面/海报/文案资产"],
  "tags": ["lovart", "social", "campaign"]
}
```

## Instruction
优先把发布渠道、受众、传播目标和素材数量说清楚，再生成成套社媒资产，而不是只给一张孤立图片。

## ClarifyQuestions
- 这次主要发哪个平台，平台语境和尺寸规格是什么？
- 想打哪一个传播点，目标受众看到后要采取什么动作？
- 计划做几张或几条内容，现有素材或必须露出的信息有哪些？

## ExecutionOutline
- 先确定传播目标、平台语境和内容数量。
- 再把任务拆成封面、主视觉、文案、配图或视频片段等资产位。
- 最后给每个资产位的创意方向、信息重点和执行建议。

## ExecutionRecipe
- always :: none :: 先明确传播目标、平台语境和内容主线，再进入执行
- explicit-research :: workspaceSearch :: 仅在用户明确要案例、趋势或平台参考时补研究
- visual-request :: generateImage :: 按封面、海报或单页职责分别出图，不要把整套 campaign 压成一张图
- final-video :: generateVideo :: 只有明确要动态社媒资产时再进入视频生成

## OutputBlueprint
- 先给传播角度和内容主线。
- 再按资产位拆封面、帖子、配文和延展内容。
- 最后给制作顺序、素材清单和发帖建议。

## ToolPolicy
- 先用 generateCopy 稳定传播角度和文案结构，再决定视觉资产。
- 需要图像时，generateImage 应按单个资产职责生成，不要混成一张大杂烩。
- 只有用户明确需要热点、竞品或行业信息时，再调用 workspaceSearch 或视频相关技能。

## Notes
这是当前最通用的社媒类 skill，用来兜住封面、海报、帖子和内容系列。

## ExamplePrompt
我要为一款夏季控油防晒做一组小红书社媒内容，请先帮我明确传播角度、受众和资产数量，再拆成封面、单页海报、配文和可能的短视频延展。重点是转化导向，不要只给我一张孤立图片。
