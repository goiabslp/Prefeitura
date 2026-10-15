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
  const vehicleId = v?.[0]?.id;
  console.log('Argo:', v?.[0]);

  const { data: schedules } = await supabase.from('vehicle_schedules').select('*').eq('vehicle_id', vehicleId);
  console.log('Argo schedules count:', schedules?.length);
  schedules?.forEach(s => {
    console.log(s.id, s.protocol, s.departure_date_time, s.return_date_time, s.status, s.driver_id, s.destination);
  });

  const { data: sAll } = await supabase.from('vehicle_schedules').select('*');
  const argoOrOct = sAll?.filter(s => {
    const d = s.departure_date_time || '';
    return d.includes('2026-10') || (s.vehicle_id === vehicleId);
  });
  console.log('October or Argo schedules count:', argoOrOct?.length);
  argoOrOct?.forEach(s => {
    console.log('OCT/ARGO:', s.protocol, 'Veh:', s.vehicle_id === vehicleId ? 'ARGO' : s.vehicle_id, 'Dep:', s.departure_date_time, 'Ret:', s.return_date_time, 'Status:', s.status);
  });
}

run();
