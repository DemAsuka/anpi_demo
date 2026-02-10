const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xzcrmxsqokugwqawceaa.supabase.co';
const supabaseKey = 'sb_secret_bmV0kL2Wfb2_e0rYmZDYfg_7GQ1QGb7';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
  const { error } = await supabase
    .from('system_locations')
    .update({ jma_code: 'test' })
    .match({ label: 'オフィス' });
  
  console.log('Update result:', error ? error.message : 'Success');
}

testUpdate();
