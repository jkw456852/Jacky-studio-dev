```json
{
  "type": "skill-preset",
  "id": "ad-storyboard",
  "name": "广告分镜",
  "description": "把一句广告 brief 拆成 hook、镜头、画面转场与拍摄/生成执行单。",
  "category": "agent",
  "tab": "video",
  "frontstagePriority": "secondary",
  "executionType": "agent",
  "activationHint": "适合广告视频、种草片、脚本到分镜的前期策划任务。",
  "iconName": "Layers",
  "order": 30,
  "skillDataId": "autonomous-main-brain",
  "skillDataName": "广告分镜",
  "allowAutonomousRouting": true,
  "mode": "unified-sidebar-agent",
  "frontstageSkillId": "ad-storyboard",
  "routeIntent": "video",
  "routeLabel": "Storyboard",
  "routeSummary": "Bias toward storyboard beats, shot continuity, edit rhythm, and ad-specific scene progression.",
  "preferredSkills": ["generateVideo", "generateImage", "generateCopy"],
  "suggestedTaskMode": "generate",
  "followUpMode": "auto-clarify",
  "clarifyChecklist": ["投放场景", "核心卖点/主钩子", "时长与镜头参考"],
  "outputBlueprint": ["先给广告结构", "再拆镜头/字幕/转场", "最后给生成或拍摄执行建议"],
  "tags": ["lovart", "storyboard", "video", "ads"]
}
```

## Instruction
先把广告唯一任务说清楚，再按镜头顺序拆出 hook、主体动作、镜头语言、字幕信息和结尾 CTA。若素材不足，优先补问而不是直接产出空分镜。

## ClarifyQuestions
- 这条广告主要投放在哪个场景，想让用户看完做什么？
- 核心卖点或主钩子是什么，第一秒必须抓住什么信息？
- 目标时长、镜头节奏或参考风格有没有明确要求？

## ExecutionOutline
- 先把广告唯一任务、目标受众和 CTA 定死。
- 再按 hook、主体、转场、结尾的顺序拆镜头节奏。
- 最后补齐字幕、口播、拍摄/生成所需的素材与执行提示。

## ExecutionRecipe
- always :: none :: 先锁定广告 hook、镜头推进和 CTA，再进入视觉或视频执行
- visual-request :: generateImage :: 先生成关键帧或 lookframe，验证分镜方向和画面连续性
- final-video :: generateVideo :: 在镜头结构和关键帧稳定后再进入最终视频生成

## OutputBlueprint
- 先给广告结构和 hook 判断。
- 再按镜头顺序列出画面、动作、字幕、转场。
- 最后给拍摄或生成执行建议与缺失素材提醒。

## ToolPolicy
- 优先用 generateCopy 稳定脚本和镜头结构，不要一上来直接出成片提示词。
- 需要 lookframe 或关键帧时再调用 generateImage，且按镜头职责分别生成。
- 只有在镜头和节奏已经稳定后，才考虑 generateVideo 或后续视频执行。

## Notes
更适合“要先把视频脚本与镜头规划清楚”的场景，而不是直接要最终成片提示词。

## Research
来自对 Lovart 官方 Storyboard / video 工作流案例的整理，重点不是单纯写脚本，而是把镜头和生成执行衔接起来。

## ExamplePrompt
给一款胶原蛋白饮的 15 秒小红书投流短视频做分镜。目标是第一秒抓住“熬夜脸急救”这个钩子，整体节奏要快，偏高级 clean beauty 质感。请先给广告结构，再按镜头顺序拆画面、动作、字幕、转场和结尾 CTA，如果素材不足先告诉我该补什么。
