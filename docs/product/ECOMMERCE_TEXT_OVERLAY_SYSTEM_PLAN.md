# 电商工作流图片文字覆盖系统完整版方案

## 0. 文档定位

这是一份完整总方案，整合了：

1. 完整产品方案版
2. 技术架构版
3. 开发排期版

后续如果只看一个文件，直接看本文件即可。

独立文档先保留，作为拆分备份：

1. `docs/product/ECOMMERCE_TEXT_OVERLAY_PRODUCT_PRD.md`
2. `docs/architecture/ECOMMERCE_TEXT_OVERLAY_ARCHITECTURE.md`
3. `docs/product/ECOMMERCE_TEXT_OVERLAY_DELIVERY_SCHEDULE.md`

---

# 第一部分：产品方案版

## 1. 产品定位

该能力是电商一键工作流步骤七的增强系统，目标不是继续让 AI 在图里直接“生文字”，而是把最终文字从生图链路中拆出来，建立一套可控、可编辑、可复用、可导出的成片能力。

最终定位：

1. AI 负责生成无字底图
2. 系统负责真实字体排版与合成
3. 用户负责微调与最终确认

它本质上不是一个单独的小功能，而是步骤七从“看图”升级到“成片工作台”的基础设施。

---

## 2. 问题定义

当前痛点主要有 5 类：

1. AI 生图中的中文极不稳定，容易乱码、错字、字形变形。
2. 只要用户不满意文案，就必须重新生图，返工成本很高。
3. 同一组图片难以保持统一字体、统一层级、统一品牌调性。
4. 一张底图经常需要测试多个标题版本，当前流程效率太低。
5. 步骤七生成的是静态图结果，不是可持续编辑的设计结果。

这不是简单优化提示词就能彻底解决的问题，而是生成模型本身不适合承担“最终文字落版”这个职责。

---

## 3. 产品目标

### 3.1 核心目标

1. 彻底绕开 AI 中文生字乱码问题。
2. 让文案修改不再依赖重新生图。
3. 让步骤七结果图支持真实字体覆盖与导出。
4. 沉淀项目级字体资产、模板资产、版式资产。
5. 逐步演进成可批量成片的电商生产系统。

### 3.2 非目标

第一阶段不追求：

1. 完整替代专业设计软件
2. 一开始就做全自动排版
3. 一开始就做复杂多人协同
4. 一开始就支持所有平台所有模板

---

## 4. 用户与场景

### 4.1 目标用户

1. 电商运营
2. 内容运营
3. 小红书种草图制作人员
4. 商品宣传图需求高频的小商家
5. 需要统一品牌视觉的小团队

### 4.2 重点场景

1. 小红书封面图上字
2. 淘宝/天猫主图卖点强化
3. 详情页首屏标题覆盖
4. 活动促销图快速改文案
5. 同一底图测试多个标题版本
6. 面向不同平台导出不同比例和版式版本

---

## 5. 用户价值

### 5.1 直接价值

1. 避免乱码和错误文案进入正式成图。
2. 文案改动成本从“重生图”变成“改图层”。
3. 可以稳定使用品牌指定字体。
4. 一套底图可快速产出多版文案图。
5. 导出结果与编辑预览保持一致。

### 5.2 长期价值

1. 沉淀品牌资产库。
2. 沉淀模板和版式规范。
3. 沉淀多平台图文生产能力。
4. 降低日常出图返工成本。

---

## 6. 核心产品原则

1. 生图模型不负责最终文字渲染。
2. 最终导出的文字必须由系统真实绘制。
3. 文案、底图、版式三者解耦。
4. 用户必须拥有最终决定权。
5. AI 只做建议，不直接决定最终成片。
6. 所有编辑结果必须可以持久化恢复。

---

## 7. 核心功能范围

### 7.1 字体资产管理

1. 上传字体文件
2. 校验字体格式
3. 项目内复用字体
4. 字体预览
5. 默认字体与品牌字体区分管理

### 7.2 文字图层编辑

1. 新增标题、副标题、角标、卖点、CTA
2. 修改文字内容
3. 调整字体、字号、颜色、字重
4. 调整描边、阴影、底板
5. 拖动位置与控制层级
6. 自动换行与最大行数控制

### 7.3 结果卡接入

1. 步骤七每张结果图支持“上字”
2. 支持“智能排版”与“重新排版”
3. 支持“导出成片”
4. 支持编辑后回写到结果卡

### 7.4 模板与智能建议

1. 模板推荐
2. 平台安全区约束
3. 留白区域建议
4. 主体避让建议
5. 对比度与可读性建议

### 7.5 导出与持久化

1. 导出 PNG 成片
2. 持久化文字图层
3. 刷新后恢复编辑状态
4. 保留已导出的最终成片地址

---

## 8. 用户流程

### 8.1 基础流程

1. 用户在步骤七生成无字底图。
2. 用户在某张结果卡点击“上字”。
3. 系统打开文字编辑器。
4. 用户输入文案并选择字体样式。
5. 用户拖动并调整版式。
6. 用户预览并导出成片。
7. 导出结果回写到步骤七结果卡。

### 8.2 高效流程

1. 选择模板
2. 自动填充标题与卖点
3. 微调位置和样式
4. 一键导出

### 8.3 后续增强流程

1. 同一张图保存多个版本
2. 一组文案套多张图
3. 一张图导出多个平台尺寸

---

## 9. 页面与交互建议

### 9.1 步骤七结果卡

增加操作：

1. 上字
2. 智能排版
3. 重新排版
4. 导出成片

### 9.2 文字编辑器

建议包含：

1. 底图预览区
2. 文字图层列表
3. 样式控制面板
4. 字体管理入口
5. 模板快捷区
6. 导出按钮

### 9.3 字体上传器

建议支持：

1. 拖拽上传
2. 文件选择
3. 字体名称预览
4. 使用示例预览

---

## 10. 数据对象建议

```ts
export interface FontAsset {
  id: string;
  name: string;
  family: string;
  fileName: string;
  mimeType: string;
  sourceType: 'upload' | 'builtin';
  dataUrl?: string;
  blobUrl?: string;
  weightRange?: string;
  style?: 'normal' | 'italic';
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TextOverlay {
  id: string;
  kind: 'headline' | 'subheadline' | 'badge' | 'bullet' | 'price' | 'cta' | 'custom';
  text: string;
  fontFamily?: string;
  fontAssetId?: string;
  fontSize: number;
  fontWeight?: number | string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  backgroundFill?: string;
  padding?: number;
  borderRadius?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  maxLines?: number;
  overflowStrategy?: 'wrap' | 'shrink' | 'ellipsis';
}

export interface TextComposition {
  resultId: string;
  baseImageUrl: string;
  overlays: TextOverlay[];
  templateId?: string;
  version: number;
  updatedAt: number;
}
```

---

## 11. 产品分阶段规划

### 11.1 Phase A：MVP

1. 字体上传
2. 字体注册
3. 手动上字
4. 单图导出
5. 刷新恢复

### 11.2 Phase B：效率版

1. 自动换行
2. 模板化
3. 多图层编辑
4. 快捷样式

### 11.3 Phase C：智能版

