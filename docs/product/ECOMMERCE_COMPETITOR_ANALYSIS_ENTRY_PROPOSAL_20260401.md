# 电商详情页竞品分析入口方案

## 目标

在现有“商品图 -> 规划整套详情页 -> 每张图带字直出 -> 系统接管可编辑文字”的主流程前，增加一个可选的“竞品详情页分析入口”。

这个入口的目标不是照搬竞品视觉，而是提炼竞品详情页背后的原理级策略，并把这些策略结论注入后续规划。

一句话定义：

- 商品分析决定“讲什么”
- 竞品分析决定“怎么讲更成熟”

## 产品定位

竞品详情页输入应被定义为“策略参考源”，而不是“视觉复刻模板”。

系统需要重点分析：

- 竞品如何安排整套详情页图序
- 每张图承担什么商业任务
- 卖点推进顺序是什么
- 信息层级如何组织
- 哪些版式和讲法是行业共性
- 哪些打法不适合直接照搬

## 建议接入位置

建议把竞品分析入口放在工作流最前段，作为可选增强输入。

理想流程：

1. 输入商品图、简述、平台偏好
2. 可选上传竞品详情页整套图
3. 系统先做竞品详情页原理分析
4. 输出竞品策略摘要
5. 再结合我方商品做整套详情页规划
6. 每张图直接带字生成
7. 系统把每张图的文字接管为可编辑文字层
8. 只有异常乱码图才触发擦字和原位替换
9. 用户统一检查整套图并微调

## 用户输入设计

建议支持两类输入。

### 1. 竞品详情页整套图

一个竞品应被视为“一套详情页”，而不是若干零散参考图。

建议支持：

- 逐张上传详情页图片
- 拖拽排序
- 给每套竞品命名
- 支持上传多套竞品

推荐结构：

- 竞品 A
- 图 1
- 图 2
- 图 3
- 图 4
- 图 5
- 图 6
- 图 7

### 2. 可选补充信息

建议允许用户额外填写：

- 竞品名称
- 店铺名或链接
- 你觉得它强在哪
- 你想借鉴的方向

这些信息不是必填，但可以帮助模型更准确地区分“行业常规策略”和“用户主观关注点”。

## 系统应分析什么

竞品分析不应该只做图像表面描述，而应该输出下列原理级结论。

### 1. 图序结构

识别整套详情页中各页的大致角色，例如：

- 主图
- 白底图
- 卖点图
- 场景图
- 参数图
- 结构图
- 对比图
- 收口图

### 2. 每张图的商业任务

识别每张图在整套转化链路中的作用，例如：

- 建立第一眼认知
- 展示标准外观
- 承接核心卖点
- 建立使用场景代入
- 解释结构或参数
- 做差异化说明
- 做信任背书和转化收口

### 3. 信息层级

分析竞品页面中的：

- 主标题风格
- 副标题作用
- 卖点标签密度
- 参数区是否独立
- 收口页是否强调信任或购买理由

### 4. 视觉语法

提炼竞品详情页的版式规律，例如：

- 商品和文字是左右分栏还是上下结构
- 留白集中在哪些区域
- 版式更偏主视觉型还是说明模块型
- 文字是大标题驱动还是标签矩阵驱动

### 5. 可借鉴原则与禁抄边界

系统要明确区分：

- 可借鉴的行业通用策略
- 不建议直接照搬的竞品特有表达

## 建议输出的数据结构

建议不要只输出自然语言摘要，而要输出结构化结果，方便后续规划直接消费。

