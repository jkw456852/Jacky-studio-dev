# 电商可编辑上字方案进度总结

更新时间：2026-04-01

## 目标背景

这轮开发的目标不是继续强化“无字底图后排版”路线，而是把流程改成更接近老流程的体验：

1. 生图阶段尽量保留原始构图和画面一体性
2. 系统接管最终文字内容，生成可编辑文字层
3. 当方案要求 `replace-generated-text` 时，先擦掉图里的原生文字，再替换成可编辑文字层

核心意图是解决：

- AI 直接生中文文字容易乱码
- 纯后排版容易破坏原图排版感
- 旧流程“自己想文案且排得好看”的优势没有被继承

## 本轮已完成

### 1. 结果数据结构已补齐

已在工作流类型里补充并打通以下能力：

- `copyPlan`
- `textContainerIntents`
- `overlayState.textContainerIntents`
- `overlayState.baseImageUrl`
- `layoutMeta / layoutSnapshot`

相关文件：

- [types/workflow.types.ts](/e:/ai网站/XC-STUDIO/types/workflow.types.ts)

### 2. 方案结果会自动带出可编辑上字种子

现在电商方案项里的：

- 文案计划 `copyPlan`
- 文字容器意图 `textContainerIntents`
- 版式意图 `layoutIntent`

会在结果生成后自动种到结果对象里，不再只是停留在方案阶段。

已实现：

- 从 plan item 构建 `layoutSnapshot`
- 从 `copyPlan` 构建初始 `overlayState`
- 单条生成、批量生成都会自动写入这些信息
- 已有结果在 plan 同步时也会补种这些信息

相关文件：

- [pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts](/e:/ai网站/XC-STUDIO/pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts)

### 3. 已新增“可编辑文字层布局”共享 helper

已新增一个专门的 helper，把电商结果里的 overlay 内容转换成真实画布文字层蓝图。

当前能力：

- 根据 `templateId`、`layoutMeta`、文字内容量推导文字层布局
- 输出可插入画布的文字层列表
- 输出 `replace-generated-text` 所需的替换区域框

相关文件：

- [utils/ecommerce-text-layer-plan.ts](/e:/ai网站/XC-STUDIO/utils/ecommerce-text-layer-plan.ts)

### 4. 已接入 `replace-generated-text` 擦字预处理链路

现在如果某个结果的 `textContainerIntents` 里存在：

- `replacementMode === "replace-generated-text"`

系统会在“进画布”或“应用上字/导出”前，先做一次底图预处理：

1. 根据预测文字区域生成 mask
2. 调用 `smartEditSkill` 做擦字
3. 尽量把擦字后的底图保存为项目资产
4. 把新底图写回 `overlayState.baseImageUrl`

这样后续可编辑文字层会落在“干净底图”上，而不是直接压在原始带字图上。

相关文件：

- [pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts](/e:/ai网站/XC-STUDIO/pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts)

### 5. “进画布”已升级为底图加可编辑文字层

现在电商结果的“进画布”已经不是简单插入一张图片。

当前行为：

- 普通结果：继续按旧逻辑插入单张图
- 有 overlay 内容的电商结果：
  - 先准备底图
  - 有需要时先擦字
  - 插入底图 image element
  - 插入多个可编辑 text element
  - 自动成组，便于整体移动

相关文件：

- [pages/Workspace.tsx](/e:/ai网站/XC-STUDIO/pages/Workspace.tsx)

### 6. 缓存恢复已兼容新字段

已补上本地缓存的清洗与恢复逻辑，避免以下信息丢失：

- `textContainerIntents`
- `baseImageUrl`
- 新的 overlayState 内容

相关文件：

- [pages/Workspace.tsx](/e:/ai网站/XC-STUDIO/pages/Workspace.tsx)

### 7. UI 事件签名已升级

电商结果卡片、抽屉、侧边栏等位置，`onInsertToCanvas` 已升级为支持传完整 `EcommerceResultItem`，这样“进画布”时可以拿到：

- 原始结果图
- overlayState
- layoutMeta
- replace-generated-text 配置

相关文件：

- [pages/Workspace/components/workflow/EcommerceOneClickCards.tsx](/e:/ai网站/XC-STUDIO/pages/Workspace/components/workflow/EcommerceOneClickCards.tsx)
- [pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx](/e:/ai网站/XC-STUDIO/pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx)
- [pages/Workspace/components/AgentMessage.tsx](/e:/ai网站/XC-STUDIO/pages/Workspace/components/AgentMessage.tsx)
- [pages/Workspace/components/AssistantSidebar.tsx](/e:/ai网站/XC-STUDIO/pages/Workspace/components/AssistantSidebar.tsx)

### 8. 编译状态

