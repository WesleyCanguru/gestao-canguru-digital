
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wtzphiyybitcucwkfpgv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uLQGmz7lWazPN1Uqb4_4vQ_HggVpMz9';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkClients() {
  const { data, error } = await supabase.from('clients').select('id, name, services, organic_reportei_url, paid_reportei_url');
  if (error) {
    console.error('Error fetching clients:', error);
    return;
  }
  console.log('Clients:', JSON.stringify(data, null, 2));
}

checkClients();
