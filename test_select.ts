import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wtzphiyybitcucwkfpgv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uLQGmz7lWazPN1Uqb4_4vQ_HggVpMz9';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data, error } = await supabase.from('posts').select('*').eq('date_key', 'test_rls');
  console.log('Select error:', error);
  console.log('Select data:', data);
}

main();
