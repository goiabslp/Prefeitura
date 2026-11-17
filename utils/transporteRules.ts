// =========================================================================
// REGRAS DE NEGÓCIO E ALGORITMOS — CENTRAL DE TRANSPORTE DE PACIENTES
// =========================================================================

import type { 
  TransporteDemanda, 
  VehicleSchedule, 
  Vehicle 
} from '../types';

/**
 * Normaliza strings de cidades e destinos
 */
export const normalizeCityTransporte = (city?: string | null): string => {
  if (!city) return '';
  return city
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-\s*[A-Z]{2}$/g, '') // remove sufixo " - MG", etc.
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
};

/**
 * Normaliza strings de texto livre (nomes, procedimentos)
 */
export const normalizeTransporteText = (str?: string | null): string => {
  if (!str) return '';
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

/**
 * Agrupa demandas de forma inteligente por Data e Destino
 */
export const agruparDemandasInteligentes = (demandas: TransporteDemanda[]) => {
  const grupos = new Map<string, {
    key: string;
    data: string;
    destino: string;
    demandas: TransporteDemanda[];
    totalPacientes: number;
    totalAcompanhantes: number;
    totalAssentosNecessarios: number;
    necessitaAdaptado: boolean;
  }>();

  demandas.forEach(d => {
    const normCity = normalizeCityTransporte(d.municipioDestino) || 'DESTINO INDEFINIDO';
    const groupKey = `${d.dataAtendimento}__${normCity}`;

    let grupo = grupos.get(groupKey);
    if (!grupo) {
      grupo = {
        key: groupKey,
        data: d.dataAtendimento,
        destino: d.municipioDestino,
        demandas: [],
        totalPacientes: 0,
        totalAcompanhantes: 0,
        totalAssentosNecessarios: 0,
        necessitaAdaptado: false
      };
      grupos.set(groupKey, grupo);
    }

    grupo.demandas.push(d);
    grupo.totalPacientes += 1;
    grupo.totalAcompanhantes += (d.qtdAcompanhantes || 0);
    grupo.totalAssentosNecessarios += (1 + (d.qtdAcompanhantes || 0));
    if (d.necessitaVeiculoAdaptado) {
      grupo.necessitaAdaptado = true;
    }
  });

  return Array.from(grupos.values()).sort((a, b) => a.data.localeCompare(b.data));
};

/**
 * Validação de capacidade da viagem:
 * Considera capacidade máxima do veículo menos 1 assento reservado ao motorista oficial.
 */
export const validarCapacidadeViagem = (
  veiculo: Vehicle,
  viagem: VehicleSchedule,
  qtdPassageirosNovos: number
): { permitido: boolean; vagasRestantes: number; message?: string } => {
  const capacidadePassageiros = Math.max(1, (veiculo.passengerCapacity || (veiculo as any).capacity || 5) - 1);
  const ocupados = (viagem.passengers || []).length;
  const vagasRestantes = Math.max(0, capacidadePassageiros - ocupados);

  if (qtdPassageirosNovos > vagasRestantes) {
    return {
      permitido: false,
      vagasRestantes,
      message: `Capacidade insuficiente. A viagem possui ${vagasRestantes} vaga(s) livre(s), mas são solicitados ${qtdPassageirosNovos} assento(s).`
    };
  }

  return {
    permitido: true,
    vagasRestantes: vagasRestantes - qtdPassageirosNovos
  };
};

export interface GrupoDestinoHierarquico {
  destino: string;
  totalPacientes: number;
  totalAgendamentos?: number;
  aguardando: number;
  alocados: number;
  confirmados: number;
  resumoProcedimentos: string;
  horarioMin: string;
  horarioMax: string;
  demandas: TransporteDemanda[];
}

export interface GrupoDataHierarquico {
  data: string;
  dataFormatada: string;
  diaSemana: string;
  dataLabel: string;
  totalPacientes: number;
  totalAgendamentos?: number;
  destinos: GrupoDestinoHierarquico[];
}

/**
 * Agrupa demandas na hierarquia estrita: DATA DO AGENDAMENTO -> MUNICÍPIO DE DESTINO -> PACIENTES
 * Utiliza EXCLUSIVAMENTE a data do agendamento (appointment_date), descartando dados de solicitação.
 */
export const agruparHierarquicoDataDestino = (demandas: TransporteDemanda[]): GrupoDataHierarquico[] => {
  const mapData = new Map<string, Map<string, TransporteDemanda[]>>();

  demandas.forEach(d => {
    // Normalização estrita da data do agendamento (YYYY-MM-DD)
    const rawData = (d.dataAtendimento || '').trim();
    const dataKey = rawData.includes('T') ? rawData.split('T')[0].trim() : rawData;
    if (!dataKey || !/^\d{4}-\d{2}-\d{2}$/.test(dataKey)) {
      return;
    }

    // Destino: se não informado, padroniza como "Destino não informado" sem inventar cidades
    const rawDest = (d.municipioDestino || '').trim();
    const destKey = rawDest && rawDest.toUpperCase() !== 'DESTINO NÃO INFORMADO' ? rawDest : 'Destino não informado';

    if (!mapData.has(dataKey)) {
      mapData.set(dataKey, new Map());
    }
    const mapDest = mapData.get(dataKey)!;
    if (!mapDest.has(destKey)) {
      mapDest.set(destKey, []);
    }
    mapDest.get(destKey)!.push(d);
  });

  const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  const resultado: GrupoDataHierarquico[] = [];

  const datasOrdenadas = Array.from(mapData.keys()).sort();

  datasOrdenadas.forEach(dataStr => {
    const mapDest = mapData.get(dataStr)!;
    const destinosList: GrupoDestinoHierarquico[] = [];
    const pacientesUnicosData = new Set<string>();
    let totalAgendamentosData = 0;

    // Converte YYYY-MM-DD em partes numéricas para evitar problemas de timezone
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const dateObj = new Date(ano, (mes || 1) - 1, dia || 1);
    const diaSemana = diasSemana[dateObj.getDay()] || 'Dia';
    const dataFormatada = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
    const dataLabel = `${dataFormatada} — ${diaSemana}`;

    const destinosOrdenados = Array.from(mapDest.keys()).sort();

    destinosOrdenados.forEach(destStr => {
      const paxs = mapDest.get(destStr)!;
      // Ordena os pacientes por horário do agendamento
      paxs.sort((a, b) => (a.horaAtendimento || '00:00').localeCompare(b.horaAtendimento || '00:00'));

      paxs.forEach(p => {
        pacientesUnicosData.add(p.pacienteId || p.pacienteCpf || p.pacienteNome || p.id);
      });
      totalAgendamentosData += paxs.length;

      // Pacientes únicos para não duplicar contagem no mesmo destino
      const pacientesUnicosDestino = new Set(paxs.map(p => p.pacienteId || p.pacienteCpf || p.pacienteNome || p.id));

      const aguardando = paxs.filter(p => p.statusTransporte === 'Aguardando vaga').length;
      const alocados = paxs.filter(p => p.statusTransporte === 'Alocado').length;
      const confirmados = paxs.filter(p => p.statusTransporte === 'Confirmado').length;

      // Resumo de procedimentos
      const tipos = new Set<string>();
      paxs.forEach(p => {
        if (p.tipoProcedimento) tipos.add(p.tipoProcedimento);
      });
      const tiposArr = Array.from(tipos);
      const resumoProcedimentos = tiposArr.length > 0 ? tiposArr.join(' e ') : 'Consultas e Exames';

      // Horários mínimo e máximo
      const horarios = paxs.map(p => p.horaAtendimento).filter(Boolean);
      const horarioMin = horarios.length > 0 ? (horarios[0].substring(0, 2) + 'h') : '07h';
      const horarioMax = horarios.length > 0 ? (horarios[horarios.length - 1].substring(0, 2) + 'h') : '17h';

      destinosList.push({
        destino: destStr,
        totalPacientes: pacientesUnicosDestino.size,
        totalAgendamentos: paxs.length,
        aguardando,
        alocados,
        confirmados,
        resumoProcedimentos,
        horarioMin,
        horarioMax,
        demandas: paxs
      });
    });

    resultado.push({
      data: dataStr,
      dataFormatada,
      diaSemana,
      dataLabel,
      totalPacientes: pacientesUnicosData.size,
      totalAgendamentos: totalAgendamentosData,
      destinos: destinosList
    });
  });

  return resultado;
};

/**
 * Calcula os 7 indicadores do Dashboard da Central de Transporte
 */
export const calcularIndicadoresTransporte = (
  demandas: TransporteDemanda[],
  veiculos: Vehicle[] = [],
  viagens: VehicleSchedule[] = [],
  dataSelecionada?: string
) => {
  const escopoDemandas = dataSelecionada 
    ? demandas.filter(d => d.dataAtendimento === dataSelecionada)
    : demandas;

  const totalDemandas = escopoDemandas.length;
  const pacientesUnicos = new Set(escopoDemandas.map(d => d.pacienteId || d.pacienteCpf || d.pacienteNome || d.id)).size;
  const aguardandoVaga = escopoDemandas.filter(d => d.statusTransporte === 'Aguardando vaga').length;
  const alocados = escopoDemandas.filter(d => d.statusTransporte === 'Alocado').length;
  const confirmados = escopoDemandas.filter(d => d.statusTransporte === 'Confirmado').length;
  const aguardandoConfirmacao = escopoDemandas.filter(d => d.statusTransporte === 'Aguardando confirmação').length;

  const escopoViagens = dataSelecionada
    ? viagens.filter(v => v.departureDateTime.startsWith(dataSelecionada) && v.status !== 'cancelado')
    : viagens.filter(v => v.status !== 'cancelado');

  const veiculosDesignadosIds = new Set(escopoViagens.map(v => v.vehicleId));
  const veiculosDesignados = veiculosDesignadosIds.size;

  let totalVagasLivres = 0;
  escopoViagens.forEach(v => {
    const veic = veiculos.find(x => x.id === v.vehicleId);
    const capMax = Math.max(1, (veic?.passengerCapacity || (veic as any)?.capacity || 5) - 1);
    const ocupados = (v.passengers || []).length;
    const livres = Math.max(0, capMax - ocupados);
    totalVagasLivres += livres;
  });

  const veiculosDisponiveis = veiculos.filter(v => (v.status || 'Ativo') === 'Ativo').length || veiculos.length || veiculosDesignados;

  return {
    totalDemandas,
    totalPacientes: pacientesUnicos,
    aguardandoVaga,
    aguardando: aguardandoVaga,
    alocados,
    confirmados,
    aguardandoConfirmacao,
    vagasDisponiveis: totalVagasLivres,
    veiculosDesignados,
    veiculosDisponiveis
  };
};

export interface VeiculoElegivelFiltroParams {
  dataAlvo: string;
  destAlvo?: string;
  schedules: VehicleSchedule[];
  vehicles: Vehicle[];
  persons?: Person[];
}

export interface VeiculoLaranjaItem {
  id: string;
  tipo: 'laranja';
  schedule: VehicleSchedule;
  vehicle: Vehicle;
  driver?: Person;
  vagasLivres: number;
  capacidadePassageiros: number;
  ocupados: number;
  horarioSaida: string;
  horarioRetorno?: string;
  destino: string;
  statusViagem?: string;
}

export interface VeiculoVerdeItem {
  id: string;
  tipo: 'verde';
  vehicle: Vehicle;
  driver?: Person;
  vagasLivres: number;
  capacidadePassageiros: number;
  ocupados: number;
  destino: string;
  statusViagem: string;
}

export type VeiculoElegivelItem = VeiculoLaranjaItem | VeiculoVerdeItem;

export interface VeiculoElegivelResultado {
  veiculosLaranja: VeiculoLaranjaItem[];
  veiculosVerdes: VeiculoVerdeItem[];
  veiculosElegiveis: VeiculoElegivelItem[];
  vagasDisponiveis: number;
  veiculosDisponiveis: number;
}

/**
 * Filtra e organiza os veículos elegíveis para a Central de Transporte de Pacientes:
 * 1. LARANJA: Veículos já escalados para o destino e data selecionados, com vagas disponíveis (vagasLivres > 0).
 * 2. VERDE: Veículos operacionais da frota disponíveis na data, sem destino definido e sem conflito de agendamento.
 * Veículos lotados, indisponíveis ou escalados para outros destinos são rigorosamente ocultados.
 */
export const filtrarVeiculosElegiveisTransporte = (params: VeiculoElegivelFiltroParams): VeiculoElegivelResultado => {
  const { dataAlvo, destAlvo, schedules = [], vehicles = [], persons = [] } = params;

  if (!dataAlvo) {
    return {
      veiculosLaranja: [],
      veiculosVerdes: [],
      veiculosElegiveis: [],
      vagasDisponiveis: 0,
      veiculosDisponiveis: 0
    };
  }

  const normDestAlvo = destAlvo && destAlvo !== 'TODOS' && destAlvo !== 'Destino não informado'
    ? normalizeCityTransporte(destAlvo)
    : '';

  // =========================================================================
  // 1. VEÍCULOS LARANJA: VIAGEM EXISTENTE PARA O DESTINO SELECIONADO COM VAGAS
  // Regra obrigatória: Só é LARANJA se houver um destino específico definido E
  // a viagem for para este mesmo município. É PROIBIDO misturar destinos diferentes!
  // Se o destino for indefinido ou 'Destino não informado', nenhuma viagem pode ser laranja.
  // =========================================================================
  const veiculosLaranja: VeiculoLaranjaItem[] = [];

  if (normDestAlvo) {
    schedules.forEach(sch => {
      if (sch.status === 'cancelado') return;

      const depDate = (sch.departureDateTime || '').split('T')[0];
      if (depDate !== dataAlvo) return;

      // Destino: compatibilidade estrita obrigatória
      const normDestSch = normalizeCityTransporte(sch.destination || '');
      const match = normDestSch.includes(normDestAlvo) || normDestAlvo.includes(normDestSch);
      if (!match) return; // PROIBIDO misturar veículos de destinos diferentes!

      const veic = vehicles.find(v => v.id === sch.vehicleId);
      const stVeic = (veic?.status || '').toLowerCase();
      if (stVeic === 'manutencao' || stVeic === 'inativo' || stVeic === 'baixado') return;
      if (veic?.maintenanceStatus === 'Em Manutenção') return;

      const capTotal = veic?.passengerCapacity || (veic as any)?.capacity || 5;
      const capPassageiros = Math.max(1, capTotal - 1);
      const passageiros = sch.passengers || [];
      const ocupados = passageiros.length;
      const vagasLivres = Math.max(0, capPassageiros - ocupados);

      // REGRA OBRIGATÓRIA: Veículos com lotação completa (0 vagas) DEVEM SER OCULTADOS!
      if (vagasLivres <= 0) return;

      const mot = persons.find(p => p.id === sch.driverId);

      veiculosLaranja.push({
        id: sch.id,
        tipo: 'laranja',
        schedule: sch,
        vehicle: (veic || {
          id: sch.vehicleId,
          plate: (sch as any).vehiclePlate || 'Sem placa',
          brand: 'Veículo',
          model: (sch as any).vehicleModel || 'Municipal',
          passengerCapacity: capTotal,
          capacity: capTotal,
          status: 'operacional'
        }) as Vehicle,
        driver: mot || ({
          id: sch.driverId,
          name: (sch as any).driverName || 'Motorista Oficial'
        } as Person),
        vagasLivres,
        capacidadePassageiros: capPassageiros,
        ocupados,
        horarioSaida: sch.departureDateTime ? new Date(sch.departureDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '07:00',
        horarioRetorno: sch.returnDateTime ? new Date(sch.returnDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : undefined,
        destino: sch.destination || 'Destino não informado',
        statusViagem: sch.status
      });
    });

    // Ordenar Laranjas por horário de saída
    veiculosLaranja.sort((a, b) => (a.schedule.departureDateTime || '').localeCompare(b.schedule.departureDateTime || ''));
  }

  // =========================================================================
  // 2. VEÍCULOS VERDES: VEÍCULOS DISPONÍVEIS NA DATA SEM DESTINO DEFINIDO
  // =========================================================================
  const veiculosComViagemNaData = new Set<string>();
  schedules.forEach(sch => {
    if (sch.status === 'cancelado') return;
    const depDate = (sch.departureDateTime || '').split('T')[0];
    if (depDate === dataAlvo && sch.vehicleId) {
      veiculosComViagemNaData.add(sch.vehicleId);
    }
  });

  const veiculosVerdes: VeiculoVerdeItem[] = [];

  vehicles.forEach(veic => {
    const st = (veic.status || '').toLowerCase();
    if (st === 'manutencao' || st === 'inativo' || st === 'baixado') return;
    if (veic.maintenanceStatus === 'Em Manutenção') return;
    if (veic.availableForScheduling === 'Não') return;
    const cat = (veic.vehicleCategory || veic.type || '').toLowerCase();
    if (cat === 'moto' || cat === 'máquina pesada' || cat === 'caminhão' || cat === 'acessórios') return;

    // Veículo não pode ter nenhuma viagem cadastrada na data (sem conflito de agenda)
    if (veiculosComViagemNaData.has(veic.id)) return;

    const capTotal = veic.passengerCapacity || (veic as any)?.capacity || 5;
    const capPassageiros = Math.max(1, capTotal - 1);
    if (capPassageiros <= 0) return;

    const mot = veic.responsiblePersonId ? persons.find(p => p.id === veic.responsiblePersonId) : undefined;

    veiculosVerdes.push({
      id: `verde_${veic.id}`,
      tipo: 'verde',
      vehicle: veic,
      driver: mot,
      vagasLivres: capPassageiros,
      capacidadePassageiros: capPassageiros,
      ocupados: 0,
      destino: 'Sem destino definido',
      statusViagem: 'Disponível'
    });
  });

  // Ordenar Verdes por maior capacidade de passageiros
  veiculosVerdes.sort((a, b) => b.capacidadePassageiros - a.capacidadePassageiros);

  // Ordem estrita: 1º Laranjas (viagens no destino) -> 2º Verdes (livres sem destino)
  const veiculosElegiveis: VeiculoElegivelItem[] = [...veiculosLaranja, ...veiculosVerdes];

  // REGRA 8: Indicadores
  // VAGAS DISPONÍVEIS: somar exclusivamente vagas de viagens programadas para o destino e data selecionados (Veículos Laranja)
  const vagasDisponiveis = veiculosLaranja.reduce((acc, curr) => acc + curr.vagasLivres, 0);

  // VEÍCULOS DISPONÍVEIS: total de veículos elegíveis (Laranjas com vagas + Verdes disponíveis)
  const veiculosDisponiveis = veiculosElegiveis.length;

  return {
    veiculosLaranja,
    veiculosVerdes,
    veiculosElegiveis,
    vagasDisponiveis,
    veiculosDisponiveis
  };
};
