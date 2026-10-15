import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: s } = await supabase.from('vehicle_schedules').select('*').eq('protocol', 'OS-2026830569949').single();
  const { data: v } = await supabase.from('vehicles').select('*').eq('id', s.vehicle_id).single();
  console.log('SCHEDULE:', s);
  console.log('VEHICLE:', v);
}
run();
