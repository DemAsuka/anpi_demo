-- 避難情報（避難指示、緊急安全確保）の通知メニューを追加

insert into public.activation_menus (
  menu_type,
  enabled,
  cooldown_minutes,
  threshold,
  template
)
values (
  'evacuation',
  true,
  120,
  '{"keywords": ["避難指示", "緊急安全確保"]}'::jsonb,
  '【安否確認（避難情報）】\n気象庁情報：{warning_name} が発表されました。\n対象エリア：{target_summary}\n周囲の状況を確認し、直ちに安全な場所へ避難してください。避難完了後、落ち着いたらWorkflowから安否回答をお願いします。\n※個人情報は記載しないでください。'
)
on conflict do nothing;