1. 留白识别
2. 主体避让
3. 位置推荐
4. 可读性建议

### 11.4 Phase D：生产版

1. 批量套版
2. 多平台模板
3. 多版本导出
4. 品牌资产沉淀

---

## 12. 产品验收标准

### 12.1 MVP 验收

1. 用户可以上传字体。
2. 用户可以在步骤七对单张图进行文字覆盖。
3. 导出的图片文字清晰且与预览一致。
4. 修改文案不需要重新生图。
5. 刷新项目仍可恢复图层。

### 12.2 业务验收

1. 出图返工率下降。
2. 标题改稿效率明显提升。
3. 品牌字体使用比例上升。
4. 电商封面图风格一致性更高。

---

## 13. 产品侧风险提示

1. 字体加载时序会影响导出稳定性。
2. 跨域图源可能导致 canvas 导出失败。
3. 自动排版如果控制不好会抢走用户控制权。
4. 状态量增加后，结果卡与编辑器之间的数据一致性要重点盯。

---

# 第二部分：技术架构版

## 14. 架构目标

该系统的技术目标是把“底图生成”和“最终文字渲染”拆成两条职责清晰的链路：

1. 生图链路负责生成无字底图
2. 编辑链路负责管理字体、文字图层、模板、建议布局
3. 渲染链路负责真实绘制文字并导出最终成片
4. 持久化链路负责保存所有可编辑状态

核心目标是可控、可恢复、可扩展，而不是一开始追求全自动。

---

## 15. 总体架构

系统建议拆成 6 层：

1. 字体资产层 `Font Asset Layer`
2. 文字构成层 `Text Composition Layer`
3. 智能版式层 `Layout Intelligence Layer`
4. 工作流接入层 `Workflow Integration Layer`
5. 渲染导出层 `Render & Export Layer`
6. 持久化层 `Persistence Layer`

数据流方向：

1. 步骤七生成结果图
2. 用户选择结果图进入文字编辑
3. 系统加载字体与历史文字图层
4. 用户编辑文字构成
5. 系统渲染预览
6. 用户导出成片
7. 成片与构成数据回写项目状态

---

## 16. 模块拆分

### 16.1 字体资产层

职责：

1. 管理字体上传
2. 校验字体格式
3. 生成字体资产记录
4. 注册字体到浏览器运行时
5. 提供加载状态与复用能力

建议文件：

1. `services/font-assets.ts`
2. `utils/font-loader.ts`
3. `stores/fontAssets.store.ts`

---

### 16.2 文字构成层

职责：

1. 用结构化数据描述一张图片上的全部文字图层
2. 作为 UI 编辑、预览渲染、最终导出的唯一数据源
3. 支持版本化和持久化

建议文件：

1. `types/text-composition.ts`
2. `utils/text-layout.ts`

架构原则：

1. 所有预览与导出共用同一份 `TextComposition`
2. 不允许 UI 自己维护另一套平行排版状态
3. 单图可存在多个版本，但当前激活版本只能有一个

---

### 16.3 智能版式层

职责：

1. 分析图像可上字区域
2. 给出文字位置与样式建议
3. 对接模板与规则系统
4. 提供可解释的建议结果

建议文件：

1. `services/text-layout-intelligence.ts`
2. `utils/image-safe-area.ts`
3. `utils/text-contrast.ts`
4. `utils/text-hierarchy.ts`

建议输出：

```ts
export interface SuggestedComposition {
  overlays: TextOverlay[];
  confidence?: number;
  reasons?: string[];
  warnings?: string[];
}
```

边界约束：

1. AI 只能出建议稿，不能直接覆盖用户最终稿
2. 所有建议必须经过规则层约束
3. 生成建议后仍需用户确认

---

### 16.4 工作流接入层

职责：

1. 将编辑能力接到步骤七结果卡
2. 维护步骤七结果与文字编辑状态关联
3. 控制弹层或侧边编辑器生命周期

建议文件：

1. `pages/Workspace/components/workflow/EcommerceTextOverlayEditor.tsx`
2. `pages/Workspace/components/workflow/EcommerceFontUploader.tsx`
3. `pages/Workspace/controllers/useEcommerceTextComposition.ts`
4. `pages/Workspace/components/workflow/EcommerceOneClickCards.tsx`

建议扩展字段：

```ts
export interface EcommerceGeneratedResult {
  textComposition?: TextComposition;
  exportedComposedImageUrl?: string;
  textLayoutStatus?: 'idle' | 'draft' | 'exported';
  textTemplateId?: string;
}
```

交互架构：

1. 结果卡只做入口和状态展示
2. 编辑器负责局部编辑会话
3. controller 负责桥接 store、渲染服务、导出服务

---

### 16.5 渲染导出层

职责：

1. 将底图与文字图层绘制成最终图片
2. 输出 PNG、DataURL、Blob
3. 处理高 DPI、字体加载、阴影、描边等绘制细节

建议文件：

1. `services/composition-renderer.ts`
2. `services/composition-export.ts`

建议流程：

1. 校验底图可加载
2. 校验所需字体可用
3. 等待字体加载完成
4. 初始化 canvas
5. 绘制底图
6. 顺序绘制文字图层
7. 输出 Blob 或 DataURL
8. 写回结果状态

可复用基础：

1. [types/common.ts](E:/ai网站/Jacky-studio-dev/types/common.ts)
2. [services/skills/export.skill.ts](E:/ai网站/Jacky-studio-dev/services/skills/export.skill.ts)

---

### 16.6 持久化层

职责：

1. 保存字体资产
2. 保存文字构成
3. 保存模板选择
4. 保存最终导出结果
5. 保存当前编辑状态

建议文件：

1. `stores/ecommerceText.store.ts`
2. 或扩展现有电商工作流 store

建议策略：

1. MVP 先做项目级本地持久化
2. 通过 `projectId + resultId` 建立稳定索引
3. 后续再扩展品牌级与云同步

---

## 17. 数据流设计

### 17.1 编辑数据流

1. 用户点击步骤七结果卡“上字”
2. 读取 `resultId` 对应的 `TextComposition`
3. 若不存在则初始化默认构成
4. 编辑器对 `TextComposition` 进行修改
5. 预览层订阅同一份状态进行实时渲染
6. 保存时回写 store 与项目状态

### 17.2 导出数据流

1. 用户点击导出
2. 导出服务读取 `TextComposition`
3. 字体服务确保所需字体全部加载
4. 渲染服务输出成片图
5. 结果图地址写回 `exportedComposedImageUrl`
6. 状态更新为 `exported`

### 17.3 模板/建议数据流

1. 用户点击智能排版
2. 图像分析层分析留白与主体区域
3. 规则层限定安全区
4. AI/规则层生成建议 `SuggestedComposition`
5. 编辑器载入建议稿
6. 用户确认或调整后保存

---

## 18. 状态边界设计

建议将状态分为三类：

### 18.1 持久状态

1. 字体资产
2. 文字构成
3. 模板选择
4. 已导出的成片地址

### 18.2 会话状态

1. 当前正在编辑的结果图 id
2. 当前选中的图层 id
3. 当前面板展开状态
4. 草稿修改标记

