# 更新记录

## 2026-04-27

### 1) 通用视觉编排层与模型设置
- 新增通用视觉编排层方案文档，明确后续按智能编排推进多参考图生图能力。
- 在总设置中补充视觉编排模型配置，为后续替换规划模型预留入口。
- 更新 AI 开发标准与工程协作规范，明确禁止在智能决策链路中引入静默兜底逻辑。

### 2) 关键词节点与生图链路优化
- 关键词节点新增风格库、质量档位与狂暴重试相关能力，并优化工具栏布局，减少拥挤和遮挡。
- 生图失败后的重试会尽量复用原失败图片节点，避免重复生成一串失败节点。
- 修复部分重试路由、令牌提示、节点状态恢复与刷新误判问题，提升连续生图稳定性。

### 3) 工作区交互与可视反馈优化
- 点击生图后立即创建子图片节点，并在节点内显示当前步骤状态，强化前台反馈。
- 新增生成状态卡组件，统一承载树节点和画布图片节点的加载态表现。
- 调整加载态波点与蒙版呼吸动画，使其更贴近预期的中心扩散效果。
- 新生成成功的图片节点支持高亮提示，下载逻辑改为直接触发下载而不是跳转图片地址。

### 4) 节点操作与画布行为修复
- 支持节点复制相关交互，并修复部分入口 UI 遮挡、框选区域异常与 Ctrl 标记误触问题。
- 修复多处因变量初始化顺序或遗漏引用导致的工作区崩溃问题。
- 优化狂暴模式节点与连线的视觉表现，增强生图中与已完成状态的区分度。

### 5) 关键文件
- `pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts`
- `pages/Workspace/controllers/useWorkspaceElementMutationHelpers.ts`
- `pages/Workspace/components/WorkspaceGenerationStatusCard.tsx`
- `pages/Workspace/components/WorkspaceTreePromptNode.tsx`
- `pages/Workspace/components/WorkspaceTreeImageNode.tsx`
- `pages/Workspace/components/WorkspaceCanvasImageElement.tsx`
- `pages/Settings.tsx`
- `services/gemini.ts`
- `services/provider-settings.ts`
- `services/vision-orchestrator/`
- `utils/download.ts`
- `docs/product/UNIVERSAL_VISUAL_ORCHESTRATION_PLAN_20260427.md`

## 2026-03-19

### 1) 重新生成入口与按钮语义修复
- 修复“右侧看不到重新生成”的问题：在画布右侧工具栏补充了“重新生成”入口。
- 修复“首次生成按钮被改成重新生成”的语义冲突：空白生图卡片保持“生成”，已生成内容使用“重新生成”。

### 2) 中文提示词与画面文案策略（全链路）
- 新增并打通以下策略字段（UI -> Workspace -> Agent -> Skill -> Provider -> Gemini）：
  - `promptLanguagePolicy`: `original-zh | translate-en`
  - `textPolicy`: `{ enforceChinese?: boolean; requiredCopy?: string }`
- 默认策略改为中文优先：`original-zh`。
- 在最终生图 prompt 组装处加入统一后处理：
  - 开启英译时，先将提示词翻译为英文；失败自动回退原文。
  - 统一追加文字渲染约束：
    - 可见文字优先/强制中文（按开关）
    - 可选“指定文案”精确匹配（不增删改写）

### 3) Agent 规则动态化（移除英文硬编码）
- `analyzeAndPlan` 的语言要求改为读取 metadata 动态判断，不再固定“prompt 必须英文”。
- 产品描述规则从“精确英文描述”调整为“精确视觉描述”。
- `executeSingleSkillCall` 对 `generateImage` 增加策略注入（仅在未显式指定时注入）：
  - `promptLanguagePolicy`
  - `textPolicy`

### 4) 输入区/画布工具栏开关落位优化
- 新增开关：`英译`、`中文字`、`指定文案`。
- 先后修复两类可见性问题：
  1. 底部输入栏空间不足导致开关不明显 -> 改为可换行。
  2. 画布浮层工具栏同一行过挤导致越界 -> 将三项开关拆成独立一行，底部参数行（模型/分辨率/比例/生成）保持不变。

### 5) 关键文件
- `stores/agent.store.ts`
- `pages/Workspace/components/InputArea.tsx`
- `pages/Workspace.tsx`
- `services/agents/enhanced-base-agent.ts`
- `types/skill.types.ts`
- `services/providers/types.ts`
- `services/skills/image-gen.skill.ts`
- `services/providers/gemini.provider.ts`
- `services/gemini.ts`

### 6) 校验
- 已多次执行 TypeScript 检查：`npx tsc --noEmit --pretty false`
- 结果：通过（无类型报错）
