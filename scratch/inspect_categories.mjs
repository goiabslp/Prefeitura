import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspectVehicleCategories() {
  const { data: vehicles, error } = await supabase.from('vehicles').select('id, model, type, vehicle_category, plate');
  if (error) {
    console.error(error);
    return;
  }
  console.log(`Total vehicles in DB: ${vehicles.length}`);
  
  const typeCounts = {};
  const catCounts = {};
  const combinedCounts = {};

  vehicles.forEach(v => {
    typeCounts[v.type] = (typeCounts[v.type] || 0) + 1;
    catCounts[v.vehicle_category] = (catCounts[v.vehicle_category] || 0) + 1;
    const fallback = v.vehicle_category || v.type;
    combinedCounts[fallback] = (combinedCounts[fallback] || 0) + 1;
  });

  console.log('Counts by v.type:', typeCounts);
  console.log('Counts by v.vehicle_category:', catCounts);
  console.log('Counts by fallback (v.vehicle_category || v.type):', combinedCounts);
  
  console.log('\nSample vehicles where vehicle_category is null or unexpected:');
  vehicles.filter(v => !v.vehicle_category).slice(0, 15).forEach(v => {
    console.log(`- ID: ${v.id}, Model: "${v.model}", Plate: "${v.plate}", Type: "${v.type}", vehicle_category: "${v.vehicle_category}"`);
  });
}

inspectVehicleCategories();
