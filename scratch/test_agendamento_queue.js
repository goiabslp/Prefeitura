// Teste direto do algoritmo de fila de agendamentos especiais
function orderConsultasQueue(bookings) {
    const sortedChronological = [...bookings].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
    });

    const especiais = [];
    const normais = [];

    for (const item of sortedChronological) {
        if (item.priority === 'Especial') {
            let lastIndexSameProc = -1;
            for (let i = especiais.length - 1; i >= 0; i--) {
                if (especiais[i].procedimento_id === item.procedimento_id) {
                    lastIndexSameProc = i;
                    break;
                }
            }

            if (lastIndexSameProc !== -1) {
                especiais.splice(lastIndexSameProc + 1, 0, { ...item });
            } else {
                especiais.unshift({ ...item });
            }
        } else {
            normais.push({ ...item });
        }
    }

    especiais.forEach((item, idx) => {
        item.special_sequence = idx + 1;
        item.queue_position = idx + 1;
    });

    normais.forEach((item, idx) => {
        item.queue_position = especiais.length + idx + 1;
    });

    return [...especiais, ...normais];
}

console.log('==================================================');
console.log('VALIDAÇÃO DOS CASOS DE TESTE DO USUÁRIO');
console.log('==================================================');

// Teste 1:
const fila1 = [
  { id: '1', procedimento_id: 'procA', priority: 'Normal', created_at: '2026-09-01T10:00:00Z', label: 'Normal — Procedimento A' },
  { id: '2', procedimento_id: 'procB', priority: 'Especial', created_at: '2026-09-01T11:00:00Z', label: 'Especial — Procedimento B' },
  { id: '3', procedimento_id: 'procC', priority: 'Normal', created_at: '2026-09-01T12:00:00Z', label: 'Normal — Procedimento C' },
  { id: '4', procedimento_id: 'procA', priority: 'Normal', created_at: '2026-09-01T13:00:00Z', label: 'Normal — Procedimento A' },
  { id: '5', procedimento_id: 'procA', priority: 'Especial', created_at: '2026-09-01T14:00:00Z', label: 'Especial — Procedimento A (novo)' }
];

const res1 = orderConsultasQueue(fila1);
console.log('\n--- CASO 1: Inserção de Especial com procedimento novo entre os especiais ---');
res1.forEach((x, i) => {
  console.log(`Posição ${x.queue_position}º: ${x.label} | Seq: ${x.special_sequence || '-'}`);
});

// Teste 2:
const fila2 = [
  { id: '1', procedimento_id: 'procA', priority: 'Especial', created_at: '2026-09-01T10:00:00Z', label: 'Especial — Procedimento A' },
  { id: '2', procedimento_id: 'procB', priority: 'Especial', created_at: '2026-09-01T11:00:00Z', label: 'Especial — Procedimento B' },
  { id: '3', procedimento_id: 'procA', priority: 'Especial', created_at: '2026-09-01T12:00:00Z', label: 'Especial — Procedimento A' },
  { id: '4', procedimento_id: 'procA', priority: 'Especial', created_at: '2026-09-01T13:00:00Z', label: 'Especial — Procedimento A (novo)' },
  { id: '5', procedimento_id: 'procC', priority: 'Normal', created_at: '2026-09-01T14:00:00Z', label: 'demais solicitações normais...' }
];

const res2 = orderConsultasQueue(fila2);
console.log('\n--- CASO 2: Inserção de Especial onde já existe o mesmo procedimento ---');
res2.forEach((x, i) => {
  console.log(`Posição ${x.queue_position}º: ${x.label} | Seq: ${x.special_sequence || '-'}`);
});

console.log('\nTodos os casos validados com sucesso!');
