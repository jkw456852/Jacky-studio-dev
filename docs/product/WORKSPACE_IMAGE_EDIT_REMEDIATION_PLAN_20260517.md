# Workspace 图片编辑能力整改计划（去背景 / 产品替换 / 局部重绘）

## 文档信息
- 文档版本：v1.0
- 创建时间：2026-05-17
- 范围：仅覆盖 `去背景`、`产品替换`、`局部重绘`
- 明确排除：`放大` 暂不纳入本轮整改
- 目标：
  1. 先修复功能语义与实际行为不一致的问题
  2. 再统一三条老链路的任务协议、执行路径、回滚策略和 UI 行为
  3. 最终让三项能力都具备“真实可用、结果可预期、失败可解释”的产品级行为

---

## 1. 现状总览

当前这三项功能并不属于同一套图片编辑系统，而是分散在多条历史链路中：

### 1.1 去背景链路
- UI 入口：`pages/Workspace/components/WorkspaceImageSideToolbar.tsx`
- 事件透传：
  - `pages/Workspace/components/WorkspaceImageToolbar.tsx`
  - `pages/Workspace/controllers/useWorkspaceCanvasLayerProps.ts`
  - `pages/Workspace/components/WorkspaceCanvasElementsLayer.tsx`
  - `pages/Workspace/components/WorkspaceCanvasElementContent.tsx`
  - `pages/Workspace/components/WorkspaceCanvasImageElement.tsx`
- 核心动作：`pages/Workspace/controllers/useWorkspaceElementEditActions.ts` 中的 `handleRemoveBg`
- 底层技能：`services/skills/smart-edit.skill.ts`
- 底层服务：`services/gemini.ts` 中的 `editImage`

### 1.2 产品替换链路
- UI 入口：`pages/Workspace/components/WorkspaceImageSideToolbar.tsx`
- 事件透传：同上
- 核心动作：`pages/Workspace/controllers/useWorkspaceProductSwap.ts`
- 底层服务：
  - `services/gemini.ts` 中的 `analyzeProductSwapScene`
  - `services/gemini.ts` 中的 `generateImage`

### 1.3 局部重绘链路（现状存在严重错位）
- UI 入口文案：`局部重绘`
- 实际 handler：`pages/Workspace/controllers/useWorkspaceImageToolActions.ts` 中的 `handleVectorRedraw`
- 实际行为：更接近“整图风格化矢量重绘”，不是局部 mask 编辑
- 橡皮蒙版执行链路：
  - `pages/Workspace/components/WorkspaceImageToolbar.tsx`
  - `pages/Workspace/controllers/useWorkspaceImageToolActions.ts` 中的 `handleExecuteEraser`
  - `services/skills/smart-edit.skill.ts`

---

## 2. 核心问题清单

## 2.1 去背景
### 现状问题
1. 当前实现本质是“通用生成式编辑 prompt”，不是专门的透明抠图能力。
2. 没有显式区分：
   - 透明背景输出
   - 替换背景 / 清理背景
3. 没有对返回结果进行 alpha 校验。
4. 对不同模型没有能力分层，导致低可靠模型也被暴露为同样的“去背景”按钮。
5. 失败时只会生成异常结果，没有稳定的失败类型与用户提示。

### 风险
- 主体边缘发灰
- 透明背景失效，返回白底/场景底
- 主体材质、阴影、轮廓被破坏
- 用户以为得到抠图，实际上得到的是“模型重画后的新图”

## 2.2 产品替换
### 现状问题
1. 当前不是局部替换，而是整图参考重生成。
2. 没有主产品定位信息，没有 mask，没有局部替换区域约束。
3. 模型硬编码，不跟随当前节点模型选择。
4. “产品替换”这个名字与当前能力严重不匹配。
5. 没有对替换目标进行结构化描述：
   - 旧产品位置
   - 新产品放置区域
   - 透视校准
   - 接触阴影与遮挡恢复

### 风险
- 替换错对象
- 产品位置漂移
- 场景整体重写
- 人物、背景、构图一起被改
- 新产品尺寸、角度、光影与原图脱节

## 2.3 局部重绘
### 现状问题
1. UI 名称写的是“局部重绘”，但实际接入的是 `handleVectorRedraw`。
2. `handleVectorRedraw` 走的是整图风格翻译链路，不读取局部区域。
3. 真正具备局部编辑能力的是橡皮蒙版链路 `handleExecuteEraser`，但它的产品语义被限制在“擦除对象”。
4. 没有统一的“局部编辑任务协议”，所以 OCR 改字、橡皮擦除、局部重绘三者互相孤立。

