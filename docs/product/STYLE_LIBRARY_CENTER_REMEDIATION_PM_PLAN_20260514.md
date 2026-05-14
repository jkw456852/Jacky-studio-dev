# 风格库中心整改方案（PM 阶段）

日期：2026-05-14

关联文档：
- [`STYLE_LIBRARY_ORCHESTRATION_GOVERNANCE_OPTIMIZATION_PLAN_20260513.md`](docs/product/STYLE_LIBRARY_ORCHESTRATION_GOVERNANCE_OPTIMIZATION_PLAN_20260513.md)
- [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx)
- [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx)
- [`services/competitor-page-live-import.ts`](services/competitor-page-live-import.ts)
- [`services/ecommerce-competitor-import.ts`](services/ecommerce-competitor-import.ts)

文档角色：
- [`STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md) 是**主方案 / 当前执行底稿 / 最终落地依据**
- [`STYLE_LIBRARY_CENTER_REMEDIATION_REVIEW_PM_UI_20260514.md`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_REVIEW_PM_UI_20260514.md) 是**审稿文档 / 偏航检查文档 / 阶段复审依据**
- 后续每个阶段都必须**同时对照两份文档**推进：以前者定“该做什么”，以后者定“这样做有没有跑偏”

---

## 1. 页面目标

将当前“风格库中心”从“列表页 + 编辑器 + 测试台 + 发布台”混合页，重构为符合真实产品逻辑的两层结构：

### 一级页面目标
一级页只承担“资产浏览与进入下一步”的职责：
- 浏览正式资产与候选资产
- 搜索、筛选、判断可用性
- 发起导入
- 进入某个资产详情页

### 二级页面目标
二级页承担“经营资产”的职责：
- 编辑资产信息
- 维护测试样例
- 回写测试结果
- 发布 / 转正式
- 查看版本与历史状态

### 导入流程目标
导入不再散落在中心首页内部，而是成为独立主链路：
- 上传参考图 / 竞品页导入
- 选择资产类型
- AI 提炼候选资产
- 用户确认
- 进入测试
- 测试通过后入正式库

---

## 2. 用户主任务

### 一级页主任务
1. 我想找一套已经能用的风格
2. 我想快速判断哪套风格最近验证过、是否稳定
3. 我想导入一个新风格候选

### 二级页主任务
1. 我想继续整理这个候选资产
2. 我想补测试样例 / 测试结果
3. 我想把候选转正式
4. 我想基于正式资产做一个修订版

---

## 3. 功能清单

### 3.1 一级页功能
- 正式资产 / 候选资产 分段切换
- 搜索
- 状态筛选
- 类型筛选
- 导入主入口
- 新建入口
- 资产卡片列表
- 点击卡片进入详情

### 3.2 二级页功能
- 基本信息编辑
- 图集编辑
- 关键词 / 描述 / 适用场景 / 风险提醒编辑
- 测试样例管理
- 测试结果管理
- 候选转正式
- 正式资产派生候选修订
- 删除资产
- 版本信息查看
- 高级规则折叠区

### 3.3 导入链路功能
- 来源选择：
  - 上传参考图
  - 粘贴商品 / 竞品链接
  - 当前竞品页导入
- 资产类型选择：
  - 抽象风格
  - 强迁移预设
  - 编辑模板
- AI 提炼候选资产
- 用户确认提炼结果
- 进入测试准备
- 保存到候选资产箱

### 3.4 竞品式风格导入功能
基于用户补充截图，竞品的“风格导入”不是一个卡片上的快捷动作，而是一条明确的建模流程：
- 填写资产标题
- 选择模型分类：风格 / 玩法
- 上传同风格参考图集
- AI 生成风格关键词
- AI 生成风格描述
- 选择测试模型
- 配置测试参数（比例 / 张数）
- 维护测试标准（可含图片与文字）
- 执行测试后再决定保存 / 发布

---

## 4. 功能优先级

### P0
- 拆分一级页与二级页
- 重做首页卡片信息密度
- 补齐竞品导入主链路
- 首页移除测试编辑发布大表单

### P1
- 二级页内测试与发布完整闭环
- 正式资产派生候选修订
- 高级规则折叠区

### P2
- 批量管理
- 历史版本比较增强
- 更多竞品来源导入

---

## 5. 信息架构

## 5.1 一级页面：风格资产列表页

### 页面结构
1. 页面标题区
   - 标题：风格资产
   - 副标题：浏览、导入、管理你的风格资产
   - 主按钮：导入风格

2. 分段导航
   - 正式资产
   - 候选资产

3. 筛选区
   - 搜索
   - 状态
   - 类型
   - 来源

4. 卡片列表区
   - 卡片仅显示核心信息
   - 点击进入详情页

### 卡片字段上限
一级卡片最多显示：
- 名称
- 一句话用途
- 当前状态
- 最近验证结果
- 更新时间
- 轻量标签 2~3 个

禁止在一级卡片出现：
- 大段说明
- 测试样例明细
- 测试结果表单
- 发布门槛说明
- Prompt 系统术语

---

## 5.2 二级页面：风格资产详情页

### 页面结构
1. 顶部返回区
   - 返回列表
   - 资产标题
   - 当前状态
   - 主要操作按钮

2. 内容导航
   - 基本信息
   - 测试样例
   - 测试结果
   - 发布与版本
   - 高级设置

3. 操作区
   - 保存
   - 转正式 / 派生候选
   - 删除

---

## 5.3 导入流程页 / 抽屉

### 导入步骤
1. 选择导入来源
2. 选择资产类型
3. 预览 AI 提炼结果
4. 确认保存为候选资产
5. 跳转到候选详情继续测试

该流程必须与首页列表分离，不能把导入确认、测试说明、结果编辑混在首页里。

### 导入页首屏层级
导入页首屏必须先让用户确认“我导入的是哪组图、这组图是否代表一个稳定风格”，不能一上来就让用户看到大段字段。

首屏信息顺序固定为：
1. 风格图集主区域
   - 先看图
   - 先选封面
   - 先判断图是否同风格
2. 资产标题与分类
   - 只保留标题、风格 / 玩法分类两个最小字段
3. AI 分析状态区
   - 正在分析参考图
   - 正在整理风格关键词
   - 正在归纳风格描述与测试标准
4. 草稿结果预览
   - 先显示关键词与一句描述摘要
   - 不在首屏展开测试参数与高级规则

首屏禁止出现：
- 大段高级配置
- 多组并列表单
- 测试结果回写区
- 发布规则说明墙

### 导入完成后的第一落点
导入完成后，系统不能把用户丢回首页列表页。

固定落点应为：
- 直接进入该候选资产的详情页
- 默认定位到“风格草稿确认”区
- 顶部状态条明确提示：已完成导入，下一步请补测试并验证稳定性
- 页面内只保留 1 个主按钮：开始测试

这样可以避免用户在导入成功后再次迷失，也能避免首页重新承担编辑职责。

### AI 失败与人工兜底
导入流程必须假设 AI 不一定一次成功，因此要在流程里预留人工兜底，而不是把失败当异常提示一闪而过。

至少要有 3 种兜底：
1. **仅关键词生成失败**
   - 保留已上传图集
   - 允许用户手动填写关键词
   - 允许再次触发 AI 补全
2. **描述生成失败**
   - 保留关键词结果
   - 允许用户先进入人工描述，再重新触发“基于关键词生成描述”
3. **多图不一致导致无法稳定归纳**
   - 明确告诉用户哪些图片偏离主风格
   - 提示用户删除异常图后再继续

也就是说，AI 失败页不能只显示“失败”，而要明确告诉用户：
- 哪一步失败了
- 当前保住了什么
- 下一步可以手动怎么补

### 竞品截图对应的真实导入顺序
根据用户补充的竞品截图，导入页本身应是一个结构化表单，而不是中心首页里的分散模块：
1. 资产标题
2. 模型分类
   - 风格
   - 玩法
3. 风格图集上传
4. 风格关键词（AI 生成，可人工修订）
5. 风格描述（AI 生成，可人工修订）
6. 选择测试模型
7. 设置测试参数
8. 测试标准录入
9. 运行测试
10. 测试通过后保存

也就是说，竞品逻辑强调的是：
- 先导入建模
- 再测试验证
- 最后保存发布

而不是：
- 先进入中心首页
- 再在首页里四处分散地补关键词、补结果、补状态

---

## 6. 二级入口划分

以下能力必须进入二级页或独立导入流：
- 测试样例编辑
- 验证结果回写
- 发布门槛检查
- Prompt backbone / directives
- 系统消费规则
- 候选转正式
- 正式资产派生候选修订
- 版本比较

以下能力可以留在一级页：
- 资产浏览
- 搜索筛选
- 导入入口
- 状态速览
- 进入详情

---

## 7. 竞品导入逻辑要求

当前问题不是“缺更多编辑器”，而是“没有按竞品的风格导入流程来设计产品主链路”。

### 7.1 用户补充后的正确定义
这里的“竞品导入逻辑”，指的是竞品页面里的风格导入流程本身：
- 先建立一个风格资产草稿
- 再围绕该草稿完成关键词、描述、测试标准的结构化录入
- 再进行测试
- 最后保存 / 发布

它不是指单纯把竞品页面图片抓下来，也不是把抓图能力按钮塞进风格库中心首页。

### 7.2 当前代码里可复用的导入能力
现有项目里已经有竞品图片导入能力，可作为“导入来源层”复用：
- [`extractCompetitorDeckFromUrl()`](services/ecommerce-competitor-import.ts:160)
- [`fetchCompetitorImportImageFile()`](services/ecommerce-competitor-import.ts:225)
- [`buildTaobaoCurrentPageImportScript()`](services/competitor-page-live-import.ts:24)
- [`consumeLatestCompetitorLivePageImport()`](services/competitor-page-live-import.ts:202)

但这些能力只解决“图片怎么拿到”，并没有还原竞品真正的产品流程。

### 7.3 应补齐的竞品式主链路
正确产品路径应为：
1. 在导入页选择“新建风格导入”
2. 录入标题
3. 选择模型分类（风格 / 玩法）
4. 导入风格图集
   - 上传本地图片
   - 粘贴竞品链接抓取
   - 读取当前竞品页
5. AI 生成关键词
6. AI 生成风格描述
7. 用户确认 / 修订关键词与描述
8. 选择测试模型与测试参数
9. 填写测试标准
10. 执行测试
11. 测试通过后保存到正式库；未通过则保留在候选层继续修订

### 7.3.1 四步向导化表达
虽然底层仍然有标题、分类、图集、关键词、描述、测试标准这些字段，但对用户不能表现成“连续填表”，而要固定为 4 步向导：
1. **选图并命名**
2. **生成风格草稿**
3. **确认风格定义**
4. **测试并保存**

这样用户理解的是“我正在创建一套风格”，而不是“我在维护一堆后台字段”。

### 7.4 竞品风格导入的底层产品原理
结合用户补充截图，竞品的“风格导入”本质上是在构建一个**有证据链的风格资产草稿**，而不是简单存一组参考图。

#### A. 参考图的 3 个角色
1. **封面图**
   - 选 1 张最具代表性的图，作为列表卡片封面
   - 作用是让用户在列表页快速识别这套风格
2. **图例集**
   - 多张同风格图片共同构成“风格图集”
   - 作用是告诉系统：哪些特征是稳定风格，不是单张偶然细节
3. **分析依据**
   - 这些图不是只给用户看，也是 AI 生成关键词与风格描述的证据来源
   - 后续测试失败时，系统也应能回溯“这套风格最初是依据哪些图提炼出来的”

#### B. 关键词与描述的职责分工
竞品截图里，“风格关键词”不是传统意义上的几个短 tag，而更像**面向生图的结构化风格提示**；“风格描述”则是更适合人理解和管理的归纳文本。

- **风格关键词**：偏机器消费
  - 描述主体、构图、镜头、材质、光效、氛围、比例等
  - 允许较长，接近 prompt backbone
- **风格描述**：偏人类消费
  - 将关键词与图像证据收束成一段稳定风格总结
  - 用于列表预览、资产理解、后续筛选

也就是说，竞品不是“图 → 直接出描述”，而是：
**图像证据 + 用户输入 / AI 推断关键词 → 再生成风格描述**

#### 7.4.1 AI 分析了什么，才会得出那段“风格关键词”
结合你给的样图，AI 不是在写文案，而是在做一轮“视觉维度拆解 + 多图共性压缩”。

它实际会分析出这些层：
- **主体层**：年轻女性、人物为主角、全身动态姿态
- **动作层**：跳跃、前冲、腾空、身体有明确动势
- **构图层**：广角强透视、前景脚部放大、主体从屏幕中跃出
- **边界层**：透明手机屏 / 玻璃屏幕作为空间边界
- **材质层**：玻璃、碎片、数字粒子、发光颗粒、屏幕 UI
- **光效层**：暖金色逆光、紫粉色氛围光、Bokeh 光斑、粒子爆发
- **色彩层**：蜜桃粉、暖金、柔紫、低冷高暖对比
- **渲染层**：Pixar 式高完成度 3D、半写实卡通、超清质感
- **版式层**：竖版海报、`9:16`、社媒展示导向
- **情绪层**：梦幻、轻盈、电影海报感、未来数字感

然后 AI 会把这些“稳定信号”压成关键词块，而不是保留成散乱观察值。

所以图里那段关键词，本质上不是“描述图上发生了什么”，而是把以下内容编码成可复用提示：
- 谁是主体
- 以什么姿态出现
- 在什么空间边界中出现
- 用什么镜头语言去表现
- 用什么光色和材质去完成氛围
- 最终输出成什么版式

换句话说，关键词的真实来源是：
**多图共性视觉信号 → 结构化风格提示块**

#### 7.4.2 AI 分析了什么，才会得出那段“风格描述”
“风格描述”不是再看一次图重新写长一点，而是对上一步关键词结果做“人类可读化归纳”。

AI 在生成描述时，会额外完成这几件事：
- 把高密度关键词组织成顺畅的视觉叙述
- 区分“风格本体”和“示例内容”
- 强调为什么这套风格稳定、适合复用
- 补充质感、氛围、适用画幅、成片气质这些管理信息

以你给的样图为例，AI 不应把“某个女孩跳出来”当成风格本体，而应识别：
- **风格本体**：透明设备边界、强透视跃出、颗粒光效、Pixar 半写实 3D、暖粉金紫电影氛围
- **示例内容**：具体是哪个女孩、穿什么、跳什么动作、手机里是什么 UI

所以那段风格描述的本质是：
**把机器层的风格关键词，翻译成产品层的资产说明**

#### 7.4.3 怎么转成 GPT image2 之类模型能识别的“稳定风格资源”
要让后面无论用户再上传什么参考图、再写什么生图关键词，都还能尽量维持这套风格，不能只保存：
- 一段关键词
- 一段描述
- 几张图

而必须把它转成“多层稳定风格资源包”。

这个资源包至少要包含：

1. **图像证据层**
- 封面图
- 风格图集
- 代表性图例
- 每张图的共性标签

2. **语义约束层**
- 风格关键词
- 风格描述
- 适用场景
- 风险提醒

3. **生成控制层**
- 参考图解释方式
- `planningDirectives`
- `promptBackbone`
- `promptDirectives`

4. **验证层**
- 默认测试模型
- 默认比例 / 张数
- 测试样例
- 最近验证结果
- 达标状态

GPT image2 真正能稳定消费的，不是“描述文本”，而是这个资源包在生成前被翻译成的**风格约束包**。

#### 7.4.4 为什么选中资源后，用户换参考图和关键词，结果还能稳定
底层原理不是“让模型记住这几张图”，而是“让风格资源优先级高于临时输入”。

系统运行时应做下面的分层：
- **用户新参考图**：解决“这次画谁 / 画什么内容”
- **用户生图关键词**：解决“这次任务目标是什么”
- **已选风格资源**：解决“必须用什么风格语言来表现”

也就是说，最终给 GPT image2 的不是原始输入拼接，而是：
- 主体任务信息
- 当前参考图内容解释
- 已选风格资源的稳定约束
- 本次允许变化的局部目标

最终结构更接近：
**任务内容 + 当前参考图语义 + 风格资源约束包 + 输出参数**

这样即使用户换了一张猫、换了滑雪、换了人物，只要风格资源还在，模型仍会被稳定约束到：
- 透明屏幕边界
- 强透视前景压缩
- 粒子 / 玻璃碎片爆发
- 暖粉金紫色光
- Pixar 半写实 3D 电影海报感

#### 7.4.5 真正能稳定的关键，不是“风格描述”，而是“资源注入顺序”
要想稳定，最关键的是系统侧的注入顺序：
1. 先识别任务主体与本次参考图内容
2. 再注入风格资源里的稳定视觉边界
3. 再补本次任务差异化目标
4. 最后做模型可消费的 prompt 编排

如果顺序反过来，模型就会被用户最新输入带跑，风格会漂。

所以产品上必须保证：
- 风格资源不是备注字段
- 风格关键词不是普通标签
- 风格描述不是展示文案
- 它们最终都要进入生成控制层，变成 GPT image2 可消费的稳定约束

### 7.5 底层 AI 分析原理
竞品风格导入流程背后的 AI 原理，应按下面的层次设计：

#### 第 1 层：单图视觉特征提取
AI 先从每张参考图中提取基础视觉信号：
- 主体类型
- 姿态 / 动势
- 构图方式
- 镜头视角
- 景深与空间层次
- 色彩主调
- 光照类型
- 材质表现
- 渲染风格
- 比例与版式
- 特殊视觉母题

#### 第 2 层：多图一致性归纳
不是看单张图“像什么”，而是找多张图里**重复出现的稳定信号**。

要区分两类信息：
- **稳定风格信号**
  - 多张图都存在，应该沉淀进风格资产
- **可变内容信号**
  - 只在个别图里出现，不应被错误固化成风格定义

#### 第 2.5 层：多图一致性阈值判断
为了避免用户随手上传几张相似度不够的图，就被系统误判为一个稳定风格，产品侧必须有最小一致性门槛。

建议规则：
- 参考图少于 3 张时，只能生成“低置信度草稿”，不能直接作为可发布资产
- 当 3 张以上图片里，主体、构图、光色、渲染质感至少有 2~3 个维度重复出现时，才允许系统给出“稳定风格候选”判断
- 若出现明显异质图，系统必须在图集上标出“偏离主风格”的异常图，而不是默默一起纳入分析

产品表达上，不要给用户展示抽象分数，而要展示自然语言结果：
- 风格较稳定，可继续测试
- 图集存在偏离图片，建议先清理
- 当前图集不足以归纳稳定风格

#### 第 3 层：关键词对齐与补全
如果用户已经输入了生图关键词，AI 的职责不是覆盖它，而是：
- 检查关键词是否与参考图一致
- 找出关键词遗漏的维度
- 基于图像证据补全缺失项
- 避免补出图上不存在的强结论

#### 第 4 层：双层产物生成
基于“图像一致性特征 + 关键词”，生成两类结果：
1. **机器层结果**：风格关键词 / prompt backbone
2. **产品层结果**：风格描述 / 适用场景 / 风险提醒

这样才能同时满足：
- 生图系统能消费
- 用户能理解和管理

#### 第 5 层：测试标准生成
竞品截图里“测试标准”不是附属信息，而是验证这套风格是否真的可复用的关键。

AI 应根据风格资产生成：
- 默认测试模型
- 默认比例 / 张数
- 1~3 条测试标准
- 每条标准对应要验证的风格能力

### 7.6 对截图样例的具体风格归纳
用户提供的样例里，AI 真正应该提炼的是“稳定风格结构”，而不是只复述剧情。

#### 样例中的稳定风格信号
- 偏暖的蜜桃粉 / 金色 / 紫粉色调
- Pixar 式高完成度 3D 卡通与半写实融合
- 强透视、前景放大、动态跃出画面
- 透明手机屏 / 玻璃框体作为空间边界
- 玻璃碎片、数字粒子、光斑、发光颗粒形成纵深
- 电影感景深与高光晕染
- 竖版社媒海报构图，偏 `9:16`

#### 样例中的可变内容信号
- 具体人物是谁
- 衣服细节
- 当前跳跃动作的叙事含义
- 手机中的具体 UI 文案

因此，正确的 AI 资产化结论应是：
- 把“透明设备边界 + 强透视跃出 + 颗粒光效 + Pixar 半写实 3D + 竖版电影海报感”沉淀为风格
- 把具体人物与具体情节视为测试内容或示例内容，而不是风格本体

### 7.7 导入页字段的正确语义
基于截图，导入页字段应重新定义为：
- **图片模板标题**：资产名，不是测试编号
- **模型分类**：区分“风格资产”与“玩法资产”
- **风格图集**：既是封面来源，也是风格证据库
- **风格关键词**：面向生成系统的高密度风格提示
- **风格描述**：AI 基于图像与关键词归纳的人类可读总结
- **测试标准**：验证这套风格能否稳定迁移的回归样例

### 7.7.1 关键词与描述的编辑边界
关键词和描述都允许人工修订，但两者不能变成两个重复的大文本框，必须有明确边界：

- **关键词**解决“生成系统该怎么画”
  - 可编辑主体表达、构图语言、镜头、材质、光色、氛围、版式
  - 不鼓励写成长段说明文
- **描述**解决“这套风格到底是什么”
  - 用于给人理解、检索、判断适用性
  - 不应重复堆砌关键词，也不应承担生成控制细节

产品上应提供两个不同的编辑心智：
- 关键词区：结构化分段编辑或按块编辑
- 描述区：1 段精炼说明 + 适用场景 / 风险提醒补充

这样可以避免用户在两个输入区来回复制粘贴，重新做成后台表单。

### 7.8 产品规则落点
因此，后续实现必须满足：
1. 导入图集既用于封面，也用于图例与分析证据
2. 关键词允许“用户输入”或“AI 先生成再修订”两种模式
3. 风格描述必须由“图像证据 + 关键词”联合生成，而不是脱离参考图凭空写文案
4. 测试标准必须在导入页阶段就被定义，而不是丢到首页后续补
5. 首页只展示结果，不承担导入建模过程

### 7.8.1 发布前检查固定为 3 项
候选资产详情页里的“发布前检查”必须固定收敛成 3 项，不能继续扩成大而全检查面板：
1. **参考图是否足够代表这套风格**
2. **风格草稿是否完整可理解**
3. **是否已有通过的测试结果**

每一项都必须有：
- 当前状态
- 一句失败原因
- 直达补齐入口

这样用户看到的不是“按钮为什么灰掉”，而是“我离可发布还差哪一步”。

### 7.8.2 正式资产修订风险提示
当用户基于正式资产发起修订时，产品必须默认提示：
- 正式资产本体不应直接被大改
- 新修订优先保存为候选版本
- 只有新候选重新通过测试后，才允许替换正式资产

也就是说，“正式资产派生候选修订”应该是默认路径，“直接覆盖正式资产”只能是极少数高级操作，并放入高级规则区。

### 7.8.3 已选风格资源与临时输入的优先级规则
系统运行时必须明确资源优先级，避免用户一上传新参考图或写了新关键词，就把已选风格冲掉。

固定优先级应为：
1. **已选风格资源**：定义稳定视觉边界
2. **本次任务目标**：定义这次画什么内容
3. **本次参考图**：补充主体内容与局部姿态信息
4. **本次临时关键词**：补充局部变化要求

如果本次输入与已选风格冲突，系统应优先保留风格资源里的稳定信号，并把新输入理解为“内容变化”，而不是“风格改写”。

### 7.9 首页禁止继续承载的内容
以下内容不应继续散落在 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 首页：
- 导入过程表单
- 风格关键词大文本编辑
- 风格描述大文本编辑
- 测试标准编辑器
- 测试结果回写区
- 发布门槛解释

首页只能保留：
- 资产列表
- 资产状态
- 导入入口
- 进入详情

而不是把这些能力零散挂在风格库中心首页各处。

---

## 8. 当前页面问题复盘

当前 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 的问题：
- 一级页承担了过多低频复杂操作
- 首页同时存在“列表页”和“二级详情页”的逻辑
- 卡片信息密度过高
- 术语偏系统实现，而非用户语言
- 竞品导入主链路没有收成单入口流程
- 导入、测试、编辑、发布混在一个页面，导致强烈 demo 感

---

## 9. 下一步实施顺序

### Step A
先补竞品导入逻辑定义：
- 明确“竞品导入逻辑”是导入流程，不是抓图按钮
- 先定义导入页结构与步骤

### Step B
重做 IA：
- 首页只保留列表页职责
- 详情迁移为二级页面 / 详情抽屉
- 导入流程迁出首页

### Step C
重做首页卡片与文案：
- 降低信息密度
- 移除专业术语
- 强化状态与可用性表达

### Step C
补竞品导入主链路：
- 单独导入入口
- 统一链接导入 / 当前页导入 / 图片导入

### Step D
再做 UI 设计与前端实现

---

## 10. 本阶段结论

本轮整改不应继续在 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 上堆功能，而应先回到产品层，把“列表页”“详情页”“导入流”重新拆清。只有这样，才能消除 demo 感、术语污染和竞品逻辑断裂问题。

---

## 11. 阶段回写与防跑偏规则

从本阶段开始，后续每完成一个整改阶段，都必须先回写文档，再进入下一阶段实现，防止重新做歪。

### 11.1 必做顺序
1. 开始任何一个整改阶段前，必须同时对照 [`STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md) 和 [`STYLE_LIBRARY_CENTER_REMEDIATION_REVIEW_PM_UI_20260514.md`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_REVIEW_PM_UI_20260514.md)
2. 先完成当前阶段目标
3. 再回写 [`STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md)
4. 再补一轮 PM / UI 偏航审查到 [`STYLE_LIBRARY_CENTER_REMEDIATION_REVIEW_PM_UI_20260514.md`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_REVIEW_PM_UI_20260514.md)
5. 只有审查通过后，才能进入下一阶段

### 11.2 每阶段回写至少包含 4 项
- **本阶段目标**：原计划要解决什么
- **本阶段实际产出**：页面、交互、文案、组件结构改了什么
- **偏航检查**：是否重新出现首页变重、术语回流、字段堆叠、导入分散
- **下一阶段边界**：下一步允许做什么，不允许顺手扩什么

### 11.3 偏航审查固定检查项
每次阶段回写时，必须固定检查下面 6 项：
1. 一级页有没有重新混入编辑 / 测试 / 发布
2. 卡片有没有重新变胖、变成 demo 面板
3. 导入页有没有重新退化成超长表单
4. 默认视图有没有暴露 [`planningDirectives`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:400) / [`promptBackbone`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:401) / [`promptDirectives`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:402) 这类技术字段
5. 用户是否还能明确知道自己当前处于“浏览 / 导入 / 经营”的哪一层
6. 页面气质是否仍然克制、清晰，而不是后台风 / demo 风

### 11.4 执行约束
如果某个阶段实现完成，但还没有回写这两份文档：
- [`STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md)
- [`STYLE_LIBRARY_CENTER_REMEDIATION_REVIEW_PM_UI_20260514.md`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_REVIEW_PM_UI_20260514.md)