### 18.3 临时渲染状态

1. 字体加载中
2. 导出中
3. 智能排版生成中
4. 图片资源加载中

原则：

1. 持久状态和 UI 临时状态必须分开
2. 结果卡显示状态不可直接依赖临时编辑态
3. 导出态与编辑态要允许并存，但要有版本标记

---

## 19. 关键技术风险与防护

### 19.1 字体加载时序

风险：字体没加载完就渲染，导致字体回退。

防护：

1. 统一字体加载入口
2. 导出前等待 `document.fonts.ready`
3. 必要时显式调用 `document.fonts.load`

### 19.2 跨域图像污染 canvas

风险：底图跨域导致导出失败。

防护：

1. 优先使用 data URL
2. 优先使用可信代理图源
3. 导出前进行图源可绘制校验

### 19.3 文本测量误差

风险：文字换行和预览不一致。

防护：

1. 使用 `measureText()`
2. 自建统一换行逻辑
3. 单独处理中英混排与字距

### 19.4 数据膨胀

风险：图片、字体、模板、图层都要存，状态会变重。

防护：

1. 字体资源单独缓存
2. 文字构成只存结构化数据，不重复存图片二进制
3. 导出图与底图分开管理

### 19.5 规则与 AI 冲突

风险：AI 建议好看但超出平台安全区或压住主体。

防护：

1. 规则层优先级高于 AI
2. AI 输出必须过规则修正
3. 给出 warning，而不是直接硬套

---

## 20. 推荐实施顺序

1. 定义 `FontAsset`、`TextOverlay`、`TextComposition`
2. 完成字体上传与字体注册服务
3. 完成基础文字编辑器
4. 完成 canvas 渲染与导出
5. 接入步骤七结果卡
6. 接入持久化恢复
7. 再做模板与智能建议

---

## 21. 推荐目录与文件

1. `services/font-assets.ts`
2. `services/composition-renderer.ts`
3. `services/composition-export.ts`
4. `services/text-layout-intelligence.ts`
5. `utils/font-loader.ts`
6. `utils/text-layout.ts`
7. `utils/image-safe-area.ts`
8. `utils/text-contrast.ts`
9. `utils/text-hierarchy.ts`
10. `types/text-composition.ts`
11. `pages/Workspace/components/workflow/EcommerceTextOverlayEditor.tsx`
12. `pages/Workspace/components/workflow/EcommerceFontUploader.tsx`
13. `pages/Workspace/controllers/useEcommerceTextComposition.ts`
14. `stores/ecommerceText.store.ts`

---

# 第三部分：开发排期版

## 22. 排期目标

本排期以“先解决乱码与返工，再逐步做效率和智能化”为原则，优先保证第一阶段能快速上线并真实改善步骤七体验。

建议采用 4 个阶段推进。

---

## 23. 阶段总览

### Phase A：MVP 可上线版

目标：解决最核心的中文文字失控问题。

周期建议：5 到 7 个工作日

交付内容：

1. 字体上传
2. 字体注册
3. 步骤七单图上字入口
4. 单图文字编辑
5. 单图导出成片
6. 状态持久化恢复

### Phase B：效率增强版

目标：降低重复劳动，提高单人出图效率。

周期建议：4 到 6 个工作日

交付内容：

1. 自动换行
2. 字号自适应
3. 多图层编辑
4. 简单模板
5. 常用样式快捷应用

### Phase C：半智能排版版

目标：让系统能辅助排版，但不抢用户控制权。

周期建议：5 到 8 个工作日

交付内容：

1. 留白区域检测
2. 主体避让
3. 文字位置建议
4. 对比度建议
5. 可读性告警

### Phase D：批量生产版

目标：形成品牌化、模板化、批量化成片能力。

周期建议：6 到 10 个工作日

交付内容：

1. 多平台模板
2. 批量套版
3. 一套文案多图复用
4. 多版本导出
5. 品牌资产沉淀能力

---

## 24. 详细排期

### 24.1 Phase A：MVP 可上线版

#### A1. 数据结构与状态定义

预计：0.5 到 1 天

任务：

1. 定义 `FontAsset`
2. 定义 `TextOverlay`
3. 定义 `TextComposition`
4. 扩展步骤七结果项字段
5. 设计 store 存储结构

产出文件：

1. `types/text-composition.ts`
2. `types/workflow.types.ts`
3. `stores/ecommerceText.store.ts` 或现有 store 扩展

#### A2. 字体上传与注册

预计：1 到 1.5 天

任务：

1. 字体文件上传
2. 字体格式校验
3. 字体预览
4. `FontFace` 注册
5. 字体缓存与重复加载保护

产出文件：

1. `services/font-assets.ts`
2. `utils/font-loader.ts`
3. `pages/Workspace/components/workflow/EcommerceFontUploader.tsx`

#### A3. 单图文字编辑器 MVP

预计：1.5 到 2 天

任务：

1. 结果卡增加“上字”入口
2. 打开编辑器
3. 支持新增标题、副标题、角标
4. 支持基础样式调整
5. 支持拖动位置
6. 支持实时预览

产出文件：

1. `pages/Workspace/components/workflow/EcommerceTextOverlayEditor.tsx`
2. `pages/Workspace/controllers/useEcommerceTextComposition.ts`
3. `pages/Workspace/components/workflow/EcommerceOneClickCards.tsx`

#### A4. 渲染与导出

预计：1 到 1.5 天

任务：

1. 底图加载
2. 字体等待
3. canvas 绘制文字
4. 导出 PNG、DataURL
5. 回写结果卡

产出文件：

1. `services/composition-renderer.ts`
2. `services/composition-export.ts`
3. `services/skills/export.skill.ts`

#### A5. 持久化与恢复

预计：0.5 到 1 天

任务：

1. 保存文字图层
2. 保存字体资产引用
3. 保存导出结果
4. 刷新后恢复

产出文件：

1. `stores/ecommerceText.store.ts`
2. 电商工作流 store / controller 扩展

#### A6. 联调与验收

预计：0.5 到 1 天

任务：

1. 检查步骤七入口可用性
2. 检查中文字体导出正确性
3. 检查预览与导出一致性
4. 检查刷新恢复
5. 检查异常图源的失败处理

---

### 24.2 Phase B：效率增强版

#### B1. 自动换行与文字约束

预计：1 到 1.5 天

任务：

1. `measureText()` 换行
2. 最大行数
3. 超长文案缩放或省略策略

#### B2. 多图层编辑能力

预计：1 到 1.5 天

任务：

1. 图层列表
2. 图层排序
3. 图层显隐
4. 选中态与快捷编辑

#### B3. 模板系统基础版

预计：1 到 1.5 天

任务：

1. 基础模板结构
2. 常见平台模板
3. 一键套用模板

#### B4. 快捷样式区

预计：0.5 到 1 天

任务：

1. 常用标题样式
2. 常用角标样式
3. 常用卖点样式

#### B5. 验收

预计：0.5 天

---

### 24.3 Phase C：半智能排版版

#### C1. 图像留白分析

预计：1.5 到 2 天

任务：

1. 检测相对空白区
2. 输出推荐上字区

