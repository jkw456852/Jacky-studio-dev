# 电商工作流图片文字覆盖系统技术架构方案

## 1. 架构目标

该系统的技术目标是把“底图生成”和“最终文字渲染”拆成两条职责清晰的链路：

1. 生图链路负责生成无字底图
2. 编辑链路负责管理字体、文字图层、模板、建议布局
3. 渲染链路负责真实绘制文字并导出最终成片
4. 持久化链路负责保存所有可编辑状态

核心目标是可控、可恢复、可扩展，而不是一开始追求全自动。

---

## 2. 总体架构

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

## 3. 模块拆分

### 3.1 字体资产层

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

建议接口：

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
```

---

### 3.2 文字构成层

职责：

1. 用结构化数据描述一张图片上的全部文字图层
2. 作为 UI 编辑、预览渲染、最终导出的唯一数据源
3. 支持版本化和持久化

建议文件：

1. `types/text-composition.ts`
2. `utils/text-layout.ts`

建议接口：

```ts
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

架构原则：

1. 所有预览与导出共用同一份 `TextComposition`
2. 不允许 UI 自己维护另一套平行排版状态
3. 单图可存在多个版本，但当前激活版本只能有一个

---

### 3.3 智能版式层

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

### 3.4 工作流接入层

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

### 3.5 渲染导出层

职责：

1. 将底图与文字图层绘制成最终图片
2. 输出 PNG/DataURL/Blob
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

复用建议：

1. 复用 [types/common.ts](E:/ai网站/XC-STUDIO/types/common.ts)
2. 复用 [services/skills/export.skill.ts](E:/ai网站/XC-STUDIO/services/skills/export.skill.ts)

---

### 3.6 持久化层

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

## 4. 数据流设计

### 4.1 编辑数据流

1. 用户点击步骤七结果卡“上字”
2. 读取 `resultId` 对应的 `TextComposition`
3. 若不存在则初始化默认构成
4. 编辑器对 `TextComposition` 进行修改
5. 预览层订阅同一份状态进行实时渲染
6. 保存时回写 store 与项目状态

### 4.2 导出数据流

1. 用户点击导出
2. 导出服务读取 `TextComposition`
3. 字体服务确保所需字体全部加载
4. 渲染服务输出成片图
5. 结果图地址写回 `exportedComposedImageUrl`
6. 状态更新为 `exported`

### 4.3 模板/建议数据流

1. 用户点击智能排版
2. 图像分析层分析留白与主体区域
3. 规则层限定安全区
4. AI/规则层生成建议 `SuggestedComposition`
5. 编辑器载入建议稿
6. 用户确认或调整后保存

---

## 5. 状态边界设计

建议将状态分为三类：

### 5.1 持久状态

1. 字体资产
2. 文字构成
3. 模板选择
4. 已导出的成片地址

### 5.2 会话状态

1. 当前正在编辑的结果图 id
2. 当前选中的图层 id
3. 当前面板展开状态
4. 草稿修改标记

### 5.3 临时渲染状态

1. 字体加载中
2. 导出中
3. 智能排版生成中
4. 图片资源加载中

原则：

1. 持久状态和 UI 临时状态必须分开
2. 结果卡显示状态不可直接依赖临时编辑态
3. 导出态与编辑态要允许并存，但要有版本标记

---

## 6. 关键技术风险与防护

### 6.1 字体加载时序

风险：字体没加载完就渲染，导致字体回退。

防护：

1. 统一字体加载入口
2. 导出前等待 `document.fonts.ready`
3. 必要时显式调用 `document.fonts.load`

### 6.2 跨域图像污染 canvas

风险：底图跨域导致导出失败。

防护：

1. 优先使用 data URL
2. 优先使用可信代理图源
3. 导出前进行图源可绘制校验

### 6.3 文本测量误差

风险：文字换行和预览不一致。

防护：

1. 使用 `measureText()`
2. 自建统一换行逻辑
3. 单独处理中英混排与字距

### 6.4 数据膨胀

风险：图片、字体、模板、图层都要存，状态会变重。

防护：

1. 字体资源单独缓存
2. 文字构成只存结构化数据，不重复存图片二进制
3. 导出图与底图分开管理

### 6.5 规则与 AI 冲突

风险：AI 建议好看但超出平台安全区或压住主体。

防护：

1. 规则层优先级高于 AI
2. AI 输出必须过规则修正
3. 给出 warning，而不是直接硬套

---

## 7. 推荐实施顺序

1. 定义 `FontAsset`、`TextOverlay`、`TextComposition`
2. 完成字体上传与字体注册服务
3. 完成基础文字编辑器
4. 完成 canvas 渲染与导出
5. 接入步骤七结果卡
6. 接入持久化恢复
7. 再做模板与智能建议

---

## 8. 目录建议

1. `docs/architecture/ECOMMERCE_TEXT_OVERLAY_ARCHITECTURE.md`
2. `docs/product/ECOMMERCE_TEXT_OVERLAY_PRODUCT_PRD.md`
3. `docs/product/ECOMMERCE_TEXT_OVERLAY_DELIVERY_SCHEDULE.md`
4. `services/font-assets.ts`
5. `services/composition-renderer.ts`
6. `services/composition-export.ts`
7. `services/text-layout-intelligence.ts`
8. `utils/font-loader.ts`
9. `utils/text-layout.ts`
10. `types/text-composition.ts`
11. `pages/Workspace/components/workflow/EcommerceTextOverlayEditor.tsx`
12. `pages/Workspace/components/workflow/EcommerceFontUploader.tsx`

---

## 9. 相关文档

1. 总览方案：[docs/product/ECOMMERCE_TEXT_OVERLAY_SYSTEM_PLAN.md](E:/ai网站/XC-STUDIO/docs/product/ECOMMERCE_TEXT_OVERLAY_SYSTEM_PLAN.md)
2. 产品方案版：[docs/product/ECOMMERCE_TEXT_OVERLAY_PRODUCT_PRD.md](E:/ai网站/XC-STUDIO/docs/product/ECOMMERCE_TEXT_OVERLAY_PRODUCT_PRD.md)
3. 开发排期版：`docs/product/ECOMMERCE_TEXT_OVERLAY_DELIVERY_SCHEDULE.md`
