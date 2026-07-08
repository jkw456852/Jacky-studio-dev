```json
{
  "type": "skill-preset",
  "id": "moodboard-direction-lab",
  "name": "方向情绪板",
  "description": "先把风格方向、关键词、材质语气和参考维度拉成可比较的 moodboard 方案，再决定往哪条视觉路线继续做。",
  "category": "research",
  "tab": "branding",
  "frontstagePriority": "secondary",
  "executionType": "agent",
  "activationHint": "适合品牌起盘、活动视觉找方向、空间/包装/海报前期提案，以及一切‘先把风格路线拉开’的探索任务。",
  "iconName": "Swatches",
  "order": 68,
  "skillDataId": "autonomous-main-brain",
  "skillDataName": "方向情绪板",
  "allowAutonomousRouting": true,
  "mode": "unified-sidebar-agent",
  "frontstageSkillId": "moodboard-direction-lab",
  "routeIntent": "branding",
  "routeLabel": "Moodboard",
  "routeSummary": "Bias toward visual territories, texture/material cues, palette families, and side-by-side direction comparison before execution.",
  "preferredSkills": ["generateCopy", "workspaceSearch", "generateImage"],
  "suggestedTaskMode": "generate",
  "followUpMode": "auto-clarify",
  "clarifyChecklist": ["要找方向的对象", "想拉开的风格维度", "最终会落到什么载体"],
  "outputBlueprint": ["先给方向轴和对比维度", "再拆每条 moodboard 路线的关键词与视觉特征", "最后给推荐路线与下一步执行建议"],
  "tags": ["lovart", "moodboard", "direction", "branding", "research"],
  "sources": [
    "https://www.lovart.ai/features/creative-brainstorming-with-ai-image-generator",
    "https://www.lovart.ai/features/ai-create-mood-board"
  ]
}
```

## Instruction
把 moodboard 当成“方向实验室”，核心不是直接出最终图，而是先把可比较的视觉路线拉开：风格关键词、色板、材质、摄影语气、排版氛围、适配载体。

## ClarifyQuestions
- 这次是给品牌、活动、空间、包装、海报还是内容栏目找方向？
- 想重点拉开什么维度：高级/年轻、冷静/戏剧化、科技/自然、极简/繁复，还是别的风格对比？
- 后续最终会落到什么载体：KV、海报、详情页、包装、视频封面还是整套品牌视觉？

## ExecutionOutline
- 先定义这次需要比较的方向轴和评估标准，不要直接把参考图堆成一锅。
- 再为每条路线梳理关键词、色板、材质、摄影语气和典型视觉标识。
- 最后决定哪条路线最值得继续生成，并明确下一步该进入 brand、poster、carousel 还是别的 workflow。

## ExecutionRecipe
- always :: generateCopy :: 先把方向轴、关键词和比较维度整理清楚，再进入视觉执行
- explicit-research :: workspaceSearch :: 当用户明确要竞品、案例、趋势或参考来源时再补研究
- visual-request :: generateImage :: 只在方向已明确后生成单路线 lookframe 或代表性 moodboard 画面，不要过早定最终成品

## OutputBlueprint
- 先给方向轴、比较框架和判断标准。
- 再逐条给 moodboard 路线的关键词、色板、材质、摄影/排版语气。
- 最后给推荐路线、放弃理由和下一步应该进入的 skill workflow。

## ToolPolicy
- generateCopy 优先承担方向整理、命名和路线比较，不要一上来用图掩盖判断空缺。
- workspaceSearch 只在需要真实案例、风格参照、行业趋势时调用。
- generateImage 只做单一方向样张或 representative frame，不要把所有路线压成一张最终成图。

## Notes
这个 preset 更像“前期方向决策器”，适合在真正进入海报、品牌、详情页 skill 之前先选路。

## Research
参考 Lovart 公布的 Mood Board 与 Creative Brainstorming 能力页，重点是先把 creative direction 拉开比较，再把选中的路线推入后续资产生成，而不是跳过判断直接出最终图。

## ExamplePrompt
我要给一款女性轻户外香氛做前期方向探索，请先帮我拉开 3 条 moodboard 路线，比如“清晨山林”“冷感都市”“日落草地”，每条都要写清关键词、色板、材质、摄影语气和更适合落到什么载体，最后推荐一条继续推进。
