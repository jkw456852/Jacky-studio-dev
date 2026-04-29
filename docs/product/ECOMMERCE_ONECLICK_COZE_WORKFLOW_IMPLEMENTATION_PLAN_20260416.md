# 电商一键工作流 Coze 原生复刻方案

Last updated: 2026-04-16  
Owner: Codex  
Scope: 直接在 Coze 内复刻现有电商一键工作流，不依赖现有网站前端驱动

## 1. 先澄清目标

这份方案针对的是：

1. 用户直接在 Coze Bot 内上传商品图、选择平台、填写补充信息
2. 工作流本身在 Coze 内推进阶段
3. 阶段状态、分组方案、批量任务、结果图都由 Coze 体系内维护
4. 不以“你们网站调用 Coze”作为前提

也就是说，这里要复刻的是你们当前工作流的业务结构和阶段逻辑，而不是复刻你们网站的 UI 抽屉。

## 2. 现有流程里真正要复刻的是什么

根据现有产品文档和控制器逻辑，真正要复刻的不是某几个按钮，而是这 7 个阶段：

1. 上传商品 `WAIT_PRODUCT`
2. 商品分析 `ANALYZE_PRODUCT`
3. 补充关键信息 `SUPPLEMENT_INFO`
4. 参考图复核 `ANALYZE_IMAGES`
5. 方案规划 `PLAN_SCHEMES`
6. 提示词定稿 `FINALIZE_PROMPTS`
7. 批量执行与结果筛选 `BATCH_GENERATE / DONE`

当前核心能力链也很明确：

1. `ecomAnalyzeProduct`
2. `ecomSupplementQuestions`
3. `ecomAnalyzeImages`
4. `ecomGeneratePlans`
5. `ecomRewritePrompt`
6. `generateImage`

所以 Coze 里要复刻的重点是：

1. 阶段拆分
2. 阶段间状态保存
3. 人工确认断点
4. 批量任务循环执行
5. 失败兜底与重试

## 3. Coze 内的推荐落地形态

推荐不要做成“一个超长工作流从头跑到尾”，而是做成：

1. `1 个电商一键 Bot`
2. `1 个总路由工作流`
3. `7 个阶段子工作流`
4. `2 张 Coze 数据表`
5. `2~4 个插件`

推荐结构：

```text
用户 -> Coze Bot
     -> 总路由工作流
        -> 按当前 step 调对应阶段子工作流
        -> 写回 Coze Database
        -> 返回下一步卡片 / 按钮 / 表单
```

## 4. Coze 内应该怎么理解“复刻”

在 Coze 里，不能 1:1 复刻你们网站的页面结构，但可以 1:1 复刻业务流程：

### 4.1 可以直接复刻的

1. 7 阶段状态机
2. 推荐类型确认
3. 补充信息问答
4. 单图参考分析
5. 方案分组
6. 提示词定稿
7. 批量任务
8. 结果设首选 / 重跑 / 删除

### 4.2 不能按网页方式复刻的

1. 抽屉式工作台
2. 大面积多栏卡片布局
3. 复杂任务驾驶舱
4. 本地 store 驱动的即时局部展开收起

### 4.3 在 Coze 里对应的替代物

1. 网页抽屉 -> Bot 卡片消息 + 阶段视图
2. 页面局部表单 -> 表单卡 / 按钮回调 / 再次提交流程
3. 前端 store -> Coze 数据库
4. 页面内批量队列 -> 数据表中的 `batch_jobs`

## 5. 推荐的 Coze 原生架构

## 5.1 Bot 层

Bot 负责：

1. 接收用户上传图片和文本
2. 展示阶段提示
3. 展示卡片按钮
4. 将用户动作转成工作流入参

Bot 不负责业务计算。

## 5.2 Workflow 层

Workflow 负责：

1. 判断当前在哪个阶段
2. 调用分析 / 规划 / 生成能力
3. 写数据库
4. 返回下一步要展示的内容

## 5.3 Database 层

建议用 Coze 的数据库能力存：

1. 会话主表 `ecom_sessions`
2. 任务结果表 `ecom_job_results`

如果你觉得一张表更方便，也可以先只用主表，先把 `plan_groups`、`batch_jobs`、`results` 以 JSON 存进去。

## 5.4 插件层

建议至少准备这些插件：

1. `product_analyze_plugin`
2. `supplement_questions_plugin`
3. `image_analyze_plugin`
4. `plan_generate_plugin`
5. `prompt_rewrite_plugin`
6. `image_generate_plugin`

如果你暂时不想拆这么细，也可以先做成一个 `ecom_workflow_plugin`，再由插件内部按 action 路由。

## 6. Coze 中的核心状态设计

