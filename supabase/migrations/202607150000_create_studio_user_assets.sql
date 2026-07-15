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

revoke all on table public.studio_user_assets from anon, authenticated;
grant select, insert, update, delete
  on table public.studio_user_assets
  to service_role;

comment on table public.studio_user_assets is
  'Server-managed XC Studio user assets and merge audit history.';
