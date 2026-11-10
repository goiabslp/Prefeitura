import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, CheckCircle2, Settings, ShieldAlert,
  Tv, Trash2, AlertCircle
} from 'lucide-react';
import {
  AutoSenhaUnidadeId,
  AutoSenhaItem,
  AutoSenhaConfiguracao,
  User,
  ConsultaPaciente
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
  getDataOperacionalHoje,
  inicializarSeedSeVazio,
  zerarTodosDadosAutoSenha
} from '../../services/autoSenhaService';
import { PacienteFormModal } from '../consultas/pacientes/PacienteFormModal';
import { AutoSenhaEmissaoCard, AutoSenhaClassificacaoAtendimento } from './AutoSenhaEmissaoCard';
import { AutoSenhaChamadaCard } from './AutoSenhaChamadaCard';
import { HistoricoFilaModal } from './HistoricoFilaModal';
import { calculateAgeYears, formatCpf } from '../../utils/cpfUtils';
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

  // Paciente Vinculado para Emissão
  const [pacienteSelecionado, setPacienteSelecionado] = useState<ConsultaPaciente | null>(null);
  const [pacienteLocalizadoMeta, setPacienteLocalizadoMeta] = useState<{ isNew: boolean } | null>(null);
  const [modalNovoPacienteAberto, setModalNovoPacienteAberto] = useState(false);

  // Classificação e Ação Principal
  const [novoNome, setNovoNome] = useState('');
  const [classificacaoSelecionada, setClassificacaoSelecionada] = useState<AutoSenhaClassificacaoAtendimento>('NORMAL');
  const [isGerando, setIsGerando] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [ausenteConfirmId, setAusenteConfirmId] = useState<string | null>(null);
  const [confirmarZeragemInline, setConfirmarZeragemInline] = useState(false);

  // Modais
  const [modalHistoricoFilaAberto, setModalHistoricoFilaAberto] = useState(false);
  const [modalCancelarId, setModalCancelarId] = useState<string | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [modalConfigAberto, setModalConfigAberto] = useState(false);
  const [modalUpaUrgenciaAberto, setModalUpaUrgenciaAberto] = useState(false);
  const [upaUrgenciaNome, setUpaUrgenciaNome] = useState('');
  const [upaUrgenciaQueixa, setUpaUrgenciaQueixa] = useState('');

  const mostrarErro = (msg: string) => {
    setFeedbackError(msg);
    setTimeout(() => setFeedbackError(null), 5000);
  };

  const mostrarSucesso = (msg: string, ms = 4000) => {
    setFeedbackError(null);
    setFeedbackSuccess(msg);
    setTimeout(() => setFeedbackSuccess(null), ms);
  };

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
      .on('broadcast', { event: 'dados_zerados' }, () => carregarDados())
      .subscribe();

    const interval = setInterval(carregarDados, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [unidadeId]);

  const handleSelecionarPaciente = (p: ConsultaPaciente, meta?: { isNew: boolean }) => {
    setPacienteSelecionado(p);
    setPacienteLocalizadoMeta(meta || { isNew: false });
    setNovoNome(p.name);
    if (classificacaoSelecionada !== 'AVALIACAO_IMEDIATA') {
      const idade = calculateAgeYears(p.birth_date);
      if (idade !== null && idade >= 80) {
        setClassificacaoSelecionada('ESPECIAL');
      } else if (idade !== null && idade >= 60) {
        setClassificacaoSelecionada('PRIORITARIO');
      }
    }
  };

  // Ação Principal Adaptável: Emissão de Senha OU Solicitação de Avaliação Imediata
  const handleAcaoPrincipal = async (e: React.FormEvent) => {
    e.preventDefault();

    if (classificacaoSelecionada === 'AVALIACAO_IMEDIATA') {
      setUpaUrgenciaNome(pacienteSelecionado?.name || '');
      setUpaUrgenciaQueixa('');
      setModalUpaUrgenciaAberto(true);
      return;
    }

    if (!pacienteSelecionado) {
      setModalNovoPacienteAberto(true);
      return;
    }

    setIsGerando(true);
    try {
      const senhaCriada = await gerarSenha({
        unidade_id: unidadeId,
        paciente_id: pacienteSelecionado.id,
        paciente_cpf: pacienteSelecionado.cpf,
        paciente_cartao_sus: pacienteSelecionado.sus_number,
        cidadao_nome: pacienteSelecionado.name,
        prioridade_tipo: classificacaoSelecionada,
        prioridade_categoria: classificacaoSelecionada === 'NORMAL' ? 'Geral' : undefined,
        guiche: guicheAtual,
        atendente_id: currentUser?.id,
        atendente_nome: currentUser?.name || 'Recepção'
      });

      setPacienteSelecionado(null);
      setPacienteLocalizadoMeta(null);
      setNovoNome('');
      setClassificacaoSelecionada('NORMAL');
      mostrarSucesso(`Senha ${senhaCriada.numero} gerada com sucesso para ${senhaCriada.cidadao_nome}!`);
      await carregarDados();
    } catch (err: any) {
      console.error(err);
      mostrarErro(err?.message || 'Não foi possível emitir a senha.');
    } finally {
      setIsGerando(false);
    }
  };

  // Ação: Chamar Próximo
  const handleChamarProximo = async () => {
    try {
      const res = await chamarProximo(
        unidadeId,
        guicheAtual,
        currentUser?.name || 'Recepção',
        currentUser?.id
      );

      if (res.senhaChamada) {
        mostrarSucesso(`Chamando senha ${res.senhaChamada.numero} (${res.senhaChamada.cidadao_nome})`);
        await carregarDados();
      } else if (res.mensagem) {
        mostrarErro(res.mensagem);
      }
    } catch (err: any) {
      mostrarErro(err?.message || 'Não foi possível realizar a chamada.');
    }
  };

  // Ação: Rechamar
  const handleRechamar = async (senhaId: string) => {
    try {
      await rechamarSenha(senhaId, guicheAtual, currentUser?.name || 'Recepção', currentUser?.id, unidadeId);
      await carregarDados();
    } catch (err: any) {
      mostrarErro(err?.message || 'Falha ao rechamar senha.');
    }
  };

  // Ação: Iniciar
  const handleIniciar = async (senhaId: string) => {
    try {
      await iniciarAtendimento(senhaId, currentUser?.name || 'Recepção', currentUser?.id, unidadeId);
      await carregarDados();
    } catch (err: any) {
      mostrarErro(err?.message || 'Falha ao iniciar atendimento.');
    }
  };

  // Ação: Concluir
  const handleConcluir = async (senhaId: string) => {
    try {
      await concluirAtendimento(senhaId, currentUser?.name || 'Recepção', currentUser?.id, unidadeId);
      await carregarDados();
    } catch (err: any) {
      mostrarErro(err?.message || 'Falha ao concluir atendimento.');
    }
  };

  // Ação: Não Compareceu (confirmação integrada inline na interface)
  const handleNaoCompareceu = async (senhaId: string) => {
    try {
      await registrarNaoCompareceu(senhaId, currentUser?.name || 'Recepção', currentUser?.id, unidadeId);
      setAusenteConfirmId(null);
      await carregarDados();
    } catch (err: any) {
      mostrarErro(err?.message || 'Falha ao registrar ausência.');
    }
  };

  // Ação: Cancelar Senha
  const handleConfirmarCancelamento = async () => {
    if (!modalCancelarId || !motivoCancelamento.trim()) return;
    try {
      await cancelarSenha(
        modalCancelarId,
        motivoCancelamento.trim(),
        currentUser?.name || 'Recepção',
        currentUser?.id,
        unidadeId
      );
      setModalCancelarId(null);
      setMotivoCancelamento('');
      mostrarSucesso('Senha cancelada com justificativa registrada.');
      await carregarDados();
    } catch (err: any) {
      mostrarErro(err?.message || 'Falha ao cancelar senha.');
    }
  };

  // Ação: Solicitar Avaliação Imediata (Encaminhamento Assistencial Presencial sem senha comum)
  const handleSolicitarUrgenciaUPA = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeFinal = (upaUrgenciaNome || pacienteSelecionado?.name || '').trim();
    if (!nomeFinal || !upaUrgenciaQueixa.trim()) return;

    setIsGerando(true);
    try {
      await solicitarAvaliacaoImediataUPA(
        nomeFinal,
        upaUrgenciaQueixa.trim(),
        currentUser?.name || `Recepção ${unidade.sigla}`,
        currentUser?.id,
        undefined,
        undefined,
        unidadeId
      );

      setUpaUrgenciaNome('');
      setUpaUrgenciaQueixa('');
      setModalUpaUrgenciaAberto(false);
      mostrarSucesso('Solicitação de Avaliação Imediata registrada e enviada à equipe assistencial! Encaminhe o cidadão presencialmente sem depender da fila.', 6000);
    } catch (err: any) {
      mostrarErro(err?.message || 'Erro ao registrar alerta de avaliação imediata.');
    } finally {
      setIsGerando(false);
    }
  };

  // Senhas ativas em chamada ou atendimento na unidade (para controles inline na direita)
  const senhasAtivas = useMemo(() => {
    return senhas
      .filter(s => s.unidade_id === unidadeId && (s.status === 'CHAMANDO' || s.status === 'EM_ATENDIMENTO'))
      .sort((a, b) => new Date(b.last_called_at || b.created_at).getTime() - new Date(a.last_called_at || a.created_at).getTime());
  }, [senhas, unidadeId]);

  const regraAlternanciaLabel = useMemo(() => {
    if (config?.regra_alternancia === '1_P_1_N') return '1 PRIORITÁRIO : 1 NORMAL';
    if (config?.regra_alternancia === '3_P_1_N') return '3 PRIORITÁRIOS : 1 NORMAL';
    if (config?.regra_alternancia === 'APENAS_PRIORIDADE') return 'APENAS PRIORIDADE LEGAL';
    return '2 PRIORITÁRIOS : 1 NORMAL';
  }, [config?.regra_alternancia]);

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
    <div className="w-full flex-1 min-w-0 h-full max-h-full bg-slate-50 text-slate-800 flex flex-col overflow-hidden">
      {/* CABEÇALHO (100% VIEWPORT LARGURA TOTAL) */}
      <header className="bg-white border-b border-slate-200 shrink-0 z-20 shadow-2xs w-full">
        <div className="w-full px-3 sm:px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                title="Voltar ao Posto"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  {unidade.sigla} — CONTROLE OPERACIONAL
                </span>
                <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
                  {unidade.tipo === 'UPA' ? 'Recepção Administrativa' : 'Acolhimento & Triagem'}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                {unidade.nome}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Seletor de Guichê */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
              <span className="text-[9px] font-extrabold uppercase text-slate-500">Meu Guichê:</span>
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
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Configurar Prioridades e Alternância"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Botão Abrir Senha TV */}
            {onNavigateTV && (
              <button
                type="button"
                onClick={onNavigateTV}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                title="Abrir Painel de TV"
              >
                <Tv className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Senha TV</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL (2 ÁREAS PRINCIPAIS + HISTÓRICO VIA MODAL) */}
      <main className="w-full px-3 sm:px-4 lg:px-6 py-3 sm:py-4 flex-1 flex flex-col gap-3 overflow-y-auto min-h-0">
        {/* FEEDBACKS DE AÇÃO / ERRO (SEM DIÁLOGOS NATIVOS) */}
        {feedbackSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs shrink-0 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackSuccess}</span>
          </div>
        )}

        {feedbackError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs shrink-0 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{feedbackError}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackError(null)}
              className="text-rose-500 hover:text-rose-800 text-[11px] font-black cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* LAYOUT PRINCIPAL EM DUAS ÁREAS */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12 text-xs font-bold text-slate-400">
            Carregando painel operacional da unidade...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch flex-1 min-h-0">
            {/* ÁREA ESQUERDA: IDENTIFICAÇÃO E EMISSÃO DE SENHA */}
            <section className="lg:col-span-7 flex flex-col min-h-0">
              <AutoSenhaEmissaoCard
                unidadeTipo={unidade.tipo}
                pacienteSelecionado={pacienteSelecionado}
                pacienteLocalizadoMeta={pacienteLocalizadoMeta}
                cidadaoNome={novoNome}
                classificacao={classificacaoSelecionada}
                isSubmitting={isGerando}
                onAbrirLocalizarCpf={() => setModalNovoPacienteAberto(true)}
                onLimparPaciente={() => {
                  setPacienteSelecionado(null);
                  setPacienteLocalizadoMeta(null);
                  setNovoNome('');
                }}
                onClassificacaoChange={setClassificacaoSelecionada}
                onSubmitAcaoPrincipal={handleAcaoPrincipal}
              />
            </section>

            {/* ÁREA DIREITA: CHAMADA AUTOMÁTICA + HISTÓRICO DA FILA + CONFIGURAÇÕES */}
            <section className="lg:col-span-5 flex flex-col min-h-0">
              <AutoSenhaChamadaCard
                regraAlternanciaLabel={regraAlternanciaLabel}
                isSubmitting={isGerando}
                contadores={contadores}
                senhasAtivas={senhasAtivas}
                ausenteConfirmId={ausenteConfirmId}
                onChamarProximo={handleChamarProximo}
                onRechamar={s => handleRechamar(s.id)}
                onIniciar={s => handleIniciar(s.id)}
                onConcluir={s => handleConcluir(s.id)}
                onSolicitarConfirmAusente={setAusenteConfirmId}
                onConfirmarAusente={s => handleNaoCompareceu(s.id)}
                onAbrirModalCancelar={s => setModalCancelarId(s.id)}
                onAbrirHistoricoFila={() => setModalHistoricoFilaAberto(true)}
                onAbrirConfiguracoes={() => {
                  setConfirmarZeragemInline(false);
                  setModalConfigAberto(true);
                }}
              />
            </section>
          </div>
        )}
      </main>

      {/* MODAL: CANCELAR SENHA COM JUSTIFICATIVA */}
      {modalCancelarId && (
        <div className="fixed inset-0 z-[10010] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
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

      {/* MODAL: SOLICITAR AVALIAÇÃO IMEDIATA (ENCAMINHAMENTO ASSISTENCIAL) */}
      {modalUpaUrgenciaAberto && (
        <div className="fixed inset-0 z-[10010] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3.5">
              <div className="p-2.5 rounded-2xl bg-red-600 text-white shrink-0 shadow-sm shadow-red-600/20">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Solicitar Avaliação Imediata
                </h3>
                <p className="text-xs text-slate-500">
                  {unidade.sigla} • Notificação imediata à equipe assistencial
                </p>
              </div>
            </div>

            <form onSubmit={handleSolicitarUrgenciaUPA} className="space-y-3">
              {pacienteSelecionado && (
                <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase text-emerald-700 block">
                      Paciente Selecionado
                    </span>
                    <strong className="text-slate-900 uppercase truncate block">
                      {pacienteSelecionado.name}
                    </strong>
                  </div>
                  {pacienteSelecionado.cpf && (
                    <span className="text-[11px] font-mono font-bold text-emerald-800 shrink-0">
                      {formatCpf(pacienteSelecionado.cpf)}
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Cidadão *</label>
                <input
                  type="text"
                  required
                  value={upaUrgenciaNome}
                  onChange={(e) => setUpaUrgenciaNome(e.target.value)}
                  placeholder="Nome do cidadão presente na recepção"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo / Situação Observada *</label>
                <textarea
                  required
                  rows={3}
                  value={upaUrgenciaQueixa}
                  onChange={(e) => setUpaUrgenciaQueixa(e.target.value)}
                  placeholder="Descreva brevemente o motivo que exige avaliação imediata..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-red-500 outline-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-[11px] text-rose-800 font-medium leading-relaxed">
                <strong>Encaminhamento assistencial:</strong> Este registro aciona imediatamente a equipe presencial e não gera senha comum na fila nem classificação clínica de risco.
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalUpaUrgenciaAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isGerando}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-rose-600/25 cursor-pointer disabled:opacity-60"
                >
                  {isGerando ? 'Enviando...' : 'Confirmar Avaliação Imediata'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURAÇÃO DE PRIORIDADES E ALTERNÂNCIA */}
      {modalConfigAberto && config && (
        <div className="fixed inset-0 z-[10010] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
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

              {/* ZONA DE PRODUÇÃO — ZERAR REGISTROS */}
              <div className="pt-3 border-t border-slate-200">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-black uppercase text-rose-950 block leading-tight">
                      Reiniciar Fila Operacional (Produção)
                    </span>
                    <span className="text-[10px] text-rose-700 leading-tight block">
                      Zera todas as senhas, chamadas e contadores para início limpo.
                    </span>
                  </div>
                  {!confirmarZeragemInline ? (
                    <button
                      type="button"
                      onClick={() => setConfirmarZeragemInline(true)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                      Reiniciar Fila Hoje
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmarZeragemInline(false)}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 text-[10px] font-bold cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await zerarTodosDadosAutoSenha(unidadeId);
                            await carregarDados();
                            setConfirmarZeragemInline(false);
                            setModalConfigAberto(false);
                            mostrarSucesso(`Fila do dia da unidade ${unidade.sigla} reiniciada com sucesso!`, 5000);
                          } catch (err: any) {
                            mostrarErro(err?.message || 'Erro ao reiniciar a fila da unidade.');
                          }
                        }}
                        className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        Confirmar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
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

      {/* MODAL: HISTÓRICO DA FILA E FILA ATUAL */}
      <HistoricoFilaModal
        isOpen={modalHistoricoFilaAberto}
        unidadeId={unidadeId}
        unidadeNome={unidade.nome}
        unidadeSigla={unidade.sigla}
        senhasDia={senhas}
        config={config}
        onClose={() => setModalHistoricoFilaAberto(false)}
        onCancelarSenha={(s) => setModalCancelarId(s.id)}
        onRechamar={(s) => handleRechamar(s.id)}
        onIniciar={(s) => handleIniciar(s.id)}
        onConcluir={(s) => handleConcluir(s.id)}
      />

      {/* MODAL DE LOCALIZAÇÃO POR CPF E CADASTRO INTEGRADO DE PACIENTE */}
      {modalNovoPacienteAberto && (
        <PacienteFormModal
          isOpen={modalNovoPacienteAberto}
          onClose={() => setModalNovoPacienteAberto(false)}
          onSuccess={(pacienteVinculado, meta) => {
            handleSelecionarPaciente(pacienteVinculado, { isNew: Boolean(meta?.isNew) });
            setModalNovoPacienteAberto(false);
            const acaoLabel = meta?.isNew ? 'cadastrado e selecionado' : 'localizado e selecionado';
            mostrarSucesso(`Paciente ${pacienteVinculado.name} ${acaoLabel} com sucesso! Prossiga com o atendimento.`, 5000);
          }}
        />
      )}
    </div>
  );
};
