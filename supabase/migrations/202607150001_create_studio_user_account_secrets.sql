create table if not exists public.studio_user_account_secrets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_payload jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_studio_user_account_secrets_updated_at
  on public.studio_user_account_secrets (updated_at desc);

alter table public.studio_user_account_secrets enable row level security;

revoke all on table public.studio_user_account_secrets from anon, authenticated;
grant select, insert, update, delete
  on table public.studio_user_account_secrets
  to service_role;

comment on table public.studio_user_account_secrets is
  'Server-only encrypted provider, image-host, and search credentials for XC Studio accounts.';
