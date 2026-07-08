```json
{
  "type": "skill-preset",
  "id": "jkai-oneclick",
  "name": "One Click",
  "description": "走 JKAI One-Click 流程，适合快速生成整套方案建议。",
  "category": "workflow",
  "tab": "social",
  "frontstagePriority": "secondary",
  "executionType": "skill",
  "activationHint": "直接进入 One Click 执行链路，优先给出整套方案建议。",
  "iconName": "Zap",
  "order": 60,
  "skillDataId": "jkai-oneclick",
  "skillDataName": "JKAI One-Click",
  "followUpMode": "direct-run",
  "frontstageSkillId": "jkai-oneclick",
  "clarifyChecklist": ["目标结果", "参考方向", "是否有素材"],
  "examplePrompt": "帮我基于现有商品图和品牌调性，先快速收敛一套可执行的社媒首发方案。",
  "tags": ["workflow", "one-click"]
}
```

## Instruction
优先给出整套方案建议，适合需要快速收敛方案方向的任务。

## ClarifyQuestions
- 这次最想快速收敛的结果是什么，是方向、文案还是视觉方案？
- 有没有必须参考的素材、品牌约束或输出形式？
- 希望我先给完整方案建议，还是直接进某个执行链路？

## ExecutionOutline
- 先快速识别任务目标和已有输入。
- 再给一版整套方案建议，帮助用户判断应该走哪条执行路径。
- 最后把最适合的后续动作、工具或工作流标出来。

## ExecutionRecipe
- always :: none :: 先判断这次任务最应该先收敛方向、资产结构还是执行入口，再进入具体建议
- explicit-research :: workspaceSearch :: 只有用户明确要案例、竞品或趋势参考时再补研究
- visual-request :: generateCopy :: 先用结构化方案把任务拆清楚，再决定是否进入图片、视频或工作流执行

## OutputBlueprint
- 先给方向判断和方案摘要。
- 再给核心建议、可选路径和优先级。
- 最后给下一步推荐动作或执行入口。

## ToolPolicy
- 优先给可判断方向的整套建议，不要把回复拆得过碎。
- 输入足够时可直接路由到更具体的 workflow 或 agent skill。
- 如果任务已非常明确，不要强行停留在 one-click 概览层。

## Notes
这个 preset 的职责不是替代所有 skill，而是在任务还没完全定型时，先把用户带到最合适的执行路径上。

## Research
参考 Lovart 的 agent skills / custom skills 公开说明，以及第三方对其“一条 prompt 先收敛整套方向再落到执行”的评测逻辑，这类入口型 skill 最重要的是快速形成任务结构和下一步，而不是直接产出最终素材。

## ExamplePrompt
我现在只知道想给新品做一波“高级但能转化”的视觉内容，还没想清楚到底先做海报、轮播还是详情页。请先按 One Click 的方式帮我快速收敛目标结果、参考方向和下一步最适合走的执行路径，不要直接盲目出图。
