import test from 'node:test';
import assert from 'node:assert/strict';

// Importa a lógica pura de pesquisa inteligente compilada/adaptada para teste Node
import {
    procedureMatchesSearch,
    scoreProcedimentoMatch,
    tokenizeProcedimento,
    generateSupabaseProcedureSearchPatterns
} from '../utils/procedimentoSearchMatcher.ts';

test('1. Casos oficiais da tabela de hífens e preposições', () => {
    // ULTRASSOM - ABDOMINAL <=> Ultrassom do abdominal
    assert.equal(
        procedureMatchesSearch('ULTRASSOM - ABDOMINAL', 'Ultrassom do abdominal'),
        true,
        'Deve encontrar ULTRASSOM - ABDOMINAL por "Ultrassom do abdominal"'
    );

    // ULTRASSOM - ABDÔMEN TOTAL <=> Ultrassom de abdomen total
    assert.equal(
        procedureMatchesSearch('ULTRASSOM - ABDÔMEN TOTAL', 'Ultrassom de abdomen total'),
        true,
        'Deve encontrar ULTRASSOM - ABDÔMEN TOTAL por "Ultrassom de abdomen total"'
    );

    // ULTRASSOM - ABDÔMEN SUPERIOR <=> Ultrassom do abdomen superior
    assert.equal(
        procedureMatchesSearch('ULTRASSOM - ABDÔMEN SUPERIOR', 'Ultrassom do abdomen superior'),
        true,
        'Deve encontrar ULTRASSOM - ABDÔMEN SUPERIOR por "Ultrassom do abdomen superior"'
    );

    // ULTRASSOM - PAREDE ABDOMINAL <=> Ultrassom da parede abdominal
    assert.equal(
        procedureMatchesSearch('ULTRASSOM - PAREDE ABDOMINAL', 'Ultrassom da parede abdominal'),
        true,
        'Deve encontrar ULTRASSOM - PAREDE ABDOMINAL por "Ultrassom da parede abdominal"'
    );

    // CONSULTA - CARDIOLOGIA <=> Consulta de cardiologia
    assert.equal(
        procedureMatchesSearch('CONSULTA - CARDIOLOGIA', 'Consulta de cardiologia'),
        true,
        'Deve encontrar CONSULTA - CARDIOLOGIA por "Consulta de cardiologia"'
    );

    // ULTRASSOM - COM DOPPLER <=> Ultrassom com doppler
    assert.equal(
        procedureMatchesSearch('ULTRASSOM - COM DOPPLER', 'Ultrassom com doppler'),
        true,
        'Deve encontrar ULTRASSOM - COM DOPPLER por "Ultrassom com doppler"'
    );
});

test('2. Sentido inverso: Procedimento com preposição encontrado por pesquisa com hífen', () => {
    assert.equal(
        procedureMatchesSearch('CONSULTA DE CARDIOLOGIA', 'Consulta - Cardiologia'),
        true,
        'Deve encontrar CONSULTA DE CARDIOLOGIA por "Consulta - Cardiologia"'
    );

    assert.equal(
        procedureMatchesSearch('ULTRASSOM DA PAREDE ABDOMINAL', 'Ultrassom - Parede Abdominal'),
        true,
        'Deve encontrar ULTRASSOM DA PAREDE ABDOMINAL por "Ultrassom - Parede Abdominal"'
    );

    assert.equal(
        procedureMatchesSearch('ULTRASSOM DO ABDOMEN SUPERIOR', 'Ultrassom - Abdomen Superior'),
        true,
        'Deve encontrar ULTRASSOM DO ABDOMEN SUPERIOR por "Ultrassom - Abdomen Superior"'
    );
});

test('3. Pesquisa parcial e por prefixo', () => {
    // "ultrassom do abdomen" deve encontrar "ULTRASSOM - ABDÔMEN TOTAL" e "ULTRASSOM - ABDÔMEN SUPERIOR"
    assert.equal(
        procedureMatchesSearch('ULTRASSOM - ABDÔMEN TOTAL', 'ultrassom do abdomen'),
        true,
        'Pesquisa parcial "ultrassom do abdomen" deve encontrar "ULTRASSOM - ABDÔMEN TOTAL"'
    );

    assert.equal(
        procedureMatchesSearch('ULTRASSOM - ABDÔMEN SUPERIOR', 'ultrassom do abdomen'),
        true,
        'Pesquisa parcial "ultrassom do abdomen" deve encontrar "ULTRASSOM - ABDÔMEN SUPERIOR"'
    );

    // Variações de prefixos abreviados
    assert.equal(
        procedureMatchesSearch('ULTRASSOM - ABDÔMEN TOTAL', 'ultra abd'),
        true,
        'Prefixos abreviados "ultra abd" deve encontrar "ULTRASSOM - ABDÔMEN TOTAL"'
    );
});

test('4. Distinção clínica estrita: NÃO confundir procedimentos diferentes', () => {
    // "ultrassom do abdomen superior" NÃO deve encontrar "ULTRASSOM - ABDÔMEN TOTAL"
    assert.equal(
        procedureMatchesSearch('ULTRASSOM - ABDÔMEN TOTAL', 'ultrassom do abdomen superior'),
        false,
        'Pesquisa "ultrassom do abdomen superior" NÃO deve encontrar "ULTRASSOM - ABDÔMEN TOTAL"'
    );

    // "ultrassom de abdomen total" NÃO deve encontrar "ULTRASSOM - ABDÔMEN SUPERIOR"
    assert.equal(
        procedureMatchesSearch('ULTRASSOM - ABDÔMEN SUPERIOR', 'ultrassom de abdomen total'),
        false,
        'Pesquisa "ultrassom de abdomen total" NÃO deve encontrar "ULTRASSOM - ABDÔMEN SUPERIOR"'
    );
});

test('5. Pesquisa por Código do Procedimento', () => {
    // Código exato
    assert.equal(
        procedureMatchesSearch('AUDIOMETRIA', '0092', '0092'),
        true,
        'Deve encontrar pelo código exato'
    );

    // Código com prefixo "cod 0092"
    assert.equal(
        procedureMatchesSearch('AUDIOMETRIA', 'cod 0092', '0092'),
        true,
        'Deve encontrar por "cod 0092"'
    );

    // Código parcial/sem zeros à esquerda
    assert.equal(
        procedureMatchesSearch('AUDIOMETRIA', '92', '0092'),
        true,
        'Deve encontrar por dígito final do código "92"'
    );
});

test('6. Geração de padrões SQL para o Supabase', () => {
    const patterns = generateSupabaseProcedureSearchPatterns('Ultrassom do abdomen');
    assert.ok(patterns.includes('%Ultrassom do abdomen%'));
    assert.ok(patterns.includes('%ultrassom%abdomen%'));
});