已执行：

```bash
npx tsc --noEmit --pretty false
```

当前状态：

- 已通过

### 9. 老流程原理已继续下沉到“图型级模板库”

本轮已新增独立 helper，把原先堆在控制器里的老流程图型规则抽离出来，开始形成更稳定的“图型级模板库”。

当前已下沉并接入：

- 图型识别 `inferLegacyPromptProfile`
- 图型模板定义 `buildLegacyPromptProfile`
- 图型原理块 `buildLegacyPromptPrincipleLines`
- 图型执行块 `buildLegacyPromptExecutionLines`
- 图型默认版式倾向 `buildLegacyLayoutIntentDefaults`
- 规划阶段的图型模板库上下文 `buildLegacyTypeTemplateLibraryBlock`

已接入位置：

- 规划阶段：会把当前选中的图型，映射成老流程模板库参考，再一起喂给规划上下文
- 生图阶段：单图 prompt 现在会同时吸收
  - 老流程通用单图原则
  - 当前图型的“原理块”
  - 当前图型的“模板纪律”
  - 当前图型的“执行加压”
- prompt 整理阶段：也继续带着这三层信息做最终提示词收束

相关文件：

- [utils/ecommerce-old-flow-template-library.ts](/e:/ai网站/XC-STUDIO/utils/ecommerce-old-flow-template-library.ts)
- [pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts](/e:/ai网站/XC-STUDIO/pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts)

### 10. “带字直出 + 原位替换”链路的擦字/替字质量已做一轮提升

本轮没有去碰中文很重的 skill 主文件，而是在控制器和布局 helper 里先把“检测、框选、蒙版”三段抬质量。

已完成：

- 强化文字锚点检测提示词
  - 更强调返回“可替换的块级文字区域”
  - 要求合并同组标题/价格/卖点块
  - 忽略包装微字、水印、装饰性碎字和非营销文本
- 替换框从统一 padding 升级为“角色感知 padding”
  - headline / subheadline / price / cta / bullets 等会用不同扩边策略
- 替换框开始结合“默认版式区域”做锚点匹配
  - 不再只看文字内容和 role，也会看它是否落在该角色合理区域附近
- 替换框支持近邻合并
  - 同一信息家族里相邻、重叠或非常接近的框会合并，减少擦字后断裂感
- 蒙版绘制从硬矩形升级为圆角区域
  - 更接近真实电商字块边缘，减少“方块修补感”

### 11. 原位替换策略已继续细分到不同图型

本轮开始把原位替换不再当成一套统一规则处理，而是按更接近老流程的图型语义做差异化策略。

当前已接入的图型替换策略：

- `hero`
- `selling`
- `comparison`
- `spec`
- `detail`
- `scene`
- 以及兼容 `conversion / white-bg`

当前作用位置：

- 替换框的扩边尺度
- 圆角半径
- 相邻框的合并阈值
- 锚点和模板共同参与时的策略判断

当前效果目标：

- `hero / scene` 更强调大标题和自然留白
- `selling / comparison` 更强调成组卖点与说明块
- `spec` 更偏理性、紧凑、边界清楚
- `detail` 更偏局部、克制、避免误伤主体细节

### 12. 已补“更像 OCR 块级检测 + 背景类型差异化擦除”

虽然还不是严格意义上的 OCR 字形级识别，但这轮已经从“统一粗框 + 统一擦除提示词”升级为更像实际替换链路的两段式判断：

1. 先尽量输出接近可替换文字块的检测结果
2. 再根据底图局部背景类型选择不同的擦字策略

当前背景类型分类：

- `flat-clean`
- `soft-gradient`
- `textured-surface`
- `complex-photo`
- `unknown`

当前对应擦除策略：

- `clean-plate`
- `soft-blend`
- `texture-rebuild`
- `photo-reconstruct`
- `generic`

这意味着擦字提示词不再完全一刀切，而会根据：

- 当前替换更像锚点驱动还是模板推导
- 当前字区底图更像纯净棚拍底、渐变底、纹理底还是复杂摄影底

来决定擦除时更强调：

- 平滑补板
- 渐变延续
- 纹理续接
- 摄影内容重建

### 13. 替换质量状态已直接显示到结果卡

现在结果卡上不再只能看到“已落盘 / 上字失败”这类通用状态，也会直接出现替换质量相关标签，方便一眼判断这张图当前是怎么替的。

当前会显示的替换状态信息包括：

- `锚点替换`
- `模板推导`
- `锚点+模板`
- 当前图型替换策略标签
- 当前底图类型标签
- 简短替换判断摘要

这样可以更快识别：

- 哪些图已经进入较可信的锚点替换
- 哪些图还是主要靠模板推导补位
- 哪些图底图复杂，后续更值得人工复查

