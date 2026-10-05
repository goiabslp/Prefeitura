import { supabase } from './supabaseClient';
import { User } from '../types';
import { auditLogService } from './auditLogService';
import { ImpersonationSession } from './impersonationService';

export type AssistedOperationMode = 'observer' | 'simulation';
export type AssistedSyncStatus = 'connected' | 'syncing' | 'reconnecting' | 'paused' | 'disconnected';

export interface AssistedNavPayload {
  eventId?: string;
  sessionId?: string;
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
  sessionId?: string;
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
  formInputs?: Array<{
    fieldId?: string;
    selector?: string;
    dataAssistId?: string;
    id?: string;
    name?: string;
    value: string;
    checked?: boolean;
    version?: number;
    isSearch?: boolean;
  }>;
  timestamp: number;
  source?: 'admin' | 'user';
  senderId?: string;
}

export interface AssistedMouseMovePayload {
  eventId?: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRole: 'admin' | 'user';
  route: string;
  // Posicionamento relativo ao elemento / âncora (Independente de resolução)
  targetElementId?: string | null;
  dataAssistId?: string | null;
  selector?: string | null;
  elemXRel?: number; // 0.0 a 1.0 (percentual dentro do elemento)
  elemYRel?: number; // 0.0 a 1.0 (percentual dentro do elemento)
  // Posicionamento normalizado por viewport (fallback para áreas livres)
  viewportXRel: number; // 0.0 a 1.0
  viewportYRel: number; // 0.0 a 1.0
  xRelative: number;    // 0-100% relativo ao viewport
  yRelative: number;    // 0-100% relativo ao viewport
  xPct: number;         // Compatibilidade (0-100)
  yPct: number;         // Compatibilidade (0-100)
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  dpr?: number;
  isTouch?: boolean;
  userName?: string;
  timestamp: number;
  source: 'admin' | 'user';
}

export interface AssistedClickPayload {
  eventId: string; // clickEventId único e efêmero
  sessionId?: string;
  targetElementId?: string | null;
  dataAssistId?: string | null;
  selector?: string | null;
  elemXRel?: number;
  elemYRel?: number;
  viewportXRel?: number;
  viewportYRel?: number;
  xPct: number;
  yPct: number;
  xRelative?: number;
  yRelative?: number;
  tag?: string;
  text?: string;
  id?: string;
  name?: string;
  isTouch?: boolean;
  userName?: string;
  timestamp: number;
  source?: 'admin' | 'user';
  senderId?: string;
}

export interface AssistedScrollPayload {
  eventId?: string;
  sessionId?: string;
  scrollPctY: number;
  scrollY: number;
  timestamp: number;
  source?: 'admin' | 'user';
  senderId?: string;
}

export interface AssistedInputPayload {
  eventId: string;
  sessionId?: string;
  fieldId: string; // Identificador estável (data-assist-id, id, name ou selector)
  selector?: string;
  dataAssistId?: string;
  name?: string;
  id?: string;
  value: string;
  checked?: boolean;
  tagName?: string;
  version: number; // Versão incremental (v1, v2, v3...)
  isSearch?: boolean;
  timestamp: number;
  source: 'admin' | 'user';
  senderId?: string;
}

export interface AssistedModalPayload {
  eventId?: string;
  sessionId?: string;
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
  sessionId?: string;
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

/**
 * Utilitário para atualizar inputs controlados pelo React via DOM nativo
 */
export function setReactInputValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
  checked?: boolean
) {
  if (!element) return;

  if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
    const nativeCheckboxSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked')?.set;
    if (nativeCheckboxSetter) {
      nativeCheckboxSetter.call(element, !!checked);
    } else {
      element.checked = !!checked;
    }
  } else {
    const proto = element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;

    const nativeValueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeValueSetter) {
      nativeValueSetter.call(element, value);
    } else {
      element.value = value;
    }
  }

  // Dispara eventos nativos borbulhantes para o React processar o onChange
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Calcula a posição relativa precisa do cursor em relação a elementos na interface
 */
