const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xzcrmxsqokugwqawceaa.supabase.co';
const supabaseKey = 'sb_secret_bmV0kL2Wfb2_e0rYmZDYfg_7GQ1QGb7';
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeData() {
  const { data, error } = await supabase
    .from('jma_entries')
    .select('title, updated_at, raw_atom')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  console.log('--- JMA ENTRIES ANALYSIS ---');
  const stats = {};
  data.forEach(entry => {
    stats[entry.title] = (stats[entry.title] || 0) + 1;
  });

  console.log('Disaster Titles Summary:');
  console.log(JSON.stringify(stats, null, 2));

  console.log('\nSample Entries:');
  data.slice(0, 20).forEach(entry => {
    console.log(`[${entry.updated_at}] ${entry.title}`);
  });
}

analyzeData();