#### C2. 主体避让

预计：1 到 1.5 天

任务：

1. 估算主体区域
2. 避免文字压住商品主体

#### C3. 规则层接入

预计：1 天

任务：

1. 平台安全区
2. 最大宽度、最小字号
3. 位置合法性校验

#### C4. 智能建议生成

预计：1 到 1.5 天

任务：

1. 标题拆分建议
2. 位置建议
3. 对比度建议
4. 告警提示

#### C5. 验收

预计：0.5 到 1 天

---

### 24.4 Phase D：批量生产版

#### D1. 多平台模板

预计：1.5 到 2 天

#### D2. 一套文案多图复用

预计：1 到 1.5 天

#### D3. 批量导出

预计：1.5 到 2 天

#### D4. 品牌资产沉淀

预计：1 到 1.5 天

#### D5. 最终联调

预计：1 到 2 天

---

## 25. 依赖关系

### 25.1 必须先完成

1. `TextComposition` 数据结构
2. 字体注册服务
3. 步骤七结果卡的稳定结果 id
4. 本地项目状态持久化能力

### 25.2 可并行推进

1. 字体上传器与编辑器 UI 可并行
2. 渲染服务与 store 设计可并行
3. 模板数据结构与基础模板内容可并行

### 25.3 后置依赖

1. 智能排版依赖基础编辑器完成
2. 批量套版依赖模板系统稳定
3. 品牌级资产依赖项目级能力先跑通

---

## 26. 风险缓冲建议

1. Phase A 至少预留 1 天缓冲给字体与 canvas 兼容性。
2. 如果步骤七当前状态结构还不稳定，先固定 `resultId` 再接入编辑器。
3. 智能排版不要插队做，先把基础编辑链路打实。
4. 导出图源跨域问题要尽早验证，否则后面会卡上线。

---

## 27. 建议里程碑

### 27.1 里程碑 1

时间：Phase A 完成时

标志：

1. 单图可上字
2. 可导出
3. 可恢复

### 27.2 里程碑 2

时间：Phase B 完成时

标志：

1. 模板初步可用
2. 多图层编辑可用
3. 出图效率明显提升

### 27.3 里程碑 3

时间：Phase C 完成时

标志：

1. 系统可给出合理排版建议
2. 不再完全依赖人工摆位

### 27.4 里程碑 4

时间：Phase D 完成时

标志：

1. 支持批量化成片
2. 支持品牌与平台模板沉淀

---

## 28. 验收口径

### 28.1 技术验收

1. 中文字体渲染稳定
2. 预览导出一致
3. 刷新恢复正确
4. 不影响原有步骤七生图流程

### 28.2 产品验收

1. 文字问题不再依赖重生图解决
2. 单张图从改文案到导出显著更快
3. 版式统一性比纯 AI 生字更稳定

---

## 29. 当前推荐动作

建议执行顺序：

1. 先做 Phase A，真实解决乱码和返工问题
2. Phase A 稳定后做模板和效率增强
3. 最后再做智能推荐和批量生产

如果马上进入开发，第一批应先开这些文件：

1. `types/text-composition.ts`
2. `services/font-assets.ts`
3. `utils/font-loader.ts`
4. `pages/Workspace/components/workflow/EcommerceFontUploader.tsx`
5. `pages/Workspace/components/workflow/EcommerceTextOverlayEditor.tsx`
6. `pages/Workspace/controllers/useEcommerceTextComposition.ts`
7. `services/composition-renderer.ts`
8. `services/composition-export.ts`
9. `stores/ecommerceText.store.ts`

---

## 30. 需求优先级矩阵

为了避免开发过程中功能不断膨胀，建议按 `P0 / P1 / P2` 管理优先级。

### 30.1 P0：必须首批上线

这些能力直接决定这套方案能不能真正解决当前痛点：

1. 步骤七结果图支持“上字”入口
2. 字体上传与注册
3. 单图文字编辑
4. 标题、副标题、角标基础图层
5. 拖动位置与基础样式调整
6. 真实字体导出成片
7. 编辑状态持久化恢复
8. 修改文案不需要重新生图

### 30.2 P1：明显提升效率

这些能力不是 MVP 阻塞项，但会明显影响日常使用效率：

1. 自动换行
2. 字号自适应
3. 多图层管理
4. 模板套用
5. 常用样式快捷应用
6. 同一张图保存多个文案版本
7. 导出后在结果卡中展示成片状态

### 30.3 P2：智能化与规模化增强

这些能力适合在基础链路跑稳后再做：

1. 留白检测
2. 主体避让
3. 智能推荐文字区域
4. 可读性警告
5. 一套文案多图复用
6. 批量套版
7. 多平台自动适配模板
8. 品牌级字体与模板资产库

### 30.4 不建议提前插队的事项

以下事情看起来高级，但不应抢在 P0 前面：

1. 全自动智能排版
2. 批量导出全部平台
3. 复杂动画文字
4. 云端品牌资产同步
5. 完整设计器能力扩展

---

## 31. 页面原型说明

这一部分不是视觉稿，而是给产品、设计、开发对齐页面结构和信息层级用的。

### 31.1 步骤七结果卡改造

建议每张结果卡拆成 4 个信息层：

1. 结果图片区
2. 基础信息区
3. 状态与结果区
4. 操作区

建议结构：

1. 顶部：图片预览
2. 中部：标题、所属方案、比例、模型信息
3. 次级信息：是否已上字、是否已导出、最后编辑时间
4. 底部操作：上字、智能排版、导出成片、查看原图

目标是让用户一眼知道：

1. 这张图是什么
2. 有没有做过文字处理
3. 当前看的到底是底图还是成片
4. 下一步应该点哪里

### 31.2 文字编辑器原型

建议采用“三栏式”或“主画布 + 侧栏”结构。

推荐结构：

1. 左侧：图层列表
2. 中间：底图画布预览区
3. 右侧：样式面板与字体面板

图层列表建议展示：

1. 图层名称
2. 图层类型
3. 显隐状态
4. 当前选中态

画布区建议支持：

1. 拖动
2. 选中框
3. 对齐辅助
4. 安全区提示

右侧面板建议支持：

1. 文案编辑
2. 字体选择
3. 字号
4. 字重
5. 颜色
6. 描边
7. 阴影
8. 底板
9. 行高
10. 字距

### 31.3 字体上传器原型

建议以轻量浮层或内嵌卡片形式出现，不要做成太重的独立流程。

推荐内容：

1. 上传按钮
2. 支持拖拽区域
3. 已上传字体列表
4. 字体预览文案
5. 当前项目默认字体设置

### 31.4 智能排版入口原型

建议保持“建议而非接管”的原则。

入口方式：

1. 结果卡上的“智能排版”
2. 编辑器里的“生成建议稿”

展示方式：

1. 生成 1 到 3 个候选方案
2. 每个候选方案给出简短理由
3. 用户选择后再进入微调

---

## 32. 接口与状态变更影响范围

这一部分用于提醒后续开发时，哪些地方一定会被连带影响，避免只改一个点导致整条链路断掉。

### 32.1 类型层影响

预计会新增或修改：

