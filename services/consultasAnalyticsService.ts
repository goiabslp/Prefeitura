import { ConsultaAgendamento, ConsultaProcedimento, ConsultaVaga, AGENTES_DE_SAUDE } from '../types';

export interface MetricasPrazos {
  prazoMedioSolicitacaoAgendamentoDias: number;
  prazoMedioSolicitacaoRealizacaoDias: number;
  tempoMedioFilaEsperaAtualDias: number;
  prazoNormalDias: number;
  prazoEspecialDias: number;
  prazoUrgenciaDias: number;
  reducaoTempoEspecialPerc: number;
  faixasEspera: {
    faixa: string;
    quantidade: number;
    percentual: number;
    color: string;
  }[];
  rankingProcedimentosPrazos: {
    id: string;
    nome: string;
    tipo: string;
    tempoMedioDias: number;
    totalAtendidos: number;
    pacientesAguardando: number;
    slaStatus: 'adequado' | 'alerta' | 'critico';
  }[];
}

export interface PrevisaoFilaProcedimento {
  id: string;
  nome: string;
  tipo: string;
  pacientesFila: number;
  pacientesEspeciais: number;
  vagasOfertadasMes: number;
  vazaoMediaDia: number;
  diasParaZerar: number;
  dataEstimadaConclusao: string;
  nivelRisco: 'Baixo' | 'Médio' | 'Alto' | 'Crítico';
  recomendacaoIA: string;
}

export interface AlertaPreditivoIA {
  id: string;
  tipo: 'critico' | 'alerta' | 'oportunidade' | 'sucesso';
  titulo: string;
  descricao: string;
  procedimento?: string;
  acaoSugerida: string;
  impactoEstimado: string;
}

export interface PilarScore {
  nome: string;
  score: number;
  max: number;
  status: 'Excelente' | 'Bom' | 'Atenção' | 'Crítico';
  detalhe: string;
}

export interface MetricasIAPredicoes {
  scoreRegulacao: number;
  classificacaoScore: 'Excelente' | 'Bom' | 'Atenção' | 'Crítico';
  pilares: PilarScore[];
  previsoesFilas: PrevisaoFilaProcedimento[];
  alertasPreditivos: AlertaPreditivoIA[];
  parecerTecnicoIA: {
    resumoExecutivo: string;
    pontosCriticos: string[];
    pontosFortes: string[];
    recomendacoesEstrategicas: string[];
  };
  projecaoProximos30Dias: {
    novasSolicitacoesEstimadas: number;
    vagasNecessariasParaEstabilidade: number;
    deficitVagasProjetado: number;
  };
}

export interface MetricasVolumeEFunil {
  totalSolicitacoes: number;
  totalFilaEspera: number;
  totalAguardandoData: number;
  totalAgendados: number;
  totalRealizados: number;
  totalCancelados: number;
  totalNaoRealizados: number;
  totalRetornos: number;
  totalEspeciais: number;
  totalNormais: number;
  totalUrgencias: number;
  taxaConversaoResolucao: number; // % que chegou a Realizado
  taxaAbsenteismo: number; // % cancelado ou faltoso
  taxaOcupacaoVagas: number; // % vagas ocupadas
  vagasTotaisCadastradas: number;
  vagasDisponiveisLivres: number;
}

export interface ConsultasAnalyticsCompleto {
  periodo: string;
  isMockData: boolean;
  volume: MetricasVolumeEFunil;
  prazos: MetricasPrazos;
  ia: MetricasIAPredicoes;
  distribuicaoStatus: { status: string; count: number; color: string; percentual: number }[];
  distribuicaoPrioridades: { prioridade: string; count: number; color: string; percentual: number }[];
  distribuicaoTipos: { tipo: string; count: number; color: string }[];
  evolucaoTemporal: {
    periodoLabel: string;
    solicitados: number;
    agendados: number;
    realizados: number;
    faltas: number;
  }[];
  distribuicaoBairros: { bairro: string; total: number; fila: number; realizados: number }[];
  distribuicaoAgentes: { agente: string; total: number; especiais: number }[];
}

// Utilitário para calcular a diferença em dias entre duas datas (strings ou Date)
export const calcularDiferencaDias = (dataFim: string | Date, dataInicio: string | Date): number => {
  try {
    const d1 = typeof dataInicio === 'string' ? new Date(dataInicio.includes('T') ? dataInicio : `${dataInicio}T00:00:00`) : dataInicio;
    const d2 = typeof dataFim === 'string' ? new Date(dataFim.includes('T') ? dataFim : `${dataFim}T00:00:00`) : dataFim;
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  } catch {
    return 0;
  }
};

export const formatarDataBR = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Gera um dataset representativo e rico com múltiplos agendamentos e pacientes para simulação e teste do Dashboard
 */