### 风险
- 用户操作预期与结果完全不一致
- 局部需求被整图改写
- 树状节点与经典节点都在复用错误能力名

---

## 3. 本轮整改目标

## 3.1 产品目标
让三项能力都满足以下标准：
1. 名称与行为一致
2. 用户知道自己在进行的是哪类编辑
3. 结果失败时能被识别，而不是静默产出错误图片
4. 三条链路共享统一的任务协议和回滚策略
5. 后续可以继续扩展到 OCR 改字、放大、风格编辑等能力

## 3.2 本轮不追求一次到位的部分
1. 不做真正通用的多对象产品替换
2. 不做完美商业级 matting 模型接入
3. 不做放大链路整改
4. 不做所有模型的最优适配，只先实现能力分层与可靠降级

---

## 4. 整改原则

1. 先修正错误语义，再增强能力。
2. 先把“局部重绘”改成真实局部编辑，再讨论高级风格重绘。
3. 去背景必须显式引入“透明输出校验”。
4. 产品替换短期先降级为“受控参考替换/重构”，中期再走 mask 化升级。
5. 不再新增第四套独立编辑链路，必须收拢到统一编辑协议中。

---

## 5. 目标架构

建议收敛到统一图片编辑任务协议。

### 5.1 新增统一任务类型
建议在 `types/common.ts` 扩展：
- `WorkspaceImageEditKind`
- `WorkspaceImageEditJob`
- `WorkspaceImageEditResult`
- `WorkspaceImageEditFailureReason`

建议能力类型：
- `background-cutout`
- `product-replace`
- `local-redraw`
- `object-remove`
- `text-edit`
- `style-edit`

### 5.2 新增统一图片编辑编排器
建议新增：
- `pages/Workspace/controllers/useWorkspaceImageEditPipeline.ts`

职责：
1. 根据任务类型路由到底层执行器
2. 统一创建临时结果节点
3. 统一回滚/删除失败节点
4. 统一持久化 `persistEditSession`
5. 统一一致性修复 `retryWithConsistencyFix`
6. 统一结果校验与错误分类

### 5.3 底层执行器拆分
建议拆成三个执行器：
1. `runBackgroundCutoutJob`
2. `runProductReplaceJob`
3. `runLocalRedrawJob`

未来可扩展：
4. `runTextEditJob`
5. `runObjectRemoveJob`
6. `runStyleEditJob`

---

## 6. 三项能力的详细整改方案

# 6.1 去背景整改方案

## 6.1.1 产品定义修正
把“去背景”明确拆成：
1. `透明抠图`
2. `背景替换/背景清理`（本轮不做新入口，只保留后续扩展空间）

本轮 `去背景` 按“透明抠图”实现。

## 6.1.2 行为要求
1. 输出应优先为透明背景 PNG。
2. 主体结构、材质、轮廓必须尽量保持。
3. 返回结果若没有 alpha，则视为失败或降级失败。
4. 模型不支持稳定透明 cutout 时，应禁用或提示“实验中”。

## 6.1.3 技术改造
### A. 在 `services/skills/smart-edit.skill.ts` 增加专用分支
- 不再把 `background-remove` 当作普通 `editImage` prompt
- 新增更明确的 prompt 模板与输出约束
- 明确传递 `outputMode: transparent`

### B. 在 `services/gemini.ts` 增加结果校验
建议新增工具函数：
- `hasTransparentPixels()`
- `validateTransparentCutoutResult()`

校验逻辑：
1. 解析返回图片
2. 检查是否存在 alpha 通道透明像素
3. 若无透明像素则返回失败原因：`missing-alpha-output`

### C. 在 `useWorkspaceElementEditActions.ts` 中重构 `handleRemoveBg`
重构目标：
- 从“直接调用 smartEditSkill”改为“构建 BackgroundCutoutJob 并走统一 pipeline”
- 对失败原因显示更清晰提示

## 6.1.4 验收标准
1. 返回图片存在透明背景
2. 主体边缘无大面积黑边/白边
3. 主体不应被重画成不同物品
4. 失败时不替换原图，不留下错误结果节点

---

# 6.2 产品替换整改方案

## 6.2.1 产品定义修正
本轮不把它宣传为“精确局部产品替换”，而是分阶段：

### 第 1 阶段（本轮）
- 名称可保留 `产品替换`
- 但能力定义应改为：
  - `受控参考产品替换（场景尽量保留）`
- 去除硬编码模型
- 增强提示词、任务结构、失败回滚与一致性保护

### 第 2 阶段（后续）
- 做真正的：
  - 目标产品定位
  - 局部 mask 替换
  - 背景恢复
  - 接触阴影修复

