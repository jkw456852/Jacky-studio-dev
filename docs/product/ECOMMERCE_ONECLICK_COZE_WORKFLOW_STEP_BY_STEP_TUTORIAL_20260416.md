# 电商一键工作流 Coze 手把手搭建教程

Last updated: 2026-04-16  
Owner: Codex  
适用人群：现在就想在 Coze 里把流程先搭出来的人

## 0. 先说结论

如果你现在想直接在 Coze 里复刻你们的流程，最简单的做法不是一下子做完整高级版，而是先搭这 5 个东西：

1. 一个 Bot
2. 一张数据库表
3. 一个总工作流
4. 6 个插件
5. 几张按钮卡片

先把流程跑通，再优化体验。

---

## 1. 你最终要做出来的流程长什么样

用户在 Coze 里会这样走：

1. 上传商品图 + 输入商品描述
2. Bot 分析商品，给出推荐出图类型
3. 用户点按钮确认类型
4. Bot 生成补充问题
5. 用户填写补充信息
6. Bot 分析每张商品图，判断哪些能做参考图
7. 用户确认参考图
8. Bot 生成方案分组
9. 用户确认方案
10. Bot 生成每条任务的最终提示词
11. 用户点击开始批量生成
12. Bot 一条条跑任务并返回结果
13. 用户可以设首选、删除、重跑某一条

这就是你们现在网站流程在 Coze 里的等价版本。

---

## 2. 第一版不要追求什么

先不要做：

1. 很复杂的工作台界面
2. 很炫的多栏卡片
3. 竞品分析
4. overlay 文案叠加
5. 很复杂的异步调度
6. 任务级模型覆盖

第一版目标只有一个：

`让 7 个阶段在 Coze 里完整跑通`

---

## 3. 先准备哪些东西

开始前你先准备这几样：

### 3.1 一张数据库表

表名建议：

`ecom_sessions`

### 3.2 6 个插件

插件名建议：

1. `ecomAnalyzeProduct`
2. `ecomSupplementQuestions`
3. `ecomAnalyzeImages`
4. `ecomGeneratePlans`
5. `ecomRewritePrompt`
6. `generateImage`

### 3.3 一个总工作流

工作流名建议：

`WF_ECOM_ONECLICK_ROUTER`

### 3.4 一个 Bot

Bot 名字随意，建议你就叫：

`电商一键工作流`

---

## 4. 第一步：先建数据库表

这一张表最重要，因为没有它，你的工作流一断就丢状态。

### 4.1 表名

`ecom_sessions`

### 4.2 字段怎么建

先建下面这些字段就够了：

| 字段名 | 类型 | 说明 |
| --- | --- | --- |
| `session_id` | 文本 | 会话 id |
| `user_id` | 文本 | Coze 用户 id |
| `step` | 文本 | 当前阶段 |
| `platform_mode` | 文本 | 平台 |
| `workflow_mode` | 文本 | quick / professional |
| `description` | 长文本 | 商品说明 |
| `product_images` | 长文本 / JSON | 商品图 URL 列表 |
| `analysis_summary` | 长文本 | 商品分析总结 |
| `recommended_types` | 长文本 / JSON | 推荐类型 |
| `supplement_fields` | 长文本 / JSON | 补充问题和答案 |
| `image_analyses` | 长文本 / JSON | 图片分析结果 |
| `plan_groups` | 长文本 / JSON | 方案分组 |
| `selected_model_id` | 文本 | 当前默认模型 |
| `batch_jobs` | 长文本 / JSON | 批量任务 |
| `results` | 长文本 / JSON | 结果图 |
| `progress_text` | 文本 | 当前进度文案 |
| `updated_at` | 文本 | 更新时间 |

### 4.3 为什么先都用 JSON

因为你现在目标不是做数据库建模，而是先跑通流程。  
所以推荐你把复杂结构先都塞 JSON。

比如：

1. `recommended_types`
2. `supplement_fields`
3. `image_analyses`
4. `plan_groups`
5. `batch_jobs`
6. `results`

都先用 JSON 文本存。

这样最省事。

---

## 5. 第二步：先建 6 个插件

这里我用最容易理解的话解释：

插件就是“干活的人”，工作流只是“调度的人”。

### 5.1 商品分析插件

插件名：

`ecomAnalyzeProduct`

