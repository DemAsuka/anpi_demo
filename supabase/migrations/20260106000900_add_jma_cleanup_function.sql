-- 古い不要な気象データを削除する関数
create or replace function public.cleanup_old_jma_entries()
returns void
language sql
security definer
as $$
  delete from public.jma_entries
  where 
    -- 7日以上前のデータ
    fetched_at < now() - interval '7 days'
    and 
    -- かつ、どのインシデント（安否通知）にも使われていないもの
    not exists (
      select 1 
      from public.incidents i 
      where i.jma_entry_key = public.jma_entries.entry_key
    );
$$;

