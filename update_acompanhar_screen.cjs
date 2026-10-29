const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'consultas', 'AcompanharScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');
const isCrlf = code.includes('\r\n');
code = code.replace(/\r\n/g, '\n');

// 1. Atualizar AgendamentoCardProps
const oldCardProps = `    formatPatientName: (patient?: ConsultaPaciente | null) => string;
    agentPsf?: string;
}`;

const newCardProps = `    formatPatientName: (patient?: ConsultaPaciente | null) => string;
    agentPsf?: string;
    isCancelamentoPendente?: boolean;
    solicitacaoPendente?: ConsultaSolicitacaoCancelamento | null;
}`;

if (code.includes(oldCardProps)) {
    code = code.replace(oldCardProps, newCardProps);
    console.log('1. AgendamentoCardProps atualizado!');
} else {
    console.error('ERRO: Não encontrou oldCardProps');
}

// 2. Desestruturar novas props no _AgendamentoCard
const oldCardParams = `    formatPatientName,
    agentPsf
}) => {`;

const newCardParams = `    formatPatientName,
    agentPsf,
    isCancelamentoPendente = false,
    solicitacaoPendente = null
}) => {`;

if (code.includes(oldCardParams)) {
    code = code.replace(oldCardParams, newCardParams);
    console.log('2. _AgendamentoCard params atualizados!');
} else {
    console.error('ERRO: Não encontrou oldCardParams');
}

// 3. Inserir badge no card do paciente
const oldPatientBadgeArea = `<span className="text-[8.5px] font-black uppercase tracking-widest text-cyan-700 bg-cyan-100/70 px-2 py-0.5 rounded-md border border-cyan-200/50 w-fit leading-none">
                                    Paciente
                                </span>`;

const newPatientBadgeArea = `<span className="text-[8.5px] font-black uppercase tracking-widest text-cyan-700 bg-cyan-100/70 px-2 py-0.5 rounded-md border border-cyan-200/50 w-fit leading-none">
                                    Paciente
                                </span>
                                {isCancelamentoPendente && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider text-amber-950 bg-gradient-to-r from-amber-200 via-amber-100 to-amber-200 border border-amber-400 shadow-2xs leading-none animate-pulse" title="Solicitação de cancelamento enviada e em análise pela Regulação">
                                        <Clock className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                        <span>Cancelamento Pendente</span>
                                    </span>
                                )}`;

if (code.includes(oldPatientBadgeArea)) {
    code = code.replace(oldPatientBadgeArea, newPatientBadgeArea);
    console.log('3. Badge Cancelamento Pendente adicionado ao paciente!');
} else {
    console.error('ERRO: Não encontrou oldPatientBadgeArea');
}

// 4. Atualizar botão Cancelar em _AgendamentoCard para refletir se há cancelamento pendente
const oldCancelBtn1 = `{canCancelThis && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); onOpenCancelModal(booking); }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 rounded-lg transition-colors text-xs font-bold border border-rose-200 cursor-pointer"
                                                        title="Cancelar Agendamento"
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" />
                                                        Cancelar
                                                    </button>
                                                )}`;

const newCancelBtn1 = `{canCancelThis && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); onOpenCancelModal(booking); }}
                                                        className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold border cursor-pointer \${
                                                            isCancelamentoPendente
                                                                ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300'
                                                                : 'text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border-rose-200'
                                                        }\`}
                                                        title={
                                                            isCancelamentoPendente
                                                                ? 'Solicitação de cancelamento em análise pela Regulação'
                                                                : isGestorOrAdmin
                                                                ? 'Cancelar Agendamento Imediatamente'
                                                                : 'Solicitar Cancelamento à Regulação'
                                                        }
                                                    >
                                                        {isCancelamentoPendente ? (
                                                            <>
                                                                <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                                                <span>Cancelamento Pendente</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <XCircle className="w-3.5 h-3.5" />
                                                                <span>Cancelar</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}`;

