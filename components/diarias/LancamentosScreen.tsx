import React, { useEffect, useState, useMemo } from 'react';
import { 
  ArrowLeft, Loader2, Calendar, MapPin, Users, RefreshCw, 
  FileText, Search, Hash as HashIcon, CheckCircle2, 
  X, AlertTriangle, Upload, Paperclip, Check, Trash2,
  Car, Navigation, Hotel, BookOpen, Copy, Download, FileDown, XCircle, Receipt, Pencil,
  UserPlus, Square, Timer, Clock, Plus, ArrowRightLeft, UserCheck, Play, ShieldCheck, Camera
} from 'lucide-react';
import { getDiariasDespesasEnabled, setDiariasDespesasEnabled } from '../../services/diariasSettingsService';
import { DiariaEvento, User, Attachment, Sector, Job, Person, Order } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { 
  getDiariaEventosBySector, 
  getAllDiariaEventos, 
  updateDiariaEvento,
  getDiariasGestores,
  deleteDiariaEvento,
  createDiariaEvento
} from '../../services/diariasEventosService';
import { getGlobalSettings } from '../../services/settingsService';
import { uploadFile } from '../../services/storageService';
import { TwoFactorModal } from '../TwoFactorModal';
import { DiariasReportModal } from './DiariasReportModal';
import { ImageCropModal } from '../common/ImageCropModal';
import { performLocationCheckpointSync } from '../../services/locationTrackingService';


const GESTORES_CARGOS = [
  'Chefe do Departamento de Educação',
  'Chefe do Departamento de Agricultura',
  'Chefe do Departamento de Obras',
  'Chefe de Gabinete',
  'Secretario de Saúde',
  'Prefeito',
  'Secretário de Administração e Finanças'
];

const getCheckpointFromEvento = (evento: any): { cidade: string; timestamp?: string; lat?: number; lon?: number; fora_origem?: boolean } | null => {
  if (!evento) return null;
  if (evento.ultimo_checkpoint) {
    if (typeof evento.ultimo_checkpoint === 'object') return evento.ultimo_checkpoint;
    if (typeof evento.ultimo_checkpoint === 'string') {
      try { return JSON.parse(evento.ultimo_checkpoint); } catch (e) {}
    }
  }
  let chk = evento.checklist;
  if (typeof chk === 'string') {
    try { chk = JSON.parse(chk); } catch (e) {}
  }
  if (chk && typeof chk === 'object' && chk.ultimo_checkpoint) {
    return chk.ultimo_checkpoint;
  }
  return null;
};

interface LancamentosScreenProps {
  currentUser: User | null;
  onBack: () => void;
  onGenerateDiaria?: (diariaContent: {
    requesterName: string;
    destination: string;
    departureDateTime: string;
    returnDateTime: string;
    reason: string;
    requestedValue: string;
    relatorioViagem: string;
    attachments: Attachment[];
  }) => void;
}

