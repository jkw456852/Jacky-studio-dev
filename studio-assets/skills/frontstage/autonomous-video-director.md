```json
{
  "type": "skill-preset",
  "id": "autonomous-video-director",
  "name": "视频创作",
  "description": "先理解脚本、镜头与参考，再优先往视频生成与分镜方向组织执行。",
  "category": "agent",
  "tab": "video",
  "frontstagePriority": "primary",
  "executionType": "agent",
  "activationHint": "适合短视频、动画、分镜到视频、镜头节奏这类任务。",
  "iconName": "Video",
  "order": 10,
  "skillDataId": "autonomous-main-brain",
  "skillDataName": "视频创作",
  "allowAutonomousRouting": true,
  "mode": "unified-sidebar-agent",
  "frontstageSkillId": "autonomous-video-director",
  "routeIntent": "video",
  "routeLabel": "Video",
  "routeSummary": "Prioritize storyboard, motion, video generation, and clip sequencing when the request allows it.",
  "preferredSkills": ["generateVideo", "generateImage", "smartEdit"],
  "suggestedTaskMode": "generate",
  "followUpMode": "auto-clarify",
  "clarifyChecklist": ["视频用途", "时长节奏", "镜头/风格参考"],
  "outputBlueprint": ["先给脚本/镜头拆解", "再给视频执行方案"],
  "tags": ["lovart", "video", "storyboard"]
}
```

## Instruction
优先围绕视频用途、时长、镜头与节奏来组织方案；如果用户只是说一个模糊目标，要先补问再推进。

## ClarifyQuestions
- 这支视频主要用在什么场景，最终希望观众完成什么动作？
- 目标时长、节奏密度和平台形态是什么？
- 有无镜头参考、风格参考、现成素材或必须保留的桥段？

## ExecutionOutline
- 先把视频目标、平台和时长框清楚。
- 再拆脚本、镜头、节奏和字幕/口播结构。
- 最后给关键帧、镜头连接和视频生成或拍摄执行建议。

## ExecutionRecipe
- always :: none :: 先锁定 hook、脚本节奏和镜头推进，再进入视觉或视频执行
- visual-request :: generateImage :: 先生成关键帧或 lookframe，给后续视频提供视觉锚点
- final-video :: generateVideo :: 在关键帧或镜头方向稳定后再进入最终视频生成

## OutputBlueprint
- 先给视频主线与结构判断。
- 再给脚本、镜头清单和节奏设计。
- 最后给执行建议、所需素材和风险提醒。

## ToolPolicy
- 先用 generateCopy 或文本规划稳定叙事与镜头逻辑。
- 需要 lookframe、镜头参考或分镜画面时再调用 generateImage。
- 只有分镜和节奏明确后，才进入 generateVideo 或其他视频执行链路。

## Notes
这是当前视频类默认前台入口，适合做总入口。

## ExamplePrompt
想做一条 20 秒的品牌短视频，主题是“夜跑女性的自我修复时刻”。请按视频工作流先帮我理清用途、时长、节奏和镜头参考，再给脚本、镜头结构和后续 lookframe / 视频生成执行建议。如果信息不够就先补问。
