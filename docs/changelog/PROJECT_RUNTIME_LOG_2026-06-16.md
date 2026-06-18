# 项目运行日志 2026-06-16

项目目录：`E:\ai网站\XC-STUDIO`

## 概览

本次日志来自一次本地运行过程，前端应用本身已成功启动，`supabase-auth` 登录态和 Workspace 项目恢复正常。运行期间主要暴露出三类问题：

1. 会话历史面板存在嵌套 `button`，触发 React hydration 告警。
2. 研究提取链路 `/api/extract` 将上游各种失败统一表现成 `400`，导致排障信息失真。
3. `openai-proxy` 上游出现持续 `503`，并叠加传输回退器在单 key 场景下的重复重试噪音。

## 关键日志现象

### 1. 启动与认证

- React DevTools 提示出现，说明前端已挂载。
- `supabase-auth` 依次出现：
  - `SIGNED_IN`
  - `bootstrap-session`
  - `INITIAL_SESSION`
- Workspace 成功加载项目 `new-1781162101213`
- 出现：
  - `Safe load mode enabled for heavy project`
  - `Load complete, persistence enabled`

### 2. 前端结构告警

- 控制台出现：
  - `In HTML, <button> cannot be a descendant of <button>.`
  - `This will cause a hydration error.`
- 关联位置指向：
  - `AssistantSidebarHistoryPanel`
  - `AssistantSidebarConversationActions`

### 3. 研究与提取流程

- `search.request` / `search.success` 正常
- `rehost.request` / `rehost.success` 正常
- `extract.request` 多次发起
- 部分 `extract.success`
- 多次接口失败：
  - `/api/extract` 返回 `400 Bad Request`
  - 出现多次 `extract.fail`

### 4. 外部资源跨域失败

- 天气相关图片资源加载失败：
  - `http://www.weather.com.cn/...`
  - `http://static.city.manmankan.com/...`
- 浏览器报错：
  - `blocked by CORS policy`
  - `net::ERR_FAILED`

### 5. 代理模型主故障

- `coco` 在 `analyzeAndPlan` 阶段持续失败
- `/api/openai-proxy` 多次返回 `503 Service Unavailable`
- 日志中大量出现：
  - `retrying status=503`
  - `Server error (503), will retry with alternate auth or next key`
- 最终任务失败：
  - `Task failed: analyzeAndPlan`
  - `Task result: failed`

## 本轮已完成修复

### 1. 修复历史会话卡片的嵌套按钮问题

- 文件：[pages/Workspace/components/AssistantSidebarHistoryPanel.tsx](</E:/ai网站/XC-STUDIO/pages/Workspace/components/AssistantSidebarHistoryPanel.tsx>)
- 外层会话项已从 `button` 改为带键盘可访问性的 `div[role="button"]`
- 保留 `Enter` / `Space` 选择交互
- 避免内部 `AssistantSidebarConversationActions` 的多个操作按钮再嵌套进 `button`

### 2. 修正 `/api/extract` 的状态码透传

- 文件：[vite.config.ts](</E:/ai网站/XC-STUDIO/vite.config.ts>)
- 之前上游页面无论返回 `401/403/404/429/503` 都会被本地代理改写成 `400`
- 现在会保留真实上游状态码，并附带 `url` 与 `status`
- 这样前端和日志能准确区分“参数错误”和“目标站点拒绝抓取”

### 3. 降低研究提取中的无意义失败

- 文件：[pages/Workspace/controllers/useWorkspaceSend.helpers.ts](</E:/ai网站/XC-STUDIO/pages/Workspace/controllers/useWorkspaceSend.helpers.ts>)
- 研究提取前新增 URL 过滤
- 跳过明显不可提取的资源地址，例如：
  - 图片
  - PDF
  - 压缩包
  - 音视频文件
- 减少 `/api/extract` 因资源类型不适配产生的噪音

### 4. 修复 OpenAI 回退传输器在单 key 场景下的重复重试问题

- 文件：[services/image-generation/core/transport-runner.ts](</E:/ai网站/XC-STUDIO/services/image-generation/core/transport-runner.ts>)
- 之前在 `429/5xx` 且仅有一个 key 时，回退器会继续原地循环，导致日志大量刷屏
- 现在在无可切换 key 时会尽快跳出当前循环，把错误回传给上层
- 这不会解决上游真实 `503`，但会显著减少无意义重试和重复日志

### 5. 清理研究错误映射

- 文件：[services/research/research-errors.ts](</E:/ai网站/XC-STUDIO/services/research/research-errors.ts>)
- 重写了研究错误归一化文件，补充了常见的 `fetch_failed_401/403/404/429/503` 等提示
- 便于前端和日志明确判断失败原因

## 仍需关注的问题

### 1. `openai-proxy` 上游 503 仍然存在

当前更像是“选中的自定义提供商或其上游服务不可用”，而不是本地 Vite 路由失效。需要重点检查：

- 当前激活的 API provider 是否是自定义节点
- 该 provider 的 `baseUrl` 是否可用
- 该服务商是否支持当前模型 `gemini-3-pro-preview`
- 该服务商是否要求固定认证方式，而不是自动 bearer/query 回退
- 该服务商是否正在限流或故障

相关文件：

- [services/gemini.ts](</E:/ai网站/XC-STUDIO/services/gemini.ts>)
- [api/openai-proxy.ts](</E:/ai网站/XC-STUDIO/api/openai-proxy.ts>)
- [services/provider-config.ts](</E:/ai网站/XC-STUDIO/services/provider-config.ts>)
- [services/openai-transport/auth.ts](</E:/ai网站/XC-STUDIO/services/openai-transport/auth.ts>)

### 2. 外部天气图片跨域问题未直接修复

当前日志中的失败属于浏览器直接访问外站图片导致的 CORS 限制。可选方案：

- 统一通过本地 `/api/fetch-image` 中转
- 服务端下载后再转为同源地址
- 或避免把这类跨域图片直接作为前端抓取资源

## 建议优先级

1. 先验证当前激活的 API provider 与 `baseUrl`
2. 再复测 `analyzeAndPlan` 是否还会出现重复 `503` 刷屏
3. 然后验证历史面板 hydration 告警是否消失
4. 最后复测研究流程，确认 `/api/extract` 的错误码和降级行为符合预期
