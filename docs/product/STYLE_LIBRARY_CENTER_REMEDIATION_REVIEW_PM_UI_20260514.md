# 风格库中心整改方案二次审阅（PM / UI 视角）

日期：2026-05-14

关联文档：
- [`STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md)
- [`STYLE_LIBRARY_ORCHESTRATION_GOVERNANCE_OPTIMIZATION_PLAN_20260513.md`](docs/product/STYLE_LIBRARY_ORCHESTRATION_GOVERNANCE_OPTIMIZATION_PLAN_20260513.md)
- [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx)
- [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx)

---

## 1. 审阅结论

补进整改约束后，方案已经从“方向正确但还容易滑回 demo”提升到了“可以进入产品级实现”的状态，但前提是后续实现必须严格遵守这些新增约束，不能再自由发挥。

核心结论：
- 方案已经明确了“一级列表页 + 二级详情页 + 独立导入流”的边界，这一点成立：[`5.1 一级页面`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:133)、[`5.2 二级页面`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:173)、[`5.3 导入流程`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:196)
- 新增的“导入页首屏层级”“导入完成后的第一落点”“AI 失败与人工兜底”“四步向导化表达”“多图一致性阈值”“关键词与描述边界”“发布前检查三项”“风格资源优先级规则”，已经把此前最危险的产品断点补上：[`导入页首屏层级`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:207)、[`导入完成后的第一落点`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:227)、[`AI 失败与人工兜底`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:237)、[`7.3.1 四步向导化表达`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:293)、[`第 2.5 层：多图一致性阈值判断`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:478)、[`7.7.1 关键词与描述的编辑边界`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:545)、[`7.8.1 发布前检查固定为 3 项`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:565)、[`7.8.3 已选风格资源与临时输入的优先级规则`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:583)
- 现在最大的风险已经不再是“方案缺项”，而是**实现时是否重新把它做回厚重后台页、字段堆叠页、术语页**

---

## 2. 产品经理视角：不合理点与调整建议

### 问题 1：一级页目标仍然过宽
优先级：高

虽然文档里把一级页定义成资产列表页，但功能清单里一级页仍然保留了过多管理感入口，比如 [`新建入口`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:67)、[`状态筛选`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:64)、[`类型筛选`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:65)、[`来源`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:137)。

风险：
- 首页还是容易做成“管理后台”
- 用户主任务会从“找到可用风格”变成“管理很多字段”

建议调整：
- 一级页只保留 1 个主任务：**找资产 / 进导入 / 进详情**
- 一级页筛选降到最小：
  - 搜索
  - 正式 / 候选
  - 可用状态
- 暂时移除“来源”筛选，放到二级过滤抽屉

---

### 问题 2：导入流程仍然像“字段表单”，不像“任务向导”
优先级：高

当前 [`竞品截图对应的真实导入顺序`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:207) 和 [`7.3 应补齐的竞品式主链路`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:276) 已经比之前清楚，但还偏字段罗列。

风险：
- 用户会觉得自己在填表，而不是在“创建一套风格”
- AI 生成关键词、描述、测试标准之间的因果关系不够明显

建议调整为 4 步任务向导：
1. 选图并命名
2. 生成风格草稿
3. 确认风格定义
4. 测试并保存

也就是把：
- 标题
- 分类
- 图集
视为“建档”

把：
- 关键词
- 描述
- 测试标准
视为“AI 草稿确认”

把：
- 测试模型
- 参数
- 运行测试
视为“验证阶段”

---

### 问题 3：分类“风格 / 玩法”语义还不够清晰
优先级：中

方案里沿用了竞品的 [`模型分类（风格 / 玩法）`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:280)，但没有解释这两者在系统里的差异。

风险：
- 后续实现时字段、列表、卡片会混淆
- 用户也不清楚自己是在创建视觉风格还是生成套路

建议调整：
- 在产品定义里先明确：
  - **风格**：稳定视觉语言资产
  - **玩法**：稳定创意机制 / 表现结构模板
- 在 UI 上不要只显示“风格 / 玩法”，要加一句辅助说明
- 若第一阶段先聚焦风格资产，可先隐藏“玩法”，避免复杂度扩散

---

### 问题 4：测试标准定义还不够产品化
优先级：高

目前方案里提到了 [`测试标准`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:218) 和 [`测试标准生成`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:482)，但没有把它定义成用户容易理解的“验证问题”。

风险：
- 用户不知道为什么要写 3 条测试
- 最后测试会沦为又一组 prompt 表单

建议调整：
每条测试标准应有固定结构：
- 测什么
- 用什么图 / 什么 prompt 测
- 预期应该保住哪些风格特征

也就是说，测试标准不应只是“输入框”，而应是：
- 标题
- 测试目标
- 测试输入
- 预期风格保真点

---

### 问题 5：缺少“候选为什么不能发布”的清晰反馈机制
优先级：中

虽然方案提到了验证闭环和门槛，但没有把发布失败原因做成产品层反馈说明。

风险：
- 用户只会看到按钮不可用，不知道下一步做什么
- 容易再次出现 demo 感

建议调整：
在候选详情页加入明确的“发布前检查”模块，只显示 3 项：
- 是否已有足够代表图
- 是否已有完整风格草稿
- 是否已有通过测试结果

并且每项都给出“去补齐”的跳转入口。

---

### 问题 6：方案缺少“导入后第一落点”定义
优先级：高

当前方案说导入后进入候选，但没有定义导入完成后落在哪个页面、看到什么信息。

风险：
- 用户完成导入后迷失
- 又回到首页混乱状态

建议调整：
导入完成后不要回到列表首页，应该直接进入：
- 候选资产详情页
- 默认定位到“风格草稿确认”区
- 顶部显示当前步骤：导入完成，下一步请测试

---

## 3. UI 设计视角：不合理点与调整建议

### 问题 1：一级页卡片定义还是偏重
优先级：高

方案里虽然限制了卡片字段上限：[`卡片字段上限`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:143)，但还没有限制卡片视觉结构。

风险：
- 实现时仍可能塞入过多 badge、标签、统计
- 卡片会继续像 demo 面板

建议调整：
一级卡片只允许 3 层信息：
1. 封面
2. 标题 + 一句话说明
3. 1 行状态条

禁止：
- 双排以上标签
- 多组统计数值
- 大段验证说明
- 多个并列按钮

卡片操作统一改成：
- 整卡可点进入详情
- 右上角仅保留一个轻量更多菜单

---

### 问题 2：一级页和二级页缺少明显层级断裂
优先级：高

当前文档里有列表页和详情页，但从 UI 语言看，还没有定义“视觉上怎么让用户知道这是两个层级”。

建议调整：
- 一级页：轻、概览、密度低、强列表感
- 二级页：重、聚焦、内容区清晰分栏
- 导入页：步骤化、向导感、单路径前进

具体表现：
- 一级页不要右侧常驻详情区
- 二级页要有返回路径和资产标题头部
- 导入页要用 stepper，而不是普通表单堆叠

---

### 问题 3：专业术语仍未彻底被替换成产品语言
优先级：高

方案里仍然出现较多偏系统术语，例如 [`Prompt backbone`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:266)、[`prompt directives`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:267)、[`planningDirectives`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:388)。

建议调整：
对外文案统一换成：
- 风格重点
- 生成约束
- 高级规则
- 测试方式
- 应用边界

系统字段名可以保留在实现层，但不应直接暴露在默认编辑区。

---

### 问题 4：导入页截图区和文本区主次还不够清晰
优先级：中

从竞品截图来看，图集是主角，文本是围绕图集生成的；而当前方案文字描述比例偏大。

建议调整：
导入页信息层级应是：
1. 风格图集
2. AI 草稿结果
3. 测试设置
4. 发布动作

视觉上：
- 图集区应占首屏主区域
- 关键词和描述区应紧跟图集，不要过早出现大段配置
- 测试模型与参数放到下半区或下一步

---

### 问题 5：导入页缺少“AI 生成中间态”的设计
优先级：中

方案说 AI 生成关键词和描述，但没有定义中间态。

风险：
- 实现时直接闪现结果，缺少产品感
- 用户不知道 AI 到底分析了哪些东西

建议调整：
AI 生成区应有 3 段状态：
- 正在分析参考图
- 正在整理风格关键词
- 正在归纳风格描述与测试标准

这比直接显示 loading 更像真实产品。

---

## 4. 建议追加到方案的结构修订

建议把 [`STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md) 后续实现顺序改成：

