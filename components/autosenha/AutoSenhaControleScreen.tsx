import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, PlusCircle, Bell, RotateCcw, Play, CheckCircle2,
  UserX, XCircle, Settings, ShieldAlert, Sparkles, Clock, AlertTriangle,
  Search, Sliders, Volume2, Tv, Users, Activity, FileText
} from 'lucide-react';
import {
  AutoSenhaUnidadeId,
  AutoSenhaPrioridadeTipo,
  AutoSenhaPrioridadeCategoria,
  AutoSenhaItem,
  AutoSenhaConfiguracao,
  User
} from '../../types';
import {
  AUTOSENHA_UNIDADES,
  getSenhas,
  getConfiguracao,
  salvarConfiguracao,
  gerarSenha,
  chamarProximo,
  rechamarSenha,
  iniciarAtendimento,
  concluirAtendimento,
  registrarNaoCompareceu,
  cancelarSenha,
  solicitarAvaliacaoImediataUPA,
  formatarDuracaoSegundos,
  getDataOperacionalHoje,
  inicializarSeedSeVazio
} from '../../services/autoSenhaService';
import { supabase } from '../../services/supabaseClient';

interface AutoSenhaControleScreenProps {
  unidadeId: AutoSenhaUnidadeId;
  currentUser?: User | null;
  onNavigateTV?: () => void;
  onBack?: () => void;
}