if (code.includes(oldCancelBtn1)) {
    code = code.replace(oldCancelBtn1, newCancelBtn1);
    // Também substitui a segunda ocorrência para Fila de espera
    code = code.replace(oldCancelBtn1, newCancelBtn1);
    console.log('4. Botão Cancelar atualizado com estilo pendente!');
} else {
    console.error('ERRO: Não encontrou oldCancelBtn1');
}

// 5. Estado de cancelamentos pendentes no AcompanharScreen
const oldCancelModalStates = `    // Cancel modal states
    const [gestorUserIds, setGestorUserIds] = useState<string[]>([]);
    const [cancelTarget, setCancelTarget] = useState<ConsultaAgendamento | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelError, setCancelError] = useState('');
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);`;

const newCancelModalStates = `    // Cancel modal states
    const [gestorUserIds, setGestorUserIds] = useState<string[]>([]);
    const [cancelamentosPendentesMap, setCancelamentosPendentesMap] = useState<Record<string, ConsultaSolicitacaoCancelamento>>({});
    const [cancelTarget, setCancelTarget] = useState<ConsultaAgendamento | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelError, setCancelError] = useState('');
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

    const loadCancelamentosPendentes = async () => {
        try {
            const map = await db.getMapaCancelamentosPendentes();
            setCancelamentosPendentesMap(map);
        } catch (e) {
            console.error('Erro ao buscar mapa de cancelamentos pendentes:', e);
        }
    };`;

if (code.includes(oldCancelModalStates)) {
    code = code.replace(oldCancelModalStates, newCancelModalStates);
    console.log('5. Estados de cancelamentos pendentes inseridos!');
} else {
    console.error('ERRO: Não encontrou oldCancelModalStates');
}

// 6. Chamar loadCancelamentosPendentes nos useEffects
const oldUseEffectRealtime = `        window.addEventListener('consultas-agendamentos-changed', handleRealtimeChange);
        window.addEventListener('consultas-pacientes-changed', handleRealtimeChange);
        window.addEventListener('consultas-procedimentos-changed', handleRealtimeChange);`;

const newUseEffectRealtime = `        window.addEventListener('consultas-agendamentos-changed', handleRealtimeChange);
        window.addEventListener('consultas-pacientes-changed', handleRealtimeChange);
        window.addEventListener('consultas-procedimentos-changed', handleRealtimeChange);
        window.addEventListener('consultas-solicitacoes-cancelamento-changed', loadCancelamentosPendentes);
        loadCancelamentosPendentes();`;

if (code.includes(oldUseEffectRealtime)) {
    code = code.replace(oldUseEffectRealtime, newUseEffectRealtime);
    console.log('6. Eventos de Realtime para solicitações registrados!');
} else {
    console.error('ERRO: Não encontrou oldUseEffectRealtime');
}

// 7. Atualizar handleConfirmCancelWithReason
const oldHandleCancelFunc = `    const handleConfirmCancelWithReason = async () => {
        if (!cancelTarget) return;
        if (!cancelReason.trim()) {
            setCancelError('Por favor, informe a justificativa do cancelamento.');
            return;
        }
        setOperatingId(cancelTarget.id);
        try {
            await db.cancelAgendamentoWithReason(cancelTarget.id, cancelReason.trim(), {
                id: currentUser.id,
                name: currentUser.name
            });
            setIsCancelModalOpen(false);
            setCancelTarget(null);
            setCancelReason('');
            loadData(true);
        } catch (err: any) {
            setCancelError(err.message || 'Erro ao cancelar o agendamento.');
        } finally {
            setOperatingId(null);
        }
    };`;

