# Workspace 安卓平板触控适配详细计划

- 日期：2026-05-15
- 适用范围：`Workspace` 画布交互层
- 目标设备：安卓平板浏览器
- 原则：**保留现有电脑鼠标网页体验，不做替代，只做增量触控适配**

---

## 1. 产品经理阶段

### 1.1 页面目标
让 `Workspace` 在安卓平板网页中具备可用且稳定的核心画布操作能力，同时**不破坏现有桌面鼠标交互**。

### 1.2 用户主任务
平板用户进入工作台后，能完成以下高频动作：

1. 双指缩放画布
2. 双指拖动画布
3. 单指点击选中节点 / 空白
4. 单指拖动节点
5. 单指空白区拖拽框选节点
6. 单指拖动端口进行节点连线
7. 在后续阶段支持 `mark` 和断开连线

### 1.3 功能清单

#### P0 核心功能
- 触屏输入模式判定
- 双指缩放画布
- 双指平移画布
- 单指点击选中节点
- 单指拖动节点
- 单指空白区框选节点
- 连线端口热区放大
- 单指拖动创建连线

#### P1 补充功能
- `mark` 的平板交互
- 断开连接线的平板交互
- 连线选中态与删除态
- 框选反馈优化
- 平板态热区放大

#### P2 体验增强
- 触控提示层
- 平板调试模式开关
- 桌面 / 触控强制切换
- 长按辅助菜单（如有必要）

### 1.4 功能优先级
- **最高优先级**：缩放、平移、节点拖动、框选、连线
- **中优先级**：`mark`、断开连线
- **低优先级**：更高级的触屏提示、长按菜单、平板专属动画优化

### 1.5 信息架构

#### 画布交互层
- 输入源识别
- 触控状态机
- 桌面鼠标状态机（保留）
- 缩放/平移状态
- 拖动/框选状态
- 连线状态
- `mark` 模式状态

#### UI 层
- 画布主舞台
- 节点元素层
- 连线层
- 工具条层
- 平板态提示层

#### 回归层
- 桌面鼠标专项回归
- 安卓平板触控专项回归
- 模式切换回归

### 1.6 哪些功能不直接堆到第一阶段
以下能力进入二级阶段，避免第一轮范围过大：

- `mark` 自由拖矩形
- 手势切断连线
- 长按上下文菜单
- 复杂 hover 替代
- 触控笔专项适配

---

## 2. UI / 交互设计阶段

### 2.1 页面区块划分
触控适配主要涉及以下区块：

1. 画布主舞台
2. 节点元素本体
3. 节点连线层
4. 平板交互提示层
5. 工具栏与模式提示层

### 2.2 模块布局建议
- 保持桌面现有布局不变
- 触控模式下只增强热区与提示，不重做主界面结构
- 所有新增提示尽量做轻量浮层，不打断工作流

### 2.3 低保真交互规则

#### 规则 A：单指点击
- 点节点：等价桌面单击
- 点空白：取消选择 / 进入空白态
- 点连线：选中连线（后续支持断开）

#### 规则 B：单指拖动
- 拖到节点：移动节点
- 拖到空白区：框选节点
- 拖到端口：创建连线

#### 规则 C：双指手势
- 双指张合：缩放画布
- 双指同向移动：平移画布
- 双指状态下，禁止节点拖动 / 框选 / 连线误触发

#### 规则 D：`mark`
建议作为显式模式，不走隐式手势：
- 进入 `mark` 模式后
- 第一版：单指点击生成固定尺寸标记区域
- 第二版：支持单指拖出矩形区域

#### 规则 E：断开连线
建议走显式选中删除：
- 单指点中连线
- 连线进入选中态
- 显示“断开连接”按钮

### 2.4 视觉规范建议

#### typography
- 提示层文字：`12-13px / medium`
- 模式标签：`10-12px / semibold`

#### spacing
- 热区与手指命中区域：建议至少 `40-48px`
- 工具按钮间距：`8 / 12`
- 浮层内边距：`12 / 16`

#### colors
- 继续沿用现有中性色体系
- 触控模式提示色可使用低饱和蓝色
- 不新增高饱和装饰色

#### radius
- 平板新增浮层建议 `12 / 16`

#### icon size
- 按钮图标建议最少 `18-20px`
- 触控热区建议最少 `40px`

### 2.5 风险点

#### 高风险
- 单指拖动与框选冲突
- 双指缩放时误触发节点拖动
- 连线端口过小导致难以命中
- 平板模式误伤桌面鼠标链路

#### 中风险
- `mark` 模式与普通点击冲突
- 连线选中态与节点选中态冲突
- 手势状态退出不彻底导致残留状态

#### 低风险
- 提示浮层遮挡
- 平板态按钮局部过密

---

## 3. 前端工程实施阶段

### 3.1 组件与模块拆分

#### 核心文件
- `pages/Workspace/components/WorkspaceCanvasStage.tsx`
- `pages/Workspace/controllers/useWorkspaceCanvasPointer.ts`
- `pages/Workspace/components/WorkspaceCanvasElementsLayer.tsx`
- `pages/Workspace/components/WorkspaceCanvasImageElement.tsx`
- `pages/Workspace/components/WorkspaceCanvasTextElement.tsx`
- `pages/Workspace/components/WorkspaceCanvasVideoElement.tsx`
- `pages/Workspace/components/WorkspaceCanvasMarkersLayer.tsx`
- `stores/ui.store.ts`

#### 新增建议模块
- `pages/Workspace/controllers/useWorkspaceTouchCanvasPointer.ts`（触屏专用输入层）
- `pages/Workspace/controllers/workspaceTouchDetection.ts`（设备/输入能力识别）
- `pages/Workspace/components/WorkspaceTouchModeBanner.tsx`（轻量模式提示，可选）