1. 先重写“一级页只做什么，不做什么”
2. 再定义“导入页 4 步向导”
3. 再定义“候选详情页的发布前检查结构”
4. 再做卡片与文案降噪
5. 最后再落前端实现

---

## 5. 最终审阅结论

补进新约束后，这份方案**已经够资格作为最终完整的产品级风格库中心方案进入实现阶段**，但必须满足一个前提：实现时严格按页面职责收口，不允许再把“列表、导入、测试、发布”揉回一个页面。

### 5.1 为什么现在已经够进入实现
从产品经理角度，原先最关键的断点已经被补齐：
- 导入后用户不会再丢回首页，而是直接落到候选详情：[`导入完成后的第一落点`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:227)
- AI 失败不再是黑盒报错，而有明确人工兜底：[`AI 失败与人工兜底`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:237)
- 多图是否足够稳定有了产品化门槛，不会再把任意图集硬做成风格：[`第 2.5 层：多图一致性阈值判断`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:478)
- 关键词与描述不再语义重叠：[`7.7.1 关键词与描述的编辑边界`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:545)
- 发布失败不再只是灰按钮，而是固定三项检查：[`7.8.1 发布前检查固定为 3 项`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:565)
- 已选风格资源的稳定性优先级已经定义，不会轻易被临时输入冲掉：[`7.8.3 已选风格资源与临时输入的优先级规则`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:583)

从 UI 设计角度，原先最容易产生后台风 / demo 风的结构性问题也已经有了约束：
- 首屏先看图，不先看字段：[`导入页首屏层级`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:207)
- 导入被收成 4 步向导，不再是一张超长表单：[`7.3.1 四步向导化表达`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:293)
- 首页被限定为浏览页，不再承担编辑和测试：[`首页禁止继续承载的内容`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:595)

### 5.2 仍然存在的最终风险
虽然方案已经够进入实现，但还有 3 个实现期高风险点，如果落地时没守住，还是会重新变成厚重后台页。

#### 风险 A：把首页卡片再次做胖
高优先级。

如果后续在 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 首页卡片里继续塞：
- 多排标签
- 测试统计
- 版本摘要
- 多个操作按钮

那么即使 IA 正确，视觉结果仍然会像 demo 面板。

实现强约束：
- 首页卡片只保留封面、标题、一句话说明、单行状态
- 操作只保留整卡点击 + 一个更多菜单

#### 风险 B：把技术字段直接暴露成默认编辑区
高优先级。

如果把 [`planningDirectives`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:400)、[`promptBackbone`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:401)、[`promptDirectives`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:402) 继续放在默认视野里，页面语义会立刻变回工程后台。

实现强约束：
- 默认编辑区只出现产品语言：风格重点、风格描述、适用场景、风险提醒、测试方式
- 技术字段全部进“高级规则”折叠区，且默认收起

#### 风险 C：导入页一步塞完所有内容
高优先级。

即使文档定义了 4 步向导，如果实现时仍把图集、关键词、描述、测试模型、测试标准、发布动作做成长滚动页，用户感知上仍然是在填后台表。

