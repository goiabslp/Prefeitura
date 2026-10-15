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

async function findTrip() {
  console.log("=== BUSCANDO VEÍCULO ===");
  const { data: vehicles } = await supabase.from('vehicles').select('*');
  const argo = vehicles?.filter(v => JSON.stringify(v).toLowerCase().includes('txy2g82') || JSON.stringify(v).toLowerCase().includes('argo'));
  console.log("Veículos encontrados:", JSON.stringify(argo, null, 2));

  console.log("\n=== BUSCANDO EM VEHICLE_SCHEDULES ===");
  const { data: schedules } = await supabase.from('vehicle_schedules').select('*');
  const matchedSchedules = schedules?.filter(s => {
    const str = JSON.stringify(s).toLowerCase();
    return str.includes('txy2g82') || str.includes('2026-10-14') || (argo && argo.some(a => s.vehicle_id === a.id));
  });
  console.log("Schedules encontrados:", matchedSchedules?.length);
  matchedSchedules?.forEach(s => {
    console.log({
      id: s.id,
      protocol: s.protocol,
      vehicle_id: s.vehicle_id,
      departure: s.departure_date_time,
      return: s.return_date_time,
      status: s.status,
      destination: s.destination,
      driver_id: s.driver_id,
      authorized_by_name: s.authorized_by_name
    });
  });

  console.log("\n=== BUSCANDO EM DIARIAS_EVENTOS ===");
  const { data: diarias } = await supabase.from('diarias_eventos').select('*');
  const matchedDiarias = diarias?.filter(d => {
    const str = JSON.stringify(d).toLowerCase();
    return str.includes('txy2g82') || str.includes('2026-10-14') || str.includes('argo');
  });
  console.log("Diárias encontradas:", matchedDiarias?.length);
  matchedDiarias?.forEach(d => {
    console.log({
      id: d.id,
      data_saida: d.data_saida,
      data_retorno: d.data_retorno,
      veiculo: d.veiculo,
      veiculo_outro: d.veiculo_outro,
      status: d.status,
      destino: d.destino,
      user_name: d.user_name,
      pessoas: d.pessoas
    });
  });
}

findTrip();
