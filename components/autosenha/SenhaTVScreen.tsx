import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Clock,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Sparkles,
  Radio,
  ShieldCheck
} from 'lucide-react';
import {
  AutoSenhaUnidadeId,
  AutoSenhaTVItem,
  AutoSenhaTVConfig
} from '../../types';
import {
  AUTOSENHA_UNIDADES,
  getPainelSenhaTVPublico,
  sanitizarSenhaParaTV,
  montarTextoChamadaVozTV,
  getDataOperacionalHoje
} from '../../services/autoSenhaService';
import { supabase } from '../../services/supabaseClient';

interface SenhaTVScreenProps {
  unidadeId: AutoSenhaUnidadeId;
  onBack?: () => void;
}

const gerarChaveChamada = (item: AutoSenhaTVItem | null): string => {
  if (!item) return '';
  return `${item.id}:${item.call_count || 0}:${item.last_called_at || item.first_called_at || ''}`;
};

export const SenhaTVScreen: React.FC<SenhaTVScreenProps> = ({ unidadeId, onBack }) => {
  const unidade = AUTOSENHA_UNIDADES.find(u => u.id === unidadeId)!;
  const [config, setConfig] = useState<AutoSenhaTVConfig | null>(null);
  const [senhaAtual, setSenhaAtual] = useState<AutoSenhaTVItem | null>(null);
  const [chamadasRecentes, setChamadasRecentes] = useState<AutoSenhaTVItem[]>([]);
  const [proximasSenhas, setProximasSenhas] = useState<AutoSenhaTVItem[]>([]);
  const [totalAguardando, setTotalAguardando] = useState<number>(0);
  const [horaAtual, setHoraAtual] = useState('');
  const [dataAtual, setDataAtual] = useState('');
  const [somAtivo, setSomAtivo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [animandoChamada, setAnimandoChamada] = useState(false);
  const [conectadoRealtime, setConectadoRealtime] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const somAtivoRef = useRef(false);
  const inicializadoRef = useRef(false);
  const ultimaChamadaAnunciadaRef = useRef<string>('');
  const animacaoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vozTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    somAtivoRef.current = somAtivo;
  }, [somAtivo]);

  // Relógio em tempo real
  useEffect(() => {
    const atualizarRelogio = () => {
      const agora = new Date();
      setHoraAtual(
        agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setDataAtual(
        agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      );
    };
    atualizarRelogio();
    const interval = setInterval(atualizarRelogio, 1000);
    return () => clearInterval(interval);
  }, []);

  // Tocar bip sonoro suave via Web Audio API
  const tocarBipSuave = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      playTone(587.33, 0, 0.35); // D5
      playTone(880, 0.22, 0.5);   // A5
    } catch {
      console.warn('[SenhaTV] Falha ao reproduzir alerta sonoro');
    }
  }, []);

  // Chamada por voz (LGPD: anuncia exclusivamente número da senha e guichê de destino)
  const falarTextoSeguro = useCallback((texto: string) => {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.96;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const vozes = synth.getVoices ? synth.getVoices() : [];
      const vozPtBr =
        vozes.find(v => v.lang?.toLowerCase() === 'pt-br') ||
        vozes.find(v => v.lang?.toLowerCase().startsWith('pt'));
      if (vozPtBr) {
        utterance.voice = vozPtBr;
      }

      synth.speak(utterance);
    } catch {
      console.warn('[SenhaTV] Síntese de voz indisponível neste dispositivo');
    }
  }, []);

  const dispararNotificacaoChamada = useCallback(
    (item: AutoSenhaTVItem) => {
      const chave = gerarChaveChamada(item);
      if (!chave || ultimaChamadaAnunciadaRef.current === chave) return;
      ultimaChamadaAnunciadaRef.current = chave;

      setAnimandoChamada(true);
      if (animacaoTimerRef.current) clearTimeout(animacaoTimerRef.current);
      animacaoTimerRef.current = setTimeout(() => setAnimandoChamada(false), 3000);

      if (!somAtivoRef.current) return;

      tocarBipSuave();
      const fraseVoz = montarTextoChamadaVozTV(item.numero, item.guiche);
      if (vozTimerRef.current) clearTimeout(vozTimerRef.current);
      vozTimerRef.current = setTimeout(() => {
        falarTextoSeguro(fraseVoz);
      }, 550);
    },
    [tocarBipSuave, falarTextoSeguro]
  );

  // Carregar snapshot anonimizado da unidade (sem dados pessoais)
  const carregarDados = useCallback(async () => {
    try {
      const dataHoje = getDataOperacionalHoje();
      const snapshot = await getPainelSenhaTVPublico(unidadeId, dataHoje);
      setConfig(snapshot.config);
      setChamadasRecentes(snapshot.chamadasRecentes);
      setProximasSenhas(snapshot.proximasSenhas);
      setTotalAguardando(snapshot.totalAguardando);
      setSenhaAtual(snapshot.senhaAtual);
      setErroCarga(null);

      if (snapshot.senhaAtual) {
        const novaChave = gerarChaveChamada(snapshot.senhaAtual);
        if (!inicializadoRef.current) {
          ultimaChamadaAnunciadaRef.current = novaChave;
        } else if (novaChave !== ultimaChamadaAnunciadaRef.current) {
          dispararNotificacaoChamada(snapshot.senhaAtual);
        }
      }
      inicializadoRef.current = true;
    } catch {
      setErroCarga('Não foi possível atualizar o painel público desta unidade.');
    }
  }, [unidadeId, dispararNotificacaoChamada]);

  useEffect(() => {
    inicializadoRef.current = false;
    ultimaChamadaAnunciadaRef.current = '';
    carregarDados();

    // Sincronização Realtime via canal dedicado por unidade
    const channelName = `autosenha-${unidadeId}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'senha_chamada' }, (payload) => {
        if (payload?.payload?.senha) {
          const chamadaSanitizada = sanitizarSenhaParaTV({
            ...payload.payload.senha,
            guiche: payload.payload.guiche || payload.payload.senha?.guiche
          });
          setSenhaAtual(chamadaSanitizada);
          dispararNotificacaoChamada(chamadaSanitizada);
          carregarDados();
        }
      })
      .on('broadcast', { event: 'senha_emitida' }, () => {
        carregarDados();
      })
      .on('broadcast', { event: 'bloco_atualizado' }, () => {
        carregarDados();
      })
      .on('broadcast', { event: 'atendimento_iniciado' }, () => {
        carregarDados();
      })
      .on('broadcast', { event: 'atendimento_concluido' }, () => {
        carregarDados();
      })
      .on('broadcast', { event: 'senha_cancelada' }, () => {
        carregarDados();
      })
      .on('broadcast', { event: 'nao_compareceu' }, () => {
        carregarDados();
      })
      .on('broadcast', { event: 'config_alterada' }, () => {
        carregarDados();
      })
      .on('broadcast', { event: 'dados_zerados' }, () => {
        ultimaChamadaAnunciadaRef.current = '';
        carregarDados();
      })
      .subscribe((status) => {
        setConectadoRealtime(status === 'SUBSCRIBED');
      });

    // Polling de segurança a cada 8s caso realtime desconecte
    const pollInterval = setInterval(carregarDados, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      if (animacaoTimerRef.current) clearTimeout(animacaoTimerRef.current);
      if (vozTimerRef.current) clearTimeout(vozTimerRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [unidadeId, carregarDados, dispararNotificacaoChamada]);

  // Alternar tela cheia
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Alternar som e destravar áudio + síntese de voz no navegador
  const handleToggleSom = () => {
    const proximoEstado = !somAtivo;
    setSomAtivo(proximoEstado);
    somAtivoRef.current = proximoEstado;

    if (proximoEstado) {
      tocarBipSuave();
      setTimeout(() => {
        falarTextoSeguro('Som e chamada por voz ativados.');
      }, 450);
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col justify-between overflow-y-auto lg:overflow-hidden select-none font-sans">
      {/* CABEÇALHO DA TV */}
      <header className="px-5 sm:px-7 py-4 bg-slate-900/85 backdrop-blur-md border-b border-white/10 flex items-center justify-between gap-4 shadow-2xl shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 cursor-pointer shrink-0"
              title="Voltar ao Controle"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3 min-w-0">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] sm:text-xs uppercase tracking-widest text-emerald-400 font-extrabold">
                  {unidade.tipo === 'UPA' ? 'SENHAS DA RECEPÇÃO' : 'PAINEL DE CHAMADAS'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-bold">
                  {unidade.sigla}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight text-white truncate">
                {unidade.nome}
              </h1>
            </div>
          </div>
        </div>

        {/* Relógio e Ações Rápidas da TV */}
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <div className="text-right">
            <div className="text-xl sm:text-2xl md:text-3xl font-black font-mono tracking-tight text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]">
              {horaAtual}
            </div>
            <div className="hidden sm:block text-xs font-semibold text-slate-400 capitalize">
              {dataAtual}
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-white/10 pl-3 sm:pl-4">
            <button
              type="button"
              onClick={handleToggleSom}
              className={`px-3 py-2.5 rounded-2xl transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 ${
                somAtivo
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-slate-200'
              }`}
              title={somAtivo ? 'Som e chamada por voz ATIVOS' : 'Clique para ativar som e voz de chamada'}
            >
              {somAtivo ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{somAtivo ? 'Som e Voz Ativos' : 'Ativar Som'}</span>
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              title="Alternar Tela Cheia"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* ÁREA PRINCIPAL DA TELEVISÃO */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6 items-stretch min-h-0">
        {/* BLOCO DE DESTAQUE PRINCIPAL: EXCLUSIVAMENTE SENHA E GUICHÊ (COL 8) */}
        <section className="lg:col-span-8 flex flex-col justify-center items-center rounded-3xl bg-gradient-to-b from-white/10 via-white/5 to-white/[0.02] border border-white/15 px-6 py-8 md:px-12 md:py-10 text-center shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Efeito Glow / Pulso na Chamada */}
          <div
            className={`absolute inset-0 bg-gradient-to-r from-emerald-500/25 via-sky-500/20 to-indigo-500/25 transition-all duration-700 ${
              animandoChamada ? 'opacity-100 scale-105' : 'opacity-20 scale-100'
            }`}
          />

          {erroCarga && !senhaAtual ? (
            <div className="relative z-10 flex flex-col items-center justify-center text-amber-200 py-12 max-w-md">
              <Clock className="w-16 h-16 text-amber-300/70 mb-4" />
              <h2 className="text-xl font-extrabold">Aguardando Conexão Segura</h2>
              <p className="text-sm text-slate-300 mt-2">{erroCarga}</p>
            </div>
          ) : senhaAtual ? (
            <div
              className={`relative z-10 w-full flex flex-col items-center justify-center gap-5 md:gap-7 transition-transform duration-500 ${
                animandoChamada ? 'scale-[1.03]' : 'scale-100'
              }`}
            >
              {/* Indicador visual de chamada sem dados pessoais */}
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-2 px-5 py-1.5 rounded-full text-xs sm:text-sm font-black uppercase tracking-[0.28em] border transition-colors ${
                    animandoChamada
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/60 shadow-lg shadow-emerald-500/25'
                      : 'bg-white/10 text-slate-300 border-white/15'
                  }`}
                >
                  <Radio className={`w-4 h-4 ${animandoChamada ? 'text-emerald-300 animate-ping' : 'text-emerald-400'}`} />
                  {animandoChamada ? 'CHAMANDO SENHA' : 'SENHA CHAMADA'}
                </span>
              </div>

              {/* NÚMERO AMPLIADO E CENTRALIZADO */}
              <div className="w-full flex flex-col items-center justify-center">
                <span className="text-xs sm:text-sm font-black uppercase tracking-[0.45em] text-slate-400 mb-1">
                  SENHA
                </span>
                <div className="text-8xl sm:text-9xl md:text-[10.5rem] lg:text-[12.5rem] xl:text-[14rem] font-black tracking-tighter text-white drop-shadow-[0_14px_40px_rgba(0,0,0,0.85)] font-mono leading-none">
                  {senhaAtual.numero}
                </div>
              </div>

              {/* DESTAQUE DO GUICHÊ DE DESTINO */}
              <div className="w-full max-w-2xl rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-500 p-1.5 shadow-2xl shadow-emerald-500/30">
                <div className="rounded-[1.25rem] bg-slate-950/15 px-6 py-4 sm:px-8 sm:py-5 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
                  <span className="text-slate-950 font-black text-base sm:text-xl md:text-2xl uppercase tracking-widest">
                    DIRIJA-SE AO:
                  </span>
                  <span className="bg-white text-emerald-950 px-5 sm:px-7 py-2 sm:py-2.5 rounded-2xl font-black text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight shadow-md">
                    {senhaAtual.guiche || 'Recepção'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center justify-center text-slate-400 py-14">
              <Clock className="w-20 h-20 text-slate-600 mb-4 animate-pulse" />
              <h2 className="text-2xl sm:text-3xl font-black text-slate-200 tracking-tight">
                Aguardando Próxima Chamada
              </h2>
              <p className="text-sm sm:text-base text-slate-400 mt-2 max-w-md">
                O número da senha e o local de atendimento aparecerão aqui em destaque assim que chamados.
              </p>
            </div>
          )}
        </section>

        {/* COLUNA LATERAL: ÚLTIMAS CHAMADAS E PRÓXIMAS SENHAS (COL 4) */}
        <section className="lg:col-span-4 flex flex-col gap-5 justify-between min-h-0">
          {/* ÚLTIMAS CHAMADAS — APENAS SENHA E GUICHÊ */}
          <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-md flex flex-col shadow-xl min-h-0">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3 shrink-0">
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Últimas Chamadas
              </h3>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                SENHA / GUICHÊ
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-start gap-3 overflow-y-auto pr-0.5">
              {chamadasRecentes.length > 0 ? (
                chamadasRecentes.map((item) => (
                  <div
                    key={item.id}
                    className="px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">
                        Senha
                      </span>
                      <span className="font-mono text-2xl sm:text-3xl font-black text-white leading-none">
                        {item.numero}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-block text-xs sm:text-sm font-black uppercase px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/25 text-emerald-200 tracking-wide">
                        {item.guiche || 'Recepção'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs sm:text-sm text-slate-500 font-semibold py-6">
                  Nenhuma chamada anterior registrada hoje
                </div>
              )}
            </div>
          </div>

          {/* PRÓXIMAS SENHAS NA FILA — APENAS NÚMEROS DAS SENHAS */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-md shadow-xl shrink-0">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-sky-400 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Próximas Senhas
              </h3>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-extrabold">
                {totalAguardando} aguardando
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {proximasSenhas.length > 0 ? (
                proximasSenhas.map((item) => (
                  <div
                    key={item.id}
                    className="px-4 py-2.5 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center"
                  >
                    <span className="font-mono text-base sm:text-lg font-black text-white tracking-tight">
                      {item.numero}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-xs sm:text-sm text-slate-500 font-semibold">
                  Fila zerada no momento
                </span>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* RODAPÉ INSTITUCIONAL */}
      <footer className="px-5 sm:px-7 py-3 bg-slate-950/85 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
          <span className="font-extrabold text-slate-200">
            {config?.mensagem_rodape_tv || 'Prefeitura de São José do Goiabal — MG'}
          </span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300/90 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Painel público sem dados pessoais (LGPD)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${conectadoRealtime ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
          <span className="text-[11px] font-bold text-slate-400">
            {conectadoRealtime ? 'Sincronizado em Tempo Real' : 'Reconectando...'}
          </span>
        </div>
      </footer>
    </div>
  );
};
