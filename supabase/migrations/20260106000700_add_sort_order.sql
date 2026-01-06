-- system_locations と user_locations に表示順カラムを追加
alter table public.system_locations add column if not exists sort_order integer default 51;
alter table public.user_locations add column if not exists sort_order integer default 71;

-- 既存の固定地点に表示順を設定
update public.system_locations set sort_order = 0 where label = 'オフィス';
update public.system_locations set sort_order = 21 where label = 'CL事業①';
update public.system_locations set sort_order = 22 where label = 'CL事業②';
update public.system_locations set sort_order = 23 where label = 'CL事業③';

