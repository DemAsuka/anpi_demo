const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xzcrmxsqokugwqawceaa.supabase.co';
const supabaseKey = 'sb_secret_bmV0kL2Wfb2_e0rYmZDYfg_7GQ1QGb7';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumns() {
  console.log('--- Adding event_id and info_type to incidents ---');
  
  const sql = `
    ALTER TABLE incidents ADD COLUMN IF NOT EXISTS event_id text;
    ALTER TABLE incidents ADD COLUMN IF NOT EXISTS info_type text;
    CREATE INDEX IF NOT EXISTS idx_incidents_event_id ON incidents(event_id);
  `;

  // We'll try to use the same RPC method as before, knowing it might fail but giving the user the SQL.
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.log('\n--- Manual SQL to run in Supabase SQL Editor ---');
    console.log(sql);
  } else {
    console.log('Successfully added columns!');
  }
}

addColumns();