则视为该阶段**未完成**，不能直接进入下一步代码扩展。

---

## 12. 阶段回写记录

### 12.1 Remediation 2：首页卡片降噪与术语收口

#### 本阶段目标
- 降低 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 一级页卡片信息密度
- 移除首页和默认详情区里过重的后台术语
- 把技术字段收进默认折叠的“高级规则”区

#### 本阶段实际产出
- 首页顶部统计从 4 块大数字卡片收成轻量状态条，减少后台仪表盘感
- 首页主标题与说明文案改成“风格资产列表 / 浏览与进入下一步”语义，去掉“经营台”等重运营措辞
- 候选卡片收缩为：标题、摘要、单行状态、少量辅助标签，不再显示多按钮和多组字段
- 正式卡片收缩为：封面、标题、摘要、状态、最近验证摘要，不再在首页展开通过/失败统计、结果预览、对比摘要等重内容
- 默认详情区将“关键词标签 / 详细描述 / Prompt 骨架 / 规划指令 / Prompt 指令”改写为更接近产品语言的“风格重点 / 风格说明 / 高级规则”等表达
- [`planningDirectives`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:400)、[`promptBackbone`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:401)、[`promptDirectives`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_PM_PLAN_20260514.md:402) 已收进默认折叠的“高级规则”区
- “测试执行闭环 / 测试门槛检查 / 资产分层状态”等文案已收口为更接近用户任务流的“测试记录 / 发布前检查 / 当前状态”表达

