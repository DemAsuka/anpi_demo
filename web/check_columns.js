const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xzcrmxsqokugwqawceaa.supabase.co';
const supabaseKey = 'sb_secret_bmV0kL2Wfb2_e0rYmZDYfg_7GQ1QGb7';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('--- Checking columns of system_locations ---');
  // ダミーのクエリを投げてエラー詳細からカラムを確認するか、rpcで情報スキーマを叩く
  // ここでは単純に1件取得して、返ってくるオブジェクトのキーを確認する
  const { data, error } = await supabase
    .from('system_locations')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Columns found:', Object.keys(data[0]));
  } else {
    console.log('No data found in system_locations to check columns.');
    // データがない場合は、存在しないはずのカラムを指定してエラーを出させてみる
    const { error: error2 } = await supabase
      .from('system_locations')
      .select('jma_area_code')
      .limit(1);
    console.log('Querying jma_area_code result:', error2 ? error2.message : 'Success');
  }
}

checkColumns();
