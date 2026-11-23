import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
    isTelefoneIrregularParaOperacao, 
    validateBrazilianPhone, 
    getMotivoIrregularidadeOperacao 
} from '../utils/phoneValidation.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('🧪 Iniciando testes de Bloqueio de REALIZADO e FALTOU sem telefone válido...');

// 1. Cenários de Pacientes Sem Telefone
{
    console.log('  [1] Validando bloqueio para telefones ausentes ou vazios...');
    assert.equal(isTelefoneIrregularParaOperacao(null), true, 'null deve ser irregular');
    assert.equal(isTelefoneIrregularParaOperacao(undefined), true, 'undefined deve ser irregular');
    assert.equal(isTelefoneIrregularParaOperacao(''), true, 'string vazia deve ser irregular');
    assert.equal(isTelefoneIrregularParaOperacao('   '), true, 'espaços em branco devem ser irregulares');
    
    const motivoVazio = getMotivoIrregularidadeOperacao('');
    assert.match(motivoVazio, /Nenhum telefone/i, 'Deve indicar ausência de telefone');
}

// 2. Cenários de Pacientes com Telefones Fictícios / Inválidos
{
    console.log('  [2] Validando bloqueio para telefones inválidos ou fictícios...');
    const invalidos = [
        '0000000000',
        '11111111111',
        '(31) 99999-9999',
        '(00) 98765-4321', // DDD inexistente
        '(31) 1234-5678',  // Dígito inicial inválido
        '98765432',        // Incompleto sem DDD
        '(31) 91212-1212', // Cíclico
        '(31) 98765-432'   // Tamanho incompleto
    ];

    for (const tel of invalidos) {
        assert.equal(isTelefoneIrregularParaOperacao(tel), true, `Telefone ${tel} deve ser detectado como irregular`);
    }
}

// 3. Cenários de Pacientes com Telefones Válidos (Celular e Fixo)
{
    console.log('  [3] Validando liberação para telefones válidos...');
    const validos = [
        '(31) 98215-6251',
        '31982156251',
        '(31) 3837-1234',
        '3138371234',
        '(11) 98721-4356'
    ];

    for (const tel of validos) {
        assert.equal(isTelefoneIrregularParaOperacao(tel), false, `Telefone ${tel} deve ser detectado como válido`);
    }
}

// 4. Verificação Estática de `ConfirmacaoAtendimentosModal.tsx`
{
    console.log('  [4] Verificando integração no ConfirmacaoAtendimentosModal.tsx...');
    const modalPath = path.join(projectRoot, 'components', 'consultas', 'ConfirmacaoAtendimentosModal.tsx');
    const modalContent = fs.readFileSync(modalPath, 'utf-8');

    assert.ok(modalContent.includes('isTelefoneIrregularParaOperacao'), 'Deve importar e utilizar isTelefoneIrregularParaOperacao');
    assert.ok(modalContent.includes('RegularizacaoTelefoneModal'), 'Deve importar e renderizar RegularizacaoTelefoneModal');
    assert.ok(modalContent.includes('handleTriggerSituacao'), 'Deve ter o handler handleTriggerSituacao');
    assert.ok(modalContent.includes('handleTriggerSituacao(booking, \'Realizado\')'), 'Botão Realizado deve chamar handleTriggerSituacao');
    assert.ok(modalContent.includes('handleTriggerSituacao(booking, \'Não Realizado\')'), 'Botão Faltou deve chamar handleTriggerSituacao');
    assert.ok(modalContent.includes('handlePhoneRegularizadoSuccess'), 'Deve tratar o sucesso da regularização');
}

// 5. Verificação Estática de `AcompanharScreen.tsx`
{
    console.log('  [5] Verificando integração no AcompanharScreen.tsx...');
    const screenPath = path.join(projectRoot, 'components', 'consultas', 'AcompanharScreen.tsx');
    const screenContent = fs.readFileSync(screenPath, 'utf-8');

    assert.ok(screenContent.includes('isTelefoneIrregularParaOperacao'), 'Deve importar e utilizar isTelefoneIrregularParaOperacao');
    assert.ok(screenContent.includes('RegularizacaoTelefoneModal'), 'Deve importar e renderizar RegularizacaoTelefoneModal');
    assert.ok(screenContent.includes('handleStatusUpdate'), 'Deve interceptar em handleStatusUpdate');
    assert.ok(screenContent.includes('newStatus === \'Realizado\' || newStatus === \'Não Realizado\''), 'Deve validar Realizado e Não Realizado');
    assert.ok(screenContent.includes('handlePhoneRegularizadoSuccess'), 'Deve sincronizar paciente e executar status pendente no sucesso');
}

// 6. Verificação de Portal e z-index em `RegularizacaoTelefoneModal.tsx`
{
    console.log('  [6] Verificando createPortal e z-index em RegularizacaoTelefoneModal.tsx...');
    const regModalPath = path.join(projectRoot, 'components', 'common', 'RegularizacaoTelefoneModal.tsx');
    const regModalContent = fs.readFileSync(regModalPath, 'utf-8');

    assert.ok(regModalContent.includes('createPortal'), 'Deve utilizar createPortal para renderização no topo do DOM');
    assert.ok(regModalContent.includes('z-[10005]'), 'Deve possuir z-index superior z-[10005]');
}

console.log('✅ Todos os 6 testes foram aprovados com sucesso!');
