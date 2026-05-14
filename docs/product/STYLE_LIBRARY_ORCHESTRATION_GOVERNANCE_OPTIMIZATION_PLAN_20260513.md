# 风格库产品化重构与治理优化计划

日期：2026-05-13  
范围：风格库导入 / 编辑 / 使用 / 测试验证 / 运行时叠加治理 / 工作台图片生成链路  
状态：待实施

## 0. 结论复盘

### 0.1 核心判断
当前项目里的“风格库”本质上仍偏向**系统内部的生成约束对象**；对标产品里的“风格库”已经是**可导入、可编辑、可测试、可验证、可复用的风格资产单元**。

两者最根本的差异，不在 UI 漂不漂亮，而在产品定义不同：

- 我们现在更像：规则卡片 / prompt 约束资产
- 对方更像：带图集、带描述、带验证、带测试结果的风格生产单元

### 0.2 上一轮结论中仍然成立的部分
以下判断继续成立：
1. 用户显式选择的基础风格库必须只读，不允许被编排器静默改写
2. 本轮生成产生的补充约束应作为运行时附加层存在，而不是直接覆盖正式风格库
3. 多图变体应默认复用同一套规划结果
4. 风格库不应再自己控制是否允许编排，全局编排开关才是主控制路径

### 0.3 需要补强的部分
上一轮更偏“治理视角”，还需要补上“产品资产化视角”：
1. 风格库不只是治理边界问题，更是**资产模型不完整**的问题
2. 导入、编辑、使用、验证四个阶段目前没有形成闭环
3. 当前界面仍把风格库当成节点附属设置，而不是独立经营的资产
4. 缺少“测试标准 + 出样验证 + 回归比较”，用户无法确认风格库是否真的稳定生效
5. 缺少“风格图集”这一层，导致所谓风格库更像文本对象而不是风格资产包

---

## 1. 页面目标
把当前风格库体系从“高级 prompt 约束对象”升级成“可复用风格资产产品”，实现：

- 导入时能从参考图集中提炼风格
- 编辑时能以用户语言维护风格，而不是只暴露系统术语
- 使用时能先看测试效果，再决定应用
- 运行时临时叠加和正式风格资产严格分层
- 任何正式资产更新都必须由用户主动确认

---

## 2. 用户主任务
1. 上传一组同风格参考图，快速沉淀为一个可复用风格库
2. 能看懂这个风格库适合什么、不适合什么、会生成什么效果
3. 在真正应用前，先通过标准测试样例验证风格是否稳定
4. 在当前节点中快速应用一个已验证的风格库
5. 当本轮生成出现不错的临时微调结果时，能手动保存为新风格库

---

## 3. 对标复盘：对方做对了什么

### 3.1 导入阶段
对方不是“导入一段规则”，而是导入一组素材后生成：
- 标题
- 分类
- 风格图集
- 风格关键词
- 风格描述
- 测试标准

这意味着导入的结果天然就是一个**完整资产**。

### 3.2 编辑阶段
对方默认暴露的是用户能理解的字段：
- 风格图库
- 风格关键词
- 风格描述
- 测试标准

而不是先暴露 prompt 细则、解释策略、编排指令。

### 3.3 使用阶段
对方使用前会先做测试：
- 选模型
- 选比例 / 张数
- 填测试标准
- 直接出验证结果

因此用户对风格库的信任来自“可视化回归结果”，不是来自抽象说明。

### 3.4 结果层
最终输出的统一性强，说明它的风格库不是单次 prompt 拼出来的，而是经过：

参考图集 → 风格归纳 → 风格描述 → 测试样例 → 出样验证

---

## 4. 当前项目的核心差距

### P0：数据模型差距
当前 [`WorkspaceStyleLibrary`](../../types/common.ts:52) 仍然缺少：
- 参考图集
- 风格关键词
- 风格描述层与测试样例层的分离
- 测试结果记录
- 分类 / 类型建模
- 版本对比与回归字段

现状更像“规则对象”，不是“风格资产包”。

### P0：导入闭环差距
当前导入主要依赖：
- [`buildCaseLibrary()`](../../services/gpt-image-style-library-import.ts:142)
- [`buildTemplateLibrary()`](../../services/gpt-image-style-library-import.ts:201)
- [`normalizeImportedLibrary()`](../../services/gpt-image-smart-import.ts:326)

这些实现已经能把素材转成结构化风格规则，但仍缺：
- 标准测试样例生成
- 导入后立即验证
- 导入结果的视觉回归确认

### P0：产品入口差距
当前风格库主要挂在：
- [`TreePromptToolbar`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:1228)
- [`TreePromptStyleLibraryModalV2`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:505)

这让风格库被用户感知为“节点设置项”，而不是“独立可经营资产”。

### P1：编辑语义差距
当前主编辑区仍偏向：
- 参考图解释方式
- 规划指令
- Prompt 指令

对普通用户不够自然。真正适合作为主编辑项的应该是：
- 图集
- 关键词
- 描述
- 适用场景
- 测试标准

### P1：验证机制差距
当前没有每个风格库自己的：
- 默认测试 prompt 集
- 默认测试模型 / 比例 / 张数
- 最近测试结果图
- 测试时间
- 是否达标标记

