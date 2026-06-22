import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, Monitor, X, ShieldCheck, AlertTriangle, Play, Square, Copy, Check, Loader2, Info, ArrowLeft, RefreshCw
} from 'lucide-react';
import { User } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { TwoFactorModal } from '../TwoFactorModal';

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
  const [mode, setMode] = useState<'selection' | 'host' | 'client'>('selection');
  const [accessCode, setAccessCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [connectionState, setConnectionState] = useState<string>('idle'); // idle, connecting, connected, sharing, disconnected, error
  const [errorMsg, setErrorMsg] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  
  // WebRTC refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any | null>(null);
  
  const videoLocalRef = useRef<HTMLVideoElement>(null);
  const videoRemoteRef = useRef<HTMLVideoElement>(null);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    return () => {
      cleanupConnection();
    };
  }, []);

  const cleanupConnection = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'disconnect',
        payload: {}
      });
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    remoteStreamRef.current = null;
    setConnectionState('idle');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(accessCode);
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
    setConnectionState('connecting');
    try {
      // 1. Get Screen Stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      
      localStreamRef.current = stream;
      
      // Handle browser's native "stop sharing" button click
      stream.getVideoTracks()[0].onended = () => {
        handleStopSession();
      };

      if (videoLocalRef.current) {
        videoLocalRef.current.srcObject = stream;
      }

      // 2. Generate random code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setAccessCode(code);
      setMode('host');
      setConnectionState('sharing');

      // 3. Connect to signaling channel
      const channelName = `remote_access_${code}`;
      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } }
      });

      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'join' }, () => {
          // Client joined, host initiates peer connection
          initiatePeerConnection(code);
        })
        .on('broadcast', { event: 'signal' }, async ({ payload }) => {
          const pc = peerConnectionRef.current;
          if (!pc) return;

          if (payload.answer) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
            setConnectionState('connected');
          } else if (payload.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
              console.error("Error adding ice candidate:", e);
            }
          }
        })
        .on('broadcast', { event: 'disconnect' }, () => {
          setConnectionState('sharing'); // revert to sharing state waiting for new client
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
          }
        });

      channel.subscribe();

    } catch (err: any) {
      console.error("Failed to capture screen:", err);
      setErrorMsg("Acesso à tela negado ou cancelado.");
      setConnectionState('idle');
    }
  };

  const initiatePeerConnection = async (code: string) => {
    setConnectionState('connecting');
    
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: { candidate: event.candidate }
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setConnectionState('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnectionState('sharing'); // wait for reconnect
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { offer }
      });
    }
  };

  // Client Flow
  const startClientFlow = async () => {
    if (inputCode.length !== 6) {
      setErrorMsg("Digite um código de 6 dígitos válido.");
      return;
    }
    setErrorMsg("");
    setConnectionState('connecting');
    setMode('client');

    const channelName = `remote_access_${inputCode}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });

    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (payload.offer) {
          // Received offer, setup client PeerConnection
          const pc = new RTCPeerConnection(iceServers);
          peerConnectionRef.current = pc;

          pc.onicecandidate = (event) => {
            if (event.candidate && channelRef.current) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'signal',
                payload: { candidate: event.candidate }
              });
            }
          };

          pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
              remoteStreamRef.current = event.streams[0];
              if (videoRemoteRef.current) {
                videoRemoteRef.current.srcObject = event.streams[0];
              }
              setConnectionState('connected');
            }
          };

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
              setConnectionState('connected');
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              setErrorMsg("Conexão interrompida pelo transmissor.");
              setConnectionState('disconnected');
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { answer }
          });
        } else if (payload.candidate) {
          const pc = peerConnectionRef.current;
          if (pc) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
              console.error("Error adding ice candidate client:", e);
            }
          }
        }
      })
      .on('broadcast', { event: 'disconnect' }, () => {
        setErrorMsg("O transmissor encerrou a sessão.");
        setConnectionState('disconnected');
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Broadcast to host that we are ready to connect
        channel.send({
          type: 'broadcast',
          event: 'join',
          payload: {}
        });
      }
    });
  };

  const handleStopSession = () => {
    cleanupConnection();
    setMode('selection');
    setAccessCode('');
    setInputCode('');
    setErrorMsg('');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 text-white min-h-[70vh] rounded-[2.5rem] border border-slate-800 shadow-2xl relative font-sans">
      {/* Header bar */}
      <div className="px-8 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={mode !== 'selection' ? handleStopSession : onBack}
            className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
              <Tv className="w-5 h-5 text-indigo-500" /> Acesso Remoto
            </h2>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Suporte e compartilhamento de tela</p>
          </div>
        </div>

        {mode !== 'selection' && (
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full animate-pulse ${
              connectionState === 'connected' ? 'bg-emerald-500' :
              connectionState === 'sharing' ? 'bg-indigo-500' :
              connectionState === 'connecting' ? 'bg-amber-500' : 'bg-red-500'
            }`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
              {connectionState === 'connected' ? 'Conectado (Em tempo real)' :
               connectionState === 'sharing' ? 'Aguardando Conexão...' :
               connectionState === 'connecting' ? 'Conectando...' : 'Desconectado'}
            </span>
          </div>
        )}
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col justify-center">
        {mode === 'selection' && (
          <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch py-8">
            
            {/* Host Box: Share screen */}
            <div className="bg-slate-950/40 rounded-3xl p-8 border border-slate-800/80 flex flex-col hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 text-indigo-500 shadow-inner">
                <Tv className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Compartilhar Minha Tela</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                Gere um código de acesso seguro validado por 2FA para que um suporte ou administrador possa ver sua tela em tempo real.
              </p>
              
              {errorMsg && !currentUser.twoFactorSecret && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p>{errorMsg}</p>
                    {onTabChange && (
                      <button 
                        onClick={() => onTabChange('2fa')}
                        className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors uppercase tracking-wider font-bold text-[9px]"
                      >
                        Ativar Autenticador 2FA
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={startHostFlow}
                className="mt-auto w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/10 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" /> Iniciar Compartilhamento
              </button>
            </div>

            {/* Client Box: Access screen */}
            <div className="bg-slate-950/40 rounded-3xl p-8 border border-slate-800/80 flex flex-col hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 text-emerald-500 shadow-inner">
                <Monitor className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Acessar Tela de Outro Usuário</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                Insira o código numérico de 6 dígitos gerado pelo usuário remoto para se conectar à transmissão ao vivo da tela dele.
              </p>

              <div className="space-y-4 mt-auto">
                <input
                  type="text"
                  maxLength={6}
                  value={inputCode}
                  onChange={e => {
                    setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setErrorMsg('');
                  }}
                  placeholder="Digite o código (ex: 582914)"
                  className="w-full text-center text-xl tracking-[0.25em] font-mono p-4 border border-slate-800 bg-slate-950/80 text-white rounded-2xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-700"
                />

                {errorMsg && currentUser.twoFactorSecret && (
                  <p className="text-red-500 text-xs font-bold text-center">{errorMsg}</p>
                )}

                <button
                  onClick={startClientFlow}
                  disabled={inputCode.length !== 6 || connectionState === 'connecting'}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 active:scale-95 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/10 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                  {connectionState === 'connecting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                  Conectar ao Suporte
                </button>
              </div>
            </div>

          </div>
        )}

        {/* Host Active View */}
        {mode === 'host' && (
          <div className="max-w-xl mx-auto w-full text-center space-y-8 py-10">
            <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-500 mx-auto border-4 border-indigo-500/20 animate-pulse">
              <Tv className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white tracking-tight">Transmissão de Tela Ativa</h3>
              <p className="text-sm text-slate-400 font-medium">
                Forneça o código abaixo para o usuário de suporte. Não feche esta aba.
              </p>
            </div>

            {/* Access Code display container */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center max-w-sm mx-auto shadow-inner relative overflow-hidden group">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Código de Acesso Seguro</span>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-mono font-black text-indigo-400 tracking-widest">{accessCode}</span>
                <button
                  onClick={handleCopyCode}
                  className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition-all active:scale-95 text-slate-400 hover:text-white"
                  title="Copiar código"
                >
                  {isCopied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <div className="absolute top-0 left-0 h-1 bg-indigo-500 w-full animate-pulse"></div>
            </div>

            {/* Video preview monitor */}
            <div className="border border-slate-800 rounded-3xl overflow-hidden max-w-md mx-auto aspect-video bg-black relative shadow-2xl">
              <video
                ref={videoLocalRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 px-2.5 py-1 rounded bg-slate-950/70 border border-slate-800 text-[8px] font-black tracking-widest uppercase text-indigo-400">
                PRÉ-VISUALIZAÇÃO LOCAL
              </div>
            </div>

            <button
              onClick={handleStopSession}
              className="py-3 px-6 bg-red-600/10 border border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white font-bold rounded-xl transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2 mx-auto active:scale-95"
            >
              <Square className="w-4 h-4 fill-current" /> Interromper Transmissão
            </button>
          </div>
        )}

        {/* Client (Viewer) View */}
        {mode === 'client' && (
          <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 py-4 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-white text-base leading-none">Tela de Suporte Ativa</h4>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Sessão: {inputCode}</p>
                </div>
              </div>

              <button
                onClick={handleStopSession}
                className="py-2.5 px-4 bg-red-600/10 border border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white font-bold rounded-xl transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2 active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-current" /> Sair do Acesso
              </button>
            </div>

            {/* Virtual Monitor container */}
            <div className="flex-1 border-4 border-slate-950 rounded-3xl overflow-hidden aspect-video bg-black relative shadow-2xl flex items-center justify-center">
              {connectionState === 'connecting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/90 z-20">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                    <RefreshCw className="w-5 h-5 text-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-black text-sm uppercase tracking-widest text-slate-200">Aguardando Transmissor...</p>
                    <p className="text-xs text-slate-500">Conectando ao canal seguro e estabelecendo handshake WebRTC</p>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/90 z-20 p-8 text-center">
                  <AlertTriangle className="w-12 h-12 text-red-500" />
                  <div className="space-y-1">
                    <p className="font-black text-sm uppercase tracking-widest text-red-500">Sessão Encerrada</p>
                    <p className="text-xs text-slate-400 max-w-md">{errorMsg}</p>
                  </div>
                  <button 
                    onClick={handleStopSession}
                    className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-bold uppercase"
                  >
                    Voltar
                  </button>
                </div>
              )}

              <video
                ref={videoRemoteRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
              
              <div className="absolute bottom-4 left-4 bg-slate-950/80 border border-slate-800/80 backdrop-blur-md rounded-lg p-2.5 text-[8.5px] font-bold text-slate-400 tracking-wider flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>MONITORAMENTO ATIVO: VOCÊ ESTÁ VISUALIZANDO A TELA EM TEMPO REAL.</span>
              </div>
            </div>
          </div>
        )}
      </div>

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
