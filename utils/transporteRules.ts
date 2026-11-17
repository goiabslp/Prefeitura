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

/**
 * Retorna a string ISO (YYYY-MM-DDTHH:mm:ss) da data e horário atuais
 * no fuso horário oficial de Brasília (America/Sao_Paulo).
 */
export const getAgoraBrasilISO = (customDate?: Date): string => {
  const d = customDate || new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  // Em algumas versões do Node/Chromium, meia-noite pode retornar 24:xx:xx
  const formatted = formatter.format(d).replace(', ', 'T').replace('T24:', 'T00:');
  return formatted;
};

/**
 * Retorna apenas a data atual (YYYY-MM-DD) no fuso horário America/Sao_Paulo
 */
export const getHojeBrasilDateStr = (customDate?: Date): string => {
  return getAgoraBrasilISO(customDate).split('T')[0];
};

/**
 * Normaliza uma data/hora ISO de saída (ex.: "2026-11-20T08:00" ou "2026-11-20T08:00:00Z")
 * para comparação cronológica direta "YYYY-MM-DDTHH:mm:ss" em horário local de Brasília.
 */
const normalizarSaidaISO = (raw?: string): string => {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  // Remove sufixo de timezone/milissegundos se houver para preservar a hora cadastrada
  const base = trimmed.replace(/\.\d+Z?$/, '').replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(base)) {
    return `${base}:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(base)) {
    return base;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(base)) {
    return `${base}T00:00:00`;
  }
  return base;
};

export interface VeiculoElegivelFiltroParams {
  dataAlvo: string;
  destAlvo?: string;
  schedules: VehicleSchedule[];
  vehicles: Vehicle[];
  persons?: Person[];
  agoraBrasilISO?: string;
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
  isDataPassada: boolean;
}

/**
 * Filtra e organiza os veículos elegíveis para a Central de Transporte de Pacientes:
 * 1. LARANJA: Viagens futuras já cadastradas no Histórico, que AINDA NÃO COMEÇARAM
 *    (saída > agora em America/Sao_Paulo), com destino compatível e vagas disponíveis (vagasLivres > 0).
 * 2. VERDE: Veículos operacionais da frota disponíveis na data (data >= hoje em America/Sao_Paulo),
 *    sem destino definido e sem conflito de agendamento.
 * Viagens passadas, já iniciadas, concluídas, canceladas, lotadas ou de outros destinos são rigorosamente ocultadas.
 */
export const filtrarVeiculosElegiveisTransporte = (params: VeiculoElegivelFiltroParams): VeiculoElegivelResultado => {
  const { dataAlvo, destAlvo, schedules = [], vehicles = [], persons = [], agoraBrasilISO } = params;

  if (!dataAlvo) {
    return {
      veiculosLaranja: [],
      veiculosVerdes: [],
      veiculosElegiveis: [],
      vagasDisponiveis: 0,
      veiculosDisponiveis: 0,
      isDataPassada: false
    };
  }

  const agoraISO = agoraBrasilISO || getAgoraBrasilISO();
  const hojeBrasil = agoraISO.split('T')[0];

  // REGRA 5: Se a data selecionada estiver no passado, NÃO apresentar viagens nem veículos livres!
  if (dataAlvo < hojeBrasil) {
    return {
      veiculosLaranja: [],
      veiculosVerdes: [],
      veiculosElegiveis: [],
      vagasDisponiveis: 0,
      veiculosDisponiveis: 0,
      isDataPassada: true
    };
  }

  const normDestAlvo = destAlvo && destAlvo !== 'TODOS' && destAlvo !== 'Destino não informado'
    ? normalizeCityTransporte(destAlvo)
    : '';

  // Status válidos para viagens ainda não iniciadas
  const statusViagemPermitidos = new Set(['confirmado', 'pendente', 'agendado']);

  // =========================================================================
  // 1. VEÍCULOS LARANJA: VIAGEM FUTURA EXISTENTE PARA O DESTINO SELECIONADO COM VAGAS
  // =========================================================================
  const veiculosLaranja: VeiculoLaranjaItem[] = [];

  if (normDestAlvo) {
    schedules.forEach(sch => {
      const stSch = (sch.status || '').toLowerCase().trim();
      // REGRA 2: Ocultar viagens canceladas, iniciadas/em_curso e concluídas
      if (!statusViagemPermitidos.has(stSch)) return;

      const saidaISO = normalizarSaidaISO(sch.departureDateTime);
      if (!saidaISO) return;

      const depDate = saidaISO.split('T')[0];
      if (depDate !== dataAlvo) return;

      // REGRA 1 & 2 (ABSOLUTA): Data e horário completos de saída devem ser estritamente maiores que AGORA (America/Sao_Paulo)
      if (saidaISO <= agoraISO) return;

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

      // REGRA 3: Calcular ocupantes reais sem duplicar a mesma pessoa
      const ocupantesSet = new Set<string>();
      (sch.passengers || []).forEach((p: any, idx: number) => {
        if (!p) return;
        const tipoPax = (p.type || 'paciente').toLowerCase();
        if (tipoPax === 'acompanhante') {
          ocupantesSet.add(p.id || `acomp_${p.name || idx}_${idx}`);
        } else {
          const cleanCpf = (p.cpf || '').replace(/\D/g, '');
          const chave = p.patientId
            ? `pac_${p.patientId}`
            : (cleanCpf.length >= 11 ? `cpf_${cleanCpf}` : `nome_${(p.name || String(idx)).trim().toLowerCase()}`);
          ocupantesSet.add(chave);
        }
      });

      const ocupados = ocupantesSet.size;
      const vagasLivres = Math.max(0, capPassageiros - ocupados);

      // REGRA 2 & 3 (OBRIGATÓRIA): Se vagas livres <= 0 (lotação completa), ocultar imediatamente!
      if (vagasLivres <= 0) return;

      const mot = persons.find(p => p.id === sch.driverId);

      // Extrair horário HH:mm diretamente do texto ISO normalizado para evitar deslocamento de fuso
      const horaSaidaStr = saidaISO.includes('T') ? saidaISO.split('T')[1].substring(0, 5) : '07:00';
      const retornoISO = normalizarSaidaISO(sch.returnDateTime);
      const horaRetornoStr = retornoISO && retornoISO.includes('T') ? retornoISO.split('T')[1].substring(0, 5) : undefined;

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
        horarioSaida: horaSaidaStr,
        horarioRetorno: horaRetornoStr,
        destino: sch.destination || 'Destino não informado',
        statusViagem: sch.status
      });
    });

    // Ordenar Laranjas por horário de saída
    veiculosLaranja.sort((a, b) => (a.schedule.departureDateTime || '').localeCompare(b.schedule.departureDateTime || ''));
  }

  // =========================================================================
  // 2. VEÍCULOS VERDES: VEÍCULOS DISPONÍVEIS NA DATA SEM DESTINO DEFINIDO E SEM CONFLITO
  // =========================================================================
  const veiculosComConflitoNaData = new Set<string>();
  schedules.forEach(sch => {
    const stSch = (sch.status || '').toLowerCase().trim();
    if (stSch === 'cancelado') return;

    const depISO = normalizarSaidaISO(sch.departureDateTime);
    if (!depISO) return;
    const depDate = depISO.split('T')[0];

    const retISO = normalizarSaidaISO(sch.returnDateTime);
    const retDate = retISO ? retISO.split('T')[0] : depDate;

    // Verifica se a viagem ocorre na dataAlvo ou atravessa a dataAlvo (viagem multidia)
    if (sch.vehicleId && depDate <= dataAlvo && retDate >= dataAlvo) {
      veiculosComConflitoNaData.add(sch.vehicleId);
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

    // Veículo não pode ter nenhuma viagem cadastrada na data (sem conflito de agenda ou outro destino)
    if (veiculosComConflitoNaData.has(veic.id)) return;

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

  // Ordem estrita: 1º Laranjas (viagens futuras no destino) -> 2º Verdes (livres sem destino)
  const veiculosElegiveis: VeiculoElegivelItem[] = [...veiculosLaranja, ...veiculosVerdes];

  // Indicadores:
  // VAGAS DISPONÍVEIS: soma exclusivamente vagas das viagens futuras compatíveis (Laranja)
  const vagasDisponiveis = veiculosLaranja.reduce((acc, curr) => acc + curr.vagasLivres, 0);

  // VEÍCULOS DISPONÍVEIS: total de veículos elegíveis (Laranjas com vagas + Verdes livres)
  const veiculosDisponiveis = veiculosElegiveis.length;

  return {
    veiculosLaranja,
    veiculosVerdes,
    veiculosElegiveis,
    vagasDisponiveis,
    veiculosDisponiveis,
    isDataPassada: false
  };
};
