-- user_locations テーブルの制約を緩和し、addressカラムを追加
alter table public.user_locations alter column prefecture drop not null;
alter table public.user_locations alter column city drop not null;

alter table public.user_locations add column if not exists address text;