1. `types/text-composition.ts`
2. `types/workflow.types.ts`
3. `types/common.ts`

影响内容：

1. 结果图对象需要扩展文字构成字段
2. 导出结果对象需要区分底图与成片
3. 图层数据需要标准化

### 32.2 Store 层影响

预计会新增或修改：

1. `stores/ecommerceText.store.ts`
2. 现有电商工作流 store
3. 项目持久化相关 store

影响内容：

1. 项目级字体资产缓存
2. 每张结果图的文字构成
3. 当前编辑中的临时会话状态
4. 导出结果回写

### 32.3 页面与控制器层影响

预计会新增或修改：

1. `pages/Workspace/components/workflow/EcommerceOneClickCards.tsx`
2. `pages/Workspace/components/workflow/EcommerceWorkflowResultReview.tsx`
3. `pages/Workspace/controllers/useEcommerceTextComposition.ts`
4. 可能涉及步骤七结果区域相关组件

影响内容：

1. 结果卡入口增加
2. 结果卡状态展示增加
3. 编辑器打开关闭逻辑
4. 成片与底图切换展示

### 32.4 服务层影响

预计会新增或修改：

1. `services/font-assets.ts`
2. `utils/font-loader.ts`
3. `services/composition-renderer.ts`
4. `services/composition-export.ts`
5. `services/text-layout-intelligence.ts`
6. `services/skills/export.skill.ts`

影响内容：

1. 字体注册和缓存
2. canvas 文字绘制
3. 导出流程
4. 智能建议流程

### 32.5 持久化与兼容性影响

必须注意以下兼容问题：

1. 老项目没有 `textComposition` 字段时要能正常打开
2. 老结果卡没有导出图字段时要默认回退到底图
3. 字体资产加载失败时要有 fallback 字体
4. 导出失败不能影响原步骤七结果展示

---

## 33. 上线验收 Checklist

这一部分用于真正上线前逐项过一遍，避免功能“看起来能用”，但实际链路有洞。

### 33.1 功能检查

1. 步骤七每张结果图都能正常打开“上字”
2. 未上字图片不会误显示为已成片
3. 用户可以新增标题、副标题、角标
4. 用户修改文案后无需重新生图
5. 用户可以导出最终成片
6. 导出后结果卡能正确展示成片状态

### 33.2 字体检查

1. 中文字体上传成功
2. 字体注册后可立即用于编辑器
3. 刷新后字体仍能恢复使用
4. 字体加载失败时有默认回退字体
5. 不同字体切换不会导致导出结果错乱

### 33.3 渲染与导出检查

1. 预览和导出视觉一致
2. 描边、阴影、底板效果正常
3. 高 DPI 导出清晰
4. 长文案换行结果稳定
5. 导出失败时有清晰错误提示

### 33.4 状态恢复检查

1. 刷新页面后可恢复文字图层
2. 切换项目后状态不串项目
3. 结果卡能正确区分底图和成片
4. 老项目数据不会因为新字段报错

### 33.5 性能与稳定性检查

1. 打开编辑器不会明显卡顿
2. 多次切换字体不会持续堆积内存
3. 多张结果图连续编辑不会状态串位
4. 导出大图时不会导致页面长时间无响应

### 33.6 用户体验检查

1. 用户能看懂当前编辑的是哪张图
2. 用户能看懂当前看到的是底图还是成片
3. 智能排版不会强行覆盖用户手动调整
4. 失败提示和空状态提示清晰可理解

### 33.7 最终上线口径

满足以下条件才建议正式上线：

1. P0 功能全部可用
2. 预览与导出一致性通过
3. 刷新恢复通过
4. 老项目兼容通过
5. 至少完成一轮真实步骤七链路冒烟验证

---

## 34. 详情页可排版底图规范

这一节用于约束后续步骤七的生成目标。

以后详情页场景下，AI 的任务不再是“直接生成最终成图”，而是生成“可承载信息组件的底图”。

也就是说，步骤七结果图应优先满足：

1. 主体准确
2. 氛围成立
3. 结构清晰
4. 留白可用
5. 后续可叠加文字、图标、数据卡、说明框

### 34.1 底图目标定义

详情页底图应被定义为：

1. 可排版底图
2. 可标注底图
3. 可扩展底图

不应被定义为：

1. 已经完成全部文案表达的最终海报
2. 已经写死全部说明信息的终稿图片
3. 依赖 AI 自己生成中文标题、图标和信息框的成品图

### 34.2 底图生成原则

1. 主体产品必须稳定、准确、可识别。
2. 画面不得把可用信息区全部占满。
3. 必须预留至少一个主标题区。
4. 对于详情页模块图，优先保证信息承载能力，而不是纯视觉大片感。
5. 画面中的“空白”不是浪费，而是后续组件布局资源。
6. 尽量避免让 AI 直接生成可见中文、数字表格、信息框、箭头、图标。

### 34.3 必须预留的通用区域

任何产品的详情页图，原则上都应尽量预留以下区域中的 1 到 3 类：

1. 主标题区
2. 副标题区
3. 参数数字区
4. 图标摘要区
5. 说明文本区
6. 标注解释区
7. 对比框区

### 34.4 通用留白布局类型

为了让后续系统可稳定上字，建议把底图预留方式抽象成以下几类：

1. `top-banner`
说明：
顶部留出横向信息带，适合主标题、副标题、核心数字。

2. `left-copy`
说明：
左侧留白，右侧主产品，适合标题、卖点、参数卡。

3. `right-copy`
说明：
右侧留白，左侧主产品，适合说明型详情页。

4. `bottom-panel`
说明：
底部留出模块区，适合图标、参数、对比说明、补充文案。

5. `center-focus-with-edge-space`
说明：
主体居中，四周保留可挂标注和小卡片的空间，适合结构说明图。

6. `split-info`
说明：
一侧主体、一侧完整信息区，适合参数和对比型详情页模块。

### 34.5 不同图型的底图要求

#### A. 主视觉型

目标：

1. 建立第一印象
2. 承担品牌感
3. 允许较少文字

要求：

1. 主体突出
2. 背景干净
3. 至少保留一个强标题区

#### B. 卖点展开型

目标：

1. 解释单一核心卖点
2. 承载标题 + 说明 + 局部标签

要求：

1. 留出 2 级信息空间
2. 避免主体与文案区冲突
3. 适合叠加 1 到 3 个辅助标签

#### C. 参数信息型

目标：

1. 承载数字、规格、单位
2. 更偏理性信息表达

要求：

1. 必须预留规整信息区域
2. 底图背景应尽量简洁
3. 主体位置不能干扰参数阅读

#### D. 结构说明型

目标：

1. 承载标注线、局部说明、放大框
2. 解释结构和原理

要求：

1. 主体轮廓清晰
2. 周边有可挂载标注的空间
3. 局部细节不能过度模糊

#### E. 对比说明型

目标：

1. 承载 before/after
2. 承载左右对比、上下对比

要求：

1. 画面结构清晰
2. 中间或边侧可放对比标签
3. 不适合过重背景噪声

### 34.6 步骤六/步骤七建议新增字段

为了让后续“上字 + 组件覆盖”不再靠猜，建议方案项逐步增加这些结构字段：