export const AutoSenhaControleScreen: React.FC<AutoSenhaControleScreenProps> = ({
  unidadeId,
  currentUser,
  onNavigateTV,
  onBack
}) => {
  const unidade = AUTOSENHA_UNIDADES.find(u => u.id === unidadeId)!;

  // Estados locais
  const [senhas, setSenhas] = useState<AutoSenhaItem[]>([]);
  const [config, setConfig] = useState<AutoSenhaConfiguracao | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [guicheAtual, setGuicheAtual] = useState('Recepção 1');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');

  // Form de Nova Senha
  const [novoNome, setNovoNome] = useState('');
  const [novaPrioridade, setNovaPrioridade] = useState<AutoSenhaPrioridadeTipo>('NORMAL');
  const [novaCategoria, setNovaCategoria] = useState<string>('Geral');
  const [isGerando, setIsGerando] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Modais
  const [modalCancelarId, setModalCancelarId] = useState<string | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [modalConfigAberto, setModalConfigAberto] = useState(false);
  const [modalUpaUrgenciaAberto, setModalUpaUrgenciaAberto] = useState(false);
  const [upaUrgenciaNome, setUpaUrgenciaNome] = useState('');
  const [upaUrgenciaQueixa, setUpaUrgenciaQueixa] = useState('');

  // Carregar dados
  const carregarDados = async () => {
    try {
      await inicializarSeedSeVazio();
      const dataHoje = getDataOperacionalHoje();
      const [cfg, listaSenhas] = await Promise.all([
        getConfiguracao(unidadeId),
        getSenhas(unidadeId, dataHoje)
      ]);
      setConfig(cfg);
      setSenhas(listaSenhas);
    } catch (e) {
      console.error('[Controle] Erro ao carregar dados:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();

    // Sincronização Realtime
    const channelName = `autosenha-${unidadeId}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'senha_emitida' }, () => carregarDados())
      .on('broadcast', { event: 'senha_chamada' }, () => carregarDados())
      .on('broadcast', { event: 'atendimento_iniciado' }, () => carregarDados())
      .on('broadcast', { event: 'atendimento_concluido' }, () => carregarDados())
      .on('broadcast', { event: 'senha_cancelada' }, () => carregarDados())
      .on('broadcast', { event: 'nao_compareceu' }, () => carregarDados())
      .subscribe();

    const interval = setInterval(carregarDados, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [unidadeId]);

  // Ação: Gerar Senha
  const handleGerarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;

    setIsGerando(true);
    try {
      const senhaCriada = await gerarSenha({
        unidade_id: unidadeId,
        cidadao_nome: novoNome.trim(),
        prioridade_tipo: novaPrioridade,
        prioridade_categoria: novaCategoria,
        guiche: guicheAtual,
        atendente_id: currentUser?.id,
        atendente_nome: currentUser?.name || 'Recepção'
      });

      setNovoNome('');
      setNovaPrioridade('NORMAL');
      setNovaCategoria('Geral');
      setFeedbackSuccess(`Senha ${senhaCriada.numero} gerada com sucesso!`);
      setTimeout(() => setFeedbackSuccess(null), 4000);
      await carregarDados();
    } catch (err) {
      console.error(err);
    } finally {
      setIsGerando(false);
    }
  };

  // Ação: Chamar Próximo
  const handleChamarProximo = async () => {
    const res = await chamarProximo(
      unidadeId,
      guicheAtual,
      currentUser?.name || 'Recepção',
      currentUser?.id
    );

    if (res.senhaChamada) {
      setFeedbackSuccess(`Chamando senha ${res.senhaChamada.numero} (${res.senhaChamada.cidadao_nome})`);
      setTimeout(() => setFeedbackSuccess(null), 4000);
      await carregarDados();
    } else if (res.mensagem) {
      alert(res.mensagem);
    }
  };

  // Ação: Rechamar
  const handleRechamar = async (senhaId: string) => {
    await rechamarSenha(senhaId, guicheAtual, currentUser?.name || 'Recepção', currentUser?.id);
    await carregarDados();
  };

  // Ação: Iniciar
  const handleIniciar = async (senhaId: string) => {
    await iniciarAtendimento(senhaId, currentUser?.name || 'Recepção', currentUser?.id);
    await carregarDados();
  };

  // Ação: Concluir
  const handleConcluir = async (senhaId: string) => {
    await concluirAtendimento(senhaId, currentUser?.name || 'Recepção', currentUser?.id);
    await carregarDados();
  };

  // Ação: Não Compareceu
  const handleNaoCompareceu = async (senhaId: string) => {
    if (confirm('Confirmar ausência do cidadão após as tentativas de chamada?')) {
      await registrarNaoCompareceu(senhaId, currentUser?.name || 'Recepção', currentUser?.id);
      await carregarDados();
    }
  };

  // Ação: Cancelar Senha
  const handleConfirmarCancelamento = async () => {
    if (!modalCancelarId || !motivoCancelamento.trim()) return;
    await cancelarSenha(modalCancelarId, motivoCancelamento.trim(), currentUser?.name || 'Recepção', currentUser?.id);
    setModalCancelarId(null);
    setMotivoCancelamento('');
    await carregarDados();
  };

  // Ação: Solicitar Avaliação Imediata (UPA)
  const handleSolicitarUrgenciaUPA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upaUrgenciaNome.trim() || !upaUrgenciaQueixa.trim()) return;

    await solicitarAvaliacaoImediataUPA(
      upaUrgenciaNome.trim(),
      upaUrgenciaQueixa.trim(),
      currentUser?.name || 'Recepção UPA',
      currentUser?.id
    );

    setUpaUrgenciaNome('');
    setUpaUrgenciaQueixa('');
    setModalUpaUrgenciaAberto(false);
    setFeedbackSuccess('Alerta emitido à equipe de saúde! Encaminhe o cidadão imediatamente para acolhimento presencial.');
    setTimeout(() => setFeedbackSuccess(null), 6000);
  };

  // Senhas filtradas
  const senhasFiltradas = useMemo(() => {
    return senhas.filter(s => {
      if (filtroStatus !== 'TODOS' && s.status !== filtroStatus) return false;
      if (searchTerm.trim()) {
        const termo = searchTerm.toLowerCase();
        const matchNome = s.cidadao_nome.toLowerCase().includes(termo);
        const matchNum = s.numero.toLowerCase().includes(termo);
        const matchPrio = (s.prioridade_categoria || '').toLowerCase().includes(termo);
        return matchNome || matchNum || matchPrio;
      }
      return true;
    });
  }, [senhas, filtroStatus, searchTerm]);

  // Contadores rápidos
  const contadores = useMemo(() => {
    return {
      aguardando: senhas.filter(s => s.status === 'AGUARDANDO').length,
      chamando: senhas.filter(s => s.status === 'CHAMANDO').length,
      emAtendimento: senhas.filter(s => s.status === 'EM_ATENDIMENTO').length,
      concluidos: senhas.filter(s => s.status === 'CONCLUIDO').length,
      total: senhas.length
    };
  }, [senhas]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col pb-16">
      {/* CABEÇALHO */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  {unidade.sigla} — CONTROLE OPERACIONAL
                </span>
                <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
                  {unidade.tipo === 'UPA' ? 'Recepção Administrativa' : 'Acolhimento & Triagem'}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {unidade.nome}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Seletor de Guichê */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-extrabold uppercase text-slate-500">Meu Guichê:</span>
              <input
                type="text"
                value={guicheAtual}
                onChange={(e) => setGuicheAtual(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 w-24 focus:outline-none"
              />
            </div>

            {/* Botão Configurações */}
            <button
              type="button"
              onClick={() => setModalConfigAberto(true)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Configurar Prioridades e Alternância"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Botão Abrir Senha TV */}
            {onNavigateTV && (
              <button
                type="button"
                onClick={onNavigateTV}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                title="Abrir Painel de TV"
              >
                <Tv className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Senha TV</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex-1 flex flex-col gap-6">
        {/* BANNER INFORMATIVO ESPECÍFICO DA UPA */}
        {unidade.tipo === 'UPA' && (
          <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-amber-950 uppercase tracking-wide">
                  Recepção Administrativa da UPA — Distinção da Triagem Clínica
                </h4>
                <p className="text-xs text-amber-900 mt-0.5">
                  As senhas organizam o atendimento administrativo na recepção. Casos graves devem ser acolhidos presencialmente de imediato.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModalUpaUrgenciaAberto(true)}
              className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-rose-600/20 active:scale-95 transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <ShieldAlert className="w-4 h-4" />
              Solicitar Avaliação Imediata
            </button>
          </div>
        )}

        {/* FEEDBACK DE AÇÃO */}
        {feedbackSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackSuccess}</span>
          </div>
        )}

        {/* GRID SUPERIOR: CADASTRO DE SENHA + AÇÃO PRINCIPAL CHAMAR */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CARD DE CADASTRO E EMISSÃO DE SENHA (COL 7) */}
          <section className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-emerald-600" />
                  Emitir Nova Senha
                </h2>
                <span className="text-xs font-bold text-slate-400">
                  Data: {getDataOperacionalHoje()}
                </span>
              </div>

              <form onSubmit={handleGerarSenha} className="space-y-4">
                {/* Nome do Cidadão */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Nome Completo do Cidadão *
                  </label>
                  <input
                    type="text"
                    required
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Ex: Maria das Graças Silva"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Seleção de Prioridade Legal */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNovaPrioridade('NORMAL');
                      setNovaCategoria('Geral');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      novaPrioridade === 'NORMAL'
                        ? 'border-sky-500 bg-sky-50/80 ring-2 ring-sky-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900 uppercase">Normal</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold bg-sky-100 text-sky-800">N000</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">Fila geral sem preferência legal.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNovaPrioridade('PRIORITARIO');
                      setNovaCategoria('Idoso (60 a 79 anos)');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      novaPrioridade === 'PRIORITARIO'
                        ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900 uppercase">Prioritário</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold bg-emerald-100 text-emerald-800">P000</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">Idoso 60-79, PCD, Gestante, TEA.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNovaPrioridade('ESPECIAL');
                      setNovaCategoria('Idoso 80+ (Prioridade Especial)');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      novaPrioridade === 'ESPECIAL'
                        ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900 uppercase">Especial</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold bg-amber-100 text-amber-800">E000</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">Idoso 80+ (Lei 13.466/17).</p>
                  </button>
                </div>

                {/* Subcategoria legal caso prioritário ou especial */}
                {novaPrioridade !== 'NORMAL' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide">
                      Categoria Legal Assegurada
                    </label>
                    <select
                      value={novaCategoria}
                      onChange={(e) => setNovaCategoria(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-800"
                    >
                      {novaPrioridade === 'ESPECIAL' ? (
                        <>
                          <option value="Idoso 80+ (Prioridade Especial)">Idoso 80+ anos (Lei 13.466/17)</option>
                          <option value="PCD com Acompanhante Necessário">PCD com Necessidade Especial Grave</option>
                          <option value="Outra Prioridade Especial">Outra Prioridade Especial</option>
                        </>
                      ) : (
                        <>
                          <option value="Idoso (60 a 79 anos)">Idoso (60 a 79 anos)</option>
                          <option value="Pessoa com Deficiência (PCD)">Pessoa com Deficiência (PCD)</option>
                          <option value="Pessoa com TEA (Autismo)">Pessoa com Transtorno do Espectro Autista (TEA)</option>
                          <option value="Gestante">Gestante</option>
                          <option value="Lactante">Lactante</option>
                          <option value="Criança de Colo">Pessoa com Criança de Colo</option>
                          <option value="Outra Prioridade Legal">Outra Prioridade Assegurada</option>
                        </>
                      )}
                    </select>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isGerando || !novoNome.trim()}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    {isGerando ? 'Registrando Senha...' : 'Gerar Senha e Inserir na Fila'}
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* CARD DE CHAMADA DO PRÓXIMO + RESUMO RÁPIDO (COL 5) */}
          <section className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" />
                  Chamada Automática
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-bold">
                  {contadores.aguardando} na espera
                </span>
              </div>

              <div className="text-center py-4">
                <p className="text-xs text-slate-400 font-medium mb-1">Regra de Seleção Vigente:</p>
                <div className="inline-block px-3 py-1 rounded-xl bg-white/10 text-emerald-300 font-extrabold text-xs uppercase tracking-wider mb-4">
                  {config?.regra_alternancia === '1_P_1_N' ? '1 Prioritário : 1 Normal' :
                   config?.regra_alternancia === '3_P_1_N' ? '3 Prioritários : 1 Normal' :
                   '2 Prioritários : 1 Normal (Padrão Legal)'}
                </div>

                <button
                  type="button"
                  onClick={handleChamarProximo}
                  disabled={contadores.aguardando === 0}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-base sm:text-lg uppercase tracking-wider rounded-2xl shadow-xl shadow-emerald-500/25 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Bell className="w-5 h-5 animate-bounce" />
                  Chamar Próximo Cidadão
                </button>
              </div>
            </div>

            {/* Painel de Contadores Rápidos */}
            <div className="grid grid-cols-4 gap-2 pt-4 border-t border-white/10 text-center">
              <div className="p-2 rounded-xl bg-white/5">
                <div className="text-lg font-black text-emerald-400 font-mono">{contadores.aguardando}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">Espera</div>
              </div>
              <div className="p-2 rounded-xl bg-white/5">
                <div className="text-lg font-black text-sky-400 font-mono">{contadores.chamando}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">Chamando</div>
              </div>
              <div className="p-2 rounded-xl bg-white/5">
                <div className="text-lg font-black text-amber-400 font-mono">{contadores.emAtendimento}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">Em Atend.</div>
              </div>
              <div className="p-2 rounded-xl bg-white/5">
                <div className="text-lg font-black text-purple-400 font-mono">{contadores.concluidos}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">Concluídos</div>
              </div>
            </div>
          </section>
        </div>

        {/* FILA DE ATENDIMENTO DA UNIDADE */}
        <section className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Fila de Atendimento do Dia
              </h3>
              <p className="text-xs text-slate-500">
                Acompanhamento em tempo real das senhas emitidas, tempos de espera e ações de chamada.
              </p>
            </div>

            {/* Filtros e Busca */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar senha ou cidadão..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500"
                />
              </div>

              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="AGUARDANDO">Aguardando</option>
                <option value="CHAMANDO">Chamando</option>
                <option value="EM_ATENDIMENTO">Em Atendimento</option>
                <option value="CONCLUIDO">Concluído</option>
                <option value="NAO_COMPARECEU">Não Compareceu</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
          </div>

          {/* TABELA DE SENHAS */}
          <div className="overflow-x-auto border border-slate-200/70 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Senha</th>
                  <th className="py-3 px-4">Cidadão</th>
                  <th className="py-3 px-4">Prioridade</th>
                  <th className="py-3 px-4">Emissão</th>
                  <th className="py-3 px-4">Espera</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações Operacionais</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {senhasFiltradas.length > 0 ? (
                  senhasFiltradas.map((item) => {
                    const horaEmissao = new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    // Tempo de espera calculado em minutos
                    const esperaMinutos = Math.max(0, Math.floor((Date.now() - new Date(item.created_at).getTime()) / 60000));

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Número */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {item.numero}
                          </span>
                        </td>

                        {/* Nome */}
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {item.cidadao_nome}
                        </td>

                        {/* Prioridade */}
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                            item.prioridade_tipo === 'ESPECIAL' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                            item.prioridade_tipo === 'PRIORITARIO' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {item.prioridade_categoria || item.prioridade_tipo}
                          </span>
                        </td>

                        {/* Horário */}
                        <td className="py-3 px-4 font-mono text-slate-600 font-semibold">
                          {horaEmissao}
                        </td>

                        {/* Tempo de espera */}
                        <td className="py-3 px-4 font-semibold">
                          {item.wait_time_first_call_seconds ? (
                            <span className="text-slate-600">
                              {formatarDuracaoSegundos(item.wait_time_first_call_seconds)}
                            </span>
                          ) : item.status === 'AGUARDANDO' ? (
                            <span className={`font-bold ${esperaMinutos > 30 ? 'text-rose-600' : 'text-slate-700'}`}>
                              {esperaMinutos} min
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                            item.status === 'CHAMANDO' ? 'bg-sky-100 text-sky-800 animate-pulse' :
                            item.status === 'EM_ATENDIMENTO' ? 'bg-amber-100 text-amber-900' :
                            item.status === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-900' :
                            item.status === 'NAO_COMPARECEU' ? 'bg-slate-200 text-slate-700' :
                            item.status === 'CANCELADO' ? 'bg-rose-100 text-rose-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Rechamar */}
                            {(item.status === 'CHAMANDO' || item.status === 'EM_ATENDIMENTO') && (
                              <button
                                type="button"
                                onClick={() => handleRechamar(item.id)}
                                className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                title="Rechamar na TV"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Rechamar ({item.call_count})
                              </button>
                            )}

                            {/* Iniciar Atendimento */}
                            {item.status === 'CHAMANDO' && (
                              <button
                                type="button"
                                onClick={() => handleIniciar(item.id)}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                title="Iniciar Atendimento Efetivo"
                              >
                                <Play className="w-3 h-3" />
                                Iniciar
                              </button>
                            )}

                            {/* Concluir */}
                            {(item.status === 'CHAMANDO' || item.status === 'EM_ATENDIMENTO') && (
                              <button
                                type="button"
                                onClick={() => handleConcluir(item.id)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                title="Concluir Atendimento"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Concluir
                              </button>
                            )}

                            {/* Não compareceu */}
                            {item.status === 'CHAMANDO' && (
                              <button
                                type="button"
                                onClick={() => handleNaoCompareceu(item.id)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                                title="Registrar que o cidadão não compareceu"
                              >
                                Ausente
                              </button>
                            )}

                            {/* Cancelar com justificativa */}
                            {item.status === 'AGUARDANDO' && (
                              <button
                                type="button"
                                onClick={() => setModalCancelarId(item.id)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                                title="Cancelar Senha"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-400 font-semibold">
                      Nenhuma senha encontrada com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* MODAL: CANCELAR SENHA COM JUSTIFICATIVA */}
      {modalCancelarId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-black text-slate-900 mb-2">Cancelar Senha</h3>
            <p className="text-xs text-slate-500 mb-4">
              Informe a justificativa legal ou administrativa obrigatória para o cancelamento deste registro.
            </p>
            <textarea
              required
              rows={3}
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              placeholder="Ex: Cidadão desistiu do atendimento ou transferido para outro posto..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold text-slate-900 focus:bg-white focus:border-rose-500 mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalCancelarId(null);
                  setMotivoCancelamento('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={!motivoCancelamento.trim()}
                onClick={handleConfirmarCancelamento}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 cursor-pointer shadow-sm"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SOLICITAR AVALIAÇÃO IMEDIATA (UPA) */}
      {modalUpaUrgenciaAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-rose-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-2xl bg-rose-600 text-white">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Solicitar Avaliação Imediata (UPA)</h3>
                <p className="text-xs text-slate-500">Comunicação imediata à equipe de enfermagem / acolhimento clínico.</p>
              </div>
            </div>

            <form onSubmit={handleSolicitarUrgenciaUPA} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Cidadão *</label>
                <input
                  type="text"
                  required
                  value={upaUrgenciaNome}
                  onChange={(e) => setUpaUrgenciaNome(e.target.value)}
                  placeholder="Nome do paciente presente na recepção"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo / Queixa Principal Aparente *</label>
                <textarea
                  required
                  rows={3}
                  value={upaUrgenciaQueixa}
                  onChange={(e) => setUpaUrgenciaQueixa(e.target.value)}
                  placeholder="Ex: Dor torácica intensa, falta de ar severa, desmaio na recepção..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                />
              </div>

              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-[11px] text-rose-800 font-medium">
                <strong>Importante:</strong> Esta comunicação digital não substitui o encaminhamento presencial imediato do cidadão à sala de triagem / enfermagem da UPA.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalUpaUrgenciaAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-rose-600/30 cursor-pointer"
                >
                  Registrar e Notificar Equipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURAÇÃO DE PRIORIDADES E ALTERNÂNCIA */}
      {modalConfigAberto && config && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-black text-slate-900 mb-2">Configurar Prioridades — {unidade.nome}</h3>
            <p className="text-xs text-slate-500 mb-4">
              Ajuste as proporções da alternância de chamada e os parâmetros operacionais da unidade.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Modelo de Alternância de Chamada</label>
                <select
                  value={config.regra_alternancia}
                  onChange={(e) => {
                    const regra = e.target.value as any;
                    let propP = 2;
                    let propN = 1;
                    if (regra === '1_P_1_N') { propP = 1; propN = 1; }
                    else if (regra === '3_P_1_N') { propP = 3; propN = 1; }
                    setConfig({ ...config, regra_alternancia: regra, proporcao_prioridade: propP, proporcao_normal: propN });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                >
                  <option value="1_P_1_N">1 Prioritário para 1 Normal (1:1)</option>
                  <option value="2_P_1_N">2 Prioritários para 1 Normal (2:1 — Padrão)</option>
                  <option value="3_P_1_N">3 Prioritários para 1 Normal (3:1)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Nota: Cidadãos maiores de 80 anos (Prioridade Especial) prevalecem sempre no topo absoluto por garantia legal.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Alerta Atenção (Minutos)</label>
                  <input
                    type="number"
                    value={config.limite_espera_atencao_min}
                    onChange={(e) => setConfig({ ...config, limite_espera_atencao_min: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Alerta Crítico (Minutos)</label>
                  <input
                    type="number"
                    value={config.limite_espera_critico_min}
                    onChange={(e) => setConfig({ ...config, limite_espera_critico_min: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mensagem de Rodapé da Senha TV</label>
                <input
                  type="text"
                  value={config.mensagem_rodape_tv || ''}
                  onChange={(e) => setConfig({ ...config, mensagem_rodape_tv: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chkSobrenome"
                  checked={config.ocultar_sobrenome_tv}
                  onChange={(e) => setConfig({ ...config, ocultar_sobrenome_tv: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="chkSobrenome" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Abreviar sobrenome no painel público (Privacidade LGPD)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-6">
              <button
                type="button"
                onClick={() => setModalConfigAberto(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await salvarConfiguracao(config, currentUser?.name || 'Gestor', currentUser?.id);
                  setModalConfigAberto(false);
                  setFeedbackSuccess('Configurações salvas e aplicadas em tempo real!');
                  setTimeout(() => setFeedbackSuccess(null), 4000);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