实现强约束：
- 一步只解决一个主任务
- 当前步骤之外的信息默认折叠或不可编辑
- 每步只有一个主按钮

### 5.3 终审判断
最终判断是：
- 这份方案**已经足够做成最终完整的产品级风格库中心**
- 它已经补上了此前会导致“后台风 / demo 风”的关键产品断点
- 后续是否真的做出产品感，关键不再取决于方案，而取决于实现时是否严格遵守“首页轻、导入专、详情聚焦、术语后置”这 4 条铁律

也就是说，方案层现在已经及格，下一阶段不应继续加文档概念，而应开始按该方案约束重构 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 的 IA 与界面骨架。

---

## 6. 阶段偏航复审记录

### 6.1 Remediation 2：首页卡片降噪与术语收口

#### 本阶段审查结论
当前阶段改动方向正确，已经明显降低了 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 的后台风与 demo 风，但还没有完全达到最终目标。

#### 已通过项
- 首页顶部从大块统计卡收成轻量状态条，仪表盘感明显下降
- 候选卡片已收缩到标题、摘要、状态、少量辅助信息，没有继续膨胀成多功能面板
- 正式卡片不再在首页直接展开结果预览、对比摘要、通过 / 失败统计，卡片重量明显下降
- 默认详情文案已从“关键词标签 / 测试门槛检查 / 资产分层状态 / Prompt 指令”等工程感命名，收口到“风格重点 / 发布前检查 / 当前状态 / 高级规则”等产品语言
- 技术字段已收进默认折叠的“高级规则”区，符合 [`风险 B`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_REVIEW_PM_UI_20260514.md:306) 的约束

#### 仍未完全通过项
- 一级页和二级详情仍然在同一个画面并列存在，层级断裂还不够强，仍有一点“左边列表 + 右边后台详情”的旧惯性
- 详情区虽然文案变轻，但测试、状态、操作仍然集中在一个长侧栏里，后续如果继续堆内容，仍有回弹风险
- 首页候选与正式区仍是上下连续大块，虽然比之前轻，但还没有完全做到真正的“浏览页克制感”

#### 偏航检查结果
1. **一级页有没有重新混入编辑 / 测试 / 发布**
   - 有残留。
   - 首页本体已经降噪，但右侧常驻详情区仍在同页承担大量经营功能。
2. **卡片有没有重新变胖、变成 demo 面板**
   - 候选卡片已通过。
   - 正式卡片大体通过，当前风险已显著降低。
3. **导入页有没有重新退化成超长表单**
   - 本阶段未新增导入散落项，通过。
4. **默认视图有没有暴露技术字段**
   - 已通过，技术字段已后置。
5. **用户是否还能明确知道自己当前处于“浏览 / 导入 / 经营”的哪一层**
   - 部分通过。
   - 浏览与经营仍在同屏并列，认知边界还不够硬。
6. **页面气质是否仍然克制、清晰，而不是后台风 / demo 风**
   - 比上一版明显改善，但还未最终通过。

#### 审查结论
本阶段可判定为：
- **文案降噪：通过**
- **卡片降重：基本通过**
- **层级断裂：未通过，需下一阶段继续整改**

也就是说，[`Remediation 2`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:757) 可以结束，但不能把当前状态当成最终版首页；下一阶段必须继续推进“导入独立化”和“首页 / 详情层级进一步拆分”。

### 6.2 Remediation 3：导入主链路收拢

#### 本阶段审查结论
当前阶段方向正确，导入主链路已经明显比之前更聚焦，也更像真实产品链路，但还没有完全摆脱“智能分析工具弹层”的气质。

#### 已通过项
- [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 导入弹层标题、状态文案、保存动作、下一步动作已经改成“风格导入 → 加入候选区 → 去风格库中心继续整理”的主链路表达
- 导入成功后已新增直达 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 的后续动作，导入后落点更清晰
- “生成前重点 / 输出重点 / 回归样例预览”已经替代较重的工程措辞，主语义比上一版更像产品而不是调试工具
- 导入流程仍停留在 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 内，没有重新散落回 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 首页

#### 仍未完全通过项
- 导入弹层仍保留“导入类型 / 匹配把握 / AI 分析过程”这类轻度系统表达，工具感还在
- 保存前检查虽然已换词，但结构仍然是“分析结果 + 检查项 + 样例卡”，更像分析面板，离四步任务向导还有距离
- 当前导入仍然是单弹层连续展开，不是严格的 4 步向导，所以在用户感知上仍未完全达到竞品式导入流程

#### 偏航检查结果
1. **一级页有没有重新混入编辑 / 测试 / 发布**
   - 通过。
   - 本阶段修改主要集中在 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx)，没有把导入建模重新挂回首页卡片区。
2. **卡片有没有重新变胖、变成 demo 面板**
   - 通过。
   - 本阶段未回退首页卡片密度。
3. **导入页有没有重新退化成超长表单**
   - 部分通过。
   - 没有退化成字段长表单，但仍是单弹层长内容，不是最终目标中的步骤化向导。
4. **默认视图有没有暴露技术字段**
   - 基本通过。
   - 技术字段名已减少，但“导入类型 / 匹配把握 / AI 分析过程”仍带一点系统味。
5. **用户是否还能明确知道自己当前处于“浏览 / 导入 / 经营”的哪一层**
   - 明显改善。
   - 导入层现在有更清晰的独立语义，且导入成功后能顺着进入中心继续整理。
6. **页面气质是否仍然克制、清晰，而不是后台风 / demo 风**
   - 比上一版明显改善，但仍未完全通过。
   - 最大残留风险是“分析弹层感”强于“任务向导感”。

#### 审查结论
本阶段可判定为：
- **导入链路收拢：通过**
- **导入语言降噪：基本通过**
- **导入任务向导化：未通过，需下一阶段继续整改**

