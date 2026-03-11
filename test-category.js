import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wtzphiyybitcucwkfpgv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uLQGmz7lWazPN1Uqb4_4vQ_HggVpMz9';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      client_id: '00000000-0000-0000-0000-000000000000', // We need a real client_id to test
      title: 'test',
      file_name: 'test.pdf',
      file_path: 'test.pdf',
      file_type: 'application/pdf',
      category: 'custom_category'
    });
  console.log(error);
}
test();
