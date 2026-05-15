# Workspace 项目转图床与账号同步产品级落地方案

日期：2026-05-15  
状态：方案确认稿  
范围：旧项目一键转图床、图床可用性门禁、侧边栏引用兼容、`mark` 兼容、项目随账号同步、远端恢复与冲突治理

---

## 1. 这份文档解决什么问题

当前仓库里已经有两块相关能力，但它们还没有真正拼成一个可用的成品：

1. 已有“用户资产层同步”
   - 用户偏好、角色、风格库、主脑配置等，已经可以通过 `StudioUserAsset` 层同步到账号。
2. 已有“本地持久图片资产”
   - 画布图片并不只是临时 `blob:`，很多链路已经会落到 `jk-topic-asset://...` 这套本地持久资产体系。
3. 还没有“项目级远端同步闭环”
   - 项目主体依然是本地 IndexedDB 存储。
4. 还没有“旧项目一键转图床并安全升级为可同步项目”的完整产品流程。

用户现在真正需要的不是“又多一个同步按钮”，而是下面这套完整能力：

1. 旧项目可以一键扫描并升级。
2. 只有图床真实可用时，才自动把项目资源转成可跨设备使用的远端链接。
3. 图床不可用时，仍然保留原本本地链路，不把项目做坏。
4. 侧边栏聊天、图片引用、`mark` 引用、预览图、主脑识别都不能因为资源从本地变成远端而失效。
5. 项目能够真正跟随账号，在新设备恢复，而不是只同步“用户设置”。

这份文档的目标是把这件事定义成“完整产品级落地方案”，而不是最小可跑版本。

---

## 2. 当前现状与边界

## 2.1 已经具备的基础

### A. 本地项目存储

- 项目主体仍保存在 `services/storage.ts` 的 `projects` store。
- `saveProject()` 负责把项目快照写回本地 IndexedDB。

### B. 本地持久图片资产

- `services/topic-memory.ts` 已有 `TopicAsset`、`AssetRef`、`buildTopicAssetUrl()`、`resolveStoredTopicAssetUrl()`。
- 当前很多图片链路已经不再只依赖瞬时 `blob:`，而是先转进 `jk-topic-asset://...`。

### C. 账号资产同步

- `services/runtime-assets/account-sync.ts`
- `services/runtime-assets/sync-service.ts`
- `api/account-sync.ts`

这套能力已经覆盖用户资产层，但还没有覆盖项目文档层。

## 2.2 当前最关键的产品缺口

### P0 缺口 1：侧边栏附件补水链路不完整

`pages/Workspace/controllers/useWorkspaceSend.ts` 里的 `hydrateCanvasAttachmentFile()` 当前只优先尝试：

1. `_chipPreviewUrl`
2. `getElementSourceUrl(...) || element.url`

它没有系统性补下面几种来源：

1. `persistedOriginalUrl`
2. `jk-topic-asset://...` 对应的本地持久资产解析
3. 已转图床后的远端 `hostedUrl`

这意味着一旦未来项目里同一张图不再只表现为本地 `blob:`，侧边栏引用链路就可能出现漏识别、拉取失败、附件为空壳的问题。

### P0 缺口 2：项目跟随账号同步尚未真正落地

当前能同步到账号的是 `StudioUserAssetState`，不是项目文档。

缺的不是一个按钮，而是整套：

1. 项目索引
2. 项目快照
3. 资源清单
4. 同步门禁
5. 冲突处理
6. 恢复策略

### P0 缺口 3：不能用“远端 URL 直接替换本地链路”这种粗暴方式

如果把现有本地资源引用全部直接覆盖成图床 URL，会带来几个严重问题：

1. 图床失效时项目直接残废。
2. 旧侧边栏引用链路可能认不出图片来源。
3. `mark` 的 `fullImageUrl` 可能失去可恢复父图。
4. 用户离线使用、弱网使用、本地即时预览会退化。
5. 同一资源重复上传、重复改写的成本会失控。

结论：不能把“转图床”设计成“把本地链路抹掉”，必须做双轨资产模型。

---

## 3. 产品原则

1. 本地链路永远保底。
2. 图床链路是增强层，不是替代层。
3. 项目是否可同步，取决于“资源是否可远端恢复”，而不是“表面上有没有 URL”。
4. 旧项目迁移必须可扫描、可预览、可重试、可回退。
5. 侧边栏识别链路必须先补强，再做大规模转图床。
6. `mark` 预览必须始终能拿到父图，不允许只剩裁切框元数据。
7. 同步门禁必须真实，不允许假通过。
8. 远端同步与本地图床迁移是相关能力，但不是同一层职责。

