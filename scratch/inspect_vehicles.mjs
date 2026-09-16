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

async function inspect() {
  const { data: v, error: vErr } = await supabase.from('vehicles').select('id, model, plate, brand, type, vehicle_category, status, available_for_scheduling, passenger_capacity').limit(5);
  console.log('Vehicles (5 amostras):', vErr ? vErr : v);

  const { data: s, error: sErr } = await supabase.from('vehicle_schedules').select('id, vehicle_id, status, departure_date_time, return_date_time').limit(10);
  console.log('Schedules (10 amostras):', sErr ? sErr : s);

  // Statuses distintos presentes em vehicle_schedules
  const { data: allS } = await supabase.from('vehicle_schedules').select('status');
  const distinctStatuses = [...new Set(allS?.map(x => x.status))];
  console.log('Status distintos em vehicle_schedules:', distinctStatuses);
}
inspect();
