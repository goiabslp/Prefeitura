import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) {
    env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspectOperationCodes() {
  const { data, error } = await supabase.from('operation_codes').select('*');
  console.log("operation_codes count:", data?.length, "error:", error);
  console.log("operation_codes rows:", JSON.stringify(data, null, 2));
}

inspectOperationCodes();
