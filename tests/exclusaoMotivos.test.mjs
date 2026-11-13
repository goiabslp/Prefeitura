import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    MOTIVOS_EXCLUSAO,
    normalizeJustificativaExclusao,
    validateJustificativaManualExclusao,
    validateExclusaoForm
} from '../services/exclusaoMotivos.ts';

test('1. Lista oficial de 9 motivos de exclusão contém todos os itens e textos exatos', () => {
    assert.equal(MOTIVOS_EXCLUSAO.length, 9, 'Deve conter exatamente 9 motivos de exclusão');

    const labels = MOTIVOS_EXCLUSAO.map(m => m.label);
    assert.deepEqual(labels, [
        'Cadastro duplicado',
        'Paciente cadastrado incorretamente',
        'Procedimento selecionado incorretamente',
        'Erro de lançamento',
        'Solicitação cadastrada indevidamente',
        'Documentação incorreta',
        'Solicitação de teste',
        'Correção administrativa',
        'Outro'
    ]);

    const findByLabel = (label) => MOTIVOS_EXCLUSAO.find(m => m.label === label);

    assert.equal(
        findByLabel('Cadastro duplicado').defaultJustificativa,
        'Solicitação de exclusão por duplicidade de cadastro do mesmo paciente e procedimento.'
    );
    assert.equal(
        findByLabel('Paciente cadastrado incorretamente').defaultJustificativa,
        'Solicitação de exclusão devido à seleção incorreta do paciente no momento do cadastro.'
    );
    assert.equal(
        findByLabel('Procedimento selecionado incorretamente').defaultJustificativa,
        'Solicitação de exclusão devido à seleção de procedimento diferente do solicitado pelo médico.'
    );
    assert.equal(
        findByLabel('Erro de lançamento').defaultJustificativa,
        'Solicitação de exclusão devido a erro operacional identificado durante o cadastramento.'
    );
    assert.equal(
        findByLabel('Solicitação cadastrada indevidamente').defaultJustificativa,
        'Solicitação de exclusão após identificação de registro realizado de forma indevida.'
    );
    assert.equal(
        findByLabel('Documentação incorreta').defaultJustificativa,
        'Solicitação de exclusão devido à identificação de documentação incompatível com o procedimento solicitado.'
    );
    assert.equal(
        findByLabel('Solicitação de teste').defaultJustificativa,
        'Solicitação de exclusão por se tratar de registro realizado exclusivamente para testes do sistema.'
    );
    assert.equal(
        findByLabel('Correção administrativa').defaultJustificativa,
        'Solicitação de exclusão para regularização de inconsistências administrativas identificadas no cadastro.'
    );
    assert.equal(findByLabel('Outro').defaultJustificativa, '');
    assert.equal(findByLabel('Outro').isManualOnly, true);
});

test('2. validateJustificativaManualExclusao valida regra dos 100 caracteres e anti-spam', () => {
    // Curto
    const curto = 'Solicitação de teste apenas.';
    assert.equal(validateJustificativaManualExclusao(curto).isValid, false);

    // Spam mesmo caractere
    const spam = 'Solicitação de teste aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    assert.equal(validateJustificativaManualExclusao(spam).isValid, false);

    // Texto descritivo válido >= 100 caracteres
    const valido = 'Identificado erro de preenchimento onde o cadastro foi lançado em duplicidade com dados do mês anterior e requer expurgo regular após validação médica.';
    assert.ok(valido.length >= 100);
    assert.equal(validateJustificativaManualExclusao(valido).isValid, true);
});

test('3. validateExclusaoForm valida o formulário completo', () => {
    assert.equal(validateExclusaoForm({ motivo: '', justificativa: 'abc' }).isValid, false);
    assert.equal(validateExclusaoForm({ motivo: 'Cadastro duplicado', justificativa: '' }).isValid, false);

    const padrao = MOTIVOS_EXCLUSAO[0];
    assert.equal(validateExclusaoForm({ motivo: padrao.label, justificativa: padrao.defaultJustificativa }).isValid, true);
});
