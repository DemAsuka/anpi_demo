const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xzcrmxsqokugwqawceaa.supabase.co';
const supabaseKey = 'sb_secret_bmV0kL2Wfb2_e0rYmZDYfg_7GQ1QGb7';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  console.log('--- Checking system_locations ---');
  const { data: locations, error: locError } = await supabase
    .from('system_locations')
    .select('*')
    .order('sort_order');
  
  if (locError) {
    console.error('Error fetching locations:', locError);
  } else {
    console.table(locations.map(l => ({
      sort_order: l.sort_order,
      label: l.label,
      prefecture: l.prefecture,
      city: l.city,
      jma_name: l.jma_name,
      jma_code: l.jma_code
    })));
  }

  console.log('\n--- Checking recent production incidents ---');
  const { data: incidents, error: incError } = await supabase
    .from('incidents')
    .select('*')
    .eq('mode', 'production')
    .order('created_at', { ascending: false })
    .limit(5);

  if (incError) {
    console.error('Error fetching incidents:', incError);
  } else {
    console.table(incidents.map(i => ({
      id: i.id,
      title: i.title,
      mode: i.mode,
      created_at: i.created_at
    })));
  }
}

checkDb();
