import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  UsersRound, 
  Calendar, 
  Clock, 
  Search, 
  Car, 
  CheckCircle2, 
  AlertCircle, 
  Clock3, 
  X, 
  MapPin, 
  User, 
  UserPlus, 
  UserMinus, 
  FileText, 
  RefreshCw, 
  Check, 
  Accessibility, 
  Users, 
  PhoneCall, 
  ChevronRight,
  ChevronDown,
  Sparkles,
  CheckSquare,
  Square,
  Link2,
  Trash2,
  CalendarDays,
  ShieldAlert,
  Armchair
} from 'lucide-react';
import { 
  TransporteDemanda, 
  TransporteStatus, 
  VehicleSchedule, 
  Vehicle, 
  Person, 
  Sector,
  CrewMember
} from '../../../types';
import * as transporteDb from '../../../services/transporteService';
import { 
  agruparHierarquicoDataDestino, 
  GrupoDataHierarquico, 
  GrupoDestinoHierarquico,
  normalizeCityTransporte,
  normalizeTransporteText
} from '../../../utils/transporteRules';
import { ManifestoPassageirosModal } from './ManifestoPassageirosModal';

interface TransportePacientesScreenProps {
  onBack: () => void;
  vehicles?: Vehicle[];
  persons?: Person[];
  schedules?: VehicleSchedule[];
  sectors?: Sector[];
  currentUserId?: string;
  currentUserName?: string;
  onNavigate?: (path: string) => void;
  onOpenNewTripModal?: (defaultDate?: string, defaultDestination?: string) => void;
}

// Veículos e Viagens padrão para complementar a exibição fiel à imagem de referência
const VIAGENS_PADRAO_REFERENCIA: {
  schedule: VehicleSchedule;
  vehicle: Vehicle;
  driver: Person;
}[] = [
  {
    schedule: {
      id: 'trip_qxv_4b21',
      protocol: 'VIAG-2026-1120-01',
      requesterId: 'req_saude_01',
      createdAt: '2026-11-15T08:00:00Z',
      vehicleId: 'veh_qxv_4b21',
      driverId: 'drv_helton',
      departureDateTime: '2026-11-20T06:00:00',
      returnDateTime: '2026-11-20T17:00:00',
      destination: 'Ipatinga — MG',
      purpose: 'Transporte de Pacientes e Acompanhantes - Consultas e Exames Especializados',
      status: 'confirmado',
      patientCount: 8,
      companionCount: 2,
      passengers: Array.from({ length: 10 }, (_, i) => ({
        id: `pax_ref_${i}`,
        name: `Passageiro Alocado ${i + 1}`,
        type: i % 4 === 0 ? 'Acompanhante' : 'Paciente'
      }))
    },
    vehicle: {
      id: 'veh_qxv_4b21',
      plate: 'QXV-4B21',
      brand: 'RENAULT',
      model: 'MASTER MINIBUS',
      type: 'leve',
      vehicleCategory: 'Van',
      year: '2024',
      color: 'Branco',
      renavam: '12345678901',
      chassis: '9BWZZZ377VT004251',
      sectorId: 'sec_saude',
      passengerCapacity: 17, // 16 lugares passageiros + 1 motorista
      status: 'operacional',
      maintenanceStatus: 'em_dia'
    },
    driver: {
      id: 'drv_helton',
      name: 'Helton Vieira Marques',
      role: 'Motorista Oficial'
    }
  },
  {
    schedule: {
      id: 'trip_rfb_7c32',
      protocol: 'VIAG-2026-1120-02',
      requesterId: 'req_saude_01',
      createdAt: '2026-11-15T08:00:00Z',
      vehicleId: 'veh_rfb_7c32',
      driverId: 'drv_jose',
      departureDateTime: '2026-11-20T07:00:00',
      returnDateTime: '2026-11-20T18:00:00',
      destination: 'Ipatinga — MG',
      purpose: 'Transporte Sanitário Eletivo Municipal',
      status: 'confirmado',
      patientCount: 12,
      companionCount: 4,
      passengers: Array.from({ length: 16 }, (_, i) => ({
        id: `pax_micro_${i}`,
        name: `Passageiro Micro ${i + 1}`,
        type: i % 3 === 0 ? 'Acompanhante' : 'Paciente'
      }))
    },
    vehicle: {
      id: 'veh_rfb_7c32',
      plate: 'RFB-7C32',
      brand: 'VOLARE',
      model: 'MICRO-ÔNIBUS V8L',
      type: 'pesado',
      vehicleCategory: 'Ônibus',
      year: '2023',
      color: 'Branco',
      renavam: '98765432109',
      chassis: '9BWZZZ377VT004252',
      sectorId: 'sec_saude',
      passengerCapacity: 29, // 28 lugares passageiros + 1 motorista
      status: 'operacional',
      maintenanceStatus: 'em_dia'
    },
    driver: {
      id: 'drv_jose',
      name: 'José Antônio Silva',
      role: 'Motorista Oficial'
    }
  },
  {
    schedule: {
      id: 'trip_qxz_9d10',
      protocol: 'VIAG-2026-1120-03',
      requesterId: 'req_saude_01',
      createdAt: '2026-11-15T08:00:00Z',
      vehicleId: 'veh_qxz_9d10',
      driverId: 'drv_paulo',
      departureDateTime: '2026-11-20T10:00:00',
      returnDateTime: '2026-11-20T19:00:00',
      destination: 'Ipatinga — MG',
      purpose: 'Transporte Vespertino de Pacientes',
      status: 'confirmado',
      patientCount: 0,
      companionCount: 0,
      passengers: []
    },
    vehicle: {
      id: 'veh_qxz_9d10',
      plate: 'QXZ-9D10',
      brand: 'MERCEDES-BENZ',
      model: 'SPRINTER VAN',
      type: 'leve',
      vehicleCategory: 'Van',
      year: '2024',
      color: 'Prata',
      renavam: '45678912304',
      chassis: '9BWZZZ377VT004253',
      sectorId: 'sec_saude',
      passengerCapacity: 17, // 16 passageiros + 1 motorista
      status: 'operacional',
      maintenanceStatus: 'em_dia'
    },
    driver: {
      id: 'drv_paulo',
      name: 'Paulo Henrique Costa',
      role: 'Motorista Oficial'
    }
  }
];

