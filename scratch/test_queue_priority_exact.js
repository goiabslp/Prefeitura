// Teste exato da lógica de orderConsultasQueue implementada em services/consultasService.ts
function orderConsultasQueue(bookings) {
    if (!bookings || bookings.length === 0) return [];

    const getTime = (item) => {
        if (item.created_at) {
            const t = new Date(item.created_at).getTime();
            if (!isNaN(t)) return t;
        }
        if (item.solicitation_date) {
            const t = new Date(item.solicitation_date + 'T00:00:00').getTime();
            if (!isNaN(t)) return t;
        }
        return 0;
    };

    // 1. Separa estritamente em Agendamentos Especiais e Comuns
    const especiais = bookings.filter(b => b.priority === 'Especial');
    const comuns = bookings.filter(b => b.priority !== 'Especial');

    // 2. Entre vários Agendamentos Especiais, preservar a ordem em que foram registrados/agendados (FIFO)
    especiais.sort((a, b) => {
        const diff = getTime(a) - getTime(b);
        if (diff !== 0) return diff;
        return (a.id || '').localeCompare(b.id || '');
    });

    // 3. Agendamentos comuns permanecem na fila normal pela ordem em que foram registrados
    comuns.sort((a, b) => {
        const diff = getTime(a) - getTime(b);
        if (diff !== 0) return diff;
        return (a.id || '').localeCompare(b.id || '');
    });

    // 4. A fila efetiva coloca todos os Especiais no topo, seguidos pelos comuns
    const filaFinal = [];

    especiais.forEach((item, idx) => {
        filaFinal.push({
            ...item,
            queue_position: idx + 1,
            special_sequence: idx + 1
        });
    });

    comuns.forEach((item, idx) => {
        filaFinal.push({
            ...item,
            queue_position: especiais.length + idx + 1,
            special_sequence: undefined
        });
    });

    return filaFinal;
}

// Caso de teste conforme o exemplo exato do usuário:
const filaExemplo = [
    { id: '1', nome: 'João', priority: 'Normal', created_at: '2026-09-08T08:00:00Z' },
    { id: '2', nome: 'Maria', priority: 'Normal', created_at: '2026-09-08T08:05:00Z' },
    { id: '3', nome: 'Carlos', priority: 'Especial', created_at: '2026-09-08T08:10:00Z' },
    { id: '4', nome: 'Ana', priority: 'Normal', created_at: '2026-09-08T08:15:00Z' },
    { id: '5', nome: 'Pedro', priority: 'Especial', created_at: '2026-09-08T08:20:00Z' }
];

console.log('=== FILA EFETIVA INICIAL ===');
const fila1 = orderConsultasQueue(filaExemplo);
fila1.forEach(i => console.log(`${i.queue_position}. ${i.nome} — ${i.priority === 'Especial' ? 'ESPECIAL' : 'Comum'}`));

console.log('\n=== APÓS CARLOS SER ATENDIDO ===');
const fila2 = orderConsultasQueue(filaExemplo.filter(i => i.nome !== 'Carlos'));
fila2.forEach(i => console.log(`${i.queue_position}. ${i.nome} — ${i.priority === 'Especial' ? 'ESPECIAL' : 'Comum'}`));