也就是说，[`Remediation 3`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:790) 已经把主链路收拢正确，但还不能算最终产品态；下一阶段必须继续推进“首页 / 详情层级断裂强化”，并在后续把导入体验进一步推进成更清晰的步骤化结构。

### 6.3 Remediation 4：首页收缩为浏览页，详情迁入独立层级

#### 本阶段审查结论
当前阶段方向正确，而且是这轮整改里最关键的一步：[`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 终于不再是“列表 + 常驻后台侧栏”的混合页，首页和详情层级已经被真正拉开。

#### 已通过项
- 首页首次进入已回到浏览态，不再默认替用户打开第一条资产详情
- 详情经营区已从首页常驻右栏迁入抽屉式独立层，用户需要先从列表进入，再在详情层经营资产
- 抽屉顶部已加入“返回列表”和“当前首页只保留浏览职责”的显式提示，层级语义比上一版清楚很多
- 候选风格与正式风格列表仍然保持轻量卡片，没有因为抽屉改造再次把测试和发布信息塞回首页

#### 仍未完全通过项
- 详情抽屉内部仍然是一条较长的经营表单，虽然已经不在首页同屏，但二级页内部的区块密度仍偏高
- 抽屉中仍有少量偏系统或偏运营的残留用语，例如“候选资产详情 / 正式资产详情 / 正式状态 / 测试指令”等，产品语义还可以继续收口
- 首页空状态里仍有“候选导入资产箱”旧措辞残留，说明局部文案还没完全清干净

#### 偏航检查结果
1. **一级页有没有重新混入编辑 / 测试 / 发布**
   - 通过。
   - 这些能力已经进入详情抽屉，不再与首页列表同屏常驻。
2. **卡片有没有重新变胖、变成 demo 面板**
   - 通过。
   - 卡片结构没有回退。
3. **导入页有没有重新退化成超长表单**
   - 与本阶段无直接冲突，保持上一阶段结论。
4. **默认视图有没有暴露技术字段**
   - 通过。
   - 技术字段仍在“高级规则”折叠区内。
5. **用户是否还能明确知道自己当前处于“浏览 / 导入 / 经营”的哪一层**
   - 明显通过。
   - 这是本阶段最重要的改进点。
6. **页面气质是否仍然克制、清晰，而不是后台风 / demo 风**
   - 基本通过。
   - 首页产品感已明显提升，但详情抽屉内部仍需做最后一轮语义与密度清理。

#### 审查结论
本阶段可判定为：
- **首页 / 详情层级断裂：通过**
- **首页浏览页收缩：通过**
- **详情抽屉产品化：基本通过，仍需最后一轮清理**

也就是说，[`Remediation 4`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:816) 的核心目标已经达成，后续可以进入最后的 [`Remediation 5`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:841)，集中做构建回归、文案残留清理和设计审稿收尾。

### 6.4 Remediation 5：构建回归、残留语义清理与设计审稿收尾

#### 本阶段审查结论
当前阶段已经完成收尾性质的产品化清理：构建可过、首页与详情层级没有回退、默认语义继续朝产品语言收口。本轮整改可以判定为达到“可交付的产品级首版”状态。

#### 已通过项
- [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 里的“风格资产 / 删除资产 / 正式状态 / 测试样例”等残留词已继续收口，首页和详情抽屉的产品语义更加统一
- [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 里的“导入类型 / 匹配把握 / AI 分析过程 / 测试样例”等轻度工具化措辞已进一步降噪
- 已完成 `npx vite build` 构建回归，结果通过；说明抽屉化详情层与导入文案调整没有引入新的编译风险
- [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 首页没有重新混入编辑 / 测试 / 发布，详情经营能力也没有回流到列表主画面

#### 仍需关注项
- [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 仍更接近“长弹层分析流”，距离严格的 4 步任务向导还有差距
- [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 详情抽屉虽然已比首页分层清晰，但内部区块未来仍可继续做更强的分步化与密度控制
- 构建当前只有包体 warning，没有功能阻塞，但后续若继续扩展中心能力，仍应关注 chunk 体积膨胀

#### 偏航检查结果
1. **一级页有没有重新混入编辑 / 测试 / 发布**
   - 通过。
   - 首页继续保持浏览职责，没有回退成混合经营页。
2. **卡片有没有重新变胖、变成 demo 面板**
   - 通过。
   - 本阶段未新增重卡片结构，轻量列表状态保持稳定。
3. **导入页有没有重新退化成超长表单**
   - 基本通过。
   - 没有退化回字段堆叠表单，但仍未进化成严格 4 步向导。
4. **默认视图有没有暴露技术字段**
   - 通过。
   - 默认视图仍以产品语言呈现，技术字段继续后置。
5. **用户是否还能明确知道自己当前处于“浏览 / 导入 / 经营”的哪一层**
   - 通过。
   - 三层职责边界已稳定，没有再次互相侵入。
6. **页面气质是否仍然克制、清晰，而不是后台风 / demo 风**
   - 基本通过。
   - 当前版本已具备产品级首版质感，剩余优化点主要是导入向导化与详情分步化，不再是结构性跑偏问题。

#### 审查结论
本阶段可判定为：
- **构建回归：通过**
- **残留语义清理：通过**
- **产品级首版审稿：基本通过**

也就是说，本轮 [`Remediation`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:757) 已完成首轮闭环；后续若继续迭代，应作为增强项推进，而不是继续返工当前 IA 主结构。

## 7. Enhancement P0：导入向导化审稿基线

### 7.1 审稿目标
针对 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 的增强阶段，先明确什么样的“4 步任务向导”才算通过，避免实现时再次滑回长弹层分析页。

### 7.2 必须通过的产品判断
1. 用户一眼能看懂自己现在处于哪一步
2. 每一步只有一个主任务，不能一屏混入多个目标
3. 保存动作只能出现在最后一步
4. 分析过程只能停留在生成步骤，不能贯穿所有步骤重复出现
5. 成功后的下一步必须仍然直达 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx)

### 7.3 必须通过的 UI 判断
1. 顶部必须有明确 stepper，不能只有状态标签
2. 主内容区必须随步骤切换，而不是四段内容全部继续铺开
3. 底部操作区只能保留与当前步骤相关的按钮
4. 当前步骤之外的信息要折叠、隐藏或变成摘要，不能继续形成长滚动页
5. 每一步只允许一个主要视觉重点，不能同时抢注意力

### 7.4 本阶段高风险点
- 把现有“分析摘要 / 草稿预览 / 检查项 / 回归样例”仅改标题后继续平铺，导致名义上 4 步、实际上还是长页
- 在 Step 1 或 Step 3 过早放出“加入候选区”动作，破坏任务节奏
- 为了省事保留过多旧状态卡和说明卡，造成一步里有多个核心区块同时竞争视觉焦点

### 7.5 本阶段通过标准
若实现结果满足以下条件，即可判定通过：
- 导入流程在感知上已经从“分析弹层”切换为“创建风格向导”
- 每一步都有明确输入 / 输出边界
- 用户不会在中途迷失下一步该做什么
- 没有把首页重新拉回导入承载层

## 8. Enhancement P1 / P2：导入向导化实现复审

### 8.1 本阶段审查结论
[`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 已从“长弹层分析流”进一步收口为明确的 4 步任务向导；本轮增强可以判定为通过，后续只需要把注意力转向详情抽屉分步化。

### 8.2 已通过项
- [`SmartImportDialog`](pages/GptImageInspiration.tsx:289) 已具备显式 stepper，用户能明确知道自己位于哪一步
- 主内容区已按步骤切换，不再把“状态 / 分析 / 草稿 / 检查 / 样例”继续全部平铺成一页
- 保存动作已收敛到最后一步，符合“测试并加入候选”的任务顺序
- 导入入口改成先进入 Step 1 再开始分析，导入对象确认和分析触发已被拆开
- 构建回归已通过，说明本轮导入向导化没有引入新的编译风险

### 8.3 仍需关注项
- Step 2 当前仍偏“等待分析完成”的单态页面，后续如继续打磨，可补更细的失败重试与处理中间态层次
- Step 3 与 Step 4 虽然已经拆开，但后续仍可继续压缩辅助说明长度，进一步提高一屏聚焦度
- 当前构建仍有 chunk warning，后续进入包体治理阶段时再统一处理

### 8.4 偏航检查结果
1. **一级页有没有重新混入编辑 / 测试 / 发布**
   - 通过。
   - 导入增强仍停留在 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx)，没有回流首页。
