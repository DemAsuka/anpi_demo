-- 津波注意報・警報の通知メニューを追加

insert into public.activation_menus (
  menu_type,
  enabled,
  threshold,
  test_enabled,
  test_threshold,
  template,
  slack_channel
)
values (
  'tsunami',
  true,
  '{"keywords": ["津波注意報", "津波警報", "大津波警報"]}'::jsonb,
  false,
  '{"keywords": ["津波注意報"]}'::jsonb,
  '【安否確認（津波）】\n{warning_name}が発表されました。\n\n通知対象エリア：{target_summary}\n\n速やかに高台・避難場所へ移動してください。避難完了後、落ち着いたらWorkflowから安否回答をお願いします。\n※個人情報は記載しないでください。',
  'dm'
)
on conflict do nothing;
