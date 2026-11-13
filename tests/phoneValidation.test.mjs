import test from 'node:test';
import assert from 'node:assert/strict';

// Importa a lógica compilada ou transpila
import { 
    validateBrazilianPhone, 
    normalizePhone, 
    formatBrazilianPhone, 
    formatWhatsApp,
    maskWhatsAppInput,
    formatLandlinePhone,
    maskLandlineInput,
    validateWhatsApp,
    validateLandlinePhone,
    isSuspiciousPhone, 
    getPhoneInconsistencyReason, 
    isTelefoneIrregularParaOperacao,
    getMotivoIrregularidadeOperacao,
    VALID_BRAZILIAN_DDDS, 
    TELEFONE_INVALIDO_MSG 
} from '../utils/phoneValidation.ts';

test('1. Lista Oficial Anatel possui exatamente 67 DDDs válidos', () => {
    assert.equal(VALID_BRAZILIAN_DDDS.size, 67);
    assert.equal(VALID_BRAZILIAN_DDDS.has('31'), true);
    assert.equal(VALID_BRAZILIAN_DDDS.has('11'), true);
    assert.equal(VALID_BRAZILIAN_DDDS.has('21'), true);
    assert.equal(VALID_BRAZILIAN_DDDS.has('99'), true);
    // DDDs inválidos
    assert.equal(VALID_BRAZILIAN_DDDS.has('00'), false);
    assert.equal(VALID_BRAZILIAN_DDDS.has('01'), false);
    assert.equal(VALID_BRAZILIAN_DDDS.has('10'), false);
    assert.equal(VALID_BRAZILIAN_DDDS.has('20'), false);
    assert.equal(VALID_BRAZILIAN_DDDS.has('30'), false);
    assert.equal(VALID_BRAZILIAN_DDDS.has('52'), false);
});

test('2. Telefones celulares válidos e reais são aceitos', () => {
    // Telefones reais extraídos da imagem do próprio sistema e exemplos válidos
    const validPhones = [
        '(31) 99789-5820',
        '(31) 99817-0668',
        '(31) 98324-1436',
        '(31) 98241-1349',
        '(31) 98393-8548',
        '(11) 98452-1928',
        '(21) 97412-5896',
        '(81) 99234-8765'
    ];

    for (const phone of validPhones) {
        const res = validateBrazilianPhone(phone);
        assert.equal(res.isValid, true, `Esperava telefone válido para "${phone}" mas retornou: ${res.diagnosticReason}`);
        assert.equal(res.type, 'mobile');
        assert.equal(isSuspiciousPhone(phone), false);
        assert.equal(getPhoneInconsistencyReason(phone), null);
    }
});

test('3. Telefones fixos válidos e reais são aceitos', () => {
    const validLandlines = [
        '(31) 3855-1234',
        '(31) 3212-4567',
        '(11) 2345-1200',
        '(21) 4004-1234'
    ];

    for (const phone of validLandlines) {
        const res = validateBrazilianPhone(phone);
        assert.equal(res.isValid, true, `Esperava telefone fixo válido para "${phone}" mas retornou: ${res.diagnosticReason}`);
        assert.equal(res.type, 'landline');
        assert.equal(isSuspiciousPhone(phone), false);
    }
});

test('4. Bloqueia sequências repetitivas com o DDD', () => {
    const repetitivePhones = [
        '(11) 1 1111-1111',
        '(22) 2 2222-2222',
        '(33) 3 3333-3333',
        '(11) 1111-1111',
        '(44) 4444-4444'
    ];

    for (const phone of repetitivePhones) {
        const res = validateBrazilianPhone(phone);
        assert.equal(res.isValid, false, `Deveria rejeitar "${phone}"`);
        assert.equal(isSuspiciousPhone(phone), true);
        assert.match(res.errorMessage, /Telefone inválido ou com padrão de preenchimento fictício/);
    }
});

test('5. Bloqueia números com todos os dígitos iguais ou local só com mesmo dígito', () => {
    const allSame = [
        '99999999999',
        '11111111111',
        '88888888888',
        '00000000000',
        '(31) 9 9999-9999',
        '(31) 8 8888-8888',
        '(31) 2222-2222'
    ];

    for (const phone of allSame) {
        const res = validateBrazilianPhone(phone);
        assert.equal(res.isValid, false, `Deveria rejeitar "${phone}"`);
        assert.equal(isSuspiciousPhone(phone), true);
    }
});

test('6. Bloqueia zeros repetidos e números locais zerados', () => {
    const zeroPhones = [
        '(00) 0 0000-0000',
        '(31) 0 0000-0000',
        '(31) 0000-0000',
        '(31) 90000-0000',
        '(31) 2000-0000'
    ];

    for (const phone of zeroPhones) {
        const res = validateBrazilianPhone(phone);
        assert.equal(res.isValid, false, `Deveria rejeitar "${phone}"`);
        assert.equal(isSuspiciousPhone(phone), true);
    }
});