2. **卡片有没有重新变胖、变成 demo 面板**
   - 通过。
   - 本阶段未改首页卡片结构。
3. **导入页有没有重新退化成超长表单**
   - 通过。
   - 现在已经是按步骤切换的任务向导，而非连续长滚动页。
4. **默认视图有没有暴露技术字段**
   - 通过。
   - 默认区继续以产品语言表达，没有新增技术字段直出。
5. **用户是否还能明确知道自己当前处于“浏览 / 导入 / 经营”的哪一层**
   - 通过。
   - 导入层级语义更强，完成后仍顺畅流向 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx)。
6. **页面气质是否仍然克制、清晰，而不是后台风 / demo 风**
   - 通过。
   - 当前已明显从“分析弹层感”切到“任务向导感”。

### 8.5 审查结论
本阶段可判定为：
- **导入向导化：通过**
- **构建回归：通过**
- **增强阶段审稿：通过**

也就是说，后续可以进入 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 的详情抽屉分步化阶段，不需要回头返工当前导入主结构。

## 9. Enhancement P3：详情抽屉分步化审稿基线

### 9.1 审稿目标
在改造 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 前，先明确什么样的详情抽屉分步化才算通过，避免实现时只是把当前长页塞进 tabs，表面分步、实质不变。

### 9.2 必须通过的产品判断
1. 用户一进抽屉就能先理解“当前对象是谁、现在是什么状态”
2. 基础资料、回归样例、验证记录、发布判断必须分层，不允许继续混成一页
3. 发布前检查只能出现在发布阶段，不能贯穿所有步骤
4. 正式风格默认主路径应是“派生候选修订”，而不是直接覆盖
5. 高级规则只能后置，不能重新回到默认经营路径

### 9.3 必须通过的 UI 判断
1. 抽屉内部必须有明确的分段导航或 step navigation
2. 当前步骤主体必须独立渲染，不能继续把所有区块整页串起来
3. 底部操作区必须随步骤变化，而不是始终堆满全部动作
4. Step 1 必须最轻，优先看状态与基础说明，不能一上来就掉进验证表单
5. 高级规则必须默认折叠，且视觉权重最低

### 9.4 本阶段高风险点
- 只是把现有“基础资料 / 回归样例 / 验证记录 / 发布前检查 / 当前状态”改成标题锚点，实际仍是一条长滚动页
- 在所有步骤底部同时保留“保存 / 转正式 / 派生修订 / 删除 / 去工作台应用”全套按钮，导致主次混乱
- 把“高级规则”挂进默认第一屏，重新带回后台感
- 把正式风格与候选风格的动作继续混排，用户看不懂当前推荐路径

### 9.5 本阶段通过标准
若实现结果满足以下条件，即可判定通过：
- 抽屉感知上已经从“长经营表单”切换为“分步经营页”
- 用户能稳定区分资料整理、样例维护、验证回填、发布判断这 4 类任务
- 首页 / 详情层级不回退
- 默认产品语义不被技术字段重新污染

## 10. Enhancement P4 / P5：详情抽屉分步化实现复审

