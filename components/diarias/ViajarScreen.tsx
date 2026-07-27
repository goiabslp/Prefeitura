import React, { useState, useEffect, useRef } from 'react';
import { 
  Car, MapPin, Calendar, Clock, Play, Square, Timer, ArrowLeft, 
  ChevronRight, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw,
  FileText, History, Info, Sparkles, Camera, Upload, Trash2, Paperclip,
  DollarSign, ExternalLink, Image as ImageIcon, X, Loader2, Plus, Receipt, Lock, ChevronDown
} from 'lucide-react';
import { DiariaEvento, User, Attachment } from '../../types';
import { getAllDiariaEventos, updateDiariaEvento } from '../../services/diariasEventosService';
import { uploadFile } from '../../services/storageService';
import { getDiariasDespesasEnabled } from '../../services/diariasSettingsService';

interface ViajarScreenProps {
  currentUser: User;
  onBack: () => void;
}

export const ViajarScreen: React.FC<ViajarScreenProps> = ({ currentUser, onBack }) => {
  const [eventos, setEventos] = useState<DiariaEvento[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Controle de rota da viagem selecionada (duas páginas com rota URL)
  const [selectedEventoId, setSelectedEventoId] = useState<string | null>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('id');
    } catch {
      return null;
    }
  });

  // Normalizador de texto
  const normalizeText = (text: string) =>
    text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";

  const isPersonMatch = (p: { id: string; name: string }, user: User) => {
    if (!p || !user) return false;
    if (p.id === user.id) return true;
    if (p.name && user.name && normalizeText(p.name) === normalizeText(user.name)) return true;
    return false;
  };

  // Carrega as viagens do Supabase
  const loadViagens = async (showIndicator = true) => {
    if (showIndicator) setLoading(true);
    try {
      const allEvents = await getAllDiariaEventos();
      const minhasViagens = allEvents.filter(evt => {
        if (!evt.pessoas || !Array.isArray(evt.pessoas)) return false;
        return evt.pessoas.some(p => isPersonMatch(p, currentUser));
      });
      setEventos(minhasViagens);
    } catch (error) {
      console.error('Erro ao buscar viagens:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Estado para expandir/minimizar detalhes superiores da viagem
  const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(false);

  // Estado para controlar a exibição da seção de comprovantes de despesas (oculto por padrão)
  const [isDespesasEnabled, setIsDespesasEnabled] = useState<boolean>(false);
  const [despesasStateTick, setDespesasStateTick] = useState<number>(0);

  useEffect(() => {
    const loadDespesasSetting = async () => {
      const enabled = await getDiariasDespesasEnabled();
      setIsDespesasEnabled(enabled);
    };
    loadDespesasSetting();
    loadViagens(false);

    const handleSettingsChange = () => {
      setDespesasStateTick(prev => prev + 1);
      loadDespesasSetting();
      loadViagens(false);
    };
    window.addEventListener('diarias_settings_changed', handleSettingsChange);
    return () => window.removeEventListener('diarias_settings_changed', handleSettingsChange);
  }, [currentUser]);

  useEffect(() => {
    loadViagens();
  }, [currentUser]);

  // Estados para Upload de Comprovante de Despesa
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [expenseType, setExpenseType] = useState<string>('Combustível');
  const [expenseValue, setExpenseValue] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Controle do cronômetro em tempo real
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Modal de sucesso ao finalizar
  const [summaryModal, setSummaryModal] = useState<{
    isOpen: boolean;
    saidaReal: string;
    retornoReal: string;
    duracaoText: string;
  } | null>(null);

  // Re-avaliar horários periodicamente
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(tick);
  }, []);

  // Escutar eventos de navegação da URL (botão voltar/avançar do navegador)
  useEffect(() => {
    const handlePopState = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        setSelectedEventoId(id);
      } catch {
        setSelectedEventoId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToDetail = (id: string) => {
    setSelectedEventoId(id);
    window.history.pushState({}, '', `/Diarias/Viajar/Detalhes?id=${id}`);
  };

  const navigateToList = () => {
    setSelectedEventoId(null);
    window.history.pushState({}, '', '/Diarias/Viajar');
  };

  const handleHeaderBack = () => {
    if (activeTrip) {
      alert('Você possui uma viagem em andamento. É necessário finalizar a viagem para acessar outras áreas do módulo de diárias.');
      return;
    }
    if (selectedEventoId) {
      navigateToList();
    } else {
      onBack();
    }
  };

  // Regra para liberação de início de viagem
  const canIniciarViagem = (evento: DiariaEvento): { allowed: boolean; liberadoEm?: string; reason?: string } => {
    if (!evento.data_saida) return { allowed: true };
    if (evento.status === 'cancelado' || evento.status === 'viagem_cancelada') {
      return { allowed: false, reason: 'Esta viagem foi cancelada por ultrapassar o prazo limite de 02:00h após o horário previsto de saída.' };
    }
    try {
      const dataSaida = new Date(evento.data_saida);
      const agora = new Date();

      // Bloqueio se passar de 2 horas do horário previsto de saída
      const duasHorasDepois = new Date(dataSaida.getTime() + 2 * 60 * 60 * 1000);
      if (agora.getTime() > duasHorasDepois.getTime()) {
        return { 
          allowed: false, 
          reason: 'O prazo limite de 02:00h após o horário previsto de saída expirou. A viagem foi cancelada.' 
        };
      }

      const mesmoDia =
        dataSaida.getFullYear() === agora.getFullYear() &&
        dataSaida.getMonth() === agora.getMonth() &&
        dataSaida.getDate() === agora.getDate();

      if (!mesmoDia) {
        const liberacao = new Date(dataSaida.getTime() - 60 * 60 * 1000);
        const liberadoEm = liberacao.toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        return { allowed: false, liberadoEm };
      }

      const umHoraAntes = dataSaida.getTime() - 60 * 60 * 1000;
      if (agora.getTime() < umHoraAntes) {
        const liberacao = new Date(umHoraAntes);
        const liberadoEm = liberacao.toLocaleString('pt-BR', {
          hour: '2-digit', minute: '2-digit'
        });
        return { allowed: false, liberadoEm: `hoje às ${liberadoEm}` };
      }

      return { allowed: true };
    } catch {
      return { allowed: true };
    }
  };

  const getPessoaViagemData = (evt: DiariaEvento) => {
    const p = evt.pessoas?.find(x => isPersonMatch(x, currentUser)) as any;
    return {
      viagem_inicio: p?.viagem_inicio as string | undefined,
      viagem_fim: p?.viagem_fim as string | undefined,
    };
  };

  const DATA_RETORNO_SENTINELA = '2099-12-31';

  // Separa viagens ativas do fluxo Viajar e histórico
  const viagensAtivas = eventos.filter(evt => {
    const data = getPessoaViagemData(evt);
    if (data.viagem_fim) return false;
    const isViajarFlow = evt.status === 'viagem_programada' || 
                         evt.status === 'em_viagem' || 
                         (evt.data_retorno && evt.data_retorno.startsWith(DATA_RETORNO_SENTINELA));
    return isViajarFlow;
  });

  const viagensHistorico = eventos.filter(evt => {
    const data = getPessoaViagemData(evt);
    return !!data.viagem_fim;
  });

  // Procura por viagem ativa em andamento para o usuário logado
  const activeTrip = eventos.find(evt => {
    const data = getPessoaViagemData(evt);
    return data.viagem_inicio && !data.viagem_fim;
  });

  // Trava de navegação: se houver viagem em andamento, obriga a abrir a página da viagem em andamento
  useEffect(() => {
    if (activeTrip && selectedEventoId !== activeTrip.id) {
      setSelectedEventoId(activeTrip.id);
      window.history.pushState({}, '', `/Diarias/Viajar/Detalhes?id=${activeTrip.id}`);
    }
  }, [activeTrip, selectedEventoId]);

  const selectedEvento = eventos.find(e => e.id === selectedEventoId) || null;

  // Cronômetro para o evento selecionado
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (selectedEvento) {
      const data = getPessoaViagemData(selectedEvento);
      if (data.viagem_inicio && !data.viagem_fim) {
        const startTime = new Date(data.viagem_inicio).getTime();

        const updateTimer = () => {
          const now = Date.now();
          const diffMs = now - startTime;
          if (diffMs < 0) {
            setElapsedTime('00:00:00');
            return;
          }
          const totalSecs = Math.floor(diffMs / 1000);
          const hrs = Math.floor(totalSecs / 3600);
          const mins = Math.floor((totalSecs % 3600) / 60);
          const secs = totalSecs % 60;
          setElapsedTime(
            `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
          );
        };

        updateTimer();
        timerRef.current = setInterval(updateTimer, 1000);
      } else {
        setElapsedTime('00:00:00');
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [selectedEvento, eventos]);

  // Ação de Iniciar Viagem
  const handleIniciarViagem = async (evento: DiariaEvento) => {
    try {
      setRefreshing(true);
      const inicioIso = new Date().toISOString();
      const updatedPessoas = evento.pessoas.map(p => {
        if (isPersonMatch(p, currentUser)) {
          return {
            ...p,
            viagem_inicio: inicioIso
          };
        }
        return p;
      }) as any;

      const updated = await updateDiariaEvento(evento.id, {
        pessoas: updatedPessoas,
        data_saida: inicioIso,
        status: 'em_viagem'
      });
      
      setEventos(prev => prev.map(e => e.id === evento.id ? updated : e));
    } catch (err) {
      console.error('Erro ao iniciar viagem:', err);
      alert('Falha ao iniciar viagem. Tente novamente.');
    } finally {
      setRefreshing(false);
    }
  };

  // Ação de Finalizar Viagem
  const handleFinalizarViagem = async (evento: DiariaEvento) => {
    try {
      setRefreshing(true);
      const fimIso = new Date().toISOString();
      const data = getPessoaViagemData(evento);
      const inicio = data.viagem_inicio || new Date().toISOString();

      const updatedPessoas = evento.pessoas.map(p => {
        if (isPersonMatch(p, currentUser)) {
          return {
            ...p,
            viagem_fim: fimIso
          };
        }
        return p;
      }) as any;

      const updated = await updateDiariaEvento(evento.id, {
        pessoas: updatedPessoas,
        data_retorno: fimIso,
        status: 'aguardando_gestor'
      });

      const diffMs = new Date(fimIso).getTime() - new Date(inicio).getTime();
      const totalSecs = Math.floor(diffMs / 1000);
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      
      let duracaoText = '';
      if (hrs > 0) duracaoText += `${hrs} ${hrs === 1 ? 'hora' : 'horas'}`;
      if (mins > 0) {
        if (duracaoText) duracaoText += ' e ';
        duracaoText += `${mins} ${mins === 1 ? 'minuto' : 'minutos'}`;
      }
      if (!duracaoText) duracaoText = 'Menos de um minuto';

      setSummaryModal({
        isOpen: true,
        saidaReal: new Date(inicio).toLocaleString('pt-BR'),
        retornoReal: new Date(fimIso).toLocaleString('pt-BR'),
        duracaoText
      });

      setEventos(prev => prev.map(e => e.id === evento.id ? updated : e));
    } catch (err) {
      console.error('Erro ao finalizar viagem:', err);
      alert('Falha ao finalizar viagem. Tente novamente.');
    } finally {
      setRefreshing(false);
    }
  };

  // Upload de Comprovante de Despesa (Foto ou Arquivo)
  const handleComprovanteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEvento) return;
    setIsUploading(true);

    try {
      const publicUrl = await uploadFile(
        file, 
        'attachments', 
        `comprovante_diaria_${selectedEvento.id}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      );

      if (publicUrl) {
        const newAttachment: Attachment = {
          id: Date.now().toString(),
          name: file.name,
          url: publicUrl,
          type: file.type,
          date: new Date().toISOString(),
          expenseType: expenseType,
          expenseValue: expenseValue.trim() ? expenseValue.trim() : undefined
        };

        const existingList: Attachment[] = selectedEvento.comprovantes_gestor || [];
        const updatedList = [...existingList, newAttachment];

        const updated = await updateDiariaEvento(selectedEvento.id, {
          comprovantes_gestor: updatedList
        });

        setEventos(prev => prev.map(evt => evt.id === selectedEvento.id ? updated : evt));
        setExpenseValue('');
      }
    } catch (err) {
      console.error('Erro ao enviar comprovante:', err);
      alert('Falha ao enviar o comprovante de despesa.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleDeleteComprovante = async (comprovanteId: string) => {
    if (!selectedEvento) return;
    if (!confirm('Deseja realmente remover este comprovante de despesa?')) return;

    try {
      const existingList: Attachment[] = selectedEvento.comprovantes_gestor || [];
      const updatedList = existingList.filter(c => c.id !== comprovanteId);

      const updated = await updateDiariaEvento(selectedEvento.id, {
        comprovantes_gestor: updatedList
      });

      setEventos(prev => prev.map(evt => evt.id === selectedEvento.id ? updated : evt));
    } catch (err) {
      console.error('Erro ao remover comprovante:', err);
      alert('Falha ao remover o comprovante.');
    }
  };

  const handleToggleAdminDespesasFinalizadas = async (evento: DiariaEvento) => {
    try {
      const nextVal = !evento.permitir_despesas_pos_finalizacao;
      const updated = await updateDiariaEvento(evento.id, {
        permitir_despesas_pos_finalizacao: nextVal
      });
      setEventos(prev => prev.map(e => e.id === evento.id ? updated : e));
    } catch (err) {
      console.error('Erro ao atualizar permissao de despesas:', err);
      alert('Falha ao atualizar permissão de despesas.');
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '---';
    if (dateStr.startsWith(DATA_RETORNO_SENTINELA)) return 'A definir';
    return new Date(dateStr).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 w-full relative font-sans">
      {/* Header Fixo */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-4 md:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <button
          onClick={handleHeaderBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold transition-all text-xs md:text-sm active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>Voltar</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider">
            {selectedEventoId ? 'Detalhes da Viagem' : 'Painel de Viagens'}
          </span>
        </div>
        <button
          onClick={() => loadViagens(false)}
          disabled={loading || refreshing}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition-all"
          title="Atualizar Viagens"
        >
          <RefreshCw className={`w-4 h-4 ${(loading || refreshing) ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-6 overflow-y-auto">
        
        {/* ======================================================== */}
        {/* PÁGINA 1: APENAS LISTA DAS VIAGENS (quando nenhum id selecionado) */}
        {/* ======================================================== */}
        {!selectedEvento ? (
          <div className="space-y-6 w-full animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 md:p-6 w-full overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Car className="w-5 h-5 text-emerald-500" />
                  <span>Viagens Agendadas</span>
                </h2>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                  {viagensAtivas.length} {viagensAtivas.length === 1 ? 'viagem' : 'viagens'}
                </span>
              </div>
              
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <RefreshCw className="w-7 h-7 animate-spin mb-2 text-emerald-500" />
                  <span className="font-bold text-xs">Carregando suas viagens...</span>
                </div>
              ) : viagensAtivas.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-600 font-bold text-sm">Nenhuma viagem pendente.</p>
                  <p className="text-slate-400 text-xs mt-1">Viagens programadas para você sem data de retorno prévia aparecerão aqui.</p>
                </div>
              ) : (
                <div className="grid gap-3 w-full">
                  {viagensAtivas.map((evt) => {
                    const data = getPessoaViagemData(evt);
                    const isStarted = !!data.viagem_inicio;
                    
                    return (
                      <div 
                        key={evt.id}
                        onClick={() => navigateToDetail(evt.id)}
                        className="w-full p-4 rounded-2xl border border-slate-200/90 hover:border-emerald-500 hover:shadow-md bg-white transition-all duration-200 cursor-pointer flex flex-col gap-3 overflow-hidden"
                      >
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="font-black text-slate-900 text-sm md:text-base truncate">{evt.destino}</span>
                          </div>
                          {isStarted ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse shrink-0">
                              Em Percurso
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                              Pronta para Iniciar
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 text-xs font-semibold">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Saída: {formatDate(evt.data_saida)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Retorno: {formatDate(evt.data_retorno)}
                          </span>
                        </div>

                        {/* MOTIVO FORMATADO E TRUNCADO PARA NÃO VAZAR O CARD */}
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 w-full overflow-hidden">
                          <p className="text-slate-600 text-xs font-medium w-full break-words line-clamp-2 overflow-hidden">
                            <strong className="text-slate-700">Motivo:</strong> {evt.motivo}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 w-full">
                          {evt.veiculo ? (
                            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700 text-xs font-bold border border-slate-200 truncate max-w-[240px]">
                              <Car className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="truncate">{evt.veiculo}</span>
                            </div>
                          ) : <div />}

                          <div className="flex items-center gap-1 text-xs font-extrabold text-indigo-600 hover:text-indigo-700 shrink-0">
                            <span>Abrir Detalhes</span>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Histórico Concluído */}
            {!loading && viagensHistorico.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 md:p-6 w-full overflow-hidden">
                <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  <span>Viagens Concluídas Recentemente</span>
                </h2>
                
                <div className="grid gap-2.5 w-full">
                  {viagensHistorico.slice(0, 4).map((evt) => {
                    const data = getPessoaViagemData(evt);
                    return (
                      <div key={evt.id} className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs w-full overflow-hidden">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-800 truncate">{evt.destino}</div>
                          <div className="text-slate-400 text-[10px] truncate mt-0.5">
                            Percurso: {data.viagem_inicio ? formatDate(data.viagem_inicio) : '---'} até {data.viagem_fim ? formatDate(data.viagem_fim) : '---'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-600 font-black bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 shrink-0 text-[10px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Concluída</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ======================================================== */
          /* PÁGINA 2: DETALHES DA VIAGEM SELECIONADA (Rota URL) */
          /* ======================================================== */
          (() => {
            const data = getPessoaViagemData(selectedEvento);
            const isStarted = !!data.viagem_inicio;
            const isFinished = !!data.viagem_fim;
            const check = canIniciarViagem(selectedEvento);
            const comprovantesList: Attachment[] = selectedEvento.comprovantes_gestor || [];

            return (
              <div className="space-y-6 w-full animate-slide-up">
                
                {/* Card de Resumo da Viagem (Minimizado por padrão conforme solicitado) */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md p-5 relative overflow-hidden w-full transition-all">
                  <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 to-indigo-600"></div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Destino Selecionado</span>
                      <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight break-words leading-snug">{selectedEvento.destino}</h2>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isFinished ? (
                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span>Finalizada</span>
                        </span>
                      ) : isStarted ? (
                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 animate-pulse">
                          <Timer className="w-4 h-4 text-emerald-600" />
                          <span>Em Percurso</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                          Aguardando Início
                        </span>
                      )}

                      {/* Botão de Toggle Expandir/Minimizar */}
                      <button
                        type="button"
                        onClick={() => setIsDetailsExpanded(prev => !prev)}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all flex items-center gap-1 text-xs font-bold border border-slate-200/80"
                        title={isDetailsExpanded ? 'Recolher Detalhes' : 'Expandir Detalhes'}
                      >
                        <span className="text-[10px] text-slate-500 uppercase hidden sm:inline">
                          {isDetailsExpanded ? 'Recolher' : 'Detalhes'}
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDetailsExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Informações detalhadas (exibidas somente se expandido) */}
                  {isDetailsExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-150 space-y-4 animate-fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs font-semibold text-slate-700">
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold uppercase block">Saída Prevista</span>
                          <p className="text-slate-900 font-black mt-0.5">{formatDate(selectedEvento.data_saida)}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold uppercase block">Retorno Previsto</span>
                          <p className="text-slate-900 font-black mt-0.5">{formatDate(selectedEvento.data_retorno)}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold uppercase block">Veículo Alocado</span>
                          <p className="text-slate-900 font-black mt-0.5">{selectedEvento.veiculo || 'Não informado'}</p>
                        </div>
                      </div>

                      {/* MOTIVO COMPLETO */}
                      <div className="space-y-1 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/70 w-full overflow-hidden">
                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider block">Motivo da Viagem</span>
                        <p className="text-slate-800 text-xs font-medium leading-relaxed break-words">
                          {selectedEvento.motivo}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ======================================================== */}
                {/* PAINEL DE CONTROLE DE VIAGEM (Botões dinâmicos) */}
                {/* ======================================================== */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md p-6 md:p-8 flex flex-col items-center justify-center text-center w-full">
                  
                  {/* ESTADO 1: ANTES DE INICIAR (Tem APENAS o Botão INICIAR) */}
                  {!isStarted && !isFinished && (
                    <div className="flex flex-col items-center gap-4 w-full py-4">
                      <p className="text-slate-500 text-xs md:text-sm font-semibold max-w-sm">
                        Para começar o registro da viagem e contar o tempo em tempo real, clique no botão de início abaixo.
                      </p>

                      <button
                        onClick={() => check.allowed && handleIniciarViagem(selectedEvento)}
                        disabled={refreshing || !check.allowed}
                        className={`w-36 h-36 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all duration-300 border-[6px] border-white group/btn relative ${
                          check.allowed
                            ? 'bg-emerald-600 hover:bg-emerald-700 hover:scale-105 active:scale-95 shadow-emerald-600/40 cursor-pointer'
                            : 'bg-slate-400 shadow-slate-400/30 cursor-not-allowed opacity-70'
                        }`}
                      >
                        {check.allowed && (
                          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping group-hover/btn:animate-none -z-10"></div>
                        )}
                        <Play className="w-10 h-10 fill-white text-white group-hover/btn:scale-110 transition-transform mb-1 ml-1" />
                        <span className="font-black text-sm uppercase tracking-wider">INICIAR</span>
                      </button>

                      {!check.allowed && (
                        <div className={`max-w-xs rounded-2xl px-4 py-3 text-center shadow-xs border ${
                          check.reason ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
                        }`}>
                          <div className={`flex items-center justify-center gap-1.5 font-black text-[10px] uppercase tracking-wider mb-1 ${
                            check.reason ? 'text-rose-700' : 'text-amber-700'
                          }`}>
                            {check.reason ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            <span>{check.reason ? 'Viagem Cancelada' : 'Início Bloqueado'}</span>
                          </div>
                          <p className={`text-xs font-semibold ${check.reason ? 'text-rose-800' : 'text-amber-800'}`}>
                            {check.reason ? (
                              check.reason
                            ) : (
                              <>Disponível a partir de: <strong className="text-amber-900 font-black">{check.liberadoEm}</strong></>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ESTADO 2: EM PERCURSO (Exibe o indicador "EM PERCURSO" e botão de FINALIZAR) */}
                  {isStarted && !isFinished && (
                    <div className="flex flex-col items-center gap-6 w-full py-2">
                      <div className="w-full max-w-sm flex flex-col items-center bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-inner">
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1.5 animate-pulse">
                          <Timer className="w-4 h-4" />
                          <span>EM PERCURSO</span>
                        </span>
                        <div className="font-mono text-4xl font-black text-slate-800 select-none tracking-wider my-1">
                          {elapsedTime}
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Saída registrada em: {formatDate(data.viagem_inicio)}
                        </span>
                      </div>

                      {/* Botão de Finalizar */}
                      <button
                        onClick={() => handleFinalizarViagem(selectedEvento)}
                        disabled={refreshing}
                        className="w-36 h-36 bg-rose-600 hover:bg-rose-700 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 shadow-rose-600/40 cursor-pointer border-[6px] border-white group/btn"
                      >
                        <Square className="w-10 h-10 fill-white text-white group-hover/btn:scale-110 transition-transform mb-1" />
                        <span className="font-black text-sm uppercase tracking-wider">FINALIZAR</span>
                      </button>
                    </div>
                  )}

                  {/* ESTADO 3: CONCLUÍDO */}
                  {isFinished && (
                    <div className="py-4 text-center space-y-2">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                      <h3 className="text-lg font-black text-slate-900">Viagem Concluída</h3>
                      <p className="text-slate-500 text-xs max-w-xs mx-auto">
                        Esta viagem já teve seu percurso finalizado e os horários reais salvos no sistema.
                      </p>
                    </div>
                  )}

                </div>

                {/* ======================================================== */}
                {/* SEÇÃO DE COMPROVANTES DE DESPESAS (Exibida se ativada pelo Admin em Lançamentos) */}
                {/* ======================================================== */}
                {Boolean(
                  selectedEvento && (
                    selectedEvento.permitir_despesas_pos_finalizacao ||
                    isDespesasEnabled ||
                    (() => {
                      try {
                        const stored = localStorage.getItem('diarias_despesas_events_map');
                        if (stored) {
                          const map = JSON.parse(stored);
                          return map[String(selectedEvento.id)] === true || map[selectedEvento.id] === true;
                        }
                      } catch {}
                      return false;
                    })()
                  )
                ) && (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md p-6 md:p-8 w-full space-y-6 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-150 pb-4">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-indigo-600" />
                        <span>Comprovantes de Despesas</span>
                      </h3>
                      <p className="text-slate-500 text-xs font-medium mt-0.5">
                        Anexe fotos ou recibos de combustível, alimentação e despesas da viagem.
                      </p>
                    </div>
                    <span className="text-xs font-extrabold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
                      {comprovantesList.length} {comprovantesList.length === 1 ? 'anexo' : 'anexos'}
                    </span>
                  </div>

                  {/* Inputs ocultos de arquivo e câmera */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleComprovanteUpload}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleComprovanteUpload}
                    className="hidden"
                  />

                  {/* Formulário de Seleção de Tipo e Valor */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                          Tipo de Despesa
                        </label>
                        <select
                          value={expenseType}
                          onChange={(e) => setExpenseType(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all"
                        >
                          <option value="Combustível">Combustível</option>
                          <option value="Alimentação">Alimentação</option>
                          <option value="Hospedagem">Hospedagem</option>
                          <option value="Pedágio">Pedágio</option>
                          <option value="Manutenção">Manutenção / Reparo</option>
                          <option value="Outros">Outros</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                          Valor da Despesa (Opcional)
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-xs font-bold text-slate-400">R$</span>
                          <input
                            type="text"
                            placeholder="0,00"
                            value={expenseValue}
                            onChange={(e) => setExpenseValue(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ação para Foto / Upload */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50"
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        <span>Tirar Foto do Recibo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50"
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span>Anexar Arquivo / PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* Lista de Comprovantes Anexados */}
                  {comprovantesList.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-medium">
                      Nenhum comprovante anexado até o momento.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {comprovantesList.map((comp) => (
                        <div key={comp.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <Paperclip className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span className="truncate">{comp.expenseType || 'Comprovante'}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                              {comp.name} {comp.expenseValue ? `• R$ ${comp.expenseValue}` : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={comp.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Visualizar"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteComprovante(comp.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
                )}

              </div>
            );
          })()
        )}

      </main>

      {/* Modal Resumo e Finalização */}
      {summaryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-center p-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-[5px] border-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            
            <div>
              <h4 className="text-xl font-black text-slate-900">Viagem Concluída!</h4>
              <p className="text-slate-500 text-xs font-semibold mt-1">Seus horários reais foram salvos com sucesso.</p>
            </div>
            
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 text-left text-xs space-y-3 font-semibold text-slate-600">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-400">SAÍDA REAL:</span>
                <span className="text-slate-900 font-bold">{summaryModal.saidaReal}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-400">RETORNO REAL:</span>
                <span className="text-slate-900 font-bold">{summaryModal.retornoReal}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-400">DURAÇÃO TOTAL:</span>
                <span className="text-emerald-600 font-extrabold">{summaryModal.duracaoText}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setSummaryModal(null);
                navigateToList();
              }}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg text-xs md:text-sm"
            >
              OK, Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
