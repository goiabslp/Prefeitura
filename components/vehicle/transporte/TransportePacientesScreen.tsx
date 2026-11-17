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
  Armchair,
  Plus
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
  normalizeTransporteText, 
  filtrarVeiculosElegiveisTransporte,
  getAgoraBrasilISO
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
  onOpenNewTripModal?: (defaultDate?: string, defaultDestination?: string, defaultVehicleId?: string) => void;
}

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
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filtros combinados em linha única (iniciam limpos)
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterDestino, setFilterDestino] = useState<string>('TODOS');
  const [filterStatus, setFilterStatus] = useState<TransporteStatus | 'TODOS'>('TODOS');
  const [filterProcedimento, setFilterProcedimento] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Seleção múltipla de pacientes (inicia limpa sem seleção prévia)
  const [selectedDemandaIds, setSelectedDemandaIds] = useState<string[]>([]);

  // Veículo/Viagem selecionada na coluna direita (inicia sem seleção)
  const [selectedViagemId, setSelectedViagemId] = useState<string>(''); // Para veículos LARANJA (viagem existente)
  const [selectedVeiculoVerdeId, setSelectedVeiculoVerdeId] = useState<string>(''); // Para veículos VERDE (livre sem destino)

  // Estados de expansão do Acordeão (datas e destinos abertos por padrão)
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [expandedDestinos, setExpandedDestinos] = useState<Record<string, boolean>>({});

  // Destino e data ativos em foco para a coluna direita
  const [focoData, setFocoData] = useState<string>('');
  const [focoDestino, setFocoDestino] = useState<string>('');

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
    setLoading(true);
    setLoadError(null);
    try {
      const data = await transporteDb.getDemandas();
      setDemandas(data);
    } catch (err: any) {
      console.error('[TransportePacientesScreen] Erro ao carregar demandas da Regulação:', err);
      const msg = err?.message || 'Falha de comunicação ao consultar os agendamentos da Regulação.';
      setLoadError(msg);
      setDemandas([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Timer de atualização contínua (a cada 30 segundos) para validar expiração de horário de saída
  const [currentTimeTick, setCurrentTimeTick] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeTick(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    carregarDemandas();

    const handleDataChanged = () => carregarDemandas();
    const handleVehicleDataChanged = () => setCurrentTimeTick(Date.now());

    window.addEventListener('transporte-demandas-changed', handleDataChanged);
    window.addEventListener('transporte-alocacao-changed', handleDataChanged);
    window.addEventListener('consultas-agendamentos-changed', handleDataChanged);
    window.addEventListener('consultas-vagas-changed', handleDataChanged);
    window.addEventListener('vehicle-schedules-changed', handleVehicleDataChanged);
    window.addEventListener('vehicles-changed', handleVehicleDataChanged);

    return () => {
      window.removeEventListener('transporte-demandas-changed', handleDataChanged);
      window.removeEventListener('transporte-alocacao-changed', handleDataChanged);
      window.removeEventListener('consultas-agendamentos-changed', handleDataChanged);
      window.removeEventListener('consultas-vagas-changed', handleDataChanged);
      window.removeEventListener('vehicle-schedules-changed', handleVehicleDataChanged);
      window.removeEventListener('vehicles-changed', handleVehicleDataChanged);
    };
  }, []);

  // Ação de Sincronização com a Regulação
  const handleSincronizarRegulacao = async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      const atualizadas = await transporteDb.sincronizarComRegulacao();
      setDemandas(atualizadas);
      showToast('Sincronização com o módulo de Regulação realizada com sucesso!', 'success');
    } catch (e: any) {
      const msg = e?.message || 'Falha de conexão com a Regulação';
      setLoadError(msg);
      showToast('Erro ao sincronizar com a Regulação: ' + msg, 'error');
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

  // Total de Pacientes Únicos no escopo filtrado (distinguindo agendamentos de pessoas físicas)
  const totalPacientesUnicosFiltrados = useMemo(() => {
    return new Set(demandasFiltradas.map(d => d.pacienteId || d.pacienteCpf || d.pacienteNome || d.id)).size;
  }, [demandasFiltradas]);

  // Agrupamento Hierárquico Obrigatório: DATA -> DESTINO -> PACIENTES
  const gruposHierarquicos = useMemo(() => {
    return agruparHierarquicoDataDestino(demandasFiltradas);
  }, [demandasFiltradas]);

  // Primeira demanda selecionada para sincronizar data e destino automaticamente
  const primeiraDemandaSelecionada = useMemo(() => {
    if (selectedDemandaIds.length === 0) return null;
    return demandas.find(d => selectedDemandaIds.includes(d.id)) || null;
  }, [demandas, selectedDemandaIds]);

  // Data Alvo vigente para filtrar os veículos disponíveis (Item 2)
  // REGRA OBRIGATÓRIA: Não assumir data oculta ao entrar. Apenas define data se o usuário filtrar,
  // selecionar um paciente ou clicar em uma data/destino no acordeão.
  const dataAlvo = useMemo(() => {
    if (focoData) return focoData;
    if (filterDate) return filterDate;
    if (primeiraDemandaSelecionada?.dataAtendimento) return primeiraDemandaSelecionada.dataAtendimento;
    return '';
  }, [focoData, filterDate, primeiraDemandaSelecionada]);

  // Destino Alvo vigente para filtrar os veículos disponíveis (Item 2 & 4)
  const destAlvo = useMemo(() => {
    if (focoDestino && focoDestino !== 'TODOS') return focoDestino;
    if (filterDestino && filterDestino !== 'TODOS') return filterDestino;
    if (primeiraDemandaSelecionada?.municipioDestino) return primeiraDemandaSelecionada.municipioDestino;
    return '';
  }, [focoDestino, filterDestino, primeiraDemandaSelecionada]);

  // Estrutura Unificada de Veículos Elegíveis (Regras 1 a 5): LARANJAS (Viagens futuras com vagas) e VERDES (Livres sem conflito)
  const { veiculosLaranja, veiculosVerdes, veiculosElegiveis, isDataPassada } = useMemo(() => {
    return filtrarVeiculosElegiveisTransporte({
      dataAlvo,
      destAlvo,
      schedules,
      vehicles,
      persons,
      agoraBrasilISO: getAgoraBrasilISO()
    });
  }, [schedules, vehicles, persons, dataAlvo, destAlvo, currentTimeTick]);

  // Indicadores Principais Dinâmicos (Regra 8: Apenas veículos elegíveis para a data e destino selecionados)
  const indicadores = useMemo(() => {
    const escopo = filterDate ? demandas.filter(d => d.dataAtendimento === filterDate) : demandas;
    const totalPacientes = new Set(escopo.map(d => d.pacienteId || d.pacienteCpf || d.pacienteNome || d.id)).size;
    const aguardando = escopo.filter(d => d.statusTransporte === 'Aguardando vaga').length;
    const alocados = escopo.filter(d => d.statusTransporte === 'Alocado').length;
    const confirmados = escopo.filter(d => d.statusTransporte === 'Confirmado').length;

    // Vagas disponíveis calculadas exclusivamente das viagens ativas com vagas para a data e destino (Laranja)
    const vagasDisponiveis = veiculosLaranja.reduce((acc, curr) => acc + curr.vagasLivres, 0);

    // Veículos disponíveis elegíveis (Laranjas com vagas + Verdes disponíveis)
    const veiculosDisponiveis = veiculosElegiveis.length;

    return {
      totalPacientes,
      aguardando,
      alocados,
      confirmados,
      vagasDisponiveis,
      veiculosDisponiveis
    };
  }, [demandas, filterDate, veiculosLaranja, veiculosElegiveis]);

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

    // Se o usuário selecionou um veículo verde (livre sem destino), abre o fluxo de criação da viagem
    if (selectedVeiculoVerdeId) {
      const veiculoVerde = veiculosVerdes.find(v => v.vehicle.id === selectedVeiculoVerdeId);
      if (onOpenNewTripModal && veiculoVerde) {
        onOpenNewTripModal(dataAlvo, (destAlvo && destAlvo !== 'Destino não informado') ? destAlvo : undefined, veiculoVerde.vehicle.id);
        showToast(`Criando viagem com o veículo ${veiculoVerde.vehicle.plate}. Preencha os horários e o motorista para prosseguir.`, 'info');
        return;
      }
    }

    const viagemAlvo = veiculosLaranja.find(v => v.schedule.id === selectedViagemId);
    if (!viagemAlvo) {
      showToast('Selecione um veículo com viagem ou um veículo livre na coluna da direita.', 'error');
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

  // Vinculação direta acionada pelo botão "VINCULAR PACIENTES" no card Laranja
  const handlePrepararVinculacaoComViagem = (
    viagem: VehicleSchedule,
    veiculo: Vehicle,
    driver?: Person,
    vagasLivres: number = 0
  ) => {
    if (selectedDemandaIds.length === 0) {
      showToast('Selecione ao menos um paciente na tabela ao lado para vincular a esta viagem.', 'info');
      return;
    }

    const demandasAVincular = demandas.filter(d => selectedDemandaIds.includes(d.id));
    const assentosNecessarios = demandasAVincular.reduce((acc, curr) => acc + 1 + (curr.qtdAcompanhantes || 0), 0);

    if (assentosNecessarios > vagasLivres) {
      showToast(
        `Capacidade insuficiente! Esta viagem possui ${vagasLivres} vaga(s) livre(s), mas são solicitados ${assentosNecessarios} assento(s).`,
        'error'
      );
      return;
    }

    setConfirmacaoVinculacaoModal({
      isOpen: true,
      viagem,
      veiculo,
      driver,
      demandasAVincular,
      assentosNecessarios,
      vagasDisponiveis: vagasLivres
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

  // Alternar Expansão de Data (aberto por padrão)
  const toggleDataExpanded = (dataKey: string) => {
    setExpandedDates(prev => {
      const current = prev[dataKey] !== undefined ? prev[dataKey] : true;
      return {
        ...prev,
        [dataKey]: !current
      };
    });
    setFocoData(dataKey);
  };

  // Alternar Expansão de Destino (aberto por padrão para expor o grid)
  const toggleDestinoExpanded = (dataKey: string, destKey: string) => {
    const key = `${dataKey}__${destKey}`;
    setExpandedDestinos(prev => {
      const current = prev[key] !== undefined ? prev[key] : true;
      return {
        ...prev,
        [key]: !current
      };
    });
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
      {/* CABEÇALHO UNIFICADO COM INDICADORES NA MESMA LINHA (COMPACTO) */}
      {/* ========================================================================= */}
      <header className="bg-white border-b border-slate-200 px-3 md:px-4 py-1.5 flex items-center justify-between gap-2 shrink-0 z-10 overflow-x-auto custom-scrollbar">
        {/* Esquerda: Botão Voltar + Ícone de Transporte */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-indigo-600 border border-slate-200/90 shadow-2xs transition-all active:scale-95 group shrink-0 cursor-pointer"
            title="Voltar ao Módulo de Veículos"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div className="w-8 h-8 rounded-lg bg-[#5433FF] text-white flex items-center justify-center shadow-xs shrink-0">
            <Car className="w-4 h-4" />
          </div>
        </div>

        {/* Centro: Os 6 Cards de Indicadores na Mesma Linha */}
        <div className="flex items-center gap-1.5 flex-1 justify-center min-w-0">
          
          {/* 1. Total de Pacientes */}
          <div className="bg-white px-2 py-0.5 rounded-lg border border-slate-200/90 shadow-2xs flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-3 h-3" />
            </div>
            <div className="min-w-0">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block truncate leading-none">
                TOTAL DE PACIENTES
              </span>
              <span className="text-sm font-black text-slate-900 leading-tight block mt-0.5">
                {indicadores.totalPacientes}
              </span>
            </div>
          </div>

          {/* 2. Aguardando */}
          <div className="bg-amber-50/70 px-2 py-0.5 rounded-lg border border-amber-200/80 shadow-2xs flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Clock3 className="w-3 h-3" />
            </div>
            <div className="min-w-0">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-amber-800 block truncate leading-none">
                AGUARDANDO
              </span>
              <span className="text-sm font-black text-amber-900 leading-tight block mt-0.5">
                {indicadores.aguardando}
              </span>
            </div>
          </div>

          {/* 3. Alocados */}
          <div className="bg-indigo-50/70 px-2 py-0.5 rounded-lg border border-indigo-200/80 shadow-2xs flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <UsersRound className="w-3 h-3" />
            </div>
            <div className="min-w-0">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-indigo-800 block truncate leading-none">
                ALOCADOS
              </span>
              <span className="text-sm font-black text-indigo-900 leading-tight block mt-0.5">
                {indicadores.alocados}
              </span>
            </div>
          </div>

          {/* 4. Confirmados */}
          <div className="bg-emerald-50/70 px-2 py-0.5 rounded-lg border border-emerald-200/80 shadow-2xs flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
            <div className="min-w-0">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-emerald-800 block truncate leading-none">
                CONFIRMADOS
              </span>
              <span className="text-sm font-black text-emerald-900 leading-tight block mt-0.5">
                {indicadores.confirmados}
              </span>
            </div>
          </div>

          {/* 5. Vagas Disponíveis */}
          <div className="bg-cyan-50/70 px-2 py-0.5 rounded-lg border border-cyan-200/80 shadow-2xs flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded-md bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
              <Armchair className="w-3 h-3" />
            </div>
            <div className="min-w-0">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-cyan-800 block truncate leading-none">
                VAGAS DISPONÍVEIS
              </span>
              <span className="text-sm font-black text-cyan-950 leading-tight block mt-0.5">
                {indicadores.vagasDisponiveis}
              </span>
            </div>
          </div>

          {/* 6. Veículos Disponíveis */}
          <div className="bg-purple-50/70 px-2 py-0.5 rounded-lg border border-purple-200/80 shadow-2xs flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Car className="w-3 h-3" />
            </div>
            <div className="min-w-0">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-purple-800 block truncate leading-none">
                VEÍCULOS DISPONÍVEIS
              </span>
              <span className="text-sm font-black text-purple-900 leading-tight block mt-0.5">
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
              onClick={() => onOpenNewTripModal(dataAlvo || undefined, (destAlvo && destAlvo !== 'TODOS' && destAlvo !== 'Destino não informado') ? destAlvo : undefined)}
              className="px-3 py-1 bg-[#5433FF] hover:bg-[#4628df] text-white font-black text-[11px] uppercase tracking-wider rounded-lg shadow-sm shadow-indigo-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <span>+ NOVA VIAGEM</span>
            </button>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* ÁREA 3 — FILTROS EM UMA ÚNICA LINHA NO DESKTOP (COMPACTO) */}
      {/* ========================================================================= */}
      <section className="bg-white border-b border-slate-200/80 px-3 md:px-4 py-1.5 shrink-0">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
          
          {/* 1. Data */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 shrink-0 h-8">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
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
                className="text-[10px] font-black text-slate-400 hover:text-slate-600 px-1 ml-0.5"
                title="Limpar filtro de data"
              >
                ✕
              </button>
            )}
          </div>

          {/* 2. Destino */}
          <div className="shrink-0 min-w-[160px]">
            <select
              value={filterDestino}
              onChange={(e) => setFilterDestino(e.target.value)}
              className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer h-8"
            >
              <option value="TODOS">Todos os Destinos</option>
              {destinosDisponiveis.map((dest, i) => (
                <option key={i} value={dest}>{dest}</option>
              ))}
            </select>
          </div>

          {/* 3. Situação */}
          <div className="shrink-0 min-w-[150px]">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer h-8"
            >
              <option value="TODOS">Todas as Situações</option>
              <option value="Aguardando vaga">Aguardando</option>
              <option value="Alocado">Alocado</option>
              <option value="Confirmado">Confirmado</option>
            </select>
          </div>

          {/* 4. Procedimento */}
          <div className="shrink-0 min-w-[170px]">
            <select
              value={filterProcedimento}
              onChange={(e) => setFilterProcedimento(e.target.value)}
              className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer h-8"
            >
              <option value="TODOS">Todos os Procedimentos</option>
              {procedimentosDisponiveis.map((proc, i) => (
                <option key={i} value={proc}>{proc}</option>
              ))}
            </select>
          </div>

          {/* 5. Pesquisa Textual */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar por paciente ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 h-8"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
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
          Veículos ({veiculosElegiveis.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ÁREA PRINCIPAL — DUAS COLUNAS (58% GRID DE DEMANDAS / 42% VEÍCULOS) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 sm:p-2.5 md:p-3 gap-2.5 md:gap-3">

        {/* --------------------------------------------------------------------- */}
        {/* COLUNA ESQUERDA — DEMANDAS DA REGULAÇÃO / GRID PRIORITÁRIO (58%) */}
        {/* --------------------------------------------------------------------- */}
        <div className={`w-full lg:w-[58%] flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden ${
          mobileTab === 'veiculos' ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Header da Coluna Esquerda */}
          <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-indigo-600 flex items-center justify-center font-black">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                  DEMANDAS DA REGULAÇÃO ({demandasFiltradas.length} {demandasFiltradas.length === 1 ? 'DEMANDA' : 'DEMANDAS'})
                </h2>
                <p className="text-[10px] text-slate-400 font-bold leading-none mt-0.5">
                  {totalPacientesUnicosFiltrados} paciente(s) único(s) • Agendamentos organizados por data e destino
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedDemandaIds.length > 0 && (
                <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-lg">
                  {selectedDemandaIds.length} selecionado(s)
                </span>
              )}
              <button
                type="button"
                onClick={handleSelecionarMultiplosVisiveis}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-extrabold text-[11px] flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                <span>Selecionar Múltiplos</span>
              </button>
            </div>
          </div>

          {/* Acordeão Hierárquico: DATA -> DESTINO -> PACIENTES (Expandido por padrão) */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-2 custom-scrollbar">
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                  Consultando Agendamentos da Regulação...
                </h4>
                <p className="text-[11px] text-slate-400">
                  Carregando dados oficiais diretamente do banco de dados municipal.
                </p>
              </div>
            ) : loadError ? (
              <div className="p-4 my-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="text-xs font-black uppercase">Falha ao consultar a Regulação</span>
                </div>
                <p className="text-[11px] text-rose-700 font-medium">
                  {loadError}
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={carregarDemandas}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-xs active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Tentar novamente</span>
                  </button>
                </div>
              </div>
            ) : gruposHierarquicos.length === 0 ? (
              <div className="py-16 text-center space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <UsersRound className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-black text-slate-700 uppercase">
                  Nenhum Agendamento Confirmado Encontrado
                </h4>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Não foram localizados agendamentos com data confirmada na Regulação para os filtros ativos.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleSincronizarRegulacao}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-lg border border-indigo-200 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sincronizar Regulação</span>
                  </button>
                </div>
              </div>
            ) : (
              gruposHierarquicos.map((grupoData) => {
                // Por padrão aberto para priorizar a visualização direta do grid
                const isDataExpanded = expandedDates[grupoData.data] !== undefined ? expandedDates[grupoData.data] : true;

                return (
                  <div
                    key={grupoData.data}
                    className="rounded-xl border border-slate-200/90 overflow-hidden bg-white shadow-2xs"
                  >
                    {/* Barra de Data (Nível 1 do Acordeão) */}
                    <button
                      type="button"
                      onClick={() => toggleDataExpanded(grupoData.data)}
                      className="w-full px-3 py-2 bg-slate-50/90 hover:bg-slate-100/90 border-b border-slate-200/60 flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="text-xs font-black text-slate-900 uppercase">
                          {grupoData.dataLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10.5px] font-black">
                          {grupoData.totalPacientes} pacientes
                        </span>
                        {isDataExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Conteúdo da Data: Lista de Municípios de Destino */}
                    {isDataExpanded && (
                      <div className="p-2 space-y-2 bg-slate-50/30">
                        {grupoData.destinos.map((dest) => {
                          const destKey = `${grupoData.data}__${dest.destino}`;
                          // Por padrão aberto para priorizar a visualização direta do grid
                          const isDestExpanded = expandedDestinos[destKey] !== undefined ? expandedDestinos[destKey] : true;
                          const todosDestinoSelecionados = dest.demandas.every(d => selectedDemandaIds.includes(d.id));

                          return (
                            <div
                              key={destKey}
                              className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs"
                            >
                              {/* Card do Município (Nível 2 do Acordeão) */}
                              <div
                                onClick={() => toggleDestinoExpanded(grupoData.data, dest.destino)}
                                className="px-3 py-2 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50/60 transition-colors"
                              >
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                  <div>
                                    <h3 className="text-xs font-black text-slate-900 uppercase">
                                      {dest.destino}
                                    </h3>
                                    <p className="text-[10.5px] text-slate-500 font-medium">
                                      {dest.totalPacientes} pacientes • {dest.resumoProcedimentos} • {dest.horarioMin} às {dest.horarioMax}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {dest.aguardando > 0 ? (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[9.5px] font-bold">
                                      {dest.aguardando} aguardando
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[9.5px] font-bold">
                                      {dest.alocados} alocados
                                    </span>
                                  )}
                                  {isDestExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                </div>
                              </div>

                              {/* Grid Compacto de Pacientes (Tabela com Prioridade Total) */}
                              {isDestExpanded && (
                                <div className="border-t border-slate-100 overflow-x-auto">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-slate-50/90 border-b border-slate-200/60 text-[9.5px] font-black uppercase text-slate-500 tracking-wider sticky top-0 z-10">
                                        <th className="py-1.5 px-2.5 w-7 text-center">
                                          <input
                                            type="checkbox"
                                            checked={todosDestinoSelecionados && dest.demandas.length > 0}
                                            onChange={() => toggleSelectTodosDoDestino(dest.demandas)}
                                            className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            title="Selecionar / desmarcar todos deste destino"
                                          />
                                        </th>
                                        <th className="py-1.5 px-2.5 font-black text-slate-600">PACIENTE</th>
                                        <th className="py-1.5 px-2 font-black text-slate-600">PROCEDIMENTO</th>
                                        <th className="py-1.5 px-1.5 font-black text-slate-600 text-center w-16">HORÁRIO</th>
                                        <th className="py-1.5 px-1 font-black text-slate-600 text-center w-12">ACOMP.</th>
                                        <th className="py-1.5 px-1 font-black text-slate-600 text-center w-12">ADAPT.</th>
                                        <th className="py-1.5 px-2.5 font-black text-slate-600 text-center w-24">SITUAÇÃO</th>
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
                                            <td className="py-1.5 px-2.5 text-center align-middle">
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectPaciente(demanda.id)}
                                                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                              />
                                            </td>

                                            {/* Paciente (Nome + Apelido + CPF) */}
                                            <td className="py-1.5 px-2.5 align-middle">
                                              <div className="font-bold text-slate-900 leading-tight">
                                                {demanda.pacienteNome}
                                              </div>
                                              <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 flex-wrap mt-0.5">
                                                <span>Apelido: <strong className="text-slate-700 font-bold">{demanda.pacienteApelido || 'Não informado'}</strong></span>
                                                <span className="text-slate-300">•</span>
                                                <span>CPF: {demanda.pacienteCpf || 'Não informado'}</span>
                                              </div>
                                            </td>

                                            {/* Procedimento (Nome + Código) */}
                                            <td className="py-1.5 px-2 align-middle">
                                              <div className="font-bold text-slate-800 leading-tight">
                                                {demanda.procedimentoNome}
                                              </div>
                                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                Cód. {demanda.procedimentoCodigo || '0000'}
                                              </div>
                                            </td>

                                            {/* Horário */}
                                            <td className="py-1.5 px-1.5 text-center align-middle font-bold text-slate-700 text-xs">
                                              {demanda.horaAtendimento}
                                            </td>

                                            {/* Acompanhante */}
                                            <td className="py-1.5 px-1 text-center align-middle">
                                              {demanda.necessitaAcompanhante || demanda.qtdAcompanhantes > 0 ? (
                                                <div className="inline-flex items-center justify-center text-indigo-600" title={`Acompanhante (${demanda.qtdAcompanhantes || 1})`}>
                                                  <Users className="w-3.5 h-3.5" />
                                                </div>
                                              ) : (
                                                <span className="text-slate-300 font-bold">-</span>
                                              )}
                                            </td>

                                            {/* Adaptado */}
                                            <td className="py-1.5 px-1 text-center align-middle">
                                              {demanda.necessitaVeiculoAdaptado ? (
                                                <div className="inline-flex items-center justify-center text-blue-600" title="Necessita Veículo Adaptado">
                                                  <Accessibility className="w-3.5 h-3.5" />
                                                </div>
                                              ) : (
                                                <span className="text-slate-300 font-bold">-</span>
                                              )}
                                            </td>

                                            {/* Situação */}
                                            <td className="py-1.5 px-2.5 text-center align-middle">
                                              <span className={`inline-block text-[9.5px] font-black uppercase px-2 py-0.5 rounded-full ${
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
        {/* COLUNA DIREITA — VEÍCULOS E VIAGENS (42%) */}
        {/* --------------------------------------------------------------------- */}
        <div className={`w-full lg:w-[42%] flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden ${
          mobileTab === 'pacientes' ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Header da Coluna Direita */}
          <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#5433FF] text-white flex items-center justify-center font-black shadow-2xs">
                <Car className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                  VEÍCULOS E VIAGENS
                  {dataAlvo ? ` — ${destAlvo && destAlvo !== 'Destino não informado' ? `${destAlvo} (${dataAlvo.split('-').reverse().join('/')})` : dataAlvo.split('-').reverse().join('/')}` : ''}
                </h2>
                <p className="text-[10px] text-slate-500 font-bold leading-none mt-0.5">
                  {isDataPassada
                    ? 'Data no passado selecionada • Nenhuma viagem futura ou veículo livre disponível'
                    : dataAlvo
                    ? `${veiculosLaranja.length} ${veiculosLaranja.length === 1 ? 'viagem futura com vagas' : 'viagens futuras com vagas'} • ${veiculosVerdes.length} ${veiculosVerdes.length === 1 ? 'veículo livre' : 'veículos livres'}`
                    : 'Selecione uma data e um destino para consultar os veículos e viagens disponíveis'}
                </p>
              </div>
            </div>

            {/* Ação de Vincular Imediata quando houver pacientes selecionados */}
            {selectedDemandaIds.length > 0 && !isDataPassada && (
              <button
                type="button"
                onClick={handlePrepararVinculacao}
                className="px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-[11px] uppercase tracking-wider rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 animate-pulse"
                title={selectedViagemId ? "Vincular à viagem existente selecionada" : selectedVeiculoVerdeId ? "Criar nova viagem com o veículo livre selecionado e vincular" : "Selecione um veículo"}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>
                  {selectedVeiculoVerdeId 
                    ? `+ Criar Viagem (${selectedDemandaIds.length})` 
                    : `Vincular (${selectedDemandaIds.length})`}
                </span>
              </button>
            )}
          </div>

          {/* Lista de Veículos Elegíveis (Laranjas: viagens futuras no destino | Verdes: livres sem conflito) */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-2 custom-scrollbar">
            {veiculosElegiveis.length === 0 ? (
              <div className="py-16 text-center space-y-2.5 px-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto ${
                  isDataPassada ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {isDataPassada ? <AlertCircle className="w-5 h-5" /> : dataAlvo ? <Car className="w-5 h-5" /> : <CalendarDays className="w-5 h-5 text-indigo-500" />}
                </div>
                <h4 className="text-xs font-black text-slate-700 uppercase">
                  {isDataPassada
                    ? 'Data no passado selecionada'
                    : dataAlvo 
                    ? 'Nenhum veículo com vagas disponíveis para a data e o destino selecionados.' 
                    : 'Nenhuma data selecionada'}
                </h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  {isDataPassada
                    ? `A data ${dataAlvo.split('-').reverse().join('/')} já ocorreu. Não é possível vincular pacientes ou criar novas viagens em datas passadas.`
                    : dataAlvo 
                    ? 'Não foram encontradas viagens futuras com vagas para este destino ou veículos livres operacionais na data informada.'
                    : 'Selecione uma data e um destino nas demandas ao lado (ou utilize os filtros acima) para consultar os veículos e viagens disponíveis.'}
                </p>
                {onOpenNewTripModal && !isDataPassada && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => onOpenNewTripModal(dataAlvo || undefined, (destAlvo && destAlvo !== 'TODOS' && destAlvo !== 'Destino não informado') ? destAlvo : undefined)}
                      className="px-3 py-1.5 bg-[#5433FF] hover:bg-[#4628df] text-white font-extrabold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Nova Viagem</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              veiculosElegiveis.map((item) => {
                const isLaranja = item.tipo === 'laranja';
                const isSelected = isLaranja 
                  ? selectedViagemId === item.schedule?.id 
                  : selectedVeiculoVerdeId === item.vehicle.id;

                const categoriaVeic = item.vehicle.vehicleCategory || item.vehicle.type || 'Veículo';

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (isLaranja) {
                        setSelectedViagemId(item.schedule!.id);
                        setSelectedVeiculoVerdeId('');
                      } else {
                        setSelectedVeiculoVerdeId(item.vehicle.id);
                        setSelectedViagemId('');
                      }
                    }}
                    className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isLaranja
                        ? isSelected
                          ? 'border-amber-500 bg-amber-100/80 ring-2 ring-amber-500/25 shadow-xs'
                          : 'border-amber-300/80 bg-amber-50/60 hover:bg-amber-100/50 hover:border-amber-400 shadow-2xs'
                        : isSelected
                          ? 'border-emerald-500 bg-emerald-100/80 ring-2 ring-emerald-500/25 shadow-xs'
                          : 'border-emerald-300/80 bg-emerald-50/60 hover:bg-emerald-100/50 hover:border-emerald-400 shadow-2xs'
                    }`}
                  >
                    {/* Topo do Card: Badge de Identificação Obrigatória por Cores (Item 4) */}
                    <div className="flex items-center justify-between gap-2">
                      {isLaranja ? (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 border border-amber-300 text-amber-900 flex items-center gap-1 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                          VIAGEM PARA O DESTINO — VAGAS DISPONÍVEIS
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 border border-emerald-300 text-emerald-900 flex items-center gap-1 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          DISPONÍVEL — SEM DESTINO
                        </span>
                      )}

                      {/* Badge de Vagas / Capacidade */}
                      <div className={`px-2 py-0.5 rounded-lg flex items-center gap-1 border shadow-2xs ${
                        isLaranja
                          ? 'bg-amber-100 border-amber-300 text-amber-950'
                          : 'bg-emerald-100 border-emerald-300 text-emerald-950'
                      }`}>
                        <Accessibility className={`w-3.5 h-3.5 ${isLaranja ? 'text-amber-700' : 'text-emerald-700'}`} />
                        <div className="text-right leading-none">
                          <span className="text-[7.5px] font-black uppercase block opacity-80">
                            {isLaranja ? 'Vagas' : 'Lugares'}
                          </span>
                          <span className="text-xs font-black">{item.vagasLivres}</span>
                        </div>
                      </div>
                    </div>

                    {/* Conteúdo Central do Card */}
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Radio Button Customizado */}
                        <div className="shrink-0">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected 
                              ? isLaranja ? 'border-amber-600 bg-white' : 'border-emerald-600 bg-white'
                              : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && (
                              <div className={`w-2 h-2 rounded-full ${isLaranja ? 'bg-amber-600' : 'bg-emerald-600'}`} />
                            )}
                          </div>
                        </div>

                        {/* Ícone do Veículo */}
                        <div className={`w-10 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                          isLaranja 
                            ? 'bg-amber-100/80 border-amber-200 text-amber-800' 
                            : 'bg-emerald-100/80 border-emerald-200 text-emerald-800'
                        }`}>
                          <Car className="w-4 h-4" />
                        </div>

                        {/* Informações Principais */}
                        <div className="min-w-0">
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                            {categoriaVeic.toUpperCase()} — {item.vehicle.plate || 'SEM PLACA'}
                          </h3>
                          {isLaranja ? (
                            <>
                              <p className="text-[10.5px] text-slate-700 font-semibold truncate">
                                Motorista: <strong className="text-slate-900 font-bold">{item.driver?.name || 'Não informado'}</strong>
                              </p>
                              <div className="text-[9.5px] text-slate-600 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>Saída: <strong>{item.horarioSaida}</strong></span>
                                {item.horarioRetorno && <span>• Retorno: <strong>{item.horarioRetorno}</strong></span>}
                                <span>•</span>
                                <span>Destino: <strong>{item.destino}</strong></span>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-[10.5px] text-emerald-800 font-semibold truncate">
                                Veículo operacional livre • Sem conflitos de agenda na data
                              </p>
                              <div className="text-[9.5px] text-slate-600 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>Capacidade: <strong>{item.capacidadePassageiros} lugares</strong></span>
                                {item.driver && <span>• Motorista responsável: <strong>{item.driver.name}</strong></span>}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Métricas e Botão de Ação na Direita */}
                      <div className="shrink-0 flex items-center gap-2">
                        {isLaranja ? (
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="hidden sm:flex items-center gap-2 text-[9.5px] font-bold text-slate-600">
                              <span className="flex items-center gap-0.5">
                                <Armchair className="w-3 h-3 text-amber-600" /> <strong className="text-slate-900">{item.capacidadePassageiros}</strong> lug.
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="flex items-center gap-0.5">
                                <User className="w-3 h-3 text-amber-600" /> <strong className="text-slate-900">{item.ocupados}</strong> ocup.
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedViagemId(item.schedule!.id);
                                setSelectedVeiculoVerdeId('');
                                handlePrepararVinculacaoComViagem(item.schedule!, item.vehicle, item.driver, item.vagasLivres);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer"
                              title="Vincular pacientes selecionados a esta viagem existente"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>Vincular Pacientes</span>
                            </button>
                          </div>
                        ) : (
                          onOpenNewTripModal && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenNewTripModal(dataAlvo, (destAlvo && destAlvo !== 'Destino não informado') ? destAlvo : undefined, item.vehicle.id);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer"
                              title="Criar nova viagem com este veículo para o destino selecionado"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Criar Viagem</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
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
