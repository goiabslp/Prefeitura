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
  Phone, 
  X, 
  MapPin, 
  Building2, 
  User, 
  UserPlus, 
  UserMinus, 
  FileText, 
  RefreshCw, 
  Check, 
  Filter, 
  Sparkles, 
  Accessibility, 
  Users, 
  PhoneCall, 
  ChevronRight,
  ShieldAlert,
  CalendarDays,
  Send
} from 'lucide-react';
import { 
  TransporteDemanda, 
  TransporteStatus, 
  VehicleSchedule, 
  Vehicle, 
  Person, 
  Sector,
  ConsultaAgendamento
} from '../../../types';
import * as transporteDb from '../../../services/transporteService';
import { normalizeCity } from '../ConsultarVeiculoScreen';
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
  // 1. Estados de Dados e Filtros
  const [demandas, setDemandas] = useState<TransporteDemanda[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [filterDate, setFilterDate] = useState<string>('');
  const [filterDestino, setFilterDestino] = useState<string>('TODOS');
  const [filterStatus, setFilterStatus] = useState<TransporteStatus | 'TODOS'>('TODOS');
  const [filterTipoProc, setFilterTipoProc] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Seleção de pacientes para alocação em lote
  const [selectedDemandaIds, setSelectedDemandaIds] = useState<string[]>([]);

  // Modais
  const [manifestoModal, setManifestoModal] = useState<{
    isOpen: boolean;
    schedule: VehicleSchedule | null;
    vehicle?: Vehicle;
    driver?: Person;
  }>({ isOpen: false, schedule: null });

  const [contatoModal, setContatoModal] = useState<{
    isOpen: boolean;
    demanda: TransporteDemanda | null;
    meioContato: 'Telefone' | 'WhatsApp' | 'Pessoalmente' | 'Outro';
    resultado: 'Confirmado' | 'Ausente / Não atendeu' | 'Desistiu';
    observacao: string;
  }>({
    isOpen: false,
    demanda: null,
    meioContato: 'WhatsApp',
    resultado: 'Confirmado',
    observacao: ''
  });

  const [alocacaoRapidaDemanda, setAlocacaoRapidaDemanda] = useState<TransporteDemanda | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 2. Carregamento de Demandas
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await carregarDemandas();
  };

  // 3. Demandas Filtradas
  const demandasFiltradas = useMemo(() => {
    return demandas.filter(d => {
      // Filtro de Data
      if (filterDate && d.dataAtendimento !== filterDate) return false;

      // Filtro de Destino
      if (filterDestino !== 'TODOS') {
        const normFilter = normalizeCity(filterDestino);
        const normDemanda = normalizeCity(d.municipioDestino);
        if (!normDemanda.includes(normFilter) && !normFilter.includes(normDemanda)) {
          return false;
        }
      }

      // Filtro de Status
      if (filterStatus !== 'TODOS' && d.statusTransporte !== filterStatus) return false;

      // Filtro de Tipo de Procedimento
      if (filterTipoProc !== 'TODOS' && d.tipoProcedimento?.toUpperCase() !== filterTipoProc.toUpperCase()) return false;

      // Busca Textual (Nome, CPF, Procedimento)
      if (searchTerm.trim()) {
        const q = transporteDb.normalizeTransporteText(searchTerm);
        const cleanDigits = searchTerm.replace(/\D/g, '');
        const normNome = transporteDb.normalizeTransporteText(d.pacienteNome);
        const normCpf = (d.pacienteCpf || '').replace(/\D/g, '');
        const normProc = transporteDb.normalizeTransporteText(d.procedimentoNome);

        const match = normNome.includes(q) || (cleanDigits && normCpf.includes(cleanDigits)) || normProc.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [demandas, filterDate, filterDestino, filterStatus, filterTipoProc, searchTerm]);

  // Lista de Destinos Disponíveis para o Filtro Dropdown
  const destinosUnicos = useMemo(() => {
    const set = new Set<string>();
    demandas.forEach(d => {
      if (d.municipioDestino) set.add(d.municipioDestino);
    });
    return Array.from(set).sort();
  }, [demandas]);

  // 4. Indicadores Principais
  const indicadores = useMemo(() => {
    return transporteDb.calcularIndicadoresTransporte(demandas, vehicles, schedules, filterDate || undefined);
  }, [demandas, vehicles, schedules, filterDate]);

  // 5. Demandas Agrupadas por Data e Destino para a Área Esquerda
  const gruposEsquerda = useMemo(() => {
    return transporteDb.agruparDemandasInteligentes(demandasFiltradas);
  }, [demandasFiltradas]);

  // 6. Viagens Compatíveis com o Filtro (Área Direita)
  const viagensExibidas = useMemo(() => {
    return schedules.filter(v => {
      if (v.status === 'cancelado') return false;

      // Se há filtro de data, restringe
      if (filterDate && !v.departureDateTime.startsWith(filterDate)) return false;

      // Se há filtro de destino, restringe
      if (filterDestino !== 'TODOS') {
        const normFiltro = normalizeCity(filterDestino);
        const normViagem = normalizeCity(v.destination);
        if (!normViagem.includes(normFiltro) && !normFiltro.includes(normViagem)) {
          return false;
        }
      }

      return true;
    });
  }, [schedules, filterDate, filterDestino]);

  // 7. Ação de Alocação de Paciente
  const handleAlocarPaciente = async (demanda: TransporteDemanda, viagem: VehicleSchedule) => {
    const veiculo = vehicles.find(v => v.id === viagem.vehicleId);
    if (!veiculo) {
      showToast('Veículo da viagem não localizado.', 'error');
      return;
    }

    const res = await transporteDb.alocarPacienteEmViagem(demanda.id, viagem, veiculo, currentUserName);
    if (res.success) {
      showToast(`Paciente ${demanda.pacienteNome} alocado com sucesso!`, 'success');
      setAlocacaoRapidaDemanda(null);
      await carregarDemandas();
    } else {
      showToast(res.message || 'Erro ao alocar paciente.', 'error');
    }
  };

  // 8. Ação de Alocação em Lote
  const handleAlocarLote = async (viagem: VehicleSchedule) => {
    if (selectedDemandaIds.length === 0) return;
    const veiculo = vehicles.find(v => v.id === viagem.vehicleId);
    if (!veiculo) {
      showToast('Veículo não localizado.', 'error');
      return;
    }

    let sucessos = 0;
    for (const dId of selectedDemandaIds) {
      const d = demandas.find(x => x.id === dId);
      if (d) {
        const res = await transporteDb.alocarPacienteEmViagem(d.id, viagem, veiculo, currentUserName);
        if (res.success) sucessos++;
      }
    }

    setSelectedDemandaIds([]);
    await carregarDemandas();
    showToast(`${sucessos} paciente(s) alocado(s) na viagem!`, 'success');
  };

  // 9. Ação de Desalocar Paciente
  const handleDesalocarPaciente = async (demandaId: string, viagemId?: string) => {
    const viagem = schedules.find(v => v.id === viagemId);
    const res = await transporteDb.desalocarPacienteDeViagem(demandaId, viagem);
    if (res.success) {
      showToast('Vaga liberada com sucesso!', 'info');
      await carregarDemandas();
    } else {
      showToast('Erro ao liberar vaga.', 'error');
    }
  };

  // 10. Salvar Registro de Contato
  const handleSalvarContato = async () => {
    if (!contatoModal.demanda) return;

    try {
      const viagem = schedules.find(v => v.id === contatoModal.demanda?.viagemId);
      const res = await transporteDb.registrarContatoConfirmacao(
        contatoModal.demanda.id,
        {
          dataHora: new Date().toISOString(),
          usuarioId: currentUserId,
          usuarioNome: currentUserName,
          meioContato: contatoModal.meioContato,
          resultado: contatoModal.resultado,
          observacao: contatoModal.observacao
        },
        viagem
      );

      if (res.liberouVagas) {
        showToast('Paciente registrou desistência. Vagas liberadas no veículo!', 'info');
      } else {
        showToast('Contato registrado com sucesso!', 'success');
      }

      setContatoModal({
        isOpen: false,
        demanda: null,
        meioContato: 'WhatsApp',
        resultado: 'Confirmado',
        observacao: ''
      });
      await carregarDemandas();
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar contato.', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 animate-fade-in relative">
      
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
      {/* CABEÇALHO DA CENTRAL DE TRANSPORTE */}
      {/* ========================================================================= */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 md:w-11 md:h-11 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 shadow-xs transition-all active:scale-95 group shrink-0 cursor-pointer"
            title="Voltar ao Menu Principal"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xs">
                <UsersRound className="w-5 h-5" />
              </div>
              <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight leading-none">
                Central de Transporte de Pacientes
              </h2>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Demandas, Distribuição Inteligente de Vagas e Manifesto de Passageiros
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold active:scale-95"
            title="Sincronizar com a Regulação e Frotas"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>

          {onOpenNewTripModal && (
            <button
              type="button"
              onClick={() => onOpenNewTripModal(filterDate || undefined, filterDestino !== 'TODOS' ? filterDestino : undefined)}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-indigo-500/25 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Car className="w-4 h-4" />
              <span>+ Nova Viagem</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DASHBOARD: 7 INDICADORES CHAVE */}
      {/* ========================================================================= */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 md:px-6 py-3 shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          
          {/* 1. Total */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block truncate">
              Total Demandas
            </span>
            <span className="text-xl font-black text-slate-900 mt-0.5 block">
              {indicadores.totalDemandas}
            </span>
          </div>

          {/* 2. Aguardando Vaga */}
          <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-200/80 shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 block truncate">
              Aguardando Vaga
            </span>
            <span className="text-xl font-black text-amber-950 mt-0.5 block">
              {indicadores.aguardandoVaga}
            </span>
          </div>

          {/* 3. Alocados */}
          <div className="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-200/80 shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-800 block truncate">
              Alocados
            </span>
            <span className="text-xl font-black text-indigo-950 mt-0.5 block">
              {indicadores.alocados}
            </span>
          </div>

          {/* 4. Confirmados */}
          <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200/80 shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block truncate">
              Confirmados
            </span>
            <span className="text-xl font-black text-emerald-950 mt-0.5 block">
              {indicadores.confirmados}
            </span>
          </div>

          {/* 5. Aguardando Confirmação */}
          <div className="bg-orange-50/70 p-3 rounded-2xl border border-orange-200/80 shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-wider text-orange-800 block truncate">
              Aguard. Contato
            </span>
            <span className="text-xl font-black text-orange-950 mt-0.5 block">
              {indicadores.aguardandoConfirmacao}
            </span>
          </div>

          {/* 6. Vagas Disponíveis */}
          <div className="bg-cyan-50/70 p-3 rounded-2xl border border-cyan-200/80 shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-wider text-cyan-800 block truncate">
              Vagas Livres
            </span>
            <span className="text-xl font-black text-cyan-950 mt-0.5 block">
              {indicadores.vagasDisponiveis}
            </span>
          </div>

          {/* 7. Veículos Designados */}
          <div className="bg-purple-50/70 p-3 rounded-2xl border border-purple-200/80 shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-wider text-purple-800 block truncate">
              Veículos Escalados
            </span>
            <span className="text-xl font-black text-purple-950 mt-0.5 block">
              {indicadores.veiculosDesignados}
            </span>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* BARRA DE FILTROS */}
      {/* ========================================================================= */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Pesquisa Textual */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar por paciente, CPF ou procedimento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-semibold outline-none transition-all"
            />
          </div>

          {/* Filtro de Data */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
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
                className="text-[10px] font-black text-slate-400 hover:text-slate-600 px-1"
                title="Limpar filtro de data"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro de Destino */}
          <select
            value={filterDestino}
            onChange={(e) => setFilterDestino(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none cursor-pointer"
          >
            <option value="TODOS">Todos os Destinos</option>
            {destinosUnicos.map((dest, i) => (
              <option key={i} value={dest}>{dest}</option>
            ))}
          </select>

          {/* Filtro de Situação */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="TODOS">Todas as Situações</option>
            <option value="Aguardando vaga">Aguardando vaga</option>
            <option value="Alocado">Alocado</option>
            <option value="Aguardando confirmação">Aguardando confirmação</option>
            <option value="Confirmado">Confirmado</option>
            <option value="Desistiu">Desistiu</option>
            <option value="Cancelado">Cancelado</option>
          </select>

          {/* Filtro de Tipo de Procedimento */}
          <select
            value={filterTipoProc}
            onChange={(e) => setFilterTipoProc(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="TODOS">Todos os Tipos</option>
            <option value="Consulta">Consulta</option>
            <option value="Exame">Exame</option>
            <option value="Cirurgia">Cirurgia</option>
          </select>

          {/* Botão Limpar Filtros se algum estiver ativo */}
          {(filterDate || filterDestino !== 'TODOS' || filterStatus !== 'TODOS' || filterTipoProc !== 'TODOS' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setFilterDate('');
                setFilterDestino('TODOS');
                setFilterStatus('TODOS');
                setFilterTipoProc('TODOS');
                setSearchTerm('');
              }}
              className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 px-2 py-1 cursor-pointer"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INTERFACE SPLIT (DUAS ÁREAS: PACIENTES AGUARDANDO / VEÍCULOS E VAGAS) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 md:p-5 gap-4">
        
        {/* --------------------------------------------------------------------- */}
        {/* ÁREA ESQUERDA: PACIENTES AGUARDANDO VAGA E DEMANDAS */}
        {/* --------------------------------------------------------------------- */}
        <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header da Área Esquerda */}
          <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50/50 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-black">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight">
                  Pacientes & Demandas ({demandasFiltradas.length})
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">
                  Agrupamento por Data e Destino
                </p>
              </div>
            </div>

            {selectedDemandaIds.length > 0 && (
              <span className="text-[11px] font-black px-2.5 py-1 bg-indigo-100 text-indigo-900 rounded-lg">
                {selectedDemandaIds.length} selecionado(s)
              </span>
            )}
          </div>

          {/* Conteúdo com Scroll da Área Esquerda */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
            {gruposEsquerda.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <UsersRound className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-slate-700 uppercase">
                  Nenhuma Demanda Encontrada
                </h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Não foram encontradas solicitações com os filtros aplicados. Ao agendar uma consulta na Regulação e marcar a necessidade de transporte, ela aparecerá aqui.
                </p>
              </div>
            ) : (
              gruposEsquerda.map((grupo) => (
                <div 
                  key={grupo.key}
                  className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-4 space-y-3 shadow-2xs"
                >
                  {/* Cabeçalho do Grupo (Data + Destino) */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg font-black text-xs uppercase flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                        {new Date(grupo.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                      <span className="text-xs font-black text-slate-800 uppercase flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        {grupo.destino}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase">
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                        {grupo.totalPacientes} paciente(s)
                      </span>
                      {grupo.totalAcompanhantes > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900">
                          +{grupo.totalAcompanhantes} acomp.
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800">
                        Total {grupo.totalAssentosNecessarios} assento(s)
                      </span>
                    </div>
                  </div>

                  {/* Lista de Cards de Pacientes deste Grupo */}
                  <div className="space-y-2.5">
                    {grupo.demandas.map(demanda => {
                      const isSelected = selectedDemandaIds.includes(demanda.id);
                      const isAlocado = demanda.statusTransporte === 'Alocado' || demanda.statusTransporte === 'Confirmado';

                      return (
                        <div
                          key={demanda.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isSelected 
                              ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20' 
                              : isAlocado
                              ? 'bg-white border-emerald-200/80 hover:border-emerald-300'
                              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                              {/* Checkbox de Seleção */}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDemandaIds(prev => [...prev, demanda.id]);
                                  } else {
                                    setSelectedDemandaIds(prev => prev.filter(id => id !== demanda.id));
                                  }
                                }}
                                className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-xs font-black text-slate-900 uppercase truncate" title={demanda.pacienteNome}>
                                    {demanda.pacienteNome}
                                  </h4>
                                  
                                  {/* Badge de Status */}
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    demanda.statusTransporte === 'Confirmado'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : demanda.statusTransporte === 'Alocado'
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : demanda.statusTransporte === 'Aguardando confirmação'
                                      ? 'bg-orange-100 text-orange-800'
                                      : demanda.statusTransporte === 'Desistiu'
                                      ? 'bg-rose-100 text-rose-800'
                                      : demanda.statusTransporte === 'Cancelado'
                                      ? 'bg-slate-200 text-slate-700'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {demanda.statusTransporte}
                                  </span>

                                  {demanda.prioridade === 'Especial' && (
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 flex items-center gap-0.5">
                                      <Sparkles className="w-2.5 h-2.5" /> Especial
                                    </span>
                                  )}
                                </div>

                                {/* Procedimento e Horário */}
                                <div className="text-[11px] text-slate-600 font-medium mt-1 flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-800">{demanda.procedimentoNome}</span>
                                  <span className="text-slate-300">•</span>
                                  <span className="flex items-center gap-1 font-mono text-slate-700">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {demanda.horaAtendimento}
                                  </span>
                                  {demanda.estabelecimentoSaude && (
                                    <>
                                      <span className="text-slate-300">•</span>
                                      <span className="truncate max-w-[180px] text-slate-500 font-semibold" title={demanda.estabelecimentoSaude}>
                                        {demanda.estabelecimentoSaude}
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* Metadados Adicionais: Acompanhantes e Acessibilidade */}
                                <div className="flex items-center gap-2 mt-2 flex-wrap text-[10px] font-bold">
                                  {demanda.qtdAcompanhantes > 0 && (
                                    <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                                      <Users className="w-3 h-3" /> +{demanda.qtdAcompanhantes} Acompanhante(s)
                                    </span>
                                  )}
                                  {demanda.necessitaVeiculoAdaptado && (
                                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                      <Accessibility className="w-3 h-3" /> Adaptado / Cadeirante
                                    </span>
                                  )}
                                  {demanda.observacoes && (
                                    <span className="text-slate-400 font-normal italic truncate max-w-[240px]" title={demanda.observacoes}>
                                      Obs: {demanda.observacoes}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Botões de Ação do Card */}
                            <div className="flex flex-col gap-1.5 shrink-0">
                              {/* Botão de Contato / Confirmação */}
                              <button
                                type="button"
                                onClick={() => setContatoModal({
                                  isOpen: true,
                                  demanda,
                                  meioContato: 'WhatsApp',
                                  resultado: 'Confirmado',
                                  observacao: ''
                                })}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] uppercase flex items-center gap-1 cursor-pointer transition-colors"
                                title="Registrar contato com o paciente"
                              >
                                <PhoneCall className="w-3 h-3 text-slate-500" />
                                <span>Contato</span>
                              </button>

                              {/* Se já alocado, botão para desalocar */}
                              {demanda.viagemId ? (
                                <button
                                  type="button"
                                  onClick={() => handleDesalocarPaciente(demanda.id, demanda.viagemId)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] uppercase flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Remover paciente desta viagem"
                                >
                                  <UserMinus className="w-3 h-3" />
                                  <span>Desalocar</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setAlocacaoRapidaDemanda(demanda)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 transition-all"
                                  title="Designar para um veículo"
                                >
                                  <UserPlus className="w-3 h-3" />
                                  <span>Alocar Vaga</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* ÁREA DIREITA: VEÍCULOS E VAGAS PARA O DIA/DESTINO */}
        {/* --------------------------------------------------------------------- */}
        <div className="w-full lg:w-[48%] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header da Área Direita */}
          <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50/50 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-xs">
                <Car className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight">
                  Veículos & Lotação em Tempo Real ({viagensExibidas.length})
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">
                  Viagens Registradas para o Destino / Período
                </p>
              </div>
            </div>

            {selectedDemandaIds.length > 0 && (
              <span className="text-[10px] font-bold text-slate-500">
                Selecione um veículo abaixo para alocar os {selectedDemandaIds.length} paciente(s)
              </span>
            )}
          </div>

          {/* Conteúdo com Scroll da Área Direita */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {viagensExibidas.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Car className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-slate-700 uppercase">
                  Nenhum Veículo Escalado para este Filtro
                </h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Não há viagens cadastradas para a data ou destino selecionados. Crie uma nova viagem rápida para acomodar as demandas.
                </p>
                {onOpenNewTripModal && (
                  <button
                    type="button"
                    onClick={() => onOpenNewTripModal(filterDate || undefined, filterDestino !== 'TODOS' ? filterDestino : undefined)}
                    className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
                  >
                    + Criar Viagem para {filterDestino !== 'TODOS' ? filterDestino : 'este Destino'}
                  </button>
                )}
              </div>
            ) : (
              viagensExibidas.map((viagem) => {
                const veiculo = vehicles.find(v => v.id === viagem.vehicleId);
                const motorista = persons.find(p => p.id === viagem.driverId);
                const capacidadePassageiros = Math.max(1, (veiculo?.passengerCapacity || (veiculo as any)?.capacity || 5) - 1);
                const ocupados = (viagem.passengers || []).length;
                const vagasLivres = Math.max(0, capacidadePassageiros - ocupados);
                const percentualOcupacao = Math.min(100, Math.round((ocupados / capacidadePassageiros) * 100));

                const isLotado = vagasLivres === 0;

                return (
                  <div
                    key={viagem.id}
                    className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200/90 hover:border-indigo-300 transition-all bg-white shadow-2xs space-y-4"
                  >
                    {/* Topo do Veículo */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-900 text-white rounded-lg font-mono font-black text-xs">
                            <span className="text-[9px] text-amber-400">BR</span>
                            <span>{veiculo?.plate || (viagem as any).vehiclePlate || 'PLACA'}</span>
                          </div>
                          <span className="text-xs font-black text-slate-900 uppercase">
                            {veiculo ? `${veiculo.brand} ${veiculo.model}` : (viagem as any).vehicleModel || 'Veículo'}
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2">
                          <span className="flex items-center gap-1 text-rose-600 font-extrabold">
                            <MapPin className="w-3 h-3" /> {viagem.destination}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono text-slate-700">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(viagem.departureDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} até {new Date(viagem.returnDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Botão de Manifesto em PDF */}
                      <button
                        type="button"
                        onClick={() => setManifestoModal({ isOpen: true, schedule: viagem, vehicle: veiculo, driver: motorista })}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-black text-xs uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
                        title="Gerar Manifesto Oficial de Passageiros"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Manifesto PDF</span>
                      </button>
                    </div>

                    {/* Barra de Ocupação em Tempo Real */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                          Lotação: <strong className="text-slate-900">{ocupados}/{capacidadePassageiros} assentos</strong>
                        </span>
                        <span className={`font-black text-xs uppercase px-2 py-0.5 rounded-md ${
                          isLotado 
                            ? 'bg-rose-100 text-rose-900' 
                            : vagasLivres <= 2 
                            ? 'bg-amber-100 text-amber-900' 
                            : 'bg-emerald-100 text-emerald-900'
                        }`}>
                          {isLotado ? 'LOTADO' : `${vagasLivres} vaga(s) livre(s)`}
                        </span>
                      </div>

                      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 rounded-full ${
                            isLotado ? 'bg-rose-500' : vagasLivres <= 2 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percentualOcupacao}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                        <span>Motorista: <strong className="text-slate-700 uppercase">{motorista?.name || (viagem as any).driverName || 'A definir'}</strong></span>
                        <span>(+ 1 motorista não computado como passageiro)</span>
                      </div>
                    </div>

                    {/* Botão de Ação Rápida de Lote se houver selecionados */}
                    {selectedDemandaIds.length > 0 && !isLotado && (
                      <button
                        type="button"
                        onClick={() => handleAlocarLote(viagem)}
                        className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Alocar os {selectedDemandaIds.length} Selecionados neste Veículo</span>
                      </button>
                    )}

                    {/* Passageiros Já Alocados neste Veículo */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">
                        Passageiros Registrados na Tripulação ({ocupados}):
                      </span>

                      {ocupados === 0 ? (
                        <p className="text-xs text-slate-400 italic">Nenhum passageiro adicionado ainda.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                          {viagem.passengers?.map((pax, pIdx) => {
                            // Encontra a demanda correspondente para permitir desalocar diretamente
                            const dem = demandas.find(d => d.pacienteId === pax.patientId || d.pacienteNome === pax.name);

                            return (
                              <div
                                key={pax.id || pIdx}
                                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs hover:bg-slate-100 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                    pax.type === 'Paciente' ? 'bg-indigo-100 text-indigo-900' : 'bg-purple-100 text-purple-900'
                                  }`}>
                                    {pax.type || 'Paciente'}
                                  </span>
                                  <span className="font-bold text-slate-900 uppercase truncate max-w-[160px]" title={pax.name}>
                                    {pax.name}
                                  </span>
                                  {pax.appointmentTime && (
                                    <span className="text-[10px] font-mono text-slate-500">
                                      ({pax.appointmentTime})
                                    </span>
                                  )}
                                </div>

                                {dem && (
                                  <button
                                    type="button"
                                    onClick={() => handleDesalocarPaciente(dem.id, viagem.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Remover e liberar vaga"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR CONTATO / CONFIRMAÇÃO DE PRESENÇA */}
      {/* ========================================================================= */}
      {contatoModal.isOpen && contatoModal.demanda && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">
                    Registro de Contato & Presença
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold truncate max-w-[280px]">
                    {contatoModal.demanda.pacienteNome}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContatoModal(prev => ({ ...prev, isOpen: false, demanda: null }))}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Meio de Contato */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Meio de Contato:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['WhatsApp', 'Telefone', 'Pessoalmente', 'Outro'] as const).map(meio => (
                    <button
                      key={meio}
                      type="button"
                      onClick={() => setContatoModal(prev => ({ ...prev, meioContato: meio }))}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        contatoModal.meioContato === meio
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {meio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resultado do Contato */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Resultado do Contato:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setContatoModal(prev => ({ ...prev, resultado: 'Confirmado' }))}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      contatoModal.resultado === 'Confirmado'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmado</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContatoModal(prev => ({ ...prev, resultado: 'Ausente / Não atendeu' }))}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      contatoModal.resultado === 'Ausente / Não atendeu'
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                    }`}
                  >
                    <Clock3 className="w-4 h-4" />
                    <span>Não Atendeu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContatoModal(prev => ({ ...prev, resultado: 'Desistiu' }))}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      contatoModal.resultado === 'Desistiu'
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-800'
                    }`}
                  >
                    <X className="w-4 h-4" />
                    <span>Desistiu</span>
                  </button>
                </div>
              </div>

              {/* Aviso se Desistiu */}
              {contatoModal.resultado === 'Desistiu' && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    Ao confirmar a desistência, os assentos do paciente e acompanhantes serão <strong>liberados imediatamente</strong> no veículo. O agendamento da consulta na Regulação não será alterado.
                  </span>
                </div>
              )}

              {/* Observação */}
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Observações / Justificativa:
                </label>
                <textarea
                  rows={3}
                  value={contatoModal.observacao}
                  onChange={(e) => setContatoModal(prev => ({ ...prev, observacao: e.target.value }))}
                  placeholder="Ex: Paciente informou que irá por meios próprios / Confirmou embarque às 06h..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Histórico Anterior */}
              {contatoModal.demanda.historicoConfirmacao && contatoModal.demanda.historicoConfirmacao.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Histórico de Contatos Anteriores:
                  </span>
                  <div className="max-h-24 overflow-y-auto space-y-1 custom-scrollbar text-[10px]">
                    {contatoModal.demanda.historicoConfirmacao.map((c, idx) => (
                      <div key={idx} className="p-1.5 rounded-lg bg-slate-50 flex items-center justify-between text-slate-600">
                        <span>{new Date(c.dataHora).toLocaleString('pt-BR')} ({c.meioContato}): <strong>{c.resultado}</strong></span>
                        <span className="text-slate-400">{c.usuarioNome}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botões do Modal */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setContatoModal(prev => ({ ...prev, isOpen: false, demanda: null }))}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarContato}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-indigo-500/25 cursor-pointer active:scale-95 transition-all"
                >
                  Salvar Registro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SELEÇÃO RÁPIDA DE VEÍCULO PARA ALOCAÇÃO */}
      {/* ========================================================================= */}
      {alocacaoRapidaDemanda && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">
                    Alocar Paciente em Veículo
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold truncate max-w-[280px]">
                    {alocacaoRapidaDemanda.pacienteNome} • Destino: {alocacaoRapidaDemanda.municipioDestino}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAlocacaoRapidaDemanda(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                Selecione o Veículo Disponível para a Data ({new Date(alocacaoRapidaDemanda.dataAtendimento + 'T12:00:00').toLocaleDateString('pt-BR')}):
              </span>

              {/* Lista de Viagens do Mesmo Destino / Data */}
              <div className="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar">
                {schedules
                  .filter(v => v.departureDateTime.startsWith(alocacaoRapidaDemanda.dataAtendimento) && v.status !== 'cancelado')
                  .map(viagem => {
                    const veic = vehicles.find(v => v.id === viagem.vehicleId);
                    const cap = Math.max(1, (veic?.passengerCapacity || (veic as any)?.capacity || 5) - 1);
                    const ocupados = (viagem.passengers || []).length;
                    const livres = Math.max(0, cap - ocupados);

                    const assentosNecessarios = 1 + (alocacaoRapidaDemanda.qtdAcompanhantes || 0);
                    const temEspaco = livres >= assentosNecessarios;

                    return (
                      <button
                        key={viagem.id}
                        type="button"
                        disabled={!temEspaco}
                        onClick={() => handleAlocarPaciente(alocacaoRapidaDemanda, viagem)}
                        className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all ${
                          temEspaco 
                            ? 'bg-white hover:bg-indigo-50/70 border-slate-200 hover:border-indigo-400 shadow-2xs cursor-pointer active:scale-98' 
                            : 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-slate-900 text-white">
                              {veic?.plate || (viagem as any).vehiclePlate || 'PLACA'}
                            </span>
                            <span className="font-black text-xs uppercase text-slate-900">
                              {veic ? `${veic.brand} ${veic.model}` : (viagem as any).vehicleModel}
                            </span>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-500 mt-1">
                            Destino: <strong className="text-slate-800">{viagem.destination}</strong> • Horário: {new Date(viagem.departureDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-xs font-black block ${temEspaco ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {livres} vaga(s) livre(s)
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            Precisa: {assentosNecessarios}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {schedules.filter(v => v.departureDateTime.startsWith(alocacaoRapidaDemanda.dataAtendimento) && v.status !== 'cancelado').length === 0 && (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  Nenhum veículo escalado para esta data ainda.
                </div>
              )}

              <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAlocacaoRapidaDemanda(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MANIFESTO OFICIAL DE PASSAGEIROS EM PDF */}
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
