import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Maximize2, Minimize2, Volume2, VolumeX, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { AutoSenhaUnidadeId, AutoSenhaItem, AutoSenhaConfiguracao } from '../../types';
import { AUTOSENHA_UNIDADES, getSenhas, getConfiguracao, formatarNomeParaTV, getDataOperacionalHoje } from '../../services/autoSenhaService';
import { supabase } from '../../services/supabaseClient';

interface SenhaTVScreenProps {
  unidadeId: AutoSenhaUnidadeId;
  onBack?: () => void;
}

export const SenhaTVScreen: React.FC<SenhaTVScreenProps> = ({ unidadeId, onBack }) => {
  const unidade = AUTOSENHA_UNIDADES.find(u => u.id === unidadeId)!;
  const [config, setConfig] = useState<AutoSenhaConfiguracao | null>(null);
  const [senhas, setSenhas] = useState<AutoSenhaItem[]>([]);
  const [senhaAtual, setSenhaAtual] = useState<AutoSenhaItem | null>(null);
  const [chamadasRecentes, setChamadasRecentes] = useState<AutoSenhaItem[]>([]);
  const [proximasSenhas, setProximasSenhas] = useState<AutoSenhaItem[]>([]);
  const [horaAtual, setHoraAtual] = useState('');
  const [dataAtual, setDataAtual] = useState('');
  const [somAtivo, setSomAtivo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [animandoChamada, setAnimandoChamada] = useState(false);
  const [conectadoRealtime, setConectadoRealtime] = useState(true);

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

  // Tocar bip sonoro suave
  const tocarAvisoSonoro = () => {
    if (!somAtivo) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Tom duplo agradável de aeroporto / chamada pública
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      playTone(587.33, 0, 0.4); // D5
      playTone(880, 0.25, 0.6); // A5
    } catch (e) {
      console.warn('[SenhaTV] Erro de áudio:', e);
    }
  };

  // Carregar dados da unidade
  const carregarDados = async () => {
    const dataHoje = getDataOperacionalHoje();
    const [cfg, listaSenhas] = await Promise.all([
      getConfiguracao(unidadeId),
      getSenhas(unidadeId, dataHoje)
    ]);

    setConfig(cfg);
    setSenhas(listaSenhas);

    // Identificar a chamada mais recente
    const chamadas = listaSenhas
      .filter(s => s.first_called_at || s.last_called_at)
      .sort((a, b) => new Date(b.last_called_at || b.first_called_at!).getTime() - new Date(a.last_called_at || a.first_called_at!).getTime());

    if (chamadas.length > 0) {
      setSenhaAtual(chamadas[0]);
      setChamadasRecentes(chamadas.slice(1, 6));
    } else {
      setSenhaAtual(null);
      setChamadasRecentes([]);
    }

    // Próximas senhas aguardando
    const aguardando = listaSenhas
      .filter(s => s.status === 'AGUARDANDO')
      .sort((a, b) => {
        // Especiais primeiro, depois por ordem de chegada
        if (a.prioridade_tipo === 'ESPECIAL' && b.prioridade_tipo !== 'ESPECIAL') return -1;
        if (b.prioridade_tipo === 'ESPECIAL' && a.prioridade_tipo !== 'ESPECIAL') return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    setProximasSenhas(aguardando.slice(0, 5));
  };

  useEffect(() => {
    carregarDados();

    // Sincronização Realtime via canal dedicado por unidade
    const channelName = `autosenha-${unidadeId}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'senha_chamada' }, (payload) => {
        if (payload?.payload?.senha) {
          const novaSenhaChamada = payload.payload.senha as AutoSenhaItem;
          setSenhaAtual(novaSenhaChamada);
          setAnimandoChamada(true);
          tocarAvisoSonoro();
          setTimeout(() => setAnimandoChamada(false), 2000);
          carregarDados();
        }
      })
      .on('broadcast', { event: 'senha_emitida' }, () => {
        carregarDados();
      })
      .on('broadcast', { event: 'atendimento_iniciado' }, () => {
        carregarDados();
      })
      .on('broadcast', { event: 'atendimento_concluido' }, () => {
        carregarDados();
      })
      .subscribe((status) => {
        setConectadoRealtime(status === 'SUBSCRIBED');
      });

    // Polling de segurança a cada 8s para garantir integridade caso realtime desconecte
    const pollInterval = setInterval(carregarDados, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [unidadeId, somAtivo]);

  // Alternar tela cheia
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const getPrioridadeBadge = (tipo: string) => {
    switch (tipo) {
      case 'ESPECIAL':
        return {
          bg: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
          label: 'PRIORIDADE ESPECIAL (LEI 13.466/17)'
        };
      case 'PRIORITARIO':
        return {
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
          label: 'ATENDIMENTO PRIORITÁRIO'
        };
      default:
        return {
          bg: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
          label: 'CONVENCIONAL / NORMAL'
        };
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* CABEÇALHO DA TV */}
      <header className="px-6 py-4 bg-slate-900/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 cursor-pointer"
              title="Voltar ao Controle"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-emerald-400 font-extrabold">
                  {unidade.tipo === 'UPA' ? 'SENHAS DA RECEPÇÃO' : 'PAINEL DE CHAMADAS'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-bold">
                  {unidade.sigla}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                {unidade.nome}
              </h1>
            </div>
          </div>
        </div>

        {/* Relógio e Ações Rápidas da TV */}
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-2xl md:text-3xl font-black font-mono tracking-tight text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]">
              {horaAtual}
            </div>
            <div className="text-xs font-semibold text-slate-400 capitalize">
              {dataAtual}
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <button
              onClick={() => {
                setSomAtivo(!somAtivo);
                if (!somAtivo) tocarAvisoSonoro();
              }}
              className={`p-2.5 rounded-2xl transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 ${
                somAtivo
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-slate-300'
              }`}
              title={somAtivo ? 'Som de chamada ATIVO' : 'Clique para ativar som de chamada'}
            >
              {somAtivo ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{somAtivo ? 'Som Ativo' : 'Ativar Som'}</span>
            </button>

            <button
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
      <main className="flex-1 p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch overflow-hidden">
        {/* BLOCO DE DESTAQUE: SENHA CHAMADA (COL 8) */}
        <section className="lg:col-span-8 flex flex-col justify-center items-center rounded-3xl bg-gradient-to-b from-white/10 via-white/5 to-white/0 border border-white/15 p-8 md:p-12 text-center shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Efeito Glow / Pulso na Chamada */}
          <div className={`absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-sky-500/20 to-purple-500/20 transition-opacity duration-1000 ${
            animandoChamada ? 'opacity-100 scale-105' : 'opacity-20'
          }`} />

          {senhaAtual ? (
            <div className={`relative z-10 w-full flex flex-col items-center transition-transform duration-500 ${
              animandoChamada ? 'scale-105' : 'scale-100'
            }`}>
              {/* Badge de Prioridade */}
              <div className="mb-4">
                <span className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-black uppercase tracking-widest border shadow-lg ${
                  getPrioridadeBadge(senhaAtual.prioridade_tipo).bg
                }`}>
                  {getPrioridadeBadge(senhaAtual.prioridade_tipo).label}
                </span>
              </div>

              {/* NÚMERO GIGANTE DA SENHA */}
              <div className="my-2">
                <span className="text-7xl sm:text-8xl md:text-9xl lg:text-[11rem] font-black tracking-tighter text-white drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)] font-mono">
                  {senhaAtual.numero}
                </span>
              </div>

              {/* NOME DO CIDADÃO */}
              <div className="mt-2 max-w-3xl">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-100 tracking-tight leading-tight uppercase">
                  {formatarNomeParaTV(senhaAtual.cidadao_nome, config?.ocultar_sobrenome_tv || false)}
                </h2>
                {senhaAtual.prioridade_categoria && (
                  <p className="text-sm md:text-base text-slate-400 font-semibold mt-1">
                    {senhaAtual.prioridade_categoria}
                  </p>
                )}
              </div>

              {/* GUICHÊ / LOCAL DE ATENDIMENTO */}
              <div className="mt-8 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black text-xl md:text-2xl uppercase tracking-wider shadow-xl shadow-emerald-500/30 flex items-center gap-3">
                <span>DIRIJA-SE AO:</span>
                <span className="bg-white/90 px-3 py-1 rounded-xl text-emerald-950 font-black">
                  {senhaAtual.guiche || 'RECEPÇÃO'}
                </span>
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center justify-center text-slate-400 py-16">
              <Clock className="w-20 h-20 text-slate-600 mb-4 animate-pulse" />
              <h3 className="text-2xl font-bold text-slate-300">Aguardando Próxima Chamada</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-md">
                Assim que a recepção chamar um cidadão, a senha surgirá aqui em destaque imediato.
              </p>
            </div>
          )}
        </section>

        {/* COLUNA LATERAL: HISTÓRICO RECENTE E PRÓXIMAS SENHAS (COL 4) */}
        <section className="lg:col-span-4 flex flex-col gap-6 justify-between">
          {/* ÚLTIMAS CHAMADAS */}
          <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-md flex flex-col shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                Últimas Chamadas
              </h3>
              <span className="text-[10px] text-slate-400 font-bold">SENHA / GUICHÊ</span>
            </div>

            <div className="flex-1 flex flex-col justify-start gap-2.5 overflow-hidden">
              {chamadasRecentes.length > 0 ? (
                chamadasRecentes.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xl font-black text-white">{item.numero}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                          item.prioridade_tipo === 'ESPECIAL' ? 'bg-amber-500/20 text-amber-300' :
                          item.prioridade_tipo === 'PRIORITARIO' ? 'bg-emerald-500/20 text-emerald-300' :
                          'bg-sky-500/20 text-sky-300'
                        }`}>
                          {item.prioridade_tipo.substring(0, 4)}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-300 truncate max-w-[170px] mt-0.5">
                        {formatarNomeParaTV(item.cidadao_nome, config?.ocultar_sobrenome_tv || false)}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold px-2 py-1 rounded-xl bg-white/10 text-slate-200">
                        {item.guiche || 'Recepção'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-500 font-semibold">
                  Nenhuma chamada anterior hoje
                </div>
              )}
            </div>
          </div>

          {/* PRÓXIMAS SENHAS NA FILA */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-sky-400 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                Próximas Senhas na Fila
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-extrabold">
                {proximasSenhas.length} aguardando
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {proximasSenhas.length > 0 ? (
                proximasSenhas.map((item, idx) => (
                  <div
                    key={item.id}
                    className="px-3.5 py-2 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2"
                  >
                    <span className="font-mono text-sm font-extrabold text-white">{item.numero}</span>
                    {item.prioridade_tipo !== 'NORMAL' && (
                      <span className={`w-2 h-2 rounded-full ${
                        item.prioridade_tipo === 'ESPECIAL' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />
                    )}
                  </div>
                ))
              ) : (
                <span className="text-xs text-slate-500 font-semibold">Fila zerada no momento</span>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* RODAPÉ INSTITUCIONAL */}
      <footer className="px-6 py-3 bg-slate-950/80 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-slate-200">
            {config?.mensagem_rodape_tv || 'Prefeitura de São José do Goiabal — MG'}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Sistema AutoSenha Oficial</span>
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
