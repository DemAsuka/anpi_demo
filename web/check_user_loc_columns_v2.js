const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xzcrmxsqokugwqawceaa.supabase.co';
const supabaseKey = 'sb_secret_bmV0kL2Wfb2_e0rYmZDYfg_7GQ1QGb7';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserLocColumns() {
  const { error } = await supabase
    .from('user_locations')
    .select('jma_area_code')
    .limit(1);
  console.log('Querying jma_area_code result:', error ? error.message : 'Success');
}

checkUserLocColumns();
