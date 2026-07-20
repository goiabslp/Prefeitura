import {
  useOficios,
  useCreateOficio,
  useUpdateOficio,
  useDeleteOficio,
  oficioKeys
} from './hooks/useOficios';
import { serviceRequestKeys } from './hooks/useServiceRequests';
import { licitacaoKeys } from './hooks/useLicitacaoModule';


import {
  User, Order, AppState, BlockType, Attachment, Person, Sector, Job,
  Vehicle, VehicleBrand, VehicleSchedule, Signature, StatusMovement
} from './types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

declare const __LATEST_COMMIT__: string | undefined;

import { supabase } from './services/supabaseClient';
import * as entityService from './services/entityService';
import * as oficiosService from './services/oficiosService';
import * as settingsService from './services/settingsService';
import * as db from './services/dbService';
import { auditLogService } from './services/auditLogService';
import {
  INITIAL_STATE,
  DEFAULT_USERS,
  DEFAULT_SECTORS,
  DEFAULT_JOBS
} from './constants';
import { FloatingNotification } from './components/FloatingNotification';

import * as comprasService from './services/comprasService';
import * as diariasService from './services/diariasService';
import * as counterService from './services/counterService';
import * as signatureService from './services/signatureService';
import * as licitacaoService from './services/licitacaoService';

import * as vehicleSchedulingService from './services/vehicleSchedulingService';

import { AbastecimentoService } from './services/abastecimentoService';
import * as taskService from './services/taskService';
import { marketingSyncService } from './services/marketingSyncService';
import { saveRhHorasExtras, updateRhHorasExtras } from './services/rhService';
import { Send, CheckCircle2, X, Download, Save, FilePlus, Package, History, FileText, Settings, LogOut, ChevronRight, ChevronDown, Search, Filter, Upload, Trash2, Printer, Edit, ArrowLeft, Loader2, ShieldAlert, MousePointer, Tv, Power, ShieldCheck } from 'lucide-react';

// Components
import { LoginScreen } from './components/LoginScreen';
import { HomeScreen } from './components/HomeScreen';
import { TrackingScreen } from './components/TrackingScreen';
import { AdminSidebar } from './components/AdminSidebar';
import { DocumentPreview } from './components/DocumentPreview';
import { AdminDocumentPreview } from './components/AdminDocumentPreview';
import { UserManagementScreen } from './components/UserManagementScreen';
import { EntityManagementScreen } from './components/EntityManagementScreen';
import { SignatureManagementScreen } from './components/SignatureManagementScreen';
import { FleetManagementScreen } from './components/FleetManagementScreen';
import { VehicleSchedulingScreen } from './components/VehicleSchedulingScreen';
import { UIPreviewScreen } from './components/UIPreviewScreen';
import { AppHeader } from './components/AppHeader';
import { FinalizedActionBar } from './components/FinalizedActionBar';
import { AdminDashboard } from './components/AdminDashboard';
import { TwoFactorAuthScreen } from './components/TwoFactorAuthScreen';
import { TwoFactorModal } from './components/TwoFactorModal';
import { OficioNumberingModal } from './components/modals/OficioNumberingModal';
import { ProcessStepper } from './components/common/ProcessStepper';
import { ActionProcessingModal, ProcessingStage } from './components/modals/ActionProcessingModal';

import { SystemAccessControl } from './components/admin/SystemAccessControl';
import { SystemLogs } from './components/admin/SystemLogs';
import { RemoteAccessScreen } from './components/admin/RemoteAccessScreen';
import { GlobalLoading } from './components/common/GlobalLoading';

import { ToastNotification, ToastType } from './components/common/ToastNotification';
import { AbastecimentoForm } from './components/abastecimento/AbastecimentoForm';
import { AbastecimentoList } from './components/abastecimento/AbastecimentoList';
import { AbastecimentoDashboard } from './components/abastecimento/AbastecimentoDashboard';
import { ForcePasswordChangeModal } from './components/ForcePasswordChangeModal';
import { AvatarSelectionModal } from './components/modals/AvatarSelectionModal';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { SystemSettingsProvider, useSystemSettings } from './contexts/SystemSettingsContext';
import { useQueryClient } from '@tanstack/react-query';
import { purchaseOrderKeys } from './hooks/usePurchaseOrders';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { createPortal } from 'react-dom';
import { ChatProvider } from './contexts/ChatContext';
import { ChatWidget } from './components/chat/ChatWidget';
import { ChatWindow } from './components/chat/ChatWindow';
import { ChatNotificationPopup } from './components/chat/ChatNotificationPopup';
import { AgricultureModule } from './components/agriculture/AgricultureModule';
import { ObrasModule } from './components/obras/ObrasModule';
import { OrderDetailsScreen } from './components/OrderDetailsScreen';
import { TasksDashboard } from './components/dashboard/TasksDashboard';
import { PurchaseItemsScreen } from './components/PurchaseItemsScreen';
import { Calendario } from './components/calendario/Calendario';
import { RHModule } from './components/rh/RHModule';
import { ProjetosModule } from './components/projetos/ProjetosModule';
import { MarketingModule } from './components/marketing/MarketingModule';
import { ConsultasModule } from './components/consultas/ConsultasModule';
import { FarmaciaModule } from './components/farmacia/FarmaciaModule';
import { MotoristaModule } from './components/motorista/MotoristaModule';
import { NovaViagemScreen } from './components/motorista/NovaViagemScreen';
import { MinhasViagensScreen } from './components/motorista/MinhasViagensScreen';
import { SystemUpdateScreen } from './components/SystemUpdateScreen';
import { NovoEventoScreen } from './components/diarias/NovoEventoScreen';
import { LancamentosScreen } from './components/diarias/LancamentosScreen';
import { GestoresScreen } from './components/diarias/GestoresScreen';
import { OficiosHistory } from './components/oficios/OficiosHistory';
import { LicitacaoDashboard } from './components/licitacao/LicitacaoDashboard';
import { LicitacaoWizard } from './components/licitacao/LicitacaoWizard';
import { LicitacaoList } from './components/licitacao/LicitacaoList';
import { useLicitacaoProcesses, useUpdateLicitacaoProcess } from './hooks/useLicitacaoModule';
import { remoteAccessService } from './services/remoteAccessService';

const VIEW_TO_PATH: Record<string, string> = {
  'login': '/Login',
  'home': '/PaginaInicial',
  'home:oficio': '/Oficios',
  'home:compras': '/Compras',
  'home:diarias': '/Diarias',
  'home:abastecimento': '/Abastecimento',
  'admin:dashboard': '/Admin/Dashboard',
  'admin:users': '/Admin/Usuarios',
  'admin:entities': '/Admin/Entidades',
  'admin:fleet': '/Frota',
  'admin:signatures': '/Admin/Assinaturas',
  'admin:2fa': '/Admin/autenticador',
  'admin:ui': '/Admin/Interface',
  'admin:design': '/Admin/Design',
  'admin:access_control': '/Admin/ControleAcesso',
  'admin:logs': '/Admin/logs',
  'admin:remote_access': '/Admin/AcessoRemoto',
  'tasks-dashboard': '/Tarefas/MinhasTarefas',
  'tracking:oficio': '/Historico/Oficio',
  'tracking:compras': '/Historico/Compras',
  'tracking:diarias': '/Historico/Diarias',
  'diarias-novo-evento': '/Diarias/NovoEvento',
  'diarias-lancamentos': '/Diarias/Lancamentos',
  'diarias-gestores': '/Diarias/Gestores',
  'editor:oficio': '/Editor/Oficio',
  'editor:compras': '/Editor/Compras',
  'editor:diarias': '/Editor/Diarias',
  'purchase-inventory': '/Compras/Itens',
  'vehicle-scheduling': '/AgendamentoVeiculos',
  'vehicle-scheduling:agendamento': '/AgendamentoVeiculos',
  'vehicle-scheduling:vs_calendar': '/AgendamentoVeiculos/Agendar',
  'vehicle-scheduling:vs_history': '/AgendamentoVeiculos/Historico',
  'vehicle-scheduling:vs_approvals': '/AgendamentoVeiculos/Aprovacoes',
  'vehicle-scheduling:dashboard': '/AgendamentoVeiculos/Dashboard',
  'abastecimento:new': '/Abastecimento/NovoAbastecimento',
  'abastecimento:management': '/Abastecimento/GestaoAbastecimento',
  'abastecimento:dashboard': '/Abastecimento/DashboardAbastecimento',
  'abastecimento': '/Abastecimento',
  'agricultura': '/Agricultura',
  'obras': '/Obras',
  'order-details': '/Historico/Compras/Visualizar',
  'tarefas': '/Tarefas',
  'tarefas:new': '/Tarefas/NovaTarefa',
  'tarefas:dashboard': '/Tarefas/MinhasTarefas',
  'calendario': '/Calendario',
  'rh': '/RH',
  'rh:horas-extras': '/RH/HorasExtras',
  'rh:historico': '/RH/Historico',
  'projetos': '/Projetos',
  'projetos:new': '/Projetos/NovoProjeto',
  'projetos:details': '/Projetos/Detalhes',
  'marketing': '/Marketing',
  'marketing:new': '/Marketing/Novo',
  'marketing:details': '/Marketing/Detalhes',
  'licitacao': '/Licitação',
  'licitacao:new': '/Licitação/NovoPedido',
  'licitacao:details': '/Licitação/MeusProcessos',
  'consultas': '/Consultas',
  'consultas:novo-agendamento': '/Consultas/NovoAgendamento',
  'consultas:acompanhar': '/Consultas/Acompanhar',
  'consultas:dados': '/Consultas/DADOS',
  'consultas:dados-dashboard': '/Consultas/DADOS/Dashboard',
  'consultas:dados-pacientes': '/Consultas/DADOS/Pacientes',
  'consultas:dados-procedimentos': '/Consultas/DADOS/Exames',
  'consultas:dados-historico': '/Consultas/DADOS/Historico',
  'farmacia': '/FarmaciaPopular',
  'farmacia:consultar': '/FarmaciaPopular/Consultar',
  'farmacia:retirar': '/FarmaciaPopular/Retirar',
  'farmacia:estoque': '/FarmaciaPopular/Estoque',
  'farmacia:dados': '/FarmaciaPopular/Dados',
  'farmacia:historico': '/FarmaciaPopular/Historico',
  'farmacia:dashboard': '/FarmaciaPopular/Dashboard',
  'farmacia:dashboard-geral': '/FarmaciaPopular/Dashboard/VisaoGeral',
  'farmacia:dashboard-medicamentos': '/FarmaciaPopular/Dashboard/Medicamentos',
  'farmacia:dashboard-pacientes': '/FarmaciaPopular/Dashboard/Pacientes',
  'farmacia:dashboard-relatorios': '/FarmaciaPopular/Dashboard/Relatorios',
  'farmacia:dashboard-rename': '/FarmaciaPopular/Dashboard/Rename',
  'motorista': '/Motorista',
  'motorista:nova-viagem': '/Motorista/NovaViagem',
  'motorista:minhas-viagens': '/Motorista/MinhasViagens'
};

const PATH_TO_STATE: Record<string, any> = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([stateKey, path]) => {
    const [view, sub] = stateKey.split(':');
    return [path, { view, sub }];
  })
);

const mapLicitacaoProcessToOrder = (process: any): Order => {
  let mappedStatus: any = 'pending';
  if (process.status === 'Rascunho') mappedStatus = 'pending';
  else if (process.status === 'Aguardando Assinatura' || process.status === 'Assinado') mappedStatus = 'awaiting_approval';
  else if (process.status === 'Em Análise') mappedStatus = 'in_progress';
  else if (process.status === 'Concluído' || process.status === 'completed') mappedStatus = 'completed';
  else if (process.status === 'Rejeitado' || process.status === 'rejected') mappedStatus = 'rejected';

  const sig = process.assinatura || (process.licitacao_assinaturas && process.licitacao_assinaturas.length > 0 ? process.licitacao_assinaturas[0] : null);
  const digitalSignature = sig ? {
    enabled: true,
    method: '2FA_VERIFIED',
    ip: sig.ip_address || 'Client-Device',
    date: sig.data_assinatura || sig.created_at || new Date().toISOString(),
    id: sig.id || '2FA_VERIFIED'
  } : undefined;

  return {
    id: process.id,
    protocol: process.protocolo || process.id,
    title: process.finalidade,
    status: mappedStatus,
    createdAt: process.criado_em || new Date().toISOString(),
    userId: process.criado_por,
    userName: process.solicitante_nome,
    blockType: 'licitacao',
    documentos: process.documentos || process.licitacao_documentos || [],
    documentSnapshot: {
      content: {
        objeto: process.finalidade,
        prioridade: process.prioridade,
        requesterName: process.solicitante_nome,
        requesterRole: process.solicitante_cargo,
        requesterSector: process.solicitante_setor,
        justificativa: process.justificativa?.texto || (process.licitacao_justificativas ? (Array.isArray(process.licitacao_justificativas) ? process.licitacao_justificativas[0]?.texto : process.licitacao_justificativas.texto) : undefined),
        itens: process.itens || process.licitacao_itens, // Keep as undefined when not fetched yet
        finalDocumentUrl: process.assinatura ? 'true' : null,
        fase: process.fase,
        resolucaoDescricao: process.resolucao_descricao,
        resolucaoNumero: process.resolucao_numero,
        fichaOrcamentaria: process.ficha_orcamentaria,
        digitalSignature,
        signatureName: process.solicitante_nome,
        signatureRole: process.solicitante_cargo || 'Solicitante',
        signatureSector: process.solicitante_setor || 'Geral',
        completedAt: process.atualizado_em || process.updated_at || process.data_conclusao
      }
    }
  } as unknown as Order;
};

