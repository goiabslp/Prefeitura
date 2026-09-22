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

async function testMetadata() {
  const [vehiclesRes, sectorsRes] = await Promise.all([
    supabase.from('vehicles').select('id, plate, model, brand, sector_id, vehicle_image_url, photo_url, document_url'),
    supabase.from('sectors').select('id, name')
  ]);

  console.log('Vehicles fetched:', vehiclesRes.data?.length);
  console.log('Sectors fetched:', sectorsRes.data?.length);

  const sectorLookup = {};
  if (sectorsRes.data) {
    sectorsRes.data.forEach((s) => {
      sectorLookup[s.id] = s.name;
    });
  }

  const vMap = {};
  const registerVehicle = (v) => {
    if (!v) return;
    const plate = (v.plate || '').trim().toUpperCase();
    const cleanPlate = plate.replace(/[^A-Z0-9]/g, '');
    const id = v.id || '';
    const brand = (v.brand || '').trim();
    const model = (v.model || '').trim();
    const modelBrand = [model, brand].filter(Boolean).join(' - ') || model || brand || plate || 'Veículo';
    const sectorName = v.sector?.name || v.sector_name || (v.sector_id && sectorLookup[v.sector_id]) || 'N/A';

    console.log(`Vehicle ${plate}: sector_id=${v.sector_id}, resolved sectorName=${sectorName}`);

    const keys = [plate, cleanPlate, id, modelBrand].filter(Boolean);
    keys.forEach(k => {
      vMap[k] = sectorName;
    });
  };

  vehiclesRes.data.forEach(registerVehicle);

  console.log('vMap for TZB5G79:', vMap['TZB5G79']);
}

testMetadata();
