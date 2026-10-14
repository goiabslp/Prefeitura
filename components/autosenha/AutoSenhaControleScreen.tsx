import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, PlusCircle, Bell, RotateCcw, Play, CheckCircle2,
  UserX, XCircle, Settings, ShieldAlert, Sparkles, Clock, AlertTriangle,
  Search, Sliders, Volume2, Tv, Users, Activity, FileText, UserCheck, UserPlus, User as UserIcon
} from 'lucide-react';
import {
  AutoSenhaUnidadeId,
  AutoSenhaPrioridadeTipo,
  AutoSenhaPrioridadeCategoria,
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
  formatarDuracaoSegundos,
  getDataOperacionalHoje,
  inicializarSeedSeVazio,
  zerarTodosDadosAutoSenha
} from '../../services/autoSenhaService';
import * as db from '../../services/consultasService';
import { normalizarNumeros, correspondeSequencialNome } from '../../services/pacienteHistoricoService';
import { PacienteFormModal } from '../consultas/pacientes/PacienteFormModal';
import { supabase } from '../../services/supabaseClient';
import { Trash2 } from 'lucide-react';

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

  // Paciente Vinculado para Emissão
  const [pacienteSelecionado, setPacienteSelecionado] = useState<ConsultaPaciente | null>(null);
  const [modalLocalizarAberto, setModalLocalizarAberto] = useState(false);
  const [modalNovoPacienteAberto, setModalNovoPacienteAberto] = useState(false);
  const [buscaPacienteTermo, setBuscaPacienteTermo] = useState('');
  const [buscaPacienteLoading, setBuscaPacienteLoading] = useState(false);
  const [pacientesEncontrados, setPacientesEncontrados] = useState<ConsultaPaciente[]>([]);

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
      .on('broadcast', { event: 'dados_zerados' }, () => carregarDados())
      .subscribe();

    const interval = setInterval(carregarDados, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [unidadeId]);

  // Funções de formatação e busca de pacientes vinculados
  const mascararCpf = (cpf?: string | null): string => {
    if (!cpf) return 'Não informado';
    const limpo = normalizarNumeros(cpf);
    if (limpo.length === 11) {
      return `***.${limpo.substring(3, 6)}.${limpo.substring(6, 9)}-**`;
    }
    return cpf;
  };

  const mascararSus = (sus?: string | null): string => {
    if (!sus) return 'Não informado';
    const limpo = normalizarNumeros(sus);
    if (limpo.length >= 10) {
      return `${limpo.substring(0, 3)}•••••${limpo.substring(limpo.length - 4)}`;
    }
    return sus;
  };

  const calcularIdadeAnos = (nascimentoStr?: string | null): number | null => {
    if (!nascimentoStr) return null;
    const nasc = new Date(nascimentoStr);
    if (isNaN(nasc.getTime())) return null;
    const hoje = new Date();
    let anos = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
    return Math.max(0, anos);
  };

  const handleBuscarPacientes = async (termo: string) => {
    setBuscaPacienteTermo(termo);
    const t = termo.trim();
    if (!t) {
      setPacientesEncontrados([]);
      return;
    }
    setBuscaPacienteLoading(true);
    try {
      const todos = await db.getPacientes();
      const termoNumeros = normalizarNumeros(t);
      const termoIsNum = termoNumeros.length >= 3;

      const filtrados = todos.filter(p => {
        if (termoIsNum) {
          const cpfLimpo = normalizarNumeros(p.cpf);
          const susLimpo = normalizarNumeros(p.sus_number);
          if (cpfLimpo === termoNumeros || (termoNumeros.length >= 6 && cpfLimpo.includes(termoNumeros))) return true;
          if (susLimpo === termoNumeros || (termoNumeros.length >= 6 && susLimpo.includes(termoNumeros))) return true;
        }
        return correspondeSequencialNome(p.name, t);
      });

      setPacientesEncontrados(filtrados.slice(0, 10));
    } catch (err) {
      console.error('Erro ao buscar pacientes:', err);
    } finally {
      setBuscaPacienteLoading(false);
    }
  };

  const handleSelecionarPaciente = (p: ConsultaPaciente) => {
    setPacienteSelecionado(p);
    setNovoNome(p.name);
    setModalLocalizarAberto(false);
    const idade = calcularIdadeAnos(p.birth_date);
    if (idade !== null && idade >= 80) {
      setNovaPrioridade('ESPECIAL');
      setNovaCategoria('Idoso 80+ (Prioridade Especial)');
    } else if (idade !== null && idade >= 60) {
      setNovaPrioridade('PRIORITARIO');
      setNovaCategoria('Idoso (60 a 79 anos)');
    }
  };

  // Ação: Gerar Senha Vinculada ao Paciente
  const handleGerarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pacienteSelecionado) {
      setModalLocalizarAberto(true);
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
        prioridade_tipo: novaPrioridade,
        prioridade_categoria: novaCategoria,
        guiche: guicheAtual,
        atendente_id: currentUser?.id,
        atendente_nome: currentUser?.name || 'Recepção'
      });

      setPacienteSelecionado(null);
      setNovoNome('');
      setNovaPrioridade('NORMAL');
      setNovaCategoria('Geral');
      setFeedbackSuccess(`Senha ${senhaCriada.numero} gerada com sucesso para ${senhaCriada.cidadao_nome}!`);
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

      {/* CONTEÚDO PRINCIPAL (100% DO VIEWPORT SEM CORTES) */}
      <main className="w-full px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 flex-1 flex flex-col gap-2 overflow-hidden min-h-0">
        {/* BANNER INFORMATIVO ESPECÍFICO DA UPA COMPACTO */}
        {unidade.tipo === 'UPA' && (
          <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-1.5 px-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 shadow-2xs shrink-0 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1 rounded-lg bg-amber-500 text-white shrink-0">
                <AlertTriangle className="w-3 h-3" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-amber-950 font-bold leading-tight">
                  <span className="font-black uppercase mr-1">Recepção Administrativa da UPA:</span>
                  As senhas organizam o atendimento no guichê. Casos graves têm acolhimento presencial imediato.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModalUpaUrgenciaAberto(true)}
              className="px-2.5 py-1 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer flex items-center gap-1"
            >
              <ShieldAlert className="w-3 h-3" />
              Solicitar Avaliação Imediata
            </button>
          </div>
        )}

        {/* FEEDBACK DE AÇÃO */}
        {feedbackSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs shrink-0 animate-in fade-in duration-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{feedbackSuccess}</span>
          </div>
        )}

        {/* GRID SUPERIOR: CADASTRO DE SENHA + AÇÃO PRINCIPAL CHAMAR (COMPACTO) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-3 items-stretch shrink-0">
          {/* CARD DE CADASTRO E EMISSÃO DE SENHA (COL 7) */}
          <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-3.5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Emitir Nova Senha
                </h2>
                <span className="text-[10px] font-bold text-slate-400">
                  Data: {getDataOperacionalHoje()}
                </span>
              </div>

              <form onSubmit={handleGerarSenha} className="space-y-2">
                {/* Vínculo Obrigatório de Paciente */}
                {!pacienteSelecionado ? (
                  <div className="p-2 sm:p-2.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                        <UserIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-black uppercase text-slate-900 block leading-tight">
                          Paciente Obrigatório
                        </span>
                        <span className="text-[10px] text-slate-500 leading-none">
                          Vincule um munícipe para gerar a senha.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setBuscaPacienteTermo('');
                          setPacientesEncontrados([]);
                          setModalLocalizarAberto(true);
                        }}
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Search className="w-3 h-3" />
                        Localizar Paciente
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalNovoPacienteAberto(true)}
                        className="px-2.5 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <PlusCircle className="w-3 h-3 text-emerald-600" />
                        Novo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                        <UserCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black uppercase text-slate-900 truncate">
                            {pacienteSelecionado.name}
                          </span>
                          {pacienteSelecionado.nickname && (
                            <span className="text-[8px] text-emerald-700 font-bold px-1 rounded bg-emerald-100 shrink-0">
                              "{pacienteSelecionado.nickname}"
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-1.5 text-[9px] text-slate-600 font-medium">
                          <span>CPF: {mascararCpf(pacienteSelecionado.cpf)}</span>
                          <span>•</span>
                          <span>SUS: {mascararSus(pacienteSelecionado.sus_number)}</span>
                          {calcularIdadeAnos(pacienteSelecionado.birth_date) !== null && (
                            <>
                              <span>•</span>
                              <strong className="text-emerald-800 font-black">
                                {calcularIdadeAnos(pacienteSelecionado.birth_date)} anos
                              </strong>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPacienteSelecionado(null);
                        setBuscaPacienteTermo('');
                        setPacientesEncontrados([]);
                        setModalLocalizarAberto(true);
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[9px] font-black text-slate-700 uppercase tracking-wider shrink-0 cursor-pointer self-end sm:self-center"
                    >
                      Trocar
                    </button>
                  </div>
                )}

                {/* Seleção de Prioridade Legal */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNovaPrioridade('NORMAL');
                      setNovaCategoria('Geral');
                    }}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      novaPrioridade === 'NORMAL'
                        ? 'border-sky-500 bg-sky-50/80 ring-2 ring-sky-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-black text-slate-900 uppercase">Normal</span>
                      <span className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-sky-100 text-sky-800">N000</span>
                    </div>
                    <p className="text-[9px] text-slate-500 leading-tight">Fila geral.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNovaPrioridade('PRIORITARIO');
                      setNovaCategoria('Idoso (60 a 79 anos)');
                    }}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      novaPrioridade === 'PRIORITARIO'
                        ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-black text-slate-900 uppercase">Prioritário</span>
                      <span className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-emerald-100 text-emerald-800">P000</span>
                    </div>
                    <p className="text-[9px] text-slate-500 leading-tight">Idoso 60-79, PCD.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNovaPrioridade('ESPECIAL');
                      setNovaCategoria('Idoso 80+ (Prioridade Especial)');
                    }}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      novaPrioridade === 'ESPECIAL'
                        ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-black text-slate-900 uppercase">Especial</span>
                      <span className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-amber-100 text-amber-800">E000</span>
                    </div>
                    <p className="text-[9px] text-slate-500 leading-tight">Idoso 80+.</p>
                  </button>
                </div>

                {/* Subcategoria legal caso prioritário ou especial */}
                {novaPrioridade !== 'NORMAL' && (
                  <div>
                    <select
                      value={novaCategoria}
                      onChange={(e) => setNovaCategoria(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-xl px-2.5 py-1 text-[10px] font-bold text-slate-800"
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

                <div className="pt-0.5">
                  <button
                    type="submit"
                    disabled={isGerando || !pacienteSelecionado}
                    className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    {isGerando
                      ? 'Registrando Senha...'
                      : pacienteSelecionado
                      ? `Gerar Senha para ${pacienteSelecionado.name.split(' ')[0]} e Inserir na Fila`
                      : 'Localize ou Cadastre um Paciente para Emitir'}
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* CARD DE CHAMADA DO PRÓXIMO + RESUMO RÁPIDO (COL 5) */}
          <section className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-3 sm:p-3.5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Bell className="w-3 h-3" />
                  Chamada Automática
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-bold">
                  {contadores.aguardando} na espera
                </span>
              </div>

              <div className="text-center py-2">
                <div className="inline-block px-2.5 py-0.5 rounded-lg bg-white/10 text-emerald-300 font-extrabold text-[10px] uppercase tracking-wider mb-2">
                  {config?.regra_alternancia === '1_P_1_N' ? '1 Prioritário : 1 Normal' :
                   config?.regra_alternancia === '3_P_1_N' ? '3 Prioritários : 1 Normal' :
                   '2 Prioritários : 1 Normal'}
                </div>

                <button
                  type="button"
                  onClick={handleChamarProximo}
                  disabled={contadores.aguardando === 0}
                  className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/25 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Bell className="w-4 h-4 animate-bounce" />
                  Chamar Próximo Cidadão
                </button>
              </div>
            </div>

            {/* Painel de Contadores Rápidos */}
            <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-white/10 text-center">
              <div className="p-1.5 rounded-lg bg-white/5">
                <div className="text-base font-black text-emerald-400 font-mono leading-tight">{contadores.aguardando}</div>
                <div className="text-[8px] font-bold text-slate-400 uppercase">Espera</div>
              </div>
              <div className="p-1.5 rounded-lg bg-white/5">
                <div className="text-base font-black text-sky-400 font-mono leading-tight">{contadores.chamando}</div>
                <div className="text-[8px] font-bold text-slate-400 uppercase">Chamando</div>
              </div>
              <div className="p-1.5 rounded-lg bg-white/5">
                <div className="text-base font-black text-amber-400 font-mono leading-tight">{contadores.emAtendimento}</div>
                <div className="text-[8px] font-bold text-slate-400 uppercase">Em Atend.</div>
              </div>
              <div className="p-1.5 rounded-lg bg-white/5">
                <div className="text-base font-black text-purple-400 font-mono leading-tight">{contadores.concluidos}</div>
                <div className="text-[8px] font-bold text-slate-400 uppercase">Concluídos</div>
              </div>
            </div>
          </section>
        </div>

        {/* FILA DE ATENDIMENTO DA UNIDADE (EXPANSÃO TOTAL E SCROLL INTERNO) */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-2.5 sm:p-3 shadow-xs flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
                  Fila de Atendimento do Dia
                </h3>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {senhasFiltradas.length} {senhasFiltradas.length === 1 ? 'registro' : 'registros'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                Acompanhamento em tempo real das senhas emitidas, tempos de espera e ações de chamada.
              </p>
            </div>

            {/* Filtros e Busca */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar senha ou cidadão..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2.5 py-1 text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500"
                />
              </div>

              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700"
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

          {/* TABELA DE SENHAS COM SCROLL VERTICAL DEDICADO */}
          <div className="overflow-x-auto overflow-y-auto border border-slate-200/70 rounded-xl flex-1 min-h-0 custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100/90 backdrop-blur-xs border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                  <th className="py-2 px-3">Senha</th>
                  <th className="py-2 px-3">Cidadão</th>
                  <th className="py-2 px-3">Prioridade</th>
                  <th className="py-2 px-3">Emissão</th>
                  <th className="py-2 px-3">Espera</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Ações Operacionais</th>
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
                        <td className="py-1.5 sm:py-2 px-3">
                          <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            {item.numero}
                          </span>
                        </td>

                        {/* Nome */}
                        <td className="py-1.5 sm:py-2 px-3 font-bold text-slate-800">
                          {item.cidadao_nome}
                        </td>

                        {/* Prioridade */}
                        <td className="py-1.5 sm:py-2 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                            item.prioridade_tipo === 'ESPECIAL' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                            item.prioridade_tipo === 'PRIORITARIO' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {item.prioridade_categoria || item.prioridade_tipo}
                          </span>
                        </td>

                        {/* Horário */}
                        <td className="py-1.5 sm:py-2 px-3 font-mono text-slate-600 font-semibold text-[11px]">
                          {horaEmissao}
                        </td>

                        {/* Tempo de espera */}
                        <td className="py-1.5 sm:py-2 px-3 font-semibold text-xs">
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
                        <td className="py-1.5 sm:py-2 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
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
                        <td className="py-1.5 sm:py-2 px-3 text-right">
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
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm('Atenção: Deseja realmente zerar todos os registros de senhas do AutoSenha para iniciar em produção?')) {
                        await zerarTodosDadosAutoSenha();
                        await carregarDados();
                        setModalConfigAberto(false);
                        setFeedbackSuccess('Todos os registros foram zerados com sucesso para produção!');
                        setTimeout(() => setFeedbackSuccess(null), 5000);
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                    Zerar Agora
                  </button>
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

      {/* MODAL LOCALIZAR PACIENTE */}
      {modalLocalizarAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Localizar Paciente
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Pesquise por CPF, Cartão SUS ou Nome Completo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalLocalizarAberto(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Input de Busca */}
            <div className="space-y-3 mb-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={buscaPacienteTermo}
                  onChange={(e) => handleBuscarPacientes(e.target.value)}
                  placeholder="Digite CPF (11 dígitos), Cartão SUS ou Nome..."
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 transition-all"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span>Correspondência exata para CPF/SUS e sequencial por nome.</span>
                <button
                  type="button"
                  onClick={() => {
                    setModalLocalizarAberto(false);
                    setModalNovoPacienteAberto(true);
                  }}
                  className="text-emerald-700 hover:text-emerald-900 font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  + Cadastrar Novo Paciente
                </button>
              </div>
            </div>

            {/* Lista de Resultados */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 min-h-[220px]">
              {buscaPacienteLoading && (
                <div className="py-12 text-center text-xs text-slate-400 font-bold">
                  Buscando na base oficial de pacientes...
                </div>
              )}

              {!buscaPacienteLoading && pacientesEncontrados.length > 0 && (
                pacientesEncontrados.map((p) => {
                  const idade = calcularIdadeAnos(p.birth_date);
                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-2xl border border-slate-200/90 hover:border-emerald-500/80 hover:bg-emerald-50/30 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-black text-slate-900 uppercase truncate">
                            {p.name}
                          </strong>
                          {p.nickname && (
                            <span className="text-[9px] text-slate-500 font-bold px-1.5 py-0.2 rounded bg-slate-100 truncate">
                              "{p.nickname}"
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-1">
                          <span>CPF: {mascararCpf(p.cpf)}</span>
                          <span>•</span>
                          <span>SUS: {mascararSus(p.sus_number)}</span>
                          {idade !== null && (
                            <>
                              <span>•</span>
                              <span className="font-bold text-slate-700">{idade} anos</span>
                              {idade >= 80 && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.2 rounded">
                                  80+ Especial
                                </span>
                              )}
                              {idade >= 60 && idade < 80 && (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.2 rounded">
                                  60+ Prioritário
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelecionarPaciente(p)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shrink-0 shadow-sm cursor-pointer"
                      >
                        Selecionar
                      </button>
                    </div>
                  );
                })
              )}

              {!buscaPacienteLoading && buscaPacienteTermo.trim() && pacientesEncontrados.length === 0 && (
                <div className="py-10 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-600">
                    Nenhum paciente localizado com o termo informado.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Cadastre o cidadão no Cadastro Único sem sair da tela.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setModalLocalizarAberto(false);
                      setModalNovoPacienteAberto(true);
                    }}
                    className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 cursor-pointer shadow-sm inline-flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    + Cadastrar Novo Paciente Agora
                  </button>
                </div>
              )}

              {!buscaPacienteLoading && !buscaPacienteTermo.trim() && (
                <div className="py-12 text-center text-xs text-slate-400 font-medium">
                  Digite para localizar pelo CPF, Cartão SUS ou início do nome.
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setModalLocalizarAberto(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO DE NOVO PACIENTE (INTEGRADO À CENTRAL ÚNICA) */}
      {modalNovoPacienteAberto && (
        <PacienteFormModal
          isOpen={modalNovoPacienteAberto}
          onClose={() => setModalNovoPacienteAberto(false)}
          onSuccess={(novoPaciente) => {
            setPacienteSelecionado(novoPaciente);
            setModalNovoPacienteAberto(false);
            setModalLocalizarAberto(false);
            const idade = calcularIdadeAnos(novoPaciente.birth_date);
            if (idade !== null && idade >= 80) {
              setNovaPrioridade('ESPECIAL');
              setNovaCategoria('Idoso 80+ (Prioridade Especial)');
            } else if (idade !== null && idade >= 60) {
              setNovaPrioridade('PRIORITARIO');
              setNovaCategoria('Idoso (60 a 79 anos)');
            }
            setFeedbackSuccess(`Paciente ${novoPaciente.name} cadastrado com sucesso! Prossiga com a emissão da senha.`);
            setTimeout(() => setFeedbackSuccess(null), 5000);
          }}
        />
      )}
    </div>
  );
};
