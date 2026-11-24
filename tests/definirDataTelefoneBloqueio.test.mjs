import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

describe('Validação do Fluxo de Confirmação em DefinirDataModal', () => {
  it('RegularizacaoTelefoneModal deve possuir z-index superior a DefinirDataModal (z-[999999] ou configurável)', () => {
    const regularizacaoCode = fs.readFileSync('components/common/RegularizacaoTelefoneModal.tsx', 'utf8');
    assert.ok(regularizacaoCode.includes('zIndex || \'z-[999999]\''), 'Deve possuir z-index alto por padrão');
  });

  it('DefinirDataModal deve invocar RegularizacaoTelefoneModal com zIndex de topo absoluto', () => {
    const definirDataCode = fs.readFileSync('components/consultas/DefinirDataModal.tsx', 'utf8');
    assert.ok(definirDataCode.includes('zIndex="z-[9999999]"'), 'Deve passar zIndex de topo absoluto');
  });

  it('DefinirDataModal não deve possuir return silencioso em executarGravacaoAgendamento', () => {
    const definirDataCode = fs.readFileSync('components/consultas/DefinirDataModal.tsx', 'utf8');
    assert.ok(definirDataCode.includes('setErrorMsg(\'Nenhuma vaga de horário disponível selecionada.\')'), 'Deve alertar se não houver slot');
  });

  it('DefinirDataModal deve sinalizar visualmente no card se o paciente está sem telefone', () => {
    const definirDataCode = fs.readFileSync('components/consultas/DefinirDataModal.tsx', 'utf8');
    assert.ok(definirDataCode.includes('Sem telefone cadastrado'), 'Deve exibir botão/indicador de telefone ausente');
  });
});
