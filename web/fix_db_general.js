const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('fs');

const supabaseUrl = 'https://xzcrmxsqokugwqawceaa.supabase.co';
const supabaseKey = 'sb_secret_bmV0kL2Wfb2_e0rYmZDYfg_7GQ1QGb7';

const supabase = createClient(supabaseUrl, supabaseKey);

// マスターデータの読み込み
const locationMaster = JSON.parse(fs.readFileSync('./src/lib/jma/location-master.json', 'utf8'));

function findJmaMatch(prefInput, cityInput) {
  if (!prefInput || !cityInput) return null;
  const pInput = prefInput.trim();
  const cInput = cityInput.trim();
  const prefData = locationMaster.find(p => 
    p.pref.includes(pInput) || pInput.includes(p.pref.replace(/都|道|府|県$/, ""))
  );
  if (!prefData) return null;
  const cityData = prefData.cities.find((c) => 
    c.name.includes(cInput) || cInput.includes(c.name.replace(/市|区|町|村$/, ""))
  );
  if (!cityData) return null;
  return {
    prefecture: prefData.pref,
    city: cityData.name,
    jma_code: cityData.code,
    jma_name: cityData.name,
    jma_area_name: cityData.area_name,
    jma_area_code: cityData.area_code
  };
}

async function fixDb() {
  console.log('--- Fixing system_locations (General) ---');
  const { data: locations, error: locError } = await supabase
    .from('system_locations')
    .select('*');
  
  if (locError) {
    console.error('Error fetching locations:', locError);
    return;
  }

  for (const loc of locations) {
    let updates = {};
    
    // ラベルから地名を推測する（手動登録されたがAPIが古くて保存されなかったもの）
    if (!loc.prefecture || !loc.city) {
      // ラベルが地名そのものの場合や、特定のキーワードを含む場合
      let searchPref = "";
      let searchCity = "";

      if (loc.label === '熱真空試験' || loc.label.includes('宇都宮')) {
        searchPref = "栃木県";
        searchCity = "宇都宮市";
      } else if (loc.label === '本番確認用' || loc.label.includes('稚内')) {
        searchPref = "北海道";
        searchCity = "稚内市";
      } else if (loc.label === '本番' || loc.label.includes('稚内')) {
        searchPref = "北海道";
        searchCity = "稚内市";
      }

      if (searchPref && searchCity) {
        const match = findJmaMatch(searchPref, searchCity);
        if (match) {
          updates = match;
        }
      }
    }

    // 既存の不備（都道府県がcityに入ってしまっている等）を修正
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
