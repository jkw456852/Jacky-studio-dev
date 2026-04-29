# Roo Code 项目协作配置

本仓库已经提供项目级 Roo Code 配置，重点服务当前 Jacky-studio-dev 的真实协作方式：

- 需求先澄清，再设计，再实现，再调试
- 电商工作流与 Workspace 链路优先
- 证据式调试，避免拍脑袋改代码
- 大仓库、脏工作区、很多备份文件并存时，优先主链路文件

## 已配置的自定义模式

### 通用项目模式

- `XC 调度官` (`xc-dispatcher`)
  - 先听你的话，判断应该切哪个角色，并给出可直接复制的下一句提示词
- `XC 产品经理` (`xc-pm`)
  - 用于整理目标、非目标、用户路径、阶段拆分、验收标准
- `XC 架构师` (`xc-architect`)
  - 用于给出最小可落地方案、文件边界、状态流和风险
- `XC 程序员` (`xc-coder`)
  - 用于实际改代码、补验证、控制改动范围
- `XC 调试员` (`xc-debugger`)
  - 用于复现问题、取证、定位根因、提出修复方向

### 电商专用模式

- `XC 电商架构师` (`xc-ecom-architect`)
  - 专门处理 ecommerce workflow 的步骤传导、竞品分析、planning context、UI 消费点
- `XC 电商调试员` (`xc-ecom-debugger`)
  - 专门处理 provider、payload、schema、fallback、controller/store/UI 链路排障

这些模式定义在项目根目录的 [`.roomodes`](/e:/ai网站/Jacky-studio-dev/.roomodes)。
通用项目规则在 [`.roo/rules/00-project-context.md`](/e:/ai网站/Jacky-studio-dev/.roo/rules/00-project-context.md) 和 [`.roo/rules/10-working-agreements.md`](/e:/ai网站/Jacky-studio-dev/.roo/rules/10-working-agreements.md)。
各模式专属规则位于 `.roo/rules-xc-*` 目录。

## 推荐使用顺序

### 通用开发任务

1. `XC 调度官`（如果你不想自己判断）
2. `XC 产品经理`
3. `XC 架构师`
4. `XC 程序员`
5. `XC 调试员`

### 电商工作流任务

1. `XC 调度官`（如果需求里混合了设计、实现、调试）
2. `XC 产品经理`
3. `XC 电商架构师`
4. `XC 程序员`
5. `XC 电商调试员`

如果任务非常复杂，可以先用 Roo 自带的 `Orchestrator` 做拆分，然后再切到上面这些项目模式。

## 调度官怎么用

当你不想自己判断该切哪个角色时，先用 `XC 调度官`。

它最适合做这些事：

- 根据你一句自然语言判断当前应由谁主导
- 区分这是需求整理、方案设计、代码实现还是调试排障
- 判断是不是电商工作流专用问题
- 给你一条可以直接复制给下一个角色的提示词

推荐问法：

```text
请用 XC 调度官模式，根据我下面这段话判断下一步该交给哪个角色，并帮我生成一条可直接复制的提示词。
```

如果是电商问题，也可以直接这样说：

```text
请用 XC 调度官模式，判断这个问题该交给 XC 电商架构师、XC 程序员还是 XC 电商调试员，并说明理由。
```

边界说明：

- `XC 调度官` 的重点是智能分流，不是替代所有角色
- 它会告诉你“下一步最适合谁做”
- 如果你明确说“你直接做”，它也可以先说明自己采用哪个角色视角，再继续执行

## 适合本项目的提问方式

### 1. 让产品经理整理任务

```text
请用 XC 产品经理模式，把“竞品逐图分析结果要明确影响步骤二推荐类型”整理成一份可执行需求，写清目标、非目标、验收标准和风险。
```

### 2. 让架构师先给方案

```text
请用 XC 架构师模式，基于当前 ecommerce workflow 链路，设计“逐图 raw 结果 -> 轻量竞品摘要 -> 步骤二 UI 可见影响”的最小实现方案。
```

### 3. 电商专用架构分析

```text
请用 XC 电商架构师模式，基于当前 competitor analysis / planning context / step2 UI 链路，设计最小方案，明确 controller 写入点、store 持久化点和 UI 消费点。
```

### 4. 让程序员实施

```text
请用 XC 程序员模式，按既定方案实现，不要改动无关备份文件。完成后告诉我改了哪些主文件、做了哪些验证。
```

### 5. 电商专用调试

```text
请用 XC 电商调试员模式，先复现“竞品多图分析返回空对象”的问题，区分是图床、provider、模型、payload、schema、controller、store 还是 UI 消费导致，并给出证据链。
```

## 交接模板

已补充固定交接模板，位于 [docs/templates](/e:/ai网站/Jacky-studio-dev/docs/templates)：

- [roo-pm-to-architect.md](/e:/ai网站/Jacky-studio-dev/docs/templates/roo-pm-to-architect.md)
- [roo-architect-to-coder.md](/e:/ai网站/Jacky-studio-dev/docs/templates/roo-architect-to-coder.md)
- [roo-coder-to-debugger.md](/e:/ai网站/Jacky-studio-dev/docs/templates/roo-coder-to-debugger.md)
- [roo-debugger-report.md](/e:/ai网站/Jacky-studio-dev/docs/templates/roo-debugger-report.md)
- [roo-task-template.md](/e:/ai网站/Jacky-studio-dev/docs/templates/roo-task-template.md)

推荐做法：

1. 新建一个任务文档到 `docs/product/` 或 `docs/testing/`
2. 复制对应模板
3. 切到对应 Roo 模式
4. 让它只填自己该填的部分

## 本项目下的额外建议

- 搜代码时优先排除 `*.bak*`、`codex-backup*`、`.tmp/`、`.jk-studio-runtime/`
- 调试竞品/电商链路时，多利用 `.jk-studio-runtime/*debug*` 作为证据
- 大改前先让 `XC 架构师` 或 `XC 电商架构师` 出方案，能明显减少回归和上下文漂移
- 出现“我记得之前是好的，后来坏了”这种情况，优先切 `XC 调试员` 或 `XC 电商调试员`

## 如果模式没有立即出现

通常只需要：

1. 重新加载 VS Code 窗口
2. 重新打开 Roo Code 面板
3. 确认当前工作区就是本仓库根目录 `Jacky-studio-dev`

## 后续可继续补的配置

如果你希望，后面还可以继续补：

1. 一个只做代码评审的 `xc-reviewer`
2. 一个只做文档落盘和项目归档的 `xc-doc-writer`
3. 按用户管理系统再分一套 `xc-usermgmt-architect` / `xc-usermgmt-debugger`