const newHandleCancelFunc = `    const handleConfirmCancelWithReason = async () => {
        if (!cancelTarget) return;
        if (!cancelReason.trim() || cancelReason.trim().length < 5) {
            setCancelError('Por favor, informe a justificativa do cancelamento (mínimo de 5 caracteres).');
            return;
        }
        setOperatingId(cancelTarget.id);
        setIsSubmittingCancel(true);
        try {
            if (isGestorOrAdmin) {
                // Administradores e Gestores: Cancelamento Imediato Definitivo
                await db.cancelAgendamentoWithReason(cancelTarget.id, cancelReason.trim(), {
                    id: currentUser.id,
                    name: currentUser.name
                });
                setIsCancelModalOpen(false);
                setCancelTarget(null);
                setCancelReason('');
                await loadCancelamentosPendentes();
                loadData(true);
            } else {
                // Usuários Comuns: Solicitação de Cancelamento para aprovação da Regulação
                const res = await db.solicitarCancelamentoAgendamento({
                    agendamentoId: cancelTarget.id,
                    justificativa: cancelReason.trim(),
                    solicitante: {
                        id: currentUser.id,
                        name: currentUser.name,
                        sector: currentUser.sector
                    },
                    bookingSnapshot: cancelTarget
                });

                if (!res.success) {
                    setCancelError(res.error || 'Erro ao solicitar cancelamento.');
                    return;
                }

                setIsCancelModalOpen(false);
                setCancelTarget(null);
                setCancelReason('');
                await loadCancelamentosPendentes();
                loadData(true);
            }
        } catch (err: any) {
            setCancelError(err.message || 'Erro ao processar o cancelamento.');
        } finally {
            setOperatingId(null);
            setIsSubmittingCancel(false);
        }
    };`;

if (code.includes(oldHandleCancelFunc)) {
    code = code.replace(oldHandleCancelFunc, newHandleCancelFunc);
    console.log('7. handleConfirmCancelWithReason atualizado com fluxo seguro!');
} else {
    console.error('ERRO: Não encontrou oldHandleCancelFunc');
}

// 8. Passar isCancelamentoPendente e solicitacaoPendente no AgendamentoCard dentro do map
const oldMapCall = `                                    onOpenCancelModal={handleOpenCancelModal}
                                    onDelete={handleDelete}`;

const newMapCall = `                                    onOpenCancelModal={handleOpenCancelModal}
                                    isCancelamentoPendente={Boolean(cancelamentosPendentesMap[booking.id])}
                                    solicitacaoPendente={cancelamentosPendentesMap[booking.id] || null}
                                    onDelete={handleDelete}`;

if (code.includes(oldMapCall)) {
    code = code.replace(oldMapCall, newMapCall);
    console.log('8. Props de cancelamento pendente passadas no map!');
} else {
    console.error('ERRO: Não encontrou oldMapCall');
}

// 9. Atualizar o Modal de Cancelamento no final do JSX de AcompanharScreen
const oldCancelModalMarkup = `            {/* CANCEL MODAL */}
            {isCancelModalOpen && cancelTarget && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col transform transition-all animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-5 border-b border-rose-100 bg-rose-50/60 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shadow-inner">
                                    <XCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-rose-950 uppercase tracking-wider">Cancelar Agendamento</h3>
                                    <p className="text-[10px] text-rose-700/80 font-bold uppercase tracking-wider mt-0.5">Informe o motivo do cancelamento</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCancelModalOpen(false);
                                    setCancelTarget(null);
                                }}
                                className="p-2 hover:bg-rose-100 rounded-xl text-rose-400 hover:text-rose-700 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Content */}
                        <div className="p-6 space-y-4">
                            {/* Summary Card */}
                            <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-2xl space-y-2 text-xs font-semibold text-slate-700">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Paciente:</span>
                                    <span className="font-black text-slate-900 uppercase">{formatPatientName(cancelTarget.paciente)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Procedimento:</span>
                                    <span className="font-extrabold text-sky-600 uppercase">{formatProcedimentoLabel(cancelTarget.procedimento)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Data Atual:</span>
                                    <span className="font-bold text-slate-800">
                                        {cancelTarget.appointment_date ? new Date(cancelTarget.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Fila de Espera'}
                                    </span>
                                </div>
                            </div>

                            {/* Justificativa Field */}
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700">
                                    Justificativa do Cancelamento <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    value={cancelReason}
                                    onChange={(e) => {
                                        setCancelReason(e.target.value);
                                        if (cancelError) setCancelError('');
                                    }}
                                    placeholder="Descreva detalhadamente a justificativa para o cancelamento deste agendamento..."
                                    rows={4}
                                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all resize-none"
                                />
                                {cancelError && (
                                    <p className="text-[11px] font-extrabold text-rose-600 mt-1 flex items-center gap-1">
                                        ⚠️ {cancelError}
                                    </p>
                                )}
                            </div>

                            {/* Operator Registration Notice */}
                            <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-[10px] text-rose-700 font-bold flex items-center gap-2">
                                <span>🔒 Cancelamento será registrado por: <strong className="uppercase font-black text-rose-900">{currentUser.name}</strong></span>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCancelModalOpen(false);
                                    setCancelTarget(null);
                                }}
                                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-600 font-extrabold rounded-xl border border-slate-200 text-xs uppercase tracking-wider transition-all"
                            >
                                Manter Agendamento
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmCancelWithReason}
                                disabled={operatingId === cancelTarget.id}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl shadow-lg shadow-rose-600/20 text-xs uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                                {operatingId === cancelTarget.id ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Cancelando...</span>
                                    </>
                                ) : (
                                    <>
                                        <XCircle className="w-4 h-4" />
                                        <span>Confirmar Cancelamento</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}`;