---

## 4. 目标架构

## 4.1 双轨资源模型

核心设计：同一张图片资源同时允许存在两种可解析来源。

### 本地保底链路

- `blob`
- `data:`
- `jk-topic-asset://...`
- `persistedOriginalUrl`

### 远端增强链路

- 图床 `hostedUrl`
- 图床校验状态
- 图床 provider 元数据
- 上传校验与错误信息

最终原则不是二选一，而是：

1. 本地优先保活。
2. 远端用于跨设备恢复与账号同步。

## 4.2 建议扩展的数据字段

建议扩展 `TopicAsset`，而不是只改画布元素上的零散字段。

建议新增字段：

```ts
type TopicAssetHostedState =
  | "pending"
  | "uploaded"
  | "verified"
  | "failed"
  | "stale";

type TopicAsset = {
  assetId: string;
  memoryKey: string;
  topicId: string;
  role: TopicAssetRole;
  mime: string;
  url?: string;
  blob?: Blob;
  width?: number;
  height?: number;
  createdAt: number;

  hostedUrl?: string;
  hostedProvider?: string;
  hostedStatus?: TopicAssetHostedState;
  hostedChecksum?: string;
  hostedUploadedAt?: number;
  hostedLastVerifiedAt?: number;
  hostedError?: string | null;
  sourceKind?: "upload" | "generated" | "imported" | "marker-parent" | "derived";
  sizeBytes?: number;
};
```

必要时也可给 `AssetRef` 增加轻量投影字段，但单一事实来源仍建议放在 `TopicAsset`。

## 4.3 统一解析器，而不是每个入口各自猜 URL

需要新增一个共享解析器，例如：

`services/runtime-assets/asset-resolution.ts`

提供统一能力：

1. `resolveWorkspaceAssetForDisplay()`
2. `resolveWorkspaceAssetForAttachment()`
3. `resolveWorkspaceAssetForSync()`
4. `resolveWorkspaceMarkerParentImage()`

解析优先级建议统一为：

1. 显式本地预览 `blob:` / `_chipPreviewUrl`
2. `persistedOriginalUrl`
3. `jk-topic-asset://...` 对应的本地持久资产
4. `hostedUrl`
5. `element.originalUrl`
6. `element.url`

这样可以避免当前“不同模块各自找图，顺序还不一致”的隐患。

---

## 5. 侧边栏与 mark 兼容要求

## 5.1 侧边栏聊天引用必须兼容三种图片来源

侧边栏引用图片不能只假设“它是本地 `File`”。

它必须兼容：

1. 纯本地临时图
2. 本地持久资产图
3. 已转图床的远端图

因此 `hydrateCanvasAttachmentFile()` 需要升级成：

1. 优先补成本地 `Blob/File`
2. 补不到时，再走远端 URL 拉取
3. 若远端可拉但本地无原始数据，也要生成可发送 `File`
4. 若图片是 `mark` 子引用，则优先回溯父图再裁切

## 5.2 `mark` 兼容不能只存一个 `fullImageUrl`

当前 `markerInfo.fullImageUrl` 只是一个结果字段，不够稳。

建议补成“父图可恢复描述”：

```ts
type WorkspaceMarkerInfo = {
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
  fullImageUrl?: string;

  parentAssetId?: string;
  parentPersistedUrl?: string;
  parentHostedUrl?: string;
};
```

真正解析时按顺序尝试：

1. `parentPersistedUrl`
2. `parentAssetId -> TopicAsset`
3. `parentHostedUrl`
4. `fullImageUrl`

这样即使某个展示字段失效，也不至于让标记引用彻底丢父图。

## 5.3 侧边栏识别链路的硬性验收

以下场景必须全部成立：

1. 旧本地项目未转图床时，侧边栏引用图片正常。
2. 新项目启用图床但本地链路仍保留时，侧边栏引用图片正常。
3. 旧项目转图床后，侧边栏引用图片正常。
4. `mark` 引用在以上三种场景下都能正常展示父图与局部裁切。

---

## 6. 一键转图床功能的完整产品定义

## 6.1 入口定位

不建议把“转图床”藏进纯设置页。

建议在用户中心与项目内都保留入口，但职责不同：

