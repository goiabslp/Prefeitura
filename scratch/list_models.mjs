import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function listAll() {
  const { data: vehicles } = await supabase.from('vehicles').select('id, model, type, vehicle_category, plate').order('model');
  console.log(`Total: ${vehicles.length}`);
  vehicles.forEach(v => {
    console.log(`[${v.plate}] Model: "${v.model}" | Type: ${v.type} | Cat: ${v.vehicle_category}`);
  });
}

listAll();
