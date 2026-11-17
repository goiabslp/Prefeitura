import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  agruparHierarquicoDataDestino,
  calcularIndicadoresTransporte,
  normalizeCityTransporte
} from '../utils/transporteRules.ts';

test('1. Indicadores reais retornam estritamente 0 quando vazios (zero mocks)', () => {
  const demandasVazias = [];
  const veiculosVazios = [];
  const viagensVazias = [];

  const ind = calcularIndicadoresTransporte(demandasVazias, veiculosVazios, viagensVazias);

  assert.equal(ind.totalPacientes, 0, 'Total de pacientes deve ser 0 quando vazio');
  assert.equal(ind.aguardando, 0, 'Aguardando deve ser 0 quando vazio');
  assert.equal(ind.alocados, 0, 'Alocados deve ser 0 quando vazio');
  assert.equal(ind.confirmados, 0, 'Confirmados deve ser 0 quando vazio');
  assert.equal(ind.vagasDisponiveis, 0, 'Vagas disponíveis deve ser 0 quando vazio');
  assert.equal(ind.veiculosDisponiveis, 0, 'Veículos disponíveis deve ser 0 quando vazio');
});

test('2. Agrupamento trata agendamento sem destino como "Destino não informado" sem inventar cidade', () => {
  const demandas = [
    {
      id: 'dem_real_01',
      agendamentoId: 'ag_real_01',
      pacienteId: 'pac_01',
      pacienteNome: 'MARIA APARECIDA DA SILVA',
      pacienteCpf: '123.456.789-00',
      procedimentoId: 'proc_01',
      procedimentoNome: 'CONSULTA CARDIOLOGIA',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '08:00',
      municipioDestino: 'Destino não informado',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: 'Aguardando vaga',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const grupos = agruparHierarquicoDataDestino(demandas);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].data, '2026-11-20');
  assert.equal(grupos[0].destinos.length, 1);
  assert.equal(grupos[0].destinos[0].destino, 'Destino não informado');
  assert.equal(grupos[0].destinos[0].demandas[0].pacienteNome, 'MARIA APARECIDA DA SILVA');
});

test('3. Agrupamento hierárquico ordena pacientes pelo horário do agendamento', () => {
  const demandas = [
    {
      id: 'dem_real_02',
      agendamentoId: 'ag_real_02',
      pacienteId: 'pac_02',
      pacienteNome: 'PACIENTE DA TARDE',
      procedimentoNome: 'ORTOPEDIA',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '14:30',
      municipioDestino: 'IPATINGA - MG',
      statusTransporte: 'Aguardando vaga'
    },
    {
      id: 'dem_real_03',
      agendamentoId: 'ag_real_03',
      pacienteId: 'pac_03',
      pacienteNome: 'PACIENTE DA MANHÃ',
      procedimentoNome: 'CARDIOLOGIA',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '07:15',
      municipioDestino: 'IPATINGA - MG',
      statusTransporte: 'Aguardando vaga'
    }
  ];

  const grupos = agruparHierarquicoDataDestino(demandas);
  const pacientesOrdenados = grupos[0].destinos[0].demandas;
  assert.equal(pacientesOrdenados[0].horaAtendimento, '07:15');
  assert.equal(pacientesOrdenados[1].horaAtendimento, '14:30');
});