export function computeElementRelativePosition(
  clientX: number,
  clientY: number,
  source: 'admin' | 'user' = 'admin'
): {
  targetElementId?: string | null;
  dataAssistId?: string | null;
  selector?: string | null;
  elemXRel?: number;
  elemYRel?: number;
  viewportXRel: number;
  viewportYRel: number;
  scrollX: number;
  scrollY: number;
  dpr: number;
  viewportWidth: number;
  viewportHeight: number;
} {
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const scrollX = typeof window !== 'undefined' ? (window.scrollX || document.documentElement.scrollLeft || 0) : 0;
  const scrollY = typeof window !== 'undefined' ? (window.scrollY || document.documentElement.scrollTop || 0) : 0;
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  const viewportXRel = Math.max(0, Math.min(1, clientX / Math.max(1, viewportW)));
  const viewportYRel = Math.max(0, Math.min(1, clientY / Math.max(1, viewportH)));

  if (typeof document === 'undefined') {
    return {
      viewportXRel,
      viewportYRel,
      scrollX,
      scrollY,
      dpr,
      viewportWidth: viewportW,
      viewportHeight: viewportH
    };
  }

  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  if (!el) {
    return {
      viewportXRel,
      viewportYRel,
      scrollX,
      scrollY,
      dpr,
      viewportWidth: viewportW,
      viewportHeight: viewportH
    };
  }

  // Procura âncora mais próxima estável
  const anchor = el.closest('[data-assist-id], [id], button, input, select, textarea, a, [role="button"], [role="tab"], tr, [data-card]') as HTMLElement | null || el;

  const dataAssistId = anchor.getAttribute('data-assist-id') || undefined;
  const id = anchor.id && !anchor.id.startsWith('react-') ? anchor.id : undefined;
  let selector: string | undefined = undefined;

  if (dataAssistId) selector = `[data-assist-id="${dataAssistId}"]`;
  else if (id) selector = `#${id}`;
  else {
    const name = anchor.getAttribute('name');
    if (name) selector = `[name="${name}"]`;
    else if (anchor.getAttribute('data-tab')) selector = `[data-tab="${anchor.getAttribute('data-tab')}"]`;
  }

  const rect = anchor.getBoundingClientRect();
  let elemXRel: number | undefined = undefined;
  let elemYRel: number | undefined = undefined;

  if (rect.width > 0 && rect.height > 0) {
    elemXRel = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    elemYRel = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
  }

  return {
    targetElementId: id || null,
    dataAssistId: dataAssistId || null,
    selector: selector || null,
    elemXRel,
    elemYRel,
    viewportXRel,
    viewportYRel,
    scrollX,
    scrollY,
    dpr,
    viewportWidth: viewportW,
    viewportHeight: viewportH
  };
}

/**
 * Reconstrói a posição exata em pixels na tela de destino baseada no elemento relativo
 */
