-- incidentsテーブルにmodeカラムを追加
alter table public.incidents add column mode text not null default 'production';

-- 既存のis_drillフラグに基づいてmodeを更新
update public.incidents set mode = 'drill' where is_drill = true;

-- インデックス作成
create index if not exists idx_incidents_mode on public.incidents (mode);

-- modeに制約を追加
alter table public.incidents add constraint incidents_mode_check 
  check (mode in ('production', 'drill', 'test'));