test('7. Bloqueia sequências progressivas e regressivas', () => {
    const sequences = [
        '(31) 12345-6789',
        '(31) 98765-4321',
        '(31) 91234-5678',
        '(31) 98765-4320',
        '(31) 8765-4321',
        '(31) 2345-6789'
    ];

    for (const phone of sequences) {
        const res = validateBrazilianPhone(phone);
        assert.equal(res.isValid, false, `Deveria rejeitar sequência "${phone}"`);
        assert.equal(isSuspiciousPhone(phone), true);
    }
});

test('8. Bloqueia padrões cíclicos artificiais', () => {
    const cyclic = [
        '(31) 91212-1212',
        '(31) 92323-2323',
        '(31) 91231-2312',
        '(31) 2323-2323',
        '(31) 1234-1234'
    ];

    for (const phone of cyclic) {
        const res = validateBrazilianPhone(phone);
        assert.equal(res.isValid, false, `Deveria rejeitar padrão cíclico "${phone}"`);
        assert.equal(isSuspiciousPhone(phone), true);
    }
});

test('9. Bloqueia DDDs inexistentes conforme lista oficial', () => {
    const invalidDdds = [
        '(00) 98765-1234',
        '(01) 98765-1234',
        '(10) 98765-1234',
        '(20) 98765-1234',
        '(23) 98765-1234',
        '(25) 98765-1234',
        '(30) 98765-1234',
        '(36) 98765-1234',
        '(39) 98765-1234',
        '(40) 98765-1234',
        '(50) 98765-1234',
        '(52) 98765-1234',
        '(70) 98765-1234',
        '(80) 98765-1234',
        '(90) 98765-1234'
    ];

    for (const phone of invalidDdds) {
        const res = validateBrazilianPhone(phone);
        assert.equal(res.isValid, false, `Deveria rejeitar DDD de "${phone}"`);
        assert.equal(res.errorCode, 'INVALID_DDD');
    }
});

test('10. Bloqueia comprimentos incorretos de dígitos', () => {
    const invalidLengths = [
        '12345678', // 8 dígitos
        '123456789', // 9 dígitos
        '319876543210', // 12 dígitos
        '31', // 2 dígitos
        '1'
    ];

    for (const phone of invalidLengths) {
        const res = validateBrazilianPhone(phone);
        assert.equal(res.isValid, false, `Deveria rejeitar comprimento de "${phone}"`);
        assert.equal(res.errorCode, 'INVALID_LENGTH');
    }
});

test('11. Bloqueia desrespeito às regras da Anatel para Celular e Fixo', () => {
    // Celular de 11 dígitos deve começar com 9 no número local
    const celSem9 = '(31) 88765-4321';
    const resCelSem9 = validateBrazilianPhone(celSem9);
    assert.equal(resCelSem9.isValid, false);
    assert.equal(resCelSem9.errorCode, 'INVALID_ANATEL_RULE');

    // Celular com prefixo 90 ou 91
    const cel90 = '(31) 90123-4567';
    const resCel90 = validateBrazilianPhone(cel90);
    assert.equal(resCel90.isValid, false);
    assert.equal(resCel90.errorCode, 'INVALID_ANATEL_RULE');

    // Fixo com 1º dígito fora da faixa 2..5 (ex: começando com 9 ou 1 ou 6 ou 0)
    const fixoInvalido = '(31) 9876-5432';
    const resFixo = validateBrazilianPhone(fixoInvalido);
    assert.equal(resFixo.isValid, false);
    assert.equal(resFixo.errorCode, 'INVALID_ANATEL_RULE');
});

test('12. Tratamento correto de campo vazio / opcional vs obrigatório', () => {
    // Vazio quando opcional (padrão)
    const emptyOpt1 = validateBrazilianPhone('');
    assert.equal(emptyOpt1.isValid, true);
    assert.equal(emptyOpt1.isEmpty, true);

    const emptyOpt2 = validateBrazilianPhone(null);
    assert.equal(emptyOpt2.isValid, true);
    assert.equal(emptyOpt2.isEmpty, true);

    const emptyOpt3 = validateBrazilianPhone('   ');
    assert.equal(emptyOpt3.isValid, true);
    assert.equal(emptyOpt3.isEmpty, true);

    // Vazio quando obrigatório
    const emptyReq = validateBrazilianPhone('', { required: true });
    assert.equal(emptyReq.isValid, false);
    assert.equal(emptyReq.errorCode, 'EMPTY');

    // Mas se o usuário digitar QUALQUER número no opcional, valida com rigor
    const typedInvalid = validateBrazilianPhone('(31) 00000-0000', { required: false });
    assert.equal(typedInvalid.isValid, false);
    assert.equal(typedInvalid.errorMessage, TELEFONE_INVALIDO_MSG);
});

test('13. Formatação progressiva de telefone', () => {
    assert.equal(formatBrazilianPhone('31997895820'), '(31) 99789-5820');
    assert.equal(formatBrazilianPhone('3138551234'), '(31) 3855-1234');
    assert.equal(formatBrazilianPhone('319978'), '(31) 9978');
    assert.equal(formatBrazilianPhone('31'), '31');
});

