const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// .env.local から環境変数を読み込む
const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Starting keyword update...');

  // 1. 豪雨・大雪（警報に限定）
  const { error: err1 } = await supabase.from('activation_menus').update({
    threshold: { keywords: ['大雨警報', '大雪警報', '暴風雪警報', '特別警報', '顕著な大雪'] },
    test_threshold: { keywords: ['警報', '大雪'] }
  }).eq('menu_type', 'heavy_rain');
  if (err1) console.error('Error heavy_rain:', err1);

  // 2. 国民保護（広めに設定）
  const { error: err2 } = await supabase.from('activation_menus').update({
    threshold: { keywords: ['国民保護', 'Jアラート', 'J-ALERT', 'ミサイル', '避難指示'] },
    test_threshold: { keywords: ['国民保護', 'テスト'] }
  }).eq('menu_type', 'civil_protection');
  if (err2) console.error('Error civil_protection:', err2);

  // 3. 地震
  const { error: err3 } = await supabase.from('activation_menus').update({
    threshold: { keywords: ['震源・震度', '震度速報'] },
    test_threshold: { keywords: ['震度'] }
  }).eq('menu_type', 'earthquake');
  if (err3) console.error('Error earthquake:', err3);

  console.log('Update completed.');
}

run();
