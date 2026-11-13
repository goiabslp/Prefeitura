import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, 
    ShieldAlert, 
    AlertTriangle, 
    CheckCircle2, 
    Phone, 
    Search, 
    RefreshCw, 
    FileDown, 
    Edit2, 
    Loader2, 
    Users, 
    HelpCircle, 
    Filter,
    PhoneCall,
    ExternalLink
} from 'lucide-react';
import { 
    auditarTelefonesPacientes, 
    RelatorioAuditoriaTelefones, 
    ItemAuditoriaTelefone 
} from '../../../services/consultasService';

interface AuditoriaTelefonesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEditPaciente: (pacienteId: string) => void;
}

export const AuditoriaTelefonesModal: React.FC<AuditoriaTelefonesModalProps> = ({
    isOpen,
    onClose,
    onEditPaciente
}) => {
    const [relatorio, setRelatorio] = useState<RelatorioAuditoriaTelefones | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ficticio' | 'ddd_inexistente' | 'regra_anatel'>('todos');

    const executarAuditoria = async () => {
        setLoading(true);
        try {
            const res = await auditarTelefonesPacientes();
            setRelatorio(res);
        } catch (err) {
            console.error('Erro ao executar auditoria de telefones:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            executarAuditoria();
        }
    }, [isOpen]);

    // Filtros de pesquisa e tipo de inconsistência
    const itensFiltrados = useMemo(() => {
        if (!relatorio) return [];
        let items = relatorio.itensSuspeitos;

        if (filtroTipo !== 'todos') {
            items = items.filter(item => item.tipoSuspeita === filtroTipo);
        }

        const q = searchTerm.trim().toLowerCase();
        if (q) {
            items = items.filter(item => {
                const nomeMatch = (item.pacienteNome || '').toLowerCase().includes(q);
                const cpfMatch = (item.pacienteCpf || '').includes(q.replace(/\D/g, ''));
                const telMatch = (item.telefoneCadastrado || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''));
                const motivoMatch = (item.motivo || '').toLowerCase().includes(q);
                return nomeMatch || cpfMatch || telMatch || motivoMatch;
            });
        }

        return items;
    }, [relatorio, filtroTipo, searchTerm]);

    if (!isOpen) return null;

    // Exportação rápida para CSV
    const exportarCsv = () => {
        if (!relatorio || relatorio.itensSuspeitos.length === 0) return;

        const headers = ['Paciente', 'CPF', 'Telefone Cadastrado', 'Tipo de Inconsistencia', 'Motivo Detalhado'];
        const rows = relatorio.itensSuspeitos.map(it => [
            `"${(it.pacienteNome || '').replace(/"/g, '""')}"`,
            `"${it.pacienteCpf || 'Sem CPF'}"`,
            `"${it.telefoneCadastrado || ''}"`,
            `"${it.tipoSuspeita}"`,
            `"${(it.motivo || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `auditoria_telefones_pacientes_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const percValidos = relatorio && relatorio.totalAnalisados > 0 
        ? Math.round((relatorio.totalValidos / relatorio.totalAnalisados) * 100) 
        : 0;

    return (
        <div 
            onClick={(e) => {
                if (e.target === e.currentTarget && !loading) {
                    onClose();
                }
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
        >
            <div className="w-full max-w-5xl h-[92vh] max-h-[850px] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden">
                {/* 1. CABEÇALHO */}
                <header className="px-4 py-3 sm:px-6 sm:py-3.5 bg-white border-b border-slate-200/90 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20 shrink-0">
                            <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight truncate leading-tight">
                                Auditoria de Telefones de Pacientes
                            </h2>
                            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate leading-tight">
                                Identificação preventiva de números fictícios, padrões inválidos e violações da Anatel
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={executarAuditoria}
                            disabled={loading}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Recalcular auditoria agora"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-600' : ''}`} />
                            <span className="hidden sm:inline">Recalcular</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                            title="Fechar"
                        >
                            <X className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    </div>
                </header>

                {/* 2. PAINEL DE INDICADORES DIAGNÓSTICOS */}
                <div className="p-3 sm:p-4 bg-slate-50/70 border-b border-slate-200/80 shrink-0">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {/* Total Analisados */}
                        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs">
                            <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                                Total Cadastrados
                            </span>
                            <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : (relatorio?.totalAnalisados ?? 0)}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500">Base Integrada</span>
                        </div>

                        {/* Telefones Válidos */}
                        <div className="bg-white rounded-xl p-3 border border-emerald-200/90 shadow-2xs">
                            <span className="block text-[9px] font-black uppercase tracking-wider text-emerald-600">
                                Telefones Válidos
                            </span>
                            <div className="text-lg sm:text-xl font-black text-emerald-700 mt-0.5 flex items-center gap-1.5">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> : (
                                    <>
                                        <span>{relatorio?.totalValidos ?? 0}</span>
                                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                                            {percValidos}%
                                        </span>
                                    </>
                                )}
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-600">Conformes com Anatel</span>
                        </div>

                        {/* Telefones Suspeitos / Fictícios */}
                        <div className="bg-white rounded-xl p-3 border border-rose-300 shadow-2xs bg-rose-50/30">
                            <span className="block text-[9px] font-black uppercase tracking-wider text-rose-600">
                                Telefones Suspeitos
                            </span>
                            <div className="text-lg sm:text-xl font-black text-rose-700 mt-0.5 flex items-center gap-1.5">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin text-rose-600" /> : (
                                    <>
                                        <span>{relatorio?.totalSuspeitos ?? 0}</span>
                                        {relatorio && relatorio.totalSuspeitos > 0 && (
                                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                        )}
                                    </>
                                )}
                            </div>
                            <span className="text-[10px] font-semibold text-rose-600">Requerem correção</span>
                        </div>

                        {/* Sem Telefone Cadastrado */}
                        <div className="bg-white rounded-xl p-3 border border-amber-200/90 shadow-2xs">
                            <span className="block text-[9px] font-black uppercase tracking-wider text-amber-600">
                                Sem Telefone
                            </span>
                            <div className="text-lg sm:text-xl font-black text-amber-800 mt-0.5">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin text-amber-600" /> : (relatorio?.totalSemTelefone ?? 0)}
                            </div>
                            <span className="text-[10px] font-semibold text-amber-700">Contato pendente</span>
                        </div>
                    </div>
                </div>

                {/* 3. BARRA DE BUSCA, FILTROS E EXPORTAÇÃO */}
                <div className="p-3 sm:px-6 sm:py-2.5 bg-white border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    {/* Campo de Pesquisa */}
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar paciente, CPF ou telefone na auditoria..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-rose-400 focus:ring-2 focus:ring-rose-400/10 transition-all placeholder:text-slate-400"
                        />
                    </div>

                    {/* Filtros Rápidos */}
                    <div className="flex items-center gap-1 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setFiltroTipo('todos')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                filtroTipo === 'todos' 
                                    ? 'bg-rose-600 text-white shadow-2xs' 
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                        >
                            Todos ({relatorio?.totalSuspeitos ?? 0})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFiltroTipo('ficticio')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                filtroTipo === 'ficticio' 
                                    ? 'bg-rose-600 text-white shadow-2xs' 
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                        >
                            Fictícios / Padrões
                        </button>
                        <button
                            type="button"
                            onClick={() => setFiltroTipo('ddd_inexistente')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                filtroTipo === 'ddd_inexistente' 
                                    ? 'bg-rose-600 text-white shadow-2xs' 
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                        >
                            DDD Inválido
                        </button>
                        <button
                            type="button"
                            onClick={() => setFiltroTipo('regra_anatel')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                filtroTipo === 'regra_anatel' 
                                    ? 'bg-rose-600 text-white shadow-2xs' 
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                        >
                            Regras Anatel
                        </button>
                    </div>

                    {/* Botão Exportar CSV */}
                    <button
                        type="button"
                        onClick={exportarCsv}
                        disabled={loading || !relatorio || relatorio.itensSuspeitos.length === 0}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                        <FileDown className="w-3.5 h-3.5 text-slate-600" />
                        <span>Exportar Relatório</span>
                    </button>
                </div>

                {/* 4. LISTA DE PACIENTES COM TELEFONES SUSPEITOS */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-5 no-scrollbar">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
                            <span className="text-xs font-bold">Auditando base cadastral e regras de numeração da Anatel...</span>
                        </div>
                    ) : itensFiltrados.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-3 text-center p-6 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase">
                                    {searchTerm || filtroTipo !== 'todos' ? 'Nenhum registro com estes filtros' : 'Nenhum telefone suspeito identificado!'}
                                </h3>
                                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                                    {searchTerm || filtroTipo !== 'todos' 
                                        ? 'Tente ajustar os termos de pesquisa ou remover os filtros aplicados.' 
                                        : 'Todos os números preenchidos estão em conformidade com as regras oficiais de numeração e integridade.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {itensFiltrados.map((item) => (
                                <div 
                                    key={item.pacienteId}
                                    className="p-3 bg-white hover:bg-rose-50/20 border border-slate-200/90 hover:border-rose-300 rounded-xl transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                >
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs sm:text-sm font-black text-slate-900 uppercase">
                                                {item.pacienteNome}
                                            </span>
                                            {item.pacienteCpf && (
                                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                                    CPF: {item.pacienteCpf}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap text-xs">
                                            <div className="flex items-center gap-1 font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                                <Phone className="w-3 h-3 text-rose-600 shrink-0" />
                                                <span className="line-through">{item.telefoneCadastrado}</span>
                                            </div>

                                            <span className="text-[11px] font-semibold text-rose-800">
                                                {item.motivo}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Botão de Ação: Regularizar Cadastro */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            onEditPaciente(item.pacienteId);
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0 self-start sm:self-auto"
                                        title="Abrir cadastro para regularizar o telefone"
                                    >
                                        <Edit2 className="w-3 h-3" />
                                        <span>Regularizar</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 5. RODAPÉ INFORMATIVO */}
                <footer className="px-4 py-2.5 sm:px-6 bg-slate-50 border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 shrink-0">
                    <div className="flex items-center gap-1.5 text-slate-600">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Rotina estritamente diagnóstica: nenhum registro é alterado ou excluído automaticamente.</span>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-white transition-all cursor-pointer"
                    >
                        Fechar
                    </button>
                </footer>
            </div>
        </div>
    );
};
