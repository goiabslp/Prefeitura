import test from 'node:test';
import assert from 'node:assert/strict';

// Funções de geração de textos e declarações de confirmação de atendimento
export function buildMensagemConfirmacao({
    situacao,
    userName,
    pacienteNome,
    procedimentoNome
}) {
    if (situacao === 'Realizado') {
        return {
            titulo: 'Confirmar Atendimento Realizado',
            pergunta: `Olá, ${userName}!\nVocê entrou em contato com o paciente ${pacienteNome} e confirmou que ele realmente realizou o procedimento ${procedimentoNome}?`,
            botaoConfirmar: 'Confirmar Atendimento Realizado',
            corBotao: 'verde'
        };
    } else {
        return {
            titulo: 'Confirmar Ausência do Paciente',
            pergunta: `Olá, ${userName}!\nVocê entrou em contato com o paciente ${pacienteNome} e confirmou que ele realmente não compareceu ao procedimento ${procedimentoNome}?`,
            botaoConfirmar: 'Confirmar Ausência',
            corBotao: 'vermelho'
        };
    }
}

export function buildDeclaracaoAuditoria({
    situacao,
    userName,
    pacienteNome,
    procedimentoNome,
    dataHoraStr
}) {
    const timestamp = dataHoraStr || '13/11/2026 14:00:00';
    if (situacao === 'Realizado') {
        return `Olá, ${userName}! Você entrou em contato com o paciente ${pacienteNome} e confirmou que ele realmente realizou o procedimento ${procedimentoNome}? [CONFIRMADO PELO OPERADOR EM ${timestamp}]`;
    } else {
        return `Olá, ${userName}! Você entrou em contato com o paciente ${pacienteNome} e confirmou que ele realmente não compareceu ao procedimento ${procedimentoNome}? [CONFIRMADO PELO OPERADOR EM ${timestamp}]`;
    }
}

test('1. Mensagem e Título para Situação REALIZADO', () => {
    const res = buildMensagemConfirmacao({
        situacao: 'Realizado',
        userName: 'Guilherme',
        pacienteNome: 'RAQUEL VIRGEM MARTINS',
        procedimentoNome: 'OFTALMOLOGIA GERAL'
    });

    assert.equal(res.titulo, 'Confirmar Atendimento Realizado');
    assert.equal(
        res.pergunta,
        'Olá, Guilherme!\nVocê entrou em contato com o paciente RAQUEL VIRGEM MARTINS e confirmou que ele realmente realizou o procedimento OFTALMOLOGIA GERAL?'
    );
    assert.equal(res.botaoConfirmar, 'Confirmar Atendimento Realizado');
    assert.equal(res.corBotao, 'verde');
});

test('2. Mensagem e Título para Situação FALTOU', () => {
    const res = buildMensagemConfirmacao({
        situacao: 'Não Realizado',
        userName: 'Guilherme',
        pacienteNome: 'JOSE GERALDO DOS SANTOS FILHO',
        procedimentoNome: 'CONSULTA EM CARDIOLOGIA - EURICO ABREU DE OLIVEIRA JÚNIOR'
    });

    assert.equal(res.titulo, 'Confirmar Ausência do Paciente');
    assert.equal(
        res.pergunta,
        'Olá, Guilherme!\nVocê entrou em contato com o paciente JOSE GERALDO DOS SANTOS FILHO e confirmou que ele realmente não compareceu ao procedimento CONSULTA EM CARDIOLOGIA - EURICO ABREU DE OLIVEIRA JÚNIOR?'
    );
    assert.equal(res.botaoConfirmar, 'Confirmar Ausência');
    assert.equal(res.corBotao, 'vermelho');
});

test('3. Declaração para Histórico de Auditoria inclui todos os campos exigidos', () => {
    const declaracao = buildDeclaracaoAuditoria({
        situacao: 'Realizado',
        userName: 'Guilherme',
        pacienteNome: 'MARIA APARECIDA BARCELOS DOS REIS',
        procedimentoNome: 'CONSULTA EM CARDIOLOGIA',
        dataHoraStr: '13/11/2026 15:30:00'
    });

    assert.ok(declaracao.includes('Guilherme'));
    assert.ok(declaracao.includes('MARIA APARECIDA BARCELOS DOS REIS'));
    assert.ok(declaracao.includes('CONSULTA EM CARDIOLOGIA'));
    assert.ok(declaracao.includes('realmente realizou o procedimento'));
    assert.ok(declaracao.includes('CONFIRMADO PELO OPERADOR'));
});

test('4. Declaração de Ausência para Histórico de Auditoria', () => {
    const declaracao = buildDeclaracaoAuditoria({
        situacao: 'Não Realizado',
        userName: 'Guilherme',
        pacienteNome: 'GERALDO ALCINO DE CARVALHO',
        procedimentoNome: 'CONSULTA EM CARDIOLOGIA',
        dataHoraStr: '13/11/2026 15:35:00'
    });

    assert.ok(declaracao.includes('Guilherme'));
    assert.ok(declaracao.includes('GERALDO ALCINO DE CARVALHO'));
    assert.ok(declaracao.includes('CONSULTA EM CARDIOLOGIA'));
    assert.ok(declaracao.includes('realmente não compareceu ao procedimento'));
    assert.ok(declaracao.includes('CONFIRMADO PELO OPERADOR'));
});