建议直接复用你们现在的主状态结构。

## 6.1 会话主表 `ecom_sessions`

建议字段：

```json
{
  "session_id": "sess_xxx",
  "user_id": "coze_user_xxx",
  "step": "WAIT_PRODUCT",
  "platform_mode": "amazon",
  "workflow_mode": "professional",
  "description": "",
  "product_images": [],
  "analysis_summary": "",
  "analysis_review": null,
  "recommended_types": [],
  "supplement_fields": [],
  "image_analyses": [],
  "plan_groups": [],
  "selected_model_id": null,
  "model_options": [],
  "batch_jobs": [],
  "results": [],
  "progress": {
    "done": 0,
    "total": 6,
    "text": ""
  },
  "created_at": "",
  "updated_at": ""
}
```

## 6.2 为什么这里建议用 JSON 大字段

因为你们现有工作流本身就是强阶段型的聚合状态。  
在 Coze 原生方案里，先保证“能恢复、能继续、能重试”最重要。

所以第一版建议：

1. `recommended_types` 直接存 JSON
2. `supplement_fields` 直接存 JSON
3. `image_analyses` 直接存 JSON
4. `plan_groups` 直接存 JSON
5. `batch_jobs` 直接存 JSON
6. `results` 直接存 JSON

后面批量规模变大，再拆第二张任务表。

## 7. Coze 总路由工作流设计

工作流名建议：

`WF_ECOM_ONECLICK_ROUTER`

## 7.1 入参

```json
{
  "action": "start|resume|confirm_types|save_supplements|confirm_images|confirm_plans|prepare_prompts|run_batch|retry_job|set_preferred|delete_result",
  "session_id": "optional",
  "brief": "optional",
  "platform_mode": "optional",
  "workflow_mode": "optional",
  "product_images": [],
  "payload": {}
}
```

## 7.2 总路由的节点结构

### 1. 开始节点

接收所有用户动作参数。

### 2. 参数标准化节点

把空值补齐，把 action 转成统一格式。

### 3. 读取 / 创建 session 节点

规则：

1. `start` 且没有 `session_id` -> 新建 session
2. 其他 action -> 读取已有 session

### 4. Action 路由节点

按用户动作走不同分支：

1. `start`
2. `resume`
3. `confirm_types`
4. `save_supplements`
5. `confirm_images`
6. `confirm_plans`
7. `prepare_prompts`
8. `run_batch`
9. `retry_job`
10. `set_preferred`
11. `delete_result`

### 5. 子工作流调用节点

每个 action 调对应阶段子工作流。

### 6. 数据回写节点

把子工作流输出写回 `ecom_sessions`。

### 7. 卡片响应节点

返回 Bot 要发给用户的卡片内容：

1. 当前阶段说明
2. 下一步主按钮
3. 可选次按钮
4. 当前主要数据摘要

## 8. 7 个阶段子工作流怎么拆

## 8.1 `WF_ECOM_START_AND_ANALYZE_PRODUCT`

职责：

1. 保存商品图
2. 保存 brief
3. 调商品分析插件
4. 输出推荐类型

输入：

1. `brief`
2. `product_images`
3. `platform_mode`
4. `workflow_mode`

输出：

1. `step = ANALYZE_PRODUCT`
2. `analysis_summary`
3. `analysis_review`
4. `recommended_types`
5. 给用户返回“确认推荐类型”的卡片

## 8.2 `WF_ECOM_GENERATE_SUPPLEMENTS`

职责：

1. 接收用户选中的推荐类型
2. 调补充问题插件
3. 生成补充字段表单

输出：

1. `step = SUPPLEMENT_INFO`
2. `supplement_fields`
3. 返回“请补充关键信息”的表单卡

如果失败：

1. 返回“问题生成失败”
2. 给两个动作：
   - 重新生成
   - 使用保守兜底问题

## 8.3 `WF_ECOM_ANALYZE_IMAGES`

职责：

1. 读取商品图
2. 读取补充信息
3. 逐图分析
4. 给出哪些图可作参考

建议节点：

1. 循环节点 `for each product_image`
2. 调 `image_analyze_plugin`
3. 聚合结果
4. 写回 `image_analyses`

输出：

1. `step = ANALYZE_IMAGES`
2. `image_analyses`
3. 参考图确认卡

## 8.4 `WF_ECOM_GENERATE_PLANS`

职责：

1. 读取已选类型
2. 读取图片分析
3. 读取补充信息
4. 生成方案分组
5. 生成 batch jobs

输出：

1. `step = PLAN_SCHEMES`
2. `plan_groups`
3. `batch_jobs`
4. 返回“确认方案分组”的卡片

这里要保留你们当前的原则：

