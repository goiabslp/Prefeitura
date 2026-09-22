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

async function testSelectCorrect() {
  const { data, error } = await supabase.from('vehicles').select('id, plate, model, brand, sector_id, vehicle_image_url, document_url');
  console.log('Vehicles query error:', error);
  console.log('Vehicles query count:', data?.length);
  
  const { data: sectors } = await supabase.from('sectors').select('id, name');
  const sectorLookup = {};
  sectors.forEach(s => sectorLookup[s.id] = s.name);

  const tzb = data.find(v => v.plate === 'TZB5G79');
  console.log('TZB5G79 found:', tzb);
  console.log('Sector for TZB5G79:', sectorLookup[tzb?.sector_id]);
}

testSelectCorrect();
