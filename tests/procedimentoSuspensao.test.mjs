import { test } from 'node:test';
import assert from 'node:assert/strict';

// Funções de elegibilidade de suspensão de procedimentos espelhadas do sistema
function isProcedimentoElegivelParaNovasSolicitacoes(proc, allProcedures) {
    if (!proc) return false;
    if (proc.status !== 'Ativo') return false;
    if (proc.parent_id && allProcedures && allProcedures.length > 0) {
        const parent = allProcedures.find(p => p.id === proc.parent_id);
        if (parent && parent.status !== 'Ativo') return false;
    }
    return true;
}

function isProcedimentoElegivelParaTransferenciaDestino(proc, allProcedures) {
    return isProcedimentoElegivelParaNovasSolicitacoes(proc, allProcedures);
}

test('1. Procedimento com status Ativo é elegível para novos agendamentos e transferências', () => {
    const proc = { id: 'p1', name: 'CONSULTA CARDIOLOGIA', code: '0001', status: 'Ativo' };
    assert.equal(isProcedimentoElegivelParaNovasSolicitacoes(proc), true);
    assert.equal(isProcedimentoElegivelParaTransferenciaDestino(proc), true);
});

test('2. Procedimento com status Inativo/Suspenso é BLOQUEADO para novos agendamentos e transferências de entrada', () => {
    const proc = { id: 'p2', name: 'ECOCARDIOGRAMA', code: '0002', status: 'Inativo' };
    assert.equal(isProcedimentoElegivelParaNovasSolicitacoes(proc), false);
    assert.equal(isProcedimentoElegivelParaTransferenciaDestino(proc), false);
});

test('3. Procedimento filho (com especialista) vinculado a pai Ativo é elegível', () => {
    const parent = { id: 'p1', name: 'CARDIOLOGIA', code: '0001', status: 'Ativo' };
    const child = { id: 'c1', name: 'CARDIOLOGIA - DR SILVA', code: '0001-01', parent_id: 'p1', status: 'Ativo' };
    const allProcs = [parent, child];

    assert.equal(isProcedimentoElegivelParaNovasSolicitacoes(child, allProcs), true);
    assert.equal(isProcedimentoElegivelParaTransferenciaDestino(child, allProcs), true);
});

test('4. Procedimento filho vinculado a pai Suspenso é BLOQUEADO mesmo que o filho conste como Ativo', () => {
    const parent = { id: 'p1', name: 'CARDIOLOGIA', code: '0001', status: 'Inativo' };
    const child = { id: 'c1', name: 'CARDIOLOGIA - DR SILVA', code: '0001-01', parent_id: 'p1', status: 'Ativo' };
    const allProcs = [parent, child];

    assert.equal(isProcedimentoElegivelParaNovasSolicitacoes(child, allProcs), false);
    assert.equal(isProcedimentoElegivelParaTransferenciaDestino(child, allProcs), false);
});

test('5. Reativação de procedimento restaura a elegibilidade imediatamente', () => {
    const proc = { id: 'p3', name: 'ULTRASSONOGRAFIA', code: '0003', status: 'Inativo' };
    assert.equal(isProcedimentoElegivelParaNovasSolicitacoes(proc), false);

    // Reativar
    proc.status = 'Ativo';
    assert.equal(isProcedimentoElegivelParaNovasSolicitacoes(proc), true);
    assert.equal(isProcedimentoElegivelParaTransferenciaDestino(proc), true);
});

test('6. Transferência de solicitação cujo procedimento de origem está suspenso para destino ativo é PERMITIDA', () => {
    const originProc = { id: 'p-origem', name: 'ORIGEM SUSPENSA', code: '0100', status: 'Inativo' };
    const targetProc = { id: 'p-destino', name: 'DESTINO ATIVO', code: '0200', status: 'Ativo' };

    // Regra: origem pode estar suspensa, mas destino DEVE ser elegível
    const canTransfer = isProcedimentoElegivelParaTransferenciaDestino(targetProc);
    assert.equal(canTransfer, true);
});

test('7. Transferência cujo destino está suspenso é BLOQUEADA', () => {
    const targetProc = { id: 'p-destino-suspenso', name: 'DESTINO SUSPENSO', code: '0300', status: 'Inativo' };
    const canTransfer = isProcedimentoElegivelParaTransferenciaDestino(targetProc);
    assert.equal(canTransfer, false);
});

