import React, { useState, useEffect } from 'react';
import { ConsultaSolicitacaoCancelamento, User } from '../../types';
import { 
    AlertTriangle, CheckCircle2, XCircle, ChevronLeft, ChevronRight, 
    Clock, ShieldAlert, User as UserIcon, Calendar, FileText, 
    Loader2, Hash, Layers, X
} from 'lucide-react';
import * as db from '../../services/consultasService';

interface SolicitacoesCancelamentoModalProps {
    currentUser: User;
    isGestorOrAdmin: boolean;
    isOpen?: boolean;
    onClose?: () => void;
    onChanged?: () => void;
}

export const SolicitacoesCancelamentoModal: React.FC<SolicitacoesCancelamentoModalProps> = ({
    currentUser,
    isGestorOrAdmin,
    isOpen,
    onClose,
    onChanged
}) => {
    const [solicitacoes, setSolicitacoes] = useState<ConsultaSolicitacaoCancelamento[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    
    // Estado para recusa com justificativa obrigatória
    const [isRejecting, setIsRejecting] = useState(false);
    const [justificativaRecusa, setJustificativaRecusa] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Sincroniza se isOpen externo for reaberto
    useEffect(() => {
        if (isOpen) {
            setIsDismissed(false);
        }
    }, [isOpen]);

    // Fechamento manual do modal pelo botão fechar, 'X', Escape ou backdrop
    const handleCloseModal = () => {
        setIsDismissed(true);
        if (onClose) onClose();
    };

    // Fechar ao pressionar a tecla Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleCloseModal();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Carregar solicitações pendentes direto do banco de dados atualizado
    const carregarSolicitacoes = async () => {
        if (!isGestorOrAdmin) return;
        try {
            const pendentes = await db.getSolicitacoesCancelamentoPendentes();
            setSolicitacoes(pendentes);
            // Ajusta índice caso a quantidade tenha diminuído após decisão
            setCurrentIndex(prev => (prev >= pendentes.length ? Math.max(0, pendentes.length - 1) : prev));
        } catch (err) {
            console.error('[SolicitacoesCancelamentoModal] Erro ao buscar cancelamentos pendentes:', err);
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

    // Visibilidade: respeita isOpen controlado se fornecido, ou estado isDismissed
    const isVisible = (isOpen !== undefined ? isOpen : !isDismissed) && isGestorOrAdmin && solicitacoes.length > 0;
    if (!isVisible) {
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

    // Ação: Confirmar decisão (Aprovar cancelamento ou exclusão)
    const handleConfirmarDecisao = async () => {
        if (!currentItem || isProcessing || isOwnRequest) return;
        setIsProcessing(true);
        setFeedbackMessage(null);

        try {
            const isExclusao = currentItem.tipo === 'Exclusão';
            const aprovador = { 
                id: currentUser.id, 
                name: currentUser.name,
                role: (currentUser as any).role,
                is_admin: (currentUser as any).is_admin,
                access_level: (currentUser as any).access_level
            };

            const res = isExclusao
                ? await db.aprovarSolicitacaoExclusao({
                    solicitacaoId: currentItem.id,
                    aprovador
                })
                : await db.aprovarSolicitacaoCancelamento({
                    solicitacaoId: currentItem.id,
                    aprovador
                });

            if (!res.success) {
                setFeedbackMessage({ type: 'error', text: res.error || `Erro ao aprovar ${isExclusao ? 'exclusão' : 'cancelamento'}.` });
                setIsProcessing(false);
                return;
            }

            setFeedbackMessage({
                type: 'success',
                text: isExclusao
                    ? 'Exclusão confirmada com sucesso! O registro foi retirado das listas operacionais com preservação lógica do histórico.'
                    : 'Cancelamento confirmado com sucesso! A solicitação foi cancelada definitivamente e a fila foi reorganizada.'
            });
            if (onChanged) onChanged();

            // Atualiza lista do banco
            await carregarSolicitacoes();
        } catch (err: any) {
            setFeedbackMessage({ type: 'error', text: err.message || 'Erro inesperado ao aprovar decisão.' });
        } finally {
            setIsProcessing(false);
        }
    };

    // Ação: Recusar solicitação (Cancelamento ou Exclusão) com justificativa obrigatória
    const handleRecusarDecisao = async () => {
        if (!currentItem || isProcessing) return;
        if (!justificativaRecusa.trim() || justificativaRecusa.trim().length < 5) {
            setFeedbackMessage({ type: 'error', text: 'Informe a justificativa da recusa (mínimo de 5 caracteres).' });
            return;
        }

        setIsProcessing(true);
        setFeedbackMessage(null);

        try {
            const isExclusao = currentItem.tipo === 'Exclusão';
            const rejeitador = { 
                id: currentUser.id, 
                name: currentUser.name,
                role: (currentUser as any).role,
                is_admin: (currentUser as any).is_admin,
                access_level: (currentUser as any).access_level
            };

            const res = isExclusao
                ? await db.recusarSolicitacaoExclusao({
                    solicitacaoId: currentItem.id,
                    justificativaRecusa: justificativaRecusa.trim(),
                    rejeitador
                })
                : await db.rejeitarSolicitacaoCancelamento({
                    solicitacaoId: currentItem.id,
                    justificativaRecusa: justificativaRecusa.trim(),
                    rejeitador
                });

            if (!res.success) {
                setFeedbackMessage({ type: 'error', text: res.error || `Erro ao recusar ${isExclusao ? 'exclusão' : 'solicitação'}.` });
                setIsProcessing(false);
                return;
            }

            setFeedbackMessage({
                type: 'success',
                text: isExclusao
                    ? 'Exclusão recusada! O procedimento foi reativado na fila em sua posição original por antiguidade.'
                    : 'Cancelamento recusado! A solicitação foi reativada na fila em sua posição original por antiguidade.'
            });
            setIsRejecting(false);
            setJustificativaRecusa('');
            if (onChanged) onChanged();

            // Atualiza lista do banco
            await carregarSolicitacoes();
        } catch (err: any) {
            setFeedbackMessage({ type: 'error', text: err.message || 'Erro inesperado ao recusar solicitação.' });
        } finally {
            setIsProcessing(false);
        }
    };

    // Formatar data abreviada
    const formatDateBr = (d?: string | null) => {
        if (!d) return 'Não informada';
        try {
            const dt = new Date(d.includes('T') ? d : d + 'T12:00:00');
            return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('pt-BR');
        } catch (_) {
            return d;
        }
    };

    // Formatar data e hora completas
    const formatDateTimeBr = (d?: string | null) => {
        if (!d) return 'Não informada';
        try {
            const dt = new Date(d);
            return isNaN(dt.getTime()) ? d : dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        } catch (_) {
            return d;
        }
    };

    const isOwnRequest = currentItem.solicitante_id === currentUser.id && 
        !(currentUser as any).role?.includes('admin') && 
        !(currentUser as any).is_admin &&
        (currentUser as any).access_level !== 'ADMIN';

    return (
        <div 
            className="fixed inset-0 z-[99999] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200 select-none cursor-pointer"
            role="dialog"
            aria-modal="true"
            onClick={handleCloseModal}
        >
            <div 
                className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden border border-amber-200/90 flex flex-col animate-in zoom-in-95 duration-200 cursor-default"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Compacto e Responsivo */}
                <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-amber-200 bg-gradient-to-r from-amber-600 via-rose-600 to-rose-700 text-white flex justify-between items-center shrink-0 shadow-sm">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner shrink-0">
                            <ShieldAlert className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-black uppercase text-xs sm:text-sm tracking-wide text-white truncate">
                                    Análise de Solicitações — Cancelamento e Exclusão
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black uppercase bg-white text-rose-700 shadow-2xs shrink-0">
                                    {currentIndex + 1} de {solicitacoes.length} {solicitacoes.length === 1 ? 'pendente' : 'pendentes'}
                                </span>
                            </div>
                            <p className="text-[10px] text-amber-100 font-bold uppercase tracking-wider truncate mt-0.5 hidden xs:block">
                                Regulação Municipal • Análise e Decisão Exclusiva do Gestor
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                        <div className="px-2.5 py-1 rounded-xl bg-black/20 text-amber-100 text-[9.5px] font-extrabold uppercase tracking-wider border border-white/10 hidden md:block">
                            Decisão do Gestor
                        </div>
                        <button
                            type="button"
                            onClick={handleCloseModal}
                            className="p-1.5 hover:bg-white/20 active:bg-white/30 rounded-xl text-white transition-colors cursor-pointer flex items-center justify-center shrink-0"
                            title="Fechar modal de cancelamento"
                            aria-label="Fechar"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>

                {/* Body Compacto com Grid Responsivo sem Rolagem em Desktop */}
                <div className="p-3.5 sm:p-4 md:p-5 overflow-y-auto custom-scrollbar space-y-3 text-xs select-text">
                    {/* Alerta de feedback */}
                    {feedbackMessage && (
                        <div className={`p-2.5 sm:p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
                            feedbackMessage.type === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                            {feedbackMessage.type === 'success' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            )}
                            <span className="leading-snug">{feedbackMessage.text}</span>
                        </div>
                    )}

                    {isOwnRequest && (
                        <div className="p-2.5 sm:p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Atenção: Você foi o solicitante deste pedido. A decisão deve ser proferida por outro gestor ou administrador.</span>
                        </div>
                    )}

                    {/* SEÇÃO 1: DADOS DO PACIENTE & PROCEDIMENTO */}
                    <div className="p-3 sm:p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span>Dados do Paciente & Procedimento</span>
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 font-mono">
                                Protocolo: {currentItem.protocolo || 'N/A'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                            {/* Paciente e Procedimento (Coluna Principal) */}
                            <div className="md:col-span-7 space-y-2">
                                {/* 1. Nome do Paciente */}
                                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                    <span className="text-[9px] font-bold uppercase text-slate-400 block">1. Nome do Paciente</span>
                                    <div className="flex items-baseline justify-between gap-2 mt-0.5">
                                        <span className="font-black text-slate-900 text-xs sm:text-sm uppercase truncate">
                                            {currentItem.paciente_nome}
                                        </span>
                                        {currentItem.paciente_cpf && (
                                            <span className="text-[10px] font-mono font-semibold text-slate-500 shrink-0">
                                                CPF: {currentItem.paciente_cpf}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* 2. Procedimento e Código */}
                                <div className="p-2 sm:p-2.5 bg-sky-50/70 rounded-xl border border-sky-200/80">
                                    <span className="text-[9px] font-black uppercase text-sky-800 block">2. Procedimento e Código</span>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        {currentItem.procedimento_codigo && (
                                            <span className="px-1.5 py-0.5 bg-sky-600 text-white rounded font-mono font-black text-[10px]">
                                                CÓD. {currentItem.procedimento_codigo}
                                            </span>
                                        )}
                                        <span className="font-extrabold text-sky-950 text-xs sm:text-sm uppercase leading-snug">
                                            {currentItem.procedimento_nome}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Metadados da Solicitação: Data, Prioridade e Posição (Coluna Lateral) */}
                            <div className="md:col-span-5 space-y-2 flex flex-col justify-between">
                                <div className="grid grid-cols-2 gap-2">
                                    {/* 3. Data Original da Solicitação */}
                                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                                        <span className="text-[9px] font-bold uppercase text-slate-400 block flex items-center gap-1">
                                            <Calendar className="w-3 h-3 text-slate-400" />
                                            <span>Data Original</span>
                                        </span>
                                        <span className="font-black text-slate-800 text-xs mt-0.5 block truncate">
                                            {formatDateBr(currentItem.data_original_solicitacao || currentItem.criado_em)}
                                        </span>
                                    </div>

                                    {/* 4. Prioridade */}
                                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                                        <span className="text-[9px] font-bold uppercase text-slate-400 block flex items-center gap-1">
                                            <Layers className="w-3 h-3 text-slate-400" />
                                            <span>Prioridade</span>
                                        </span>
                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider mt-0.5 ${
                                            currentItem.prioridade === 'Urgência'
                                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                : currentItem.prioridade === 'Especial'
                                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        }`}>
                                            {currentItem.prioridade || 'Normal'}
                                        </span>
                                    </div>
                                </div>

                                {/* 5. Posição Anterior na Fila */}
                                <div className="p-2 sm:p-2.5 bg-amber-50/70 rounded-xl border border-amber-200">
                                    <span className="text-[9px] font-black uppercase text-amber-900 block flex items-center gap-1">
                                        <Hash className="w-3 h-3 text-amber-700" />
                                        <span>5. Posição Anterior na Fila</span>
                                    </span>
                                    <div className="flex items-center justify-between gap-1.5 mt-0.5 flex-wrap">
                                        <span className="font-mono font-black text-amber-950 text-xs sm:text-sm">
                                            {currentItem.posicao_anterior ? `${currentItem.posicao_anterior}º Lugar na Fila` : 'Fila de Espera (Posição Suspensa)'}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded text-[8.5px] font-extrabold bg-amber-200 text-amber-900 uppercase">
                                            Suspensa
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SEÇÃO 2: DADOS DO PEDIDO (CANCELAMENTO OU EXCLUSÃO) */}
                    {(() => {
                        const isExclusao = currentItem.tipo === 'Exclusão';
                        const tipoLabel = isExclusao ? 'Exclusão' : 'Cancelamento';

                        let motivoText = currentItem.motivo || '';
                        let justificativaText = currentItem.justificativa_solicitacao || '';
                        if (!motivoText && justificativaText.startsWith('[')) {
                            const closeIdx = justificativaText.indexOf(']');
                            if (closeIdx > 1) {
                                motivoText = justificativaText.slice(1, closeIdx).trim();
                                justificativaText = justificativaText.slice(closeIdx + 1).trim();
                            }
                        }

                        return (
                            <>
                                <div className={`p-3 sm:p-3.5 rounded-2xl border space-y-2.5 ${
                                    isExclusao 
                                        ? 'bg-purple-50/60 border-purple-200/80' 
                                        : 'bg-amber-50/60 border-amber-200/80'
                                }`}>
                                    <div className="flex items-center justify-between border-b pb-1.5 border-slate-200/80">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                            <FileText className={`w-3.5 h-3.5 ${isExclusao ? 'text-purple-700' : 'text-amber-700'}`} />
                                            <span>Dados da Solicitação de {tipoLabel}</span>
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider font-mono ${
                                            isExclusao 
                                                ? 'bg-purple-100 text-purple-900 border border-purple-300' 
                                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                                        }`}>
                                            Tipo: {tipoLabel}
                                        </span>
                                    </div>

                                    {/* Metadados: Solicitante, Setor, Data/Horário e Motivo */}
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                        {/* Usuário Solicitante */}
                                        <div className="p-2 bg-white/80 rounded-xl border border-slate-200">
                                            <span className="text-[9px] font-bold uppercase text-slate-500 block">Usuário Solicitante</span>
                                            <span className="font-black text-slate-900 uppercase block text-xs mt-0.5 truncate" title={currentItem.solicitante_nome}>
                                                {currentItem.solicitante_nome}
                                            </span>
                                        </div>

                                        {/* Setor Responsável */}
                                        <div className="p-2 bg-white/80 rounded-xl border border-slate-200">
                                            <span className="text-[9px] font-bold uppercase text-slate-500 block">Setor Responsável</span>
                                            <span className="font-bold text-slate-800 block text-xs mt-0.5 truncate" title={currentItem.solicitante_setor || 'Unidade Básica de Saúde / PSF'}>
                                                {currentItem.solicitante_setor || 'Unidade Básica de Saúde / PSF'}
                                            </span>
                                        </div>

                                        {/* Data e Horário do Pedido */}
                                        <div className="p-2 bg-white/80 rounded-xl border border-slate-200">
                                            <span className="text-[9px] font-bold uppercase text-slate-500 block flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-slate-400" />
                                                <span>Data e Horário</span>
                                            </span>
                                            <span className="font-black text-slate-900 text-xs mt-0.5 block truncate">
                                                {formatDateTimeBr(currentItem.criado_em)}
                                            </span>
                                        </div>

                                        {/* Motivo Selecionado */}
                                        <div className="p-2 bg-white/80 rounded-xl border border-slate-200">
                                            <span className="text-[9px] font-bold uppercase text-slate-500 block">Motivo</span>
                                            <span className="font-black text-rose-700 uppercase block text-xs mt-0.5 truncate" title={motivoText || 'Não especificado'}>
                                                {motivoText || 'Geral'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Justificativa Apresentada */}
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-900 block">
                                            Justificativa Apresentada pelo Solicitante:
                                        </span>
                                        <div className="p-2.5 sm:p-3 bg-white rounded-xl border border-slate-200 text-slate-800 font-medium text-xs leading-relaxed italic shadow-2xs">
                                            "{justificativaText}"
                                        </div>
                                    </div>
                                </div>

                                {/* SEÇÃO 3: FORMULÁRIO DE RECUSA (SE O GESTOR CLICAR EM RECUSAR) */}
                                {isRejecting && (
                                    <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-300 space-y-2.5 animate-in fade-in duration-200">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black uppercase tracking-wider text-rose-900 flex items-center gap-1">
                                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                                <span>Justificativa da Recusa * (Obrigatória — Mínimo 5 caracteres)</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsRejecting(false);
                                                    setJustificativaRecusa('');
                                                }}
                                                className="text-[9px] font-extrabold uppercase text-slate-500 hover:text-slate-800 cursor-pointer"
                                            >
                                                Voltar
                                            </button>
                                        </div>
                                        <textarea
                                            value={justificativaRecusa}
                                            onChange={(e) => setJustificativaRecusa(e.target.value)}
                                            placeholder={`Informe detalhadamente por que esta ${isExclusao ? 'exclusão' : 'solicitação'} está sendo recusada pela Regulação...`}
                                            rows={2}
                                            className="w-full p-2.5 bg-white border border-rose-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
                                            required
                                        />
                                        <p className="text-[10px] text-rose-700 font-semibold leading-relaxed">
                                            ℹ️ Ao recusar a {isExclusao ? 'exclusão' : 'solicitação'}, o procedimento será <strong>reativado imediatamente na fila</strong> na posição correspondente à sua prioridade e <strong>data original de solicitação</strong>.
                                        </p>
                                        <div className="flex justify-end gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={handleRecusarDecisao}
                                                disabled={isProcessing || justificativaRecusa.trim().length < 5 || isOwnRequest}
                                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                                <span>Confirmar Recusa da {tipoLabel}</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>

                {/* Footer com Navegação Separada e Ações de Decisão sem Sobreposição */}
                <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    {/* Área Exclusiva de Navegação entre solicitações pendentes */}
                    <div className="flex items-center gap-1.5 shrink-0 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs w-full sm:w-auto justify-center sm:justify-start">
                        <button
                            type="button"
                            onClick={handlePrev}
                            disabled={currentIndex === 0 || isProcessing}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                            title="Solicitação Anterior"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-[11px] font-black uppercase text-slate-700 font-mono px-2 select-none">
                            {currentIndex + 1} de {solicitacoes.length}
                        </span>
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={currentIndex >= solicitacoes.length - 1 || isProcessing}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                            title="Próxima Solicitação"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Ações de Decisão: Fechar / Recusar / Confirmar */}
                    {!isRejecting && (
                        <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-end flex-wrap sm:flex-nowrap shrink-0">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="w-full xs:w-auto flex-1 sm:flex-none px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shrink-0 shadow-2xs text-center"
                                title="Fechar modal para analisar depois"
                            >
                                Fechar
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsRejecting(true)}
                                disabled={isProcessing || isOwnRequest}
                                className="w-full xs:w-auto flex-1 sm:flex-none px-3.5 sm:px-4 py-2 sm:py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 shadow-2xs whitespace-nowrap"
                                title={isOwnRequest ? 'O solicitante não pode decidir seu próprio pedido' : `Recusar pedido de ${currentItem.tipo === 'Exclusão' ? 'exclusão' : 'cancelamento'} e reativar solicitação na fila`}
                            >
                                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>{currentItem.tipo === 'Exclusão' ? 'Recusar Exclusão' : 'Recusar Cancelamento'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleConfirmarDecisao}
                                disabled={isProcessing || isOwnRequest}
                                className="w-full xs:w-auto flex-1 sm:flex-none px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap"
                                title={isOwnRequest ? 'O solicitante não pode decidir seu próprio pedido' : `Confirmar ${currentItem.tipo === 'Exclusão' ? 'exclusão lógica' : 'cancelamento definitivo'} da solicitação`}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                        <span>Processando...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                                        <span>{currentItem.tipo === 'Exclusão' ? 'Confirmar Exclusão' : 'Confirmar Cancelamento'}</span>
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
