import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing env variables");
  process.exit();
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('is_active', true)
        .or('client_status.eq.active,client_status.is.null');
        
  console.log("Error:", error);
  console.log("Data count:", data?.length);
  
  const { data: d2, error: e2 } = await supabase
        .from('clients')
        .select('name, client_status')
        .eq('is_active', true);
  console.log("Without OR error:", e2);
  console.log("First client without OR:", d2?.[0]);
}

check();
