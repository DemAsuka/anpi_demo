-- activation_menusに試験用の設定カラムを追加
alter table public.activation_menus add column test_threshold jsonb not null default '{"keywords": []}'::jsonb;
alter table public.activation_menus add column test_enabled boolean not null default true;

-- 現在 threshold に入っているキーワードを test_threshold にコピー（移行措置）
update public.activation_menus set test_threshold = threshold;

-- 本番用の threshold は本来のデフォルト値にリセット（必要に応じて）
-- 例: 地震なら震度5弱などを想定
update public.activation_menus set threshold = '{"keywords": ["震度5弱", "震度5強", "震度6弱", "震度6強", "震度7"]}'::jsonb where menu_type = 'earthquake';
update public.activation_menus set threshold = '{"keywords": ["大津波警報", "津波警報"]}'::jsonb where menu_type = 'tsunami';
update public.activation_menus set threshold = '{"keywords": ["大雨特別警報"]}'::jsonb where menu_type = 'heavy_rain';
update public.activation_menus set threshold = '{"keywords": ["氾濫危険", "氾濫発生"]}'::jsonb where menu_type = 'flood';
update public.activation_menus set threshold = '{"keywords": ["国民保護", "Jアラート"]}'::jsonb where menu_type = 'civil_protection';

