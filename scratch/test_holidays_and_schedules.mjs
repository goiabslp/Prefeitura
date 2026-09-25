import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let env = '';
try {
  env = fs.readFileSync('.env', 'utf8');
} catch (e) {}

let url = '';
let key = '';

env.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.replace('VITE_SUPABASE_URL=', '').trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.replace('VITE_SUPABASE_ANON_KEY=', '').trim();
});

const supabase = createClient(url, key);

async function run() {
  const { data: events, error: errEvents } = await supabase
    .from('calendar_events')
    .select('id, title, type, start_date, end_date, is_recurring');
  console.log('Calendar events count:', events?.length, 'Sample:', events?.slice(0, 5), 'Error:', errEvents);

  const { data: schedules, error: errSchedules } = await supabase
    .from('vehicle_schedules')
    .select('id, driver_id, departure_date_time, return_date_time, status')
    .limit(5);
  console.log('Schedules count:', schedules?.length, 'Sample:', schedules, 'Error:', errSchedules);
}

run();
