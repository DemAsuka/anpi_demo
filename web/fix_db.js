const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xzcrmxsqokugwqawceaa.supabase.co';
const supabaseKey = 'sb_secret_bmV0kL2Wfb2_e0rYmZDYfg_7GQ1QGb7';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDb() {
  console.log('--- Fixing system_locations ---');
  const { data: locations, error: locError } = await supabase
    .from('system_locations')
    .select('*');
  
  if (locError) {
    console.error('Error fetching locations:', locError);
    return;
  }

  for (const loc of locations) {
    let updates = {};
    
    // もし city が null で label に地名が入っていそうな場合
    if (!loc.city && loc.label) {
      // 簡易的な判定：label が「本番確認用」などの場合は無視
      if (loc.label === '熱真空試験') {
        updates.prefecture = '栃木県';
        updates.city = '宇都宮市';
        updates.jma_name = '宇都宮市';
        updates.jma_code = '0920100';
        updates.jma_area_name = '栃木県南部';
        updates.jma_area_code = '092';
      }
    }

    // もし city に「宮城県仙台市」のように都道府県が含まれている場合、分離する
    if (loc.city && loc.city.includes('宮城県仙台市')) {
      updates.prefecture = '宮城県';
      updates.city = '仙台市';
    } else if (loc.city && loc.city.includes('東京都新宿区')) {
      updates.prefecture = '東京都';
      updates.city = '新宿区';
    } else if (loc.city && loc.city.includes('埼玉県上里町')) {
      updates.prefecture = '埼玉県';
      updates.city = '上里町';
    } else if (loc.city && loc.city.includes('静岡県富士市')) {
      updates.prefecture = '静岡県';
      updates.city = '富士市';
    }

    if (Object.keys(updates).length > 0) {
      console.log(`Updating loc ${loc.id} (${loc.label}):`, updates);
      await supabase.from('system_locations').update(updates).eq('id', loc.id);
    }
  }
  console.log('Done.');
}

fixDb();
