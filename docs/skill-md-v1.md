# SKILL.md v1

## 目标

这一版规范服务于侧边栏 `skill` 的 MVP：

- 先做到主流 AI 设计网站常见的侧边栏 `chat + skill` 体验
- 让每个 skill 都有一个清晰、可读、可编辑的本体文件
- 避免把同一个 skill 的名称、路由、补问策略、能力列表拆散到多个文件或代码片段里

这一版**不**解决版本治理、审计、回放、RBAC、发布审批。后续若需要，再在 v1 的基础上扩展。

## 目录约定

每个 skill 使用一个独立目录，目录名就是 skill 的机器标识：

```text
studio-skills/
  poster-design/
    SKILL.md
```

v1 只要求一个文件：

- `studio-skills/<skill-id>/SKILL.md`

允许存在的可选目录：

- `references/`
- `assets/`
- `scripts/`

但这些都只能作为补充资源使用，**不能替代 `SKILL.md` 成为主事实源**。

## 单一事实源

`SKILL.md` 是 skill 的唯一主文件，负责同时承载：

- 侧边栏展示需要的元数据
- skill 触发和运行时 adapter 需要的基础配置
- 人类可直接阅读和编辑的工作流说明

以下内容不应只存在于其他文件中：

- skill 名称
- skill 用途
- 触发场景
- 路由意图
- 跟进模式
- 补问清单
- 核心能力
- 输入/输出预期

## 文件结构

`SKILL.md` 使用两段结构：

1. YAML frontmatter
2. Markdown 正文

示例：

```md
---
id: poster-design
title: 海报设计
description: 用于海报创意、主视觉方向、版式建议和执行方案。用户提到海报、KV、主视觉、宣传图、活动视觉时优先使用。
category: branding
status: active
mode: skill
icon: Sparkles
route_intent: branding
follow_up_mode: auto-clarify
abilities:
  - generateImage
  - generateCopy
clarify_checklist:
  - 品牌调性
  - 使用场景
  - 尺寸规格
inputs:
  - 品牌名或活动名
  - 目标受众
  - 文案或卖点
outputs:
  - 海报方向
  - 版式建议
  - 执行建议
---

# 海报设计

## Purpose
...
```

## Frontmatter 字段

### 必填字段

- `id`
  - 机器标识
  - 只允许小写字母、数字、连字符
  - 必须与目录名一致
- `title`
  - 侧边栏显示名
- `description`
  - 一句话说明 skill 做什么，以及什么场景应该触发
- `category`
  - 当前建议值：`branding` `commerce` `social` `video` `general`
- `status`
  - 当前建议值：`active` `draft` `disabled`
- `mode`
  - 当前建议值：`skill` `workflow` `agent`
- `route_intent`
  - 当前建议值：`branding` `commerce` `social` `video` `general`
- `follow_up_mode`
  - 当前建议值：`auto-clarify` `direct-run`

### 推荐字段

- `icon`
  - 侧边栏图标名，例如 `Sparkles` `Library` `Lightbulb`
- `abilities`
  - skill 倾向调用的能力列表
- `clarify_checklist`
  - 需要补问时优先检查的字段
- `inputs`
  - 理想输入
- `outputs`
  - 预期输出

### 暂不进入 v1 的字段

以下能力先不写进 v1 规范，避免一开始做得过重：

- 版本号
- 审批状态
- 发布状态
- 回滚指针
- trace 配置
- audit 配置
- 复杂 fallback 策略
- 执行图节点定义

## 正文章节建议

v1 推荐正文保持短而清楚，优先这几段：

- `# <标题>`
- `## Purpose`
- `## When to Use`
- `## Inputs`
- `## Workflow`
- `## Output`
- `## Boundaries`
- `## Example Prompts`

说明：

- frontmatter 用于机器读取和侧边栏展示
- 正文用于人类编辑和 agent 执行时理解流程
- 不要求写很长，重点是直接、可维护

## 侧边栏读取规则

侧边栏 v1 推荐只做这几件事：

1. 扫描 `studio-skills/*/SKILL.md`
2. 读取 frontmatter
3. 读取正文标题与摘要段落
4. 生成 skill 列表与详情
5. 选中 skill 后，把 frontmatter 映射为当前运行时 adapter 需要的配置

当前不建议：

- 从多个地方拼接一个 skill
- 动态推导 skill 身份
- 把 skill 的关键字段散落在 preferences、message skillData、硬编码表里分别维护

## 设计原则

### 1. 单文件优先

先让人能直接打开 `SKILL.md` 看懂和修改，再谈平台能力。

### 2. 对人可读

不要把 skill 写成只有程序能理解的复杂 DSL。v1 优先自然语言和少量结构化字段。

### 3. 对侧边栏可解析

即使正文是自然语言，frontmatter 也必须足够稳定，方便列表展示、筛选和运行时映射。

### 4. 避免多源真相

如果 `SKILL.md` 已经定义了某个字段，就不要再在其他配置文件中单独维护第二份同义值。

### 5. 先体验，后治理

先把“能看懂、能选中、能清楚退出、能稳定复用”做好，再做版本治理和审计。

## v1 适用范围

这套格式优先适用于：

- 海报设计
- 品牌视觉
- 电商详情页
- 社媒内容
- 视频脚本/分镜方向

也就是当前侧边栏里最像“主流 AI 设计网站 skill” 的前台场景。
