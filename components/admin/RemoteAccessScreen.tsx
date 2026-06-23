import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, Monitor, X, ShieldCheck, AlertTriangle, Play, Square, Copy, Check, Loader2, Info, ArrowLeft, RefreshCw, Maximize2, Minimize2, MousePointer
} from 'lucide-react';
import { User } from '../../types';
import { TwoFactorModal } from '../TwoFactorModal';
import { remoteAccessService, RemoteAccessState } from '../../services/remoteAccessService';

interface RemoteAccessScreenProps {
  currentUser: User;
  onBack: () => void;
  onTabChange?: (tab: string) => void;
}

export const RemoteAccessScreen: React.FC<RemoteAccessScreenProps> = ({ 
  currentUser, 
  onBack,
  onTabChange 
}) => {
  const [serviceState, setServiceState] = useState<RemoteAccessState>(remoteAccessService.getState());
  const [inputCode, setInputCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const videoLocalRef = useRef<HTMLVideoElement>(null);
  const videoRemoteRef = useRef<HTMLVideoElement>(null);

  // Subscribe to remoteAccessService state changes
  useEffect(() => {
    const handleStateChange = (state: RemoteAccessState) => {
      setServiceState(state);
      if (state.errorMsg) {
        setErrorMsg(state.errorMsg);
      }
    };
    remoteAccessService.subscribe(handleStateChange);
    return () => remoteAccessService.unsubscribe(handleStateChange);
  }, []);

  // Bind video element streams when connection status changes or modal opens
  useEffect(() => {
    const isSessionActive = serviceState.connectionState === 'connected' || serviceState.connectionState === 'sharing';
    if (isSessionActive) {
      if (serviceState.mode === 'host' && videoLocalRef.current && remoteAccessService.localStream) {
        videoLocalRef.current.srcObject = remoteAccessService.localStream;
      }
      if (serviceState.mode === 'client' && videoRemoteRef.current && remoteAccessService.remoteStream) {
        videoRemoteRef.current.srcObject = remoteAccessService.remoteStream;
      }
    }
  }, [serviceState.connectionState, serviceState.mode]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(serviceState.accessCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Host Flow
  const startHostFlow = () => {
    if (!currentUser.twoFactorSecret && !currentUser.twoFactorSecret2) {
      setErrorMsg("Você precisa habilitar o autenticador 2FA em seu perfil para poder gerar códigos de acesso remoto.");
      return;
    }
    setErrorMsg("");
    setIs2FAModalOpen(true);
  };

  const on2FAVerified = async () => {
    setIs2FAModalOpen(false);
    try {
      await remoteAccessService.startHost(currentUser);
    } catch (err) {
      // Error is set in the service state
    }
  };

  // Client Flow
  const startClientFlow = async () => {
    if (inputCode.length !== 6) {
      setErrorMsg("Digite um código de 6 dígitos válido.");
      return;
    }
    setErrorMsg("");
    try {
      await remoteAccessService.startClient(inputCode);
    } catch (err) {
      // Handled in service state
    }
  };

  const handleStopSession = () => {
    remoteAccessService.stopSession();
    setInputCode('');
    setErrorMsg('');
    setIsFullscreen(false);
  };

  // Mouse Control Event Handlers for Client (Viewer)
  const handleMouseMove = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (serviceState.connectionState !== 'connected') return;
    const video = e.currentTarget;
    const rect = video.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    remoteAccessService.sendMouseMove(x, y, currentUser.name);
  };

  const handleMouseLeave = () => {
    remoteAccessService.sendMouseLeave();
  };

  const handleClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (serviceState.connectionState !== 'connected') return;
    const video = e.currentTarget;
    const rect = video.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    remoteAccessService.sendMouseClick(x, y);
  };

  const isSessionActive = serviceState.connectionState !== 'idle';

  return (
    <div className="flex-1 flex flex-col font-sans animate-in fade-in duration-300 bg-[#FAFAFA] overflow-hidden relative z-10 min-h-[80vh]">
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-800">Acesso Remoto</h1>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold font-sans">Administração e Suporte</p>
          </div>
        </div>
      </header>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col items-center justify-center">
        {serviceState.mode === 'selection' && (
          <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch py-8">
            
            {/* Host Card: Share screen */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200/60 shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all duration-300 flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6 text-indigo-600 shadow-sm">
                <Tv className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Compartilhar Minha Tela</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
                Gere um código de acesso seguro validado por seu token 2FA para que um suporte técnico ou administrador possa visualizar sua tela.
              </p>
              
              {errorMsg && !currentUser.twoFactorSecret && serviceState.mode === 'selection' && (
                <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p>{errorMsg}</p>
                    {onTabChange && (
                      <button 
                        onClick={() => onTabChange('2fa')}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors uppercase tracking-wider font-bold text-[9px]"
                      >
                        Ativar Autenticador 2FA
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={startHostFlow}
                disabled={isSessionActive}
                className="mt-auto w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 active:scale-95 text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/10 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" /> Iniciar Compartilhamento
              </button>
            </div>

            {/* Client Card: Access screen */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200/60 shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6 text-emerald-600 shadow-sm">
                <Monitor className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Acessar Tela de Outro Usuário</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
                Insira o código numérico de 6 dígitos fornecido pelo usuário remoto para conectar-se à transmissão ao vivo dele.
              </p>

              <div className="space-y-4 mt-auto">
                <input
                  type="text"
                  maxLength={6}
                  value={inputCode}
                  disabled={isSessionActive}
                  onChange={e => {
                    setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setErrorMsg('');
                  }}
                  placeholder="Digite o código (ex: 582914)"
                  className="w-full text-center text-xl tracking-[0.25em] font-mono p-4 border border-slate-200 bg-slate-50 text-slate-800 rounded-2xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-400"
                />

                {errorMsg && (
                  <p className="text-red-600 text-xs font-bold text-center">{errorMsg}</p>
                )}

                <button
                  onClick={startClientFlow}
                  disabled={inputCode.length !== 6 || serviceState.connectionState === 'connecting' || isSessionActive}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 active:scale-95 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/10 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                  {serviceState.connectionState === 'connecting' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-white" />
                  )}
                  Conectar ao Suporte
                </button>
              </div>
            </div>

          </div>
        )}

        {/* Host Active View (Message only, no screen window) */}
        {serviceState.mode === 'host' && isSessionActive && (
          <div className="max-w-xl mx-auto w-full text-center space-y-6 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm animate-fade-in">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mx-auto border-2 border-indigo-100 animate-pulse">
              <Tv className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Sua Tela Está Sendo Transmitida</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-md mx-auto">
                Sua tela está ativa e sendo compartilhada em tempo real com o suporte. Você pode navegar livremente pelo sistema para realizar as ações necessárias.
              </p>
            </div>

            {/* Access Code display container */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col items-center justify-center max-w-sm mx-auto shadow-inner relative overflow-hidden group">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Código de Acesso Técnico</span>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-mono font-black text-indigo-600 tracking-widest">{serviceState.accessCode}</span>
                <button
                  onClick={handleCopyCode}
                  className="p-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-all active:scale-95 text-slate-400 hover:text-slate-600 shadow-sm"
                  title="Copiar código"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs font-semibold text-indigo-700 max-w-md mx-auto flex items-start gap-3">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-left leading-relaxed">
                Use o painel flutuante permanente no canto inferior direito para permitir o controle do mouse ou encerrar a transmissão a qualquer momento.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ACTIVE REMOTE ACCESS SESSION MODAL (FOR CLIENT/SUPPORT VIEW ONLY) */}
      {isSessionActive && serviceState.mode === 'client' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 transition-all duration-300">
          <div className={`
            bg-white shadow-2xl flex flex-col overflow-hidden transition-all duration-300
            ${isFullscreen 
              ? 'fixed inset-0 w-screen h-screen rounded-none z-[1000]' 
              : 'w-full max-w-4xl max-h-[85vh] rounded-[2rem] border border-slate-100'
            }
          `}>
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm bg-emerald-50 text-emerald-600">
                  <Monitor className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm leading-none uppercase tracking-tight">
                    Visualizando Tela Remota
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                    Código de Sessão: <span className="font-mono font-black text-slate-600">{serviceState.inputCode}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Connection Status Badge */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm text-[8px] font-black uppercase tracking-wider text-slate-600">
                  <span className={`h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse`} />
                  Em Tempo Real
                </div>

                {/* Expand / Fullscreen Button */}
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all font-bold text-xs uppercase tracking-wider"
                  title={isFullscreen ? "Minimizar Janela" : "Expandir para Tela Cheia"}
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Minimizar</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Tela Cheia</span>
                    </>
                  )}
                </button>

                {/* Stop Session Button / Voltar */}
                <button
                  onClick={handleStopSession}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-500 text-red-600 hover:text-white rounded-xl transition-all font-bold text-xs uppercase tracking-wider"
                  title="Voltar e encerrar o acesso remoto"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>
              </div>
            </div>

            {/* Modal Body (Video Stream & Controls) */}
            <div className="flex-1 bg-slate-950 flex flex-col justify-center items-center relative overflow-hidden p-2 min-h-0">
              
              {/* Client view (Remote stream) */}
              <div className="w-full h-full flex items-center justify-center relative min-h-0">
                {serviceState.connectionState === 'connecting' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/95 z-20">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    <p className="font-black text-xs uppercase tracking-widest text-slate-400">Handshake WebRTC...</p>
                  </div>
                )}

                <video
                  ref={videoRemoteRef}
                  autoPlay
                  playsInline
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  onClick={handleClick}
                  className="max-w-full max-h-full object-contain cursor-crosshair shadow-2xl"
                />
                
                {/* Status Overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-xl p-3 text-[9px] font-black text-slate-300 tracking-wider">
                  <span className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    SUGESTÃO: CLIQUE E MOVA O MOUSE NA TELA PARA DIRECIONAR O USUÁRIO.
                  </span>
                  <div className="flex items-center gap-2">
                    <MousePointer className="w-3.5 h-3.5 text-indigo-400" />
                    <span>CONTROLE DE MOUSE: {serviceState.isMouseControlGranted ? (
                      <span className="text-emerald-400 font-extrabold uppercase">CONCEDIDO</span>
                    ) : (
                      <span className="text-amber-500 font-extrabold uppercase">AGUARDANDO AUTORIZAÇÃO</span>
                    )}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50/50 shrink-0">
              <button
                onClick={handleStopSession}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-red-600/10"
              >
                <Square className="w-3.5 h-3.5 fill-current" /> Encerrar Acesso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Modal */}
      {is2FAModalOpen && (
        <TwoFactorModal
          isOpen={is2FAModalOpen}
          onClose={() => setIs2FAModalOpen(false)}
          onConfirm={on2FAVerified}
          secret={currentUser.twoFactorSecret || currentUser.twoFactorSecret2 || ''}
          secret2={currentUser.twoFactorSecret2}
          signatureName={currentUser.name}
        />
      )}
    </div>
  );
};
