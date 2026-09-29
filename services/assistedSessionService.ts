import { supabase } from './supabaseClient';
import { User } from '../types';
import { auditLogService } from './auditLogService';
import { ImpersonationSession } from './impersonationService';

export interface AssistedNavPayload {
  path: string;
  currentView: string;
  activeBlock: string | null;
  adminTab: string | null;
  currentSubView?: string | null;
  timestamp: number;
}

export interface AssistedMouseMovePayload {
  xPct: number;
  yPct: number;
  timestamp: number;
}

export interface AssistedClickPayload {
  xPct: number;
  yPct: number;
  tag?: string;
  text?: string;
  selector?: string;
  timestamp: number;
}

export interface AssistedScrollPayload {
  scrollPctY: number;
  scrollY: number;
  timestamp: number;
}

export interface AssistedInputPayload {
  selector?: string;
  name?: string;
  id?: string;
  value: string;
  checked?: boolean;
  timestamp: number;
}

export interface AssistedModalPayload {
  modalId?: string;
  action: 'open' | 'close' | 'change_tab';
  data?: any;
  timestamp: number;
}

export interface AssistedControlPayload {
  status: 'active' | 'paused' | 'ended';
  sessionId: string;
  adminName: string;
  adminId: string;
  targetUserId: string;
  timestamp: number;
}

export interface AssistedSessionListeners {
  onControl?: (payload: AssistedControlPayload) => void;
  onNavigation?: (payload: AssistedNavPayload) => void;
  onMouseMove?: (payload: AssistedMouseMovePayload) => void;
  onClick?: (payload: AssistedClickPayload) => void;
  onScroll?: (payload: AssistedScrollPayload) => void;
  onInputChange?: (payload: AssistedInputPayload) => void;
  onModalState?: (payload: AssistedModalPayload) => void;
  onPresenceChange?: (hasTargetUserOnline: boolean) => void;
  onSessionEnded?: () => void;
}

class AssistedSessionManager {
  private activeChannel: any = null;
  private currentSession: ImpersonationSession | null = null;
  private isPaused: boolean = false;
  private isTargetUserConnected: boolean = false;
  private stateSubscribers: Array<(state: { isPaused: boolean; isTargetUserConnected: boolean }) => void> = [];
  private lastLoggedPage: string = '';

  /**
   * Assina atualizações de estado local do suporte assistido
   */
  subscribeState(callback: (state: { isPaused: boolean; isTargetUserConnected: boolean }) => void) {
    this.stateSubscribers.push(callback);
    callback({ isPaused: this.isPaused, isTargetUserConnected: this.isTargetUserConnected });
    return () => {
      this.stateSubscribers = this.stateSubscribers.filter(cb => cb !== callback);
    };
  }

  private notifyState() {
    for (const cb of this.stateSubscribers) {
      try {
        cb({ isPaused: this.isPaused, isTargetUserConnected: this.isTargetUserConnected });
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

  getCurrentSession(): ImpersonationSession | null {
    return this.currentSession;
  }

  /**
   * Inicializa a sessão assistida pelo Administrador
   */
  async initAdminSession(session: ImpersonationSession): Promise<void> {
    this.currentSession = session;
    this.isPaused = false;
    this.isTargetUserConnected = false;
    this.notifyState();

    if (this.activeChannel) {
      await supabase.removeChannel(this.activeChannel);
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
      this.notifyState();
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await channel.track({
            role: 'admin',
            adminId: session.realAdmin.id,
            adminName: session.realAdmin.name,
            targetUserId: session.targetUser.id,
            sessionId: session.sessionId,
            online: true,
            isPaused: this.isPaused
          });
          // Dispara broadcast inicial confirmando início
          this.broadcastControl('active');
        } catch (err) {
          console.warn('[AssistedSession] Erro ao registrar presença do admin:', err);
        }
      }
    });

    this.activeChannel = channel;

    // Log de auditoria
    await auditLogService.logAction({
      action_type: 'ASSISTED_SESSION_START',
      module: 'Segurança / Suporte Assistido',
      description: `Acompanhamento assistido em tempo real iniciado por "${session.realAdmin.name}" para a conta de "${session.targetUser.name}".`,
      details: {
        sessionId: session.sessionId,
        admin_id: session.realAdmin.id,
        admin_name: session.realAdmin.name,
        target_user_id: session.targetUser.id,
        target_user_name: session.targetUser.name,
        started_at: session.startedAt
      }
    });
  }

