import { supabase } from './supabaseClient';
import { User } from '../types';
import { auditLogService } from './auditLogService';
import { ImpersonationSession } from './impersonationService';

export type AssistedOperationMode = 'observer' | 'simulation';
export type AssistedSyncStatus = 'connected' | 'syncing' | 'reconnecting' | 'paused' | 'disconnected';

export interface AssistedNavPayload {
  eventId?: string;
  path: string;
  currentView: string;
  activeBlock: string | null;
  adminTab: string | null;
  currentSubView?: string | null;
  activeTab?: string | null;
  searchQuery?: string;
  filterStatus?: string | null;
  timestamp: number;
  source?: 'admin' | 'user';
  senderId?: string;
}

export interface AssistedStateSnapshotPayload {
  eventId?: string;
  path: string;
  currentView: string;
  activeBlock: string | null;
  adminTab: string | null;
  currentSubView?: string | null;
  activeTab?: string | null;
  searchQuery?: string;
  filterStatus?: string | null;
  activeModal?: {
    modalId?: string;
    action?: string;
    data?: any;
  } | null;
  step?: number | null;
  scrollY?: number;
  timestamp: number;
  source?: 'admin' | 'user';
  senderId?: string;
}

export interface AssistedMouseMovePayload {
  eventId?: string;
  xPct: number;
  yPct: number;
  isTouch?: boolean;
  userName?: string;
  timestamp: number;
  source?: 'admin' | 'user';
  senderId?: string;
}

export interface AssistedClickPayload {
  eventId?: string;
  xPct: number;
  yPct: number;
  tag?: string;
  text?: string;
  selector?: string;
  dataAssistId?: string;
  isTouch?: boolean;
  userName?: string;
  timestamp: number;
  source?: 'admin' | 'user';
  senderId?: string;
}

export interface AssistedScrollPayload {
  eventId?: string;
  scrollPctY: number;
  scrollY: number;
  timestamp: number;
  source?: 'admin' | 'user';
  senderId?: string;
}

export interface AssistedInputPayload {
  eventId?: string;
  selector?: string;
  dataAssistId?: string;
  name?: string;
  id?: string;
  value: string;
  checked?: boolean;
  tagName?: string;
  isSearch?: boolean;
  timestamp: number;
  source?: 'admin' | 'user';
  senderId?: string;
}

export interface AssistedModalPayload {
  eventId?: string;
  modalId?: string;
  action: 'open' | 'close' | 'change_tab' | 'step_change';
  data?: any;
  step?: number | null;
  timestamp: number;
  source?: 'admin' | 'user';
  senderId?: string;
}

export interface AssistedTabPayload {
  eventId?: string;
  tabId: string;
  section?: string;
  filterValue?: string | null;
  timestamp: number;
  source?: 'admin' | 'user';
  senderId?: string;
}

export interface AssistedControlPayload {
  eventId?: string;
  status: 'active' | 'paused' | 'ended';
  mode: AssistedOperationMode;
  sessionId: string;
  adminName: string;
  adminId: string;
  targetUserId: string;
  timestamp: number;
}

export interface AssistedSessionState {
  isPaused: boolean;
  isTargetUserConnected: boolean;
  mode: AssistedOperationMode;
  syncStatus: AssistedSyncStatus;
  lastSyncTime: number;
}

export interface AssistedSessionListeners {
  onControl?: (payload: AssistedControlPayload) => void;
  onNavigation?: (payload: AssistedNavPayload) => void;
  onStateSnapshot?: (payload: AssistedStateSnapshotPayload) => void;
  onRequestState?: () => void;
  onMouseMove?: (payload: AssistedMouseMovePayload) => void;
  onClick?: (payload: AssistedClickPayload) => void;
  onScroll?: (payload: AssistedScrollPayload) => void;
  onInputChange?: (payload: AssistedInputPayload) => void;
  onModalState?: (payload: AssistedModalPayload) => void;
  onTabChange?: (payload: AssistedTabPayload) => void;
  onPresenceChange?: (hasTargetUserOnline: boolean) => void;
  onSessionEnded?: () => void;
  onSyncStatusChange?: (status: AssistedSyncStatus) => void;
}