### 3.2 输入策略
采用：

- **桌面链路保留**
- **触控链路新增**
- **模式分流，不强制统一重写**

推荐模式字段：
- `canvasInputMode: "auto" | "force-touch" | "force-desktop"`

默认策略：
- `auto`
- 自动检测安卓平板 / touch capability 时优先走触控链路
- 保留手动兜底

### 3.3 Phase 1 实施内容

#### 目标
先补最刚需，且尽量不动桌面核心逻辑。

#### 范围
1. 双指缩放画布
2. 双指平移画布
3. 单指节点拖动

#### 做法
- 在 `WorkspaceCanvasStage` 增加 pointer/touch 入口
- 建立触屏 pointer 状态追踪
- 双指时只允许缩放/平移
- 单指命中节点时走拖动
- 桌面原 `mouse` 逻辑保持不删

### 3.4 Phase 2 实施内容

#### 范围
1. 单指空白区框选节点
2. 连线端口热区放大
3. 单指拖动端口进行连线

#### 做法
- 把空白区拖动分流为框选
- 区分“命中节点 / 命中端口 / 命中空白”三种场景
- 连线端口增加触控热区壳层，不一定视觉放大

### 3.5 Phase 3 实施内容

#### 范围
1. `mark` 平板交互
2. 断开连接线交互

#### 建议
- `mark`：显式模式进入，第一版单点固定框
- 断线：点中连线后显示断开按钮

### 3.6 布局与边界策略
- 双指手势期间禁止节点拖动与框选
- 单指拖动开始前增加轻量阈值，避免误触
- 所有新增热区都不应撑坏现有桌面视觉
- 所有状态退出都必须清空 pointer cache

### 3.7 不允许的实现方式
- 一次性重写 `useWorkspaceCanvasPointer` 全部逻辑
- 直接删除桌面 `mouse` 链路
- 只靠 UA 猜测触控模式，不保留手动兜底
- 先做复杂 `mark` / 断线手势，再做基础缩放拖动

---

## 4. 代码审阅标准

### 4.1 代码质量
- 桌面与触控分支职责清晰
- 不允许把触控条件硬编码散落多个组件
- 事件分流必须集中管理

### 4.2 复用性
- 手势计算逻辑抽成可复用函数
- 触控检测逻辑独立封装
- 模式判定统一读取 store

### 4.3 边界风险
- 双指变单指的状态切换
- pointer cancel / blur / leave 清理
- 安卓浏览器默认滚动/缩放冲突
- 节点拖动与框选互斥条件

### 4.4 样式重复
- 热区放大样式统一收口
- 平板提示条样式不要分散复制

### 4.5 维护性问题
- 不能把桌面逻辑和触控逻辑搅成一个超长函数
- 高风险逻辑必须有日志或显式注释

---

## 5. 设计审稿标准

### 5.1 功能是否乱放
- 平板适配不新增杂乱入口
- `mark` 和断线都必须有明确主入口

### 5.2 视觉层级是否混乱
- 提示条只做轻量提示，不抢主画布注意力
- 平板新增按钮不应覆盖主要编辑区域

### 5.3 间距是否一致
- 热区扩大后仍遵守统一 spacing system
- 工具条与浮层边距保持一致

### 5.4 图标与文字是否对齐
- 提示条图标与文字垂直居中
- 连线/mark 操作按钮热区一致

### 5.5 是否存在出界、拥挤、像 demo 的问题
- 平板态新增浮层不能挡住关键操作区
- 不允许出现“只是把按钮做大”的临时 demo 感方案

### 5.6 是否达到产品级 UI 标准
- 平板适配是补交互，不是换一套视觉皮肤
- 所有新增 UI 必须克制、统一、可回退

---

## 6. 回归测试清单

### 6.1 桌面回归（必须）
- 鼠标单击选中节点
- 鼠标拖动节点
- 鼠标框选节点
- 鼠标拖动连线
- 鼠标 mark
- 鼠标右键 / 原有上下文行为
- 画布缩放与平移

### 6.2 安卓平板回归（必须）
- 单指点选节点
- 单指拖动节点
- 单指空白区框选
- 双指缩放
- 双指平移
- 单指拖动端口连线
- 平板模式退出后状态清空

### 6.3 阶段性回归
- `mark` 单点固定框
- 点选连线后断开按钮
- auto / force-touch / force-desktop 三模式切换

---

## 7. 实施建议总结

### 最终推荐模式
- **底层：双栈兼容**
- **默认：检测触发**
- **兜底：手动开关覆盖**

### 最稳推进顺序
1. 输出计划文档（当前）
2. Phase 1：双指缩放/平移 + 单指节点拖动
3. Phase 2：框选节点 + 连线触控热区与拖动
4. Phase 3：`mark` 与断线交互
5. 全量桌面/平板回归

### 核心原则
> 平板适配是新增触控交互层，不替换现有桌面鼠标网页体验。

---

## 8. 相关文件清单

### 当前重点
- `pages/Workspace/components/WorkspaceCanvasStage.tsx`
- `pages/Workspace/controllers/useWorkspaceCanvasPointer.ts`
- `pages/Workspace/components/WorkspaceCanvasElementsLayer.tsx`
- `pages/Workspace/components/WorkspaceCanvasImageElement.tsx`
- `pages/Workspace/components/WorkspaceCanvasTextElement.tsx`
- `pages/Workspace/components/WorkspaceCanvasVideoElement.tsx`
- `pages/Workspace/components/WorkspaceCanvasMarkersLayer.tsx`
- `stores/ui.store.ts`

### 可参考现有触控相关能力
- `pages/Workspace/controllers/useWorkspaceTouchEditActions.ts`
- `pages/Workspace/components/WorkspaceTouchEditIndicator.tsx`
