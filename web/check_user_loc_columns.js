const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xzcrmxsqokugwqawceaa.supabase.co';
const supabaseKey = 'sb_secret_bmV0kL2Wfb2_e0rYmZDYfg_7GQ1QGb7';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserLocColumns() {
  console.log('--- Checking columns of user_locations ---');
  const { data, error } = await supabase
    .from('user_locations')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Columns found:', Object.keys(data[0]));
  } else {
    console.log('No data found in user_locations.');
  }
}

checkUserLocColumns();