```ts
type EcommerceLayoutIntent = {
  layoutMode?:
    | 'top-banner'
    | 'left-copy'
    | 'right-copy'
    | 'bottom-panel'
    | 'center-focus-with-edge-space'
    | 'split-info';
  textDensity?: 'low' | 'medium' | 'high';
  safeAreas?: Array<{
    id: string;
    kind:
      | 'headline'
      | 'subheadline'
      | 'stats'
      | 'icons'
      | 'body'
      | 'comparison'
      | 'annotation';
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  infoSlots?: number;
  iconSlots?: number;
  statSlots?: number;
  decorationPreset?: 'clean' | 'premium' | 'tech' | 'promo';
};
```

这些字段的作用不是一次全做完，而是先把后续能力边界定义清楚。

### 34.7 Prompt 侧策略调整

后续详情页底图 prompt 应同时包含 3 类约束：

1. 画面内容约束
2. 留白布局约束
3. 禁止生成终稿信息元素约束

建议语义方向：

1. 明确主体位置
2. 明确可上字区域
3. 明确“不生成可见中文”
4. 明确“不生成复杂信息框和参数表”
5. 明确“为后续叠加图标、参数、说明卡预留空间”

---

## 35. 信息组件层规范

这一节是对“上字功能”的升级定义。

以后系统不应只支持文字覆盖，而应支持“详情页信息组件覆盖”。

### 35.1 组件层定位

信息组件层负责承载：

1. 文字
2. 图标
3. 数字卡片
4. 标签
5. 标注线
6. 底板
7. 轻特效

因此，后续系统更准确的定位应是：

1. 详情页后合成系统
2. 电商信息覆盖系统

而不是单纯“图片上字功能”。

### 35.2 组件分类

建议至少支持以下组件类型：

#### A. 文字组件

1. 主标题
2. 副标题
3. 段落说明
4. 参数数字
5. 标签文案

#### B. 图标组件

1. 卖点图标
2. 功能图标
3. 材质/特性图标
4. 服务保障图标

#### C. 容器组件

1. 信息框
2. 数据卡片
3. 标签底板
4. 对比块
5. 高亮底板

#### D. 标注组件

1. 直线标注
2. 箭头标注
3. 放大框
4. 局部圈选框

#### E. 装饰组件

1. 光晕
2. 渐变氛围
3. 科技线条
4. 粒子点缀
5. 高亮描边

### 35.3 组件层设计原则

1. 中文文字、数字说明、参数表述优先由系统生成，不交给 AI 生图硬画。
2. 图标、信息框、标注线应尽量走规则化组件，不依赖 AI 随机发挥。
3. 组件风格应可模板化，而不是每张图从零拼。
4. 组件层应与底图层解耦，允许后改文案、后改图标、后改参数。
5. 同一套组件样式应可批量复用到多张图。

### 35.4 通用组件组合模板

任何产品都可以抽象成以下几类常见组合：

1. `标题 + 副标题 + 3图标`
2. `标题 + 参数数字 + 补充说明`
3. `主产品 + 2到4个标注点`
4. `左右对比 + 中央标签`
5. `主图 + 底部参数条`
6. `结构图 + 放大框 + 解释文字`

### 35.5 组件层与底图层的职责边界

#### 由底图层负责

1. 产品主体
2. 场景
3. 光影
4. 材质质感
5. 构图基础

#### 由组件层负责

1. 标题
2. 卖点文本
3. 参数数字
4. 图标
5. 标签
6. 信息框
7. 标注线
8. 高亮与装饰特效

这条边界必须清晰，否则后续会出现：

1. AI 画了一版假的文字
2. 系统又叠一层真文字
3. 画面信息重复、冲突、难编辑

### 35.6 组件层数据结构方向

建议在未来 `TextComposition` 基础上进一步演进为更通用的 `OverlayComposition`：

```ts
type OverlayNode =
  | {
      id: string;
      type: 'text';
      role: 'headline' | 'subheadline' | 'body' | 'stat' | 'tag';
    }
  | {
      id: string;
      type: 'icon';
      role: 'feature' | 'service' | 'material' | 'warning';
    }
  | {
      id: string;
      type: 'container';
      role: 'panel' | 'card' | 'badge' | 'compare';
    }
  | {
      id: string;
      type: 'annotation';
      role: 'line' | 'arrow' | 'focus-ring' | 'zoom-box';
    }
  | {
      id: string;
      type: 'effect';
      role: 'glow' | 'gradient' | 'particle' | 'highlight';
    };
```

第一阶段不一定直接做完，但结构上应避免把所有东西都硬塞进纯文字图层模型。

### 35.7 通用详情页图型库建议

后续如果要让任意产品都能更像详情页，步骤五/六/七应强制覆盖这些图型中的大部分：

1. 首屏总述图
2. 核心卖点图
3. 参数信息图
4. 结构说明图
5. 细节证据图
6. 场景使用图
7. 对比说明图
8. 收口总结图

其中真正依赖组件层的，主要是：

1. 参数信息图
2. 结构说明图
3. 对比说明图
4. 收口总结图

### 35.8 对后续开发的直接影响

这意味着后续开发不应只规划：

1. 字体上传
2. 文本编辑
3. 导出成片

还应同步预留：

1. 图标资产入口
2. 信息框/底板组件
3. 标注线组件
4. 装饰特效组件
5. 模板化信息布局能力

### 35.9 实施优先级建议

建议按这个顺序落地：

1. 先做文字组件
2. 再做容器组件和底板
3. 再做图标组件
4. 再做标注组件
5. 最后做轻特效组件

原因：

1. 文字和底板先解决 70% 的详情页表达问题
2. 图标和标注解决 20% 的说明性问题
3. 轻特效解决最后 10% 的质感和品牌调性问题

---

## 36. 步骤五/六/七联动生成规范

这一节用于把前面的“详情页可排版底图”和“信息组件层”真正前置到工作流里。

否则就会出现一个常见问题：

1. 步骤五只规划“拍什么图”
2. 步骤六只写“生图 prompt”
3. 步骤七才发现没有地方上字、没地方放图标、也没地方放参数卡

所以后续必须把“可排版”和“可叠加组件”前移到步骤五、步骤六。

### 36.1 总体原则

步骤五负责回答：

1. 这组详情页需要哪些图型
2. 每种图型承担什么信息任务
3. 哪些图更偏视觉，哪些图更偏信息

步骤六负责回答：

1. 这张图应该采用什么留白结构
2. 应该预留哪些信息区域
3. 底图生成时要避免哪些终稿元素

步骤七负责回答：

1. 底图生成是否符合版式意图
2. 后续应该叠加哪些信息组件
3. 成片应该以什么模板方式输出

### 36.2 步骤五：图型规划规范

步骤五以后不应只输出“方案标题 + 描述 + prompt 方向”，还应输出“图型职责”。

建议每个方案项至少补齐以下语义：

1. `imageRole`
含义：
这张图在整套详情页里的角色是什么。

建议值：

1. `hero`
2. `selling-point`
3. `parameter`
4. `structure`
5. `detail`
6. `scene`
7. `comparison`
8. `summary`