输入：

```json
{
  "productImages": [],
  "brief": "",
  "platformMode": "",
  "workflowMode": ""
}
```

输出：

```json
{
  "summary": "",
  "recommendedTypes": [],
  "review": {}
}
```

它负责：

1. 看商品图
2. 理解商品是什么
3. 推荐应该做哪些图型

---

### 5.2 补充问题插件

插件名：

`ecomSupplementQuestions`

输入：

```json
{
  "brief": "",
  "analysisSummary": "",
  "recommendedTypes": [],
  "platformMode": "",
  "workflowMode": "",
  "fallbackMode": "block"
}
```

输出：

```json
{
  "fields": [],
  "mode": "ai"
}
```

它负责：

1. 根据商品和类型，问用户几个关键问题
2. 不要问太多
3. 只问真正影响方案质量的问题

---

### 5.3 图片分析插件

插件名：

`ecomAnalyzeImages`

输入：

```json
{
  "productImages": [],
  "brief": "",
  "supplementSummary": "",
  "platformMode": "",
  "workflowMode": ""
}
```

输出：

```json
{
  "items": []
}
```

它负责：

1. 分析每一张图
2. 告诉你这张图适不适合做参考图

---

### 5.4 方案规划插件

插件名：

`ecomGeneratePlans`

输入：

```json
{
  "selectedTypes": [],
  "brief": "",
  "supplementSummary": "",
  "imageAnalyses": [],
  "platformMode": "",
  "workflowMode": "",
  "fallbackMode": "block"
}
```

输出：

```json
{
  "groups": [],
  "review": {}
}
```

它负责：

1. 把图型拆成分组
2. 每组再拆成具体任务项

---

### 5.5 提示词改写插件

插件名：

`ecomRewritePrompt`

输入：

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

输出：

```json
{
  "prompt": ""
}
```

它负责：

1. 把方案项改成最终可执行 prompt

---

### 5.6 生图插件

插件名：

`generateImage`

输入：

```json
{
  "prompt": "",
  "model": "",
  "aspectRatio": "",
  "referenceImages": []
}
```

输出：

```json
{
  "imageUrl": ""
}
```

它负责：

1. 真正去生图

---

## 6. 第三步：建总工作流

工作流名：

`WF_ECOM_ONECLICK_ROUTER`

这个工作流是整个流程的大脑。

它不直接干活，它只决定：

1. 现在在哪一步
2. 应该调哪个插件
3. 返回给用户什么

---

## 7. 第四步：给总工作流加输入参数

建议你加这些参数：

| 参数名 | 说明 |
| --- | --- |
| `action` | 当前动作 |
| `session_id` | 当前会话 id |
| `brief` | 商品描述 |
| `platform_mode` | 平台 |
| `workflow_mode` | quick / professional |
| `product_images` | 商品图 URL 列表 |
| `payload` | 其他附加数据 |

### 7.1 `action` 要有哪些值

你就按下面这套来：

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

这 11 个动作足够支撑第一版。

---

## 8. 第五步：开始搭工作流主干

你在工作流里先放这几个节点：

1. 开始节点
2. 条件判断节点
3. 数据库读取节点
4. 数据库写入节点
5. 插件调用节点
6. 结束节点

整个骨架很简单：

```text
开始
 -> 判断 action
 -> 读取 / 创建 session
 -> 按 action 调对应插件
 -> 写回数据库
 -> 返回消息卡片
```

---

## 9. 第六步：先实现 `start`

这是流程入口。

### 9.1 用户会做什么

用户上传商品图，并输入一句商品描述。

### 9.2 你在工作流里怎么做

当 `action = start` 时：

1. 生成 `session_id`
2. 往数据库插入一条 session
3. 调 `ecomAnalyzeProduct`
4. 把分析结果写入数据库
5. 把 `step` 改成 `ANALYZE_PRODUCT`
6. 返回“确认推荐类型”的卡片

### 9.3 这一步结束后数据库应该有什么

至少这些字段要有值：

1. `session_id`
2. `step = ANALYZE_PRODUCT`
3. `description`
4. `product_images`
5. `analysis_summary`
6. `recommended_types`

---

## 10. 第七步：实现 `confirm_types`

### 10.1 用户会做什么

用户看到推荐类型后，勾选要保留的图型，然后点确认。