  /**
   * Pausa a transmissão em tempo real
   */
  async pauseTransmission(): Promise<void> {
    if (!this.currentSession || this.isPaused) return;
    this.isPaused = true;
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
    this.notifyState();
    await this.broadcastControl('active');

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
    const session = this.currentSession;
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
    this.notifyState();
  }

  /**
   * Envia controle de status da sessão (ativo, pausado, encerrado)
   */
  private async broadcastControl(status: 'active' | 'paused' | 'ended'): Promise<void> {
    if (!this.currentSession) return;
    const payload: AssistedControlPayload = {
      status,
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

    // Também emite nos canais globais para alertar o usuário se ele estiver conectando
    try {
      const globalCh = supabase.channel('user_impersonation_alerts');
      if (globalCh.state === 'joined') {
        globalCh.send({ type: 'broadcast', event: 'assisted-control', payload });
      }
    } catch (e) {
      // Ignora falhas em canais secundários
    }
  }

  /**
   * Transmite navegação de rota e tela (sincronização de URL)
   */
  broadcastNavigation(data: Omit<AssistedNavPayload, 'timestamp'>) {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedNavPayload = {
      ...data,
      timestamp: Date.now()
    };

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
        description: `Administrador navegou para a página "${data.path}" (Visualização: ${data.currentView || 'padrão'}) durante o suporte assistido.`,
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
   * Transmite coordenadas do mouse do administrador
   */
  broadcastMouseMove(xPct: number, yPct: number) {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedMouseMovePayload = {
      xPct,
      yPct,
      timestamp: Date.now()
    };

    this.activeChannel.send({
      type: 'broadcast',
      event: 'assisted-mouse',
      payload
    });
  }

  /**
   * Transmite clique e interação
   */
  broadcastClick(xPct: number, yPct: number, targetInfo?: { tag?: string; text?: string; selector?: string }) {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedClickPayload = {
      xPct,
      yPct,
      tag: targetInfo?.tag,
      text: targetInfo?.text,
      selector: targetInfo?.selector,
      timestamp: Date.now()
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
  broadcastScroll(scrollPctY: number, scrollY: number) {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedScrollPayload = {
      scrollPctY,
      scrollY,
      timestamp: Date.now()
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
  broadcastInputChange(data: Omit<AssistedInputPayload, 'timestamp'>) {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedInputPayload = {
      ...data,
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
  broadcastModalState(modalId: string, action: 'open' | 'close' | 'change_tab', data?: any) {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedModalPayload = {
      modalId,
      action,
      data,
      timestamp: Date.now()
    };

    this.activeChannel.send({
      type: 'broadcast',
      event: 'assisted-modal',
      payload
    });
  }

  /**
   * Conecta o usuário assistido ao canal da sessão para receber a transmissão
   */
  listenAsTargetUser(
    currentUser: User,
    sessionId: string,
    listeners: AssistedSessionListeners
  ): () => void {
    if (!sessionId) return () => {};

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

    channel.on('broadcast', { event: 'assisted-nav' }, (event: any) => {
      const payload: AssistedNavPayload = event.payload;
      if (payload) {
        listeners.onNavigation?.(payload);
      }
    });

    channel.on('broadcast', { event: 'assisted-mouse' }, (event: any) => {
      const payload: AssistedMouseMovePayload = event.payload;
      if (payload) {
        listeners.onMouseMove?.(payload);
      }
    });

    channel.on('broadcast', { event: 'assisted-click' }, (event: any) => {
      const payload: AssistedClickPayload = event.payload;
      if (payload) {
        listeners.onClick?.(payload);
      }
    });

    channel.on('broadcast', { event: 'assisted-scroll' }, (event: any) => {
      const payload: AssistedScrollPayload = event.payload;
      if (payload) {
        listeners.onScroll?.(payload);
      }
    });

    channel.on('broadcast', { event: 'assisted-input' }, (event: any) => {
      const payload: AssistedInputPayload = event.payload;
      if (payload) {
        listeners.onInputChange?.(payload);
      }
    });

    channel.on('broadcast', { event: 'assisted-modal' }, (event: any) => {
      const payload: AssistedModalPayload = event.payload;
      if (payload) {
        listeners.onModalState?.(payload);
      }
    });

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }
}

export const assistedSessionService = new AssistedSessionManager();