test('14. isTelefoneIrregularParaOperacao bloqueia vazios, fictícios e aceita válidos', () => {
    // Vazio ou nulo bloqueia em agendamento/dispensação
    assert.equal(isTelefoneIrregularParaOperacao(''), true);
    assert.equal(isTelefoneIrregularParaOperacao(null), true);
    assert.equal(isTelefoneIrregularParaOperacao(undefined), true);
    assert.equal(isTelefoneIrregularParaOperacao('   '), true);

    // Fictícios e irregulares bloqueiam
    assert.equal(isTelefoneIrregularParaOperacao('(11) 1 1111-1111'), true);
    assert.equal(isTelefoneIrregularParaOperacao('(31) 0 0000-0000'), true);
    assert.equal(isTelefoneIrregularParaOperacao('(00) 98765-4321'), true);
    assert.equal(isTelefoneIrregularParaOperacao('(31) 98765-4321'), true);
    assert.equal(isTelefoneIrregularParaOperacao('99999999999'), true);

    // Telefones válidos NÃO bloqueiam
    assert.equal(isTelefoneIrregularParaOperacao('(31) 99789-5820'), false);
    assert.equal(isTelefoneIrregularParaOperacao('(31) 99817-0668'), false);
    assert.equal(isTelefoneIrregularParaOperacao('(31) 3855-1234'), false);
});

test('15. formatWhatsApp e maskWhatsAppInput aplicam máscara (00) 0 0000-0000', () => {
    assert.equal(formatWhatsApp('31983790670'), '(31) 9 8379-0670');
    assert.equal(maskWhatsAppInput('31997895820'), '(31) 9 9789-5820');
    assert.equal(formatWhatsApp('319'), '(31) 9');
    assert.equal(formatWhatsApp('3198'), '(31) 9 8');
    assert.equal(formatWhatsApp('3198379'), '(31) 9 8379');
    assert.equal(formatWhatsApp('31'), '(31');
    assert.equal(formatWhatsApp(''), '');
});

test('16. validateWhatsApp valida celular obrigatório, DDD e bloqueia fictícios', () => {
    // Vazio é bloqueado por padrão (campo obrigatório)
    const emptyCheck = validateWhatsApp('');
    assert.equal(emptyCheck.isValid, false);
    assert.equal(emptyCheck.errorCode, 'EMPTY');

    // Fixo é rejeitado no WhatsApp
    const landlineCheck = validateWhatsApp('(31) 3855-1234');
    assert.equal(landlineCheck.isValid, false);

    // Celular sem 9 é rejeitado
    const noNine = validateWhatsApp('(31) 88379-0670');
    assert.equal(noNine.isValid, false);

    // Celular fictício é rejeitado
    const fake = validateWhatsApp('(31) 9 9999-9999');
    assert.equal(fake.isValid, false);

    // Celular válido é aceito e formatado corretamente
    const valid = validateWhatsApp('(31) 98379-0670');
    assert.equal(valid.isValid, true);
    assert.equal(valid.formatted, '(31) 9 8379-0670');
});

test('17. formatLandlinePhone e maskLandlineInput aplicam máscara (00) 0000-0000', () => {
    assert.equal(formatLandlinePhone('3138551234'), '(31) 3855-1234');
    assert.equal(maskLandlineInput('1123456789'), '(11) 2345-6789');
    assert.equal(formatLandlinePhone('31'), '(31');
    assert.equal(formatLandlinePhone('3138'), '(31) 38');
    assert.equal(formatLandlinePhone(''), '');
});

test('18. validateLandlinePhone valida fixo opcional, bloqueia celulares e fictícios', () => {
    // Vazio é aceito (campo opcional)
    const emptyCheck = validateLandlinePhone('');
    assert.equal(emptyCheck.isValid, true);
    assert.equal(emptyCheck.isEmpty, true);

    const nullCheck = validateLandlinePhone(null);
    assert.equal(nullCheck.isValid, true);

    // Se preenchido com celular (11 dígitos), rejeita pois é campo exclusivo para fixo
    const celCheck = validateLandlinePhone('(31) 98379-0670');
    assert.equal(celCheck.isValid, false);

    // Fixo com 1º dígito inválido (ex: 9 ou 1 ou 8)
    const badStart = validateLandlinePhone('(31) 8234-5678');
    assert.equal(badStart.isValid, false);

    // Fixo com DDD inexistente
    const badDdd = validateLandlinePhone('(00) 3855-1234');
    assert.equal(badDdd.isValid, false);

    // Fixo fictício
    const fake = validateLandlinePhone('(31) 3333-3333');
    assert.equal(fake.isValid, false);

    // Fixo válido é aceito e formatado
    const valid = validateLandlinePhone('(31) 3855-1234');
    assert.equal(valid.isValid, true);
    assert.equal(valid.formatted, '(31) 3855-1234');
});
