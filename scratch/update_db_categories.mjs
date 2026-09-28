import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function inferCategory(v) {
  if (v.vehicle_category && ['Carro', 'Moto', 'Van', 'Ônibus', 'Máquina Pesada', 'Caminhão', 'Acessórios'].includes(v.vehicle_category)) {
    return v.vehicle_category;
  }
  
  const m = (v.model || '').toUpperCase();
  const t = (v.type || '').toLowerCase();

  if (t === 'acessorio' || m.includes('HUSQ') || m.includes('MOTOSSERRA') || m.includes('ROÇADEIRA') || m.includes('ROCADEIRA')) {
    return 'Acessórios';
  }
  if (m.includes('MOTO') || m.includes('SHINERAY') || m.includes('BROSS') || m.includes('TITAN') || m.includes('FAN')) {
    return 'Moto';
  }
  if (m.includes('ONIBUS') || m.includes('ÔNIBUS') || m.includes('MICROONIBUS') || m.includes('MICRO-ÔNIBUS') || m.includes('MASCA')) {
    return 'Ônibus';
  }
  if (m.includes('VAN') || m.includes('MASTER') || m.includes('TRANSIT') || m.includes('DAILY') || m.includes('DUCATO') || m.includes('VACIMOVEL') || m.includes('AMBULANCIA')) {
    return 'Van';
  }
  if (m.includes('CAMINHÃO') || m.includes('CAMINHAO')) {
    return 'Caminhão';
  }
  if (m.includes('TRATOR') || m.includes('PATROL') || m.includes('CARREGADEIRA') || m.includes('RETROESCAVADEIRA') || m.includes('BOBCAT') || m.includes('MOTONIVELADORA') || m.includes('MÁQUINA') || m.includes('MAQUINA') || m.includes('LW300') || m.includes('XC870') || m.includes('MBL-X') || m.includes('4160D') || m.includes('W-130')) {
    return 'Máquina Pesada';
  }
  if (t === 'pesado') {
    return 'Máquina Pesada';
  }
  return 'Carro';
}

async function updateDbCategories() {
  const { data: vehicles, error } = await supabase.from('vehicles').select('*');
  if (error) {
    console.error('Error:', error);
    return;
  }

  let updatedCount = 0;
  for (const v of vehicles) {
    if (!v.vehicle_category) {
      const cat = inferCategory(v);
      const { error: updErr } = await supabase.from('vehicles').update({ vehicle_category: cat }).eq('id', v.id);
      if (updErr) {
        console.error(`Failed to update ${v.plate}:`, updErr);
      } else {
        updatedCount++;
        console.log(`Updated [${v.plate}] -> "${cat}"`);
      }
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} vehicles in DB!`);
}

updateDbCategories();