1. 先组后项
2. 一组一个图型
3. 一项一个出图任务
4. 不在本阶段直接生成最终执行 prompt

## 8.5 `WF_ECOM_FINALIZE_PROMPTS`

职责：

1. 基于 plan_groups 生成最终可执行 prompt
2. 支持选默认模型
3. 更新每个 `batch_job.finalPrompt`

建议做法：

### 第一版

一次性为全部 job 生成 prompt

优点：

1. 流程简单
2. 接近你们现有“提示词定稿”阶段

缺点：

1. 长任务耗时高

### 第二版

按组生成 prompt

优点：

1. 更符合 Coze 的分阶段卡片交互
2. 用户更容易局部修改

建议你先做第一版。

输出：

1. `step = FINALIZE_PROMPTS`
2. `batch_jobs[].finalPrompt`
3. `selected_model_id`
4. 返回“开始批量执行”的卡片

## 8.6 `WF_ECOM_RUN_BATCH`

这是 Coze 原生复刻里最关键的一段。

### 目标

在 Coze 里复刻你们现在的：

1. 单任务执行
2. 批量执行
3. 失败重试
4. 自动模型 fallback
5. 结果回写

### 第一版推荐做法

做成“单次只执行一批 job，但内部串行循环”。

节点结构：

1. 取出待执行 jobs
2. 循环节点 `for each job`
3. 对每个 job：
   - 生成 base prompt
   - 调 `prompt_rewrite_plugin`
   - 调 `image_generate_plugin`
   - 失败时尝试 fallback model
   - 保存结果
   - 更新 `job.status`
4. 聚合结果
5. 写回 session

### 为什么不建议第一版就做全异步

因为你现在的目标是“先在 Coze 里把流程跑通”。  
所以第一版先接受：

1. 串行
2. 单批量规模较小
3. 人工触发下一轮继续执行

### 什么时候要升级异步

当出现这些情况时再拆：

1. 单轮 20+ job
2. 单次运行经常超时
3. 需要后台持续生成

到那时再改为：

1. Coze 工作流发任务
2. 外部 worker 跑图
3. Coze 负责查询状态和回显

## 8.7 `WF_ECOM_RESULT_ACTIONS`

职责：

1. 设为首选
2. 删除结果
3. 单任务重跑

建议动作设计：

### `set_preferred`

输入：

- `job_id`
- `result_url`

处理：

1. 将该结果标为首选
2. 同 job 其他结果取消首选

### `delete_result`

输入：

- `job_id`
- `result_url`

处理：

1. 删除该结果
2. 如果该结果是首选，清空首选或重新指向最新结果

### `retry_job`

输入：

- `job_id`

处理：

1. 该 job 状态重置成 `queued`
2. 只重新跑这一条

## 9. Coze 中的人机交互怎么做

这里是和网站版最不一样的地方。

你在 Coze 里不应该追求“页面式编辑”，而应该追求“阶段式确认”。

## 9.1 每个阶段结束时都返回一张卡

建议固定包含：

1. 当前阶段名
2. 当前结论摘要
3. 主按钮
4. 次按钮
5. 如有必要，附表单

## 9.2 阶段断点靠“用户再次点击/提交”推进

不要强求一个工作流一次性从 Step1 跑到 Step7。  
正确方式是：

1. 当前阶段完成
2. 工作流返回卡片
3. 用户确认
4. 再触发总路由工作流进入下一阶段

这正好符合你们现有流程的原理：

1. AI 给建议
2. 用户确认
3. 再推进下一步

## 9.3 Step 5 到 Step 7 的卡片建议

### Step 5 方案规划

卡片内容：

1. 分组列表
2. 每组摘要
3. 每组项数
4. 主按钮：确认方案并进入定稿
5. 次按钮：重新生成方案

### Step 6 提示词定稿

卡片内容：

1. 已准备 prompt 数
2. 总任务数
3. 默认模型
4. 主按钮：开始批量执行
5. 次按钮：重新整理提示词

### Step 7 批量执行

卡片内容：

1. 完成数
2. 失败数
3. 最新结果
4. 主按钮：继续执行未完成任务
5. 次按钮：查看失败任务

## 10. Step 7 在 Coze 里如何复刻“任务驾驶舱”

网页版做的是高密度工作台。  
Coze 里不能直接照搬，但可以复刻成“多卡片任务流”。

## 10.1 建议的任务聚焦规则

按优先级返回卡片：

1. 有失败任务 -> 先返回失败任务卡
2. 无失败但有未开始任务 -> 返回待执行卡
3. 全部完成 -> 返回最近结果卡

这和你们现有 PRD 的原则一致。

## 10.2 每次只把最值得处理的一批任务发给用户

