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
  destinos: GrupoDestinoHierarquico[];
}

/**
 * Agrupa demandas na hierarquia estrita: DATA -> MUNICÍPIO DE DESTINO -> PACIENTES
 */
export const agruparHierarquicoDataDestino = (demandas: TransporteDemanda[]): GrupoDataHierarquico[] => {
  const mapData = new Map<string, Map<string, TransporteDemanda[]>>();

  demandas.forEach(d => {
    const dataKey = d.dataAtendimento || new Date().toISOString().substring(0, 10);
    const destKey = d.municipioDestino?.trim() || 'DESTINO NÃO INFORMADO';

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
    let totalPacientesData = 0;

    // Converte YYYY-MM-DD em partes numéricas para evitar problemas de timezone
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const dateObj = new Date(ano, (mes || 1) - 1, dia || 1);
    const diaSemana = diasSemana[dateObj.getDay()] || 'Dia';
    const dataFormatada = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
    const dataLabel = `${dataFormatada} — ${diaSemana}`;

    const destinosOrdenados = Array.from(mapDest.keys()).sort();

    destinosOrdenados.forEach(destStr => {
      const paxs = mapDest.get(destStr)!;
      // Ordena os pacientes por horário
      paxs.sort((a, b) => (a.horaAtendimento || '00:00').localeCompare(b.horaAtendimento || '00:00'));

      totalPacientesData += paxs.length;

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
        totalPacientes: paxs.length,
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
      totalPacientes: totalPacientesData,
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
    totalPacientes: totalDemandas,
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