2. `informationGoal`
含义：
这张图主要要让用户理解什么，而不是只描述画面。

例子：

1. 建立第一印象
2. 解释一个核心卖点
3. 展示结构原理
4. 证明做工细节
5. 呈现参数规格
6. 完成对比说服

3. `contentDensity`
含义：
后续信息叠加密度。

建议值：

1. `low`
2. `medium`
3. `high`

4. `componentNeed`
含义：
这张图后续是否依赖大量组件。

建议值：

1. `text-only`
2. `text-and-icons`
3. `text-and-stats`
4. `annotation-heavy`
5. `comparison-heavy`

### 36.3 步骤五：通用图型配比建议

为了让整套输出更像详情页，而不是一组独立海报，建议默认覆盖以下图型组合：

1. 1 张首屏总述图
2. 2 到 3 张核心卖点图
3. 1 张参数信息图
4. 1 张结构说明图
5. 1 张细节证据图
6. 1 张场景使用图
7. 1 张对比说明图
8. 1 张收口总结图

如果图量较少，优先保留：

1. 首屏总述图
2. 核心卖点图
3. 参数信息图
4. 结构说明图
5. 对比说明图

### 36.4 步骤六：Prompt 生成规范

步骤六以后不应只产出“画面描述”，还要产出“版式约束”。

建议每条 prompt 在语义上同时覆盖：

1. 主体内容
2. 场景/氛围
3. 构图位置
4. 留白区域
5. 禁止生成项
6. 后续组件预留说明

#### 必须包含的约束方向

1. 明确主体位置
2. 明确留白方向
3. 明确画面不要被元素塞满
4. 明确不生成可见中文
5. 明确不生成复杂参数表、图标组、说明框、箭头
6. 明确后续要叠加标题、数字、图标或标注

#### Prompt 语义模板建议

可以抽象为：

1. 产品主体怎么摆
2. 背景和氛围是什么
3. 哪个区域保留干净留白
4. 哪个区域未来会放标题/参数/图标/说明
5. 不要直接生成任何最终文案和 UI 元素

### 36.5 步骤六：建议新增结构字段

为了避免后续完全靠字符串 prompt 猜，建议步骤六逐步增加这些结构字段：

```ts
type EcommercePromptPlanMeta = {
  imageRole?:
    | 'hero'
    | 'selling-point'
    | 'parameter'
    | 'structure'
    | 'detail'
    | 'scene'
    | 'comparison'
    | 'summary';
  layoutMode?:
    | 'top-banner'
    | 'left-copy'
    | 'right-copy'
    | 'bottom-panel'
    | 'center-focus-with-edge-space'
    | 'split-info';
  contentDensity?: 'low' | 'medium' | 'high';
  componentNeed?:
    | 'text-only'
    | 'text-and-icons'
    | 'text-and-stats'
    | 'annotation-heavy'
    | 'comparison-heavy';
  reservedAreas?: Array<{
    kind:
      | 'headline'
      | 'subheadline'
      | 'stats'
      | 'icons'
      | 'body'
      | 'comparison'
      | 'annotation';
    priority: 'high' | 'medium' | 'low';
  }>;
  forbiddenElements?: string[];
};
```

这些字段哪怕一开始只在内部使用，也比完全依赖自由文本 prompt 稳得多。

### 36.6 步骤七：生成验收规范

步骤七以后生成成功不应只判断：

1. 有没有出图
2. 画面好不好看
3. 主体像不像

还应判断：

1. 是否保留了预期留白
2. 是否适合后续组件叠加
3. 是否误生成了中文、图标、参数框、说明块
4. 是否满足该图型应有的信息承载能力

### 36.7 步骤七：结果元数据建议

步骤七结果项建议逐步保留这些元信息：

1. `imageRole`
2. `layoutMode`
3. `contentDensity`
4. `componentNeed`
5. `reservedAreas`
6. `forbiddenElements`
7. `recommendedOverlayTemplate`

这样后续打开编辑器时，系统可以直接知道：

1. 该默认放几个文字层
2. 该不该放图标
3. 该不该放参数卡
4. 该不该优先打开标注组件

### 36.8 步骤七：失败判定建议

以下情况即使画面好看，也应视为“不适合详情页后合成”：

1. 主体把留白区全部占满
2. AI 直接生成了明显中文
3. AI 直接画出了假的参数表或信息框
4. 画面背景过于复杂，导致后续文字不可读
5. 图型本应是结构说明图，但没有可挂标注的空间
6. 图型本应是参数信息图，但没有规整的信息承载区域

### 36.9 联动后的理想流程

后续理想状态应该是：

1. 步骤五先定图型任务
2. 步骤六生成“可排版底图 prompt”
3. 步骤七生成“可叠加信息组件”的底图
4. 后合成系统叠加文字、图标、参数卡、标注线、装饰层
5. 用户微调后导出详情页成片

这条链路跑通之后，工作流产出的就不再只是“图”，而是：

1. 可编辑详情页底图资产
2. 可复用的信息版式资产
3. 可导出的最终成片资产

---

## 37. 字段级实施清单

这一节直接对照当前项目已有的数据结构与文件，目的是把“后面要加什么字段、先落到哪里”说清楚，减少实际开发时反复回看文档的成本。

### 37.1 当前现状基线

当前工程里，和电商一键工作流最相关的核心结构已经存在：

1. `EcommerceRecommendedType`
2. `EcommerceImageAnalysis`
3. `EcommercePlanItem`
4. `EcommercePlanGroup`
5. `EcommerceBatchJob`
6. `EcommerceResultItem`
7. `EcommerceOneClickSessionState`

因此后续不建议新造一套并行状态，而应优先在这些现有结构上增量扩展。

### 37.2 第一步必须扩展的类型

第一批建议直接扩展以下 4 个类型：

1. `EcommercePlanItem`
2. `EcommerceBatchJob`
3. `EcommerceResultItem`
4. `EcommerceOneClickSessionState`

原因：

1. `EcommercePlanItem` 最适合承载步骤五/六规划出的图型语义
2. `EcommerceBatchJob` 最适合承载步骤七执行中的 prompt 与版式快照
3. `EcommerceResultItem` 最适合承载最终生成底图的布局元数据与后合成状态
4. `EcommerceOneClickSessionState` 最适合承载项目级模板、字体、组件编辑会话

### 37.3 `EcommercePlanItem` 建议新增字段

职责：

1. 承载步骤五图型规划结果
2. 承载步骤六生成 prompt 前的版式意图

建议新增：

```ts
type EcommercePlanItemLayoutIntent = {
  imageRole?:
    | 'hero'
    | 'selling-point'
    | 'parameter'
    | 'structure'
    | 'detail'
    | 'scene'
    | 'comparison'
    | 'summary';
  informationGoal?: string;
  layoutMode?:
    | 'top-banner'
    | 'left-copy'
    | 'right-copy'
    | 'bottom-panel'
    | 'center-focus-with-edge-space'
    | 'split-info';
  contentDensity?: 'low' | 'medium' | 'high';
  componentNeed?:
    | 'text-only'
    | 'text-and-icons'
    | 'text-and-stats'
    | 'annotation-heavy'
    | 'comparison-heavy';
  reservedAreas?: Array<{
    id: string;
    kind:
      | 'headline'
      | 'subheadline'
      | 'stats'
      | 'icons'
      | 'body'
      | 'comparison'
      | 'annotation';
    priority: 'high' | 'medium' | 'low';
  }>;
  forbiddenElements?: string[];
  recommendedOverlayTemplate?: string;
};
```