## 6.2.2 本轮必须修的点
1. 去掉 `Nano Banana Pro` 硬编码，改为跟随节点模型或受支持模型映射。
2. 明确将其标记为“受控场景重构”，不是局部 replace。
3. 加入统一任务描述结构：
   - 场景图
   - 产品参考图
   - 分析摘要
   - 保持不变的场景约束
4. 改善失败清理与一致性修复信息。

## 6.2.3 技术改造
### A. 重构 `useWorkspaceProductSwap.ts`
当前问题：
- 逻辑独立、孤岛式存在
- 模型硬编码
- 没有结果类型分类

整改目标：
1. 接入统一 `WorkspaceImageEditJob`
2. 改为返回结构化任务：
   - `editKind: product-replace`
   - `referenceImages`
   - `analysis`
   - `preservePrompt`
   - `allowFullRegenerateFallback: true`
3. 显式带入当前元素模型映射
4. 将新增节点、回滚、一致性修复统一交给 pipeline

### B. 新增失败分类
建议失败原因：
- `missing-reference-images`
- `scene-analysis-failed`
- `model-not-supported`
- `full-regenerate-drifted-too-far`
- `generation-empty`

### C. 文案降级
如果本轮仍未做 mask replace，则在 UI 或任务说明中明确：
- 保持场景尽量不变
- 当前为基于参考图的受控替换生成
- 不承诺像素级局部替换

## 6.2.4 第 2 阶段预留架构
为后续真替换预留：
- `targetBox`
- `targetMask`
- `replacementPlacement`
- `backgroundRecoveryRequired`

## 6.2.5 验收标准
1. 不再硬编码模型
2. 失败时不遗留错误节点
3. 结果的一致性说明明确
4. 后续可无痛升级到局部 mask 替换

---

# 6.3 局部重绘整改方案

## 6.3.1 产品定义修正
当前按钮文案错误，必须修正为真实行为。

### 目标行为
`局部重绘` = 用户指定局部区域，模型仅编辑该区域，未遮罩区域保持不变。

### 不再混淆的能力
- `局部重绘`：局部 mask inpaint
- `矢量重绘`：整图风格化线稿转换（如仍保留，需单独命名）

## 6.3.2 本轮必须修的点
1. 把当前 `handleVectorRedraw` 从“局部重绘”入口剥离。
2. 新 `局部重绘` 直接复用现有 `eraser mask` 机制。
3. 让 `局部重绘` 支持：
   - 进入蒙版模式
   - 刷区域
   - 输入局部重绘意图
   - 执行局部编辑
4. 保留现有 `OCR 改字` 的局部 mask 经验，与新局部重绘共用底层能力。

## 6.3.3 技术改造
### A. `useWorkspaceImageToolActions.ts`
1. 将 `handleVectorRedraw` 改名为：
   - `handleStylizedVectorRedraw`
2. 保留它作为低频风格化能力，不再映射到 `局部重绘`
3. 新增：
   - `handleStartLocalRedraw`
   - `handleApplyLocalRedraw`

### B. `WorkspaceImageToolbar.tsx`
为局部重绘增加专门的底部面板或弹层：
- 输入局部编辑意图
- 确认执行
- 取消并清空 mask

### C. 统一橡皮链路与局部重绘链路
当前 `handleExecuteEraser` 语义是“擦除对象”。
本轮需要把它抽象成：
- `runMaskedEditJob(mask, prompt, preservePrompt, editKind)`

然后分成两种调用：
1. `object-remove`
2. `local-redraw`

### D. `smart-edit.skill.ts`
为 `local-redraw` 增加明确 `editType` 或统一映射策略，避免继续伪装成 `upscale`。

## 6.3.4 UI 改造
### 经典节点
- `局部重绘` 点下后：
  1. 进入画笔蒙版模式
  2. 底部出现局部重绘输入面板
  3. 用户输入要在该区域改什么
  4. 执行局部编辑

### 树状节点
- 顶部工具栏继续保留入口
- 行为与经典节点一致
- 不再调用旧的 `vector redraw`

## 6.3.5 验收标准
1. 局部重绘必须只修改 mask 区域
2. 未遮罩区域尽量保持不变
3. 不允许再触发整图矢量风格化
4. `矢量重绘` 如果保留，必须改成正确名称

---

## 7. 统一重构方案

## 7.1 新增文档级目标模块
建议新增：
- `pages/Workspace/controllers/useWorkspaceImageEditPipeline.ts`
- `pages/Workspace/controllers/workspaceImageEditTypes.ts`
- `pages/Workspace/controllers/workspaceImageEditValidators.ts`