export interface AdminSessionObserverListeners {
  onStateSnapshot?: (payload: AssistedStateSnapshotPayload) => void;
  onNavigation?: (payload: AssistedNavPayload) => void;
  onInputChange?: (payload: AssistedInputPayload) => void;
  onModalState?: (payload: AssistedModalPayload) => void;
  onTabChange?: (payload: AssistedTabPayload) => void;
  onScroll?: (payload: AssistedScrollPayload) => void;
  onClick?: (payload: AssistedClickPayload) => void;
  onUserMouseMove?: (payload: AssistedMouseMovePayload) => void;
  onUserTapPulse?: (payload: AssistedClickPayload) => void;
}

class AssistedSessionManager {
  private activeChannel: any = null;
  private currentSession: ImpersonationSession | null = null;
  private isPaused: boolean = false;
  private isTargetUserConnected: boolean = false;
  private mode: AssistedOperationMode = 'simulation';
  private syncStatus: AssistedSyncStatus = 'syncing';
  private lastSyncTime: number = Date.now();
  private stateSubscribers: Array<(state: AssistedSessionState) => void> = [];
  private lastLoggedPage: string = '';
  private reconnectAttempts: number = 0;
  private reconnectTimer: any = null;

  /**
   * Assina atualizações de estado local do suporte assistido
   */
  subscribeState(callback: (state: AssistedSessionState) => void) {
    this.stateSubscribers.push(callback);
    callback(this.getStateSnapshot());
    return () => {
      this.stateSubscribers = this.stateSubscribers.filter(cb => cb !== callback);
    };
  }

  private getStateSnapshot(): AssistedSessionState {
    return {
      isPaused: this.isPaused,
      isTargetUserConnected: this.isTargetUserConnected,
      mode: this.mode,
      syncStatus: this.syncStatus,
      lastSyncTime: this.lastSyncTime
    };
  }