不要一次把全部 32 条 job 都铺出来。  
Coze 更适合：

1. 返回 top 3 待处理任务
2. 返回 top 3 最新结果
3. 返回“查看更多”按钮

## 10.3 结果排序

继续沿用现有原则：

1. 当前首选
2. 最新生成
3. 其它历史版本

## 11. 失败与兜底如何在 Coze 里复刻

你们现有流程里最重要的一点，是不是所有失败都自动兜底。

Coze 里也要保留这个原则。

## 11.1 补充问题失败

给用户两个按钮：

1. 重新生成
2. 使用保守兜底问题

## 11.2 方案规划失败

给用户两个按钮：

1. 重新生成方案
2. 使用保守兜底方案骨架

## 11.3 生图失败

如果是模型 / 通道问题：

1. 自动 fallback 到下一个模型

如果是输入问题：

1. 标记 job 失败
2. 给用户“重试这一条”的按钮

## 12. 模型选择在 Coze 中怎么做

你们现在先是会话级 `selectedModelId`。  
所以 Coze 第一版也先不要做复杂覆盖，避免把流程做炸。

## 12.1 第一版

只做：

1. 会话级默认模型

建议选项：

1. `Nano Banana Pro`
2. `Nano Banana 2`
3. `Seedream 5.0`

## 12.2 第二版

再做：

1. 分组级模型覆盖
2. 单任务级模型覆盖

但这不建议作为第一版前提。

## 13. 插件入参设计建议

如果你准备在 Coze 里接已有能力，建议插件接口和现在的业务参数尽量对齐。

## 13.1 商品分析插件

```json
{
  "productImages": ["url1", "url2"],
  "brief": "商品说明",
  "platformMode": "amazon",
  "workflowMode": "professional"
}
```

## 13.2 补充问题插件

```json
{
  "productImages": [],
  "brief": "",
  "analysisSummary": "",
  "platformMode": "",
  "workflowMode": "",
  "recommendedTypes": [],
  "fallbackMode": "block"
}
```

## 13.3 图片分析插件

```json
{
  "productImages": [],
  "brief": "",
  "platformMode": "",
  "workflowMode": "",
  "supplementSummary": ""
}
```

## 13.4 方案规划插件

```json
{
  "selectedTypes": [],
  "brief": "",
  "platformMode": "",
  "workflowMode": "",
  "supplementSummary": "",
  "imageAnalyses": [],
  "fallbackMode": "block"
}
```

## 13.5 提示词改写插件

```json
{
  "productDescription": "",
  "typeTitle": "",
  "planTitle": "",
  "planDescription": "",
  "currentPrompt": "",
  "supplementSummary": "",
  "targetRatio": "",
  "feedback": "",
  "imageAnalyses": []
}
```

## 13.6 生图插件

```json
{
  "prompt": "",
  "model": "NanoBanana2",
  "aspectRatio": "3:4",
  "referenceImages": [],
  "referenceMode": "product",
  "promptLanguagePolicy": "translate-en"
}
```

## 14. 第一版最小可实现范围

如果你现在就要在 Coze 里开始搭，建议先做这个 MVP：

1. 商品上传
2. 商品分析
3. 推荐类型确认
4. 补充问题
5. 图片分析
6. 方案规划
7. 一次性生成全部 prompts
8. 串行执行 3~8 个 job
9. 返回结果卡
10. 支持设首选和单任务重跑

先不要做：

1. 竞品详情页分析
2. overlay 文字叠加
3. 大规模异步队列
4. 分组级模型覆盖
5. 复杂结果对比面板

## 15. 最推荐的 Coze 原生实现路径

### Phase 1

先搭这些：

1. Bot
2. 总路由工作流
3. 4 个插件
4. 1 张 session 表

目标：

把 Step 1 到 Step 5 跑通。

### Phase 2

再加：

1. 提示词定稿子工作流
2. 串行批量执行子工作流
3. 结果动作子工作流

目标：

把 Step 6 到 Step 7 跑通。

### Phase 3

最后再加：

1. 失败优先视图
2. 最近结果视图
3. 异步执行
4. 复杂结果管理

## 16. 结论

如果你的目标是“直接在 Coze 工作流里复刻现有流程”，正确做法是：

1. 用 Coze Bot 承接用户交互
2. 用一个总路由工作流管理阶段推进
3. 用多个阶段子工作流复刻 7 个业务阶段
4. 用 Coze 数据库保存 session 状态
5. 用插件承接分析、规划、改写、生图
6. 用卡片和二次提交来代替网站里的抽屉式交互

一句话说，就是：

复刻的是“阶段化业务流程 + 人工确认断点 + 批量任务机制”，不是复刻“网站页面形态”。
