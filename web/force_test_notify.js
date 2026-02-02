const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// .env.local から環境変数を読み込む
const envLocal = fs.readFileSync('./.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function forceTestNotify() {
  console.log('Starting force test notification...');

  // 1. 最新の「大雨危険度通知」を取得
  const { data: entries, error: entryError } = await supabase
    .from('jma_entries')
    .select('*')
    .eq('title', '大雨危険度通知')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (entryError || !entries.length) {
    console.error('Entry not found:', entryError);
    return;
  }
  const entry = entries[0];
  console.log('Using entry:', entry.title, entry.entry_key);

  // 2. 「flood」のルールを取得
  const { data: rules, error: ruleError } = await supabase
    .from('activation_menus')
    .select('*')
    .eq('menu_type', 'flood')
    .single();

  if (ruleError || !rules) {
    console.error('Rule not found:', ruleError);
    return;
  }

  // 3. 重複チェックを回避するために incidents から該当の entry_key を一時的に削除（もしあれば）
  await supabase.from('incidents').delete().eq('jma_entry_key', entry.entry_key).eq('mode', 'test');

  // 4. APIを叩いて通知をトリガーする
  // Vercelにデプロイされている場合はURLを、ローカルの場合は localhost を使用
  // ここでは直接 route.ts のロジックを模倣して実行するか、デプロイ済みのURLを叩く
  // 安全のため、URLを叩く形にする（トークンが必要）
  const baseUrl = 'https://anpi-demo.vercel.app'; // 実際のURLに合わせて修正が必要な場合があります
  const token = env.CRON_SECRET;
  
  console.log('Triggering notification via API...');
  // 実際には cron 実行を待つか、手動で incidents を作成して通知ロジックを走らせる必要があります。
  // ここでは、現在の route.ts のロジックが「未処理の changed」に対して動くため、
  // content_hash を書き換えて「変更あり」と認識させます。
  
  const fakeHash = 'force_test_' + Date.now();
  const { error: updateError } = await supabase
    .from('jma_entries')
    .update({ content_hash: fakeHash })
    .eq('entry_key', entry.entry_key);

  if (updateError) {
    console.error('Failed to update hash:', updateError);
    return;
  }

  console.log('Hash updated. Please run the Vercel Cron or wait for the next run.');
  console.log('Alternatively, you can call the API directly if you have the URL and token.');
}

forceTestNotify();
