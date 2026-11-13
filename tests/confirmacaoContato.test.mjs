import test from 'node:test';
import assert from 'node:assert/strict';

export function extractFirstName(fullName) {
    const raw = (fullName || 'Servidor').trim();
    return raw.split(/\s+/)[0] || 'Servidor';
}

// Funções de geração de textos e declarações de confirmação de atendimento
export function buildMensagemConfirmacao({
    situacao,
    userName,
    pacienteNome,
    procedimentoNome
}) {
    const firstName = extractFirstName(userName);
    if (situacao === 'Realizado') {
        return {
            titulo: 'Confirmar Atendimento Realizado',
            saudacao: `Olá, ${firstName}!`,
            pergunta: `Você entrou em contato com o paciente ${pacienteNome} e confirmou que ele realmente realizou o procedimento ${procedimentoNome}?`,
            botaoConfirmar: 'Confirmar Atendimento Realizado',
            corBotao: 'verde'
        };
    } else {
        return {
            titulo: 'Confirmar Ausência do Paciente',
            saudacao: `Olá, ${firstName}!`,
            pergunta: `Você entrou em contato com o paciente ${pacienteNome} e confirmou que ele realmente não compareceu ao procedimento ${procedimentoNome}?`,
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
    const rawName = (userName || 'Servidor').trim();
    const firstName = extractFirstName(userName);
    const timestamp = dataHoraStr || '13/11/2026 14:00:00';
    if (situacao === 'Realizado') {
        return `Olá, ${firstName}! Você entrou em contato com o paciente ${pacienteNome} e confirmou que ele realmente realizou o procedimento ${procedimentoNome}? [CONFIRMADO PELO OPERADOR ${rawName} EM ${timestamp}]`;
    } else {
        return `Olá, ${firstName}! Você entrou em contato com o paciente ${pacienteNome} e confirmou que ele realmente não compareceu ao procedimento ${procedimentoNome}? [CONFIRMADO PELO OPERADOR ${rawName} EM ${timestamp}]`;
    }
}

test('1. Extrai apenas o primeiro nome do usuário', () => {
    assert.equal(extractFirstName('Guilherme Araújo Ferreira dos Santos'), 'Guilherme');
    assert.equal(extractFirstName('Maria Silva'), 'Maria');
    assert.equal(extractFirstName('  João   Pedro  '), 'João');
    assert.equal(extractFirstName(''), 'Servidor');
});

test('2. Mensagem e Título para Situação REALIZADO com primeiro nome e quebra de linha', () => {
    const res = buildMensagemConfirmacao({
        situacao: 'Realizado',
        userName: 'Guilherme Araújo Ferreira dos Santos',
        pacienteNome: 'LUSIA MENESES SIMAO',
        procedimentoNome: 'ULTRASSOM COM DOPPLER — TERCEIRIZADO'
    });

    assert.equal(res.titulo, 'Confirmar Atendimento Realizado');
    assert.equal(res.saudacao, 'Olá, Guilherme!');
    assert.equal(
        res.pergunta,
        'Você entrou em contato com o paciente LUSIA MENESES SIMAO e confirmou que ele realmente realizou o procedimento ULTRASSOM COM DOPPLER — TERCEIRIZADO?'
    );
    assert.equal(res.botaoConfirmar, 'Confirmar Atendimento Realizado');
    assert.equal(res.corBotao, 'verde');
});

test('3. Mensagem e Título para Situação FALTOU com primeiro nome e quebra de linha', () => {
    const res = buildMensagemConfirmacao({
        situacao: 'Não Realizado',
        userName: 'Guilherme Araújo Ferreira dos Santos',
        pacienteNome: 'JOSE GERALDO DOS SANTOS FILHO',
        procedimentoNome: 'CONSULTA EM CARDIOLOGIA - EURICO ABREU DE OLIVEIRA JÚNIOR'
    });

    assert.equal(res.titulo, 'Confirmar Ausência do Paciente');
    assert.equal(res.saudacao, 'Olá, Guilherme!');
    assert.equal(
        res.pergunta,
        'Você entrou em contato com o paciente JOSE GERALDO DOS SANTOS FILHO e confirmou que ele realmente não compareceu ao procedimento CONSULTA EM CARDIOLOGIA - EURICO ABREU DE OLIVEIRA JÚNIOR?'
    );
    assert.equal(res.botaoConfirmar, 'Confirmar Ausência');
    assert.equal(res.corBotao, 'vermelho');
});

test('4. Declaração para Histórico de Auditoria inclui primeiro nome e nome completo do operador', () => {
    const declaracao = buildDeclaracaoAuditoria({
        situacao: 'Realizado',
        userName: 'Guilherme Araújo Ferreira dos Santos',
        pacienteNome: 'LUSIA MENESES SIMAO',
        procedimentoNome: 'ULTRASSOM COM DOPPLER',
        dataHoraStr: '13/11/2026 15:30:00'
    });

    assert.ok(declaracao.startsWith('Olá, Guilherme!'));
    assert.ok(declaracao.includes('LUSIA MENESES SIMAO'));
    assert.ok(declaracao.includes('ULTRASSOM COM DOPPLER'));
    assert.ok(declaracao.includes('Guilherme Araújo Ferreira dos Santos'));
    assert.ok(declaracao.includes('CONFIRMADO PELO OPERADOR'));
});