#### 偏航检查
- **一级页有没有重新混入编辑 / 测试 / 发布**：仍然存在详情侧栏，但首页卡片本身已明显降重，未继续把测试结果大块内容塞回卡片
- **卡片有没有重新变胖、变成 demo 面板**：候选卡片已明显收缩；正式卡片从重型信息卡降为轻摘要卡，风险下降
- **默认视图有没有暴露技术字段**：默认区已收起，只在“高级规则”里保留
- **页面语义是否仍偏后台**：核心术语已明显缓和，但二级详情仍以内联侧栏形式存在，一级 / 二级层级断裂还不够强

#### 下一阶段边界
- 下一阶段只允许推进“导入主链路收拢”和“一级 / 二级层级进一步拆分”
- 不允许在当前首页继续新增测试统计、版本摘要、结果预览、治理说明类新模块
- 不允许把导入流程字段继续散落回首页默认视图

### 12.2 Remediation 3：导入主链路收拢

#### 本阶段目标
- 把风格导入主链路重新收拢到 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx)
- 让“提炼 → 检查 → 加入候选 → 去中心继续整理”这条路径更清晰
- 继续移除导入弹层中的工程术语，避免像调试面板

#### 本阶段实际产出
- [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 的导入弹层标题已从 `Smart Import` 收口为“风格导入”
- 导入说明已改成“先分析参考内容，再生成候选风格草稿，再加入候选区继续整理和测试”的任务流表达
- 导入状态文案已从“候选资产 / 候选箱”改成“候选风格 / 候选区”
- 导入检查项已从“规划约束与 Prompt 约束”等实现层表达，改成“生成重点和输出重点”“回归样例包含标题和测试指令”等产品语言
- 导入结果里新增“去风格库中心继续整理”动作，用户完成加入候选区后可直接进入 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx)
- 导入弹层里的“规划约束 / Prompt 约束 / 候选测试确认”已改写为“生成前重点 / 输出重点 / 回归样例预览”

