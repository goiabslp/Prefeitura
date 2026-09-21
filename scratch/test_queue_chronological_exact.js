// Script de validação da ordenação cronológica estrita (Data da Solicitação + Data/Hora de Criação)

function normalizeSolicitationDate(item) {
    if (!item) return '';
    if (item.solicitation_date) {
        const trimmed = String(item.solicitation_date).trim();
        if (trimmed) {
            if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
                const parts = trimmed.substring(0, 10).split('/');
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
                return trimmed.substring(0, 10);
            }
            const d = new Date(trimmed);
            if (!isNaN(d.getTime())) {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }
            return trimmed;
        }
    }
    if (item.created_at) {
        const trimmed = String(item.created_at).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            return trimmed.substring(0, 10);
        }
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }
    }
    return '';
}

function getCreationTimestamp(item) {
    if (!item || !item.created_at) return 0;
    const t = new Date(item.created_at).getTime();
    return isNaN(t) ? 0 : t;
}

function compareConsultasChronological(a, b) {
    const solA = normalizeSolicitationDate(a);
    const solB = normalizeSolicitationDate(b);

    if (solA && solB && solA !== solB) {
        return solA.localeCompare(solB);
    }
    if (solA && !solB) return -1;
    if (!solA && solB) return 1;

    const createA = getCreationTimestamp(a);
    const createB = getCreationTimestamp(b);

    if (createA !== createB) {
        return createA - createB;
    }

    return 0;
}

function orderConsultasQueue(bookings) {
    if (!bookings || bookings.length === 0) return [];

    const isEspecial = (b) => b.priority === 'Especial';
    const isRetorno = (b) => !isEspecial(b) && (b.is_retorno === true || !!b.retorno_tipo || b.status === 'Retorno');
    const isUrgente = (b) => !isEspecial(b) && !isRetorno(b) && (b.priority === 'Urgência' || b.priority === 'Urgente');
    const isNormal = (b) => !isEspecial(b) && !isRetorno(b) && !isUrgente(b);

    const especiais = bookings.filter(isEspecial);
    const retornos = bookings.filter(isRetorno);
    const urgentes = bookings.filter(isUrgente);
    const normais = bookings.filter(isNormal);

    especiais.sort(compareConsultasChronological);
    retornos.sort(compareConsultasChronological);
    urgentes.sort(compareConsultasChronological);
    normais.sort(compareConsultasChronological);

    const filaFinal = [];
    let positionCounter = 1;

    especiais.forEach((item, idx) => {
        filaFinal.push({
            ...item,
            queue_position: positionCounter++,
            special_sequence: idx + 1
        });
    });

    retornos.forEach(item => {
        filaFinal.push({
            ...item,
            queue_position: positionCounter++,
            special_sequence: undefined
        });
    });

    urgentes.forEach(item => {
        filaFinal.push({
            ...item,
            queue_position: positionCounter++,
            special_sequence: undefined
        });
    });

    normais.forEach(item => {
        filaFinal.push({
            ...item,
            queue_position: positionCounter++,
            special_sequence: undefined
        });
    });

    return filaFinal;
}

// ================= TESTE 1: Exemplo fornecido pelo Usuário =================
// Posição 1ª: 21/09/2026 08:15:12
// Posição 2ª: 21/09/2026 08:17:43
// Posição 3ª: 21/09/2026 08:19:05
// Posição 4ª: 22/09/2026 07:30:10
const userExampleInput = [
    { id: 'uuid-4', nome: 'Paciente D', solicitation_date: '2026-09-22', created_at: '2026-09-22T07:30:10.000Z', priority: 'Normal' },
    { id: 'uuid-2', nome: 'Paciente B', solicitation_date: '2026-09-21', created_at: '2026-09-21T08:17:43.000Z', priority: 'Normal' },
    { id: 'uuid-3', nome: 'Paciente C', solicitation_date: '2026-09-21', created_at: '2026-09-21T08:19:05.000Z', priority: 'Normal' },
    { id: 'uuid-1', nome: 'Paciente A', solicitation_date: '2026-09-21', created_at: '2026-09-21T08:15:12.000Z', priority: 'Normal' }
];

const result1 = orderConsultasQueue(userExampleInput);
console.log('--- TESTE 1: Exemplo do Usuário ---');
result1.forEach(p => {
    console.log(`Posição ${p.queue_position}ª: ${p.nome} | Solicitado: ${p.solicitation_date} | Criado: ${p.created_at.substring(11, 19)} | ID: ${p.id}`);
});

const ok1 = result1[0].id === 'uuid-1' && result1[1].id === 'uuid-2' && result1[2].id === 'uuid-3' && result1[3].id === 'uuid-4';
console.log('Teste 1 PASSOU?', ok1 ? 'SIM ✅' : 'NÃO ❌');

// ================= TESTE 2: Formatos de Data (DD/MM/YYYY vs YYYY-MM-DD) =================
const testDateFormats = [
    { id: 'f2', nome: 'Paciente Format 2', solicitation_date: '2026-09-21', created_at: '2026-09-21T08:17:43.000Z', priority: 'Normal' },
    { id: 'f1', nome: 'Paciente Format 1', solicitation_date: '21/09/2026', created_at: '2026-09-21T08:15:12.000Z', priority: 'Normal' },
];
const result2 = orderConsultasQueue(testDateFormats);
console.log('\n--- TESTE 2: Formatos de data mista ---');
result2.forEach(p => {
    console.log(`Posição ${p.queue_position}ª: ${p.nome} | Solicitado: ${p.solicitation_date} | Criado: ${p.created_at.substring(11, 19)}`);
});
const ok2 = result2[0].id === 'f1' && result2[1].id === 'f2';
console.log('Teste 2 PASSOU?', ok2 ? 'SIM ✅' : 'NÃO ❌');

if (ok1 && ok2) {
    console.log('\nTODOS OS TESTES PASSARAM COM SUCESSO! 🚀');
} else {
    process.exit(1);
}
