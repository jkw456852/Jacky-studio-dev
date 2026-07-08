```json
{
  "type": "skill-preset",
  "id": "ecom-oneclick-workflow",
  "name": "电商一键方案",
  "description": "围绕商品图与诉求自动补问并推进整套电商工作流。",
  "category": "workflow",
  "tab": "commerce",
  "frontstagePriority": "primary",
  "executionType": "workflow",
  "activationHint": "进入电商工作流，会先补问再推进，不是普通聊天。",
  "iconName": "Library",
  "order": 100,
  "skillDataId": "ecom-oneclick-workflow",
  "skillDataName": "电商一键工作流",
  "requiresAttachments": true,
  "followUpMode": "auto-clarify",
  "allowAutonomousRouting": true,
  "mode": "workflow",
  "frontstageSkillId": "ecom-oneclick-workflow",
  "clarifyChecklist": ["商品与卖点", "目标平台", "商品图/参考素材"],
  "outputBlueprint": ["先补齐商品卖点", "再输出转化导向物料方案"],
  "examplePrompt": "我有一组美容仪商品图，目标做天猫详情页和首发主图，先按电商工作流帮我补问并规划。",
  "tags": ["commerce", "workflow", "ecommerce"]
}
```

## Instruction
围绕商品、卖点、平台和参考图先补齐关键输入，再走完整的电商物料规划与执行工作流。

## ClarifyQuestions
- 这次主要卖什么，最想先打哪几个卖点？
- 目标平台、目标人群和转化目标是什么？
- 现有商品图、参考页、竞品案例或限制条件有哪些？

## ExecutionOutline
- 先补齐商品真值、平台目标和转化重点。
- 再拆成详情页、海报、KV、卖点图等合适的电商资产路径。
- 最后把任务送入完整工作流并给出阶段性产出预期。

## ExecutionRecipe
- always :: none :: 先锁定商品真值、平台与转化目标，再决定该走哪条电商资产路径
- explicit-research :: workspaceSearch :: 只有用户明确要竞品、趋势或平台案例时再补研究
- visual-request :: generateCopy :: 先输出页型/资产结构、卖点顺序与执行清单，再把任务送入具体工作流

## OutputBlueprint
- 先列出已知输入和仍缺的关键信息。
- 再给推荐的电商物料结构与执行顺序。
- 最后给工作流产出目标、校验点和下一步。

## ToolPolicy
- 优先调用完整电商工作流，不要把整套电商任务压成单张图。
- 商品图、卖点和平台约束高于风格发挥。
- 只有在工作流关键输入缺失时才停下来补问，其余情况继续推进。

## Notes
这个 preset 更像电商总控入口，负责把商品图、卖点、平台和后续资产路径串起来，再进入细分执行。

## Research
参考 Lovart 对 skill/agent workflow 的前台化方式，以及电商一站式设计产品的常见路径，这类 workflow 的核心不是单次出图，而是先把“卖点-页型-执行顺序”明确下来。

## ExamplePrompt
我想围绕一款胶原炮家用美容仪快速拉起整套电商方案，目标平台是天猫，已有商品图和几个核心卖点。请先补问商品、平台和素材缺口，再按电商工作流帮我拆首页主视觉、详情页、卖点页和后续需要的延展资产。