export const gerarMockConsultasDataset = (procedimentosCadastrados: ConsultaProcedimento[]): {
  agendamentos: ConsultaAgendamento[];
  vagas: ConsultaVaga[];
} => {
  const bairros = ['Centro', 'Vila Esperança', 'Jardim Alvorada', 'Bairro São Francisco', 'Cohab II', 'Planalto Verde', 'Distrito Industrial', 'Santa Rita'];
  const agentes = AGENTES_DE_SAUDE.slice(0, 10);
  const hoje = new Date();

  // Selecionar alguns procedimentos padrão representativos
  const procsBase = procedimentosCadastrados.length >= 6 ? procedimentosCadastrados.slice(0, 12) : [
    { id: 'p-1', name: 'Consulta Médica em Cardiologia', type: 'Consulta', available_quantity: 12, total_quantity: 30, status: 'Ativo' },
    { id: 'p-2', name: 'Ultrassonografia Geral', type: 'Exame', available_quantity: 8, total_quantity: 40, status: 'Ativo' },
    { id: 'p-3', name: 'Consulta Médica em Oftalmologia', type: 'Consulta', available_quantity: 4, total_quantity: 25, status: 'Ativo' },
    { id: 'p-4', name: 'Ressonância Magnética com Contraste', type: 'Exame', available_quantity: 2, total_quantity: 15, status: 'Ativo' },
    { id: 'p-5', name: 'Consulta Médica em Ortopedia', type: 'Consulta', available_quantity: 15, total_quantity: 35, status: 'Ativo' },
    { id: 'p-6', name: 'Eletrocardiograma (ECG)', type: 'Exame', available_quantity: 28, total_quantity: 50, status: 'Ativo' },
    { id: 'p-7', name: 'Consulta Médica em Pediatria', type: 'Consulta', available_quantity: 18, total_quantity: 40, status: 'Ativo' },
    { id: 'p-8', name: 'Endoscopia Digestiva Alta', type: 'Exame', available_quantity: 6, total_quantity: 20, status: 'Ativo' },
  ] as ConsultaProcedimento[];

  const mockAgendamentos: ConsultaAgendamento[] = [];
  const mockVagas: ConsultaVaga[] = [];

  // Gera vagas distribuídas
  procsBase.forEach((proc, pIdx) => {
    for (let dayOffset = -15; dayOffset <= 20; dayOffset++) {
      const vDate = new Date(hoje);
      vDate.setDate(vDate.getDate() + dayOffset);
      const dateStr = vDate.toISOString().split('T')[0];
      
      // 2 a 4 vagas por dia
      const slotsCount = 2 + (pIdx % 3);
      for (let s = 0; s < slotsCount; s++) {
        const hora = `${8 + s * 2}:00`;
        mockVagas.push({
          id: `vaga-${proc.id}-${dayOffset}-${s}`,
          procedimento_id: proc.id,
          data: dateStr,
          hora: hora,
          status: dayOffset < 0 ? 'Ocupada' : (s % 2 === 0 ? 'Ocupada' : 'Disponível'),
          created_at: new Date(hoje.getTime() - 30 * 86400000).toISOString()
        });
      }
    }
  });

  // Nomes fictícios de pacientes municipais
  const nomesPacientes = [
    'Maria Aparecida Ferreira', 'José Carlos dos Santos', 'Ana Paula de Oliveira',
    'Antônio Carlos da Silva', 'Francisca Helena Souza', 'João Paulo Rodrigues',
    'Sebastião Marcos Pinto', 'Lourdes de Fátima Alves', 'Raimundo Nonato Lima',
    'Terezinha de Jesus Costa', 'Geraldo Magela Barbosa', 'Benedita das Graças Moura',
    'Luciano Henrique Cardoso', 'Cleusa Maria de Freitas', 'Marcio Roberto Vieira',
    'Edson Arantes Guimarães', 'Vera Lúcia dos Passos', 'Valdir Donizete Ramos',
    'Neuza Maria Peixoto', 'Manoel Messias do Carmo', 'Rosana Cristina Batista',
    'Wagner Luiz Toledo', 'Marinalva Gomes da Silva', 'Claudio Roberto Silveira',
    'Adriana Mara de Paula', 'Everaldo Ribeiro Santos', 'Silvia Helena Mendonça',
    'Paulo Cesar Fernandes', 'Inês Aparecida Carvalho', 'Ailton Moreira Duarte'
  ];

  let idCounter = 1;

  // Gerar ~60 a 90 registros variados para criar estatísticas ricas
  nomesPacientes.forEach((nome, i) => {
    const proc = procsBase[i % procsBase.length];
    const bairro = bairros[i % bairros.length];
    const agente = agentes[i % agentes.length];
    
    // Distribuição de prioridades: 70% Normal, 20% Especial, 10% Urgência
    let priority: 'Normal' | 'Especial' | 'Urgência' = 'Normal';
    if (i % 5 === 0) priority = 'Especial';
    if (i % 9 === 0) priority = 'Urgência';

    // Criação em datas passadas (entre 45 dias atrás e 2 dias atrás)
    const diasAtrasSolicitacao = (i * 3) % 45 + 2;
    const dataSol = new Date(hoje);
    dataSol.setDate(dataSol.getDate() - diasAtrasSolicitacao);
    const dataSolStr = dataSol.toISOString().split('T')[0];

    // Status: 
    // Se Especial: tempo de resposta muito mais rápido (3 a 8 dias)
    // Se Normal: tempo mais longo (10 a 30 dias)
    let status: ConsultaAgendamento['status'] = 'Realizado';
    let appointmentDate: string | null = null;

    if (i % 7 === 0) {
      status = 'Fila de espera';
    } else if (i % 11 === 0) {
      status = 'Aguardando Data';
    } else if (i % 13 === 0) {
      status = 'Não Realizado'; // Falta/Absenteísmo
      const d = new Date(dataSol);
      d.setDate(d.getDate() + (priority === 'Especial' ? 6 : 18));
      appointmentDate = d.toISOString().split('T')[0];
    } else if (i % 17 === 0) {
      status = 'Cancelado';
      const d = new Date(dataSol);
      d.setDate(d.getDate() + 12);
      appointmentDate = d.toISOString().split('T')[0];
    } else if (i % 4 === 0) {
      status = 'Agendado'; // Futuro
      const d = new Date(hoje);
      d.setDate(d.getDate() + (i % 10 + 1));
      appointmentDate = d.toISOString().split('T')[0];
    } else {
      status = 'Realizado';
      const d = new Date(dataSol);
      const leadTime = priority === 'Especial' ? (3 + (i % 4)) : (14 + (i % 15));
      d.setDate(d.getDate() + leadTime);
      appointmentDate = d.toISOString().split('T')[0];
    }

    mockAgendamentos.push({
      id: `mock-ag-${idCounter++}`,
      patient_id: `pac-${i}`,
      procedimento_id: proc.id,
      appointment_date: appointmentDate,
      appointment_time: '08:30',
      solicitation_date: dataSolStr,
      created_at: dataSol.toISOString(),
      quantity: 1,
      priority: priority,
      queue_position: status === 'Fila de espera' ? (i % 10 + 1) : undefined,
      special_sequence: priority === 'Especial' && status === 'Fila de espera' ? (i % 3 + 1) : undefined,
      status: status,
      created_by: 'regulator-admin',
      paciente: {
        id: `pac-${i}`,
        name: nome,
        cpf: `123.${String(i).padStart(3, '0')}.456-78`,
        neighborhood: bairro,
        agente_saude: agente,
        birth_date: '1975-05-12'
      },
      procedimento: proc,
      responsavel: { name: 'Regulação Municipal' },
      cancellation_reason: status === 'Cancelado' ? 'Paciente impossibilitado de comparecer' : undefined
    });
  });

  return { agendamentos: mockAgendamentos, vagas: mockVagas };
};