  private notifyState() {
    const snapshot = this.getStateSnapshot();
    for (const cb of this.stateSubscribers) {
      try {
        cb(snapshot);
      } catch (e) {
        console.error('[AssistedSession] Erro no callback de estado:', e);
      }
    }
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  getIsTargetUserConnected(): boolean {
    return this.isTargetUserConnected;
  }

  getMode(): AssistedOperationMode {
    return this.mode;
  }

  getSyncStatus(): AssistedSyncStatus {
    return this.syncStatus;
  }

  getCurrentSession(): ImpersonationSession | null {
    return this.currentSession;
  }

  /**
   * Altera o modo entre Acompanhamento (Observador) e Simulação Interativa
   */
  async setMode(newMode: AssistedOperationMode): Promise<void> {
    if (this.mode === newMode) return;
    this.mode = newMode;
    this.notifyState();

    if (this.currentSession) {
      await this.broadcastControl(this.isPaused ? 'paused' : 'active');
      
      // Se alternou para o modo observador, solicita snapshot atual da tela do usuário
      if (newMode === 'observer') {
        this.syncStatus = 'syncing';
        this.notifyState();
        this.requestFullState();
      }

      await auditLogService.logAction({
        action_type: 'ASSISTED_MODE_CHANGED',
        module: 'Segurança / Suporte Assistido',
        description: `Administrador "${this.currentSession.realAdmin.name}" alternou o modo de operação para "${newMode === 'observer' ? 'Acompanhamento Assistido (Observador)' : 'Simulação Interativa'}" na sessão de "${this.currentSession.targetUser.name}".`,
        details: {
          sessionId: this.currentSession.sessionId,
          admin_id: this.currentSession.realAdmin.id,
          target_user_id: this.currentSession.targetUser.id,
          new_mode: newMode
        }
      });
    }
  }

  /**
   * Inicializa a sessão assistida pelo Administrador
   */
  async initAdminSession(session: ImpersonationSession, initialMode: AssistedOperationMode = 'simulation'): Promise<void> {
    this.currentSession = session;
    this.isPaused = false;
    this.isTargetUserConnected = false;
    this.mode = initialMode;
    this.syncStatus = 'syncing';
    this.lastSyncTime = Date.now();
    this.reconnectAttempts = 0;
    this.notifyState();

    if (this.activeChannel) {
      try {
        await supabase.removeChannel(this.activeChannel);
      } catch (e) {}
      this.activeChannel = null;
    }

    const channelName = `assisted_session_${session.sessionId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: `admin_${session.realAdmin.id}` }
      }
    });

    // Rastreia presença do usuário alvo no canal da sessão
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      let foundUser = false;
      for (const key of Object.keys(state)) {
        const presences = (state[key] || []) as any[];
        for (const p of presences) {
          if (p.role === 'target_user' && p.targetUserId === session.targetUser.id) {
            foundUser = true;
            break;
          }
        }
        if (foundUser) break;
      }
      this.isTargetUserConnected = foundUser;
      if (foundUser && this.syncStatus === 'disconnected') {
        this.syncStatus = this.isPaused ? 'paused' : 'connected';
      }
      this.notifyState();
    });

    // Subscrição com tratamento de reconexão
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        this.syncStatus = this.isPaused ? 'paused' : 'connected';
        this.lastSyncTime = Date.now();
        this.reconnectAttempts = 0;
        this.notifyState();

        try {
          await channel.track({
            role: 'admin',
            adminId: session.realAdmin.id,
            adminName: session.realAdmin.name,
            targetUserId: session.targetUser.id,
            sessionId: session.sessionId,
            online: true,
            mode: this.mode,
            isPaused: this.isPaused
          });
          
          // Confirma início da sessão e solicita estado do usuário caso esteja conectado
          this.broadcastControl(this.isPaused ? 'paused' : 'active');
          if (this.mode === 'observer') {
            this.requestFullState();
          }
        } catch (err) {
          console.warn('[AssistedSession] Erro ao registrar presença do admin:', err);
        }
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        this.syncStatus = 'reconnecting';
        this.notifyState();
        this.handleReconnect(session);
      }
    });

    this.activeChannel = channel;

    // Log de auditoria indelével
    await auditLogService.logAction({
      action_type: 'ASSISTED_SESSION_START',
      module: 'Segurança / Suporte Assistido',
      description: `Acompanhamento assistido em tempo real iniciado por "${session.realAdmin.name}" para a conta de "${session.targetUser.name}". Modo inicial: ${initialMode === 'observer' ? 'Observador' : 'Simulação'}.`,
      details: {
        sessionId: session.sessionId,
        admin_id: session.realAdmin.id,
        admin_name: session.realAdmin.name,
        target_user_id: session.targetUser.id,
        target_user_name: session.targetUser.name,
        initial_mode: initialMode,
        started_at: session.startedAt
      }
    });
  }

  private handleReconnect(session: ImpersonationSession) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);

    this.reconnectTimer = setTimeout(async () => {
      if (!this.currentSession) return;
      console.info(`[AssistedSession] Tentando reconectar sessão (tentativa ${this.reconnectAttempts})...`);
      try {
        await this.initAdminSession(session, this.mode);
      } catch (err) {
        console.warn('[AssistedSession] Falha ao reconectar:', err);
      }
    }, delay);
  }

  /**
   * Pausa a transmissão em tempo real
   */
  async pauseTransmission(): Promise<void> {
    if (!this.currentSession || this.isPaused) return;
    this.isPaused = true;
    this.syncStatus = 'paused';
    this.notifyState();
    await this.broadcastControl('paused');

    await auditLogService.logAction({
      action_type: 'ASSISTED_SESSION_PAUSED',
      module: 'Segurança / Suporte Assistido',
      description: `Transmissão do acompanhamento assistido pausada pelo Administrador "${this.currentSession.realAdmin.name}".`,
      details: {
        sessionId: this.currentSession.sessionId,
        admin_id: this.currentSession.realAdmin.id,
        target_user_id: this.currentSession.targetUser.id
      }
    });
  }

  /**
   * Retoma a transmissão em tempo real
   */
  async resumeTransmission(): Promise<void> {
    if (!this.currentSession || !this.isPaused) return;
    this.isPaused = false;
    this.syncStatus = 'connected';
    this.lastSyncTime = Date.now();
    this.notifyState();
    await this.broadcastControl('active');

    // Ao retomar, sincroniza o estado atual
    if (this.mode === 'observer') {
      this.requestFullState();
    }

    await auditLogService.logAction({
      action_type: 'ASSISTED_SESSION_RESUMED',
      module: 'Segurança / Suporte Assistido',
      description: `Transmissão do acompanhamento assistido retomada pelo Administrador "${this.currentSession.realAdmin.name}".`,
      details: {
        sessionId: this.currentSession.sessionId,
        admin_id: this.currentSession.realAdmin.id,
        target_user_id: this.currentSession.targetUser.id
      }
    });
  }

  /**
   * Finaliza a sessão assistida
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    await this.broadcastControl('ended');

    if (this.activeChannel) {
      try {
        await this.activeChannel.untrack();
        await supabase.removeChannel(this.activeChannel);
      } catch (e) {
        console.warn('[AssistedSession] Erro ao remover canal:', e);
      }
      this.activeChannel = null;
    }

    this.currentSession = null;
    this.isPaused = false;
    this.isTargetUserConnected = false;
    this.syncStatus = 'disconnected';
    this.notifyState();
  }

  /**
   * Envia controle de status e modo da sessão
   */
  private async broadcastControl(status: 'active' | 'paused' | 'ended'): Promise<void> {
    if (!this.currentSession) return;
    const payload: AssistedControlPayload = {
      eventId: `ctrl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status,
      mode: this.mode,
      sessionId: this.currentSession.sessionId,
      adminName: this.currentSession.realAdmin.name,
      adminId: this.currentSession.realAdmin.id,
      targetUserId: this.currentSession.targetUser.id,
      timestamp: Date.now()
    };

    if (this.activeChannel) {
      this.activeChannel.send({
        type: 'broadcast',
        event: 'assisted-control',
        payload
      });
    }

    // Emite nos canais globais para alertar o usuário caso ele abra a aba depois
    try {
      const globalCh = supabase.channel('user_impersonation_alerts');
      if (globalCh.state === 'joined') {
        globalCh.send({ type: 'broadcast', event: 'assisted-control', payload });
      }
    } catch (e) {}
  }

