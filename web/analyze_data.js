const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xzcrmxsqokugwqawceaa.supabase.co';
const supabaseKey = 'sb_secret_bmV0kL2Wfb2_e0rYmZDYfg_7GQ1QGb7';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeHeavyRain() {
  console.log('--- Analyzing HeavyRain (Soya/Wakkanai) ---');
  
  // 直近の「気象警報・注意報」エントリを取得
  const { data: entries, error } = await supabase
    .from('jma_entries')
    .select('title, updated_at, raw_atom')
    .ilike('title', '%警報・注意報%')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${entries.length} recent weather warning entries.`);

  entries.forEach((e, i) => {
    const raw = e.raw_atom;
    const content = raw?.content?.['#text'] || '';
    const isSoya = content.includes('宗谷地方');
    const isWakkanai = content.includes('稚内市');
    
    console.log(`[${i}] ${e.updated_at} - ${e.title}`);
    console.log(`    Soya: ${isSoya}, Wakkanai: ${isWakkanai}`);
    if (isSoya) {
      console.log(`    Content snippet: ${content.substring(0, 100)}...`);
    }
  });
}

async function analyzeRecentEarthquake() {
  console.log('\n--- Analyzing Recent Earthquake XML ---');
  
  // 直近の地震エントリを取得
  const { data: entries, error } = await supabase
    .from('jma_entries')
    .select('title, updated_at, raw_atom, link')
    .eq('title', '震度速報')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error || !entries.length) {
    console.log('No recent earthquake entries found.');
    return;
  }

  const entry = entries[0];
  console.log(`Title: ${entry.title}`);
  console.log(`Updated: ${entry.updated_at}`);
  console.log(`Link: ${entry.link}`);
  
  // 震度速報（VXSE51）などは、この時点では震源地やマグニチュードが含まれないことが多い
  // 震源・震度に関する情報（VXSE53）で詳細が出る
}

analyzeHeavyRain();
analyzeRecentEarthquake();
