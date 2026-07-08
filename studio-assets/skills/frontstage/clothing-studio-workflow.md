```json
{
  "type": "skill-preset",
  "id": "clothing-studio-workflow",
  "name": "服饰工作流",
  "description": "适合服饰图、模特图和穿搭任务的多阶段处理流程。",
  "category": "workflow",
  "tab": "branding",
  "frontstagePriority": "secondary",
  "executionType": "workflow",
  "activationHint": "进入服饰工作流，会围绕服装图和诉求分阶段推进。",
  "iconName": "ImageIcon",
  "order": 90,
  "skillDataId": "clothing-studio-workflow",
  "skillDataName": "服饰工作流",
  "requiresAttachments": true,
  "followUpMode": "auto-clarify",
  "mode": "workflow",
  "frontstageSkillId": "clothing-studio-workflow",
  "clarifyChecklist": ["服饰图/模特图", "风格目标", "需要保留或规避的限制"],
  "examplePrompt": "我有一组女装平铺图，想做电商模特上身图，先按服饰工作流补问并规划不要动的版型和花色。",
  "tags": ["workflow", "fashion"]
}
```

## Instruction
优先确认参考服饰图、目标风格和不能动的约束，再进入服饰图多阶段处理链路。

## ClarifyQuestions
- 要处理的是服饰平铺图、模特图还是穿搭场景图？
- 目标风格、上身效果或场景氛围想往哪里走？
- 哪些元素绝对不能动，例如版型、花色、logo、人物特征或肤色？

## ExecutionOutline
- 先核对参考图、目标风格和不可变约束。
- 再选择合适的服饰工作流阶段，例如抠图、换景、模特优化、穿搭延展或细节修复。
- 最后按阶段输出执行计划、结果预期和需要补充的素材。

## ExecutionRecipe
- always :: none :: 先锁定服饰真值、不可变约束与目标穿搭场景，再决定进入哪一阶段
- attachment-edit :: smartEdit :: 可局部解决的优先走局部编辑，不要一上来整图重生
- visual-request :: generateImage :: 当约束与阶段明确后，再进入对应的模特图、棚拍图或场景图执行

## OutputBlueprint
- 先确认输入资产与限制条件。
- 再给推荐工作流阶段和每阶段目标。
- 最后给执行结果、校验点和下一步建议。

## ToolPolicy
- 附件中的服饰或模特图是主体真值，不要在执行中擅自换款或改版型。
- 能用局部编辑解决的，不要先走整图重生。
- 只有缺少关键参考或约束时才补问，其余情况优先推进分阶段执行。

## Notes
这个 workflow 的核心是“先锁真值再分阶段推进”，特别适合容易因为 AI 发散而丢掉版型、花色、logo 或人物特征的服饰任务。

## Research
参考服饰电商图生成与 try-on 类产品的常见工作流，这类任务最重要的是守住服装真值、模特一致性和局部编辑优先级，而不是无约束重生整图。

## ExamplePrompt
我有一张连衣裙平铺图和一张模特参考图，想做成法式通勤感的上身展示，同时必须保留裙摆花型、版型和腰线。请先确认服饰真值、目标风格和不能动的约束，再按服饰工作流推进，不要一上来重生整图把衣服做跑偏。