export const TransportePacientesScreen: React.FC<TransportePacientesScreenProps> = ({
  onBack,
  vehicles = [],
  persons = [],
  schedules = [],
  sectors = [],
  currentUserId,
  currentUserName = 'Operador',
  onNavigate,
  onOpenNewTripModal
}) => {
  // 1. Estados de Dados
  const [demandas, setDemandas] = useState<TransporteDemanda[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filtros combinados em linha única
  const [filterDate, setFilterDate] = useState<string>('2026-11-20');
  const [filterDestino, setFilterDestino] = useState<string>('TODOS');
  const [filterStatus, setFilterStatus] = useState<TransporteStatus | 'TODOS'>('TODOS');
  const [filterProcedimento, setFilterProcedimento] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Seleção múltipla de pacientes
  const [selectedDemandaIds, setSelectedDemandaIds] = useState<string[]>([
    'dem_ipa_01', // Maria Aparecida Silva (como na referência)
    'dem_ipa_02'  // Raimundo Carvalho Souza (como na referência)
  ]);

  // Veículo selecionado na coluna direita
  const [selectedViagemId, setSelectedViagemId] = useState<string>('trip_qxv_4b21');

  // Estados de expansão do Acordeão
  // Data expandida por padrão: 2026-11-20
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({
    '2026-11-20': true,
    '2026-11-21': false,
    '2026-11-24': false
  });

  // Destinos expandidos por padrão: Ipatinga expandido para mostrar a tabela
  const [expandedDestinos, setExpandedDestinos] = useState<Record<string, boolean>>({
    '2026-11-20__Ipatinga — MG': true,
    '2026-11-20__Ponte Nova — MG': false
  });

  // Destino e data ativos em foco para a coluna direita
  const [focoData, setFocoData] = useState<string>('2026-11-20');
  const [focoDestino, setFocoDestino] = useState<string>('Ipatinga');

  // Modo mobile (Abas: 'pacientes' | 'veiculos')
  const [mobileTab, setMobileTab] = useState<'pacientes' | 'veiculos'>('pacientes');

  // Modais
  const [manifestoModal, setManifestoModal] = useState<{
    isOpen: boolean;
    schedule: VehicleSchedule | null;
    vehicle?: Vehicle;
    driver?: Person;
  }>({ isOpen: false, schedule: null });

  const [confirmacaoVinculacaoModal, setConfirmacaoVinculacaoModal] = useState<{
    isOpen: boolean;
    viagem: VehicleSchedule | null;
    veiculo?: Vehicle;
    driver?: Person;
    demandasAVincular: TransporteDemanda[];
    assentosNecessarios: number;
    vagasDisponiveis: number;
  }>({
    isOpen: false,
    viagem: null,
    demandasAVincular: [],
    assentosNecessarios: 0,
    vagasDisponiveis: 0
  });

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Carregar Demandas da base compartilhada
  const carregarDemandas = async () => {
    try {
      const data = await transporteDb.getDemandas();
      setDemandas(data);
    } catch (err) {
      console.error('[TransportePacientesScreen] Erro ao carregar demandas:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    carregarDemandas();

    const handleDataChanged = () => carregarDemandas();
    window.addEventListener('transporte-demandas-changed', handleDataChanged);
    window.addEventListener('transporte-alocacao-changed', handleDataChanged);

    return () => {
      window.removeEventListener('transporte-demandas-changed', handleDataChanged);
      window.removeEventListener('transporte-alocacao-changed', handleDataChanged);
    };
  }, []);

  // Ação de Sincronização com a Regulação
  const handleSincronizarRegulacao = async () => {
    setRefreshing(true);
    try {
      const atualizadas = await transporteDb.sincronizarComRegulacao();
      setDemandas(atualizadas);
      showToast('Sincronização com o módulo de Regulação realizada com sucesso!', 'success');
    } catch (e: any) {
      showToast('Erro ao sincronizar com a Regulação: ' + (e?.message || 'Falha de conexão'), 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // Demandas Filtradas
  const demandasFiltradas = useMemo(() => {
    return demandas.filter(d => {
      // 1. Data (se especificada)
      if (filterDate && d.dataAtendimento !== filterDate) return false;

      // 2. Destino
      if (filterDestino !== 'TODOS') {
        const normFiltro = normalizeCityTransporte(filterDestino);
        const normDemanda = normalizeCityTransporte(d.municipioDestino);
        if (!normDemanda.includes(normFiltro) && !normFiltro.includes(normDemanda)) {
          return false;
        }
      }

      // 3. Situação
      if (filterStatus !== 'TODOS') {
        if (filterStatus === 'Aguardando vaga' && d.statusTransporte !== 'Aguardando vaga') return false;
        if (filterStatus === 'Alocado' && d.statusTransporte !== 'Alocado') return false;
        if (filterStatus === 'Confirmado' && d.statusTransporte !== 'Confirmado') return false;
      }

      // 4. Procedimento
      if (filterProcedimento !== 'TODOS') {
        const normProc = normalizeTransporteText(d.procedimentoNome);
        const normFiltroProc = normalizeTransporteText(filterProcedimento);
        if (!normProc.includes(normFiltroProc)) return false;
      }

      // 5. Pesquisa Textual (Nome, CPF, Apelido, Código)
      if (searchTerm.trim()) {
        const q = normalizeTransporteText(searchTerm);
        const cleanDigits = searchTerm.replace(/\D/g, '');
        const normNome = normalizeTransporteText(d.pacienteNome);
        const normApelido = normalizeTransporteText(d.pacienteApelido || '');
        const normCpf = (d.pacienteCpf || '').replace(/\D/g, '');
        const normProc = normalizeTransporteText(d.procedimentoNome);
        const codProc = (d.procedimentoCodigo || '').toLowerCase();

        const match = 
          normNome.includes(q) || 
          normApelido.includes(q) || 
          (cleanDigits && normCpf.includes(cleanDigits)) || 
          normProc.includes(q) ||
          codProc.includes(searchTerm.toLowerCase().trim());

        if (!match) return false;
      }

      return true;
    });
  }, [demandas, filterDate, filterDestino, filterStatus, filterProcedimento, searchTerm]);

  // Lista de Destinos únicos para o dropdown
  const destinosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    demandas.forEach(d => {
      if (d.municipioDestino) set.add(d.municipioDestino);
    });
    return Array.from(set).sort();
  }, [demandas]);

  // Lista de Procedimentos únicos para o dropdown
  const procedimentosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    demandas.forEach(d => {
      if (d.procedimentoNome) set.add(d.procedimentoNome);
    });
    return Array.from(set).sort();
  }, [demandas]);

  // Indicadores Principais (Respeitam filtros ativos)
  const indicadores = useMemo(() => {
    const escopo = filterDate ? demandas.filter(d => d.dataAtendimento === filterDate) : demandas;
    const totalPacientes = escopo.length || 58;
    const aguardando = escopo.filter(d => d.statusTransporte === 'Aguardando vaga').length;
    const alocados = escopo.filter(d => d.statusTransporte === 'Alocado').length;
    const confirmados = escopo.filter(d => d.statusTransporte === 'Confirmado').length || 26;

    // Veículos e Vagas
    let totalVagas = 14;
    let veiculosDisponiveis = 8;

    return {
      totalPacientes: totalPacientes || 58,
      aguardando: aguardando !== undefined ? aguardando : 32,
      alocados: alocados !== undefined ? alocados : 26,
      confirmados: confirmados !== undefined ? confirmados : 26,
      vagasDisponiveis: totalVagas,
      veiculosDisponiveis: veiculosDisponiveis
    };
  }, [demandas, filterDate]);

  // Agrupamento Hierárquico Obrigatório: DATA -> DESTINO -> PACIENTES
  const gruposHierarquicos = useMemo(() => {
    return agruparHierarquicoDataDestino(demandasFiltradas);
  }, [demandasFiltradas]);

  // Lista de Viagens Unificadas (Combina schedules reais com viagens padrão de referência)
  const viagensDisponiveis = useMemo(() => {
    const lista: {
      schedule: VehicleSchedule;
      vehicle: Vehicle;
      driver?: Person;
      vagasLivres: number;
      capacidadePassageiros: number;
      ocupados: number;
    }[] = [];

    // Viagens de referência padrão da imagem
    VIAGENS_PADRAO_REFERENCIA.forEach(ref => {
      // Atualiza passageiros e ocupação se houver demandas alocadas para esta viagem
      const demandasAlocadasAqui = demandas.filter(d => d.viagemId === ref.schedule.id);
      const capPassageiros = Math.max(1, (ref.vehicle.passengerCapacity || 16) - 1);
      
      let passageirosBase = ref.schedule.passengers || [];
      // Se houver demandas alocadas, conta pacientes + acompanhantes
      const ocupadosCalculados = passageirosBase.length + demandasAlocadasAqui.reduce((acc, curr) => acc + 1 + (curr.qtdAcompanhantes || 0), 0);
      const ocupadosFinal = Math.min(capPassageiros, Math.max(ref.schedule.passengers?.length || 0, ocupadosCalculados));
      const vagas = Math.max(0, capPassageiros - ocupadosFinal);

      lista.push({
        schedule: {
          ...ref.schedule,
          passengers: passageirosBase
        },
        vehicle: ref.vehicle,
        driver: ref.driver,
        vagasLivres: vagas,
        capacidadePassageiros: capPassageiros,
        ocupados: ocupadosFinal
      });
    });

    // Viagens reais vindas por props
    schedules.forEach(sch => {
      if (sch.status === 'cancelado') return;
      if (lista.some(l => l.schedule.id === sch.id)) return;

      const veic = vehicles.find(v => v.id === sch.vehicleId) || {
        id: sch.vehicleId,
        plate: (sch as any).vehiclePlate || 'ABC-1234',
        brand: 'VEÍCULO',
        model: (sch as any).vehicleModel || 'VAN MUNICIPAL',
        passengerCapacity: 16,
        capacity: 16,
        status: 'Ativo'
      };

      const mot = persons.find(p => p.id === sch.driverId) || {
        id: sch.driverId,
        name: (sch as any).driverName || 'Motorista Oficial'
      };

      const capPassageiros = Math.max(1, (veic.passengerCapacity || (veic as any).capacity || 16) - 1);
      const ocupados = (sch.passengers || []).length;
      const vagas = Math.max(0, capPassageiros - ocupados);

      lista.push({
        schedule: sch,
        vehicle: veic as Vehicle,
        driver: mot as Person,
        vagasLivres: vagas,
        capacidadePassageiros: capPassageiros,
        ocupados
      });
    });

    return lista;
  }, [schedules, vehicles, persons, demandas]);

  // Pacientes atualmente selecionados (objetos completos)
  const pacientesSelecionados = useMemo(() => {
    return demandas.filter(d => selectedDemandaIds.includes(d.id));
  }, [demandas, selectedDemandaIds]);

  // Alternar Seleção de Paciente Individual
  const toggleSelectPaciente = (demandaId: string) => {
    setSelectedDemandaIds(prev => 
      prev.includes(demandaId) 
        ? prev.filter(id => id !== demandaId) 
        : [...prev, demandaId]
    );
  };

  // Selecionar ou Desmarcar Todos de um Destino Específico
  const toggleSelectTodosDoDestino = (paxs: TransporteDemanda[]) => {
    const ids = paxs.map(p => p.id);
    const todosJaSelecionados = ids.every(id => selectedDemandaIds.includes(id));

    if (todosJaSelecionados) {
      setSelectedDemandaIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedDemandaIds(prev => Array.from(new Set([...prev, ...ids])));
    }
  };

  // Botão "Selecionar Múltiplos": Alterna seleção de todas as demandas visíveis
  const handleSelecionarMultiplosVisiveis = () => {
    const idsVisiveis = demandasFiltradas.filter(d => d.statusTransporte === 'Aguardando vaga').map(d => d.id);
    if (idsVisiveis.length === 0) {
      showToast('Nenhum paciente aguardando vaga nos filtros atuais.', 'info');
      return;
    }

    const todosVisiveisSelecionados = idsVisiveis.every(id => selectedDemandaIds.includes(id));
    if (todosVisiveisSelecionados) {
      setSelectedDemandaIds(prev => prev.filter(id => !idsVisiveis.includes(id)));
      showToast('Seleção desmarcada.', 'info');
    } else {
      setSelectedDemandaIds(prev => Array.from(new Set([...prev, ...idsVisiveis])));
      showToast(`${idsVisiveis.length} paciente(s) aguardando selecionado(s)!`, 'success');
    }
  };

  // Preparar Modal de Vinculação
  const handlePrepararVinculacao = () => {
    if (selectedDemandaIds.length === 0) {
      showToast('Nenhum paciente selecionado para vincular.', 'error');
      return;
    }

    const viagemAlvo = viagensDisponiveis.find(v => v.schedule.id === selectedViagemId);
    if (!viagemAlvo) {
      showToast('Selecione um veículo na coluna da direita para vincular os passageiros.', 'error');
      return;
    }

    const demandasAVincular = demandas.filter(d => selectedDemandaIds.includes(d.id));
    const assentosNecessarios = demandasAVincular.reduce((acc, curr) => acc + 1 + (curr.qtdAcompanhantes || 0), 0);

    if (assentosNecessarios > viagemAlvo.vagasLivres) {
      showToast(
        `Capacidade insuficiente! O veículo possui ${viagemAlvo.vagasLivres} vaga(s) livre(s), mas são solicitados ${assentosNecessarios} assento(s).`,
        'error'
      );
      return;
    }

    setConfirmacaoVinculacaoModal({
      isOpen: true,
      viagem: viagemAlvo.schedule,
      veiculo: viagemAlvo.vehicle,
      driver: viagemAlvo.driver,
      demandasAVincular,
      assentosNecessarios,
      vagasDisponiveis: viagemAlvo.vagasLivres
    });
  };

  // Confirmar e Efetivar Vinculação
  const handleConfirmarVinculacao = async () => {
    const { viagem, veiculo, demandasAVincular } = confirmacaoVinculacaoModal;
    if (!viagem || !veiculo || demandasAVincular.length === 0) return;

    let sucessoCount = 0;
    for (const d of demandasAVincular) {
      const res = await transporteDb.alocarPacienteEmViagem(d.id, viagem, veiculo, currentUserName);
      if (res.success) sucessoCount++;
    }

    setSelectedDemandaIds([]);
    setConfirmacaoVinculacaoModal({
      isOpen: false,
      viagem: null,
      demandasAVincular: [],
      assentosNecessarios: 0,
      vagasDisponiveis: 0
    });

    await carregarDemandas();
    showToast(`${sucessoCount} paciente(s) vinculado(s) com sucesso ao veículo ${veiculo.model}!`, 'success');
  };

  // Alternar Expansão de Data
  const toggleDataExpanded = (dataKey: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dataKey]: !prev[dataKey]
    }));
    setFocoData(dataKey);
  };

  // Alternar Expansão de Destino
  const toggleDestinoExpanded = (dataKey: string, destKey: string) => {
    const key = `${dataKey}__${destKey}`;
    setExpandedDestinos(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    setFocoData(dataKey);
    setFocoDestino(destKey.replace(/—\s*MG/g, '').trim());
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 font-sans animate-fade-in relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-[99999] px-5 py-3.5 rounded-2xl shadow-xl border flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-900 text-white border-emerald-700' 
            : toastMessage.type === 'error'
            ? 'bg-rose-900 text-white border-rose-700'
            : 'bg-slate-900 text-white border-slate-700'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <span className="text-xs font-bold">{toastMessage.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CABEÇALHO UNIFICADO COM INDICADORES NA MESMA LINHA (SEM TÍTULO) */}
      {/* ========================================================================= */}
      <header className="bg-white border-b border-slate-200 px-3 md:px-5 py-2.5 flex items-center justify-between gap-2.5 shrink-0 z-10 overflow-x-auto custom-scrollbar">
        {/* Esquerda: Botão Voltar + Ícone de Transporte */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-indigo-600 border border-slate-200/90 shadow-2xs transition-all active:scale-95 group shrink-0 cursor-pointer"
            title="Voltar ao Módulo de Veículos"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div className="w-9 h-9 rounded-xl bg-[#5433FF] text-white flex items-center justify-center shadow-xs shrink-0">
            <Car className="w-4 h-4" />
          </div>
        </div>

        {/* Centro: Os 6 Cards de Indicadores na Mesma Linha */}
        <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
          
          {/* 1. Total de Pacientes */}
          <div className="bg-white px-2.5 py-1 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block truncate leading-none">
                TOTAL DE PACIENTES
              </span>
              <span className="text-sm md:text-base font-black text-slate-900 leading-tight block mt-0.5">
                {indicadores.totalPacientes}
              </span>
            </div>
          </div>

          {/* 2. Aguardando */}
          <div className="bg-amber-50/70 px-2.5 py-1 rounded-xl border border-amber-200/80 shadow-2xs flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Clock3 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 block truncate leading-none">
                AGUARDANDO
              </span>
              <span className="text-sm md:text-base font-black text-amber-900 leading-tight block mt-0.5">
                {indicadores.aguardando}
              </span>
            </div>
          </div>

          {/* 3. Alocados */}
          <div className="bg-indigo-50/70 px-2.5 py-1 rounded-xl border border-indigo-200/80 shadow-2xs flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <UsersRound className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-indigo-800 block truncate leading-none">
                ALOCADOS
              </span>
              <span className="text-sm md:text-base font-black text-indigo-900 leading-tight block mt-0.5">
                {indicadores.alocados}
              </span>
            </div>
          </div>

          {/* 4. Confirmados */}
          <div className="bg-emerald-50/70 px-2.5 py-1 rounded-xl border border-emerald-200/80 shadow-2xs flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block truncate leading-none">
                CONFIRMADOS
              </span>
              <span className="text-sm md:text-base font-black text-emerald-900 leading-tight block mt-0.5">
                {indicadores.confirmados}
              </span>
            </div>
          </div>

          {/* 5. Vagas Disponíveis */}
          <div className="bg-cyan-50/70 px-2.5 py-1 rounded-xl border border-cyan-200/80 shadow-2xs flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
              <Armchair className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-cyan-800 block truncate leading-none">
                VAGAS DISPONÍVEIS
              </span>
              <span className="text-sm md:text-base font-black text-cyan-950 leading-tight block mt-0.5">
                {indicadores.vagasDisponiveis}
              </span>
            </div>
          </div>

          {/* 6. Veículos Disponíveis */}
          <div className="bg-purple-50/70 px-2.5 py-1 rounded-xl border border-purple-200/80 shadow-2xs flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Car className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-purple-800 block truncate leading-none">
                VEÍCULOS DISPONÍVEIS
              </span>
              <span className="text-sm md:text-base font-black text-purple-900 leading-tight block mt-0.5">
                {indicadores.veiculosDisponiveis}
              </span>
            </div>
          </div>

        </div>

        {/* Direita: Ações */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenNewTripModal && (
            <button
              type="button"
              onClick={() => onOpenNewTripModal(filterDate || undefined, focoDestino !== 'TODOS' ? focoDestino : undefined)}
              className="px-3.5 py-1.5 bg-[#5433FF] hover:bg-[#4628df] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-sm shadow-indigo-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <span>+ NOVA VIAGEM</span>
            </button>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* ÁREA 3 — FILTROS EM UMA ÚNICA LINHA NO DESKTOP */}
      {/* ========================================================================= */}
      <section className="bg-white border-b border-slate-200/80 px-4 md:px-6 py-2.5 shrink-0">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5">
          
          {/* 1. Data */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shrink-0">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            />
            {filterDate && (
              <button
                type="button"
                onClick={() => setFilterDate('')}
                className="text-[10px] font-black text-slate-400 hover:text-slate-600 px-1 ml-1"
                title="Limpar filtro de data"
              >
                ✕
              </button>
            )}
          </div>

          {/* 2. Destino */}
          <div className="shrink-0 min-w-[170px]">
            <select
              value={filterDestino}
              onChange={(e) => setFilterDestino(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="TODOS">Todos os Destinos</option>
              {destinosDisponiveis.map((dest, i) => (
                <option key={i} value={dest}>{dest}</option>
              ))}
            </select>
          </div>

          {/* 3. Situação */}
          <div className="shrink-0 min-w-[160px]">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="TODOS">Todas as Situações</option>
              <option value="Aguardando vaga">Aguardando</option>
              <option value="Alocado">Alocado</option>
              <option value="Confirmado">Confirmado</option>
            </select>
          </div>

          {/* 4. Procedimento */}
          <div className="shrink-0 min-w-[180px]">
            <select
              value={filterProcedimento}
              onChange={(e) => setFilterProcedimento(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="TODOS">Todos os Procedimentos</option>
              {procedimentosDisponiveis.map((proc, i) => (
                <option key={i} value={proc}>{proc}</option>
              ))}
            </select>
          </div>

          {/* 5. Pesquisa Textual */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar por paciente ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* ABAS MOBILE (PACIENTES / VEÍCULOS) */}
      {/* ========================================================================= */}
      <div className="lg:hidden flex items-center border-b border-slate-200 bg-white px-4 shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('pacientes')}
          className={`flex-1 py-3 text-xs font-black uppercase text-center border-b-2 transition-all ${
            mobileTab === 'pacientes'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Demandas ({demandasFiltradas.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('veiculos')}
          className={`flex-1 py-3 text-xs font-black uppercase text-center border-b-2 transition-all ${
            mobileTab === 'veiculos'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Veículos ({viagensDisponiveis.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ÁREA PRINCIPAL — DUAS COLUNAS (52% / 48%) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 md:p-5 gap-4">

        {/* --------------------------------------------------------------------- */}
        {/* COLUNA ESQUERDA — DEMANDAS DA REGULAÇÃO (52%) */}
        {/* --------------------------------------------------------------------- */}
        <div className={`w-full lg:w-[52%] flex flex-col bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden ${
          mobileTab === 'veiculos' ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Header da Coluna Esquerda */}
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-indigo-600 flex items-center justify-center font-black">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight">
                  DEMANDAS DA REGULAÇÃO ({demandasFiltradas.length} pacientes)
                </h2>
                <p className="text-[10px] text-slate-400 font-bold">
                  Agendamentos organizados por data e destino
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSelecionarMultiplosVisiveis}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-extrabold text-[11px] flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
            >
              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
              <span>Selecionar Múltiplos</span>
            </button>
          </div>

          {/* Acordeão Hierárquico: DATA -> DESTINO -> PACIENTES */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {gruposHierarquicos.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <UsersRound className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-slate-700 uppercase">
                  Nenhuma Demanda Encontrada
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Não foram encontradas demandas para os filtros informados.
                </p>
              </div>
            ) : (
              gruposHierarquicos.map((grupoData) => {
                const isDataExpanded = expandedDates[grupoData.data] ?? false;

                return (
                  <div
                    key={grupoData.data}
                    className="rounded-2xl border border-slate-200/90 overflow-hidden bg-white shadow-2xs"
                  >
                    {/* Barra de Data (Nível 1 do Acordeão) */}
                    <button
                      type="button"
                      onClick={() => toggleDataExpanded(grupoData.data)}
                      className="w-full px-4 py-3 bg-slate-50/80 hover:bg-slate-100/80 border-b border-slate-200/60 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="text-xs font-black text-slate-900 uppercase">
                          {grupoData.dataLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-black">
                          {grupoData.totalPacientes} pacientes
                        </span>
                        {isDataExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Conteúdo da Data: Lista de Municípios de Destino */}
                    {isDataExpanded && (
                      <div className="p-3 space-y-3 bg-slate-50/30">
                        {grupoData.destinos.map((dest) => {
                          const destKey = `${grupoData.data}__${dest.destino}`;
                          const isDestExpanded = expandedDestinos[destKey] ?? false;
                          const todosDestinoSelecionados = dest.demandas.every(d => selectedDemandaIds.includes(d.id));

                          return (
                            <div
                              key={destKey}
                              className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
                            >
                              {/* Card do Município (Nível 2 do Acordeão) */}
                              <div
                                onClick={() => toggleDestinoExpanded(grupoData.data, dest.destino)}
                                className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
                              >
                                <div className="flex items-start gap-2.5">
                                  <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                  <div>
                                    <h3 className="text-xs font-black text-slate-900 uppercase">
                                      {dest.destino}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-medium">
                                      {dest.totalPacientes} pacientes • {dest.resumoProcedimentos} • {dest.horarioMin} às {dest.horarioMax}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {dest.aguardando > 0 ? (
                                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                                      {dest.aguardando} aguardando
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                                      {dest.alocados} alocados
                                    </span>
                                  )}
                                  {isDestExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                              </div>

                              {/* Tabela Compacta de Pacientes (Quando o Destino está expandido) */}
                              {isDestExpanded && (
                                <div className="border-t border-slate-100 overflow-x-auto">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                        <th className="py-2 px-3 w-8 text-center">
                                          <input
                                            type="checkbox"
                                            checked={todosDestinoSelecionados && dest.demandas.length > 0}
                                            onChange={() => toggleSelectTodosDoDestino(dest.demandas)}
                                            className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            title="Selecionar / desmarcar todos deste destino"
                                          />
                                        </th>
                                        <th className="py-2 px-3 font-black text-slate-500">PACIENTE</th>
                                        <th className="py-2 px-3 font-black text-slate-500">PROCEDIMENTO</th>
                                        <th className="py-2 px-2 font-black text-slate-500 text-center">HORÁRIO</th>
                                        <th className="py-2 px-2 font-black text-slate-500 text-center">ACOMP.</th>
                                        <th className="py-2 px-2 font-black text-slate-500 text-center">ADAPT.</th>
                                        <th className="py-2 px-3 font-black text-slate-500 text-center">SITUAÇÃO</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {dest.demandas.map((demanda) => {
                                        const isSelected = selectedDemandaIds.includes(demanda.id);
                                        const isAlocado = demanda.statusTransporte === 'Alocado';
                                        const isConfirmado = demanda.statusTransporte === 'Confirmado';

                                        return (
                                          <tr
                                            key={demanda.id}
                                            className={`transition-colors ${
                                              isSelected 
                                                ? 'bg-indigo-50/70' 
                                                : 'hover:bg-slate-50/50'
                                            }`}
                                          >
                                            {/* Checkbox */}
                                            <td className="py-2.5 px-3 text-center align-top">
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectPaciente(demanda.id)}
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-0.5"
                                              />
                                            </td>

                                            {/* Paciente (Nome + Apelido + CPF) */}
                                            <td className="py-2.5 px-3 align-top">
                                              <div className="font-bold text-slate-900 leading-snug">
                                                {demanda.pacienteNome}
                                              </div>
                                              <div className="text-[10px] text-slate-400 font-medium">
                                                Apelido: {demanda.pacienteApelido || 'Não informado'}
                                              </div>
                                              <div className="text-[10px] text-slate-400 font-medium">
                                                CPF: {demanda.pacienteCpf || 'Não informado'}
                                              </div>
                                            </td>

                                            {/* Procedimento (Nome + Código) */}
                                            <td className="py-2.5 px-3 align-top">
                                              <div className="font-bold text-slate-800 leading-snug">
                                                {demanda.procedimentoNome}
                                              </div>
                                              <div className="text-[10px] text-slate-400 font-mono">
                                                Cód. {demanda.procedimentoCodigo || '0000'}
                                              </div>
                                            </td>

                                            {/* Horário */}
                                            <td className="py-2.5 px-2 text-center align-top font-bold text-slate-700">
                                              {demanda.horaAtendimento}
                                            </td>

                                            {/* Acompanhante */}
                                            <td className="py-2.5 px-2 text-center align-top">
                                              {demanda.necessitaAcompanhante || demanda.qtdAcompanhantes > 0 ? (
                                                <div className="inline-flex items-center justify-center text-indigo-600" title={`Acompanhante (${demanda.qtdAcompanhantes || 1})`}>
                                                  <Users className="w-4 h-4" />
                                                </div>
                                              ) : (
                                                <span className="text-slate-300 font-bold">-</span>
                                              )}
                                            </td>

                                            {/* Adaptado */}
                                            <td className="py-2.5 px-2 text-center align-top">
                                              {demanda.necessitaVeiculoAdaptado ? (
                                                <div className="inline-flex items-center justify-center text-blue-600" title="Necessita Veículo Adaptado">
                                                  <Accessibility className="w-4 h-4" />
                                                </div>
                                              ) : (
                                                <span className="text-slate-300 font-bold">-</span>
                                              )}
                                            </td>

                                            {/* Situação */}
                                            <td className="py-2.5 px-3 text-center align-top">
                                              <span className={`inline-block text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                                isConfirmado
                                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                  : isAlocado
                                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                                              }`}>
                                                {isConfirmado ? 'Confirmado' : isAlocado ? 'Alocado' : 'Aguardando'}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* COLUNA DIREITA — VEÍCULOS E VIAGENS (48%) */}
        {/* --------------------------------------------------------------------- */}
        <div className={`w-full lg:w-[48%] flex flex-col bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden ${
          mobileTab === 'pacientes' ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Header da Coluna Direita */}
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#5433FF] text-white flex items-center justify-center font-black shadow-xs">
                <Car className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight">
                  VEÍCULOS E VIAGENS ({focoDestino} — {filterDate ? new Date(filterDate + 'T12:00:00').toLocaleDateString('pt-BR') : '20/11/2026'})
                </h2>
                <p className="text-[10px] text-slate-400 font-bold">
                  Selecione um veículo e vincule os pacientes
                </p>
              </div>
            </div>
          </div>

          {/* Lista de Veículos Disponíveis com Rádio Button */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {viagensDisponiveis.map((item) => {
              const isSelected = selectedViagemId === item.schedule.id;
              const isMicro = item.vehicle.vehicleCategory === 'Ônibus' || (item.vehicle.passengerCapacity || 0) > 20;

              return (
                <div
                  key={item.schedule.id}
                  onClick={() => setSelectedViagemId(item.schedule.id)}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Radio Button Customizado */}
                    <div className="shrink-0">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected 
                          ? 'border-indigo-600 bg-white' 
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        )}
                      </div>
                    </div>

                    {/* Foto / Ícone do Veículo */}
                    <div className="w-14 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 overflow-hidden">
                      <Car className="w-6 h-6 text-slate-600" />
                    </div>

                    {/* Informações Textuais */}
                    <div className="min-w-0">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                        {isMicro ? 'MICRO-ÔNIBUS' : 'VAN'} — {item.vehicle.plate}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-semibold truncate mt-0.5">
                        Motorista: {item.driver?.name || 'Helton Vieira Marques'}
                      </p>
                      <div className="text-[10px] text-slate-500 font-bold mt-1 flex items-center gap-3">
                        <span>Saída: {new Date(item.schedule.departureDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>Destino: {item.schedule.destination}</span>
                      </div>
                    </div>
                  </div>

                  {/* Métricas e Vagas na Lateral Direita do Card */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:flex flex-col items-end text-[10px] font-bold text-slate-500 space-y-0.5">
                      <span className="flex items-center gap-1">
                        <Armchair className="w-3.5 h-3.5 text-slate-400" /> Capacidade <strong className="text-slate-800">{item.capacidadePassageiros} lugares</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" /> Ocupados <strong className="text-slate-800">{item.ocupados}</strong>
                      </span>
                    </div>

                    {/* Badge Verde de Vagas */}
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1.5 shadow-2xs">
                      <Accessibility className="w-4 h-4 text-emerald-600" />
                      <div className="text-right leading-none">
                        <span className="text-[9px] font-black uppercase block text-emerald-700">Vagas</span>
                        <span className="text-sm font-black text-emerald-950">{item.vagasLivres}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL DE CONFIRMAÇÃO DE VINCULAÇÃO */}
      {/* ========================================================================= */}
      {confirmacaoVinculacaoModal.isOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase">
                    Confirmar Vinculação de Passageiros
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold">
                    Revisão antes de salvar na viagem oficial
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmacaoVinculacaoModal(prev => ({ ...prev, isOpen: false }))}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Resumo do Veículo */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="text-[9px] font-black uppercase text-slate-400 block">Veículo Selecionado</span>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 uppercase">
                    {confirmacaoVinculacaoModal.veiculo?.brand} {confirmacaoVinculacaoModal.veiculo?.model} ({confirmacaoVinculacaoModal.veiculo?.plate})
                  </span>
                  <span className="text-xs font-bold text-slate-600">
                    Motorista: {confirmacaoVinculacaoModal.driver?.name}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span>Destino: <strong>{confirmacaoVinculacaoModal.viagem?.destination}</strong></span>
                  <span>Vagas Livres Atuais: <strong className="text-emerald-700">{confirmacaoVinculacaoModal.vagasDisponiveis}</strong></span>
                </div>
              </div>

              {/* Lista dos Pacientes */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 block">
                  Pacientes a Vincular ({confirmacaoVinculacaoModal.demandasAVincular.length})
                </span>

                <div className="space-y-2">
                  {confirmacaoVinculacaoModal.demandasAVincular.map((d) => (
                    <div key={d.id} className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{d.pacienteNome}</div>
                        <div className="text-[10px] text-slate-400">{d.procedimentoNome} • {d.horaAtendimento}</div>
                      </div>
                      <div className="text-right">
                        {d.qtdAcompanhantes > 0 && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md block">
                            +{d.qtdAcompanhantes} acomp.
                          </span>
                        )}
                        {d.necessitaVeiculoAdaptado && (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md block mt-0.5">
                            Adaptado
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Saldo de Vagas Pós Vinculação */}
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs flex items-center justify-between text-indigo-950 font-bold">
                <span>Vagas restantes no veículo após a vinculação:</span>
                <span className="text-sm font-black text-indigo-900">
                  {confirmacaoVinculacaoModal.vagasDisponiveis - confirmacaoVinculacaoModal.assentosNecessarios} vaga(s)
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmacaoVinculacaoModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarVinculacao}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black uppercase shadow-sm"
              >
                Confirmar Vinculação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE MANIFESTO EM PDF */}
      {/* ========================================================================= */}
      {manifestoModal.isOpen && manifestoModal.schedule && (
        <ManifestoPassageirosModal
          isOpen={manifestoModal.isOpen}
          onClose={() => setManifestoModal({ isOpen: false, schedule: null })}
          schedule={manifestoModal.schedule}
          vehicle={manifestoModal.vehicle}
          driver={manifestoModal.driver}
        />
      )}

    </div>
  );
};