### 用户中心入口

负责：

1. 查看哪些项目有本地资源风险。
2. 对旧项目批量发起扫描或迁移。
3. 查看全局图床可用性。

### 项目内入口

负责：

1. 查看当前项目是否已满足可同步条件。
2. 发起当前项目的一键转图床。
3. 查看失败资源并重试。

## 6.2 迁移前门禁

只有同时满足以下条件，才允许进入“自动转图床”：

1. 图床功能已开启。
2. 当前 provider 不是 `none`。
3. key 格式校验通过。
4. 真实上传测试通过。
5. 上传后的远端 URL 在浏览器端可重新拉取。

注意：只校验 key 是否存在完全不够，必须校验“浏览器侧可用性”。

## 6.3 迁移扫描范围

不能只扫描项目 JSON。

必须同时扫描：

1. `projects` store 里的项目内容
2. `topic_assets` store
3. 消息附件元数据
4. `mark` 父图引用
5. 节点字段中的 `url` / `originalUrl` / `persistedOriginalUrl`
6. 任务结果引用、消息附件引用、预览封面引用

否则会出现“项目主体看起来已转完，但侧边栏附件和标记图还挂着本地地址”的假完成状态。

## 6.4 迁移执行流程

建议拆成四阶段：

### 阶段 A：预扫描

输出：

1. 待迁移资源数
2. 可直接跳过资源数
3. 已有远端资源数
4. 高风险引用数
5. 预计失败项

### 阶段 B：上传与校验

对每个资源：

1. 读取本地原图
2. 计算 checksum
3. 查重命中则直接复用既有 `hostedUrl`
4. 未命中则上传
5. 取回远端 URL
6. 浏览器侧 `fetch` 校验可访问性
7. 回写 `TopicAsset.hosted*` 元数据

### 阶段 C：引用重建

不是“删本地、改远端”，而是：

1. 保留本地持久引用
2. 给资源补上远端 hosted 元数据
3. 重建项目中的可恢复指针
4. 修复 `mark` 父图关联

### 阶段 D：迁移后复检

再次扫描：

1. 是否仍有只能本地恢复的关键资源
2. 是否仍有未补 host 元数据的引用
3. 是否达到“项目可同步”门禁

如果没有完全通过，就不能把项目标记成“可账号同步”。

## 6.5 失败与重试

必须支持：

1. 全量重试
2. 失败项重试
3. 单项目重试
4. 单资源重试

失败信息至少要记录：

1. 资源来源
2. 资源角色
3. 失败阶段
4. 错误原因
5. 最近一次尝试时间

---

## 7. 项目随账号同步的完整产品定义

## 7.1 与用户资产同步分层

建议坚持分层，不要把项目同步继续塞进 `/api/account-sync`。

推荐新增单独项目域：

1. `/api/account-projects`
2. `/api/account-projects/:projectId`
3. `/api/account-projects/:projectId/snapshots`
4. `/api/account-projects/:projectId/pull`
5. `/api/account-projects/:projectId/push`

原因很简单：

1. 数据体量不同
2. 冲突模型不同
3. 审计需求不同
4. 可同步门禁不同

## 7.2 远端数据结构建议

至少拆两层：

### A. 项目索引表

责任：

1. 项目列表展示
2. 同步状态摘要
3. 风险状态摘要
4. 最后同步时间

建议字段：

- `user_id`
- `project_id`
- `title`
- `cover_url`
- `sync_ready`
- `sync_status`
- `asset_manifest_summary`
- `remote_revision`
- `last_synced_at`
- `created_at`
- `updated_at`

### B. 项目快照表

责任：

1. 保存完整项目快照
2. 保存资源清单
3. 为远端恢复提供单一来源

建议字段：

- `user_id`
- `project_id`
- `revision`
- `snapshot_json`
- `asset_manifest_json`
- `created_at`

## 7.3 同步门禁

项目只有满足以下条件才能推送远端：

1. 项目结构可序列化。
2. 关键图片资源都能跨设备恢复。
3. 图床校验状态通过。
4. 迁移复检通过。
5. 没有处于“未解决失败”的 hosted 资源。

## 7.4 新设备恢复逻辑

新设备拉取项目后，不应该假设本地一定有图片缓存。

恢复逻辑应为：

1. 先恢复项目文档
2. 根据 `asset_manifest_json` 恢复资源引用
3. 优先取 `hostedUrl`
4. 成功后可按需回灌本地缓存
5. 若远端恢复失败，则明确标记资源异常，而不是静默空白