落位建议：

1. 作为 `EcommercePlanItem` 的可选字段，命名为 `layoutIntent`

作用：

1. 步骤五输出时就确定图型职责
2. 步骤六生成 prompt 时直接复用
3. 步骤七验收时可以反查预期

### 37.4 `EcommerceBatchJob` 建议新增字段

职责：

1. 承载步骤七执行中的运行态
2. 固化“本次生图究竟是按什么版式目标生成的”

建议新增：

```ts
type EcommerceBatchJobLayoutSnapshot = {
  imageRole?: string;
  layoutMode?: string;
  contentDensity?: 'low' | 'medium' | 'high';
  componentNeed?: string;
  reservedAreas?: Array<{
    id: string;
    kind: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  forbiddenElements?: string[];
};
```

落位建议：

1. 作为 `EcommerceBatchJob` 的可选字段，命名为 `layoutSnapshot`

作用：

1. 即使后续 `EcommercePlanItem` 被用户修改，批任务仍保留本次生成依据
2. 方便步骤七结果回看“为什么这张图应该放参数卡而不是大标题”

### 37.5 `EcommerceResultItem` 建议新增字段

职责：

1. 承载生成完成后的底图元信息
2. 承载后合成状态

建议新增：

```ts
type EcommerceResultLayoutMeta = {
  imageRole?: string;
  layoutMode?: string;
  contentDensity?: 'low' | 'medium' | 'high';
  componentNeed?: string;
  reservedAreas?: Array<{
    id: string;
    kind: string;
    priority: 'high' | 'medium' | 'low';
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }>;
  forbiddenElements?: string[];
  recommendedOverlayTemplate?: string;
  layoutQualified?: boolean;
  layoutWarnings?: string[];
};
```

以及后合成相关字段：

```ts
type EcommerceResultOverlayState = {
  overlayStatus?: 'idle' | 'draft' | 'exported';
  textCompositionId?: string;
  overlayTemplateId?: string;
  composedImageUrl?: string;
};
```

落位建议：

1. `layoutMeta`
2. `overlayState`

作用：

1. 结果卡直接知道这张图适合上什么组件
2. 后合成系统可以无缝恢复编辑状态
3. 成片和底图可以并存而不是互相覆盖

### 37.6 `EcommerceOneClickSessionState` 建议新增字段

职责：

1. 承载项目级资源与会话态
2. 支撑未来字体、图标、模板、组件编辑器

建议第一批只加必要字段：

```ts
type EcommerceOneClickSessionOverlayState = {
  preferredOverlayTemplateId?: string | null;
  editingResultUrl?: string | null;
  overlayPanelOpen?: boolean;
};
```

建议第二批再加资源型字段：

```ts
type EcommerceOneClickSessionAssetsState = {
  fontAssetIds?: string[];
  iconAssetIds?: string[];
  overlayTemplateIds?: string[];
};
```

作用：

1. 第一批先跑通单图后合成入口
2. 第二批再接字体、图标、模板资产

### 37.7 `EcommerceGenerationMeta` 建议新增字段

当前已有：

1. 模型
2. prompt hash
3. aspect ratio
4. prompt summary

建议再补：

```ts
type EcommerceGenerationMetaExtension = {
  imageRole?: string;
  layoutMode?: string;
  componentNeed?: string;
  reservedAreaCount?: number;
  avoidTextArtifacts?: boolean;
};
```

作用：

1. 让生成链路日志和结果链路日志能统一回溯
2. 方便后面分析“哪些底图更适合上字/上组件”

### 37.8 文件级落位清单

第一批应修改的文件：

1. `types/workflow.types.ts`
责任：
补齐 `EcommercePlanItem`、`EcommerceBatchJob`、`EcommerceResultItem`、`EcommerceGenerationMeta` 的新增字段

2. `stores/ecommerceOneClick.store.ts`
责任：
补齐 `EcommerceOneClickSessionState` 的新字段，并保证默认值和 hydrate 兼容

3. `services/skills/ecom-oneclick-workflow.skill.ts`
责任：
让步骤五/六产出 `layoutIntent`，至少先产出 `imageRole`、`layoutMode`、`componentNeed`

4. `pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts`
责任：
在 `plan -> batch job -> result` 这条链路里把相关字段一路透传

5. `pages/Workspace/components/workflow/EcommerceOneClickCards.tsx`
责任：
在步骤七卡片上展示这些元信息，并为后续“上字/上组件”按钮提供入口依据

第二批应新增的文件：

1. `types/text-composition.ts`
2. `services/font-assets.ts`
3. `utils/font-loader.ts`
4. `services/composition-renderer.ts`
5. `services/composition-export.ts`
6. `pages/Workspace/components/workflow/EcommerceTextOverlayEditor.tsx`

### 37.9 开发顺序拆解

建议按字段推进，而不是按想法推进。

#### Phase A1：只打通元数据

目标：

1. 不做编辑器
2. 先让步骤五/六/七知道“这是什么图”

动作：

1. `EcommercePlanItem.layoutIntent`
2. `EcommerceBatchJob.layoutSnapshot`
3. `EcommerceResultItem.layoutMeta`

#### Phase A2：只打通后合成入口

目标：

1. 还不做全量组件
2. 先让结果卡能挂接“后合成状态”

动作：

1. `EcommerceResultItem.overlayState`
2. `EcommerceOneClickSessionState.editingResultUrl`
3. `EcommerceOneClickSessionState.overlayPanelOpen`

#### Phase A3：打通文字层

目标：

1. 先完成主标题、副标题、角标

动作：

1. 新增 `TextComposition`
2. 绑定 `textCompositionId`
3. 导出成片

#### Phase B：打通组件层

目标：

1. 再逐步扩展到图标、底板、标注、轻特效

### 37.10 兼容性落地要求

新增字段必须全部遵守以下规则：

1. 一律可选
2. 老项目缺字段时必须能正常打开
3. store hydrate 时必须给默认值
4. UI 渲染时必须允许字段为空
5. 不允许因为缺少新字段阻断当前步骤七流程

### 37.11 最小可落地字段集

如果要先做最小实现，只建议第一批落这 8 个字段：

1. `EcommercePlanItem.layoutIntent.imageRole`
2. `EcommercePlanItem.layoutIntent.layoutMode`
3. `EcommercePlanItem.layoutIntent.componentNeed`
4. `EcommerceBatchJob.layoutSnapshot`
5. `EcommerceResultItem.layoutMeta`
6. `EcommerceResultItem.overlayState`
7. `EcommerceOneClickSessionState.editingResultUrl`
8. `EcommerceOneClickSessionState.overlayPanelOpen`

这 8 个字段就已经足够把“详情页后合成系统”的骨架先搭起来。

