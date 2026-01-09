-- システム全体で共有される通知地点（管理者設定）

create table if not exists public.system_locations (
  id uuid primary key default gen_random_uuid(),
  label text not null,          -- 表示名（例：オフィス、出張先A）
  prefecture text not null,     -- 都道府県
  city text not null,           -- 市区町村
  is_permanent boolean default false, -- 常設かどうか（オフィスなど）
  valid_until timestamptz,      -- 有効期限（期間限定の出張先などの場合）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 初期データの投入（仙台オフィス）
insert into public.system_locations (label, prefecture, city, is_permanent)
values ('オフィス', '宮城県', '仙台市', true)
on conflict do nothing;

-- RLS
alter table public.system_locations enable row level security;

-- 誰でも参照可能
create policy "system_locations_select_all" on public.system_locations for select using (true);

-- 管理者のみ編集可能
create policy "system_locations_admin_all" on public.system_locations for all using (public.is_admin());