### P2：运行时叠加表达差距
虽然当前已经做了运行时附加层分离，例如：
- [`buildEffectiveStyleLibrary()`](../../pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts:182)
- [`buildEffectiveRuntimeStyleLibrary()`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:363)

但对用户的表达还不够自然。用户不应该理解 overlay 技术名词，而应该理解：
- 当前风格
- 本次微调
- 保存为新风格

---

## 5. 产品定义升级

### 5.1 新定义
风格库应被重新定义为：

> 一组围绕特定视觉语言沉淀出的可复用资产，包含参考图集、语义描述、生成控制、验证样例和测试结果，能够被稳定应用到后续任务中。

### 5.2 与当前系统的关系
- 风格库：长期资产层
- 运行时附加层：本轮临时补充层
- 编排器：执行规划层
- 最终 prompt：消费层

也就是：

正式风格资产 → 本轮临时微调 → 任务编排 → 最终生成

而不是：

风格库 ↔ 编排器互相改写

---

## 6. 新信息架构

### A. 风格资产层
每个风格库至少包含：
- 标题
- 类型 / 分类
- 标签
- 封面
- 参考图集
- 创建人
- 更新时间
- 版本号

### B. 风格语义层
面向用户表达：
- 风格关键词
- 风格描述
- 适用场景
- 不适用场景
- 风险提示

### C. 生成控制层
面向系统消费：
- 参考图解释方式
- `planningDirectives`
- `promptBackbone`
- `promptDirectives`
- 可选高级规则

### D. 验证层
面向回归：
- 标准测试样例列表
- 默认测试模型
- 默认比例 / 张数
- 最近测试结果图
- 最近测试时间
- 达标状态

### E. 运行时微调层
不进入正式资产默认主结构，仅作为当前任务临时层存在：
- 本轮补充摘要
- 本轮补充指令
- 本轮补充 backbone
- 本轮测试结果（如果用户触发）

---

## 7. 哪些功能应进入二级入口，避免首页堆叠
以下内容不要放在风格库默认主面板第一屏：
1. 高级 prompt 指令明细
2. 运行时附加层原始差异
3. 覆盖当前正式风格库的危险操作
4. 调试 trace / 编排内部细节

这些应进入：
- 高级设置折叠区
- 二级抽屉
- 测试结果详情区
- 版本对比区

---

## 8. 新用户流程

### 8.1 导入流程
1. 上传一组同风格参考图
2. 选择导入类型：
   - 抽象风格
   - 强迁移预设
   - 编辑模板
3. AI 自动生成：
   - 风格关键词
   - 风格描述
   - 适用场景
   - 测试样例
4. 用户确认后进入测试
5. 测试结果通过后再保存为正式风格库

### 8.2 编辑流程
默认编辑区：
- 图集
- 关键词
- 描述
- 测试标准

高级设置区：
- 参考图解释方式
- prompt backbone
- prompt directives
- 系统消费级规则

### 8.3 使用流程
1. 先看风格库卡片与最近测试结果
2. 选择风格库应用到当前节点
3. 本轮如有运行时微调，可提示：
   - 保持仅本轮生效
   - 保存为新风格库
   - 覆盖更新已有风格库（危险操作，需确认）

### 8.4 验证流程
每个风格库必须支持：
- 一键跑测试样例
- 查看测试结果图
- 对比本次与上次结果
- 标记“通过 / 未通过”

---

## 9. 落地到当前代码的改造方向

### Phase 1：计划与资产模型重定义
涉及文件：
- [`types/common.ts`](../../types/common.ts)
- [`services/runtime-assets/user-asset-types.ts`](../../services/runtime-assets/user-asset-types.ts)
- [`services/runtime-assets/local-user-assets.ts`](../../services/runtime-assets/local-user-assets.ts)
- [`services/runtime-assets/remote-user-assets.ts`](../../services/runtime-assets/remote-user-assets.ts)

动作：
1. 扩展风格库正式资产结构，补充图集、关键词、描述、测试样例、测试结果、分类字段
2. 保持现有运行时附加层结构，但不让其污染正式资产默认结构
3. 设计兼容迁移逻辑，保证旧风格库能自动升级

### Phase 2：导入链路重构
涉及文件：
- [`services/gpt-image-style-library-import.ts`](../../services/gpt-image-style-library-import.ts)
- [`services/gpt-image-smart-import.ts`](../../services/gpt-image-smart-import.ts)
- [`pages/GptImageInspiration.tsx`](../../pages/GptImageInspiration.tsx)

动作：
1. 导入结果从“规则对象”升级为“候选风格资产”
2. 新增关键词层、描述层、测试样例层
3. 导入完成后不直接视为最终资产，而先进入测试确认流程

### Phase 3：风格库中心与节点应用器拆分
涉及文件：
- [`pages/Workspace/components/WorkspaceTreePromptNode.tsx`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx)
- 可能新增独立风格库中心 UI 文件

