-- システムステータス監視用のテーブル
create table if not exists public.system_status (
  id text primary key, -- 'jma_receiver' など
  last_success_at timestamptz not null default now(),
  status text not null default 'ok', -- 'ok', 'warning', 'error'
  metadata jsonb default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 初期レコード投入
insert into public.system_status (id, status)
values ('jma_receiver', 'ok')
on conflict (id) do nothing;

-- RLS
alter table public.system_status enable row level security;
create policy "system_status_admin_all" on public.system_status for all using (public.is_admin());