## 7.2 统一能力抽象
建议抽象以下步骤：
1. `resolveSourceElement()`
2. `createTemporaryEditResultNode()`
3. `buildImageEditJob()`
4. `executeImageEditJob()`
5. `validateImageEditResult()`
6. `applyOrRollbackEditResult()`

## 7.3 统一结果校验
- 透明抠图：检查 alpha
- 局部重绘：检查返回非空，且保留区域不应明显漂移（先只做人工提示，不做像素比对）
- 产品替换：先做一致性修复提示，不做自动拒收

---

## 8. 实施步骤

# Phase 1：文案与语义纠偏
1. 修正文档与代码中的功能语义说明
2. 将 `局部重绘` 与 `矢量重绘` 区分
3. 给 `产品替换` 标注当前能力边界

# Phase 2：局部重绘先落地
1. 剥离旧 `handleVectorRedraw`
2. 抽象 `runMaskedEditJob`
3. 新增局部重绘输入面板
4. 让经典节点与树状节点共用新局部重绘执行器

# Phase 3：去背景整改
1. 增加 `background-cutout` 任务类型
2. 增加 alpha 校验
3. 增加失败提示与回滚
4. 视模型能力决定禁用/开放

# Phase 4：产品替换整改
1. 去掉模型硬编码
2. 改为统一 job 执行结构
3. 增强一致性说明与失败分类
4. 预留后续 mask replace 的扩展字段

# Phase 5：统一 pipeline 收口
1. 合并分散逻辑
2. 清理重复的临时节点与回滚代码
3. 统一日志、持久化与一致性修复

---

## 9. 文件级改造清单

### 高优先级文件
- `pages/Workspace/controllers/useWorkspaceImageToolActions.ts`
- `pages/Workspace/controllers/useWorkspaceElementEditActions.ts`
- `pages/Workspace/controllers/useWorkspaceProductSwap.ts`
- `services/skills/smart-edit.skill.ts`
- `services/gemini.ts`
- `pages/Workspace/components/WorkspaceImageToolbar.tsx`
- `pages/Workspace/components/WorkspaceImageSideToolbar.tsx`
- `pages/Workspace/components/WorkspaceTreeImageNode.tsx`

### 中优先级文件
- `pages/Workspace/controllers/useWorkspaceCanvasLayerProps.ts`
- `pages/Workspace/components/WorkspaceCanvasElementsLayer.tsx`
- `pages/Workspace/components/WorkspaceCanvasElementContent.tsx`
- `pages/Workspace/components/WorkspaceCanvasImageElement.tsx`
- `types/common.ts`

### 新增文件（建议）
- `pages/Workspace/controllers/useWorkspaceImageEditPipeline.ts`
- `pages/Workspace/controllers/workspaceImageEditTypes.ts`
- `pages/Workspace/controllers/workspaceImageEditValidators.ts`
- `pages/Workspace/components/WorkspaceImageLocalRedrawPanel.tsx`

---

## 10. 风险与应对

### 风险 1：局部重绘重构时影响现有 OCR 改字
**应对**：
- 先抽象通用 `masked edit`，让 OCR 改字迁移到同底层
- 不直接改 OCR 文案和 UI

### 风险 2：去背景对部分模型返回不透明图片
**应对**：
- 加显式校验
- 校验失败时不给成功结果

### 风险 3：产品替换短期仍无法做到像素级替换
**应对**：
- 明确标注为受控参考替换
- 同时预留第 2 阶段字段和数据结构

### 风险 4：树状节点与经典节点行为再次分叉
**应对**：
- 只允许顶部工具栏和经典侧边工具栏共用同一 handler
- 不允许复制执行逻辑

---

## 11. 验收标准

### 去背景
- 返回透明 PNG 或明确失败
- 不允许白底伪成功
- 主体轮廓可接受

### 产品替换
- 不再硬编码模型
- 结果节点与失败回滚正常
- 能明确说明当前是受控参考替换

### 局部重绘
- 真正使用局部 mask
- 不再走整图矢量风格化
- 经典节点与树状节点行为一致

### 架构
- 三项能力开始共用统一编辑协议
- 后续可继续接 OCR 改字与放大整改

---

## 12. 立即执行顺序

本次开始干活时，严格按以下顺序：
1. 先修 `局部重绘` 名不副实问题
2. 再修 `去背景` 的透明结果校验
3. 再修 `产品替换` 的模型硬编码与任务结构
4. 最后抽统一 pipeline 收口重复逻辑

这是本轮实施的唯一执行顺序，禁止先做产品替换大改、再回头补局部重绘语义。