#### 偏航检查
- **导入主链路有没有继续散落在首页**：当前导入动作仍由 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 承担，没有重新散落回 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 首页
- **导入页有没有退化成后台调试面板**：明显改善，但弹层里仍保留“导入类型 / 匹配把握 / AI 分析过程”等偏系统表达，仍有轻度工具感
- **导入完成后下一步是否明确**：已补“去风格库中心继续整理”按钮，主链路已打通
- **是否还存在首页承接导入建模的风险**：暂时压住，但只要下一阶段不继续拆首页 / 详情层级，用户仍可能感觉中心首页承担过多后续经营逻辑

#### 下一阶段边界
- 下一阶段必须推进“首页收缩为浏览页、详情迁入独立层级或更强二级承载”
- 不允许继续把导入建模、测试确认、发布判断重新挂回首页卡片区域
- 不允许在导入弹层继续新增工程字段解释型区块，后续只允许向更像任务向导的方向继续收口

### 12.3 Remediation 4：首页收缩为浏览页，详情迁入独立层级

#### 本阶段目标
- 让 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 首页真正只承担浏览职责
- 去掉“列表 + 常驻详情侧栏”同屏并列结构
- 把编辑 / 测试 / 发布相关能力迁入更强的二级详情层

#### 本阶段实际产出
- [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 不再默认自动选中第一条资产，首页首次进入回到纯浏览状态
- 原先常驻在首页右侧的详情编辑区已迁移成覆盖层抽屉，用户必须从列表卡片进入详情层后才会看到经营内容
- 详情层新增“返回列表”动作和“当前首页只保留浏览职责”的明确说明，强化一级 / 二级层级断裂
- 首页主内容区保留候选风格与正式风格列表，详情经营能力不再与列表并排常驻显示
- 详情层继续承接说明编辑、回归样例、验证记录、发布前检查、状态和保存动作，首页本体不再直接暴露这些经营模块

#### 偏航检查
- **一级页有没有重新混入编辑 / 测试 / 发布**：已明显收住，首页本体只剩浏览与进入详情；经营能力已进入详情抽屉层
- **卡片有没有重新变胖、变成 demo 面板**：没有回退，候选与正式卡片仍保持轻量摘要结构
- **用户是否还能明确知道自己当前处于“浏览 / 导入 / 经营”的哪一层**：明显改善；浏览在首页，经营在抽屉详情层，导入在 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx)
- **是否还残留后台风惯性**：有轻度残留，主要在详情抽屉内仍有较长表单和少量“正式资产 / 候选资产 / 测试指令”等运营或系统感用语

#### 下一阶段边界
- 下一阶段只允许做构建回归、设计审稿与最后一轮 UI / 语义清理
- 不允许在首页重新挂回常驻详情区
- 不允许为了方便实现，再把详情经营模块塞回列表页主画面

### 12.4 Remediation 5：构建回归、残留语义清理与设计审稿收尾

#### 本阶段目标
- 完成 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 与 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 的最后一轮残留语义清理
- 运行构建回归，确认抽屉化详情层与导入链路调整没有引入编译问题
- 结合 [`STYLE_LIBRARY_CENTER_REMEDIATION_REVIEW_PM_UI_20260514.md`](docs/product/STYLE_LIBRARY_CENTER_REMEDIATION_REVIEW_PM_UI_20260514.md) 做最终一轮 PM / UI 审稿收尾

