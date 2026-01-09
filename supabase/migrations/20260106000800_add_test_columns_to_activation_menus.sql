-- activation_menus テーブルにテスト・訓練用のカラムを追加
alter table public.activation_menus add column if not exists test_threshold text;
alter table public.activation_menus add column if not exists test_keywords jsonb default '{"keywords": []}'::jsonb;