const newCancelModalMarkup = `            {/* CANCEL MODAL SEGURO COM DIFERENCIAÇÃO GESTOR VS USUÁRIO COMUM */}
            {isCancelModalOpen && cancelTarget && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden border border-slate-100 flex flex-col transform transition-all animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className={\`p-5 border-b flex justify-between items-center shrink-0 \${
                            isGestorOrAdmin
                                ? 'border-rose-100 bg-rose-50/70 text-rose-950'
                                : 'border-amber-100 bg-amber-50/70 text-amber-950'
                        }\`}>
                            <div className="flex items-center gap-3">
                                <div className={\`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner \${
                                    isGestorOrAdmin ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                                }\`}>
                                    {isGestorOrAdmin ? <XCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-wider">
                                        {isGestorOrAdmin ? 'Cancelar Agendamento Imediatamente' : 'Solicitar Cancelamento de Agendamento'}
                                    </h3>
                                    <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5 opacity-80">
                                        {isGestorOrAdmin 
                                            ? 'Ação de Gestão • Cancelamento Definitivo' 
                                            : 'Aprovação Obrigatória pelos Gestores da Regulação'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCancelModalOpen(false);
                                    setCancelTarget(null);
                                }}
                                className="p-2 hover:bg-slate-200/50 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Content */}
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar text-xs">
                            {/* Caso já haja cancelamento pendente para este agendamento */}
                            {Boolean(cancelamentosPendentesMap[cancelTarget.id]) && (
                                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 space-y-1.5 animate-in fade-in">
                                    <div className="flex items-center gap-2 font-black text-xs uppercase text-amber-800">
                                        <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                                        <span>Solicitação Já Enviada e em Análise</span>
                                    </div>
                                    <p className="text-[11px] font-medium leading-relaxed">
                                        Este agendamento já possui uma solicitação de cancelamento aguardando a decisão dos gestores.
                                    </p>
                                    <div className="pt-2 border-t border-amber-200/70 text-[10px] space-y-1">
                                        <div><span className="font-bold">Solicitante:</span> {cancelamentosPendentesMap[cancelTarget.id].solicitante_nome}</div>
                                        <div><span className="font-bold">Data do Pedido:</span> {new Date(cancelamentosPendentesMap[cancelTarget.id].criado_em || '').toLocaleString('pt-BR')}</div>
                                        <div><span className="font-bold">Justificativa:</span> "{cancelamentosPendentesMap[cancelTarget.id].justificativa_solicitacao}"</div>
                                    </div>
                                </div>
                            )}

                            {/* Summary Card */}
                            <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-2xl space-y-2 font-semibold text-slate-700">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Paciente:</span>
                                    <span className="font-black text-slate-900 uppercase">{formatPatientName(cancelTarget.paciente)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Procedimento:</span>
                                    <span className="font-extrabold text-sky-600 uppercase">{formatProcedimentoLabel(cancelTarget.procedimento)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Data Atual:</span>
                                    <span className="font-bold text-slate-800">
                                        {cancelTarget.appointment_date ? new Date(cancelTarget.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Fila de Espera'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Situação:</span>
                                    <span className="font-bold text-slate-800 uppercase">{cancelTarget.status}</span>
                                </div>
                            </div>

                            {/* Justificativa Field */}
                            {!Boolean(cancelamentosPendentesMap[cancelTarget.id]) && (
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700">
                                        Justificativa do Cancelamento <span className="text-rose-500">*</span>
                                    </label>
                                    <textarea
                                        value={cancelReason}
                                        onChange={(e) => {
                                            setCancelReason(e.target.value);
                                            if (cancelError) setCancelError('');
                                        }}
                                        placeholder={
                                            isGestorOrAdmin
                                                ? "Descreva detalhadamente o motivo para o cancelamento imediato deste agendamento..."
                                                : "Informe detalhadamente por que este cancelamento está sendo solicitado para análise da Regulação..."
                                        }
                                        rows={4}
                                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all resize-none shadow-2xs"
                                        required
                                    />
                                    {cancelError && (
                                        <p className="text-[11px] font-extrabold text-rose-600 mt-1 flex items-center gap-1">
                                            ⚠️ {cancelError}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Aviso de Perfil */}
                            <div className={\`p-3 rounded-xl text-[10px] font-bold flex items-center gap-2 border \${
                                isGestorOrAdmin
                                    ? 'bg-rose-50/60 border-rose-200 text-rose-800'
                                    : 'bg-amber-50/60 border-amber-200 text-amber-800'
                            }\`}>
                                <span>
                                    {isGestorOrAdmin
                                        ? \`🔒 Cancelamento executivo imediato registrado por: \${currentUser.name}\`
                                        : \`📋 Solicitação será encaminhada para aprovação obrigatória dos Gestores. O agendamento permanecerá ativo até a decisão.\`}
                                </span>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCancelModalOpen(false);
                                    setCancelTarget(null);
                                }}
                                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-600 font-extrabold rounded-xl border border-slate-200 text-xs uppercase tracking-wider transition-all cursor-pointer"
                            >
                                {Boolean(cancelamentosPendentesMap[cancelTarget.id]) ? 'Fechar' : 'Manter Agendamento'}
                            </button>

                            {!Boolean(cancelamentosPendentesMap[cancelTarget.id]) && (
                                <button
                                    type="button"
                                    onClick={handleConfirmCancelWithReason}
                                    disabled={operatingId === cancelTarget.id || isSubmittingCancel}
                                    className={\`px-5 py-2.5 text-white font-extrabold rounded-xl shadow-lg text-xs uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50 \${
                                        isGestorOrAdmin
                                            ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                                            : 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 shadow-amber-600/20'
                                    }\`}
                                >
                                    {operatingId === cancelTarget.id || isSubmittingCancel ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Processando...</span>
                                        </>
                                    ) : isGestorOrAdmin ? (
                                        <>
                                            <XCircle className="w-4 h-4" />
                                            <span>Confirmar Cancelamento Imediato</span>
                                        </>
                                    ) : (
                                        <>
                                            <Clock className="w-4 h-4" />
                                            <span>Solicitar Cancelamento</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}`;

if (code.includes(oldCancelModalMarkup)) {
    code = code.replace(oldCancelModalMarkup, newCancelModalMarkup);
    console.log('9. Markup do Modal de Cancelamento atualizado com suporte seguro!');
} else {
    console.error('ERRO: Não encontrou oldCancelModalMarkup');
}

if (isCrlf) code = code.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, code, 'utf8');
console.log('AcompanharScreen.tsx atualizado com sucesso!');