### 10.1 本阶段审查结论
[`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 的详情抽屉已经从“长经营表单”切换为“分步经营页”，并且构建回归通过；本轮增强可以判定为通过。

### 10.2 已通过项
- 抽屉内部已经具备明确的分段导航，用户可以稳定区分“概览与基础资料 / 回归样例 / 验证记录 / 发布与版本 / 高级规则”
- 当前步骤主体已独立渲染，不再把所有区块继续平铺成一条长页
- 底部操作区已随步骤切换，不再在所有阶段同时堆满保存、发布、删除等动作
- Step 1 已收口为状态与基础资料主导，验证结果与发布动作不会提前打扰用户
- 高级规则已后置为单独步骤，视觉权重最低，没有重新回到默认经营路径
- 已执行 `npx vite build`，当前构建通过，仅保留既有 chunk size warning

### 10.3 仍需关注项
- 发布与版本步骤后续仍可继续压缩说明文案长度，进一步提升一屏聚焦度
- 当前构建仍有 chunk warning，后续进入包体治理阶段时再统一处理

### 10.4 偏航检查结果
1. **一级页有没有重新混入编辑 / 测试 / 发布**
   - 通过。
   - 本轮改造停留在 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 的详情抽屉内部，没有把经营区挂回首页。
2. **抽屉是不是只是换成标题锚点，实际仍然是一条长滚动页**
   - 通过。
   - 当前步骤主体已经按 `detailSection` 切换独立渲染，不再整页串联。
3. **底部操作区有没有继续同时堆满全部动作**
   - 通过。
   - 当前仅显示与所处步骤对应的保存、推进或发布动作。
4. **高级规则有没有重新跑到默认第一屏**
   - 通过。
   - 高级规则已被后置为独立步骤。
5. **正式风格与候选风格的推荐路径是否仍然清楚**
   - 通过。
   - 发布与版本步骤已把“候选转正式”和“正式派生候选修订”分开表达。
6. **页面气质是否仍然克制、清晰，而不是后台风 / demo 风**
   - 通过。
   - 当前详情层已明显从“长表单后台页”切到“分步经营页”。

### 10.5 审查结论
本阶段可判定为：
- **详情抽屉分步化：通过**
- **构建回归：通过**
- **增强阶段审稿：通过**

也就是说，后续可以进入风格库相关包体治理阶段，不需要回头返工当前详情抽屉主结构。

## 11. Enhancement P6：风格库相关包体治理复审

### 11.1 本阶段审查结论
风格库相关包体治理已完成一次有效收口：[`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 与 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 自身并不是当前 warning 主来源，真正偏重的是工作台与电商工作流链路。本阶段可判定为通过。

### 11.2 已通过项
- [`utils/download.ts`](utils/download.ts) 与 [`utils/ecommerce-overlay-production.ts`](utils/ecommerce-overlay-production.ts) 的 zip 导出依赖已改为按需动态加载
- [`pages/Workspace/components/workflow/EcommerceWorkflowResultReview.tsx`](pages/Workspace/components/workflow/EcommerceWorkflowResultReview.tsx) 的结果打包导出已后置加载 `JSZip`
- [`pages/Workspace/components/AgentMessage.tsx`](pages/Workspace/components/AgentMessage.tsx) 已将工作流卡片改为懒加载，不再默认同步拉起整套工作流 UI
- [`pages/Workspace/components/WorkspaceSidebarLayer.tsx`](pages/Workspace/components/WorkspaceSidebarLayer.tsx) 已将 [`AssistantSidebar`](pages/Workspace/components/AssistantSidebar.tsx:311) 下沉为抽屉层懒加载
- 构建回归通过，说明本轮拆分没有引入新的编译风险
- [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 与 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 当前 chunk 维持轻量，风格库页本身没有继续膨胀

### 11.3 仍需关注项
- [`pages/Workspace.tsx`](pages/Workspace.tsx) 主 chunk 仍然偏大，说明工作台页面自身还承担了过多同步逻辑
- [`pages/Workspace/components/workflow/EcommerceOneClickCards.tsx`](pages/Workspace/components/workflow/EcommerceOneClickCards.tsx) 与叠字导出链路仍然偏重，属于下一阶段工作台治理范围
- 当前 build 仍有 chunk size warning，但已不再集中指向风格库路由

### 11.4 偏航检查结果
1. **是否为了做包体治理，把风格库页面结构又改回去了**
   - 通过。
   - 本轮只做加载边界调整，没有回退 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 的分步经营结构。
2. **是否把导入向导主链路重新搅乱**
   - 通过。
   - [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 主链路未被回退。
3. **是否把 warning 错误归因到风格库页面本身**
   - 通过。
   - 经过本轮构建验证，当前主要压力点在工作台与电商工作流，而不是风格库页本身。
4. **是否通过真实拆分改善了默认加载边界**
   - 通过。
   - 导出依赖、工作流卡片、侧边助手都已经后置加载。

### 11.5 审查结论
本阶段可判定为：
- **风格库相关包体治理：通过**
- **构建回归：通过**
- **下一阶段边界识别：通过**

也就是说，风格库中心这条整改链路已经完成当前范围内的产品化与包体治理，后续应转入独立的工作台 / 电商工作流大包治理任务。

## 12. 风格库重构返工：卡片预览化与最小编辑闭环复审

### 12.1 复审结论
本轮返工方向正确，且已经明显从“后台经营页 / demo 风格页”拉回到“真实产品里的风格卡片库”。[`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 当前版本可以判定为通过本阶段复审。

### 12.2 已通过项
- 首页已回到卡片浏览页定位：主任务明确收敛为“找卡片 / 新增 / 导入 / 进入编辑”，没有再把测试、发布、版本信息堆在首页
- 卡片结构已压缩为封面预览 + 标题 + 一句话说明，符合此前“一级卡片只允许 3 层信息”的审稿要求
- 编辑弹层已收缩为最小闭环，只保留：
  - 封面上传
  - 多图上传（首张做封面）
  - 风格关键词手填 / AI 识别
  - 风格说明手填 / AI 生成
- “新增风格”与“从画廊导入风格”已统一为同一套创建语言，没有再做两套割裂流程
- 画廊导入已直接复用 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 的封面与 prompt，并把 AI 生成收敛到关键词 / 风格说明，不再额外暴露厚重字段
- 默认文案已切回产品语言，没有继续把 `planningDirectives`、`promptDirectives`、`promptBackbone` 这类系统字段暴露在默认编辑区
- 构建回归通过，说明本轮返工没有引入新的编译风险

### 12.3 UI / UX 风险复查
1. **首页是否还像后台页而不是风格浏览页**
   - 通过。
   - [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 已改成分段卡片浏览，不再有右侧常驻经营区。
2. **卡片是否仍然信息过载**
   - 通过。
   - 当前卡片只显示必要信息，没有测试统计、版本块、多组按钮并列。
3. **编辑是否还在强迫用户理解复杂术语**
   - 通过。
   - 当前默认编辑只围绕“图、关键词、说明”展开，语义明显变轻。
4. **导入是否继续像字段表单而不像任务流**
   - 基本通过。
   - 当前已比旧版本明显更轻，但后续若继续细修，可再补更明确的步骤提示与状态反馈。
5. **是否又把测试能力硬塞回主流程**
   - 通过。
   - 本轮已明确延后测试位置，没有再次把主界面做回厚重 demo。

### 12.4 仍建议后续关注项
- 上传失败、AI 失败、空状态提示还可以继续细化，提升真实产品感
- 如后续恢复测试能力，必须另行定义放置位置，不能直接回塞当前编辑弹层
- 当前首页搜索已足够轻量，后续不要再次新增过多筛选器，避免回到后台风

### 12.5 本阶段审稿结论
本阶段可判定为：
- **卡片预览化：通过**
- **最小编辑闭环：通过**
- **画廊导入复用：通过**
- **构建回归：通过**

也就是说，风格库中心这一轮已经完成“去后台化、去 demo 化、回到风格卡片产品形态”的核心返工，当前可进入下一条独立任务，而不需要继续把风格库中心做回复杂经营页。

## 13. 风格库纠偏复审：生图关键词 / 标签 / 新分析能力

### 13.1 复审结论
本轮纠偏方向正确，已经把用户指出的两个核心混淆点拆开：
- 生成用的 Prompt
- 浏览与分类用的标签

同时，也已经停止复用旧的 [`analyzeSmartStyleImport()`](services/gpt-image-smart-import.ts:486) 作为默认分析入口，改为 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 内当前场景专用的新分析能力。本阶段可判定为通过。

### 13.2 已通过项
- [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 默认编辑区已把“风格关键词”改成“生图关键词 / Prompt”，语义与图二保持一致
- [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 已新增独立“标签”字段，支持用户手动编辑
- 画廊导入已改成直接沿用已有 Prompt 与标签，只额外补风格说明，不再强行重写现成内容
- 新建风格时，AI 分析 Prompt 的同时会顺带补齐标签，符合用户要求
- [`types/common.ts`](types/common.ts:86)、[`services/vision-orchestrator/style-library.ts`](services/vision-orchestrator/style-library.ts:184)、[`services/vision-orchestrator/style-library-draft.ts`](services/vision-orchestrator/style-library-draft.ts:87) 已同步补齐持久化字段，说明当前改动不是纯 UI 假动作
- 构建回归通过，说明本轮纠偏没有引入新的编译问题

### 13.3 风险复查
1. **Prompt 和标签是否仍然混在一起**
   - 通过。
   - 现在已分成独立输入区，预览区也优先展示标签，而不是把 Prompt 当成标签列表。
2. **是否还在复用旧导入分析能力**
   - 通过。
   - 当前默认分析入口已切到 [`analyzeStyleCardDraft()`](pages/StyleLibraryCenter.tsx:485)，不再走旧的智能导入分析逻辑。
3. **画廊导入是否还会覆盖现成 Prompt / 标签**
   - 通过。
   - 当前逻辑是直接沿用现成 Prompt 与标签，只补风格说明。
4. **新建风格是否仍需要用户手动补太多字段**
   - 基本通过。
   - 当前已能通过 AI 自动补 Prompt 与标签，但后续还可继续细化失败提示与空状态反馈。

### 13.4 审稿结论
本阶段可判定为：
- **生图关键词语义纠偏：通过**
- **标签独立建模：通过**
- **旧分析能力替换：通过**
- **构建回归：通过**

也就是说，风格库中心当前已经从“关键词 / 标签 / Prompt 混写”的半成品状态，进一步收敛为更接近真实产品的风格卡片建模方式。

## 14. 风格卡片生成链路专项复审：当前实现与目标产品逻辑的偏差

### 14.1 复审结论
本轮审计结论是不通过直接进入实现修补，必须先按 [`21. 风格卡片生成链路专项审计`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:1307) 的结论回补产品与技术链路，再改代码。原因不是单个 UI 问题，而是“建卡语义、模型路由、参考图注入、模板权重”四条链同时存在错位。

### 14.2 高优先级问题
#### 问题 1：风格图在建卡时参与分析，但在生图时没有真正进入参考图链
优先级：高

具体位置：
- 风格图落库字段在 [`WorkspaceStyleLibrary.referenceImageUrls`](types/common.ts:93)
- 生图参考图入口仍是 [`CanvasElement.genRefImages`](types/common.ts:182) / [`CanvasElement.genRefImage`](types/common.ts:181)
- 实际执行链见 [`pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts`](pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts:1207)

为什么不好：
- 用户会自然理解为“选了风格卡片后，这些风格图会参与生成”
- 但当前事实是只有文字约束进入下游，图像约束没有进入
- 这会直接造成“看起来选了风格，实际出图只轻微受影响”的落差

修改建议：
- 选中风格卡片后，必须定义一条正式的 style reference merge 规则
- 至少支持：从 [`referenceImageUrls`](types/common.ts:93) 中选 1 张作为 style anchor，并与用户手动参考图一起进入执行链
- 若存在多张风格图，应明确是随机、轮换还是按封面优先，而不是隐式忽略

#### 问题 2：新字段已经建模，但编排器仍主要消费旧字段
优先级：高

具体位置：
- 新字段已进入 [`WorkspaceStyleLibrary`](types/common.ts:86)
- Prompt 注入仍主要依赖 [`buildDirectStyleLibraryPrompt()`](pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts:90)
- 编排器串行化仍主要依赖 [`buildStyleLibraryLines()`](services/vision-orchestrator/prompt-composer.ts:167)

为什么不好：
- 现在 `promptText` / `tags` / `description` 已经是用户真正编辑的主字段
- 但下游真正重视的仍是 `promptBackbone` / `planningDirectives` / `promptDirectives`
- 这会导致“用户编辑了主要字段，但生成效果不按这些字段走”

修改建议：
- 下游必须显式提升 `promptText` / `description` / `tags` 的地位
- 至少要把它们纳入固定模板结构，而不是只在保存时二次投影成旧字段
- 若旧字段仍保留，也应由新字段派生，而不是让两套字段并行竞争

#### 问题 3：风格卡片 AI 分析没有走用户预期的全局多模态模型链
优先级：高

具体位置：
- [`analyzeStyleCardDraft()`](pages/StyleLibraryCenter.tsx:485)
- [`getBestModelId()`](services/gemini.ts:1582)
- [`getVisualOrchestratorModelConfig()`](services/provider-settings.ts:581)
- [`generateJsonResponse()`](services/gemini.ts:1130)

为什么不好：
- 用户已经明确感知到“这里为什么又打到云雾”
- 这不是感知误差，而是当前实现确实没有把 `providerId` 带进调用
- 同时，这里取的是“文本模型配置”，不是“视觉编排 / 多模态模型配置”

修改建议：
- 风格图分析这类多图视觉理解任务，必须走带 `providerId` 的显式模型配置
- 默认应优先对齐 [`visualOrchestratorModel`](services/provider-settings.ts:585) 这条链，而不是单纯 `selectedScriptModels`
- 同类问题也要同步审查旧导入器 [`analyzeSmartStyleImport()`](services/gpt-image-smart-import.ts:486)

#### 问题 4：风格说明仍偏说明文，不是稳定的原则卡
优先级：高

具体位置：
- [`analyzeStyleCardDraft()`](pages/StyleLibraryCenter.tsx:485)

为什么不好：
- 当前文案要求虽然比之前更准，但仍偏“总结这组图是什么感觉”
- 用户要的其实是“这套风格如何稳定复用”的原则层分析
- 如果说明不是原则结构，下游很难把它当高权重模板来用

修改建议：
- `description` 应升级为原则级结构，至少覆盖：镜头、构图、光线、色彩、材质、氛围、线条 / 渲染、漂移禁区
- 说明不应只是 prose summary，而应能直接指导模板化合成

### 14.3 中优先级问题
#### 问题 5：旧画廊导入器仍在输出旧语义资产
优先级：中

具体位置：
- [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx:1155)
- [`services/gpt-image-smart-import.ts`](services/gpt-image-smart-import.ts:486)

为什么不好：
- 当前新卡片页已经进入“Prompt / 标签 / 说明”语义
- 旧导入器仍以 `referenceInterpretation` / `planningDirectives` / `promptDirectives` 为主
- 同一个产品里存在两套风格卡片语义，会不断制造数据和 UI 偏差

修改建议：
- 旧导入器要么迁移为新资产语义
- 要么降级为内部兼容层，不再作为面对用户的主入口分析器

#### 问题 6：运行时 overlay 结构已经落后于新卡片模型
优先级：中

具体位置：
- [`WorkspaceStyleLibraryRuntimeOverlay`](types/common.ts:114)

为什么不好：
- 当前 overlay 只能覆盖旧字段
- 无法正式承载 `promptText` / `tags` / `description` 的运行时微调
- 这会限制后续 planner 对新风格卡片模型的细粒度修正能力

修改建议：
- 若后续仍保留 runtime overlay 路线，应评估扩展新字段
- 否则就要明确：新字段是静态资产字段，不允许运行时改写

### 14.4 设计审稿结论
1. **功能是否乱放**
   - 中风险。
   - 新建卡页与工作台生成链已开始分离，但旧导入器仍保留旧逻辑，产品边界还没有完全统一。
2. **视觉层级是否混乱**
   - 当前不属于主要矛盾。
   - 这轮问题已从 UI 层转移到语义与执行链。
3. **间距 / 对齐 / demo 感问题是否仍是主问题**
   - 不是主问题。
   - 当前最大的产品感缺口是“看起来会生效，实际上没有按预期生效”。
4. **是否达到产品级 UI 标准**
   - 仅从页面观感看，接近通过。
   - 但从真实产品闭环看，因生成链未打通，不能判定整体通过。

### 14.5 本阶段审稿结论
本阶段可判定为：
- **页面观感与信息结构：基本通过**
- **风格卡片真实产品闭环：未通过**
- **模型路由一致性：未通过**
- **风格图参与实际生图：未通过**
- **新旧资产语义统一：未通过**

也就是说，下一步不应继续做表层 UI 微调，而应先按照 [`docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md) 新增专项审计结论，完成风格卡片链路整改。
