# Account Sync And Evolution Roadmap

## 目标

把主脑、角色、风格库、插件、用户偏好从“网页内嵌状态”升级成“账号可同步资产”。

## 当前已落地的第一阶段

1. 根目录 `studio-assets/` 成为人类可读资产源。
2. Markdown 资产通过脚本编译成统一 registry manifest。
3. 业务代码统一通过 registry 接口读取，而不是直接硬编码常量。

## 下一阶段

1. 把本地 generated manifest provider 抽象成可切换数据源：
   - `LocalGeneratedStudioAssetSource`
   - `AccountStudioAssetSource`
   - `RemoteSharedAssetMarketplaceSource`
2. 增加用户资产命名空间：
   - `userRoles`
   - `userStyleLibraries`
   - `userPlugins`
   - `userProfile`
   - `brainEvolution`
3. 增加变更审计与回滚：
   - 版本号
   - 来源（system / user / main-brain / imported）
   - 可回滚快照

## 接口方向

建议后续统一成以下接口层，而不是让页面直接接本地存储：

```ts
interface StudioAssetApi {
  getRegistry(): Promise<StudioRegistryManifest>;
  listRoles(userId: string): Promise<RoleAsset[]>;
  saveRole(userId: string, role: RoleAsset): Promise<void>;
  listStyleLibraries(userId: string): Promise<StyleLibraryAsset[]>;
  saveStyleLibrary(userId: string, styleLibrary: StyleLibraryAsset): Promise<void>;
  getUserProfile(userId: string): Promise<UserProfileAsset>;
  appendEvolutionEvent(userId: string, event: BrainEvolutionEvent): Promise<void>;
}
```

## 自主进化建议

自主进化不要直接改运行中 prompt 本体，建议走：

1. 观察层
2. 归纳层
3. 提案层
4. 审批 / 自动阈值层
5. 发布层
6. 回滚层

这样可以避免主脑误学习后把系统带偏。

## 分享体系建议

后续可分享对象：

- 角色
- 风格库
- 插件
- 工作流模板

每个分享资产至少要带：

- `id`
- `ownerUserId`
- `title`
- `summary`
- `version`
- `visibility`
- `createdAt`
- `updatedAt`
- `sourceType`
- `markdownSource`
- `compiledManifestFragment`
