-- system_locations に対象ユーザーグループを追加
alter table public.system_locations add column if not exists target_group text default 'all';
-- 'all' (全社員), 'corporate' (コーポレート)
