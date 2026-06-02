import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wtzphiyybitcucwkfpgv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uLQGmz7lWazPN1Uqb4_4vQ_HggVpMz9';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data, error } = await supabase.from('clients').select('id, name, client_status, created_at, updated_at, base_value, service_end_date').limit(10);
  console.log(data ? data : error);
}

main();
