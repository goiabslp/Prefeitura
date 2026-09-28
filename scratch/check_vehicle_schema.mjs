import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('vehicles').select('*').limit(3);
  if (error) {
    console.error('Error fetching vehicles:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in vehicles table:', Object.keys(data[0]));
    console.log('Sample vehicle:', data[0]);
  } else {
    console.log('No vehicles found');
  }
}

run();