export const LancamentosScreen: React.FC<LancamentosScreenProps> = ({
  currentUser,
  onBack,
  onGenerateDiaria
}) => {
  const [eventos, setEventos] = useState<DiariaEvento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startingTripId, setStartingTripId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [gestoresMap, setGestoresMap] = useState<Record<string, string>>({});

  // Controle de Modais
  const [selectedEvento, setSelectedEvento] = useState<DiariaEvento | null>(null);
  // Estados para modal de finalização direta de viagem no Lançamentos
  const [finalizeEventoModal, setFinalizeEventoModal] = useState<DiariaEvento | null>(null);
  const [isFinalizeHospedagemStep, setIsFinalizeHospedagemStep] = useState<boolean>(false);
  const [finalHospedagem, setFinalHospedagem] = useState<boolean>(false);
  const [finalHospedagemDias, setFinalHospedagemDias] = useState<number>(1);
  const [isFinalizingSubmitting, setIsFinalizingSubmitting] = useState<boolean>(false);
  const [modalType, setModalType] = useState<'gestor' | 'admin' | null>(null);

  // Estados para o Modal do Gestor
  const [justificativaGestor, setJustificativaGestor] = useState('');
  const [comprovantes, setComprovantes] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Novos campos de despesa do comprovante
  const [newExpenseType, setNewExpenseType] = useState('Alimentação');
  const [newExpenseValue, setNewExpenseValue] = useState('');
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

  // Estados para o Modal do Administrador (Aprovação Final) e Abas
  const [adminStep, setAdminStep] = useState<'review' | 'approve'>('review');
  const [valorDiaria, setValorDiaria] = useState('');
  const [relatorioViagem, setRelatorioViagem] = useState('');
  const [modalActiveTab, setModalActiveTab] = useState<'resumo' | 'justificativa' | 'comprovantes' | 'relatorio'>('resumo');
  const [transferGestorCargo, setTransferGestorCargo] = useState<string>('');
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [isCopiedNarrative, setIsCopiedNarrative] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);

  // Estados para o Modal de Rejeição
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Estado para Modal de Relatório de Diárias
  const [showReportModal, setShowReportModal] = useState(false);

  const handleUpdatePaymentStatus = async (orderOrId: string | Order, status: 'pending' | 'contabilidade' | 'paid') => {
    const id = typeof orderOrId === 'string' ? orderOrId : orderOrId.id;
    setEventos(prev => prev.map(evt => String(evt.id) === String(id) ? { ...evt, payment_status: status as any } : evt));
    try {
      await updateDiariaEvento(id, { payment_status: status } as any);
    } catch (e) {
      console.warn('Erro ao atualizar payment_status em Lancamentos:', e);
    }
  };

  // Ticker para tempo real de viagem em andamento
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Permissão de Gestor/Admin para ações administrativas na lista
  const isGestorOrAdmin = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.permissions?.includes('parent_diarias_gestores')) return true;
    return Object.values(gestoresMap).includes(currentUser.id);
  }, [currentUser, gestoresMap]);

  // Estados dos modais de gestão na lista de lançamentos
  const [addServerEventoModal, setAddServerEventoModal] = useState<DiariaEvento | null>(null);
  const [addServerSearch, setAddServerSearch] = useState('');
  const [transferServerEventoModal, setTransferServerEventoModal] = useState<DiariaEvento | null>(null);
  const [transferServerSearch, setTransferServerSearch] = useState('');

  // Estado do Modal Administrativo de Forçar "Em Percurso" com tempo customizado
  const [adminEmPercursoModal, setAdminEmPercursoModal] = useState<DiariaEvento | null>(null);
  const [adminElapsedHours, setAdminElapsedHours] = useState<number>(1);
  const [adminElapsedMinutes, setAdminElapsedMinutes] = useState<number>(46);
  const [isAdminUpdating, setIsAdminUpdating] = useState<boolean>(false);

  // Estado e Função para Forçar Sincronização Manual de GPS via Botão de Localização
  const [syncingTripId, setSyncingTripId] = useState<string | null>(null);

  const handleManualLocationSync = async (evento: DiariaEvento) => {
    setSyncingTripId(evento.id);
    try {
      await performLocationCheckpointSync(currentUser?.id, evento.id);
      window.dispatchEvent(new CustomEvent('diarias_checkpoint_updated', {
        detail: { tripId: evento.id }
      }));
      await fetchEventos(false);
    } catch (err) {
      console.warn('Erro ao sincronizar localização manualmente:', err);
    } finally {
      setSyncingTripId(null);
    }
  };

  const handleConfirmAdminEmPercurso = async () => {
    if (!adminEmPercursoModal) return;
    setIsAdminUpdating(true);
    try {
      const totalMinutes = (Number(adminElapsedHours) || 0) * 60 + (Number(adminElapsedMinutes) || 0);
      const elapsedMs = totalMinutes * 60 * 1000;
      const newInicioIso = new Date(Date.now() - elapsedMs).toISOString();

      const updatedPessoas = (adminEmPercursoModal.pessoas || []).map(p => ({
        ...p,
        viagem_inicio: newInicioIso,
        viagem_fim: null
      }));

      // Optimistic update local
      setEventos(prev => prev.map(evt => evt.id === adminEmPercursoModal.id ? {
        ...evt,
        status: 'em_viagem',
        data_saida: newInicioIso,
        pessoas: updatedPessoas,
        saida_validada: true
      } : evt));

      if (selectedEvento && selectedEvento.id === adminEmPercursoModal.id) {
        setSelectedEvento(prev => prev ? {
          ...prev,
          status: 'em_viagem',
          data_saida: newInicioIso,
          pessoas: updatedPessoas,
          saida_validada: true
        } : null);
      }

      await updateDiariaEvento(adminEmPercursoModal.id, {
        status: 'em_viagem',
        data_saida: newInicioIso,
        pessoas: updatedPessoas,
        saida_validada: true
      } as any);

      // Disparar sincronização local e global em tempo real
      window.dispatchEvent(new Event('diarias_eventos_updated'));
      window.dispatchEvent(new CustomEvent('diarias_checkpoint_updated', {
        detail: { tripId: adminEmPercursoModal.id }
      }));

      await fetchEventos(false);
      setAdminEmPercursoModal(null);
    } catch (error: any) {
      console.error('Erro ao definir em percurso:', error);
      alert('Erro ao atualizar status da viagem: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsAdminUpdating(false);
    }
  };

  const handleFinalizarViagemFromLancamentos = async (evento: DiariaEvento) => {
    const fimIso = new Date().toISOString();
    const updatedPessoas = (evento.pessoas || []).map(p => ({
      ...p,
      viagem_fim: (p as any).viagem_fim || fimIso
    }));

    const optimistic: DiariaEvento = {
      ...evento,
      pessoas: updatedPessoas,
      data_retorno: fimIso,
      status: 'aguardando_gestor'
    };

    setEventos(prev => prev.map(e => e.id === evento.id ? optimistic : e));
    setFinalizeEventoModal(null);

    try {
      await updateDiariaEvento(evento.id, {
        pessoas: updatedPessoas,
        data_retorno: fimIso,
        status: 'aguardando_gestor'
      });
    } catch (err) {
      console.warn("Erro ao finalizar viagem via Lancamentos:", err);
    }
  };

  const handleAddServerToEvento = async (evento: DiariaEvento, person: Person) => {
    if (evento.pessoas?.some(p => p.id === person.id)) {
      alert("Este servidor já está adicionado nesta viagem.");
      return;
    }

    setAddServerEventoModal(null);
    setAddServerSearch('');

    const newPersonObj = { id: person.id, name: person.name };
    const allPersons = [...(evento.pessoas || []), newPersonObj];

    const originalPerson = allPersons[0];
    const otherPersons = allPersons.slice(1);

    try {
      // 1. Atualizar a viagem original para ter apenas o primeiro servidor
      await updateDiariaEvento(evento.id, {
        pessoas: [originalPerson]
      });

      // 2. Criar uma nova viagem para cada um dos outros servidores
      for (const p of otherPersons) {
        await createDiariaEvento({
          pessoas: [p],
          destino: evento.destino,
          data_saida: evento.data_saida,
          data_retorno: evento.data_retorno,
          motivo: evento.motivo,
          setor_id: evento.setor_id,
          user_id: evento.user_id,
          user_name: evento.user_name,
          status: evento.status || 'aguardando_gestor',
          hospedagem: evento.hospedagem ?? false,
          hospedagem_dias: evento.hospedagem_dias ?? 0,
          veiculo: evento.veiculo,
          veiculo_outro: evento.veiculo_outro,
          distancia: evento.distancia ?? 0,
          justificativa_gestor: evento.justificativa_gestor,
          comprovantes_gestor: [],
          valor_diaria: evento.valor_diaria,
          relatorio_viagem: evento.relatorio_viagem,
          gestor_transferido_cargo: evento.gestor_transferido_cargo,
          modo_inicio: evento.modo_inicio,
          saida_validada: evento.saida_validada,
          checklist: evento.checklist,
          digital_signature: evento.digital_signature
        });
      }

      await fetchEventos(true);
      alert("Viagem individualizada com sucesso para cada servidor!");
    } catch (err) {
      console.warn("Erro ao individualizar viagem via Lancamentos:", err);
      alert("Erro ao individualizar a viagem. Algumas alterações podem não ter sido salvas.");
      await fetchEventos(false);
    }
  };

  const handleTransferServerInEvento = async (evento: DiariaEvento, newPerson: Person) => {
    if (evento.pessoas?.some(p => p.id === newPerson.id)) {
      alert("Esta viagem já pertence a este servidor.");
      return;
    }

    const updatedPessoas = [{ id: newPerson.id, name: newPerson.name }];
    const optimistic: DiariaEvento = {
      ...evento,
      pessoas: updatedPessoas
    };

    setEventos(prev => prev.map(e => e.id === evento.id ? optimistic : e));
    setTransferServerEventoModal(null);
    setTransferServerSearch('');

    try {
      await updateDiariaEvento(evento.id, {
        pessoas: updatedPessoas
      });
    } catch (err) {
      console.warn("Erro ao transferir viagem via Lancamentos:", err);
      alert("Falha ao transferir a viagem para o novo servidor.");
    }
  };


  useEffect(() => {
    const loadAuxiliaryData = async () => {
      try {
        const cachedLogo = localStorage.getItem('cached_img_branding_logo') || localStorage.getItem('cached_img_ui_header_logo');
        if (cachedLogo) setLogoUrl(cachedLogo);

        const settings = await getGlobalSettings();
        if (settings?.branding?.logoUrl) {
          setLogoUrl(settings.branding.logoUrl);
        }

        const { data: sData } = await supabase.from('sectors').select('*');
        if (sData) setSectors(sData);

        const { data: pData } = await supabase.from('profiles').select('*');
        if (pData) setProfiles(pData);

        const { data: jData } = await supabase.from('jobs').select('*');
        if (jData) setJobs(jData);

        const { data: peData } = await supabase.from('persons').select('*');
        if (peData) {
          setPersons(peData.map((p: any) => ({
            id: p.id,
            name: p.name,
            sectorId: p.sector_id,
            jobId: p.job_id,
            birth_date: p.birth_date,
            driver_code: p.driver_code
          })));
        }
      } catch (e) {
        console.warn("Erro ao carregar dados auxiliares:", e);
      }
    };
    loadAuxiliaryData();
  }, []);

  // Assinatura em tempo real para checkpoints de localização e viagens com polling ativo de 15 segundos
  useEffect(() => {
    const channel = supabase
      .channel('realtime_diarias_checkpoints_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'diarias_eventos' },
        (payload) => {
          if (payload.new) {
            const updated = payload.new as DiariaEvento;
            setEventos(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
            setSelectedEvento(prev => (prev && prev.id === updated.id) ? { ...prev, ...updated } : prev);
          }
        }
      )
      .subscribe();

    // Polling a cada 15s para garantir sincronização no painel de lançamentos
    const pollInterval = setInterval(() => {
      fetchEventos(false);
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, []);

  const fetchEventos = async (showFullLoading = false) => {
    if (showFullLoading) setIsLoading(true);
    try {
      // 1. Buscar gestores mapeados
      const gestores = await getDiariasGestores();
      const gMap: Record<string, string> = {};
      gestores.forEach(g => {
        gMap[g.pessoa_id] = g.gestor_id;
      });
      setGestoresMap(gMap);

      // 2. Buscar eventos
      let data: DiariaEvento[] = [];
      // Buscamos todos os eventos para poder cruzar as permissões de gestor no front-end de forma flexível
      data = await getAllDiariaEventos();
      setEventos(data);
    } catch (error) {
      console.error(error);
      alert("Erro ao buscar lançamentos.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEventos(eventos.length === 0);
  }, [currentUser?.id]);

  useEffect(() => {
    const handleRefresh = (e?: any) => {
      if (e?.detail?.checkpoint && e?.detail?.tripId) {
        const { tripId, checkpoint } = e.detail;
        setEventos(prev => prev.map(evt => evt.id === tripId ? {
          ...evt,
          ultimo_checkpoint: checkpoint,
          checklist: { ...((evt as any).checklist || {}), ultimo_checkpoint: checkpoint }
        } : evt));
      } else {
        fetchEventos(false);
      }
    };
    window.addEventListener('diarias_eventos_updated', handleRefresh);
    window.addEventListener('diarias_checkpoint_updated', handleRefresh);
    window.addEventListener('popstate', handleRefresh);
    return () => {
      window.removeEventListener('diarias_eventos_updated', handleRefresh);
      window.removeEventListener('diarias_checkpoint_updated', handleRefresh);
      window.removeEventListener('popstate', handleRefresh);
    };
  }, []);

  const handleIniciarViagem = async (evento: DiariaEvento) => {
    if (!currentUser) return;
    setStartingTripId(evento.id);
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

    // 1. Atualização otimista na tela sem sair da página
    setEventos(prev => prev.map(e => e.id === evento.id ? optimisticEvento : e));

    // 2. Envio em segundo plano para o banco de dados
    try {
      const updated = await updateDiariaEvento(evento.id, {
        pessoas: updatedPessoas,
        data_saida: inicioIso,
        status: 'em_viagem',
        modo_inicio: 'manual',
        saida_validada: true
      } as any);
      setEventos(prev => prev.map(e => e.id === evento.id ? updated : e));
      window.dispatchEvent(new Event('diarias_eventos_updated'));
    } catch (err) {
      console.error('Erro ao iniciar viagem:', err);
      alert('Falha ao iniciar a viagem. Tente novamente.');
      fetchEventos(false);
    } finally {
      setStartingTripId(null);
    }
  };

  const handleToggleEventoDespesas = async (evento: DiariaEvento) => {
    try {
      const nextVal = !evento.permitir_despesas_pos_finalizacao;
      const updated = await updateDiariaEvento(evento.id, {
        permitir_despesas_pos_finalizacao: nextVal
      });
      setEventos(prev => prev.map(e => e.id === evento.id ? updated : e));
      window.dispatchEvent(new Event('diarias_settings_changed'));
    } catch (err) {
      console.error('Erro ao alternar permissao de despesas do registro:', err);
      alert('Falha ao atualizar permissão de despesas deste registro.');
    }
  };

  const getEffectiveDataSaida = (evento: DiariaEvento | null | undefined): string => {
    if (!evento) return '';
    if (evento.pessoas && Array.isArray(evento.pessoas)) {
      const pWithInicio = evento.pessoas.find(p => (p as any).viagem_inicio);
      if (pWithInicio && (pWithInicio as any).viagem_inicio) {
        return (pWithInicio as any).viagem_inicio;
      }
    }
    return evento.data_saida || '';
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '---';
    // Detectar data sentinela usada quando retorno será registrado pelo servidor em /Diarias/Viajar
    if (dateString.startsWith('2099-12-31')) return 'A definir';
    try {
      const d = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(d);
    } catch (e) {
      return '---';
    }
  };

  const filteredEventos = eventos.filter(evento => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = evento.destino.toLowerCase().includes(term) ||
           evento.motivo.toLowerCase().includes(term) ||
           evento.pessoas.some(p => p.name.toLowerCase().includes(term)) ||
           (evento.status || '').toLowerCase().includes(term);

    if (!matchesSearch) return false;

    // 1. ADMINISTRADOR deve visualizar todos os lançamentos de todos os usuários e gestores
    if (currentUser?.role === 'admin') {
      return true;
    }

    // 2. GESTOR / SERVIDOR só deve ver viagem que ele mesmo lançou, ou que ele é o gestor responsável, ou participante
    const isOwner = evento.user_id === currentUser?.id;
    
    const isParticipant = evento.pessoas && Array.isArray(evento.pessoas) && evento.pessoas.some(p => {
      if (!p || !currentUser) return false;
      if (p.id === currentUser.id) return true;
      const normalize = (t: string) => t ? t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
      return p.name && currentUser.name && normalize(p.name) === normalize(currentUser.name);
    });

    const isGestorOfAnyPerson = evento.pessoas && Array.isArray(evento.pessoas) && evento.pessoas.some(p => {
      const gId = gestoresMap[p.id] || gestoresMap[p.name];
      return gId === currentUser?.id;
    });

    const isTransferredGestor = evento.gestor_transferido_cargo && currentUser?.jobTitle
      ? currentUser.jobTitle.trim().toLowerCase() === evento.gestor_transferido_cargo.trim().toLowerCase()
      : false;

    return isOwner || isParticipant || isGestorOfAnyPerson || isTransferredGestor;
  });

  const mappedOrdersForReport: Order[] = useMemo(() => {
    return filteredEventos.map(evt => {
      const requesterNames = evt.pessoas && Array.isArray(evt.pessoas) && evt.pessoas.length > 0
        ? evt.pessoas.map((p: any) => p.name).join(', ')
        : evt.user_name || 'Servidor não informado';

      const mapStatus = (st: string) => {
        if (st === 'concluido') return 'completed';
        if (st === 'cancelado' || st === 'rejeitado' || st === 'rejeitado_gestor' || st === 'viagem_cancelada') return 'rejected';
        if (st === 'em_viagem' || st === 'aguardando_administrador' || st === 'aguardando_gestor' || st === 'aguardando_aprovacao') return 'approved';
        return 'awaiting_approval';
      };

      const mapPaymentStatus = (st: string) => {
        if (st === 'concluido') return 'paid';
        return (evt as any).payment_status || 'pending';
      };

      return {
        id: String(evt.id),
        protocol: `EVT-${String(evt.id).slice(0, 6).toUpperCase()}`,
        title: `Viagem Oficial: ${evt.destino}`,
        status: mapStatus(evt.status),
        paymentStatus: mapPaymentStatus(evt.status),
        createdAt: evt.created_at || new Date().toISOString(),
        userId: evt.user_id,
        userName: evt.user_name || requesterNames,
        blockType: 'diarias',
        documentSnapshot: {
          branding: { logoUrl: null, primaryColor: '#4f46e5', secondaryColor: '#0f172a', fontFamily: 'font-sans' as any, logoWidth: 76, logoAlignment: 'left' as any, watermark: { enabled: false, imageUrl: null, opacity: 20, size: 55, grayscale: true } },
          document: { headerText: '', footerText: '', city: '', showDate: true, showPageNumbers: true, showSignature: false, showLeftBlock: true, showRightBlock: true, titleStyle: { size: 12, color: '#000000', alignment: 'left' as any }, leftBlockStyle: { size: 10, color: '#000000' }, rightBlockStyle: { size: 10, color: '#000000' } },
          ui: { loginLogoUrl: null, loginLogoHeight: 80, roundedCorners: true, compactMode: false, tableStriped: true },
          content: {
            requesterName: requesterNames,
            destination: evt.destino,
            departureDateTime: evt.data_saida,
            returnDateTime: evt.data_retorno,
            descriptionReason: evt.motivo,
            subType: evt.veiculo,
            requestedValue: evt.valor_diaria ? `R$ ${Number(evt.valor_diaria).toFixed(2)}` : ((evt as any).valor ? `R$ ${Number((evt as any).valor).toFixed(2)}` : 'R$ 0,00'),
            distanceKm: evt.distancia || 0,
            lodgingCount: evt.hospedagem_dias || 0
          }
        }
      } as unknown as Order;
    });
  }, [filteredEventos]);

  const handleSelectModalTab = (tab: 'resumo' | 'justificativa' | 'comprovantes' | 'relatorio') => {
    setModalActiveTab(tab);
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('modalTab', tab);
      window.history.replaceState({}, '', currentUrl.toString());
    } catch (e) {}
  };

  const handleOpenReview = (evento: DiariaEvento) => {
    setSelectedEvento(evento);
    setTransferGestorCargo(evento.gestor_transferido_cargo || '');
    
    // Ler o parametro modalTab da URL se fornecido, senao default 'resumo'
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('modalTab');
    const validTab = (tabParam && ['resumo', 'justificativa', 'comprovantes', 'relatorio'].includes(tabParam))
      ? (tabParam as 'resumo' | 'justificativa' | 'comprovantes' | 'relatorio')
      : 'resumo';
      
    setModalActiveTab(validTab);
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('modalTab', validTab);
      window.history.replaceState({}, '', currentUrl.toString());
    } catch (e) {}

    if ((evento.status === 'aguardando_administrador' || (evento.status === 'concluido' && currentUser?.role === 'admin')) && currentUser?.role === 'admin') {
      setModalType('admin');
      setAdminStep('review');
      setValorDiaria(evento.valor_diaria ? String(evento.valor_diaria) : '');

      // Se já há um relatório salvo, usa ele; senão, pré-popula com texto-base das despesas
      if (evento.relatorio_viagem) {
        setRelatorioViagem(evento.relatorio_viagem);
      } else {
        const comprovantesList: Attachment[] = evento.comprovantes_gestor || [];
        let textBase = '';
        if (comprovantesList.length > 0) {
          const itens = comprovantesList.map((c, i) => {
            const tipo = c.expenseType || c.name || 'Despesa';
            const valor = c.expenseValue ? `R$ ${c.expenseValue}` : 'valor não informado';
            return `${i + 1}. ${tipo}: ${valor}`;
          }).join('\n');

          let total = 0;
          let hasTotal = false;
          comprovantesList.forEach(c => {
            if (c.expenseValue) {
              const num = parseFloat(c.expenseValue.toString().replace(/[^0-9,.-]/g, '').replace(',', '.'));
              if (!isNaN(num)) { total += num; hasTotal = true; }
            }
          });
          const totalStr = hasTotal
            ? `\nTotal de despesas comprovadas: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '';

          textBase = `Despesas registradas durante a viagem:\n${itens}${totalStr}\n\n`;
        }
        setRelatorioViagem(textBase);
      }
    } else {
      setModalType('gestor');
      setJustificativaGestor(evento.justificativa_gestor || '');
      setComprovantes(evento.comprovantes_gestor || []);
    }
  };

  const handleCloseModal = () => {
    setSelectedEvento(null);
    setModalType(null);
    setJustificativaGestor('');
    setComprovantes([]);
    setAdminStep('review');
    setModalActiveTab('resumo');
    setTransferGestorCargo('');
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete('modalTab');
      window.history.replaceState({}, '', currentUrl.toString());
    } catch (e) {}
  };

  const syncRelatorioWithComprovantesList = (list: Attachment[]) => {
    let despesasBlock = '';
    if (list.length > 0) {
      const itens = list.map((c, i) => {
        const tipo = c.expenseType || c.name || 'Despesa';
        const valor = c.expenseValue ? `R$ ${c.expenseValue}` : 'valor não informado';
        return `${i + 1}. ${tipo}: ${valor}`;
      }).join('\n');

      let total = 0;
      let hasTotal = false;
      list.forEach(c => {
        if (c.expenseValue) {
          const num = parseFloat(c.expenseValue.toString().replace(/[^0-9,.-]/g, '').replace(',', '.'));
          if (!isNaN(num)) { total += num; hasTotal = true; }
        }
      });
      const totalStr = hasTotal
        ? `\nTotal de despesas comprovadas: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '';

      despesasBlock = `Despesas registradas durante a viagem:\n${itens}${totalStr}`;
    }

    setRelatorioViagem(prev => {
      if (!prev || prev.includes('Despesas registradas durante a viagem:')) {
        const base = prev ? prev.split(/Despesas registradas durante a viagem:/)[0].trim() : '';
        return despesasBlock ? (base ? `${base}\n\n${despesasBlock}` : despesasBlock) : base;
      }
      return despesasBlock ? `${prev.trim()}\n\n${despesasBlock}` : prev;
    });
  };

  const processComprovanteUpload = async (file: File) => {
    if (!selectedEvento) return;
    setIsUploading(true);
    try {
      const publicUrl = await uploadFile(file, 'attachments', `comprovante_evento_${selectedEvento.id}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
      if (publicUrl) {
        const newAttachment: Attachment = {
          id: Date.now().toString(),
          name: file.name,
          url: publicUrl,
          type: file.type,
          date: new Date().toISOString(),
          expenseType: newExpenseType || 'Despesa',
          expenseValue: newExpenseValue.trim() ? newExpenseValue.trim() : undefined
        };

        const updatedList = [...comprovantes, newAttachment];
        setComprovantes(updatedList);
        syncRelatorioWithComprovantesList(updatedList);
        setNewExpenseValue('');

        // SALVAR IMEDIATAMENTE NO BANCO DE DADOS (SUPABASE)
        const updated = await updateDiariaEvento(selectedEvento.id, {
          comprovantes_gestor: updatedList
        } as any);

        setSelectedEvento(prev => prev ? { ...prev, comprovantes_gestor: updatedList } : null);
        setEventos(prev => prev.map(evt => evt.id === selectedEvento.id ? { ...evt, comprovantes_gestor: updatedList } : evt));
        window.dispatchEvent(new Event('diarias_eventos_updated'));
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar o comprovante.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleComprovanteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedEvento) {
      if (file.type && file.type.startsWith('image/')) {
        setPendingCropFile(file);
      } else {
        processComprovanteUpload(file);
      }
      if (e.target) e.target.value = '';
    }
  };

  const removeComprovante = async (id: string) => {
    if (!selectedEvento) return;
    const updatedList = comprovantes.filter(c => c.id !== id);
    setComprovantes(updatedList);
    syncRelatorioWithComprovantesList(updatedList);

    try {
      await updateDiariaEvento(selectedEvento.id, {
        comprovantes_gestor: updatedList
      } as any);

      setSelectedEvento(prev => prev ? { ...prev, comprovantes_gestor: updatedList } : null);
      setEventos(prev => prev.map(evt => evt.id === selectedEvento.id ? { ...evt, comprovantes_gestor: updatedList } : evt));
      window.dispatchEvent(new Event('diarias_eventos_updated'));
    } catch (err) {
      console.error(err);
      alert("Erro ao remover o comprovante.");
    }
  };

  const handleOpenFinalizeModal = (evento: DiariaEvento) => {
    setFinalizeEventoModal(evento);
    const pWithInicio = evento.pessoas?.find(p => (p as any).viagem_inicio);
    const inicioStr = pWithInicio ? (pWithInicio as any).viagem_inicio : (evento.data_saida || evento.created_at);
    
    let diffHours = 0;
    if (inicioStr) {
      const inicioDate = new Date(inicioStr);
      const agora = new Date();
      diffHours = (agora.getTime() - inicioDate.getTime()) / (1000 * 60 * 60);
    }

    if (diffHours >= 12) {
      setIsFinalizeHospedagemStep(true);
      setFinalHospedagem(false);
      setFinalHospedagemDias(1);
    } else {
      setIsFinalizeHospedagemStep(false);
    }
  };

  const handleConfirmFinalizarViagemInLancamentos = async () => {
    if (!finalizeEventoModal) return;
    setIsFinalizingSubmitting(true);
    const fimIso = new Date().toISOString();

    const updatedPessoas = (finalizeEventoModal.pessoas && finalizeEventoModal.pessoas.length > 0)
      ? finalizeEventoModal.pessoas.map(p => ({
          ...p,
          viagem_fim: (p as any).viagem_fim || fimIso
        }))
      : [{ id: currentUser.id, name: currentUser.name, viagem_fim: fimIso }] as any;

    const pWithInicio = finalizeEventoModal.pessoas?.find(p => (p as any).viagem_inicio);
    const inicioStr = pWithInicio ? (pWithInicio as any).viagem_inicio : (finalizeEventoModal.data_saida || fimIso);
    const diffMs = new Date(fimIso).getTime() - new Date(inicioStr).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    const useHospedagem = diffHours >= 12 ? finalHospedagem : (finalizeEventoModal.hospedagem || false);
    const useHospedagemDias = diffHours >= 12 ? (finalHospedagem ? finalHospedagemDias : 0) : (finalizeEventoModal.hospedagem_dias || 0);

    try {
      const updated = await updateDiariaEvento(finalizeEventoModal.id, {
        pessoas: updatedPessoas,
        data_retorno: fimIso,
        status: 'aguardando_gestor',
        hospedagem: useHospedagem,
        hospedagem_dias: useHospedagemDias
      });

      setEventos(prev => prev.map(e => e.id === finalizeEventoModal.id ? updated : e));
      setFinalizeEventoModal(null);
      alert('Viagem finalizada com sucesso!');
      fetchEventos(false);
    } catch (err) {
      console.error('Erro ao finalizar viagem em Lançamentos:', err);
      alert('Falha ao finalizar a viagem.');
    } finally {
      setIsFinalizingSubmitting(false);
    }
  };

  const handleGestorApprove = async () => {
    if (!selectedEvento) return;

    if (selectedEvento.status === 'aguardando_aprovacao') {
      setIsSubmitting(true);
      try {
        await updateDiariaEvento(selectedEvento.id, {
          status: 'viagem_programada',
          justificativa_gestor: justificativaGestor.trim() || undefined,
          comprovantes_gestor: comprovantes
        });
        await fetchEventos();
        handleCloseModal();
      } catch (err) {
        console.error(err);
        alert("Erro ao aprovar solicitação de viagem.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (justificativaGestor.trim().length < 300) return;
    setIsSubmitting(true);
    try {
      const isTransferring = Boolean(transferGestorCargo);
      await updateDiariaEvento(selectedEvento.id, {
        justificativa_gestor: justificativaGestor.trim(),
        comprovantes_gestor: comprovantes,
        gestor_transferido_cargo: transferGestorCargo || undefined,
        status: isTransferring ? 'aguardando_gestor' : 'aguardando_administrador'
      });
      fetchEventos();
      handleCloseModal();
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar aprovação do gestor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGestorReject = async () => {
    if (!selectedEvento || !rejectionReason.trim()) {
      alert("Por favor, preencha a justificativa de rejeição.");
      return;
    }
    setIsSubmitting(true);
    try {
      await updateDiariaEvento(selectedEvento.id, {
        status: 'rejeitado_gestor',
        justificativa_gestor: `[REJEITADO pelo GESTOR] ${rejectionReason.trim()}`
      });
      fetchEventos();
      setIsRejectModalOpen(false);
      setRejectionReason('');
      handleCloseModal();
    } catch (err) {
      console.error(err);
      alert("Erro ao rejeitar a diária.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateDiariaPDF = (
    evento: DiariaEvento,
    valor: string,
    relatorio: string,
    servidorNomeParam: string,
    cargoServidorParam: string,
    setorNomeParam: string,
    autorizadoPorParam: string,
    distanciaKmParam: string,
    despesasTextoParam: string,
    digitalSigParam?: any,
    comprovantesParam?: Attachment[]
  ) => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const dataSaidaFormatted = evento.data_saida ? new Date(evento.data_saida).toLocaleString('pt-BR') : '---';
      const dataRetornoFormatted = evento.data_retorno
        ? (evento.data_retorno.startsWith('2099-12-31') ? 'A definir' : new Date(evento.data_retorno).toLocaleString('pt-BR'))
        : '---';
      const pernoites = evento.hospedagem ? (evento.hospedagem_dias || 1) : 0;
      const protocol = `DIA-${evento.id.slice(0, 4).toUpperCase()}/${new Date().getFullYear()}`;
      const veiculoStr = evento.veiculo === 'OUTRO'
        ? (evento.veiculo_outro || 'Veículo Personalizado')
        : (evento.veiculo || 'Não informado');

      const valorFormatado = valor.startsWith('R$') ? valor : `R$ ${valor}`;

      const listComprovantes: Attachment[] = comprovantesParam || evento.comprovantes_gestor || [];
      const totalComprovantes = listComprovantes.length;

      // Função auxiliar para dividir o texto do relatório em blocos apenas se ultrapassar uma folha inteira
      const splitTextIntoBlocks = (text: string, maxCharsPerBlock = 4500): string[] => {
        const cleanText = (text || '').trim() || 'Relatório de viagem não informado.';
        if (cleanText.length <= maxCharsPerBlock) return [cleanText];
        
        const paragraphs = cleanText.split('\n');
        const blocks: string[] = [];
        let currentBlock = '';

        for (const p of paragraphs) {
          if ((currentBlock + '\n' + p).length > maxCharsPerBlock && currentBlock.length > 0) {
            blocks.push(currentBlock.trim());
            currentBlock = p;
          } else {
            currentBlock = currentBlock ? `${currentBlock}\n${p}` : p;
          }
        }
        if (currentBlock.trim().length > 0) {
          blocks.push(currentBlock.trim());
        }

        return blocks.length > 0 ? blocks : [cleanText];
      };

      const relatorioText = (relatorio || '').trim() || 'Relatório de viagem não informado.';
      const relatorioBlocks = splitTextIntoBlocks(relatorioText, 4500);
      const numRelatorioPages = relatorioBlocks.length;

      // Páginas dedicadas aos comprovantes (exatamente 4 por folha em tamanho padronizado)
      const numComprovantesPages = totalComprovantes > 0 ? Math.ceil(totalComprovantes / 4) : 0;

      const totalPages = 1 + numRelatorioPages + (totalComprovantes > 0 ? numComprovantesPages : 0);

      const renderCard = (c: Attachment, idx: number) => {
        const isImage = (c.type && c.type.startsWith('image/')) ||
          /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?.*)?$/i.test(c.url || '') ||
          /\.(jpg|jpeg|png|webp|gif|bmp|svg)/i.test(c.name || '');
        const tipo = c.expenseType || c.name || 'Despesa';
        const valor = c.expenseValue ? `R$ ${c.expenseValue}` : '—';
        const imgOrLink = isImage
          ? `<div class="comp-img-wrap"><img class="comp-img" src="${c.url}" alt="Comprovante ${idx + 1}" crossorigin="anonymous" /></div>`
          : `<div class="comp-img-wrap"><a class="comp-link" href="${c.url}" target="_blank">📎 Visualizar arquivo anexo</a></div>`;
        const filename = c.name ? `<div class="comp-filename">${c.name}</div>` : '';
        return `<div class="comprovante-card">
          <div class="comp-header">
            <span class="comp-num">#${idx + 1}</span>
            <span class="comp-tipo">${tipo}</span>
            <span class="comp-valor">${valor}</span>
          </div>
          ${imgOrLink}
          ${filename}
        </div>`;
      };

      // Gerar páginas do Relatório
      let relatorioPagesHtml = '';
      for (let rIndex = 0; rIndex < relatorioBlocks.length; rIndex++) {
        const pageNum = 2 + rIndex;
        const isLastRelatorioPage = rIndex === relatorioBlocks.length - 1;
        const blockText = relatorioBlocks[rIndex];

        let section06Html = '';
        if (isLastRelatorioPage && totalComprovantes === 0) {
          section06Html = `
            <div class="section-box">
              <div class="section-header">06. COMPROVAÇÃO DE DESPESAS</div>
              <div class="section-body">
                <div class="despesas-texto-simples">Em relação às despesas, não foram anexados comprovantes adicionais.</div>
              </div>
            </div>
          `;
        }

        const isOverallLastPage = pageNum === totalPages;

        relatorioPagesHtml += `
          <div class="page ${isOverallLastPage ? 'page-last' : ''}">
            <div>
              <div class="header">
                <div style="display: flex; align-items: center; gap: 14px;">
                  ${logoUrl ? `<img src="${logoUrl}" alt="Logo Prefeitura" style="max-height: 55px; width: auto; object-fit: contain;" />` : ''}
                  <div>
                    <div class="header-title">PREFEITURA MUNICIPAL DE SÃO JOSÉ DO GOIABAL</div>
                    <div class="header-subtitle">CONCESSÃO DE DIÁRIA E AUTORIZAÇÃO DE VIAGEM OFICIAL</div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div class="protocol-badge">${protocol}</div>
                  <div><span class="status-badge">CONCLUÍDO / GERADO</span></div>
                </div>
              </div>

              <!-- 05. RELATÓRIO E JUSTIFICATIVA DA VIAGEM -->
              <div class="section-box">
                <div class="section-header">05. RELATÓRIO E JUSTIFICATIVA DA VIAGEM ${numRelatorioPages > 1 ? `(PARTE ${rIndex + 1}/${numRelatorioPages})` : ''}</div>
                <div class="section-body">
                  <div class="justificativa-box">${blockText}</div>
                </div>
              </div>

              ${section06Html}
            </div>

            <!-- Rodapé Página ${pageNum} -->
            <div class="footer-bar">
              <span>Código da Viagem: <strong style="color: #0f172a;">${protocol}</strong></span>
              <span>Página ${pageNum} de ${totalPages}</span>
            </div>
          </div>
        `;
      }

      // Gerar páginas exclusivas de comprovantes (exatamente 04 por folha em grade 2x2 padronizada)
      let extraComprovantesPagesHtml = '';
      if (totalComprovantes > 0) {
        for (let ep = 0; ep < numComprovantesPages; ep++) {
          const currentPageNum = 1 + numRelatorioPages + 1 + ep;
          const isOverallLastPage = currentPageNum === totalPages;
          const startIndex = ep * 4;
          const pageCards = listComprovantes.slice(startIndex, startIndex + 4);
          const cardsHtml = pageCards.map((c, i) => renderCard(c, startIndex + i)).join('');

          extraComprovantesPagesHtml += `
            <div class="page ${isOverallLastPage ? 'page-last' : ''}">
              <div>
                <div class="header">
                  <div style="display: flex; align-items: center; gap: 14px;">
                    ${logoUrl ? `<img src="${logoUrl}" alt="Logo Prefeitura" style="max-height: 55px; width: auto; object-fit: contain;" />` : ''}
                    <div>
                      <div class="header-title">PREFEITURA MUNICIPAL DE SÃO JOSÉ DO GOIABAL</div>
                      <div class="header-subtitle">CONCESSÃO DE DIÁRIA E AUTORIZAÇÃO DE VIAGEM OFICIAL</div>
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div class="protocol-badge">${protocol}</div>
                    <div><span class="status-badge">CONCLUÍDO / GERADO</span></div>
                  </div>
                </div>

                <!-- 06. COMPROVAÇÃO DE DESPESAS -->
                <div class="section-box">
                  <div class="section-header">06. COMPROVAÇÃO DE DESPESAS ${numComprovantesPages > 1 ? `(FOLHA ${ep + 1}/${numComprovantesPages})` : ''}</div>
                  <div class="section-body">
                    <div class="comprovantes-grid">${cardsHtml}</div>
                  </div>
                </div>
              </div>

              <!-- Rodapé Página ${currentPageNum} -->
              <div class="footer-bar">
                <span>Código da Viagem: <strong style="color: #0f172a;">${protocol}</strong></span>
                <span>Página ${currentPageNum} de ${totalPages}</span>
              </div>
            </div>
          `;
        }
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Processo de Diária Oficial - ${protocol}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            @page {
              size: A4 portrait;
              margin: 0;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { 
              font-family: 'Inter', sans-serif; 
              color: #1e293b; 
              background: #ffffff;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .page {
              width: 210mm;
              height: 297mm;
              max-height: 297mm;
              padding: 14mm 14mm 24mm 14mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              page-break-after: always;
              break-after: page;
              box-sizing: border-box;
              position: relative;
              overflow: hidden;
            }
            .page-last {
              page-break-after: avoid;
              break-after: avoid;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .header-title {
              font-size: 13.5px;
              font-weight: 900;
              text-transform: uppercase;
              color: #0f172a;
              letter-spacing: -0.02em;
            }
            .header-subtitle {
              font-size: 9.5px;
              color: #64748b;
              font-weight: 700;
              text-transform: uppercase;
              margin-top: 1px;
            }
            .protocol-badge {
              font-family: monospace;
              font-size: 10.5px;
              font-weight: 800;
              background: #f1f5f9;
              color: #334155;
              padding: 4px 10px;
              border-radius: 6px;
              border: 1px solid #cbd5e1;
            }
            .status-badge {
              display: inline-block;
              font-size: 8px;
              font-weight: 900;
              text-transform: uppercase;
              background: #dcfce7;
              color: #15803d;
              padding: 2px 7px;
              border-radius: 4px;
              border: 1px solid #bbf7d0;
              margin-top: 3px;
            }
            .section-box {
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              overflow: hidden;
              margin-bottom: 10px;
              background: #ffffff;
            }
            .section-header {
              background: #f1f5f9;
              padding: 4px 10px;
              border-bottom: 1px solid #cbd5e1;
              font-size: 8pt;
              font-weight: 900;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.05em;
            }
            .section-body {
              padding: 8px 12px;
            }
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            .grid-3 {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 10px;
            }
            .label {
              font-size: 7pt;
              font-weight: 900;
              text-transform: uppercase;
              color: #64748b;
              display: block;
              margin-bottom: 2px;
            }
            .value {
              font-size: 9.5pt;
              font-weight: 700;
              color: #0f172a;
            }
            .value-highlight {
              font-size: 13pt;
              font-weight: 900;
              color: #4f46e5;
            }
            .justificativa-box {
              font-size: 9pt;
              line-height: 1.45;
              color: #1e293b;
              white-space: pre-wrap;
              word-break: break-word;
              background: #fafafa;
              padding: 12px;
              border-radius: 6px;
              border: 1px solid #e2e8f0;
              font-style: italic;
              min-height: 140mm;
            }
            .signatures {
              margin-top: 60px;
              margin-bottom: 10px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              text-align: center;
            }
            .signature-line {
              border-top: 1.5px solid #0f172a;
              padding-top: 4px;
              position: relative;
            }
            .signature-name {
              font-size: 9pt;
              font-weight: 900;
              text-transform: uppercase;
            }
            .signature-role {
              font-size: 7.5pt;
              color: #64748b;
              font-weight: 700;
              text-transform: uppercase;
            }
            .footer-bar {
              position: absolute;
              bottom: 8mm;
              left: 14mm;
              right: 14mm;
              padding-top: 8px;
              border-top: 1px dashed #cbd5e1;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8.5pt;
              font-weight: 700;
              color: #475569;
              background: #ffffff;
              z-index: 100;
            }
            .comprovantes-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 14px;
              margin-top: 2px;
            }
            .comprovante-card {
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              overflow: hidden;
              background: #ffffff;
              height: 350px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .comp-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 6px 10px;
              background: #f1f5f9;
              border-bottom: 1px solid #cbd5e1;
            }
            .comp-num {
              font-size: 8.5pt;
              font-weight: 900;
              color: #64748b;
              font-family: monospace;
            }
            .comp-tipo {
              font-size: 9pt;
              font-weight: 900;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.02em;
              flex: 1;
              padding: 0 8px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .comp-valor {
              font-size: 9.5pt;
              font-weight: 900;
              color: #4f46e5;
            }
            .comp-img-wrap {
              padding: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 280px;
              min-height: 280px;
              background: #ffffff;
              overflow: hidden;
              position: relative;
            }
            .comp-img {
              max-width: 95%;
              max-height: 250px;
              object-fit: contain;
              border-radius: 4px;
              transform: rotate(90deg) scale(1.35);
              -webkit-transform: rotate(90deg) scale(1.35);
            }
            .comp-link {
              display: flex;
              align-items: center;
              gap: 6px;
              padding: 10px;
              font-size: 8pt;
              color: #4f46e5;
              font-weight: 700;
              text-decoration: none;
              word-break: break-all;
            }
            .comp-filename {
              font-size: 7.5pt;
              color: #64748b;
              font-weight: 500;
              padding: 4px 10px 8px;
              font-style: italic;
            }
            .despesas-texto-simples {
              font-size: 9.5pt;
              line-height: 1.5;
              color: #334155;
            }
            @media print {
              @page {
                size: A4 portrait;
                margin: 0;
              }
              html, body {
                margin: 0;
                padding: 0;
              }
              .page {
                padding: 12mm 14mm 22mm 14mm;
                width: 210mm;
                height: 297mm;
                max-height: 297mm;
                box-sizing: border-box;
                page-break-after: always;
                break-after: page;
                position: relative;
                overflow: hidden;
              }
              .footer-bar {
                position: absolute;
                bottom: 6mm;
                left: 14mm;
                right: 14mm;
                padding-top: 6px;
                border-top: 1px dashed #cbd5e1;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 8.5pt;
                font-weight: 700;
                color: #475569;
                background: #ffffff;
                z-index: 100;
              }
              .page-last {
                page-break-after: avoid;
                break-after: avoid;
              }
              .comprovante-card {
                page-break-inside: avoid;
                break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <!-- PÁGINA INICIAL (PÁGINA 1) -->
          <div class="page">
            <div>
              <div class="header">
                <div style="display: flex; align-items: center; gap: 14px;">
                  ${logoUrl ? `<img src="${logoUrl}" alt="Logo Prefeitura" style="max-height: 55px; width: auto; object-fit: contain;" />` : ''}
                  <div>
                    <div class="header-title">PREFEITURA MUNICIPAL DE SÃO JOSÉ DO GOIABAL</div>
                    <div class="header-subtitle">CONCESSÃO DE DIÁRIA E AUTORIZAÇÃO DE VIAGEM OFICIAL</div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div class="protocol-badge">${protocol}</div>
                  <div><span class="status-badge">CONCLUÍDO / GERADO</span></div>
                </div>
              </div>

              <!-- 01. DADOS DO BENEFICIÁRIO -->
              <div class="section-box">
                <div class="section-header">01. DADOS DO BENEFICIÁRIO</div>
                <div class="section-body">
                  <div style="margin-bottom: 10px;">
                    <span class="label">Nome do Servidor</span>
                    <span class="value" style="font-size: 12pt;">${servidorNomeParam}</span>
                  </div>
                  <div class="grid-2">
                    <div>
                      <span class="label">Cargo / Função</span>
                      <span class="value">${cargoServidorParam}</span>
                    </div>
                    <div>
                      <span class="label">Setor de Atendimento</span>
                      <span class="value">${setorNomeParam}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 02. LOGÍSTICA E ITINERÁRIO -->
              <div class="section-box">
                <div class="section-header">02. LOGÍSTICA E ITINERÁRIO</div>
                <div class="section-body">
                  <div style="margin-bottom: 10px;">
                    <span class="label">Destino (Cidade / UF)</span>
                    <span class="value">${evento.destino}</span>
                  </div>
                  <div class="grid-2" style="margin-bottom: 10px;">
                    <div style="background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                      <span class="label">Data / Hora de Saída</span>
                      <span class="value">${dataSaidaFormatted}</span>
                    </div>
                    <div style="background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                      <span class="label">Data / Hora de Retorno</span>
                      <span class="value">${dataRetornoFormatted}</span>
                    </div>
                  </div>
                  <div class="grid-3">
                    <div>
                      <span class="label">Noites de Hospedagem</span>
                      <span class="value">${pernoites}</span>
                    </div>
                    <div>
                      <span class="label">Distância Prevista</span>
                      <span class="value">${distanciaKmParam}</span>
                    </div>
                    <div>
                      <span class="label">Veículo Utilizado</span>
                      <span class="value">${veiculoStr}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 03. RESUMO FINANCEIRO E AUTORIZAÇÃO -->
              <div class="section-box">
                <div class="section-header">03. RESUMO FINANCEIRO E AUTORIZAÇÃO</div>
                <div class="section-body">
                  <div class="grid-2" style="align-items: center;">
                    <div>
                      <span class="label">Valor Concedido da Diária</span>
                      <span class="value-highlight">${valorFormatado}</span>
                    </div>
                    <div>
                      <span class="label">Autorizado Por</span>
                      <span class="value">${autorizadoPorParam}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 04. MOTIVO DA VIAGEM (SOLICITAÇÃO INICIAL) -->
              <div class="section-box">
                <div class="section-header">04. MOTIVO DA VIAGEM (SOLICITAÇÃO INICIAL)</div>
                <div class="section-body">
                  <div class="justificativa-box">${evento.motivo || 'Motivo não informado.'}</div>
                </div>
              </div>

              <!-- Assinaturas -->
              <br/><br/><br/><br/><br/><br/><br/><br/><br/><br/>
              <div class="signatures">
                <div class="signature-line">
                  <div class="signature-name">${servidorNomeParam}</div>
                  <div class="signature-role">Servidor Solicitante</div>
                </div>
                <div class="signature-line">
                  ${(digitalSigParam || evento.digital_signature)?.enabled ? `
                    <div style="position: absolute; bottom: 100%; left: 0; right: 0; text-align: center; font-size: 6.5pt; color: #16a34a; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; padding-bottom: 2px; line-height: 1.1;">
                      <span style="border: 1px solid #16a34a; padding: 1px 4px; border-radius: 3px; background-color: #f0fdf4; display: inline-block; margin-bottom: 2px;">Assinado Digitalmente</span><br/>
                      <span style="font-size: 5.2pt; color: #475569; font-weight: 500; font-family: monospace; text-transform: none; display: block; line-height: 1.0;">
                        IP: ${(digitalSigParam || evento.digital_signature).ip}<br/>
                        ID: ${(digitalSigParam || evento.digital_signature).id.substring(0, 18)}...<br/>
                        Data: ${new Date((digitalSigParam || evento.digital_signature).date).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ` : ''}
                  <div class="signature-name">${autorizadoPorParam}</div>
                  <div class="signature-role">Gestor / Autorizador</div>
                </div>
              </div>
            </div>

            <!-- Rodapé Página 1 -->
            <div class="footer-bar">
              <span>Código da Viagem: <strong style="color: #0f172a;">${protocol}</strong></span>
              <span>Página 1 de ${totalPages}</span>
            </div>
          </div>

          <!-- PÁGINAS DO RELATÓRIO DA VIAGEM (PÁGINA 2 E SEGUINTES) -->
          ${relatorioPagesHtml}

          <!-- PÁGINAS EXTRAS DE COMPROVANTES (SE HOUVER) -->
          ${extraComprovantesPagesHtml}
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 400);
    } catch (e) {
      console.error("Erro ao gerar janela de impressão PDF:", e);
    }
  };

  const handleDownloadPDF = (evento: DiariaEvento) => {
    const sNome = evento.pessoas[0]?.name || 'Servidor não informado';
    const pessoaObj = evento.pessoas[0];

    const getCargo = () => {
      if (!pessoaObj) return 'Cargo não informado';
      const normalizeName = (n: string) => n.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const targetName = pessoaObj.name ? normalizeName(pessoaObj.name) : '';
      const matchedPerson = persons.find(p => p.id === pessoaObj.id || (p.name && normalizeName(p.name) === targetName));
      if (matchedPerson && matchedPerson.jobId) {
        const jobObj = jobs.find(j => j.id === matchedPerson.jobId);
        if (jobObj && jobObj.name) return jobObj.name;
      }
      const profile = profiles.find(p => p.id === pessoaObj.id || (p.name && normalizeName(p.name) === targetName));
      if (profile && (profile.job_title || profile.jobTitle || profile.job)) {
        return profile.job_title || profile.jobTitle || profile.job;
      }
      return 'Cargo não informado';
    };

    const cServidor = getCargo();
    const stNome = sectors.find(s => s.id === evento.setor_id)?.name || evento.user_name || 'Setor Solicitante';
    const autPor = evento.gestor_transferido_cargo
      ? evento.gestor_transferido_cargo
      : (sectors.find(s => s.id === evento.setor_id)?.name || 'Gestor do Setor Responsável');
    const distKm = evento.distancia ? `${evento.distancia} KM` : 'Não informada';

    const comprovantesList: Attachment[] = evento.comprovantes_gestor || [];
    const despesasStr = (() => {
      if (!comprovantesList || comprovantesList.length === 0) {
        return `<div class="despesas-texto-simples">Em relação às despesas, não foram anexados comprovantes adicionais.</div>`;
      }
      const cardsHtml = comprovantesList.map((c, idx) => {
        const isImage = (c.type && c.type.startsWith('image/')) ||
          /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?.*)?$/i.test(c.url || '') ||
          /\.(jpg|jpeg|png|webp|gif|bmp|svg)/i.test(c.name || '');
        const tipo = c.expenseType || c.name || 'Despesa';
        const valor = c.expenseValue ? `R$ ${c.expenseValue}` : '—';
        const imgOrLink = isImage
          ? `<div class="comp-img-wrap"><img class="comp-img" src="${c.url}" alt="Comprovante ${idx + 1}" crossorigin="anonymous" /></div>`
          : `<div class="comp-img-wrap"><a class="comp-link" href="${c.url}" target="_blank">📎 Visualizar arquivo anexo</a></div>`;
        const filename = c.name ? `<div class="comp-filename">${c.name}</div>` : '';
        return `<div class="comprovante-card">
          <div class="comp-header">
            <span class="comp-num">#${idx + 1}</span>
            <span class="comp-tipo">${tipo}</span>
            <span class="comp-valor">${valor}</span>
          </div>
          ${imgOrLink}
          ${filename}
        </div>`;
      }).join('');
      return `<div class="comprovantes-grid">${cardsHtml}</div>`;
    })();

    const valorStr = evento.valor_diaria ? `R$ ${evento.valor_diaria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00';
    const relatorioStr = evento.relatorio_viagem || 'Relatório de viagem não informado.';

    generateDiariaPDF(
      evento,
      valorStr,
      relatorioStr,
      sNome,
      cServidor,
      stNome,
      autPor,
      distKm,
      despesasStr,
      undefined,
      comprovantesList
    );
  };

  const handleAdminGenerate = async (bypass2FA = false) => {
    if (!selectedEvento || !valorDiaria) return;

    if (!relatorioViagem.trim()) {
      handleSelectModalTab('relatorio');
      alert("O preenchimento da aba RELATÓRIO DA VIAGEM é OBRIGATÓRIO!");
      return;
    }

    if (!bypass2FA && currentUser && (currentUser.twoFactorEnabled || currentUser.twoFactorEnabled2)) {
      setIs2FAModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const valorFloat = parseFloat(valorDiaria.replace(/[^\d,.-]/g, '').replace(',', '.'));

      const digitalSigData = {
        enabled: true,
        method: currentUser && (currentUser.twoFactorEnabled || currentUser.twoFactorEnabled2) ? '2FA Token (App)' : 'Assinatura Simples (Login)',
        ip: 'Client-Device',
        date: new Date().toISOString(),
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2),
        signerName: currentUser?.name || 'Administrador'
      };

      await updateDiariaEvento(selectedEvento.id, {
        valor_diaria: valorFloat,
        relatorio_viagem: relatorioViagem.trim(),
        status: 'concluido',
        digital_signature: digitalSigData
      });

      const sNome = selectedEvento.pessoas[0]?.name || 'Servidor não informado';
      const pessoaObj = selectedEvento.pessoas[0];

      const getCargo = () => {
        if (!pessoaObj) return 'Cargo não informado';
        const normalizeName = (n: string) => n.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const targetName = pessoaObj.name ? normalizeName(pessoaObj.name) : '';
        const matchedPerson = persons.find(p => p.id === pessoaObj.id || (p.name && normalizeName(p.name) === targetName));
        if (matchedPerson && matchedPerson.jobId) {
          const jobObj = jobs.find(j => j.id === matchedPerson.jobId);
          if (jobObj && jobObj.name) return jobObj.name;
        }
        const profile = profiles.find(p => p.id === pessoaObj.id || (p.name && normalizeName(p.name) === targetName));
        if (profile && (profile.job_title || profile.jobTitle || profile.job)) {
          return profile.job_title || profile.jobTitle || profile.job;
        }
        return 'Cargo não informado';
      };

      const cServidor = getCargo();
      const stNome = sectors.find(s => s.id === selectedEvento.setor_id)?.name || selectedEvento.user_name || 'Setor Solicitante';
      const autPor = selectedEvento.gestor_transferido_cargo
        ? selectedEvento.gestor_transferido_cargo
        : (sectors.find(s => s.id === selectedEvento.setor_id)?.name || 'Gestor do Setor Responsável');
      const distKm = selectedEvento.distancia ? `${selectedEvento.distancia} KM` : 'Não informada';

      const comprovantesList: Attachment[] = selectedEvento.comprovantes_gestor || [];
      const despesasStr = (() => {
        if (!comprovantesList || comprovantesList.length === 0) {
          return `<div class="despesas-texto-simples">Em relação às despesas, não foram anexados comprovantes adicionais.</div>`;
        }
        const cardsHtml = comprovantesList.map((c, idx) => {
          const isImage = (c.type && c.type.startsWith('image/')) ||
          /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?.*)?$/i.test(c.url || '') ||
          /\.(jpg|jpeg|png|webp|gif|bmp|svg)/i.test(c.name || '');
          const tipo = c.expenseType || c.name || 'Despesa';
          const valor = c.expenseValue ? `R$ ${c.expenseValue}` : '—';
          const imgOrLink = isImage
            ? `<div class="comp-img-wrap"><img class="comp-img" src="${c.url}" alt="Comprovante ${idx + 1}" crossorigin="anonymous" /></div>`
            : `<div class="comp-img-wrap"><a class="comp-link" href="${c.url}" target="_blank">📎 Visualizar arquivo anexo</a></div>`;
          const filename = c.name ? `<div class="comp-filename">${c.name}</div>` : '';
          return `<div class="comprovante-card">
            <div class="comp-header">
              <span class="comp-num">#${idx + 1}</span>
              <span class="comp-tipo">${tipo}</span>
              <span class="comp-valor">${valor}</span>
            </div>
            ${imgOrLink}
            ${filename}
          </div>`;
        }).join('');
        return `<div class="comprovantes-grid">${cardsHtml}</div>`;
      })();

      // 1. Gera e dispara o PDF oficial direto
      generateDiariaPDF(
        selectedEvento,
        valorDiaria,
        relatorioViagem.trim(),
        sNome,
        cServidor,
        stNome,
        autPor,
        distKm,
        despesasStr,
        digitalSigData,
        comprovantesList
      );

      await fetchEventos();
      handleCloseModal();

      // 2. Redireciona o usuário para a rota /Diarias/Lancamentos
      window.history.pushState({}, '', '/Diarias/Lancamentos');
      window.dispatchEvent(new Event('popstate'));
    } catch (err) {
      console.error(err);
      alert("Erro ao finalizar a aprovação e gerar a diária.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir permanentemente este lançamento de viagem?")) {
      const targetId = String(id).trim();
      setEventos(prev => prev.filter(e => String(e.id).trim() !== targetId));
      try {
        await deleteDiariaEvento(targetId);
        await fetchEventos();
      } catch (err) {
        console.error(err);
        await fetchEventos();
      }
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = status || 'aguardando_gestor';
    switch (s) {
      case 'viagem_programada':
        return { label: 'Viagem Programada', style: 'border-indigo-200 bg-indigo-50 text-indigo-700' };
      case 'em_viagem':
        return { label: 'Em Viagem', style: 'border-emerald-300 bg-emerald-100 text-emerald-800 animate-pulse' };
      case 'aguardando_aprovacao':
        return { label: 'Aguardando Aprovação', style: 'border-amber-200 bg-amber-50 text-amber-700' };
      case 'aguardando_gestor':
        return { label: 'Aguardando Gestor', style: 'border-amber-200 bg-amber-50 text-amber-700' };
      case 'rejeitado_gestor':
        return { label: 'Rejeitado pelo Gestor', style: 'border-rose-200 bg-rose-50 text-rose-700' };
      case 'aguardando_administrador':
        return { label: 'Aguardando Admin', style: 'border-blue-200 bg-blue-50 text-blue-700' };
      case 'concluido':
        return { label: 'Concluído', style: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
      case 'cancelado':
      case 'viagem_cancelada':
        return { label: 'Viagem Cancelada', style: 'border-slate-300 bg-slate-200 text-slate-700 font-bold' };
      default:
        return { label: 'Registrado', style: 'border-slate-200 bg-slate-50 text-slate-700' };
    }
  };

  return (
    <div className="flex-1 h-full w-full bg-slate-100/50 backdrop-blur-sm font-sans flex items-center justify-center p-4 desktop:p-8 overflow-hidden animate-fade-in">
      <div className="w-full max-w-7xl bg-white rounded-[2.5rem] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden animate-slide-up flex flex-col h-full max-h-full">
        
        <div className="p-4 border-b border-slate-100 shrink-0 bg-white transition-all">
          <div className="flex flex-col desktop:flex-row desktop:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="contents">
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors font-bold uppercase tracking-widest group text-[10px] p-2 hover:bg-slate-50 rounded-lg -ml-2"
                  title="Voltar"
                >
                  <ArrowLeft className="transition-transform w-3 h-3" />
                </button>
                <h2 className="text-sm xs:text-base sm:text-lg md:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <span className="truncate uppercase">Eventos de Viagem</span>
                </h2>
              </div>
            </div>

            <div className="flex-1 max-w-lg flex items-center gap-2">
              <div className="relative flex-1 group">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por destino, motivo, pessoa..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all pl-9 pr-3 py-2 text-xs"
                />
                <Search className="absolute top-1/2 -translate-y-1/2 text-slate-400 left-3 w-3.5 h-3.5" />
              </div>
              <button
                onClick={() => fetchEventos(false)}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all font-bold text-[10px] uppercase tracking-widest whitespace-nowrap active:scale-95 shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              <button
                onClick={() => setShowReportModal(true)}
                className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest active:scale-95 shrink-0"
                title="Exportar Relatório"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span className="hidden desktop:inline">Relatório</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100/80">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-slate-400 font-medium text-sm animate-pulse">Carregando lançamentos...</p>
            </div>
          ) : filteredEventos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 h-full">
              <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-12 text-center flex flex-col items-center justify-center w-full max-w-2xl mx-auto shadow-sm">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2 tracking-tight">
                  {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum evento registrado'}
                </h3>
                <p className="text-sm text-slate-500 font-medium">
                  {searchTerm 
                    ? 'Tente ajustar os termos da sua pesquisa.' 
                    : 'Ainda não há eventos cadastrados.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="min-w-full">
              <div className="border-b border-slate-100 bg-slate-50 hidden desktop:grid desktop:grid-cols-12 gap-3 px-6 py-3 sticky top-0 z-10">
                <div className="desktop:col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5 whitespace-nowrap">
                  <Calendar className="w-3 h-3" /> Data
                </div>
                <div className="desktop:col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5 whitespace-nowrap">
                  <HashIcon className="w-3 h-3" /> ID
                </div>
                <div className="desktop:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap">
                  <MapPin className="w-3 h-3" /> Destino / Servidor
                </div>
                <div className="desktop:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap">
                  <FileText className="w-3 h-3" /> Motivo
                </div>
                <div className="desktop:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5 whitespace-nowrap">
                  Status
                </div>
                <div className="desktop:col-span-4 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-1.5 whitespace-nowrap pr-2">
                  Ações
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredEventos.map(evento => {
                  const createdDate = new Date(evento.created_at || new Date());
                  const monthName = createdDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
                  const yearLabel = createdDate.toLocaleDateString('pt-BR', { year: '2-digit' });
                  const badge = getStatusBadge(evento.status);
                  
                  const pessoaId = evento.pessoas[0]?.id || '';
                  const gestorId = gestoresMap[pessoaId] || '';
                  const hasGestor = !!gestorId;

                  const isConfiguredGestor = currentUser?.id === gestorId;
                  const isAdmin = currentUser?.role === 'admin';

                  const isTransferredGestor = evento.gestor_transferido_cargo
                    ? (currentUser?.jobTitle?.trim().toLowerCase() === evento.gestor_transferido_cargo.trim().toLowerCase() || isAdmin)
                    : false;

                  const isCurrentUserGestor = evento.gestor_transferido_cargo ? isTransferredGestor : (isConfiguredGestor || isAdmin);

                  const canApproveAguardandoAprovacao = evento.status === 'aguardando_aprovacao' && (
                    hasGestor ? (isConfiguredGestor || isAdmin) : isAdmin
                  );

                  const gestorCanAct = (evento.status === 'aguardando_gestor' || !evento.status) && isCurrentUserGestor;
                  const adminCanAct = evento.status === 'aguardando_administrador' && isAdmin;

                  const canAct = canApproveAguardandoAprovacao || gestorCanAct || adminCanAct;

                  const isEmViagem = evento.status === 'em_viagem' || (evento.pessoas && evento.pessoas.some(p => (p as any).viagem_inicio && !(p as any).viagem_fim));
                  let formattedTimer = '';
                  if (isEmViagem) {
                    const activePerson = evento.pessoas?.find(p => (p as any).viagem_inicio && !(p as any).viagem_fim);
                    const inicioStr = activePerson ? (activePerson as any).viagem_inicio : evento.data_saida;
                    if (inicioStr) {
                      const diffSecs = Math.max(0, Math.floor((now.getTime() - new Date(inicioStr).getTime()) / 1000));
                      const hrs = Math.floor(diffSecs / 3600);
                      const mins = Math.floor((diffSecs % 3600) / 60);
                      const secs = diffSecs % 60;
                      formattedTimer = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                    }
                  }

                  return (
                    <div key={evento.id} className="mx-4 my-3 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-100 desktop:mx-0 desktop:my-0 desktop:rounded-none desktop:bg-transparent desktop:border-0 desktop:border-b desktop:border-slate-100 desktop:shadow-none desktop:px-6 desktop:py-3 flex flex-col desktop:grid desktop:grid-cols-12 gap-4 hover:bg-slate-50/80 transition-all duration-200 items-stretch desktop:items-center">
                      <div className="desktop:col-span-1 flex items-center justify-between desktop:justify-center gap-3 pb-2 desktop:pb-0 border-b border-slate-100 desktop:border-b-0 shrink-0">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 bg-slate-50 rounded-xl border border-slate-150 flex flex-col items-center justify-center shadow-xs shrink-0">
                            <span className="text-[7px] font-black text-slate-400 uppercase">
                              {monthName}/{yearLabel}
                            </span>
                            <span className="text-xs font-black text-emerald-600 leading-none">
                              {createdDate.getDate()}
                            </span>
                          </div>
                          <div className="flex flex-col desktop:hidden">
                            <span className="font-mono text-[9px] font-black text-indigo-600">
                              EVT-{evento.id.slice(0,4).toUpperCase()}
                            </span>
                            <span className="text-[8px] text-slate-400 font-mono">
                              {createdDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono hidden desktop:inline">
                            {createdDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="desktop:hidden flex flex-col items-end gap-1">
                          {isEmViagem ? (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-300 text-[9px] font-black animate-pulse shadow-xs">
                              <Timer className="w-3 h-3 text-emerald-600" />
                              <span className="font-mono font-black">{formattedTimer}</span>
                            </div>
                          ) : (
                            <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm ${badge.style}`}>
                              {badge.label}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="hidden desktop:flex desktop:col-span-1 justify-center">
                        <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100/50">
                          EVT-{evento.id.slice(0,4).toUpperCase()}
                        </span>
                      </div>

                      <div className="desktop:col-span-2 space-y-0.5 py-0.5 desktop:py-0 min-w-0">
                        <h3 className="text-xs font-bold text-slate-800 leading-tight truncate" title={evento.destino}>
                          {evento.destino}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 truncate">
                          <Users className="w-3 h-3 text-slate-400 shrink-0" /> <span className="truncate">{evento.pessoas && evento.pessoas.length > 0 ? evento.pessoas.map(p => p.name).join(', ') : 'Servidor não informado'}</span>
                        </p>
                      </div>

                      <div className="desktop:col-span-2 space-y-0.5 py-0.5 desktop:py-0 min-w-0">
                        <p className="text-xs text-slate-600 font-medium line-clamp-1" title={evento.motivo}>
                          {evento.motivo}
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium truncate">
                          Lançado por {evento.user_name}
                        </p>
                      </div>

                      <div className="hidden desktop:flex desktop:col-span-2 items-center justify-center py-1 desktop:py-0 flex-col gap-1">
                         {isEmViagem ? (
                           <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-300 text-[9px] font-black animate-pulse shadow-xs">
                             <Timer className="w-3 h-3 text-emerald-600 animate-spin" style={{ animationDuration: '3s' }} />
                             <span>EM PERCURSO</span>
                             <span className="font-mono bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[8px] font-bold">
                               {formattedTimer}
                             </span>
                           </div>
                         ) : (
                           <div className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider shadow-xs ${badge.style}`}>
                              {badge.label}
                           </div>
                         )}
                      </div>

                      <div className="desktop:col-span-4 flex items-center justify-end gap-1.5 pt-2 desktop:pt-0 border-t border-slate-100 desktop:border-t-0 mt-1 desktop:mt-0 w-full shrink-0 flex-nowrap">
                        {/* Botão Interativo de Localização (Clique para Forçar Sincronização GPS) */}
                        {(() => {
                          const cp = getCheckpointFromEvento(evento);
                          if (!cp && !isEmViagem) return null;
                          const cidadeExibida = cp ? cp.cidade : 'São José do Goiabal - MG';
                          const isSyncing = syncingTripId === evento.id;

                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleManualLocationSync(evento);
                              }}
                              disabled={isSyncing}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold shadow-2xs shrink-0 transition-all cursor-pointer border active:scale-95 group ${
                                isSyncing
                                  ? 'bg-amber-50 border-amber-300 text-amber-900 animate-pulse'
                                  : 'bg-cyan-50 hover:bg-cyan-100/90 border-cyan-200/80 hover:border-cyan-400 text-cyan-800'
                              }`}
                              title="Clique para forçar a busca e atualização da localização em tempo real"
                            >
                              <MapPin className={`w-3 h-3 text-cyan-600 shrink-0 ${isSyncing ? 'animate-spin text-amber-600' : 'animate-bounce'}`} />
                              <span className="font-bold text-slate-800 truncate max-w-[130px]">
                                {isSyncing ? 'Buscando GPS...' : cidadeExibida}
                              </span>
                              <RefreshCw className={`w-2.5 h-2.5 text-cyan-500 opacity-60 group-hover:opacity-100 shrink-0 ${isSyncing ? 'animate-spin text-amber-600' : ''}`} />
                            </button>
                          );
                        })()}

                        {/* Botão de Iniciar Viagem (Apenas para Viagens Programadas) */}
                        {evento.status === 'viagem_programada' && (isCurrentUserGestor || isAdmin || evento.user_id === currentUser?.id || (evento.pessoas && evento.pessoas.some(p => p.id === currentUser?.id))) && (
                          <button
                            onClick={() => handleIniciarViagem(evento)}
                            disabled={startingTripId === evento.id}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-xs flex items-center gap-1 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Iniciar esta Viagem sem sair da página"
                          >
                            {startingTripId === evento.id ? (
                              <Loader2 className="w-3 h-3 text-white animate-spin shrink-0" />
                            ) : (
                              <Play className="w-3 h-3 fill-white text-white shrink-0" />
                            )}
                            <span>{startingTripId === evento.id ? 'Iniciando...' : 'Iniciar'}</span>
                          </button>
                        )}

                        {/* Botão de Finalizar Viagem para Gestor/Admin quando em percurso */}
                        {isEmViagem && (isCurrentUserGestor || isAdmin || evento.user_id === currentUser?.id || (evento.pessoas && evento.pessoas.some(p => p.id === currentUser?.id))) && (
                          <button
                            onClick={() => handleOpenFinalizeModal(evento)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-xs shrink-0"
                            title="Finalizar Viagem em Andamento"
                          >
                            <span>Finalizar</span>
                          </button>
                        )}

                        {/* Botão EXCLUSIVO ADMIN: Ícone de Relógio para Definir Tempo em Percurso */}
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setAdminEmPercursoModal(evento);
                              setAdminElapsedHours(1);
                              setAdminElapsedMinutes(46);
                            }}
                            className="p-1.5 text-indigo-600 hover:text-white hover:bg-indigo-600 bg-indigo-50/80 rounded-lg transition-all border border-indigo-200/80 shrink-0 shadow-2xs active:scale-95 flex items-center justify-center"
                            title="Admin: Definir Tempo em Percurso"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Botão de Transferir Viagem (não iniciada - apenas para o próprio criador, gestor ou admin) */}
                        {!isEmViagem && evento.status !== 'concluido' && (isGestorOrAdmin || evento.user_id === currentUser?.id) && (
                          <button
                            onClick={() => {
                              setTransferServerEventoModal(evento);
                              setTransferServerSearch('');
                            }}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-all border border-amber-200/80 shrink-0"
                            title="Transferir Viagem para Outro Servidor"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Botão de Adicionar Servidor apenas para Administradores */}
                        {currentUser?.role === 'admin' && (
                          <button
                            onClick={() => {
                              setAddServerEventoModal(evento);
                              setAddServerSearch('');
                            }}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all border border-indigo-200/60 shrink-0"
                            title="Adicionar + Servidor nesta Viagem"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canAct && evento.status !== 'concluido' ? (
                          <button 
                            onClick={() => handleOpenReview(evento)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-xs shrink-0"
                          >
                            Revisar
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleOpenReview(evento)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all shrink-0"
                            title="Ver Detalhes"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {evento.status === 'concluido' && (
                          <button
                            onClick={() => handleDownloadPDF(evento)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all border border-indigo-200/80 shrink-0"
                            title="Baixar / Imprimir PDF da Diária Concluída"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {currentUser?.role === 'admin' && evento.status === 'concluido' && (
                          <button
                            onClick={() => handleOpenReview(evento)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-xs shrink-0 flex items-center gap-1"
                            title="Editar Viagem Concluída (Administrador)"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Editar</span>
                          </button>
                        )}

                        {currentUser?.role === 'admin' && (
                          <button
                            onClick={() => handleToggleEventoDespesas(evento)}
                            className={`p-1.5 rounded-lg border transition-all shrink-0 ${
                              evento.permitir_despesas_pos_finalizacao
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100'
                                : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 border-slate-200'
                            }`}
                            title={
                              evento.permitir_despesas_pos_finalizacao
                                ? 'Despesas ATIVADAS para esta viagem (Clique para desativar)'
                                : 'Ativar campo de Despesas para esta viagem'
                            }
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
                        )}
                        
                        {/* Botão de Excluir Viagem (apenas para Admin, Gestor da Viagem ou o criador da própria viagem pendente) */}
                        {(currentUser?.role === 'admin' || 
                          isGestorOrAdmin || 
                          (evento.user_id === currentUser?.id && evento.status !== 'concluido' && !isEmViagem)) && (
                          <button 
                            onClick={() => handleDelete(evento.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shrink-0"
                            title="Excluir Viagem"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {modalType === 'gestor' && selectedEvento && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/80 p-0 sm:p-6 lg:p-8 animate-fade-in" onClick={handleCloseModal}>
          <div className="w-full max-w-6xl bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col h-[94vh] sm:h-auto max-h-[94vh] sm:max-h-[92vh] overflow-hidden border border-slate-200/80 animate-slide-up" onClick={e => e.stopPropagation()}>
            
            <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <h3 className="text-sm sm:text-lg font-black tracking-tight">Aprovação do Gestor</h3>
                    <span className="font-mono text-[9px] sm:text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-400/30 shrink-0">
                      EVT-{selectedEvento.id.slice(0,4).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5 truncate sm:whitespace-normal">Revise os dados da solicitação e informe a justificativa.</p>
                </div>
              </div>
              <button onClick={handleCloseModal} className="p-1.5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white transition-colors shrink-0">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="px-4 sm:px-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-t border-b border-slate-800/80 flex items-center gap-1 sm:gap-2 overflow-x-auto hide-scroll shrink-0">
              <button
                type="button"
                onClick={() => handleSelectModalTab('resumo')}
                className={`flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 py-2.5 sm:py-3.5 border-b-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  modalActiveTab === 'resumo'
                    ? 'border-indigo-400 text-white bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
                Resumo
              </button>

              <button
                type="button"
                onClick={() => handleSelectModalTab('justificativa')}
                className={`flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 py-2.5 sm:py-3.5 border-b-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  modalActiveTab === 'justificativa'
                    ? 'border-indigo-400 text-white bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                Justificativa
              </button>

              <button
                type="button"
                onClick={() => handleSelectModalTab('comprovantes')}
                className={`flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 py-2.5 sm:py-3.5 border-b-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  modalActiveTab === 'comprovantes'
                    ? 'border-indigo-400 text-white bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Paperclip className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                Comprovantes
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/50">
              
              {modalActiveTab === 'resumo' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" /> Resumo Geral do Evento
                    </span>
                    <span className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm ${getStatusBadge(selectedEvento.status).style}`}>
                      {getStatusBadge(selectedEvento.status).label}
                    </span>
                  </div>

                  {(() => {
                    const vehicleText = selectedEvento.veiculo === 'OUTRO' 
                      ? (selectedEvento.veiculo_outro || 'OUTRO (Personalizado)')
                      : (selectedEvento.veiculo || 'Não informado');

                    const distanceText = selectedEvento.distancia !== undefined && selectedEvento.distancia !== null && selectedEvento.distancia !== 0
                      ? `${selectedEvento.distancia} KM`
                      : (selectedEvento.distancia === 0 ? '0 KM' : 'Não informada');

                    const hospedagemText = selectedEvento.hospedagem 
                      ? `Sim (${selectedEvento.hospedagem_dias || 1} dia(s))` 
                      : 'Não';

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Servidor</span>
                            <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                              {selectedEvento.pessoas[0]?.name || '---'}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Destino</span>
                            <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                              {selectedEvento.destino}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                            <Car className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Veículo Usado</span>
                            <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                              {vehicleText}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0 mt-0.5">
                            <Navigation className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Distância (KM)</span>
                            <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                              {distanceText}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Data/Hora Saída</span>
                            <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                              {formatDate(getEffectiveDataSaida(selectedEvento))}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 mt-0.5">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Data/Hora Retorno</span>
                            <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                              {formatDate(selectedEvento.data_retorno)}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm sm:col-span-2 md:col-span-1 lg:col-span-2">
                          <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
                            <Hotel className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Hospedagem Solicitada</span>
                            <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                              {hospedagemText}
                            </p>
                          </div>
                        </div>

                        {/* Card de Último Checkpoint da Localização em Tempo Real */}
                        {(() => {
                          const cp = selectedEvento.ultimo_checkpoint || (selectedEvento as any).checklist?.ultimo_checkpoint;
                          const isEmViag = selectedEvento.status === 'em_viagem' || (selectedEvento.pessoas && selectedEvento.pessoas.some(p => (p as any).viagem_inicio && !(p as any).viagem_fim));
                          if (!cp && !isEmViag) return null;
                          const cidadeStr = cp ? cp.cidade : 'São José do Goiabal - MG';
                          return (
                            <div className="bg-cyan-50/90 border border-cyan-200/80 p-3 rounded-xl flex items-start gap-2.5 shadow-sm sm:col-span-2 md:col-span-1 lg:col-span-2">
                              <div className="w-8 h-8 rounded-lg bg-cyan-100 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0 mt-0.5 animate-pulse">
                                <MapPin className="w-4 h-4 text-cyan-600 animate-bounce" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-cyan-700 block leading-tight">Último Checkpoint da Localização (Tempo Real)</span>
                                  {cp?.timestamp && (
                                    <span className="text-[9px] font-mono font-bold text-cyan-800">
                                      {new Date(cp.timestamp).toLocaleTimeString('pt-BR')}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-black text-slate-900 leading-snug break-words mt-0.5">
                                  📍 {cidadeStr}
                                  {cp ? (cp.fora_origem ? ' (Fora do Município de Origem)' : ' (No Município de Origem)') : ' (Aguardando atualização de GPS)'}
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Status de Validação da Saída */}
                        {(selectedEvento.modo_inicio || selectedEvento.status === 'em_viagem' || selectedEvento.status === 'aguardando_gestor' || selectedEvento.status === 'concluido') && (
                          <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm sm:col-span-2 md:col-span-1 lg:col-span-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                              selectedEvento.modo_inicio === 'manual' || selectedEvento.saida_validada
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                : selectedEvento.modo_inicio === 'automatico' && !selectedEvento.saida_validada
                                ? 'bg-rose-50 border-rose-100 text-rose-600'
                                : 'bg-slate-50 border-slate-150 text-slate-600'
                            }`}>
                              <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Validação da Saída</span>
                              <p className={`text-xs font-extrabold mt-0.5 ${
                                selectedEvento.modo_inicio === 'manual' || selectedEvento.saida_validada
                                  ? 'text-emerald-700'
                                  : selectedEvento.modo_inicio === 'automatico' && !selectedEvento.saida_validada
                                  ? 'text-rose-700'
                                  : 'text-slate-700'
                              }`}>
                                {selectedEvento.modo_inicio === 'manual' ? (
                                  'Saída Validada (Iniciada Manualmente)'
                                ) : selectedEvento.modo_inicio === 'automatico' ? (
                                  selectedEvento.saida_validada ? (
                                    'Saída Validada (Início Automático via GPS)'
                                  ) : (
                                    'Saída Inválida (Sem checkpoint fora do município de origem)'
                                  )
                                ) : (
                                  'Saída Validada (Legado/Manual)'
                                )}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Motivo Informado pelo Motorista / Servidor</span>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-700 font-medium leading-relaxed break-words break-all whitespace-pre-wrap overflow-hidden">
                      {selectedEvento.motivo}
                    </div>
                  </div>
                </div>
              )}

              {modalActiveTab === 'justificativa' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Justificativa Pública do Gestor de Setor
                    </span>
                    {selectedEvento.gestor_transferido_cargo && (
                      <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                        Viagem Transferida para: {selectedEvento.gestor_transferido_cargo}
                      </span>
                    )}
                  </div>

                  {(selectedEvento.status === 'aguardando_gestor' || !selectedEvento.status) && (
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 text-indigo-600" /> Transferir Viagem a outro Gestor
                        </label>
                        {transferGestorCargo && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            Transferência Ativa
                          </span>
                        )}
                      </div>
                      <select
                        value={transferGestorCargo}
                        onChange={(e) => setTransferGestorCargo(e.target.value)}
                        disabled={selectedEvento.status === 'aguardando_administrador' || selectedEvento.status === 'concluido'}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                      >
                        <option value="">-- Não transferir (Manter com o gestor atual) --</option>
                        {GESTORES_CARGOS.map((cargo) => (
                          <option key={cargo} value={cargo}>
                            {cargo}
                          </option>
                        ))}
                      </select>
                      {transferGestorCargo && (
                        <p className="text-[10px] text-amber-800 font-semibold mt-1">
                          Ao transferir, a responsabilidade de avaliar e aprovar esta viagem passará para o gestor com o cargo de: <strong>{transferGestorCargo}</strong>.
                        </p>
                      )}
                    </div>
                  )}

                  <textarea
                    value={justificativaGestor}
                    onChange={(e) => setJustificativaGestor(e.target.value)}
                    placeholder="Justifique a necessidade e o interesse público da viagem detalhadamente..."
                    disabled={selectedEvento.status === 'aguardando_administrador' || selectedEvento.status === 'concluido'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all min-h-[200px] resize-none leading-relaxed break-words break-all whitespace-pre-wrap"
                  />
                  {(selectedEvento.status === 'aguardando_gestor' || !selectedEvento.status) && (
                    <div className="flex justify-between items-center text-[10px] font-bold mt-1 px-1">
                      <span className={justificativaGestor.trim().length >= 300 ? "text-emerald-600 font-black" : "text-amber-600 font-black"}>
                        {justificativaGestor.trim().length >= 300 ? "✓ Tamanho mínimo atingido!" : `⚠️ Mínimo de 300 caracteres necessário (faltam ${300 - justificativaGestor.trim().length} caracteres)`}
                      </span>
                      <span className="text-slate-400 font-mono">
                        {justificativaGestor.trim().length} / 300
                      </span>
                    </div>
                  )}
                </div>
              )}

              {modalActiveTab === 'comprovantes' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Paperclip className="w-3.5 h-3.5 text-amber-600" /> Comprovantes de Despesas Anexados
                    </span>
                  </div>

                  {selectedEvento.status !== 'concluido' && selectedEvento.status !== 'cancelado' && (
                    <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/80">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Tipo de Despesa</label>
                          <select
                            value={newExpenseType}
                            onChange={(e) => setNewExpenseType(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                          >
                            <option value="Hospedagem">Hospedagem</option>
                            <option value="Combustível">Combustível</option>
                            <option value="Alimentação">Alimentação</option>
                            <option value="Estacionamento">Estacionamento</option>
                            <option value="Outros">Outros</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Valor da Despesa</label>
                          <input
                            type="text"
                            value={newExpenseValue}
                            onChange={(e) => setNewExpenseValue(e.target.value)}
                            placeholder="R$ 0,00"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2 pt-1">
                        <input 
                          type="file" 
                          id="comprovante-file"
                          onChange={handleComprovanteUpload}
                          disabled={isUploading || !newExpenseValue}
                          className="hidden"
                        />
                        <input 
                          type="file" 
                          id="comprovante-camera"
                          accept="image/*"
                          capture="environment"
                          onChange={handleComprovanteUpload}
                          disabled={isUploading || !newExpenseValue}
                          className="hidden"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label 
                            htmlFor="comprovante-camera"
                            className={`flex items-center justify-center gap-2 border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-2xl py-3 cursor-pointer text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50/60 hover:bg-indigo-100/80 transition-all active:scale-[0.99] ${!newExpenseValue ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isUploading ? (
                              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                            ) : (
                              <Camera className="w-4 h-4 text-indigo-600 shrink-0" />
                            )}
                            <span>{isUploading ? 'Enviando foto...' : 'Tirar Foto na Hora'}</span>
                          </label>

                          <label 
                            htmlFor="comprovante-file"
                            className={`flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-2xl py-3 cursor-pointer text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 transition-all active:scale-[0.99] ${!newExpenseValue ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isUploading ? (
                              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                            ) : (
                              <Upload className="w-4 h-4 text-slate-600 shrink-0" />
                            )}
                            <span>{isUploading ? 'Enviando arquivo...' : 'Escolher Arquivo'}</span>
                          </label>
                        </div>

                        {!newExpenseValue && (
                          <p className="text-[9px] text-amber-600 font-bold text-center">Preencha o valor da despesa antes de tirar foto ou carregar o arquivo.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {comprovantes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {comprovantes.map((c, idx) => {
                        const isImage = c.type && c.type.startsWith('image/');
                        return (
                          <div key={c.id} className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 shadow-sm hover:shadow-md transition-shadow">
                            {/* Header do card */}
                            <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border-b border-slate-200">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[9px] font-black text-slate-400 font-mono">#{idx + 1}</span>
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide truncate">
                                  {c.expenseType || c.name || 'Despesa'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {c.expenseValue && (
                                  <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                    R$ {c.expenseValue}
                                  </span>
                                )}
                                {selectedEvento.status !== 'concluido' && selectedEvento.status !== 'cancelado' && (
                                  <button
                                    type="button"
                                    onClick={() => removeComprovante(c.id)}
                                    className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                    title="Remover comprovante"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Preview da imagem ou link */}
                            {isImage ? (
                              <a href={c.url} target="_blank" rel="noopener noreferrer" className="block">
                                <img
                                  src={c.url}
                                  alt={c.name || `Comprovante ${idx + 1}`}
                                  className="w-full object-contain max-h-48 bg-white"
                                />
                              </a>
                            ) : (
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-4 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                              >
                                <Paperclip className="w-5 h-5 text-indigo-500 shrink-0" />
                                <span className="truncate">{c.name || 'Visualizar arquivo'}</span>
                              </a>
                            )}

                            {/* Rodapé com nome do arquivo */}
                            {c.name && (
                              <div className="px-3 py-1.5 border-t border-slate-200 bg-white">
                                <span className="text-[9px] text-slate-400 font-medium italic truncate block">{c.name}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-400 text-xs font-semibold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      Nenhum comprovante anexado até o momento.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 sm:px-8 py-4 border-t border-slate-200 bg-white flex flex-row items-center justify-end gap-2 sm:gap-3 shrink-0">
              {(selectedEvento.status === 'aguardando_gestor' || selectedEvento.status === 'aguardando_aprovacao' || !selectedEvento.status) ? (
                <button 
                  onClick={() => setIsRejectModalOpen(true)}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs uppercase tracking-wider rounded-xl sm:rounded-2xl transition-colors w-full sm:w-auto text-center"
                >
                  Rejeitar
                </button>
              ) : (
                <button 
                  onClick={handleCloseModal}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl sm:rounded-2xl transition-colors w-full sm:w-auto text-center"
                >
                  Fechar
                </button>
              )}
              {selectedEvento.status === 'aguardando_aprovacao' && (
                <button 
                  onClick={handleGestorApprove}
                  disabled={isSubmitting || isUploading}
                  className="px-4 sm:px-7 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-black text-xs uppercase tracking-widest rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto whitespace-nowrap"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Aprovar Viagem</span>
                </button>
              )}
              {(selectedEvento.status === 'aguardando_gestor' || !selectedEvento.status) && (
                <button 
                  onClick={handleGestorApprove}
                  disabled={justificativaGestor.trim().length < 300 || isSubmitting || isUploading}
                  className="px-4 sm:px-7 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-black text-xs uppercase tracking-widest rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto whitespace-nowrap"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{transferGestorCargo ? `Transferir` : 'Aprovar / Enviar'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {modalType === 'admin' && selectedEvento && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/80 p-0 sm:p-6 lg:p-8 animate-fade-in" onClick={handleCloseModal}>
          <div className="w-full max-w-6xl bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col h-[94vh] sm:h-auto max-h-[94vh] sm:max-h-[92vh] overflow-hidden border border-slate-200/80 animate-slide-up" onClick={e => e.stopPropagation()}>
            
            <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <h3 className="text-sm sm:text-lg font-black tracking-tight">Aprovação do Administrador</h3>
                    <span className="font-mono text-[9px] sm:text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-400/30 shrink-0">
                      EVT-{selectedEvento.id.slice(0,4).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5 truncate sm:whitespace-normal">Revise os parâmetros da viagem e conclua a geração.</p>
                </div>
              </div>
              <button onClick={handleCloseModal} className="p-1.5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white transition-colors shrink-0">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {adminStep === 'review' && (
              <div className="px-4 sm:px-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-t border-b border-slate-800/80 flex items-center gap-1 sm:gap-2 overflow-x-auto hide-scroll shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelectModalTab('resumo')}
                  className={`flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 py-2.5 sm:py-3.5 border-b-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    modalActiveTab === 'resumo'
                      ? 'border-indigo-400 text-white bg-indigo-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
                  Resumo
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectModalTab('justificativa')}
                  className={`flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 py-2.5 sm:py-3.5 border-b-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    modalActiveTab === 'justificativa'
                      ? 'border-indigo-400 text-white bg-indigo-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  Justificativa
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectModalTab('comprovantes')}
                  className={`flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 py-2.5 sm:py-3.5 border-b-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    modalActiveTab === 'comprovantes'
                      ? 'border-indigo-400 text-white bg-indigo-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Paperclip className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                  Comprovantes
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectModalTab('relatorio')}
                  className={`flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 py-2.5 sm:py-3.5 border-b-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    modalActiveTab === 'relatorio'
                      ? 'border-indigo-400 text-white bg-indigo-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  Relatório
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
              {adminStep === 'review' ? (
                <div className="space-y-6">
                  
                  {modalActiveTab === 'resumo' && (
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-indigo-600" /> Resumo Geral do Evento
                        </span>
                        <span className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm ${getStatusBadge(selectedEvento.status).style}`}>
                          {getStatusBadge(selectedEvento.status).label}
                        </span>
                      </div>

                      {(() => {
                        const vehicleText = selectedEvento.veiculo === 'OUTRO' 
                          ? (selectedEvento.veiculo_outro || 'OUTRO (Personalizado)')
                          : (selectedEvento.veiculo || 'Não informado');

                        const distanceText = selectedEvento.distancia !== undefined && selectedEvento.distancia !== null && selectedEvento.distancia !== 0
                          ? `${selectedEvento.distancia} KM`
                          : (selectedEvento.distancia === 0 ? '0 KM' : 'Não informada');

                        const hospedagemText = selectedEvento.hospedagem 
                          ? `Sim (${selectedEvento.hospedagem_dias || 1} dia(s))` 
                          : 'Não';

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                              <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                <Users className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Servidor</span>
                                <p className="text-xs font-extrabold text-slate-900 truncate" title={selectedEvento.pessoas[0]?.name}>
                                  {selectedEvento.pessoas[0]?.name || '---'}
                                </p>
                              </div>
                            </div>

                            <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                <MapPin className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Destino</span>
                                <p className="text-xs font-extrabold text-slate-900 truncate" title={selectedEvento.destino}>
                                  {selectedEvento.destino}
                                </p>
                              </div>
                            </div>

                            <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                <Car className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Veículo Usado</span>
                                <p className="text-xs font-extrabold text-slate-900 truncate" title={vehicleText}>
                                  {vehicleText}
                                </p>
                              </div>
                            </div>

                            <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                              <div className="w-11 h-11 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0">
                                <Navigation className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Distância (KM)</span>
                                <p className="text-xs font-extrabold text-slate-900 truncate">
                                  {distanceText}
                                </p>
                              </div>
                            </div>

                            <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                <Calendar className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Data/Hora Saída</span>
                                <p className="text-xs font-extrabold text-slate-900 truncate">
                                  {formatDate(selectedEvento.data_saida)}
                                </p>
                              </div>
                            </div>

                            <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                              <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                                <Calendar className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Data/Hora Retorno</span>
                                <p className="text-xs font-extrabold text-slate-900 truncate">
                                  {formatDate(selectedEvento.data_retorno)}
                                </p>
                              </div>
                            </div>

                            <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm sm:col-span-2 md:col-span-1 lg:col-span-2">
                              <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                                <Hotel className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Hospedagem Solicitada</span>
                                <p className="text-xs font-extrabold text-slate-900 truncate">
                                  {hospedagemText}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="pt-4 border-t border-slate-100 space-y-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Motivo Informado pelo Motorista / Servidor</span>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-700 font-medium leading-relaxed break-words break-all whitespace-pre-wrap overflow-hidden">
                          {selectedEvento.motivo}
                        </div>
                      </div>
                    </div>
                  )}

                  {modalActiveTab === 'justificativa' && (
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Justificativa Pública do Gestor
                        </span>
                      </div>
                      <div className="bg-indigo-50/40 p-5 rounded-2xl border border-indigo-100/60 text-xs text-slate-800 font-medium leading-relaxed break-words break-all whitespace-pre-wrap overflow-hidden">
                        {selectedEvento.justificativa_gestor || 'Ainda não informada pelo gestor.'}
                      </div>
                    </div>
                  )}

                  {modalActiveTab === 'comprovantes' && (
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Paperclip className="w-3.5 h-3.5 text-amber-600" /> Comprovantes de Despesas Anexados
                        </span>
                        <span className="text-xs font-extrabold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                          {(selectedEvento.comprovantes_gestor || []).length} comprovante(s)
                        </span>
                      </div>

                      {selectedEvento.comprovantes_gestor && selectedEvento.comprovantes_gestor.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {selectedEvento.comprovantes_gestor.map((c: Attachment, idx: number) => {
                            const isImage = c.type && c.type.startsWith('image/');
                            return (
                              <div key={c.id} className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 shadow-sm hover:shadow-md transition-shadow">
                                {/* Header do card */}
                                <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border-b border-slate-200">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[9px] font-black text-slate-400 font-mono">#{idx + 1}</span>
                                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide truncate">
                                      {c.expenseType || c.name || 'Despesa'}
                                    </span>
                                  </div>
                                  {c.expenseValue && (
                                    <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 shrink-0">
                                      R$ {c.expenseValue}
                                    </span>
                                  )}
                                </div>

                                {/* Preview da imagem ou link */}
                                {isImage ? (
                                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="block">
                                    <img
                                      src={c.url}
                                      alt={c.name || `Comprovante ${idx + 1}`}
                                      className="w-full object-contain max-h-48 bg-white"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={c.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-4 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                                  >
                                    <Paperclip className="w-5 h-5 text-indigo-500 shrink-0" />
                                    <span className="truncate">{c.name || 'Visualizar arquivo'}</span>
                                  </a>
                                )}

                                {/* Rodapé com nome do arquivo */}
                                {c.name && (
                                  <div className="px-3 py-1.5 border-t border-slate-200 bg-white">
                                    <span className="text-[9px] text-slate-400 font-medium italic truncate block">{c.name}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-10 text-slate-400 text-xs font-semibold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          Nenhum comprovante anexado.
                        </div>
                      )}
                    </div>
                  )}

                  {/* ABA 4: RELATÓRIO DA VIAGEM (EXCLUSIVO DO ADMINISTRADOR) */}
                  {modalActiveTab === 'relatorio' && (
                    <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Relatório Narrativo da Viagem Oficial</h4>
                            <p className="text-[11px] text-slate-500 font-medium">Resumo formal consolidado para fins de prestação de contas e geração de diária.</p>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                          EVT-{selectedEvento.id.slice(0,4).toUpperCase()}
                        </span>
                      </div>

                      {(() => {
                        const servidorNome = selectedEvento.pessoas[0]?.name || 'Servidor não informado';
                        const pessoaObj = selectedEvento.pessoas[0];

                        // Busca o cargo do servidor da mesma forma que na tela de Novo Evento
                        const getCargoServidor = () => {
                          if (!pessoaObj) return 'Cargo não informado';

                          const normalizeName = (n: string) => n.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                          const targetName = pessoaObj.name ? normalizeName(pessoaObj.name) : '';

                          // 1. Busca a pessoa cadastrada na tabela `persons`
                          const matchedPerson = persons.find(p => p.id === pessoaObj.id || (p.name && normalizeName(p.name) === targetName));
                          if (matchedPerson && matchedPerson.jobId) {
                            const jobObj = jobs.find(j => j.id === matchedPerson.jobId);
                            if (jobObj && jobObj.name) return jobObj.name;
                          }

                          // 2. Busca na tabela de perfis de usuários
                          const profile = profiles.find(p => p.id === pessoaObj.id || (p.name && normalizeName(p.name) === targetName));
                          if (profile && (profile.job_title || profile.jobTitle || profile.job)) {
                            return profile.job_title || profile.jobTitle || profile.job;
                          }

                          // 3. Fallback se a pessoa possuir jobId/role no objeto
                          if ((pessoaObj as any).jobId) {
                            const jobObj = jobs.find(j => j.id === (pessoaObj as any).jobId);
                            if (jobObj && jobObj.name) return jobObj.name;
                          }
                          if ((pessoaObj as any).role) return (pessoaObj as any).role;

                          return 'Cargo não informado';
                        };

                        const cargoServidorStr = getCargoServidor();
                        const setorNome = sectors.find(s => s.id === selectedEvento.setor_id)?.name || selectedEvento.user_name || 'Setor Solicitante';
                        const dataSaidaStr = formatDate(selectedEvento.data_saida);
                        const dataRetornoStr = formatDate(selectedEvento.data_retorno);
                        const destinoStr = selectedEvento.destino;
                        const distanciaKmStr = selectedEvento.distancia ? `${selectedEvento.distancia} KM` : 'Não informada';
                        const motivoJustificativaStr = selectedEvento.justificativa_gestor || selectedEvento.motivo || 'Sem justificativa informada';
                        
                        // Busca o nome do servidor que autorizou (lotado no cargo/gestão)
                        const getAutorizadorNome = () => {
                          if (selectedEvento.gestor_transferido_cargo) {
                            const cargoTarget = selectedEvento.gestor_transferido_cargo.trim().toLowerCase();
                            const matchedProfile = profiles.find(p => {
                              const pJob = (p.job_title || p.jobTitle || p.role || p.sector || p.job || '').toString().toLowerCase();
                              return pJob.includes(cargoTarget) || cargoTarget.includes(pJob);
                            });
                            if (matchedProfile && matchedProfile.name) {
                              return `${matchedProfile.name} (${selectedEvento.gestor_transferido_cargo})`;
                            }
                            return selectedEvento.gestor_transferido_cargo;
                          }

                          const pessoaId = selectedEvento.pessoas[0]?.id || '';
                          const gestorId = gestoresMap[pessoaId];
                          if (gestorId) {
                            const gestorProfile = profiles.find(p => p.id === gestorId);
                            if (gestorProfile && gestorProfile.name) {
                              return gestorProfile.name;
                            }
                          }

                          const setor = sectors.find(s => s.id === selectedEvento.setor_id);
                          return setor?.name || selectedEvento.user_name || 'Gestor do Setor Responsável';
                        };

                        const autorizadoPorStr = getAutorizadorNome();
                        const hospedagemStatusStr = selectedEvento.hospedagem ? 'Sim' : 'Não';
                        const hospedagemNoitesStr = selectedEvento.hospedagem ? ` (${selectedEvento.hospedagem_dias || 1} noite(s))` : '';
                        const veiculoStr = selectedEvento.veiculo === 'OUTRO'
                          ? (selectedEvento.veiculo_outro || 'Veículo Personalizado')
                          : (selectedEvento.veiculo || 'Não informado');

                        const comprovantesList: Attachment[] = selectedEvento.comprovantes_gestor || [];
                        const getDespesasNarrativa = () => {
                          if (!comprovantesList || comprovantesList.length === 0) {
                            return "Em relação às despesas, não foram anexados comprovantes adicionais.";
                          }

                          const despesasDetalhadas = comprovantesList
                            .map(c => {
                              const tipo = c.expenseType || c.name || 'Despesa';
                              const valor = c.expenseValue ? `R$ ${c.expenseValue}` : '';
                              return valor ? `${tipo} no valor de ${valor}` : tipo;
                            })
                            .join('; ');

                          let totalNum = 0;
                          let hasValidValue = false;

                          comprovantesList.forEach(c => {
                            if (c.expenseValue) {
                              const num = parseFloat(c.expenseValue.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
                              if (!isNaN(num)) {
                                totalNum += num;
                                hasValidValue = true;
                              }
                            }
                          });

                          const totalStr = hasValidValue 
                            ? `, perfazendo um montante total de R$ ${totalNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em despesas comprovadas.` 
                            : '.';

                          return `Durante o cumprimento da viagem, foram registradas e comprovadas as seguintes despesas: ${despesasDetalhadas}${totalStr}`;
                        };

                        const despesasTexto = getDespesasNarrativa();

                        return (
                          <div className="space-y-6">
                            <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-200/80 shadow-xs space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                                  <BookOpen className="w-4 h-4 text-amber-600" />
                                  Texto do Relatório Oficial da Viagem * <span className="text-rose-600 font-bold">(Preenchimento Obrigatório)</span>
                                </label>
                                {!relatorioViagem.trim() && (
                                  <span className="text-[10px] font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded border border-rose-200 uppercase">
                                    Obrigatório
                                  </span>
                                )}
                              </div>
                              <textarea
                                value={relatorioViagem}
                                onChange={(e) => setRelatorioViagem(e.target.value)}
                                placeholder="Digite aqui o relatório final das atividades e compromissos cumpridos durante a viagem..."
                                className={`w-full bg-white border rounded-xl p-4 text-xs font-medium text-slate-900 outline-none focus:ring-4 transition-all min-h-[120px] resize-none leading-relaxed shadow-sm ${
                                  !relatorioViagem.trim() ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10' : 'border-amber-200 focus:border-amber-500 focus:ring-amber-500/10'
                                }`}
                              />
                              {!relatorioViagem.trim() && (
                                <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                  É obrigatório preencher este campo para poder avançar ou salvar o relatório.
                                </p>
                              )}
                            </div>

                            <div className="bg-gradient-to-br from-indigo-50/50 via-slate-50 to-white p-6 rounded-2xl border border-indigo-100/70 shadow-inner space-y-3">
                              <div className="flex items-center justify-between border-b border-indigo-100/50 pb-2">
                                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block">Resumo Executivo Narrativo</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const narrativeText = `O servidor ${servidorNome}, ocupante do cargo de ${cargoServidorStr}, atendendo no âmbito do ${setorNome}, realizou viagem oficial com destino a ${destinoStr}. O deslocamento teve saída realizada em ${dataSaidaStr} e retorno ocorrido em ${dataRetornoStr}, percorrendo uma distância total de aproximadamente ${distanciaKmStr}.\n\nA viagem foi devidamente autorizada por ${autorizadoPorStr}, tendo como fundamentação de interesse público: "${motivoJustificativaStr}".\n\nPara a realização do trajeto, foi utilizado o veículo ${veiculoStr}. Quanto à hospedagem, o registro constou como ${hospedagemStatusStr}${hospedagemNoitesStr}.\n\n${despesasTexto}`;
                                    navigator.clipboard.writeText(narrativeText);
                                    setIsCopiedNarrative(true);
                                    setTimeout(() => setIsCopiedNarrative(false), 2000);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold transition-all shadow-sm active:scale-95"
                                  title="Copiar texto do Resumo Executivo Narrativo"
                                >
                                  {isCopiedNarrative ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                                      <span>Copiado!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Copiar Texto</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <p className="text-xs font-medium text-slate-800 leading-relaxed break-words whitespace-pre-wrap">
                                O servidor <strong>{servidorNome}</strong>, ocupante do cargo de <strong>{cargoServidorStr}</strong>, atendendo no âmbito do <strong>{setorNome}</strong>, realizou viagem oficial com destino a <strong>{destinoStr}</strong>. O deslocamento teve saída realizada em <strong>{dataSaidaStr}</strong> e retorno ocorrido em <strong>{dataRetornoStr}</strong>, percorrendo uma distância total de aproximadamente <strong>{distanciaKmStr}</strong>.
                              </p>
                              <p className="text-xs font-medium text-slate-800 leading-relaxed break-words whitespace-pre-wrap">
                                A viagem foi devidamente autorizada por <strong>{autorizadoPorStr}</strong>, tendo como fundamentação de interesse público: <em>“{motivoJustificativaStr}”</em>.
                              </p>
                              <p className="text-xs font-medium text-slate-800 leading-relaxed break-words whitespace-pre-wrap">
                                Para a realização do trajeto, foi utilizado o veículo <strong>{veiculoStr}</strong>. Quanto à hospedagem, o registro constou como <strong>{hospedagemStatusStr}</strong>{hospedagemNoitesStr}.
                              </p>
                              <p className="text-xs font-medium text-slate-800 leading-relaxed break-words whitespace-pre-wrap">
                                {despesasTexto}
                              </p>
                            </div>

                            <div className="space-y-3 pt-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Respostas Consolidadas dos Campos</span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">1. Nome do Servidor?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{servidorNome}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">2. Cargo do Servidor?</span>
                                  <p className="text-xs font-extrabold text-indigo-700 mt-0.5 break-words">{cargoServidorStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">3. Setor em que está atendendo?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{setorNome}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">4. Qual a data e hora de saída?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{dataSaidaStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">5. Qual a data e hora de retorno?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{dataRetornoStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">6. Qual o destino?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{destinoStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">7. Quantos km de distância?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{distanciaKmStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 md:col-span-2">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">8. Motivo da viagem (Justificativa do Gestor)?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words whitespace-pre-wrap">{motivoJustificativaStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">9. Quem autorizou a viagem?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{autorizadoPorStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">10. Teve Hospedagem?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{hospedagemStatusStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">11. Quantas noites de hotel?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{selectedEvento.hospedagem ? `${selectedEvento.hospedagem_dias || 1} noite(s)` : '0'}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">12. Veículo?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{veiculoStr}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                </div>
              ) : (
                <div className="space-y-6">
                  {/* Formulário de Diária Oficial */}
                  <div className="bg-gradient-to-br from-indigo-50 to-violet-50 p-8 rounded-3xl border border-indigo-100 space-y-6 shadow-sm">
                    <div>
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Parâmetros de Geração da Diária Oficial</span>
                      <p className="text-xs text-slate-500 font-medium mt-1">Preencha o valor e o relatório final para aprovar a diária.</p>
                    </div>
                    
                    {/* Valor Diária */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Valor Solicitado *</label>
                      <input 
                        type="text" 
                        value={valorDiaria}
                        onChange={(e) => setValorDiaria(e.target.value)}
                        placeholder="R$ 0,00"
                        className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
                      />
                    </div>

                    {/* Relatório Viagem */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center justify-between">
                        <span>Relatório da Viagem <span className="text-rose-500 font-bold">* (OBRIGATÓRIO)</span></span>
                        {!relatorioViagem.trim() && (
                          <span className="text-[10px] font-bold text-rose-500 lowercase font-mono">preenchimento obrigatório</span>
                        )}
                      </label>
                      <textarea
                        value={relatorioViagem}
                        onChange={(e) => setRelatorioViagem(e.target.value)}
                        placeholder="Descreva as atividades e os compromissos cumpridos no evento de viagem..."
                        className={`w-full bg-white border rounded-2xl px-5 py-4 text-xs font-medium text-slate-900 outline-none focus:ring-4 transition-all min-h-[160px] resize-none leading-relaxed shadow-sm ${
                          !relatorioViagem.trim() ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/5'
                        }`}
                      />
                      {!relatorioViagem.trim() && (
                        <p className="text-[11px] font-bold text-rose-500 flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          O preenchimento do relatório da viagem é obrigatório.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className="px-4 sm:px-8 py-4 border-t border-slate-200 bg-white flex flex-row items-center justify-end gap-2 sm:gap-3 shrink-0">
              {adminStep === 'review' ? (
                <>
                  <button 
                    onClick={handleCloseModal}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl sm:rounded-2xl transition-colors w-full sm:w-auto text-center"
                  >
                    Fechar
                  </button>
                  {(selectedEvento.status === 'aguardando_administrador' || (selectedEvento.status === 'concluido' && currentUser?.role === 'admin')) && (
                    <button 
                      onClick={() => {
                        if (!relatorioViagem.trim()) {
                          handleSelectModalTab('relatorio');
                          alert("O preenchimento do Relatório da Viagem é OBRIGATÓRIO! Por favor, preencha o relatório na aba Relatório antes de avançar.");
                          return;
                        }
                        setAdminStep('approve');
                      }}
                      className="px-4 sm:px-7 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 w-full sm:w-auto text-center whitespace-nowrap"
                    >
                      {selectedEvento.status === 'concluido' ? 'Editar Parâmetros / Salvar' : 'Aprovar Viagem'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setAdminStep('review')}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl sm:rounded-2xl transition-colors w-full sm:w-auto text-center"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={() => handleAdminGenerate()}
                    disabled={!valorDiaria || !relatorioViagem.trim() || isSubmitting}
                    className="px-4 sm:px-7 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-black text-xs uppercase tracking-widest rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto text-center whitespace-nowrap"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{selectedEvento.status === 'concluido' ? 'Salvar Alterações' : 'Gerar Viagem'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {is2FAModalOpen && currentUser && (
        <TwoFactorModal
          isOpen={is2FAModalOpen}
          onClose={() => setIs2FAModalOpen(false)}
          onConfirm={() => {
            setIs2FAModalOpen(false);
            handleAdminGenerate(true);
          }}
          secret={currentUser.twoFactorEnabled ? (currentUser.twoFactorSecret || '') : ''}
          secret2={currentUser.twoFactorEnabled2 ? (currentUser.twoFactorSecret2 || null) : null}
          signatureName={currentUser.name || ''}
        />
      )}

      {isRejectModalOpen && selectedEvento && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 p-4 sm:p-6 lg:p-8 animate-fade-in" onClick={() => setIsRejectModalOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/80 animate-slide-up" onClick={e => e.stopPropagation()}>
            
            <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-red-700 text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white shadow-inner">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight uppercase">Justificativa de Rejeição</h3>
                  <p className="text-[10px] text-rose-100 font-semibold mt-0.5">EVT-{selectedEvento.id.slice(0, 4).toUpperCase()}</p>
                </div>
              </div>
              <button onClick={() => setIsRejectModalOpen(false)} className="p-1.5 hover:bg-white/10 rounded-full text-rose-200 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Motivo da Rejeição *</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Informe detalhadamente a justificativa para rejeitar esta viagem..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 transition-all min-h-[120px] resize-none leading-relaxed"
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsRejectModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleGestorReject}
                  disabled={!rejectionReason.trim() || isSubmitting}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-rose-600/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  <span>Confirmar Rejeição</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Confirmação de Finalização de Viagem pelo Gestor/Admin */}
      {finalizeEventoModal && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setFinalizeEventoModal(null)}
        >
          <div 
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up text-left"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-rose-600 to-red-700 p-6 text-white text-center relative flex flex-col items-center">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/30 shadow-inner">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-black tracking-tight uppercase">Finalizar Viagem em Andamento?</h3>
              <p className="text-xs text-rose-100 font-semibold mt-1">Ação de Gestão / Administração</p>
              <button 
                onClick={() => setFinalizeEventoModal(null)} 
                className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-rose-50/80 border border-rose-150 rounded-2xl p-4 text-slate-800 space-y-2">
                <p className="text-xs font-bold text-slate-900 leading-relaxed">
                  Confirms a finalização da viagem para <span className="font-black text-rose-700">{finalizeEventoModal.destino}</span>?
                </p>
                <p className="text-[11px] font-medium text-slate-600">
                  <strong>Servidor(es):</strong> {finalizeEventoModal.pessoas?.map(p => p.name).join(', ')}
                </p>
                <p className="text-[10px] text-slate-500">
                  O horário de retorno será registrado imediatamente com a hora atual e a viagem seguirá para prestação de contas.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFinalizeEventoModal(null)}
                  className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => handleFinalizarViagemFromLancamentos(finalizeEventoModal)}
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>Sim, Finalizar Viagem</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Gestor/Admin Adicionar Servidor na Viagem */}
      {addServerEventoModal && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => { setAddServerEventoModal(null); setAddServerSearch(''); }}
        >
          <div 
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up flex flex-col max-h-[85vh] text-left"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600/30 border border-indigo-400/30 rounded-xl flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Adicionar Servidor na Viagem</h3>
                  <p className="text-[11px] text-slate-400 font-medium truncate max-w-xs">{addServerEventoModal.destino}</p>
                </div>
              </div>
              <button 
                onClick={() => { setAddServerEventoModal(null); setAddServerSearch(''); }} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 relative">
              <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={addServerSearch}
                onChange={(e) => setAddServerSearch(e.target.value)}
                placeholder="Buscar por nome do servidor..."
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {persons
                .filter(p => {
                  if (addServerEventoModal.pessoas?.some(existing => existing.id === p.id)) return false;
                  if (!addServerSearch.trim()) return true;
                  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                  return norm(p.name).includes(norm(addServerSearch));
                })
                .map(person => {
                  const personJob = jobs.find(j => j.id === person.jobId)?.name || 'Sem Cargo';
                  return (
                    <button
                      key={person.id}
                      onClick={() => handleAddServerToEvento(addServerEventoModal, person)}
                      className="w-full flex items-center justify-between p-3.5 hover:bg-indigo-50/70 rounded-2xl text-left border border-transparent hover:border-indigo-100 transition-all group"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-extrabold text-slate-800 group-hover:text-indigo-700">{person.name}</span>
                        <span className="text-[11px] text-slate-400 font-semibold">{personJob}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200/60 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Modal para Transferir Viagem para Outro Servidor */}
      {transferServerEventoModal && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => { setTransferServerEventoModal(null); setTransferServerSearch(''); }}
        >
          <div 
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up flex flex-col max-h-[85vh] text-left"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-600/30 border border-amber-400/30 rounded-xl flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Transferir Viagem</h3>
                  <p className="text-[11px] text-slate-400 font-medium truncate max-w-xs">{transferServerEventoModal.destino}</p>
                </div>
              </div>
              <button 
                onClick={() => { setTransferServerEventoModal(null); setTransferServerSearch(''); }} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-amber-50/70 border-b border-amber-200/60 text-xs text-amber-900">
              <p className="font-bold flex items-center gap-1.5 text-amber-950">
                <UserCheck className="w-4 h-4 text-amber-700 shrink-0" />
                Servidor Atual: {transferServerEventoModal.pessoas?.map(p => p.name).join(', ') || 'Nenhum'}
              </p>
              <p className="text-[11px] text-amber-800 leading-snug mt-1">
                Selecione abaixo o novo servidor que assumirá o registro desta viagem.
              </p>
            </div>

            <div className="p-4 border-b border-slate-100 relative">
              <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={transferServerSearch}
                onChange={(e) => setTransferServerSearch(e.target.value)}
                placeholder="Buscar por nome do servidor..."
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {persons
                .filter(p => {
                  if (transferServerEventoModal.pessoas?.some(existing => existing.id === p.id)) return false;
                  if (!transferServerSearch.trim()) return true;
                  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                  return norm(p.name).includes(norm(transferServerSearch));
                })
                .map(person => {
                  const personJob = jobs.find(j => j.id === person.jobId)?.name || 'Sem Cargo';
                  return (
                    <button
                      key={person.id}
                      onClick={() => handleTransferServerInEvento(transferServerEventoModal, person)}
                      className="w-full flex items-center justify-between p-3.5 hover:bg-amber-50/70 rounded-2xl text-left border border-transparent hover:border-amber-200 transition-all group"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-extrabold text-slate-800 group-hover:text-amber-800">{person.name}</span>
                        <span className="text-[11px] text-slate-400 font-semibold">{personJob}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-black text-amber-700 bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 group-hover:bg-amber-600 group-hover:text-white transition-all">
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Transferir</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Relatório de Diárias */}
      <DiariasReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        orders={mappedOrdersForReport}
        onUpdatePaymentStatus={handleUpdatePaymentStatus}
      />
      {/* Modal de Finalização Direta em Lançamentos */}
      {finalizeEventoModal && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setFinalizeEventoModal(null)}
        >
          <div 
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up text-left"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-rose-600 p-6 text-white text-center relative flex flex-col items-center">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/30 shadow-inner">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-black tracking-tight uppercase">Finalizar Viagem</h3>
              <p className="text-xs text-rose-100 font-semibold mt-1">Destino: {finalizeEventoModal.destino}</p>
              <button 
                onClick={() => setFinalizeEventoModal(null)} 
                className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {isFinalizeHospedagemStep ? (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-slate-700 leading-relaxed text-center">
                    A viagem teve uma duração superior a 12 horas. Por favor, informe se houve hospedagem:
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
                      <input
                        type="number"
                        min="1"
                        value={finalHospedagemDias}
                        onChange={(e) => setFinalHospedagemDias(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900 outline-none"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <p className="text-xs font-bold text-slate-800 leading-relaxed">
                    Confirma o encerramento imediato da viagem para <span className="font-black text-rose-700">{finalizeEventoModal.destino}</span>?
                  </p>
                  <p className="text-[11px] text-slate-500">
                    O horário de retorno será registrado com a hora atual e a viagem seguirá para prestação de contas.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFinalizeEventoModal(null)}
                  disabled={isFinalizingSubmitting}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFinalizarViagemInLancamentos}
                  disabled={isFinalizingSubmitting}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-600/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isFinalizingSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                  <span>Sim, Finalizar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Controle Administrativo: Definir Em Percurso com Tempo Customizado */}
      {adminEmPercursoModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setAdminEmPercursoModal(null)}>
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-indigo-600 to-violet-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white border border-white/20 shadow-sm">
                  <ShieldCheck className="w-5 h-5 text-indigo-100" />
                </div>
                <div>
                  <h3 className="text-base font-bold leading-tight flex items-center gap-1.5">
                    <span>Definir "Em Percurso"</span>
                    <span className="text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold">ADMIN</span>
                  </h3>
                  <p className="text-[10px] text-indigo-100 font-medium">Controle Manual de Tempo de Viagem</p>
                </div>
              </div>
              <button
                onClick={() => setAdminEmPercursoModal(null)}
                className="p-1.5 hover:bg-white/10 rounded-full text-white/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Resumo do Evento */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Destino</span>
                  <span className="font-black text-slate-900">{adminEmPercursoModal.destino}</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-slate-200/60 pt-1.5">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Servidor / Motorista</span>
                  <span className="font-bold text-slate-800 text-right truncate max-w-[200px]">
                    {adminEmPercursoModal.pessoas && adminEmPercursoModal.pessoas.length > 0
                      ? adminEmPercursoModal.pessoas.map(p => p.name || (p as any).nome).join(', ')
                      : '---'}
                  </span>
                </div>
              </div>

              {/* Seleção de Tempo Decorrido */}
              <div className="space-y-2.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                  A partir de qual tempo de viagem? (Horas e Minutos)
                </label>

                {/* Atalhos Rápidos */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setAdminElapsedHours(1); setAdminElapsedMinutes(46); }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all border ${
                      adminElapsedHours === 1 && adminElapsedMinutes === 46
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ⚡ 01:46:00
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAdminElapsedHours(1); setAdminElapsedMinutes(40); }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all border ${
                      adminElapsedHours === 1 && adminElapsedMinutes === 40
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ⏱️ 01:40:00
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAdminElapsedHours(0); setAdminElapsedMinutes(30); }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all border ${
                      adminElapsedHours === 0 && adminElapsedMinutes === 30
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ⏱️ 00:30:00
                  </button>
                </div>

                {/* Inputs Customizados */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Horas Decorridas</span>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="0"
                        max="72"
                        value={adminElapsedHours}
                        onChange={(e) => setAdminElapsedHours(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all text-center"
                      />
                      <span className="absolute right-3 text-xs font-bold text-slate-400">h</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Minutos Decorridos</span>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={adminElapsedMinutes}
                        onChange={(e) => setAdminElapsedMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all text-center"
                      />
                      <span className="absolute right-3 text-xs font-bold text-slate-400">m</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Caixa de Ajuste e Preview em Tempo Real */}
              {(() => {
                const totalMinutes = (Number(adminElapsedHours) || 0) * 60 + (Number(adminElapsedMinutes) || 0);
                const calcSaida = new Date(Date.now() - totalMinutes * 60 * 1000);
                const hrsStr = String(adminElapsedHours).padStart(2, '0');
                const minStr = String(adminElapsedMinutes).padStart(2, '0');
                return (
                  <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3 text-center space-y-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-600 block">Preview do Cronômetro em Tempo Real</span>
                    <div className="text-xl font-black text-indigo-950 font-mono">
                      {hrsStr}:{minStr}:00
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 block">
                      Horário de início calculado: <strong className="text-slate-800 font-mono">{calcSaida.toLocaleTimeString('pt-BR')}</strong>
                    </span>
                  </div>
                );
              })()}

              {/* Botões de Ação */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdminEmPercursoModal(null)}
                  disabled={isAdminUpdating}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAdminEmPercurso}
                  disabled={isAdminUpdating}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAdminUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                  <span>Confirmar Admin</span>
                </button>
              </div>
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
