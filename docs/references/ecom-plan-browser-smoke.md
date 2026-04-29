# 电商方案规划真实前台验收

这套脚本用于在真实浏览器页面环境里跑一轮电商工作流验收，当前验收边界是：

1. 真实执行 `ecomGeneratePlansSkill`
2. 在规划结果基础上继续执行提示词改写
3. 验到“提示词准备完成”为止
4. 不执行最终生图

这样可以验证“方案规划 -> 批量提示词准备”这条主链路是否真实可用，同时避免把高成本生图也绑进日常验收。

## 目的

- 复用前台浏览器环境中的 provider 配置逻辑
- 优先复用当前真实工作台会话缓存，而不是只跑内置样例
- 验证方案规划阶段是否还会出现空话、短句、空结果或质量闸门误杀
- 验证提示词批量准备是否能完整走通，并产出可继续人工审核的最终提示词草稿

## 前置条件

1. 本地开发服务器已启动，默认地址为 `http://localhost:3001`
2. Chrome 默认用户数据里已经保存过 Jacky-Studio / JK 的 `yunwu_api_key`
3. 如果希望读取“当前工作台真实会话”，本地浏览器里最好已经产生过 `jkstudio:ecom-oneclick:*` 缓存
4. 为了兼容历史数据，脚本也仍会回读旧的 `xcstudio:ecom-oneclick:*` 缓存

## 运行方式

在仓库根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-ecom-plan-browser-smoke.ps1
```

如果本地前台地址不是默认值，可以传入：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-ecom-plan-browser-smoke.ps1 -AppUrl "http://localhost:3001/workspace/plan-smoke"
```

## 脚本做了什么

1. 在 `tmp/playwright-runner` 安装临时 Playwright 运行时，不污染项目主依赖
2. 从 Chrome 默认 `Local Storage\leveldb` 复制快照到临时目录
3. 从快照里提取可用的 `yunwu_api_key`
4. 用 Playwright 打开真实前台页面
5. 在页面初始化时写入 `api_provider`、`api_providers`、`yunwu_api_key`
6. 优先读取当前浏览器里最新一份 `jkstudio:ecom-oneclick:*` 本地缓存，并组装真实会话 payload
7. 如果只有历史缓存，则自动回读 `xcstudio:ecom-oneclick:*`
8. 如果当前没有可用缓存，则退回内置 smoke payload
9. 在浏览器页面里直接 `import('/services/skills/ecom-oneclick-workflow.skill.ts')`
10. 调用 `ecomGeneratePlansSkill` 生成真实方案规划结果
11. 基于每个方案项调用 `ecomRewritePrompt`，批量准备最终可编辑提示词
12. 到“提示词准备完成”为止停止，不触发最终生图
13. 将结果落盘到 `tmp/plan-smoke` 目录

## 输出文件

- `tmp/plan-smoke/latest-result.json`
  真实规划结果与规划阶段 review
- `tmp/plan-smoke/latest-prompts.json`
  每个方案项对应的提示词准备结果，验收到这里即算通过
- `tmp/plan-smoke/latest-summary.json`
  便于快速验收的摘要信息，包含规划结果和 `promptPreparation`
- `tmp/plan-smoke/latest-debug.json`
  前台调试信息与模型接口返回快照，已做密钥脱敏

## 通过标准

满足以下条件即可认为这轮 smoke 通过：

1. `summary.groupCount > 0`
2. `summary.totalItems > 0`
3. `promptPreparation.totalJobs > 0`
4. `promptPreparation.preparedJobs === promptPreparation.totalJobs`
5. `promptPreparation.failedJobs === 0`

## 边界说明

- 这个 smoke 现在明确只验收到“提示词准备完成”
- 最终生图不在自动验收范围内，避免额外消耗
- 生图是否执行、执行哪一批，由人工在前台确认后再操作

## 注意

- 脚本不会把 API key 写入仓库文件
- 脚本只在临时目录复制 Chrome Local Storage 快照，不会改动浏览器原始文件
- 如果结果为空，先看 `latest-result.json` 和 `latest-debug.json`，不要再退回“假装成功”的兜底逻辑
- `latest-summary.json` 会标明本次使用的是 `page-local-cache`、`snapshot-local-cache` 还是 `built-in-smoke-payload`
- 真实 payload 较大时，整轮运行时间可能明显变长，属于正常现象
