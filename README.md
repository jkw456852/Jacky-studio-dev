# Jacky-studio-dev

<div align="center">

![version](https://img.shields.io/badge/version-active_dev-orange)
![React](https://img.shields.io/badge/React-19-61dafb)
![Vite](https://img.shields.io/badge/Vite-6.2-646cff)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6)
![license](https://img.shields.io/badge/license-MIT-green)

面向 AI 创作、视觉编排与工作区式生产流程的开发仓库。

</div>

---

## Overview

`Jacky-studio-dev` 是一个持续演进中的 AI 创作工作台，核心不是单一聊天界面，而是把对话、无限画布、树节点生成、Agent 侧边栏、视觉编排、图片/视频生成和运行时状态管理放进同一个 `Workspace`。

当前仓库已经包含：

- `Workspace` 主工作区与画布编辑体系
- 树节点提示词/图片生成链路
- 多供应商图片与视频模型接入
- 视觉任务规划、视觉编排与最小 runtime 壳子
- Browser Agent / Sidebar Agent 相关运行时与 UI
- 电商、服装、海报、包装等专项能力沉淀
- 本地项目持久化、历史恢复、主题记忆与运行时配置

## Current Focus

仓库当前的主要演进方向是：

- 让关键词节点生图从“一次 planner + 直接执行”升级为更真实的 visual agent runtime
- 把视觉任务拆成 `task plan -> generation plan -> generate -> observe -> reflect`
- 统一 Agent、工具、运行时设置和 Workspace 状态链路
- 逐步清理旧模块、旧变量和旧路由残留，减少新旧链路并存

## Key Areas

### 1. Workspace

- `pages/Workspace.tsx`
- `pages/Workspace/components/`
- `pages/Workspace/controllers/`

这里承接当前最核心的产品体验：画布、消息区、树节点、工具栏、生成状态、项目恢复、发送链路和多类编辑动作。

### 2. Vision Orchestrator

- `services/vision-orchestrator/`
- `pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts`

这一层负责视觉任务拆解、执行规划、页计划、研究决策、流式 thought 展示，以及最新接入的最小 visual runtime。

### 3. Agent System

- `services/agents/`
- `hooks/useAgentOrchestrator.ts`
- `pages/Workspace/components/AssistantSidebar.tsx`

这里负责侧边栏 Agent、路由、技能调用、结构化输出解析，以及逐步扩展中的 browser-agent 能力。

### 4. Provider Layer

- `services/gemini.ts`
- `services/providers/`
- `services/provider-settings.ts`

这一层统一管理模型兼容、鉴权模式、供应商路由、图片编辑/生成接口、视频接口和请求重试策略。

### 5. Runtime And Trace

- `services/runtime-settings/`
- `pages/Workspace/browserAgentGenerationTrace.ts`
- `pages/Workspace/browserAgentHost.ts`

这里负责运行时快照、生成 trace、会话状态与 Browser Agent 承接能力。

## Project Structure

```text
.
├─ api/
├─ components/
├─ docs/
├─ hooks/
├─ pages/
│  └─ Workspace/
├─ public/
├─ scripts/
├─ services/
│  ├─ agents/
│  ├─ browser-agent/
│  ├─ providers/
│  ├─ runtime-settings/
│  ├─ skills/
│  └─ vision-orchestrator/
├─ skills/
├─ stores/
├─ types/
├─ user-management/
├─ utils/
└─ XC-VIDEO/
```

## Local Development

### Install

```bash
npm install
cd XC-VIDEO
npm install
cd ..
```

### Run

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

### Existing Test Entry

```bash
npm run test:optimizer
```

## Suggested Reading

如果要快速接手当前仓库，建议按这个顺序看：

1. `docs/README.md`
2. `docs/standards/AI_DEVELOPMENT_STANDARD.md`
3. `docs/standards/工程协作规范.md`
4. `docs/product/UNIVERSAL_VISUAL_ORCHESTRATOR_AGENT_PLAN_20260427.md`
5. `pages/Workspace.tsx`
6. `pages/Workspace/controllers/useWorkspaceSend.ts`
7. `pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts`
8. `services/vision-orchestrator/`
9. `services/gemini.ts`
10. `services/agents/`

## Contributors

- [jkw456852](https://github.com/jkw456852)

## Repository

- GitHub: https://github.com/jkw456852/Jacky-studio-dev

## License

MIT