### 10.2 你在工作流里怎么做

当 `action = confirm_types` 时：

1. 读取当前 session
2. 把用户选中的类型写回 `recommended_types`
3. 调 `ecomSupplementQuestions`
4. 把返回的补充字段写入 `supplement_fields`
5. 把 `step` 改成 `SUPPLEMENT_INFO`
6. 返回补充问题表单

---

## 11. 第八步：实现 `save_supplements`

### 11.1 用户会做什么

用户填完补充信息并提交。

### 11.2 你在工作流里怎么做

当 `action = save_supplements` 时：

1. 读取当前 session
2. 把用户填写结果写回 `supplement_fields`
3. 调 `ecomAnalyzeImages`
4. 把结果写入 `image_analyses`
5. 把 `step` 改成 `ANALYZE_IMAGES`
6. 返回参考图确认卡

---

## 12. 第九步：实现 `confirm_images`

### 12.1 用户会做什么

用户确认哪些图可以作为参考图。

### 12.2 你在工作流里怎么做

当 `action = confirm_images` 时：

1. 读取当前 session
2. 更新 `image_analyses`
3. 调 `ecomGeneratePlans`
4. 把结果写入 `plan_groups`
5. 根据 `plan_groups` 生成 `batch_jobs`
6. 把 `step` 改成 `PLAN_SCHEMES`
7. 返回方案确认卡

### 12.3 `batch_jobs` 怎么生成

原则很简单：

1. 每个 `plan item` 生成一条 `job`
2. 初始状态都设成 `idle`

格式你先这样做：

```json
[
  {
    "id": "job_1",
    "planItemId": "plan_1",
    "title": "品质感主视觉",
    "status": "idle",
    "finalPrompt": "",
    "results": []
  }
]
```

---

## 13. 第十步：实现 `confirm_plans`

### 13.1 用户会做什么

用户确认方案分组没有问题，准备进入提示词定稿。

### 13.2 你在工作流里怎么做

当 `action = confirm_plans` 时：

1. 读取当前 session
2. 调 `ecomRewritePrompt`，给每条 `batch_job` 生成最终 prompt
3. 把结果写回 `batch_jobs[].finalPrompt`
4. 选择默认模型，写入 `selected_model_id`
5. 把 `step` 改成 `FINALIZE_PROMPTS`
6. 返回“开始批量执行”的卡片

### 13.3 第一版最简单的做法

不要想太多，就直接：

1. 循环所有 `batch_jobs`
2. 每条生成一个最终 prompt

先让它跑通。

---

## 14. 第十一步：实现 `run_batch`

这是最关键的一步。

### 14.1 第一版你怎么做最稳

就做串行。

意思是：

1. 找到所有待执行 job
2. 一条一条跑
3. 每跑完一条就写数据库

### 14.2 每条 job 具体怎么跑

对每条 job 固定执行：

1. 读取 `finalPrompt`
2. 找参考图
3. 调 `generateImage`
4. 拿到结果图 URL
5. 把结果追加到该 job 的 `results`
6. 把 `status` 改成 `done`
7. 同步更新 session 的 `results`

### 14.3 如果失败怎么办

第一版先这么处理：

1. 失败了就把该 job 标成 `failed`
2. 在 `error` 里写失败原因
3. 继续跑下一条

### 14.4 这一步跑完之后返回什么

返回一张执行结果卡：

1. 完成了几条
2. 失败了几条
3. 最新生成的几张结果图
4. 主按钮：继续执行未完成任务
5. 次按钮：查看失败任务

---

## 15. 第十二步：实现 `retry_job`

### 15.1 用户会做什么

用户觉得某一条失败了，或者想重跑。

### 15.2 你在工作流里怎么做

当 `action = retry_job` 时：

1. 读取当前 session
2. 找到对应 job
3. 把它状态改成 `queued`
4. 只重新跑这一条
5. 跑完后写回数据库

---

## 16. 第十三步：实现 `set_preferred`

### 16.1 用户会做什么

用户从某一条任务的多个结果里选一张最满意的。

### 16.2 你怎么做

当 `action = set_preferred` 时：

1. 找到对应 job
2. 把被选中的结果标记成 `preferred = true`
3. 该 job 其他结果都改成 `preferred = false`
4. 同步更新 session 的 `results`