#### 本阶段实际产出
- [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 继续把“风格资产 / 删除资产 / 正式状态 / 测试样例”等残留措辞收口为更偏产品语言的“可复用风格 / 删除风格 / 当前验证 / 回归样例”等表达
- [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 中用于复制测试内容的文案包也已同步改成“风格 / 回归样例 / 测试指令”，避免把实现层命名继续暴露给用户
- [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 已将“导入类型 / 匹配把握 / AI 分析过程 / 测试样例”等残留工具感文案进一步收口为“导入方式 / 匹配程度 / 分析摘要 / 回归样例”
- 已运行 `npx vite build`，当前构建通过；仅保留 Vite 默认的大包体 warning，没有新增阻塞性错误

#### 偏航检查
- **一级页有没有重新混入编辑 / 测试 / 发布**：没有；[`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 首页仍保持浏览态，经营内容继续留在详情抽屉层
- **卡片有没有重新变胖、变成 demo 面板**：没有；本阶段只做文案清理与回归，没有回退首页卡片密度
- **导入页有没有重新退化成超长表单**：没有新增退化；[`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 仍是独立导入承载层，但任务向导化仍属于后续可继续优化项
- **默认视图有没有暴露技术字段**：没有；技术字段仍在“高级规则”折叠区内，默认视图继续使用产品语言
- **用户是否还能明确知道自己当前处于“浏览 / 导入 / 经营”的哪一层**：可以；浏览、导入、经营三层边界在当前实现里已稳定
- **页面气质是否仍然克制、清晰，而不是后台风 / demo 风**：基本达标；首页与详情抽屉的产品语义已明显收口，剩余风险主要是导入体验距离严格 4 步向导仍有演进空间

#### 下一阶段边界
- 当前整改闭环已完成；后续如果继续优化，只允许围绕导入向导化、详情抽屉分步化和包体拆分做增量改良
- 不允许借后续优化之名，把首页重新做回混合经营页
- 不允许重新把默认产品文案替换回实现层术语

## 13. Enhancement P0：导入向导化信息架构

### 13.1 页面目标
将 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 从“长弹层分析流”继续收口为严格的 4 步任务向导，让用户感知从“看分析结果”切换为“创建一套候选风格”。

本阶段不改动首页 IA，不触碰 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 的列表 / 详情层级，只定义导入页自身的任务结构与页面骨架。

### 13.2 用户主任务
1. 我先确认这一组图是否值得沉淀成风格
2. 我希望系统帮我生成一份风格草稿
3. 我需要快速确认草稿是否可信、是否可用于后续测试
4. 我希望明确知道下一步是“加入候选”还是“继续补齐”

### 13.3 四步结构定义
#### Step 1：选图并命名
目标：确认导入对象是否成立。

只允许出现：
- 当前案例 / 模板预览图
- 导入来源说明
- 风格名称
- 风格类型
- 一句导入提示

禁止出现：
- AI 分析长文本
- 测试检查项
- 回归样例列表
- 保存动作

主按钮：开始生成风格草稿

#### Step 2：生成风格草稿
目标：让用户看到系统正在如何提炼风格。

只允许出现：
- 当前生成状态
- 2~3 条分析进度文案
- 失败提示与重试入口

禁止出现：
- 完整草稿表单
- 保存到候选动作
- 大段样例列表

主按钮：生成中时不可点；成功后进入下一步

#### Step 3：确认风格定义
目标：确认这套风格是否已经被定义清楚。

只允许出现：
- 标题
- 一句话摘要
- 风格说明
- 风格重点
- 适用场景
- 生成前重点 / 输出重点

禁止出现：
- 发布判断
- 大量风险提示堆叠
- 长篇测试结果描述

主按钮：进入测试检查

#### Step 4：测试并加入候选
目标：判断是否达到进入候选区的最低门槛。

只允许出现：
- 固定检查项
- 回归样例预览
- 缺失项提示
- 加入候选动作
- 成功后去风格库中心继续整理

禁止出现：
- 再次展开完整草稿表单
- 与前 3 步重复的大段分析内容

主按钮：加入候选区
次按钮：去风格库中心继续整理（仅保存成功后出现）

### 13.4 页面区块划分
导入弹层结构改为：
1. 顶部区：步骤条 + 标题 + 当前步骤说明
2. 主内容区：只渲染当前步骤内容
3. 底部操作区：上一步 / 下一步 / 主动作

额外规则：
- 每一步只允许 1 个主要视觉重点
- 非当前步骤内容默认折叠，不得连续平铺成长页
- 步骤条必须显式显示 4 步，避免用户把当前流程理解成分析面板

### 13.5 文案与状态约束
默认对外文案统一使用：
- 选图并命名
- 生成风格草稿
- 确认风格定义
- 测试并加入候选

避免继续出现：
- 智能导入
- 分析弹层
- 工具结果
- 技术字段名直出

### 13.6 本阶段允许与禁止
允许：
- 重构 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 的弹层结构
- 新增步骤状态与步骤导航 UI
- 调整导入弹层中现有区块的分组顺序与显示时机

禁止：
- 把导入向导能力重新挂回 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 首页
- 顺手改造详情抽屉分步化
- 顺手扩写新的风格字段或新的保存分支

## 14. Enhancement P1：导入向导化前端实现

### 14.1 本阶段目标
- 将 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 的导入弹层重构为严格 4 步任务向导
- 让“开始生成 / 确认草稿 / 测试检查 / 加入候选”形成单路径前进，而不是继续保留长分析页
- 保持成功后仍可直达 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx)

### 14.2 本阶段实际产出
- [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 的 [`SmartImportDialog`](pages/GptImageInspiration.tsx:289) 已改成 4 步 stepper 结构，顶部明确显示“选图并命名 / 生成风格草稿 / 确认风格定义 / 测试并加入候选”
- 导入入口不再点下即直接开始分析，而是先进入 Step 1；用户确认对象后，再由主按钮触发分析
- 分析中间态被收束到 Step 2，分析文案不再与草稿预览、检查项、回归样例整页并列铺开
- 风格草稿确认被收束到 Step 3，只展示标题、摘要、说明、风格重点、适用场景与“生成前重点 / 输出重点”
- 加入候选前检查与回归样例预览被收束到 Step 4，保存动作只保留在最后一步，成功后仍提供“去风格库中心继续整理”动作
- [`importAsStyleLibrary`](pages/GptImageInspiration.tsx:1003) 已改成“先打开向导、再触发分析”；分析触发逻辑被拆到独立的 [`startStyleLibraryImportAnalysis()`](pages/GptImageInspiration.tsx:1012)

### 14.3 偏航检查
- **一级页有没有重新混入编辑 / 测试 / 发布**：没有；导入能力仍只停留在 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx)
- **卡片有没有重新变胖、变成 demo 面板**：没有；本阶段只改导入向导，不回退首页卡片结构
- **导入页有没有重新退化成超长表单**：没有；主内容已按步骤切换，不再四大区块整页并列铺开
- **默认视图有没有暴露技术字段**：没有新增直出；默认对外仍以产品语言为主
- **用户是否还能明确知道自己当前处于“浏览 / 导入 / 经营”的哪一层**：可以；导入层语义更强，且成功后继续流向 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx)
- **页面气质是否仍然克制、清晰，而不是后台风 / demo 风**：明显改善；当前已从“分析弹层感”进一步收口为“任务向导感”

### 14.4 下一阶段边界
- 下一阶段只允许做构建回归、文档回写与 PM / UI 审稿补录
- 不允许在当前向导里顺手追加新的风格字段编辑器
- 不允许把 Step 3 与 Step 4 再合并回长滚动页

## 15. Enhancement P2：导入向导化构建回归与文档回写

### 15.1 本阶段目标
- 验证导入向导化改造后的 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 可以稳定构建
- 将本轮增强结果回写到整改主方案与审稿文档

### 15.2 本阶段实际产出
- 已执行 `npx vite build`，当前构建通过
- 当前仅保留既有 chunk size warning，没有新增阻塞性编译错误
- 已将 Enhancement P1 / P2 的实现边界与审稿基线回写到两份整改文档

### 15.3 下一阶段边界
- 下一阶段进入 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 详情抽屉分步化信息架构设计
- 不允许在未完成详情抽屉策略前，直接大改其实现结构

## 16. Enhancement P3：详情抽屉分步化信息架构

### 16.1 页面目标
将 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 当前“单抽屉长经营页”收口为更明确的分步经营结构，让用户在详情层内也能清楚知道自己现在是在“补资料 / 管样例 / 回填验证 / 判断是否可转正式”。

本阶段只定义详情抽屉的信息架构、区块分层与交互顺序，不直接改动首页列表结构，也不顺手扩大风格字段范围。

### 16.2 用户主任务
1. 我先确认当前看的到底是哪套风格，以及它现在处于什么状态
2. 我想先补齐基础说明和参考图，不想一进来就面对所有表单
3. 我想集中处理回归样例和验证记录，而不是在一长页里来回找位置
4. 我想快速知道这条候选距离转正式还差什么
5. 如果它已经是正式风格，我想明确应该如何修订，而不是直接覆盖

### 16.3 抽屉分步结构定义
#### Step 1：概览与基础资料
目标：确认对象、补齐基础说明。

只允许出现：
- 风格标题
- 当前身份（候选 / 正式）
- 当前状态摘要
- 用途说明
- 风格类型
- 风格重点
- 风格说明
- 封面与参考图集
- 适用场景 / 风险提醒 / 参考图使用说明

禁止出现：
- 验证结果表单
- 转正式动作
- 大段版本说明
- 高级规则默认展开

主按钮：保存基础资料

#### Step 2：回归样例
目标：维护可复用的测试样例。

只允许出现：
- 回归样例列表
- 新增 / 删除样例
- 样例标题
- 测试指令
- 目标重点
- 参考图、模型、比例、张数

禁止出现：
- 验证结果编辑器
- 发布判断区
- 正式修订说明区

主按钮：保存样例调整

#### Step 3：验证记录
目标：围绕已选回归样例记录验证结论。

只允许出现：
- 样例选择
- 建议比例 / 建议模型 / 建议张数
- 本次关注点
- 复制测试指令 / 新建结果记录
- 验证结果列表
- 结果图、结论、备注、模型、时间

禁止出现：
- 基础资料大表单
- 发布前检查
- 正式修订动作

主按钮：保存验证记录

#### Step 4：发布与版本
目标：判断当前是否可转正式，或如何以安全方式修订正式风格。

只允许出现：
- 发布前检查 3 项
- 当前状态
- 当前正式验证概览（仅正式风格）
- 转正式风格 / 派生候选修订 / 去工作台应用 / 删除
- 保存后的风险提示文案

禁止出现：
- 大量基础字段编辑器
- 长列表样例编辑区
- 技术字段默认展开

主按钮：
- 候选：转正式风格
- 正式：派生候选修订

#### Step 5：高级规则
目标：承接实现层高级约束，但默认不打扰用户。

只允许出现：
- 生成重点骨架
- 规划补充规则
- 输出补充规则
- 高级说明

默认状态：折叠

### 16.4 页面区块与导航策略
详情抽屉结构改为：
1. 顶部区：返回列表 + 标题 + 当前身份 + 当前步骤说明
2. 次级导航：概览与基础资料 / 回归样例 / 验证记录 / 发布与版本 / 高级规则
3. 主内容区：只渲染当前步骤主体
4. 底部操作区：与当前步骤匹配的保存或推进动作

额外规则：
- 默认进入 Step 1，而不是让用户一打开就跌进长表单中段
- 高级规则不参与默认经营顺序，始终后置
- 发布前检查固定只保留 3 项，不再继续膨胀
- 正式风格的“派生候选修订”应比“直接覆盖正式”更靠前、更显眼

### 16.5 状态与文案约束
默认对外文案统一使用：
- 概览与基础资料
- 回归样例
- 验证记录
- 发布与版本
- 高级规则

避免继续出现：
- 候选资产详情 / 正式资产详情
- 对应样例 ID 作为默认主字段
- 技术规则与业务规则混排在同一主区域

### 16.6 本阶段允许与禁止
允许：
- 重构 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 抽屉内部的区块顺序与导航方式
- 新增抽屉内步骤导航或分段导航
- 调整保存动作在不同步骤中的显示逻辑

禁止：
- 把详情经营区重新挂回首页主画面
- 顺手改造首页卡片结构
- 顺手改动导入向导主链路

## 17. Enhancement P4 / P5：详情抽屉分步化实现与构建回归

### 17.1 本阶段目标
- 将 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 的详情抽屉改造成分步经营结构
- 验证抽屉分步化改造后的构建稳定性
- 将本轮实现结果回写到整改主方案与审稿文档

### 17.2 本阶段实际产出
- 已在 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 中新增抽屉内步骤导航，分为“概览与基础资料 / 回归样例 / 验证记录 / 发布与版本 / 高级规则”5 个步骤
- 抽屉主体已改为按 `detailSection` 独立渲染当前步骤，不再把资料、样例、验证、发布整页串在一起
- 抽屉底部操作区已改为随步骤切换，仅显示当前阶段对应的保存、推进或发布动作
- 已执行 `npx vite build`，当前构建通过
- 当前仍只保留既有 chunk size warning，没有新增阻塞性编译错误

### 17.3 本阶段边界检查
- 本轮改造仍停留在 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 抽屉内部，没有把详情经营区重新挂回首页
- 首页卡片结构未被顺手扩大，仍保持列表经营页定位
- [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 的导入向导主链路未被回退或混改

### 17.4 下一阶段边界
- 下一阶段进入风格库相关包体治理，优先评估 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx)、[`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 与工作台侧依赖的拆分机会
- 不在本阶段顺手继续扩大风格库字段与首页视觉结构

## 18. Enhancement P6：风格库相关包体治理评估与实施

### 18.1 本阶段目标
- 评估风格库链路是否仍然拖大首屏与路由 chunk
- 优先处理可明确后置加载的下载 / 导出 / 工作流结果卡片依赖
- 在不回退现有 IA 的前提下完成一次构建回归

### 18.2 本阶段实际产出
- 已将 [`utils/download.ts`](utils/download.ts) 中的 `JSZip` 改为按需动态加载，避免下载工具进入默认同步依赖
- 已将 [`utils/ecommerce-overlay-production.ts`](utils/ecommerce-overlay-production.ts) 中的 zip 导出逻辑改为按需动态加载 `JSZip`
- 已将 [`pages/Workspace/components/workflow/EcommerceWorkflowResultReview.tsx`](pages/Workspace/components/workflow/EcommerceWorkflowResultReview.tsx) 中的结果打包导出改为按需动态加载 `JSZip`
- 已将 [`pages/Workspace/components/AgentMessage.tsx`](pages/Workspace/components/AgentMessage.tsx) 里的工作流卡片改为 `React.lazy()` + `Suspense` 后置加载
- 已将 [`pages/Workspace/components/WorkspaceSidebarLayer.tsx`](pages/Workspace/components/WorkspaceSidebarLayer.tsx) 中的 [`AssistantSidebarProps`](pages/Workspace/components/AssistantSidebar.tsx:297) 改为类型导入，并将 [`AssistantSidebar`](pages/Workspace/components/AssistantSidebar.tsx:311) 改为抽屉层懒加载
- 已补齐 [`pages/Workspace/controllers/useWorkspaceSidebarProps.ts`](pages/Workspace/controllers/useWorkspaceSidebarProps.ts) 对 [`AssistantSidebarProps`](pages/Workspace/components/AssistantSidebar.tsx:297) 的类型引用替换，消除懒加载改造后的类型错误
- 已执行 `npx vite build`，当前构建通过

### 18.3 构建结果判断
- [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 路由 chunk 当前约 56 kB，[`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 路由 chunk 当前约 61 kB，说明风格库相关页面本身已经不再是大包来源
- [`AssistantSidebar`](pages/Workspace/components/AssistantSidebar.tsx:311) 已从更高体量下沉到独立懒加载 chunk，但工作台主 chunk、导出相关 chunk、叠字电商工作流 chunk 仍然超过 warning 阈值
- 当前 warning 的主来源已经从“风格库中心”转移为“工作台 / 电商工作流 / 导出能力”这条更广的工作台链路

### 18.4 结论与下一阶段边界
- 风格库相关包体治理可判定为阶段完成：问题已被定位并做了可落地拆分，风格库路由 chunk 维持轻量
- 后续若继续压缩 warning，应进入新的工作台包体治理阶段，重点处理 [`pages/Workspace.tsx`](pages/Workspace.tsx)、[`pages/Workspace/components/workflow/EcommerceOneClickCards.tsx`](pages/Workspace/components/workflow/EcommerceOneClickCards.tsx) 与电商叠字导出链路
- 不在本阶段继续顺手改动风格库 IA、详情抽屉结构或导入向导流程

## 19. 风格库重构返工：卡片预览化与最小编辑闭环

### 19.1 本阶段目标
- 将 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 从“详情经营页残留形态”收缩为真正的风格卡片列表页
- 卡片视觉与交互尽量对齐 [`pages/Workspace/components/WorkspaceTreePromptNode.tsx`](pages/Workspace/components/WorkspaceTreePromptNode.tsx) 里的关键词节点风格选择界面语言
- 编辑项只保留：封面 / 样图、风格关键词、风格说明
- 将“新增风格”与“从画廊导入风格”统一到同一套最小创建闭环中
- 暂不把测试入口重新塞回主流程，避免再次做成厚重后台页

### 19.2 本阶段实际产出
- 已重写 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx)，首页改为“我的风格 / 待完成 / 系统预设”三段式卡片浏览结构
- 一级卡片改为封面预览 + 标题 + 一句话说明，不再暴露测试、发布、版本比较和大段专业术语
- 已新增统一风格卡片编辑弹层，仅保留：
  - 封面上传
  - 多图上传（首张自动作为封面，其余作为样图）
  - 风格关键词手填 / AI 识别
  - 风格说明手填 / AI 生成
- 已新增“从画廊导入风格”弹层：
  - 读取 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 对应运行时数据
  - 直接复用画廊封面与原始 prompt
  - 自动调用 [`services/gpt-image-smart-import.ts`](services/gpt-image-smart-import.ts) 生成可编辑的关键词与风格说明
- 已将系统预设改为“点开即可另存为我的风格”，不再把复杂字段直接暴露在首页
- 已保留候选资产删除 / 正式资产删除能力，但将其收拢进编辑弹层底部，避免首页出现多操作并列

### 19.3 设计与交互判断
- 首页主任务已收敛为：找卡片 / 进编辑 / 新增 / 从画廊导入
- 一级页不再承担测试台、发布台、版本对比台职责，信息架构明显收缩
- 编辑流程已从“字段经营”改成“先看图，再补关键词和说明”的任务流
- 默认外显文案已切换到产品语言，不再直接暴露 `promptDirectives`、`planningDirectives`、`promptBackbone` 这类系统术语
- 测试能力明确延后，不再强行挂在当前主界面里制造 demo 感

### 19.4 构建回归
- 已执行 `npm run build`
- 当前构建通过
- [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 路由 chunk 当前约 32 kB，说明本轮重写没有把风格库中心重新做重
- 当前 chunk warning 仍主要集中在工作台与导出链路，不属于本轮风格库返工的新增问题

### 19.5 本阶段边界检查
- 没有把旧的测试样例 / 测试结果 / 发布步骤重新挂回首页
- 没有把二级经营型术语重新暴露到默认编辑区
- 没有要求用户先理解资产类型、验证状态、版本语义后才能新增风格卡片
- 画廊导入仍然复用现有数据源，没有再单独复制一套导入资产结构

### 19.6 下一阶段边界
- 如需恢复测试能力，应重新定义其放置位置，不能直接把测试表单塞回当前卡片编辑弹层
- 如需继续治理大包 warning，应转入工作台与电商工作流链路，而不是继续扩大风格库中心字段
- 当前风格库中心后续应优先做真实体验细修，例如空状态、异常提示、上传失败提示和更细的操作反馈，而不是回到后台式字段扩张

## 20. 风格库重构纠偏：生图关键词 / 标签 / 新分析能力

### 20.1 本阶段目标
- 将 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 中原本容易被误解成“风格关键词”的区域，明确改成“该风格图对应的生图关键词 / Prompt”
- 为风格卡片新增独立“标签”字段，和生图关键词分开建模
- 停止复用旧的 [`analyzeSmartStyleImport()`](services/gpt-image-smart-import.ts:486)，改为当前页内新的风格卡片分析能力
- 保持画廊导入时直接沿用已有 Prompt 与标签，新建时则由 AI 分析 Prompt 时顺带补齐标签

### 20.2 本阶段实际产出
- 已在 [`types/common.ts`](types/common.ts) 的 [`WorkspaceStyleLibrary`](types/common.ts:86) 中新增 `promptText` 与 `tags` 字段，形成“标签 / 生图关键词 / 风格说明”三层表达
- 已同步更新 [`services/vision-orchestrator/style-library.ts`](services/vision-orchestrator/style-library.ts) 与 [`services/vision-orchestrator/style-library-draft.ts`](services/vision-orchestrator/style-library-draft.ts) 的标准化、克隆与草稿构建逻辑，保证新增字段能被持久化链路识别
- 已将 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 编辑弹层从“风格关键词”改为：
  - 生图关键词 / Prompt
  - 标签
  - 风格说明
- 已在 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 中新增 `analyzeStyleCardDraft()`，替代旧的 [`analyzeSmartStyleImport()`](services/gpt-image-smart-import.ts:486) 复用方式：
  - `task="prompt"` 时分析风格图并输出生图关键词 / Prompt，同时补齐标签
  - `task="description"` 时基于风格图、已有 Prompt 与标签补齐风格说明
- 已将画廊导入改为：
  - 直接沿用画廊现成 Prompt
  - 直接沿用画廊现成标签
  - 仅额外生成更准确的风格说明

### 20.3 产品判断
- “生图关键词 / Prompt” 与 “标签” 已被拆开，避免再把用于生成的 Prompt 骨架和用于分类浏览的标签混在一个输入框里
- 画廊导入已遵守“已有就沿用”的原则，不再强制重跑旧导入分析逻辑去改写现成内容
- 新建风格则改为“先看图 → AI 分析 Prompt 并顺带补标签 → 用户再微调说明”，更贴近真实产品创建流程

### 20.4 构建回归
- 已再次执行 `npm run build`
- 当前构建通过
- [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 路由 chunk 当前约 34 kB，仍维持轻量
- 当前 warning 仍集中在工作台与导出链路，不属于本轮纠偏新增问题

### 20.5 本阶段边界检查
- 没有把测试、发布、版本信息重新挂回风格卡片默认编辑区
- 没有把标签字段继续伪装成 Prompt 或把 Prompt 继续塞回“风格关键词”名义下
- 没有继续复用旧的导入分析结果覆盖当前卡片建模语义

### 20.6 下一阶段边界
- 如需继续细化风格资产模型，应优先围绕 Prompt 质量、标签可编辑性、失败提示和空状态做体验打磨
- 不在下一阶段顺手把当前轻量编辑弹层再次扩展成后台经营表单

## 21. 风格卡片生成链路专项审计：上传图 → AI 分析 → 关键词节点 → 实际生图

### 21.1 本阶段目标
- 审计 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 中风格卡片上传图、AI 分析、字段落库的真实链路
- 审计 [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 仍在运行的旧画廊导入器链路
- 审计 [`pages/Workspace/components/WorkspaceTreePromptNode.tsx`](pages/Workspace/components/WorkspaceTreePromptNode.tsx) 选择风格卡片后，到 [`pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts`](pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts) 与 [`services/vision-orchestrator/prompt-composer.ts`](services/vision-orchestrator/prompt-composer.ts) 的实际生图链路
- 先把不一致点、断点、权重缺口、模型路由问题写入文档，再进入实现修正

### 21.2 当前链路拆解结论
#### A. 上传图在风格卡片侧的当前用途
1. 在 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 中，上传图当前同时承担：
   - 卡片封面 / 样图展示
   - 提交给 [`analyzeStyleCardDraft()`](pages/StyleLibraryCenter.tsx:485) 做 AI 分析
2. 但这些图在“保存为风格卡片”后，仅以 [`WorkspaceStyleLibrary.referenceImageUrls`](types/common.ts:93) 的形式落库；它们**还没有自动并入**关键词节点的实际生图参考图输入链。
3. 也就是说，当前“上传图可用于建卡分析”成立，但“上传图在后续生图时会随机抽一张当风格参考图使用”这一目标**尚未成立**。

#### B. 风格卡片字段当前如何影响生图
1. 关键词节点选中风格卡片后，会把资产写入 [`CanvasElement.genStyleLibrary`](types/common.ts:173)，入口在 [`pages/Workspace/components/WorkspaceTreePromptNode.tsx`](pages/Workspace/components/WorkspaceTreePromptNode.tsx:2935)。
2. 进入生图时，工作台会在 [`buildDirectStyleLibraryPrompt()`](pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts:90) 中，将风格卡片转成一段文字前缀附加到用户 Prompt 前。
3. 当前真正被拼进 Prompt 的字段只有：
   - `title`
   - `summary`
   - `referenceInterpretation`
   - `planningDirectives`
   - `promptBackbone`
   - `promptDirectives`
4. 当前 **没有显式拼入**：
   - `promptText`
   - `tags`
   - `description`
5. 同样的问题也存在于 [`buildStyleLibraryLines()`](services/vision-orchestrator/prompt-composer.ts:167)：编排器输出 Prompt 时仍主要序列化旧字段，而没有把新的 `promptText` / `tags` / `description` 作为一等约束输出。

#### C. 风格图当前没有接入实际参考图链
1. 工作台真实送入图像模型的参考图来源，当前仍以 [`CanvasElement.genRefImages`](types/common.ts:182) / [`CanvasElement.genRefImage`](types/common.ts:181) 为主，入口可见于 [`pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts`](pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts:1207)。
2. 之后会经由 [`planVisualGenerationWithModel()`](services/vision-orchestrator/planner.ts:302) 与 [`buildExecutionFromPlan()`](services/vision-orchestrator/planner.ts:192) 下发为最终 `referenceImages`。
3. 当前链路中，没有看到把 [`WorkspaceStyleLibrary.referenceImageUrls`](types/common.ts:93) 自动合并进 `manualReferenceImages` 或 `referenceImages` 的逻辑。
4. 因此：
   - 选中风格卡片 ≠ 自动携带该卡片的风格图进入模型
   - 更不存在“从该卡片多张风格图里随机抽一张作为 style anchor”的实现
5. 现在的风格卡片主要还是“文字模板约束”，还不是“图文一体的风格模板”。

### 21.3 模型路由为何会落到云雾，而不是全局多模态 xcode GPT-5.4
#### A. 当前风格卡片 AI 分析的取模方式
1. [`analyzeStyleCardDraft()`](pages/StyleLibraryCenter.tsx:485) 当前调用：
   - [`generateJsonResponse()`](services/gemini.ts:1130)
   - 仅传入 `model: getBestModelId("text")`，见 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx:516)
2. [`getBestModelId()`](services/gemini.ts:1582) 只返回 `modelId`，**不会返回 `providerId`**。
3. 但 [`generateJsonResponse()`](services/gemini.ts:1130) 实际是支持 `providerId` 的；如果不传，它会按默认 provider 路由。

#### B. 当前“全局多模态模型”与“文本模型”不是一条配置链
1. 用户期望的“全局多模态 / visual orchestrator”配置读取入口在 [`getVisualOrchestratorModelConfig()`](services/provider-settings.ts:581)。
2. 该配置会保留：
   - `modelId`
   - `providerId`
3. 但 [`getBestModelSelection()`](services/gemini.ts:1497) 的 `text` / `thinking` 分支，优先读取的是 [`selectedScriptModels`](services/gemini.ts:1477)，不是 [`visualOrchestratorModel`](services/provider-settings.ts:585)。
4. 所以现在风格卡片 AI 分析并没有走“视觉编排模型配置”，而是走“文本模型映射配置 + 默认 provider”。

#### C. 结论
- “为何打到云雾”不是单点 bug，而是两层错位叠加：
  1. [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 调用分析时没有传 `providerId`
  2. 它选模型时用的是 [`getBestModelId()`](services/gemini.ts:1582) 这条“文本模型”链，而不是 [`getVisualOrchestratorModelConfig()`](services/provider-settings.ts:581) 这条“全局多模态 / 编排模型”链
- 因此当前命中的 provider 很可能回落到默认代理路由，看起来就像“为什么又走云雾了”。

### 21.4 旧画廊导入器仍然存在的错位
1. [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 仍在调用旧的 [`analyzeSmartStyleImport()`](services/gpt-image-smart-import.ts:486)，见 [`startStyleLibraryImportAnalysis()`](pages/GptImageInspiration.tsx:1155)。
2. 这条旧链路内部同样是 `model: getBestModelId("text")`，见 [`services/gpt-image-smart-import.ts`](services/gpt-image-smart-import.ts:490)，所以它也继承了同一类 provider 丢失问题。
3. 更关键的是，旧导入器产出的核心结构仍围绕：
   - `referenceInterpretation`
   - `planningDirectives`
   - `promptDirectives`
   - `promptBackbone`
4. 它虽然会写 `keywords`，但没有围绕新的：
   - `promptText`
   - `tags`
   - “原则级风格说明”
   做统一建模。
5. 这说明现在存在两套并行语义：
   - 新卡片页：Prompt / 标签 / 说明
   - 旧画廊导入器：骨架指令 / 规划约束 / 提示词指令
6. 如果不先统一，后续会持续出现：同样叫“风格卡片”，但不同入口产出完全不是一套资产语义。

### 21.5 当前“风格说明”为什么还不够像你要的那种原则分析
1. [`analyzeStyleCardDraft()`](pages/StyleLibraryCenter.tsx:485) 目前虽然要求 `description` 聚焦光线、构图、材质等，但仍偏“稳定视觉特征总结”。
2. 它没有强制输出更明确的原则层结构，例如：
   - 主体呈现原则
   - 镜头与视角原则
   - 构图骨架原则
   - 光线组织原则
   - 色彩与材质原则
   - 氛围与渲染原则
   - 应避免引入的漂移项
3. 所以当前结果容易变成“比较好的说明文”，但还不是“可稳定指导后续生成的风格原则卡”。
4. 下一阶段应把“风格说明”从 prose summary 升级成“可复用原则分层”，否则后续即便把它拼进 Prompt，权重也仍然偏弱。

### 21.6 当前模板权重与合成顺序的主要缺口
#### 缺口 1：模板字段没有成为真正的第一优先级结构
- 现在更像“把风格卡片附加在 Prompt 前面”，而不是“先由风格卡片定义风格模板，再把用户内容填进去”。
- 用户要求的是模板优先，当前实现仍偏用户 Prompt 主导、风格库辅助。

#### 缺口 2：风格图没有参与最终 reference merge
- 当前参考图 merge 只处理用户手动参考图与一致性锚点。
- 风格卡片样图没有参与 merge，所以模板的图像权重几乎为 0。

#### 缺口 3：`promptText` / `description` / `tags` 没有形成固定模板
- 当前只是在 [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 保存时，把三者再投影成 `promptBackbone` / `planningDirectives` / `promptDirectives`。
- 但下游没有把“原始 Prompt + 原始原则说明”作为稳定模板源来消费。

#### 缺口 4：运行时 overlay 仍沿用旧字段模型
- [`WorkspaceStyleLibraryRuntimeOverlay`](types/common.ts:114) 当前只支持：
  - `summary`
  - `referenceInterpretation`
  - `planningDirectives`
  - `promptDirectives`
  - `promptBackbone`
- 不支持：
  - `promptText`
  - `tags`
  - `description`
- 这意味着即便编排器在运行时想微调新的卡片字段，也没有正式承载位。

### 21.7 本轮新增识别出的高风险错位
1. **新旧资产语义双轨并存**
   - [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx) 已进入新语义；[`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx) 与 [`services/gpt-image-smart-import.ts`](services/gpt-image-smart-import.ts) 仍停留在旧语义。
2. **风格图“建卡时可见，生图时缺席”**
   - 用户会认为上传了风格图就会参与后续生成，但当前事实并非如此。
3. **风格卡片文本字段已落库，但编排器未真正消费**
   - `promptText` / `tags` / `description` 目前更像存储字段，不是强约束字段。
4. **模型配置链路分裂**
   - 卡片 AI 分析、旧导入分析、视觉编排分别走不同取模入口，后续很容易出现“这个地方走 xcode，那个地方又走 Yunwu”的体验断裂。

### 21.8 下一阶段整改原则
1. 先统一“风格卡片”资产语义：
   - 图集
   - `promptText`
   - `tags`
   - 原则级 `description`
2. 再统一三条入口：
   - [`pages/StyleLibraryCenter.tsx`](pages/StyleLibraryCenter.tsx)
   - [`pages/GptImageInspiration.tsx`](pages/GptImageInspiration.tsx)
   - [`pages/Workspace/components/WorkspaceTreePromptNode.tsx`](pages/Workspace/components/WorkspaceTreePromptNode.tsx)
3. 然后修正两条下游链路：
   - 模型路由统一到“带 providerId 的明确模型配置”
   - 生图执行统一到“模板文字 + 模板风格图”双注入
4. 最后才进入实现层优化：
   - 随机 / 轮换 style anchor 选择策略
   - 模板优先的 Prompt 合成顺序
   - overlay 是否扩展支持 `promptText` / `tags` / `description`
