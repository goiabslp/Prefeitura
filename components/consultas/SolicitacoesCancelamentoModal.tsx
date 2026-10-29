import React, { useState, useEffect } from 'react';
import { ConsultaSolicitacaoCancelamento, User } from '../../types';
import { 
    AlertTriangle, CheckCircle2, XCircle, ChevronLeft, ChevronRight, 
    Clock, ShieldAlert, User as UserIcon, Calendar, FileText, 
    Minimize2, Maximize2, Loader2, ArrowRight, CornerDownRight
} from 'lucide-react';
import * as db from '../../services/consultasService';

interface SolicitacoesCancelamentoModalProps {
    currentUser: User;
    isGestorOrAdmin: boolean;
    onChanged?: () => void;
}

export const SolicitacoesCancelamentoModal: React.FC<SolicitacoesCancelamentoModalProps> = ({
    currentUser,
    isGestorOrAdmin,
    onChanged
}) => {
    const [solicitacoes, setSolicitacoes] = useState<ConsultaSolicitacaoCancelamento[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Estado para rejeição com justificativa obrigatória
    const [isRejecting, setIsRejecting] = useState(false);
    const [justificativaRecusa, setJustificativaRecusa] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Carregar solicitações pendentes
    const carregarSolicitacoes = async () => {
        if (!isGestorOrAdmin) return;
        try {
            const pendentes = await db.getSolicitacoesCancelamentoPendentes();
            setSolicitacoes(pendentes);
            
            if (pendentes.length > 0) {
                // Abre o modal se ainda não estiver minimizado deliberadamente
                if (!isMinimized) {
                    setIsOpen(true);
                }
                // Ajusta índice caso tenha diminuído
                setCurrentIndex(prev => (prev >= pendentes.length ? Math.max(0, pendentes.length - 1) : prev));
            } else {
                setIsOpen(false);
                setIsMinimized(false);
            }
        } catch (err) {
            console.error('[SolicitacoesCancelamentoModal] Erro ao buscar pendências:', err);
        }
    };

    useEffect(() => {
        carregarSolicitacoes();

        const handleRealtime = () => {
            carregarSolicitacoes();
        };

        window.addEventListener('consultas-solicitacoes-cancelamento-changed', handleRealtime);
        window.addEventListener('consultas-agendamentos-changed', handleRealtime);

        return () => {
            window.removeEventListener('consultas-solicitacoes-cancelamento-changed', handleRealtime);
            window.removeEventListener('consultas-agendamentos-changed', handleRealtime);
        };
    }, [isGestorOrAdmin]);

    // Limpar mensagens ao trocar de item
    useEffect(() => {
        setIsRejecting(false);
        setJustificativaRecusa('');
        setFeedbackMessage(null);
    }, [currentIndex]);

    if (!isGestorOrAdmin || solicitacoes.length === 0) {
        return null;
    }

    const currentItem = solicitacoes[currentIndex] || solicitacoes[0];

    const handleNext = () => {
        if (currentIndex < solicitacoes.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    // Ação: Aprovar cancelamento imediatamente
    const handleAprovar = async () => {
        if (!currentItem || isProcessing) return;
        setIsProcessing(true);
        setFeedbackMessage(null);

        try {
            const res = await db.aprovarSolicitacaoCancelamento({
                solicitacaoId: currentItem.id,
                aprovador: { id: currentUser.id, name: currentUser.name }
            });

            if (!res.success) {
                setFeedbackMessage({ type: 'error', text: res.error || 'Erro ao aprovar cancelamento.' });
                setIsProcessing(false);
                return;
            }

            setFeedbackMessage({ type: 'success', text: 'Cancelamento aprovado com sucesso! Agendamento cancelado.' });
            if (onChanged) onChanged();

            // Atualiza lista
            await carregarSolicitacoes();
        } catch (err: any) {
            setFeedbackMessage({ type: 'error', text: err.message || 'Erro inesperado ao aprovar cancelamento.' });
        } finally {
            setIsProcessing(false);
        }
    };

    // Ação: Rejeitar solicitação com justificativa obrigatória
    const handleRejeitar = async () => {
        if (!currentItem || isProcessing) return;
        if (!justificativaRecusa.trim() || justificativaRecusa.trim().length < 5) {
            setFeedbackMessage({ type: 'error', text: 'Informe a justificativa da recusa (mínimo de 5 caracteres).' });
            return;
        }

        setIsProcessing(true);
        setFeedbackMessage(null);

        try {
            const res = await db.rejeitarSolicitacaoCancelamento({
                solicitacaoId: currentItem.id,
                justificativaRecusa: justificativaRecusa.trim(),
                rejeitador: { id: currentUser.id, name: currentUser.name }
            });

            if (!res.success) {
                setFeedbackMessage({ type: 'error', text: res.error || 'Erro ao rejeitar solicitação.' });
                setIsProcessing(false);
                return;
            }

            setFeedbackMessage({ type: 'success', text: 'Solicitação rejeitada com sucesso! Agendamento mantido ativo.' });
            setIsRejecting(false);
            setJustificativaRecusa('');
            if (onChanged) onChanged();

            // Atualiza lista
            await carregarSolicitacoes();
        } catch (err: any) {
            setFeedbackMessage({ type: 'error', text: err.message || 'Erro inesperado ao rejeitar solicitação.' });
        } finally {
            setIsProcessing(false);
        }
    };

    // Formatar data/hora
    const formatDateBr = (d?: string | null) => {
        if (!d) return 'Não definida';
        try {
            const dt = new Date(d);
            return isNaN(dt.getTime()) ? d : dt.toLocaleString('pt-BR');
        } catch (_) {
            return d;
        }
    };

    // SE ESTIVER MINIMIZADO: Exibe um badge/banner persistente e chamativo
    if (isMinimized) {
        return (
            <div className="fixed bottom-6 right-6 z-[99999] animate-in slide-in-from-bottom-4 duration-300">
                <button
                    onClick={() => {
                        setIsMinimized(false);
                        setIsOpen(true);
                    }}
                    className="group flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white rounded-2xl shadow-2xl border border-white/20 hover:scale-102 transition-all cursor-pointer ring-4 ring-amber-500/20 active:scale-98"
                    title="Clique para reabrir e analisar as solicitações pendentes"
                >
                    <div className="relative">
                        <AlertTriangle className="w-5 h-5 text-amber-200 animate-bounce" />
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                        </span>
                    </div>
                    <div className="text-left">
                        <p className="text-[11px] font-black uppercase tracking-wider leading-none">
                            {solicitacoes.length} Solicitaç{solicitacoes.length > 1 ? 'ões' : 'ão'} de Cancelamento
                        </p>
                        <p className="text-[9px] text-amber-100 font-bold uppercase tracking-wider mt-0.5">
                            Aguardando Aprovação da Regulação
                        </p>
                    </div>
                    <div className="ml-1 p-1 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                        <Maximize2 className="w-3.5 h-3.5 text-white" />
                    </div>
                </button>
            </div>
        );
    }

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden border border-slate-200/90 flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header Insistente com Contador */}
                <div className="p-4 sm:p-5 border-b border-amber-100 bg-gradient-to-r from-amber-500 via-rose-500 to-pink-600 text-white flex justify-between items-center shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner">
                            <ShieldAlert className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-black uppercase text-xs sm:text-sm tracking-wide text-white">
                                    Aprovação de Cancelamento Pendente
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-white text-rose-700 shadow-2xs">
                                    {currentIndex + 1} de {solicitacoes.length}
                                </span>
                            </div>
                            <p className="text-[10px] text-amber-100 font-bold uppercase tracking-wider mt-0.5">
                                Regulação Municipal • Decisão Obrigatória de Gestão
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => {
                                setIsMinimized(true);
                                setIsOpen(false);
                            }}
                            className="p-2 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
                            title="Minimizar temporariamente (permanecerá em destaque no rodapé)"
                        >
                            <Minimize2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Body com Scroll Interno Limpo */}
                <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-4 text-xs">
                    {/* Alerta de feedback */}
                    {feedbackMessage && (
                        <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
                            feedbackMessage.type === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                            {feedbackMessage.type === 'success' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            )}
                            <span>{feedbackMessage.text}</span>
                        </div>
                    )}

                    {/* SEÇÃO 1: PACIENTE */}
                    <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span>Dados do Paciente & Procedimento</span>
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                                Protocolo: {currentItem.protocolo || 'N/A'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <span className="text-[9px] font-bold uppercase text-slate-400 block">Nome do Paciente</span>
                                <span className="font-black text-slate-900 text-sm uppercase block truncate">
                                    {currentItem.paciente_nome}
                                </span>
                            </div>
                            <div>
                                <span className="text-[9px] font-bold uppercase text-slate-400 block">CPF</span>
                                <span className="font-mono font-bold text-slate-700 block">
                                    {currentItem.paciente_cpf || 'Não informado'}
                                </span>
                            </div>
                            <div className="sm:col-span-2">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block">Procedimento Solicitado</span>
                                <span className="font-extrabold text-sky-700 text-xs uppercase block">
                                    {currentItem.procedimento_nome}
                                </span>
                            </div>
                            <div>
                                <span className="text-[9px] font-bold uppercase text-slate-400 block">Prioridade</span>
                                <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                    currentItem.prioridade === 'Urgência'
                                        ? 'bg-rose-100 text-rose-700'
                                        : currentItem.prioridade === 'Especial'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                    {currentItem.prioridade || 'Normal'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[9px] font-bold uppercase text-slate-400 block">Situação / Data Agendada</span>
                                <span className="font-bold text-slate-700 block">
                                    {currentItem.data_agendada ? formatDateBr(currentItem.data_agendada) : (currentItem.situacao_agendamento || 'Fila de Espera')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* SEÇÃO 2: SOLICITAÇÃO */}
                    <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-amber-600" />
                                <span>Dados da Solicitação de Cancelamento</span>
                            </span>
                            <span className="text-[9px] font-bold text-amber-700 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                {formatDateBr(currentItem.criado_em)}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                                <span className="text-[9px] font-bold uppercase text-slate-400 block">Usuário Solicitante</span>
                                <span className="font-black text-slate-800 uppercase block">
                                    {currentItem.solicitante_nome}
                                </span>
                            </div>
                            <div>
                                <span className="text-[9px] font-bold uppercase text-slate-400 block">Setor / Unidade</span>
                                <span className="font-bold text-slate-700 block">
                                    {currentItem.solicitante_setor || 'Unidade Básica de Saúde'}
                                </span>
                            </div>
                            <div className="sm:col-span-2 space-y-1">
                                <span className="text-[9px] font-black uppercase tracking-wider text-amber-900 block">
                                    Justificativa do Cancelamento:
                                </span>
                                <div className="p-3 bg-white rounded-xl border border-amber-200 text-slate-800 font-semibold text-xs leading-relaxed italic">
                                    "{currentItem.justificativa_solicitacao}"
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SEÇÃO 3: FORMULÁRIO DE RECUSA (SE O GESTOR CLICAR EM REJEITAR) */}
                    {isRejecting && (
                        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-2 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase tracking-wider text-rose-900 flex items-center gap-1">
                                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Justificativa da Rejeição * (Obrigatória)</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRejecting(false);
                                        setJustificativaRecusa('');
                                    }}
                                    className="text-[9px] font-bold uppercase text-slate-400 hover:text-slate-600"
                                >
                                    Cancelar Recusa
                                </button>
                            </div>
                            <textarea
                                value={justificativaRecusa}
                                onChange={(e) => setJustificativaRecusa(e.target.value)}
                                placeholder="Informe detalhadamente por que este cancelamento não foi autorizado..."
                                rows={3}
                                className="w-full p-2.5 bg-white border border-rose-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
                                required
                            />
                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={handleRejeitar}
                                    disabled={isProcessing || justificativaRecusa.trim().length < 5}
                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                                >
                                    {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                    <span>Confirmar Rejeição da Solicitação</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer com Navegação e Decisão */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    {/* Navegação entre solicitações */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrev}
                            disabled={currentIndex === 0 || isProcessing}
                            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all cursor-pointer disabled:pointer-events-none"
                            title="Solicitação Anterior"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-[10px] font-black uppercase text-slate-500">
                            {currentIndex + 1} / {solicitacoes.length}
                        </span>
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={currentIndex >= solicitacoes.length - 1 || isProcessing}
                            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all cursor-pointer disabled:pointer-events-none"
                            title="Próxima Solicitação"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Ações de Decisão */}
                    {!isRejecting && (
                        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                            <button
                                type="button"
                                onClick={() => setIsRejecting(true)}
                                disabled={isProcessing}
                                className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                                <XCircle className="w-4 h-4 text-rose-600" />
                                <span>Rejeitar Solicitação</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleAprovar}
                                disabled={isProcessing}
                                className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Processando...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 text-white" />
                                        <span>Aprovar Cancelamento</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

