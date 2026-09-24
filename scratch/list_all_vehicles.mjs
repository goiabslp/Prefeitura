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

async function list() {
  const { data: vehs, error } = await supabase.from('vehicles').select('*');
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('--- VEÍCULOS NO SUPABASE ---');
  vehs.forEach(v => {
    console.log(`ID: ${v.id} | Modelo: ${v.model} | Marca: ${v.brand} | Placa: "${v.plate}" | Cap: ${v.passenger_capacity} | Tipo: ${v.type}`);
  });
}

list();
