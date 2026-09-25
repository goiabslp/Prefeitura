import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = fs.readFileSync('.env', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.replace('VITE_SUPABASE_URL=', '').trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.replace('VITE_SUPABASE_ANON_KEY=', '').trim();
});
const supabase = createClient(url, key);

const duplicateIdToRemove = '14bb9f79-a282-490a-b210-1c0c2584026f';
const targetIdToKeep = '7e1a30d6-bc38-4302-8399-19f052f5697d';

async function mergeVehicles() {
  console.log('=== INICIANDO UNIFICAÇÃO DOS CADASTROS DA PLACA UAE1J55 ===');

  // 1. Atualizar todas as tabelas dependentes (se houver algo no duplicateId)
  const tables = [
    'vehicle_schedules',
    'trips',
    'fleet_maintenances',
    'fleet_parts',
    'fleet_purchases',
    'fleet_oil_changes',
    'fleet_fuel_records',
    'fleet_occurrences',
    'fleet_fines',
    'fleet_tires',
    'vehicle_checklists',
    'maintenance_orders'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .update({ vehicle_id: targetIdToKeep })
        .eq('vehicle_id', duplicateIdToRemove)
        .select();

      if (!error && data && data.length > 0) {
        console.log(`Migrados ${data.length} registros da tabela [${table}] para o veículo principal.`);
      }
    } catch (e) {
      // Ignora erro caso tabela não exista
    }
  }

  // 2. Consolidar todos os dados no veículo mantido
  const consolidatedVehicleData = {
    model: 'MASTER RAY L3PAS',
    brand: 'RENAULT',
    plate: 'UAE1J55',
    year: '2026/2027',
    color: 'BRANCA',
    renavam: '01502781350',
    chassis: '93YF62S05VJ576234',
    type: 'pesado',
    vehicle_category: 'Ônibus',
    passenger_capacity: 16,
    current_km: 11797,
    max_kml: 12,
    min_kml: 8,
    request_manager_ids: [
      'dd84a286-a13f-46ed-a33e-b86512d3fcdd',
      '021a8aa8-34e1-40f4-b44b-02719c5391c5'
    ],
    sector_id: '7cb6c572-50b8-42ef-bd46-afcab8d56db7',
    responsible_person_id: '4a3b51df-cb15-4ba4-bdc0-f3b92ad685ea',
    fuel_types: ['DIESEL'],
    status: 'operacional',
    maintenance_status: 'em_dia',
    available_for_scheduling: 'Sim',
    oil_calculation_base: 5000,
    timing_belt_calculation_base: 50000
  };

  const { data: updatedVehicle, error: updateErr } = await supabase
    .from('vehicles')
    .update(consolidatedVehicleData)
    .eq('id', targetIdToKeep)
    .select()
    .single();

  if (updateErr) {
    console.error('Erro ao consolidar dados no veículo mantido:', updateErr);
    return;
  }
  console.log('Veículo principal consolidado com sucesso:', updatedVehicle.model, updatedVehicle.plate);

  // 3. Remover o cadastro duplicado sobressalente
  const { error: deleteErr } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', duplicateIdToRemove);

  if (deleteErr) {
    console.error('Erro ao remover cadastro duplicado:', deleteErr);
    return;
  }
  console.log('Cadastro duplicado removido com sucesso!');

  // 4. Verificação final
  const { data: finalVehicles } = await supabase
    .from('vehicles')
    .select('*')
    .ilike('plate', '%UAE1J55%');

  console.log(`\n=== RESULTADO FINAL: ${finalVehicles?.length || 0} VEÍCULO COM A PLACA UAE1J55 ===`);
  console.log(JSON.stringify(finalVehicles, null, 2));

  const { count: finalSchedulesCount } = await supabase
    .from('vehicle_schedules')
    .select('*', { count: 'exact', head: true })
    .eq('vehicle_id', targetIdToKeep);

  console.log(`Total de agendamentos preservados no veículo mantido: ${finalSchedulesCount}`);
}

mergeVehicles();