```ts
type CompetitorDeckAnalysis = {
  competitorId: string;
  competitorName?: string;

  overview: {
    productPositioning: string;
    overallStyle: string;
    narrativePattern: string;
    conversionStrategy: string;
  };

  pageSequence: Array<{
    pageIndex: number;
    pageRole:
      | "hero"
      | "white-bg"
      | "selling"
      | "scene"
      | "comparison"
      | "detail"
      | "spec"
      | "conversion"
      | "other";
    titleSummary: string;
    businessTask: string;
    keySellingPoint: string;
    layoutPattern: string;
    textDensity: "low" | "medium" | "high";
    evidenceStyle: string;
    notes: string;
  }>;

  globalPatterns: {
    commonPageRoles: string[];
    commonSellingPointOrder: string[];
    commonLayoutPatterns: string[];
    commonTextStrategies: string[];
    commonConversionSignals: string[];
  };

  borrowablePrinciples: string[];
  avoidCopying: string[];
  opportunitiesForOurProduct: string[];

  planningHints: {
    recommendedPageSequence: string[];
    recommendedStoryOrder: string[];
    recommendedVisualPrinciples: string[];
    recommendedTextPrinciples: string[];
  };
};
```

## 后续规划如何消费这些结果

竞品分析结果不应直接驱动“照着生成哪一张图”，而应先转成规划约束，再影响我方详情页的整套图序和单图任务。

建议按下面方式消费。

### 1. 影响整套图序

例如：

- 竞品普遍采用“主图 -> 卖点 -> 场景 -> 参数 -> 收口”顺序
- 系统可优先把这种顺序作为我方规划候选

### 2. 影响每张图的商业任务拆分

例如：

- 竞品会单独拿一张图说明差异化优势
- 系统就优先在我方方案里保留一张差异图

### 3. 影响文案层级策略

例如：

- 竞品主标题短，副标题负责解释，卖点标签负责快读
- 系统可把这种分层方式注入 copyPlan 生成

### 4. 影响版式与 prompt 方向

例如：

- 某类产品的成熟详情页更适合“主体稳住 + 说明区规整”的模块型画面
- 系统可把它转成 layout intent 与 prompt 约束

## 与现有商品分析的分工

商品分析和竞品分析应严格分工，避免角色混乱。

### 商品分析负责

- 我卖的是什么
- 商品本身有哪些可讲卖点
- 哪些参考图可以锁定主体一致性
- 当前商品更适合哪些图型

### 竞品分析负责

- 行业内通常怎么安排图序
- 哪种讲述顺序更成熟
- 哪类图常承担什么商业任务
- 哪些版式策略更适合该品类

## 建议给规划器的合并输入

```ts
type EcommercePlanningContext = {
  productContext: {
    brief: string;
    productImages: string[];
    productAnalysisSummary: string;
  };
  competitorContext?: {
    overview: string;
    recommendedPageSequence: string[];
    recommendedStoryOrder: string[];
    recommendedVisualPrinciples: string[];
    recommendedTextPrinciples: string[];
    avoidCopying: string[];
  };
};
```

## 与“整套详情页瘦身流程”的关系

引入竞品分析入口后，不应把流程做得更重，而应遵循“后台增强，前台简化”的原则。

用户前台看到的仍应尽量简洁：

1. 上传商品图
2. 可选上传竞品详情页
3. 系统生成整套图
4. 用户检查和改单张

竞品分析、策略提炼、图序推断、规划约束等能力可以放在后台自动完成，不应变成用户必须逐轮确认的显性流程负担。

## 实现优先级建议

建议按以下顺序推进：

### P1. 竞品输入和分析结果结构打通

先支持：

- 上传竞品详情页整套图
- 输出结构化 `CompetitorDeckAnalysis`

### P2. 规划器接入竞品策略摘要

让竞品分析结果真正影响：

- 图序规划
- 卖点顺序
- copyPlan 层级
- layout intent 倾向

### P3. 结果可视化

给用户一个简洁的竞品分析摘要视图，例如：

- 推荐图序
- 借鉴点
- 不建议照搬点
- 对我方最适合的讲述顺序

## 结论

这个入口值得做，但必须坚持一个边界：

- 它的目标不是帮助用户复刻竞品页面
- 它的目标是帮助系统理解成熟详情页的讲述逻辑和转化结构

一句话总结：

竞品详情页是“策略参考源”，不是“视觉复刻模板”。
