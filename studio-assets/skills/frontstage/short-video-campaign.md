```json
{
  "type": "skill-preset",
  "id": "short-video-campaign",
  "name": "短视频成片",
  "description": "围绕 Reels、Shorts、抖音等短视频场景组织脚本、镜头、字幕和成片节奏。",
  "category": "agent",
  "tab": "video",
  "frontstagePriority": "primary",
  "executionType": "agent",
  "activationHint": "适合短视频脚本、口播、产品短片、短内容成片规划。",
  "iconName": "Video",
  "order": 20,
  "skillDataId": "autonomous-main-brain",
  "skillDataName": "短视频成片",
  "allowAutonomousRouting": true,
  "mode": "unified-sidebar-agent",
  "frontstageSkillId": "short-video-campaign",
  "routeIntent": "video",
  "routeLabel": "Short Video",
  "routeSummary": "Bias toward hook-first short-form scripts, platform pacing, subtitles, clip progression, and publish-ready deliverables.",
  "preferredSkills": ["generateVideo", "generateImage", "generateCopy"],
  "suggestedTaskMode": "generate",
  "followUpMode": "auto-clarify",
  "clarifyChecklist": ["发布平台", "目标时长", "核心卖点/脚本方向"],
  "outputBlueprint": ["先给 hook/脚本", "再给镜头和字幕节奏", "最后给执行素材建议"],
  "tags": ["lovart", "shorts", "reels", "video"]
}
```

## Instruction
先确认平台、时长和内容钩子，再组织短视频脚本、镜头、字幕和节奏，不要直接把长视频逻辑硬塞进短视频。

## ClarifyQuestions
- 主要发布在哪个平台，平台语境和比例是什么？
- 目标时长和第一秒 hook 想抓什么？
- 有无现成脚本、口播、素材或必须参考的短视频风格？

## ExecutionOutline
- 先对齐平台、时长和主钩子。
- 再拆脚本节奏、镜头推进和字幕或口播安排。
- 最后给素材准备、生成建议和发布前检查点。

## ExecutionRecipe
- always :: none :: 先锁定平台语境、hook 和镜头节奏，再进入视觉或视频执行
- visual-request :: generateImage :: 先生成关键帧或封面 lookframe，验证短视频视觉锚点
- final-video :: generateVideo :: 在脚本和关键帧稳定后再进入最终视频生成

## OutputBlueprint
- 先给 hook 与短视频结构。
- 再给镜头、字幕、节奏和转场安排。
- 最后给执行建议、素材清单和平台适配提醒。

## ToolPolicy
- 短视频先保 hook 和节奏，不要套用长视频式铺陈。
- 先用 generateCopy 稳定脚本，再按镜头需求调用 generateImage 或 generateVideo。
- 如果只是缺少平台或时长等关键输入，先补问再执行。

## Notes
这是比“视频创作”更具体的短内容成片 skill，适合直接前台化。

## Research
来自 Lovart 官方 Shorts / video 相关案例，重点是把“脚本-镜头-字幕-平台适配”打通。

## ExamplePrompt
帮我做一条 12 秒抖音短视频成片方案，产品是一款晒后修复喷雾，重点要在前 2 秒把“降温舒缓”打出来。请先给 hook 和脚本，再拆镜头、字幕节奏和执行素材建议，确认结构后再考虑视频生成。