---

## 8. 数据迁移与去重策略

## 8.1 必须有 checksum 去重账本

否则这件事会很快退化成无用功：

1. 同一张图每次项目扫描都重新上传
2. 同一张图在多个项目里被重复上传
3. 同一张父图和多个 `mark` 关联图被错误当成独立资源重复上传

建议增加本地与远端双层 dedupe ledger：

- `checksum`
- `provider`
- `hostedUrl`
- `verifiedAt`
- `firstAssetId`
- `lastSeenAt`

## 8.2 资源角色不能丢

上传图床时要保留资源角色上下文，否则后续诊断会很痛苦。

至少保留：

1. 上传图
2. 生成图
3. 参考图
4. 结果图
5. `mark` 父图
6. 派生图

---

## 9. 分阶段实施建议

## Phase 1：先补齐解析链路与数据结构

目标：先保证“不管本地还是远端，画布和侧边栏都能稳定找回图”。

包含：

1. 扩展 `TopicAsset` hosted 字段
2. 增加统一资源解析器
3. 升级 `hydrateCanvasAttachmentFile()`
4. 升级 `mark` 父图恢复策略

这是整个方案的 P0 基座，必须先做。

## Phase 2：做项目级扫描、迁移、复检

目标：让旧项目可以真正一键升级。

包含：

1. 项目风险扫描器升级
2. 迁移任务执行器
3. 上传校验器
4. 失败清单与重试
5. 项目内迁移面板

## Phase 3：做项目随账号同步

目标：让项目真正跨设备恢复。

包含：

1. 项目索引表与快照表
2. push / pull / conflict API
3. 新设备恢复逻辑
4. 冲突弹窗与远端恢复 UI

## Phase 4：做批量治理与运维能力

目标：让这套东西长期可维护，而不是只在演示里能跑。

包含：

1. 批量迁移
2. 失败项追踪
3. hosted 链接定期复检
4. 资源孤儿清理
5. 诊断与审计日志

---

## 10. 明确不建议的做法

1. 不要把本地 `jk-topic-asset://...` 全部直接覆盖成图床 URL。
2. 不要只扫项目 JSON 而不扫 `topic_assets`。
3. 不要只校验图床 key 是否存在。
4. 不要把项目同步继续塞进现有用户资产同步接口。
5. 不要假设侧边栏只会处理本地 `File`。
6. 不要让 `mark` 只靠 `fullImageUrl` 单字段存活。
7. 不要在 hosted 失败时把项目错误标成“已可同步”。

---

## 11. 产品级验收标准

以下标准全部满足，才能算真正落地：

1. 未开启图床时，项目仍按原有本地链路正常工作。
2. 图床 key 无效时，不会误触发自动迁移。
3. 旧项目可以一键扫描，并看到明确迁移报告。
4. 旧项目迁移后，画布图片、侧边栏引用、`mark` 引用全部正常。
5. 同一项目在另一台设备登录账号后可恢复。
6. 某些 hosted 资源失效时，系统能给出可诊断状态，而不是静默白图。
7. 重复扫描同一项目不会重复上传绝大多数已处理资源。
8. 项目同步与用户资产同步彼此独立，不互相污染。

---

## 12. 与现有文档的关系

这份文档是以下两份文档的后续深化：

1. `docs/product/STUDIO_ACCOUNT_SYNC_PHASE1_BOUNDARY_20260507.md`
   - 它定义了“用户资产层同步”的边界。
   - 本文补上“项目层同步”和“项目资源可恢复性”的产品级闭环。
2. `docs/product/STUDIO_PROJECT_SYNC_ARCHITECTURE_20260508.md`
   - 它已经提出项目同步与转图床方向。
   - 本文进一步补齐了双轨资产模型、侧边栏兼容、`mark` 兼容、迁移扫描范围、验收标准。

---

## 13. 推荐立即执行的下一步

如果按真正可用产品来推进，建议实施顺序固定为：

1. 先补 `TopicAsset` hosted 元数据模型。
2. 再做统一资源解析器。
3. 再修 `hydrateCanvasAttachmentFile()` 与 `mark` 父图恢复。
4. 然后做项目扫描器升级。
5. 最后再做一键转图床与项目账号同步 UI。

原因很直接：如果解析链路没先补齐，后面越早做迁移，返工越大。
