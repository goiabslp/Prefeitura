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

async function restore() {
  const { error: delErr } = await supabase
    .from('vehicle_schedules')
    .delete()
    .eq('id', '1728eef5-5990-44a7-93d4-fe4fe4da7c41');
  
  if (!delErr) {
    console.log("Deletado para restauração...");
  }
}
restore();
