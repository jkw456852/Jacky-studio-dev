# Studio Account Sync Phase 1 Boundary · 2026-05-07

## 本阶段目标

先把“账号资产同步”落到最小可运行闭环，而不是一上来就同步整个项目和图片。

## 第一批真正上云的数据

这一批直接复用 [`StudioUserAssetState`](../../services/runtime-assets/user-asset-types.ts:148) 作为远端快照结构，通过 [`syncStudioUserAssetsWithRemoteEndpoint()`](../../services/runtime-assets/sync-service.ts:73) 做本地/远端合并。

### 已纳入账号同步的数据

- 主脑长期偏好
- 用户画像
- 工作台偏好 / 模型偏好
- Skill 偏好
- Plugin 偏好
- Agent prompt addon
- 最新角色草稿
- 用户风格库
- 进化记录

这些都已经属于统一用户资产层，读取入口都在 [`StudioUserAssetApi`](../../services/runtime-assets/api.ts:18) 下。

## 本阶段明确不进账号同步的数据

### 1. 本地项目内容

当前项目数据仍由 [`saveProject()`](../../services/storage.ts:147) 写入浏览器本地 IndexedDB。

暂不进入第一批远端同步，原因：
- 体积大
- 结构复杂
- 含大量会话与画布内容
- 更容易和图片资源绑定，后续会和项目级手动迁移一起处理

### 2. 图床配置密钥

[`useImageHostStore`](../../stores/imageHost.store.ts:29) 当前仍持久化到浏览器本地。

其中如 [`imgbbKey`](../../stores/imageHost.store.ts:19) 这类密钥不适合直接按当前明文结构进入用户资产快照。

本阶段不做远端同步，后续如果要同步：
- 要么只同步“是否启用 / provider 类型”
- 要么改成服务端安全托管，不再让前端持久化明文 key

### 3. 生成图 / 上传图 / 历史项目图片

这些不进入第一批账号同步。

原因：
- 存储成本高
- 与项目结构强耦合
- 需要先把“图床模式”和“项目级手动迁移”定义清楚

## 远端同步入口

本次新增：

- [`/api/account-sync`](../../api/account-sync.ts)
- [`syncLocalStudioUserAssetsToAccount()`](../../services/runtime-assets/account-sync.ts:25)

### 工作方式

1. 前端带 Supabase access token 调用 [`/api/account-sync`](../../api/account-sync.ts)
2. 服务端用 `SUPABASE_SERVICE_ROLE_KEY` 验证用户并读写远端快照
3. 远端存一整份 [`StudioUserAssetState`](../../services/runtime-assets/user-asset-types.ts:148)
4. 合并策略继续走 [`DEFAULT_STUDIO_ASSET_SYNC_POLICY`](../../services/runtime-assets/sync-policy.ts:16)

## Supabase 表结构

在 Supabase SQL Editor 执行：

```sql
create table if not exists public.studio_user_assets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  audit_entries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_studio_user_assets_updated_at
  on public.studio_user_assets (updated_at desc);

alter table public.studio_user_assets enable row level security;
```

> 当前接口走服务端 `service_role` 读写，所以这张表即使不开公开 policy 也能工作。

## Vercel 还需要的服务端环境变量

```env
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的 service_role key
```

前端公开环境变量继续保留：

```env
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=你的 publishable key
```

## 下一步建议

1. 在用户中心页增加“同步账号资产”按钮并展示结果
2. 等远端快照跑通后，再补自动同步策略（登录后拉取 / 手动推送 / 冲突提示）
3. 再往后才进入项目数据与图床资源迁移，不要提前混进第一批同步范围
