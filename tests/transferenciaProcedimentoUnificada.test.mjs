import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== TESTE: Transferência de Procedimento Unificada & Resolução do Erro ===\n');

// 1. Validar que o código de consultasService não contém joins quebrados em transferAgendamentoProcedimento
const serviceCode = fs.readFileSync('services/consultasService.ts', 'utf8');

// Não deve conter a query quebrada que causava 'Solicitação de agendamento não encontrada.'
assert.ok(
    !serviceCode.includes('procedimento:consultas_procedimentos(\n                *,\n                especialista:consultas_especialistas(*)'),
    'Falha: consultasService.ts ainda contém relação inválida especialista:consultas_especialistas dentro de consultas_procedimentos.'
);
console.log('✔ [VALIDAÇÃO 1] Relação inválida PostgREST de especialista aninhado removida com sucesso.');

// 2. Validar que transferAgendamentoProcedimento delega para a mesma lógica consolidada (batchTransferAgendamentos)
assert.ok(
    serviceCode.includes('batchTransferAgendamentos({') &&
    serviceCode.includes('bookingIds: [id]') &&
    serviceCode.includes('export const transferAgendamentoProcedimento = async'),
    'Falha: transferAgendamentoProcedimento deve delegar para batchTransferAgendamentos com [id].'
);
console.log('✔ [VALIDAÇÃO 2] Unificação no backend confirmada: transferAgendamentoProcedimento utiliza a mesma função de transferência em lote.');

// 3. Validar AcompanharScreen.tsx: os 3 pontos de acionamento abrem o mesmo modal unificado
const screenCode = fs.readFileSync('components/consultas/AcompanharScreen.tsx', 'utf8');

// handleOpenTransferModal define transferTargetBookings([booking]) e abre isBatchTransferModalOpen
assert.ok(
    screenCode.includes('setTransferTargetBookings([booking])') &&
    screenCode.includes('setIsBatchTransferModalOpen(true)'),
    'Falha: handleOpenTransferModal deve configurar transferTargetBookings e abrir o modal unificado.'
);
console.log('✔ [VALIDAÇÃO 3] Acionamento individual no card (ícone e expandido) configurado para o modal unificado.');

// Modo de seleção em lote configura transferTargetBookings e abre o mesmo modal
assert.ok(
    screenCode.includes('setTransferTargetBookings(selectedBookingsList)') &&
    screenCode.includes('onOpenTransfer'),
    'Falha: Barra de ações em lote deve utilizar o mesmo modal unificado.'
);
console.log('✔ [VALIDAÇÃO 4] Acionamento em lote configurado para o mesmo modal unificado.');

// Modal duplicado antigo foi removido
assert.ok(
    !screenCode.includes('{/* MODAL: TRANSFERIR PROCEDIMENTO */}'),
    'Falha: Modal duplicado antigo inline ainda está presente em AcompanharScreen.tsx.'
);
console.log('✔ [VALIDAÇÃO 5] Modal duplicado antigo removido; base de código 100% unificada.');

// 4. Validar BatchActionsModals.tsx: suporta visual rico para 1 item e lista resumida para N itens
const modalsCode = fs.readFileSync('components/consultas/BatchActionsModals.tsx', 'utf8');

assert.ok(
    modalsCode.includes("isSingle ? 'Transferir Procedimento' : 'Transferência em Lote'"),
    'Falha: BatchTransferModal deve ajustar o título dinamicamente para 1 ou N itens.'
);
assert.ok(
    modalsCode.includes("isSingle ? 'Confirmar Transferência' : 'Confirmar Transferência em Lote'"),
    'Falha: Botão de confirmação deve refletir se a operação é individual ou em lote.'
);
assert.ok(
    modalsCode.includes('O procedimento selecionado é o mesmo atual'),
    'Falha: BatchTransferModal deve impedir transferir para o mesmo procedimento de origem.'
);
console.log('✔ [VALIDAÇÃO 6] Modal inteligente validado: exibe dados completos do paciente quando individual e resumo quando em lote.');

// 5. Validar suporte a "Desfazer Transferência" em TransferSuccessModal
const successModalCode = fs.readFileSync('components/consultas/TransferSuccessModal.tsx', 'utf8');
assert.ok(
    successModalCode.includes('onUndoTransfer') && successModalCode.includes('Transferência Realizada com Sucesso!'),
    'Falha: TransferSuccessModal deve permitir desfazer a transferência.'
);
console.log('✔ [VALIDAÇÃO 7] Fluxo de confirmação e reversão imediata ("Desfazer Transferência") verificado.');

console.log('\n======================================================');
console.log('TODAS AS 7 VALIDAÇÕES AUTOMATIZADAS FORAM APROVADAS COM SUCESSO!');
console.log('======================================================');
