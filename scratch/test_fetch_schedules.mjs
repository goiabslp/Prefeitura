import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const CHUNK_SIZE = 1000;
const SCHEDULE_COLUMNS = 'id, protocol, vehicle_id, driver_id, requester_person_id, requester_id, destination, service_sector_id, purpose, departure_date_time, return_date_time, vehicle_location, status, created_at, authorized_by_name, passengers, patient_count, companion_count, cancellation_reason, cancelled_at, cancelled_by';

async function testFetch() {
  let allData = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('vehicle_schedules')
      .select(SCHEDULE_COLUMNS)
      .order('departure_date_time', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + CHUNK_SIZE - 1);

    if (error) {
      console.error('Error:', error);
      break;
    }
    if (data && data.length > 0) {
      allData.push(...data);
      if (data.length < CHUNK_SIZE) hasMore = false;
      else from += CHUNK_SIZE;
    } else {
      hasMore = false;
    }
  }

  console.log('Total schedules fetched by getSchedules logic:', allData.length);
  const found = allData.find(s => s.protocol === 'OS-2026830569949');
  console.log('OS-2026830569949 found in getSchedules?:', Boolean(found));
  if (found) {
    console.log('Index in list:', allData.indexOf(found));
    console.log('Departure:', found.departure_date_time);
    console.log('Vehicle ID:', found.vehicle_id);
    console.log('Status:', found.status);
  }
}

testFetch();
