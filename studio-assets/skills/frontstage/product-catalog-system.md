```json
{
  "type": "skill-preset",
  "id": "product-catalog-system",
  "name": "商品目录",
  "description": "围绕商品目录、系列卖点页和规格页来批量组织目录型电商物料。",
  "category": "agent",
  "tab": "commerce",
  "frontstagePriority": "primary",
  "executionType": "agent",
  "activationHint": "适合产品目录、招商册、系列商品页和目录式详情页任务。",
  "iconName": "Box",
  "order": 120,
  "skillDataId": "autonomous-main-brain",
  "skillDataName": "商品目录",
  "requiresAttachments": true,
  "allowAutonomousRouting": true,
  "mode": "unified-sidebar-agent",
  "frontstageSkillId": "product-catalog-system",
  "routeIntent": "commerce",
  "routeLabel": "Product Catalogue",
  "routeSummary": "Bias toward multi-product catalog pages, SKU grouping, feature modules, and series-based commerce layouts.",
  "preferredSkills": ["workspaceSearch", "generateImage", "generateCopy"],
  "suggestedTaskMode": "generate",
  "followUpMode": "auto-clarify",
  "clarifyChecklist": ["商品系列/sku", "目录用途", "商品图与规格信息"],
  "outputBlueprint": ["先梳理目录结构", "再拆页型/模块", "最后给每页执行素材建议"],
  "tags": ["lovart", "catalog", "commerce"]
}
```

## Instruction
把目录类任务先拆成系列结构、sku 分组和页型模块，再进入图文资产执行，不要把目录任务当单页海报来做。

## ClarifyQuestions
- 这次目录里有几个系列或 sku，需要怎么分组？
- 目录是招商册、销售册、电商目录还是产品说明册？
- 商品图、规格参数和每页必须呈现的信息有没有现成素材？

## ExecutionOutline
- 先梳理系列结构、sku 分组和页数范围。
- 再定义封面、目录、系列页、单品页、参数页等页型模块。
- 最后给每类页面的内容重点、视觉策略和执行建议。

## ExecutionRecipe
- always :: none :: 先锁定商品真值、分类逻辑和页面结构，再进入执行
- explicit-research :: workspaceSearch :: 仅在用户明确要竞品、平台趋势或案例时补研究
- visual-request :: generateImage :: 按页面或模块职责分别出图，不要退化成单张海报

## OutputBlueprint
- 先给整本目录结构和页型框架。
- 再按页型拆内容模块、商品分组和版面角色。
- 最后给每页素材建议、批量生成思路和后续动作。

## ToolPolicy
- 目录类任务默认是多商品多页结构，不要退化成单图 KV。
- 优先用 generateCopy 整理页型和内容层级，再决定哪些页需要 generateImage。
- 需要补产品参数、行业案例或品类信息时，再调用 workspaceSearch。

## Notes
适合产品目录、招商册、系列商品说明页这类“多商品、多页、多模块”任务。

## Research
参考 Lovart 官方 Product Catalogue 场景，用户真正要的是批量目录化结构，而不是一张图。

## ExamplePrompt
我要给一个 12 个 sku 的香氛系列做招商目录，里面既要有系列概览，也要有单品规格和卖点页。请先帮我梳理目录结构、sku 分组和页型模块，再拆每页需要的文案与视觉素材，不要按单页海报思路做。
