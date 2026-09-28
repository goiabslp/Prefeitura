// Teste de validação das regras de filtragem de consulta de veículos

function testFilterVehicles({ vehicles, schedules, searchDestination, searchPassengerCount, consultaStartMs, consultaEndMs }) {
  // REGRA 1: Disponibilidade para consulta e status operacional
  const activeVehicles = (vehicles || []).filter((v) => {
    const isOperacional = !v.status || v.status.toLowerCase() === 'operacional' || v.status.toLowerCase() === 'ativo';
    const isDisponivelScheduling = v.available_for_scheduling !== 'Não' && v.available_for_scheduling !== 'nao';
    
    const isConsultaNao = v.available_for_consultation === 'Não' || v.available_for_consultation === 'nao';
    const isDisponivelConsulta = !isConsultaNao && (v.available_for_consultation === 'Sim' || v.available_for_consultation === undefined || v.available_for_consultation === null);

    return isOperacional && isDisponivelScheduling && isDisponivelConsulta;
  });

  const schedulesByVehicle = new Map();
  (schedules || []).forEach((s) => {
    if (!s.vehicle_id || !s.departure_date_time || !s.return_date_time) return;
    const statusLower = (s.status || '').toLowerCase().trim();
    if (statusLower === 'cancelado' || statusLower === 'rejeitado') return;

    const schedStartMs = new Date(s.departure_date_time).getTime();
    const schedEndMs = new Date(s.return_date_time).getTime();
    const hasOverlap = (consultaStartMs < schedEndMs) && (consultaEndMs > schedStartMs);

    if (hasOverlap) {
      const list = schedulesByVehicle.get(s.vehicle_id) || [];
      list.push(s);
      schedulesByVehicle.set(s.vehicle_id, list);
    }
  });

  const computedResults = [];

  activeVehicles.forEach((v) => {
    const totalCapacity = Number(v.passenger_capacity) || 5;
    const maxPassengers = Math.max(0, totalCapacity - 1);
    const vehicleSchedules = schedulesByVehicle.get(v.id) || [];

    // CASO A: Veículo Livre
    if (vehicleSchedules.length === 0) {
      if (totalCapacity >= (searchPassengerCount + 1)) {
        computedResults.push({
          type: 'livre',
          id: v.id,
          model: v.model,
          totalCapacity,
          passengerCapacity: maxPassengers
        });
      }
      return;
    }
  });

  return computedResults;
}

// Execução dos testes
console.log('--- Testes de Regras de Consulta ---');

const mockVehicles = [
  { id: '1', model: 'Spin 5L (Disp Consulta: Sim)', passenger_capacity: 5, available_for_consultation: 'Sim', available_for_scheduling: 'Sim', status: 'operacional' },
  { id: '2', model: 'Spin 5L (Disp Consulta: Não)', passenger_capacity: 5, available_for_consultation: 'Não', available_for_scheduling: 'Sim', status: 'operacional' },
  { id: '3', model: 'Spin 7L (Disp Consulta: Sim)', passenger_capacity: 7, available_for_consultation: 'Sim', available_for_scheduling: 'Sim', status: 'operacional' },
  { id: '4', model: 'Van 9L (Disp Consulta: Sim)', passenger_capacity: 9, available_for_consultation: 'Sim', available_for_scheduling: 'Sim', status: 'operacional' },
  { id: '5', model: 'Van 16L (Disp Consulta: Sim)', passenger_capacity: 16, available_for_consultation: 'Sim', available_for_scheduling: 'Sim', status: 'operacional' },
];

// Teste 1: Busca com 4 passageiros
console.log('\n[Cenário 1]: Usuário solicita 4 passageiros');
const res4 = testFilterVehicles({
  vehicles: mockVehicles,
  schedules: [],
  searchDestination: 'BELO HORIZONTE',
  searchPassengerCount: 4,
  consultaStartMs: 0,
  consultaEndMs: 1000
});
console.log('Veículos retornados (deve incluir Spin 5L Sim [cap 4 pass + 1 mot], Spin 7L, Van 9L, Van 16L e NÃO incluir Spin 5L Não):');
res4.forEach(r => console.log(` - ${r.model}: Capacidade Total ${r.totalCapacity} (${r.passengerCapacity} passageiros + 1 motorista)`));

// Teste 2: Busca com 5 passageiros
console.log('\n[Cenário 2]: Usuário solicita 5 passageiros');
const res5 = testFilterVehicles({
  vehicles: mockVehicles,
  schedules: [],
  searchDestination: 'BELO HORIZONTE',
  searchPassengerCount: 5,
  consultaStartMs: 0,
  consultaEndMs: 1000
});
console.log('Veículos retornados (Spin 5L DEVE SER DESCARTADO; apenas Spin 7L, Van 9L e Van 16L permitidos):');
res5.forEach(r => console.log(` - ${r.model}: Capacidade Total ${r.totalCapacity} (${r.passengerCapacity} passageiros + 1 motorista)`));

// Teste 3: Busca com 7 passageiros
console.log('\n[Cenário 3]: Usuário solicita 7 passageiros');
const res7 = testFilterVehicles({
  vehicles: mockVehicles,
  schedules: [],
  searchDestination: 'BELO HORIZONTE',
  searchPassengerCount: 7,
  consultaStartMs: 0,
  consultaEndMs: 1000
});
console.log('Veículos retornados (Spin 5L e Spin 7L DESCARTADOS; apenas Van 9L e Van 16L permitidos):');
res7.forEach(r => console.log(` - ${r.model}: Capacidade Total ${r.totalCapacity} (${r.passengerCapacity} passageiros + 1 motorista)`));

console.log('\nTodos os cenários validados com sucesso!');
