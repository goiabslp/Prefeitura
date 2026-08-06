import React, { useState, useEffect, useRef } from 'react';
import { 
  Car, MapPin, Calendar, Clock, Play, Square, Timer, ArrowLeft, 
  ChevronRight, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw,
  FileText, History, Info, Sparkles, Camera, Upload, Trash2, Paperclip,
  DollarSign, ExternalLink, Image as ImageIcon, X, Loader2, Plus, Receipt, Lock, ChevronDown, Check, Hotel
} from 'lucide-react';
import { DiariaEvento, User, Attachment } from '../../types';
import { getAllDiariaEventos, updateDiariaEvento, getDiariasGestores } from '../../services/diariasEventosService';
import { uploadFile } from '../../services/storageService';
import { getDiariasDespesasEnabled } from '../../services/diariasSettingsService';
import { ImageCropModal } from '../common/ImageCropModal';

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

  const [isGestorOrAdmin, setIsGestorOrAdmin] = useState<boolean>(false);

  useEffect(() => {
    const checkGestorStatus = async () => {
      if (!currentUser) return;
      if (currentUser.role === 'admin') {
        setIsGestorOrAdmin(true);
        return;
      }
      if (currentUser.permissions?.includes('parent_diarias_gestores')) {
        setIsGestorOrAdmin(true);
        return;
      }
      try {
        const gestores = await getDiariasGestores();
        const isGestorMap = gestores.some(g => g.gestor_id === currentUser.id);
        if (isGestorMap) {
          setIsGestorOrAdmin(true);
        }
      } catch (err) {
        console.warn('Erro ao verificar gestores em ViajarScreen:', err);
      }
    };
    checkGestorStatus();
  }, [currentUser]);

  // Normalizador de texto
  const normalizeText = (text: string) =>
    text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";

  const isPersonMatch = (p: { id: string; name: string }, user: User) => {
    if (!p || !user) return false;
    if (p.id === user.id) return true;
    if (p.name && user.name && normalizeText(p.name) === normalizeText(user.name)) return true;
    return false;
  };

  // Verifica e inicia viagens programadas cujo horário programado de saída já passou
  const verificarEIniciarViagensAutomaticas = async (viagens: DiariaEvento[]) => {
    // Se o usuário já tiver uma viagem ativa em andamento, não inicia outra de forma automática
    const temViagemAtiva = viagens.some(evt => {
      const p = evt.pessoas && evt.pessoas.find(x => isPersonMatch(x, currentUser)) as any;
      return p && p.viagem_inicio && !p.viagem_fim && evt.status === 'em_viagem';
    });

    if (temViagemAtiva) return;

    const agora = new Date();
    let houveAlteracao = false;

    for (const evt of viagens) {
      const isProgramado = evt.status === 'viagem_programada' || evt.status === 'aprovado' || !evt.status;
      if (isProgramado && evt.data_saida) {
        try {
          const dataSaida = new Date(evt.data_saida);
          if (agora.getTime() >= dataSaida.getTime()) {
            const hasStarted = evt.pessoas && evt.pessoas.some(p => (p as any).viagem_inicio);
            if (!hasStarted) {
              console.log(`[Auto-Start] Iniciando viagem ${evt.id} em segundo plano.`);
              const inicioIso = agora.toISOString();
              const updatedPessoas = (evt.pessoas && evt.pessoas.length > 0)
                ? evt.pessoas.map(p => ({
                    ...p,
                    viagem_inicio: (p as any).viagem_inicio || inicioIso
                  }))
                : [{ id: currentUser.id, name: currentUser.name, viagem_inicio: inicioIso }] as any;

              await updateDiariaEvento(evt.id, {
                pessoas: updatedPessoas,
                status: 'em_viagem',
                modo_inicio: 'automatico',
                saida_validada: false
              } as any);
              houveAlteracao = true;
            }
          }
        } catch (e) {
          console.warn('Erro ao auto-iniciar viagem:', e);
        }
      }
    }

    if (houveAlteracao) {
      setTimeout(() => loadViagens(false), 500);
    }
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
      verificarEIniciarViagensAutomaticas(minhasViagens);
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

    const handleUpdate = () => {
      loadViagens(false);
    };

    window.addEventListener('diarias_eventos_updated', handleUpdate);
    const interval = setInterval(() => {
      loadViagens(false);
    }, 3000);

    return () => {
      window.removeEventListener('diarias_eventos_updated', handleUpdate);
      clearInterval(interval);
    };
  }, [currentUser]);

  // Estados para Upload de Comprovante de Despesa
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [expenseType, setExpenseType] = useState<string>('Alimentação');
  const [expenseValue, setExpenseValue] = useState<string>('');
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Controle do cronômetro em tempo real
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Estado para GPS e Rastreamento em Tempo Real
  const [gpsLocation, setGpsLocation] = useState<{
    cityName: string;
    isAtOrigin: boolean;
    hasLeftOrigin: boolean;
    lat: number | null;
    lon: number | null;
    lastCheck: string;
    message: string | null;
  }>({
    cityName: 'Buscando GPS...',
    isAtOrigin: true,
    hasLeftOrigin: false,
    lat: null,
    lon: null,
    lastCheck: '',
    message: null
  });

  const watchIdRef = useRef<number | null>(null);

  // Helper para Reverse Geocoding via Nominatim OpenStreetMap
  const getCityFromCoords = async (lat: number, lon: number): Promise<string> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
      if (res.ok) {
        const data = await res.json();
        const city = data.address?.city || data.address?.town || data.address?.municipality || data.address?.village || data.address?.county;
        if (city) return city;
      }
    } catch (e) {
      console.warn('Erro ao obter município por GPS:', e);
    }
    return 'Município Detectado';
  };

  // Processa Posição de GPS e executa regras de Negócio de Diárias
  const processGpsUpdate = async (lat: number, lon: number, currentTrip: DiariaEvento) => {
    const cityName = await getCityFromCoords(lat, lon);
    const originCity = 'São José do Goiabal - MG';

    const normCity = normalizeText(cityName);
    const normOrigin = normalizeText(originCity);

    const isAtOrigin = normCity.includes('goiabal') || normCity.includes(normOrigin) || normOrigin.includes(normCity) || normCity === 'municipio detectado';
    const isOutside = !isAtOrigin;

    const nowMs = Date.now();

    // REGRA DE CHECKPOINT: Apenas registra a localização no banco sem alterar o status da viagem
    const lastCp = (currentTrip as any).ultimo_checkpoint || (currentTrip as any).checklist?.ultimo_checkpoint;
    const isNewCity = !lastCp || lastCp.cidade !== cityName;
    const timeDiff = lastCp?.timestamp ? (nowMs - new Date(lastCp.timestamp).getTime()) : 999999;

    if (isNewCity || timeDiff >= 45000) {
      const checkpointObj = {
        cidade: cityName,
        lat,
        lon,
        timestamp: new Date().toISOString(),
        fora_origem: isOutside
      };

      const existingChecklist = (currentTrip as any).checklist || {};
      updateDiariaEvento(currentTrip.id, {
        checklist: { ...existingChecklist, ultimo_checkpoint: checkpointObj }
      } as any).catch(err => console.warn('Erro em segundo plano ao salvar checkpoint:', err));
    }

    setGpsLocation({
      cityName,
      isAtOrigin,
      hasLeftOrigin: isOutside,
      lat,
      lon,
      lastCheck: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message: `📍 Checkpoint ativo em: ${cityName}`
    });
  };



  // Modal de confirmação ao clicar em Finalizar
  const [isConfirmFinalizeOpen, setIsConfirmFinalizeOpen] = useState<boolean>(false);
  const [isHospedagemModalOpen, setIsHospedagemModalOpen] = useState<boolean>(false);
  const [finalHospedagem, setFinalHospedagem] = useState<boolean>(false);
  const [finalHospedagemDias, setFinalHospedagemDias] = useState<number>(1);

  // Estados para Modal de Checklist do Veículo Pré-Viagem
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState<boolean>(false);
  const [isConfirmChecklistAlertOpen, setIsConfirmChecklistAlertOpen] = useState<boolean>(false);
  const [checklistData, setChecklistData] = useState({
    lataria: true,
    pneus: true,
    farois: true,
    oleo: true,
    agua: true,
    combustivel: true,
    documentacao: true,
    estepe: true,
    temAvaria: false,
    observacoes: ''
  });

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
    if (activeTrip && !isGestorOrAdmin) {
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
  const canIniciarViagem = (evento: DiariaEvento): { allowed: boolean; liberadoEm?: string; reason?: string; isPendingApproval?: boolean } => {
    if (!evento) return { allowed: false };

    // Não permitir iniciar outra viagem se o usuário já tiver uma ativa em andamento
    const outraViagemAtiva = eventos.find(evt => {
      if (evt.id === evento.id) return false;
      const { viagem_inicio, viagem_fim } = getPessoaViagemData(evt);
      return viagem_inicio && !viagem_fim && evt.status === 'em_viagem';
    });

    if (outraViagemAtiva) {
      return {
        allowed: false,
        reason: `Você já possui uma viagem em andamento para ${outraViagemAtiva.destino}. Finalize-a antes de iniciar outra.`
      };
    }

    if (evento.status === 'em_analise' || evento.status === 'aguardando_aprovacao' || evento.status === 'aguardando_gestor') {
      return { 
        allowed: false, 
        isPendingApproval: true,
        reason: 'Esta solicitação de viagem está Em Análise pelo seu gestor ou administrador. O botão de início será liberado automaticamente após a aprovação.' 
      };
    }

    if (evento.status === 'cancelado' || evento.status === 'viagem_cancelada' || evento.status === 'rejeitado_gestor' || evento.status === 'rejeitado_administrador') {
      return { allowed: false, reason: 'Esta viagem foi cancelada ou rejeitada pela administração.' };
    }

    if (!evento.data_saida) return { allowed: true };

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
    if (evt.status !== 'em_viagem') return false;
    const data = getPessoaViagemData(evt);
    return data.viagem_inicio && !data.viagem_fim;
  });

  // Trava de navegação: se houver viagem em andamento, obriga a abrir a página da viagem em andamento
  useEffect(() => {
    // Administradores e gestores não ficam travados
    if (isGestorOrAdmin) return;

    if (activeTrip && selectedEventoId !== activeTrip.id) {
      setSelectedEventoId(activeTrip.id);
      window.history.pushState({}, '', `/Diarias/Viajar/Detalhes?id=${activeTrip.id}`);
    }
  }, [activeTrip, selectedEventoId, isGestorOrAdmin]);

  const selectedEvento = eventos.find(e => e.id === selectedEventoId) || null;

  // Effect para Ativar GPS WatchPosition durante a Viagem
  useEffect(() => {
    if (!selectedEvento) return;
    const data = getPessoaViagemData(selectedEvento);
    const isStarted = !!data.viagem_inicio && !data.viagem_fim && selectedEvento.status === 'em_viagem';

    if (isStarted && typeof window !== 'undefined' && 'geolocation' in navigator) {
      const handlePosition = (pos: GeolocationPosition) => {
        processGpsUpdate(pos.coords.latitude, pos.coords.longitude, selectedEvento);
      };

      const handleError = (err: GeolocationPositionError) => {
        console.warn('Aviso de leitura do GPS:', err.message);
      };

      navigator.geolocation.getCurrentPosition(handlePosition, handleError, { enableHighAccuracy: true });

      const watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000
      });

      watchIdRef.current = watchId;

      return () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
      };
    }
  }, [selectedEvento]);

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

  // Ação de Iniciar Viagem com salvamento do Checklist
  const handleIniciarViagemWithChecklist = async (evento: DiariaEvento) => {
    setIsConfirmChecklistAlertOpen(false);
    setIsChecklistModalOpen(false);

    const inicioIso = new Date().toISOString();
    const updatedPessoas = (evento.pessoas && evento.pessoas.length > 0)
      ? evento.pessoas.map(p => ({
          ...p,
          viagem_inicio: (p as any).viagem_inicio || inicioIso
        }))
      : [{ id: currentUser.id, name: currentUser.name, viagem_inicio: inicioIso }] as any;

    const optimisticEvento: DiariaEvento = {
      ...evento,
      pessoas: updatedPessoas,
      data_saida: inicioIso,
      status: 'em_viagem',
      modo_inicio: 'manual',
      saida_validada: true,
      checklist: {
        ...checklistData,
        date: inicioIso,
        user_name: currentUser.name
      }
    };

    // 1. Atualização OTIMISTA instantânea (sem delay)
    setEventos(prev => prev.map(e => e.id === evento.id ? optimisticEvento : e));

    // 2. Envio em segundo plano para o Supabase
    try {
      const updated = await updateDiariaEvento(evento.id, {
        pessoas: updatedPessoas,
        data_saida: inicioIso,
        status: 'em_viagem',
        modo_inicio: 'manual',
        saida_validada: true,
        checklist: {
          ...checklistData,
          date: inicioIso,
          user_name: currentUser.name
        }
      } as any);
      setEventos(prev => prev.map(e => e.id === evento.id ? updated : e));
    } catch (err) {
      console.warn('Erro em segundo plano ao salvar início de viagem e checklist:', err);
    }
  };

  // Ação de Iniciar Viagem (Atualização Instantânea Otimista)
  const handleIniciarViagem = async (evento: DiariaEvento) => {
    const inicioIso = new Date().toISOString();
    const updatedPessoas = (evento.pessoas && evento.pessoas.length > 0)
      ? evento.pessoas.map(p => ({
          ...p,
          viagem_inicio: (p as any).viagem_inicio || inicioIso
        }))
      : [{ id: currentUser.id, name: currentUser.name, viagem_inicio: inicioIso }] as any;

    const optimisticEvento: DiariaEvento = {
      ...evento,
      pessoas: updatedPessoas,
      data_saida: inicioIso,
      status: 'em_viagem',
      modo_inicio: 'manual',
      saida_validada: true
    };

    // 1. Atualização OTIMISTA instantânea (sem delay)
    setEventos(prev => prev.map(e => e.id === evento.id ? optimisticEvento : e));

    // 2. Envio em segundo plano para o Supabase
    try {
      const updated = await updateDiariaEvento(evento.id, {
        pessoas: updatedPessoas,
        data_saida: inicioIso,
        status: 'em_viagem',
        modo_inicio: 'manual',
        saida_validada: true
      });
      setEventos(prev => prev.map(e => e.id === evento.id ? updated : e));
    } catch (err) {
      console.warn('Erro em segundo plano ao salvar início de viagem:', err);
    }
  };

  const handleInitiateFinalizeCheck = () => {
    if (!selectedEvento) return;
    const data = getPessoaViagemData(selectedEvento);
    const inicioStr = data.viagem_inicio || selectedEvento.data_saida;

    let diffHours = 0;
    if (inicioStr) {
      const inicioDate = new Date(inicioStr);
      const agora = new Date();
      diffHours = (agora.getTime() - inicioDate.getTime()) / (1000 * 60 * 60);
    }

    if (diffHours >= 12) {
      setFinalHospedagem(false);
      setFinalHospedagemDias(1);
      setIsHospedagemModalOpen(true);
    } else {
      setIsConfirmFinalizeOpen(true);
    }
  };

  // Ação de Finalizar Viagem (Atualização Instantânea Otimista)
  const handleFinalizarViagem = async (evento: DiariaEvento) => {
    const fimIso = new Date().toISOString();
    const data = getPessoaViagemData(evento);
    const inicio = data.viagem_inicio || new Date().toISOString();

    const updatedPessoas = (evento.pessoas && evento.pessoas.length > 0)
      ? evento.pessoas.map(p => ({
          ...p,
          viagem_fim: (p as any).viagem_fim || fimIso
        }))
      : [{ id: currentUser.id, name: currentUser.name, viagem_inicio: inicio, viagem_fim: fimIso }] as any;

    const diffMs = new Date(fimIso).getTime() - new Date(inicio).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    const useHospedagem = diffHours >= 12 ? finalHospedagem : (evento.hospedagem || false);
    const useHospedagemDias = diffHours >= 12 ? (finalHospedagem ? finalHospedagemDias : 0) : (evento.hospedagem_dias || 0);

    const optimisticEvento: DiariaEvento = {
      ...evento,
      pessoas: updatedPessoas,
      data_retorno: fimIso,
      status: 'aguardando_gestor',
      hospedagem: useHospedagem,
      hospedagem_dias: useHospedagemDias
    };

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

    // 1. Atualização OTIMISTA instantânea e exibição imediata do modal de resumo
    setEventos(prev => prev.map(e => e.id === evento.id ? optimisticEvento : e));
    setSummaryModal({
      isOpen: true,
      saidaReal: new Date(inicio).toLocaleString('pt-BR'),
      retornoReal: new Date(fimIso).toLocaleString('pt-BR'),
      duracaoText
    });

    // 2. Envio em segundo plano para o Supabase
    try {
      const updated = await updateDiariaEvento(evento.id, {
        pessoas: updatedPessoas,
        data_retorno: fimIso,
        status: 'aguardando_gestor',
        hospedagem: useHospedagem,
        hospedagem_dias: useHospedagemDias
      });
      setEventos(prev => prev.map(e => e.id === evento.id ? updated : e));
    } catch (err) {
      console.warn('Erro em segundo plano ao salvar finalização de viagem:', err);
    }
  };

  const processComprovanteUpload = async (file: File) => {
    if (!selectedEvento) return;
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

        // Formatação organizada em formato de texto para o relatório de viagem
        const itensText = updatedList.map((c, i) => {
          const t = c.expenseType || c.name || 'Despesa';
          const v = c.expenseValue ? `R$ ${c.expenseValue}` : 'valor não informado';
          return `${i + 1}. ${t}: ${v}`;
        }).join('\n');

        let total = 0;
        let hasTotal = false;
        updatedList.forEach(c => {
          if (c.expenseValue) {
            const num = parseFloat(c.expenseValue.toString().replace(/[^0-9,.-]/g, '').replace(',', '.'));
            if (!isNaN(num)) { total += num; hasTotal = true; }
          }
        });
        const totalStr = hasTotal
          ? `\nTotal de despesas comprovadas: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '';

        const despesasBlock = `Despesas registradas durante a viagem:\n${itensText}${totalStr}`;

        let currentRelatorio = selectedEvento.relatorio_viagem || '';
        let updatedRelatorio = '';
        if (!currentRelatorio || currentRelatorio.includes('Despesas registradas durante a viagem:')) {
          const base = currentRelatorio ? currentRelatorio.split(/Despesas registradas durante a viagem:/)[0].trim() : '';
          updatedRelatorio = base ? `${base}\n\n${despesasBlock}` : despesasBlock;
        } else {
          updatedRelatorio = `${currentRelatorio}\n\n${despesasBlock}`;
        }

        const updated = await updateDiariaEvento(selectedEvento.id, {
          comprovantes_gestor: updatedList,
          relatorio_viagem: updatedRelatorio
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

  const handleComprovanteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEvento) return;

    if (expenseType === 'Hospedagem') {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        alert('Atenção: Para despesas do tipo Hospedagem, o anexo deve ser obrigatoriamente um arquivo no formato PDF.');
        if (e.target) e.target.value = '';
        return;
      }
    }

    if (file.type && file.type.startsWith('image/')) {
      setPendingCropFile(file);
    } else {
      processComprovanteUpload(file);
    }
  };

  const handleDeleteComprovante = async (comprovanteId: string) => {
    if (!selectedEvento) return;
    if (!confirm('Deseja realmente remover este comprovante de despesa?')) return;

    try {
      const existingList: Attachment[] = selectedEvento.comprovantes_gestor || [];
      const updatedList = existingList.filter(c => c.id !== comprovanteId);

      let updatedRelatorio = selectedEvento.relatorio_viagem || '';
      if (updatedRelatorio.includes('Despesas registradas durante a viagem:')) {
        const base = updatedRelatorio.split(/Despesas registradas durante a viagem:/)[0].trim();
        if (updatedList.length > 0) {
          const itensText = updatedList.map((c, i) => {
            const t = c.expenseType || c.name || 'Despesa';
            const v = c.expenseValue ? `R$ ${c.expenseValue}` : 'valor não informado';
            return `${i + 1}. ${t}: ${v}`;
          }).join('\n');

          let total = 0;
          let hasTotal = false;
          updatedList.forEach(c => {
            if (c.expenseValue) {
              const num = parseFloat(c.expenseValue.toString().replace(/[^0-9,.-]/g, '').replace(',', '.'));
              if (!isNaN(num)) { total += num; hasTotal = true; }
            }
          });
          const totalStr = hasTotal
            ? `\nTotal de despesas comprovadas: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '';

          const despesasBlock = `Despesas registradas durante a viagem:\n${itensText}${totalStr}`;
          updatedRelatorio = base ? `${base}\n\n${despesasBlock}` : despesasBlock;
        } else {
          updatedRelatorio = base;
        }
      }

      const updated = await updateDiariaEvento(selectedEvento.id, {
        comprovantes_gestor: updatedList,
        relatorio_viagem: updatedRelatorio
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
                          ) : (evt.status === 'em_analise' || evt.status === 'aguardando_aprovacao' || evt.status === 'aguardando_gestor') ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 shrink-0">
                              <Lock className="w-3 h-3 text-amber-600" />
                              <span>Em Análise</span>
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
                      ) : (selectedEvento.status === 'em_analise' || selectedEvento.status === 'aguardando_aprovacao' || selectedEvento.status === 'aguardando_gestor') ? (
                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-amber-600" />
                          <span>Em Análise</span>
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
                        <div className="sm:col-span-2 md:col-span-3 border-t border-slate-200/60 pt-2 mt-1">
                          <span className="text-slate-400 text-[10px] font-bold uppercase block">Servidor(es) na Viagem</span>
                          <p className="text-slate-900 font-bold mt-0.5">
                            {selectedEvento.pessoas && selectedEvento.pessoas.length > 0
                              ? selectedEvento.pessoas.map(p => p.name).join(', ')
                              : 'Não informado'}
                          </p>
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
                  
                  {/* ESTADO 1: ANTES DE INICIAR (Tem APENAS o Botão INICIAR ou Bloqueio por Aprovação) */}
                  {!isStarted && !isFinished && (
                    <div className="flex flex-col items-center gap-4 w-full py-4">
                      <p className="text-slate-500 text-xs md:text-sm font-semibold max-w-sm">
                        {check.isPendingApproval 
                          ? "Esta solicitação precisa ser aprovada antes de iniciar a viagem."
                          : "Para começar o registro da viagem e contar o tempo em tempo real, clique no botão de início abaixo."
                        }
                      </p>

                      <button
                        onClick={() => {
                          if (check.allowed) {
                            setChecklistData({
                              lataria: true,
                              pneus: true,
                              farois: true,
                              oleo: true,
                              agua: true,
                              combustivel: true,
                              documentacao: true,
                              estepe: true,
                              temAvaria: false,
                              observacoes: ''
                            });
                            setIsChecklistModalOpen(true);
                          }
                        }}
                        disabled={!check.allowed}
                        className={`w-36 h-36 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all duration-300 border-[6px] border-white group/btn relative ${
                          check.allowed
                            ? 'bg-emerald-600 hover:bg-emerald-700 hover:scale-105 active:scale-95 shadow-emerald-600/40 cursor-pointer'
                            : check.isPendingApproval
                            ? 'bg-amber-500 shadow-amber-500/30 cursor-not-allowed opacity-90'
                            : 'bg-slate-400 shadow-slate-400/30 cursor-not-allowed opacity-70'
                        }`}
                      >
                        {check.allowed && (
                          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping group-hover/btn:animate-none -z-10"></div>
                        )}
                        {check.isPendingApproval ? (
                          <Lock className="w-10 h-10 text-white mb-1" />
                        ) : (
                          <Play className="w-10 h-10 fill-white text-white group-hover/btn:scale-110 transition-transform mb-1 ml-1" />
                        )}
                        <span className="font-black text-[11px] uppercase tracking-wider text-center px-2">
                          {check.isPendingApproval ? 'AGUARDANDO APROVAÇÃO' : 'INICIAR'}
                        </span>
                      </button>

                      {!check.allowed && (
                        <div className={`max-w-xs rounded-2xl px-4 py-3 text-center shadow-xs border ${
                          check.isPendingApproval ? 'bg-amber-50 border-amber-200' :
                          check.reason ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
                        }`}>
                          <div className={`flex items-center justify-center gap-1.5 font-black text-[10px] uppercase tracking-wider mb-1 ${
                            check.isPendingApproval ? 'text-amber-800' :
                            check.reason ? 'text-rose-700' : 'text-amber-700'
                          }`}>
                            {check.isPendingApproval ? <Lock className="w-3.5 h-3.5 text-amber-600" /> :
                             check.reason ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            <span>{check.isPendingApproval ? 'Aprovação Necessária' : check.reason ? 'Viagem Indisponível' : 'Início Bloqueado'}</span>
                          </div>
                          <p className={`text-xs font-semibold ${
                            check.isPendingApproval ? 'text-amber-900' :
                            check.reason ? 'text-rose-800' : 'text-amber-800'
                          }`}>
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

                  {/* ESTADO 2: EM PERCURSO (Exibe indicação de viagem em andamento, mensagem amigável de validação e botão de FINALIZAR) */}
                  {isStarted && !isFinished && (
                    <div className="flex flex-col items-center gap-6 w-full py-2 animate-fade-in">
                      <div className="w-full max-w-sm flex flex-col items-center bg-gradient-to-b from-slate-50 to-emerald-50/40 border border-emerald-100 p-5 rounded-2xl shadow-sm space-y-3 relative overflow-hidden">
                        {/* Brilho decorativo em segundo plano */}
                        <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-400/15 rounded-full blur-xl animate-pulse"></div>

                        <span className="text-[11px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1.5 bg-emerald-100/90 border border-emerald-200 px-3.5 py-1 rounded-full shadow-2xs animate-pulse">
                          <Timer className="w-4 h-4 text-emerald-600" />
                          <span>VIAGEM EM ANDAMENTO</span>
                        </span>
                        
                        <span className="text-[11px] text-slate-500 font-semibold">
                          Saída registrada em: {formatDate(data.viagem_inicio)}
                        </span>

                        {/* Saudação de Boa Viagem animada e amigável */}
                        <div className="w-full bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-emerald-200/80 shadow-xs flex items-center justify-center gap-2.5 text-center transition-all duration-300 hover:border-emerald-300 hover:shadow-md group mt-1">
                          <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 shrink-0 group-hover:scale-110 transition-transform duration-300">
                            <Sparkles className="w-4 h-4 animate-bounce" />
                          </div>
                          <span className="text-xs font-black text-emerald-800 tracking-wider uppercase">
                            Desejamos uma Boa Viagem!
                          </span>
                        </div>
                      </div>

                      {/* Botão de Finalizar */}
                      <button
                        onClick={handleInitiateFinalizeCheck}
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
                    accept={expenseType === 'Hospedagem' ? 'application/pdf,.pdf' : 'image/*,application/pdf'}
                    onChange={handleComprovanteUpload}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleComprovanteUpload}
                    disabled={expenseType === 'Hospedagem'}
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

      {/* Modal de Confirmação para Finalizar a Viagem */}
      {isConfirmFinalizeOpen && selectedEvento && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsConfirmFinalizeOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-rose-600 to-red-700 p-6 text-white text-center relative flex flex-col items-center">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/30 shadow-inner">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-black tracking-tight uppercase">Finalizar Viagem?</h3>
              <p className="text-xs text-rose-100 font-semibold mt-1">Confirmação de Término do Percurso</p>
              <button 
                onClick={() => setIsConfirmFinalizeOpen(false)} 
                className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2 text-center">
                <p className="text-xs font-bold text-slate-900 leading-relaxed">
                  Confirma a finalização da viagem para <span className="font-black text-rose-700">{selectedEvento.destino}</span>?
                </p>
                {finalHospedagem && (
                  <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-200 text-[11px] text-indigo-900 font-bold">
                    Hospedagem informada: {finalHospedagemDias} {finalHospedagemDias === 1 ? 'noite' : 'noites'}
                  </div>
                )}
                <p className="text-[11px] text-slate-500">
                  Ao finalizar, o horário de retorno será registrado com a hora atual e a viagem seguirá para prestação de contas.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmFinalizeOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleFinalizarViagem(selectedEvento)}
                  className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-600/30 transition-all active:scale-95"
                >
                  Sim, Finalizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL PERGUNTA DE HOSPEDAGEM (QUANDO VIAGEM > 12 HORAS) */}
      {/* ======================================================== */}
      {isHospedagemModalOpen && selectedEvento && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsHospedagemModalOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up text-left"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-indigo-600 p-6 text-white text-center relative flex flex-col items-center">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/30 shadow-inner">
                <Hotel className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-black tracking-tight uppercase">Informação de Hospedagem</h3>
              <p className="text-xs text-indigo-100 font-semibold mt-1">Viagem com duração superior a 12 horas</p>
              <button 
                onClick={() => setIsHospedagemModalOpen(false)} 
                className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-xs font-semibold text-slate-700 leading-relaxed text-center">
                A sua viagem teve uma duração superior a 12 horas. Por favor, informe se houve necessidade de hospedagem:
              </p>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block text-center">
                  Houve Hospedagem?
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFinalHospedagem(false)}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-2xl border transition-all ${
                      !finalHospedagem
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinalHospedagem(true)}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-2xl border transition-all ${
                      finalHospedagem
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Sim
                  </button>
                </div>
              </div>

              {finalHospedagem && (
                <div className="space-y-2 animate-fade-in pt-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Quantas Noites de Hospedagem?
                  </label>
                  <div className="relative flex items-center w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0 mr-3" />
                    <input
                      type="number"
                      min="1"
                      value={finalHospedagemDias}
                      onChange={(e) => setFinalHospedagemDias(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-transparent text-sm font-bold text-slate-900 outline-none"
                      placeholder="Número de noites"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsHospedagemModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsHospedagemModalOpen(false);
                    setIsConfirmFinalizeOpen(true);
                  }}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sucesso ao Finalizar Viagem */}
      {summaryModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center space-y-4 animate-scale-up border border-slate-100">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Viagem Finalizada!</h3>
              <p className="text-slate-500 text-xs mt-1">Horário de término registrado com sucesso.</p>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Saída Real:</span>
                <span className="font-bold text-slate-800">{summaryModal.saidaReal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Retorno Real:</span>
                <span className="font-bold text-slate-800">{summaryModal.retornoReal}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/60 pt-2 text-indigo-600">
                <span className="font-bold">Tempo Total:</span>
                <span className="font-black">{summaryModal.duracaoText}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setSummaryModal(null);
                navigateToList();
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
            >
              OK, Entendido
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL CHECKLIST DO VEÍCULO (PRÉ-VIAGEM) */}
      {/* ======================================================== */}
      {isChecklistModalOpen && selectedEvento && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsChecklistModalOpen(false)}
        >
          <div 
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up flex flex-col max-h-[90vh] text-left"
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600/30 border border-emerald-400/30 rounded-xl flex items-center justify-center">
                  <Car className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">Checklist do Veículo</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Vistoria pré-viagem obrigatória</p>
                </div>
              </div>
              <button 
                onClick={() => setIsChecklistModalOpen(false)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informações do Veículo */}
            <div className="p-4 bg-emerald-50/70 border-b border-emerald-200/60 text-xs text-emerald-950 shrink-0 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <Car className="w-4 h-4 text-emerald-700 shrink-0" />
                  Veículo Alocado:
                </span>
                <span className="font-black text-slate-900 text-xs bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200 shadow-xs">
                  {selectedEvento.veiculo === 'OUTRO' ? (selectedEvento.veiculo_outro || 'Outro Veículo') : (selectedEvento.veiculo || 'Não especificado')}
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 font-medium">
                <strong>Destino:</strong> {selectedEvento.destino} • <strong>Condutor:</strong> {currentUser.name}
              </p>
            </div>

            {/* Lista do Checklist */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                Marque a situação dos itens de segurança:
              </p>

              {[
                { key: 'lataria', label: 'Lataria sem avarias' },
                { key: 'pneus', label: 'Pneus em boas condições' },
                { key: 'farois', label: 'Faróis e lanternas funcionando' },
                { key: 'oleo', label: 'Nível do óleo do motor adequado' },
                { key: 'agua', label: 'Nível da água/líquido de arrefecimento adequado' },
                { key: 'combustivel', label: 'Combustível suficiente' },
                { key: 'documentacao', label: 'Documentação no veículo' },
                { key: 'estepe', label: 'Estepe, macaco e chave de roda presentes' },
              ].map(item => {
                const isChecked = (checklistData as any)[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setChecklistData(prev => ({ ...prev, [item.key]: !isChecked }))}
                    className={`w-full p-3 rounded-2xl border transition-all flex items-center justify-between text-left ${
                      isChecked 
                        ? 'bg-emerald-50/50 border-emerald-200 text-slate-800 shadow-xs' 
                        : 'bg-amber-50/40 border-amber-200 text-amber-900'
                    }`}
                  >
                    <span className="text-xs font-bold">{item.label}</span>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                      isChecked ? 'bg-emerald-600 text-white' : 'bg-amber-200 text-amber-800'
                    }`}>
                      {isChecked ? <Check className="w-4 h-4" /> : <X className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                );
              })}

              {/* Pergunta: Há alguma avaria ou problema? (Sim/Não) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 mt-4">
                <label className="text-xs font-black text-slate-800 block">
                  Há alguma avaria ou problema no veículo?
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setChecklistData(prev => ({ ...prev, temAvaria: false, observacoes: '' }))}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                      !checklistData.temAvaria
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    onClick={() => setChecklistData(prev => ({ ...prev, temAvaria: true }))}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                      checklistData.temAvaria
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Sim
                  </button>
                </div>
              </div>

              {/* Campo de Observações (Exibido apenas quando SIM é selecionado) */}
              {checklistData.temAvaria && (
                <div className="space-y-1.5 pt-1 animate-fade-in">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Observações / Detalhes de Avarias
                  </label>
                  <textarea
                    value={checklistData.observacoes}
                    onChange={(e) => setChecklistData(prev => ({ ...prev, observacoes: e.target.value }))}
                    placeholder="Escreva os detalhes das avarias existentes ou observações da vistoria..."
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 resize-none transition-all"
                  />
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsChecklistModalOpen(false)}
                className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmChecklistAlertOpen(true)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>Finalizar Checklist</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ALERTA DE CONFIRMAÇÃO DO CHECKLIST & INÍCIO DE VIAGEM */}
      {/* ======================================================== */}
      {isConfirmChecklistAlertOpen && selectedEvento && (
        <div 
          className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setIsConfirmChecklistAlertOpen(false)}
        >
          <div 
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 text-center space-y-5 animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="font-extrabold text-slate-900 text-lg">Concluir Vistoria?</h3>
              <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                Deseja fechar o checklist de vistoria e <strong className="text-emerald-700 font-black">iniciar a viagem</strong> agora em tempo real?
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleIniciarViagemWithChecklist(selectedEvento)}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Sim, Iniciar Viagem</span>
              </button>

              <button
                type="button"
                onClick={() => setIsConfirmChecklistAlertOpen(false)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Voltar ao Checklist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Corte e Edição de Imagem */}
      {pendingCropFile && (
        <ImageCropModal
          imageFile={pendingCropFile}
          onConfirm={(croppedFile) => {
            setPendingCropFile(null);
            processComprovanteUpload(croppedFile);
          }}
          onCancel={() => {
            setPendingCropFile(null);
          }}
        />
      )}
    </div>
  );
};
