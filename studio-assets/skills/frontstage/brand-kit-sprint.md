```json
{
  "type": "skill-preset",
  "id": "brand-kit-sprint",
  "name": "品牌套件冲刺",
  "description": "从一条品牌 brief 快速拉起 logo 方向、色彩/字体系统、样机和首批对外资产。",
  "category": "agent",
  "tab": "branding",
  "frontstagePriority": "secondary",
  "executionType": "agent",
  "activationHint": "适合新品牌起盘、子品牌发布、campaign visual refresh 这类一条 brief 拉起整套品牌资产的任务。",
  "iconName": "Sparkles",
  "order": 75,
  "skillDataId": "autonomous-main-brain",
  "skillDataName": "品牌套件冲刺",
  "allowAutonomousRouting": true,
  "mode": "unified-sidebar-agent",
  "frontstageSkillId": "brand-kit-sprint",
  "routeIntent": "branding",
  "routeLabel": "Brand Kit",
  "routeSummary": "Bias toward one-brief brand kit generation across logo direction, palette, typography, mockups, launch assets, and on-brand continuity.",
  "preferredSkills": ["generateImage", "generateCopy", "generateVideo"],
  "suggestedTaskMode": "generate",
  "followUpMode": "auto-clarify",
  "clarifyChecklist": ["品牌一句话定位", "目标受众", "首发资产范围"],
  "outputBlueprint": ["先给品牌支柱和视觉母体", "再拆 logo/色彩/字体/样机/首发资产", "最后给执行顺序和缺口提醒"],
  "tags": ["lovart", "brand-kit", "launch", "branding"],
  "sources": [
    "https://www.tomsguide.com/ai/with-one-prompt-i-built-an-entire-brand-kit-in-an-hour-using-lovart",
    "https://www.lovart.ai/docs/how-to-prompt/agent-skills",
    "https://www.lovart.ai/blog/02-wiki-custom-skills-guide"
  ]
}
```

## Instruction
把“品牌套件”当成一组有先后顺序的资产系统来推进，先定母体和规则，再扩展到 logo、样机、页面和视频，不要把所有资产当成同一张 moodboard。

## ClarifyQuestions
- 这个品牌一句话是做什么的，最想占住的心智是什么？
- 第一批真正要拿出去用的资产有哪些，logo、包装、landing page、社媒还是 promo video？
- 有没有必须沿用或明确避开的品牌参考、行业惯例和视觉禁区？

## ExecutionOutline
- 先锁定品牌支柱、语气、受众和首发资产范围。
- 再定义 logo 方向、色彩/字体系统、材质和核心 KV 母体。
- 最后把系统延展成 mockup、首屏、社媒和视频等首批可发布资产。

## ExecutionRecipe
- always :: none :: 先统一品牌母体、受众和首发资产清单，再进入视觉执行
- visual-request :: generateImage :: 先分别验证 logo / KV / mockup 等关键资产，不要把整套品牌压成一张图
- final-video :: generateVideo :: 只有明确要品牌 promo video 或 motion asset 时再进入视频生成

## OutputBlueprint
- 先给品牌支柱、关键词和视觉母体判断。
- 再给 logo、色彩、字体、KV、mockup 和首批资产拆解。
- 最后给执行顺序、素材缺口和发布前检查点。

## ToolPolicy
- 先稳住品牌母体和系统规则，再展开资产生成。
- 不要为了快出图跳过 logo / 色彩 / 字体等系统判断。
- 需要视频时把它当作套件延展的一部分，而不是独立脱节资产。

## Notes
这个 preset 更偏 launch sprint，适合“一条 brief 拉起多资产”的品牌起盘场景，不等同于只做 style guide。

## Research
参考 Tom's Guide 对 Lovart 一条 prompt 生成完整 brand kit 的评测，以及 Lovart 对 custom skills / agent skills 的工作流描述，强调的是 one-brief orchestration、统一品牌连续性和多资产联动，而不是单张 KV 产出。

## ExamplePrompt
给一个新消费香氛品牌快速拉起首发 brand kit。品牌关键词是“冷静、留白、都市夜色”，首批需要 logo 方向、色彩/字体系统、主 KV、包装样机和首屏 hero。请先定品牌母体和视觉规则，再拆每类资产的执行顺序与缺失信息。
