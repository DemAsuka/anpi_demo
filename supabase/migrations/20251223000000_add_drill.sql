-- 防災訓練機能の追加
alter table public.incidents add column is_drill boolean not null default false;
create index if not exists idx_incidents_is_drill on public.incidents (is_drill);

-- 初期データの投入（activation_menus）
-- 既にデータがある場合は無視
insert into public.activation_menus (menu_type, enabled, cooldown_minutes, template)
values 
  ('earthquake', true, 60, '【安否確認（地震）】\n地震を検知しました（最大震度 {max_shindo}）。\n対象目安：{target_summary}\n今いる場所の状況をもとに、Slackの安否確認Workflowから回答してください（無事/軽傷/重傷/要救助）。\n※コメント欄に住所・電話番号などの個人情報は書かないでください。'),
  ('tsunami', true, 60, '【安否確認（津波）】\n津波情報（{tsunami_level}）を受信しました。\n対象目安：{target_summary}\n沿岸部の方は直ちに安全確保・避難を優先し、落ち着いたらWorkflowから安否回答してください。'),
  ('heavy_rain', true, 180, '【安否確認（豪雨）】\n気象庁情報：{warning_name} を検知しました。\n対象目安：{target_summary}\n安全確保を優先のうえ、可能になり次第Workflowから安否回答してください。'),
  ('flood', true, 180, '【安否確認（河川氾濫）】\n河川関連情報：{flood_level} を検知しました。\n対象目安：{target_summary}\n危険な場所から離れ、安全確保を優先してください。'),
  ('civil_protection', true, 60, '【安否確認（国民保護）】\n国民保護情報を受信しました：{title_or_type}\nまず身の安全確保を最優先にしてください。')
on conflict do nothing;


