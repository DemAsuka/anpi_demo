const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xzcrmxsqokugwqawceaa.supabase.co';
const supabaseKey = 'sb_secret_bmV0kL2Wfb2_e0rYmZDYfg_7GQ1QGb7';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumns() {
  console.log('--- Attempting to add missing columns to system_locations ---');
  
  const sql = `
    ALTER TABLE system_locations ADD COLUMN IF NOT EXISTS jma_code text;
    ALTER TABLE system_locations ADD COLUMN IF NOT EXISTS jma_name text;
    ALTER TABLE system_locations ADD COLUMN IF NOT EXISTS jma_area_name text;
    ALTER TABLE system_locations ADD COLUMN IF NOT EXISTS jma_area_code text;
  `;

  // Supabase doesn't have a direct 'query' method in the JS SDK.
  // We usually use RPC for this, but it must be defined in the DB.
  // Let's check if there's an 'exec_sql' or similar RPC.
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('Error adding columns via RPC:', error.message);
    console.log('\n--- Manual SQL to run in Supabase SQL Editor ---');
    console.log(sql);
  } else {
    console.log('Successfully added columns!');
  }
}

addColumns();
