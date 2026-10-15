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
  const { data: v } = await supabase.from('vehicles').select('*').ilike('plate', '%TXY%');
  console.log('Argo vehicle:', v);
  const vehicleId = v?.[0]?.id;

  const { data: schedules } = await supabase.from('vehicle_schedules').select('*').eq('vehicle_id', vehicleId);
  console.log('Total schedules for Argo:', schedules?.length);
  schedules?.forEach(s => {
    console.log('Schedule:', {
      id: s.id,
      departure: s.departure_date_time,
      return: s.return_date_time,
      status: s.status,
      driver_id: s.driver_id,
      destination: s.destination,
      protocol: s.protocol
    });
  });

  const { data: all14 } = await supabase.from('vehicle_schedules').select('*');
  const filtered14 = all14?.filter(s => JSON.stringify(s).includes('2026-10-14'));
  console.log('All schedules mentioning 2026-10-14:', filtered14?.length);
  filtered14?.forEach(s => {
    console.log('Schedule on 14:', {
      id: s.id,
      vehicle_id: s.vehicle_id,
      departure: s.departure_date_time,
      return: s.return_date_time,
      status: s.status,
      driver_id: s.driver_id,
      protocol: s.protocol,
      destination: s.destination
    });
  });

  const { data: diarias } = await supabase.from('diarias_eventos').select('*');
  const dArgo = diarias?.filter(d => JSON.stringify(d).includes('TXY2G82') || JSON.stringify(d).toLowerCase().includes('argo'));
  console.log('Diarias for Argo:', dArgo?.length);
  dArgo?.forEach(d => {
    console.log('Diaria Argo:', {
      id: d.id,
      saida: d.data_saida,
      retorno: d.data_retorno,
      veiculo: d.veiculo,
      veiculo_outro: d.veiculo_outro,
      status: d.status,
      pessoas: d.pessoas
    });
  });

  const d14 = diarias?.filter(d => JSON.stringify(d).includes('2026-10-14'));
  console.log('Diarias mentioning 2026-10-14:', d14?.length);
  d14?.forEach(d => {
    console.log('Diaria 14:', {
      id: d.id,
      veiculo: d.veiculo,
      veiculo_outro: d.veiculo_outro,
      saida: d.data_saida,
      retorno: d.data_retorno,
      status: d.status
    });
  });
}

run();
