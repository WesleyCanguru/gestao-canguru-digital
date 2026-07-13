import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wtzphiyybitcucwkfpgv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uLQGmz7lWazPN1Uqb4_4vQ_HggVpMz9';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data, error } = await supabase.from('contract_forms').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Contract Form Record Keys:', data[0] ? Object.keys(data[0]) : 'No records');
    console.log('Sample Record:', data[0]);
  }
}

main();
