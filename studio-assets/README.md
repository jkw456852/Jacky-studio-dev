# Studio Assets

这个目录是 `Jacky-studio-dev` 的可运营资产入口。

这里放的不是页面组件，而是以后要跟账号、云端同步、分享市场、自主进化一起走的数据资产：

- 主脑设定
- 角色设定
- 风格库
- 路由与回退规则
- 后续的用户画像 / 进化记录 / 可分享插件说明

## 设计原则

1. 资产用 Markdown 存储，便于直接阅读、版本管理和人工修改。
2. 运行时不要直接依赖页面内嵌常量，而是通过统一 registry 读取。
3. 当前阶段先用本地 Markdown -> 生成 manifest 的方式落地。
4. 后续接账号系统时，只需要把 registry 数据源切到接口层，不需要重写业务 UI。

## 目录约定

- `main-brain/`: 主脑、共享思维规则、系统级提示词、路由策略
- `roles/agents/`: 主角色资产
- `roles/specializations/`: 内部专项角色 / 专项覆盖层
- `style-libraries/`: 内置风格库
- `user-profile/`: 预留给用户画像、偏好、长期记忆
- `evolution/`: 预留给主脑自进化、自检、自修复记录
- `plugins/`: 预留给可分享插件与插件描述
- `roadmap/`: 结构规划、接口规划、账号同步计划

## 当前分层

现在项目里的长期资产按三层走：

1. 内置资产层  
   来自这个 `studio-assets/` 目录，构建后进入 runtime registry。

2. 用户资产层  
   当前先走本地 `StudioUserAssetApi`，后续可无缝切到账号后端。  
   目前已接入：
   - 主脑长期偏好
   - 角色补充词 addon
   - 自动角色草稿
   - 自定义风格库

3. 运行时临时层  
   只服务当前任务，例如临时角色脑、临时规划 overlay、临时风格库改写，不直接当成系统内置资产。

原则：

- 不要再把长期资产直接散写进页面组件或孤立 `localStorage` key。
- 新增长期资产时，优先先接 `StudioUserAssetApi` 或 runtime registry。
- 如果发现新功能又绕回旧链路，优先清理旧链路而不是继续叠补丁。

## 文件格式

每个资产文件都用：

1. 顶部 JSON 代码块存机器可读元数据
2. `##` 分节存正文或模板

构建脚本会把这些 Markdown 编译到：

- `public/runtime-assets/studio-registry.json`
- `services/runtime-assets/generated/studio-registry.generated.ts`

业务代码只应该从 `services/runtime-assets/studio-registry.ts` 读取，不要再直接新增新的硬编码资产常量。
