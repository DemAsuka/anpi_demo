-- system_locations テーブルの制約を緩和し、1つのカラムだけでも保存できるようにする
alter table public.system_locations alter column prefecture drop not null;
alter column city drop not null;

-- カラムが足りない場合に備えて address カラムを念のため追加（将来的な統合用）
alter table public.system_locations add column if not exists address text;

