import { supabase } from './lib/supabase';
async function test() {
  const { data, error } = await supabase.from('client_onboarding').select('*');
  console.log('client_onboarding length:', data?.length);
  console.log('client_onboarding error:', error);
}
test();
