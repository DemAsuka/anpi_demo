const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xzcrmxsqokugwqawceaa.supabase.co';
const supabaseKey = 'sb_secret_bmV0kL2Wfb2_e0rYmZDYfg_7GQ1QGb7';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateKeywords() {
  console.log('--- Updating Keywords (UTF-8) ---');
  
  const updates = [
    { menu_type: 'flood', keywords: ['大雨', '洪水', '氾濫', '浸水'] },
    { menu_type: 'tsunami', keywords: ['津波'] },
    { menu_type: 'heavy_rain', keywords: ['大雨', '特別警報'] }
  ];

  for (const u of updates) {
    const { error } = await supabase
      .from('activation_menus')
      .update({ threshold: { keywords: u.keywords } })
      .eq('menu_type', u.menu_type);
    
    console.log(`Update ${u.menu_type}: ${error ? error.message : 'Success'}`);
  }
}

updateKeywords();