const App: React.FC = () => {
  // State controlling the active module view
  const [currentView, setCurrentView] = useState<'login' | 'home' | 'admin' | 'tracking' | 'editor' | 'vehicle-scheduling' | 'abastecimento' | 'agricultura' | 'obras' | 'order-details' | 'tasks-dashboard' | 'purchase-inventory' | 'calendario' | 'rh' | 'projetos' | 'marketing' | 'diarias-novo-evento' | 'diarias-lancamentos' | 'diarias-gestores' | 'licitacao' | 'licitacao:new' | 'licitacao:view' | 'licitacao:details' | 'licitacao-all' | 'licitacao-screening' | 'consultas' | 'farmacia' | 'motorista' | 'motorista:nova-viagem' | 'motorista:minhas-viagens'>('login');
  const [remoteAccessState, setRemoteAccessState] = useState<any>(null);

  useEffect(() => {
    const handleStateChange = (state: any) => {
      setRemoteAccessState(state);
    };
    remoteAccessService.subscribe(handleStateChange);
    return () => remoteAccessService.unsubscribe(handleStateChange);
  }, []);
  const queryClient = useQueryClient();
  const { data: licitacaoProcessesData } = useLicitacaoProcesses();

  const mappedLicitacaoOrders: Order[] = React.useMemo(() => {
    if (!licitacaoProcessesData) return [];
    return licitacaoProcessesData.map(mapLicitacaoProcessToOrder);
  }, [licitacaoProcessesData]);

  const updateLicitacaoProcessMutation = useUpdateLicitacaoProcess();

  const handleUpdateLicitacaoPhase = async (orderId: string, phase: string, payload?: any) => {
    try {
      const dbUpdates: any = { fase: phase };
      if (payload?.protocolo) dbUpdates.protocolo = payload.protocolo;
      if (payload?.checkin_finalizado) dbUpdates.checkin_finalizado = payload.checkin_finalizado;

      await updateLicitacaoProcessMutation.mutateAsync({ id: orderId, updates: dbUpdates });
      setOrders(orders.map(o => o.id === orderId ? { 
        ...o, 
        ...(payload?.protocolo ? { protocol: payload.protocolo } : {}),
        documentSnapshot: { 
          ...(o.documentSnapshot || {}), 
          content: { 
            ...(o.documentSnapshot?.content || {}), 
            fase: phase,
            ...(payload?.checkin_finalizado ? { checkin_finalizado: payload.checkin_finalizado } : {})
          } 
        } 
      } as unknown as Order : o));
    } catch (error) {
      console.error('Failed to update phase', error);
      throw error;
    }
  };

  const handleUpdateLicitacaoProtocol = async (orderId: string, protocolo: string) => {
    try {
      await updateLicitacaoProcessMutation.mutateAsync({ id: orderId, updates: { protocolo } });
      setOrders(orders.map(o => o.id === orderId ? { ...o, protocol: protocolo } as unknown as Order : o));
    } catch (error) {
      console.error('Failed to update protocol', error);
      throw error;
    }
  };

  const { user: currentUser, signIn, signOut, refreshUser, loading: authLoading } = useAuth();
  const { moduleStatus } = useSystemSettings();
  const isModuleActive = (key: string) => moduleStatus[key] !== false;
  const permissions = currentUser?.permissions || [];
  const [appState, setAppState] = useState<AppState>(INITIAL_STATE);
  const [activeBlock, setActiveBlock] = useState<BlockType | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  // Keep viewingOrder in sync with the latest data from queries
  React.useEffect(() => {
    if (viewingOrder && viewingOrder.blockType === 'licitacao') {
      const updatedOrder = mappedLicitacaoOrders.find(o => o.id === viewingOrder.id);
      if (updatedOrder) {
        // Only update if there are changes (like new documentos) to avoid infinite loops if references change
        if (JSON.stringify(updatedOrder.documentos) !== JSON.stringify(viewingOrder.documentos)) {
          setViewingOrder(updatedOrder);
        }
      }
    }
  }, [mappedLicitacaoOrders, viewingOrder]);

  // purchaseOrders is now derived to enforce single source of truth
  const [orders, setOrders] = useState<Order[]>([]);
  const purchaseOrders = React.useMemo(() => orders.filter(o => o.blockType === 'compras'), [orders]);

  const [licitacaoProcesses, setLicitacaoProcesses] = useState<any[]>([]);
  const [licitacaoNextProtocol, setLicitacaoNextProtocol] = useState<any>(null);

  const [oficios, setOficios] = useState<Order[]>([]);
  const [serviceRequests, setServiceRequests] = useState<Order[]>([]);

  const [tasks, setTasks] = useState<Order[]>([]);

  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);
  // const [signatures, setSignatures] = useState<Signature[]>([]); // DEPRECATED: Signatures are now derived from Users
  const [globalCounter, setGlobalCounter] = useState(0);

  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isStepperLocked, setIsStepperLocked] = useState(false);
  const [lastListView, setLastListView] = useState<string>('tracking'); // Default to tracking
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Track item being deleted prevents duplicates
  const [isLoginTransitioning, setIsLoginTransitioning] = useState(false);




  // React Query Mutations for Optimistic Updates
  const createOficioMutation = useCreateOficio();
  const updateOficioMutation = useUpdateOficio();
  const deleteOficioMutation = useDeleteOficio();

  const [persons, setPersons] = useState<Person[]>(() => {
    try {
      const cached = sessionStorage.getItem('cachedPersons');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });

  // Derived signatures from Users
  const allSignatures = users
    .filter(u => u.name && u.jobTitle && u.sector)
    .map(u => ({
      id: u.id,
      name: u.name,
      role: u.jobTitle || 'Usuário',
      sector: u.sector || 'Geral'
    }));

  // Ensure current user is always available as a signature for themselves
  const currentUserSignature = currentUser ? {
    id: currentUser.id,
    name: currentUser.name,
    role: currentUser.jobTitle || 'Usuário',
    sector: currentUser.sector || 'Geral'
  } : null;

  const [isReopeningStage, setIsReopeningStage] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Combine allowed signatures + self (For AdminSidebar usage mostly)
  const myAvailableSignatures = currentUser
    ? [
      currentUserSignature!,
      ...allSignatures.filter(s => currentUser.allowedSignatureIds?.includes(s.id) && s.id !== currentUser.id)
    ]
    : [];
  const [sectors, setSectors] = useState<Sector[]>(DEFAULT_SECTORS);
  const [jobs, setJobs] = useState<Job[]>(DEFAULT_JOBS);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    try {
      const cached = sessionStorage.getItem('cachedVehicles');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [schedules, setSchedules] = useState<VehicleSchedule[]>([]);

  // Abastecimento State
  const [editingAbastecimento, setEditingAbastecimento] = useState<any | null>(null);
  const [gasStations, setGasStations] = useState<{ id: string, name: string, city: string }[]>(() => {
    try {
      const cached = sessionStorage.getItem('cachedGasStations');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [fuelTypes, setFuelTypes] = useState<{ key: string; label: string; price: number }[]>(() => {
    try {
      const cached = sessionStorage.getItem('cachedFuelTypes');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });


  const [isDownloading, setIsDownloading] = useState(false);
  const [purchaseLoadingState, setPurchaseLoadingState] = useState<{ isLoading: boolean; title: string; message: string }>({
    isLoading: false,
    title: '',
    message: ''
  });
  const [isAdminSidebarOpen, setIsAdminSidebarOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<string | null>(null);
  const [isFinalizedView, setIsFinalizedView] = useState(false);
  const [isOficioNumberingModalOpen, setIsOficioNumberingModalOpen] = useState(false);

  // --- GLOBAL SETTINGS LOAD & SAVE ---
  const [isLoadingDetails, setIsLoadingDetails] = useState(false); // New state for lazy loading
  const [successOverlay, setSuccessOverlay] = useState<{ show: boolean, protocol: string } | null>(null);
  const [lastRefresh, setLastRefresh] = useState(0);
  const [systemUpdateTarget, setSystemUpdateTarget] = useState<number | null>(null);
  const [systemUpdateCountdown, setSystemUpdateCountdown] = useState<number | null>(null);
  const [translatedCommitMsg, setTranslatedCommitMsg] = useState<string>('Carregando atualizações...');
  const [isUpdateModalDismissed, setIsUpdateModalDismissed] = useState(false);

  useEffect(() => {
    if (systemUpdateCountdown !== null && systemUpdateCountdown > 0) {
      const translateCommit = async () => {
        const rawMsg = typeof __LATEST_COMMIT__ !== 'undefined' ? __LATEST_COMMIT__ : 'Atualizações de estabilidade e melhorias gerais.';

        const match = rawMsg.match(/^(feat|fix|chore|refactor|docs|style|perf)(?:\([^)]+\))?:\s*(.*)/i);

        let prefixText = '';
        let textToTranslate = rawMsg;

        if (match) {
          const type = match[1].toLowerCase();
          const prefixes: Record<string, string> = {
            feat: '✨ Nova funcionalidade:',
            fix: '🐛 Correção:',
            chore: '🔧 Manutenção:',
            refactor: '♻️ Refatoração:',
            docs: '📝 Documentação:',
            style: '🎨 Estilos:',
            perf: '🚀 Performance:'
          };
          prefixText = prefixes[type] || '📦 Atualização:';
          textToTranslate = match[2];
        }

        try {
          const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURI(textToTranslate)}`);
          const data = await res.json();
          const translated = data[0].map((item: any) => item[0]).join('');
          setTranslatedCommitMsg(prefixText ? `${prefixText} ${translated}` : translated);
        } catch (err) {
          let formatted = rawMsg;
          if (prefixText) {
            formatted = `${prefixText} ${textToTranslate}`;
          }
          setTranslatedCommitMsg(formatted);
        }
      };

      translateCommit();
    }
  }, [systemUpdateCountdown]);

  const [actionProcessing, setActionProcessing] = useState<{
    isOpen: boolean;
    stage: ProcessingStage;
    customLabels?: any;
  }>({
    isOpen: false,
    stage: 'sending'
  });

  const advanceActionStep = async (stage: ProcessingStage, delay = 1000) => {
    setActionProcessing(prev => ({ ...prev, stage }));
    await new Promise(resolve => setTimeout(resolve, delay));
  };

  const handleSaveGlobalSettings = async () => {
    try {
      const success = await settingsService.saveGlobalSettings(appState);
      if (success) {
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
        // Update cache with new images
        const { syncImageCache } = await import('./services/cacheService');
        syncImageCache(appState);
      } else {
        alert("Erro ao salvar configurações.");
      }
    } catch (error) {
      console.error("Error saving global settings:", error);
      alert("Erro ao salvar configurações.");
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await settingsService.getGlobalSettings();
      if (settings) {
        setAppState(prev => {
          const newState = {
            ...prev,
            branding: settings.branding,
            document: settings.document,
            ui: settings.ui
          };
          // Start caching routine
          import('./services/cacheService').then(({ syncImageCache }) => {
            syncImageCache(newState);
          });
          return newState;
        });

        // Also check if there's a forced update target active on load
        const { data } = await supabase.from('organization_settings').select('system_update_target').eq('id', 'global_config').single();
        if (data?.system_update_target) {
          setSystemUpdateTarget(data.system_update_target);
          setIsUpdateModalDismissed(false);
        }
      }
    };
    loadSettings();
  }, []);

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type: 'info' | 'warning' | 'error'; singleButton?: boolean }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'info'
  });

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, isVisible: true });
  };
  const [snapshotToDownload, setSnapshotToDownload] = useState<AppState | null>(null);
  const [blockTypeToDownload, setBlockTypeToDownload] = useState<BlockType | null>(null);
  const backgroundPreviewRef = useRef<HTMLDivElement>(null);
  const componentRef = useRef<HTMLDivElement>(null);

  // 2FA State
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFASecret2, setTwoFASecret2] = useState<string | null>(null);
  const [twoFASignatureName, setTwoFASignatureName] = useState('');
  const [pendingParams, setPendingParams] = useState<any>(null); // To store state/action to resume after 2FA
  const [pending2FAAction, setPending2FAAction] = useState<((metadata: any) => Promise<void>) | null>(null); // Generic callback for 2FA success
  const [pendingSignatureMetadata, setPendingSignatureMetadata] = useState<any | null>(null);

  // Routing logic

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track active state securely without causing infinite renders on useCallback deps
  const appStateRef = useRef({ currentView, activeBlock });
  useEffect(() => {
    appStateRef.current = { currentView, activeBlock };
  }, [currentView, activeBlock]);

  // Initial Data Fetch
  const refreshData = useCallback(async (silent = false, scope?: string) => {
    // Evita atualização automática silenciosa em formulários
    if (silent) {
      const isFormScreen = () => {
        const cv = appStateRef.current.currentView as string;
        const ab = appStateRef.current.activeBlock as string;
        if (cv === 'editor') return true;
        if (ab === 'new' || ab === 'vs_calendar') return true;
        if (cv === 'abastecimento' && ab === 'new') return true;
        if (cv === 'tarefas' && ab === 'new') return true;
        if (cv === 'rh' && ab === 'horas-extras') return true;
        if (cv === 'projetos' && ab === 'new') return true;
        if (cv === 'marketing' && ab === 'new') return true;
        return false;
      };


      if (isFormScreen()) {
        console.log("Auto-refresh bloqueado: Usuário está em uma tela de preenchimento (prevenção de perda de dados).");
        return;
      }
    }

    setIsRefreshing(true);
    if (!silent) showToast("Atualizando dados...", "info");
    try {
      // Determines which batches to run based on scope
      const fetchMetadata = !scope || scope === 'metadata' || scope === 'entities' || scope === 'compras' || scope === 'diarias' || scope === 'rh';
      const fetchEntities = !scope || scope === 'entities' || scope === 'compras' || scope === 'diarias' || scope === 'rh';
      const fetchTransactions = !scope || scope === 'transactions'; // Generic transactions
      const fetchVehicleSchedules = (!scope || scope === 'vehicle-scheduling') && isModuleActive('parent_frotas');
      const fetchAbastecimento = (!scope || scope === 'abastecimento') && isModuleActive('parent_abastecimento');

      const fetchCompras = (!scope || scope === 'compras') && isModuleActive('parent_compras');
      const fetchDiarias = (!scope || scope === 'diarias') && isModuleActive('parent_diarias');
      const fetchOficios = (!scope || scope === 'oficio') && isModuleActive('parent_criar_oficio');
      const fetchMarketing = (!scope || scope === 'marketing') && isModuleActive('parent_marketing');
      const fetchRh = (!scope || scope === 'rh') && isModuleActive('parent_rh');
      const fetchAgriculture = (!scope || scope === 'agriculture') && isModuleActive('parent_agricultura');
      const fetchObras = (!scope || scope === 'obras') && isModuleActive('parent_obras');
      const fetchProjetos = (!scope || scope === 'projetos') && isModuleActive('parent_projetos');
      const fetchLicitacao = (!scope || scope === 'licitacao') && isModuleActive('parent_licitacao');
      const fetchCalendar = (!scope || scope === 'calendar') && isModuleActive('parent_calendario');
      const fetchTasks = (!scope || scope === 'transactions') && isModuleActive('parent_tarefas');

      // Batch 1: Metadata & Config (Fast)
      if (fetchMetadata || fetchAbastecimento) {
        const [
          savedSectors,
          savedJobs,
          savedBrands,
          savedGasStations,
          savedFuelTypes,
          savedUsers,
          counterValue
        ] = await Promise.all([
          entityService.getSectors(),
          entityService.getJobs(),
          entityService.getBrands(),
          isModuleActive('parent_abastecimento') ? AbastecimentoService.getGasStations() : Promise.resolve([]),
          isModuleActive('parent_abastecimento') ? AbastecimentoService.getFuelTypes() : Promise.resolve([]),
          entityService.getUsers(),
          db.getGlobalCounter(),
        ]);

        const mappedUsers: User[] = savedUsers.map((ru: any) => ({
          id: ru.id,
          username: ru.username,
          name: ru.name,
          role: ru.role,
          sector: ru.sector,
          sectorId: ru.sector_id,
          jobTitle: ru.job_title,
          jobId: ru.job_id,
          email: ru.email,
          whatsapp: ru.whatsapp,
          allowedSignatureIds: ru.allowed_signature_ids,
          permissions: ru.permissions,
          tempPassword: ru.temp_password,
          tempPasswordExpiresAt: ru.temp_password_expires_at,
          twoFactorEnabled: ru.two_factor_enabled,
          twoFactorSecret: ru.two_factor_secret,
          twoFactorEnabled2: ru.two_factor_enabled_2,
          twoFactorSecret2: ru.two_factor_secret_2
        }));

        if (mappedUsers.length > 0) setUsers(mappedUsers);
        else setUsers(DEFAULT_USERS);

        setSectors(savedSectors);
        setJobs(savedJobs);
        setBrands(savedBrands);
        setGasStations(savedGasStations);
        setFuelTypes(savedFuelTypes);
        setGlobalCounter(counterValue);

        // Fetch Licitacao Specific Counter
        if (fetchLicitacao) {
          const licitacaoSector = savedSectors.find(s => s.name === 'Departamento de Licitação');
          const licitacaoSectorId = licitacaoSector?.id || '23c6fa21-f998-4f54-b865-b94212f630ef';
          const currentYear = new Date().getFullYear();
          if (licitacaoSectorId) {
            const nextLicParams = await counterService.getNextSectorCount(licitacaoSectorId, currentYear);
            if (nextLicParams) setLicitacaoNextProtocol(nextLicParams);
          }
        }
      }

      // Batch 2: Heavy Entities
      if (fetchEntities || fetchVehicleSchedules || fetchAbastecimento) {
        const [
          savedPersons,
          savedVehicles,
          latestOdometers
        ] = await Promise.all([
          entityService.getPersons(),
          entityService.getVehicles(),
          AbastecimentoService.getAllLatestOdometers()
        ]);

        const vehiclesWithKm = savedVehicles.map(v => ({
          ...v,
          currentKm: latestOdometers[v.plate] || 0
        }));

        setPersons(savedPersons);
        setVehicles(vehiclesWithKm);
        try {
          sessionStorage.setItem('cachedPersons', JSON.stringify(savedPersons));
          sessionStorage.setItem('cachedVehicles', JSON.stringify(vehiclesWithKm));
        } catch (e) { }
      }

      // Batch 3: Transactional Data
      let savedPurchaseOrders = purchaseOrders; // Preserve existing

      let savedSchedules = schedules;
      let savedTasks = tasks;

      const promises: Promise<any>[] = [];

      if (fetchCompras || (fetchTransactions && isModuleActive('parent_compras'))) {
        promises.push(comprasService.getAllPurchaseOrders().then(d => { savedPurchaseOrders = d; }));
      }
      if (fetchTransactions) {

      }
      if (fetchVehicleSchedules || (fetchTransactions && isModuleActive('parent_frotas'))) {
        promises.push(vehicleSchedulingService.getSchedules().then(d => { savedSchedules = d; }));
      }
      if (fetchTasks || (fetchTransactions && isModuleActive('parent_tarefas'))) {
        promises.push(taskService.getTasks().then(d => { savedTasks = d; }));
      }
      if (fetchMarketing && currentUser) {
        // Marketing sync triggers
        promises.push(marketingSyncService.syncWeeklyBirthdays(currentUser.id, currentUser.name));
      }
      if (fetchRh) {
        // Any RH specific global refresh logic if needed
      }

      await Promise.all(promises);

      // Update States based on what was fetched
      // Update States based on what was fetched
      if (fetchCompras || (fetchTransactions && isModuleActive('parent_compras'))) {
        // setPurchaseOrders(savedPurchaseOrders); // Derived
      }

      if (fetchVehicleSchedules || (fetchTransactions && isModuleActive('parent_frotas'))) setSchedules(savedSchedules);
      if (fetchTasks || (fetchTransactions && isModuleActive('parent_tarefas'))) setTasks(savedTasks);

      // Update Consolidated Orders only if meaningful changes could have happened
      if (fetchCompras || fetchOficios || fetchDiarias || fetchTransactions) {
        // Note: Generic Transactions covers all.
        // Re-merging with existing state for components not fetched
        const allOrders = [
          ...savedPurchaseOrders,
          ...savedTasks
          // ... others (managed by RQ or not fetched here)
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(allOrders);
      }

      if (!silent) showToast("Dados atualizados com sucesso!", "success");
      setLastRefresh(Date.now());
    } catch (err) {
      console.error("Failed to load data", err);
      if (!silent) showToast("Erro ao atualizar dados.", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [purchaseOrders, schedules, tasks]);

  // Realtime Listeners for Abastecimento Entities
  useEffect(() => {
    const activeChannels: any[] = [];

    // Vehicles & Schedules Channel (Frotas)
    if (isModuleActive('parent_frotas') && (currentView === 'vehicle-scheduling' || activeBlock === 'agendamento')) {
      const vehicleChannel = supabase.channel('public:vehicles')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'vehicles' },
          async () => {
            const updated = await entityService.getVehicles();
            setVehicles(updated);
            try { sessionStorage.setItem('cachedVehicles', JSON.stringify(updated)); } catch (e) { }
          }
        )
        .subscribe();
      activeChannels.push(vehicleChannel);

      const schedulesChannel = supabase.channel('public:vehicle_schedules')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'vehicle_schedules' },
          async (payload) => {
            if (payload.eventType === 'DELETE') {
              setSchedules(prev => prev.filter(s => s.id !== payload.old.id));
              return;
            }
            const updatedSchedule = await vehicleSchedulingService.getScheduleById(payload.new.id);
            if (updatedSchedule) {
              if (payload.eventType === 'INSERT') setSchedules(prev => [updatedSchedule, ...prev]);
              else setSchedules(prev => prev.map(s => s.id === updatedSchedule.id ? updatedSchedule : s));
            }
          }
        )
        .subscribe();
      activeChannels.push(schedulesChannel);
    }

    // Profiles (Drivers/Users/Persons) Channel (Always Active for Auth)
    const profileChannel = supabase.channel('public:profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            setUsers(prev => prev.filter(u => u.id !== payload.old.id));
            return;
          }
          const ru = payload.new;
           const mappedUser: User = {
            id: ru.id,
            username: ru.username,
            name: ru.name,
            role: ru.role,
            sector: ru.sector,
            sectorId: ru.sector_id,
            jobTitle: ru.job_title,
            jobId: ru.job_id,
            email: ru.email,
            whatsapp: ru.whatsapp,
            allowedSignatureIds: ru.allowed_signature_ids,
            permissions: ru.permissions,
            tempPassword: ru.temp_password,
            tempPasswordExpiresAt: ru.temp_password_expires_at,
            twoFactorEnabled: ru.two_factor_enabled,
            twoFactorSecret: ru.two_factor_secret,
            twoFactorEnabled2: ru.two_factor_enabled_2,
            twoFactorSecret2: ru.two_factor_secret_2,
            status: ru.status,
            avatar: ru.avatar
          };
          if (payload.eventType === 'INSERT') {
            setUsers(prev => [...prev, mappedUser]);
          } else if (payload.eventType === 'UPDATE') {
            setUsers(prev => prev.map(u => u.id === ru.id ? mappedUser : u));
          }
        }
      )
      .subscribe();
    activeChannels.push(profileChannel);

    // Abastecimento
    if (isModuleActive('parent_abastecimento') && (currentView === 'abastecimento' || activeBlock === 'abastecimento')) {
      const stationChannel = supabase.channel('public:abastecimento_gas_stations')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'abastecimento_gas_stations' },
          async () => {
            const updated = await AbastecimentoService.getGasStations();
            setGasStations(updated);
            try { sessionStorage.setItem('cachedGasStations', JSON.stringify(updated)); } catch (e) { }
          }
        )
        .subscribe();
      
      const configChannel = supabase.channel('public:abastecimento_config')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'abastecimento_config' },
          async () => {
            const updated = await AbastecimentoService.getFuelTypes();
            setFuelTypes(updated);
            try { sessionStorage.setItem('cachedFuelTypes', JSON.stringify(updated)); } catch (e) { }
          }
        )
        .subscribe();
        
      activeChannels.push(stationChannel, configChannel);
    }

    // Purchase Orders Channel (Compras)
    if (isModuleActive('parent_compras') && activeBlock === 'compras') {
      const purchaseChannel = supabase.channel('public:purchase_orders')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'purchase_orders' },
          async (payload) => {
            queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
          }
        )
        .subscribe();
      activeChannels.push(purchaseChannel);
    }

    // TASKS Realtime Channel (Tarefas)
    if (isModuleActive('parent_tarefas') && currentView === 'tasks-dashboard') {
      const tasksChannel = supabase.channel('public:tasks_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          async (payload) => {
            if (payload.eventType === 'DELETE') {
              setTasks(prev => prev.filter(t => t.id !== payload.old.id));
              return;
            }
            const updatedTask = await taskService.getTaskById(payload.new.id);
            if (updatedTask) {
              if (payload.eventType === 'INSERT') setTasks(prev => [updatedTask, ...prev]);
              else setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'task_assignments' },
          async (payload) => {
            if (payload.eventType === 'DELETE') {
              const updatedTask = await taskService.getTaskById(payload.old.task_id);
              if (updatedTask) setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
              return;
            }
            const updatedTask = await taskService.getTaskById(payload.new.task_id);
            if (updatedTask) setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
          }
        )
        .subscribe();
      activeChannels.push(tasksChannel);
    }

    // Licitacao Channel
    if (isModuleActive('parent_licitacao') && activeBlock === 'licitacao') {
      const licitacaoChannel = supabase.channel('public:licitacao_processos')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'licitacao_processos' },
          () => {
            queryClient.invalidateQueries({ queryKey: licitacaoKeys.all });
          }
        )
        .subscribe();
      activeChannels.push(licitacaoChannel);
    }

    // Consultas Channel
    if (isModuleActive('consultas') && currentView === 'consultas') {
      const consultasChannel = supabase.channel('public:consultas_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'consultas_agendamentos' },
          () => {
            window.dispatchEvent(new Event('consultas-agendamentos-changed'));
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'consultas_pacientes' },
          () => {
            window.dispatchEvent(new Event('consultas-pacientes-changed'));
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'consultas_procedimentos' },
          () => {
            window.dispatchEvent(new Event('consultas-procedimentos-changed'));
          }
        )
        .subscribe();
      activeChannels.push(consultasChannel);
    }

    // Farmácia Popular Channel
    if (isModuleActive('farmacia') && currentView === 'farmacia') {
      const farmaciaChannel = supabase.channel('public:farmacia_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'farmacia_medicamentos' },
          () => {
            window.dispatchEvent(new Event('farmacia-medicamentos-changed'));
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'farmacia_movimentacoes' },
          () => {
            window.dispatchEvent(new Event('farmacia-movimentacoes-changed'));
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'farmacia_config' },
          () => {
            window.dispatchEvent(new Event('farmacia-config-changed'));
          }
        )
        .subscribe();
      activeChannels.push(farmaciaChannel);
    }

    // System Update Channel (Always Active)
    const settingsChannel = supabase.channel('global-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'organization_settings', filter: 'id=eq.global_config' },
        (payload) => {
          console.log("Realtime: DB Update received", payload);
          if (payload.new && 'system_update_target' in payload.new) {
            setSystemUpdateTarget(payload.new.system_update_target as number);
            setIsUpdateModalDismissed(false);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'system_update' },
        (payload) => {
          console.log("Realtime: Broadcast received", payload);
          if (payload.payload?.target) {
            setSystemUpdateTarget(payload.payload.target);
            setIsUpdateModalDismissed(false);
          }
        }
      )
      .subscribe((status) => {
        console.log("Channel global-updates status:", status);
      });
    activeChannels.push(settingsChannel);

    return () => {
      activeChannels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [queryClient, moduleStatus, currentView, activeBlock]);

  // --- PERSISTENT ROUTING LOGIC ---
  useEffect(() => {
    const restoreStateFromUrl = () => {
      const rawPath = window.location.pathname;
      const path = rawPath.replace(/\/$/, '').toLowerCase() || '/';

      // Look up path case-insensitively and ignoring trailing slash
      const matchedEntry = Object.entries(PATH_TO_STATE).find(
        ([key]) => key.replace(/\/$/, '').toLowerCase() === path
      );
      const state = matchedEntry ? matchedEntry[1] : null;

      if (state) {
        console.log("Restoring state from URL:", rawPath, state);

        // 1. Set Main View
        if (state.view === 'licitacao-new') {
          setCurrentView('editor');
          setActiveBlock('licitacao');
          setEditingOrder(null);
        } else if (state.view === 'licitacao-tracking') {
          setCurrentView('tracking');
          setActiveBlock('licitacao');
        } else if (state.view === 'licitacao-details') {
          setCurrentView('order-details');
          setActiveBlock('licitacao');
        } else {
          setCurrentView(state.view as any);
        }

        // 2. Handle Sub-States & Sidebar Synchronization
        if (state.view === 'vehicle-scheduling') {
          if (state.sub) setActiveBlock(state.sub);
          else setActiveBlock('agendamento');
          setIsAdminSidebarOpen(false);
        }
        else if (state.view === 'admin') {
          if (state.sub) {
            setAdminTab(state.sub);
            setIsAdminSidebarOpen(state.sub === 'design' || state.sub === 'ui');
          } else {
            setAdminTab(null);
            setIsAdminSidebarOpen(false);
          }
        }
        else if (state.view === 'abastecimento') {
          if (state.sub) {
            setAppState(prev => ({ ...prev, view: state.sub }));
          } else {
            setActiveBlock('abastecimento');
          }
          setIsAdminSidebarOpen(false);
        }
        else if (state.view === 'editor') {
          if (state.sub) setActiveBlock(state.sub);
          setIsAdminSidebarOpen(true);
        }
        else if (state.view === 'tracking') {
          if (state.sub) setActiveBlock(state.sub);
          setIsAdminSidebarOpen(false);
        }
        else if (state.view === 'licitacao-screening' || state.view === 'licitacao-all') {
          setActiveBlock('licitacao');
          setIsAdminSidebarOpen(false);
        }
        else if (state.view === 'tarefas') {
          if (state.sub === 'dashboard') setCurrentView('tarefas:dashboard' as any); // Wait, View is tasks-dashboard in mapping?
          // checking VIEW_TO_PATH: 'tasks-dashboard': '/Tarefas/MinhasTarefas'
          // So if path is /Tarefas/MinhasTarefas, state.view is 'tasks-dashboard'.
          // setCurrentView('tasks-dashboard') logic needs to be valid.
          // My generic casting `as any` handles it, but let's verify allowed values for currentView.
        }
        else if (state.view === 'rh') {
          setAppState(prev => ({ ...prev, view: state.sub }));
          setActiveBlock(null);
        }
        else if (state.view === 'consultas') {
          let targetSub = state.sub;
          if (targetSub === 'dados') {
            targetSub = 'dados-dashboard';
          }
          setAppState(prev => ({ ...prev, view: targetSub }));
          setActiveBlock(null);
        }
        else if (state.view === 'farmacia') {
          setAppState(prev => ({ ...prev, view: state.sub }));
          setActiveBlock(null);
        }

      } else if (path !== '/' && path !== '/Login') {
        // Fallback for unknown paths? Maybe redirect to home or stay on login?
        // For now, do nothing prevents loop.
      }
    };

    // Restore only after auth is ready and user is logged in
    if (!authLoading && currentUser) {
      restoreStateFromUrl();
    }

    // Listen for Back/Forward only after mount
    const onPopState = () => restoreStateFromUrl();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [authLoading, currentUser]); // Run once when auth finishes

  /* Removed Initial Refresh Effect - Handled by Route Sync Effect */


  useEffect(() => {
    if (authLoading) return; // Wait for session before syncing URL

    let stateKey = currentView as string;

    // Licitacao Specific Keys
    if (activeBlock === 'licitacao') {
      if (currentView === 'editor' && !editingOrder) stateKey = 'licitacao-new';
      else if (currentView === 'tracking') stateKey = 'licitacao-tracking';
      else if (currentView === 'licitacao-all') stateKey = 'licitacao-all';
      else if (currentView === 'licitacao-screening') stateKey = 'licitacao-screening';
      else if (currentView === 'home') stateKey = 'home:licitacao';
      else if (currentView === 'order-details' && viewingOrder) stateKey = 'licitacao-details';
    } else if (currentView === 'abastecimento') {
      stateKey = `abastecimento:${appState.view || 'management'}`;
    } else {
      // Standard Keys
      if (currentView === 'admin' && adminTab) {
        stateKey = `admin:${adminTab}`;
      } else if (['tracking', 'editor', 'home', 'vehicle-scheduling'].includes(currentView) && activeBlock) {
        stateKey = `${currentView}:${activeBlock}`;
      } else if (currentView === 'admin' && !adminTab) {
        stateKey = 'admin:dashboard';
      } else if ((currentView === 'tracking' || currentView === 'editor') && !activeBlock) {
        stateKey = `${currentView}:oficio`;
      } else if (currentView === 'order-details' && viewingOrder) {
        stateKey = 'order-details';
      } else if (currentView === 'rh') {
        stateKey = appState.view ? `rh:${appState.view}` : 'rh';
      } else if (currentView === 'consultas') {
        stateKey = appState.view ? `consultas:${appState.view}` : 'consultas';
      } else if (currentView === 'farmacia') {
        stateKey = appState.view ? `farmacia:${appState.view}` : 'farmacia';
      } else if (currentView.startsWith('motorista')) {
        stateKey = currentView;
      } else if (currentView === 'home' && !activeBlock) {
        stateKey = 'home';
      }
    }

    const getScopeForView = (view: string, block: string): string | undefined => {
      if (block === 'licitacao' || view === 'licitacao-all' || view === 'licitacao-screening') return 'licitacao';
      if (view === 'vehicle-scheduling' || block === 'agendamento') return 'vehicle-scheduling';
      if (view === 'abastecimento' || block === 'abastecimento') return 'abastecimento';
      if (block === 'compras') return 'compras';
      if (block === 'diarias' || view.startsWith('diarias')) return 'diarias';
      if (block === 'oficio') return 'oficio';
      if (view === 'tasks-dashboard') return 'transactions'; // 'transactions' covers tasks
      if (view === 'rh') return 'rh';
      if (view === 'marketing') return 'marketing';
      if (view === 'home') return 'metadata'; // apenas metadados leves
      if (view === 'admin') return 'entities';
      return undefined;
    };

    const expectedPath = VIEW_TO_PATH[stateKey];
    if (expectedPath && window.location.pathname !== expectedPath) {
      window.history.pushState(null, '', expectedPath);
    }

    // Auto-refresh on route change (Debounced to prevent timeout floods)
    const timeoutId = setTimeout(() => {
      const scope = getScopeForView(currentView as string, activeBlock as string);
      if (scope) {
        refreshData(true, scope);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [currentView, activeBlock, adminTab, editingOrder, queryClient, refreshData]);

  // System Update Countdown Logic
  useEffect(() => {
    if (!systemUpdateTarget) {
      setSystemUpdateCountdown(null);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.floor((systemUpdateTarget - now) / 1000);

      if (diff > 0) {
        setSystemUpdateCountdown(diff);
      } else {
        setSystemUpdateCountdown(0);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [systemUpdateTarget]);

  // Fetch Licitacao Global Protocol Counter
  useEffect(() => {
    const fetchLicitacaoCount = async () => {
      if (activeBlock === 'licitacao') {
        const year = new Date().getFullYear();
        const count = await counterService.getLicitacaoProtocolCount(year);
        if (count) {
          setLicitacaoNextProtocol(count);
        }
      }
    };
    fetchLicitacaoCount();
  }, [activeBlock, isRefreshing]); // Refresh when block active or data refreshes


  useEffect(() => {
    if (authLoading) return;

    if (currentUser && currentView === 'login') {
      // Prevent auto-redirect if we are explicitly showing the login transition modal
      if (!isLoginTransitioning) {
        const path = window.location.pathname;
        if (path === '/' || path === '/Login') {
          setCurrentView('home');
        }
      }
    } else if (!currentUser && currentView !== 'login') {
      setCurrentView('login');
    }
  }, [currentUser, currentView, authLoading, isLoginTransitioning]);

  // --- TRACKING LOGS EFFECTS ---
  // 1. Navigation Tracking
  useEffect(() => {
    // Desativado temporariamente para economizar a cota de Egress/Database no Supabase
    /*
    if (currentUser) {
      const getFriendlyViewName = (view: string) => {
        switch (view) {
          case 'home': return 'Página Inicial';
          case 'login': return 'Login';
          case 'editor': return 'Criar Documento';
          case 'tracking': return 'Histórico / Acompanhamento';
          case 'admin': return 'Painel Administrativo';
          case 'order-details': return 'Detalhes do Pedido';
          case 'vehicle-scheduling': return 'Agendamento de Veículos';
          case 'abastecimento': return 'Gestão de Abastecimento';
          case 'rh': return 'Recursos Humanos';
          case 'tarefas': return 'Minhas Tarefas';
          case 'calendario': return 'Calendário';
          case 'projetos': return 'Projetos';
          case 'marketing': return 'Marketing';
          case 'licitacao': return 'Licitação';
          case 'consultas': return 'Consultas Médicas';
          case 'farmacia': return 'Farmácia Popular';
          default: return view;
        }
      };

      const getFriendlyBlockName = (block: string) => {
        switch (block) {
          case 'oficio': return 'Ofícios';
          case 'compras': return 'Compras';
          case 'diarias': return 'Diárias';
          case 'licitacao': return 'Licitações';
          case 'farmacia': return 'Farmácia';
          case 'agendamento': return 'Agendamento';
          case 'abastecimento': return 'Abastecimento';
          default: return block;
        }
      };

      const friendlyView = getFriendlyViewName(currentView);
      const friendlyBlock = activeBlock ? getFriendlyBlockName(activeBlock) : '';
      const description = friendlyBlock 
        ? `Acessou o módulo: ${friendlyBlock} (${friendlyView})` 
        : `Acessou a tela: ${friendlyView}`;

      auditLogService.logAction({
        action_type: 'navigation',
        module: activeBlock || 'geral',
        description,
        details: { view: currentView, block: activeBlock }
      });
    }
    */
  }, [currentView, activeBlock, currentUser]);

  // 2. Global Click Tracking
  useEffect(() => {
    // Desativado temporariamente para economizar a cota de Egress/Database no Supabase
    /*
    if (!currentUser) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      let interactiveEl = target.closest('button, a, input, select, textarea, [role="button"]') as HTMLElement | null;
      
      // Heuristic: if we didn't find a standard interactive element, check if the clicked element or any parent has cursor: pointer style
      if (!interactiveEl) {
        let current: HTMLElement | null = target;
        while (current && current !== document.body) {
          const style = window.getComputedStyle(current);
          if (style.cursor === 'pointer') {
            interactiveEl = current;
            break;
          }
          current = current.parentElement;
        }
      }

      if (interactiveEl) {
        const tagName = interactiveEl.tagName.toLowerCase();
        let elementText = '';

        if (tagName === 'input' || tagName === 'textarea') {
          const input = interactiveEl as HTMLInputElement | HTMLTextAreaElement;
          elementText = input.placeholder || input.name || input.id || input.value || '';
        } else if (tagName === 'select') {
          const select = interactiveEl as HTMLSelectElement;
          elementText = select.name || select.id || select.value || '';
        } else {
          elementText = interactiveEl.textContent?.trim().replace(/\s+/g, ' ').substring(0, 100) || '';
        }

        const elementId = interactiveEl.id || '';
        const elementRole = interactiveEl.getAttribute('role') || '';
        const elementTitle = interactiveEl.getAttribute('title') || '';
        const elementAriaLabel = interactiveEl.getAttribute('aria-label') || '';
        const label = elementText || elementTitle || elementAriaLabel || elementId || elementRole || 'elemento';

        if (interactiveEl.getAttribute('type') === 'password') {
          return;
        }

        const displayLabel = label.substring(0, 80);

        auditLogService.logAction({
          action_type: 'click',
          module: activeBlock || 'geral',
          description: `Clique em: "${displayLabel}" (${tagName})`,
          details: {
            tagName,
            id: elementId,
            text: elementText.substring(0, 200),
            role: elementRole,
            title: elementTitle,
            ariaLabel: elementAriaLabel,
            path: window.location.pathname,
            view: currentView,
            block: activeBlock
          }
        });
      }
    };

    window.addEventListener('click', handleGlobalClick, true);
    return () => window.removeEventListener('click', handleGlobalClick, true);
    */
  }, [currentView, activeBlock, currentUser]);

  // --- SYSTEM AUTO-REFRESH ROUTINE (07:00, 12:00, 18:00) ---
  const initialMountCheck = useRef(true);
  const pendingWarningShown = useRef(false);

  useEffect(() => {
    const WINDOW_KEY = 'sys_refresh_window_v1';
    const FORCED_WINDOW_KEY = 'sys_forced_refresh_target_v1';

    const checkSystemRoutine = async () => {
      const now = Date.now();

      // 1. Regular Routine: 07:00, 12:00, 18:00
      const d = new Date(now);
      const hour = d.getHours();

      let logicalDate = d;
      let block = "";

      if (hour >= 7 && hour < 12) {
        block = "07";
      } else if (hour >= 12 && hour < 18) {
        block = "12";
      } else {
        block = "18";
        if (hour < 7) {
          // Belongs to the previous day's 18:00 block
          logicalDate = new Date(now - 7 * 60 * 60 * 1000);
        }
      }

      const currentWindow = `${logicalDate.getFullYear()}-${logicalDate.getMonth()}-${logicalDate.getDate()}-${block}`;
      const storedWindow = localStorage.getItem(WINDOW_KEY);

      // 2. Forced Update Target
      let needsForcedUpdate = false;
      if (systemUpdateTarget && now >= systemUpdateTarget) {
        const storedForcedTarget = localStorage.getItem(FORCED_WINDOW_KEY);
        if (!storedForcedTarget || parseInt(storedForcedTarget) < systemUpdateTarget) {
          needsForcedUpdate = true;
        }
      }

      // Se é o primeiro acesso ou cache limpo, inicia silenciosamente já "atualizado"
      if (!storedWindow) {
        localStorage.setItem(WINDOW_KEY, currentWindow);
        if (needsForcedUpdate && systemUpdateTarget) {
          localStorage.setItem(FORCED_WINDOW_KEY, systemUpdateTarget.toString());
        }
        initialMountCheck.current = false;
        return;
      }

      const needsUpdate = (storedWindow !== currentWindow) || needsForcedUpdate;

      if (!currentUser) {
        initialMountCheck.current = false;
        return;
      }

      if (needsUpdate) {
        // Preserva as credenciais de acesso salvas antes de limpar o localStorage
        const savedUser = localStorage.getItem('remember_user');
        const savedPass = localStorage.getItem('remember_pass');

        // Atualização debaixo dos panos: limpa cache e atualiza a flag silenciosamente
        localStorage.clear();
        sessionStorage.clear();

        // Restaura as credenciais salvas
        if (savedUser) localStorage.setItem('remember_user', savedUser);
        if (savedPass) localStorage.setItem('remember_pass', savedPass);

        localStorage.setItem(WINDOW_KEY, currentWindow);
        if (needsForcedUpdate && systemUpdateTarget) {
          localStorage.setItem(FORCED_WINDOW_KEY, systemUpdateTarget.toString());
        }

        if ('caches' in window) {
          caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(() => { });
        }

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs => {
            for (let reg of regs) { reg.unregister(); }
          });
        }

        // Remove faixa de aviso pendente caso exista (legacy)
        const banner = document.getElementById('sys-pending-update-banner');
        if (banner) banner.remove();
        const warningDiv = document.getElementById('sys-refresh-warning');
        if (warningDiv) warningDiv.remove();

        // Forçar desconexão
        auditLogService.clearCache();
        signOut();

        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }

      initialMountCheck.current = false;
    };

    const initialCheck = setTimeout(checkSystemRoutine, 1500); // verifica após o mount
    const interval = setInterval(checkSystemRoutine, 15000); // check mais frequente (15s) para pegar troca de tela rápida

    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
    };
  }, [currentUser, currentView, signOut]);



  const handleLogin = async (u: string, p: string) => {
    setIsLoginTransitioning(true);
    const { error } = await signIn(u, p);
    if (error) {
      setIsLoginTransitioning(false);
    }
    return { error };
  };

  const handleFinish = async (skip2FA = false, digitalSignatureData?: { enabled: boolean, method: string, ip: string, date: string, id: string }, forceOficio = false, customDescription?: string): Promise<boolean> => {
    if (!currentUser || !activeBlock) return false;

    // FRONTEND VALIDATION FOR COMPRAS (ACCOUNT MANDATORY)
    // Fallback block if somehow the UI step validation is bypassed
    // if (activeBlock === 'compras' && !appState.content.selectedAccount) {
    //   // alert("A conta de pagamento é obrigatória para criar ou editar um pedido."); // Replaced by beautiful modal in ComprasStepWizard
    //   return false;
    // }

    // 2FA Interception Logic
    // Skip 2FA if we already have a valid digital signature stored (e.g. from ComprasForm Step 5)
    if (!skip2FA && appState.content.useDigitalSignature && !appState.content.digitalSignature?.enabled) {
      // Find the selected signature user
      // Find the selected signature user with NORMALIZED check
      // Fix: Handle accents, multiple spaces, and case sensitivity
      const normalize = (s: string | undefined | null) =>
        s?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, ' ') || '';

      const signerName = appState.content.signatureName;
      const signerRole = appState.content.signatureRole;

      console.log(`[2FA Debug] Looking for signer: "${signerName}" (Norm: "${normalize(signerName)}") with Role: "${signerRole}"`);
      console.log(`[2FA Debug] Available Users:`, users.map(u => `${u.name} (${u.jobTitle})`));

      const signerUser = users.find(u => {
        const nameMatch = normalize(u.name) === normalize(signerName);
        // Allow role match OR admin role OR within allowedSignatureIds if applicable, but strictly name match first
        const roleMatch = normalize(u.jobTitle) === normalize(signerRole) || u.role === 'admin' || !signerRole;
        return nameMatch && roleMatch;
      });

      console.log(`[2FA Debug] Found User:`, signerUser);

      if (signerUser && (signerUser.twoFactorEnabled || signerUser.twoFactorEnabled2)) {
        setTwoFASecret(signerUser.twoFactorEnabled ? (signerUser.twoFactorSecret || '') : '');
        setTwoFASecret2(signerUser.twoFactorEnabled2 ? (signerUser.twoFactorSecret2 || null) : null);

        setTwoFASignatureName(signerUser.name);
        // Store intent to proceed
        setPendingParams(true);
        setIs2FAModalOpen(true);
        return false;
      }

      // SAFETY CHECK: If 2FA is meant to be enforced (Digital Signature ON) but signer not found or no 2FA credentials
      // We should potentially warn or block if the system implies strict 2FA for signatures.
      // However, for now, if signature is "Manual/External" it might not map to a user.
      // But if the name LOOKS like a user (matches partly) but failed exact match, we fixed that above.
      // If we still didn't find them, we proceed with caution OR alert.
      // Given the requirement "failure in authentication", we should explicit block if we suspect a missing map.
      if (!signerUser && users.some(u => normalize(u.name) === normalize(signerName))) {
        // User exists but role mismatch?
        const matchedNameUser = users.find(u => normalize(u.name) === normalize(signerName));
        console.warn(`[2FA Debug] Role Mismatch. Doc: "${signerRole}", User: "${matchedNameUser?.jobTitle}"`);

        const proceed = window.confirm(`Atenção: O sistema encontrou o usuário "${signerName}", mas o cargo ("${signerRole}") difere do cadastro ("${matchedNameUser?.jobTitle}").\n\nDeseja prosseguir sem 2FA?`);
        if (!proceed) return false;
      }
      if (!signerUser) {
        console.warn(`[2FA Debug] Signer "${signerName}" not found in user database.`);
        const confirmExternal = window.confirm(`O assinante "${signerName}" não foi encontrado na base de usuários para validação 2FA.\n\nDeseja assinar como usuário externo (sem validação)?`);
        if (!confirmExternal) return false;
      }
    }

    // INTERCEPTION FOR NEW OFICIO NUMBERING & COMPRAS
    if ((activeBlock === 'oficio' || activeBlock === 'compras') && !editingOrder && !forceOficio) {
      // PRESERVE DIGITAL SIGNATURE DATA IF PRESENT
      if (digitalSignatureData) {
        setPendingSignatureMetadata(digitalSignatureData);
      }
      setIsOficioNumberingModalOpen(true);
      return false;
    }

    let finalOrder: Order;
    if (editingOrder) {
      const updatedSnapshot = JSON.parse(JSON.stringify(appState));
      updatedSnapshot.content.protocol = editingOrder.protocol;

      // LICITACAO FIX: When finishing the LAST stage, we must push it to history and increment index
      // so it appears green (completed) in stepper.
      if (activeBlock === 'licitacao') {
        const currentIdx = updatedSnapshot.content.currentStageIndex || 0;
        // Only if we are truly at the end (Stage 6)
        // Adjust index check as needed, assuming 6 is the last one (0-6 = 7 stages)
        if (currentIdx === 6) {
          const stagesNames = ['Início', 'Etapa 01', 'Etapa 02', 'Etapa 03', 'Etapa 04', 'Etapa 05', 'Etapa 06'];
          const currentStageData = {
            id: Date.now().toString(),
            title: stagesNames[currentIdx] || 'Etapa Final',
            body: updatedSnapshot.content.body,
            signatureName: updatedSnapshot.content.signatureName,
            signatureRole: updatedSnapshot.content.signatureRole,
            signatureSector: updatedSnapshot.content.signatureSector,
            signatures: updatedSnapshot.content.signatures || []
          };

          // Push to history
          if (!updatedSnapshot.content.licitacaoStages) updatedSnapshot.content.licitacaoStages = [];
          updatedSnapshot.content.licitacaoStages[currentIdx] = currentStageData;

          // Advance index to 7 so stepper sees 6 as completed
          updatedSnapshot.content.currentStageIndex = currentIdx + 1;

          // Clear active body to avoid confusion (optional, but consistent with intermediate steps)
          updatedSnapshot.content.body = '';
          updatedSnapshot.content.signatureName = '';
        }
      }

      // Add digital signature if present
      if (digitalSignatureData) {
        updatedSnapshot.content.digitalSignature = { ...digitalSignatureData, id: digitalSignatureData.id || crypto.randomUUID() };
        setAppState(prev => ({
          ...prev,
          content: {
            ...prev.content,
            digitalSignature: { ...digitalSignatureData, id: digitalSignatureData.id || crypto.randomUUID() }
          }
        }));
      }

      finalOrder = { ...editingOrder, title: appState.content.title, documentSnapshot: updatedSnapshot };

      // Set status to 'finishing' if completely finished (Stage 6 done -> Index 7)
      if (activeBlock === 'licitacao' && updatedSnapshot.content.currentStageIndex === 7) {
        finalOrder.status = 'finishing';
      }

      // Route save based on blockType
      // Route save based on blockType
      // Optimistic Update First
      setOrders(prev => prev.map(o => o.id === finalOrder.id ? finalOrder : o));

      if (finalOrder.blockType === 'compras') {
        try {
          await comprasService.savePurchaseOrder(finalOrder);
        } catch (e) {
          console.error("Failed to save Compras edit:", e);
          setOrders(prev => prev.map(o => o.id === finalOrder.id ? editingOrder : o)); // Revert
          showToast("Erro ao salvar edição. Revertendo...", "error");
          return false;
        }
      } else if (finalOrder.blockType === 'diarias') {
        setServiceRequests(prev => prev.map(o => o.id === finalOrder.id ? finalOrder : o));
        try {
          await diariasService.saveServiceRequest(finalOrder);
        } catch (e) {
          setServiceRequests(prev => prev.map(o => o.id === finalOrder.id ? editingOrder : o));
          setOrders(prev => prev.map(o => o.id === finalOrder.id ? editingOrder : o));
          showToast("Erro ao salvar diária.", "error");
          return false;
        }
      } else if (finalOrder.blockType === 'licitacao') {
        setLicitacaoProcesses(prev => prev.map(o => o.id === finalOrder.id ? finalOrder : o));
        try {
          await licitacaoService.saveLicitacaoProcess(finalOrder);
        } catch (e) {
          setLicitacaoProcesses(prev => prev.map(o => o.id === finalOrder.id ? editingOrder : o));
          setOrders(prev => prev.map(o => o.id === finalOrder.id ? editingOrder : o));
          showToast("Erro ao salvar processo.", "error");
          return false;
        }
      } else {
        // Optimistic Update Oficio
        // We already updated orders above.
        // We typically update Oficios Store too or rely on orders.
        setOficios(prev => prev.map(o => o.id === finalOrder.id ? finalOrder : o)); // Explicit optimistic
        try {
          await updateOficioMutation.mutateAsync(finalOrder);
        } catch (e) {
          console.error("Failed to update Oficio", e);
          setOficios(prev => prev.map(o => o.id === finalOrder.id ? editingOrder : o));
          setOrders(prev => prev.map(o => o.id === finalOrder.id ? editingOrder : o));
          showToast("Erro ao salvar ofício.", "error");
          return false;
        }
      }

      // Log editing action
      auditLogService.logAction({
        action_type: 'action',
        module: finalOrder.blockType || 'geral',
        description: `Editou o documento: "${finalOrder.title || 'documento'}" (${finalOrder.protocol})`,
        details: { id: finalOrder.id, protocol: finalOrder.protocol, title: finalOrder.title, type: finalOrder.blockType }
      });

      setAppState(updatedSnapshot);
      clearDraft();
      setIsFinalizedView(true);
      setIsAdminSidebarOpen(false);
      return true;
    } else {
      let protocolString = '';
      let uniqueProtocolId = ''; // Secondary unique tracking ID

      const nextVal = await db.incrementGlobalCounter();
      setGlobalCounter(nextVal);
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const year = new Date().getFullYear();

      // AUTO-INCREMENT SECTOR COUNTER (Unified for ALL blocks)
      // For Diarias, we use a global counter, so skip the sector counter increment
      const userSector = currentUser?.sector ? sectors.find(s => s.name === currentUser.sector) : null;

      if (userSector) {
        // Increment the server counter regardless of block type (except Diarias)
        // EXCEPTION: Oficio is now generated dynamically below, so we skip it here if it's 'oficio'

        if (activeBlock !== 'oficio' && activeBlock !== 'diarias' && activeBlock !== 'compras') {
          await counterService.incrementSectorCount(userSector.id, year);
        }
      }

      // OFICIO ON-DEMAND GENERATION LOGIC
      // Note: userSector must be re-derived or accessed from scope if we are outside the previous block.
      // However, the previous block was inside 'else'. We are currently inside 'else'.
      // Let's ensure userSector is available.

      // We need to fetch userSector again or ensure it's in scope if we are strictly following previous logic structure.
      // To be safe, I will re-find it here if it wasn't hoisted, but locally in this block it is available if I defined it above.

      // Wait, the block at 654 'else {' wraps everything until 766. 
      // So 'userSector' defined at 663 (replacement) is available throughout.

      if (activeBlock === 'oficio' || activeBlock === 'compras') {
        const currentSector = sectors.find(s => s.name === currentUser?.sector);
        if (currentSector) {
          const nextNum = await counterService.incrementSectorCount(currentSector.id, year);

          if (nextNum) {
            const formattedNum = nextNum.toString().padStart(3, '0');

            if (activeBlock === 'oficio') {
              // Update leftBlockText in the snapshot
              const currentLeftText = appState.content.leftBlockText || '';
              const extraInfo = currentLeftText.includes('\n') ? currentLeftText.substring(currentLeftText.indexOf('\n')) : '';
              const finalRefText = `Ref: Ofício nº ${formattedNum}/${year}${extraInfo}`;
              appState.content.leftBlockText = finalRefText;

              // Also set protocol string for consistency
              protocolString = `OFC-${formattedNum}/${year}`;
            } else if (activeBlock === 'compras') {
              // For Compras, we set the protocol string AND update the document content
              const generatedProtocol = `COM-${formattedNum}/${year}`;
              protocolString = generatedProtocol;

              // Replace placeholder in leftBlockText
              // Usually initialized as "Carregando...\nAssunto: ..."
              let currentLeftText = appState.content.leftBlockText || '';
              if (currentLeftText.includes('Carregando...')) {
                currentLeftText = currentLeftText.replace('Carregando...', `Pedido nº ${formattedNum}/${year}`);
              } else if (!currentLeftText.includes('Pedido nº')) {
                // Fallback if not strictly matching placeholder
                currentLeftText = `Pedido nº ${formattedNum}/${year}\n${currentLeftText}`;
              }
              // CRITICAL: Ensure this update is actually reflected in the snapshot we are about to save
              appState.content.leftBlockText = currentLeftText;
            }
          }
        }
      }

      if (activeBlock === 'diarias') {
        if (appState.content.protocol) {
          protocolString = appState.content.protocol;
          // Also check if we need to sync global counter (nextVal) for GID
          // uniqueProtocolId = `GID-${nextVal}-${year}-${randomPart}`;
        } else {
          const diariaCount = await counterService.incrementDiariasProtocolCount(year);
          const formattedNum = (diariaCount || 1).toString().padStart(3, '0');
          protocolString = `DIA-${formattedNum}/${year}`;
        }

        // Generate Unique Tracking ID for Diarias (Global Counter + Random)
        uniqueProtocolId = `GID-${nextVal}-${year}-${randomPart}`;
      } else if (!protocolString) { // Only generate random if not already set (by Diarias or Compras/Oficio above)
        const prefix = activeBlock === 'oficio' ? 'OFC' : activeBlock === 'compras' ? 'COM' : 'LIC';
        protocolString = `${prefix}-${year}-${randomPart}`;
      }

      const finalSnapshot = JSON.parse(JSON.stringify(appState));
      finalSnapshot.content.protocol = protocolString;

      // Populate requesterSector for Oficio and Compras for easier querying/listing
      if (activeBlock === 'oficio' || activeBlock === 'compras') {
        finalSnapshot.content.requesterSector = currentUser.sector;
      }

      if (uniqueProtocolId) {
        finalSnapshot.content.protocolId = uniqueProtocolId;
      }

      // For Diarias, also update the leftBlockText with the finalized number to ensure it matches the generated protocol
      if (activeBlock === 'diarias') {
        finalSnapshot.content.leftBlockText = `Solicitação Nº: ${protocolString}`;
      }

      // Add digital signature if present
      if (digitalSignatureData) {
        finalSnapshot.content.digitalSignature = { ...digitalSignatureData, id: digitalSignatureData.id || crypto.randomUUID() };
        setAppState(prev => ({
          ...prev,
          content: {
            ...prev.content,
            digitalSignature: { ...digitalSignatureData, id: digitalSignatureData.id || crypto.randomUUID() }
          }
        }));
      }

      finalOrder = {
        id: Date.now().toString(),
        protocol: protocolString,
        title: appState.content.title,
        status: 'pending',
        createdAt: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.name,
        blockType: activeBlock,
        documentSnapshot: finalSnapshot,
        paymentStatus: activeBlock === 'diarias' ? 'pending' : undefined,
        statusHistory: activeBlock === 'compras' ? [{ statusLabel: 'Criação do Pedido', date: new Date().toISOString(), userName: currentUser.name }] : [],
        attachments: appState.content.attachments || [],
        description: customDescription || appState.content.description || '',
        requestingSector: (activeBlock === 'oficio' || activeBlock === 'compras') ? currentUser.sector : undefined
      };

      if (activeBlock === 'compras') {
        // ACTIVATE LOADING MODAL - STEP 1: VALIDATION/PREP
        setPurchaseLoadingState({
          isLoading: true,
          title: 'Finalizando Pedido',
          message: 'Validando dados e preparando documento...'
        });

        // PDF GENERATION & UPLOAD
        setIsDownloading(true);
        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 500));

        // STEP 2: PDF GENERATION
        setPurchaseLoadingState(prev => ({ ...prev, message: 'Gerando arquivo PDF do pedido...' }));

        try {
          if (componentRef.current) {
            // Force light mode for capture if needed, or rely on preview styles
            const canvas = await html2canvas(componentRef.current, {
              // @ts-ignore - 'scale' might be missing in older type definitions but is supported
              scale: 2,
              logging: false,
              useCORS: true,
              backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 0; // Top align

            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
            const pdfBlob = pdf.output('blob');

            // STEP 3: UPLOAD
            setPurchaseLoadingState(prev => ({ ...prev, message: 'Enviando anexos para o servidor...' }));

            const fileName = `pedido_${protocolString.replace(/\//g, '-')}_${Date.now()}.pdf`;
            const publicUrl = await comprasService.uploadPurchaseAttachment(pdfBlob, fileName);

            const attachment: Attachment = {
              id: Date.now().toString(),
              name: fileName,
              url: publicUrl,
              type: 'application/pdf',
              date: new Date().toISOString()
            };

            finalOrder.attachments = [...(appState.content.attachments || []), attachment]; // Append logic
          }
        } catch (pdfErr) {
          console.error("Error generating/uploading PDF for Compras:", pdfErr);
          // Non-fatal? Or should we alert? Let's log and proceed but maybe without attachment
          showToast("Erro ao gerar PDF do pedido. O pedido será salvo sem o anexo.", "error");
        } finally {
          // Keep loading for DB save
        }

        try {
          // STEP 4: SAVING TO DB
          setPurchaseLoadingState(prev => ({ ...prev, message: 'Registrando pedido no banco de dados...' }));

          await comprasService.savePurchaseOrder(finalOrder);

          // Log creation action
          auditLogService.logAction({
            action_type: 'action',
            module: 'compras',
            description: `Criou o pedido de compra: "${finalOrder.title || 'documento'}" (${protocolString})`,
            details: { id: finalOrder.id, protocol: protocolString, title: finalOrder.title, type: 'compras' }
          });

          // STEP 5: SUCCESS/REDIRECT
          setPurchaseLoadingState(prev => ({ ...prev, title: 'Sucesso!', message: 'Pedido registrado. Redirecionando...' }));
          await new Promise(resolve => setTimeout(resolve, 800)); // Small delay to let user see success

          setOrders(prev => [finalOrder, ...prev]); // Keep synced if view uses this
          setOrders(prev => [finalOrder, ...prev]); // Keep synced if view uses this

          // REDIRECT COMPRAS TO HISTORY IMMEDIATELY
          setAppState(finalSnapshot);
          clearDraft();
          setCurrentView('tracking');
          setIsDownloading(false);
          setIsAdminSidebarOpen(false);
          return true;
        } catch (error) {
          console.error("Error saving purchase order:", error);
          showToast("Erro ao salvar o pedido. Tente novamente.", "error");
          return false;
        } finally {
          setPurchaseLoadingState(prev => ({ ...prev, isLoading: false })); // Stop Loading Modal
        }
      } else if (activeBlock === 'diarias') {
        // Optimistic Update
        setServiceRequests(prev => [finalOrder, ...prev]);
        setOrders(prev => [finalOrder, ...prev]);
        try {
          const savedOrder = await diariasService.saveServiceRequest(finalOrder);

          // Log creation action
          auditLogService.logAction({
            action_type: 'action',
            module: 'diarias',
            description: `Criou a solicitação de diária: "${finalOrder.title || 'documento'}" (${savedOrder.protocol})`,
            details: { id: savedOrder.id, protocol: savedOrder.protocol, title: finalOrder.title, type: 'diarias' }
          });

          // Update state if protocol was changed during save (retry logic)
          if (savedOrder.protocol !== finalOrder.protocol) {
            setServiceRequests(prev => prev.map(o => o.id === savedOrder.id ? savedOrder : o));
            setOrders(prev => prev.map(o => o.id === savedOrder.id ? savedOrder : o));

            // Update current app state protocol if we are still editing/viewing this order
            if (appState.content.protocol === finalOrder.protocol) {
              setAppState(prev => ({
                ...prev,
                content: {
                  ...prev.content,
                  protocol: savedOrder.protocol,
                  leftBlockText: `Solicitação Nº: ${savedOrder.protocol}`
                }
              }));
            }
          }
        } catch (err) {
          setServiceRequests(prev => prev.filter(o => o.id !== finalOrder.id));
          setOrders(prev => prev.filter(o => o.id !== finalOrder.id));
          showToast("Erro ao salvar diária.", "error");
          return false;
        }
      } else if (activeBlock === 'licitacao') {
        // Optimistic Update Before API
        setLicitacaoProcesses(prev => [finalOrder, ...prev]);
        setOrders(prev => [finalOrder, ...prev]);

        try {
          await licitacaoService.saveLicitacaoProcess(finalOrder);

          // Log creation action
          auditLogService.logAction({
            action_type: 'action',
            module: 'licitacao',
            description: `Criou o processo de licitação: "${finalOrder.title || 'documento'}" (${protocolString})`,
            details: { id: finalOrder.id, protocol: protocolString, title: finalOrder.title, type: 'licitacao' }
          });

          setAppState(finalSnapshot);
          clearDraft();
          setCurrentView('licitacao-all');
          setIsAdminSidebarOpen(false);
          return true;
        } catch (err) {
          console.error("Failed to save Licitacao:", err);
          // Rollback
          setLicitacaoProcesses(prev => prev.filter(o => o.id !== finalOrder.id));
          setOrders(prev => prev.filter(o => o.id !== finalOrder.id));
          showToast("Erro ao salvar processo. Revertendo...", "error");
          return false;
        }
      } else {
        // OFICIO Optimistic Update
        setOrders(prev => [finalOrder, ...prev]);
        try {
          console.log("Saving new Oficio via Mutation...", finalOrder);
          await createOficioMutation.mutateAsync(finalOrder);

          // Log creation action
          auditLogService.logAction({
            action_type: 'action',
            module: 'oficio',
            description: `Criou o ofício: "${finalOrder.title || 'documento'}" (${protocolString})`,
            details: { id: finalOrder.id, protocol: protocolString, title: finalOrder.title, type: 'oficio' }
          });

          console.log("Oficio Saved Successfully.");
        } catch (err) {
          console.error("Failed to save Oficio:", err);
          setOrders(prev => prev.filter(o => o.id !== finalOrder.id));
          alert("Erro ao salvar o ofício. Verifique o console.");
          return false;
        }
      }
      setAppState(finalSnapshot);
      clearDraft(); // CLEAR DRAFT ON SUCCESS
    }
    setIsFinalizedView(true);
    setIsAdminSidebarOpen(false);
    return true;
  };

  // Helper for Realtime Sync & Fallback Refetching
  const syncOrders = useCallback(async (targetBlock: string) => {
    try {
      // Invalidate React Query Cache for specialized lists to ensure hooks are in sync
      const keys: Record<string, any> = {
        compras: purchaseOrderKeys.all,
        oficio: oficioKeys.all,
        diarias: serviceRequestKeys.all,
      };

      if (keys[targetBlock]) {
        queryClient.invalidateQueries({ queryKey: keys[targetBlock] });
      }

      let updatedList: Order[] = [];
      if (targetBlock === 'compras') {
        updatedList = await comprasService.getAllPurchaseOrders();
        // setPurchaseOrders(updatedList); // REMOVED: Derived from orders
      } else if (targetBlock === 'diarias') {
        updatedList = await diariasService.getAllServiceRequests();
        setServiceRequests(updatedList);
      } else if (targetBlock === 'licitacao') {
        updatedList = await licitacaoService.getAllLicitacaoProcesses();
        setLicitacaoProcesses(updatedList);
      } else {
        updatedList = await oficiosService.getAllOficios();
        setOficios(updatedList);
      }

      setOrders(prev => {
        const others = prev.filter(o => o.blockType !== targetBlock);
        return [...others, ...updatedList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
    } catch (err) {
      console.error(`Sync failed for ${targetBlock}:`, err);
    }
  }, []);

  // Realtime Listener for Purchase Orders (Single Store Sync)
  useEffect(() => {
    const channel = supabase
      .channel('purchase-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'purchase_orders' },
        (payload) => {
          console.log('Realtime UPDATE detected for purchase_orders:', payload);
          syncOrders('compras');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [syncOrders]);

  // OPTIMISTIC DELETE HANDLER
  const handleDeleteOrder = async (id: string) => {
    if (isDeleting === id) return; // Prevent duplicate actions
    setIsDeleting(id);

    // Resolve target block since global activeBlock might be null
    const targetOrder = orders.find(o => o.id === id) ||
      mappedLicitacaoOrders.find(o => o.id === id) ||
      serviceRequests.find(o => o.id === id) ||
      oficios.find(o => o.id === id);
    const resolvedBlockType = targetOrder?.blockType || activeBlock || 'oficio';

    // 1. Snapshot previous state for rollback
    const prevOrders = orders;
    const prevServiceRequests = serviceRequests;
    const prevLicitacaoProcesses = licitacaoProcesses;
    const prevOficios = oficios;

    // 2. Optimistic Update
    const isPurchaseAction = resolvedBlockType === 'compras';

    if (isPurchaseAction) {
      setActionProcessing({
        isOpen: true,
        stage: 'sending',
        customLabels: {
          sending: { label: 'Iniciando Exclusão', description: 'Preparando remoção segura do pedido...' },
          validating: { label: 'Verificando Permissões', description: 'Confirmando autorização para excluir...' },
          confirming: { label: 'Excluindo do Banco', description: 'Removendo registro permanentemente...' },
          success: { label: 'Excluído com Sucesso', description: 'O pedido foi removido permanentemente da base de dados.' }
        }
      });
      await new Promise(resolve => setTimeout(resolve, 800));
      await advanceActionStep('validating', 1200);
    }

    try {
      if (isPurchaseAction) {
        await advanceActionStep('confirming', 1500);
      }
      // 3. API Call
      if (resolvedBlockType === 'compras') {
        await comprasService.deletePurchaseOrder(id);
      } else if (resolvedBlockType === 'diarias') {
        await diariasService.deleteServiceRequest(id);
      } else if (resolvedBlockType === 'licitacao') {
        await licitacaoService.deleteLicitacaoProcess(id);
      } else {
        await deleteOficioMutation.mutateAsync(id);
      }

      // Log delete action
      auditLogService.logAction({
        action_type: 'action',
        module: resolvedBlockType || 'geral',
        description: `Excluiu o documento: "${targetOrder?.title || 'documento'}" (${targetOrder?.protocol || id})`,
        details: { id, protocol: targetOrder?.protocol, title: targetOrder?.title, type: resolvedBlockType }
      });

      // 4. Success UI Update (After confirm)
      setOrders(p => p.filter(o => o.id !== id));
      if (resolvedBlockType === 'diarias') setServiceRequests(p => p.filter(o => o.id !== id));
      else if (resolvedBlockType === 'licitacao') setLicitacaoProcesses(p => p.filter(o => o.id !== id));
      else if (resolvedBlockType !== 'compras') setOficios(p => p.filter(o => o.id !== id));

      // 5. Force React Query Update (Immediate + Refetch)
      const queryKeyMap: Record<string, any> = {
        'compras': purchaseOrderKeys.lists(),
        'oficio': oficioKeys.lists(),
        'diarias': serviceRequestKeys.lists(),
        'licitacao': licitacaoKeys.lists()
      };

      const targetKey = queryKeyMap[resolvedBlockType || 'oficio'];

      if (targetKey) {
        // Manually remove from query cache for immediate UI feedback
        queryClient.setQueriesData({ queryKey: targetKey }, (oldData: any) => {
          if (!oldData) return oldData;
          if (oldData.pages) {
            return {
              ...oldData,
              pages: oldData.pages.map((page: any[]) => page.filter(o => o.id !== id))
            };
          } else if (Array.isArray(oldData)) {
            return oldData.filter(o => o.id !== id);
          }
          return oldData;
        });

        // Final invalidation to ensure sync with DB
        await queryClient.invalidateQueries({ queryKey: targetKey });
      }

      showToast("Item excluído com sucesso", "success");
      syncOrders(resolvedBlockType || 'oficio');

      if (isPurchaseAction) {
        await advanceActionStep('success', 2000);
        setActionProcessing(prev => ({ ...prev, isOpen: false }));
      }
    } catch (error) {
      console.error("Error deleting order:", error);
      // 4. Rollback on Error
      setOrders(prevOrders);
      if (resolvedBlockType === 'compras') { /* Derived rollback */ }
      else if (resolvedBlockType === 'diarias') setServiceRequests(prevServiceRequests);
      else if (resolvedBlockType === 'licitacao') setLicitacaoProcesses(prevLicitacaoProcesses);
      else setOficios(prevOficios);
      showToast(error instanceof Error ? error.message : "Erro ao excluir item. As alterações foram desfeitas.", "error");
    } finally {
      setIsDeleting(null);
      if (isPurchaseAction) {
        setActionProcessing(prev => ({ ...prev, isOpen: false }));
      }
    }
  };

  const handleSendOrder = async () => {
    if (!currentUser || !activeBlock) return;
    const lastOrder = orders[orders.length - 1];
    setIsDownloading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsDownloading(false);
    setSuccessOverlay({ show: true, protocol: appState.content.protocol || lastOrder?.protocol || 'ERRO-PROTOCOLO' });
  };

  const handleEditOrder = async (order: Order) => {
    setLastListView(currentView); // Track where we came from

    // LAZY LOAD DETAILS (Optimized Oficios)
    let fullOrder = order;
    if (order.blockType === 'oficio' && (!order.documentSnapshot?.content || Object.keys(order.documentSnapshot.content).length === 0)) {
      setIsLoadingDetails(true);
      try {
        const fetched = await oficiosService.getOficioById(order.id);
        if (fetched) {
          fullOrder = fetched;
          // Update local cache so we don't fetch again
          setOficios(prev => prev.map(o => o.id === fullOrder.id ? fullOrder : o));
        } else {
          alert("Erro ao carregar os detalhes do ofício. Tente novamente.");
          setIsLoadingDetails(false);
          return;
        }
      } catch (err) {
        console.error("Error fetching details", err);
        alert("Erro de conexão ao carregar ofício.");
        setIsLoadingDetails(false);
        return;
      } finally {
        setIsLoadingDetails(false);
      }
    }

    // LAZY LOAD DETAILS (Optimized Compras)
    // CRITICAL: We check for purchaseItems existence to distinguish full data from "skeleton" lightweight data
    if (order.blockType === 'compras' && (!order.documentSnapshot?.content?.purchaseItems || order.documentSnapshot.content.purchaseItems.length === 0)) {
      setIsLoadingDetails(true);
      try {
        const fetched = await comprasService.getPurchaseOrderById(order.id);
        if (fetched) {
          fullOrder = fetched;
          // Update local cache so we don't fetch again
          // setPurchaseOrders removal: Derived state
          setOrders(prev => prev.map(o => o.id === fullOrder.id ? fullOrder : o));
        } else {
          alert("Erro ao carregar os detalhes do pedido. Tente novamente.");
          setIsLoadingDetails(false);
          return;
        }
      } catch (err) {
        console.error("Error fetching purchase details", err);
        alert("Erro de conexão ao carregar pedido.");
        setIsLoadingDetails(false);
        return;
      } finally {
        setIsLoadingDetails(false);
      }
    }

    // LAZY LOAD DETAILS (Optimized Diarias)
    if (order.blockType === 'diarias' && (!order.documentSnapshot?.content || (order.documentSnapshot as any).isLightweight)) {
      setIsLoadingDetails(true);
      try {
        const fetched = await diariasService.getServiceRequestById(order.id);
        if (fetched) {
          console.log('[DEBUG] Fetched Diária from DB:', fetched.documentSnapshot?.content);
          fullOrder = fetched;
          // Update local cache
          setServiceRequests(prev => prev.map(o => o.id === fullOrder.id ? fullOrder : o));
        } else {
          alert("Erro ao carregar os detalhes da diária. Tente novamente.");
          setIsLoadingDetails(false);
          return;
        }
      } catch (err) {
        console.error("Error fetching diaria details", err);
        alert("Erro de conexão ao carregar diária.");
        setIsLoadingDetails(false);
        return;
      } finally {
        setIsLoadingDetails(false);
      }
    }

    // LAZY LOAD DETAILS (Optimized Licitacao)
    // CRITICAL: Check for stages to distinguish from skeleton
    if (order.blockType === 'licitacao' && (!order.documentSnapshot?.content?.licitacaoStages || order.documentSnapshot.content.licitacaoStages.length === 0)) {
      setIsLoadingDetails(true);
      try {
        const fetched = await licitacaoService.getLicitacaoProcessById(order.id);
        if (fetched) {
          fullOrder = fetched as any;
          // Update local cache
          setLicitacaoProcesses(prev => prev.map(o => o.id === fullOrder.id ? fullOrder : o));
        } else {
          alert("Erro ao carregar os detalhes do processo. Tente novamente.");
          setIsLoadingDetails(false);
          return;
        }
      } catch (err) {
        console.error("Error fetching licitacao details", err);
        alert("Erro de conexão ao carregar processo de licitação.");
        setIsLoadingDetails(false);
        return;
      } finally {
        setIsLoadingDetails(false);
      }
    }

    let snapshotToUse = fullOrder.documentSnapshot;

    // STRICT NAVIGATION GUARD: Licitacao logic
    if (fullOrder.blockType === 'licitacao') {
      const isMeusProcessos = currentView === 'tracking';

      if (isMeusProcessos) {
        // Only lock and restrict if it's AWAITING APPROVAL or APPROVED/IN_PROGRESS/FINISHING/COMPLETED (all post-submission states)
        // If it's PENDING (drafting) or REJECTED (needs correction), let them edit.
        if (['awaiting_approval', 'approved', 'in_progress', 'finishing', 'completed'].includes(order.status || '')) {
          setIsStepperLocked(true);
          if (snapshotToUse && snapshotToUse.content) {
            const content = snapshotToUse.content;
            // If already advanced beyond Stage 0, we must load Stage 0 data from history
            let restrictedContent = { ...content, viewingStageIndex: 0 };

            if ((content.currentStageIndex || 0) > 0 && content.licitacaoStages && content.licitacaoStages[0]) {
              const stage0 = content.licitacaoStages[0];
              restrictedContent = {
                ...restrictedContent,
                body: stage0.body || '',
                signatureName: stage0.signatureName || '',
                signatureRole: stage0.signatureRole || '',
                signatureSector: stage0.signatureSector || '',
                signatures: stage0.signatures || []
              };
            }

            snapshotToUse = {
              ...snapshotToUse,
              content: restrictedContent
            };
            showToast("Visualização restrita à etapa Início", "warning");
          }
        } else {
          setIsStepperLocked(false);
          // Auto-sync viewing index to active tip when opening
          if (snapshotToUse?.content) {
            snapshotToUse = {
              ...snapshotToUse,
              content: {
                ...snapshotToUse.content,
                viewingStageIndex: snapshotToUse.content.currentStageIndex || 0
              }
            };
          }
        }
      } else {
        setIsStepperLocked(false);
        // Standard check for unapproved processes in other views (e.g. Triagem)
        if (order.status === 'awaiting_approval') {
          if (snapshotToUse && snapshotToUse.content) {
            const content = snapshotToUse.content;
            let restrictedContent = { ...content, viewingStageIndex: 0 };

            // Data Sync: Load Stage 0 if we are restricted due to approval status
            if ((content.currentStageIndex || 0) > 0 && content.licitacaoStages && content.licitacaoStages[0]) {
              const stage0 = content.licitacaoStages[0];
              restrictedContent = {
                ...restrictedContent,
                body: stage0.body || '',
                signatureName: stage0.signatureName || '',
                signatureRole: stage0.signatureRole || '',
                signatureSector: stage0.signatureSector || '',
                signatures: stage0.signatures || []
              };
            }

            snapshotToUse = {
              ...snapshotToUse,
              content: restrictedContent
            };
            showToast("Processo em aprovação: Visualização limitada à etapa Início", "info");
          }
        }
      }
    } else {
      setIsStepperLocked(false);
    }

    if (snapshotToUse) {
      setAppState(prev => ({
        ...prev,
        content: {
          ...prev.content,
          ...snapshotToUse.content
        }
      }));
    }
    setActiveBlock(order.blockType);
    setEditingOrder(order);
    setCurrentView('editor');
    setAdminTab('content');
    setIsAdminSidebarOpen(true);
    setAdminTab('content');
    setIsAdminSidebarOpen(true);

    // View-Only Mode for Sent Purchase Orders
    if (order.blockType === 'compras' && order.status !== 'pending') {
      setIsFinalizedView(true);
    } else {
      setIsFinalizedView(false);
    }

    setIsReopeningStage(false); // Reset reopening state
  };

  const handleUpdateOrderStatus = async (orderOrId: string | Order, status: Order['status'], justification?: string) => {
    if (!currentUser) return;

    let orderToUpdate: Order | undefined;
    if (typeof orderOrId === 'string') {
      orderToUpdate = orders.find(o => o.id === orderOrId);
    } else {
      orderToUpdate = orderOrId;
    }

    if (!orderToUpdate) {
      console.warn("Order not found for update:", orderOrId);
      return;
    }

    // STRICT BLOCK: Rejected Purchase Orders are definitively locked
    if (orderToUpdate.blockType === 'compras' && orderToUpdate.status === 'rejected') {
      showToast('Ação Bloqueada: Pedido definitivamente rejeitado e bloqueado.', 'error');
      return;
    }

    // RULE: Admin approval/rejection only allowed if current status is "Em Aprovação"
    if (orderToUpdate.blockType === 'compras' && (status === 'approved' || status === 'rejected')) {
      const isEmAprovacao = !orderToUpdate.status || orderToUpdate.status === 'pending' || orderToUpdate.status === 'awaiting_approval' || orderToUpdate.status === 'payment_account';
      if (!isEmAprovacao) {
        showToast('Ação Bloqueada: O fluxo deste pedido já avançou para compras e não permite reavaliação administrativa.', 'error');
        return;
      }
    }

    // 1. Snapshot previous state
    const prevOrders = orders;
    const prevSpecificList = orderToUpdate.blockType === 'compras' ? purchaseOrders :
      orderToUpdate.blockType === 'diarias' ? serviceRequests :
        orderToUpdate.blockType === 'licitacao' ? licitacaoProcesses : oficios;

    // 2. Prepare new data
    let targetStatus = status;
    const isPurchase = orderToUpdate.blockType === 'compras';

    // Account verification/selection is obsolete; route approval directly to 'approved' status.

    const newMovement: StatusMovement = {
      statusLabel: targetStatus === 'approved' ? 'Aprovação Administrativa' :
        (targetStatus === 'payment_account' ? 'Aprovação' :
          (status === 'rejected' ? 'Rejeição' : `Status alterado para ${status}`)),
      date: new Date().toISOString(),
      userName: currentUser.name,
      justification
    };

    const updatedOrder = {
      ...orderToUpdate,
      status: targetStatus,
      statusHistory: [...(orderToUpdate.statusHistory || []), newMovement]
    };

    // Log status update action
    auditLogService.logAction({
      action_type: 'action',
      module: orderToUpdate.blockType || 'geral',
      description: `Alterou status do documento: "${orderToUpdate.title || 'documento'}" (${orderToUpdate.protocol}) para "${newMovement.statusLabel}"`,
      details: { protocol: orderToUpdate.protocol, title: orderToUpdate.title, newStatus: targetStatus, type: orderToUpdate.blockType, justification }
    });

    // 3. Optimistic Update (Immediate UI Refresh)
    const updateList = (list: Order[]) => {
      const exists = list.some(o => o.id === updatedOrder.id);
      if (!exists) return [updatedOrder, ...list];
      return list.map(o => o.id === updatedOrder.id ? updatedOrder : o);
    };

    // TRIGGER IMMEDIATE UI UPDATE
    setOrders(updateList);
    if (updatedOrder.blockType === 'compras') { /* Derived */ }
    else if (updatedOrder.blockType === 'diarias') setServiceRequests(updateList);
    else if (updatedOrder.blockType === 'licitacao') setLicitacaoProcesses(updateList);
    else setOficios(updateList);

    // Sync React Query Infinite Cache for Immediate UI Consistency
    const blockKey = updatedOrder.blockType === 'compras' ? purchaseOrderKeys.lists() :
      updatedOrder.blockType === 'diarias' ? serviceRequestKeys.lists() :
        updatedOrder.blockType === 'licitacao' ? licitacaoKeys.lists() : oficioKeys.lists();

    const detailKey = updatedOrder.blockType === 'compras' ? purchaseOrderKeys.detail(updatedOrder.id) :
      updatedOrder.blockType === 'diarias' ? serviceRequestKeys.detail(updatedOrder.id) :
        updatedOrder.blockType === 'licitacao' ? licitacaoKeys.detail(updatedOrder.id) : oficioKeys.detail(updatedOrder.id);

    // 1. Update Infinite Queries (Fuzzy match)
    queryClient.setQueriesData({ queryKey: [...blockKey, 'infinite'] }, (oldData: any) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page: any) =>
          page.map((order: any) => order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order)
        )
      };
    });

    // 2. Update Base List Queries (Exact/Fuzzy match)
    queryClient.setQueriesData({ queryKey: blockKey }, (oldData: any) => {
      if (!oldData || !Array.isArray(oldData)) return oldData;
      return oldData.map((order: any) => order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order);
    });

    // 3. Update Detail Query
    queryClient.setQueriesData({ queryKey: detailKey }, (oldData: any) => {
      if (!oldData) return oldData;
      return { ...oldData, ...updatedOrder };
    });

    // Removed blocking overlay for instantaneous feel

    try {
      // 4. API Sync
      if (updatedOrder.blockType === 'compras') {
        await comprasService.updateOrderStatus(updatedOrder.id, updatedOrder.status, newMovement);
      } else if (updatedOrder.blockType === 'diarias') {
        await diariasService.saveServiceRequest(updatedOrder);
      } else if (updatedOrder.blockType === 'licitacao') {
        await licitacaoService.saveLicitacaoProcess(updatedOrder);
      } else {
        await oficiosService.saveOficio(updatedOrder);
      }
      showToast(status === 'approved' ? "Pedido Aprovado" : (status === 'rejected' ? "Pedido Rejeitado" : "Status Atualizado"), "success");

      // Background sync to ensure consistency
      syncOrders(updatedOrder.blockType);

    } catch (error: any) {
      // 5. Rollback
      console.error("Failed to update status:", error);
      setOrders(prevOrders);
      if (updatedOrder.blockType === 'compras') { /* Derived */ }
      else if (updatedOrder.blockType === 'diarias') setServiceRequests(prevSpecificList);
      else if (updatedOrder.blockType === 'licitacao') setLicitacaoProcesses(prevSpecificList);
      else setOficios(prevSpecificList);

      // Rollback React Query Cache
      queryClient.invalidateQueries({ queryKey: blockKey });

      showToast("Erro ao atualizar status. As alterações foram desfeitas.", "error");
    } finally {
      // Overlay removed
    }
  };

  const handleResetOrderFlow = async (order: Order) => {
    if (!currentUser) return;
    const prevOrders = orders;
    const newMovement: StatusMovement = {
      statusLabel: 'Fluxo Reiniciado',
      date: new Date().toISOString(),
      userName: currentUser.name,
      justification: 'Fluxo reiniciado do zero devido a inatividade (Sem Movimentação)'
    };

    const updatedDocumentSnapshot = order.documentSnapshot ? {
      ...order.documentSnapshot,
      content: {
        ...order.documentSnapshot.content,
        signatureName: '',
        signatureRole: '',
        useDigitalSignature: true,
        digitalSignature: { 
          enabled: false,
          method: '',
          ip: '',
          date: '',
          id: ''
        }
      }
    } : null;

    const updatedOrder: Order = {
      ...order,
      status: 'pending',
      purchaseStatus: null,
      documentSnapshot: updatedDocumentSnapshot,
      statusHistory: [...(order.statusHistory || []), newMovement]
    };

    auditLogService.logAction({
      action_type: 'action',
      module: order.blockType || 'geral',
      description: `Reiniciou o fluxo do pedido: "${order.title || 'documento'}" (${order.protocol}) do zero`,
      details: { protocol: order.protocol, title: order.title, type: order.blockType }
    });

    const updateList = (list: Order[]) => {
      return list.map(o => o.id === updatedOrder.id ? updatedOrder : o);
    };
    setOrders(updateList);

    const blockKey = purchaseOrderKeys.lists();
    const detailKey = purchaseOrderKeys.detail(updatedOrder.id);

    queryClient.setQueriesData({ queryKey: [...blockKey, 'infinite'] }, (oldData: any) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page: any) =>
          page.map((o: any) => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o)
        )
      };
    });

    queryClient.setQueriesData({ queryKey: blockKey }, (oldData: any) => {
      if (!oldData || !Array.isArray(oldData)) return oldData;
      return oldData.map((o: any) => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o);
    });

    queryClient.setQueriesData({ queryKey: detailKey }, (oldData: any) => {
      if (!oldData) return oldData;
      return { ...oldData, ...updatedOrder };
    });

    try {
      await comprasService.savePurchaseOrder(updatedOrder);
      showToast("Fluxo de Pedido Reiniciado do Zero", "success");
      syncOrders('compras');
    } catch (err) {
      console.error("Failed to reset order flow:", err);
      setOrders(prevOrders);
      queryClient.invalidateQueries({ queryKey: blockKey });
      showToast("Erro ao reiniciar o fluxo do pedido.", "error");
    }
  };

  const handleUpdatePurchaseStatus = async (orderOrId: string | Order, purchaseStatus: any, justification?: string, budgetFileUrl?: string, completionForecast?: string) => {
    if (!currentUser) return;

    let orderToUpdate: Order | undefined;
    if (typeof orderOrId === 'string') {
      orderToUpdate = orders.find(o => o.id === orderOrId);
    } else {
      orderToUpdate = orderOrId;
    }

    if (!orderToUpdate) {
      console.warn("Order not found for purchase status update:", orderOrId);
      return;
    }

    if (orderToUpdate.blockType === 'compras' && orderToUpdate.status === 'rejected') {
      showToast('Ação Bloqueada: Pedido definitivamente rejeitado e bloqueado.', 'error');
      return;
    }

    // 1. Snapshot
    const prevOrders = orders;

    // 2. Prepare new data
    const newMovement: StatusMovement = {
      statusLabel: `Alteração de Status para ${purchaseStatus}`,
      date: new Date().toISOString(),
      userName: currentUser.name,
      justification: justification || 'Atualização de status do pedido'
    };

    const updatedOrder = {
      ...orderToUpdate,
      purchaseStatus: purchaseStatus as Order['purchaseStatus'],
      budgetFile: budgetFileUrl || orderToUpdate.budgetFileUrl,
      completionForecast: completionForecast || orderToUpdate.completionForecast,
      statusHistory: [...(orderToUpdate.statusHistory || []), newMovement]
    } as Order;

    // Log purchase status update action
    auditLogService.logAction({
      action_type: 'action',
      module: 'compras',
      description: `Alterou status de compra do pedido: "${orderToUpdate.title || 'documento'}" (${orderToUpdate.protocol}) para "${purchaseStatus}"`,
      details: { protocol: orderToUpdate.protocol, title: orderToUpdate.title, newPurchaseStatus: purchaseStatus, type: 'compras', justification }
    });

    // 3. Optimistic Update (IMMEDIATE)
    const updateList = (list: Order[]) => {
      const exists = list.some(o => o.id === updatedOrder.id);
      if (!exists) return [updatedOrder, ...list];
      return list.map(o => o.id === updatedOrder.id ? updatedOrder : o);
    };

    // Set UI state immediately
    setOrders(updateList);

    // Sync React Query Infinite Cache for Immediate UI Consistency
    queryClient.setQueriesData({ queryKey: [...purchaseOrderKeys.lists(), 'infinite'] }, (oldData: any) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page: any) =>
          page.map((order: any) => order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order)
        )
      };
    });

    queryClient.setQueriesData({ queryKey: purchaseOrderKeys.lists() }, (oldData: any) => {
      if (!oldData || !Array.isArray(oldData)) return oldData;
      return oldData.map((order: any) => order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order);
    });

    queryClient.setQueriesData({ queryKey: purchaseOrderKeys.detail(updatedOrder.id) }, (oldData: any) => {
      if (!oldData) return oldData;
      return { ...oldData, ...updatedOrder };
    });

    // Removed blocking overlay for instantaneous feel

    try {
      await comprasService.updatePurchaseStatus(updatedOrder.id, purchaseStatus as string, newMovement, budgetFileUrl, completionForecast);
      showToast("Status de compra atualizado!", "success");

      syncOrders('compras');
    } catch (error: any) {
      console.error("Failed to update purchase status:", error);
      setOrders(prevOrders);
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      showToast("Erro ao atualizar status de compra: " + (error.message || "Unknown"), "error");
    } finally {
      // Overlay removed
    }
  };

  const handleUpdateCompletionForecast = async (orderId: string, date: string) => {
    const updatedOrders = orders.map(o => {
      if (o.id === orderId) {
        if (o.blockType === 'compras' && o.status === 'rejected') {
          showToast('Ação Bloqueada: Pedido definitivamente rejeitado e bloqueado.', 'error');
          return o;
        }
        const updated = { ...o, completionForecast: date };
        if (updated.blockType === 'compras') {
          comprasService.updateCompletionForecast(updated.id, updated.completionForecast);
        }
        // setPurchaseOrders(prev => prev.map(p => p.id === updated.id ? updated : p)); // Derived
        return updated;
      }
      return o;
    });
    setOrders(updatedOrders);
  };

  const handleUpdateOrderAttachments = async (orderId: string, attachments: Attachment[]) => {
    const updatedOrders = orders.map(o => {
      if (o.id === orderId) {
        if (o.blockType === 'compras' && o.status === 'rejected') {
          showToast('Ação Bloqueada: Pedido definitivamente rejeitado e bloqueado.', 'error');
          return o;
        }
        const updated = { ...o, attachments };
        if (updated.blockType === 'compras') {
          comprasService.updateAttachments(updated.id, updated.attachments || []);
          // setPurchaseOrders(prev => prev.map(p => p.id === updated.id ? updated : p)); // Derived
        } else {
          // For now assume others can have attachments or just ignore if not supported by service yet, 
          // but strictly only purchase had explicit attachment field table support in my plan.
          // Actually Oficio has generic support likely in future, but stick to purchase Service for now.
          // If Oficio needs it, I need `saveOficio` to support it. 
          // Plan said: [NEW] Table `purchase_orders` ... `attachments` JSONB. `oficios` did NOT have attachments.
          // So this technically only applies to Compras.
        }
        return updated;
      }
      return o;
    });
    setOrders(updatedOrders);
  };

  const handleRemoveImage = (imageId: string) => {
    setAppState(prev => {
      const newImages = prev.content.images?.filter(img => img.id !== imageId) || [];
      const token = `{{IMG::${imageId}}}`;
      const newBody = prev.content.body.split(token).join('');
      return {
        ...prev,
        content: {
          ...prev.content,
          images: newImages,
          body: newBody
        }
      };
    });
  };

  const handleUpdatePaymentStatus = async (orderOrId: string | Order, status: 'pending' | 'contabilidade' | 'paid') => {
    let orderToUpdate: Order | undefined;
    if (typeof orderOrId === 'string') {
      orderToUpdate = orders.find(o => o.id === orderOrId);
    } else {
      orderToUpdate = orderOrId;
    }
    if (!orderToUpdate) return;

    // 1. Snapshot
    const prevOrders = orders;
    const prevServiceRequests = serviceRequests;

    // 2. Prepare Data
    const updatedOrder = {
      ...orderToUpdate,
      paymentStatus: status,
      paymentDate: status === 'paid' ? new Date().toISOString() : null
    };

    // 3. Optimistic Update
    const updateList = (list: Order[]) => {
      const exists = list.some(o => o.id === updatedOrder.id);
      if (!exists) return [updatedOrder, ...list];
      return list.map(o => o.id === updatedOrder.id ? updatedOrder : o);
    };

    setOrders(updateList);
    setServiceRequests(updateList);

    // Sync React Query
    queryClient.setQueriesData({ queryKey: [...serviceRequestKeys.lists(), 'infinite'] }, (oldData: any) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page: any) =>
          page.map((order: any) => order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order)
        )
      };
    });

    queryClient.setQueriesData({ queryKey: serviceRequestKeys.lists() }, (oldData: any) => {
      if (!oldData || !Array.isArray(oldData)) return oldData;
      return oldData.map((order: any) => order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order);
    });

    queryClient.setQueriesData({ queryKey: serviceRequestKeys.detail(updatedOrder.id) }, (oldData: any) => {
      if (!oldData) return oldData;
      return { ...oldData, ...updatedOrder };
    });

    try {
      // 4. API Sync
      await diariasService.saveServiceRequest(updatedOrder);
      showToast("Pagamento atualizado!", "success");
      syncOrders('diarias');
    } catch (e) {
      // 5. Rollback
      console.error("Failed to update payment status:", e);
      setOrders(prevOrders);
      setServiceRequests(prevServiceRequests);
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
      showToast("Erro ao atualizar pagamento. Revertendo...", "error");
    }
  };

  const handleDownloadPdf = () => {
    setIsDownloading(true);
    const element = document.getElementById('preview-scaler');
    if (!element) return;

    auditLogService.logAction({
      action_type: 'download',
      module: activeBlock || 'geral',
      description: `Download de PDF: "${appState.content.title || 'documento'}"`,
      details: { title: appState.content.title, type: activeBlock }
    });

    const opt = { margin: 0, filename: `${appState.content.title || 'documento'}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0, scrollX: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: 'css' } };
    // @ts-ignore
    window.html2pdf().from(element).set(opt).save().finally(() => setIsDownloading(false));
  };

  const handleDownloadFromHistory = async (order: Order, forcedBlockType?: BlockType, forcedSnapshot?: AppState) => {
    let fullOrder = order;

    // LAZY LOAD DETAILS (Optimized - Check for specific missing content as we now have skeletons)
    const needsFetch = (
      (order.blockType === 'oficio' && !order.documentSnapshot?.content?.body) ||
      (order.blockType === 'compras' && (!order.documentSnapshot?.content?.purchaseItems || order.documentSnapshot.content.purchaseItems.length === 0)) ||
      (order.blockType === 'diarias' && !order.documentSnapshot?.content?.requestedValue) ||
      (order.blockType === 'licitacao' && (!order.documentSnapshot?.content?.licitacaoStages || order.documentSnapshot.content.licitacaoStages.length === 0))
    );

    if (needsFetch) {
      setIsLoadingDetails(true);
      try {
        if (order.blockType === 'oficio') {
          const fetched = await oficiosService.getOficioById(order.id);
          if (fetched) {
            fullOrder = fetched;
            setOficios(prev => prev.map(o => o.id === fullOrder.id ? fullOrder : o));
          }
        } else if (order.blockType === 'compras') {
          const fetched = await comprasService.getPurchaseOrderById(order.id);
          if (fetched) {
            fullOrder = fetched;
            setOrders(prev => prev.map(o => o.id === fullOrder.id ? fullOrder : o));
          }
        } else if (order.blockType === 'diarias') {
          const fetched = await diariasService.getServiceRequestById(order.id);
          if (fetched) {
            fullOrder = fetched;
            setServiceRequests(prev => prev.map(o => o.id === fullOrder.id ? fullOrder : o));
          }
        } else if (order.blockType === 'licitacao') {
          const fetched = await licitacaoService.getLicitacaoProcessById(order.id);
          if (fetched) {
            fullOrder = mapLicitacaoProcessToOrder(fetched);
            setLicitacaoProcesses(prev => prev.map(o => o.id === fullOrder.id ? fetched : o));
          }
        }

        if (!fullOrder.documentSnapshot?.content) {
          alert("Erro ao baixar: Detalhes não encontrados.");
          return;
        }
      } catch (e) {
        console.error("Fetch error session:", e);
        alert("Erro ao baixar: Falha na conexão.");
        return;
      } finally {
        setIsLoadingDetails(false);
      }
    }

    // CRITICAL: If we needed a fetch, we MUST use the fresh snapshot from fullOrder
    // instead of any potentially lightweight snapshot passed as 'forcedSnapshot'
    const snapshot = (needsFetch ? fullOrder.documentSnapshot : forcedSnapshot) || fullOrder.documentSnapshot;
    if (!snapshot) return;

    const enrichedSnapshot = {
      ...snapshot,
      branding: snapshot.branding || appState.branding,
      document: snapshot.document || appState.document,
      ui: snapshot.ui || appState.ui
    };

    setIsDownloading(true);
    setSnapshotToDownload(enrichedSnapshot);
    setBlockTypeToDownload(forcedBlockType || fullOrder.blockType);

    auditLogService.logAction({
      action_type: 'download',
      module: fullOrder.blockType || 'geral',
      description: `Download de PDF do histórico: "${order.title || 'documento'}"`,
      details: { title: order.title, orderId: order.id, type: fullOrder.blockType }
    });
    setTimeout(async () => {
      const element = document.getElementById('background-preview-scaler');
      if (!element) return;
      const opt = { margin: 0, filename: `${order.title || 'documento'}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0, scrollX: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: 'css' } };
      // @ts-ignore
      await window.html2pdf().from(element).set(opt).save();
      setSnapshotToDownload(null);
      setBlockTypeToDownload(null);
      setIsDownloading(false);
    }, 500);
  };

  const handleDownloadLicitacaoStage = async () => {
    const { content } = appState;
    const viewIdx = content.viewingStageIndex ?? (content.currentStageIndex || 0);
    const stagesNames = ['Início', 'Etapa 01', 'Etapa 02', 'Etapa 03', 'Etapa 04', 'Etapa 05', 'Etapa 06'];
    const stageName = stagesNames[viewIdx] || 'Etapa';

    // Create a snapshot that only contains the target stage
    let stageContent = { ...content };

    if (viewIdx < (content.currentStageIndex || 0)) {
      // Viewing a historical stage
      const historicalStage = content.licitacaoStages?.[viewIdx];
      if (historicalStage) {
        stageContent = {
          ...content,
          body: historicalStage.body || '',
          signatureName: historicalStage.signatureName || '',
          signatureRole: historicalStage.signatureRole || '',
          signatureSector: historicalStage.signatureSector || '',
          licitacaoStages: [] // Mask history to show only this one
        };
      }
    } else {
      // Viewing current (in progress) stage
      stageContent = {
        ...content,
        licitacaoStages: [] // Mask history
      };
    }

    const tempSnapshot = {
      ...appState,
      content: stageContent
    };

    setIsDownloading(true);
    setSnapshotToDownload(tempSnapshot);
    setBlockTypeToDownload('licitacao');

    auditLogService.logAction({
      action_type: 'download',
      module: 'licitacao',
      description: `Download do PDF da etapa "${stageName}" do processo: "${content.title || 'licitacao'}"`,
      details: { title: content.title, stageIndex: viewIdx, stageName }
    });

    setTimeout(async () => {
      const element = document.getElementById('background-preview-scaler');
      if (!element) return;
      const opt = { margin: 0, filename: `${content.title || 'licitacao'}_${stageName}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0, scrollX: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: 'css' } };
      // @ts-ignore
      await window.html2pdf().from(element).set(opt).save();
      setSnapshotToDownload(null);
      setBlockTypeToDownload(null);
      setIsDownloading(false);
    }, 500);
  };

  const handleOpenAdmin = (tab?: string | null) => {
    setCurrentView('admin');
    const targetTab = tab || null;
    setAdminTab(targetTab);
    setIsAdminSidebarOpen(targetTab !== null && targetTab !== 'dashboard');
    setIsFinalizedView(false);
  };

  const handleLogout = async () => {
    if (currentUser) {
      await auditLogService.logAction({
        action_type: 'logout',
        module: 'auth',
        description: `Logout efetuado com sucesso pelo usuário ${currentUser.name}`
      });
    }
    auditLogService.clearCache();
    await signOut();
    clearDraft(); // Clear draft on logout
    try {
      sessionStorage.removeItem('cachedPersons');
      sessionStorage.removeItem('cachedVehicles');
      sessionStorage.removeItem('cachedGasStations');
      sessionStorage.removeItem('cachedFuelTypes');
    } catch (e) { }
    setCurrentView('login');
    setActiveBlock(null);
    setIsFinalizedView(false);
    setEditingOrder(null);
  };

  const handleViewOrder = async (order: Order) => {
    let fullOrder = order;

    // LAZY LOAD DETAILS (Optimized - Check for specific missing content as we now have skeletons)
    const needsFetch = (
      (order.blockType === 'oficio' && !order.documentSnapshot?.content?.body) ||
      (order.blockType === 'compras' && (!order.documentSnapshot?.content?.purchaseItems || order.documentSnapshot.content.purchaseItems.length === 0)) ||
      (order.blockType === 'diarias' && !order.documentSnapshot?.content?.requestedValue) ||
      (order.blockType === 'licitacao' && (order.documentSnapshot?.content as any)?.itens === undefined)
    );

    if (needsFetch) {
      setIsLoadingDetails(true);
      try {
        if (order.blockType === 'oficio') {
          const fetched = await oficiosService.getOficioById(order.id);
          if (fetched) {
            fullOrder = fetched;
            setOficios(prev => prev.map(o => o.id === fullOrder.id ? fullOrder : o));
          }
        } else if (order.blockType === 'compras') {
          const fetched = await comprasService.getPurchaseOrderById(order.id);
          if (fetched) {
            fullOrder = fetched;
            setOrders(prev => prev.map(o => o.id === fullOrder.id ? fullOrder : o));
          }
        } else if (order.blockType === 'diarias') {
          const fetched = await diariasService.getServiceRequestById(order.id);
          if (fetched) {
            fullOrder = fetched;
            setServiceRequests(prev => prev.map(o => o.id === fullOrder.id ? fullOrder : o));
          }
        } else if (order.blockType === 'licitacao') {
          const fetched = await licitacaoService.getLicitacaoProcessById(order.id);
          if (fetched) {
            // Update React Query list query cache so that the item is stored with details
            queryClient.setQueryData(licitacaoKeys.lists(), (oldData: any[] | undefined) => {
              if (!oldData) return [fetched];
              return oldData.map(o => o.id === fetched.id ? fetched : o);
            });
            // Update local state if needed
            setLicitacaoProcesses(prev => prev.map(o => o.id === fetched.id ? fetched : o));
            // Map the fetched process to Order
            fullOrder = mapLicitacaoProcessToOrder(fetched);
          }
        }
      } catch (err) {
        console.error("Error fetching details for view:", err);
        showToast("Erro ao carregar detalhes.", "error");
        return;
      } finally {
        setIsLoadingDetails(false);
      }
    }

    setViewingOrder(fullOrder);
    if (order.blockType === 'licitacao') {
      setCurrentView('licitacao:view');
    } else {
      setCurrentView('order-details');
    }
  };

  const handleFetchOrderDetails = async (order: Order): Promise<Order | null> => {
    try {
      if (order.blockType === 'compras') {
        const fetched = await comprasService.getPurchaseOrderById(order.id);
        if (fetched) {
          setOrders(prev => prev.map(o => o.id === fetched.id ? fetched : o));
          return fetched;
        }
      } else if (order.blockType === 'oficio') {
        const fetched = await oficiosService.getOficioById(order.id);
        if (fetched) {
          setOficios(prev => prev.map(o => o.id === fetched.id ? fetched : o));
          return fetched;
        }
      } else if (order.blockType === 'diarias') {
        const fetched = await diariasService.getServiceRequestById(order.id);
        if (fetched) {
          setServiceRequests(prev => prev.map(o => o.id === fetched.id ? fetched : o));
          return fetched;
        }
      } else if (order.blockType === 'licitacao') {
        const fetched = await licitacaoService.getLicitacaoProcessById(order.id);
        if (fetched) {
          queryClient.setQueryData(licitacaoKeys.lists(), (oldData: any[] | undefined) => {
            if (!oldData) return [fetched];
            return oldData.map(o => o.id === fetched.id ? fetched : o);
          });
          setLicitacaoProcesses(prev => prev.map(o => o.id === fetched.id ? fetched : o));
          return mapLicitacaoProcessToOrder(fetched);
        }
      }
      return null;
    } catch (err) {
      console.error("Error in handleFetchOrderDetails:", err);
      return null;
    }
  };

  const handleBackToTracking = () => {
    const block = viewingOrder?.blockType || activeBlock || 'compras';
    setViewingOrder(null);
    setCurrentView('tracking');
    setActiveBlock(block);
  };

  const handleGoHome = () => {
    if (currentView === 'editor' && !isFinalizedView) clearDraft(); // Clear draft if cancelling editor
    setCurrentView('home');
    setActiveBlock(null);
    setIsAdminSidebarOpen(false);
    setAdminTab(null);
    setIsFinalizedView(false);
    setEditingOrder(null);
  };

  const handleBackToModule = () => {
    // Only clear if we were in editor? handleBackToModule is usually for TrackingScreen/PurchaseManagement back button.
    // TrackingScreen is distinct from Editor. So no need to clear draft here usually.
    // But if we use it for generic back?
    // Let's assume it's for non-editor views.
    setCurrentView('home');
    // activeBlock is preserved
    setIsAdminSidebarOpen(false);
    setAdminTab(null);
    setIsFinalizedView(false);
    setEditingOrder(null);
  };




  // --- REALTIME SYNC FOR VEHICLE SCHEDULES ---
  useEffect(() => {
    // Only subscribe if user is logged in
    if (!currentUser) return;

    const channel = supabase
      .channel('vehicle_schedules_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle_schedules' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newSchedule = payload.new as VehicleSchedule;
            // Prevent duplicated insertion if we already added it via optimistic/local update
            setSchedules((prev) => {
              if (prev.some(s => s.id === newSchedule.id)) return prev;
              return [newSchedule, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedSchedule = payload.new as VehicleSchedule;
            setSchedules((prev) => prev.map((s) => (s.id === updatedSchedule.id ? updatedSchedule : s)));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            setSchedules((prev) => prev.filter((s) => s.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // --- PERSISTENCE LOGIC START ---
  // Save draft to localStorage whenever content changes in editor mode
  useEffect(() => {
    if (currentView === 'editor' && !editingOrder && activeBlock && !isFinalizedView) {
      const draftKey = `draft_${activeBlock}`;
      const draftData = {
        content: appState.content,
        timestamp: Date.now()
      };
      // Debounce saving if needed, but for now simple write is okay for text
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    }
  }, [appState.content, currentView, editingOrder, activeBlock, isFinalizedView]);

  // AUTO-SAVE FOR LICITACAO (DISABLED BY REQUEST)
  /*
  useEffect(() => {
    if (activeBlock === 'licitacao' && currentView === 'editor' && editingOrder) {
      const timer = setTimeout(() => {
        const orderToSave: Order = {
          ...editingOrder,
          title: appState.content.title,
          documentSnapshot: appState
        };
        licitacaoService.saveLicitacaoProcess(orderToSave).then(() => {
          console.log("Auto-saved licitacao process");
        }).catch(err => console.error("Auto-save failed", err));
      }, 2000); // 2 seconds debounce
   
      return () => clearTimeout(timer);
    }
  }, [appState, activeBlock, currentView, editingOrder]);
  */


  // Clear draft on successful finish or explicit exit
  const clearDraft = useCallback(() => {
    if (activeBlock) {
      localStorage.removeItem(`draft_${activeBlock}`);
    }
  }, [activeBlock]);
  // --- PERSISTENCE LOGIC END ---




  // MODIFIED handleStartEditing to check for drafts and optionally force a clean reset
  const handleStartEditing = async (blockOverride?: BlockType, forceReset: boolean = false) => {
    const currentBlock = blockOverride || activeBlock;
    let defaultTitle = INITIAL_STATE.content.title;
    let defaultRightBlock = INITIAL_STATE.content.rightBlockText;
    let leftBlockContent = INITIAL_STATE.content.leftBlockText;
    const currentYear = new Date().getFullYear();

    // FORCE RESET LOGIC
    if (forceReset && currentBlock) {
      const draftKey = `draft_${currentBlock}`;
      localStorage.removeItem(draftKey); // Wipe any stored draft data
      console.log(`[App.tsx] Forcing explicit state reset for new ${currentBlock} order. Wiped draft.`);
    }

    // CHECK FOR DRAFT FIRST (Skip for Licitacao to always start fresh/auto-create)
    if (currentBlock && currentBlock !== 'licitacao' && !forceReset) {
      const draftKey = `draft_${currentBlock}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          // Optional: Check timestamp expiry? For now keep it indefinitely until finished/cleared
          if (parsed && parsed.content) {
            setAppState(prev => {
              const mergedContent = {
                ...INITIAL_STATE.content,
                ...parsed.content
              };

              // Validate title for the current block to prevent leaks from drafts
              if (currentBlock === 'oficio' && (mergedContent.title?.includes('Diária') || mergedContent.title?.includes('Pedido'))) {
                mergedContent.title = 'Novo Ofício';
              } else if (currentBlock === 'compras' && (mergedContent.title?.includes('Ofício') || mergedContent.title?.includes('Diária'))) {
                mergedContent.title = 'Novo Pedido';
              } else if (currentBlock === 'diarias' && (mergedContent.title?.includes('Ofício') || mergedContent.title?.includes('Pedido'))) {
                mergedContent.title = 'Requisição de Diária';
              }


              return {
                ...prev,
                content: mergedContent
              };
            });

            // Explicitly set activeBlock to currentBlock to prevent race conditions
            if (activeBlock !== currentBlock) {
              setActiveBlock(currentBlock);
            }

            setCurrentView('editor');
            setAdminTab('content');
            setIsAdminSidebarOpen(true);
            setIsFinalizedView(false);
            setEditingOrder(null);
            return; // EXIT EARLY IF DRAFT RESTORED
          }
        } catch (e) {
          console.error("Error parsing draft", e);
        }
      }
    }

    if (currentBlock === 'compras') {
      defaultTitle = 'Novo Pedido';
      defaultRightBlock = 'Ao Departamento de Compras da\nPrefeitura de São José do Goiabal-MG';
    } else if (currentBlock === 'licitacao') {
      defaultTitle = 'PROCESSO LICITATÓRIO';
      defaultRightBlock = 'Ao Departamento de Licitação\nPrefeitura de São José do Goiabal - MG';
    } else if (currentBlock === 'diarias') {
      defaultTitle = 'Requisição de Diária';
    } else if (currentBlock === 'oficio') {
      defaultTitle = 'Novo Ofício';
    } else {
      // Fallback
      defaultTitle = INITIAL_STATE.content.title;
    }

    // Logic for Sector numbering (Unified for ALL blocks)
    // Always attempt to get a number if user has a sector
    if (currentUser?.sector) {
      const userSector = sectors.find(s => s.name === currentUser.sector);
      if (userSector) {
        const nextNum = await counterService.getNextSectorCount(userSector.id, currentYear);
        if (nextNum) {
          const formattedNum = nextNum.toString().padStart(3, '0');

          if (currentBlock === 'compras') {
            defaultTitle = 'Novo Pedido';
            // DELAYED GENERATION: Set placeholder
            leftBlockContent = INITIAL_STATE.content.leftBlockText; // 'Carregando...\nAssunto: ...'
          } else if (currentBlock === 'diarias') {
            // Diarias handle their own numbering via global protocol count on subtype selection
            defaultTitle = 'Requisição de Diária';
            leftBlockContent = INITIAL_STATE.content.leftBlockText;
          } else if (currentBlock === 'licitacao') {
            // Assuming Licitacao also follows this pattern or has a specific title format using the number
            defaultTitle = `PROCESSO LICITATÓRIO`;
            leftBlockContent = `Ref: Processo nº ${formattedNum}/${currentYear}`;
          } else {
            // Default Oficio and fallback for others
            defaultTitle = `Novo Ofício`;
            // Replace placeholder with actual number immediately
            const defaultLeftBlock = INITIAL_STATE.content.leftBlockText;
            if (defaultLeftBlock.includes("Carregando...")) {
              leftBlockContent = defaultLeftBlock.replace("Carregando...", `Ofício nº ${formattedNum}/${currentYear}`);
            } else {
              leftBlockContent = `Ofício nº ${formattedNum}/${currentYear}\n${defaultLeftBlock}`;
            }
          }
        }
      }
    }

    let defaultBody = INITIAL_STATE.content.body;
    if (currentBlock !== 'oficio') {
      defaultBody = '';
    }

    // Consolidate state update to prevent multiple renders and UI/Branding loss
    console.log("handleStartEditing: Resetting App State to FRESH content.");
    setAppState(prev => {
      // Deep clone to ensure no reference pollution from previous edits
      const freshContent = JSON.parse(JSON.stringify(INITIAL_STATE.content));

      const newContent = {
        ...freshContent,
        title: defaultTitle,
        rightBlockText: defaultRightBlock,
        leftBlockText: leftBlockContent,
        body: defaultBody,
      };


      // Special handling for Licitação defaults
      if (currentBlock === 'licitacao') {
        newContent.protocol = ''; // Empty to trigger Auto-Suggestion
        newContent.currentStageIndex = 0;
        newContent.licitacaoStages = [];
      }

      return {
        ...prev,
        content: newContent,
        document: {
          ...prev.document,
          showSignature: INITIAL_STATE.document.showSignature
        }
      };
    });

    if (currentBlock === 'licitacao') {
      setEditingOrder(null);
    } else {
      setEditingOrder(null);
    }

    // Explicitly set activeBlock to currentBlock to prevent race conditions with component effects
    if (activeBlock !== currentBlock) {
      setActiveBlock(currentBlock);
    }

    setCurrentView('editor');
    setAdminTab('content');
    setIsAdminSidebarOpen(true);
    setIsFinalizedView(false);
  };

  const handleStartDiariaFromEvent = (diariaContent: any) => {
    setAppState(prev => ({
      ...prev,
      content: {
        ...INITIAL_STATE.content,
        title: 'Novo Processo de Diária',
        requesterName: diariaContent.requesterName,
        destination: diariaContent.destination,
        departureDateTime: diariaContent.departureDateTime,
        returnDateTime: diariaContent.returnDateTime,
        reason: diariaContent.reason,
        requestedValue: diariaContent.requestedValue,
        relatorioViagem: diariaContent.relatorioViagem,
        attachments: diariaContent.attachments || []
      }
    }));
    setActiveBlock('diarias');
    setEditingOrder(null);
    setIsFinalizedView(false);
    setCurrentView('editor');
    setAdminTab('content');
    setIsAdminSidebarOpen(true);
  };

  // Effect to initialize editor if accessed directly via URL
  useEffect(() => {
    // Only trigger if we are in editor view, don't have an editing order,
    // AND the current state either belongs to another block or doesn't have a protocol yet.
    // However, handleStartEditing already does a lot of this.
    // To fix the "stuck status" issue, we check if we're entering a "new" state.
    if (currentView === 'editor' && !editingOrder && currentUser && sectors.length > 0) {
      const draftKey = `draft_${activeBlock}`;
      const hasDraft = localStorage.getItem(draftKey);

      // CRITICAL: Only auto-start if there is NO protocol AND NO editing order in progress
      if (!appState.content.protocol && !hasDraft && activeBlock && !editingOrder) {
        handleStartEditing(activeBlock);
      }
    }
  }, [currentView, activeBlock, currentUser, sectors.length, editingOrder]);

  // Ensure viewingStageIndex is synced when entering Licitação or changing stages
  useEffect(() => {
    if (activeBlock === 'licitacao' && appState.content.currentStageIndex !== undefined) {
      // Only if viewingStageIndex is undefined, set it to current
      if (appState.content.viewingStageIndex === undefined) {
        setAppState(prev => ({
          ...prev,
          content: { ...prev.content, viewingStageIndex: prev.content.currentStageIndex }
        }));
      }
    }
  }, [activeBlock, appState.content.currentStageIndex]);






  const handleTrackOrder = () => {
    // Determine which orders to show based on activeBlock
    if (activeBlock === 'compras') {
      setOrders(purchaseOrders);
    } else if (activeBlock === 'diarias') {
      setOrders(serviceRequests);
    } else {
      setOrders(oficios);
    }
    setCurrentView('tracking');
  };

  const handleViewAllLicitacao = () => {
    setOrders(licitacaoProcesses);
    setActiveBlock('licitacao');
    setCurrentView('licitacao-all');
  };

  // Helper for self-updates or other minor updates
  const handleUpdateUserInApp = async (u: User) => {
    // PREVENT DB ERROR: Do not try to update mock users (non-UUID ids) in Supabase
    // Real Supabase IDs are UUIDs (36 chars). Mock IDs are 'user_guilherme', etc.
    const isMockUser = u.id.length < 30 || u.id.startsWith('user_');

    if (isMockUser) {
      console.warn("Skipping DB update for mock user:", u.id);
      setUsers(p => p.map(us => us.id === u.id ? u : us));
      return;
    }

    const { error } = await supabase.from('profiles').update({
      name: u.name,
      username: u.username,
      role: u.role,
      sector: u.sector,
      job_title: u.jobTitle,
      email: u.email,
      whatsapp: u.whatsapp,
      allowed_signature_ids: u.allowedSignatureIds,
      permissions: u.permissions,
      temp_password: u.tempPassword,
      temp_password_expires_at: u.tempPasswordExpiresAt,
      must_change_password: u.mustChangePassword,
      two_factor_enabled: u.twoFactorEnabled,
      two_factor_secret: u.twoFactorSecret,
      two_factor_enabled_2: u.twoFactorEnabled2,
      two_factor_secret_2: u.twoFactorSecret2,
      status: u.status,
      avatar: u.avatar,
      sector_id: u.sectorId,
      job_id: u.jobId
    }).eq('id', u.id);

    if (u.password) {
      const { error: rpcError } = await supabase.rpc('update_user_password', { user_id: u.id, new_password: u.password });
      if (rpcError) {
        console.error("Error updating password via RPC:", rpcError);
        alert("Erro ao atualizar senha no sistema de autenticação: " + rpcError.message);
        return; // Stop execution if auth update fails
      }
    }

    if (error) {
      console.error("Error updating user profile:", error);
      alert("Erro ao atualizar perfil: " + error.message);
    } else {
      setUsers(p => p.map(us => us.id === u.id ? u : us));
      if (currentUser && currentUser.id === u.id) {
        await refreshUser();
      }
      if (u.status === 'blocked' && currentUser && currentUser.id !== u.id) {
        await supabase.channel('global_events').send({
          type: 'broadcast',
          event: 'user-blocked',
          payload: { userId: u.id }
        });
      }
    }
  };

  // Splash Screen while verifying auth - prevents flicker and early redirects
  // CRITICAL: Must be after all hooks to avoid hook order violations
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center">
        <GlobalLoading
          type="overlay"
          message="Verificando Acesso"
          description="Preparando sua área de trabalho municipal segura..."
        />
      </div>
    );
  }

  if (currentView === 'login') return <LoginScreen onLogin={handleLogin} uiConfig={appState.ui} onLoginSuccess={() => { setIsLoginTransitioning(false); setCurrentView('home'); }} />;

  if (currentUser && (currentUser.tempPassword || currentUser.mustChangePassword)) {
    return (
      <ForcePasswordChangeModal
        currentUser={currentUser}
        onSuccess={async () => {
          await refreshUser();
          // Optional: Show success toast
          setToast({ isVisible: true, message: "Senha alterada com sucesso!", type: 'success' });
        }}
        onLogout={handleLogout}
      />
    );
  }

  const hasInvalidAvatar = !currentUser?.avatar || 
                           currentUser.avatar.trim() === '' || 
                           currentUser.avatar.toLowerCase() === 'sem avatar' ||
                           currentUser.avatar.toLowerCase() === 'sem_avatar';

  if (currentUser && hasInvalidAvatar) {
    return (
      <AvatarSelectionModal currentUser={currentUser} />
    );
  }


  return (
    <NotificationProvider>
      <ChatProvider>
        <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans flex-col">
          <FloatingNotification />
          <ToastNotification
            message={toast.message}
            type={toast.type}
            isVisible={toast.isVisible}
            onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
          />

          {/* Chat Components - Only for authenticated users and not on 'Consultas', 'Farmacia' or Admin Logs pages */}
          {currentUser && currentView !== 'consultas' && currentView !== 'farmacia' && !(currentView === 'admin' && adminTab === 'logs') && (
            <>
              <ChatWidget />
              <ChatWindow />
              <ChatNotificationPopup />
            </>
          )}

          <div className="hidden md:block">
            {currentUser && <AppHeader
              currentUser={currentUser}
              uiConfig={appState.ui}
              activeBlock={activeBlock}
              onLogout={handleLogout}
              onOpenAdmin={handleOpenAdmin}
              onGoHome={handleGoHome}
              currentView={currentView}
              isRefreshing={isRefreshing}
              onRefresh={refreshData}
              currentSubView={appState.view}
              systemUpdateCountdown={systemUpdateCountdown}
            />}
          </div>
          <div className="flex-1 flex relative overflow-hidden">

            {(currentView === 'editor' || currentView === 'admin') && currentUser && (
              <div className="flex-1 flex flex-col overflow-hidden h-full relative">
                {/* Removed GLOBAL STEPPER FOR LICITACAO as it is now integrated in LicitacaoStepWizard */}

                <div className="flex-1 flex overflow-hidden h-full relative">
                  {(() => {
                    const shouldRenderSidebar = !isFinalizedView && (
                      currentView === 'editor' || 
                      (currentView === 'admin' && (adminTab === 'design' || adminTab === 'ui'))
                    );

                    return shouldRenderSidebar && (
                      <AdminSidebar
                        state={appState}
                        onUpdate={setAppState}
                        onPrint={() => window.print()}
                        isOpen={isAdminSidebarOpen}
                        onClose={() => { if (currentView === 'editor') { setIsFinalizedView(true); setIsAdminSidebarOpen(false); } else { setIsAdminSidebarOpen(false); } }}
                        isDownloading={isDownloading}
                        currentUser={currentUser}
                        mode={currentView === 'admin' ? 'admin' : 'editor'}
                        onSaveDefault={handleSaveGlobalSettings}
                        onFinish={handleFinish} activeTab={adminTab} onTabChange={setAdminTab} availableSignatures={myAvailableSignatures} activeBlock={activeBlock} persons={persons} sectors={sectors} jobs={jobs}
                        onBack={() => { if (currentView === 'editor') setCurrentView('home'); }}
                        isReadOnly={activeBlock === 'licitacao' ? (editingOrder?.status === 'completed' || editingOrder?.status === 'approved') : (editingOrder?.status === 'approved' || editingOrder?.status === 'completed')}
                        orderStatus={editingOrder?.status}
                      />
                    );
                  })()}
                  <main className="flex-1 h-full overflow-hidden flex flex-col relative bg-slate-50">
                    {currentView === 'admin' && (adminTab === null || adminTab === 'dashboard') ? (
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                        <AdminDashboard
                          currentUser={currentUser}
                          onTabChange={(tab) => setAdminTab(tab)}
                          onBack={handleGoHome}
                        />
                      </div>
                    ) : currentView === 'admin' && adminTab === 'system_update' ? (
                      <SystemUpdateScreen onBack={() => setAdminTab(null)} />
                    ) : currentView === 'admin' && adminTab === 'users' ? (
                      <UserManagementScreen
                        users={users}
                        currentUser={currentUser}
                        onAddUser={async (u) => {
                          // Prepare user data for Supabase
                          const email = u.username.includes('@') ? u.username : `${u.username}@projeto.local`;
                          const userData = {
                            ...u,
                            jobTitle: u.jobTitle,
                            allowedSignatureIds: u.allowedSignatureIds,
                            twoFactorEnabled: false,
                            tempPassword: u.password,
                            tempPasswordExpiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours validity
                          };

                          const { data: newId, error } = await supabase.rpc('create_user_admin', {
                            email: email,
                            password: u.password || '12345678', // Default if missing, though UI enforces it
                            user_data: userData
                          });

                          if (error) {
                            console.error("Error creating user:", error);
                            if (error.code === '23505' || error.message?.includes('duplicate')) {
                              alert("Este nome de usuário ou e-mail já existe no sistema. Se o usuário foi excluído recentemente, entre em contato com o suporte ou tente um nome diferente.");
                            } else {
                              alert("Erro ao criar usuário: " + error.message);
                            }
                          } else {
                            // Refresh users
                            const { data: refreshed } = await supabase.from('profiles').select('*');
                            if (refreshed) {
                              const mapped = refreshed.map((ru: any) => ({
                                id: ru.id,
                                username: ru.username,
                                name: ru.name,
                                role: ru.role,
                                sector: ru.sector,
                                sectorId: ru.sector_id,
                                jobTitle: ru.job_title,
                                jobId: ru.job_id,
                                email: ru.email,
                                whatsapp: ru.whatsapp,
                                allowedSignatureIds: ru.allowed_signature_ids,
                                permissions: ru.permissions,
                                tempPassword: ru.temp_password,
                                tempPasswordExpiresAt: ru.temp_password_expires_at,
                                twoFactorEnabled: ru.two_factor_enabled,
                                twoFactorSecret: ru.two_factor_secret,
                                status: ru.status,
                                avatar: ru.avatar
                              }));
                              setUsers(mapped);
                            }
                          }
                        }}
                        onUpdateUser={handleUpdateUserInApp}
                        onDeleteUser={async (id) => {
                          const { error } = await supabase.rpc('delete_user_admin', { user_id: id });
                          if (error) {
                            console.error("Error deleting user:", error);
                            alert("Erro ao deletar: " + error.message);
                          } else {
                            setUsers(p => p.filter(u => u.id !== id));
                          }
                        }}
                        availableSignatures={allSignatures}
                        jobs={jobs}
                        sectors={sectors}
                        persons={persons}
                        onBack={() => setAdminTab(null)}
                      />
                    ) : currentView === 'admin' && adminTab === '2fa' ? (
                      <TwoFactorAuthScreen
                        currentUser={currentUser}
                        onUpdateUser={(u) => {
                          handleUpdateUserInApp(u);
                          // Also update local current user state if needed
                        }}
                        onBack={() => setAdminTab(null)}
                      />
                    ) : currentView === 'admin' && adminTab === 'entities' ? (
                      <EntityManagementScreen
                        persons={persons}
                        sectors={sectors}
                        jobs={jobs}
                        onAddPerson={async p => {
                          const newPerson = await entityService.createPerson(p);
                          if (newPerson) setPersons(prev => [...prev, newPerson]);
                          else alert('Erro ao criar pessoa');
                        }}
                        onUpdatePerson={async p => {
                          const updated = await entityService.updatePerson(p);
                          if (updated) {
                            setPersons(prev => prev.map(x => x.id === p.id ? updated : x));
                            const matchedUser = users.find(u => u.name.trim().toLowerCase() === updated.name.trim().toLowerCase());
                            if (matchedUser) {
                              const jobName = jobs.find(j => j.id === updated.jobId)?.name || '';
                              const sectorName = sectors.find(s => s.id === updated.sectorId)?.name || '';
                              const updatedUser: User = {
                                ...matchedUser,
                                sector: sectorName,
                                sectorId: updated.sectorId,
                                jobTitle: jobName,
                                jobId: updated.jobId
                              };
                              await handleUpdateUserInApp(updatedUser);
                            }
                          } else {
                            alert('Erro ao atualizar pessoa');
                          }
                        }}
                        onDeletePerson={async id => {
                          const success = await entityService.deletePerson(id);
                          if (success) setPersons(prev => prev.filter(x => x.id !== id));
                          else alert('Erro ao deletar pessoa');
                        }}
                        onAddSector={async s => {
                          const newSector = await entityService.createSector(s);
                          if (newSector) setSectors(prev => [...prev, newSector]);
                          else alert('Erro ao criar setor');
                        }}
                        onUpdateSector={async s => {
                          const updated = await entityService.updateSector(s);
                          if (updated) setSectors(prev => prev.map(x => x.id === s.id ? updated : x));
                          else alert('Erro ao atualizar setor');
                        }}
                        onDeleteSector={async id => {
                          const success = await entityService.deleteSector(id);
                          if (success) setSectors(prev => prev.filter(x => x.id !== id));
                          else alert('Erro ao deletar setor');
                        }}
                        onAddJob={async j => {
                          const newJob = await entityService.createJob(j);
                          if (newJob) setJobs(prev => [...prev, newJob]);
                          else alert('Erro ao criar cargo');
                        }}
                        onUpdateJob={async j => {
                          const updated = await entityService.updateJob(j);
                          if (updated) setJobs(prev => prev.map(x => x.id === j.id ? updated : x));
                          else alert('Erro ao atualizar cargo');
                        }}
                        onDeleteJob={async id => {
                          const success = await entityService.deleteJob(id);
                          if (success) setJobs(prev => prev.filter(x => x.id !== id));
                          else alert('Erro ao deletar cargo');
                        }}
                        onBack={() => setAdminTab(null)}
                      />

                    ) : currentView === 'admin' && adminTab === 'fleet' ? (
                      <FleetManagementScreen
                        vehicles={vehicles}
                        sectors={sectors}
                        persons={persons}
                        jobs={jobs}
                        brands={brands}
                        onAddVehicle={async v => {
                          const newV = await entityService.createVehicle(v);
                          if (newV) {
                            const updatedList = await entityService.getVehicles();
                            setVehicles(updatedList);
                          }
                          else alert("Erro ao criar veículo");
                        }}
                        onUpdateVehicle={async v => {
                          const updated = await entityService.updateVehicle(v);
                          if (updated) {
                            const updatedList = await entityService.getVehicles();
                            setVehicles(updatedList);
                          }
                          else alert("Erro ao atualizar veículo");
                        }}
                        onDeleteVehicle={async id => {
                          const success = await entityService.deleteVehicle(id);
                          if (success) {
                            const updatedList = await entityService.getVehicles();
                            setVehicles(updatedList);
                          }
                          else alert("Erro ao deletar veículo");
                        }}
                        onAddBrand={async b => {
                          const newB = await entityService.createBrand(b);
                          if (newB) setBrands(p => [...p, newB]);
                          else alert("Erro ao criar marca");
                        }}
                        onBack={handleGoHome}
                      />
                    ) : currentView === 'admin' && adminTab === 'ui' ? (
                      <UIPreviewScreen ui={appState.ui} />
                    ) : currentView === 'admin' && adminTab === 'design' ? (
                      <AdminDocumentPreview state={appState} />
                    ) : currentView === 'admin' && adminTab === 'access_control' ? (
                      <SystemAccessControl onBack={() => setAdminTab(null)} />
                    ) : currentView === 'admin' && adminTab === 'remote_access' ? (
                      <RemoteAccessScreen currentUser={currentUser!} onBack={() => setAdminTab(null)} onTabChange={(tab) => setAdminTab(tab)} />
                    ) : currentView === 'admin' && adminTab === 'logs' ? (
                      <SystemLogs onBack={() => setAdminTab(null)} />
                    ) : (
                      <div className={(activeBlock === 'compras' || activeBlock === 'diarias') && currentView === 'editor' ? 'fixed left-[-9999px] top-0 pointer-events-none opacity-0' : 'w-full h-full'}>
                        <DocumentPreview ref={componentRef} state={appState} isGenerating={isDownloading} mode={currentView === 'admin' ? 'admin' : 'editor'} blockType={activeBlock} onRemoveImage={handleRemoveImage} />
                      </div>
                    )}

                    {/* COMPACT FLOATING STAGE DOWNLOAD BUTTON FOR LICITACAO */}
                    {activeBlock === 'licitacao' && currentView === 'editor' && !isFinalizedView && (() => {
                      const viewIdx = appState.content.viewingStageIndex ?? (appState.content.currentStageIndex || 0);
                      const isHistory = viewIdx < (appState.content.currentStageIndex || 0);
                      const hasHistoricData = isHistory && appState.content.licitacaoStages?.[viewIdx];
                      const hasActiveData = !isHistory && appState.content.body && appState.content.body.replace(/<[^>]*>?/gm, '').trim() !== '';

                      // Only show if there is actually content to download
                      if (!hasHistoricData && !hasActiveData) return null;

                      return (
                        <div className="absolute top-24 right-8 z-[70] flex flex-col items-end gap-2 pointer-events-none group">
                          <button
                            onClick={handleDownloadLicitacaoStage}
                            title={`Baixar PDF: ${['Início', 'Etapa 01', 'Etapa 02', 'Etapa 03', 'Etapa 04', 'Etapa 05', 'Etapa 06'][viewIdx]}`}
                            className="group pointer-events-auto flex items-center gap-3 bg-white/40 hover:bg-white backdrop-blur-xl p-2 pr-4 rounded-full shadow-lg border border-white/50 transition-all duration-300 hover:shadow-indigo-500/20 hover:-translate-y-1 active:scale-95"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-md group-hover:rotate-12 transition-transform">
                              <Download className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex flex-col items-start leading-none gap-0.5">
                              <span className="text-slate-900 font-extrabold text-[10px] uppercase tracking-tighter">Baixar Etapa</span>
                              <span className="text-blue-600 text-[9px] font-black uppercase tracking-widest opacity-80">
                                {['Início', 'Etapa 01', 'Etapa 02', 'Etapa 03', 'Etapa 04', 'Etapa 05', 'Etapa 06'][viewIdx]}
                              </span>
                            </div>
                          </button>
                          <div className="bg-slate-900/10 backdrop-blur-sm text-slate-500 text-[8px] uppercase tracking-[0.2em] font-black px-3 py-1 rounded-full border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none select-none">
                            Ação Rápida
                          </div>
                        </div>
                      );
                    })()}
                    {/* Botão para Abrir Formulário no Painel Admin (Design) */}
                    {!isFinalizedView && !isAdminSidebarOpen && currentView === 'admin' && adminTab === 'design' && (
                      <button
                        onClick={() => setIsAdminSidebarOpen(true)}
                        className="fixed left-0 top-[20%] z-[110] bg-white border border-slate-200 border-l-0 rounded-r-2xl shadow-[10px_0_30px_rgba(0,0,0,0.05)] p-4 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all active:scale-95 group animate-fade-in"
                        title="Abrir Formulário"
                      >
                        <ChevronRight className="w-7 h-7 group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}

                    {isFinalizedView && (
                      <>
                        {/* Botão para Abrir Formulário (Seta no Lado do Formulário) */}
                        {activeBlock !== 'compras' && (
                          <button
                            onClick={() => {
                              setIsFinalizedView(false);
                              setIsAdminSidebarOpen(true);
                            }}
                            className="fixed left-0 top-[20%] z-[110] bg-white border border-slate-200 border-l-0 rounded-r-2xl shadow-[10px_0_30px_rgba(0,0,0,0.05)] p-4 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all active:scale-95 group animate-fade-in"
                            title="Abrir Formulário"
                          >
                            <ChevronRight className="w-7 h-7 group-hover:translate-x-1 transition-transform" />
                          </button>
                        )}

                        <FinalizedActionBar
                          onDownload={handleDownloadPdf}
                          onBack={() => {
                            if (activeBlock === 'compras' && editingOrder?.status !== 'pending') {
                              handleTrackOrder();
                            } else {
                              handleGoHome();
                            }
                          }}
                          onEdit={() => { setIsFinalizedView(false); setIsAdminSidebarOpen(true); }}
                          onSend={handleSendOrder}
                          isDownloading={isDownloading}
                          documentTitle={appState.content.title}
                          onToggleDigitalSignature={() => {
                            setAppState(prev => ({
                              ...prev,
                              content: {
                                ...prev.content,
                                digitalSignature: {
                                  ...prev.content.digitalSignature!,
                                  enabled: !prev.content.digitalSignature?.enabled
                                }
                              }
                            }));
                          }}
                          isDigitalSignatureVisible={!!appState.content.digitalSignature?.enabled}
                          hasDigitalSignature={!!appState.content.digitalSignature}
                          viewOnly={activeBlock === 'compras' && editingOrder?.status !== 'pending'}
                        />
                      </>
                    )}
                  </main>
                </div>
              </div>
            )}
            {currentView === 'home' && (() => {
              const allSystemOrders = Array.from(new Map([
                ...orders.map(o => [o.id, o] as [string, Order]),
                ...oficios.map(o => [o.id, o] as [string, Order]),
                ...serviceRequests.map(o => [o.id, o] as [string, Order]),
                ...tasks.map(o => [o.id, o] as [string, Order]),
                ...mappedLicitacaoOrders.map(o => [o.id, o] as [string, Order])
              ]).values());

              return (
              <HomeScreen
                onNewOrder={(block, isForceReset) => {
                  const target = block || 'oficio';
                  if (target === 'abastecimento') {
                    setActiveBlock('abastecimento');
                    setCurrentView('abastecimento');
                  } else {
                    handleStartEditing(target, isForceReset);
                  }
                }}
                onTrackOrder={() => {
                  if (activeBlock) setCurrentView('tracking');
                  else setCurrentView('tracking');
                }}
                onViewAllLicitacao={() => setCurrentView('licitacao-all')}
                onManageLicitacaoScreening={() => setCurrentView('licitacao-screening')}
                onVehicleScheduling={() => setCurrentView('vehicle-scheduling')}
                onViewTasksDashboard={() => {
                  setCurrentView('tasks-dashboard');
                  setActiveBlock('tarefas');
                  window.history.pushState({ view: 'tarefas', sub: 'dashboard' }, '', '/Tarefas/MinhasTarefas');
                  window.history.pushState({ view: 'tarefas', sub: 'dashboard' }, '', '/Tarefas/MinhasTarefas');
                }}
                onManageInventory={() => {
                  setActiveBlock('compras');
                  setCurrentView('purchase-inventory');
                }}
                onCalendario={() => setCurrentView('calendario')}
                onOpenAdmin={(tab) => {
                  setCurrentView('admin');
                  setAdminTab(tab || 'users');
                }}
                onAbastecimento={(sub) => {
                  setActiveBlock('abastecimento');
                  setCurrentView('abastecimento');
                  setAppState(prev => ({ ...prev, view: sub }));
                }}
                onAgricultura={() => setCurrentView('agricultura')}
                onObras={() => setCurrentView('obras')}
                onRH={() => setCurrentView('rh')}
                onProjetos={() => setCurrentView('projetos')}
                onMarketing={() => setCurrentView('marketing')}
                onConsultas={() => {
                  setCurrentView('consultas');
                  setAppState(prev => ({ ...prev, view: undefined }));
                }}
                onFarmacia={() => {
                  setCurrentView('farmacia');
                  window.history.pushState({}, '', VIEW_TO_PATH['farmacia']);
                }}
                onMotorista={() => {
                  setCurrentView('motorista');
                  window.history.pushState({}, '', VIEW_TO_PATH['motorista']);
                }}
                activeBlock={activeBlock}
                setActiveBlock={(block) => {
                  if (block === 'licitacao') {
                    setCurrentView('licitacao');
                    setActiveBlock(null);
                    window.history.pushState({}, '', '/Licitação');
                    return;
                  }
                  setActiveBlock(block);
                  if (block === 'tarefas') {
                    window.history.pushState({}, '', '/Tarefas');
                    setAppState(prev => ({ ...prev, view: '' }));
                  } else if (block === null) {
                    window.history.pushState({}, '', '/PaginaInicial');
                  }
                }}
                subView={appState.view}
                userRole={currentUser?.role || 'collaborator'}
                userName={currentUser?.name || 'Usuário'}
                userId={currentUser?.id || ''}
                userJobTitle={currentUser?.jobTitle}
                uiConfig={appState.ui}
                permissions={currentUser?.permissions || []}
                stats={{
                  totalGenerated: allSystemOrders.length,
                  historyCount: allSystemOrders.length, // Simplified
                  activeUsers: users.length
                }}
                onLogout={() => signOut()}
                orders={allSystemOrders}
                allUsers={users}
                onViewOrder={(order) => {
                  setViewingOrder(order);
                  setActiveBlock(order.blockType);
                  // Determine appropriate view based on block type
                  if (order.blockType === 'licitacao') {
                    setCurrentView('order-details');
                  } else if (order.blockType === 'tarefas') {
                    // Tasks might be viewable in a specific view or just sidebar?
                    // For now, reuse order details or just ignore if handled by sidebar
                    setViewingOrder(order);
                    setCurrentView('order-details');
                  } else {
                    setCurrentView('order-details');
                  }
                }}
              />
              );
            })()}
            {/* Purchase Items Screen */}
            {currentView === 'purchase-inventory' && (
              <PurchaseItemsScreen
                onBack={() => {
                  setCurrentView('home');
                  setActiveBlock('compras'); // Keep block active
                  window.history.pushState({}, '', '/Compras');
                }}
                userRole={currentUser?.role || 'collaborator'}
              />
            )}
            {currentView === 'vehicle-scheduling' && (
              <VehicleSchedulingScreen
                schedules={schedules}
                vehicles={vehicles}
                persons={persons}
                sectors={sectors}
                onAddSchedule={async (s) => {
                  // Optimistic Update
                  const optimistic = { ...s, id: Date.now().toString(), createdAt: new Date().toISOString() } as VehicleSchedule;
                  setSchedules(prev => [optimistic, ...prev]);
                  try {
                    await vehicleSchedulingService.createSchedule(s);
                  } catch (e) {
                    console.error("Failed to create schedule", e);
                    setSchedules(prev => prev.filter(x => x.id !== optimistic.id));
                    showToast("Erro ao agendar veículo.", "error");
                  }
                }}
                onUpdateSchedule={async (s) => {
                  // Optimistic Update
                  const previousSchedules = [...schedules];
                  setSchedules(prev => prev.map(old => old.id === s.id ? s : old));

                  try {
                    const result = await vehicleSchedulingService.updateSchedule(s);
                    if (!result) throw new Error('Update failed');
                    // Ensure the state reflects any server-side defaults/changes
                    setSchedules(prev => prev.map(old => old.id === result.id ? result : old));
                  } catch (e) {
                    console.error("Failed to update schedule", e);
                    setSchedules(previousSchedules); // Rollback
                    showToast("Erro ao atualizar agendamento. Tente novamente.", "error");
                  }
                }}
                onDeleteSchedule={async (id) => {
                  // Optimistic Delete
                  const previousSchedules = [...schedules];
                  setSchedules(prev => prev.filter(s => s.id !== id));

                  try {
                    const success = await vehicleSchedulingService.deleteSchedule(id);
                    if (!success) throw new Error('Delete failed');
                    showToast("Agendamento excluído.", "success");
                  } catch (e) {
                    console.error("Failed to delete schedule", e);
                    setSchedules(previousSchedules); // Rollback
                    showToast("Erro ao excluir agendamento.", "error");
                  }
                }}
                onBack={() => {
                  setCurrentView('home');
                  setActiveBlock(null);
                  window.history.pushState({}, '', '/PaginaInicial');
                }}
                currentUserId={currentUser?.id || ''}
                currentUserName={currentUser?.name}
                currentUserSector={currentUser?.sector}
                currentUserRole={currentUser?.role || 'collaborator'}
                currentUserPermissions={currentUser?.permissions || []}
                requestedView={(() => {
                  if (activeBlock === 'vs_calendar') return 'calendar';
                  if (activeBlock === 'vs_history') return 'history';
                  if (activeBlock === 'vs_approvals') return 'approvals';
                  if (activeBlock === 'dashboard') return 'dashboard';
                  return 'menu';
                })()}
                onNavigate={(path) => {
                  if (path === '/AgendamentoVeiculos/Agendar') setActiveBlock('vs_calendar');
                  else if (path === '/AgendamentoVeiculos/Historico') setActiveBlock('vs_history');
                  else if (path === '/AgendamentoVeiculos/Aprovacoes') setActiveBlock('vs_approvals');
                  else if (path === '/AgendamentoVeiculos/Dashboard') setActiveBlock('dashboard');
                  else setActiveBlock(null); // Menu
                  window.history.pushState({}, '', path);
                }}
                state={appState}
              />
            )}
            {/* Abastecimento Module */}
            {currentView === 'abastecimento' && appState.view === 'new' && (
              <AbastecimentoForm
                onBack={() => {
                  if (editingAbastecimento) {
                    setEditingAbastecimento(null);
                    setAppState(prev => ({ ...prev, view: 'management' }));
                  } else {
                    setEditingAbastecimento(null);
                    setCurrentView('home');
                    setActiveBlock('abastecimento');
                    window.history.pushState({}, '', '/PaginaInicial');
                  }
                }}
                onSave={(data) => {
                  console.log('Abastecimento salvo:', data);
                  showToast(editingAbastecimento ? 'Abastecimento atualizado com sucesso!' : 'Abastecimento registrado com sucesso!', 'success');

                  if (editingAbastecimento) {
                    setEditingAbastecimento(null);
                    setAppState(prev => ({ ...prev, view: 'management' }));
                  } else {
                    setEditingAbastecimento(null);
                    setCurrentView('home');
                    setActiveBlock('abastecimento');
                  }
                }}
                vehicles={vehicles}
                persons={persons}
                gasStations={gasStations}
                fuelTypes={fuelTypes}
                initialData={editingAbastecimento}
              />
            )}

            {currentView === 'abastecimento' && appState.view === 'management' && (
              <AbastecimentoList
                onBack={() => {
                  setEditingAbastecimento(null);
                  setCurrentView('home');
                  setActiveBlock('abastecimento');
                  window.history.pushState({}, '', '/PaginaInicial');
                }}
                onEdit={(record) => {
                  setEditingAbastecimento(record);
                  setAppState(prev => ({ ...prev, view: 'new' })); // Reuse 'new' view for editing form
                  setCurrentView('abastecimento');
                }}
                refreshTrigger={lastRefresh}
              />
            )}

            {currentView === 'abastecimento' && appState.view === 'dashboard' && (
              <AbastecimentoDashboard
                state={appState}
                onBack={() => {
                  setCurrentView('home');
                  setActiveBlock('abastecimento');
                  window.history.pushState({}, '', '/PaginaInicial');
                }}
                onAbastecimento={(sub) => {
                  setAppState(prev => ({ ...prev, view: sub }));
                  setCurrentView('abastecimento');
                  const path = `abastecimento:${sub}`;
                  if (VIEW_TO_PATH[path]) {
                    window.history.pushState({}, '', VIEW_TO_PATH[path]);
                  }
                }}
                vehicles={vehicles}
                persons={persons}
                gasStations={gasStations}
                fuelTypes={fuelTypes}
                sectors={sectors}
                refreshTrigger={lastRefresh}
              />
            )}

            {currentView === 'motorista' && (
              <MotoristaModule
                onBack={() => {
                  setCurrentView('home');
                  setActiveBlock(null);
                  window.history.pushState({}, '', '/PaginaInicial');
                }}
                onNavigate={(view) => {
                  setCurrentView(view as any);
                  window.history.pushState({}, '', VIEW_TO_PATH[view]);
                }}
              />
            )}
            
            {currentView === 'motorista:nova-viagem' && (
              <NovaViagemScreen onBack={() => {
                  setCurrentView('motorista');
                  window.history.pushState({}, '', VIEW_TO_PATH['motorista']);
              }} />
            )}

            {currentView === 'motorista:minhas-viagens' && (
              <MinhasViagensScreen onBack={() => {
                  setCurrentView('motorista');
                  window.history.pushState({}, '', VIEW_TO_PATH['motorista']);
              }} />
            )}

            {currentView === 'agricultura' && (
              <AgricultureModule
                onBack={() => {
                  setCurrentView('home');
                  setActiveBlock(null);
                  window.history.pushState({}, '', '/PaginaInicial');
                }}
              />
            )}

            {currentView === 'obras' && (
              <ObrasModule
                onBack={() => {
                  setCurrentView('home');
                  setActiveBlock(null);
                  window.history.pushState({}, '', '/PaginaInicial');
                }}
              />
            )}

            {currentView === 'licitacao' && (
              <LicitacaoDashboard
                onNavigate={(view) => {
                  setCurrentView(view as any);
                  const path = view === 'licitacao:new' ? '/Licitação/NovoPedido' : '/Licitação/MeusProcessos';
                  window.history.pushState({}, '', path);
                }}
                onBack={() => {
                  setCurrentView('home');
                  setActiveBlock(null);
                  window.history.pushState({}, '', '/PaginaInicial');
                }}
              />
            )}

            {currentView === 'licitacao:new' && (
              <LicitacaoWizard
                currentUser={currentUser!}
                onBack={() => {
                  setCurrentView('licitacao');
                  window.history.pushState({}, '', '/Licitação');
                }}
              />
            )}

            {currentView === 'licitacao:view' && viewingOrder && (
              <LicitacaoWizard
                currentUser={currentUser!}
                initialData={viewingOrder}
                readOnly={true}
                onBack={() => {
                  setCurrentView('licitacao');
                  window.history.pushState({}, '', '/Licitação/MeusProcessos');
                }}
              />
            )}

            {currentView === 'licitacao:details' && currentUser && (
              <TrackingScreen
                onBack={() => {
                  setCurrentView('licitacao');
                  window.history.pushState({}, '', '/Licitação');
                }}
                currentUser={currentUser}
                activeBlock="licitacao"
                orders={mappedLicitacaoOrders}
                onDownloadPdf={(snapshot, forcedBlockType, order) => { const target = order || orders.find(o => o.documentSnapshot === snapshot); if (target) handleDownloadFromHistory(target, forcedBlockType, snapshot); }}
                onClearAll={() => setOrders([])}
                onEditOrder={handleEditOrder}
                onDeleteOrder={handleDeleteOrder}
                onUpdateAttachments={handleUpdateOrderAttachments}
                totalCounter={globalCounter}
                onUpdatePaymentStatus={handleUpdatePaymentStatus}
                onUpdateOrderStatus={async (order, status, justification) => {
                  const targetOrder = typeof order === 'string' ? orders.find(o => o.id === order) || mappedLicitacaoOrders.find(o => o.id === order) : order;
                  if (!targetOrder) return;
                  if (activeBlock === 'licitacao') {
                    let mappedBackendStatus: any = status;
                    if (status === 'pending') mappedBackendStatus = 'Rascunho';
                    else if (status === 'awaiting_approval') mappedBackendStatus = 'Aguardando Assinatura';
                    else if (status === 'in_progress') mappedBackendStatus = 'Em Análise';
                    else if (status === 'completed') mappedBackendStatus = 'Concluído';
                    else if (status === 'rejected') mappedBackendStatus = 'Rejeitado';
                    await updateLicitacaoProcessMutation.mutateAsync({ id: targetOrder.id, updates: { status: mappedBackendStatus as any } });
                  } else {
                    await handleUpdateOrderStatus(order, status, justification);
                  }
                }}
                onUpdatePurchaseStatus={handleUpdatePurchaseStatus}
                onViewOrder={handleViewOrder}
                sectors={sectors}
                onUpdateLicitacaoPhase={handleUpdateLicitacaoPhase}
                onUpdateLicitacaoProtocol={handleUpdateLicitacaoProtocol}
              />
            )}

            {currentView === 'projetos' && (
              <ProjetosModule
                currentView={currentView}
                userId={currentUser?.id || ''}
                userName={currentUser?.name || ''}
                userRole={currentUser?.role || ''}
                users={users}
                persons={persons}
                sectors={sectors}
                appState={appState}
                onLogout={signOut}
                onBack={() => {
                  setCurrentView('home');
                  setActiveBlock(null);
                  window.history.pushState({}, '', '/PaginaInicial');
                }}
                subView={appState.sub}
                selectedProjetoId={appState.selectedId}
                onNavigate={(view, id) => {
                  setAppState(prev => ({ ...prev, sub: view, selectedId: id }));
                  const path = id ? `${VIEW_TO_PATH['projetos:details']}/${id}` : (view === 'new' ? VIEW_TO_PATH['projetos:new'] : VIEW_TO_PATH['projetos']);
                  window.history.pushState({}, '', path);
                }}
              />
            )}

            {currentView === 'marketing' && (
              <MarketingModule
                currentView={currentView}
                userId={currentUser?.id || ''}
                userName={currentUser?.name || ''}
                userRole={currentUser?.role || ''}
                users={users}
                persons={persons}
                sectors={sectors}
                appState={appState}
                onLogout={signOut}
                onBack={() => {
                  setCurrentView('home');
                  setActiveBlock(null);
                  window.history.pushState({}, '', '/PaginaInicial');
                }}
                subView={appState.sub}
                selectedRequestId={appState.selectedId}
                onNavigate={(view, id) => {
                  setAppState(prev => ({ ...prev, sub: view, selectedId: id }));
                  const path = id ? `${VIEW_TO_PATH['marketing:details']}/${id}` : (view === 'new' ? VIEW_TO_PATH['marketing:new'] : VIEW_TO_PATH['marketing']);
                  window.history.pushState({}, '', path);
                }}
              />
            )}

            {currentView === 'rh' && (
              <RHModule
                currentView={currentView}
                subView={appState.view}
                userRole={currentUser?.role || 'collaborator'}
                userName={currentUser?.name || ''}
                userId={currentUser?.id || ''}
                users={users}
                persons={persons}
                jobs={jobs}
                sectors={sectors}
                appState={appState}
                onNavigate={(view) => {
                  if (view === 'home') {
                    setCurrentView('home');
                    setActiveBlock(null);
                    window.history.pushState({}, '', '/PaginaInicial');
                  } else if (view === 'rh:horas-extras') {
                    setAppState(prev => ({ ...prev, view: 'horas-extras' }));
                    window.history.pushState({}, '', '/RH/HorasExtras');
                  } else if (view === 'rh:historico') {
                    setAppState(prev => ({ ...prev, view: 'historico' }));
                    window.history.pushState({}, '', '/RH/Historico');
                  } else if (view === 'rh') {
                    setAppState(prev => ({ ...prev, view: undefined }));
                    window.history.pushState({}, '', '/RH');
                  }
                }}
                onLogout={signOut}
                onSaveForm={(data) => {
                  // Simulate save process with 2FA
                  setAppState(prev => ({
                    ...prev,
                    content: {
                      ...prev.content,
                      useDigitalSignature: true,
                      signatureName: currentUser?.name || '',
                      signatureRole: currentUser?.jobTitle || '',
                      signatureSector: currentUser?.sector || ''
                    }
                  }));

                  const executeSave = async () => {
                    try {
                      // Start saving process and open the animated modal blocking the screen
                      setActionProcessing({ isOpen: true, stage: 'sending' });
                      await advanceActionStep('sending', 500);

                      const savedRecord = data.id
                        ? await updateRhHorasExtras(data.id, {
                          month: data.month,
                          entries: data.entries,
                          updated_at: new Date().toISOString()
                        })
                        : await saveRhHorasExtras({
                          month: data.month,
                          sector: currentUser?.sector || 'Geral',
                          entries: data.entries,
                          user_id: currentUser?.id || '',
                          user_name: currentUser?.name || 'Sistema',
                          signature_name: currentUser?.name || 'Sistema',
                          signature_role: currentUser?.jobTitle || '',
                          signature_sector: currentUser?.sector || ''
                        });

                      await advanceActionStep('validating', 1000); // Use 'validating' instead of 'processing'
                      await advanceActionStep('confirming', 500); // Use 'confirming' instead of 'finalizing'
                      await advanceActionStep('success', 1500);

                      setActionProcessing(prev => ({ ...prev, isOpen: false }));
                      showToast(`Horas extras salvas com sucesso para o mês de ${data.month}!`, "success");

                      // Dispatch event to switch to the historico tab and highlight the new record
                      window.dispatchEvent(new CustomEvent('rh-force-historico', { detail: { id: savedRecord.id } }));
                    } catch (error) {
                      console.error("Error saving horas extras:", error);
                      setActionProcessing(prev => ({ ...prev, isOpen: false }));
                      showToast("Erro ao arquivar as horas extras no banco de dados.", "error");
                    }
                  };

                  if (currentUser && (currentUser.twoFactorEnabled || currentUser.twoFactorEnabled2)) {
                    setTwoFASecret(currentUser.twoFactorEnabled ? (currentUser.twoFactorSecret || '') : '');
                    setTwoFASecret2(currentUser.twoFactorEnabled2 ? (currentUser.twoFactorSecret2 || null) : null);
                    setTwoFASignatureName(currentUser.name);
                    setPending2FAAction(() => async () => executeSave());
                    setIs2FAModalOpen(true);
                  } else {
                    executeSave();
                  }
                }}
              />
            )}

            {currentView === 'consultas' && (
              <ConsultasModule
                currentView={currentView}
                subView={appState.view}
                currentUser={currentUser!}
                onNavigate={(view) => {
                  if (view === 'home') {
                    setCurrentView('home');
                    setActiveBlock(null);
                    window.history.pushState({}, '', '/PaginaInicial');
                  } else if (view === 'consultas:novo-agendamento') {
                    setAppState(prev => ({ ...prev, view: 'novo-agendamento' }));
                    window.history.pushState({}, '', '/Consultas/NovoAgendamento');
                  } else if (view === 'consultas:acompanhar') {
                    setAppState(prev => ({ ...prev, view: 'acompanhar' }));
                    window.history.pushState({}, '', '/Consultas/Acompanhar');
                  } else if (view === 'consultas:dados') {
                    setAppState(prev => ({ ...prev, view: 'dados-dashboard' }));
                    window.history.pushState({}, '', '/Consultas/DADOS/Dashboard');
                  } else if (view === 'consultas:dados-dashboard') {
                    setAppState(prev => ({ ...prev, view: 'dados-dashboard' }));
                    window.history.pushState({}, '', '/Consultas/DADOS/Dashboard');
                  } else if (view === 'consultas:dados-pacientes') {
                    setAppState(prev => ({ ...prev, view: 'dados-pacientes' }));
                    window.history.pushState({}, '', '/Consultas/DADOS/Pacientes');
                  } else if (view === 'consultas:dados-procedimentos') {
                    setAppState(prev => ({ ...prev, view: 'dados-procedimentos' }));
                    window.history.pushState({}, '', '/Consultas/DADOS/Exames');
                  } else if (view === 'consultas:dados-historico') {
                    setAppState(prev => ({ ...prev, view: 'dados-historico' }));
                    window.history.pushState({}, '', '/Consultas/DADOS/Historico');
                  } else if (view === 'consultas') {
                    setAppState(prev => ({ ...prev, view: undefined }));
                    window.history.pushState({}, '', '/Consultas');
                  }
                }}
                onLogout={signOut}
                appState={appState}
              />
            )}

            {currentView === 'farmacia' && (
              <FarmaciaModule
                currentView={currentView}
                subView={appState.view}
                currentUser={currentUser!}
                onNavigate={(view) => {
                  if (view === 'home') {
                    setCurrentView('home');
                    setActiveBlock(null);
                    window.history.pushState({}, '', '/PaginaInicial');
                  } else if (view === 'farmacia:consultar') {
                    setAppState(prev => ({ ...prev, view: 'consultar' }));
                    window.history.pushState({}, '', '/FarmaciaPopular/Consultar');
                  } else if (view === 'farmacia:retirar') {
                    setAppState(prev => ({ ...prev, view: 'retirar' }));
                    window.history.pushState({}, '', '/FarmaciaPopular/Retirar');
                  } else if (view === 'farmacia:estoque') {
                    setAppState(prev => ({ ...prev, view: 'estoque' }));
                    window.history.pushState({}, '', '/FarmaciaPopular/Estoque');
                  } else if (view === 'farmacia:dados') {
                    setAppState(prev => ({ ...prev, view: 'dados' }));
                    window.history.pushState({}, '', '/FarmaciaPopular/Dados');
                  } else if (view === 'farmacia:historico') {
                    setAppState(prev => ({ ...prev, view: 'historico' }));
                    window.history.pushState({}, '', '/FarmaciaPopular/Historico');
                  } else if (view === 'farmacia:dashboard') {
                    setAppState(prev => ({ ...prev, view: 'dashboard-geral' }));
                    window.history.pushState({}, '', '/FarmaciaPopular/Dashboard/VisaoGeral');
                  } else if (view === 'farmacia:dashboard-geral') {
                    setAppState(prev => ({ ...prev, view: 'dashboard-geral' }));
                    window.history.pushState({}, '', '/FarmaciaPopular/Dashboard/VisaoGeral');
                  } else if (view === 'farmacia:dashboard-medicamentos') {
                    setAppState(prev => ({ ...prev, view: 'dashboard-medicamentos' }));
                    window.history.pushState({}, '', '/FarmaciaPopular/Dashboard/Medicamentos');
                  } else if (view === 'farmacia:dashboard-pacientes') {
                    setAppState(prev => ({ ...prev, view: 'dashboard-pacientes' }));
                    window.history.pushState({}, '', '/FarmaciaPopular/Dashboard/Pacientes');
                  } else if (view === 'farmacia:dashboard-relatorios') {
                    setAppState(prev => ({ ...prev, view: 'dashboard-relatorios' }));
                    window.history.pushState({}, '', '/FarmaciaPopular/Dashboard/Relatorios');
                  } else if (view === 'farmacia') {
                    setAppState(prev => ({ ...prev, view: undefined }));
                    window.history.pushState({}, '', '/FarmaciaPopular');
                  }
                }}
                onLogout={signOut}
                appState={appState}
              />
            )}

            {currentView === 'tracking' && currentUser && (
              <TrackingScreen
                onBack={handleBackToModule}
                currentUser={currentUser}
                activeBlock={activeBlock}
                orders={orders}

                onDownloadPdf={(snapshot, forcedBlockType, order) => { const target = order || orders.find(o => o.documentSnapshot === snapshot); if (target) handleDownloadFromHistory(target, forcedBlockType, snapshot); }}
                onClearAll={() => setOrders([])}
                onEditOrder={handleEditOrder}
                onDeleteOrder={handleDeleteOrder}
                onUpdateAttachments={handleUpdateOrderAttachments}
                totalCounter={globalCounter}
                onUpdatePaymentStatus={handleUpdatePaymentStatus}
                onUpdateOrderStatus={handleUpdateOrderStatus}
                onUpdatePurchaseStatus={handleUpdatePurchaseStatus}
                onViewOrder={handleViewOrder}
                sectors={sectors}
                onResetOrderFlow={handleResetOrderFlow}
              />
            )}
            {currentView === 'licitacao-all' && currentUser && (
              <TrackingScreen
                onBack={handleBackToModule}
                currentUser={currentUser}
                activeBlock={activeBlock}
                orders={mappedLicitacaoOrders}
                showAllProcesses={true}
                onDownloadPdf={(snapshot, forcedBlockType, order) => { const target = order || orders.find(o => o.documentSnapshot === snapshot); if (target) handleDownloadFromHistory(target, forcedBlockType, snapshot); }}
                onClearAll={() => setOrders([])}
                onEditOrder={handleEditOrder}
                onDeleteOrder={handleDeleteOrder}
                onUpdateAttachments={handleUpdateOrderAttachments}
                totalCounter={globalCounter}
                onUpdatePaymentStatus={handleUpdatePaymentStatus}
                onUpdateOrderStatus={async (order, status, justification) => {
                  const targetOrder = typeof order === 'string' ? orders.find(o => o.id === order) || mappedLicitacaoOrders.find(o => o.id === order) : order;
                  if (!targetOrder) return;
                  if (activeBlock === 'licitacao') {
                    let mappedBackendStatus: any = status;
                    if (status === 'pending') mappedBackendStatus = 'Rascunho';
                    else if (status === 'awaiting_approval') mappedBackendStatus = 'Aguardando Assinatura';
                    else if (status === 'in_progress') mappedBackendStatus = 'Em Análise';
                    else if (status === 'completed') mappedBackendStatus = 'Concluído';
                    else if (status === 'rejected') mappedBackendStatus = 'Rejeitado';
                    await updateLicitacaoProcessMutation.mutateAsync({ id: targetOrder.id, updates: { status: mappedBackendStatus as any } });
                  } else {
                    await handleUpdateOrderStatus(order, status, justification);
                  }
                }}
                onUpdatePurchaseStatus={handleUpdatePurchaseStatus}
                onViewOrder={handleViewOrder}
                sectors={sectors}
                onUpdateLicitacaoPhase={handleUpdateLicitacaoPhase}
                onUpdateLicitacaoProtocol={handleUpdateLicitacaoProtocol}
              />
            )}

            {currentView === 'diarias-novo-evento' && currentUser && (
              <NovoEventoScreen
                currentUser={currentUser}
                persons={persons}
                sectors={sectors}
                jobs={jobs}
                onBack={() => {
                  window.history.pushState({}, '', '/Diarias');
                  window.dispatchEvent(new Event('popstate'));
                }}
              />
            )}

            {currentView === 'diarias-lancamentos' && currentUser && (
              <LancamentosScreen
                currentUser={currentUser}
                onBack={() => {
                  window.history.pushState({}, '', '/Diarias');
                  window.dispatchEvent(new Event('popstate'));
                }}
                onGenerateDiaria={handleStartDiariaFromEvent}
              />
            )}

            {currentView === 'diarias-gestores' && currentUser && (
              <GestoresScreen
                persons={persons}
                users={users}
                currentUser={currentUser}
                onBack={() => {
                  window.history.pushState({}, '', '/Diarias');
                  window.dispatchEvent(new Event('popstate'));
                }}
              />
            )}

            {currentView === 'order-details' && viewingOrder && currentUser && (
              <OrderDetailsScreen
                order={viewingOrder}
                onBack={handleBackToTracking}
                onDownloadPdf={(snapshot, blockType) => handleDownloadFromHistory({ ...viewingOrder, documentSnapshot: snapshot }, blockType)}
                currentUser={currentUser}
                onUpdateOrderStatus={handleUpdateOrderStatus}
              />
            )}

            {currentView === 'tasks-dashboard' && (
              <div className="fixed inset-0 z-[100] bg-white">
                <TasksDashboard
                  orders={orders}
                  userRole={currentUser?.role || 'collaborator'}
                  userName={currentUser?.name || ''}
                  userId={currentUser?.id || ''}
                  onViewOrder={(order) => {
                    setViewingOrder(order);
                    setActiveBlock(order.blockType);
                    setCurrentView('order-details');
                  }}
                  onViewAll={handleTrackOrder}
                  onClose={() => {
                    setCurrentView('home');
                    setActiveBlock('tarefas');
                    window.history.pushState({ view: 'tarefas' }, '', '/Tarefas');
                  }}
                  fullScreen={true}
                />
              </div>
            )}

            {currentView === 'calendario' && (
              (permissions.includes('parent_calendario') || currentUser?.role === 'admin') && isModuleActive('parent_calendario') ? (
                <Calendario
                  onBack={handleGoHome}
                  userRole={currentUser?.role || 'collaborator'}
                  currentUserId={currentUser?.id || ''}
                  appState={appState}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-6">
                  <ShieldAlert className="w-20 h-20 text-red-500 mb-6 opacity-20" />
                  <h2 className="text-2xl font-black text-slate-800">Acesso Restrito</h2>
                  <p className="text-slate-500 font-medium mt-2">Você não possui permissão para acessar o módulo de Calendário.</p>
                  <button
                    onClick={handleGoHome}
                    className="mt-8 px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-indigo-600 transition-all shadow-lg"
                  >
                    Voltar ao Início
                  </button>
                </div>
              )
            )}

            {/* LOADING OVERLAY */}
            {isLoadingDetails && (
              <div className="fixed inset-0 z-[150] bg-white/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                  <p className="text-slate-600 font-bold animate-pulse">Carregando detalhes...</p>
                </div>
              </div>
            )}

            {/* 2FA MODAL */}
            {
              is2FAModalOpen && (
                <TwoFactorModal
                  isOpen={is2FAModalOpen}
                  onClose={() => {
                    setIs2FAModalOpen(false);
                    setPending2FAAction(null);
                    setPendingParams(false);
                  }}
                  onConfirm={() => {
                    setIs2FAModalOpen(false);
                    if (pending2FAAction) {
                      pending2FAAction(undefined);
                      setPending2FAAction(null);
                    } else {
                      // Resume finish, skipping 2FA check
                      const digitalSigData = {
                        enabled: true,
                        method: '2FA Token (App)',
                        ip: 'Client-Device',
                        date: new Date().toISOString(),
                        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2)
                      };
                      handleFinish(true, digitalSigData);
                    }
                  }}
                  secret={twoFASecret}
                  secret2={twoFASecret2}
                  signatureName={twoFASignatureName}
                />
              )
            }

            {/* OFICIO NUMBERING MODAL */}
            {
              currentUser && (
                <OficioNumberingModal
                  isOpen={isOficioNumberingModalOpen}
                  onClose={() => setIsOficioNumberingModalOpen(false)}
                  onConfirm={(summary?: string) => {
                    setIsOficioNumberingModalOpen(false);
                    // Pass persisted metadata if available, avoiding second 2FA
                    handleFinish(true, pendingSignatureMetadata || undefined, true, summary);
                    setPendingSignatureMetadata(null); // Clear after use
                  }}
                  sectorId={(() => {
                    const s = sectors.find(sec => sec.name === currentUser.sector);
                    return s ? s.id : null;
                  })()}
                  title={activeBlock === 'compras' ? "Gerando Pedido" : "Gerando Número"}
                  label={activeBlock === 'compras' ? "PRÓXIMO PEDIDO COMPRA" : "PRÓXIMO OFÍCIO DO SETOR"}
                  sectorName={currentUser.sector || ''}
                />
              )
            }

          </div>
        </div >
      </ChatProvider>

      {/* HIDDEN PREVIEW SCALER FOR PDF GENERATION */}
      {snapshotToDownload && (
        <div style={{ position: 'fixed', top: -10000, left: -10000, pointerEvents: 'none', visibility: 'hidden' }}>
          <div id="background-preview-scaler" style={{ width: '210mm', minHeight: '297mm', background: 'white' }}>
            <DocumentPreview
              state={snapshotToDownload}
              isGenerating={true}
              mode="editor" // Force editor/clean mode
              blockType={blockTypeToDownload || undefined}
            />
          </div>
        </div>
      )}

      <GlobalLoading
        type="overlay"
        isOpen={purchaseLoadingState.isLoading}
        message={purchaseLoadingState.title}
        description={purchaseLoadingState.message}
      />

      <ActionProcessingModal
        isOpen={actionProcessing.isOpen}
        stage={actionProcessing.stage}
        customLabels={actionProcessing.customLabels}
      />

      {/* GLOBAL SYSTEM UPDATE NOTIFICATION (TRIGERRED BY ADMIN) */}
      {systemUpdateCountdown !== null && systemUpdateCountdown > 0 && !isUpdateModalDismissed && createPortal(
        <div className="fixed inset-0 z-[1000] bg-slate-900/10 backdrop-blur-[2px] flex items-center justify-center p-6 animate-fade-in pointer-events-none">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-10 text-center transform scale-in-center overflow-hidden relative pointer-events-auto shadow-amber-500/10 active:scale-95 transition-all">
            {/* Background Accent */}
            <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600"></div>

            <button
              onClick={() => setIsUpdateModalDismissed(true)}
              className="absolute top-4 right-4 p-2 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-full transition-all"
              title="Fechar Aviso"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-8 text-amber-500 ring-8 ring-amber-500/5">
              <Settings className="w-10 h-10 animate-spin-slow" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tighter uppercase leading-tight">
              ⚠️ O sistema será atualizado em {systemUpdateCountdown}s
            </h2>

            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6 px-4">
              Um administrador iniciou uma atualização crítica. Você pode fechar este aviso para terminar o que está fazendo, mas salve seu trabalho.
            </p>

            {/* Commit Message Box */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-6 text-left mx-4 relative overflow-hidden group shadow-sm transition-all hover:shadow-md">
              <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-400 to-amber-600 rounded-l-2xl"></div>
              <h4 className="text-xs font-black text-slate-800 mb-1.5 flex items-center gap-2 uppercase tracking-widest pl-2">
                ✨ O que há de novo:
              </h4>
              <p className="text-sm text-slate-600 font-medium leading-relaxed italic pl-2">
                {translatedCommitMsg}
              </p>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-center">
              <div className="flex items-center gap-3 text-xs font-black text-amber-600 bg-amber-50 py-4 rounded-2xl px-8 uppercase tracking-widest shadow-inner">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
                Confira o tempo no topo da tela
              </div>
            </div>
          </div>

          <style dangerouslySetInnerHTML={{
            __html: `
            @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scale-in-center { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            .scale-in-center { animation: scale-in-center 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
          `}} />
        </div>,
        document.body
      )}

      {/* Remote Access Global Cursor and Ripples */}
      {remoteAccessState?.mode === 'host' && remoteAccessState.remoteCursor?.visible && (
        <div 
          className="fixed pointer-events-none z-[99999] transition-all duration-75 flex items-center gap-2"
          style={{ 
            left: `${remoteAccessState.remoteCursor.x * 100}vw`, 
            top: `${remoteAccessState.remoteCursor.y * 100}vh`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="relative">
            <Send className="w-5 h-5 text-rose-500 fill-rose-500 rotate-[135deg] drop-shadow-lg" />
            {remoteAccessState.remoteCursor.label && (
              <span className="absolute left-4 top-4 px-2 py-0.5 bg-rose-500 text-white text-[9px] font-black uppercase rounded shadow-lg whitespace-nowrap">
                {remoteAccessState.remoteCursor.label}
              </span>
            )}
          </div>
        </div>
      )}

      {remoteAccessState?.mode === 'host' && remoteAccessState.lastClick && (
        <div 
          key={remoteAccessState.lastClick.timestamp}
          className="fixed pointer-events-none z-[99998] w-12 h-12 rounded-full border-4 border-rose-500/80 bg-rose-500/20"
          style={{ 
            left: `${remoteAccessState.lastClick.x * 100}vw`, 
            top: `${remoteAccessState.lastClick.y * 100}vh`,
            transform: 'translate(-50%, -50%)',
            animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite'
          }}
        />
      )}

      {/* Painel Flutuante Ativo para o Host (Transmissor) - Sempre visível se a transmissão estiver ativa */}
      {remoteAccessState && remoteAccessState.connectionState !== 'idle' && remoteAccessState.mode === 'host' && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-slate-900/95 border border-slate-800 backdrop-blur-md text-white px-5 py-4 rounded-3xl shadow-2xl flex flex-col gap-3 min-w-[280px] animate-fade-in select-none">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${remoteAccessState.connectionState === 'connected' ? 'bg-emerald-500' : 'bg-indigo-500'} animate-pulse`} />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">
                {remoteAccessState.connectionState === 'connected' ? 'Suporte Conectado' : 'Transmitindo Tela'}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-slate-800 px-2 py-0.5 rounded text-indigo-400">
              Cód: {remoteAccessState.accessCode}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Permitir / Revogar Controle */}
            <button
              onClick={() => remoteAccessService.grantMouseControl(!remoteAccessState.isMouseControlGranted)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 ${
                remoteAccessState.isMouseControlGranted
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/15'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>{remoteAccessState.isMouseControlGranted ? 'Bloquear Controle' : 'Permitir Controle'}</span>
            </button>

            {/* Botão Encerrar */}
            <button
              onClick={() => remoteAccessService.stopSession()}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all shadow-lg shadow-rose-600/15"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Encerrar</span>
            </button>
          </div>
        </div>
      )}

      {/* Painel Flutuante Ativo para o Client (Suporte/Visualizador) - Visível apenas fora da tela de suporte */}
      {remoteAccessState && remoteAccessState.connectionState !== 'idle' && remoteAccessState.mode === 'client' && (currentView !== 'admin' || adminTab !== 'remote_access') && (
        <div className="fixed bottom-6 left-6 z-[80] bg-slate-900 border border-slate-800 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-fade-in select-none">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setCurrentView('admin'); setAdminTab('remote_access'); }}>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-colors flex items-center gap-1">
              <Tv className="w-3 h-3" />
              Suporte Ativo (Cód: {remoteAccessState.inputCode}) - Clique para Abrir
            </span>
          </div>
          <button 
            onClick={() => remoteAccessService.stopSession()}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl text-[9px] uppercase tracking-wider transition-all"
          >
            Encerrar
          </button>
        </div>
      )}
    </NotificationProvider >
  );
};

export default App;