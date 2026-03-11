-- system_status テーブルのRLSが外れている場合があるため、明示的に有効化する
alter table public.system_status enable row level security;

-- 既存のポリシーがあれば一度削除（安全のため）
drop policy if exists "system_status_admin_all" on public.system_status;
drop policy if exists "system_status_admin_read" on public.system_status;

-- 管理者のみフルアクセスのポリシーを再作成
create policy "system_status_admin_all" 
on public.system_status 
for all 
using (public.is_admin());