---

## 17. 第十四步：实现 `delete_result`

### 17.1 用户会做什么

用户删除不满意结果。

### 17.2 你怎么做

当 `action = delete_result` 时：

1. 找到对应 job
2. 删除对应结果
3. 同步更新 session 的 `results`

---

## 18. 第十五步：实现 `resume`

这个动作非常重要。

因为用户不可能一直在线把流程跑完。

### 18.1 `resume` 要做什么

用户回来时：

1. 读 session
2. 看 `step`
3. 直接返回当前阶段该展示的卡片

比如：

### 如果当前 `step = SUPPLEMENT_INFO`

就直接返回补充信息表单卡。

### 如果当前 `step = PLAN_SCHEMES`

就直接返回方案确认卡。

### 如果当前 `step = BATCH_GENERATE`

就直接返回任务执行卡。

---

## 19. 卡片怎么做最省事

你现在不要纠结高级 UI。

先记住一句话：

`每个阶段只返回一张主卡片`

### 19.1 商品分析阶段卡

显示：

1. 分析摘要
2. 推荐类型
3. 主按钮：确认推荐类型

### 19.2 补充信息阶段卡

显示：

1. 需要填写的问题
2. 主按钮：保存并继续

### 19.3 图片分析阶段卡

显示：

1. 每张图的判断
2. 哪些图建议作为参考图
3. 主按钮：确认参考图

### 19.4 方案规划阶段卡

显示：

1. 分组列表
2. 每组摘要
3. 每组任务数
4. 主按钮：确认方案

### 19.5 提示词定稿阶段卡

显示：

1. 已准备 prompt 数
2. 默认模型
3. 主按钮：开始批量执行

### 19.6 批量执行阶段卡

显示：

1. 完成数
2. 失败数
3. 最新结果
4. 主按钮：继续执行

---

## 20. 第一版最容易踩坑的地方

### 坑 1：不存 session

后果：

流程一断全没了。

解决：

每一步都写数据库。

### 坑 2：一个工作流一次跑到底

后果：

流程很长，容易崩。

解决：

每个阶段停一下，让用户确认后再进下一步。

### 坑 3：Step 7 一次跑太多 job

后果：

超时、难排查。

解决：

第一版一次只跑少量 job，先串行。

### 坑 4：卡片信息太多

后果：

用户更看不懂。

解决：

每个阶段只给一张主卡，只保留当前最重要的一个动作。

---

## 21. 你现在最推荐的搭建顺序

如果你今天就开工，我建议你按这个顺序来：

### 第一天

1. 建 Bot
2. 建数据库表
3. 建总工作流骨架

### 第二天

1. 接 `start`
2. 接 `confirm_types`
3. 接 `save_supplements`

目标：

把 Step 1 到 Step 3 跑通。

### 第三天

1. 接 `confirm_images`
2. 接 `confirm_plans`

目标：

把 Step 4 到 Step 6 跑通。

### 第四天

1. 接 `run_batch`
2. 接 `retry_job`
3. 接 `set_preferred`
4. 接 `delete_result`

目标：

把 Step 7 跑通。

---

## 22. 最后给你一个最简单的理解方式

如果还是觉得抽象，你就把 Coze 里的这套东西理解成：

### Bot 是前台接待

负责和用户说话、发卡片、收按钮点击。

### Workflow 是项目经理

负责判断现在该做哪一步。

### 插件是员工

负责具体干活：

1. 分析商品
2. 出补充问题
3. 分析图片
4. 生成方案
5. 改写 prompt
6. 生图

### 数据库是档案柜

负责记住这个用户现在做到哪一步了。

---

## 23. 一句话版本

你现在要做的事情，其实就是：

`在 Coze 里做一个会记进度、会分阶段停下来让用户确认、最后还能批量跑图的 Bot。`

---

## 24. 下一步我建议你让我继续补什么

如果你觉得这版终于看懂了，我建议下一步我直接继续帮你写下面其中一个：

1. `最小可运行版 Coze 工作流节点图`
2. `6 个插件的提示词模板`
3. `数据库字段示例 JSON`
4. `每个阶段要返回给用户的卡片文案`

如果你要效率最高，我建议我下一步直接给你：

`最小可运行版 Coze 工作流节点图 + 6 个插件 Prompt`