  /**
   * Solicita snapshot de estado completo do outro lado (usuário -> admin ou vice-versa)
   */
  requestFullState() {
    if (!this.activeChannel || this.isPaused) return;
    this.activeChannel.send({
      type: 'broadcast',
      event: 'assisted-request-state',
      payload: { timestamp: Date.now() }
    });
  }

  /**
   * Transmite snapshot de estado completo
   */
  broadcastStateSnapshot(data: Omit<AssistedStateSnapshotPayload, 'timestamp'>) {
    if (!this.activeChannel || this.isPaused) return;

    const payload: AssistedStateSnapshotPayload = {
      ...data,
      eventId: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: this.currentSession ? `admin_${this.currentSession.realAdmin.id}` : 'admin',
      source: 'admin',
      timestamp: Date.now()
    };

    this.lastSyncTime = Date.now();
    this.syncStatus = 'connected';
    this.notifyState();

    this.activeChannel.send({
      type: 'broadcast',
      event: 'assisted-state-snapshot',
      payload
    });
  }

  /**
   * Transmite navegação de rota e tela (sincronização de URL e visão)
   */
  broadcastNavigation(data: Omit<AssistedNavPayload, 'timestamp' | 'source' | 'senderId'>) {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedNavPayload = {
      ...data,
      eventId: `nav_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: `admin_${this.currentSession.realAdmin.id}`,
      source: 'admin',
      timestamp: Date.now()
    };

    this.lastSyncTime = Date.now();

    this.activeChannel.send({
      type: 'broadcast',
      event: 'assisted-nav',
      payload
    });

    // Registra log de página acessada para auditoria (evita duplicatas imediatas)
    if (this.lastLoggedPage !== data.path) {
      this.lastLoggedPage = data.path;
      auditLogService.logAction({
        action_type: 'ASSISTED_PAGE_VISITED',
        module: 'Suporte Assistido / Navegação',
        description: `Administrador "${this.currentSession.realAdmin.name}" navegou para "${data.path}" (Visualização: ${data.currentView || 'padrão'}) na sessão de "${this.currentSession.targetUser.name}".`,
        details: {
          sessionId: this.currentSession.sessionId,
          admin_id: this.currentSession.realAdmin.id,
          target_user_id: this.currentSession.targetUser.id,
          path: data.path,
          view: data.currentView,
          block: data.activeBlock,
          tab: data.adminTab,
          visited_at: new Date().toISOString()
        }
      }).catch(err => console.warn('[AssistedSession] Erro ao registrar log de navegação:', err));
    }
  }

  /**
   * Transmite coordenadas do mouse
   */
  broadcastMouseMove(xPct: number, yPct: number, isTouch: boolean = false, userName?: string, source: 'admin' | 'user' = 'admin') {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedMouseMovePayload = {
      eventId: `m_${Date.now()}`,
      xPct,
      yPct,
      isTouch,
      userName: userName || this.currentSession.realAdmin.name,
      senderId: `admin_${this.currentSession.realAdmin.id}`,
      timestamp: Date.now(),
      source
    };

    this.activeChannel.send({
      type: 'broadcast',
      event: 'assisted-mouse',
      payload
    });
  }

  /**
   * Transmite clique/toque de indicação
   */
  broadcastClick(
    xPct: number, 
    yPct: number, 
    targetInfo?: { tag?: string; text?: string; selector?: string; dataAssistId?: string; isTouch?: boolean; userName?: string },
    source: 'admin' | 'user' = 'admin'
  ) {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedClickPayload = {
      eventId: `clk_${Date.now()}`,
      xPct,
      yPct,
      tag: targetInfo?.tag,
      text: targetInfo?.text,
      selector: targetInfo?.selector,
      dataAssistId: targetInfo?.dataAssistId,
      isTouch: targetInfo?.isTouch,
      userName: targetInfo?.userName || this.currentSession.realAdmin.name,
      senderId: `admin_${this.currentSession.realAdmin.id}`,
      timestamp: Date.now(),
      source
    };

    this.activeChannel.send({
      type: 'broadcast',
      event: 'assisted-click',
      payload
    });
  }

  /**
   * Transmite rolagem de tela (scroll)
   */
  broadcastScroll(scrollPctY: number, scrollY: number, source: 'admin' | 'user' = 'admin') {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedScrollPayload = {
      eventId: `sc_${Date.now()}`,
      scrollPctY,
      scrollY,
      senderId: `admin_${this.currentSession.realAdmin.id}`,
      timestamp: Date.now(),
      source
    };

    this.activeChannel.send({
      type: 'broadcast',
      event: 'assisted-scroll',
      payload
    });
  }

  /**
   * Transmite preenchimento de campos de formulário, buscas e filtros
   */
  broadcastInputChange(data: Omit<AssistedInputPayload, 'timestamp' | 'source' | 'senderId'>) {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedInputPayload = {
      ...data,
      eventId: `inp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: `admin_${this.currentSession.realAdmin.id}`,
      source: 'admin',
      timestamp: Date.now()
    };

    this.activeChannel.send({
      type: 'broadcast',
      event: 'assisted-input',
      payload
    });
  }