export function resolveElementRelativePosition(payload: {
  targetElementId?: string | null;
  dataAssistId?: string | null;
  selector?: string | null;
  elemXRel?: number;
  elemYRel?: number;
  viewportXRel?: number;
  viewportYRel?: number;
  xPct?: number;
  yPct?: number;
}): { pixelX: number; pixelY: number; xPct: number; yPct: number } {
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 1080;

  if (typeof document === 'undefined') {
    const xPct = payload.xPct ?? (payload.viewportXRel ? payload.viewportXRel * 100 : 50);
    const yPct = payload.yPct ?? (payload.viewportYRel ? payload.viewportYRel * 100 : 50);
    return { pixelX: (xPct / 100) * winW, pixelY: (yPct / 100) * winH, xPct, yPct };
  }

  let targetEl: HTMLElement | null = null;

  if (payload.dataAssistId) {
    targetEl = document.querySelector(`[data-assist-id="${payload.dataAssistId}"]`);
  }
  if (!targetEl && payload.targetElementId) {
    targetEl = document.getElementById(payload.targetElementId);
  }
  if (!targetEl && payload.selector) {
    try { targetEl = document.querySelector(payload.selector); } catch (e) {}
  }

  if (targetEl && payload.elemXRel !== undefined && payload.elemYRel !== undefined) {
    const rect = targetEl.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const pixelX = rect.left + (payload.elemXRel * rect.width);
      const pixelY = rect.top + (payload.elemYRel * rect.height);
      const xPct = Math.max(0, Math.min(100, (pixelX / winW) * 100));
      const yPct = Math.max(0, Math.min(100, (pixelY / winH) * 100));
      return { pixelX, pixelY, xPct, yPct };
    }
  }

  // Fallback: normalizado por viewport
  const vpX = payload.viewportXRel !== undefined ? payload.viewportXRel : ((payload.xPct || 0) / 100);
  const vpY = payload.viewportYRel !== undefined ? payload.viewportYRel : ((payload.yPct || 0) / 100);
  const pixelX = vpX * winW;
  const pixelY = vpY * winH;
  return { pixelX, pixelY, xPct: vpX * 100, yPct: vpY * 100 };
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

  // Mapa de versões incrementais de campos para garantir idempotência e ordem estrita
  private fieldVersionsMap: Map<string, number> = new Map();
  private localFieldSequence: Map<string, number> = new Map();

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

  async setMode(newMode: AssistedOperationMode): Promise<void> {
    if (this.mode === newMode) return;
    this.mode = newMode;
    this.notifyState();

    if (this.currentSession) {
      await this.broadcastControl(this.isPaused ? 'paused' : 'active');
      
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

  async initAdminSession(session: ImpersonationSession, initialMode: AssistedOperationMode = 'simulation'): Promise<void> {
    this.currentSession = session;
    this.isPaused = false;
    this.isTargetUserConnected = false;
    this.mode = initialMode;
    this.syncStatus = 'syncing';
    this.lastSyncTime = Date.now();
    this.reconnectAttempts = 0;
    this.fieldVersionsMap.clear();
    this.localFieldSequence.clear();
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
        broadcast: { self: true },
        presence: { key: `admin_${session.realAdmin.id}` }
      }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      let foundUser = false;
      for (const key of Object.keys(state)) {
        const presences = (state[key] || []) as any[];
        for (const p of presences) {
          if (p.role === 'target_user' && String(p.targetUserId).toLowerCase() === String(session.targetUser.id).toLowerCase()) {
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
          
          await this.broadcastControl(this.isPaused ? 'paused' : 'active');
          this.requestFullState();
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
      console.info(`[AssistedSession] Tentando reconectar sessão assistida (tentativa ${this.reconnectAttempts})...`);
      try {
        await this.initAdminSession(session, this.mode);
      } catch (err) {
        console.warn('[AssistedSession] Falha ao reconectar:', err);
      }
    }, delay);
  }

  async pauseTransmission(): Promise<void> {
    if (!this.currentSession || this.isPaused) return;
    this.isPaused = true;
    this.syncStatus = 'paused';
    this.notifyState();
    await this.broadcastControl('paused');
  }

  async resumeTransmission(): Promise<void> {
    if (!this.currentSession || !this.isPaused) return;
    this.isPaused = false;
    this.syncStatus = 'connected';
    this.lastSyncTime = Date.now();
    this.notifyState();
    await this.broadcastControl('active');
    this.requestFullState();
  }

  async endSession(): Promise<void> {
    if (!this.currentSession) return;
    const session = this.currentSession;
    await this.broadcastControl('ended');

    if (this.activeChannel) {
      try {
        await this.activeChannel.untrack();
        await supabase.removeChannel(this.activeChannel);
      } catch (e) {}
      this.activeChannel = null;
    }

    this.currentSession = null;
    this.isPaused = false;
    this.isTargetUserConnected = false;
    this.syncStatus = 'disconnected';
    this.fieldVersionsMap.clear();
    this.localFieldSequence.clear();
    this.notifyState();
  }

  private async broadcastControl(status: 'active' | 'paused' | 'ended'): Promise<void> {
    if (!this.currentSession) return;

    const payload: AssistedControlPayload = {
      eventId: `ctrl_${Date.now()}`,
      status,
      mode: this.mode,
      sessionId: this.currentSession.sessionId,
      adminName: this.currentSession.realAdmin.name,
      adminId: this.currentSession.realAdmin.id,
      targetUserId: this.currentSession.targetUser.id,
      timestamp: Date.now()
    };

    if (this.activeChannel) {
      await this.activeChannel.send({
        type: 'broadcast',
        event: 'assisted-control',
        payload
      });
    }

    try {
      const globalCh = supabase.channel('user_impersonation_alerts', { config: { broadcast: { self: true } } });
      globalCh.send({ type: 'broadcast', event: 'assisted-control', payload });
    } catch (e) {}
  }

  requestFullState() {
    if (!this.activeChannel || this.isPaused) return;
    this.activeChannel.send({
      type: 'broadcast',
      event: 'assisted-request-state',
      payload: { 
        sessionId: this.currentSession?.sessionId,
        timestamp: Date.now() 
      }
    });
  }

  broadcastStateSnapshot(data: Omit<AssistedStateSnapshotPayload, 'timestamp' | 'source' | 'senderId'>) {
    if (!this.activeChannel || this.isPaused) return;

    const payload: AssistedStateSnapshotPayload = {
      ...data,
      sessionId: this.currentSession?.sessionId,
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

  broadcastNavigation(data: Omit<AssistedNavPayload, 'timestamp' | 'source' | 'senderId'>) {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedNavPayload = {
      ...data,
      sessionId: this.currentSession.sessionId,
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
  }

  /**
   * Transmite movimentação do cursor do Administrador com elemento relativo preciso
   */
  broadcastMouseMove(
    clientX: number,
    clientY: number,
    isTouch: boolean = false,
    userName?: string,
    source: 'admin' | 'user' = 'admin'
  ) {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const relPos = computeElementRelativePosition(clientX, clientY, source);
    const currentRoute = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/';

    const payload: AssistedMouseMovePayload = {
      eventId: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId: this.currentSession.sessionId,
      senderId: `admin_${this.currentSession.realAdmin.id}`,
      senderName: userName || this.currentSession.realAdmin.name,
      senderRole: 'admin',
      route: currentRoute,
      targetElementId: relPos.targetElementId,
      dataAssistId: relPos.dataAssistId,
      selector: relPos.selector,
      elemXRel: relPos.elemXRel,
      elemYRel: relPos.elemYRel,
      viewportXRel: relPos.viewportXRel,
      viewportYRel: relPos.viewportYRel,
      xRelative: relPos.viewportXRel * 100,
      yRelative: relPos.viewportYRel * 100,
      xPct: relPos.viewportXRel * 100,
      yPct: relPos.viewportYRel * 100,
      scrollX: relPos.scrollX,
      scrollY: relPos.scrollY,
      viewportWidth: relPos.viewportWidth,
      viewportHeight: relPos.viewportHeight,
      dpr: relPos.dpr,
      isTouch,
      userName: userName || this.currentSession.realAdmin.name,
      timestamp: Date.now(),
      source
    };

    this.activeChannel.send({
      type: 'broadcast',
      event: 'assisted-mouse',
      payload
    });

    this.activeChannel.send({
      type: 'broadcast',
      event: 'CURSOR_MOVED',
      payload
    });
  }

  /**
   * Transmite clique com identificador efêmero e posição relativa precisa
   */
  broadcastClick(
    clientX: number,
    clientY: number,
    targetInfo?: { tag?: string; text?: string; selector?: string; dataAssistId?: string; id?: string; name?: string; isTouch?: boolean; userName?: string },
    source: 'admin' | 'user' = 'admin'
  ) {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const relPos = computeElementRelativePosition(clientX, clientY, source);

    const payload: AssistedClickPayload = {
      eventId: `clk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId: this.currentSession.sessionId,
      targetElementId: relPos.targetElementId || targetInfo?.id || null,
      dataAssistId: relPos.dataAssistId || targetInfo?.dataAssistId || null,
      selector: relPos.selector || targetInfo?.selector || null,
      elemXRel: relPos.elemXRel,
      elemYRel: relPos.elemYRel,
      viewportXRel: relPos.viewportXRel,
      viewportYRel: relPos.viewportYRel,
      xPct: relPos.viewportXRel * 100,
      yPct: relPos.viewportYRel * 100,
      xRelative: relPos.viewportXRel * 100,
      yRelative: relPos.viewportYRel * 100,
      tag: targetInfo?.tag,
      text: targetInfo?.text,
      id: targetInfo?.id,
      name: targetInfo?.name,
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

  broadcastScroll(scrollPctY: number, scrollY: number, source: 'admin' | 'user' = 'admin') {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedScrollPayload = {
      eventId: `sc_${Date.now()}`,
      sessionId: this.currentSession.sessionId,
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
   * Transmite preenchimento de formulário com versão incremental e fieldId estável
   */
  broadcastInputChange(data: {
    fieldId?: string;
    selector?: string;
    dataAssistId?: string;
    name?: string;
    id?: string;
    value: string;
    checked?: boolean;
    tagName?: string;
    isSearch?: boolean;
  }) {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const fieldKey = data.fieldId || data.dataAssistId || data.id || data.name || data.selector || 'unknown_field';
    const nextVersion = (this.localFieldSequence.get(fieldKey) || 0) + 1;
    this.localFieldSequence.set(fieldKey, nextVersion);

    const payload: AssistedInputPayload = {
      ...data,
      fieldId: fieldKey,
      version: nextVersion,
      sessionId: this.currentSession.sessionId,
      eventId: `inp_${Date.now()}_v${nextVersion}`,
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

  broadcastModalState(modalId: string, action: 'open' | 'close' | 'change_tab' | 'step_change', data?: any, step?: number | null, source: 'admin' | 'user' = 'admin') {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedModalPayload = {
      eventId: `mod_${Date.now()}`,
      sessionId: this.currentSession.sessionId,
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

  broadcastTabChange(tabId: string, section?: string, filterValue?: string | null, source: 'admin' | 'user' = 'admin') {
    if (!this.currentSession || this.isPaused || !this.activeChannel) return;

    const payload: AssistedTabPayload = {
      eventId: `tab_${Date.now()}`,
      sessionId: this.currentSession.sessionId,
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
   * Conecta o cliente do usuário assistido ao canal da sessão
   */
  listenAsTargetUser(
    currentUser: User,
    sessionId: string,
    listeners: AssistedSessionListeners
  ): {
    unsubscribe: () => void;
    sendUserStateSnapshot: (snapshot: Omit<AssistedStateSnapshotPayload, 'timestamp' | 'source' | 'senderId'>) => void;
    sendUserNav: (nav: Omit<AssistedNavPayload, 'timestamp' | 'source' | 'senderId'>) => void;
    sendUserInput: (input: Omit<AssistedInputPayload, 'timestamp' | 'source' | 'senderId' | 'eventId' | 'version'>) => void;
    sendUserModal: (modalId: string, action: 'open' | 'close' | 'change_tab' | 'step_change', data?: any, step?: number | null) => void;
    sendUserTab: (tabId: string, section?: string, filterValue?: string | null) => void;
    sendUserScroll: (scrollPctY: number, scrollY: number) => void;
    sendUserClick: (clientX: number, clientY: number, targetInfo?: { tag?: string; text?: string; selector?: string; dataAssistId?: string; isTouch?: boolean; userName?: string }) => void;
    sendUserMouseMove: (clientX: number, clientY: number, isTouch?: boolean) => void;
    sendUserTapPulse: (clientX: number, clientY: number, isTouch?: boolean) => void;
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
        broadcast: { self: true },
        presence: { key: `target_${currentUser.id}` }
      }
    });

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

    const handleAdminMouse = (event: any) => {
      const payload: AssistedMouseMovePayload = event.payload;
      if (payload && payload.source !== 'user') {
        listeners.onMouseMove?.(payload);
      }
    };
    channel.on('broadcast', { event: 'assisted-mouse' }, handleAdminMouse);
    channel.on('broadcast', { event: 'CURSOR_MOVED' }, handleAdminMouse);

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
        // Validação de Versão Incremental: descarta pacotes antigos fora de ordem
        const lastVer = this.fieldVersionsMap.get(payload.fieldId) || 0;
        if (payload.version > lastVer) {
          this.fieldVersionsMap.set(payload.fieldId, payload.version);
          listeners.onInputChange?.(payload);
        }
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
          sessionId,
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
          sessionId,
          eventId: `nav_u_${Date.now()}`,
          senderId: `target_${currentUser.id}`,
          source: 'user',
          timestamp: Date.now()
        }
      });
    };

    const sendUserInput = (input: Omit<AssistedInputPayload, 'timestamp' | 'source' | 'senderId' | 'eventId'>) => {
      const fieldKey = input.fieldId || input.dataAssistId || input.id || input.name || input.selector || 'user_field';
      const nextVer = (this.localFieldSequence.get(fieldKey) || 0) + 1;
      this.localFieldSequence.set(fieldKey, nextVer);

      channel.send({
        type: 'broadcast',
        event: 'assisted-input',
        payload: {
          ...input,
          fieldId: fieldKey,
          version: nextVer,
          sessionId,
          eventId: `inp_u_${Date.now()}_v${nextVer}`,
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
          sessionId,
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
          sessionId,
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
          sessionId,
          scrollPctY,
          scrollY,
          eventId: `sc_u_${Date.now()}`,
          senderId: `target_${currentUser.id}`,
          source: 'user',
          timestamp: Date.now()
        }
      });
    };

    const sendUserClick = (clientX: number, clientY: number, targetInfo?: { tag?: string; text?: string; selector?: string; dataAssistId?: string; isTouch?: boolean; userName?: string }) => {
      const relPos = computeElementRelativePosition(clientX, clientY, 'user');

      channel.send({
        type: 'broadcast',
        event: 'assisted-click',
        payload: {
          sessionId,
          targetElementId: relPos.targetElementId || null,
          dataAssistId: relPos.dataAssistId || targetInfo?.dataAssistId || null,
          selector: relPos.selector || targetInfo?.selector || null,
          elemXRel: relPos.elemXRel,
          elemYRel: relPos.elemYRel,
          viewportXRel: relPos.viewportXRel,
          viewportYRel: relPos.viewportYRel,
          xPct: relPos.viewportXRel * 100,
          yPct: relPos.viewportYRel * 100,
          xRelative: relPos.viewportXRel * 100,
          yRelative: relPos.viewportYRel * 100,
          tag: targetInfo?.tag,
          text: targetInfo?.text,
          isTouch: targetInfo?.isTouch,
          userName: targetInfo?.userName || currentUser.name,
          eventId: `clk_u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          senderId: `target_${currentUser.id}`,
          source: 'user',
          timestamp: Date.now()
        }
      });
    };

    const sendUserMouseMove = (clientX: number, clientY: number, isTouch: boolean = false) => {
      const relPos = computeElementRelativePosition(clientX, clientY, 'user');
      const currentRoute = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/';

      const payload: AssistedMouseMovePayload = {
        eventId: `m_u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sessionId,
        senderId: `target_${currentUser.id}`,
        senderName: currentUser.name,
        senderRole: 'user',
        route: currentRoute,
        targetElementId: relPos.targetElementId,
        dataAssistId: relPos.dataAssistId,
        selector: relPos.selector,
        elemXRel: relPos.elemXRel,
        elemYRel: relPos.elemYRel,
        viewportXRel: relPos.viewportXRel,
        viewportYRel: relPos.viewportYRel,
        xRelative: relPos.viewportXRel * 100,
        yRelative: relPos.viewportYRel * 100,
        xPct: relPos.viewportXRel * 100,
        yPct: relPos.viewportYRel * 100,
        scrollX: relPos.scrollX,
        scrollY: relPos.scrollY,
        viewportWidth: relPos.viewportWidth,
        viewportHeight: relPos.viewportHeight,
        dpr: relPos.dpr,
        isTouch,
        userName: currentUser.name,
        timestamp: Date.now(),
        source: 'user'
      };

      channel.send({
        type: 'broadcast',
        event: 'assisted-mouse',
        payload
      });

      channel.send({
        type: 'broadcast',
        event: 'CURSOR_MOVED',
        payload
      });
    };

    const sendUserTapPulse = (clientX: number, clientY: number, isTouch: boolean = false) => {
      sendUserClick(clientX, clientY, { isTouch, userName: currentUser.name });
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
        const lastVer = this.fieldVersionsMap.get(payload.fieldId) || 0;
        if (payload.version > lastVer) {
          this.fieldVersionsMap.set(payload.fieldId, payload.version);
          listeners.onInputChange?.(payload);
        }
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

    const handleUserMouse = (event: any) => {
      const payload: AssistedMouseMovePayload = event.payload;
      if (payload && payload.source === 'user') {
        listeners.onUserMouseMove?.(payload);
      }
    };
    ch.on('broadcast', { event: 'assisted-mouse' }, handleUserMouse);
    ch.on('broadcast', { event: 'CURSOR_MOVED' }, handleUserMouse);

    ch.on('broadcast', { event: 'assisted-click' }, (event: any) => {
      const payload: AssistedClickPayload = event.payload;
      if (payload && payload.source === 'user') {
        listeners.onUserTapPulse?.(payload);
        listeners.onClick?.(payload);
      }
    });

    return () => {};
  }
}

export const assistedSessionService = new AssistedSessionManager();
