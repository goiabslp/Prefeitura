import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    MOTIVOS_CANCELAMENTO,
    CONFIRMACAO_VERACIDADE_TEXT,
    normalizeJustificativa,
    validateJustificativaManual,
    validateCancelamentoForm
} from '../services/cancelamentoMotivos.ts';

test('1. Lista oficial de 9 motivos de cancelamento contém todos os itens e textos exatos', () => {
    assert.equal(MOTIVOS_CANCELAMENTO.length, 9, 'Deve conter exatamente 9 motivos');

    const labels = MOTIVOS_CANCELAMENTO.map(m => m.label);
    assert.deepEqual(labels, [
        'Desistência do paciente',
        'Procedimento já realizado',
        'Problemas de saúde',
        'Atendimento particular',
        'Mudança de município',
        'Orientação médica',
        'Falecimento do paciente',
        'Motivos pessoais ou familiares',
        'Outro'
    ]);

    const findByLabel = (label) => MOTIVOS_CANCELAMENTO.find(m => m.label === label);

    assert.equal(
        findByLabel('Desistência do paciente').defaultJustificativa,
        'Em contato com o paciente, o mesmo informou que não deseja mais realizar o procedimento.'
    );
    assert.equal(
        findByLabel('Procedimento já realizado').defaultJustificativa,
        'Em contato com o paciente, o mesmo informou que já realizou o procedimento em outra unidade de saúde.'
    );
    assert.equal(
        findByLabel('Problemas de saúde').defaultJustificativa,
        'Em contato com o paciente, o mesmo informou que apresenta condições clínicas que impossibilitam a realização do procedimento.'
    );
    assert.equal(
        findByLabel('Atendimento particular').defaultJustificativa,
        'Em contato com o paciente, o mesmo informou que optou por realizar o procedimento na rede particular.'
    );
    assert.equal(
        findByLabel('Mudança de município').defaultJustificativa,
        'Em contato com o paciente, o mesmo informou que não reside mais no município.'
    );
    assert.equal(
        findByLabel('Orientação médica').defaultJustificativa,
        'Em contato com o paciente, o mesmo informou que, por orientação médica, o procedimento foi suspenso ou considerado desnecessário.'
    );
    assert.equal(
        findByLabel('Falecimento do paciente').defaultJustificativa,
        'Conforme informação recebida de familiar ou responsável, o paciente faleceu, impossibilitando a realização do procedimento.'
    );
    assert.equal(
        findByLabel('Motivos pessoais ou familiares').defaultJustificativa,
        'Em contato com o paciente, o mesmo informou que, por motivos pessoais ou familiares, não deseja prosseguir com o procedimento.'
    );
    assert.equal(findByLabel('Outro').defaultJustificativa, '');
    assert.equal(findByLabel('Outro').isManualOnly, true);
    assert.equal(CONFIRMACAO_VERACIDADE_TEXT, 'Confirmo que as informações descritas na justificativa foram verificadas.');
});

test('2. normalizeJustificativa remove espaços excedentes e múltiplos espaços internos', () => {
    const raw = '   Texto    com    muitos     espaços    e quebras \n\n de linha   ';
    const norm = normalizeJustificativa(raw);
    assert.equal(norm, 'Texto com muitos espaços e quebras de linha');
});

test('3. validateJustificativaManual bloqueia textos com menos de 100 caracteres', () => {
    const shortText = 'Paciente não quer mais fazer o procedimento por motivos pessoais.';
    const res = validateJustificativaManual(shortText);
    assert.equal(res.isValid, false);
    assert.match(res.error, /no mínimo 100 caracteres/i);
    assert.equal(res.length, shortText.length);
});

test('4. validateJustificativaManual bloqueia repetições abusivas e spam', () => {
    // Repetição de mesmo caractere
    const repChar = 'Paciente informou que não deseja realizar o procedimento aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    assert.equal(validateJustificativaManual(repChar).isValid, false);

    // Texto com pouquíssimos caracteres únicos
    const lowEntropy = '1212121212 1212121212 1212121212 1212121212 1212121212 1212121212 1212121212 1212121212 1212121212 1212121212';
    assert.equal(validateJustificativaManual(lowEntropy).isValid, false);

    // Mesma palavra repetida várias vezes
    const repeatedWord = 'cancelamento cancelamento cancelamento cancelamento cancelamento cancelamento cancelamento cancelamento cancelamento cancelamento cancelamento';
    assert.equal(validateJustificativaManual(repeatedWord).isValid, false);
});

test('5. validateJustificativaManual aceita texto descritivo legítimo >= 100 caracteres', () => {
    const validText = 'Paciente entrou em contato com a equipe informando que compareceu à consulta médica em hospital regional e foi orientado pelo especialista a aguardar nova avaliação em seis meses.';
    assert.ok(validText.length >= 100);
    const res = validateJustificativaManual(validText);
    assert.equal(res.isValid, true);
    assert.equal(res.error, undefined);
    assert.equal(res.length, validText.length);
});

test('6. validateCancelamentoForm valida formulário completo para motivos predefinidos e Outro', () => {
    // 1. Sem motivo selecionado
    assert.equal(validateCancelamentoForm({ motivo: '', justificativa: 'abc', isConfirmedVeracidade: true }).isValid, false);

    // 2. Com motivo predefinido mas sem confirmação de veracidade
    const motivoPadrao = MOTIVOS_CANCELAMENTO[0];
    const resSemVeracidade = validateCancelamentoForm({
        motivo: motivoPadrao.label,
        justificativa: motivoPadrao.defaultJustificativa,
        isConfirmedVeracidade: false
    });
    assert.equal(resSemVeracidade.isValid, false);
    assert.match(resSemVeracidade.error, /foram verificadas/i);

    // 3. Com motivo predefinido e veracidade confirmada -> VÁLIDO
    const resValidoPadrao = validateCancelamentoForm({
        motivo: motivoPadrao.label,
        justificativa: motivoPadrao.defaultJustificativa,
        isConfirmedVeracidade: true
    });
    assert.equal(resValidoPadrao.isValid, true);

    // 4. Com motivo "Outro" com menos de 100 caracteres -> BLOQUEADO
    const resOutroCurto = validateCancelamentoForm({
        motivo: 'Outro',
        justificativa: 'Texto muito curto para a opção outro.',
        isConfirmedVeracidade: true
    });
    assert.equal(resOutroCurto.isValid, false);
    assert.match(resOutroCurto.error, /no mínimo 100 caracteres/i);

    // 5. Com motivo "Outro" com >= 100 caracteres válidos e veracidade confirmada -> VÁLIDO
    const validOutroText = 'Paciente compareceu pessoalmente à regulação municipal acompanhado de seu responsável legal e solicitou o encerramento do processo administrativo de agendamento por razões particulares.';
    assert.ok(validOutroText.length >= 100);
    const resOutroValido = validateCancelamentoForm({
        motivo: 'Outro',
        justificativa: validOutroText,
        isConfirmedVeracidade: true
    });
    assert.equal(resOutroValido.isValid, true);
});
