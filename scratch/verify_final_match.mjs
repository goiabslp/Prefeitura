import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parseISO, format, isValid } from 'date-fns';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const cleanPlate = (p) => (p || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

async function testCurrentCode() {
  const { data: vehicles } = await supabase.from('vehicles').select('*');
  const { data: schedules } = await supabase.from('vehicle_schedules').select('*');
  const { data: persons } = await supabase.from('persons').select('*');

  const rawInput = 'FIAT ARGO • TXY2G82';
  const selectedVehicleId = '';
  const fineDate = '2026-10-14';
  const fineTime = '09:00';

  const extractedPlate = rawInput.replace(/[^A-Za-z0-9]/g, '').match(/[A-Za-z]{3}[0-9][A-Za-z0-9][0-9]{2}/)?.[0]?.toUpperCase();

  const matchedVehicle = vehicles.find(v => {
    if (selectedVehicleId && v.id === selectedVehicleId) return true;
    const vPlateClean = cleanPlate(v.plate);
    if (!vPlateClean) return false;
    if (extractedPlate && vPlateClean === extractedPlate) return true;
    if (rawInput) {
      const inputClean = cleanPlate(rawInput);
      if (inputClean === vPlateClean) return true;
      if (inputClean.length >= 7 && inputClean.includes(vPlateClean)) return true;
      const brandModelPlate = `${v.brand ? `${v.brand} ` : ''}${v.model} • ${v.plate}`.toLowerCase();
      if (brandModelPlate === rawInput.toLowerCase()) return true;
    }
    return false;
  });

  const effectiveVehicleId = matchedVehicle?.id || selectedVehicleId;
  const targetPlateClean = extractedPlate || cleanPlate(matchedVehicle?.plate || rawInput);
  const targetVehicleObj = matchedVehicle || vehicles.find(v => 
    (effectiveVehicleId && v.id === effectiveVehicleId) ||
    (targetPlateClean && cleanPlate(v.plate) === targetPlateClean)
  );

  const [hours, minutes] = fineTime.split(':').map(Number);
  const infractionTarget = new Date(`${fineDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  const infractionTimestamp = infractionTarget.getTime();

  const matches = [];

  schedules.forEach(s => {
    if (s.status === 'cancelado') return;
    const scheduleVehicle = vehicles.find(v => v.id === s.vehicle_id);
    const isVehicleDirectMatch = Boolean(effectiveVehicleId && s.vehicle_id === effectiveVehicleId);
    const schedulePlateClean = cleanPlate(scheduleVehicle?.plate);
    const isPlateMatch = Boolean(
      targetPlateClean && 
      schedulePlateClean && 
      (schedulePlateClean === targetPlateClean || schedulePlateClean.includes(targetPlateClean) || targetPlateClean.includes(schedulePlateClean))
    );

    if (!isVehicleDirectMatch && !isPlateMatch) return;

    const depDate = parseISO(s.departure_date_time);
    const retDate = parseISO(s.return_date_time);
    if (!isValid(depDate) || !isValid(retDate)) return;

    const depTime = depDate.getTime();
    const retTime = retDate.getTime();
    const isInInterval = infractionTimestamp >= depTime && infractionTimestamp <= retTime;
    const sDepDay = format(depDate, 'yyyy-MM-dd');
    const sRetDay = format(retDate, 'yyyy-MM-dd');
    const isSameDayMatch = (fineDate >= sDepDay && fineDate <= sRetDay);

    if (isInInterval || (isSameDayMatch && (infractionTimestamp >= depTime - 4 * 3600000 && infractionTimestamp <= retTime + 4 * 3600000))) {
      const driverPerson = persons.find(p => p.id === s.driver_id);
      const displayVehicle = targetVehicleObj || scheduleVehicle;
      matches.push({
        protocol: s.protocol,
        driver: driverPerson ? driverPerson.name : s.authorized_by_name,
        departure: s.departure_date_time,
        return: s.return_date_time,
        destination: s.destination,
        vehicleModel: displayVehicle ? `${displayVehicle.brand} ${displayVehicle.model}` : '',
        vehiclePlate: displayVehicle?.plate
      });
    }
  });

  console.log('MATCHES FOUND:', matches.length);
  console.log(JSON.stringify(matches, null, 2));
}

testCurrentCode();
