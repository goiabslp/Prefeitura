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

  return {
    totalDemandas,
    aguardandoVaga,
    alocados,
    confirmados,
    aguardandoConfirmacao,
    vagasDisponiveis: totalVagasLivres,
    veiculosDesignados
  };
};
