# Workspace 生图链路重构实施计划

## 目标

- 把当前 `XC-STUDIO` 的生图链路从“多入口、多层改写、难排障”的状态，收敛成“单一图片接口层 + 单一请求快照 + 可追踪 + 可测试”的稳定结构。
- 优先解决：出了问题看不清到底发了什么、不同入口行为不一致、修一个入口坏另一个入口。

## 实施批次

### 批次 1：统一请求快照与观测

#### 文件

- `types/image-generation.types.ts`
- `services/image-generation/request-trace.ts`
- `pages/Workspace/browserAgentGenerationTrace.ts`
- `services/gemini.ts`
- `services/providers/types.ts`
- `services/providers/gemini.provider.ts`
- `services/skills/image-gen.skill.ts`
- `types/skill.types.ts`
- `pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts`

#### 目标

- 给每次生图生成统一的用户请求快照与传输请求快照。
- 让工作台 trace 能同时看到：用户想发什么、系统实际发了什么。
- 修复 `onSubmitted` 没有稳定透传到底层 provider 的链路缺口。

#### 验收

- 单图生成时，trace 中可以看到：
  - `userRequestSnapshot`
  - `transportRequestSnapshot`
- `onSubmitted` 能带回：
  - `taskId`
  - `providerId`
  - `baseUrl`
  - `model`
  - `route`
  - `transportRequestSnapshot`

### 批次 2：抽离统一图片 API 层

#### 目标

- 从 `services/gemini.ts` 中拆出图片协议层。
- 建立统一图片请求领域模型。

#### 计划文件

- `services/image-generation/core/request-normalizer.ts`
- `services/image-generation/core/request-router.ts`
- `services/image-generation/core/request-builder.ts`
- `services/image-generation/core/response-parser.ts`
- `services/image-generation/core/transport-runner.ts`
- `services/image-generation/index.ts`

### 批次 3：统一所有生图入口

#### 优先级

1. `pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts`
2. `services/skills/image-gen.skill.ts`
3. `pages/Workspace/controllers/useWorkspaceSmartGenerate.ts`
4. `pages/Workspace/controllers/useWorkspaceProductSwap.ts`
5. `pages/Workspace/controllers/useWorkspaceElementEditActions.ts`

### 批次 4：消除静默改写与降级

#### 重点

- 比例 fallback 显式记录
- 模型归一化显式记录
- 尺寸 fallback 显式记录
- edit payload 模式显式记录

### 批次 5：补测试矩阵

#### 覆盖项

- 文生图 JSON
- 单参考图 edit
- 多参考图 edit
- mask edit
- `b64_json`
- URL 返回
- SSE partial image
- polling success / failure
- timeout / abort
- 工作台 trace 完整性

## 当前批次执行顺序

1. 落统一类型
2. 落统一 trace helper
3. 扩展工作台 trace 结构
4. 接入 `requestOpenAICompatibleImage()`
5. 接入工作台主入口
6. 构建验证