  /**
   * Transmite abertura, fechamento de modais ou troca de abas
   */
  broadcastModalState(modalId: string, action: 'open' | 'close' | 'change_tab' | 'step_change', data?: any, step?: number | null, source: 'admin' | 'user' = 'admin') {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedModalPayload = {
      eventId: `mod_${Date.now()}`,
      modalId,
      action,
      data,
      step,
      senderId: `admin_${this.currentSession.realAdmin.id}`,
      timestamp: Date.now(),
      source
    };

    this.activeChannel.send({
      type: 'broadcast',
      event: 'assisted-modal',
      payload
    });
  }

  /**
   * Transmite alteração de abas de tela ou filtros
   */
  broadcastTabChange(tabId: string, section?: string, filterValue?: string | null, source: 'admin' | 'user' = 'admin') {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedTabPayload = {
      eventId: `tab_${Date.now()}`,
      tabId,
      section,
      filterValue,
      senderId: `admin_${this.currentSession.realAdmin.id}`,
      timestamp: Date.now(),
      source
    };

    this.activeChannel.send({
      type: 'broadcast',
      event: 'assisted-tab',
      payload
    });
  }

  /**
   * Conecta o cliente do usuário assistido ao canal da sessão para receber comandos e enviar transmissões
   */
  listenAsTargetUser(
    currentUser: User,
    sessionId: string,
    listeners: AssistedSessionListeners
  ): {
    unsubscribe: () => void;
    sendUserStateSnapshot: (snapshot: Omit<AssistedStateSnapshotPayload, 'timestamp' | 'source' | 'senderId'>) => void;
    sendUserNav: (nav: Omit<AssistedNavPayload, 'timestamp' | 'source' | 'senderId'>) => void;
    sendUserInput: (input: Omit<AssistedInputPayload, 'timestamp' | 'source' | 'senderId'>) => void;
    sendUserModal: (modalId: string, action: 'open' | 'close' | 'change_tab' | 'step_change', data?: any, step?: number | null) => void;
    sendUserTab: (tabId: string, section?: string, filterValue?: string | null) => void;
    sendUserScroll: (scrollPctY: number, scrollY: number) => void;
    sendUserClick: (xPct: number, yPct: number, targetInfo?: { tag?: string; text?: string; selector?: string; dataAssistId?: string; isTouch?: boolean; userName?: string }) => void;
    sendUserMouseMove: (xPct: number, yPct: number, isTouch?: boolean) => void;
    sendUserTapPulse: (xPct: number, yPct: number, isTouch?: boolean) => void;
  } {
    if (!sessionId) {
      return {
        unsubscribe: () => {},
        sendUserStateSnapshot: () => {},
        sendUserNav: () => {},
        sendUserInput: () => {},
        sendUserModal: () => {},
        sendUserTab: () => {},
        sendUserScroll: () => {},
        sendUserClick: () => {},
        sendUserMouseMove: () => {},
        sendUserTapPulse: () => {}
      };
    }

    const channelName = `assisted_session_${sessionId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: `target_${currentUser.id}` }
      }
    });

    // Registra presença do usuário assistido para o administrador ver que está online
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await channel.track({
            role: 'target_user',
            targetUserId: currentUser.id,
            targetUserName: currentUser.name,
            targetUsername: currentUser.username,
            sessionId,
            online: true
          });
        } catch (err) {
          console.warn('[AssistedSession] Erro ao registrar presença do usuário:', err);
        }
      }
    });

    // Eventos recebidos do Administrador
    channel.on('broadcast', { event: 'assisted-control' }, (event: any) => {
      const payload: AssistedControlPayload = event.payload;
      if (payload) {
        if (payload.status === 'ended') {
          listeners.onSessionEnded?.();
        } else {
          listeners.onControl?.(payload);
        }
      }
    });

    channel.on('broadcast', { event: 'assisted-request-state' }, () => {
      listeners.onRequestState?.();
    });

    channel.on('broadcast', { event: 'assisted-state-snapshot' }, (event: any) => {
      const payload: AssistedStateSnapshotPayload = event.payload;
      if (payload && payload.source !== 'user') {
        listeners.onStateSnapshot?.(payload);
      }
    });

    channel.on('broadcast', { event: 'assisted-nav' }, (event: any) => {
      const payload: AssistedNavPayload = event.payload;
      if (payload && payload.source !== 'user') {
        listeners.onNavigation?.(payload);
      }
    });

    channel.on('broadcast', { event: 'assisted-mouse' }, (event: any) => {
      const payload: AssistedMouseMovePayload = event.payload;
      if (payload && payload.source !== 'user') {
        listeners.onMouseMove?.(payload);
      }
    });

    channel.on('broadcast', { event: 'assisted-click' }, (event: any) => {
      const payload: AssistedClickPayload = event.payload;
      if (payload && payload.source !== 'user') {
        listeners.onClick?.(payload);
      }
    });

    channel.on('broadcast', { event: 'assisted-scroll' }, (event: any) => {
      const payload: AssistedScrollPayload = event.payload;
      if (payload && payload.source !== 'user') {
        listeners.onScroll?.(payload);
      }
    });

    channel.on('broadcast', { event: 'assisted-input' }, (event: any) => {
      const payload: AssistedInputPayload = event.payload;
      if (payload && payload.source !== 'user') {
        listeners.onInputChange?.(payload);
      }
    });

    channel.on('broadcast', { event: 'assisted-modal' }, (event: any) => {
      const payload: AssistedModalPayload = event.payload;
      if (payload && payload.source !== 'user') {
        listeners.onModalState?.(payload);
      }
    });

    channel.on('broadcast', { event: 'assisted-tab' }, (event: any) => {
      const payload: AssistedTabPayload = event.payload;
      if (payload && payload.source !== 'user') {
        listeners.onTabChange?.(payload);
      }
    });

    const sendUserStateSnapshot = (snapshot: Omit<AssistedStateSnapshotPayload, 'timestamp' | 'source' | 'senderId'>) => {
      channel.send({
        type: 'broadcast',
        event: 'assisted-state-snapshot',
        payload: {
          ...snapshot,
          eventId: `snap_u_${Date.now()}`,
          senderId: `target_${currentUser.id}`,
          source: 'user',
          timestamp: Date.now()
        }
      });
    };

    const sendUserNav = (nav: Omit<AssistedNavPayload, 'timestamp' | 'source' | 'senderId'>) => {
      channel.send({
        type: 'broadcast',
        event: 'assisted-nav',
        payload: {
          ...nav,
          eventId: `nav_u_${Date.now()}`,
          senderId: `target_${currentUser.id}`,
          source: 'user',
          timestamp: Date.now()
        }
      });
    };

    const sendUserInput = (input: Omit<AssistedInputPayload, 'timestamp' | 'source' | 'senderId'>) => {
      channel.send({
        type: 'broadcast',
        event: 'assisted-input',
        payload: {
          ...input,
          eventId: `inp_u_${Date.now()}`,
          senderId: `target_${currentUser.id}`,
          source: 'user',
          timestamp: Date.now()
        }
      });
    };

    const sendUserModal = (modalId: string, action: 'open' | 'close' | 'change_tab' | 'step_change', data?: any, step?: number | null) => {
      channel.send({
        type: 'broadcast',
        event: 'assisted-modal',
        payload: {
          modalId,
          action,
          data,
          step,
          eventId: `mod_u_${Date.now()}`,
          senderId: `target_${currentUser.id}`,
          source: 'user',
          timestamp: Date.now()
        }
      });
    };

    const sendUserTab = (tabId: string, section?: string, filterValue?: string | null) => {
      channel.send({
        type: 'broadcast',
        event: 'assisted-tab',
        payload: {
          tabId,
          section,
          filterValue,
          eventId: `tab_u_${Date.now()}`,
          senderId: `target_${currentUser.id}`,
          source: 'user',
          timestamp: Date.now()
        }
      });
    };

    const sendUserScroll = (scrollPctY: number, scrollY: number) => {
      channel.send({
        type: 'broadcast',
        event: 'assisted-scroll',
        payload: {
          scrollPctY,
          scrollY,
          eventId: `sc_u_${Date.now()}`,
          senderId: `target_${currentUser.id}`,
          source: 'user',
          timestamp: Date.now()
        }
      });
    };

    const sendUserClick = (xPct: number, yPct: number, targetInfo?: { tag?: string; text?: string; selector?: string; dataAssistId?: string; isTouch?: boolean; userName?: string }) => {
      channel.send({
        type: 'broadcast',
        event: 'assisted-click',
        payload: {
          xPct,
          yPct,
          tag: targetInfo?.tag,
          text: targetInfo?.text,
          selector: targetInfo?.selector,
          dataAssistId: targetInfo?.dataAssistId,
          isTouch: targetInfo?.isTouch,
          userName: targetInfo?.userName || currentUser.name,
          eventId: `clk_u_${Date.now()}`,
          senderId: `target_${currentUser.id}`,
          source: 'user',
          timestamp: Date.now()
        }
      });
    };

    const sendUserMouseMove = (xPct: number, yPct: number, isTouch: boolean = false) => {
      channel.send({
        type: 'broadcast',
        event: 'assisted-mouse',
        payload: {
          xPct,
          yPct,
          isTouch,
          userName: currentUser.name,
          eventId: `m_u_${Date.now()}`,
          senderId: `target_${currentUser.id}`,
          source: 'user',
          timestamp: Date.now()
        }
      });
    };

    const sendUserTapPulse = (xPct: number, yPct: number, isTouch: boolean = false) => {
      channel.send({
        type: 'broadcast',
        event: 'assisted-click',
        payload: {
          xPct,
          yPct,
          isTouch,
          userName: currentUser.name,
          eventId: `clk_u_${Date.now()}`,
          senderId: `target_${currentUser.id}`,
          source: 'user',
          timestamp: Date.now()
        }
      });
    };

    return {
      unsubscribe: () => {
        channel.untrack().catch(() => {});
        supabase.removeChannel(channel);
      },
      sendUserStateSnapshot,
      sendUserNav,
      sendUserInput,
      sendUserModal,
      sendUserTab,
      sendUserScroll,
      sendUserClick,
      sendUserMouseMove,
      sendUserTapPulse
    };
  }

  /**
   * Conecta o Administrador como receptor de eventos no Acompanhamento Assistido
   */
  listenAsAdminObserver(
    listeners: AdminSessionObserverListeners
  ): () => void {
    if (!this.activeChannel) return () => {};

    const ch = this.activeChannel;

    ch.on('broadcast', { event: 'assisted-state-snapshot' }, (event: any) => {
      const payload: AssistedStateSnapshotPayload = event.payload;
      if (payload && payload.source === 'user') {
        this.lastSyncTime = Date.now();
        this.syncStatus = 'connected';
        this.notifyState();
        listeners.onStateSnapshot?.(payload);
      }
    });

    ch.on('broadcast', { event: 'assisted-nav' }, (event: any) => {
      const payload: AssistedNavPayload = event.payload;
      if (payload && payload.source === 'user') {
        this.lastSyncTime = Date.now();
        this.syncStatus = 'connected';
        this.notifyState();
        listeners.onNavigation?.(payload);
      }
    });

    ch.on('broadcast', { event: 'assisted-input' }, (event: any) => {
      const payload: AssistedInputPayload = event.payload;
      if (payload && payload.source === 'user') {
        listeners.onInputChange?.(payload);
      }
    });

    ch.on('broadcast', { event: 'assisted-modal' }, (event: any) => {
      const payload: AssistedModalPayload = event.payload;
      if (payload && payload.source === 'user') {
        listeners.onModalState?.(payload);
      }
    });

    ch.on('broadcast', { event: 'assisted-tab' }, (event: any) => {
      const payload: AssistedTabPayload = event.payload;
      if (payload && payload.source === 'user') {
        listeners.onTabChange?.(payload);
      }
    });

    ch.on('broadcast', { event: 'assisted-scroll' }, (event: any) => {
      const payload: AssistedScrollPayload = event.payload;
      if (payload && payload.source === 'user') {
        listeners.onScroll?.(payload);
      }
    });

    ch.on('broadcast', { event: 'assisted-mouse' }, (event: any) => {
      const payload: AssistedMouseMovePayload = event.payload;
      if (payload && payload.source === 'user') {
        listeners.onUserMouseMove?.(payload);
      }
    });

    ch.on('broadcast', { event: 'assisted-click' }, (event: any) => {
      const payload: AssistedClickPayload = event.payload;
      if (payload && payload.source === 'user') {
        // Evento 100% visual de apontamento (ripple/pulso)
        listeners.onUserTapPulse?.(payload);
        listeners.onClick?.(payload);
      }
    });

    return () => {};
  }
}

export const assistedSessionService = new AssistedSessionManager();
