-- 安否確認ツール MVP: 初期スキーマ
-- 運用方針:
-- - サーバー側（Vercel/Next.js）からは Service Role で書き込み（RLSバイパス）
-- - 管理画面（Supabase Authでログイン）からは RLSで admin のみ参照可能

create extension if not exists pgcrypto;

-- 管理者判定: auth.users の user_id を登録して admin 化する
create table if not exists public.admin_users (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "admin_users_select_own"
on public.admin_users
for select
using (auth.uid() = user_id);

-- RLS用ヘルパー
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
  );
$$;

-- 発動条件メニュー（震度/津波/豪雨/河川氾濫/国民保護）
create table if not exists public.activation_menus (
  id uuid primary key default gen_random_uuid(),
  menu_type text not null, -- "earthquake" | "tsunami" | "heavy_rain" | "flood" | "civil_protection"
  enabled boolean not null default true,
  cooldown_minutes integer not null default 60,
  target jsonb not null default '{}'::jsonb,      -- 対象地域など（一次は大まかでOK）
  threshold jsonb not null default '{}'::jsonb,   -- 閾値（例: {"max_intensity":"5-"}）
  action jsonb not null default '{}'::jsonb,      -- 発動アクション（例: {"create_incident":true}）
  slack_channel text,
  template text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.activation_menus enable row level security;
create policy "activation_menus_admin_read"
on public.activation_menus
for select
using (public.is_admin());

-- 気象庁 Atom エントリ（重複排除・更新判定の基礎）
create table if not exists public.jma_entries (
  id uuid primary key default gen_random_uuid(),
  entry_key text not null unique,
  source_feed text not null,
  title text,
  updated_at timestamptz,
  link text,
  content_hash text not null,
  raw_atom jsonb,
  fetched_at timestamptz not null default now()
);

alter table public.jma_entries enable row level security;
create policy "jma_entries_admin_read"
on public.jma_entries
for select
using (public.is_admin());

create index if not exists idx_jma_entries_updated_at on public.jma_entries (updated_at desc);

-- 安否確認インシデント（回答収集の単位）
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active', -- active|cancelled|closed
  menu_type text not null,
  jma_entry_key text, -- source_event_key の簡易版（一次は Atom entry_key を保持）
  title text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  slack_channel text,
  slack_thread_ts text,
  created_at timestamptz not null default now()
);

alter table public.incidents enable row level security;
create policy "incidents_admin_read"
on public.incidents
for select
using (public.is_admin());

create index if not exists idx_incidents_started_at on public.incidents (started_at desc);

-- 回答（Slack Workflow Builder からのWebhookを想定）
create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.incidents(id) on delete set null,
  slack_user_id text,
  status text,         -- safe|minor|serious|help 等（Workflowの値に合わせる）
  comment text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.responses enable row level security;
create policy "responses_admin_read"
on public.responses
for select
using (public.is_admin());

create index if not exists idx_responses_incident_id on public.responses (incident_id);
create index if not exists idx_responses_created_at on public.responses (created_at desc);

-- 監査ログ（一次は最小）
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;
create policy "audit_logs_admin_read"
on public.audit_logs
for select
using (public.is_admin());

