// Teste da lógica de ordenação da fila de consultas com Prioridade Especial
const { orderConsultasQueue } = require('../services/consultasService');

// Simulação dos dados exatamente como no exemplo do usuário
const filaExemplo = [
    { id: '1', paciente: { name: 'João' }, priority: 'Normal', created_at: '2026-09-08T08:00:00Z' },
    { id: '2', paciente: { name: 'Maria' }, priority: 'Normal', created_at: '2026-09-08T08:05:00Z' },
    { id: '3', paciente: { name: 'Carlos' }, priority: 'Especial', created_at: '2026-09-08T08:10:00Z' },
    { id: '4', paciente: { name: 'Ana' }, priority: 'Normal', created_at: '2026-09-08T08:15:00Z' },
    { id: '5', paciente: { name: 'Pedro' }, priority: 'Especial', created_at: '2026-09-08T08:20:00Z' }
];

console.log('--- TESTE 1: Fila inicial ---');
const filaOrdenada1 = orderConsultasQueue(filaExemplo);
filaOrdenada1.forEach(item => {
    console.log(`${item.queue_position}. ${item.paciente.name} — ${item.priority === 'Especial' ? 'ESPECIAL' : 'Comum'}`);
});

console.log('\n--- TESTE 2: Após Carlos ser atendido / removido ---');
const filaSemCarlos = filaExemplo.filter(item => item.id !== '3');
const filaOrdenada2 = orderConsultasQueue(filaSemCarlos);
filaOrdenada2.forEach(item => {
    console.log(`${item.queue_position}. ${item.paciente.name} — ${item.priority === 'Especial' ? 'ESPECIAL' : 'Comum'}`);
});
