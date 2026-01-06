-- ユーザープロファイルと地点登録用のテーブル追加

-- プロファイルテーブル（Clerkのユーザーと紐付け）
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  slack_user_id text,
  department text,
  is_admin_flag boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 地点登録テーブル（1ユーザー最大4地点）
create table if not exists public.user_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_type text not null, -- 'home', 'parents', 'office', 'other'
  display_name text not null, -- 表示用（例：自宅、実家）
  prefecture text not null,   -- 都道府県
  city text not null,         -- 市区町村
  city_code text,            -- 気象庁地域コード（将来用）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_locations_limit check (location_type in ('home', 'parents', 'office', 'other'))
);

-- インデックス作成
create index if not exists idx_user_locations_user_id on public.user_locations (user_id);

-- RLS設定
alter table public.profiles enable row level security;
alter table public.user_locations enable row level security;

-- 自分のプロファイルは誰でも参照・更新可能
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- 管理者は全プロファイルを参照可能
create policy "profiles_admin_all" on public.profiles for all using (public.is_admin());

-- 自分の地点は誰でも参照・登録・更新・削除可能
create policy "user_locations_select_own" on public.user_locations for select using (auth.uid() = user_id);
create policy "user_locations_insert_own" on public.user_locations for insert with check (auth.uid() = user_id);
create policy "user_locations_update_own" on public.user_locations for update using (auth.uid() = user_id);
create policy "user_locations_delete_own" on public.user_locations for delete using (auth.uid() = user_id);

-- 管理者は全地点を参照可能
create policy "user_locations_admin_all" on public.user_locations for select using (public.is_admin());

-- admin_users テーブルとプロファイルの同期用フラグ（既存の判定関数を強化）
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
  ) or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.is_admin_flag = true
  );
$$;