相关文件：

- [utils/ecommerce-text-layer-plan.ts](/e:/ai网站/XC-STUDIO/utils/ecommerce-text-layer-plan.ts)
- [pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts](/e:/ai网站/XC-STUDIO/pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts)

## 当前实际效果

目前已经具备一条完整可跑通的链路：

1. 方案生成时产出文案计划和文字容器意图
2. 结果生成后自动带上 overlay 可编辑信息
3. 进画布时优先使用清理后的底图
4. 在画布里生成真实可编辑 text 图层

这意味着“电商图结果 -> 进画布 -> 二次改字”已经有了基础可用版本。

## 仍未完成的开发

下面这些还没有做完，或者虽然能跑，但还不算最终体验。

### A. 文字层排版质量还需要继续打磨

当前的 `ecommerce-text-layer-plan` 还是第一版规则，已经能出层，但还不够接近“老流程自然排得很好看”的水平。

还需要优化：

- 不同模板下的层级节奏
- 标题、副标题、卖点、价格的相对重心
- 居中图、参数图、对比图的专用排布
- 更像“原图原生排版”的位置感
- 多行文本时的自动收缩与断行策略

这是下一阶段最重要的体验项。

### B. 当前擦字是“可用版”，还不是 Photoshop 级无痕

现在的擦字能力本质上是：

- 根据预测区域生成更像真实文字块的 mask
- 用现有 `smartEditSkill` 做局部修复

问题是：

- 仍然不是 OCR / 字形级逐字精确轮廓
- 对复杂背景、渐变、反光、半透明字，仍可能有修复痕迹
- 当前更多是“块级替换优先”，还不是“逐字无痕修补”

后续要继续提升的话，建议做：

1. 先 OCR / 检字框
2. 再做更精细的 mask 膨胀与合并
3. 根据字体形状或字区轮廓而不是只靠矩形
4. 对不同背景类型使用不同擦除策略

### C. 还没有做“识别原图已有文字并原位替换”的强版本

你前面提的理想方案是：

- 图里原本已经有字
- 系统识别这些字和位置
- 再把它们替换成可编辑层
- 尽量保持原位、原尺寸、原气质

这一版目前只做到了“按预测文字容器区域替换”，还没有做到：

- OCR 出具体原文字内容
- 精确识别每块文字的 bounding box
- 根据原图文字视觉大小反推字号
- 根据原图文字位置做逐块一一替换

这部分仍是后续重点开发项。

### D. 还没做人工校准 UI

现在替换区域主要是系统自动推导。

还缺少一个很实用的能力：

- 让用户手动微调替换框
- 或在画布/结果卡上直接拖框标记“这里原来有字”

如果后续要把擦字质量做稳，这个能力很关键。

### E. “应用上字”与“进画布”的视觉一致性还需要继续对齐

当前已经让应用上字、多平台导出优先使用清理后的底图，但仍需要继续确认：

- 画布文字层的布局和最终导出成片是否足够一致
- 不同平台模板导出时，是否会和画布里看到的位置感偏差过大

如果偏差明显，后续要统一排版引擎或统一布局参数。

### F. 尚未做真实业务回归测试

虽然编译已通过，但还缺：

- 多个真实商品 case 的人工验收
- 不同平台模式下的样例测试
- 中文长文案、短文案、价格图、对比图的专项测试
- 擦字失败时的用户提示和回退体验验证

## 建议的下一步开发顺序

建议按下面优先级继续：

### 第一优先级

把 `ecommerce-text-layer-plan` 打磨到更像老流程的排版水平。

原因：

- 这是用户第一眼最能感知差异的地方
- 就算擦字可用，排版不够好看，整体体验仍会被认为不如旧流程

### 第二优先级

加入 OCR / 原图文字检测，做更精确的替换框。

原因：

- 这是把“擦字替换”从可用推进到更自然的关键一步
- 也是实现“原位替换”的基础

### 第三优先级

增加替换区域人工校准能力。

原因：

- 可以让失败 case 可救
- 也能降低模型偶发判断失误带来的体验问题

## 本轮结论

本轮不是停留在“思路讨论”，而是已经完成了从方案层到结果层再到画布层的第一版闭环：

- 方案文案可结构化输出
- 结果可种出 editable overlay 状态
- 进画布可生成真实可编辑文字层
- `replace-generated-text` 已有基础擦字替换链路

但也要明确：

当前版本已经“能跑通”，还没有达到“视觉体验完全超过旧流程”的程度。

真正决定体验上限的下一阶段，不再是“有没有这条链路”，而是：

- 排版是不是足够好看
- 擦字是不是足够自然
- 原位替换是不是足够像原图自带的字