动作：
1. 节点侧只保留“应用风格库”能力
2. 资产管理、导入、编辑、测试、版本维护迁入风格库中心
3. 当前 [`TreePromptStyleLibraryModalV2`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:642) 从规则编辑器转为资产型面板

#### 3.1 当前节点侧混杂的职责
当前 [`TreePromptToolbar`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:1959) 同时承担了两类职责：

**A. 节点应用器职责（应保留）**
- 在当前节点启用 / 停用风格库
- 在内置模式与自定义风格之间切换
- 选择一个已存在风格库应用到当前节点
- 清空当前节点上的正式风格库与运行时叠加
- 显示当前节点生效中的风格状态摘要

对应现有代码主要是：
- [`handleUseSelectedUserStyleLibrary()`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:2192)
- [`handleDisableStyleLibrary()`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:2204)
- [`handleSelectStyleLibraryMode()`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:2180)
- [`buildEffectiveRuntimeStyleLibrary()`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:500)

**B. 资产中心职责（应迁出）**
- 新建正式风格库
- 编辑正式风格库资产字段
- 删除用户风格库
- 批量删除风格库
- 将当前节点结果另存为正式风格库
- 维护测试样例与最近验证结果
- 后续的版本比较、测试回归、验证状态维护

对应现有代码主要是：
- [`applyStyleLibraryDraft()`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:2062)
- [`seedCustomStyleLibrary()`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:2092)
- [`handleSaveStyleLibraryAsAsset()`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:2120)
- [`handleDeleteSelectedUserStyleLibrary()`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:2160)
- [`handleEditSelectedUserStyleLibrary()`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:2212)
- [`TreePromptStyleLibraryModalV2`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:642) 内的大量资产编辑 / 测试编辑 UI

#### 3.2 拆分后的目标边界
**节点应用器应缩到最小：**
- 看当前节点正在使用哪套风格
- 搜索 / 选择 / 应用风格库
- 切换“无约束 / 内置 / 自定义”
- 对本轮运行时微调做“仅本次保留 / 另存为新风格库”这样的轻量决策

**风格库中心应成为独立资产入口：**
- 新建、导入、编辑、删除、批量管理风格库
- 维护图集、关键词、描述、适用场景、风险提醒
- 维护测试样例、最近结果、验证状态
- 后续承接版本对比、回归测试、结果复跑

#### 3.3 对当前实现的直接要求
1. [`showStyleLibraryPicker`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:1960) 对应弹层不再承载完整资产编辑器
2. [`isEditingStyleLibrary`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:1961) 后续应只在风格库中心内部使用，而不是节点工具条状态
3. 节点侧“存为正式风格库”保留为跳转 / 唤起资产中心的快捷入口，不再在节点里完成全部资产编辑
4. 当前 [`TreePromptStyleLibraryModalV2`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx:642) 应逐步收缩成“选择器 + 当前状态 + 快捷操作”

### Phase 4：测试标准与回归机制
涉及文件：
- 风格库中心 UI
- 测试执行与结果存储相关逻辑
- 可能新增测试记录类型文件

动作：
1. 每个风格库支持保存 3~5 条标准测试样例
2. 每次编辑后可一键重新验证
3. 保存最近测试结果缩略图、时间与状态
4. 支持版本间对比

### Phase 5：运行时微调产品表达优化
涉及文件：
- [`pages/Workspace/components/WorkspaceTreePromptNode.tsx`](../../pages/Workspace/components/WorkspaceTreePromptNode.tsx)
- [`pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts`](../../pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts)

动作：
1. UI 术语从“runtime overlay”改成“本次微调”
2. 显式提供：
   - 仅本次使用
   - 保存为新风格库
   - 更新已有风格库
3. 继续保留当前底层治理边界，不回退到自动持久化

---

## 10. 关键治理原则
1. 正式风格库是长期资产，不是本轮 prompt 草稿
2. 运行时微调默认只对本轮生效
3. 编排器只可补充，不可静默篡改正式资产
4. 风格库必须可测试、可回归、可比较
5. 节点应用入口应轻量，资产经营入口应独立
6. 面向用户默认展示创作语言，面向系统的高级规则折叠展示

---

## 11. 验收标准
满足以下条件才算通过：
1. 用户可通过图集导入得到一个完整风格资产，而不是只有规则文本
2. 每个风格库都支持测试样例与结果验证
3. 用户在应用前能看到该风格库最近测试效果
4. 用户在节点中应用风格库时，不需要理解内部 overlay 概念
5. 本轮临时微调不会自动改写正式风格资产
6. 用户可以明确把本轮微调另存为新风格库
7. 风格库默认编辑区不再以系统术语为主
8. 导入、编辑、使用、验证形成闭环

---

## 12. 实施顺序
1. 先完成本计划文档升级，统一产品定义
2. 再重构风格库资产数据结构
3. 再重构导入结果结构与测试样例生成
4. 再拆分资产中心与节点应用器
5. 再补测试回归与版本机制
6. 最后做统一构建、回归与体验校准

---

## 13. 一句话总结
本次重构目标不是继续修补“风格库规则怎么传进 prompt”，而是把风格库从生成链路里的一个约束对象，升级成真正能被用户经营、验证、复用和信任的风格资产产品。