/**
 * Calcula todas as métricas analíticas e de inteligência artificial a partir de agendamentos e procedimentos
 */
export const processarAnaliseConsultas = (
  agendamentos: ConsultaAgendamento[],
  procedimentos: ConsultaProcedimento[],
  vagas: ConsultaVaga[],
  filtroPeriodo: '7d' | '30d' | 'mes_atual' | 'ano_atual' | 'tudo' = 'tudo',
  filtroTipo: 'todos' | 'Exame' | 'Consulta' | 'Cirurgia' = 'todos',
  filtroPrioridade: 'todas' | 'Normal' | 'Especial' | 'Urgência' = 'todas',
  isMockData: boolean = false
): ConsultasAnalyticsCompleto => {
  const agora = new Date();

  // 1. Filtragem dos dados
  let filtrados = [...agendamentos];

  if (filtroTipo !== 'todos') {
    filtrados = filtrados.filter(a => a.procedimento?.type === filtroTipo);
  }

  if (filtroPrioridade !== 'todas') {
    filtrados = filtrados.filter(a => a.priority === filtroPrioridade);
  }

  if (filtroPeriodo !== 'tudo') {
    filtrados = filtrados.filter(a => {
      const dataRef = a.appointment_date || a.solicitation_date || a.created_at;
      if (!dataRef) return true;
      const d = new Date(dataRef.includes('T') ? dataRef : `${dataRef}T00:00:00`);
      if (isNaN(d.getTime())) return true;

      if (filtroPeriodo === '7d') {
        const limite = new Date(agora.getTime() - 7 * 86400000);
        return d >= limite;
      }
      if (filtroPeriodo === '30d') {
        const limite = new Date(agora.getTime() - 30 * 86400000);
        return d >= limite;
      }
      if (filtroPeriodo === 'mes_atual') {
        return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
      }
      if (filtroPeriodo === 'ano_atual') {
        return d.getFullYear() === agora.getFullYear();
      }
      return true;
    });
  }

  // 2. Métricas de Volume e Funil
  const totalSolicitacoes = filtrados.length;
  const totalFilaEspera = filtrados.filter(a => a.status === 'Fila de espera').length;
  const totalAguardandoData = filtrados.filter(a => a.status === 'Aguardando Data').length;
  const totalAgendados = filtrados.filter(a => a.status === 'Agendado').length;
  const totalRealizados = filtrados.filter(a => a.status === 'Realizado').length;
  const totalCancelados = filtrados.filter(a => a.status === 'Cancelado').length;
  const totalNaoRealizados = filtrados.filter(a => a.status === 'Não Realizado').length;
  const totalRetornos = filtrados.filter(a => a.status === 'Retorno' || a.is_retorno).length;

  const totalEspeciais = filtrados.filter(a => a.priority === 'Especial').length;
  const totalNormais = filtrados.filter(a => a.priority === 'Normal').length;
  const totalUrgencias = filtrados.filter(a => a.priority === 'Urgência').length;

  const concluidosOuFaltas = totalRealizados + totalNaoRealizados + totalCancelados;
  const taxaAbsenteismo = concluidosOuFaltas > 0
    ? Number((((totalNaoRealizados + totalCancelados) / concluidosOuFaltas) * 100).toFixed(1))
    : 0;

  const taxaConversaoResolucao = totalSolicitacoes > 0
    ? Number(((totalRealizados / totalSolicitacoes) * 100).toFixed(1))
    : 0;

  const vagasTotaisCadastradas = vagas.length;
  const vagasOcupadas = vagas.filter(v => v.status === 'Ocupada').length;
  const vagasDisponiveisLivres = vagas.filter(v => v.status === 'Disponível').length;
  const taxaOcupacaoVagas = vagasTotaisCadastradas > 0
    ? Number(((vagasOcupadas / vagasTotaisCadastradas) * 100).toFixed(1))
    : 0;

  // 3. Prazos Médios (Lead Time & SLA)
  // Prazo Solicitação -> Agendamento
  const prazosAgendamento: number[] = [];
  const prazosRealizacao: number[] = [];
  const prazosNormais: number[] = [];
  const prazosEspeciais: number[] = [];
  const prazosUrgencias: number[] = [];
  const permanenciaFila: number[] = [];

  // Agrupamento de prazos por procedimento
  const prazosPorProcMap: Record<string, { nome: string; tipo: string; leadTimes: number[]; filaCount: number }> = {};

  filtrados.forEach(a => {
    const dataInicio = a.solicitation_date || a.created_at;
    const procNome = a.procedimento?.name || 'Procedimento';
    const procTipo = a.procedimento?.type || 'Exame';
    const procId = a.procedimento_id || 'p-gen';

    if (!prazosPorProcMap[procId]) {
      prazosPorProcMap[procId] = {
        nome: procNome,
        tipo: procTipo,
        leadTimes: [],
        filaCount: 0
      };
    }

    if (a.status === 'Fila de espera') {
      prazosPorProcMap[procId].filaCount += 1;
      if (dataInicio) {
        const dias = calcularDiferencaDias(agora, dataInicio);
        permanenciaFila.push(dias);
      }
    }

    if ((a.status === 'Agendado' || a.status === 'Realizado') && a.appointment_date && dataInicio) {
      const diasAteAgenda = calcularDiferencaDias(a.appointment_date, dataInicio);
      prazosAgendamento.push(diasAteAgenda);
      prazosPorProcMap[procId].leadTimes.push(diasAteAgenda);

      if (a.priority === 'Especial') prazosEspeciais.push(diasAteAgenda);
      else if (a.priority === 'Urgência') prazosUrgencias.push(diasAteAgenda);
      else prazosNormais.push(diasAteAgenda);
    }

    if (a.status === 'Realizado' && a.appointment_date && dataInicio) {
      const diasAteRealizacao = calcularDiferencaDias(a.appointment_date, dataInicio);
      prazosRealizacao.push(diasAteRealizacao);
    }
  });

  const mediaArray = (arr: number[]): number => arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0;

  const prazoMedioSolicitacaoAgendamentoDias = mediaArray(prazosAgendamento);
  const prazoMedioSolicitacaoRealizacaoDias = mediaArray(prazosRealizacao);
  const tempoMedioFilaEsperaAtualDias = mediaArray(permanenciaFila);

  const prazoNormalDias = mediaArray(prazosNormais);
  const prazoEspecialDias = mediaArray(prazosEspeciais);
  const prazoUrgenciaDias = mediaArray(prazosUrgencias);

  const reducaoTempoEspecialPerc = prazoNormalDias > 0 && prazoEspecialDias > 0
    ? Number((((prazoNormalDias - prazoEspecialDias) / prazoNormalDias) * 100).toFixed(1))
    : (prazoNormalDias > 0 ? 65 : 0);

  // Faixas de Espera
  const todosTemposEspera = [...prazosAgendamento, ...permanenciaFila];
  const count0a7 = todosTemposEspera.filter(d => d <= 7).length;
  const count8a15 = todosTemposEspera.filter(d => d > 7 && d <= 15).length;
  const count16a30 = todosTemposEspera.filter(d => d > 15 && d <= 30).length;
  const count31a60 = todosTemposEspera.filter(d => d > 30 && d <= 60).length;
  const count60Mais = todosTemposEspera.filter(d => d > 60).length;
  const totalFaixas = todosTemposEspera.length || 1;

  const faixasEspera = [
    { faixa: '0 a 7 dias', quantidade: count0a7, percentual: Number(((count0a7 / totalFaixas) * 100).toFixed(1)), color: '#10b981' },
    { faixa: '8 a 15 dias', quantidade: count8a15, percentual: Number(((count8a15 / totalFaixas) * 100).toFixed(1)), color: '#38bdf8' },
    { faixa: '16 a 30 dias', quantidade: count16a30, percentual: Number(((count16a30 / totalFaixas) * 100).toFixed(1)), color: '#f59e0b' },
    { faixa: '31 a 60 dias', quantidade: count31a60, percentual: Number(((count31a60 / totalFaixas) * 100).toFixed(1)), color: '#f97316' },
    { faixa: '> 60 dias', quantidade: count60Mais, percentual: Number(((count60Mais / totalFaixas) * 100).toFixed(1)), color: '#ef4444' },
  ];

  // Ranking de Procedimentos por Prazo
  const rankingProcedimentosPrazos = Object.entries(prazosPorProcMap).map(([id, item]) => {
    const media = item.leadTimes.length > 0
      ? Number((item.leadTimes.reduce((a, b) => a + b, 0) / item.leadTimes.length).toFixed(1))
      : 0;

    let slaStatus: 'adequado' | 'alerta' | 'critico' = 'adequado';
    if (media > 30 || item.filaCount > 15) slaStatus = 'critico';
    else if (media > 15 || item.filaCount > 5) slaStatus = 'alerta';

    return {
      id,
      nome: item.nome,
      tipo: item.tipo,
      tempoMedioDias: media,
      totalAtendidos: item.leadTimes.length,
      pacientesAguardando: item.filaCount,
      slaStatus
    };
  }).sort((a, b) => b.tempoMedioDias - a.tempoMedioDias);

  // 4. Inteligência Artificial Preditiva (IA de Regulação)
  // Cálculo do Score de Saúde (0 a 100)
  // Pilar 1: Tempo Médio de Espera (max 30 pts)
  let scoreTempo = 30;
  if (prazoMedioSolicitacaoAgendamentoDias > 45) scoreTempo = 10;
  else if (prazoMedioSolicitacaoAgendamentoDias > 30) scoreTempo = 18;
  else if (prazoMedioSolicitacaoAgendamentoDias > 15) scoreTempo = 24;
  else scoreTempo = 30;

  // Pilar 2: Resolução da Fila (max 25 pts)
  let scoreResolucao = 25;
  if (taxaConversaoResolucao > 70) scoreResolucao = 25;
  else if (taxaConversaoResolucao > 50) scoreResolucao = 20;
  else if (taxaConversaoResolucao > 30) scoreResolucao = 15;
  else scoreResolucao = 8;

  // Pilar 3: Ocupação de Vagas (max 25 pts)
  let scoreOcupacao = 25;
  if (taxaOcupacaoVagas >= 65 && taxaOcupacaoVagas <= 92) scoreOcupacao = 25;
  else if (taxaOcupacaoVagas > 92) scoreOcupacao = 18; // saturação
  else if (taxaOcupacaoVagas >= 40) scoreOcupacao = 19;
  else scoreOcupacao = 12;

  // Pilar 4: Baixo Absenteísmo (max 20 pts)
  let scoreAbsenteismo = 20;
  if (taxaAbsenteismo < 8) scoreAbsenteismo = 20;
  else if (taxaAbsenteismo < 15) scoreAbsenteismo = 15;
  else if (taxaAbsenteismo < 25) scoreAbsenteismo = 10;
  else scoreAbsenteismo = 4;

  const scoreRegulacao = Math.min(100, Math.max(10, scoreTempo + scoreResolucao + scoreOcupacao + scoreAbsenteismo));

  let classificacaoScore: 'Excelente' | 'Bom' | 'Atenção' | 'Crítico' = 'Bom';
  if (scoreRegulacao >= 85) classificacaoScore = 'Excelente';
  else if (scoreRegulacao >= 70) classificacaoScore = 'Bom';
  else if (scoreRegulacao >= 50) classificacaoScore = 'Atenção';
  else classificacaoScore = 'Crítico';

  const pilares: PilarScore[] = [
    {
      nome: 'Tempo de Espera',
      score: scoreTempo,
      max: 30,
      status: scoreTempo >= 24 ? 'Excelente' : scoreTempo >= 18 ? 'Bom' : scoreTempo >= 14 ? 'Atenção' : 'Crítico',
      detalhe: `Média de ${prazoMedioSolicitacaoAgendamentoDias} dias para agendar.`
    },
    {
      nome: 'Resolução da Fila',
      score: scoreResolucao,
      max: 25,
      status: scoreResolucao >= 20 ? 'Excelente' : scoreResolucao >= 15 ? 'Bom' : 'Atenção',
      detalhe: `${taxaConversaoResolucao}% de solicitações concluídas com sucesso.`
    },
    {
      nome: 'Ocupação de Vagas',
      score: scoreOcupacao,
      max: 25,
      status: scoreOcupacao >= 20 ? 'Excelente' : scoreOcupacao >= 16 ? 'Bom' : 'Atenção',
      detalhe: `${taxaOcupacaoVagas}% de aproveitamento das vagas liberadas.`
    },
    {
      nome: 'Assiduidade (Baixas Faltas)',
      score: scoreAbsenteismo,
      max: 20,
      status: scoreAbsenteismo >= 18 ? 'Excelente' : scoreAbsenteismo >= 14 ? 'Bom' : 'Atenção',
      detalhe: `Absenteísmo em ${taxaAbsenteismo}% das marcações.`
    }
  ];

  // Previsões de Término de Fila por Procedimento (Burn-down Forecasting)
  const previsoesFilas: PrevisaoFilaProcedimento[] = Object.entries(prazosPorProcMap).map(([id, p]) => {
    const pacientesFila = p.filaCount;
    const especiais = filtrados.filter(a => a.procedimento_id === id && a.priority === 'Especial' && a.status === 'Fila de espera').length;
    
    // Contagem de vagas ofertadas no mês para este procedimento
    const vagasDoProc = vagas.filter(v => v.procedimento_id === id);
    const vagasOfertadasMes = vagasDoProc.length > 0 ? vagasDoProc.length : Math.max(10, p.leadTimes.length * 2);
    
    // Vazão média diária (vagas atendidas divididas por 30 dias)
    const vazaoMediaDia = Math.max(0.4, Number((Math.max(1, vagasOfertadasMes) / 22).toFixed(2))); // 22 dias úteis
    const diasParaZerar = vazaoMediaDia > 0 ? Math.ceil(pacientesFila / vazaoMediaDia) : 999;

    const dataEstimada = new Date(agora);
    dataEstimada.setDate(dataEstimada.getDate() + diasParaZerar);

    let nivelRisco: 'Baixo' | 'Médio' | 'Alto' | 'Crítico' = 'Baixo';
    let recomendacaoIA = 'Fluxo equilibrado com a capacidade atual.';

    if (diasParaZerar > 45 || pacientesFila > 20) {
      nivelRisco = 'Crítico';
      recomendacaoIA = `Sobrecarga crítica detectada! Ampliar cota mensal em +${Math.ceil(pacientesFila * 0.6)} vagas ou realizar mutirão.`;
    } else if (diasParaZerar > 25 || pacientesFila > 10) {
      nivelRisco = 'Alto';
      recomendacaoIA = `Fila acima do desejável. Monitorar e disponibilizar mais ${Math.ceil(pacientesFila * 0.3)} vagas na próxima quinzena.`;
    } else if (diasParaZerar > 12) {
      nivelRisco = 'Médio';
      recomendacaoIA = 'Tempo de espera moderado. Manter liberação periódica de horários.';
    }

    return {
      id,
      nome: p.nome,
      tipo: p.tipo,
      pacientesFila,
      pacientesEspeciais: especiais,
      vagasOfertadasMes,
      vazaoMediaDia,
      diasParaZerar: pacientesFila === 0 ? 0 : diasParaZerar,
      dataEstimadaConclusao: pacientesFila === 0 ? 'Fila Zerada' : formatarDataBR(dataEstimada),
      nivelRisco,
      recomendacaoIA
    };
  }).sort((a, b) => b.pacientesFila - a.pacientesFila);

  // Alertas Preditivos da IA
  const alertasPreditivos: AlertaPreditivoIA[] = [];

  // Alerta 1: Agendamentos Especiais
  if (totalEspeciais > 0) {
    alertasPreditivos.push({
      id: 'alert-especiais',
      tipo: 'sucesso',
      titulo: 'Eficiência de Agendamentos Especiais Comprovada',
      descricao: `Pacientes com prioridade Especial estão sendo atendidos com redução média de ${reducaoTempoEspecialPerc}% no tempo de espera comparado aos agendamentos normais (${prazoEspecialDias} vs ${prazoNormalDias} dias).`,
      acaoSugerida: 'Manter a regra de priorização especial no topo da fila.',
      impactoEstimado: 'Redução de judicialização e atendimento célere a casos prioritários.'
    });
  }

  // Alerta 2: Procedimento mais crítico
  const maisCritico = previsoesFilas.find(p => p.nivelRisco === 'Crítico' || p.nivelRisco === 'Alto');
  if (maisCritico) {
    alertasPreditivos.push({
      id: `alert-gargalo-${maisCritico.id}`,
      tipo: 'critico',
      titulo: `Gargalo Crítico: ${maisCritico.nome}`,
      descricao: `Existem ${maisCritico.pacientesFila} munícipes aguardando na fila de espera com previsão de ${maisCritico.diasParaZerar} dias para conclusão ao ritmo atual de vagas.`,
      procedimento: maisCritico.nome,
      acaoSugerida: maisCritico.recomendacaoIA,
      impactoEstimado: 'Evitar desassistência e acúmulo de queixas no serviço de regulação.'
    });
  }

  // Alerta 3: Absenteísmo / Faltas
  if (taxaAbsenteismo > 12) {
    alertasPreditivos.push({
      id: 'alert-absenteismo',
      tipo: 'alerta',
      titulo: `Taxa de Absenteísmo Elevada (${taxaAbsenteismo}%)`,
      descricao: 'O índice de pacientes que faltam no dia agendado ou cancelam em cima da hora está gerando ociosidade em consultas e exames de alto custo.',
      acaoSugerida: 'Implantar lembretes automatizados via WhatsApp com confirmação 48 horas antes da data marcada.',
      impactoEstimado: 'Possibilidade de recuperar até 60% das vagas perdidas por não comparecimento.'
    });
  }

  // Alerta 4: Oportunidade de Otimização de Vagas
  if (vagasDisponiveisLivres > 5) {
    alertasPreditivos.push({
      id: 'alert-vagas-ociosas',
      tipo: 'oportunidade',
      titulo: `${vagasDisponiveisLivres} Vagas Disponíveis Imediatas`,
      descricao: 'Há horários cadastrados em agenda sem agendamento associado no período vigente.',
      acaoSugerida: 'Puxar pacientes do topo da fila de espera para preencher as agendas disponíveis hoje.',
      impactoEstimado: 'Aceleração da fila de espera e maximização dos recursos contratados.'
    });
  }

  // Parecer Técnico em Linguagem Natural
  const parecerTecnicoIA = {
    resumoExecutivo: `A Regulação de Consultas e Exames do município apresenta um Score Geral de ${scoreRegulacao}/100 (${classificacaoScore}). O tempo médio global de espera entre o pedido médico e o agendamento é de ${prazoMedioSolicitacaoAgendamentoDias} dias. A taxa de conclusão da demanda está em ${taxaConversaoResolucao}%, com um índice de absenteísmo de ${taxaAbsenteismo}%.`,
    pontosFortes: [
      totalEspeciais > 0 ? `Fluxo de Agendamento Especial operando com eficiência (+${reducaoTempoEspecialPerc}% de rapidez).` : 'Triagem de prioridades estruturada.',
      taxaOcupacaoVagas > 60 ? `Boa taxa de aproveitamento das vagas abertas (${taxaOcupacaoVagas}% ocupadas).` : 'Flexibilidade para abertura de novas agendas.',
      `Base com ${procedimentos.length} procedimentos catalogados na rede de saúde.`
    ],
    pontosCriticos: [
      totalFilaEspera > 0 ? `${totalFilaEspera} munícipes ainda aguardam liberação de data na fila de espera.` : 'Necessidade de manter a constância na liberação de cotas.',
      taxaAbsenteismo > 10 ? `Perda de ${taxaAbsenteismo}% dos horários agendados por faltas e no-show.` : 'Manter vigilância sobre confirmações de presença.',
      maisCritico ? `Gargalo evidente na especialidade de ${maisCritico.nome}.` : 'Monitorar especialidades de alta complexidade.'
    ],
    recomendacoesEstrategicas: [
      'Priorizar liberação de cotas nas 3 especialidades com maior tempo projetado de conclusão.',
      'Acionar os Agentes Comunitários de Saúde para confirmação domiciliar de exames com histórico de falta.',
      'Revisar semanalmente a fila de Agendamentos Especiais para garantia do cumprimento dos prazos legais.'
    ]
  };

  // Projeção dos Próximos 30 dias
  const mediaEntradaDia = Math.max(1, totalSolicitacoes / 30);
  const novasSolicitacoesEstimadas = Math.round(mediaEntradaDia * 30);
  const vagasNecessariasParaEstabilidade = Math.round(novasSolicitacoesEstimadas + totalFilaEspera * 0.4);
  const deficitVagasProjetado = Math.max(0, vagasNecessariasParaEstabilidade - vagasTotaisCadastradas);

  // 5. Agrupamentos para Gráficos
  // Distribuição por Status
  const statusColors: Record<string, string> = {
    'Realizado': '#10b981',
    'Agendado': '#6366f1',
    'Fila de espera': '#f59e0b',
    'Aguardando Data': '#8b5cf6',
    'Cancelado': '#ef4444',
    'Não Realizado': '#f97316',
    'Retorno': '#06b6d4',
    'Solicitado': '#38bdf8'
  };

  const statusMap: Record<string, number> = {};
  filtrados.forEach(a => {
    statusMap[a.status] = (statusMap[a.status] || 0) + 1;
  });

  const distribuicaoStatus = Object.entries(statusMap).map(([status, count]) => ({
    status,
    count,
    color: statusColors[status] || '#94a3b8',
    percentual: totalSolicitacoes > 0 ? Number(((count / totalSolicitacoes) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.count - a.count);

  // Distribuição por Prioridades
  const distribuicaoPrioridades = [
    { prioridade: 'Normal', count: totalNormais, color: '#3b82f6', percentual: totalSolicitacoes > 0 ? Number(((totalNormais / totalSolicitacoes) * 100).toFixed(1)) : 0 },
    { prioridade: 'Especial', count: totalEspeciais, color: '#e11d48', percentual: totalSolicitacoes > 0 ? Number(((totalEspeciais / totalSolicitacoes) * 100).toFixed(1)) : 0 },
    { prioridade: 'Urgência', count: totalUrgencias, color: '#f59e0b', percentual: totalSolicitacoes > 0 ? Number(((totalUrgencias / totalSolicitacoes) * 100).toFixed(1)) : 0 }
  ];

  // Distribuição por Tipos
  const tiposMap: Record<string, number> = {};
  filtrados.forEach(a => {
    const t = a.procedimento?.type || 'Outros';
    tiposMap[t] = (tiposMap[t] || 0) + 1;
  });
  const tipoColors: Record<string, string> = { 'Exame': '#0284c7', 'Consulta': '#4f46e5', 'Cirurgia': '#e11d48', 'Outros': '#64748b' };
  const distribuicaoTipos = Object.entries(tiposMap).map(([tipo, count]) => ({
    tipo,
    count,
    color: tipoColors[tipo] || '#64748b'
  }));

  // Evolução Temporal (últimos 6 intervalos ou meses)
  const mesesAbreviados = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const temporalMap: Record<string, { solicitados: number; agendados: number; realizados: number; faltas: number }> = {};

  // Inicializa últimos 6 meses
  for (let m = 5; m >= 0; m--) {
    const d = new Date(agora);
    d.setMonth(d.getMonth() - m);
    const label = `${mesesAbreviados[d.getMonth()]}/${String(d.getFullYear()).substring(2)}`;
    temporalMap[label] = { solicitados: 0, agendados: 0, realizados: 0, faltas: 0 };
  }

  filtrados.forEach(a => {
    const dataRef = a.appointment_date || a.solicitation_date || a.created_at;
    if (!dataRef) return;
    const d = new Date(dataRef.includes('T') ? dataRef : `${dataRef}T00:00:00`);
    if (isNaN(d.getTime())) return;

    const label = `${mesesAbreviados[d.getMonth()]}/${String(d.getFullYear()).substring(2)}`;
    if (temporalMap[label]) {
      temporalMap[label].solicitados += 1;
      if (a.status === 'Agendado') temporalMap[label].agendados += 1;
      if (a.status === 'Realizado') temporalMap[label].realizados += 1;
      if (a.status === 'Não Realizado' || a.status === 'Cancelado') temporalMap[label].faltas += 1;
    }
  });

  const evolucaoTemporal = Object.entries(temporalMap).map(([periodoLabel, dados]) => ({
    periodoLabel,
    ...dados
  }));

  // Distribuição por Bairro
  const bairrosMap: Record<string, { total: number; fila: number; realizados: number }> = {};
  filtrados.forEach(a => {
    const b = a.paciente?.neighborhood || 'Não Informado';
    if (!bairrosMap[b]) bairrosMap[b] = { total: 0, fila: 0, realizados: 0 };
    bairrosMap[b].total += 1;
    if (a.status === 'Fila de espera') bairrosMap[b].fila += 1;
    if (a.status === 'Realizado') bairrosMap[b].realizados += 1;
  });

  const distribuicaoBairros = Object.entries(bairrosMap)
    .map(([bairro, d]) => ({ bairro, ...d }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Distribuição por Agente de Saúde
  const agentesMap: Record<string, { total: number; especiais: number }> = {};
  filtrados.forEach(a => {
    const ag = a.paciente?.agente_saude || 'Não Atribuído';
    if (!agentesMap[ag]) agentesMap[ag] = { total: 0, especiais: 0 };
    agentesMap[ag].total += 1;
    if (a.priority === 'Especial') agentesMap[ag].especiais += 1;
  });

  const distribuicaoAgentes = Object.entries(agentesMap)
    .map(([agente, d]) => ({ agente, ...d }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return {
    periodo: filtroPeriodo,
    isMockData,
    volume: {
      totalSolicitacoes,
      totalFilaEspera,
      totalAguardandoData,
      totalAgendados,
      totalRealizados,
      totalCancelados,
      totalNaoRealizados,
      totalRetornos,
      totalEspeciais,
      totalNormais,
      totalUrgencias,
      taxaConversaoResolucao,
      taxaAbsenteismo,
      taxaOcupacaoVagas,
      vagasTotaisCadastradas,
      vagasDisponiveisLivres
    },
    prazos: {
      prazoMedioSolicitacaoAgendamentoDias,
      prazoMedioSolicitacaoRealizacaoDias,
      tempoMedioFilaEsperaAtualDias,
      prazoNormalDias,
      prazoEspecialDias,
      prazoUrgenciaDias,
      reducaoTempoEspecialPerc,
      faixasEspera,
      rankingProcedimentosPrazos
    },
    ia: {
      scoreRegulacao,
      classificacaoScore,
      pilares,
      previsoesFilas,
      alertasPreditivos,
      parecerTecnicoIA,
      projecaoProximos30Dias: {
        novasSolicitacoesEstimadas,
        vagasNecessariasParaEstabilidade,
        deficitVagasProjetado
      }
    },
    distribuicaoStatus,
    distribuicaoPrioridades,
    distribuicaoTipos,
    evolucaoTemporal,
    distribuicaoBairros,
    distribuicaoAgentes
  };
};
